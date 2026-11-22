// Season 1 Home tile audit (render session 82; owner 2026-11-22, plan item 18
// step 1). Drives the real Season 0 Home in headless Chromium against the real
// owner API over a real store with the game lane's ladder playing
// (season1/audit/auditDemo.ts: Season 0's site demo plus a brand-new owner).
// Nothing is mocked and no Season 0 file is changed.
//
// For two owners (Nova: weeks in, packs, matches; Wren: just signed up, no
// match yet) it reads:
//   1. the recommended board as a first visit shows it (a still, every tile's
//      text), and which facts appear in more than one tile there;
//   2. every one of the twelve tiles at S, M and L (one board per size, a still
//      each, every tile's text, the buttons and links it offers, overflow);
//   3. the navigation (the side bar's pages, the top bar's controls).
// It writes home-audit.json (the raw read) and home-audit.txt (the readable
// summary the spec in season1/HOME_TILES.md quotes).
//
//   node render/season1/audit/home-audit.mjs [outDir]
//   (default progress/render/evidence/season1-home-audit-s82/)

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const renderDir = resolve(here, '..', '..');
const OUT = resolve(process.argv[2] ?? join(renderDir, '..', 'progress', 'render', 'evidence', 'season1-home-audit-s82'));
mkdirSync(OUT, { recursive: true });
const PASSWORD = 'a long demo password';
const TYPES = ['agent', 'live', 'watch', 'packs', 'daily', 'collection', 'showcase', 'ladder', 'form', 'history', 'notif', 'store'];

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

const demo = spawn('npx', ['tsx', 'season1/audit/auditDemo.ts', '--speed', '8'], { cwd: renderDir, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const url = await new Promise((ok, fail) => {
  let buf = '';
  demo.stdout.on('data', (d) => { buf += d; const m = /\[audit-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
  demo.stderr.on('data', (d) => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
  demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
  setTimeout(() => fail(new Error('the demo took over 240 s to start')), 240000);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000, step = 250) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };
const errors = [];
const external = [];
const raw = { url: '(local demo)', owners: {} };

const chromium = await loadPlaywright();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function signIn(login) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${login}: ${e}`));
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && !r.url().startsWith('blob:') && r.url() !== 'about:blank') external.push(r.url()); });
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', login);
  await page.fill('#si-pass', PASSWORD);
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3', { timeout: 30000 });
  return page;
}

const api = (page, method, path, body) => page.evaluate(async ([method, path, body]) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}, [method, path, body]);

/** Every tile on the board as the page draws it. */
const readTiles = (page) => page.evaluate(() => [...document.querySelectorAll('#wgrid .wg')].map((el) => {
  const b = el.querySelector('.wgb');
  const r = el.getBoundingClientRect();
  const text = (b?.innerText ?? '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  const actions = [...b.querySelectorAll('button, a[href]')].filter((x) => x.offsetParent !== null).map((x) => (x.getAttribute('aria-label') || x.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  return {
    type: el.dataset.type, size: el.dataset.size,
    title: el.querySelector('.wtt')?.textContent ?? '',
    open: el.querySelector('.wgh .wopen')?.getAttribute('aria-label') ?? null,
    box: { w: Math.round(r.width), h: Math.round(r.height) },
    overflowPx: b ? Math.max(0, b.scrollHeight - b.clientHeight) : 0,
    words: text ? text.split(/\s+/).length : 0,
    text, actions,
    hasCanvasOrFrame: !!b.querySelector('canvas, iframe'),
  };
}));

async function settle(page) {
  await until(async () => !(await page.$eval('#wgrid', (e) => e.textContent).catch(() => 'Loading')).includes('Loading'), 30000);
  await wait(1500);
}

async function board(page, widgets) {
  const put = await api(page, 'PUT', '/api/board', { widgets });
  if (put.status !== 200) throw new Error(`PUT /api/board ${put.status}: ${JSON.stringify(put.body)}`);
  await page.goto(url + '#/home');
  await page.reload();
  await page.waitForSelector('#wgrid .wg');
  await settle(page);
}

// Facts worth finding twice: what the server says, matched in the tiles' text.
async function factsOf(page) {
  const play = (await api(page, 'GET', '/api/play')).body;
  const rating = (await api(page, 'GET', '/api/rating')).body;
  const packs = (await api(page, 'GET', '/api/packs')).body;
  const col = (await api(page, 'GET', '/api/collection?recentPacks=3')).body;
  const daily = (await api(page, 'GET', '/api/daily')).body;
  const wallet = (await api(page, 'GET', '/api/wallet')).body;
  const facts = [];
  const add = (name, needle) => { if (needle !== null && needle !== undefined && String(needle).length >= 2) facts.push({ name, needle: String(needle) }); };
  const ag = play.connectedAgent;
  add('agent name', ag?.name);
  const r = rating?.rating?.rating;
  add('rating', typeof r === 'number' ? Math.round(r) : r);
  add('credits', wallet?.credits ?? wallet?.balance);
  if (packs?.unopened?.length) facts.push({ name: 'unopened packs', needle: `\\b${packs.unopened.length}\\s*(/\\s*)?unopened`, regex: true });
  const base = col?.sets?.[0]?.base;
  if (base) add('set completion', `${base.held}/${base.total}`);
  add('credits from wins today', daily?.creditsFromWins ? `${daily.creditsFromWins} of` : null);
  facts.push({ name: 'rating uncertainty (±)', needle: /±\d+/.source, regex: true });
  facts.push({ name: 'streak', needle: /streak/.source, regex: true });
  facts.push({ name: 'auto-play on/off', needle: /auto-?play|Running|Stopped|Paused/i.source, regex: true });
  facts.push({ name: 'win/loss record', needle: /\b\d+\s*[–-]\s*\d+\b|\b\d+W\b/.source, regex: true });
  facts.push({ name: 'rank (#n)', needle: /#\d+\b/.source, regex: true });
  facts.push({ name: 'tier name', needle: /\b(Bronze|Silver|Gold|Platinum|Diamond|Placement|Unranked)\b/.source, regex: true });
  return { facts, raw: { play: { connectedAgent: ag?.name ?? null, autoPlay: play.autoPlay ?? null }, rating, base, unopened: packs?.unopened?.length ?? null, credits: wallet?.credits ?? null } };
}

function dupes(tiles, facts) {
  const out = [];
  for (const f of facts) {
    const re = f.regex ? new RegExp(f.needle, 'i') : null;
    const where = tiles.filter((t) => (re ? re.test(t.text) : t.text.includes(f.needle))).map((t) => `${t.title} (${t.size})`);
    if (where.length > 1) out.push({ fact: f.name, needle: f.regex ? `/${f.needle}/` : f.needle, tiles: where });
  }
  return out;
}

const shot = async (page, name, opts = {}) => {
  try { await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 78, timeout: 30000, ...opts }); } catch (e) { say(`  (still ${name} failed: ${e.message.split('\n')[0]})`); }
};

try {
  for (const [login, who] of [['nova', 'Nova (experienced: weeks of matches, packs opened, credits)'], ['wren', 'Wren (new player: just signed up, starter, one agent, no match yet)']]) {
    const page = await signIn(login);
    const o = (raw.owners[login] = { who });
    say(`\n=== ${who} ===`);

    // 3. Navigation (read once per owner; Nova is admin, Wren is not).
    o.nav = await page.evaluate(() => ({
      side: [...document.querySelectorAll('#nav a, #nav button')].filter((x) => x.offsetParent !== null).map((x) => (x.getAttribute('aria-label') || x.textContent || '').replace(/\s+/g, ' ').trim()),
      top: [...document.querySelectorAll('.topbar a, .topbar button')].filter((x) => x.offsetParent !== null).map((x) => (x.getAttribute('aria-label') || x.textContent || '').replace(/\s+/g, ' ').trim()),
      title: document.querySelector('.topbar h1')?.textContent ?? '',
    }));
    say(`nav (side bar): ${o.nav.side.join(' | ')}`);
    say(`top bar: ${o.nav.top.join(' | ')}`);

    // 1. The recommended board, as a first visit shows it.
    const rules = (await api(page, 'GET', '/api/board')).body.rules;
    await board(page, rules.recommendedWidgets);
    const { facts, raw: fr } = await factsOf(page);
    o.facts = fr;
    o.recommended = await readTiles(page);
    o.recommendedDupes = dupes(o.recommended, facts);
    await shot(page, `${login}-recommended`, { fullPage: true });
    say(`\n[recommended board] ${o.recommended.length} tiles: ${o.recommended.map((t) => `${t.title} ${t.size}`).join(', ')}`);
    say(`  server facts: agent "${fr.play.connectedAgent}", rating ${fr.rating?.rating ? `${Math.round(fr.rating.rating.rating)} ${fr.rating.rating.tier} ±${Math.round(fr.rating.rating.rd)}` : 'none'}, set ${fr.base ? `${fr.base.held}/${fr.base.total}` : '-'}, unopened ${fr.unopened}, credits ${fr.credits}`);
    for (const d of o.recommendedDupes) say(`  SAME FACT IN ${d.tiles.length} TILES: ${d.fact} (${d.needle}) -> ${d.tiles.join(', ')}`);
    if (!o.recommendedDupes.length) say('  no fact found in two tiles');

    // 2. Every tile at S, M, L.
    o.sizes = {};
    for (const size of ['S', 'M', 'L']) {
      await board(page, TYPES.map((type, i) => ({ id: `a${i + 1}`, type, size })));
      const tiles = await readTiles(page);
      o.sizes[size] = tiles;
      o[`dupes${size}`] = dupes(tiles, facts);
      await shot(page, `${login}-all-${size}`, { fullPage: true });
      say(`\n[all twelve at ${size}]`);
      for (const t of tiles) {
        say(`  -- ${t.title} ${t.size} (${t.box.w}x${t.box.h}px, ${t.words} words${t.overflowPx > 1 ? `, OVERFLOWS ${t.overflowPx}px` : ''}${t.hasCanvasOrFrame ? ', live drawing' : ''}; open: ${t.open ?? 'none'})`);
        say(`     text: ${t.text.replace(/\n/g, ' / ').slice(0, 420)}${t.text.length > 420 ? ' …' : ''}`);
        say(`     actions: ${t.actions.length ? t.actions.join(' | ') : 'none'}`);
      }
      for (const d of o[`dupes${size}`]) say(`  SAME FACT IN ${d.tiles.length} TILES at ${size}: ${d.fact} -> ${d.tiles.join(', ')}`);
    }
    // A phone, the recommended board.
    await board(page, rules.recommendedWidgets);
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(800);
    o.phone = await page.evaluate(() => {
      // The page scrolls inside its own container, not the document: take the tallest scroller.
      const h = Math.max(document.documentElement.scrollHeight, ...[...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)).map((e) => e.scrollHeight));
      return { sw: document.documentElement.scrollWidth, w: window.innerWidth, h };
    });
    say(`\n[phone 390px] the recommended board is ${o.phone.h}px tall (${(o.phone.h / 844).toFixed(1)} screens), sideways scroll ${o.phone.sw > o.phone.w ? 'YES' : 'none'}`);
    await shot(page, `${login}-recommended-phone`, { fullPage: true, clip: undefined });
    // Put the recommended board back (what the owner would have).
    await api(page, 'PUT', '/api/board', { widgets: rules.recommendedWidgets });
    await page.context().close();
  }
  say(`\npage errors: ${errors.length ? errors.join(' | ') : 'none'}; external requests: ${external.length ? external.join(', ') : 'none'}`);
} catch (err) {
  say(`the run stopped: ${err && err.stack || err}`);
  process.exitCode = 1;
} finally {
  writeFileSync(join(OUT, 'home-audit.json'), JSON.stringify(raw, null, 1));
  writeFileSync(join(OUT, 'home-audit.txt'), lines.join('\n') + '\n');
  await browser.close();
  try { process.kill(-demo.pid, 'SIGTERM'); } catch { /* gone */ }
}
