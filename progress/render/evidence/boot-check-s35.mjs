// Render session 35: Match Boot slice 1 (the intro at the start of every
// match), and the two end-of-match fixes, driven in a real (headless)
// Chromium. Not a repo dependency: run with tsx (it imports the render's own
// saying picker to know what each replay must show) and playwright-core
// against the preinstalled Chromium:
//   npx tsx boot-check-s35.mjs <outDir> <render/output> [video]
// Runs, each from a fresh profile:
//   A-F  a desktop sample replay: Play at move 0 plays the intro (the seed's
//        saying, both agents' lines, the sounds), about 2.6 s, then move 1
//        at once and playback goes on; recorded as a video.
//   G    Escape, the Skip button and (on a phone) a tap skip it; move 1 at once.
//   H    pause during the intro cancels it and stays on move 0.
//   I    no intro on page open, a step, a resume mid-match; |< then Play
//        plays it again; Play at the end replays from move 0 with it.
//   J    reduced motion: the still, about 1 s, then move 1.
//   K    the Cosmetics switch off doesn't touch it.
//   L    a phone: the board scrolled into view, the saying inside the screen.
//   M    the end-of-match fixes, on the close-win recorded replay (winner
//        below) and a sample won from above: the gauge shows the winner
//        ahead once the match is won; whatever the lethal beat left on the
//        loser's side is gone within 0.4 s of the boast starting.
//   N    the sheet: all nine sayings over all four factions and a mirror
//        match, two phone scenes and the still, each laid out without a
//        grammar problem; a still of each at the saying.
import { chromium, launchOpts } from '../../../render/ci/pw.mjs';
import { mkdirSync, renameSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootSaying, bootLine, BOOT_MS, BOOT_STILL_MS } from '../../../render/src/matchBootFx.ts';
// RETIRED in render session 81 (the render debt list): superseded by boot-check-s38.mjs, which checks the same
// page as it is today and was re-run in render session 80. This version named one machine's Chromium
// (chromium-1194) and no longer started; it now uses render/ci/pw.mjs. Kept for the record;
// RUN_RETIRED=1 runs it anyway.
if (!process.env.RUN_RETIRED) { console.log('boot-check-s35.mjs: retired in render session 81 (superseded by boot-check-s38.mjs).'); process.exit(0); }
const [outDir, outputArg, video] = process.argv.slice(2);
const OUT = resolve(outputArg || 'render/output');
mkdirSync(outDir, { recursive: true });
const b = await chromium.launch(launchOpts({ args: ['--disable-gpu', '--disable-accelerated-2d-canvas', '--autoplay-policy=no-user-gesture-required'] }));
let fails = 0;
const log = (...a) => console.log(...a);
function check(ok, what) { log((ok ? '  PASS ' : '  FAIL ') + what); if (!ok) fails++; }
const TAG = 'v2-s35';

function matchData(file) {
  const html = readFileSync(resolve(OUT, file), 'utf8');
  return JSON.parse(html.match(/<script type="application\/json" id="match-data">([\s\S]*?)<\/script>/)[1]);
}
async function open(file, o = {}) {
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
  // A recorder in the page: when the intro is first seen, its stats while
  // it runs, and when each move first shows (the headless browser is slow,
  // so times are taken inside the page).
  await page.evaluate(() => {
    const rec = window.__rec = { moves: {}, bootSeen: null, bootGone: null, maxT: 0 };
    const fc = document.getElementById('framecount');
    const look = () => {
      const t = performance.now(), m = (fc.textContent.match(/move (\d+)/) || [])[1];
      if (m != null && rec.moves[m] == null) rec.moves[m] = t;
      const s = window.__boot.stats();
      if (s.active) { if (rec.bootSeen == null) rec.bootSeen = t; rec.maxT = Math.max(rec.maxT, s.t); rec.saying = s.saying; rec.lines = s.lines; rec.still = s.still; }
      else if (rec.bootSeen != null && rec.bootGone == null) rec.bootGone = t;
      requestAnimationFrame(look);
    };
    look();
  });
  return { ctx, page };
}
const stats = (page) => page.evaluate(() => window.__boot.stats());
const rec = (page) => page.evaluate(() => window.__rec);
const clickPlay = (page) => page.evaluate(() => { window.__rec.click = performance.now(); document.getElementById('btn-play').click(); });
const waitT = (page, t) => page.waitForFunction((t) => { const s = window.__boot.stats(); return !s.active || s.t >= t; }, t, { timeout: 15000 });
const moveNow = (page) => page.evaluate(() => Number((document.getElementById('framecount').textContent.match(/move (\d+)/) || [])[1]));
async function closeCtx(ctx, page, name) {
  const v = page.video();
  await ctx.close();
  if (v && name) renameSync(await v.path(), resolve(outDir, name));
}

// ---- A-F: a desktop sample replay, played from move 0 ----------------------
{
  const file = 'cortex-vs-swarm-seed6.html', md = matchData(file);
  log(`\n[A-F] ${file}: Play at move 0 (seed ${md.seed})`);
  const { ctx, page } = await open(file, { video: !!video });
  await clickPlay(page);
  await page.waitForFunction(() => window.__boot.stats().active, null, { timeout: 3000 });
  const want = bootSaying(md.seed);
  const s0 = await stats(page);
  check(s0.saying === want, `A. the saying is the seed's: "${s0.saying}" (expected "${want}")`);
  const lines = [bootLine(md.identities.p2.username, md.factions.p2), bootLine(md.identities.p1.username, md.factions.p1)];
  check(JSON.stringify(s0.lines) === JSON.stringify(lines), `B. both agents' lines, seat 2 above and seat 1 below: ${JSON.stringify(s0.lines)}`);
  for (const [t, k] of [[220, 'a-power'], [900, 'b-lines'], [1460, 'c-handshake'], [1720, 'd-saying'], [2380, 'e-outro']]) {
    await waitT(page, t);
    await page.screenshot({ path: resolve(outDir, `${TAG}-boot-desktop-${k}.jpg`), quality: 80 });
  }
  check((await moveNow(page)) === 0 || (await stats(page)).active === false, 'C. the board stays on move 0 while the intro plays');
  await page.waitForFunction(() => window.__rec.moves['2'] != null, null, { timeout: 15000 });
  const r = await rec(page), s1 = await stats(page);
  check(r.bootSeen - r.click < 120, `D. the intro starts at once (${Math.round(r.bootSeen - r.click)} ms after the click)`);
  check(s1.last && s1.last.reason === 'end' && Math.abs(s1.last.t - BOOT_MS) <= 150, `D. it ends on its own at about ${BOOT_MS} ms (${s1.last && s1.last.t} ms)`);
  check(r.moves['1'] - r.bootGone < 300 && r.moves['1'] > r.bootGone - 50, `E. move 1 shows as it ends (${Math.round(r.moves['1'] - r.bootGone)} ms after)`);
  check(r.moves['2'] > r.moves['1'], `E. playback goes on (move 2 ${Math.round(r.moves['2'] - r.moves['1'])} ms after move 1)`);
  const f = s1.fired;
  check(f['sound:crt'] === 1 && f['sound:handshake'] === 1 && f['sound:bootHit'] === 1 && f['sound:type'] >= 10 && f.duck === 1, `F. sounds: the thump, ${f['sound:type']} key clicks, the chirp, the hit; the music ducked once`);
  await page.waitForTimeout(500);
  await closeCtx(ctx, page, video ? `${TAG}-boot-desktop.webm` : null);
}

// ---- G: skip by Escape, the Skip button, a phone tap -------------------------
for (const how of ['escape', 'button', 'tap']) {
  const file = how === 'tap' ? 'null-vs-swarm-seed2.html' : 'aegis-vs-null-seed3.html';
  log(`\n[G] ${file}: skip by ${how}`);
  const { ctx, page } = await open(file, { phone: how === 'tap' });
  await clickPlay(page);
  await waitT(page, 1000);
  await page.evaluate(() => { window.__rec.skipAt = performance.now(); });
  if (how === 'escape') await page.keyboard.press('Escape');
  else if (how === 'button') await page.click('.boot-skip');
  else { const box = await page.locator('#side-p2').boundingBox(); await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); }
  await page.waitForFunction(() => window.__rec.moves['1'] != null, null, { timeout: 5000 });
  const r = await rec(page), s = await stats(page);
  check(s.last.reason === 'skip' && s.skipped === 1, `G. ${how}: skipped at ${s.last.t} ms`);
  check(r.moves['1'] - r.skipAt < 400, `G. ${how}: move 1 at once (${Math.round(r.moves['1'] - r.skipAt)} ms)`);
  check((await page.locator('.boot-canvas, .boot-skip').count()) === 0, `G. ${how}: the intro's canvas and Skip are gone`);
  if (how === 'tap') await page.screenshot({ path: resolve(outDir, `${TAG}-boot-phone-after-tap.jpg`), quality: 80 });
  await ctx.close();
}

// ---- H: pause during the intro --------------------------------------------
{
  const file = 'aegis-vs-null-seed3.html';
  log(`\n[H] ${file}: pause during the intro`);
  const { ctx, page } = await open(file);
  await clickPlay(page);
  await waitT(page, 900);
  await page.click('#btn-play');
  await page.waitForTimeout(3200);
  const s = await stats(page);
  check(!s.active && s.cancelled === 1 && s.ended === 0 && s.skipped === 0, `H. pause cancels the intro (cancelled ${s.cancelled}, ended ${s.ended})`);
  check((await moveNow(page)) === 0, 'H. and the board stays on move 0');
  check((await page.locator('#btn-play').textContent()) === '▶', 'H. the play button reads Play again');
  await ctx.close();
}

// ---- I: when it doesn't play, and when it plays again ------------------------
{
  const file = 'swarm-vs-aegis-seed8.html';
  log(`\n[I] ${file}: page open, a step, a resume, |< then Play, Play at the end`);
  const { ctx, page } = await open(file);
  await page.waitForTimeout(1200);
  check((await stats(page)).played === 0, 'I. no intro on page open');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  check((await stats(page)).played === 0 && (await moveNow(page)) === 1, 'I. no intro on a step (move 1 shows)');
  await page.evaluate(() => { const s = document.getElementById('scrubber'); s.value = '20'; s.dispatchEvent(new Event('input')); });
  await clickPlay(page);
  await page.waitForTimeout(1500);
  check((await stats(page)).played === 0 && (await moveNow(page)) > 20, `I. no intro on a resume mid-match (now move ${await moveNow(page)})`);
  await page.click('#btn-first');
  await clickPlay(page);
  await page.waitForTimeout(300);
  let s = await stats(page);
  check(s.played === 1 && s.active, '|< then Play plays it again'.replace(/^/, 'I. '));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('#btn-last');
  await page.waitForTimeout(300);
  await clickPlay(page);
  await page.waitForTimeout(300);
  s = await stats(page);
  check(s.played === 2 && s.active && (await moveNow(page)) === 0, 'I. Play at the end replays from move 0, with the intro');
  await ctx.close();
}

// ---- J: reduced motion ----------------------------------------------------
{
  const file = 'cortex-vs-null-seed5.html';
  log(`\n[J] ${file}: reduced motion`);
  const { ctx, page } = await open(file, { reduced: true });
  await clickPlay(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(outDir, `${TAG}-boot-reduced-still.jpg`), quality: 80 });
  await page.waitForFunction(() => window.__rec.moves['1'] != null, null, { timeout: 5000 });
  const r = await rec(page), s = await stats(page);
  check(r.still === true && s.stillCount === 1, 'J. reduced motion plays the still');
  check(s.last.reason === 'end' && Math.abs(s.last.t - BOOT_STILL_MS) <= 150, `J. about ${BOOT_STILL_MS} ms (${s.last.t} ms), then move 1`);
  check(r.saying === bootSaying(matchData(file).seed), `J. the still shows the seed's saying ("${r.saying}")`);
  await ctx.close();
}

// ---- K: the Cosmetics switch doesn't touch it ---------------------------------
{
  const file = 'cortex-vs-swarm-seed11.html';
  log(`\n[K] ${file}: Cosmetics off`);
  const { ctx, page } = await open(file);
  await page.click('#btn-cosmetics');
  check((await page.locator('#btn-cosmetics').textContent()) === 'Cosmetics: off', 'K. cosmetics switched off');
  await clickPlay(page);
  await page.waitForTimeout(300);
  check((await stats(page)).active, 'K. the intro still plays (it is standard, not a cosmetic)');
  await ctx.close();
}

// ---- L: a phone ----------------------------------------------------------
{
  const file = 'null-vs-swarm-seed2.html', md = matchData(file);
  log(`\n[L] ${file}: a phone (seed ${md.seed}: "${bootSaying(md.seed)}")`);
  const { ctx, page } = await open(file, { phone: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await clickPlay(page);
  await waitT(page, 1000);
  await page.screenshot({ path: resolve(outDir, `${TAG}-boot-phone-b-lines.jpg`), quality: 80 });
  await waitT(page, 1760);
  await page.screenshot({ path: resolve(outDir, `${TAG}-boot-phone-d-saying.jpg`), quality: 80 });
  const g = await page.evaluate(() => { const c = document.querySelector('.boot-canvas').getBoundingClientRect(), a = document.getElementById('board-area').getBoundingClientRect(); return { c: [c.top, c.bottom, c.left, c.right], a: [a.top, a.bottom], vh: innerHeight, vw: innerWidth }; });
  check(g.c[0] >= -1 && g.c[1] <= g.vh + 1, `L. the board is scrolled into view (${Math.round(g.c[0])}-${Math.round(g.c[1])} of ${g.vh})`);
  check(g.c[2] >= 0 && g.c[3] <= g.vw, 'L. the intro stays inside the screen\'s width');
  await ctx.close();
}

// ---- M: the end-of-match fixes ---------------------------------------------
for (const file of ['recorded-close-win.html', 'aegis-vs-cortex-seed1.html']) {
  const md = matchData(file), last = md.frames[md.frames.length - 1], w = last.winner, l = w === 'p1' ? 'p2' : 'p1';
  log(`\n[M] ${file}: the end of the match (winner ${md.identities[w].username}, seat ${w === 'p1' ? 1 : 2})`);
  const { ctx, page } = await open(file);
  await page.evaluate(() => { const s = document.getElementById('scrubber'); s.value = String(Number(s.max) - 1); s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(300);
  const loserRect = (l) => { const r = document.getElementById('side-' + l).getBoundingClientRect(), sx = scrollX, sy = scrollY; return { l: r.left + sx - 40, r: r.right + sx + 40, t: r.top + sy - (l === 'p2' ? 160 : 0), b: r.bottom + sy + (l === 'p1' ? 160 : 0) }; };
  await page.evaluate(([l, fnSrc]) => {
    const loserRect = eval(fnSrc);
    const m = window.__m = { left: [] };
    document.getElementById('btn-next').click();
    m.step = performance.now();
    const look = () => {
      const t = performance.now(), b = window.__boast.stats();
      const n = window.__cfx.countIn(loserRect(l));
      if (t - m.step < 1200) m.left.push(n);
      if (b.active && m.boast == null) { m.boast = t; m.atBoast = n; }
      if (m.boast != null && t - m.boast <= 1500) { m.during = m.during || []; m.during.push([Math.round(t - m.boast), n]); }
      if (m.boast == null || t - m.boast < 1600) requestAnimationFrame(look);
    };
    look();
  }, [l, loserRect.toString()]);
  await page.waitForFunction(() => window.__m.boast != null && performance.now() - window.__m.boast > 1600, null, { timeout: 15000 });
  const m = await page.evaluate(() => window.__m);
  const before = Math.max(...m.left);
  const after = m.during.filter(([t]) => t >= 400).map(([, n]) => n);
  check(before > 0, `M. the lethal beat leaves particles on the loser's side (${before} at most)`);
  check(after.length > 0 && after.every((n) => n === 0), `M. none left there from 0.4 s into the boast (${m.atBoast} at its start, then ${JSON.stringify(m.during.slice(0, 6))}...)`);
  const why = await page.locator('#momentum-why').textContent();
  const name = md.identities[w].username;
  check(why.startsWith(name + ' AHEAD') && why.includes(md.identities[l].username + ' out of health'), `M. the gauge reads the winner ahead: "${why}"`);
  const fill = await page.evaluate(() => { const f = document.getElementById('momentum-fill'); return { left: parseFloat(f.style.left), width: parseFloat(f.style.width) }; });
  check(w === 'p1' ? fill.left === 50 && fill.width === 50 : fill.left === 0 && fill.width === 50, `M. the gauge is full toward the winner (left ${fill.left}%, width ${fill.width}%)`);
  await page.screenshot({ path: resolve(outDir, `${TAG}-end-${file.replace('.html', '')}-boast.jpg`), quality: 80 });
  await ctx.close();
}

// ---- N: the sheet ------------------------------------------------------------
{
  log('\n[N] match-boot-sheet.html: every scene');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { log('  PAGE ERROR ' + e.message); fails++; });
  await page.goto('file://' + resolve(OUT, 'match-boot-sheet.html'));
  await page.waitForTimeout(500);
  const keys = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.scene'), (s) => s.id));
  for (const k of keys) {
    await page.evaluate((k) => document.getElementById(k).scrollIntoView({ block: 'center' }), k);
    const ok = await page.evaluate((k) => !!window.playBootScene(k), k);
    const s = await stats(page);
    const reduced = k === 'reduced';
    await waitT(page, reduced ? 300 : 1760);
    const shot = await page.locator('#' + k).screenshot({ path: resolve(outDir, `${TAG}-sheet-${k}.jpg`), quality: 80 });
    check(ok && !s.problem && s.still === reduced, `N. ${k}: "${s.saying}" laid out${reduced ? ' (the still)' : ''}, no grammar problem`);
    await page.waitForFunction(() => !window.__boot.stats().active, null, { timeout: 6000 });
  }
  await ctx.close();
}

await b.close();
log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
