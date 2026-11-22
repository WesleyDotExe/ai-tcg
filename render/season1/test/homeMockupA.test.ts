// Season 1 Home mockup A held to the spec (render session 83). The data is
// the real snapshot of the Season 0 site demo's owner API
// (season1/mockup/data/home-data.json): Nova (weeks in) and Wren (new).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TILES, type Size } from "../src/homeSpec.js";
import { RENDER, factsIn, nextAction, dayMost, isPlaced, SETTLED_RD, type HomeData } from "../src/homeFacts.js";
import { A_BOARDS, A_OPENS, A_PAGES, A_RECOMMENDED, mockupAPage, tileHtml } from "../src/homeMockupA.js";

const data = JSON.parse(readFileSync(join(import.meta.dirname, "..", "mockup", "data", "home-data.json"), "utf8")) as HomeData;
const nova = data.owners.nova!, wren = data.owners.wren!;
const SIZES: Size[] = ["S", "M", "L"];
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[#a-z0-9]+;/g, " ").replace(/\s+/g, " ");

describe("the mockups' data", () => {
  it("is a real read of both owners: Nova weeks in, Wren just signed up", () => {
    expect(nova.matches.total).toBeGreaterThan(5);
    expect(isPlaced(nova)).toBe(true);
    expect(wren.matches.total).toBe(0);
    expect(isPlaced(wren)).toBe(false);
    expect(wren.packs.unopened.length).toBeGreaterThan(0);
    expect(nova.live.matches.length).toBeGreaterThan(0);
    for (const o of [nova, wren]) for (const [k, v] of Object.entries(o)) expect((v as { error?: number }).error, k).toBeUndefined();
  });
});

describe("the tiles drawn from it (homeFacts.ts)", () => {
  it("draws every spec fact, marked with its name", () => {
    for (const t of TILES) for (const s of SIZES) for (const f of t.sizes[s]) for (const d of [nova, wren]) expect(factsIn(RENDER[f](d, s)), `${t.id} ${s} ${f}`).toEqual([f]);
  });

  it("puts exactly the spec's facts in each tile at each size, with one next action", () => {
    for (const t of TILES) for (const s of SIZES) for (const d of [nova, wren]) {
      const html = tileHtml(t.id, s, d);
      expect([...factsIn(html)].sort(), `${t.id} ${s}`).toEqual([...t.sizes[s]].sort());
      expect(text(html)).toContain(t.question.replace(/[']/g, " ").replace(/\s+/g, " "));
      const footer = /<footer>([\s\S]*?)<\/footer>/.exec(html)![1]!;
      expect(footer.match(/<button/g), `${t.id} ${s} footer`).toHaveLength(1);
    }
  });

  it("keeps one home per fact: Nova's rating only in Ladder, her credits only in Store", () => {
    const rating = String(Math.round(nova.rating.rating.rating)).replace(/\B(?=(\d{3})+$)/g, ",");
    for (const t of TILES) for (const s of SIZES) {
      const tx = text(tileHtml(t.id, s, nova));
      if (t.id !== "ladder") expect(tx, `${t.id} ${s}`).not.toContain(rating);
      if (t.id !== "store") expect(tx, `${t.id} ${s}`).not.toMatch(new RegExp(`\\b${nova.wallet.credits}\\b`));
    }
    expect(text(tileHtml("ladder", "S", nova))).toContain(rating);
  });

  it("gives the new player words, not blanks or Season 0's unclear labels", () => {
    for (const t of TILES) for (const s of SIZES) {
      const tx = text(tileHtml(t.id, s, wren));
      expect(tx, `${t.id} ${s}`).not.toMatch(/undefined|NaN|\bnull\b|±|0 since a|No packs opened yet|credits short| — /);
    }
    expect(text(tileHtml("ladder", "S", wren))).toContain("Unrated");
    expect(text(tileHtml("ladder", "M", wren))).toContain("0 of 5");
    expect(text(tileHtml("ladder", "L", wren))).toContain("The chart starts after placement");
    expect(text(tileHtml("collection", "S", wren))).toContain("your starter deck");
    expect(nextAction(TILES.find((t) => t.id === "collection")!, "S", wren).label).toBe("Open packs");
    expect(text(tileHtml("history", "M", wren))).toContain("Press Start on My agent");
  });

  it("writes the server's numbers in words: pity timers counting down, Settling / Settled, the day's most", () => {
    expect(text(tileHtml("packs", "M", nova))).toMatch(/Full Art within \d+ packs? · a Mythic within \d+ packs?/);
    expect(text(tileHtml("ladder", "M", nova))).toMatch(nova.rating.rating.rd <= SETTLED_RD ? /Settled/ : /Settling/);
    expect(text(tileHtml("ladder", "S", nova))).not.toMatch(/Settl/);
    expect(dayMost(nova)).toBe(90);
  });
});

describe("mockup A (homeMockupA.ts)", () => {
  it("has five places, and every tile's arrow lands on one of them", () => {
    expect(A_PAGES.map((p) => p.name)).toEqual(["Home", "My agent", "Watch", "Cards", "Ladder"]);
    const ids = new Set<string>([...A_PAGES.map((p) => p.id), "alerts", "settings"]);
    for (const t of TILES) expect(ids.has(A_OPENS[t.opens] ?? t.opens), `${t.id} -> ${t.opens}`).toBe(true);
    for (const p of A_PAGES) for (const id of p.from) expect(A_OPENS[TILES.find((t) => t.id === id)!.opens] ?? TILES.find((t) => t.id === id)!.opens).toBe(p.id);
  });

  it("recommends nine tiles, every decided tile once, Music left out until its spec", () => {
    expect(A_RECOMMENDED.map((b) => b.tile).sort()).toEqual(TILES.filter((t) => t.status === "decided").map((t) => t.id).sort());
    for (const s of SIZES) expect(A_BOARDS[s]!.every((b) => b.size === s)).toBe(true);
  });

  it("builds one self-contained page: no outside URLs, both owners", () => {
    const html = mockupAPage(data);
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toMatch(/@import|url\(http/);
    expect(html).toContain('"nova"');
    expect(html).toContain('"wren"');
  });

  it("is fenced off: no Season 0 file names it", () => {
    const root = join(import.meta.dirname, "..", "..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (f === "season1" || f === "node_modules" || f === "output") continue;
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|mjs|js|html)$/.test(f) && /homeMockupA|homeFacts/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(join(root, "src"));
    expect(hits).toEqual([]);
  });
});
