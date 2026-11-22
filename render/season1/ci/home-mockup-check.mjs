// Season 1 Home mockups A, B and C in headless Chromium (render session 83
// for A; render session 84 made it check all three). Loads each built page
// (render/season1/output/home-mockup-{a,b,c}.html) as Nova (weeks in) and
// Wren (just signed up), at a desktop (1440x900) and a phone (390x844), and
// checks what the spec (season1/src/homeSpec.ts) and each mockup promise:
//   - every tile at every size shows exactly the spec's facts, and wears its
//     name, its question (on the tile, or behind B's "?") and one
//     next-action button;
//   - nothing overflows its tile, tiles never overlap, and the page never
//     scrolls sideways;
//   - one home per fact, as drawn: Nova's rating only in Ladder, her credits
//     only in Store, the agent's name only in My agent (and in Watch live,
//     while it is a player in the featured match, and on alerts: two agents);
//   - no "undefined", "NaN" or bare "—" anywhere;
//   - the navigation: five places and Settings; on a phone, five places;
//     every tile's arrow lands on the page the mockup says; Home has no
//     wallet or bell, every other page has both;
//   - the rail's glass runs the page's full height (A and C: the owner's
//     note on A);
//   - B: the "?" shows the tile's question; C: the tiles that need you come
//     first, in the order needsOf gives, each with its reason, and the jump
//     palette finds a tile;
//   - Edit board changes a tile's size in place;
//   - no page errors and no outside requests.
// Writes stills and check.txt per mockup to
// progress/render/evidence/season1-home-mockups-s84/<a|b|c>/.
//
//   node render/season1/ci/home-mockup-check.mjs [a|b|c|all] [outDir]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const season1 = resolve(here, '..');
const which = ['a', 'b', 'c'].includes(process.argv[2]) ? [process.argv[2]] : ['a', 'b', 'c'];
const OUT_ROOT = resolve(process.argv[3] ?? join(season1, '..', '..', 'progress', 'render', 'evidence', 'season1-home-mockups-s84'));
const data = JSON.parse(readFileSync(join(season1, 'mockup', 'data', 'home-data.json'), 'utf8'));
// The spec, read from its source so the check holds the pages to the same lists.
const specSrc = readFileSync(join(season1, 'src', 'homeSpec.ts'), 'utf8');
const SPEC = {};
for (const m of specSrc.matchAll(/id: "(\w+)",\s*name: "[^"]+",[\s\S]*?sizes: \{\s*S: \[([^\]]*)\],\s*M: \[([^\]]*)\],\s*L: \[([^\]]*)\]/g)) {
  const list = (s) => [...s.matchAll(/"(\w+)"/g)].map((x) => x[1]);
  SPEC[m[1]] = { S: list(m[2]), M: list(m[3]), L: list(m[4]) };
}
const OPENS = { agent: 'agent', ladder: 'ladder', watch: 'watch', packs: 'cards', store: 'cards', collection: 'cards', daily: 'ladder', history: 'agent', notif: 'alerts' };
const PLACES = 'Home,My agent,Watch,Cards,Ladder';

/** What differs between the three pages, for the check. */
const MOCK = {
  a: { file: 'home-mockup-a.html', nav: '.rail .nav', current: '.rail .nav[aria-current="page"]', phoneNav: '.tabs .nav', wallet: 'main .top .wallet', bell: 'main .top .bell', rail: '.rail', masonry: false },
  b: { file: 'home-mockup-b.html', nav: '.topnav .nav', current: '.places .nav[aria-current="page"]', phoneNav: '.places .nav', wallet: '.topnav .wallet', bell: '.topnav .bell', rail: null, masonry: true },
  c: { file: 'home-mockup-c.html', nav: '.rail .nav', current: '.rail .nav[aria-current="page"]', phoneNav: '.tabs .nav', wallet: 'main .top .wallet', bell: 'main .top .bell', rail: '.rail', masonry: true },
};

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

const chromium = await loadPlaywright();
const browser = await chromium.launch();
let totalFail = 0;

const readTiles = (page) => page.evaluate(() => [...document.querySelectorAll('main .tile')].map((el) => {
  const b = el.querySelector('.body');
  const r = el.getBoundingClientRect();
  return {
    tile: el.dataset.tile, size: el.dataset.size,
    name: el.querySelector('h3')?.textContent ?? '', question: el.querySelector('.q')?.textContent ?? '',
    facts: [...el.querySelectorAll('[data-fact]')].map((f) => f.dataset.fact),
    buttons: [...el.querySelectorAll('footer button')].map((x) => x.textContent.trim()),
    text: el.innerText, need: el.querySelector('.nd')?.textContent ?? null,
    x: r.left + scrollX, y: r.top + scrollY, w: Math.round(r.width), h: Math.round(r.height),
    overflow: Math.max(0, el.scrollHeight - el.clientHeight, b ? b.scrollHeight - b.clientHeight : 0),
    sideways: Math.max(0, el.scrollWidth - el.clientWidth),
  };
}));
const overlaps = (ts) => {
  const out = [];
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
    const a = ts[i], b = ts[j];
    if (a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1) out.push(`${a.tile}/${b.tile}`);
  }
  return out;
};

for (const id of which) {
  const M = MOCK[id];
  const PAGE = pathToFileURL(join(season1, 'output', M.file)).href;
  const OUT = join(OUT_ROOT, id);
  mkdirSync(OUT, { recursive: true });
  const lines = [];
  const say = (s = '') => { lines.push(s); console.log(s); };
  let pass = 0, fail = 0;
  const check = (ok, what) => { if (ok) pass++; else fail++; say(`${ok ? 'PASS' : 'FAIL'} ${what}`); };
  const errors = [], external = [];
  const html = readFileSync(join(season1, 'output', M.file), 'utf8');
  const payload = JSON.parse(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1]);
  async function open(viewport, query = '', hash = '') {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && u !== 'about:blank') external.push(u); });
    await page.goto(PAGE + query + hash);
    await page.waitForSelector('main .top');
    await page.waitForTimeout(120); // the masonry packs on the next frame
    return page;
  }
  const shot = (page, name, full = true) => page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 80, fullPage: full });
  say(`Mockup ${id.toUpperCase()} (${M.file})`);
  try {
    for (const owner of ['nova', 'wren']) {
      const d = data.owners[owner];
      say(`\n=== ${d.me.name} (${owner === 'nova' ? 'weeks in' : 'just signed up'}) ===`);
      for (const board of ['recommended', 'S', 'M', 'L']) {
        const page = await open({ width: 1440, height: 900 }, `?owner=${owner}&board=${board}`);
        const tiles = await readTiles(page);
        say(`\n[${board === 'recommended' ? 'recommended board' : `all at ${board}`}, 1440x900] ${tiles.length} tiles: ${tiles.map((t) => `${t.name} ${t.size} ${t.w}x${t.h}`).join(', ')}`);
        const bad = [];
        for (const t of tiles) {
          const want = SPEC[t.tile][t.size];
          if (JSON.stringify([...t.facts].sort()) !== JSON.stringify([...want].sort())) bad.push(`${t.tile} ${t.size} facts ${t.facts.join(',')} != ${want.join(',')}`);
          if (!t.name || !t.question.endsWith('?')) bad.push(`${t.tile} ${t.size} lacks its name or question`);
          if (t.buttons.length !== 1) bad.push(`${t.tile} ${t.size} has ${t.buttons.length} footer buttons`);
          if (/undefined|NaN|\bnull\b|(^|\s)—(\s|$)/.test(t.text)) bad.push(`${t.tile} ${t.size} shows "${(/undefined|NaN|\bnull\b|—/.exec(t.text) || [''])[0]}"`);
        }
        check(!bad.length, `every tile shows the spec's facts at its size, its name, its question and one next action${bad.length ? ': ' + bad.join('; ') : ''}`);
        const over = tiles.filter((t) => t.overflow > 1 || t.sideways > 1);
        check(!over.length, `no tile overflows${over.length ? ': ' + over.map((t) => `${t.name} ${t.size} by ${t.overflow}px${t.sideways ? ` (sideways ${t.sideways})` : ''}`).join(', ') : ''}`);
        if (M.masonry) { const ov = overlaps(tiles); check(!ov.length, `no two tiles overlap (masonry)${ov.length ? ': ' + ov.join(', ') : ''}`); }
        const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(sw <= 0, `no sideways scroll (${sw}px)`);
        if (owner === 'nova') {
          const rating = String(Math.round(d.rating.rating.rating)).replace(/\B(?=(\d{3})+$)/g, ',');
          const credits = String(d.wallet.credits);
          const agent = d.play.connectedAgent.name;
          const live = d.live.matches.find((m) => m.matchId === d.live.mine) ?? d.live.matches[0];
          const inMatch = live && [live.p1.agentName, live.p2.agentName].includes(agent);
          const where = (needle) => tiles.filter((t) => t.text.includes(needle)).map((t) => t.tile);
          const many = d.play.agents.length > 1;
          const r = where(rating), c = where(credits), a = where(agent).filter((x) => !(x === 'watch' && inMatch) && !(x === 'notif' && many));
          check(r.every((x) => x === 'ladder'), `the rating (${rating}) only in Ladder: ${r.join(', ') || 'not on this board'}`);
          check(c.every((x) => x === 'store'), `the credits (${credits}) only in Store: ${c.join(', ') || 'not on this board'}`);
          check(a.every((x) => x === 'agent'), `the agent's name only in My agent${inMatch ? ' (and Watch live, where it is a player)' : ''}${many ? ' (and on alerts: two agents)' : ''}: ${a.join(', ') || 'not on this board'}`);
        }
        if (owner === 'wren') {
          const all = tiles.map((t) => t.text).join('\n');
          check(!/±\s*\d|Placement · 0 rated|0 since a|No packs opened yet|credits short/.test(all), 'the new player sees none of the labels the audit flagged (±n, "0 since a", "No packs opened yet", "credits short")');
        }
        if (id === 'c') {
          const want = payload.owners[owner].extra.needs.map((n) => n.tile);
          const onBoard = new Set(tiles.map((t) => t.tile));
          const first = tiles.filter((t) => t.need).map((t) => t.tile);
          const rest = tiles.filter((t) => !t.need).map((t) => t.tile);
          const order = await page.$$eval('#needs .tile', (xs) => xs.map((x) => x.dataset.tile));
          check(JSON.stringify(order) === JSON.stringify(want.filter((t) => onBoard.has(t))) && JSON.stringify(first) === JSON.stringify(order) && !rest.some((t) => want.includes(t)),
            `what needs you comes first, most urgent first, each with its reason: ${tiles.filter((t) => t.need).map((t) => `${t.tile} "${t.need.replace(/^▸\s*/, '').replace('Needs you: ', '')}"`).join(', ')}`);
        }
        await shot(page, `${owner}-${board === 'recommended' ? 'recommended' : 'all-' + board}`);
        await page.context().close();
      }

      const phone = await open({ width: 390, height: 844 }, `?owner=${owner}`);
      const pt = await readTiles(phone);
      const ph = await phone.evaluate((sel) => ({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth - window.innerWidth, tabs: [...document.querySelectorAll(sel)].filter((x) => x.offsetParent !== null || getComputedStyle(x).position === 'fixed').map((x) => x.textContent.trim()), rail: document.querySelector('.rail') ? getComputedStyle(document.querySelector('.rail')).display : 'none' }), M.phoneNav);
      say(`\n[phone 390x844, recommended] ${pt.length} tiles, ${ph.h}px tall (${(ph.h / 844).toFixed(1)} screens); places: ${ph.tabs.join(' | ')}`);
      check(ph.sw <= 0, `phone: no sideways scroll (${ph.sw}px)`);
      check(ph.rail === 'none' && ph.tabs.length === 5, 'phone: five places, no rail');
      const pover = pt.filter((t) => t.overflow > 1 || t.sideways > 1);
      check(!pover.length, `phone: no tile overflows${pover.length ? ': ' + pover.map((t) => `${t.name} by ${t.overflow}px`).join(', ') : ''}`);
      check(pt.every((t) => t.size === (t.tile === 'watch' && t.size !== 'S' ? 'M' : 'S')), 'phone: every tile shows its S face (Watch live its 9:16 M)');
      await shot(phone, `${owner}-recommended-phone`);
      await phone.context().close();
    }

    say(`\n=== navigation (Nova, 1440x900) ===`);
    const page = await open({ width: 1440, height: 900 }, '?owner=nova&board=S');
    const nav = await page.$$eval(M.nav, (xs) => xs.map((x) => (x.querySelector('span') ?? x).textContent.trim()));
    say(`navigation: ${nav.join(' | ')}`);
    check(nav.length === 6 && nav.slice(0, 5).join(',') === PLACES && nav[5] === 'Settings', 'five places, then Settings');
    const homeTop = await page.$$eval(`${M.wallet}, ${M.bell}`, (x) => x.length);
    check(homeTop === 0, 'Home has no wallet or bell (the Store and Notifications tiles are their homes)');
    if (M.rail) {
      const r = await page.evaluate((sel) => ({ bottom: document.querySelector(sel).getBoundingClientRect().bottom + scrollY, doc: document.documentElement.scrollHeight }), M.rail);
      check(r.bottom >= r.doc - 1, `the rail's glass runs the page's full height (${Math.round(r.bottom)} of ${r.doc}px)`);
    }
    const arrows = [];
    for (const [tile, want] of Object.entries(OPENS)) {
      await page.goto(PAGE + '?owner=nova&board=S#/home');
      await page.waitForSelector('main .tile');
      await page.click(`.tile[data-tile="${tile}"] header .open`);
      await page.waitForSelector('main .pg');
      const h = await page.evaluate(() => location.hash);
      arrows.push(`${tile} -> ${h}`);
      if (h !== `#/${want}`) arrows.push(`  (want #/${want})`);
    }
    say(`tile arrows: ${arrows.join(', ')}`);
    check(!arrows.some((a) => a.includes('want')), 'every tile arrow opens the page the mockup says (one page per question)');
    for (const p of ['agent', 'watch', 'cards', 'ladder']) {
      await page.goto(PAGE + `?owner=nova#/${p}`);
      await page.waitForSelector('main .pg');
      const t = await page.evaluate((m) => ({ h1: document.querySelector('main h1').textContent, wallet: !!document.querySelector(m.wallet), bell: !!document.querySelector(m.bell), cur: (document.querySelector(m.current)?.querySelector('span') ?? document.querySelector(m.current))?.textContent.trim() }), M);
      check(t.wallet && t.bell && t.cur === t.h1, `${t.h1}: the wallet and the bell are there, and the navigation marks it`);
    }
    await shot(page, 'nova-cards-page', false);
    // The free pack's alert goes to the Daily rewards tile on Home.
    await page.goto(PAGE + '?owner=wren&board=M#/home');
    await page.waitForSelector('main .tile');
    await page.click('.tile[data-tile="notif"] a[data-to="daily"]').catch(() => {});
    const dailyFlash = await page.$eval('.tile[data-tile="daily"]', (e) => e.classList.contains('flash')).catch(() => false);
    check(dailyFlash, 'the free pack\'s alert shows the Daily rewards tile (where it is claimed)');
    if (id === 'b') {
      await page.goto(PAGE + '?owner=wren#/home');
      await page.waitForSelector('main .tile');
      const before = await page.$eval('.tile[data-tile="ladder"] .q', (e) => getComputedStyle(e).display);
      await page.click('.tile[data-tile="ladder"] .qb');
      const after = await page.$eval('.tile[data-tile="ladder"] .q', (e) => ({ d: getComputedStyle(e).display, t: e.textContent }));
      check(before === 'none' && after.d !== 'none' && after.t.endsWith('?'), `the "?" shows the tile's question: "${after.t}"`);
      await shot(page, 'wren-question-open', false);
    }
    if (id === 'c') {
      await page.goto(PAGE + '?owner=nova#/ladder');
      await page.waitForSelector('main .pg');
      await page.keyboard.press('/');
      await page.keyboard.type('daily');
      await shot(page, 'nova-jump-palette', false);
      await page.keyboard.press('Enter');
      await page.waitForSelector('main .tile');
      await page.waitForTimeout(150);
      const j = await page.evaluate(() => ({ hash: location.hash, flash: document.querySelector('.tile[data-tile="daily"]')?.classList.contains('flash') }));
      check(j.hash === '#/home' && j.flash, `the jump palette finds a tile: "/" then "daily" then Enter -> ${j.hash}, Daily rewards shown`);
      await page.keyboard.press('5');
      check(await page.evaluate(() => location.hash) === '#/ladder', 'key 5 opens Ladder');
    }
    await page.goto(PAGE + '?owner=nova#/home');
    await page.waitForSelector('main .tile');
    await page.click('#edit');
    await page.click('.tile[data-tile="ladder"] .edit button[data-sz="L"]');
    const after = await page.$eval('.tile[data-tile="ladder"]', (e) => e.dataset.size);
    check(after === 'L', `Edit board: Ladder -> ${after}`);
    await shot(page, 'nova-edit-board', false);
    await page.context().close();
    const other = id === 'a' ? 'light' : id === 'b' ? 'dark' : 'light';
    const alt = await open({ width: 1440, height: 900 }, `?owner=wren&theme=${other}`);
    await shot(alt, `wren-recommended-${other}`, false);
    await alt.context().close();

    check(!errors.length, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    check(!external.length, `no outside requests${external.length ? ': ' + external.join(', ') : ''}`);
  } catch (e) {
    fail++;
    say(`FAIL the run stopped: ${e && e.stack || e}`);
  }
  say(`\n${pass} PASS, ${fail} FAIL`);
  writeFileSync(join(OUT, 'check.txt'), lines.join('\n') + '\n');
  totalFail += fail;
}
await browser.close();
process.exitCode = totalFail ? 1 : 0;
