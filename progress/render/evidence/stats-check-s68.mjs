// Render session 68: the Stats page (the 2026-10-05 spec's Stats page on
// `GET /api/stats`, with `today`, and the season ladder inside it), driven in
// a headless browser against the real owner API over a real store with the
// game lane's ladder playing (render/src/site/siteDemo.ts --ladder --speed 8).
// Nothing is mocked.
//
//   A  The page's figures are the server's: GET /api/stats (all agents, 30
//      days, 20 recent) and GET /api/ladder, read beside the page: the
//      totals, the rating and its week, the chart's rated days and the day
//      columns, the factions, the recent rows, today's earnings, the ladder's
//      rows and the owner's lit row.
//   B  The filter: an agent pill asks the server for that agent (the totals
//      follow it, the rating doesn't), "All agents" goes back; 7 and 90 days
//      redraw the chart with the server's days.
//   C  The ladder keeps playing: a match of Nova's ends and the page shows
//      it (matches + 1) with no reload.
//   D  A recent result's Replay opens the replay; Close comes back to the page.
//   E  The reset clock ticks.
//   F  Stills (light, dark, a phone); no sideways scroll; no external
//      requests; no page errors.
//
//   node progress/render/evidence/stats-check-s68.mjs [stills dir]

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
const statsAsks = [];
page.on('request', (r) => { const u = r.url(); if (u.includes('/api/stats')) statsAsks.push(u.replace(url, '/')); });

const api = (method, path, body) => page.evaluate(async ([method, path, body]) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}, [method, path, body]);
const shot = async (name, opts = {}) => {
  try { await page.screenshot({ path: resolve(OUT, `v2-s68-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000, ...opts }); } catch { note(`(the still "${name}" timed out)`); }
};

/** What the page shows, read from the DOM. */
const readPage = () => page.evaluate(() => {
  const t = (sel, root = document) => root.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
  const tiles = Object.fromEntries([...document.querySelectorAll('.st-t')].map((e) => [e.querySelector('span').textContent, e.querySelector('b').textContent]));
  const fac = (i) => [...document.querySelectorAll('.st-fac')[i]?.querySelectorAll('li') ?? []].map((li) => ({ f: li.querySelector('.ftag').textContent, p: li.querySelector('.st-fp').textContent, r: li.querySelector('.st-fr').textContent }));
  const pressed = [...document.querySelectorAll('[data-act="stats-agent"][aria-pressed="true"]')].map((e) => e.dataset.agent);
  const days = document.querySelector('#stats-days [aria-pressed="true"]')?.dataset.v ?? null;
  return {
    rating: t('.st-rv b'), rmeta: t('.st-rv small'), week: t('.st-wk b'), tierLine: t('.st-tier span'),
    tiles, ring: document.querySelector('.st-ring')?.getAttribute('aria-label') ?? null,
    chartDots: document.querySelectorAll('.st-hero .rchart .rc-d').length, chartLabel: document.querySelector('.st-hero .rchart')?.getAttribute('aria-label') ?? null,
    cols: document.querySelectorAll('.dcols g').length, colW: document.querySelectorAll('.dcols .dc-w').length, colL: document.querySelectorAll('.dcols .dc-l').length,
    fac0: fac(0), fac1: fac(1),
    recent: document.querySelectorAll('.st-rec .hrow').length, replays: document.querySelectorAll('.st-rec [data-act="replay"]').length,
    today: { earned: t('.st-today .dr-tot b'), ring: document.querySelector('.st-today .dr-ring')?.getAttribute('aria-label') ?? null, rewarded: t('.st-today .dr-rwn'), clock: t('.st-today .sh-clock'), until: document.querySelector('.st-today .sh-clock')?.dataset.until ?? null },
    ladderRows: document.querySelectorAll('.ltable tbody tr:not(.lt-gap)').length, you: t('.ltable tr[aria-current="true"] .lt-k'), youCount: document.querySelectorAll('.ltable tr[aria-current="true"]').length,
    spread: document.querySelector('.st-spread')?.getAttribute('aria-label') ?? null,
    pills: document.querySelectorAll('[data-act="stats-agent"]').length, pressed, days,
    busy: !!document.querySelector('.st-busy'), banner: t('.banner'),
  };
});
const pct = (t) => (t.wins + t.losses + t.draws ? `${Math.round(t.winRate * 100)}%` : '—');
const signedW = (d) => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0');

let REPLAYS = {};
const readReplays = async () => { REPLAYS = Object.fromEntries((await api('GET', '/api/matches?limit=50')).body.matches.map((m) => [m.matchId, m.hasReplay])); };

function compare(tag, p, s, l) {
  const T = s.totals;
  check(p.tiles.matches === String(T.matches) && p.tiles.wins === String(T.wins) && p.tiles.losses === String(T.losses) && p.tiles.draws === String(T.draws), `${tag}. totals ${p.tiles.matches} matches ${p.tiles.wins}W ${p.tiles.losses}L ${p.tiles.draws}D (server ${T.matches} / ${T.wins}W ${T.losses}L ${T.draws}D)`);
  check(p.tiles['best streak'] === String(T.bestWinStreak) && p.tiles['credits from matches'] === T.creditsFromMatches.toLocaleString('en-US'), `${tag}. best streak ${p.tiles['best streak']}, credits from matches ${p.tiles['credits from matches']} (server ${T.bestWinStreak}, ${T.creditsFromMatches}); streak now "${p.tiles['streak now']}" (server ${JSON.stringify(T.currentStreak)})`);
  check(p.ring?.startsWith(pct(T)) || (pct(T) === '—' && p.ring === 'No decided match yet'), `${tag}. win rate ring "${p.ring}" (server ${pct(T)})`);
  const placed = s.rating.now.tier !== 'Placement';
  const wk = Math.round(s.rating.now.rating) - Math.round(s.rating.weekAgo);
  check(p.rating === (placed ? String(Math.round(s.rating.now.rating)) : '—') && p.week === signedW(wk), `${tag}. rating ${p.rating} (${p.rmeta}), week ${p.week} (server ${s.rating.now.rating.toFixed(1)} ${s.rating.now.tier}, a week ago ${s.rating.weekAgo.toFixed(1)})`);
  const rated = s.rating.chart.filter((c) => c.rated).length;
  const withRes = s.rating.chart.filter((c) => c.wins + c.losses + c.draws).length;
  check(p.chartDots === rated && p.cols === withRes && p.colW === s.rating.chart.filter((c) => c.wins).length && p.colL === s.rating.chart.filter((c) => c.losses).length, `${tag}. chart "${p.chartLabel}": ${p.chartDots} rated days, ${p.cols} day columns (${p.colW} with wins, ${p.colL} with losses) (server ${s.rating.chart.length} days, ${rated} rated, ${withRes} with results)`);
  const facOk = (rows, srv) => rows.length === 4 && rows.every((r, i) => r.f === srv[i].faction.toUpperCase() && r.p === pct(srv[i]));
  check(facOk(p.fac0, s.byFaction) && facOk(p.fac1, s.byOpponentFaction), `${tag}. factions: deck ${p.fac0.map((r) => `${r.f} ${r.p}`).join(', ')}; against ${p.fac1.map((r) => `${r.f} ${r.p}`).join(', ')}`);
  const shown = s.recent.slice(0, 8);
  const want = shown.filter((r) => r.result !== 'cancelled' && REPLAYS[r.matchId] === true).length;
  check(p.recent === shown.length && p.replays === want, `${tag}. recent: ${p.recent} rows shown, ${p.replays} Replay (server ${s.recent.length} recent; of the newest ${shown.length}, ${want} have a replay in GET /api/matches)`);
  const d = s.today;
  check(p.today.earned === String(d.credits) && p.today.ring?.startsWith(`${d.creditsFromWins} of`) && p.today.rewarded === `${d.rewardedWins.length}/10` && p.today.until === d.resetsAt, `${tag}. today: earned ${p.today.earned}, ring "${p.today.ring}", rewarded ${p.today.rewarded}, reset ${p.today.until} (server today ${d.credits}, ${d.creditsFromWins} from ${d.wins.length} wins, resets ${d.resetsAt})`);
  if (l) {
    const youIn = l.standings.some((r) => r.ownerId === l.you.ownerId);
    check(p.ladderRows === l.standings.length + (youIn ? 0 : 1) && p.youCount === 1 && p.you === (l.you.rank === null ? '—' : String(l.you.rank)), `${tag}. ladder: ${p.ladderRows} rows, the owner's lit at ${p.you} (server ${l.standings.length} listed, you ${l.you.rank ?? 'unranked'} ${l.you.tier}); spread "${p.spread}"`);
  }
}

try {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');

  // ---- A: the page against the server ----
  console.log('[A] the Stats page against GET /api/stats and GET /api/ladder');
  await page.click('#nav [data-page="stats"]');
  await page.waitForSelector('.st-hero');
  check(await page.evaluate(() => location.hash) === '#/stats' && !(await page.$('.waits-hero')), 'A. the sidebar\'s Stats opens the page (no "waiting on the server")');
  const s30 = (await api('GET', '/api/stats?days=30&recent=20')).body;
  const lad = (await api('GET', '/api/ladder?limit=100')).body;
  await readReplays();
  const p0 = await readPage();
  note(`server: ${s30.totals.matches} matches, ${s30.agents.length} agents (${s30.agents.map((a) => `${a.name} ${a.matches}`).join(', ')}), ${lad.owners} owners rated`);
  compare('A', p0, s30, lad);
  check(statsAsks[0]?.includes('days=30') && statsAsks[0]?.includes('recent=20') && !statsAsks[0]?.includes('agent='), `A. the page asked ${statsAsks[0]}`);
  await shot('stats-L-top');
  await page.setViewportSize({ width: 1440, height: 2300 });
  await wait(400);
  await shot('stats-L');
  await page.setViewportSize({ width: 1440, height: 1000 });

  // ---- B: the filter ----
  console.log('\n[B] the filter');
  check(p0.pills === s30.agents.length + 1 && p0.pressed.join() === '' && p0.days === '30', `B. ${p0.pills} agent pills (server ${s30.agents.length} agents + All), All pressed, 30 days pressed`);
  const second = s30.agents[1] ?? s30.agents[0];
  await page.click(`[data-act="stats-agent"][data-agent="${second.agentId}"]`);
  await until(async () => (await readPage()).pressed.join() === second.agentId && !(await readPage()).busy);
  const sA = (await api('GET', `/api/stats?agent=${second.agentId}&days=30&recent=20`)).body;
  const pA = await readPage();
  check(statsAsks.at(-1).includes(`agent=${second.agentId}`), `B. the pill asked ${statsAsks.at(-1)}`);
  compare(`B ${second.name}`, pA, sA, lad);
  check(pA.rating === p0.rating, `B. the rating stays the owner's under the filter (${pA.rating} = ${p0.rating})`);
  check((await page.textContent('.st-hero')).includes(`${second.name}'s`), 'B. the page says the rating is the owner\'s, the rest the agent\'s');
  await page.click('[data-act="stats-agent"][data-agent=""]');
  await until(async () => (await readPage()).pressed.join() === '' && !(await readPage()).busy);
  for (const d of [7, 90]) {
    await page.click(`#stats-days [data-v="${d}"]`);
    await until(async () => (await readPage()).days === String(d) && !(await readPage()).busy && (await readPage()).chartLabel?.includes(`over ${d} days`));
    const sd = (await api('GET', `/api/stats?days=${d}&recent=20`)).body;
    const pd = await readPage();
    check(sd.rating.chart.length === d && pd.chartLabel?.startsWith(`Rating over ${d} days`) && pd.cols === sd.rating.chart.filter((c) => c.wins + c.losses + c.draws).length && statsAsks.at(-1).includes(`days=${d}`), `B. ${d} days: "${pd.chartLabel}", ${pd.cols} day columns (server ${sd.rating.chart.length} days)`);
    if (d === 90) await shot('stats-90-days');
  }
  await page.click('#stats-days [data-v="30"]');
  await until(async () => (await readPage()).days === '30' && !(await readPage()).busy);

  // ---- E: the reset clock ticks ----
  console.log('\n[E] the reset clock');
  const c1 = (await readPage()).today.clock;
  await wait(2200);
  const c2 = (await readPage()).today.clock;
  check(c1 && c2 && c1 !== c2, `E. the reset clock ticks (${c1} -> ${c2})`);

  // ---- C: a match ends while the page is open ----
  console.log('\n[C] the ladder keeps playing');
  const before = (await readPage()).tiles.matches;
  const ok = await until(async () => (await readPage()).tiles.matches !== before, 240000, 1000);
  const sAfter = (await api('GET', '/api/stats?days=30&recent=20')).body;
  await readReplays();
  const pAfter = await readPage();
  check(ok && pAfter.tiles.matches === String(sAfter.totals.matches) && Number(pAfter.tiles.matches) === Number(before) + 1, `C. a match of Nova's ended and the page shows it with no reload (${before} -> ${pAfter.tiles.matches}; server ${sAfter.totals.matches})`);
  if (ok) compare('C', pAfter, sAfter, (await api('GET', '/api/ladder?limit=100')).body);

  // "Show all" opens the rest of the 20 and folds them back.
  const nAll = (await api('GET', '/api/stats?days=30&recent=20')).body.recent.length;
  if (nAll > 8) {
    await page.click('[data-act="stats-recent"]');
    const opened = (await readPage()).recent;
    await page.click('[data-act="stats-recent"]');
    const folded = (await readPage()).recent;
    check(opened === nAll && folded === 8, `C. "Show all ${nAll}" shows ${opened} rows, "Show fewer" ${folded}`);
  }

  // ---- D: Replay from a recent result ----
  console.log('\n[D] Replay from a recent result');
  const first = await page.$('.st-rec [data-act="replay"]');
  if (first) {
    const mid = await first.getAttribute('data-match');
    await first.click();
    const opened = await until(async () => !!(await page.$('#replay:not([hidden]) iframe')), 60000, 300);
    check(opened, `D. Replay opens the replay of ${mid}`);
    await wait(1500);
    await shot('stats-replay');
    await page.click('#replay .rp-close');
    const closed = await until(async () => !!(await page.$('#replay[hidden]')) && !!(await page.$('.st-hero')), 5000);
    check(closed, 'D. Close comes back to the Stats page');
  } else check(false, 'D. no Replay button on the page');

  // ---- F: dark, phone, hygiene ----
  console.log('\n[F] dark, phone');
  const wide = await page.evaluate(() => ({ sw: document.querySelector('#page').scrollWidth, w: document.querySelector('#page').clientWidth }));
  check(wide.sw <= wide.w, `F. desktop: no sideways scroll in the page (${wide.sw} <= ${wide.w})`);
  await page.evaluate(() => { document.body.dataset.theme = 'dark'; });
  await page.setViewportSize({ width: 1440, height: 2300 });
  await wait(400);
  await shot('stats-L-dark');
  await page.evaluate(() => { document.body.dataset.theme = 'light'; });
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(600);
  const phone = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth, psw: document.querySelector('#page').scrollWidth, pw: document.querySelector('#page').clientWidth, table: (() => { const w = document.querySelector('.lt-wrap'); return w ? w.scrollWidth - w.clientWidth : 0; })() }));
  const wideEls = await page.evaluate(() => { const r = document.querySelector('#page').getBoundingClientRect().right; return [...document.querySelectorAll('#page *')].filter((e) => e.getBoundingClientRect().right > r + 0.5 && !e.closest('.lt-wrap')).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`); });
  if (wideEls.length) note(`past the page's edge: ${wideEls.join(', ')}`);
  check(phone.sw <= phone.w && phone.psw <= phone.pw && phone.table <= 0, `F. on a phone: no sideways scroll (${phone.sw} <= ${phone.w}; the page ${phone.psw} <= ${phone.pw}); the ladder table ${phone.table} px past its box`);
  await page.setViewportSize({ width: 390, height: 3600 });
  await wait(400);
  await shot('stats-phone');
  check(external.length === 0, `F. no external requests (${external.length})`);
  check(errors.length === 0, `F. no page errors (${errors.length})${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
} catch (e) {
  check(false, `the run threw: ${e?.stack ?? e}`);
} finally {
  console.log(`\n${passes} PASS, ${fails} FAIL`);
  await browser.close();
  try { process.kill(-demo.pid); } catch { /* gone */ }
  process.exit(fails ? 1 : 0);
}
