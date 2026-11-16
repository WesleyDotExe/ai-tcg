// Render session 27: hold to tilt (owner 2026-10-18, as corrected the same
// day: the card leans as one solid piece, no art depth), driven like an
// owner would in a real (headless) Chromium. Not a repo dependency: run with
// playwright-core against the preinstalled Chromium:
//   node pack-tilt-check.mjs <outDir> <render/output/pack-opening.html> [video]
// Runs at 1280 x 800 with a mouse, and at 390 x 844 with real touch events
// (CDP Input.dispatchTouchEvent, so the page sees pointerType "touch"),
// each from a fresh profile:
//   A. The sealed pack: a hold below the TEAR strip, then a drag, leans the
//      pack (never past 15 degrees) and does not tear it; letting go springs
//      it back flat. A drag starting on the strip tears it, and never leans.
//   B. The honest tell: the same hold-and-drag on a pack with no hit and on
//      packs with a hit (Gold, Zero-Day) leans them exactly the same, frame
//      for frame. Sparks still come only from the tear.
//   C. The stack: a hold on a face-up card, then a drag to its corner, leans
//      it 15/15 degrees; the release is not a tap (the card stays). A quick
//      tap still sends it on; a quick sideways flick still swipes it (and
//      never leans it). A face-down card never leans.
//   D. The shine follows: on the Foil card, the shader's light goes where
//      the finger goes during the tilt.
//   E. The viewer: hold and drag leans the card; letting go over the
//      backdrop does not close the viewer; a tap on the backdrop does.
//   F. The ten-pack fan: a hold leans the front pack only (the others stay
//      still); the release does not tear; a tap does.
//   G. Reduced motion: the lean stops at 6 degrees and comes back with a
//      plain 150 ms ease, no spring.
// With "video", also records a short desktop and phone clip of the tilt
// (pack, tear, a Gold card, the Zero-Day card, the viewer), with a dot
// drawn where the finger is.
import { chromium, launchOpts } from '../../../render/ci/pw.mjs';
// RETIRED in render session 80 (a hardening pass): this check drove session 27's hold-to-tilt on the pre-ceremony page. The lean is checked on today's page by pack-ceremony-check-s58.mjs (the pack leans, the same lean whatever it holds) and -s60/-s61/-s62.mjs (the cards).
// Since the ceremony (render sessions 58-64) the page it was written for no
// longer exists (re-run in session 80: it fails on the old page's rules, not
// on a fault; the record is pack-checks-retired-s80.txt). Kept for the record;
// RUN_RETIRED=1 runs it anyway.
if (!process.env.RUN_RETIRED) { console.log('pack-tilt-check.mjs: retired in render session 80 (written for the pack page before the ceremony); see its header for the checks that replace it.'); process.exit(0); }
import { mkdirSync, renameSync } from 'node:fs';
const [outDir, file, video] = process.argv.slice(2);
const b = await chromium.launch(launchOpts({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] }));
let fails = 0;
const say = (s) => console.log(s);
const S = (p, fn, arg) => p.evaluate(fn, arg);
async function waitFor(p, fn, arg, ms = 20000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(40); }
  return false;
}
// The lean of an element, in degrees, from its inline transform.
const lean = (p, sel) => S(p, (s) => {
  const el = document.querySelector(s); if (!el) return null;
  const m = /rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\)/.exec(el.style.transform);
  const cs = getComputedStyle(el).transform;
  return { rx: m ? Number(m[1]) : 0, ry: m ? Number(m[2]) : 0, inline: el.style.transform, flat: cs === 'none' || cs === 'matrix(1, 0, 0, 1, 0, 0)' || /^matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0/.test(cs), transition: el.style.transition };
}, sel);

// One input device: the mouse, or touch through CDP.
function pointer(p, touch, cdp) {
  async function t(type, x, y) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] }); }
  return {
    async down(x, y) { if (touch) await t('touchStart', x, y); else { await p.mouse.move(x, y); await p.mouse.down(); } },
    async move(x, y) { if (touch) await t('touchMove', x, y); else await p.mouse.move(x, y); },
    async up() { if (touch) await t('touchEnd'); else await p.mouse.up(); },
    // A press held still, then dragged to (x2, y2) in steps.
    async holdDrag(x, y, x2, y2, { hold = 320, steps = 8, stepMs = 25 } = {}) {
      await this.down(x, y); await p.waitForTimeout(hold);
      for (let i = 1; i <= steps; i++) { await this.move(x + (x2 - x) * i / steps, y + (y2 - y) * i / steps); await p.waitForTimeout(stepMs); }
    },
    // Sent back to back: under a software GPU each CDP call can take 100 ms
    // or more, which would make a "tap" last longer than a hold.
    async tap(x, y) {
      if (touch) await Promise.all([t('touchStart', x, y), t('touchEnd')]);
      else await Promise.all([p.mouse.move(x, y), p.mouse.down(), p.mouse.up()]);
    },
    async flick(x, y, dx) { await this.down(x, y); for (let i = 1; i <= 5; i++) { await this.move(x + dx * i / 5, y); await p.waitForTimeout(16); } await this.up(); },
  };
}
const box = (p, sel) => p.locator(sel).first().boundingBox();
const packIndex = (p, label) => S(p, (l) => JSON.parse(document.getElementById('pack-data').textContent).packs.findIndex((x) => x.label === l), label);

async function run(name, size, touch, reduce) {
  const ctx = await b.newContext({ viewport: size, hasTouch: touch, isMobile: touch, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const P = pointer(p, touch, cdp);
  const problems = [];
  const MAX = reduce ? 6 : 15;
  const out = [];
  await p.goto('file://' + file);
  const labels = await S(p, () => JSON.parse(document.getElementById('pack-data').textContent).packs.map((x) => x.label));
  const iPlain = 0, iFoil = labels.indexOf('Foil'), iGold = labels.indexOf('Gold'), iZd = labels.findIndex((l) => /Zero-Day/.test(l));

  // ---------- A: the sealed pack ----------
  await p.goto('file://' + file + '?pack=' + (iPlain + 1));
  await waitFor(p, () => window.__pack.phase === 'pack');
  let pb = await box(p, '#pack');
  await P.holdDrag(pb.x + pb.width * 0.5, pb.y + pb.height * 0.6, pb.x + pb.width * 1.1, pb.y + pb.height * 1.05);
  const held = await lean(p, '#pack .tilt');
  if (!(held.ry > 0 && held.rx < 0)) problems.push(`A: pack did not lean towards the finger (${held.inline})`);
  if (Math.abs(held.rx) > MAX || Math.abs(held.ry) > MAX) problems.push(`A: pack leaned past ${MAX} (${held.inline})`);
  if (Math.abs(held.ry) !== MAX) problems.push(`A: a finger past the edge should lean the full ${MAX} (${held.ry})`);
  await P.up();
  await p.waitForTimeout(80);
  let st = await S(p, () => ({ phase: window.__pack.phase, log: window.__pack.log.map((e) => e.kind) }));
  if (st.phase !== 'pack' || st.log.includes('tear')) problems.push('A: releasing a tilt tore the pack');
  if (!st.log.includes('tiltStart') || !st.log.includes('tiltEnd')) problems.push('A: no tiltStart/tiltEnd logged');
  const springT = (await lean(p, '#pack .tilt')).transition;
  if (reduce ? !/150ms ease-out/.test(springT) : !/560ms cubic-bezier/.test(springT)) problems.push(`A: release transition ${springT}`);
  await p.waitForTimeout(reduce ? 260 : 700);
  if (!(await lean(p, '#pack .tilt')).flat) problems.push('A: pack did not come back flat');
  out.push(`A pack: leaned rx ${held.rx} ry ${held.ry}, released untorn, back flat (${springT.split(' ').slice(1).join(' ')})`);
  // A drag along the strip tears it, and never leans.
  const before = await S(p, () => window.__pack.log.length);
  pb = await box(p, '#pack');
  await P.down(pb.x + pb.width * 0.08, pb.y + pb.height * 0.12);
  for (let i = 1; i <= 10; i++) { await P.move(pb.x + pb.width * (0.08 + 0.09 * i), pb.y + pb.height * 0.12); await p.waitForTimeout(30); }
  await P.up();
  st = await S(p, (k) => window.__pack.log.slice(k).map((e) => e.kind + (e.via ? ':' + e.via : '')), before);
  if (!st.includes('tear:drag')) problems.push(`A: a drag along the strip did not tear it (${st.join(',')})`);
  if (st.includes('tiltStart')) problems.push('A: a drag along the strip leaned the pack');
  out.push(`A strip: ${st.filter((k) => /tear|tilt/.test(k)).join(', ')}`);

  // ---------- C, D: the stack ----------
  await waitFor(p, () => window.__pack.phase === 'cards' && window.__pack.tilt === 0 && window.__pack.busyUntil <= performance.now());
  let cb = await box(p, '.cslot[data-k="0"]');
  await P.holdDrag(cb.x + cb.width / 2, cb.y + cb.height / 2, cb.x + cb.width, cb.y, { steps: 6 });
  const cl = await lean(p, '.cslot[data-k="0"] .flipper');
  if (cl.ry !== MAX || cl.rx !== MAX) problems.push(`C: card at its corner leaned rx ${cl.rx} ry ${cl.ry}, want ${MAX}/${MAX}`);
  await P.up(); await p.waitForTimeout(120);
  st = await S(p, () => ({ i: window.__pack.i, left: window.__pack.log.filter((e) => e.kind === 'cardLeft').length }));
  if (st.i !== 0 || st.left) problems.push('C: the release after a tilt moved the card on');
  await p.waitForTimeout(reduce ? 260 : 700);
  if (!(await lean(p, '.cslot[data-k="0"] .flipper')).flat) problems.push('C: card did not come back flat');
  // A quick tap still moves on.
  cb = await box(p, '.cslot[data-k="0"]');
  await P.tap(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await waitFor(p, () => window.__pack.i === 1, null, 3000) || problems.push('C: a quick tap did not move on');
  // A quick flick still swipes, without leaning.
  await waitFor(p, () => window.__pack.tilt === 1 && window.__pack.busyUntil <= performance.now());
  const t0 = await S(p, () => window.__pack.log.length);
  cb = await box(p, '.cslot[data-k="1"]');
  await P.flick(cb.x + cb.width / 2, cb.y + cb.height / 2, 130);
  await waitFor(p, () => window.__pack.i === 2, null, 3000) || problems.push('C: a flick did not swipe');
  st = await S(p, (k) => window.__pack.log.slice(k).map((e) => e.kind + (e.dir ? ':' + e.dir : '')), t0);
  if (st.includes('tiltStart')) problems.push('C: a flick leaned the card');
  out.push(`C stack: corner lean ${cl.rx}/${cl.ry}, release kept the card, tap moved on, flick -> ${st.filter((k) => /cardLeft|tilt/.test(k)).join(',')}`);

  // Foil pack: a face-down card never leans; the shine follows the finger.
  await p.goto('file://' + file + '?pack=' + (iFoil + 1));
  await waitFor(p, () => window.__pack.phase === 'pack');
  pb = await box(p, '#pack'); await P.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await waitFor(p, () => window.__pack.phase === 'cards');
  for (let k = 0; k < 4; k++) {
    await waitFor(p, (k) => window.__pack.i === k && window.__pack.busyUntil <= performance.now(), k);
    cb = await box(p, `.cslot[data-k="${k}"]`); await P.tap(cb.x + cb.width / 2, cb.y + cb.height / 2);
  }
  await waitFor(p, () => window.__pack.i === 4 && window.__pack.busyUntil <= performance.now());
  cb = await box(p, '.cslot[data-k="4"]');
  const d0 = await S(p, () => window.__pack.log.length);
  await P.holdDrag(cb.x + cb.width / 2, cb.y + cb.height / 2, cb.x + cb.width * 0.8, cb.y + cb.height * 0.3, { hold: 300, steps: 3 });
  await P.up(); await p.waitForTimeout(80);
  st = await S(p, (k) => window.__pack.log.slice(k).map((e) => e.kind), d0);
  if (st.includes('tiltStart')) problems.push('C: a face-down card leaned');
  if (!st.includes('reveal')) problems.push(`C: the face-down card was not revealed by the press (${st.join(',')})`);
  await waitFor(p, () => window.__pack.log.some((e) => e.kind === 'landed' && e.idx === 4));
  await p.waitForTimeout(300);
  await S(p, () => { window.__ptrs = []; window.__pack.layers.forEach((l) => { const o = l.ptr; l.ptr = (x, y) => { window.__ptrs.push([x, y]); o(x, y); }; }); });
  cb = await box(p, '.cslot[data-k="4"]');
  await P.holdDrag(cb.x + cb.width * 0.5, cb.y + cb.height * 0.5, cb.x + cb.width * 0.1, cb.y + cb.height * 0.9, { steps: 6 });
  const ptrs = await S(p, () => window.__ptrs.slice(-1)[0]);
  if (!ptrs || Math.abs(ptrs[0] - 0.1) > 0.03 || Math.abs(ptrs[1] - 0.9) > 0.03) problems.push(`D: the shine's light ended at ${JSON.stringify(ptrs)}, the finger at [0.1, 0.9]`);
  const fl = await lean(p, '.cslot[data-k="4"] .flipper');
  await p.screenshot({ path: `${outDir}/v2-s27-tilt-foil-${name}.jpg`, quality: 80 });
  await P.up();
  out.push(`D shine: finger at [0.1, 0.9] -> light at [${ptrs && ptrs.map((v) => v.toFixed(2)).join(', ')}], card leaned rx ${fl.rx} ry ${fl.ry}`);

  // ---------- E: the viewer ----------
  await p.waitForTimeout(400);
  await S(p, () => document.getElementById('skip').click());
  await waitFor(p, () => window.__pack.phase === 'summary');
  await p.locator('.tile[data-ti="4"] .mini').scrollIntoViewIfNeeded();
  const tile = await box(p, '.tile[data-ti="4"] .mini');
  await P.tap(tile.x + tile.width / 2, tile.y + tile.height / 2);
  await waitFor(p, () => !document.getElementById('viewer').hidden);
  // Measured once the viewer's rise has finished (it moves the card).
  await waitFor(p, () => document.getElementById('vcard').getAnimations().every((a) => a.playState === 'finished'));
  await p.waitForTimeout(100);
  const vb = await box(p, '#vcard');
  await P.holdDrag(vb.x + vb.width / 2, vb.y + vb.height / 2, vb.x + vb.width * 0.95, vb.y + vb.height * 0.2, { steps: 6 });
  const vl = await lean(p, '#vcard .tiltv');
  // The finger at (0.95, 0.2): ry 0.9 x MAX, rx 0.6 x MAX.
  if (Math.abs(vl.ry - 0.9 * MAX) > 0.5 || Math.abs(vl.rx - 0.6 * MAX) > 0.5) problems.push(`E: viewer card leaned ${vl.inline}, want rx ${0.6 * MAX} ry ${0.9 * MAX}`);
  await p.screenshot({ path: `${outDir}/v2-s27-tilt-viewer-${name}.jpg`, quality: 80 });
  // Drag off the card onto the backdrop, and let go there.
  await P.move(Math.min(size.width - 4, vb.x + vb.width + 12), Math.max(4, vb.y - 10)); await p.waitForTimeout(40);
  await P.up(); await p.waitForTimeout(250);
  if (await S(p, () => document.getElementById('viewer').hidden)) problems.push('E: letting go of a tilt over the backdrop closed the viewer');
  await P.tap(4, size.height - 60); await p.waitForTimeout(200);
  if (!(await S(p, () => document.getElementById('viewer').hidden))) problems.push('E: a tap on the backdrop did not close the viewer');
  out.push(`E viewer: leaned rx ${vl.rx} ry ${vl.ry}; released over the backdrop, still open; a tap closed it`);

  // ---------- B: the honest tell ----------
  const traces = {};
  for (const [lab, i] of [['no hit', iPlain], ['Gold', iGold], ['Zero-Day', iZd]]) {
    await p.goto('file://' + file + '?pack=' + (i + 1));
    await waitFor(p, () => window.__pack.phase === 'pack');
    await p.waitForTimeout(150);
    pb = await box(p, '#pack');
    const tr = [];
    await P.down(pb.x + pb.width * 0.5, pb.y + pb.height * 0.6); await p.waitForTimeout(300);
    for (let s = 1; s <= 8; s++) { await P.move(pb.x + pb.width * (0.5 - 0.06 * s), pb.y + pb.height * (0.6 + 0.04 * s)); await p.waitForTimeout(25); tr.push((await lean(p, '#pack .tilt')).inline); }
    await P.up();
    const L = await S(p, () => window.__pack.log.filter((e) => e.kind === 'tiltEnd').map((e) => e.peak));
    traces[lab] = { tr, peak: L[0] };
  }
  const ref = JSON.stringify(traces['no hit'].tr);
  for (const lab of ['Gold', 'Zero-Day']) if (JSON.stringify(traces[lab].tr) !== ref) problems.push(`B: ${lab} pack leaned differently from a pack with no hit`);
  out.push(`B tell: no hit / Gold / Zero-Day leaned identically over 8 steps (peak ${traces['no hit'].peak}, ${traces.Gold.peak}, ${traces['Zero-Day'].peak}); last ${traces['no hit'].tr.slice(-1)[0]}`);

  // ---------- F: the ten-pack fan ----------
  await p.goto('file://' + file + '?bulk=1');
  await waitFor(p, () => window.__pack.phase === 'fan');
  const fb = await box(p, '#fan');
  const othersBefore = await S(p, () => [...document.querySelectorAll('.fan .mpack:not(.front)')].map((e) => e.style.transform + '|' + e.querySelectorAll('.mtilt').length));
  await P.holdDrag(fb.x + fb.width / 2, fb.y + fb.height / 2, fb.x + fb.width * 0.9, fb.y + fb.height * 0.2, { steps: 6 });
  const fanL = await lean(p, '.fan .mpack.front .mtilt');
  const othersDuring = await S(p, () => [...document.querySelectorAll('.fan .mpack:not(.front)')].map((e) => e.style.transform + '|' + e.querySelectorAll('.mtilt').length));
  if (!(fanL.ry > 0 && fanL.rx > 0)) problems.push(`F: the front pack did not lean (${fanL.inline})`);
  if (JSON.stringify(othersBefore) !== JSON.stringify(othersDuring) || othersDuring.some((s) => s !== '|0')) problems.push('F: another pack in the fan moved');
  await p.screenshot({ path: `${outDir}/v2-s27-tilt-fan-${name}.jpg`, quality: 80 });
  // Tapped soon after: the tilt's own trailing click is dropped, a new tap is not.
  await P.up(); await p.waitForTimeout(120);
  if ((await S(p, () => window.__pack.phase)) !== 'fan') problems.push('F: releasing the tilt tore the first pack');
  await P.tap(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await waitFor(p, () => window.__pack.log.some((e) => e.kind === 'bulkGo'), null, 2000) || problems.push('F: a tap on the fan did not tear pack 1');
  out.push(`F fan: front pack leaned rx ${fanL.rx} ry ${fanL.ry}, ${othersDuring.length} others still, release kept the fan, a tap tore pack 1`);

  if (errs.length) problems.push('page errors: ' + errs.join(' | '));
  const sx = await S(p, () => document.documentElement.scrollWidth > window.innerWidth);
  if (sx) problems.push('horizontal scroll');
  say(`\n== ${name} (${size.width} x ${size.height}, ${touch ? 'touch' : 'mouse'}${reduce ? ', reduced motion' : ''}) ==`);
  out.forEach((l) => say('  ' + l));
  say(problems.length ? '  FAIL\n    ' + problems.join('\n    ') : '  PASS');
  fails += problems.length;
  await ctx.close();
}

await run('desktop', { width: 1280, height: 800 }, false, false);
await run('phone', { width: 390, height: 844 }, true, false);
await run('phone-reduced', { width: 390, height: 844 }, true, true);

// ---------- recordings ----------
async function record(name, size, touch) {
  const dir = `${outDir}/.vid-${name}`; mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({ viewport: size, hasTouch: touch, isMobile: touch, recordVideo: { dir, size } });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const P = pointer(p, touch, cdp);
  // The finger, drawn by this script (not part of the page).
  const dot = (x, y, on) => S(p, ([x, y, on]) => { let d = document.getElementById('__dot'); if (!d) { d = document.createElement('div'); d.id = '__dot'; d.style.cssText = 'position:fixed;z-index:99;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,0.55);box-shadow:0 0 0 2px rgba(255,255,255,0.9),0 0 18px #fff;pointer-events:none;transition:opacity .15s'; document.body.appendChild(d); } d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.opacity = on ? 1 : 0; }, [x, y, on]);
  async function circle(sel, cx, cy, rx, ry, ms) {
    const bx = await box(p, sel);
    const X = (u) => bx.x + bx.width * u, Y = (v) => bx.y + bx.height * v;
    await dot(X(cx), Y(cy), true); await P.down(X(cx), Y(cy)); await p.waitForTimeout(350);
    const n = Math.round(ms / 40);
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const x = X(cx + rx * Math.sin(a)), y = Y(cy - ry * Math.cos(a) + ry); await P.move(x, y); await dot(x, y, true); await p.waitForTimeout(40); }
    await P.up(); await dot(0, 0, false); await p.waitForTimeout(800);
  }
  const labels = await (async () => { await p.goto('file://' + file); return S(p, () => JSON.parse(document.getElementById('pack-data').textContent).packs.map((x) => x.label)); })();
  const iGold = labels.indexOf('Gold');
  await p.goto('file://' + file + '?pack=' + (iGold + 1));
  await waitFor(p, () => window.__pack.phase === 'pack'); await p.waitForTimeout(500);
  await circle('#pack', 0.5, 0.55, 0.45, 0.3, 2200);
  // Tear along the strip.
  const pb = await box(p, '#pack');
  await dot(pb.x + pb.width * 0.08, pb.y + pb.height * 0.12, true); await P.down(pb.x + pb.width * 0.08, pb.y + pb.height * 0.12);
  for (let i = 1; i <= 12; i++) { const x = pb.x + pb.width * (0.08 + 0.075 * i); await P.move(x, pb.y + pb.height * 0.12); await dot(x, pb.y + pb.height * 0.12, true); await p.waitForTimeout(30); }
  await P.up(); await dot(0, 0, false);
  await waitFor(p, () => window.__pack.phase === 'cards');
  for (let k = 0; k < 5; k++) {
    await waitFor(p, (k) => window.__pack.i === k && window.__pack.busyUntil <= performance.now(), k);
    const st = await S(p, () => window.__pack.cur.cards[window.__pack.i]);
    if (st.reveal === 'gold') break;
    const cb = await box(p, `.cslot[data-k="${k}"]`); await P.tap(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await p.waitForTimeout(150);
  }
  const k = await S(p, () => window.__pack.i);
  const cb = await box(p, `.cslot[data-k="${k}"]`); await P.tap(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await waitFor(p, (k) => window.__pack.tilt === k && window.__pack.busyUntil <= performance.now(), k, 8000);
  await circle(`.cslot[data-k="${k}"]`, 0.5, 0.5, 0.48, 0.42, 3000);
  // The Zero-Day card in the viewer.
  const iZd = labels.findIndex((l) => /Zero-Day/.test(l));
  await p.goto('file://' + file + '?pack=' + (iZd + 1));
  await waitFor(p, () => window.__pack.phase === 'pack');
  await S(p, () => { document.getElementById('pack').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  await waitFor(p, () => window.__pack.phase === 'cards');
  await p.waitForTimeout(900);
  await S(p, () => document.getElementById('skip').click());
  await waitFor(p, () => window.__pack.phase === 'summary');
  const zi = await S(p, () => window.__pack.cur.cards.findIndex((c) => c.reveal === 'zeroDay'));
  await p.locator(`.tile[data-ti="${zi}"] .mini`).scrollIntoViewIfNeeded();
  const tb = await box(p, `.tile[data-ti="${zi}"] .mini`);
  await P.tap(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await p.waitForTimeout(700);
  await circle('#vcard', 0.5, 0.5, 0.48, 0.42, 3000);
  const vpath = await p.video().path();
  await ctx.close();
  renameSync(vpath, `${outDir}/v2-s27-tilt-${name}.webm`);
  say(`recorded v2-s27-tilt-${name}.webm`);
}
if (video) {
  await record('desktop', { width: 1280, height: 800 }, false);
  await record('phone', { width: 390, height: 844 }, true);
}
await b.close();
say(fails ? `\n${fails} problem(s)` : '\nall pass');
process.exit(fails ? 1 : 0);
