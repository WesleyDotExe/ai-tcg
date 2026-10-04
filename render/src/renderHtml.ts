import type { MatchReplay } from "./types.js";
import { CAST_FX_SOURCE } from "./castFx.js";
import { ATTACK_FX_SOURCE } from "./attackFx.js";
import { FACTION_SKIN_SOURCE } from "./factionSkin.js";
import { CANVAS_FX_PURE_SOURCE, CANVAS_FX_RUNTIME_SOURCE, fxAtlasDataUris } from "./canvasFx.js";
import { EFFECT_FX_SOURCE } from "./effectFx.js";

/** Builds the self-contained HTML replay page (RENDER.md's suggested first
 * slice): a single file, no external network dependency (no CDN fonts/JS —
 * this has to keep working when opened offline straight from the repo), that
 * plays a captured match back turn by turn. All data is embedded as JSON;
 * all interactivity is one inline <script>, vanilla DOM, no framework —
 * matching the project's own zero-dependency instinct (see agents/'s own
 * package.json comment) for something this self-contained. */
export function renderMatchHtml(replay: MatchReplay): string {
  const dataJson = JSON.stringify(replay).replace(/</g, "\\u003c");
  // EFFECTS.md v2 sprite atlases, embedded so the page stays self-contained.
  const atlasJson = JSON.stringify(fxAtlasDataUris());
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(replay.title)} — AI-TCG replay</title>
<style>${CSS}</style>
</head>
<body>
<div class="crt-overlay" aria-hidden="true"></div>
<header class="matchbar">
  <div class="brand">AI·TCG // SPECTATOR REPLAY</div>
  <div class="matchup" id="matchup"></div>
  <div class="seed">seed ${replay.seed}</div>
</header>

<main id="app">
  <section class="hud-row">
    <div class="hud" id="hud-p1"></div>
    <div class="momentum" id="momentum"></div>
    <div class="hud" id="hud-p2"></div>
  </section>

  <section class="turnbar" id="turnbar"></section>

  <section class="board-area">
    <div class="board-row" id="board-p2"></div>
    <div class="stackzone" id="stackzone"></div>
    <div class="board-row" id="board-p1"></div>
  </section>

  <section class="lower">
    <div class="hand" id="hand-p1"></div>
    <div class="eventlog" id="eventlog"></div>
    <div class="hand" id="hand-p2"></div>
  </section>

  <section class="controls">
    <button id="btn-first" title="First move">|&lt;</button>
    <button id="btn-prev" title="Previous move">&lt;</button>
    <button id="btn-play" title="Play / pause">&#9654;</button>
    <button id="btn-next" title="Next move">&gt;</button>
    <button id="btn-last" title="Last move">&gt;|</button>
    <input type="range" id="scrubber" min="0" value="0" step="1">
    <span id="framecount" class="framecount"></span>
    <label class="speedlabel">speed
      <select id="speed">
        <option value="1400">slow</option>
        <option value="700" selected>normal</option>
        <option value="250">fast</option>
      </select>
    </label>
  </section>
</main>

<script type="application/json" id="match-data">${dataJson}</script>
<script type="application/json" id="fx-atlases">${atlasJson}</script>
<script>${JS}</script>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const CSS = `
:root {
  --bg: #070912;
  --panel: #0d1220;
  --panel-2: #121a2e;
  --ink: #d7e6ff;
  --ink-dim: #8ea3c9;
  --line: #24314f;
  --good: #35e6a0;
  --bad: #ff4d6d;
  --neutral: #ffcf5c;
  --cortex: #35c9ff;
  --aegis: #ff7d24;
  --swarm: #8bff5c;
  --null: #d565ff;
  --shield: #6fe3ff;
  --armor: #9fb4c9;
  --penalty: #b3bbd6;
  --cast: #d9c8ff;
  font-size: 15px;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; background: var(--bg); color: var(--ink);
  font-family: "Courier New", "Consolas", ui-monospace, monospace;
  min-height: 100vh;
}
.crt-overlay {
  position: fixed; inset: 0; pointer-events: none; z-index: 50; mix-blend-mode: overlay;
  background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 2px, transparent 3px);
}
.matchbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 18px; background: linear-gradient(180deg, #0b0f1c, #090c16);
  border-bottom: 1px solid var(--line);
  text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.85rem;
}
.brand { color: var(--ink-dim); }
.matchup { font-weight: bold; letter-spacing: 0.12em; }
.matchup .vs { color: var(--ink-dim); margin: 0 0.5em; }
.seed { color: var(--ink-dim); font-size: 0.75rem; }
#app { max-width: 1180px; margin: 0 auto; padding: 14px 12px 24px; position: relative; z-index: 1; }
/* EFFECTS.md v2 canvases (render/src/canvasFx.ts): the floor sits under
 * the board (the background grid impacts warp, then ground marks and
 * settled debris), the FX canvas over the cards but under the floating
 * numbers and tags in .fx-layer. */
.fx-canvas { position: fixed; left: 0; top: 0; pointer-events: none; }
.fx-canvas.fx-floor { z-index: 0; }
/* The camera beats (canvasFx.ts: punch, shake, colour split) transform
 * #app for a fraction of a second, and only then: no will-change, which
 * would keep the whole board on its own layer for the entire replay. */
.fx-canvas.fx-top { z-index: 89; }

.hud-row { display: grid; grid-template-columns: 1fr 220px 1fr; gap: 10px; align-items: stretch; margin-bottom: 8px; }
.hud { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; }
.hud .name { font-weight: bold; letter-spacing: 0.05em; display: flex; justify-content: space-between; }
.hud .ident { display: flex; align-items: center; gap: 8px; min-width: 0; }
.hud .ident .uname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Player identity (owner-feedback 2026-09-26): name + avatar + faction
 * colour together. The avatar box takes a real image (identity.avatarUrl)
 * when one exists; until then a username-seeded SVG placeholder whose body
 * paints in the faction colour (currentColor). */
.avatar { width: 38px; height: 38px; flex-shrink: 0; border-radius: 8px; color: var(--fc); box-shadow: 0 0 0 1px var(--fc), 0 0 10px -2px var(--fc); overflow: hidden; display: block; }
.avatar svg, .avatar img { width: 100%; height: 100%; display: block; object-fit: cover; }
.matchup .avatar { width: 20px; height: 20px; border-radius: 4px; display: inline-block; vertical-align: middle; margin-right: 6px; }
.hud .name { align-items: center; }
.hud .faction-tag { font-size: 0.7rem; padding: 1px 6px; border-radius: 3px; border: 1px solid currentColor; }
.bar-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 0.78rem; }
.bar-track { flex: 1; height: 9px; background: #050810; border: 1px solid var(--line); border-radius: 5px; overflow: hidden; }
.bar-fill { height: 100%; transition: width 420ms ease; }
.bar-fill.health { background: linear-gradient(90deg, #ff4d6d, #ff8a5c); }
.bar-fill.energy { background: linear-gradient(90deg, #35c9ff, #7de3ff); }
.hud .meta { display: flex; gap: 10px; margin-top: 6px; font-size: 0.72rem; color: var(--ink-dim); }

.momentum { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
.momentum .label { font-size: 0.62rem; color: var(--ink-dim); letter-spacing: 0.1em; margin-bottom: 5px; }
.momentum .gauge { width: 100%; height: 10px; background: #050810; border: 1px solid var(--line); border-radius: 5px; position: relative; overflow: hidden; }
.momentum .gauge .mid { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--line); }
.momentum .gauge .fill { position: absolute; top: 0; bottom: 0; background: var(--neutral); transition: left 420ms ease, width 420ms ease, background 420ms ease; }
.momentum .why { font-size: 0.66rem; color: var(--ink-dim); margin-top: 6px; min-height: 2.4em; }

.turnbar { text-align: center; padding: 6px; font-size: 0.8rem; letter-spacing: 0.08em; color: var(--ink-dim); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-bottom: 10px; }
.turnbar b { color: var(--ink); }
.turnbar .win { color: var(--neutral); font-weight: bold; }

.board-area { position: relative; }
.board-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; padding: 8px 0; min-height: 168px; }
.stackzone { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; min-height: 22px; margin: 2px 0; }
.stackitem { font-size: 0.68rem; background: var(--panel-2); border: 1px dashed var(--neutral); color: var(--neutral); padding: 2px 8px; border-radius: 3px; }

.slot { width: 118px; height: 158px; border-radius: 6px; position: relative; flex-shrink: 0; }
.slot.empty { border: 1px dashed var(--line); background: repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 6px, transparent 6px 12px); }

.card { width: 118px; height: 158px; border-radius: 6px; position: relative; overflow: hidden;
  border: 1px solid var(--line); display: flex; flex-direction: column; color: #0a0e18; }
.card .art { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; padding: 4px; }
.card .art .glyph { font-size: 1.6rem; opacity: 0.85; }
.card .head { display: flex; justify-content: space-between; align-items: center; padding: 2px 4px; font-size: 0.6rem; background: rgba(0,0,0,0.28); }
.card .cost { background: rgba(0,0,0,0.55); color: #fff; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 0.62rem; }
.card .name { font-size: 0.62rem; font-weight: bold; line-height: 1.05; padding: 2px 5px; background: rgba(0,0,0,0.35); color: #fff; }
.card .stats { display: flex; justify-content: space-between; padding: 3px 5px; font-size: 0.72rem; font-weight: bold; background: rgba(0,0,0,0.42); color: #fff; }
.card .stats .atk::before { content: "\\2694 "; }
.card .stats .hp::before { content: "\\2665 "; }
/* Persistent buff/penalty state (EFFECTS.md slice 2): the rise/sink
 * animation says "it just changed"; these keep saying "it is still above /
 * below its printed stat" for as long as that's true. Health compares MAX
 * health to printed, so ordinary damage never reads as a debuff. */
.card .stats .up { color: #ffd76a; text-shadow: 0 0 6px rgba(255,215,106,0.55); }
.card .stats .down { color: var(--penalty); }
.card .stats .up::after { content: "\\25B2"; font-size: 0.5rem; vertical-align: 2px; margin-left: 1px; }
.card .stats .down::after { content: "\\25BC"; font-size: 0.5rem; vertical-align: 1px; margin-left: 1px; }
.card .tags { position: absolute; top: 2px; left: 2px; display: flex; flex-direction: column; gap: 2px; z-index: 2; }
.card .tag { font-size: 0.52rem; padding: 1px 3px; border-radius: 2px; background: rgba(0,0,0,0.55); color: #fff; letter-spacing: 0.03em; }

/* Defence/shield primitives (EFFECTS.md slice 1, render-lane session 4):
 * persistent badges for the two defensive traits that are true of a unit
 * for as long as it holds them, not just for one animated instant — Guard
 * (always true while the keyword's held) and an active Barrier (true only
 * until it's consumed; driven by the live barrierActive snapshot field,
 * not the static keywords list, so the badge correctly disappears the
 * moment the shield breaks instead of lying about a spent shield). */
.card .shields { position: absolute; top: 2px; right: 2px; display: flex; flex-direction: column; gap: 2px; z-index: 2; }
.shield-badge { font-size: 0.6rem; font-weight: bold; line-height: 1; width: 13px; height: 13px; display: flex; align-items: center; justify-content: center; border-radius: 3px; background: rgba(0,0,0,0.55); }
.shield-badge.shield-guard { color: #cfd8e3; box-shadow: 0 0 0 1px rgba(207,216,227,0.7) inset; }
.shield-badge.shield-barrier { color: var(--shield); box-shadow: 0 0 5px var(--shield), 0 0 0 1px var(--shield) inset; animation: shield-idle-pulse 1.8s ease-in-out infinite; }
@keyframes shield-idle-pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
/* Penalty statuses share the badge column with the shields but read as the
 * opposite: dim, desaturated, dashed — "something is wrong with this unit". */
.shield-badge.status-penalty { color: var(--penalty); background: rgba(20,20,28,0.8); box-shadow: 0 0 0 1px var(--penalty) inset; border: 1px dashed transparent; }
.card.has-stasis .art { filter: grayscale(0.7); }
.card.pending { filter: grayscale(0.55) brightness(0.75); }
.card.pending::after { content: "ARMING"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 0.6rem; letter-spacing: 0.15em; color: var(--neutral); background: repeating-linear-gradient(45deg, rgba(0,0,0,0.55) 0 6px, rgba(0,0,0,0.7) 6px 12px); z-index: 1; }
.card .arm-count { position: absolute; bottom: 2px; right: 2px; font-size: 0.55rem; color: var(--neutral); background: rgba(0,0,0,0.6); padding: 1px 4px; border-radius: 3px; z-index: 2; }
.card .tools { flex-shrink: 0; display: flex; gap: 2px; flex-wrap: wrap; padding: 1px 4px 2px; background: rgba(0,0,0,0.32); }
.card .tool-chip { font-size: 0.5rem; background: rgba(0,0,0,0.6); color: #fff; padding: 1px 3px; border-radius: 2px; }

.rarity-Common { box-shadow: none; }
.rarity-Uncommon { box-shadow: 0 0 0 1px rgba(255,255,255,0.25) inset; }
.rarity-Rare { box-shadow: 0 0 8px 1px var(--rc), 0 0 0 1px var(--rc) inset; }
.rarity-Mythic { box-shadow: 0 0 14px 3px var(--rc), 0 0 0 1px var(--rc) inset; animation: pulse 2.2s ease-in-out infinite; }
@keyframes pulse { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.18); } }

.faction-Cortex { --fc: var(--cortex); --rc: #35c9ff; }
.faction-Aegis { --fc: var(--aegis); --rc: #ffc29a; }
.faction-Swarm { --fc: var(--swarm); --rc: #b6ff8f; }
.faction-Null { --fc: var(--null); --rc: #e79bff; }
/* Neutral cards (engine data/neutralCards.ts) take the UI gold, so the frame
 * matches the fx tints, which read var(--<faction>) = var(--neutral). A
 * palette of their own is a render-lane call. */
.faction-Neutral { --fc: var(--neutral); --rc: #ffe4a0; }
.card.faction-Cortex, .card.faction-Aegis, .card.faction-Swarm, .card.faction-Null, .card.faction-Neutral { background: var(--fc); }

.lower { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 10px; margin-top: 12px; }
.hand { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px; display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start; min-height: 90px; }
.hand .minicard { font-size: 0.62rem; padding: 3px 6px; border-radius: 3px; border: 1px solid var(--line); background: var(--panel-2); color: var(--ink); }
.hand .minicard b { color: var(--fc, var(--ink)); }
.hand-label { width: 100%; font-size: 0.6rem; color: var(--ink-dim); letter-spacing: 0.1em; margin-bottom: 2px; }

.eventlog { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; font-size: 0.72rem; max-height: 220px; overflow-y: auto; }
.eventlog .turn-hdr { color: var(--neutral); margin-top: 6px; }
.eventlog .ev { color: var(--ink-dim); white-space: pre-wrap; }
.eventlog .ev.now { color: var(--ink); }
.eventlog .ev.gameover { color: var(--good); font-weight: bold; }

.controls { display: flex; align-items: center; gap: 8px; justify-content: center; margin-top: 14px; flex-wrap: wrap; }
.controls button { background: var(--panel-2); border: 1px solid var(--line); color: var(--ink); border-radius: 4px; padding: 5px 10px; cursor: pointer; font-family: inherit; }
.controls button:hover { border-color: var(--cortex); }
.controls #scrubber { width: 320px; }
.framecount { font-size: 0.75rem; color: var(--ink-dim); min-width: 90px; }
.speedlabel { font-size: 0.72rem; color: var(--ink-dim); display: flex; gap: 4px; align-items: center; }
.speedlabel select { background: var(--panel-2); color: var(--ink); border: 1px solid var(--line); }

/* Per-move transitions (RENDER.md render-lane session 2): the board no
 * longer just snaps to the next frame — plays, deaths, attacks, damage/heal,
 * telegraph arming, evolution, and stat buffs each get a distinct, brief,
 * readable animation. Driven entirely off frame-to-frame diffs keyed by
 * instanceId (see the JS's runFx), not by parsing event text, so it stays
 * correct even in a mirror match where both players run the same card/agent
 * name. */
.fx-layer { position: fixed; inset: 0; pointer-events: none; z-index: 90; }

.fx-ghost { animation: fx-exit 650ms ease forwards; }
@keyframes fx-exit {
  0% { opacity: 1; transform: translateY(0) scale(1); filter: none; }
  100% { opacity: 0; transform: translateY(18px) scale(0.7); filter: grayscale(1) brightness(0.55); }
}

.card.fx-enter { animation: fx-enter 480ms cubic-bezier(.22,.9,.32,1.1); }
@keyframes fx-enter {
  0% { opacity: 0; transform: translateY(24px) scale(0.85); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.board-row#board-p1 .card.fx-attack { animation: fx-lunge-up 380ms ease; }
.board-row#board-p2 .card.fx-attack { animation: fx-lunge-down 380ms ease; }
@keyframes fx-lunge-up { 0%, 100% { transform: translateY(0); } 45% { transform: translateY(-14px) scale(1.05); } }
@keyframes fx-lunge-down { 0%, 100% { transform: translateY(0); } 45% { transform: translateY(14px) scale(1.05); } }

.card.fx-hit, .hud.fx-hit { animation: fx-hit-flash 420ms ease; }
@keyframes fx-hit-flash {
  0% { box-shadow: 0 0 0 3px var(--bad) inset, 0 0 16px var(--bad); }
  100% { box-shadow: none; }
}
.card.fx-heal, .hud.fx-heal { animation: fx-heal-flash 420ms ease; }
@keyframes fx-heal-flash {
  0% { box-shadow: 0 0 0 3px var(--good) inset, 0 0 16px var(--good); }
  100% { box-shadow: none; }
}
.card.fx-armed { animation: fx-armed-flash 550ms ease; }
@keyframes fx-armed-flash {
  0% { box-shadow: 0 0 0 3px var(--neutral) inset, 0 0 18px var(--neutral); filter: brightness(1); }
  50% { filter: brightness(1.55); }
  100% { box-shadow: none; filter: brightness(1); }
}
.card.fx-evolve { animation: fx-evolve-pulse 650ms ease; }
@keyframes fx-evolve-pulse {
  0% { transform: scale(1); filter: brightness(1); }
  40% { transform: scale(1.12); filter: brightness(1.6) saturate(1.4); }
  100% { transform: scale(1); filter: brightness(1); }
}

/* Barrier interpose + absorb + shatter (EFFECTS.md slice 1): the moment a
 * unit's Barrier status is consumed. Distinct from fx-hit on purpose — a
 * fully-absorbed hit does zero health damage, so without this the unit gets
 * NO visual at all despite genuinely blocking something. Shield-cyan, not
 * the hit-flash red, since this is a defensive event, not a damage one. */
.card.fx-shatter { animation: fx-shatter-flash 500ms ease; }
@keyframes fx-shatter-flash {
  0% { box-shadow: 0 0 0 3px var(--shield) inset, 0 0 20px var(--shield); filter: brightness(1); }
  40% { filter: brightness(1.6); }
  100% { box-shadow: none; filter: brightness(1); }
}
.fx-number.shield { color: var(--shield); }

/* Base-armor deflect (EFFECTS.md slice 1): a small, deliberately UN-scaled
 * spark alongside the ordinary hit flash when a unit with baseArmor > 0
 * takes damage — "small" is the point (per the spec's own wording), so this
 * does not go through the magnitude-tier system the way fx-hit/fx-shatter
 * do. Steel-grey, distinct from both the hit-red and the shield-cyan. */
.fx-deflect-ring { position: fixed; width: 34px; height: 34px; margin-left: -17px; margin-top: -17px;
  border-radius: 50%; border: 2px solid var(--armor); pointer-events: none;
  animation: fx-deflect-ring 380ms ease-out forwards; }
@keyframes fx-deflect-ring { 0% { opacity: 0.85; transform: scale(0.3); } 100% { opacity: 0; transform: scale(1.5); } }

.fx-number { position: fixed; font-weight: bold; font-size: 0.95rem; letter-spacing: 0.02em;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8); white-space: nowrap; animation: fx-float 900ms ease forwards; }
.fx-number.dmg { color: var(--bad); }
.fx-number.heal { color: var(--good); }
.fx-number.buff { color: var(--neutral); }
.fx-number.penalty { color: var(--penalty); animation-name: fx-float-down; }
.fx-number.expire { color: var(--ink-dim); font-size: 0.7rem; }
@keyframes fx-float {
  0% { opacity: 0; transform: translateY(0); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-38px); }
}
@keyframes fx-float-down {
  0% { opacity: 0; transform: translateY(0); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translateY(38px); }
}

/* Buff (rise) and penalty (sink) grammar — EFFECTS.md slice 2. The motion
 * direction IS the meaning and never changes: a buff lifts the card, brightens
 * it and sends motes UP; a penalty presses it down, drains its colour and
 * sends motes DOWN. Faction only picks the tint (--fx-tint, set per effect
 * from the source card's faction), and the fx-mag-* tier only scales it.
 * A temporary buff wearing off gets a deliberately quiet "settle" instead —
 * it is not a penalty and must not read like one. */
.card.fx-rise { animation: fx-rise 520ms ease-out; }
@keyframes fx-rise {
  0%, 100% { transform: translateY(0); filter: none; }
  40% { transform: translateY(-7px); filter: brightness(1.45) saturate(1.35); box-shadow: 0 0 14px 2px var(--fx-tint), 0 0 0 2px var(--fx-tint) inset; }
}
.card.fx-sink { animation: fx-sink 560ms ease-in-out; }
@keyframes fx-sink {
  0%, 100% { transform: translateY(0); filter: none; }
  45% { transform: translateY(7px) scale(0.97); filter: grayscale(0.85) brightness(0.6); box-shadow: inset 0 0 20px 6px rgba(0,0,0,0.65), 0 0 9px 1px var(--fx-tint); }
}
.card.fx-settle { animation: fx-settle 300ms ease; }
@keyframes fx-settle { 50% { filter: brightness(0.88); } }
.fx-mag-spectacle.fx-rise { animation-name: fx-rise-big; }
@keyframes fx-rise-big {
  0%, 100% { transform: translateY(0) scale(1); filter: none; }
  35% { transform: translateY(-15px) scale(1.07); filter: brightness(1.7) saturate(1.5); box-shadow: 0 0 26px 7px var(--fx-tint), 0 0 0 3px var(--fx-tint) inset; }
  70% { transform: translateY(-9px) scale(1.04); filter: brightness(1.3); }
}
.fx-mag-spectacle.fx-sink { animation-name: fx-sink-big; }
@keyframes fx-sink-big {
  0%, 100% { transform: translateY(0) scale(1); filter: none; }
  35% { transform: translateY(15px) scale(0.92); filter: grayscale(1) brightness(0.45); box-shadow: inset 0 0 30px 10px rgba(0,0,0,0.75), 0 0 16px 3px var(--fx-tint); }
  70% { transform: translateY(10px) scale(0.95); filter: grayscale(0.8) brightness(0.6); }
}
/* Motes move along paths laid out by render/src/factionSkin.ts
 * (moteLayout) and animated from JS. The direction is the meaning and is
 * the caller's; the skin classes below only change what the particle looks
 * like. The desaturate on .down is meaning (a penalty drains colour), so it
 * applies to every skin. */
.fx-mote { position: fixed; width: var(--mote-size, 7px); height: var(--mote-size, 7px); margin-left: calc(var(--mote-size, 7px) / -2); background: var(--fx-tint); opacity: 0; }
.fx-mote.down { filter: saturate(0.3) brightness(0.8); }
.fx-mote.skin-neutral.up { clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.fx-mote.skin-neutral.down { clip-path: polygon(0 0, 100% 0, 50% 100%); }

/* ---- Faction skins (EFFECTS.md slice 5) --------------------------------
 * Axis 2: faction = HOW it looks. One rule set per skin, shared by every
 * primitive (mote, bolt, cast ring/sigil/rays, burst); never meaning.
 *   Cortex  packets: squares, circuit lines, dashed rounded-square rings
 *   Swarm   spores: small round cells, dotted rings, a scattering cloud
 *   Aegis   chrome: bright-edged metal plates, heavy solid rings, a slug
 *   Null    glitch: torn bars with an RGB split, stepped flicker
 *   Neutral plain: the original arrow motes, round bolt, diamond sigil */
.fx-mote.skin-cortex { border-radius: 1px; box-shadow: 0 0 4px var(--fx-tint); background: linear-gradient(var(--fx-tint), var(--fx-tint)) center / 45% 45% no-repeat, rgba(10,14,24,0.85); outline: 1.5px solid var(--fx-tint); outline-offset: -1.5px; }
.fx-mote.skin-swarm { border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fff 0 18%, var(--fx-tint) 45%, transparent 75%); }
.fx-mote.skin-aegis { clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%); background: linear-gradient(135deg, #ffffff 0%, var(--fx-tint) 45%, #4d5d6b 100%); }
.fx-mote.skin-null { height: 3px; width: calc(var(--mote-size, 7px) * 2); margin-left: calc(var(--mote-size, 7px) * -1); box-shadow: -3px 0 0 rgba(255,46,110,0.85), 3px 0 0 rgba(46,240,255,0.85); }

.fx-bolt.skin-cortex { border-radius: 2px; background: radial-gradient(circle, #fff 0 25%, var(--fx-tint) 30%); outline: 1px solid rgba(255,255,255,0.6); outline-offset: 1px; }
.fx-bolt.skin-cortex.trail { opacity: 0.6; background: var(--fx-tint); outline: none; box-shadow: 0 0 4px var(--fx-tint); }
.fx-bolt.skin-swarm { background: radial-gradient(circle at 40% 40%, #fff 0 15%, var(--fx-tint) 40%, transparent 72%); box-shadow: 0 0 8px var(--fx-tint); }
.fx-bolt.skin-swarm.cloud { opacity: 0.8; box-shadow: none; }
.fx-bolt.skin-aegis { border-radius: 50% / 50%; background: linear-gradient(to bottom, #ffffff 0%, var(--fx-tint) 38%, #3f4d59 100%); box-shadow: 0 0 6px #fff, 0 0 16px var(--fx-tint); }
.fx-bolt.skin-null { border-radius: 1px; background: var(--fx-tint); box-shadow: 4px 0 0 rgba(255,46,110,0.85), -4px 0 0 rgba(46,240,255,0.85), 0 0 10px var(--fx-tint); }
.fx-bolt.skin-null.trail { opacity: 0.45; box-shadow: 3px 0 0 rgba(255,46,110,0.6), -3px 0 0 rgba(46,240,255,0.6); }

.fx-cast-ring.skin-cortex, .fx-burst.skin-cortex { border-style: dashed; border-radius: 22%; }
.fx-cast-ring.skin-swarm, .fx-burst.skin-swarm { border-style: dotted; border-width: 4px; }
.fx-cast-ring.skin-aegis, .fx-burst.skin-aegis { border-width: 4px; box-shadow: 0 0 0 2px rgba(255,255,255,0.55) inset, 0 0 14px var(--fx-tint, var(--burst-color)); }
.fx-cast-ring.skin-null, .fx-burst.skin-null { border-radius: 2px; box-shadow: 4px 0 0 rgba(255,46,110,0.7), -4px 0 0 rgba(46,240,255,0.7); animation-timing-function: steps(5, end); }
.fx-cast-sigil.skin-cortex { outline: 1px solid var(--fx-tint); outline-offset: 3px; }
.fx-cast-sigil.skin-swarm { border-radius: 50%; border-style: dotted; border-width: 3px; }
.fx-cast-sigil.skin-aegis { border: none; clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%); background: linear-gradient(135deg, #ffffff 0%, var(--fx-tint) 50%, #3f4d59 100%); }
.fx-cast-sigil.skin-null { clip-path: polygon(0 0, 55% 0, 55% 30%, 100% 30%, 100% 100%, 40% 100%, 40% 70%, 0 70%); background: var(--fx-tint); animation-timing-function: steps(6, end); }
.fx-cast-ray.skin-cortex { width: 2px; background: var(--fx-tint); border-radius: 0; }
.fx-cast-ray.skin-swarm { width: 5px; height: 5px; margin-left: -2.5px; margin-top: -2.5px; border-radius: 50%; background: var(--fx-tint); }
.fx-cast-ray.skin-aegis { width: 6px; height: 14px; margin-left: -3px; border-radius: 1px; background: linear-gradient(to right, #ffffff, var(--fx-tint) 50%, #3f4d59); }
.fx-cast-ray.skin-null { background: repeating-linear-gradient(to top, var(--fx-tint) 0 3px, transparent 3px 6px); animation-timing-function: steps(4, end); }

/* Magnitude scaling (RENDER.md render-lane session 3, per owner feedback
 * 2026-09-25 "scale animation magnitude to event magnitude"): every FX class
 * above is the NORMAL tier. Subtle/spectacle modifier classes retune the
 * same animation's duration/size/glow rather than invent new motion, so a
 * 1-damage ping and a lethal blow use the same visual language at very
 * different volumes. Applied together with the base class, e.g.
 * class="card fx-hit fx-mag-spectacle". Tier is computed in JS (magnitudeOf
 * section below) from the effect's own weight (rarity, amount, AOE count,
 * unconditional-destroy) and/or the momentum swing — never from event text
 * identity (that stays the instanceId diff, per session 2's own guardrail
 * reasoning). */
.fx-mag-subtle { animation-duration: 260ms !important; }
.fx-mag-subtle.fx-hit, .fx-mag-subtle.fx-heal, .fx-mag-subtle.fx-rise, .fx-mag-subtle.fx-shatter { box-shadow: none !important; filter: brightness(1.12); }
.fx-mag-spectacle { animation-duration: 900ms !important; }

.fx-number.mag-subtle { font-size: 0.7rem; opacity: 0.85; animation-duration: 550ms; }
.fx-number.mag-spectacle { font-size: 1.55rem; animation-duration: 1300ms; text-shadow: 0 0 10px currentColor, 0 1px 3px rgba(0,0,0,0.9); }

.fx-mag-spectacle.fx-hit, .fx-mag-spectacle.hud.fx-hit { animation-name: fx-hit-flash-big; }
@keyframes fx-hit-flash-big {
  0% { box-shadow: 0 0 0 5px var(--bad) inset, 0 0 34px 6px var(--bad); transform: scale(1); }
  30% { transform: scale(1.06); }
  100% { box-shadow: none; transform: scale(1); }
}
.fx-mag-spectacle.fx-heal, .fx-mag-spectacle.hud.fx-heal { animation-name: fx-heal-flash-big; }
@keyframes fx-heal-flash-big {
  0% { box-shadow: 0 0 0 5px var(--good) inset, 0 0 34px 6px var(--good); }
  100% { box-shadow: none; }
}
.fx-mag-spectacle.fx-shatter { animation-name: fx-shatter-flash-big; }
@keyframes fx-shatter-flash-big {
  0% { box-shadow: 0 0 0 5px var(--shield) inset, 0 0 36px 6px var(--shield); transform: scale(1); filter: brightness(1); }
  35% { transform: scale(1.1); filter: brightness(1.9); }
  100% { box-shadow: none; transform: scale(1); filter: brightness(1); }
}
.fx-mag-spectacle.fx-enter { animation: fx-enter-big 900ms cubic-bezier(.22,.9,.32,1.1); }
@keyframes fx-enter-big {
  0% { opacity: 0; transform: translateY(30px) scale(0.6) rotate(-4deg); filter: brightness(2); }
  60% { opacity: 1; transform: translateY(-6px) scale(1.08) rotate(1deg); filter: brightness(1.5); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); filter: brightness(1); }
}
.fx-mag-spectacle.fx-armed { animation: fx-armed-flash-big 900ms ease; }
@keyframes fx-armed-flash-big {
  0% { box-shadow: 0 0 0 5px var(--neutral) inset, 0 0 30px var(--neutral); filter: brightness(1); transform: scale(1); }
  50% { filter: brightness(1.9); transform: scale(1.1); }
  100% { box-shadow: none; filter: brightness(1); transform: scale(1); }
}
.fx-mag-spectacle.fx-evolve { animation: fx-evolve-pulse-big 900ms ease; }
@keyframes fx-evolve-pulse-big {
  0% { transform: scale(1); filter: brightness(1); }
  45% { transform: scale(1.28); filter: brightness(2) saturate(1.7); }
  100% { transform: scale(1); filter: brightness(1); }
}
.fx-ghost.fx-mag-subtle { animation: fx-exit-subtle 300ms ease forwards; }
@keyframes fx-exit-subtle { 0% { opacity: 1; } 100% { opacity: 0; transform: translateY(8px) scale(0.9); } }
.fx-ghost.fx-mag-spectacle { animation: fx-exit-big 900ms ease forwards; }
@keyframes fx-exit-big {
  0% { opacity: 1; transform: translateY(0) scale(1) rotate(0); filter: none; }
  35% { opacity: 1; transform: translateY(-6px) scale(1.15) rotate(-3deg); filter: brightness(2.2) saturate(0); }
  100% { opacity: 0; transform: translateY(30px) scale(0.35) rotate(10deg); filter: grayscale(1) brightness(0.3); }
}

/* A brief expanding ring, spawned only for spectacle-tier moments (a Mythic
 * entering, an evolution, an effect-killed Rare/Mythic) — the "unmistakable
 * spectacle, not just bigger" cue the routine-vs-pivotal moments need. */
.fx-burst { position: fixed; width: 64px; height: 64px; margin-left: -32px; margin-top: -32px;
  border-radius: 50%; border: 3px solid var(--burst-color, var(--neutral)); pointer-events: none;
  animation: fx-burst-ring 700ms ease-out forwards; }
@keyframes fx-burst-ring {
  0% { opacity: 0.9; transform: scale(0.2); }
  100% { opacity: 0; transform: scale(2.4); }
}

/* The lethal blow — game-ending damage — gets a full-screen beat, not just
 * a bigger card-level flash, since it is the single most significant event
 * any match has. */
.fx-lethal-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 95;
  background: radial-gradient(circle, rgba(255,77,109,0.35) 0%, rgba(255,77,109,0) 70%);
  animation: fx-lethal-flash 1200ms ease-out forwards; }
@keyframes fx-lethal-flash {
  0% { opacity: 0; }
  15% { opacity: 1; }
  100% { opacity: 0; }
}

/* Power / ability cast flourish — EFFECTS.md slice 3, cast(source). Plays
 * FROM the card whose ability fired (or, for a Command, which never sits on
 * the board, from its own stack entry — where its card just flew to). One primitive, three inputs:
 *   meaning (constant): an expanding ring + a spinning diamond sigil + rays
 *     thrown outward, and a trigger tag in the fixed "power" colour
 *     (--cast) saying WHICH kind of power it was: ON PLAY, ON DEATH,
 *     ACTIVATE, TURN END, CAST, RESPONSE...;
 *   faction (skin): ring/sigil/rays wear the SOURCE card's faction colour
 *     (--fx-tint), same "who did this" rule as slice 2's motes;
 *   tier (size): --cast-ms / --cast-scale / ray count.
 * The tag's colour never follows the faction (slice 2's label/particle split,
 * owner-approved 2026-09-26): a first-time viewer learns "lilac tag = a card
 * used a power" once. */
.fx-cast-ring, .fx-cast-sigil, .fx-cast-ray { position: fixed; pointer-events: none; opacity: 0; }
.fx-cast-ring { width: 72px; height: 72px; margin-left: -36px; margin-top: -36px; border-radius: 50%;
  border: 2px solid var(--fx-tint); box-shadow: 0 0 12px var(--fx-tint), 0 0 6px var(--fx-tint) inset;
  animation: fx-cast-ring var(--cast-ms) ease-out forwards; }
@keyframes fx-cast-ring { 0% { opacity: 0.95; transform: scale(0.15); } 100% { opacity: 0; transform: scale(var(--cast-scale)); } }
.fx-cast-sigil { width: 30px; height: 30px; margin-left: -15px; margin-top: -15px;
  border: 2px solid var(--fx-tint); box-shadow: 0 0 8px var(--fx-tint);
  animation: fx-cast-sigil var(--cast-ms) ease-out forwards; }
@keyframes fx-cast-sigil {
  0% { opacity: 0; transform: rotate(45deg) scale(0.3); }
  25% { opacity: 1; }
  100% { opacity: 0; transform: rotate(225deg) scale(calc(var(--cast-scale) * 0.8)); }
}
.fx-cast-ray { width: 3px; height: 16px; margin-left: -1.5px; margin-top: -8px; border-radius: 2px;
  background: linear-gradient(to top, transparent, var(--fx-tint));
  animation: fx-cast-ray var(--cast-ms) ease-out forwards; }
@keyframes fx-cast-ray {
  0% { opacity: 0; transform: rotate(var(--ray-a)) translateY(-10px); }
  25% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--ray-a)) translateY(calc(-26px * var(--cast-scale))); }
}
.fx-cast-tag { position: fixed; pointer-events: none; white-space: nowrap; translate: -50% 0;
  font-size: 0.6rem; font-weight: bold; letter-spacing: 0.12em; color: var(--cast);
  background: rgba(10,8,24,0.88); border: 1px solid var(--cast); border-radius: 3px; padding: 1px 6px;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.6), -3px 0 0 0 var(--fx-tint);
  animation: fx-cast-tag var(--cast-tag-ms) ease forwards; }
.fx-cast-tag .src { color: #fff; letter-spacing: 0.04em; margin-right: 6px; }
.fx-cast-tag.mag-subtle { font-size: 0.52rem; opacity: 0.85; }
.fx-cast-tag.mag-spectacle { font-size: 0.78rem; padding: 2px 8px; box-shadow: 0 0 12px var(--cast), -4px 0 0 0 var(--fx-tint); }
/* A RESPONSE (an Instant cast on the opponent's turn) is the reactive play
 * DESIGN names as a core pillar; it keeps the power colour but gets a
 * double rule so it can't be mistaken for an ordinary on-turn cast. */
.fx-cast-tag.response { border-style: double; border-width: 3px; }
@keyframes fx-cast-tag { 0% { opacity: 0; transform: translateY(4px); } 12% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; } 100% { opacity: 0; } }

/* Attack travel + impact — EFFECTS.md slice 4. Three pieces, one grammar:
 *   aim (declare -> resolve): while an attack waits on the stack, a dashed,
 *     marching line runs from the exact attacker to its exact target, with
 *     a lock-on reticle on the target. This is the response window made
 *     visible: a viewer sees what a RESPONSE is responding to.
 *   travel (resolve): a bolt flies along the same arc...
 *   impact (landing): ...and the hit (flash, number, burst) lands when the
 *     bolt does, not before. A defender with attack strikes back with a
 *     smaller return bolt.
 * Faction (skin) = the attacker's colour on line, reticle and bolt; tier
 * (size) = bolt size, trail and burst, from the same hitScore/playerHitScore
 * as the damage itself. A redirect (Intercept Routine) leaves a fading
 * shield-coloured ghost of the old line. */
.fx-aim-layer { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 88; overflow: visible; }
.fx-aim-line { fill: none; stroke: var(--fx-tint); stroke-width: 2.2; stroke-dasharray: 8 6; stroke-linecap: round;
  filter: drop-shadow(0 0 3px var(--fx-tint)); opacity: 0.9; animation: fx-aim-march 650ms linear infinite; }
.fx-aim-head { fill: var(--fx-tint); filter: drop-shadow(0 0 3px var(--fx-tint)); }
.fx-aim-reticle { fill: none; stroke: var(--fx-tint); stroke-width: 2; stroke-dasharray: 10 6; opacity: 0.95;
  transform-box: fill-box; transform-origin: center; animation: fx-aim-spin 2.4s linear infinite; }
.fx-aim.fresh { animation: fx-aim-in 360ms ease-out; }
.fx-aim.fading { animation: fx-aim-out 650ms ease-in forwards; }
.fx-aim.fading .fx-aim-line { stroke: var(--shield); }
@keyframes fx-aim-march { to { stroke-dashoffset: -28; } }
@keyframes fx-aim-spin { to { transform: rotate(360deg); } }
@keyframes fx-aim-in { 0% { opacity: 0; } 100% { opacity: 1; } }
@keyframes fx-aim-out { 0% { opacity: 1; } 100% { opacity: 0; } }
.fx-bolt { position: fixed; left: 0; top: 0; pointer-events: none; border-radius: 50%;
  width: var(--bolt-size); height: var(--bolt-size); margin-left: calc(var(--bolt-size) / -2); margin-top: calc(var(--bolt-size) / -2);
  background: radial-gradient(circle, #fff 0 22%, var(--fx-tint) 50%, transparent 72%);
  box-shadow: 0 0 10px var(--fx-tint), 0 0 22px var(--fx-tint); }
.fx-bolt.trail { opacity: 0.4; box-shadow: 0 0 6px var(--fx-tint); }
.fx-number.fizzle { color: var(--ink-dim); font-size: 0.72rem; letter-spacing: 0.12em; }
.fx-number.redirect { color: var(--shield); font-size: 0.72rem; letter-spacing: 0.12em; }
/* A Command flying from its caster's hand onto the stack (owner taste call
 * 4, 2026-09-26): the viewer sees the actual card, not just a sigil. */
.card.fx-flycard { position: fixed; left: 0; top: 0; margin: 0; pointer-events: none; z-index: 1;
  box-shadow: 0 0 18px var(--fx-tint), 0 0 0 2px var(--fx-tint); }
`;

const JS = `
(function () {
  const replay = JSON.parse(document.getElementById('match-data').textContent);
  const frames = replay.frames;
  let i = 0;
  let playing = false;
  let timer = null;

  // Player identity (owner-feedback 2026-09-26): a real image when the
  // identity carries one, else the username-seeded SVG placeholder
  // generated at capture time (render/src/avatar.ts — our own markup, never
  // user input, so it is safe to inline).
  function avatarHtml(pid) {
    const id = replay.identities[pid];
    const inner = id.avatarUrl ? '<img alt="" src="' + escapeHtml(id.avatarUrl) + '">' : id.avatarSvg;
    return '<span class="avatar" title="' + escapeHtml(id.username) + '">' + inner + '</span>';
  }

  document.getElementById('matchup').innerHTML =
    '<span class="faction-' + replay.factions.p1 + '" style="color:var(--fc)">' + avatarHtml('p1') + escapeHtml(replay.identities.p1.username) + ' [' + replay.factions.p1 + ']</span>' +
    '<span class="vs">vs</span>' +
    '<span class="faction-' + replay.factions.p2 + '" style="color:var(--fc)">' + avatarHtml('p2') + escapeHtml(replay.identities.p2.username) + ' [' + replay.factions.p2 + ']</span>';

  const scrubber = document.getElementById('scrubber');
  scrubber.max = String(frames.length - 1);

  const fxLayer = document.createElement('div');
  fxLayer.className = 'fx-layer';
  document.body.appendChild(fxLayer);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const aimLayer = document.createElementNS(SVG_NS, 'svg');
  aimLayer.setAttribute('class', 'fx-aim-layer');
  aimLayer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(aimLayer);

  // Magnitude scoring (render-lane session 3): hand-mirrors
  // render/src/fxMagnitude.ts's pure, unit-tested logic. It has to be
  // reimplemented here rather than imported — this whole file is a
  // template-literal <script> that runs unbundled in the browser, the same
  // reason cardArtStyle below reimplements cardVisual.ts's placeholder-art
  // logic instead of importing it. Keep the two in sync by hand; the tiers
  // and thresholds are the same numbers as fxMagnitude.ts.
  // BEGIN fxMagnitude mirror — render/test/fxMagnitude.test.ts extracts
  // this block from a generated page and checks every function against the
  // TS module over its input grid, so drift fails a test.
  const RARITY_WEIGHT = { Common: 1.0, Uncommon: 1.3, Rare: 1.8, Mythic: 2.6 };
  const SUBTLE_MAX = 0.9;
  const SPECTACLE_MIN = 2.4;
  function tierFromScore(score) {
    if (score >= SPECTACLE_MIN) return 'spectacle';
    if (score <= SUBTLE_MAX) return 'subtle';
    return 'normal';
  }
  function enterScore(rarity) { return { Common: 0.6, Uncommon: 1.4, Rare: 1.8, Mythic: 2.6 }[rarity]; }
  function deathScore(rarity, wasEffectKill) { return RARITY_WEIGHT[rarity] + (wasEffectKill ? 0.9 : 0); }
  function hitScore(amount, aoeCount) {
    const delta = Math.abs(amount);
    const base = delta <= 1 ? 0.5 : delta <= 3 ? 1.3 : delta <= 5 ? 2.0 : 3.0;
    const aoeBonus = aoeCount >= 3 ? 1.3 : aoeCount === 2 ? 0.5 : 0;
    return base + aoeBonus;
  }
  function playerHitScore(amount, isLethal) {
    if (isLethal) return SPECTACLE_MIN + 2;
    const delta = Math.abs(amount);
    return delta <= 1 ? 0.8 : delta <= 3 ? 1.6 : delta <= 5 ? 2.3 : 3.0;
  }
  function healScore(amount) { const d = Math.abs(amount); return d <= 1 ? 0.5 : d <= 4 ? 1.2 : 2.8; }
  function statShiftScore(kind, statTotal, statusCount, unitsAffected) {
    if (kind === 'expire') return 0.4;
    const m = Math.abs(statTotal) + 1.5 * statusCount;
    const base = m <= 1 ? 0.6 : m <= 3 ? 1.3 : m <= 5 ? 2.0 : 2.8;
    const wide = unitsAffected >= 3 ? (m >= 2 ? 1.8 : 1.0) : unitsAffected === 2 ? 0.5 : 0;
    if (kind === 'penalty' && unitsAffected >= 2) return Math.max(base + wide, SPECTACLE_MIN);
    return base + wide;
  }
  function evolveScore() { return 2.8; }
  function armedScore(rarity) { return { Common: 1.0, Uncommon: 1.2, Rare: 1.9, Mythic: 2.5 }[rarity]; }
  function barrierBreakScore(rarity) { return { Common: 1.1, Uncommon: 1.4, Rare: 2.0, Mythic: 2.6 }[rarity]; }
  function momentumSwingScore(prevScore, newScore) {
    const d = Math.abs(newScore - prevScore);
    return d <= 6 ? 0 : d <= 15 ? 1.2 : d <= 25 ? 2.0 : 3.2;
  }
  // END fxMagnitude mirror
  // BEGIN statFx mirror — hand-mirrors render/src/statFx.ts (EFFECTS.md
  // slice 2). render/test/statFx.test.ts extracts this exact block from
  // the generated page and runs it against the TS module on the same
  // cases, so drift between the two fails a test instead of shipping.
  const PENALTY_STATUSES = ['Stasis', 'Overload'];
  function signedNum(n) { return (n > 0 ? '+' : '') + n; }
  function statLabel(attack, health) {
    if (attack !== 0 && health === 0) return signedNum(attack) + ' ATK';
    if (attack === 0 && health !== 0) return signedNum(health) + ' HP';
    return signedNum(attack) + '/' + signedNum(health);
  }
  function classifyStatShift(prev, next) {
    const atkDelta = next.attack - prev.attack;
    const maxDelta = next.maxHealth - prev.maxHealth;
    const expAtk = prev.turnBuffAttack !== 0 && next.turnBuffAttack === 0 ? -prev.turnBuffAttack : 0;
    const expHp = prev.turnBuffHealth !== 0 && next.turnBuffHealth === 0 ? -prev.turnBuffHealth : 0;
    let actAtk = atkDelta - expAtk;
    let actHp = maxDelta - expHp;
    if (expAtk !== 0 && (prev.attack === 0 || next.attack === 0) && Math.sign(actAtk) !== Math.sign(atkDelta)) actAtk = 0;
    if (expHp !== 0 && (prev.maxHealth === 1 || next.maxHealth === 1) && Math.sign(actHp) !== Math.sign(maxDelta)) actHp = 0;
    const newStatuses = next.statuses.filter(function (st) { return PENALTY_STATUSES.indexOf(st) !== -1 && prev.statuses.indexOf(st) === -1; });
    if (actAtk === 0 && actHp === 0 && newStatuses.length === 0) {
      if (expAtk === 0 && expHp === 0) return null;
      if (atkDelta === 0 && maxDelta === 0) return null;
      return { kind: 'expire', attack: atkDelta, health: maxDelta, newStatuses: [], label: statLabel(atkDelta, maxDelta) };
    }
    const net = actAtk + actHp;
    const kind = newStatuses.length > 0 || net < 0 || (net === 0 && actAtk < 0) ? 'penalty' : 'buff';
    const parts = [];
    if (actAtk !== 0 || actHp !== 0) parts.push(statLabel(actAtk, actHp));
    newStatuses.forEach(function (st) { parts.push(st.toUpperCase()); });
    return { kind: kind, attack: actAtk, health: actHp, newStatuses: newStatuses, label: parts.join(' ') };
  }
  function healthResidual(prevHealth, nextHealth, prevMax, nextMax) { return nextHealth - prevHealth - (nextMax - prevMax); }
  function tintFaction(kind, ownerFaction, opponentFaction, sourceFaction) {
    if (sourceFaction) return sourceFaction;
    return kind === 'penalty' ? opponentFaction : ownerFaction;
  }
  // END statFx mirror

  // cast(source) attribution — render/src/castFx.ts's CAST_FX_SOURCE,
  // embedded verbatim (one copy, no hand mirror; see that file's header).
${CAST_FX_SOURCE}
  const RESPONSE_STACK_IDS = responseStackIds(frames);
  // Attack travel + Command flight — render/src/attackFx.ts's
  // ATTACK_FX_SOURCE, embedded verbatim (same single-source rule).
${ATTACK_FX_SOURCE}
  // Ability effects with exact source + target (EFFECTS.md v2 slice 2) —
  // render/src/effectFx.ts's EFFECT_FX_SOURCE, embedded verbatim.
${EFFECT_FX_SOURCE}
  // Faction skins (EFFECTS.md slice 5) — render/src/factionSkin.ts's
  // FACTION_SKIN_SOURCE, embedded verbatim (same single-source rule).
${FACTION_SKIN_SOURCE}
  // EFFECTS.md v2 slice 1: canvas FX + floor layers and sprite materials —
  // render/src/canvasFx.ts, embedded verbatim (same single-source rule).
${CANVAS_FX_PURE_SOURCE}
${CANVAS_FX_RUNTIME_SOURCE}

  const TIER_RANK = { subtle: 0, normal: 1, spectacle: 2 };
  function maxTierOf(tiers) { return tiers.reduce(function (m, t) { return TIER_RANK[t] > TIER_RANK[m] ? t : m; }, 'subtle'); }

  // Adaptive pacing (owner feedback 2026-09-25 item 4: "a big animation
  // needs a beat... big effects especially need the frame to wait for
  // them"). Tracks the loudest tier seen in the transition just shown, so
  // the play loop can hold longer on a spectacle moment and breeze past a
  // subtle one, instead of every move getting the same fixed delay.
  let lastTransitionTier = 'normal';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function glyphFor(type) {
    return { Unit: '\\u25C8', Command: '\\u2699', Directive: '\\u25A3', Tool: '\\u2692' }[type] || '\\u25C8';
  }

  function cardArtStyle(faction, visualSeed, visualPattern) {
    const hue = (visualSeed % 40) - 20;
    const patterns = [
      'repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0 4px, transparent 4px 9px)',
      'repeating-linear-gradient(-45deg, rgba(0,0,0,0.14) 0 3px, transparent 3px 8px)',
      'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.22) 0 2px, transparent 2px 14px)',
      'repeating-linear-gradient(90deg, rgba(0,0,0,0.1) 0 2px, transparent 2px 10px), repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0 2px, transparent 2px 10px)',
    ];
    return 'filter: hue-rotate(' + hue + 'deg); background-image: ' + patterns[visualPattern % patterns.length] + ';';
  }

  function renderCardEl(c, opts) {
    opts = opts || {};
    const rarity = c.rarity || 'Common';
    const div = document.createElement('div');
    div.className = 'card faction-' + c.faction + ' rarity-' + rarity + (opts.pending ? ' pending' : '');
    div.title = c.name + ' — ' + c.flavor;
    div.setAttribute('data-name', c.name);
    if (opts.instanceId) div.setAttribute('data-iid', opts.instanceId);
    if (opts.owner) div.setAttribute('data-owner', opts.owner);
    const tags = [];
    if (opts.isEvolved) tags.push('EVOLVED');
    // Guard and Barrier get their own persistent shield badges (below) —
    // Barrier especially, since the plain-text tag used to fire off the
    // static "this card grants Barrier" keyword and stayed lit even after
    // the shield had already been consumed. Rush has no badge, so it still
    // shows here.
    if (opts.keywords) opts.keywords.forEach(function (k) { if (k !== 'Guard' && k !== 'Barrier') tags.push(k.toUpperCase()); });
    const shields = [];
    if (opts.guard) shields.push('guard');
    if (opts.barrierActive) shields.push('barrier');
    const penalties = (opts.statuses || []).filter(function (st) { return PENALTY_STATUSES.indexOf(st.kind) !== -1; });
    if (penalties.some(function (st) { return st.kind === 'Stasis'; })) div.classList.add('has-stasis');
    function markCls(live, printed) { return printed === undefined || live === printed ? '' : live > printed ? ' up' : ' down'; }
    div.innerHTML =
      '<div class="head"><span>' + rarity[0] + '</span><span class="cost">' + c.cost + '</span></div>' +
      '<div class="art" style="' + cardArtStyle(c.faction, c.visualSeed, c.visualPattern) + '"><span class="glyph">' + glyphFor(c.type) + '</span></div>' +
      '<div class="name">' + escapeHtml(c.name) + '</div>' +
      (opts.tools && opts.tools.length ? '<div class="tools">' + opts.tools.map(function (t) { return '<span class="tool-chip">' + escapeHtml(t.name) + '</span>'; }).join('') + '</div>' : '') +
      (opts.stats ? '<div class="stats"><span class="atk' + markCls(opts.stats.attack, opts.stats.printedAttack) + '">' + opts.stats.attack + '</span><span class="hp' + markCls(opts.stats.maxHealth, opts.stats.printedHealth) + '">' + opts.stats.health + '</span></div>' : '') +
      (tags.length ? '<div class="tags">' + tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('') + '</div>' : '') +
      // Plain letter glyphs, not a shield emoji — this environment's headless
      // Chromium has no colour-emoji font, so U+1F6E1 rendered as an
      // invisible zero-metric glyph (found and fixed via a real screenshot,
      // not assumed). Matches the rarity badge's own single-letter
      // convention (c.rarity[0] above) rather than inventing a new one.
      (shields.length || penalties.length ? '<div class="shields">' +
        shields.map(function (s) { return '<span class="shield-badge shield-' + s + '" title="' + (s === 'guard' ? 'Guard' : 'Barrier active') + '">' + (s === 'guard' ? 'G' : 'B') + '</span>'; }).join('') +
        penalties.map(function (st) { return '<span class="shield-badge status-penalty" title="' + st.kind + (typeof st.duration === 'number' ? ' (' + st.duration + ' turn' + (st.duration === 1 ? '' : 's') + ')' : '') + '">' + st.kind[0] + '</span>'; }).join('') +
        '</div>' : '') +
      (opts.armTurn !== undefined ? '<div class="arm-count">T' + opts.armTurn + '</div>' : '');
    return div;
  }

  function renderUnitSlot(u, owner) {
    return renderCardEl(
      { name: u.name, faction: u.faction, rarity: u.rarity, cost: 0, type: 'Unit', flavor: u.flavor, visualSeed: u.visualSeed, visualPattern: u.visualPattern },
      { stats: { attack: u.attack, health: u.health, maxHealth: u.maxHealth, printedAttack: u.printedAttack, printedHealth: u.printedHealth }, statuses: u.statuses, pending: u.pending, armTurn: u.pending ? u.armTurn : undefined, isEvolved: u.isEvolved, keywords: u.keywords, tools: u.tools, instanceId: u.instanceId, owner: owner, guard: u.keywords.indexOf('Guard') !== -1, barrierActive: u.barrierActive },
    );
  }

  function renderDirectiveSlot(d, owner) {
    return renderCardEl({ name: d.name, faction: d.faction, rarity: d.rarity, cost: 0, type: 'Directive', flavor: d.flavor, visualSeed: d.visualSeed, visualPattern: d.visualPattern }, { instanceId: d.instanceId, owner: owner });
  }

  function renderBoard(elId, snapshot) {
    const el = document.getElementById(elId);
    el.innerHTML = '';
    const packed = snapshot.board.map(function (u) { return { kind: 'unit', v: u }; })
      .concat(snapshot.directives.map(function (d) { return { kind: 'dir', v: d }; }));
    // Fixed slots (render/src/slotLayout.ts): a card stays in the slot it
    // entered until it leaves, so nothing slides when a neighbour dies. A
    // replay captured before slots existed falls back to packed order.
    const byIid = {};
    packed.forEach(function (o) { byIid[o.v.instanceId] = o; });
    const occupants = snapshot.slots ? snapshot.slots.map(function (iid) { return iid ? byIid[iid] : undefined; }) : packed;
    for (let s = 0; s < snapshot.slotsMax; s++) {
      const occ = occupants[s];
      if (!occ) {
        const empty = document.createElement('div');
        empty.className = 'slot empty';
        el.appendChild(empty);
        continue;
      }
      const cardEl = occ.kind === 'unit' ? renderUnitSlot(occ.v, snapshot.id) : renderDirectiveSlot(occ.v, snapshot.id);
      el.appendChild(cardEl);
    }
  }

  // HUD/momentum DOM is built ONCE and updated in place on every later
  // frame (rather than innerHTML-replaced) specifically so the health/energy
  // bar widths and the momentum gauge are real CSS transitions on the same
  // element, not an instant snap hidden inside a full rebuild.
  const hudBuilt = {};
  function ensureHud(elId, pid) {
    if (hudBuilt[pid]) return;
    const el = document.getElementById(elId);
    el.innerHTML =
      '<div class="name"><span class="ident">' + avatarHtml(pid) + '<span class="uname" id="' + elId + '-name"></span></span><span class="faction-tag" id="' + elId + '-faction" style="color:var(--fc)"></span></div>' +
      '<div class="bar-row"><span>HP</span><div class="bar-track"><div class="bar-fill health" id="' + elId + '-hp-fill"></div></div><span id="' + elId + '-hp-text"></span></div>' +
      '<div class="bar-row"><span>EN</span><div class="bar-track"><div class="bar-fill energy" id="' + elId + '-en-fill"></div></div><span id="' + elId + '-en-text"></span></div>' +
      '<div class="meta" id="' + elId + '-meta"></div>';
    hudBuilt[pid] = true;
  }

  function renderHud(elId, snapshot) {
    ensureHud(elId, snapshot.id);
    const el = document.getElementById(elId);
    const hpPct = Math.max(0, Math.min(100, (snapshot.health / snapshot.maxHealth) * 100));
    const enPct = snapshot.maxEnergy ? Math.max(0, Math.min(100, (snapshot.energy / snapshot.maxEnergy) * 100)) : 0;
    el.className = 'hud faction-' + snapshot.faction;
    document.getElementById(elId + '-name').textContent = snapshot.name;
    document.getElementById(elId + '-faction').textContent = snapshot.faction;
    document.getElementById(elId + '-hp-fill').style.width = hpPct + '%';
    document.getElementById(elId + '-hp-text').textContent = snapshot.health + '/' + snapshot.maxHealth;
    document.getElementById(elId + '-en-fill').style.width = enPct + '%';
    document.getElementById(elId + '-en-text').textContent = snapshot.energy + '/' + snapshot.maxEnergy;
    document.getElementById(elId + '-meta').innerHTML =
      '<span>hand ' + snapshot.hand.length + '</span><span>deck ' + snapshot.deckSize + '</span><span>grave ' + snapshot.graveyardSize + '</span><span>slots ' + snapshot.slotsUsed + '/' + snapshot.slotsMax + '</span>';
  }

  function renderHand(elId, snapshot, label) {
    const el = document.getElementById(elId);
    el.innerHTML = '<div class="hand-label">' + label + '</div>';
    snapshot.hand.forEach(function (c) {
      const chip = document.createElement('div');
      chip.className = 'minicard faction-' + c.faction;
      chip.setAttribute('data-name', c.name);
      chip.innerHTML = '<b>' + c.cost + '</b> ' + escapeHtml(c.name);
      el.appendChild(chip);
    });
  }

  let momentumBuilt = false;
  function ensureMomentum() {
    if (momentumBuilt) return;
    document.getElementById('momentum').innerHTML =
      '<div class="label">MOMENTUM</div>' +
      '<div class="gauge"><div class="mid"></div><div class="fill" id="momentum-fill"></div></div>' +
      '<div class="why" id="momentum-why"></div>';
    momentumBuilt = true;
  }

  function renderMomentum(m) {
    ensureMomentum();
    const pct = (m.score + 100) / 2;
    const color = m.leader === 'even' ? 'var(--neutral)' : 'var(--' + replay.factions[m.leader].toLowerCase() + ')';
    let fillLeft, fillWidth;
    if (m.score >= 0) { fillLeft = 50; fillWidth = pct - 50; } else { fillLeft = pct; fillWidth = 50 - pct; }
    const fillEl = document.getElementById('momentum-fill');
    fillEl.style.left = fillLeft + '%';
    fillEl.style.width = fillWidth + '%';
    fillEl.style.background = color;
    document.getElementById('momentum-why').innerHTML =
      (m.leader === 'even' ? 'EVEN' : (m.leader.toUpperCase() + ' AHEAD')) + '<br>' + escapeHtml(m.reasons.join(' \\u00b7 '));
  }

  function renderStack(stack) {
    const el = document.getElementById('stackzone');
    el.innerHTML = '';
    stack.slice().reverse().forEach(function (item, idx) {
      const div = document.createElement('div');
      div.className = 'stackitem';
      div.setAttribute('data-sid', item.stackId);
      div.textContent = (idx === 0 ? '\\u25B2 TOP: ' : '') + item.controller + ': ' + item.description;
      el.appendChild(div);
    });
  }

  function renderTurnbar(frame) {
    const el = document.getElementById('turnbar');
    let text = 'TURN ' + frame.turnNumber + ' (of up to ' + replay.turnCap + ')  \\u2014  active: <b>' + frame.activePlayer.toUpperCase() + '</b>  \\u2014  priority: <b>' + frame.priority.toUpperCase() + '</b>';
    if (frame.winner) {
      text += '  \\u2014  <span class="win">GAME OVER: ' + (frame.winner === 'draw' ? 'DRAW' : frame.winner.toUpperCase() + ' WINS') + '</span>';
    }
    el.innerHTML = text;
  }

  function renderEventLog(upTo) {
    const el = document.getElementById('eventlog');
    el.innerHTML = '';
    let lastTurn = null;
    for (let f = 0; f <= upTo; f++) {
      const frame = frames[f];
      frame.newEvents.forEach(function (e) {
        if (e.event.type === 'turnStart' && e.event.turn !== lastTurn) {
          lastTurn = e.event.turn;
        }
        const line = document.createElement('div');
        line.className = 'ev' + (f === upTo ? ' now' : '') + (e.event.type === 'gameOver' ? ' gameover' : '');
        line.textContent = e.text;
        el.appendChild(line);
      });
    }
    el.scrollTop = el.scrollHeight;
  }

  function renderFrame() {
    const frame = frames[i];
    renderHud('hud-p1', frame.players.p1);
    renderHud('hud-p2', frame.players.p2);
    renderMomentum(frame.momentum);
    renderTurnbar(frame);
    renderBoard('board-p2', frame.players.p2);
    renderBoard('board-p1', frame.players.p1);
    renderStack(frame.stack);
    renderHand('hand-p1', frame.players.p1, 'P1 HAND');
    renderHand('hand-p2', frame.players.p2, 'P2 HAND');
    renderEventLog(i);
    drawAimLines(frame, {});
    scrubber.value = String(i);
    document.getElementById('framecount').textContent = 'move ' + i + ' / ' + (frames.length - 1);
  }

  // Per-move animation (render-lane session 2): a diff between the frame
  // being left and the frame being entered, keyed by instanceId (exact,
  // never ambiguous — unlike the event log's own attacker/target fields,
  // which are card/player NAMES and can collide in a mirror match). Only
  // runs on a genuine single-step advance (Next/spacebar/play/ArrowRight);
  // jumps (scrubber, First/Last, multi-step) re-render statically, which is
  // the right call for a jump anyway — there is no meaningful "in between"
  // to animate through.
  function collectBoard(frame) {
    const out = {};
    ['p1', 'p2'].forEach(function (pid) {
      frame.players[pid].board.forEach(function (u) { out[u.instanceId] = { kind: 'unit', v: u, owner: pid }; });
      frame.players[pid].directives.forEach(function (d) { out[d.instanceId] = { kind: 'dir', v: d, owner: pid }; });
    });
    return out;
  }

  function currentRectsByIid() {
    const map = {};
    document.querySelectorAll('[data-iid]').forEach(function (el) {
      const iid = el.getAttribute('data-iid');
      if (iid) map[iid] = el.getBoundingClientRect();
    });
    return map;
  }

  function hudRect(pid) { return document.getElementById('hud-' + pid).getBoundingClientRect(); }
  function liveCardEl(iid) { return document.querySelector('.card[data-iid="' + iid + '"]'); }

  const GHOST_MS = { subtle: 320, normal: 700, spectacle: 950 };
  const NUMBER_MS = { subtle: 550, normal: 950, spectacle: 1300 };
  const FLASH_MS = { subtle: 260, normal: 500, spectacle: 900 };

  // delay > 0 (an attack's bolt still in flight, or a spectacle cast's
  // stagger): the ghost stands in the card's old spot at full strength and
  // only starts its exit when the hit lands, so a card never blinks out
  // before whatever killed it arrives.
  // kill (optional, v2 slice 2): { killer, victim } factions. When the
  // canvas can draw, the card shatters there at the moment of the hit and
  // the ghost is hidden at that moment, so the card breaks instead of
  // fading; otherwise the v1 fade and red burst play as before.
  function spawnGhost(entry, rect, tier, delay, kill) {
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    delay = delay || 0;
    const cardEl = entry.kind === 'unit' ? renderUnitSlot(entry.v, entry.owner) : renderDirectiveSlot(entry.v, entry.owner);
    cardEl.classList.add('fx-ghost', 'fx-mag-' + tier);
    cardEl.style.position = 'fixed';
    cardEl.style.left = rect.left + 'px';
    cardEl.style.top = rect.top + 'px';
    cardEl.style.width = rect.width + 'px';
    cardEl.style.height = rect.height + 'px';
    cardEl.style.margin = '0';
    if (delay > 0) { cardEl.style.animationDelay = delay + 'ms'; cardEl.style.animationFillMode = 'both'; }
    fxLayer.appendChild(cardEl);
    later(delay, function () {
      if (kill && CFX.kill(rect, kill.killer, kill.victim, tier)) { cardEl.style.visibility = 'hidden'; return; }
      if (tier === 'spectacle') spawnBurst(rect, 'var(--bad)');
    });
    setTimeout(function () { cardEl.remove(); }, (GHOST_MS[tier] || GHOST_MS.normal) + delay);
  }

  function spawnNumber(rect, text, cls, tier, yOffset) {
    if (!rect) return;
    const el = document.createElement('div');
    el.className = 'fx-number ' + cls + (tier ? ' mag-' + tier : '');
    el.textContent = tier === 'spectacle' ? text + '!' : text;
    el.style.left = (rect.left + rect.width / 2 - 16) + 'px';
    el.style.top = (rect.top + 6 + (yOffset || 0)) + 'px';
    fxLayer.appendChild(el);
    // Removal must be scheduled BEFORE returning (it used to sit after the
    // return and never ran, so every floating number stayed in the DOM for
    // the rest of the replay — found in render session 6). The longest
    // floating-number animation (1300ms) is well inside NUMBER_MS + 400.
    setTimeout(function () { el.remove(); }, (NUMBER_MS[tier] || NUMBER_MS.normal) + 400);
    return el;
  }

  // 'faction' (optional) skins the ring; bursts whose colour is a meaning
  // (a kill's red, a shield's cyan, an evolve's green) pass none and stay
  // plain, because the colour is the message there.
  function spawnBurst(rect, color, scale, faction) {
    if (!rect) return;
    const el = document.createElement('div');
    el.className = 'fx-burst' + (faction ? ' skin-' + skinOf(faction).name : '');
    if (scale && scale !== 1) el.style.scale = String(scale);
    el.style.setProperty('--burst-color', color);
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top + rect.height / 2) + 'px';
    fxLayer.appendChild(el);
    setTimeout(function () { el.remove(); }, 750);
  }

  function spawnDeflect(rect) {
    if (!rect) return;
    const el = document.createElement('div');
    el.className = 'fx-deflect-ring';
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top + rect.height / 2) + 'px';
    fxLayer.appendChild(el);
    setTimeout(function () { el.remove(); }, 420);
  }

  // rise / sink primitives (EFFECTS.md slice 2). One function, parameterised
  // by direction (the meaning), tint (the faction skin) and tier (the size)
  // — never a per-faction or per-tier copy.
  // Slice 5: the layout (count, lanes, drift, steps) comes from the
  // faction skin (moteLayout); 'dir' stays the caller's.
  const MOTE_MS = { subtle: 450, normal: 750, spectacle: 1150 };
  function spawnMotes(rect, dir, faction, tier) {
    if (!rect) return;
    const ms = MOTE_MS[tier] || MOTE_MS.normal;
    const skin = skinOf(faction);
    moteLayout(faction, dir, tier, rect.width, rect.height).forEach(function (m) {
      const el = document.createElement('div');
      el.className = 'fx-mote ' + dir + ' mag-' + tier + ' skin-' + skin.name;
      el.style.setProperty('--fx-tint', 'var(--' + faction.toLowerCase() + ')');
      el.style.setProperty('--mote-size', m.size + 'px');
      el.style.left = (rect.left + m.x) + 'px';
      el.style.top = (rect.top + m.y) + 'px';
      const kf = [{ transform: 'translate(0px,0px)', opacity: 0 }];
      m.path.forEach(function (p, k) {
        kf.push({ transform: 'translate(' + p.dx + 'px,' + p.dy + 'px)', opacity: k === m.path.length - 1 ? 0 : 1 });
      });
      fxLayer.appendChild(el);
      // Glitch skins jump between keyframes; the rest glide.
      const easing = skin.mote.steps > 0 ? 'steps(1, end)' : (dir === 'up' ? 'ease-out' : 'ease-in');
      if (el.animate) el.animate(kf, { duration: ms, delay: m.delayMs, easing: easing, fill: 'both' });
      setTimeout(function () { el.remove(); }, ms * 1.25 + m.delayMs);
    });
  }

  // Stat labels ("+1/+1", "-1 ATK OVERLOAD") are much wider than a damage
  // number, so they're centred on the card with the independent CSS
  // "translate" property (composes with the float keyframes' transform)
  // instead of the fixed -16px nudge — otherwise they spill onto the
  // neighbouring card on a board-wide effect.
  function centreOn(el, rect) {
    if (!el) return;
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.translate = '-50% 0';
  }

  // onCanvas (v2 slice 2): the canvas already drew this buff/debuff in the
  // source's material (CFX.effect), so the v1 DOM motes and burst stand down.
  // The rise/sink flash and the label stay: they carry the meaning.
  function applyStatShift(el, shift, tint, tier, onCanvas) {
    el.style.setProperty('--fx-tint', 'var(--' + tint.toLowerCase() + ')');
    const rect = el.getBoundingClientRect();
    if (shift.kind === 'expire') {
      flashClass(el, 'fx-settle', 'subtle');
      centreOn(spawnNumber(rect, shift.label, 'expire', 'subtle', 40), rect);
      return;
    }
    const up = shift.kind === 'buff';
    flashClass(el, up ? 'fx-rise' : 'fx-sink', tier);
    if (!onCanvas) spawnMotes(rect, up ? 'up' : 'down', tint, tier);
    // Buff labels start low and float up; penalty labels start high and
    // sink — and both sit clear of the damage/heal number's own spot at the
    // top of the card, so a hit + a debuff on the same move don't stack.
    centreOn(spawnNumber(rect, shift.label, up ? 'buff' : 'penalty', tier, up ? 70 : 28), rect);
    if (tier === 'spectacle' && !onCanvas) spawnBurst(rect, 'var(--' + tint.toLowerCase() + ')', 1, tint);
  }

  // Which faction's card caused this unit's buff/penalty, when the move's
  // events name a source we know. A name->faction lookup (cardFactions) is
  // safe even with the event log's name-only identity gap: it only needs to
  // know WHICH FACTION the source card belongs to, never which instance.
  function sourceFactionFor(unitName, frame) {
    for (let k = 0; k < frame.newEvents.length; k++) {
      const ev = frame.newEvents[k].event;
      if ((ev.type === 'buff' || ev.type === 'statusApplied') && ev.target === unitName && replay.cardFactions[ev.source]) return replay.cardFactions[ev.source];
      if (ev.type === 'toolAttached' && ev.unit === unitName && replay.cardFactions[ev.tool]) return replay.cardFactions[ev.tool];
    }
    return undefined;
  }

  function statSideOf(u) {
    return { attack: u.attack, maxHealth: u.maxHealth, turnBuffAttack: u.turnBuff.attack, turnBuffHealth: u.turnBuff.health, statuses: u.statuses.map(function (st) { return st.kind; }) };
  }

  function flashClass(el, cls, tier) {
    if (!el) return;
    const magCls = 'fx-mag-' + tier;
    el.classList.remove(cls, 'fx-mag-subtle', 'fx-mag-normal', 'fx-mag-spectacle');
    void el.offsetWidth; // force reflow so re-adding the class retriggers the keyframe
    el.classList.add(cls, magCls);
    if (tier === 'spectacle' && (cls === 'fx-evolve' || cls === 'fx-enter' || cls === 'fx-armed' || cls === 'fx-shatter')) {
      spawnBurst(el.getBoundingClientRect(), cls === 'fx-evolve' ? 'var(--good)' : cls === 'fx-shatter' ? 'var(--shield)' : 'var(--neutral)');
    }
    setTimeout(function () { el.classList.remove(cls, magCls); }, FLASH_MS[tier] || FLASH_MS.normal);
  }

  // cast(source) primitive — EFFECTS.md slice 3. One function for every
  // faction and tier: faction only picks --fx-tint, tier only picks
  // duration/size/ray count. Anchors: the exact card (or where it stood,
  // if the power was its death), the casting player's avatar for a
  // Command, or — when the name-only event log leaves it genuinely
  // ambiguous — a banner beside that side's board rather than a guess.
  const CAST_MS = { subtle: 420, normal: 650, spectacle: 1000 };
  const CAST_SCALE = { subtle: 1.0, normal: 1.4, spectacle: 2.1 };
  const CAST_TAG_MS = { subtle: 700, normal: 1100, spectacle: 1500 };
  function castAnchorRect(fx, prevRects, prevStackRects) {
    if (fx.anchor === 'card') {
      const live = fx.departed ? null : liveCardEl(fx.iid);
      return live ? live.getBoundingClientRect() : prevRects[fx.iid];
    }
    if (fx.anchor === 'stack') {
      // A Command: on its own stack entry — the live one when it was just
      // cast, the one it left from when it resolved — else, if the entry
      // somehow isn't on screen, its caster's avatar.
      const live = fx.stackId ? document.querySelector('.stackitem[data-sid="' + fx.stackId + '"]') : null;
      if (live) return live.getBoundingClientRect();
      if (fx.stackId && prevStackRects[fx.stackId]) return prevStackRects[fx.stackId];
      const av = document.querySelector('#hud-' + fx.owner + ' .avatar');
      return av ? av.getBoundingClientRect() : hudRect(fx.owner);
    }
    const row = fx.owner ? document.getElementById('board-' + fx.owner) : document.getElementById('stackzone');
    const r = row.getBoundingClientRect();
    return { left: r.left + r.width / 2 - 40, top: fx.owner === 'p2' ? r.bottom - 30 : r.top + (fx.owner ? 10 : 0), width: 80, height: 20 };
  }
  function spawnCast(fx, prevRects, prevStackRects, stackIndex) {
    const rect = castAnchorRect(fx, prevRects, prevStackRects);
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    const tier = fx.tier;
    const tint = fx.faction ? 'var(--' + fx.faction.toLowerCase() + ')' : 'var(--cast)';
    // No faction (the name-only log couldn't place the card) -> plain skin.
    const skinCls = ' skin-' + skinOf(fx.faction || 'Neutral').name;
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const ms = CAST_MS[tier] || CAST_MS.normal;
    function place(el) {
      el.style.setProperty('--fx-tint', tint);
      el.style.setProperty('--cast-ms', ms + 'ms');
      el.style.setProperty('--cast-scale', String(CAST_SCALE[tier] || 1.4));
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      fxLayer.appendChild(el);
      setTimeout(function () { el.remove(); }, ms + 150);
      return el;
    }
    if (fx.anchor !== 'banner') {
      const ring = document.createElement('div'); ring.className = 'fx-cast-ring' + skinCls; place(ring);
      const sigil = document.createElement('div'); sigil.className = 'fx-cast-sigil' + skinCls; place(sigil);
      castRayAngles(fx.faction || 'Neutral', tier).forEach(function (deg) {
        const ray = document.createElement('div');
        ray.className = 'fx-cast-ray' + skinCls;
        ray.style.setProperty('--ray-a', deg + 'deg');
        place(ray);
      });
      if (tier === 'spectacle') spawnBurst(rect, tint, 1, fx.faction || 'Neutral');
    }
    const tag = document.createElement('div');
    tag.className = 'fx-cast-tag mag-' + tier + (fx.trigger === 'response' ? ' response' : '');
    // The card name is already on the card itself; off-card anchors (a
    // Command from the avatar, an ambiguous banner) name the source.
    tag.innerHTML = (fx.anchor === 'card' ? '' : '<span class="src">' + escapeHtml(fx.source) + '</span>') + escapeHtml(fx.label);
    tag.style.setProperty('--fx-tint', tint);
    const tagMs = CAST_TAG_MS[tier] || CAST_TAG_MS.normal;
    tag.style.setProperty('--cast-tag-ms', tagMs + 'ms');
    // Card: tucked just under the card's name strip, clear of the damage
    // number (top) and buff/penalty labels (upper-middle); stacked downward
    // when one card fires several powers in one move. Stack (a Command):
    // the sigil plays on the Command's stack entry, and the tag sits in the
    // same lane on the caster's side (p1 left, p2 right, matching the HUD
    // panels) so it never covers the entry it is labelling.
    let tagX = cx, baseTop = fx.anchor === 'card' ? rect.top + rect.height * 0.62 : rect.top;
    if (fx.anchor === 'stack') {
      const row = document.getElementById('board-p1').getBoundingClientRect();
      const lane = document.getElementById('stackzone').getBoundingClientRect();
      tagX = fx.owner === 'p1' ? row.left + row.width * 0.14 : row.right - row.width * 0.14;
      baseTop = lane.top + 1;
    }
    tag.style.left = Math.max(80, Math.min(window.innerWidth - 80, tagX)) + 'px';
    tag.style.top = (baseTop + stackIndex * 15) + 'px';
    fxLayer.appendChild(tag);
    setTimeout(function () { tag.remove(); }, tagMs + 100);
  }

  // ---- move timeline (render session 7) ---------------------------------
  // Some FX must wait: an attack's hit lands when its bolt arrives, and a
  // spectacle-tier power gets a short "cast, then effect" beat (owner taste
  // call 1, 2026-09-26). Waiting FX go through later(); stepping to the next
  // move first flushes anything still waiting (so nothing from move N ever
  // plays on top of move N+1's board), and a jump cancels it outright.
  let pendingFx = [];
  function later(ms, fn) {
    if (!(ms > 0)) { fn(); return; }
    const entry = { fn: fn, id: 0 };
    entry.id = setTimeout(function () { pendingFx = pendingFx.filter(function (e) { return e !== entry; }); fn(); }, ms);
    pendingFx.push(entry);
  }
  function flushFx() {
    const list = pendingFx; pendingFx = [];
    list.forEach(function (e) { clearTimeout(e.id); e.fn(); });
  }
  function cancelFx() {
    pendingFx.forEach(function (e) { clearTimeout(e.id); });
    pendingFx = [];
    // A jump has no "in between": nothing still in flight belongs on the
    // board it lands on.
    CFX.clear();
  }
  function speedMs() { return Number(document.getElementById('speed').value) || 700; }
  // The owner-approved per-move pacing (the tick itself) is untouched: the
  // bolt's flight is carved out of the start of the move's own window and
  // scales with the chosen speed, so it always lands well before the next
  // move (normal: ~210ms of a 700ms tick; fast: ~75ms of 250ms).
  const TRAVEL_SCALE = { subtle: 0.8, normal: 1, spectacle: 1.35 };
  function travelMs(tier) {
    const base = Math.min(240, Math.max(70, Math.round(speedMs() * 0.3)));
    return Math.round(base * (TRAVEL_SCALE[tier] || 1));
  }
  const CAST_STAGGER_MS = 150;
  function staggers(fx) { return fx.tier === 'spectacle' || fx.trigger === 'response'; }

  function centreOf(rect) { return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; }
  function targetEl(target) {
    if (!target) return null;
    if (target.kind === 'unit') return liveCardEl(target.instanceId);
    return document.querySelector('#hud-' + target.playerId + ' .avatar') || document.getElementById('hud-' + target.playerId);
  }
  function factionOfUnit(frame, iid) {
    let f = null;
    ['p1', 'p2'].forEach(function (pid) { frame.players[pid].board.forEach(function (u) { if (u.instanceId === iid) f = u.faction; }); });
    return f;
  }
  // The arc every attack uses — the aim line, and later the bolt, follow
  // the same curve so "this is where it will go" and "there it goes" match.
  function arcBetween(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const bend = Math.min(60, len * 0.14);
    return { a: a, b: b, c: { x: (a.x + b.x) / 2 - (dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend } };
  }
  function arcPoint(arc, t) {
    const u = 1 - t;
    return { x: u * u * arc.a.x + 2 * u * t * arc.c.x + t * t * arc.b.x, y: u * u * arc.a.y + 2 * u * t * arc.c.y + t * t * arc.b.y };
  }
  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }
  function aimGroup(fromRect, toRect, tint, cls) {
    const arc = arcBetween(centreOf(fromRect), centreOf(toRect));
    // The reticle rings the target: a card at ~a third of its size, a small
    // avatar with room to spare so it doesn't sit on the avatar's own frame.
    const small = toRect.width < 60;
    const r = Math.max(22, Math.min(toRect.width, toRect.height) * (small ? 0.5 : 0.36) + (small ? 9 : 0));
    // Start/stop short of the centres (by pixels, not a fraction of the
    // length, so a long line and a short one both stop AT the reticle) so
    // the line reads as leaving one card and arriving at the other.
    const len = Math.hypot(arc.b.x - arc.a.x, arc.b.y - arc.a.y) || 1;
    const t0 = Math.min(0.3, 34 / len), t1 = 1 - Math.min(0.3, (r + 12) / len);
    const s = arcPoint(arc, t0), e = arcPoint(arc, t1), pre = arcPoint(arc, t1 - 0.04);
    const g = svgEl('g', { class: 'fx-aim' + (cls ? ' ' + cls : '') });
    g.style.setProperty('--fx-tint', tint);
    g.appendChild(svgEl('path', { class: 'fx-aim-line', d: 'M' + s.x + ' ' + s.y + ' Q' + arc.c.x + ' ' + arc.c.y + ' ' + e.x + ' ' + e.y }));
    const ang = Math.atan2(e.y - pre.y, e.x - pre.x);
    const hx = e.x + Math.cos(ang) * 9, hy = e.y + Math.sin(ang) * 9;
    const lx = e.x + Math.cos(ang + 2.5) * 8, ly = e.y + Math.sin(ang + 2.5) * 8;
    const rx = e.x + Math.cos(ang - 2.5) * 8, ry = e.y + Math.sin(ang - 2.5) * 8;
    g.appendChild(svgEl('polygon', { class: 'fx-aim-head', points: hx + ',' + hy + ' ' + lx + ',' + ly + ' ' + rx + ',' + ry }));
    const t = centreOf(toRect);
    g.appendChild(svgEl('circle', { class: 'fx-aim-reticle', cx: t.x, cy: t.y, r: r }));
    return g;
  }
  // Persistent aim lines: one per attack still waiting on the stack. Redrawn
  // from scratch on every frame render (so jumps and resizes are always
  // right); 'fresh' marks the ones this move just declared/redirected, which
  // fade in instead of simply being there.
  function drawAimLines(frame, fresh) {
    // A redirect's fading old line removes itself; a redraw (this move's
    // fresh lines, a resize) must not cut it short.
    Array.prototype.slice.call(aimLayer.children).forEach(function (g) { if (!g.classList.contains('fading')) g.remove(); });
    pendingAttacks(frame).forEach(function (pa) {
      const from = liveCardEl(pa.attackerIid), to = targetEl(pa.target);
      // An attacker already killed by a response has nothing to aim from;
      // its attack will fizzle on resolution, and the strike says so then.
      if (!from || !to) return;
      const f = factionOfUnit(frame, pa.attackerIid) || frame.players[pa.owner].faction;
      aimLayer.appendChild(aimGroup(from.getBoundingClientRect(), to.getBoundingClientRect(), 'var(--' + f.toLowerCase() + ')', fresh[pa.stackId] ? 'fresh' : ''));
    });
  }
  function fadeOldAim(fromRect, toRect, tint) {
    if (!fromRect || !toRect) return;
    const g = aimGroup(fromRect, toRect, tint, 'fading');
    aimLayer.appendChild(g);
    setTimeout(function () { g.remove(); }, 700);
  }

  // travel(from, to) primitive: a bolt along the attack arc, landing at
  // 'ms'. Tier sets size and trail; faction sets --fx-tint and, since
  // slice 5, the particle character (boltLayout: Cortex's packet train,
  // Swarm's spore cloud, Aegis's chrome slug, Null's stutter). Every
  // particle's path starts on the attacker and ends on the target.
  function spawnBolt(fromRect, toRect, faction, tier, ms, small) {
    if (!fromRect || !toRect) return;
    const skin = skinOf(faction);
    const tint = 'var(--' + faction.toLowerCase() + ')';
    const arc = arcBetween(centreOf(fromRect), centreOf(toRect));
    const parts = boltLayout(faction, tier, small, arc);
    // Draw back to front: cloud and trail under the head.
    for (let k = parts.length - 1; k >= 0; k--) {
      const pt = parts[k];
      const el = document.createElement('div');
      el.className = 'fx-bolt skin-' + skin.name + (pt.role === 'head' ? '' : ' ' + pt.role);
      el.style.setProperty('--fx-tint', tint);
      el.style.setProperty('--bolt-size', pt.size + 'px');
      if (skin.bolt.stretch !== 1 && pt.role === 'head') el.style.width = Math.round(pt.size * skin.bolt.stretch) + 'px';
      const half = (skin.bolt.stretch !== 1 && pt.role === 'head' ? Math.round(pt.size * skin.bolt.stretch) : pt.size) / 2;
      el.style.marginLeft = (-half) + 'px';
      // A stepped (glitch) particle holds each keyframe then jumps:
      // per-keyframe steps(1) over a linear clock. The rest glide on the
      // original accelerating curve.
      const kf = pt.path.map(function (p) {
        const f = { transform: 'translate(' + p.x + 'px,' + p.y + 'px) rotate(' + Math.round(p.rot) + 'deg) scale(' + p.scale.toFixed(3) + ')' };
        if (pt.steps > 0) f.easing = 'steps(1, end)';
        return f;
      });
      el.style.transform = kf[0].transform;
      fxLayer.appendChild(el);
      const lag = Math.round(ms * pt.lag);
      if (el.animate) el.animate(kf, { duration: ms, delay: lag, easing: pt.steps > 0 ? 'linear' : 'cubic-bezier(.45,0,.75,1)', fill: 'both' });
      setTimeout(function () { el.remove(); }, ms + lag + 30);
    }
  }

  // A Command's card flies from its caster's hand onto the stack (owner
  // taste call 4). Rises out of the hand to full size, then shrinks into
  // its stack entry. Returns when it lands, so the cast sigil can start
  // there.
  function flyCommandCard(fx, prevFrame, prevHandRects) {
    const ref = prevFrame.players[fx.owner].hand.filter(function (c) { return c.name === fx.card; })[0];
    const dest = document.querySelector('.stackitem[data-sid="' + fx.stackId + '"]');
    if (!ref || !dest) return 0;
    const av = document.querySelector('#hud-' + fx.owner + ' .avatar');
    const src = (prevHandRects[fx.owner] || {})[fx.card] || (av ? av.getBoundingClientRect() : hudRect(fx.owner));
    const card = renderCardEl(ref);
    card.classList.add('fx-flycard');
    card.style.setProperty('--fx-tint', 'var(--' + ref.faction.toLowerCase() + ')');
    fxLayer.appendChild(card);
    const w = card.offsetWidth || 118, h = card.offsetHeight || 158;
    const a = centreOf(src), b = centreOf(dest.getBoundingClientRect());
    const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 20 + (b.y - a.y) * 0.35 };
    // Holds at full size for ~40% of the flight — long enough to read the
    // card — and still lands inside the move's own window at every speed.
    const ms = Math.min(560, Math.max(150, Math.round(speedMs() * 0.6)));
    function at(p, sc, op) { return { transform: 'translate(' + (p.x - w / 2) + 'px,' + (p.y - h / 2) + 'px) scale(' + sc + ')', opacity: op }; }
    card.style.transform = at(a, 0.35, 0).transform;
    if (card.animate) card.animate([at(a, 0.35, 0), Object.assign(at(mid, 1, 1), { offset: 0.3 }), Object.assign(at(mid, 1, 1), { offset: 0.72 }), at(b, 0.28, 0.15)], { duration: ms, easing: 'ease-in-out', fill: 'both' });
    setTimeout(function () { card.remove(); }, ms + 30);
    return Math.round(ms * 0.9);
  }

  function showLethalFlash() {
    const el = document.createElement('div');
    el.className = 'fx-lethal-overlay';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1200);
  }

  // A removal "locks on first" (EFFECTS.md axis 1): its window is longer
  // than a spell's flight, still well inside the move at every speed.
  const REMOVAL_LEAD = 1.45;
  // Where an effect leaves from / lands on (effectFx.ts ends): a card (live,
  // or where it stood before the move: a removal's victim, an onDeath
  // source), a player's avatar, or a Command's stack entry (live, else
  // where it stood, else its caster's avatar).
  function effectEndRect(end, prevRects, prevHudRects, prevStackRects) {
    if (end.kind === 'unit') { const el = liveCardEl(end.instanceId); return el ? el.getBoundingClientRect() : prevRects[end.instanceId]; }
    if (end.kind === 'player') { const el = targetEl({ kind: 'player', playerId: end.playerId }); return el ? el.getBoundingClientRect() : prevHudRects[end.playerId]; }
    const live = document.querySelector('.stackitem[data-sid="' + end.stackId + '"]');
    if (live) return live.getBoundingClientRect();
    if (prevStackRects[end.stackId]) return prevStackRects[end.stackId];
    const av = document.querySelector('#hud-' + end.owner + ' .avatar');
    return av ? av.getBoundingClientRect() : hudRect(end.owner);
  }
  // The effect wears its SOURCE card's faction (a Neutral Command is gold
  // whoever casts it): the name -> faction table first, then the source
  // unit on the board, then its controller.
  function effectFaction(e, prevFrame) {
    if (replay.cardFactions[e.sourceName]) return replay.cardFactions[e.sourceName];
    if (e.source.kind === 'unit') { const f = factionOfUnit(prevFrame, e.source.instanceId); if (f) return f; }
    if (e.source.kind === 'stack') return prevFrame.players[e.source.owner].faction;
    return 'Neutral';
  }

  function runFx(prevFrame, prevBoard, prevRects, prevHudRects, prevStackRects, prevHandRects, newFrame) {
    const newBoard = collectBoard(newFrame);
    const tiers = [];
    // Coarse, aggregate-only reads of newEvents (event TYPES and counts,
    // never attacker/target/unit NAME fields) — safe despite the event
    // log's known name-collision identity gap (progress/render/
    // notes-for-owner.md item 4), because nothing here attributes an event
    // to a specific instance by name; the instanceId diff above already did
    // that precisely. This only asks "how many, how loud, of what kind".
    const hasAttackEvent = newFrame.newEvents.some(function (e) { return e.event.type === 'attack'; });
    const aoeCount = newFrame.newEvents.filter(function (e) { return e.event.type === 'damage' && e.event.targetKind === 'unit'; }).length;
    const justEnded = !prevFrame.winner && !!newFrame.winner;
    const shifts = [];

    // ---- timeline: when does each part of this move land? -------------
    // Stack movement (attackFx.ts, instance-exact): at most one strike per
    // move (the engine resolves one stack item per pass pair).
    const attacks = resolveAttacks(prevFrame, newFrame);
    const casts = resolveCasts(prevFrame, newFrame, replay.cardFactions, replay.cardRarities || {});
    const strike = attacks.filter(function (a) { return a.phase === 'strike' && a.outcome === 'hit'; })[0];
    // Everything a strike move shows is a CONSEQUENCE of the strike (the
    // damage, deaths, onDamaged/onDeath powers, a summon from a death), so
    // it all waits for the bolt. A strike resolves nothing else, so no cast
    // stagger applies there.
    let strikeT = 0, counterT = 0, strikeTier = 'normal';
    if (strike) {
      const lethalHere = justEnded && strike.target.kind === 'player' && newFrame.winner !== strike.target.playerId && newFrame.winner !== 'draw';
      strikeTier = strike.target.kind === 'player' ? tierFromScore(playerHitScore(strike.power, lethalHere)) : tierFromScore(hitScore(strike.power, 0));
      strikeT = travelMs(strikeTier);
      if (strike.counter) counterT = strikeT + Math.round(travelMs(tierFromScore(hitScore(strike.counterPower, 0))) * 0.7);
    }
    // "Cast, then effect" (owner taste call 1, 2026-09-26; broadened
    // 2026-09-27): when a spectacle-tier power fired this move, or when a
    // RESPONSE (an Instant cast on the opponent's turn, at any tier: the
    // reactive pillar is exactly where "this caused that" should read) is
    // announced or, above all, resolves: its RESOLVE/ACTIVATE sigil plays,
    // then its effect lands.
    // Other routine powers stay simultaneous so the approved normal pacing
    // is untouched. The event log can't say which effect came from which
    // power, so the beat applies to the move's effects as a whole: the cast
    // leads, everything it could have caused follows.
    const resolvesResponse = resolvedStackIds(prevFrame, newFrame).some(function (sid) { return RESPONSE_STACK_IDS[sid]; });
    const stagger = !strike && (resolvesResponse || casts.some(staggers)) ? CAST_STAGGER_MS : 0;
    // Command flight (owner taste call 4): the card flies hand -> stack and
    // its CAST sigil starts as it lands.
    const flights = {};
    attacks.forEach(function (a) {
      if (a.phase === 'command') flights[a.stackId] = flyCommandCard(a, prevFrame, prevHandRects);
    });
    // Ability effects with their exact source and target (v2 slice 2,
    // effectFx.ts reading the event log's instance ids). Anything that
    // travels (a spell, heal, buff, debuff from another card, a removal)
    // gets a flight carved out of the move's own window, like an attack's
    // bolt, and what it causes waits for it to land. On a strike move these
    // are the strike's consequences (onDamaged / onDeath powers), so they
    // leave when the strike lands. A removal locks on for longer first.
    const effects = resolveEffects(prevFrame, newFrame);
    const effUnits = {};
    effects.forEach(function (e) { if (e.target.kind === 'unit' && (e.category === 'buff' || e.category === 'debuff')) effUnits[e.category + e.target.instanceId] = true; });
    function effectTier(e) {
      if (e.category === 'spell') return e.target.kind === 'player' ? tierFromScore(playerHitScore(e.amount, false)) : tierFromScore(hitScore(e.amount, aoeCount));
      if (e.category === 'heal') return tierFromScore(healScore(e.amount));
      if (e.category === 'removal') { const v = prevBoard[e.target.instanceId]; return tierFromScore(deathScore(v ? v.v.rarity : 'Common', true)); }
      const same = effects.filter(function (o) { return o.category === e.category; }).length;
      return tierFromScore(statShiftScore(e.category === 'buff' ? 'buff' : 'penalty', e.amount, e.status ? 1 : 0, same));
    }
    const travelling = effects.filter(function (e) { return !e.self; });
    const effTier = maxTierOf(effects.map(effectTier).concat(['subtle']));
    const effT = travelling.length ? Math.round(travelMs(effTier) * (effects.some(function (e) { return e.category === 'removal'; }) ? REMOVAL_LEAD : 1)) : 0;
    const effStart = strike ? strikeT : stagger;
    const effLand = effStart + effT;
    const effectT = strike ? strikeT : effLand;
    const causeT = strike ? strikeT : 0;
    // On a strike move, only the cards an effect actually reaches wait for
    // it; everything else lands with the strike.
    const effArrive = {};
    if (strike) travelling.forEach(function (e) { effArrive[e.target.kind === 'player' ? 'p:' + e.target.playerId : 'u:' + e.target.instanceId] = effLand; });
    function unitT(iid) {
      const base = strike && strike.counter && iid === strike.attackerIid ? counterT : effectT;
      return Math.max(base, effArrive['u:' + iid] || 0);
    }
    function hudT(pid) { return Math.max(effectT, effArrive['p:' + pid] || 0); }

    // ---- stack movement: aim lines, bolts, fizzles, redirects ----------
    const freshAim = {};
    // A redirect is the effect of the power that caused it (Intercept
    // Routine and kin, usually a RESPONSE resolving), so under the cast beat
    // the old line holds until the sigil has played, then swings.
    const redirecting = attacks.some(function (a) { return a.phase === 'redirect'; });
    const aimT = redirecting ? stagger : 0;
    if (aimT > 0) drawAimLines(prevFrame, {});
    attacks.forEach(function (a) {
      if (a.phase === 'declare' || a.phase === 'redirect') freshAim[a.stackId] = true;
      if (a.phase === 'redirect') later(aimT, function () {
        const f = factionOfUnit(newFrame, a.attackerIid) || newFrame.players[a.owner].faction;
        const fromEl = liveCardEl(a.attackerIid);
        const oldTo = a.from.kind === 'unit' ? prevRects[a.from.instanceId] : prevHudRects[a.from.playerId];
        if (fromEl) fadeOldAim(fromEl.getBoundingClientRect(), oldTo, 'var(--' + f.toLowerCase() + ')');
        const newTo = targetEl(a.target);
        if (newTo) { const r = newTo.getBoundingClientRect(); centreOn(spawnNumber(r, 'REDIRECTED', 'redirect', 'normal', 36), r); }
      });
      if (a.phase === 'strike' && a.outcome !== 'hit') {
        // The engine's own two fizzle rules: the attacker, or its unit
        // target, was gone before the damage could resolve.
        const r = a.outcome === 'fizzle-attacker'
          ? (a.target.kind === 'unit' ? (prevRects[a.target.instanceId] || prevRects[a.attackerIid]) : prevHudRects[a.target.playerId])
          : prevRects[a.attackerIid];
        if (r) { tiers.push('subtle'); centreOn(spawnNumber(r, 'FIZZLED', 'fizzle', 'subtle', 40), r); }
      }
    });
    if (Object.keys(freshAim).length) {
      if (aimT > 0) later(aimT, function () { drawAimLines(newFrame, freshAim); });
      else drawAimLines(newFrame, freshAim);
    }
    if (strike) {
      const f = factionOfUnit(prevFrame, strike.attackerIid) || prevFrame.players[strike.owner].faction;
      const tint = 'var(--' + f.toLowerCase() + ')';
      const liveAtk = liveCardEl(strike.attackerIid);
      const fromR = liveAtk ? liveAtk.getBoundingClientRect() : prevRects[strike.attackerIid];
      const liveTo = targetEl(strike.target);
      const toR = strike.target.kind === 'unit'
        ? (liveTo ? liveTo.getBoundingClientRect() : prevRects[strike.target.instanceId])
        : (liveTo ? liveTo.getBoundingClientRect() : prevHudRects[strike.target.playerId]);
      if (liveAtk) flashClass(liveAtk, 'fx-attack', 'normal');
      // v2 (canvasFx.ts): sprite travel + impact on the canvas layers. The
      // v1 DOM bolt and burst remain the fallback when the canvas or the
      // atlases are unavailable, so an attack is never left undrawn.
      if (!CFX.travel(fromR, toR, f, strikeTier, strikeT, false)) spawnBolt(fromR, toR, f, strikeTier, strikeT, false);
      // impact(target): lands with the bolt.
      later(strikeT, function () {
        if (!CFX.impact(toR, f, strikeTier, strike.target.kind) && strikeTier !== 'subtle') spawnBurst(toR, tint, strikeTier === 'spectacle' ? 1.35 : 0.8, f);
      });
      if (strike.counter) {
        // The return bolt wears the DEFENDER's colour: it is their hit.
        const df = factionOfUnit(prevFrame, strike.target.instanceId) || f;
        const cTier = tierFromScore(hitScore(strike.counterPower, 0));
        later(strikeT, function () {
          if (!CFX.travel(toR, fromR, df, cTier, counterT - strikeT, true)) spawnBolt(toR, fromR, df, cTier, counterT - strikeT, true);
        });
        later(counterT, function () { CFX.impact(fromR, df, cTier === 'spectacle' ? 'normal' : 'subtle', 'unit'); });
      }
    }

    // ---- ability effects on the canvas (v2 slice 2) ---------------------
    effects.forEach(function (e) {
      const tier = effectTier(e);
      tiers.push(tier);
      const f = effectFaction(e, prevFrame);
      later(effStart, function () {
        const toR = effectEndRect(e.target, prevRects, prevHudRects, prevStackRects);
        const fromR = e.self ? null : effectEndRect(e.source, prevRects, prevHudRects, prevStackRects);
        CFX.effect(e.category, fromR, toR, f, tier, effT, { self: e.self || !fromR, targetKind: e.target.kind === 'player' ? 'player' : 'unit' });
      });
    });

    // ---- board diff (unchanged meaning; now on the timeline) -----------
    // Who broke each card, for the shatter's colours: the attacker (or, for
    // a counter-kill, the defender), else the effect that reached it, else
    // the card's own faction (an Overload tick, a self-inflicted loss).
    function killerOf(id) {
      if (strike && strike.target.kind === 'unit' && strike.target.instanceId === id) return factionOfUnit(prevFrame, strike.attackerIid) || prevFrame.players[strike.owner].faction;
      if (strike && strike.counter && strike.attackerIid === id) return factionOfUnit(prevFrame, strike.target.instanceId);
      const hit = effects.filter(function (e) { return e.target.kind === 'unit' && e.target.instanceId === id && (e.category === 'removal' || e.category === 'spell' || e.category === 'debuff'); })[0];
      if (hit) return effectFaction(hit, prevFrame);
      return prevBoard[id].v.faction;
    }
    Object.keys(prevBoard).forEach(function (id) {
      if (!newBoard[id]) {
        const tier = tierFromScore(deathScore(prevBoard[id].v.rarity, !hasAttackEvent));
        tiers.push(tier);
        spawnGhost(prevBoard[id], prevRects[id], tier, unitT(id), { killer: killerOf(id) || prevBoard[id].v.faction, victim: prevBoard[id].v.faction });
      }
    });

    Object.keys(newBoard).forEach(function (id) {
      const el = liveCardEl(id);
      if (!el) return;
      if (!prevBoard[id]) {
        const tier = tierFromScore(enterScore(newBoard[id].v.rarity));
        tiers.push(tier);
        if (causeT > 0) { el.style.opacity = '0'; later(causeT, function () { el.style.opacity = ''; flashClass(el, 'fx-enter', tier); }); }
        else flashClass(el, 'fx-enter', tier);
        return;
      }
      if (newBoard[id].kind !== 'unit') return;
      const pv = prevBoard[id].v, nv = newBoard[id].v;
      const evolved = pv.cardId !== nv.cardId;
      if (pv.pending && !nv.pending) { const t = tierFromScore(armedScore(nv.rarity)); tiers.push(t); later(causeT, function () { flashClass(el, 'fx-armed', t); }); }
      if (evolved) { const t = tierFromScore(evolveScore()); tiers.push(t); later(causeT, function () { flashClass(el, 'fx-evolve', t); }); }
      if (nv.canAttackThisTurn === false && pv.canAttackThisTurn === true) flashClass(el, 'fx-attack', 'normal');
      const at = unitT(id);
      // Barrier interpose + absorb + shatter (EFFECTS.md slice 1): the
      // status vanishing is the whole signal — no pairing/attacker info
      // needed. This is the ONLY visual a fully-absorbed hit gets today
      // (health is unchanged, so the hpDelta branch below never fires for
      // it), which is exactly the gap this slice exists to close.
      if (pv.barrierActive && !nv.barrierActive) {
        const t = tierFromScore(barrierBreakScore(nv.rarity));
        tiers.push(t);
        later(at, function () {
          flashClass(el, 'fx-shatter', t);
          spawnNumber(el.getBoundingClientRect(), 'BLOCKED', 'shield', t);
        });
      }
      // Damage/heal is only the part of the health change that ISN'T a
      // maxHealth (stat) change — a +0/+2 buff used to read as a heal, and
      // Null's -2/-2 as a hit. See render/src/statFx.ts's header.
      const residual = healthResidual(pv.health, nv.health, pv.maxHealth, nv.maxHealth);
      // Base-armor deflect (EFFECTS.md slice 1): a small, always-subtle
      // spark layered alongside the ordinary hit flash below — baseArmor
      // reduces every hit it takes (see engine/src/effects/resolver.ts),
      // so any health-reducing hit on such a unit was partially deflected.
      // A hit small enough to be fully absorbed leaves health unchanged and
      // so isn't caught here — that needs per-hit instance-keyed event data
      // the engine doesn't emit yet (progress/render/notes-for-owner.md).
      if (residual < 0) {
        const t = tierFromScore(hitScore(residual, aoeCount));
        tiers.push(t);
        later(at, function () {
          if (nv.baseArmor > 0) spawnDeflect(el.getBoundingClientRect());
          flashClass(el, 'fx-hit', t);
          spawnNumber(el.getBoundingClientRect(), String(residual), 'dmg', t);
        });
      } else if (residual > 0) {
        const t = tierFromScore(healScore(residual));
        tiers.push(t);
        later(at, function () {
          flashClass(el, 'fx-heal', t);
          spawnNumber(el.getBoundingClientRect(), '+' + residual, 'heal', t);
        });
      }
      // An evolution changes the printed stats wholesale — the evolve pulse
      // already tells that story; a rise/sink on top would misreport it.
      if (!evolved) {
        const shift = classifyStatShift(statSideOf(pv), statSideOf(nv));
        if (shift) shifts.push({ el: el, shift: shift, owner: newBoard[id].owner, name: nv.name, at: at, iid: id });
      }
    });

    // Buffs/penalties are applied after the per-unit pass so each one knows
    // how many units took the same kind of shift this move — a -1 aura
    // landing on the whole board is one board-wide spectacle, not five
    // unrelated subtle dips.
    const shiftCounts = { buff: 0, penalty: 0, expire: 0 };
    shifts.forEach(function (x) { shiftCounts[x.shift.kind]++; });
    shifts.forEach(function (x) {
      const s = x.shift;
      const t = tierFromScore(statShiftScore(s.kind, Math.abs(s.attack) + Math.abs(s.health), s.newStatuses.length, shiftCounts[s.kind]));
      tiers.push(t);
      const opp = x.owner === 'p1' ? 'p2' : 'p1';
      const tint = tintFaction(s.kind, newFrame.players[x.owner].faction, newFrame.players[opp].faction, sourceFactionFor(x.name, newFrame));
      const onCanvas = CFX.isReady() && !!effUnits[(s.kind === 'buff' ? 'buff' : 'debuff') + x.iid];
      later(x.at, function () { applyStatShift(x.el, s, tint, t, onCanvas); });
    });

    ['p1', 'p2'].forEach(function (pid) {
      const delta = newFrame.players[pid].health - prevFrame.players[pid].health;
      const hudEl = document.getElementById('hud-' + pid);
      const isLethal = justEnded && newFrame.winner !== pid && newFrame.winner !== 'draw' && delta < 0;
      if (delta < 0) {
        const t = tierFromScore(playerHitScore(delta, isLethal));
        tiers.push(t);
        later(hudT(pid), function () {
          flashClass(hudEl, 'fx-hit', t);
          spawnNumber(prevHudRects[pid], String(delta), 'dmg', t);
        });
      } else if (delta > 0) {
        const t = tierFromScore(playerHitScore(delta, false));
        tiers.push(t);
        later(hudT(pid), function () {
          flashClass(hudEl, 'fx-heal', t);
          spawnNumber(prevHudRects[pid], '+' + delta, 'heal', t);
        });
      }
    });

    // Power / ability cast flourishes (EFFECTS.md slice 3), in event order.
    // On a strike they are consequences and land with the bolt; a Command's
    // CAST waits for its flying card to reach the stack.
    const castCount = {};
    casts.forEach(function (fx) {
      const key = fx.anchor + ':' + (fx.iid || fx.stackId || fx.owner || 'mid');
      castCount[key] = (castCount[key] || 0) + 1;
      tiers.push(fx.tier);
      const idx = castCount[key] - 1;
      const wait = strike ? strikeT : (fx.anchor === 'stack' && fx.kind === 'announce' && fx.stackId && flights[fx.stackId] ? flights[fx.stackId] : 0);
      later(wait, function () { spawnCast(fx, prevRects, prevStackRects, idx); });
    });

    tiers.push(tierFromScore(momentumSwingScore(prevFrame.momentum.score, newFrame.momentum.score)));
    if (justEnded) { tiers.push('spectacle'); later(Math.max(effectT, counterT), showLethalFlash); }

    return maxTierOf(tiers);
  }

  function stackRects() {
    const map = {};
    document.querySelectorAll('.stackitem[data-sid]').forEach(function (el) { map[el.getAttribute('data-sid')] = el.getBoundingClientRect(); });
    return map;
  }
  function handRects() {
    const map = { p1: {}, p2: {} };
    ['p1', 'p2'].forEach(function (pid) {
      document.querySelectorAll('#hand-' + pid + ' .minicard[data-name]').forEach(function (el) {
        const n = el.getAttribute('data-name');
        if (!map[pid][n]) map[pid][n] = el.getBoundingClientRect();
      });
    });
    return map;
  }

  function goTo(n) {
    const target = Math.max(0, Math.min(frames.length - 1, n));
    if (target === i + 1) {
      // Anything move i was still waiting to show plays now, on move i's
      // board, before move i+1 replaces it.
      flushFx();
      const prevFrame = frames[i];
      const prevBoard = collectBoard(prevFrame);
      const prevRects = currentRectsByIid();
      const prevHudRects = { p1: hudRect('p1'), p2: hudRect('p2') };
      const prevStackRects = stackRects();
      const prevHandRects = handRects();
      i = target;
      renderFrame();
      lastTransitionTier = runFx(prevFrame, prevBoard, prevRects, prevHudRects, prevStackRects, prevHandRects, frames[i]);
    } else {
      cancelFx();
      while (aimLayer.firstChild) aimLayer.removeChild(aimLayer.firstChild);
      i = target;
      renderFrame();
      lastTransitionTier = 'normal'; // a jump has no "in between" to weigh, so pacing falls back to normal
    }
    if (i === frames.length - 1) stop();
  }

  function stop() { playing = false; clearTimeout(timer); document.getElementById('btn-play').textContent = '\\u25B6'; }

  // Adaptive pacing (owner feedback 2026-09-25, item 4): a fixed-interval
  // timer gives a lethal blow and a 1-damage ping the same amount of screen
  // time. Instead, each tick's wait is chosen from the tier of the move
  // that was JUST shown — a spectacle moment holds so its animation (up to
  // 900-1300ms) actually lands before the next move starts overwriting it;
  // a subtle move breezes past faster, since DESIGN's watchability bar
  // wants routine moves to flash by, not pad out the runtime.
  function nextDelay(baseSpeed) {
    if (lastTransitionTier === 'spectacle') return baseSpeed + 900;
    if (lastTransitionTier === 'subtle') return Math.max(120, Math.round(baseSpeed * 0.55));
    return baseSpeed;
  }

  function scheduleTick() {
    const speed = Number(document.getElementById('speed').value);
    timer = setTimeout(function () {
      if (i >= frames.length - 1) { stop(); return; }
      goTo(i + 1);
      if (playing) scheduleTick();
    }, nextDelay(speed));
  }

  function play() {
    if (i >= frames.length - 1) i = 0;
    playing = true;
    lastTransitionTier = 'normal';
    document.getElementById('btn-play').textContent = '\\u23F8';
    clearTimeout(timer);
    scheduleTick();
  }

  document.getElementById('btn-first').onclick = function () { stop(); goTo(0); };
  document.getElementById('btn-prev').onclick = function () { stop(); goTo(i - 1); };
  document.getElementById('btn-next').onclick = function () { stop(); goTo(i + 1); };
  document.getElementById('btn-last').onclick = function () { stop(); goTo(frames.length - 1); };
  document.getElementById('btn-play').onclick = function () { playing ? stop() : play(); };
  scrubber.oninput = function () { stop(); goTo(Number(scrubber.value)); };
  document.getElementById('speed').onchange = function () { if (playing) { stop(); play(); } };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { stop(); goTo(i + 1); }
    if (e.key === 'ArrowLeft') { stop(); goTo(i - 1); }
    if (e.key === ' ') { e.preventDefault(); playing ? stop() : play(); }
  });

  // Aim lines are drawn in viewport coordinates; keep them on their cards.
  window.addEventListener('resize', function () { drawAimLines(frames[i], {}); });
  window.addEventListener('scroll', function () { drawAimLines(frames[i], {}); }, { passive: true });

  renderFrame();
})();
`;
