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
import { CARDS_PER_PACK, featured, homeArt, nextAction, tileFacts, type HomeData, type OwnerData } from "./homeFacts.js";
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
// How many leading facts make a tile's headline (the rest is the body).
// Ladder's headline is the rating, the tier and the rank together (render
// session 89): the three S shows, and the left half of M.
// Daily rewards (render session 93): the next win's pay sits under the day's total.
const HEAD_FACTS: Record<string, number> = { ladder: 3, daily: 2 };

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
  const facts = tileFacts(t, size, d);
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
    `<footer>${size === "S" ? live : ""}${facts.some(isAct) ? facts.filter(isAct).join("") : `<button type="button" class="btn ${act.primary ? "pri" : ""}" data-go="${act.to}"${act.buy ? ` data-buy="${esc(act.buy)}"` : ""}${act.disabled ? " disabled" : ""}>${esc(act.label)}</button>`}</footer>` +
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
.ugrid .s-L :is([data-fact="recentMatches"], [data-fact="alerts"], [data-fact="personality"], [data-fact="lastPulls"], [data-fact="winSchedule"], [data-fact="bestCards"], [data-fact="trend"], [data-fact="buyPacks"]) { grid-column: 1 / -1; }
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
   short reason, then one line each: today, the play style (with Change),
   the play time. */
.ugrid .tile[data-tile="agent"].s-M { grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); }
.ugrid .tile[data-tile="agent"].s-M .headline [data-fact="agentName"] { flex-wrap: nowrap; gap: 8px; }
.ugrid .tile[data-tile="agent"].s-M .headline [data-fact="agentName"] .big { font-size: 18px; }
.ugrid .tile[data-tile="agent"].s-M .ava { width: 40px; height: 40px; }
.ugrid .tile[data-tile="agent"].s-M > .body { gap: 5px; justify-content: center; }
.ugrid .tile[data-tile="agent"].s-M [data-fact="agentStatus"] { gap: 2px; }
.ugrid .tile[data-tile="agent"].s-M [data-fact="agentStatus"] .why { font-size: 12px; }
.ugrid .tile[data-tile="agent"].s-M .fx.kv { display: grid; grid-template-columns: 84px minmax(0, 1fr); align-items: baseline; column-gap: 6px; font-size: 13px; line-height: 1.3; }
/* L: the name with the button beside it, the pill and its reason, today
   and the play time side by side, the deck, then the six play styles as
   choices (two columns of three). */
.ugrid .tile[data-tile="agent"].s-L { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto minmax(0, 1fr); grid-template-areas: "hd hd" "nm ft" "bd bd"; column-gap: 12px; row-gap: 6px; }
.ugrid .tile[data-tile="agent"].s-L > header { grid-area: hd; }
.ugrid .tile[data-tile="agent"].s-L > .headline { grid-area: nm; }
.ugrid .tile[data-tile="agent"].s-L > footer { grid-area: ft; align-self: center; padding: 0; }
.ugrid .tile[data-tile="agent"].s-L > .body { grid-area: bd; gap: 5px 16px; font-size: 13.5px; line-height: 1.3; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="deck"] { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; column-gap: 10px; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="deck"] .labrow { flex-direction: column; gap: 0; }
.ugrid .tile[data-tile="agent"].s-L .headline [data-fact="agentName"] .big { font-size: 21px; }
.ugrid .tile[data-tile="agent"].s-L .ava { width: 38px; height: 38px; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="agentStatus"] { grid-area: 1 / 1 / 2 / 3; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="todayRecord"] { grid-area: 2 / 1 / 3 / 3; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="playTime"] { grid-area: 3 / 1 / 4 / 3; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="deck"] { grid-area: 4 / 1 / 5 / 3; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="personality"] { grid-area: 5 / 1 / 6 / 3; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="agentStatus"] { flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="agentStatus"] .why { font-size: 12.5px; }
/* Play style (render session 90, owner 2026-11-27 note 6): the six drawn as
   choices, not a list. The current one: a check, an accent edge and
   "Current". The others read as tappable: a pointer, a visible hover (lifts,
   accent edge) and press (sinks, deeper tint); .hov and .prs draw the same
   two states for the states sheet and its contrast check. Every choice is a
   link to My agent with that style ready to confirm. */
.tile[data-tile="agent"] [data-fact="personality"] .sn { font-weight: 750; }
.tile[data-tile="agent"] [data-fact="personality"] .val { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 0 8px; }
.tile[data-tile="agent"] .subt { font-size: 11.5px; color: var(--muted); }
.tile[data-tile="agent"] .plain { font-size: 11.5px; line-height: 1.3; color: var(--muted); }
.tile[data-tile="agent"] .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 6px; margin: 0; padding: 0; list-style: none; }
.tile[data-tile="agent"] .choice { display: flex; flex-direction: column; min-width: 0; padding: 1px 8px 2px 7px; border-radius: 9px; background: var(--soft); box-shadow: var(--soft-edge), inset 0 0 0 1px var(--line); color: var(--ink); text-decoration: none; font-size: 12.5px; line-height: 1.16; cursor: pointer; transition: background-color .12s, box-shadow .12s, transform .12s; -webkit-tap-highlight-color: transparent; }
.tile[data-tile="agent"] .choice .cn { display: flex; align-items: center; gap: 4px; min-width: 0; }
.tile[data-tile="agent"] .choice .cn b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tile[data-tile="agent"] .choice .ct { color: var(--muted); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile[data-tile="agent"] .choice .tick, .tile[data-tile="agent"] .choice .cur { display: none; }
.tile[data-tile="agent"] .choice.on { background: color-mix(in srgb, var(--accent) 14%, var(--soft)); box-shadow: inset 3px 0 0 var(--accent), inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 70%, transparent); cursor: default; }
.tile[data-tile="agent"] .choice.on .tick { display: inline-grid; place-items: center; flex: none; width: 15px; height: 15px; border-radius: 50%; background: var(--accent); color: #fff; }
.tile[data-tile="agent"] .choice.on .cur { display: inline; margin-left: auto; flex: none; font: 750 9.5px ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; color: color-mix(in srgb, var(--accent) 55%, var(--ink)); }
.tile[data-tile="agent"] .choice:not(.on):is(:hover, .hov) { background: color-mix(in srgb, var(--accent) 9%, var(--soft)); box-shadow: 0 3px 10px rgba(30,30,90,.14), inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 50%, transparent); transform: translateY(-1px); }
.tile[data-tile="agent"] .choice:not(.on):is(:active, .prs) { background: color-mix(in srgb, var(--accent) 20%, var(--soft)); box-shadow: inset 0 1px 3px rgba(30,30,90,.22), inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 65%, transparent); transform: translateY(0) scale(.98); }
.tile[data-tile="agent"] .choice:is(.on, :hover, .hov, :active, .prs) .ct { color: color-mix(in srgb, var(--muted) 55%, var(--ink)); }
.tile[data-tile="agent"] .choice:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.tile[data-tile="agent"] .chg { cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .tile[data-tile="agent"] .choice { transition: none; } .tile[data-tile="agent"] .choice:not(.on):is(:hover, .hov, :active, .prs) { transform: none; } }
.ugrid .tile[data-tile="agent"].s-L [data-fact="personality"] { gap: 1px; }
.ugrid .tile[data-tile="agent"].s-L .choices { margin-top: 2px; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="personality"] .labrow { gap: 6px; }
/* L: today and the play time each one full-width line, the label beside
   its value (render session 90), so the six choices have their room. */
.ugrid .tile[data-tile="agent"].s-L :is([data-fact="todayRecord"], [data-fact="playTime"]) { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: baseline; column-gap: 8px; }
.ugrid .tile[data-tile="agent"].s-L [data-fact="deck"] .labrow { width: 76px; }
.ugrid .tile[data-tile="agent"].s-L .lab { white-space: nowrap; }
/* M: the style's name and Change on one line. */
.ugrid .tile[data-tile="agent"].s-M [data-fact="personality"] .val { flex-wrap: nowrap; min-width: 0; gap: 0 6px; }
.ugrid .tile[data-tile="agent"].s-M [data-fact="personality"] .chg { font-size: 11.5px; }
.ugrid .tile[data-tile="agent"].s-M [data-fact="personality"] .sn { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* S: the current style on one line under the pill. */
.ugrid .tile[data-tile="agent"].s-S [data-fact="personality"] { flex-direction: row; align-items: baseline; gap: 6px; min-width: 0; font-size: 12.5px; }
.ugrid .tile[data-tile="agent"].s-S [data-fact="personality"] .sn { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
/* Match history's W / L and Notifications' links, darkened toward the ink as the Ladder's form dots were (render 92,
   contrast.txt: W 2.9:1, the links 3.8:1). */
.ugrid .res.win { color: color-mix(in srgb, var(--ok) 50%, var(--ink)); } .ugrid .res.loss { color: color-mix(in srgb, var(--live) 50%, var(--ink)); }
.ugrid .to { color: color-mix(in srgb, var(--accent) 62%, var(--ink)); }
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
.tile[data-tile="ladder"] .chartbox { position: relative; display: block; flex: none; height: 110px; }
/* The rating chart (render 92, owner 2026-11-28 point 8): the tier names in a gutter of their own, left of the
   plot, so they never sit on the line; a big day is a step with its value (ratingChart.ts places it). */
.tile[data-tile="ladder"] .floors { position: absolute; left: 0; top: 0; bottom: 0; width: 50px; }
.tile[data-tile="ladder"] .floors > span { position: absolute; right: 5px; transform: translateY(-50%); font-size: 9.5px; font-weight: 750; line-height: 1; white-space: nowrap; color: color-mix(in srgb, var(--tc) 40%, var(--ink)); }
.tile[data-tile="ladder"] .plot { position: absolute; left: 50px; right: 0; top: 0; bottom: 0; }
.tile[data-tile="ladder"] .chart { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.tile[data-tile="ladder"] .enddot { position: absolute; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px; border-radius: 50%; background: var(--accent); }
.tile[data-tile="ladder"] .stepv { position: absolute; font-size: 10px; font-weight: 800; line-height: 14px; padding: 0 1px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.tile[data-tile="ladder"] .stepv { --tx: 0; --ty: 0; transform: translate(var(--tx), var(--ty)); }
.tile[data-tile="ladder"] .stepv[data-ax="r"] { --tx: -100%; } .tile[data-tile="ladder"] .stepv[data-ax="c"] { --tx: -50%; }
.tile[data-tile="ladder"] .stepv[data-ay="b"] { --ty: -100%; } .tile[data-tile="ladder"] .stepv[data-ay="c"] { --ty: -50%; }
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
/* The names in faction colours, darkened toward the ink to read at 4.5:1 on the glass (render 92, measured from the
   pixels in contrast.txt: Swarm's green read 2.6:1 at 72%). */
.tile[data-tile="watch"] .vs .side b { color: color-mix(in srgb, var(--fc) 45%, var(--ink)); }
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
/* Packs (render session 91). M: the packs and how many wait across the
   top (a new player's "open them" line beside them), the guarantee and Open
   a pack below; the fan a little smaller. L: the guarantee one full line. */
.ugrid .tile[data-tile="packs"].s-M { grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto minmax(0, 1fr); }
.ugrid .tile[data-tile="packs"].s-M > .headline { grid-column: 1 / -1; grid-row: 2; align-self: start; }
.ugrid .tile[data-tile="packs"].s-M > .body { grid-column: 1; grid-row: 3; align-self: end; }
.ugrid .tile[data-tile="packs"].s-M > footer { grid-column: 2; grid-row: 3; align-self: end; }
.ugrid .tile[data-tile="packs"]:is(.s-S, .s-M) .pk-fan { zoom: .84; }
.ugrid .tile[data-tile="packs"] [data-fact="unopened"] { column-gap: 6px; row-gap: 0; align-items: baseline; }
.ugrid .tile[data-tile="packs"] [data-fact="unopened"] .why { flex-basis: 100%; font-size: 12.5px; line-height: 1.3; }
.ugrid .tile[data-tile="packs"].s-M [data-fact="guarantee"] { font-size: 12.5px; line-height: 1.3; }
.ugrid .tile[data-tile="packs"].s-L [data-fact="guarantee"] { grid-column: 1 / -1; }
/* Store (render session 91, owner 2026-11-28 point 9): the packs are the
   hero. M: the credits, what they buy and See the whole Store on the left;
   the featured pack (art, price, Buy) filling the right. L: the credits and
   what they buy, then the packs on sale as a shelf filling the tile. */
.ugrid .tile[data-tile="store"].s-M { grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); grid-template-rows: auto auto minmax(0, 1fr) auto; grid-template-areas: "hd hd" "hl pk" "af pk" "ft pk"; }
.ugrid .tile[data-tile="store"].s-M > header { grid-area: hd; }
.ugrid .tile[data-tile="store"].s-M > .headline { grid-area: hl; grid-row: auto; grid-column: auto; align-self: start; }
.ugrid .tile[data-tile="store"] [data-fact="credits"] { flex-wrap: wrap; column-gap: 6px; row-gap: 0; }
.ugrid .tile[data-tile="store"].s-M > footer { grid-area: ft; grid-row: auto; grid-column: auto; justify-content: flex-start; align-self: end; }
.ugrid .tile[data-tile="store"].s-M > footer .btn { padding: 6px 11px; font-size: 12.5px; }
.ugrid .tile[data-tile="store"].s-M > .body { display: contents; }
.ugrid .tile[data-tile="store"].s-M [data-fact="affordable"] { grid-area: af; }
.ugrid .tile[data-tile="store"] [data-fact="affordable"] .sub { font-size: 12.5px; line-height: 1.3; }
.ugrid .tile[data-tile="store"].s-M [data-fact="buyPacks"] { grid-area: pk; min-height: 0; display: flex; }
.ugrid .tile[data-tile="store"].s-M .pb.hero { flex: 1; min-height: 0; grid-template-columns: minmax(64px, .8fr) minmax(0, 1fr); }
.ugrid .tile[data-tile="store"].s-M .pb.hero .pb-art { min-height: 0; }
.ugrid .tile.s-L[data-tile="store"]:not(.x) > .body { display: flex; flex-direction: column; flex-wrap: nowrap; gap: 6px; }
.ugrid .tile.s-L[data-tile="store"]:not(.x) [data-fact="affordable"] { flex: none; }
.ugrid .tile[data-tile="store"].s-L [data-fact="buyPacks"] { align-self: stretch; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 4px; }
.ugrid .tile[data-tile="store"].s-L .pshelf { flex: 1 1 auto; }
.ugrid .tile[data-tile="store"].s-L .pb.shelf .pb-art { min-height: 0; }
/* Collection and Daily rewards (render session 93, phase 2 group 4). The
   headline is the number and its label ("49 of 124 cards", "65 of 90
   credits from wins today"); the ring beside it is the share, so the bar
   shows at L only. */
.tile:is([data-tile="collection"], [data-tile="daily"]) :is([data-fact="completion"], [data-fact="earnedToday"]) { column-gap: 6px; row-gap: 1px; align-items: baseline; }
.tile:is([data-tile="collection"], [data-tile="daily"]) .of { font-size: 12.5px; line-height: 1.25; color: var(--muted); }
.ugrid .tile:is([data-tile="collection"], [data-tile="daily"]):is(.s-S, .s-M) :is([data-fact="completion"], [data-fact="earnedToday"]) .bar { display: none; }
.ugrid .tile:is([data-tile="collection"], [data-tile="daily"]):is(.s-S, .s-M) .of { flex: 1 1 100%; }
.ugrid .tile:is([data-tile="collection"], [data-tile="daily"]).s-S .headline .big { font-size: 26px; }
.ugrid .tile:is([data-tile="collection"], [data-tile="daily"]).s-S .ring { width: 44px; height: 44px; } .ugrid .tile:is([data-tile="collection"], [data-tile="daily"]).s-S .ring > span { width: 33px; height: 33px; }
.ugrid .tile:is([data-tile="collection"], [data-tile="daily"]).s-M .headline .big { font-size: 28px; }
.ugrid .tile:is([data-tile="collection"], [data-tile="daily"]).s-M .headline { gap: 10px; }
/* Collection. The rare finds as two short lines; the best cards sized to
   the unit at M (three) and to the width at L (five in a row). */
.tile[data-tile="collection"] .chs { display: flex; flex-wrap: wrap; gap: 0 10px; font-size: 12.5px; line-height: 1.3; }
.tile[data-tile="collection"] .ch { white-space: nowrap; }
.tile[data-tile="collection"] .cards { display: flex; gap: 5px; }
.ugrid .tile[data-tile="collection"].s-M { grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto minmax(0, 1fr) auto; grid-template-areas: "hd hd" "hl bc" "ch bc" "ft bc"; }
.ugrid .tile[data-tile="collection"].s-M > header { grid-area: hd; }
.ugrid .tile[data-tile="collection"].s-M > .headline { grid-area: hl; grid-row: auto; grid-column: auto; align-self: start; }
.ugrid .tile[data-tile="collection"].s-M > .body { display: contents; }
.ugrid .tile[data-tile="collection"].s-M [data-fact="chase"] { grid-area: ch; align-self: start; }
.ugrid .tile[data-tile="collection"].s-M .chs { flex-direction: column; }
.ugrid .tile[data-tile="collection"].s-M [data-fact="bestCards"] { grid-area: bc; align-self: center; gap: 4px; }
.ugrid .tile[data-tile="collection"].s-M .mcard.mc-m { width: calc(var(--unit, 200px) * .29); }
.ugrid .tile[data-tile="collection"].s-M .mc-m .mcn { font-size: 8.5px; } .ugrid .tile[data-tile="collection"].s-M .mc-m .mcs { font-size: 8px; }
.ugrid .tile[data-tile="collection"].s-M > footer { grid-area: ft; grid-row: auto; grid-column: auto; justify-content: flex-start; align-self: end; }
.ugrid .tile[data-tile="collection"].s-M > footer .btn { padding: 6px 11px; font-size: 12.5px; }
.ugrid .tile[data-tile="collection"].s-L { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto minmax(0, 1fr); grid-template-areas: "hd hd" "nm ft" "bd bd"; column-gap: 12px; row-gap: 6px; }
.ugrid .tile[data-tile="collection"].s-L > header { grid-area: hd; }
.ugrid .tile[data-tile="collection"].s-L > .headline { grid-area: nm; }
.ugrid .tile[data-tile="collection"].s-L > footer { grid-area: ft; align-self: center; padding: 0; }
.ugrid .tile[data-tile="collection"].s-L > footer .btn { padding: 6px 11px; font-size: 12.5px; }
.ugrid .tile[data-tile="collection"].s-L > .body { grid-area: bd; gap: 7px 14px; }
.ugrid .tile[data-tile="collection"].s-L [data-fact="chase"] { grid-column: 1 / -1; flex-direction: row; align-items: baseline; gap: 8px; }
.ugrid .tile[data-tile="collection"].s-L [data-fact="binder"] { grid-column: 1 / -1; gap: 3px; }
.ugrid .tile[data-tile="collection"].s-L .cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; width: 100%; }
.ugrid .tile[data-tile="collection"].s-L .mcard.mc-m { width: 100%; }
.ugrid .tile[data-tile="collection"] .lab { white-space: nowrap; }
.ugrid .tile[data-tile="collection"].s-L .bars { gap: 2px; }
.ugrid .tile[data-tile="collection"].s-L .bars li { grid-template-columns: 58px 1fr auto; font-size: 12px; line-height: 1.3; }
/* Daily rewards. Today's pay as one row of steps; a paid step keeps its
   words at full contrast, muted with a tick (it was faded to 55%). */
.tile[data-tile="daily"] .steps { flex-wrap: nowrap; gap: 4px; }
.tile[data-tile="daily"] .steps li { flex: 1 1 0; min-width: 0; padding: 3px 6px; font-size: 11.5px; line-height: 1.2; white-space: nowrap; }
.tile[data-tile="daily"] .steps li.done { opacity: 1; color: var(--muted); }
.tile[data-tile="daily"] .steps li.done b::after { content: " ✓"; }
.tile[data-tile="daily"] [data-fact="freePack"] { column-gap: 6px; row-gap: 1px; }
.tile[data-tile="daily"] [data-fact="freePack"] .sub, .tile[data-tile="daily"] [data-fact="winSchedule"] .why { font-size: 12px; line-height: 1.3; }
.tile[data-tile="daily"] [data-fact="dayReset"] { flex-direction: row; align-items: baseline; gap: 6px; font-size: 12.5px; }
.ugrid .tile[data-tile="daily"].s-S .body { gap: 3px 8px; font-size: 12.5px; line-height: 1.25; }
.tile[data-tile="daily"] .hstack { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.tile[data-tile="daily"] .hstack [data-fact="nextWinPays"] { font-size: 13px; line-height: 1.25; }
.ugrid .tile[data-tile="daily"].s-S .hstack [data-fact="nextWinPays"] { font-size: 12px; }
.ugrid .tile[data-tile="daily"].s-S .headline { align-items: flex-start; }
.ugrid .tile[data-tile="daily"].s-M { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; }
.ugrid .tile[data-tile="daily"].s-M .ring { width: 46px; height: 46px; } .ugrid .tile[data-tile="daily"].s-M .ring > span { width: 35px; height: 35px; }
.ugrid .tile[data-tile="daily"].s-M > .headline { align-self: start; }
.ugrid .tile[data-tile="daily"].s-M > .body { gap: 5px; justify-content: space-between; }
.ugrid .tile[data-tile="daily"].s-M [data-fact="winSchedule"] { gap: 3px; }
.ugrid .tile[data-tile="daily"].s-M [data-fact="winSchedule"] .why { display: none; }
.ugrid .tile[data-tile="daily"].s-M > footer .btn { padding: 6px 11px; font-size: 12.5px; }
.ugrid .tile[data-tile="daily"].s-L [data-fact="freePack"] { grid-area: 1 / 1; align-self: start; }
.ugrid .tile[data-tile="daily"].s-L [data-fact="dayReset"] { grid-area: 1 / 2; align-self: start; justify-self: end; }
.ugrid .tile[data-tile="daily"].s-L [data-fact="winSchedule"] { grid-area: 2 / 1 / 3 / 3; }
.ugrid .tile[data-tile="daily"].s-L [data-fact="paidToday"] { grid-area: 3 / 1 / 4 / 3; }
.ugrid .tile[data-tile="daily"].s-L .steps li { padding: 3px 8px; font-size: 12px; }
.ugrid .tile[data-tile="daily"].s-L .steps li b { font-size: 14px; }
.ugrid .tile[data-tile="daily"].s-L [data-fact="paidToday"] > .sub { font-size: 12.5px; line-height: 1.35; }
.tile[data-tile="daily"] .paid { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 3px 4px; }
.tile[data-tile="daily"] .paid li { display: inline-flex; align-items: baseline; gap: 4px; padding: 1px 7px; border-radius: 8px; background: var(--soft); box-shadow: var(--soft-edge); font-size: 11.5px; line-height: 1.3; white-space: nowrap; }
.tile[data-tile="daily"] .paid li b { color: color-mix(in srgb, var(--ok) 45%, var(--ink)); }
.tile[data-tile="daily"] .paid li span { color: var(--muted); }
.ugrid .tile[data-tile="daily"].s-L [data-fact="paidToday"] { grid-column: 1 / -1; }
.tile[data-tile="daily"] .pill.ok { color: color-mix(in srgb, var(--ok) 32%, var(--ink)); }
.ugrid .tile[data-tile="daily"].s-L { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto minmax(0, 1fr); grid-template-areas: "hd hd" "nm ft" "bd bd"; column-gap: 12px; row-gap: 6px; }
.ugrid .tile[data-tile="daily"].s-L > header { grid-area: hd; }
.ugrid .tile[data-tile="daily"].s-L > .headline { grid-area: nm; }
.ugrid .tile[data-tile="daily"].s-L > footer { grid-area: ft; align-self: start; padding: 0; }
.ugrid .tile[data-tile="daily"].s-L > footer .btn { padding: 6px 11px; font-size: 12.5px; }
.ugrid .tile[data-tile="daily"].s-L > .body { grid-area: bd; gap: 7px 14px; }
/* A phone's S (render session 93): the unit is narrower; the ring shrinks
   so "First win pays 30" keeps to one line. */
@media (max-width: ${GRID.phoneMax}px) {
  .ugrid .tile:is([data-tile="collection"], [data-tile="daily"]).s-S .ring { width: 38px; height: 38px; }
  .ugrid .tile:is([data-tile="collection"], [data-tile="daily"]).s-S .ring > span { width: 29px; height: 29px; }
  .ugrid .tile:is([data-tile="collection"], [data-tile="daily"]).s-S .headline { gap: 7px; }
  .ugrid .tile[data-tile="daily"].s-S .hstack [data-fact="nextWinPays"] { font-size: 11.5px; }
}
/* Match history and Notifications (render session 94, phase 2 group 4's
   second half). Each headline is a word, not a code: the last result
   ("Won", "Cancelled", "Opponent left") or how many alerts are new. */
.tile:is([data-tile="history"], [data-tile="notif"]) .hl { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
.tile:is([data-tile="history"], [data-tile="notif"]) .hl .rw { font-size: 19px; font-weight: 800; letter-spacing: -.01em; line-height: 1.1; }
.tile:is([data-tile="history"], [data-tile="notif"]) .hl .vs { font-size: 13.5px; font-weight: 650; color: var(--ink); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tile:is([data-tile="history"], [data-tile="notif"]) .hl .ln { font-size: 12px; line-height: 1.3; }
.tile:is([data-tile="history"], [data-tile="notif"]) [data-fact="lastResult"], .tile[data-tile="notif"] [data-fact="unread"] { min-width: 0; align-items: center; }
.ugrid .res.draw, .ugrid .res.void { color: var(--ink); }
.ugrid .res-art.draw, .ugrid .res-art.void, .ugrid .res-art.empty { background: var(--soft); color: color-mix(in srgb, var(--muted) 60%, var(--ink)); box-shadow: inset 0 0 0 1.5px var(--line); }
.ugrid .res-art.win { background: linear-gradient(135deg, #1f8a50, #156b5a); } .ugrid .res-art.loss { background: linear-gradient(135deg, #c8364d, #9a2d62); }
.ugrid .tile[data-tile="history"] .chip.res { display: inline-grid; place-items: center; width: 18px; height: 18px; padding: 0; border-radius: 6px; font-size: 11px; font-weight: 800; color: #fff; background: #474c66; box-shadow: none; }
.ugrid .tile[data-tile="history"] .chip.res.win { background: #0f5a33; } .ugrid .tile[data-tile="history"] .chip.res.loss { background: #8e1c31; } .ugrid .tile[data-tile="history"] .chip.res.void { background: #474c66; }
.tile[data-tile="history"] .mh { gap: 2px; }
.tile[data-tile="history"] .mh li { display: grid; grid-template-columns: 18px minmax(0, 1fr) 30px 44px 54px; align-items: center; column-gap: 7px; padding: 1px 0; font-size: 12.5px; line-height: 1.3; }
.tile[data-tile="history"] .mh li > span { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile[data-tile="history"] .mh li .who { font-weight: 600; }
.tile[data-tile="history"] .mh :is(.cr, .rt, .tm) { text-align: right; font-variant-numeric: tabular-nums; }
.tile[data-tile="history"] .mh .tm { color: var(--muted); }
.tile[data-tile="history"] .mh .rt.up { color: color-mix(in srgb, var(--ok) 50%, var(--ink)); font-weight: 700; } .tile[data-tile="history"] .mh .rt.down { color: color-mix(in srgb, var(--warn) 45%, var(--ink)); font-weight: 700; }
.tile[data-tile="history"] .mh li.hd { font: 700 9.5px ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.tile[data-tile="history"] .mh li.hd .who { font-weight: 700; }
.tile[data-tile="history"] .mh li.hd .chip { visibility: hidden; }
.tile[data-tile="history"] .mh .rp { text-align: right; font-size: 12px; font-weight: 700; text-decoration: none; color: color-mix(in srgb, var(--accent) 62%, var(--ink)); }
.tile[data-tile="history"] .mh .rp.nr { color: var(--muted); font-weight: 600; }
.tile[data-tile="history"] .mh a.rp:hover { text-decoration: underline; }
.tile[data-tile="history"] .pays { list-style: none; margin: 0 0 2px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.tile[data-tile="history"] .pays .chip { flex: none; }
.ugrid .tile[data-tile="history"]:is(.s-M, .s-L) .hl .np { display: none; } /* the list says it */
.tile[data-tile="history"] .pays li { display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 1.35; }
.tile[data-tile="history"] [data-fact="replays"].two { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; gap: 2px 10px; font-size: 12.5px; line-height: 1.3; }
.tile[data-tile="history"] [data-fact="recentMatches"] > .sub { font-size: 12.5px; line-height: 1.35; }
/* S: the result, the opponent, the line of what it paid. */
.ugrid .tile[data-tile="history"].s-S .headline { align-items: flex-start; }
.ugrid .tile[data-tile="history"].s-S .hl .rw { font-size: 17px; }
/* M: the last match on the left (with its button), the three before it on the right. */
.ugrid .tile[data-tile="history"].s-M { grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); }
.ugrid .tile[data-tile="history"].s-M > .headline { align-self: start; }
.ugrid .tile[data-tile="history"].s-M .res-art { display: none; }
.ugrid .tile[data-tile="history"].s-M .hl .ln { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.ugrid .tile[data-tile="history"].s-M > .body { justify-content: center; }
.ugrid .tile[data-tile="history"].s-M .mh li { grid-template-columns: 18px minmax(0, 1fr) 28px 42px; column-gap: 6px; }
.ugrid .tile[data-tile="history"].s-M .mh .tm { display: none; }
.ugrid .tile[data-tile="history"].s-M > footer .btn { padding: 6px 11px; font-size: 12.5px; }
/* L: the last match with the button beside it, then the six before it
   (each with its replay), then the tally and the replays. */
.ugrid .tile:is([data-tile="history"], [data-tile="notif"]).s-L { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto minmax(0, 1fr); grid-template-areas: "hd hd" "nm ft" "bd bd"; column-gap: 12px; row-gap: 6px; }
.ugrid .tile:is([data-tile="history"], [data-tile="notif"]).s-L > header { grid-area: hd; }
.ugrid .tile:is([data-tile="history"], [data-tile="notif"]).s-L > .headline { grid-area: nm; min-width: 0; }
.ugrid .tile:is([data-tile="history"], [data-tile="notif"]).s-L > footer { grid-area: ft; align-self: center; padding: 0; }
.ugrid .tile:is([data-tile="history"], [data-tile="notif"]).s-L > footer .btn { padding: 6px 11px; font-size: 12.5px; }
.ugrid .tile:is([data-tile="history"], [data-tile="notif"]).s-L > .body { grid-area: bd; display: flex; flex-direction: column; gap: 9px; }
.ugrid .tile[data-tile="history"].s-L .mh li { grid-template-columns: 18px minmax(0, 1fr) 34px 46px 62px 46px; padding: 2px 0; }
.ugrid .tile[data-tile="history"].s-L .mh li:not(.hd) { border-top: 1px solid var(--line); }
/* Notifications. Each alert a link in two lines (what, then the detail and
   when), a dot in its kind's colour, filled while it is new. */
.tile[data-tile="notif"] .bellart { flex: none; }
.tile[data-tile="notif"] [data-fact="unread"] .of { font-size: 14px; font-weight: 650; color: var(--muted); }
.ugrid .al li.new::before { display: none; }
.tile[data-tile="notif"] .al { display: flex; flex-direction: column; gap: 2px; }
.tile[data-tile="notif"] .al li { display: block; min-width: 0; }
.tile[data-tile="notif"] .alink { display: grid; grid-template-columns: 9px minmax(0, 1fr) auto; align-items: center; column-gap: 8px; padding: 2px 0; border-radius: 7px; color: var(--ink); text-decoration: none; cursor: pointer; }
.tile[data-tile="notif"] .alink:hover { background: var(--soft); }
.tile[data-tile="notif"] .alink:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; }
.tile[data-tile="notif"] .at { display: flex; flex-direction: column; min-width: 0; }
.tile[data-tile="notif"] .at > * { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile[data-tile="notif"] .at b { font-size: 12.5px; line-height: 1.25; }
.tile[data-tile="notif"] .at .sub { font-size: 11.5px; line-height: 1.25; }
.tile[data-tile="notif"] li:not(.new) .at b { font-weight: 550; color: color-mix(in srgb, var(--muted) 45%, var(--ink)); }
.tile[data-tile="notif"] .go { font-size: 12px; font-weight: 700; white-space: nowrap; color: color-mix(in srgb, var(--accent) 62%, var(--ink)); }
.tile[data-tile="notif"] .ak { display: block; width: 9px; height: 9px; border-radius: 50%; --k: var(--accent); background: var(--k); }
.tile[data-tile="notif"] li:not(.new) .ak { background: transparent; box-shadow: inset 0 0 0 1.5px var(--k); }
.tile[data-tile="notif"] .k-bigPull { --k: #c99a2e; } .tile[data-tile="notif"] .k-dailyPack { --k: var(--ok); } .tile[data-tile="notif"] .k-autoPlayStopped { --k: var(--warn); }
.tile[data-tile="notif"] .more { font-size: 12px; align-self: flex-start; }
.tile[data-tile="notif"] [data-fact="alerts"] > .hint { font-size: 12px; line-height: 1.35; margin-top: 4px; }
.tile[data-tile="notif"] [data-fact="alerts"] .ln1 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; font-size: 13px; font-weight: 650; line-height: 1.3; }
.tile[data-tile="notif"] [data-fact="alerts"] > .sub { font-size: 12.5px; line-height: 1.35; }
.tile[data-tile="notif"] .chips { display: flex; flex-wrap: wrap; gap: 4px; }
.tile[data-tile="notif"] .kf { text-decoration: none; color: var(--ink); cursor: pointer; font-size: 12px; }
.tile[data-tile="notif"] .kf:hover { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 50%, transparent); }
.tile[data-tile="notif"] .kinds { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.tile[data-tile="notif"] .kinds li { display: grid; grid-template-columns: 9px minmax(0, 1fr); align-items: baseline; column-gap: 8px; font-size: 12.5px; line-height: 1.3; }
.tile[data-tile="notif"] [data-fact="alertKinds"] > .sub { font-size: 12px; line-height: 1.3; }
.ugrid .tile[data-tile="notif"].s-S .headline .big { font-size: 24px; }
.ugrid .tile[data-tile="notif"].s-S .bellart { width: 38px; height: 38px; border-radius: 12px; }
.ugrid .tile[data-tile="notif"].s-S [data-fact="alerts"] .ln1 { font-size: 12.5px; line-height: 1.25; }
.ugrid .tile[data-tile="notif"] [data-fact="alerts"]:empty { display: none; }
.ugrid .tile[data-tile="notif"]:is(.s-S, .s-M) .hl .rw { font-size: 16px; }
.ugrid .tile[data-tile="notif"].s-M .hl .ln { display: none; } /* the list beside it says it */
.ugrid .tile[data-tile="notif"].s-S .hl .rw { font-size: 16px; }
.ugrid .tile[data-tile="notif"].s-M { grid-template-columns: minmax(0, .7fr) minmax(0, 1.3fr); }
.ugrid .tile[data-tile="notif"].s-M > .headline { align-self: start; }
.ugrid .tile[data-tile="notif"].s-M > .body { justify-content: flex-start; padding-top: 4px; }
.ugrid .tile[data-tile="notif"].s-M > footer .btn { padding: 6px 11px; font-size: 12.5px; }
.ugrid .tile[data-tile="notif"].s-M .bellart { width: 40px; height: 40px; border-radius: 13px; }
.ugrid .tile[data-tile="notif"].s-M [data-fact="unread"] { flex-wrap: wrap; gap: 2px 6px; }
.ugrid .tile[data-tile="notif"].s-L [data-fact="alertKinds"]:not(:has(.kinds)) { order: -1; }
.ugrid .tile[data-tile="notif"].s-L .al { gap: 3px; }
.ugrid .tile[data-tile="notif"].s-M .al { gap: 1px; }
.ugrid .tile[data-tile="notif"].s-M .alink { padding: 1px 0; }
.tile[data-tile="notif"] [data-fact="alertKinds"] > .kv { display: flex; flex-direction: column; gap: 2px; }
.tile[data-tile="notif"] [data-fact="alertKinds"] { gap: 6px; }
/* The small cards on the glass (render session 93, measured from the
   pixels): a light finish (Prototype, Gold) left the white name at 4:1, so
   a dark scrim sits under the name and the cost badge is darker; a long
   name breaks inside the card instead of running past it. */
.ugrid .mcard::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 78%; background: linear-gradient(rgba(5,8,22,0), rgba(5,8,22,.86) 38%); }
.ugrid .mcard .mcn, .ugrid .mcard .mcs { position: relative; z-index: 2; overflow-wrap: break-word; hyphens: auto; }
.ugrid .mcard .mcs { opacity: 1; color: #d9def0; }
.ugrid .mcard .mcc, .ugrid .mcard .mcf { z-index: 2; background: rgba(0,0,0,.74); }
.ugrid .tile[data-tile="collection"].s-L .mc-m .mcn { font-size: 9.5px; }
/* My agent's Play style section (the prototype draws only this part of the
   page): the six as choices, the picked one ready to confirm. */
.ps { margin-bottom: 16px; } .ps h2 .subt { font: 600 13px system-ui, sans-serif; color: var(--muted); margin-left: 6px; }
.ps .opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; list-style: none; margin: 10px 0; padding: 0; }
.ps .opt { width: 100%; height: 100%; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; text-align: left; padding: 9px 12px; border: 0; border-radius: 12px; background: var(--soft); box-shadow: var(--soft-edge), inset 0 0 0 1px var(--line); font: 13px/1.35 system-ui, sans-serif; color: var(--ink); cursor: pointer; }
.ps .opt b { font-size: 14px; } .ps .opt span { flex: 1 1 100%; color: var(--muted); }
.ps .opt .cur { font: 750 10px ui-monospace, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; color: color-mix(in srgb, var(--accent) 55%, var(--ink)); }
.ps .opt:hover { box-shadow: 0 3px 10px rgba(30,30,90,.14), inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 50%, transparent); }
.ps .opt:active { transform: scale(.99); }
.ps .opt[aria-pressed="true"] { background: color-mix(in srgb, var(--accent) 14%, var(--soft)); box-shadow: inset 3px 0 0 var(--accent), inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 70%, transparent); }
.ps .confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--accent) 9%, var(--soft)); }
.ps .confirm p { flex: 1 1 100%; margin: 0; }
.ps .saved { padding: 8px 12px; border-radius: 12px; font-weight: 650; background: color-mix(in srgb, var(--ok) 14%, var(--soft)); color: color-mix(in srgb, var(--ok) 40%, var(--ink)); }
.ps > .btn { margin-top: 10px; }
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
  /* My agent S on a phone (render session 90): the pill on one line, so the
     play style keeps its line above the button. */
  .ugrid .tile[data-tile="agent"].s-S .pill { font-size: 11.5px; padding: 1px 8px; white-space: nowrap; }
  .ugrid .tile[data-tile="agent"].s-S [data-fact="personality"] .lab { letter-spacing: .06em; }
  /* Match history S on a phone (render session 94): a new player's line gives way to the button. */
  .ugrid .tile[data-tile="history"].s-S .hl .np { display: none; }
}
`;

export function homePage(data: HomeData): string {
  // Each owner's play styles and the agent's own (the My agent page's
  // Play style step reads them; the tiles are drawn on the server side).
  const owners = ownersPayload(data, gridTileHtml, (d) => ({ styles: d.play.playStyles, style: d.play.connectedAgent?.playStyle ?? null, live: !!d.play.liveMatch, agent: d.play.connectedAgent ? { id: d.play.connectedAgent.agentId, name: d.play.connectedAgent.name } : null, offer: d.packs.offer, credits: d.wallet.credits, perPack: CARDS_PER_PACK }));
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
  // Play style (render session 90, owner 2026-11-27 note 6). A tap on a
  // style on the My agent tile opens My agent with that style ready to
  // confirm (one more tap there); the tile never changes it itself (call 4).
  // st.style keeps what the owner confirmed in this prototype (the site
  // sends PUT /api/agents/:agentId/play-style { style }); st.pick is the
  // style waiting to be confirmed; st.saved the line shown after Confirm.
  st.style = {}; st.pick = null; st.saved = null;
  const ex = () => D.owners[st.owner].extra;
  const styleNow = () => (st.style[st.owner] ?? ex().style);
  const styleById = (id) => ex().styles.find((x) => x.id === id) || ex().styles[0];
  const escH = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // The tiles are drawn once per owner; after a Confirm, mark the new style
  // on whichever face is showing (S and M say its name, L marks its choice).
  function applyStyle(root) {
    const id = styleNow();
    if (!ex().agent || !id) return;
    const p = styleById(id);
    root.querySelectorAll('.tile[data-tile="agent"]').forEach((t) => {
      t.querySelectorAll('[data-style-name]').forEach((b) => { b.textContent = p.name; b.title = p.summary; });
      t.querySelectorAll('.choice').forEach((c) => {
        const on = c.dataset.style === id;
        c.classList.toggle('on', on);
        if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
        const s = styleById(c.dataset.style).summary;
        c.title = s + (on ? ' (its play style now)' : ' Tap to choose it on My agent.');
      });
    });
  }
  // My agent's Play style section: the six as choices, the picked one ready
  // to confirm.
  function stylePanel() {
    const x = ex();
    if (!x.agent) return '<section class="pg ps" id="playstyle" aria-labelledby="ps-h"><h2 id="ps-h">Play style <span class="subt">personality</span></h2><p class="sub">Connect an agent first; then choose how it plays.</p></section>';
    const now = styleNow();
    const pick = st.pick && st.pick !== now ? st.pick : null;
    const sel = pick || now;
    const opts = x.styles.map((p) => '<li><button type="button" class="opt' + (p.id === now ? ' now' : '') + '" data-pick="' + p.id + '" aria-pressed="' + (p.id === sel) + '"><b>' + escH(p.name) + '</b>' + (p.id === now ? '<i class="cur">Current</i>' : '') + '<span>' + escH(p.summary) + '</span></button></li>').join('');
    const msg = st.saved ? '<p class="saved" role="status">' + escH(st.saved) + '</p>' : '';
    const ask = pick
      ? '<div class="confirm" role="group" aria-label="Confirm the play style"><p><b>Play as ' + escH(styleById(pick).name) + '?</b> ' + escH(x.agent.name) + ' plays this way from its next match' + (x.live ? '; the match on now finishes as ' + escH(styleById(now).name) : '') + '.</p><button type="button" class="btn pri" id="ps-ok">Confirm ' + escH(styleById(pick).name) + '</button><button type="button" class="btn" id="ps-keep">Keep ' + escH(styleById(now).name) + '</button></div>'
      : (st.saved ? '' : '<p class="sub">' + escH(styleById(now).name) + ' is its play style now. Pick another to change it.</p>');
    return '<section class="pg ps" id="playstyle" aria-labelledby="ps-h"><h2 id="ps-h">Play style <span class="subt">personality</span></h2><p class="sub">It changes how ' + escH(x.agent.name) + ' plays, from its next match.</p><ul class="opts">' + opts + '</ul>' + ask + msg + '<button type="button" class="btn" data-go="home">Back to Home</button></section>';
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-style], [data-pick], #ps-ok, #ps-keep');
    if (!t) return;
    // A style on the tile: remember it; the shell then opens My agent.
    if (t.dataset.style !== undefined) { st.pick = t.dataset.style || null; st.saved = null; return; }
    if (t.dataset.pick) { st.pick = t.dataset.pick; st.saved = null; }
    else if (t.id === 'ps-ok') { st.style[st.owner] = st.pick; st.saved = 'Saved: ' + ex().agent.name + ' plays as ' + styleById(st.pick).name + ' from its next match.'; st.pick = null; }
    else { st.pick = null; st.saved = null; }
    draw();
    const f = document.querySelector(t.id === 'ps-ok' ? '.ps .saved' : '.ps [aria-pressed="true"]');
    if (f && f.focus) { if (f.tagName === 'P') f.tabIndex = -1; f.focus({ preventScroll: true }); }
  });
  // Buying packs (render session 91, owner 2026-11-28 point 9). A Buy on
  // the Store tile opens the Store (Cards) with that purchase ready to
  // confirm; the tile never spends credits itself. The site then sends
  // POST /api/packs/buy { setCode, count } (all or none); here the
  // prototype only says what was bought. st.buy is the purchase waiting.
  st.buy = null; st.bought = null;
  const n0 = (x) => Number(x).toLocaleString('en-AU');
  function buyPanel() {
    const x = ex();
    if (!st.buy && !st.bought) return '';
    if (st.bought) return '<section class="pg ps buy" aria-labelledby="buy-h"><h2 id="buy-h">Packs</h2><p class="saved" role="status" tabindex="-1">' + escH(st.bought) + '</p><button type="button" class="btn" data-go="home">Back to Home</button></section>';
    const [code, cnt] = st.buy.split(':');
    const o = x.offer.find((q) => q.setCode === code) || x.offer[0];
    const count = Number(cnt) || 1, price = o.priceCredits * count, left = x.credits - price;
    const what = (count === 1 ? '1 ' + o.name + ' pack' : count + ' ' + o.name + ' packs') + ' (' + count * x.perPack + ' cards)';
    return '<section class="pg ps buy" aria-labelledby="buy-h"><h2 id="buy-h">Buy packs</h2><div class="confirm" role="group" aria-label="Confirm the purchase"><p><b>Buy ' + escH(what) + ' for ' + n0(price) + ' credits?</b> ' +
      (left >= 0 ? 'You keep ' + n0(left) + ' credits; the packs wait in Packs to open.' : 'You have ' + n0(x.credits) + ' credits: ' + n0(-left) + ' short.') + '</p>' +
      (left >= 0 ? '<button type="button" class="btn pri" id="buy-ok">Buy for ' + n0(price) + '</button>' : '') + '<button type="button" class="btn" id="buy-no">Cancel</button></div></section>';
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-buy], #buy-ok, #buy-no');
    if (!t) return;
    // A Buy on the tile: remember it; the shell then opens Cards.
    if (t.dataset.buy) { st.buy = t.dataset.buy; st.bought = null; return; }
    if (t.id === 'buy-ok') { const [code, cnt] = st.buy.split(':'); const o = ex().offer.find((q) => q.setCode === code) || ex().offer[0]; st.bought = 'Bought ' + (cnt === '1' ? '1 ' + o.name + ' pack' : cnt + ' ' + o.name + ' packs') + ' (prototype: nothing is spent). They wait in Packs.'; }
    else st.bought = null;
    st.buy = null;
    draw();
    const f = document.querySelector('.buy .saved, .buy #buy-ok, .buy #buy-no');
    if (f && f.focus) f.focus({ preventScroll: true });
  });
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
      applyStyle(main);
      layout();
      return;
    }
    const title = S.titleOf(p);
    main.innerHTML = '<div class="top"><div><span class="kick">// ' + p + '</span><h1>' + title + '</h1></div></div>' + (p === 'agent' ? stylePanel() : '') + (p === 'cards' ? buyPanel() : '') + S.stub(title, D.pages.find((x) => x.id === p));
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
