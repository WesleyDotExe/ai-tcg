// Render session 47: the Store page and pack opening on the website, driven
// in a headless browser against the real owner API (render/src/site/
// siteDemo.ts: a fresh season database, the game lane's owner API
// unchanged, the site host in front). The Store page drawing the server's
// numbers; the free daily pack claimed; packs bought (1 to 10 stepper);
// pack opening full screen from the top bar, the Store and the Packs
// widget: a single pack torn and stepped through to its summary, "Open
// another", a ten-pack open with its summary buttons, Close mid-reveal,
// Esc only on the summary; every card the reveal shows checked against
// the copies the server logged for that pack; the
// account's sound setting in the frame and saved back from it; the liquid
// paused under the opening; no external requests; no page errors.
//
//   node progress/render/evidence/site-check-s47.mjs [stills dir]
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
  // The check's own refusals (a second claim, an open with none waiting) log a 409 by design.
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 409/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
  return { ctx, page };
}
const S = (page) => page.evaluate(() => window.__site.state());
const P = (page) => page.evaluate(() => { const p = window.__site.pack(); return p ? { phase: p.phase, mode: p.mode, i: p.i, packId: p.cur && p.cur.packId, cards: p.cur && p.cur.cards.length, log: p.log.map((e) => ({ kind: e.kind, idx: e.idx, via: e.via })) } : null; });
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `v2-s47-store-${name}.jpg`), type: 'jpeg', quality: 80 });
async function signIn(page) {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');
}
const token = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('aitcg.site.session')).token);
const apiGet = (page, path) => page.evaluate(async (path) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { headers: { Authorization: `Bearer ${t}` } });
  return r.json();
}, path);
const frameOf = (page) => page.frames().find((f) => f.url().endsWith('/pack-opening'));
const until = async (fn, ms = 15000, step = 80) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };

// Plays one single pack in the frame: tear (a tap), then tap through every
// card, waiting out each reveal's hold, until the summary. Returns what
// the reveal showed: each card's id and finish in the order shown, and
// whether the order was the plan's (0..n-1) with the shine slot last.
async function playSingle(page, { stopAfter = Infinity } = {}) {
  const f = frameOf(page);
  await until(async () => (await P(page))?.phase === 'pack');
  // The frame's log runs across openings: only this one's beats count.
  const from = await f.evaluate(() => window.__pack.log.length);
  const pk = await f.locator('#pack').boundingBox();
  await page.mouse.click(pk.x + pk.width / 2, pk.y + pk.height / 2);
  await until(async () => (await P(page))?.phase === 'cards');
  let guard = 0, taps = 0;
  while ((await P(page))?.phase === 'cards' && guard++ < 60) {
    if (taps >= stopAfter) return null;
    const st = await f.evaluate(() => ({ i: window.__pack.i, down: window.__pack.cur.cards[window.__pack.i]?.faceDown }));
    const box = await f.locator(`.cslot[data-k="${st.i}"]`).boundingBox().catch(() => null);
    if (!box) { await wait(100); continue; }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    taps++;
    if (st.down) {
      await until(async () => f.evaluate((k) => window.__pack.log.some((e) => (e.kind === 'landed' || e.kind === 'zeroDayArrive') && (e.idx === k || e.kind === 'zeroDayArrive')), st.i), 9000);
      await until(async () => f.evaluate(() => window.__pack.busyUntil - performance.now() <= 0), 9000);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    await wait(300);
  }
  await until(async () => (await P(page))?.phase === 'summary');
  return f.evaluate((from) => {
    const cards = window.__pack.cur.cards;
    const shown = window.__pack.log.slice(from).filter((e) => e.kind === 'cardShown').map((e) => e.idx);
    const SL = { Common: 0, Uncommon: 1, Rare: 2, shine: 3, bonus: 4 };
    const ordered = JSON.stringify(shown) === JSON.stringify(cards.map((_, k) => k)) && cards.every((c, k) => k === 0 || SL[cards[k - 1].slot] <= SL[c.slot]);
    return { ids: cards.map((c) => c.cardId + '|' + c.finish).sort(), ordered, n: cards.length, shown, slots: cards.map((c) => c.slot) };
  }, from);
}
// The copies the server logged for that pack (GET /api/packs/:id/opening), as cardId|finish.
async function loggedCards(page, packId) {
  const o = await apiGet(page, `/api/packs/${packId}/opening`);
  return o.copies.map((c) => c.cardId + '|' + c.finish).sort();
}
const same = (shown, logged) => !!shown && shown.ordered && JSON.stringify(shown.ids) === JSON.stringify(logged);
const summaryButtons = (page) => frameOf(page).$$eval('.summary .btns button', (bs) => bs.map((b) => ({ act: b.dataset.site, text: b.textContent, disabled: b.disabled, pri: b.classList.contains('pri') })));

try {
  const { ctx, page } = await open();
  await signIn(page);

  // A. The Store page draws the server's numbers.
  await page.click('#nav [data-page="store"]');
  await page.waitForSelector('.st-grid');
  let packs = await apiGet(page, '/api/packs');
  const store = await apiGet(page, '/api/store');
  const txt = await page.textContent('#page');
  check(await page.$$eval('.st-grid > section', (s) => s.length) === 5 && txt.includes('Waiting to be opened') && txt.includes('Free daily pack') && txt.includes('Recent openings') && txt.includes('Cosmetics'), 'A  the Store page has its five panels: packs and buying, the daily pack, waiting, recent openings, cosmetics');
  const big = Number(await page.textContent('.st-open .big-n'));
  check(big === packs.unopened.length && big === 11, `A  "Waiting to be opened" is the server's count (${big}; the server: ${packs.unopened.length})`);
  const rowsTxt = await page.$$eval('.st-row', (rs) => rs.map((r) => r.querySelector('b').textContent + ':' + r.querySelector('small').textContent.split(' ')[0]));
  check(JSON.stringify(rowsTxt) === JSON.stringify(['Weekly challenge:10', 'Bought:1']), `A  the waiting packs grouped by where they came from: ${rowsTxt.join(', ')}`);
  check(txt.includes(`${packs.offer[0].priceCredits} credits each`) && (await page.textContent('#buy-btn')).includes('Buy 1 pack · 100'), 'A  the price is the server\'s (100 credits) and the Buy button says it');
  check(packs.dailyPack.waiting === 1 && (await page.textContent('#claim-btn')) === 'Claim free daily pack' && !(await page.$eval('#claim-btn', (b) => b.disabled)), 'A  one free daily pack waits (a new owner\'s first day counts) and the claim is live');
  check(store.cosmetics.length > 0 && (await page.$$eval('.st-cos .si', (s) => s.length)) === store.cosmetics.length, `A  the cosmetics on sale: ${store.cosmetics.length}, as the server lists them`);
  const recentN = await page.$$eval('.st-rec', (r) => r.length);
  check(recentN === 6, `A  six recent openings, each with its cards (${recentN})`);
  await shot(page, 'page');

  // B. Claim the free daily pack.
  await page.click('#claim-btn');
  await page.waitForFunction(() => document.querySelector('#claim-btn')?.disabled === true);
  packs = await apiGet(page, '/api/packs');
  const claimLine = await page.textContent('.st-daily p');
  check(packs.dailyPack.waiting === 0 && packs.unopened.length === 12 && packs.unopened.at(-1).source === 'ownerDaily', `B  claimed: the server holds 0 waiting and a 12th pack, source ownerDaily`);
  check(/^Claimed today\. The next comes in .+ \(midnight Sydney\)\.$/.test(claimLine), `B  the line says when the next comes in: "${claimLine}"`);
  check((await page.textContent('#open-btn .ocount')) === '12', 'B  the top bar\'s Open count went to 12');
  const twice = await page.evaluate(async () => { const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token; const r = await fetch('/api/packs/daily/claim', { method: 'POST', headers: { Authorization: `Bearer ${t}` } }); return r.status; });
  check(twice === 409, 'B  a second claim the same day is refused by the server (409)');

  // C. Buy 2 with the stepper.
  const before = (await S(page)).wallet.credits;
  await page.click('[data-act="buy-step"][data-d="1"]');
  check((await page.textContent('#buy-n')) === '2' && (await page.textContent('#buy-btn')).includes('Buy 2 packs · 200'), 'C  the stepper makes it 2: "Buy 2 packs · 200"');
  for (let k = 0; k < 12; k++) await page.click('[data-act="buy-step"][data-d="1"]').catch(() => {});
  check((await page.textContent('#buy-n')) === '10' && await page.$eval('[data-act="buy-step"][data-d="1"]', (b) => b.disabled), 'C  the stepper stops at 10 (the server\'s most at once)');
  check(await page.$eval('#buy-btn', (b) => b.disabled) && /credits short/.test(await page.textContent('.st-packs')), 'C  10 packs are more than the credits: greyed, and how many credits short');
  for (let k = 0; k < 8; k++) await page.click('[data-act="buy-step"][data-d="-1"]');
  await page.click('#buy-btn');
  await page.waitForSelector('#dialog.on .dlg');
  check((await page.textContent('#dialog .dlg')).includes('2 packs for 200 credits'), 'C  a centred confirmation names the count and the total');
  await page.click('#dialog [data-a="yes"]');
  await page.waitForFunction(() => document.querySelector('.st-open .big-n')?.textContent === '14');
  const after = (await S(page)).wallet.credits;
  check(before - after === 200, `C  bought: 200 credits taken (${before} -> ${after}), 14 waiting`);

  // D. Open from the top bar: a single pack, full screen, played to its summary.
  const liqBefore = await page.evaluate(() => window.__site.liquid());
  await page.click('#open-btn');
  await page.waitForSelector('#opening:not([hidden]) iframe');
  await until(async () => (await P(page))?.phase === 'pack');
  const p1 = await P(page);
  check(!!p1 && p1.mode === 'single' && p1.cards >= 5, `D  the top bar's Open opens one pack full screen (pack ${p1?.packId?.slice(0, 8)}, ${p1?.cards} cards)`);
  packs = await apiGet(page, '/api/packs');
  check(packs.unopened.length === 13 && !packs.unopened.some((x) => x.packId === p1.packId), 'D  the server opened the oldest pack before the reveal (13 waiting; the cards are already in the collection)');
  const liq = await page.evaluate(() => window.__site.liquid());
  check(liq === null || (liq.pending === 0 && liq.pause !== 'none'), `D  the liquid behind is paused while the opening covers it (${liq ? liq.pause : 'no WebGL'})`);
  const box = await page.$eval('#opening iframe', (f) => { const r = f.getBoundingClientRect(); return [r.width, r.height]; });
  check(box[0] === 1440 && box[1] === 1000, `D  the opening fills the window (${box.join('x')})`);
  await shot(page, 'open-sealed');
  // Esc before the summary does nothing.
  await page.keyboard.press('Escape');
  await wait(200);
  check(!(await page.$eval('#opening', (e) => e.hidden)), 'D  Esc during the reveal does not close it');
  const shown1 = await playSingle(page);
  const logged1 = await loggedCards(page, p1.packId);
  check(same(shown1, logged1), `D  the reveal showed every card, in slot order (shine last), and exactly the copies the server logged for the pack: ${logged1.join(', ')}`);
  await shot(page, 'open-summary');
  let btns = await summaryButtons(page);
  check(btns.map((b) => b.text).join('|') === 'Open another|Done' && !btns[0].disabled && btns[0].pri, 'D  the summary has the website\'s buttons: "Open another" (13 wait) and "Done"');

  // E. Open another: the next pack, in the same frame.
  await frameOf(page).click('[data-site="one"]');
  await until(async () => { const x = await P(page); return x?.phase === 'pack' && x.packId !== p1.packId; });
  const p2 = await P(page);
  check(p2.packId !== p1.packId, `E  "Open another" opened the next pack (${p2.packId.slice(0, 8)})`);
  const shown2 = await playSingle(page);
  const logged2 = await loggedCards(page, p2.packId);
  check(same(shown2, logged2), 'E  and its reveal matches its logged copies too');
  if (!same(shown2, logged2)) note(`shown ${JSON.stringify(shown2)} logged ${JSON.stringify(logged2)}`);
  // F. Esc on the summary closes, and everything reads again.
  await page.keyboard.press('Escape');
  await page.waitForSelector('#opening[hidden]', { state: 'attached' });
  await page.waitForFunction(() => document.querySelector('.st-open .big-n')?.textContent === '12');
  check((await S(page)).opening === false && (await page.textContent('#open-btn .ocount')) === '12', 'F  Esc on the summary closes it; the Store and the top bar read 12 waiting');
  const recent = await apiGet(page, '/api/collection?recentPacks=1');
  const firstRec = await page.$eval('.st-rec', (r) => [...r.querySelectorAll('.mc')].map((m) => m.title.split(' · ')[0]).join(','));
  check(recent.recentPulls[0].packId === p2.packId && firstRec === recent.recentPulls[0].cards.map((c) => c.name).join(','), 'F  the newest recent opening is the pack just opened, its cards drawn');
  const focused = await page.evaluate(() => document.activeElement?.id);
  check(focused === 'open-btn', `F  focus went back to what opened it (#${focused})`);

  // G. A ten-pack open from the Store, its summary's buttons.
  await page.click('#open10-btn');
  await page.waitForSelector('#opening:not([hidden]) iframe');
  await until(async () => (await P(page))?.phase === 'fan');
  const g = await frameOf(page).evaluate(() => ({ mode: window.__pack.mode }));
  check(g.mode === 'bulk', 'G  "Open 10" plays a ten-pack open (the fan of ten)');
  const fan = await frameOf(page).locator('#fan').boundingBox();
  await page.mouse.click(fan.x + fan.width / 2, fan.y + fan.height / 2);
  // Skip ahead: the Skip button runs to the next big pull (which keeps its full reveal), then to the summary.
  for (let k = 0; k < 40; k++) {
    const ph = (await P(page))?.phase;
    if (ph === 'summary' && await frameOf(page).$('.bulk-sum')) break;
    if (ph === 'cards') { await frameOf(page).click('#skip').catch(() => {}); }
    else if (ph === 'pack') { const b = await frameOf(page).locator('#pack').boundingBox().catch(() => null); if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
    else await frameOf(page).click('#bskip').catch(() => {});
    await wait(500);
  }
  check(!!(await frameOf(page).$('.bulk-sum')), 'G  the ten-pack summary shows');
  await wait(900);
  const top = await frameOf(page).$eval('.summary', (e) => e.scrollTop);
  check(top === 0, `G  it opens at its top, the cards first (scrolled ${top} px)`);
  await shot(page, 'open-ten-summary');
  btns = await summaryButtons(page);
  const why = await frameOf(page).textContent('.summary .why').catch(() => '');
  check(btns.map((b) => `${b.text}${b.disabled ? ' (off)' : ''}`).join('|') === 'Open 10 more (off)|Open one pack|Done' && /needs 10 packs waiting; you have 2/.test(why), `G  its buttons: "Open 10 more" greyed (${why}), "Open one pack", "Done"`);
  packs = await apiGet(page, '/api/packs');
  check(packs.unopened.length === 2, 'G  the server holds 2 waiting after the ten');
  await frameOf(page).click('[data-site="done"]');
  await page.waitForSelector('#opening[hidden]', { state: 'attached' });
  check(true, 'G  "Done" closes it');

  // H. Close mid-reveal from the Packs widget on Home; the pack is opened anyway.
  await page.click('#nav [data-page="home"]');
  await page.waitForSelector('#wgrid [data-act="open-packs"][data-count="1"]:not([disabled])');
  await page.click('#wgrid [data-act="open-packs"][data-count="1"]');
  await until(async () => (await P(page))?.phase === 'pack');
  const p3 = await P(page);
  // The account's sound setting in the frame, and its mute saved back.
  let st = await frameOf(page).evaluate(() => SND.state());
  check(st !== 'muted', `H  the frame's sound follows the account (on: ${st})`);
  await frameOf(page).click('#btn-sound');
  await until(async () => (await apiGet(page, '/api/account/settings')).sound.on === false, 4000);
  const acct = await apiGet(page, '/api/account/settings');
  check(acct.sound.on === false && acct.sound.volume === 80, `H  muting in the opening saves to the account (sound ${JSON.stringify(acct.sound)})`);
  await playSingle(page, { stopAfter: 2 });
  await frameOf(page).click('#close');
  await page.waitForSelector('#opening[hidden]', { state: 'attached' });
  packs = await apiGet(page, '/api/packs');
  check(packs.unopened.length === 1 && !packs.unopened.some((x) => x.packId === p3.packId), 'H  the Packs widget\'s Open opens one; Close mid-reveal goes back, and the pack stays opened (1 waiting)');
  await page.waitForFunction(() => document.querySelector('#open-btn .ocount')?.textContent === '1');
  check(true, 'H  the top bar reads 1 waiting after the close');

  // J. The last pack, from its row in "Waiting to be opened" (a chosen
  // pack); the account's sound setting in the frame, and its mute saved back.
  await page.click('#nav [data-page="store"]');
  await page.waitForSelector('.st-open [data-act="open-packs"][data-pack]');
  const chosen = await page.$eval('.st-open [data-act="open-packs"][data-pack]', (b) => b.dataset.pack);
  await page.click('.st-open [data-act="open-packs"][data-pack]');
  await until(async () => (await P(page))?.phase === 'pack');
  check((await P(page)).packId === chosen, 'J  a row\'s "Open one" opens that pack (POST { packId })');
  st = await frameOf(page).evaluate(() => SND.state());
  check(st === 'muted', `J  the next opening reads the saved setting (${st})`);
  await playSingle(page);
  btns = await summaryButtons(page);
  const why2 = await frameOf(page).textContent('.summary .why').catch(() => '');
  check(btns[0].disabled && btns[1].pri && /No packs waiting/.test(why2), `J  with none left, "Open another" is greyed with the reason ("${why2}") and Done is the main button`);
  await frameOf(page).click('[data-site="done"]');
  await page.waitForSelector('#opening[hidden]', { state: 'attached' });
  await page.waitForFunction(() => document.querySelector('#open1-btn')?.disabled === true);
  check(await page.$eval('#open-btn', (b) => b.disabled) && await page.$eval('#open1-btn', (b) => b.disabled), 'J  no packs: the top bar\'s Open and the Store\'s Open are greyed');
  // An open the server refuses (none waiting) shows its words as a toast, and no overlay.
  await page.evaluate(() => { const b = document.querySelector('#open-btn'); b.disabled = false; b.click(); });
  await page.waitForSelector('#toast.on.error');
  const toastT = await page.textContent('#toast');
  check((await page.$eval('#opening', (e) => e.hidden)) && /pack/i.test(toastT), `J  a refused open shows the server's words and no overlay ("${toastT}")`);
  await page.evaluate(async () => { const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token; await fetch('/api/account/settings', { method: 'PATCH', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sound: { on: true } }) }); });

  // K. The frame's page: same origin, its own CSP; the site's CSP allows only it.
  const heads = await page.evaluate(async () => { const a = await fetch('/'); const b = await fetch('/pack-opening'); return [a.headers.get('content-security-policy'), b.headers.get('content-security-policy')]; });
  check(/frame-src 'self'/.test(heads[0]) && /frame-ancestors 'self'/.test(heads[1]) && !/connect-src/.test(heads[1]), 'K  CSP: the site may frame only itself; the opening may be framed only by the site and fetches nothing');

  // L. A narrow window stacks the Store's panels; dark mode.
  await page.setViewportSize({ width: 900, height: 1000 });
  await wait(300);
  const cols = await page.$$eval('.st-grid > section', (s) => new Set(s.map((x) => Math.round(x.getBoundingClientRect().left))).size);
  check(cols === 1, `L  at 900 px the Store's panels stack in one column (${cols})`);
  const over = await page.evaluate(() => document.querySelector('#page').scrollWidth - document.querySelector('#page').clientWidth);
  check(over <= 1, `L  nothing runs off the side (${over} px)`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.click('#theme-btn'); await page.click('#theme-btn');
  await wait(400);
  await shot(page, 'page-dark');
  await page.click('#theme-btn');
  await ctx.close();

  // M. Reduce motion, as another owner (Rook: the starter grant's packs, unopened).
  const r = await open({ reducedMotion: 'reduce' });
  await r.page.goto(url);
  await r.page.waitForSelector('#signin:not([hidden])');
  await r.page.fill('#si-login', 'rook');
  await r.page.fill('#si-pass', 'a long demo password');
  await r.page.click('#si-go');
  await r.page.waitForSelector('#wgrid, .wempty h3');
  await r.page.waitForSelector('#open-btn:not([disabled])');
  const rookN = Number(await r.page.textContent('#open-btn .ocount'));
  await r.page.click('#open-btn');
  await until(async () => (await P(r.page))?.phase === 'pack');
  const t0 = Date.now();
  const shownR = await playSingle(r.page);
  check(!!shownR && shownR.ordered && shownR.n >= 5, `M  under reduce motion the opening plays to its summary (another owner, ${rookN} starter packs; ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  check(JSON.stringify(shownR.ids) === JSON.stringify(await loggedCards(r.page, (await P(r.page)).packId)), 'M  and shows that owner\'s logged copies');
  await frameOf(r.page).click('[data-site="done"]');
  await r.page.waitForSelector('#opening[hidden]', { state: 'attached' });
  await r.ctx.close();

  check(external.length === 0, `N  no request left the site (${external.length})`);
  check(errors.length === 0, `N  no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
} catch (e) {
  check(false, `the run stopped: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  try { process.kill(-demo.pid, 'SIGTERM'); } catch { /* gone */ }
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
}
