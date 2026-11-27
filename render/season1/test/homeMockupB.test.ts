// Season 1 Home mockup B held to the spec (render session 84; A and C were
// retired in render session 86, once the owner picked B), and
// the owner's 2026-11-22 pack decision (claim in Daily rewards, open in
// Packs, buy in Store as a shop window). The data is the real snapshot of
// the Season 0 site demo's owner API: Nova (weeks in) and Wren (new).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TILES, homeOf, type Size } from "../src/homeSpec.js";
import { factsIn, nextAction, type HomeData } from "../src/homeFacts.js";
import { B_BOARDS, B_RECOMMENDED, heroArt, mockupBPage, tileHtml as tileB } from "../src/homeMockupB.js";
import { PLACES, opensOf } from "../src/homeShell.js";

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

  it("makes the Store's hero the packs (owner 2026-11-28, point 9): credits and packs they buy at S, packs with prices at M and L, no cosmetics", () => {
    expect(tileOf("store").sizes.S).toEqual(["credits", "affordable"]);
    expect(tileOf("store").sizes.L).toEqual(["credits", "affordable", "buyPacks"]);
    const m = tileB("store", "M", nova), l = tileB("store", "L", nova);
    expect(m).toContain('class="spk"'); // Season 0's sealed pack, with its plate
    expect(m.match(/<figure class="pb /g)).toHaveLength(1); // the featured pack
    expect(l.match(/<figure class="pb /g)).toHaveLength(2); // 1 pack and 10
    for (const h of [m, l]) expect(h).not.toMatch(/data-fact="cosmetics"|data-coin=|#lg-/);
    expect(text(tileB("store", "S", nova))).toMatch(/Enough for 4 packs ?\./);
    expect(text(tileB("store", "S", wren))).toContain("Win matches to earn credits");
  });

  it("links the free pack's alert to Daily rewards", () => {
    expect(tileB("notif", "M", wren)).toContain('data-to="daily"');
  });
});

describe("mockup B draws the spec", () => {
  for (const [name, tile] of [["B", tileB]] as const) {
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

  it("recommends nine tiles, every decided tile once, Music left out until its spec", () => {
    const decided = TILES.filter((t) => t.status === "decided").map((t) => t.id).sort();
    expect(B_RECOMMENDED.map((x) => x.tile).sort()).toEqual(decided);
    for (const s of SIZES) expect(B_BOARDS[s]!.every((b) => b.size === s)).toBe(true);
  });

  it("navigates the same five places; every tile's arrow lands on one", () => {
    expect(PLACES.map((p) => p.name)).toEqual(["Home", "My agent", "Watch", "Cards", "Ladder"]);
    const ids = new Set<string>([...PLACES.map((p) => p.id), "alerts", "settings"]);
    for (const t of TILES) expect(ids.has(opensOf(t.id)), t.id).toBe(true);
  });

  it("builds self-contained pages: no outside URLs, both owners", () => {
    const html = mockupBPage(data);
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toMatch(/@import|url\(http/);
    expect(html).toContain('"wren"');
  });

  it("is fenced off: no Season 0 file names B, the shell, the grid or the Home page", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (f === "node_modules" || f === "output") continue;
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|mjs|js|html)$/.test(f) && /homeMockupB|homeShell|homeGrid\.js|homePage\.js/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(join(import.meta.dirname, "..", "..", "src"));
    expect(hits).toEqual([]);
  });
});
