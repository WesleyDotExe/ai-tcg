// Render session 50: the match pages, driven in a headless browser against
// the real owner API with the game lane's long-lived ladder playing real
// matches (render/src/site/siteDemo.ts --ladder: a fresh season database,
// the owner API and the LiveLadder unchanged, the site host in front; the
// watch clock at 8x so a match plays out in under a minute).
//
//   A  Home: the Live match, Watch live and Match history widgets show the
//      server's live matches and history; My agent has the auto-play switch.
//   B  The auto-play switch: off and on again, each checked on the server.
//   C  Agent match: the live scoreboard is the server's board now, the
//      viewer's agent first; the play-by-play grows as moves are released,
//      in agent names, without the log's bookkeeping; when the match is
//      recorded, it tops the history.
//   D  Match history: the rows are the server's; Show older reads the rest.
//   E  A replay: full screen, the arena replay page rebuilt by the site host
//      from the server's replay file (the same agents, every move), played
//      to its end; Close and Escape go back, focus on the row's Replay.
//   F  A match's log in a dialog.
//   G  Watch live: every live match, each the server's.
//   H  A narrow window; the replay page's headers; a refused replay after
//      the session ended signs the site out; no external requests; no page
//      errors.
//
//   node progress/render/evidence/site-check-s50.mjs [stills dir]
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

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', '8'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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
const external = [];
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  // The check's own refusal (a replay after the session ended) logs a 401 by design.
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 401/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
  return { ctx, page };
}
const S = (page) => page.evaluate(() => window.__site.state());
const shot = (page, name, full = false) => page.screenshot({ path: resolve(OUT, `v2-s50-match-${name}.jpg`), type: 'jpeg', quality: 80, fullPage: full });
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
  return r.json();
}, path);
const until = async (fn, ms = 15000, step = 100) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
const norm = (s) => s.replace(/\s+/g, ' ').trim();

const { ctx, page } = await open();
await signIn(page);
const me = await apiGet(page, '/api/me');

// ---- A: Home's match widgets ---------------------------------------------------
console.log('\n[A] Home: Live match, Watch live, Match history, My agent');
{
  await until(async () => (await page.$$('.wg[data-type="live"] .sb, .wg[data-type="live"] .muted')).length > 0 && (await S(page)).home.live !== null, 20000);
  const live = await apiGet(page, '/api/live');
  const types = await page.$$eval('.wg', (els) => els.map((e) => e.dataset.type));
  note(`the board: ${types.join(', ')}; ${live.matches.length} live, mine ${live.mine}`);
  check(types.includes('live') && types.includes('watch'), 'A. the recommended board has Live match and Watch live');
  const mine = live.matches.find((m) => m.matchId === live.mine);
  if (mine) {
    await until(async () => (await page.$('.wg[data-type="live"] .sb')) !== null, 8000);
    const names = await page.$$eval('.wg[data-type="live"] .sb .sb-name b', (els) => els.map((e) => e.textContent));
    const mySeat = mine.p1.ownerId === me.ownerId ? 'p1' : 'p2';
    check(names[0] === mine[mySeat].agentName && names[1] === mine[mySeat === 'p1' ? 'p2' : 'p1'].agentName, `A. Live match: Nova's agent first (${names.join(' vs ')})`);
  } else check(await page.$eval('.wg[data-type="live"]', (e) => /next ladder round|starting/.test(e.textContent)), 'A. Live match: no match live for Nova, says so');
  const watchNames = await page.$$eval('.wg[data-type="watch"] .sb .sb-name b, .wg[data-type="watch"] .lline b', (els) => els.map((e) => e.textContent));
  const all = live.matches.flatMap((m) => [m.p1.agentName, m.p2.agentName]);
  check(watchNames.length > 0 && watchNames.every((n) => all.includes(n)), `A. Watch live: the live matches' agents (${watchNames.join(', ')})`);
  check(await page.$('.wg[data-type="agent"] [role="switch"][aria-checked="true"]') !== null, 'A. My agent: the auto-play switch, on (the server says on)');
  // Match history isn't on the recommended board: add it (Customise, then Done saves).
  await page.click('[data-act="add"]');
  await page.waitForSelector('#dialog .dlg');
  const addHist = await page.$('#dialog [data-type="history"], #dialog [data-add="history"], #dialog button:has-text("Match history")');
  if (addHist) await addHist.click();
  await until(async () => (await page.$('.wg[data-type="history"]')) !== null, 5000);
  if (await page.$('[data-act="done"]')) await page.click('[data-act="done"]');
  await until(async () => (await page.$('.wg[data-type="history"] .hrow, .wg[data-type="history"] .wl')) !== null, 8000);
  const hist = await apiGet(page, '/api/matches?limit=20');
  const histText = norm(await page.$eval('.wg[data-type="history"]', (e) => e.textContent));
  const first = hist.matches[0];
  check(histText.includes(first.opponent.agentName), `A. Match history widget: the latest is the server's (vs ${first.opponent.agentName}, ${first.result})`);
  await shot(page, 'home', true);
}

// ---- B: the auto-play switch -----------------------------------------------------
console.log('\n[B] the auto-play switch');
{
  await page.click('.wg[data-type="agent"] [role="switch"]');
  check(await until(async () => (await apiGet(page, '/api/play')).autoPlay.on === false, 5000), 'B. off: the server says off');
  check(await until(async () => (await page.$('.wg[data-type="agent"] [role="switch"][aria-checked="false"]')) !== null, 3000), 'B. off: the switch shows off');
  await page.click('.wg[data-type="agent"] [role="switch"]');
  check(await until(async () => (await apiGet(page, '/api/play')).autoPlay.on === true, 5000), 'B. on again: the server says on');
  check(await until(async () => (await page.$('.wg[data-type="agent"] [role="switch"][aria-checked="true"]')) !== null, 3000), 'B. on: the switch shows on');
}

// ---- C: Agent match, live ---------------------------------------------------------
console.log('\n[C] Agent match: the live match');
let followed = null;
{
  await page.goto(url + '#/match');
  // Nova plays every round (four owners, two matches a round): wait for hers to be live.
  check(await until(async () => (await apiGet(page, '/api/live')).mine !== null, 90000, 500), 'C. a match of Nova\'s goes live (the ladder runs on)');
  await until(async () => (await page.$('#m-live .sb')) !== null, 8000);
  const live = await apiGet(page, '/api/live');
  const m = live.matches.find((x) => x.matchId === live.mine);
  followed = m.matchId;
  const mySeat = m.p1.ownerId === me.ownerId ? 'p1' : 'p2';
  const near = await page.$eval('#m-live .sb', (e) => e.dataset.near);
  check(near === mySeat, `C. Nova's agent is on the near side (seat ${mySeat})`);
  const n1 = (await page.$$('#m-pbp li')).length;
  await wait(6000);
  const lines = await page.$$eval('#m-pbp li', (els) => els.map((e) => e.textContent));
  note(`play-by-play: ${n1} lines, then ${lines.length} six seconds later; latest: "${lines.at(-1)}"`);
  check(lines.length > n1, 'C. the play-by-play grows as moves are released');
  check(lines.every((l) => !/\bp[12]\b|passes priority|\(u\d+\)|^\[end of turn/.test(l)), 'C. in agent names, without the log\'s bookkeeping');
  // What the page drew is the server's answer it last read (read together,
  // so a redraw can't fall between them; at 8x moves come out faster than
  // the page's 3 s poll, so the page's read is the reference, not a fresh one).
  const drawn = await page.evaluate((id) => {
    const m = window.__site.state().home.live.matches.find((x) => x.matchId === id);
    return { hp: [...document.querySelectorAll('#m-live .sb .sb-hp b')].map((e) => Number(e.textContent)), near: document.querySelector('#m-live .sb').dataset.near, m };
  }, followed);
  if (drawn.m) {
    const far = drawn.near === 'p1' ? 'p2' : 'p1';
    const want = [Math.max(0, drawn.m.now[drawn.near].health), Math.max(0, drawn.m.now[far].health)];
    check(String(drawn.hp) === String(want), `C. the scoreboard's health is the server's answer (${drawn.hp.join('-')}, the answer ${want.join('-')})`);
    const api = (await apiGet(page, '/api/live')).matches.find((x) => x.matchId === followed);
    check(!api || api.released >= drawn.m.released, `C. ... and no newer than the server (${drawn.m.released} moves drawn, ${api ? api.released : 'ended'} out now)`);
  }
  await shot(page, 'live', true);
  // Played out: the match tops the history.
  check(await until(async () => (await apiGet(page, '/api/live')).mine !== followed, 120000, 1000), 'C. the match ends (recorded after its last move)');
  check(await until(async () => (await page.$(`#m-hist .hrow[data-match="${followed}"]`)) !== null && (await page.$eval('#m-hist .hrow', (e) => e.dataset.match)) === followed, 15000), `C. it tops Match history (${followed})`);
}

// ---- D: Match history ---------------------------------------------------------------
console.log('\n[D] Match history');
{
  const h = await apiGet(page, '/api/matches?limit=20');
  const rows = await page.$$eval('#m-hist .hrow', (els) => els.map((e) => e.dataset.match));
  check(String(rows) === String(h.matches.map((m) => m.matchId)), `D. the first page is the server's (${rows.length} of ${h.total})`);
  const r0 = h.matches[0];
  const t0 = await page.$eval('#m-hist .hrow', (e) => e.textContent.replace(/\s+/g, ' '));
  const cr = r0.credits > 0 ? `+${r0.credits} credits` : 'No credits';
  check(t0.includes(cr) && t0.includes(r0.opponent.agentName), `D. its row: "${norm(t0).slice(0, 90)}"`);
  if (h.more) {
    await page.click('[data-act="more-hist"]');
    await until(async () => (await page.$$('#m-hist .hrow')).length > rows.length, 8000);
  }
  const n = (await page.$$('#m-hist .hrow')).length;
  check(n === h.total && (await page.$('[data-act="more-hist"]')) === null, `D. Show older reads the rest: ${n} of ${h.total}, no more button`);
  const noRep = await page.$$eval('#m-hist .hrow', (els) => els.filter((e) => !e.querySelector('[data-act="replay"]')).length);
  const apiNoRep = (await apiGet(page, `/api/matches?limit=100`)).matches.filter((m) => !m.hasReplay).length;
  check(noRep === apiNoRep, `D. rows without a replay say so (${noRep}, the server: ${apiNoRep})`);
}

// ---- E: a replay -----------------------------------------------------------------------
console.log('\n[E] a replay, full screen');
{
  const replayBtn = `#m-hist .hrow[data-match="${followed}"] [data-act="replay"]`;
  await page.click(replayBtn);
  check(await until(async () => (await page.$('#replay:not([hidden]) iframe')) !== null, 15000), 'E. the replay opens full screen');
  const frame = await (async () => { let f; await until(async () => { f = page.frames().find((x) => /\/replay\/[A-Za-z0-9_-]{24}$/.test(x.url())); return !!f; }, 15000); return f; })();
  await frame.waitForSelector('#scrubber');
  const d = await frame.evaluate(() => { const d = JSON.parse(document.getElementById('match-data').textContent); return { names: d.agentNames, moves: d.movesPlayed, frames: d.frames.length, record: d.record, winner: d.frames.at(-1).winner }; });
  const view = await apiGet(page, `/api/matches/${followed}`);
  check(d.names.p1 === view.p1.agentName && d.names.p2 === view.p2.agentName, `E. the same agents (${d.names.p1} vs ${d.names.p2})`);
  check(d.moves === view.moves && d.frames === view.moves + 1, `E. every move: ${d.moves} (the record: ${view.moves})`);
  check(d.record && d.record.matchId === followed && (d.record.boast?.itemId ?? null) === (view.boast?.itemId ?? null), `E. the record's boast (${view.boast?.itemId ?? 'none'})`);
  const won = view.outcome === 'win' ? (view.winnerOwnerId === view.p1.ownerId ? 'p1' : 'p2') : 'draw';
  check(d.winner === won, `E. the same winner (${won})`);
  await page.waitForTimeout(2500);
  await shot(page, 'replay');
  await frame.evaluate(() => { const s = document.getElementById('scrubber'); s.value = s.max; s.dispatchEvent(new Event('input')); });
  check(await until(() => frame.evaluate(() => /GAME OVER/.test(document.getElementById('turnbar').textContent)), 8000), 'E. played to its end: GAME OVER');
  await shot(page, 'replay-end');
  await page.click('.rp-close');
  check(await page.$eval('#replay', (e) => e.hidden) && (await S(page)).replay === null, 'E. Close: gone');
  check(await page.evaluate((id) => document.activeElement?.dataset?.act === 'replay' && document.activeElement?.dataset?.match === id, followed), 'E. focus back on the row\'s Replay');
  await page.click(replayBtn);
  await until(async () => (await page.$('#replay:not([hidden]) iframe')) !== null, 15000);
  await page.focus('.rp-close');
  await page.keyboard.press('Escape');
  check(await page.$eval('#replay', (e) => e.hidden), 'E. Escape (on the website): gone');
}

// ---- F: a match's log ----------------------------------------------------------------
console.log('\n[F] the log');
{
  await page.click(`#m-hist .hrow[data-match="${followed}"] [data-act="match-log"]`);
  await page.waitForSelector('#dialog .mlog');
  const text = await page.$eval('#dialog .mlog', (e) => e.textContent);
  check(text.startsWith('--- Turn 1 (p1) ---') && /GAME OVER/.test(text), `F. the log, whole (${text.split('\n').length} lines)`);
  await shot(page, 'log');
  await page.keyboard.press('Escape');
}

// ---- G: Watch live ------------------------------------------------------------------
console.log('\n[G] Watch live');
{
  await page.goto(url + '#/live');
  await until(async () => (await apiGet(page, '/api/live')).matches.length > 0, 90000, 500);
  await until(async () => (await page.$$('#live-list .live-card')).length > 0, 8000);
  const live = await apiGet(page, '/api/live');
  const cards = await page.$$eval('#live-list .live-card', (els) => els.map((e) => e.dataset.match));
  check(cards.length === live.matches.length && cards.every((c) => live.matches.some((m) => m.matchId === c)), `G. one card per live match (${cards.length})`);
  await shot(page, 'watch-live', true);
}

// ---- H: narrow, headers, refusal ------------------------------------------------------
console.log('\n[H] narrow, headers, a refused replay');
{
  const n = await open({ viewport: { width: 720, height: 1000 } });
  await signIn(n.page);
  await n.page.goto(url + '#/match');
  await until(async () => (await n.page.$('#m-hist .hrow')) !== null, 10000);
  const wide = await n.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(wide, 'H. 720 px: no sideways scroll on Agent match');
  await shot(n.page, 'narrow', true);
  // The replay page's headers.
  const tok = await n.page.evaluate(() => JSON.parse(sessionStorage.getItem('aitcg.site.session')).token);
  const built = await n.page.evaluate(async ([id, t]) => (await fetch(`/replay-page/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } })).json(), [followed, tok]);
  const head = await n.page.evaluate(async (u) => { const r = await fetch(u); return { s: r.status, csp: r.headers.get('content-security-policy'), ct: r.headers.get('content-type') }; }, built.url);
  check(head.s === 200 && /frame-ancestors 'self'/.test(head.csp) && !/connect-src/.test(head.csp) && /text\/html/.test(head.ct), 'H. /replay/<key>: framed by the site only, fetches nothing');
  // The session ends on the server; then Replay: the site signs out, nothing shown.
  await n.page.evaluate(async (t) => fetch('/api/session', { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } }), tok);
  await n.page.click('#m-hist [data-act="replay"]');
  check(await until(async () => (await n.page.$('#signin:not([hidden])')) !== null, 8000), 'H. a replay after the session ended: back to sign-in');
  check(await n.page.$eval('#replay', (e) => e.hidden), 'H. ... and no replay on screen');
  await n.ctx.close();
}

check(external.length === 0, `no external requests${external.length ? `: ${external.slice(0, 3).join(', ')}` : ''}`);
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
console.log(`\n${passes} pass, ${fails} fail${fails ? '' : ' — ALL PASS'}`);
await ctx.close();
await browser.close();
process.kill(-demo.pid);
process.exit(fails ? 1 : 0);
