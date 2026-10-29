// The render's browser check, CI-sized (owner 2026-10-29: "yes to the CI
// browser check"). Runs on every push in .github/workflows/test.yml. The
// session checks under progress/render/evidence/*.mjs stay the deep,
// by-hand evidence; this is the small set that guards what they proved:
//   A  the six boasts: nothing lit past the winner's side (the effects' top
//      canvas read through each whole boast, the winner below and above).
//   B  the Skip sizes: a boast's and the intro's at least 88 x 44 px on a
//      touch screen; a boast's on a desktop stays small.
//   C  one replay's intro (Cortex vs Swarm, seed 6): it plays from Play at
//      move 0, lays out with no problem, holds the music, ends by itself;
//      Escape skips it; a phone gets two rows and no sideways scroll;
//      reduced motion gets the still.
// Every page also fails the check on any uncaught page error.
//
// Usage (from the repo root or render/):
//   node render/ci/browser-check.mjs [pagesDir]
// Without [pagesDir] the pages are built fresh from the current source
// (src/ciPages.ts) into a temp directory. Playwright is not a repo
// dependency: PW_CORE names playwright-core's index.mjs (CI installs it
// outside the repo), else the installed playwright-core or playwright, else
// the copy preinstalled in the session container. PW_CHANNEL=chrome uses
// the runner's own Chrome instead of a downloaded Chromium.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RENDER = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const started = Date.now();

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); if (m.chromium) return m.chromium; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

let PAGES = process.argv[2] ? resolve(process.argv[2]) : null;
if (!PAGES) {
  PAGES = mkdtempSync(join(tmpdir(), 'render-ci-'));
  execFileSync('npx', ['tsx', 'src/ciPages.ts', PAGES], { cwd: RENDER, stdio: 'inherit' });
}
const built = Date.now();

const server = createServer((req, res) => {
  try { const body = readFileSync(join(PAGES, decodeURIComponent(new URL(req.url, 'http://x').pathname))); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const HOST = `http://127.0.0.1:${server.address().port}/`;
const chromium = await loadPlaywright();
const browser = await chromium.launch({ ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}), args: ['--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });

let fails = 0, passes = 0;
const log = (...a) => console.log(...a);
function check(ok, what) { log((ok ? '  PASS ' : '  FAIL ') + what); if (ok) passes++; else fails++; }

async function open(file, o = {}) {
  const viewport = o.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 };
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!o.phone, isMobile: !!o.phone, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(false, `${file}: no page error (${e.message})`));
  await page.goto(HOST + file);
  await page.waitForFunction(() => window.__cfx && window.__cfx.isReady(), null, { timeout: 20000 });
  return { ctx, page };
}

// ---- A: nothing lit past the winner's side -------------------------------
// The sheet has no lethal attack, so every lit pixel on the effects' top
// canvas is the boast's. Read every 3rd frame, every 2nd pixel; a pixel
// more than 3 px outside the winner's side counts.
const BOASTS = ['boast-aegis-shield-slam', 'boast-swarm-hive-burst', 'boast-null-void-collapse', 'boast-cortex-data-cascade', 'boast-s0-boot-sequence', 'boast-s0-dial-up-fireworks'];
async function boastSpill(key) {
  const { ctx, page } = await open('boast-sheet.html');
  await page.evaluate((key) => document.getElementById(key).scrollIntoView({ block: 'center' }), key);
  await page.waitForTimeout(200);
  const r = await page.evaluate((key) => new Promise((done) => {
    const cv = document.querySelector('canvas.fx-top'), g = cv.getContext('2d', { willReadFrequently: true });
    const dpr = cv.width / window.innerWidth;
    window.playBoastScene(key);
    const out = { samples: 0, outside: 0, onLoser: 0, far: 0, played: false };
    let n = 0;
    (function f() {
      const s = window.__boast.stats();
      if (s.active) out.played = true;
      if (n++ % 3 === 0) {
        const band = document.getElementById(key + '-side-w').getBoundingClientRect();
        const lz = [document.getElementById(key + '-side-l').getBoundingClientRect(), document.getElementById(key + '-hud-l').getBoundingClientRect()];
        const d = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
        for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
          if (d[(y * W + x) * 4 + 3] <= 6) continue;
          const px = x / dpr, py = y / dpr;
          const dist = Math.max(band.left - px, px - band.right, band.top - py, py - band.bottom);
          if (dist <= 3) continue;
          out.outside++; out.far = Math.max(out.far, dist);
          if (lz.some((q) => px >= q.left && px <= q.right && py >= q.top && py <= q.bottom)) out.onLoser++;
        }
        out.samples++;
      }
      if (s.active || n < 5) requestAnimationFrame(f); else done(out);
    })();
  }), key);
  await ctx.close();
  return r;
}
log('[A] the six boasts: nothing lit past the winner\'s side (winner below, then above)');
{
  // Three pages at a time (each its own context, so each animates as if
  // visible); results are reported in order.
  const keys = BOASTS.flatMap((id) => [`${id}-full`, `${id}-top`]);
  const results = new Array(keys.length);
  let next = 0;
  await Promise.all([0, 1, 2].map(async () => { while (next < keys.length) { const i = next++; results[i] = await boastSpill(keys[i]); } }));
  keys.forEach((key, i) => {
    const r = results[i];
    check(r.played && r.samples >= 10 && r.outside === 0,
      `A. ${key}: ${r.samples} samples, ${r.outside} lit past the side (${r.onLoser} on the loser's)${r.outside ? `, farthest ${r.far.toFixed(1)} px` : ''}`);
  });
}

// ---- B: the Skip sizes ------------------------------------------------------
const size = (sel) => (page) => page.evaluate((sel) => { const k = document.querySelector(sel); if (!k) return null; const q = k.getBoundingClientRect(); return { w: q.width, h: q.height, coarse: matchMedia('(pointer: coarse)').matches }; }, sel);
const fmt = (s) => s ? `${s.w.toFixed(1)} x ${s.h.toFixed(1)} px` : 'none';
async function boastSkip(phone) {
  const { ctx, page } = await open('boast-sheet.html', { phone });
  await page.evaluate(() => window.playBoastScene('boast-aegis-shield-slam-phone'));
  const s = await size('.boast-skip')(page);
  await ctx.close();
  return s;
}
const REPLAY = 'cortex-vs-swarm-seed6.html';
const bootStats = (page) => page.evaluate(() => window.__boot.stats());
async function playIntro(page, tap) {
  if (tap) await page.tap('#btn-play'); else await page.click('#btn-play');
  await page.waitForFunction(() => window.__boot.stats().active, null, { timeout: 5000 });
}
log('\n[B] the Skip sizes (phone: 390 x 844, coarse pointer)');
{
  const bp = await boastSkip(true), bd = await boastSkip(false);
  const { ctx, page } = await open(REPLAY, { phone: true });
  await playIntro(page, true);
  const ip = await size('.boot-skip')(page);
  await ctx.close();
  check(bp && bp.coarse && bp.w >= 88 && bp.h >= 44, `B. a boast's Skip on a phone: ${fmt(bp)} (at least 88 x 44)`);
  check(ip && ip.coarse && ip.w >= 88 && ip.h >= 44, `B. the intro's Skip on a phone: ${fmt(ip)} (at least 88 x 44)`);
  check(bd && !bd.coarse && bd.h < 44, `B. a boast's Skip on a desktop stays small: ${fmt(bd)}`);
}

// ---- C: one replay's intro --------------------------------------------------
log(`\n[C] ${REPLAY}: the intro`);
{
  const { ctx, page } = await open(REPLAY);
  await playIntro(page);
  const s = await bootStats(page);
  check(s.problem === null && !s.still && s.saying === 'ENGAGE', `C. desktop: plays from Play at move 0, laid out with no problem, saying "${s.saying}"`);
  check(s.rows === false && s.fs <= 15, `C. desktop: the agent lines on one row at ${s.fs.toFixed(1)} px`);
  await page.waitForFunction(() => { const s = window.__boot.stats(); return !s.active || s.t >= 1500; }, null, { timeout: 15000 });
  const m1 = await page.evaluate(() => window.__music.stats());
  const t0 = Date.now();
  await page.waitForFunction(() => !window.__boot.stats().active, null, { timeout: 15000 });
  const s2 = await bootStats(page);
  check(m1.waiting && m1.steps === 0, `C. desktop: the music waits under the intro (${m1.steps} steps at 1.5 s)`);
  check(s2.ended === 1 && s2.skipped === 0, `C. desktop: the intro ends by itself (${Date.now() - t0} ms after 1.5 s)`);
  await ctx.close();
}
{
  const { ctx, page } = await open(REPLAY);
  await playIntro(page);
  await page.waitForFunction(() => window.__boot.stats().t >= 600, null, { timeout: 10000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const s = await bootStats(page), m = await page.evaluate(() => window.__music.stats());
  check(!s.active && s.skipped === 1 && !m.waiting, `C. Escape skips it and the music starts (active ${s.active}, skipped ${s.skipped}, music waiting ${m.waiting})`);
  await ctx.close();
}
{
  const { ctx, page } = await open(REPLAY, { phone: true });
  await playIntro(page, true);
  const s = await bootStats(page);
  const L = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(s.problem === null && s.rows === true && s.fs >= 18, `C. phone: the agent lines on two rows at ${s.fs.toFixed(1)} px, no problem`);
  check(L.sw <= L.cw, `C. phone: no sideways scroll (${L.sw} <= ${L.cw})`);
  await ctx.close();
}
{
  const { ctx, page } = await open(REPLAY, { reduced: true });
  await playIntro(page);
  const s = await bootStats(page);
  check(s.still === true && s.problem === null, 'C. reduced motion: the still');
  await ctx.close();
}

await browser.close();
server.close();
const secs = (ms) => (ms / 1000).toFixed(1);
log(`\n${passes} passed, ${fails} failed (pages ${secs(built - started)} s, browser ${secs(Date.now() - built)} s)`);
log(fails ? 'BROWSER CHECK FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
