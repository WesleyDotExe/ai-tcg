// The Season 1 Home on the owner's uniform grid, in headless Chromium (render
// session 86; it grew out of render 83-84's mockup check, which checked A, B and
// C: A and C are retired). Loads render/season1/output/home.html as Nova (weeks
// in) and Wren (just signed up) and checks what the spec (src/homeSpec.ts), the
// grid (src/homeGrid.ts) and the owner's 2026-11-23 shapes promise:
//   - every tile at every size shows exactly the spec's facts, its name, its
//     question (behind the "?") and one next-action button;
//   - the grid: one square unit; every tile is its shape (S 1x1, M 2x1, L 2x2;
//     Watch live S 1x1, M 1x2, L as many units as its 9:16 arena needs) and
//     sits exactly on the packer's column and row, so every edge lines up; no
//     two tiles overlap; the recommended board on a desktop has no hole;
//   - nothing spills: no fact runs past its tile, under its header or into its
//     footer's button, and no region scrolls inside;
//   - Watch live's arena is whole and 9:16 (within 1%) at M and L; L has the
//     scoreboard, the turn line and both hands; M names and health bars only
//     (no card text); S the names, health, turn and a Live badge;
//   - how well each tile fills its shape: the largest empty band inside it, as
//     a share of its height (the owner's "empty space"), reported per tile and
//     held under a ceiling;
//   - a tablet (2 columns) and a phone (1 column, S faces, Watch live its M):
//     the same grid rules, no sideways scroll;
//   - one home per fact as drawn (Nova's rating only in Ladder, credits only in
//     Store, the agent's name only in My agent and where it plays);
//   - the navigation: five places and Settings; every tile's arrow lands on its
//     page; Home has no wallet or bell, every other page has both;
//   - the "?" shows the question without changing the tile's size; Edit board
//     changes a tile's shape in place and the board repacks on the grid;
//   - light by default, dark on the switch; no page errors, no outside requests.
// Writes stills and check.txt to progress/render/evidence/season1-home-grid-s86/.
//
//   node render/season1/ci/home-check.mjs [outDir]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const season1 = resolve(here, '..');
const OUT = resolve(process.argv[2] ?? join(season1, '..', '..', 'progress', 'render', 'evidence', 'season1-home-grid-s86'));
const PAGE = pathToFileURL(join(season1, 'output', 'home.html')).href;
const data = JSON.parse(readFileSync(join(season1, 'mockup', 'data', 'home-data.json'), 'utf8'));
// The spec, read from its source so the check holds the page to the same lists.
const specSrc = readFileSync(join(season1, 'src', 'homeSpec.ts'), 'utf8');
const SPEC = {};
for (const m of specSrc.matchAll(/id: "(\w+)",\s*name: "[^"]+",[\s\S]*?sizes: \{\s*S: \[([^\]]*)\],\s*M: \[([^\]]*)\],\s*L: \[([^\]]*)\]/g)) {
  const list = (s) => [...s.matchAll(/"(\w+)"/g)].map((x) => x[1]);
  SPEC[m[1]] = { S: list(m[2]), M: list(m[3]), L: list(m[4]) };
}
const OPENS = { agent: 'agent', ladder: 'ladder', watch: 'watch', packs: 'cards', store: 'cards', collection: 'cards', daily: 'ladder', history: 'agent', notif: 'alerts' };
const PLACES = 'Home,My agent,Watch,Cards,Ladder';
/** The largest empty band a tile may have, as a share of its height. */
const EMPTY_CEILING = 0.4;

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

const chromium = await loadPlaywright();
const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };
let pass = 0, fail = 0;
const check = (ok, what) => { if (ok) pass++; else fail++; say(`${ok ? 'PASS' : 'FAIL'} ${what}`); };
const errors = [], external = [];
const fills = [];

async function open(viewport, query = '', hash = '') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && u !== 'about:blank') external.push(u); });
  await page.goto(PAGE + query + hash);
  await page.waitForSelector('main .top');
  await page.waitForTimeout(150);
  return page;
}
const shot = (page, name, full = true) => page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 80, fullPage: full });

/** Everything the check reads off the page, in one pass. */
const readBoard = (page) => page.evaluate(() => {
  const g = document.getElementById('grid');
  const gr = g.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(g).columnGap);
  const n = Number(g.dataset.cols), u = Number(g.dataset.unit);
  const L = HOME_GRID.pack([...g.children].map((t) => ({ tile: t.dataset.tile, size: t.dataset.size })), n, parseFloat(getComputedStyle(g).getPropertyValue('--unit')), gap);
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const tiles = [...g.children].map((el, i) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pad = { t: parseFloat(cs.paddingTop), b: parseFloat(cs.paddingBottom), l: parseFloat(cs.paddingLeft), r: parseFloat(cs.paddingRight) };
    const hd = el.querySelector(':scope > header').getBoundingClientRect();
    const ft = el.querySelector(':scope > footer').getBoundingClientRect();
    const btn = el.querySelector(':scope > footer button, :scope > footer .btn');
    const fb = btn ? btn.getBoundingClientRect() : ft;
    const content = [...el.querySelectorAll(':scope > .headline *, :scope > .body *')].filter((e) => !e.closest('.q') && visible(e));
    const spills = [];
    for (const e of content) {
      const er = e.getBoundingClientRect();
      const name = (e.closest('[data-fact]')?.dataset.fact ?? e.className ?? e.tagName).toString();
      if (er.bottom > r.bottom - pad.b + 1 || er.right > r.right - pad.r + 1 || er.left < r.left + pad.l - 1) spills.push(`${name} past the tile`);
      else if (er.top < hd.bottom - 1) spills.push(`${name} under the header`);
      else if (er.bottom > fb.top + 1 && er.right > fb.left + 1 && er.left < fb.right - 1 && er.top < fb.bottom) spills.push(`${name} into the button`);
    }
    for (const sel of [':scope > .headline', ':scope > .body']) {
      const x = el.querySelector(sel);
      if (x && !x.classList.contains('stage') && (x.scrollHeight > x.clientHeight + 1 || x.scrollWidth > x.clientWidth + 1)) spills.push(`${sel.slice(10)} scrolls (${x.scrollHeight - x.clientHeight}px)`);
    }
    // The largest empty band: the vertical spans the content's leaves cover,
    // from the header's foot to the tile's padding foot.
    const leaves = [...el.querySelectorAll(':scope > .headline *, :scope > .body *, :scope > footer *')].filter((e) => !e.closest('.q') && visible(e) && (!e.children.length || e.matches('svg, button, .btn, .bar, .art, .ring, .arena916, .spk, .si, .mcard, .unit, .hand, .ava')));
    const spans = leaves.map((e) => { const q = e.getBoundingClientRect(); return [q.top, q.bottom]; }).sort((a, b) => a[0] - b[0]);
    let at = hd.bottom, band = 0;
    for (const [t, b] of spans) { if (t > at) band = Math.max(band, t - at); at = Math.max(at, b); }
    band = Math.max(band, r.bottom - pad.b - at);
    const arena = el.querySelector('.arena916');
    const ar = arena && arena.getBoundingClientRect();
    return {
      tile: el.dataset.tile, size: el.dataset.size,
      name: el.querySelector('h3')?.textContent ?? '', question: el.querySelector('.q')?.textContent ?? '',
      facts: [...el.querySelectorAll('[data-fact]')].map((f) => f.dataset.fact),
      buttons: [...el.querySelectorAll(':scope > footer button')].map((x) => x.textContent.trim()),
      text: el.innerText,
      x: r.left - gr.left, y: r.top - gr.top, w: r.width, h: r.height,
      want: L.placed[i], spills, band: band / r.height,
      arena: ar ? { w: ar.width, h: ar.height, inside: ar.left >= r.left - 0.5 && ar.right <= r.right + 0.5 && ar.top >= r.top - 0.5 && ar.bottom <= r.bottom + 0.5, units: [...arena.querySelectorAll('.unit')].map((x) => x.innerText.trim()), hands: arena.querySelectorAll('.hand').length, turn: !!arena.querySelector('.disc'), backs: arena.querySelectorAll('.hand .back').length } : null,
      sideways: Math.max(0, el.scrollWidth - el.clientWidth),
    };
  });
  return { n, u, gap, rows: Number(g.dataset.rows), tiles, sw: document.documentElement.scrollWidth - window.innerWidth, height: document.documentElement.scrollHeight, theme: document.documentElement.dataset.theme };
});

/** The grid's own rules, for one read board. */
function gridChecks(b, label) {
  const bad = [];
  const step = b.u + b.gap;
  for (const t of b.tiles) {
    const p = t.want;
    const w = p.w * b.u + (p.w - 1) * b.gap, h = p.h * b.u + (p.h - 1) * b.gap;
    if (Math.abs(t.x - p.col * step) > 1 || Math.abs(t.y - p.row * step) > 1 || Math.abs(t.w - w) > 1 || Math.abs(t.h - h) > 1) bad.push(`${t.tile} at ${Math.round(t.x)},${Math.round(t.y)} ${Math.round(t.w)}x${Math.round(t.h)} (want col ${p.col} row ${p.row}, ${p.w}x${p.h})`);
    const shape = `${p.w}x${p.h}`;
    const want = t.tile === 'watch' ? (t.size === 'S' ? '1x1' : t.size === 'M' ? '1x2' : null) : { S: '1x1', M: `${Math.min(2, b.n)}x1`, L: `${Math.min(2, b.n)}x2` }[t.size];
    if (want && shape !== want) bad.push(`${t.tile} ${t.size} is ${shape}, not ${want}`);
  }
  check(!bad.length, `${label}: every tile is its shape and sits on the grid (unit ${b.u.toFixed(0)}px, ${b.n} columns, ${b.rows} rows)${bad.length ? ': ' + bad.join('; ') : ''}`);
  const ov = [];
  for (let i = 0; i < b.tiles.length; i++) for (let j = i + 1; j < b.tiles.length; j++) {
    const a = b.tiles[i], c = b.tiles[j];
    if (a.x < c.x + c.w - 1 && c.x < a.x + a.w - 1 && a.y < c.y + c.h - 1 && c.y < a.y + a.h - 1) ov.push(`${a.tile}/${c.tile}`);
  }
  check(!ov.length, `${label}: no two tiles overlap${ov.length ? ': ' + ov.join(', ') : ''}`);
  const sp = b.tiles.filter((t) => t.spills.length || t.sideways > 1);
  check(!sp.length, `${label}: nothing spills out of its tile, under its header or into its button${sp.length ? ': ' + sp.map((t) => `${t.tile} ${t.size}: ${[...new Set(t.spills)].slice(0, 4).join(', ')}`).join('; ') : ''}`);
  for (const t of b.tiles.filter((x) => x.arena && x.size !== 'S' && x.arena.w)) {
    const ratio = t.arena.w / t.arena.h;
    check(Math.abs(ratio / (9 / 16) - 1) < 0.01 && t.arena.inside, `${label}: Watch live ${t.size}'s arena is whole and 9:16 (${Math.round(t.arena.w)}x${Math.round(t.arena.h)}, ${(ratio * 16).toFixed(2)}:16)`);
  }
  check(b.sw <= 0, `${label}: no sideways scroll (${b.sw}px)`);
}

try {
  for (const owner of ['nova', 'wren']) {
    const d = data.owners[owner];
    say(`\n=== ${d.me.name} (${owner === 'nova' ? 'weeks in' : 'just signed up'}) ===`);
    for (const board of ['recommended', 'S', 'M', 'L']) {
      const page = await open({ width: 1440, height: 900 }, `?owner=${owner}&board=${board}`);
      const b = await readBoard(page);
      const label = board === 'recommended' ? 'recommended, 1440' : `all ${board}, 1440`;
      say(`\n[${label}] ${b.tiles.map((t) => `${t.name} ${t.size} ${t.want.w}x${t.want.h}`).join(', ')}`);
      const bad = [];
      for (const t of b.tiles) {
        const want = SPEC[t.tile][t.size];
        if (JSON.stringify([...t.facts].sort()) !== JSON.stringify([...want].sort())) bad.push(`${t.tile} ${t.size} facts ${t.facts.join(',')} != ${want.join(',')}`);
        if (!t.name || !t.question.endsWith('?')) bad.push(`${t.tile} ${t.size} lacks its name or question`);
        if (t.buttons.length !== 1) bad.push(`${t.tile} ${t.size} has ${t.buttons.length} footer buttons`);
        if (/undefined|NaN|\bnull\b|(^|\s)—(\s|$)/.test(t.text)) bad.push(`${t.tile} ${t.size} shows "${(/undefined|NaN|\bnull\b|—/.exec(t.text) || [''])[0]}"`);
      }
      check(!bad.length, `${label}: every tile shows the spec's facts at its size, its name, its question and one next action${bad.length ? ': ' + bad.join('; ') : ''}`);
      gridChecks(b, label);
      if (board === 'recommended') {
        const area = b.tiles.reduce((s, t) => s + t.want.w * t.want.h, 0);
        check(area === b.rows * b.n, `${label}: the recommended board fills ${b.rows} whole rows with no hole (${area} of ${b.rows * b.n} units)`);
      }
      for (const t of b.tiles) fills.push({ owner, board, tile: t.tile, size: t.size, band: t.band });
      const empty = b.tiles.filter((t) => t.band > EMPTY_CEILING);
      say(`  fill (largest empty band, % of height): ${b.tiles.map((t) => `${t.tile} ${t.size} ${Math.round(100 * t.band)}`).join(', ')}`);
      check(!empty.length, `${label}: every tile fills its shape (no empty band over ${100 * EMPTY_CEILING}% of its height)${empty.length ? ': ' + empty.map((t) => `${t.tile} ${t.size} ${Math.round(100 * t.band)}%`).join(', ') : ''}`);
      const watch = b.tiles.find((t) => t.tile === 'watch');
      if (watch && board !== 'recommended') {
        const a = watch.arena;
        if (watch.size === 'S') check(/live/i.test(watch.text) && /Turn \d+/.test(watch.text) && /health/.test(watch.text) && !a, `${label}: Watch live S: the two names, their health, the turn and a Live badge, no arena`);
        if (watch.size === 'M') check(a && a.hands === 0 && a.units.every((u) => /^\d+\/\d+$/.test(u)) && !/in hand/.test(watch.text), `${label}: Watch live M: names and health bars over the arena, no card text (units ${a.units.join(' ')}), no hand details`);
        if (watch.size === 'L') check(a && a.hands === 2 && a.turn && a.backs > 0 && /live/i.test(watch.text) && /of \d+ health/.test(watch.text) && watch.want.h === await page.evaluate(() => HOME_GRID.watchRows(2, Number(document.getElementById('grid').dataset.unit), 16)), `${label}: Watch live L: ${watch.want.w}x${watch.want.h} units (the rows its arena needs), the scoreboard, the turn line and both hands (${a.backs} card backs)`);
      }
      if (owner === 'nova') {
        const rating = String(Math.round(d.rating.rating.rating)).replace(/\B(?=(\d{3})+$)/g, ',');
        const credits = String(d.wallet.credits);
        const agent = d.play.connectedAgent.name;
        const live = d.live.matches.find((m) => m.matchId === d.live.mine) ?? d.live.matches[0];
        const inMatch = live && [live.p1.agentName, live.p2.agentName].includes(agent);
        const where = (needle) => b.tiles.filter((t) => t.text.includes(needle)).map((t) => t.tile);
        const many = d.play.agents.length > 1;
        const r = where(rating), c = where(credits), a = where(agent).filter((x) => !(x === 'watch' && inMatch) && !(x === 'notif' && many));
        check(r.every((x) => x === 'ladder') && c.every((x) => x === 'store') && a.every((x) => x === 'agent'), `${label}: one home per fact: the rating (${rating}) in ${r.join(', ') || 'none'}, the credits (${credits}) in ${c.join(', ') || 'none'}, the agent's name in ${a.join(', ') || 'none'}${inMatch ? ' (and Watch live, where it plays)' : ''}`);
      }
      if (owner === 'wren') {
        const all = b.tiles.map((t) => t.text).join('\n');
        check(!/±\s*\d|Placement · 0 rated|0 since a|No packs opened yet|credits short/.test(all), `${label}: the new player sees none of the labels the audit flagged`);
      }
      await shot(page, `${owner}-${board === 'recommended' ? 'recommended' : 'all-' + board}`);
      await page.context().close();
    }
    for (const [vp, name, boards] of [[{ width: 1024, height: 768 }, 'tablet 1024', ['recommended', 'L']], [{ width: 390, height: 844 }, 'phone 390', ['recommended', 'L']]]) {
      for (const board of boards) {
        const page = await open(vp, `?owner=${owner}&board=${board}`);
        const b = await readBoard(page);
        const label = `${name}, ${board === 'recommended' ? 'recommended' : 'all ' + board}`;
        say(`\n[${label}] ${b.n} columns, unit ${b.u.toFixed(0)}px, ${b.height}px tall (${(b.height / vp.height).toFixed(1)} screens): ${b.tiles.map((t) => `${t.tile} ${t.size} ${t.want.w}x${t.want.h}`).join(', ')}`);
        gridChecks(b, label);
        say(`  fill: ${b.tiles.map((t) => `${t.tile} ${t.size} ${Math.round(100 * t.band)}`).join(', ')}`);
        if (vp.width <= 720) {
          check(b.n === 1 && b.tiles.every((t) => t.size === (t.tile === 'watch' ? 'M' : 'S')), `${label}: one column; every tile its S face, Watch live its 9:16 M`);
          const places = await page.$$eval('.places .nav', (xs) => xs.filter((x) => x.offsetParent !== null).map((x) => x.textContent.trim()));
          check(places.join(',') === PLACES, `${label}: the five places in a row under the brand (${places.join(' | ')})`);
        } else check(b.n === 2, `${label}: two columns`);
        await shot(page, `${owner}-${name.split(' ')[0]}-${board === 'recommended' ? 'recommended' : 'all-' + board}`);
        await page.context().close();
      }
    }
  }

  say(`\n=== navigation, the "?", Edit board and the theme (Nova, 1440x900) ===`);
  const page = await open({ width: 1440, height: 900 }, '?owner=nova&board=S');
  const nav = await page.$$eval('.topnav .nav', (xs) => xs.map((x) => (x.querySelector('span') ?? x).textContent.trim()));
  check(nav.length === 6 && nav.slice(0, 5).join(',') === PLACES && nav[5] === 'Settings', `five places, then Settings: ${nav.join(' | ')}`);
  check(await page.$$eval('.topnav .wallet, .topnav .bell', (x) => x.length) === 0, 'Home has no wallet or bell (the Store and Notifications tiles are their homes)');
  check(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'light by default (the owner\'s call 4)');
  const arrows = [];
  for (const [tile, want] of Object.entries(OPENS)) {
    await page.goto(PAGE + '?owner=nova&board=S#/home');
    await page.waitForSelector('main .tile');
    await page.click(`.tile[data-tile="${tile}"] header .open`);
    await page.waitForSelector('main .pg');
    const h = await page.evaluate(() => location.hash);
    arrows.push(h === `#/${want}` ? `${tile} -> ${h}` : `${tile} -> ${h} (want #/${want})`);
  }
  check(!arrows.some((a) => a.includes('want')), `every tile arrow opens its page: ${arrows.join(', ')}`);
  for (const p of ['agent', 'watch', 'cards', 'ladder']) {
    await page.goto(PAGE + `?owner=nova#/${p}`);
    await page.waitForSelector('main .pg');
    const t = await page.evaluate(() => ({ h1: document.querySelector('main h1').textContent, wallet: !!document.querySelector('.topnav .wallet'), bell: !!document.querySelector('.topnav .bell'), cur: document.querySelector('.places .nav[aria-current="page"] span')?.textContent.trim() }));
    check(t.wallet && t.bell && t.cur === t.h1, `${t.h1}: the wallet and the bell are there, and the navigation marks it`);
  }
  await shot(page, 'nova-cards-page', false);
  await page.goto(PAGE + '?owner=wren&board=M#/home');
  await page.waitForSelector('main .tile');
  await page.click('.tile[data-tile="notif"] a[data-to="daily"]').catch(() => {});
  check(await page.$eval('.tile[data-tile="daily"]', (e) => e.classList.contains('flash')).catch(() => false), 'the free pack\'s alert shows the Daily rewards tile (where it is claimed)');
  await page.goto(PAGE + '?owner=wren#/home');
  await page.waitForSelector('main .tile');
  const size0 = await page.$eval('.tile[data-tile="ladder"]', (e) => e.getBoundingClientRect().height);
  const before = await page.$eval('.tile[data-tile="ladder"] .q', (e) => getComputedStyle(e).display);
  await page.click('.tile[data-tile="ladder"] .qb');
  const after = await page.$eval('.tile[data-tile="ladder"]', (e) => ({ d: getComputedStyle(e.querySelector('.q')).display, t: e.querySelector('.q').textContent, h: e.getBoundingClientRect().height }));
  check(before === 'none' && after.d !== 'none' && after.t.endsWith('?') && Math.abs(after.h - size0) < 0.5, `the "?" shows the tile's question over the tile, which keeps its size (${Math.round(size0)}px): "${after.t}"`);
  await shot(page, 'wren-question-open', false);
  await page.goto(PAGE + '?owner=nova#/home');
  await page.waitForSelector('main .tile');
  await page.click('#edit');
  await page.click('.tile[data-tile="ladder"] .edit button[data-sz="S"]');
  await page.waitForTimeout(100);
  const eb = await readBoard(page);
  const lad = eb.tiles.find((t) => t.tile === 'ladder');
  check(lad.size === 'S' && lad.want.w === 1 && lad.want.h === 1, `Edit board: Ladder L -> ${lad.size} (${lad.want.w}x${lad.want.h})`);
  gridChecks(eb, 'after Edit board');
  await shot(page, 'nova-edit-board', false);
  await page.context().close();
  const dark = await open({ width: 1440, height: 900 }, '?owner=nova');
  await dark.click('#m-theme button[data-theme="dark"]');
  check(await dark.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'the theme switch turns it dark');
  await shot(dark, 'nova-recommended-dark', false);
  await dark.context().close();

  check(!errors.length, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  check(!external.length, `no outside requests${external.length ? ': ' + external.join(', ') : ''}`);
} catch (e) {
  fail++;
  say(`FAIL the run stopped: ${e && e.stack || e}`);
}
const worst = [...fills].sort((a, b) => b.band - a.band).slice(0, 6);
say(`\nleast filled at 1440 (largest empty band): ${worst.map((f) => `${f.tile} ${f.size} (${f.owner}, ${f.board}) ${Math.round(100 * f.band)}%`).join(', ')}`);
say(`\n${pass} PASS, ${fail} FAIL`);
writeFileSync(join(OUT, 'check.txt'), lines.join('\n') + '\n');
await browser.close();
process.exitCode = fail ? 1 : 0;
