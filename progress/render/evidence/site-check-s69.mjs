// Render session 69 (the render hardening pass): Agent controls take the
// server's words for the play-time allowance (`autoPlay.allowance.label`,
// owner 2026-11-06: "Time's up", not "Done for today"), and the personality
// dial's arrow keys make one save, not one per step. In a headless browser
// against the real owner API with the game lane's ladder playing at 8x
// (render/src/site/siteDemo.ts --ladder --speed 8: 15 minutes of play time
// run out in under two minutes of wall time, on the server's own clock; no
// response is rewritten).
//
//   A The allowance to its end: 15 min given; the ring runs; the server
//     reaches "finishing" (if the agent is in a match) and then "done"; at
//     each the ring's centre is the server's `label`, the caption and the
//     +15 / +30 buttons' reason say "Time's up", and no "Done for today" is
//     anywhere on the page.
//   B The dial by keyboard: three quick ArrowRights make ONE play-style save
//      (one PUT, one toast), on the third style along; the pointer and the
//      checked notch follow each key at once, before the save. One
//      ArrowRight then Tab saves at once (well under the 700 ms wait).
//      ArrowLeft then Enter saves at once. A click still saves at once.
//   E No external requests; no page errors.
//
//   node progress/render/evidence/site-check-s69.mjs [stills dir]

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

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', '8'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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
const styleSaves = [];
page.on('request', (r) => { if (r.method() === 'PUT' && /\/api\/agents\/[^/]+\/play-style$/.test(new URL(r.url()).pathname)) styleSaves.push({ at: Date.now(), body: r.postData() }); });

const api = (method, path, body) => page.evaluate(async ([method, path, body]) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}, [method, path, body]);
const shot = async (name, sel) => {
  const el = sel ? await page.$(sel) : null;
  try { await (el ?? page).screenshot({ path: resolve(OUT, `v2-s69-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000 }); } catch { note(`(the still "${name}" timed out)`); }
};
const tile = (type) => `#wgrid .wg[data-type="${type}"]`;
const T = tile('live');
const bodyText = () => page.evaluate(() => document.body.innerText);

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
  await page.waitForSelector(`${T}[data-size="L"] .tring`);
  const ring = () => page.$eval(`${T} .tring`, (r) => ({ cls: r.className, centre: r.querySelector('.tr-c').textContent, label: r.getAttribute('aria-label'), cap: r.closest('.wg').querySelector('.ac-cap')?.textContent ?? '', addWhy: r.closest('.wg').querySelector('[data-act="play-time"][data-add="1"]')?.getAttribute('title') ?? '', stopped: r.closest('.wg').innerText })).catch(() => null);
  const allowance = async () => (await api('GET', '/api/play')).body.autoPlay;

  console.log('\n[A] the allowance to its end, in the server\'s words');
  await page.click(`${T} [data-act="play-time"][data-min="15"][data-add="0"]`);
  check(await until(async () => (await allowance()).allowance?.state === 'running'), 'A. the server runs a 15-minute allowance');
  let a = await allowance();
  check(a.allowance.label === 'Running', `A. the server's label while running: "${a.allowance.label}"`);
  check(await until(async () => (await ring())?.cls.includes('t-run')), 'A. the ring runs, in minutes');
  await shot('time-running', T);
  // 15 minutes on the server's 8x clock: under two minutes of wall time.
  let sawFinishing = false;
  const t0 = Date.now();
  const ended = await until(async () => {
    const x = await allowance();
    const st = x.allowance?.state;
    if (st === 'finishing' && !sawFinishing) {
      sawFinishing = true;
      note(`finishing after ${Math.round((Date.now() - t0) / 1000)} s (label "${x.allowance.label}")`);
      // Up to one 15 s status read: at 8x the server's clock outruns the page's
      // own count of the time left, so the page's 5 s reads near the end (on
      // its own clock) don't start; at the real pace they do (site-check-s59).
      const shown = await until(async () => (await ring())?.centre === x.allowance.label, 20000, 200);
      const r = await ring();
      check(shown && r.cls.includes('t-finish'), `A. finishing: the ring's centre is the server's label, "${r?.centre}"`);
      check(/Time's up/.test(r?.cap ?? ''), `A. finishing: the caption "${r?.cap}"`);
      await shot('time-finishing', T);
    }
    return st === 'done';
  }, 6 * 60_000, 500);
  check(ended, `A. the server says done after ${Math.round((Date.now() - t0) / 1000)} s`);
  if (!sawFinishing) note('(the agent was between matches when the time ran out, so the server went straight to done)');
  a = await allowance();
  check(a.allowance?.label === "Time's up", `A. the server's label when done: "${a.allowance?.label}"`);
  check(a.on === false && a.stopped?.reason === 'timeUp', 'A. auto-play is off, stopped for timeUp');
  // The 5 s status read near the end brings the server's word within seconds.
  check(await until(async () => (await ring())?.centre === a.allowance.label, 20000, 250), 'A. done: the ring\'s centre is the server\'s label');
  const r = await ring();
  check(r.cls.includes('t-done'), `A. done: tone done (${r.cls})`);
  check(r.cap === "Time's up. Give it 15, 30 or 60 minutes to play again; the day resets at midnight (Sydney).", `A. done: the caption "${r.cap}"`);
  check(r.addWhy === "Time's up: start again with 15, 30 or 60 minutes.", `A. done: +15 / +30 say why: "${r.addWhy}"`);
  check(r.label === "Nova: Time's up" || /Time's up$/.test(r.label), `A. done: the ring's accessible name "${r.label}"`);
  const txt = await bodyText();
  check(!/done for today/i.test(txt), 'A. no "Done for today" anywhere on the page');
  const presetsOn = await page.$$eval(`${T} [data-act="play-time"][data-add="0"]`, (b) => b.every((x) => !x.disabled));
  check(presetsOn, 'A. done: 15 / 30 / 60 can start it again');
  await shot('time-up', T);

  console.log('\n[B] the dial by keyboard: one save per choice');
  const play = (await api('GET', '/api/play')).body;
  const styles = play.playStyles.map((s) => s.id);
  const agentId = play.connectedAgent.agentId;
  const cur = async () => (await api('GET', '/api/play')).body.connectedAgent.playStyle;
  const dial = () => page.$eval(`${T} .dn-knob`, (k) => ({ checked: [...k.querySelectorAll('[role="radio"][aria-checked="true"]')].map((b) => b.dataset.style), stops: [...k.querySelectorAll('[tabindex="0"]')].map((b) => b.dataset.style), focus: document.activeElement?.dataset?.style ?? null, rot: k.querySelector('.dn-face i').style.transform, name: k.parentElement.querySelector('.dn-txt b').textContent }));
  // Every toast shown, by watching the one toast element's words change.
  await page.evaluate(() => { window.__toasts = []; const t = document.querySelector('#toast'); new MutationObserver(() => { if (t.classList.contains('on')) window.__toasts.push(t.textContent); }).observe(t, { attributes: true, childList: true, characterData: true, subtree: true }); });
  const toasts = () => page.evaluate(() => [...new Set(window.__toasts)]);
  const start = await cur();
  const i0 = styles.indexOf(start);
  const at = (k) => styles[(i0 + k + styles.length) % styles.length];
  await page.focus(`${T} [data-act="play-style"][data-style="${start}"]`);
  const s0 = styleSaves.length;
  const rots = [];
  for (let k = 1; k <= 3; k++) {
    await page.keyboard.press('ArrowRight');
    const d = await dial();
    rots.push(d.rot);
    check(d.checked[0] === at(k) && d.focus === at(k) && d.stops[0] === at(k), `B. ArrowRight ${k}: shown at once on ${at(k)} (checked, focus, tab stop; name "${d.name}")`);
    await wait(150);
  }
  check(new Set(rots).size === 3, `B. the pointer turned with each key: ${rots.join(' -> ')}`);
  check(styleSaves.length === s0, `B. no save while the keys are moving (${styleSaves.length - s0})`);
  const tKeys = Date.now();
  check(await until(async () => (await cur()) === at(3), 5000, 100), `B. then the server's style is ${at(3)}, three along`);
  await wait(1500);
  const made = styleSaves.slice(s0);
  check(made.length === 1 && made[0].body.includes(at(3)), `B. ONE save for three keys (${made.length}: ${made.map((m) => m.body).join(' ')})`);
  check(made.length && made[0].at - tKeys >= 400, `B. it went ${made.length ? made[0].at - tKeys : '?'} ms after the last key`);
  const ts = await toasts();
  note(`toasts: ${JSON.stringify(ts)}`);
  check(ts.filter((t) => /from the next match/.test(t)).length === 1, 'B. one style toast for the three keys');
  let d = await dial();
  check(d.checked[0] === at(3) && d.focus === at(3), `B. after the save: checked ${d.checked[0]}, focus ${d.focus}`);
  await shot('dial-one-save', T);

  // One key then Tab: saved at once.
  const s1 = styleSaves.length;
  await page.keyboard.press('ArrowRight');
  const tTab = Date.now();
  await page.keyboard.press('Tab');
  check(await until(async () => styleSaves.length > s1, 3000, 20), 'B. ArrowRight then Tab: saved');
  check(styleSaves.length > s1 && styleSaves[s1].at - tTab < 400, `B. ...at once (${styleSaves.length > s1 ? styleSaves[s1].at - tTab : '?'} ms)`);
  check(await until(async () => (await cur()) === at(4), 5000), `B. ...as ${at(4)}`);
  await wait(800);

  // ArrowLeft then Enter: saved at once.
  await page.focus(`${T} [data-act="play-style"][data-style="${at(4)}"]`);
  const s2 = styleSaves.length;
  await page.keyboard.press('ArrowLeft');
  const tEnter = Date.now();
  await page.keyboard.press('Enter');
  check(await until(async () => styleSaves.length > s2, 3000, 20) && styleSaves[s2].at - tEnter < 400, `B. ArrowLeft then Enter: saved at once (${styleSaves.length > s2 ? styleSaves[s2].at - tEnter : '?'} ms)`);
  check(await until(async () => (await cur()) === at(3), 5000), `B. ...as ${at(3)}`);
  await wait(1200);
  check(styleSaves.length === s2 + 1, `B. ...once (${styleSaves.length - s2})`);
  d = await dial();
  check(d.focus === at(3), `B. focus stays on the dial (${d.focus})`);

  // A click still saves at once.
  const s3 = styleSaves.length;
  const tClick = Date.now();
  await page.click(`${T} [data-act="play-style"][data-style="${start}"]`);
  check(await until(async () => styleSaves.length > s3, 3000, 20) && styleSaves[s3].at - tClick < 400, 'B. a click saves at once');
  check(await until(async () => (await cur()) === start, 5000), `B. ...back to ${start}`);
  await api('PUT', `/api/agents/${agentId}/play-style`, { style: start });
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
