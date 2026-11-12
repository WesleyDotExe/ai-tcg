// Render session 67: the Watch live widget at L, the live match embedded in
// the tile on the real arena (the owner's 2026-11-06 Season 0 brief,
// section 1: "the live match embedded in the tile, reuse the existing
// arena"), driven in a headless browser against the real owner API over a
// real store with the game lane's ladder playing (render/src/site/siteDemo.ts
// --ladder --speed 8). Nothing is mocked.
//
//   A  Watch live at S, M and L: S the score, M + health bars, L the arena.
//      At L the tile's arena is the server's first live match, in the
//      arena's embed mode (no controls, no feed, sound and music never
//      mounted), scaled to fill its slot, and following the match.
//   B  The frame survives Home's redraws (the 3 s live redraw and the 15 s
//      page poll): the same frame, never reloaded, while the scoreboard
//      beside it follows the server.
//   C  Full screen from the tile: one arena at a time (the tile's is taken
//      down), and back on Close. Customise takes it down too; Done brings it
//      back.
//   D  The match ends: the arena gets its record, the tile holds it as
//      "Match over", then the next live match takes the tile.
//   E  A phone: no frame, the compact board; no sideways scroll; stills;
//      no external requests; no page errors.
//
//   node progress/render/evidence/watch-arena-check-s67.mjs [stills dir]

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = resolve(process.argv[2] ?? resolve(ROOT, 'progress/render/evidence'));
mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', '8'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const url = await new Promise((ok, fail) => {
  let buf = '';
  demo.stdout.on('data', (d) => { buf += d; const m = /\[site-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
  demo.stderr.on('data', (d) => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
  demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
  setTimeout(() => fail(new Error('the demo took over 240 s to start')), 240000);
});

let passes = 0, fails = 0;
const check = (ok, line) => { if (ok) passes++; else fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); };
const note = (line) => console.log(`      ${line}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000, step = 200) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
const chromium = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];
const external = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(url, '/')}`); });
page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });

const api = (method, path, body) => page.evaluate(async ([method, path, body]) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}, [method, path, body]);
const shot = async (name, opts = {}) => {
  try { await page.screenshot({ path: resolve(OUT, `v2-s67-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000, ...opts }); } catch { note(`(the still "${name}" timed out)`); }
};
const widgetText = (type) => page.$eval(`#wgrid .wg[data-type="${type}"] .wgb`, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');


const boardAt = async (size) => {
  const put = await api('PUT', '/api/board', { widgets: [{ id: 'w1', type: 'watch', size }, { id: 'w2', type: 'daily', size: 'S' }] });
  await page.goto(url + '#/home');
  await page.reload();
  await page.waitForSelector(`#wgrid .wg[data-type="watch"][data-size="${size}"]`);
  return put.status;
};
const tile = () => page.evaluate(() => {
  const w = document.querySelector('#wgrid .wg[data-type="watch"]');
  if (!w) return null;
  const slot = w.querySelector('.wl-arena');
  const f = slot?.querySelector('.wl-frame iframe');
  const b = w.querySelector('.wgb');
  const r = (e) => { if (!e) return null; const x = e.getBoundingClientRect(); return { w: Math.round(x.width), h: Math.round(x.height) }; };
  return {
    size: w.dataset.size, slot: !!slot, match: slot?.dataset.match ?? null, ended: slot?.dataset.ended ?? null, on: !!slot?.classList.contains('on'), joining: !!slot?.classList.contains('joining'),
    frame: !!f, src: f?.getAttribute('src') ?? '', mark: f ? (f.__mark ?? null) : null, slotBox: r(slot), frameBox: r(f),
    sb: w.querySelector('.wl-info .sb')?.textContent.replace(/\s+/g, ' ').trim() ?? null, info: w.querySelector('.wl-info')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    hp: w.querySelectorAll('.sb-hp .bar').length, cboard: !!w.querySelector('.cboard'), fallbackShown: (() => { const fb = w.querySelector('.wl-fallback'); return !!fb && getComputedStyle(fb).display !== 'none'; })(),
    watchAs: w.querySelectorAll('.wl-info [data-act="watch-as"]').length, over: b.scrollHeight - b.clientHeight, text: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 160),
  };
});
const arenaFrame = () => page.frames().find((f) => /\/live\//.test(f.url()) && /embed=1/.test(f.url())) ?? null;
const inFrame = async (fn) => { const f = arenaFrame(); if (!f) return null; try { return await f.evaluate(fn); } catch { return null; } };
const frameState = () => inFrame(() => ({
  embed: document.body.classList.contains('embed'), controls: getComputedStyle(document.querySelector('.controls')).display, feed: getComputedStyle(document.getElementById('eventlog')).display,
  soundMounted: document.getElementById('btn-sound').hasAttribute('data-state'), musicMounted: document.getElementById('btn-music').hasAttribute('data-state'),
  pov: window.__pov ? window.__pov() : null, count: document.getElementById('framecount').textContent, mark: window.__mark ?? null, cards: document.querySelectorAll('#board-area .card, #board-area [data-iid]').length,
}));

try {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');
  // A live match first: the ladder pairs within a round.
  const liveOk = await until(async () => (await api('GET', '/api/live')).body.matches?.length > 0, 120000, 1000);
  check(liveOk, 'a match is live on the ladder (GET /api/live)');

  console.log('\n[A] Watch live at S, M and L');
  for (const size of ['S', 'M']) {
    check((await boardAt(size)) === 200, `${size}. the board saved with Watch live at ${size}`);
    await until(async () => !!(await tile())?.sb || (await tile())?.text.includes('vs') || (await page.$('#wgrid .wg[data-type="watch"] .sb')) !== null, 15000);
    const t = await tile();
    check(t && !t.slot && !t.frame, `${size}. no arena at ${size} (slot ${t?.slot}, frame ${t?.frame})`);
    check(t && (size === 'S' ? t.hp === 2 : t.hp >= 2), `${size}. the score with both health bars (${t?.hp} bars)`);
    check(t && t.over <= 1, `${size}. nothing overflows (${t?.over} px)`);
    await shot(`watch-${size}`);
  }
  check((await boardAt('L')) === 200, 'L. the board saved with Watch live at L');
  const live0 = (await api('GET', '/api/live')).body;
  await until(async () => (await tile())?.frame, 20000);
  let t = await tile();
  check(t?.slot && t.match === live0.matches[0]?.matchId, `L. the tile's arena is the server's first live match (${t?.match} = ${live0.matches[0]?.matchId}, of ${live0.matches.length} live)`);
  check(t?.frame && /^\/live\/[\w-]+#view=p[12]&switch=[01]&embed=1$/.test(t.src), `L. its frame is the host's live arena page in embed mode (${t?.src.replace(/\/live\/[\w-]+/, '/live/<key>')})`);
  const t0 = Date.now();
  const loaded = await until(async () => (await tile())?.on, 120000, 500);
  check(loaded, `L. the arena loaded in the tile (${((Date.now() - t0) / 1000).toFixed(1)} s, software WebGL)`);
  t = await tile();
  check(t && t.frameBox && t.slotBox && Math.abs(t.frameBox.w - t.slotBox.w) <= 2 && Math.abs(t.frameBox.h - t.slotBox.h) <= 2, `L. the arena is scaled to fill its slot exactly (frame ${JSON.stringify(t?.frameBox)}, slot ${JSON.stringify(t?.slotBox)})`);
  check(t && !t.fallbackShown, 'L. the compact board stand-in is hidden once the arena is up');
  let fs = await frameState();
  check(fs?.embed && fs.controls === 'none' && fs.feed === 'none', `L. the arena is in embed mode: no controls (${fs?.controls}), no feed (${fs?.feed})`);
  check(fs && !fs.soundMounted && !fs.musicMounted && fs.pov?.embed === true, `L. sound and music are never mounted in the tile (sound ${fs?.soundMounted}, music ${fs?.musicMounted})`);
  const mine = live0.matches[0] && (await api('GET', '/api/me')).body.ownerId;
  const m0 = live0.matches[0];
  const mySeat = m0 && (m0.p1.ownerId === mine ? 'p1' : m0.p2.ownerId === mine ? 'p2' : null);
  check(fs?.pov && (mySeat ? fs.pov.near === mySeat && fs.pov.canSwitch === false : true), `L. the near side is the viewer's own agent's (${mySeat ?? 'not theirs'}; the arena has ${fs?.pov?.near})`);
  check(t && t.over <= 1, `L. nothing overflows the tile (${t?.over} px)`);
  await wait(1500);
  await shot('watch-L');

  console.log('\n[B] the frame survives the redraws');
  await page.evaluate(() => { const f = document.querySelector('#wgrid .wl-frame iframe'); f.__mark = 'kept'; f.contentWindow.__mark = 'kept'; });
  const before = { t: await tile(), fs: await frameState(), at: Date.now() };
  // Two page polls (15 s) and several live redraws (3 s).
  await wait(33000);
  const after = { t: await tile(), fs: await frameState() };
  check(after.t?.mark === 'kept' && after.fs?.mark === 'kept', `B. after 33 s of redraws, the same frame and the same arena page (element ${after.t?.mark}, page ${after.fs?.mark}: not reloaded)`);
  const n = (s) => Number(/\/ (\d+)/.exec(s ?? '')?.[1] ?? -1);
  check(n(after.fs?.count) > n(before.fs?.count) || after.t?.ended === 'true', `B. the arena follows the match (${before.fs?.count} -> ${after.fs?.count})`);
  check(after.t?.sb !== before.t?.sb || after.t?.ended === 'true', 'B. the scoreboard beside it was redrawn from the server meanwhile');
  note(`scoreboard then: ${before.t?.sb}`);
  note(`scoreboard now:  ${after.t?.sb}`);

  console.log('\n[C] full screen, Customise');
  t = await tile();
  if (t?.ended !== 'true') {
    await page.click('#wgrid .wl-open');
    const opened = await until(async () => page.evaluate(() => !document.getElementById('replay').hidden && !!document.querySelector('#replay iframe')), 15000);
    t = await tile();
    check(opened && !t.frame, `C. Full screen opens the arena over the page and takes the tile's down (tile frame ${t.frame})`);
    await wait(3000);
    await shot('watch-fullscreen');
    await page.click('#replay .rp-close');
    const back = await until(async () => { const x = await tile(); return x?.frame && x.mark === null; }, 15000);
    check(back, 'C. Close brings the tile\'s arena back (a new frame)');
    await until(async () => (await tile())?.on, 120000, 500);
  } else note('C. full screen skipped: the match had already ended');
  await page.click('[data-act="customise"]');
  await wait(500);
  t = await tile();
  check(t && !t.frame, `C. Customise takes the frame down (frame ${t?.frame}; tiles move while editing)`);
  await page.click('[data-act="done"]');
  check(await until(async () => (await tile())?.frame, 15000), 'C. Done brings it back');

  console.log('\n[D] the match ends');
  const held = (await tile())?.match;
  await until(async () => (await tile())?.on, 120000, 500);
  // Every change of the tile's state, to the end and through the hold.
  const trail = [];
  let lastKey = '';
  const watchTrail = setInterval(async () => {
    const x = await tile().catch(() => null);
    if (!x) return;
    const k = `${x.match} ended=${x.ended} frame=${x.frame} on=${x.on} joining=${x.joining}`;
    if (k !== lastKey) { lastKey = k; trail.push(`${new Date().toISOString().slice(11, 19)} ${k}`); }
  }, 250);
  const endSeen = await until(async () => (await tile())?.ended === 'true', 420000, 1000);
  t = await tile();
  check(endSeen && t.match === held, `D. the tile holds ${held} once it is recorded (data-ended ${t?.ended})`);
  check(t && /Match over/.test(t.info ?? ''), `D. its column says so: "${(t?.info ?? '').slice(0, 90)}"`);
  check(t && t.frame && t.on, `D. the arena stays in the tile while it is held (frame ${t?.frame}, on ${t?.on})`);
  const endState = await inFrame(() => ({ liveDisabled: document.getElementById('btn-live')?.disabled ?? null, count: document.getElementById('framecount').textContent }));
  check(endState?.liveDisabled === true, `D. the arena itself has the end: its LIVE badge is off (${JSON.stringify(endState)})`);
  await wait(4000);
  await shot('watch-L-ended');
  const swapped = await until(async () => { const x = await tile(); return x?.match && x.match !== held; }, 120000, 1000);
  clearInterval(watchTrail);
  for (const line of trail) note(`tile: ${line}`);
  const live1 = (await api('GET', '/api/live')).body;
  t = await tile();
  check(swapped || live1.matches.length === 0, `D. after the hold, the next live match takes the tile (${t?.match}; the server has ${live1.matches.map((m) => m.matchId).join(', ') || 'none'})`);
  if (swapped) check(await until(async () => (await tile())?.on, 120000, 500), 'D. and its arena loads');

  console.log('\n[E] dark, a phone');
  await page.evaluate(() => { document.body.dataset.theme = 'dark'; });
  await wait(800);
  await shot('watch-L-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(1200);
  t = await tile();
  const phone = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  check(t && !t.frame && t.cboard && t.fallbackShown, `E. on a phone no frame is made; the compact board stands in (frame ${t?.frame}, board ${t?.cboard})`);
  check(phone.sw <= phone.w, `E. on a phone: no sideways scroll (${phone.sw} <= ${phone.w})`);
  await shot('watch-phone', { fullPage: true });
  check(external.length === 0, `E. no external requests${external.length ? `: ${external.join(', ')}` : ''}`);
  check(errors.length === 0, `E. no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} catch (err) {
  check(false, `the run stopped: ${err && err.stack || err}`);
} finally {
  console.log(`\n${passes} PASS, ${fails} FAIL`);
  await browser.close();
  try { process.kill(-demo.pid); } catch { /* gone */ }
  process.exit(fails ? 1 : 0);
}
