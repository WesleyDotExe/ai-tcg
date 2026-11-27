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
// Render session 87 (the hardening pass) added:
//   - Watch live's surround is the dashboard's glass, not the hero panel
//     (owner 2026-11-25, point 11), in light and dark; its arena keeps the
//     neon night;
//   - in Edit board every header keeps its whole name (the move and size
//     buttons sit in a bar over the tile's foot), and no tile changes size;
//   - (retired in render 88: no hero tile is left) text on the dark hero tile is light (contrast 4.5:1 or more against
//     the tile's own background, measured);
//   - (retired in render 91: the Store tile holds no cosmetics) Store M's markup holds exactly the two cosmetics it shows;
//   - two measures borrowed from PR #196 (closed), reported, not failed:
//     which facts spill (past the tile, under its header, into its button)
//     and the largest empty band in each tile (fill.txt; over 40% of the
//     tile's height is listed as OPEN).
// Render session 91 (Packs and Store, owner 2026-11-28 point 9): the Store
// tile holds no cosmetic at any size and draws 0 / 1 / 2 ways to buy packs
// at S / M / L; a Buy opens Cards with the purchase ready to confirm (a
// real click-through: Confirm, and Cancel), and 10 packs it can't afford
// says how many more credits instead of a Buy.
// Render session 88 (the agent tile): My agent is glass like the rest (owner
// 2026-11-27): no tile on Home is the hero panel, in light and dark (the
// hero-contrast check is replaced; agent-states-check.mjs measures the agent
// tile's contrast on the glass from the pixels, in every auto-play state).
// Render session 89 (the Ladder tile): no change to the checks; the Ladder
// tile's states are measured by tile-states-check.mjs ladder.
// Writes stills, fit.txt and check.txt to
// progress/render/evidence/season1-home-grid-s86/ (or the folder given).
//
//   node render/season1/ci/home-grid-check.mjs [outDir]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const season1 = resolve(here, '..');
const OUT = resolve(process.argv[2] ?? join(season1, '..', '..', 'progress', 'render', 'evidence', 'season1-home-grid-s91'));
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
        hero: el.classList.contains('hero'), bg: getComputedStyle(el).backgroundImage + ' ' + getComputedStyle(el).backgroundColor,
        nameCut: (() => { const h = el.querySelector('h3'); return h.scrollWidth > h.clientWidth + 1 || h.clientWidth < 8; })(),
        ...(() => {
          // PR #196's two measures, adapted: what spills where, and the
          // largest empty band between the header's foot and the padding's.
          const visible = (e) => { const q = e.getBoundingClientRect(); const cs = getComputedStyle(e); return q.width > 0 && q.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
          const cs = getComputedStyle(el);
          const pad = { b: parseFloat(cs.paddingBottom), l: parseFloat(cs.paddingLeft), r: parseFloat(cs.paddingRight) };
          const hd = el.querySelector(':scope > header').getBoundingClientRect();
          const btn = el.querySelector(':scope > footer button, :scope > footer .btn');
          const fb = btn ? btn.getBoundingClientRect() : null;
          const spills = new Set();
          for (const e of el.querySelectorAll(':scope > .headline *, :scope > .body *')) {
            if (e.closest('.q') || !visible(e)) continue;
            const q = e.getBoundingClientRect();
            const n = e.closest('[data-fact]')?.dataset.fact ?? 'headline';
            if (q.bottom > r.bottom - pad.b + 1 || q.right > r.right - pad.r + 1 || q.left < r.left + pad.l - 1) spills.add(n + ' past the tile');
            else if (q.top < hd.bottom - 1) spills.add(n + ' under the header');
            else if (fb && q.bottom > fb.top + 1 && q.right > fb.left + 1 && q.left < fb.right - 1 && q.top < fb.bottom) spills.add(n + ' into the button');
          }
          const leaves = [...el.querySelectorAll(':scope > .headline *, :scope > .body *, :scope > footer *')].filter((e) => !e.closest('.q') && visible(e) && (!e.children.length || e.matches('svg, button, .btn, .bar, .ring, .arena916, .spk, .si, .mcard, .unit, .ava')));
          const spans = leaves.map((e) => { const q = e.getBoundingClientRect(); return [q.top, Math.min(q.bottom, r.bottom - pad.b)]; }).sort((x, y) => x[0] - y[0]);
          let at = hd.bottom, band = 0;
          for (const [t, b] of spans) { if (t > at) band = Math.max(band, t - at); at = Math.max(at, b); }
          band = Math.max(band, r.bottom - pad.b - at);
          return { spills: [...spills], band: band / r.height };
        })(),
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

const w0 = (B) => B.tiles.find((t) => t.tile === 'watch');
const fitOf = (t) => (t.overflow > 1 || t.sideways > 1 ? `${t.overflow}px${t.sideways > 1 ? ` (sideways ${t.sideways})` : ''}` : 'fits');
const FIT = {}; // tile -> size -> Map(owner@screen -> result)
const FILL = {}; // tile -> size -> Map(owner@screen -> { band, spills })
const BAND_CEILING = 0.4;

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
          if (!FILL[t.tile]?.[t.size]?.has(`${owner}@${vw}`)) ((FILL[t.tile] ??= {})[t.size] ??= new Map()).set(`${owner}@${vw}`, { band: t.band, spills: t.spills });
        }
        // Watch live's surround is the glass every other tile is (point 11).
        const plain = B.tiles.find((t) => !t.hero && t.tile !== 'watch' && t.tile !== 'agent');
        if (w0(B) && plain) check(!w0(B).hero && w0(B).bg === plain.bg, `${label}: Watch live ${w0(B).size} is the same glass as the other tiles (not the hero panel)`);
        // No hero tile on Home (owner 2026-11-27): My agent is the same glass
        // as every other tile, as Watch live became in render 87. Its text
        // contrast on the glass is measured from the pixels in every state by
        // agent-states-check.mjs (render session 88).
        const ag = B.tiles.find((t) => t.tile === 'agent');
        check(B.tiles.every((t) => !t.hero) && (!ag || !plain || ag.bg === plain.bg), `${label}: no tile is the hero panel; My agent${ag ? ' ' + ag.size : ''} is the same glass as the other tiles`);
        check(!bad.length, `${label}: every tile shows the spec's facts at its size, its name, its question and one next action${bad.length ? ': ' + bad.join('; ') : ''}`);
        const w = w0(B);
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
  const B00 = await readBoard(page);
  await page.click('#edit');
  const Bed = await readBoard(page);
  check(Bed.tiles.every((t, i) => Math.abs(t.height - B00.tiles[i].height) < 0.5 && Math.abs(t.width - B00.tiles[i].width) < 0.5), 'Edit board changes no tile\'s size');
  check(Bed.tiles.every((t) => !t.nameCut), `Edit board: every header keeps its whole name${Bed.tiles.some((t) => t.nameCut) ? ': cut on ' + Bed.tiles.filter((t) => t.nameCut).map((t) => t.tile + ' ' + t.size).join(', ') : ''}`);
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
  await page.goto(PAGE + '?owner=nova&board=S#/home');
  await page.waitForSelector('main .tile');
  await page.click('#edit');
  const BS = await readBoard(page);
  check(BS.tiles.every((t) => !t.nameCut), `Edit board, all S (1440): every 1-unit header keeps its whole name${BS.tiles.some((t) => t.nameCut) ? ': cut on ' + BS.tiles.filter((t) => t.nameCut).map((t) => t.tile).join(', ') : ''}`);
  await shot(page, 'nova-edit-board-all-S', false);
  await page.click('#edit');
  // Render session 91 (owner 2026-11-28 point 9): the Store tile's hero is
  // the packs; no cosmetic in its markup at any size, for either owner.
  const storeM = await page.evaluate(() => { const D = JSON.parse(document.getElementById('data').textContent); return Object.fromEntries(Object.entries(D.owners).map(([k, o]) => [k, Object.values(o.tiles.store).map((h) => ({ cos: /data-fact="cosmetics"|class="si[ "]|data-coin=|#lg-/.test(h), packs: (h.match(/class="pb /g) || []).length }))])); });
  check(Object.values(storeM).every((a) => a.every((x) => !x.cos)) && Object.values(storeM).every((a) => a.map((x) => x.packs).join() === '0,1,2'), `Store: no cosmetic in its markup at S, M or L; packs drawn 0 / 1 / 2 (${JSON.stringify(storeM)})`);
  await page.click('#edit');
  // A Buy on the Store tile opens Cards with that purchase ready to
  // confirm; Confirm says what was bought; Cancel buys nothing.
  await page.goto(PAGE + '?owner=nova#/home');
  await page.waitForSelector('main .tile');
  await page.click('.tile[data-tile="store"] .pb-buy[data-buy="S0:1"]');
  await page.waitForSelector('main .buy .confirm');
  const ask = await page.evaluate(() => ({ hash: location.hash, text: document.querySelector('.buy .confirm p').textContent, ok: document.getElementById('buy-ok')?.textContent, focus: document.activeElement?.id }));
  check(ask.hash === '#/cards' && /Buy 1 Season Zero pack \(5 cards\) for 100 credits\?/.test(ask.text) && /keep 349 credits/.test(ask.text) && ask.ok === 'Buy for 100', `Buy on Store M opens Cards with the purchase ready to confirm ("${ask.text}", "${ask.ok}")`);
  await page.click('#buy-ok');
  const done = await page.evaluate(() => document.querySelector('.buy .saved')?.textContent ?? '');
  check(/^Bought 1 Season Zero pack/.test(done), `Confirm says what was bought ("${done}")`);
  await page.goto(PAGE + '?owner=nova&board=L#/home');
  await page.waitForSelector('main .tile');
  const tenBuy = await page.$('.tile[data-tile="store"] .pb-buy[data-buy="S0:10"]');
  const tenNeed = await page.$eval('.tile[data-tile="store"] .pb[data-count="10"] .pb-need', (e) => e.textContent).catch(() => '');
  check(!tenBuy && tenNeed === '551 more credits', `Store L: 10 packs (1,000) is not buyable on 449 credits; it says "${tenNeed}"`);
  await page.click('.tile[data-tile="store"] .pb-buy[data-buy="S0:1"]');
  await page.waitForSelector('#buy-no');
  await page.click('#buy-no');
  check(await page.evaluate(() => !document.querySelector('.buy')), 'Cancel buys nothing and closes the ask');
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
  const DB = await readBoard(dark);
  const dplain = DB.tiles.find((t) => !t.hero && t.tile !== 'watch' && t.tile !== 'agent');
  check(!w0(DB).hero && w0(DB).bg === dplain.bg, `dark: Watch live ${w0(DB).size} is the same glass as the other tiles`);
  const dag = DB.tiles.find((t) => t.tile === 'agent');
  check(DB.tiles.every((t) => !t.hero) && dag.bg === dplain.bg, `dark: no tile is the hero panel; My agent ${dag.size} is the same glass as the other tiles`);
  const nd = await open({ width: 1440, height: 900 }, '?owner=nova&theme=dark');
  await shot(nd, 'nova-recommended-dark', false);
  await nd.context().close();
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
fitLines.push('The fit table (render sessions 86-87): does each tile\'s content fit its fixed box?');
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
const fillLines = ['The fill table (render session 87, after PR #196): per tile render, the largest empty band', 'between the header and the tile\'s foot (% of the tile\'s height), and what spills where.', `Over ${100 * BAND_CEILING}% is listed as OPEN (the "tiles in groups" sessions' work, like fit.txt).\n`];
let emptyN = 0, spillN = 0, fillAll = 0;
for (const [tile, sizes] of Object.entries(FILL)) for (const size of ['S', 'M', 'L']) {
  if (!sizes[size]) continue;
  for (const [k, v] of sizes[size]) {
    fillAll++;
    const e = v.band > BAND_CEILING; if (e) emptyN++; if (v.spills.length) spillN++;
    fillLines.push(`${(tile + ' ' + size).padEnd(14)} ${k.padEnd(11)} band ${String(Math.round(100 * v.band)).padStart(3)}%${e ? ' OPEN' : '     '}${v.spills.length ? '  spills: ' + v.spills.slice(0, 4).join(', ') : ''}`);
  }
}
fillLines.push(`\n${fillAll} tile renders: ${emptyN} with an empty band over ${100 * BAND_CEILING}%, ${spillN} with something spilling.`);
writeFileSync(join(OUT, 'fill.txt'), fillLines.join('\n') + '\n');
say(`fill: ${emptyN} of ${fillAll} tile renders with an empty band over ${100 * BAND_CEILING}%, ${spillN} with a spill (fill.txt)`);
if (emptyN) open_++;
say(`\n${pass} PASS, ${fail} FAIL, ${open_} OPEN (fit, the next sessions' work)`);
writeFileSync(join(OUT, 'check.txt'), lines.join('\n') + '\n');
await browser.close();
process.exitCode = fail ? 1 : 0;
