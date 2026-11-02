// Render session 46: Home as the widget board (Season 0 render item 3),
// driven in a headless browser against the real owner API (render/src/site/
// siteDemo.ts: a fresh season database, the game lane's owner API unchanged,
// the site host in front). The recommended board, the widgets drawing the
// server's numbers, Customise mode (resize, remove, add from the gallery,
// drag, arrow keys, Recommended layout, Background, Done saving to the
// account), the limits, the empty state, at most two live boards, a refused
// save, narrow-window stacking, reduce motion, a pack bought from a widget.
// Prints one line per check and writes stills.
//
//   node progress/render/evidence/site-check-s46.mjs [stills dir]
// (PW_CORE as in render/ci/browser-check.mjs, if playwright isn't found.)

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = resolve(process.argv[2] ?? resolve(ROOT, 'progress/render/evidence'));
mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); if (m.chromium) return m.chromium; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const url = await new Promise((ok, fail) => {
  let buf = '';
  demo.stdout.on('data', (d) => { buf += d; const m = /\[site-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
  demo.stderr.on('data', (d) => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
  demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
  setTimeout(() => fail(new Error('the demo took over 60 s to start')), 60000);
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
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:')) external.push(r.url()); });
  return { ctx, page };
}
const S = (page) => page.evaluate(() => window.__site.state());
const shot = (page, name, full = false) => page.screenshot({ path: resolve(OUT, `v2-s46-board-${name}.jpg`), type: 'jpeg', quality: 80, fullPage: full });
async function signIn(page) {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');
}
// Customise mode's tiles jiggle (an endless animation), so Playwright never
// finds them "stable": clicks inside them are forced.
// The page's own API, with the page's own token (what the server holds, not what the page shows).
const apiGet = (page, path) => page.evaluate(async (path) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { headers: { Authorization: `Bearer ${t}` } });
  return r.json();
}, path);
const apiPut = (page, path, body) => page.evaluate(async ([path, body]) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { method: 'PUT', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}, [path, body]);
// The tiles as drawn: id, type, size, class and box.
const tiles = (page) => page.$$eval('#wgrid .wg', (els) => els.map((e) => {
  const r = e.getBoundingClientRect();
  return { id: e.dataset.id, type: e.dataset.type, size: e.dataset.size, cls: [...e.classList].find((c) => c.startsWith('sz-')), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}));
const key = (ws) => ws.map((w) => `${w.type}:${w.size}`).join(' ');
const settle = async (page) => { await page.waitForFunction(() => !document.querySelector('.wload')); await wait(250); };

try {
  const { ctx, page } = await open();
  await signIn(page);
  await settle(page);

  // ---- A. the recommended board until saved ----
  const b0 = await apiGet(page, '/api/board');
  let t = await tiles(page);
  check(b0.recommended === true && key(t) === key(b0.widgets) && t.length === 9, `A. a new owner sees the recommended board (GET /api/board recommended: ${b0.recommended}): ${key(t)}`);
  check(await page.locator('.board-note').count() === 1, 'A. ... with the note that it is the recommended layout');
  const at = Object.fromEntries(t.map((x) => [x.type, x]));
  check(at.agent.x < at.live.x && at.agent.y === at.live.y && at.daily.y === at.store.y && at.daily.x < at.store.x && at.daily.y === at.packs.y && at.watch.y > at.daily.y && at.watch.x === at.daily.x,
    `A. it packs as the mockup does: My agent | Live match; Packs | Daily rewards, Store; Watch live under those two (agent ${at.agent.x},${at.agent.y}; daily ${at.daily.x},${at.daily.y}; store ${at.store.x},${at.store.y}; watch ${at.watch.x},${at.watch.y})`);
  const row = 66, gap = 20;
  check(Math.abs(at.daily.h - (2 * row + gap)) <= 1 && Math.abs(at.packs.h - (4 * row + 3 * gap)) <= 1 && Math.abs(at.packs.w - (2 * at.daily.w + gap)) <= 1,
    `A. S is 3 columns x 2 rows and M is 6 x 4 (S ${at.daily.w}x${at.daily.h}, M ${at.packs.w}x${at.packs.h})`);
  await shot(page, 'recommended');

  // ---- B. the widgets draw the server's numbers ----
  const daily = await apiGet(page, '/api/daily');
  const dTxt = await page.locator('.wg[data-type="daily"] .wbig-s').textContent();
  check(dTxt === `${daily.creditsFromWins}/90` && daily.rewardedWins.length >= 1, `B. Daily rewards shows ${dTxt} (GET /api/daily: ${daily.creditsFromWins} from ${daily.rewardedWins.length} rewarded wins; the schedule's paying wins add to 90)`);
  const packs = await apiGet(page, '/api/packs');
  const pHead = await page.locator('.wg[data-type="packs"] h4').textContent();
  check(pHead === `${packs.unopened.length} unopened packs`, `B. Packs shows "${pHead}" (GET /api/packs: ${packs.unopened.length} unopened)`);
  const col = await apiGet(page, '/api/collection');
  const cTxt = await page.locator('.wg[data-type="collection"] .ring + div > b').textContent();
  const s0 = col.sets[0];
  check(cTxt === `${s0.base.held}/${s0.base.total}`, `B. Collection shows ${cTxt} of the set (GET /api/collection: ${s0.base.held}/${s0.base.total})`);
  const pulls = await page.locator('.wg[data-type="collection"] .mc').count();
  check(pulls === 5, `B. ... and the last 5 pulls as placeholder card faces (${pulls})`);
  const waiting = await page.$$eval('.wg', (els) => els.filter((e) => /Waits on the server for/.test(e.textContent)).map((e) => e.dataset.type));
  // Render session 50: Live match and Watch live draw the server's live matches now (no longer waiting).
  check(JSON.stringify(waiting.sort()) === JSON.stringify(['form', 'ladder']), `B. the widgets with no data yet say what they wait on, and draw nothing made up: ${waiting.join(', ')}`);
  await page.click('.wg[data-type="packs"] .wopen');
  await page.waitForFunction(() => window.__site.state().page === 'store', null, { timeout: 3000 }).catch(() => {});
  check((await S(page)).page === 'store', 'B. a widget\'s open button opens its page (Packs -> Store)');
  await page.goBack();
  await page.waitForSelector('#wgrid');

  // ---- C. Customise mode: nothing saves until Done ----
  await page.click('[data-act="customise"]');
  const anim = await page.$eval('#wgrid .wg', (e) => getComputedStyle(e).animationName);
  const minus = await page.locator('#wgrid .wminus').count();
  check(anim === 'jig' && minus === 9 && await page.locator('#wgrid .wopen').count() === 0, `C. Customise: the tiles jiggle (${anim}), each has "−" (${minus}) and S/M/L in place of its open button`);
  await shot(page, 'customise');
  // Resize Daily rewards to Large: tall (6 x 8).
  await page.click('.wg[data-type="daily"] .sizes button[data-size="L"]', { force: true });
  t = await tiles(page);
  const dl = t.find((x) => x.type === 'daily');
  check(dl.cls === 'sz-Lt' && Math.abs(dl.h - (8 * row + 7 * gap)) <= 1, `C. S/M/L resizes: Daily rewards at L is the tall shape, 6 x 8 (${dl.w}x${dl.h})`);
  // Remove Live match.
  await page.click('.wg[data-type="live"] .wminus', { force: true });
  check(!(await tiles(page)).some((x) => x.type === 'live'), 'C. "−" removes Live match');
  // The gallery.
  await page.click('.boardbar [data-act="add"]');
  await page.waitForSelector('.wlib');
  const gal = await page.$$eval('.wli', (els) => els.map((e) => ({ t: e.dataset.add, off: e.disabled, why: e.querySelector('small').textContent })));
  const off = gal.filter((g) => g.off).map((g) => g.t).sort();
  check(gal.length === 12 && JSON.stringify(off) === JSON.stringify(['agent', 'collection', 'daily', 'form', 'ladder', 'packs', 'store']) && gal.find((g) => g.t === 'agent').why === 'Already on your board',
    `C. + Add widget: the gallery lists the 12 Season 0 widgets; the ones on the board greyed "Already on your board" (${off.join(', ')}); Live match, removed, can come back`);
  const paused = await page.$eval('#wgrid .wg', (e) => getComputedStyle(e).animationPlayState);
  check(paused === 'paused', `C. the gallery is a centred dialog, and the jiggle behind it pauses while it's open (${paused})`);
  await shot(page, 'gallery');
  await page.click('.wli[data-add="showcase"]');
  await page.waitForSelector('.wg[data-type="showcase"]');
  await page.click('.boardbar [data-act="add"]');
  await page.click('.wli[data-add="watch"]');
  await page.waitForFunction(() => document.querySelectorAll('.wg[data-type="watch"]').length === 2);
  await page.click('.boardbar [data-act="add"]');
  const w2 = await page.$eval('.wli[data-add="watch"]', (e) => ({ off: e.disabled, why: e.querySelector('small').textContent }));
  check(w2.off && w2.why === '2 already on your board', `C. Watch live can be on the board twice, then the gallery greys it: "${w2.why}"`);
  await page.keyboard.press('Escape');
  t = await tiles(page);
  check(t.at(-2).type === 'showcase' && t.at(-2).size === 'M' && t.at(-1).type === 'watch', 'C. added widgets start at M, at the end of the board');
  // Drag Showcase onto My agent's left half: before it. A real mouse drag
  // (HTML5 drag and drop), in a window tall enough that nothing scrolls.
  await page.setViewportSize({ width: 1440, height: 2600 });
  await page.evaluate(() => { document.getElementById('page').scrollTop = 0; });
  await wait(200);
  {
    const src = await page.locator('.wg[data-type="showcase"] .wgh').boundingBox();
    const dst = await page.locator('.wg[data-type="agent"]').boundingBox();
    await page.mouse.move(src.x + 60, src.y + src.height / 2);
    await page.mouse.down();
    await page.mouse.move(src.x + 80, src.y + src.height / 2, { steps: 4 });
    await page.mouse.move(dst.x + 30, dst.y + 120, { steps: 12 });
    await page.mouse.up();
  }
  await wait(200);
  await page.setViewportSize({ width: 1440, height: 1000 });
  t = await tiles(page);
  check(t[0].type === 'showcase' && t[1].type === 'agent', `C. drag and drop: Showcase dropped on My agent's left half goes before it (${t.slice(0, 3).map((x) => x.type).join(', ')}...)`);
  // Arrow keys: focus Showcase, move it one later.
  await page.focus('.wg[data-type="showcase"]');
  await page.keyboard.press('ArrowRight');
  t = await tiles(page);
  const focused = await page.evaluate(() => document.activeElement?.dataset?.type);
  check(t[0].type === 'agent' && t[1].type === 'showcase' && focused === 'showcase', 'C. the arrow keys move a focused widget one place, and it keeps the focus');
  const still = await apiGet(page, '/api/board');
  check(still.recommended === true, 'C. nothing is saved while customising (GET /api/board still the recommended layout)');
  const drafted = key(t);
  await page.click('[data-act="done"]');
  await page.waitForFunction(() => !window.__site.state().editing);
  const saved = await apiGet(page, '/api/board');
  check(saved.recommended === false && key(saved.widgets) === drafted, `C. Done saves the whole board to the account: ${key(saved.widgets)}`);
  await page.reload();
  await page.waitForSelector('#wgrid');
  await settle(page);
  check(key(await tiles(page)) === drafted, 'C. a reload draws the saved board, from the account');
  await shot(page, 'saved');
  await shot(page, 'saved-full', true);

  // ---- D. at most two live boards ----
  const live3 = [{ id: 'w1', type: 'live', size: 'L' }, { id: 'w2', type: 'watch', size: 'L' }, { id: 'w3', type: 'watch', size: 'L' }, { id: 'w4', type: 'daily', size: 'S' }];
  check((await apiPut(page, '/api/board', { widgets: live3 })).status === 200, 'D. (a board with three live widgets at L, saved over the API)');
  await page.reload();
  await page.waitForSelector('#wgrid');
  // Render session 50: the striped placeholder board is gone; a board draws only for a real live match
  // (the compact board), and this demo runs no ladder, so none draws here. The two-board limit with real
  // live matches is checked in site-check-s50.mjs (I); here: no placeholder, and the third still says it.
  const boards = await page.$$eval('.wg', (els) => els.map((e) => ({ t: e.dataset.type, board: !!e.querySelector('.lboard, .cboard'), capped: /Scoreboard only/.test(e.textContent) })));
  check(boards.filter((x) => x.board).length === 0 && boards[2].capped, `D. no live match, no board; the third live widget still says it would be a scoreboard only (${boards.map((x) => `${x.t}:${x.board ? 'board' : x.capped ? 'capped' : '-'}`).join(' ')})`);
  await shot(page, 'live-cap');

  // ---- E. a refused save keeps Customise mode and the edits ----
  await page.click('[data-act="customise"]');
  await page.click('.wg[data-type="daily"] .sizes button[data-size="M"]', { force: true });
  await page.route('**/api/board', (r) => r.request().method() === 'PUT' ? r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'widget 4: a test refusal' }) }) : r.continue());
  await page.click('[data-act="done"]');
  await page.waitForSelector('.toast.on.error');
  const toastText = await page.locator('#toast').textContent();
  const st = await S(page);
  check(st.editing && st.draft.find((w) => w.type === 'daily').size === 'M' && toastText === 'Widget 4: a test refusal.', `E. a refused save says the server's words ("${toastText}") and stays in Customise mode with the edit kept`);
  await page.unroute('**/api/board');
  // Leaving Home while customising saves, as Done does.
  await page.click('a[data-page="settings"]');
  await page.waitForFunction(() => !window.__site.state().editing);
  const left = await apiGet(page, '/api/board');
  check(left.widgets.find((w) => w.type === 'daily').size === 'M', 'E. leaving Home while customising saves the board (Daily rewards now M on the account)');
  await page.click('a[data-page="home"]');
  await page.waitForSelector('#wgrid');

  // ---- F. the empty state and Recommended layout ----
  await page.click('[data-act="customise"]');
  while (await page.locator('#wgrid .wminus').count()) await page.locator('#wgrid .wminus').first().click({ force: true });
  await page.click('[data-act="done"]');
  await page.waitForSelector('.wempty h3');
  const empty = await page.locator('.wempty h3').textContent();
  const emptySaved = await apiGet(page, '/api/board');
  check(empty === 'Your board is empty' && emptySaved.widgets.length === 0 && await page.locator('.wempty [data-act="add"]').count() === 1 && await page.locator('.wempty [data-act="use-recommended"]').count() === 1,
    'F. an empty board saves and shows "Your board is empty" with Add widget and Use recommended layout');
  await shot(page, 'empty');
  await page.click('.wempty [data-act="use-recommended"]');
  await page.waitForSelector('#wgrid');
  const back = await apiGet(page, '/api/board');
  check(key(back.widgets) === key(back.rules.recommendedWidgets) && back.recommended === false, 'F. Use recommended layout saves the recommended board');
  // In Customise mode, Recommended layout asks first.
  await page.click('[data-act="customise"]');
  await page.click('.wg[data-type="packs"] .wminus', { force: true });
  await page.click('[data-act="recommended"]');
  await page.waitForSelector('.dlg');
  const ask = await page.locator('.dlg h2').textContent();
  await page.click('.dlg [data-a="no"]');
  const kept = (await S(page)).draft.length;
  await page.click('[data-act="recommended"]');
  await page.click('.dlg [data-a="yes"]');
  const reset = (await S(page)).draft;
  check(ask === 'Use the recommended layout?' && kept === 8 && reset.length === 9, `F. Recommended layout asks first ("${ask}"): Cancel keeps the board (${kept} widgets), confirming replaces it (${reset.length})`);

  // ---- G. Customise -> Background ----
  await page.click('[data-act="background"]');
  await page.waitForSelector('.dlg #bg-picker');
  const sw = await page.locator('.dlg #bg-picker .sw').count();
  await page.click('.dlg #bg-picker .sw[data-bg="aurora"]');
  await page.waitForFunction(() => window.__site.state().settings?.background === 'aurora');
  const acct = await apiGet(page, '/api/account/settings');
  check(sw === 8 && acct.background === 'aurora', `G. Customise -> Background: the picker's ${sw} backgrounds; Aurora picked is saved to the account (${acct.background})`);
  await shot(page, 'background');
  await page.keyboard.press('Escape');
  await page.click('[data-act="done"]');
  await page.waitForFunction(() => !window.__site.state().editing);

  // ---- H. buying a pack from a widget ----
  const before = await apiGet(page, '/api/wallet');
  await page.click('.wg[data-type="packs"] [data-act="buy-packs"]');
  await page.waitForSelector('.dlg');
  const askBuy = await page.locator('.dlg p').textContent();
  await page.click('.dlg [data-a="yes"]');
  await page.waitForFunction((n) => window.__site.state().wallet.unopenedPacks.length === n, before.unopenedPacks.length + 1);
  await settle(page);
  const after = await apiGet(page, '/api/wallet');
  const head = await page.locator('.wg[data-type="packs"] h4').textContent();
  const count = await page.locator('#open-btn .ocount').textContent();
  check(after.credits === before.credits - 100 && head === `${after.unopenedPacks.length} unopened packs` && count === String(after.unopenedPacks.length),
    `H. Buy in the Packs widget asks first ("${askBuy}"), then the pack is bought: credits ${before.credits} -> ${after.credits}, the widget and the Open button both say ${after.unopenedPacks.length}`);

  // ---- I. dark, and a board of Large widgets ----
  const large = [{ id: 'w1', type: 'agent', size: 'L' }, { id: 'w2', type: 'packs', size: 'L' }, { id: 'w3', type: 'daily', size: 'L' }, { id: 'w4', type: 'showcase', size: 'M' }, { id: 'w5', type: 'collection', size: 'L' }, { id: 'w6', type: 'store', size: 'L' }];
  await apiPut(page, '/api/board', { widgets: large });
  await page.reload();
  await page.waitForSelector('#wgrid');
  await settle(page);
  await shot(page, 'large-full', true);
  await page.click('.wg[data-type="collection"] .pill[data-f="Cortex"]');
  const cortexOnly = await page.$$eval('.wg[data-type="collection"] .mbinder .mc', (els) => els.length);
  check(cortexOnly > 0 && await page.locator('.wg[data-type="collection"] .pill.on').textContent() === 'Cortex', `I. the Large Collection widget's faction filter (Cortex: ${cortexOnly} cards held)`);
  await page.click('#theme-btn'); // system -> light
  await page.click('#theme-btn'); // light -> dark
  await wait(300);
  await shot(page, 'large-dark');

  // ---- J. narrow windows stack in the owner's order ----
  await apiPut(page, '/api/board', { widgets: [{ id: 'w1', type: 'daily', size: 'S' }, { id: 'w2', type: 'packs', size: 'M' }, { id: 'w3', type: 'store', size: 'S' }, { id: 'w4', type: 'agent', size: 'M' }, { id: 'w5', type: 'collection', size: 'S' }] });
  await page.reload();
  await page.waitForSelector('#wgrid');
  await settle(page);
  const wide = await tiles(page);
  const readingOrder = (ts) => ts.every((x, i) => i === 0 || x.y > ts[i - 1].y || (x.y === ts[i - 1].y && x.x > ts[i - 1].x));
  check(!readingOrder(wide), `J. (wide, dense packing lets the Small Store fill the hole beside Daily rewards: ${wide.map((x) => `${x.type}@${x.x},${x.y}`).join(' ')})`);
  await page.setViewportSize({ width: 1000, height: 900 });
  await wait(300);
  const six = await tiles(page);
  check(readingOrder(six), `J. at 1000 px (6 columns) the widgets read in the owner's order: ${six.map((x) => x.type).join(', ')}`);
  await shot(page, 'narrow-1000');
  await page.setViewportSize({ width: 700, height: 900 });
  await wait(300);
  const one = await tiles(page);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(one.every((x, i) => i === 0 || x.y > one[i - 1].y) && new Set(one.map((x) => x.x)).size === 1 && over <= 0, `J. at 700 px one column, top to bottom in the owner's order, nothing spills sideways (${over} px)`);
  await shot(page, 'narrow-700');
  await ctx.close();

  // ---- K. reduce motion: no jiggle, a dashed outline instead ----
  {
    const b = await open({ reducedMotion: 'reduce' });
    await signIn(b.page);
    await b.page.click('[data-act="customise"]');
    const k = await b.page.$eval('#wgrid .wg', (e) => ({ a: getComputedStyle(e).animationName, o: getComputedStyle(e).outlineStyle }));
    check(k.a === 'none' && k.o === 'dashed', `K. under reduce motion the tiles don't jiggle in Customise mode (${k.a}); a dashed outline marks them (${k.o})`);
    await b.ctx.close();
  }

  check(errors.length === 0, `Z. no page errors (${errors.length}${errors.length ? ': ' + errors[0] : ''})`);
  check(external.length === 0, `Z. no request leaves the site's origin (${external.length})`);
} catch (err) {
  fails++;
  console.log('FAIL  the run stopped: ' + (err && err.stack || err));
} finally {
  await browser.close();
  try { process.kill(-demo.pid, 'SIGTERM'); } catch { demo.kill('SIGTERM'); }
}
console.log(`\n${passes} passed, ${fails} failed: ${fails ? 'FAIL' : 'ALL PASS'}`);
process.exit(fails ? 1 : 0);
