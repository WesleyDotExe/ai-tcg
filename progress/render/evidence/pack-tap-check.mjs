// Render session 26: the tap-driven ten-pack opening (owner 2026-10-18 feel
// notes), the card viewer and the full-bleed faces, driven like an owner
// would in a real (headless) Chromium. Not a repo dependency: run with
// playwright-core against the preinstalled Chromium:
//   node pack-tap-check.mjs <shotDir> <render/output/pack-opening.html> <render/output/card-faces.html>
// At 1280 x 800 and at 390 x 844 (a phone), each from a fresh browser
// profile:
//   0. Auto is off by default.
//   A. "10 packs", by hand: the fan tap tears pack 1; every later pack tears
//      only on a tap or a swipe; every face-down card turns only on a tap
//      (on that card, or anywhere on the row: then the first one left).
//      After each deal, and after each row is fully turned, the page is
//      left alone for 1.2 s and must not move.
//   B. "10 packs, big pull", by hand: the big pull tears like any other
//      pack and its full reveal follows at once: no sealed pack to tear by
//      hand, no "BIG PULL" tag. Then the summary and the card viewer.
//   C. "10 packs, big pull", Auto at 2x, Skip at once and again after the
//      big pull: Skip stops at the big pull, whose reveal steps itself at
//      full length (each card held at least its reveal's own time).
//   D. "10 packs", Auto at 4x, hands off from the fan tap to the summary.
//   E. "10 packs", Auto at 1x, switched off during pack 2: nothing moves
//      for 2 s; then it is finished by hand.
//   The Auto choice and the speed survive a reload.
//   F. The Zero-Day single pack's summary: its tile opens the viewer with
//      both modes readable.
//   G. The card-face sheet: every face's rules text fits its box, and the
//      art covers the whole card on exactly the finishes rarer than Full Art.
// Each run also checks the honest tell (sparks iff a hit), the summary
// (tile counts add up to the store's cards, its NEW count and pack points),
// no reveal overlays left, no horizontal scroll and no page errors.
import { chromium, launchOpts } from '../../../render/ci/pw.mjs';
// RETIRED in render session 80 (a hardening pass): this check drove the tap-driven ten-pack opening of session 26 (plain Rares face up, a big pull with no sealed pack). Replaced by pack-bulk-check-s54.mjs and pack-bulk-check-s64.mjs (Open 10 stops on every held card) and pack-ceremony-check-s60/-s61/-s62.mjs.
// Since the ceremony (render sessions 58-64) the page it was written for no
// longer exists (re-run in session 80: it fails on the old page's rules, not
// on a fault; the record is pack-checks-retired-s80.txt). Kept for the record;
// RUN_RETIRED=1 runs it anyway.
if (!process.env.RUN_RETIRED) { console.log('pack-tap-check.mjs: retired in render session 80 (written for the pack page before the ceremony); see its header for the checks that replace it.'); process.exit(0); }
const [shotDir, file, facesFile] = process.argv.slice(2);
const b = await chromium.launch(launchOpts({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] }));
let fails = 0;
const say = (s) => console.log(s);
const S = (p, fn, arg) => p.evaluate(fn, arg);
async function waitFor(p, fn, arg, ms = 30000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(50); }
  return false;
}
const FULL = ['fullArt', 'altArt', 'glitch', 'secret', 'gold', 'prototype', 'zeroDay'];
const REVEAL_MS = { plain: 120, foil: 920, fullArt: 1580, altArt: 1580, glitch: 1650, secret: 3200, gold: 1850, prototype: 2200, zeroDay: 2100 };

// Tap through a big pull's stack (the single-pack reveal, in the row's place).
async function tapStack(p, plan, h, w, problems, shots) {
  let guard = 0;
  while ((await S(p, () => window.__pack.phase)) === 'cards' && guard++ < 40) {
    const st = await S(p, () => window.__pack.i);
    const c = plan.cards[st];
    // Measured once the stack has risen (it starts below, sliding up).
    await waitFor(p, () => window.__pack.busyUntil <= performance.now(), null, 10000);
    const box = c && await p.locator(`.cslot[data-k="${st}"]`).boundingBox();
    if (!box) { await p.waitForTimeout(100); continue; }
    if (box.y < 0 || box.y + box.height > h + 2 || box.x < 0 || box.x + box.width > w) problems.push(`big pull card ${st} off screen`);
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    if (c.faceDown) {
      if (c.reveal === 'zeroDay') await waitFor(p, () => window.__pack.log.some((e) => e.kind === 'zeroDayArrive'), null, 15000);
      else await waitFor(p, (k) => window.__pack.log.some((e) => e.kind === 'landed' && e.idx === k && e.mode === 'bulk'), st);
      await p.waitForTimeout(c.reveal === 'secret' ? 250 : 500);
      if (shots && c.hit) await p.screenshot({ path: `${shotDir}/v2-s26-big-pull-in-flow-${c.reveal}-${shots}.png` });
      await waitFor(p, () => window.__pack.busyUntil <= performance.now(), null, 10000);
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    await p.waitForTimeout(330);
  }
}

// Drive a ten-pack open by hand until its summary.
async function byHand(p, B, h, w, problems, opts) {
  let lastBp = -1, stillChecked = new Set(), shot = { wait: false, hit: false }, n = 0, guard = 0;
  while (guard++ < 600) {
    const st = await S(p, () => ({ phase: window.__pack.phase, bp: window.__pack.bp, row: !!window.__pack.row, waiting: !!(window.__pack.row && window.__pack.row.waiting), busy: window.__pack.busyUntil > performance.now() || window.__pack.nextAt > performance.now(), downs: [...document.querySelectorAll('.bcard.down')].map((e) => Number(e.getAttribute('data-k'))), tag: document.body.innerText.includes('BIG PULL') }));
    if (st.tag) problems.push('a "BIG PULL" tag is showing');
    if (st.phase === 'summary') return;
    if (st.phase === 'pack') problems.push('a sealed pack is waiting to be torn by hand inside the ten');
    if (st.phase === 'cards') {
      const bp = st.bp;
      // The big pull's reveal follows its tear at once: the tear is the
      // last thing logged for this pack before the stack.
      await tapStack(p, B.packs[bp], h, w, problems, opts.shots);
      await waitFor(p, () => window.__pack.phase !== 'cards');
      continue;
    }
    if (st.phase !== 'bulk' || !st.row || st.busy) { await p.waitForTimeout(40); continue; }
    if (st.bp !== lastBp) lastBp = st.bp;
    // Left alone, nothing moves: once after the deal, once fully turned.
    const key = st.bp + (st.downs.length ? ':dealt' : ':done') + (st.waiting ? ':w' : '');
    if (opts.still && !stillChecked.has(key)) {
      stillChecked.add(key);
      const before = await S(p, () => window.__pack.log.length);
      await p.waitForTimeout(1200);
      const moved = await S(p, (k) => window.__pack.log.slice(k).filter((e) => e.kind !== 'speed').map((e) => e.kind), before);
      if (moved.length) problems.push(`pack ${st.bp + 1}: moved on its own (${moved.join(',')})`);
    }
    if (opts.shots && !shot.wait && st.downs.length >= 1 && !st.waiting) { shot.wait = true; await p.screenshot({ path: `${shotDir}/v2-s26-tap-row-waiting-${opts.shots}.png` }); }
    n++;
    if (st.downs.length) {
      // Alternate: tap the card itself, or the row beside the cards.
      if (n % 2) { const k = st.downs[st.downs.length - 1]; const bx = await p.locator(`.bcard[data-k="${k}"]`).boundingBox(); await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); }
      else { const rb = await p.locator('#brow').boundingBox(); await p.mouse.click(rb.x + 8, rb.y + rb.height - 8); }
      await p.waitForTimeout(80);
      if (opts.shots && !shot.hit && await S(p, () => document.querySelectorAll('.bcard.pop').length)) { shot.hit = true; await p.waitForTimeout(400); await p.screenshot({ path: `${shotDir}/v2-s26-tap-row-hit-${opts.shots}.png` }); }
      continue;
    }
    // Move on: a swipe on even packs, a tap otherwise.
    const rb = await p.locator('#brow').boundingBox();
    if (st.bp % 2 === 0) { await p.mouse.move(rb.x + rb.width * 0.7, rb.y + rb.height / 2); await p.mouse.down(); await p.mouse.move(rb.x + rb.width * 0.3, rb.y + rb.height / 2, { steps: 6 }); await p.mouse.up(); }
    else await p.mouse.click(rb.x + 8, rb.y + rb.height - 8);
    await p.waitForTimeout(80);
  }
  problems.push('never reached the summary');
}

function checkLog(log, B, problems, mode) {
  const packs = log.filter((e) => e.kind === 'bulkPack');
  if (JSON.stringify(packs.map((e) => e.bp)) !== JSON.stringify(B.packs.map((_, k) => k))) problems.push(`packs came up ${JSON.stringify(packs.map((e) => e.bp))}`);
  for (const [k, plan] of B.packs.entries()) {
    const e = packs.find((x) => x.bp === k);
    if (!e) continue;
    if (e.fast === plan.fullReveal) problems.push(`pack ${k + 1}: fast=${e.fast}, store fullReveal=${plan.fullReveal}`);
    if (e.skipped) { if (mode !== 'skip') problems.push(`pack ${k + 1} skipped`); continue; }
    const tear = log.find((x) => x.kind === 'tear' && x.bp === k);
    // Skip pressed during a pack's sealed beat cuts it before its tear (on purpose).
    const skippedAt = log.some((x) => x.kind === 'bulkSkip' && x.from === k);
    if (!tear) { if (!skippedAt) problems.push(`pack ${k + 1}: never torn`); continue; }
    const sparked = log.some((x) => x.kind === 'sparks' && x.bp === k);
    if (sparked !== plan.sparks) problems.push(`pack ${k + 1}: sparks ${sparked}, hit ${plan.sparks}`);
    if (mode === 'hand') {
      if (tear.via !== 'tap') problems.push(`pack ${k + 1}: torn via ${tear.via}`);
      // Every pack after the first tears on a tap or swipe on the row.
      if (k > 0) {
        const i = log.indexOf(e), prev = log.slice(0, i).reverse().find((x) => x.kind === 'bulkTap' || x.kind === 'bulkGo' || x.kind === 'bulkFullDone');
        if (!prev || prev.kind === 'bulkGo') problems.push(`pack ${k + 1}: came up without a tap (${prev && prev.kind})`);
      }
    }
    if (plan.fullReveal) {
      if (log.some((x) => x.kind === 'packShown' && x.bp === k)) problems.push(`pack ${k + 1}: a sealed pack waited to be torn by hand`);
      for (const [ci, c] of plan.cards.entries()) {
        const rv = log.find((x) => x.kind === 'reveal' && x.bp === k && x.idx === ci);
        if (c.faceDown && (!rv || rv.as !== c.reveal)) problems.push(`pack ${k + 1} card ${ci}: reveal ${rv ? rv.as : 'none'}, want ${c.reveal}`);
        // Full length at every speed: the card stays at least its reveal's time.
        const left = log.find((x) => x.kind === 'cardLeft' && x.bp === k && x.idx === ci);
        if (c.faceDown && rv && left && left.t - rv.t < REVEAL_MS[c.reveal] - 30) problems.push(`pack ${k + 1} card ${ci}: ${c.reveal} held ${left.t - rv.t} ms, under ${REVEAL_MS[c.reveal]}`);
      }
      if (!log.some((x) => x.kind === 'bulkFullDone' && x.bp === k)) problems.push(`pack ${k + 1}: big pull never finished`);
      continue;
    }
    const dealt = log.find((x) => x.kind === 'bulkDealt' && x.bp === k);
    const cut = log.some((x) => (x.kind === 'bulkTap' && x.bp === k && x.auto) || (x.kind === 'bulkSkip' && x.from === k));
    if (!dealt) { if (!cut) problems.push(`pack ${k + 1}: never dealt`); continue; }
    if (JSON.stringify(dealt.cards.map((c) => c.finish)) !== JSON.stringify(plan.cards.map((c) => c.finish))) problems.push(`pack ${k + 1}: dealt ${dealt.cards.map((c) => c.finish)}`);
    const flips = log.filter((x) => x.kind === 'bulkFlip' && x.bp === k);
    const want = plan.cards.map((c, i) => (c.faceDown ? i : -1)).filter((i) => i >= 0);
    if (!cut && JSON.stringify(flips.map((x) => x.idx).sort()) !== JSON.stringify(want)) problems.push(`pack ${k + 1}: turned ${JSON.stringify(flips.map((x) => x.idx))}, want ${JSON.stringify(want)}`);
    if (mode === 'hand' && flips.some((x) => x.via !== 'tap')) problems.push(`pack ${k + 1}: a card turned by itself`);
    if ((mode === 'auto' || mode === 'skip') && flips.some((x) => x.via !== 'auto')) problems.push(`pack ${k + 1}: Auto flip by tap`);
  }
}

async function checkSummary(p, B, problems) {
  const dom = await S(p, () => ({
    tiles: document.querySelectorAll('.bulk-sum .tile').length,
    copies: [...document.querySelectorAll('.bulk-sum .tile')].reduce((n, t) => n + Number(t.getAttribute('data-count')), 0),
    news: document.querySelectorAll('.bulk-sum .tile .new').length,
    sub: document.querySelector('.bulk-sum .sub') && document.querySelector('.bulk-sum .sub').textContent,
    scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    overlays: document.querySelectorAll('#stage .wash, #stage .callout, #stage .banner').length,
    controls: !!(document.getElementById('speed').offsetParent || document.getElementById('bskip').offsetParent || document.getElementById('bauto').offsetParent),
  }));
  if (dom.overlays) problems.push(`${dom.overlays} reveal overlays left`);
  if (dom.controls) problems.push('ten-pack controls still showing on the summary');
  if (dom.tiles !== B.tiles.length) problems.push(`DOM tiles ${dom.tiles}`);
  if (dom.copies !== B.summary.cards) problems.push(`DOM copies ${dom.copies}`);
  if (dom.news !== B.tiles.filter((t) => t.isNew).length) problems.push(`DOM NEW badges ${dom.news}`);
  if (!dom.sub || !dom.sub.includes(B.summary.newCards + ' new')) problems.push(`summary line "${dom.sub}"`);
  if (dom.scrollX) problems.push('horizontal scroll');
  return dom;
}

// A face's rules text fits, and its art is full bleed iff its finish is rarer than Full Art.
const faceAudit = () => [...document.querySelectorAll('.face')].filter((f) => f.offsetParent).map((f) => {
  const t = f.querySelector('.text'), a = f.querySelector('.art').getBoundingClientRect(), fr = f.getBoundingClientRect();
  const host = f.closest('[data-finish]');
  // The last line must clear the attack/health boxes, measured line by line.
  let under = false;
  const st = f.querySelector('.stats');
  if (st && t.lastElementChild) {
    const sr = st.getBoundingClientRect(), rg = document.createRange();
    rg.selectNodeContents(t.lastElementChild);
    under = [...rg.getClientRects()].some((r) => r.width > 0 && r.right > sr.left && r.left < sr.right && r.bottom > sr.top + 1 && r.top < sr.bottom);
  }
  return { name: f.querySelector('.name').textContent, finish: host && host.getAttribute('data-finish'), over: Math.max(t.scrollHeight - t.clientHeight, under ? 99 : 0), full: a.width >= fr.width - 1.5 && a.height >= fr.height - 1.5 };
});

for (const [w, h, tag] of [[1280, 800, 'desktop'], [390, 844, 'phone']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag === 'phone' ? 2 : 1 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + file + '?bulk=1');
  await p.waitForTimeout(300);
  const data = await S(p, () => JSON.parse(document.getElementById('pack-data').textContent));
  const auto0 = await S(p, () => document.getElementById('bauto').getAttribute('aria-checked'));
  const speedHidden = await S(p, () => !document.getElementById('speed').offsetParent);
  if (auto0 !== 'false' || !speedHidden) { fails++; say(`${tag} 0: Auto ${auto0}, speed hidden ${speedHidden} FAIL`); } else say(`${tag} 0: Auto off by default, the speeds hidden until it is on: ok`);
  await p.screenshot({ path: `${shotDir}/v2-s26-fan-${tag}.png` });

  const runs = [
    { id: 'A', bulk: 0, mode: 'hand', still: true },
    { id: 'B', bulk: 1, mode: 'hand', shots: tag, viewer: true },
    { id: 'C', bulk: 1, mode: 'skip', auto: true, speed: 2 },
    { id: 'D', bulk: 0, mode: 'auto', auto: true, speed: 4 },
    { id: 'E', bulk: 0, mode: 'switchOff', auto: true, speed: 1 },
  ];
  for (const run of runs) {
    const problems = [];
    const B = data.bulks[run.bulk].reveal;
    await p.goto('file://' + file + '?bulk=' + (run.bulk + 1));
    await p.waitForTimeout(300);
    const isAuto = await S(p, () => window.__pack.auto);
    if (!!run.auto !== isAuto) await p.click('#bauto');
    if (run.speed) await p.click(`#speed button[data-speed="${run.speed}"]`);
    if (run.auto && tag === 'phone' && run.id === 'C') await p.screenshot({ path: `${shotDir}/v2-s26-auto-on-${tag}.png` });
    if (run.auto && tag === 'desktop' && run.id === 'C') await p.screenshot({ path: `${shotDir}/v2-s26-auto-on-${tag}.png` });
    await S(p, () => { window.__pack.log.length = 0; });
    const t0 = Date.now();
    await p.click('#fan');
    if (run.mode === 'hand') await byHand(p, B, h, w, problems, run);
    else if (run.mode === 'skip') {
      await p.waitForTimeout(150); await p.click('#bskip');
      let resumed = false;
      while (Date.now() - t0 < 60000) {
        const ph = await S(p, () => window.__pack.phase);
        if (ph === 'summary') break;
        if (ph === 'cards') { await waitFor(p, () => window.__pack.phase !== 'cards', null, 40000); resumed = true; continue; }
        if (resumed && ph === 'bulk') { await p.waitForTimeout(100); await p.click('#bskip'); resumed = false; }
        await p.waitForTimeout(40);
      }
    } else if (run.mode === 'auto') {
      await waitFor(p, () => window.__pack.phase === 'summary', null, 60000);
    } else if (run.mode === 'switchOff') {
      await waitFor(p, () => window.__pack.bp === 1 && !!window.__pack.row, null, 20000);
      await p.click('#bauto');
      const before = await S(p, () => ({ bp: window.__pack.bp, n: window.__pack.log.filter((e) => e.kind === 'bulkFlip' || e.kind === 'bulkPack').length }));
      await p.waitForTimeout(2000);
      const after = await S(p, () => ({ bp: window.__pack.bp, n: window.__pack.log.filter((e) => e.kind === 'bulkFlip' || e.kind === 'bulkPack').length, hint: document.getElementById('hint').textContent }));
      if (after.bp !== before.bp || after.n !== before.n) problems.push(`kept going after Auto was switched off (${JSON.stringify(before)} -> ${JSON.stringify(after)})`);
      if (/Auto/.test(after.hint)) problems.push(`hint still says "${after.hint}"`);
      await byHand(p, B, h, w, problems, {});
    }
    const secs = (Date.now() - t0) / 1000;
    await p.waitForTimeout(700);
    const log = await S(p, () => window.__pack.log);
    checkLog(log, B, problems, run.mode === 'switchOff' ? 'mixed' : run.mode);
    const dom = await checkSummary(p, B, problems);
    if (run.shots) await p.screenshot({ path: `${shotDir}/v2-s26-summary-${tag}.png` });
    if (run.viewer) {
      const best = await p.locator('.bulk-sum .grid.best .tile .mini').first();
      await best.click();
      await waitFor(p, () => !document.getElementById('viewer').hidden, null, 3000);
      await p.waitForTimeout(500);
      const v = await S(p, () => { const l = window.__pack.log.filter((e) => e.kind === 'viewer').pop(); const vc = document.getElementById('vcard').getBoundingClientRect(); return { l, fits: vc.top >= 0 && vc.bottom <= innerHeight && vc.left >= 0 && vc.right <= innerWidth }; });
      if (!v.l || !v.l.full || !v.fits) problems.push(`viewer ${JSON.stringify(v)}`);
      await p.screenshot({ path: `${shotDir}/v2-s26-viewer-${v.l && v.l.finish}-${tag}.png` });
      await p.keyboard.press('Escape');
      if (!(await S(p, () => document.getElementById('viewer').hidden))) problems.push('Escape left the viewer open');
    }
    if (errs.length) problems.push('page errors: ' + errs.join(' | '));
    if (problems.length) fails++;
    const taps = log.filter((e) => e.kind === 'bulkTap').length, big = log.filter((e) => e.kind === 'bulkPack' && !e.fast).map((e) => e.bp + 1), skipped = log.filter((e) => e.kind === 'bulkPack' && e.skipped).length;
    say(`${tag} run ${run.id} (${data.bulks[run.bulk].label}, ${run.mode}${run.speed ? ' ' + run.speed + 'x' : ''}): ${problems.length ? 'FAIL ' + problems.join('; ') : 'ok'} — ${secs.toFixed(1)} s; ${taps} row taps/swipes; big pulls at pack ${big.join(', ') || 'none'}; ${skipped} skipped; ${dom.tiles} tiles for ${dom.copies} cards`);
  }
  // Auto and the speed survive a reload (run E left Auto off, at 1x).
  await p.click('#bauto').catch(() => {});
  await p.goto('file://' + file + '?bulk=1');
  await p.waitForTimeout(200);
  if (!(await S(p, () => window.__pack.auto))) await p.click('#bauto');
  await p.click('#speed button[data-speed="4"]');
  await p.reload(); await p.waitForTimeout(200);
  const kept = await S(p, () => ({ auto: document.getElementById('bauto').getAttribute('aria-checked'), speed: document.querySelector('#speed button[aria-pressed="true"]').getAttribute('data-speed') }));
  if (kept.auto !== 'true' || kept.speed !== '4') { fails++; say(`${tag}: after reload ${JSON.stringify(kept)} FAIL`); } else say(`${tag}: Auto on and 4x remembered across a reload: ok`);

  // F. The Zero-Day single pack: its tile in the viewer.
  {
    const problems = [];
    const zi = data.packs.findIndex((x) => x.label === 'Zero-Day');
    await p.goto('file://' + file + '?pack=' + (zi + 1));
    await p.waitForTimeout(300);
    const pk = await p.locator('#pack').boundingBox();
    await p.mouse.click(pk.x + pk.width / 2, pk.y + pk.height / 2);
    await waitFor(p, () => window.__pack.phase === 'cards');
    await p.click('#skip');
    await waitFor(p, () => window.__pack.phase === 'summary');
    await p.waitForTimeout(700);
    const audit = await S(p, faceAudit);
    for (const f of audit) { if (f.over > 1) problems.push(`${f.name} (${f.finish}) tile text overflows ${f.over}px`); if (f.full !== FULL.includes(f.finish)) problems.push(`${f.name} (${f.finish}) tile full=${f.full}`); }
    await p.locator('.tile[data-finish="zeroDay"] .mini').click();
    await waitFor(p, () => !document.getElementById('viewer').hidden, null, 3000);
    await p.waitForTimeout(600);
    const v = await S(p, () => { const f = document.querySelector('#vcard .face'); const t = f.querySelector('.text'); return { modes: [...f.querySelectorAll('.mode b')].map((b) => b.textContent), text: t.textContent, over: t.scrollHeight - t.clientHeight, full: f.classList.contains('full') }; });
    if (v.modes.join('|') !== 'Outbreak|Carrier' || v.over > 1 || !v.full || !v.text.includes('deal 2 damage to all enemy units') || !v.text.includes('+1/+0')) problems.push(`viewer ${JSON.stringify(v)}`);
    await p.screenshot({ path: `${shotDir}/v2-s26-viewer-zeroDay-${tag}.png` });
    if (errs.length) problems.push('page errors: ' + errs.join(' | '));
    if (problems.length) fails++;
    say(`${tag} F (Zero-Day summary and viewer): ${problems.length ? 'FAIL ' + problems.join('; ') : 'ok'} — modes ${v.modes.join(' / ')}; ${audit.length} tile faces audited`);
  }
  // G. The card-face sheet.
  {
    const problems = [];
    await p.goto('file://' + facesFile);
    await p.waitForTimeout(400);
    const audit = await S(p, faceAudit);
    for (const f of audit) { if (f.over > 1) problems.push(`${f.name} (${f.finish}) text overflows ${f.over}px`); if (f.full !== FULL.includes(f.finish)) problems.push(`${f.name} (${f.finish}) full=${f.full}`); }
    const zd = audit.filter((f) => f.finish === 'zeroDay').map((f) => f.name);
    if (zd.length < 3) problems.push(`only ${zd.length} Zero-Day faces`);
    await p.screenshot({ path: `${shotDir}/v2-s26-card-faces-${tag}.png`, fullPage: true });
    if (problems.length) fails++;
    say(`${tag} G (card-face sheet, ${audit.length} faces): ${problems.length ? 'FAIL ' + problems.join('; ') : 'ok'}`);
  }
  await ctx.close();
}
await b.close();
say(fails ? `${fails} FAILED` : 'all pass');
process.exit(fails ? 1 : 0);
