// The Season 1 Home, phase 2 (render session 86): mockup B, the direction the
// owner picked (2026-11-23), built on the uniform grid (homeGrid.ts) with B's
// top-bar navigation, light by default and dark as the option.
//
// What changed from mockup B (which stays as the record of what was picked):
//   - tiles no longer take their content's height (masonry). Each is a fixed
//     shape on one square unit: S 1x1, M 2x1, L 2x2; Watch live S 1x1, M 1x2
//     and L two units wide by as many as its whole 9:16 arena needs. The page
//     places every tile explicitly (row and column) from the same layout code
//     the tests run (homeGrid.ts GRID_JS), so every edge lines up;
//   - each size has its own anatomy to fill its box: S stacks (header, the
//     headline, the button); M is wide, so the headline and the button sit
//     on the left and the details on the right; L stacks with its details in
//     two columns. The question behind the "?" opens over the tile, not in
//     the flow, so it never changes a tile's size;
//   - Watch live follows the owner's 2026-11-23 spec: S the two names in
//     their faction colours, health, the turn, a Live badge and Watch; M the
//     arena 9:16 with names and health bars only (no card text, no hand
//     details); L the whole arena with the scoreboard, the turn line, both
//     hands, the other matches and the play-by-play;
//   - Edit board shows the grid's empty cells, so moving and resizing reads as
//     snapping to the grid.
// Whether every tile's content fits its box is measured, not assumed: the
// browser check (season1/ci/home-grid-check.mjs) reports each tile at each
// size for both owners. Fitting the tiles that don't fit yet is the next
// sessions' work (phase 2, "the tiles in groups").
//
// Pure: data in, an HTML string out (the real Season 0 owner API's answers,
// season1/mockup/data/home-data.json). Fenced off: nothing outside
// render/season1/ imports it.

import { ICONS, esc, icon } from "../../src/site/siteModel.js";
import { TILES, type Size } from "./homeSpec.js";
import { featured, homeArt, nextAction, tileFacts, type HomeData, type OwnerData } from "./homeFacts.js";
import { B_TONE, bCss, heroArt } from "./homeMockupB.js";
import { OPEN_LABEL, PLACES, SHELL_SCRIPT, boardsWith, editControls, mockStrip, opensOf, ownersPayload, payloadJson, type Board } from "./homeShell.js";
import { GRID, GRID_JS } from "./homeGrid.js";

const TILE_ICON: Record<string, string> = { agent: ICONS.match, ladder: ICONS.trophy, watch: ICONS.eye, packs: ICONS.spark, store: ICONS.store, collection: ICONS.col, daily: ICONS.stats, history: ICONS.list, notif: ICONS.bell, music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>' };
const svg = (paths: string, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
// No hero tile: every tile on Home is the same light (or dark) glass. Watch
// live went first (owner 2026-11-25, point 11; only its arena keeps the neon
// night), then My agent (owner 2026-11-27, render session 88). Mockup B's
// record page keeps its deep indigo hero (homeMockupB.ts).
const HERO = new Set<string>();
// Store M shows the featured pack and two cosmetics (owner 2026-11-23,
// point 3): the fact draws only those two, not three with one hidden.
// How many leading facts make a tile's headline (the rest is the body).
// Ladder's headline is the rating, the tier and the rank together (render
// session 89): the three S shows, and the left half of M.
const HEAD_FACTS: Record<string, number> = { ladder: 3 };
const factOpts = (tileId: string, size: Size) => (tileId === "store" && size === "M" ? { featuredCosmetics: 2 } : undefined);

/** The recommended first board on the grid. Chosen so it packs with no hole
 * at 6 columns (1280-1440 px) and at 4 (900-1180 px), with the agent and
 * the match first (homeGrid.test.ts holds it to that): 4 rows at 6
 * columns. Watch live is M by default: at L it is taller than a laptop
 * screen (5 units, 1154 px at 1440 px wide); Edit board offers it. */
export const GRID_RECOMMENDED: Board = [
  { tile: "agent", size: "L" },
  { tile: "watch", size: "M" },
  { tile: "ladder", size: "L" },
  { tile: "store", size: "M" },
  { tile: "daily", size: "S" },
  { tile: "collection", size: "L" },
  { tile: "packs", size: "L" },
  { tile: "history", size: "M" },
  { tile: "notif", size: "S" },
];
export const GRID_BOARDS = boardsWith(GRID_RECOMMENDED);

/** One tile, drawn at one size for one owner (B's anatomy, plus Watch
 * live's Live badge at S). */
export function gridTileHtml(tileId: string, size: Size, d: OwnerData): string {
  const t = TILES.find((x) => x.id === tileId)!;
  const act = nextAction(t, size, d);
  const opens = opensOf(t.id);
  const waiting = t.status === "waiting on owner";
  const facts = tileFacts(t, size, d, factOpts(t.id, size));
  const isAct = (f: string) => f.startsWith('<div class="fx act"');
  const rest = facts.filter((f) => !isAct(f));
  const nHead = HEAD_FACTS[t.id] ?? 1;
  const head = nHead > 1 ? `<div class="hstack">${rest.slice(0, nHead).join("")}</div>` : rest[0];
  const body = rest.slice(nHead);
  const art = heroArt(t.id, d);
  const tone = B_TONE[t.id] ?? "#8b5cff";
  // Watch live's Live badge: in the header at L, beside Watch at S
  // (a 1-unit header has no room for it), none at M (the arena is live).
  const live = t.id === "watch" && featured(d) ? `<span class="pill live sm" data-live>Live</span>` : "";
  return `<article class="tile s-${size}${HERO.has(t.id) ? " hero" : ""}${waiting ? " waiting" : ""}" data-tile="${t.id}" data-size="${size}" style="--c:${tone}" aria-labelledby="h-${t.id}">` +
    `<header><span class="ic">${svg(TILE_ICON[t.id] ?? ICONS.spark)}</span><h3 id="h-${t.id}">${esc(t.name)}</h3>${size === "L" ? live : ""}` +
    `<button type="button" class="qb" aria-expanded="false" aria-controls="q-${t.id}" aria-label="What is ${esc(t.name)} for?">?</button>` +
    (waiting ? `<span class="wo">Waiting on owner</span>` : `<a class="open" href="#/${opens}" data-go="${opens}" aria-label="${esc(OPEN_LABEL[t.id] ?? "Open")}">${svg(ICONS.arrow, 16)}</a>`) +
    editControls(t.name, size) + `</header>` +
    `<p class="q" id="q-${t.id}">${esc(t.question)}</p>` +
    `<div class="headline">${art}${head ?? ""}</div>` +
    `<div class="body">${body.join("")}</div>` +
    `<footer>${size === "S" ? live : ""}${facts.some(isAct) ? facts.filter(isAct).join("") : `<button type="button" class="btn ${act.primary ? "pri" : ""}" data-go="${act.to}"${act.disabled ? " disabled" : ""}>${esc(act.label)}</button>`}</footer>` +
    `</article>`;
}

/** The grid and each size's anatomy, on top of B's look. */
export const GRID_CSS = `
/* The uniform grid: one square unit; the script sets the columns, the unit
   and each tile's place. */
.ugrid { display: grid; grid-template-columns: repeat(var(--cols, 4), var(--unit, 200px)); grid-auto-rows: var(--unit, 200px); gap: var(--g, 16px); position: relative; justify-content: start; }
.ugrid > .tile { min-height: 0; height: 100%; margin: 0; gap: 6px; padding: 14px 16px; }
.ugrid > .cell { border-radius: 24px; border: 1.5px dashed color-mix(in srgb, var(--accent) 40%, transparent); background: color-mix(in srgb, var(--accent) 5%, transparent); z-index: 0; }
.ugrid > .tile { z-index: 1; }
/* The question opens over the tile (it never changes the tile's size). */
.ugrid .q { position: absolute; left: 10px; right: 10px; top: 50px; z-index: 3; backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); background: color-mix(in srgb, var(--c) 18%, var(--glass)); box-shadow: 0 8px 24px rgba(30,30,90,.18), inset 0 0 0 1px color-mix(in srgb, var(--c) 40%, transparent); }
.ugrid .body { flex: 1 1 auto; min-height: 0; }
.ugrid .body:empty { display: block; }
.ugrid .tile footer { margin-top: 0; }
.pill.sm { font-size: 11px; padding: 1px 8px; }
/* S: header, the headline, the button. */
.ugrid .s-S .headline { gap: 9px; }
.ugrid .s-S .headline .big { font-size: 26px; }
.ugrid .s-S .ring { width: 48px; height: 48px; } .ugrid .s-S .ring > span { width: 36px; height: 36px; }
.ugrid .s-S .badge, .ugrid .s-S .bellart, .ugrid .s-S .res-art { width: 42px; height: 42px; }
.ugrid .s-S .body { gap: 4px; font-size: 13px; }
.ugrid .s-S footer .btn { padding: 7px 12px; font-size: 13px; }
/* M (2x1): wide and short. The headline and the button on the left, the
   details on the right. */
.ugrid .tile.s-M:not([data-tile="watch"]) { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); grid-template-rows: auto minmax(0, 1fr) auto; column-gap: 16px; row-gap: 6px; }
.ugrid .tile.s-M:not([data-tile="watch"]) > header { grid-column: 1 / -1; }
.ugrid .tile.s-M:not([data-tile="watch"]) > .headline { grid-column: 1; grid-row: 2; align-self: center; }
.ugrid .tile.s-M:not([data-tile="watch"]) > .body { grid-column: 2; grid-row: 2 / 4; display: flex; flex-direction: column; gap: 6px; }
.ugrid .tile.s-M:not([data-tile="watch"]) > footer { grid-column: 1; grid-row: 3; justify-content: flex-start; }
.ugrid .tile.s-M:not([data-tile="watch"]) > .body:empty + footer { grid-column: 1 / -1; }
/* L (2x2): stacked, its details in two columns. */
.ugrid .tile.s-L:not([data-tile="watch"]) .body { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; align-content: start; }
.ugrid .s-L :is([data-fact="recentMatches"], [data-fact="alerts"], [data-fact="personality"], [data-fact="lastPulls"], [data-fact="winSchedule"], [data-fact="bestCards"], [data-fact="trend"], [data-fact="cosmetics"]) { grid-column: 1 / -1; }
/* The status pills on the glass (render session 88, measured from the
   pixels): the pure status colours read at about 3:1 on the light glass, so
   the words take the colour mixed toward the ink; the ring keeps the pure
   colour. */
.ugrid .pill.live { color: color-mix(in srgb, var(--live) 45%, var(--ink)); }
.ugrid .pill.ok { color: color-mix(in srgb, var(--ok) 45%, var(--ink)); }
.ugrid .pill.warn { color: color-mix(in srgb, var(--warn) 45%, var(--ink)); }
/* My agent (render session 88): one glass tile like the rest (owner
   2026-11-27), each size laid out for its box. */
.tile[data-tile="agent"] .ava { color: color-mix(in srgb, var(--c) 55%, var(--ink)); filter: drop-shadow(0 2px 8px color-mix(in srgb, var(--c) 35%, transparent)); }
.tile[data-tile="agent"] [data-fact="agentName"] .big { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; line-height: 1.08; }
.tile[data-tile="agent"] [data-fact="agentStatus"] .why { line-height: 1.3; }
.tile[data-tile="agent"] .labrow { display: flex; align-items: baseline; gap: 8px; }
.tile[data-tile="agent"] .chg { font-size: 12px; font-weight: 700; color: color-mix(in srgb, var(--accent) 62%, var(--ink)); text-decoration: none; }
.ugrid .tile[data-tile="agent"]:is(.s-S, .s-M, .s-L) .headline [data-fact="agentName"] .big.long { font-size: 16px; }
.tile[data-tile="agent"] .chg:hover { text-decoration: underline; }
.tile[data-tile="agent"] [data-fact="playTime"] .val { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; }
.tile[data-tile="agent"] .btn.add { padding: 1px 8px; font-size: 11.5px; }
/* S: the picture and the name, the pill, the button. */
.ugrid .tile[data-tile="agent"].s-S .headline [data-fact="agentName"] .big { font-size: 18px; }
/* M: the name and the button on the left; on the right the pill with its
   short reason, then one line each: today, the personality, the play time. */
.ugrid .tile[data-tile="agent"].s-M { grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); }
.ugrid .tile[data-tile="agent"].s-M .headline [data-fact="agentName"] { flex-wrap: nowrap; gap: 8px; }
.ugrid .tile[data-tile="agent"].s-M .headline [data-fact="agentName"] .big { font-size: 18px; }
.ugrid .tile[data-tile="agent"].s-M .ava { width: 40px; height: 40px; }
.ugrid .tile[data-tile="agent"].s-M > .body { gap: 5px; justify-content: center; }
.ugrid .tile[data-tile="agent"].s-M [data-fact="agentStatus"] { gap: 2px; }
.ugrid .tile[data-tile="agent"].s-M [data-fact="agentStatus"] .why { font-size: 12px; }
.ugrid .tile[data-tile="agent"].s-M .fx.kv { display: grid; grid-template-columns: 84px minmax(0, 1fr); align-items: baseline; column-gap: 6px; font-size: 13px; line-height: 1.3; }
/* L: the name with the button beside it, the pill and its reason, today
   and the play time side by side, the deck, then every personality in one
   line each (two columns of three). */
.ugrid .tile[data-tile="agent"].s-L { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto minmax(0, 1fr); grid-template-areas: "hd hd" "nm ft" "bd bd"; column-gap: 12px; row-gap: 6px; }
.ugrid .tile[data-tile="agent"].s-L > header { grid-area: hd; }
.ugrid .tile[data-tile="agent"].s-L > .headline { grid-area: nm; }
.ugrid .tile[data-tile="agent"].s-L > footer { grid-area: ft; align-self: center; padding: 0; }
.ugrid .tile[data-tile="agent"].s-L > .body { grid-area: bd; gap: 6px 16px; font-size: 13.5px; line-height: 1.3; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="deck"] { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; column-gap: 10px; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="deck"] .labrow { flex-direction: column; gap: 0; }
.ugrid .tile[data-tile="agent"].s-L .headline [data-fact="agentName"] .big { font-size: 21px; }
.ugrid .tile[data-tile="agent"].s-L .ava { width: 38px; height: 38px; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="agentStatus"] { grid-area: 1 / 1 / 2 / 3; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="todayRecord"] { grid-area: 2 / 1; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="playTime"] { grid-area: 2 / 2; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="deck"] { grid-area: 3 / 1 / 4 / 3; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="personality"] { grid-area: 4 / 1 / 5 / 3; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="agentStatus"] { flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="agentStatus"] .why { font-size: 12.5px; }
.ugrid .tile[data-tile="agent"].s-L .styles { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 6px; margin: 0; padding: 0; list-style: none; }
.ugrid .tile[data-tile="agent"].s-L .styles li { display: flex; flex-direction: column; min-width: 0; padding: 2px 8px; border-radius: 9px; background: var(--soft); box-shadow: var(--soft-edge); font-size: 12.5px; line-height: 1.25; }
.ugrid .tile[data-tile="agent"].s-L .styles li > span { color: var(--muted); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ugrid .tile[data-tile="agent"].s-L .styles li.on { background: color-mix(in srgb, var(--c) 16%, transparent); box-shadow: inset 0 0 0 1.5px var(--c); }
/* Ladder (render session 89): the rating, the tier and the rank are one
   headline; the body is the next step up (one bar), this week, the form;
   at L also how settled, the streak and the decks, then the standings
   beside the chart (or, unplaced, beside the tier ladder). */
.tile[data-tile="ladder"] .hstack { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 3px 8px; }
.tile[data-tile="ladder"] .hstack > [data-fact="rating"] { flex: none; }
.tile[data-tile="ladder"] .hstack > [data-fact="rank"] { flex: 1 1 100%; font-size: 13px; line-height: 1.25; color: var(--muted); }
.tile[data-tile="ladder"] .hstack > [data-fact="rank"] b { color: var(--ink); }
/* Tier pills on the glass: the pure tier colours (Platinum, Silver) read
   near 2:1 on light glass, so the word is mixed toward the ink. */
.tile[data-tile="ladder"] .tier { padding: 1px 9px; font-size: 13px; white-space: nowrap; color: color-mix(in srgb, var(--tc) 38%, var(--ink)); }
.tile[data-tile="ladder"] .badge { flex: none; }
.tile[data-tile="ladder"] .fx.kv { font-size: 13px; line-height: 1.3; }
.tile[data-tile="ladder"] .lab { white-space: nowrap; }
.tile[data-tile="ladder"] [data-fact="climb"] .bar { margin-top: 3px; height: 6px; }
.tile[data-tile="ladder"] [data-fact="climb"] .bar i { background: linear-gradient(90deg, color-mix(in srgb, var(--c) 55%, var(--accent)), var(--c)); }
.tile[data-tile="ladder"] .up { color: color-mix(in srgb, var(--ok) 50%, var(--ink)); } .tile[data-tile="ladder"] .down { color: color-mix(in srgb, var(--warn) 50%, var(--ink)); }
.tile[data-tile="ladder"] .dots { flex-wrap: nowrap; gap: 2px; }
.tile[data-tile="ladder"] .dot { width: 16px; height: 16px; border-radius: 5px; font-size: 9px; }
.tile[data-tile="ladder"] .dot.win { background: #125c33; } .tile[data-tile="ladder"] .dot.loss { background: #9c1c34; } .tile[data-tile="ladder"] .dot.draw { background: #474c66; }
/* S: the badge beside the rating, the tier and the rank; the button. */
.ugrid .tile[data-tile="ladder"].s-S .headline .big { font-size: 24px; }
.ugrid .tile[data-tile="ladder"].s-S .hstack > [data-fact="rank"] { font-size: 12.5px; }
/* M: the headline and the button on the left; on the right the bar, this
   week and the form (label and value on one line each). */
.ugrid .tile[data-tile="ladder"].s-M { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.ugrid .tile[data-tile="ladder"].s-M .headline .big { font-size: 26px; }
.ugrid .tile[data-tile="ladder"].s-M > .body { gap: 8px; justify-content: center; }
.ugrid .tile[data-tile="ladder"] :is(.s-M [data-fact="weekChange"], .s-L [data-fact="form"], .s-L [data-fact="streak"], .s-L [data-fact="factionWinRate"]) { flex-direction: row; align-items: baseline; gap: 8px; min-width: 0; }
.ugrid .tile[data-tile="ladder"].s-M [data-fact="form"] .dot { width: 15px; height: 15px; }
/* L: the headline with the button beside it; the bar; this week and how
   settled; the form, the streak and the decks one line each; then the
   standings beside the chart, which takes what height is left. */
.ugrid .tile[data-tile="ladder"].s-L { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto minmax(0, 1fr); grid-template-areas: "hd hd" "nm ft" "bd bd"; column-gap: 12px; row-gap: 6px; }
.ugrid .tile[data-tile="ladder"].s-L > header { grid-area: hd; }
.ugrid .tile[data-tile="ladder"].s-L > .headline { grid-area: nm; }
.ugrid .tile[data-tile="ladder"].s-L > footer { grid-area: ft; align-self: start; padding: 0; }
.ugrid .tile[data-tile="ladder"].s-L > .body { grid-area: bd; gap: 6px 14px; grid-template-rows: repeat(5, auto) minmax(0, 1fr); }
.ugrid .tile[data-tile="ladder"].s-L .headline .big { font-size: 28px; }
.ugrid .tile[data-tile="ladder"].s-L [data-fact="climb"] { grid-area: 1 / 1 / 2 / 3; }
.ugrid .tile[data-tile="ladder"].s-L [data-fact="weekChange"] { grid-area: 2 / 1; }
.ugrid .tile[data-tile="ladder"].s-L [data-fact="ratingSettled"] { grid-area: 2 / 2; }
.ugrid .tile[data-tile="ladder"].s-L [data-fact="form"] { grid-area: 3 / 1 / 4 / 3; }
.ugrid .tile[data-tile="ladder"].s-L [data-fact="streak"] { grid-area: 4 / 1 / 5 / 3; }
.ugrid .tile[data-tile="ladder"].s-L [data-fact="factionWinRate"] { grid-area: 5 / 1 / 6 / 3; }
.ugrid .tile[data-tile="ladder"].s-L [data-fact="standings"] { grid-area: 6 / 1; min-height: 0; }
.ugrid .tile[data-tile="ladder"].s-L [data-fact="trend"] { grid-area: 6 / 2; min-height: 0; }
.ugrid .tile[data-tile="ladder"].s-L :is([data-fact="form"], [data-fact="streak"], [data-fact="factionWinRate"]) > .lab { flex: none; width: 58px; }
.tile[data-tile="ladder"] .why[open] > span { position: absolute; left: 10px; right: 10px; z-index: 4; padding: 8px 10px; border-radius: 12px; background: var(--glass); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 8px 24px rgba(30,30,90,.18), inset 0 0 0 1px var(--line); color: var(--ink); }
.tile[data-tile="ladder"] .lad { gap: 2px; }
.tile[data-tile="ladder"] .lad li { padding: 1px 7px; gap: 6px; font-size: 12.5px; line-height: 1.35; min-width: 0; }
.tile[data-tile="ladder"] .lad li .who { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile[data-tile="ladder"] .lad li .pts { margin-left: auto; flex: none; color: var(--muted); font-variant-numeric: tabular-nums; }
.tile[data-tile="ladder"] .lad li.gap { background: none; box-shadow: none; padding: 0 8px; line-height: .7; color: var(--muted); }
.tile[data-tile="ladder"] .lad li.me { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.tile[data-tile="ladder"] .wr { display: flex; flex-wrap: nowrap; gap: 0 9px; min-width: 0; overflow: hidden; }
.tile[data-tile="ladder"] .wr > span { white-space: nowrap; } .tile[data-tile="ladder"] .wr .more { color: var(--muted); } .tile[data-tile="ladder"] .wr i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: .05em; }
.tile[data-tile="ladder"] [data-fact="trend"] { display: flex; flex-direction: column; }
.tile[data-tile="ladder"] .chartbox { position: relative; display: block; flex: 1 1 auto; min-height: 44px; max-height: 110px; }
.tile[data-tile="ladder"] .chart { position: absolute; inset: 0; width: 100%; height: 100%; }
.tile[data-tile="ladder"] .floors > span { position: absolute; left: 2px; transform: translateY(-110%); font-size: 9.5px; font-weight: 750; line-height: 1; color: color-mix(in srgb, var(--tc) 40%, var(--ink)); }
.tile[data-tile="ladder"] .scale { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }
.tile[data-tile="ladder"] .scale li { display: grid; grid-template-columns: 6px 1fr auto 34px; align-items: center; gap: 5px; font-size: 11px; line-height: 1.3; }
.tile[data-tile="ladder"] .scale li > i { height: 100%; min-height: 12px; border-radius: 3px; background: var(--tc); }
.tile[data-tile="ladder"] .scale .tn { font-weight: 750; color: color-mix(in srgb, var(--tc) 38%, var(--ink)); }
.tile[data-tile="ladder"] .scale .fl { color: var(--muted); font-variant-numeric: tabular-nums; }
.tile[data-tile="ladder"] .scale .who { display: flex; gap: 2px; align-items: center; justify-content: flex-end; }
.tile[data-tile="ladder"] .scale .who b { width: 7px; height: 7px; border-radius: 50%; background: var(--ink); }
.tile[data-tile="ladder"] .scale .who em { font-style: normal; font-size: 9.5px; font-weight: 700; color: var(--muted); }
/* Watch live: the arena 9:16, as large as its box allows (a size container). */
.tile[data-tile="watch"] .body { display: flex; flex-direction: column; gap: 6px; }
.tile[data-tile="watch"] [data-fact="liveArena"] { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; gap: 4px; }
.tile[data-tile="watch"] .afit { flex: 1 1 0; min-height: 0; container-type: size; display: flex; justify-content: center; }
.tile[data-tile="watch"] .arena916 { width: min(100cqw, 100cqh * 9 / 16); height: min(100cqh, 100cqw * 16 / 9); max-width: none; margin: 0 auto; aspect-ratio: auto; flex: none; }
.tile[data-tile="watch"] .headline { display: block; }
.tile[data-tile="watch"] .vs { gap: 6px; }
/* Watch live's surround is the dashboard's glass (owner 2026-11-25, point
   11): the names and health bars read on it in both themes; the arena
   inside keeps its own neon night. */
.tile[data-tile="watch"] .vs .side b { color: color-mix(in srgb, var(--fc) 72%, var(--ink)); }
.tile[data-tile="watch"] .vs .hp { background: color-mix(in srgb, var(--ink) 12%, transparent); }
/* M: names and health bars only. */
.tile[data-tile="watch"].s-M .vs .sub, .tile[data-tile="watch"].s-M .vsx small { display: none; }
.tile[data-tile="watch"].s-M .ahud span, .tile[data-tile="watch"].s-M .unit i, .tile[data-tile="watch"].s-M .proto { display: none; }
.tile[data-tile="watch"].s-M .unit { width: 30px; }
.tile[data-tile="watch"].s-M .vs .side b { font-size: 12px; }
.tile[data-tile="watch"].s-S .vs { grid-template-columns: minmax(0, 1fr); gap: 4px; }
.tile[data-tile="watch"].s-S .vs .side:last-child { text-align: left; }
.tile[data-tile="watch"].s-S .vs .side:last-child .hp { transform: none; }
.tile[data-tile="watch"].s-S .vs .sub:nth-of-type(1) { display: none; }
.tile[data-tile="watch"].s-S .vsx { text-align: left; }
.tile[data-tile="watch"].s-S .vsx br { display: none; }
/* L: the lists under the arena keep to their newest lines. */
.tile[data-tile="watch"].s-L [data-fact="playByPlay"] .pbp li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
/* Edit board: the move and size buttons sit in a bar over the tile's foot,
   not in its header, so every header keeps its name (a 1-unit S header has
   no room for five more buttons). The bar never changes the tile's size. */
.ugrid.editing .tile header { position: static; }
.ugrid.editing .tile > footer { visibility: hidden; } /* the bar sits over it; its buttons don't act while editing */
.ugrid.editing .tile .edit { position: absolute; left: 8px; right: 8px; bottom: 8px; z-index: 4; justify-content: center; gap: 4px; padding: 5px; border-radius: 12px; background: var(--glass); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 4px 14px rgba(30,30,90,.16), inset 0 0 0 1px var(--glass-edge); }
.ugrid.editing .tile .edit button { padding: 3px 9px; font-size: 12px; color: var(--ink); }
.ugrid.editing .tile .edit button[aria-pressed="true"] { color: #fff; }
/* S headers: a smaller chip and buttons, so the name fits a 1-unit tile. */
.ugrid .s-S header { gap: 6px; }
.ugrid .s-S .ic { width: 26px; height: 26px; border-radius: 9px; } .ugrid .s-S .ic svg { width: 15px; height: 15px; }
.ugrid .s-S .qb { width: 20px; height: 20px; font-size: 11px; } .ugrid .s-S .open { width: 22px; height: 22px; }
.ugrid .s-S h3 { font-size: 14px; }
.ugrid .s-S .wo { display: none; } /* the button says "Waiting on owner" */
/* Daily rewards S: the ring is the day's share (the bar repeats it). */
.ugrid .tile[data-tile="daily"].s-S [data-fact="earnedToday"] .bar { display: none; }
.ugrid .tile[data-tile="daily"].s-S .body { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.ugrid .tile[data-tile="daily"].s-S [data-fact="earnedToday"] > span:not(.big) { font-size: 12.5px; line-height: 1.25; }
/* Watch live S: the scoreboard as two lines and the turn. */
.tile[data-tile="watch"].s-S .vsx { font-size: 0; } .tile[data-tile="watch"].s-S .vsx small { font: 700 11px ui-monospace, Menlo, monospace; }
.tile[data-tile="watch"].s-S .vs .side .sub { font-size: 11.5px; }
.tile[data-tile="watch"].s-S footer { justify-content: space-between; align-items: center; }
/* Store M: a shop window in a short tile. On the left the credits, what
   they buy and the button; on the right the featured pack and two featured
   cosmetics (the owner's "2-3") as tall pictures with prices and Buy. */
.ugrid .tile[data-tile="store"].s-M { display: grid; grid-template-columns: 150px minmax(0, 1fr) minmax(0, 2fr); grid-template-rows: auto auto minmax(0, 1fr) auto; grid-template-areas: "hd hd hd" "hl pk co" "af pk co" "ft pk co"; column-gap: 8px; row-gap: 6px; }
.ugrid .tile[data-tile="store"].s-M > header { grid-area: hd; }
.ugrid .tile[data-tile="store"].s-M > .headline { grid-area: hl; }
.ugrid .tile[data-tile="store"].s-M [data-fact="credits"] { flex-wrap: wrap; column-gap: 6px; row-gap: 0; }
.ugrid .tile[data-tile="store"].s-M > footer { grid-area: ft; justify-content: flex-start; }
.ugrid .tile[data-tile="store"].s-M > footer .btn { padding: 7px 12px; font-size: 13px; }
.ugrid .tile[data-tile="store"].s-M > .body { display: contents; }
.ugrid .tile[data-tile="store"].s-M [data-fact="affordable"] { grid-area: af; }
.ugrid .tile[data-tile="store"].s-M [data-fact="affordable"] .sub { font-size: 12px; }
.ugrid .tile[data-tile="store"].s-M [data-fact="buyPacks"] { grid-area: pk; }
.ugrid .tile[data-tile="store"].s-M [data-fact="cosmetics"] { grid-area: co; }
.ugrid .tile[data-tile="store"].s-M :is([data-fact="buyPacks"], [data-fact="cosmetics"]) { min-height: 0; display: flex; }
.ugrid .tile[data-tile="store"].s-M :is([data-fact="buyPacks"], [data-fact="cosmetics"]) > .lab { display: none; }
.ugrid .tile[data-tile="store"].s-M .shelf { display: flex; flex: 1; flex-wrap: nowrap; gap: 8px; min-height: 0; min-width: 0; }
.ugrid .tile[data-tile="store"].s-M .si { width: auto; flex: 1 1 0; min-width: 0; padding: 4px; gap: 4px; border-radius: 12px; }
.ugrid .tile[data-tile="store"].s-M .si-art { height: auto; flex: 1 1 0; min-height: 0; border-radius: 8px; }
.ugrid .tile[data-tile="store"].s-M .si-art .spk { --pw: 44px !important; }
.ugrid .tile[data-tile="store"].s-M .si-art .sh-emb { width: 44px; height: 44px; }
.ugrid .tile[data-tile="store"].s-M .si-art canvas { max-height: 100%; max-width: 100%; }
.ugrid .tile[data-tile="store"].s-M .si figcaption { display: none; }
.ugrid .tile[data-tile="store"].s-M .si-p { font-size: 11px; right: 3px; bottom: 3px; }
.ugrid .tile[data-tile="store"].s-M .si-buy { padding: 2px 6px; font-size: 12px; }
@media (max-width: ${GRID.phoneMax}px) {
  .ugrid > .tile { padding: 11px 12px; border-radius: 18px; gap: 4px; }
  .ugrid .tile header { gap: 6px; }
  .ugrid .tile .ic { width: 24px; height: 24px; border-radius: 8px; } .ugrid .tile .ic svg { width: 14px; height: 14px; }
  .ugrid .tile h3 { font-size: 13px; }
  .ugrid .qb { width: 20px; height: 20px; font-size: 11px; } .ugrid .open { width: 22px; height: 22px; }
  .ugrid .s-S .headline .big { font-size: 22px; }
  .ugrid .s-S .ring { width: 40px; height: 40px; } .ugrid .s-S .ring > span { width: 30px; height: 30px; }
  .ugrid .s-S .ava { width: 32px; height: 32px; }
  .ugrid .s-S footer .btn { padding: 6px 10px; font-size: 12.5px; }
  .ugrid .q { top: 40px; }
  /* Ladder S on a phone (render session 89): the badge gives its width to
     the rating, the tier and the rank, so each takes one line. */
  .ugrid .tile[data-tile="ladder"].s-S .badge { display: none; }
  .ugrid .tile[data-tile="ladder"].s-S .hstack > [data-fact="rank"] { font-size: 12px; }
}
`;

export function homePage(data: HomeData): string {
  const owners = ownersPayload(data, gridTileHtml);
  const pages = PLACES.map((p) => ({ ...p, from: [...p.from].map((id) => TILES.find((t) => t.id === id)!.name) }));
  const art = homeArt();
  const payload = payloadJson({ owners, boards: GRID_BOARDS, pages, takenAt: data.takenAt, theme: "light", tz: Object.values(data.owners)[0]!.daily.timeZone, grid: GRID });
  const places = PLACES.map((p) => `<a href="#/${p.id}" data-go="${p.id}" class="nav">${icon(p.icon as keyof typeof ICONS, 18)}<span>${p.name}</span></a>`).join("");
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Season 1 Home</title>
<style>
${bCss(art)}
${GRID_CSS}</style></head><body>
${mockStrip("Season 1 Home · phase 2 prototype (prototype controls, not part of the design)", owners, data.takenAt, "light")}
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
<script>${GRID_JS}</script>
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
  // Place every tile on the grid (the same code the tests run).
  function layout() {
    const g = document.getElementById('grid');
    if (!g) return;
    const phone = S.phone();
    const c = columnsFor(g.getBoundingClientRect().width, phone, D.grid);
    g.style.setProperty('--cols', c.cols); g.style.setProperty('--unit', c.unit + 'px'); g.style.setProperty('--g', c.gap + 'px');
    g.dataset.cols = c.cols; g.dataset.unit = c.unit;
    const tiles = [...g.querySelectorAll(':scope > .tile')];
    const shapes = tiles.map((t) => shapeOf(t.dataset.tile, t.dataset.size, c.unit, c.gap, D.grid));
    const p = packBoard(shapes, c.cols);
    tiles.forEach((t, i) => {
      const q = p.placed[i];
      t.style.gridColumn = (q.x + 1) + ' / span ' + q.w; t.style.gridRow = (q.y + 1) + ' / span ' + q.h;
      Object.assign(t.dataset, { x: q.x, y: q.y, w: q.w, h: q.h });
    });
    g.dataset.rows = p.rows; g.dataset.holes = p.holes;
    g.querySelectorAll(':scope > .cell').forEach((x) => x.remove());
    if (st.editing) {
      // The grid's cells, behind the tiles: resizing and moving snap to them.
      const frag = document.createDocumentFragment();
      for (let y = 0; y < p.rows + 1; y++) for (let x = 0; x < c.cols; x++) { const e = document.createElement('div'); e.className = 'cell'; e.style.gridColumn = (x + 1) + ' / span 1'; e.style.gridRow = (y + 1) + ' / span 1'; e.setAttribute('aria-hidden', 'true'); frag.appendChild(e); }
      g.prepend(frag);
    }
  }
  function draw() {
    const o = D.owners[st.owner];
    const p = S.page();
    document.querySelectorAll('.nav').forEach((a) => { if (a.dataset.go === p) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.getElementById('right').innerHTML = right(p);
    if (p === 'home') {
      const hour = Number(new Date(D.takenAt).toLocaleString('en-AU', { hour: 'numeric', hourCycle: 'h23', timeZone: D.tz }));
      const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      main.innerHTML = '<div class="top"><div><span class="kick">// home</span><h1>' + greet + ', ' + o.name + '</h1></div><span class="sp"></span><button type="button" class="btn" id="edit" aria-pressed="' + st.editing + '">' + (st.editing ? 'Done' : 'Edit board') + '</button></div>' +
        '<section class="ugrid' + (st.editing ? ' editing' : '') + '" id="grid" aria-label="Your tiles">' + st.board.map((b) => o.tiles[b.tile][S.sizeOn(b)]).join('') + '</section>' +
        (S.phone() && st.editing ? '<p class="sub">Sizes apply on a wider screen; here every tile shows its small face.</p>' : '');
      document.querySelectorAll('.tile .edit').forEach((e) => (e.hidden = !st.editing));
      layout();
      return;
    }
    const title = S.titleOf(p);
    main.innerHTML = '<div class="top"><div><span class="kick">// ' + p + '</span><h1>' + title + '</h1></div></div>' + S.stub(title, D.pages.find((x) => x.id === p));
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.qb');
    if (!b) return;
    const tile = b.closest('.tile');
    const on = !tile.classList.contains('qopen');
    tile.classList.toggle('qopen', on);
    b.setAttribute('aria-expanded', String(on));
  });
  window.addEventListener('resize', layout);
  S.start(draw);
})();
</script></body></html>`;
}
