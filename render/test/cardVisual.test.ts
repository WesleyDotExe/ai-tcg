import { describe, expect, it } from "vitest";
import { visualPatternFor, visualSeedFor } from "../src/cardVisual.js";

describe("cardVisual", () => {
  it("is deterministic: the same card id always yields the same seed and pattern", () => {
    expect(visualSeedFor("AG-001")).toBe(visualSeedFor("AG-001"));
    expect(visualPatternFor("AG-001")).toBe(visualPatternFor("AG-001"));
  });

  it("keeps the seed in the hue-rotation range CSS expects", () => {
    for (const id of ["AG-001", "SW-014", "NU-003", "CX-020", ""]) {
      const seed = visualSeedFor(id);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(360);
    }
  });

  it("keeps the pattern index within the 4 CSS pattern variants", () => {
    for (const id of ["AG-001", "SW-014", "NU-003", "CX-020", ""]) {
      const pattern = visualPatternFor(id);
      expect(pattern).toBeGreaterThanOrEqual(0);
      expect(pattern).toBeLessThan(4);
    }
  });

  it("gives different cards visibly different seeds or patterns most of the time", () => {
    const ids = ["AG-001", "AG-007", "AG-013", "SW-001", "SW-002", "NU-001", "NU-002", "CX-001", "CX-002"];
    const keys = new Set(ids.map((id) => `${visualSeedFor(id)}:${visualPatternFor(id)}`));
    // Not a strict collision-free guarantee (it's a small hash space) — but
    // 9 real card ids should not all collapse onto one or two combinations,
    // which is what "distinct, driven by card attributes" (DESIGN.md's art
    // section) actually requires of a placeholder frame.
    expect(keys.size).toBeGreaterThan(4);
  });
});
