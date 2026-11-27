// A tile in every state the owner API can serve, in headless Chromium
// (render session 88 wrote it for My agent; render session 89 made it take
// the tile, for the Ladder). Loads render/season1/output/<tile>-states.html
// (built by season1/mockup/buildHome.ts) and, for every state at S, M and L
// on each of the grid's three units (191, 218 and 231 px: 1280, 1440 and
// 1024 px wide), checks:
//   - the tile fits its box: nothing scrolls, nothing ends past the padding;
//   - nothing spills: no text past the tile's edge, under its header or into
//     its button (PR #196's measure, as in home-grid-check.mjs);
//   - nothing is cut sideways: the agent's name wraps to two lines at most,
//     then ends in an ellipsis; a ladder name ends in an ellipsis in its row
//     (the whole name in its title);
//   - every size agrees (one source): My agent's pill and button; Ladder's
//     rating and tier;
//   - the tile is the glass every tile is: not the hero panel;
//   - text contrast on the glass, measured from the pixels: each text line's
//     colour against the glass behind it (the tile shot with its text made
//     transparent), 4.5:1 or more, in light and in dark.
// My agent adds (render session 90, owner 2026-11-27 note 6): every size names
// the same current play style; L draws all six as choices, exactly one
// marked current (check, accent edge, "Current" all visible), each a link
// to My agent carrying its style, with a pointer; a hovered and a pressed
// choice each look different from a resting one (the .hov / .prs poses, and a
// real pointer hover), and their text meets the same 4.5:1.
// Ladder adds: the bar is one bar at M and L (placement or the next tier,
// never both), the standings hold the owner's row, and the form's dots sit
// on one line.
// Fails on any miss (this is the session's own bar, not a report).
// Writes check.txt and the 191 px stills (light, dark) to
// progress/render/evidence/season1-<tile>-tile-s<session>/ (or the folder given).
//
//   node render/season1/ci/tile-states-check.mjs agent|ladder [outDir]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const season1 = resolve(here, '..');
const TILE = process.argv[2] ?? 'agent';
const SESSION = { agent: 90, ladder: 89 }[TILE];
if (!SESSION) throw new Error(`no states sheet for "${TILE}" (agent or ladder)`);
const OUT = resolve(process.argv[3] ?? join(season1, '..', '..', 'progress', 'render', 'evidence', `season1-${TILE}-tile-s${SESSION}`));
mkdirSync(OUT, { recursive: true });
const PAGE = pathToFileURL(join(season1, 'output', `${TILE}-states.html`)).href;

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright/index.mjs', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright not found (set PW_CORE to its index.mjs)');
}

const chromium = await loadPlaywright();
const browser = await chromium.launch();
const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };
let pass = 0, fail = 0;
const check = (ok, what) => { if (ok) pass++; else fail++; say(`${ok ? 'PASS' : 'FAIL'} ${what}`); };
const errors = [], external = [];

const measure = () => [...document.querySelectorAll('.case')].flatMap((sec) => [...sec.querySelectorAll('.tile')].map((el) => {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const pad = { b: parseFloat(cs.paddingBottom), l: parseFloat(cs.paddingLeft), r: parseFloat(cs.paddingRight) };
  const visible = (e) => { const q = e.getBoundingClientRect(); const s = getComputedStyle(e); return q.width > 0 && q.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const hd = el.querySelector(':scope > header').getBoundingClientRect();
  const btn = el.querySelector(':scope > footer .btn');
  const fb = btn ? btn.getBoundingClientRect() : null;
  const spills = new Set();
  for (const e of el.querySelectorAll(':scope > .headline *, :scope > .body *')) {
    if (e.closest('.q') || !visible(e)) continue;
    const q = e.getBoundingClientRect();
    const n = e.closest('[data-fact]')?.dataset.fact ?? 'headline';
    if (q.bottom > r.bottom - pad.b + 1 || q.right > r.right - pad.r + 1 || q.left < r.left + pad.l - 1) spills.add(n + ' past the tile');
    else if (q.top < hd.bottom - 1) spills.add(n + ' under the header');
    else if (fb && q.bottom > fb.top + 1 && q.right > fb.left + 1 && q.left < fb.right - 1 && q.top < fb.bottom) spills.add(n + ' into the button');
  }
  const past = Math.max(0, ...[...el.children].filter((c) => !c.classList.contains('q') && getComputedStyle(c).display !== 'none').map((c) => c.getBoundingClientRect().bottom - (r.bottom - pad.b)));
  const b = el.querySelector('.body');
  const name = el.querySelector('[data-fact="agentName"] .big');
  const nameLines = name ? Math.round(name.getBoundingClientRect().height / parseFloat(getComputedStyle(name).lineHeight)) : 0;
  // A text box wider than its own box is cut sideways, unless it ends in an
  // ellipsis on purpose (text-overflow) with the whole text in a title.
  let cut = 0;
  for (const e of el.querySelectorAll(':scope > .headline *, :scope > .body *')) {
    if (e.closest('.q, details:not([open])') || !visible(e) || e.tagName === 'svg' || e.closest('svg')) continue;
    const over = e.scrollWidth - e.clientWidth;
    if (over > 1 && getComputedStyle(e).overflowX !== 'visible' && !(getComputedStyle(e).textOverflow === 'ellipsis' && e.title)) cut = Math.max(cut, over);
  }
  const txt = (sel) => el.querySelector(sel)?.textContent.trim() ?? '';
  const dots = [...el.querySelectorAll('[data-fact="form"] .dot')];
  const dotRows = new Set(dots.map((x) => Math.round(x.getBoundingClientRect().top))).size;
  const choices = [...el.querySelectorAll('[data-fact="personality"] .choice')];
  const on = choices.filter((c) => c.classList.contains('on'));
  const seen = (e) => !!e && visible(e);
  const look = (c) => { const s = getComputedStyle(c); return s.backgroundColor + ' | ' + s.boxShadow + ' | ' + s.transform; };
  const rest = choices.find((c) => !c.classList.contains('on') && !c.classList.contains('hov') && !c.classList.contains('prs'));
  const hov = choices.find((c) => c.classList.contains('hov')), prs = choices.find((c) => c.classList.contains('prs'));
  return {
    styleCut: (() => { const n = el.querySelector('[data-fact="personality"] [data-style-name]'); return n ? n.scrollWidth - n.clientWidth : 0; })(),
    style: el.querySelector('[data-fact="personality"] [data-style-name]')?.textContent.trim() ?? on[0]?.querySelector('b')?.textContent.trim() ?? '',
    choices: choices.length, onCount: on.length,
    onMarked: on.every((c) => seen(c.querySelector('.tick')) && seen(c.querySelector('.cur')) && c.querySelector('.cur').textContent.trim() === 'Current' && c.getAttribute('aria-current') === 'true' && getComputedStyle(c).boxShadow.includes('inset')),
    offPlain: choices.filter((c) => !c.classList.contains('on')).every((c) => !seen(c.querySelector('.tick')) && !seen(c.querySelector('.cur'))),
    links: choices.every((c) => c.dataset.go === 'agent' && c.dataset.style && c.tagName === 'A'),
    pointer: choices.filter((c) => !c.classList.contains('on')).every((c) => getComputedStyle(c).cursor === 'pointer'),
    poses: hov && prs && rest ? { rest: look(rest), hov: look(hov), prs: look(prs) } : null,
    state: sec.dataset.case, unit: Number(sec.dataset.unit), size: el.dataset.size,
    overflow: Math.round(Math.max(0, el.scrollHeight - el.clientHeight, b ? b.scrollHeight - b.clientHeight : 0, past)),
    sideways: Math.max(0, el.scrollWidth - el.clientWidth, name ? name.scrollWidth - name.clientWidth : 0, cut),
    spills: [...spills],
    nameLines,
    pill: el.querySelector('[data-fact="agentStatus"] .pill')?.textContent ?? '',
    rating: txt('[data-fact="rating"]'), tier: txt('[data-fact="tier"]'),
    bars: el.querySelectorAll('.body .bar').length, climb: el.querySelector('[data-fact="climb"] .lab')?.textContent ?? '',
    meRow: !!el.querySelector('[data-fact="standings"] li.me'), standings: !!el.querySelector('[data-fact="standings"]'),
    dotRows,
    button: btn?.textContent.trim() ?? '',
    hero: el.classList.contains('hero'),
    bg: cs.backgroundImage + ' ' + cs.backgroundColor,
  };
}));

// Contrast from pixels: shoot each tile with its text hidden (the glass and
// what shows through it), then read each text line's box from that shot.
async function contrast(page, selector) {
  const tiles = await page.$$(selector);
  let worst = 99, who = '';
  for (const t of tiles) {
    const leaves = await t.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const out = [];
      for (const e of el.querySelectorAll(':scope > header h3, :scope > .headline *, :scope > .body *, :scope > footer .btn:not(.pri)')) {
        if (e.closest('.q, .ava, .pill.pri, .btn.pri')) continue;
        if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const q = e.getBoundingClientRect(); const s = getComputedStyle(e);
        if (!q.width || s.visibility === 'hidden' || s.display === 'none') continue;
        out.push({ x: q.left - r.left, y: q.top - r.top, w: q.width, h: q.height, color: s.color, text: e.textContent.trim().slice(0, 28), fact: e.closest('[data-fact]')?.dataset.fact ?? 'header' });
      }
      return out;
    });
    await t.evaluate((el) => el.classList.add('__notext'));
    const png = (await t.screenshot({ type: 'png' })).toString('base64');
    await t.evaluate((el) => el.classList.remove('__notext'));
    const res = await page.evaluate(async ({ png, leaves }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const L = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
      return leaves.map((f) => {
        const d = g.getImageData(Math.max(0, Math.floor(f.x)), Math.max(0, Math.floor(f.y)), Math.max(1, Math.floor(f.w)), Math.max(1, Math.floor(f.h))).data;
        let sum = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { sum += L(d[i], d[i + 1], d[i + 2]); n++; }
        const bg = sum / n;
        // rgb(r, g, b) is 0-255; color(srgb r g b) (what color-mix computes to) is 0-1.
        const m = f.color.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => (f.color.startsWith('color(') ? v * 255 : v));
        const fg = L(m[0], m[1], m[2]);
        return { ...f, cr: (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05) };
      });
    }, { png, leaves });
    for (const r of res) if (r.cr < worst) { worst = r.cr; who = `${r.fact} "${r.text}"`; }
  }
  return { worst, who };
}

try {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && u !== 'about:blank') external.push(u); });
    await page.goto(PAGE);
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; const s = document.createElement('style'); s.textContent = '.__notext, .__notext * { color: transparent !important; } .__notext .btn:not(.pri) { color: transparent !important; }'; document.head.appendChild(s); }, theme);
    await page.waitForTimeout(150);
    say(`\n=== ${theme} ===`);
    const all = await page.evaluate(measure);
    const states = [...new Set(all.map((t) => t.state))];
    const units = [...new Set(all.map((t) => t.unit))];
    if (theme === 'light') {
      for (const u of units) for (const s of states) {
        const row = all.filter((t) => t.unit === u && t.state === s);
        const bad = row.filter((t) => t.overflow > 1 || t.sideways > 1 || t.spills.length || t.nameLines > 2);
        check(!bad.length, `unit ${u}px, ${s}: S, M and L fit their boxes, nothing spills${bad.length ? ': ' + bad.map((t) => `${t.size} overflow ${t.overflow}px, sideways ${t.sideways}px, name ${t.nameLines} lines${t.spills.length ? ', spills ' + t.spills.join('/') : ''}`).join('; ') : ''}`);
      }
      for (const s of states) {
        const row = all.filter((t) => t.state === s);
        if (TILE === 'agent') {
          const agree = new Set(row.map((t) => t.pill)).size === 1 && new Set(row.map((t) => t.button)).size === 1;
          check(agree, `${s}: every size says the same ("${row[0].pill}", button "${row[0].button}")`);
          const noAgent = s === 'no-agent';
          const named = row.filter((t) => !(noAgent && t.size === 'L'));
          check(row.every((t) => t.styleCut <= 1), `${s}: the play style's name is never cut at S or M${row.some((t) => t.styleCut > 1) ? ': ' + row.filter((t) => t.styleCut > 1).map((t) => `${t.size} at ${t.unit}px, ${t.styleCut}px`).join(', ') : ''}`);
          check(new Set(named.map((t) => t.style)).size === 1 && !!named[0].style, `${s}: every size names the same play style ("${named[0].style}"${noAgent ? ', L none marked' : ''})`);
          const L = row.filter((t) => t.size === 'L');
          check(L.every((t) => t.choices === 6 && t.onCount === (noAgent ? 0 : 1) && t.onMarked && t.offPlain && t.links && t.pointer), `${s}: L draws the six play styles as choices, ${noAgent ? 'none marked (no agent)' : 'one marked current (check, accent edge, "Current")'}, each a link to My agent with its style and a pointer`);
          const posed = row.filter((t) => t.poses);
          if (posed.length) check(posed.every((t) => t.poses.hov !== t.poses.rest && t.poses.prs !== t.poses.rest && t.poses.prs !== t.poses.hov), `${s}: a hovered and a pressed choice each look different from a resting one, and from each other (${posed.length} tiles)`);
        } else {
          const agree = new Set(row.map((t) => t.rating)).size === 1 && new Set(row.map((t) => t.tier)).size === 1;
          check(agree, `${s}: every size says the same rating and tier ("${row[0].rating}", "${row[0].tier}")`);
          const ml = row.filter((t) => t.size !== 'S');
          check(ml.every((t) => t.bars === 1) && new Set(ml.map((t) => t.climb)).size === 1 && row.filter((t) => t.size === 'S').every((t) => t.bars === 0), `${s}: one bar at M and L ("${ml[0]?.climb}"), none at S`);
          const L = row.filter((t) => t.size === 'L');
          check(L.every((t) => t.standings && t.meRow), `${s}: L's standings hold the owner's own row`);
          check(row.every((t) => t.dotRows <= 1), `${s}: the form's dots sit on one line at every size`);
        }
      }
    }
    check(all.every((t) => !t.hero), `${theme}: no tile is the hero panel (${all.length} tiles)`);
    if (TILE === 'agent') {
      // A real pointer on a resting choice (not the .hov pose): it changes.
      const sel = '.case[data-case="playing"][data-unit="191"] .tile.s-L .choice:not(.on)';
      const before = await page.$eval(sel, (c) => getComputedStyle(c).backgroundColor + getComputedStyle(c).boxShadow);
      await page.hover(sel); await page.waitForTimeout(200);
      const after = await page.$eval(sel, (c) => getComputedStyle(c).backgroundColor + getComputedStyle(c).boxShadow);
      await page.mouse.move(0, 0); await page.waitForTimeout(200);
      check(before !== after, `${theme}: a real pointer over a resting play style changes its look`);
    }
    for (const u of units) {
      const c = await contrast(page, `.case[data-unit="${u}"] .tile`);
      check(c.worst >= 4.5, `${theme}, unit ${u}px: every text line on the glass reads at 4.5:1 or more, measured from the pixels (lowest ${c.worst.toFixed(1)}:1, ${c.who})`);
    }
    // The tightest unit (191 px, the grid at 1280), in each theme.
    const box = await page.evaluate(() => { const a = document.querySelectorAll('.case[data-unit="191"]'); const r1 = a[0].getBoundingClientRect(), r2 = a[a.length - 1].getBoundingClientRect(); return { y: r1.top + scrollY, h: r2.bottom - r1.top }; });
    await page.screenshot({ path: join(OUT, `${TILE}-states-1280-${theme}.jpg`), type: 'jpeg', quality: 72, fullPage: true, clip: { x: 0, y: box.y, width: 1040, height: box.h } });
    await ctx.close();
  }
  check(!errors.length, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  check(!external.length, `no outside requests${external.length ? ': ' + external.join(', ') : ''}`);
} catch (e) {
  fail++;
  say(`FAIL the run stopped: ${e && e.stack || e}`);
}
say(`\n${pass} PASS, ${fail} FAIL`);
writeFileSync(join(OUT, 'check.txt'), lines.join('\n') + '\n');
await browser.close();
process.exitCode = fail ? 1 : 0;
