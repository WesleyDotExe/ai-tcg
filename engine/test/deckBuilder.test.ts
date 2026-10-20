import { describe, expect, it } from "vitest";
import { CARD_REGISTRY, getCard } from "../src/data/registry.js";
import { MAX_NEUTRAL_COPIES } from "../src/data/decks.js";
import { isRemovalOrDebuffCard } from "../src/cards/poolLint.js";
import type { Card, UnitCard } from "../src/cards/types.js";
import { Rng } from "../src/state/rng.js";
import { cardRating } from "../src/deckbuilder/cardRating.js";
import {
  DECK_FACTIONS,
  buildFaction,
  chooseDeck,
  constructDeck,
  deckSpec,
  fullHoldings,
  holdingsOf,
  listProblem,
  playGauntlet,
  playableCopies,
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
    // Half the Aegis list (every other entry) plus a full set of everything else.
    const half = new Map([...shippedList("Aegis")].filter((_, i) => i % 2 === 0));
    const holdings = fullHoldings();
    const r = constructDeck("Aegis", holdings, half);
    if ("infeasible" in r) throw new Error(r.infeasible);
    expectLegal(r.list, "Aegis", holdings);
    for (const [id, n] of half) expect(r.list.get(id) ?? 0).toBeGreaterThanOrEqual(n);
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

    const opts = { games: 3, trials: 2, confirmGames: 3, seed: 5 };
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
