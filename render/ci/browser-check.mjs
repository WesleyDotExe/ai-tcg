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
//   D  the same replay's end: stepped into the lethal move, the lethal beat
//      plays, then the winner's boast (the faction starter: the replay has
//      no record) with the result line held; the loser's side dimmed and
//      its DOM untouched, the winner's panel lit, Skip on the winner's side;
//      the lethal attack's leftovers on the effects' top canvas cleared off
//      the loser's side as the boast starts, then nothing lit past the
//      winner's side; "GAME OVER: <winner> WINS" lands as the boast ends.
//      Escape mid-boast lands the result at once; a jump to the end shows
//      it at once with no boast. On a desktop and a phone.
//   E  the "tap to skip" hint (render session 43): under every boast's
//      Skip on the sheet (all 30 scenes), inside the winner's side, the
//      desktop words; on a phone the tap words; clear of the name plate
//      once it shows; gone with Skip at the boast's end. The replay's
//      intro shows it inside the board (desktop and phone words); after
//      the viewer has skipped the intro, the replay's boast shows none.
// Every page also fails the check on any uncaught page error.
//
// Usage (from the repo root or render/):
//   node render/ci/browser-check.mjs [pagesDir]
// Without [pagesDir] the pages are built fresh from the current source
// (src/ciPages.ts) into a temp directory. Playwright is not a repo
// dependency: PW_CORE names playwright-core's index.mjs (CI installs it
// outside the repo), else the installed playwright-core or playwright, else
// the copy preinstalled in the session container. CI downloads the
// Chromium that pinned playwright-core version names (owner 2026-10-31:
// a runner image update must not turn the check red); PW_CHANNEL=chrome
// uses an installed Chrome instead, for a local run only.
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
log(`browser: ${process.env.PW_CHANNEL || 'chromium'} ${browser.version()}`);
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

// ---- D: the same replay's end ----------------------------------------------
// Steps from the second-last move into the lethal one, in the page (the
// step and every reading on the page's own clock: a slow runner draws few
// frames, so nothing here is a wall-clock bound except the ordering and
// half of BOAST_LEAD_MS as a lower bound). The faction starter each winner's boast is
// without a record (boastFromRecord; render/test/ciPages.test.ts keeps this
// in step).
const STARTER = { Aegis: 'boast-aegis-shield-slam', Swarm: 'boast-swarm-hive-burst', Null: 'boast-null-void-collapse', Cortex: 'boast-cortex-data-cascade' };
const LEAD_MS = 900, CLEAR_MS = 280;
const endOf = (page) => page.evaluate(() => {
  const d = JSON.parse(document.getElementById('match-data').textContent), f = d.frames[d.frames.length - 1];
  const w = f.winner, l = w === 'p1' ? 'p2' : 'p1';
  return { w, l, name: w && w !== 'draw' ? d.agentNames[w] : null, faction: w && w !== 'draw' ? f.players[w].faction : null, record: d.record ? d.record.boast : null, last: d.frames.length - 1 };
});
async function toSecondLast(page) {
  await page.evaluate(() => { const s = document.getElementById('scrubber'); s.value = String(Number(s.max) - 1); s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(400);
}
// Records the step into the end, frame by frame, until the boast has ended
// (or 20 s). `escapeAt`: press Escape once the boast's own clock reaches it.
const stepIntoEnd = (page, e, escapeAt) => page.evaluate(([e, escapeAt, CLEAR_MS]) => new Promise((done) => {
  const cv = document.querySelector('canvas.fx-top'), g = cv.getContext('2d', { willReadFrequently: true });
  const tb = document.getElementById('turnbar'), loser = document.getElementById('side-' + e.l);
  const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
  const r = { lethal: null, boast: null, end: null, result: null, heldThrough: true, id: null, who: null, problem: 'never read', still: null, plate: null,
    dim: null, lit: null, skipIn: null, loserSame: null, early: 0, samples: 0, outside: 0, far: 0, text: null, escaped: false };
  // The clear's time is the effects' own clock (canvasFx's frame: each
  // frame's step capped at 50 ms, so on a slow runner it runs slower than
  // the boast's wall clock); kept here the same way from the boast's start.
  let loserHtml = null, n = 0, fxT = 0, lastT = 0;
  (function f() {
    const s = window.__boast.stats(), over = /GAME OVER/.test(tb.textContent), now = performance.now();
    if (s.active && r.boast != null) fxT += Math.min(50, now - lastT);
    lastT = now;
    if (r.lethal == null && document.querySelector('.fx-lethal-overlay')) r.lethal = at();
    if (s.active) {
      if (r.boast == null) { r.boast = at(); r.id = s.id; r.who = s.who; r.problem = s.problem; r.still = s.still; loserHtml = loser.innerHTML; }
      if (over) r.heldThrough = false;
      const who = document.querySelector('.boast-who');
      if (who) r.plate = who.textContent;
      // The dim's lowest point through the boast (its fade-in is a CSS
      // transition, so one reading at a set time can land mid-fade).
      const op = ['side-', 'hud-', 'hand-'].map((p) => Number(getComputedStyle(document.getElementById(p + e.l)).opacity));
      r.dim = r.dim ? r.dim.map((x, i) => Math.min(x, op[i])) : op;
      if (s.t >= 400 && r.lit == null) {
        r.lit = document.getElementById('hud-' + e.w).classList.contains('boast-panel');
        const k = document.querySelector('.boast-skip'), b = document.getElementById('side-' + e.w).getBoundingClientRect();
        const q = k && k.getBoundingClientRect();
        r.skipIn = !!q && q.left >= b.left - 2 && q.right <= b.right + 2 && q.top >= b.top - 2 && q.bottom <= b.bottom + 2;
      }
      if (n++ % 3 === 0) {
        // Before the clear has run its course (CLEAR_MS on the effects'
        // clock) the lethal attack's smoke is still on the loser's side
        // (counted, to show the clear had something to clear); from 60 ms
        // after it, nothing past the winner's side.
        const band = document.getElementById('side-' + e.w).getBoundingClientRect(), dpr = cv.width / window.innerWidth;
        const d = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
        let c = 0;
        for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
          if (d[(y * W + x) * 4 + 3] <= 6) continue;
          const px = x / dpr, py = y / dpr;
          const dist = Math.max(band.left - px, px - band.right, band.top - py, py - band.bottom);
          if (dist > 3) { c++; if (fxT >= CLEAR_MS + 60) r.far = Math.max(r.far, dist); }
        }
        if (fxT < CLEAR_MS) r.early = Math.max(r.early, c);
        else if (fxT >= CLEAR_MS + 60) { r.samples++; r.outside += c; }
      }
      if (escapeAt != null && !r.escaped && s.t >= escapeAt) { r.escaped = true; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); }
    } else if (r.boast != null && r.end == null) {
      r.end = at(); r.loserSame = loser.innerHTML === loserHtml;
    }
    if (over && r.result == null) { r.result = at(); r.text = tb.textContent; }
    if (r.boast == null && over) r.heldThrough = false;
    if ((r.end != null && r.result != null) || at() > 20000) done(r); else requestAnimationFrame(f);
  })();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
}), [e, escapeAt ?? null, CLEAR_MS]);
async function replayEnd(phone, escapeAt) {
  const { ctx, page } = await open(REPLAY, { phone });
  const e = await endOf(page);
  let r = null;
  if (e.name) { await toSecondLast(page); r = await stepIntoEnd(page, e, escapeAt); }
  await ctx.close();
  return { e, r };
}
async function jumpToEnd() {
  const { ctx, page } = await open(REPLAY);
  await page.evaluate(() => { const s = document.getElementById('scrubber'); s.value = s.max; s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(1500);
  const j = await page.evaluate(() => ({ over: /GAME OVER/.test(document.getElementById('turnbar').textContent), played: window.__boast.stats().played, active: window.__boast.stats().active }));
  await ctx.close();
  return j;
}
log(`\n[D] ${REPLAY}: the end (the lethal beat, then the boast)`);
{
  // The four runs at once (each its own context); reported in order.
  const [desk, phone, esc, j] = await Promise.all([replayEnd(false), replayEnd(true), replayEnd(false, 1000), jumpToEnd()]);
  const ms = (x) => x == null ? 'never' : `${x} ms`;
  const gap = (a, b) => a != null && b != null ? b - a : '?';
  for (const [where, { e, r }] of [['desktop', desk], ['phone', phone]]) {
    check(!!e.name && e.record === null, `D. ${where}: the replay ends in a win (${e.w}, ${e.name}, ${e.faction}) and has no record`);
    if (!r) continue;
    log(`  ${where}: lethal beat ${ms(r.lethal)}, boast ${ms(r.boast)}, its end ${ms(r.end)}, the result ${ms(r.result)} after the step`);
    // The flash fires on the effects' frame timer, the boast on a
    // setTimeout: on a loaded machine the flash lands late and the gap
    // shrinks (down to about 610 ms with two checks at once on 4 cores).
    // Half the lead still tells a boast that waits from one that doesn't
    // (0 ms, the session-42 mutant).
    check(r.lethal != null && r.boast != null && r.boast - r.lethal >= LEAD_MS / 2, `D. ${where}: the lethal beat, then the boast at least ${LEAD_MS / 2} ms later (${gap(r.lethal, r.boast)} ms; the lead is ${LEAD_MS})`);
    check(r.id === STARTER[e.faction] && r.who === e.name && r.problem === null && r.still === false, `D. ${where}: the winner's faction starter plays in full, laid out with no problem (${r.id}, "${r.who}", problem ${r.problem})`);
    check(r.plate === `${e.name} WINS`, `D. ${where}: the plate says "${r.plate}"`);
    check(!!r.dim && r.dim.every((x) => Math.abs(x - 0.7) < 0.02) && r.lit && r.skipIn, `D. ${where}: the loser's side, panel and hand dimmed (${r.dim && r.dim.join(', ')}), the winner's panel lit, Skip on the winner's side`);
    check(r.early > 0 && r.samples >= 5 && r.outside === 0, `D. ${where}: the lethal attack's leftovers cleared (${r.early} lit off the winner's side before the clear), then ${r.samples} samples, ${r.outside} lit past the winner's side${r.outside ? `, farthest ${r.far.toFixed(1)} px` : ''}`);
    check(r.loserSame === true, `D. ${where}: the loser's side unchanged through the boast`);
    check(r.heldThrough && r.end != null && r.result != null && r.result - r.end <= 50 && r.text.includes(`GAME OVER: ${e.name} WINS`), `D. ${where}: the result held through the boast, then "GAME OVER: ${e.name} WINS" lands as it ends (${gap(r.end, r.result)} ms after)`);
  }
  const r = esc.r;
  check(!!r && r.escaped && r.end != null && r.result != null && r.result - r.end <= 50 && r.heldThrough, `D. Escape at 1 s ends the boast and the result lands at once (${r ? gap(r.end, r.result) : '?'} ms after)`);
  check(j.over && !j.active && j.played === 0, `D. a jump to the end shows the result at once, no boast (boasts played ${j.played})`);
}

// ---- E: the "tap to skip" hint ----------------------------------------------
// Words from render/src/skipHint.ts (render/test/ciPages.test.ts keeps them
// in step).
const HINT_KEY = 'or click anywhere \u00b7 Esc', HINT_TAP = 'or tap anywhere';
// The intro's words name the board (owner, render session 43 call 4).
const BOARD_KEY = 'or click the board \u00b7 Esc', BOARD_TAP = 'or tap the board';
// The hint, its Skip and a box on the page, read in the page.
const hintRead = (page, boxSel) => page.evaluate((boxSel) => {
  const R = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
  const hs = document.querySelectorAll('.skip-hint:not(.gone)'), h = hs[hs.length - 1] || null;
  const ks = document.querySelectorAll('.boast-skip:not(.gone)'), k = ks[ks.length - 1] || null;
  const plate = document.querySelector('.boast-name:not(.gone)');
  return { n: hs.length, text: h ? h.textContent : null, hint: R(h), skip: R(k), box: R(document.querySelector(boxSel)), plate: R(plate),
    font: h ? parseFloat(getComputedStyle(h).fontSize) : null, op: h ? Number(getComputedStyle(h).opacity) : null, label: k ? k.getAttribute('aria-label') : null };
}, boxSel);
const inside = (a, b) => !!a && !!b && a.l >= b.l - 1 && a.r <= b.r + 1 && a.t >= b.t - 1 && a.b <= b.b + 1;
const apart = (a, b) => !!a && !!b && (a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b);
const under = (h, k) => !!h && !!k && Math.abs(h.r - k.r) <= 1 && h.t >= k.b && h.t - k.b <= 6;
log('\n[E] the "tap to skip" hint');
{
  // Every sheet scene, one page: play, read, cancel (a cancel isn't a skip).
  const { ctx, page } = await open('boast-sheet.html');
  const keys = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.scene'), (x) => x.id));
  const bad = [];
  for (const key of keys) {
    await page.evaluate((key) => { document.getElementById(key).scrollIntoView({ block: 'center' }); }, key);
    await page.evaluate((key) => window.playBoastScene(key), key);
    await page.waitForFunction(() => window.__boast.stats().active, null, { timeout: 5000 });
    const r = await hintRead(page, `#${key}-side-w`);
    if (!(r.text === HINT_KEY && under(r.hint, r.skip) && inside(r.hint, r.box) && r.font >= 11)) bad.push(`${key} (${r.text}, ${JSON.stringify(r.hint)})`);
    await page.evaluate(() => window.__boast.cancel());
  }
  const seen = await page.evaluate(() => window.__boast.stats().hintSeen);
  check(keys.length === 30 && bad.length === 0, `E. the sheet: all ${keys.length} scenes show the hint under Skip, inside the winner's side, the desktop words${bad.length ? ': ' + bad.join('; ') : ''}`);
  check(seen === false, 'E. the sheet: a cancel is not a skip (the hint stays on for the next boast)');
  await ctx.close();
}
async function hintToPlate(key, phone) {
  // One scene played to its end: the hint clear of the plate once it
  // shows, then gone with Skip.
  const { ctx, page } = await open('boast-sheet.html', { phone });
  await page.evaluate((key) => document.getElementById(key).scrollIntoView({ block: 'center' }), key);
  await page.evaluate((key) => window.playBoastScene(key), key);
  await page.waitForFunction(() => window.__boast.stats().active, null, { timeout: 5000 });
  const first = await hintRead(page, `#${key}-side-w`);
  await page.waitForFunction(() => { const w = document.querySelector('.boast-name:not(.gone) .boast-who'); return w && w.textContent.length > 3; }, null, { timeout: 10000 });
  await page.waitForTimeout(450);
  const plated = await hintRead(page, `#${key}-side-w`);
  await page.waitForFunction(() => !window.__boast.stats().active, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const after = await hintRead(page, `#${key}-side-w`);
  await ctx.close();
  return { first, plated, after };
}
{
  const runs = [['boast-aegis-shield-slam-full', false], ['boast-s0-boot-sequence-top', false], ['boast-swarm-hive-burst-phone', true], ['boast-null-void-collapse-phone', true]];
  const res = await Promise.all(runs.map(([k, ph]) => hintToPlate(k, ph)));
  runs.forEach(([key, phone], i) => {
    const { first, plated, after } = res[i], words = phone ? HINT_TAP : HINT_KEY;
    check(first.text === words && first.label === 'Skip, ' + words && under(first.hint, first.skip) && inside(first.hint, first.box) && first.font >= (phone ? 12 : 11),
      `E. ${key}${phone ? ' (phone)' : ''}: "${first.text}" under Skip, inside the winner's side, ${first.font} px, the button labelled "${first.label}"`);
    check(!!plated.plate && plated.text === words && apart(plated.hint, plated.plate), `E. ${key}: clear of the name plate (hint ${JSON.stringify(plated.hint)}, plate ${JSON.stringify(plated.plate)})`);
    check(after.n === 0 && after.text === null, `E. ${key}: gone with Skip at the boast's end`);
  });
}
async function introHint(phone) {
  const { ctx, page } = await open(REPLAY, { phone });
  await playIntro(page, phone);
  const r = await page.evaluate(() => {
    const R = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
    const cv = document.querySelector('.boot-canvas'), h = document.querySelector('.skip-hint'), k = document.querySelector('.boot-skip');
    return { text: h ? h.textContent : null, hint: R(h), skip: R(k), box: R(cv), stat: window.__boot.stats().hint };
  });
  // The viewer skips the intro (a tap, or Escape) ...
  if (phone) await page.tap('#side-p2'); else await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ active: window.__boot.stats().active, hints: document.querySelectorAll('.skip-hint').length, seen: window.__boast.stats().hintSeen }));
  // ... so the boast at the end shows no hint.
  const e = await endOf(page);
  await toSecondLast(page);
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })));
  await page.waitForFunction(() => window.__boast.stats().active, null, { timeout: 15000 });
  const end = await page.evaluate(() => ({ hint: window.__boast.stats().hint, hints: document.querySelectorAll('.skip-hint').length, skip: !!document.querySelector('.boast-skip') }));
  await ctx.close();
  return { r, after, end, e };
}
{
  const [d, p] = await Promise.all([introHint(false), introHint(true)]);
  for (const [where, x, words] of [['desktop', d, BOARD_KEY], ['phone', p, BOARD_TAP]]) {
    check(x.r.text === words && x.r.stat === words && under(x.r.hint, x.r.skip) && inside(x.r.hint, x.r.box), `E. ${REPLAY} intro, ${where}: "${x.r.text}" under Skip, inside the board`);
    check(!x.after.active && x.after.hints === 0 && x.after.seen === true, `E. ${REPLAY} intro, ${where}: ${where === 'phone' ? 'a tap' : 'Escape'} skips it, the hint goes, the page remembers`);
    check(x.end.hint === null && x.end.hints === 0 && x.end.skip, `E. ${REPLAY} end, ${where}: after that skip the boast shows Skip and no hint`);
  }
}

await browser.close();
server.close();
const secs = (ms) => (ms / 1000).toFixed(1);
log(`\n${passes} passed, ${fails} failed (pages ${secs(built - started)} s, browser ${secs(Date.now() - built)} s)`);
log(fails ? 'BROWSER CHECK FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
