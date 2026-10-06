import { describe, expect, it } from "vitest";
import { LOSS_CREDITS, MAX_PAID_LOSSES_PER_DAY, matchCredits, winCredits } from "../src/payouts.js";

describe("winCredits (owner schedule: 30, then 10 x3, then 5 x6, then 0)", () => {
  it("pays the owner's daily schedule exactly", () => {
    const paid = Array.from({ length: 12 }, (_, i) => winCredits(i + 1));
    expect(paid).toEqual([30, 10, 10, 10, 5, 5, 5, 5, 5, 5, 0, 0]);
    expect(paid.reduce((a, b) => a + b, 0)).toBe(90);
  });

  it("rejects a non-positive or fractional position", () => {
    expect(() => winCredits(0)).toThrow();
    expect(() => winCredits(1.5)).toThrow();
  });
});

describe("matchCredits: win pays most, loss a little, cancel/abandon nothing", () => {
  it("holds win >= loss >= cancel = abandon = 0, strictly while a win still pays, for every daily tally", () => {
    for (let winsToday = 0; winsToday <= 15; winsToday++) {
      for (let lossesToday = 0; lossesToday <= 15; lossesToday++) {
        const tally = { winsToday, lossesToday };
        const win = matchCredits("win", tally);
        const loss = matchCredits("loss", tally);
        expect(matchCredits("cancelled", tally)).toBe(0);
        expect(matchCredits("abandoned", tally)).toBe(0);
        expect(matchCredits("draw", tally)).toBe(loss);
        expect(win).toBeGreaterThanOrEqual(loss);
        expect(loss).toBeGreaterThanOrEqual(0);
        if (win > 0) expect(win).toBeGreaterThan(loss);
        // Before any daily cap bites, a loss pays something: "a little", not nothing.
        if (winsToday < 10 && lossesToday < MAX_PAID_LOSSES_PER_DAY) expect(loss).toBe(LOSS_CREDITS);
      }
    }
  });

  it("stops paying losses after the daily cap, and once wins stop paying", () => {
    expect(matchCredits("loss", { winsToday: 0, lossesToday: MAX_PAID_LOSSES_PER_DAY })).toBe(0);
    expect(matchCredits("loss", { winsToday: 10, lossesToday: 0 })).toBe(0);
    expect(matchCredits("win", { winsToday: 10, lossesToday: 0 })).toBe(0);
  });
});
