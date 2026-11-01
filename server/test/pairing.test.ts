import { describe, expect, it } from "vitest";
import { JITTER, pairingCost, pairRound, REMATCH_PENALTY, seededRandom, type QueueEntry } from "../src/ladder/pairing.js";

const entry = (ownerId: string, rating = 1500, extra: Partial<QueueEntry> = {}): QueueEntry => ({
  ownerId,
  rating: { rating, rd: 100, volatility: 0.06 },
  satOut: 0,
  recentOpponents: [],
  ...extra,
});
const keyOf = (p: { p1: string; p2: string }) => [p.p1, p.p2].sort().join("-");

describe("pairRound", () => {
  it("pairs everyone once, never with itself, and sits one out on an odd queue", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const queue = Array.from({ length: 7 }, (_, i) => entry(`o${i}`, 1300 + 60 * i));
      const r = pairRound(queue, seededRandom(seed));
      expect(r.pairs).toHaveLength(3);
      expect(r.sitOut).toHaveLength(1);
      const seen = [...r.pairs.flatMap((p) => [p.p1, p.p2]), ...r.sitOut];
      expect(new Set(seen).size).toBe(7);
      expect(r.pairs.every((p) => p.p1 !== p.p2)).toBe(true);
    }
  });

  it("an owner that sat out picks first and plays next round", () => {
    const queue = Array.from({ length: 5 }, (_, i) => entry(`o${i}`, 1500 - 100 * i, i === 4 ? { satOut: 1 } : {}));
    for (let seed = 1; seed <= 20; seed++) {
      const r = pairRound(queue, seededRandom(seed));
      expect(r.sitOut).not.toContain("o4");
    }
  });

  it("prefers the closest rating once the gap beats the jitter", () => {
    const queue = [entry("a", 1500), entry("b", 1500 + JITTER / 2), entry("c", 1500 + 4 * JITTER), entry("d", 1500 + 4.5 * JITTER)];
    for (let seed = 1; seed <= 30; seed++) {
      const keys = pairRound(queue, seededRandom(seed)).pairs.map(keyOf).sort();
      expect(keys).toEqual(["a-b", "c-d"]);
    }
  });

  it("avoids an immediate rematch when there is anyone else, but two alone still play", () => {
    const queue = [
      entry("a", 1500, { recentOpponents: ["b"] }),
      entry("b", 1510, { recentOpponents: ["a"] }),
      entry("c", 1520, { recentOpponents: ["d"] }),
      entry("d", 1530, { recentOpponents: ["c"] }),
    ];
    for (let seed = 1; seed <= 30; seed++) {
      const keys = pairRound(queue, seededRandom(seed)).pairs.map(keyOf);
      expect(keys).not.toContain("a-b");
      expect(keys).not.toContain("c-d");
    }
    expect(pairRound([queue[0]!, queue[1]!], seededRandom(1)).pairs.map(keyOf)).toEqual(["a-b"]);
    expect(pairingCost(queue[0]!, queue[1]!)).toBe(10 + REMATCH_PENALTY[0]);
    expect(pairingCost(entry("x", 1500, { recentOpponents: ["q", "y"] }), entry("y", 1500))).toBe(REMATCH_PENALTY[1]);
  });

  it("spreads a pool of equals over many different pairings, and both seats", () => {
    const queue = Array.from({ length: 8 }, (_, i) => entry(`o${i}`));
    const random = seededRandom(7);
    const seen = new Set<string>();
    let p1 = 0;
    for (let round = 0; round < 30; round++) {
      for (const p of pairRound(queue, random).pairs) {
        seen.add(keyOf(p));
        if (p.p1 === "o0") p1++;
        if (p.p2 === "o0") p1--;
      }
    }
    expect(seen.size).toBe(28); // every one of the 8-choose-2 pairings
    expect(Math.abs(p1)).toBeLessThan(15);
  });

  it("is reproducible for the same seed and queue, and refuses a duplicate", () => {
    const queue = Array.from({ length: 6 }, (_, i) => entry(`o${i}`, 1400 + 37 * i));
    expect(pairRound(queue, seededRandom(42))).toEqual(pairRound(queue, seededRandom(42)));
    expect(() => pairRound([entry("a"), entry("a")], seededRandom(1))).toThrow(/twice/);
    expect(pairRound([], seededRandom(1))).toEqual({ pairs: [], sitOut: [] });
    expect(pairRound([entry("solo")], seededRandom(1))).toEqual({ pairs: [], sitOut: ["solo"] });
  });
});
