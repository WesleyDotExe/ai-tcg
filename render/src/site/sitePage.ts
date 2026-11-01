// The owner website's page (Season 0 render item 1, render session 44): one
// self-contained HTML file, system fonts only, no external requests (the
// owner's 2026-10-05 entry, A: "fully self-contained"). The script is
// siteClient.ts bundled by esbuild; the look follows
// render/reference/owner-web-mockup.html (the frosted-glass sidebar, top bar
// and panels over a soft gradient, light and dark).
//
// Session 45 (the look): the liquid WebGL background is a canvas (#liquid,
// drawn by liquid.ts) over a still CSS gradient of the same colours (#bg,
// set by the client from siteLook.stillGradient): the still one shows
// before the first frame, and is the whole background if the browser has
// no WebGL. A plain background hides the canvas.
//
//   npm run site-page -w @ai-tcg/render [-- <out file>]   (default render/output/site/index.html)

import { FACE_CSS, FACE_SCRIPT, faceSymbols } from "./siteFaces.js";
import { buildSync } from "esbuild";
import { renderPackOpeningHtml } from "../packPage.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

let cachedScript: string | undefined;
/** siteClient.ts and what it imports, as one inline script. */
export function siteScript(): string {
  if (cachedScript !== undefined) return cachedScript;
  const out = buildSync({
    entryPoints: [join(here, "siteClient.ts")],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2019",
    platform: "browser",
    legalComments: "none",
    // Session 47: the client plans each pack's reveal from the API's answer
    // (packOpening.ts planReveal / planBulkReveal, the same code the
    // standalone pages run). That file reads one value from the economy,
    // the store's own list of hit finishes (FULL_ART_OR_BETTER, in
    // economy/src/packs.ts); the economy's barrel also exports the SQLite
    // store, which can't run in a browser. So the bundle resolves the
    // economy to packs.ts alone, which holds that list and imports only the
    // engine. Any other economy value the client ever imports fails this
    // build loudly ("No matching export"), never silently.
    alias: { "@ai-tcg/economy": join(here, "..", "..", "..", "economy", "src", "packs.ts") },
  });
  const text = out.outputFiles[0]!.text;
  if (/<\/script/i.test(text)) throw new Error("the site bundle contains </script");
  cachedScript = text;
  return text;
}

export const SITE_CSS = String.raw`
:root { color-scheme: light; --ink: #141a33; --muted: #4f5a78; --line: rgba(60,70,120,.14); --accent: #4f6bff; --accent2: #8b5cff;
  --glass: rgba(255,255,255,.44); --glass-edge: rgba(255,255,255,.6); --glass-shadow: 0 10px 34px rgba(50,40,140,.16), inset 0 1px 0 rgba(255,255,255,.75);
  --side: rgba(255,255,255,.26); --side-edge: rgba(255,255,255,.45); --soft: rgba(255,255,255,.5); --soft-edge: inset 0 1px 0 rgba(255,255,255,.8);
  --ok: #2fae66; --live: #ff4d6d; --warn: #c7771a; --solid: #f4f6fc; }
body[data-theme="dark"] { color-scheme: dark; --ink: #eef1ff; --muted: #a3acd0; --line: rgba(255,255,255,.1);
  --glass: rgba(24,28,66,.42); --glass-edge: rgba(255,255,255,.12); --glass-shadow: 0 10px 34px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.14);
  --side: rgba(12,14,38,.32); --side-edge: rgba(255,255,255,.08); --soft: rgba(255,255,255,.1); --soft-edge: inset 0 1px 0 rgba(255,255,255,.12);
  --ok: #4fd98a; --warn: #f0a54a; --solid: #1a2140; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body { font: 15px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif; color: var(--ink);
  background: #dfe6f6; overflow: hidden; }
body[data-theme="dark"] { background: #0b0f1e; }
a { color: inherit; text-decoration: none; }
button { font: inherit; color: inherit; }
[hidden] { display: none !important; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.muted { color: var(--muted); } .small { font-size: 12.5px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* The background (2026-10-05 D): the liquid canvas, drawn at low resolution and stretched, over the still
   gradient of the same colours (the client sets #bg's colours; these are Glacier's, before it runs). */
#bg, #liquid { position: fixed; inset: 0; z-index: 0; width: 100%; height: 100%; }
#bg { background: linear-gradient(135deg, rgb(222,230,247), rgb(212,207,242) 55%, rgb(191,219,247)); }
body[data-theme="dark"] #bg { background: linear-gradient(135deg, rgb(13,18,36), rgb(38,36,77) 55%, rgb(18,43,87)); }
#liquid { display: block; pointer-events: none; }

/* The background picker: the mockup's swatches, four to a row. */
.bgsw { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; width: 100%; margin: 12px 0 8px; }
.sw { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px; border-radius: 16px; border: 2px solid transparent; background: none; cursor: pointer; font: 600 12.5px system-ui; color: var(--ink); }
.sw i { width: 100%; aspect-ratio: 16 / 10; border-radius: 12px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.35), 0 2px 8px rgba(0,0,0,.15); }
.sw.on { border-color: var(--accent); }
.sw:hover:not(.on) { border-color: color-mix(in srgb, var(--accent) 35%, transparent); }
.field.col { flex-direction: column; align-items: stretch; gap: 4px; }

/* The wallet in the top bar: credits, pack points, Open. */
#wallet { display: flex; align-items: center; gap: 8px; }
.cur { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px 0 10px; border-radius: 99px; background: var(--soft); box-shadow: 0 2px 10px rgba(40,30,120,.12), var(--soft-edge);
  font: 700 15px ui-rounded, -apple-system, "SF Pro Rounded", system-ui; font-variant-numeric: tabular-nums; }
.coin, .pp { width: 18px; height: 18px; border-radius: 50%; flex: none; }
.coin { background: radial-gradient(circle at 35% 30%, #fff3c4, #f6c445 45%, #c98a12); box-shadow: inset 0 0 0 1.5px rgba(150,95,0,.45); }
.pp { border-radius: 5px; transform: rotate(45deg) scale(.82); background: linear-gradient(135deg, #7ad8ff, #8b5cff); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.4); }
.obtn { position: relative; display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 16px 0 13px; border-radius: 99px; font: 800 14px system-ui; color: #3b2600;
  background: linear-gradient(135deg, #ffd66b, #f0a92a); box-shadow: 0 4px 14px rgba(230,150,20,.35), inset 0 1px 0 rgba(255,255,255,.6); }
button.obtn { border: 0; cursor: pointer; } button.obtn[disabled] { cursor: default; }
.obtn.none { color: var(--muted); background: var(--soft); box-shadow: var(--soft-edge); }
.ocount { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; display: grid; place-items: center; font: 800 11px system-ui; color: #fff; background: var(--live); box-shadow: 0 0 0 2px var(--solid); }

/* Glass */
.glass, .wg, .panel { background: var(--glass); border: 1px solid var(--glass-edge); box-shadow: var(--glass-shadow);
  backdrop-filter: blur(30px) saturate(190%); -webkit-backdrop-filter: blur(30px) saturate(190%); border-radius: 26px; }

/* ---- sign-in ---- */
#signin { position: fixed; inset: 0; z-index: 2; display: grid; place-items: center; overflow: auto; color: #eef1ff;
  background: radial-gradient(50% 60% at 70% 40%, rgba(120,70,255,.35), transparent 70%), radial-gradient(45% 50% at 20% 80%, rgba(20,160,200,.25), transparent 70%), linear-gradient(160deg, #0a0b24, #120c33 55%, #061a2a); }
#signin .stars { position: absolute; inset: 0; pointer-events: none; opacity: .7;
  background-image: radial-gradient(1.5px 1.5px at 12% 18%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 33% 72%, #cfd8ff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 58% 12%, #ffe9b0 50%, transparent 51%),
    radial-gradient(1px 1px at 76% 64%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 88% 22%, #d9c8ff 50%, transparent 51%), radial-gradient(1px 1px at 45% 40%, #fff 50%, transparent 51%),
    radial-gradient(1px 1px at 22% 48%, #bfe8ff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 66% 86%, #fff 50%, transparent 51%); }
.si-wrap { position: relative; width: min(440px, calc(100vw - 32px)); padding: 40px 0; }
.badge-live { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 99px; border: 1px solid rgba(255,255,255,.25); background: rgba(255,255,255,.06); font: 600 13px system-ui; }
.badge-live i { width: 8px; height: 8px; border-radius: 50%; background: #3cc47c; box-shadow: 0 0 8px #3cc47c; }
.logo { font: 900 76px/1 system-ui; letter-spacing: -2px; margin: 18px 0 6px; background: linear-gradient(100deg, #ffe9a8, #fff 40%, #cdd7ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
.logo-sub { font: 700 13px system-ui; letter-spacing: .5em; color: #f4c95d; }
.tagline { font-size: 18px; color: #dfe4ff; margin: 14px 0 26px; }
.si-panel { padding: 22px; border-radius: 22px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.18); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); }
.si-panel h1 { margin: 0; font: 700 20px system-ui; } .si-panel p { margin: 4px 0 14px; color: #b8c0e6; font-size: 13px; }
.si-panel label { display: block; margin-bottom: 10px; }
.si-panel input { width: 100%; padding: 13px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,.22); background: rgba(5,8,24,.45); color: #fff; font: inherit; }
.si-panel input:focus { outline: 2px solid #7d8bff; outline-offset: 0; }
.si-go { width: 100%; margin-top: 6px; padding: 13px; border: 0; border-radius: 14px; font: 700 16px system-ui; color: #fff; cursor: pointer; background: linear-gradient(90deg, #4f6bff, #8b5cff); box-shadow: 0 6px 22px rgba(100,90,255,.45); }
.si-go:disabled { opacity: .6; cursor: progress; }
.si-msg { margin: 12px 0 0; color: #ffb4c1; font-size: 13.5px; }
.si-foot { margin-top: 14px; font-size: 12px; color: #8d95bd; }

/* ---- shell ---- */
#shell { position: relative; z-index: 1; display: grid; grid-template-columns: 248px minmax(0, 1fr); height: 100vh; }
.side { display: flex; flex-direction: column; gap: 4px; padding: 22px 14px 14px; background: var(--side); border-right: 1px solid var(--side-edge);
  backdrop-filter: blur(34px) saturate(180%); -webkit-backdrop-filter: blur(34px) saturate(180%); min-height: 0; }
.brand { font: 900 22px system-ui; letter-spacing: .5px; padding: 0 12px 16px; }
.brand small { font: 700 9.5px system-ui; letter-spacing: .3em; color: #c79a2b; margin-left: 8px; vertical-align: middle; }
#nav { display: flex; flex-direction: column; gap: 3px; overflow: auto; }
.navb { display: flex; align-items: center; gap: 13px; padding: 10px 14px; border-radius: 13px; font: 600 15px system-ui; color: var(--ink); opacity: .86; }
.navb:hover { background: var(--soft); opacity: 1; }
.navb.on { background: linear-gradient(90deg, #4f6bff, #8b5cff); color: #fff; opacity: 1; box-shadow: 0 6px 18px rgba(100,90,255,.35); }
.navb.is-soon { opacity: .45; cursor: default; } .navb.is-soon:hover { background: none; }
.nbadge { margin-left: auto; font: 800 9.5px system-ui; letter-spacing: .08em; padding: 2px 7px; border-radius: 6px; background: var(--soft); text-transform: uppercase; }
.nav-rule { border: 0; border-top: 1px solid var(--line); margin: 10px 8px; width: auto; }
#agent-card { margin-top: auto; padding: 14px; border-radius: 20px; color: #fff; background: linear-gradient(150deg, rgba(60,40,140,.92), rgba(18,16,48,.92)); border: 1px solid rgba(255,255,255,.18); box-shadow: 0 10px 30px rgba(30,20,90,.35); }
.ac-top { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.ac-name b { display: block; font-size: 15px; } .ac-name small { color: #c9c4f3; }
.ac-none { font-weight: 600; margin-bottom: 10px; }
.av { display: inline-grid; place-items: center; flex: none; border-radius: 30%; overflow: hidden; color: var(--c); background: rgba(10,12,30,.85); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--c) 70%, transparent); }
.av svg { width: 100%; height: 100%; display: block; }
.status { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 99px; font: 700 12.5px system-ui; background: rgba(255,255,255,.14); }
.status i { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.status.ready i { background: #3cc47c; } .status.live i { background: var(--live); animation: pulse 1.4s ease-in-out infinite; } .status.none i { background: #9aa0b8; }
.wg .status, .panel .status { background: var(--soft); }
@keyframes pulse { 50% { opacity: .35; } }

main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.topbar { height: 70px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 30px; border-bottom: 1px solid var(--side-edge);
  background: rgba(255,255,255,.12); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); position: relative; z-index: 3; }
body[data-theme="dark"] .topbar { background: rgba(10,12,30,.15); }
.topbar h1 { font: 800 23px system-ui; margin: 0; } .topbar .sp { flex: 1; }
.tbtn { position: relative; width: 42px; height: 42px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; background: var(--soft); box-shadow: 0 2px 10px rgba(40,30,120,.12), var(--soft-edge); }
.auto-dot { position: absolute; right: 7px; bottom: 7px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 2px var(--solid); }
#acct-btn { background: linear-gradient(135deg, #4f6bff, #8b5cff); color: #fff; font: 800 17px system-ui; }
#acct-menu { position: absolute; right: 30px; top: 62px; min-width: 220px; padding: 10px; border-radius: 18px; }
#acct-menu .who { padding: 6px 10px 10px; border-bottom: 1px solid var(--line); margin-bottom: 6px; }
#acct-menu .who small { display: block; color: var(--muted); }
.mitem { display: flex; gap: 10px; align-items: center; width: 100%; padding: 9px 10px; border: 0; border-radius: 10px; background: none; cursor: pointer; text-align: left; font-weight: 600; }
.mitem:hover { background: var(--soft); }
#page { flex: 1; overflow: auto; padding: 28px 30px 40px; }

/* ---- panels and controls ---- */
/* ---- Home: the widget board (2026-10-05 C; the mockup's grid: 12 columns, 66 px rows, S 3x2, M 6x4,
   L wide 12x6 or tall 6x8, packed dense so a Small fills a hole) ---- */
.pg-wide { max-width: 1500px; }
.boardbar { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
.boardbar h2 { font: 700 22px system-ui; margin: 0; } .boardbar .sp { flex: 1; } .hint2 { font-size: 13px; color: var(--muted); margin: -8px 2px 16px; }
.wgrid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-rows: 66px; gap: 20px; grid-auto-flow: row dense; }
.wg { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.sz-S { grid-column: span 3; grid-row: span 2; } .sz-M { grid-column: span 6; grid-row: span 4; }
.sz-Lw { grid-column: span 12; grid-row: span 6; } .sz-Lt { grid-column: span 6; grid-row: span 8; }
.wg::before { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: linear-gradient(160deg, rgba(255,255,255,.35), rgba(255,255,255,0) 38%); mix-blend-mode: soft-light; }
.wg.hero { color: #fff; background: linear-gradient(140deg, color-mix(in srgb, var(--c) 32%, rgba(20,24,52,.62)), rgba(18,22,48,.6) 70%); border-color: rgba(255,255,255,.22); }
.wg.hero .muted { color: #c6cbe8; }
.wgh { display: flex; align-items: center; gap: 8px; padding: 13px 12px 0 16px; font: 600 13px system-ui; position: relative; z-index: 2; flex: none; min-height: 40px; }
.wtt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.wic { width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; background: var(--g); color: #fff; flex: none; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.wic.big { width: 54px; height: 54px; border-radius: 15px; }
.wopen { margin-left: auto; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; opacity: .7; } .wopen:hover { opacity: 1; background: var(--soft); }
.wgb { position: relative; z-index: 1; flex: 1; min-height: 0; overflow: auto; scrollbar-width: thin; padding: 8px 16px 14px; display: flex; flex-direction: column; gap: 9px; align-items: stretch; border-radius: 0 0 26px 26px; }
.wgb h4 { margin: 2px 0 0; font: 700 15px system-ui; } .wgb p { margin: 0; }
.wg-dark { color: #fff; background: linear-gradient(140deg, rgba(28,35,80,.78), rgba(43,33,102,.72)); border-color: rgba(255,255,255,.16); }
.wg-dark .muted { color: #c6cbe8; } .wg-dark .btn:not(.pri) { background: rgba(255,255,255,.14); color: #fff; }
.mya-t { min-width: 0; } .wcol { display: flex; flex-direction: column; gap: 8px; min-width: 0; flex: 1; align-items: flex-start; }
.wsplit { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; } .wsplit.wide-l { grid-template-columns: minmax(0, 440px) minmax(0, 1fr); }
.row.nowrap { flex-wrap: nowrap; } .row.top { align-items: flex-start; } .row.between { justify-content: space-between; } .row.center { justify-content: center; }
.wbig-s { font: 700 26px ui-rounded, -apple-system, "SF Pro Rounded", system-ui; font-variant-numeric: tabular-nums; }
.bar { height: 8px; border-radius: 99px; background: var(--soft); box-shadow: var(--soft-edge); overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #3cc47c, #2fb6ff); }
.ring { --p: 0; flex: none; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--soft) 0); }
.ring b { width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center; background: var(--solid); font: 800 13px ui-rounded, system-ui; }
.wlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.wlist li { display: grid; grid-template-columns: 24px 1fr auto auto; gap: 8px; align-items: center; font-size: 13px; }
.wl { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; font: 800 11px system-ui; color: #fff; background: #ff5d73; } .wl.w { background: #3cc47c; }
.lboard { display: grid; place-items: center; min-height: 90px; border-radius: 16px; border: 1px dashed rgba(255,255,255,.3); background: repeating-linear-gradient(135deg, rgba(255,255,255,.04) 0 12px, rgba(255,255,255,.08) 12px 24px); font: 600 13px system-ui; color: #dfe4ff; }
.wwait p + p { margin-top: 4px; } .wcap { color: #ffd6a0 !important; }
.pills { display: flex; gap: 6px; flex-wrap: wrap; }
.pills .pill { border: 0; cursor: pointer; font-family: inherit; } .pills .pill.on { background: var(--accent); color: #fff; }
.btn.off { opacity: .55; cursor: default; }
/* A mini card: the placeholder face (faction palette, the card's own hue and pattern, a rarity gem, the finish). */
.mrow { display: flex; gap: 8px; flex-wrap: wrap; } .mrow.center { justify-content: center; }
.mbinder { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 8px; }
.mc { --c: #8f8cff; --h: 200; position: relative; width: 78px; aspect-ratio: 5 / 7; border-radius: 9px; overflow: hidden; flex: none; color: #fff;
  background: linear-gradient(160deg, color-mix(in srgb, var(--c) 70%, #11152e), #0d1024 85%); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--c) 75%, transparent), 0 3px 10px rgba(0,0,0,.22); }
.mbinder .mc { width: auto; }
.mc-art { position: absolute; left: 6px; right: 6px; top: 6px; height: 52%; border-radius: 6px; background-color: hsl(var(--h) 55% 32%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
.mc-art.p0 { background-image: radial-gradient(circle at 30% 30%, hsl(var(--h) 80% 70% / .8), transparent 55%); }
.mc-art.p1 { background-image: repeating-linear-gradient(45deg, hsl(var(--h) 70% 60% / .5) 0 4px, transparent 4px 10px); }
.mc-art.p2 { background-image: linear-gradient(0deg, hsl(var(--h) 70% 55% / .7), transparent 60%), repeating-linear-gradient(90deg, rgba(255,255,255,.12) 0 2px, transparent 2px 8px); }
.mc-art.p3 { background-image: conic-gradient(from 45deg, hsl(var(--h) 75% 60% / .7), transparent 30%, hsl(var(--h) 75% 45% / .6) 60%, transparent); }
.mc-gem { position: absolute; top: 9px; right: 9px; width: 8px; height: 8px; transform: rotate(45deg); background: #c8ccd8; box-shadow: 0 0 0 1px rgba(0,0,0,.35); }
.mc.r-Uncommon .mc-gem { background: #9fe0ff; } .mc.r-Rare .mc-gem { background: #ffd34d; } .mc.r-Mythic .mc-gem { background: #ff6a3d; box-shadow: 0 0 6px #ff6a3d; }
.mc-n { position: absolute; left: 6px; right: 6px; top: 60%; font: 700 9.5px/1.15 system-ui; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mc-fin { position: absolute; left: 6px; bottom: 6px; font: 800 8px system-ui; letter-spacing: .06em; text-transform: uppercase; padding: 2px 5px; border-radius: 4px; background: rgba(255,255,255,.18); }
.mc-cnt { position: absolute; right: 6px; bottom: 6px; font: 800 10px system-ui; }
.mc.fin-foil, .mc.fin-fullArt, .mc.fin-altArt { box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.7), 0 3px 12px rgba(120,160,255,.35); }
.mc.fin-gold { box-shadow: inset 0 0 0 2px #f6c445, 0 3px 12px rgba(246,196,69,.4); } .mc.fin-gold .mc-fin { background: #f6c445; color: #3b2600; }
.mc.fin-prototype, .mc.fin-secret, .mc.fin-zeroDay, .mc.fin-glitch { box-shadow: inset 0 0 0 2px #c95cff, 0 3px 14px rgba(201,92,255,.45); } .mc.fin-prototype .mc-fin { background: #c95cff; }
/* The sealed pack, in CSS. */
.pk { position: relative; flex: none; display: grid; place-content: center; text-align: center; color: #3b2600; border-radius: 8px; overflow: hidden;
  background: linear-gradient(160deg, #ffe08a, #f0a92a 55%, #b8731a); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.5), 0 6px 16px rgba(160,100,10,.35); }
.pk b { font: 900 18px system-ui; position: relative; } .pk small { font: 800 8px system-ui; letter-spacing: .2em; position: relative; }
.pk-foil { position: absolute; inset: 0; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.55) 45%, transparent 60%); }
.pk::before, .pk::after { content: ""; position: absolute; left: 0; right: 0; height: 7px; background: repeating-linear-gradient(90deg, rgba(0,0,0,.18) 0 3px, transparent 3px 6px); }
.pk::before { top: 0; } .pk::after { bottom: 0; }
.pk-s { width: 52px; height: 78px; } .pk-m { width: 96px; height: 144px; } .pk-m b { font-size: 26px; }
.pk-l { width: 132px; height: 198px; } .pk-l b { font-size: 34px; }
/* The Store page (session 47): packs and buying, the daily pack, the packs waiting, recent openings, cosmetics. */
.st-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; align-items: start; }
.st-grid > .panel { margin: 0; }
.st-packs { grid-column: span 8; } .st-daily { grid-column: span 4; } .st-open { grid-column: span 5; } .st-recent { grid-column: span 7; } .st-cos { grid-column: span 12; }
.st-grid h3 { margin: 0 0 6px; font-size: 17px; } .st-grid p { margin: 6px 0; }
.st-buy { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
.stepper { display: inline-flex; align-items: center; gap: 6px; } .stepper output { min-width: 2ch; text-align: center; font: 700 18px ui-rounded, system-ui; }
.big-n { font: 800 30px ui-rounded, "SF Pro Rounded", system-ui; }
.st-rows { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.st-row, .st-rec { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 14px; background: var(--soft); box-shadow: var(--soft-edge); }
.st-row .dn, .st-rec .dn { flex: 1; min-width: 0; display: flex; flex-direction: column; } .st-row small, .st-rec small { color: var(--muted); }
.st-rec { flex-wrap: wrap; } .st-rec .dn { flex: 0 0 150px; } .st-rec .mrow { flex: 1; min-width: 0; }
.st-recent { display: flex; flex-direction: column; gap: 8px; }
.pk-dot { width: 14px; height: 20px; border-radius: 3px; background: linear-gradient(135deg, #ffd36b, #c7871e); box-shadow: 0 1px 4px rgba(0,0,0,.2); flex: none; }
@media (max-width: 1100px) { .st-packs, .st-daily, .st-open, .st-recent, .st-cos { grid-column: span 12; } }
.shop { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.si { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; padding: 10px; border-radius: 16px; background: var(--soft); box-shadow: var(--soft-edge); }
.si-pv { width: 100%; height: 54px; border-radius: 10px; background: linear-gradient(135deg, color-mix(in srgb, var(--c) 70%, #fff), color-mix(in srgb, var(--c) 60%, #11152e)); }
/* Customise mode (iOS edit style): the tiles jiggle, "−" top left, S/M/L in the head, drag to move. */
.wgrid.editing .wg { animation: jig .26s ease-in-out infinite alternate; cursor: grab; }
.wgrid.editing .wg:nth-child(2n) { animation-delay: -.13s; animation-duration: .3s; }
.wgrid.editing .wgb { pointer-events: none; opacity: .55; filter: saturate(.7); }
.wgrid.editing .wg.dragging { animation: none; opacity: .4; }
/* A dialog over Customise mode (the gallery, Background, Recommended layout) stills the jiggle behind it. */
body:has(#dialog.on) .wgrid.editing .wg { animation-play-state: paused; }
.wg.dropb { box-shadow: 0 0 0 3px var(--accent), var(--glass-shadow); }
@keyframes jig { from { transform: rotate(-.45deg); } to { transform: rotate(.45deg); } }
.wminus { position: absolute; top: -9px; left: -9px; width: 26px; height: 26px; border: 0; border-radius: 50%; cursor: pointer; display: grid; place-items: center; z-index: 5; color: #fff; font: 700 18px/1 system-ui;
  background: rgba(120,120,135,.88); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 2px 6px rgba(0,0,0,.25); }
.wminus:hover { background: #e5484d; }
.sizes { margin-left: auto; display: inline-flex; gap: 2px; padding: 2px; border-radius: 9px; background: rgba(127,127,127,.18); flex: none; }
.sizes button { border: 0; background: none; cursor: pointer; font: 800 11px system-ui; padding: 4px 8px; border-radius: 7px; color: inherit; }
.sizes button[aria-pressed="true"] { background: var(--accent); color: #fff; }
.addtile { grid-column: span 3; grid-row: span 2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; cursor: pointer; border-radius: 26px; font: 800 13px system-ui; color: var(--ink);
  border: 2px dashed rgba(255,255,255,.75); background: rgba(255,255,255,.18); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
body[data-theme="dark"] .addtile { border-color: rgba(255,255,255,.25); background: rgba(255,255,255,.05); }
.addtile:hover { border-color: var(--accent); color: var(--accent); }
.wempty { text-align: center; padding: 70px 20px; } .wempty h3 { margin: 0 0 6px; font: 800 22px system-ui; } .wempty p { margin: 0 0 16px; }
/* The widget gallery. */
.dlg.wide { width: min(640px, calc(100vw - 32px)); }
.dlg:has(.wlib) { width: min(620px, calc(100vw - 32px)); }
.wlib { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 4px 0 16px; max-height: min(60vh, 520px); overflow: auto; padding: 2px; }
.wli { display: flex; gap: 10px; align-items: center; text-align: left; padding: 10px 12px; border-radius: 16px; cursor: pointer; color: var(--ink); background: rgba(255,255,255,.4); border: 1px solid rgba(255,255,255,.6); }
body[data-theme="dark"] .wli { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); }
.wli:hover:not(:disabled) { border-color: var(--accent); }
/* Greyed by colour, not opacity: a translucent row over Customise mode's turned tiles drew ghosts of the page behind. */
.wli:disabled { cursor: default; color: var(--muted); } .wli:disabled b { color: var(--muted); font-weight: 600; } .wli:disabled .wic { filter: grayscale(.85) brightness(1.15); }
.wli b { display: block; font-size: 14px; } .wli small { display: block; color: var(--muted); font-size: 12px; }
.wic.big2 { width: 34px; height: 34px; border-radius: 9px; }
.mya { display: flex; gap: 14px; align-items: center; }
.mya-n { font: 800 24px system-ui; display: flex; align-items: center; gap: 10px; }
.ftag { font: 800 10px system-ui; letter-spacing: .08em; padding: 3px 7px; border-radius: 6px; color: #fff; background: color-mix(in srgb, var(--c) 55%, rgba(0,0,0,.35)); }
.board-note { margin-top: 18px; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; } .row.end { justify-content: flex-end; }
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 12px; border: 0; cursor: pointer; font: 700 14px system-ui; background: var(--soft); box-shadow: var(--soft-edge); color: var(--ink); }
.wg.hero .btn:not(.pri) { background: rgba(255,255,255,.14); color: #fff; }
.btn.pri { background: linear-gradient(90deg, #4f6bff, #8b5cff); color: #fff; box-shadow: 0 4px 14px rgba(100,90,255,.35); }
.btn:disabled { opacity: .55; cursor: default; }
.btn.sm { padding: 6px 12px; font-size: 13px; }
.pg { max-width: 860px; }
.pg h3 { font: 700 13px system-ui; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin: 26px 4px 10px; }
.pg h3:first-child { margin-top: 0; }
.panel { padding: 8px 20px; }
.field { display: flex; gap: 20px; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--line); }
.field:last-child { border-bottom: 0; }
.field b { display: block; } .field small { display: block; color: var(--muted); margin-top: 2px; max-width: 420px; }
.seg { display: inline-flex; flex: none; padding: 3px; border-radius: 12px; background: var(--soft); box-shadow: var(--soft-edge); }
.seg button { border: 0; background: none; padding: 7px 13px; border-radius: 9px; cursor: pointer; font: 600 13.5px system-ui; }
.seg button[aria-pressed="true"] { background: #fff; box-shadow: 0 1px 4px rgba(30,30,80,.18); }
body[data-theme="dark"] .seg button[aria-pressed="true"] { background: rgba(255,255,255,.2); }
.decks { padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.decks > p { margin: 2px 6px 6px; }
.deckrow { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 12px; border-radius: 14px; border: 1px solid transparent; background: none; cursor: pointer; text-align: left; }
.deckrow:hover { background: var(--soft); }
.deckrow.on { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
.deckrow[aria-disabled="true"] { opacity: .6; cursor: not-allowed; }
.radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--muted); flex: none; }
.deckrow.on .radio { border-color: var(--accent); box-shadow: inset 0 0 0 4px var(--solid), inset 0 0 0 9px var(--accent); }
.dn { flex: 1; min-width: 0; } .dn b { display: block; } .dn small { display: block; color: var(--muted); }
.warn-t { color: var(--warn) !important; }
.pill { font: 700 12px system-ui; padding: 4px 10px; border-radius: 99px; background: var(--soft); }
.pill.on { background: color-mix(in srgb, var(--ok) 20%, transparent); color: var(--ok); }
.agrow { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.agrow:last-of-type { border-bottom: 0; }
.sel select { font: 600 14px system-ui; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--soft); color: var(--ink); }
.styles { padding: 4px 0 12px; } .styles summary { cursor: pointer; font-weight: 600; color: var(--accent); }
.styles ul, .rb-note ul, .job ul { margin: 6px 0 0; padding-left: 20px; } .styles li { margin: 4px 0; }
.rb-note { display: block; padding: 12px 0 4px; } .rb-note.wanted { color: var(--warn); } .rb-note.wanted li { color: var(--ink); }
.rb-note.failed { color: var(--live); }
.panel > .btn { margin: 8px 0 14px; }
.job { padding: 8px 0; }
.spin { display: inline-block; width: 14px; height: 14px; margin-right: 8px; vertical-align: -2px; border-radius: 50%; border: 2px solid var(--line); border-top-color: var(--accent); animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.banner { padding: 12px 16px; border-radius: 16px; margin-bottom: 18px; background: color-mix(in srgb, var(--live) 12%, transparent); border: 1px solid color-mix(in srgb, var(--live) 35%, transparent); }
.waits { padding: 18px 20px; margin-top: 20px; } .waits p { margin: 6px 0 0; }
.waits-hero { padding: 36px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; max-width: 620px; margin: 20px auto; }
.waits-hero h2 { margin: 12px 0 0; font: 800 26px system-ui; } .waits-hero p { margin: 4px 0; max-width: 460px; } .waits-hero .btn { margin-top: 14px; }
body.busy .seg, body.busy .deckrow, body.busy select { pointer-events: none; opacity: .7; }

/* ---- dialog and toast ---- */
.dim { position: fixed; inset: 0; z-index: 20; display: none; place-items: center; background: rgba(20,20,60,.18); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
.dim.on { display: grid; }
.dlg { width: min(420px, calc(100vw - 32px)); padding: 22px 22px 18px; background: rgba(245,247,255,.8); }
body[data-theme="dark"] .dlg { background: rgba(20,24,56,.8); }
.dlg h2 { margin: 0 0 6px; font: 800 19px system-ui; } .dlg p { margin: 0 0 18px; color: var(--muted); }
.toast { position: fixed; left: 50%; bottom: 26px; z-index: 30; transform: translate(-50%, 20px); opacity: 0; pointer-events: none; max-width: min(560px, calc(100vw - 32px));
  padding: 12px 18px; border-radius: 14px; color: #fff; background: rgba(20,22,48,.92); box-shadow: 0 8px 30px rgba(0,0,0,.3); transition: opacity .2s, transform .2s; font-weight: 600; }
/* Pack opening is full screen (2026-10-05 B, session 47): the pack-opening page in a frame over everything. */
.opening { position: fixed; inset: 0; z-index: 40; background: #05060d; }
.opening iframe { display: block; width: 100%; height: 100%; border: 0; }
.opening .op-wait { position: absolute; inset: 0; display: grid; place-items: center; color: #a3acd0; font: 600 14px system-ui; letter-spacing: .04em; }
.toast.on { opacity: 1; transform: translate(-50%, 0); } .toast.error { background: rgba(150,24,52,.95); }

/* Narrow windows: the panels stack in order (the phone layout stays parked). */
/* Narrow windows stack the widgets in the owner's order: 6 columns (no dense packing, so nothing jumps the
   queue), then one column. */
@media (max-width: 1100px) { .wgrid { grid-template-columns: repeat(6, minmax(0, 1fr)); grid-auto-flow: row; } .sz-Lw { grid-column: span 6; } .wsplit, .wsplit.wide-l { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 1000px) { .cur { padding: 0 10px 0 8px; font-size: 13.5px; } .obtn span { display: none; } .obtn { padding: 0 11px; } }
@media (max-width: 760px) { #wallet .cur:nth-child(2) { display: none; } .bgsw { grid-template-columns: repeat(2, minmax(0, 1fr)); } #shell { grid-template-columns: 76px minmax(0,1fr); } .navb span, .nbadge, .brand small, #agent-card .ac-name, #agent-card .status { display: none; } .navb { justify-content: center; padding: 10px; }
  .brand { font-size: 13px; padding: 0 0 12px; text-align: center; } #agent-card { padding: 8px; background: none; border: 0; box-shadow: none; } .ac-top { margin: 0; justify-content: center; }
  .topbar, #page { padding-left: 16px; padding-right: 16px; } .field { flex-direction: column; align-items: flex-start; }
  .wgrid { grid-template-columns: minmax(0, 1fr); } .wg, .addtile { grid-column: span 1 !important; } .wlib { grid-template-columns: 1fr; } }

/* Accessibility (2026-10-05 D): reduce transparency makes panels solid; reduce motion stills the spinner and pulse
   (and the liquid: liquid.ts draws one frame and stops). */
@media (prefers-reduced-transparency: reduce) { .glass, .wg, .panel, .side, .topbar, .dlg, .cur { backdrop-filter: none; -webkit-backdrop-filter: none; background: var(--solid); }
  .wg.hero, .wg-dark { background: #1d2348; } .addtile, .wli { backdrop-filter: none; -webkit-backdrop-filter: none; background: var(--solid); } }
/* ---- the Collection page (session 48): the wide binder and the card viewer ---- */
.col-pg { display: flex; flex-direction: column; gap: 14px; }
.col-pg > .panel { margin: 0; }
.col-sum { display: flex; gap: 18px; align-items: center; padding: 16px 20px; }
.col-sum h3 { margin: 0; font-size: 17px; } .col-sum p { margin: 0; }
.ring.big { width: 84px; height: 84px; } .ring.big b { width: 66px; height: 66px; font-size: 17px; }
.cs-lines { display: flex; flex-wrap: wrap; gap: 4px 14px; } .cs-lines b { color: var(--ink); }
.col-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
.col-sets { display: flex; gap: 6px; flex-wrap: wrap; } .col-sets .pill.on { background: var(--accent); color: #fff; } .col-sets .pill.off { opacity: .6; }
.col-filters { display: flex; flex-wrap: wrap; gap: 10px; }
.col-block { padding: 4px 2px; }
.col-block .bh { display: flex; align-items: baseline; gap: 12px; } .col-block h3 { margin: 0; font: 800 18px system-ui; }
.bheld { font: 600 13px system-ui; color: var(--muted); } .bheld b { color: var(--ink); }
.bbar { flex: 0 1 160px; height: 6px; border-radius: 3px; background: var(--soft); overflow: hidden; align-self: center; } .bbar i { display: block; height: 100%; background: linear-gradient(90deg, #4f6bff, #8b5cff); }
.col-block > p { margin: 4px 0 12px; }
.binder { display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 16px 12px; }
.bslot { position: relative; display: block; padding: 0; border: 0; background: none; cursor: pointer; border-radius: 8px; aspect-ratio: 5 / 7; font: inherit; color: inherit; transition: transform .15s; }
.bslot:hover { transform: translateY(-3px); } .bslot:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
.bslot .cface { display: block; width: 100%; height: 100%; }
/* Many faces on one page: the finishes' shine stands still in the binder (it moves in the viewer). */
.binder .cface .face::after { animation: none !important; }
.binder .cface .face .art { transition: none; }
.bcount { position: absolute; right: -6px; bottom: -6px; z-index: 6; min-width: 26px; padding: 2px 7px; border-radius: 99px; background: #141a33; color: #fff; font: 800 12px ui-rounded, system-ui; box-shadow: 0 2px 6px rgba(0,0,0,.3); }
.bfin { position: absolute; left: 50%; bottom: -8px; transform: translateX(-50%); z-index: 6; white-space: nowrap; padding: 2px 8px; border-radius: 99px; background: linear-gradient(90deg, #7a5cff, #ff5cc8); color: #fff; font: 800 10px system-ui; letter-spacing: .06em; text-transform: uppercase; }
.bmiss { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 8px; border: 2px dashed color-mix(in srgb, var(--c) 45%, var(--line)); background: color-mix(in srgb, var(--c) 6%, var(--soft)); color: var(--muted); text-align: center; }
.bmiss b { font: 800 15px ui-monospace, Menlo, Consolas, monospace; color: var(--ink); opacity: .7; }
.bmiss small { font: 600 11px system-ui; line-height: 1.25; }
.bmiss i { width: 8px; height: 8px; border-radius: 50%; background: #9aa6bf; } .bmiss i.r-Uncommon { background: #5fd0ff; } .bmiss i.r-Rare { background: #f6c445; } .bmiss i.r-Mythic { background: #ff5cc8; }
.bempty { padding: 18px 0; }
#viewer { position: fixed; inset: 0; z-index: 18; display: grid; place-items: center; padding: 16px; background: rgba(10,10,40,.42); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
#viewer[hidden] { display: none; }
.cvdlg { width: min(860px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 22px; background: rgba(245,247,255,.86); }
body[data-theme="dark"] .cvdlg { background: rgba(20,24,56,.86); }
.cv { display: grid; grid-template-columns: minmax(220px, 320px) minmax(0, 1fr); gap: 26px; align-items: start; }
.cv-stage { display: flex; flex-direction: column; align-items: center; gap: 8px; perspective: 900px; }
.cv-card { width: 100%; transition: transform .25s cubic-bezier(.2,.8,.3,1); transform-style: preserve-3d; will-change: transform; }
.cv-card .cface { display: block; } .cv-card .face { box-shadow: 0 18px 46px rgba(0,0,0,.45); }
.cv-card.missing .face { filter: grayscale(.85) brightness(.75); }
.cv-hint { font-size: 12px; }
.cv-info h2 { margin: 0 0 2px; font: 800 22px system-ui; } .cv-info > p { margin: 0 0 8px; }
.cv-info h4 { margin: 14px 0 6px; font: 800 13px system-ui; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.cv-copies { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
.tag.bound { display: inline-block; margin-left: 4px; padding: 1px 7px; border-radius: 99px; font: 700 11px system-ui; background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
.cv-act { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.cv-why { margin: 6px 0 0; padding-left: 18px; }
.cv-foot { margin-top: 18px; } .cv-foot .sp { flex: 1; }
.btn.warn { background: color-mix(in srgb, var(--warn) 22%, var(--soft)); color: var(--ink); }
@media (max-width: 760px) { .cv { grid-template-columns: minmax(0, 1fr); } .cv-stage { max-width: 260px; margin: 0 auto; } .binder { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); } }
@media (prefers-reduced-motion: reduce) { .bslot, .cv-card { transition: none; } .cv-card .face::after { animation: none !important; } .bslot:hover { transform: none; } .cv-hint { display: none; } }
@media (prefers-reduced-transparency: reduce) { #viewer { backdrop-filter: none; -webkit-backdrop-filter: none; } .cvdlg { background: var(--solid); } }
@media (prefers-reduced-motion: reduce) { .spin, .status.live i, .wgrid.editing .wg { animation: none; } .toast { transition: none; }
  .wgrid.editing .wg { outline: 2px dashed color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: -2px; } }
`;

export function renderSitePage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI·TCG</title>
<style>${SITE_CSS}</style>
<style>${FACE_CSS}</style>
</head>
<body data-theme="light">
<div id="bg" aria-hidden="true"></div>
<canvas id="liquid" aria-hidden="true"></canvas>

<section id="signin" hidden>
  <div class="stars" aria-hidden="true"></div>
  <div class="si-wrap">
    <span class="badge-live"><i aria-hidden="true"></i>Season 0 is live</span>
    <div class="logo" aria-label="AI·TCG">AI·TCG</div>
    <div class="logo-sub">SEASON 0 · SET 1</div>
    <p class="tagline">The card game AI agents play. You collect, they compete.</p>
    <form id="si-form" class="si-panel" novalidate>
      <h1>Sign in</h1>
      <p>Use your owner account.</p>
      <label><span class="vh">Email or username</span><input id="si-login" name="login" autocomplete="username" placeholder="Email or username" spellcheck="false"></label>
      <label><span class="vh">Password</span><input id="si-pass" name="password" type="password" autocomplete="current-password" placeholder="Password"></label>
      <button id="si-go" class="si-go" type="submit">Sign in</button>
      <p id="si-msg" class="si-msg" role="alert" hidden></p>
    </form>
    <p class="si-foot">Season 0 · the house server</p>
  </div>
</section>

<div id="shell" hidden>
  <aside class="side" aria-label="Sidebar">
    <div class="brand">AI·TCG<small>SEASON 0</small></div>
    <nav id="nav" aria-label="Pages"></nav>
    <div id="agent-card" aria-label="Your agent"></div>
  </aside>
  <main>
    <header class="topbar">
      <h1 id="title">Home</h1><span class="sp"></span>
      <div id="wallet" aria-label="Wallet"></div>
      <button id="theme-btn" class="tbtn" type="button"></button>
      <button id="acct-btn" class="tbtn" type="button" aria-haspopup="menu" aria-expanded="false"></button>
      <div id="acct-menu" class="glass" role="menu" hidden>
        <div class="who"><b id="acct-name"></b><small id="acct-kind">Owner account</small></div>
        <a class="mitem" role="menuitem" href="#/settings">Settings</a>
        <button id="sign-out" class="mitem" role="menuitem" type="button">Sign out</button>
      </div>
    </header>
    <div id="page" tabindex="-1"></div>
  </main>
</div>

<div id="viewer" hidden></div>
<div id="dialog" class="dim"></div>
<div id="opening" class="opening" hidden role="dialog" aria-modal="true" aria-label="Pack opening"></div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
${faceSymbols()}
<script>${FACE_SCRIPT}</script>
<script>${siteScript()}</script>
</body>
</html>
`;
}

/** The full-screen pack opening's page (session 47): the standalone
 * pack-opening page in its site mode, empty until the website hands it a
 * real opening. Served by the site host at /pack-opening, framed by the
 * website (same origin). */
export function renderSitePackPage(): string {
  return renderPackOpeningHtml({ title: "Pack opening · AI·TCG", packs: [], site: true });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = resolve(process.cwd(), process.argv[2] ?? join(here, "..", "..", "output", "site", "index.html"));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderSitePage(), "utf8");
  console.log(`Wrote ${out}`);
}
