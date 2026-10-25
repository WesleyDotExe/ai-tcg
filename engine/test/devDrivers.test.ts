// The balance-report drivers that run only when a session runs them
// (signatureRingDrivers.ts, behind balance report 030; aegisSignatureGain.ts,
// behind 031) are scripts with top-level await, so a test can't import them
// without running them. This runs each as the session would, at 2 seeds
// with every section, so a change to the engine or the harness that breaks
// a driver fails here instead of in the next long report run.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("deckBuilderStyleReport.ts builds, crosses and reports (2 styles, a few games)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-tcg-dbstyle-"));
    try {
      mkdirSync(join(dir, "builds"));
      mkdirSync(join(dir, "cross"));
      for (const style of ["calculator", "rusher"]) {
        run("deckBuilderStyleReport.ts", "build", style, "--games", "1", "--trials", "1", "--confirm", "1", "--out", join(dir, "builds", `${style}.json`));
      }
      for (const pilot of ["calculator", "rusher"]) {
        run("deckBuilderStyleReport.ts", "cross", pilot, "--builds", join(dir, "builds"), "--games", "2", "--out", join(dir, "cross", `${pilot}.json`));
      }
      const out = run("deckBuilderStyleReport.ts", "report", "--builds", join(dir, "builds"), "--cross", join(dir, "cross"));
      for (const h of ["1. What each style built", "2. Cross", "3. The gain", "4. The decks"]) expect(out, h).toContain(`== ${h}`);
      expect(out).not.toMatch(/NaN|undefined|Infinity/);
      // A gain row for Rusher over all four factions, and every faction's cross table.
      expect(out).toMatch(/^Rusher\s+.*[+-]\d+\.\d ±\d+\.\d\s*$/m);
      expect(out.match(/^-- (Cortex|Swarm|Aegis|Null) --$/gm)!.length).toBeGreaterThanOrEqual(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 150_000);

  it("builtDeckRing.ts builds, rings and reports (two levels, a few games)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-tcg-bdring-"));
    const collections = fileURLToPath(new URL("../../progress/built-deck-ring/collections.json", import.meta.url));
    try {
      mkdirSync(join(dir, "builds"));
      mkdirSync(join(dir, "rings"));
      for (const level of ["full", "3"]) {
        for (const f of ["Cortex", "Swarm", "Aegis", "Null"]) {
          run("builtDeckRing.ts", "build", level, f, "--collections", collections, "--games", "1", "--trials", "1", "--confirm", "1", "--out", join(dir, "builds", `${level}-${f}.json`));
        }
        for (const mode of ["real", "gate"]) run("builtDeckRing.ts", "ring", level, "--mode", mode, "--builds", join(dir, "builds"), "--seeds", "16", "--out", join(dir, "rings", `${level}-${mode}.json`));
      }
      const out = run("builtDeckRing.ts", "report", "--builds", join(dir, "builds"), "--rings", join(dir, "rings"));
      for (const h of ["REAL-MATCH MODE", "GATE MODE", "The built decks"]) expect(out, h).toContain(`== ${h}`);
      expect(out).not.toMatch(/NaN|undefined|Infinity/);
      // Every edge in both modes, with the shipped baseline and both levels.
      expect(out.match(/^Null > Aegis \(55-60\)(\s+\d+\.\d \[[\d.]+-[\d.]+\] (IN|OUT|unres\.)){3}$/gm)).toHaveLength(2);
      // The day-one level spreads its games over the 8 owners of each faction.
      expect(out).toMatch(/^ {2}3 packs {3}Null > Aegis\s+min \d/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 300_000);
  it("deckSizeCheck.ts trims and reports (every faction, 2 seeds; the committed holdings file)", () => {
    const dir = mkdtempSync(join(tmpdir(), "ai-tcg-decksize-"));
    const holdings = fileURLToPath(new URL("../../progress/deck-size/holdings.json", import.meta.url));
    try {
      copyFileSync(holdings, join(dir, "holdings.json"));
      for (const f of ["Cortex", "Swarm", "Aegis", "Null"]) run("deckSizeCheck.ts", "trim", f, "--seeds", "2", "--out", join(dir, `trim-${f}.json`));
      const out = run("deckSizeCheck.ts", "report", "--dir", dir);
      for (const h of ["1. The rule today", "2. The demo's 26-card Null deck", "3. How often the cards cap the size", "4. Does a shorter deck win more?"]) expect(out, h).toContain(`== ${h}`);
      expect(out).not.toMatch(/NaN|undefined|Infinity/);
      // Every faction's cuts, size-alone pairs and fresh replay.
      expect(out.match(/^ {2}20, random, mean /gm)).toHaveLength(4);
      expect(out.match(/^ {2}13 cards x2 = 26 /gm)).toHaveLength(4);
      expect(out.match(/^ {4}(Cortex|Swarm|Aegis|Null)\s+36: /gm)).toHaveLength(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 150_000);
});
