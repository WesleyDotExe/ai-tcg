// The play style flow on the Season 1 Home (render session 90, owner
// 2026-11-27 note 6), in headless Chromium on render/season1/output/home.html:
//   - a tap on a style on My agent at L opens My agent with that style ready
//     to confirm (one more tap there), never a tap that looks like nothing;
//   - Confirm saves it: back on Home, S, M and L all name the new style, and
//     L marks it current (check, accent edge, "Current");
//   - Keep leaves the style as it was; tapping the current style opens My
//     agent saying it is the style now, with nothing to confirm;
//   - M's Change opens My agent with the current style selected;
//   - the keyboard: Tab reaches a style (with a focus ring), Enter opens My
//     agent with it ready;
//   - a phone (390 px) shows My agent's S face with the style's name;
// Fails on any miss. Writes check.txt and stills to
// progress/render/evidence/season1-play-style-s90/ (or the folder given).
//
//   node render/season1/ci/play-style-check.mjs [outDir]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const season1 = resolve(here, '..');
const OUT = resolve(process.argv[2] ?? join(season1, '..', '..', 'progress', 'render', 'evidence', 'season1-play-style-s90'));
mkdirSync(OUT, { recursive: true });
const PAGE = pathToFileURL(join(season1, 'output', 'home.html')).href;

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright/index.mjs', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright not found (set PW_CORE to its index.mjs)');
}

const chromium = await loadPlaywright();
const browser = await chromium.launch();
const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };
let pass = 0, fail = 0;
const check = (ok, what) => { if (ok) pass++; else fail++; say(`${ok ? 'PASS' : 'FAIL'} ${what}`); };
const errors = [], external = [];

const AGENT = '.tile[data-tile="agent"]';
const tileState = (page) => page.evaluate((sel) => {
  const t = document.querySelector(sel);
  if (!t) return null;
  const on = [...t.querySelectorAll('.choice.on')];
  const vis = (e) => !!e && getComputedStyle(e).display !== 'none';
  return {
    size: t.dataset.size,
    name: t.querySelector('[data-style-name]')?.textContent.trim() ?? on[0]?.querySelector('b').textContent.trim() ?? '',
    on: on.map((c) => c.dataset.style),
    marked: on.every((c) => vis(c.querySelector('.tick')) && vis(c.querySelector('.cur')) && c.getAttribute('aria-current') === 'true'),
  };
}, AGENT);
const panel = (page) => page.evaluate(() => {
  const p = document.querySelector('#playstyle');
  if (!p) return null;
  return {
    hash: location.hash,
    pressed: [...p.querySelectorAll('.opt[aria-pressed="true"]')].map((b) => b.dataset.pick),
    now: [...p.querySelectorAll('.opt.now')].map((b) => b.dataset.pick),
    confirm: p.querySelector('#ps-ok')?.textContent.trim() ?? '',
    keep: p.querySelector('#ps-keep')?.textContent.trim() ?? '',
    saved: p.querySelector('.saved')?.textContent.trim() ?? '',
    text: p.textContent.replace(/\s+/g, ' '),
  };
});
const board = async (page, b) => { await page.click(`#m-board button[data-board="${b}"]`); await page.waitForTimeout(80); };

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && u !== 'about:blank') external.push(u); });
  await page.goto(PAGE);
  await page.waitForTimeout(150);

  say('=== a tap on a style opens My agent with it ready to confirm ===');
  let t = await tileState(page);
  check(t && t.size === 'L' && t.on.join() === 'calculator' && t.marked, `Home, Nova, recommended board: My agent at L marks Calculator current (${JSON.stringify(t)})`);
  await page.click(`${AGENT} .choice[data-style="rusher"]`);
  await page.waitForTimeout(100);
  let p = await panel(page);
  check(p && p.hash === '#/agent', `the tap opened My agent (${p?.hash})`);
  check(p && p.pressed.join() === 'rusher' && p.now.join() === 'calculator', `Rusher is selected, Calculator marked as the current one (${JSON.stringify(p && { pressed: p.pressed, now: p.now })})`);
  check(p && p.confirm === 'Confirm Rusher' && p.keep === 'Keep Calculator' && /from its next match/.test(p.text), `one more tap confirms: "${p?.confirm}" / "${p?.keep}", and it says from its next match`);
  await page.screenshot({ path: join(OUT, 'my-agent-confirm-light.jpg'), type: 'jpeg', quality: 78, clip: { x: 0, y: 0, width: 1280, height: 620 } });

  say('\n=== on My agent, another pick moves the selection ===');
  await page.click('#playstyle .opt[data-pick="tempo"]');
  p = await panel(page);
  check(p.pressed.join() === 'tempo' && p.confirm === 'Confirm Tempo', `Tempo picked there instead: "${p.confirm}"`);

  say('\n=== Confirm saves it, and every size shows it ===');
  await page.click('#ps-ok');
  p = await panel(page);
  check(/Tempo from its next match/.test(p.saved) && !p.confirm && p.now.join() === 'tempo', `confirmed: "${p.saved}"`);
  await page.click('#playstyle .btn[data-go="home"]');
  await page.waitForTimeout(100);
  t = await tileState(page);
  check(t.on.join() === 'tempo' && t.marked && t.name === 'Tempo', `back on Home, L marks Tempo current (${JSON.stringify(t)})`);
  for (const b of ['S', 'M']) {
    await board(page, b);
    t = await tileState(page);
    check(t.size === b && t.name === 'Tempo', `${b} names the new style ("${t.name}")`);
  }
  await page.screenshot({ path: join(OUT, 'home-all-M-after-confirm.jpg'), type: 'jpeg', quality: 78, clip: { x: 0, y: 0, width: 1280, height: 520 } });

  say('\n=== M\'s Change opens My agent with the current style selected ===');
  await page.click(`${AGENT} [data-fact="personality"] .chg`);
  await page.waitForTimeout(100);
  p = await panel(page);
  check(p && p.hash === '#/agent' && p.pressed.join() === 'tempo' && !p.confirm && /Tempo is its play style now/.test(p.text), `Change: My agent, Tempo selected, nothing to confirm (${JSON.stringify(p && { pressed: p.pressed, confirm: p.confirm })})`);

  say('\n=== Keep leaves it as it was ===');
  await page.click('#playstyle .opt[data-pick="gambler"]');
  await page.click('#ps-keep');
  p = await panel(page);
  check(p.pressed.join() === 'tempo' && !p.confirm, `after Keep, Tempo is still the one (${p.pressed})`);

  say('\n=== a tap on the current style says so ===');
  await page.click('#playstyle .btn[data-go="home"]');
  await board(page, 'L');
  await page.click(`${AGENT} .choice[data-style="tempo"]`);
  await page.waitForTimeout(100);
  p = await panel(page);
  check(p && p.hash === '#/agent' && !p.confirm && /Tempo is its play style now/.test(p.text), 'the current style opens My agent: "Tempo is its play style now", nothing to confirm');

  say('\n=== the keyboard ===');
  await page.click('#playstyle .btn[data-go="home"]');
  await board(page, 'recommended');
  // Real keys from the tile's own "?" button, as a keyboard user gets there.
  await page.focus(`${AGENT} .qb`);
  let tabs = 0;
  while (tabs < 40 && !(await page.evaluate(() => document.activeElement?.dataset?.style === 'fortress'))) { await page.keyboard.press('Tab'); tabs++; }
  check(tabs < 40, `Tab reaches Fortress on the tile (${tabs} presses from the tile's "?")`);
  const ring = await page.$eval(`${AGENT} .choice[data-style="fortress"]`, (e) => getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineWidth);
  check(/solid 2px/.test(ring), `a focused style shows a focus ring (${ring})`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  p = await panel(page);
  check(p && p.pressed.join() === 'fortress' && p.confirm === 'Confirm Fortress', `Enter on Fortress opens My agent with it ready ("${p?.confirm}")`);
  await page.keyboard.press('Tab');
  check(await page.evaluate(() => document.activeElement?.closest('#playstyle') !== null), 'focus stays in the Play style section after the pick');

  say('\n=== the other owner, and dark ===');
  await page.click('#playstyle .btn[data-go="home"]');
  await page.click('#m-owner button[data-owner="wren"]');
  await page.waitForTimeout(100);
  t = await tileState(page);
  check(t.on.join() === 'calculator' && t.name === 'Calculator', `Wren's agent is still Calculator (a confirm is per owner) (${t.on})`);
  await page.click('#m-theme button[data-theme="dark"]');
  await page.click(`${AGENT} .choice[data-style="controller"]`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(OUT, 'my-agent-confirm-dark.jpg'), type: 'jpeg', quality: 78, clip: { x: 0, y: 0, width: 1280, height: 620 } });
  p = await panel(page);
  check(p && p.confirm === 'Confirm Controller' && /Moth Lantern plays this way/.test(p.text), `Wren: "${p?.confirm}", in the agent's own name`);
  await ctx.close();

  say('\n=== a phone ===');
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const pp = await phone.newPage();
  pp.on('pageerror', (e) => errors.push(String(e)));
  await pp.goto(PAGE);
  await pp.waitForTimeout(150);
  t = await tileState(pp);
  const fits = await pp.$eval(AGENT, (el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1);
  check(t.size === 'S' && t.name === 'Calculator' && fits, `390 px: My agent's S face names the style and fits (${JSON.stringify(t)}, fits ${fits})`);
  await phone.close();

  check(!errors.length, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  check(!external.length, `no outside requests${external.length ? ': ' + external.join(', ') : ''}`);
} catch (e) {
  fail++;
  say(`FAIL the run stopped: ${e && e.stack || e}`);
}
say(`\n${pass} PASS, ${fail} FAIL`);
writeFileSync(join(OUT, 'check.txt'), lines.join('\n') + '\n');
await browser.close();
process.exitCode = fail ? 1 : 0;
