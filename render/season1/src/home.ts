// The Season 1 Home, in direction B on the owner's uniform grid (render
// session 86; phase 2 of the owner's 2026-11-22 plan, item 19: "the S / M / L
// tile framework and the navigation in the chosen direction"). The owner picked
// mockup B, "the headline first" (2026-11-23), on a uniform grid of one square
// unit: S 1x1, M 2x1, L 2x2, Watch live in tall shapes (homeGrid.ts). Mockups A
// and C are retired (their stills stay in progress/render/evidence/).
//
// What B is (render 84), kept:
//   - Season 0's look: frosted glass over the glacier background, light by
//     default (the owner's call 4, 2026-11-23) with dark as the option,
//     coloured icon chips, My agent and Watch live as deep-indigo hero tiles,
//     Season 0's pack and coin art; the cyberpunk / retro-future vibe as
//     accents (a chrome wordmark, a faint circuit grid and a synth horizon
//     behind the glass, monospace kickers, a static scan sheen).
//   - Each tile leads with its answer: the first fact drawn big beside a
//     picture of it, then the details. The tile's question sits behind a "?"
//     (now an overlay, so opening it never changes the tile's size).
//   - The top bar: the brand, the five places, Settings and the account. On a
//     phone the places drop into a row under the brand.
// What render 86 changes:
//   - Every tile is one of the grid's shapes; its height is the grid's, not its
//     content's. Each shape has its own anatomy so the content fills it: S a
//     square (the headline over the details), M a wide band (the headline in a
//     column on the left, the details in columns on the right), L a big square
//     (the headline across the top, the details in columns). The pictures and
//     headline type scale with the tile (container query units), so a tile on a
//     phone is the same design, smaller.
//   - Watch live in the owner's three shapes (homeFacts.ts liveMatch and
//     liveArena): S basic info, M the arena with names and health bars over
//     it, L the scoreboard above the whole 9:16 arena with the turn line and
//     both hands.
//
// Pure: data in, an HTML string out. The data is the real Season 0 owner
// API's answers (season1/mockup/data/home-data.json).

import { ICONS, esc, icon } from "../../src/site/siteModel.js";
import { BACKGROUNDS } from "../../src/site/siteLook.js";
import { TIER_HEX } from "../../src/site/siteStanding.js";
import { TILES, type Size } from "./homeSpec.js";
import { GRID_GAP, GRID_JS, PHONE_GAP } from "./homeGrid.js";
import { dayMost, homeArt, isPlaced, nextAction, sealedPack, tileFacts, type HomeData, type OwnerData } from "./homeFacts.js";
import { MOCK_STRIP_CSS, OPEN_LABEL, PLACES, SHELL_SCRIPT, boardsWith, editControls, mockStrip, opensOf, ownersPayload, payloadJson, type Board } from "./homeShell.js";

/** Each tile's colour (its icon chip, its ring, its glow), Season 0's. */
export const B_TONE: Record<string, string> = { agent: "#4f6bff", ladder: "#f0b43c", watch: "#ff4d6d", packs: "#ff9f43", store: "#e9a91c", collection: "#7c5cff", daily: "#22c58b", history: "#2fa8f0", notif: "#ff5f9e", music: "#9b8cff" };
const TILE_ICON: Record<string, string> = { agent: ICONS.match, ladder: ICONS.trophy, watch: ICONS.eye, packs: ICONS.spark, store: ICONS.store, collection: ICONS.col, daily: ICONS.stats, history: ICONS.list, notif: ICONS.bell, music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>' };
const svg = (paths: string, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
/** The hero tiles, in deep indigo glass (Season 0's My agent look). */
const HERO = new Set(["agent", "watch"]);

/** The recommended first board, on the grid (render 86): the agent and the
 * match lead, the things to do next beside and under them. On four columns it
 * packs into four whole rows with no hole (a test checks): My agent, Watch
 * live (1x2) and Daily rewards on top; Packs, Notifications and Collection
 * beside Watch live; Ladder at L under them, with Store and Match history
 * beside it. Nine tiles; Music waits on its spec. */
export const HOME_RECOMMENDED: Board = [
  { tile: "agent", size: "M" },
  { tile: "watch", size: "M" },
  { tile: "daily", size: "S" },
  { tile: "packs", size: "S" },
  { tile: "notif", size: "S" },
  { tile: "ladder", size: "L" },
  { tile: "store", size: "M" },
  { tile: "collection", size: "S" },
  { tile: "history", size: "M" },
];
export const HOME_BOARDS = boardsWith(HOME_RECOMMENDED);

/** A ring (conic) around a short label: the picture for a share of a whole.
 * Decoration: the number it draws is the headline fact's, in the same tile. */
const ring = (pct: number, tone: string, inner: string) => `<span class="ring" style="--p:${Math.max(0, Math.min(100, pct)).toFixed(1)};--c:${tone}" aria-hidden="true"><span>${inner}</span></span>`;

/** The picture beside a tile's headline (aria-hidden: the facts carry the
 * words). Only what the tile's own facts say, drawn. */
export function heroArt(tileId: string, d: OwnerData): string {
  switch (tileId) {
    case "packs": {
      const n = d.packs.unopened.length;
      const setCode = d.packs.offer[0]?.setCode ?? "S0";
      if (!n) return `<span class="art pk-none" aria-hidden="true"></span>`;
      return `<span class="art pk-fan n${Math.min(3, n)}" aria-hidden="true">${Array.from({ length: Math.min(3, n) }, () => sealedPack(setCode, 40)).join("")}</span>`;
    }
    case "daily": {
      const most = dayMost(d);
      return ring(most ? (100 * d.daily.creditsFromWins) / most : 0, B_TONE.daily!, svg(ICONS.stats, 16));
    }
    case "collection": {
      const b = d.collection.sets[0]!.base;
      return ring((100 * b.held) / b.total, B_TONE.collection!, svg(ICONS.col, 16));
    }
    case "ladder": {
      const t = isPlaced(d) ? d.rating.rating.tier : "Placement";
      const c = TIER_HEX[t] ?? "#9aa0b8";
      return `<span class="art badge" style="--c:${c}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 1.8 21 7v10l-9 5.2L3 17V7z"/><path d="M12 6.5 16.5 9v6L12 17.5 7.5 15V9z" class="in"/></svg></span>`;
    }
    case "notif":
      return `<span class="art bellart${d.notifications.unread ? " on" : ""}" aria-hidden="true">${svg(ICONS.bell, 26)}</span>`;
    case "history": {
      const m = d.matches.matches[0];
      return `<span class="art res-art ${m ? m.result : "none"}" aria-hidden="true">${m ? (m.result === "win" ? "W" : m.result === "loss" ? "L" : "D") : "–"}</span>`;
    }
  }
  return "";
}

/** How many of a tile's first facts make its headline (1 unless named): the
 * Store's credits and what they buy belong together; Ladder's rating, tier and
 * place are one answer ("where do I stand?"), and at M that frees the details'
 * columns for a new player's longer placement lines. */
const HEAD_FACTS: Record<string, number> = { store: 2, ladder: 3 };

/** One tile, drawn at one size for one owner. The tile's frame is the grid's
 * (the page places it); what is inside is laid out for its shape. */
export function tileHtml(tileId: string, size: Size, d: OwnerData): string {
  const t = TILES.find((x) => x.id === tileId)!;
  const act = nextAction(t, size, d);
  const opens = opensOf(t.id);
  const waiting = t.status === "waiting on owner";
  const facts = tileFacts(t, size, d);
  const isAct = (f: string) => f.startsWith('<div class="fx act"');
  const rest = facts.filter((f) => !isAct(f));
  const tone = B_TONE[t.id] ?? "#8b5cff";
  // Watch live: at M the arena is the tile, with the names and health bars
  // laid over it; at L the scoreboard is the headline and the arena under it.
  let headline: string, body: string;
  if (t.id === "watch" && size !== "S") {
    const [match, arena] = rest;
    headline = size === "L" ? `<div class="headline">${match}</div>` : "";
    body = `<div class="body stage">${size === "M" ? match : ""}${arena}</div>`;
  } else {
    const n = HEAD_FACTS[t.id] ?? 1;
    const head = rest.slice(0, n), more = rest.slice(n);
    headline = `<div class="headline">${heroArt(t.id, d)}${n > 1 ? `<div class="hstack">${head.join("")}</div>` : head.join("")}</div>`;
    body = `<div class="body">${more.join("")}</div>`;
  }
  return `<article class="tile s-${size}${HERO.has(t.id) ? " hero" : ""}${waiting ? " waiting" : ""}" data-tile="${t.id}" data-size="${size}" style="--c:${tone}" aria-labelledby="h-${t.id}">` +
    `<header><span class="ic">${svg(TILE_ICON[t.id] ?? ICONS.spark)}</span><h3 id="h-${t.id}">${esc(t.name)}</h3>` +
    `<button type="button" class="qb" aria-expanded="false" aria-controls="q-${t.id}" aria-label="What is ${esc(t.name)} for?">?</button>` +
    (waiting ? `<span class="wo">Waiting on owner</span>` : `<a class="open" href="#/${opens}" data-go="${opens}" aria-label="${esc(OPEN_LABEL[t.id] ?? "Open")}">${svg(ICONS.arrow, 16)}</a>`) +
    editControls(t.name, size) + `</header>` +
    `<p class="q" id="q-${t.id}">${esc(t.question)}</p>` +
    headline + body +
    `<footer>${facts.some(isAct) ? facts.filter(isAct).join("") : `<button type="button" class="btn ${act.primary ? "pri" : ""}" data-go="${act.to}"${act.disabled ? " disabled" : ""}>${esc(act.label)}</button>`}</footer>` +
    `</article>`;
}

const rgb = (c: readonly number[]) => `rgb(${c.map((x) => Math.round(x * 255)).join(",")})`;

export function homePage(data: HomeData): string {
  const owners = ownersPayload(data, tileHtml);
  const g = BACKGROUNDS.glacier as unknown as { light: number[][]; dark: number[][] };
  const pages = PLACES.map((p) => ({ ...p, from: [...p.from].map((id) => TILES.find((t) => t.id === id)!.name) }));
  const art = homeArt();
  const payload = payloadJson({ owners, boards: HOME_BOARDS, pages, takenAt: data.takenAt, theme: "light", tz: Object.values(data.owners)[0]!.daily.timeZone });
  const places = PLACES.map((p) => `<a href="#/${p.id}" data-go="${p.id}" class="nav">${icon(p.icon as keyof typeof ICONS, 18)}<span>${p.name}</span></a>`).join("");
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Season 1 Home</title>
<style>
:root { color-scheme: light; --ink: #141a33; --muted: #4f5a78; --line: rgba(60,70,120,.14); --accent: #4f6bff; --accent2: #8b5cff;
  --glass: rgba(255,255,255,.46); --glass-edge: rgba(255,255,255,.66); --shadow: 0 10px 34px rgba(50,40,140,.16), inset 0 1px 0 rgba(255,255,255,.75);
  --soft: rgba(255,255,255,.55); --soft-edge: inset 0 1px 0 rgba(255,255,255,.8); --ok: #1f9a56; --live: #e8355a; --warn: #b8690f; --gap: ${GRID_GAP}px; --qbg: #f4f6ff;
  --grid-line: rgba(79,107,255,.09); --horizon: rgba(139,92,255,.22);
  --bg: radial-gradient(1200px 800px at 12% 8%, ${rgb(g.light[1]!)}, transparent 60%), radial-gradient(900px 700px at 88% 24%, ${rgb(g.light[2]!)}, transparent 62%), radial-gradient(1000px 900px at 50% 100%, ${rgb(g.light[3]!)}, transparent 60%), ${rgb(g.light[0]!)}; }
:root[data-theme="dark"] { color-scheme: dark; --ink: #eef1ff; --muted: #a3acd0; --line: rgba(255,255,255,.1); --accent: #6f86ff;
  --glass: rgba(24,28,66,.46); --glass-edge: rgba(255,255,255,.12); --shadow: 0 10px 34px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.14);
  --soft: rgba(255,255,255,.09); --soft-edge: inset 0 1px 0 rgba(255,255,255,.12); --qbg: #1a1f4a; --ok: #4fd98a; --live: #ff5d7a; --warn: #f0a54a;
  --grid-line: rgba(120,140,255,.07); --horizon: rgba(139,92,255,.3);
  --bg: radial-gradient(1200px 800px at 12% 8%, ${rgb(g.dark[1]!)}, transparent 60%), radial-gradient(900px 700px at 88% 24%, ${rgb(g.dark[2]!)}, transparent 62%), radial-gradient(1000px 900px at 50% 100%, ${rgb(g.dark[3]!)}, transparent 60%), ${rgb(g.dark[0]!)}; }
* { box-sizing: border-box; }
html { background: var(--bg); background-attachment: fixed; min-height: 100%; }
html, body { margin: 0; }
body { font: 14px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif; color: var(--ink); min-height: 100vh; position: relative; }
/* The world behind the glass: a faint circuit grid and a synth horizon (the retro-future accent; static). */
body::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: linear-gradient(var(--grid-line) 1px, transparent 1px) 0 0 / 44px 44px, linear-gradient(90deg, var(--grid-line) 1px, transparent 1px) 0 0 / 44px 44px;
  mask: linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent); }
body::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 60vh; z-index: -1; pointer-events: none; background: radial-gradient(ellipse 50% 60% at 50% 100%, var(--horizon), transparent 70%); }
body { overflow-x: hidden; }
button { font: inherit; color: inherit; }
${MOCK_STRIP_CSS}
.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
/* The top bar. */
.topnav { position: sticky; top: 0; z-index: 10; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: 10px 26px; background: var(--glass); border-bottom: 1px solid var(--glass-edge); box-shadow: 0 6px 24px rgba(40,40,120,.08); backdrop-filter: blur(26px) saturate(180%); -webkit-backdrop-filter: blur(26px) saturate(180%); }
.brand { display: flex; align-items: baseline; gap: 8px; text-decoration: none; color: inherit; }
.brand b { font: 900 21px/1 system-ui, sans-serif; letter-spacing: .02em; background: linear-gradient(180deg, #2b3a8f, #6a4cff 55%, #2fa8f0); -webkit-background-clip: text; background-clip: text; color: transparent; }
:root[data-theme="dark"] .brand b { background-image: linear-gradient(180deg, #fff 0%, #bfe3ff 45%, #6a8cff 58%, #e6d2ff 100%); filter: drop-shadow(0 0 8px rgba(110,140,255,.45)); }
.brand small { font: 700 10.5px ui-monospace, Menlo, monospace; letter-spacing: .24em; color: #c58a12; }
.places { display: flex; gap: 4px; padding: 4px; border-radius: 16px; background: var(--soft); box-shadow: var(--soft-edge); }
.nav { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 12px; color: var(--muted); text-decoration: none; font: 650 14px system-ui, sans-serif; white-space: nowrap; }
.nav:hover { color: var(--ink); }
.nav[aria-current="page"] { color: #fff; background: linear-gradient(135deg, var(--accent), var(--accent2)); box-shadow: 0 6px 16px rgba(79,107,255,.35); }
.right { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.right .nav.set { padding: 8px; } .right .nav.set span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.wallet, .bell { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; background: var(--soft); box-shadow: var(--soft-edge); font-weight: 650; text-decoration: none; color: inherit; white-space: nowrap; }
.bell b { background: var(--live); color: #fff; border-radius: 999px; padding: 0 6px; font-size: 11px; }
.acct { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; }
main { padding: 22px 26px 48px; max-width: 1440px; margin: 0 auto; min-width: 0; }
.top { display: flex; align-items: flex-end; gap: 12px; margin-bottom: 16px; }
.top h1 { font: 800 26px/1.1 system-ui, sans-serif; margin: 0; letter-spacing: -.01em; }
.top .kick { display: block; font: 700 11px ui-monospace, Menlo, monospace; letter-spacing: .18em; color: var(--muted); text-transform: uppercase; margin-bottom: 4px; }
.top .sp { flex: 1; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; background: var(--soft); box-shadow: var(--soft-edge); border-radius: 12px; padding: 9px 16px; font: 700 14px system-ui, sans-serif; cursor: pointer; white-space: nowrap; color: var(--ink); }
.btn.pri { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; box-shadow: 0 6px 16px rgba(79,107,255,.3); }
.btn.sm { padding: 4px 10px; font-size: 12.5px; border-radius: 9px; }
.btn:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
/* The board: one square unit (homeGrid.ts); the script sets --cols and --unit
   from the board's width and places every tile at its column and row. */
.grid { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); grid-auto-rows: var(--unit, 320px); gap: var(--gap); }
.tile { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr) auto; grid-template-areas: "hd" "hl" "bd" "ft"; gap: 8px; min-width: 0; min-height: 0; padding: 14px 16px; border-radius: 24px; background: var(--glass); border: 1px solid var(--glass-edge); box-shadow: var(--shadow); backdrop-filter: blur(28px) saturate(180%); -webkit-backdrop-filter: blur(28px) saturate(180%); overflow: hidden; container: tile / size;
  --z: 1.25; --zt: 1.3; }
.tile > header { grid-area: hd; } .tile > .headline { grid-area: hl; } .tile > .body { grid-area: bd; } .tile > footer { grid-area: ft; }
/* M, a wide band: the headline in a column on the left, the details in columns on the right. */
.s-M { grid-template-columns: minmax(0, 36%) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; grid-template-areas: "hd hd" "hl bd" "hl ft"; column-gap: 18px; --z: 1.45; --zt: 1.3; }
.s-M > .headline { flex-direction: column; align-items: flex-start; justify-content: center; align-self: stretch; }
/* L, a big square: the headline across the top, the details in columns. */
.s-L { --z: 1.75; --zt: 1.55; row-gap: 12px; }
/* Watch live at M and L: one column, the arena's stage taking the rest. */
.tile[data-tile="watch"]:not(.s-S) { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr) auto; grid-template-areas: "hd" "hl" "bd" "ft"; }
/* S, a square: the headline in the middle, big, over the details. */
.s-S { grid-template-rows: auto minmax(0, 1fr) auto auto; --z: 1.55; --zt: 1.4; }
.s-S > .headline { align-self: center; }
.s-S > .body { justify-content: flex-end; }
/* A small tile (a phone's S): the same design, smaller. */
@container tile (max-width: 250px) { .tile > * { --z: .8; --zt: .78; } }
.tile.hero { color: #fff; --muted: #c6cbe8; --soft: rgba(255,255,255,.12); --soft-edge: inset 0 1px 0 rgba(255,255,255,.14); border-color: rgba(255,255,255,.2);
  background: linear-gradient(140deg, color-mix(in srgb, var(--c) 34%, rgba(20,24,58,.84)), rgba(16,20,50,.82) 68%); }
.tile.hero .btn:not(.pri) { color: #fff; }
/* A scan sheen on the hero glass (static: no flashing). */
.tile.hero::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(180deg, rgba(255,255,255,.035) 0 1px, transparent 1px 4px); mask: linear-gradient(160deg, #000, transparent 60%); }
.tile header { display: flex; align-items: center; gap: 9px; position: relative; }
.tile .ic { width: 30px; height: 30px; flex: none; display: grid; place-items: center; border-radius: 10px; color: #fff; background: linear-gradient(135deg, var(--c), color-mix(in srgb, var(--c) 60%, #3b1d8f)); box-shadow: 0 4px 12px color-mix(in srgb, var(--c) 40%, transparent); }
.tile h3 { margin: 0; font: 750 14.5px system-ui, sans-serif; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qb { width: 24px; height: 24px; flex: none; border-radius: 50%; border: 0; background: var(--soft); box-shadow: var(--soft-edge); font: 800 12px system-ui; color: var(--muted); cursor: pointer; }
.qb[aria-expanded="true"] { background: var(--c); color: #fff; }
.open { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 9px; color: var(--muted); }
.open:hover { background: var(--soft); color: var(--ink); }
.wo { font-size: 11px; font-weight: 700; color: var(--warn); border: 1px solid currentColor; border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
.edit { display: inline-flex; gap: 2px; } .edit[hidden] { display: none; } .edit button { border: 1px solid var(--line); background: var(--soft); border-radius: 6px; padding: 1px 6px; font-size: 11px; cursor: pointer; }
.edit button[aria-pressed="true"] { background: var(--accent); color: #fff; }
.editing .tile { outline: 2px dashed var(--accent); outline-offset: -5px; }
/* The question, behind the "?": laid over the tile under its header, so the tile keeps its size. */
.q { display: none; position: absolute; z-index: 3; left: 12px; right: 12px; top: 50px; margin: 0; padding: 9px 12px; border-radius: 12px; font-size: 13px; line-height: 1.35; color: var(--ink); background: color-mix(in srgb, var(--c) 16%, var(--qbg)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 40%, transparent), 0 8px 24px rgba(20,20,60,.2); }
.tile.qopen .q { display: block; }
/* The headline: the tile's answer, big, with its picture. */
.headline { display: flex; align-items: center; gap: 12px; min-width: 0; }
.headline > .fx { flex: 1; min-width: 0; }
.s-M > .headline > .fx, .s-M > .headline > .hstack { flex: none; width: 100%; }
.hstack { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.headline .big { font: 850 calc(30px * var(--zt)) / 1.05 system-ui, sans-serif; letter-spacing: -.02em; }
.headline > .art, .headline > .ring { zoom: var(--z); }
.headline .row > span:not(.ava):not(.bar) { color: var(--muted); font-weight: 600; }
.body { display: flex; flex-direction: column; justify-content: space-evenly; gap: 9px; min-width: 0; min-height: 0; }
.s-M .body, .s-L .body { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 9px 18px; align-content: space-evenly; }
.tile footer { display: flex; justify-content: flex-end; align-items: flex-end; }
.fx { min-width: 0; }
.fx.row { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; } .fx.row.wrap { flex-wrap: wrap; }
.fx.kv { display: flex; flex-direction: column; gap: 2px; } .fx.blk { display: flex; flex-direction: column; gap: 5px; }
.fx.act { display: flex; }
.s-M :is([data-fact="recentMatches"], [data-fact="alerts"], [data-fact="winSchedule"], [data-fact="lastPulls"], [data-fact="bestCards"], [data-fact="cosmetics"], [data-fact="liveArena"]) { grid-column: 1 / -1; }
.s-L :is([data-fact="recentMatches"], [data-fact="alerts"], [data-fact="personality"], [data-fact="lastPulls"], [data-fact="winSchedule"], [data-fact="trend"]) { grid-column: span 2; }
.s-L :is(.al, .styles) { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 16px; }
.al li { flex-wrap: nowrap; } .al li > span { min-width: 0; }
[data-fact="agentStatus"] { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.lab { font: 700 10.5px ui-monospace, "SF Mono", Menlo, monospace; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); }
.big { font-size: 24px; font-weight: 800; letter-spacing: -.02em; line-height: 1.05; }
.sub { color: var(--muted); font-size: 12.5px; }
.ava { width: 52px; height: 52px; flex: none; color: #dfe6ff; filter: drop-shadow(0 0 10px color-mix(in srgb, var(--c) 70%, transparent)); } .ava svg { width: 100%; height: 100%; display: block; }
.headline .ava { width: calc(46px * var(--z)); height: calc(46px * var(--z)); } .headline [data-fact="agentName"] .big { font-size: calc(21px * var(--zt)); }
.s-M .headline [data-fact="agentName"] { flex-direction: column; align-items: flex-start; }
.pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-weight: 750; font-size: 12.5px; background: var(--soft); }
.pill.live { color: var(--live); box-shadow: inset 0 0 0 1.5px var(--live); } .pill.ok { color: var(--ok); box-shadow: inset 0 0 0 1.5px var(--ok); } .pill.warn { color: var(--warn); box-shadow: inset 0 0 0 1.5px var(--warn); }
.tile.hero .pill.live { color: #ff8aa0; box-shadow: inset 0 0 0 1.5px #ff8aa0; } .tile.hero .pill.ok { color: #7ff0ae; box-shadow: inset 0 0 0 1.5px #7ff0ae; }
.tier { display: inline-block; padding: 2px 10px; border-radius: 999px; font-weight: 750; color: color-mix(in srgb, var(--tc) 70%, var(--ink)); box-shadow: inset 0 0 0 1.5px var(--tc); background: color-mix(in srgb, var(--tc) 14%, transparent); }
.tier.sm { font-size: 11px; padding: 0 7px; margin-left: auto; }
.bar { display: block; height: 7px; border-radius: 999px; background: var(--soft); box-shadow: inset 0 0 0 1px var(--line); overflow: hidden; flex: 1 1 100%; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--c, var(--accent)), var(--accent2)); border-radius: inherit; }
.up { color: var(--ok); font-weight: 700; } .down { color: var(--warn); font-weight: 700; }
.dots { display: flex; gap: 3px; flex-wrap: wrap; }
.dot { width: 19px; height: 19px; border-radius: 6px; display: grid; place-items: center; font-style: normal; font-size: 10px; font-weight: 800; color: #fff; background: #9aa0b8; }
.dot.win { background: #2fae66; } .dot.loss { background: #ff5d73; }
.lad, .list, .steps, .bars, .styles { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.lad li { display: flex; gap: 8px; align-items: center; padding: 4px 9px; border-radius: 10px; background: var(--soft); box-shadow: var(--soft-edge); }
.lad li span { margin-left: auto; color: var(--muted); } .lad li.me { box-shadow: inset 0 0 0 1.5px var(--accent); }
.list li { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.mh li { flex-wrap: nowrap; } .mh li > span:nth-child(2) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.res { font-weight: 800; } .res.win { color: var(--ok); } .res.loss { color: var(--live); }
.mh .res { width: 20px; }
.al li.new::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--c); flex: none; align-self: center; }
.to { color: var(--accent); font-weight: 650; text-decoration: none; cursor: pointer; font-size: 12.5px; } .to::after { content: " →"; }
.steps { flex-direction: row; flex-wrap: wrap; gap: 4px; } .steps li { padding: 4px 9px; border-radius: 10px; background: var(--soft); box-shadow: var(--soft-edge); display: flex; flex-direction: column; font-size: 12px; }
.steps li.done { opacity: .55; } .steps li.now { box-shadow: inset 0 0 0 1.5px var(--c); }
.bars li { display: grid; grid-template-columns: 62px 1fr auto; gap: 8px; align-items: center; font-size: 12.5px; }
.styles li { font-size: 12px; color: var(--muted); } .styles li b { color: var(--ink); } .styles li.on b::after { content: " ✓"; color: var(--ok); }
.chips { display: flex; flex-wrap: wrap; gap: 4px; } .chip { padding: 2px 9px; border-radius: 999px; background: var(--soft); box-shadow: var(--soft-edge); font-size: 12px; }
.why { display: inline; } .why summary { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; background: var(--soft); font-size: 10.5px; cursor: pointer; list-style: none; }
.why summary::-webkit-details-marker { display: none; } .why[open] > span { display: block; font-size: 12px; color: var(--muted); margin-top: 3px; }
.chart { width: 100%; height: 90px; display: block; } .chart text { font: 9px system-ui; }
/* The pictures beside a headline. */
.art { flex: none; display: grid; place-items: center; }
.ring { --p: 0; flex: none; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--c) calc(var(--p) * 1%), color-mix(in srgb, var(--c) 14%, transparent) 0); filter: drop-shadow(0 0 8px color-mix(in srgb, var(--c) 35%, transparent)); }
.ring > span { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: var(--c); background: var(--glass); box-shadow: inset 0 0 0 1px var(--glass-edge); }
.pk-fan { position: relative; width: 86px; height: 70px; } .pk-fan .spk { position: absolute; top: 2px; } .pk-fan .spk:nth-child(1) { left: 23px; z-index: 3; }
.pk-fan.n2 .spk:nth-child(2), .pk-fan.n3 .spk:nth-child(2) { left: 8px; transform: rotate(-11deg); z-index: 2; } .pk-fan.n3 .spk:nth-child(3) { left: 38px; transform: rotate(11deg); z-index: 1; }
.pk-none { width: 44px; height: 60px; border-radius: 9px; border: 2px dashed var(--line); }
.badge { width: 52px; height: 52px; color: var(--c); filter: drop-shadow(0 0 8px color-mix(in srgb, var(--c) 55%, transparent)); } .badge svg { width: 100%; height: 100%; }
.badge path { fill: color-mix(in srgb, var(--c) 24%, transparent); stroke: currentColor; stroke-width: 1.4; } .badge path.in { fill: color-mix(in srgb, var(--c) 55%, transparent); stroke-width: 1; }
.bellart { width: 50px; height: 50px; border-radius: 16px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); } .bellart.on { box-shadow: 0 0 16px color-mix(in srgb, var(--c) 45%, transparent); }
.res-art { width: 48px; height: 48px; border-radius: 14px; font: 900 22px system-ui; color: #fff; background: #9aa0b8; } .res-art.win { background: linear-gradient(135deg, #2fae66, #1c8a73); } .res-art.loss { background: linear-gradient(135deg, #ff5d73, #c13d7a); } .res-art.none { background: var(--soft); color: var(--muted); }
/* Cards and the arena (shared fact markup). */
.cards { display: flex; gap: 6px; flex-wrap: wrap; }
.mcard { --fc: #999; position: relative; display: inline-flex; flex-direction: column; justify-content: flex-end; flex: none; width: 46px; aspect-ratio: 5 / 7; border-radius: 6px; overflow: hidden; color: #fff; font-style: normal;
  background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--fc) 75%, #fff 10%), transparent 55%), linear-gradient(160deg, color-mix(in srgb, var(--fc) 55%, #0b0f22), #0b0f22 80%); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.18), 0 4px 10px rgba(20,20,60,.25); }
.mcard.mc-m { width: 76px; border-radius: 8px; }
.mcard.r-uncommon { box-shadow: inset 0 0 0 1.5px #b8c3d6; } .mcard.r-rare { box-shadow: inset 0 0 0 2px #59a8ff; } .mcard.r-mythic { box-shadow: inset 0 0 0 2px #ffcf5c, 0 0 12px rgba(255,207,92,.5); }
.mcard.shine::after { content: ""; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.35) 45%, transparent 60%); }
.mcard i { font-style: normal; }
.mcc { position: absolute; top: 3px; left: 3px; width: 15px; height: 15px; border-radius: 50%; background: rgba(0,0,0,.55); font-size: 9.5px; font-weight: 800; display: grid; place-items: center; }
.mca { position: absolute; inset: 22% 12% 38%; border-radius: 4px; background: repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 3px, transparent 3px 7px); }
.mcn { padding: 0 4px 2px; font-size: 7.5px; font-weight: 700; line-height: 1.1; text-shadow: 0 1px 2px #000; } .mc-m .mcn { font-size: 10px; }
.mcs { padding: 0 4px 3px; font-size: 7.5px; opacity: .8; } .mc-m .mcs { font-size: 9.5px; }
.mcf { position: absolute; top: 3px; right: 3px; font-size: 7px; font-weight: 800; background: rgba(0,0,0,.6); padding: 0 3px; border-radius: 3px; }
.vs { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 8px; align-items: center; }
.vs .side { display: flex; flex-direction: column; gap: 2px; min-width: 0; } .vs .side b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: color-mix(in srgb, var(--fc) 70%, #fff); }
.vs .side:last-child { text-align: right; } .vsx { text-align: center; font: 800 12px ui-monospace, Menlo, monospace; color: var(--muted); line-height: 1.1; }
.hp { display: block; height: 6px; border-radius: 999px; background: rgba(255,255,255,.14); overflow: hidden; } .hp i { display: block; height: 100%; background: var(--fc); box-shadow: 0 0 8px var(--fc); }
.vs .side:last-child .hp { transform: scaleX(-1); }
.vsx { display: flex; flex-direction: column; align-items: center; gap: 4px; }
/* Watch live. S: the basic info. M and L: the stage holds the 9:16 arena, as large as fits. */
.livebadge { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; padding: 2px 10px; border-radius: 999px; font: 800 11px ui-monospace, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; color: #fff; background: var(--live); }
.livebadge::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #fff; }
.lm-s { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.lm-s li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; align-items: baseline; }
.lm-s b { color: color-mix(in srgb, var(--fc) 70%, #fff); font-size: calc(15px * var(--zt)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .lm-s .hp { grid-column: 1 / -1; }
.tile[data-tile="watch"].s-S .headline > .fx { gap: 8px; }
.tile .body.stage { display: block; position: relative; container: stage / size; }
.stage [data-fact="liveArena"] { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 6px; }
.lm-m { position: absolute; z-index: 2; left: 50%; transform: translateX(-50%); top: 8px; width: calc(min(100cqw, 100cqh * 9 / 16) - 16px); display: flex; flex-direction: column; gap: 6px; }
.lm-m .side { display: grid; grid-template-columns: minmax(0, 1fr); gap: 3px; padding: 5px 8px; border-radius: 10px; background: rgba(6,8,26,.66); }
.lm-m .side:last-child { position: absolute; left: 0; right: 0; top: calc(min(100cqh, 100cqw * 16 / 9) - 70px); }
.lm-m b { font-size: 12.5px; color: color-mix(in srgb, var(--fc) 70%, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mine { text-align: center; }
.arena916 { position: relative; flex: none; aspect-ratio: 9 / 16; width: min(100cqw, 100cqh * 9 / 16); max-height: 100%; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 3cqw; container-type: inline-size;
  background: linear-gradient(rgba(120,140,255,.08) 1px, transparent 1px) 0 0 / 100% 22px, radial-gradient(ellipse 70% 30% at 50% 50%, rgba(111,134,255,.35), transparent 70%), linear-gradient(180deg, #070a24, #141a44 50%, #070a24); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14), 0 0 24px rgba(111,134,255,.25); color: #eef1ff; }
.tile[data-tile="watch"].s-L .stage [data-fact="liveArena"] .arena916 { width: min(100cqw, (100cqh - 22px) * 9 / 16); }
.arena916.empty { display: grid; place-items: center; text-align: center; color: #c6cbe8; }
.arena916.a-M { justify-content: center; gap: 10cqw; padding-top: 30cqw; padding-bottom: 30cqw; }
.arow { display: flex; flex-wrap: wrap; gap: 2cqw; justify-content: center; }
.unit { width: 14cqw; aspect-ratio: 5 / 7; border-radius: 1.6cqw; padding: 1cqw; display: flex; flex-direction: column; justify-content: space-between; font-style: normal; font-size: 2.3cqw;
  background: linear-gradient(160deg, color-mix(in srgb, var(--fc) 60%, #0b0f22), #0b0f22); box-shadow: inset 0 0 0 1px var(--fc), 0 0 10px color-mix(in srgb, var(--fc) 40%, transparent); }
.unit i { font-style: normal; font-weight: 700; line-height: 1.1; overflow: hidden; } .unit b { align-self: flex-end; font-size: 3cqw; } .unit.pend { opacity: .55; }
.unit.bare { justify-content: flex-end; } .unit.bare b { font-size: 4.2cqw; }
.none { font-size: 3cqw; opacity: .5; text-align: center; }
.disc { text-align: center; font: 600 3.2cqw ui-monospace, Menlo, monospace; padding: 2cqw; border-radius: 999px; background: rgba(255,255,255,.08); }
.disc.slim { font-size: 4cqw; padding: 1.4cqw; }
.hand { display: flex; align-items: center; justify-content: center; gap: 1cqw; flex-wrap: wrap; font: 600 2.8cqw ui-monospace, Menlo, monospace; color: #c6cbe8; }
.hand span { flex-basis: 100%; text-align: center; }
.hand.far span { order: -1; }
.hand .back { width: 8cqw; aspect-ratio: 5 / 7; border-radius: 1cqw; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--fc) 55%, #0b0f22) 0 1cqw, #0b0f22 1cqw 2cqw); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fc) 80%, #fff 0%); }
.hand.far .back { width: 6.5cqw; }
.proto { text-align: center; white-space: nowrap; font-size: 2.4cqw; opacity: .5; }
${art.css}
.tile[data-tile="store"]:not(.s-S) .body { display: flex; flex-direction: row; flex-wrap: nowrap; gap: 12px; align-items: stretch; justify-content: flex-start; }
.tile[data-tile="store"].s-M .headline { justify-content: center; }
.tile[data-tile="store"] .shelf { flex-wrap: nowrap; }
.tile[data-tile="store"] .lab { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile[data-tile="store"].s-M [data-fact="cosmetics"] { flex: 3; } .tile[data-tile="store"].s-M [data-fact="buyPacks"] { flex: 1; }
.tile[data-tile="store"].s-M .si { flex: 1 1 0; width: auto; min-width: 0; }
.tile[data-tile="store"].s-L .body { flex-wrap: wrap; align-content: space-evenly; }
.tile[data-tile="store"].s-L [data-fact="cosmetics"] { flex-direction: row; flex-wrap: wrap; gap: 6px 22px; flex-basis: 100%; }
.tile[data-tile="store"].s-L [data-fact="cosmetics"] > .sub { flex-basis: 100%; }
.tile.hero .si figcaption small { color: #c6cbe8; }
.flash { animation: flash 1.6s ease-out 1; } @keyframes flash { 0% { box-shadow: 0 0 0 3px var(--c), var(--shadow); } 100% { box-shadow: var(--shadow); } }
.pg { padding: 20px 22px; border-radius: 24px; background: var(--glass); border: 1px solid var(--glass-edge); box-shadow: var(--shadow); backdrop-filter: blur(28px); max-width: 760px; }
.pg h2 { margin: 0 0 6px; } .pg ul { margin: 6px 0 12px; } .pg .sub { display: block; }
@media (max-width: 1180px) { .topnav { grid-template-columns: auto 1fr auto; } .places { justify-self: center; } .nav { padding: 8px 10px; } }
@media (max-width: 720px) {
  .topnav { grid-template-columns: 1fr auto; padding: 8px 14px 6px; row-gap: 6px; }
  .places { grid-column: 1 / -1; grid-row: 2; justify-self: stretch; justify-content: space-between; padding: 3px; }
  .places .nav { flex: 1; flex-direction: column; gap: 2px; padding: 6px 2px; font-size: 10.5px; }
  .right .wallet { display: none; }
  main { padding: 14px 14px 40px; }
  .top h1 { font-size: 22px; }
  .grid { --gap: ${PHONE_GAP}px; }
  .tile { padding: 10px 11px; border-radius: 18px; gap: 6px; }
  .tile header { gap: 6px; } .tile .ic { width: 24px; height: 24px; border-radius: 8px; } .tile .ic svg { width: 14px; height: 14px; }
  .tile h3 { font-size: 13px; } .qb { width: 20px; height: 20px; } .open { width: 22px; height: 22px; }
  .tile .btn { padding: 6px 10px; font-size: 12.5px; border-radius: 10px; }
  .q { top: 38px; left: 8px; right: 8px; font-size: 12px; }
  .edit button[data-sz] { display: none; }
}
@media (prefers-reduced-motion: reduce) { .flash { animation: none; } }
</style></head><body>
${mockStrip("Season 1 Home · B on the grid (phase 2)", owners, data.takenAt, "light")}
<header class="topnav" aria-label="Main">
  <a class="brand" href="#/home" data-go="home"><b>AI·TCG</b><small>SEASON 1</small></a>
  <nav class="places" aria-label="Places">${places}</nav>
  <div class="right" id="right"></div>
</header>
<main id="main"></main>
${art.defs}
<script id="data" type="application/json">${payload}</script>
<script>${art.script}</script>
<script>${SHELL_SCRIPT}</script>
<script>
(() => {
  const S = window.SHELL, D = S.D, st = S.st;
  const main = document.getElementById('main');
  function right(p) {
    const o = D.owners[st.owner];
    const gear = '<a href="#/settings" data-go="settings" class="nav set" aria-label="Settings">${icon("gear", 18).replace(/'/g, "\\'")}<span>Settings</span></a>';
    const acct = '<span class="acct" title="' + o.name + '">' + o.shell.initial + '</span>';
    if (p === 'home') return gear + acct;
    return '<a class="wallet" href="#/cards" data-go="cards"><i class="coin" aria-hidden="true"></i>' + o.shell.credits + ' credits · ' + o.shell.packPoints + ' pack points</a><a class="bell" href="#/alerts" data-go="alerts" aria-label="Alerts, ' + o.shell.unread + ' new">Alerts' + (o.shell.unread ? ' <b>' + o.shell.unread + '</b>' : '') + '</a>' + gear + acct;
  }
  function draw() {
    const o = D.owners[st.owner];
    const p = S.page();
    document.querySelectorAll('.nav').forEach((a) => { if (a.dataset.go === p) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.getElementById('right').innerHTML = right(p);
    if (p === 'home') {
      // The greeting at the time the data was read, in the server's day.
      const hour = Number(new Date(D.takenAt).toLocaleString('en-AU', { hour: 'numeric', hourCycle: 'h23', timeZone: D.tz }));
      const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      main.innerHTML = '<div class="top"><div><span class="kick">// home</span><h1>' + greet + ', ' + o.name + '</h1></div><span class="sp"></span><button type="button" class="btn" id="edit" aria-pressed="' + st.editing + '">' + (st.editing ? 'Done' : 'Edit board') + '</button></div>' +
        '<section class="grid' + (st.editing ? ' editing' : '') + '" id="grid" aria-label="Your tiles">' + st.board.map((b) => o.tiles[b.tile][S.sizeOn(b)]).join('') + '</section>' +
        (S.phone() && st.editing ? '<p class="sub">Sizes apply on a wider screen; here every tile shows its small face.</p>' : '');
      document.querySelectorAll('.tile .edit').forEach((e) => (e.hidden = !st.editing));
      return;
    }
    const title = S.titleOf(p);
    main.innerHTML = '<div class="top"><div><span class="kick">// ' + p + '</span><h1>' + title + '</h1></div></div>' + S.stub(title, D.pages.find((x) => x.id === p));
  }
  // The "?" on a tile: its question, one tap away.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.qb');
    if (!b) return;
    const tile = b.closest('.tile');
    const on = !tile.classList.contains('qopen');
    tile.classList.toggle('qopen', on);
    b.setAttribute('aria-expanded', String(on));
  });
  // The grid (homeGrid.ts): columns and the square unit from the board's
  // width, then every tile at its packed column and row.
  ${GRID_JS}
  function layout() {
    const g = document.getElementById('grid');
    if (!g) return;
    const gap = parseFloat(getComputedStyle(g).columnGap) || ${GRID_GAP};
    const n = HOME_GRID.cols(window.innerWidth);
    const u = HOME_GRID.unit(g.clientWidth, n, gap);
    g.style.setProperty('--cols', n);
    g.style.setProperty('--unit', u.toFixed(2) + 'px');
    const tiles = [...g.querySelectorAll(':scope > .tile')];
    const L = HOME_GRID.pack(tiles.map((t) => ({ tile: t.dataset.tile, size: t.dataset.size })), n, u, gap);
    L.placed.forEach((p, i) => {
      tiles[i].style.gridColumn = (p.col + 1) + ' / span ' + p.w;
      tiles[i].style.gridRow = (p.row + 1) + ' / span ' + p.h;
      tiles[i].dataset.shape = p.w + 'x' + p.h;
    });
    g.dataset.cols = n; g.dataset.rows = L.rows; g.dataset.unit = u.toFixed(1);
  }
  window.HOME_GRID = HOME_GRID;
  window.HOME_LAYOUT = layout;
  S.start(draw, layout);
})();
</script></body></html>`;
}
