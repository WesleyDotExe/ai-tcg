// SUPERSEDED (render session 54): stale since the owner made the ten-pack open
// tap-driven (2026-10-18); see pack-bulk-check-s54.mjs. Kept as the record of
// what session 25 checked.
// Render session 25: the ten-pack opening, driven like an owner would in a
// real (headless) Chromium. Not a repo dependency: run from a scratch
// folder with playwright-core installed, against the preinstalled Chromium:
//   node pack-bulk-check.mjs <shotDir> <render/output/pack-opening.html>
// At 1280 x 800 and at 390 x 844 (a phone), three runs each:
//   A. "10 packs" at 4x, hands off: the fan is tapped once, then nothing
//      until the summary;
//   B. "10 packs, big pull" at 1x: hands off, except the big pull, which
//      must stop the sequence and wait to be torn and tapped through;
//   C. "10 packs, big pull" at 2x with Skip pressed at once, then again
//      after the big pull.
// Each run checks:
//   - every pack comes up once, in order; only the store's fullReveal packs
//     leave the fast sequence, and every one of them does (Skip included);
//   - the honest tell per pack: sparks iff the pack holds a hit;
//   - a fast pack deals exactly its cards, and turns every face-down one;
//   - the big pull plays the single-pack reveal (each face-down card its own
//     finish's reveal) at full length whatever the speed;
//   - the summary grid holds every copy (tile counts add up to the cards),
//     the store's NEW count, and the store's pack points;
//   - the speed choice is remembered across a reload;
//   - no horizontal scroll, the row fits on screen, no page errors.
// Stills go to shotDir.
import { chromium, launchOpts } from '../../../render/ci/pw.mjs';
// RETIRED in render session 81 (the render debt list): superseded by pack-bulk-check-s64.mjs, which checks the same
// page as it is today and was re-run in render session 80. This version named one machine's Chromium
// (chromium-1194) and no longer started; it now uses render/ci/pw.mjs. Kept for the record;
// RUN_RETIRED=1 runs it anyway.
if (!process.env.RUN_RETIRED) { console.log('pack-bulk-check.mjs: retired in render session 81 (superseded by pack-bulk-check-s64.mjs).'); process.exit(0); }
const [shotDir, file] = process.argv.slice(2);
const b = await chromium.launch(launchOpts({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] }));
let fails = 0;
const say = (s) => console.log(s);
const ev = (p) => p.evaluate(() => window.__pack.log);
const phase = (p) => p.evaluate(() => window.__pack.phase);
async function waitFor(p, fn, arg, ms = 30000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(60); }
  return false;
}

// The single-pack flow for a big pull: tear by tap, tap through the stack.
async function stepFullPack(p, plan, h, w, problems, shots) {
  const pk = await p.locator('#pack').boundingBox();
  if (shots) await p.screenshot({ path: `${shotDir}/v2-s25-big-pull-sealed-${shots}.png` });
  if (await p.evaluate(() => !!(document.getElementById('speed').offsetParent || document.getElementById('bskip').offsetParent))) problems.push('speed/skip controls showing during the big pull');
  await p.mouse.click(pk.x + pk.width / 2, pk.y + pk.height / 2);
  await waitFor(p, () => window.__pack.phase === 'cards');
  await p.waitForTimeout(800);
  let guard = 0;
  while ((await phase(p)) === 'cards' && guard++ < 40) {
    const st = await p.evaluate(() => window.__pack.i);
    const c = plan.cards[st];
    if (!c) { await p.waitForTimeout(100); continue; }
    const box = await p.locator(`.cslot[data-k="${st}"]`).boundingBox();
    if (!box) { await p.waitForTimeout(100); continue; }
    if (box.y < 0 || box.y + box.height > h + 2 || box.x < 0 || box.x + box.width > w) problems.push(`big pull card ${st} off screen`);
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    if (c.faceDown) {
      if (c.reveal === 'zeroDay') await waitFor(p, () => window.__pack.log.some((e) => e.kind === 'zeroDayArrive'), null, 15000);
      else await waitFor(p, (k) => window.__pack.log.some((e) => e.kind === 'landed' && e.idx === k), st);
      await p.waitForTimeout(c.reveal === 'secret' ? 250 : 500);
      if (shots && c.hit) await p.screenshot({ path: `${shotDir}/v2-s25-big-pull-${c.reveal}-${shots}.png` });
      await waitFor(p, () => window.__pack.busyUntil <= performance.now(), null, 10000);
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    await p.waitForTimeout(330);
  }
}

function checkRun(log, data, bi, problems, expectSkip) {
  const B = data.bulks[bi].reveal;
  const packs = log.filter((e) => e.kind === 'bulkPack');
  if (JSON.stringify(packs.map((e) => e.bp)) !== JSON.stringify(B.packs.map((_, k) => k))) problems.push(`packs came up ${JSON.stringify(packs.map((e) => e.bp))}`);
  for (const [k, plan] of B.packs.entries()) {
    const e = packs.find((x) => x.bp === k);
    if (!e) continue;
    if (e.fast === plan.fullReveal) problems.push(`pack ${k + 1}: fast=${e.fast}, store fullReveal=${plan.fullReveal}`);
    if (e.sparks !== plan.sparks) problems.push(`pack ${k + 1}: planned sparks ${e.sparks} vs ${plan.sparks}`);
    if (e.skipped) { if (!expectSkip) problems.push(`pack ${k + 1} skipped`); continue; }
    const sparked = log.some((x) => x.kind === 'sparks' && x.bp === k);
    const tore = log.some((x) => x.kind === 'tear' && x.bp === k);
    if (tore && sparked !== plan.sparks) problems.push(`pack ${k + 1}: sparks ${sparked}, hit ${plan.sparks}`);
    if (plan.fullReveal) {
      for (const [ci, c] of plan.cards.entries()) {
        const rv = log.find((x) => x.kind === 'reveal' && x.bp === k && x.idx === ci);
        if (c.faceDown && (!rv || rv.as !== c.reveal)) problems.push(`pack ${k + 1} card ${ci}: reveal ${rv ? rv.as : 'none'}, want ${c.reveal}`);
      }
      if (!log.some((x) => x.kind === 'bulkFullDone' && x.bp === k)) problems.push(`pack ${k + 1}: big pull never finished`);
      continue;
    }
    const dealt = log.find((x) => x.kind === 'bulkDealt' && x.bp === k);
    // A tap, or Skip pressed while this pack ran, cuts it short (on purpose).
    const tapped = log.some((x) => (x.kind === 'bulkTap' && x.bp === k) || (x.kind === 'bulkSkip' && x.from === k));
    if (!expectSkip && log.some((x) => x.kind === 'bulkSkip')) problems.push('skip logged without a press');
    if (!dealt) { if (!tapped) problems.push(`pack ${k + 1}: never dealt`); continue; }
    if (JSON.stringify(dealt.cards.map((c) => c.finish)) !== JSON.stringify(plan.cards.map((c) => c.finish))) problems.push(`pack ${k + 1}: dealt ${dealt.cards.map((c) => c.finish)}`);
    const flips = log.filter((x) => x.kind === 'bulkFlip' && x.bp === k).map((x) => x.idx);
    const want = plan.cards.map((c, i) => (c.faceDown ? i : -1)).filter((i) => i >= 0);
    if (!tapped && JSON.stringify(flips) !== JSON.stringify(want)) problems.push(`pack ${k + 1}: turned ${JSON.stringify(flips)}, want ${JSON.stringify(want)}`);
  }
  const sum = log.find((e) => e.kind === 'bulkSummary');
  if (!sum) { problems.push('no summary'); return; }
  if (sum.copies !== B.summary.cards) problems.push(`summary holds ${sum.copies} copies of ${B.summary.cards}`);
  if (sum.tiles !== B.tiles.length) problems.push(`summary ${sum.tiles} tiles, plan ${B.tiles.length}`);
  if (sum.packPoints !== B.summary.packPoints) problems.push('pack points differ');
}

for (const [w, h, tag] of [[1280, 800, 'desktop'], [390, 844, 'phone']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag === 'phone' ? 2 : 1 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + file);
  await p.waitForTimeout(300);
  if (tag === 'desktop') await p.screenshot({ path: `${shotDir}/v2-s25-shelf-${tag}.png` });
  const data = await p.evaluate(() => JSON.parse(document.getElementById('pack-data').textContent));

  for (const run of [{ id: 'A', bulk: 0, speed: 4 }, { id: 'B', bulk: 1, speed: 1 }, { id: 'C', bulk: 1, speed: 2, skip: true }]) {
    const problems = [];
    const B = data.bulks[run.bulk].reveal;
    await p.goto('file://' + file + '?bulk=' + (run.bulk + 1));
    await p.waitForTimeout(300);
    await p.click(`#speed button[data-speed="${run.speed}"]`);
    if (run.id === 'A') await p.screenshot({ path: `${shotDir}/v2-s25-fan-${tag}.png` });
    await p.evaluate(() => { window.__pack.log.length = 0; });
    const t0 = Date.now();
    await p.click('#fan');
    if (run.skip) { await p.waitForTimeout(150); await p.click('#bskip'); }
    let shotRow = false, guard = 0;
    while (guard++ < 2000) {
      const ph = await phase(p);
      if (ph === 'summary') break;
      if (ph === 'pack') {
        const bp = await p.evaluate(() => window.__pack.bp);
        await stepFullPack(p, B.packs[bp], h, w, problems, run.id === 'B' ? tag : null);
        if (run.skip) { await waitFor(p, () => window.__pack.phase === 'bulk'); await p.waitForTimeout(100); await p.click('#bskip'); }
        continue;
      }
      // A still of a fast row: the pack whose hit pops, once dealt.
      if (!shotRow && ph === 'bulk') {
        const popped = await p.evaluate(() => document.querySelectorAll('.bcard.pop').length);
        if (popped) {
          shotRow = true;
          const row = await p.locator('.bcards').boundingBox();
          if (row && (row.x < 0 || row.x + row.width > w || row.y + row.height > h)) problems.push(`fast row off screen (${Math.round(row.x)},${Math.round(row.y)} ${Math.round(row.width)}x${Math.round(row.height)})`);
          await p.waitForTimeout(250 / run.speed);
          await p.screenshot({ path: `${shotDir}/v2-s25-fast-hit-${run.id}-${tag}.png` });
        }
      }
      await p.waitForTimeout(40);
    }
    const secs = (Date.now() - t0) / 1000;
    await p.waitForTimeout(900);
    const log = await ev(p);
    checkRun(log, data, run.bulk, problems, !!run.skip);
    const dom = await p.evaluate(() => ({
      tiles: document.querySelectorAll('.bulk-sum .tile').length,
      copies: [...document.querySelectorAll('.bulk-sum .tile')].reduce((n, t) => n + Number(t.getAttribute('data-count')), 0),
      news: document.querySelectorAll('.bulk-sum .tile .new').length,
      sub: document.querySelector('.bulk-sum .sub') && document.querySelector('.bulk-sum .sub').textContent,
      scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      // Nothing left over from a reveal, and the fast-sequence controls gone.
      overlays: document.querySelectorAll('#stage .wash, #stage .callout, #stage .banner').length,
      controls: !!(document.getElementById('speed').offsetParent || document.getElementById('bskip').offsetParent),
    }));
    if (dom.overlays) problems.push(`${dom.overlays} reveal overlays left on the summary`);
    if (dom.controls) problems.push('speed/skip controls still showing on the summary');
    if (dom.tiles !== B.tiles.length) problems.push(`DOM tiles ${dom.tiles}`);
    if (dom.copies !== B.summary.cards) problems.push(`DOM copies ${dom.copies}`);
    if (dom.news !== B.tiles.filter((t) => t.isNew).length) problems.push(`DOM NEW badges ${dom.news}`);
    if (!dom.sub || !dom.sub.includes(B.summary.newCards + ' new')) problems.push(`summary line "${dom.sub}" lacks the store's ${B.summary.newCards} new`);
    if (dom.scrollX) problems.push('horizontal scroll');
    if (run.id !== 'A') {
      await p.screenshot({ path: `${shotDir}/v2-s25-summary-${tag}.png` });
      await p.evaluate(() => { const s = document.querySelector('.bulk-sum'); s.scrollTop = s.scrollHeight; });
      await p.waitForTimeout(400);
      if (run.id === 'B') await p.screenshot({ path: `${shotDir}/v2-s25-summary-end-${tag}.png` });
    }
    const skipped = log.filter((e) => e.kind === 'bulkPack' && e.skipped).length;
    const full = log.filter((e) => e.kind === 'bulkPack' && !e.fast).map((e) => e.bp + 1);
    if (errs.length) problems.push('page errors: ' + errs.join(' | '));
    if (problems.length) fails++;
    say(`${tag} run ${run.id} (${data.bulks[run.bulk].label}, ${run.speed}x${run.skip ? ', skip' : ''}): ${problems.length ? 'FAIL ' + problems.join('; ') : 'ok'} — ${secs.toFixed(1)} s to the summary; big pulls at pack ${full.join(', ') || 'none'}; ${skipped} packs skipped; ${dom.tiles} tiles for ${dom.copies} cards, ${dom.news} NEW`);
  }
  // The speed choice survives a reload.
  await p.goto('file://' + file + '?bulk=1');
  await p.waitForTimeout(200);
  const kept = await p.evaluate(() => document.querySelector('#speed button[aria-pressed="true"]').getAttribute('data-speed'));
  if (kept !== '2') { fails++; say(`${tag}: speed after reload ${kept}, want 2 FAIL`); } else say(`${tag}: speed remembered across a reload (2x): ok`);
  await ctx.close();
}
await b.close();
say(fails ? `${fails} FAILED` : 'all pass');
process.exit(fails ? 1 : 0);
