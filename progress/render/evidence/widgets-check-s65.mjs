// Render session 65: the Ladder, Rating & form and Notifications widgets at
// S, M and L (the owner's 2026-11-06 Season 0 brief, section 1), driven in a
// headless browser against the real owner API over a real store with the
// game lane's ladder playing (render/src/site/siteDemo.ts --ladder --speed 8:
// Nova and Rook with two house owners, auto-play on). Nothing is mocked.
//
//   A  The three at S, M and L, from the start of the run (the demo's warm-up
//      already gives Nova ~23 rated matches, so it is placed: the placement
//      state is unit-tested, siteStanding.test.ts). Every number drawn is
//      the server's (GET /api/ladder, /api/stats, /api/notifications); what
//      each size shows differs; nothing waits on the server, nothing reads
//      "Loading" once read, nothing overflows its widget.
//   B  Mark all read on the Notifications widget: the server's unread goes to
//      0, the badge and the button go, focus stays in the widget.
//   C  The ladder keeps playing: a match Nova finishes reaches the widget (a
//      new notification, unread again) without a reload, and once Nova has 5
//      rated matches the Ladder widget shows a rank and a tier, the server's.
//   D  Stills (light, dark, a phone); no sideways scroll on a phone; no
//      external requests; no page errors.
//
//   node progress/render/evidence/widgets-check-s65.mjs [stills dir]

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
  try { await page.screenshot({ path: resolve(OUT, `v2-s65-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000, ...opts }); } catch { note(`(the still "${name}" timed out)`); }
};
const widgetText = (type) => page.$eval(`#wgrid .wg[data-type="${type}"] .wgb`, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');

// What each of the three widgets shows, read off the page.
const readWidgets = () => page.evaluate(() => {
  const q = (t) => document.querySelector(`#wgrid .wg[data-type="${t}"]`);
  const over = (el) => { const b = el.querySelector('.wgb'); return b.scrollHeight - b.clientHeight; };
  const t = (el, sel) => el.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
  const ld = q('ladder'), fm = q('form'), nt = q('notif');
  return {
    ladder: { rank: t(ld, '.ld-k b'), of: t(ld, '.ld-k small'), rating: t(ld, '.ld-rt b'), tier: t(ld, '.ld-rt small'), badge: ld.querySelector('.tbadge')?.getAttribute('aria-label') ?? null, bar: !!ld.querySelector('.tbar i'), rows: ld.querySelectorAll('.lr').length, you: ld.querySelectorAll('.lr.you').length, tiers: ld.querySelectorAll('.tl').length, tierOn: t(ld, '.tl.on span'), line: t(ld, '.row.between span'), over: over(ld) },
    form: { rating: t(fm, '.fm-v b'), week: t(fm, '.fm-w b'), chart: !!fm.querySelector('svg.rchart polyline'), dots: fm.querySelectorAll('.rc-d').length, pips: fm.querySelectorAll('.pips .wl').length, ring: fm.querySelector('.ring.wr')?.getAttribute('aria-label') ?? null, fbars: fm.querySelectorAll('.fbars li').length, rec: fm.querySelectorAll('.fm-rec li').length, over: over(fm) },
    notif: { badge: t(nt, '.nbadge'), items: nt.querySelectorAll('.nt').length, unreadItems: nt.querySelectorAll('.nt.unread').length, mark: !!nt.querySelector('[data-act="notif-read"]'), kinds: nt.querySelectorAll('.nk-c').length, cards: nt.querySelectorAll('.mc').length, first: t(nt, '.nt .nt-m b') ?? t(nt, '.nt-s-t'), over: over(nt) },
    waits: document.querySelectorAll('#wgrid .wwait').length,
  };
});

const fmtRank = (you) => (you.rank === null ? (you.ratedMatches ? 'Placement' : 'Unranked') : `#${you.rank}`);
const fmtRating = (you) => (you.tier === 'Placement' ? '—' : String(Math.round(you.rating)));
const weekChange = (st) => { const d = Math.round(st.rating.now.rating) - Math.round(st.rating.weekAgo); return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0'; };

async function boardAt(size) {
  const put = await api('PUT', '/api/board', { widgets: [{ id: 'w1', type: 'ladder', size }, { id: 'w2', type: 'form', size }, { id: 'w3', type: 'notif', size }] });
  await page.goto(url + '#/home');
  await page.reload();
  await page.waitForSelector(`#wgrid .wg[data-type="notif"][data-size="${size}"]`);
  await until(async () => !(await page.$eval('#wgrid', (e) => e.textContent)).includes('Loading'));
  return put.status;
}

function compare(size, w, lad, st, nt) {
  const you = lad.you;
  check(w.waits === 0, `${size}. no widget says it waits on the server`);
  check(w.ladder.rank === fmtRank(you) && w.ladder.rating === fmtRating(you) && w.ladder.tier === you.tier && w.ladder.badge === `${you.tier} tier`, `${size}. Ladder: ${w.ladder.rank} ${w.ladder.rating} ${w.ladder.tier} (GET /api/ladder: rank ${you.rank}, ${you.rating.toFixed(1)}, ${you.tier}, ${you.ratedMatches} rated)`);
  check(w.form.rating === (st.rating.now.tier === 'Placement' ? '—' : String(Math.round(st.rating.now.rating))) && w.form.week === weekChange(st), `${size}. Rating & form: ${w.form.rating}, ${w.form.week} this week (GET /api/stats: ${st.rating.now.rating.toFixed(1)}, a week ago ${st.rating.weekAgo.toFixed(1)})`);
  check((nt.unread ? w.notif.badge === String(nt.unread) : w.notif.badge === null), `${size}. Notifications: the badge ${w.notif.badge ?? '(none)'} (GET /api/notifications: ${nt.unread} unread)`);
}

try {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');

  // ---- A: S, M and L ----
  console.log('\n[A] the three widgets at S, M and L');
  const seen = {};
  for (const size of ['S', 'M', 'L']) {
    const status = await boardAt(size);
    check(status === 200, `${size}. the board saved with Ladder, Rating & form and Notifications at ${size}`);
    const w = await readWidgets();
    const [lad, st, nt] = [(await api('GET', '/api/ladder')).body, (await api('GET', '/api/stats?days=30&recent=20')).body, (await api('GET', '/api/notifications?limit=20')).body];
    seen[size] = { w, lad, st, nt };
    note(`${size}: ${JSON.stringify(w)}`);
    compare(size, w, lad, st, nt);
    await shot(`widgets-${size}`);
  }
  const { S, M, L } = { S: seen.S.w, M: seen.M.w, L: seen.L.w };
  check(!S.ladder.rows && S.ladder.bar && M.ladder.rows > 0 && M.ladder.rows <= 4 && M.ladder.you === 1 && !M.ladder.tiers && L.ladder.tiers === seen.L.lad.tiers.length + 1 && L.ladder.tierOn === seen.L.lad.you.tier && L.ladder.rows > M.ladder.rows - 1, `A. Ladder S: badge, rank, rating, bar; M: + ${M.ladder.rows} rows around you (yours marked); L: + the ${L.ladder.tiers} tiers (${L.ladder.tierOn} lit) and ${L.ladder.rows} rows`);
  const ladM = seen.M.lad;
  check(ladM.standings.length === 0 || M.ladder.rows === Math.min(5, ladM.standings.length + (ladM.standings.some((r) => r.ownerId === ladM.you.ownerId) ? 0 : 1)), `A. Ladder M: the rows are the server's standings around you (${ladM.standings.length} on the list, you ${ladM.standings.some((r) => r.ownerId === ladM.you.ownerId) ? 'on it' : 'not on it'})`);
  const rated = seen.L.st.rating.chart.filter((c) => c.rated).length;
  check(!S.form.chart && M.form.chart && M.form.pips === Math.min(10, seen.M.st.recent.length) && !M.form.fbars && L.form.chart && L.form.dots === rated && L.form.fbars === 4 && L.form.pips === Math.min(20, seen.L.st.recent.length) && !!L.form.ring, `A. Rating & form S: rating and week; M: + chart and ${M.form.pips} pips; L: + ${L.form.dots} rated days on the chart (server: ${rated}), the ring "${L.form.ring}", 4 faction bars, ${L.form.rec} recent`);
  const ntL = seen.L.nt;
  check(!S.notif.items && M.notif.items === Math.min(4, seen.M.nt.notifications.length) && L.notif.items === Math.min(8, ntL.notifications.length) && L.notif.kinds === 4 && !M.notif.kinds, `A. Notifications S: bell and latest; M: ${M.notif.items} items; L: ${L.notif.items} items and the 4 kinds`);
  check(L.notif.unreadItems === ntL.notifications.slice(0, 8).filter((n) => n.readAt === null).length, `A. the unread items are the server's unread (${L.notif.unreadItems})`);
  const pullCards = ntL.notifications.slice(0, 8).filter((n) => n.kind === 'bigPull').reduce((a, n) => a + Math.min(5, n.bigPull.cards.length), 0);
  check(L.notif.cards === pullCards, `A. Notifications L draws each big pull's cards (${L.notif.cards}; server: ${pullCards})`);
  const overs = ['S', 'M', 'L'].map((s) => `${s} ${seen[s].w.ladder.over}/${seen[s].w.form.over}/${seen[s].w.notif.over}`);
  check(['S', 'M', 'L'].every((s) => seen[s].w.ladder.over <= 1 && seen[s].w.form.over <= 1 && seen[s].w.notif.over <= 1), `A. nothing overflows its widget (ladder/form/notif px: ${overs.join(', ')})`);

  // ---- B: Mark all read ----
  console.log('\n[B] Mark all read');
  await boardAt('M');
  let ntB = (await api('GET', '/api/notifications?limit=20')).body;
  if (!ntB.unread) {
    note('nothing unread yet: waiting for the ladder to finish a match of Nova\'s');
    await until(async () => (ntB = (await api('GET', '/api/notifications?limit=20')).body).unread > 0, 240000, 2000);
    await page.reload();
    await page.waitForSelector('#wgrid .wg[data-type="notif"] [data-act="notif-read"]', { timeout: 30000 }).catch(() => null);
  }
  check(ntB.unread > 0 && (await page.$('#wgrid .wg[data-type="notif"] [data-act="notif-read"]')) !== null, `B. ${ntB.unread} unread: the widget offers Mark all read`);
  await page.click('#wgrid .wg[data-type="notif"] [data-act="notif-read"]');
  await until(async () => (await page.$('#wgrid .wg[data-type="notif"] .nbadge')) === null, 10000);
  const ntB2 = (await api('GET', '/api/notifications?limit=20')).body;
  const wB = await readWidgets();
  check(ntB2.unread === 0 && wB.notif.badge === null && !wB.notif.mark && wB.notif.unreadItems === 0, `B. after it: the server's unread ${ntB2.unread}, no badge, no button, no unread item`);
  const focusIn = await page.evaluate(() => !!document.activeElement?.closest('.wg[data-type="notif"]'));
  check(focusIn, 'B. focus stays inside the Notifications widget');
  await shot('notif-read');

  // ---- C: the ladder keeps playing ----
  console.log('\n[C] a match finishing reaches the widgets without a reload; placed after 5');
  await boardAt('L');
  const before = (await api('GET', '/api/notifications?limit=20')).body;
  const topBefore = before.notifications[0]?.notificationId ?? 0;
  const arrived = await until(async () => {
    const nt = (await api('GET', '/api/notifications?limit=1')).body;
    return (nt.notifications[0]?.notificationId ?? 0) > topBefore;
  }, 300000, 2000);
  check(arrived, 'C. the ladder wrote a new notification for Nova');
  // No reload: the 15 s status poll reads the notifications again.
  const shown = await until(async () => (await page.$('#wgrid .wg[data-type="notif"] .nbadge')) !== null, 40000, 500);
  const ntC = (await api('GET', '/api/notifications?limit=20')).body;
  const wC = await readWidgets();
  check(shown && wC.notif.badge === String(ntC.unread), `C. it reached the widget without a reload: badge ${wC.notif.badge} (server ${ntC.unread} unread), latest "${wC.notif.first}"`);
  let lad = (await api('GET', '/api/ladder')).body;
  if (lad.you.ratedMatches < lad.placementMatches) {
    note(`Nova has ${lad.you.ratedMatches} rated: waiting for ${lad.placementMatches}`);
    await until(async () => (lad = (await api('GET', '/api/ladder')).body).you.ratedMatches >= lad.placementMatches, 600000, 3000);
  }
  if (lad.you.ratedMatches >= lad.placementMatches) {
    await page.reload();
    await page.waitForSelector('#wgrid .wg[data-type="ladder"] .ld-k b');
    await until(async () => !(await page.$eval('#wgrid', (e) => e.textContent)).includes('Loading'));
    lad = (await api('GET', '/api/ladder')).body;
    const st = (await api('GET', '/api/stats?days=30&recent=20')).body;
    const nt = (await api('GET', '/api/notifications?limit=20')).body;
    const w = await readWidgets();
    note(`placed: ${JSON.stringify(w.ladder)}`);
    compare('C', w, lad, st, nt);
    check(lad.you.rank !== null && w.ladder.rank === `#${lad.you.rank}` && w.ladder.of === `of ${lad.owners}` && w.ladder.tierOn === lad.you.tier, `C. placed: the Ladder shows #${lad.you.rank} of ${lad.owners} in ${lad.you.tier}, the server's`);
    check(w.ladder.over <= 1 && w.form.over <= 1 && w.notif.over <= 1, `C. placed, nothing overflows (${w.ladder.over}/${w.form.over}/${w.notif.over} px)`);
    await shot('widgets-L-placed');
    for (const size of ['S', 'M']) {
      await boardAt(size);
      const ws = await readWidgets();
      check(ws.ladder.rank === `#${(await api('GET', '/api/ladder')).body.you.rank}` && ws.ladder.over <= 1 && ws.form.over <= 1 && ws.notif.over <= 1, `C. placed at ${size}: rank ${ws.ladder.rank}, nothing overflows (${ws.ladder.over}/${ws.form.over}/${ws.notif.over} px)`);
      await shot(`widgets-${size}-placed`);
    }
  } else check(false, `C. Nova never reached ${lad.placementMatches} rated matches in the time given (${lad.you.ratedMatches})`);

  // ---- D: dark, phone ----
  console.log('\n[D] dark, phone');
  await boardAt('L');
  await page.evaluate(() => { document.body.dataset.theme = 'dark'; });
  await wait(600);
  await shot('widgets-L-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(600);
  const phone = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  check(phone.sw <= phone.w, `D. on a phone: no sideways scroll (${phone.sw} <= ${phone.w})`);
  await shot('widgets-phone', { fullPage: true });
  check(external.length === 0, `D. no external requests${external.length ? `: ${external.join(', ')}` : ''}`);
  check(errors.length === 0, `D. no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} catch (err) {
  check(false, `the run stopped: ${err && err.stack || err}`);
} finally {
  console.log(`\n${passes} PASS, ${fails} FAIL`);
  await browser.close();
  try { process.kill(-demo.pid); } catch { /* gone */ }
  process.exit(fails ? 1 : 0);
}
