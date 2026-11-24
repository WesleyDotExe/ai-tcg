// The Season 1 Home on the uniform grid (render session 86), in headless
// Chromium. Loads render/season1/output/home.html as Nova (weeks in) and
// Wren (just signed up) and checks what the owner's 2026-11-23 grid decision
// and the spec promise:
//   - the grid: every tile is S 1x1, M 2x1 or L 2x2 units (Watch live S 1x1,
//     M 1x2, L 2 x the rows its whole 9:16 arena needs), drawn exactly that
//     size on square units, every edge on a grid line, no two tiles
//     overlapping, placed where the layout code (homeGrid.ts) says; the
//     recommended board has no hole at 1440, 1280 and 1024 px;
//   - Watch live: its arena is 9:16 and wholly inside the tile at M and L;
//     S has the names, health, the turn, a Live badge and Watch;
//   - every tile at every size shows the spec's facts, its name, its question
//     (behind the "?", opening over the tile without resizing it) and one
//     next action;
//   - the fit table: for every tile, size, owner and screen, whether its
//     content fits its box (and by how many px it doesn't). This is the
//     measure the "tiles in groups" sessions drive to zero. It is reported
//     (fit.txt), not failed: the tiles that don't fit yet are listed as OPEN
//     lines, the work the next sessions own;
//   - the navigation (B's top bar): five places and Settings; on a phone five
//     places; every arrow opens its page; Home has no wallet or bell, every
//     other page has both;
//   - light by default, dark as the option;
//   - Edit board shows the grid's cells and a resize snaps to them;
//   - no page errors and no outside requests; no sideways scroll.
// Writes stills, fit.txt and check.txt to
// progress/render/evidence/season1-home-grid-s86/ (or the folder given).
//
//   node render/season1/ci/home-grid-check.mjs [outDir]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const season1 = resolve(here, '..');
const OUT = resolve(process.argv[2] ?? join(season1, '..', '..', 'progress', 'render', 'evidence', 'season1-home-grid-s86'));
mkdirSync(OUT, { recursive: true });
const PAGE = pathToFileURL(join(season1, 'output', 'home.html')).href;
const data = JSON.parse(readFileSync(join(season1, 'mockup', 'data', 'home-data.json'), 'utf8'));
const html = readFileSync(join(season1, 'output', 'home.html'), 'utf8');
const payload = JSON.parse(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1]);
const G = payload.grid;
// The layout code, from the page itself (the same text the tests evaluate).
const gridJs = /<script>(\s*function columnsFor[\s\S]*?)<\/script>/.exec(html)[1];
const L = new Function(`${gridJs}; return { columnsFor, watchArena, shapeOf, packBoard };`)();
const specSrc = readFileSync(join(season1, 'src', 'homeSpec.ts'), 'utf8');
const SPEC = {};
for (const m of specSrc.matchAll(/id: "(\w+)",\s*name: "[^"]+",[\s\S]*?sizes: \{\s*S: \[([^\]]*)\],\s*M: \[([^\]]*)\],\s*L: \[([^\]]*)\]/g)) {
  const list = (s) => [...s.matchAll(/"(\w+)"/g)].map((x) => x[1]);
  SPEC[m[1]] = { S: list(m[2]), M: list(m[3]), L: list(m[4]) };
}
const OPENS = { agent: 'agent', ladder: 'ladder', watch: 'watch', packs: 'cards', store: 'cards', collection: 'cards', daily: 'ladder', history: 'agent', notif: 'alerts' };
const PLACES = 'Home,My agent,Watch,Cards,Ladder';

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright/index.mjs', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright not found (set PW_CORE to its index.mjs)');
}

const chromium = await loadPlaywright();
const browser = await chromium.launch();
const lines = [], fitLines = [];
const say = (s = '') => { lines.push(s); console.log(s); };
let pass = 0, fail = 0, open_ = 0;
const check = (ok, what) => { if (ok) pass++; else fail++; say(`${ok ? 'PASS' : 'FAIL'} ${what}`); };
const errors = [], external = [];

async function open(viewport, query = '', hash = '') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && u !== 'about:blank') external.push(u); });
  await page.goto(PAGE + query + hash);
  await page.waitForSelector('main .top');
  await page.waitForTimeout(100);
  return page;
}
const shot = (page, name, full = true) => page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 80, fullPage: full });

const readBoard = (page) => page.evaluate(() => {
  const g = document.getElementById('grid');
  const gr = g.getBoundingClientRect();
  return {
    cols: Number(g.dataset.cols), unit: Number(g.dataset.unit), rows: Number(g.dataset.rows), holes: Number(g.dataset.holes), gap: parseFloat(getComputedStyle(g).columnGap), gx: gr.left, gy: gr.top, gw: gr.width,
    tiles: [...g.querySelectorAll(':scope > .tile')].map((el) => {
      const b = el.querySelector('.body');
      const r = el.getBoundingClientRect();
      const a = el.querySelector('.arena916');
      const ar = a && a.getBoundingClientRect();
      // What doesn't fit: the tile's own scroll overflow, the body's, and any
      // part of a direct child that ends past the tile's padding box.
      const pb = parseFloat(getComputedStyle(el).paddingBottom);
      const past = Math.max(0, ...[...el.children].filter((c) => !c.classList.contains('q') && getComputedStyle(c).display !== 'none').map((c) => c.getBoundingClientRect().bottom - (r.bottom - pb)));
      return {
        tile: el.dataset.tile, size: el.dataset.size, x: Number(el.dataset.x), y: Number(el.dataset.y), w: Number(el.dataset.w), h: Number(el.dataset.h),
        left: r.left, top: r.top, width: r.width, height: r.height,
        name: el.querySelector('h3')?.textContent ?? '', question: el.querySelector('.q')?.textContent ?? '',
        facts: [...el.querySelectorAll('[data-fact]')].map((f) => f.dataset.fact),
        buttons: [...el.querySelectorAll('footer button')].map((x) => x.textContent.trim()),
        live: !!el.querySelector('[data-live]') && getComputedStyle(el.querySelector('[data-live]')).display !== 'none',
        text: el.innerText,
        overflow: Math.round(Math.max(0, el.scrollHeight - el.clientHeight, b ? b.scrollHeight - b.clientHeight : 0, past)),
        sideways: Math.max(0, el.scrollWidth - el.clientWidth),
        arena: ar ? { w: ar.width, h: ar.height, inside: ar.left >= r.left - 0.5 && ar.right <= r.right + 0.5 && ar.top >= r.top - 0.5 && ar.bottom <= r.bottom + 0.5 } : null,
      };
    }),
  };
});

/** The grid's own checks on one board read. */
function gridChecks(B, label, wantNoHoles) {
  const bad = [];
  const shapes = B.tiles.map((t) => L.shapeOf(t.tile, t.size, B.unit, B.gap, G));
  const pk = L.packBoard(shapes, B.cols);
  B.tiles.forEach((t, i) => {
    const s = shapes[i], q = pk.placed[i];
    if (t.w !== s.w || t.h !== s.h) bad.push(`${t.tile} ${t.size} is ${t.w}x${t.h}, want ${s.w}x${s.h}`);
    if (t.x !== q.x || t.y !== q.y) bad.push(`${t.tile} at ${t.x},${t.y}, the layout says ${q.x},${q.y}`);
    const wantW = s.w * B.unit + (s.w - 1) * B.gap, wantH = s.h * B.unit + (s.h - 1) * B.gap;
    if (Math.abs(t.width - wantW) > 1.5 || Math.abs(t.height - wantH) > 1.5) bad.push(`${t.tile} ${t.size} drawn ${t.width.toFixed(0)}x${t.height.toFixed(0)}, want ${wantW.toFixed(0)}x${wantH.toFixed(0)}`);
    const ex = B.gx + q.x * (B.unit + B.gap), ey = B.gy + q.y * (B.unit + B.gap);
    if (Math.abs(t.left - ex) > 1.5 || Math.abs(t.top - ey) > 1.5) bad.push(`${t.tile} off its grid line by ${(t.left - ex).toFixed(1)},${(t.top - ey).toFixed(1)}`);
  });
  const ov = [];
  for (let i = 0; i < B.tiles.length; i++) for (let j = i + 1; j < B.tiles.length; j++) {
    const a = B.tiles[i], b = B.tiles[j];
    if (a.left < b.left + b.width - 1 && b.left < a.left + a.width - 1 && a.top < b.top + b.height - 1 && b.top < a.top + a.height - 1) ov.push(`${a.tile}/${b.tile}`);
  }
  check(!bad.length && !ov.length, `${label}: every tile its shape on the ${B.cols}-column grid (unit ${B.unit}px, square), on its grid lines, where the layout code says, none overlapping${bad.length || ov.length ? ': ' + [...bad, ...ov].join('; ') : ''}`);
  if (wantNoHoles) check(B.holes === 0 && pk.holes === 0, `${label}: the recommended board has no hole (${B.rows} rows)`);
}

const fitOf = (t) => (t.overflow > 1 || t.sideways > 1 ? `${t.overflow}px${t.sideways > 1 ? ` (sideways ${t.sideways})` : ''}` : 'fits');
const FIT = {}; // tile -> size -> Map(owner@screen -> result)

try {
  for (const owner of ['nova', 'wren']) {
    const d = data.owners[owner];
    say(`\n=== ${d.me.name} (${owner === 'nova' ? 'weeks in' : 'just signed up'}) ===`);
    for (const vw of [1440, 1280, 1024]) {
      for (const board of ['recommended', 'S', 'M', 'L']) {
        if (vw !== 1440 && board !== 'recommended' && board !== 'M' && board !== 'L') continue;
        const page = await open({ width: vw, height: 900 }, `?owner=${owner}&board=${board}`);
        const B = await readBoard(page);
        const label = `[${board === 'recommended' ? 'recommended' : 'all ' + board}, ${vw}x900]`;
        say(`\n${label} ${B.cols} columns, unit ${B.unit}px, ${B.rows} rows, ${B.holes} holes: ${B.tiles.map((t) => `${t.tile} ${t.size} ${t.w}x${t.h}@${t.x},${t.y}`).join(', ')}`);
        gridChecks(B, label, board === 'recommended');
        const bad = [];
        for (const t of B.tiles) {
          const want = SPEC[t.tile][t.size];
          if (JSON.stringify([...t.facts].sort()) !== JSON.stringify([...want].sort())) bad.push(`${t.tile} ${t.size} facts ${t.facts.join(',')} != ${want.join(',')}`);
          if (!t.name || !t.question.endsWith('?')) bad.push(`${t.tile} ${t.size} lacks its name or question`);
          if (t.buttons.length !== 1) bad.push(`${t.tile} ${t.size} has ${t.buttons.length} footer buttons`);
          if (/undefined|NaN|\bnull\b|(^|\s)—(\s|$)/.test(t.text)) bad.push(`${t.tile} ${t.size} shows a placeholder`);
          ((FIT[t.tile] ??= {})[t.size] ??= new Map()).set(`${owner}@${vw}`, fitOf(t));
        }
        check(!bad.length, `${label}: every tile shows the spec's facts at its size, its name, its question and one next action${bad.length ? ': ' + bad.join('; ') : ''}`);
        const w = B.tiles.find((t) => t.tile === 'watch');
        if (w && w.size !== 'S' && owner === 'nova') {
          const r = w.arena.w / w.arena.h;
          check(Math.abs(r - 9 / 16) < 0.01 && w.arena.inside, `${label}: Watch live ${w.size}'s arena is 9:16 (${w.arena.w.toFixed(0)}x${w.arena.h.toFixed(0)}) and wholly inside the tile`);
          if (w.size === 'L') {
            const wa = L.watchArena(B.unit, B.gap, G);
            check(w.h === wa.rows && w.arena.w >= wa.arenaW - 24, `${label}: Watch live L is 2 x ${w.h} units, the rows its whole arena needs at this unit; the arena ${w.arena.w.toFixed(0)}px wide (the tile's width less its padding: ${wa.arenaW}px)`);
          }
        }
        if (w && w.size === 'S' && owner === 'nova') check(w.live && /turn \d+/.test(w.text) && /health/.test(w.text) && w.buttons[0] === 'Watch', `${label}: Watch live S has the names, health, the turn, a Live badge and Watch`);
        if (board === 'recommended') {
          const over = B.tiles.filter((t) => t.overflow > 1 || t.sideways > 1);
          if (over.length) { open_++; say(`OPEN ${label}: not every tile fits its box yet (the "tiles in groups" sessions): ${over.map((t) => `${t.tile} ${t.size} by ${fitOf(t)}`).join(', ')}`); }
          else say(`(fit) ${label}: every tile fits its box`);
        }
        const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(sw <= 0, `${label}: no sideways scroll (${sw}px)`);
        if (vw === 1440) await shot(page, `${owner}-${board === 'recommended' ? 'recommended' : 'all-' + board}`);
        await page.context().close();
      }
    }
    const phone = await open({ width: 390, height: 844 }, `?owner=${owner}`);
    const P = await readBoard(phone);
    const ph = await phone.evaluate(() => ({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth - window.innerWidth, tabs: [...document.querySelectorAll('.places .nav')].map((x) => x.textContent.trim()) }));
    say(`\n[phone 390x844] ${P.cols} columns, unit ${P.unit}px, ${P.rows} rows, ${P.holes} holes, ${ph.h}px tall (${(ph.h / 844).toFixed(1)} screens); places: ${ph.tabs.join(' | ')}`);
    gridChecks(P, '[phone 390x844]', false);
    check(P.cols === 2 && P.tiles.every((t) => t.size === (t.tile === 'watch' && t.size !== 'S' ? 'M' : 'S')), 'phone: two columns, every tile its S face (Watch live its 9:16 M)');
    check(ph.sw <= 0 && ph.tabs.length === 5, `phone: five places, no sideways scroll (${ph.sw}px)`);
    for (const t of P.tiles) ((FIT[t.tile] ??= {})[t.size] ??= new Map()).set(`${owner}@390`, fitOf(t));
    await shot(phone, `${owner}-phone`);
    await phone.context().close();
  }

  say(`\n=== navigation, theme, Edit board (Nova, 1440x900) ===`);
  const page = await open({ width: 1440, height: 900 }, '?owner=nova');
  const theme = await page.evaluate(() => ({ t: document.documentElement.dataset.theme, bg: getComputedStyle(document.querySelector('.tile:not(.hero)')).backgroundColor }));
  check(theme.t === 'light', `light by default (${theme.t}; a tile's glass ${theme.bg})`);
  const nav = await page.$$eval('.topnav .nav', (xs) => xs.map((x) => (x.querySelector('span') ?? x).textContent.trim()));
  check(nav.length === 6 && nav.slice(0, 5).join(',') === PLACES && nav[5] === 'Settings', `the top bar: five places, then Settings (${nav.join(' | ')})`);
  check(await page.$$eval('.topnav .wallet, .topnav .bell', (x) => x.length) === 0, 'Home has no wallet or bell (Store and Notifications own them)');
  // The "?" opens over the tile without resizing it.
  const before = await page.$eval('.tile[data-tile="ladder"]', (e) => e.getBoundingClientRect().height);
  await page.click('.tile[data-tile="ladder"] .qb');
  const q = await page.$eval('.tile[data-tile="ladder"]', (e) => ({ h: e.getBoundingClientRect().height, d: getComputedStyle(e.querySelector('.q')).display, t: e.querySelector('.q').textContent }));
  check(q.d !== 'none' && q.t.endsWith('?') && Math.abs(q.h - before) < 0.5, `the "?" shows the question over the tile, its size unchanged (${before}px): "${q.t}"`);
  await shot(page, 'nova-question-open', false);
  await page.click('.tile[data-tile="ladder"] .qb');
  // Edit board: the cells show, and a resize snaps.
  await page.click('#edit');
  const cells = await page.$$eval('#grid > .cell', (x) => x.length);
  const B0 = await readBoard(page);
  check(cells === B0.cols * (B0.rows + 1), `Edit board shows the grid's cells (${cells}: ${B0.cols} columns x ${B0.rows + 1} rows)`);
  await page.click('.tile[data-tile="store"] .edit button[data-sz="L"]');
  await page.click('.tile[data-tile="watch"] .edit button[data-sz="L"]');
  const B1 = await readBoard(page);
  const st = B1.tiles.find((t) => t.tile === 'store'), wl = B1.tiles.find((t) => t.tile === 'watch');
  check(st.size === 'L' && st.w === 2 && st.h === 2 && wl.size === 'L', `Edit board: Store -> L (2x2 at ${st.x},${st.y}), Watch live -> L (2x${wl.h})`);
  gridChecks(B1, '[after the resize]', false);
  await shot(page, 'nova-edit-board');
  await page.click('#edit');
  const arrows = [];
  for (const [tile, want] of Object.entries(OPENS)) {
    await page.goto(PAGE + '?owner=nova&board=S#/home');
    await page.waitForSelector('main .tile');
    await page.click(`.tile[data-tile="${tile}"] header .open`);
    await page.waitForSelector('main .pg');
    const h = await page.evaluate(() => location.hash);
    if (h !== `#/${want}`) arrows.push(`${tile} -> ${h} (want #/${want})`);
  }
  check(!arrows.length, `every tile's arrow opens its page${arrows.length ? ': ' + arrows.join(', ') : ''}`);
  for (const p of ['agent', 'watch', 'cards', 'ladder']) {
    await page.goto(PAGE + `?owner=nova#/${p}`);
    await page.waitForSelector('main .pg');
    const t = await page.evaluate(() => ({ h1: document.querySelector('main h1').textContent, wallet: !!document.querySelector('.topnav .wallet'), bell: !!document.querySelector('.topnav .bell'), cur: document.querySelector('.places .nav[aria-current="page"] span')?.textContent.trim() }));
    check(t.wallet && t.bell && t.cur === t.h1, `${t.h1}: the wallet and the bell are in the top bar, and the bar marks the page`);
  }
  await page.context().close();
  const dark = await open({ width: 1440, height: 900 }, '?owner=wren&theme=dark');
  check(await dark.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'dark is the option (?theme=dark, or the strip)');
  await shot(dark, 'wren-recommended-dark', false);
  await dark.context().close();
  const L1440 = await open({ width: 1440, height: 900 }, '?owner=nova&board=L');
  await L1440.evaluate(() => document.querySelector('.tile[data-tile="watch"]').scrollIntoView());
  await shot(L1440, 'nova-watch-L', false);
  await L1440.context().close();

  check(!errors.length, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  check(!external.length, `no outside requests${external.length ? ': ' + external.join(', ') : ''}`);
} catch (e) {
  fail++;
  say(`FAIL the run stopped: ${e && e.stack || e}`);
}

// The fit table.
let fits = 0, all = 0;
fitLines.push('The fit table (render session 86): does each tile\'s content fit its fixed box?');
fitLines.push('Each cell: owner@screen width: "fits", or how many px of content run past the box.');
fitLines.push('The "tiles in groups" sessions drive this to all "fits".\n');
for (const [tile, sizes] of Object.entries(FIT)) for (const size of ['S', 'M', 'L']) {
  if (!sizes[size]) continue;
  const rs = [...sizes[size]].map(([k, v]) => `${k}: ${v}`);
  const ok = rs.filter((r) => r.endsWith('fits')).length;
  fits += ok; all += rs.length;
  fitLines.push(`${(tile + ' ' + size).padEnd(14)} ${String(ok).padStart(2)} of ${String(rs.length).padStart(2)} fit   ${rs.filter((r) => !r.endsWith('fits')).join(' · ')}`);
}
fitLines.push(`\n${fits} of ${all} tile renders fit.`);
writeFileSync(join(OUT, 'fit.txt'), fitLines.join('\n') + '\n');
say(`\nfit: ${fits} of ${all} tile renders fit (fit.txt)`);
say(`\n${pass} PASS, ${fail} FAIL, ${open_} OPEN (fit, the next sessions' work)`);
writeFileSync(join(OUT, 'check.txt'), lines.join('\n') + '\n');
await browser.close();
process.exitCode = fail ? 1 : 0;
