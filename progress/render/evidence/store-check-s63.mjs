// Render session 63: the store layout (the owner's 2026-11-06 Season 0
// brief, section 2) and the Store and Packs widgets at S, M and L (section
// 1's table), driven in a headless browser against the real owner API over
// a real store (render/src/site/siteDemo.ts: Nova, 422 credits, 11 packs
// waiting, the free daily pack waiting). Nothing is mocked.
//
//   A  The Store page: tiles of different sizes, exactly one featured (the
//      free daily pack while it waits), the pack art drawn from the pack
//      opening's own plate, every price on its tile with the credits icon and
//      equal to GET /api/store's, a button under every tile; the balance; the
//      countdown equal to the server's resetsAt and ticking each second.
//   B  Claim from the featured tile: the server says the pack waits, the
//      10 packs become the featured tile, the daily tile greys "Claimed today".
//   C  Buy 1 pack from its tile: confirm, the credits drop by the server's
//      price, one more pack waits; buy a cosmetic: it turns Owned; the
//      tiles the owner can no longer afford grey with how many credits short.
//   D  The Store and Packs widgets at S, M and L: what each size shows
//      differs (claim / tiles / tiles + cosmetics + balance; pack + Open /
//      + Open 10 + pity / + last pulls), the numbers are the server's.
//   E  Stills: the page light, dark and on a phone; the widgets at each size.
//      No external requests; no page errors.
//
//   node progress/render/evidence/store-check-s63.mjs [stills dir]

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

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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
const shot = async (name, opts = {}) => {
  try { await page.screenshot({ path: resolve(OUT, `v2-s63-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000, ...opts }); } catch { note(`(the still "${name}" timed out)`); }
};
const text = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const count = (sel) => page.$$eval(sel, (x) => x.length);
const tiles = () => page.$$eval('#page .sh-t', (ts) => ts.map((t) => {
  const r = t.getBoundingClientRect(), b = t.querySelector('.sh-buy'), a = t.querySelector('.sh-art'), p = t.querySelector('.sh-price');
  return {
    id: t.dataset.tile, size: [...t.classList].find((c) => c.startsWith('t-')), w: Math.round(r.width), h: Math.round(r.height),
    price: p ? p.textContent.replace(/\D/g, '') : null, free: !!(p && p.classList.contains('free')), coinIcon: !!(p && p.querySelector('.coin')),
    btn: b ? b.textContent.trim() : null, enabled: b ? !b.disabled : null, btnBelowArt: b && a ? b.getBoundingClientRect().top >= a.getBoundingClientRect().bottom : false,
    plate: !!t.querySelector('.spk .pa svg polyline'), coin: !!t.querySelector('canvas[data-coin][data-painted]'), emblem: !!t.querySelector('.sh-emb use'),
    why: t.querySelector('.sh-why')?.textContent ?? null, badge: t.querySelector('.sh-badge')?.textContent ?? null,
  };
}));
const confirmYes = async () => { await page.waitForSelector('#dialog .dlg [data-a="yes"]'); await page.click('#dialog .dlg [data-a="yes"]'); };

try {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');

  // ---- A: the Store page ----
  console.log('\n[A] the Store page');
  await page.goto(url + '#/store');
  await page.waitForSelector('#page .sh-grid .sh-t');
  await until(async () => (await count('#page canvas[data-coin][data-painted]')) === (await count('#page canvas[data-coin]')));
  const store = (await api('GET', '/api/store')).body;
  const packs = (await api('GET', '/api/packs')).body;
  let t = await tiles();
  const byId = (id) => t.find((x) => x.id === id);
  note(t.map((x) => `${x.id} ${x.size} ${x.w}x${x.h} price=${x.free ? 'Free' : x.price} btn="${x.btn}"${x.enabled ? '' : ' (greyed)'}`).join('\n      '));
  check(t.filter((x) => x.size === 't-feature').length === 1 && byId('daily').size === 't-feature', `A. exactly one featured tile, the free daily pack (${packs.dailyPack.waiting} waiting)`);
  const feat = byId('daily'), one = byId('pack-1');
  check(feat.w > one.w * 1.8 && feat.h >= one.h - 2, `A. the featured tile is larger: ${feat.w}x${feat.h} beside ${one.w}x${one.h}`);
  check(new Set(t.map((x) => `${x.w}x${x.h}`)).size >= 3, `A. tiles of different sizes (${[...new Set(t.map((x) => `${x.w}x${x.h}`))].join(', ')})`);
  const price = store.packs[0].priceCredits;
  check(Number(one.price) === price && Number(byId('pack-10').price) === price * 10, `A. the pack prices are the server's: 1 pack ${one.price}, 10 packs ${byId('pack-10').price} (GET /api/store: ${price} each)`);
  check(store.cosmetics.every((c) => Number(byId(`cos-${c.itemId}`)?.price) === c.priceCredits), `A. every cosmetic's price on its tile is the server's (${store.cosmetics.length} on sale)`);
  check(t.filter((x) => x.price && !x.free).every((x) => x.coinIcon), 'A. every price has the credits icon; the daily pack says Free');
  check(t.every((x) => x.btn && x.btnBelowArt), `A. a button under the art on all ${t.length} tiles`);
  check(['daily', 'pack-1', 'pack-10'].every((id) => byId(id).plate), 'A. every pack tile draws the pack opening\'s plate (its circuit field)');
  check(store.cosmetics.filter((c) => c.kind === 'coin').every((c) => byId(`cos-${c.itemId}`).coin) && store.cosmetics.filter((c) => c.kind === 'boast').every((c) => byId(`cos-${c.itemId}`).emblem), 'A. coins painted by the coin painter, boasts with the loadout picker\'s emblems');
  const credits0 = (await api('GET', '/api/wallet')).body.credits;
  check((await text('#page .sh-bal')).includes(String(credits0)), `A. the balance: ${await text('#page .sh-bal')} (GET /api/wallet: ${credits0})`);
  const clock1 = await text('#page .sh-clock');
  const toSec = (s) => s.split(':').reduce((a, v) => a * 60 + Number(v), 0);
  const server = Math.floor((Date.parse(packs.dailyPack.resetsAt) - Date.now()) / 1000);
  check(Math.abs(toSec(clock1) - server) <= 2, `A. the countdown ${clock1} is the server's resetsAt (${packs.dailyPack.resetsAt}, ${server} s away)`);
  await wait(2200);
  const clock2 = await text('#page .sh-clock');
  check(toSec(clock1) - toSec(clock2) >= 2 && toSec(clock1) - toSec(clock2) <= 3, `A. it ticks: ${clock1} -> ${clock2} in 2.2 s`);
  await shot('store-page', { fullPage: true });
  await shot('store-page-top');

  // ---- B: claim from the featured tile ----
  console.log('\n[B] claim the free daily pack');
  const unopened0 = packs.unopened.length;
  await page.click('#page .sh-t[data-tile="daily"] .sh-buy');
  await until(async () => (await tiles()).find((x) => x.id === 'pack-10')?.size === 't-feature');
  const packs1 = (await api('GET', '/api/packs')).body;
  t = await tiles();
  check(packs1.unopened.length === unopened0 + 1 && packs1.dailyPack.waiting === packs.dailyPack.waiting - 1, `B. the server: ${packs1.unopened.length} waiting (was ${unopened0}), ${packs1.dailyPack.waiting} free packs left to claim`);
  check(t[0].id === 'pack-10' && t[0].size === 't-feature', 'B. the 10 packs are now the featured tile, first');
  check(byId('daily') && t.find((x) => x.id === 'daily').size === 't-tall' && t.find((x) => x.id === 'daily').btn === 'Claimed today' && !t.find((x) => x.id === 'daily').enabled && t.find((x) => x.id === 'daily').price === null, `B. the daily tile greyed, no price on it: "${t.find((x) => x.id === 'daily').btn}" (${await text('#page .sh-t[data-tile="daily"] .sh-info small')})`);
  check((await api('GET', '/api/wallet')).body.credits === credits0, 'B. claiming cost nothing');
  await shot('store-after-claim');

  // ---- C: buy from the tiles ----
  console.log('\n[C] buy a pack and a cosmetic');
  await page.click('#page .sh-t[data-tile="pack-1"] .sh-buy');
  const dlg = await text('#dialog .dlg');
  check(dlg.includes(`${price} credits`), `C. the confirm names the server's price: "${dlg}"`);
  await confirmYes();
  await until(async () => (await api('GET', '/api/wallet')).body.credits === credits0 - price);
  const credits1 = (await api('GET', '/api/wallet')).body.credits;
  const packs2 = (await api('GET', '/api/packs')).body;
  check(credits1 === credits0 - price && packs2.unopened.length === packs1.unopened.length + 1, `C. bought: ${credits0} -> ${credits1} credits, ${packs2.unopened.length} packs waiting`);
  await until(async () => (await text('#page .sh-bal')).includes(String(credits1)));
  check((await text('#page .sh-bal')).includes(String(credits1)), `C. the balance redrawn: ${await text('#page .sh-bal')}`);
  const cos = store.cosmetics.find((c) => c.priceCredits <= credits1 && !c.owned);
  if (cos) {
    await page.click(`#page .sh-t[data-tile="cos-${cos.itemId}"] .sh-buy`);
    await confirmYes();
    await until(async () => (await tiles()).find((x) => x.id === `cos-${cos.itemId}`)?.badge === 'Owned');
    t = await tiles();
    const ct = t.find((x) => x.id === `cos-${cos.itemId}`);
    const owned = (await api('GET', '/api/cosmetics')).body.owned.some((o) => o.itemId === cos.itemId);
    check(owned && ct.badge === 'Owned' && ct.btn === 'Owned' && !ct.enabled && ct.price === null, `C. ${cos.name} bought: the server lists it owned, its tile says Owned, no price`);
    const ids = t.filter((x) => x.id.startsWith('cos-')).map((x) => x.id);
    check(ids[ids.length - 1] === `cos-${cos.itemId}`, 'C. the owned item moved after the ones still on sale');
  } else check(false, 'C. a cosmetic affordable after the pack');
  const credits2 = (await api('GET', '/api/wallet')).body.credits;
  t = await tiles();
  const shortOnes = t.filter((x) => x.price && !x.free && Number(x.price) > credits2);
  check(shortOnes.length > 0 && shortOnes.every((x) => !x.enabled && x.why === `${(Number(x.price) - credits2).toLocaleString('en-US')} credits short`), `C. with ${credits2} credits, ${shortOnes.length} tiles greyed with how many credits short (${shortOnes.map((x) => `${x.id}: ${x.why}`).join('; ')})`);
  await shot('store-after-buys');

  // ---- D: the widgets at S, M and L ----
  console.log('\n[D] the Store and Packs widgets at S, M and L');
  const seen = {};
  for (const size of ['S', 'M', 'L']) {
    const put = await api('PUT', '/api/board', { widgets: [{ id: 'w1', type: 'store', size }, { id: 'w2', type: 'packs', size }] });
    check(put.status === 200, `D. the board saved with both widgets at ${size}`);
    await page.goto(url + '#/home');
    await page.reload();
    await page.waitForSelector(`#wgrid .wg[data-type="store"][data-size="${size}"]`);
    await until(async () => !(await text('#wgrid')).includes('Loading'));
    const w = await page.evaluate(() => {
      const s = document.querySelector('#wgrid .wg[data-type="store"]'), p = document.querySelector('#wgrid .wg[data-type="packs"]');
      const over = (el) => { const b = el.querySelector('.wgb'); return b.scrollHeight - b.clientHeight; };
      return {
        s: { claim: !!s.querySelector('[data-act="claim-daily"]'), tiles: s.querySelectorAll('.sh-t').length, cos: s.querySelectorAll('[data-act="buy-cosmetic"]').length, bal: s.querySelector('.sh-bal')?.textContent ?? null, clock: !!s.querySelector('[data-until]'), plate: !!s.querySelector('.spk .pa svg'), over: over(s) },
        p: { pw: s && p.querySelector('.spk')?.style.getPropertyValue('--pw'), n: p.querySelector('.pkw-n')?.textContent ?? null, open10: !!p.querySelector('[data-act="open-packs"][data-count="10"]'), pity: p.querySelector('.pity')?.textContent ?? null, pulls: p.querySelectorAll('.mc').length, plate: !!p.querySelector('.spk .pa svg'), over: over(p) },
      };
    });
    seen[size] = w;
    note(`${size}: store ${JSON.stringify(w.s)}; packs ${JSON.stringify(w.p)}`);
    await shot(`widgets-${size}`);
  }
  const p3 = (await api('GET', '/api/packs')).body;
  check(seen.S.s.claim && seen.S.s.clock && !seen.S.s.tiles, 'D. Store S: claim the free pack and the clock, no tiles');
  check(seen.M.s.tiles === 3 && !seen.M.s.cos && !seen.M.s.bal, 'D. Store M: the three pack tiles with their buttons, no cosmetics or balance');
  check(seen.L.s.tiles === 3 + store.cosmetics.length && seen.L.s.cos === store.cosmetics.length && seen.L.s.bal && seen.L.s.clock, `D. Store L: the pack tiles, the ${store.cosmetics.length} cosmetics, the balance (${seen.L.s.bal}) and the clock`);
  check(['S', 'M', 'L'].every((s) => seen[s].s.over <= 1 && seen[s].p.over <= 1), `D. nothing overflows its widget (store ${['S', 'M', 'L'].map((s) => seen[s].s.over).join('/')}, packs ${['S', 'M', 'L'].map((s) => seen[s].p.over).join('/')} px)`);
  check(['S', 'M', 'L'].every((s) => seen[s].p.n?.startsWith(String(p3.unopened.length))), `D. Packs: the count is the server's (${p3.unopened.length} waiting) at every size`);
  check(!seen.S.p.open10 && !seen.S.p.pity && seen.M.p.open10 && seen.M.p.pity && !seen.M.p.pulls && seen.L.p.pulls > 0, `D. Packs S: pack, count, Open; M: + Open 10 and the pity counters ("${seen.M.p.pity}"); L: + the last pulls (${seen.L.p.pulls} cards)`);
  check(seen.M.p.pity.includes(`${p3.pity.packsSinceFullArt} since a Full Art`) || p3.pity.next.fullArt, 'D. the pity counters are the server\'s');
  check(['S', 'M', 'L'].every((s) => seen[s].p.plate) && seen.S.s.plate, 'D. the widgets draw the real pack (the plate) too');

  // ---- E: dark and phone ----
  console.log('\n[E] dark, phone');
  await page.goto(url + '#/store');
  await page.waitForSelector('#page .sh-grid .sh-t');
  await page.evaluate(() => { document.body.dataset.theme = 'dark'; });
  await wait(500);
  await shot('store-page-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(500);
  const phone = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth, cols: getComputedStyle(document.querySelector('#page .sh-grid')).gridTemplateColumns.split(' ').length }));
  check(phone.sw <= phone.w && phone.cols === 1, `E. on a phone: one column of tiles, no sideways scroll (${phone.sw} <= ${phone.w})`);
  await shot('store-page-phone', { fullPage: true });
  check(external.length === 0, `E. no external requests${external.length ? `: ${external.join(', ')}` : ''}`);
  check(errors.length === 0, `E. no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} catch (err) {
  check(false, `the run stopped: ${err && err.stack || err}`);
} finally {
  console.log(`\n${passes} PASS, ${fails} FAIL`);
  await browser.close();
  try { process.kill(-demo.pid); } catch { /* gone */ }
  process.exit(fails ? 1 : 0);
}
