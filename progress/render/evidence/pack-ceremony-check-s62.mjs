// Render session 62: the pack opening ceremony, part 3b (the owner's
// 2026-11-06 Season 0 brief, section 3, supporting requirements: "Open 10
// fast-forwards through plain cards but still stops for every Rare, Mythic,
// special finish and Prototype" and the owner-only debug panel), driven like
// an owner would in a real (headless) Chromium. This is also the brief's
// done-check: "the pack ceremony has been run through every reveal kind using
// the debug panel, including Prototype and Open 10".
//
//   node progress/render/evidence/pack-ceremony-check-s62.mjs [shotDir] [page]
// (page defaults to render/output/pack-opening.html; build it with
// `npm run pack-opening -w render`).
//   1. the panel: on the demo page, collapsed; opened, it lists every kind
//      above a snap; arming one and pressing "Open one now" opens that kind's
//      real opening; it disarms once used, and the picker's next pack is the
//      showcase's own again;
//   2. one pack per kind, all ten kinds, through the panel (desktop): the
//      best card's build is that kind's step, every held card builds and
//      hits, every snap snaps, the summary comes;
//   3. Open 10 per kind, all ten kinds, through the panel (desktop, tapping):
//      the stops are exactly the held cards of the ten packs (none on a
//      snap); each one waits face down until the tap, then builds and hits
//      (in the row, or in the stack for a big pull); pack 1's best card is
//      the kind; the summary comes;
//   4. Auto (two tens): at a stop the sequence waits 1.5 s untouched (no
//      pack torn, no build, the card still face down) and carries on by
//      itself only after the tap; a stop's build takes its 1x time at 4x;
//   5. Skip at a stop only points at it (the pack doesn't change);
//   6. a phone (390 x 844): one forced pack and one forced ten, the panel
//      inside the screen;
//   7. no network requests, no page errors, no horizontal scroll.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
let fails = 0, passes = 0;
const lines = [];
const say = (s) => { console.log(s); lines.push(s); };
const ok = (c, what) => { if (c) { passes++; say(`  PASS ${what}`); } else { fails++; say(`  FAIL ${what}`); } };
const shot = (p, name) => p.screenshot({ path: `${shotDir}/v2-s62-${name}.jpg`, type: 'jpeg', quality: 82 }).catch(() => say(`      (still ${name} timed out)`));
async function waitFor(p, fn, arg, ms = 20000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(40); }
  return false;
}
const STEPS = ['rare', 'mythic', 'foil', 'fullArt', 'altArt', 'glitch', 'gold', 'secret', 'prototype', 'zeroDay'];
const LADDER = ['snap', ...STEPS];

// Steps the open through to its summary the way an owner would: Enter on the
// sealed pack or the fan, then ArrowRight (a tap) whenever the page will take
// one. In Auto, nothing is pressed unless a stop is waiting, and then only
// after `autoWait` ms of watching that nothing moves.
async function drive(p, { auto = false, autoWait = 1500, onStop = null, max = 400000 } = {}) {
  const t0 = Date.now();
  const waits = [];
  let lastStop = '';
  while (Date.now() - t0 < max) {
    const s = await p.evaluate(() => {
      const S = window.__pack, now = performance.now();
      const R = S.row;
      const downs = R && R.r ? R.r.cards.map((c, k) => k).filter((k) => (c => c.build ? c.build.held : c.faceDown)(R.r.cards[k]) && !R.flipped[k]) : [];
      const c = S.cur && S.cur.cards[S.i];
      return { phase: S.phase, mode: S.mode, bp: S.bp, i: S.i, busy: now < S.busyUntil, building: !!(R && R.building), row: !!R, waiting: !!(R && R.waiting), downs, held: !!(c && c.build && c.build.held && !S.revealed[S.i]) };
    });
    if (s.phase === 'summary') return { ok: true, ms: Date.now() - t0, waits };
    if (s.phase === 'pack') { await p.focus('#pack').catch(() => {}); await p.keyboard.press('Enter'); await p.waitForTimeout(300); continue; }
    if (s.phase === 'fan') { await p.focus('#fan').catch(() => {}); await p.keyboard.press('Enter'); await p.waitForTimeout(300); continue; }
    if (s.phase === 'cards') {
      if (s.busy) { await p.waitForTimeout(60); continue; }
      if (auto && !s.held) { await p.waitForTimeout(80); continue; }
      if (auto && s.held) {
        const key = `stack ${s.bp}:${s.i}`;
        if (key !== lastStop) { lastStop = key; const w = await watchStill(p, autoWait); waits.push({ where: 'stack', key, ...w }); if (onStop) await onStop(p, s); }
      }
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120); continue;
    }
    if (s.phase === 'bulk') {
      if (!s.row || s.building || (s.busy && !s.waiting)) { await p.waitForTimeout(60); continue; }
      if (auto && !s.downs.length) { await p.waitForTimeout(80); continue; }
      if (s.downs.length) {
        const key = `row ${s.bp}:${s.downs[0]}`;
        if (key !== lastStop) { lastStop = key; if (auto) { const w = await watchStill(p, autoWait); waits.push({ where: 'row', key, ...w }); } if (onStop) await onStop(p, s); }
      }
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120); continue;
    }
    await p.waitForTimeout(80);
  }
  return { ok: false, ms: Date.now() - t0, waits };
}
// At a stop in Auto: watch for `ms` that nothing moves on by itself.
async function watchStill(p, ms) {
  const before = await p.evaluate(() => ({ n: window.__pack.log.length, bp: window.__pack.bp, i: window.__pack.i }));
  await p.waitForTimeout(ms);
  const after = await p.evaluate((n) => ({ moved: window.__pack.log.slice(n).filter((e) => ['bulkPack', 'build', 'cardLeft', 'tear'].includes(e.kind)).map((e) => e.kind), bp: window.__pack.bp, i: window.__pack.i, down: !!document.querySelector('.bcard.down, .cslot.down.held') }), before.n);
  return { still: after.moved.length === 0 && after.bp === before.bp && after.i === before.i && after.down, moved: after.moved };
}

async function arm(p, step) {
  const open = await p.evaluate(() => !document.getElementById('dbg-pan').hidden);
  if (!open) await p.click('#dbg-tog');
  await p.click(`#dbg-kinds button[data-step="${step}"]`);
}

for (const vp of [{ name: 'desktop', width: 1280, height: 800, mobile: false }, { name: 'phone', width: 390, height: 844, mobile: true }]) {
  say(`== ${vp.name} ${vp.width}x${vp.height}`);
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: vp.mobile, isMobile: vp.mobile });
  const p = await ctx.newPage();
  const errors = [], requests = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
  await p.goto(pathToFileURL(file).href);
  await p.waitForTimeout(300);
  await p.mouse.click(vp.width - 5, vp.height - 5);
  // Auto off to start (it is remembered per browser; a fresh context has none).
  await p.evaluate(() => { try { localStorage.removeItem('aitcg.packAuto'); } catch (e) {} });

  // 1. The panel.
  const panel = await p.evaluate(() => ({ has: !!document.getElementById('dbg'), hidden: document.getElementById('dbg-pan').hidden, kinds: Array.from(document.querySelectorAll('#dbg-kinds button')).map((x) => x.getAttribute('data-step')), st: document.getElementById('dbg-st').textContent, one: document.getElementById('dbg-one').disabled }));
  ok(panel.has && panel.hidden && JSON.stringify(panel.kinds) === JSON.stringify(STEPS) && panel.one, `panel: on the page, collapsed, kinds ${panel.kinds.join(' ')}, nothing armed ("${panel.st}")`);
  await p.click('#dbg-tog');
  const box = await p.evaluate(() => { const r = document.getElementById('dbg-pan').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
  ok(box.l >= 0 && box.r <= vp.width && box.t >= 0 && box.b <= vp.height, `panel: opened, inside the screen (${Math.round(box.l)}..${Math.round(box.r)} x ${Math.round(box.t)}..${Math.round(box.b)})`);
  await arm(p, 'gold');
  const armed = await p.evaluate(() => ({ force: window.__pack.force, st: document.getElementById('dbg-st').textContent, pressed: document.querySelector('#dbg-kinds button[aria-pressed="true"]')?.getAttribute('data-step') }));
  ok(armed.force === 'gold' && armed.pressed === 'gold' && /Armed: Gold/.test(armed.st), `panel: arming Gold ("${armed.st}")`);
  if (vp.name === 'desktop') await shot(p, 'debug-panel-armed-desktop');
  else await shot(p, 'debug-panel-armed-phone');
  await p.click('#dbg-off');
  ok(await p.evaluate(() => window.__pack.force === null), 'panel: Disarm clears it');

  const singles = vp.mobile ? ['prototype'] : STEPS;
  const tens = vp.mobile ? ['gold'] : STEPS;

  // 2. One pack per kind.
  for (const step of singles) {
    await arm(p, step);
    const n0 = await p.evaluate(() => window.__pack.log.length);
    await p.click('#dbg-one');
    const forced = await p.evaluate((n) => window.__pack.log.slice(n).find((e) => e.kind === 'debugForced'), n0);
    const cards = await p.evaluate(() => window.__pack.cur.cards.map((c) => ({ step: c.build.step, held: c.build.held, name: c.face.name, finish: c.finish })));
    const top = cards.reduce((a, c) => Math.max(a, LADDER.indexOf(c.step)), 0);
    ok(!!forced && forced.step === step && forced.as === 'single' && LADDER[top] === step && (await p.evaluate(() => window.__pack.force)) === null, `one ${step}: forced (seed ${forced ? forced.seed : '?'}), best card ${LADDER[top]}, disarmed`);
    const run = await drive(p);
    const lg = await p.evaluate((n) => window.__pack.log.slice(n), n0);
    const builds = lg.filter((e) => e.kind === 'build').map((e) => e.idx), hits = lg.filter((e) => e.kind === 'hit').map((e) => e.idx), snaps = lg.filter((e) => e.kind === 'snap').map((e) => e.idx);
    const wantHeld = cards.flatMap((c, i) => (c.held ? [i] : [])), wantSnap = cards.flatMap((c, i) => (c.held ? [] : [i]));
    const bestBuild = lg.find((e) => e.kind === 'build' && e.step === step);
    ok(run.ok && JSON.stringify(builds) === JSON.stringify(wantHeld) && JSON.stringify(hits) === JSON.stringify(wantHeld) && JSON.stringify(snaps) === JSON.stringify(wantSnap) && !!bestBuild, `one ${step}: ${cards.map((c) => c.step).join(' · ')}: ${builds.length} build(s) and hit(s), ${snaps.length} snap(s), summary in ${(run.ms / 1000).toFixed(1)} s`);
    if (['prototype', 'zeroDay'].includes(step)) ok(lg.some((e) => e.kind === 'build' && e.step === step && e.takeover === step), `one ${step}: its takeover played`);
    await p.waitForTimeout(200);
  }
  // Disarmed: the picker's pack is the showcase's own.
  {
    const n0 = await p.evaluate(() => window.__pack.log.length);
    await p.click('#picker button[data-pack="0"]');
    const lg = await p.evaluate((n) => window.__pack.log.slice(n), n0);
    const seed = await p.evaluate(() => window.__pack.cur.seed);
    const want = await p.evaluate(() => JSON.parse(document.getElementById('pack-data').textContent).packs[0].reveal.seed);
    ok(!lg.some((e) => e.kind === 'debugForced') && seed === want, `disarmed: the picker's first pack is the showcase's (seed ${seed})`);
  }

  // 3. Open 10 per kind, tapping.
  for (const step of tens) {
    await arm(p, step);
    const n0 = await p.evaluate(() => window.__pack.log.length);
    await p.click('#dbg-ten');
    const info = await p.evaluate((n) => {
      const S = window.__pack, f = S.log.slice(n).find((e) => e.kind === 'debugForced');
      const held = [];
      S.B.packs.forEach((pk, bp) => pk.cards.forEach((c, k) => { if (c.build.held) held.push(bp + ':' + k); }));
      const p1 = S.B.packs[0].cards.reduce((a, c) => Math.max(a, ['snap', 'rare', 'mythic', 'foil', 'fullArt', 'altArt', 'glitch', 'gold', 'secret', 'prototype', 'zeroDay'].indexOf(c.build.step)), 0);
      return { f, held, p1, big: S.B.packs.map((pk) => pk.fullReveal), snaps: S.B.packs.reduce((a, pk) => a + pk.cards.filter((c) => !c.build.held).length, 0) };
    }, n0);
    ok(!!info.f && info.f.step === step && info.f.as === 'bulk' && LADDER[info.p1] === step, `ten ${step}: forced (pack 1 seed ${info.f ? info.f.seed : '?'}), pack 1's best card ${LADDER[info.p1]}; ${info.held.length} stops, ${info.snaps} snaps, big pulls at ${info.big.flatMap((v, i) => (v ? [i + 1] : [])).join(',') || 'none'}`);
    let skipChecked = vp.mobile;
    const run = await drive(p, {
      onStop: async (pg, s) => {
        if (skipChecked || s.phase !== 'bulk') return;
        skipChecked = true;
        const before = await pg.evaluate(() => ({ bp: window.__pack.bp, n: window.__pack.log.length }));
        await pg.click('#bskip');
        await pg.waitForTimeout(200);
        const after = await pg.evaluate((n) => ({ bp: window.__pack.bp, lg: window.__pack.log.slice(n).map((e) => e.kind), down: !!document.querySelector('.bcard.down'), nudge: !!document.querySelector('.bcards.nudge') }), before.n);
        ok(after.bp === before.bp && after.down && after.lg.includes('bulkSkip') && !after.lg.includes('bulkPack') && after.nudge, `ten ${step}: Skip at a stop only points at it (pack ${after.bp + 1} stays, the card stays face down)`);
      },
    });
    const lg = await p.evaluate((n) => window.__pack.log.slice(n), n0);
    const built = lg.filter((e) => e.kind === 'build').map((e) => e.bp + ':' + e.idx);
    const hitN = lg.filter((e) => e.kind === 'hit').length;
    const rowBuilds = lg.filter((e) => e.kind === 'build' && e.where === 'row').length;
    const stops = lg.filter((e) => e.kind === 'stop' && e.where === 'row').length;
    const sum = lg.some((e) => e.kind === 'bulkSummary');
    ok(run.ok && sum && JSON.stringify(built) === JSON.stringify(info.held) && hitN === info.held.length, `ten ${step}: every stop built and hit, in order (${built.length} of ${info.held.length}; ${rowBuilds} in the row, ${built.length - rowBuilds} in a big pull's stack), none on a snap; summary in ${(run.ms / 1000).toFixed(1)} s`);
    ok(stops === rowBuilds, `ten ${step}: each row stop waited face down for its tap (${stops} stop(s) logged for ${rowBuilds} row build(s))`);
    await p.waitForTimeout(200);
  }

  // 4. Auto (desktop: two tens, at 4x).
  if (!vp.mobile) {
    for (const step of ['rare', 'prototype']) {
      await arm(p, step);
      const n0 = await p.evaluate(() => window.__pack.log.length);
      await p.click('#dbg-ten');
      const heldN = await p.evaluate(() => window.__pack.B.packs.reduce((n, pk) => n + pk.cards.filter((c) => c.build.held).length, 0));
      await p.evaluate(() => document.getElementById('bauto').click());
      await p.click('#speed button[data-speed="4"]').catch(() => {});
      let shotTaken = false;
      const run = await drive(p, {
        auto: true, autoWait: 1500,
        onStop: async (pg, s) => {
          if (shotTaken || s.phase !== 'bulk') return;
          shotTaken = true; await shot(pg, `auto-stop-${step}`);
        },
      });
      const lg = await p.evaluate((n) => window.__pack.log.slice(n), n0);
      const still = run.waits.filter((w) => w.still).length;
      ok(run.ok && run.waits.length === heldN && still === run.waits.length, `auto ${step} at 4x: waited untouched at all ${run.waits.length} of ${heldN} stop(s) (${run.waits.filter((w) => w.where === 'stack').length} in a big pull's stack) for 1.5 s each (${still} still${run.waits.filter((w) => !w.still).map((w) => ` ${w.key} moved: ${w.moved.join(',')}`).join('')})`);
      // A row stop's build kept its 1x time: from its build to its hit.
      const rowB = lg.filter((e) => e.kind === 'build' && e.where === 'row');
      const lat = rowB.map((bl) => { const h = lg.find((e) => e.kind === 'hit' && e.t >= bl.t && e.bp === bl.bp); return h ? h.t - bl.t - bl.hitAt : null; }).filter((v) => v !== null);
      ok(lat.length === rowB.length && lat.every((d) => d >= -20), `auto ${step} at 4x: every row stop's hit came no sooner than its 1x time (lateness ${Math.min(...lat)}..${Math.max(...lat)} ms over ${lat.length} stops)`);
      // Between stops it carried on by itself: the packs were torn without a tap.
      const autoTears = lg.filter((e) => e.kind === 'tear' && e.via === 'auto').length;
      ok(autoTears >= 9, `auto ${step}: the packs tore by themselves (${autoTears} auto tears)`);
      await p.evaluate(() => { if (window.__pack.auto) document.getElementById('bauto').click(); });
      await p.waitForTimeout(200);
    }
    // A still of a row stop mid-build, and one of it landed.
    {
      await arm(p, 'glitch');
      await p.click('#dbg-ten');
      await p.focus('#fan'); await p.keyboard.press('Enter');
      await waitFor(p, () => window.__pack.row && window.__pack.row.r && document.querySelector('.bcard.down') && performance.now() >= window.__pack.busyUntil, null, 15000);
      await p.keyboard.press('ArrowRight');
      await waitFor(p, () => window.__pack.log.filter((e) => e.kind === 'glowStage').length && document.querySelector('.bcard.charging'), null, 4000);
      await p.waitForTimeout(250);
      await shot(p, 'row-stop-building');
      await waitFor(p, () => window.__pack.row && !window.__pack.row.building, null, 8000);
      await p.waitForTimeout(150);
      await shot(p, 'row-stop-landed');
    }
  }
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!wide, `${vp.name}: no horizontal scroll`);
  ok(requests.length === 0, `${vp.name}: no network requests (${requests.length})`);
  ok(errors.length === 0, `${vp.name}: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
// (The website never has the panel: render/test/packStops.test.ts renders the
// page with site: true and the data, and finds none.)
await b.close();
say(`${passes} PASS, ${fails} FAIL`);
writeFileSync(resolve(shotDir, 'pack-ceremony-check-s62.txt'), lines.join('\n') + '\n');
process.exit(fails ? 1 : 0);
