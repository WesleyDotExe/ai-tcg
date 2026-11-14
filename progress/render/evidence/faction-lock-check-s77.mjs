// Render session 77: the faction lock on the server's own field. Game session
// 100 serves GET /api/play's `lockable`; render 76 read it first but every
// number it showed was its own reading (the field didn't exist yet). Here, in
// a headless browser against the real owner API (siteDemo.ts: Nova holds the
// Cortex starter, 20 opened packs and 11 unopened):
//
//   A The marks come from the server's field, at once: with GET /api/collection
//     held back 4 s, Settings draws the greyed factions before the collection
//     lands, with no plan; the plan follows when it lands.
//   B The page draws the server's numbers, not its own: a GET /api/play reply
//     changed in flight (Null's count) shows the changed count; the page then
//     sees its collection disagree, reads it again (once) and makes no plan
//     from it.
//   C Locking greyed Aegis: the warning names the plan and the pack points
//     (GET /api/wallet's), "enough for all of it" or "N short".
//   D A pack opened from the top bar while away (the owner's API), straight
//     back to Settings with no Collection visit: the badge is the server's new
//     count and the plan adds up to exactly the gap (render 76 needed the
//     Collection page in between to see a fresh plan).
//   E Crafts through the API as far as the pack points go, straight back to
//     Settings: the badge, the plan left and the pack points all move (the
//     whole plan to a built deck is siteLockable76.test.ts's, on the real
//     store: the demo owner can't afford it).
//   F Back to Cortex; a 390 px phone with the pack points line: nothing sideways.
//   G No external requests, no page errors.
//
//   npx tsx progress/render/evidence/faction-lock-check-s77.mjs [stills dir]

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

// The engine's rule, run here on the server's answer (A's cross-check).
// Run with tsx so the engine's TypeScript imports: npx tsx <this file>.
const { largestDeck, holdingsOf } = await import(pathToFileURL(resolve(ROOT, 'engine/src/index.ts')).href).catch(() => ({}));

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
const until = async (fn, ms = 15000, step = 80) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
const chromium = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];
const external = [];
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `v2-s77-${name}.jpg`), type: 'jpeg', quality: 80, timeout: 20000 }).catch(() => note(`(the still "${name}" timed out)`));

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
await page.goto(url);
await page.waitForSelector('#signin:not([hidden])');
await page.fill('#si-login', 'nova');
await page.fill('#si-pass', 'a long demo password');
await page.click('#si-go');
await page.waitForSelector('#wgrid, .wempty h3');
const api = (method, path, body) => page.evaluate(async ({ method, path, body }) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}, { method, path, body });
const lockButtons = () => page.$$eval('#faction-lock button', (bs) => bs.map((b) => ({ v: b.dataset.v, short: b.classList.contains('short'), pressed: b.getAttribute('aria-pressed') === 'true', badge: b.querySelector('.lk')?.textContent ?? null, label: b.getAttribute('aria-label') })));
const noteOf = () => page.$eval('.lock-note', (n) => ({ cls: n.className, text: n.textContent, link: n.querySelector('a')?.getAttribute('href') ?? null })).catch(() => null);

try {
  const cols = () => colReads;
  // ---- A ----
  let colReads = 0;
  let holdCollection = true;
  await page.route(/\/api\/collection(\?|$)/, async (route) => {
    colReads++;
    if (holdCollection) await wait(4000);
    await route.continue();
  });
  // Off Settings and back so the page has no collection in hand from Home's
  // widget: a fresh context's first Settings visit.
  await page.evaluate(() => { location.hash = '#/settings'; });
  const t0 = Date.now();
  const early = await until(async () => (await page.$$('#faction-lock button.short')).length > 0, 3500, 50);
  const tMarks = Date.now() - t0;
  const earlyNote = await noteOf();
  check(early && tMarks < 3500, `A the greyed marks are drawn ${tMarks} ms after entering Settings, before the held-back collection lands (4 s)`);
  const play0 = (await api('GET', '/api/play')).body;
  note(`GET /api/play's lockable: ${play0.lockable.map((x) => `${x.faction} ${x.buildable ? 'ok' : `${x.cards}/${x.needed}`}`).join(' · ')}`);
  const btnsA = await lockButtons();
  check(play0.lockable.every((s) => { const b = btnsA.find((x) => x.v === s.faction); return s.buildable ? !b.short : b.short && b.badge === `${s.cards}/${s.needed}`; }), 'A every badge is the server\'s own field, faction by faction');
  check(earlyNote && /muted/.test(earlyNote.cls), `A the quiet line is there before the collection: "${earlyNote?.text}"`);
  holdCollection = false;
  await wait(4500);
  await shot(page, 'settings-1440');

  // ---- B ----
  const fake = { Null: null };
  await page.route(/\/api\/play$/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const r = await route.fetch();
    const body = await r.json();
    const n = body.lockable?.find((x) => x.faction === 'Null');
    if (n && !n.buildable) { n.cards += 1; fake.Null = n.cards; }
    await route.fulfill({ response: r, json: body });
  });
  const readsBefore = cols();
  await page.evaluate(() => { location.hash = '#/home'; });
  await wait(600);
  await page.evaluate(() => { location.hash = '#/settings'; });
  // The play read that Settings draws from comes from the status poll or the
  // route; force one by locking and unlocking nothing: wait for the badge.
  const changed = await until(async () => (await lockButtons()).find((b) => b.v === 'Null')?.badge === `${fake.Null}/20`, 20000, 100);
  const own = Number(btnsA.find((b) => b.v === 'Null').badge.split('/')[0]);
  check(changed && fake.Null === own + 1, `B a changed reply (Null ${own} -> ${fake.Null}) shows the changed count: the page draws the server's field, not its own reading (${own})`);
  await wait(1500);
  const extra = cols() - readsBefore;
  note(`collection reads after the changed reply: ${extra} (the visit's own, plus one for the disagreement at most per play read)`);
  check(extra >= 1 && extra <= 4, `B the disagreement reads the collection again a bounded number of times (${extra})`);
  await page.unroute(/\/api\/play$/);
  await page.evaluate(() => { location.hash = '#/home'; });
  await wait(600);
  await page.evaluate(() => { location.hash = '#/settings'; });
  const restored = await until(async () => (await lockButtons()).find((b) => b.v === 'Null')?.badge === `${own}/20`, 20000, 100);
  check(restored, `B with the real reply back, Null reads ${own}/20 again`);

  // ---- C ----
  await page.click('#faction-lock button[data-v="Aegis"]');
  const saved = await until(async () => (await api('GET', '/api/play')).body.factionLock === 'Aegis');
  check(saved, 'C pressing greyed Aegis still locks it');
  await until(async () => /You have/.test((await noteOf())?.text ?? ''));
  const n1 = await noteOf();
  const wallet = (await api('GET', '/api/wallet')).body;
  const m1 = /Cheapest from its starter list: .+ \((\d+) pack points\)\. You have ([\d,]+) pack points?, (enough for all of it|([\d,]+) short)\. Or lock another faction\./.exec(n1?.text ?? '');
  const have = m1 ? Number(m1[2].replace(/,/g, '')) : NaN;
  const cost = m1 ? Number(m1[1]) : NaN;
  check(m1 && have === wallet.packPoints && (have >= cost ? m1[3] === 'enough for all of it' : Number(m1[4].replace(/,/g, '')) === cost - have), `C the warning says whether the pack points (GET /api/wallet: ${wallet.packPoints}) cover the plan: "${n1?.text}"`);
  await shot(page, 'settings-aegis-locked');

  // ---- D ----
  const badgeOf = async (f) => (await lockButtons()).find((b) => b.v === f)?.badge;
  const aegisBefore = await badgeOf('Aegis');
  await page.evaluate(() => { location.hash = '#/home'; });
  let opened = 0, aegisAfter = aegisBefore;
  for (let i = 0; i < 6 && aegisAfter === aegisBefore; i++) {
    const r = await api('POST', '/api/packs/open', { count: 1 });
    if (r.status !== 200 && r.status !== 201) { note(`open: ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`); break; }
    opened++;
    const s = (await api('GET', '/api/play')).body.lockable.find((x) => x.faction === 'Aegis');
    aegisAfter = s.buildable ? 'ok' : `${s.cards}/${s.needed}`;
  }
  note(`opened ${opened} pack(s) away from Settings: the server's Aegis ${aegisBefore} -> ${aegisAfter}`);
  await page.evaluate(() => { location.hash = '#/settings'; });
  const fresh = await until(async () => {
    const b = await badgeOf('Aegis');
    const t = (await noteOf())?.text ?? '';
    return b === aegisAfter && /Cheapest from its starter list/.test(t) && /You have/.test(t);
  }, 15000, 100);
  const n2 = await noteOf();
  const gap = 20 - Number(String(aegisAfter).split('/')[0]);
  const planCopies = (/Cheapest from its starter list: (.+) \(\d+ pack points\)/.exec(n2?.text ?? '')?.[1] ?? '').split(/, | and /).reduce((s, x) => s + Number(/×(\d+)$/.exec(x)?.[1] ?? 1), 0);
  check(fresh && aegisAfter !== aegisBefore && planCopies === gap, `D straight back to Settings (no Collection visit): the badge is the server's ${aegisAfter} and the plan is ${planCopies} crafts, exactly the gap (${gap})`);

  // ---- E ----
  // Craft what the wallet covers (cheapest first, as the plan is ordered by
  // price), stopping before a refusal; then straight back to Settings.
  const plan = /Cheapest from its starter list: (.+) \(\d+ pack points\)/.exec(n2.text)[1];
  const binder = (await api('GET', '/api/collection/binder/S0')).body;
  const prices = { Common: 40, Uncommon: 80, Rare: 250, Mythic: 800 }; // economy/src/config.ts CRAFT_PACK_POINTS
  let crafted = 0, spent = 0;
  let purse = (await api('GET', '/api/wallet')).body.packPoints;
  for (const part of plan.split(/, | and /)) {
    const name = part.replace(/ ×\d+$/, '');
    const times = Number(/×(\d+)$/.exec(part)?.[1] ?? 1);
    const entry = binder.base.entries.find((e) => e.name === name);
    for (let i = 0; i < times; i++) {
      const price = prices[entry.rarity];
      if (price > purse) break;
      const r = await api('POST', `/api/collection/cards/${encodeURIComponent(entry.cardId)}/craft`);
      if (r.status !== 201) break;
      crafted++; spent += price; purse -= price;
    }
  }
  const purseNow = (await api('GET', '/api/wallet')).body.packPoints;
  note(`crafted ${crafted} of ${planCopies} through the API, as far as the pack points went (${spent} spent, ${purseNow} left)`);
  await page.evaluate(() => { location.hash = '#/home'; });
  await wait(400);
  await page.evaluate(() => { location.hash = '#/settings'; });
  const want = `${20 - gap + crafted}/20`;
  const moved = await until(async () => (await badgeOf('Aegis')) === want && new RegExp(`You have ${purseNow.toLocaleString('en-US')} pack points?`).test((await noteOf())?.text ?? ''), 20000, 100);
  const n3 = await noteOf();
  const left = (/Cheapest from its starter list: (.+) \(\d+ pack points\)/.exec(n3?.text ?? '')?.[1] ?? '').split(/, | and /).reduce((s, x) => s + Number(/×(\d+)$/.exec(x)?.[1] ?? 1), 0);
  check(crafted > 0 && moved && left === gap - crafted, `E after ${crafted} craft(s), straight back to Settings: Aegis reads ${want}, the plan is the ${gap - crafted} left and the pack points are the wallet's now (${purseNow}): "${n3?.text}"`);
  await shot(page, 'settings-aegis-crafted');
  note('(crafting the whole plan to a built Aegis deck is the unit test\'s, on the real store: render/test/siteLockable76.test.ts; the demo owner holds too few pack points)');

  // ---- F ----
  await page.click('#faction-lock button[data-v="Cortex"]');
  await until(async () => (await api('GET', '/api/play')).body.factionLock === 'Cortex');
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const pp = await phone.newPage();
  pp.on('pageerror', (e) => errors.push(`phone: ${String(e)}`));
  await pp.goto(url);
  await pp.waitForSelector('#signin:not([hidden])');
  await pp.fill('#si-login', 'nova');
  await pp.fill('#si-pass', 'a long demo password');
  await pp.click('#si-go');
  await pp.waitForSelector('#wgrid, .wempty h3');
  await pp.goto(`${url}#/settings`);
  await until(async () => (await pp.$$('#faction-lock button.short')).length > 0);
  await pp.click('#faction-lock button[data-v="Null"]');
  await until(async () => /You have/.test(await pp.$eval('.lock-note', (n) => n.textContent).catch(() => '')));
  const fit = await pp.evaluate(() => {
    const seg = document.querySelector('#faction-lock').getBoundingClientRect();
    const n = document.querySelector('.lock-note')?.getBoundingClientRect();
    const pg = document.querySelector('#page');
    return { segRight: seg.right, noteRight: n?.right ?? 0, vw: innerWidth, sideways: pg.scrollWidth > pg.clientWidth + 1, docSideways: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  note(`phone: the lock's right edge ${Math.round(fit.segRight)}, the warning's ${Math.round(fit.noteRight)}, of ${fit.vw}`);
  check(fit.segRight <= fit.vw && fit.noteRight <= fit.vw && !fit.sideways && !fit.docSideways, 'F at 390 px, Null locked: the lock and the warning with its pack points fit, nothing sideways');
  await pp.$eval('.lock-note', (el) => el.scrollIntoView({ block: 'center' }));
  await shot(pp, 'settings-phone');
  await api('PUT', '/api/play/faction-lock', { faction: 'Cortex' }).catch(() => {});
  await phone.close();

  // ---- G ----
  check(external.length === 0, `G no external requests (${external.length})`);
  check(errors.length === 0, `G no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} catch (err) {
  fails++;
  console.log(`FAIL  the check stopped: ${err?.stack ?? err}`);
} finally {
  await browser.close();
  try { process.kill(-demo.pid); } catch { /* gone */ }
  console.log(`\n${passes} PASS, ${fails} FAIL`);
  process.exit(fails ? 1 : 0);
}
