// Render session 72 (the owner's 2026-11-13 plan, item 6: fix what the dry
// run broke, render side). Game session 94 changed two things the site shows:
// the play-time allowance's clock now starts at the agent's first pairing
// (state "waiting", label "Waiting for the next round"), and the server ends
// the season at an end time set before it starts (`GET /api/season`'s
// `endsAt`). In a headless browser against the real owner API with the game
// lane's ladder playing at 8x (render/src/site/siteDemo.ts --ladder --speed 8
// --ends-in 40: the season's end time 40 minutes ahead on the server's own
// clock, so the ladder ends it while the page is open; no response is
// rewritten).
//
//   A The waiting ring at S, M and L (and a phone): the centre keeps the
//     minutes chosen ("15 min"), the ring is the still "waiting" look, the
//     server's words sit beside it (under the name at S), the centre's pill
//     stays inside the widget and off the Stop button (session 94's build put
//     the long words in the pill, which ran out of the widget at S and M).
//     Nothing counts down while waiting. Then the agent is paired: the server
//     says running and the ring starts draining within a 5 s status read.
//   B The season's end on the Stats page: "Ends in ..." with the end in Sydney
//     time while open; the ladder reaches the end time, the server says
//     ending, then ended; the page says so after a reload.
//   E No external requests; no page errors.
//
//   node progress/render/evidence/season-check-s72.mjs [stills dir]

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = resolve(process.argv[2] ?? resolve(ROOT, 'progress/render/evidence'));
mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs', '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

const SPEED = 8;
const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', String(SPEED), '--ends-in', '40'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const url = await new Promise((ok, fail) => {
  let buf = '';
  demo.stdout.on('data', (d) => { buf += d; const m = /\[site-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
  demo.stderr.on('data', (d) => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
  demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
  setTimeout(() => fail(new Error('the demo took over 120 s to start')), 120000);
});

let passes = 0, fails = 0;
const check = (ok, line) => { if (ok) passes++; else fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); };
const note = (line) => console.log(`      ${line}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000, step = 150) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
const chromium = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];
const external = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(url, '/')}`); });
page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });

const api = (method, path, body) => page.evaluate(async ([method, path, body]) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}, [method, path, body]);
const shot = async (name, sel) => {
  const el = sel ? await page.$(sel) : null;
  try { await (el ?? page).screenshot({ path: resolve(OUT, `v2-s72-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000 }); } catch { note(`(the still "${name}" timed out)`); }
};
const T = '#wgrid .wg[data-type="live"]';
const ringRead = () => page.$eval(T, (w) => {
  const r = w.querySelector('.tring'); const c = r.querySelector('.tr-c'); const stop = w.querySelector('[data-act="auto-play"]');
  const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
  return { cls: r.className, centre: c.textContent, label: r.getAttribute('aria-label'), dash: r.querySelector('.tr-fg').getAttribute('stroke-dasharray'),
    note: w.querySelector('.ac-note')?.textContent ?? null, noteFits: (() => { const n = w.querySelector('.ac-note'); return !n || n.scrollWidth <= n.clientWidth + 1; })(), cap: w.querySelector('.ac-cap:not(.ac-note)')?.textContent ?? null,
    pill: box(c), widget: box(w), stop: stop ? box(stop) : null, text: w.innerText };
}).catch(() => null);
const inside = (a, b) => a.l >= b.l - 0.5 && a.r <= b.r + 0.5 && a.t >= b.t - 0.5 && a.b <= b.b + 0.5;
const overlaps = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const autoPlay = async () => (await api('GET', '/api/play')).body.autoPlay;
const setBoard = async (size) => { await api('PUT', '/api/board', { widgets: [{ id: 'w1', type: 'live', size }] }); await page.reload(); await page.waitForSelector(`${T}[data-size="${size}"] .tring`); };

try {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');

  console.log('\n[A] the waiting ring at S, M and L');
  const sizes = ['S', 'M', 'L'];
  for (const size of sizes) {
    await setBoard(size);
    // The widget's own 15 min button at M and L; at S (no buttons) the same call the button makes.
    if (size === 'S') { await api('PUT', '/api/play/auto-play', { on: true, minutes: 15 }); await page.reload(); await page.waitForSelector(`${T} .tring`); }
    else await page.click(`${T} [data-act="play-time"][data-min="15"][data-add="0"]`);
    const a = await autoPlay();
    if (a.allowance?.state !== 'waiting') { note(`(${size}: the server already said ${a.allowance?.state}: the agent was paired at once; skipped)`); continue; }
    check(a.allowance.label === 'Waiting for the next round' && a.allowance.endsAt === null, `A. ${size}: the server waits ("${a.allowance.label}", endsAt null)`);
    check(await until(async () => (await ringRead())?.cls.includes('t-wait')), `A. ${size}: the ring takes the waiting look`);
    const r = await ringRead();
    check(r.centre === '15min', `A. ${size}: the centre keeps the minutes chosen ("${r.centre}")`);
    check(/Waiting for the next round, 15 min$/.test(r.label), `A. ${size}: the ring's accessible name "${r.label}"`);
    if (size === 'S') check(r.note === a.allowance.label, `A. S: the server's words under the name ("${r.note}")`);
    else check(r.cap?.startsWith(`${a.allowance.label}: the 15 min start when your agent is`), `A. ${size}: the caption "${r.cap}"`);
    check(inside(r.pill, r.widget), `A. ${size}: the centre's pill is inside the widget (pill ${Math.round(r.pill.l)}-${Math.round(r.pill.r)}, widget ${Math.round(r.widget.l)}-${Math.round(r.widget.r)})`);
    check(!overlaps(r.pill, r.stop), `A. ${size}: the pill is off the Stop button`);
    check(r.stop && inside(r.stop, r.widget), `A. ${size}: Stop is inside the widget (the first look at S had the words' line push it under the edge)`);
    if (size === 'S') check(r.noteFits, 'A. S: the words fit on their one line (not cut)');
    await wait(2500);
    const r2 = await ringRead();
    check(r2.dash === r.dash && r2.centre === r.centre, `A. ${size}: nothing counts down while waiting (arc ${r.dash})`);
    await shot(`wait-${size}`, T);
  }
  // A phone, at S (the board's one column).
  await setBoard('S');
  await api('PUT', '/api/play/auto-play', { on: true, minutes: 15 });
  await page.setViewportSize({ width: 390, height: 860 });
  await page.reload();
  await page.waitForSelector(`${T} .tring`);
  if ((await autoPlay()).allowance?.state === 'waiting') {
    const r = await ringRead();
    check(r.cls.includes('t-wait') && inside(r.pill, r.widget) && r.note === 'Waiting for the next round', `A. phone 390 px: waiting, the pill inside, the words under the name`);
    check(r.noteFits && r.stop && inside(r.stop, r.widget), 'A. phone: the words fit, Stop inside the widget');
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(sw <= 390, `A. phone: no sideways scroll (${sw} px)`);
    await shot('wait-phone', T);
    await page.evaluate(() => { document.body.dataset.theme = 'dark'; });
    await shot('wait-phone-dark', T);
    await page.evaluate(() => { delete document.body.dataset.theme; });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setBoard('M');
  // Waiting -> running: the agent's next pairing starts the clock.
  await api('PUT', '/api/play/auto-play', { on: true, minutes: 15 });
  await page.reload();
  await page.waitForSelector(`${T} .tring`);
  let runAt = 0;
  const paired = await until(async () => { const a = await autoPlay(); if (a.allowance?.state === 'running') { runAt = Date.now(); return true; } return false; }, 4 * 60_000, 250);
  check(paired, 'A. the server starts the clock at the agent\'s pairing (running)');
  if (paired) {
    const shown = await until(async () => (await ringRead())?.cls.includes('t-run'), 12000, 100);
    check(shown, `A. the ring runs ${((Date.now() - runAt) / 1000).toFixed(1)} s after the server said so (status read every 5 s while waiting)`);
    const r = await ringRead();
    check(/^\d+min$/.test(r.centre) && /min left today/.test(r.cap ?? ''), `A. running: "${r.centre}", "${r.cap}"`);
    await shot('run-after-wait', T);
  }

  console.log('\n[B] the season\'s end on the Stats page');
  const season = async () => (await api('GET', '/api/season')).body;
  let s = await season();
  note(`GET /api/season: state ${s.state}, endsAt ${s.endsAt}`);
  await page.goto(`${url}#/stats`);
  await page.reload();
  await page.waitForSelector('.st-ladder');
  const line = () => page.$eval('.st-season', (e) => ({ cls: e.className, chip: e.querySelector('b').textContent, text: e.textContent })).catch(() => null);
  check(await until(async () => !!(await line())), 'B. the line under the ladder\'s title is drawn');
  let l = await line();
  if (s.state === 'open') {
    check(l.cls.includes('t-open') && /^Ends in /.test(l.chip), `B. open: "${l.chip}"`);
    check(/Season 0 ends at .+ \(Sydney time\), in /.test(l.text), `B. open: "${l.text}"`);
    note('(the demo\'s clock runs at 8x, so the server reaches its end long before the page\'s countdown would: the real server runs at 1x)');
    await shot('season-open', '.st-ladder');
  }
  check(await until(async () => (await season()).state !== 'open', 8 * 60_000, 1000), `B. the ladder reaches the end time: the server says "${(await season()).state}"`);
  s = await season();
  if (s.state === 'ending') {
    await page.reload(); await page.waitForSelector('.st-season');
    l = await line();
    check(l.cls.includes('t-ending') && l.chip === 'Ending now', `B. ending: "${l.chip}" — ${l.text}`);
    await shot('season-ending', '.st-ladder');
  } else note('(the end came between matches: the server went straight to ended)');
  check(await until(async () => (await season()).state === 'ended', 6 * 60_000, 1000), 'B. the server says ended');
  await page.reload(); await page.waitForSelector('.st-season');
  l = await line();
  check(l.cls.includes('t-ended') && l.chip === 'Ended' && /final standings/.test(l.text), `B. ended: "${l.chip}" — ${l.text}`);
  await shot('season-ended', '.st-ladder');
  // Agent controls once the season has ended. The server still takes
  // auto-play on after the end (no refusal) but starts no match; the first
  // run of this check found the widget saying "Give it 15, 30 or 60 minutes
  // to play again" with Start live (season-check-s72-first-run.txt).
  const startOn = await api('PUT', '/api/play/auto-play', { on: true });
  note(`PUT /api/play/auto-play {on:true} after the end: ${startOn.status} (the server accepts it; no match will start)`);
  await api('PUT', '/api/play/auto-play', { on: false });
  await page.goto(`${url}#/`);
  for (const size of ['S', 'M', 'L']) {
    await setBoard(size);
    check(await until(async () => (await ringRead())?.centre === 'Ended', 8000), `B. ${size}: Agent controls' ring says "Ended"`);
    const r = await ringRead();
    const btns = await page.$$eval(`${T} [data-act="auto-play"], ${T} [data-act="play-time"]`, (bs) => bs.map((b) => ({ txt: b.textContent, dis: b.disabled, why: b.title })));
    const start = btns.find((b) => b.txt === 'Start');
    check(start && start.dis && start.why === 'Season 0 has ended: no new match starts.', `B. ${size}: Start is off, with the reason ("${start?.why}")`);
    const times = btns.filter((b) => /min$/.test(b.txt));
    check(times.every((b) => b.dis), `B. ${size}: the ${times.length} time buttons are off`);
    check(!/joins the next ladder round|play again/.test(r.text), `B. ${size}: nothing promises a next match`);
    if (size === 'S') check(r.note === 'Season over', `B. S: "${r.note}" under the name`);
    else check(/^Season 0 has ended: no new match starts\. Its ladder is the final standings\.$/.test(r.cap ?? ''), `B. ${size}: the caption "${r.cap}"`);
    await shot(`controls-ended-${size}`, T);
  }
  // The Agent match page: the switch off with the reason.
  await page.goto(`${url}#/match`); await page.reload(); await page.waitForSelector('#auto-play');
  const sw = await page.$eval('#auto-play', (b) => ({ dis: b.disabled, note: b.parentElement.querySelector('small')?.textContent }));
  check(sw.dis && sw.note === 'Season 0 has ended: no new match starts.', `B. Agent match: the auto-play switch is off, "${sw.note}"`);
  const live = await page.$eval('#m-live', (e) => e.textContent);
  check(!/joins the next ladder round/.test(live), `B. Agent match: "${live.trim().slice(0, 90)}"`);
} catch (e) {
  check(false, `the check stopped: ${e && e.stack || e}`);
}

console.log('\n[E] the page');
check(external.length === 0, `E. no external requests${external.length ? `: ${external.slice(0, 3).join(', ')}` : ''}`);
check(errors.length === 0, `E. no page errors${errors.length ? `: ${errors.slice(0, 4).join(' | ')}` : ''}`);
console.log(`\n${passes} PASS, ${fails} FAIL`);
await browser.close();
try { process.kill(-demo.pid); } catch { /* gone */ }
