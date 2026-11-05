// Render session 58: Agent controls' time ring and time buttons wired to the
// game lane's play-time allowance (game session 76; the owner's 2026-11-06
// Season 0 brief, section 1, "Countdown display, on every size"), driven in
// a headless browser against the real owner API with the long-lived ladder
// playing real matches (render/src/site/siteDemo.ts --ladder --speed 20: the
// server's clock runs 20x, so 15 minutes pass in 45 s).
//
//   A  "15 min" clicked at M: the server starts a 15-minute allowance; the
//      ring is lit, "15 min left today".
//   B  The ring drains: read again later, its minutes and its lit share are
//      the server's (GET /api/play's minutesLeft and secondsLeft / total).
//   C  "+15 min" at L adds to it (the server's endsAt moves 15 minutes).
//   D  Time runs out: "Finishing match" while Nova's last match plays (or,
//      if it runs out between rounds, straight to done), then "Done for
//      today" with auto-play off (stopped: timeUp); +15 refused, 15 / 30 /
//      60 can start again; Nova isn't paired again.
//   E  S shows the ring with minutes in the centre; no external requests;
//      no page errors.
//
//   node progress/render/evidence/site-check-s58.mjs [stills dir]

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

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', '20'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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
  try { await (el ?? page).screenshot({ path: resolve(OUT, `v2-s58-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000 }); } catch { note(`(the still "${name}" timed out)`); }
};
const tile = (type) => `#wgrid .wg[data-type="${type}"]`;
const text = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const count = (sel) => page.$$eval(sel, (x) => x.length);

try {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');
  const board = async (size) => {
    await api('PUT', '/api/board', { widgets: [{ id: 'w2', type: 'live', size }] });
    await page.reload();
    await page.waitForSelector(`${tile('live')}[data-size="${size}"] .tring`);
  };
  const ring = async () => page.$eval(`${tile('live')} .tring`, (e) => {
    const fg = e.querySelector('.tr-fg');
    const [a, c] = fg.getAttribute('stroke-dasharray').split(' ').map(Number);
    return { cls: e.className, centre: e.querySelector('.tr-c').textContent, label: e.getAttribute('aria-label'), lit: a / c };
  });

  // ---- A: 15 min ----
  console.log('\n[A] "15 min" at M');
  await board('M');
  const before = (await api('GET', '/api/play')).body.autoPlay;
  note(`before: on ${before.on}, allowance ${JSON.stringify(before.allowance)}`);
  check(before.allowance === null, 'A. no allowance to start with (auto-play on with no time limit)');
  const r0 = await ring();
  check(r0.cls.includes('t-open') && r0.centre === 'On', `A. the ring shows auto-play with no limit ("${r0.centre}")`);
  await page.click(`${tile('live')} [data-act="play-time"][data-min="15"][data-add="0"]`);
  check(await until(async () => (await api('GET', '/api/play')).body.autoPlay.allowance?.state === 'running'), 'A. the server started an allowance');
  const a1 = (await api('GET', '/api/play')).body.autoPlay.allowance;
  check(a1.totalMinutes === 15, `A. of 15 minutes (totalMinutes ${a1.totalMinutes}, ends ${a1.endsAt})`);
  await until(async () => (await ring()).cls.includes('t-run'));
  const r1 = await ring();
  const ac1 = await text(tile('live'));
  check(r1.cls.includes('t-run') && Number(r1.centre.replace('min', '')) >= 14, `A. the ring is lit (${(r1.lit * 100).toFixed(0)}%), "${r1.label}"`);
  check(/1[45] min left today/.test(ac1), 'A. the caption says the minutes left today');
  note(`toast: "${await text('.toast')}"`);
  await shot('ring-M-started', tile('live'));

  // ---- B: drains ----
  console.log('\n[B] the ring drains');
  await page.waitForTimeout(16000); // about 5 server minutes, one poll
  await page.reload();
  await page.waitForSelector(`${tile('live')} .tring`);
  const play2 = (await api('GET', '/api/play')).body.autoPlay;
  const r2 = await ring();
  note(`server: ${play2.allowance?.state}, ${play2.allowance?.minutesLeft} min (${play2.allowance?.secondsLeft} s) left; ring "${r2.label}", lit ${(r2.lit * 100).toFixed(0)}%`);
  if (play2.allowance?.state === 'running') {
    check(Math.abs(Number(r2.centre.replace('min', '')) - play2.allowance.minutesLeft) <= 1, `B. the ring's minutes are the server's (${r2.centre} vs ${play2.allowance.minutesLeft})`);
    check(Math.abs(r2.lit - play2.allowance.secondsLeft / (play2.allowance.totalMinutes * 60)) < 0.08, 'B. the lit share is the server\'s secondsLeft / total, within the read gap');
    check(r2.lit < r1.lit, 'B. less is lit than at the start');
  } else check(false, `B. still running to read a drained ring (${play2.allowance?.state})`);

  // ---- C: +15 at L ----
  console.log('\n[C] "+15 min" at L');
  await board('L');
  const pre = (await api('GET', '/api/play')).body.autoPlay;
  const addBtn = `${tile('live')} [data-act="play-time"][data-min="15"][data-add="1"]`;
  check(pre.canAddTime === true && !(await page.$eval(addBtn, (b) => b.disabled)), 'C. +15 is pressable (the server\'s canAddTime)');
  await page.click(addBtn);
  const moved = await until(async () => { const a = (await api('GET', '/api/play')).body.autoPlay.allowance; return a && Date.parse(a.endsAt) - Date.parse(pre.allowance.endsAt) === 15 * 60000; });
  check(moved, 'C. the server moved the end 15 minutes on');
  const a3 = (await api('GET', '/api/play')).body.autoPlay.allowance;
  await until(async () => Math.abs(Number((await ring()).centre.replace('min', '')) - a3.minutesLeft) <= 1);
  const r3 = await ring();
  check(r3.lit > r2.lit, `C. the ring fills up again ("${r3.label}", ${(r3.lit * 100).toFixed(0)}%)`);
  note(`toast: "${await text('.toast')}"`);
  await shot('ring-L-added', tile('live'));

  // ---- D: time up ----
  console.log('\n[D] time runs out');
  let sawFinishing = false, sawFinishingPage = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    const ap = (await api('GET', '/api/play')).body.autoPlay;
    if (ap.allowance?.state === 'finishing') {
      if (!sawFinishing) note(`finishing at ${new Date().toISOString()}`);
      sawFinishing = true;
      if (await until(async () => (await ring()).centre === 'Finishing match', 20000, 500)) {
        if (!sawFinishingPage) { sawFinishingPage = true; await shot('ring-L-finishing', tile('live')); note(`page: ${(await text(tile('live'))).slice(0, 160)}`); }
      }
    }
    if (ap.allowance?.state === 'done' || (!ap.on && ap.stopped?.reason === 'timeUp')) break;
    await page.waitForTimeout(1000);
  }
  if (sawFinishing) check(sawFinishingPage, 'D. while Nova\'s last match played, the ring said "Finishing match"');
  else note('the time ran out between rounds: straight to done (the server\'s other path)');
  const done = (await api('GET', '/api/play')).body.autoPlay;
  check(!done.on && done.stopped?.reason === 'timeUp' && done.allowance?.state === 'done', `D. the server: auto-play off, stopped "${done.stopped?.reason}", allowance ${done.allowance?.state}`);
  check(await until(async () => (await ring()).centre === 'Done for today', 25000, 500), 'D. the ring says "Done for today" (within one read)');
  const acd = await text(tile('live'));
  check(acd.includes('the time you gave your agent ran out'), 'D. the stop is explained as time up, not the rewards cap');
  check(await page.$eval(addBtn, (b) => b.disabled), 'D. +15 can\'t be pressed when done');
  check(!(await page.$eval(`${tile('live')} [data-act="play-time"][data-min="30"][data-add="0"]`, (b) => b.disabled)), 'D. 30 min can start it again');
  await shot('ring-L-done', tile('live'));
  // Not paired again: 20 s (about 7 server minutes, several rounds).
  let paired = false;
  for (let i = 0; i < 20; i++) { if ((await api('GET', '/api/play')).body.liveMatch) paired = true; await page.waitForTimeout(1000); }
  check(!paired, 'D. Nova isn\'t paired again (20 s of rounds at 20x)');

  // ---- E: S ----
  console.log('\n[E] S, then started again');
  await board('S');
  await page.click(`${tile('live')} [data-act="auto-play"][data-on="1"]`).catch(() => {});
  await until(async () => (await ring()).centre === 'On');
  await api('PUT', '/api/play/auto-play', { on: true, minutes: 60 });
  await page.reload();
  await page.waitForSelector(`${tile('live')} .tring`);
  const rs = await ring();
  check(rs.cls.includes('t-run') && /^\d+min$/.test(rs.centre), `E. at S the minutes sit in the ring's centre ("${rs.centre}")`);
  check((await count(`${tile('live')} [data-act="play-time"]`)) === 0, 'E. no time buttons at S (the brief: from M)');
  await shot('ring-S', tile('live'));
} catch (e) {
  check(false, `the check stopped: ${e && e.stack || e}`);
}

console.log('\n[F] the page');
check(external.length === 0, `F. no external requests${external.length ? `: ${external.slice(0, 3).join(', ')}` : ''}`);
check(errors.length === 0, `F. no page errors${errors.length ? `: ${errors.slice(0, 4).join(' | ')}` : ''}`);
console.log(`\n${passes} PASS, ${fails} FAIL`);
await browser.close();
try { process.kill(-demo.pid); } catch { /* gone */ }
process.exit(fails ? 1 : 0);
