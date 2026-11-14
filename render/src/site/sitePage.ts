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

import { FACE_CSS, FACE_SCRIPT, boastGlyphSymbols, faceSymbols } from "./siteFaces.js";
import { SHOP_CSS } from "./siteShopCss.js";
import { BELL_CSS } from "./siteBell.js";
import { COIN_SCRIPT } from "./siteCoins.js";
import { buildSync } from "esbuild";
import { renderPackOpeningHtml } from "../packPage.js";
import { packWardRings } from "../packWards.js";
import { renderLoadoutHtml } from "../loadoutPicker.js";
import { CLOSE_WIN_HEALTH } from "../../../economy/src/cosmetics.js";
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
/* The Store page (session 47): packs and buying, the daily pack, the packs waiting, recent openings, cosmetics. */
.st-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; align-items: start; }
.st-grid > .panel { margin: 0; }
.st-packs { grid-column: span 8; } .st-daily { grid-column: span 4; } .st-open { grid-column: span 5; } .st-col .st-open { grid-column: auto; } .st-recent { grid-column: span 7; } .st-cos { grid-column: span 12; }
.st-grid h3 { margin: 0 0 6px; font-size: 17px; } .st-grid p { margin: 6px 0; }
.st-buy { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
.big-n { font: 800 30px ui-rounded, "SF Pro Rounded", system-ui; }
.st-rows { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.st-row, .st-rec, .st-agent { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 14px; background: var(--soft); box-shadow: var(--soft-edge); }
.st-row .dn, .st-rec .dn, .st-agent .dn { flex: 1; min-width: 0; display: flex; flex-direction: column; } .st-row small, .st-rec small, .st-agent small { color: var(--muted); }
.st-rec { flex-wrap: wrap; } .st-rec .dn { flex: 0 0 150px; } .st-rec .mrow { flex: 1; min-width: 0; }
.st-recent { display: flex; flex-direction: column; gap: 8px; }
.pk-dot { width: 14px; height: 20px; border-radius: 3px; background: linear-gradient(135deg, #ffd36b, #c7871e); box-shadow: 0 1px 4px rgba(0,0,0,.2); flex: none; }
@media (max-width: 1100px) { .st-packs, .st-daily, .st-open, .st-recent, .st-cos { grid-column: span 12; } }
.shop { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.si { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; padding: 10px; border-radius: 16px; background: var(--soft); box-shadow: var(--soft-edge); }
.si-pv { width: 100%; height: 54px; border-radius: 10px; background: linear-gradient(135deg, color-mix(in srgb, var(--c) 70%, #fff), color-mix(in srgb, var(--c) 60%, #11152e)); }
/* A coin's swatch (render session 55): the coin drawn on a dark plate. */
.si-pv.si-coin { display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 40%, #1d2340, #05070e 75%); }
.si-pv.si-coin canvas { display: block; }
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
/* The faction lock (render session 76): a faction that can't be built yet is greyed with its count, still pressable. */
#faction-lock button.short { color: var(--muted); }
#faction-lock button.short[aria-pressed="true"] { color: var(--warn); }
#faction-lock .lk { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 99px; border: 1px dashed currentColor; font: 700 11px ui-monospace, monospace; vertical-align: 1px; opacity: .9; }
.lock-note { margin: -4px 0 12px; font-size: 13px; line-height: 1.45; }
.lock-note.muted { color: var(--muted); }
.lock-note.warn { color: var(--warn); padding: 9px 12px; border-radius: 12px; background: color-mix(in srgb, var(--warn) 10%, transparent); }
.lock-note a { color: inherit; font-weight: 700; }
@media (max-width: 760px) { .field:has(#faction-lock) { flex-direction: column; align-items: stretch; gap: 10px; } #faction-lock { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); } #faction-lock button { text-align: left; white-space: nowrap; } }
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
/* The loadout picker (session 49) is the same kind of overlay; its Buy asks with the website's own confirm, and the website's toasts show, above it. */
body:has(#dress:not([hidden])) #dialog { z-index: 45; }
body:has(#dress:not([hidden])) .toast { z-index: 46; }
body:has(#replay:not([hidden])) .toast { z-index: 46; }
.st-col { grid-column: span 5; display: flex; flex-direction: column; gap: 16px; min-width: 0; } .st-col > .panel { margin: 0; }
@media (max-width: 1100px) { .st-col { grid-column: span 12; } }
.st-agent .dn small { display: block; }
.opening .op-wait { position: absolute; inset: 0; display: grid; place-items: center; color: #a3acd0; font: 600 14px system-ui; letter-spacing: .04em; }
.toast.on { opacity: 1; transform: translate(-50%, 0); } .toast.error { background: rgba(150,24,52,.95); }

/* Narrow windows: the panels stack in order (the phone layout stays parked). */
/* Narrow windows stack the widgets in the owner's order: 6 columns (no dense packing, so nothing jumps the
   queue), then one column. */
@media (max-width: 1100px) { .wgrid { grid-template-columns: repeat(6, minmax(0, 1fr)); grid-auto-flow: row; } .sz-Lw { grid-column: span 6; } .wsplit, .wsplit.wide-l { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 1000px) { .cur { padding: 0 10px 0 8px; font-size: 13.5px; } .obtn span { display: none; } .obtn { padding: 0 11px; } }
@media (max-width: 760px) { #wallet .cur:nth-child(2) { display: none; } .bgsw { grid-template-columns: repeat(2, minmax(0, 1fr)); } #shell { grid-template-columns: 76px minmax(0,1fr); } .navb span, .navb .nbadge, .brand small, #agent-card .ac-name, #agent-card .status { display: none; } .navb { justify-content: center; padding: 10px; }
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
.cv-origin { margin: 0 0 4px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; line-height: 1.4; }
.cv-origin .tag.org { font: 800 11px system-ui; letter-spacing: .06em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; background: rgba(120,130,160,.18); color: var(--ink); white-space: nowrap; }
.cv-origin[data-origin="booster"] .tag.org { background: linear-gradient(110deg, rgba(122,92,255,.25), rgba(255,92,200,.25)); }
.cv-vers h4 { margin-top: 10px; }
.cv-vers .vrow { display: flex; flex-wrap: wrap; gap: 6px; }
.vchip { font: 700 12px system-ui; padding: 4px 9px; border-radius: 999px; border: 1px dashed rgba(128,138,170,.6); background: transparent; color: var(--muted); cursor: pointer; }
.vchip small { font-weight: 600; opacity: .8; }
.vchip.held { border-style: solid; color: var(--ink); background: rgba(120,130,160,.14); }
.vchip.on { cursor: default; border-style: solid; border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
button.vchip:hover, button.vchip:focus-visible { border-color: var(--accent); color: var(--ink); }
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
/* ---- the match pages (render session 50): auto-play, the live scoreboard, match history, the replay ---- */
.switch { display: inline-flex; align-items: center; gap: 8px; border: 0; background: none; padding: 2px 0; font: 700 13px system-ui; color: inherit; cursor: pointer; }
.switch i { position: relative; width: 38px; height: 22px; border-radius: 11px; background: rgba(120,128,160,.45); transition: background .2s; flex: none; }
.switch i::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .2s; }
.switch.on i { background: var(--ok); } .switch.on i::after { transform: translateX(16px); }
.switch[disabled] { opacity: .5; cursor: default; } .switch:focus-visible i { outline: 2px solid var(--accent); outline-offset: 2px; }
.wcol.right { align-items: flex-end; text-align: right; max-width: 300px; }
.banner.warn { background: color-mix(in srgb, var(--warn) 14%, transparent); border-color: color-mix(in srgb, var(--warn) 40%, transparent); }
.panel.dark, .live-card { color: #fff; background: linear-gradient(140deg, rgba(20,26,62,.86), rgba(38,28,92,.82)); border: 1px solid rgba(255,255,255,.14); padding: 14px 18px; border-radius: 22px; }
.panel.dark .muted, .live-card .muted { color: #c6cbe8; } .panel.dark a { color: #b9c4ff; }
.live-card { margin-bottom: 14px; display: flex; flex-direction: column; gap: 10px; }
.watch-as { display: inline-flex; align-items: center; gap: 2px; align-self: flex-start; max-width: 100%; padding: 3px; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); margin-top: 6px; }
.watch-as .wa-l { padding: 0 8px 0 6px; opacity: .8; white-space: nowrap; }
.wa-b { border: 0; background: none; color: inherit; font: 700 12.5px system-ui; padding: 6px 12px; min-height: 32px; border-radius: 999px; cursor: pointer; max-width: 14ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wa-b.on { background: #fff; color: #1b1f45; box-shadow: 0 0 0 1px rgba(27,31,69,.18); } .wa-b:not(.on):hover { background: rgba(255,255,255,.12); } .wa-b:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.sb { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); gap: 12px; align-items: center; width: 100%; }
.sb-side { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 8px 10px; border-radius: 14px; background: rgba(255,255,255,.07); border: 1px solid transparent; }
.sb-side.far { text-align: right; align-items: flex-end; }
.sb-side.turn { border-color: rgba(255,207,92,.7); box-shadow: 0 0 0 1px rgba(255,207,92,.25) inset; }
.sb-side.won { border-color: #3cc47c; background: rgba(60,196,124,.16); }
.sb-side.mine .sb-name b::after { content: " (you)"; font-weight: 600; opacity: .7; }
.sb-name { display: flex; flex-direction: column; min-width: 0; } .sb-name b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.sb-hp { display: flex; align-items: center; gap: 8px; width: 100%; } .sb-side.far .sb-hp { flex-direction: row-reverse; }
.sb-hp b { font: 800 22px system-ui; font-variant-numeric: tabular-nums; min-width: 2ch; }
.sb-hp .bar { flex: 1; height: 8px; border-radius: 4px; background: rgba(255,255,255,.14); overflow: hidden; display: block; }
.sb-hp .bar i { display: block; height: 100%; background: linear-gradient(90deg,#ff5d73,#ffcf5c,#3cc47c); background-size: 300% 100%; background-position: 100% 0; border-radius: 4px; transition: width .4s; }
.sb-side.far .sb-hp .bar { transform: scaleX(-1); }
.sb-mid { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12.5px; text-align: center; max-width: 160px; }
.live-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--live); animation: pulse 1.4s ease-in-out infinite; }
.sb-s .sb-meta { display: none; } .sb-s .sb-hp b { font-size: 17px; } .sb-s { gap: 6px; } .sb-s .sb-mid { max-width: 90px; }
/* Render session 67: where the score is narrow (Watch live at S, the arena's column at L) the turn line goes on
   top and the two sides sit under it, side by side; at S without the owner and rating line. */
.sz-S .sb, .wl-info .sb { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
.sz-S .sb-mid, .wl-info .sb-mid { grid-column: 1 / -1; grid-row: 1; flex-direction: row; justify-content: center; max-width: none; min-width: 0; font-size: 11.5px; white-space: nowrap; }
.sz-S .sb-mid b, .wl-info .sb-mid b { overflow: hidden; text-overflow: ellipsis; }
.sz-S .sb-name small { display: none; } .sz-S .sb-side { padding: 6px 9px; }
.sb-line { margin: 6px 2px 0; color: #dfe4ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wg:not(.wg-dark) .sb-side { background: var(--soft); } .wg:not(.wg-dark) .sb-line { color: inherit; }
.cboard { display: flex; flex-direction: column; gap: 6px; width: 100%; margin-top: 6px; padding: 8px; border-radius: 14px; background: rgba(0,0,0,.18); }
.cb-row { display: flex; gap: 5px; flex-wrap: wrap; min-height: 26px; align-items: center; } .cb-row + .cb-row { border-top: 1px dashed rgba(255,255,255,.18); padding-top: 6px; }
.uc { font: 600 11.5px system-ui; padding: 3px 8px; border-radius: 8px; background: rgba(255,255,255,.14); white-space: nowrap; font-variant-numeric: tabular-nums; }
.uc b { font-weight: 700; } .uc.pend { border: 1px dashed rgba(255,207,92,.8); background: transparent; }
/* Watch live at L (render session 67): the live match on the real arena, embedded. The page scales the arena's
   frame to .wl-arena (siteClient.ts mountTileArena); the compact board stands in until it has loaded, and on a
   phone, where the frame isn't made. Clicking the arena opens it full screen. */
.wl-l { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 300px); gap: 16px; flex: 1; min-height: 0; }
.wl-arena { position: relative; min-height: 0; border-radius: 16px; overflow: hidden; background: #070912; border: 1px solid rgba(255,255,255,.12); display: flex; flex-direction: column; justify-content: center; }
.wl-frame { position: absolute; inset: 0; }
.wl-frame iframe { position: absolute; left: 0; top: 0; border: 0; transform-origin: 0 0; pointer-events: none; opacity: 0; transition: opacity .4s ease; }
.wl-arena.on .wl-frame iframe { opacity: 1; }
.wl-fallback { padding: 10px; }
.wl-arena.on .wl-fallback, .wl-arena:not(.joining) .wl-wait { display: none; }
.wl-wait { position: absolute; left: 12px; top: 10px; font: 600 12px system-ui; color: #c9d2ff; letter-spacing: .02em; }
.wl-wait::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 7px; border-radius: 50%; background: var(--live); animation: pulse 1.4s ease-in-out infinite; }
.wl-open { position: absolute; inset: 0; z-index: 2; border: 0; background: transparent; cursor: zoom-in; display: flex; align-items: flex-end; justify-content: flex-end; padding: 10px; color: #fff; font: 600 12px system-ui; border-radius: 16px; }
.wl-open span { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; background: rgba(8,10,20,.72); border: 1px solid rgba(255,255,255,.22); opacity: .78; transition: opacity .2s ease; }
.wl-open:hover span, .wl-open:focus-visible span { opacity: 1; }
.wl-open:focus-visible { outline: 2px solid #fff; outline-offset: -3px; }
.wl-open:disabled { cursor: default; } .wl-open:disabled span { display: none; }
.wl-arena.on[data-ended="true"]::after { display: none; }
.wl-arena[data-ended="true"]::after { content: "MATCH OVER"; position: absolute; left: 12px; top: 10px; z-index: 1; font: 700 11px system-ui; letter-spacing: .14em; padding: 3px 8px; border-radius: 6px; background: rgba(8,10,20,.72); color: #ffcf5c; }
.wl-info { display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 0; overflow: auto; scrollbar-width: thin; }
.wl-info h4 { margin-top: 4px; }
@media (max-width: 720px) { .wl-l { grid-template-columns: minmax(0, 1fr); flex: none; } .wl-arena { overflow: visible; justify-content: flex-start; } .wl-frame, .wl-wait { display: none !important; } .wl-arena.on .wl-fallback { display: block; } .wl-open { position: static; padding: 0 10px 10px; } .wl-arena[data-ended="true"]::after { position: static; align-self: flex-start; margin: 10px 0 0 10px; } }
.lines { list-style: none; margin: 4px 0; padding: 0; display: flex; flex-direction: column; gap: 4px; width: 100%; }
.lline { display: flex; align-items: center; gap: 6px; font-size: 13px; white-space: nowrap; overflow: hidden; } .lline small { overflow: hidden; text-overflow: ellipsis; }
.lhp { font: 800 13px system-ui; font-variant-numeric: tabular-nums; padding: 1px 6px; border-radius: 6px; background: rgba(255,255,255,.14); }
.pbp { margin: 0; padding: 0 0 0 30px; display: flex; flex-direction: column; gap: 3px; max-height: 220px; overflow: auto; width: 100%; }
.m-live-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 20px; width: 100%; }
.m-agent { padding: 14px 20px; } .m-agent .mya-n { font: 800 18px system-ui; }
.hlist { list-style: none; margin: 8px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; }
.hrow { display: grid; grid-template-columns: 26px minmax(0,1fr) auto auto; gap: 10px; align-items: center; padding: 6px 4px; border-bottom: 1px solid var(--line); }
.hrow:last-child { border-bottom: 0; }
.hr-main { display: flex; flex-direction: column; min-width: 0; } .hr-main .hr-vs { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hr-num { display: flex; flex-direction: column; align-items: flex-end; font-size: 13px; white-space: nowrap; }
.hr-act { display: flex; gap: 6px; align-items: center; }
.rt.up { color: var(--ok); } .rt.down { color: var(--live); } .rt.flat, .rt.none { color: var(--muted); }
.wl.d { background: #8f8cff; } .wl.x { background: #9aa0b8; } .wl.big { width: 40px; height: 40px; border-radius: 12px; font-size: 18px; flex: none; }
/* Render session 57: My agent and Agent controls (the Season 0 brief, section 1). */
.ma-head { display: flex; align-items: center; gap: 12px; min-width: 0; } .ma-head .mya-t { flex: 1; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.ma-head .mya-n { font: 800 19px system-ui; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: block; } .sz-S .ma-head .mya-n { font-size: 15px; }
.ma-rt { display: flex; flex-direction: column; align-items: flex-end; flex: none; line-height: 1.05; } .ma-rt b { font: 800 26px ui-rounded, system-ui; font-variant-numeric: tabular-nums; } .sz-S .ma-rt b { font-size: 21px; }
.ma-chips { display: flex; flex-wrap: wrap; gap: 6px; } .chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 99px; background: rgba(255,255,255,.12); font: 600 12.5px system-ui; }
.chip b.w { color: #5fe39a; } .chip b.l { color: #ff8a9b; } .chip.hot { background: color-mix(in srgb, #3cc47c 34%, transparent); } .chip.cold { background: color-mix(in srgb, #ff5d73 30%, transparent); }
.ma-trend { width: 100%; } .trend { display: block; width: 100%; max-width: 360px; height: auto; overflow: visible; }
.trend .tr-line { fill: none; stroke: #8fb3ff; stroke-width: 2.4; stroke-linejoin: round; stroke-linecap: round; } .trend .tr-area { fill: rgba(143,179,255,.16); stroke: none; }
.trend.up .tr-line { stroke: #5fe39a; } .trend.up .tr-area { fill: rgba(95,227,154,.16); } .trend.down .tr-line { stroke: #ff8a9b; } .trend.down .tr-area { fill: rgba(255,138,155,.14); }
.trend .tr-dot { fill: #fff; }
.ac-top { display: flex; align-items: center; gap: 14px; min-width: 0; } .ac-top .wcol { gap: 5px; } .ac-n { font: 800 17px system-ui; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.tring { position: relative; flex: none; display: grid; place-items: center; }
.tring > svg { position: absolute; inset: 0; } .tring .tr-bg { fill: none; stroke: rgba(255,255,255,.14); stroke-width: 6; }
.tring .tr-fg { fill: none; stroke: var(--c); stroke-width: 6; stroke-linecap: round; transition: stroke-dasharray .8s ease; filter: drop-shadow(0 0 4px color-mix(in srgb, var(--c) 70%, transparent)); }
.tring.t-low .tr-fg { stroke: #ffb347; } .tring.t-finish .tr-bg { stroke: rgba(255,179,71,.5); animation: pulse 1.4s ease-in-out infinite; } .tring.t-done .tr-bg { stroke: rgba(255,255,255,.08); } .tring.t-off .av { filter: grayscale(.7) brightness(.8); }
.tring .av { border-radius: 50%; }
/* Render session 72: waiting for the first pairing (the clock not started): the ring full but dimmed and dashed,
   breathing slowly, so it reads as set and not yet running; the centre keeps the minutes chosen. */
.tring.t-wait .tr-fg { stroke-dasharray: 3 7 !important; opacity: .8; filter: none; animation: twait 2.4s ease-in-out infinite; }
.tring.t-wait .tr-c { box-shadow: 0 0 0 1.5px rgba(255,255,255,.35); }
@keyframes twait { 50% { opacity: .35; } }
/* Render session 72: the season's end under the ladder's title (GET /api/season). */
.st-season { margin: 2px 0 10px; font-size: 13px; color: var(--muted); } .st-season b { display: inline-block; margin-right: 6px; padding: 1px 8px; border-radius: 99px; font-size: 11.5px; color: var(--ink); background: color-mix(in srgb, var(--accent) 16%, transparent); }
.st-season.t-ending b { background: rgba(255,179,71,.3); } .st-season.t-ended b { background: rgba(140,140,160,.25); }
.ac-note { opacity: .92; font-weight: 650; line-height: 1.2; font-size: 11px; letter-spacing: -.1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.tring .tr-c { position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); padding: 2px 8px; border-radius: 99px; background: rgba(10,12,30,.9); color: #fff; font: 800 12px ui-rounded, system-ui; white-space: nowrap; box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--c) 70%, transparent); }
.tring .tr-c small { font-size: 9.5px; margin-left: 2px; opacity: .8; } .tring .tr-c.word { font-size: 10px; }
.btn.ss { min-width: 76px; } .btn.ss.stop { background: rgba(255,93,115,.22) !important; color: #fff; }
.ac-mid { display: flex; gap: 16px; align-items: flex-start; } .wcol.tight { gap: 4px; } .wcol.tgrp { flex: none; }
.dial { display: flex; gap: 12px; align-items: center; } .dn-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; max-width: 220px; } .dn-txt b { font: 800 16px system-ui; }
.dn-knob { position: relative; flex: none; border-radius: 50%; background: radial-gradient(circle at 50% 40%, rgba(255,255,255,.16), rgba(10,12,30,.55) 70%); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.18), 0 6px 18px rgba(0,0,0,.25); }
.dn-face { position: absolute; inset: 22%; border-radius: 50%; background: radial-gradient(circle at 40% 30%, #3b4270, #151a38 75%); box-shadow: 0 3px 10px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.2); }
.dn-face i { position: absolute; inset: 0; transition: transform .45s cubic-bezier(.3,1.5,.5,1); } .dn-face i::after { content: ""; position: absolute; left: 50%; top: 9%; width: 4px; height: 30%; margin-left: -2px; border-radius: 2px; background: var(--c, #8fb3ff); box-shadow: 0 0 6px var(--c, #8fb3ff); }
.dn-stop { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; padding: 0; border-radius: 50%; border: 0; background: rgba(255,255,255,.28); cursor: pointer; transition: transform .15s, background .15s; }
.dn-stop:hover { transform: scale(1.25); background: rgba(255,255,255,.55); } .dn-stop.on { background: var(--c, #8fb3ff); box-shadow: 0 0 0 3px rgba(255,255,255,.25), 0 0 10px var(--c, #8fb3ff); }
.dn-stop:focus-visible { outline: 2px solid #fff; outline-offset: 2px; } .dn-stop[disabled] { cursor: default; opacity: .6; }
.tbtns { display: flex; gap: 5px; flex-wrap: nowrap; } .tbtns .btn { padding-left: 9px; padding-right: 9px; white-space: nowrap; } .tbtns .btn[disabled] { opacity: .5; }
.dsw { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.dsw-o { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color: inherit; text-align: left; cursor: pointer; font: inherit; }
.dsw-o i { width: 10px; height: 10px; border-radius: 50%; flex: none; box-shadow: inset 0 0 0 2px var(--c); } .dsw-o.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 22%, transparent); } .dsw-o.on i { background: var(--c); }
.dsw-o span { display: flex; flex-direction: column; min-width: 0; } .dsw-o small { opacity: .75; font-size: 11.5px; } .dsw-o[disabled] { opacity: .5; cursor: default; }
@media (prefers-reduced-motion: reduce) { .tring .tr-fg, .dn-face i { transition: none; } .tring.t-finish .tr-bg, .tring.t-wait .tr-fg { animation: none; } }
/* Render session 65: Ladder, Rating & form and Notifications on the server's data (siteStanding.ts). */
.tbadge { position: relative; flex: none; display: inline-grid; place-items: center; width: var(--s); height: var(--s); filter: drop-shadow(0 2px 6px color-mix(in srgb, var(--t) 45%, transparent)); }
.tbadge .tb-o { fill: color-mix(in srgb, var(--t) 70%, #10142e); } .tbadge .tb-i { fill: var(--t); } .tbadge .tb-h { fill: rgba(255,255,255,.42); }
.tbadge.plc { filter: none; } .tbadge.plc .tb-o { fill: transparent; stroke: var(--t); stroke-width: 1.6; stroke-dasharray: 3 2.4; } .tbadge.plc .tb-i { fill: color-mix(in srgb, var(--t) 30%, transparent); } .tbadge.plc .tb-h { fill: transparent; }
.ld-head, .fm-head { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ld-k, .ld-rt, .fm-v, .fm-w { display: flex; flex-direction: column; line-height: 1.05; min-width: 0; }
.ld-k b, .fm-v b { font: 800 26px ui-rounded, system-ui; font-variant-numeric: tabular-nums; } .sz-S .ld-k b, .sz-S .fm-v b { font-size: 21px; }
.ld-rt { margin-left: auto; align-items: flex-end; } .ld-rt b { font: 800 18px ui-rounded, system-ui; font-variant-numeric: tabular-nums; }
.fm-w { margin-left: auto; align-items: flex-end; } .fm-w b { font: 800 19px ui-rounded, system-ui; font-variant-numeric: tabular-nums; } .fm-w small { font-size: 11px; opacity: .8; }
.tbar { flex: none; height: 8px; border-radius: 99px; background: var(--soft); box-shadow: var(--soft-edge); overflow: hidden; }
.tbar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--t), var(--n)); transform-origin: left; animation: wg-grow .7s cubic-bezier(.2,.8,.2,1) both; }
@keyframes wg-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.lrows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; width: 100%; }
.lr { display: grid; grid-template-columns: 30px minmax(0,1fr) auto auto; gap: 8px; align-items: center; padding: 5px 8px; border-radius: 10px; font-size: 13px; }
.lr.you { background: color-mix(in srgb, var(--accent) 22%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
.lr-k { font: 800 13px ui-rounded, system-ui; font-variant-numeric: tabular-nums; text-align: center; opacity: .85; }
.lr-n { display: flex; flex-direction: column; min-width: 0; } .lr-n b, .lr-n small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .lr-n small { font-size: 11px; color: var(--muted); }
.lr-t { display: inline-flex; align-items: center; gap: 5px; font: 800 13px ui-rounded, system-ui; font-variant-numeric: tabular-nums; } .lr-t i { width: 9px; height: 9px; transform: rotate(45deg); border-radius: 2px; background: var(--t); }
.lr-r { white-space: nowrap; } .sz-M .lr-n small { display: none; } .sz-M .lr { padding-top: 4px; padding-bottom: 4px; } .lr-gap { text-align: center; color: var(--muted); line-height: .8; }
.ld-l { display: grid; grid-template-columns: 112px minmax(0,1fr); gap: 14px; }
.tladder { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.tl { display: grid; grid-template-columns: 12px 1fr; column-gap: 7px; align-items: center; padding: 4px 7px; border-radius: 9px; font: 600 12.5px system-ui; opacity: .6; }
.tl i { grid-row: span 2; width: 10px; height: 10px; transform: rotate(45deg); border-radius: 2px; background: var(--t); } .tl small { font-size: 10.5px; color: var(--muted); }
.tl.on { opacity: 1; background: color-mix(in srgb, var(--t) 24%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--t) 70%, transparent); }
.rchart { display: block; width: 100%; height: auto; overflow: visible; }
.rchart .rc-line { fill: none; stroke: #8fb3ff; stroke-width: 2.4; stroke-linejoin: round; stroke-linecap: round; } .rchart .rc-a { fill: rgba(143,179,255,.15); }
.rchart.up .rc-line { stroke: #5fe39a; } .rchart.up .rc-a { fill: rgba(95,227,154,.15); } .rchart.down .rc-line { stroke: #ff8a9b; } .rchart.down .rc-a { fill: rgba(255,138,155,.13); }
.rchart .rc-floor { stroke: var(--t); stroke-opacity: .45; stroke-width: 1; stroke-dasharray: 4 4; } .rchart .rc-ft { fill: var(--t); font: 700 9.5px system-ui; opacity: .85; }
.rchart .rc-d { stroke: rgba(10,12,30,.6); stroke-width: 1; } .rchart .rc-d.w { fill: #5fe39a; } .rchart .rc-d.l { fill: #ff8a9b; } .rchart .rc-d.e { fill: #c6cbe8; }
.rchart .rc-now { fill: #fff; stroke: var(--accent); stroke-width: 2; } .rchart .rc-l { fill: var(--muted); font: 600 10px system-ui; }
.fm-chart { width: 100%; max-width: 460px; }
.pips { display: flex; gap: 4px; flex-wrap: wrap; } .pips .wl { width: 20px; height: 20px; border-radius: 6px; font-size: 10.5px; }
.fm-tot { display: flex; align-items: center; gap: 14px; } .ring.wr { background: conic-gradient(#3cc47c calc(var(--p) * 1%), var(--soft) 0); }
.fbars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; width: 100%; }
.fbars li { display: grid; grid-template-columns: 62px minmax(0,1fr) 78px; gap: 8px; align-items: center; font: 600 12.5px system-ui; }
.fb-b { height: 8px; border-radius: 99px; background: var(--soft); overflow: hidden; } .fb-b i { display: block; height: 100%; border-radius: inherit; background: var(--c); transform-origin: left; animation: wg-grow .7s cubic-bezier(.2,.8,.2,1) both; }
.fb-v { text-align: right; white-space: nowrap; }
.fm-rec { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; width: 100%; }
.fm-rec li { display: grid; grid-template-columns: 22px minmax(0,1fr) auto; gap: 8px; align-items: center; font-size: 13px; }
.fr-n { min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0 6px; } .fr-n small { flex-basis: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nbell { position: relative; flex: none; display: grid; place-items: center; width: var(--s); height: var(--s); border-radius: 30%; color: #fff; background: linear-gradient(135deg, #ff4d6d, #ff8a5c); box-shadow: 0 4px 14px rgba(255,77,109,.35); }
.nbell .nbadge { position: absolute; top: -5px; right: -6px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 99px; display: grid; place-items: center; background: #fff; color: #d6274a; font: 800 11px ui-rounded, system-ui; box-shadow: 0 0 0 2px #ff4d6d; animation: wg-pop .45s cubic-bezier(.3,1.6,.5,1) both; }
@keyframes wg-pop { from { transform: scale(.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.nt-s, .nt-head { display: flex; align-items: center; gap: 12px; min-width: 0; } .nt-s .dn, .nt-head .dn { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.nt-s-t { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 13.5px; line-height: 1.25; }
.ntl { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; width: 100%; }
.nt { display: grid; grid-template-columns: 30px minmax(0,1fr) auto; gap: 10px; align-items: start; padding: 6px 8px; border-radius: 12px; }
.nt.unread { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.nt-m { display: flex; flex-direction: column; min-width: 0; color: inherit; text-decoration: none; gap: 1px; } .nt-m b { font-size: 13.5px; } .nt-m small { font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.nt-m:hover b { text-decoration: underline; } .nt-m:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
.nt-w { display: flex; align-items: center; gap: 6px; white-space: nowrap; } .nt-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.nt.t-gold .nt-m b { color: #e9b52f; } .nt-cards { margin-top: 6px; }
.nk { display: grid; place-items: center; flex: none; border-radius: 30%; color: var(--k); background: color-mix(in srgb, var(--k) 20%, transparent); box-shadow: inset 0 0 0 1.2px color-mix(in srgb, var(--k) 55%, transparent); }
.nk-row { display: flex; gap: 6px; flex-wrap: wrap; } .nk-c { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px 3px 3px; border-radius: 99px; background: var(--soft); font: 600 12px system-ui; } .nk-c b { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { .tbar i, .fb-b i, .nbell .nbadge { animation: none; } }
/* Render session 66: Daily rewards (siteDaily.ts) and the larger Showcase. */
.dr-s, .dr-head { display: flex; align-items: center; gap: 14px; min-width: 0; } .dr-s .dn b { font-size: 13.5px; }
.dr-ring { --s: 72px; position: relative; flex: none; width: var(--s); height: var(--s); display: grid; place-items: center; }
.dr-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.dr-ring circle { fill: none; stroke-width: 9; } .dr-tr { stroke: var(--soft); }
.dr-arc { stroke: #3cc47c; stroke-linecap: round; stroke-dasharray: var(--len); stroke-dashoffset: var(--off); animation: dr-fill .9s cubic-bezier(.2,.8,.2,1) both; }
.dr-ring.full .dr-arc { stroke: #f6c445; filter: drop-shadow(0 0 4px rgba(246,196,69,.6)); }
@keyframes dr-fill { from { stroke-dashoffset: var(--len); } }
.dr-rv { position: relative; display: flex; flex-direction: column; align-items: center; line-height: 1; } .dr-rv b { font: 800 calc(var(--s) * .3) ui-rounded, system-ui; font-variant-numeric: tabular-nums; } .dr-rv small { font: 600 calc(var(--s) * .13) system-ui; color: var(--muted); margin-top: 2px; }
.dr-next { font-size: 14px; } .dr-next b { font: 800 18px ui-rounded, system-ui; color: #2fae6a; }
.dr-row { list-style: none; margin: 0; padding: 4px 0 0; display: flex; align-items: flex-end; gap: 5px; flex-wrap: wrap; }
.dr-row li { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.dr-pk { margin-right: 8px; padding-right: 12px; border-right: 1px solid var(--line); } .dr-pk .btn { padding: 3px 10px; }
.dr-pki { width: 30px; height: 40px; border-radius: 6px; position: relative; display: grid; place-items: center; background: linear-gradient(160deg, #7a5cff, #3d7bff); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35), 0 3px 8px rgba(61,123,255,.35); }
.dr-pki::before { content: ""; position: absolute; left: 4px; right: 4px; top: 6px; height: 2px; background: rgba(255,255,255,.5); }
.dr-pki b { font: 800 13px ui-rounded, system-ui; color: #fff; }
.dr-pk.on .dr-pki { animation: wg-pop .45s cubic-bezier(.3,1.6,.5,1) both; } .dr-pk.done .dr-pki { filter: grayscale(.8); opacity: .5; } .dr-pk.wait .dr-pki { opacity: .35; }
.dr-lb { font: 600 11px system-ui; color: var(--muted); } .dr-nx { font-size: 11px; color: var(--muted); } .dr-nx .sh-clock { font-size: 11px; }
.dr-w.band { margin-left: 7px; }
.dr-wn { display: grid; place-items: center; border-radius: 50%; font: 800 11px ui-rounded, system-ui; color: var(--muted); background: var(--soft); box-shadow: inset 0 0 0 1.5px var(--line); }
.dr-w.t3 .dr-wn { width: 36px; height: 36px; font-size: 13px; } .dr-w.t2 .dr-wn { width: 28px; height: 28px; } .dr-w.t1 .dr-wn { width: 22px; height: 22px; font-size: 10px; }
.dr-w.paid .dr-wn { color: #fff; background: linear-gradient(140deg, #3cc47c, #2fb6ff); box-shadow: none; }
.dr-w.next .dr-wn { color: var(--accent); box-shadow: inset 0 0 0 2px var(--accent); animation: dr-next 1.6s ease-in-out infinite; }
@keyframes dr-next { 50% { transform: scale(1.12); } }
.dr-row.closed .dr-w.ahead { opacity: .42; }
.dr-wc { font: 700 10.5px system-ui; color: var(--muted); font-variant-numeric: tabular-nums; } .dr-w.paid .dr-wc { color: #2fae6a; }
.dr-reset { display: flex; align-items: baseline; gap: 8px; padding: 8px 12px; border-radius: 14px; background: var(--soft); } .dr-reset .sh-clock-ic { align-self: center; } .dr-reset .sh-clock { font-size: 20px; } .dr-reset small { color: var(--muted); margin-left: auto; }
.dr-rw { display: flex; flex-direction: column; gap: 5px; } .dr-rwn b { font: 800 16px ui-rounded, system-ui; }
.dr-rw .bar i { transform-origin: left; animation: wg-grow .7s cubic-bezier(.2,.8,.2,1) both; }
.dr-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.dr-list li { display: grid; grid-template-columns: 22px 1fr auto auto; gap: 10px; align-items: center; font-size: 13px; } .dr-list .wl { width: 20px; height: 20px; font-size: 10px; }
.dr-tot { display: flex; align-items: baseline; gap: 6px; } .dr-tot span { flex: 1; font-weight: 600; } .dr-tot b { font: 800 20px ui-rounded, system-ui; } .dr-tot small { color: var(--muted); }
.mc.lg { width: calc(78px * var(--k)); border-radius: calc(9px * var(--k)); }
.mc.lg .mc-art { left: calc(6px * var(--k)); right: calc(6px * var(--k)); top: calc(6px * var(--k)); border-radius: calc(6px * var(--k)); }
.mc.lg .mc-gem { top: calc(9px * var(--k)); right: calc(9px * var(--k)); width: calc(8px * var(--k)); height: calc(8px * var(--k)); }
.mc.lg .mc-n { left: calc(6px * var(--k)); right: calc(6px * var(--k)); font-size: calc(9.5px * var(--k)); }
.mc.lg .mc-fin { left: calc(6px * var(--k)); bottom: calc(6px * var(--k)); font-size: calc(8px * var(--k)); padding: calc(2px * var(--k)) calc(5px * var(--k)); border-radius: calc(4px * var(--k)); }
.scw { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
.scw figcaption { display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 100%; } .scw figcaption b { font-size: 13px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .scw figcaption small { font-size: 11.5px; color: var(--muted); }
.sc-row { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; } .sc-row .scw { width: min-content; } .sc-s { display: flex; align-items: center; gap: 12px; min-width: 0; } .sc-s .dn b { font-size: 13.5px; }
.sc-row .mc.lg { transition: transform .25s cubic-bezier(.2,.8,.2,1); } .sc-row .scw:hover .mc.lg { transform: translateY(-4px) rotate(-1deg); }
@media (max-width: 720px) { .dr-row { display: grid; grid-template-columns: repeat(10, auto); justify-content: space-between; align-items: end; gap: 8px 2px; }
  .dr-pk { grid-column: 1 / -1; flex-direction: row !important; flex-wrap: wrap; justify-content: flex-start; gap: 8px !important; margin: 0; padding: 0 0 8px; border-right: 0; border-bottom: 1px solid var(--line); } .dr-pk .dr-pki { width: 22px; height: 30px; }
  .dr-w.band { margin-left: 0; } .dr-w.t3 .dr-wn { width: 28px; height: 28px; } .dr-w.t2 .dr-wn { width: 23px; height: 23px; } .dr-w.t1 .dr-wn { width: 19px; height: 19px; font-size: 9.5px; } .dr-wc { font-size: 9.5px; }
  .dr-reset { flex-wrap: wrap; } .dr-head .dr-ring { --s: 84px !important; } .dr-nq { display: none; }
  .sc-row { flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 4px; } .sc-row .scw { scroll-snap-align: start; } }
@media (prefers-reduced-motion: reduce) { .dr-arc, .dr-pk.on .dr-pki, .dr-w.next .dr-wn, .dr-rw .bar i { animation: none; } .sc-row .mc.lg { transition: none; } }
@media (max-width: 720px) { .ld-l { grid-template-columns: 1fr; } .tladder { flex-direction: row; flex-wrap: wrap; } .fm-l { grid-template-columns: 1fr; } }
.btn.ghost { background: transparent; box-shadow: none; border: 1px solid var(--line); }
.sz-M .hrow { grid-template-columns: 22px minmax(0,1fr) auto; } .sz-M .hrow .hr-act { grid-column: 2 / 4; justify-content: flex-start; } .sz-M .hlist { gap: 2px; }
.mlog { max-height: 60vh; overflow: auto; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; background: rgba(0,0,0,.06); padding: 12px; border-radius: 12px; }
.rp-close { position: absolute; bottom: 14px; right: 16px; z-index: 2; border: 1px solid rgba(255,255,255,.3); background: rgba(10,12,30,.82); color: #fff; font: 700 13px system-ui; padding: 8px 14px; border-radius: 99px; cursor: pointer; }
.rp-close:focus-visible { outline: 2px solid #8f8cff; outline-offset: 2px; }
/* The 2× vote (render session 56): on Agent match, over the live arena beside Close, a pill on Watch live. */
.speed-ctl { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 10px; margin: 8px 0; border-radius: 10px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); }
.speed-ctl .speed-rate { font: 800 15px ui-monospace, monospace; min-width: 2.2em; text-align: center; padding: 2px 6px; border-radius: 6px; background: rgba(255,255,255,.1); }
.speed-ctl.fast .speed-rate { background: #ffb43c; color: #1a1205; box-shadow: 0 0 12px rgba(255,180,60,.55); }
.speed-ctl .speed-line { flex: 1 1 12em; min-width: 0; }
.rp-speed { position: absolute; bottom: 10px; right: 96px; z-index: 2; max-width: min(460px, calc(100vw - 120px)); }
.rp-speed .speed-ctl { margin: 0; background: rgba(10,12,30,.86); color: #fff; }
@media (max-width: 560px) { .rp-speed { right: 12px; left: 12px; bottom: 58px; max-width: none; } }
.pill.fast { background: #ffb43c; color: #1a1205; margin-left: 6px; }
/* ---- featured picks and viewers (render session 71): Watch live's groups, the Top rated chip, the eye ---- */
.pill.top { background: linear-gradient(135deg, #ffe08a, #ffb43c); color: #2a1a00; white-space: nowrap; }
.vw { display: inline-flex; align-items: center; gap: 4px; font: 700 12px system-ui; font-variant-numeric: tabular-nums; padding: 3px 8px; border-radius: 99px; background: color-mix(in srgb, currentColor 12%, transparent); white-space: nowrap; }
.vw.none { opacity: .62; }
.lc-tags, .mtags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
.lc-tags .pill.fast { margin-left: 0; } .lc-sp { flex: 1; } .lc-why { white-space: nowrap; }
.mtags { margin-bottom: 4px; }
.ltags { display: inline-flex; gap: 4px; margin-left: auto; flex: none; } .ltags .pill { padding: 2px 7px; font-size: 11px; } .ltags .vw { padding: 2px 6px; font-size: 11px; }
.lgroup { margin-bottom: 20px; } .lg-h { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin: 0 4px 10px; } .lg-h h3 { margin: 0; font-size: 17px; } .lg-h p { margin: 0; flex: 1 1 20em; }
.lg-none { margin: 0 4px 16px; }
.live-card.top { border-color: rgba(255,207,92,.55); box-shadow: 0 0 0 1px rgba(255,207,92,.25), 0 10px 28px -14px rgba(255,180,60,.55); }
@media (max-width: 560px) { .lc-why { white-space: normal; flex-basis: 100%; order: 5; } }
/* A phone (render session 71): the turn line above the two sides, which split the width (it had squeezed them to a few px). */
@media (max-width: 560px) { .sb { grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 8px; } .sb-mid { grid-row: 1; grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 6px; text-align: center; flex-direction: row; max-width: none; min-width: 0; } .sb-hp b { font-size: 18px; } }
@media (max-width: 760px) { .m-live-grid { grid-template-columns: 1fr; } .hrow { grid-template-columns: 22px minmax(0,1fr) auto; } .hrow .hr-act { grid-column: 2 / 4; } .sb-meta { display: none; } }
/* ---- the Stats page (render session 68): the filter, the rating and its chart, the totals, today, factions, recent, the ladder ---- */
.st-filter { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; } .st-filter .sp { flex: 1; }
.st-agents .pill small { opacity: .7; font-weight: 600; } .st-busy { animation: st-blink 1.2s ease-in-out infinite; }
@keyframes st-blink { 50% { opacity: .4; } }
.st-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(320px, 1fr); gap: 20px; align-items: start; }
.st-main, .st-side { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.st-pg .panel { padding: 16px 20px; border-radius: 24px; display: flex; flex-direction: column; gap: 10px; }
.st-pg h4 { margin: 0; font: 700 15px system-ui; }
.st-rh { display: flex; align-items: center; gap: 16px; min-width: 0; }
.st-rv, .st-wk { display: flex; flex-direction: column; line-height: 1.05; min-width: 0; }
.st-rv b { font: 800 44px ui-rounded, -apple-system, "SF Pro Rounded", system-ui; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
.st-wk { margin-left: auto; align-items: flex-end; } .st-wk b { font: 800 26px ui-rounded, system-ui; font-variant-numeric: tabular-nums; } .st-wk small { font-size: 12px; opacity: .8; }
.st-tier { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; } .st-tier .tbar { height: 10px; }
.st-ch { margin-top: 4px; }
.st-chart { display: flex; flex-direction: column; gap: 2px; }
.dcols { display: block; width: 100%; height: auto; overflow: visible; }
.dcols .dc-w { fill: #3cc47c; } .dcols .dc-l { fill: #ff5d73; } .dcols .dc-d { fill: #8f8cff; } .dcols .dc-z { fill: var(--muted); opacity: .5; }
.dcols .dc-axis { stroke: var(--line); stroke-width: 1; } .dcols .rc-l { fill: var(--muted); font: 600 10px system-ui; }
.dcols rect { transform-box: fill-box; transform-origin: center; animation: st-col .6s cubic-bezier(.2,.8,.2,1) both; }
@keyframes st-col { from { transform: scaleY(0); } to { transform: scaleY(1); } }
.st-tot { flex-direction: row !important; flex-wrap: wrap; align-items: center; gap: 18px !important; }
.st-wr { display: flex; align-items: center; gap: 12px; } .st-wr > div { display: flex; flex-direction: column; }
.ring.st-ring { width: 86px; height: 86px; } .ring.st-ring b { width: 70px; height: 70px; font-size: 18px; }
.st-tiles { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; min-width: 0; }
.st-t { display: flex; flex-direction: column; padding: 9px 11px; border-radius: 14px; background: var(--soft); box-shadow: var(--soft-edge); min-width: 0; }
.st-t b { font: 800 21px ui-rounded, system-ui; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .st-t span { font: 600 11.5px system-ui; color: var(--muted); }
.st-t.w b { color: var(--ok); } .st-t.l b { color: var(--live); } .st-t.hot { background: color-mix(in srgb, #3cc47c 22%, transparent); } .st-t.cold { background: color-mix(in srgb, #ff5d73 18%, transparent); }
.st-tot > p { flex-basis: 100%; margin: 0; }
.st-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
.st-fbars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.st-fbars li { display: grid; grid-template-columns: 64px minmax(0, 1fr) 42px auto; gap: 10px; align-items: center; } .st-fbars li.none { opacity: .55; }
.st-fbars .ftag { text-align: center; } .st-fbars .fb-b { height: 10px; } .st-fp { font: 800 14px ui-rounded, system-ui; font-variant-numeric: tabular-nums; text-align: right; } .st-fr { white-space: nowrap; min-width: 52px; text-align: right; }
.st-td { display: flex; align-items: center; gap: 16px; } .st-today .dr-tot { margin: 0; }
.st-rec .hlist { margin: 0; } .st-rec .hrow { grid-template-columns: 22px minmax(0,1fr) auto auto; gap: 8px; } .st-rec .hr-vs { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.st-ladder { margin-top: 20px; }
.st-spread { display: flex; flex-direction: column; gap: 6px; }
.st-sb { display: flex; height: 12px; border-radius: 99px; overflow: hidden; gap: 2px; } .st-sb i { background: var(--t); min-width: 4px; transform-origin: left; animation: wg-grow .7s cubic-bezier(.2,.8,.2,1) both; }
.st-sk { display: flex; flex-wrap: wrap; gap: 4px 14px; } .st-sk span { display: inline-flex; align-items: center; gap: 5px; } .st-sk i { width: 9px; height: 9px; transform: rotate(45deg); border-radius: 2px; background: var(--t); }
.st-ll { display: grid; grid-template-columns: 128px minmax(0, 1fr); gap: 18px; align-items: start; }
.lt-wrap { max-height: 560px; overflow: auto; border-radius: 14px; scrollbar-width: thin; }
.ltable { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.ltable th { position: sticky; top: 0; z-index: 1; text-align: left; font: 700 11px system-ui; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); padding: 8px 10px; background: var(--solid); }
.ltable td { padding: 7px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; font-variant-numeric: tabular-nums; }
.ltable tr.you td { background: color-mix(in srgb, var(--accent) 20%, transparent); } .ltable tr.you td:first-child { box-shadow: inset 3px 0 0 var(--accent); }
.lt-k { font: 800 13.5px ui-rounded, system-ui; text-align: center; width: 36px; }
.lt-n { max-width: 260px; } .lt-n b, .lt-n small { display: block; overflow: hidden; text-overflow: ellipsis; } .lt-n small { font-size: 11.5px; color: var(--muted); }
.lt-t i { display: inline-block; width: 9px; height: 9px; margin-right: 6px; transform: rotate(45deg); border-radius: 2px; background: var(--t); }
.lt-r { font: 800 14px ui-rounded, system-ui; } .lt-r small { font: 600 11px system-ui; color: var(--muted); }
.lt-gap td { text-align: center; color: var(--muted); border-bottom: 0; padding: 2px; }
@media (max-width: 1100px) { .st-grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 720px) { .st-two, .st-ll { grid-template-columns: minmax(0, 1fr); } .st-rv b { font-size: 34px; } .st-rh .tbadge { --s: 48px !important; }
  .st-filter { flex-direction: column; align-items: stretch; } .st-filter .sp { display: none; } .st-filter .seg { align-self: flex-start; }
  .st-tot { flex-direction: column !important; align-items: stretch; } .st-tiles { flex: none; grid-template-columns: repeat(3, minmax(0, 1fr)); } .st-t b { font-size: 18px; } .st-td { flex-wrap: wrap; }
  .st-filter .pills { min-width: 0; } .st-filter .pill { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  .st-rec .hrow { grid-template-columns: 22px minmax(0,1fr) auto; } .st-rec .hr-act { grid-column: 2 / 4; }
  .ltable .lt-m, .ltable .lt-d, .ltable .lt-w, .ltable th:nth-child(5), .ltable th:nth-child(6), .ltable th:nth-child(7), .lt-r small { display: none; }
  .ltable td, .ltable th { padding: 6px 5px; } .lt-t { font-size: 0; } .lt-t i { margin: 0; } .lt-k { width: 26px; } .lt-n { max-width: 150px; } }
@media (prefers-reduced-motion: reduce) { .dcols rect, .st-sb i, .st-busy { animation: none; } }

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
<style>${SHOP_CSS}</style>
<style>${BELL_CSS}</style>
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
      <button id="bell-btn" class="tbtn" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="bell-panel" aria-label="Notifications"></button>
      <button id="acct-btn" class="tbtn" type="button" aria-haspopup="menu" aria-expanded="false"></button>
      <div id="acct-menu" class="glass" role="menu" hidden>
        <div class="who"><b id="acct-name"></b><small id="acct-kind">Owner account</small></div>
        <a class="mitem" role="menuitem" href="#/settings">Settings</a>
        <button id="sign-out" class="mitem" role="menuitem" type="button">Sign out</button>
      </div>
    </header>
    <!-- Render session 70: the bell's panel, outside the top bar so its blur reaches the page (a backdrop filter inside another sees only its parent). -->
    <div id="bell-panel" class="glass" role="dialog" aria-modal="false" aria-labelledby="bell-title" hidden></div>
    <div id="page" tabindex="-1"></div>
  </main>
</div>

<div id="viewer" hidden></div>
<div id="dialog" class="dim"></div>
<div id="opening" class="opening" hidden role="dialog" aria-modal="true" aria-label="Pack opening"></div>
<div id="dress" class="opening" hidden role="dialog" aria-modal="true" aria-label="Agent loadout"></div>
<div id="replay" class="opening" hidden role="dialog" aria-modal="true" aria-label="Match replay"></div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
${faceSymbols()}
${boastGlyphSymbols()}
<script>${FACE_SCRIPT}</script>
<script>${COIN_SCRIPT}</script>
<script>${siteScript()}</script>
</body>
</html>
`;
}

/** The full-screen loadout picker's page (session 49): the standalone
 * picker in its site mode, empty until the website hands it one agent's
 * state. Served by the site host at /loadout, framed by the website. */
export function renderSiteLoadoutPage(): string {
  return renderLoadoutHtml({ site: true, title: "Agent loadout · AI·TCG", closeWinHealth: CLOSE_WIN_HEALTH, starters: {}, names: {}, scenarios: [] });
}

/** The full-screen pack opening's page (session 47): the standalone
 * pack-opening page in its site mode, empty until the website hands it a
 * real opening. Served by the site host at /pack-opening, framed by the
 * website (same origin). */
export function renderSitePackPage(): string {
  return renderPackOpeningHtml({ title: "Pack opening · AI·TCG", packs: [], site: true, wards: packWardRings() });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = resolve(process.cwd(), process.argv[2] ?? join(here, "..", "..", "output", "site", "index.html"));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderSitePage(), "utf8");
  console.log(`Wrote ${out}`);
}
