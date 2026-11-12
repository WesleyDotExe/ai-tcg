// Render session 66: the Daily rewards, Showcase and Collection widgets at
// S, M and L (the owner's 2026-11-06 Season 0 brief, section 1), driven in a
// headless browser against the real owner API over a real store with the
// game lane's ladder playing (render/src/site/siteDemo.ts --ladder --speed 8).
// Nothing is mocked.
//
//   A  The three at S, M and L. Daily rewards: the ring is the server's
//      credits from wins of the schedule's most; the paid nodes are its wins;
//      the free pack's node is its dailyPack (Claim while one waits); the
//      reset clock at L is its resetsAt and ticks. Showcase: 1, 3 and 6 cards,
//      each size's drawn larger than the last, the best card the server's
//      rarest. Collection: the server's held/total. What each size shows
//      differs; nothing overflows its widget.
//   B  Claim from the Daily rewards widget: the server's waiting goes down,
//      its unopened packs up, the node turns to Claimed (once none wait).
//   C  The ladder keeps playing: a win of Nova's reaches the ring and the row
//      without a reload (the 15 s status poll).
//   D  Stills (light, dark, a phone); no sideways scroll; no external
//      requests; no page errors.
//
//   node progress/render/evidence/widgets-check-s66.mjs [stills dir]

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
  try { await page.screenshot({ path: resolve(OUT, `v2-s66-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000, ...opts }); } catch { note(`(the still "${name}" timed out)`); }
};
const widgetText = (type) => page.$eval(`#wgrid .wg[data-type="${type}"] .wgb`, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');

const readWidgets = () => page.evaluate(() => {
  const q = (t) => document.querySelector(`#wgrid .wg[data-type="${t}"]`);
  const over = (el) => { const b = el.querySelector('.wgb'); return b.scrollHeight - b.clientHeight; };
  const t = (el, sel) => el.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
  const dr = q('daily'), sc = q('showcase'), cl = q('collection');
  const cards = [...sc.querySelectorAll('.mc')];
  return {
    daily: { ring: dr.querySelector('.dr-ring')?.getAttribute('aria-label') ?? null, row: !!dr.querySelector('.dr-row'), wins: dr.querySelectorAll('.dr-w').length, paid: dr.querySelectorAll('.dr-w.paid').length, next: dr.querySelectorAll('.dr-w.next').length, claim: dr.querySelector('[data-act="claim-daily"]') ? 'claim' : dr.querySelector('.dr-pk.done') ? 'claimed' : null, claimText: t(dr, '.dr-pk .btn'), reset: dr.querySelector('.dr-reset .sh-clock')?.dataset.until ?? null, clock: t(dr, '.dr-reset .sh-clock'), rewarded: t(dr, '.dr-rwn'), list: dr.querySelectorAll('.dr-list li').length, total: t(dr, '.dr-tot b'), nextLine: t(dr, '.dr-next') ?? t(dr, '.dr-s .small'), over: over(dr) },
    showcase: { cards: cards.length, width: cards[0] ? Math.round(cards[0].getBoundingClientRect().width) : 0, first: cards[0]?.getAttribute('title') ?? null, captions: sc.querySelectorAll('figcaption').length, over: over(sc) },
    collection: { ring: t(cl, '.ring b'), held: t(cl, '.row.nowrap > div:not(.ring) > b'), minis: cl.querySelectorAll('.mc').length, pills: cl.querySelectorAll('.pill').length, over: over(cl) },
  };
});

const FIN = { standard: 1, foil: 2, fullArt: 3, altArt: 3, gold: 4, glitch: 5, secret: 5, zeroDay: 5, prototype: 6 };
const capOf = (d) => d.schedule.reduce((a, r) => a + (r.toWin === null ? 0 : (r.toWin - r.fromWin + 1) * r.credits), 0);
const paying = (d) => d.schedule.reduce((a, r) => (r.toWin === null || r.credits <= 0 ? a : Math.max(a, r.toWin)), 0);

async function boardAt(size) {
  const put = await api('PUT', '/api/board', { widgets: [{ id: 'w1', type: 'daily', size }, { id: 'w2', type: 'showcase', size }, { id: 'w3', type: 'collection', size }] });
  await page.goto(url + '#/home');
  await page.reload();
  await page.waitForSelector(`#wgrid .wg[data-type="collection"][data-size="${size}"]`);
  await until(async () => !(await page.$eval('#wgrid', (e) => e.textContent)).includes('Loading'));
  return put.status;
}

function compareDaily(size, w, d, packs) {
  const cap = capOf(d);
  check(w.daily.ring === `${d.creditsFromWins} of ${cap} credits from wins today`, `${size}. Daily rewards ring "${w.daily.ring}" (GET /api/daily: ${d.creditsFromWins} from ${d.wins.length} wins, the schedule's most ${cap})`);
  check(w.daily.nextLine && (d.nextWinPays > 0 ? w.daily.nextLine.includes(`+${d.nextWinPays}`) : w.daily.nextLine.includes('nothing more')), `${size}. the next win line "${w.daily.nextLine}" (server nextWinPays ${d.nextWinPays})`);
  if (size === 'S') return;
  const n = paying(d);
  check(w.daily.wins === n && w.daily.paid === Math.min(d.wins.length, n) && w.daily.next === (d.nextWinPays > 0 && d.wins.length < n ? 1 : 0), `${size}. the row: ${w.daily.wins} win nodes (schedule ${n}), ${w.daily.paid} paid (server ${d.wins.length} wins), ${w.daily.next} next`);
  const want = packs.dailyPack.waiting > 0 ? 'claim' : 'claimed';
  check(w.daily.claim === want, `${size}. the free pack's node: ${w.daily.claim} "${w.daily.claimText}" (GET /api/packs: ${packs.dailyPack.waiting} waiting)`);
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
    check(status === 200, `${size}. the board saved with Daily rewards, Showcase and Collection at ${size}`);
    const w = await readWidgets();
    const [d, packs, col] = [(await api('GET', '/api/daily')).body, (await api('GET', '/api/packs')).body, (await api('GET', '/api/collection?recentPacks=3')).body];
    seen[size] = { w, d, packs, col };
    note(`${size}: ${JSON.stringify(w)}`);
    compareDaily(size, w, d, packs);
    const base = col.sets[0]?.base;
    check(base && w.collection.held === `${base.held}/${base.total}`, `${size}. Collection ${w.collection.held} (GET /api/collection: ${base?.held}/${base?.total})`);
    const best = Math.max(...col.cards.flatMap((c) => c.copies.map((k) => FIN[k.finish] ?? 1)));
    const firstFin = Object.entries(FIN).filter(([, v]) => v === best).map(([k]) => k);
    check(!!w.showcase.first && col.cards.some((c) => w.showcase.first.startsWith(c.name) && c.copies.some((k) => firstFin.includes(k.finish))), `${size}. Showcase's first card "${w.showcase.first}" holds the collection's rarest finish (${firstFin.join('/')})`);
    await shot(`widgets-${size}`);
  }
  const { S, M, L } = { S: seen.S.w, M: seen.M.w, L: seen.L.w };
  check(!S.daily.row && !S.daily.claim && M.daily.row && !M.daily.reset && L.daily.row && L.daily.reset === seen.L.d.resetsAt && L.daily.rewarded === `${seen.L.d.rewardedWins.length}/${paying(seen.L.d)}` && L.daily.list === seen.L.d.rewardedWins.length && L.daily.total === String(seen.L.d.credits), `A. Daily rewards S: the ring; M: + the row and its claim; L: + the reset clock (${L.daily.clock} to ${L.daily.reset}), rewarded ${L.daily.rewarded}, ${L.daily.list} wins listed, ${L.daily.total} credits in all (server ${seen.L.d.credits})`);
  const c1 = await page.$eval('#wgrid .wg[data-type="daily"] .dr-reset .sh-clock', (e) => e.textContent);
  await wait(2200);
  const c2 = await page.$eval('#wgrid .wg[data-type="daily"] .dr-reset .sh-clock', (e) => e.textContent);
  check(c1 !== c2, `A. the reset clock ticks (${c1} -> ${c2})`);
  check(S.showcase.cards === 1 && M.showcase.cards === 3 && L.showcase.cards === 6 && S.showcase.width < M.showcase.width && M.showcase.width < L.showcase.width && !S.showcase.captions && M.showcase.captions === 3 && L.showcase.captions === 6, `A. Showcase S/M/L: ${S.showcase.cards}/${M.showcase.cards}/${L.showcase.cards} cards, ${S.showcase.width}/${M.showcase.width}/${L.showcase.width} px wide (the old face: 78), names under them at M and L`);
  check(!S.collection.minis && M.collection.minis > 0 && L.collection.pills === 6 && L.collection.minis >= M.collection.minis, `A. Collection S: the ring; M: + ${M.collection.minis} last pulls; L: + the 6 faction pills and ${L.collection.minis} cards`);
  const overs = ['S', 'M', 'L'].map((s) => `${s} ${seen[s].w.daily.over}/${seen[s].w.showcase.over}/${seen[s].w.collection.over}`);
  check(['S', 'M', 'L'].every((s) => seen[s].w.daily.over <= 1 && seen[s].w.showcase.over <= 1), `A. Daily rewards and Showcase never overflow (daily/showcase/collection px: ${overs.join(', ')})`);
  note(`Collection L scrolls its binder by ${L.collection.over} px (it lists every card held; M ${M.collection.over}, S ${S.collection.over})`);
  check(S.collection.over <= 1 && M.collection.over <= 1, `A. Collection S and M don't overflow (${S.collection.over}/${M.collection.over} px)`);

  // ---- B: claim from the widget ----
  console.log('\n[B] Claim the free pack from the Daily rewards widget');
  await boardAt('M');
  let pk = (await api('GET', '/api/packs')).body;
  if (pk.dailyPack.waiting > 0) {
    const before = { waiting: pk.dailyPack.waiting, unopened: pk.unopened.length };
    await page.click('#wgrid .wg[data-type="daily"] [data-act="claim-daily"]');
    await until(async () => (await api('GET', '/api/packs')).body.dailyPack.waiting < before.waiting, 10000);
    await until(async () => { const w = await readWidgets(); return w.daily.claim === ((await api('GET', '/api/packs')).body.dailyPack.waiting > 0 ? 'claim' : 'claimed'); }, 10000);
    pk = (await api('GET', '/api/packs')).body;
    const w = await readWidgets();
    check(pk.dailyPack.waiting === before.waiting - 1 && pk.unopened.length === before.unopened + 1, `B. the server: waiting ${before.waiting} -> ${pk.dailyPack.waiting}, unopened ${before.unopened} -> ${pk.unopened.length}`);
    check(w.daily.claim === (pk.dailyPack.waiting > 0 ? 'claim' : 'claimed'), `B. the node now: ${w.daily.claim} "${w.daily.claimText}"`);
    await shot('daily-claimed');
  } else check(false, 'B. no free pack waiting for Nova at the start (the demo should leave one)');

  // ---- C: a ladder win reaches the ring ----
  console.log('\n[C] a win on the ladder reaches the widget without a reload');
  await boardAt('L');
  const d0 = (await api('GET', '/api/daily')).body;
  let d1 = d0;
  const won = await until(async () => (d1 = (await api('GET', '/api/daily')).body).wins.length > d0.wins.length, 600000, 3000);
  if (won) {
    const shown = await until(async () => (await readWidgets()).daily.ring === `${d1.creditsFromWins} of ${capOf(d1)} credits from wins today`, 40000, 500);
    const w = await readWidgets();
    const packs = (await api('GET', '/api/packs')).body;
    check(shown, `C. Nova's win ${d1.wins.length} (${d0.creditsFromWins} -> ${d1.creditsFromWins} credits) reached the ring without a reload: "${w.daily.ring}"`);
    compareDaily('C', w, (await api('GET', '/api/daily')).body, packs);
    await shot('daily-after-win');
  } else check(false, `C. Nova won no match in the time given (${d0.wins.length} wins)`);

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
  const wp = await readWidgets();
  check(wp.daily.over <= 1 && wp.showcase.over <= 1, `D. on a phone Daily rewards and Showcase don't overflow (${wp.daily.over}/${wp.showcase.over} px)`);
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
