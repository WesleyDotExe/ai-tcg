// The interval statistics in dev/edgeMeasure.ts decide whether a balance
// pairing is called in or out of band (owner-feedback 2026-09-26,
// "cross-project" entry), so they are checked against known values.
import { expect, test } from "vitest";
import { wilson, newcombeDiff, bandVerdict, ringBand, compareTwoProportions } from "../src/dev/edgeMeasure.js";

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

// Parity fixture (owner-feedback 2026-09-30): the vendored port checked
// against values captured once and hardcoded here, never against a live
// service. Captured from an independent re-implementation of the same
// formulas (Python, math.erf for the normal CDF, z = 1.96 for the intervals).
const PARITY_FIXTURE = [
  {
    input: [56, 70, 48, 80],
    z: 2.65017195, p: 0.00804508,
    group1: [0.69183135, 0.87695372], group2: [0.49045265, 0.70038341],
    diff: [0.2, 0.05242871, 0.33387493], verdict: "group 1 higher",
  },
  {
    input: [531, 900, 495, 900],
    z: 1.71393597, p: 0.08654049,
    group1: [0.55755044, 0.6216845], group2: [0.51735301, 0.58222196],
    diff: [0.04, -0.00572995, 0.08549432], verdict: "no detectable difference",
  },
] as const;

test("compareTwoProportions matches the hardcoded parity fixture", () => {
  for (const f of PARITY_FIXTURE) {
    const [x1, n1, x2, n2] = f.input;
    const r = compareTwoProportions(x1, n1, x2, n2);
    expect(r.z).toBeCloseTo(f.z, 6);
    expect(r.p).toBeCloseTo(f.p, 6);
    expect(r.group1.lo).toBeCloseTo(f.group1[0], 7);
    expect(r.group1.hi).toBeCloseTo(f.group1[1], 7);
    expect(r.group2.lo).toBeCloseTo(f.group2[0], 7);
    expect(r.group2.hi).toBeCloseTo(f.group2[1], 7);
    expect(r.diff.diff).toBeCloseTo(f.diff[0], 7);
    expect(r.diff.lo).toBeCloseTo(f.diff[1], 7);
    expect(r.diff.hi).toBeCloseTo(f.diff[2], 7);
    expect(r.verdict).toBe(f.verdict);
  }
});
