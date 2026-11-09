// Render session 59 (the render hardening pass): Agent controls' ring ticks
// once a second between the server's reads, the status read comes every 5 s
// near the end of the allowance (carried over from closed PR #137), and the
// personality dial is a radio group the keyboard drives. In a headless
// browser against the real owner API with the game lane's ladder playing
// (render/src/site/siteDemo.ts --ladder --speed 1, so the server's clock is
// the page's).
//
//   T1 15 min given: over 6 s with no read of GET /api/play in between, the
//      ring's arc shortens at least 4 times and its label stays the
//      server's minutes; the reads come 15 s apart.
//   T2 Near the end (the browser rewrites GET /api/play's allowance to 20 s
//      left, everything else the server's): the reads come every 5 s; the
//      ring counts to zero on the page's clock and says "Finishing match";
//      the rewrite stopped, the reads go back to 15 s.
//   T3 The dial by keyboard: one tab stop (the checked notch); ArrowRight
//      chooses the next style (saved on the server, focus and aria-checked
//      follow), ArrowLeft back, End the last, Home the first; Enter does
//      nothing new.
//   E  No external requests; no page errors.
//
//   node progress/render/evidence/site-check-s59.mjs [stills dir]

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

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', '1'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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
  try { await (el ?? page).screenshot({ path: resolve(OUT, `v2-s59-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000 }); } catch { note(`(the still "${name}" timed out)`); }
};
const tile = (type) => `#wgrid .wg[data-type="${type}"]`;
const text = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const count = (sel) => page.$$eval(sel, (x) => x.length);


const reads = [];
page.on('request', (r) => { if (r.method() === 'GET' && new URL(r.url()).pathname === '/api/play') reads.push(Date.now()); });
const gaps = (from) => { const t = reads.filter((x) => x >= from); return t.slice(1).map((x, i) => Math.round((x - t[i]) / 100) / 10); };

try {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');
  await api('PUT', '/api/board', { widgets: [{ id: 'w2', type: 'live', size: 'L' }] });
  await api('PUT', '/api/play/auto-play', { on: false });
  await page.reload();
  await page.waitForSelector(`${tile('live')}[data-size="L"] .tring`);
  const ring = () => page.$eval(`${tile('live')} .tring`, (r) => ({ cls: r.className, centre: r.querySelector('.tr-c').textContent, label: r.getAttribute('aria-label'), dash: r.querySelector('.tr-fg').getAttribute('stroke-dasharray'), cap: r.closest('.wg').querySelector('.ac-cap')?.textContent })).catch(() => null);

  console.log('\n[T1] the ring ticks between reads');
  await page.click(`${tile('live')} [data-act="play-time"][data-min="15"][data-add="0"]`);
  check(await until(async () => (await api('GET', '/api/play')).body.autoPlay.allowance?.state === 'running'), 'T1. the server runs a 15-minute allowance');
  check(await until(async () => (await ring())?.cls.includes('t-run')), 'T1. the ring is running');
  // Wait for a read, then sample the ring once a second for 6 s.
  const n0 = reads.length;
  await until(async () => reads.length > n0, 20000, 100);
  const tStart = Date.now();
  const dashes = [];
  for (let i = 0; i < 7; i++) { dashes.push((await ring()).dash); await wait(1000); }
  const readsIn = reads.filter((x) => x > tStart + 200 && x < tStart + 6000).length;
  const changes = dashes.slice(1).filter((d, i) => d !== dashes[i]).length;
  note(`arc: ${dashes.join(' | ')}`);
  check(readsIn === 0, `T1. no status read during the 6 s (${readsIn})`);
  check(changes >= 4, `T1. the arc shortened ${changes} times in 6 s with no read`);
  const lits = dashes.map((d) => Number(d.split(' ')[0]));
  check(lits.every((x, i) => i === 0 || x <= lits[i - 1]), 'T1. it only ever shortens');
  const srv = (await api('GET', '/api/play')).body.autoPlay.allowance;
  const rr = await ring();
  check(Math.abs(Number(rr.centre.replace('min', '')) - srv.minutesLeft) <= 1 && /min left today/.test(rr.cap ?? ''), `T1. the ring's minutes are the server's (${rr.centre} vs ${srv.minutesLeft}), "${rr.cap}"`);
  await shot('tick-running', tile('live'));
  const t1 = Date.now();
  await wait(32000);
  const g1 = gaps(t1);
  check(g1.length >= 1 && g1.every((g) => g > 13 && g < 17), `T1. reads 15 s apart far from the end: ${g1.join(', ')} s`);

  console.log('\n[T2] near the end');
  let fakeEnd = Date.now() + 20000;
  await page.route('**/api/play', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const res = await route.fetch();
    const body = await res.json();
    const al = body.autoPlay?.allowance;
    if (al) {
      const left = Math.max(0, Math.ceil((fakeEnd - Date.now()) / 1000));
      body.autoPlay.allowance = { ...al, endsAt: new Date(fakeEnd).toISOString(), secondsLeft: left, minutesLeft: Math.ceil(left / 60), state: left > 0 ? 'running' : 'finishing' };
    }
    await route.fulfill({ response: res, json: body });
  });
  const t2 = Date.now();
  // The next read (up to 15 s away) brings the rewritten allowance.
  check(await until(async () => (await ring())?.centre === '1min', 20000), 'T2. the ring shows the last minute');
  await shot('tick-last-seconds', tile('live'));
  check(await until(async () => (await ring())?.centre === 'Finishing match', 30000, 250), 'T2. at zero on the page\'s clock: "Finishing match"');
  const fin = await ring();
  check(fin.cls.includes('t-finish') && /Time's up/.test(fin.cap ?? ''), `T2. tone finish, "${fin.cap}"`);
  await shot('tick-finishing', tile('live'));
  await wait(11000);
  const near = gaps(t2).slice(1);
  note(`read gaps from the first rewritten read: ${near.join(', ')} s`);
  check(near.length >= 3 && near.every((g) => g > 4 && g < 6.5), 'T2. near the end and finishing, reads every 5 s');
  await page.unroute('**/api/play');
  const t3 = Date.now();
  check(await until(async () => (await ring())?.cls.includes('t-run'), 10000), 'T2. the rewrite stopped: the server\'s running allowance is back');
  await wait(33000);
  const back = gaps(t3).slice(1);
  check(back.length >= 1 && back.every((g) => g > 13 && g < 17), `T2. reads 15 s apart again: ${back.join(', ')} s`);

  console.log('\n[T3] the dial by keyboard');
  const styles = (await api('GET', '/api/play')).body.playStyles.map((s) => s.id);
  const cur = async () => (await api('GET', '/api/play')).body.connectedAgent.playStyle;
  const dial = () => page.$eval(`${tile('live')} .dn-knob`, (k) => ({ role: k.getAttribute('role'), checked: [...k.querySelectorAll('[role="radio"][aria-checked="true"]')].map((b) => b.dataset.style), stops: [...k.querySelectorAll('[tabindex="0"]')].map((b) => b.dataset.style), focus: document.activeElement?.dataset?.style ?? null }));
  let d = await dial();
  const start = await cur();
  check(d.role === 'radiogroup' && d.checked.length === 1 && d.checked[0] === start && d.stops.length === 1 && d.stops[0] === start, `T3. a radio group, one checked and one tab stop: ${start}`);
  await page.focus(`${tile('live')} [data-act="play-style"][data-style="${start}"]`);
  const i0 = styles.indexOf(start);
  const steps = [['ArrowRight', styles[(i0 + 1) % styles.length]], ['ArrowLeft', start], ['End', styles[styles.length - 1]], ['Home', styles[0]]];
  for (const [key, want] of steps) {
    if (key === 'End' && start === want) continue;
    await page.keyboard.press(key);
    const ok = await until(async () => (await cur()) === want, 8000);
    check(ok, `T3. ${key}: the server's style is ${want}`);
    const settled = await until(async () => { const x = await dial(); return x.checked[0] === want && x.focus === want && x.stops[0] === want; }, 8000);
    d = await dial();
    check(settled, `T3. ${key}: checked ${d.checked[0]}, focus ${d.focus}, tab stop ${d.stops[0]}`);
  }
  await shot('dial-keyboard', tile('live'));
  const before = await cur();
  await page.keyboard.press('Enter');
  await wait(1500);
  check((await cur()) === before, 'T3. Enter on the checked notch changes nothing');
  await api('PUT', `/api/agents/${(await api('GET', '/api/play')).body.connectedAgent.agentId}/play-style`, { style: start });
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
