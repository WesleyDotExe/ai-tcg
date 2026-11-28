// The Season 1 pack wrappers and the pick row, in headless Chromium (render
// session 95). Loads render/season1/output/pack-wrappers.html and
// pack-pick.html (built by season1/mockup/buildPacks.ts) and checks:
//
// The wrappers (desktop 1440 and a phone, 390):
//   - three designs, each large, in the four covers and at the Store's sizes;
//     no page error, no sideways scroll on the phone;
//   - every pack's print (wordmark, season line, title, symbol) sits inside
//     the face's safe area (inside the crimps), each piece of text inside its
//     own region (nothing runs past it), no two pieces of print overlapping;
//   - "Set name" is the title, "Season 1" and "S1-01" are there (packs 150 px
//     and up), the wordmark reads AI·TCG;
//   - text size: on a pack 150 px or wider all print draws at 6.5 px or more;
//     on a smaller one the title still does (the rest is the picture);
//   - text contrast measured from the pixels on the three large packs at three
//     light positions (left, centre, right): each text's glyph cores (the
//     pixels the text lifts most, shot with and without it) against the
//     median of the pixels in its box it doesn't lift (its own halo
//     included): 4.5:1, or 3:1 for large text (WCAG);
//   - the light: left alone it sweeps (the highlight moves within a second);
//     with a pointer over a pack it follows the pointer (the pack turns toward
//     the side the pointer is on); with reduced motion it holds the still
//     pose and two shots 1.5 s apart are the same pixels.
// The pick row (each design; desktop 1280 and a phone):
//   - seven packs, the centre one largest and in front, each neighbour smaller
//     and dimmer, the far ones smaller again; the centre pack alone is live;
//   - before the pick, the page holds nothing that tells one pack from
//     another: every slot's pack is the same markup (the light's inline pose
//     aside), and the page has no seed, card or odds line;
//   - the arrow keys, the wheel, a tap on a side pack and a drag (with its
//     fling and snap) each move the row and settle on a whole pack;
//   - a tap on the centre pack (and Enter) picks it: one pick event with only
//     its slot number, the pack lifts (higher and larger), the rest fade;
//     nothing offers to go back (render 96: a pick is final);
//   - with reduced motion a key moves the row at once (no easing).
// Fails on any miss. Writes check.txt and stills to
// progress/render/evidence/season1-pack-wrappers-s95/ (or the folder given).
//
//   node render/season1/ci/pack-wrapper-check.mjs [outDir]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const season1 = resolve(here, '..');
const out = resolve(process.argv[2] ?? join(season1, '../../progress/render/evidence/season1-pack-wrappers-s96'));
mkdirSync(out, { recursive: true });
const { loadChromium } = await import(pathToFileURL(resolve(season1, '../ci/pw.mjs')).href);
const chromium = await loadChromium();
const browser = await chromium.launch();
const url = (f, q = '') => pathToFileURL(join(season1, 'output', f)).href + q;

const lines = [];
let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) pass++; else fail++; lines.push(`${cond ? 'PASS' : 'FAIL'} ${what}`); return cond; };
const note = (s) => lines.push(`     ${s}`);

const SAFE = { x: 6, y: 12, w: 88, h: 136 }; // packWrapper.ts SAFE, pack units of 100 x 160

async function open(file, q, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: opts.reduce ? 'reduce' : 'no-preference', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url(file, q));
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

// ---------- the wrappers: layout ----------

async function layout(page, label) {
  const res = await page.evaluate(({ SAFE }) => {
    const out = [];
    for (const pw of document.querySelectorAll('.pw')) {
      const face = pw.querySelector('.face').getBoundingClientRect();
      const u = face.width / 100;
      const kind = pw.hasAttribute('data-hero') ? 'large' : pw.hasAttribute('data-cover') ? 'cover' : 'size';
      const who = `${pw.dataset.design} ${pw.dataset.mascot} ${Math.round(face.width)} px (${kind})`;
      const regions = {};
      for (const rg of pw.querySelectorAll('.rg')) {
        const r = rg.getBoundingClientRect();
        const inner = rg.firstElementChild?.getBoundingClientRect();
        const rel = { x: (r.left - face.left) / u, y: (r.top - face.top) / u, w: r.width / u, h: r.height / u };
        const fs = rg.firstElementChild ? parseFloat(getComputedStyle(rg.firstElementChild).fontSize) : 0;
        regions[rg.dataset.region] = { rel, box: { l: r.left, t: r.top, r: r.right, b: r.bottom }, inner: inner && { l: inner.left, t: inner.top, r: inner.right, b: inner.bottom }, text: rg.textContent.trim(), fs };
      }
      out.push({ who, width: face.width, regions });
    }
    return out;
  }, { SAFE });
  let worstFit = '', small = [], unsafe = [], overlap = [], missing = [];
  for (const p of res) {
    const R = p.regions;
    const print = ['wordmark', 'season', 'title', 'symbol'].filter((k) => R[k]);
    for (const k of print) {
      const q = R[k].rel;
      if (q.x < SAFE.x - 0.3 || q.y < SAFE.y - 0.3 || q.x + q.w > SAFE.x + SAFE.w + 0.3 || q.y + q.h > SAFE.y + SAFE.h + 0.3) unsafe.push(`${p.who} ${k}`);
      const i = R[k].inner, b = R[k].box;
      if (k !== 'symbol' && i && (i.l < b.l - 0.5 || i.r > b.r + 0.5)) worstFit += `${p.who} ${k} runs ${Math.round(Math.max(b.l - i.l, i.r - b.r))} px past its region; `;
      if (k !== 'symbol' && (p.width >= 150 || k === 'title') && R[k].fs < 6.5) small.push(`${p.who} ${k} ${R[k].fs.toFixed(1)} px`);
    }
    for (let a = 0; a < print.length; a++) for (let c = a + 1; c < print.length; c++) {
      const A = R[print[a]].box, B = R[print[c]].box;
      if (A.r > B.l + 0.5 && B.r > A.l + 0.5 && A.b > B.t + 0.5 && B.b > A.t + 0.5) overlap.push(`${p.who} ${print[a]}/${print[c]}`);
    }
    if (R.title?.text !== 'Set name') missing.push(`${p.who} title "${R.title?.text}"`);
    if (R.wordmark?.text !== 'AI·TCG') missing.push(`${p.who} wordmark "${R.wordmark?.text}"`);
    if (p.width >= 150 && R.season?.text.replace(/\s+/g, ' ') !== 'Season 1 · S1-01') missing.push(`${p.who} season "${R.season?.text}"`);
    if (!R.symbol) missing.push(`${p.who} symbol`);
  }
  ok(res.length === 24, `${label}: 24 packs drawn (3 large, 12 covers, 9 at the Store's sizes): ${res.length}`);
  ok(!unsafe.length, `${label}: all print inside the safe area, clear of the crimps${unsafe.length ? `: ${unsafe.slice(0, 4).join('; ')}` : ''}`);
  ok(!worstFit, `${label}: every text inside its own region${worstFit ? `: ${worstFit.slice(0, 300)}` : ''}`);
  ok(!overlap.length, `${label}: no two pieces of print overlap${overlap.length ? `: ${overlap.slice(0, 4).join('; ')}` : ''}`);
  ok(!missing.length, `${label}: every pack: the wordmark AI·TCG, the title "Set name", the symbol; "Season 1 · S1-01" from 150 px${missing.length ? `: ${missing.slice(0, 4).join('; ')}` : ''}`);
  ok(!small.length, `${label}: print at 6.5 px or more where it is shown (the title at every size)${small.length ? `: ${small.slice(0, 4).join('; ')}` : ''}`);
  const smallest = res.filter((p) => p.width < 70)[0];
  if (smallest) note(`smallest pack ${Math.round(smallest.width)} px: title ${smallest.regions.title.fs.toFixed(1)} px, wordmark ${smallest.regions.wordmark.fs.toFixed(1)} px (a picture at this size; the Store tile names it in text)`);
}

// ---------- the wrappers: contrast from the pixels ----------

async function contrastOf(page) {
  await page.addStyleTag({ content: '.__nt .rg > span { visibility: hidden !important; }' });
  const packs = await page.$$('.pw[data-hero]');
  const rows = [];
  for (const pw of packs) {
    const design = await pw.getAttribute('data-design');
    for (const [where, px] of [['light left', -1], ['light centre', 0], ['light right', 1]]) {
      await pw.evaluate((el, px) => applyLight(el, lightAt({ mode: 'pointer', px, py: -0.2 })), px);
      await page.waitForTimeout(350); // the turn's transition
      const regions = await pw.evaluate((el) => {
        const o = el.getBoundingClientRect();
        return [...el.querySelectorAll('.rg > span')].map((s) => {
          const r = s.getBoundingClientRect(), cs = getComputedStyle(s);
          return { id: s.parentElement.dataset.region, x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, fs: parseFloat(cs.fontSize), fw: parseInt(cs.fontWeight, 10) };
        });
      });
      const a = (await pw.screenshot({ type: 'png' })).toString('base64');
      await pw.evaluate((el) => el.classList.add('__nt'));
      const b = (await pw.screenshot({ type: 'png' })).toString('base64');
      await pw.evaluate((el) => el.classList.remove('__nt'));
      const res = await page.evaluate(async ({ a, b, regions }) => {
        const load = async (src) => { const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g; };
        const ga = await load(a), gb = await load(b);
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const L = (d, i) => 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
        return regions.map((r) => {
          const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y)), w = Math.max(1, Math.ceil(r.w)), h = Math.max(1, Math.ceil(r.h));
          const da = ga.getImageData(x, y, w, h).data, db = gb.getImageData(x, y, w, h).data;
          const px = [];
          for (let i = 0; i < da.length; i += 4) { const la = L(da, i), lb = L(db, i); px.push({ la, lb, d: Math.abs(la - lb) }); }
          // The text is light on a dark pack. Its glyph cores: the third of
          // the pixels the text lifts the most. Its background: the pixels in
          // the text's box the text does not lift (with the text's own dark
          // halo, which is what the eye reads it against), their median.
          const up = px.filter((p) => p.la - p.lb > 0.02).sort((p, q) => (q.la - q.lb) - (p.la - p.lb));
          const core = up.slice(0, Math.max(4, Math.floor(up.length / 3)));
          const back = px.filter((p) => p.la - p.lb <= 0.02).map((p) => p.la).sort((p, q) => p - q);
          const fg = core.reduce((s, p) => s + p.la, 0) / core.length, bg = back.length ? back[Math.floor(back.length / 2)] : 0;
          return { id: r.id, cr: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), large: r.fs >= 24 || (r.fs >= 18.66 && r.fw >= 700), fs: r.fs };
        });
      }, { a, b, regions });
      for (const r of res) rows.push({ design, where, ...r });
    }
    await pw.evaluate((el) => applyLight(el, lightAt({ mode: 'still' })));
  }
  return rows;
}

// ---------- the wrappers ----------

{
  const { ctx, page, errors } = await open('pack-wrappers.html', '?light=still');
  await layout(page, 'wrappers, 1440');
  const rows = await contrastOf(page);
  const low = rows.filter((r) => r.cr < (r.large ? 3 : 4.5));
  ok(!low.length, `wrappers: text contrast from the pixels on the three large packs at three light positions, 4.5:1 (3:1 large): ${low.length ? low.map((r) => `${r.design} ${r.id} ${r.where} ${r.cr.toFixed(2)}`).join('; ') : 'all meet it'}`);
  for (const d of ['crest', 'window', 'bleed']) {
    const mine = rows.filter((r) => r.design === d);
    note(`${d}: ${['wordmark', 'season', 'title'].map((id) => { const m = mine.filter((r) => r.id === id); return `${id} lowest ${Math.min(...m.map((r) => r.cr)).toFixed(1)}:1 (${m[0].fs.toFixed(0)} px${m[0].large ? ', large' : ''})`; }).join(', ')}`);
  }
  // The measure isn't blind: the same season line drawn dim grey, with no halo, must fail it.
  await page.addStyleTag({ content: '.pw .sl, .pw .sl i { color: #5a6380 !important; text-shadow: none !important; }' });
  const dim = (await contrastOf(page)).filter((r) => r.id === 'season');
  ok(dim.every((r) => r.cr < 3), `wrappers: the contrast measure isn't blind: the season line drawn dim grey (#5a6380, no halo) reads ${Math.min(...dim.map((r) => r.cr)).toFixed(1)}-${Math.max(...dim.map((r) => r.cr)).toFixed(1)}:1, a fail`);
  await page.reload(); await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, 'wrappers-1440.jpg'), type: 'jpeg', quality: 82, fullPage: true });
  for (const d of ['crest', 'window', 'bleed']) await (await page.$(`[data-design-card="${d}"] .pw[data-hero]`)).screenshot({ path: join(out, `wrapper-${d}-large.png`) });
  ok(!errors.length, `wrappers, 1440: no page error${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}
{
  const { ctx, page, errors } = await open('pack-wrappers.html', '?light=still', { viewport: { width: 390, height: 844 }, touch: true });
  await layout(page, 'wrappers, phone 390');
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390, `wrappers, phone: no sideways scroll (page ${sw} px wide)`);
  await page.screenshot({ path: join(out, 'wrappers-phone.jpg'), type: 'jpeg', quality: 82, fullPage: true });
  ok(!errors.length, `wrappers, phone: no page error${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}
// the light: the sweep, the pointer, reduced motion
{
  const { ctx, page } = await open('pack-wrappers.html', '');
  const read = () => page.evaluate(() => { const el = document.querySelector('[data-design-card="crest"] .pw[data-hero]'); return { lx: parseFloat(el.style.getPropertyValue('--lx')), ty: parseFloat(el.style.getPropertyValue('--ty')), drive: document.getElementById('drive').textContent }; });
  const s1 = await read(); await page.waitForTimeout(1000); const s2 = await read();
  ok(Math.abs(s1.lx - s2.lx) > 1 && /sweep/.test(s2.drive), `light, left alone: a slow sweep (the highlight moved ${Math.abs(s1.lx - s2.lx).toFixed(1)}% of the face in 1 s; "${s2.drive}")`);
  const box = await (await page.$('[data-design-card="window"] .pw[data-hero]')).boundingBox();
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.5); await page.waitForTimeout(150);
  const right = await page.evaluate(() => { const el = document.querySelector('[data-design-card="window"] .pw[data-hero]'); return { ty: parseFloat(el.style.getPropertyValue('--ty')), lx: parseFloat(el.style.getPropertyValue('--lx')), drive: document.getElementById('drive').textContent }; });
  await page.mouse.move(box.x + box.width * 0.05, box.y + box.height * 0.5); await page.waitForTimeout(150);
  const left = await page.evaluate(() => { const el = document.querySelector('[data-design-card="window"] .pw[data-hero]'); return { ty: parseFloat(el.style.getPropertyValue('--ty')), lx: parseFloat(el.style.getPropertyValue('--lx')) }; });
  ok(right.ty > 2 && left.ty < -2 && right.lx < left.lx && /pointer/.test(right.drive), `light, a pointer over a pack: the pack turns toward it (turn ${right.ty.toFixed(1)}° with the pointer right, ${left.ty.toFixed(1)}° left) and the highlight moves against the turn; "${right.drive}"`);
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.25); await page.waitForTimeout(400);
  await (await page.$('[data-design-card="window"] .pw[data-hero]')).screenshot({ path: join(out, 'wrapper-window-light-pointer.png') });
  await ctx.close();
}
{
  const { ctx, page } = await open('pack-wrappers.html', '', { reduce: true });
  const el = await page.$('[data-design-card="bleed"] .pw[data-hero]');
  await page.mouse.move(700, 500);
  const a = await el.screenshot({ type: 'png' }); await page.waitForTimeout(1500); const b = await el.screenshot({ type: 'png' });
  const st = await page.evaluate(() => { const el = document.querySelector('[data-design-card="bleed"] .pw[data-hero]'); return { lx: el.style.getPropertyValue('--lx'), drive: document.getElementById('drive').textContent }; });
  ok(a.equals(b) && /reduced motion/.test(st.drive), `light, reduced motion: still (two shots 1.5 s apart are the same pixels; "${st.drive}", highlight at ${st.lx})`);
  await ctx.close();
}

// ---------- the pick row ----------

const settle = (page) => page.waitForFunction(() => { const S = window.__row; return Math.abs(S.pos - S.target) < 1e-6 && S.vel === 0 && !S.dragging; }, null, { timeout: 4000 }).then(() => true, () => false);
const state = (page) => page.evaluate(() => ({ pos: window.__row.pos, target: window.__row.target, picked: window.__row.picked, events: window.__row.events.slice(), selected: document.querySelector('.slot[aria-selected]')?.dataset.slot }));

for (const design of ['crest', 'window', 'bleed']) {
  const { ctx, page, errors } = await open('pack-pick.html', `?design=${design}`, { viewport: { width: 1280, height: 900 } });
  const P = `pick row (${design})`;
  await settle(page);
  const geo = await page.evaluate(() => [...document.querySelectorAll('.slot')].map((s) => { const r = s.getBoundingClientRect(); return { k: +s.dataset.slot, w: r.width, cx: r.left + r.width / 2, z: +s.style.zIndex, light: s.style.filter === 'none' ? 1 : parseFloat(/brightness\(([\d.]+)\)/.exec(s.style.filter)?.[1] ?? '1'), live: s.querySelector('.pw').hasAttribute('data-live'), op: +s.style.opacity } }));
  const c = geo[3];
  const byDist = (d) => geo.filter((g) => Math.abs(g.k - 3) === d);
  ok(geo.length === 7, `${P}: seven packs: ${geo.length}`);
  ok(byDist(1).every((g) => g.w < c.w && g.light < c.light && g.z < c.z) && byDist(2).every((g) => byDist(1).every((n) => g.w < n.w && g.light < n.light)) && geo.filter((g) => g.k < 3).every((g) => g.cx < c.cx) && geo.filter((g) => g.k > 3).every((g) => g.cx > c.cx),
    `${P}: the centre pack largest and in front (${Math.round(c.w)} px), its neighbours smaller and dimmer (${byDist(1).map((g) => `${Math.round(g.w)} px at ${g.light}`).join(', ')}), more behind (${byDist(2).map((g) => `${Math.round(g.w)} px at ${g.light}`).join(', ')})`);
  ok(geo.filter((g) => g.live).map((g) => g.k).join() === '3', `${P}: only the centre pack's light is live`);
  // nothing tells the packs apart
  const same = await page.evaluate(() => {
    const norm = (s) => { const c = s.cloneNode(true); for (const e of [c, ...c.querySelectorAll('*')]) { if (e.classList?.contains('pw')) { e.removeAttribute('style'); e.removeAttribute('data-live'); } } return c.innerHTML; };
    const all = [...document.querySelectorAll('.slot')].map(norm);
    const attrs = [...document.querySelectorAll('.slot')].map((s) => [...s.attributes].map((a) => a.name).filter((n) => !['class', 'style', 'data-slot', 'role', 'aria-label', 'aria-selected'].includes(n)));
    const html = document.documentElement.outerHTML;
    return { same: all.every((h) => h === all[0]), extra: attrs.flat(), leaks: (html.match(/seed|same odds|\bodds\b|data-card|cardId/gi) ?? []) };
  });
  ok(same.same && !same.extra.length && !same.leaks.length, `${P}: before the pick nothing tells one pack from another (every slot the same markup, no other attributes, no seed / card / odds in the page)${same.leaks.length ? `: ${same.leaks.join(',')}` : ''}`);
  // keys
  await page.focus('#pick');
  await page.keyboard.press('ArrowRight'); await settle(page);
  let s = await state(page);
  ok(s.pos === 4 && s.selected === '4', `${P}: ArrowRight moves one pack and settles on it (${s.pos})`);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await settle(page);
  s = await state(page);
  ok(s.pos === 2, `${P}: ArrowLeft twice: pack ${s.pos}`);
  // the wheel
  await page.mouse.move(640, 450); await page.mouse.wheel(0, 120); await settle(page);
  s = await state(page);
  ok(s.pos === 3, `${P}: a wheel step moves one pack (${s.pos})`);
  // a tap on a side pack brings it to the centre
  const side = await page.evaluate(() => { const r = document.querySelector('.slot[data-slot="1"]').getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: r.top + r.height / 2 }; });
  await page.mouse.click(side.x, side.y); await settle(page);
  s = await state(page);
  ok(s.pos === 1 && s.picked === null, `${P}: a tap on a side pack brings it to the centre without picking it (${s.pos})`);
  // a drag: a fling carries on a little and snaps to a whole pack
  await page.mouse.move(640, 450); await page.mouse.down();
  for (let k = 1; k <= 6; k++) { await page.mouse.move(640 - k * 45, 450); await page.waitForTimeout(12); }
  await page.mouse.up();
  const midFling = await state(page);
  await settle(page);
  s = await state(page);
  ok(Number.isInteger(s.pos) && s.pos > 2 && s.pos <= 4 && s.pos === s.target, `${P}: a fast drag left of 270 px carries on past where the finger left it and snaps to a whole pack (released at ${midFling.pos.toFixed(2)}, rests at ${s.pos})`);
  await page.mouse.move(640, 450); await page.mouse.down();
  for (let k = 1; k <= 8; k++) { await page.mouse.move(640 + k * 25, 450); await page.waitForTimeout(40); }
  await page.waitForTimeout(250); await page.mouse.up(); await settle(page);
  const s2 = await state(page);
  ok(s2.pos === s.pos - 1, `${P}: a slow drag right of 200 px (about one pack, then held) moves back one pack and no further (${s.pos} -> ${s2.pos})`);
  if (design === 'crest') await page.screenshot({ path: join(out, `pick-${design}-row.jpg`), type: 'jpeg', quality: 85 });
  // picking
  const before = await page.evaluate(() => { const r = document.querySelector('.slot[aria-selected]').getBoundingClientRect(); return { top: r.top, w: r.width }; });
  const cen = await page.evaluate(() => { const r = document.querySelector('.slot[aria-selected]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(cen.x, cen.y); await page.waitForTimeout(700);
  s = await state(page);
  const after = await page.evaluate(() => { const c = document.querySelector('.slot.chosen'); const r = c.getBoundingClientRect(); const others = [...document.querySelectorAll('.slot:not(.chosen)')].map((e) => +getComputedStyle(e).opacity); return { top: r.top, w: r.width, slot: c.dataset.slot, others: Math.max(...others), note: document.getElementById('note').textContent }; });
  ok(s.picked === s2.pos && s.events.length === 1 && JSON.stringify(Object.keys(s.events[0])) === '["slot"]' && s.events[0].slot === s2.pos, `${P}: a tap on the centre pack picks it: one pick event carrying only its slot (${JSON.stringify(s.events)})`);
  ok(after.top < before.top && after.w > before.w && after.others < 0.05, `${P}: the picked pack lifts out (top ${Math.round(before.top)} -> ${Math.round(after.top)} px, ${Math.round(before.w)} -> ${Math.round(after.w)} px wide), the rest fade (opacity ${after.others.toFixed(2)}); "${after.note}"`);
  await page.screenshot({ path: join(out, `pick-${design}-picked.jpg`), type: 'jpeg', quality: 85 });
  ok(!(await page.$('#again')) && !(await page.$('#choose')), `${P}: no "Back to the row" and no "Pick this pack" (owner 2026-11-28, points 6-7: a pick is final)`);
  {
    const g2 = await open('pack-pick.html', `?design=${design}`, { viewport: { width: 1280, height: 900 } });
    await settle(g2.page); await g2.page.focus('#pick'); await g2.page.keyboard.press('Enter'); await g2.page.waitForTimeout(100);
    const s3 = await state(g2.page);
    ok(s3.picked === 3 && s3.events.length === 1, `${P}: Enter picks the centre pack too`);
    await g2.ctx.close();
  }
  ok(!errors.length, `${P}: no page error${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}
{
  const { ctx, page, errors } = await open('pack-pick.html', '?design=crest', { viewport: { width: 390, height: 844 }, touch: true });
  await settle(page);
  const m = await page.evaluate(() => { const r = document.querySelector('.slot[aria-selected]').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, l: r.left, r: r.right, t: r.top, b: r.bottom, vh: innerHeight }; });
  ok(m.sw <= 390 && m.l >= 0 && m.r <= 390 && m.t >= 0 && m.b <= m.vh, `pick row, phone 390: no sideways scroll (${m.sw} px), the centre pack wholly on screen (${Math.round(m.l)}-${Math.round(m.r)} x ${Math.round(m.t)}-${Math.round(m.b)})`);
  const box = await page.$('#pick').then((e) => e.boundingBox());
  await page.touchscreen.tap(box.x + box.width * 0.88, box.y + box.height * 0.46); await settle(page);
  const s = await state(page);
  ok(s.pos === 4, `pick row, phone: a tap on the right-hand neighbour brings it to the centre (${s.pos})`);
  await page.screenshot({ path: join(out, 'pick-phone.jpg'), type: 'jpeg', quality: 85 });
  ok(!errors.length, `pick row, phone: no page error${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}
{
  const { ctx, page } = await open('pack-pick.html', '?design=window', { viewport: { width: 1280, height: 900 }, reduce: true });
  await page.focus('#pick'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60);
  const s = await state(page);
  ok(s.pos === 4, `pick row, reduced motion: a key moves the row at once, no easing (pos ${s.pos} one frame later)`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  const t = await page.evaluate(() => getComputedStyle(document.querySelector('.slot.chosen')).transitionDuration);
  ok(/^0s(, 0s)*$/.test(t), `pick row, reduced motion: the pick is instant (transition ${t})`);
  await ctx.close();
}

await browser.close();
lines.unshift(`Season 1 pack wrappers and the pick row (render sessions 95-96): ${pass} PASS, ${fail} FAIL`, '');
writeFileSync(join(out, 'check.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
process.exitCode = fail ? 1 : 0;
