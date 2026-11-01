// Render session 45: the owner website's look (Season 0 render item 2),
// driven in a headless browser against the real owner API (render/src/site/
// siteDemo.ts: a fresh season database, the game lane's owner API unchanged,
// the site host in front). The liquid WebGL background, its pacing and
// pauses, the background picker saved to the account, the theme saved too,
// who am I (the display name, Admin), and the wallet in the top bar.
// Prints one line per check and writes stills.
//
//   node progress/render/evidence/site-check-s45.mjs [stills dir]
// (PW_CORE as in render/ci/browser-check.mjs, if playwright isn't found.)
//
// The browser draws WebGL in software here (SwiftShader: no GPU on the
// machine this runs on), so the frame rate measured is a floor, not what a
// Mac's GPU does.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = resolve(process.argv[2] ?? resolve(ROOT, 'progress/render/evidence'));
mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  const tries = [process.env.PW_CORE && pathToFileURL(resolve(process.env.PW_CORE)).href, 'playwright-core', 'playwright', '/opt/node-tools/node_modules/playwright-core/index.mjs'].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(t); if (m.chromium) return m.chromium; } catch { /* next */ }
  }
  throw new Error('playwright-core not found (set PW_CORE to its index.mjs)');
}

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'] });
const url = await new Promise((ok, fail) => {
  let buf = '';
  demo.stdout.on('data', (d) => { buf += d; const m = /\[site-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
  demo.stderr.on('data', (d) => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
  demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
  setTimeout(() => fail(new Error('the demo took over 60 s to start')), 60000);
});

let passes = 0, fails = 0;
const check = (ok, line) => { if (ok) passes++; else fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); };
const note = (line) => console.log(`      ${line}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const chromium = await loadPlaywright();
// Software WebGL (SwiftShader): this machine has no GPU.
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const errors = [];
const external = [];
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:')) external.push(r.url()); });
  return { ctx, page };
}
const S = (page) => page.evaluate(() => window.__site.state());
const L = (page) => page.evaluate(() => window.__site.liquid());
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `v2-s45-site-${name}.jpg`), type: 'jpeg', quality: 82 });
async function signIn(page, login = 'nova') {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', login);
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#shell:not([hidden])');
}
const go = async (page, id) => { await page.click(`a[data-page="${id}"]`); await page.waitForFunction((id) => window.__site.state().page === id, id); };
// Frames drawn over a window of real time.
async function framesOver(page, ms) {
  const a = await L(page); await wait(ms); const b = await L(page);
  return { frames: b.frames - a.frames, clock: b.clock - a.clock, after: b };
}
// The canvas's pixels, as the screen shows them (a screenshot of the whole
// window's background, with the shell hidden for the moment so only the
// background is in it).
async function bgShot(page) {
  await page.evaluate(() => { document.getElementById('shell').style.visibility = 'hidden'; });
  const buf = await page.screenshot({ type: 'png' });
  await page.evaluate(() => { document.getElementById('shell').style.visibility = ''; });
  return buf;
}
const toastText = (page) => page.evaluate(() => { const t = document.querySelector('#toast'); return t.classList.contains('on') ? t.textContent : null; });
const pick = async (page, id) => {
  await page.click(`#bg-picker .sw[data-bg="${id}"]`);
  await page.waitForFunction((id) => { const s = window.__site.state(); return s.settings && s.settings.background === id; }, id);
};

try {
  const { ctx, page } = await open();
  // ---- A. the sign-in screen covers the background: nothing is drawn ----
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await wait(300);
  let l = await L(page);
  check(l && l.pause === 'covered' && l.pending === 0, `A. on sign-in the liquid is paused (covered), no animation frame requested (pause ${l?.pause}, pending ${l?.pending})`);
  let f = await framesOver(page, 800);
  check(f.frames === 0, `A. ... and draws no frames while sign-in is up (${f.frames} in 0.8 s)`);

  // ---- B. signed in: who am I, the wallet ----
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#shell:not([hidden])');
  let s = await S(page);
  check(s.me && s.me.name === 'Nova' && s.me.isAdmin === true, `B. GET /api/me: display name "${s.me?.name}", house admin ${s.me?.isAdmin}`);
  check((await page.textContent('#acct-btn')) === 'N' && (await page.getAttribute('#acct-btn', 'aria-label')) === 'Account: Nova', 'B. the account button shows the display name\'s letter, labelled with the name');
  await page.click('#acct-btn');
  check((await page.textContent('#acct-name')) === 'Nova' && (await page.textContent('#acct-kind')) === '@nova · House admin', `B. the account menu: "${await page.textContent('#acct-name')}", "${await page.textContent('#acct-kind')}"`);
  await page.click('#title');
  const w = s.wallet;
  const shown = await page.$$eval('#wallet .cur b', (bs) => bs.map((b) => b.textContent));
  check(w && w.credits > 0 && shown[0] === w.credits.toLocaleString('en-US') && shown[1] === w.packPoints.toLocaleString('en-US'), `B. the top bar shows the wallet's credits ${shown[0]} and pack points ${shown[1]} (GET /api/wallet: ${w?.credits}, ${w?.packPoints})`);
  check((await page.textContent('#open-btn .ocount')) === '3' && (await page.getAttribute('#open-btn', 'aria-label')) === 'Open 3 packs', 'B. the Open button counts the 3 unopened packs ("Open 3 packs")');
  check(s.settings && s.settings.background === 'glacier' && s.settings.theme === 'system' && s.background === 'glacier', 'B. GET /api/account/settings: a new account reads Glacier and System');

  // ---- C. the liquid runs: low resolution, about 30 fps, moving ----
  await wait(600);
  l = await L(page);
  check(l.pause === null && l.width === 432 && l.height === 270, `C. the liquid draws at 0.3 of the window: ${l.width} x ${l.height} for 1440 x 900 (pause ${l.pause})`);
  // Software WebGL can't hold 30 at 0.3: the liquid measures itself and
  // steps its resolution down (0.3 -> 0.2 -> 0.14), a window at a time.
  const steps = [];
  for (let i = 0; i < 12; i++) {
    await wait(1000);
    const x = await L(page);
    if (!steps.length || steps[steps.length - 1].scale !== x.scale) steps.push({ t: i + 1, scale: x.scale, fps: x.fps, w: x.width, h: x.height });
  }
  note(`resolution steps (s, scale, last window's fps, canvas): ${steps.map((x) => `${x.t}s ${x.scale} ${x.fps == null ? '-' : x.fps.toFixed(1)} ${x.w}x${x.h}`).join(' | ')}`);
  f = await framesOver(page, 3000);
  const fps = f.frames / 3;
  l = await L(page);
  check(l.scale < 0.3 && fps >= 20, `C. too slow at 0.3 (software WebGL), it stepped down to ${l.scale} (${l.width} x ${l.height}) and now draws ${fps.toFixed(1)} fps`);
  check(fps <= 31.5, `C. ... never more than about 30 a second (${fps.toFixed(1)} over 3 s)`);
  check(f.clock > 3 * 0.85 && f.clock < 3 * 1.05, `C. the liquid's clock ran with real time while drawing (${f.clock.toFixed(2)} s in 3 s)`);
  const a1 = await bgShot(page); await wait(1500); const a2 = await bgShot(page);
  check(!a1.equals(a2), 'C. the background moves: two screenshots 1.5 s apart differ');
  await shot(page, 'home-glacier-light');

  // ---- D. a hidden tab pauses it; coming back carries on, no jump ----
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await wait(100);
  l = await L(page);
  f = await framesOver(page, 1500);
  check(l.pause === 'hidden' && l.pending === 0 && f.frames === 0, `D. tab hidden: paused (${l.pause}), no frame requested (${l.pending}), ${f.frames} frames in 1.5 s`);
  const clockBefore = (await L(page)).clock;
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await wait(400);
  l = await L(page);
  check(l.pause === null && l.frames > 0 && l.clock - clockBefore < 0.6, `D. tab shown again: drawing, and the clock carried on (+${(l.clock - clockBefore).toFixed(2)} s for 0.4 s shown, not the 1.5 s hidden)`);

  // ---- E. the picker, saved to the account ----
  await go(page, 'settings');
  const names = await page.$$eval('#bg-picker .sw span', (xs) => xs.map((x) => x.textContent));
  check(names.join(',') === 'Glacier,Ocean,Aurora,Sunset,Lavender,Graphite,Plain black,Plain purple', `E. Settings -> Display: 8 swatches, in order (${names.join(', ')})`);
  check((await page.getAttribute('#bg-picker .sw[data-bg="glacier"]', 'aria-checked')) === 'true' && (await page.getAttribute('#bg-picker', 'role')) === 'radiogroup', 'E. Glacier is checked; the picker is a radio group');
  await page.locator('h3', { hasText: 'Display' }).scrollIntoViewIfNeeded();
  await shot(page, 'picker-light');
  const patches = [];
  page.on('request', (r) => { if (r.method() === 'PATCH') patches.push(r.postData()); });
  for (const id of ['ocean', 'aurora', 'sunset', 'lavender', 'graphite']) {
    await pick(page, id);
    await wait(250);
    const st = await S(page);
    const ok = st.background === id && (await page.getAttribute(`#bg-picker .sw[data-bg="${id}"]`, 'aria-checked')) === 'true' && (await page.evaluate(() => document.body.dataset.bg)) === id;
    check(ok, `E. ${id}: PATCH saved it (the server answered "${st.settings.background}"), the page draws it, its swatch is checked`);
    await go(page, 'home'); await wait(400); await shot(page, `home-${id}-light`); await go(page, 'settings');
  }
  check(patches.length === 5 && patches.every((p) => Object.keys(JSON.parse(p)).join() === 'background'), `E. each pick sent one PATCH naming only the background (${patches.length}: ${patches.map((p) => JSON.parse(p).background).join(', ')})`);
  // Keyboard: arrows move the radio group.
  await page.focus('#bg-picker .sw[data-bg="graphite"]');
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => window.__site.state().settings.background === 'lavender');
  check((await page.evaluate(() => document.activeElement?.dataset?.bg)) === 'lavender', 'E. keyboard: ArrowLeft from Graphite picks and focuses Lavender');

  // ---- F. the theme, saved too; the liquid fades between versions ----
  await pick(page, 'glacier');
  await page.click('#theme-seg button[data-v="dark"]');
  await page.waitForFunction(() => window.__site.state().settings.theme === 'dark');
  await wait(250);
  const mid = (await L(page)).darkness;
  await wait(950);
  const near = (await L(page)).darkness;
  await wait(1800);
  const end = (await L(page)).darkness;
  check(mid > 0.05 && mid < 0.8 && near > 0.85 && end === 1, `F. Dark saved to the account; the liquid fades to its dark version over about a second (darkness ${mid.toFixed(2)} at 0.25 s, ${near.toFixed(2)} at 1.2 s, ${end} at 3 s)`);
  await go(page, 'home'); await wait(300); await shot(page, 'home-glacier-dark');
  await go(page, 'settings');
  await pick(page, 'aurora'); await go(page, 'home'); await wait(400); await shot(page, 'home-aurora-dark'); await go(page, 'settings');

  // ---- G. a plain background: always dark, no canvas, nothing drawn ----
  await page.click('#theme-seg button[data-v="light"]');
  await page.waitForFunction(() => window.__site.state().settings.theme === 'light');
  await pick(page, 'purple');
  await wait(200);
  l = await L(page);
  const plain = await page.evaluate(() => ({ drawn: document.body.dataset.theme, canvas: document.getElementById('liquid').hidden, bg: getComputedStyle(document.getElementById('bg')).backgroundColor }));
  f = await framesOver(page, 1000);
  check(plain.drawn === 'dark' && (await S(page)).theme === 'light', `G. Plain purple with the theme set to Light: the page draws dark (${plain.drawn}); the owner's Light is kept for when a liquid comes back`);
  check(plain.canvas === true && l.pause === 'plain' && l.pending === 0 && f.frames === 0 && plain.bg === 'rgb(36, 23, 79)', `G. ... the canvas is hidden, nothing drawn (${f.frames} frames), the background is the plain colour (${plain.bg})`);
  await go(page, 'home'); await wait(200); await shot(page, 'home-plain-purple'); await go(page, 'settings');

  // ---- H. on the account: another browser reads it before any click ----
  await pick(page, 'sunset');
  await page.click('#theme-seg button[data-v="dark"]');
  await page.waitForFunction(() => window.__site.state().settings.theme === 'dark');
  {
    const b = await open();
    await signIn(b.page);
    const st = await S(b.page);
    const drawnBg = await b.page.evaluate(() => document.body.dataset.bg);
    check(st.background === 'sunset' && st.theme === 'dark' && drawnBg === 'sunset' && st.drawn === 'dark', `H. a second browser, signed in fresh: Sunset and Dark from the account (drawn ${drawnBg}, ${st.drawn})`);
    // Rook is a player: no Admin.
    await b.page.click('#acct-btn'); await b.page.click('#sign-out'); await b.page.click('[data-a="yes"]');
    await b.page.waitForSelector('#signin:not([hidden])');
    await signIn(b.page, 'rook');
    const rs = await S(b.page);
    await go(b.page, 'settings');
    const hasAdmin = await b.page.locator('h3', { hasText: 'Admin' }).count();
    check(rs.me.isAdmin === false && hasAdmin === 0 && (await b.page.textContent('#acct-kind')) === '@rook · Owner account' && rs.background === 'glacier', `H. Rook (a player): no Admin section, "${await b.page.textContent('#acct-kind')}", their own Glacier (settings are per account)`);
    const rn = rs.wallet.unopenedPacks.length;
    check(rn > 0 && (await b.page.getAttribute('#open-btn', 'aria-label')) === `Open ${rn} packs` && (await b.page.textContent('#open-btn .ocount')) === String(rn), `H. Rook's own wallet: the starter's ${rn} packs on the Open button`);
    await b.ctx.close();
  }
  const adminCount = await page.locator('h3', { hasText: 'Admin' }).count();
  check(adminCount === 1, 'H. Nova (the house admin) sees Settings -> Admin');

  // ---- I. a refusal: the change is put back, the server's words shown ----
  await page.route('**/api/account/settings', (r) => r.request().method() === 'PATCH' ? r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: '"background" must be one of glacier, ocean' }) }) : r.continue());
  await page.click('#bg-picker .sw[data-bg="ocean"]');
  await page.waitForFunction(() => document.querySelector('#toast').classList.contains('on'));
  const t = await toastText(page);
  s = await S(page);
  check(s.background === 'sunset' && (await page.evaluate(() => document.body.dataset.bg)) === 'sunset' && t === '"background" must be one of glacier, ocean.', `I. the server refuses a pick: the page goes back to Sunset and says why ("${t}")`);
  await page.unroute('**/api/account/settings');

  // ---- J. reduce motion: one still frame, redrawn only on a change ----
  {
    const b = await open({ reducedMotion: 'reduce' });
    await signIn(b.page);
    await wait(500);
    const l0 = await L(b.page);
    const f0 = await framesOver(b.page, 2000);
    const p1 = await bgShot(b.page); await wait(800); const p2 = await bgShot(b.page);
    check(l0.pause === 'still' && l0.pending === 0 && l0.frames === 1 && f0.frames === 0 && p1.equals(p2), `J. reduce motion: still (${l0.pause}), ${l0.frames} frame drawn, ${f0.frames} more in 2 s, two screenshots identical`);
    await go(b.page, 'settings');
    await pick(b.page, 'ocean');
    const l1 = await L(b.page);
    check(l1.frames === l0.frames + 1 && l1.darkness === 1, `J. ... a new background draws exactly one new frame, at the dark version straight away (no fade): frames ${l0.frames} -> ${l1.frames}`);
    await pick(b.page, 'sunset');
    await b.ctx.close();
  }

  // ---- K. reduce transparency: solid panels ----
  {
    const b = await open();
    const cdp = await b.ctx.newCDPSession(b.page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    await signIn(b.page);
    const css = await b.page.evaluate(() => { const p = getComputedStyle(document.querySelector('.wg')); const side = getComputedStyle(document.querySelector('.side')); return { filter: p.backdropFilter, bg: p.backgroundColor, side: side.backdropFilter }; });
    check(css.filter === 'none' && css.side === 'none' && !/rgba\(.*, 0\.\d+\)$/.test(css.bg), `K. reduce transparency: panels and sidebar unblurred and solid (${css.bg}, backdrop ${css.filter})`);
    await b.ctx.close();
  }

  // ---- L. no WebGL: the still gradient is the background ----
  {
    const b = await open();
    await b.page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { return /webgl/.test(t) ? null : g.call(this, t, ...r); }; });
    await signIn(b.page);
    const st = await b.page.evaluate(() => ({ hidden: document.getElementById('liquid').hidden, bg: getComputedStyle(document.getElementById('bg')).backgroundImage, liquid: window.__site.liquid() }));
    // Sunset's dark version (the account says Dark): colours 1, 3 and 4.
    check(st.liquid.pause === 'no-webgl' && st.hidden === true && st.bg === 'linear-gradient(135deg, rgb(26, 13, 20), rgb(51, 20, 51) 55%, rgb(77, 33, 26))', `L. no WebGL: the canvas hides and the account's Sunset (dark) shows as its still gradient (${st.bg})`);
    await shot(b.page, 'no-webgl-sunset');
    await b.ctx.close();
  }

  // ---- M. a narrow window: the wallet and picker fit ----
  await page.setViewportSize({ width: 700, height: 900 });
  await go(page, 'settings');
  await wait(300);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const lw = await L(page);
  check(over <= 0 && lw.width === Math.round(700 * lw.scale), `M. a 700 px window: nothing spills sideways (${over} px); the canvas follows to ${lw.width} x ${lw.height} (scale ${lw.scale})`);
  await page.locator('h3', { hasText: 'Display' }).scrollIntoViewIfNeeded();
  await shot(page, 'narrow-picker');

  check(errors.length === 0, `Z. no page errors (${errors.length}${errors.length ? ': ' + errors[0] : ''})`);
  check(external.length === 0, `Z. no request leaves the site's origin (${external.length})`);
  await ctx.close();
} catch (err) {
  fails++;
  console.log('FAIL  the run stopped: ' + (err && err.stack || err));
} finally {
  await browser.close();
  demo.kill('SIGTERM');
}
console.log(`\n${passes} passed, ${fails} failed: ${fails ? 'FAIL' : 'ALL PASS'}`);
process.exit(fails ? 1 : 0);
