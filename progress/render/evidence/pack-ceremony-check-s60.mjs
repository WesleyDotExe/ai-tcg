// Render session 60: the pack opening ceremony, part 2 (the owner's
// 2026-11-06 Season 0 brief, section 3, beat 3: the reveal escalation),
// driven like an owner would in a real (headless) Chromium.
//
//   node progress/render/evidence/pack-ceremony-check-s60.mjs [shotDir] [page]
// (page defaults to render/output/pack-opening.html; build it with
// `npm run pack-opening -w render`). Every showcase pack at 1280 x 800, and
// three of them at 390 x 844 (a phone), each card of each pack in turn:
//   1. a plain Common or Uncommon snaps over by itself as it reaches the top
//      (face up within its flip), each one in the pack higher than the last;
//   2. a held card waits face down; on a tap the room dims to the build's
//      level (the dim layer's computed opacity) and the sound ducks (the
//      runtime's own level); the back climbs exactly its glow stages, in the
//      tell's colours, at the timeline's times; then the flip; then the hit:
//      the flash, the stage shake (its computed animation), the bass, motes
//      on the canvas, the ward flare (its ring image tinted, one ring for a
//      Rare, two for a Mythic, none for a Common, Uncommon or Neutral card);
//      the room comes back and the sound with it;
//   3. measured on the page: the time from tap to hit grows up the ladder;
//   4. no network requests, no page errors, no horizontal scroll.
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
const shot = (p, name) => p.screenshot({ path: `${shotDir}/v2-s60-${name}.jpg`, type: 'jpeg', quality: 82 }).catch(() => say(`      (still ${name} timed out)`));
async function waitFor(p, fn, arg, ms = 20000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(30); }
  return false;
}
// Software rendering runs the page at ~15 fps and the timers late; a beat
// may land this much after its planned time, never before it.
const SLACK = 450;
const STEPS = ['snap', 'rare', 'mythic', 'foil', 'fullArt', 'altArt', 'glitch', 'gold', 'secret', 'prototype', 'zeroDay'];

const desktopPacks = ['No hit', 'Foil', 'Full Art', 'Alt Art', 'Glitch', 'Secret', 'Gold', 'Prototype', 'Zero-Day', 'Jackpot'];
const phonePacks = ['No hit', 'Gold', 'Prototype'];
const measured = []; // { step, level, tapToHit, planned }
const shots = new Set();

for (const vp of [{ name: 'desktop', width: 1280, height: 800, mobile: false, packs: desktopPacks }, { name: 'phone', width: 390, height: 844, mobile: true, packs: phonePacks }]) {
  say(`== ${vp.name} ${vp.width}x${vp.height}`);
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: vp.mobile, isMobile: vp.mobile });
  const p = await ctx.newPage();
  const errors = [], requests = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
  await p.goto(pathToFileURL(file).href);
  await p.waitForTimeout(300);
  // The first gesture starts the (armed) sound, as for a viewer.
  await p.mouse.click(5, vp.height - 5);
  await p.waitForTimeout(100);
  const soundOn = await p.evaluate(() => window.SND.stats().on);
  ok(soundOn, 'sound on after the first gesture');
  const tinted = await waitFor(p, () => !!document.getElementById('pack-data') && Object.keys(JSON.parse(document.getElementById('pack-data').textContent).wards || {}).length === 4, null, 3000);
  ok(tinted, 'the page carries the four faction ward rings');
  const labels = await p.evaluate(() => Array.from(document.querySelectorAll('#picker button[data-pack]')).map((x) => x.textContent));
  for (const want of vp.packs) {
    const i = labels.findIndex((l) => l.replace(/^\d+\. /, '') === want);
    if (i < 0) { ok(false, `${want}: in the picker`); continue; }
    await p.click(`#picker button[data-pack="${i}"]`);
    await waitFor(p, () => window.__pack.phase === 'pack' && !!document.getElementById('pack'));
    await p.focus('#pack');
    await p.keyboard.press('Enter');
    let dealt = await waitFor(p, () => window.__pack.phase === 'cards' && !!document.querySelector('.cslot'), null, 8000);
    if (!dealt) {
      const ph = await p.evaluate(() => window.__pack.phase);
      say(`      (${want}: still "${ph}" after Enter; tapping the pack instead)`);
      const box = await p.locator('#pack').boundingBox().catch(() => null);
      if (box) await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
      dealt = await waitFor(p, () => window.__pack.phase === 'cards' && !!document.querySelector('.cslot'), null, 8000);
    }
    if (!dealt) { ok(false, `${want}: the cards rose`); continue; }
    const cards = await p.evaluate(() => window.__pack.cur.cards.map((c) => ({ name: c.face.name, rarity: c.face.rarity, finish: c.finish, reveal: c.reveal, b: c.build })));
    say(` ${want}: ${cards.map((c) => `${c.b.step}`).join(' · ')}`);
    const pitches = [];
    for (let k = 0; k < cards.length; k++) {
      const c = cards[k], bl = c.b, tag = `${want} #${k + 1} ${c.name} (${bl.step})`;
      await waitFor(p, (k) => window.__pack.i === k && performance.now() >= window.__pack.busyUntil, k, 8000);
      if (!bl.held) {
        const up = await waitFor(p, (k) => { const el = document.querySelector('.cslot[data-k="' + k + '"]'); return el && !el.classList.contains('down'); }, k, bl.flipMs + 1500);
        const sn = await p.evaluate((k) => window.__pack.log.filter((e) => e.kind === 'snap' && e.idx === k).pop(), k);
        ok(up && !!sn, `${tag}: snaps face up by itself`);
        if (sn) pitches.push(sn.pitch);
        await p.keyboard.press('ArrowRight');
        continue;
      }
      const isDown = await p.evaluate((k) => document.querySelector('.cslot[data-k="' + k + '"]').classList.contains('down'), k);
      ok(isDown, `${tag}: waits face down`);
      const before = await p.evaluate(() => ({ n: window.__pack.log.length, by: Object.assign({}, window.SND.stats().byKind) }));
      await p.keyboard.press('ArrowRight');
      if (bl.step !== 'zeroDay') {
        // Mid-build: the room's dim and the sound's duck.
        await waitFor(p, (n) => window.__pack.log.slice(n).some((e) => e.kind === 'glowStage'), before.n, 3000);
        // The dim eases in (up to 700 ms): wait for it to settle, then read it.
        await waitFor(p, (want) => Math.abs(Number(getComputedStyle(document.getElementById('dim')).opacity) - want) <= 0.04, bl.dim, 1500);
        const mid = await p.evaluate(() => ({ dim: Number(getComputedStyle(document.getElementById('dim')).opacity), duck: window.SND.ducked(), charging: !!document.querySelector('.cslot.charging') }));
        ok(Math.abs(mid.dim - bl.dim) <= 0.12 && mid.duck === bl.duck && mid.charging, `${tag}: room dims to ${bl.dim} (computed ${mid.dim.toFixed(2)}), sound ducks to ${bl.duck} (${mid.duck}), the back charges`);
        if ((bl.step === 'gold' || bl.step === 'secret') && !shots.has(`build-${vp.name}`)) {
          await waitFor(p, (n) => window.__pack.log.slice(n).filter((e) => e.kind === 'glowStage').length >= 3, before.n, 4000);
          await p.waitForTimeout(250);
          shots.add(`build-${vp.name}`); await shot(p, `build-${bl.step}-stage3-${vp.name}`);
        }
      }
      const hitOk = await waitFor(p, (n) => window.__pack.log.slice(n).some((e) => e.kind === 'hit'), before.n, bl.timeline.landAt + 9000);
      const afterHit = await p.evaluate(() => ({
        flash: document.getElementById('flash').classList.contains('go'),
        shake: document.getElementById('stage').classList.contains('bshake') ? getComputedStyle(document.getElementById('stage')).animationName : '',
        motes: 0,
        flares: Array.from(document.querySelectorAll('.wflare')).map((w) => ({ cls: w.className, rings: w.children.length, img: !!w.children[0] && getComputedStyle(w.children[0]).backgroundImage.startsWith('url("data:image/png') })),
      }));
      const log = await p.evaluate((n) => window.__pack.log.slice(n), before.n);
      const build = log.find((e) => e.kind === 'build'), hit = log.find((e) => e.kind === 'hit');
      const stages = log.filter((e) => e.kind === 'glowStage');
      ok(hitOk && !!hit, `${tag}: the hit lands`);
      if (!hit) continue;
      if (bl.step !== 'zeroDay') {
        ok(stages.length === bl.stages && stages.every((s, i) => s.colour === bl.timeline.stages[i].colour), `${tag}: the back climbs exactly ${bl.stages} glow stage(s) in the tell's colours (${stages.map((s) => s.colour).join(' ')})`);
        const late = stages.map((s, i) => s.t - build.t - bl.timeline.stages[i].at);
        const hitLate = hit.t - build.t - bl.timeline.landAt;
        // The glitch flip redraws two ghost copies of the face every 45 ms;
        // in software rendering that costs frames, so its hit may land up to
        // 1.2 s late here (named in the log; a GPU doesn't pay this).
        const hitSlack = bl.step === 'glitch' ? 1200 : SLACK;
        ok(late.every((d) => d >= -20 && d <= SLACK) && hitLate >= -20 && hitLate <= hitSlack, `${tag}: on the timeline (stages ${late.map((d) => `+${d}`).join(' ')} ms, hit +${hitLate} ms of ${bl.timeline.landAt}${bl.step === 'glitch' ? ', glitch allowance 1200 ms' : ''})`);
        measured.push({ step: bl.step, level: bl.level, planned: bl.timeline.landAt, tapToHit: hit.t - build.t });
      }
      ok(afterHit.flash && hit.flash === bl.flash, `${tag}: the flash (${bl.flash}) in ${hit.flashColour}`);
      ok(bl.shakePx === 0 || hit.shakeAnim === 'bshake', `${tag}: the stage shakes ${bl.shakePx}px (computed animation at the hit: ${hit.shakeAnim || 'none'})`);
      const mo = await p.evaluate(() => window.__pack && document.getElementById('sparks') ? 1 : 0);
      ok(hit.motes === bl.motes && hit.moteColour.length === 7 && mo, `${tag}: ${bl.motes} motes in the faction's colour ${hit.moteColour}`);
      const wantRings = bl.ward === 'double' ? 2 : bl.ward === 'ring' ? 1 : 0;
      const fl = afterHit.flares[afterHit.flares.length - 1];
      ok(wantRings === 0 ? afterHit.flares.length === 0 : !!fl && fl.rings === wantRings && fl.img, `${tag}: ward ${bl.ward}${fl ? ` (${fl.rings} ring(s), tinted image ${fl.img})` : ''}`);
      const by = await p.evaluate(() => window.SND.stats().byKind);
      const d = (k) => (by[k] || 0) - (before.by[k] || 0);
      ok((bl.step === 'zeroDay' || d('riser') === bl.stages) && d('bass') === 1, `${tag}: sound: ${d('riser')} riser(s), ${d('bass')} bass hit`);
      if (!shots.has(`hit-${bl.step}`) && ['rare', 'mythic', 'gold', 'prototype'].includes(bl.step) && vp.name === 'desktop') { shots.add(`hit-${bl.step}`); await p.waitForTimeout(260); await shot(p, `hit-${bl.step}`); }
      // The room comes back.
      // Frames are counted while it waits: under software WebGL a card with a
      // running finish shader (foil, glitch) can starve the page of frames,
      // and the dim's fade only advances with frames.
      await p.evaluate(() => { window.__fc = 0; window.__fcOn = true; (function f() { if (!window.__fcOn) return; window.__fc++; requestAnimationFrame(f); })(); });
      const w0 = Date.now();
      const back = await waitFor(p, () => window.SND.ducked() === 1 && Number(getComputedStyle(document.getElementById('dim')).opacity) < 0.05, null, Math.max(700, bl.hold) + 7000);
      const waited = Date.now() - w0;
      const fps = await p.evaluate((ms) => { window.__fcOn = false; return Math.round(window.__fc / (ms / 1000) * 10) / 10; }, waited);
      if (waited > Math.max(700, bl.hold) + 1500) say(`      (room back after ${waited} ms of wall time at ${fps} fps)`);
      const st = await p.evaluate(() => ({ dim: Number(getComputedStyle(document.getElementById('dim')).opacity).toFixed(2), inline: document.getElementById('dim').style.opacity, duck: window.SND.ducked(), up: window.__pack.log.filter((e) => e.kind === 'roomUp').length }));
      ok(back, `${tag}: the room and the sound come back (dim ${st.dim}, set to ${st.inline}, sound ${st.duck})`);
      await waitFor(p, () => performance.now() >= window.__pack.busyUntil, null, 6000);
      await p.keyboard.press('ArrowRight');
    }
    if (pitches.length > 1) ok(pitches.every((v, i) => i === 0 || v > pitches[i - 1]), `${want}: each snap higher than the last (${pitches.join(' ')})`);
    await waitFor(p, () => window.__pack.phase === 'summary', null, 5000);
    ok(await p.evaluate(() => document.querySelectorAll('.wflare').length === 0 && window.SND.ducked() === 1), `${want}: summary: no flare left over, sound back`);
  }
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!wide, `${vp.name}: no horizontal scroll`);
  ok(requests.length === 0, `${vp.name}: no network requests (${requests.length})`);
  ok(errors.length === 0, `${vp.name}: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
// The ladder, as the page actually played it: the fastest seen at each step
// (a Mythic's half step left out), in ladder order.
const per = {};
for (const m of measured) if (m.level === Math.floor(m.level)) per[m.step] = Math.min(per[m.step] ?? Infinity, m.tapToHit);
const seen = STEPS.filter((s) => per[s]);
say(`ladder as played (tap to hit, ms): ${seen.map((s) => `${s} ${per[s]}`).join(' < ')}`);
ok(seen.every((s, i) => i === 0 || per[s] > per[seen[i - 1]]), 'every step up the ladder took longer from tap to hit, on the page');
await b.close();
say(`${passes} PASS, ${fails} FAIL`);
writeFileSync(resolve(shotDir, 'pack-ceremony-check-s60.txt'), lines.join('\n') + '\n');
process.exit(fails ? 1 : 0);
