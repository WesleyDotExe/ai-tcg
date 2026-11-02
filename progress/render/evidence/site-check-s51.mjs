// Render session 51: the big live board, driven in a headless browser against
// the real owner API with the game lane's long-lived ladder playing real
// matches (render/src/site/siteDemo.ts --ladder --speed 4: a fresh season
// database, the owner API and the LiveLadder unchanged, the site host in
// front; the watch clock at 4x so a match plays out in about a minute and a half).
//
//   A  Agent match: "Watch on the arena" on Nova's live match opens the arena
//      full screen (the host's /live/<key> page), at the newest move released,
//      the badge LIVE; the board's health, energy and hand counts are the
//      server's (GET /api/live/:id) at the move shown; hands are card backs.
//   B  It follows: new moves come in and play (the move count grows, the
//      arena stays at the newest). Pause: the badge says how far behind;
//      a tap on it goes live again. The header's factions follow the board.
//   C  The match ends on the arena: GAME OVER, the badge ENDED, the record's
//      boast handed to the page (the record's item, the same as the replay's).
//   D  Close: gone, focus back on the button.
//   E  Watch live: every live card has the button; one opened from there is
//      that match; Escape on the website closes it.
//   F  The live page's headers; no external requests; no page errors.
//
//   node progress/render/evidence/site-check-s51.mjs [stills dir]
// (PW_CORE as in render/ci/browser-check.mjs, if playwright isn't found.)

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

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', '4'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const url = await new Promise((ok, fail) => {
  let buf = '';
  demo.stdout.on('data', (d) => { buf += d; const m = /\[site-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
  demo.stderr.on('data', (d) => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
  demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
  setTimeout(() => fail(new Error('the demo took over 120 s to start')), 120000);
});

let passes = 0, fails = 0;
const check = (ok, line) => { if (ok) passes++; else fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); };
const note = (line) => console.log(`      ${line}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const chromium = await loadPlaywright();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const errors = [];
const timeline = [];
const T0 = Date.now();
const external = [];
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (/\/live(-page)?\//.test(r.url())) timeline.push(`${((Date.now() - T0) / 1000).toFixed(1)}s ${r.status()} ${r.url().replace(url, '/').slice(0, 40)}`); if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(url, '/')}`); });
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
  return { ctx, page };
}
// A still taken while the boast's canvas runs can time out in software WebGL: try again, then say so.
const shot = async (page, name) => {
  for (let k = 0; k < 3; k++) {
    try { await page.screenshot({ path: resolve(OUT, `v2-s51-live-${name}.jpg`), type: 'jpeg', quality: 80, timeout: 20000 }); return; } catch { await wait(3000); }
  }
  note(`(the still "${name}" timed out three times)`);
};
const until = async (fn, ms = 15000, step = 100) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
async function signIn(page) {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');
}
const apiGet = (page, path) => page.evaluate(async (path) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { headers: { Authorization: `Bearer ${t}` } });
  return { status: r.status, body: await r.json() };
}, path);
const navTiming = (f) => f.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? `request ${Math.round(n.requestStart)} ms, response done ${Math.round(n.responseEnd)} ms, DOM interactive ${Math.round(n.domInteractive)} ms, loaded ${Math.round(n.loadEventEnd)} ms` : '?'; });
const liveFrame = (page) => page.frames().find((x) => /\/live\/[A-Za-z0-9_-]{24}$/.test(x.url()));
/** What the arena shows now: the move, the badge, both HUDs, the hands. */
const arenaNow = (frame) => frame.evaluate(() => {
  const m = /move (\d+) \/ (\d+)/.exec(document.getElementById('framecount').textContent) || [];
  const hud = (p) => ({ hp: document.getElementById(`hud-${p}-hp-text`).textContent, en: document.getElementById(`hud-${p}-en-text`).textContent, backs: document.querySelectorAll(`#hand-${p} .minicard.back`).length, faces: document.querySelectorAll(`#hand-${p} .minicard:not(.back)`).length, units: document.querySelectorAll(`#board-${p} .card[data-iid]`).length });
  const b = document.getElementById('btn-live');
  return { at: Number(m[1]), of: Number(m[2]), badge: b.textContent, badgeClass: b.className, turnbar: document.getElementById('turnbar').textContent, p1: hud('p1'), p2: hud('p2'), brand: document.querySelector('.brand').textContent };
});

const { ctx, page } = await open();
await signIn(page);

// ---- A: Agent match, the arena ---------------------------------------------------
console.log('\n[A] Agent match: Watch on the arena');
let matchId = null;
let frame = null;
{
  await page.goto(url + '#/match');
  check(await until(async () => (await apiGet(page, '/api/live')).body.mine !== null, 120000, 500), "A. a match of Nova's goes live");
  matchId = (await apiGet(page, '/api/live')).body.mine;
  // Join a little way in, so the page starts mid-match.
  await until(async () => (await apiGet(page, `/api/live/${matchId}?from=0`)).body.released >= 8, 60000, 300);
  await until(async () => (await page.$(`#m-live [data-act="watch-arena"][data-match="${matchId}"]`)) !== null, 10000);
  await page.click(`#m-live [data-act="watch-arena"][data-match="${matchId}"]`);
  check(await until(async () => (await page.$('#replay:not([hidden]) iframe')) !== null, 15000), 'A. the arena opens full screen');
  await until(async () => !!liveFrame(page), 15000);
  frame = liveFrame(page);
  await frame.waitForSelector('#btn-live');
  note(`the first live page: ${await navTiming(frame)}`);
  const first = await arenaNow(frame);
  note(`joined at move ${first.at} of ${first.of}; badge "${first.badge}"`);
  // At 4x a move comes out every 250 ms to 2 s, read in 3 s batches: the page may be a few moves behind for a moment, then catches up.
  check(first.at >= 8 && first.of - first.at <= 8, `A. starts at (or within a few moves of) the newest move released (${first.at} / ${first.of}), not from the first`);
  check(/LIVE/.test(first.brand) && first.badge === 'LIVE' && /\bon\b/.test(first.badgeClass), 'A. SPECTATOR LIVE, the badge LIVE');
  // The server's board at the move shown: read the feed up to it.
  const feed = (await apiGet(page, `/api/live/${matchId}?from=0`)).body;
  // The arena may have moved on since: compare at the move it shows now.
  const at = await arenaNow(frame);
  const s2 = feed.steps[at.at - 1];
  const want2 = (p) => ({ hp: `${Math.max(0, s2.after[p].health)}/${s2.after[p].maxHealth}`, en: `${s2.after[p].energy}/${s2.after[p].maxEnergy}`, backs: s2.after[p].hand, units: s2.after[p].board.length });
  for (const p of ['p1', 'p2']) {
    const got = { hp: at[p].hp, en: at[p].en, backs: at[p].backs, units: at[p].units };
    check(JSON.stringify(got) === JSON.stringify(want2(p)), `A. ${p} at move ${at.at}: health ${got.hp}, energy ${got.en}, ${got.backs} cards in hand, ${got.units} units: the server's (${JSON.stringify(want2(p))})`);
    check(at[p].faces === 0, `A. ${p}'s hand: card backs only (${at[p].backs} backs, no faces)`);
  }
  await shot(page, 'joined');
}

// ---- B: it follows; pause and go live -----------------------------------------------
console.log('\n[B] following the newest move; pause; go live');
{
  // Pause first (early in the match, so it is still on when the badge is tapped).
  await frame.click('#btn-play', { timeout: 15000, noWaitAfter: true });
  const paused = await arenaNow(frame);
  check(await until(async () => { const a = await arenaNow(frame); return a.of > paused.at && /behind/.test(a.badge) && a.at === paused.at; }, 20000, 250), 'B. paused: the arena stays put, the badge says how far behind');
  const behind = await arenaNow(frame);
  note(`badge "${behind.badge}"`);
  await shot(page, 'behind');
  await frame.click('#btn-live', { timeout: 15000, noWaitAfter: true });
  check(await until(async () => { const a = await arenaNow(frame); return a.badge === 'LIVE' && a.at >= behind.of; }, 10000, 200), 'B. a tap on the badge: back to the newest, LIVE');
  const before = await arenaNow(frame);
  check(await until(async () => (await arenaNow(frame)).at >= before.at + 4, 30000, 250), `B. new moves come in and play (from move ${before.at})`);
  const now = await arenaNow(frame);
  // Sampled for 10 s: never more than a few moves behind (it catches up past 3).
  let worst = 0;
  for (let k = 0; k < 40; k++) { const a = await arenaNow(frame); if (a.badge === 'ENDED') break; worst = Math.max(worst, a.of - a.at); await wait(250); }
  check(worst <= 12 && now.badge === 'LIVE', `B. it keeps up with the newest at 4x (at most ${worst} moves behind over 10 s: one 3 s read's worth; it hurries past 3 behind and skips ahead past 12)`);
  await shot(page, 'following');
  // Each side's faction in the header is its HUD's once it has shown (Neutral before).
  const fac = await frame.evaluate(() => ({ head: document.getElementById('matchup').textContent, p1: document.getElementById('hud-p1-faction').textContent, p2: document.getElementById('hud-p2-faction').textContent }));
  check(fac.head.includes(`[${fac.p1}]`) && fac.head.includes(`[${fac.p2}]`), `B. the header's factions follow the board (${fac.head.trim()}; HUDs ${fac.p1}, ${fac.p2})`);
}

// ---- C: the end -----------------------------------------------------------------------
console.log('\n[C] the match ends on the arena');
{
  check(await until(async () => (await arenaNow(frame)).badge === 'ENDED', 180000, 500), 'C. the badge says ENDED once the match is recorded');
  await until(async () => { const a = await arenaNow(frame); return a.at === a.of && /GAME OVER/.test(a.turnbar); }, 30000, 250);
  const end = await arenaNow(frame);
  check(end.at === end.of && /GAME OVER/.test(end.turnbar), `C. at the last move (${end.at}), GAME OVER: ${end.turnbar.replace(/.*GAME OVER: /, '')}`);
  const rec = (await apiGet(page, `/api/matches/${matchId}`)).body;
  // What the host handed the page at the end (its own frames endpoint, the same key as the page).
  const key = /\/live\/([A-Za-z0-9_-]{24})$/.exec(frame.url())[1];
  const handed = await page.evaluate(async (k) => { const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token; return (await fetch(`/live-frames/${k}?from=100000`, { headers: { Authorization: `Bearer ${t}` } })).json(); }, key);
  // The replay of the same match, rebuilt by the host from the server's file.
  const rp = await page.evaluate(async (id) => { const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token; return (await fetch(`/replay-page/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } })).json(); }, matchId);
  const replayRec = await page.evaluate(async (u) => { const h = await (await fetch(u)).text(); return JSON.parse(/<script type="application\/json" id="match-data">([\s\S]*?)<\/script>/.exec(h)[1].replace(/\\u003c/g, '<')).record; }, rp.url);
  check(handed.ended === true && JSON.stringify(handed.record) === JSON.stringify(replayRec), `C. the record handed to the arena is the replay's (boast ${rec.boast?.itemId ?? 'none'})`);
  check(rp.moves === end.of, `C. the arena showed every move of the recorded match (${end.of}; the replay file: ${rp.moves})`);
  await wait(2500);
  await shot(page, 'ended');
}

// ---- D: Close -----------------------------------------------------------------------
console.log('\n[D] Close');
{
  await page.click('#replay .rp-close');
  check(await page.$eval('#replay', (e) => e.hidden), 'D. Close: gone');
  // The live match is over, so its button may have been redrawn away: then focus is on the page.
  const f = await page.evaluate(() => ({ act: document.activeElement?.dataset?.act ?? null }));
  note(`focus after Close: ${f.act ?? 'the page (the match ended, its live panel was redrawn)'}`);
  check(errors.length === 0, 'D. no page errors so far');
}

// ---- E: Watch live --------------------------------------------------------------------
console.log('\n[E] Watch live');
{
  await page.goto(url + '#/live');
  check(await until(async () => (await page.$$('#live-list .live-card')).length > 0, 120000, 500), 'E. a match is live on Watch live');
  const cards = await page.$$eval('#live-list .live-card', (els) => els.map((e) => ({ id: e.dataset.match, btn: !!e.querySelector('[data-act="watch-arena"]') })));
  check(cards.every((c) => c.btn), `E. every live card has "Watch on the arena" (${cards.length})`);
  // The freshest match (the fewest moves out), so it is still on while it is checked.
  const feeds = await Promise.all(cards.map(async (c) => ({ id: c.id, f: (await apiGet(page, `/api/live/${c.id}?from=0`)).body })));
  feeds.sort((a, b) => a.f.released - b.f.released);
  const id = feeds[0].id;
  const lm = feeds[0].f;
  note(`opening ${lm.p1.agentName} vs ${lm.p2.agentName} at move ${lm.released}`);
  timeline.length = 0;
  timeline.push(`${((Date.now() - T0) / 1000).toFixed(1)}s click`);
  await page.click(`#live-list .live-card[data-match="${id}"] [data-act="watch-arena"]`);
  await until(async () => !!liveFrame(page), 30000);
  const f2 = liveFrame(page);
  // In software WebGL a live page takes a few seconds to answer (measured: about 4 s on its own, long tasks
  // up to 1.2 s per move while it catches up), more with the website's liquid behind it.
  const t0 = Date.now();
  await f2.waitForSelector('#btn-live', { state: 'attached', timeout: 60000 });
  note(`the second live page answered after ${((Date.now() - t0) / 1000).toFixed(1)} s (${timeline.join(' | ')}; attached ${((Date.now() - T0) / 1000).toFixed(1)}s)`);
  note(`the second live page: ${await navTiming(f2)}`);
  const rects = { badge: await f2.evaluate(() => { const r = document.getElementById('btn-live').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }), frame: await page.evaluate(() => { const r = document.querySelector('#replay iframe').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }) };
  note(`badge ${rects.badge.join('x')}, frame ${rects.frame.join('x')}`);
  check(rects.frame[0] > 1000 && rects.frame[1] > 700 && rects.badge[0] > 0, 'E. the arena fills the window, the badge on it');
  const names = await f2.evaluate(() => JSON.parse(document.getElementById('match-data').textContent).agentNames);
  check(names.p1 === lm.p1.agentName && names.p2 === lm.p2.agentName, `E. the arena is that match (${names.p1} vs ${names.p2})`);
  await wait(1500);
  await shot(page, 'watch-live');
  await page.focus('#replay .rp-close');
  await page.keyboard.press('Escape');
  check(await page.$eval('#replay', (e) => e.hidden), 'E. Escape on the website: gone');
  const fe = await page.evaluate((id) => ({ act: document.activeElement?.dataset?.act ?? null, match: document.activeElement?.dataset?.match ?? null, tag: document.activeElement?.tagName, still: !!document.querySelector(`#live-list .live-card[data-match="${id}"]`) }), id);
  // If the match ended while it was open, its card is gone: focus is then on the page.
  check(fe.still ? fe.act === 'watch-arena' && fe.match === id : true, `E. focus back on that card's button (${fe.still ? `${fe.tag} ${fe.act}` : 'the match ended meanwhile; its card is gone'})`);
}

// ---- F: headers ------------------------------------------------------------------------
console.log('\n[F] the live page\'s headers');
{
  const live = (await apiGet(page, '/api/live')).body;
  const id = live.matches[0]?.matchId;
  if (id) {
    const built = await page.evaluate(async (id) => { const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token; return (await fetch(`/live-page/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } })).json(); }, id);
    const head = await page.evaluate(async (u) => { const r = await fetch(u); return { s: r.status, csp: r.headers.get('content-security-policy'), ct: r.headers.get('content-type') }; }, built.url);
    check(head.s === 200 && /frame-ancestors 'self'/.test(head.csp) && !/connect-src/.test(head.csp) && /text\/html/.test(head.ct), 'F. /live/<key>: framed by the site only, fetches nothing (the website hands it the moves)');
  } else note('no live match for the header check');
}

check(external.length === 0, `no external requests${external.length ? `: ${external.slice(0, 3).join(', ')}` : ''}`);
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
console.log(`\n${passes} pass, ${fails} fail${fails ? '' : ' — ALL PASS'}`);
await ctx.close();
await browser.close();
process.kill(-demo.pid);
process.exit(fails ? 1 : 0);
