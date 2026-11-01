import { describe, expect, it } from "vitest";
import { idle, ratePeriod, rateMatch, RATING_START, winProbability } from "../src/glicko2.js";

describe("Glicko-2 (Glickman 2013)", () => {
  it("reproduces the paper's worked example to its printed precision", () => {
    const after = ratePeriod({ rating: 1500, rd: 200, volatility: 0.06 }, [
      { opponent: { rating: 1400, rd: 30, volatility: 0.06 }, score: 1 },
      { opponent: { rating: 1550, rd: 100, volatility: 0.06 }, score: 0 },
      { opponent: { rating: 1700, rd: 300, volatility: 0.06 }, score: 0 },
    ]);
    // The paper prints 1464.06 from intermediates rounded to 4 places
    // (mu' = -0.2069); unrounded, the same steps give 1464.0507.
    expect(after.rating).toBeCloseTo(1464.05, 2);
    expect(Math.abs(after.rating - 1464.06)).toBeLessThan(0.05);
    expect(after.rd).toBeCloseTo(151.52, 2);
    expect(after.volatility).toBeCloseTo(0.059996, 6); // printed (truncated) as 0.05999
  });

  it("a win moves up, a loss down, a draw between equals not at all; both sides of one match are mirror images", () => {
    const a = { ...RATING_START };
    const b = { ...RATING_START };
    const win = rateMatch(a, b, 1);
    expect(win.a.rating).toBeGreaterThan(1500);
    expect(win.b.rating).toBeLessThan(1500);
    expect(win.a.rating - 1500).toBeCloseTo(1500 - win.b.rating, 9);
    expect(win.a.rd).toBeLessThan(350);
    const draw = rateMatch(a, b, 0.5);
    expect(draw.a.rating).toBeCloseTo(1500, 9);
    expect(draw.b.rating).toBeCloseTo(1500, 9);
  });

  it("an upset moves more than an expected result; a certain player moves less than an uncertain one", () => {
    const strong = { rating: 1800, rd: 80, volatility: 0.06 };
    const weak = { rating: 1400, rd: 80, volatility: 0.06 };
    const expectedWin = rateMatch(strong, weak, 1);
    const upset = rateMatch(strong, weak, 0);
    expect(strong.rating - upset.a.rating).toBeGreaterThan(expectedWin.a.rating - strong.rating);
    const sure = ratePeriod({ rating: 1500, rd: 60, volatility: 0.06 }, [{ opponent: { ...RATING_START, rd: 100 }, score: 1 }]);
    const unsure = ratePeriod({ rating: 1500, rd: 300, volatility: 0.06 }, [{ opponent: { ...RATING_START, rd: 100 }, score: 1 }]);
    expect(unsure.rating - 1500).toBeGreaterThan(sure.rating - 1500);
  });

  it("idle periods grow RD by the volatility, capped at the start, and touch nothing else", () => {
    const p = { rating: 1620, rd: 60, volatility: 0.06 };
    expect(idle(p, 0)).toEqual(p);
    const one = idle(p, 1);
    expect(one.rd).toBeCloseTo(Math.sqrt((60 / 173.7178) ** 2 + 0.06 ** 2) * 173.7178, 9);
    expect(idle(p, 10).rd).toBeGreaterThan(one.rd);
    expect(idle(p, 100_000).rd).toBe(350);
    expect(idle(p, 10).rating).toBe(1620);
    expect(ratePeriod(p, [])).toEqual(one);
    expect(() => idle(p, -1)).toThrow(RangeError);
    expect(() => idle(p, 1.5)).toThrow(RangeError);
  });

  it("RD never exceeds the start, even for a new player's first result", () => {
    const first = rateMatch({ ...RATING_START }, { ...RATING_START }, 0);
    expect(first.a.rd).toBeLessThanOrEqual(350);
    expect(first.b.rd).toBeLessThanOrEqual(350);
  });

  it("winProbability is 0.5 for equals, symmetric, and rises with the rating gap", () => {
    const a = { rating: 1500, rd: 100, volatility: 0.06 };
    expect(winProbability(a, a)).toBeCloseTo(0.5, 12);
    const b = { rating: 1700, rd: 100, volatility: 0.06 };
    expect(winProbability(a, b) + winProbability(b, a)).toBeCloseTo(1, 12);
    expect(winProbability(b, a)).toBeGreaterThan(0.7);
    expect(winProbability({ ...b, rating: 1900 }, a)).toBeGreaterThan(winProbability(b, a));
  });

  it("refuses a nonsense rating", () => {
    expect(() => ratePeriod({ rating: Number.NaN, rd: 100, volatility: 0.06 }, [{ opponent: { ...RATING_START }, score: 1 }])).toThrow(RangeError);
    expect(() => ratePeriod({ rating: 1500, rd: 0, volatility: 0.06 }, [{ opponent: { ...RATING_START }, score: 1 }])).toThrow(RangeError);
  });
});
