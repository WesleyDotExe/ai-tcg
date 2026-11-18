// Render session 32: victory boasts, slice 2 (Hive Burst, Void Collapse,
// Data Cascade, and the "Cosmetics: on / off" switch), driven in a real
// (headless) Chromium against the committed replays and the boast sheet.
// Same harness as boast-check.mjs (session 31), widened to every starter
// boast. Not a repo dependency: run with playwright-core against the
// preinstalled Chromium:
//   node boast-check-s32.mjs <outDir> <render/output> [video]
// Runs, each from a fresh profile:
//   each new boast on desktop from seat 1 (the bottom side) and seat 2 (the
//   top side), and on a phone; Shield Slam again (unchanged); reduced motion
//   for each new boast; Escape and a phone tap; a jump to the end; the
//   cosmetics switch (off before the win, off mid-boast, remembered after a
//   reload); and all 20 sheet scenes.
// Checks A-H as in boast-check.mjs, plus:
//   I. The boast that plays is the winner's faction starter.
//   J. Cosmetics off: a stepped win shows the result at once and plays no
//      boast; switching off mid-boast ends it and lands the result at once;
//      the switch is remembered after a reload and reads "Cosmetics: off".
import { chromium, launchOpts } from '../../../render/ci/pw.mjs';
import { mkdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
// RETIRED in render session 81 (the render debt list): superseded by boast-check-s39.mjs, which checks the same
// page as it is today and was re-run in render session 80. This version named one machine's Chromium
// (chromium-1194) and no longer started; it now uses render/ci/pw.mjs. Kept for the record;
// RUN_RETIRED=1 runs it anyway.
if (!process.env.RUN_RETIRED) { console.log('boast-check-s32.mjs: retired in render session 81 (superseded by boast-check-s39.mjs).'); process.exit(0); }
const [outDir, outputArg, video] = process.argv.slice(2);
const OUT = resolve(outputArg || 'render/output');
mkdirSync(outDir, { recursive: true });
const b = await chromium.launch(launchOpts({ args: ['--disable-gpu', '--disable-accelerated-2d-canvas', '--autoplay-policy=no-user-gesture-required'] }));
let fails = 0;
const log = (...a) => console.log(...a);
function check(ok, what) { log((ok ? '  PASS ' : '  FAIL ') + what); if (!ok) fails++; }
const TAG = 'v2-s32';

async function open(file, o) {
  const ctx = await b.newContext({
    viewport: o.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    deviceScaleFactor: 1, hasTouch: !!o.phone, isMobile: !!o.phone,
    reducedMotion: o.reduced ? 'reduce' : 'no-preference',
    recordVideo: o.video ? { dir: outDir, size: o.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 } } : undefined,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { log('  PAGE ERROR ' + e.message); fails++; });
  await page.goto('file://' + resolve(OUT, file));
  await page.waitForFunction(() => document.querySelectorAll('.fx-canvas').length === 2);
  await page.waitForTimeout(400);
  return { ctx, page };
}

// Lit pixels on the top canvas inside a rect (viewport px).
const litIn = (page, sel) => page.evaluate((sel) => {
  const c = document.querySelector('canvas.fx-top'), el = document.querySelector(sel);
  const r = el.getBoundingClientRect(), dpr = c.width / window.innerWidth;
  const x = Math.max(0, Math.floor(r.left * dpr)), y = Math.max(0, Math.floor(r.top * dpr));
  const w = Math.min(c.width - x, Math.ceil(r.width * dpr)), h = Math.min(c.height - y, Math.ceil(r.height * dpr));
  if (w <= 0 || h <= 0) return 0;
  const d = c.getContext('2d').getImageData(x, y, w, h).data;
  let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++;
  return n;
}, sel);

const rectOf = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, sel);
const inside = (a, o) => a && o && a.l >= o.l - 2 && a.r <= o.r + 2 && a.t >= o.t - 2 && a.b <= o.b + 2;
const overlaps = (a, o) => a && o && a.l < o.r && a.r > o.l && a.t < o.b && a.b > o.t;

// Steps from the second-last move into the last (the lethal move).
// The headless browser draws with a software GPU (about 5 fps on any FX
// move, the boast included), so times are taken inside the page: a
// recorder notes when the Skip button, the name plate and the result line
// first appear, and the step itself is dispatched in the page.
async function stepIntoEnd(page) {
  await page.evaluate(() => { const s = document.getElementById('scrubber'); s.value = String(Number(s.max) - 1); s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const rec = window.__rec = {};
    const tb = document.getElementById('turnbar');
    const look = () => {
      const t = performance.now();
      if (!rec.skip && document.querySelector('.boast-skip')) rec.skip = t;
      if (!rec.name && document.querySelector('.boast-name')) rec.name = t;
      if (!rec.res && /GAME OVER/.test(tb.textContent)) rec.res = t;
    };
    new MutationObserver(look).observe(document.body, { subtree: true, childList: true, characterData: true });
    const t0 = performance.now();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    look();
    return t0;
  });
}
const rec = (page, k) => page.evaluate((k) => window.__rec[k] || null, k);
const now = (page) => page.evaluate(() => performance.now());
const turnbar = (page) => page.evaluate(() => { const w = document.querySelector('#turnbar .win'); return { text: document.getElementById('turnbar').textContent, land: !!(w && w.classList.contains('land')) }; });
async function waitFor(page, fn, arg, ms = 12000) { await page.waitForFunction(fn, arg, { timeout: ms, polling: 16 }); return now(page); }
async function waitRec(page, k, ms = 12000) { await page.waitForFunction((k) => !!window.__rec[k], k, { timeout: ms, polling: 16 }); return rec(page, k); }

async function replayRun(file, o) {
  const winner = o.winner, loser = winner === 'p1' ? 'p2' : 'p1';
  log(`\n${file} — ${o.label}`);
  const { ctx, page } = await open(file, o);
  const t0 = await stepIntoEnd(page);
  const held = await turnbar(page);
  check(!/GAME OVER/.test(held.text), 'A. result held when the win lands');
  const tStart = await waitRec(page, 'skip');
  log(`  boast starts ${Math.round(tStart - t0)} ms after the step`);
  check(tStart - t0 >= 850 && tStart - t0 <= 2200, 'B. starts after the lethal beat (0.85-2.2 s)');
  // The lethal move has settled by now: the loser's side must not change
  // from here to the end of the boast.
  const loserBefore = await page.evaluate((l) => document.getElementById('side-' + l).innerHTML, loser);
  const st = await page.evaluate(() => window.__boast.stats());
  check(st.id === o.boast, 'I. boast is ' + o.boast + ' (the winner\'s faction starter; got ' + st.id + ')');
  check(st.problem === null, 'C. the page\'s plan keeps the grammar on the live layout (' + st.problem + ')');
  check(st.still === !!o.reduced, o.reduced ? 'F. reduced motion plays the still' : 'plays in full (not the still)');
  const dims = await page.evaluate((l) => ['side-', 'hud-', 'hand-'].map((p) => getComputedStyle(document.getElementById(p + l)).opacity), loser);
  await page.waitForTimeout(350);
  const dims2 = await page.evaluate((l) => ['side-', 'hud-', 'hand-'].map((p) => getComputedStyle(document.getElementById(p + l)).opacity), loser);
  check(dims2.every((x) => Math.abs(Number(x) - 0.7) < 0.02), 'C. loser side, panel and hand dimmed to 0.7 (' + dims2.join(', ') + ')');
  check(await page.evaluate((w) => document.getElementById('hud-' + w).classList.contains('boast-panel'), winner), 'C. the winner\'s panel lit');
  const vis = await page.evaluate((w) => { const r = document.getElementById('side-' + w).getBoundingClientRect(); return r.top >= -2 && r.bottom <= window.innerHeight + 2; }, winner);
  check(vis, 'the winner\'s side is in view during the boast');
  const side = { w: await rectOf(page, '#side-' + winner), l: await rectOf(page, '#side-' + loser), lh: await rectOf(page, '#hud-' + loser) };
  const skip = await rectOf(page, '.boast-skip');
  check(inside(skip, side.w) && !overlaps(skip, side.l), 'C. Skip button inside the winner\'s side');
  if (o.skip) {
    await page.waitForTimeout(Math.max(0, 1000 - (await now(page) - tStart)));
    const tS = await now(page);
    if (o.phone) await page.touchscreen.tap(195, 420); else await page.keyboard.press('Escape');
    const tS2 = await page.evaluate(() => window.__boast.stats().last);
    log(`  skip seen by the boast at ${tS2 && tS2.t} ms (${tS2 && tS2.reason})`);
    check(tS2 && tS2.reason === 'skip', 'E. the boast ended by the skip');
    await waitRec(page, 'res');
    const tR = await rec(page, 'res');
    const lag = tR - (tStart + (tS2 ? tS2.t : 0));
    log(`  skip pressed ${Math.round(tS - tStart)} ms in; result ${Math.round(lag)} ms after the boast saw it`);
    check(lag < 150, 'E. skip lands the result at once');
    await page.waitForTimeout(400);
    check(!(await page.$('.boast-name')) && !(await page.$('.boast-skip')), 'E. no name, no Skip after a skip');
    check(await page.evaluate((l) => !document.getElementById('side-' + l).classList.contains('boast-dim'), loser), 'E. the dim goes');
    check(!(await page.evaluate(() => window.__boast.stats().active)), 'E. boast no longer active');
    await page.screenshot({ path: `${outDir}/${TAG}-${o.label}-after-skip.jpg`, quality: 70 });
    await ctx.close();
    return;
  }
  // Stills along the boast; lit pixels in each side.
  const shots = o.reduced ? [[120, 'still']] : [[450, 'a'], [1250, 'b'], [1800, 'c'], [2500, 'd-name']];
  let winnerLit = 0, loserLateLit = 0, loserBaseline = null;
  for (const [ms, name] of shots) {
    await page.waitForTimeout(Math.max(0, ms - (await now(page) - tStart)));
    const wl = await litIn(page, '#side-' + winner), ll = await litIn(page, '#side-' + loser);
    log(`  ${ms} ms: lit winner ${wl}, loser ${ll}`);
    winnerLit = Math.max(winnerLit, wl);
    if (ms >= 1800) loserLateLit = Math.max(loserLateLit, ll);
    if (loserBaseline === null) loserBaseline = ll;
    await page.screenshot({ path: `${outDir}/${TAG}-${o.label}-${name}.jpg`, quality: 72 });
  }
  check(winnerLit > 150, 'D. the boast draws on the winner\'s side (' + winnerLit + ' lit samples)');
  if (!o.reduced) check(loserLateLit <= 5, 'D. nothing drawn on the loser\'s side late in the boast (' + loserLateLit + ')');
  const tName = await waitRec(page, 'name');
  const name = await rectOf(page, '.boast-name');
  log(`  name plate at ${Math.round(tName - tStart)} ms`);
  check(o.reduced ? tName - tStart < 400 : tName - tStart >= 2100 && tName - tStart <= 2800, 'B. name plate ' + (o.reduced ? 'at once' : 'about 2.2 s in'));
  check(inside(name, side.w) && !overlaps(name, side.l) && !overlaps(name, side.lh), 'C. name plate inside the winner\'s side, off the loser\'s');
  check(await page.evaluate(() => { const n = document.querySelector('.boast-who'); return n.scrollWidth <= n.clientWidth + 1; }), 'name fits its plate');
  check(await page.evaluate((l) => document.getElementById('side-' + l).innerHTML, loser) === loserBefore, 'C. nothing changes on the loser\'s side');
  check(!/GAME OVER/.test((await turnbar(page)).text), 'A. result still held while the boast plays');
  const tRes = await waitRec(page, 'res');
  const tb = await turnbar(page);
  log(`  result lands ${Math.round(tRes - tStart)} ms into the boast`);
  check(o.reduced ? tRes - tStart >= 950 && tRes - tStart <= 1600 : tRes - tStart >= 2950 && tRes - tStart <= 3700, 'B. result lands as the boast ends (' + (o.reduced ? '~1 s' : '~3 s') + ')');
  check(tb.land, 'A. the result lands (class "land")');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/${TAG}-${o.label}-e-result.jpg`, quality: 72 });
  await page.waitForTimeout(500);
  check(await page.evaluate((l) => getComputedStyle(document.getElementById('side-' + l)).opacity === '1', loser), 'the dim lifts after the boast');
  const fps = await page.evaluate(() => window.CFX ? null : null);
  void fps;
  const v = page.video();
  await ctx.close();
  if (v && o.video) renameSync(await v.path(), `${outDir}/${TAG}-${o.label}.webm`);
}

const SW = 'boast-swarm-hive-burst', NU = 'boast-null-void-collapse', CO = 'boast-cortex-data-cascade', AE = 'boast-aegis-shield-slam';
await replayRun('swarm-vs-aegis-seed8.html', { label: 'swarm-desktop-seat1', winner: 'p1', boast: SW, video: !!video });
await replayRun('cortex-vs-swarm-seed11.html', { label: 'swarm-desktop-seat2', winner: 'p2', boast: SW });
await replayRun('null-vs-swarm-seed2.html', { label: 'swarm-phone-seat2', winner: 'p2', boast: SW, phone: true });
await replayRun('swarm-vs-null-seed8.html', { label: 'swarm-reduced', winner: 'p1', boast: SW, reduced: true });
await replayRun('null-vs-cortex-seed4.html', { label: 'null-desktop-seat1', winner: 'p1', boast: NU, video: !!video });
await replayRun('swarm-vs-null-seed4.html', { label: 'null-desktop-seat2', winner: 'p2', boast: NU });
await replayRun('null-vs-cortex-seed4.html', { label: 'null-phone-seat1', winner: 'p1', boast: NU, phone: true });
await replayRun('swarm-vs-null-seed4.html', { label: 'null-reduced', winner: 'p2', boast: NU, reduced: true });
await replayRun('cortex-vs-null-seed5.html', { label: 'cortex-desktop-seat1', winner: 'p1', boast: CO, video: !!video });
await replayRun('aegis-vs-cortex-seed1.html', { label: 'cortex-desktop-seat2', winner: 'p2', boast: CO });
await replayRun('aegis-vs-cortex-seed1.html', { label: 'cortex-phone-seat2', winner: 'p2', boast: CO, phone: true });
await replayRun('cortex-vs-swarm-seed6.html', { label: 'cortex-reduced', winner: 'p1', boast: CO, reduced: true });
await replayRun('aegis-vs-null-seed3.html', { label: 'aegis-desktop-seat1', winner: 'p1', boast: AE });
await replayRun('cortex-vs-aegis-sig-seed2.html', { label: 'cortex-escape', winner: 'p1', boast: CO, skip: true });
await replayRun('swarm-vs-aegis-seed8.html', { label: 'swarm-phone-tap', winner: 'p1', boast: SW, phone: true, skip: true });

{
  log('\nnull-vs-cortex-seed4.html — jump to the end');
  const { ctx, page } = await open('null-vs-cortex-seed4.html', {});
  await page.click('#btn-last');
  await page.waitForTimeout(1800);
  const tb = await turnbar(page);
  check(/GAME OVER/.test(tb.text) && !(await page.$('.boast-skip')), 'G. a jump to the end shows the result at once, no boast');
  await ctx.close();
}
{
  log('\nswarm-vs-aegis-seed8.html — cosmetics off');
  const { ctx, page } = await open('swarm-vs-aegis-seed8.html', {});
  const btn = () => page.evaluate(() => { const b = document.getElementById('btn-cosmetics'); return { text: b.textContent, pressed: b.getAttribute('aria-pressed') }; });
  check((await btn()).text === 'Cosmetics: on', 'J. the switch starts on ("' + (await btn()).text + '")');
  // Off mid-boast: it ends at once and the result lands.
  const t0 = await stepIntoEnd(page);
  const tStart = await waitRec(page, 'skip');
  await page.waitForTimeout(Math.max(0, 900 - (await now(page) - tStart)));
  await page.click('#btn-cosmetics');
  const last = await page.evaluate(() => window.__boast.stats().last);
  const tRes = await waitRec(page, 'res', 2000);
  log(`  switched off ${last && last.t} ms into the boast (${last && last.reason}); result ${Math.round(tRes - (tStart + (last ? last.t : 0)))} ms later`);
  check(last && last.reason === 'skip' && tRes - (tStart + last.t) < 150, 'J. switching off mid-boast ends it and lands the result at once');
  check(!(await page.evaluate(() => window.__boast.stats().active)), 'J. no boast active after switching off');
  const b1 = await btn();
  check(b1.text === 'Cosmetics: off' && b1.pressed === 'false', 'J. the switch reads off (' + b1.text + ', aria-pressed ' + b1.pressed + ')');
  void t0;
  // Remembered: reload, step into the win again, no boast at all.
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.fx-canvas').length === 2);
  await page.waitForTimeout(400);
  check((await btn()).text === 'Cosmetics: off', 'J. remembered after a reload');
  await stepIntoEnd(page);
  await page.waitForTimeout(60);
  check(/GAME OVER/.test((await turnbar(page)).text), 'J. off: the result shows at once');
  await page.waitForTimeout(2200);
  check(!(await page.$('.boast-skip')) && (await page.evaluate(() => window.__boast.stats().played)) === 0, 'J. off: no boast plays');
  await page.screenshot({ path: `${outDir}/${TAG}-cosmetics-off.jpg`, quality: 72 });
  // On again: the next stepped win plays it.
  await page.click('#btn-cosmetics');
  await stepIntoEnd(page);
  await waitRec(page, 'skip');
  check((await page.evaluate(() => window.__boast.stats().id)) === SW, 'J. on again: the boast plays');
  await ctx.close();
}
{
  log('\nboast-sheet.html — every scene');
  const { ctx, page } = await open('boast-sheet.html', {});
  const keys = await page.evaluate(() => Array.from(document.querySelectorAll('.scene')).map((s) => s.id));
  for (const k of keys) {
    await page.evaluate((k) => document.getElementById(k).scrollIntoView({ block: 'center' }), k);
    await page.waitForTimeout(200);
    await page.evaluate((k) => window.playBoastScene(k), k);
    const st = await page.evaluate(() => window.__boast.stats());
    check(st.problem === null && st.still === /reduced/.test(k), `H. ${k}: plays${st.still ? ' (still)' : ''}, no grammar problem`);
    await page.waitForTimeout(/reduced/.test(k) ? 300 : 2500);
    const el = await page.$('#' + k);
    await el.screenshot({ path: `${outDir}/${TAG}-sheet-${k.replace(/^boast-/, '')}.jpg`, quality: 72 });
    await page.waitForFunction(() => !window.__boast.stats().active, null, { timeout: 5000 });
    check(/GAME OVER/.test(await page.evaluate((k) => document.getElementById(k + '-result').textContent, k)), `H. ${k}: result after the boast`);
  }
  await ctx.close();
}

await b.close();
log(`\n${fails ? fails + ' FAILED' : 'ALL PASS'}`);
process.exitCode = fails ? 1 : 0;
