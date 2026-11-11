// The store layout (render session 63; the owner's 2026-11-06 Season 0
// brief, section 2): the products as tiles of different sizes, the way an
// item shop places them, in the current AI·TCG look. Pure: no DOM, no
// fetch; the Store page, the Store widget and the Packs widget draw these
// strings, and the tests render them in Node.
//
// What it decides:
//  - which products there are (the brief: the free daily pack, 1 pack,
//    10 packs, and the cosmetics already on sale; nothing new), each one a
//    tile: its art, its name, its price on the tile with the credits icon,
//    and its button underneath, greyed with the reason when it can't be
//    bought;
//  - which tile is featured (the larger one): the free daily pack while one
//    can be claimed, else the 10 packs (`featuredTileId`);
//  - the countdown to the daily reset (midnight in the server's zone, the
//    server's `resetsAt`), as the page ticks it each second.
//
// Every number is the server's: the price, the ten-pack count, what waits,
// when the day turns. The art is the ceremony's own: the sealed pack is the
// pack opening's plate (packPage.ts packPlateSvg, handed in as `plate`, so
// there is no second copy of it), coins are drawn by the site's coin script,
// boasts by the loadout picker's emblems (symbols on the page).

import { coinSwatchHtml } from "./siteCoinSwatch.js";
import type { SiteStore } from "./siteApi.js";
import type { SitePacks } from "./siteBoard.js";
import { dailyPackView, zoneCity } from "./siteStore.js";
import { FACTION_HEX, esc } from "./siteModel.js";

/** The art the pure strings can't make themselves (handed in by the page). */
export interface ShopArt {
  /** The pack's plate SVG for a set (packPage.ts packPlateSvg). */
  plate(setCode: string): string;
}

/** Thousands with commas (siteLook.amount's rule; kept here so this module
 * stays light for the client bundle). */
function amount(n: number): string {
  const v = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ---- the sealed pack -----------------------------------------------------------

/** The sealed pack as the ceremony draws it: the wrapper's gradient, its
 * plate (the circuit field and the four faction marks), the crimps, the
 * AI·TCG logo, the set emblem, SEASON ZERO and the set code. `px` is its
 * width; the height is 1.6 times that, as on the opening. Without `art`
 * (a test, or the face script not loaded) it is the same pack without the
 * plate. */
export function sealedPackHtml(setCode: string, px: number, art: ShopArt | null | undefined, opts: { meta?: boolean } = {}): string {
  const plate = art ? art.plate(setCode) : "";
  const meta = opts.meta === false ? "" : `<div class="meta">${esc(setCode)}</div>`;
  return `<div class="spk" style="--pw:${Math.round(px)}px" aria-hidden="true"><div class="wrap">${plate ? `<div class="pa">${plate}</div>` : ""}<div class="crimp t"></div><div class="logo">AI·TCG</div><div class="emb"><svg><use href="#setsym"/></svg></div><div class="set">SEASON ZERO</div>${meta}<div class="crimp b"></div></div><span class="spk-foil"></span></div>`;
}

/** A pile of packs (the 10 packs tile): three packs fanned, the count on a
 * badge. */
export function packPileHtml(setCode: string, px: number, count: number, art: ShopArt | null | undefined): string {
  const one = sealedPackHtml(setCode, px, art, { meta: false });
  return `<div class="spile" aria-hidden="true"><span class="sp-l">${one}</span><span class="sp-r">${one}</span><span class="sp-c">${sealedPackHtml(setCode, px, art)}</span><b class="sp-n">×${count}</b></div>`;
}

// ---- the countdown -------------------------------------------------------------

/** Time left until `iso` as a shop clock: "05:12:04" (hours may pass 24);
 * "00:00:00" once it has passed or can't be read. */
export function clockLeft(nowMs: number, iso: string): string {
  const t = Date.parse(iso);
  const s = Number.isFinite(t) ? Math.max(0, Math.floor((t - nowMs) / 1000)) : 0;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

/** The store's countdown to the daily reset: a clock the page ticks each
 * second (`data-until`, the server's `resetsAt`), and the zone's city. */
export function resetCountdownHtml(dailyPack: SitePacks["dailyPack"], nowMs: number, opts: { short?: boolean } = {}): string {
  const city = zoneCity(dailyPack.timeZone);
  return `<span class="sh-reset" title="The day turns at midnight ${esc(city)} time: a new free pack, and the daily rewards start again"><span class="sh-clock-ic" aria-hidden="true"></span>${opts.short ? "Resets in" : "Daily reset in"} <b class="sh-clock" data-until="${esc(dailyPack.resetsAt)}">${clockLeft(nowMs, dailyPack.resetsAt)}</b>${opts.short ? "" : `<small>midnight ${esc(city)}</small>`}</span>`;
}

// ---- the tiles -----------------------------------------------------------------

export type TileSize = "feature" | "tall" | "item";
export type TileArt =
  | { kind: "daily"; setCode: string; waiting: number }
  | { kind: "pack"; setCode: string; count: number }
  | { kind: "coin"; itemId: string }
  | { kind: "boast"; itemId: string; faction: string | null }
  | { kind: "cosmetic"; faction: string | null };

export interface TileButton {
  act: "claim-daily" | "buy-packs" | "buy-cosmetic";
  label: string;
  enabled: boolean;
  primary: boolean;
  /** data-* on the button (the page's handlers read them). */
  data: Record<string, string>;
  /** Why it's greyed, under it. */
  why: string | null;
}

export interface ShopTile {
  /** "daily", "pack-1", "pack-10", or "cos-<item id>". */
  id: string;
  size: TileSize;
  name: string;
  /** The line under the name. */
  sub: string;
  art: TileArt;
  /** Credits, 0 for free; null when it isn't sold (an owned item shows no price). */
  price: number | null;
  /** A corner ribbon ("FREE", "×2 WAITING", "OWNED"). */
  badge: string | null;
  owned: boolean;
  button: TileButton;
}

/** The featured tile: the free daily pack while one can be claimed, else
 * the 10 packs (the brief's two examples), else the single pack. */
export function featuredTileId(p: Pick<SitePacks, "offer" | "dailyPack">): "daily" | "pack-10" | "pack-1" {
  if (p.dailyPack.waiting > 0) return "daily";
  return p.offer.length ? "pack-10" : "daily";
}

/** The pack tiles, the featured one first: the free daily pack, 1 pack and
 * 10 packs (bought as one purchase of 10, the server's own 1-to-10 rule). */
export function packTiles(p: Pick<SitePacks, "offer" | "dailyPack" | "bulkOpenCount">, credits: number, nowMs: number): ShopTile[] {
  const dv = dailyPackView(p.dailyPack, nowMs);
  const featured = featuredTileId(p);
  const daily: ShopTile = {
    id: "daily",
    size: featured === "daily" ? "feature" : "tall",
    name: "Free daily pack",
    sub: dv.canClaim ? (dv.waiting > 1 ? `${dv.waiting} waiting to be claimed · one a day` : "One a day, yours to claim") : dv.line,
    art: { kind: "daily", setCode: p.dailyPack.setCode, waiting: dv.waiting },
    // Claimed: no price and no ribbon; the button and the line under the
    // name say when the next one comes in.
    price: dv.canClaim ? 0 : null,
    badge: dv.waiting > 1 ? `×${dv.waiting} waiting` : null,
    owned: false,
    button: { act: "claim-daily", label: dv.canClaim ? (dv.waiting > 1 ? `Claim (${dv.waiting})` : "Claim") : "Claimed today", enabled: dv.canClaim, primary: true, data: {}, why: null },
  };
  const out: ShopTile[] = [daily];
  const offer = p.offer[0];
  if (offer) {
    const tile = (count: number): ShopTile => {
      const total = offer.priceCredits * count;
      const short = Math.max(0, total - credits);
      return {
        id: `pack-${count}`,
        size: featured === `pack-${count}` ? "feature" : "tall",
        name: count === 1 ? "1 pack" : `${count} packs`,
        sub: count === 1 ? `${offer.name} · 5 cards` : `${offer.name} · ${count * 5} cards`,
        art: { kind: "pack", setCode: offer.setCode, count },
        price: total,
        badge: null,
        owned: false,
        button: { act: "buy-packs", label: "Buy", enabled: short === 0, primary: count !== 1, data: { set: offer.setCode, count: String(count) }, why: short ? `${amount(short)} credits short` : null },
      };
    };
    out.push(tile(1), tile(10));
  }
  return out.sort((a, b) => (a.size === "feature" ? -1 : b.size === "feature" ? 1 : 0));
}

const KIND_WORDS: Record<string, string> = { boast: "Victory boast", coin: "Coin", cardBack: "Card back", avatar: "Avatar", arena: "Arena" };
/** A cosmetic's kind in words. */
export function cosmeticKind(kind: string): string {
  return KIND_WORDS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** The cosmetics on sale as tiles, in the server's order with the ones the
 * owner doesn't own yet first. An owned item keeps its tile (the owner sees
 * what's on sale) with "Owned" in place of its price. */
export function cosmeticTiles(cosmetics: SiteStore["cosmetics"], credits: number): ShopTile[] {
  const rows = cosmetics.map((c, i) => ({ c, i })).sort((a, b) => Number(a.c.owned) - Number(b.c.owned) || a.i - b.i);
  return rows.map(({ c }): ShopTile => {
    const price = c.owned ? null : c.priceCredits;
    const short = price === null ? 0 : Math.max(0, price - credits);
    const none: Record<string, string> = {};
    const art: TileArt = c.kind === "coin" ? { kind: "coin", itemId: c.itemId } : c.kind === "boast" ? { kind: "boast", itemId: c.itemId, faction: c.faction } : { kind: "cosmetic", faction: c.faction };
    return {
      id: `cos-${c.itemId}`,
      size: "item" as const,
      name: c.name,
      sub: `${cosmeticKind(c.kind)}${c.faction ? ` · ${c.faction}` : ""}`,
      art,
      price,
      badge: c.owned ? "Owned" : null,
      owned: c.owned,
      button: c.owned
        ? { act: "buy-cosmetic" as const, label: "Owned", enabled: false, primary: false, data: none, why: "Equip it with Change, under Your agents' loadouts." }
        : price === null
          ? { act: "buy-cosmetic" as const, label: "Not sold", enabled: false, primary: false, data: none, why: null }
          : { act: "buy-cosmetic" as const, label: "Buy", enabled: short === 0, primary: false, data: { item: c.itemId, name: c.name, price: String(price) }, why: short ? `${amount(short)} credits short` : null },
    };
  });
}

/** The pack's width on a tile, by tile size (and smaller in a widget). */
function packPx(size: TileSize, compact: boolean): number {
  if (compact) return size === "feature" ? 56 : 52;
  return size === "feature" ? 150 : 104;
}

function artHtml(t: ShopTile, art: ShopArt | null | undefined, compact: boolean): string {
  const a = t.art;
  const px = packPx(t.size, compact);
  switch (a.kind) {
    case "daily":
      return sealedPackHtml(a.setCode, px, art);
    case "pack":
      return a.count > 1 ? packPileHtml(a.setCode, px * 0.86, a.count, art) : sealedPackHtml(a.setCode, px, art);
    case "coin":
      return coinSwatchHtml(a.itemId, compact ? { w: 110, h: 60 } : { w: 168, h: 104 });
    case "boast":
      return `<span class="sh-emb" aria-hidden="true"><svg viewBox="0 0 24 24"><path class="sh-hex" d="M12 1.6 21 6.8v10.4L12 22.4 3 17.2V6.8z"/><g class="sh-glyph" transform="translate(5.4 5.4) scale(.55)"><use href="#lg-${esc(a.itemId)}"/></g></svg></span>`;
    case "cosmetic":
      return `<span class="sh-emb" aria-hidden="true"><svg viewBox="0 0 24 24"><path class="sh-hex" d="M12 1.6 21 6.8v10.4L12 22.4 3 17.2V6.8z"/></svg></span>`;
  }
}

function toneOf(t: ShopTile): { cls: string; hex: string | null } {
  const a = t.art;
  if (a.kind === "daily") return { cls: "tone-free", hex: null };
  if (a.kind === "pack") return { cls: "tone-pack", hex: null };
  if (a.kind === "coin") return { cls: "tone-coin", hex: null };
  return { cls: "tone-fac", hex: (a.faction && FACTION_HEX[a.faction]) || "#8f8cff" };
}

/** The price on the tile: the credits icon and the number, or FREE. */
export function priceHtml(price: number | null): string {
  if (price === null) return "";
  return price === 0 ? `<span class="sh-price free">Free</span>` : `<span class="sh-price"><i class="coin" aria-hidden="true"></i><b>${amount(price)}</b><span class="vh"> credits</span></span>`;
}

/** One tile: the art as the hero (its price on it, its ribbon in the
 * corner), the name and line, and the button underneath. */
export function tileHtml(t: ShopTile, opts: { art?: ShopArt | null; compact?: boolean } = {}): string {
  const tone = toneOf(t);
  const b = t.button;
  const data = Object.entries(b.data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  const label = b.act === "buy-cosmetic" && b.enabled ? `Buy ${t.name}` : b.act === "buy-packs" && b.enabled ? `Buy ${t.name}` : b.label;
  const btn = `<button type="button" class="btn${b.primary || t.size === "feature" ? " pri" : ""} sh-buy" data-act="${b.act}"${data}${b.enabled ? "" : " disabled"} aria-label="${esc(label)}${t.price ? `, ${amount(t.price)} credits` : ""}">${esc(b.label)}</button>`;
  const why = b.why && !b.enabled ? `<small class="sh-why">${esc(b.why)}</small>` : "";
  const style = tone.hex ? ` style="--c:${tone.hex}"` : "";
  return `<article class="sh-t t-${t.size} ${tone.cls}${t.owned ? " owned" : ""}" data-tile="${esc(t.id)}"${style}>`
    + `<div class="sh-art">${artHtml(t, opts.art, !!opts.compact)}${t.badge ? `<span class="sh-badge">${esc(t.badge)}</span>` : ""}${priceHtml(t.price)}</div>`
    + `<div class="sh-info"><b class="sh-n">${esc(t.name)}</b>${opts.compact && t.size !== "feature" ? "" : `<small>${esc(t.sub)}</small>`}</div>`
    + `<div class="sh-act">${btn}${why}</div></article>`;
}

/** The pack tiles' grid (the featured tile two columns wide, the others one). */
export function packGridHtml(tiles: ShopTile[], opts: { art?: ShopArt | null; compact?: boolean } = {}): string {
  return `<div class="sh-grid${opts.compact ? " compact" : ""}">${tiles.map((t) => tileHtml(t, opts)).join("")}</div>`;
}

/** The cosmetics' grid (every tile one size). */
export function cosmeticGridHtml(tiles: ShopTile[], opts: { art?: ShopArt | null; compact?: boolean } = {}): string {
  if (!tiles.length) return `<p class="muted small">No cosmetics on sale right now.</p>`;
  return `<div class="sh-items${opts.compact ? " compact" : ""}">${tiles.map((t) => tileHtml(t, opts)).join("")}</div>`;
}

/** The credits the owner has, as the store's balance chip. */
export function balanceHtml(credits: number): string {
  return `<span class="sh-bal"><i class="coin" aria-hidden="true"></i><b>${amount(credits)}</b> credits</span>`;
}
