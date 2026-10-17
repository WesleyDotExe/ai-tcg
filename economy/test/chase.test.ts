// Chase cards (owner 2026-10-16 "more collectable chase cards", items 1-4;
// session 38): the proposed secret-card list, the Glitch tier and
// S0-odds-2. A proposal, not live: the store still opens S0-odds-1 packs.

import { describe, expect, it } from "vitest";
import { getCard } from "@ai-tcg/engine";
import {
  EconomyStore,
  HIT_FINISHES,
  PACK_ODDS,
  PACK_ODDS_V2,
  S0_GLITCH_CARDS,
  baseHitPercent,
  cardSet,
  nextPityV2,
  rollPackV2,
  seasonZeroChase,
  type ChaseRoll,
  type PityState,
} from "../src/index.js";

const S0 = cardSet("S0");
const CHASE = seasonZeroChase(S0);
const NO_PITY: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
const RUNS = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
const roll = (seed: number, pity = NO_PITY): ChaseRoll => rollPackV2(seed, S0, CHASE, pity, RUNS);
const num = (collector: string) => Number(collector.split("/")[0]);

describe("the secret cards (proposal)", () => {
  it("33 illustrations and 3 Zero-Day slots, numbered above every Gold number, each its own entry", () => {
    const illus = CHASE.secrets.filter((s) => s.kind === "illustration");
    const zd = CHASE.secrets.filter((s) => s.kind === "zeroDay");
    expect(illus).toHaveLength(33);
    expect(zd).toHaveLength(3);
    const numbers = CHASE.secrets.map((s) => num(s.collectorNumber));
    const highestGold = Math.max(...S0.cards.map((c) => num(c.goldNumber)));
    expect(numbers[0]).toBe(highestGold + 1);
    expect(numbers).toEqual(numbers.map((_, i) => highestGold + 1 + i)); // contiguous, unique
    expect(CHASE.secrets.every((s) => s.collectorNumber.endsWith(`/${String(S0.cards.length).padStart(3, "0")}`))).toBe(true);
    expect(new Set(CHASE.secrets.map((s) => s.code)).size).toBe(36);
    // Zero-Day sits at the very top, animated; illustrations name their card.
    expect(zd.map((s) => s.code)).toEqual(["S0-ZD1", "S0-ZD2", "S0-ZD3"]);
    expect(zd.every((s) => s.animated && s.cardId === undefined)).toBe(true);
    for (const s of illus) {
      expect(s.animated).toBe(false);
      expect(getCard(s.cardId!)!.name).toBe(s.name);
      expect(s.art).toBe(`placeholder:secret/${s.code}`);
    }
    // Every pool has some.
    const pools = new Set(illus.map((s) => getCard(s.cardId!)!.faction));
    expect([...pools].sort()).toEqual(["Aegis", "Cortex", "Neutral", "Null", "Swarm"]);
  });
});

describe("the Glitch tier (proposal)", () => {
  it("20 listed Units, four per pool, none twice", () => {
    expect(S0_GLITCH_CARDS).toHaveLength(20);
    expect(new Set(S0_GLITCH_CARDS).size).toBe(20);
    const byPool: Record<string, number> = {};
    for (const id of S0_GLITCH_CARDS) {
      expect(getCard(id)!.type, id).toBe("Unit");
      byPool[getCard(id)!.faction] = (byPool[getCard(id)!.faction] ?? 0) + 1;
    }
    expect(Object.values(byPool)).toEqual([4, 4, 4, 4, 4]);
  });
});

describe("rollPackV2 under S0-odds-2", () => {
  it("is deterministic and keeps the pack's shape", () => {
    expect(roll(77)).toEqual(roll(77));
    for (let seed = 0; seed < 2000; seed++) {
      const r = roll(seed);
      expect(r.pulls.slice(0, 5).map((p) => p.slot)).toEqual(["Common", "Common", "Uncommon", "Rare", "shine"]);
      expect(r.pulls.length === 5 || (r.pulls.length === 6 && r.pulls[5]!.slot === "bonus")).toBe(true);
    }
  });

  it("lands each special version only on the cards it may go on", () => {
    const glitch = new Set(S0_GLITCH_CARDS);
    const secretByCode = new Map(CHASE.secrets.map((s) => [s.code, s]));
    const seen = new Set<string>();
    for (let seed = 0; seed < 60_000; seed++) {
      const r = roll(seed);
      for (const p of r.pulls) {
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
        if (p.finish === "gold") expect(p.collectorNumber).toBe(S0.cards.find((c) => c.cardId === p.cardId)!.goldNumber);
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
      expect(HIT_FINISHES).toContain(r.pulls[4]!.finish);
      expect(r.pulls[3]!.rarity).toBe("Mythic");
      expect(nextPityV2({ packsSinceFullArt: 10, packsSinceMythic: 40 }, r.pulls)).toEqual({ packsSinceFullArt: 0, packsSinceMythic: 0 });
    }
    // A dry pack counts up.
    expect(nextPityV2({ packsSinceFullArt: 3, packsSinceMythic: 7 }, [{ finish: "foil", rarity: "Common" }])).toEqual({ packsSinceFullArt: 4, packsSinceMythic: 8 });
  });

  it("measures near the table: hits about 18.4% before pity, Zero-Day about 1 in 500, Jackpot about 1 in 2,000", () => {
    const N = 200_000;
    let hits = 0;
    let zd = 0;
    let jackpots = 0;
    for (let seed = 0; seed < N; seed++) {
      const r = roll(1_000_000 + seed);
      if (r.pulls.some((p) => HIT_FINISHES.includes(p.finish))) hits++;
      if (r.pulls.some((p) => p.finish === "zeroDay")) zd++;
      if (r.jackpot) jackpots++;
    }
    expect(baseHitPercent()).toBeCloseTo(18.4, 5);
    expect(hits / N).toBeGreaterThan(0.178);
    expect(hits / N).toBeLessThan(0.192);
    expect(N / zd).toBeGreaterThan(400);
    expect(N / zd).toBeLessThan(620);
    expect(N / jackpots).toBeGreaterThan(1500);
    expect(N / jackpots).toBeLessThan(2700);
  });
});

describe("not live", () => {
  it("the store still opens S0-odds-1 packs", () => {
    const s = EconomyStore.open(":memory:", { now: () => new Date("2026-10-17T10:00:00.000Z") });
    const o = s.createOwner({ name: "o" }).ownerId;
    s.grantPack(o, "S0", "weeklyChallenge");
    const opened = s.openPack(o, undefined, { seed: 5 });
    expect(PACK_ODDS.version).toBe("S0-odds-1");
    expect(s.packOpening(opened.packId).oddsVersion).toBe("S0-odds-1");
    expect(PACK_ODDS_V2.version).toBe("S0-odds-2");
  });
});
