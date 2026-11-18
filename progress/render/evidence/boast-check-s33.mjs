// Render session 33: victory boasts, slice 2b (the two neutral Season 0
// boasts, Boot Sequence and Dial-Up Fireworks), driven in a real (headless)
// Chromium against the committed replays and the boast sheet. Same harness
// as boast-check-s32.mjs. A replay only plays the winner's faction starter
// until slice 3 reads the match record, so for the replay runs the check
// wraps BOAST.play to play the Season 0 boast instead: everything else (the
// hold, the lead-in, the dim, the result) is the replay's own code path.
// Not a repo dependency: run with playwright-core against the preinstalled
// Chromium:
//   node boast-check-s33.mjs <outDir> <render/output> [video]
// Runs, each from a fresh profile: each Season 0 boast on desktop from seat 1
// and seat 2, on a phone, and in reduced motion; Escape during Boot
// Sequence's typing; a phone tap during Dial-Up Fireworks; Shield Slam
// unforced (the starter still plays when nothing is forced); and all 30
// sheet scenes.
// Checks A-H as in boast-check.mjs, plus:
//   I. The boast that plays is the one asked for.
//   K. Boot Sequence: the CRT screen is up; five BIOS lines; the name types
//      into the plate in the BIOS type (a prefix first, the whole name by
//      0.7 s later, a block cursor); a skip mid-typing stops the typing.
//   L. Dial-Up Fireworks: a skyline of towers, one rocket per burst, the
//      name's letters all in place by the lock; the modem sound fired.
//   M. Frame rate during the boast and after it.
import { chromium, launchOpts } from '../../../render/ci/pw.mjs';
import { mkdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
// RETIRED in render session 81 (the render debt list): superseded by boast-check-s39.mjs, which checks the same
// page as it is today and was re-run in render session 80. This version named one machine's Chromium
// (chromium-1194) and no longer started; it now uses render/ci/pw.mjs. Kept for the record;
// RUN_RETIRED=1 runs it anyway.
if (!process.env.RUN_RETIRED) { console.log('boast-check-s33.mjs: retired in render session 81 (superseded by boast-check-s39.mjs).'); process.exit(0); }
const [outDir, outputArg, video] = process.argv.slice(2);
const OUT = resolve(outputArg || 'render/output');
mkdirSync(outDir, { recursive: true });
const b = await chromium.launch(launchOpts({ args: ['--disable-gpu', '--disable-accelerated-2d-canvas', '--autoplay-policy=no-user-gesture-required'] }));
let fails = 0;
const log = (...a) => console.log(...a);
function check(ok, what) { log((ok ? '  PASS ' : '  FAIL ') + what); if (!ok) fails++; }
const TAG = 'v2-s33';

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
      // K: every text the name plate shows, as it types.
      const who = document.querySelector('.boast-who');
      if (who) {
        rec.names = rec.names || [];
        const tx = who.textContent, last = rec.names[rec.names.length - 1];
        if (!last || last[1] !== tx) rec.names.push([t, tx, !!who.querySelector('.boast-cur')]);
      }
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
  if (o.force) await page.evaluate((id) => { const B = window.__boast, play = B.play; B.play = (x, els, opts) => play(id, els, opts); }, o.force);
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
  o.who = st.who;
  check(st.id === o.boast, 'I. boast is ' + o.boast + ' (got ' + st.id + ')');
  if (o.boast === BOOT && !o.reduced) {
    check(st.groups.line === 5, 'K. five BIOS lines (' + st.groups.line + ')');
  }
  if (o.boast === DIAL && !o.reduced) {
    const nm = await page.evaluate((w) => document.querySelector('#hud-' + w + ' .name span, #hud-' + w + ' .name') ? document.querySelector('#hud-' + w + ' .name').textContent : '', winner);
    log(`  groups ${JSON.stringify(st.groups)}`);
    check(st.groups.tower >= 8, 'L. a skyline of towers (' + st.groups.tower + ')');
    check(st.groups.rocket >= 1 && st.groups.rocket <= 6, 'L. one rocket per burst (' + st.groups.rocket + ')');
    check(st.groups.letter >= 25, 'L. the name spelled in pixels (' + st.groups.letter + ' dots)');
    void nm;
  }
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
    await page.waitForTimeout(Math.max(0, (o.skipAt || 1000) - (await now(page) - tStart)));
    const typedBefore = o.boast === BOOT ? await page.evaluate(() => { const n = document.querySelector('.boast-who'); return n ? n.textContent : null; }) : null;
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
    if (o.boast === BOOT) {
      const n1 = (await rec(page, 'names')).length;
      await page.waitForTimeout(500);
      const n2 = (await rec(page, 'names')).length;
      log(`  plate text when skipped: ${JSON.stringify(typedBefore)}; texts recorded ${n1} then ${n2} 0.5 s later`);
      check(typedBefore !== null && typedBefore.length < o.who.length, 'K. skipped while the name was still typing');
      check(n2 <= n1 + 1, 'K. the typing stops with the skip');
    }
    await page.waitForTimeout(400);
    check(!(await page.$('.boast-name')) && !(await page.$('.boast-skip')), 'E. no name, no Skip after a skip');
    check(await page.evaluate((l) => !document.getElementById('side-' + l).classList.contains('boast-dim'), loser), 'E. the dim goes');
    check(!(await page.evaluate(() => window.__boast.stats().active)), 'E. boast no longer active');
    await page.screenshot({ path: `${outDir}/${TAG}-${o.label}-after-skip.jpg`, quality: 70 });
    await ctx.close();
    return;
  }
  if (o.fps) {
    await page.waitForTimeout(Math.max(0, 1300 - (await now(page) - tStart)));
    o.fpsDuring = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); })(); }));
  }
  // Stills along the boast; lit pixels in each side.
  // Every beat on the recorded runs; the name moment on the others.
  const shots = o.reduced ? [[120, 'still']] : o.video ? [[450, 'a'], [1250, 'b'], [1800, 'c'], [2500, 'd-name']] : [[1800, null], [2500, 'd-name']];
  let winnerLit = 0, loserLateLit = 0, loserBaseline = null;
  for (const [ms, name] of shots) {
    await page.waitForTimeout(Math.max(0, ms - (await now(page) - tStart)));
    const wl = await litIn(page, '#side-' + winner), ll = await litIn(page, '#side-' + loser);
    // A Mythic ward on the board draws its top layer at times (its own
    // behaviour, over both sides); its light is not the boast's.
    const ward = await page.evaluate(() => [window.__wards, window.__sigwards].some((W) => W && W.stats().wards.some((w) => w.top > 0)));
    log(`  ${ms} ms: lit winner ${wl}, loser ${ll}${ward ? ' (a Mythic ward is drawing its top layer)' : ''}`);
    winnerLit = Math.max(winnerLit, wl);
    if (ms >= 1800 && !ward) loserLateLit = Math.max(loserLateLit, ll);
    if (loserBaseline === null) loserBaseline = ll;
    if (name && !o.fps) await page.screenshot({ path: `${outDir}/${TAG}-${o.label}-${name}.jpg`, quality: 72 });
  }
  check(winnerLit > 150, 'D. the boast draws on the winner\'s side (' + winnerLit + ' lit samples)');
  if (!o.reduced) check(loserLateLit <= 5, 'D. nothing drawn on the loser\'s side late in the boast (' + loserLateLit + ')');
  const tName = await waitRec(page, 'name');
  const whoNow = await page.evaluate(() => document.querySelector('.boast-name') && document.querySelector('.boast-name').dataset ? null : null);
  void whoNow;
  const name = await rectOf(page, '.boast-name');
  log(`  name plate at ${Math.round(tName - tStart)} ms`);
  const nameAt = o.boast === BOOT ? 1540 : o.boast === DIAL ? 2340 : 2160;
  check(o.reduced ? tName - tStart < 400 : tName - tStart >= nameAt - 100 && tName - tStart <= nameAt + 600, 'B. name plate ' + (o.reduced ? 'at once' : 'about ' + (nameAt / 1000).toFixed(1) + ' s in'));
  if (o.boast === BOOT) {
    const names = await rec(page, 'names');
    const mono = await page.evaluate(() => { const n = document.querySelector('.boast-who'); return n ? getComputedStyle(n).fontFamily : ''; });
    const full = names.findIndex((x) => x[1] === o.who);
    log(`  plate: ${names.length} texts, ${JSON.stringify(names[0][1])} first, the whole name ${full >= 0 ? Math.round(names[full][0] - names[0][0]) + ' ms later' : 'never'} (${mono.split(',')[0]})`);
    if (!o.reduced) {
      check(names[0][1].length < o.who.length && o.who.startsWith(names[0][1]) && names.slice(0, full + 1).every((x, i) => i === 0 || x[1].length > names[i - 1][1].length), 'K. the name types in, a prefix at a time');
      check(full >= 0 && names[full][0] - names[0][0] <= 900, 'K. the whole name within 0.9 s (0.6 s of typing, plus timer slack on a loaded CPU)');
    }
    check(full >= 0 && names[full][2], 'K. the whole name, behind a block cursor');
    check((await page.evaluate(() => window.__boast.stats().fired.crt)) === 1, 'K. the CRT screen came up');
    check(/mono/i.test(mono), 'K. in the BIOS type (' + mono.split(',')[0] + ')');
  }
  check(inside(name, side.w) && !overlaps(name, side.l) && !overlaps(name, side.lh), 'C. name plate inside the winner\'s side, off the loser\'s');
  check(await page.evaluate(() => { const n = document.querySelector('.boast-who'); return n.scrollWidth <= n.clientWidth + 1; }), 'name fits its plate');
  check(await page.evaluate((l) => document.getElementById('side-' + l).innerHTML, loser) === loserBefore, 'C. nothing changes on the loser\'s side');
  check(!/GAME OVER/.test((await turnbar(page)).text), 'A. result still held while the boast plays');
  const tRes = await waitRec(page, 'res');
  const tb = await turnbar(page);
  log(`  result lands ${Math.round(tRes - tStart)} ms into the boast`);
  check(o.reduced ? tRes - tStart >= 950 && tRes - tStart <= 1600 : tRes - tStart >= 2950 && tRes - tStart <= 3700, 'B. result lands as the boast ends (' + (o.reduced ? '~1 s' : '~3 s') + ')');
  check(tb.land, 'A. the result lands (class "land")');
  await page.waitForTimeout(750);
  check(await page.evaluate((l) => getComputedStyle(document.getElementById('side-' + l)).opacity === '1', loser), 'the dim lifts after the boast');
  if (o.fps) {
    // M. Frame rate: rAF frames over 1 s after the boast (compare with the
    // during-boast count taken below in fpsRun).
    const after = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); })(); }));
    o.fpsAfter = after;
  }
  const v = page.video();
  await ctx.close();
  if (v && o.video) renameSync(await v.path(), `${outDir}/${TAG}-${o.label}.webm`);
}

const BOOT = 'boast-s0-boot-sequence', DIAL = 'boast-s0-dial-up-fireworks', AE = 'boast-aegis-shield-slam';
const runs = [
  ['aegis-vs-null-seed3.html', { label: 'boot-desktop-seat1', winner: 'p1', boast: BOOT, force: BOOT, video: !!video }],
  ['cortex-vs-swarm-seed11.html', { label: 'boot-desktop-seat2', winner: 'p2', boast: BOOT, force: BOOT }],
  ['null-vs-swarm-seed2.html', { label: 'boot-phone-seat2', winner: 'p2', boast: BOOT, force: BOOT, phone: true }],
  ['swarm-vs-null-seed8.html', { label: 'boot-reduced', winner: 'p1', boast: BOOT, force: BOOT, reduced: true }],
  ['null-vs-cortex-seed4.html', { label: 'dialup-desktop-seat1', winner: 'p1', boast: DIAL, force: DIAL, video: !!video }],
  ['swarm-vs-null-seed4.html', { label: 'dialup-desktop-seat2', winner: 'p2', boast: DIAL, force: DIAL }],
  ['aegis-vs-cortex-seed1.html', { label: 'dialup-phone-seat2', winner: 'p2', boast: DIAL, force: DIAL, phone: true }],
  ['cortex-vs-swarm-seed6.html', { label: 'dialup-reduced', winner: 'p1', boast: DIAL, force: DIAL, reduced: true }],
  ['cortex-vs-aegis-sig-seed2.html', { label: 'boot-escape-typing', winner: 'p1', boast: BOOT, force: BOOT, skip: true, skipAt: 1640 }],
  ['swarm-vs-aegis-seed8.html', { label: 'dialup-phone-tap', winner: 'p1', boast: DIAL, force: DIAL, phone: true, skip: true, skipAt: 1500 }],
  ['aegis-vs-null-seed3.html', { label: 'shield-unforced', winner: 'p1', boast: AE }],
  ['aegis-vs-null-seed3.html', { label: 'fps-boot', winner: 'p1', boast: BOOT, force: BOOT, fps: true }],
  ['null-vs-cortex-seed4.html', { label: 'fps-dialup', winner: 'p1', boast: DIAL, force: DIAL, fps: true }],
  ['aegis-vs-null-seed3.html', { label: 'fps-shield', winner: 'p1', boast: AE, fps: true }],
];
for (const [file, o] of runs) {
  await replayRun(file, o);
  if (o.fps) log(`  M. frames in 1 s: during the boast ${o.fpsDuring}, after it ${o.fpsAfter}`);
}

{
  log('\nboast-sheet.html — every scene');
  const { ctx, page } = await open('boast-sheet.html', {});
  const keys = await page.evaluate(() => Array.from(document.querySelectorAll('.scene')).map((s) => s.id));
  check(keys.length === 30, 'H. the sheet has 30 scenes (' + keys.length + ')');
  for (const k of keys) {
    await page.evaluate((k) => document.getElementById(k).scrollIntoView({ block: 'center' }), k);
    await page.waitForTimeout(200);
    await page.evaluate((k) => window.playBoastScene(k), k);
    const st = await page.evaluate(() => window.__boast.stats());
    check(st.problem === null && st.still === /reduced/.test(k), `H. ${k}: plays${st.still ? ' (still)' : ''}, no grammar problem`);
    await page.waitForTimeout(/reduced/.test(k) ? 300 : 2500);
    if (!/reduced/.test(k)) {
      const ll = await litIn(page, '#' + k + '-side-l'), wl = await litIn(page, '#' + k + '-side-w');
      check(wl > 100 && ll <= 5, `D. ${k}: lit on the winner's side (${wl}), nothing on the loser's (${ll}) at 2.5 s`);
    }
    if (/s0-/.test(k)) {
      const el = await page.$('#' + k);
      await el.screenshot({ path: `${outDir}/${TAG}-sheet-${k.replace(/^boast-/, '')}.jpg`, quality: 72 });
    }
    await page.waitForFunction(() => !window.__boast.stats().active, null, { timeout: 5000 });
    check(/GAME OVER/.test(await page.evaluate((k) => document.getElementById(k + '-result').textContent, k)), `H. ${k}: result after the boast`);
  }
  await ctx.close();
}

await b.close();
log(`\n${fails ? fails + ' FAILED' : 'ALL PASS'}`);
process.exitCode = fails ? 1 : 0;
