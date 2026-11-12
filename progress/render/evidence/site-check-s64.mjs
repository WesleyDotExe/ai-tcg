// Render session 64 (hardening pass): session 47's site check
// (`site-check-s47.mjs`) brought up to the Store as render session 63 laid
// it out. s47 went stale by design in session 63: it drove the 1-to-10
// stepper and `#buy-btn`, both replaced by tiles (the free daily pack, 1
// pack, 10 packs; owner call 2: no stepper), and its ten-pack open pressed
// Skip to reach the summary, which can no longer pass a stop (render 62).
// What changed: A (the Store's sections and tiles, the server's prices on
// them), B (the claim from the featured tile), C (two buys from the 1 pack
// tile, each with its confirm; the 10 packs tile's state), G (the ten tapped
// through every stop, each pack's cards checked against the server's) and L
// (the narrow layout). D, E, F, H, J, K, M and N are s47's as they were:
// pack opening full screen from the top bar, the Store and the Packs widget,
// a single pack stepped through to its summary, "Open another", Close
// mid-reveal, Esc only on the summary, every card checked against the
// copies the server logged, the account's sound setting in the frame and
// saved back, the liquid paused under the opening, no external requests, no
// page errors. All against the real owner API (render/src/site/siteDemo.ts:
// a fresh season database, the game lane's owner API unchanged).
//
//   node progress/render/evidence/site-check-s64.mjs [stills dir]
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
// A still is evidence, not a check: under load it may time out, and the run goes on.
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `v2-s64-store-${name}.jpg`), type: 'jpeg', quality: 80, timeout: 20000 }).catch(() => note(`(the still "${name}" timed out)`));
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

// Plays one single pack in the frame: tear (a tap), then tap through every
// card, waiting out each reveal's hold, until the summary. Returns what
// the reveal showed: each card's id and finish in the order shown, and
// whether the order was the plan's (0..n-1) with the shine slot last.
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
// Plays a ten-pack open in the frame with real taps, the way an owner does:
// the fan, then each row stop (tapping the held card itself), each card of a
// big pull's stack, and the row to move on. Returns the stops met.
async function playTen(page) {
  const f = frameOf(page), t0 = Date.now();
  let stops = 0, last = '';
  const tapAt = async (sel) => { const bx = await f.locator(sel).first().boundingBox().catch(() => null); if (bx) await page.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); return !!bx; };
  while (Date.now() - t0 < 300000) {
    const s = await f.evaluate(() => {
      const S = window.__pack, now = performance.now(), R = S.row, isHeld = (c) => (c.build ? !!c.build.held : !!c.faceDown);
      const downs = R && R.r ? R.r.cards.map((_, k) => k).filter((k) => isHeld(R.r.cards[k]) && !R.flipped[k]) : [];
      const c = S.cur && S.cur.cards && S.cur.cards[S.i];
      return { phase: S.phase, bp: S.bp, i: S.i, n: S.cur && S.cur.cards ? S.cur.cards.length : 0, busy: now < S.busyUntil, nextBusy: now < S.nextAt, row: !!R, building: !!(R && R.building), waiting: !!(R && R.waiting), downs, held: !!(c && isHeld(c) && !S.revealed[S.i]) };
    });
    if (s.phase === 'summary') return { ok: true, ms: Date.now() - t0, stops };
    if (s.phase === 'fan') { await tapAt('#fan'); await wait(300); continue; }
    if (s.phase === 'cards') {
      if (s.busy || s.i >= s.n) { await wait(80); continue; }
      if (s.held && last !== `s${s.bp}:${s.i}`) { last = `s${s.bp}:${s.i}`; stops++; }
      await tapAt(`.cslot[data-k="${s.i}"]`);
      if (s.held) await until(async () => f.evaluate(([bp, k]) => window.__pack.log.some((e) => e.bp === bp && e.idx === k && (e.kind === 'landed' || e.kind === 'zeroDayArrive')), [s.bp, s.i]), 30000);
      else await wait(150);
      continue;
    }
    if (s.phase === 'bulk') {
      if (!s.row || s.building || (s.busy && !s.waiting)) { await wait(80); continue; }
      if (s.downs.length) {
        const k = s.downs[0];
        if (last !== `r${s.bp}:${k}`) { last = `r${s.bp}:${k}`; stops++; }
        await tapAt(`.bcard[data-k="${k}"]`);
        await until(async () => f.evaluate(([bp, k]) => window.__pack.log.some((e) => e.kind === 'landed' && e.where === 'row' && e.bp === bp && e.idx === k), [s.bp, k]), 30000);
        continue;
      }
      if (s.nextBusy) { await wait(80); continue; }
      await tapAt('#brow');
      await wait(150);
      continue;
    }
    await wait(100);
  }
  note(`the ten stopped short of its summary (phase ${(await P(page))?.phase})`);
  return { ok: false, ms: Date.now() - t0, stops };
}
// The copies the server logged for that pack (GET /api/packs/:id/opening), as cardId|finish.
async function loggedCards(page, packId) {
  const o = await apiGet(page, `/api/packs/${packId}/opening`);
  // Game session 68: the endpoint answers the PackOpening itself (its cards), no longer the logged copies.
  return (o.cards ?? o.copies).map((c) => c.cardId + '|' + c.finish).sort();
}
const same = (shown, logged) => !!shown && shown.ordered && JSON.stringify(shown.ids) === JSON.stringify(logged);
// Render session 64: the Store as render 63 laid it out (tiles, not the stepper).
const waitingN = (page) => page.$eval('.st-open .pkw-n', (e) => parseInt(e.textContent, 10)).catch(() => NaN);
const tile = (page, id) => page.$eval(`#page .sh-t[data-tile="${id}"]`, (t) => {
  const b = t.querySelector('.sh-buy'), p = t.querySelector('.sh-price');
  return { feature: t.classList.contains('t-feature'), price: p && !p.classList.contains('free') ? p.textContent.replace(/\D/g, '') : null, btn: b ? b.textContent.trim() : null, enabled: b ? !b.disabled : false, why: t.querySelector('.sh-why')?.textContent ?? null, line: t.querySelector('.sh-info small')?.textContent ?? null };
}).catch(() => null);
const summaryButtons = (page) => frameOf(page).$$eval('.summary .btns button', (bs) => bs.map((b) => ({ act: b.dataset.site, text: b.textContent, disabled: b.disabled, pri: b.classList.contains('pri') })));

try {
  const { ctx, page } = await open();
  await signIn(page);

  // A. The Store page (render session 63's layout) draws the server's numbers.
  await page.click('#nav [data-page="store"]');
  await page.waitForSelector('#page .sh-grid .sh-t');
  let packs = await apiGet(page, '/api/packs');
  const store = await apiGet(page, '/api/store');
  const txt = await page.textContent('#page');
  const sections = await page.$$eval('#page h3', (hs) => hs.map((h) => h.textContent.trim()));
  check(['Packs', 'Cosmetics', 'Waiting to be opened', "Your agents' loadouts", 'Recent openings'].every((x) => sections.includes(x)), `A  the Store page has its sections: ${sections.join(' · ')}`);
  const big = await waitingN(page);
  check(big === packs.unopened.length && big === 11, `A  "Waiting to be opened" is the server's count (${big}; the server: ${packs.unopened.length})`);
  const rowsTxt = await page.$$eval('.st-row', (rs) => rs.map((r) => r.querySelector('b').textContent + ':' + r.querySelector('small').textContent.split(' ')[0]));
  check(JSON.stringify(rowsTxt) === JSON.stringify(['Weekly challenge:10', 'Bought:1']), `A  the waiting packs grouped by where they came from: ${rowsTxt.join(', ')}`);
  const price = packs.offer[0].priceCredits;
  const t1 = await tile(page, 'pack-1'), t10 = await tile(page, 'pack-10');
  check(Number(t1.price) === price && Number(t10.price) === price * 10 && t1.btn.startsWith('Buy'), `A  the prices on the tiles are the server's: 1 pack ${t1.price}, 10 packs ${t10.price} (${price} each), "${t1.btn}"`);
  const daily0 = await tile(page, 'daily');
  check(packs.dailyPack.waiting === 1 && daily0.feature && daily0.enabled && /claim/i.test(daily0.btn), `A  one free daily pack waits (a new owner's first day counts): the featured tile, "${daily0.btn}" live`);
  check(store.cosmetics.length > 0 && (await page.$$eval('#page .sh-t[data-tile^="cos-"]', (s) => s.length)) === store.cosmetics.length, `A  the cosmetics on sale: ${store.cosmetics.length}, as the server lists them`);
  const recentN = await page.$$eval('.st-rec', (r) => r.length);
  check(recentN === 6, `A  six recent openings, each with its cards (${recentN})`);
  check(txt.includes('since a Full Art') || txt.includes('sure to hold'), 'A  the pity line is on the Packs section');
  await shot(page, 'page');

  // B. Claim the free daily pack from its tile.
  await page.click('#page .sh-t[data-tile="daily"] .sh-buy');
  await until(async () => (await tile(page, 'daily'))?.btn === 'Claimed today');
  packs = await apiGet(page, '/api/packs');
  const daily1 = await tile(page, 'daily');
  check(packs.dailyPack.waiting === 0 && packs.unopened.length === 12 && packs.unopened.at(-1).source === 'ownerDaily', 'B  claimed: the server holds 0 waiting and a 12th pack, source ownerDaily');
  check(!daily1.enabled && !daily1.feature && daily1.price === null && (await tile(page, 'pack-10')).feature, `B  the daily tile greyed, no price on it ("${daily1.btn}"; ${daily1.line}); the 10 packs are featured now`);
  // Render session 64: the claimed tile counts down on the head's own clock
  // (the same moment, the same hh:mm:ss, ticking), and focus stays on the tile.
  const clocks = await page.evaluate(() => ({ head: document.querySelector('#page .sh-head .sh-clock')?.textContent, tile: document.querySelector('#page .sh-t[data-tile="daily"] .sh-info .sh-clock')?.textContent, tileUntil: document.querySelector('#page .sh-t[data-tile="daily"] .sh-info .sh-clock')?.dataset.until }));
  check(!!clocks.tile && clocks.tile === clocks.head && clocks.tileUntil === packs.dailyPack.nextPackAt && !/ min/.test(daily1.line), `B  the claimed tile's line ticks on the head's clock: "${daily1.line}" (head ${clocks.head}; next at ${packs.dailyPack.nextPackAt})`);
  const focusB = await page.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.tile ?? a.closest('[data-tile]')?.dataset.tile ?? a.tagName) : null; });
  check(focusB === 'daily', `B  focus stays on the daily tile after the redraw greys its button (${focusB})`);
  await until(async () => (await page.textContent('#open-btn .ocount')) === '12');
  check((await page.textContent('#open-btn .ocount')) === '12' && (await waitingN(page)) === 12, 'B  the top bar\'s Open count and the Store\'s waiting count went to 12');
  const twice = await page.evaluate(async () => { const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token; const r = await fetch('/api/packs/daily/claim', { method: 'POST', headers: { Authorization: `Bearer ${t}` } }); return r.status; });
  check(twice === 409, 'B  a second claim the same day is refused by the server (409)');

  // C. Buy 2 packs from the 1 pack tile (owner call 2 of render 63: no stepper; two buys, two confirms).
  const before = (await S(page)).wallet.credits;
  for (let k = 0; k < 2; k++) {
    await page.click('#page .sh-t[data-tile="pack-1"] .sh-buy');
    await page.waitForSelector('#dialog.on .dlg');
    const dlgT = await page.textContent('#dialog .dlg');
    check(dlgT.includes(`${price} credits`), `C  buy ${k + 1}: a centred confirmation names the price ("${dlgT.replace(/\s+/g, ' ').trim().slice(0, 80)}")`);
    await page.click('#dialog [data-a="yes"]');
    await until(async () => (await waitingN(page)) === 13 + k);
    await wait(300);
    const focusC = await page.evaluate(() => { const a = document.activeElement; return a ? `${a.closest('[data-tile]')?.dataset.tile ?? '-'}:${a.dataset.act ?? a.tagName}` : null; });
    check(focusC === 'pack-1:buy-packs', `C  buy ${k + 1}: focus is back on the 1 pack tile's Buy after the confirm and the redraw (${focusC})`);
  }
  const after = (await S(page)).wallet.credits;
  check(before - after === 2 * price && (await waitingN(page)) === 14, `C  bought: ${2 * price} credits taken (${before} -> ${after}), 14 waiting`);
  const t10b = await tile(page, 'pack-10');
  check(after >= price * 10 ? t10b.enabled : (!t10b.enabled && t10b.why === `${(price * 10 - after).toLocaleString('en-US')} credits short`), `C  the 10 packs tile with ${after} credits: ${t10b.enabled ? 'live' : `greyed, "${t10b.why}"`}`);

  // D. Open from the top bar: a single pack, full screen, played to its summary.
  const liqBefore = await page.evaluate(() => window.__site.liquid());
  await page.click('#open-btn');
  await page.waitForSelector('#opening:not([hidden]) iframe');
  await until(async () => (await P(page))?.phase === 'pack');
  const p1 = await P(page);
  check(!!p1 && p1.mode === 'single' && p1.cards >= 5, `D  the top bar's Open opens one pack full screen (pack ${p1?.packId?.slice(0, 8)}, ${p1?.cards} cards)`);
  packs = await apiGet(page, '/api/packs');
  check(packs.unopened.length === 13 && !packs.unopened.some((x) => x.packId === p1.packId), 'D  the server opened the oldest pack before the reveal (13 waiting; the cards are already in the collection)');
  const liq = await page.evaluate(() => window.__site.liquid());
  check(liq === null || (liq.pending === 0 && liq.pause !== 'none'), `D  the liquid behind is paused while the opening covers it (${liq ? liq.pause : 'no WebGL'})`);
  const box = await page.$eval('#opening iframe', (f) => { const r = f.getBoundingClientRect(); return [r.width, r.height]; });
  check(box[0] === 1440 && box[1] === 1000, `D  the opening fills the window (${box.join('x')})`);
  await shot(page, 'open-sealed');
  // Esc before the summary does nothing.
  await page.keyboard.press('Escape');
  await wait(200);
  check(!(await page.$eval('#opening', (e) => e.hidden)), 'D  Esc during the reveal does not close it');
  const shown1 = await playSingle(page);
  const logged1 = await loggedCards(page, p1.packId);
  check(same(shown1, logged1), `D  the reveal showed every card, in slot order (shine last), and exactly the copies the server logged for the pack: ${logged1.join(', ')}`);
  await shot(page, 'open-summary');
  let btns = await summaryButtons(page);
  check(btns.map((b) => b.text).join('|') === 'Open another|Done' && !btns[0].disabled && btns[0].pri, 'D  the summary has the website\'s buttons: "Open another" (13 wait) and "Done"');

  // E. Open another: the next pack, in the same frame.
  await frameOf(page).click('[data-site="one"]');
  await until(async () => { const x = await P(page); return x?.phase === 'pack' && x.packId !== p1.packId; });
  const p2 = await P(page);
  check(p2.packId !== p1.packId, `E  "Open another" opened the next pack (${p2.packId.slice(0, 8)})`);
  const shown2 = await playSingle(page);
  const logged2 = await loggedCards(page, p2.packId);
  check(same(shown2, logged2), 'E  and its reveal matches its logged copies too');
  if (!same(shown2, logged2)) note(`shown ${JSON.stringify(shown2)} logged ${JSON.stringify(logged2)}`);
  // F. Esc on the summary closes, and everything reads again.
  await page.keyboard.press('Escape');
  await page.waitForSelector('#opening[hidden]', { state: 'attached' });
  await until(async () => (await waitingN(page)) === 12);
  check((await S(page)).opening === false && (await page.textContent('#open-btn .ocount')) === '12', 'F  Esc on the summary closes it; the Store and the top bar read 12 waiting');
  const recent = await apiGet(page, '/api/collection?recentPacks=1');
  const firstRec = await page.$eval('.st-rec', (r) => [...r.querySelectorAll('.mc')].map((m) => m.title.split(' · ')[0]).join(','));
  check(recent.recentPulls[0].packId === p2.packId && firstRec === recent.recentPulls[0].cards.map((c) => c.name).join(','), 'F  the newest recent opening is the pack just opened, its cards drawn');
  const focused = await page.evaluate(() => document.activeElement?.id);
  check(focused === 'open-btn', `F  focus went back to what opened it (#${focused})`);

  // G. A ten-pack open from the Store, its summary's buttons.
  await page.click('#open10-btn');
  await page.waitForSelector('#opening:not([hidden]) iframe');
  await until(async () => (await P(page))?.phase === 'fan');
  const g = await frameOf(page).evaluate(() => ({ mode: window.__pack.mode }));
  check(g.mode === 'bulk', 'G  "Open 10" plays a ten-pack open (the fan of ten)');
  const tenFrom = await frameOf(page).evaluate(() => window.__pack.log.length);
  const tenPlan = await frameOf(page).evaluate(() => window.__pack.B.packs.map((pk) => ({ packId: pk.packId, cards: pk.cards.map((c) => c.cardId + '|' + c.finish), held: pk.cards.filter((c) => (c.build ? c.build.held : c.faceDown)).length })));
  // Render session 64: Open 10 stops on every held card (render 62), so a
  // Skip can't run past them: the check taps through the ten as an owner does.
  const ten = await playTen(page);
  const tenLog = await frameOf(page).evaluate((n) => window.__pack.log.slice(n), tenFrom);
  const wantStops = tenPlan.reduce((n, pk) => n + pk.held, 0);
  check(ten.ok && ten.stops === wantStops, `G  tapped through the ten in ${(ten.ms / 1000).toFixed(1)} s: ${ten.stops} stops met, ${wantStops} held cards in the ten (${tenLog.filter((e) => e.kind === 'landed').length} landed)`);
  let tenSame = true;
  for (const pk of tenPlan) { const lg = await loggedCards(page, pk.packId); if (JSON.stringify(lg) !== JSON.stringify([...pk.cards].sort())) tenSame = false; }
  check(tenSame && new Set(tenPlan.map((pk) => pk.packId)).size === 10, 'G  each of the ten packs shows exactly the copies the server logged for it');
  check(!!(await frameOf(page).$('.bulk-sum')), 'G  the ten-pack summary shows');
  await wait(900);
  const top = await frameOf(page).$eval('.summary', (e) => e.scrollTop);
  check(top === 0, `G  it opens at its top, the cards first (scrolled ${top} px)`);
  await shot(page, 'open-ten-summary');
  btns = await summaryButtons(page);
  const why = await frameOf(page).textContent('.summary .why').catch(() => '');
  check(btns.map((b) => `${b.text}${b.disabled ? ' (off)' : ''}`).join('|') === 'Open 10 more (off)|Open one pack|Done' && /needs 10 packs waiting; you have 2/.test(why), `G  its buttons: "Open 10 more" greyed (${why}), "Open one pack", "Done"`);
  packs = await apiGet(page, '/api/packs');
  check(packs.unopened.length === 2, 'G  the server holds 2 waiting after the ten');
  await frameOf(page).click('[data-site="done"]');
  await page.waitForSelector('#opening[hidden]', { state: 'attached' });
  check(true, 'G  "Done" closes it');

  // H. Close mid-reveal from the Packs widget on Home; the pack is opened anyway.
  await page.click('#nav [data-page="home"]');
  await page.waitForSelector('#wgrid [data-act="open-packs"][data-count="1"]:not([disabled])');
  await page.click('#wgrid [data-act="open-packs"][data-count="1"]');
  await until(async () => (await P(page))?.phase === 'pack');
  const p3 = await P(page);
  // The account's sound setting in the frame, and its mute saved back.
  let st = await frameOf(page).evaluate(() => SND.state());
  check(st !== 'muted', `H  the frame's sound follows the account (on: ${st})`);
  await frameOf(page).click('#btn-sound');
  await until(async () => (await apiGet(page, '/api/account/settings')).sound.on === false, 4000);
  const acct = await apiGet(page, '/api/account/settings');
  check(acct.sound.on === false && acct.sound.volume === 80, `H  muting in the opening saves to the account (sound ${JSON.stringify(acct.sound)})`);
  await playSingle(page, { stopAfter: 2 });
  await frameOf(page).click('#close');
  await page.waitForSelector('#opening[hidden]', { state: 'attached' });
  packs = await apiGet(page, '/api/packs');
  check(packs.unopened.length === 1 && !packs.unopened.some((x) => x.packId === p3.packId), 'H  the Packs widget\'s Open opens one; Close mid-reveal goes back, and the pack stays opened (1 waiting)');
  await page.waitForFunction(() => document.querySelector('#open-btn .ocount')?.textContent === '1');
  check(true, 'H  the top bar reads 1 waiting after the close');

  // J. The last pack, from its row in "Waiting to be opened" (a chosen
  // pack); the account's sound setting in the frame, and its mute saved back.
  await page.click('#nav [data-page="store"]');
  await page.waitForSelector('.st-open [data-act="open-packs"][data-pack]');
  const chosen = await page.$eval('.st-open [data-act="open-packs"][data-pack]', (b) => b.dataset.pack);
  await page.click('.st-open [data-act="open-packs"][data-pack]');
  await until(async () => (await P(page))?.phase === 'pack');
  check((await P(page)).packId === chosen, 'J  a row\'s "Open one" opens that pack (POST { packId })');
  st = await frameOf(page).evaluate(() => SND.state());
  check(st === 'muted', `J  the next opening reads the saved setting (${st})`);
  await playSingle(page);
  btns = await summaryButtons(page);
  const why2 = await frameOf(page).textContent('.summary .why').catch(() => '');
  check(btns[0].disabled && btns[1].pri && /No packs waiting/.test(why2), `J  with none left, "Open another" is greyed with the reason ("${why2}") and Done is the main button`);
  await frameOf(page).click('[data-site="done"]');
  await page.waitForSelector('#opening[hidden]', { state: 'attached' });
  await page.waitForFunction(() => document.querySelector('#open1-btn')?.disabled === true);
  check(await page.$eval('#open-btn', (b) => b.disabled) && await page.$eval('#open1-btn', (b) => b.disabled), 'J  no packs: the top bar\'s Open and the Store\'s Open are greyed');
  // An open the server refuses (none waiting) shows its words as a toast, and no overlay.
  await page.evaluate(() => { const b = document.querySelector('#open-btn'); b.disabled = false; b.click(); });
  await page.waitForSelector('#toast.on.error');
  const toastT = await page.textContent('#toast');
  check((await page.$eval('#opening', (e) => e.hidden)) && /pack/i.test(toastT), `J  a refused open shows the server's words and no overlay ("${toastT}")`);
  await page.evaluate(async () => { const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token; await fetch('/api/account/settings', { method: 'PATCH', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sound: { on: true } }) }); });

  // K. The frame's page: same origin, its own CSP; the site's CSP allows only it.
  const heads = await page.evaluate(async () => { const a = await fetch('/'); const b = await fetch('/pack-opening'); return [a.headers.get('content-security-policy'), b.headers.get('content-security-policy')]; });
  check(/frame-src 'self'/.test(heads[0]) && /frame-ancestors 'self'/.test(heads[1]) && !/connect-src/.test(heads[1]), 'K  CSP: the site may frame only itself; the opening may be framed only by the site and fetches nothing');

  // L. A narrow window stacks the Store's panels; dark mode.
  await page.setViewportSize({ width: 900, height: 1000 });
  await wait(300);
  const cols = await page.$$eval('.st-grid > *', (s) => new Set(s.map((x) => Math.round(x.getBoundingClientRect().left))).size);
  const tileCols = await page.$eval('#page .sh-grid', (g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
  check(cols === 1 && tileCols === 2, `L  at 900 px the Store's lower panels stack in one column (${cols}) and the pack tiles go to two (${tileCols})`);
  const over = await page.evaluate(() => document.querySelector('#page').scrollWidth - document.querySelector('#page').clientWidth);
  check(over <= 1, `L  nothing runs off the side (${over} px)`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.click('#theme-btn'); await page.click('#theme-btn');
  await wait(400);
  await shot(page, 'page-dark');
  await page.click('#theme-btn');
  await ctx.close();

  // M. Reduce motion, as another owner (Rook: the starter grant's packs, unopened).
  const r = await open({ reducedMotion: 'reduce' });
  await r.page.goto(url);
  await r.page.waitForSelector('#signin:not([hidden])');
  await r.page.fill('#si-login', 'rook');
  await r.page.fill('#si-pass', 'a long demo password');
  await r.page.click('#si-go');
  await r.page.waitForSelector('#wgrid, .wempty h3');
  await r.page.waitForSelector('#open-btn:not([disabled])');
  const rookN = Number(await r.page.textContent('#open-btn .ocount'));
  await r.page.click('#open-btn');
  await until(async () => (await P(r.page))?.phase === 'pack');
  const t0 = Date.now();
  const shownR = await playSingle(r.page);
  check(!!shownR && shownR.ordered && shownR.n >= 5, `M  under reduce motion the opening plays to its summary (another owner, ${rookN} starter packs; ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  check(JSON.stringify(shownR.ids) === JSON.stringify(await loggedCards(r.page, (await P(r.page)).packId)), 'M  and shows that owner\'s logged copies');
  await frameOf(r.page).click('[data-site="done"]');
  await r.page.waitForSelector('#opening[hidden]', { state: 'attached' });
  await r.ctx.close();

  check(external.length === 0, `N  no request left the site (${external.length})`);
  check(errors.length === 0, `N  no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
} catch (e) {
  check(false, `the run stopped: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  try { process.kill(-demo.pid, 'SIGTERM'); } catch { /* gone */ }
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
}
