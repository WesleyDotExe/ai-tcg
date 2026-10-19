// The balance-report drivers that run only when a session runs them
// (signatureRingDrivers.ts, behind balance report 030; aegisSignatureGain.ts,
// behind 031) are scripts with top-level await, so a test can't import them
// without running them. This runs each as the session would, at 2 seeds
// with every section, so a change to the engine or the harness that breaks
// a driver fails here instead of in the next long report run.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const engineDir = fileURLToPath(new URL("..", import.meta.url));

/** Runs a dev driver with tsx, the way a session runs it; throws on a non-zero exit. */
function run(script: string, ...args: string[]): string {
  return execFileSync(process.execPath, ["--import", "tsx", `src/dev/${script}`, ...args], { cwd: engineDir, encoding: "utf8", timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] });
}

/** A driver's output is whole: every section present, no blank numbers. */
function expectWhole(out: string, headers: string[]): void {
  for (const h of headers) expect(out, h).toContain(`== ${h}`);
  expect(out).not.toMatch(/NaN|undefined|Infinity/);
  expect(out.trimEnd()).toMatch(/\(\d+ s\)$/);
}

describe("balance-report drivers (smoke, 2 seeds, every section)", () => {
  it("signatureRingDrivers.ts runs all four sections", () => {
    const out = run("signatureRingDrivers.ts", "2");
    expect(out).toMatch(/^# Balance report driver: the ring with signature cards \(2 gate seeds per edge/);
    expectWhole(out, ["1. The six ring edges in four ways", "2a.", "2b.", "3. How each side uses its key card", "4. Trial fixes on Prime Aegis"]);
    // All six ring edges, in each of the four modes.
    expect(out.match(/^ {2}\S+ [>~] \S+ \(\d/gm)).toHaveLength(6);
  }, 150_000);

  it("aegisSignatureGain.ts runs all five sections", () => {
    const out = run("aegisSignatureGain.ts", "2");
    expect(out).toMatch(/^# Aegis's signature gain \(2 gate seeds per cell/);
    expectWhole(out, ["1. What a signature card is worth", "2. Spare energy", "3. What happens to the signature card", "4. Trial fixes for Null > Aegis", "5. The cause check"]);
    // Section 1: a mean gain line per faction.
    expect(out.match(/^ {2}(Cortex|Swarm|Aegis|Null)\s+mean /gm)).toHaveLength(4);
  }, 150_000);

  it("a driver that fails exits non-zero (the smoke test can see a break)", () => {
    expect(() => run("noSuchDriver.ts")).toThrow();
  });
});
