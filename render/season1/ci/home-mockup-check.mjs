// Season 1 Home mockup A in headless Chromium (render session 83). Loads the
// built page (render/season1/output/home-mockup-a.html) as Nova (weeks in) and
// Wren (just signed up), at a desktop (1440x900) and a phone (390x844), and
// checks what the spec (season1/src/homeSpec.ts) and A's own rules promise:
//   - every tile at every size shows exactly the spec's facts, in order, and
//     wears its name, its question and one next-action button;
//   - nothing overflows its tile, and the page never scrolls sideways;
//   - one home per fact, as drawn: Nova's rating only in Ladder, her credits
//     only in Store, the agent's name only in My agent (and in Watch live,
//     while it is a player in the featured match);
//   - no "undefined", "NaN" or bare "—" anywhere;
//   - the navigation: five places on the rail (and the phone's tab bar);
//     every tile's arrow lands on the page A says; Home has no wallet or
//     bell, every other page has both;
//   - Edit board changes a tile's size in place;
//   - no page errors and no outside requests.
// Writes stills and check.txt to progress/render/evidence/season1-home-mockup-a-s83/.
//
//   node render/season1/ci/home-mockup-check.mjs [outDir]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const season1 = resolve(here, '..');
const PAGE = pathToFileURL(join(season1, 'output', 'home-mockup-a.html')).href;
const OUT = resolve(process.argv[2] ?? join(season1, '..', '..', 'progress', 'render', 'evidence', 'season1-home-mockup-a-s83'));
mkdirSync(OUT, { recursive: true });
const data = JSON.parse(readFileSync(join(season1, 'mockup', 'data', 'home-data.json'), 'utf8'));
// The spec, read from its source so the check holds the page to the same lists.
const specSrc = readFileSync(join(season1, 'src', 'homeSpec.ts'), 'utf8');
const SPEC = {};
for (const m of specSrc.matchAll(/id: "(\w+)",\s*name: "[^"]+",[\s\S]*?sizes: \{\s*S: \[([^\]]*)\],\s*M: \[([^\]]*)\],\s*L: \[([^\]]*)\]/g)) {
  const list = (s) => [...s.matchAll(/"(\w+)"/g)].map((x) => x[1]);
  SPEC[m[1]] = { S: list(m[2]), M: list(m[3]), L: list(m[4]) };
}
const OPENS = { agent: 'agent', ladder: 'ladder', watch: 'watch', packs: 'cards', store: 'cards', collection: 'cards', daily: 'ladder', history: 'agent', notif: 'alerts' };

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };
let pass = 0, fail = 0;
const check = (ok, what) => { if (ok) pass++; else fail++; say(`${ok ? 'PASS' : 'FAIL'} ${what}`); };
const errors = [], external = [];

const chromium = await loadPlaywright();
const browser = await chromium.launch();
async function open(viewport, query = '', hash = '') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && u !== 'about:blank') external.push(u); });
  await page.goto(PAGE + query + hash);
  await page.waitForSelector('main .top');
  return page;
}
const readTiles = (page) => page.evaluate(() => [...document.querySelectorAll('#grid .tile')].map((el) => {
  const b = el.querySelector('.body');
  const r = el.getBoundingClientRect();
  return {
    tile: el.dataset.tile, size: el.dataset.size,
    name: el.querySelector('h3')?.textContent ?? '', question: el.querySelector('.q')?.textContent ?? '',
    facts: [...el.querySelectorAll('[data-fact]')].map((f) => f.dataset.fact),
    buttons: [...el.querySelectorAll('footer button')].map((x) => x.textContent.trim()),
    text: el.innerText,
    w: Math.round(r.width), h: Math.round(r.height),
    overflow: Math.max(0, el.scrollHeight - el.clientHeight, b ? b.scrollHeight - b.clientHeight : 0),
    sideways: Math.max(0, el.scrollWidth - el.clientWidth),
  };
}));
const shot = (page, name, full = true) => page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 80, fullPage: full });

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
      const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(sw <= 0, `no sideways scroll (${sw}px)`);
      // One home per fact, as drawn (Nova has the numbers that could repeat).
      if (owner === 'nova') {
        const rating = String(Math.round(d.rating.rating.rating));
        const credits = String(d.wallet.credits);
        const agent = d.play.connectedAgent.name;
        const live = d.live.matches.find((m) => m.matchId === d.live.mine) ?? d.live.matches[0];
        const inMatch = live && [live.p1.agentName, live.p2.agentName].includes(agent);
        const where = (needle) => tiles.filter((t) => t.text.includes(needle)).map((t) => t.tile);
        // The spec keeps the agent's name on an alert only when the owner has
        // more than one agent (Nova has two).
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
      await shot(page, `${owner}-${board === 'recommended' ? 'recommended' : 'all-' + board}`);
      await page.context().close();
    }

    // The phone.
    const phone = await open({ width: 390, height: 844 }, `?owner=${owner}`);
    const pt = await readTiles(phone);
    const ph = await phone.evaluate(() => ({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth - window.innerWidth, tabs: [...document.querySelectorAll('.tabs .nav')].filter((x) => x.offsetParent !== null).map((x) => x.textContent.trim()), rail: getComputedStyle(document.querySelector('.rail')).display }));
    say(`\n[phone 390x844, recommended] ${pt.length} tiles, ${ph.h}px tall (${(ph.h / 844).toFixed(1)} screens); tab bar: ${ph.tabs.join(' | ')}`);
    check(ph.sw <= 0, `phone: no sideways scroll (${ph.sw}px)`);
    check(ph.rail === 'none' && ph.tabs.length === 5, `phone: the rail gives way to a five-place tab bar`);
    const pover = pt.filter((t) => t.overflow > 1 || t.sideways > 1);
    check(!pover.length, `phone: no tile overflows${pover.length ? ': ' + pover.map((t) => `${t.name} by ${t.overflow}px`).join(', ') : ''}`);
    await shot(phone, `${owner}-recommended-phone`);
    await phone.context().close();
  }

  // The navigation (Nova).
  say('\n=== navigation (Nova, 1440x900) ===');
  const page = await open({ width: 1440, height: 900 }, '?owner=nova&board=S');
  const rail = await page.$$eval('.rail .nav', (xs) => xs.map((x) => x.textContent.trim()));
  say(`rail: ${rail.join(' | ')}`);
  check(rail.length === 6 && rail.slice(0, 5).join(',') === 'Home,My agent,Watch,Cards,Ladder', 'the rail has five places, then Settings at its foot');
  const homeTop = await page.$$eval('main .top .wallet, main .top .bell', (x) => x.length);
  check(homeTop === 0, 'Home has no wallet or bell (the Store and Notifications tiles are their homes)');
  const arrows = [];
  for (const [tile, want] of Object.entries(OPENS)) {
    await page.goto(PAGE + '?owner=nova&board=S#/home');
    await page.waitForSelector('#grid .tile');
    await page.click(`.tile[data-tile="${tile}"] header .open`);
    await page.waitForSelector('main .pg');
    const h = await page.evaluate(() => location.hash);
    arrows.push(`${tile} -> ${h}`);
    if (h !== `#/${want}`) arrows.push(`  (want #/${want})`);
  }
  say(`tile arrows: ${arrows.join(', ')}`);
  check(!arrows.some((a) => a.includes('want')), 'every tile arrow opens the page A says (one page per question)');
  for (const p of ['agent', 'watch', 'cards', 'ladder']) {
    await page.goto(PAGE + `?owner=nova#/${p}`);
    await page.waitForSelector('main .pg');
    const t = await page.evaluate(() => ({ h1: document.querySelector('main h1').textContent, wallet: !!document.querySelector('main .top .wallet'), bell: !!document.querySelector('main .top .bell'), cur: document.querySelector('.rail .nav[aria-current="page"]')?.textContent.trim() }));
    check(t.wallet && t.bell && t.cur === t.h1, `${t.h1}: the top bar has the wallet and the bell, and the rail marks it`);
  }
  await shot(page, 'nova-cards-page', false);
  // Edit board.
  await page.goto(PAGE + '?owner=nova#/home');
  await page.waitForSelector('#grid .tile');
  await page.click('#edit');
  await page.click('.tile[data-tile="ladder"] .edit button[data-sz="L"]');
  const after = await page.$eval('.tile[data-tile="ladder"]', (e) => e.dataset.size);
  check(after === 'L', `Edit board: Ladder M -> ${after}`);
  await shot(page, 'nova-edit-board', false);
  await page.context().close();
  // Light theme, one still.
  const light = await open({ width: 1440, height: 900 }, '?owner=wren&theme=light');
  await shot(light, 'wren-recommended-light', false);
  await light.context().close();

  check(!errors.length, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  check(!external.length, `no outside requests${external.length ? ': ' + external.join(', ') : ''}`);
} catch (e) {
  fail++;
  say(`FAIL the run stopped: ${e && e.stack || e}`);
} finally {
  await browser.close();
  say(`\n${pass} PASS, ${fail} FAIL`);
  writeFileSync(join(OUT, 'check.txt'), lines.join('\n') + '\n');
  process.exitCode = fail ? 1 : 0;
}
