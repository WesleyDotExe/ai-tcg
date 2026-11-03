// Render session 36: the loadout picker (victory boasts, slice 4), driven in
// a real (headless) Chromium. Brought up to date in render session 54 (a
// hardening pass) from `loadout-check-s36.mjs`, which had gone stale: render
// 37 changed the name plate to "<AGENT> WINS" over the boast's own name (a
// close win opens on CLOSE CALL alone, then swaps), and the "bought" owner's
// balance is earned in real matches by the demo, so it moves with the rules
// (it is read from the page's scenario now, not written in). It also finds
// playwright wherever it is installed. Run with node:
//   node progress/render/evidence/loadout-check-s54.mjs [outDir] [render/output]
// (build the page first: `npm run loadout -w render`).
// Runs, each from a fresh page:
//   A  desktop, a new owner: the equipped boast (Void Collapse) previews on
//      its own, with no grammar problem, and loops; the loop's repeats make
//      no sound (only a pass the viewer asked for does).
//   B  a tap on an owned tile previews it (the board, the caption, the tile
//      marked); Equip saves it (the toast, the slot rail, the page's state).
//   C  a locked item (on sale, not owned): no Equip, the "in the store" plate
//      with its price and the owner's balance; a tap previews it, marked
//      "not owned".
//   D  the close-win slot: an item previews with the CLOSE WIN plate and the
//      winner on 3 health; its empty tile previews the main boast (VICTORY).
//   E  emptying the victory boast slot: the rail says what plays (the deck's
//      faction starter) and the preview plays it.
//   F  card back, avatar, arena: nothing to equip yet, said plainly.
//   G  the "bought" owner: Boot Sequence equipped and marked Bought;
//      Dial-Up Fireworks locked with what the owner has left.
//   H  the live-match owner: the banner, and Equip shows the store's refusal;
//      nothing changes.
//   I  Escape ends a pass; the loop starts again.
//   J  a phone: no sideways scroll; the board stays at the top while the list
//      scrolls under it; a scroll restarts a running preview, which then plays
//      again where the board is; a tap previews.
//   K  reduced motion: the still, once per choice, no loop.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}
const chromium = await loadPlaywright();
const [outDir, outputArg] = process.argv.slice(2);
const OUT = resolve(outputArg || 'render/output');
const SHOTS = resolve(outDir || 'progress/render/evidence');
mkdirSync(SHOTS, { recursive: true });
const URL = 'file://' + OUT + '/loadout-picker.html';
const lines = [];
let pass = 0, fail = 0;
function check(name, ok, detail) { (ok ? pass++ : fail++); lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

async function fresh(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__loadout && window.__loadout.stats().previews > 0);
  return { ctx, page, errors };
}
const st = (page) => page.evaluate(() => ({ s: window.__loadout.stats(), b: window.__loadout.boast.stats(), state: window.__loadout.state(), cap: document.getElementById('st-cap').textContent, plate: (document.querySelector('.boast-name .boast-tag') || {}).textContent || null, hp: document.getElementById('st-hp').textContent, snd: window.__loadout.snd.stats().played }));
// The winner's line once it is up ("<AGENT> WINS"), and the close-call line
// while it shows.
const whoOf = (page) => page.$eval('.boast-name .boast-who', (e) => e.textContent).catch(() => null);
const closeLineOf = (page) => page.waitForFunction(() => { const e = document.querySelector('.boast-name:not(.gone) .boast-close'); return e ? e.textContent : null; }, null, { timeout: 6000 }).then((h) => h.jsonValue()).catch(() => null);
const tile = (key) => `.tile[data-tile="${key}"]`;
const wait = (page, ms) => page.waitForTimeout(ms);
// The name plate lands about 1.5-2.3 s into a pass; a click that scrolls
// restarts the pass, so wait for the plate rather than a fixed time.
const plateOf = (page, want) => page.waitForFunction((w) => { const e = document.querySelector('.boast-name:not(.gone) .boast-tag'); return e && (!w || e.textContent === w) ? e.textContent : null; }, want, { timeout: 6000 }).then((h) => h.jsonValue()).catch(() => null);

// ---- A-F: desktop, the new owner ----
{
  const { ctx, page, errors } = await fresh({ width: 1366, height: 900 });
  let x = await st(page);
  check('A page opens on "A new owner" with no errors', x.state.scenario === 'new' && errors.length === 0, errors.join(' | '));
  check('A the equipped boast previews on its own', x.s.current && x.s.current.id === 'boast-null-void-collapse' && x.b.active, JSON.stringify(x.s.current));
  check('A no grammar problem on the preview board', !x.b.problem, x.b.problem || 'none');
  const plateA = await plateOf(page, 'VOID COLLAPSE');
  await page.waitForSelector('.boast-name .boast-who', { timeout: 6000 }).catch(() => null);
  await wait(page, 250);
  await page.screenshot({ path: `${SHOTS}/v2-s54-loadout-desk-new.jpg`, quality: 82 });
  check('A the plate names the boast', plateA === 'VOID COLLAPSE', plateA);
  const whoA = await whoOf(page);
  check('A ...over the agent\'s win line', whoA === 'Static Vesper WINS', whoA);
  // Sound starts armed: the first press anywhere (not on the sound button,
  // which would mute it) starts it. Then wait out a loop.
  await page.click('.agent-head h1');
  check('A sound is on after the first press', (await page.evaluate(() => window.__loadout.snd.stats().state)) === 'on');
  const before = (await st(page)).snd;
  await wait(page, 5200);
  x = await st(page);
  check('A it loops', x.s.loops >= 2, `loops ${x.s.loops}, previews ${x.s.previews}`);
  check('A the loop\'s repeats are silent', x.snd === before, `sounds ${before} -> ${x.snd}`);

  // B: preview and equip Shield Slam.
  const sndB = x.snd;
  await page.click(`${tile('boast-aegis-shield-slam')} .t-name`);
  await wait(page, 120);
  x = await st(page);
  check('B a tap on a tile previews it', x.s.current.id === 'boast-aegis-shield-slam' && /A win plays Shield Slam/.test(x.cap), x.cap);
  check('B the tile is marked as previewing', await page.$eval(tile('boast-aegis-shield-slam'), (e) => e.classList.contains('previewing')));
  await wait(page, 2400);
  x = await st(page);
  check('B a pass the viewer asked for sounds (sound on)', x.snd > sndB, `sounds ${sndB} -> ${x.snd}`);
  await page.click(`${tile('boast-aegis-shield-slam')} .t-equip`);
  await wait(page, 150);
  x = await st(page);
  const toast = await page.$eval('#toast', (e) => e.textContent);
  check('B Equip saves it (the store\'s answer)', x.state.loadout.boast === 'boast-aegis-shield-slam' && toast === "Saved: Shield Slam is this agent's victory boast.", toast);
  check('B the rail shows it', (await page.$eval('.rail-slot[data-slot="boast"] .rs-val', (e) => e.textContent)) === 'Shield Slam');
  check('B the tile now says Equipped', (await page.$eval(tile('boast-aegis-shield-slam'), (e) => e.textContent)).includes('Equipped'));
  await wait(page, 2000);
  await page.screenshot({ path: `${SHOTS}/v2-s54-loadout-desk-equipped.jpg`, quality: 82 });

  // C: a locked item.
  const locked = tile('boast-s0-boot-sequence');
  check('C a locked item has no Equip', (await page.$(`${locked} .t-equip`)) === null);
  const plate = await page.$eval(`${locked} .t-lock`, (e) => e.textContent);
  check('C the plate shows the price and the balance', /In the store · 300 credits/.test(plate) && /you have 0/.test(plate), plate);
  await page.click(`${locked} .t-name`);
  await wait(page, 2200);
  x = await st(page);
  check('C a tap previews it, marked not owned', x.s.current.id === 'boast-s0-boot-sequence' && /not owned: preview only/.test(x.cap) && !x.b.problem, x.cap);
  await page.screenshot({ path: `${SHOTS}/v2-s54-loadout-desk-locked-preview.jpg`, quality: 82 });

  // D: the close-win slot.
  await page.click('.rail-slot[data-slot="closeWinBoast"]');
  await page.click(`${tile('boast-cortex-data-cascade')} .t-name`);
  const closeLine = await closeLineOf(page);
  x = await st(page);
  check('D a close-win item previews with the close-call plate', x.s.current.id === 'boast-cortex-data-cascade' && x.s.current.close === true && closeLine === 'CLOSE CALL' && x.plate === 'DATA CASCADE', `${closeLine} / ${x.plate}`);
  await page.waitForSelector('.boast-name.swapped .boast-who', { timeout: 6000 }).catch(() => null);
  const whoD = await whoOf(page);
  const closeGone = await page.$('.boast-name .boast-close');
  check('D ...which swaps to the winner\'s line', !closeGone && /WINS$/.test(whoD || ''), whoD);
  check('D ... with the winner on 3 health', x.hp === 'HP 3 / 30', x.hp);
  check('D the caption says a close win', /A close win \(5 health or less\) plays Data Cascade/.test(x.cap), x.cap);
  await page.screenshot({ path: `${SHOTS}/v2-s54-loadout-desk-closewin.jpg`, quality: 82 });
  await page.click(`${tile('')} .t-name`);
  await plateOf(page, 'SHIELD SLAM');
  await wait(page, 300);
  x = await st(page);
  const closeE = await page.$('.boast-name:not(.gone) .boast-close');
  check('D its empty tile previews the main boast, no close call', x.s.current.id === 'boast-aegis-shield-slam' && x.s.current.close === false && x.plate === 'SHIELD SLAM' && !closeE && x.hp === 'HP 18 / 30', `${x.s.current.id} ${x.plate} ${x.hp}${closeE ? ' (close line showing)' : ''}`);

  // E: empty the victory boast slot.
  await page.click('.rail-slot[data-slot="boast"]');
  await page.click(`${tile('')} .t-equip`);
  await wait(page, 200);
  x = await st(page);
  check('E emptying the boast slot is saved', x.state.loadout.boast === null, JSON.stringify(x.state.loadout));
  check('E the rail says the deck\'s faction starter plays', (await page.$eval('.rail-slot[data-slot="boast"] .rs-val', (e) => e.textContent)) === 'Empty: plays Void Collapse');
  check('E the preview plays it', x.s.current.id === 'boast-null-void-collapse');

  // F: the kinds with nothing yet.
  for (const slot of ['cardBack', 'avatar', 'arena']) {
    await page.click(`.rail-slot[data-slot="${slot}"]`);
    const none = await page.$eval('.none-yet', (e) => e.textContent);
    const tiles = await page.$$eval('.tile', (t) => t.length);
    check(`F ${slot}: nothing to equip yet, said plainly`, /exist yet: Season 0 sells none/.test(none) && tiles === 1, none.slice(0, 60));
  }
  await page.click('.rail-slot[data-slot="cardBack"]');
  await page.screenshot({ path: `${SHOTS}/v2-s54-loadout-desk-cardback.jpg`, quality: 82 });

  // I: Escape ends a pass; the loop comes back.
  await wait(page, 600);
  const pre = (await st(page)).s.previews;
  await page.keyboard.press('Escape');
  await wait(page, 100);
  x = await st(page);
  check('I Escape ends the pass', !x.b.active && x.b.last && x.b.last.reason === 'skip', JSON.stringify(x.b.last));
  await wait(page, 1500);
  x = await st(page);
  check('I the loop starts again', x.b.active && x.s.previews > pre, `previews ${pre} -> ${x.s.previews}`);
  check('A-I no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- G, H: the bought and live owners ----
{
  const { ctx, page, errors } = await fresh({ width: 1366, height: 900 });
  await page.click('.sc-tab[data-sc="bought"]');
  await wait(page, 2400);
  let x = await st(page);
  check('G the bought owner wears Boot Sequence', x.state.loadout.boast === 'boast-s0-boot-sequence' && x.s.current.id === 'boast-s0-boot-sequence' && !x.b.problem);
  const boot = await page.$eval(tile('boast-s0-boot-sequence'), (e) => e.textContent);
  check('G it is marked Bought and Equipped', /Bought/.test(boot) && /Equipped/.test(boot));
  const dial = await page.$eval(`${tile('boast-s0-dial-up-fireworks')} .t-lock`, (e) => e.textContent);
  const left = x.state.credits;
  check('G Dial-Up Fireworks is locked, with what the owner has left', typeof left === 'number' && left < 300 && /300 credits/.test(dial) && new RegExp('you have ' + left + '(\\D|$)').test(dial), `${dial} (the scenario holds ${left})`);
  await page.screenshot({ path: `${SHOTS}/v2-s54-loadout-desk-bought.jpg`, quality: 82 });

  await page.click('.sc-tab[data-sc="live"]');
  await wait(page, 300);
  const banner = await page.$eval('#livelock', (e) => (e.hidden ? '' : e.textContent));
  check('H the live-match banner shows', /In a live match/.test(banner) && /refuses loadout changes/.test(banner), banner.slice(0, 80));
  const before = JSON.stringify((await st(page)).state.loadout);
  await page.click(`${tile('boast-null-void-collapse')} .t-equip`);
  await wait(page, 150);
  const t = await page.$eval('#toast', (e) => e.textContent);
  x = await st(page);
  check('H Equip shows the store\'s refusal; nothing changes', t === 'Not saved: no loadout changes during a live match' && JSON.stringify(x.state.loadout) === before, t);
  await wait(page, 1800);
  await page.screenshot({ path: `${SHOTS}/v2-s54-loadout-desk-live.jpg`, quality: 82 });
  check('G-H no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- J: a phone ----
{
  const { ctx, page, errors } = await fresh({ width: 390, height: 800 }, { touch: true });
  await wait(page, 2200);
  let x = await st(page);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  check('J no sideways scroll on a phone', width <= 390, `scrollWidth ${width}`);
  check('J the preview plays on a phone with no grammar problem', x.b.active && !x.b.problem, x.b.problem || 'none');
  await page.screenshot({ path: `${SHOTS}/v2-s54-loadout-phone-top.jpg`, quality: 82 });
  const restarts = x.s.restarts;
  await page.evaluate(() => window.scrollTo(0, 520));
  await wait(page, 120);
  x = await st(page);
  const top = await page.$eval('#stage', (e) => Math.round(e.getBoundingClientRect().top));
  check('J the board stays at the top while the list scrolls', top >= 0 && top <= 2, `stage top ${top}`);
  check('J a scroll restarts a running preview', x.s.restarts > restarts && !x.b.active, `restarts ${restarts} -> ${x.s.restarts}`);
  await wait(page, 600);
  x = await st(page);
  check('J ...which plays again where the board is', x.b.active && !x.b.problem);
  await plateOf(page, null);
  const plateTop = await page.evaluate(() => { const p = document.querySelector('.boast-name'); const s = document.getElementById('stage').getBoundingClientRect(); if (!p) return null; const r = p.getBoundingClientRect(); return { inside: r.top >= s.top - 1 && r.bottom <= s.bottom + 1 }; });
  check('J the name plate is on the board after the scroll', plateTop && plateTop.inside, JSON.stringify(plateTop));
  await page.screenshot({ path: `${SHOTS}/v2-s54-loadout-phone-scrolled.jpg`, quality: 82 });
  await page.tap(`${tile('boast-swarm-hive-burst')} .t-name`);
  await wait(page, 150);
  x = await st(page);
  check('J a tap previews on a phone', x.s.current.id === 'boast-swarm-hive-burst' && x.b.active);
  check('J no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---- K: reduced motion ----
{
  const { ctx, page, errors } = await fresh({ width: 1366, height: 900 }, { reduced: true });
  await wait(page, 300);
  let x = await st(page);
  check('K reduced motion plays the still', x.s.current.still === true && x.b.active, JSON.stringify(x.s.current));
  await page.screenshot({ path: `${SHOTS}/v2-s54-loadout-reduced-still.jpg`, quality: 82 });
  await wait(page, 3500);
  x = await st(page);
  check('K ...once: no loop', x.s.previews === 1 && !x.b.active, `previews ${x.s.previews}`);
  await page.click(`${tile('boast-cortex-data-cascade')} .t-name`);
  await wait(page, 200);
  x = await st(page);
  check('K a tap shows that item\'s still', x.s.current.id === 'boast-cortex-data-cascade' && x.s.current.still === true);
  check('K no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
lines.push('', `${pass} passed, ${fail} failed`);
const text = `Loadout picker browser check (render session 36, brought up to date in 54): ${URL.replace(/^.*\/render\//, 'render/')}\n\n` + lines.join('\n') + '\n';
writeFileSync(`${SHOTS}/loadout-check-s54.txt`, text);
console.log(text);
process.exit(fail ? 1 : 0);
