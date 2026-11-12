// Render session 64 (hardening pass): the ten-pack opening, driven like an
// owner would in a real (headless) Chromium. This replaces session 54's
// `pack-bulk-check-s54.mjs`, which went stale by design in render session 62:
// it modelled the old row (only special finishes face down, flipped by
// `bulkFlip`, Auto flipping them by itself). Since session 62 (the 2026-11-06
// brief) every held card (a Rare, a Mythic, a special finish, a Prototype) is
// a STOP: it waits face down for the owner's tap, Auto included, then builds
// where it lies (`build`/`reveal`/`landed` with where: 'row'); plain cards
// arrive face up. Session 62's own check (`pack-ceremony-check-s62.mjs`)
// covers the stops per reveal kind through the debug panel; this one keeps
// what only s54 checked, brought to the stop model:
//   - every pack comes up once, in order; only the store's fullReveal packs
//     play a big pull, every one of them does; Skip passes only packs with
//     no stop in them;
//   - the honest tell: sparks iff the pack holds a hit;
//   - a fast pack deals exactly its cards; the cards dealt face down are
//     exactly its held ones; each builds, reveals as its own kind and lands;
//     no plain card is ever "flipped";
//   - every row stop is logged, and in Auto every stop (row and stack) holds
//     still for 1.2 s untouched before the tap;
//   - a big pull reveals every held card as its own reveal; Auto never cuts
//     a reveal short (each card leaves at least 700 ms after its reveal);
//   - no speed/Auto/Skip controls during a big pull or on the summary;
//   - the summary grid holds every copy (tile counts add up to the cards),
//     the store's NEW count and pack points; no reveal overlays left over;
//   - the row and the stack fit on screen; no horizontal scroll; no page
//     errors; no network requests.
// Then: the speed and Auto choices are remembered across a reload.
//
//   node progress/render/evidence/pack-bulk-check-s64.mjs [shotDir] [page]
// (page defaults to render/output/pack-opening.html; build it with
// `npm run pack-opening -w render`). At 1280 x 800 and 390 x 844 (a phone):
//   T. by tap (Auto off), "10 packs, big pull";
//   A. Auto at 4x, "10 packs": hands off except at the stops;
//   B. Auto at 1x, "10 packs, big pull";
//   C. Auto at 2x, "10 packs, big pull", Skip pressed at the fan, then again
//      after the big pull, and while each pack with a stop is still tearing
//      (render 64 found Skip there ran past that pack's stops; fixed).
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const held = (c) => (c.build ? !!c.build.held : !!c.faceDown);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const shotDir = resolve(process.argv[2] ?? resolve(ROOT, 'progress/render/evidence'));
const file = resolve(process.argv[3] ?? resolve(ROOT, 'render/output/pack-opening.html'));
mkdirSync(shotDir, { recursive: true });

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright not found (set PW_CORE to its index.mjs)');
}

const chromium = await loadPlaywright();
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
let fails = 0, passes = 0;
const say = (s) => console.log(s);
const shot = (p, name) => p.screenshot({ path: `${shotDir}/v2-s64-${name}.jpg`, type: 'jpeg', quality: 80, timeout: 20000 }).catch(() => say(`      (still ${name} timed out)`));
async function waitFor(p, fn, arg, ms = 30000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(50); }
  return false;
}
const url = (q) => pathToFileURL(file).href + (q ? '?' + q : '');
const STILL_MS = 1200;

// At a stop in Auto: watch for `ms` that nothing moves on by itself (no pack
// torn or come up, no build begun, no card sent off, the card still down).
async function watchStill(p, ms) {
  const before = await p.evaluate(() => ({ n: window.__pack.log.length, bp: window.__pack.bp, i: window.__pack.i }));
  await p.waitForTimeout(ms);
  const after = await p.evaluate((n) => ({ moved: window.__pack.log.slice(n).filter((e) => ['bulkPack', 'tear', 'build', 'cardLeft', 'reveal'].includes(e.kind)).map((e) => e.kind), bp: window.__pack.bp, i: window.__pack.i, down: !!document.querySelector('.bcard.down, .cslot.down') }), before.n);
  return after.moved.length === 0 && after.bp === before.bp && after.i === before.i && after.down ? null : `moved by itself: ${after.moved.join(',') || 'position'}${after.down ? '' : ', no card down'}`;
}

// Drives the ten to its summary with real pointer taps: the fan, every row
// stop (tapping the held card itself), every stack card, and (by tap only)
// the row to move on. In Auto nothing is pressed except at a stop.
async function driveTen(p, run, w, h, problems, tag) {
  const t0 = Date.now();
  const stops = [];
  const B = run.B, tearSkipped = new Set();
  let lastStop = '', controlsInBigPull = false, shotRow = false, shotStack = false, skippedAfterBig = false;
  while (Date.now() - t0 < 360000) {
    const s = await p.evaluate(() => {
      const S = window.__pack, now = performance.now(), R = S.row;
      const isHeld = (c) => (c.build ? !!c.build.held : !!c.faceDown);
      const downs = R && R.r ? R.r.cards.map((_, k) => k).filter((k) => isHeld(R.r.cards[k]) && !R.flipped[k]) : [];
      const c = S.cur && S.cur.cards && S.cur.cards[S.i];
      return { phase: S.phase, bp: S.bp, i: S.i, busy: now < S.busyUntil, nextBusy: now < S.nextAt, building: !!(R && R.building), row: !!R, waiting: !!(R && R.waiting), downs, held: !!(c && isHeld(c) && !S.revealed[S.i]), n: S.cur && S.cur.cards ? S.cur.cards.length : 0 };
    });
    if (s.phase === 'summary') return { ms: Date.now() - t0, stops, controlsInBigPull };
    if (s.phase === 'fan') {
      await p.click('#fan');
      if (run.skip) { await p.waitForTimeout(150); await p.click('#bskip').catch(() => {}); }
      await p.waitForTimeout(200);
      continue;
    }
    if (s.phase === 'cards') {
      if (await p.evaluate(() => !!(document.getElementById('speed').offsetParent || document.getElementById('bskip').offsetParent || document.getElementById('bauto').offsetParent))) controlsInBigPull = true;
      if (s.busy || s.i >= s.n) { await p.waitForTimeout(60); continue; }
      if (run.auto && !s.held) { await p.waitForTimeout(80); continue; }
      if (s.held) {
        const key = `stack ${s.bp}:${s.i}`;
        if (key !== lastStop) { lastStop = key; const why = run.auto ? await watchStill(p, STILL_MS) : null; stops.push({ key, why }); }
      }
      const box = await p.locator(`.cslot[data-k="${s.i}"]`).boundingBox().catch(() => null);
      if (!box) { await p.waitForTimeout(80); continue; }
      if (box.y < -2 || box.y + box.height > h + 2 || box.x < -2 || box.x + box.width > w + 2) problems.push(`big pull card ${s.i} off screen`);
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      if (s.held) {
        const landed = await waitFor(p, ([bp, k]) => window.__pack.log.some((e) => e.bp === bp && e.idx === k && (e.kind === 'landed' || e.kind === 'zeroDayArrive')), [s.bp, s.i], 30000);
        if (!landed) problems.push(`big pull card ${s.i}: never landed after the tap`);
        if (!shotStack) { shotStack = true; await p.waitForTimeout(300); await shot(p, `stack-${tag}`); }
      } else await p.waitForTimeout(120);
      continue;
    }
    if (s.phase === 'bulk') {
      // Run C also presses Skip while a pack with a stop is still tearing
      // (no row yet): the page must let that pack carry on (render 64's fix).
      if (run.skipTear && !s.row && s.bp >= 0 && !tearSkipped.has(s.bp) && (B.packs[s.bp].fullReveal || B.packs[s.bp].cards.some(held))) { tearSkipped.add(s.bp); await p.click('#bskip').catch(() => {}); await p.waitForTimeout(60); continue; }
      if (!s.row || s.building || (s.busy && !s.waiting)) { await p.waitForTimeout(60); continue; }
      if (s.waiting && run.skip && !skippedAfterBig) { skippedAfterBig = true; await p.click('#bskip').catch(() => {}); await p.waitForTimeout(150); continue; }
      if (run.auto && !s.downs.length) { await p.waitForTimeout(80); continue; }
      if (s.downs.length) {
        const k = s.downs[0], key = `row ${s.bp}:${k}`;
        if (key !== lastStop) {
          lastStop = key;
          const why = run.auto ? await watchStill(p, STILL_MS) : null;
          stops.push({ key, why });
          const row = await p.locator('.bcards').boundingBox().catch(() => null);
          if (row && (row.x < -2 || row.x + row.width > w + 2 || row.y + row.height > h + 2)) problems.push(`the row of pack ${s.bp + 1} off screen (${Math.round(row.x)},${Math.round(row.y)} ${Math.round(row.width)}x${Math.round(row.height)})`);
          if (!shotRow) { shotRow = true; await shot(p, `row-stop-${run.id}-${tag}`); }
        }
        const box = await p.locator(`.bcard[data-k="${k}"]`).boundingBox().catch(() => null);
        if (!box) { await p.waitForTimeout(80); continue; }
        await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        const landed = await waitFor(p, ([bp, k]) => window.__pack.log.some((e) => e.kind === 'landed' && e.where === 'row' && e.bp === bp && e.idx === k), [s.bp, k], 30000);
        if (!landed) problems.push(`pack ${s.bp + 1} card ${k}: the row stop never landed after the tap`);
        continue;
      }
      if (s.nextBusy) { await p.waitForTimeout(60); continue; }
      const row = await p.locator('#brow').boundingBox().catch(() => null);
      if (row) await p.mouse.click(row.x + row.width / 2, row.y + row.height / 2);
      await p.waitForTimeout(100);
      continue;
    }
    await p.waitForTimeout(80);
  }
  problems.push(`no summary after ${Math.round((Date.now() - t0) / 1000)} s`);
  return { ms: Date.now() - t0, stops, controlsInBigPull };
}

function checkRun(log, B, problems, run, driven) {
  const packs = log.filter((e) => e.kind === 'bulkPack');
  if (JSON.stringify(packs.map((e) => e.bp)) !== JSON.stringify(B.packs.map((_, k) => k))) problems.push(`packs came up ${JSON.stringify(packs.map((e) => e.bp))}`);
  if (!run.skip && log.some((x) => x.kind === 'bulkSkip')) problems.push('skip logged without a press');
  let wantStops = 0;
  for (const [k, plan] of B.packs.entries()) {
    const e = packs.find((x) => x.bp === k);
    if (!e) continue;
    const heldIdx = plan.cards.flatMap((c, i) => (held(c) ? [i] : []));
    if (e.fast === plan.fullReveal) problems.push(`pack ${k + 1}: fast=${e.fast}, store fullReveal=${plan.fullReveal}`);
    if (e.sparks !== plan.sparks) problems.push(`pack ${k + 1}: planned sparks ${e.sparks} vs ${plan.sparks}`);
    if (e.skipped) {
      if (!run.skip) problems.push(`pack ${k + 1} skipped`);
      if (plan.fullReveal || heldIdx.length) problems.push(`pack ${k + 1}: skipped with ${plan.fullReveal ? 'a big pull' : heldIdx.length + ' stop(s)'} in it`);
      continue;
    }
    const tear = log.find((x) => x.kind === 'tear' && x.bp === k);
    if (!tear) { problems.push(`pack ${k + 1}: never torn`); continue; }
    if (tear.via !== (run.auto ? 'auto' : 'tap')) problems.push(`pack ${k + 1}: torn via ${tear.via}`);
    const sparked = log.some((x) => x.kind === 'sparks' && x.bp === k);
    if (sparked !== plan.sparks) problems.push(`pack ${k + 1}: sparks ${sparked}, hit ${plan.sparks}`);
    if (plan.fullReveal) {
      for (const [ci, c] of plan.cards.entries()) {
        const rv = log.find((x) => x.kind === 'reveal' && x.bp === k && x.idx === ci);
        if (held(c) && (!rv || rv.as !== c.reveal)) problems.push(`pack ${k + 1} card ${ci}: reveal ${rv ? rv.as : 'none'}, want ${c.reveal}`);
        if (!held(c) && rv) problems.push(`pack ${k + 1} card ${ci}: a plain card was "revealed"`);
      }
      wantStops += heldIdx.length;
      if (!log.some((x) => x.kind === 'bulkFullDone' && x.bp === k)) problems.push(`pack ${k + 1}: big pull never finished`);
      if (log.some((x) => x.kind === 'skip' && x.bp === k)) problems.push(`pack ${k + 1}: the big pull's own Skip was pressed`);
      continue;
    }
    wantStops += heldIdx.length;
    const dealt = log.find((x) => x.kind === 'bulkDealt' && x.bp === k);
    if (!dealt) { problems.push(`pack ${k + 1}: never dealt`); continue; }
    if (JSON.stringify(dealt.cards.map((c) => c.finish)) !== JSON.stringify(plan.cards.map((c) => c.finish))) problems.push(`pack ${k + 1}: dealt ${dealt.cards.map((c) => c.finish)}`);
    const downIdx = dealt.cards.flatMap((c, i) => (c.faceDown ? [i] : []));
    if (JSON.stringify(downIdx) !== JSON.stringify(heldIdx)) problems.push(`pack ${k + 1}: dealt face down ${JSON.stringify(downIdx)}, held ${JSON.stringify(heldIdx)}`);
    const of = (kind) => log.filter((x) => x.kind === kind && x.where === 'row' && x.bp === k).map((x) => x.idx).sort((a, b) => a - b);
    for (const kind of ['build', 'reveal', 'landed']) if (JSON.stringify(of(kind)) !== JSON.stringify(heldIdx)) problems.push(`pack ${k + 1}: row ${kind} ${JSON.stringify(of(kind))}, want ${JSON.stringify(heldIdx)}`);
    for (const rv of log.filter((x) => x.kind === 'reveal' && x.where === 'row' && x.bp === k)) if (rv.as !== plan.cards[rv.idx].reveal) problems.push(`pack ${k + 1} card ${rv.idx}: revealed as ${rv.as}, want ${plan.cards[rv.idx].reveal}`);
    const stopIdx = log.filter((x) => x.kind === 'stop' && x.where === 'row' && x.bp === k).map((x) => x.idx).sort((a, b) => a - b);
    if (JSON.stringify(stopIdx) !== JSON.stringify(heldIdx)) problems.push(`pack ${k + 1}: row stops logged ${JSON.stringify(stopIdx)}, want ${JSON.stringify(heldIdx)}`);
  }
  if (log.some((x) => x.kind === 'bulkFlip')) problems.push(`${log.filter((x) => x.kind === 'bulkFlip').length} plain card(s) flipped (nothing but a stop is dealt face down)`);
  if (run.skipTear) {
    const pend = log.filter((x) => x.kind === 'bulkSkip' && x.pending).length;
    if (!pend) problems.push(`Skip during a tear: never landed while a pack with a stop was tearing (pressed ${driven.tearSkipped} times)`);
  }
  if (driven.stops.length !== wantStops) problems.push(`the driver met ${driven.stops.length} stops, want ${wantStops}`);
  for (const st of driven.stops) if (st.why) problems.push(`Auto at ${st.key}: ${st.why}`);
  // Auto never cuts a big pull's reveal short: each card leaves well after its reveal began.
  if (run.auto) {
    for (const e of log.filter((x) => x.kind === 'cardLeft')) {
      const rv = log.filter((x) => x.kind === 'reveal' && x.bp === e.bp && x.idx === e.idx && x.t <= e.t).pop();
      const plan = B.packs[e.bp]?.cards[e.idx];
      if (plan && held(plan) && rv && e.t - rv.t < 700) problems.push(`pack ${e.bp + 1} card ${e.idx}: left ${e.t - rv.t} ms after its reveal began`);
    }
  }
  const sum = log.find((e) => e.kind === 'bulkSummary');
  if (!sum) { problems.push('no summary logged'); return; }
  if (sum.copies !== B.summary.cards) problems.push(`summary holds ${sum.copies} copies of ${B.summary.cards}`);
  if (sum.tiles !== B.tiles.length) problems.push(`summary ${sum.tiles} tiles, plan ${B.tiles.length}`);
  if (sum.packPoints !== B.summary.packPoints) problems.push('pack points differ');
}

const RUNS = [
  { id: 'T', bulk: 1, auto: false, speed: 1 },
  { id: 'A', bulk: 0, auto: true, speed: 4 },
  { id: 'B', bulk: 1, auto: true, speed: 1 },
  { id: 'C', bulk: 1, auto: true, speed: 2, skip: true, skipTear: true },
];

for (const [w, h, tag] of [[1280, 800, 'desktop'], [390, 844, 'phone']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: tag === 'phone' });
  const p = await ctx.newPage();
  const errs = [], requests = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url()); });
  await p.goto(url());
  await p.waitForTimeout(300);
  const data = await p.evaluate(() => JSON.parse(document.getElementById('pack-data').textContent));

  for (const run of RUNS) {
    const problems = [];
    const B = data.bulks[run.bulk].reveal;
    run.B = B;
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
    const driven = await driveTen(p, run, w, h, problems, tag);
    const secs = driven.ms / 1000;
    await p.waitForTimeout(900);
    const log = await p.evaluate(() => window.__pack.log);
    checkRun(log, B, problems, run, driven);
    if (driven.controlsInBigPull) problems.push('speed/skip/Auto controls showing during a big pull');
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
    if (dom.tiles !== B.tiles.length) problems.push(`DOM tiles ${dom.tiles}, plan ${B.tiles.length}`);
    if (dom.copies !== B.summary.cards) problems.push(`DOM copies ${dom.copies}, plan ${B.summary.cards}`);
    if (dom.news !== B.tiles.filter((t) => t.isNew).length) problems.push(`DOM NEW badges ${dom.news}`);
    if (!dom.sub || !dom.sub.includes(B.summary.newCards + ' new')) problems.push(`summary line "${dom.sub}" lacks the store's ${B.summary.newCards} new`);
    if (dom.scrollX) problems.push('horizontal scroll');
    if (run.id === 'T' || run.id === 'B') await shot(p, `summary-${run.id}-${tag}`);
    const skipped = log.filter((e) => e.kind === 'bulkPack' && e.skipped).map((e) => e.bp + 1);
    const full = log.filter((e) => e.kind === 'bulkPack' && !e.fast).map((e) => e.bp + 1);
    const rowStops = log.filter((e) => e.kind === 'stop' && e.where === 'row').length;
    if (errs.length) problems.push('page errors: ' + errs.splice(0).join(' | '));
    if (problems.length) fails++; else passes++;
    say(`${problems.length ? 'FAIL' : 'PASS'}  ${tag} run ${run.id} (${data.bulks[run.bulk].label}, ${run.auto ? `Auto ${run.speed}x` : 'by tap'}${run.skip ? ', skip' : ''}): ${secs.toFixed(1)} s to the summary; big pulls at pack ${full.join(', ') || 'none'}; packs skipped ${skipped.join(', ') || 'none'}; ${driven.stops.length} stops met (${rowStops} in the row)${run.auto ? `, each still ${STILL_MS} ms` : ''}; ${dom.tiles} tiles for ${dom.copies} cards, ${dom.news} NEW${problems.length ? '\n      ' + problems.join('\n      ') : ''}`);
  }
  // The last run left Auto on at 2x: both survive a reload.
  await p.goto(url('bulk=1'));
  await p.waitForTimeout(200);
  const kept = await p.evaluate(() => ({ speed: document.querySelector('#speed button[aria-pressed="true"]').getAttribute('data-speed'), auto: document.getElementById('bauto').getAttribute('aria-checked') }));
  const ok = kept.speed === '2' && kept.auto === 'true';
  if (ok) passes++; else fails++;
  say(`${ok ? 'PASS' : 'FAIL'}  ${tag}: speed and Auto remembered across a reload (${kept.speed}x, Auto ${kept.auto === 'true' ? 'on' : 'off'}; want 2x, on)`);
  await p.click('#bauto');
  await p.goto(url('bulk=1'));
  await p.waitForTimeout(200);
  const off = await p.evaluate(() => ({ auto: document.getElementById('bauto').getAttribute('aria-checked'), speedShown: !!document.getElementById('speed').offsetParent }));
  const ok2 = off.auto === 'false' && !off.speedShown;
  if (ok2) passes++; else fails++;
  say(`${ok2 ? 'PASS' : 'FAIL'}  ${tag}: Auto off is remembered and hides the speeds (Auto ${off.auto}, speeds ${off.speedShown ? 'showing' : 'hidden'})`);
  const ok3 = requests.length === 0;
  if (ok3) passes++; else fails++;
  say(`${ok3 ? 'PASS' : 'FAIL'}  ${tag}: no network requests (${requests.length})`);
  await ctx.close();
}
await b.close();
say(`${passes} PASS, ${fails} FAIL${fails ? '' : ' (ALL PASS)'}`);
process.exit(fails ? 1 : 0);
