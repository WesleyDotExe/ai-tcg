// The Store and Packs tiles (render session 91, phase 2 "the tiles in
// groups", group 3; owner 2026-11-28 point 9: the Store tile's hero is the
// packs, the cosmetics stay in the Store page).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIVE_PACK_ODDS } from "@ai-tcg/economy";
import { CARDS_PER_PACK, FACTS, L_OFFERS, nextAction, tileById, tileFacts, type HomeData } from "../src/homeFacts.js";
import { gridTileHtml } from "../src/homePage.js";
import { storeStateCases } from "../src/storeStates.js";
import { packsStateCases } from "../src/packsStates.js";
import type { Size } from "../src/homeSpec.js";

const data = JSON.parse(readFileSync(join(import.meta.dirname, "..", "mockup", "data", "home-data.json"), "utf8")) as HomeData;
const nova = data.owners.nova!, wren = data.owners.wren!;
const SIZES: Size[] = ["S", "M", "L"];
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[#a-z0-9]+;/g, " ").replace(/\s+/g, " ").replace(/ ([.,])/g, "$1");
const packsIn = (html: string) => [...html.matchAll(/<figure class="pb (\w+)" data-offer="(\w+)" data-count="(\d+)" data-price="(\d+)">([\s\S]*?)<\/figure>/g)].map((m) => ({ look: m[1]!, offer: m[2]!, count: Number(m[3]), price: Number(m[4]), buy: /data-buy="(\w+:\d+)"/.exec(m[5]!)?.[1] ?? null, need: /class="pb-need"/.test(m[5]!) }));

describe("the Store tile: the packs are the hero (owner 2026-11-28, point 9)", () => {
  it("has no cosmetics fact any more, and no tile shows cosmetics", () => {
    expect(Object.keys(FACTS)).not.toContain("cosmetics");
    for (const c of storeStateCases(data)) for (const s of SIZES) expect(gridTileHtml("store", s, c.data)).not.toMatch(/data-fact="cosmetics"|data-coin=|#lg-|class="si[ "]/);
  });
  it("a pack holds the live table's five cards", () => {
    expect(CARDS_PER_PACK).toBe(Object.values(LIVE_PACK_ODDS.slots).reduce((a, b) => a + b, 0) + 1);
    expect(CARDS_PER_PACK).toBe(5);
  });
  it("S: the credits and how many packs they buy; no pack drawn; Buy a pack carries its purchase", () => {
    const h = gridTileHtml("store", "S", nova);
    expect(text(h)).toMatch(/449 credits Enough for 4 packs\./);
    expect(packsIn(h)).toEqual([]);
    expect(h).toMatch(/data-go="cards" data-buy="S0:1">Buy a pack</);
    expect(nextAction(tileById("store"), "S", wren).label).toBe("How to earn credits");
  });
  it("M: the featured pack as the hero, with its price and Buy; L: 1 and 10 of each offer", () => {
    expect(packsIn(gridTileHtml("store", "M", nova))).toEqual([{ look: "hero", offer: "S0", count: 1, price: 100, buy: "S0:1", need: false }]);
    expect(packsIn(gridTileHtml("store", "L", nova))).toEqual([
      { look: "shelf", offer: "S0", count: 1, price: 100, buy: "S0:1", need: false },
      { look: "shelf", offer: "S0", count: 10, price: 1000, buy: null, need: true },
    ]);
    expect(text(gridTileHtml("store", "L", nova))).toContain("551 more credits");
  });
  it("every state: Buy only when the credits cover it (else how many more), never both; L shows two offers at most and names the rest", () => {
    for (const c of storeStateCases(data)) {
      const offers = c.data.packs.offer;
      for (const s of ["M", "L"] as const) {
        const ps = packsIn(gridTileHtml("store", s, c.data));
        expect(ps.length, `${c.id} ${s}`).toBe(!offers.length ? 0 : s === "M" ? 1 : Math.min(offers.length, L_OFFERS) * 2);
        for (const p of ps) {
          expect(p.buy !== null, `${c.id} ${s} ${p.offer}x${p.count}`).toBe(c.data.wallet.credits >= p.price);
          expect(p.need).toBe(p.buy === null);
          if (p.buy) expect(p.buy).toBe(`${p.offer}:${p.count}`);
        }
      }
      const more = Math.max(0, offers.length - L_OFFERS);
      expect(text(gridTileHtml("store", "L", c.data)).includes(`+${more} more pack`)).toBe(more > 0);
    }
  });
  it("the affordable line counts packs only, named when more than one pack is on sale", () => {
    const at = (id: string) => text(tileFacts(tileById("store"), "S", storeStateCases(data).find((c) => c.id === id)!.data).join(""));
    expect(at("short")).toContain("40 more credits for a pack.");
    expect(at("one")).toContain("Enough for 1 pack.");
    expect(at("ten")).toContain("Enough for 23 packs.");
    expect(at("two-offers")).toContain("Enough for 8 Season One packs.");
    expect(at("none")).toContain("Credits buy packs when a pack is on sale.");
  });
});

describe("the Packs tile", () => {
  it("S keeps to the count; M and L tell a new player why to open them", () => {
    expect(text(gridTileHtml("packs", "S", wren))).not.toContain("Open them");
    for (const s of ["M", "L"] as const) expect(text(gridTileHtml("packs", s, wren))).toContain("Open them to add cards your agent can use.");
    for (const s of SIZES) expect(text(gridTileHtml("packs", s, nova))).not.toContain("Open them");
  });
  it("says 'in the next pack' when a guarantee is due", () => {
    const due = packsStateCases(data).find((c) => c.id === "due")!.data;
    expect(text(gridTileHtml("packs", "M", due))).toMatch(/a Full Art in the next pack · a Mythic in the next pack/);
    expect(text(gridTileHtml("packs", "M", nova))).toMatch(/a Full Art within 3 packs · a Mythic within 38 packs/);
  });
  it("a new player's L shows what a pack holds, from the live table", () => {
    const h = gridTileHtml("packs", "L", wren);
    expect([...h.matchAll(/<li class="ps-(\w+)">/g)].map((m) => m[1])).toEqual(["common", "common", "uncommon", "rare", "shine"]);
    expect(text(h)).toContain(`1 in ${Math.round(1 / LIVE_PACK_ODDS.mythicInRareSlot)} a Mythic`);
    expect(gridTileHtml("packs", "L", nova)).not.toContain('class="pslots"');
  });
  it("every size says the same count in every state", () => {
    for (const c of packsStateCases(data)) {
      const counts = SIZES.map((s) => /<b class="big">([^<]*)<\/b>/.exec(tileFacts(tileById("packs"), s, c.data)[0]!)?.[1] ?? "none");
      expect(new Set(counts).size, c.id).toBe(1);
    }
  });
});
