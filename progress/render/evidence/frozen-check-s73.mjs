// Render session 73 (the owner's 2026-11-13 plan, item 6; render quality
// debt from session 72): once the season has ENDED the server's archive
// refuses buying, claiming and opening packs, crafting, salvage and buying
// cosmetics. Session 72 drew only Agent controls closed; the Store, the Packs,
// Store and Daily rewards widgets, the top bar's Open and the card viewer
// still offered those buttons, and each press ended in an error toast. In a
// headless browser against the real owner API with the game lane's ladder
// playing at 8x (render/src/site/siteDemo.ts --ladder --speed 8 --ends-in 3:
// the season's end time 3 server minutes ahead, so the ladder ends it while
// the page is open; no response is rewritten).
//
//   A Before the end: the Store page sells (its buttons live).
//   B The stale page: the season ends on the server while the Store page is
//     still drawn open (the page reads the season once a minute). A Buy press
//     is refused (409, the server's own words); the page reads the season at
//     once and redraws the Store closed, without a reload.
//   C The Store page closed: the line at the top, every tile greyed, every
//     buy/claim/open button off, the pity line and the reset clock gone.
//   D Home at S, M and L: the Store, Packs and Daily rewards widgets closed,
//     with the reason; the top bar's Open off, its hover saying the packs wait.
//   E The card viewer: Craft off with the reason; salvage says why.
//   F A 390 px phone: the Store closed, no sideways scroll.
//   G No external requests; no page errors (but the one 409 B asks for).
//
//   node progress/render/evidence/frozen-check-s73.mjs [stills dir]

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
const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', String(SPEED), '--ends-in', '3'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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
  try { await (el ?? page).screenshot({ path: resolve(OUT, `v2-s73-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000 }); } catch { note(`(the still "${name}" timed out)`); }
};

const W = (type) => `#wgrid .wg[data-type="${type}"]`;
const setBoard = async (widgets) => { await api('PUT', '/api/board', { widgets }); await page.goto(`${url}#/`); await page.reload(); await page.waitForSelector('#wgrid .wg'); };
/** The live (enabled) buttons for the given actions under a selector. */
const liveBtns = (sel, acts) => page.$$eval(`${sel} button`, (bs, acts) => bs.filter((b) => acts.includes(b.dataset.act) && !b.disabled).map((b) => `${b.dataset.act}:${b.textContent.trim()}`), acts);
const SELL = ['buy-packs', 'buy-cosmetic', 'claim-daily', 'open-packs'];
const seasonState = async () => (await api('GET', '/api/season')).body.state;

try {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');

  console.log('\n[A] before the end: the Store sells');
  check(await seasonState() === 'open', 'A. the server says open');
  await page.goto(`${url}#/store`);
  await page.waitForSelector('.sh-pg');
  const before = await liveBtns('.sh-pg', SELL);
  check(before.some((b) => b.startsWith('buy-packs')), `A. the Store's buttons live (${before.length}: ${before.slice(0, 4).join(', ')})`);
  check(!(await page.$('.sh-closed')), 'A. no closed line');

  console.log('\n[B] the season ends on the server; the page is still drawn open');
  const ended = await until(async () => (await seasonState()) === 'ended', 180000, 1000);
  check(ended, 'B. the ladder ended the season on its end time (GET /api/season: ended)');
  const stale = !(await page.$('.sh-closed'));
  if (!stale) note('(the page had already read the season on its minute; B is skipped, the press path is not exercised)');
  else {
    check(true, 'B. the Store page is still drawn open (the page reads the season once a minute)');
    const buy = await page.$('.sh-pg [data-act="buy-packs"]:not([disabled])');
    check(!!buy, 'B. a live Buy button on the stale page');
    const resp = page.waitForResponse((r) => r.url().endsWith('/api/packs/buy'));
    await buy.click();
    const confirm = await page.waitForSelector('#dialog.on button[data-a="yes"]', { timeout: 5000 }).catch(() => null);
    if (confirm) await confirm.click();
    const r = await resp;
    const body = await r.json().catch(() => ({}));
    check(r.status() === 409 && /season S0 has ended: no pack is bought/.test(body.error ?? ''), `B. the server refuses it: ${r.status()} "${body.error}"`);
    const toastText = await page.waitForSelector('#toast.on', { timeout: 4000 }).then((t) => t.textContent()).catch(() => null);
    check(!!toastText && /has ended/.test(toastText), `B. the toast says the server's words ("${toastText?.trim()}")`);
    const t0 = Date.now();
    const redrawn = await until(async () => !!(await page.$('.sh-closed')), 8000, 100);
    check(redrawn, `B. the page read the season at once and redrew the Store closed (${Date.now() - t0} ms after the toast, no reload)`);
    await shot('stale-redrawn', '.sh-pg');
  }

  console.log('\n[C] the Store page closed');
  await page.reload();
  await page.waitForSelector('.sh-pg .sh-closed');
  const c = await page.$eval('.sh-pg', (pg) => ({
    line: pg.querySelector('.sh-closed')?.textContent,
    tiles: pg.querySelectorAll('.sh-t').length,
    closedTiles: pg.querySelectorAll('.sh-t.closed').length,
    clocks: pg.querySelectorAll('[data-until]').length,
    sub: pg.querySelector('#sh-packs + .sh-sub')?.textContent,
    waiting: pg.querySelector('.st-closed')?.textContent,
    open: [...pg.querySelectorAll('#open1-btn, #open10-btn, [data-act="open-packs"]')].map((b) => b.disabled),
  }));
  check(c.line === 'Season ended Season 0 has ended, so the Store is closed: nothing is bought, claimed or opened in its archive. Your credits, pack points and cards stay as they are.', `C. the line: "${c.line}"`);
  check(c.tiles > 0 && c.closedTiles === c.tiles, `C. every tile greyed (${c.closedTiles} of ${c.tiles})`);
  check((await liveBtns('.sh-pg', SELL)).length === 0, 'C. no buy, claim or open button is live');
  check(c.clocks === 0, 'C. no reset clock (no next free pack this season)');
  check(c.sub === 'The pity counters stand where the season left them.', `C. the packs' line: "${c.sub}"`);
  check(/carry over to the next season and open as its packs/.test(c.waiting ?? ''), `C. the packs waiting: "${c.waiting}"`);
  check(c.open.length >= 2 && c.open.every(Boolean), `C. Open, Open 10 and Open one off (${c.open.length})`);
  await shot('store-closed', '.sh-pg');
  const owned = await api('GET', '/api/wallet');
  note(`(the wallet as the season left it: ${owned.body.credits} credits, ${owned.body.packPoints} pack points, ${owned.body.unopenedPacks.length} unopened packs)`);

  console.log('\n[D] Home at S, M and L');
  for (const size of ['S', 'M', 'L']) {
    await setBoard([{ id: 'w1', type: 'store', size }, { id: 'w2', type: 'packs', size: size === 'L' ? 'M' : size }, { id: 'w3', type: 'daily', size }]);
    await page.waitForSelector(`${W('store')} .wgb :is(.shw, .shw-s)`, { timeout: 15000 }).catch(() => null);
    await page.waitForSelector(`${W('daily')} .wgb :is(.dr-head, .dr-s)`, { timeout: 15000 }).catch(() => null);
    const liveNow = await liveBtns('#wgrid', SELL);
    check(liveNow.length === 0, `D. ${size}: no live buy, claim or open button on Home${liveNow.length ? ` (${liveNow.join(', ')})` : ''}`);
    const txt = await page.$eval('#wgrid', (g) => g.innerText);
    check(size === 'S' ? /Store closed/.test(txt) : /the Store is closed/.test(txt), `D. ${size}: the Store widget says it is closed`);
    const packsWhy = await page.$eval(`${W('packs')} [data-act="open-packs"]`, (b) => b.title);
    check(/carry over to the next season/.test(packsWhy), `D. ${size}: Packs' Open is off, its hover "${packsWhy.slice(0, 60)}…"`);
    check(/no more matches pay/.test(txt) && !/Next win/.test(txt), `D. ${size}: Daily rewards says no more matches pay`);
    const fits = await page.$$eval('#wgrid .wg', (ws) => ws.every((w) => w.scrollWidth <= w.clientWidth + 1));
    check(fits, `D. ${size}: nothing runs out of its widget sideways`);
    await shot(`home-${size}`, '#wgrid');
  }
  const ob = await page.$eval('#open-btn', (b) => ({ dis: b.disabled, title: b.title }));
  check(ob.dis && /packs waiting\. Season 0 has ended: no pack opens now/.test(ob.title), `D. the top bar's Open is off: "${ob.title}"`);

  console.log('\n[E] the card viewer');
  await page.goto(`${url}#/collection`);
  await page.waitForSelector('.bslot.held');
  await page.click('.bslot.held');
  await page.waitForSelector('.cv');
  await until(async () => !(await page.$eval('.cv', (v) => /Reading what can be salvaged/.test(v.innerText))), 6000);
  const v = await page.$eval('.cv', (el) => ({ craft: el.querySelector('#craft-btn') ? { dis: el.querySelector('#craft-btn').disabled } : null, why: el.querySelector('.cv-craft-why')?.textContent, salv: el.querySelector('#salvage-btn'), closed: el.querySelector('.cv-closed')?.textContent }));
  check(!v.craft || v.craft.dis, `E. Craft is off${v.craft ? '' : ' (this card is not craftable)'}`);
  check(/the collection is kept as it stands, so nothing is crafted or salvaged/.test((v.craft ? v.why : v.closed) ?? ''), `E. the reason: "${(v.craft ? v.why : v.closed)}"`);
  check(!v.salv, 'E. no Salvage button');
  await shot('viewer', '.cvdlg');
  await page.keyboard.press('Escape');

  console.log('\n[F] a 390 px phone');
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto(`${url}#/store`);
  await page.reload();
  await page.waitForSelector('.sh-pg .sh-closed');
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(sw <= 390, `F. no sideways scroll (${sw} px)`);
  check((await liveBtns('.sh-pg', SELL)).length === 0, 'F. nothing to press');
  await shot('store-phone');
} catch (e) {
  check(false, `the check stopped: ${e && e.stack || e}`);
}

console.log('\n[G] the page');
// B's one refusal shows twice: the response, and the browser's own console line for it.
const expected = errors.filter((e) => /HTTP 409 POST \/api\/packs\/buy/.test(e));
const echo = errors.filter((e) => /^console: Failed to load resource: the server responded with a status of 409/.test(e));
const other = errors.filter((e) => !expected.includes(e) && !echo.includes(e));
check(expected.length <= 1 && echo.length <= expected.length, `G. only the one 409 B asks for (${expected.length}; its console line ${echo.length})`);
check(external.length === 0, `G. no external requests${external.length ? `: ${external.slice(0, 3).join(', ')}` : ''}`);
check(other.length === 0, `G. no other page errors${other.length ? `: ${other.slice(0, 4).join(' | ')}` : ''}`);
console.log(`\n${passes} PASS, ${fails} FAIL`);
await browser.close();
try { process.kill(-demo.pid); } catch { /* gone */ }
