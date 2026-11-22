// Season 1 Home mockups B and C held to the spec (render session 84), and
// the owner's 2026-11-22 pack decision (claim in Daily rewards, open in
// Packs, buy in Store as a shop window). The data is the real snapshot of
// the Season 0 site demo's owner API: Nova (weeks in) and Wren (new).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TILES, homeOf, type Size } from "../src/homeSpec.js";
import { factsIn, nextAction, type HomeData } from "../src/homeFacts.js";
import { B_BOARDS, B_RECOMMENDED, heroArt, mockupBPage, tileHtml as tileB } from "../src/homeMockupB.js";
import { C_BOARDS, C_RECOMMENDED, mockupCPage, needsOf, tileHtml as tileC } from "../src/homeMockupC.js";
import { PLACES, opensOf } from "../src/homeShell.js";
import { MOCKUPS, comparePage } from "../src/homeCompare.js";

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

describe("mockups B and C draw the spec", () => {
  for (const [name, tile] of [["B", tileB], ["C", tileC]] as const) {
    it(`${name}: exactly the spec's facts in each tile at each size, its question and one next action`, () => {
      for (const t of TILES) for (const s of SIZES) for (const d of [nova, wren]) {
        const html = tile(t.id, s, d);
        expect([...factsIn(html)].sort(), `${t.id} ${s}`).toEqual([...t.sizes[s]].sort());
        expect(html).toContain(`<p class="q"`);
        expect(text(html)).toContain(t.question.replace(/[']/g, " ").replace(/\s+/g, " "));
        expect(/<footer>([\s\S]*?)<\/footer>/.exec(html)![1]!.match(/<button/g), `${t.id} ${s}`).toHaveLength(1);
        expect(text(html), `${t.id} ${s}`).not.toMatch(/undefined|NaN|\bnull\b/);
      }
    });
  }

  it("B puts the question behind a \"?\" and leads with the first fact as the headline", () => {
    const html = tileB("ladder", "M", nova);
    expect(html).toMatch(/<button type="button" class="qb" aria-expanded="false" aria-controls="q-ladder"/);
    expect(factsIn(/<div class="headline">([\s\S]*?)<\/div><div class="body">/.exec(html)![1]!)).toEqual(["rating"]);
    expect(heroArt("packs", wren)).toContain("pk-fan n3");
    expect(heroArt("daily", wren)).toContain("--p:0.0");
  });

  it("C reads what needs you off the server's answers, most urgent first", () => {
    expect(needsOf(wren)).toEqual([
      { tile: "daily", why: "A free pack to claim" },
      { tile: "agent", why: "Your agent hasn't started yet" },
      { tile: "packs", why: "Packs to open" },
      { tile: "notif", why: "New alerts" },
    ]);
    expect(needsOf(nova).map((n) => n.tile)).toEqual(["daily", "watch", "packs", "notif", "store"]);
    expect(tileC("daily", "S", wren)).toContain('class="nd"');
    expect(tileC("ladder", "S", wren)).not.toContain('class="nd"');
  });

  it("recommends nine tiles each, every decided tile once, Music left out until its spec", () => {
    const decided = TILES.filter((t) => t.status === "decided").map((t) => t.id).sort();
    for (const b of [B_RECOMMENDED, C_RECOMMENDED]) expect(b.map((x) => x.tile).sort()).toEqual(decided);
    for (const boards of [B_BOARDS, C_BOARDS]) for (const s of SIZES) expect(boards[s]!.every((b) => b.size === s)).toBe(true);
  });

  it("navigates the same five places; every tile's arrow lands on one", () => {
    expect(PLACES.map((p) => p.name)).toEqual(["Home", "My agent", "Watch", "Cards", "Ladder"]);
    const ids = new Set<string>([...PLACES.map((p) => p.id), "alerts", "settings"]);
    for (const t of TILES) expect(ids.has(opensOf(t.id)), t.id).toBe(true);
  });

  it("builds self-contained pages: no outside URLs, both owners", () => {
    for (const html of [mockupBPage(data), mockupCPage(data), comparePage(data)]) {
      expect(html).not.toMatch(/(src|href)="https?:/);
      expect(html).not.toMatch(/@import|url\(http/);
    }
    for (const html of [mockupBPage(data), mockupCPage(data)]) expect(html).toContain('"wren"');
    expect(MOCKUPS.map((m) => m.file)).toEqual(["home-mockup-a.html", "home-mockup-b.html", "home-mockup-c.html"]);
  });

  it("is fenced off: no Season 0 file names B, C, the shell or the comparison", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (f === "node_modules" || f === "output") continue;
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|mjs|js|html)$/.test(f) && /homeMockupB|homeMockupC|homeShell|homeCompare/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(join(import.meta.dirname, "..", "..", "src"));
    expect(hits).toEqual([]);
  });
});
