// Render session 24: the pack-opening page, driven like an owner would in a
// real (headless) Chromium. Not a repo dependency: run from a scratch
// folder with playwright-core installed, against the preinstalled Chromium:
//   node pack-opening-check.mjs <shotDir> <render/output/pack-opening.html> [still prefix, default v2-s24]
// For every showcase pack, at 1280 x 800 and at 390 x 844 (a phone):
//   - opens it: a drag across the top on odd packs, a tap on even ones;
//   - checks the honest tell: the tear throws sparks iff the pack holds a
//     hit (Full Art or better), never otherwise;
//   - steps through the stack with taps, the way a viewer would, and checks
//     the cards come in the plan's order (the shine slot last of the five,
//     a bonus 6th card after it), that every face-down card gets its own
//     finish's reveal, and that a tap during a reveal's hold is ignored;
//   - Zero-Day: the terminal types "ZERO-DAY DETECTED", then the card arrives;
//   - the summary lists exactly the pack's cards, finishes and NEW badges;
//   - every shader compiled (none fell back to CSS) and drew frames, and
//     each one, drawn into a readable canvas, lights real pixels;
//   - no horizontal scroll, the card fits on screen, no page errors.
// Stills of each reveal at both widths go to shotDir.
import { chromium, launchOpts } from '../../../render/ci/pw.mjs';
// RETIRED in render session 80 (a hardening pass): this check drove the tear, sparks and reveals of the pack page before the ceremony (sessions 22-25). Replaced by pack-ceremony-check-s58.mjs (the pack, the drag tear, the burst), -s60/-s61/-s62 (the reveals by kind) and pack-bulk-check-s64.mjs (the ten).
// Since the ceremony (render sessions 58-64) the page it was written for no
// longer exists (re-run in session 80: it fails on the old page's rules, not
// on a fault; the record is pack-checks-retired-s80.txt). Kept for the record;
// RUN_RETIRED=1 runs it anyway.
if (!process.env.RUN_RETIRED) { console.log('pack-opening-check.mjs: retired in render session 80 (written for the pack page before the ceremony); see its header for the checks that replace it.'); process.exit(0); }
const [shotDir, file, prefix = 'v2-s24'] = process.argv.slice(2);
const b = await chromium.launch(launchOpts({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] }));
let fails = 0;
const out = [];
const say = (s) => { out.push(s); console.log(s); };
const STILL = { foil: 'landed', fullArt: 'landed', altArt: 'landed', glitch: 'landed', secret: 'callout', gold: 'landed', prototype: 'stamp' };

for (const [w, h, tag] of [[1280, 800, 'desktop'], [390, 844, 'phone']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: tag === 'phone' ? 2 : 1, hasTouch: false });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + file);
  await p.waitForTimeout(300);
  const data = await p.evaluate(() => JSON.parse(document.getElementById('pack-data').textContent));
  // Every shader, drawn into a readable canvas: real pixels or a failure.
  const lit = await p.evaluate(() => {
    const res = {};
    for (const name of Object.keys(PACK_FX_SHADERS)) {
      const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:120px;height:160px;';
      document.body.appendChild(host);
      const l = FXGL.layer(host, name, { amt: 1, readable: true });
      res[name] = l ? l : null;
    }
    return new Promise((done) => setTimeout(() => {
      const r = {};
      for (const [name, l] of Object.entries(res)) {
        if (!l) { r[name] = 'NO LAYER'; continue; }
        const gl = l.canvas.getContext('webgl');
        const px = new Uint8Array(l.canvas.width * l.canvas.height * 4);
        gl.readPixels(0, 0, l.canvas.width, l.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 8) n++;
        r[name] = n / (px.length / 4);
        l.stop(); l.canvas.parentNode && l.canvas.parentNode.remove();
      }
      document.querySelectorAll('body > div[style*="position:fixed"]').forEach((d) => d.remove());
      done(r);
    }, 400));
  });
  for (const [name, frac] of Object.entries(lit)) {
    const ok = typeof frac === 'number' && frac > 0.01;
    if (!ok) fails++;
    say(`${tag}: shader ${name}: ${ok ? 'ok' : 'FAIL'} (${typeof frac === 'number' ? (frac * 100).toFixed(1) + '% of pixels lit' : frac})`);
  }

  for (let i = 0; i < data.packs.length; i++) {
    const plan = data.packs[i].reveal, label = data.packs[i].label, slug = label.toLowerCase().replace(/[^a-z]+/g, '-');
    const problems = [];
    await p.evaluate((n) => { window.__pack.log.length = 0; }, i);
    await p.goto('file://' + file + '?pack=' + (i + 1));
    await p.waitForTimeout(350);
    const pk = await p.locator('#pack').boundingBox();
    if (i === 0) await p.screenshot({ path: `${shotDir}/${prefix}-pack-sealed-${tag}.png` });
    const via = i % 2 === 0 ? 'drag' : 'tap';
    if (via === 'drag') {
      const y = pk.y + pk.height * 0.1;
      await p.mouse.move(pk.x + pk.width * 0.08, y); await p.mouse.down();
      for (let s = 1; s <= 14; s++) { await p.mouse.move(pk.x + pk.width * (0.08 + 0.065 * s), y); await p.waitForTimeout(16); }
      await p.mouse.up();
    } else {
      await p.mouse.click(pk.x + pk.width / 2, pk.y + pk.height / 2);
    }
    await p.waitForTimeout(via === 'tap' ? 520 : 80);
    if (plan.sparks && tag === 'desktop' && label === 'Full Art') { await p.waitForTimeout(120); await p.screenshot({ path: `${shotDir}/${prefix}-tear-sparks-${tag}.png` }); }
    if (plan.jackpot) { await p.waitForTimeout(700); await p.screenshot({ path: `${shotDir}/${prefix}-jackpot-banner-${tag}.png` }); }
    // Wait for the stack.
    for (let k = 0; k < 60; k++) { if ((await p.evaluate(() => window.__pack.phase)) === 'cards') break; await p.waitForTimeout(100); }
    await p.waitForTimeout(800);
    const tearEv = await p.evaluate(() => window.__pack.log.find((e) => e.kind === 'tear'));
    const sparked = await p.evaluate(() => window.__pack.log.some((e) => e.kind === 'sparks'));
    const hasHit = plan.cards.some((c) => c.hit);
    if (!tearEv) problems.push('no tear');
    else if (tearEv.via !== via) problems.push(`torn by ${tearEv.via}, expected ${via}`);
    if (sparked !== hasHit || (tearEv && tearEv.sparks !== hasHit)) problems.push(`sparks ${sparked}, hit ${hasHit}`);

    // Step through: tap the top card until the summary.
    let guard = 0, ignoredTaps = 0;
    while ((await p.evaluate(() => window.__pack.phase)) === 'cards' && guard++ < 40) {
      const st = await p.evaluate(() => ({ i: window.__pack.i, busy: window.__pack.busyUntil - performance.now() }));
      const c = plan.cards[st.i];
      if (!c) { await p.waitForTimeout(100); continue; }
      const box = await p.locator(`.cslot[data-k="${st.i}"]`).boundingBox();
      if (!box) { await p.waitForTimeout(100); continue; }
      if (box.y < 0 || box.y + box.height > h + 2 || box.x < 0 || box.x + box.width > w) problems.push(`card ${st.i} off screen (${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)})`);
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      if (c.faceDown) {
        // A second tap straight away must not skip the reveal.
        await p.waitForTimeout(60);
        const before = await p.evaluate(() => window.__pack.i);
        await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        if ((await p.evaluate(() => window.__pack.i)) !== before) problems.push(`card ${st.i}: a tap during the reveal skipped it`); else ignoredTaps++;
        if (c.reveal === 'zeroDay') {
          for (let k = 0; k < 40; k++) { if (await p.evaluate(() => window.__pack.log.some((e) => e.kind === 'zeroDayTyped'))) break; await p.waitForTimeout(100); }
          await p.screenshot({ path: `${shotDir}/${prefix}-zero-day-terminal-${tag}.png` });
          await p.waitForTimeout(1000);
          await p.screenshot({ path: `${shotDir}/${prefix}-zero-day-breach-${tag}.png` });
          for (let k = 0; k < 40; k++) { if (await p.evaluate(() => window.__pack.log.some((e) => e.kind === 'zeroDayArrive'))) break; await p.waitForTimeout(100); }
          await p.waitForTimeout(1500);
          await p.screenshot({ path: `${shotDir}/${prefix}-zero-day-card-${tag}.png` });
        } else {
          if (c.reveal === 'glitch') { await p.waitForTimeout(380); await p.screenshot({ path: `${shotDir}/${prefix}-glitch-corrupting-${tag}.png` }); }
          const want = STILL[c.reveal];
          for (let k = 0; k < 60; k++) { if (await p.evaluate((x) => window.__pack.log.some((e) => e.kind === x.want && (x.want !== 'landed' || e.idx === x.i)), { want, i: st.i })) break; await p.waitForTimeout(80); }
          await p.waitForTimeout(c.reveal === 'secret' ? 250 : c.reveal === 'prototype' ? 400 : 650);
          if (!(plan.jackpot && st.i > 0 && c.slot !== "shine")) await p.screenshot({ path: `${shotDir}/${prefix}-${c.reveal}${plan.jackpot ? '-jackpot' : ''}-${tag}.png` });
        }
      }
      // Wait out the hold, then move on.
      for (let k = 0; k < 80; k++) { const bz = await p.evaluate(() => window.__pack.busyUntil - performance.now()); if (bz <= 0) break; await p.waitForTimeout(80); }
      if (c.faceDown) {
        await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
      await p.waitForTimeout(330);
    }
    await p.waitForTimeout(500);
    const log = await p.evaluate(() => window.__pack.log);
    const shown = log.filter((e) => e.kind === 'cardShown').map((e) => e.idx);
    if (JSON.stringify(shown) !== JSON.stringify(plan.cards.map((_, k) => k))) problems.push(`cards shown ${JSON.stringify(shown)}`);
    const order = log.filter((e) => e.kind === 'cardShown').map((e) => e.slot);
    const shineAt = order.indexOf('shine');
    if (shineAt !== 4) problems.push(`shine slot at ${shineAt}`);
    if (order.includes('bonus') && order.indexOf('bonus') !== 5) problems.push('bonus card not 6th');
    for (const [k, c] of plan.cards.entries()) {
      const rv = log.find((e) => e.kind === 'reveal' && e.idx === k);
      if (c.faceDown && (!rv || rv.as !== c.reveal)) problems.push(`card ${k}: reveal ${rv ? rv.as : 'none'}, want ${c.reveal}`);
      if (!c.faceDown && rv) problems.push(`card ${k}: plain card got a reveal`);
      if (c.reveal === 'zeroDay') {
        const typed = log.find((e) => e.kind === 'zeroDayTyped');
        if (!typed || typed.text !== 'ZERO-DAY DETECTED') problems.push(`zero-day typed ${typed && typed.text}`);
        if (!log.some((e) => e.kind === 'zeroDayArrive')) problems.push('zero-day card never arrived');
      } else if (c.faceDown && !log.some((e) => e.kind === 'landed' && e.idx === k)) problems.push(`card ${k} never landed`);
    }
    const sum = log.find((e) => e.kind === 'summary');
    if (!sum) problems.push('no summary');
    else {
      const want = plan.cards.map((c) => ({ name: c.face.name, finish: c.finish, isNew: c.isNew }));
      if (JSON.stringify(sum.cards) !== JSON.stringify(want)) problems.push('summary differs from the pack');
      if (sum.packPoints !== plan.packPoints) problems.push('pack points differ');
      const badges = await p.evaluate(() => document.querySelectorAll('.tile .new').length);
      if (badges !== plan.cards.filter((c) => c.isNew).length) problems.push(`NEW badges ${badges}`);
    }
    if (['Gold', 'Zero-Day', 'Prototype'].includes(label) || (tag === 'phone' && label === 'Secret')) await p.screenshot({ path: `${shotDir}/${prefix}-summary-${slug}-${tag}.png`, fullPage: false });
    const overflow = await p.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    if (overflow > 0) problems.push(`horizontal overflow ${overflow}px`);
    const fx = await p.evaluate(() => window.__packfx);
    if (Object.keys(fx.fallbacks).length || Object.keys(fx.failed).length) problems.push(`shader fallbacks ${JSON.stringify(fx.fallbacks)} ${JSON.stringify(fx.failed)}`);
    // Each pack loads the page afresh: the shaders this pack used.
    const used = Object.keys(fx.compiled).sort().join('+');
    if (problems.length) fails++;
    say(`${tag}: ${label.padEnd(10)} torn by ${via}, sparks ${sparked ? 'yes' : 'no '} (hit ${hasHit ? 'yes' : 'no '}), ${shown.length} cards, reveals [${plan.cards.filter((c) => c.faceDown).map((c) => c.reveal).join(', ')}], ${ignoredTaps} early taps ignored, shaders ${used}: ${problems.length ? 'FAIL ' + problems.join('; ') : 'ok'}`);
  }
  say(`${tag}: page errors ${errs.length ? errs.join(' | ') : 'none'}`);
  if (errs.length) fails++;
  await p.close();
}
await b.close();
say(fails ? `${fails} FAILED` : 'all pass');
process.exit(fails ? 1 : 0);
