// The self-contained pack-opening page (render session 24; owner
// 2026-10-18, slice 1 of 3: "single pack plus every finish reveal"). Like
// the replay pages: one HTML file, all data embedded as JSON, one inline
// script, no network, no framework. It moves into the owner website when
// that exists; until then it is driven by real store openings
// (packDemo.ts).
//
// The single-pack flow, as the owner set it out:
//  1. A code-drawn Season 0 pack with an idle shimmer (a shader). Drag
//     across the top to tear it open; a tap tears it too (and Enter/Space).
//  2. The cards come out as a stack. Swipe or tap through them. Plain cards
//     move quickly; the shine-slot card is always last of the five.
//  3. The honest tell: the tear throws sparks exactly when the pack holds a
//     hit (Full Art or better, as counted for pity). Never a fake-out.
//  4. A reveal for each finish (Foil, Full Art, Alt Art, Glitch, secret
//     illustration, Gold, Prototype, Zero-Day; a Jackpot pack's banner).
//  5. A summary: the cards with their finishes, NEW badges, pack points,
//     then "Open another" or "Done".
// Sound comes from the game's own sound system (soundFx.ts: the same
// player, the same remembered setting).
//
// The page never decides what is in a pack: it plays back the PackReveal
// plans it was given (packOpening.ts), each one a real opening.

import { PACK_FX_RUNTIME_SOURCE, PACK_FX_SHADERS } from "./packFx.js";
import { PACK_TIMINGS, REVEAL_TIMINGS, ZERO_DAY_TIMINGS, type PackReveal } from "./packOpening.js";
import { SOUND_FX_PURE_SOURCE, SOUND_FX_RUNTIME_SOURCE } from "./soundFx.js";

export interface PackPageData {
  title: string;
  packs: { label: string; reveal: PackReveal }[];
}

export function renderPackOpeningHtml(data: PackPageData): string {
  const embed = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
  const timings = { pack: PACK_TIMINGS, reveal: REVEAL_TIMINGS, zeroDay: ZERO_DAY_TIMINGS };
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(data.title)}</title>
<style>${PACK_CSS}</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <symbol id="setsym" viewBox="0 0 16 16"><path d="M8 1 14 4.5v7L8 15 2 11.5v-7z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="2.3" fill="currentColor"/></symbol>
    <filter id="only-r" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter>
    <filter id="only-gb" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/></filter>
  </defs>
</svg>
<div class="crt" aria-hidden="true"></div>
<header class="bar">
  <div class="brand">AI·TCG <span>// PACK OPENING</span></div>
  <nav class="picker" id="picker" aria-label="Choose a pack"></nav>
  <span class="sound-ctl" data-audio-ctl>
    <button id="btn-sound" aria-pressed="true" title="Sound is on. Click to mute.">Sound on</button>
    <input type="range" id="sound-vol" min="0" max="100" step="1" value="80" aria-label="Effects volume" title="Effects volume">
  </span>
</header>
<main class="stage" id="stage">
  <div class="dim" id="dim"></div>
  <div class="scene" id="scene"></div>
  <canvas class="sparks" id="sparks" aria-hidden="true"></canvas>
  <div class="hint" id="hint" aria-live="polite"></div>
  <div class="counter" id="counter"></div>
  <button class="skip" id="skip" hidden>Skip to summary</button>
</main>
<div class="zd" id="zd" hidden><div class="zd-term" id="zd-term"></div></div>
<p class="sr" id="announce" aria-live="assertive"></p>
<footer class="foot" id="foot"></footer>
<script type="application/json" id="pack-data">${embed(data)}</script>
<script type="application/json" id="pack-timings">${embed(timings)}</script>
<script type="application/json" id="pack-shaders">${embed(PACK_FX_SHADERS)}</script>
<script>${SOUND_FX_PURE_SOURCE}
${SOUND_FX_RUNTIME_SOURCE}
var PACK_FX_SHADERS = JSON.parse(document.getElementById('pack-shaders').textContent);
${PACK_FX_RUNTIME_SOURCE}
${PACK_PAGE_PURE_SOURCE}
${PACK_PAGE_RUNTIME_SOURCE}</script>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const PACK_CSS = `
:root {
  --bg: #05060d; --ink: #e6eeff; --dim: #8ea3c9; --line: #24314f;
  --cortex: #35c9ff; --aegis: #ff7d24; --swarm: #8bff5c; --null: #d565ff; --neutral: #fff0c2;
  --gold1: #7a5a12; --gold2: #f6d77a; --gold3: #b8862a; --gold4: #fff1b8;
  /* The card's width: as big as the phone or the window allows. */
  --cw: min(74vw, 300px, calc((100dvh - 210px) * 0.714));
  font-size: 15px;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; overflow-x: hidden; }
body { min-height: 100dvh; display: flex; flex-direction: column; }
button { font: inherit; color: inherit; cursor: pointer; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.crt { position: fixed; inset: 0; pointer-events: none; z-index: 40; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px); mix-blend-mode: overlay; }

.bar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--line); background: rgba(8,11,22,0.9); position: relative; z-index: 30; flex-wrap: wrap; }
.brand { font-weight: 800; letter-spacing: 0.08em; font-size: 13px; white-space: nowrap; }
.brand span { color: var(--dim); font-weight: 600; }
.picker { display: flex; gap: 6px; overflow-x: auto; flex: 1 1 300px; min-width: 0; scrollbar-width: thin; padding-bottom: 2px; }
.picker button { flex: none; border: 1px solid var(--line); background: #0d1324; border-radius: 999px; padding: 4px 11px; font-size: 12px; color: var(--dim); }
.picker button.on { color: var(--ink); border-color: #6a8cff; background: #17204a; }
.sound-ctl { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.sound-ctl button { border: 1px solid var(--line); background: #0d1324; border-radius: 6px; padding: 4px 9px; }
.sound-ctl input { width: 70px; }

.stage { position: relative; flex: 1; min-height: calc(100dvh - 120px); overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none;
  background: radial-gradient(ellipse at 50% 38%, #1d2350 0%, #0b0e24 48%, #05060d 100%); }
.stage::before { content: ""; position: absolute; inset: -20%; background: radial-gradient(circle at 30% 20%, rgba(122,92,255,0.25), transparent 40%), radial-gradient(circle at 75% 70%, rgba(47,182,255,0.18), transparent 45%); animation: drift 16s ease-in-out infinite alternate; pointer-events: none; }
@keyframes drift { to { transform: translate(6%, -4%) scale(1.1); } }
.dim { position: absolute; inset: 0; background: #000; opacity: 0; transition: opacity 0.6s; pointer-events: none; z-index: 1; }
.scene { position: absolute; inset: 0; display: grid; place-items: center; z-index: 2; perspective: 1100px; }
.sparks { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 6; }
.hint { position: absolute; left: 16px; right: 16px; bottom: 18px; text-align: center; color: var(--dim); font-size: 13px; z-index: 5; min-height: 2.6em; }
.hint .slot { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; color: #fff; background: rgba(106,140,255,0.25); border: 1px solid rgba(106,140,255,0.6); border-radius: 4px; padding: 1px 7px; margin-bottom: 4px; }
.hint .slot.bonus { background: rgba(246,215,122,0.22); border-color: var(--gold2); color: var(--gold4); }
.counter { position: absolute; top: 12px; right: 16px; font-size: 12px; color: var(--dim); z-index: 5; font-variant-numeric: tabular-nums; }
.skip { position: absolute; top: 10px; left: 16px; z-index: 5; border: 1px solid var(--line); background: rgba(13,19,36,0.8); border-radius: 6px; padding: 3px 9px; font-size: 12px; color: var(--dim); }
.foot { padding: 8px 16px 12px; font-size: 11px; color: var(--dim); border-top: 1px solid var(--line); background: #070912; }
.foot b { color: var(--ink); font-weight: 600; }

/* ---------- the pack ---------- */
.pack { --pw: min(56vw, 230px, calc((100dvh - 230px) * 0.62)); width: var(--pw); height: calc(var(--pw) * 1.6); position: relative; transform-style: preserve-3d; cursor: grab; animation: bob 3.4s ease-in-out infinite; }
.pack.held { animation: none; }
.pack:focus { outline: none; }
.pack:focus-visible { outline: 2px solid #6a8cff; outline-offset: 8px; border-radius: 12px; }
@keyframes bob { 50% { transform: translateY(-8px) rotateZ(-0.6deg); } }
.pack .tilt { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.12s; }
.pack .half { position: absolute; left: 0; right: 0; overflow: hidden; }
.pack .half.top { top: 0; height: 16%; z-index: 2; }
.pack .half.body { top: 16%; bottom: 0; }
.pack .wrap { position: absolute; left: 0; right: 0; height: calc(var(--pw) * 1.6); border-radius: 10px;
  background: linear-gradient(135deg, #1b2a6b 0%, #3a1f7a 32%, #11163a 55%, #2a1150 78%, #0f2a5e 100%);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.08), inset 0 0 40px rgba(0,0,0,0.5); }
.pack .half.body .wrap { top: calc(var(--pw) * -0.256); }
.pack .crimp { position: absolute; left: 0; right: 0; height: 12px; background: repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 4px, rgba(0,0,0,0.25) 4px 8px); }
.pack .crimp.t { top: 0; } .pack .crimp.b { bottom: 0; }
.pack .logo { position: absolute; top: 24%; left: 0; right: 0; text-align: center; font-weight: 900; letter-spacing: 0.12em; font-size: calc(var(--pw) * 0.15);
  background: linear-gradient(180deg, #fff 0%, #bfe3ff 45%, #6a8cff 55%, #e6d2ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 2px 6px rgba(80,120,255,0.6)); }
.pack .emb { position: absolute; top: 42%; left: 50%; width: 42%; aspect-ratio: 1; transform: translateX(-50%); color: #bfe3ff; filter: drop-shadow(0 0 10px rgba(120,170,255,0.7)); }
.pack .emb svg { width: 100%; height: 100%; }
.pack .set { position: absolute; top: 72%; left: 0; right: 0; text-align: center; font-weight: 800; letter-spacing: 0.3em; font-size: calc(var(--pw) * 0.06); color: #dfe8ff; }
.pack .meta { position: absolute; top: 79%; left: 0; right: 0; text-align: center; font-size: calc(var(--pw) * 0.05); color: #9fb1dd; letter-spacing: 0.08em; }
.pack .cutline { position: absolute; left: 6%; right: 6%; top: 16%; height: 0; border-top: 1px dashed rgba(255,255,255,0.35); z-index: 3; }
.pack .cutline i { position: absolute; left: 0; top: -2px; height: 3px; width: 0; background: linear-gradient(90deg, #fff, #bfe3ff); box-shadow: 0 0 10px #bfe3ff, 0 0 22px #6a8cff; border-radius: 2px; }
.pack .grip { position: absolute; left: 0; right: 0; top: 0; height: 26%; z-index: 4; }
.pack .fxgl { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 10px; mix-blend-mode: screen; pointer-events: none; z-index: 2; }
.pack.fx-css-pack .half.body::after { content: ""; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%); background-size: 250% 100%; animation: sheen 3.6s linear infinite; mix-blend-mode: screen; }
.pack.torn .half.top { animation: stripoff 0.65s cubic-bezier(.3,.7,.4,1) forwards; }
@keyframes stripoff { to { transform: translate(28%, -140%) rotate(16deg); opacity: 0; } }
.pack.torn .half.body { animation: packdown 0.7s 0.35s cubic-bezier(.5,0,.8,.4) forwards; }
@keyframes packdown { to { transform: translateY(70%); opacity: 0; } }
.pack.torn { animation: none; cursor: default; }
.finger { position: absolute; top: 9%; left: 8%; width: 22px; height: 22px; border-radius: 50%; background: rgba(255,255,255,0.75); box-shadow: 0 0 14px #fff; z-index: 5; pointer-events: none; animation: swipehint 2.2s ease-in-out infinite; }
@keyframes swipehint { 0% { transform: translateX(0); opacity: 0; } 15% { opacity: 1; } 70% { transform: translateX(calc(var(--pw) * 0.75)); opacity: 1; } 100% { transform: translateX(calc(var(--pw) * 0.75)); opacity: 0; } }
.banner { position: absolute; left: 50%; top: 18%; transform: translateX(-50%); z-index: 7; padding: 8px 18px; border-radius: 8px; font-weight: 900; letter-spacing: 0.16em; font-size: 20px; white-space: nowrap;
  color: #2b1a00; background: linear-gradient(110deg, var(--gold1), var(--gold2) 30%, var(--gold4) 50%, var(--gold2) 70%, var(--gold1)); background-size: 250% 100%; animation: sheen 1.6s linear infinite, pop 0.5s cubic-bezier(.2,1.6,.4,1); box-shadow: 0 0 30px rgba(246,215,122,0.6); }
.banner small { display: block; font-size: 11px; letter-spacing: 0.08em; text-align: center; font-weight: 700; }
@keyframes pop { from { transform: translateX(-50%) scale(0.3); opacity: 0; } }
@keyframes sheen { from { background-position: 120% 0; } to { background-position: -120% 0; } }

/* ---------- the stack ---------- */
.stack { position: relative; width: var(--cw); height: calc(var(--cw) * 1.4); }
.cslot { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.3s cubic-bezier(.2,.8,.3,1), opacity 0.3s; will-change: transform; }
.cslot.rise { animation: rise 0.7s cubic-bezier(.2,.9,.3,1) both; }
@keyframes rise { from { transform: translateY(65%) scale(0.86); opacity: 0; } }
.flipper { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.42s cubic-bezier(.3,.6,.3,1); }
.cslot.down .flipper { transform: rotateY(180deg); }
.front { position: absolute; inset: 0; transform-style: preserve-3d; }
.face, .back { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: calc(var(--cw) * 0.05); }
.back { transform: rotateY(180deg); overflow: hidden;
  background: radial-gradient(circle at 50% 50%, #2c3a8a 0%, #141a44 45%, #090c22 100%); box-shadow: inset 0 0 0 calc(var(--cw) * 0.025) #1c2350, inset 0 0 0 calc(var(--cw) * 0.03) rgba(255,255,255,0.15); }
.back::before { content: ""; position: absolute; inset: 8%; border-radius: 6px; background: repeating-conic-gradient(from 0deg, rgba(120,160,255,0.09) 0 15deg, transparent 15deg 30deg); border: 1px solid rgba(160,190,255,0.25); }
.back .bl { position: absolute; inset: 0; display: grid; place-items: center; font-weight: 900; letter-spacing: 0.12em; font-size: calc(var(--cw) * 0.12); color: #cfe0ff; text-shadow: 0 0 16px #6a8cff; }
.back .bs { position: absolute; left: 50%; top: 64%; width: 18%; transform: translateX(-50%); color: #9fb6ff; }
.cslot.down.glow .back { animation: glow 1.4s ease-in-out infinite; }
@keyframes glow { 50% { box-shadow: inset 0 0 0 calc(var(--cw) * 0.025) #1c2350, 0 0 26px 6px rgba(150,190,255,0.75), 0 0 60px 12px rgba(122,92,255,0.45); } }
.cslot.dragging { transition: none; }
.cslot.gone-l { transform: translateX(-140%) rotate(-18deg) !important; opacity: 0; }
.cslot.gone-r { transform: translateX(140%) rotate(18deg) !important; opacity: 0; }

/* ---------- the card face (owner-approved layout, card-text-layout.html) ---------- */
.face { overflow: hidden; container-type: inline-size; background: linear-gradient(160deg, #343b4d, #1e2330);
  box-shadow: 0 14px 40px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.07), inset 0 0 0 4px var(--fc, #3a4152); }
.faction-Cortex { --fc: var(--cortex); } .faction-Aegis { --fc: var(--aegis); } .faction-Swarm { --fc: var(--swarm); } .faction-Null { --fc: var(--null); } .faction-Neutral { --fc: var(--neutral); }
.face .art { position: absolute; left: 4.5%; right: 4.5%; top: 13%; height: 41%; border-radius: 6px; overflow: hidden; transition: all 0.7s cubic-bezier(.3,.7,.2,1); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15); }
.face .art svg { width: 100%; height: 100%; display: block; }
.face .head { position: absolute; left: 4.5%; right: 4.5%; top: 2.6%; height: 9%; display: flex; align-items: center; justify-content: space-between; gap: 6px; z-index: 2; }
.face .name { font-weight: 800; font-size: 6.4cqw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }
.face .cost { flex: none; width: 10.5cqw; height: 10.5cqw; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 5.6cqw; color: #0b1a2a; background: radial-gradient(circle at 35% 30%, #fff, #9fd8ff 40%, #2b6fa8); box-shadow: 0 0 0 1px rgba(0,0,0,0.4); }
.face .type { position: absolute; left: 4.5%; right: 4.5%; top: 55.5%; height: 7%; display: flex; justify-content: space-between; align-items: center; font-size: 4.4cqw; padding: 0 2.5cqw; background: rgba(0,0,0,0.32); border-radius: 4px; z-index: 2; }
.face .rar { color: var(--fc); font-weight: 700; }
.face .text { position: absolute; left: 4.5%; right: 4.5%; top: 64%; bottom: 13%; padding: 2.4cqw 3cqw; font-size: 4.3cqw; line-height: 1.32; border-radius: 4px; background: rgba(0,0,0,0.26); color: #dfe5f1; overflow: hidden; z-index: 2; }
.face .text p { margin: 0 0 1.4cqw; }
.face .text .flav { color: #9aa6bf; font-style: italic; }
.face .stats { position: absolute; right: 5.5%; bottom: 13.8%; display: flex; gap: 2cqw; z-index: 3; }
.face .stats span { min-width: 11cqw; height: 9cqw; padding: 0 2cqw; border-radius: 5px; display: grid; place-items: center; font-weight: 900; font-size: 5.2cqw; background: #0d0f15; border: 1px solid rgba(255,255,255,0.18); }
.face .stats .atk { color: #ffd0a0; } .face .stats .hp { color: #b4ffcf; }
.face .foot { position: absolute; left: 5%; right: 5%; bottom: 3.6%; height: 7%; display: flex; justify-content: space-between; align-items: center; font-size: 4cqw; color: #9aa6bf; z-index: 3; }
.face .setno { display: flex; align-items: center; gap: 1.6cqw; font-variant-numeric: tabular-nums; font-weight: 700; color: #cfd5e2; }
.face .setno svg { width: 5.4cqw; height: 5.4cqw; }
.face .mark { position: absolute; left: 4.5%; top: 14.2%; z-index: 3; font-size: 3.4cqw; font-weight: 900; letter-spacing: 0.14em; padding: 0.6cqw 2cqw; border-radius: 3px; background: rgba(0,0,0,0.55); color: #fff; }
.face .fxgl { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; border-radius: inherit; }
.face .fxgl-foil { mix-blend-mode: color-dodge; }
.face .fxgl-gold { mix-blend-mode: screen; }
.face .fxgl-glitch { mix-blend-mode: screen; }
.face .fxgl-zeroDay { mix-blend-mode: screen; }
/* Full Art and the illustrations: the art fills the card, the text sits on it. */
.face.full .art { left: 0; right: 0; top: 0; height: 100%; border-radius: 0; }
.face.full .type, .face.full .text { background: rgba(5,8,18,0.62); backdrop-filter: blur(2px); }
.face.full .head { background: linear-gradient(180deg, rgba(0,0,0,0.55), transparent); border-radius: 4px; padding: 0 1.6cqw; }
/* Gold: the whole frame is gold; its text reads dark-on-gold where it sits on the frame. */
.face.goldframe { background: linear-gradient(115deg, var(--gold1), var(--gold2) 22%, var(--gold3) 40%, var(--gold4) 50%, var(--gold3) 60%, var(--gold2) 78%, var(--gold1)); background-size: 250% 100%; animation: sheen 4s linear infinite; box-shadow: 0 14px 40px rgba(0,0,0,0.55), 0 0 30px rgba(246,215,122,0.45), inset 0 0 0 2px rgba(255,241,184,0.7); }
.face.goldframe .art { filter: sepia(0.55) saturate(1.5) hue-rotate(-12deg) brightness(1.08); }
.face.goldframe .name { color: #2b1a00; text-shadow: 0 1px 0 rgba(255,255,255,0.4); }
.face.goldframe .foot, .face.goldframe .setno { color: #2b1a00; font-weight: 800; text-shadow: 0 1px 0 rgba(255,241,184,0.6); }
.face.goldframe .text, .face.goldframe .type { background: rgba(40,24,0,0.55); color: #fff3cf; }
.face.goldframe .rar { color: #fff3cf; }
/* Glitch: the card's own art and frame, palette rotated to a corrupted one. */
.face.corrupt .art { filter: hue-rotate(150deg) saturate(1.8) contrast(1.35); }
.face.corrupt { box-shadow: 0 14px 40px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.07), inset 0 0 0 4px #ff2bd6; }
.face.corrupt .name { text-shadow: 1.2cqw 0 rgba(255,0,90,0.7), -1.2cqw 0 rgba(0,240,255,0.7); }
.ghost { position: absolute; inset: 0; pointer-events: none; z-index: 6; mix-blend-mode: screen; opacity: 0.9; }
.ghost.r { filter: url(#only-r); } .ghost.c { filter: url(#only-gb); }
.ghost > .face { box-shadow: none; }
/* Prototype: the serial on a gold-foil plate, PROTOTYPE · S0 in gold foil. */
.face .plate { position: absolute; left: 5%; bottom: 11.5%; z-index: 4; padding: 1cqw 3cqw; border-radius: 4px; font-weight: 900; font-size: 5.4cqw; letter-spacing: 0.06em; color: #3a2604;
  background: linear-gradient(110deg, var(--gold1), var(--gold2) 22%, var(--gold3) 40%, var(--gold4) 50%, var(--gold3) 60%, var(--gold2) 78%, var(--gold1)); background-size: 250% 100%; animation: sheen 3.2s linear infinite;
  box-shadow: 0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.6); text-shadow: 0 1px 0 rgba(255,255,255,0.45); }
.face .foiltext { background: linear-gradient(110deg, var(--gold1), var(--gold2) 22%, var(--gold3) 40%, var(--gold4) 50%, var(--gold3) 60%, var(--gold2) 78%, var(--gold1)); background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: sheen 3.2s linear infinite; font-weight: 900; }
.face.proto .text { bottom: 21%; }
.face .plate.pending { opacity: 0; transform: scale(2.4) rotate(-8deg); }
.face .plate.stamp { animation: stamp 0.32s cubic-bezier(.5,0,.8,1.4) both; }
@keyframes stamp { from { opacity: 0; transform: scale(2.4) rotate(-8deg); } }
/* Zero-Day: the card moves, and reaches past its frame. */
.cslot.reach::before { content: ""; position: absolute; inset: -9%; border-radius: 16px; pointer-events: none; z-index: -1;
  background: conic-gradient(from var(--zda, 0deg), rgba(255,30,60,0), rgba(255,30,60,0.75), rgba(60,255,140,0.6), rgba(255,30,60,0)); filter: blur(14px); animation: zdspin 3s linear infinite; }
@property --zda { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
@keyframes zdspin { to { --zda: 360deg; } }
.face.zdface { box-shadow: 0 0 0 2px #ff1e3c, 0 0 34px rgba(255,30,60,0.7), inset 0 0 0 4px #35ff8a; }
.face.zdface .name { color: #8dffb8; font-family: ui-monospace, Menlo, Consolas, monospace; }
.face.zdface .art { animation: zdart 4s steps(40) infinite; }
@keyframes zdart { 50% { filter: hue-rotate(40deg) brightness(1.2); } }
/* The CSS stand-ins when a shader can't run. */
.face.fx-css-foil::after, .face.fx-css-gold::after, .face.fx-css-glitch::after, .face.fx-css-zeroDay::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 5; border-radius: inherit; }
.face.fx-css-foil::after { background: linear-gradient(115deg, transparent 20%, rgba(255,120,200,0.35) 35%, rgba(120,220,255,0.35) 45%, rgba(255,255,160,0.35) 55%, transparent 70%); background-size: 250% 100%; animation: sheen 3s linear infinite; mix-blend-mode: color-dodge; }
.face.fx-css-gold::after { background: linear-gradient(115deg, transparent 30%, rgba(255,240,190,0.55) 50%, transparent 70%); background-size: 250% 100%; animation: sheen 2.6s linear infinite; mix-blend-mode: screen; }
.face.fx-css-glitch::after { background: repeating-linear-gradient(0deg, rgba(0,255,220,0.12) 0 1px, transparent 1px 3px); }
.face.fx-css-zeroDay::after { background: repeating-linear-gradient(90deg, rgba(60,255,140,0.18) 0 2px, transparent 2px 9px); animation: zdart 2s steps(10) infinite; }

/* The secret number callout. */
.callout { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); padding: 6px 14px; border-radius: 10px; background: rgba(10,6,24,0.72); z-index: 8; text-align: center; pointer-events: none; animation: callin 0.6s cubic-bezier(.2,1.4,.4,1) both; }
.callout b { display: block; font-size: 11px; letter-spacing: 0.32em; color: #ffd6f6; }
.callout span { display: block; font-weight: 900; font-size: 34px; letter-spacing: 0.04em; font-variant-numeric: tabular-nums; background: linear-gradient(180deg, #fff, #ffb3ec 60%, #b07cff); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 12px rgba(255,120,220,0.7)); }
.callout.out { animation: callout 0.5s ease-in forwards; }
@keyframes callin { from { opacity: 0; transform: translateX(-50%) scale(0.4); } }
@keyframes callout { to { opacity: 0; transform: translateX(-50%) translateY(30px) scale(0.6); } }
.wash { position: absolute; inset: 0; pointer-events: none; z-index: 4; background: radial-gradient(circle at 50% 50%, var(--c, #fff) 0%, transparent 60%); animation: wash 0.9s ease-out forwards; }
@keyframes wash { from { opacity: 0.85; } to { opacity: 0; transform: scale(1.4); } }
.shake { animation: shake 0.42s cubic-bezier(.36,.07,.19,.97); }
@keyframes shake { 20%, 60% { transform: translate(-6px, 3px); } 40%, 80% { transform: translate(6px, -3px); } }

/* ---------- the Zero-Day takeover ---------- */
.zd { position: fixed; inset: 0; z-index: 50; background: #000; opacity: 0; transition: opacity 0.45s; }
.zd.on { opacity: 1; }
.zd.fade { opacity: 0; transition: opacity 0.7s; pointer-events: none; }
.zd .fxgl { position: absolute; inset: 0; width: 100%; height: 100%; }
.zd-term { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(560px, calc(100vw - 32px)); font: 600 15px/1.5 ui-monospace, Menlo, Consolas, monospace; color: #35ff8a; text-shadow: 0 0 8px rgba(53,255,138,0.8); z-index: 2; white-space: pre-wrap; }
.zd-term .big { font-size: clamp(22px, 7vw, 38px); font-weight: 900; color: #ff2b4a; text-shadow: 0 0 16px rgba(255,43,74,0.9), 2px 0 #35ff8a; display: block; margin-bottom: 10px; letter-spacing: 0.06em; }
.zd-term .cur { display: inline-block; width: 0.6em; background: #35ff8a; animation: blink 0.8s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.zd.breach .zd-term { animation: shake 0.42s 3; }

/* ---------- the summary ---------- */
.summary { width: min(980px, calc(100vw - 32px)); max-height: calc(100% - 20px); overflow-y: auto; padding: 14px 0 70px; text-align: center; touch-action: pan-y; }
.summary h2 { margin: 0 0 4px; font-size: 18px; letter-spacing: 0.06em; }
.summary .sub { color: var(--dim); margin: 0 0 14px; font-size: 13px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(150px, 42vw), 1fr)); gap: 14px; justify-items: center; }
.tile { position: relative; width: 100%; max-width: 180px; animation: rise 0.5s cubic-bezier(.2,.9,.3,1) both; animation-delay: calc(var(--i) * 70ms); }
.tile .mini { position: relative; width: 100%; aspect-ratio: 5 / 7; --cw: 100%; }
.tile .mini .face { border-radius: 8px; }
.tile .new { position: absolute; top: -7px; right: -7px; z-index: 9; background: #ff3d7f; color: #fff; font-weight: 900; font-size: 10px; letter-spacing: 0.1em; padding: 2px 6px; border-radius: 4px; box-shadow: 0 0 10px rgba(255,61,127,0.7); }
.tile .cap { margin-top: 5px; font-size: 11px; color: var(--dim); line-height: 1.3; }
.tile .fin { display: inline-block; font-weight: 800; letter-spacing: 0.08em; font-size: 10px; padding: 1px 6px; border-radius: 3px; background: #1a2342; color: #cfe0ff; margin-bottom: 2px; }
.tile .fin.hit { background: linear-gradient(110deg, #7a5cff, #ff5cc8); color: #fff; }
.points { margin: 16px 0 6px; font-size: 14px; }
.points b { color: var(--gold2); }
.btns { display: flex; gap: 10px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
.btns button { border: 1px solid #6a8cff; background: #17204a; border-radius: 8px; padding: 9px 18px; font-weight: 700; }
.btns button.pri { background: linear-gradient(135deg, #3d7bff, #7a5cff); border-color: transparent; }
.shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 14px; width: min(760px, calc(100vw - 32px)); }
.shelf button { border: 1px solid var(--line); background: rgba(13,19,36,0.7); border-radius: 10px; padding: 10px 6px; font-size: 12px; color: var(--ink); }
.shelf .mp { width: 54px; height: 86px; margin: 0 auto 6px; border-radius: 5px; background: linear-gradient(135deg, #1b2a6b, #3a1f7a 40%, #11163a 60%, #0f2a5e); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15); }
@media (prefers-reduced-motion: reduce) {
  .pack, .stage::before, .back, .cslot.reach::before, .face.zdface .art { animation: none !important; }
}
@media (max-width: 520px) {
  .brand span { display: none; }
  .banner { font-size: 16px; }
}
`;

/** The page's pure helpers, evaluated in Node by the tests (the same
 * source the page runs). */
export const PACK_PAGE_PURE_SOURCE = String.raw`
  // How far a drag across the pack's top has torn it, 0-1: the horizontal
  // distance over 70% of the pack's width. Dragging back doesn't un-tear.
  function packTearProgress(prev, x0, x, width) {
    var p = (x - x0) / Math.max(1, width * 0.7);
    return Math.max(prev, Math.min(1, Math.max(0, p)));
  }
  // What a release on the top card means: a tap (barely moved), a swipe
  // (moved far enough sideways) or neither (let go mid-drag: snap back).
  function packGesture(dx, dy, ms) {
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10 && ms < 600) return 'tap';
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'swipeLeft' : 'swipeRight';
    return 'none';
  }
  // A finish's sound tier: small hits lift, big ones climb.
  function packRiseTier(kind) {
    return kind === 'gold' || kind === 'secret' || kind === 'zeroDay' || kind === 'prototype' ? 'spectacle' : 'normal';
  }
  // The label a finish gets on the summary and in the hint.
  function packFinishLabel(finish) {
    return { standard: '', foil: 'FOIL', fullArt: 'FULL ART', altArt: 'ALT ART', glitch: 'GLITCH', secret: 'SECRET', gold: 'GOLD', prototype: 'PROTOTYPE', tournament: 'PRIZE', zeroDay: 'ZERO-DAY' }[finish] || '';
  }
  // A small seeded generator for the placeholder art (mulberry32).
  function packRng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  var PACK_FACTION_HUE = { Cortex: 196, Aegis: 24, Swarm: 100, Null: 285, Neutral: 45 };
  // The placeholder art: a generative frame from the card's own attributes
  // (DESIGN.md: "driven by card attributes ... explicitly NOT an emoji or
  // glyph on a flat background"). Faction sets the palette, the card id's
  // seed the circuit traces and offsets, the type the central motif. 'alt'
  // is the Alt Art composition (the motif large and off centre, the palette
  // turned); 'illustration' a painted scene (layered ridges under a
  // sun disc) for the secret illustrations, until the art pass paints them.
  function packArtSvg(face, variant) {
    var rnd = packRng(face.visualSeed * 7919 + face.visualPattern * 104729 + (variant === 'alt' ? 77 : variant === 'illustration' ? 991 : 0));
    var hue = (PACK_FACTION_HUE[face.faction] || 200) + (face.visualSeed % 40) - 20 + (variant === 'alt' ? 140 : 0);
    var light = face.faction === 'Neutral' ? 62 : 52;
    function hsl(h, s, l, a) { return 'hsla(' + Math.round(((h % 360) + 360) % 360) + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')'; }
    var W = 100, H = 76, out = [];
    out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">');
    out.push('<defs><radialGradient id="g" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="' + hsl(hue, 70, light + 8) + '"/><stop offset="0.55" stop-color="' + hsl(hue + 25, 65, 22) + '"/><stop offset="1" stop-color="' + hsl(hue + 40, 60, 8) + '"/></radialGradient></defs>');
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#g)"/>');
    if (variant === 'illustration') {
      out.push('<circle cx="' + (30 + rnd() * 40).toFixed(1) + '" cy="' + (18 + rnd() * 10).toFixed(1) + '" r="' + (10 + rnd() * 6).toFixed(1) + '" fill="' + hsl(hue + 180, 90, 75, 0.85) + '"/>');
      for (var layer = 0; layer < 5; layer++) {
        var y0 = 34 + layer * 8, amp = 6 + rnd() * 6, fr = 0.05 + rnd() * 0.07, ph = rnd() * 6;
        var d = 'M0 ' + H + ' L0 ' + y0.toFixed(1);
        for (var x = 0; x <= W; x += 4) d += ' L' + x + ' ' + (y0 + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 2.7 + ph) * amp * 0.35).toFixed(1);
        d += ' L' + W + ' ' + H + ' Z';
        out.push('<path d="' + d + '" fill="' + hsl(hue + layer * 18, 55, 40 - layer * 6, 0.92) + '"/>');
      }
      out.push('</svg>');
      return out.join('');
    }
    // Circuit traces: right-angled runs with a node at each end.
    var traces = 9 + Math.floor(rnd() * 6);
    for (var i = 0; i < traces; i++) {
      var tx = rnd() * W, ty = rnd() * H, pts = [tx.toFixed(1) + ',' + ty.toFixed(1)];
      for (var k = 0; k < 3; k++) { if (k % 2 === 0) tx += (rnd() - 0.5) * 50; else ty += (rnd() - 0.5) * 40; pts.push(tx.toFixed(1) + ',' + ty.toFixed(1)); }
      out.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + hsl(hue + 10, 90, 70, 0.35) + '" stroke-width="0.7"/>');
      out.push('<circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="1.1" fill="' + hsl(hue, 100, 80, 0.7) + '"/>');
    }
    // The pattern axis (cardVisual.ts visualPatternFor): a background texture.
    var pat = face.visualPattern % 4;
    if (pat === 0) for (var s = -H; s < W; s += 7) out.push('<line x1="' + s + '" y1="' + H + '" x2="' + (s + H) + '" y2="0" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>');
    if (pat === 1) for (var s2 = 0; s2 < W + H; s2 += 6) out.push('<line x1="' + s2 + '" y1="0" x2="' + (s2 - H) + '" y2="' + H + '" stroke="rgba(0,0,0,0.16)" stroke-width="1.6"/>');
    if (pat === 2) for (var gx = 6; gx < W; gx += 12) for (var gy = 6; gy < H; gy += 12) out.push('<circle cx="' + gx + '" cy="' + gy + '" r="1.3" fill="rgba(255,255,255,0.18)"/>');
    if (pat === 3) for (var g2 = 0; g2 < W; g2 += 10) out.push('<line x1="' + g2 + '" y1="0" x2="' + g2 + '" y2="' + H + '" stroke="rgba(0,0,0,0.14)"/><line x1="0" y1="' + g2 + '" x2="' + W + '" y2="' + g2 + '" stroke="rgba(0,0,0,0.14)"/>');
    // The motif, by card type.
    var cx = variant === 'alt' ? 62 + rnd() * 10 : 50, cy = variant === 'alt' ? 44 : 38, R = variant === 'alt' ? 30 : 18;
    var stroke = hsl(hue, 100, 82), fill = hsl(hue, 80, 60, 0.35);
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 1.5) + '" fill="' + hsl(hue, 100, 70, 0.12) + '"/>');
    if (face.type === 'Unit') {
      var hex = [];
      for (var hI = 0; hI < 6; hI++) { var ang = Math.PI / 3 * hI + Math.PI / 6; hex.push((cx + Math.cos(ang) * R).toFixed(1) + ',' + (cy + Math.sin(ang) * R).toFixed(1)); }
      out.push('<polygon points="' + hex.join(' ') + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4"/>');
      out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 0.38).toFixed(1) + '" fill="' + stroke + '"/>');
    } else if (face.type === 'Command') {
      var rays = 10, star = [];
      for (var rI = 0; rI < rays * 2; rI++) { var ra = Math.PI / rays * rI, rr = rI % 2 ? R * 0.42 : R * 1.05; star.push((cx + Math.cos(ra) * rr).toFixed(1) + ',' + (cy + Math.sin(ra) * rr).toFixed(1)); }
      out.push('<polygon points="' + star.join(' ') + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"/>');
    } else if (face.type === 'Directive') {
      for (var q = 0; q < 3; q++) { var e = R * (1 - q * 0.3); out.push('<rect x="' + (cx - e).toFixed(1) + '" y="' + (cy - e).toFixed(1) + '" width="' + (2 * e).toFixed(1) + '" height="' + (2 * e).toFixed(1) + '" fill="' + (q === 2 ? stroke : 'none') + '" stroke="' + stroke + '" stroke-width="1.2" transform="rotate(' + (q * 15) + ' ' + cx + ' ' + cy + ')"/>'); }
    } else if (face.type === 'Tool') {
      var teeth = [];
      for (var tI = 0; tI < 24; tI++) { var ta = Math.PI / 12 * tI, tr = tI % 2 ? R * 0.8 : R; teeth.push((cx + Math.cos(ta) * tr).toFixed(1) + ',' + (cy + Math.sin(ta) * tr).toFixed(1)); }
      out.push('<polygon points="' + teeth.join(' ') + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 0.35).toFixed(1) + '" fill="#000" stroke="' + stroke + '"/>');
    } else {
      // A reserved entry: a redacted block over a breach glyph.
      out.push('<text x="50" y="44" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="900" font-size="15" fill="#ff2b4a">0-DAY</text>');
      for (var b = 0; b < 4; b++) out.push('<rect x="' + (14 + rnd() * 20).toFixed(1) + '" y="' + (50 + b * 5) + '" width="' + (30 + rnd() * 40).toFixed(1) + '" height="3" fill="#000"/>');
    }
    out.push('</svg>');
    return out.join('');
  }
`;

export const PACK_PAGE_RUNTIME_SOURCE = String.raw`
(function () {
  var DATA = JSON.parse(document.getElementById('pack-data').textContent);
  var TM = JSON.parse(document.getElementById('pack-timings').textContent);
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stage = document.getElementById('stage'), scene = document.getElementById('scene'), hint = document.getElementById('hint');
  var counter = document.getElementById('counter'), skipBtn = document.getElementById('skip'), dim = document.getElementById('dim');
  var zd = document.getElementById('zd'), zdTerm = document.getElementById('zd-term'), announce = document.getElementById('announce');
  var sparksCanvas = document.getElementById('sparks');
  var t0 = performance.now();
  // The page's state, and a log of every beat, for the headless check.
  // tilt: the card that follows the light (only once it has landed, so a
  // flip is never pulled off course).
  var S = { pack: 0, phase: 'shelf', i: 0, busyUntil: 0, revealed: {}, tilt: -1, layers: [], log: [], timers: [] };
  window.__pack = S;
  function log(kind, o) { var e = { kind: kind, t: Math.round(performance.now() - t0), pack: S.pack }; for (var k in o) e[k] = o[k]; S.log.push(e); }
  function later(fn, ms) { var id = setTimeout(fn, REDUCE ? Math.min(ms, 120) : ms); S.timers.push(id); return id; }
  function clearTimers() { S.timers.forEach(clearTimeout); S.timers = []; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function stopLayers() { S.layers.forEach(function (l) { l.stop(); }); S.layers = []; }
  function sfx(kind, faction, tier) { if (window.SND) SND.play(kind, faction || 'Neutral', tier || 'normal', null); }

  // ---------- sound ----------
  SND.mount(document.getElementById('btn-sound'), document.getElementById('sound-vol'));

  // ---------- the picker and footer ----------
  var picker = document.getElementById('picker');
  DATA.packs.forEach(function (p, i) {
    var b = document.createElement('button');
    b.textContent = (i + 1) + '. ' + p.label;
    b.addEventListener('click', function () { openPack(i); });
    picker.appendChild(b);
  });
  function markPicker() { Array.prototype.forEach.call(picker.children, function (b, i) { b.classList.toggle('on', i === S.pack && S.phase !== 'shelf'); }); }
  function footer() {
    var r = DATA.packs[S.pack].reveal;
    document.getElementById('foot').innerHTML = 'A real opening from the economy store: seed <b>' + r.seed + '</b>, odds <b>' + esc(r.oddsVersion) + '</b>. The reveal only shows what was rolled; nothing on this page rolls anything. Placeholder card art until the art pass.';
  }

  // ---------- card faces ----------
  var RAR = { Common: '● Common', Uncommon: '◆ Uncommon', Rare: '★ Rare', Mythic: '✦ Mythic' };
  function faceHtml(c, opts) {
    opts = opts || {};
    var f = c.face, full = c.reveal === 'fullArt' || c.reveal === 'altArt' || c.reveal === 'secret';
    var variant = c.reveal === 'altArt' ? 'alt' : c.reveal === 'secret' ? 'illustration' : '';
    var cls = 'face faction-' + f.faction + (opts.settled && full ? ' full' : '') + (opts.settled && c.reveal === 'gold' ? ' goldframe' : '') + (opts.settled && c.reveal === 'glitch' ? ' corrupt' : '') + (opts.settled && c.reveal === 'zeroDay' ? ' zdface' : '') + (c.prototype ? ' proto' : '');
    var type = f.type === 'Reserved' ? 'Zero-Day · Reserved' : f.type + ' · ' + f.faction;
    var number = c.prototype ? '<span class="foiltext">PROTOTYPE · ' + esc(DATA.packs[S.pack] ? DATA.packs[S.pack].reveal.setCode : 'S0') + '</span>' : esc(c.collectorNumber) + (c.finish === 'glitch' ? ' ░' : '');
    var mark = c.reveal === 'altArt' ? 'ALT ART' : c.reveal === 'glitch' ? 'GL1TCH' : c.reveal === 'secret' ? 'SECRET' : c.reveal === 'zeroDay' ? 'ZERO-DAY' : '';
    return '<div class="' + cls + '">' +
      '<div class="art">' + packArtSvg(f, variant) + '</div>' +
      '<div class="head"><span class="name">' + esc(f.name) + '</span>' + (f.cost === null ? '' : '<span class="cost">' + f.cost + '</span>') + '</div>' +
      (mark ? '<span class="mark">' + mark + '</span>' : '') +
      '<div class="type"><span>' + esc(type) + '</span><span class="rar">' + RAR[f.rarity] + '</span></div>' +
      '<div class="text">' + f.text.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + (f.flavor ? '<p class="flav">' + esc(f.flavor) + '</p>' : '') + '</div>' +
      (f.attack === null ? '' : '<div class="stats"><span class="atk">' + f.attack + '</span><span class="hp">' + f.health + '</span></div>') +
      (c.prototype ? '<span class="plate' + (opts.settled ? '' : ' pending') + '">' + c.prototype.serial + '/' + c.prototype.runSize + '</span>' : '') +
      '<div class="foot"><span class="setno"><svg><use href="#setsym"/></svg>' + number + '</span><span>Season 0</span></div>' +
      '</div>';
  }
  function backHtml() { return '<div class="back"><div class="bl">AI·TCG</div><svg class="bs"><use href="#setsym"/></svg></div>'; }

  // ---------- the shelf ----------
  function shelf() {
    clearTimers(); stopLayers(); S.phase = 'shelf'; markPicker();
    skipBtn.hidden = true; counter.textContent = ''; dim.style.opacity = 0;
    hint.innerHTML = 'Pick a pack to open. Each one is a real opening.';
    scene.innerHTML = '<div class="shelf">' + DATA.packs.map(function (p, i) { return '<button data-i="' + i + '"><div class="mp"></div>' + (i + 1) + '. ' + esc(p.label) + '</button>'; }).join('') + '</div>';
    scene.querySelectorAll('.shelf button').forEach(function (b) { b.addEventListener('click', function () { openPack(Number(b.getAttribute('data-i'))); }); });
    log('shelf', {});
  }

  // ---------- the sealed pack and the tear ----------
  function openPack(i) {
    clearTimers(); stopLayers(); zd.hidden = true; zd.className = 'zd';
    S.pack = i; S.phase = 'pack'; S.i = 0; S.revealed = {}; S.busyUntil = 0;
    markPicker(); footer();
    var r = DATA.packs[i].reveal;
    skipBtn.hidden = true; counter.textContent = ''; dim.style.opacity = 0;
    var wrap = '<div class="wrap"><div class="crimp t"></div><div class="logo">AI·TCG</div><div class="emb"><svg><use href="#setsym"/></svg></div><div class="set">SEASON ZERO</div><div class="meta">' + r.cards.length + ' CARDS · ' + esc(r.setCode) + '</div><div class="crimp b"></div></div>';
    scene.innerHTML = '<div class="pack" id="pack" tabindex="0" role="button" aria-label="Sealed Season Zero pack. Drag across the top to tear it open, or tap."><div class="tilt"><div class="half top">' + wrap + '</div><div class="half body">' + wrap + '</div><div class="cutline"><i id="cutp"></i></div><div class="grip"></div><div class="finger"></div></div></div>';
    hint.innerHTML = 'Drag across the top of the pack to tear it open<br>or tap it';
    var pack = document.getElementById('pack'), tilt = pack.querySelector('.tilt'), cutp = document.getElementById('cutp');
    var shimmer = FXGL.layer(tilt, 'pack', { amt: 1, seed: i + 1 });
    if (shimmer) S.layers.push(shimmer); else pack.classList.add('fx-css-pack');
    var drag = null, progress = 0;
    pack.addEventListener('pointermove', function (e) {
      var rc = pack.getBoundingClientRect();
      var x = (e.clientX - rc.left) / rc.width, y = (e.clientY - rc.top) / rc.height;
      if (!drag) tilt.style.transform = 'rotateY(' + ((x - 0.5) * 16).toFixed(1) + 'deg) rotateX(' + ((0.5 - y) * 12).toFixed(1) + 'deg)';
      if (shimmer) shimmer.ptr(x, y);
      if (drag && drag.top) {
        progress = packTearProgress(progress, drag.x0, e.clientX, rc.width);
        cutp.style.width = (progress * 100) + '%';
        if (progress >= 1) { drag = null; tear('drag'); }
      }
    });
    pack.addEventListener('pointerdown', function (e) {
      if (S.phase !== 'pack') return;
      pack.setPointerCapture && pack.setPointerCapture(e.pointerId);
      // A drag tears only along the top (the strip above the cut line and a
      // little below it); a press anywhere else can still be a tap.
      var prc = pack.getBoundingClientRect();
      drag = { x0: e.clientX, y0: e.clientY, at: performance.now(), top: (e.clientY - prc.top) / prc.height < 0.32 };
      pack.classList.add('held');
      var f = pack.querySelector('.finger'); if (f) f.remove();
      log('tearStart', {});
    });
    pack.addEventListener('pointerup', function (e) {
      if (!drag) return;
      var g = packGesture(e.clientX - drag.x0, e.clientY - drag.y0, performance.now() - drag.at);
      drag = null;
      if (S.phase !== 'pack') return;
      if (g === 'tap') autoTear(cutp, 'tap');
      else if (progress < 1) { pack.classList.remove('held'); }
    });
    pack.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); autoTear(cutp, 'key'); } });
    pack.focus({ preventScroll: true, focusVisible: false });
    log('packShown', { label: DATA.packs[i].label });
  }
  function autoTear(cutp, via) {
    if (S.phase !== 'pack') return;
    S.phase = 'tearing';
    cutp.style.transition = 'width ' + TM.pack.autoTear + 'ms ease-in';
    cutp.style.width = '100%';
    later(function () { S.phase = 'pack'; tear(via); }, TM.pack.autoTear);
  }
  function tear(via) {
    if (S.phase !== 'pack') return;
    S.phase = 'torn';
    var r = DATA.packs[S.pack].reveal, pack = document.getElementById('pack');
    pack.classList.add('torn');
    stopLayers();
    sfx('tear');
    hint.innerHTML = '';
    log('tear', { via: via, sparks: r.sparks, jackpot: r.jackpot });
    // The honest tell: sparks iff the pack holds a hit.
    if (r.sparks) {
      var rc = pack.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      sparks(rc.left - sr.left, rc.top - sr.top + rc.height * 0.16, rc.width, r.jackpot ? 140 : 90);
      sfx('sparkle', 'Neutral', 'spectacle');
      log('sparks', {});
    }
    var wait = TM.pack.tear;
    if (r.jackpot) {
      later(function () {
        var b = document.createElement('div'); b.className = 'banner'; b.innerHTML = 'JACKPOT PACK<small>every card Foil or better</small>';
        stage.appendChild(b); sfx('rise', 'Neutral', 'spectacle'); log('jackpot', {});
        later(function () { b.remove(); }, TM.pack.jackpotBanner);
      }, TM.pack.tear * 0.5);
      wait += TM.pack.jackpotBanner;
    }
    later(dealStack, wait);
  }

  // ---------- sparks ----------
  var sparkRun = null;
  function sparks(x, y, w, n) {
    var ctx = sparksCanvas.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    sparksCanvas.width = sparksCanvas.clientWidth * dpr; sparksCanvas.height = sparksCanvas.clientHeight * dpr;
    var ps = [], cols = ['#ffffff', '#fff1b8', '#f6d77a', '#9fe0ff', '#ffb3ec'];
    for (var i = 0; i < n; i++) ps.push({ x: x + Math.random() * w, y: y, vx: (Math.random() - 0.5) * 7, vy: -2 - Math.random() * 7, life: 0.6 + Math.random() * 0.7, c: cols[i % cols.length], s: 1 + Math.random() * 2.2 });
    var start = performance.now(), last = start;
    if (sparkRun) cancelAnimationFrame(sparkRun);
    function step(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, sparksCanvas.width, sparksCanvas.height);
      ctx.globalCompositeOperation = 'lighter';
      var alive = 0;
      ps.forEach(function (p) {
        p.life -= dt; if (p.life <= 0) return; alive++;
        p.vy += 14 * dt; p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt;
        ctx.globalAlpha = Math.min(1, p.life * 1.6);
        ctx.strokeStyle = p.c; ctx.lineWidth = p.s; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6); ctx.stroke();
      });
      if (alive && now - start < TM.pack.sparks + 800) sparkRun = requestAnimationFrame(step);
      else { ctx.clearRect(0, 0, sparksCanvas.width, sparksCanvas.height); sparkRun = null; }
    }
    sparkRun = requestAnimationFrame(step);
  }

  // ---------- the stack ----------
  function dealStack() {
    var r = DATA.packs[S.pack].reveal;
    S.phase = 'cards'; S.i = 0;
    scene.innerHTML = '<div class="stack" id="stack"></div>';
    var stack = document.getElementById('stack');
    // Last card at the bottom, first on top.
    for (var k = r.cards.length - 1; k >= 0; k--) {
      var c = r.cards[k];
      var el = document.createElement('div');
      el.className = 'cslot rise' + (c.faceDown ? ' down glow' : '');
      el.setAttribute('data-k', k);
      el.style.animationDelay = (k * 40) + 'ms';
      el.innerHTML = '<div class="flipper"><div class="front">' + faceHtml(c, { settled: !c.faceDown }) + '</div>' + backHtml() + '</div>';
      stack.appendChild(el);
    }
    layoutStack();
    skipBtn.hidden = false;
    S.busyUntil = performance.now() + TM.pack.rise;
    later(function () { stack.querySelectorAll('.cslot').forEach(function (e) { e.classList.remove('rise'); }); showTop(); }, TM.pack.rise);
    bindStack(stack);
  }
  function slotEl(k) { return document.querySelector('.cslot[data-k="' + k + '"]'); }
  function layoutStack() {
    var r = DATA.packs[S.pack].reveal;
    for (var k = S.i; k < r.cards.length; k++) {
      var el = slotEl(k); if (!el) continue;
      var d = Math.min(4, k - S.i);
      el.style.zIndex = String(100 - k);
      el.style.transform = 'translateY(' + (d * 5) + 'px) scale(' + (1 - d * 0.025) + ')';
    }
  }
  function showTop() {
    var r = DATA.packs[S.pack].reveal, c = r.cards[S.i];
    counter.textContent = (S.i + 1) + ' / ' + r.cards.length;
    var slot = c.slot === 'shine' ? '<span class="slot">SHINE SLOT</span><br>' : c.slot === 'bonus' ? '<span class="slot bonus">BONUS 6TH CARD</span><br>' : '';
    if (c.faceDown && !S.revealed[S.i]) hint.innerHTML = slot + 'Something special… tap to reveal';
    else hint.innerHTML = slot + (S.i === r.cards.length - 1 ? 'Tap for the summary' : 'Swipe or tap for the next card');
    if (!c.faceDown) { announce.textContent = c.face.name; settleFx(S.i, c); S.tilt = S.i; }
    log('cardShown', { idx: S.i, faceDown: c.faceDown, finish: c.finish, slot: c.slot, name: c.face.name });
    sfx('flip', c.face.faction);
  }
  function bindStack(stack) {
    var drag = null;
    stack.addEventListener('pointerdown', function (e) {
      if (S.phase !== 'cards') return;
      var el = slotEl(S.i); if (!el) return;
      stack.setPointerCapture && stack.setPointerCapture(e.pointerId);
      drag = { x0: e.clientX, y0: e.clientY, at: performance.now(), el: el };
    });
    stack.addEventListener('pointermove', function (e) {
      var el = slotEl(S.i); if (!el) return;
      var rc = el.getBoundingClientRect();
      var x = (e.clientX - rc.left) / rc.width, y = (e.clientY - rc.top) / rc.height;
      setLight(x, y);
      var top = DATA.packs[S.pack].reveal.cards[S.i];
      if (drag && (!top.faceDown || S.revealed[S.i])) {
        var dx = e.clientX - drag.x0;
        if (Math.abs(dx) > 10 && canLeave()) { el.classList.add('dragging'); el.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx * 0.05) + 'deg)'; }
      }
    });
    stack.addEventListener('pointerup', function (e) {
      if (!drag) return;
      var d = drag; drag = null;
      d.el.classList.remove('dragging');
      var g = packGesture(e.clientX - d.x0, e.clientY - d.y0, performance.now() - d.at);
      act(g === 'swipeRight' ? 'r' : g === 'swipeLeft' ? 'l' : g === 'tap' ? 'tap' : 'none');
    });
    stack.addEventListener('pointerleave', function () { setLight(0.5, 0.4); });
  }
  function canLeave() { return performance.now() >= S.busyUntil; }
  // A tap or a swipe on the top card: reveal it if it waits face down,
  // otherwise send it off (once its reveal has had its moment).
  function act(how) {
    if (S.phase !== 'cards') return;
    var r = DATA.packs[S.pack].reveal, c = r.cards[S.i], el = slotEl(S.i);
    if (!el) return;
    if (c.faceDown && !S.revealed[S.i]) { if (how !== 'none' && canLeave()) reveal(S.i); else layoutStack(); return; }
    if (how === 'none' || !canLeave()) { layoutStack(); return; }
    leave(how === 'r' ? 'r' : 'l');
  }
  function leave(dir) {
    var r = DATA.packs[S.pack].reveal, el = slotEl(S.i);
    S.tilt = -1;
    el.classList.add(dir === 'r' ? 'gone-r' : 'gone-l');
    log('cardLeft', { idx: S.i, dir: dir });
    stopLayers();
    var gone = el; later(function () { gone.remove(); }, 400);
    S.i++;
    if (S.i >= r.cards.length) { later(summary, TM.pack.fly + 120); return; }
    S.busyUntil = performance.now() + TM.pack.fly;
    layoutStack();
    later(showTop, TM.pack.fly * 0.6);
  }
  document.addEventListener('keydown', function (e) {
    if (S.phase === 'cards' && (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); act('tap'); }
    if (S.phase === 'cards' && e.key === 'ArrowLeft') { e.preventDefault(); act('l'); }
  });
  skipBtn.addEventListener('click', function () { if (S.phase === 'cards') { log('skip', { at: S.i }); summary(); } });

  // ---------- the light: the pointer, or the device's tilt ----------
  var light = { x: 0.5, y: 0.4 };
  function setLight(x, y) {
    light.x = Math.max(0, Math.min(1, x)); light.y = Math.max(0, Math.min(1, y));
    S.layers.forEach(function (l) { l.ptr(light.x, light.y); });
    var el = slotEl(S.i);
    if (el && S.tilt === S.i && !el.classList.contains('dragging')) {
      var f = el.querySelector('.flipper');
      f.style.transform = 'rotateY(' + ((light.x - 0.5) * 14).toFixed(1) + 'deg) rotateX(' + ((0.5 - light.y) * 10).toFixed(1) + 'deg)';
    }
  }
  var tiltAsked = false;
  function askTilt() {
    if (tiltAsked) return; tiltAsked = true;
    var D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') D.requestPermission().catch(function () {});
  }
  document.addEventListener('pointerdown', askTilt, { once: true });
  window.addEventListener('deviceorientation', function (e) {
    if (e.gamma === null || e.beta === null) return;
    setLight(0.5 + Math.max(-30, Math.min(30, e.gamma)) / 60, 0.5 + Math.max(-30, Math.min(30, e.beta - 35)) / 60);
  });

  // ---------- the reveals ----------
  function addLayer(host, name, amt, seed) {
    var l = FXGL.layer(host, name, { amt: amt, seed: seed });
    if (l) { l.ptr(light.x, light.y); S.layers.push(l); return l; }
    host.classList.add('fx-css-' + name);
    return null;
  }
  function wash(color) { var w = document.createElement('div'); w.className = 'wash'; w.style.setProperty('--c', color); stage.appendChild(w); later(function () { w.remove(); }, 900); }
  function ramp(layer, from, to, ms) {
    if (!layer) return;
    var a = performance.now();
    (function tick() { var p = Math.min(1, (performance.now() - a) / ms); layer.set(from + (to - from) * p); if (p < 1) requestAnimationFrame(tick); })();
  }
  // The finish's lasting look on a card already face up (a plain card, or
  // a card after its reveal).
  function settleFx(k, c) {
    var face = slotEl(k) && slotEl(k).querySelector('.front .face');
    if (!face) return null;
    if (c.reveal === 'foil' || c.reveal === 'fullArt' || c.reveal === 'altArt' || c.reveal === 'secret') return addLayer(face, 'foil', c.reveal === 'foil' ? 1 : 0.55, k + 1);
    if (c.reveal === 'gold' || c.reveal === 'prototype') return addLayer(face, 'gold', c.reveal === 'gold' ? 1 : 0.5, k + 1);
    if (c.reveal === 'glitch') return addLayer(face, 'glitch', 0.18, k + 1);
    if (c.reveal === 'zeroDay') return addLayer(face, 'zeroDay', 0.75, k + 1);
    return null;
  }
  function reveal(k) {
    var r = DATA.packs[S.pack].reveal, c = r.cards[k], el = slotEl(k);
    S.revealed[k] = true;
    var t = TM.reveal[c.reveal];
    el.classList.remove('glow');
    if (c.reveal === 'zeroDay') { zeroDay(k); return; }
    var front = el.querySelector('.front');
    // The card turns over showing its plain face first; the finish arrives
    // as part of the reveal, not before it.
    front.innerHTML = faceHtml(c, { settled: false });
    var flipper = el.querySelector('.flipper');
    flipper.style.transition = 'transform ' + t.flip + 'ms ' + (c.reveal === 'secret' ? 'cubic-bezier(.45,0,.2,1)' : 'cubic-bezier(.3,.6,.3,1)');
    S.busyUntil = performance.now() + t.flip + t.hold;
    log('reveal', { idx: k, as: c.reveal, finish: c.finish });
    announce.textContent = c.face.name + (packFinishLabel(c.finish) ? ', ' + packFinishLabel(c.finish) : '');
    var face = front.querySelector('.face');
    if (c.reveal === 'glitch') glitchFlip(el, face, t.flip);
    if (c.reveal === 'secret') { dim.style.opacity = 0.55; el.style.transition = 'transform ' + t.flip + 'ms cubic-bezier(.45,0,.2,1)'; el.style.transform = 'translateY(-10px) scale(1.06)'; }
    sfx('flip', c.face.faction);
    requestAnimationFrame(function () { el.classList.remove('down'); });
    later(function () { landed(k, c, el, face, t); }, t.flip);
    hint.innerHTML = (c.slot === 'shine' ? '<span class="slot">SHINE SLOT</span><br>' : c.slot === 'bonus' ? '<span class="slot bonus">BONUS 6TH CARD</span><br>' : '') + packFinishLabel(c.finish);
  }
  function landed(k, c, el, face, t) {
    var tier = packRiseTier(c.reveal);
    if (c.reveal !== 'glitch') sfx('rise', c.face.faction, tier);
    if (c.reveal === 'foil') { ramp(addLayer(face, 'foil', 0, k + 1), 0, 1, 500); wash('#bfe3ff'); }
    if (c.reveal === 'fullArt' || c.reveal === 'altArt') { face.classList.add('full'); ramp(addLayer(face, 'foil', 0, k + 1), 0, 0.55, 900); wash(c.reveal === 'altArt' ? '#ffb3ec' : '#bfe3ff'); }
    if (c.reveal === 'gold') {
      face.classList.add('goldframe'); ramp(addLayer(face, 'gold', 0, k + 1), 0, 1, 600); wash('#f6d77a');
      var rc = el.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      sparks(rc.left - sr.left, rc.top - sr.top + rc.height * 0.1, rc.width, 110); sfx('sparkle', 'Neutral', 'spectacle');
    }
    if (c.reveal === 'secret') {
      face.classList.add('full'); ramp(addLayer(face, 'foil', 0, k + 1), 0, 0.55, 900); wash('#ffb3ec');
      var co = document.createElement('div'); co.className = 'callout'; co.innerHTML = '<b>SECRET ILLUSTRATION</b><span>' + esc(c.collectorNumber) + '</span>';
      // Above the card when there is room, otherwise over its art window.
      var crc = el.getBoundingClientRect(), stg = stage.getBoundingClientRect();
      stage.appendChild(co);
      var above = crc.top - stg.top - co.offsetHeight - 10;
      co.style.top = (above >= 6 ? above : crc.top - stg.top + crc.height * 0.24) + 'px';
      log('callout', { text: c.collectorNumber, above: above >= 6 });
      later(function () { co.classList.add('out'); dim.style.opacity = 0; el.style.transform = ''; later(function () { co.remove(); }, 500); }, t.hold);
    }
    if (c.reveal === 'prototype') {
      ramp(addLayer(face, 'gold', 0, k + 1), 0, 0.5, 600); wash('#f6d77a');
      later(function () {
        var plate = face.querySelector('.plate'); if (plate) { plate.classList.remove('pending'); plate.classList.add('stamp'); }
        el.classList.add('shake'); sfx('stamp', c.face.faction, 'spectacle'); log('stamp', { serial: c.prototype && c.prototype.serial });
      }, 220);
    }
    S.tilt = k;
    log('landed', { idx: k, as: c.reveal });
    hint.innerHTML += '<br>' + (k === DATA.packs[S.pack].reveal.cards.length - 1 ? 'Tap for the summary' : 'Swipe or tap for the next card');
  }
  // Glitch: the card corrupts as it flips (RGB split, jumping block tears,
  // scanlines), then settles with a faint glitch loop.
  function glitchFlip(el, face, ms) {
    var host = el.querySelector('.front');
    var r = document.createElement('div'), c = document.createElement('div');
    r.className = 'ghost r'; c.className = 'ghost c';
    r.innerHTML = c.innerHTML = face.outerHTML;
    host.appendChild(r); host.appendChild(c);
    var gl = addLayer(face, 'glitch', 1, 7);
    sfx('glitch', 'Null', 'spectacle');
    var start = performance.now(), flipper = el.querySelector('.flipper');
    flipper.style.transition = 'none';
    function band() { var a = Math.random() * 80, b = Math.min(100, a + 4 + Math.random() * 18); return 'inset(' + a.toFixed(0) + '% 0 ' + (100 - b).toFixed(0) + '% 0)'; }
    (function tick() {
      var p = (performance.now() - start) / ms;
      if (p >= 1) {
        r.remove(); c.remove(); face.classList.add('corrupt'); flipper.style.transform = '';
        if (gl) gl.set(0.18);
        glitchLoop(el, face, gl);
        return;
      }
      // A stepped, jumpy turn instead of a smooth one.
      var stepped = Math.floor(p * 9) / 9;
      flipper.style.transform = 'rotateY(' + (180 - 180 * stepped).toFixed(0) + 'deg) translateX(' + ((Math.random() - 0.5) * 10).toFixed(1) + 'px)';
      var off = (1 - p) * 9;
      r.style.transform = 'translateX(' + (off + Math.random() * 4).toFixed(1) + 'px)';
      c.style.transform = 'translateX(' + (-off - Math.random() * 4).toFixed(1) + 'px)';
      r.style.clipPath = band(); c.style.clipPath = band();
      if (p > 0.45 && !face.classList.contains('corrupt')) face.classList.add('corrupt');
      setTimeout(tick, 45);
    })();
  }
  function glitchLoop(el, face, gl) {
    var k = S.i, pack = S.pack;
    (function burst() {
      if (S.pack !== pack || S.i !== k || S.phase !== 'cards') return;
      if (gl) { gl.set(0.85); later(function () { gl.set(0.18); }, 160); }
      face.style.transform = 'translateX(' + ((Math.random() - 0.5) * 6).toFixed(1) + 'px)';
      later(function () { face.style.transform = ''; }, 90);
      later(burst, 2200 + Math.random() * 1200);
    })();
  }
  // Zero-Day: a full-screen takeover. The screen drops to black, a terminal
  // types "ZERO-DAY DETECTED", a short breach sequence plays, then the
  // animated card arrives.
  function zeroDay(k) {
    var r = DATA.packs[S.pack].reveal, c = r.cards[k], el = slotEl(k), Z = TM.zeroDay;
    S.busyUntil = Infinity;
    log('reveal', { idx: k, as: 'zeroDay', finish: c.finish });
    zd.hidden = false; zd.className = 'zd'; zdTerm.innerHTML = '';
    requestAnimationFrame(function () { zd.classList.add('on'); });
    sfx('breach', 'Null', 'spectacle');
    var bg = null;
    later(function () {
      bg = FXGL.layer(zd, 'zeroDay', { amt: 0.15, seed: 3 });
      if (bg) S.layers.push(bg);
      var text = 'ZERO-DAY DETECTED', n = 0;
      var big = document.createElement('span'); big.className = 'big'; zdTerm.appendChild(big);
      var cur = document.createElement('span'); cur.className = 'cur'; cur.innerHTML = '&nbsp;'; zdTerm.appendChild(cur);
      (function type() {
        if (n < text.length) { big.textContent = text.slice(0, ++n); sfx('type', 'Null', 'normal'); later(type, Z.typePerChar); return; }
        log('zeroDayTyped', { text: big.textContent });
        breach();
      })();
      function breach() {
        var lines = ['> scanning ' + r.setCode + ' kernel ... ' + c.collectorNumber, '> privilege: ROOT', '> payload: ' + c.face.name.toUpperCase(), '> containment: FAILED'];
        zd.classList.add('breach'); sfx('breach', 'Null', 'spectacle');
        ramp(bg, 0.15, 1, Z.breach * 0.6);
        lines.forEach(function (ln, i) { later(function () { zdTerm.insertBefore(document.createTextNode(ln + '\n'), cur); sfx('type', 'Null', 'normal'); }, i * (Z.breach / 5)); });
        later(arrive, Z.breach);
      }
      function arrive() {
        log('zeroDayArrive', { idx: k });
        var front = el.querySelector('.front');
        front.innerHTML = faceHtml(c, { settled: true });
        el.classList.remove('down'); el.classList.add('reach');
        el.style.zIndex = '200';
        el.style.transition = 'transform ' + Z.arrive + 'ms cubic-bezier(.2,1.3,.4,1)';
        el.style.transform = 'scale(1.5)';
        requestAnimationFrame(function () { el.style.transform = 'scale(1)'; });
        zd.classList.add('fade');
        stage.classList.add('shake');
        sfx('rise', 'Null', 'spectacle');
        settleFx(k, c);
        later(function () { zd.hidden = true; zd.className = 'zd'; stage.classList.remove('shake'); if (bg) { bg.stop(); } }, 800);
        S.busyUntil = performance.now() + Z.arrive + TM.reveal.zeroDay.hold;
        later(function () { el.style.transition = ''; S.tilt = k; }, Z.arrive);
        announce.textContent = c.face.name + ', Zero-Day';
        hint.innerHTML = '<span class="slot">SHINE SLOT</span><br>ZERO-DAY<br>' + (k === r.cards.length - 1 ? 'Tap for the summary' : 'Swipe or tap for the next card');
      }
    }, Z.black);
  }

  // ---------- the summary ----------
  function summary() {
    clearTimers(); stopLayers(); dim.style.opacity = 0;
    S.phase = 'summary'; skipBtn.hidden = true; counter.textContent = ''; hint.innerHTML = '';
    var r = DATA.packs[S.pack].reveal;
    var hits = r.cards.filter(function (c) { return c.hit; }).length;
    var tiles = r.cards.map(function (c, i) {
      var lab = packFinishLabel(c.finish);
      var cap = (lab ? '<span class="fin' + (c.hit ? ' hit' : '') + '">' + lab + '</span><br>' : '') + esc(c.face.name) + '<br>' + esc(c.prototype ? 'serial ' + c.prototype.serial + ' of ' + c.prototype.runSize : c.collectorNumber) + ' · x' + c.ownedAfter + ' owned';
      return '<div class="tile" style="--i:' + i + '" data-finish="' + c.finish + '">' + (c.isNew ? '<span class="new">NEW</span>' : '') + '<div class="mini">' + faceHtml(c, { settled: true }).replace('class="face ', 'class="face ' + (c.reveal === 'foil' || c.reveal === 'fullArt' || c.reveal === 'altArt' || c.reveal === 'secret' ? 'fx-css-foil ' : c.reveal === 'gold' || c.reveal === 'prototype' ? 'fx-css-gold ' : c.reveal === 'glitch' ? 'fx-css-glitch ' : c.reveal === 'zeroDay' ? 'fx-css-zeroDay ' : '')) + '</div><div class="cap">' + cap + '</div></div>';
    }).join('');
    var pity = r.pity.fullArt || r.pity.mythic ? '<div class="sub">' + (r.pity.fullArt ? 'Pity: this pack was due a hit. ' : '') + (r.pity.mythic ? 'Pity: this pack was due a Mythic.' : '') + '</div>' : '';
    scene.innerHTML = '<div class="summary"><h2>PACK COMPLETE</h2><p class="sub">' + r.cards.length + ' cards · ' + (hits ? hits + ' hit' + (hits > 1 ? 's' : '') : 'no hits') + (r.jackpot ? ' · Jackpot pack' : '') + '</p>' + pity +
      '<div class="grid">' + tiles + '</div><p class="points">+<b>' + r.packPoints + '</b> pack points</p>' +
      '<div class="btns"><button class="pri" id="again">Open another</button><button id="done">Done</button></div></div>';
    document.getElementById('again').addEventListener('click', function () { openPack((S.pack + 1) % DATA.packs.length); });
    document.getElementById('done').addEventListener('click', shelf);
    log('summary', { cards: r.cards.map(function (c) { return { name: c.face.name, finish: c.finish, isNew: c.isNew }; }), packPoints: r.packPoints });
  }

  // ?pack=N opens that pack straight away (1-based); otherwise the shelf.
  var m = /[?&]pack=(\d+)/.exec(location.search);
  if (m && DATA.packs[Number(m[1]) - 1]) openPack(Number(m[1]) - 1); else shelf();
})();
`;
