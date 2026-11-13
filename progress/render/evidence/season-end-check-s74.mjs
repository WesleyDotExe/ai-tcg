// Render session 74 (a hardening pass; the season's end, the thin spots
// session 73 left in progress/render/quality-debt.md). In a headless browser
// against the real owner API with the game lane's ladder playing at 8x
// (render/src/site/siteDemo.ts --ladder --speed 8 --ends-in 6: the season's
// end time 6 server minutes ahead, so the ladder ends it while the pages are
// open; no response is rewritten). Three signed-in tabs:
//
//   A The Stats page's season line ticks on the page's clock (a tab with
//     Playwright's clock: jumped to 90 s before the end, then past it; the
//     line changes with no reload and no new read).
//   B The loadout picker left open across the end: it closes its Buy
//     buttons itself (the season read), or a Buy press is refused 409 and
//     the picker redraws closed; Equip still saves after the end.
//   C A single pack's summary left on screen across the end: its Open
//     another turns off with the reason, Done leads.
//   D Home's Daily rewards at M and L after the end: no win slot marked
//     next, the row closed, no "next pays".
//   E A 390 px phone: Home's Store, Packs and Daily rewards at S and M closed,
//     nothing to press, nothing sideways.
//   F No external requests; no page errors (but a 409 B may ask for).
//
//   node progress/render/evidence/season-end-check-s74.mjs [stills dir]

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

const SPEED = 8;
const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', String(SPEED), '--ends-in', '6'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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

async function tab({ width = 1440, height = 1000, clock = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (clock) await page.clock.install();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(url, '/')}`); });
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');
  return page;
}
const api = (page, method, path, body) => page.evaluate(async ([method, path, body]) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}, [method, path, body]);
const shot = async (page, name, sel) => {
  const el = sel ? await page.$(sel) : null;
  try { await (el ?? page).screenshot({ path: resolve(OUT, `v2-s74-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000 }); } catch { note(`(the still "${name}" timed out)`); }
};
const W = (type) => `#wgrid .wg[data-type="${type}"]`;
const SELL = ['buy-packs', 'buy-cosmetic', 'claim-daily', 'open-packs'];
const liveBtns = (page, sel, acts) => page.$$eval(`${sel} button`, (bs, acts) => bs.filter((b) => acts.includes(b.dataset.act) && !b.disabled).map((b) => `${b.dataset.act}:${b.textContent.trim()}`), acts);

// The pack frame: a single pack played to its summary by taps (as site-check-s64).
const frameOf = (page) => page.frames().find((f) => f.url().endsWith('/pack-opening'));
const P = (page) => page.evaluate(() => { const p = window.__site.pack(); return p ? { phase: p.phase, i: p.i } : null; });
async function playSingle(page) {
  await until(async () => !!frameOf(page) && (await P(page))?.phase === 'pack', 30000);
  const f = frameOf(page);
  const pk = await f.locator('#pack').boundingBox();
  await page.mouse.click(pk.x + pk.width / 2, pk.y + pk.height / 2);
  await until(async () => (await P(page))?.phase === 'cards', 60000);
  let guard = 0;
  while ((await P(page))?.phase === 'cards' && guard++ < 80) {
    await until(async () => f.evaluate(() => window.__pack.busyUntil - performance.now() <= 0), 30000);
    const st = await f.evaluate(() => ({ n: window.__pack.cur.cards.length, i: window.__pack.i }));
    if (st.i >= st.n) { await wait(150); continue; }
    const box = await f.locator(`.cslot[data-k="${st.i}"]`).boundingBox({ timeout: 5000 }).catch(() => null);
    if (!box) { await wait(100); continue; }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await wait(250);
  }
  return until(async () => (await P(page))?.phase === 'summary', 30000);
}
const summaryBtns = (page) => frameOf(page).$$eval('.summary .btns button', (bs) => bs.map((b) => ({ act: b.dataset.site, text: b.textContent, disabled: b.disabled, pri: b.classList.contains('pri') })));

let pick = null, pickFrame = null, pack = null, clockTab = null;
try {
  // ---------------------------------------------------------------- A
  console.log('\n[A] the Stats page\'s season line on the page\'s clock');
  clockTab = await tab({ clock: true });
  const s0 = (await api(clockTab, 'GET', '/api/season')).body;
  check(s0.state === 'open' && !!s0.endsAt, `A. the server says open, ending at ${s0.endsAt}`);
  await clockTab.goto(`${url}#/stats`);
  await clockTab.waitForSelector('.st-season');
  await clockTab.evaluate(() => { window.__mark74 = 1; });
  const chip = () => clockTab.$eval('.st-season b', (b) => b.textContent);
  const first = await chip();
  check(/^Ends in /.test(first), `A. the line's chip: "${first}"`);
  const pageNow = await clockTab.evaluate(() => Date.now());
  const toEnd = Date.parse(s0.endsAt) - pageNow;
  note(`(the page's clock is ${Math.round(toEnd / 1000)} s before the end time; the demo's server clock runs at ${SPEED}x)`);
  if (toEnd > 90_000) await clockTab.clock.fastForward(toEnd - 90_000);
  await wait(1500);
  const at90 = await chip();
  check(at90 === 'Ends in 1 min', `A. jumped to 90 s before the end: "${at90}" (was "${first}"), no reload`);
  await clockTab.clock.fastForward(92_000);
  await wait(1500);
  const past = await clockTab.$eval('.st-season', (p) => ({ chip: p.querySelector('b').textContent, tone: p.className, text: p.textContent }));
  check(past.chip === 'Ending now' && /t-ending/.test(past.tone), `A. past the end on the page's clock: "${past.chip}" (${past.tone})`);
  check(await clockTab.evaluate(() => window.__mark74 === 1), 'A. the same page throughout (no reload)');
  await shot(clockTab, 'stats-ending-tick', '.st-season');
  await clockTab.context().close();
  clockTab = null;

  // ---------------------------------------------------------------- B, C set-up
  console.log('\n[B, C] before the end: the picker open in one tab, a pack summary in another');
  pick = await tab();
  await pick.goto(`${url}#/store`);
  await pick.waitForSelector('.st-agents [data-act="dress"]');
  await pick.click('.st-agents [data-act="dress"]');
  await until(async () => { const f = pick.frames().find((x) => x.url().endsWith('/loadout')); return !!f && (await f.evaluate(() => !!window.__loadout && !!window.__loadout.state())); }, 20000);
  pickFrame = pick.frames().find((x) => x.url().endsWith('/loadout'));
  await pickFrame.click('.rail-slot[data-slot="coin"]');
  await wait(400);
  const buys0 = await pickFrame.$$eval('[data-buy]:not([disabled])', (bs) => bs.map((b) => b.textContent));
  check(buys0.length > 0, `B. before the end the picker's coin slot sells (${buys0.join(', ')})`);
  check(!(await pickFrame.$('#picker.is-closed')), 'B. no closed banner before the end');

  pack = await tab();
  await pack.goto(`${url}#/store`);
  await pack.waitForSelector('.sh-pg');
  await pack.click('#open-btn');
  await pack.waitForSelector('#opening:not([hidden]) iframe');
  const reached = await playSingle(pack);
  check(reached, 'C. a single pack played to its summary before the end');
  const sb0 = await summaryBtns(pack);
  check(sb0.length === 2 && sb0[0].act === 'one' && !sb0[0].disabled, `C. its "Open another" is live before the end (${sb0.map((b) => `${b.text}${b.disabled ? ' off' : ''}`).join(' | ')})`);

  // ---------------------------------------------------------------- the end
  const t0 = Date.now();
  const ended = await until(async () => (await api(pick, 'GET', '/api/season')).body.state === 'ended', 300000, 1000);
  check(ended, `the ladder ended the season on its end time (GET /api/season: ended, ${Math.round((Date.now() - t0) / 1000)} s after the set-up)`);
  const tEnd = Date.now();

  // ---------------------------------------------------------------- B
  console.log('\n[B] the loadout picker across the end');
  const live = await pickFrame.$('[data-buy]:not([disabled])');
  if (live) {
    note('(the picker had not read the end yet: the stale-press path)');
    const resp = pick.waitForResponse((r) => /\/api\/store\/cosmetics\/.+\/buy$/.test(r.url()));
    await live.click();
    const yes = await pick.waitForSelector('#dialog.on button[data-a="yes"]', { timeout: 5000 }).catch(() => null);
    if (yes) await yes.click();
    const r = await resp;
    const body = await r.json().catch(() => ({}));
    check(r.status() === 409 && /has ended/.test(body.error ?? ''), `B. the server refuses the buy: ${r.status()} "${body.error}"`);
    const toastText = await pickFrame.waitForSelector('.toast, #toast', { timeout: 4000 }).then((t) => t.textContent()).catch(() => null);
    note(`(the picker's toast: "${toastText?.trim()}")`);
  } else note('(the picker read the end before a press could be made: the read path)');
  const closedAt = await until(async () => !!(await pickFrame.$('#picker.is-closed')), 90000, 250);
  check(closedAt, `B. the picker redrew itself closed (${Math.round((Date.now() - tEnd) / 1000)} s after the end; no reload, the frame kept)`);
  const pk = await pickFrame.evaluate(() => ({
    banner: document.getElementById('livelock')?.textContent,
    slot: window.__loadout.state()?.slot,
    buys: [...document.querySelectorAll('[data-buy]')].length,
    closed: [...document.querySelectorAll('.t-closed')].map((b) => ({ text: b.textContent, dis: b.disabled, why: b.title })),
  }));
  check(pk.banner === 'Store closed Season 0 has ended, so the Store is closed: nothing more is bought. What you own still equips.', `B. the banner: "${pk.banner}"`);
  check(pk.slot === 'coin', `B. still on the owner's slot (${pk.slot})`);
  check(pk.buys === 0 && pk.closed.length > 0 && pk.closed.every((b) => b.dis && /^Closed · \d+$/.test(b.text) && /nothing more is bought/.test(b.why)), `B. no Buy left; ${pk.closed.length} tiles say ${pk.closed.map((b) => b.text).join(', ')} (off, the reason on hover)`);
  await shot(pick, 'picker-closed', '#dress');
  // Equip still saves: the slot's Equip on an owned tile not on, or the empty tile.
  const eq = await pickFrame.$('[data-equip]:not([disabled])');
  check(!!eq, 'B. an Equip button is still live on the coin slot');
  if (eq) {
    const key = await eq.getAttribute('data-equip');
    const resp = pick.waitForResponse((r) => /\/api\/agents\/.+\/loadout/.test(r.url()) && r.request().method() === 'PUT');
    await eq.click();
    const r = await resp;
    const body = await r.json().catch(() => ({}));
    const want = key === '' ? null : key;
    check(r.status() === 200 && body.loadout?.coin === want, `B. Equip after the end saves (${r.status()}, coin = ${body.loadout?.coin ?? 'empty'})`);
    const on = await until(() => pickFrame.evaluate((k) => !!document.querySelector(`.tile.equipped[data-tile="${k}"]`), key), 5000);
    check(on, 'B. the picker shows it equipped');
  }
  await pick.keyboard.press('Escape');

  // ---------------------------------------------------------------- C
  console.log('\n[C] the pack summary left on screen across the end');
  const sumOff = await until(async () => { const b = await summaryBtns(pack); return b.length > 0 && b[0].disabled; }, 90000, 250);
  check(sumOff, `C. the summary's open button turned off by itself (${Math.round((Date.now() - tEnd) / 1000)} s after the end)`);
  const sb1 = await summaryBtns(pack);
  const why = await frameOf(pack).$eval('.summary .why', (p) => p.textContent).catch(() => null);
  check(sb1.map((b) => `${b.text}:${b.disabled ? 'off' : 'on'}:${b.pri ? 'pri' : ''}`).join('|') === 'Open another:off:|Done:on:pri', `C. ${sb1.map((b) => `${b.text}${b.disabled ? ' (off)' : ''}${b.pri ? ' (leads)' : ''}`).join(', ')}`);
  check(/Season 0 has ended: no pack opens now\. Unopened packs carry over/.test(why ?? ''), `C. the reason under them: "${why}"`);
  await shot(pack, 'summary-closed');
  await frameOf(pack).click('[data-site="done"]');
  await until(async () => (await pack.$eval('#opening', (e) => e.hidden)), 8000);

  // ---------------------------------------------------------------- D
  console.log('\n[D] Daily rewards at M and L after the end');
  for (const size of ['M', 'L']) {
    await api(pack, 'PUT', '/api/board', { widgets: [{ id: 'w1', type: 'daily', size }] });
    await pack.goto(`${url}#/`);
    await pack.reload();
    await pack.waitForSelector(`${W('daily')} .dr-row`, { timeout: 15000 });
    const d = await pack.$eval(W('daily'), (w) => ({ next: w.querySelectorAll('.dr-w.next').length, closed: !!w.querySelector('.dr-row.closed'), nodes: w.querySelectorAll('.dr-w').length, paid: w.querySelectorAll('.dr-w.paid').length, text: w.innerText, titles: [...w.querySelectorAll('.dr-w:not(.paid)')].map((n) => n.title) }));
    check(d.next === 0 && d.closed, `D. ${size}: no win slot marked next, the row closed (${d.nodes} slots, ${d.paid} paid)`);
    check(d.titles.every((t) => /season has ended/.test(t)), `D. ${size}: the unpaid slots' hover says so ("${d.titles[0] ?? '(no unpaid slot)'}")`);
    check(/no more matches pay/.test(d.text) && !/Next win|next pays/.test(d.text), `D. ${size}: "no more matches pay"; no "Next win" or "next pays"`);
    await shot(pack, `daily-${size}`, W('daily'));
  }

  // ---------------------------------------------------------------- E
  console.log('\n[E] a 390 px phone: the closed Home widgets');
  await pack.setViewportSize({ width: 390, height: 860 });
  for (const size of ['S', 'M']) {
    await api(pack, 'PUT', '/api/board', { widgets: [{ id: 'w1', type: 'store', size }, { id: 'w2', type: 'packs', size }, { id: 'w3', type: 'daily', size }] });
    await pack.goto(`${url}#/`);
    await pack.reload();
    await pack.waitForSelector(`${W('store')} .wgb :is(.shw, .shw-s)`, { timeout: 15000 }).catch(() => null);
    await pack.waitForSelector(`${W('daily')} .wgb :is(.dr-head, .dr-s)`, { timeout: 15000 }).catch(() => null);
    const liveNow = await liveBtns(pack, '#wgrid', SELL);
    check(liveNow.length === 0, `E. ${size}: nothing to buy, claim or open${liveNow.length ? ` (${liveNow.join(', ')})` : ''}`);
    const sw = await pack.evaluate(() => document.documentElement.scrollWidth);
    const fits = await pack.$$eval('#wgrid .wg', (ws) => ws.map((w) => [w.dataset.type, w.scrollWidth - w.clientWidth]));
    check(sw <= 390 && fits.every(([, over]) => over <= 1), `E. ${size}: no sideways scroll (${sw} px; widgets over by ${fits.map(([t, o]) => `${t} ${o}`).join(', ')})`);
    const txt = await pack.$eval('#wgrid', (g) => g.innerText);
    check((size === 'S' ? /Store closed/.test(txt) : /the Store is closed/.test(txt)) && /no more matches pay/.test(txt), `E. ${size}: the Store and Daily rewards say why`);
    await shot(pack, `home-phone-${size}`);
  }
} catch (e) {
  check(false, `the check stopped: ${e && e.stack || e}`);
}

console.log('\n[F] the pages');
const expected = errors.filter((e) => /HTTP 409 POST \/api\/store\/cosmetics\/.+\/buy/.test(e));
const echo = errors.filter((e) => /^console: Failed to load resource: the server responded with a status of 409/.test(e));
const other = errors.filter((e) => !expected.includes(e) && !echo.includes(e));
check(expected.length <= 1 && echo.length <= expected.length, `F. at most the one 409 B may ask for (${expected.length}; its console line ${echo.length})`);
check(external.length === 0, `F. no external requests${external.length ? `: ${external.slice(0, 3).join(', ')}` : ''}`);
check(other.length === 0, `F. no other page errors${other.length ? `: ${other.slice(0, 4).join(' | ')}` : ''}`);
console.log(`\n${passes} PASS, ${fails} FAIL`);
await browser.close();
try { process.kill(-demo.pid); } catch { /* gone */ }
process.exit(fails ? 1 : 0);
