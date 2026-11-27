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
//     transparent), 4.5:1 or more, in light and in dark (artwork marked
//     aria-hidden, such as the sealed pack's printed logo, is not text).
// My agent adds (render session 90, owner 2026-11-27 note 6): every size names
// the same current play style; L draws all six as choices, exactly one
// marked current (check, accent edge, "Current" all visible), each a link
// to My agent carrying its style, with a pointer; a hovered and a pressed
// choice each look different from a resting one (the .hov / .prs poses, and a
// real pointer hover), and their text meets the same 4.5:1.
// Ladder adds: the bar is one bar at M and L (placement or the next tier,
// never both), the standings hold the owner's row, and the form's dots sit
// on one line.
// Store adds (render session 91, owner 2026-11-28 point 9: the packs are the
// hero): every size says the same credits; no cosmetic on the tile (no
// cosmetics fact, coin, emblem or canvas); M draws exactly the featured pack,
// L 1 and 10 of each offer (two offers at most, a line naming the rest);
// every pack has a Buy or how many more credits, never both, and a Buy only
// when the credits cover its price (the price on the art the same as the
// one it's bought at); each Buy carries its purchase (data-buy="S0:10").
// Packs adds: every size says the same count; S keeps to the count (no
// sentence); the fanned packs stay inside the tile.
// Fails on any miss (this is the session's own bar, not a report).
// Writes check.txt and the 191 px stills (light, dark) to
// progress/render/evidence/season1-<tile>-tile-s<session>/ (or the folder given).
//
//   node render/season1/ci/tile-states-check.mjs agent|ladder|store|packs [outDir]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { contrast, NOTEXT_CSS } from './contrast.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const season1 = resolve(here, '..');
const TILE = process.argv[2] ?? 'agent';
const SESSION = { agent: 90, ladder: 92, store: 91, packs: 91 }[TILE];
if (!SESSION) throw new Error(`no states sheet for "${TILE}" (agent, ladder, store or packs)`);
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
    // Screen-reader-only text (.vh: a 1 px box, clipped on purpose) is not cut.
    if (e.getBoundingClientRect().width <= 1) continue;
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
    credits: txt('[data-fact="credits"] .big'),
    cosmetic: !!el.querySelector('[data-fact="cosmetics"], .sh-emb, canvas, [data-coin]'),
    offers: sec.dataset.offers ? JSON.parse(sec.dataset.offers) : null, wallet: Number(sec.dataset.credits ?? NaN),
    pbs: [...el.querySelectorAll('.pb')].map((f) => ({ offer: f.dataset.offer, count: Number(f.dataset.count), price: Number(f.dataset.price), shown: Number((f.querySelector('.pb-p')?.textContent ?? '').replace(/[^\d]/g, '')), buy: f.querySelector('.pb-buy')?.dataset.buy ?? null, need: !!f.querySelector('.pb-need'), hero: f.classList.contains('hero') })),
    moreLine: /more pack/.test(txt('[data-fact="buyPacks"] > .sub')),
    count: txt('[data-fact="unopened"] .big'), why: !!el.querySelector('[data-fact="unopened"] .why'),
    fanOut: (() => { const f = el.querySelector('.pk-fan'); if (!f) return 0; const q = f.getBoundingClientRect(); return Math.max(0, r.left + pad.l - q.left, q.right - (r.right - pad.r)); })(),
    bg: cs.backgroundImage + ' ' + cs.backgroundColor,
    chart: (() => {
      // The rating chart (render 92, owner 2026-11-28 point 8), in screen px.
      const svg = el.querySelector('[data-fact="trend"] svg.chart'); if (!svg) return null;
      const m = svg.getScreenCTM();
      const pts = svg.querySelector('path.rline').getAttribute('d').match(/-?[\d.]+/g).map(Number).reduce((a, v, i, all) => (i % 2 ? a : [...a, { x: v, y: all[i + 1] }]), []).map((q) => ({ x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f }));
      const plot = el.querySelector('[data-fact="trend"] .plot').getBoundingClientRect();
      const rect = (e) => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, text: e.textContent.trim() }; };
      const values = [...el.querySelectorAll('[data-fact="trend"] .stepv')].map(rect);
      const names = [...el.querySelectorAll('[data-fact="trend"] .floors > span')].map(rect);
      // How close the line comes to a box (px; 0 = it crosses it).
      const near = (b) => { let d = 99; for (let k = 1; k < pts.length; k++) { const p = pts[k - 1], q = pts[k]; const n = Math.max(2, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y))); for (let s = 0; s <= n; s++) { const x = p.x + ((q.x - p.x) * s) / n, y = p.y + ((q.y - p.y) * s) / n; const dx = Math.max(b.l - x, 0, x - b.r), dy = Math.max(b.t - y, 0, y - b.b); d = Math.min(d, Math.hypot(dx, dy)); } } return d; };
      const segs = pts.slice(1).map((q, k) => ({ dx: Math.abs(q.x - pts[k].x), dy: Math.abs(q.y - pts[k].y) }));
      const dot = el.querySelector('[data-fact="trend"] .enddot').getBoundingClientRect();
      const last = pts[pts.length - 1];
      const title = el.querySelector('[data-fact="trend"] .plot').getAttribute('title') ?? '';
      return {
        valuesNear: Math.min(99, ...values.map(near)), namesNear: Math.min(99, ...names.map(near)),
        valuesOut: values.filter((b) => b.l < plot.left - 0.5 || b.r > plot.right + 0.5 || b.t < plot.top - 0.5 || b.b > plot.bottom + 0.5).map((b) => b.text),
        valuesOverlap: values.some((a, i) => values.some((b, j) => i < j && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b)),
        namesOverlap: names.some((a, i) => names.some((b, j) => i < j && a.t < b.b && b.t < a.b)),
        // A drawn segment steeper than 75 degrees and taller than 6 px is a
        // slope that reads as a straight drop, unless it is a step (exactly vertical).
        steepSlopes: segs.filter((g) => g.dx > 0.5 && g.dy > 6 && g.dy > 3.73 * g.dx).length,
        verticals: segs.filter((g) => g.dx <= 0.5 && g.dy > 0.5).length,
        steps: title ? title.replace(/^Big days: /, '').split('; ').length : 0,
        values: values.map((b) => b.text), title,
        dotOff: Math.hypot((dot.left + dot.right) / 2 - last.x, (dot.top + dot.bottom) / 2 - last.y),
        dotIn: dot.right <= plot.right + 0.5 && dot.left >= plot.left - 0.5,
        to: (svg.getAttribute('aria-label').match(/ to (\d[\d,]*\d)/) ?? [])[1] ?? '',
      };
    })(),
  };
}));

// Contrast from pixels (shared with home-grid-check.mjs since render 92): ci/contrast.mjs.

try {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && u !== 'about:blank') external.push(u); });
    await page.goto(PAGE);
    await page.evaluate(([t, css]) => { document.documentElement.dataset.theme = t; const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }, [theme, NOTEXT_CSS]);
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
        } else if (TILE === 'store') {
          const offers = row[0].offers, wallet = row[0].wallet;
          check(new Set(row.map((t) => t.credits)).size === 1 && row[0].credits === wallet.toLocaleString('en-AU'), `${s}: every size says the same credits ("${row[0].credits}")`);
          check(row.every((t) => !t.cosmetic), `${s}: no cosmetic on the tile at any size (the packs are the hero)`);
          const M = row.filter((t) => t.size === 'M'), L = row.filter((t) => t.size === 'L'), S = row.filter((t) => t.size === 'S');
          const shown = offers.slice(0, 2);
          check(S.every((t) => t.pbs.length === 0) && M.every((t) => offers.length ? t.pbs.length === 1 && t.pbs[0].hero && t.pbs[0].offer === offers[0].setCode && t.pbs[0].count === 1 : t.pbs.length === 0), `${s}: S draws no pack; M exactly the featured pack${offers.length ? ` (${offers[0].name})` : ' (none on sale)'}`);
          check(L.every((t) => t.pbs.length === shown.length * 2 && shown.every((o) => t.pbs.some((p) => p.offer === o.setCode && p.count === 1) && t.pbs.some((p) => p.offer === o.setCode && p.count === 10)) && t.moreLine === offers.length > 2), `${s}: L draws 1 and 10 of each of ${shown.length} offer(s)${offers.length > 2 ? ` and names the other ${offers.length - 2}` : ''}`);
          const all = row.flatMap((t) => t.pbs);
          check(all.every((p) => (p.buy !== null) !== p.need && (p.buy !== null) === (wallet >= p.price) && p.shown === p.price && (p.buy === null || p.buy === `${p.offer}:${p.count}`)), `${s}: each pack has Buy (carrying its purchase) only when ${wallet} credits cover it, else how many more; the price on the art is the price (${all.length} packs)`);
        } else if (TILE === 'packs') {
          check(new Set(row.map((t) => t.count)).size === 1, `${s}: every size says the same count ("${row[0].count || 'none'}")`);
          check(row.filter((t) => t.size === 'S').every((t) => !t.why), `${s}: S keeps to the count (no sentence)`);
          check(row.every((t) => t.fanOut <= 1), `${s}: the fanned packs stay inside the tile at every size`);
        } else {
          const agree = new Set(row.map((t) => t.rating)).size === 1 && new Set(row.map((t) => t.tier)).size === 1;
          check(agree, `${s}: every size says the same rating and tier ("${row[0].rating}", "${row[0].tier}")`);
          const ml = row.filter((t) => t.size !== 'S');
          check(ml.every((t) => t.bars === 1) && new Set(ml.map((t) => t.climb)).size === 1 && row.filter((t) => t.size === 'S').every((t) => t.bars === 0), `${s}: one bar at M and L ("${ml[0]?.climb}"), none at S`);
          const L = row.filter((t) => t.size === 'L');
          check(L.every((t) => t.standings && t.meRow), `${s}: L's standings hold the owner's own row`);
          check(row.every((t) => t.dotRows <= 1), `${s}: the form's dots sit on one line at every size`);
          // The rating chart (render 92, owner 2026-11-28 point 8).
          const ch = row.filter((t) => t.chart);
          if (ch.length) {
            const c0 = ch[0].chart;
            check(ch.every((t) => t.chart.namesNear >= 2 && !t.chart.namesOverlap), `${s}: the chart's tier names never touch the line (closest ${Math.min(...ch.map((t) => t.chart.namesNear)).toFixed(1)}px) or each other`);
            check(ch.every((t) => t.chart.steepSlopes === 0), `${s}: no slope on the chart reads as a straight drop (steeper than 75deg and over 6px)${ch.some((t) => t.chart.steepSlopes) ? ': ' + ch.map((t) => `${t.unit}px ${t.chart.steepSlopes}`).join(', ') : ''}`);
            check(ch.every((t) => t.chart.verticals === t.chart.steps), `${s}: every vertical on the chart is a big day, each named with its value in the chart's title (${c0.steps} step${c0.steps === 1 ? '' : 's'})`);
            check(ch.every((t) => t.chart.valuesNear >= 1 && !t.chart.valuesOut.length && !t.chart.valuesOverlap), `${s}: each step's value (${c0.values.join(', ') || 'none'}) is clear of the line (closest ${Math.min(...ch.map((t) => t.chart.valuesNear)).toFixed(1)}px), inside the plot and clear of the others`);
            check(ch.every((t) => t.chart.dotOff <= 1.5 && t.chart.dotIn), `${s}: the line ends in a dot on its last point, inside the plot`);
            check(ch.every((t) => t.chart.to === t.rating.replace(/[^\d,]/g, '')), `${s}: the chart ends at the tile's rating ("${c0.to}")`);
          }
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
