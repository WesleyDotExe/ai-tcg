// Render session 58: Agent controls' time ring and time buttons on the
// server's play-time allowance (game session 76), driven in a headless
// browser against the real owner API with the game lane's long-lived
// ladder playing real matches (render/src/site/siteDemo.ts --ladder --speed 4).
//
//   T1 Agent controls at L on Nova's board: the 15 / 30 / 60 buttons live,
//      +15 / +30 disabled with the reason (no allowance yet).
//   T2 "30 min" clicked: the server's allowance is running, 30 minutes; the
//      ring shows 30 and "30 min left today", lit nearly full.
//   T3 "+15" clicked: the server's window is 45 minutes; the ring shows the
//      server's minutes left; the lit share drops as the page's clock runs
//      (the page's own count between reads, checked over a reload).
//   T4 at S and M: the ring's centre is the minutes; M says "min left today".
//   T5 Stop: auto-play off, the allowance gone, the ring Off; +15 disabled.
//   E  No external requests; no page errors.
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

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', '4'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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
    await page.waitForSelector(`${tile('live')}[data-size="${size}"]`);
  };
  const ring = () => page.$eval(`${tile('live')} .tring`, (r) => ({ cls: r.className, centre: r.querySelector('.tr-c').textContent, label: r.getAttribute('aria-label'), dash: r.querySelector('.tr-fg').getAttribute('stroke-dasharray') })).catch(() => null);
  const lit = (r) => { const [a, c] = r.dash.split(' ').map(Number); return a / c; };

  console.log('\n[T1] before any time is given');
  // From a clean start: auto-play off.
  await api('PUT', '/api/play/auto-play', { on: false });
  await board('L');
  check(await count(`${tile('live')} [data-act="play-time"][data-add="0"]:not([disabled])`) === 3, 'T1. 15 / 30 / 60 can be pressed');
  const addTitle = await page.$eval(`${tile('live')} [data-act="play-time"][data-add="1"]`, (b) => [b.disabled, b.title]);
  check(addTitle[0] === true && /Start with 15, 30 or 60/.test(addTitle[1]), `T1. +15 / +30 disabled: "${addTitle[1]}"`);
  check(!(await text(tile('live'))).includes('arrive with the server'), 'T1. no "waits for the server" note any more');

  console.log('\n[T2] 30 minutes');
  await page.click(`${tile('live')} [data-act="play-time"][data-min="30"][data-add="0"]`);
  check(await until(async () => { const a = (await api('GET', '/api/play')).body.autoPlay; return a.on && a.allowance?.state === 'running' && a.allowance.totalMinutes === 30; }), 'T2. the server runs a 30-minute allowance');
  check(await until(async () => (await ring())?.centre?.startsWith('30')), 'T2. the ring shows 30');
  let r = await ring();
  check(r && lit(r) > 0.95 && /30 min left/.test(r.label), `T2. lit ${r && Math.round(lit(r) * 100)}%, "${r && r.label}"`);
  check((await text(tile('live'))).includes('30 min left today'), 'T2. "30 min left today"');
  await shot('time-30', tile('live'));

  console.log('\n[T3] +15');
  await page.click(`${tile('live')} [data-act="play-time"][data-min="15"][data-add="1"]`);
  check(await until(async () => (await api('GET', '/api/play')).body.autoPlay.allowance?.totalMinutes === 45), 'T3. the server\'s window is 45 minutes');
  const srv = (await api('GET', '/api/play')).body.autoPlay.allowance;
  check(await until(async () => (await ring())?.centre === `${srv.minutesLeft}min`), `T3. the ring shows the server's ${srv.minutesLeft} min left`);
  r = await ring();
  const l1 = lit(r);
  note(`lit ${Math.round(l1 * 1000) / 10}% of the ring`);
  await shot('time-added', tile('live'));
  await wait(6000);
  await page.reload();
  await page.waitForSelector(`${tile('live')} .tring`);
  const l2 = lit(await ring());
  check(l2 < l1, `T3. the ring drains as time runs (${Math.round(l1 * 1000) / 10}% -> ${Math.round(l2 * 1000) / 10}%)`);

  console.log('\n[T4] S and M');
  for (const size of ['S', 'M']) {
    await board(size);
    const rr = await ring();
    const left = (await api('GET', '/api/play')).body.autoPlay.allowance.minutesLeft;
    check(rr && rr.centre === `${left}min`, `T4. ${size}: the ring's centre is ${left} min`);
    if (size === 'M') check((await text(tile('live'))).includes(`${left} min left today`), `T4. M: "${left} min left today"`);
    await shot(`time-${size}`, tile('live'));
  }

  console.log('\n[T5] Stop');
  await board('L');
  await page.click(`${tile('live')} [data-act="auto-play"][data-on="0"]`);
  check(await until(async () => { const a = (await api('GET', '/api/play')).body.autoPlay; return !a.on && a.allowance === null; }), 'T5. auto-play off, the allowance gone (the server)');
  check(await until(async () => (await ring())?.cls.includes('t-off')), 'T5. the ring is Off');
  check(await page.$eval(`${tile('live')} [data-act="play-time"][data-add="1"]`, (b) => b.disabled), 'T5. +15 disabled again');
  // Leave Nova playing as the demo had it.
  await api('PUT', '/api/play/auto-play', { on: true });
} catch (e) {
  check(false, `the check stopped: ${e && e.stack || e}`);
}

console.log('\n[E] the page');
check(external.length === 0, `E. no external requests${external.length ? `: ${external.slice(0, 3).join(', ')}` : ''}`);
check(errors.length === 0, `E. no page errors${errors.length ? `: ${errors.slice(0, 4).join(' | ')}` : ''}`);
console.log(`\n${passes} PASS, ${fails} FAIL`);
await browser.close();
try { process.kill(-demo.pid); } catch { /* gone */ }
process.exit(fails ? 1 : 0);
