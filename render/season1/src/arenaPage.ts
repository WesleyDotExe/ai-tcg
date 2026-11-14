// Season 1 arena prototype: the page. One self-contained HTML file: the CSS,
// the match data as JSON, and arenaClient.ts bundled by esbuild with three.js
// inside it (nothing is loaded from outside). Fenced off in render/season1/.
import { buildSync } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ArenaData } from "./arenaClient.js";

const here = dirname(fileURLToPath(import.meta.url));
let cachedScript: string | null = null;

export function arenaScript(): string {
  if (cachedScript) return cachedScript;
  const out = buildSync({
    entryPoints: [join(here, "arenaClient.ts")],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2020",
    platform: "browser",
    minify: true,
    legalComments: "none",
  });
  const text = out.outputFiles[0]!.text;
  if (/<\/script/i.test(text)) throw new Error("the arena bundle contains </script");
  cachedScript = text;
  return text;
}

/** JSON safe inside a <script> element. */
export function scriptJson(value: unknown): string {
  const ls = String.fromCharCode(0x2028), ps = String.fromCharCode(0x2029);
  return JSON.stringify(value).replace(/</g, "\\u003c").split(ls).join("\\u2028").split(ps).join("\\u2029");
}

export const ARENA_CSS = String.raw`
:root {
  --bg0: #05060d; --bg1: #0b0f24; --line: #252c57; --ink: #e6ecff; --dim: #8e9bc4;
  --amber: #ffb000; --bad: #ff4d6d; --good: #35e6a0; --rim: #8a7bff;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg0); color: var(--ink);
  font-family: "Rajdhani", "Segoe UI", system-ui, sans-serif; overflow: hidden; }
body { background: radial-gradient(1200px 700px at 35% 30%, #18204d 0%, var(--bg1) 45%, var(--bg0) 100%); }
button { font: inherit; }
.app { display: grid; grid-template-columns: minmax(0, 1fr) 340px; grid-template-rows: 44px minmax(0, 1fr); height: 100vh; height: 100dvh; }
.topbar { grid-column: 1 / 3; display: flex; align-items: center; gap: 12px; padding: 0 14px; border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, #11163a, #0a0d22); min-width: 0; }
.topbar .live { font-weight: 700; letter-spacing: .14em; font-size: 12px; color: var(--dim); white-space: nowrap; }
.topbar .live i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--amber); margin-right: 6px; box-shadow: 0 0 8px var(--amber); }
.topbar .title { font-size: 13px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.topbar .tag { margin-left: auto; font-size: 11px; letter-spacing: .14em; color: var(--amber); border: 1px solid #5a4410; padding: 3px 9px; border-radius: 4px; background: #1d1606; white-space: nowrap; }
.btn { background: #161c44; border: 1px solid var(--line); color: var(--ink); padding: 5px 11px; border-radius: 6px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.btn:hover, .btn:focus-visible { border-color: var(--rim); outline: none; }
.main { position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto; min-height: 0; min-width: 0; }

/* HUDs: the far side above the board, the near side below */
.hud { display: flex; align-items: center; gap: 14px; padding: 7px 16px; position: relative; z-index: 5; min-width: 0; flex-wrap: nowrap; }
.hud.far { background: linear-gradient(180deg, color-mix(in srgb, var(--fc, #888) 14%, transparent), transparent); }
.hud.near { background: linear-gradient(0deg, color-mix(in srgb, var(--fc, #888) 14%, transparent), transparent); }
.port { width: 68px; height: 68px; border-radius: 14px; overflow: hidden; flex: none; border: 2px solid var(--c); box-shadow: 0 0 18px color-mix(in srgb, var(--c) 60%, transparent); background: #0b0f24; }
.port svg, .port img { width: 100%; height: 100%; display: block; }
.who { min-width: 0; }
.who b { display: block; font-size: 17px; letter-spacing: .04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px; }
.who span { font-size: 12px; color: var(--dim); }
.hp { flex: 1 1 140px; max-width: 260px; min-width: 90px; }
.hpbar { height: 13px; border-radius: 7px; background: #161a3a; border: 1px solid #2c3366; overflow: hidden; }
.hpbar div { height: 100%; background: linear-gradient(90deg, var(--c), #fff); transition: width .6s cubic-bezier(.2,.8,.2,1); }
.num { font-size: 12px; color: var(--dim); margin-top: 3px; white-space: nowrap; }
.num b { color: var(--ink); font-size: 15px; }
.en { display: flex; gap: 4px; }
.en i { width: 12px; height: 12px; transform: rotate(45deg); border: 1px solid var(--amber); }
.en i.on { background: var(--amber); box-shadow: 0 0 7px var(--amber); }
.counts { display: flex; gap: 10px; font-size: 12px; color: var(--dim); white-space: nowrap; }
.counts b { color: var(--ink); font-size: 15px; margin-left: 3px; }
.sig { font-size: 11px; letter-spacing: .1em; padding: 3px 8px; border-radius: 4px; border: 1px solid var(--c); color: var(--c); white-space: nowrap; }
.kit { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: var(--dim); white-space: nowrap; }
.turnflag { margin-left: auto; font-size: 11px; letter-spacing: .18em; color: #05060d; background: var(--c); padding: 3px 9px; border-radius: 4px; font-weight: 800; }
.turnflag.resp { background: transparent; color: var(--c); border: 1px solid var(--c); }
.hud.hit { animation: hit .6s; }
@keyframes hit { 25% { background-color: rgba(255,77,109,.4); transform: translateX(-6px); } 50% { transform: translateX(5px); } }

/* the stage */
.stage { position: relative; overflow: hidden; min-height: 0; }
.stage canvas.gl { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: manipulation; }
.turnline { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 4; font-size: 12px; letter-spacing: .26em; color: var(--dim);
  background: rgba(5,6,13,.78); border: 1px solid var(--line); padding: 4px 14px; border-radius: 20px; pointer-events: none; white-space: nowrap; }
.lbl { position: absolute; z-index: 3; transform: translate(-50%, -50%); font-size: 10px; letter-spacing: .14em; color: var(--dim); text-align: center; pointer-events: none;
  text-shadow: 0 1px 3px #000, 0 0 6px #000; line-height: 1.25; white-space: nowrap; }
.lbl em { font-style: normal; display: block; font-size: 9px; }
.lbl b { color: var(--c); font-size: 18px; display: block; }
.lbl span { display: block; font-size: 9px; letter-spacing: .06em; color: var(--c); opacity: .85; }
.hand { position: absolute; left: 50%; bottom: -30px; transform: translateX(-50%); display: flex; z-index: 6; pointer-events: none; }
.hc { width: 74px; height: 104px; margin: 0 -9px; border-radius: 8px; border: 2px solid var(--c); background: linear-gradient(160deg, #1c2340, #0b0f22 70%);
  box-shadow: 0 6px 14px rgba(0,0,0,.6); position: relative; transform-origin: 50% 140%; pointer-events: auto; cursor: help; }
.hc .hn { position: absolute; left: 6px; right: 20px; top: 5px; font-size: 10px; font-weight: 700; line-height: 1.1; max-height: 34px; overflow: hidden; }
.hc .hcst { position: absolute; right: 4px; top: 4px; width: 16px; height: 16px; border-radius: 50%; background: var(--amber); color: #111; font-size: 10px; font-weight: 900; display: grid; place-items: center; }
.hc .ht { position: absolute; left: 6px; bottom: 30px; font-size: 9px; color: var(--dim); letter-spacing: .08em; text-transform: uppercase; }
.hc.back { background: repeating-linear-gradient(45deg, #121735 0 6px, #1a2148 6px 12px); cursor: default; }
.held { display: none; }
.dmg { position: absolute; z-index: 20; font-weight: 900; font-size: 30px; color: #fff; pointer-events: none; text-shadow: 0 0 8px var(--bad), 0 0 18px var(--bad), 0 2px 0 #000;
  animation: dmg 1.1s ease-out forwards; }
@keyframes dmg { 0% { transform: translate(-50%,-30%) scale(.6); opacity: 0; } 15% { transform: translate(-50%,-60%) scale(1.2); opacity: 1; } 100% { transform: translate(-50%,-150%); opacity: 0; } }

/* the reader (hover/tap) */
.reader { position: absolute; z-index: 25; width: 230px; pointer-events: none; filter: drop-shadow(0 10px 24px rgba(0,0,0,.8)); }
.reader[hidden] { display: none; }
.rcard { border: 2px solid var(--c); border-radius: 12px; background: linear-gradient(160deg, #1c2340, #0a0d1f 75%); padding: 10px 12px 12px; font-size: 13px; line-height: 1.3; }
.rtop { display: flex; align-items: flex-start; gap: 8px; }
.rtop b { flex: 1; font-size: 16px; }
.rc { flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--amber); color: #111; font-weight: 900; display: grid; place-items: center; }
.rtype { font-size: 10px; letter-spacing: .12em; color: var(--c); margin: 3px 0 6px; text-transform: uppercase; }
.rkw { font-weight: 700; margin-bottom: 4px; }
.rcard p { margin: 0 0 5px; }
.rstate { font-size: 12px; color: var(--amber); margin-bottom: 4px; }
.rfl { font-style: italic; color: var(--dim); font-size: 12px; }
.rst { display: flex; justify-content: space-between; margin-top: 8px; }
.rst span { min-width: 30px; height: 30px; border-radius: 15px; display: grid; place-items: center; font-weight: 900; font-size: 16px; color: #111; padding: 0 6px; }
.rst .a { background: var(--amber); } .rst .h { background: var(--good); }
.rown { font-size: 10px; letter-spacing: .15em; text-align: center; margin-top: 6px; text-transform: uppercase; }

/* the transport */
.transport { display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-top: 1px solid var(--line); background: #080b1c; min-width: 0; }
.transport input[type=range] { flex: 1; min-width: 60px; accent-color: var(--rim); }
.transport .pos { font-size: 12px; color: var(--dim); white-space: nowrap; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

/* the side panel: Play-by-play | Chat */
.panel { border-left: 1px solid var(--line); background: linear-gradient(180deg, #0b0f26, #070918); display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.tabs { display: flex; border-bottom: 1px solid var(--line); flex: none; }
.tabs button { flex: 1; background: none; border: 0; color: var(--dim); font-size: 13px; letter-spacing: .12em; padding: 10px 0; cursor: pointer; border-bottom: 2px solid transparent; }
.tabs button.on { color: var(--ink); border-bottom-color: var(--rim); }
.feed { flex: 1; overflow: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; min-height: 0; }
.feed[hidden], .chat[hidden] { display: none; }
.ev { font-size: 13px; line-height: 1.3; padding: 5px 9px; border-left: 3px solid var(--c); background: #10143a; border-radius: 0 6px 6px 0; }
.ev small { display: inline-block; font-size: 9px; letter-spacing: .14em; color: var(--amber); border: 1px solid #5a4410; padding: 0 4px; border-radius: 3px; margin-right: 5px; vertical-align: 1px; }
.ev .det { font-size: 11px; color: var(--dim); margin-top: 2px; }
.ev.result { margin-left: 14px; background: #0c1030; font-size: 12px; }
.ev.trigger, .ev.resolve { margin-left: 8px; }
.ev.turn { border: 0; background: none; text-align: center; font-size: 11px; letter-spacing: .22em; color: var(--dim); padding: 8px 0 2px; text-transform: uppercase; }
.ev.big { border-left-width: 5px; background: linear-gradient(90deg, color-mix(in srgb, var(--c) 28%, #10143a), #10143a); font-weight: 700; }
.ev.end { font-size: 15px; }
.chat { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 24px; gap: 10px; color: var(--dim); }
.chat b { color: var(--ink); font-size: 15px; letter-spacing: .12em; }
.chat p { margin: 0; font-size: 13px; max-width: 260px; }

/* tile: the Home widget's size; no panel, compact HUDs, silent */
body.tile .app { grid-template-columns: minmax(0,1fr); grid-template-rows: minmax(0,1fr); }
body.tile .topbar, body.tile .panel, body.tile .transport, body.tile .kit, body.tile .counts, body.tile .sig, body.tile .num, body.tile .turnflag, body.tile .lbl span { display: none; }
body.tile .hud { padding: 3px 8px; gap: 8px; }
body.tile .port { width: 30px; height: 30px; border-radius: 8px; }
body.tile .who b { font-size: 12px; max-width: 120px; }
body.tile .who span { display: none; }
body.tile .en i { width: 7px; height: 7px; }
body.tile .hpbar { height: 8px; }
body.tile .hand { bottom: -48px; transform: translateX(-50%) scale(.6); transform-origin: 50% 100%; }
body.tile .turnline { font-size: 9px; padding: 2px 8px; }
body.tile .lbl em { display: none; } body.tile .lbl b { font-size: 12px; }

/* phones: the panel drops under the board as its own tabbed drawer */
@media (max-width: 900px) {
  .app { grid-template-columns: minmax(0,1fr); grid-template-rows: 40px minmax(0,1fr) 30vh; }
  .topbar { grid-column: 1; gap: 8px; padding: 0 10px; }
  .topbar .title { display: none; }
  .topbar .tag { font-size: 10px; letter-spacing: .08em; padding: 2px 6px; } .topbar .tag .long { display: none; }
  .panel { border-left: 0; border-top: 1px solid var(--line); }
  .hud { gap: 8px; padding: 5px 10px; flex-wrap: wrap; row-gap: 3px; }
  .port { width: 44px; height: 44px; border-radius: 10px; }
  .who b { font-size: 14px; max-width: 130px; }
  .hp { flex: 1 1 90px; }
  .kit, .counts { display: none; }
  .sig { font-size: 9px; padding: 2px 5px; }
  .en i { width: 8px; height: 8px; }
  .turnflag { font-size: 9px; padding: 2px 6px; }
  .turnline { font-size: 10px; letter-spacing: .14em; padding: 3px 9px; }
  .lbl b { font-size: 14px; } .lbl span { display: none; }
  .hand { bottom: -44px; transform: translateX(-50%) scale(.72); transform-origin: 50% 100%; }
  .transport { padding: 4px 8px; gap: 5px; }
  .transport .pos { display: none; }
  .btn { padding: 4px 8px; font-size: 12px; }
  .reader { width: 200px; }
}
@media (prefers-reduced-motion: reduce) { .hud.hit, .dmg { animation-duration: .01s; } }
`;

export function renderArenaPage(data: ArenaData): string {
  const title = `${data.replay.agentNames.p1} vs ${data.replay.agentNames.p2}`;
  return `<!doctype html>
<!-- Season 1 arena prototype (render/season1/, owner 2026-11-14): fenced off, not part of the Season 0 site.
     Built by render/season1/src/build.ts from a real recorded match. Placeholder art. -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Season 1 arena prototype</title><style>${ARENA_CSS}</style></head>
<body><div class="app">
 <div class="topbar"><div class="live"><i></i>REPLAY</div><span class="title">${escHtml(title)} · ${escHtml(data.replay.title)}</span>
  <button class="btn" id="watchAs" type="button">Watch as</button><span class="tag">SEASON 1 PROTOTYPE<span class="long"> · PLACEHOLDER ART</span></span></div>
 <div class="main">
  <div class="hud far" id="hudFar"></div>
  <div class="stage" id="stage"><div class="turnline" id="turnline"></div><div class="held" id="held"></div><div class="hand" id="hand"></div><div class="reader" id="reader" hidden></div></div>
  <div class="hud near" id="hudNear"></div>
  <div class="transport"><button class="btn" id="prev" type="button" aria-label="Back one move">◀</button><button class="btn" id="play" type="button">▶ Play</button>
   <button class="btn" id="next" type="button" aria-label="Forward one move">▶︎▶︎</button><button class="btn" id="speed" type="button" aria-label="Speed">1x</button>
   <input type="range" id="scrub" min="0" value="0" aria-label="Replay position"><span class="pos" id="pos"></span></div>
 </div>
 <div class="panel"><div class="tabs" role="tablist"><button data-t="pbp" class="on" role="tab" aria-selected="true" type="button">PLAY-BY-PLAY</button><button data-t="chat" role="tab" aria-selected="false" type="button">CHAT</button></div>
  <div class="feed" id="feed" role="log" aria-live="polite"></div>
  <div class="chat" id="chat" hidden><b>CHAT · COMING SOON</b><p>A chat room for each live match. Guests will read it; an account is needed to post.</p></div></div>
</div>
<script type="application/json" id="s1data">${scriptJson(data)}</script>
<script>${arenaScript()}</script></body></html>`;
}

function escHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
