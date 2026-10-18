// Pack contents and opening (session 36; ECONOMY.md "Packs", roadmap item
// 5): the Season 0 set, the versioned odds table, pity per owner, the
// Prototype bonus, NEW and "x N owned", 10-pack bulk opening, pack points,
// crafting, and the schema rules behind them.

import { describe, expect, it } from "vitest";
import { CARD_REGISTRY, COPY_LIMITS, getCard } from "@ai-tcg/engine";
import {
  BULK_OPEN_COUNT,
  CRAFT_PACK_POINTS,
  EconomyStore,
  FULL_ART_OR_BETTER,
  LIVE_PACK_ODDS,
  PACK_ODDS,
  PACK_POINTS_PER_PACK,
  cardSet,
  rollPack,
  type PityState,
} from "../src/index.js";

const T0 = Date.parse("2026-10-16T10:00:00.000Z");
const store = () => EconomyStore.open(":memory:", { now: () => new Date(T0) });
const S0 = cardSet("S0");
const NO_PITY: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
const ALL_RUNS = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
const NO_RUNS = new Map(S0.prototypes.map((r) => [r.code, 0]));
/** A pack under S0-odds-1, the table session 36 shipped (its openings must
 * keep reproducing), and under the live table, the one openPack rolls. */
const rollV1 = (seed: number, pity: PityState, runs: ReadonlyMap<string, number>) => rollPack(seed, S0, pity, runs, PACK_ODDS);
const rollLive = (seed: number, pity: PityState, runs: ReadonlyMap<string, number>) => rollPack(seed, S0, pity, runs, LIVE_PACK_ODDS);

/** An owner with `n` free packs. */
function ownerWithPacks(s: EconomyStore, n: number) {
  const o = s.createOwner({ name: `owner-${Math.random()}` });
  for (let i = 0; i < n; i++) s.grantPack(o.ownerId, "S0", "weeklyChallenge");
  return o.ownerId;
}

/** The first seed from `start` whose pack (with this pity and these runs) passes `want`. */
function seedWhere(pity: PityState, want: (roll: ReturnType<typeof rollPack>) => boolean, start = 0, runs = ALL_RUNS): number {
  for (let seed = start; seed < start + 1_000_000; seed++) if (want(rollLive(seed, pity, runs))) return seed;
  throw new Error("no seed found");
}
function seedWhereV1(pity: PityState, want: (roll: ReturnType<typeof rollPack>) => boolean): number {
  for (let seed = 0; seed < 1_000_000; seed++) if (want(rollV1(seed, pity, ALL_RUNS))) return seed;
  throw new Error("no seed found");
}

describe("the Season 0 set", () => {
  it("numbers every ownable card once, with Gold numbers above the set total", () => {
    // Every registry card but the Zero-Day cards, which are secret cards.
    expect(S0.cards.length).toBe([...CARD_REGISTRY.values()].filter((c) => !c.topTier).length);
    expect(S0.cards.length).toBe(96);
    const total = String(S0.cards.length).padStart(3, "0");
    expect(new Set(S0.cards.map((c) => c.cardId)).size).toBe(S0.cards.length);
    expect(S0.cards[0]!.collectorNumber).toBe(`001/${total}`);
    expect(S0.cards.at(-1)!.collectorNumber).toBe(`${total}/${total}`);
    for (const c of S0.cards) {
      expect(Number(c.goldNumber.split("/")[0])).toBeGreaterThan(S0.cards.length);
      expect(c.collectorNumber).not.toContain(c.cardId);
    }
  });

  it("has the owner's 15-run Prototype pyramid: 1,516 copies, every run a set card", () => {
    expect(S0.prototypes).toHaveLength(15);
    expect(S0.prototypes.map((r) => r.runSize).sort((a, b) => b - a)).toEqual([250, 250, 250, 250, 100, 100, 100, 50, 50, 50, 25, 25, 10, 5, 1]);
    expect(S0.prototypes.reduce((t, r) => t + r.runSize, 0)).toBe(1516);
    expect(new Set(S0.prototypes.map((r) => r.cardId)).size).toBe(15);
    for (const r of S0.prototypes) expect(S0.cards.some((c) => c.cardId === r.cardId), r.cardId).toBe(true);
    // The 1/1 is a Mythic.
    expect(getCard(S0.prototypes.find((r) => r.runSize === 1)!.cardId)!.rarity).toBe("Mythic");
  });
});

describe("rollPack under S0-odds-1 (session 36's table, kept so its openings reproduce)", () => {
  it("is reproducible from its seed, and gives 2 Commons, 1 Uncommon, the Rare slot and the shine slot", () => {
    for (let seed = 0; seed < 500; seed++) {
      const roll = rollV1(seed, NO_PITY, ALL_RUNS);
      expect(rollV1(seed, NO_PITY, ALL_RUNS)).toEqual(roll);
      const main = roll.pulls.filter((p) => p.slot !== "bonus");
      expect(main.map((p) => p.slot)).toEqual(["Common", "Common", "Uncommon", "Rare", "shine"]);
      expect(main.slice(0, 2).every((p) => p.rarity === "Common")).toBe(true);
      expect(main[2]!.rarity).toBe("Uncommon");
      expect(["Rare", "Mythic"]).toContain(main[3]!.rarity);
      // Only the shine slot rolls a finish, outside a Jackpot pack.
      if (!roll.jackpot) for (const p of main.slice(0, 4)) expect(p.finish).toBe("standard");
      for (const p of roll.pulls) if (p.finish === "altArt") expect(["Rare", "Mythic"]).toContain(p.rarity);
    }
  });

  it("gives a Gold copy its number above the set total", () => {
    const seed = seedWhereV1(NO_PITY, (r) => r.pulls.some((p) => p.finish === "gold"));
    const gold = rollV1(seed, NO_PITY, ALL_RUNS).pulls.find((p) => p.finish === "gold")!;
    expect(gold.collectorNumber).toBe(S0.cards.find((c) => c.cardId === gold.cardId)!.goldNumber);
  });

  it("over 100,000 packs, hits the published rates (no rate raised to test it)", () => {
    const n = 100_000;
    let mythicRare = 0;
    const shine: Record<string, number> = {};
    let jackpots = 0;
    let bonus = 0;
    for (let seed = 0; seed < n; seed++) {
      const r = rollV1(seed, NO_PITY, ALL_RUNS);
      if (r.pulls[3]!.rarity === "Mythic") mythicRare++;
      const f = r.pulls[4]!.finish;
      shine[f] = (shine[f] ?? 0) + 1;
      if (r.jackpot) jackpots++;
      if (r.pulls.length === 6) bonus++;
    }
    const near = (got: number, want: number, tol: number) => expect(Math.abs(got / n - want), `${got / n} vs ${want}`).toBeLessThan(tol);
    near(mythicRare, 1 / 8, 0.005);
    near(shine.foil ?? 0, 0.3, 0.006);
    near(shine.fullArt ?? 0, 0.1, 0.004);
    near(shine.altArt ?? 0, 1 / 30, 0.003);
    near(shine.gold ?? 0, 1 / 150, 0.0012);
    near(shine.standard ?? 0, 0.56, 0.006);
    near(jackpots, 1 / 2000, 0.0003);
    near(bonus, 1 / 1000, 0.0004);
  });

  it("a Jackpot pack is Foil or better on every card", () => {
    const seed = seedWhereV1(NO_PITY, (r) => r.jackpot);
    for (const p of rollV1(seed, NO_PITY, ALL_RUNS).pulls) expect(p.finish).not.toBe("standard");
  });

  it("pity, when due, makes the shine slot Full Art or better and the Rare slot a Mythic", () => {
    const due: PityState = { packsSinceFullArt: PACK_ODDS.pity.fullArtAfter, packsSinceMythic: PACK_ODDS.pity.mythicAfter };
    for (let seed = 0; seed < 2000; seed++) {
      const r = rollV1(seed, due, ALL_RUNS);
      expect(r.pity).toEqual({ fullArt: true, mythic: true });
      expect(FULL_ART_OR_BETTER).toContain(r.pulls[4]!.finish);
      expect(r.pulls[3]!.rarity).toBe("Mythic");
    }
    // One pack short of either timer: nothing forced.
    expect(rollV1(1, { packsSinceFullArt: 9, packsSinceMythic: 39 }, ALL_RUNS).pity).toEqual({ fullArt: false, mythic: false });
  });

  it("a Prototype is a bonus 6th card, from a run with copies left; with every run used up it is a Gold", () => {
    const seed = seedWhereV1(NO_PITY, (r) => r.pulls.length === 6);
    const r = rollV1(seed, NO_PITY, ALL_RUNS);
    expect(r.pulls[5]).toMatchObject({ slot: "bonus", finish: "prototype" });
    expect(r.pulls.slice(0, 5)).toEqual(rollV1(seed, NO_PITY, NO_RUNS).pulls.slice(0, 5));
    // Only one run open: the Prototype is from it.
    const onlyOne = new Map([...NO_RUNS, ["S0-P07", 3]]);
    expect(rollV1(seed, NO_PITY, onlyOne).pulls[5]!.prototypeRun).toBe("S0-P07");
    // None open: a Gold instead, still the 6th card.
    const fallback = rollV1(seed, NO_PITY, NO_RUNS);
    expect(fallback.prototypeFallbackGold).toBe(true);
    expect(fallback.pulls[5]).toMatchObject({ slot: "bonus", finish: "gold" });
  });
});

describe("opening packs (the store)", () => {
  it("opens a pack once: 5 copies into the collection, 5 pack points, the opening logged with its seed and odds version", () => {
    const s = store();
    const o = ownerWithPacks(s, 1);
    const [pack] = s.unopenedPacks(o);
    expect(() => s.packOpening(pack!.packId)).toThrow(/hasn't been opened/); // no seed before opening
    const opened = s.openPack(o, undefined, { seed: 42 });
    expect(opened.packId).toBe(pack!.packId);
    expect(opened.oddsVersion).toBe("S0-odds-2");
    expect(opened.cards.map((c) => c.cardId)).toEqual(rollLive(42, NO_PITY, ALL_RUNS).pulls.map((p) => p.cardId));
    expect(s.collection(o)).toHaveLength(opened.cards.length);
    expect(s.balance(o, "packPoints")).toBe(PACK_POINTS_PER_PACK);
    expect(s.unopenedPacks(o)).toHaveLength(0);
    const log = s.packOpening(pack!.packId);
    expect(log).toMatchObject({ seed: 42, oddsVersion: "S0-odds-2", ownerId: o });
    expect(log.copies.map((c) => c.copyId)).toEqual(opened.cards.map((c) => c.copyId));
    for (const c of log.copies) expect(c).toMatchObject({ origin: "pack", originRef: `pack:${pack!.packId}`, accountBound: false, seriesCode: "S0" });
    expect(() => s.openPack(o, pack!.packId)).toThrow(/no unopened pack/);
    expect(() => s.openPack(o)).toThrow(/no unopened pack/);
  });

  it("marks NEW and counts copies owned after the pack", () => {
    const s = store();
    const o = ownerWithPacks(s, 1);
    const seed = 42;
    const first = rollLive(seed, NO_PITY, ALL_RUNS).pulls;
    // The owner already holds 2 copies of the pack's first card.
    s.grantCopy({ ownerId: o, cardId: first[0]!.cardId, origin: "pack" });
    s.grantCopy({ ownerId: o, cardId: first[0]!.cardId, origin: "pack" });
    const opened = s.openPack(o, undefined, { seed });
    for (const c of opened.cards) {
      const before = c.cardId === first[0]!.cardId ? 2 : 0;
      const inPack = opened.cards.filter((x) => x.cardId === c.cardId).length;
      expect(c.isNew).toBe(before === 0);
      expect(c.ownedAfter).toBe(before + inPack);
    }
  });

  it("pity per owner: 10 packs with no Full Art or better, then the 11th has one", () => {
    const s = store();
    const o = ownerWithPacks(s, 11);
    for (let i = 0; i < 10; i++) {
      const pity = s.pityStatus(o);
      expect(pity.packsSinceFullArt).toBe(i);
      const seed = seedWhere(pity, (r) => !r.pulls.some((p) => FULL_ART_OR_BETTER.includes(p.finish)), i * 1000);
      s.openPack(o, undefined, { seed });
    }
    expect(s.pityStatus(o).next.fullArt).toBe(true);
    const eleventh = s.openPack(o, undefined, { seed: seedWhere(NO_PITY, (r) => r.pulls[4]!.finish === "standard") });
    expect(eleventh.pity.fullArt).toBe(true);
    expect(FULL_ART_OR_BETTER).toContain(eleventh.cards[4]!.finish);
    expect(s.pityStatus(o).packsSinceFullArt).toBe(0);
    // Another owner's history counts for nothing.
    expect(s.pityStatus(ownerWithPacks(s, 0)).packsSinceFullArt).toBe(0);
  });

  it("pity per owner: 40 packs with no Mythic, then the 41st has one in the Rare slot", () => {
    const s = store();
    const o = ownerWithPacks(s, 41);
    for (let i = 0; i < 40; i++) {
      const seed = seedWhere(s.pityStatus(o), (r) => !r.pulls.some((p) => p.rarity === "Mythic"), i * 1000);
      s.openPack(o, undefined, { seed });
    }
    expect(s.pityStatus(o)).toMatchObject({ packsSinceMythic: 40, next: { mythic: true } });
    const pack41 = s.openPack(o, undefined, { seed: seedWhere(s.pityStatus(o), () => true) });
    expect(pack41.pity.mythic).toBe(true);
    expect(pack41.cards[3]!.rarity).toBe("Mythic");
    expect(s.pityStatus(o).packsSinceMythic).toBe(0);
  });

  it("a Prototype gets the next serial of its run and is never salvageable", () => {
    const s = store();
    const o = ownerWithPacks(s, 2);
    const seed = seedWhere(NO_PITY, (r) => r.pulls.length === 6 && r.pulls[5]!.finish === "prototype");
    const run = rollLive(seed, NO_PITY, ALL_RUNS).pulls[5]!.prototypeRun!;
    const a = s.openPack(o, undefined, { seed });
    expect(a.cards[5]!.prototype).toMatchObject({ runCode: run, serial: 1 });
    expect(a.fullReveal).toBe(true);
    // The same seed again (a run that still has copies) gives serial 2, unless the run was the 1/1.
    const runSize = S0.prototypes.find((r) => r.code === run)!.runSize;
    const b = s.openPack(o, undefined, { seed });
    if (runSize > 1) expect(b.cards[5]!.prototype).toMatchObject({ runCode: run, serial: 2 });
    else expect(b.cards[5]!.prototype?.runCode).not.toBe(run);
    expect(s.prototypesFound(run)).toBe(runSize > 1 ? 2 : 1);
    expect(s.cardHoldings(o, a.cards[5]!.cardId).salvageable).toBeLessThan(s.cardHoldings(o, a.cards[5]!.cardId).owned);
  });

  it("bulk opens exactly 1 or 10, oldest first, with a summary and the full-reveal packs named", () => {
    const s = store();
    const o = ownerWithPacks(s, 12);
    expect(() => s.openPacks(o, 5)).toThrow(/1 pack or 10/);
    const seeds = Array.from({ length: BULK_OPEN_COUNT }, (_, i) => 100 + i);
    const oldest = s.unopenedPacks(o).slice(0, 10).map((p) => p.packId);
    const bulk = s.openPacks(o, BULK_OPEN_COUNT, { seeds });
    expect(bulk.packs.map((p) => p.packId)).toEqual(oldest);
    expect(bulk.packs.map((p) => p.seed)).toEqual(seeds);
    expect(bulk.summary.cards).toBe(bulk.packs.reduce((t, p) => t + p.cards.length, 0));
    expect(bulk.summary.packPoints).toBe(10 * PACK_POINTS_PER_PACK);
    expect(Object.values(bulk.summary.byRarity).reduce((a, b) => a + b, 0)).toBe(bulk.summary.cards);
    expect(bulk.summary.newCards).toBe(new Set(bulk.packs.flatMap((p) => p.cards).map((c) => c.cardId)).size);
    expect(bulk.summary.fullReveals).toEqual(bulk.packs.filter((p) => p.fullReveal).map((p) => p.packId));
    // Each pack in a bulk open is its own logged opening.
    for (const p of bulk.packs) expect(s.packOpening(p.packId).seed).toBe(p.seed);
    // 2 left: a second bulk open is refused, and nothing opens.
    expect(() => s.openPacks(o, 10)).toThrow(/only 2 unopened/);
    expect(s.unopenedPacks(o)).toHaveLength(2);
    expect(s.openPacks(o, 1).packs).toHaveLength(1);
  });

  it("buying or granting a pack of a set that doesn't exist is refused", () => {
    const s = store();
    const o = s.createOwner({ name: "o" });
    expect(() => s.grantPack(o.ownerId, "S9", "weeklyChallenge")).toThrow(/no card set "S9"/);
  });

  it("the schema refuses a second opening, a raw opened_at, a forged pack copy and a 7th card", () => {
    const s = store();
    const o = ownerWithPacks(s, 2);
    const other = ownerWithPacks(s, 0);
    const [p1, p2] = s.unopenedPacks(o);
    s.openPack(o, p1!.packId, { seed: 3 });
    const at = new Date(T0).toISOString();
    expect(() =>
      s.unsafeExec(`INSERT INTO pack_openings (pack_id, owner_id, odds_version, seed, jackpot, pity_json, opened_at) VALUES ('${p1!.packId}', '${o}', 'x', 1, 0, '{}', '${at}')`),
    ).toThrow(/opens once|UNIQUE/);
    expect(() => s.unsafeExec(`INSERT INTO pack_openings (pack_id, owner_id, odds_version, seed, jackpot, pity_json, opened_at) VALUES ('${p2!.packId}', '${other}', 'x', 1, 0, '{}', '${at}')`)).toThrow(/opens once/);
    expect(() => s.unsafeExec(`UPDATE packs SET opened_at = '${at}' WHERE pack_id = '${p2!.packId}'`)).toThrow(/logged opening/);
    expect(() => s.unsafeExec(`UPDATE packs SET opened_at = NULL WHERE pack_id = '${p1!.packId}'`)).toThrow(/logged opening/);
    expect(() => s.unsafeExec(`UPDATE pack_openings SET seed = 4`)).toThrow(/never changed/);
    expect(() => s.unsafeExec(`DELETE FROM pack_openings`)).toThrow(/never deleted/);
    const card = S0.cards[0]!.cardId;
    expect(() => s.grantCopy({ ownerId: o, cardId: card, origin: "pack", originRef: `pack:${p2!.packId}` })).toThrow(/opened pack/);
    expect(() => s.grantCopy({ ownerId: other, cardId: card, origin: "pack", originRef: `pack:${p1!.packId}` })).toThrow(/opened pack/);
    expect(() => s.grantCopy({ ownerId: o, cardId: card, origin: "promo", stamp: "X", seriesKind: "promo", originRef: `pack:${p1!.packId}` })).toThrow(/opened pack/);
    s.grantCopy({ ownerId: o, cardId: card, origin: "pack", originRef: `pack:${p1!.packId}` }); // a 6th fits (the bonus slot)
    expect(() => s.grantCopy({ ownerId: o, cardId: card, origin: "pack", originRef: `pack:${p1!.packId}` })).toThrow(/at most 6/);
  });
});

describe("the starter guarantee (owner 2026-10-19: a hit across the 3 starter packs)", () => {
  const isHit = (r: { pulls: readonly { finish: string }[] }) => r.pulls.some((p) => (FULL_ART_OR_BETTER as readonly string[]).includes(p.finish));
  const plainSeed = (start: number) => seedWhere(NO_PITY, (r) => !isHit(r), start);
  /** A new owner with the starter collection (3 starter packs). */
  function starterOwner(s: EconomyStore) {
    const o = s.createOwner({ name: `owner-${Math.random()}` }).ownerId;
    s.grantStarterCollection(o, "Aegis");
    return o;
  }

  it("the roller: the option makes the shine slot a hit in the table's proportions, and without it a pack rolls as before", () => {
    let forced = 0;
    for (let seed = 1; seed <= 2_000; seed++) {
      const plain = rollLive(seed, NO_PITY, ALL_RUNS);
      expect(rollPack(seed, S0, NO_PITY, ALL_RUNS, LIVE_PACK_ODDS, { starterHit: false })).toEqual(plain);
      const g = rollPack(seed, S0, NO_PITY, ALL_RUNS, LIVE_PACK_ODDS, { starterHit: true });
      expect(FULL_ART_OR_BETTER).toContain(g.pulls[4]!.finish);
      expect(g.starterHit).toBe(true);
      expect(g.pity).toEqual({ fullArt: false, mythic: false });
      // Only the shine slot (and draws after it) can change; the first 4 cards never do.
      expect(g.pulls.slice(0, 4)).toEqual(plain.pulls.slice(0, 4));
      if (!FULL_ART_OR_BETTER.includes(plain.pulls[4]!.finish)) forced++;
      expect(plain.starterHit).toBeUndefined();
    }
    expect(forced).toBeGreaterThan(1_400); // about 82% of shine slots aren't a hit
    // With hit pity already due, pity forces it and the guarantee is not credited.
    const due: PityState = { packsSinceFullArt: LIVE_PACK_ODDS.pity.fullArtAfter, packsSinceMythic: 0 };
    const both = rollPack(7, S0, due, ALL_RUNS, LIVE_PACK_ODDS, { starterHit: true });
    expect(both).toEqual(rollPack(7, S0, due, ALL_RUNS, LIVE_PACK_ODDS));
    expect(both.starterHit).toBeUndefined();
  });

  it("starter packs 1 and 2 with no hit: pack 3's shine slot is a hit, logged, and reproducible from its seed", () => {
    const s = store();
    const o = starterOwner(s);
    const a = s.openPack(o, undefined, { seed: plainSeed(0) });
    const b = s.openPack(o, undefined, { seed: plainSeed(1_000) });
    expect([a.starterHit, b.starterHit]).toEqual([false, false]);
    const seed = seedWhere(s.pityStatus(o), (r) => r.pulls[4]!.finish === "standard" && !isHit(r), 2_000);
    const pity = s.pityStatus(o);
    const c = s.openPack(o, undefined, { seed });
    expect(c.starterHit).toBe(true);
    expect(FULL_ART_OR_BETTER).toContain(c.cards[4]!.finish);
    const again = rollPack(seed, S0, pity, ALL_RUNS, LIVE_PACK_ODDS, { starterHit: true });
    expect(c.cards.map((x) => [x.cardId, x.finish])).toEqual(again.pulls.map((p) => [p.cardId, p.finish]));
    expect(s.pityStatus(o).packsSinceFullArt).toBe(0);
  });

  it("a hit in an earlier starter pack: pack 3 rolls as any pack does", () => {
    const s = store();
    const o = starterOwner(s);
    s.openPack(o, undefined, { seed: seedWhere(NO_PITY, (r) => isHit(r)) });
    s.openPack(o, undefined, { seed: plainSeed(0) });
    const seed = seedWhere(s.pityStatus(o), (r) => !isHit(r), 5_000);
    const c = s.openPack(o, undefined, { seed });
    expect(c.starterHit).toBe(false);
    expect(c.cards.some((x) => FULL_ART_OR_BETTER.includes(x.finish))).toBe(false);
  });

  it("only starter packs count: a hit in another pack doesn't cancel it, and it lands on the last starter pack whatever the order", () => {
    const s = store();
    const o = starterOwner(s);
    const bought = s.grantPack(o, "S0", "weeklyChallenge");
    const starters = s.unopenedPacks(o).filter((p) => p.source === "starter");
    expect(starters).toHaveLength(3);
    // The other pack first, with a hit; then the starters out of order.
    expect(s.openPack(o, bought.packId, { seed: seedWhere(NO_PITY, (r) => isHit(r)) }).starterHit).toBe(false);
    expect(s.openPack(o, starters[2]!.packId, { seed: plainSeed(0) }).starterHit).toBe(false);
    expect(s.openPack(o, starters[0]!.packId, { seed: plainSeed(1_000) }).starterHit).toBe(false);
    const last = s.openPack(o, starters[1]!.packId, { seed: plainSeed(2_000) });
    expect(last.starterHit).toBe(true);
    expect(FULL_ART_OR_BETTER).toContain(last.cards[4]!.finish);
    // A free pack that isn't a starter pack never gets it.
    const other = s.grantPack(o, "S0", "ownerDaily");
    expect(s.openPack(o, other.packId, { seed: plainSeed(3_000) }).starterHit).toBe(false);
  });

  it("in a 10-pack open, the guarantee lands on the third starter pack", () => {
    const s = store();
    const o = starterOwner(s);
    for (let i = 0; i < 7; i++) s.grantPack(o, "S0", "weeklyChallenge");
    const seeds = [plainSeed(0), plainSeed(1_000), plainSeed(2_000), ...Array.from({ length: 7 }, (_, i) => plainSeed(3_000 + i * 1_000))];
    const bulk = s.openPacks(o, 10, { seeds });
    expect(bulk.packs.map((p) => p.starterHit)).toEqual([false, false, true, false, false, false, false, false, false, false]);
  });

  it("every new owner sees a hit: 60 owners, consecutive seeds", () => {
    const s = store();
    for (let i = 0; i < 60; i++) {
      const o = starterOwner(s);
      const packs = [0, 1, 2].map((k) => s.openPack(o, undefined, { seed: 50_000 + i * 3 + k }));
      expect(packs.some((p) => p.cards.some((c) => FULL_ART_OR_BETTER.includes(c.finish)))).toBe(true);
      expect(packs.filter((p) => p.starterHit).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("crafting with pack points", () => {
  const MYTHIC = S0.cards.find((c) => c.rarity === "Mythic")!.cardId;

  it("spends pack points on a bound standard copy, up to the card's playable limit", () => {
    const s = store();
    const o = ownerWithPacks(s, 20);
    const common = S0.cards.find((c) => c.rarity === "Common")!.cardId;
    expect(() => s.craftCard(o, common)).toThrow(/costs 40 pack points; you have 0/);
    s.openPacks(o, 10, { seeds: Array.from({ length: 10 }, (_, i) => i) });
    s.openPacks(o, 10, { seeds: Array.from({ length: 10 }, (_, i) => 10 + i) });
    expect(s.balance(o, "packPoints")).toBe(20 * PACK_POINTS_PER_PACK);
    // A Common and a Mythic the 20 packs didn't give.
    const held = (id: string) => s.collection(o).filter((c) => c.cardId === id).length;
    const freshCommon = S0.cards.find((c) => c.rarity === "Common" && held(c.cardId) === 0)!.cardId;
    const freshMythic = S0.cards.find((c) => c.rarity === "Mythic" && held(c.cardId) === 0)!.cardId;
    const copy = s.craftCard(o, freshCommon);
    expect(copy).toMatchObject({ origin: "crafted", accountBound: true, finish: "standard" });
    s.craftCard(o, freshCommon);
    expect(s.balance(o, "packPoints")).toBe(100 - 2 * CRAFT_PACK_POINTS.Common);
    // 20 left: not enough for a third.
    expect(() => s.craftCard(o, freshCommon)).toThrow(/costs 40 pack points; you have 20/);
    expect(s.ledger(o).filter((e) => e.reason === "craft").map((e) => e.delta)).toEqual([-40, -40]);
    expect(() => s.craftCard(o, freshMythic)).toThrow(/costs 800 pack points/);
    expect(() => s.craftCard(o, "sig-PR-001")).toThrow(/only set cards/);
  });

  it("stops at the playable limit (3 / 3 / 2 / 1), counting every copy held", () => {
    const s = store();
    const o = ownerWithPacks(s, 0);
    s.grantCopy({ ownerId: o, cardId: MYTHIC, origin: "pack" });
    expect(COPY_LIMITS.Mythic).toBe(1);
    expect(() => s.craftCard(o, MYTHIC)).toThrow(/playable limit of 1/);
    const common = S0.cards.find((c) => c.rarity === "Common")!.cardId;
    for (let i = 0; i < 3; i++) s.grantCopy({ ownerId: o, cardId: common, origin: "pack", finish: i === 0 ? "foil" : "standard" });
    expect(() => s.craftCard(o, common)).toThrow(/playable limit of 3/);
  });
});

describe("the signature art pool (owner 2026-10-16)", () => {
  it("each new signature card records a slot of this season's 500-piece pool", () => {
    const s = store();
    const o = s.createOwner({ name: "o" });
    const slots = Array.from({ length: 6 }, (_, i) => {
      const draft = s.startAgentDraft(o.ownerId, { seed: i });
      s.pickDraftAgent(o.ownerId, draft.draftId, 0, { seed: 100 + i });
      const made = s.confirmAgentDraft(o.ownerId, draft.draftId, 0);
      expect(made.signature.art!.pool).toBe("S0");
      expect(made.signature.card.art).toBe(`placeholder:signature-pool/S0/${String(made.signature.art!.slot).padStart(3, "0")}`);
      return made.signature.art!.slot;
    });
    for (const slot of slots) {
      expect(Number.isInteger(slot)).toBe(true);
      expect(slot).toBeGreaterThanOrEqual(1);
      expect(slot).toBeLessThanOrEqual(500);
    }
    expect(() => s.unsafeExec(`UPDATE signature_cards SET art_pool = 'S1'`)).toThrow(/keeps its art/);
    const draft = s.startAgentDraft(o.ownerId, { seed: 99 });
    s.pickDraftAgent(o.ownerId, draft.draftId, 0, { seed: 199 });
    expect(() => s.confirmAgentDraft(o.ownerId, draft.draftId, 0, { artSlot: 501 })).toThrow(/art slot is 1 to 500/);
    expect(s.confirmAgentDraft(o.ownerId, draft.draftId, 0, { artSlot: 500 }).signature.art).toEqual({ pool: "S0", slot: 500 });
  });
});
