// The mulberry32 PRNG this package deliberately duplicates from the engine's
// own (see rng.ts's doc comment — @ai-tcg/agents has zero runtime dependency
// on @ai-tcg/engine on purpose). Determinism here is what makes a seeded
// agent's decisions reproducible for a bug report or a balance run.

import { describe, expect, it } from "vitest";
import { Rng } from "../src/rng.js";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(1234).next();
    const b = new Rng(1234).next();
    expect(a).toBe(b);
  });

  it("produces different sequences for different seeds", () => {
    const a = new Rng(1).next();
    const b = new Rng(2).next();
    expect(a).not.toBe(b);
  });

  it("produces values in [0, 1)", () => {
    const rng = new Rng(42);
    for (let i = 0; i < 200; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("int(n) stays within [0, n)", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const value = rng.int(5);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
    }
  });

  it("pick() only ever returns an item from the given array", () => {
    const rng = new Rng(99);
    const items = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it("pick() throws on an empty array rather than returning undefined", () => {
    expect(() => new Rng(1).pick([])).toThrow(/empty array/);
  });
});
