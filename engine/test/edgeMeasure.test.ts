// The interval statistics in dev/edgeMeasure.ts decide whether a balance
// pairing is called in or out of band (owner-feedback 2026-09-26,
// "cross-project" entry), so they are checked against known values.
import { expect, test } from "vitest";
import { wilson, newcombeDiff, bandVerdict, ringBand } from "../src/dev/edgeMeasure.js";

test("Wilson interval matches the textbook values", () => {
  // 81/263: Newcombe (1998) Table I example, 0.2553 to 0.3662.
  const ci = wilson(81, 263);
  expect(ci.lo).toBeCloseTo(0.2553, 3);
  expect(ci.hi).toBeCloseTo(0.3662, 3);
  // Edge cases stay inside [0, 1].
  expect(wilson(0, 10).lo).toBe(0);
  expect(wilson(10, 10).hi).toBe(1);
});

test("Newcombe difference interval matches the published example", () => {
  // Newcombe (1998) Table II example 1: 56/70 vs 48/80, diff 0.2000, CI 0.0524 to 0.3339.
  const d = newcombeDiff(56, 70, 48, 80);
  expect(d.diff).toBeCloseTo(0.2, 4);
  expect(d.lo).toBeCloseTo(0.0524, 3);
  expect(d.hi).toBeCloseTo(0.3339, 3);
});

test("band verdict: out only when the whole interval misses the band", () => {
  const band = { lo: 0.45, hi: 0.55 };
  expect(bandVerdict(350, 900, band)).toBe("OUT OF BAND"); // 38.9%, CI tops out near 42
  expect(bandVerdict(450, 900, band)).toBe("IN BAND"); // 50%, CI about 46.7-53.3
  expect(bandVerdict(405, 900, band)).toBe("UNRESOLVED"); // 45%, CI straddles the floor
});

test("ring bands follow Null > Aegis > Cortex > Swarm > Null", () => {
  expect(ringBand("Null", "Aegis")).toEqual({ lo: 0.55, hi: 0.6 });
  expect(ringBand("Aegis", "Null")).toEqual({ lo: 0.4, hi: 0.45 });
  expect(ringBand("Null", "Swarm")).toEqual({ lo: 0.4, hi: 0.45 });
  expect(ringBand("Null", "Cortex")).toEqual({ lo: 0.45, hi: 0.55 });
  expect(ringBand("Aegis", "Swarm")).toEqual({ lo: 0.45, hi: 0.55 });
});
