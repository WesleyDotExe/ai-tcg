// Render session 76: the faction lock marked buildable or not (owner
// 2026-11-14, game session 99's call (a): the site greys out the factions
// the owner can't build a deck for yet, with what to craft; the lock itself
// stays allowed). In a headless browser against the real owner API
// (render/src/site/siteDemo.ts: Nova holds the Cortex starter and 20 opened
// packs; nothing mocked):
//
//   A Settings -> Play at 1440 px: Cortex is not greyed; every faction the
//     server's collection can't make 20 cards of is greyed with "N/20"; the
//     counts are the engine's rule on the server's own copies.
//   B Locking a greyed faction (Aegis): the server saves the lock; the toast
//     says the agent sits out and what to craft; the warning under the lock
//     names the cheapest crafts and links to the Collection.
//   C The server's own build agrees: Rebuild now fails with "at most N usable
//     cards, under 20", N the page's badge.
//   D Crafting one card of the plan (the owner's API) and coming back to
//     Settings: the badge goes up by one.
//   E Back to Cortex: the warning goes, the quiet line stays.
//   F A 390 px phone: the lock wraps under its label, nothing sideways.
//   G No external requests, no page errors.
//
//   npx tsx progress/render/evidence/faction-lock-check-s76.mjs [stills dir]

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
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `v2-s76-${name}.jpg`), type: 'jpeg', quality: 80, timeout: 20000 }).catch(() => note(`(the still "${name}" timed out)`));

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
  // ---- A ----
  await page.goto(`${url}#/settings`);
  const marked = await until(async () => (await page.$$('#faction-lock button.short')).length > 0);
  check(marked, 'A Settings: the lock has greyed factions once the collection is read');
  const btns = await lockButtons();
  note(`the lock: ${btns.map((b) => `${b.v || 'Any'}${b.short ? ` (${b.badge})` : ''}${b.pressed ? ' [on]' : ''}`).join(' · ')}`);
  const cortex = btns.find((b) => b.v === 'Cortex');
  check(cortex && !cortex.short && cortex.badge === null, 'A Cortex (the starter) is not greyed');
  const col = (await api('GET', '/api/collection')).body;
  const copies = col.cards.flatMap((c) => Array(c.owned).fill(c.cardId));
  if (largestDeck) {
    const want = Object.fromEntries(['Cortex', 'Swarm', 'Aegis', 'Null'].map((f) => [f, largestDeck(f, holdingsOf(copies))]));
    note(`the engine's rule on the server's copies: ${JSON.stringify(want)}`);
    check(['Swarm', 'Aegis', 'Null'].every((f) => { const b = btns.find((x) => x.v === f); return want[f] >= 20 ? !b.short : b.short && b.badge === `${want[f]}/20`; }), 'A every greyed faction\'s "N/20" is the engine\'s largestDeck on GET /api/collection\'s copies');
  } else note('(the engine did not import: the cross-check is C\'s, the server\'s own build)');
  const aegis0 = btns.find((b) => b.v === 'Aegis');
  check(aegis0.short && /^Aegis: can't build a deck yet, \d+ of 20 cards$/.test(aegis0.label), `A a greyed button keeps its name for a screen reader ("${aegis0.label}")`);
  const n0 = await noteOf();
  check(n0 && /muted/.test(n0.cls) && /^Greyed: you don't hold enough cards/.test(n0.text), `A the quiet line under the lock: "${n0?.text}"`);
  await shot(page, 'settings-1440');

  // ---- B ----
  await page.click('#faction-lock button[data-v="Aegis"]');
  const saved = await until(async () => (await api('GET', '/api/play')).body.factionLock === 'Aegis');
  check(saved, 'B pressing greyed Aegis still locks it (GET /api/play: factionLock "Aegis")');
  await until(async () => /on/.test(await page.$eval('#toast', (t) => t.className)));
  const toastText = await page.$eval('#toast', (t) => t.textContent);
  check(/^Locked to Aegis, but your agent sits out every round until it can build an Aegis deck: \d+ of 20 cards\. What to craft is under the lock\.$/.test(toastText), `B the toast: "${toastText}"`);
  await until(async () => /warn/.test((await noteOf())?.cls ?? ''));
  const n1 = await noteOf();
  check(n1 && /warn/.test(n1.cls) && /^Your agent sits out every round: it can't build an Aegis deck yet\. Your cards make at most \d+ of the 20/.test(n1.text) && /Cheapest from its starter list: .+ \(\d+ pack points\)/.test(n1.text) && n1.link === '#/collection', `B the warning under the lock: "${n1?.text}"`);
  await shot(page, 'settings-aegis-locked');

  // ---- C ----
  const badge = (await lockButtons()).find((b) => b.v === 'Aegis').badge;
  const n = Number(badge.split('/')[0]);
  const job = await api('POST', '/api/play/rebuild');
  let j = job.body?.job;
  await until(async () => { j = (await api('GET', '/api/play/rebuild')).body?.job; return j && j.state !== 'running'; }, 60000, 300);
  note(`Rebuild now (${job.status}): ${j?.state}: ${j?.error}`);
  check(j?.state === 'failed' && String(j.error).includes(`at most ${n} usable cards, under 20`), `C the server's own build refuses with the page's number (${n})`);

  // ---- D ----
  const plan = /Cheapest from its starter list: (.+) \(\d+ pack points\)/.exec(n1.text)[1];
  const first = plan.split(/, | and /)[0].replace(/ ×\d+$/, '');
  const binder = (await api('GET', '/api/collection/binder/S0')).body;
  const cardId = binder.base.entries.find((e) => e.name === first)?.cardId;
  const crafted = cardId ? await api('POST', `/api/collection/cards/${encodeURIComponent(cardId)}/craft`) : { status: 0 };
  note(`crafted one "${first}" (${cardId}): ${crafted.status}`);
  await page.goto(`${url}#/collection`);
  await page.waitForSelector('.binder, .cv, .pg');
  await wait(800);
  await page.goto(`${url}#/settings`);
  const up = await until(async () => (await lockButtons()).find((b) => b.v === 'Aegis').badge === `${n + 1}/20`);
  check(crafted.status === 201 && up, `D after crafting one card of the plan the badge reads ${n + 1}/20`);

  // ---- E ----
  await page.click('#faction-lock button[data-v="Cortex"]');
  await until(async () => (await api('GET', '/api/play')).body.factionLock === 'Cortex');
  await until(async () => /muted/.test((await noteOf())?.cls ?? ''));
  const n2 = await noteOf();
  check(n2 && /muted/.test(n2.cls), 'E back to Cortex: the warning goes, the quiet line stays');

  // ---- F ----
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
  const fit = await pp.evaluate(() => {
    const seg = document.querySelector('#faction-lock').getBoundingClientRect();
    const pg = document.querySelector('#page');
    return { segRight: seg.right, vw: innerWidth, sideways: pg.scrollWidth > pg.clientWidth + 1, docSideways: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  note(`phone: the lock's right edge ${Math.round(fit.segRight)} of ${fit.vw}`);
  check(fit.segRight <= fit.vw && !fit.sideways && !fit.docSideways, 'F at 390 px the lock fits and nothing scrolls sideways');
  await pp.$eval('#faction-lock', (el) => el.scrollIntoView({ block: 'center' }));
  await shot(pp, 'settings-phone');
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
