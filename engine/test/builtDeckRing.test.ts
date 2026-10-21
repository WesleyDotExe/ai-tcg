// The built-deck ring's seating (engine/src/dev/builtDeckRing.ts): at a pack
// level every seed seats one owner per side, and the measurement is only
// fair to the owners if each plays equally often and on both seats.

import { describe, expect, it } from "vitest";
import { ownersFor } from "../src/dev/builtDeckRing.js";

describe("ownersFor", () => {
  const n = 8;

  it("plays every owner of each side equally often, going first and second equally", () => {
    for (const side of ["self", "opponent"] as const) {
      const first = Array.from({ length: n }, () => 0);
      const second = Array.from({ length: n }, () => 0);
      // 2 * n * n seeds is one whole cycle of pairings.
      for (let seed = 1; seed <= 2 * n * n; seed++) (seed % 2 === 1 ? first : second)[ownersFor(seed, n)[side]]!++;
      expect(first).toEqual(Array.from({ length: n }, () => n));
      expect(second).toEqual(first);
    }
  });

  it("meets every pairing of owners once per cycle, each on both seats", () => {
    const seen = new Map<string, number>();
    for (let seed = 1; seed <= 2 * n * n; seed++) {
      const { self, opponent } = ownersFor(seed, n);
      const k = `${self}-${opponent}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    expect(seen.size).toBe(n * n);
    expect([...seen.values()].every((x) => x === 2)).toBe(true);
  });

  it("seats owner 0 against owner 0 with one owner per side (the full-collection levels)", () => {
    for (let seed = 1; seed <= 50; seed++) expect(ownersFor(seed, 1)).toEqual({ self: 0, opponent: 0 });
  });

  it("keeps the ring's 2,500 seeds within one game per owner and seat", () => {
    const counts = Array.from({ length: n }, () => 0);
    for (let seed = 1; seed <= 2500; seed++) counts[ownersFor(seed, n).self]!++;
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });
});
