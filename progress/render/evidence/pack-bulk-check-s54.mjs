// Render session 54 (hardening pass): the ten-pack opening, driven like an
// owner would in a real (headless) Chromium. This replaces session 25's
// `pack-bulk-check.mjs`, which was written for the first ten-pack design
// (an automatic sequence with speeds) and went stale when the owner's
// 2026-10-18 feel notes made the open tap-driven: each tap tears the next
// pack, the owner flips the face-down cards, a big pull plays its full
// reveal right there in the row (no second tear), and "Auto" (off by
// default) is the old automatic sequence, the only place the 1x/2x/4x
// speeds apply.
//
//   node progress/render/evidence/pack-bulk-check-s54.mjs [shotDir] [page]
// (page defaults to render/output/pack-opening.html; build it first with
// `npm run pack-opening -w render`). At 1280 x 800 and at 390 x 844 (a phone):
//   T. by tap, the default (Auto off), "10 packs, big pull": every fast pack
//      is torn by a tap, its face-down cards flipped by taps, then a tap
//      moves on; the big pull is tapped through its stack;
//   A. Auto at 4x, "10 packs", hands off after the fan;
//   B. Auto at 1x, "10 packs, big pull", hands off: the big pull steps
//      through its reveal by itself, at full length;
//   C. Auto at 2x, "10 packs, big pull", Skip pressed at once, then again
//      after the big pull.
// Each run checks:
//   - every pack comes up once, in order; only the store's fullReveal packs
//     play a full reveal, and every one of them does (Skip included);
//   - the honest tell: sparks iff the pack holds a hit;
//   - a fast pack deals exactly its cards and turns every face-down one
//     (by tap in T, by itself in Auto), never a face-up one;
//   - a big pull reveals every face-down card as its own finish's reveal;
//     in Auto each step waits for the last one's moment (busyUntil) plus
//     the beat, so Auto never cuts a reveal short at any speed;
//   - the speed buttons show only in Auto, and no controls show during a
//     big pull;
//   - the summary grid holds every copy (tile counts add up to the cards),
//     the store's NEW count and pack points; nothing left over on stage;
//   - no horizontal scroll, the row fits on screen, no page errors.
// Then: the speed and Auto choices are remembered across a reload.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Render session 60: inside a big pull's stack a card is held face down by
// its build (the ceremony part 2: every finish AND every plain Rare and
// Mythic), not by `faceDown`, which still decides the fast row's flips.
const heldInStack = (c) => (c.build ? c.build.held : c.faceDown);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const shotDir = resolve(process.argv[2] ?? resolve(ROOT, 'progress/render/evidence'));
const file = resolve(process.argv[3] ?? resolve(ROOT, 'render/output/pack-opening.html'));
mkdirSync(shotDir, { recursive: true });

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

const chromium = await loadPlaywright();
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
let fails = 0, passes = 0;
const say = (s) => console.log(s);
const phase = (p) => p.evaluate(() => window.__pack.phase);
const shot = (p, name) => p.screenshot({ path: `${shotDir}/v2-s54-${name}.jpg`, type: 'jpeg', quality: 80 }).catch(() => say(`      (still ${name} timed out)`));
async function waitFor(p, fn, arg, ms = 30000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(60); }
  return false;
}
const url = (q) => pathToFileURL(file).href + (q ? '?' + q : '');

// A big pull by tap: tap through the stack; a face-down card is tapped once
// to reveal, waited on, then tapped again to send it off.
async function tapStack(p, plan, h, w, problems, shotTag) {
  await waitFor(p, () => window.__pack.phase === 'cards');
  let guard = 0;
  while ((await phase(p)) === 'cards' && guard++ < 60) {
    if (!(await waitFor(p, () => window.__pack.busyUntil <= performance.now(), null, 15000))) { problems.push('a big pull stayed busy for 15 s'); break; }
    const st = await p.evaluate(() => window.__pack.i);
    const c = plan.cards[st];
    const box = c && await p.locator(`.cslot[data-k="${st}"]`).boundingBox();
    if (!box) { await p.waitForTimeout(100); continue; }
    if (box.y < 0 || box.y + box.height > h + 2 || box.x < 0 || box.x + box.width > w) problems.push(`big pull card ${st} off screen`);
    const revealed = await p.evaluate((k) => !!window.__pack.revealed[k], st);
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    if (heldInStack(c) && !revealed) {
      if (c.reveal === 'zeroDay') await waitFor(p, () => window.__pack.log.some((e) => e.kind === 'zeroDayArrive'), null, 15000);
      else await waitFor(p, (k) => window.__pack.log.some((e) => e.kind === 'landed' && e.idx === k), st);
      if (shotTag && c.hit) { await p.waitForTimeout(400); await shot(p, `big-pull-${c.reveal}-${shotTag}`); }
      continue;
    }
    await p.waitForTimeout(120);
  }
}

// A fast pack by tap: flip what is face down, then tap on to the next.
async function tapRow(p, plan, problems) {
  if (!(await waitFor(p, () => window.__pack.log.some((e) => e.kind === 'bulkDealt' && e.bp === window.__pack.bp), null, 10000))) { problems.push('a fast pack never dealt'); return; }
  const bp = await p.evaluate(() => window.__pack.bp);
  let guard = 0;
  while (guard++ < 30) {
    const st = await p.evaluate(() => ({ bp: window.__pack.bp, ph: window.__pack.phase, busy: window.__pack.busyUntil > performance.now() || window.__pack.nextAt > performance.now() }));
    if (st.bp !== bp || st.ph !== 'bulk') return;
    if (st.busy) { await p.waitForTimeout(60); continue; }
    const row = await p.locator('#brow').boundingBox();
    await p.mouse.click(row.x + row.width / 2, row.y + row.height / 2);
    await p.waitForTimeout(80);
  }
  problems.push(`pack ${bp + 1}: still on screen after 30 taps`);
}

function checkRun(log, data, bi, problems, run) {
  const B = data.bulks[bi].reveal;
  const packs = log.filter((e) => e.kind === 'bulkPack');
  if (JSON.stringify(packs.map((e) => e.bp)) !== JSON.stringify(B.packs.map((_, k) => k))) problems.push(`packs came up ${JSON.stringify(packs.map((e) => e.bp))}`);
  if (!run.skip && log.some((x) => x.kind === 'bulkSkip')) problems.push('skip logged without a press');
  for (const [k, plan] of B.packs.entries()) {
    const e = packs.find((x) => x.bp === k);
    if (!e) continue;
    if (e.fast === plan.fullReveal) problems.push(`pack ${k + 1}: fast=${e.fast}, store fullReveal=${plan.fullReveal}`);
    if (e.sparks !== plan.sparks) problems.push(`pack ${k + 1}: planned sparks ${e.sparks} vs ${plan.sparks}`);
    if (e.skipped) { if (!run.skip) problems.push(`pack ${k + 1} skipped`); continue; }
    // A Skip pressed while this pack ran (sealed, torn or dealt) cuts it
    // short on purpose: it still counts in the summary.
    const cut = log.some((x) => x.kind === 'bulkSkip' && x.from === k);
    const tear = log.find((x) => x.kind === 'tear' && x.bp === k);
    if (!tear) { if (!cut || plan.fullReveal) problems.push(`pack ${k + 1}: never torn`); continue; }
    if (tear.via !== (run.auto ? 'auto' : 'tap')) problems.push(`pack ${k + 1}: torn via ${tear.via}`);
    const sparked = log.some((x) => x.kind === 'sparks' && x.bp === k);
    if (sparked !== plan.sparks) problems.push(`pack ${k + 1}: sparks ${sparked}, hit ${plan.sparks}`);
    if (plan.fullReveal) {
      for (const [ci, c] of plan.cards.entries()) {
        const rv = log.find((x) => x.kind === 'reveal' && x.bp === k && x.idx === ci);
        if (heldInStack(c) && (!rv || rv.as !== c.reveal)) problems.push(`pack ${k + 1} card ${ci}: reveal ${rv ? rv.as : 'none'}, want ${c.reveal}`);
        if (!heldInStack(c) && rv) problems.push(`pack ${k + 1} card ${ci}: a face-up card was "revealed"`);
      }
      if (!log.some((x) => x.kind === 'bulkFullDone' && x.bp === k)) problems.push(`pack ${k + 1}: big pull never finished`);
      if (log.some((x) => x.kind === 'skip' && x.bp === k)) problems.push(`pack ${k + 1}: the big pull's own Skip was pressed`);
      continue;
    }
    const dealt = log.find((x) => x.kind === 'bulkDealt' && x.bp === k);
    if (!dealt) { if (!cut) problems.push(`pack ${k + 1}: never dealt`); continue; }
    if (JSON.stringify(dealt.cards.map((c) => c.finish)) !== JSON.stringify(plan.cards.map((c) => c.finish))) problems.push(`pack ${k + 1}: dealt ${dealt.cards.map((c) => c.finish)}`);
    const flips = log.filter((x) => x.kind === 'bulkFlip' && x.bp === k);
    const want = plan.cards.map((c, i) => (c.faceDown ? i : -1)).filter((i) => i >= 0);
    if (!cut && JSON.stringify(flips.map((x) => x.idx).sort()) !== JSON.stringify(want)) problems.push(`pack ${k + 1}: turned ${JSON.stringify(flips.map((x) => x.idx))}, want ${JSON.stringify(want)}`);
    const via = run.auto ? 'auto' : 'tap';
    if (flips.some((x) => x.via !== via)) problems.push(`pack ${k + 1}: a flip came by ${flips.find((x) => x.via !== via).via}`);
  }
  // Auto never cuts a big pull's reveal short: each act waits for busyUntil.
  if (run.auto) {
    for (const e of log.filter((x) => x.kind === 'cardLeft')) {
      const rv = log.filter((x) => x.kind === 'reveal' && x.bp === e.bp && x.idx === e.idx && x.t <= e.t).pop();
      const plan = B.packs[e.bp]?.cards[e.idx];
      if (plan && heldInStack(plan) && rv && e.t - rv.t < 700) problems.push(`pack ${e.bp + 1} card ${e.idx}: left ${e.t - rv.t} ms after its reveal began`);
    }
  }
  const sum = log.find((e) => e.kind === 'bulkSummary');
  if (!sum) { problems.push('no summary'); return; }
  if (sum.copies !== B.summary.cards) problems.push(`summary holds ${sum.copies} copies of ${B.summary.cards}`);
  if (sum.tiles !== B.tiles.length) problems.push(`summary ${sum.tiles} tiles, plan ${B.tiles.length}`);
  if (sum.packPoints !== B.summary.packPoints) problems.push('pack points differ');
}

const RUNS = [
  { id: 'T', bulk: 1, auto: false, speed: 1 },
  { id: 'A', bulk: 0, auto: true, speed: 4 },
  { id: 'B', bulk: 1, auto: true, speed: 1 },
  { id: 'C', bulk: 1, auto: true, speed: 2, skip: true },
];

for (const [w, h, tag] of [[1280, 800, 'desktop'], [390, 844, 'phone']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag === 'phone' ? 2 : 1 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url());
  await p.waitForTimeout(300);
  const data = await p.evaluate(() => JSON.parse(document.getElementById('pack-data').textContent));

  for (const run of RUNS) {
    const problems = [];
    const B = data.bulks[run.bulk].reveal;
    await p.goto(url('bulk=' + (run.bulk + 1)));
    await p.waitForTimeout(300);
    // The fan: Auto shows as a switch, the speeds only once Auto is on.
    const before = await p.evaluate(() => ({ auto: document.getElementById('bauto').getAttribute('aria-checked'), autoShown: !!document.getElementById('bauto').offsetParent, speedShown: !!document.getElementById('speed').offsetParent }));
    if (!before.autoShown) problems.push('the Auto switch is not showing on the fan');
    const isAuto = before.auto === 'true';
    if (isAuto !== before.speedShown) problems.push(`speeds ${before.speedShown ? 'showing' : 'hidden'} with Auto ${isAuto ? 'on' : 'off'}`);
    if (isAuto !== run.auto) await p.click('#bauto');
    if (run.auto) {
      if (!(await p.evaluate(() => !!document.getElementById('speed').offsetParent))) problems.push('speeds hidden with Auto on');
      await p.click(`#speed button[data-speed="${run.speed}"]`);
    } else if (await p.evaluate(() => !!document.getElementById('speed').offsetParent)) problems.push('speeds showing with Auto off');
    if (run.id === 'T') await shot(p, `fan-${tag}`);
    await p.evaluate(() => { window.__pack.log.length = 0; });
    const t0 = Date.now();
    await p.click('#fan');
    if (run.skip) { await p.waitForTimeout(150); await p.click('#bskip'); }
    let shotRow = false, guard = 0, controlsInBigPull = false, lastBp = -2;
    while (guard++ < 3000 && Date.now() - t0 < 240000) {
      const st = await p.evaluate(() => ({ ph: window.__pack.phase, bp: window.__pack.bp, row: !!window.__pack.row, waiting: !!(window.__pack.row && window.__pack.row.waiting) }));
      if (st.ph === 'summary') break;
      if (st.ph === 'cards') {
        if (await p.evaluate(() => !!(document.getElementById('speed').offsetParent || document.getElementById('bskip').offsetParent || document.getElementById('bauto').offsetParent))) controlsInBigPull = true;
        if (!run.auto) await tapStack(p, B.packs[st.bp], h, w, problems, tag);
        else await p.waitForTimeout(100);
        if (run.skip) { await waitFor(p, () => window.__pack.phase !== 'cards'); await p.waitForTimeout(100); if ((await phase(p)) === 'bulk') await p.click('#bskip'); }
        continue;
      }
      if (!run.auto && st.ph === 'bulk') {
        if (st.waiting) { const row = await p.locator('#brow').boundingBox(); await p.mouse.click(row.x + row.width / 2, row.y + row.height / 2); await p.waitForTimeout(100); continue; }
        if (st.bp !== lastBp && st.bp >= 0 && !B.packs[st.bp].fullReveal) {
          lastBp = st.bp;
          // A still of a fast row: the first pack holding a hit, flipped.
          if (!shotRow && B.packs[st.bp].sparks) {
            await waitFor(p, () => window.__pack.log.some((e) => e.kind === 'bulkDealt' && e.bp === window.__pack.bp), null, 10000);
            await p.waitForTimeout(900);
            await shot(p, `row-down-${tag}`);
          }
          await tapRow(p, B.packs[st.bp], problems);
          continue;
        }
      }
      if (run.auto && !shotRow && st.ph === 'bulk') {
        const popped = await p.evaluate(() => document.querySelectorAll('.bcard.pop').length);
        if (popped) {
          shotRow = true;
          const row = await p.locator('.bcards').boundingBox();
          if (row && (row.x < 0 || row.x + row.width > w || row.y + row.height > h)) problems.push(`fast row off screen (${Math.round(row.x)},${Math.round(row.y)} ${Math.round(row.width)}x${Math.round(row.height)})`);
          await shot(p, `auto-hit-${run.id}-${tag}`);
        }
      }
      await p.waitForTimeout(40);
    }
    const secs = (Date.now() - t0) / 1000;
    if (run.skip) { const cuts = (await p.evaluate(() => window.__pack.log)).filter((e) => e.kind === 'bulkSkip').map((e) => e.from + 1); say(`      skip pressed at ${cuts.map((n) => (n ? 'pack ' + n : 'the fan')).join(', ')}`); }
    if ((await phase(p)) !== 'summary') problems.push(`no summary after ${secs.toFixed(0)} s (phase ${await phase(p)})`);
    await p.waitForTimeout(900);
    const log = await p.evaluate(() => window.__pack.log);
    checkRun(log, data, run.bulk, problems, run);
    if (controlsInBigPull) problems.push('speed/skip/Auto controls showing during a big pull');
    // A row of a fast pack in T must fit on screen too.
    const dom = await p.evaluate(() => ({
      tiles: document.querySelectorAll('.bulk-sum .tile').length,
      copies: [...document.querySelectorAll('.bulk-sum .tile')].reduce((n, t) => n + Number(t.getAttribute('data-count')), 0),
      news: document.querySelectorAll('.bulk-sum .tile .new').length,
      sub: document.querySelector('.bulk-sum .sub') && document.querySelector('.bulk-sum .sub').textContent,
      scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      overlays: document.querySelectorAll('#stage .wash, #stage .callout, #stage .banner').length,
      controls: !!(document.getElementById('speed').offsetParent || document.getElementById('bskip').offsetParent || document.getElementById('bauto').offsetParent),
    }));
    if (dom.overlays) problems.push(`${dom.overlays} reveal overlays left on the summary`);
    if (dom.controls) problems.push('controls still showing on the summary');
    if (dom.tiles !== B.tiles.length) problems.push(`DOM tiles ${dom.tiles}`);
    if (dom.copies !== B.summary.cards) problems.push(`DOM copies ${dom.copies}`);
    if (dom.news !== B.tiles.filter((t) => t.isNew).length) problems.push(`DOM NEW badges ${dom.news}`);
    if (!dom.sub || !dom.sub.includes(B.summary.newCards + ' new')) problems.push(`summary line "${dom.sub}" lacks the store's ${B.summary.newCards} new`);
    if (dom.scrollX) problems.push('horizontal scroll');
    if (run.id === 'T' || run.id === 'B') await shot(p, `summary-${run.id}-${tag}`);
    const skipped = log.filter((e) => e.kind === 'bulkPack' && e.skipped).length;
    const full = log.filter((e) => e.kind === 'bulkPack' && !e.fast).map((e) => e.bp + 1);
    const flips = log.filter((e) => e.kind === 'bulkFlip').length;
    if (errs.length) problems.push('page errors: ' + errs.splice(0).join(' | '));
    if (problems.length) fails++; else passes++;
    say(`${problems.length ? 'FAIL' : 'PASS'}  ${tag} run ${run.id} (${data.bulks[run.bulk].label}, ${run.auto ? `Auto ${run.speed}x` : 'by tap'}${run.skip ? ', skip' : ''}): ${secs.toFixed(1)} s to the summary; big pulls at pack ${full.join(', ') || 'none'}; ${skipped} packs skipped; ${flips} cards turned in the row; ${dom.tiles} tiles for ${dom.copies} cards, ${dom.news} NEW${problems.length ? '\n      ' + problems.join('\n      ') : ''}`);
  }
  // The last run left Auto on at 2x: both survive a reload.
  await p.goto(url('bulk=1'));
  await p.waitForTimeout(200);
  const kept = await p.evaluate(() => ({ speed: document.querySelector('#speed button[aria-pressed="true"]').getAttribute('data-speed'), auto: document.getElementById('bauto').getAttribute('aria-checked') }));
  const ok = kept.speed === '2' && kept.auto === 'true';
  if (ok) passes++; else fails++;
  say(`${ok ? 'PASS' : 'FAIL'}  ${tag}: speed and Auto remembered across a reload (${kept.speed}x, Auto ${kept.auto === 'true' ? 'on' : 'off'}; want 2x, on)`);
  // And Auto switched off is remembered too (the default comes back).
  await p.click('#bauto');
  await p.goto(url('bulk=1'));
  await p.waitForTimeout(200);
  const off = await p.evaluate(() => ({ auto: document.getElementById('bauto').getAttribute('aria-checked'), speedShown: !!document.getElementById('speed').offsetParent }));
  const ok2 = off.auto === 'false' && !off.speedShown;
  if (ok2) passes++; else fails++;
  say(`${ok2 ? 'PASS' : 'FAIL'}  ${tag}: Auto off is remembered and hides the speeds (Auto ${off.auto}, speeds ${off.speedShown ? 'showing' : 'hidden'})`);
  await ctx.close();
}
await b.close();
say(`${passes} PASS, ${fails} FAIL${fails ? '' : ' (ALL PASS)'}`);
process.exit(fails ? 1 : 0);
