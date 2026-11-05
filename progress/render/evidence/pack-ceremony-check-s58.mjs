// Render session 58: the pack opening ceremony, part 1 (the owner's
// 2026-11-06 Season 0 brief, section 3, beats 1 and 2), driven like an owner
// would in a real (headless) Chromium.
//
//   node progress/render/evidence/pack-ceremony-check-s58.mjs [shotDir] [page]
// (page defaults to render/output/pack-opening.html; build it with
// `npm run pack-opening -w render`). At 1280 x 800 and at 390 x 844 (a phone),
// for the showcase's packs No hit, Foil, Full Art, Gold, Prototype and
// Zero-Day:
//   1. the pack: bigger than before (session 57's 230 px cap), the backdrop
//      on the pack's tell rung (its colours computed on the page, not just
//      set), the tell never above the best card; the mouse over the pack
//      leans it (desktop), the same lean whatever the pack holds;
//   2. the tear: a real mouse drag along the strip to about 40% and let go:
//      the tear holds there (the flap peeled to the same place, the hint
//      says so); picked up again from the middle of the strip it carries
//      on from 40%, not from 0; the rip sound runs while dragging (the
//      scrub voice, its level above zero) and foil scraps fly; finished,
//      the burst goes off in the best card's colour (the log's colour is
//      the tell's), bigger for a bigger rung, then the cards rise;
//   3. a tap still tears the whole pack (and still bursts);
//   4. frames: the drag's frame rate measured in software rendering;
//   5. no network requests, no page errors, no horizontal scroll.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const shotDir = resolve(process.argv[2] ?? resolve(ROOT, 'progress/render/evidence'));
const file = resolve(process.argv[3] ?? resolve(ROOT, 'render/output/pack-opening.html'));
mkdirSync(shotDir, { recursive: true });

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
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
const shot = (p, name) => p.screenshot({ path: `${shotDir}/v2-s58-${name}.jpg`, type: 'jpeg', quality: 82 }).catch(() => say(`      (still ${name} timed out)`));
async function waitFor(p, fn, arg, ms = 20000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(40); }
  return false;
}
const PACKS = ['No hit', 'Foil', 'Full Art', 'Gold', 'Prototype', 'Zero-Day'];
const RUNG = ['calm', 'shimmer', 'charged', 'radiant', 'overload'];
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbOf = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map((x) => Math.round(Number(x)));
const near = (a, b2) => a.length === 3 && a.every((v, i) => Math.abs(v - b2[i]) <= 3);

for (const vp of [{ name: 'desktop', width: 1280, height: 800, mobile: false }, { name: 'phone', width: 390, height: 844, mobile: true }]) {
  say(`== ${vp.name} ${vp.width}x${vp.height}`);
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: vp.mobile, isMobile: vp.mobile });
  const p = await ctx.newPage();
  const errors = [], requests = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
  await p.goto(pathToFileURL(file).href);
  await p.waitForTimeout(300);
  const labels = await p.evaluate(() => Array.from(document.querySelectorAll('#picker button[data-pack]')).map((x) => x.textContent));
  const leans = {};
  const bursts = [];
  for (const want of PACKS) {
    const i = labels.findIndex((l) => l.replace(/^\d+\. /, '') === want);
    if (i < 0) { ok(false, `${want}: in the picker`); continue; }
    await p.click(`#picker button[data-pack="${i}"]`);
    await waitFor(p, () => window.__pack.phase === 'pack' && !!document.getElementById('pack'));
    const tell = await p.evaluate(() => window.__pack.cur.tell);
    const slug = want.toLowerCase().replace(/[^a-z]+/g, '-');
    say(` ${want}: best ${tell.best} (rung ${tell.rung} ${RUNG[tell.rung]}), backdrop ${tell.backdrop}${tell.underPromise ? ' (UNDER-PROMISED)' : ''}, burst ${tell.burst.colour}`);
    ok(tell.backdropRung <= tell.rung, `${want}: the backdrop never above the best card (${tell.backdropRung} <= ${tell.rung})`);
    // The backdrop's colours, as the page computes them (after the ease).
    // (The ease is 1.4 s; in software rendering the page runs at about 15 fps, so allow longer.)
    const tm0 = Date.now();
    const settled = await waitFor(p, (c) => {
      const v = getComputedStyle(document.getElementById('bd')).getPropertyValue('--b1').trim();
      const n = parseInt(c.slice(1), 16), want = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      const got = (v.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      return v.toLowerCase() === c || (got.length === 3 && got.every((x, i) => Math.abs(x - want[i]) <= 3));
    }, await p.evaluate((r) => JSON.parse(document.getElementById('pack-timings').textContent).backdrops[r].core, tell.backdrop), 9000);
    say(`      backdrop settled in ${Date.now() - tm0} ms${settled ? '' : ' (not settled)'}`);
    const bd = await p.evaluate(() => { const cs = getComputedStyle(document.getElementById('bd')); return { rung: document.getElementById('bd').getAttribute('data-rung'), b1: cs.getPropertyValue('--b1').trim(), glow: cs.getPropertyValue('--bg2').trim() }; });
    const tm = await p.evaluate(() => JSON.parse(document.getElementById('pack-timings').textContent).backdrops);
    ok(bd.rung === tell.backdrop, `${want}: the backdrop is on rung ${tell.backdrop}`);
    ok(near(rgbOf(bd.b1), hex(tm[tell.backdrop].core)) || bd.b1.toLowerCase() === tm[tell.backdrop].core, `${want}: its core colour computed ${bd.b1} = ${tm[tell.backdrop].core}`);
    const box = await p.evaluate(() => { const r = document.getElementById('pack').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    if (want === 'No hit') ok(box.w > (vp.mobile ? 230 : 280), `the pack is bigger: ${Math.round(box.w)} px wide (was at most 230)`);
    // Hover lean (desktop only; none on touch).
    if (!vp.mobile) {
      await p.mouse.move(box.x + box.w * 0.85, box.y + box.h * 0.75, { steps: 4 });
      await p.waitForTimeout(80);
      leans[want] = await p.evaluate(() => document.querySelector('#pack .lean').style.transform);
    }
    await shot(p, `${vp.name}-sealed-${slug}`);

    if (want === 'Foil' || want === 'No hit') {
      // A tap still tears the whole pack.
      if (vp.mobile) await p.touchscreen.tap(box.x + box.w / 2, box.y + box.h * 0.6);
      else await p.mouse.click(box.x + box.w / 2, box.y + box.h * 0.6);
    } else {
      // The drag: to about 40%, let go, then pick it up again mid-strip.
      const y = box.y + box.h * 0.08, x0 = box.x + box.w * 0.08, cut = box.w * 0.88;
      await p.mouse.move(x0, y);
      await p.mouse.down();
      await p.evaluate(() => { window.__fr = 0; window.__frOn = true; (function f() { if (!window.__frOn) return; window.__fr++; requestAnimationFrame(f); })(); window.__fr0 = performance.now(); });
      await p.mouse.move(x0 + cut * 0.4, y, { steps: 14 });
      const mid = await p.evaluate(() => ({ tear: window.__pack.tear, scrub: window.__sfx ? window.__sfx.stats().byKind.scrub || 0 : 0, alive: document.querySelector('#pack').style.getPropertyValue('--tp') }));
      await shot(p, `${vp.name}-tearing-${slug}`);
      await p.mouse.up();
      await p.waitForTimeout(250);
      const held = await p.evaluate(() => ({ tear: window.__pack.tear, phase: window.__pack.phase, hint: document.getElementById('hint').textContent, tp: getComputedStyle(document.getElementById('pack')).getPropertyValue('--tp').trim(), log: window.__pack.log.filter((e) => e.kind === 'tearHeld' && e.pack === window.__pack.pack).length }));
      ok(Math.abs(held.tear.progress - 0.4) < 0.06, `${want}: the tear follows the mouse: ${Math.round(held.tear.progress * 100)}% after a 40% drag`);
      ok(held.phase === 'pack' && held.log === 1 && /holds at/.test(held.hint), `${want}: let go part way, it holds ("${held.hint}")`);
      ok(Math.abs(Number(held.tp) - held.tear.progress) < 0.01, `${want}: the flap is peeled to the same place (--tp ${held.tp})`);
      ok(held.tear.scraps > 0, `${want}: foil scraps flew off the tear (${held.tear.scraps})`);
      ok(mid.tear.rip === true, `${want}: the rip sound ran while dragging (scrub voices: ${mid.scrub})`);
      await shot(p, `${vp.name}-held-${slug}`);
      // Picked up again from the strip's middle: it carries on from 40%.
      const x1 = box.x + box.w * 0.5;
      await p.mouse.move(x1, y);
      await p.mouse.down();
      await p.mouse.move(x1 + cut * 0.1, y, { steps: 4 });
      const resumed = await p.evaluate(() => window.__pack.tear.progress);
      ok(resumed > 0.45 && resumed < 0.6, `${want}: picked up again, it carries on from 40% (now ${Math.round(resumed * 100)}%)`);
      await p.mouse.move(x1 + cut * 0.7, y, { steps: 16 });
      const fr = await p.evaluate(() => { window.__frOn = false; return { frames: window.__fr, ms: performance.now() - window.__fr0 }; });
      say(`      drag frames: ${fr.frames} in ${Math.round(fr.ms)} ms (${Math.round(fr.frames / (fr.ms / 1000))} fps, software rendering)`);
      await p.mouse.up();
      const peak = await p.evaluate(() => window.__pack.tear.ripPeak);
      ok(peak > 0, `${want}: the rip's level rose with the drag (peak gain ${peak.toFixed(3)})`);
    }
    await waitFor(p, () => window.__pack.log.some((e) => e.kind === 'burst' && e.t > 0 && window.__pack.phase !== 'pack'));
    await p.waitForTimeout(vp.mobile ? 120 : 160);
    await shot(p, `${vp.name}-burst-${slug}`);
    const bl = await p.evaluate(() => { const L = window.__pack.log; return L.filter((e) => e.kind === 'burst').pop(); });
    ok(bl && bl.colour === tell.burst.colour && bl.rung === tell.rung, `${want}: the burst in the best card's colour (${bl && bl.colour}), rung ${bl && bl.rung}`);
    bursts.push({ want, rung: tell.rung, scale: bl ? bl.scale : 0, motes: bl ? bl.motes : 0 });
    const rose = await waitFor(p, () => window.__pack.phase === 'cards' && !!document.getElementById('stack'));
    ok(rose, `${want}: then the cards rise`);
  }
  // The burst grows with the rung.
  const sorted = [...bursts].sort((a, c) => a.rung - c.rung);
  ok(sorted.every((x, i) => i === 0 || x.rung === sorted[i - 1].rung || (x.scale > sorted[i - 1].scale && x.motes > sorted[i - 1].motes)), `the burst grows with the rung: ${sorted.map((x) => `${x.want} r${x.rung} x${x.scale}/${x.motes}`).join(', ')}`);
  if (!vp.mobile) {
    // The same pointer place over each pack: the same lean, give or take the
    // pack's idle bob (the lean reads the pointer against the bobbing box).
    const vals = Object.values(leans).map((v) => (v.match(/-?[\d.]+/g) || []).map(Number));
    const spread = (k) => Math.max(...vals.map((v) => v[k])) - Math.min(...vals.map((v) => v[k]));
    ok(vals.length === PACKS.length && vals.every((v) => v.length === 2 && Math.abs(v[0]) + Math.abs(v[1]) > 1) && spread(0) <= 1 && spread(1) <= 1, `the mouse leans the pack, the same for every pack (${Object.values(leans).join(' / ')})`);
  }
  const scrollW = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  ok(scrollW, 'no horizontal scroll');
  ok(requests.length === 0, `no network requests (${requests.length})`);
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
await b.close();
say(`\n${passes} PASS, ${fails} FAIL`);
writeFileSync(resolve(ROOT, 'progress/render/evidence/pack-ceremony-check-s58.txt'), lines.join('\n') + '\n');
process.exit(fails ? 1 : 0);
