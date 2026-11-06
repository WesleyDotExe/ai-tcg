import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CARD_REGISTRY, getCard } from "../src/data/registry.js";
import { MAX_NEUTRAL_COPIES } from "../src/data/decks.js";
import { isRemovalOrDebuffCard } from "../src/cards/poolLint.js";
import type { Card, DeckFaction, UnitCard } from "../src/cards/types.js";
import { Rng } from "../src/state/rng.js";
import { cardRating } from "../src/deckbuilder/cardRating.js";
import { allAbilities } from "../src/cards/modes.js";
import {
  DECK_FACTIONS,
  buildFaction,
  chooseDeck,
  constructDeck,
  deckSpec,
  fullHoldings,
  holdingsOf,
  largestDeck,
  listProblem,
  playGauntlet,
  playableCopies,
  playableHoldings,
  shippedList,
  type DeckList,
  type Holdings,
} from "../src/deckbuilder/deckBuilder.js";

function unit(over: Partial<UnitCard>): UnitCard {
  return { id: "t", name: "T", faction: "Swarm", rarity: "Common", cost: 3, type: "Unit", art: "", flavor: "", abilities: [], attack: 3, health: 4, keywords: [], ...over };
}

/** Every rule the built list must hold, checked independently of the builder. */
function expectLegal(list: DeckList, faction: string, holdings: Holdings): void {
  let total = 0;
  let neutral = 0;
  let removal = 0;
  for (const [id, n] of list) {
    const card = getCard(id)!;
    total += n;
    expect([faction, "Neutral"]).toContain(card.faction);
    expect(n).toBeLessThanOrEqual(holdings.get(id) ?? 0);
    expect(n).toBeLessThanOrEqual(playableCopies(card, Infinity));
    if (card.topTier) expect(n).toBe(1);
    if (card.faction === "Neutral") neutral += n;
    if (isRemovalOrDebuffCard(card)) removal += n;
    if (card.type === "Unit" && card.evolvesFrom) expect(list.get(card.evolvesFrom) ?? 0).toBeGreaterThan(0);
  }
  expect(total).toBeGreaterThanOrEqual(20);
  expect(total).toBeLessThanOrEqual(40);
  expect(neutral).toBeLessThanOrEqual(MAX_NEUTRAL_COPIES);
  expect(removal).toBeLessThanOrEqual(total * 0.25);
  // The engine's own deck builder accepts it (copy limits, size, lint).
  expect(() => deckSpec(list, "p1", "check")).not.toThrow();
}

/** A seeded partial collection: each card owned with some chance, 1 to its limit. */
function randomHoldings(seed: number, chance: number): Map<string, number> {
  const rng = new Rng(seed);
  const out = new Map<string, number>();
  for (const card of CARD_REGISTRY.values()) {
    if (rng.next() < chance) out.set(card.id, 1 + rng.int(3));
  }
  return out;
}

describe("cardRating (the deck builder's prior)", () => {
  it("rates every live card with a finite number", () => {
    for (const card of CARD_REGISTRY.values()) expect(Number.isFinite(cardRating(card))).toBe(true);
  });

  it("reads the card's data: more stats, keywords and draws rate higher", () => {
    expect(cardRating(unit({ attack: 4 }))).toBeGreaterThan(cardRating(unit({})));
    expect(cardRating(unit({ keywords: ["Rush"] }))).toBeGreaterThan(cardRating(unit({})));
    const draw = (count: number): Card => ({
      id: "d",
      name: "D",
      faction: "Swarm",
      rarity: "Common",
      cost: 2,
      type: "Command",
      speed: "Sorcery",
      art: "",
      flavor: "",
      abilities: [{ id: "a", trigger: "onPlay", text: "", effects: [{ kind: "drawCard", count }] }],
    });
    expect(cardRating(draw(2))).toBeGreaterThan(cardRating(draw(1)));
    // A unit that needs a base on the board rates below the same unit without.
    expect(cardRating(unit({ evolvesFrom: "x" }))).toBeLessThan(cardRating(unit({})));
  });
});

describe("constructDeck (the first deck)", () => {
  it("builds a legal 40-card deck in every faction from a full collection", () => {
    const full = fullHoldings();
    for (const f of DECK_FACTIONS) {
      const r = constructDeck(f, full);
      if ("infeasible" in r) throw new Error(r.infeasible);
      expectLegal(r.list, f, full);
      expect([...r.list.values()].reduce((a, b) => a + b, 0)).toBe(40);
    }
  });

  it("never uses more copies than owned, over 40 random partial collections", () => {
    let built = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const holdings = randomHoldings(seed, 0.45);
      for (const f of DECK_FACTIONS) {
        const r = constructDeck(f, holdings);
        if ("infeasible" in r) {
          expect(r.infeasible).toMatch(/draws|legal deck/);
          continue;
        }
        expectLegal(r.list, f, holdings);
        built++;
      }
    }
    expect(built).toBeGreaterThan(40);
  });

  it("starts from a designed list as far as it is owned, topped up from the rest", () => {
    // The owner lacks four of the Aegis list's non-Unit entries (and holds a
    // full set of everything else): the rest go in, and the gaps fill back
    // up to 40.
    const designed = shippedList("Aegis");
    const holdings = fullHoldings();
    const draws = (id: string) => JSON.stringify(allAbilities(getCard(id)!)).includes('"drawCard"');
    const lacking = [...designed.keys()].filter((id) => getCard(id)!.type !== "Unit" && !draws(id)).slice(0, 4);
    expect(lacking).toHaveLength(4);
    for (const id of lacking) holdings.set(id, 0);
    const r = constructDeck("Aegis", holdings, designed);
    if ("infeasible" in r) throw new Error(r.infeasible);
    expectLegal(r.list, "Aegis", holdings);
    for (const [id, n] of designed) if (!lacking.includes(id)) expect(r.list.get(id) ?? 0).toBeGreaterThanOrEqual(n);
    expect([...r.list.values()].reduce((a, b) => a + b, 0)).toBe(40);
  });

  it("rebuilds a starter list alone, and nothing in the other factions", () => {
    for (const f of DECK_FACTIONS) {
      const holdings = shippedList(f);
      const r = constructDeck(f, holdings);
      if ("infeasible" in r) throw new Error(r.infeasible);
      expectLegal(r.list, f, holdings);
      for (const other of DECK_FACTIONS.filter((x) => x !== f)) expect(constructDeck(other, holdings)).toHaveProperty("infeasible");
    }
  });

  it("refuses a faction with no card that draws, saying why", () => {
    const holdings = new Map([...fullHoldings()].filter(([id]) => {
      const c = getCard(id)!;
      return c.faction !== "Swarm" || !JSON.stringify(c.abilities).includes("drawCard") && !JSON.stringify(c.modes ?? []).includes("drawCard");
    }));
    expect(constructDeck("Swarm", holdings)).toEqual({ infeasible: "no owned faction card that draws (the pool lint needs one)" });
  });
});

describe("listProblem", () => {
  it("names the broken rule", () => {
    const full = fullHoldings();
    const r = constructDeck("Null", full);
    if ("infeasible" in r) throw new Error(r.infeasible);
    expect(listProblem(r.list, "Null", full)).toBeUndefined();
    expect(listProblem(r.list, "Aegis", full)).toMatch(/not a Aegis or Neutral card/);
    const tooFew = new Map([...r.list].slice(0, 2));
    expect(listProblem(tooFew, "Null", full)).toMatch(/outside 20-40/);
    const owned = new Map(r.list);
    const [id] = [...r.list.keys()];
    owned.set(id!, 0);
    expect(listProblem(r.list, "Null", owned)).toMatch(/more than allowed or owned/);
  });
});

describe("chooseDeck (the deck-building agent)", () => {
  it("builds in the forced faction only", async () => {
    const r = await chooseDeck(fullHoldings(), { faction: "Aegis", games: 0 });
    expect(r.faction).toBe("Aegis");
    expect(r.factions.map((b) => b.faction)).toEqual(["Aegis"]);
    expect(r.spec.cards.every((c) => c.faction === "Aegis" || c.faction === "Neutral")).toBe(true);
  });

  it("picks the only faction a starter collection can build", async () => {
    const r = await chooseDeck(shippedList("Null"), { games: 0 });
    expect(r.faction).toBe("Null");
    expect(r.factions.filter((b) => b.infeasible).map((b) => b.faction)).toEqual(["Cortex", "Swarm", "Aegis"]);
  });

  it("ignores ids that aren't live cards (a signature card, a reserved card)", () => {
    const h = holdingsOf(["sig-PR-001", "not-a-card", ...[...shippedList("Swarm")].flatMap(([id, n]) => Array(n).fill(id))]);
    expect(h.has("sig-PR-001")).toBe(false);
    expect([...h.values()].reduce((a, b) => a + b, 0)).toBe(40);
  });

  it("throws when no faction can be built", async () => {
    await expect(chooseDeck(new Map(), { games: 0 })).rejects.toThrow(/no deck can be built/);
  });

  it("searches and confirms deterministically, keeping only legal decks", async () => {
    const holdings = fullHoldings();
    const opts = { games: 3, trials: 4, confirmGames: 3, seed: 11 };
    const a = await buildFaction("Swarm", holdings, opts);
    const b = await buildFaction("Swarm", holdings, opts);
    expect([...a.deck!]).toEqual([...b.deck!]);
    expect(a.score).toEqual(b.score);
    expect(a.tried).toBe(4);
    expectLegal(a.deck!, "Swarm", holdings);
    // Both starts were built (a full collection's rating deck isn't the
    // designed list), and the confirm step kept the best on fresh seeds.
    expect(a.starts.map((st) => st.from)).toEqual(["rating", "designed"]);
    for (const st of a.starts) {
      expectLegal(st.list, "Swarm", holdings);
      expect(a.score!.wins).toBeGreaterThanOrEqual(st.score!.wins);
    }
    expect(a.score!.games).toBe(12);
  });

  it("plays the built deck in the given style; Calculator is the default and plays the games it always did", async () => {
    const list = shippedList("Cortex");
    const plain = await playGauntlet(list, 21, 6);
    const calc = await playGauntlet(list, 21, 6, "calculator");
    expect(calc).toEqual(plain);
    // Another style plays different games on the same seeds (the opponents,
    // Calculator on the shipped decks, are unchanged).
    const rusher = await playGauntlet(list, 21, 6, "rusher");
    expect(rusher.results).not.toEqual(plain.results);
    expect(await playGauntlet(list, 21, 6, "rusher")).toEqual(rusher);

    const opts = { games: 3, trials: 2, confirmGames: 6, seed: 5 };
    const c = await chooseDeck(shippedList("Swarm"), opts);
    const r = await chooseDeck(shippedList("Swarm"), { ...opts, style: "rusher" });
    expect(c.style).toBe("calculator");
    expect(r.style).toBe("rusher");
    const scores = (x: typeof c) => x.factions.find((f) => f.faction === "Swarm")!.starts.map((st) => st.score);
    expect(scores(r)).not.toEqual(scores(c));
  });

  it("searches as Calculator whatever the style; only the confirm step plays the style", async () => {
    const holdings = fullHoldings();
    const opts = { games: 3, trials: 4, confirmGames: 3, seed: 11 };
    const lines = { calc: [] as string[], rusher: [] as string[] };
    const calc = await buildFaction("Swarm", holdings, { ...opts, log: (l) => lines.calc.push(l) });
    const rusher = await buildFaction("Swarm", holdings, { ...opts, style: "rusher", log: (l) => lines.rusher.push(l) });
    // The same search: the same start searched from, at the same score, and
    // the same changes kept (the log's search lines carry the search's wins).
    const search = (ls: string[]) => ls.filter((l) => !l.includes("fresh seeds"));
    expect(search(lines.rusher)).toEqual(search(lines.calc));
    expect(search(lines.calc).some((l) => /searching from the \w+ start \(\d+ of 12\)/.test(l))).toBe(true);
    expect(rusher.searchedFrom).toBe(calc.searchedFrom);
    // The confirm step played Rusher's games.
    expect(rusher.starts.map((st) => st.score)).not.toEqual(calc.starts.map((st) => st.score));
  });
});

describe("keepDesigned: the designed start is kept unless beaten by more than noise (session 79, test only)", () => {
  it("is off by default: the builder keeps the most confirm wins, as the store's always has", async () => {
    const opts = { games: 3, trials: 4, confirmGames: 3, seed: 11 };
    const plain = await buildFaction("Swarm", fullHoldings(), opts);
    expect(plain.keepDesigned).toBeUndefined();
    for (const st of plain.starts) expect(plain.score!.wins).toBeGreaterThanOrEqual(st.score!.wins);
  });

  it("keeps the designed start under a margin nothing can reach, and says what the plain rule would have kept", async () => {
    const opts = { games: 3, trials: 4, confirmGames: 3, seed: 11 };
    for (const f of DECK_FACTIONS) {
      const plain = await buildFaction(f, fullHoldings(), opts);
      const lines: string[] = [];
      const kept = await buildFaction(f, fullHoldings(), { ...opts, keepDesigned: 1000, log: (l) => lines.push(l) });
      expect(kept.chosen).toBe("designed");
      expect([...kept.deck!]).toEqual([...shippedList(f)]);
      // The search and the confirm games are the plain build's: only the pick differs.
      expect(kept.starts.map((st) => st.score)).toEqual(plain.starts.map((st) => st.score));
      if (plain.chosen === "designed") {
        expect(kept.keepDesigned).toBeUndefined();
      } else {
        expect(kept.keepDesigned).toMatchObject({ plain: plain.chosen, plainWins: plain.score!.wins, kept: "designed" });
        expect(lines.some((l) => l.includes("designed deck kept"))).toBe(true);
      }
    }
  });

  it("lets a challenger through when it clears the margin (the minimum, 2 net seeds, at margin 0)", async () => {
    const opts = { games: 3, trials: 4, confirmGames: 3, seed: 11 };
    for (const f of DECK_FACTIONS) {
      const plain = await buildFaction(f, fullHoldings(), opts);
      const zero = await buildFaction(f, fullHoldings(), { ...opts, keepDesigned: 0 });
      if (!zero.keepDesigned) {
        expect(zero.chosen).toBe(plain.chosen);
        continue;
      }
      const k = zero.keepDesigned;
      expect(k.margin).toBe(2);
      expect(zero.chosen).toBe(k.gained - k.lost >= 2 ? plain.chosen : "designed");
    }
  });

  it("changes nothing without a designed start (the owner holds only the designed list: one start)", async () => {
    const opts = { games: 2, trials: 2, confirmGames: 2, seed: 3, keepDesigned: 1000 };
    const b = await buildFaction("Swarm", shippedList("Swarm"), opts);
    expect(b.starts.map((st) => st.from)).toEqual(["rating"]);
    expect(b.keepDesigned).toBeUndefined();
  });

  it("keeps the designed Null deck from a full collection at the store's settings (session 71's case: rating 214 vs designed 212 of 400)", async () => {
    const plain = await buildFaction("Null", fullHoldings());
    expect(plain.chosen).toBe("rating");
    expect(plain.score!.wins).toBe(214);
    const kept = await buildFaction("Null", fullHoldings(), { keepDesigned: 2 });
    expect(kept.chosen).toBe("designed");
    expect([...kept.deck!]).toEqual([...shippedList("Null")]);
    expect(kept.score!.wins).toBe(212);
    expect(kept.keepDesigned).toEqual({ plain: "rating", plainWins: 214, designedWins: 212, gained: 68, lost: 66, margin: 23.2, kept: "designed" });
  }, 60_000);
});

describe("a collection that runs out short of 40 cards (session 54)", () => {
  // A Null owner on day one (the starter deck plus its 3 starter packs,
  // progress/built-deck-ring/collections.json): the owned cards stop at 37,
  // and the rating fill had put in 10 removal cards, the cap for a 40-card
  // deck but over 25% of 37. The builder said no deck could be built,
  // though the owner holds the whole (legal) shipped Null list.
  const file = JSON.parse(readFileSync(fileURLToPath(new URL("../../progress/built-deck-ring/collections.json", import.meta.url)), "utf8")) as {
    collections: { faction: string; owner: number; packs: number; holdings: [string, number][] }[];
  };
  const holdings = new Map(file.collections.find((c) => c.faction === "Null" && c.owner === 1 && c.packs === 3)!.holdings);

  it("builds a legal deck, trimming removal to the share of the smaller deck", () => {
    const built = constructDeck("Null", holdings);
    expect("list" in built).toBe(true);
    const list = (built as { list: Map<string, number> }).list;
    expect(listProblem(list, "Null", holdings)).toBeUndefined();
    expect(() => deckSpec(list, "p1", "Null (built)")).not.toThrow();
  });

  it("gives every day-one owner of every faction a deck, never 'no deck'", async () => {
    for (const c of file.collections.filter((x) => x.packs === 3)) {
      const b = await buildFaction(c.faction as DeckFaction, new Map(c.holdings), { games: 0 });
      expect(b.infeasible, `${c.faction} owner ${c.owner}`).toBeUndefined();
    }
  });
});

describe("the designed start: the designed list, filled to the deck's size (session 54; option B, session 58)", () => {
  it("is each faction's shipped list exactly from a full collection (every list is 40 since session 60)", () => {
    for (const f of DECK_FACTIONS) {
      const built = constructDeck(f, fullHoldings(), shippedList(f));
      expect("list" in built, f).toBe(true);
      const list = (built as { list: DeckList }).list;
      expect([...list.values()].reduce((s, n) => s + n, 0), f).toBe(40);
      // Every designed list is 40, so the start is the designed list, no fill.
      expect([...list].sort(), f).toEqual([...shippedList(f)].sort());
    }
  });

  it("is the designed list alone when the owner holds only that list (a 40-card starter)", () => {
    for (const f of DECK_FACTIONS) {
      const built = constructDeck(f, shippedList(f), shippedList(f)) as { list: DeckList };
      expect([...built.list].sort(), f).toEqual([...shippedList(f)].sort());
    }
  });

  it("fills the gaps when copies are missing, up to the deck's size", () => {
    const holdings = fullHoldings();
    const designed = shippedList("Null");
    // A card no evolution builds on, so taking it out takes out nothing else.
    const missing = [...designed.keys()].find((id) => getCard(id)!.type !== "Unit");
    holdings.set(missing!, 0);
    const built = constructDeck("Null", holdings, designed) as { list: DeckList };
    const total = [...built.list.values()].reduce((s, n) => s + n, 0);
    expect(total).toBe(largestDeck("Null", holdings));
    expect(total).toBe(40);
    expect(listProblem(built.list, "Null", holdings)).toBeUndefined();
    expect(built.list.has(missing!)).toBe(false);
    for (const [id, n] of designed) if (id !== missing) expect(built.list.get(id) ?? 0).toBeGreaterThanOrEqual(n);
  });
});

describe("largestDeck: every built deck is as large as the owned cards allow (owner 2026-10-26, option B)", () => {
  const ring = JSON.parse(readFileSync(fileURLToPath(new URL("../../progress/built-deck-ring/collections.json", import.meta.url)), "utf8")) as {
    collections: { holdings: [string, number][] }[];
  };
  const collections = (): Map<string, number>[] => [
    fullHoldings(),
    ...Array.from({ length: 120 }, (_, i) => randomHoldings(1000 + i, 0.1 + (i % 9) / 10)),
    ...ring.collections.map((c) => new Map(c.holdings)),
  ];

  it("is 40 from a full collection and the starter's size from a starter alone", () => {
    for (const f of DECK_FACTIONS) {
      expect(largestDeck(f, fullHoldings()), f).toBe(40);
      expect(largestDeck(f, shippedList(f)), f).toBe([...shippedList(f).values()].reduce((s, n) => s + n, 0));
    }
  });

  it("is 27 for the owner API demo's Null lock (17 Null copies + 10 neutral), the deck-size report's count", () => {
    const demo = JSON.parse(readFileSync(fileURLToPath(new URL("../../progress/deck-size/demo-owner-holdings.json", import.meta.url)), "utf8")) as { holdings: [string, number][] };
    expect(largestDeck("Null", new Map(demo.holdings))).toBe(27);
  });

  it("is what both starts build, in every faction, over random and the ring's realistic collections", () => {
    let built = 0;
    for (const holdings of collections()) {
      for (const f of DECK_FACTIONS) {
        const target = largestDeck(f, holdings);
        for (const start of [undefined, shippedList(f)]) {
          const r = constructDeck(f, holdings, start);
          if ("infeasible" in r) {
            // Only too few cards, or no faction card that draws or attacks.
            if (target >= 20) expect(r.infeasible, `${f} ${target}`).toMatch(/draws|attacks/);
            continue;
          }
          expectLegal(r.list, f, holdings);
          expect([...r.list.values()].reduce((s, n) => s + n, 0), f).toBe(target);
          built++;
        }
      }
    }
    expect(built).toBeGreaterThan(500);
  });

  it("can't be beaten by one more copy: below 40, every spare added breaks a rule", () => {
    let checked = 0;
    for (const holdings of collections()) {
      for (const f of DECK_FACTIONS) {
        const r = constructDeck(f, holdings);
        if ("infeasible" in r || largestDeck(f, holdings) === 40) continue;
        for (const [id, owned] of holdings) {
          const card = getCard(id);
          if (!card || (r.list.get(id) ?? 0) >= playableCopies(card, owned)) continue;
          const more = new Map(r.list);
          more.set(id, (more.get(id) ?? 0) + 1);
          expect(listProblem(more, f, holdings), `${f} +${card.name}`).toBeDefined();
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("the search only swaps: the kept deck is the size the cards allow", async () => {
    // A partial collection under 40 usable Null cards and a full one.
    const partial = JSON.parse(readFileSync(fileURLToPath(new URL("../../progress/deck-size/demo-owner-holdings.json", import.meta.url)), "utf8")) as { holdings: [string, number][] };
    for (const holdings of [new Map(partial.holdings), fullHoldings()]) {
      const lines: string[] = [];
      const b = await buildFaction("Null", holdings, { games: 3, trials: 12, confirmGames: 3, seed: 7, log: (l) => lines.push(l) });
      expect([...b.deck!.values()].reduce((s, n) => s + n, 0)).toBe(largestDeck("Null", holdings));
      for (const st of b.starts) expect([...st.list.values()].reduce((s, n) => s + n, 0)).toBe(largestDeck("Null", holdings));
      // Every kept change takes one card out and puts one in.
      for (const k of lines.filter((l) => l.includes(": kept "))) expect(k).toMatch(/-1 .* \+1 /);
    }
  });
});

describe("playableHoldings: what the builder can see of the cards held (session 55)", () => {
  // Holdings with copies past every limit, cards of every faction and an id
  // no live card has: everything the builder must ignore.
  function excess(seed: number): Map<string, number> {
    const out = randomHoldings(seed, 0.6);
    for (const [id, n] of out) out.set(id, n + 2);
    out.set("sig-not-a-live-card", 1);
    return out;
  }

  it("keeps only the faction's and Neutral cards, each at most its deck limit", () => {
    const holdings = excess(3);
    for (const f of DECK_FACTIONS) {
      const seen = playableHoldings(holdings, f);
      for (const [id, n] of seen) {
        const card = getCard(id)!;
        expect([f, "Neutral"]).toContain(card.faction);
        expect(n).toBe(playableCopies(card, holdings.get(id)!));
        expect(n).toBeGreaterThan(0);
      }
      for (const [id, owned] of holdings) {
        const card = getCard(id);
        if (card && (card.faction === f || card.faction === "Neutral")) expect(seen.get(id)).toBe(playableCopies(card, owned));
      }
    }
    // With no faction, every live card, capped; the unknown id is gone.
    const all = playableHoldings(holdings);
    expect(all.has("sig-not-a-live-card")).toBe(false);
    expect(all.size).toBe(holdings.size - 1);
  });

  it("builds exactly the decks the whole holdings build, in a forced faction and with none", async () => {
    const opts = { games: 2, trials: 3, confirmGames: 2, seed: 5 };
    // Seeds whose collections hold an Aegis card that draws.
    for (const seed of [1, 4]) {
      const holdings = excess(seed);
            const forced = await chooseDeck(holdings, { ...opts, faction: "Aegis" });
      expect(await chooseDeck(playableHoldings(holdings, "Aegis"), { ...opts, faction: "Aegis" })).toEqual(forced);
      const any = await chooseDeck(holdings, opts);
      expect(await chooseDeck(playableHoldings(holdings), opts)).toEqual(any);
    }
  });
});
