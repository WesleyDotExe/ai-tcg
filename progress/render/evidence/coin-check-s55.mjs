// Render session 55: the second coin slice, in a headless browser. Four halves.
//
// Match Boot with each coin (one replay page per Season 0 coin, Cortex vs
// Swarm seed 6, the coin on p1, the near side; built fresh by
// `src/coinSheet.ts --boot`):
//   A  each page's intro flips that coin, by its own look (not the Chrome
//      Token fallback): the coin is drawn mid-spin (lit pixels at its place),
//      it lands portrait up (p1 goes first), and the six landed coins look
//      different from each other (the colour at the coin's rim and face);
//      each one's whir is that coin's own (the plan's sound list); no errors.
// The coin sheet (render/output/coin-sheet.html):
//   B  six rows, each still canvas drawn (lit pixels in all five stills and
//      the tile size) and no two rows alike; the live loops run.
// The loadout picker (render/output/loadout-picker.html):
//   C  the Coin line: six slots on the rail; the coin tiles are drawn coins;
//      the "coin" scenario wears Neon Nickel, bought; the flip loops over the
//      board, landing design up then portrait up with THEY / YOU GO FIRST;
//      a locked coin previews "not owned" with its plate and no Equip; Equip
//      the Chrome Token, then Empty: the rail and the preview follow; another
//      slot hides the coin canvas; a live match refuses a coin; only a pass
//      the viewer asked for has sound.
//   D  reduced motion: both landings, still, once (no loop). A phone: no
//      sideways scroll, the coin over the board.
// The website (render/src/site/siteDemo.ts, the real owner API):
//   E  the Store's Cosmetics shows Dial-Up Dime and Neon Nickel on sale at
//      300 with drawn coin swatches; each agent's row has its Coin line; the
//      picker opened from Change has the Coin slot.
//   F  no page errors, no external requests.
//
//   node progress/render/evidence/coin-check-s55.mjs [stills dir]
// (build the picker and the sheet first: `npm run loadout -w @ai-tcg/render`,
// `npm run coin-sheet -w @ai-tcg/render`.)

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RENDER = resolve(ROOT, 'render');
const OUT = resolve(process.argv[2] ?? resolve(ROOT, 'progress/render/evidence'));
mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

let passes = 0, fails = 0;
const check = (ok, line) => { if (ok) passes++; else fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); };
const note = (line) => console.log(`      ${line}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000, step = 60) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
const errors = [];
const external = [];
const COINS = ['coin-chrome-token', 'coin-s0-dial-up-dime', 'coin-s0-neon-nickel', 'coin-s0-platinum', 'coin-s0-diamond', 'coin-s0-mythic'];
const WHIR = { 'coin-chrome-token': 'coinWhir', 'coin-s0-dial-up-dime': 'coinWhirModem', 'coin-s0-neon-nickel': 'coinWhirNeon', 'coin-s0-platinum': 'coinWhir', 'coin-s0-diamond': 'coinWhirShimmer', 'coin-s0-mythic': 'coinWhirShimmer' };

const chromium = await loadPlaywright();
const browser = await chromium.launch({ args: ['--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const shot = async (page, name, o = {}) => {
  for (let k = 0; k < 3; k++) {
    try { await page.screenshot({ path: resolve(OUT, `v2-s55-${name}.jpg`), type: 'jpeg', quality: 84, timeout: 20000, ...o }); return; } catch { await wait(1500); }
  }
  note(`(the still "${name}" timed out three times)`);
};
async function open(url, o = {}) {
  const ctx = await browser.newContext({ viewport: o.phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 1, hasTouch: !!o.phone, isMobile: !!o.phone, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${o.tag || url}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 409/.test(m.text())) errors.push(`${o.tag || url}: console: ${m.text()}`); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && u !== 'about:blank' && !(o.host && u.startsWith(o.host))) external.push(u); });
  await page.goto(url);
  return { ctx, page };
}

// ============================================================================
// A. Match Boot with each coin
// ============================================================================
console.log('\n[A] Match Boot flips each coin by its own look');
const PAGES = mkdtempSync(join(tmpdir(), 'coin-s55-'));
execFileSync('npx', ['tsx', 'src/coinSheet.ts', '--boot', PAGES], { cwd: RENDER, stdio: 'ignore' });
const landed = {};
for (const id of COINS) {
  const { ctx, page } = await open(pathToFileURL(join(PAGES, `boot-${id}.html`)).href, { tag: id });
  await page.waitForFunction(() => window.__cfx && window.__cfx.isReady(), null, { timeout: 20000 });
  await page.click('#btn-play');
  await until(() => page.evaluate(() => window.__boot.active()), 5000, 20);
  const s0 = await page.evaluate(() => window.__boot.stats());
  const plan = await page.evaluate(() => { const p = window.__boot.plan(); return { whir: p.marks.filter((m) => m.k === 'sound' && /^coinWhir/.test(m.kind)).map((m) => m.kind), reach: p.coin.reach }; });
  // Sample the coin's place on the intro's canvas: mid-spin, then landed.
  const sample = () => page.evaluate(() => {
    const cv = document.querySelector('canvas.boot-canvas'), p = window.__boot.plan();
    if (!cv || !p) return null;
    const r = cv.getBoundingClientRect(), k = cv.width / r.width, co = p.coin, sx = window.scrollX, sy = window.scrollY;
    const x0 = Math.round((co.x - co.r - (r.left + sx)) * k), y0 = Math.round((co.y - co.r - (r.top + sy)) * k), w = Math.round(co.r * 2 * k);
    const d = cv.getContext('2d').getImageData(Math.max(0, x0), Math.max(0, y0), Math.max(1, w), Math.max(1, w)).data;
    let lit = 0, R = 0, G = 0, B = 0;
    for (let i = 0; i < d.length; i += 4) { const s = d[i] + d[i + 1] + d[i + 2]; if (d[i + 3] > 100 && s > 120) { lit++; R += d[i]; G += d[i + 1]; B += d[i + 2]; } }
    return { t: window.__boot.stats().t, lit, rgb: lit ? [Math.round(R / lit), Math.round(G / lit), Math.round(B / lit)] : null };
  });
  let mid = null, land = null;
  for (let k = 0; k < 400 && (!mid || !land); k++) {
    const s = await sample();
    if (s && !mid && s.t > 1700 && s.t < 2050) mid = s;
    if (s && !land && s.t > 2200 && s.t < 2380) { land = s; await shot(page, `boot-${id.replace(/^coin-(s0-)?/, '')}`, { clip: await page.evaluate(() => { const p = window.__boot.plan(); const co = p.coin; return { x: co.x - 170, y: co.y - co.r * 1.6, width: 340, height: co.r * 3.6 + 30 }; }) }); }
    await wait(15);
  }
  check(s0.coin && s0.coin.id === id && !s0.coin.fallback, `A. ${id}: the intro flips it by its own look (${JSON.stringify(s0.coin && { id: s0.coin.id, fallback: s0.coin.fallback })})`);
  check(s0.coin && s0.coin.portraitUp && s0.coin.first === 'bot', `A. ${id}: p1 near goes first, so it lands portrait up`);
  check(!!mid && mid.lit > 30, `A. ${id}: drawn mid-spin (${mid ? mid.lit : 0} lit px at t=${mid ? mid.t : '?'} ms)`);
  check(!!land && land.lit > 200, `A. ${id}: drawn landed (${land ? land.lit : 0} lit px, mean ${land && JSON.stringify(land.rgb)})`);
  check(plan.whir.length === 1 && plan.whir[0] === WHIR[id], `A. ${id}: its spin's sound is ${plan.whir.join(',')} (want ${WHIR[id]}); halo reach ${plan.reach}`);
  landed[id] = land && land.rgb;
  await ctx.close();
}
{
  const ids = COINS.filter((id) => landed[id]);
  let minD = Infinity, pair = '';
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = landed[ids[i]], b = landed[ids[j]], d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (d < minD) { minD = d; pair = `${ids[i]} / ${ids[j]}`; }
  }
  // Landed portrait up, the faces share the portrait; the rim and metal still differ.
  check(ids.length === 6 && minD > 6, `A. the six landed coins differ (closest pair ${pair}: ${minD.toFixed(1)} apart in mean colour)`);
}

// ============================================================================
// B. The coin sheet
// ============================================================================
console.log('\n[B] The coin sheet');
{
  const { ctx, page } = await open(pathToFileURL(resolve(RENDER, 'output/coin-sheet.html')).href, { tag: 'coin-sheet' });
  await wait(1200);
  const rows = await page.evaluate(() => [...document.querySelectorAll('canvas.stills')].map((cv) => {
    const ctx = cv.getContext('2d'), out = [];
    for (const x of [80, 216, 352, 488, 624, 730]) {
      const d = ctx.getImageData(x - 40, 20, 80, 110).data;
      let lit = 0, h = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 100 && d[i] + d[i + 1] + d[i + 2] > 120) lit++; h = (h * 31 + d[i] * 7 + d[i + 1] * 3 + d[i + 2]) >>> 0; }
      out.push({ lit, h });
    }
    return { id: cv.dataset.coin, out };
  }));
  check(rows.length === 6 && rows.map((r) => r.id).join(',') === COINS.join(','), `B. six rows, in the catalogue's order (${rows.map((r) => r.id).join(', ')})`);
  check(rows.every((r) => r.out.every((o) => o.lit > 20)), `B. every still drawn (fewest lit px: ${Math.min(...rows.flatMap((r) => r.out.map((o) => o.lit)))})`);
  check(new Set(rows.map((r) => r.out[0].h)).size === 6, 'B. no two coins\' design faces alike (pixel hashes)');
  const live0 = await page.evaluate(() => [...document.querySelectorAll('canvas.live')].map((c) => c.toDataURL().length));
  await wait(400);
  const live1 = await page.evaluate(() => [...document.querySelectorAll('canvas.live')].map((c) => c.toDataURL().length));
  check(live0.some((v, i) => v !== live1[i]), 'B. the live loops run');
  await shot(page, 'coin-sheet', { fullPage: true });
  await ctx.close();
}

// ============================================================================
// C, D. The loadout picker
// ============================================================================
console.log('\n[C] The loadout picker: the Coin line');
const PICKER = pathToFileURL(resolve(RENDER, 'output/loadout-picker.html')).href;
const LS = (page) => page.evaluate(() => { const l = window.__loadout, st = l.stats(); return { state: l.state(), coin: st.coin, current: st.current, swatches: st.swatches }; });
{
  const { ctx, page } = await open(PICKER, { tag: 'picker' });
  await page.waitForSelector('.rail-slot');
  await page.click('.sc-tab[data-sc="coin"]');
  const rail = await page.$$eval('.rail-slot', (bs) => bs.map((b) => [b.dataset.slot, b.querySelector('.rs-val').textContent]));
  check(rail.map((r) => r[0]).join(',') === 'boast,closeWinBoast,cardBack,avatar,arena,coin', `C. six slots on the rail, the Coin last (${rail.map((r) => r[0]).join(', ')})`);
  check(rail[5][1] === 'Neon Nickel', `C. the coin scenario's rail says "${rail[5][1]}"`);
  await page.click('.rail-slot[data-slot="coin"]');
  await wait(250);
  const tiles = await page.$$eval('.tile', (ts) => ts.map((t) => ({ key: t.dataset.tile, locked: t.classList.contains('locked'), equipped: t.classList.contains('equipped'), equip: !!t.querySelector('[data-equip]'), bought: !!t.querySelector('.t-src'), plate: (t.querySelector('.t-lock') || {}).textContent || '' })));
  check(tiles.map((t) => t.key).join(',') === 'coin-chrome-token,coin-s0-neon-nickel,coin-s0-dial-up-dime,', `C. the tiles: ${tiles.map((t) => t.key || '(empty)').join(', ')}`);
  check(tiles[1].equipped && tiles[1].bought && tiles[2].locked && !tiles[2].equip && /300 credits/.test(tiles[2].plate), 'C. Neon Nickel equipped and Bought; Dial-Up Dime locked, "In the store · 300 credits", no Equip');
  const sw = await page.$$eval('canvas.t-coin', (cs) => cs.map((cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) lit++; return [cv.dataset.coin, lit]; }));
  check(sw.length === 3 && sw.every(([, lit]) => lit > 400), `C. each coin tile shows the coin drawn (${sw.map(([id, l]) => `${id.replace(/^coin-/, '')}: ${l} px`).join(', ')})`);
  // The loop: two landings at least.
  await until(async () => (await LS(page)).coin.passes >= 2, 6000);
  let st = await LS(page);
  check(st.current && st.current.coin === 'coin-s0-neon-nickel', `C. the preview flips the equipped coin (${st.current && st.current.coin})`);
  check(st.coin.landed.slice(0, 2).join(',') === 'design,portrait' && st.coin.lines.slice(0, 2).join(' / ') === 'THEY GO FIRST / YOU GO FIRST', `C. it lands design up then portrait up: ${st.coin.lines.slice(0, 2).join(' / ')}`);
  const cvOn = await page.evaluate(() => { const c = document.getElementById('coin-cv'), b = document.getElementById('stage-board').getBoundingClientRect(), r = c.getBoundingClientRect(); return { hidden: c.hidden, fit: Math.abs(r.left - b.left) < 2 && Math.abs(r.top - b.top) < 2 && Math.abs(r.width - b.width) < 2 }; });
  check(!cvOn.hidden && cvOn.fit, 'C. the flip plays on its canvas, laid exactly over the preview board');
  check(st.coin.sounds === 1, `C. sound only on the pass the viewer asked for (the slot tap): ${st.coin.sounds} sequence over ${st.coin.passes} passes`);
  await shot(page, 'picker-coin-slot');
  // A locked coin previews "not owned".
  await page.click('.tile[data-tile="coin-s0-dial-up-dime"]');
  await wait(200);
  const cap = await page.textContent('#st-cap');
  st = await LS(page);
  check(st.current.coin === 'coin-s0-dial-up-dime' && /not owned/.test(cap), `C. a tap on the locked Dial-Up Dime previews it: "${cap.trim()}"`);
  check(st.coin.sounds === 2, `C. ...with its sound (a pass the viewer asked for): ${st.coin.sounds}`);
  await wait(1500);
  await shot(page, 'picker-dime-preview');
  // Equip the Chrome Token, then Empty.
  await page.click('[data-equip="coin-chrome-token"]');
  await wait(150);
  st = await LS(page);
  const rail2 = await page.textContent('.rail-slot[data-slot="coin"] .rs-val');
  check(st.state.loadout.coin === 'coin-chrome-token' && rail2 === 'Chrome Token' && st.current.coin === 'coin-chrome-token', `C. Equip the Chrome Token: the store's answer applied, the rail "${rail2}", the preview flips it`);
  await page.click('[data-equip=""]');
  await wait(150);
  st = await LS(page);
  const rail3 = await page.textContent('.rail-slot[data-slot="coin"] .rs-val');
  check(st.state.loadout.coin === null && rail3 === 'Empty: flips Chrome Token' && st.current.coin === 'coin-chrome-token' && st.current.empty, `C. Equip Empty: the rail "${rail3}", the preview flips the Chrome Token an empty slot flips`);
  // Another slot hides the coin.
  await page.click('.rail-slot[data-slot="boast"]');
  await wait(200);
  const hid = await page.evaluate(() => ({ hidden: document.getElementById('coin-cv').hidden, coin: window.__loadout.coin.active(), boast: window.__loadout.boast.active() }));
  check(hid.hidden && !hid.coin && hid.boast, 'C. the Victory boast slot hides the coin and plays the boast again');
  await ctx.close();
}
{
  const { ctx, page } = await open(PICKER, { tag: 'picker-live' });
  await page.waitForSelector('.rail-slot');
  await page.click('.sc-tab[data-sc="live"]');
  await page.click('.rail-slot[data-slot="coin"]');
  await page.click('[data-equip=""]');
  await wait(150);
  const t = await page.textContent('#toast');
  const st = await LS(page);
  check(st.state.loadout.coin === 'coin-chrome-token' && /live match/.test(t), `C. in a live match the store refuses a coin change: "${t}"`);
  await ctx.close();
}
console.log('\n[D] Reduced motion; a phone');
{
  const { ctx, page } = await open(PICKER, { tag: 'picker-reduced', reduced: true });
  await page.waitForSelector('.rail-slot');
  await page.click('.rail-slot[data-slot="coin"]');
  await wait(900);
  const st0 = await LS(page);
  await wait(1500);
  const st = await LS(page);
  check(st.coin.still >= 1 && st.coin.still <= 2 && st.coin.frames === st0.coin.frames && st.coin.passes === 0, `D. reduced motion: both landings, still, no loop (stills ${st.coin.still}: once, and once more if the portrait arrived after; unchanged over 1.5 s)`);
  check(st.coin.portrait === true, 'D. ...the last still has the agent\'s portrait on its portrait face, not the placeholder');
  await shot(page, 'picker-reduced');
  await ctx.close();
}
{
  const { ctx, page } = await open(PICKER, { tag: 'picker-phone', phone: true });
  await page.waitForSelector('.rail-slot');
  await page.click('.sc-tab[data-sc="coin"]');
  await page.click('.rail-slot[data-slot="coin"]');
  await wait(450);
  const g = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth, cv: (() => { const c = document.getElementById('coin-cv').getBoundingClientRect(), b = document.getElementById('stage-board').getBoundingClientRect(); return Math.abs(c.width - b.width) < 2 && Math.abs(c.height - b.height) < 2; })() }));
  check(g.sw <= g.w && g.cv, `D. a phone: no sideways scroll (${g.sw} <= ${g.w}); the coin's canvas covers the board`);
  await shot(page, 'picker-phone-flight');
  await wait(1100);
  await shot(page, 'picker-phone-landed');
  await ctx.close();
}

// ============================================================================
// E. The website, on the real owner API
// ============================================================================
console.log('\n[E] The website: the Store');
const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0'], { cwd: RENDER, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
try {
  const url = await new Promise((ok, fail) => {
    let buf = '';
    demo.stdout.on('data', (d) => { buf += d; const m = /\[site-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
    demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
    setTimeout(() => fail(new Error('the demo took over 90 s to start')), 90000);
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`site: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`site: console: ${m.text()}`); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(url) && !u.startsWith('data:') && u !== 'about:blank') external.push(u); });
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');
  await page.click('#nav [data-page="store"]');
  await page.waitForSelector('.st-agents [data-act="dress"]');
  await until(() => page.evaluate(() => document.querySelectorAll('.st-cos canvas[data-coin][data-painted]').length >= 2), 8000);
  const cos = await page.$$eval('.st-cos .si', (ss) => ss.map((s) => ({ name: s.querySelector('b').textContent, coin: (s.querySelector('canvas[data-coin]') || {}).dataset?.coin || null, painted: !!s.querySelector('canvas[data-painted]'), buy: (s.querySelector('[data-act="buy-cosmetic"]') || {}).textContent || '', lit: (() => { const c = s.querySelector('canvas[data-coin]'); if (!c) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) n++; return n; })() })));
  const coins = cos.filter((c) => c.coin);
  check(coins.map((c) => c.coin).join(',') === 'coin-s0-dial-up-dime,coin-s0-neon-nickel', `E. the Store's Cosmetics sells the two store coins (${coins.map((c) => c.name).join(', ')})`);
  check(coins.every((c) => c.painted && c.lit > 300 && /300/.test(c.buy)), `E. each with a drawn coin (${coins.map((c) => c.lit).join(', ')} px) and "Buy · 300"`);
  const rows = await page.$$eval('.st-agents .st-agent', (rs) => rs.map((r) => r.textContent));
  check(rows.length > 0 && rows.every((t) => /Coin: Chrome Token/.test(t)), `E. every agent row has its Coin line (${rows.length} rows: "Coin: Chrome Token")`);
  await page.evaluate(() => document.querySelector('.st-cos').scrollIntoView({ block: 'center' }));
  await shot(page, 'site-store-coins');
  await page.click('.st-agents [data-act="dress"]');
  const ok = await until(async () => { const f = page.frames().find((x) => x.url().endsWith('/loadout')); return !!f && (await f.evaluate(() => !!window.__loadout && !!window.__loadout.state())); });
  const f = page.frames().find((x) => x.url().endsWith('/loadout'));
  const rail = ok ? await f.$$eval('.rail-slot', (bs) => bs.map((b) => b.dataset.slot)) : [];
  check(ok && rail.includes('coin'), `E. the picker opened from Change has the Coin slot (${rail.join(', ')})`);
  if (ok) {
    await f.click('.rail-slot[data-slot="coin"]');
    await wait(1200);
    const fst = await f.evaluate(() => { const s = window.__loadout.stats(); return { coin: s.coin, swatches: s.swatches, current: s.current }; });
    check(fst.current && fst.current.coin === 'coin-chrome-token' && fst.coin.passes >= 1 && fst.swatches === 3, `E. on the website the coin slot flips the Chrome Token and draws its 3 coin tiles (${JSON.stringify({ current: fst.current, passes: fst.coin.passes, swatches: fst.swatches })})`);
    await shot(page, 'site-picker-coin');
  }
  await ctx.close();
} finally {
  try { process.kill(-demo.pid); } catch { /* gone */ }
}

console.log('\n[F] Errors and requests');
check(errors.length === 0, `F. no page errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
check(external.length === 0, `F. no external requests${external.length ? ': ' + external.slice(0, 3).join(' ') : ''}`);

await browser.close();
console.log(`\n${passes} PASS, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
