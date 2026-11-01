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

import { buildSync } from "esbuild";
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
.boardbar h2 { font: 700 22px system-ui; margin: 0 0 16px; }
.wgrid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 20px; }
.wg { position: relative; grid-column: span 6; min-height: 250px; }
.wg::before { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: linear-gradient(160deg, rgba(255,255,255,.35), rgba(255,255,255,0) 38%); mix-blend-mode: soft-light; }
.wg.hero { color: #fff; background: linear-gradient(140deg, color-mix(in srgb, var(--c) 32%, rgba(20,24,52,.62)), rgba(18,22,48,.6) 70%); border-color: rgba(255,255,255,.22); }
.wg.hero .muted { color: #c6cbe8; }
.wgh { display: flex; align-items: center; gap: 8px; padding: 14px 14px 0 16px; font: 600 13px system-ui; position: relative; z-index: 1; }
.wic { width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; background: var(--g); color: #fff; flex: none; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.wic.big { width: 54px; height: 54px; border-radius: 15px; }
.wopen { margin-left: auto; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; opacity: .7; } .wopen:hover { opacity: 1; background: var(--soft); }
.wgb { position: relative; z-index: 1; padding: 12px 18px 18px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.mya { display: flex; gap: 14px; align-items: center; }
.mya-n { font: 800 24px system-ui; display: flex; align-items: center; gap: 10px; }
.ftag { font: 800 10px system-ui; letter-spacing: .08em; padding: 3px 7px; border-radius: 6px; color: #fff; background: color-mix(in srgb, var(--c) 55%, rgba(0,0,0,.35)); }
.big-line { font: 700 18px system-ui; }
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
.toast.on { opacity: 1; transform: translate(-50%, 0); } .toast.error { background: rgba(150,24,52,.95); }

/* Narrow windows: the panels stack in order (the phone layout stays parked). */
@media (max-width: 1100px) { .wg { grid-column: span 12; } }
@media (max-width: 1000px) { .cur { padding: 0 10px 0 8px; font-size: 13.5px; } .obtn span { display: none; } .obtn { padding: 0 11px; } }
@media (max-width: 760px) { #wallet .cur:nth-child(2) { display: none; } .bgsw { grid-template-columns: repeat(2, minmax(0, 1fr)); } #shell { grid-template-columns: 76px minmax(0,1fr); } .navb span, .nbadge, .brand small, #agent-card .ac-name, #agent-card .status { display: none; } .navb { justify-content: center; padding: 10px; }
  .brand { font-size: 13px; padding: 0 0 12px; text-align: center; } #agent-card { padding: 8px; background: none; border: 0; box-shadow: none; } .ac-top { margin: 0; justify-content: center; }
  .topbar, #page { padding-left: 16px; padding-right: 16px; } .field { flex-direction: column; align-items: flex-start; } }

/* Accessibility (2026-10-05 D): reduce transparency makes panels solid; reduce motion stills the spinner and pulse
   (and the liquid: liquid.ts draws one frame and stops). */
@media (prefers-reduced-transparency: reduce) { .glass, .wg, .panel, .side, .topbar, .dlg, .cur { backdrop-filter: none; -webkit-backdrop-filter: none; background: var(--solid); }
  .wg.hero { background: #1d2348; } }
@media (prefers-reduced-motion: reduce) { .spin, .status.live i { animation: none; } .toast { transition: none; } }
`;

export function renderSitePage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI·TCG</title>
<style>${SITE_CSS}</style>
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

<div id="dialog" class="dim"></div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>${siteScript()}</script>
</body>
</html>
`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = resolve(process.cwd(), process.argv[2] ?? join(here, "..", "..", "output", "site", "index.html"));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderSitePage(), "utf8");
  console.log(`Wrote ${out}`);
}
