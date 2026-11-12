// The store layout (render session 63; the Season 0 brief, section 2): the
// pure tiles (siteShop.ts), the sealed pack drawn from the pack opening's
// own plate and CSS, the countdown, and the page carrying the styles and
// the emblems. The store's real answers come from the game lane's owner API
// over an in-memory store, its own code unchanged.

import { describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { PACK_CSS, PACK_PAGE_PURE_SOURCE } from "../src/packPage.js";
import { LOADOUT_GLYPHS } from "../src/loadoutPicker.js";
import type { SiteStore } from "../src/site/siteApi.js";
import type { SitePacks } from "../src/site/siteBoard.js";
import { FACE_EXPORTS, FACE_SCRIPT, SEALED_PACK_CSS, boastGlyphSymbols, sealedPackRules } from "../src/site/siteFaces.js";
import { renderSitePage } from "../src/site/sitePage.js";
import {
  clockLeft,
  cosmeticGridHtml,
  cosmeticKind,
  cosmeticTiles,
  featuredTileId,
  packGridHtml,
  packPileHtml,
  packTiles,
  priceHtml,
  resetCountdownHtml,
  sealedPackHtml,
  tileHtml,
  type ShopArt,
} from "../src/site/siteShop.js";
import { SHOP_CSS } from "../src/site/siteShopCss.js";
import { widgetHtml, type WidgetData } from "../src/site/siteWidgets.js";

const pure = new Function(`${PACK_PAGE_PURE_SOURCE}; return { packPlateSvg };`)() as { packPlateSvg: (s: string) => string };
const ART: ShopArt = { plate: pure.packPlateSvg };

const NOW = Date.parse("2026-11-11T02:47:38.000Z");
const DAILY = { setCode: "S0", waiting: 1, cap: 2, day: "2026-11-11", timeZone: "Australia/Sydney", resetsAt: "2026-11-11T13:00:00.000Z", nextPackAt: "2026-11-11T13:00:00.000Z", claimedToday: 0, lastClaimedAt: null };
const PACKS: SitePacks = {
  offer: [{ setCode: "S0", name: "Season Zero", priceCredits: 100 }],
  bulkOpenCount: 10,
  unopened: [],
  pity: { packsSinceFullArt: 7, packsSinceMythic: 2, next: { fullArt: false, mythic: false } },
  dailyPack: DAILY,
};
const COS = (itemId: string, kind: string, price: number | null, owned = false, faction: string | null = null) => ({ itemId, kind, name: itemId, season: "S0", faction, priceCredits: price, description: "", owned });

/** The store as the game lane's owner API answers it, from a real store. */
function realStore(credits: number) {
  const store = EconomyStore.open(":memory:");
  const o = store.createAccount({ name: "tess", username: "tess", password: "a long test password" });
  if (credits) store.grantCredits?.(o.ownerId, credits, "test");
  const cosmetics = store.cosmeticsOnSale(o.ownerId);
  const daily = store.dailyPackStatus(o.ownerId);
  const wallet = store.wallet(o.ownerId);
  store.close();
  return { cosmetics, daily, wallet };
}

describe("the store's products as tiles", () => {
  it("the featured tile: the free daily pack while one waits, else the 10 packs", () => {
    expect(featuredTileId(PACKS)).toBe("daily");
    expect(featuredTileId({ ...PACKS, dailyPack: { ...DAILY, waiting: 0 } })).toBe("pack-10");
    // Nothing on sale and nothing to claim: the daily tile still leads (claimed, with its countdown).
    expect(featuredTileId({ offer: [], dailyPack: { ...DAILY, waiting: 0 } })).toBe("daily");
    const t = packTiles(PACKS, 250, NOW);
    expect(t.map((x) => `${x.id}:${x.size}`)).toEqual(["daily:feature", "pack-1:tall", "pack-10:tall"]);
    const after = packTiles({ ...PACKS, dailyPack: { ...DAILY, waiting: 0 } }, 250, NOW);
    expect(after.map((x) => `${x.id}:${x.size}`)).toEqual(["pack-10:feature", "daily:tall", "pack-1:tall"]);
    // Exactly one featured tile, every time.
    for (const w of [0, 1, 2]) for (const c of [0, 99, 100, 1000]) expect(packTiles({ ...PACKS, dailyPack: { ...DAILY, waiting: w } }, c, NOW).filter((x) => x.size === "feature")).toHaveLength(1);
  });
  it("prices are the server's: one pack its price, ten packs ten times it; greyed with how many credits short", () => {
    const [, one, ten] = packTiles(PACKS, 250, NOW);
    expect(one).toMatchObject({ price: 100, button: { act: "buy-packs", enabled: true, data: { set: "S0", count: "1" }, why: null } });
    expect(ten).toMatchObject({ price: 1000, button: { act: "buy-packs", enabled: false, data: { set: "S0", count: "10" }, why: "750 credits short" } });
    const rich = packTiles(PACKS, 1000, NOW);
    expect(rich[2]!.button.enabled).toBe(true);
    expect(packTiles({ ...PACKS, offer: [{ ...PACKS.offer[0]!, priceCredits: 135 }] }, 0, NOW)[2]!.price).toBe(1350);
    // No offer: only the daily pack (never a made-up price).
    expect(packTiles({ ...PACKS, offer: [] }, 0, NOW).map((x) => x.id)).toEqual(["daily"]);
  });
  it("the free daily pack: Claim while one waits (the count when two do), else greyed until the reset", () => {
    expect(packTiles(PACKS, 0, NOW)[0]).toMatchObject({ price: 0, badge: null, button: { act: "claim-daily", label: "Claim", enabled: true } });
    expect(packTiles({ ...PACKS, dailyPack: { ...DAILY, waiting: 2, nextPackAt: null } }, 0, NOW)[0]).toMatchObject({ badge: "×2 waiting", button: { label: "Claim (2)", enabled: true } });
    const claimed = packTiles({ ...PACKS, dailyPack: { ...DAILY, waiting: 0 } }, 0, NOW).find((x) => x.id === "daily")!;
    expect(claimed).toMatchObject({ size: "tall", price: null, badge: null, button: { label: "Claimed today", enabled: false, why: null } });
    // Render session 64: the same moment as the head's clock, in the same
    // ticking hh:mm:ss (data-until), not a second "10 h 12 min".
    expect(claimed.sub).toBe("Claimed today · the next in");
    expect(claimed.until).toEqual({ iso: DAILY.nextPackAt, text: "10:12:22" });
    const html = tileHtml(claimed);
    expect(html).toContain(`<small>Claimed today · the next in <b class="sh-clock" data-until="${DAILY.nextPackAt}">10:12:22</b></small>`);
    expect(html).not.toMatch(/h \d+ min/);
    // No next time from the server: the old words, and no clock.
    const noNext = packTiles({ ...PACKS, dailyPack: { ...DAILY, waiting: 0, nextPackAt: null } }, 0, NOW).find((x) => x.id === "daily")!;
    expect(noNext.until).toBeNull();
    expect(noNext.sub).toBe("Claimed today.");
    expect(tileHtml(noNext)).not.toContain("data-until");
    // A tile that can be claimed has no clock.
    expect(packTiles(PACKS, 0, NOW)[0]!.until).toBeNull();
  });
  it("cosmetics: the not-owned first in the server's order; owned shows Owned with no price; greyed when short", () => {
    const tiles = cosmeticTiles([COS("a", "coin", 300, true), COS("b", "boast", 300, false, "Cortex"), COS("c", "coin", 300)], 250);
    expect(tiles.map((t) => t.id)).toEqual(["cos-b", "cos-c", "cos-a"]);
    expect(tiles[0]).toMatchObject({ sub: "Victory boast · Cortex", price: 300, art: { kind: "boast", itemId: "b", faction: "Cortex" }, button: { act: "buy-cosmetic", enabled: false, why: "50 credits short", data: { item: "b", name: "b", price: "300" } } });
    expect(tiles[2]).toMatchObject({ owned: true, price: null, badge: "Owned", button: { label: "Owned", enabled: false } });
    expect(cosmeticTiles([COS("c", "coin", 300)], 300)[0]!.button.enabled).toBe(true);
    expect(cosmeticKind("coin")).toBe("Coin");
    expect(cosmeticKind("cardBack")).toBe("Card back");
  });
  it("the real store's cosmetics on sale become tiles, every one priced and buyable by its own id", () => {
    const r = realStore(0);
    expect(r.cosmetics.length).toBeGreaterThan(0);
    const tiles = cosmeticTiles(r.cosmetics as SiteStore["cosmetics"], 10_000);
    for (const [i, t] of tiles.entries()) {
      const c = r.cosmetics[i]!;
      expect(t.price).toBe(c.priceCredits);
      expect(t.button.data.item).toBe(c.itemId);
      expect(t.button.enabled).toBe(true);
      // Every boast on sale has the picker's emblem; every coin is the coin painter's.
      if (c.kind === "boast") expect(LOADOUT_GLYPHS[c.itemId], c.itemId).toBeTruthy();
      expect(tileHtml(t)).toContain(c.kind === "coin" ? `data-coin="${c.itemId}"` : `href="#lg-${c.itemId}"`);
    }
    // And the real daily pack status: its countdown is the server's reset time.
    expect(resetCountdownHtml(r.daily as SitePacks["dailyPack"], Date.now())).toContain(`data-until="${r.daily.resetsAt}"`);
  });
});

describe("a tile's markup", () => {
  it("the art first (with the price on it and the credits icon), the name, then the button underneath", () => {
    const [daily, one, ten] = packTiles(PACKS, 250, NOW);
    const h = tileHtml(one!, { art: ART });
    const order = ["sh-art", "spk", "sh-price", 'class="coin"', "<b>100</b>", "sh-info", "1 pack", "sh-act", 'data-act="buy-packs"'].map((x) => h.indexOf(x));
    expect(order.every((x) => x >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(h).toContain('aria-label="Buy 1 pack, 100 credits"');
    expect(tileHtml(daily!, { art: ART })).toContain('class="sh-price free">Free<');
    expect(tileHtml(daily!, { art: ART })).toMatch(/class="sh-t t-feature tone-free"/);
    const tenH = tileHtml(ten!, { art: ART });
    expect(tenH).toContain("×10");
    expect(tenH).toContain('<small class="sh-why">750 credits short</small>');
    expect(tenH).toMatch(/data-count="10" disabled/);
    expect(priceHtml(1350)).toContain("<b>1,350</b>");
    expect(priceHtml(null)).toBe("");
  });
  it("names are escaped; nothing undefined, NaN or null leaks", () => {
    const evil = cosmeticTiles([COS('<img src=x onerror="1">', "boast", 300, false, "Null")], 1000);
    const h = cosmeticGridHtml(evil, { art: ART });
    expect(h).not.toContain("<img");
    expect(h).toContain("&lt;img");
    for (const t of [...packTiles(PACKS, 0, NOW), ...packTiles({ ...PACKS, dailyPack: { ...DAILY, waiting: 0 } }, 5000, NOW), ...evil]) {
      for (const compact of [false, true]) expect(tileHtml(t, { art: ART, compact })).not.toMatch(/undefined|NaN|\[object|>null</);
    }
    expect(cosmeticGridHtml([])).toContain("No cosmetics on sale right now.");
    expect(packGridHtml(packTiles(PACKS, 0, NOW), { compact: true })).toContain('class="sh-grid compact"');
  });
});

describe("the sealed pack is the pack opening's own", () => {
  it("the plate is the pack page's packPlateSvg, the same for every pack of a set, and the page hands it over", () => {
    const h = sealedPackHtml("S0", 120, ART);
    expect(h).toContain(pure.packPlateSvg("S0"));
    expect(h).toContain('style="--pw:120px"');
    expect(h).toContain('<use href="#setsym"/>');
    expect(sealedPackHtml("S0", 60, ART)).toContain(pure.packPlateSvg("S0"));
    expect(pure.packPlateSvg("S1")).not.toBe(pure.packPlateSvg("S0"));
    // Without the art (the face script not there): the same pack, no plate, never broken.
    expect(sealedPackHtml("S0", 60, null)).not.toContain('class="pa"');
    expect(FACE_EXPORTS).toContain("packPlateSvg");
    expect(FACE_SCRIPT).toContain("packPlateSvg: packPlateSvg");
    expect(packPileHtml("S0", 90, 10, ART).match(/class="spk"/g)).toHaveLength(3);
  });
  it("the pack's CSS is cut from the pack page's own rules (wrapper, crimps, logo, emblem, set, plate), scoped to .spk", () => {
    const rules = sealedPackRules(PACK_CSS);
    for (const part of ["wrap", "crimp", "logo", "emb", "set", "meta", "pa"]) expect(rules.some((r) => r.startsWith(`.spk .${part}`)), part).toBe(true);
    // Nothing of the opening's tear, flap or grip, and nothing left unscoped.
    expect(rules.join("\n")).not.toMatch(/\.half|\.flap|\.grip|\.rip|\.leak|\.pack /);
    // The wrapper's gradient is the opening's, character for character.
    const wrap = /\.pack \.wrap \{([^}]*)\}/.exec(PACK_CSS)![1]!;
    expect(SEALED_PACK_CSS).toContain(wrap);
    expect(SHOP_CSS).toContain(SEALED_PACK_CSS);
  });
  it("boast emblems are the loadout picker's, as symbols on the page", () => {
    const sym = boastGlyphSymbols();
    for (const [id, g] of Object.entries(LOADOUT_GLYPHS)) expect(sym).toContain(`<symbol id="lg-${id}" viewBox="0 0 24 24">${g}</symbol>`);
    const page = renderSitePage();
    expect(page).toContain(sym);
    expect(page).toContain(SHOP_CSS);
  });
  it("motion is transforms and opacity only, and stops under reduce motion", () => {
    const kfs = [...SHOP_CSS.matchAll(/@keyframes [\w-]+ \{([\s\S]*?\})\s*\}/g)].map((m) => m[1]!);
    expect(kfs.length).toBeGreaterThan(0);
    for (const k of kfs) for (const [, prop] of k.matchAll(/([a-z-]+)\s*:/g)) expect(["transform", "opacity"]).toContain(prop);
    expect(SHOP_CSS).toMatch(/prefers-reduced-motion: reduce\) \{[^\n]*animation: none/);
  });
});

describe("the countdown to the daily reset", () => {
  it("a shop clock to the server's resetsAt, hours past 24 kept, never negative", () => {
    expect(clockLeft(NOW, DAILY.resetsAt)).toBe("10:12:22");
    expect(clockLeft(NOW, "2026-11-12T13:00:00.000Z")).toBe("34:12:22");
    expect(clockLeft(NOW + 36_742_000, DAILY.resetsAt)).toBe("00:00:00");
    expect(clockLeft(NOW + 99_999_999, DAILY.resetsAt)).toBe("00:00:00");
    expect(clockLeft(NOW, "not a time")).toBe("00:00:00");
    expect(clockLeft(Date.parse(DAILY.resetsAt) - 61_000, DAILY.resetsAt)).toBe("00:01:01");
  });
  it("the markup carries the reset time for the page's tick, and the zone's city", () => {
    const h = resetCountdownHtml(DAILY, NOW);
    expect(h).toContain(`data-until="${DAILY.resetsAt}">10:12:22<`);
    expect(h).toContain("midnight Sydney");
    expect(resetCountdownHtml(DAILY, NOW, { short: true })).toContain("Resets in");
  });
});

describe("the Store and Packs widgets at S, M and L (the brief's table)", () => {
  const D = (over: Partial<WidgetData> = {}): WidgetData => ({
    play: { connectedAgent: null } as unknown as WidgetData["play"],
    wallet: { credits: 250, packPoints: 0, unopenedPacks: [] },
    packs: { ...PACKS, unopened: Array.from({ length: 3 }, (_, i) => ({ packId: `p${i}`, setCode: "S0", source: "purchase", acquiredAt: "2026-11-10T00:00:00.000Z" })) },
    collection: { cards: [], recentPulls: [{ packId: "x", setCode: "S0", openedAt: "2026-11-10T03:00:00.000Z", jackpot: false, cards: [{ cardId: "c1", name: "Relay Courier", rarity: "Rare", finish: "foil", serial: null }] }] } as unknown as WidgetData["collection"],
    daily: null,
    store: { packs: PACKS.offer, dailyPack: DAILY, cosmetics: [COS("coin-s0-neon-nickel", "coin", 300)], wallet: { credits: 250, packPoints: 0, unopenedPacks: [] } } as SiteStore,
    live: null,
    history: null,
    ownerId: "o",
    errors: {},
    now: NOW,
    colFilter: "All",
    art: ART,
    ...over,
  });
  const at = (type: "store" | "packs", size: "S" | "M" | "L", d = D()) => widgetHtml({ id: "w", type, size }, d, { editing: false });
  it("Store: S claims the free pack (with the clock); M the product tiles; L the tiles, the cosmetics, the balance and the clock", () => {
    const s = at("store", "S");
    expect(s).toContain('data-act="claim-daily"');
    expect(s).toContain("data-until=");
    expect(s).not.toContain('data-act="buy-packs"');
    const m = at("store", "M");
    expect(m.match(/class="sh-t /g)).toHaveLength(3);
    expect(m).toContain('data-act="buy-packs"');
    expect(m).not.toContain("sh-bal");
    expect(m).not.toContain('data-act="buy-cosmetic"');
    const l = at("store", "L");
    expect(l).toContain("sh-bal");
    expect(l).toContain("data-until=");
    expect(l).toContain('data-act="buy-cosmetic" data-item="coin-s0-neon-nickel"');
    // Every size draws something different (the brief's principle).
    expect(new Set([s, m, l]).size).toBe(3);
    // Claimed: S says so, greyed.
    expect(at("store", "S", D({ packs: { ...D().packs!, dailyPack: { ...DAILY, waiting: 0 } } }))).toMatch(/data-act="claim-daily" disabled>Claimed today/);
  });
  it("Packs: S the pack, the count and Open; M bigger with Open 10 and the pity counters; L the last pulls too", () => {
    const s = at("packs", "S");
    expect(s).toContain("--pw:44px");
    expect(s).toContain('<p class="pkw-n">3<small>unopened</small></p>');
    expect(s).toContain('data-act="open-packs" data-count="1"');
    expect(s).not.toContain("pity");
    const m = at("packs", "M");
    expect(m).toContain("--pw:84px");
    expect(m).toContain('data-count="10" disabled');
    expect(m).toContain("<b>7</b> since a Full Art");
    expect(m).toContain("Open 10 needs 10 waiting.");
    expect(m).not.toContain("Relay Courier");
    const l = at("packs", "L");
    expect(l).toContain("Your last pulls");
    expect(l).toContain("Relay Courier");
    // A guaranteed pull reads as one.
    expect(at("packs", "M", D({ packs: { ...D().packs!, pity: { ...PACKS.pity, next: { fullArt: true, mythic: false } } } }))).toContain('class="sure"><b>Next</b> sure to hold a Full Art or better');
    // No packs: the pile greyed, Open greyed.
    expect(at("packs", "S", D({ packs: { ...PACKS } }))).toMatch(/pkw-pile none[\s\S]*data-count="1" disabled/);
  });
});
