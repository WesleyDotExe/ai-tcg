// Render session 52: the spectator point of view ("Watch as"), in a headless
// browser. Two halves.
//
// The arena on its own (the CI replay, Cortex vs Swarm seed 6, built fresh
// from this commit by src/ciPages.ts):
//   A  opened plain: p1 at the bottom, the "Watch as" switch in the top bar
//      with both names, p1 pressed; the page as before (p1's HUD and hand
//      left, p2's row on top).
//   B  "Watch as" p2: p2's row at the bottom, its HUD and hand on the left,
//      its name first in the header; every row still holds its own player's
//      cards (the frame's units, by instance id); the momentum gauge mirrors;
//      the move shown is the same; no animation re-plays.
//   C  mid-playback: the switch flips and playback goes on (the move count
//      keeps climbing). During Match Boot it waits (the switch says so), and
//      flips when the intro ends; the intro is not played again.
//   D  the end, watched as the loser's opponent and as the winner: stepped
//      into the lethal move, the boast plays on the winner's side wherever it
//      sits (nothing lit past it once the clear has run), the loser's side
//      dimmed, GAME OVER after.
//   E  kept for the tab: a reload keeps p2; a new tab starts at p1.
//   F  the website's hash: view=p2&switch=0 opens at p2 with no switch;
//      view=p2&switch=1 opens at p2 with the switch.
//   G  a phone (390 px): the switch fits, no sideways scroll, flipped.
//
// The website with the real ladder (render/src/site/siteDemo.ts --ladder
// --speed 4, as session 51's check):
//   H  Watch live: each match Nova doesn't play has the switch, the side
//      pressed is the server's defaultView, near on the scoreboard and the
//      compact board; Nova's own match (when live) has none.
//   I  a tap flips that card's scoreboard and compact board, focus stays on
//      the button; a reload keeps it (this tab only).
//   J  "Watch on the arena" from a switched card opens with that side at the
//      bottom and the switch shown; switching inside the arena is kept: on
//      Close the card shows the arena's choice.
//   K  Agent match's arena: Nova's side at the bottom, no switch. A replay
//      from the history: Nova's seat at the bottom, no switch.
//   L  Home's Watch live widget at M shows the switch for its first match.
//   M  no page errors, no external requests.
//
//   node progress/render/evidence/pov-check-s52.mjs [stills dir]
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
// The arena half runs as the CI browser check does (no GPU: the effects'
// canvases draw in software, fast enough to sample the boast frame by
// frame); the website half as session 51's check (software WebGL, for the liquid).
const arenaBrowser = await chromium.launch({ args: ['--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const shot = async (page, name) => {
  for (let k = 0; k < 3; k++) {
    try { await page.screenshot({ path: resolve(OUT, `v2-s52-pov-${name}.jpg`), type: 'jpeg', quality: 80, timeout: 20000 }); return; } catch { await wait(2000); }
  }
  note(`(the still "${name}" timed out three times)`);
};

// ============================================================================
// The arena on its own
// ============================================================================
const PAGES = mkdtempSync(join(tmpdir(), 'pov-s52-'));
execFileSync('npx', ['tsx', 'src/ciPages.ts', PAGES], { cwd: RENDER, stdio: 'ignore' });
const REPLAY = 'cortex-vs-swarm-seed6.html';
const server = createServer((req, res) => {
  try { const body = readFileSync(join(PAGES, decodeURIComponent(new URL(req.url, 'http://x').pathname))); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const HOST = `http://127.0.0.1:${server.address().port}/`;

async function openArena(hash = '', o = {}) {
  const ctx = o.ctx ?? await arenaBrowser.newContext({ viewport: o.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 1, hasTouch: !!o.phone, isMobile: !!o.phone });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`arena${hash}: ${e.message}`));
  page.on('request', (r) => { if (!r.url().startsWith(HOST) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
  await page.goto(HOST + REPLAY + hash);
  await page.waitForFunction(() => window.__cfx && window.__cfx.isReady(), null, { timeout: 20000 });
  return { ctx, page };
}
/** Where everything sits now, and whether each row holds its own player's cards. */
const layout = (page) => page.evaluate(() => {
  const r = (id) => document.getElementById(id).getBoundingClientRect();
  const d = JSON.parse(document.getElementById('match-data').textContent);
  const m = /move (\d+) \//.exec(document.getElementById('framecount').textContent);
  const at = m ? Number(m[1]) : -1, f = d.frames[at];
  const own = (pid) => {
    const want = f.players[pid].board.map((u) => u.instanceId).concat(f.players[pid].directives.map((x) => x.instanceId)).sort().join(',');
    const got = [...document.querySelectorAll('#board-' + pid + ' .card[data-iid]')].map((e) => e.getAttribute('data-iid')).sort().join(',');
    return want === got;
  };
  const fill = document.getElementById('momentum-fill');
  const pov = document.getElementById('pov');
  return {
    at, score: f.momentum.score,
    pov: window.__pov(), povHidden: pov.hidden, povWaiting: pov.classList.contains('waiting'),
    pressed: [...pov.querySelectorAll('.pov-b')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.id),
    names: [...pov.querySelectorAll('.pov-b')].map((b) => b.textContent),
    p1Below: r('side-p1').top > r('side-p2').top, hudP1Left: r('hud-p1').left < r('hud-p2').left, handP1Left: r('hand-p1').left < r('hand-p2').left,
    headerFirst: document.querySelector('#matchup span').textContent, ids: d.identities ? [d.identities.p1.username, d.identities.p2.username] : [],
    rowsOwn: own('p1') && own('p2'), units: [f.players.p1.board.length, f.players.p2.board.length],
    fill: { left: parseFloat(fill.style.left), width: parseFloat(fill.style.width) },
    sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
    fxLeft: document.querySelector('.fx-layer') ? document.querySelector('.fx-layer').childElementCount : 0,
  };
});
const goToMove = (page, n) => page.evaluate((n) => { const s = document.getElementById('scrubber'); s.value = String(n); s.dispatchEvent(new Event('input')); }, n);
const lastMove = (page) => page.evaluate(() => JSON.parse(document.getElementById('match-data').textContent).frames.length - 1);

console.log('\n[A] the arena opened plain');
let p1Name, p2Name;
{
  const { ctx, page } = await openArena();
  await goToMove(page, 40);
  await wait(300);
  const a = await layout(page);
  [p1Name, p2Name] = a.ids;
  check(a.pov.near === 'p1' && a.pov.canSwitch && !a.povHidden, `A. p1 near, the switch shown (${JSON.stringify(a.pov)})`);
  check(a.names.join('|') === `${p1Name}|${p2Name}` && a.pressed.join() === 'pov-p1', `A. "Watch as" ${a.names.join(' | ')}, ${a.pressed} pressed`);
  check(a.p1Below && a.hudP1Left && a.handP1Left && a.headerFirst.startsWith(p1Name), `A. as before: p1's row at the bottom, its HUD and hand left, its name first ("${a.headerFirst}")`);
  check(a.rowsOwn, `A. each row holds its own player's cards (${a.units.join(' / ')} units)`);
  await shot(page, 'arena-as-p1');

  console.log('\n[B] "Watch as" p2');
  await page.click('#pov-p2');
  await wait(300);
  const b = await layout(page);
  check(b.pov.near === 'p2' && b.pressed.join() === 'pov-p2', `B. p2 near, its button pressed`);
  check(!b.p1Below && !b.hudP1Left && !b.handP1Left && b.headerFirst.startsWith(p2Name), `B. p2's row at the bottom, its HUD and hand on the left, its name first ("${b.headerFirst}")`);
  check(b.rowsOwn && b.at === a.at, `B. the same move (${b.at}), each row still its own player's cards`);
  const mirrored = Math.abs((a.fill.left + a.fill.width / 2) - 50 + ((b.fill.left + b.fill.width / 2) - 50)) < 0.01 && Math.abs(a.fill.width - b.fill.width) < 0.01;
  check(mirrored, `B. the momentum gauge mirrors (score ${a.score}: left ${a.fill.left}% width ${a.fill.width}% -> left ${b.fill.left}% width ${b.fill.width}%)`);
  check(b.fxLeft === 0, `B. nothing re-played on the switch (fx layer: ${b.fxLeft})`);
  await shot(page, 'arena-as-p2');
  await page.click('#pov-p1');
  await wait(200);
  const back = await layout(page);
  check(back.p1Below && back.hudP1Left && back.rowsOwn, 'B. and back to p1: as it was');
  await ctx.close();
}

console.log('\n[C] switching while it plays, and during Match Boot');
{
  const { ctx, page } = await openArena();
  // From move 0: Match Boot plays first. A switch during it waits.
  await page.click('#btn-play');
  check(await until(() => page.evaluate(() => window.__boot.active()), 5000, 50), 'C. Play from move 0: Match Boot plays');
  const bootTop = await page.evaluate(() => window.__boot.stats());
  await page.click('#pov-p2');
  const w = await layout(page);
  check(w.pov.near === 'p1' && w.pov.want === 'p2' && w.povWaiting, `C. a switch during the intro waits (near ${w.pov.near}, waiting for ${w.pov.want})`);
  check(await until(() => page.evaluate(() => !window.__boot.active()), 15000, 100), 'C. the intro ends by itself');
  check(await until(async () => (await layout(page)).pov.near === 'p2', 3000, 60), 'C. then the board flips to p2');
  const played = (await page.evaluate(() => window.__boot.stats())).played ?? null;
  const at1 = (await layout(page)).at;
  await wait(2500);
  const mid = await layout(page);
  check(mid.at > at1, `C. playback goes on after the flip (move ${at1} -> ${mid.at})`);
  await page.click('#pov-p1');
  await wait(2500);
  const mid2 = await layout(page);
  check(mid2.pov.near === 'p1' && mid2.at > mid.at && mid2.rowsOwn, `C. a switch mid-playback flips at once and play goes on (move ${mid.at} -> ${mid2.at})`);
  check(!(await page.evaluate(() => window.__boot.active())), `C. the intro isn't played again (${bootTop.saying ? `saying ${bootTop.saying}` : 'stats'}${played != null ? `, played ${played}` : ''})`);
  await ctx.close();
}

// The end: the boast on the winner's side, wherever it sits.
const CLEAR_MS = 280;
const endOf = (page) => page.evaluate(() => {
  const d = JSON.parse(document.getElementById('match-data').textContent), f = d.frames[d.frames.length - 1];
  const w = f.winner, l = w === 'p1' ? 'p2' : 'p1';
  return { w, l, name: d.agentNames[w], last: d.frames.length - 1 };
});
const stepIntoEnd = (page, e) => page.evaluate(([e, CLEAR_MS]) => new Promise((done) => {
  const cv = document.querySelector('canvas.fx-top'), g = cv.getContext('2d', { willReadFrequently: true });
  const tb = document.getElementById('turnbar');
  const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
  const r = { boast: null, end: null, result: null, who: null, samples: 0, outside: 0, dim: null, skipIn: null, lit: null, winnerBelow: null };
  let n = 0, fxT = 0, lastT = 0;
  (function f() {
    const s = window.__boast.stats(), over = /GAME OVER/.test(tb.textContent), now = performance.now();
    if (s.active && r.boast != null) fxT += Math.min(50, now - lastT);
    lastT = now;
    if (s.active) {
      if (r.boast == null) { r.boast = at(); r.who = s.who; r.winnerBelow = document.getElementById('side-' + e.w).getBoundingClientRect().top > document.getElementById('side-' + e.l).getBoundingClientRect().top; }
      const op = ['side-', 'hud-', 'hand-'].map((p) => Number(getComputedStyle(document.getElementById(p + e.l)).opacity));
      r.dim = r.dim ? r.dim.map((x, i) => Math.min(x, op[i])) : op;
      if (s.t >= 400 && r.lit == null) {
        r.lit = document.getElementById('hud-' + e.w).classList.contains('boast-panel');
        const k = document.querySelector('.boast-skip'), b = document.getElementById('side-' + e.w).getBoundingClientRect();
        const q = k && k.getBoundingClientRect();
        r.skipIn = !!q && q.left >= b.left - 2 && q.right <= b.right + 2 && q.top >= b.top - 2 && q.bottom <= b.bottom + 2;
      }
      if (n++ % 3 === 0 && fxT >= CLEAR_MS + 60) {
        const band = document.getElementById('side-' + e.w).getBoundingClientRect(), dpr = cv.width / window.innerWidth;
        const d = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
        let c = 0;
        for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
          if (d[(y * W + x) * 4 + 3] <= 6) continue;
          const px = x / dpr, py = y / dpr;
          if (Math.max(band.left - px, px - band.right, band.top - py, py - band.bottom) > 3) c++;
        }
        r.samples++; r.outside += c;
      }
    } else if (r.boast != null && r.end == null) r.end = at();
    if (over && r.result == null) r.result = at();
    if ((r.end != null && r.result != null) || at() > 20000) done(r); else requestAnimationFrame(f);
  })();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
}), [e, CLEAR_MS]);

console.log('\n[D] the end, watched from each side');
for (const as of ['p1', 'p2']) {
  const { ctx, page } = await openArena(`#view=${as}&switch=1`);
  const e = await endOf(page);
  await goToMove(page, e.last - 1);
  await wait(400);
  const r = await stepIntoEnd(page, e);
  const where = r.winnerBelow ? 'at the bottom' : 'on top';
  check(r.boast != null && r.who === e.name, `D. as ${as}: the winner's boast plays (${r.who}, its side ${where})`);
  check(r.samples > 0 && r.outside === 0, `D. as ${as}: nothing lit past the winner's side once the clear has run (${r.samples} samples, ${r.outside} lit outside)`);
  check(!!r.dim && r.dim.every((x) => x < 0.95) && r.lit && r.skipIn, `D. as ${as}: the loser's side, panel and hand dimmed (${(r.dim || []).join(', ')}), the winner's panel lit, Skip on the winner's side`);
  check(r.result != null && r.end != null && r.result >= r.end - 50, `D. as ${as}: GAME OVER lands as the boast ends (${r.result - r.end} ms after)`);
  await shot(page, `end-as-${as}`);
  await ctx.close();
}

console.log('\n[E] kept for the tab');
{
  const ctx = await arenaBrowser.newContext({ viewport: { width: 1280, height: 900 } });
  const { page } = await openArena('', { ctx });
  await page.click('#pov-p2');
  await page.reload();
  await page.waitForFunction(() => window.__cfx && window.__cfx.isReady(), null, { timeout: 20000 });
  const a = await layout(page);
  check(a.pov.near === 'p2' && !a.p1Below, `E. a reload keeps p2 (near ${a.pov.near})`);
  await ctx.close();
  const { ctx: ctx2, page: page2 } = await openArena();
  check((await layout(page2)).pov.near === 'p1', 'E. a new tab starts at p1');
  await ctx2.close();
}

console.log("\n[F] the website's hash");
{
  const { ctx, page } = await openArena('#view=p2&switch=0');
  const a = await layout(page);
  check(a.pov.near === 'p2' && a.povHidden && !a.p1Below, `F. view=p2&switch=0: p2 at the bottom, no switch`);
  await ctx.close();
  const { ctx: c2, page: p2 } = await openArena('#view=p2&switch=1');
  const b = await layout(p2);
  check(b.pov.near === 'p2' && !b.povHidden && b.pressed.join() === 'pov-p2', `F. view=p2&switch=1: p2 at the bottom, the switch shown`);
  await c2.close();
}

console.log('\n[G] a phone');
{
  const { ctx, page } = await openArena('', { phone: true });
  await goToMove(page, 40);
  await page.tap('#pov-p2');
  await wait(300);
  const a = await layout(page);
  const box = await page.evaluate(() => { const r = document.getElementById('pov').getBoundingClientRect(); const b = document.getElementById('pov-p1').getBoundingClientRect(); return { right: r.right, w: window.innerWidth, h: b.height }; });
  check(a.pov.near === 'p2' && !a.p1Below && a.rowsOwn, 'G. a tap flips it on a phone');
  check(!a.sideways && box.right <= box.w + 1 && box.h >= 28, `G. the switch fits (right edge ${Math.round(box.right)} of ${box.w} px, buttons ${Math.round(box.h)} px tall), no sideways scroll`);
  await shot(page, 'phone-as-p2');
  await ctx.close();
}
server.close();
await arenaBrowser.close();

// ============================================================================
// The website with the real ladder
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
const me = (await apiGet('/api/me')).body;
const myId = me.ownerId ?? me.owner?.ownerId;
const arenaFrame = () => page.frames().find((x) => /\/(live|replay)\/[A-Za-z0-9_-]{24}(#.*)?$/.test(x.url()));
/** One Watch live card: its switch, the scoreboard's near seat, the compact board's first row. */
const card = (id) => page.evaluate((id) => {
  const c = document.querySelector(`#live-list .live-card[data-match="${CSS.escape(id)}"]`);
  if (!c) return null;
  const pressed = c.querySelector('.wa-b[aria-pressed="true"]');
  return { hasSwitch: !!c.querySelector('.watch-as'), pressed: pressed ? pressed.dataset.seat : null, near: c.querySelector('.sb').dataset.near, cbFirst: c.querySelector('.cb-row') ? c.querySelector('.cb-row').dataset.seat : null, nearName: c.querySelector('.sb-side.near .sb-name b').textContent };
}, id);

console.log('\n[H] Watch live: the switch on each card');
await page.goto(url + '#/live');
check(await until(async () => (await apiGet('/api/live')).body.matches.length >= 2, 120000, 500), 'H. two or more matches are live');
await until(async () => (await page.$$('#live-list .live-card')).length >= 2, 15000);
const live = (await apiGet('/api/live')).body;
const others = live.matches.filter((m) => m.p1.ownerId !== myId && m.p2.ownerId !== myId);
const mine = live.matches.find((m) => m.p1.ownerId === myId || m.p2.ownerId === myId) ?? null;
let allDefault = others.length > 0;
for (const m of others) {
  const c = await card(m.matchId);
  if (!c || !c.hasSwitch || c.pressed !== m.defaultView || c.near !== m.defaultView || c.cbFirst !== m.defaultView) { allDefault = false; note(`${m.matchId}: ${JSON.stringify(c)} defaultView ${m.defaultView}`); }
}
check(allDefault, `H. every match Nova doesn't play (${others.length}) has the switch, its defaultView pressed and near (${others.map((m) => `${Math.round(m[m.defaultView].rating)}/${Math.round(m[m.defaultView === "p1" ? "p2" : "p1"].rating)} -> ${m.defaultView}`).join(', ')})`);
if (mine) {
  const c = await card(mine.matchId);
  const seat = mine.p1.ownerId === myId ? 'p1' : 'p2';
  check(c && !c.hasSwitch && c.near === seat, `H. Nova's own match: no switch, Nova's side near (${seat})`);
} else note("(Nova's agent has no match live right now: its card isn't checked)");

console.log('\n[I] a tap flips the card');
const target = others[0];
const other = target.defaultView === 'p1' ? 'p2' : 'p1';
{
  await page.click(`#live-list .live-card[data-match="${target.matchId}"] .wa-b[data-seat="${other}"]`);
  await wait(200);
  const c = await card(target.matchId);
  const focus = await page.evaluate(() => document.activeElement && document.activeElement.dataset ? `${document.activeElement.dataset.act}:${document.activeElement.dataset.seat}` : null);
  check(c.pressed === other && c.near === other && c.cbFirst === other && c.nearName === target[other].agentName, `I. its scoreboard and compact board flip to ${target[other].agentName} (${other})`);
  check(focus === `watch-as:${other}`, `I. focus stays on the button (${focus})`);
  await shot(page, 'watch-live-switched');
  await wait(3500); // a poll's redraw keeps it
  check((await card(target.matchId))?.near === other, 'I. the 3 s redraw keeps the choice');
  await page.reload();
  await until(async () => (await card(target.matchId)) !== null, 15000);
  check((await card(target.matchId))?.near === other, 'I. a reload keeps it (this tab)');
}

console.log('\n[J] the arena from a switched card');
{
  await page.click(`#live-list .live-card[data-match="${target.matchId}"] [data-act="watch-arena"]`);
  await until(() => !!arenaFrame(), 20000);
  const f = arenaFrame();
  await f.waitForFunction(() => typeof window.__pov === 'function', null, { timeout: 30000 });
  const pv = await f.evaluate(() => window.__pov());
  const below = await f.evaluate((o) => document.getElementById('side-' + o).getBoundingClientRect().top > document.getElementById('side-' + (o === 'p1' ? 'p2' : 'p1')).getBoundingClientRect().top, other);
  check(pv.near === other && pv.canSwitch && below, `J. it opens with ${target[other].agentName} (${other}) at the bottom, the switch shown`);
  await f.click(`#pov-${target.defaultView}`);
  await wait(300);
  check((await f.evaluate(() => window.__pov())).near === target.defaultView, 'J. switching inside the arena flips it');
  await shot(page, 'arena-from-watch-live');
  await page.click('#replay .rp-close');
  await until(async () => (await page.$('#replay[hidden]')) !== null, 5000);
  await wait(300);
  const c = await card(target.matchId);
  // The match may have ended while the arena was open.
  if (c) check(c.near === target.defaultView && c.pressed === target.defaultView, `J. on Close the card shows the arena's choice (${c.near})`);
  else note('(the match ended while the arena was open: its card is gone)');
}

console.log("\n[K] Nova's own views");
{
  await page.goto(url + '#/match');
  const got = await until(async () => (await apiGet('/api/live')).body.mine !== null, 120000, 500);
  if (got) {
    const id = (await apiGet('/api/live')).body.mine;
    const m = (await apiGet('/api/live')).body.matches.find((x) => x.matchId === id);
    const seat = m.p1.ownerId === myId ? 'p1' : 'p2';
    check(!(await page.$('#m-live .watch-as')), 'K. Agent match has no switch');
    await until(async () => (await page.$(`#m-live [data-act="watch-arena"]`)) !== null, 15000);
    await page.click('#m-live [data-act="watch-arena"]');
    await until(() => !!arenaFrame(), 20000);
    const f = arenaFrame();
    await f.waitForFunction(() => typeof window.__pov === 'function', null, { timeout: 30000 });
    const pv = await f.evaluate(() => window.__pov());
    check(pv.near === seat && !pv.canSwitch && await f.evaluate(() => document.getElementById('pov').hidden), `K. its arena: Nova's side (${seat}) at the bottom, no switch`);
    await page.click('#replay .rp-close');
    await until(async () => (await page.$('#replay[hidden]')) !== null, 5000);
  } else check(false, "K. a match of Nova's goes live");
  // A replay from the history.
  check(await until(async () => (await apiGet('/api/matches?limit=5')).body.matches.some((r) => r.hasReplay), 180000, 1000), 'K. Nova has a recorded match with a replay');
  const row = (await apiGet('/api/matches?limit=5')).body.matches.find((r) => r.hasReplay);
  await page.goto(url + '#/match');
  await until(async () => (await page.$(`#m-hist [data-act="replay"][data-match="${row.matchId}"]`)) !== null, 30000, 300);
  await page.click(`#m-hist [data-act="replay"][data-match="${row.matchId}"]`);
  await until(() => !!arenaFrame(), 20000);
  const f = arenaFrame();
  await f.waitForFunction(() => typeof window.__pov === 'function', null, { timeout: 30000 });
  const pv = await f.evaluate(() => window.__pov());
  const below = await f.evaluate((s) => document.getElementById('side-' + s).getBoundingClientRect().top > document.getElementById('side-' + (s === 'p1' ? 'p2' : 'p1')).getBoundingClientRect().top, row.seat);
  check(pv.near === row.seat && !pv.canSwitch && below, `K. a replay from the history: Nova's seat (${row.seat}) at the bottom, no switch`);
  await shot(page, 'replay-own-seat');
  await page.click('#replay .rp-close');
}

console.log("\n[L] Home's Watch live widget");
{
  await page.goto(url + '#/');
  await page.waitForSelector('#wgrid');
  const w = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#wgrid .wg[data-type="watch"]')];
    return tiles.map((t) => ({ id: t.dataset.id, size: t.dataset.size, sw: !!t.querySelector('.watch-as') }));
  });
  note(`Watch live tiles: ${JSON.stringify(w)}`);
  const firstLive = (await apiGet('/api/live')).body.matches[0];
  const firstMine = firstLive && (firstLive.p1.ownerId === myId || firstLive.p2.ownerId === myId);
  if (!w.length) note('(no Watch live widget on the recommended board)');
  else if (firstMine) check(w.every((t) => !t.sw), "L. its first match is Nova's: no switch");
  else check(w.every((t) => t.sw === (t.size !== 'S')), `L. the widget shows the switch for its first match at M and L, not at S (${w.map((t) => `${t.size}: ${t.sw}`).join(', ')})`);
}

console.log('\n[M] errors and requests');
check(errors.length === 0, `M. no page errors${errors.length ? `: ${errors.slice(0, 4).join(' | ')}` : ''}`);
check(external.length === 0, `M. no external requests${external.length ? `: ${external.slice(0, 3).join(' ')}` : ''}`);

await browser.close();
try { process.kill(-demo.pid); } catch { /* gone */ }
console.log(`\n${passes} PASS, ${fails} FAIL — ${fails ? 'SOME FAIL' : 'ALL PASS'}`);
process.exit(fails ? 1 : 0);
