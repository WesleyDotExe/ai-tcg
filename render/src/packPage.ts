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
import { BULK_SPEEDS, BULK_TAP_TIMINGS, BULK_TIMINGS, FACTION_TELL_HEX, GLOW_STAGES, PACK_TIMINGS, REVEAL_TIMINGS, SNAP, TELL_BACKDROPS, TILT, ZERO_DAY_TIMINGS, type BulkReveal, type PackReveal } from "./packOpening.js";
import { SOUND_FX_PURE_SOURCE, SOUND_FX_RUNTIME_SOURCE } from "./soundFx.js";
import { FLOW_TIMINGS, MINT_TIMINGS, type FirstTimeData } from "./firstTime.js";
import { FIRST_TIME_CSS, FIRST_TIME_PURE_SOURCE, FIRST_TIME_RUNTIME_SOURCE, FIRST_TIME_WARD_SOURCE } from "./firstTimePage.js";
import { nameRulesSource } from "./nameRules.js";

export interface PackPageData {
  title: string;
  packs: { label: string; reveal: PackReveal }[];
  /** Ten-pack opens (slice 2). */
  bulks?: { label: string; reveal: BulkReveal }[];
  /** The first-time flow (slice 3, firstTimePage.ts): the page becomes the
   * Season 0 sign-up, with the pack opening inside it. */
  flow?: FirstTimeData;
  /** The owner website's full-screen pack opening (render session 47): the
   * page starts empty (no shelf, no picker) and the website drives it
   * through `window.PACK` with real openings it just made (POST
   * /api/packs/open): it sets the packs, opens them, and puts its own
   * buttons on the summaries. A Close button in the bar hands back to the
   * website (the cards are already in the collection by then; closing
   * early only stops the show). The sound setting comes from the owner's
   * account, through `window.PACK_SITE_HOST` on the website (the page's
   * same-origin parent; packSiteHost). */
  site?: boolean;
  /** The faction ward rings the reveal's ward flare draws (render session
   * 60): faction -> a data URL of the ring (packWards.ts reads them; this
   * module stays free of the file system because the website's client
   * bundles it). Without them the flare is a drawn ring in the faction's
   * colour. */
  wards?: Record<string, string>;
}

export function renderPackOpeningHtml(data: PackPageData): string {
  const embed = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
  const timings = { build: { glow: GLOW_STAGES, factions: FACTION_TELL_HEX, snap: SNAP }, backdrops: TELL_BACKDROPS, pack: PACK_TIMINGS, reveal: REVEAL_TIMINGS, zeroDay: ZERO_DAY_TIMINGS, bulk: BULK_TIMINGS, tap: BULK_TAP_TIMINGS, speeds: BULK_SPEEDS, tilt: TILT, mint: MINT_TIMINGS, flow: FLOW_TIMINGS };
  data = { ...data, bulks: data.bulks ?? [] };
  const flow = !!data.flow;
  const site = !!data.site;
  return `<!doctype html>
<html lang="en" data-theme="dark"${site ? ' class="site"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(data.title)}</title>
<style>${PACK_CSS}${flow ? FIRST_TIME_CSS : ""}</style>
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
  <div class="brand">AI·TCG <span>// ${flow ? "SEASON ZERO SIGN-UP" : "PACK OPENING"}</span></div>
  <nav class="picker" id="picker" aria-label="Choose a pack"></nav>
  <span class="sound-ctl" data-audio-ctl>
    <button id="btn-sound" aria-pressed="true" title="Sound is on. Click to mute.">Sound on</button>
    <input type="range" id="sound-vol" min="0" max="100" step="1" value="80" aria-label="Effects volume" title="Effects volume">
  </span>${site ? '\n  <button class="close" id="close" title="Back to the website. Your cards are already in your collection.">Close</button>' : ""}
</header>
<main class="stage" id="stage">
  <div class="bd" id="bd" aria-hidden="true"></div>
  <div class="dim" id="dim"></div>
  <div class="scene" id="scene"></div>
  <canvas class="sparks" id="sparks" aria-hidden="true"></canvas>
  <div class="flash" id="flash" aria-hidden="true"></div>
  <div class="hint" id="hint" aria-live="polite"></div>
  <div class="counter" id="counter"></div>${flow ? '\n  <div class="ftbadge" id="ftbadge"></div>' : ""}
  <button class="skip" id="skip" hidden>Skip to summary</button>
  <div class="bctl"><button class="bauto" id="bauto" role="switch" aria-checked="false" hidden title="Plays the packs by themselves, as fast as the speed says">Auto</button><span class="speed" id="speed" role="group" aria-label="Auto speed" hidden></span><button class="bskip" id="bskip" hidden title="Runs ahead to the next big pull, which still gets its full reveal; with none left, to the summary">Skip to summary</button></div>
</main>
<div class="zd" id="zd" hidden><div class="zd-term" id="zd-term"></div></div>${flow ? '\n<div class="mint" id="mint" hidden></div>' : ""}
<div class="viewer" id="viewer" hidden role="dialog" aria-modal="true" aria-label="Card viewer"><div class="vcard" id="vcard"></div><div class="vcap" id="vcap"></div><button class="vclose" id="vclose">Close</button></div>
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
${PACK_PAGE_RUNTIME_SOURCE}${flow ? `\n${FIRST_TIME_WARD_SOURCE}\n${nameRulesSource()}\n${FIRST_TIME_PURE_SOURCE}\n${FIRST_TIME_RUNTIME_SOURCE}` : ""}</script>
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
/* The website's full-screen opening: no picker, a Close button at the end of the bar. */
.site .picker { visibility: hidden; }
.close { border: 1px solid #6a8cff; background: #17204a; border-radius: 7px; padding: 4px 14px; font-weight: 700; }
.summary .btns button[disabled] { opacity: 0.45; cursor: default; }
.summary .why { color: var(--dim); font-size: 12px; margin-top: 8px; }

.stage { position: relative; flex: 1; min-height: calc(100dvh - 120px); overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none;
  background: radial-gradient(ellipse at 50% 38%, #1d2350 0%, #0b0e24 48%, #05060d 100%); }
.stage::before { content: ""; position: absolute; inset: -20%; background: radial-gradient(circle at 30% 20%, rgba(122,92,255,0.25), transparent 40%), radial-gradient(circle at 75% 70%, rgba(47,182,255,0.18), transparent 45%); animation: drift 16s ease-in-out infinite alternate; pointer-events: none; }
@keyframes drift { to { transform: translate(6%, -4%) scale(1.1); } }
.dim { position: absolute; inset: 0; background: #000; opacity: 0; transition: opacity 0.6s; pointer-events: none; z-index: 1; }
/* The backdrop (render 58, the ceremony's beat 1): a deep gradient behind
   the sealed pack that slowly shifts and pulses. Its colours are the
   pack's tell (packOpening.ts PackTell: the best card's rung, sometimes one
   lower, never higher); they ease from one pack's to the next. */
@property --tp { syntax: "<number>"; inherits: true; initial-value: 0; }
@property --b1 { syntax: "<color>"; inherits: true; initial-value: #1d2350; }
@property --b2 { syntax: "<color>"; inherits: true; initial-value: #0b0e24; }
@property --b3 { syntax: "<color>"; inherits: true; initial-value: #05060d; }
@property --bg2 { syntax: "<color>"; inherits: true; initial-value: #6a8cff; }
.bd { position: absolute; inset: 0; pointer-events: none; z-index: 0; --pm: 7000ms; --pa: 0.12;
  background: radial-gradient(ellipse 80% 70% at 50% 40%, var(--b1) 0%, var(--b2) 52%, var(--b3) 100%);
  transition: --b1 1.4s ease, --b2 1.4s ease, --b3 1.4s ease, --bg2 1.4s ease; }
.bd::before { content: ""; position: absolute; inset: -25%; background: radial-gradient(circle at 28% 22%, color-mix(in srgb, var(--bg2) 34%, transparent), transparent 42%), radial-gradient(circle at 76% 72%, color-mix(in srgb, var(--bg2) 22%, transparent), transparent 46%);
  animation: bdshift 18s ease-in-out infinite alternate; will-change: transform; }
.bd::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 50% 42%, var(--bg2), transparent 46%); opacity: calc(var(--pa) * 0.35);
  animation: bdpulse var(--pm) ease-in-out infinite; will-change: opacity, transform; mix-blend-mode: screen; }
@keyframes bdshift { 0% { transform: translate(-4%, 3%) rotate(-4deg) scale(1); } 100% { transform: translate(5%, -4%) rotate(5deg) scale(1.12); } }
@keyframes bdpulse { 50% { opacity: var(--pa); transform: scale(1.08); } }
.stage.has-bd::before { opacity: 0; }
/* The burst when the tear finishes: light in the best card's colour. */
.flash { position: absolute; inset: 0; pointer-events: none; z-index: 7; opacity: 0; background: radial-gradient(circle at var(--fx, 50%) var(--fy, 30%), var(--fc1, #fff), transparent 60%); mix-blend-mode: screen; }
.flash.go { animation: flash var(--fd, 700ms) ease-out forwards; }
@keyframes flash { 0% { opacity: var(--fo, 0.5); } 100% { opacity: 0; } }
.burst { position: absolute; width: var(--D, 400px); height: var(--D, 400px); margin: calc(var(--D, 400px) / -2) 0 0 calc(var(--D, 400px) / -2); border-radius: 50%; pointer-events: none; z-index: 7; will-change: transform, opacity;
  background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, var(--c1) 7%, color-mix(in srgb, var(--c1) 55%, transparent) 17%, color-mix(in srgb, var(--c1) 24%, transparent) 30%, color-mix(in srgb, var(--c2) 12%, transparent) 44%, transparent 64%); mix-blend-mode: screen;
  animation: burst var(--d, 900ms) cubic-bezier(.15,.8,.3,1) forwards; }
@keyframes burst { 0% { transform: scale(0.03); opacity: 1; } 55% { opacity: 0.85; } 100% { transform: scale(1); opacity: 0; } }
/* The ring: drawn at its full size and grown into it, so its line stays thin. */
.shock { position: absolute; width: var(--D, 400px); height: var(--D, 400px); margin: calc(var(--D, 400px) / -2) 0 0 calc(var(--D, 400px) / -2); border-radius: 50%; pointer-events: none; z-index: 7; border: 2px solid var(--c1); box-shadow: 0 0 14px var(--c1), inset 0 0 12px color-mix(in srgb, var(--c2) 60%, transparent);
  animation: shock var(--d, 900ms) cubic-bezier(.2,.7,.3,1) forwards; will-change: transform, opacity; }
@keyframes shock { 0% { transform: scale(0.04); opacity: 0.95; } 100% { transform: scale(1); opacity: 0; } }
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
.pack { --pw: min(66vw, 300px, calc((100dvh - 190px) * 0.6)); --tp: 0; --leak: #bfe3ff; width: var(--pw); height: calc(var(--pw) * 1.6); position: relative; transform-style: preserve-3d; cursor: grab; animation: bob 3.4s ease-in-out infinite; }
.pack.held { animation: none; }
.pack:focus { outline: none; }
.pack:focus-visible { outline: 2px solid #6a8cff; outline-offset: 8px; border-radius: 12px; }
@keyframes bob { 50% { transform: translateY(-8px) rotateZ(-0.6deg); } }
.pack .lean { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.35s cubic-bezier(.2,.8,.3,1); }
.pack .tilt { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.12s; }
.pack .half { position: absolute; left: 0; right: 0; overflow: hidden; }
.pack .half.top { top: 0; height: 16%; z-index: 2; clip-path: polygon(calc(var(--tp) * 100%) 0, 100% 0, 100% 100%, calc(var(--tp) * 100%) 100%); }
/* The torn part of the strip (render 58): it peels up and back from the
   cut as the tear runs along, hinged at the tear's head. */
.pack .half.flap { top: 0; height: 16%; z-index: 3; clip-path: polygon(0 0, calc(var(--tp) * 100% + 1px) 0, calc(var(--tp) * 100% + 1px) 100%, 0 100%); transform-origin: calc(var(--tp) * 100%) 100%;
  transform: translateY(calc(var(--tp) * var(--pw) * -0.05)) rotate(calc(var(--tp) * -7deg)); filter: brightness(1.15); }
.pack .half.flap .wrap { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.12), inset 0 -6px 10px rgba(0,0,0,0.5); }
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
.pack .cutline i { position: absolute; left: 0; top: -2px; height: 3px; width: 0; background: linear-gradient(90deg, #fff, var(--leak)); box-shadow: 0 0 10px var(--leak), 0 0 calc(12px + var(--tp) * 26px) var(--leak); border-radius: 2px; }
/* The light leaking out of the open cut: the backdrop's tell colour,
   brighter the further the tear has run. */
.pack .leak { position: absolute; left: 0; top: 16%; height: calc(var(--pw) * 0.09); width: calc(var(--tp) * 100%); transform: translateY(-50%); z-index: 2; pointer-events: none; border-radius: 50%;
  background: radial-gradient(ellipse at 50% 50%, var(--leak), transparent 70%); opacity: calc(var(--tp) * 0.9); mix-blend-mode: screen; filter: blur(3px); }
/* The tear's head: a jagged notch of foil that sits under the cursor. */
.pack .rip { position: absolute; top: 16%; left: calc(var(--tp) * 100%); width: calc(var(--pw) * 0.07); height: calc(var(--pw) * 0.07); transform: translate(-50%, -50%); z-index: 4; pointer-events: none; opacity: 0; transition: opacity 0.15s; }
.pack .rip svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 0 4px var(--leak)) drop-shadow(0 0 10px var(--leak)); }
.pack.tearing .rip, .pack.held-tear .rip { opacity: 1; }
/* The pack's art (render 58): a code-drawn foil plate behind the logo: a
   circuit field and the season's four faction marks around the emblem. */
.pack .pa { position: absolute; inset: 0; pointer-events: none; opacity: 0.9; }
.pack .pa svg { width: 100%; height: 100%; display: block; }
.pack .grip { position: absolute; left: 0; right: 0; top: 0; height: 26%; z-index: 4; }
/* The tear strip, marked so it reads as the place to drag (a drag anywhere
   else on the pack tilts it instead): a lit band over the strip and a TEAR
   tab at the cut line's start. */
.pack .strip { position: absolute; left: 0; right: 0; top: 0; height: 26%; z-index: 3; border-radius: 10px 10px 0 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(191,227,255,0.10), rgba(191,227,255,0.04) 70%, transparent); box-shadow: inset 0 -1px 0 rgba(191,227,255,0.18); }
.pack .tab { position: absolute; left: 6%; top: calc(16% - 1.2em); z-index: 4; pointer-events: none; font-size: calc(var(--pw) * 0.047); font-weight: 900; letter-spacing: 0.16em; color: #e6f2ff; padding: 0.15em 0.55em; border-radius: 3px; background: rgba(106,140,255,0.35); border: 1px solid rgba(191,227,255,0.55); }
.pack.torn .tab, .pack.torn .strip { opacity: 0; transition: opacity 0.15s; }
.pack .fxgl { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 10px; mix-blend-mode: screen; pointer-events: none; z-index: 2; }
.pack.fx-css-pack .half.body::after { content: ""; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%); background-size: 250% 100%; animation: sheen 3.6s linear infinite; mix-blend-mode: screen; }
.pack.torn .half.top, .pack.torn .half.flap { animation: stripoff 0.65s cubic-bezier(.3,.7,.4,1) forwards; }
.pack.torn .rip, .pack.torn .leak { opacity: 0; transition: opacity 0.2s; }
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
.stack { position: relative; width: var(--cw); height: calc(var(--cw) * 1.4); perspective: 1100px; }
/* Hold to tilt: no long-press menu or text callout on a phone. */
.stage, .viewer { -webkit-touch-callout: none; }
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
/* The reveal escalation (render session 60): a held card's back climbs the
   glow stages (--gn, in --gc), an aura behind it growing with each, the back
   trembling a little harder each stage; the room dims and the stage shakes
   on the hit; the faction ward flares behind the card as it lands. Only
   opacity and transforms animate, apart from the back's own rim. */
@property --gc { syntax: "<color>"; inherits: true; initial-value: #7fe3ff; }
.cslot { --gn: 0; --gms: 400ms; }
.cslot .aura { position: absolute; inset: -16%; border-radius: 24%; pointer-events: none; opacity: 0; transform: scale(0.9); filter: blur(12px);
  background: radial-gradient(closest-side, var(--gc) 0%, color-mix(in srgb, var(--gc) 40%, transparent) 58%, transparent 100%);
  transition: opacity var(--gms) ease-in, transform var(--gms) cubic-bezier(.2,.8,.3,1.25), --gc var(--gms); will-change: opacity, transform; }
.cslot.charging .aura { opacity: calc(0.28 + var(--gn) * 0.17); transform: scale(calc(0.94 + var(--gn) * 0.055)); }
.cslot.charging.flipping .aura { opacity: 0; transform: scale(1.25); transition: opacity 0.35s ease-out, transform 0.35s ease-out; }
.cslot.charging .back { box-shadow: inset 0 0 0 calc(var(--cw) * 0.025) var(--gc), 0 0 calc(10px + var(--gn) * 9px) calc(var(--gn) * 2px) var(--gc);
  transition: box-shadow var(--gms), --gc var(--gms); animation: tremble calc(280ms - var(--gn) * 45ms) linear infinite; }
.cslot.charging .back .bl { text-shadow: 0 0 calc(10px + var(--gn) * 7px) var(--gc); color: #fff; }
@keyframes tremble { 0%, 100% { transform: rotateY(180deg) translate(0, 0); } 25% { transform: rotateY(180deg) translate(calc(var(--gn) * 0.7px), calc(var(--gn) * -0.45px)); } 75% { transform: rotateY(180deg) translate(calc(var(--gn) * -0.7px), calc(var(--gn) * 0.45px)); } }
.stage.bshake { animation: bshake var(--skd, 400ms) cubic-bezier(.36,.07,.19,.97); }
@keyframes bshake { 12% { transform: translate(calc(var(--sk) * -1), calc(var(--sk) * 0.5)); } 28% { transform: translate(var(--sk), calc(var(--sk) * -0.45)); } 44% { transform: translate(calc(var(--sk) * -0.6), calc(var(--sk) * 0.3)); } 62% { transform: translate(calc(var(--sk) * 0.35), calc(var(--sk) * -0.2)); } 80% { transform: translate(calc(var(--sk) * -0.12), 0); } }
.wflare { position: absolute; width: var(--ws); height: var(--ws); margin: calc(var(--ws) / -2) 0 0 calc(var(--ws) / -2); pointer-events: none; z-index: 2; mix-blend-mode: screen; }
.wflare i { position: absolute; inset: 0; border-radius: 50%; background: center / contain no-repeat; will-change: transform, opacity;
  animation: wflare 1.1s cubic-bezier(.2,.8,.3,1) both, wspin 26s linear 1.1s infinite; }
.wflare.plain i { border: 2px solid var(--wc); box-shadow: 0 0 18px var(--wc), inset 0 0 18px var(--wc); }
.wflare i.r2 { inset: -16%; animation: wflare2 1.35s 0.08s cubic-bezier(.2,.8,.3,1) both, wspinr 34s linear 1.45s infinite; }
.wflare.out { opacity: 0; transition: opacity 0.3s; }
@keyframes wflare { 0% { transform: scale(0.45) rotate(-50deg); opacity: 0; } 28% { opacity: 1; } 55% { transform: scale(1.12) rotate(-8deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 0.6; } }
@keyframes wflare2 { 0% { transform: scale(0.4) rotate(60deg); opacity: 0; } 30% { opacity: 0.9; } 60% { transform: scale(1.1) rotate(8deg); } 100% { transform: scale(1) rotate(0deg); opacity: 0.45; } }
@keyframes wspin { to { transform: rotate(360deg); } }
@keyframes wspinr { to { transform: rotate(-360deg); } }
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
.face .name { font-weight: 800; font-size: calc(6.4cqw * var(--nfit, 1)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }
.face .cost { flex: none; width: 10.5cqw; height: 10.5cqw; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 5.6cqw; color: #0b1a2a; background: radial-gradient(circle at 35% 30%, #fff, #9fd8ff 40%, #2b6fa8); box-shadow: 0 0 0 1px rgba(0,0,0,0.4); }
.face .type { position: absolute; left: 4.5%; right: 4.5%; top: 55.5%; height: 7%; display: flex; justify-content: space-between; align-items: center; font-size: 4.4cqw; padding: 0 2.5cqw; background: rgba(0,0,0,0.32); border-radius: 4px; z-index: 2; }
.face .rar { color: var(--fc); font-weight: 700; }
.face .text { position: absolute; left: 4.5%; right: 4.5%; top: 64%; bottom: 13%; padding: 2.4cqw 3cqw; font-size: calc(4.3cqw * var(--fit, 1)); line-height: 1.32; border-radius: 4px; background: rgba(0,0,0,0.26); color: #dfe5f1; overflow: hidden; z-index: 2; }
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
/* Full bleed: every finish rarer than Full Art (packFullBleed) lets the art
   fill the card, the text sitting on it (owner 2026-10-18). The edge ring is
   drawn over the art, since the face's own inset ring sits under it. */
.face.full .art { left: 0; right: 0; top: 0; height: 100%; border-radius: 0; }
.face.full .type, .face.full .text { background: rgba(5,8,18,0.62); backdrop-filter: blur(2px); }
.face.full .head { background: linear-gradient(180deg, rgba(0,0,0,0.55), transparent); border-radius: 4px; padding: 0 1.6cqw; }
.face.full .foot { background: linear-gradient(0deg, rgba(0,0,0,0.5), transparent); border-radius: 4px; padding: 0 1.6cqw; left: 3.4%; right: 3.4%; }
.face.full::before { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 4; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.12), inset 0 0 0 4px var(--ring, var(--fc, #3a4152)); }
/* Gold: full-bleed art in gold tones, a gold edge, gold lettering. */
.face.goldframe { box-shadow: 0 14px 40px rgba(0,0,0,0.55), 0 0 30px rgba(246,215,122,0.45); }
.face.goldframe::before { box-shadow: inset 0 0 0 1px rgba(255,248,214,0.8); padding: 2.6cqw; background: linear-gradient(115deg, var(--gold1), var(--gold2) 22%, var(--gold3) 40%, var(--gold4) 50%, var(--gold3) 60%, var(--gold2) 78%, var(--gold1)); background-size: 250% 100%; animation: sheen 4s linear infinite;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; }
.face.goldframe .art { filter: sepia(0.85) saturate(1.7) hue-rotate(-10deg) brightness(1.06) contrast(1.05); }
.face.goldframe .head { background: linear-gradient(180deg, rgba(40,24,0,0.75), transparent); }
.face.goldframe .name { background: linear-gradient(180deg, var(--gold4), var(--gold2) 55%, var(--gold3)); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.85)); }
.face.goldframe .cost { background: radial-gradient(circle at 35% 30%, #fffbe6, var(--gold2) 45%, var(--gold1)); color: #2b1a00; }
.face.goldframe .text, .face.goldframe .type { background: rgba(34,20,0,0.7); color: #ffe9b0; box-shadow: inset 0 0 0 1px rgba(246,215,122,0.35); }
.face.goldframe .rar, .face.goldframe .text .flav, .face.goldframe .foot, .face.goldframe .setno { color: var(--gold2); }
.face.goldframe .foot { background: linear-gradient(0deg, rgba(40,24,0,0.7), transparent); }
/* Glitch: the card's own art, palette rotated to a corrupted one. */
/* An agent's signature card (render session 28): full bleed, a white-gold
   edge, white-gold lettering, and "1 OF 1" after its PR- number. */
.face.sigface { --ring: var(--neutral); box-shadow: 0 14px 40px rgba(0,0,0,0.55), 0 0 34px rgba(255,240,194,0.5); }
.face.sigface::before { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.9), inset 0 0 0 2.4cqw rgba(255,240,194,0.2), inset 0 0 0 2.8cqw rgba(255,240,194,0.85); }
.face.sigface .name { background: linear-gradient(180deg, #fffdf2, var(--neutral) 55%, #d9b860); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.9)); }
.face.sigface .cost { background: radial-gradient(circle at 35% 30%, #fffdf2, var(--neutral) 45%, #b8862a); color: #2b1a00; }
.face.sigface .mark { background: linear-gradient(110deg, #d9b860, #fff8e0 50%, #d9b860); color: #2b1a00; }
.face.sigface .rar, .face.sigface .setno, .face.sigface .foot { color: var(--neutral); }
.face .oneof { font-weight: 900; letter-spacing: 0.08em; color: var(--neutral); }
.face .fxgl-signature { mix-blend-mode: screen; }
.face.fx-css-signature::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 5; border-radius: inherit; background: radial-gradient(circle at 50% 34%, rgba(255,240,194,0.35), transparent 55%), linear-gradient(115deg, transparent 30%, rgba(255,248,224,0.45) 50%, transparent 70%); background-size: 100% 100%, 250% 100%; animation: sheen 3.4s linear infinite; mix-blend-mode: screen; }
.face.corrupt .art { filter: hue-rotate(150deg) saturate(1.8) contrast(1.35); }
.face.corrupt { --ring: #ff2bd6; box-shadow: 0 14px 40px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.07), inset 0 0 0 4px #ff2bd6; }
/* A modal ("choose one") card: each mode's name and its rules text. On a
   full-bleed face the rules box starts higher, since the art is behind it
   anyway and two modes need the room. */
.face .text.modal { font-size: calc(3.7cqw * var(--fit, 1)); line-height: 1.26; }
.face .text .choose { margin: 0 0 1cqw; font-size: 2.8cqw; font-weight: 900; letter-spacing: 0.18em; color: var(--fc); }
.face .text .mode { margin: 0 0 1.3cqw; padding-left: 2cqw; border-left: 0.7cqw solid var(--fc); }
.face .text .mode b { color: #fff; font-weight: 800; margin-right: 0.6cqw; }
.face.full.modal .type { top: 47%; }
.face.full.modal .text { top: 55%; }
.face.zdface .text .choose { color: #35ff8a; } .face.zdface .text .mode { border-left-color: #35ff8a; }
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
.face.zdface { --ring: #35ff8a; box-shadow: 0 0 0 2px #ff1e3c, 0 0 34px rgba(255,30,60,0.7), inset 0 0 0 4px #35ff8a; }
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

/* ---------- the card viewer (a summary tile, full size) ---------- */
.viewer { position: fixed; inset: 0; z-index: 45; display: grid; place-items: center; align-content: center; gap: 12px; padding: 16px; background: rgba(3,4,10,0.88); backdrop-filter: blur(3px); touch-action: none; }
.viewer[hidden] { display: none; }
.vcard { --cw: min(calc(100vw - 32px), 360px, calc((100dvh - 150px) * 0.714)); width: var(--cw); height: calc(var(--cw) * 1.4); position: relative; perspective: 1100px; animation: rise 0.35s cubic-bezier(.2,.9,.3,1) both; }
.vcard .tiltv { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.12s; }
.vcard .face { border-radius: calc(var(--cw) * 0.05); }
.vcard.reach::before { content: ""; position: absolute; inset: -7%; border-radius: 16px; pointer-events: none; background: conic-gradient(from var(--zda, 0deg), rgba(255,30,60,0), rgba(255,30,60,0.75), rgba(60,255,140,0.6), rgba(255,30,60,0)); filter: blur(14px); animation: zdspin 3s linear infinite; }
.vcap { font-size: 12px; color: var(--dim); text-align: center; max-width: var(--cw); }
.vcap .fin { display: inline-block; font-weight: 800; letter-spacing: 0.08em; font-size: 10px; padding: 1px 6px; border-radius: 3px; background: #1a2342; color: #cfe0ff; }
.vcap .fin.hit { background: linear-gradient(110deg, #7a5cff, #ff5cc8); color: #fff; }
.vclose { border: 1px solid #6a8cff; background: #17204a; border-radius: 8px; padding: 6px 18px; font-weight: 700; }
.tile .mini { cursor: zoom-in; }

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
/* ---------- ten packs at once ---------- */
.stage { --sp: 1; }
.picker button.ten { border-style: dashed; }
.shelf-wrap { width: min(760px, calc(100vw - 32px)); max-height: calc(100% - 70px); overflow-y: auto; touch-action: pan-y; }
.shelf-wrap h3 { margin: 6px 0 8px; font-size: 12px; letter-spacing: 0.16em; color: var(--dim); text-transform: uppercase; }
.shelf-wrap .shelf { width: 100%; margin-bottom: 12px; }
.shelf .mp.ten { position: relative; background: none; box-shadow: none; }
.shelf .mp.ten i { position: absolute; inset: 0; border-radius: 5px; background: linear-gradient(135deg, #1b2a6b, #3a1f7a 40%, #11163a 60%, #0f2a5e); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.5); }
.shelf .mp.ten i:nth-child(1) { transform: translateX(-9px) rotate(-8deg); } .shelf .mp.ten i:nth-child(3) { transform: translateX(9px) rotate(8deg); }
.bctl [hidden] { display: none !important; }
.bctl { position: absolute; top: 34px; right: 16px; z-index: 7; display: flex; gap: 8px; align-items: center; }
.speed { display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
.speed button { border: 0; background: rgba(13,19,36,0.85); padding: 4px 10px; font-size: 12px; font-weight: 700; color: var(--dim); font-variant-numeric: tabular-nums; }
.speed button[aria-pressed="true"] { background: #2a3a8a; color: #fff; }
.bauto { border: 1px solid var(--line); background: rgba(13,19,36,0.85); border-radius: 999px; padding: 3px 10px 3px 6px; font-size: 12px; font-weight: 700; color: var(--dim); display: inline-flex; align-items: center; gap: 6px; }
.bauto::before { content: ""; width: 22px; height: 12px; border-radius: 6px; background: #1f2a4d; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15); transition: background 0.2s; }
.bauto[aria-checked="true"] { color: #fff; border-color: #6a8cff; }
.bauto[aria-checked="true"]::before { background: radial-gradient(circle at 16px 6px, #fff 0 4px, transparent 4.5px), #3d7bff; }
.bauto:not([aria-checked="true"])::before { background: radial-gradient(circle at 6px 6px, #8ea3c9 0 4px, transparent 4.5px), #1f2a4d; }
.bskip { border: 1px solid var(--line); background: rgba(13,19,36,0.85); border-radius: 7px; padding: 4px 11px; font-size: 12px; font-weight: 700; color: var(--ink); }
/* A small sealed pack: the fan of ten, and the one about to tear in the fast sequence. */
.mpack { --mw: min(30vw, 120px, calc((100dvh - 260px) * 0.4)); width: var(--mw); height: calc(var(--mw) * 1.6); position: relative; }
.mpack .mtilt { position: absolute; inset: 0; transform-style: preserve-3d; }
.fan .mpack.front { perspective: 700px; }
.mpack .mtop, .mpack .mbody { position: absolute; left: 0; right: 0; border-radius: 7px; overflow: hidden; background: linear-gradient(135deg, #1b2a6b 0%, #3a1f7a 32%, #11163a 55%, #2a1150 78%, #0f2a5e 100%); box-shadow: inset 0 0 0 2px rgba(255,255,255,0.1), 0 10px 26px rgba(0,0,0,0.55); }
.mpack .mtop { top: 0; height: 16%; border-radius: 7px 7px 0 0; background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0 3px, rgba(0,0,0,0.25) 3px 6px), linear-gradient(135deg, #1b2a6b, #3a1f7a); }
.mpack .mbody { top: 16%; bottom: 0; border-radius: 0 0 7px 7px; display: grid; place-items: center; align-content: center; gap: 6px; }
.mpack .mbody span { font-weight: 900; letter-spacing: 0.1em; font-size: calc(var(--mw) * 0.15); background: linear-gradient(180deg, #fff, #bfe3ff 45%, #6a8cff 55%, #e6d2ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
.mpack .mbody svg { width: 34%; aspect-ratio: 1; color: #bfe3ff; }
.fan { position: relative; width: calc(min(30vw, 120px, calc((100dvh - 260px) * 0.4)) * 2.4); height: calc(min(30vw, 120px, calc((100dvh - 260px) * 0.4)) * 1.9); cursor: pointer; display: grid; place-items: center; }
.fan:focus { outline: none; }
.fan .mpack { position: absolute; transform: rotate(calc((var(--k) - (var(--n) - 1) / 2) * 5deg)) translateX(calc((var(--k) - (var(--n) - 1) / 2) * 10px)); transform-origin: 50% 120%; transition: transform 0.4s cubic-bezier(.3,.7,.2,1), opacity 0.4s; animation: bob 3.4s ease-in-out infinite; animation-delay: calc(var(--k) * -0.3s); }
.fan.go .mpack { transform: translateY(-40%) rotate(calc((var(--k) - (var(--n) - 1) / 2) * 14deg)) translateX(calc((var(--k) - (var(--n) - 1) / 2) * 30px)); opacity: 0; }
.bulk { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; height: 100%; justify-content: center; padding: 50px 16px 60px; }
.pips { display: flex; gap: 6px; }
.pips i { width: 14px; height: 6px; border-radius: 3px; background: #1f2a4d; transition: background 0.2s; }
.pips i.cur { background: #6a8cff; box-shadow: 0 0 8px #6a8cff; }
.pips i.done { background: #3b4c80; }
.pips i.done.hit { background: linear-gradient(90deg, #7a5cff, #ff5cc8); }
.pips i.done.big { background: linear-gradient(90deg, var(--gold2), var(--gold4)); box-shadow: 0 0 8px rgba(246,215,122,0.7); }
.brow { flex: 1; width: 100%; display: grid; place-items: center; min-height: 0; cursor: pointer; }
.mpack.solo { animation: rise calc(0.35s / var(--sp)) cubic-bezier(.2,.9,.3,1) both; }
.mpack.torn .mtop { animation: stripoff calc(0.4s / var(--sp)) cubic-bezier(.3,.7,.4,1) forwards; }
.mpack.torn .mbody { animation: packdown calc(0.4s / var(--sp)) calc(0.15s / var(--sp)) cubic-bezier(.5,0,.8,.4) forwards; }
.bcards { --bw: min(150px, calc((100vw - 72px) / 5), calc((100dvh - 290px) / 1.45)); display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: calc(var(--bw) * 5 + 32px); }
.bcards.n6 { --bw: min(140px, calc((100vw - 80px) / 6), calc((100dvh - 290px) / 1.45)); max-width: calc(var(--bw) * 6 + 40px); }
.bcard { --cw: var(--bw); position: relative; width: var(--bw); height: calc(var(--bw) * 1.4); perspective: 900px; animation: deal calc(0.3s / var(--sp)) cubic-bezier(.2,.9,.3,1) both; animation-delay: calc(var(--d) * 70ms / var(--sp)); }
@keyframes deal { from { transform: translateY(40%) scale(0.6) rotate(-6deg); opacity: 0; } }
.bcard .flipper { transition: transform calc(0.23s / var(--sp)) cubic-bezier(.3,.6,.3,1); }
.bcard.down .flipper { transform: rotateY(180deg); }
.bcard.down .back { box-shadow: inset 0 0 0 calc(var(--cw) * 0.025) #1c2350, 0 0 14px 3px rgba(150,190,255,0.6); }
.bcards.wait .bcard.down { cursor: pointer; }
.bcards.wait .bcard.down .back { animation: glow 1.4s ease-in-out infinite; }
.bcard .face { border-radius: calc(var(--cw) * 0.05); }
.bcard.pop { z-index: 3; animation: bpop calc(0.6s / var(--sp)) cubic-bezier(.2,1.5,.4,1); }
@keyframes bpop { 40% { transform: scale(1.14); } }
.bcard.pop .face { box-shadow: 0 0 22px 4px rgba(255,92,200,0.55), 0 0 40px 8px rgba(122,92,255,0.35); }
.bcard .blab { position: absolute; left: 0; right: 0; top: calc(100% + 4px); text-align: center; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; color: #cfe0ff; opacity: 0; transition: opacity 0.2s; white-space: nowrap; }
.bcard.shown .blab:not(:empty) { opacity: 1; }
.bcard .blab.hit { color: #ffb3ec; text-shadow: 0 0 8px rgba(255,92,200,0.8); }
.bcard .new { position: absolute; top: -6px; right: -6px; z-index: 9; background: #ff3d7f; color: #fff; font-weight: 900; font-size: 9px; letter-spacing: 0.1em; padding: 1px 5px; border-radius: 3px; opacity: 0; transition: opacity 0.2s; }
.bcard:not(.down) .new { opacity: 1; }
.bulk-sum h3 { margin: 18px 0 10px; font-size: 12px; letter-spacing: 0.16em; color: var(--dim); text-transform: uppercase; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.chip { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 999px; background: #121a33; border: 1px solid var(--line); color: #cfe0ff; }
.chip b { color: #fff; margin-left: 2px; }
.chip.f-fullArt, .chip.f-altArt, .chip.f-glitch { border-color: #a46cff; } .chip.f-gold, .chip.f-prototype, .chip.f-secret, .chip.f-zeroDay { border-color: var(--gold2); color: var(--gold4); }
.bulk-sum .grid { padding: 8px 8px 0; }
.grid.best { grid-template-columns: repeat(auto-fill, minmax(min(190px, 44vw), 1fr)); }
.tile.big { max-width: 220px; }
.tile .cnt { position: absolute; top: -7px; left: -7px; z-index: 9; background: #2a3a8a; color: #fff; font-weight: 900; font-size: 11px; padding: 2px 6px; border-radius: 4px; box-shadow: 0 0 0 1px rgba(255,255,255,0.25); }
@media (max-width: 560px) {
  .bcards, .bcards.n6 { --bw: min(108px, calc((100vw - 48px) / 3), calc((100dvh - 330px) / 2.9)); max-width: calc(var(--bw) * 3 + 16px); row-gap: 22px; }
  .bulk { padding-top: 76px; }
}
@media (prefers-reduced-motion: reduce) {
  .pack, .stage::before, .back, .cslot.reach::before, .face.zdface .art, .fan .mpack, .bd::before, .bd::after { animation: none !important; }
  .burst, .shock { animation-duration: 1ms !important; }
  .stage.bshake { animation: none !important; }
  .wflare i, .wflare i.r2 { animation: wfade 0.3s both !important; }
  @keyframes wfade { from { opacity: 0; } to { opacity: 0.55; } }
  .pack .lean { transition: none; }
}
@media (max-width: 520px) {
  .brand span { display: none; }
  .banner { font-size: 16px; }
}
`;

/** The page's pure helpers, evaluated in Node by the tests (the same
 * source the page runs). */
export const PACK_PAGE_PURE_SOURCE = String.raw`
  // The owner website's hooks, when the page runs inside it (site mode): the
  // website (same origin, the page's parent) sets window.PACK_SITE_HOST =
  // { sound: { read, write }, close() } before it loads the page. Anything
  // else (a standalone page, a parent on another origin) is no host.
  function packSiteHost() {
    try { if (window.parent && window.parent !== window && window.parent.PACK_SITE_HOST) return window.parent.PACK_SITE_HOST; } catch (e) { /* another origin */ }
    return null;
  }
  // The sound store the site mode mounts: the account's setting through the
  // host; without one, nothing remembered (sound on, the default volume).
  function packSiteSoundStore() {
    var h = packSiteHost();
    if (h && h.sound) return h.sound;
    return { read: function () { return null; }, write: function () {} };
  }
  // How far a drag across the pack's top has torn it, 0-1: the horizontal
  // distance over 70% of the pack's width. Dragging back doesn't un-tear.
  function packTearProgress(prev, x0, x, width) {
    var p = (x - x0) / Math.max(1, width * 0.7);
    return Math.max(prev, Math.min(1, Math.max(0, p)));
  }
  // The tear that follows the cursor (render session 58): each move along
  // the strip advances the tear's head by exactly the distance moved to the
  // right (over the cut's length, 88% of the pack's width), from wherever
  // it was held; moving back, or letting go, holds it where it is.
  function packTearStep(prev, dx, width) {
    return Math.max(0, Math.min(1, prev + Math.max(0, dx) / Math.max(1, width * 0.88)));
  }
  // The drag's speed for the rip sound, px per ms, smoothed over the last
  // moves so one jittery event doesn't spike it.
  function packDragSpeed(prev, dx, ms) {
    var v = Math.abs(dx) / Math.max(4, ms);
    return Math.round((prev * 0.55 + v * 0.45) * 1000) / 1000;
  }
  // Foil scraps thrown off the tear's head for a move of dx px: about one
  // per 7 px, at most 6 a move.
  function packScrapCount(dx) {
    return Math.max(0, Math.min(6, Math.floor(Math.max(0, dx) / 7)));
  }
  // The burst at the end of the tear for a pack's tell: how far it spreads
  // (in multiples of a 10 px seed), how long, how many motes, how strong
  // the screen flash. Grows with the best card's rung (0-4).
  function packBurstPlan(size, rung) {
    var r = Math.max(0, Math.min(4, rung | 0));
    return { scale: Math.round(18 + 52 * size), ms: 620 + r * 170, motes: 24 + r * 34, flash: Math.round((0.22 + r * 0.12) * 100) / 100, ring: r >= 1 };
  }
  // The pack's own art plate (render 58): a circuit field and the four
  // faction marks around the emblem, code-drawn, the same on every pack
  // of a set (the pack never hints at what it holds).
  function packPlateSvg(setCode) {
    var seed = 0; for (var i = 0; i < setCode.length; i++) seed = (seed * 31 + setCode.charCodeAt(i)) >>> 0;
    var a = seed || 1; function rnd() { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }
    var W = 100, H = 160, out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">'];
    for (var t = 0; t < 22; t++) {
      var x = rnd() * W, y = 18 + rnd() * (H - 30), pts = [x.toFixed(1) + ',' + y.toFixed(1)];
      for (var k = 0; k < 4; k++) { if (k % 2 === 0) x += (rnd() - 0.5) * 34; else y += (rnd() - 0.5) * 26; pts.push(x.toFixed(1) + ',' + y.toFixed(1)); }
      out.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="rgba(160,200,255,0.16)" stroke-width="0.6"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="0.9" fill="rgba(200,225,255,0.4)"/>');
    }
    var cols = ['#35c9ff', '#ff7d24', '#8bff5c', '#d565ff'];
    for (var f = 0; f < 4; f++) {
      var ang = -Math.PI / 2 + f * Math.PI / 2 + Math.PI / 4, cx = 50 + Math.cos(ang) * 30, cy = 77 + Math.sin(ang) * 30;
      out.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4.2" fill="none" stroke="' + cols[f] + '" stroke-opacity="0.7" stroke-width="0.8"/><circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="1.5" fill="' + cols[f] + '" fill-opacity="0.8"/>');
    }
    out.push('<circle cx="50" cy="77" r="30" fill="none" stroke="rgba(191,227,255,0.22)" stroke-width="0.6" stroke-dasharray="2 3"/><circle cx="50" cy="77" r="38" fill="none" stroke="rgba(191,227,255,0.12)" stroke-width="0.5"/>');
    out.push('</svg>');
    return out.join('');
  }
  // What a release on the top card means: a tap (barely moved), a swipe
  // (moved far enough sideways) or neither (let go mid-drag: snap back).
  function packGesture(dx, dy, ms) {
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10 && ms < 600) return 'tap';
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'swipeLeft' : 'swipeRight';
    return 'none';
  }
  // Hold to tilt (owner 2026-10-18): what a press that hasn't been let go
  // has become. 'tilt' once it has been held still for T.holdMs, or (where
  // a move means nothing else, swipe false) once it has moved T.dragPx;
  // 'move' when it moved first where a move is a swipe (the reveal stack:
  // the swipe keeps it); else still 'pending'. Release on 'pending' or
  // 'move' is read by packGesture as before; release on 'tilt' never counts
  // as a tap or a swipe.
  function packHoldState(dx, dy, ms, swipe, T) {
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= T.dragPx) return swipe ? 'move' : 'tilt';
    return ms >= T.holdMs ? 'tilt' : 'pending';
  }
  // The lean for a finger at (x, y) over the card (0-1 each, may run off
  // the card): the side under the finger dips away, up to max degrees
  // each way, reached at the card's edge.
  function packTiltAngles(x, y, max) {
    function c(v) { return Math.max(-1, Math.min(1, v)); }
    var ry = c((x - 0.5) * 2) * max, rx = c((0.5 - y) * 2) * max;
    return { rx: Math.round(rx * 10) / 10 || 0, ry: Math.round(ry * 10) / 10 || 0 };
  }
  // A finish's sound tier: small hits lift, big ones climb.
  function packRiseTier(kind) {
    return kind === 'gold' || kind === 'secret' || kind === 'zeroDay' || kind === 'prototype' ? 'spectacle' : 'normal';
  }
  // The label a finish gets on the summary and in the hint.
  function packFinishLabel(finish) {
    return { standard: '', foil: 'FOIL', fullArt: 'FULL ART', altArt: 'ALT ART', glitch: 'GLITCH', secret: 'SECRET', gold: 'GOLD', prototype: 'PROTOTYPE', tournament: 'PRIZE', zeroDay: 'ZERO-DAY', signature: 'SIGNATURE' }[finish] || '';
  }
  // The finishes, best first (the ten-pack summary's chips and order).
  function packFinishOrder() {
    return ['zeroDay', 'prototype', 'tournament', 'secret', 'gold', 'glitch', 'altArt', 'fullArt', 'foil', 'standard'];
  }
  // Which packs of a ten-pack open a summary tile came from: "pack 3",
  // "packs 2, 7", "packs 1, 4 +3" past three.
  function packListLabel(packs) {
    if (packs.length === 1) return 'pack ' + packs[0];
    var head = packs.slice(0, 3).join(', ');
    return 'packs ' + head + (packs.length > 3 ? ' +' + (packs.length - 3) : '');
  }
  // The lasting look a settled card wears over its face: which shader
  // layer (or its CSS stand-in), and how strong. '' for a plain card.
  function packFinishLayerName(reveal) {
    return { foil: 'foil', fullArt: 'foil', altArt: 'foil', secret: 'foil', gold: 'gold', prototype: 'gold', glitch: 'glitch', zeroDay: 'zeroDay', signature: 'signature' }[reveal] || '';
  }
  function packFinishLayerAmt(reveal) {
    return { foil: 1, fullArt: 0.55, altArt: 0.55, secret: 0.55, gold: 1, prototype: 0.5, glitch: 0.18, zeroDay: 0.75, signature: 0.85 }[reveal] || 0;
  }
  // What a tap (or a swipe) on a ten-pack row does, in the tap-driven
  // opening (owner 2026-10-18): turn over the card tapped if it waits face
  // down, else the first face-down card left, else move on to the next pack
  // (the summary after the last). downs: the row's face-down cards, in
  // order; tapped: the card under the tap, or -1.
  function packRowTap(downs, tapped, last) {
    if (tapped >= 0 && downs.indexOf(tapped) >= 0) return { flip: tapped };
    if (downs.length) return { flip: downs[0] };
    return { next: last ? 'summary' : 'pack' };
  }
  // How long a fast (not full-reveal) pack of a ten-pack open takes at a
  // speed: sealed, torn, dealt, each face-down card turned in turn, held.
  // Mirrors Auto's own beats (tearMini, dealRow, autoRow).
  function packFastDuration(cards, sparks, T, speed) {
    var downs = cards.filter(function (c) { return c.faceDown; }).length;
    return (T.sealed + T.tear + cards.length * T.deal + 160 + downs * T.flip + (sparks ? T.hitHold : T.hold)) / speed;
  }
  var PACK_RARITY_LABEL = { Common: '● Common', Uncommon: '◆ Uncommon', Rare: '★ Rare', Mythic: '✦ Mythic' };
  function packEsc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // Which finishes show their art across the whole card. Owner 2026-10-18:
  // "a finish rarer than Full Art always shows its artwork across the whole
  // card ... a rarer card must never look smaller than a Full Art." Only
  // Standard and Foil are commoner than Full Art (S0-odds-2's shine slot:
  // Full Art 9%, Glitch 4%, Alt Art 3%, the rest rarer still), so every
  // other finish is full bleed: Full Art, Alt Art, Glitch, the secret
  // illustrations, Gold, Prototype (and a prize copy) and Zero-Day.
  function packFullBleed(reveal) { return reveal !== 'plain' && reveal !== 'foil'; }
  // The rules box. A modal ("choose one") card prints its modes, each with
  // its name and its own rules text, under CHOOSE ONE: its abilities list
  // holds only what the modes share, which is nothing on the Zero-Day cards.
  function packRulesHtml(f) {
    var modes = f.modes || [];
    var body = f.text.map(function (t) { return '<p>' + packEsc(t) + '</p>'; }).join('');
    if (modes.length) body += '<p class="choose">CHOOSE ONE</p>' + modes.map(function (m) { return '<p class="mode"><b>' + packEsc(m.name) + '</b> ' + packEsc(m.text) + '</p>'; }).join('');
    return '<div class="text' + (modes.length ? ' modal' : '') + '">' + body + (f.flavor ? '<p class="flav">' + packEsc(f.flavor) + '</p>' : '') + '</div>';
  }
  // One card face, under the owner-approved layout
  // (render/reference/card-text-layout.html). settled: the card already
  // wears its finish's look (face up, or after its reveal); a card still to
  // be revealed turns over showing its plain face first. setCode names the
  // set on a Prototype's foil line.
  // An agent's signature card (render session 28) is reveal 'signature': a
  // full-bleed white-gold face whose number reads "PR-001 · 1 OF 1". With
  // c.artPending (the pick screen, before the store draws the card's
  // art-pool piece) its art window shows that the piece is still to come.
  function packFaceHtml(c, opts, setCode) {
    opts = opts || {};
    var f = c.face, settled = !!opts.settled, sig = c.reveal === 'signature';
    var variant = c.reveal === 'altArt' ? 'alt' : c.reveal === 'secret' ? 'illustration' : sig ? 'signature' : '';
    var cls = 'face faction-' + f.faction + (settled && packFullBleed(c.reveal) ? ' full' : '') + (settled && c.reveal === 'gold' ? ' goldframe' : '') + (settled && c.reveal === 'glitch' ? ' corrupt' : '') + (settled && c.reveal === 'zeroDay' ? ' zdface' : '') + (settled && sig ? ' sigface' : '') + (c.prototype ? ' proto' : '') + (f.modes && f.modes.length ? ' modal' : '');
    var type = f.type === 'Reserved' ? 'Zero-Day · Reserved' : f.type + ' · ' + f.faction;
    var number = c.prototype ? '<span class="foiltext">PROTOTYPE · ' + packEsc(setCode || 'S0') + '</span>' : packEsc(c.collectorNumber) + (c.finish === 'glitch' ? ' ░' : '') + (sig ? '<span class="oneof"> · 1 OF 1</span>' : '');
    var mark = c.reveal === 'altArt' ? 'ALT ART' : c.reveal === 'glitch' ? 'GL1TCH' : c.reveal === 'secret' ? 'SECRET' : c.reveal === 'zeroDay' ? 'ZERO-DAY' : sig ? 'SIGNATURE' : '';
    return '<div class="' + cls + '">' +
      '<div class="art">' + (c.artPending ? packArtPendingSvg() : packArtSvg(f, variant)) + '</div>' +
      '<div class="head"><span class="name">' + packEsc(f.name) + '</span>' + (f.cost === null ? '' : '<span class="cost">' + f.cost + '</span>') + '</div>' +
      (mark ? '<span class="mark">' + mark + '</span>' : '') +
      '<div class="type"><span>' + packEsc(type) + '</span><span class="rar">' + PACK_RARITY_LABEL[f.rarity] + '</span></div>' +
      packRulesHtml(f) +
      (f.attack === null ? '' : '<div class="stats"><span class="atk">' + f.attack + '</span><span class="hp">' + f.health + '</span></div>') +
      (c.prototype ? '<span class="plate' + (settled ? '' : ' pending') + '">' + c.prototype.serial + '/' + c.prototype.runSize + '</span>' : '') +
      '<div class="foot"><span class="setno"><svg><use href="#setsym"/></svg>' + number + '</span><span>' + (sig ? 'Signature · S0' : 'Season 0') + '</span></div>' +
      '</div>';
  }
  // The rules text's fit (render session 26). A face's text box is a fixed
  // share of the card, so a long card's flavor line was cut off at the
  // bottom, or ran under the attack/health boxes. The text steps down in
  // size until it fits its box and its last line clears those boxes. The
  // step is a share of the card-relative size (--fit), so the fit holds at
  // every card size; most cards keep step 1.
  var PACK_FIT_STEPS = [1, 0.93, 0.86, 0.8, 0.74, 0.68];
  function packTextCrowded(t, stats) {
    if (t.scrollHeight > t.clientHeight + 1) return true;
    var last = t.lastElementChild;
    if (!stats || !last) return false;
    var s = stats.getBoundingClientRect(), range = document.createRange();
    range.selectNodeContents(last);
    var rects = range.getClientRects();
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (r.width > 0 && r.right > s.left && r.left < s.right && r.bottom > s.top + 1 && r.top < s.bottom) return true;
    }
    return false;
  }
  // The name's fit (render session 28): a long name steps its size down
  // until it fits beside the cost, instead of being cut off with "...". An
  // agent's signature card is all about its one-of-a-kind name, and the
  // generator's names run up to 30 characters.
  var PACK_NAME_FIT_STEPS = [1, 0.92, 0.85, 0.78, 0.72, 0.66];
  function packFitName(face) {
    var n = face.querySelector('.name');
    if (!n || !n.clientWidth) return 0;
    // The text's own width against its box, both measured on screen (so a
    // scaled card compares like for like); scrollWidth rounds, and a name a
    // fraction of a pixel too wide still gets its "...".
    var range = document.createRange();
    range.selectNodeContents(n);
    for (var i = 0; i < PACK_NAME_FIT_STEPS.length; i++) {
      n.style.setProperty('--nfit', String(PACK_NAME_FIT_STEPS[i]));
      if (range.getBoundingClientRect().width <= n.getBoundingClientRect().width + 0.25) break;
    }
    return Number(n.style.getPropertyValue('--nfit'));
  }
  function packFitText(face) {
    packFitName(face);
    var t = face.querySelector('.text');
    if (!t || !t.clientHeight) return 0;
    var stats = face.querySelector('.stats');
    for (var i = 0; i < PACK_FIT_STEPS.length; i++) {
      t.style.setProperty('--fit', String(PACK_FIT_STEPS[i]));
      if (!packTextCrowded(t, stats)) break;
    }
    return Number(t.style.getPropertyValue('--fit'));
  }
  // Fits every face as it is put on the page, wherever that happens (the
  // stack, a reveal, the ten-pack row, a summary tile, the viewer).
  function packFitWatch(root) {
    function fitIn(n) {
      if (n.nodeType !== 1) return;
      if (n.classList.contains('face')) packFitText(n);
      n.querySelectorAll('.face').forEach(packFitText);
    }
    fitIn(root);
    if (window.MutationObserver) new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(fitIn); }); }).observe(root, { childList: true, subtree: true });
  }
  // A small seeded generator for the placeholder art (mulberry32).
  function packRng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // A signature card's placeholder art, seeded from its art-pool piece (two
  // cards that drew the same piece share it, as the pool means): a figure
  // of light standing in rings, over a sky in the piece's own hue. Any hue,
  // not the faction's: every signature card is Neutral, so the hue is what
  // tells one piece from another.
  function packSignatureArt(face, rnd) {
    var hue = face.visualSeed % 360, W = 100, H = 76, out = [];
    function hsl(h, s, l, a) { return 'hsla(' + Math.round(((h % 360) + 360) % 360) + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')'; }
    var gid = 'sg' + face.visualSeed + '-' + face.visualPattern;
    out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">');
    out.push('<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + hsl(hue, 55, 14) + '"/><stop offset="0.6" stop-color="' + hsl(hue + 30, 60, 30) + '"/><stop offset="1" stop-color="' + hsl(45, 80, 70) + '"/></linearGradient>' +
      '<radialGradient id="' + gid + 'g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff8e0" stop-opacity="0.95"/><stop offset="1" stop-color="#fff0c2" stop-opacity="0"/></radialGradient></defs>');
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#' + gid + ')"/>');
    // A horizon grid, the 90s floor running off to the vanishing point.
    for (var gy = 0; gy < 7; gy++) { var yy = 58 + gy * gy * 0.6; out.push('<line x1="0" y1="' + yy.toFixed(1) + '" x2="' + W + '" y2="' + yy.toFixed(1) + '" stroke="' + hsl(hue + 180, 90, 75, 0.25) + '" stroke-width="0.5"/>'); }
    for (var gx = -60; gx <= 160; gx += 14) out.push('<line x1="50" y1="56" x2="' + gx + '" y2="' + H + '" stroke="' + hsl(hue + 180, 90, 75, 0.2) + '" stroke-width="0.5"/>');
    var cx = 42 + rnd() * 16, cy = 32;
    out.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy + '" r="30" fill="url(#' + gid + 'g)" opacity="0.55"/>');
    // Rings: arcs with gaps, each turned its own way.
    var rings = 3 + Math.floor(rnd() * 3);
    for (var i = 0; i < rings; i++) {
      var r = 9 + i * 5.5, gap = 0.15 + rnd() * 0.5, off = rnd() * 6.283, a0 = off, a1 = off + 6.283 * (1 - gap);
      var x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
      out.push('<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 1 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + '" fill="none" stroke="' + hsl(45, 100, 88, 0.75 - i * 0.1) + '" stroke-width="' + (i === 0 ? 1.2 : 0.7) + '"/>');
    }
    // The figure: a shoulders-and-head silhouette made of light, its build
    // from the seed.
    var sw = 13 + rnd() * 6, hr = 4.6 + rnd() * 1.6;
    out.push('<path d="M' + (cx - sw).toFixed(1) + ' 60 Q' + (cx - sw * 0.85).toFixed(1) + ' ' + (cy + 9).toFixed(1) + ' ' + cx.toFixed(1) + ' ' + (cy + 7).toFixed(1) + ' Q' + (cx + sw * 0.85).toFixed(1) + ' ' + (cy + 9).toFixed(1) + ' ' + (cx + sw).toFixed(1) + ' 60 Z" fill="' + hsl(hue, 40, 8, 0.92) + '" stroke="#fff0c2" stroke-width="0.6"/>');
    out.push('<circle cx="' + cx.toFixed(1) + '" cy="' + (cy - 1).toFixed(1) + '" r="' + hr.toFixed(1) + '" fill="' + hsl(hue, 40, 8, 0.95) + '" stroke="#fff0c2" stroke-width="0.6"/>');
    // Circuit light running down from the head into the shoulders.
    for (var t = 0; t < 5; t++) { var tx = cx + (rnd() - 0.5) * sw * 1.4; out.push('<polyline points="' + cx.toFixed(1) + ',' + (cy + 7).toFixed(1) + ' ' + tx.toFixed(1) + ',' + (cy + 12 + rnd() * 6).toFixed(1) + ' ' + tx.toFixed(1) + ',60" fill="none" stroke="' + hsl(45, 100, 80, 0.55) + '" stroke-width="0.5"/>'); }
    out.push('</svg>');
    return out.join('');
  }
  var PACK_FACTION_HUE = { Cortex: 196, Aegis: 24, Swarm: 100, Null: 285, Neutral: 45 };
  // The placeholder art: a generative frame from the card's own attributes
  // (DESIGN.md: "driven by card attributes ... explicitly NOT an emoji or
  // glyph on a flat background"). Faction sets the palette, the card id's
  // seed the circuit traces and offsets, the type the central motif. 'alt'
  // is the Alt Art composition (the motif large and off centre, the palette
  // turned); 'illustration' a painted scene (layered ridges under a
  // sun disc) for the secret illustrations, until the art pass paints them.
  // The art window of a signature card on the pick screen: its art-pool
  // piece is drawn by the store only when the card is made, so there is no
  // picture yet, only the empty frame waiting for one.
  function packArtPendingSvg() {
    // Drawn for the whole card (a signature face is full bleed), the
    // waiting frame where the art window would be.
    var out = ['<svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="140" fill="#0b0d14"/>'];
    for (var x = 0; x <= 100; x += 8) out.push('<line x1="' + x + '" y1="0" x2="' + x + '" y2="140" stroke="rgba(255,240,194,0.07)" stroke-width="0.4"/>');
    for (var y = 0; y <= 140; y += 8) out.push('<line x1="0" y1="' + y + '" x2="100" y2="' + y + '" stroke="rgba(255,240,194,0.07)" stroke-width="0.4"/>');
    out.push('<rect x="22" y="24" width="56" height="44" rx="2" fill="none" stroke="rgba(255,240,194,0.4)" stroke-width="0.6" stroke-dasharray="2.4 1.6"/>');
    out.push('<text x="50" y="44" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="4.6" font-weight="700" letter-spacing="0.6" fill="rgba(255,240,194,0.75)">ART PIECE</text><text x="50" y="51" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="3.4" fill="rgba(255,240,194,0.5)">DRAWN WHEN MADE</text></svg>');
    return out.join('');
  }
  function packArtSvg(face, variant) {
    var rnd = packRng(face.visualSeed * 7919 + face.visualPattern * 104729 + (variant === 'alt' ? 77 : variant === 'illustration' ? 991 : 0));
    var hue = (PACK_FACTION_HUE[face.faction] || 200) + (face.visualSeed % 40) - 20 + (variant === 'alt' ? 140 : 0);
    var light = face.faction === 'Neutral' ? 62 : 52;
    function hsl(h, s, l, a) { return 'hsla(' + Math.round(((h % 360) + 360) % 360) + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')'; }
    var W = 100, H = 76, out = [];
    out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">');
    // The gradient's id is page-wide, so it is named by what draws it: with
    // one shared id, every card on the page painted the first card's
    // background (render session 25 found it in the ten-pack row).
    var gid = 'pa' + face.visualSeed + '-' + face.visualPattern + '-' + (variant || 'n') + '-' + Math.round(hue);
    out.push('<defs><radialGradient id="' + gid + '" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="' + hsl(hue, 70, light + 8) + '"/><stop offset="0.55" stop-color="' + hsl(hue + 25, 65, 22) + '"/><stop offset="1" stop-color="' + hsl(hue + 40, 60, 8) + '"/></radialGradient></defs>');
    out.push('<rect width="' + W + '" height="' + H + '" fill="url(#' + gid + ')"/>');
    if (variant === 'signature') return packSignatureArt(face, rnd);
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
  var bd = document.getElementById('bd'), flashEl = document.getElementById('flash');
  stage.classList.add('has-bd');
  var t0 = performance.now();
  // The backdrop's rung (render 58): the sealed pack's tell, eased in.
  function setBackdrop(rung) {
    var b = TM.backdrops[rung] || TM.backdrops.calm;
    bd.style.setProperty('--b1', b.core); bd.style.setProperty('--b2', b.mid); bd.style.setProperty('--b3', b.rim);
    bd.style.setProperty('--bg2', b.glow); bd.style.setProperty('--pm', b.pulseMs + 'ms'); bd.style.setProperty('--pa', String(b.pulse));
    bd.setAttribute('data-rung', rung);
    return b;
  }
  // The page's state, and a log of every beat, for the headless check.
  // tilt: the card that follows the light (only once it has landed, so a
  // flip is never pulled off course).
  // mode: 'single' (one pack) or 'bulk' (a ten-pack open: bulk is which
  // one, bp the pack in it). cur is the pack being revealed either way.
  var S = { mode: 'single', pack: 0, bulk: -1, bp: -1, cur: null, phase: 'shelf', i: 0, busyUntil: 0, revealed: {}, tilt: -1, layers: [], flares: [], room: 0, log: [], timers: [], speed: 1, skipping: false };
  window.__pack = S;
  function log(kind, o) { var e = { kind: kind, t: Math.round(performance.now() - t0), mode: S.mode, pack: S.pack, bulk: S.bulk, bp: S.bp }; for (var k in o) e[k] = o[k]; S.log.push(e); }
  function later(fn, ms) { var id = setTimeout(fn, REDUCE ? Math.min(ms, 120) : ms); S.timers.push(id); return id; }
  // Cancelling the timers also cancels the ones that would have taken a
  // reveal's overlays (the wash, the secret number, the Jackpot banner) off
  // the stage, so they go here too.
  function clearTimers() { S.timers.forEach(clearTimeout); S.timers = []; stage.querySelectorAll('.wash, .callout, .banner').forEach(function (e) { e.remove(); }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function stopLayers() {
    S.layers.forEach(function (l) { l.stop(); }); S.layers = [];
    S.flares.forEach(function (e) { e.classList.add('out'); setTimeout(function () { e.remove(); }, 320); }); S.flares = [];
  }
  // o: the recipe's options (pitch, stage, weight), and lift: true for a
  // sound that stays up while the room is ducked (the build's own).
  function sfx(kind, faction, tier, o) { if (window.SND) SND.play(kind, faction || 'Neutral', tier || 'normal', null, o); }

  packFitWatch(document.body);

  // ---------- sound ----------
  // On the owner website the setting is the account's (the host's sound, a
  // { read, write } store the website hands over); standalone, the browser's.
  SND.mount(document.getElementById('btn-sound'), document.getElementById('sound-vol'), DATA.site ? packSiteSoundStore() : undefined);

  // ---------- the picker and footer ----------
  var picker = document.getElementById('picker');
  DATA.packs.forEach(function (p, i) {
    var b = document.createElement('button');
    b.textContent = (i + 1) + '. ' + p.label;
    b.setAttribute('data-pack', i);
    b.addEventListener('click', function () { openPack(i); });
    picker.appendChild(b);
  });
  DATA.bulks.forEach(function (p, i) {
    var b = document.createElement('button');
    b.className = 'ten';
    b.textContent = '×10 ' + p.label;
    b.setAttribute('data-bulk', i);
    b.addEventListener('click', function () { openBulk(i); });
    picker.appendChild(b);
  });
  function markPicker() {
    Array.prototype.forEach.call(picker.children, function (b) {
      var on = S.phase !== 'shelf' && (S.mode === 'bulk' ? b.getAttribute('data-bulk') === String(S.bulk) : b.getAttribute('data-pack') === String(S.pack));
      b.classList.toggle('on', on);
    });
  }
  function footer() {
    var r = S.cur, foot = document.getElementById('foot');
    if (S.mode === 'bulk') {
      var B = DATA.bulks[S.bulk].reveal;
      foot.innerHTML = 'A real ten-pack open from the economy store (openPacks, 10 at once): seeds <b>' + B.packs[0].seed + '-' + B.packs[B.packs.length - 1].seed + '</b>, odds <b>' + esc(B.packs[0].oddsVersion) + '</b>. Each pack is its own opening; the reveal only shows what was rolled. Placeholder card art until the art pass.';
      return;
    }
    foot.innerHTML = 'A real opening from the economy store: seed <b>' + r.seed + '</b>, odds <b>' + esc(r.oddsVersion) + '</b>. The reveal only shows what was rolled; nothing on this page rolls anything. Placeholder card art until the art pass.';
  }

  // ---------- card faces ----------
  var RAR = PACK_RARITY_LABEL;
  function faceHtml(c, opts) { return packFaceHtml(c, opts, S.cur ? S.cur.setCode : 'S0'); }
  function backHtml() { return '<div class="back"><div class="bl">AI·TCG</div><svg class="bs"><use href="#setsym"/></svg></div>'; }

  // ---------- the shelf ----------
  function shelf() {
    clearTimers(); stopLayers(); S.phase = 'shelf'; markPicker(); setBackdrop('calm');
    skipBtn.hidden = true; counter.textContent = ''; dim.style.opacity = 0;
    hint.innerHTML = 'Pick a pack to open. Each one is a real opening.';
    bulkControls(false);
    scene.innerHTML = '<div class="shelf-wrap"><h3>One pack</h3><div class="shelf">' + DATA.packs.map(function (p, i) { return '<button data-i="' + i + '"><div class="mp"></div>' + (i + 1) + '. ' + esc(p.label) + '</button>'; }).join('') + '</div>' +
      (DATA.bulks.length ? '<h3>Ten at once</h3><div class="shelf">' + DATA.bulks.map(function (p, i) { return '<button data-b="' + i + '"><div class="mp ten"><i></i><i></i><i></i></div>×10 ' + esc(p.label) + '</button>'; }).join('') + '</div>' : '') + '</div>';
    scene.querySelectorAll('.shelf button[data-i]').forEach(function (b) { b.addEventListener('click', function () { openPack(Number(b.getAttribute('data-i'))); }); });
    scene.querySelectorAll('.shelf button[data-b]').forEach(function (b) { b.addEventListener('click', function () { openBulk(Number(b.getAttribute('data-b'))); }); });
    log('shelf', {});
  }

  // ---------- the sealed pack and the tear ----------
  function openPack(i) {
    clearTimers(); stopLayers(); zd.hidden = true; zd.className = 'zd';
    S.mode = 'single'; S.pack = i; S.bulk = -1; S.bp = -1; S.cur = DATA.packs[i].reveal;
    bulkControls(false);
    sealed(DATA.packs[i].label);
  }
  // The sealed pack S.cur, waiting to be torn: a single pack, or a big pull
  // inside a ten-pack open.
  function sealed(label) {
    S.phase = 'pack'; S.i = 0; S.revealed = {}; S.busyUntil = 0;
    markPicker(); footer();
    var r = S.cur;
    skipBtn.hidden = true; counter.textContent = ''; dim.style.opacity = 0;
    // The tell (render 58): the backdrop takes the pack's rung; the light
    // leaking through the cut is its glow.
    var tell = r.tell || { backdrop: 'calm', backdropRung: 0, rung: 0, underPromise: false, best: 'plain', burst: { colour: '#bfe3ff', faction: '#bfe3ff', size: 0.35, rung: 'calm' } };
    var bdl = setBackdrop(tell.backdrop);
    log('tells', { backdrop: tell.backdrop, backdropRung: tell.backdropRung, rung: tell.rung, underPromise: tell.underPromise, best: tell.best });
    // The printed count is always the pack's five: a Prototype's bonus 6th
    // card is a surprise, never printed on the wrapper (render 58 fixed the
    // sealed pack reading "6 CARDS" for one).
    var wrap = '<div class="wrap"><div class="pa">' + packPlateSvg(r.setCode) + '</div><div class="crimp t"></div><div class="logo">AI·TCG</div><div class="emb"><svg><use href="#setsym"/></svg></div><div class="set">SEASON ZERO</div><div class="meta">5 CARDS · ' + esc(r.setCode) + '</div><div class="crimp b"></div></div>';
    var ripSvg = '<svg viewBox="-10 -10 20 20"><path d="M-6 -7 L-1 -3 L-5 0 L-1 3 L-6 7" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="bevel"/><circle r="2.4" fill="#fff"/></svg>';
    scene.innerHTML = '<div class="pack" id="pack" tabindex="0" role="button" aria-label="Sealed Season Zero pack. Drag across the top to tear it open, or tap."><div class="lean"><div class="tilt"><div class="half top">' + wrap + '</div><div class="half body">' + wrap + '</div><div class="half flap">' + wrap + '</div><div class="strip"></div><div class="leak"></div><div class="cutline"><i id="cutp"></i></div><div class="rip">' + ripSvg + '</div><span class="tab">TEAR</span><div class="grip"></div><div class="finger"></div></div></div></div>';
    hint.innerHTML = 'Drag along the TEAR strip to open it, or tap<br>Hold and drag the pack to tilt it';
    var pack = document.getElementById('pack'), lean = pack.querySelector('.lean'), tilt = pack.querySelector('.tilt'), cutp = document.getElementById('cutp');
    pack.style.setProperty('--leak', bdl.glow);
    var shimmer = FXGL.layer(tilt, 'pack', { amt: 1, seed: S.pack + S.bp + 2 });
    if (shimmer) S.layers.push(shimmer); else pack.classList.add('fx-css-pack');
    var drag = null, progress = 0, speed = 0, rip = null, quiet = 0, scraps = 0, scrapCarry = 0;
    S.tear = { progress: 0, peakSpeed: 0, scraps: 0, rip: false, ripPeak: 0, holds: 0 };
    function setTp(p) { progress = p; S.tear.progress = Math.round(p * 1000) / 1000; pack.style.setProperty('--tp', String(p)); cutp.style.width = (p * 100) + '%'; }
    function ripStop() { clearTimeout(quiet); if (rip) { S.tear.ripPeak = Math.max(S.tear.ripPeak, rip.peak ? rip.peak() : 0); rip.stop(); rip = null; } }
    // The mouse leans the pack a little as it moves over it (the brief's
    // beat 1), the foil catching the light; holding it leans it fully (hold
    // to tilt). A pack leans the same whatever it holds.
    var LEAN = REDUCE ? (TM.tilt.reducedHoverDeg || 0) : (TM.tilt.hoverDeg || 0);
    pack.addEventListener('pointermove', function (e) {
      var rc = pack.getBoundingClientRect();
      var x = (e.clientX - rc.left) / rc.width, y = (e.clientY - rc.top) / rc.height;
      if (!tilting() && shimmer) shimmer.ptr(x, y);
      if (!tilting() && !drag && LEAN && S.phase === 'pack' && e.pointerType !== 'touch') {
        var a = packTiltAngles(x, y, LEAN);
        lean.style.transform = 'rotateX(' + a.rx + 'deg) rotateY(' + a.ry + 'deg)';
      }
      if (drag && drag.top && S.phase === 'pack') {
        var now = performance.now(), dx = e.clientX - drag.lx, dt = now - drag.lt;
        drag.lx = e.clientX; drag.lt = now;
        speed = packDragSpeed(speed, dx, dt);
        S.tear.peakSpeed = Math.max(S.tear.peakSpeed, speed);
        var was = progress;
        setTp(packTearStep(progress, dx, rc.width));
        if (progress > was) {
          pack.classList.add('tearing'); pack.classList.remove('held-tear');
          // The rip, scrubbed to the drag's speed; still is silent.
          if (!rip && window.SND && SND.scrub) { rip = SND.scrub('Neutral'); if (rip) S.tear.rip = true; }
          if (rip) rip.set(speed);
          clearTimeout(quiet); quiet = setTimeout(function () { if (rip) rip.set(0); speed = 0; }, 70);
          // Scraps by the distance torn, carried over between small moves.
          scrapCarry += Math.max(0, dx);
          var n = packScrapCount(scrapCarry);
          scrapCarry -= n * 7;
          if (n) {
            var sr = stage.getBoundingClientRect();
            var hx = rc.left - sr.left + rc.width * progress, hy = rc.top - sr.top + rc.height * 0.16;
            PFX.scraps(hx, hy, n, bdl.glow);
            scraps += n; S.tear.scraps = scraps;
          }
        }
        if (progress >= 1) { drag = null; ripStop(); tear('drag'); }
      }
    });
    pack.addEventListener('pointerleave', function () { if (!drag && !tilting()) lean.style.transform = ''; });
    pack.addEventListener('pointerdown', function (e) {
      if (S.phase !== 'pack') return;
      pack.setPointerCapture && pack.setPointerCapture(e.pointerId);
      // A drag tears only along the top (the strip above the cut line and a
      // little below it); a press anywhere else can still be a tap.
      var prc = pack.getBoundingClientRect();
      drag = { x0: e.clientX, y0: e.clientY, lx: e.clientX, lt: performance.now(), at: performance.now(), top: (e.clientY - prc.top) / prc.height < 0.32 };
      pack.classList.add('held');
      lean.style.transform = '';
      // Below the strip, a hold or a drag tilts the pack (owner 2026-10-18).
      // Nothing about the tilt reads what the pack holds: a pack with a hit
      // leans exactly like one without.
      if (!drag.top) pressTilt(e, { el: tilt, box: pack, layers: function () { return shimmer ? [shimmer] : []; }, swipe: false, what: 'pack', can: function () { return S.phase === 'pack'; } });
      var f = pack.querySelector('.finger'); if (f) f.remove();
      log('tearStart', { from: S.tear.progress });
    });
    pack.addEventListener('pointerup', function (e) {
      if (!drag) return;
      if (upWasTilt) { drag = null; pack.classList.remove('held'); return; }
      var g = packGesture(e.clientX - drag.x0, e.clientY - drag.y0, performance.now() - drag.at);
      drag = null;
      ripStop();
      if (S.phase !== 'pack') return;
      if (g === 'tap') autoTear(cutp, 'tap');
      else if (progress < 1) {
        pack.classList.remove('held');
        // Let go part way: the tear holds where it is, and the hint says so.
        if (progress > 0) {
          pack.classList.remove('tearing'); pack.classList.add('held-tear'); S.tear.holds++;
          hint.innerHTML = 'The tear holds at ' + Math.round(progress * 100) + '%. Pull the rest of the strip to open it';
          log('tearHeld', { at: S.tear.progress });
        }
      }
    });
    pack.addEventListener('pointercancel', function () { drag = null; ripStop(); });
    pack.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); autoTear(cutp, 'key'); } });
    pack.focus({ preventScroll: true, focusVisible: false });
    log('packShown', { label: label });
  }
  // A tap (or Enter / Space) finishes the tear from wherever it stands.
  function autoTear(cutp, via) {
    if (S.phase !== 'pack') return;
    S.phase = 'tearing';
    var pack = document.getElementById('pack');
    var from = S.tear ? S.tear.progress : 0, ms = Math.max(160, TM.pack.autoTear * (1 - from));
    cutp.style.transition = 'width ' + ms + 'ms ease-in';
    cutp.style.width = '100%';
    if (pack) {
      pack.classList.add('tearing');
      pack.style.transition = '--tp ' + ms + 'ms ease-in';
      pack.style.setProperty('--tp', '1');
    }
    sfx('tear');
    later(function () { S.phase = 'pack'; tear(via); }, ms);
  }
  function tear(via) {
    if (S.phase !== 'pack') return;
    S.phase = 'torn';
    var r = S.cur, pack = document.getElementById('pack');
    pack.classList.add('torn');
    pack.style.setProperty('--tp', '1');
    stopLayers();
    if (via === 'drag') sfx('tear');
    hint.innerHTML = '';
    log('tear', { via: via, sparks: r.sparks, jackpot: r.jackpot });
    burst(pack, r.tell);
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

  // ---------- particles (one canvas, one frame loop) ----------
  // Render session 58: the sparks, the tear's foil scraps and the burst's
  // motes share one loop on the sparks canvas (it runs only while there is
  // something alive), so a scrap thrown during the tear and the burst at
  // its end never wipe each other. Each kind: a spark is a streak, a scrap
  // a spinning sliver of foil catching the light, a mote a soft glow.
  var PFX = (function () {
    var ps = [], run = null, last = 0, dpr = 1, ctx = null;
    function size() {
      ctx = sparksCanvas.getContext('2d');
      dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.round(sparksCanvas.clientWidth * dpr), h = Math.round(sparksCanvas.clientHeight * dpr);
      if (sparksCanvas.width !== w || sparksCanvas.height !== h) { sparksCanvas.width = w; sparksCanvas.height = h; }
    }
    function go() { if (!ctx) size(); if (!run) { last = performance.now(); run = requestAnimationFrame(step); } }
    function step(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, sparksCanvas.width, sparksCanvas.height);
      ctx.globalCompositeOperation = 'lighter';
      var keep = [];
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.life -= dt; if (p.life <= 0) continue; keep.push(p);
        p.vy += p.g * dt; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt;
        var al = Math.min(1, p.life * 1.6);
        if (p.k === 'spark') {
          ctx.globalAlpha = al; ctx.strokeStyle = p.c; ctx.lineWidth = p.s; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6); ctx.stroke();
        } else if (p.k === 'scrap') {
          p.rot += p.spin * dt;
          var flip = Math.abs(Math.cos(p.rot * 1.7));
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = al * (0.35 + 0.65 * flip);
          ctx.fillStyle = flip > 0.75 ? '#ffffff' : p.c;
          ctx.fillRect(-p.s, -p.s * 0.35 * (0.3 + flip), p.s * 2, p.s * 0.7 * (0.3 + flip));
          ctx.restore();
        } else {
          ctx.globalAlpha = al * 0.8;
          var gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 3);
          gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, p.c); gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 3, 0, Math.PI * 2); ctx.fill();
        }
      }
      ps = keep;
      if (ps.length) run = requestAnimationFrame(step);
      else { ctx.clearRect(0, 0, sparksCanvas.width, sparksCanvas.height); run = null; }
    }
    function add(p) { ps.push(p); }
    return {
      sparks: function (x, y, w, n) {
        size();
        var cols = ['#ffffff', '#fff1b8', '#f6d77a', '#9fe0ff', '#ffb3ec'];
        for (var i = 0; i < n; i++) add({ k: 'spark', x: x + Math.random() * w, y: y, vx: (Math.random() - 0.5) * 7, vy: -2 - Math.random() * 7, g: 14, drag: 1, life: 0.6 + Math.random() * 0.7, c: cols[i % cols.length], s: 1 + Math.random() * 2.2 });
        go();
      },
      scraps: function (x, y, n, tint) {
        if (REDUCE) n = Math.min(n, 1);
        var cols = ['#d8ecff', tint, '#ffd6f6', '#c8fff1', tint];
        for (var i = 0; i < n; i++) add({ k: 'scrap', x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 4, vx: 0.6 + Math.random() * 2.4, vy: -1.5 - Math.random() * 3.2, g: 9, drag: 0.985, life: 0.7 + Math.random() * 0.6, c: cols[i % cols.length], s: 2 + Math.random() * 2.6, rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 18 });
        go();
      },
      motes: function (x, y, n, c1, c2, reach) {
        if (REDUCE) n = Math.min(n, 12);
        for (var i = 0; i < n; i++) {
          var a = Math.random() * Math.PI * 2, v = (0.25 + Math.random()) * reach;
          add({ k: 'mote', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, g: 1.5, drag: 0.955, life: 0.5 + Math.random() * 0.8, c: i % 3 === 2 ? c2 : c1, s: 1.2 + Math.random() * 2.4 });
        }
        go();
      },
      alive: function () { return ps.length; },
    };
  })();
  function sparks(x, y, w, n) { PFX.sparks(x, y, w, n); }

  // ---------- the burst (render 58, the ceremony's beat 2) ----------
  // The tear finished: light bursts out of the cut in the best card's own
  // colour (the tell's burst, honest: never lowered, never raised), with
  // its faction's colour in the rim, a ring for anything above plain, a
  // screen flash and motes, all bigger with the best card's rung. Only
  // transforms and opacity animate (the GPU's), the motes on the canvas.
  function burst(pack, tell) {
    var b = (tell && tell.burst) || { colour: '#bfe3ff', faction: '#bfe3ff', size: 0.35, rung: 'calm' };
    var rung = tell ? tell.rung : 0;
    var plan = packBurstPlan(b.size, rung);
    var rc = pack.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    var x = rc.left - sr.left + rc.width / 2, y = rc.top - sr.top + rc.height * 0.16;
    function blob(cls, scale) {
      var e = document.createElement('div'); e.className = cls;
      e.style.left = x + 'px'; e.style.top = y + 'px';
      e.style.setProperty('--c1', b.colour); e.style.setProperty('--c2', b.faction);
      e.style.setProperty('--D', (scale * 10) + 'px'); e.style.setProperty('--d', plan.ms + 'ms');
      stage.appendChild(e);
      later(function () { e.remove(); }, plan.ms + 60);
      return e;
    }
    blob('burst', plan.scale);
    if (plan.ring) blob('shock', plan.scale * 1.25);
    flashEl.classList.remove('go'); void flashEl.offsetWidth;
    flashEl.style.setProperty('--fc1', b.colour); flashEl.style.setProperty('--fo', String(plan.flash)); flashEl.style.setProperty('--fd', plan.ms + 'ms');
    flashEl.style.setProperty('--fx', (x / Math.max(1, sr.width) * 100) + '%'); flashEl.style.setProperty('--fy', (y / Math.max(1, sr.height) * 100) + '%');
    flashEl.classList.add('go');
    PFX.motes(x, y, plan.motes, b.colour, b.faction, 2.4 + rung * 0.9);
    sfx('burst', tell ? tell.bestFaction : 'Neutral', rung >= 3 ? 'spectacle' : rung >= 1 ? 'normal' : 'subtle');
    log('burst', { colour: b.colour, faction: b.faction, rung: rung, scale: plan.scale, motes: plan.motes, flash: plan.flash, ring: plan.ring });
  }

  // ---------- the stack ----------
  function dealStack() {
    var r = S.cur;
    S.phase = 'cards'; S.i = 0;
    scene.innerHTML = '<div class="stack" id="stack"></div>';
    var stack = document.getElementById('stack');
    // Last card at the bottom, first on top.
    for (var k = r.cards.length - 1; k >= 0; k--) {
      var c = r.cards[k];
      var el = document.createElement('div');
      // Every card rises face down (render 60): a plain Common or Uncommon
      // snaps over as it reaches the top; a held card waits for a tap.
      var held = heldCard(c);
      el.className = 'cslot rise down' + (held ? ' glow held' : ' snap');
      el.setAttribute('data-k', k);
      el.style.animationDelay = (k * 40) + 'ms';
      el.innerHTML = (held ? '<div class="aura"></div>' : '') + '<div class="flipper"><div class="front">' + faceHtml(c, { settled: !held }) + '</div>' + backHtml() + '</div>';
      stack.appendChild(el);
    }
    layoutStack();
    skipBtn.hidden = false;
    skipBtn.textContent = S.mode === 'bulk' ? 'Skip this pack' : 'Skip to summary';
    S.busyUntil = performance.now() + TM.pack.rise;
    later(function () { stack.querySelectorAll('.cslot').forEach(function (e) { e.classList.remove('rise'); }); showTop(); }, TM.pack.rise);
    bindStack(stack);
  }
  function slotEl(k) { return document.querySelector('.cslot[data-k="' + k + '"]'); }
  function layoutStack() {
    var r = S.cur;
    for (var k = S.i; k < r.cards.length; k++) {
      var el = slotEl(k); if (!el) continue;
      var d = Math.min(4, k - S.i);
      el.style.zIndex = String(100 - k);
      el.style.transform = 'translateY(' + (d * 5) + 'px) scale(' + (1 - d * 0.025) + ')';
    }
  }
  function showTop() {
    var r = S.cur, c = r.cards[S.i];
    counter.textContent = (S.mode === 'bulk' ? 'Pack ' + (S.bp + 1) + ' · ' : '') + (S.i + 1) + ' / ' + r.cards.length;
    var slot = c.slot === 'shine' ? '<span class="slot">SHINE SLOT</span><br>' : c.slot === 'bonus' ? '<span class="slot bonus">BONUS 6TH CARD</span><br>' : '';
    var held = heldCard(c);
    if (held && !S.revealed[S.i]) hint.innerHTML = slot + 'Something special… tap to reveal';
    else hint.innerHTML = slot + nextCardHint(S.i);
    log('cardShown', { idx: S.i, faceDown: held, finish: c.finish, slot: c.slot, name: c.face.name, step: buildOf(c).step });
    if (!held) { snapFlip(S.i, c); announce.textContent = c.face.name; settleFx(S.i, c); S.tilt = S.i; }
    else sfx('flip', c.face.faction);
  }
  // ---------- the reveal escalation (render 60, the ceremony part 2) ----------
  // Each card carries its build (packOpening.ts revealBuildOf): a snap, or
  // the glow stages, the pauses, the slow flip and the hit, all sized by its
  // step on the reveal ladder. Old data without one (none is made any more)
  // falls back to the finish's flip.
  function buildOf(c) {
    if (c.build) return c.build;
    var t = TM.reveal[c.reveal] || { flip: 0, hold: 120 }, f = Math.max(150, t.flip);
    return { step: c.faceDown ? c.reveal : 'snap', weight: 0, held: !!c.faceDown, stages: 0, flipMs: f, dim: 0, duck: 1, flash: 0, shakePx: 0, shakeMs: 0, bass: null, motes: 0, moteReach: 0, ward: 'none', wardScale: 0, hold: t.hold, pitch: 1, timeline: { stages: [], flipAt: 0, landAt: f } };
  }
  function heldCard(c) { return !!buildOf(c).held; }
  function slotLabel(c) { return c.slot === 'shine' ? '<span class="slot">SHINE SLOT</span><br>' : c.slot === 'bonus' ? '<span class="slot bonus">BONUS 6TH CARD</span><br>' : ''; }
  // A plain Common or Uncommon: a quick flip as it reaches the top, each in
  // the pack a little higher than the last.
  function snapFlip(k, c) {
    var el = slotEl(k), b = buildOf(c);
    if (!el || !el.classList.contains('down')) return;
    el.querySelector('.flipper').style.transition = 'transform ' + b.flipMs + 'ms cubic-bezier(.2,.9,.35,1.15)';
    requestAnimationFrame(function () { el.classList.remove('down'); });
    // Never blocks a tap: quick taps through the plain cards fly them off
    // mid-flip (the s60 check caught a tap swallowed inside the 150 ms).
    sfx('flip', c.face.faction, 'normal', { pitch: b.pitch });
    log('snap', { idx: k, pitch: b.pitch, flipMs: b.flipMs });
  }
  // The room: dimmed and ducked while a held card builds, back after it.
  // roomUp(k) only lifts the room card k dimmed: a card's own "back up"
  // timer can still be pending when the next card has already started its
  // build (found by the s60 browser check: a plain Rare's 700 ms timer lit
  // the room halfway through the next card's glow).
  function roomDown(b, k) {
    S.roomFor = k;
    dim.style.transition = 'opacity ' + Math.max(250, Math.min(700, b.stageMs || 400)) + 'ms';
    dim.style.opacity = String(b.dim);
    S.room = b.dim || 0.001;
    if (window.SND && SND.duck) SND.duck(b.duck, 280);
  }
  function roomUp(k) {
    if (!S.room || (k !== undefined && k !== S.roomFor)) return;
    S.room = 0;
    dim.style.transition = 'opacity 600ms ease-out'; dim.style.opacity = '0';
    if (window.SND && SND.duck) SND.duck(1, 600);
    log('roomUp', {});
  }
  function glowStage(el, c, b, n, colour) {
    el.style.setProperty('--gc', colour);
    el.style.setProperty('--gn', String(n));
    el.style.setProperty('--gms', b.stageMs + 'ms');
    el.setAttribute('data-stage', String(n));
    sfx('riser', c.face.faction, 'normal', { stage: n, dur: b.stageMs / 1000 + 0.15, lift: true });
    log('glowStage', { idx: Number(el.getAttribute('data-k')), stage: n, colour: colour });
  }
  // The ward rings, tinted once per faction at load (the sheet is grey on
  // black: multiplied by the faction's colour, a little of the white kept
  // as the core), drawn additively.
  var WARD_TINT = {};
  Object.keys(DATA.wards || {}).forEach(function (f) {
    var img = new Image();
    img.onload = function () {
      try {
        var n = img.naturalWidth, cv = document.createElement('canvas'); cv.width = n; cv.height = n;
        var g = cv.getContext('2d');
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'multiply'; g.fillStyle = TM.build.factions[f] || '#ffffff'; g.fillRect(0, 0, n, n);
        g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.3; g.drawImage(img, 0, 0);
        WARD_TINT[f] = cv.toDataURL('image/png');
      } catch (e) { /* the drawn ring stands in */ }
    };
    img.src = DATA.wards[f];
  });
  function wardFlare(c, b, x, y, h, colour) {
    if (b.ward === 'none') return null;
    var src = WARD_TINT[c.face.faction] || null, size = Math.round(h * b.wardScale);
    var w = document.createElement('div');
    w.className = 'wflare ' + b.ward + (src ? '' : ' plain');
    w.style.left = x + 'px'; w.style.top = y + 'px';
    w.style.setProperty('--ws', size + 'px'); w.style.setProperty('--wc', colour);
    w.innerHTML = '<i></i>' + (b.ward === 'double' ? '<i class="r2"></i>' : '');
    if (src) Array.prototype.forEach.call(w.children, function (i) { i.style.backgroundImage = 'url(' + src + ')'; });
    stage.insertBefore(w, scene);
    S.flares.push(w);
    return { kind: b.ward, image: !!src, size: size };
  }
  // The hit as a held card lands: a flash in the top glow stage's colour,
  // the stage shaking, the bass, motes in the faction's colour, the ward.
  function hit(k, c, el, b) {
    el.classList.remove('charging', 'flipping');
    var rc = el.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    var x = rc.left - sr.left + rc.width / 2, y = rc.top - sr.top + rc.height / 2;
    var fc = TM.build.factions[c.face.faction] || TM.build.factions.Neutral;
    var st = b.timeline.stages, top = st.length ? st[st.length - 1].colour : fc;
    if (b.flash > 0) {
      flashEl.classList.remove('go'); void flashEl.offsetWidth;
      flashEl.style.setProperty('--fc1', top); flashEl.style.setProperty('--fo', String(b.flash)); flashEl.style.setProperty('--fd', Math.round(300 + 500 * b.weight) + 'ms');
      flashEl.style.setProperty('--fx', (x / Math.max(1, sr.width) * 100) + '%'); flashEl.style.setProperty('--fy', (y / Math.max(1, sr.height) * 100) + '%');
      flashEl.classList.add('go');
    }
    var shook = b.shakePx > 0 && !REDUCE;
    if (shook) {
      stage.style.setProperty('--sk', b.shakePx + 'px'); stage.style.setProperty('--skd', b.shakeMs + 'ms');
      stage.classList.remove('bshake'); void stage.offsetWidth; stage.classList.add('bshake');
      var shakeAnim = getComputedStyle(stage).animationName;
      later(function () { stage.classList.remove('bshake'); }, b.shakeMs + 40);
    }
    if (b.bass) sfx('bass', c.face.faction, b.bass, { weight: b.weight, lift: true });
    if (b.motes) PFX.motes(x, y, b.motes, fc, top, b.moteReach);
    var wf = wardFlare(c, b, x, y, rc.height, fc);
    log('hit', { idx: k, step: b.step, flash: b.flash, shakePx: shook ? b.shakePx : 0, shakeAnim: shook ? shakeAnim : '', bass: b.bass, motes: b.motes, moteColour: fc, flashColour: top, ward: wf });
  }
  // What a tap does after card k of the stack. A big pull inside a
  // ten-pack open goes back to the packs, not to a summary.
  function nextCardHint(k) {
    if (k < S.cur.cards.length - 1) return 'Swipe or tap for the next card';
    if (S.mode !== 'bulk') return 'Tap for the summary';
    return S.bp >= DATA.bulks[S.bulk].reveal.packs.length - 1 ? 'Tap for the summary' : 'Tap to carry on with the packs';
  }
  function bindStack(stack) {
    var drag = null;
    stack.addEventListener('pointerdown', function (e) {
      if (S.phase !== 'cards') return;
      var el = slotEl(S.i); if (!el) return;
      stack.setPointerCapture && stack.setPointerCapture(e.pointerId);
      drag = { x0: e.clientX, y0: e.clientY, at: performance.now(), el: el };
      // Hold to tilt, once the card has landed face up. A quick sideways
      // move is still the swipe; only a hold starts the tilt here.
      var k = S.i;
      pressTilt(e, { el: el.querySelector('.flipper'), box: el, layers: function () { return S.layers; }, swipe: true, what: 'card', can: function () { return S.phase === 'cards' && S.i === k && S.tilt === k; } });
    });
    stack.addEventListener('pointermove', function (e) {
      var el = slotEl(S.i); if (!el) return;
      var rc = el.getBoundingClientRect();
      var x = (e.clientX - rc.left) / rc.width, y = (e.clientY - rc.top) / rc.height;
      if (tilting()) return;
      setLight(x, y, false);
      var top = S.cur.cards[S.i];
      if (drag && (!heldCard(top) || S.revealed[S.i])) {
        var dx = e.clientX - drag.x0;
        if (Math.abs(dx) > 10 && canLeave()) { el.classList.add('dragging'); el.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx * 0.05) + 'deg)'; }
      }
    });
    stack.addEventListener('pointerup', function (e) {
      if (!drag) return;
      var d = drag; drag = null;
      d.el.classList.remove('dragging');
      if (upWasTilt) return;
      var g = packGesture(e.clientX - d.x0, e.clientY - d.y0, performance.now() - d.at);
      act(g === 'swipeRight' ? 'r' : g === 'swipeLeft' ? 'l' : g === 'tap' ? 'tap' : 'none');
    });
    stack.addEventListener('pointerleave', function () { if (!tilting()) setLight(0.5, 0.4, false); });
  }
  function canLeave() { return performance.now() >= S.busyUntil; }
  // A tap or a swipe on the top card: reveal it if it waits face down,
  // otherwise send it off (once its reveal has had its moment).
  function act(how) {
    if (S.phase !== 'cards') return;
    var r = S.cur, c = r.cards[S.i], el = slotEl(S.i);
    if (!el) return;
    if (heldCard(c) && !S.revealed[S.i]) { if (how !== 'none' && canLeave()) reveal(S.i); else layoutStack(); return; }
    if (how === 'none' || !canLeave()) { layoutStack(); return; }
    leave(how === 'r' ? 'r' : 'l');
  }
  function leave(dir) {
    var r = S.cur, el = slotEl(S.i);
    S.tilt = -1;
    el.classList.add(dir === 'r' ? 'gone-r' : 'gone-l');
    log('cardLeft', { idx: S.i, dir: dir });
    stopLayers(); roomUp();
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
    if (S.phase === 'bulk' && (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); bulkTap(-1, 'key'); }
  });
  skipBtn.addEventListener('click', function () { if (S.phase === 'cards') { log('skip', { at: S.i }); summary(); } });

  // ---------- the light: the pointer, or the device's tilt ----------
  var light = { x: 0.5, y: 0.4 };
  // rotate: the device's own tilt leans the card as before; a hovering
  // pointer only moves the light (the card leans only while held).
  function setLight(x, y, rotate) {
    if (tilting()) return;
    light.x = Math.max(0, Math.min(1, x)); light.y = Math.max(0, Math.min(1, y));
    S.layers.forEach(function (l) { l.ptr(light.x, light.y); });
    var el = slotEl(S.i);
    if (rotate && el && S.tilt === S.i && !el.classList.contains('dragging')) {
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
    setLight(0.5 + Math.max(-30, Math.min(30, e.gamma)) / 60, 0.5 + Math.max(-30, Math.min(30, e.beta - 35)) / 60, true);
  });

  // ---------- hold to tilt (owner 2026-10-18, as corrected) ----------
  // Press and hold a revealed card (or the sealed pack being opened), then
  // drag: it leans in 3D towards the finger, up to TM.tilt.maxDeg, as one
  // solid piece (no art depth), and the finish's shine follows the finger
  // as it follows the device's tilt. Letting go springs it back flat. A
  // release after a tilt is never a tap or a swipe. Reduced motion: a
  // smaller lean and a plain ease back, no spring.
  var TT = TM.tilt, TMAX = REDUCE ? TT.reducedMaxDeg : TT.maxDeg;
  var press = null, held = null, upWasTilt = false, swallowUntil = 0;
  S.tiltPeak = 0;
  function tilting() { return !!held; }
  // o: { el: what leans, box: what the finger is measured over, layers():
  // the shine layers to steer, swipe: a move is a swipe here, what: for the
  // log, can(): whether it may lean now }.
  function pressTilt(e, o) {
    if (press) clearTimeout(press.timer);
    var p = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, at: performance.now(), o: o, state: 'pending' };
    p.timer = setTimeout(function () { if (press === p && p.state === 'pending') holdNow(p); }, TT.holdMs);
    press = p;
  }
  function holdNow(p) {
    if (!p.o.can()) { p.state = 'move'; return; }
    p.state = 'tilt';
    held = { el: p.o.el, box: p.o.box, o: p.o, peak: 0, moves: 0 };
    held.el.classList.add('tilting');
    held.el.style.transition = 'transform ' + TT.followMs + 'ms linear';
    log('tiltStart', { what: p.o.what, after: Math.round(performance.now() - p.at) });
    leanTo(p.x, p.y);
  }
  function leanTo(cx, cy) {
    var rc = held.box.getBoundingClientRect();
    var x = (cx - rc.left) / rc.width, y = (cy - rc.top) / rc.height;
    var a = packTiltAngles(x, y, TMAX);
    held.el.style.transform = 'rotateX(' + a.rx + 'deg) rotateY(' + a.ry + 'deg)';
    held.peak = Math.max(held.peak, Math.abs(a.rx), Math.abs(a.ry)); held.moves++;
    var lx = Math.max(0, Math.min(1, x)), ly = Math.max(0, Math.min(1, y));
    held.o.layers().forEach(function (l) { l.ptr(lx, ly); });
  }
  function letGo() {
    var h = held; held = null;
    h.el.classList.remove('tilting');
    h.el.style.transition = 'transform ' + (REDUCE ? TT.reducedReturnMs + 'ms ease-out' : TT.springMs + 'ms cubic-bezier(.3,1.7,.5,1)');
    h.el.style.transform = '';
    S.tiltPeak = h.peak;
    log('tiltEnd', { what: h.o.what, peak: h.peak, moves: h.moves });
  }
  // The capture phase runs before the elements' own handlers, so they see
  // whether the release ended a tilt (upWasTilt) and ignore it.
  document.addEventListener('pointermove', function (e) {
    var p = press; if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (p.state === 'pending') {
      var st = packHoldState(p.x - p.x0, p.y - p.y0, performance.now() - p.at, p.o.swipe, TT);
      if (st === 'tilt') holdNow(p); else if (st === 'move') { p.state = 'move'; clearTimeout(p.timer); }
    } else if (p.state === 'tilt' && held) leanTo(p.x, p.y);
  }, true);
  function endPress() {
    var p = press; press = null; upWasTilt = false;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.state === 'tilt' && held) { upWasTilt = true; swallowUntil = performance.now() + 400; letGo(); }
  }
  // A new press is never part of the last tilt: its click goes through.
  document.addEventListener('pointerdown', function () { swallowUntil = 0; }, true);
  document.addEventListener('pointerup', endPress, true);
  document.addEventListener('pointercancel', function () { endPress(); upWasTilt = false; }, true);
  // A click straight after a tilt (the fan's, the viewer backdrop's) is
  // part of the tilt, not a tap.
  document.addEventListener('click', function (e) { if (performance.now() < swallowUntil) { swallowUntil = 0; e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', function (e) { if (press || held) e.preventDefault(); });

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
    return face ? finishLayer(face, c, k + 1) : null;
  }
  function finishLayer(face, c, seed) {
    var name = packFinishLayerName(c.reveal);
    return name ? addLayer(face, name, packFinishLayerAmt(c.reveal), seed) : null;
  }
  // A tap on a held card: the room drops, the back climbs its glow stages
  // with a pause after each (the last the longest), then it flips.
  function reveal(k) {
    var c = S.cur.cards[k], el = slotEl(k), b = buildOf(c);
    S.revealed[k] = true;
    el.classList.remove('glow');
    if (c.reveal === 'zeroDay') { zeroDay(k); return; }
    S.busyUntil = Infinity;
    var tl = b.timeline;
    log('build', { idx: k, step: b.step, stages: b.stages, flipAt: tl.flipAt, landAt: tl.landAt, dim: b.dim, duck: b.duck });
    roomDown(b, k);
    if (b.stages) el.classList.add('charging');
    hint.innerHTML = slotLabel(c) + '…';
    tl.stages.forEach(function (s, i) { later(function () { glowStage(el, c, b, i + 1, s.colour); }, s.at); });
    later(function () { flip(k, c, el, b); }, tl.flipAt);
  }
  function flip(k, c, el, b) {
    var t = { flip: b.flipMs, hold: b.hold };
    el.classList.add('flipping');
    var front = el.querySelector('.front');
    // The card turns over showing its plain face first; the finish arrives
    // as part of the reveal, not before it.
    front.innerHTML = faceHtml(c, { settled: false });
    var flipper = el.querySelector('.flipper');
    flipper.style.transition = 'transform ' + t.flip + 'ms ' + (b.weight >= 0.6 ? 'cubic-bezier(.45,0,.2,1)' : 'cubic-bezier(.3,.6,.3,1)');
    log('reveal', { idx: k, as: c.reveal, finish: c.finish, step: b.step, flipMs: t.flip });
    announce.textContent = c.face.name + (packFinishLabel(c.finish) ? ', ' + packFinishLabel(c.finish) : '');
    var face = front.querySelector('.face');
    if (c.reveal === 'glitch') glitchFlip(el, face, t.flip);
    if (c.reveal === 'secret') { el.style.transition = 'transform ' + t.flip + 'ms cubic-bezier(.45,0,.2,1)'; el.style.transform = 'translateY(-10px) scale(1.06)'; }
    sfx('flip', c.face.faction, 'normal', { lift: true });
    requestAnimationFrame(function () { el.classList.remove('down'); });
    later(function () { landed(k, c, el, face, t, b); }, t.flip);
    hint.innerHTML = slotLabel(c) + (packFinishLabel(c.finish) || PACK_RARITY_LABEL[c.face.rarity]);
  }
  function landed(k, c, el, face, t, b) {
    hit(k, c, el, b);
    S.busyUntil = performance.now() + t.hold;
    later(function () { roomUp(k); }, Math.max(700, t.hold));
    var tier = packRiseTier(c.reveal);
    if (c.reveal !== 'glitch' && c.reveal !== 'plain') sfx('rise', c.face.faction, tier, { lift: true });
    if (c.reveal === 'foil') { ramp(addLayer(face, 'foil', 0, k + 1), 0, 1, 500); wash('#bfe3ff'); }
    if (c.reveal === 'fullArt' || c.reveal === 'altArt') { face.classList.add('full'); ramp(addLayer(face, 'foil', 0, k + 1), 0, 0.55, 900); wash(c.reveal === 'altArt' ? '#ffb3ec' : '#bfe3ff'); }
    if (c.reveal === 'gold') {
      face.classList.add('full', 'goldframe'); ramp(addLayer(face, 'gold', 0, k + 1), 0, 1, 600); wash('#f6d77a');
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
      later(function () { co.classList.add('out'); el.style.transform = ''; later(function () { co.remove(); }, 500); }, t.hold);
    }
    if (c.reveal === 'prototype') {
      face.classList.add('full');
      ramp(addLayer(face, 'gold', 0, k + 1), 0, 0.5, 600); wash('#f6d77a');
      later(function () {
        var plate = face.querySelector('.plate'); if (plate) { plate.classList.remove('pending'); plate.classList.add('stamp'); }
        el.classList.add('shake'); sfx('stamp', c.face.faction, 'spectacle'); log('stamp', { serial: c.prototype && c.prototype.serial });
      }, 220);
    }
    S.tilt = k;
    log('landed', { idx: k, as: c.reveal });
    hint.innerHTML += '<br>' + nextCardHint(k);
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
        r.remove(); c.remove(); face.classList.add('corrupt', 'full'); flipper.style.transform = '';
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
    var k = S.i, pack = S.pack, bp = S.bp;
    (function burst() {
      if (S.pack !== pack || S.bp !== bp || S.i !== k || S.phase !== 'cards') return;
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
    var r = S.cur, c = r.cards[k], el = slotEl(k), Z = TM.zeroDay;
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
        hit(k, c, el, buildOf(c));
        later(function () { zd.hidden = true; zd.className = 'zd'; stage.classList.remove('shake'); if (bg) { bg.stop(); } }, 800);
        S.busyUntil = performance.now() + Z.arrive + TM.reveal.zeroDay.hold;
        later(function () { el.style.transition = ''; S.tilt = k; }, Z.arrive);
        announce.textContent = c.face.name + ', Zero-Day';
        hint.innerHTML = '<span class="slot">SHINE SLOT</span><br>ZERO-DAY<br>' + nextCardHint(k);
      }
    }, Z.black);
  }

  // ---------- the summary ----------
  function summary() {
    clearTimers(); stopLayers(); roomUp(); dim.style.opacity = 0;
    // A big pull inside a ten-pack open: back to the fast sequence.
    if (S.mode === 'bulk') { skipBtn.hidden = true; log('bulkFullDone', { cards: S.i }); bulkResume(); return; }
    S.phase = 'summary'; skipBtn.hidden = true; counter.textContent = ''; hint.innerHTML = '';
    var r = S.cur;
    var hits = r.cards.filter(function (c) { return c.hit; }).length;
    var tiles = r.cards.map(function (c, i) { return tileHtml(c, i, ''); }).join('');
    // After the reveal only, never before: the pack and the tear look the
    // same whether pity or the starter guarantee applied.
    var pity = r.pity.fullArt || r.pity.mythic || r.starterHit ? '<div class="sub">' + (r.pity.fullArt ? 'Pity: this pack was due a hit. ' : '') + (r.starterHit ? 'Starter guarantee: this pack was due a hit. ' : '') + (r.pity.mythic ? 'Pity: this pack was due a Mythic.' : '') + '</div>' : '';
    scene.innerHTML = '<div class="summary"><h2>PACK COMPLETE</h2><p class="sub">' + r.cards.length + ' cards · ' + (hits ? hits + ' hit' + (hits > 1 ? 's' : '') : 'no hits') + (r.jackpot ? ' · Jackpot pack' : '') + '</p>' + pity +
      '<div class="grid">' + tiles + '</div><p class="points">+<b>' + r.packPoints + '</b> pack points</p>' +
      '<div class="btns"><button class="pri" id="again">Open another</button><button id="done">Done</button></div></div>';
    // A flow around the packs (the first-time page) puts its own buttons
    // here; otherwise "Open another" and "Done".
    if (S.onSummary) S.onSummary(scene.querySelector('.btns'), r);
    else {
      document.getElementById('again').addEventListener('click', function () { openPack((S.pack + 1) % DATA.packs.length); });
      document.getElementById('done').addEventListener('click', shelf);
    }
    bindViewer(r.cards);
    log('summary', { cards: r.cards.map(function (c) { return { name: c.face.name, finish: c.finish, isNew: c.isNew }; }), packPoints: r.packPoints });
  }

  // A card face that is settled and wears its finish's CSS look (a summary
  // tile, a card in a ten-pack row: too many for a shader each).
  function settledFaceHtml(c) {
    var name = packFinishLayerName(c.reveal);
    return faceHtml(c, { settled: true }).replace('class="face ', 'class="face ' + (name ? 'fx-css-' + name + ' ' : ''));
  }
  // One summary tile: a revealed card, or a ten-pack tile (count, packs).
  function tileHtml(c, i, extra) {
    var lab = packFinishLabel(c.finish);
    var where = c.packs ? ' · ' + packListLabel(c.packs) : '';
    var cap = (lab ? '<span class="fin' + (c.hit ? ' hit' : '') + '">' + lab + '</span><br>' : '') + esc(c.face.name) + '<br>' + esc(c.prototype ? 'serial ' + c.prototype.serial + ' of ' + c.prototype.runSize : c.collectorNumber) + where + ' · x' + c.ownedAfter + ' owned';
    return '<div class="tile' + extra + '" style="--i:' + Math.min(i, 14) + '" data-ti="' + i + '" data-finish="' + c.finish + '"' + (c.count ? ' data-count="' + c.count + '"' : '') + '>' + (c.isNew ? '<span class="new">NEW</span>' : '') + (c.count > 1 ? '<span class="cnt">×' + c.count + '</span>' : '') + '<div class="mini">' + settledFaceHtml(c) + '</div><div class="cap">' + cap + '</div></div>';
  }

  // ---------- ten packs at once ----------
  // owner 2026-10-05 / 2026-10-18: a summary grid at the end, full reveals
  // only for the big pulls (the store's fullReveal: Gold, Prototype, secret,
  // Zero-Day, Jackpot). Owner 2026-10-18 feel notes: nothing plays on its
  // own. Each tap or swipe tears the next pack, its cards deal into the row
  // and the owner taps to flip the face-down ones, then moves on. A big pull
  // is torn the same way, and its full reveal plays right there: no pause,
  // no second tear. "Auto" (off by default) is the old automatic sequence,
  // and the 1x / 2x / 4x speeds apply to it.
  var speedEl = document.getElementById('speed'), bskip = document.getElementById('bskip'), bauto = document.getElementById('bauto');
  var SPEED_KEY = 'aitcg.packSpeed', AUTO_KEY = 'aitcg.packAuto';
  S.auto = false; S.row = null; S.nextAt = 0;
  try { var sv = Number(localStorage.getItem(SPEED_KEY)); if (TM.speeds.indexOf(sv) >= 0) S.speed = sv; } catch (e) {}
  try { S.auto = localStorage.getItem(AUTO_KEY) === '1'; } catch (e) {}
  TM.speeds.forEach(function (v) {
    var b = document.createElement('button');
    b.textContent = v + '×'; b.setAttribute('data-speed', v);
    b.addEventListener('click', function (e) { e.stopPropagation(); setSpeed(v); });
    speedEl.appendChild(b);
  });
  // The CSS beats (--sp) run at the speed only in Auto; tapping runs at 1x.
  function paceCss() { stage.style.setProperty('--sp', String(S.auto ? S.speed : 1)); }
  function setSpeed(v) {
    S.speed = v;
    try { localStorage.setItem(SPEED_KEY, String(v)); } catch (e) {}
    paceCss();
    Array.prototype.forEach.call(speedEl.children, function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-speed')) === v)); });
    log('speed', { speed: v });
  }
  setSpeed(S.speed);
  bauto.addEventListener('click', function (e) { e.stopPropagation(); setAuto(!S.auto); });
  function setAuto(on) {
    S.auto = on;
    try { localStorage.setItem(AUTO_KEY, on ? '1' : '0'); } catch (e) {}
    bauto.setAttribute('aria-checked', String(on));
    paceCss();
    if (S.mode === 'bulk' && (S.phase === 'bulk' || S.phase === 'fan')) bulkControls(true);
    log('auto', { on: on });
    if (S.mode !== 'bulk') return;
    // Switched on mid-open: carry on by itself from where the owner is.
    // Switched off: the auto steps already queued see it and stop, and the
    // row waits for a tap.
    if (on && S.phase === 'bulk' && S.row) { if (S.row.waiting) { S.row = null; bulkNext(); } else autoRow(S.row.r, 0); }
    if (on && S.phase === 'cards') autoStack();
    if (S.phase === 'bulk') bulkHint();
  }
  bauto.setAttribute('aria-checked', String(S.auto));
  // A fast-sequence beat: in Auto the 1x time over the speed, else at 1x.
  function fast(fn, ms) { return later(fn, S.auto ? ms / S.speed : ms); }
  function bulkControls(on) { bauto.hidden = !on; speedEl.hidden = !(on && S.auto); bskip.hidden = !on; }
  bskip.addEventListener('click', function (e) {
    e.stopPropagation();
    if (S.mode !== 'bulk' || (S.phase !== 'bulk' && S.phase !== 'fan')) return;
    // Runs ahead to the next big pull, which still gets its full reveal;
    // with none left, to the summary.
    log('bulkSkip', { from: S.bp });
    clearTimers(); S.skipping = true; S.row = null; bulkNext();
  });
  function openBulk(b) {
    clearTimers(); stopLayers(); zd.hidden = true; zd.className = 'zd'; dim.style.opacity = 0;
    var B = DATA.bulks[b].reveal;
    S.mode = 'bulk'; S.bulk = b; S.bp = -1; S.cur = B.packs[0]; S.phase = 'fan'; S.skipping = false; S.row = null;
    setBackdrop('calm');
    markPicker(); footer(); bulkControls(true); skipBtn.hidden = true;
    counter.textContent = B.packs.length + ' packs';
    var fan = '';
    // Only the pack being opened (the front one) can be tilted; the rest of
    // the fan stays still (owner 2026-10-18).
    for (var k = B.packs.length - 1; k >= 0; k--) fan += '<div class="mpack' + (k === 0 ? ' front' : '') + '" style="--k:' + k + ';--n:' + B.packs.length + '">' + (k === 0 ? '<div class="mtilt">' + miniPackHtml() + '</div>' : miniPackHtml()) + '</div>';
    scene.innerHTML = '<div class="fan" id="fan" tabindex="0" role="button" aria-label="Ten sealed Season Zero packs. Tap to tear the first one.">' + fan + '</div>';
    hint.innerHTML = 'Ten packs. Tap to tear the first one';
    var f = document.getElementById('fan');
    function go() { if (S.phase !== 'fan') return; S.phase = 'bulk'; f.classList.add('go'); sfx('tear'); log('bulkGo', {}); fast(bulkNext, 420); }
    f.addEventListener('click', go);
    f.addEventListener('pointerdown', function (e) {
      if (S.phase !== 'fan') return;
      f.setPointerCapture && f.setPointerCapture(e.pointerId);
      var front = f.querySelector('.mpack.front');
      pressTilt(e, { el: front.querySelector('.mtilt'), box: front, layers: function () { return []; }, swipe: false, what: 'fan', can: function () { return S.phase === 'fan'; } });
    });
    f.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    f.focus({ preventScroll: true, focusVisible: false });
    log('bulkStart', { packs: B.packs.length, label: DATA.bulks[b].label, auto: S.auto });
  }
  function miniPackHtml() {
    return '<div class="mtop"></div><div class="mbody"><span>AI·TCG</span><svg><use href="#setsym"/></svg></div>';
  }
  function bulkFrame() {
    var B = DATA.bulks[S.bulk].reveal;
    if (!document.getElementById('brow')) {
      scene.innerHTML = '<div class="bulk"><div class="pips" id="pips">' + B.packs.map(function (_, k) { return '<i data-p="' + k + '"></i>'; }).join('') + '</div><div class="brow" id="brow"></div></div>';
      bindRow(document.getElementById('brow'));
    }
    // A pip only says what a pack held once it has been opened: no spoilers.
    Array.prototype.forEach.call(document.getElementById('pips').children, function (el, k) {
      var p = B.packs[k];
      el.className = k < S.bp ? 'done' + (p.fullReveal ? ' big' : p.sparks ? ' hit' : '') : k === S.bp ? 'cur' : '';
    });
    return document.getElementById('brow');
  }
  // A tap or a swipe on the row; a tap knows which card it landed on.
  function bindRow(row) {
    var down = null;
    row.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, at: performance.now() }; });
    row.addEventListener('pointerup', function (e) {
      if (!down) return;
      var g = packGesture(e.clientX - down.x, e.clientY - down.y, performance.now() - down.at);
      down = null;
      if (g === 'none') return;
      var card = g === 'tap' && e.target.closest ? e.target.closest('.bcard') : null;
      bulkTap(card ? Number(card.getAttribute('data-k')) : -1, g);
    });
  }
  function bulkNext() {
    var B = DATA.bulks[S.bulk].reveal;
    S.row = null;
    S.bp++;
    if (S.bp >= B.packs.length) { S.skipping = false; bulkSummary(); return; }
    var r = B.packs[S.bp];
    S.cur = r;
    if (S.skipping && !r.fullReveal) { log('bulkPack', { fast: true, skipped: true, sparks: r.sparks }); bulkNext(); return; }
    S.skipping = false;
    log('bulkPack', { fast: !r.fullReveal, sparks: r.sparks, auto: S.auto });
    S.phase = 'bulk';
    tearMini(r);
  }
  // The pack tears in the row, the same way for every pack; a big pull then
  // plays its full reveal right there (every reveal at its own full length,
  // whatever the speed), the rest deal into the row.
  function tearMini(r) {
    var T = TM.bulk, row = bulkFrame();
    counter.textContent = 'Pack ' + (S.bp + 1) + ' / ' + DATA.bulks[S.bulk].reveal.packs.length;
    hint.innerHTML = '';
    row.innerHTML = '<div class="mpack solo" id="mpack">' + miniPackHtml() + '</div>';
    later(function () {
      var mp = document.getElementById('mpack'); if (!mp) return;
      mp.classList.add('torn'); sfx('tear');
      log('tear', { via: S.auto ? 'auto' : 'tap', sparks: r.sparks, jackpot: r.jackpot });
      // The honest tell holds here too.
      if (r.sparks) {
        var rc = mp.getBoundingClientRect(), sr = stage.getBoundingClientRect();
        sparks(rc.left - sr.left, rc.top - sr.top + rc.height * 0.16, rc.width, r.fullReveal ? 90 : 50);
        sfx('sparkle', 'Neutral', r.fullReveal ? 'spectacle' : 'normal'); log('sparks', {});
      }
      if (r.fullReveal) later(function () { bigPull(r); }, TM.pack.tear);
      else fast(function () { dealRow(r, row); }, T.tear);
    }, S.auto ? T.sealed / S.speed : TM.tap.sealed);
  }
  function bigPull(r) {
    bulkControls(false);
    var wait = 0;
    if (r.jackpot) {
      var b = document.createElement('div'); b.className = 'banner'; b.innerHTML = 'JACKPOT PACK<small>every card Foil or better</small>';
      stage.appendChild(b); sfx('rise', 'Neutral', 'spectacle'); log('jackpot', {});
      later(function () { b.remove(); }, TM.pack.jackpotBanner);
      wait = TM.pack.jackpotBanner;
    }
    later(function () { dealStack(); if (S.auto) autoStack(); }, wait);
  }
  // Auto, during a big pull: step through the stack by itself, each step
  // once the last has had its full moment, plus a beat.
  function autoStack() {
    if (!(S.mode === 'bulk' && S.auto && S.phase === 'cards')) return;
    var left = S.busyUntil - performance.now();
    later(function () {
      if (!(S.mode === 'bulk' && S.auto && S.phase === 'cards')) return;
      if (performance.now() < S.busyUntil) { autoStack(); return; }
      act('tap'); autoStack();
    }, S.busyUntil === Infinity ? 200 : Math.max(0, left) + TM.tap.autoStackBeat);
  }
  // Back from a big pull: the next pack waits for a tap (or comes by
  // itself in Auto). After the last pack, the summary.
  function bulkResume() {
    S.phase = 'bulk'; bulkControls(true);
    scene.innerHTML = '';
    var row = bulkFrame();
    if (S.bp >= DATA.bulks[S.bulk].reveal.packs.length - 1) { bulkNext(); return; }
    S.row = { waiting: true };
    row.innerHTML = '<div class="mpack" style="opacity:0.85">' + miniPackHtml() + '</div>';
    bulkHint();
    if (S.auto) fast(function () { if (S.auto && S.row && S.row.waiting) bulkNext(); }, 300);
  }
  function rowDowns() {
    var R = S.row, out = [];
    if (!R || !R.r) return out;
    R.r.cards.forEach(function (c, k) { if (c.faceDown && !R.flipped[k]) out.push(k); });
    return out;
  }
  function bulkHint() {
    var R = S.row, last = S.bp >= DATA.bulks[S.bulk].reveal.packs.length - 1;
    if (!R) { hint.innerHTML = ''; return; }
    if (S.auto) { hint.innerHTML = 'Auto · tap to move on'; return; }
    var downs = rowDowns().length;
    hint.innerHTML = downs ? 'Tap to flip' + (downs > 1 ? ' · ' + downs + ' face down' : '') : last ? 'Tap for the summary' : 'Tap or swipe for pack ' + (S.bp + 2);
    var bc = document.querySelector('.bcards'); if (bc) bc.classList.toggle('wait', downs > 0);
  }
  // A tap (k: the card under it, or -1) or a swipe on the row.
  function bulkTap(k, how) {
    if (S.phase !== 'bulk' || !S.row) return;
    var now = performance.now();
    if (S.auto) { log('bulkTap', { idx: k, how: how || 'key', auto: true }); clearTimers(); bulkNext(); return; }
    if (S.row.waiting) { log('bulkTap', { idx: k, how: how || 'key' }); bulkNext(); return; }
    if (now < S.busyUntil) return;
    var step = packRowTap(rowDowns(), k, S.bp >= DATA.bulks[S.bulk].reveal.packs.length - 1);
    if (step.next && now < S.nextAt) return;
    log('bulkTap', { idx: k, how: how || 'key', step: step.next || 'flip' });
    if (step.next) { log('bulkPackDone', {}); bulkNext(); return; }
    flipCard(step.flip, 'tap');
  }
  function flipCard(k, via) {
    var R = S.row, c = R.r.cards[k], el = document.querySelector('.bcard[data-k="' + k + '"]');
    if (!el || R.flipped[k]) return;
    R.flipped[k] = true;
    el.classList.remove('down'); el.classList.add('shown');
    sfx('flip', c.face.faction);
    var now = performance.now();
    S.busyUntil = Math.max(S.busyUntil, now + (via === 'tap' ? TM.bulk.flip : 0));
    if (c.hit) { el.classList.add('pop'); sfx('rise', c.face.faction, 'normal'); S.nextAt = now + TM.tap.hitPop; }
    announce.textContent = c.face.name + (packFinishLabel(c.finish) ? ', ' + packFinishLabel(c.finish) : '');
    log('bulkFlip', { idx: k, finish: c.finish, hit: c.hit, via: via });
    bulkHint();
  }
  function dealRow(r, row) {
    var T = TM.bulk;
    row.innerHTML = '<div class="bcards n' + r.cards.length + '">' + r.cards.map(function (c, k) {
      return '<div class="bcard' + (c.faceDown ? ' down' : '') + '" data-k="' + k + '" style="--d:' + k + '"><div class="flipper"><div class="front">' + settledFaceHtml(c) + '</div>' + backHtml() + '</div><span class="blab' + (c.hit ? ' hit' : '') + '">' + (c.slot === 'bonus' ? 'BONUS · ' : '') + packFinishLabel(c.finish) + '</span>' + (c.isNew ? '<span class="new">NEW</span>' : '') + '</div>';
    }).join('') + '</div>';
    log('bulkDealt', { cards: r.cards.map(function (c) { return { finish: c.finish, faceDown: c.faceDown, slot: c.slot }; }) });
    // Taps wait for the deal to land (the last card's deal ends then).
    var dealt = r.cards.length * T.deal + 160;
    S.row = { r: r, flipped: {} };
    S.busyUntil = performance.now() + (S.auto ? dealt / S.speed : dealt); S.nextAt = 0;
    bulkHint();
    if (S.auto) autoRow(r, dealt);
  }
  // Auto: turn the face-down cards one after another, hold, move on
  // (packFastDuration's beats). Each step checks Auto is still on.
  function autoRow(r, first) {
    var T = TM.bulk;
    function live() { return S.auto && S.phase === 'bulk' && S.row && S.row.r === r; }
    fast(function step() {
      if (!live()) return;
      var d = rowDowns();
      if (d.length) { flipCard(d[0], 'auto'); fast(step, T.flip); return; }
      fast(function () { if (!live()) return; log('bulkPackDone', {}); bulkNext(); }, r.sparks ? T.hitHold : T.hold);
    }, first);
  }
  function bulkSummary() {
    clearTimers(); stopLayers(); dim.style.opacity = 0;
    S.phase = 'summary'; S.mode = 'bulk'; bulkControls(false); skipBtn.hidden = true; counter.textContent = ''; hint.innerHTML = '';
    var B = DATA.bulks[S.bulk].reveal, sm = B.summary;
    var best = B.tiles.filter(function (t) { return t.hit; }), rest = B.tiles.filter(function (t) { return !t.hit; });
    var chips = packFinishOrder().filter(function (f) { return sm.byFinish[f]; }).map(function (f) { return '<span class="chip f-' + f + '">' + (packFinishLabel(f) || 'STANDARD') + ' <b>' + sm.byFinish[f] + '</b></span>'; }).join('') +
      ['Mythic', 'Rare', 'Uncommon', 'Common'].filter(function (q) { return sm.byRarity[q]; }).map(function (q) { return '<span class="chip r">' + RAR[q] + ' <b>' + sm.byRarity[q] + '</b></span>'; }).join('');
    var hitsN = best.reduce(function (n, t) { return n + t.count; }, 0);
    scene.innerHTML = '<div class="summary bulk-sum"><h2>TEN PACKS OPENED</h2><p class="sub">' + sm.cards + ' cards · ' + sm.newCards + ' new · ' + (hitsN ? hitsN + ' hit' + (hitsN > 1 ? 's' : '') : 'no hits') + (sm.fullReveals.length ? ' · ' + sm.fullReveals.length + ' big pull' + (sm.fullReveals.length > 1 ? 's' : '') : '') + '</p>' +
      '<div class="chips">' + chips + '</div>' +
      (best.length ? '<h3>Best pulls</h3><div class="grid best">' + best.map(function (t, i) { return tileHtml(t, i, ' big'); }).join('') + '</div>' : '') +
      '<h3>' + (best.length ? 'Everything else' : 'Every card') + '</h3><div class="grid">' + rest.map(function (t, i) { return tileHtml(t, i + best.length, ''); }).join('') + '</div>' +
      '<p class="points">+<b>' + sm.packPoints + '</b> pack points</p>' +
      '<div class="btns"><button class="pri" id="again">Open 10 more</button><button id="one">Open one pack</button><button id="done">Done</button></div></div>';
    if (S.onBulkSummary) S.onBulkSummary(scene.querySelector('.btns'), B);
    else {
      document.getElementById('again').addEventListener('click', function () { openBulk((S.bulk + 1) % DATA.bulks.length); });
      document.getElementById('one').addEventListener('click', function () { openPack(0); });
      document.getElementById('done').addEventListener('click', shelf);
    }
    bindViewer(best.concat(rest));
    log('bulkSummary', { tiles: B.tiles.length, copies: B.tiles.reduce(function (n, t) { return n + t.count; }, 0), newBadges: B.tiles.filter(function (t) { return t.isNew; }).length, best: best.length, packPoints: sm.packPoints });
  }

  // ---------- the card viewer ----------
  // A tap on a summary tile shows that card full size, with its finish's
  // own look (the shader, not the tile's CSS stand-in) and the light
  // following the pointer or the tilt: the place to read a card, its modes
  // included, after the reveal has moved on.
  var viewer = document.getElementById('viewer'), vcard = document.getElementById('vcard'), vcap = document.getElementById('vcap');
  var vLayers = [];
  function bindViewer(list) {
    scene.querySelectorAll('.tile').forEach(function (t) {
      t.querySelector('.mini').addEventListener('click', function () { openViewer(list[Number(t.getAttribute('data-ti'))]); });
    });
  }
  function openViewer(c) {
    if (!c) return;
    vcard.className = 'vcard' + (c.reveal === 'zeroDay' ? ' reach' : '');
    vcard.innerHTML = '<div class="tiltv">' + faceHtml(c, { settled: true }) + '</div>';
    var lab = packFinishLabel(c.finish);
    vcap.innerHTML = (lab ? '<span class="fin' + (c.hit ? ' hit' : '') + '">' + lab + '</span> ' : '') + esc(c.face.name) + ' · ' + esc(c.prototype ? 'serial ' + c.prototype.serial + ' of ' + c.prototype.runSize : c.collectorNumber) + ' · ' + esc(c.face.rarity);
    viewer.hidden = false;
    var face = vcard.querySelector('.face');
    var l = FXGL.layer(face, packFinishLayerName(c.reveal), { amt: packFinishLayerAmt(c.reveal), seed: 11 });
    if (l) { l.ptr(0.5, 0.4); vLayers.push(l); } else if (packFinishLayerName(c.reveal)) face.classList.add('fx-css-' + packFinishLayerName(c.reveal));
    document.getElementById('vclose').focus({ preventScroll: true });
    log('viewer', { name: c.face.name, finish: c.finish, full: face.classList.contains('full'), modes: (c.face.modes || []).length });
  }
  function closeViewer() { if (viewer.hidden) return; vLayers.forEach(function (l) { l.stop(); }); vLayers = []; viewer.hidden = true; vcard.innerHTML = ''; log('viewerClosed', {}); }
  document.getElementById('vclose').addEventListener('click', closeViewer);
  viewer.addEventListener('click', function (e) { if (e.target === viewer) closeViewer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeViewer(); });
  // Hovering moves the light; holding (or dragging) the card tilts it.
  viewer.addEventListener('pointermove', function (e) {
    if (tilting()) return;
    var rc = vcard.getBoundingClientRect(), x = Math.max(0, Math.min(1, (e.clientX - rc.left) / rc.width)), y = Math.max(0, Math.min(1, (e.clientY - rc.top) / rc.height));
    vLayers.forEach(function (l) { l.ptr(x, y); });
  });
  vcard.addEventListener('pointerdown', function (e) {
    var t = vcard.querySelector('.tiltv'); if (!t) return;
    vcard.setPointerCapture && vcard.setPointerCapture(e.pointerId);
    pressTilt(e, { el: t, box: vcard, layers: function () { return vLayers; }, swipe: false, what: 'viewer', can: function () { return !viewer.hidden; } });
  });

  // What a flow built around the pack opening (firstTimePage.ts) drives:
  // it sets the packs, opens them, and reuses the tilt, the viewer, the
  // finish layers and the sound.
  window.PACK = {
    S: S, log: log, later: later, clearTimers: clearTimers, stopLayers: stopLayers, sfx: sfx, esc: esc,
    setPacks: function (list) { DATA.packs = list; }, openPack: openPack,
    setBulks: function (list) { DATA.bulks = list; }, openBulk: openBulk,
    faceHtml: faceHtml, backHtml: backHtml, addLayer: addLayer, sparks: sparks, openViewer: openViewer,
    pressTilt: pressTilt, tilting: tilting, bulkControls: bulkControls,
  };
  if (DATA.flow) return;
  // The website drives the page: it waits, empty, for the first opening.
  if (DATA.site) {
    S.phase = 'idle';
    var closeBtn = document.getElementById('close');
    var siteClose = function (via) { if (!viewer.hidden) return closeViewer(); clearTimers(); stopLayers(); log('close', { via: via, phase: S.phase }); S.phase = 'idle'; scene.innerHTML = ''; hint.innerHTML = ''; counter.textContent = ''; skipBtn.hidden = true; bulkControls(false); zd.hidden = true; zd.className = 'zd'; var h = packSiteHost(); if (h && h.close) h.close(); };
    closeBtn.addEventListener('click', function () { siteClose('button'); });
    // Esc closes only once the pack is done (the summary), so a stray key
    // can't cut a reveal short; the Close button works at any time.
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.phase === 'summary' && viewer.hidden) { e.preventDefault(); siteClose('key'); } });
    window.PACK.close = siteClose;
    log('siteReady', {});
    return;
  }
  // ?pack=N opens that pack straight away (1-based), ?bulk=N that ten-pack
  // open; otherwise the shelf.
  var m = /[?&]pack=(\d+)/.exec(location.search), mb = /[?&]bulk=(\d+)/.exec(location.search);
  if (m && DATA.packs[Number(m[1]) - 1]) openPack(Number(m[1]) - 1);
  else if (mb && DATA.bulks[Number(mb[1]) - 1]) openBulk(Number(mb[1]) - 1);
  else shelf();
})();
`;
