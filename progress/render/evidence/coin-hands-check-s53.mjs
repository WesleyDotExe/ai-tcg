// Render session 53: the coin flip inside Match Boot (the first coin slice)
// and live hands face up, in a headless browser. Two halves.
//
// The arena on its own (the CI replay, Cortex vs Swarm seed 6, built fresh
// from this commit by src/ciPages.ts; a standalone page is a spectator's
// view, so the line names the first player):
//   A  Play from move 0: Match Boot plays with the coin: the Chrome Token,
//      p1 near, so it lands portrait up, the first player's half (the
//      bottom) gets the pulse, the line reads "<P1> GOES FIRST"; the coin is
//      drawn (lit pixels at the coin's place mid-spin) and both faces show
//      during the spin; the flick, whir and clink are queued on the audio
//      clock; the intro ends by itself at about 3.4 s and move 1 follows.
//   B  "Watch as" p2, then Play from move 0: p2's coin and portrait, landing
//      design up, the pulse in the top half (p1's), the line still "<P1>
//      GOES FIRST".
//   C  the viewer's own match (the website's hash, switch=0): near p1 reads
//      YOU GO FIRST; near p2 reads THEY GO FIRST.
//   D  reduced motion: the still, about 1.3 s: the coin already landed with
//      its line from the first frame, then the saying.
//   E  Skip during the spin ends the intro at once (no coin left drawn).
//   F  a phone (390 px): the coin and its line fit the board, no sideways
//      scroll.
//
// The website with the real ladder (render/src/site/siteDemo.ts --ladder
// --speed 4):
//   G  "Watch on the arena" from Watch live: both hands shown face up where
//      the feed named the card, backs only for opening cards not yet played,
//      never more backs than the opening hand, and backs never come back
//      (card for card against the recorded replay: render/test/
//      siteLiveArena.test.ts, over the same real API).
//   H  no page errors, no external requests.
//
//   node progress/render/evidence/coin-hands-check-s53.mjs [stills dir]
// (PW_CORE as in render/ci/browser-check.mjs, if playwright isn't found.)

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RENDER = resolve(ROOT, 'render');
const OUT = resolve(process.argv[2] ?? resolve(ROOT, 'progress/render/evidence'));
mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

let passes = 0, fails = 0;
const check = (ok, line) => { if (ok) passes++; else fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); };
const note = (line) => console.log(`      ${line}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000, step = 100) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
const errors = [];
const external = [];

const chromium = await loadPlaywright();
const arenaBrowser = await chromium.launch({ args: ['--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const shot = async (page, name) => {
  for (let k = 0; k < 3; k++) {
    try { await page.screenshot({ path: resolve(OUT, `v2-s53-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000 }); return; } catch { await wait(2000); }
  }
  note(`(the still "${name}" timed out three times)`);
};

// ============================================================================
// The arena on its own
// ============================================================================
const PAGES = mkdtempSync(join(tmpdir(), 'coin-s53-'));
execFileSync('npx', ['tsx', 'src/ciPages.ts', PAGES], { cwd: RENDER, stdio: 'ignore' });
const REPLAY = 'cortex-vs-swarm-seed6.html';
const server = createServer((req, res) => {
  try { const body = readFileSync(join(PAGES, decodeURIComponent(new URL(req.url, 'http://x').pathname))); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const HOST = `http://127.0.0.1:${server.address().port}/`;

async function openArena(hash = '', o = {}) {
  const ctx = await arenaBrowser.newContext({ viewport: o.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 1, hasTouch: !!o.phone, isMobile: !!o.phone, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`arena${hash}: ${e.message}`));
  page.on('request', (r) => { if (!r.url().startsWith(HOST) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
  await page.goto(HOST + REPLAY + hash);
  await page.waitForFunction(() => window.__cfx && window.__cfx.isReady(), null, { timeout: 20000 });
  return { ctx, page };
}
const stats = (page) => page.evaluate(() => window.__boot.stats());
const names = (page) => page.evaluate(() => JSON.parse(document.getElementById('match-data').textContent).agentNames);
/** Lit pixels on the intro's canvas inside a box around the coin (document px). */
const litAtCoin = (page) => page.evaluate(() => {
  const cv = document.querySelector('canvas.boot-canvas');
  if (!cv) return { lit: 0, total: 0 };
  const r = cv.getBoundingClientRect(), sx = window.scrollX, sy = window.scrollY;
  const s = window.__boot.stats();
  const p = window.__boot.plan ? window.__boot.plan() : null;
  const co = p ? p.coin : null;
  if (!co) return { lit: 0, total: 0, noPlan: true };
  const k = cv.width / r.width, x0 = Math.round((co.x - co.r - (r.left + sx)) * k), y0 = Math.round((co.y - co.r - (r.top + sy)) * k), w = Math.round(co.r * 2 * k);
  const d = cv.getContext('2d').getImageData(Math.max(0, x0), Math.max(0, y0), Math.max(1, w), Math.max(1, w)).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 300 && d[i + 3] > 100) lit++;
  return { lit, total: d.length / 4, t: s.t };
});

console.log('\n[A] Play from move 0: the coin flip, p1 near (a spectator on a standalone page)');
{
  const { ctx, page } = await openArena();
  const n = await names(page);
  const hasPlan = await page.evaluate(() => typeof window.__boot.plan === 'function');
  await page.click('#btn-play');
  check(await until(() => page.evaluate(() => window.__boot.active()), 5000, 30), 'A. Match Boot plays');
  const s0 = await stats(page);
  check(s0.coin && s0.coin.id === 'coin-chrome-token' && !s0.coin.fallback, `A. the coin is the Chrome Token (${JSON.stringify(s0.coin && { id: s0.coin.id, fallback: s0.coin.fallback })})`);
  check(s0.coin && s0.coin.line === `${n.p1.toUpperCase()} GOES FIRST`, `A. the line reads "${s0.coin && s0.coin.line}"`);
  check(s0.coin && s0.coin.portraitUp && s0.coin.first === 'bot', `A. p1 near goes first: lands portrait up, the pulse in the bottom half (${s0.coin && s0.coin.first})`);
  // Sample through the spin: both faces show, the coin is drawn.
  const faces = new Set();
  let litMid = null;
  for (let k = 0; k < 200; k++) {
    const s = await stats(page);
    if (!s.active) break;
    if (s.t >= 1500 && s.t < 2100) {
      faces.add(s.coin.face);
      // The coin turns edge on and back: the most it covers over the spin.
      if (hasPlan) { const l = await litAtCoin(page); if (!litMid || l.lit > litMid.lit) litMid = l; }
    }
    if (s.t >= 1780 && !faces.has('shot')) { faces.add('shot'); await shot(page, 'coin-spin'); }
    if (s.t >= 2250 && !faces.has('shot2')) { faces.add('shot2'); await shot(page, 'coin-landed'); }
    if (s.t >= 2650 && !faces.has('shot3')) { faces.add('shot3'); await shot(page, 'coin-saying'); break; }
    await wait(15);
  }
  check(faces.has('design') && faces.has('portrait'), `A. both faces show during the spin (${[...faces].filter((f) => !f.startsWith('shot')).join(', ')})`);
  if (litMid) check(litMid.lit > litMid.total * 0.15, `A. the coin is drawn: up to ${litMid.lit} of ${litMid.total} pixels lit at its place during the spin (t ${litMid.t} ms)`);
  else note('(no plan hook: the coin pixels were not sampled)');
  check(await until(() => page.evaluate(() => !window.__boot.active()), 8000, 50), 'A. the intro ends by itself');
  const end = await stats(page);
  check(end.last && end.last.reason === 'end' && end.last.t >= 3300 && end.last.t <= 3700, `A. at about 3.4 s (${end.last && end.last.t} ms)`);
  const fired = end.fired || {};
  note(`sounds queued: ${Object.keys(fired).filter((k) => k.startsWith('sound:')).map((k) => `${k.slice(6)} x${fired[k]}`).join(', ')}`);
  check(fired['sound:coinFlick'] === 1 && fired['sound:coinWhir'] === 1 && fired['sound:coinClink'] === 1, 'A. the flick, the whir and the clink each queued once, on the audio clock');
  const late = (end.sched || []).length ? end.late : 0;
  check(late === 0, `A. no intro sound late (${late})`);
  check(await until(() => page.evaluate(() => /move [1-9]/.test(document.getElementById('framecount').textContent)), 4000, 50), 'A. then move 1');
  await ctx.close();
}

console.log('\n[B] "Watch as" p2, then Play from move 0');
{
  const { ctx, page } = await openArena();
  const n = await names(page);
  await page.click('#pov-p2');
  await wait(200);
  await page.click('#btn-play');
  await until(() => page.evaluate(() => window.__boot.active()), 5000, 30);
  const s = await stats(page);
  check(s.coin && !s.coin.portraitUp && s.coin.first === 'top', `B. p2's coin lands design up, the pulse in the top half, p1's (${JSON.stringify(s.coin && { portraitUp: s.coin.portraitUp, first: s.coin.first })})`);
  check(s.coin && s.coin.line === `${n.p1.toUpperCase()} GOES FIRST`, `B. the line still names the first player: "${s.coin && s.coin.line}"`);
  await until(async () => (await stats(page)).t >= 2160, 5000, 15);
  await shot(page, 'coin-as-p2-pulse');
  await until(() => page.evaluate(() => !window.__boot.active()), 8000, 50);
  await ctx.close();
}

console.log("\n[C] the viewer's own match (switch=0)");
for (const [seat, want] of [['p1', 'YOU GO FIRST'], ['p2', 'THEY GO FIRST']]) {
  const { ctx, page } = await openArena(`#view=${seat}&switch=0`);
  await page.click('#btn-play');
  await until(() => page.evaluate(() => window.__boot.active()), 5000, 30);
  const s = await stats(page);
  check(s.coin && s.coin.line === want && s.coin.portraitUp === (seat === 'p1'), `C. own agent as ${seat}: "${s.coin && s.coin.line}", portrait ${s.coin && s.coin.portraitUp ? 'up' : 'down'}`);
  if (seat === 'p1') { await until(async () => (await stats(page)).t >= 2300, 5000, 15); await shot(page, 'coin-you-go-first'); }
  await ctx.close();
}

console.log('\n[D] reduced motion: the still');
{
  const { ctx, page } = await openArena('', { reduced: true });
  await page.click('#btn-play');
  await until(() => page.evaluate(() => window.__boot.active()), 5000, 30);
  const s = await stats(page);
  check(s.still === true, 'D. the intro plays as the still');
  check(s.coin && s.coin.face === 'portrait', `D. the coin already landed from the first frame (face ${s.coin && s.coin.face})`);
  await shot(page, 'coin-still');
  await until(() => page.evaluate(() => !window.__boot.active()), 5000, 30);
  const e = await stats(page);
  check(e.last && e.last.still && e.last.t >= 1250 && e.last.t <= 1600, `D. about 1.3 s (${e.last && e.last.t} ms)`);
  await ctx.close();
}

console.log('\n[E] Skip during the spin');
{
  const { ctx, page } = await openArena();
  await page.click('#btn-play');
  await until(async () => (await stats(page)).t >= 1700, 6000, 15);
  await page.click('.boot-skip');
  await wait(100);
  const s = await stats(page);
  check(!s.active && s.last.reason === 'skip' && s.last.t < 2100, `E. it ends at once, before the landing (${s.last.reason} at ${s.last.t} ms)`);
  check(!(await page.$('canvas.boot-canvas')), 'E. no coin left drawn');
  await ctx.close();
}

console.log('\n[F] a phone');
{
  const { ctx, page } = await openArena('', { phone: true });
  await page.click('#btn-play');
  await until(() => page.evaluate(() => window.__boot.active()), 5000, 30);
  const s = await stats(page);
  check(s.problem === null && !s.still, `F. the plan passes the grammar on the phone (problem ${s.problem})`);
  await until(async () => (await stats(page)).t >= 2300, 6000, 15);
  await shot(page, 'coin-phone');
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'F. no sideways scroll');
  await ctx.close();
}
server.close();

// ============================================================================
// The website with the real ladder: live hands
// ============================================================================
const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', '4'], { cwd: RENDER, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const url = await new Promise((ok, fail) => {
  let buf = '';
  demo.stdout.on('data', (d) => { buf += d; const m = /\[site-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
  demo.stderr.on('data', (d) => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
  demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
  setTimeout(() => fail(new Error('the demo took over 120 s to start')), 120000);
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`site: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`site console: ${m.text()}`); });
page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
await page.goto(url);
await page.waitForSelector('#signin:not([hidden])');
await page.fill('#si-login', 'nova');
await page.fill('#si-pass', 'a long demo password');
await page.click('#si-go');
await page.waitForSelector('#wgrid, .wempty h3');
const apiGet = (path) => page.evaluate(async (path) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { headers: { Authorization: `Bearer ${t}` } });
  return { status: r.status, body: await r.json() };
}, path);
const arenaFrame = () => page.frames().find((x) => /\/(live|replay)\/[A-Za-z0-9_-]{24}(#.*)?$/.test(x.url()));

console.log('\n[G] live hands, face up');
await page.goto(url + '#/live');
check(await until(async () => (await apiGet('/api/live')).body.matches.length >= 1, 120000, 500), 'G. a match is live');
// One a few turns in, so draws have happened.
await until(async () => (await apiGet('/api/live')).body.matches.some((m) => (m.released ?? 0) >= 20), 120000, 500);
const lm = (await apiGet('/api/live')).body.matches.slice().sort((a, b) => (b.released ?? 0) - (a.released ?? 0))[0];
await until(async () => (await page.$(`#live-list .live-card[data-match="${lm.matchId}"] [data-act="watch-arena"]`)) !== null, 15000);
await page.click(`#live-list .live-card[data-match="${lm.matchId}"] [data-act="watch-arena"]`);
await until(() => !!arenaFrame(), 20000);
const f = arenaFrame();
await f.waitForFunction(() => typeof window.__pov === 'function', null, { timeout: 30000 });
await wait(4000);
const handNow = () => f.evaluate(() => ['p1', 'p2'].map((pid) => {
  const el = document.getElementById('hand-' + pid);
  return { pid, up: [...el.querySelectorAll('.minicard[data-name]')].map((c) => c.getAttribute('data-name')), backs: el.querySelectorAll('.minicard.back').length, label: (el.querySelector('.hand-count') || {}).textContent || '' };
}));
const h1 = await handNow();
note(`hands now: ${h1.map((h) => `${h.pid} ${h.up.length} up + ${h.backs} backs ("${h.label}")`).join('; ')}`);
check(h1.some((h) => h.up.length > 0), 'G. named cards show face up in the live arena');
await shot(page, 'live-hands');
// Backs are only ever opening-hand cards: never more than the opening hand held.
const opening = await f.evaluate(() => { const d = JSON.parse(document.getElementById('match-data').textContent); return { p1: d.frames[0].players.p1.hand.length, p2: d.frames[0].players.p2.hand.length }; });
check(h1.every((h) => h.backs <= opening[h.pid]), `G. backs only for opening cards (${h1.map((h) => `${h.pid} ${h.backs} <= ${opening[h.pid]}`).join(', ')})`);
check(h1.every((h) => h.backs === 0 || /from the opening hand|face down/.test(h.label)), 'G. the backs are labelled');
await wait(15000);
const h2 = await handNow();
note(`15 s later: ${h2.map((h) => `${h.pid} ${h.up.length} up + ${h.backs} backs`).join('; ')}`);
check(h2.every((h, k) => h.backs <= h1[k].backs), 'G. a back never comes back (opening cards only leave by being played)');
await page.click('#replay .rp-close');

console.log('\n[H] errors and requests');
check(errors.length === 0, `H. no page errors${errors.length ? `: ${errors.slice(0, 4).join(' | ')}` : ''}`);
check(external.length === 0, `H. no external requests${external.length ? `: ${external.slice(0, 3).join(' ')}` : ''}`);

await arenaBrowser.close();
await browser.close();
try { process.kill(-demo.pid); } catch { /* gone */ }
console.log(`\n${passes} PASS, ${fails} FAIL — ${fails ? 'SOME FAIL' : 'ALL PASS'}`);
process.exit(fails ? 1 : 0);
