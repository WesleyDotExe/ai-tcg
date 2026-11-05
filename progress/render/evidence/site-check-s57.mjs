// Render session 57: My agent and Agent controls (the owner's 2026-11-06
// Season 0 brief, section 1), driven in a headless browser against the real
// owner API with the game lane's long-lived ladder playing real matches
// (render/src/site/siteDemo.ts --ladder --speed 4).
//
//   A  Every size of both widgets on Nova's saved board (PUT /api/board, then
//      the page reloaded): what each size shows differs (the brief's table),
//      and the numbers are the server's (the rating is GET /api/rating's,
//      today's W/L GET /api/daily's, the dial's style GET /api/play's).
//   B  The personality dial: a notch clicked saves the style (GET /api/play
//      reads it back), the pointer and the pressed notch move; with Nova's
//      match live, the note says what this match plays and what comes next,
//      and the live view still shows the old style for that match.
//   C  Start / Stop: Stop turns auto-play off (the server's answer), the
//      ring goes to Off; Start turns it on again.
//   D  The deck switcher at L: "Your agent picks" saved (deckChoice
//      "agent"), then the deck Nova had, saved back (forced, that deck).
//   E  No external requests; no page errors.
//
//   node progress/render/evidence/site-check-s57.mjs [stills dir]

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
const until = async (fn, ms = 15000, step = 150) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
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
const shot = async (name, sel) => {
  const el = sel ? await page.$(sel) : null;
  try { await (el ?? page).screenshot({ path: resolve(OUT, `v2-s57-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000 }); } catch { note(`(the still "${name}" timed out)`); }
};
const tile = (type) => `#wgrid .wg[data-type="${type}"]`;
const text = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const count = (sel) => page.$$eval(sel, (x) => x.length);

try {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');

  // ---- A: every size ----
  console.log('\n[A] both widgets at S, M and L');
  const sizes = {};
  for (const size of ['S', 'M', 'L']) {
    const put = await api('PUT', '/api/board', { widgets: [{ id: 'w1', type: 'agent', size }, { id: 'w2', type: 'live', size }] });
    check(put.status === 200, `A. the board saved with both widgets at ${size}`);
    await page.reload();
    await page.waitForSelector(`${tile('agent')}[data-size="${size}"]`);
    // Wait for the reads the size needs.
    await until(async () => !(await text(tile('agent'))).includes('loading…') && !(await text(tile('live'))).includes('loading…'));
    const [rating, daily, play] = await Promise.all([api('GET', '/api/rating?recent=20'), api('GET', '/api/daily'), api('GET', '/api/play')]);
    const ma = await text(tile('agent'));
    const ac = await text(tile('live'));
    sizes[size] = {
      ma, ac,
      dial: await count(`${tile('live')} [data-act="play-style"]`),
      ring: await count(`${tile('live')} .tring`),
      decks: await count(`${tile('live')} [data-act="ctl-deck"]`),
      adds: await count(`${tile('live')} [data-act="play-time"][data-add="1"]`),
      presets: await count(`${tile('live')} [data-act="play-time"][data-add="0"]`),
      trend: await count(`${tile('agent')} svg.trend`),
      hrows: await count(`${tile('agent')} .hrow`),
      acrows: await count(`${tile('live')} .hrow`),
      title: await text(`${tile('live')} .wtt`),
    };
    const r = rating.body.rating;
    const shown = r.tier === 'Placement' ? null : String(Math.round(r.rating));
    check(shown === null ? ma.includes('Placement') : ma.includes(shown), `A. ${size}: My agent's rating is the server's (${shown ?? 'in placement'}, ${r.tier})`);
    check(sizes[size].title === 'Agent controls', `A. ${size}: the tile is named Agent controls`);
    check(sizes[size].ring === 1, `A. ${size}: the portrait sits in the time ring`);
    const style = play.body.playStyles.find((s) => s.id === play.body.connectedAgent.playStyle).name;
    if (size !== 'S') {
      const today = `${daily.body.wins.length}W ${daily.body.losses}L today`;
      check(ma.includes(today), `A. ${size}: today's W/L is GET /api/daily's ("${today}")`);
      check(sizes[size].dial === play.body.playStyles.length && ac.includes(style), `A. ${size}: the dial has a notch per play style (${sizes[size].dial}) and names ${style}`);
    }
    await shot(`size-${size}`, '#wgrid');
    note(`My agent ${size}: ${ma.slice(0, 170)}`);
    note(`Agent controls ${size}: ${ac.slice(0, 200)}`);
  }
  const s = sizes;
  check(!s.S.ma.includes('today') && s.M.ma.includes('today') && s.L.ma.includes('today'), 'A. My agent: today\'s W/L from M up, not at S');
  check(s.S.trend === 0 && s.M.trend === 0 && s.L.trend === 1 && s.L.hrows > 0 && s.M.hrows === 0, `A. My agent: the rating trend and recent matches (${s.L.hrows}) only at L`);
  check(s.S.dial === 0 && s.M.dial > 0, 'A. Agent controls: the dial from M up, not at S');
  check(s.S.presets === 0 && s.M.presets === 3 && s.M.adds === 0 && s.L.adds === 2, 'A. Agent controls: 15/30/60 from M, +15/+30 only at L (waiting on the server\'s allowance)');
  check(s.M.decks === 0 && s.L.decks >= 2 && s.L.acrows > 0, `A. Agent controls: the deck switcher (${s.L.decks} choices) and the match history (${s.L.acrows}) only at L`);

  // ---- B: the dial ----
  console.log('\n[B] the personality dial');
  // Wait for Nova's match to be live (the ladder at 4×), so the "next match" rule shows.
  const liveNow = await until(async () => (await api('GET', '/api/play')).body.liveMatch !== null, 240000, 1000);
  note(liveNow ? 'Nova\'s match is live' : 'no match of Nova\'s went live in 4 minutes');
  await page.reload();
  await page.waitForSelector(`${tile('live')} [data-act="play-style"]`);
  await until(async () => !(await text(tile('live'))).includes('loading…'));
  const before = (await api('GET', '/api/play')).body;
  const live = (await api('GET', '/api/live')).body;
  const mine = live.matches.find((m) => m.matchId === live.mine);
  const agentId = before.connectedAgent.agentId;
  const matchStyle = mine ? (mine.p1.agentId === agentId ? mine.p1 : mine.p2).playStyle : null;
  const target = before.playStyles.find((x) => x.id !== before.connectedAgent.playStyle && x.id !== matchStyle) ?? before.playStyles.find((x) => x.id !== before.connectedAgent.playStyle);
  await page.click(`${tile('live')} [data-act="play-style"][data-style="${target.id}"]`);
  const saved = await until(async () => (await api('GET', '/api/play')).body.connectedAgent.playStyle === target.id);
  check(saved, `B. clicking the ${target.name} notch saved it (GET /api/play: ${target.id})`);
  await until(async () => (await page.$(`${tile('live')} [data-style="${target.id}"][aria-pressed="true"]`)) !== null);
  check((await count(`${tile('live')} [data-act="play-style"][aria-pressed="true"]`)) === 1 && (await page.$(`${tile('live')} [data-style="${target.id}"][aria-pressed="true"]`)) !== null, 'B. the pressed notch moved to it (one pressed)');
  const angle = before.playStyles.findIndex((x) => x.id === target.id) * Math.round(360 / before.playStyles.length);
  const transform = await page.$eval(`${tile('live')} .dn-face i`, (e) => e.style.transform);
  check(transform === `rotate(${Math.round((360 * before.playStyles.findIndex((x) => x.id === target.id)) / before.playStyles.length)}deg)`, `B. the pointer turned to it (${transform}, ~${angle}°)`);
  const toast = await text('.toast');
  note(`toast: "${toast}"`);
  if (mine && liveNow) {
    const ac = await text(tile('live'));
    const was = before.playStyles.find((x) => x.id === matchStyle).name;
    check(ac.includes(`This match: ${was}. ${target.name} from the next match.`), `B. with the match live, the note says "This match: ${was}. ${target.name} from the next match."`);
    const again = (await api('GET', '/api/live')).body;
    const still = again.matches.find((m) => m.matchId === mine.matchId);
    check(!still || (still.p1.agentId === agentId ? still.p1 : still.p2).playStyle === matchStyle, 'B. the live match still plays the style it started with');
    await shot('dial-live', tile('live'));
  } else check(false, 'B. a live match of Nova\'s to show the next-match rule on');

  // ---- C: Start / Stop ----
  console.log('\n[C] Start / Stop');
  await page.click(`${tile('live')} [data-act="auto-play"][data-on="0"]`);
  check(await until(async () => (await api('GET', '/api/play')).body.autoPlay.on === false), 'C. Stop turned auto-play off (the server\'s answer)');
  check(await until(async () => (await page.$(`${tile('live')} .tring.t-off`)) !== null), 'C. the ring shows Off');
  await shot('stopped', tile('live'));
  await page.click(`${tile('live')} [data-act="auto-play"][data-on="1"]`);
  check(await until(async () => (await api('GET', '/api/play')).body.autoPlay.on === true), 'C. Start turned it on again');
  check(await until(async () => (await page.$(`${tile('live')} .tring.t-open`)) !== null), 'C. the ring is full again (on, no time limit)');

  // ---- D: the deck switcher ----
  console.log('\n[D] the deck switcher (L)');
  const had = (await api('GET', '/api/play')).body;
  note(`deck choice ${had.deckChoice}, active ${had.activeDeck?.name}`);
  // One of Nova's own decks (not the agent's), complete: the switcher's first enabled deck button.
  const pick = await page.$eval(`${tile('live')}`, (t) => [...t.querySelectorAll('[data-act="ctl-deck"]')].find((b) => b.dataset.deck !== 'agent' && !b.disabled)?.dataset.deck ?? null);
  const pickName = had.decks.find((d) => d.deckId === pick)?.name;
  check(pick !== null, `D. a deck of Nova's own to pick (${pickName})`);
  if (pick) {
    await page.click(`${tile('live')} [data-act="ctl-deck"][data-deck="${pick}"]`);
    check(await until(async () => { const p = (await api('GET', '/api/play')).body; return p.deckChoice === 'forced' && p.activeDeck?.deckId === pick; }), `D. ${pickName} saved (deckChoice forced, that deck active)`);
    check(await until(async () => (await page.$(`${tile('live')} [data-act="ctl-deck"][data-deck="${pick}"][aria-pressed="true"]`)) !== null), 'D. it is the pressed choice');
    await shot('deck-forced', tile('live'));
  }
  await page.click(`${tile('live')} [data-act="ctl-deck"][data-deck="agent"]`);
  check(await until(async () => (await api('GET', '/api/play')).body.deckChoice === 'agent'), '"D. Your agent picks" saved back (deckChoice agent)'.replace('"D. ', 'D. "'));
  check(await until(async () => (await page.$(`${tile('live')} [data-act="ctl-deck"][data-deck="agent"][aria-pressed="true"]`)) !== null), 'D. it is the pressed choice again');
  // A blocked (incomplete) deck can't be clicked.
  const blocked = await count(`${tile('live')} [data-act="ctl-deck"][disabled]`);
  note(`${blocked} incomplete deck(s) shown disabled`);
} catch (e) {
  check(false, `the check stopped: ${e && e.stack || e}`);
}

console.log('\n[E] the page');
check(external.length === 0, `E. no external requests${external.length ? `: ${external.slice(0, 3).join(', ')}` : ''}`);
check(errors.length === 0, `E. no page errors${errors.length ? `: ${errors.slice(0, 4).join(' | ')}` : ''}`);
console.log(`\n${passes} PASS, ${fails} FAIL`);
await browser.close();
try { process.kill(-demo.pid); } catch { /* gone */ }
process.exit(fails ? 1 : 0);
