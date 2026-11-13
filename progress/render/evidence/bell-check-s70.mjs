// Render session 70: the notifications bell in the top bar. In a headless
// browser against the real owner API with the game lane's ladder playing at
// 8x (render/src/site/siteDemo.ts --ladder --speed 8; no response is
// rewritten). Every number is checked against the server's own answer.
//
//   A The bell on every page: the badge is the server's unread count, the
//     button's accessible name says it.
//   B Open: the panel shows the server's newest 20 in its order, grouped by
//     day; what it shows is marked read on the server (by id, nothing else);
//     those stay "New" while open; the badge and the Home widget follow.
//   C A kind filter shows only that kind; All brings the rest back.
//   D Show older appends the next page, nothing twice.
//   E Clear one: gone on the server; focus moves to the next one's clear.
//   F Closing: Escape (focus back on the bell), a click outside, Tab out.
//   G A new one while closed: the badge rises and the bell swings; while
//     open: the panel reads its newest again and marks it.
//   B also: Mark all read (some unread are past the first page).
//   H Clear all (Cancel keeps them and the panel open; Clear all empties).
//   I The Notifications widget's arrow opens the panel.
//   J A phone (390 wide): the top bar fits with the bell; the panel fits, no sideways scroll; the widget's
//     bell badge shows (a phone rule hid it before).
//   K No external requests; no page errors.
//
//   node progress/render/evidence/bell-check-s70.mjs [stills dir]

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
const until = async (fn, ms = 15000, step = 150) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
const chromium = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];
const external = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
// A 404 from marking an id cleared meanwhile is the one expected refusal; none is expected here.
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(url, '/')}`); });
page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
const reads = [];
page.on('request', (r) => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/notifications/read') reads.push(JSON.parse(r.postData() ?? '{}')); });

const api = (method, path, body) => page.evaluate(async ([method, path, body]) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}, [method, path, body]);
const shot = async (name, sel, p = page) => {
  const el = sel ? await p.$(sel) : null;
  try { await (el ?? p).screenshot({ path: resolve(OUT, `v2-s70-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000 }); } catch { note(`(the still "${name}" timed out)`); }
};
const server = async (q = 'limit=1') => (await api('GET', `/api/notifications?${q}`)).body;
const badge = () => page.$eval('#bell-btn', (b) => ({ text: b.querySelector('.bl-badge')?.textContent ?? '', label: b.getAttribute('aria-label'), expanded: b.getAttribute('aria-expanded') }));
const panel = () => page.$eval('#bell-panel', (p) => ({
  hidden: p.hidden,
  ids: [...p.querySelectorAll('.bl-n')].map((n) => Number(n.dataset.nid)),
  fresh: [...p.querySelectorAll('.bl-n.new')].map((n) => Number(n.dataset.nid)),
  days: [...p.querySelectorAll('.bl-day')].map((d) => d.textContent),
  pressed: p.querySelector('.bl-chip[aria-pressed="true"]')?.dataset.kind ?? null,
  head: p.querySelector('.bl-head small')?.textContent ?? '',
  older: !!p.querySelector('[data-act="bell-older"]'),
  readAll: !!p.querySelector('[data-act="bell-read-all"]'),
  text: p.innerText,
}));
const focused = () => page.evaluate(() => { const a = document.activeElement; return a ? `${a.id ? `#${a.id}` : a.tagName.toLowerCase()}${a.dataset?.act ? `[${a.dataset.act}]` : ''}${a.dataset?.nid ? `#${a.dataset.nid}` : ''}` : ''; });
const W = '#wgrid .wg[data-type="notif"]';
const widgetUnread = () => page.$eval(W, (w) => w.querySelector('.nbadge')?.textContent ?? '0').catch(() => null);

try {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');
  await api('PUT', '/api/board', { widgets: [{ id: 'w1', type: 'notif', size: 'M' }, { id: 'w2', type: 'agent', size: 'M' }] });
  await api('PUT', '/api/play/auto-play', { on: true });
  await page.reload();
  await page.waitForSelector(`${W} .nt-head, ${W} .nt-s`);
  // Enough notifications for two pages: wait for the ladder to record matches.
  check(await until(async () => (await server('limit=100')).notifications.length > 24, 8 * 60_000, 2000), 'setup: the ladder has written over 24 notifications (more than one page)');
  let s = await server('limit=100');
  note(`${s.notifications.length} notifications, ${s.unread} unread (${Object.entries(s.unreadByKind).map(([k, v]) => `${k} ${v}`).join(', ')})`);

  console.log('\n[A] the bell on every page');
  for (const p of ['home', 'stats', 'store', 'collection']) {
    await page.evaluate((h) => { location.hash = h === 'home' ? '#/' : `#/${h}`; }, p);
    await wait(400);
    const vis = await page.isVisible('#bell-btn');
    check(vis, `A. the bell is in the top bar on ${p}`);
  }
  await page.evaluate(() => { location.hash = '#/'; });
  await page.reload();
  await page.waitForSelector(`${W} .nt-head`);
  s = await server();
  check(await until(async () => (await badge()).text === (s.unread > 99 ? '99+' : String(s.unread)), 20000), `A. the badge is the server's unread count (${(await badge()).text}, server ${s.unread})`);
  let b = await badge();
  check(b.label === `Notifications, ${s.unread} unread`, `A. the button's name: "${b.label}"`);
  check(b.expanded === 'false', 'A. aria-expanded false while closed');
  await shot('bell-closed', '.topbar');

  console.log('\n[B] open: the newest 20, marked read as shown');
  await api('PUT', '/api/play/auto-play', { on: false });
  // Let the agent's match finish so nothing new arrives during B-F.
  await until(async () => !(await api('GET', '/api/play')).body.liveMatch, 4 * 60_000, 2000);
  await wait(1500);
  const before = await server('limit=20');
  const unreadBefore = before.unread;
  const shownUnread = before.notifications.filter((n) => n.readAt === null).map((n) => n.notificationId);
  reads.length = 0;
  await page.click('#bell-btn');
  check(await until(async () => (await panel()).ids.length === 20), 'B. the panel opens with 20');
  let P = await panel();
  check(JSON.stringify(P.ids) === JSON.stringify(before.notifications.map((n) => n.notificationId)), `B. in the server's order, newest first (${P.ids.slice(0, 4).join(', ')}, ...)`);
  check(P.days.length >= 1 && P.days.every((d) => ['Today', 'Yesterday', 'Earlier'].includes(d)), `B. grouped by day: ${P.days.join(', ')}`);
  check((await badge()).expanded === 'true', 'B. aria-expanded true');
  check(await focused() === '#bell-title', `B. focus on the panel's heading (${await focused()})`);
  check(await until(async () => reads.length > 0), 'B. the bell marked what it showed');
  check(reads.length === 1 && JSON.stringify([...reads[0].ids].sort((x, y) => x - y)) === JSON.stringify([...shownUnread].sort((x, y) => x - y)), `B. ...exactly the ${shownUnread.length} shown unread ids, not "all"`);
  let after = await server('limit=20');
  check(after.unread === unreadBefore - shownUnread.length, `B. the server's unread: ${unreadBefore} -> ${after.unread}`);
  check(after.notifications.every((n) => n.readAt !== null), 'B. every shown one is read on the server');
  P = await panel();
  check(JSON.stringify(P.fresh.sort()) === JSON.stringify([...shownUnread].sort()), `B. the ${P.fresh.length} that were unread stay marked New`);
  check(await until(async () => (await badge()).text === (after.unread ? String(after.unread) : '')), `B. the badge follows: "${(await badge()).text}"`);
  check(await until(async () => (await widgetUnread()) === String(after.unread)), `B. the Home widget agrees (${await widgetUnread()})`);
  check(P.readAll === (after.unread > 0), `B. Mark all read offered only while some are unread elsewhere (${after.unread})`);
  const chipRows = await page.$$eval('#bell-panel .bl-chip', (cs) => new Set(cs.map((c) => Math.round(c.getBoundingClientRect().top))).size);
  check(chipRows === 1, `B. the five filters sit on one row at 1440 (${chipRows}), with their counts`);
  await shot('bell-open', null);
  if (P.readAll) {
    await page.click('#bell-panel [data-act="bell-read-all"]');
    check(await until(async () => (await server()).unread === 0), 'B. Mark all read: the server has none unread');
    check(await until(async () => (await badge()).text === '' && /All read/.test((await panel()).head)), 'B. ...the badge is gone; "All read"');
    check(await until(async () => (await widgetUnread()) === '0'), 'B. ...the widget agrees');
    check(await focused() === '#bell-title', `B. ...focus on the heading (${await focused()})`);
  }

  console.log('\n[C] filter by kind');
  await page.click('#bell-panel .bl-chip[data-kind="matchResult"]');
  const mr = await server('limit=20&kind=matchResult');
  check(await until(async () => JSON.stringify((await panel()).ids) === JSON.stringify(mr.notifications.map((n) => n.notificationId))), `C. Match results: the server's ${mr.notifications.length} of that kind`);
  P = await panel();
  check(P.pressed === 'matchResult', 'C. the chip is pressed');
  await shot('bell-filter', '#bell-panel');
  await page.click('#bell-panel .bl-chip[data-kind="dailyPack"]');
  const dp = await server('limit=20&kind=dailyPack');
  check(await until(async () => (await panel()).ids.length === dp.notifications.length && (dp.notifications.length > 0 || /No daily pack yet/.test((await panel()).text))), `C. Daily pack: ${dp.notifications.length} (the empty words when none)`);
  await page.click('#bell-panel .bl-chip[data-kind=""]');
  check(await until(async () => (await panel()).ids.length === 20 && (await panel()).pressed === ''), 'C. All: the 20 again');

  console.log('\n[D] show older');
  P = await panel();
  check(P.older, 'D. Show older offered (the server says more)');
  const older = await server(`limit=20&before=${P.ids[P.ids.length - 1]}`);
  await page.click('#bell-panel [data-act="bell-older"]');
  check(await until(async () => (await panel()).ids.length === 20 + older.notifications.length), `D. appended the server's next ${older.notifications.length}`);
  P = await panel();
  check(new Set(P.ids).size === P.ids.length, 'D. nothing twice');
  check(JSON.stringify(P.ids.slice(20)) === JSON.stringify(older.notifications.map((n) => n.notificationId)), 'D. in order');

  console.log('\n[E] clear one');
  const gone = P.ids[1];
  const nextId = P.ids[2];
  await page.focus(`#bell-panel .bl-x[data-nid="${gone}"]`);
  await page.keyboard.press('Enter');
  check(await until(async () => !(await panel()).ids.includes(gone)), `E. #${gone} left the panel`);
  check(!(await server('limit=100')).notifications.some((n) => n.notificationId === gone), 'E. ...and the server\'s feed');
  check(await until(async () => (await focused()) === `button[bell-clear]#${nextId}`), `E. focus on the next one's clear (${await focused()})`);

  console.log('\n[F] closing');
  await page.keyboard.press('Escape');
  check(await until(async () => (await panel()).hidden), 'F. Escape closes');
  check(await focused() === '#bell-btn', `F. ...focus back on the bell (${await focused()})`);
  await page.keyboard.press('Enter');
  check(await until(async () => !(await panel()).hidden), 'F. Enter on the bell opens it');
  await page.mouse.click(700, 600);
  check(await until(async () => (await panel()).hidden), 'F. a click outside closes');
  await page.click('#bell-btn');
  await until(async () => (await panel()).ids.length > 0);
  // Tab through to the end and on: focus leaves the panel, it closes.
  let closedByTab = false;
  for (let i = 0; i < 80 && !closedByTab; i++) { await page.keyboard.press('Tab'); closedByTab = (await panel()).hidden; }
  check(closedByTab, 'F. tabbing out closes');
  await page.click('#bell-btn');
  await until(async () => (await panel()).ids.length > 0);
  await page.click('#bell-btn');
  check(await until(async () => (await panel()).hidden), 'F. the bell again closes it');

  console.log('\n[G] a new one arrives');
  await page.evaluate(() => { window.__rang = 0; new MutationObserver(() => { if (document.getElementById('bell-btn').classList.contains('ring')) window.__rang++; }).observe(document.getElementById('bell-btn'), { attributes: true, attributeFilter: ['class'] }); });
  const top0 = (await server()).notifications[0]?.notificationId ?? 0;
  await api('PUT', '/api/play/auto-play', { on: true });
  check(await until(async () => ((await server()).notifications[0]?.notificationId ?? 0) > top0, 5 * 60_000, 1000), 'G. the ladder recorded a match (a new notification)');
  s = await server();
  check(await until(async () => (await badge()).text === String(s.unread), 25000, 250), `G. the badge rises to the server's ${s.unread} within a status poll`);
  check(await page.evaluate(() => window.__rang) > 0, 'G. the bell swung for it');
  await page.click('#bell-btn');
  await until(async () => (await panel()).ids.length > 0);
  const top1 = (await server()).notifications[0].notificationId;
  check(await until(async () => ((await server()).notifications[0]?.notificationId ?? 0) > top1, 5 * 60_000, 1000), 'G. another arrives with the panel open');
  const top2 = (await server()).notifications[0].notificationId;
  check(await until(async () => (await panel()).ids[0] === top2, 25000, 250), `G. the panel reads its newest again (#${top2} at the top)`);
  check(await until(async () => (await server('limit=1')).notifications[0].readAt !== null, 5000), 'G. ...and marks it read (it was shown)');
  check((await panel()).fresh.includes(top2), 'G. ...shown New');
  await api('PUT', '/api/play/auto-play', { on: false });

  console.log('\n[H, I] the widget\'s arrow; Clear all');
  await page.keyboard.press('Escape');
  await until(async () => !(await api('GET', '/api/play')).body.liveMatch, 4 * 60_000, 2000);
  await page.click(`${W} [data-act="bell-open"]`).catch(() => {});
  check(await until(async () => !(await panel()).hidden), 'I. the Notifications widget\'s arrow opens the panel');
  await until(async () => (await panel()).ids.length > 0);
  check(await until(async () => (await server()).unread === 0 && (await badge()).text === '' && /All read/.test((await panel()).head)), 'H. opening it marked the rest: none unread, no badge, "All read"');
  await page.click('#bell-panel [data-act="bell-clear-all"]');
  await page.waitForSelector('#dialog.on .dlg');
  await page.click('#dialog [data-a="no"]');
  check(!(await panel()).hidden && (await panel()).ids.length > 0, 'H. Cancel keeps them (and the panel open)');
  await page.click('#bell-panel [data-act="bell-clear-all"]');
  await page.waitForSelector('#dialog.on .dlg');
  await page.click('#dialog [data-a="yes"]');
  check(await until(async () => /Nothing yet/.test((await panel()).text)), 'H. Clear all: the panel says nothing yet');
  check((await server('limit=100')).notifications.length === 0, 'H. ...the server\'s feed is empty');
  await shot('bell-empty', '#bell-panel');
  await page.keyboard.press('Escape');

  console.log('\n[J] a phone, and dark');
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pp = await phone.newPage();
  pp.on('pageerror', (e) => errors.push(`phone: ${String(e)}`));
  await pp.goto(url);
  await pp.waitForSelector('#signin:not([hidden])');
  await pp.fill('#si-login', 'nova');
  await pp.fill('#si-pass', 'a long demo password');
  await pp.click('#si-go');
  await pp.waitForSelector(`${W}`);
  // A new one so the widget has a count to show.
  await api('PUT', '/api/play/auto-play', { on: true });
  const top3 = (await server()).notifications[0]?.notificationId ?? 0;
  await until(async () => ((await server()).notifications[0]?.notificationId ?? 0) > top3, 5 * 60_000, 1000);
  await api('PUT', '/api/play/auto-play', { on: false });
  await pp.reload();
  await pp.waitForSelector(`${W} .nt-head`);
  const wb = await pp.$eval(`${W} .nbadge`, (e) => getComputedStyle(e).display).catch(() => 'missing');
  check(wb !== 'none' && wb !== 'missing', `J. the widget's bell badge shows on a phone (display ${wb})`);
  await pp.click('#bell-btn');
  await pp.waitForSelector('#bell-panel .bl-n');
  const fit = await pp.evaluate(() => { const r = document.getElementById('bell-panel').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, sx: document.documentElement.scrollWidth }; });
  check(fit.l >= 8 && fit.r <= fit.w - 8 && fit.sx <= fit.w, `J. the panel fits the phone (${Math.round(fit.l)}..${Math.round(fit.r)} of ${fit.w}; page ${fit.sx} wide)`);
  const bar = await pp.evaluate(() => { const t = document.querySelector('.topbar'); const a = document.getElementById('acct-btn').getBoundingClientRect(); return { sw: t.scrollWidth, cw: t.clientWidth, acct: Math.round(a.right), w: innerWidth }; });
  check(bar.sw <= bar.cw && bar.acct <= bar.w, `J. the top bar keeps the bell and the account button on screen (bar ${bar.sw}/${bar.cw}, account ends at ${bar.acct} of ${bar.w})`);
  await shot('bell-phone', null, pp);
  await pp.evaluate(() => { document.body.dataset.theme = 'dark'; });
  await wait(300);
  await shot('bell-phone-dark', null, pp);
  await phone.close();
} catch (e) {
  check(false, `the check stopped: ${e && e.stack || e}`);
}

console.log('\n[K] the page');
check(external.length === 0, `K. no external requests${external.length ? `: ${external.slice(0, 3).join(', ')}` : ''}`);
check(errors.length === 0, `K. no page errors${errors.length ? `: ${errors.slice(0, 4).join(' | ')}` : ''}`);
console.log(`\n${passes} PASS, ${fails} FAIL`);
await browser.close();
try { process.kill(-demo.pid); } catch { /* gone */ }
