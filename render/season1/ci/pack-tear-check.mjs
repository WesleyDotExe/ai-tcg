// The opening's grip and tear after the pick, in headless Chromium (render
// session 96; the owner's 2026-11-28 entry, points 6-9, and FLASH.md's
// storyboard beats 2-4). Loads render/season1/output/pack-pick.html (built by
// season1/mockup/buildPacks.ts) and checks:
//
// The row (point 6, 7): no arrows and no "Pick this pack" under the row, no
// "Back to the row" after a pick; the keyboard still works with nothing drawn
// for it (arrows move, Enter picks, the focus ring shows); a pick is final
// (keys, taps and drags no longer move the row).
// The tear (points 8, 9), on a desktop (1280, a mouse) and a phone (390, real
// touch events, so the browser's own touch-action rules apply):
//   - the grab zone is the pack's top band (a quarter of its height, the crimp
//     included) plus a margin above and to each side, at least 48 px tall on
//     the phone;
//   - drags that start off-centre, in the margin above or beside the pack, at
//     a slant, crooked, either way, each about a third of the pack's width,
//     all tear and open the pack;
//   - a tap or click in the zone tears (the 600 ms tear), and so does Enter;
//   - a drag that starts lower on the pack, a short drag, and a tap below the
//     zone don't (a short drag leaves the cut part-way, and the next drag
//     carries on from there);
//   - the cue shows where to tear until the first tear, then goes.
// The grip and the tell: held, the pack trembles harder the longer it is
// held and leans to the finger; for a hit (?best=gold) the top seam glows in
// the tell's colour, for a plain pack it doesn't; the reduced-flash setting
// lowers it. The open: the strip flies off, the stack rises, the pick event
// carried only the slot. Reduced motion: no tremble, no scraps, still opens.
// Fails on any miss. Writes check.txt and stills to
// progress/render/evidence/season1-pack-tear-s96/ (or the folder given).
//
//   node render/season1/ci/pack-tear-check.mjs [outDir]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const season1 = resolve(here, '..');
const out = resolve(process.argv[2] ?? join(season1, '../../progress/render/evidence/season1-pack-tear-s96'));
mkdirSync(out, { recursive: true });
const { loadChromium } = await import(pathToFileURL(resolve(season1, '../ci/pw.mjs')).href);
const chromium = await loadChromium();
const browser = await chromium.launch();
const url = (q = '') => pathToFileURL(join(season1, 'output', 'pack-pick.html')).href + q;

const lines = [];
let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) pass++; else fail++; lines.push(`${cond ? 'PASS' : 'FAIL'} ${what}`); return cond; };
const note = (s) => lines.push(`     ${s}`);

const DESK = { width: 1280, height: 900 }, PHONE = { width: 390, height: 844 };

async function open(q, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.phone ? PHONE : DESK, deviceScaleFactor: 1, reducedMotion: opts.reduce ? 'reduce' : 'no-preference', hasTouch: !!opts.phone, isMobile: !!opts.phone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url(q));
  await page.waitForTimeout(400);
  const cdp = opts.phone ? await ctx.newCDPSession(page) : null;
  return { ctx, page, errors, cdp };
}
const settle = (page) => page.waitForFunction(() => { const S = window.__row; return Math.abs(S.pos - S.target) < 1e-6 && S.vel === 0 && !S.dragging; }, null, { timeout: 4000 }).then(() => true, () => false);
const O = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__open)));
const packBox = (page) => page.evaluate(() => { const r = document.querySelector('.slot.chosen .pw').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });

// One gesture, by mouse or by real touch events (CDP), through `pts` (screen px), `stepMs` apart.
async function gesture(g, pts, { holdMs = 0, stepMs = 16 } = {}) {
  const { page, cdp } = g;
  if (cdp) {
    const tp = (p) => [{ x: p.x, y: p.y, id: 1, radiusX: 6, radiusY: 6, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts[0]) });
    if (holdMs) await page.waitForTimeout(holdMs);
    for (const p of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p) }); await page.waitForTimeout(stepMs); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
    if (holdMs) await page.waitForTimeout(holdMs);
    for (const p of pts.slice(1)) { await page.mouse.move(p.x, p.y); await page.waitForTimeout(stepMs); }
    await page.mouse.up();
  }
}
const line = (a, b, n = 10) => Array.from({ length: n + 1 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }));
const crooked = (a, b, n = 12, wob = 10) => line(a, b, n).map((p, k) => ({ x: p.x, y: p.y + (k % 2 ? wob : -wob) * (k > 0 && k < n ? 1 : 0) }));

async function pickCentre(g) {
  const { page } = g;
  await settle(page);
  const c = await page.evaluate(() => { const r = document.querySelector('.slot[aria-selected]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (g.cdp) { await page.touchscreen.tap(c.x, c.y); } else await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(700); // the lift (500 ms) has finished
  return packBox(page);
}

// ---------- the row: no buttons; the keyboard still works; a pick is final ----------
{
  const g = await open('?design=crest');
  const { page, errors } = g;
  const btns = await page.evaluate(() => [...document.querySelectorAll('main button:not([hidden])')].map((b) => b.textContent.trim()));
  const ids = await page.evaluate(() => ['prev', 'next', 'choose', 'again'].filter((id) => document.getElementById(id)));
  ok(!btns.length && !ids.length && !/Pick this pack|Back to the row/.test(await page.content()), `row: no arrows, no "Pick this pack" and no "Back to the row" on the page (buttons shown: ${JSON.stringify(btns)})`);
  await settle(page);
  await page.focus('#pick');
  const ring = await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('pick')); return { focus: document.activeElement.id, outline: cs.outlineStyle, w: cs.outlineWidth }; });
  await page.keyboard.press('ArrowRight'); await settle(page);
  let pos = await page.evaluate(() => window.__row.pos);
  ok(pos === 4, `row, keyboard: ArrowRight moves one pack with nothing drawn for it (${pos})`);
  await page.keyboard.press('ArrowLeft'); await settle(page);
  pos = await page.evaluate(() => window.__row.pos);
  ok(pos === 3, `row, keyboard: ArrowLeft moves back (${pos})`);
  await page.screenshot({ path: join(out, 'row-keyboard-focus.jpg'), type: 'jpeg', quality: 85 });
  const ringShot = await page.evaluate(() => document.getElementById('pick').matches(':focus-visible'));
  ok(ring.focus === 'pick', `row, keyboard: the row takes focus (${ring.focus}; :focus-visible ${ringShot}, outline ${ring.outline} ${ring.w})`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  const st = await page.evaluate(() => ({ picked: window.__row.picked, events: window.__row.events, phase: window.__open.phase }));
  ok(st.picked === 3 && st.events.length === 1 && JSON.stringify(st.events[0]) === '{"slot":3}' && st.phase === 'held', `row, keyboard: Enter picks the centre pack; the pick event carries only its slot (${JSON.stringify(st.events)}); the pack is held, waiting for the tear`);
  await page.keyboard.press('ArrowRight'); await page.mouse.wheel(0, 200); await page.waitForTimeout(400);
  await page.mouse.click(1180, 450); await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ pos: window.__row.pos, picked: window.__row.picked, cls: document.getElementById('pick').classList.contains('picked'), btn: [...document.querySelectorAll('main button:not([hidden])')].length }));
  ok(after.pos === 3 && after.picked === 3 && after.cls && after.btn === 0, `row: a pick is final: keys, the wheel and a tap beside the pack don't move the row or undo the pick, and nothing offers to go back (pos ${after.pos}, picked ${after.picked})`);
  const cue = await page.evaluate(() => { const c = document.querySelector('.slot.chosen .tearcue'); const r = c.getBoundingClientRect(); const p = document.querySelector('.slot.chosen .pw').getBoundingClientRect(); return { shown: getComputedStyle(c).opacity, top: r.top - p.top, h: p.height, w: r.width / p.width }; });
  ok(+cue.shown > 0.9 && cue.top < cue.h * 0.12 && cue.w > 0.85, `cue: before the tear a cue runs along the pack's top (opacity ${cue.shown}, ${Math.round(cue.top)} px below the top of a ${Math.round(cue.h)} px pack, ${Math.round(cue.w * 100)}% of its width)`);
  const note1 = await page.evaluate(() => document.getElementById('note').textContent);
  note(`the line under the pack: "${note1}"`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(2600);
  const o = await O(page);
  ok(o.phase === 'opened' && o.events[0].torn === 'key', `keyboard: Enter on the picked pack tears it and the opening runs to the stack (${o.phase}, ${JSON.stringify(o.events)})`);
  ok(!errors.length, `row and keyboard: no page error${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await g.ctx.close();
}

// ---------- the zone and the drags, desktop and phone ----------
const DRAGS = [
  // [name, start (share of the pack's box; y < 0 is above it, x < 0 / > 1 beside it), move (share of the pack's width: dx, dy), crooked?]
  ['left of centre in the crimp, straight right', [0.15, 0.04], [0.36, 0], false],
  ['right of centre under the crimp, straight left', [0.85, 0.12], [-0.36, 0], false],
  ['the centre, slanted down-right (30°)', [0.5, 0.08], [0.31, 0.18], false],
  ['near the left edge, slanted up-right (45°)', [0.05, 0.22], [0.26, -0.26], false],
  ['in the margin above the pack, right', [0.4, -0.08], [0.36, 0], false],
  ['in the margin left of the pack, right', [-0.08, 0.1], [0.36, 0.05], false],
  ['in the margin right of the pack, slanted left', [1.08, 0.06], [-0.3, 0.2], false],
  ['at the band\'s lower edge (24%), crooked, right', [0.3, 0.235], [0.38, 0], true],
  ['straight down from the top', [0.5, 0.05], [0, 0.36], false],
];

for (const dev of ['desktop', 'phone']) {
  const phone = dev === 'phone';
  // zone geometry
  {
    const g = await open('?design=crest', { phone });
    const b = await pickCentre(g);
    // the page computes the zone at the gesture: press and release beside everything to read it
    const z = await g.page.evaluate(({ b, phone }) => tearZone({ left: b.l, top: b.t, width: b.w, height: b.h }, phone), { b, phone });
    const tall = z.bottom - b.t;
    ok(tall >= b.h * 0.25 - 0.5 && (!phone || z.bottom - z.top >= 48) && b.t - z.top >= 16 && b.l - z.left >= 16 && z.right - (b.l + b.w) >= 16,
      `${dev}: the grab zone is the top ${Math.round((tall / b.h) * 100)}% of the pack (${Math.round(tall)} px of ${Math.round(b.h)}) plus ${Math.round(b.t - z.top)} px above and ${Math.round(b.l - z.left)} px each side: ${Math.round(z.right - z.left)} x ${Math.round(z.bottom - z.top)} px${phone ? ' (48 px or more)' : ''}`);
    await g.page.screenshot({ path: join(out, `${dev}-picked-cue.jpg`), type: 'jpeg', quality: 85 });
    await g.ctx.close();
  }
  for (const [name, [sx, sy], [mx, my], wob] of DRAGS) {
    const g = await open('?design=crest&best=gold', { phone });
    const b = await pickCentre(g);
    const a = { x: b.l + sx * b.w, y: b.t + sy * b.h }, e = { x: a.x + mx * b.w, y: a.y + my * b.w };
    await gesture(g, wob ? crooked(a, e) : line(a, e));
    await g.page.waitForTimeout(1900);
    const o = await O(g.page);
    const cueGone = await g.page.evaluate(() => document.querySelector('.slot.chosen .tearcue').classList.contains('gone'));
    ok(o.phase === 'opened' && o.events[0]?.torn === 'drag' && cueGone, `${dev}: a drag ${name} (${Math.round(Math.hypot(mx, my) * b.w)} px) tears the pack open (${o.phase}; the cut ran ${o.dir > 0 ? 'left to right' : 'right to left'}; the cue gone: ${cueGone})${g.errors.length ? ` errors: ${g.errors.join(' | ')}` : ''}`);
    if (name.startsWith('the centre, slanted')) await g.page.screenshot({ path: join(out, `${dev}-opened.jpg`), type: 'jpeg', quality: 85 });
    await g.ctx.close();
  }
  // a tap in the zone; a tap below it; a drag that starts lower; a short drag then another
  {
    const g = await open('?design=crest', { phone });
    const b = await pickCentre(g);
    const p = { x: b.l + b.w * 0.5, y: b.t + b.h * 0.6 };
    await gesture(g, [p]); await g.page.waitForTimeout(400);
    let o = await O(g.page);
    ok(o.phase === 'held' && o.tears === 0, `${dev}: a tap low on the pack (60% down) doesn't tear (${o.phase}); the cue nudges instead`);
    const low = { x: b.l + b.w * 0.2, y: b.t + b.h * 0.45 };
    await gesture(g, line(low, { x: low.x + b.w * 0.5, y: low.y }));
    await g.page.waitForTimeout(300);
    o = await O(g.page);
    ok(o.tears === 0 && o.cut === 0, `${dev}: a drag that starts 45% down the pack, outside the zone, doesn't tear (cut ${o.cut})`);
    const s1 = { x: b.l + b.w * 0.2, y: b.t + b.h * 0.08 };
    await gesture(g, line(s1, { x: s1.x + b.w * 0.18, y: s1.y }, 6));
    await g.page.waitForTimeout(300);
    o = await O(g.page);
    const part = o.cut;
    ok(o.phase === 'tearing' && o.tears === 0 && part > 0.2 && part < 0.6, `${dev}: a short drag (18% of the width) cuts part-way and stops there (cut ${Math.round(part * 100)}% across, not open)`);
    await g.page.screenshot({ path: join(out, `${dev}-part-torn.jpg`), type: 'jpeg', quality: 85 });
    await gesture(g, line({ x: s1.x + b.w * 0.2, y: s1.y }, { x: s1.x + b.w * 0.4, y: s1.y }, 6));
    await g.page.waitForTimeout(1900);
    o = await O(g.page);
    ok(o.phase === 'opened' && o.tears === 1, `${dev}: the next drag carries on from the part-torn cut (another 20% of the width) and opens it (${o.phase})`);
    ok(!g.errors.length, `${dev}: no page error${g.errors.length ? `: ${g.errors.join(' | ')}` : ''}`);
    await g.ctx.close();
  }
  for (const [where, sx, sy] of [['on the crimp', 0.7, 0.03], ['in the margin above the pack', 0.3, -0.06]]) {
    const g = await open('?design=crest', { phone });
    const b = await pickCentre(g);
    const t0 = Date.now();
    await gesture(g, [{ x: b.l + b.w * sx, y: b.t + b.h * sy }]);
    await g.page.waitForFunction(() => window.__open.tears > 0, null, { timeout: 3000 }).catch(() => {});
    const ms = Date.now() - t0;
    await g.page.waitForTimeout(1900);
    const o = await O(g.page);
    ok(o.phase === 'opened' && o.events[0]?.torn === 'tap', `${dev}: a ${phone ? 'tap' : 'click'} ${where} tears by itself (torn about ${ms} ms after the tap: the 600 ms tear; ${o.phase})`);
    await g.ctx.close();
  }
}

// ---------- the grip and the tell ----------
{
  const g = await open('?design=crest&best=gold');
  const { page } = g;
  const b = await pickCentre(g);
  const P = { x: b.l + b.w * 0.75, y: b.t + b.h * 0.6 };
  await page.mouse.move(P.x, P.y); await page.mouse.down();
  const amp = async (ms) => page.evaluate((ms) => new Promise((res) => { const pw = document.querySelector('.slot.chosen .pw'); let m = 0; const t0 = performance.now(); const f = () => { m = Math.max(m, Math.abs(parseFloat(pw.style.getPropertyValue('--shx')) || 0)); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(m); }; f(); }), ms);
  const early = await amp(250);
  await page.waitForTimeout(900);
  const late = await amp(300);
  const lean = await page.evaluate(() => parseFloat(document.querySelector('.slot.chosen .pw').style.getPropertyValue('--lean')));
  const seam = await page.evaluate(() => ({ op: +getComputedStyle(document.querySelector('.slot.chosen .seam')).opacity, col: getComputedStyle(document.querySelector('.slot.chosen .ov')).getPropertyValue('--tell').trim() }));
  await page.screenshot({ path: join(out, 'grip-gold.jpg'), type: 'jpeg', quality: 85 });
  await page.mouse.up(); await page.waitForTimeout(300);
  const o = await O(page);
  ok(late > early * 2 && late > 2 && early < 1.5, `grip: held, the pack trembles harder the longer it is held (the first 250 ms up to ${early.toFixed(2)} px, after 1.2 s up to ${late.toFixed(2)} px)`);
  ok(lean > 0.5, `grip: it leans toward the finger (a finger right of centre: ${lean.toFixed(2)}°)`);
  ok(seam.op > 0.7 && /ffcf6a/i.test(seam.col), `the tell: for a hit (a Gold) the top seam glows in the tell's colour (${seam.col}, opacity ${seam.op})`);
  ok(o.phase === 'held' && o.tears === 0, `grip: letting go low on the pack doesn't tear it (${o.phase})`);
  await g.ctx.close();
}
for (const [q, what, test] of [['?best=plain', 'a plain pack', (op) => op === 0], ['?best=gold&flash=reduced', 'a Gold with Reduce flashing on', (op) => op > 0 && op <= 0.25]]) {
  const g = await open('?design=crest&' + q.slice(1));
  const b = await pickCentre(g);
  await g.page.mouse.move(b.l + b.w / 2, b.t + b.h * 0.6); await g.page.mouse.down(); await g.page.waitForTimeout(800);
  const op = await g.page.evaluate(() => +getComputedStyle(document.querySelector('.slot.chosen .seam')).opacity);
  await g.page.mouse.up();
  ok(test(op), `the tell: ${what}: the seam's glow is ${op} (${what === 'a plain pack' ? 'none: only a hit glows' : 'under the reduced-flash ceiling'})`);
  await g.ctx.close();
}

// ---------- the open and the tear's moments, as stills ----------
{
  const g = await open('?design=crest&best=gold');
  const { page } = g;
  const b = await pickCentre(g);
  const a = { x: b.l + b.w * 0.12, y: b.t + b.h * 0.07 };
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let k = 1; k <= 6; k++) { await page.mouse.move(a.x + k * b.w * 0.035, a.y + k * 1.5); await page.waitForTimeout(40); }
  await page.screenshot({ path: join(out, 'tear-midway-gold.jpg'), type: 'jpeg', quality: 88 });
  const mid = await O(page);
  for (let k = 7; k <= 12; k++) { await page.mouse.move(a.x + k * b.w * 0.035, a.y + k * 1.5); await page.waitForTimeout(30); }
  await page.mouse.up();
  await page.waitForTimeout(520);
  await page.screenshot({ path: join(out, 'open-strip-flies-gold.jpg'), type: 'jpeg', quality: 88 });
  const strip = await page.evaluate(() => { const s = document.querySelector('.slot.chosen .pw.strip'); return s ? { clip: s.style.clipPath.slice(0, 20), live: s.hasAttribute('data-live') } : null; });
  await page.waitForTimeout(1300);
  await page.screenshot({ path: join(out, 'opened-stack-gold.jpg'), type: 'jpeg', quality: 88 });
  const o = await O(page);
  const stack = await page.evaluate(() => { const s = document.querySelector('.slot.chosen .stack'); const r = s.getBoundingClientRect(); return { n: s.querySelectorAll('.back').length, top: r.top, bottom: r.bottom, pickTop: document.getElementById('pick').getBoundingClientRect().top }; });
  ok(mid.phase === 'tearing' && mid.scraps > 0 && mid.cut > 0.2 && mid.cut < 1, `tear: midway the cut follows the finger (${Math.round(mid.cut * 100)}% across) with scraps thrown off its head (${mid.scraps})`);
  ok(!!strip && /polygon/.test(strip.clip) && !strip.live, `open: the strip above the torn edge comes away as its own piece and flies off (${JSON.stringify(strip)})`);
  ok(o.phase === 'opened' && stack.n === 5 && stack.top >= stack.pickTop, `open: five cards rise out as a stack, backs up, and settle on screen (stack top ${Math.round(stack.top)} px, the stage's top ${Math.round(stack.pickTop)} px)`);
  ok(!g.errors.length, `open: no page error${g.errors.length ? `: ${g.errors.join(' | ')}` : ''}`);
  await g.ctx.close();
}

// ---------- reduced motion ----------
{
  const g = await open('?design=crest&best=gold', { reduce: true });
  const { page } = g;
  const b = await pickCentre(g);
  await page.mouse.move(b.l + b.w * 0.6, b.t + b.h * 0.6); await page.mouse.down(); await page.waitForTimeout(900);
  const sh = await page.evaluate(() => { const pw = document.querySelector('.slot.chosen .pw'); return [pw.style.getPropertyValue('--shx') || '0px', pw.style.getPropertyValue('--lean') || '0deg']; });
  await page.mouse.up();
  const a = { x: b.l + b.w * 0.2, y: b.t + b.h * 0.08 };
  await gesture(g, line(a, { x: a.x + b.w * 0.4, y: a.y }));
  await page.waitForTimeout(900);
  const o = await O(page);
  ok(parseFloat(sh[0]) === 0 && parseFloat(sh[1]) === 0 && o.scraps === 0 && o.phase === 'opened', `reduced motion: no tremble and no lean (${sh.join(', ')}), no scraps (${o.scraps}), and the drag still tears it open (${o.phase})`);
  await g.ctx.close();
}

await browser.close();
lines.unshift(`Season 1 pack opening, the grip and the tear (render session 96): ${pass} PASS, ${fail} FAIL`, '');
writeFileSync(join(out, 'check.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
process.exitCode = fail ? 1 : 0;
