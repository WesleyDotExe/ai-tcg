// Render session 75: Season 0's booster cards on the website (owner
// 2026-11-14: starter cards are Standard only, every special version belongs
// to the booster cards; game session 97 registered them as 097-124). In a
// headless browser against the real owner API (render/src/site/siteDemo.ts:
// Nova holds the Cortex starter and 10 opened daily packs; nothing mocked):
//
//   A The Collection's Set tab in two blocks: Starter cards 001-096 (96
//     places) and Booster cards 097-124 (28), each with its own held count,
//     the counts the server's binder gives.
//   B A booster card's viewer: "Booster card", its versions as buttons (Set,
//     Glitch/Illustration where it has them, Gold, Prototype run), a press
//     on Gold opens the Gold place (its caption, its number 125-152), Set
//     goes back.
//   C A starter card's viewer: "Starter card", its deck named, Standard
//     only, no versions row; a starter-era neutral in no deck (NT-001):
//     crafting is the only way.
//   D The Secrets tab: the secret cards 153-171 (19), Glitch 16, Gold 28
//     numbered 125-152, all booster cards (or Zero-Day).
//   E A pack opened from the top bar and played to its summary: every card
//     a booster card (or a Zero-Day card), its number in 097-124 (Gold
//     125-152, secrets above), the summary's set bar out of 124.
//   F The card-face sheet (render/output/card-faces.html): the 28 booster
//     rows, every face's rules text fits its box after the fit (no face
//     still crowded), the flavor line dropped only where the smallest step
//     wasn't enough; at 1440 and 390 px.
//   G No external requests, no page errors.
//
//   node progress/render/evidence/booster-cards-check-s75.mjs [stills dir]

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
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `v2-s75-${name}.jpg`), type: 'jpeg', quality: 80, timeout: 20000 }).catch(() => note(`(the still "${name}" timed out)`));
const num = (n) => Number(String(n).split('/')[0]);

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
const apiGet = (path) => page.evaluate(async (path) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { headers: { Authorization: `Bearer ${t}` } });
  return r.json();
}, path);
const P = () => page.evaluate(() => { const p = window.__site.pack(); return p ? { phase: p.phase, mode: p.mode, i: p.i, packId: p.cur && p.cur.packId, cards: p.cur && p.cur.cards.length, log: p.log.map((e) => ({ kind: e.kind, idx: e.idx, via: e.via })) } : null; });
const frameOf = (pg) => pg.frames().find((f) => f.url().endsWith('/pack-opening'));

try {
  // ---- A ----
  let binder = await apiGet('/api/collection/binder/S0');
  const boosterIds = new Set(binder.base.entries.filter((e) => num(e.number) >= 97).map((e) => e.cardId));
  await page.goto(url + '#collection');
  await page.waitForSelector('.col-block[data-part="booster"] .bslot');
  const blocks = await page.$$eval('.col-block', (x) => x.map((e) => ({ part: e.dataset.part, title: e.querySelector('h3').textContent, held: e.querySelector('.bheld').textContent.replace(/\s+/g, ' ').trim(), slots: [...e.querySelectorAll('.bslot')].map((s) => s.dataset.slot) })));
  check(blocks.length === 2 && blocks[0].part === 'starter' && blocks[1].part === 'booster', `A  the Set tab is two blocks: ${blocks.map((b) => `"${b.title}"`).join(', ')}`);
  const heldOf = (from, to) => binder.base.entries.filter((e) => num(e.number) >= from && num(e.number) <= to && e.owned > 0).length;
  check(blocks[0].title === 'Starter cards · 001–096' && blocks[0].slots.length === 96 && blocks[0].held === `${heldOf(1, 96)} / 96`, `A  Starter cards: 96 places, held ${blocks[0].held} (the server's binder: ${heldOf(1, 96)} of 001-096)`);
  check(blocks[1].title === 'Booster cards · 097–124' && blocks[1].slots.length === 28 && blocks[1].held === `${heldOf(97, 124)} / 28`, `A  Booster cards: 28 places, held ${blocks[1].held} (the server's: ${heldOf(97, 124)} of 097-124)`);
  check(binder.base.total === 124 && blocks[1].slots.every((k) => boosterIds.has(k.slice(5))), 'A  every place in the booster block is one of the server\'s 097-124 entries; the set is 124');
  await page.$eval('.col-block[data-part="booster"]', (e) => e.scrollIntoView());
  await page.evaluate(() => window.scrollBy(0, -10));
  await wait(300);
  await shot(page, 'binder-booster-block');

  // ---- B ----
  const heat = binder.base.entries.find((e) => e.name === 'Heat Death');
  await page.click(`.bslot[data-slot="base:${heat.cardId}"]`);
  await page.waitForSelector('.cv .cv-origin');
  const cv = () => page.evaluate(() => ({ title: document.querySelector('#dlg-t').textContent, cap: document.querySelector('.cv-info > p.muted').textContent, origin: document.querySelector('.cv-origin')?.dataset.origin ?? null, line: document.querySelector('.cv-origin')?.textContent ?? '', chips: [...document.querySelectorAll('.cv-vers .vchip')].map((c) => ({ text: c.textContent.trim(), on: c.classList.contains('on'), btn: c.tagName === 'BUTTON', slot: c.dataset.slot ?? null })) }));
  let v = await cv();
  check(v.origin === 'booster' && /From packs, in every finish/.test(v.line), `B  Heat Death's viewer: "${v.line.trim()}"`);
  check(v.chips.map((c) => c.text.split(' ')[0] + (c.text.startsWith('Prototype') ? ' ' + c.text.split(' ')[1] : '')).join(', ') === 'Set, Illustration, Glitch, Gold, Prototype /1', `B  its versions: ${v.chips.map((c) => c.text).join(' | ')}`);
  check(v.chips[0].on && !v.chips[0].btn && v.chips.slice(1).every((c) => c.btn), 'B  the place on screen (Set) is marked, the others are buttons');
  await wait(300);
  await shot(page, 'viewer-heat-death');
  const gold = binder.gold.entries.find((e) => e.cardId === heat.cardId);
  await page.click('.cv-vers button.vchip[data-slot^="gold:"]');
  await until(async () => (await cv()).cap.startsWith('Gold'));
  v = await cv();
  check(v.cap.startsWith(`Gold · ${gold.number}`) && num(gold.number) >= 125 && num(gold.number) <= 152, `B  Gold opens the Gold place: "${v.cap}" (the server's ${gold.number})`);
  check(v.chips.find((c) => c.on)?.text.startsWith('Gold') && /only comes from packs/.test(v.line), 'B  there, Gold is marked and the line says it only comes from packs');
  await page.click('.cv-vers button.vchip[data-slot^="base:"]');
  await until(async () => (await cv()).cap.startsWith(heat.number));
  check((await cv()).cap.startsWith(heat.number), `B  Set goes back to ${heat.number}`);
  await page.click('#cv-close');

  // ---- C ----
  const starterEntry = binder.base.entries.find((e) => num(e.number) <= 96 && e.owned > 0 && !e.cardId.startsWith('NT'));
  await page.click(`.bslot[data-slot="base:${starterEntry.cardId}"]`);
  await page.waitForSelector('.cv .cv-origin');
  v = await cv();
  check(v.origin === 'starter' && /starter deck/.test(v.line) && /Standard only: never in packs/.test(v.line) && v.chips.length === 0, `C  ${starterEntry.name} (${starterEntry.number}): "${v.line.trim()}", no versions row`);
  await shot(page, 'viewer-starter');
  await page.click('#cv-close');
  await page.click('.bslot[data-slot="base:NT-001"]');
  await page.waitForSelector('.cv .cv-origin');
  v = await cv();
  check(v.origin === 'craftOnly' && /crafting a Standard copy is the only way/.test(v.line), `C  ${v.title} (NT-001): "${v.line.trim()}"`);
  await page.click('#cv-close');

  // ---- D ----
  await page.click('[data-act="col-tab"][data-v="secrets"]').catch(async () => { await page.click('button:has-text("Secrets")'); });
  await page.waitForSelector('.col-block[data-block="gold"] .bslot');
  const sec = await page.$$eval('.col-block', (x) => Object.fromEntries(x.map((e) => [e.dataset.block, [...e.querySelectorAll('.bslot')].map((s) => s.dataset.slot)])));
  const goldNums = binder.gold.entries.map((e) => num(e.number));
  check(sec.gold.length === 28 && goldNums[0] === 125 && goldNums.at(-1) === 152 && binder.gold.entries.every((e) => boosterIds.has(e.cardId)), `D  Gold: ${sec.gold.length} places, 125-152, every one a booster card`);
  check(sec.glitch.length === 16 && binder.glitch.entries.every((e) => boosterIds.has(e.cardId)), `D  Glitch: ${sec.glitch.length} places, every one a booster card`);
  const secNums = binder.secrets.entries.map((e) => num(e.number));
  check(sec.secrets.length === 19 && secNums[0] === 153 && secNums.at(-1) === 171 && binder.secrets.entries.every((e) => e.kind === 'zeroDay' || boosterIds.has(e.cardId)), `D  Secret cards: ${sec.secrets.length}, 153-171 (16 illustrations of booster cards, the Zero-Day cards ${binder.secrets.entries.filter((e) => e.kind === 'zeroDay').map((e) => e.number).join(', ')})`);
  check(binder.prototypes.length === 15 && binder.prototypes.every((r) => boosterIds.has(r.cardId)), 'D  the 15 Prototype runs are all on booster cards');
  await shot(page, 'secrets-tab');

  // ---- E ----
  await page.click('#open-btn');
  await page.waitForSelector('#opening:not([hidden]) iframe');
  await until(async () => (await P())?.phase === 'pack', 30000);
  const p1 = await P();
  const shown = await playSingle(page);
  const f = frameOf(page);
  const cards = await f.evaluate(() => window.__pack.cur.cards.map((c) => ({ id: c.cardId, finish: c.finish, n: c.collectorNumber, reveal: c.reveal })));
  const bad = cards.filter((c) => !(boosterIds.has(c.id) || c.reveal === 'zeroDay'));
  check(shown && cards.length >= 5 && bad.length === 0, `E  pack ${p1.packId.slice(0, 8)}: ${cards.length} cards, every one a booster card: ${cards.map((c) => `${c.n} ${c.finish}`).join(', ')}`);
  const numOk = cards.every((c) => { const n = num(c.n); return c.finish === 'gold' ? n >= 125 && n <= 152 : c.reveal === 'zeroDay' || c.finish === 'secret' ? n >= 153 : n >= 97 && n <= 124; }) && cards.every((c) => c.n.endsWith('/124'));
  check(numOk, 'E  each card\'s printed number is in its range (097-124; Gold 125-152; secrets 153-171), all /124');
  const bar = await until(async () => f.evaluate(() => window.__pack.log.some((e) => e.kind === 'setBar')), 15000) && await f.evaluate(() => window.__pack.log.filter((e) => e.kind === 'setBar').at(-1));
  check(bar && bar.total === 124, `E  the summary's set bar counts out of ${bar?.total} (before ${bar?.before})`);
  await wait(800);
  await shot(page, 'pack-summary');
  await page.click('#opening .close, #op-close').catch(() => page.keyboard.press('Escape'));
} finally {
  // ---- F ----
  for (const w of [1440, 390]) {
    const pg = await (await browser.newContext({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1 })).newPage();
    pg.on('pageerror', (e) => errors.push(`faces ${w}: ${e}`));
    pg.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
    await pg.goto(pathToFileURL(resolve(ROOT, 'render/output/card-faces.html')).href);
    await wait(800);
    const r = await pg.evaluate(() => [...document.querySelectorAll('.bkrow')].map((row) => ({ id: row.dataset.card, faces: [...row.querySelectorAll('.sc')].map((sc) => { const f = sc.querySelector('.face'); const t = f.querySelector('.text'); return { fin: sc.dataset.finish, fit: Number(t.style.getPropertyValue('--fit')), crowded: packTextCrowded(t, f.querySelector('.stats')), nf: t.classList.contains('noflav') }; }) })));
    const faces = r.flatMap((x) => x.faces.map((f) => ({ ...f, id: x.id })));
    const crowded = faces.filter((f) => f.crowded);
    const dropped = faces.filter((f) => f.nf);
    check(r.length === 28 && faces.length === 131 && crowded.length === 0, `F  ${w} px: the face sheet's 28 booster rows, ${faces.length} faces; still crowded after the fit: ${crowded.length}${crowded.length ? ' (' + crowded.map((f) => f.id + ':' + f.fin).join(' ') + ')' : ''}`);
    check(dropped.every((f) => f.fin === 'prototype'), `F  ${w} px: the flavor line dropped on ${dropped.length} faces, all Prototype faces (${dropped.map((f) => f.id).join(' ')})`);
    if (w === 1440) {
      const row = await pg.$('.bkrow[data-card="CX-107"]');
      await row.screenshot({ path: resolve(OUT, 'v2-s75-faces-grid-consensus.jpg'), type: 'jpeg', quality: 80 });
    }
    await pg.context().close();
  }
  // ---- G ----
  check(external.length === 0, `G  no external requests (${external.length})`);
  check(errors.length === 0, `G  no page errors (${errors.length})${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
  console.log(`\n${passes} PASS, ${fails} FAIL`);
  await browser.close();
  try { process.kill(-demo.pid, 'SIGINT'); } catch { /* gone */ }
  setTimeout(() => process.exit(fails ? 1 : 0), 1500);
}

async function playSingle(page, { stopAfter = Infinity } = {}) {
  const f = frameOf(page);
  await until(async () => (await P(page))?.phase === 'pack');
  // The frame's log runs across openings: only this one's beats count.
  const from = await f.evaluate(() => window.__pack.log.length);
  const pk = await f.locator('#pack').boundingBox();
  await page.mouse.click(pk.x + pk.width / 2, pk.y + pk.height / 2);
  // Render session 54, the check-E flake, found: under load the tear and the
  // cards rising took longer than this wait's old 15 s, the loop below saw
  // no 'cards' phase and never ran, and the reveal was left untouched (the
  // page received the tear and no other press; it stalled in 6 of 9 runs
  // with eight busy loops beside the browser, none of 4 without). The page was
  // never at fault. Now: the tear gets a minute; the loop never asks for a card past
  // the last (it used to block 30 s on a box that can't exist while the
  // summary comes in); every tap waits for the card to be free; a reveal tap
  // is checked to have started (this pack's log only) and re-sent if not;
  // and a stall says where it stopped.
  if (!(await until(async () => (await P(page))?.phase === 'cards', 60000))) note(`the tear never reached the cards in 60 s (phase ${(await P(page))?.phase})`);
  let guard = 0, taps = 0, noBox = 0;
  while ((await P(page))?.phase === 'cards' && guard++ < 60) {
    if (taps >= stopAfter) return null;
    await until(async () => f.evaluate(() => window.__pack.busyUntil - performance.now() <= 0), 30000);
    const st = await f.evaluate(() => ({ n: window.__pack.cur.cards.length, i: window.__pack.i, down: window.__pack.cur.cards[window.__pack.i]?.faceDown, rev: !!window.__pack.revealed[window.__pack.i], zd: window.__pack.cur.cards[window.__pack.i]?.reveal === 'zeroDay' }));
    if (st.i >= st.n) { await wait(150); continue; }
    let boxErr = null;
    const box = await f.locator(`.cslot[data-k="${st.i}"]`).boundingBox({ timeout: 5000 }).catch((e) => { boxErr = String(e.message || e).split('\n')[0]; return null; });
    if (!box) { if (!noBox++) note(`no box for card ${st.i}: ${boxErr ?? 'null'} (count ${await f.locator(`.cslot[data-k="${st.i}"]`).count().catch(() => '?')})`); await wait(100); continue; }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    taps++;
    if (st.down && !st.rev) {
      const began = await until(async () => f.evaluate(([from, k]) => window.__pack.log.slice(from).some((e) => e.kind === 'reveal' && e.idx === k), [from, st.i]), 2000);
      if (!began) { note(`a reveal tap on card ${st.i} was dropped; tapping again`); continue; }
      await until(async () => f.evaluate(([from, a]) => window.__pack.log.slice(from).some((e) => (a.zd ? e.kind === 'zeroDayArrive' : e.kind === 'landed') && e.idx === a.i), [from, st]), 20000);
      continue;
    }
    await wait(150);
  }
  if ((await P(page))?.phase !== 'summary' && !(await until(async () => (await P(page))?.phase === 'summary', 30000))) {
    note(`the reveal stopped short of its summary: ${JSON.stringify(await f.evaluate(() => ({ phase: window.__pack.phase, i: window.__pack.i, busy: Math.round(window.__pack.busyUntil - performance.now()), last: window.__pack.log.slice(-4).map((e) => e.kind + (e.idx ?? '')) })))}`);
    // What a tap at the top card lands on, in the page and in the frame.
    const k = await f.evaluate(() => window.__pack.i);
    const b = await f.locator(`.cslot[data-k="${k}"]`).boundingBox().catch(() => null);
    if (b) {
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const top = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '#' + e.id + '.' + e.className : null; }, [cx, cy]);
      const fr = await page.$eval('#opening iframe', (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y]; });
      const inner = await f.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + String(e.className).slice(0, 60) + ' in ' + (e.closest('.cslot') ? 'cslot ' + e.closest('.cslot').getAttribute('data-k') : e.closest('#stack') ? 'stack' : 'no stack') : null; }, [cx - fr[0], cy - fr[1]]);
      note(`a tap at the top card (${Math.round(cx)},${Math.round(cy)}) lands on ${top} in the page; in the frame on ${inner}; frame at ${fr.join(',')}`);
    } else note(`the top card ${k} has no box`);
  }
  await until(async () => (await P(page))?.phase === 'summary');
  return f.evaluate((from) => {
    const cards = window.__pack.cur.cards;
    const shown = window.__pack.log.slice(from).filter((e) => e.kind === 'cardShown').map((e) => e.idx);
    const SL = { Common: 0, Uncommon: 1, Rare: 2, shine: 3, bonus: 4 };
    const ordered = JSON.stringify(shown) === JSON.stringify(cards.map((_, k) => k)) && cards.every((c, k) => k === 0 || SL[cards[k - 1].slot] <= SL[c.slot]);
    return { ids: cards.map((c) => c.cardId + '|' + c.finish).sort(), ordered, n: cards.length, shown, slots: cards.map((c) => c.slot) };
  }, from);
}
