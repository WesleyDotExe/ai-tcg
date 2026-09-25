import type { MatchReplay } from "./types.js";

/** Builds the self-contained HTML replay page (RENDER.md's suggested first
 * slice): a single file, no external network dependency (no CDN fonts/JS —
 * this has to keep working when opened offline straight from the repo), that
 * plays a captured match back turn by turn. All data is embedded as JSON;
 * all interactivity is one inline <script>, vanilla DOM, no framework —
 * matching the project's own zero-dependency instinct (see agents/'s own
 * package.json comment) for something this self-contained. */
export function renderMatchHtml(replay: MatchReplay): string {
  const dataJson = JSON.stringify(replay).replace(/</g, "\\u003c");
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
<script>${JS}</script>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const CSS = `
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
  --aegis: #9fd8d0;
  --swarm: #8bff5c;
  --null: #d565ff;
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
#app { max-width: 1180px; margin: 0 auto; padding: 14px 12px 24px; }

.hud-row { display: grid; grid-template-columns: 1fr 220px 1fr; gap: 10px; align-items: stretch; margin-bottom: 8px; }
.hud { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; }
.hud .name { font-weight: bold; letter-spacing: 0.05em; display: flex; justify-content: space-between; }
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
.card .tags { position: absolute; top: 2px; left: 2px; display: flex; flex-direction: column; gap: 2px; z-index: 2; }
.card .tag { font-size: 0.52rem; padding: 1px 3px; border-radius: 2px; background: rgba(0,0,0,0.55); color: #fff; letter-spacing: 0.03em; }
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
.faction-Aegis { --fc: var(--aegis); --rc: #b9f3ea; }
.faction-Swarm { --fc: var(--swarm); --rc: #b6ff8f; }
.faction-Null { --fc: var(--null); --rc: #e79bff; }
.card.faction-Cortex, .card.faction-Aegis, .card.faction-Swarm, .card.faction-Null { background: var(--fc); }

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
.card.fx-buff { animation: fx-buff-flash 450ms ease; }
@keyframes fx-buff-flash {
  0% { box-shadow: 0 0 0 3px var(--neutral) inset, 0 0 16px var(--neutral); }
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

.fx-number { position: fixed; font-weight: bold; font-size: 0.95rem; letter-spacing: 0.02em;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8); white-space: nowrap; animation: fx-float 900ms ease forwards; }
.fx-number.dmg { color: var(--bad); }
.fx-number.heal { color: var(--good); }
.fx-number.buff { color: var(--neutral); }
@keyframes fx-float {
  0% { opacity: 0; transform: translateY(0); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-38px); }
}

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
.fx-mag-subtle.fx-hit, .fx-mag-subtle.fx-heal, .fx-mag-subtle.fx-buff { box-shadow: none !important; filter: brightness(1.12); }
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
.fx-mag-spectacle.fx-buff { animation-name: fx-buff-flash-big; }
@keyframes fx-buff-flash-big {
  0% { box-shadow: 0 0 0 5px var(--neutral) inset, 0 0 34px 6px var(--neutral); transform: scale(1); }
  35% { transform: scale(1.08); }
  100% { box-shadow: none; transform: scale(1); }
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
`;

const JS = `
(function () {
  const replay = JSON.parse(document.getElementById('match-data').textContent);
  const frames = replay.frames;
  let i = 0;
  let playing = false;
  let timer = null;

  document.getElementById('matchup').innerHTML =
    '<span class="faction-' + replay.factions.p1 + '" style="color:var(--fc)">' + escapeHtml(replay.agentNames.p1) + ' [' + replay.factions.p1 + ']</span>' +
    '<span class="vs">vs</span>' +
    '<span class="faction-' + replay.factions.p2 + '" style="color:var(--fc)">' + escapeHtml(replay.agentNames.p2) + ' [' + replay.factions.p2 + ']</span>';

  const scrubber = document.getElementById('scrubber');
  scrubber.max = String(frames.length - 1);

  const fxLayer = document.createElement('div');
  fxLayer.className = 'fx-layer';
  document.body.appendChild(fxLayer);

  // Magnitude scoring (render-lane session 3): hand-mirrors
  // render/src/fxMagnitude.ts's pure, unit-tested logic. It has to be
  // reimplemented here rather than imported — this whole file is a
  // template-literal <script> that runs unbundled in the browser, the same
  // reason cardArtStyle below reimplements cardVisual.ts's placeholder-art
  // logic instead of importing it. Keep the two in sync by hand; the tiers
  // and thresholds are the same numbers as fxMagnitude.ts.
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
  function buffScore(atkDelta) { const d = Math.abs(atkDelta); return d <= 1 ? 0.6 : d <= 3 ? 1.3 : 2.6; }
  function evolveScore() { return 2.8; }
  function armedScore(rarity) { return { Common: 1.0, Uncommon: 1.2, Rare: 1.9, Mythic: 2.5 }[rarity]; }
  function momentumSwingScore(prevScore, newScore) {
    const d = Math.abs(newScore - prevScore);
    return d <= 6 ? 0 : d <= 15 ? 1.2 : d <= 25 ? 2.0 : 3.2;
  }
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
    if (opts.keywords) opts.keywords.forEach(function (k) { tags.push(k.toUpperCase()); });
    div.innerHTML =
      '<div class="head"><span>' + rarity[0] + '</span><span class="cost">' + c.cost + '</span></div>' +
      '<div class="art" style="' + cardArtStyle(c.faction, c.visualSeed, c.visualPattern) + '"><span class="glyph">' + glyphFor(c.type) + '</span></div>' +
      '<div class="name">' + escapeHtml(c.name) + '</div>' +
      (opts.tools && opts.tools.length ? '<div class="tools">' + opts.tools.map(function (t) { return '<span class="tool-chip">' + escapeHtml(t.name) + '</span>'; }).join('') + '</div>' : '') +
      (opts.stats ? '<div class="stats"><span class="atk">' + opts.stats.attack + '</span><span class="hp">' + opts.stats.health + '</span></div>' : '') +
      (tags.length ? '<div class="tags">' + tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('') + '</div>' : '') +
      (opts.armTurn !== undefined ? '<div class="arm-count">T' + opts.armTurn + '</div>' : '');
    return div;
  }

  function renderUnitSlot(u, owner) {
    return renderCardEl(
      { name: u.name, faction: u.faction, rarity: u.rarity, cost: 0, type: 'Unit', flavor: u.flavor, visualSeed: u.visualSeed, visualPattern: u.visualPattern },
      { stats: { attack: u.attack, health: u.health }, pending: u.pending, armTurn: u.pending ? u.armTurn : undefined, isEvolved: u.isEvolved, keywords: u.keywords, tools: u.tools, instanceId: u.instanceId, owner: owner },
    );
  }

  function renderDirectiveSlot(d, owner) {
    return renderCardEl({ name: d.name, faction: d.faction, rarity: d.rarity, cost: 0, type: 'Directive', flavor: d.flavor, visualSeed: d.visualSeed, visualPattern: d.visualPattern }, { instanceId: d.instanceId, owner: owner });
  }

  function renderBoard(elId, snapshot) {
    const el = document.getElementById(elId);
    el.innerHTML = '';
    const occupants = snapshot.board.map(function (u) { return { kind: 'unit', v: u }; })
      .concat(snapshot.directives.map(function (d) { return { kind: 'dir', v: d }; }));
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
      '<div class="name"><span id="' + elId + '-name"></span><span class="faction-tag" id="' + elId + '-faction" style="color:var(--fc)"></span></div>' +
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

  function spawnGhost(entry, rect, tier) {
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    const cardEl = entry.kind === 'unit' ? renderUnitSlot(entry.v, entry.owner) : renderDirectiveSlot(entry.v, entry.owner);
    cardEl.classList.add('fx-ghost', 'fx-mag-' + tier);
    cardEl.style.position = 'fixed';
    cardEl.style.left = rect.left + 'px';
    cardEl.style.top = rect.top + 'px';
    cardEl.style.width = rect.width + 'px';
    cardEl.style.height = rect.height + 'px';
    cardEl.style.margin = '0';
    fxLayer.appendChild(cardEl);
    if (tier === 'spectacle') spawnBurst(rect, 'var(--bad)');
    setTimeout(function () { cardEl.remove(); }, GHOST_MS[tier] || GHOST_MS.normal);
  }

  function spawnNumber(rect, text, cls, tier) {
    if (!rect) return;
    const el = document.createElement('div');
    el.className = 'fx-number ' + cls + (tier ? ' mag-' + tier : '');
    el.textContent = tier === 'spectacle' ? text + '!' : text;
    el.style.left = (rect.left + rect.width / 2 - 16) + 'px';
    el.style.top = (rect.top + 6) + 'px';
    fxLayer.appendChild(el);
    setTimeout(function () { el.remove(); }, NUMBER_MS[tier] || NUMBER_MS.normal);
  }

  function spawnBurst(rect, color) {
    if (!rect) return;
    const el = document.createElement('div');
    el.className = 'fx-burst';
    el.style.setProperty('--burst-color', color);
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top + rect.height / 2) + 'px';
    fxLayer.appendChild(el);
    setTimeout(function () { el.remove(); }, 750);
  }

  function flashClass(el, cls, tier) {
    if (!el) return;
    const magCls = 'fx-mag-' + tier;
    el.classList.remove(cls, 'fx-mag-subtle', 'fx-mag-normal', 'fx-mag-spectacle');
    void el.offsetWidth; // force reflow so re-adding the class retriggers the keyframe
    el.classList.add(cls, magCls);
    if (tier === 'spectacle' && (cls === 'fx-evolve' || cls === 'fx-enter' || cls === 'fx-armed')) {
      spawnBurst(el.getBoundingClientRect(), cls === 'fx-evolve' ? 'var(--good)' : 'var(--neutral)');
    }
    setTimeout(function () { el.classList.remove(cls, magCls); }, FLASH_MS[tier] || FLASH_MS.normal);
  }

  function showLethalFlash() {
    const el = document.createElement('div');
    el.className = 'fx-lethal-overlay';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1200);
  }

  function runFx(prevFrame, prevBoard, prevRects, prevHudRects, newFrame) {
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

    Object.keys(prevBoard).forEach(function (id) {
      if (!newBoard[id]) {
        const tier = tierFromScore(deathScore(prevBoard[id].v.rarity, !hasAttackEvent));
        tiers.push(tier);
        spawnGhost(prevBoard[id], prevRects[id], tier);
      }
    });

    Object.keys(newBoard).forEach(function (id) {
      const el = liveCardEl(id);
      if (!el) return;
      if (!prevBoard[id]) {
        const tier = tierFromScore(enterScore(newBoard[id].v.rarity));
        tiers.push(tier);
        flashClass(el, 'fx-enter', tier);
        return;
      }
      if (newBoard[id].kind !== 'unit') return;
      const pv = prevBoard[id].v, nv = newBoard[id].v;
      if (pv.pending && !nv.pending) { const t = tierFromScore(armedScore(nv.rarity)); tiers.push(t); flashClass(el, 'fx-armed', t); }
      if (pv.cardId !== nv.cardId) { const t = tierFromScore(evolveScore()); tiers.push(t); flashClass(el, 'fx-evolve', t); }
      if (nv.canAttackThisTurn === false && pv.canAttackThisTurn === true) flashClass(el, 'fx-attack', 'normal');
      const hpDelta = nv.health - pv.health;
      if (hpDelta < 0) {
        const t = tierFromScore(hitScore(hpDelta, aoeCount));
        tiers.push(t);
        flashClass(el, 'fx-hit', t);
        spawnNumber(el.getBoundingClientRect(), String(hpDelta), 'dmg', t);
      } else if (hpDelta > 0) {
        const t = tierFromScore(healScore(hpDelta));
        tiers.push(t);
        flashClass(el, 'fx-heal', t);
        spawnNumber(el.getBoundingClientRect(), '+' + hpDelta, 'heal', t);
      }
      const atkDelta = nv.attack - pv.attack;
      if (atkDelta !== 0 && hpDelta === 0) {
        const t = tierFromScore(buffScore(atkDelta));
        tiers.push(t);
        flashClass(el, 'fx-buff', t);
        spawnNumber(el.getBoundingClientRect(), (atkDelta > 0 ? '+' : '') + atkDelta + ' ATK', 'buff', t);
      }
    });

    ['p1', 'p2'].forEach(function (pid) {
      const delta = newFrame.players[pid].health - prevFrame.players[pid].health;
      const hudEl = document.getElementById('hud-' + pid);
      const isLethal = justEnded && newFrame.winner !== pid && newFrame.winner !== 'draw' && delta < 0;
      if (delta < 0) {
        const t = tierFromScore(playerHitScore(delta, isLethal));
        tiers.push(t);
        flashClass(hudEl, 'fx-hit', t);
        spawnNumber(prevHudRects[pid], String(delta), 'dmg', t);
      } else if (delta > 0) {
        const t = tierFromScore(playerHitScore(delta, false));
        tiers.push(t);
        flashClass(hudEl, 'fx-heal', t);
        spawnNumber(prevHudRects[pid], '+' + delta, 'heal', t);
      }
    });

    tiers.push(tierFromScore(momentumSwingScore(prevFrame.momentum.score, newFrame.momentum.score)));
    if (justEnded) { tiers.push('spectacle'); showLethalFlash(); }

    return maxTierOf(tiers);
  }

  function goTo(n) {
    const target = Math.max(0, Math.min(frames.length - 1, n));
    if (target === i + 1) {
      const prevFrame = frames[i];
      const prevBoard = collectBoard(prevFrame);
      const prevRects = currentRectsByIid();
      const prevHudRects = { p1: hudRect('p1'), p2: hudRect('p2') };
      i = target;
      renderFrame();
      lastTransitionTier = runFx(prevFrame, prevBoard, prevRects, prevHudRects, frames[i]);
    } else {
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

  renderFrame();
})();
`;
