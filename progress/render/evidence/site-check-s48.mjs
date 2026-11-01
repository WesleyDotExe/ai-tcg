// Render session 48: the Collection page on the website (the wide binder),
// driven in a headless browser against the real owner API (render/src/site/
// siteDemo.ts: a fresh season database, the game lane's owner API
// unchanged, the site host in front). The binder drawing the server's
// numbers (every place numbered, held places as the pack page's own card
// faces, missing ones as numbered empty slots); the faction and
// Owned/Missing filters; the Set, Secrets, Prototypes and Promos tabs; the
// card viewer (the card, its tilt, every copy with its origin and the
// Account-bound tag, the keyboard: arrows, Escape, focus back); crafting a
// missing card for pack points; salvage, with the server's plan naming the
// saved deck it would leave short in the confirm, then sent confirmed (the
// 409 a send without the confirm gets is covered by
// render/test/siteCollection.test.ts over the real API); the collection read again
// after a pack opening; a narrow window; dark mode; reduce motion; no
// external requests; no page errors.
//
//   node progress/render/evidence/site-check-s48.mjs [stills dir]
// (PW_CORE as in render/ci/browser-check.mjs, if playwright isn't found.)


import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = resolve(process.argv[2] ?? resolve(ROOT, 'progress/render/evidence'));
mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); if (m.chromium) return m.chromium; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const url = await new Promise((ok, fail) => {
  let buf = '';
  demo.stdout.on('data', (d) => { buf += d; const m = /\[site-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
  demo.stderr.on('data', (d) => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
  demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
  setTimeout(() => fail(new Error('the demo took over 60 s to start')), 60000);
});

let passes = 0, fails = 0;
const check = (ok, line) => { if (ok) passes++; else fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); };
const note = (line) => console.log(`      ${line}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const chromium = await loadPlaywright();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const errors = [];
const external = [];
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  // The check's own refusals (a second claim, an open with none waiting) log a 409 by design.
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 409/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
  return { ctx, page };
}
const S = (page) => page.evaluate(() => window.__site.state());
const P = (page) => page.evaluate(() => { const p = window.__site.pack(); return p ? { phase: p.phase, mode: p.mode, i: p.i, packId: p.cur && p.cur.packId, cards: p.cur && p.cur.cards.length, log: p.log.map((e) => ({ kind: e.kind, idx: e.idx, via: e.via })) } : null; });
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `v2-s48-col-${name}.jpg`), type: 'jpeg', quality: 80 });
async function signIn(page) {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');
}
const token = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('aitcg.site.session')).token);
const apiGet = (page, path) => page.evaluate(async (path) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { headers: { Authorization: `Bearer ${t}` } });
  return r.json();
}, path);
const frameOf = (page) => page.frames().find((f) => f.url().endsWith('/pack-opening'));
const until = async (fn, ms = 15000, step = 80) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };

const C = (page) => page.evaluate(() => window.__site.state().col);
const apiSend = (page, method, path, body) => page.evaluate(async ({ method, path, body }) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}, { method, path, body });
const slotCounts = (page) => page.evaluate(() => ({ held: document.querySelectorAll('#page .bslot.held').length, miss: document.querySelectorAll('#page .bslot.miss').length }));
const factionsShown = (page) => page.$$eval('#page .bslot', (bs) => [...new Set(bs.map((b) => b.dataset.faction))]);
async function tab(page, act, v) {
  await page.click(`[data-act="${act}"][data-v="${v}"]`);
  await page.waitForFunction(([a, v]) => document.querySelector(`[data-act="${a}"][data-v="${v}"]`)?.getAttribute('aria-pressed') === 'true', [act, v]);
}

try {
  const { ctx, page } = await open();
  await signIn(page);

  // A. The page draws the server's binder.
  await page.click('#nav [data-page="collection"]');
  await page.waitForSelector('.binder');
  const binder = await apiGet(page, '/api/collection/binder/S0');
  const coll = await apiGet(page, '/api/collection');
  let n = await slotCounts(page);
  check(n.held === binder.base.held && n.held + n.miss === binder.base.total, `A  the Set tab: ${n.held} faces held, ${n.miss} numbered empty places (the server: ${binder.base.held} of ${binder.base.total})`);
  const firstMissing = binder.base.entries.find((e) => e.owned === 0);
  const missTxt = await page.textContent(`[data-slot="base:${firstMissing.cardId}"]`);
  check(missTxt.includes(firstMissing.number) && missTxt.includes(firstMissing.name), `A  a missing card's place shows its number and name (${firstMissing.number} ${firstMissing.name})`);
  const two = binder.base.entries.find((e) => e.owned > 1);
  const twoTxt = await page.textContent(`[data-slot="base:${two.cardId}"]`);
  const twoName = await page.textContent(`[data-slot="base:${two.cardId}"] .face .name`);
  check(twoTxt.includes(`×${two.owned}`) && twoName === two.name, `A  a held place is the card's printed face (${twoName}) with its count (×${two.owned})`);
  const sumTxt = await page.textContent('.col-sum');
  const pct = Math.floor((binder.base.held / binder.base.total) * 100);
  check(sumTxt.includes(`${pct}%`) && sumTxt.includes(`${binder.base.held} / ${binder.base.total}`) && sumTxt.includes(`${binder.secrets.held}/${binder.secrets.total} Secrets`) && sumTxt.includes(`${binder.glitch.held}/${binder.glitch.total} Glitch`) && sumTxt.includes(`${coll.copies} copies`), `A  the summary is the server's: ${pct}%, ${binder.base.held} / ${binder.base.total}, secrets, Glitch, ${coll.copies} copies`);
  const foilSlot = await page.$('.bslot.held .bfin');
  check(!!foilSlot, `A  a finish better than Standard is named under its card (${foilSlot ? await foilSlot.textContent() : 'none'})`);
  await shot(page, 'binder');

  // B. Filters.
  await tab(page, 'col-faction', 'Aegis');
  const aeg = await factionsShown(page);
  const aegN = (await slotCounts(page));
  check(aeg.length === 1 && aeg[0] === 'Aegis' && aegN.held + aegN.miss > 0, `B  Aegis shows only Aegis places (${aegN.held + aegN.miss}; factions shown: ${aeg.join(',')})`);
  await tab(page, 'col-faction', 'All');
  await tab(page, 'col-show', 'missing');
  n = await slotCounts(page);
  check(n.held === 0 && n.miss === binder.base.total - binder.base.held, `B  Missing shows only the ${n.miss} missing places`);
  await shot(page, 'missing');
  await tab(page, 'col-show', 'owned');
  n = await slotCounts(page);
  check(n.miss === 0 && n.held === binder.base.held, `B  Owned shows only the ${n.held} held places`);
  await tab(page, 'col-show', 'all');
  const focused = await page.evaluate(() => document.activeElement?.dataset?.v);
  check(focused === 'all', 'B  a filter keeps focus on its button after the redraw');

  // C. Tabs.
  await tab(page, 'col-tab', 'secrets');
  const blocks = await page.$$eval('.col-block', (bs) => bs.map((b) => [b.dataset.block, b.querySelectorAll('.bslot').length, b.querySelector('.bheld').textContent.replace(/\s+/g, ' ').trim()]));
  check(JSON.stringify(blocks) === JSON.stringify([['secrets', binder.secrets.total, `${binder.secrets.held} / ${binder.secrets.total}`], ['glitch', binder.glitch.total, `${binder.glitch.held} / ${binder.glitch.total}`], ['gold', binder.gold.total, `${binder.gold.held} / ${binder.gold.total}`]]), `C  Secrets: the secret cards, Glitch and Gold, each with the server's count (${blocks.map((b) => b[0] + ' ' + b[2]).join('; ')})`);
  const glitchHeld = binder.glitch.entries.find((e) => e.owned > 0);
  if (glitchHeld) {
    const cls = await page.getAttribute(`[data-slot="glitch:${glitchHeld.cardId}"] .face`, 'class');
    check(/corrupt/.test(cls) && /fx-css-glitch/.test(cls), `C  the held Glitch version wears the Glitch face (${glitchHeld.name})`);
  }
  await shot(page, 'secrets');
  await tab(page, 'col-tab', 'prototypes');
  const protoTxt = await page.textContent('.col-block');
  check((await page.$$('.col-block .bslot')).length === binder.prototypes.length && protoTxt.includes(`Run of ${binder.prototypes[1].runSize}`), `C  Prototypes: the ${binder.prototypes.length} runs, each with its size and how many were found`);
  await tab(page, 'col-tab', 'promos');
  const promo = await page.textContent('#page');
  check(promo.includes('Waiting on the server for') && (await page.$$('.bslot')).length === 0, 'C  Promos says what it waits on (no made-up cards)');
  await tab(page, 'col-tab', 'set');

  // D. The card viewer.
  await page.click(`[data-slot="base:${two.cardId}"]`);
  await page.waitForSelector('#viewer:not([hidden]) .cv');
  const vTxt = await page.textContent('#viewer');
  const vName = await page.textContent('#viewer .cv-card .face .name');
  check(vName === two.name && vTxt.includes(`You hold ${two.owned}`), `D  the viewer: ${vName}, its face, "You hold ${two.owned}"`);
  const copies = coll.cards.find((c) => c.cardId === two.cardId).copies;
  const bound = copies.filter((c) => c.accountBound).length;
  const tags = (await page.$$('#viewer .tag.bound')).length;
  check(tags === bound, `D  every copy listed with its origin; Account-bound on the ${bound} bound ones (${tags} tags)`);
  check(await page.evaluate(() => document.activeElement?.id) === 'cv-close', 'D  focus goes to Close');
  await until(async () => (await C(page)).viewer?.holdings !== null);
  const box = await page.locator('#cv-card').boundingBox();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2);
  await wait(350);
  const tilt = await page.$eval('#cv-card', (e) => e.style.transform);
  check(/rotateX\(-?\d/.test(tilt) && /rotateY\(\d/.test(tilt), `D  the card tilts under the pointer (${tilt})`);
  await shot(page, 'viewer');
  const fit = await page.$eval('#viewer .face .text', (t) => t.style.getPropertyValue('--fit'));
  check(fit !== '', `D  the rules text is fitted to its box, as the pack page fits it (--fit ${fit})`);
  await page.keyboard.press('ArrowRight');
  await until(async () => (await C(page)).viewer?.key !== `base:${two.cardId}`);
  const nextKey = (await C(page)).viewer.key;
  const iTwo = binder.base.entries.findIndex((e) => e.cardId === two.cardId);
  check(nextKey === `base:${binder.base.entries[iTwo + 1].cardId}`, `D  ArrowRight moves to the next place (${nextKey})`);
  await page.keyboard.press('ArrowLeft');
  await until(async () => (await C(page)).viewer?.key === `base:${two.cardId}`);
  await page.keyboard.press('Escape');
  await page.waitForSelector('#viewer[hidden]', { state: 'attached' });
  check(await page.evaluate(() => document.activeElement?.dataset?.slot) === `base:${two.cardId}`, 'D  Escape closes; focus goes back to the place it was opened from');
  // A missing card's viewer: the card as it would print, greyed.
  await page.click(`[data-slot="base:${firstMissing.cardId}"]`);
  await page.waitForSelector('#viewer:not([hidden]) .cv-card.missing');
  check((await page.textContent('#viewer')).includes('Not in your collection yet'), 'D  a missing card opens too: its face greyed, "Not in your collection yet"');

  // E. Craft the missing card (if it's a Common the demo's points cover; else the next missing Common).
  await page.click('#cv-close');
  const wallet0 = await apiGet(page, '/api/wallet');
  const target = binder.base.entries.find((e) => e.owned === 0 && e.rarity === 'Common');
  await page.click(`[data-slot="base:${target.cardId}"]`);
  await page.waitForSelector('#viewer:not([hidden]) #craft-btn');
  const craftLabel = await page.textContent('#craft-btn');
  check(craftLabel.includes('40 pp') && await page.isEnabled('#craft-btn'), `E  Craft offers a missing Common for 40 pack points (you have ${wallet0.packPoints}): "${craftLabel}"`);
  await page.click('#craft-btn');
  await page.waitForSelector('#dialog.on [data-a="yes"]');
  await page.click('#dialog [data-a="yes"]');
  await until(async () => (await C(page)).binder.base.entries.find((e) => e.cardId === target.cardId).owned === 1);
  await until(async () => !!(await page.$('#viewer .tag.bound')));
  const wallet1 = await apiGet(page, '/api/wallet');
  const vAfter = await page.textContent('#viewer');
  check(wallet1.packPoints === wallet0.packPoints - 40 && vAfter.includes('You hold 1') && vAfter.includes('Crafted'), `E  crafted: pack points ${wallet0.packPoints} -> ${wallet1.packPoints}, the viewer says "You hold 1 · Crafted · Account-bound"`);
  const topPP = await page.textContent('#wallet .cur:nth-child(2) b');
  check(Number(topPP.replace(/,/g, '')) === wallet1.packPoints, `E  the top bar's pack points follow (${topPP})`);
  await page.click('#cv-close');
  const placeNow = await page.getAttribute(`[data-slot="base:${target.cardId}"]`, 'class');
  check(/held/.test(placeNow), `E  its place in the binder is a face now (${target.number} ${target.name})`);
  await shot(page, 'crafted');

  // F. Salvage, with the deck it would leave short. The agent builds its
  // deck first (a saved deck from the collection), then a card that deck
  // uses and that has salvageable copies.
  const job = await apiSend(page, 'POST', '/api/play/rebuild');
  check(job.status === 202, `F  the agent builds its deck (POST /api/play/rebuild: ${job.status})`);
  await until(async () => (await apiGet(page, '/api/play/rebuild')).job.state !== 'running', 120000, 500);
  let pick = null;
  for (const c of (await apiGet(page, '/api/collection')).cards) {
    if (c.salvageable < 1) continue;
    const plan = await apiGet(page, `/api/collection/cards/${c.cardId}/salvage?quantity=${c.salvageable}`);
    if (plan.affectedDecks?.length) { pick = { c, plan }; break; }
  }
  check(!!pick, `F  a card the saved deck uses with salvageable copies: ${pick ? `${pick.c.name}, ${pick.c.salvageable} salvageable, deck "${pick.plan.affectedDecks[0].name}"` : 'none found'}`);
  if (pick) {
    await page.goto(url + '#/collection');
    await page.waitForSelector('.binder');
    const wp0 = (await apiGet(page, '/api/wallet')).packPoints;
    await page.click(`[data-slot="base:${pick.c.cardId}"]`);
    await page.waitForSelector('#viewer:not([hidden]) #salvage-btn');
    for (let i = 1; i < pick.c.salvageable; i++) await page.click('#salv-plus');
    const label = await page.textContent('#salvage-btn');
    check(label.includes(`Salvage ${pick.c.salvageable}`) && label.includes(`+${pick.plan.packPoints} pp`), `F  the stepper goes to the salvageable count: "${label}"`);
    check(await page.isDisabled('#salv-plus'), 'F  and stops there');
    await page.click('#salvage-btn');
    await page.waitForSelector('#dialog.on');
    const dlg = await page.textContent('#dialog');
    check(dlg.includes(pick.plan.affectedDecks[0].name) && dlg.includes('would be short'), `F  the confirm names the deck it would leave short: "${dlg.replace(/\s+/g, ' ').slice(0, 160)}…"`);
    await shot(page, 'salvage-confirm');
    await page.click('#dialog [data-a="yes"]');
    await until(async () => (await apiGet(page, '/api/wallet')).packPoints !== wp0, 10000);
    const wp1 = (await apiGet(page, '/api/wallet')).packPoints;
    check(wp1 === wp0 + pick.plan.packPoints, `F  salvaged: pack points ${wp0} -> ${wp1} (+${pick.plan.packPoints})`);
    await until(async () => (await C(page)).viewer?.holdings?.salvageable === 0);
    const h = (await C(page)).viewer.holdings;
    check(h.owned === pick.c.owned - pick.c.salvageable && (await page.textContent('#viewer')).includes(`You hold ${h.owned}`), `F  the viewer reads the holdings again: you hold ${h.owned}, nothing left to salvage`);
    const play = await apiGet(page, '/api/play');
    const deck = play.decks.find((d) => d.deckId === pick.plan.affectedDecks[0].deckId);
    check(deck && deck.complete === false, `F  the server now reports that deck incomplete (as the owner confirmed): ${deck ? deck.missing.map((m) => `${m.cardId} ${m.owned}/${m.uses}`).join(', ') : '?'}`);
    await page.keyboard.press('Escape');
  }

  // G. An opening adds to the collection: the page reads it again.
  await page.waitForSelector('#viewer[hidden]', { state: 'attached' });
  const heldBefore = (await C(page)).binder.base.held;
  const copiesBefore = (await apiGet(page, '/api/collection')).copies;
  await page.click('#open-btn');
  await until(async () => (await P(page))?.phase === 'pack');
  await frameOf(page).click('#close');
  await page.waitForSelector('#opening[hidden]', { state: 'attached', timeout: 10000 }).catch(() => {});
  const copiesAfter = (await apiGet(page, '/api/collection')).copies;
  await until(async () => (await C(page)).binder && (await apiGet(page, '/api/collection/binder/S0')).base.held === (await C(page)).binder.base.held && copiesAfter > copiesBefore, 10000);
  const bNow = await apiGet(page, '/api/collection/binder/S0');
  n = await slotCounts(page);
  check(copiesAfter === copiesBefore + 5 && n.held === bNow.base.held, `G  after a pack opened from the top bar, the binder is read again (${copiesBefore} -> ${copiesAfter} copies; held ${heldBefore} -> ${n.held}, the server: ${bNow.base.held})`);

  // H. Narrow window and dark mode.
  await page.setViewportSize({ width: 720, height: 900 });
  await wait(300);
  const over = await page.evaluate(() => document.querySelector('#page').scrollWidth - document.querySelector('#page').clientWidth);
  check(over <= 1, `H  at 720 px nothing runs off the side (${over} px)`);
  await page.click(`[data-slot="base:${two.cardId}"]`);
  await page.waitForSelector('#viewer:not([hidden]) .cv');
  const cols = await page.$eval('#viewer .cv', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  check(cols === 1, `H  the viewer stacks the card over its details (${cols} column)`);
  await shot(page, 'narrow-viewer');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.click('#theme-btn'); await page.click('#theme-btn');
  await wait(400);
  const theme = (await S(page)).drawn;
  check(theme === 'dark', `H  dark mode draws (${theme})`);
  await shot(page, 'dark');
  await page.click(`[data-slot="base:${two.cardId}"]`);
  await page.waitForSelector('#viewer:not([hidden]) .cv');
  await shot(page, 'dark-viewer');
  await page.keyboard.press('Escape');
  await page.click('#theme-btn');
  await ctx.close();

  // I. Reduce motion: no tilt.
  const r = await open({ reducedMotion: 'reduce' });
  await signIn(r.page);
  await r.page.goto(url + '#/collection');
  await r.page.waitForSelector('.binder');
  await r.page.click('.bslot.held');
  await r.page.waitForSelector('#viewer:not([hidden]) .cv');
  const rb = await r.page.locator('#cv-card').boundingBox();
  await r.page.mouse.move(rb.x + rb.width * 0.9, rb.y + rb.height * 0.2);
  await wait(300);
  check((await r.page.$eval('#cv-card', (e) => e.style.transform)) === '', 'I  under reduce motion the card doesn\'t tilt');
  await r.ctx.close();

  check(external.length === 0, `J  no request left the site (${external.length})`);
  check(errors.length === 0, `J  no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
} catch (e) {
  check(false, `the run stopped: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  try { process.kill(-demo.pid, 'SIGTERM'); } catch { /* gone */ }
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
}
