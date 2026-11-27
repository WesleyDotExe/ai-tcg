// The Season 1 Home tile spec held to its own rules (render session 82).
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AUDIT_FACTS, FACTS, LABELS, S0_WIDGETS, TILES, homeOf, type Fact, type Size } from "../src/homeSpec.js";

const SIZES: Size[] = ["S", "M", "L"];
const repo = join(import.meta.dirname, "..", "..", "..");
const auditDir = join(repo, "progress", "render", "evidence", "season1-home-audit-s82");

describe("the Season 1 Home tile spec", () => {
  it("lists the same Season 0 widgets the site has", () => {
    const src = readFileSync(join(repo, "render", "src", "site", "siteBoard.ts"), "utf8");
    const m = /export type WidgetType = ([^;]+);/.exec(src);
    const s0 = [...m![1]!.matchAll(/"(\w+)"/g)].map((x) => x[1]).sort();
    expect([...S0_WIDGETS].sort()).toEqual(s0);
  });

  it("gives every Season 0 widget exactly one Season 1 tile (none silently dropped)", () => {
    for (const w of S0_WIDGETS) expect(TILES.filter((t) => t.replaces.includes(w)).map((t) => t.id), w).toHaveLength(1);
  });

  it("merges the duplicates the owner named: My agent + Agent controls, Ladder + Rating & form", () => {
    expect(TILES.find((t) => t.id === "agent")!.replaces.sort()).toEqual(["agent", "live"]);
    expect(TILES.find((t) => t.id === "ladder")!.replaces.sort()).toEqual(["form", "ladder"]);
  });

  it("gives every fact exactly one home tile, and no tile shows another tile's fact", () => {
    for (const f of Object.keys(FACTS) as Fact[]) expect(homeOf(f).map((t) => t.id), f).toHaveLength(1);
    for (const t of TILES) for (const s of SIZES) for (const f of t.sizes[s]) expect(homeOf(f)[0]!.id, `${t.id} ${s} shows ${f}`).toBe(t.id);
  });

  // The one exception, by the owner's word (2026-11-27, note 6): My agent's
  // S shows the current play style as a fourth fact.
  const S_MAX: Record<string, number> = { agent: 4 };
  it("grows with its size: S ⊆ M ⊆ L, and S keeps to the core (three facts at most; My agent four, by the owner's word)", () => {
    for (const t of TILES) {
      for (const f of t.sizes.S) expect(t.sizes.M, `${t.id}: ${f} at S but not M`).toContain(f);
      for (const f of t.sizes.M) expect(t.sizes.L, `${t.id}: ${f} at M but not L`).toContain(f);
      expect(t.sizes.S.length, t.id).toBeGreaterThan(0);
      expect(t.sizes.S.length, t.id).toBeLessThanOrEqual(S_MAX[t.id] ?? 3);
      expect(new Set(t.sizes.L).size, `${t.id} repeats a fact`).toBe(t.sizes.L.length);
    }
  });

  it("gives every tile one question, a new player's view and a next action at every size", () => {
    const ids = new Set<string>();
    for (const t of TILES) {
      expect(ids.has(t.id), t.id).toBe(false);
      ids.add(t.id);
      expect(t.question.trim().endsWith("?"), t.id).toBe(true);
      for (const s of SIZES) {
        expect(t.newPlayer[s].trim().length, `${t.id} ${s} new player`).toBeGreaterThan(0);
        expect(t.next[s].trim().length, `${t.id} ${s} next`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the owner's calls as waiting, not guessed: music and Open 10", () => {
    expect(TILES.find((t) => t.id === "music")!.status).toBe("waiting on owner");
    expect(TILES.filter((t) => t.status === "waiting on owner").map((t) => t.id)).toEqual(["music"]);
    expect(LABELS.find((l) => l.was.startsWith("Open 10"))!.becomes).toMatch(/^waiting on owner/);
  });

  it("names every fact the audit found in more than one tile, and gives it one home", () => {
    const raw = JSON.parse(readFileSync(join(auditDir, "home-audit.json"), "utf8"));
    const found = new Set<string>();
    for (const o of Object.values<any>(raw.owners)) for (const k of ["recommendedDupes", "dupesS", "dupesM", "dupesL"]) for (const d of o[k] ?? []) found.add(d.fact);
    expect(found.size).toBeGreaterThan(3); // the audit did find the owner's duplicates
    for (const name of found) {
      expect(AUDIT_FACTS[name], `the audit's "${name}" has no place in the spec`).toBeDefined();
      for (const f of AUDIT_FACTS[name]!) expect(homeOf(f), `${name} -> ${f}`).toHaveLength(1);
    }
  });

  it("is written up: HOME_TILES.md names every tile's question", () => {
    const md = readFileSync(join(repo, "render", "season1", "HOME_TILES.md"), "utf8");
    for (const t of TILES) expect(md, t.id).toContain(t.question);
    for (const f of ["nova-recommended.jpg", "wren-all-L.jpg", "home-audit.txt"]) expect(existsSync(join(auditDir, f)), f).toBe(true);
  });
});
