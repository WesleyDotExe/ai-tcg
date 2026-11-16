// Render session 40 (hardening): the three runtime fixes, driven in a real
// (headless) Chromium. Not a repo dependency: run with node and the
// preinstalled playwright-core:
//   node hardening-check-s40.mjs <render/output> [old output dir]
// [old output dir] holds the same pages from before this session, for the
// before/after. Runs:
//   A  the halo clip: each boast on the boast sheet (full row, winner below,
//      desktop), the effects' top canvas read every few frames for the whole
//      boast: lit pixels past the winner's side (more than 3 px out), and on
//      the loser's side itself. The sheet has no lethal attack, so every lit
//      pixel there is the boast's.
//   B  the loser's side is cleared by a particle's reach: a big smoke-sized
//      sprite (160 px) centred 70 px outside a rect, a rect cleared with
//      CFX.fadeOutIn: the sprite fades (its edge reached into the rect); a
//      control sprite 300 px away doesn't. Lit pixels inside the rect after.
//   C  Skip on a touch screen: an emulated phone (coarse pointer): every
//      boast's Skip and the intro's at least 88 x 44 px; on a desktop the
//      boast's Skip is the size it was.
import { chromium, launchOpts } from '../../../render/ci/pw.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
const [outputArg, oldArg] = process.argv.slice(2);
const OUT = resolve(outputArg || 'render/output');
const OLD = oldArg ? resolve(oldArg) : null;
const server = createServer((req, res) => {
  try { const body = readFileSync(decodeURIComponent(new URL(req.url, 'http://x').pathname)); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const HOST = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch({ args: ['--disable-gpu'] });
let fails = 0;
const log = (...a) => console.log(...a);
function check(ok, what) { log((ok ? '  PASS ' : '  FAIL ') + what); if (!ok) fails++; }

async function open(file, o = {}) {
  const ctx = await b.newContext({ viewport: o.viewport || { width: 1280, height: 900 }, hasTouch: !!o.touch, isMobile: !!o.touch, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(HOST + file);
  await page.waitForFunction(() => window.__cfx && window.__cfx.isReady(), null, { timeout: 15000 });
  return { ctx, page };
}

// ---- A: the halo clip ----
const BOASTS = ['boast-aegis-shield-slam', 'boast-swarm-hive-burst', 'boast-null-void-collapse', 'boast-cortex-data-cascade', 'boast-s0-boot-sequence', 'boast-s0-dial-up-fireworks'];
async function haloRun(dir, id) {
  const { ctx, page } = await open(resolve(dir, 'boast-sheet.html'));
  const key = id + '-full';
  await page.evaluate((key) => document.getElementById(key).scrollIntoView({ block: 'center' }), key);
  await page.waitForTimeout(300);
  const r = await page.evaluate((key) => new Promise((done) => {
    const cv = document.querySelector('canvas.fx-top'), g = cv.getContext('2d', { willReadFrequently: true });
    const dpr = cv.width / window.innerWidth;
    window.playBoastScene(key);
    const out = { samples: 0, outside: 0, onLoser: 0, far: 0, peakOutside: 0 };
    let n = 0;
    (function f() {
      const s = window.__boast.stats();
      if (n++ % 3 === 0) {
        const band = document.getElementById(key + '-side-w').getBoundingClientRect();
        const lz = [document.getElementById(key + '-side-l').getBoundingClientRect(), document.getElementById(key + '-hud-l').getBoundingClientRect()];
        const d = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
        let o = 0;
        for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
          if (d[(y * W + x) * 4 + 3] <= 6) continue;
          const px = x / dpr, py = y / dpr;
          const dist = Math.max(band.left - px, px - band.right, band.top - py, py - band.bottom);
          if (dist <= 3) continue;
          o++; out.far = Math.max(out.far, dist);
          if (lz.some((q) => px >= q.left && px <= q.right && py >= q.top && py <= q.bottom)) out.onLoser++;
        }
        out.outside += o; out.peakOutside = Math.max(out.peakOutside, o); out.samples++;
      }
      if (s.active || n < 5) requestAnimationFrame(f); else done(out);
    })();
  }), key);
  await ctx.close();
  return r;
}
log('[A] the halo clip: lit pixels on the effects\' top canvas past the winner\'s side, every boast (sampled every 3rd frame, every 2nd pixel)');
for (const id of BOASTS) {
  const now = await haloRun(OUT, id);
  const old = OLD ? await haloRun(OLD, id) : null;
  log(`  ${id}: now ${now.samples} samples, ${now.outside} lit past the side (${now.onLoser} on the loser's), farthest ${now.far.toFixed(1)} px` +
    (old ? `; before: ${old.outside} lit past the side (${old.onLoser} on the loser's), farthest ${old.far.toFixed(1)} px` : ''));
  check(now.samples >= 10, `A. ${id}: sampled the whole boast`);
  check(now.outside === 0, `A. ${id}: nothing lit past the winner's side`);
}

// ---- B: the loser's side is cleared by a particle's reach ----
async function reachRun(dir) {
  const { ctx, page } = await open(resolve(dir, 'boast-sheet.html'));
  await page.evaluate(() => window.scrollTo(0, 0));
  const r = await page.evaluate(() => new Promise((done) => {
    const C = window.__cfx, K = C.kit, cv = document.querySelector('canvas.fx-top'), g = cv.getContext('2d', { willReadFrequently: true });
    const rect = { l: 200, t: 420, r: 700, b: 560 };
    // A smoke-sized sprite centred 70 px above the rect (its edge reaches
    // 80 px down), and a control 300 px above it.
    K.spr(0, [200, 200, 200], 450, rect.t - 70, { s0: 160, s1: 160, life: 6, rot: 0, a: 1 });
    K.spr(0, [200, 200, 200], 450, rect.t - 300, { s0: 160, s1: 160, life: 6, rot: 0, a: 1 });
    K.kick();
    setTimeout(() => {
      const before = C.stats().particles, inRect0 = C.countIn(rect);
      C.fadeOutIn(rect, 200);
      setTimeout(() => {
        const dpr = cv.width / window.innerWidth, d = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width;
        let lit = 0;
        for (let y = Math.ceil(rect.t * dpr); y < rect.b * dpr; y++) for (let x = Math.ceil(rect.l * dpr); x < rect.r * dpr; x++) if (d[(y * W + x) * 4 + 3] > 6) lit++;
        done({ before, inRect0, after: C.stats().particles, lit });
      }, 600);
    }, 300);
  }));
  await ctx.close();
  return r;
}
log('\n[B] fadeOutIn by reach: a 160 px sprite centred 70 px outside the cleared rect, a control 300 px out');
{
  const now = await reachRun(OUT);
  const old = OLD ? await reachRun(OLD) : null;
  log(`  now: ${now.before} particles, ${now.inRect0} counted in the rect; after the clear ${now.after} left, ${now.lit} lit pixels inside the rect` +
    (old ? `\n  before: ${old.before} particles, ${old.inRect0} counted in the rect; after the clear ${old.after} left, ${old.lit} lit pixels inside the rect` : ''));
  check(now.before === 2 && now.inRect0 === 1, 'B. the near sprite counts as in the rect (its edge reaches it), the control does not');
  check(now.after === 1, 'B. the near sprite is cleared, the control stays');
  check(now.lit === 0, 'B. nothing lit inside the cleared rect');
}

// ---- C: Skip on a touch screen ----
async function skipSize(dir, file, how, touch) {
  const { ctx, page } = await open(resolve(dir, file), touch ? { touch: true, viewport: { width: 390, height: 844 } } : {});
  let r;
  if (how === 'boast') {
    r = await page.evaluate(() => { window.playBoastScene('boast-aegis-shield-slam-phone'); const k = document.querySelector('.boast-skip'); const q = k.getBoundingClientRect(); return { w: q.width, h: q.height, coarse: matchMedia('(pointer: coarse)').matches }; });
  } else {
    await page.evaluate(() => document.getElementById('btn-play').click());
    await page.waitForSelector('.boot-skip', { timeout: 5000 });
    r = await page.evaluate(() => { const k = document.querySelector('.boot-skip'); const q = k.getBoundingClientRect(); return { w: q.width, h: q.height, coarse: matchMedia('(pointer: coarse)').matches }; });
  }
  await ctx.close();
  return r;
}
log('\n[C] Skip on a touch screen (emulated phone, 390 x 844, coarse pointer) and on a desktop');
{
  const fmt = (s) => `${s.w.toFixed(1)} x ${s.h.toFixed(1)} px`;
  const bt = await skipSize(OUT, 'boast-sheet.html', 'boast', true), bd = await skipSize(OUT, 'boast-sheet.html', 'boast', false);
  const it = await skipSize(OUT, 'cortex-vs-swarm-seed6.html', 'intro', true);
  const obt = OLD ? await skipSize(OLD, 'boast-sheet.html', 'boast', true) : null, obd = OLD ? await skipSize(OLD, 'boast-sheet.html', 'boast', false) : null;
  const oit = OLD ? await skipSize(OLD, 'cortex-vs-swarm-seed6.html', 'intro', true) : null;
  log(`  boast, phone: ${fmt(bt)}${obt ? ` (before: ${fmt(obt)})` : ''}; boast, desktop: ${fmt(bd)}${obd ? ` (before: ${fmt(obd)})` : ''}; intro, phone: ${fmt(it)}${oit ? ` (before: ${fmt(oit)})` : ''}`);
  check(bt.coarse && bt.w >= 88 && bt.h >= 44, 'C. a boast\'s Skip is at least 88 x 44 px on a touch screen');
  check(it.coarse && it.w >= 88 && it.h >= 44, 'C. the intro\'s Skip still is');
  check(!bd.coarse && bd.h < 44 && (!obd || (Math.abs(bd.w - obd.w) < 0.5 && Math.abs(bd.h - obd.h) < 0.5)), 'C. on a desktop the boast\'s Skip is unchanged');
}

await b.close();
server.close();
log(`\n${fails ? fails + ' FAILED' : 'ALL PASS'}`);
process.exit(fails ? 1 : 0);
