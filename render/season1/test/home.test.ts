// The Season 1 Home (B on the owner's uniform grid, render session 86; B's
// tiles since render 84) held to the spec, the owner's 2026-11-22 pack
// decision (claim in Daily rewards, open in Packs, buy in Store as a shop
// window) and the owner's 2026-11-23 Watch live shapes. The data is the real
// snapshot of the Season 0 site demo's owner API: Nova (weeks in) and Wren
// (new). The grid itself: homeGrid.test.ts; in a browser: ci/home-check.mjs.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TILES, homeOf, type Size } from "../src/homeSpec.js";
import { factsIn, nextAction, type HomeData } from "../src/homeFacts.js";
import { HOME_BOARDS, HOME_RECOMMENDED, heroArt, homePage, tileHtml as tileB } from "../src/home.js";
import { PLACES, opensOf } from "../src/homeShell.js";
import { GRID_GAP, homeGrid } from "../src/homeGrid.js";

const data = JSON.parse(readFileSync(join(import.meta.dirname, "..", "mockup", "data", "home-data.json"), "utf8")) as HomeData;
const nova = data.owners.nova!, wren = data.owners.wren!;
const SIZES: Size[] = ["S", "M", "L"];
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[#a-z0-9]+;/g, " ").replace(/\s+/g, " ");
const tileOf = (id: string) => TILES.find((t) => t.id === id)!;

describe("the owner's pack decision (2026-11-22, replaces render 82 call 2)", () => {
  it("claims the free pack in Daily rewards, opens in Packs, buys in Store: one home each", () => {
    expect(homeOf("freePack").map((t) => t.id)).toEqual(["daily"]);
    expect(homeOf("unopened").map((t) => t.id)).toEqual(["packs"]);
    expect(homeOf("buyPacks").map((t) => t.id)).toEqual(["store"]);
    expect(tileOf("daily").sizes.S).toContain("freePack");
    expect(tileOf("packs").sizes.S).toEqual(["unopened"]);
    expect(nextAction(tileOf("daily"), "S", wren).label).toBe("Claim free pack");
    expect(nextAction(tileOf("packs"), "S", wren).label).toBe("Open a pack");
  });

  it("makes the Store a shop window: credits and what they buy at S, pictures with prices at M and L", () => {
    expect(tileOf("store").sizes.S).toEqual(["credits", "affordable"]);
    const m = tileB("store", "M", nova), l = tileB("store", "L", nova);
    expect(m).toContain('class="spk"'); // Season 0's sealed pack, with its plate
    expect(m.match(/<figure class="si"/g)).toHaveLength(4); // the featured pack and 3 cosmetics
    expect(l.match(/<figure class="si"/g)).toHaveLength(2 + nova.store.cosmetics.length); // 1 pack, 10 packs, the whole shelf
    expect(l).toContain('data-coin="coin-s0-neon-nickel"'); // a coin drawn by Season 0's coin painter
    expect(l).toContain('href="#lg-boast-s0-boot-sequence"'); // a boast's emblem
    expect(text(l)).toContain("No arenas, card backs or avatars on sale this season.");
    expect(text(tileB("store", "S", nova))).toMatch(/Enough for 4 packs or 1 cosmetic/);
    expect(text(tileB("store", "S", wren))).toContain("Win matches to earn credits");
  });

  it("links the free pack's alert to Daily rewards", () => {
    expect(tileB("notif", "M", wren)).toContain('data-to="daily"');
  });
});

describe("the Home draws the spec", () => {
  it("exactly the spec's facts in each tile at each size, its question and one next action", () => {
    for (const t of TILES) for (const s of SIZES) for (const d of [nova, wren]) {
      const html = tileB(t.id, s, d);
      expect([...factsIn(html)].sort(), `${t.id} ${s}`).toEqual([...t.sizes[s]].sort());
      expect(html).toContain(`<p class="q"`);
      expect(text(html)).toContain(t.question.replace(/[']/g, " ").replace(/\s+/g, " "));
      expect(/<footer>([\s\S]*?)<\/footer>/.exec(html)![1]!.match(/<button/g), `${t.id} ${s}`).toHaveLength(1);
      expect(text(html), `${t.id} ${s}`).not.toMatch(/undefined|NaN|\bnull\b/);
    }
  });

  it("puts the question behind a \"?\" and leads with the headline facts (Ladder: rating, tier and place)", () => {
    const html = tileB("ladder", "M", nova);
    expect(html).toMatch(/<button type="button" class="qb" aria-expanded="false" aria-controls="q-ladder"/);
    expect(factsIn(/<div class="headline">([\s\S]*?)<\/div><div class="body">/.exec(html)![1]!)).toEqual(["rating", "tier", "rank"]);
    expect(factsIn(/<div class="headline">([\s\S]*?)<\/div><div class="body">/.exec(tileB("store", "M", nova))![1]!)).toEqual(["credits", "affordable"]);
    expect(heroArt("packs", wren)).toContain("pk-fan n3");
    expect(heroArt("daily", wren)).toContain("--p:0.0");
  });

  it("draws Watch live in the owner's three shapes (2026-11-23)", () => {
    const m = data.owners.nova!.live.matches[0]!;
    const s = tileB("watch", "S", nova), md = tileB("watch", "M", nova), l = tileB("watch", "L", nova);
    // S: the names in their faction colours, health, the turn, a Live badge; no arena.
    expect(s).toContain('class="livebadge"');
    expect(text(s)).toMatch(new RegExp(`Turn ${m.now.turn}`));
    expect(text(s)).toContain(`${m.now.p1.health} health`);
    expect(s).not.toContain("arena916");
    // M: the arena with names and health bars over it, no card text, no hands.
    expect(md).toContain('class="lm-m"');
    expect(md).toContain("arena916 a-M");
    expect(md).not.toMatch(/class="hand/);
    expect(md).not.toMatch(/<span class="unit[^"]*"[^>]*><i>/);
    // L: the scoreboard (names, factions, health) above the whole arena, the turn line and both hands.
    expect(/<div class="headline">([\s\S]*?)<\/div><div class="body stage">/.exec(l)![1]).toContain('class="vs"');
    expect(text(l)).toContain(`${m.p1.ownerName} · ${m.p1.faction}`);
    expect(l.match(/class="hand/g)).toHaveLength(2);
    expect(l).toContain('class="disc"');
    expect(l).toMatch(/<span class="unit[^"]*"[^>]*><i>/);
  });

  it("recommends nine tiles, every decided tile once, Music left out until its spec", () => {
    const decided = TILES.filter((t) => t.status === "decided").map((t) => t.id).sort();
    expect(HOME_RECOMMENDED.map((x) => x.tile).sort()).toEqual(decided);
    for (const s of SIZES) expect(HOME_BOARDS[s]!.every((b) => b.size === s)).toBe(true);
  });

  it("packs the recommended board into four whole rows on a desktop, with no hole", () => {
    const g = homeGrid();
    const u = g.unit(1388, 4, GRID_GAP);
    const L = g.pack(HOME_RECOMMENDED, 4, u, GRID_GAP);
    expect(L.rows).toBe(4);
    expect(L.placed.reduce((s, p) => s + p.w * p.h, 0)).toBe(16);
  });

  it("navigates the five places; every tile's arrow lands on one", () => {
    expect(PLACES.map((p) => p.name)).toEqual(["Home", "My agent", "Watch", "Cards", "Ladder"]);
    const ids = new Set<string>([...PLACES.map((p) => p.id), "alerts", "settings"]);
    for (const t of TILES) expect(ids.has(opensOf(t.id)), t.id).toBe(true);
  });

  it("builds a self-contained page, light by default, with the grid's code in it", () => {
    const html = homePage(data);
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toMatch(/@import|url\(http/);
    expect(html).toContain('"wren"');
    expect(html).toContain('<html lang="en" data-theme="light">');
    expect(html).toContain("var HOME_GRID = (function () {");
    expect(html).not.toMatch(/masonry|mgrid/);
  });

  it("is fenced off: no Season 0 file names the Home, its shell or its grid", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (f === "node_modules" || f === "output") continue;
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|mjs|js|html)$/.test(f) && /season1\/src\/home|homeShell|homeGrid/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(join(import.meta.dirname, "..", "..", "src"));
    expect(hits).toEqual([]);
  });
});
