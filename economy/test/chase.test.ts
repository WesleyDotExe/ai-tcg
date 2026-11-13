// Chase cards (owner 2026-10-16 "more collectable chase cards", items 1-5;
// proposed session 38, approved 2026-10-18 "yes on 1-6", live session 39):
// the secret cards, the Glitch tier, S0-odds-2 in openPack, schema v10's
// copies, secret crafting and the binder.

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LookaheadAgent, buildAegisDeck, getCard, isBoosterCard, runMatch } from "@ai-tcg/engine";
import {
  EconomyStore,
  FULL_ART_OR_BETTER,
  LIVE_PACK_ODDS,
  PACK_ODDS,
  PACK_ODDS_TABLES,
  PACK_ODDS_V2,
  PACK_ODDS_V3,
  PACK_POINTS_PER_PACK,
  S0_GLITCH_CARDS,
  S0_GLITCH_CARDS_V2,
  SECRET_CRAFT_PACK_POINTS,
  baseHitPercent,
  cardSet,
  nextPity,
  rollPack,
  type PackRoll,
  type PityState,
} from "../src/index.js";

const S0 = cardSet("S0");
/** The set as it stood before the booster cards (session 97): what
 * S0-odds-1 and S0-odds-2 roll. */
const LEGACY = S0.legacy!;
const NO_PITY: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
const RUNS = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
/** A pack under the live table (S0-odds-3 since session 97). */
const roll = (seed: number, pity = NO_PITY): PackRoll => rollPack(seed, S0, pity, RUNS, LIVE_PACK_ODDS);
/** The two chase tables, each with the set view and Glitch list it rolls. */
const CHASE_TABLES = [
  { odds: PACK_ODDS_V2, set: LEGACY, glitch: S0_GLITCH_CARDS_V2, booster: false },
  { odds: PACK_ODDS_V3, set: S0, glitch: S0_GLITCH_CARDS, booster: true },
] as const;
const highestGold = (set: typeof S0) => Math.max(...set.cards.flatMap((c) => (c.goldNumber === null ? [] : [num(c.goldNumber)])));
const num = (collector: string) => Number(collector.split("/")[0]);
const T0 = Date.parse("2026-10-18T10:00:00.000Z");
const store = () => EconomyStore.open(":memory:", { now: () => new Date(T0) });
/** The first seed whose live pack (fresh pity) passes `want`. */
function seedWhere(want: (r: PackRoll) => boolean, start = 0): number {
  for (let seed = start; seed < start + 2_000_000; seed++) if (want(roll(seed))) return seed;
  throw new Error("no seed found");
}
function ownerWithPacks(s: EconomyStore, n: number): string {
  const o = s.createOwner({ name: `owner-${Math.random()}` }).ownerId;
  for (let i = 0; i < n; i++) s.grantPack(o, "S0", "weeklyChallenge");
  return o;
}

describe("the secret cards", () => {
  it("S0-odds-2's legacy set: 33 illustrations and 3 Zero-Day slots above every Gold number, all five pools", () => {
    const illus = LEGACY.secrets.filter((x) => x.kind === "illustration");
    expect(illus).toHaveLength(33);
    expect(LEGACY.cards).toHaveLength(96);
    expect(LEGACY.secrets[0]!.collectorNumber).toBe("193/096");
    expect(LEGACY.secrets.at(-1)!.collectorNumber).toBe("228/096");
    expect([...new Set(illus.map((x) => getCard(x.cardId)!.faction))].sort()).toEqual(["Aegis", "Cortex", "Neutral", "Null", "Swarm"]);
  });

  it("16 booster-card illustrations and 3 Zero-Day slots, numbered above every Gold number, each its own entry (session 97)", () => {
    const illus = S0.secrets.filter((s) => s.kind === "illustration");
    const zd = S0.secrets.filter((s) => s.kind === "zeroDay");
    expect(illus).toHaveLength(16);
    expect(zd).toHaveLength(3);
    const numbers = S0.secrets.map((s) => num(s.collectorNumber));
    expect(highestGold(S0)).toBe(152);
    expect(numbers[0]).toBe(highestGold(S0) + 1);
    expect(numbers).toEqual(numbers.map((_, i) => highestGold(S0) + 1 + i)); // contiguous, unique
    expect(S0.secrets.at(-1)!.collectorNumber).toBe("171/124");
    expect(S0.secrets.every((s) => s.collectorNumber.endsWith(`/${String(S0.cards.length).padStart(3, "0")}`))).toBe(true);
    expect(new Set(S0.secrets.map((s) => s.code)).size).toBe(19);
    // Zero-Day sits at the very top, animated; illustrations name their card.
    expect(zd.map((s) => s.code)).toEqual(["S0-ZD1", "S0-ZD2", "S0-ZD3"]);
    // A Zero-Day card's id is its code: the card is designed under it later.
    expect(zd.every((s) => s.animated && s.cardId === s.code && s.rarity === "Mythic")).toBe(true);
    for (const s of illus) {
      expect(s.animated).toBe(false);
      expect(getCard(s.cardId!)!.name).toBe(s.name);
      expect(s.art).toBe(`placeholder:secret/${s.code}`);
      expect(isBoosterCard(s.cardId), s.cardId).toBe(true);
    }
    // Four per faction: its Mythic, both Rares, one Common.
    for (const f of ["Cortex", "Swarm", "Aegis", "Null"]) {
      const mine = illus.filter((x) => getCard(x.cardId)!.faction === f).map((x) => x.rarity);
      expect(mine.sort(), f).toEqual(["Common", "Mythic", "Rare", "Rare"]);
    }
  });
});

describe("the Glitch tier", () => {
  it("S0-odds-2's list: 20 listed Units, four per pool, none twice", () => {
    expect(S0_GLITCH_CARDS_V2).toHaveLength(20);
    expect(new Set(S0_GLITCH_CARDS_V2).size).toBe(20);
    const byPool: Record<string, number> = {};
    for (const id of S0_GLITCH_CARDS_V2) {
      expect(getCard(id)!.type, id).toBe("Unit");
      byPool[getCard(id)!.faction] = (byPool[getCard(id)!.faction] ?? 0) + 1;
    }
    expect(Object.values(byPool)).toEqual([4, 4, 4, 4, 4]);
    expect(LEGACY.glitch).toEqual(S0_GLITCH_CARDS_V2);
  });

  it("from S0-odds-3: 16 booster Units, four per faction, none twice (session 97)", () => {
    expect(S0_GLITCH_CARDS).toHaveLength(16);
    expect(new Set(S0_GLITCH_CARDS).size).toBe(16);
    const byPool: Record<string, number> = {};
    for (const id of S0_GLITCH_CARDS) {
      expect(getCard(id)!.type, id).toBe("Unit");
      expect(isBoosterCard(id), id).toBe(true);
      byPool[getCard(id)!.faction] = (byPool[getCard(id)!.faction] ?? 0) + 1;
    }
    expect(byPool).toEqual({ Cortex: 4, Swarm: 4, Aegis: 4, Null: 4 });
    expect(S0.glitch).toEqual(S0_GLITCH_CARDS);
  });
});

describe("rollPack under the chase tables (S0-odds-2 on the legacy set, S0-odds-3 on the booster cards)", () => {
  it("is deterministic and keeps the pack's shape", () => {
    expect(roll(77)).toEqual(roll(77));
    for (let seed = 0; seed < 2000; seed++) {
      const r = roll(seed);
      expect(r.pulls.slice(0, 5).map((p) => p.slot)).toEqual(["Common", "Common", "Uncommon", "Rare", "shine"]);
      expect(r.pulls.length === 5 || (r.pulls.length === 6 && r.pulls[5]!.slot === "bonus")).toBe(true);
    }
  });

  it.each(CHASE_TABLES)("lands each special version only on the cards it may go on ($odds.version)", ({ odds, set, glitch: glitchList, booster }) => {
    const glitch = new Set(glitchList);
    const secretByCode = new Map(set.secrets.map((s) => [s.code, s]));
    const seen = new Set<string>();
    for (let seed = 0; seed < 60_000; seed++) {
      const r = rollPack(seed, S0, NO_PITY, RUNS, odds);
      for (const p of r.pulls) {
        // S0-odds-3: every card is a booster card or a Zero-Day card;
        // S0-odds-2: none is a booster card.
        expect(isBoosterCard(p.cardId) || p.finish === "zeroDay", `${odds.version} ${p.cardId}`).toBe(booster || p.finish === "zeroDay");
        seen.add(p.finish);
        if (p.finish === "fullArt") expect(p.rarity).not.toBe("Common");
        if (p.finish === "altArt" || p.finish === "gold") expect(["Rare", "Mythic"]).toContain(p.rarity);
        if (p.finish === "glitch") expect(glitch.has(p.cardId)).toBe(true);
        if (p.finish === "secret" || p.finish === "zeroDay") {
          const s = secretByCode.get(p.secret!)!;
          expect(p.slot).toBe("shine");
          expect(s.kind).toBe(p.finish === "secret" ? "illustration" : "zeroDay");
          expect(p.collectorNumber).toBe(s.collectorNumber);
        }
        if (p.finish === "gold") expect(p.collectorNumber).toBe(set.cards.find((c) => c.cardId === p.cardId)!.goldNumber);
        if (p.finish !== "gold" && !p.secret) expect(p.collectorNumber).toBe(set.cards.find((c) => c.cardId === p.cardId)!.collectorNumber);
        if (p.slot !== "shine" && !r.jackpot && p.slot !== "bonus") expect(p.finish).toBe("standard");
      }
    }
    for (const f of ["standard", "foil", "fullArt", "glitch", "altArt", "secret", "gold", "zeroDay"]) expect(seen.has(f), f).toBe(true);
  });

  it("a Jackpot pack is Foil or better throughout, each card in a finish it can carry", () => {
    let jackpots = 0;
    for (let seed = 0; seed < 200_000 && jackpots < 20; seed++) {
      const r = roll(seed);
      if (!r.jackpot) continue;
      jackpots++;
      for (const p of r.pulls) {
        expect(p.finish).not.toBe("standard");
        if (p.slot !== "shine" && p.slot !== "bonus") {
          expect(["secret", "zeroDay"]).not.toContain(p.finish);
          if (p.rarity === "Common") expect(["foil", "glitch"]).toContain(p.finish);
        }
      }
    }
    expect(jackpots).toBe(20);
  });

  it("pity: a due hit makes the shine slot a hit, a due Mythic makes the Rare slot a Mythic, and the timers reset", () => {
    for (let seed = 0; seed < 3000; seed++) {
      const r = roll(seed, { packsSinceFullArt: PACK_ODDS_V2.pity.fullArtAfter, packsSinceMythic: PACK_ODDS_V2.pity.mythicAfter });
      expect(FULL_ART_OR_BETTER).toContain(r.pulls[4]!.finish);
      expect(r.pulls[3]!.rarity).toBe("Mythic");
      expect(nextPity({ packsSinceFullArt: 10, packsSinceMythic: 40 }, r.pulls)).toEqual({ packsSinceFullArt: 0, packsSinceMythic: 0 });
    }
    // A dry pack counts up.
    expect(nextPity({ packsSinceFullArt: 3, packsSinceMythic: 7 }, [{ finish: "foil", rarity: "Common" }])).toEqual({ packsSinceFullArt: 4, packsSinceMythic: 8 });
  });

  it("measures near the table: hits about 18.4% before pity, Zero-Day about 1 in 500, Jackpot about 1 in 2,000", () => {
    const N = 200_000;
    let hits = 0;
    let zd = 0;
    let jackpots = 0;
    for (let seed = 0; seed < N; seed++) {
      const r = roll(1_000_000 + seed);
      if (r.pulls.some((p) => FULL_ART_OR_BETTER.includes(p.finish))) hits++;
      if (r.pulls.some((p) => p.finish === "zeroDay")) zd++;
      if (r.jackpot) jackpots++;
    }
    expect(baseHitPercent(PACK_ODDS_V2)).toBeCloseTo(18.4, 5);
    expect(baseHitPercent(PACK_ODDS)).toBeCloseTo(14, 5);
    expect(hits / N).toBeGreaterThan(0.178);
    expect(hits / N).toBeLessThan(0.192);
    expect(N / zd).toBeGreaterThan(400);
    expect(N / zd).toBeLessThan(620);
    // Jackpot: 100 expected in 200,000 (1 in 2,000), sd about 10. Seeded,
    // so the count is fixed, but an unrelated change to how the roller uses
    // its seed redraws it: each bound sits 4 sd out (session 50 audit; the
    // old 1,500-2,700 ratio bounds sat 2.6 sd below, closer to chance than a
    // fixed count should).
    expect(Math.abs(jackpots - N / 2000)).toBeLessThan(4 * Math.sqrt(N * (1 / 2000) * (1 - 1 / 2000)));
  });
});

describe("every table reproduces its packs from their seeds", () => {
  // Pinned (session 39, when the two rollers became one): 20,000 seeds per
  // table across all four pity states, with every 7th pack's Prototype runs
  // used up. The hashes were taken from the pre-merge rollers (rollPack for
  // S0-odds-1, rollPackV2 for S0-odds-2) and matched after the merge over
  // 60,000 seeds, so every logged opening of either table still reproduces.
  // If this fails, a change moved a table's random draws: give the change a
  // new odds version instead.
  const PINNED: Record<string, string> = {
    "S0-odds-1": "1efcc4db932d08a61afdc422a6f94a5141756fb2ed1b5ce5ee2bbbed983ef66c",
    "S0-odds-2": "3fdd1b3fbb4c1959635fa21490d50baddda5cc89c1efb584ed05a7eba1fb4ada",
    // Session 97: pinned when it went live. S0-odds-1 and S0-odds-2 above
    // kept their hashes through the booster cards (they roll the legacy set).
    "S0-odds-3": "7c3eda22f8cf90addd558c47c9808109940da591084c5f5d970210668881ae2a",
  };
  const canon = (v: unknown): string =>
    Array.isArray(v)
      ? `[${v.map(canon).join(",")}]`
      : v && typeof v === "object"
        ? `{${Object.keys(v)
            .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
            .sort()
            .map((k) => `${k}:${canon((v as Record<string, unknown>)[k])}`)
            .join(",")}}`
        : JSON.stringify(v);
  const NO_RUNS = new Map(S0.prototypes.map((r) => [r.code, 0]));
  const PITIES: PityState[] = [NO_PITY, { packsSinceFullArt: 10, packsSinceMythic: 0 }, { packsSinceFullArt: 0, packsSinceMythic: 40 }, { packsSinceFullArt: 10, packsSinceMythic: 40 }];

  it("pins S0-odds-1, S0-odds-2 and S0-odds-3, the only tables ever live", () => {
    expect([...PACK_ODDS_TABLES.keys()]).toEqual(Object.keys(PINNED));
    for (const [version, odds] of PACK_ODDS_TABLES) {
      const h = createHash("sha256");
      for (let seed = 1; seed <= 20_000; seed++) h.update(canon(rollPack(seed, S0, PITIES[seed % 4]!, seed % 7 === 0 ? NO_RUNS : RUNS, odds)));
      expect(h.digest("hex"), version).toBe(PINNED[version]);
    }
  });
});

describe("live: openPack rolls S0-odds-3 (S0-odds-2 until session 97)", () => {
  it("every pack opens under the live table and its opening records the version", () => {
    const s = store();
    const o = ownerWithPacks(s, 1);
    const opened = s.openPack(o, undefined, { seed: 5 });
    expect(LIVE_PACK_ODDS.version).toBe("S0-odds-3");
    expect(opened.oddsVersion).toBe("S0-odds-3");
    expect(s.packOpening(opened.packId).oddsVersion).toBe("S0-odds-3");
    expect(opened.cards.map((c) => [c.cardId, c.finish])).toEqual(roll(5).pulls.map((p) => [p.cardId, p.finish]));
  });

  it("a secret illustration: its own entry and number, NEW even when the card is held, a full reveal, never salvaged", () => {
    const s = store();
    const o = ownerWithPacks(s, 1);
    const seed = seedWhere((r) => r.pulls[4]!.finish === "secret" && !r.jackpot);
    const pull = roll(seed).pulls[4]!;
    const secret = S0.secrets.find((x) => x.code === pull.secret)!;
    s.grantCopy({ ownerId: o, cardId: secret.cardId, origin: "pack" }); // the plain card is already held
    const opened = s.openPack(o, undefined, { seed });
    const card = opened.cards[4]!;
    expect(card).toMatchObject({
      cardId: secret.cardId,
      name: secret.name,
      finish: "secret",
      collectorNumber: secret.collectorNumber,
      secret: { code: secret.code, kind: "illustration", art: `placeholder:secret/${secret.code}`, animated: false },
      isNew: true,
    });
    expect(card.ownedAfter).toBe(1 + opened.cards.filter((c) => c.cardId === secret.cardId).length);
    expect(num(card.collectorNumber)).toBeGreaterThan(highestGold(S0));
    expect(opened.fullReveal).toBe(true);
    const copy = s.getCopy(card.copyId);
    expect(copy).toMatchObject({ finish: "secret", secretCode: secret.code, seriesKind: "set", accountBound: false });
    const holdings = s.cardHoldings(o, secret.cardId);
    expect(holdings.notSalvageable).toContainEqual({ reason: "Secret illustration copies are never salvaged", count: 1 });
    // The schema refuses it too.
    expect(() => s.unsafeExec(`UPDATE card_copies SET disposed_at = 'x', disposed_reason = 'salvaged' WHERE copy_id = '${card.copyId}'`)).toThrow(/CHECK/);
  });

  it("a plain card held only as an illustration or a Glitch copy is not NEW (its base place is filled)", () => {
    const s = store();
    const o = ownerWithPacks(s, 1);
    const seed = seedWhere((r) => !r.jackpot && S0.secrets.some((x) => x.kind === "illustration" && x.cardId === r.pulls[0]!.cardId) && S0_GLITCH_CARDS.includes(r.pulls[3]!.cardId));
    const first = roll(seed).pulls;
    const illus = S0.secrets.find((x) => x.kind === "illustration" && x.cardId === first[0]!.cardId)!;
    s.grantCopy({ ownerId: o, cardId: illus.cardId, origin: "pack", finish: "secret", secretCode: illus.code });
    s.grantCopy({ ownerId: o, cardId: first[3]!.cardId, origin: "pack", finish: "glitch" });
    const opened = s.openPack(o, undefined, { seed });
    expect(opened.cards[0]).toMatchObject({ finish: "standard", isNew: false });
    expect(opened.cards[3]).toMatchObject({ finish: "standard", isNew: false });
  });

  it("a Glitch card: a listed Unit at its own number, NEW over plain copies, no full reveal by itself", () => {
    const s = store();
    const o = ownerWithPacks(s, 1);
    const seed = seedWhere((r) => r.pulls[4]!.finish === "glitch" && !r.jackpot && r.pulls.length === 5 && !r.pulls.some((p) => p.finish === "gold"));
    const pull = roll(seed).pulls[4]!;
    s.grantCopy({ ownerId: o, cardId: pull.cardId, origin: "pack" });
    const opened = s.openPack(o, undefined, { seed });
    const card = opened.cards[4]!;
    expect(S0_GLITCH_CARDS).toContain(card.cardId);
    expect(card).toMatchObject({ finish: "glitch", secret: null, isNew: true });
    expect(card.collectorNumber).toBe(S0.cards.find((c) => c.cardId === card.cardId)!.collectorNumber);
    expect(opened.fullReveal).toBe(false);
    expect(s.cardHoldings(o, card.cardId).notSalvageable).toContainEqual({ reason: "Glitch copies are never salvaged", count: 1 });
    // A second Glitch copy of the same card is no longer NEW.
    const again = s.grantCopy({ ownerId: o, cardId: card.cardId, origin: "pack", finish: "glitch" });
    expect(again.finish).toBe("glitch");
    expect(s.binder(o, "S0").glitch.entries.find((e) => e.cardId === card.cardId)!.owned).toBe(2);
  });

  it("a Zero-Day card: its code is its card id, it counts as a Mythic for pity, and the pulled copy plays (live since session 42)", async () => {
    const s = store();
    const o = ownerWithPacks(s, 41);
    // 40 packs with no Mythic, so the Mythic timer is due ...
    for (let i = 0; i < 40; i++) {
      const seed = (() => {
        const pity = s.pityStatus(o);
        for (let x = i * 1000; ; x++) if (!rollPack(x, S0, pity, RUNS, LIVE_PACK_ODDS).pulls.some((p) => p.rarity === "Mythic")) return x;
      })();
      s.openPack(o, undefined, { seed });
    }
    expect(s.pityStatus(o).next.mythic).toBe(true);
    // ... and a Zero-Day pack resets it (the Rare slot is forced to a Mythic
    // too; the Zero-Day card is a Mythic either way).
    const zdSeed = (() => {
      const pity = s.pityStatus(o);
      for (let x = 0; ; x++) if (rollPack(x, S0, pity, RUNS, LIVE_PACK_ODDS).pulls[4]!.finish === "zeroDay") return x;
    })();
    const opened = s.openPack(o, undefined, { seed: zdSeed });
    const zd = opened.cards[4]!;
    const entry = S0.secrets.find((x) => x.code === zd.cardId)!;
    expect(entry.kind).toBe("zeroDay");
    expect(zd).toMatchObject({ finish: "zeroDay", rarity: "Mythic", name: entry.name, secret: { code: entry.code, kind: "zeroDay", animated: true }, isNew: true });
    // The entry is the live card: its name, and the same art slot.
    const card = getCard(entry.code)!;
    expect(card).toMatchObject({ name: entry.name, rarity: "Mythic", faction: "Neutral", topTier: "zeroDay", art: entry.art });
    expect(opened.fullReveal).toBe(true);
    expect(s.pityStatus(o)).toMatchObject({ packsSinceMythic: 0 });
    expect(s.getCopy(zd.copyId)).toMatchObject({ cardId: entry.code, secretCode: entry.code, finish: "zeroDay" });
    expect(s.cardHoldings(o, entry.code)).toMatchObject({ rarity: "Mythic", owned: 1, salvageable: 0 });
    // A deck holds it now: one starter card out, the Zero-Day card in. A
    // removal Zero-Day card (Kill Switch) swaps for one of the starter's
    // removal cards so the deck stays inside the 25% removal share.
    const starter = s.grantStarterCollection(o, "Aegis").copies;
    const out = card.type === "Command" ? starter.findIndex((c) => getCard(c.cardId)!.type === "Command") : 0;
    const listed = [...starter.filter((_, i) => i !== out).map((c) => c.copyId), zd.copyId];
    const saved = s.saveDeck(o, "with zero-day", listed);
    const playable = s.loadDeck(saved.deckId);
    expect(playable.spec.cards.filter((c) => c.id === entry.code)).toHaveLength(1);
    // ... and a match with it resolves end to end.
    const { state } = await runMatch({ ...playable.spec, id: "p1" }, buildAegisDeck("p2", "Aegis"), new LookaheadAgent("zd", 7), new LookaheadAgent("ag", 7), 7);
    expect(state.winner).not.toBeNull();
    // A second copy (pulled again) can't go in the same deck: 1 per deck.
    const second = s.grantCopy({ ownerId: o, cardId: entry.code, origin: "pack", finish: "zeroDay", secretCode: entry.code });
    expect(() => s.saveDeck(o, "two", [...listed.slice(1), second.copyId])).toThrow(/copies of/);
  });

  it("a Zero-Day card has no version but its Zero-Day finish, and never rolls as a base-set card", () => {
    const s = store();
    const o = ownerWithPacks(s, 0);
    for (const finish of ["standard", "foil", "fullArt", "gold"] as const) {
      expect(() => s.grantCopy({ ownerId: o, cardId: "S0-ZD1", origin: "pack", finish })).toThrow(/only version is the Zero-Day finish/);
    }
    expect(S0.cards.some((c) => c.cardId.startsWith("S0-ZD"))).toBe(false);
    for (let seed = 0; seed < 3000; seed++) {
      for (const p of roll(seed).pulls) if (p.cardId.startsWith("S0-ZD")) expect(p.finish).toBe("zeroDay");
    }
  });

  it("v10's rules: a secret or Zero-Day copy names a fitting secret card, nothing else does, and a copy's identity never changes", () => {
    const s = store();
    const o = ownerWithPacks(s, 0);
    const illus = S0.secrets.find((x) => x.kind === "illustration")!;
    const other = S0.secrets.find((x) => x.kind === "illustration" && x.cardId !== illus.cardId)!;
    const zd = S0.secrets.find((x) => x.kind === "zeroDay")!;
    const notGlitch = S0.cards.find((c) => !S0_GLITCH_CARDS.includes(c.cardId))!.cardId;
    expect(() => s.grantCopy({ ownerId: o, cardId: illus.cardId, origin: "pack", finish: "secret" })).toThrow(/names its secret card/);
    expect(() => s.grantCopy({ ownerId: o, cardId: illus.cardId, origin: "pack", finish: "secret", secretCode: other.code })).toThrow(/is a version of/);
    expect(() => s.grantCopy({ ownerId: o, cardId: illus.cardId, origin: "pack", finish: "zeroDay", secretCode: illus.code })).toThrow(/not a Zero-Day card/);
    expect(() => s.grantCopy({ ownerId: o, cardId: illus.cardId, origin: "pack", secretCode: illus.code })).toThrow(/only secret and Zero-Day/);
    expect(() => s.grantCopy({ ownerId: o, cardId: notGlitch, origin: "pack", finish: "glitch" })).toThrow(/no Glitch version/);
    expect(() => s.grantCopy({ ownerId: o, cardId: "S0-ZD9", origin: "pack", finish: "zeroDay", secretCode: "S0-ZD9" })).toThrow(/no ownable card/);
    const ok = s.grantCopy({ ownerId: o, cardId: illus.cardId, origin: "pack", finish: "secret", secretCode: illus.code });
    s.grantCopy({ ownerId: o, cardId: zd.code, origin: "pack", finish: "zeroDay", secretCode: zd.code });
    // Raw SQL meets the same rules in the schema.
    const raw = (id: string, card: string, finish: string, code: string | null) =>
      s.unsafeExec(
        `INSERT INTO card_copies (copy_id, owner_id, card_id, finish, series_kind, origin, account_bound, acquired_at, secret_code)
         VALUES ('${id}', '${o}', '${card}', '${finish}', 'set', 'pack', 0, 'x', ${code === null ? "NULL" : `'${code}'`})`,
      );
    expect(() => raw("r1", illus.cardId, "secret", null)).toThrow(/CHECK/);
    expect(() => raw("r2", illus.cardId, "standard", illus.code)).toThrow(/CHECK/);
    expect(() => raw("r3", illus.cardId, "zeroDay", zd.code)).toThrow(/CHECK/);
    expect(() => raw("r4", illus.cardId, "shiny", null)).toThrow(/CHECK/);
    expect(() => s.unsafeExec(`UPDATE card_copies SET secret_code = '${other.code}' WHERE copy_id = '${ok.copyId}'`)).toThrow(/never change/);
    expect(() => s.unsafeExec(`UPDATE card_copies SET card_id = '${other.cardId}' WHERE copy_id = '${ok.copyId}'`)).toThrow(/never change/);
  });

  it("a 10-pack open counts the new finishes and names the secret packs for a full reveal", () => {
    const s = store();
    const o = ownerWithPacks(s, 10);
    const secretSeed = seedWhere((r) => r.pulls.some((p) => p.finish === "secret"));
    const glitchSeed = seedWhere((r) => r.pulls.some((p) => p.finish === "glitch"));
    const seeds = [secretSeed, glitchSeed, 1, 2, 3, 4, 5, 6, 7, 8];
    const bulk = s.openPacks(o, 10, { seeds });
    expect(bulk.summary.byFinish.secret).toBeGreaterThanOrEqual(1);
    expect(bulk.summary.byFinish.glitch).toBeGreaterThanOrEqual(1);
    expect(bulk.summary.fullReveals).toContain(bulk.packs[0]!.packId);
  });
});

describe("crafting secret cards (owner 2026-10-18, answer 5A)", () => {
  /** An owner with at least `points` pack points, from opening packs. */
  function ownerWithPoints(s: EconomyStore, points: number): string {
    const packs = Math.ceil(points / PACK_POINTS_PER_PACK / 10) * 10;
    const o = ownerWithPacks(s, packs);
    for (let i = 0; i < packs / 10; i++) s.openPacks(o, 10, { seeds: Array.from({ length: 10 }, (_, k) => 900_000 + i * 10 + k) });
    return o;
  }

  it("crafts a secret illustration for 750 pack points: a bound crafted copy, once per secret card", () => {
    const s = store();
    const o = ownerWithPoints(s, 750);
    const held = new Set(s.collection(o).map((c) => c.secretCode));
    const target = S0.secrets.find((x) => x.kind === "illustration" && !held.has(x.code))!;
    const before = s.balance(o, "packPoints");
    const copy = s.craftSecret(o, target.code);
    expect(SECRET_CRAFT_PACK_POINTS).toEqual({ illustration: 750, zeroDay: 3000 });
    expect(copy).toMatchObject({ cardId: target.cardId, finish: "secret", secretCode: target.code, origin: "crafted", accountBound: true });
    expect(s.balance(o, "packPoints")).toBe(before - 750);
    expect(s.ledger(o).filter((e) => e.reason === "craftSecret").map((e) => [e.delta, e.ref])).toEqual([[-750, copy.copyId]]);
    expect(() => s.craftSecret(o, target.code)).toThrow(/already hold/);
    expect(s.binder(o, "S0").secrets.entries.find((e) => e.secretCode === target.code)!.owned).toBe(1);
  });

  it("refuses without the points, an unknown code, and a Zero-Day card through craftCard", () => {
    const s = store();
    const o = ownerWithPacks(s, 0);
    const illus = S0.secrets.find((x) => x.kind === "illustration")!;
    const zd = S0.secrets.find((x) => x.kind === "zeroDay")!;
    expect(() => s.craftSecret(o, illus.code)).toThrow(/costs 750 pack points; you have 0/);
    expect(() => s.craftSecret(o, "S0-SR99")).toThrow(/no secret card/);
    expect(() => s.craftSecret(o, zd.code)).toThrow(/costs 3000 pack points; you have 0/);
    expect(() => s.craftCard(o, zd.code)).toThrow(/craftSecret/);
    expect(s.ledger(o).filter((e) => e.reason === "craftSecret")).toEqual([]);
  });

  it("Zero-Day crafting is open (live since session 42): 3,000 pack points, a bound crafted copy, once per card, and it plays", () => {
    const s = store();
    const o = ownerWithPoints(s, 3000);
    const held = new Set(s.collection(o).map((c) => c.secretCode));
    const zd = S0.secrets.find((x) => x.kind === "zeroDay" && !held.has(x.code))!;
    expect(zd.name).toBe(getCard(zd.code)!.name);
    const before = s.balance(o, "packPoints");
    const copy = s.craftSecret(o, zd.code);
    expect(copy).toMatchObject({ cardId: zd.code, finish: "zeroDay", secretCode: zd.code, origin: "crafted", accountBound: true });
    expect(s.balance(o, "packPoints")).toBe(before - 3000);
    expect(s.ledger(o).filter((e) => e.reason === "craftSecret").map((e) => [e.delta, e.ref])).toEqual([[-3000, copy.copyId]]);
    expect(() => s.craftSecret(o, zd.code)).toThrow(/already hold/);
    expect(s.binder(o, "S0").secrets.entries.find((e) => e.secretCode === zd.code)!.owned).toBe(1);
    expect(s.cardHoldings(o, zd.code)).toMatchObject({ owned: 1, salvageable: 0 });
    // The crafted copy goes in a deck like a pulled one.
    const starter = s.grantStarterCollection(o, "Cortex").copies;
    const card = getCard(zd.code)!;
    const out = card.type === "Command" ? starter.findIndex((c) => getCard(c.cardId)!.type === "Command") : 0;
    const deck = s.saveDeck(o, "crafted zero-day", [...starter.filter((_, i) => i !== out).map((c) => c.copyId), copy.copyId]);
    expect(s.loadDeck(deck.deckId).spec.cards.some((c) => c.id === zd.code)).toBe(true);
  }, 60_000);
});

describe("the binder and the set checklist", () => {
  it("every entry in its place: 124 base cards, 19 secret cards, 16 Glitch, 28 Gold (the booster cards), 15 Prototype runs", () => {
    const s = store();
    const o = ownerWithPacks(s, 0);
    const empty = s.binder(o, "S0");
    expect([empty.base.total, empty.secrets.total, empty.glitch.total, empty.gold.total, empty.prototypes.length]).toEqual([124, 19, 16, 28, 15]);
    expect([empty.base.held, empty.secrets.held, empty.glitch.held, empty.gold.held]).toEqual([0, 0, 0, 0]);
    expect(empty.base.entries.map((e) => e.number)).toEqual(S0.cards.map((c) => c.collectorNumber));
    expect(empty.secrets.entries.map((e) => e.number)).toEqual(S0.secrets.map((x) => x.collectorNumber));
    expect(empty.secrets.entries.slice(-3).map((e) => e.kind)).toEqual(["zeroDay", "zeroDay", "zeroDay"]);
    expect(empty.gold.entries.map((e) => e.number)).toEqual(S0.cards.filter((c) => isBoosterCard(c.cardId)).map((c) => c.goldNumber));
    expect(empty.gold.entries.map((e) => e.number).slice(0, 1).concat(empty.gold.entries.map((e) => e.number).slice(-1))).toEqual(["125/124", "152/124"]);
    const glitchNumbers = empty.glitch.entries.map((e) => e.number);
    expect(glitchNumbers).toEqual([...glitchNumbers].sort());
    expect(new Set(empty.glitch.entries.map((e) => e.cardId))).toEqual(new Set(S0_GLITCH_CARDS));

    // An illustration fills its secret entry and its card's base entry; a
    // Glitch copy its Glitch entry and its base entry; a Gold copy its Gold
    // entry and its base entry.
    const illus = S0.secrets.find((x) => x.kind === "illustration")!;
    const glitchId = S0_GLITCH_CARDS.find((id) => id !== illus.cardId)!;
    const goldId = S0.packCards.find((c) => c.cardId !== illus.cardId && c.cardId !== glitchId)!.cardId;
    s.grantCopy({ ownerId: o, cardId: illus.cardId, origin: "pack", finish: "secret", secretCode: illus.code });
    s.grantCopy({ ownerId: o, cardId: glitchId, origin: "pack", finish: "glitch" });
    s.grantCopy({ ownerId: o, cardId: goldId, origin: "pack", finish: "gold" });
    const b = s.binder(o, "S0");
    expect([b.base.held, b.secrets.held, b.glitch.held, b.gold.held]).toEqual([3, 1, 1, 1]);
    expect(b.secrets.entries.find((e) => e.secretCode === illus.code)).toMatchObject({ kind: "illustration", owned: 1, name: illus.name });
    expect(b.glitch.entries.find((e) => e.cardId === glitchId)!.owned).toBe(1);
    expect(b.gold.entries.find((e) => e.cardId === goldId)!.owned).toBe(1);
    expect(b.prototypes.every((r) => r.found === 0 && r.serialsHeld.length === 0)).toBe(true);
    expect(() => s.binder(o, "S9")).toThrow(/no card set/);
  });
});

describe("starter cards are Standard only (owner 2026-11-14; session 97)", () => {
  it("the store refuses every pack version of a starter card, and keeps Standard, crafting and a prize's tournament finish", () => {
    const s = store();
    const o = ownerWithPacks(s, 0);
    const starterCard = S0.cards.find((c) => !isBoosterCard(c.cardId) && c.rarity === "Common")!;
    const boosterUnit = S0_GLITCH_CARDS[0]!;
    for (const finish of ["foil", "fullArt", "altArt", "gold"] as const) {
      expect(() => s.grantCopy({ ownerId: o, cardId: starterCard.cardId, origin: "pack", finish }), finish).toThrow(/is a starter card; starter cards are Standard only/);
      expect(s.grantCopy({ ownerId: o, cardId: boosterUnit, origin: "pack", finish }).finish).toBe(finish);
    }
    expect(() => s.grantCopy({ ownerId: o, cardId: starterCard.cardId, origin: "pack", finish: "glitch" })).toThrow(/no Glitch version/);
    expect(() =>
      s.grantCopy({ ownerId: o, cardId: starterCard.cardId, origin: "pack", finish: "prototype", seriesKind: "prototype", seriesCode: "S0-P01", serial: 1, runSize: 1 }),
    ).toThrow(/Standard only/);
    // A starter card's illustration doesn't exist any more: no secret card names one.
    expect(S0.secrets.some((x) => x.kind === "illustration" && !isBoosterCard(x.cardId))).toBe(false);
    // Standard copies, crafted copies and prize copies are as they were.
    expect(s.grantCopy({ ownerId: o, cardId: starterCard.cardId, origin: "pack" }).finish).toBe("standard");
    expect(s.grantCopy({ ownerId: o, cardId: starterCard.cardId, origin: "prize", finish: "tournament", seriesKind: "tournament", seriesCode: "S0F", serial: 1, runSize: 10 }).finish).toBe("tournament");
    // The card viewer offers to craft a starter card (Standard) as before.
    expect(s.cardHoldings(o, starterCard.cardId).craft).not.toBeNull();
  });
});
