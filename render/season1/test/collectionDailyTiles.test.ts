// The Collection and Daily rewards tiles (render session 93, phase 2 "the
// tiles in groups", group 4).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tileById, tileFacts, type HomeData } from "../src/homeFacts.js";
import { gridTileHtml } from "../src/homePage.js";
import { collectionExpect, collectionStateCases } from "../src/collectionStates.js";
import { dailyExpect, dailyStateCases } from "../src/dailyStates.js";
import type { Size } from "../src/homeSpec.js";

const data = JSON.parse(readFileSync(join(import.meta.dirname, "..", "mockup", "data", "home-data.json"), "utf8")) as HomeData;
const nova = data.owners.nova!, wren = data.owners.wren!;
const SIZES: Size[] = ["S", "M", "L"];
const text = (html: string) => html.replace(/&#39;|&#x27;/g, "'").replace(/<[^>]+>/g, " ").replace(/&[#a-z0-9]+;/g, " ").replace(/\s+/g, " ").replace(/ ([.,:])/g, "$1").trim();
const fact = (tile: string, size: Size, d: typeof nova, f: string) => text(tileFacts(tileById(tile), size, d).find((h) => h.includes(`data-fact="${f}"`)) ?? "");
const daily = (id: string) => dailyStateCases(data).find((c) => c.id === id)!.data;
const coll = (id: string) => collectionStateCases(data).find((c) => c.id === id)!.data;

describe("the Collection tile", () => {
  it("the held count is the headline number at every size; the share in words at L only", () => {
    for (const s of SIZES) expect(gridTileHtml("collection", s, nova)).toMatch(/<b class="big">49<\/b><span class="of"[^>]*>of 124 cards/);
    expect(fact("collection", "S", nova, "completion")).toBe("49 of 124 cards");
    expect(fact("collection", "L", nova, "completion")).toBe("49 of 124 cards · 40%");
  });
  it("a new player: the starter named at S and L; at M the cards' label says it and the rare finds say where they come from", () => {
    expect(fact("collection", "S", wren, "completion")).toContain("your starter deck");
    expect(fact("collection", "M", wren, "completion")).not.toContain("starter");
    expect(fact("collection", "M", wren, "bestCards")).toContain("Your starter's best");
    expect(fact("collection", "M", wren, "chase")).toBe("Secrets and Prototypes come in packs.");
    expect(fact("collection", "L", wren, "chase")).toBe("Rare finds Secrets 0 of 19 Prototypes 0 of 15");
  });
  it("M draws three best cards and L five (fewer when fewer are held); the best first", () => {
    for (const c of collectionStateCases(data)) {
      const e = collectionExpect(c.data);
      expect(gridTileHtml("collection", "M", c.data).match(/class="mcard/g)?.length, c.id).toBe(e.m);
      expect(gridTileHtml("collection", "L", c.data).match(/class="mcard/g)?.length ?? 0, c.id).toBeGreaterThanOrEqual(e.l);
    }
    // The made-up Mythics with special finishes come first, the Prototype at the top.
    expect(fact("collection", "M", coll("five-factions"), "bestCards")).toMatch(/^Best cards 3 Patient Zero 2\/4 Prototype 6 Prime Aegis 4\/8 Gold/);
  });
  it("L's cards by faction has a row per faction held", () => {
    for (const c of collectionStateCases(data)) expect((gridTileHtml("collection", "L", c.data).match(/<li>/g) ?? []).length, c.id).toBe(collectionExpect(c.data).factions);
  });
});

describe("the Daily rewards tile", () => {
  it("S says 'of 90 today', M 'of 90 credits today', L the whole line; the next win's pay under it", () => {
    expect(fact("daily", "S", nova, "earnedToday")).toBe("65 of 90 today");
    expect(fact("daily", "M", nova, "earnedToday")).toBe("65 of 90 credits today");
    expect(fact("daily", "L", nova, "earnedToday")).toBe("65 of 90 credits from wins today");
    for (const s of SIZES) expect(gridTileHtml("daily", s, nova)).toMatch(/<div class="hstack">.*data-fact="earnedToday".*data-fact="nextWinPays"/s);
  });
  it("Claim free pack only when one waits; two waiting say nothing more comes until one is claimed", () => {
    for (const c of dailyStateCases(data)) for (const s of SIZES) {
      const h = gridTileHtml("daily", s, c.data);
      expect(h.includes(">Claim free pack<"), `${c.id} ${s}`).toBe(c.data.dailyPack.waiting > 0);
    }
    expect(fact("daily", "M", daily("two-packs"), "freePack")).toBe("2 free packs ready Claim one so the next can come.");
    expect(fact("daily", "S", daily("two-packs"), "freePack")).toBe("2 free packs ready");
    expect(fact("daily", "S", daily("claimed"), "freePack")).toBe("Free pack claimed");
  });
  it("every paid win in: no step marked as next, the line says so", () => {
    const d = daily("maxed");
    expect(dailyExpect(d).nowStep).toBe(-1);
    expect(gridTileHtml("daily", "L", d)).not.toMatch(/<li class="now"/);
    expect(fact("daily", "S", d, "nextWinPays")).toBe("All earned today");
    expect(fact("daily", "M", d, "nextWinPays")).toBe("All win pay earned");
  });
  it("the loss line never says a loss pays 0: once the paid losses are used it says so, and what losses paid today", () => {
    expect(fact("daily", "L", daily("losses"), "winSchedule")).toContain("Losses pay nothing more today (10 paid). 20 from losses today.");
    expect(fact("daily", "L", nova, "winSchedule")).toContain("A loss pays 2 (up to 10 a day). 4 from losses today.");
    for (const c of dailyStateCases(data)) expect(fact("daily", "L", c.data, "winSchedule"), c.id).not.toMatch(/loss pays 0/);
  });
  it("L lists today's paid wins with their pay and time (Sydney), the unpaid wins as one line, the losses as one", () => {
    expect(fact("daily", "L", nova, "paidToday")).toBe("Today's results +30 12:15 pm +10 1:22 pm +10 11:40 am +10 11:44 am +5 11:56 am +4 2 losses");
    const m = fact("daily", "L", daily("maxed"), "paidToday");
    expect(m).toContain("+2 wins more, unpaid");
    expect((gridTileHtml("daily", "L", daily("maxed")).match(/<li[ >]/g) ?? []).length - 3).toBe(dailyExpect(daily("maxed")).results);
    expect(fact("daily", "L", wren, "paidToday")).toContain("Switch your agent on in My agent");
  });
});
