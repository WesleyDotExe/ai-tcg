// Render session 56: the live arena slice, driven in a headless browser against
// the real owner API with the game lane's long-lived ladder playing real
// matches (render/src/site/siteDemo.ts --ladder --speed 2, so 2× is 4× real time; House Null's agent,
// Static Widow, is made with a generated signature card since this session).
//
//   A  The signature card live: on a match with Static Widow, the arena draws
//      its signature zone from the live view's card in full (name, the cost
//      the server says playing it costs at the move shown); no hand cost is
//      marked unsure (the card's abilities are rebuilt, so costs are exact).
//   B  The 2× vote on Nova's own match: Agent match shows the control; Ask
//      for 2× (against the house: 2× at once; against Rook: "Waiting on
//      Rook", then Rook agrees from his own Agent match); the arena opened
//      from Agent match says LIVE · 2× and carries the control beside Close;
//      Back to 1× there takes it back (the server's rate 1, the badge LIVE).
//   C  The boast before the result: the boast starts before GAME OVER lands
//      and before the match is recorded (ENDED), as in a replay; the record
//      handed to the arena is the replay's.
//   D  Settings -> Play: "Ask for 2× in every match" saved to the account,
//      read back after a reload, and Nova's next match starts with her ask.
//   E  No external requests; no page errors.
//
//   node progress/render/evidence/site-check-s56.mjs [stills dir]

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

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', '2'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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
const chromium = await loadPlaywright();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const errors = [];
const timeline = [];
const T0 = Date.now();
const external = [];
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (/\/live(-page)?\//.test(r.url())) timeline.push(`${((Date.now() - T0) / 1000).toFixed(1)}s ${r.status()} ${r.url().replace(url, '/').slice(0, 40)}`); if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(url, '/')}`); });
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
  return { ctx, page };
}
// A still taken while the boast's canvas runs can time out in software WebGL: try again, then say so.
const shot = async (page, name) => {
  for (let k = 0; k < 3; k++) {
    try { await page.screenshot({ path: resolve(OUT, `v2-s56-${name}.jpg`), type: 'jpeg', quality: 80, timeout: 20000 }); return; } catch { await wait(3000); }
  }
  note(`(the still "${name}" timed out three times)`);
};
const until = async (fn, ms = 15000, step = 100) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
async function signIn(page) {
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  await page.fill('#si-login', 'nova');
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#wgrid, .wempty h3');
}
const apiGet = (page, path) => page.evaluate(async (path) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { headers: { Authorization: `Bearer ${t}` } });
  return { status: r.status, body: await r.json() };
}, path);
const navTiming = (f) => f.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? `request ${Math.round(n.requestStart)} ms, response done ${Math.round(n.responseEnd)} ms, DOM interactive ${Math.round(n.domInteractive)} ms, loaded ${Math.round(n.loadEventEnd)} ms` : '?'; });
const liveFrame = (page) => page.frames().find((x) => /\/live\/[A-Za-z0-9_-]{24}(#|$)/.test(x.url()));
/** What the arena shows now: the move, the badge, both HUDs, the hands. */
const arenaNow = (frame) => frame.evaluate(() => {
  const m = /move (\d+) \/ (\d+)/.exec(document.getElementById('framecount').textContent) || [];
  const hud = (p) => ({ hp: document.getElementById(`hud-${p}-hp-text`).textContent, en: document.getElementById(`hud-${p}-en-text`).textContent, backs: document.querySelectorAll(`#hand-${p} .minicard.back`).length, faces: document.querySelectorAll(`#hand-${p} .minicard:not(.back)`).length, units: document.querySelectorAll(`#board-${p} .card[data-iid]`).length });
  const b = document.getElementById('btn-live');
  return { at: Number(m[1]), of: Number(m[2]), badge: b.textContent, badgeClass: b.className, turnbar: document.getElementById('turnbar').textContent, p1: hud('p1'), p2: hud('p2'), brand: document.querySelector('.brand').textContent };
});


const sigNow = (frame, pid) => frame.evaluate((pid) => {
  const z = document.getElementById('sig-' + pid);
  if (!z || z.hidden) return null;
  const cost = z.querySelector('.sz-cost');
  return { text: z.textContent.replace(/\s+/g, ' ').trim(), cost: cost ? Number(cost.textContent) : null };
}, pid);
const unsureCount = (frame) => frame.evaluate(() => document.querySelectorAll('.hand .minicard .unsure').length);

const { ctx, page } = await open();
// Every /live-frames answer, as the website got it: did the read that brought the last move bring the boast too?
const reads = [];
page.on('response', async (r) => {
  if (!/\/live-frames\//.test(r.url())) return;
  try { const b = await r.json(); const last = (b.frames || []).at(-1); reads.push({ t: Date.now(), n: (b.frames || []).length, lastWinner: last ? last.winner ?? null : null, ended: b.ended, record: !!b.record, rate: b.rate }); } catch { /* not JSON */ }
});
await signIn(page);

// ---- A: the signature card live -------------------------------------------------
console.log('\n[A] the signature card, live');
{
  const find = async () => (await apiGet(page, '/api/live')).body.matches.find((m) => ['p1', 'p2'].some((p) => m.now[p].signature) && m.released >= 4 && m.nextAt);
  check(await until(async () => !!(await find()), 240000, 1000), 'A. a live match with a signature card (Static Widow)');
  const m = await find();
  const pid = m.now.p1.signature ? 'p1' : 'p2';
  note(`${m.p1.agentName} vs ${m.p2.agentName}; ${m[pid].agentName}'s card: ${m.now[pid].signature.name} (${m.now[pid].signature.rulesText.join(' ')})`);
  await page.goto(url + '#/live');
  await until(async () => (await page.$(`#live-list [data-act="watch-arena"][data-match="${m.matchId}"]`)) !== null, 30000, 300);
  await page.click(`#live-list [data-act="watch-arena"][data-match="${m.matchId}"]`);
  await until(async () => !!liveFrame(page), 90000, 250);
  const frame = liveFrame(page);
  if (!frame) { console.log('no live frame:', errors.slice(0, 5), await page.$eval('#replay', (e) => e.innerHTML.slice(0, 300)).catch(() => '?')); }
  await frame.waitForSelector('#btn-live', { state: 'attached', timeout: 60000 });
  check(await until(async () => !!(await sigNow(frame, pid)), 20000, 250), `A. ${pid}'s signature zone is drawn on the live arena`);
  await wait(1500);
  await shot(page, 'signature');
  // Compared at the move the arena shows, against the feed's board after that move.
  let agree = 0, seen = 0, worst = '';
  const samples = [];
  for (let k = 0; k < 120 && samples.length < 15; k++) {
    const at = await arenaNow(frame);
    const z = await sigNow(frame, pid);
    const again = await arenaNow(frame);
    if (z && again.at === at.at && at.at >= 1 && !samples.some((x) => x.at === at.at)) samples.push({ at: at.at, z });
    if (at.badge === 'ENDED') break;
    await wait(300);
  }
  // One read of the feed for all of them (it is long: every move so far).
  const feed = (await apiGet(page, `/api/live/${m.matchId}?from=0`)).body;
  for (const { at, z } of samples) {
    const st = feed.steps?.[at - 1];
    if (!st) continue;
    const want = st.after[pid].signature;
    seen++;
    const ok = z.text.includes(want.name) && (want.inZone ? z.cost === want.nextCost : /ON BOARD/.test(z.text));
    if (ok) agree++; else worst = `move ${at}: drawn "${z.text}" cost ${z.cost}; the feed: ${want.inZone ? `cost ${want.nextCost}` : 'on the board'}`;
  }
  note(`sampled at moves ${samples.map((x) => x.at).join(', ')}`);
  check(seen >= 3 && agree === seen, `A. the zone is the feed's at the move shown, ${agree} of ${seen} samples (name; the cost playing it costs, or ON BOARD)${worst ? `; ${worst}` : ''}`);
  const unsure = await unsureCount(frame);
  check(unsure === 0, `A. no hand cost marked unsure (${unsure}): the signature card's abilities are rebuilt, so every cost is exact`);
  await page.click('#replay .rp-close');
}

// ---- B: the 2× vote on Nova's own match --------------------------------------------
console.log('\n[B] the 2× vote');
let matchId = null, frame = null;
{
  await page.goto(url + '#/match');
  const fresh = async () => { const l = (await apiGet(page, '/api/live')).body; const mm = l.matches.find((x) => x.matchId === l.mine); return mm && mm.nextAt && mm.released < 12 ? mm : null; };
  check(await until(async () => !!(await fresh()), 240000, 1000), "B. a match of Nova's goes live (early in it)");
  let m = await fresh();
  matchId = m.matchId;
  const me = m.p1.ownerName === 'Nova' ? 'p1' : 'p2', other = me === 'p1' ? 'p2' : 'p1';
  const house = m.speed.house[other];
  note(`${m.p1.agentName} vs ${m.p2.agentName}; the other side: ${m[other].ownerName}${house ? ' (house)' : ''}`);
  check(await until(async () => (await page.$('#m-speed')) !== null, 15000, 250), 'B. Agent match shows the 2× control on her match');
  const line0 = await page.$eval('#m-live .speed-ctl', (e) => e.textContent);
  check(/Ask for 2/.test(line0), `B. at 1×: "${line0.trim()}"`);
  await page.click('#m-speed');
  if (house) {
    check(await until(async () => (await apiGet(page, `/api/live/${matchId}?from=0`)).body.speed.rate === 2, 10000, 250), 'B. against the house, her ask alone: the server says 2×');
  } else {
    check(await until(async () => /Waiting on Rook/.test(await page.$eval('#m-live .speed-ctl', (e) => e.textContent).catch(() => '')), 10000, 250), 'B. she asked: "Waiting on Rook", the server still 1×');
    const rook = await open();
    await rook.page.goto(url);
    await rook.page.waitForSelector('#signin:not([hidden])');
    await rook.page.fill('#si-login', 'rook');
    await rook.page.fill('#si-pass', 'a long demo password');
    await rook.page.click('#si-go');
    await rook.page.waitForSelector('#wgrid, .wempty h3');
    await rook.page.goto(url + '#/match');
    check(await until(async () => /Nova asks for 2/.test(await rook.page.$eval('#m-live .speed-ctl', (e) => e.textContent).catch(() => '')), 15000, 250), 'B. Rook\'s Agent match: "Nova asks for 2×", Agree');
    await rook.page.click('#m-speed');
    check(await until(async () => (await apiGet(page, `/api/live/${matchId}?from=0`)).body.speed.rate === 2, 10000, 250), 'B. Rook agrees: the server says 2×');
    await rook.ctx.close();
  }
  check(await until(async () => /Playing at 2/.test(await page.$eval('#m-live .speed-ctl', (e) => e.textContent).catch(() => '')), 10000, 250), 'B. her panel: "Playing at 2×", Back to 1×');
  await shot(page, 'agent-match-2x');
  await page.click(`#m-live [data-act="watch-arena"][data-match="${matchId}"]`);
  await until(async () => !!liveFrame(page), 90000, 250);
  frame = liveFrame(page);
  await frame.waitForSelector('#btn-live', { state: 'attached', timeout: 60000 });
  check(await until(async () => /2×/.test((await arenaNow(frame)).badge), 15000, 250), `B. the arena's badge: "${(await arenaNow(frame)).badge}"`);
  check(await until(async () => (await page.$('#rp-speed-btn')) !== null, 10000, 250), 'B. the control over the arena, beside Close');
  const ctlText = await page.$eval('#rp-speed', (e) => e.textContent);
  note(`over the arena: "${ctlText.trim()}"`);
  await shot(page, 'arena-2x');
  // Following at 2×: sampled for 6 s, the arena keeps within a read's worth of the newest move.
  let worst = 0, moved = (await arenaNow(frame)).at;
  for (let k = 0; k < 24; k++) { const a = await arenaNow(frame); if (a.badge === 'ENDED') break; worst = Math.max(worst, a.of - a.at); await wait(250); }
  moved = (await arenaNow(frame)).at - moved;
  check(worst <= 12, `B. it keeps up at 2× (${moved} moves in 6 s, at most ${worst} behind)`);
  await page.click('#rp-speed-btn');
  check(await until(async () => (await apiGet(page, `/api/live/${matchId}?from=0`)).body.speed?.rate === 1, 10000, 250), 'B. Back to 1× over the arena: the server says 1×');
  check(await until(async () => !/2×/.test((await arenaNow(frame)).badge), 5000, 100), `B. the badge drops the 2× at once ("${(await arenaNow(frame)).badge}")`);
}

// ---- C: the boast before the result -----------------------------------------------
console.log('\n[C] the boast before the result');
{
  const T = { boast: null, over: null, ended: null };
  const t1 = Date.now();
  // Until the result has landed (the arena may still be a move or two behind when the match is recorded).
  for (let k = 0; k < 4000 && T.over === null; k++) {
    const s = await frame.evaluate(() => ({ boast: !!(window.__boast && window.__boast.active()), over: /GAME OVER/.test(document.getElementById('turnbar').textContent), ended: document.getElementById('btn-live').textContent === 'ENDED' })).catch(() => null);
    if (!s) { await wait(100); continue; }
    const t = (Date.now() - t1) / 1000;
    if (s.boast && T.boast === null) T.boast = t;
    if (s.over && T.over === null) T.over = t;
    if (s.ended && T.ended === null) T.ended = t;
    await wait(100);
  }
  note(`seconds from the end of B: boast ${T.boast}, GAME OVER ${T.over}, ENDED ${T.ended}`);
  const end = (await apiGet(page, `/api/matches/${matchId}`)).body;
  if (end.outcome === 'draw') note('the match was a draw: no boast to time');
  else {
    check(T.boast !== null && T.over !== null && T.boast < T.over, `C. the boast starts before GAME OVER lands (${T.boast} s, then ${T.over} s), as in a replay`);
    const firstLast = reads.find((r) => r.lastWinner);
    // What orders the arena: the record comes in the same read as the last move, so the step into it plays the
    // boast first. (That the live view has it before the match is recorded is proven on a moved clock in
    // render/test/siteSpeed.test.ts; here the demo halves the 8 s result hold and the poll is every 3 s, so
    // the read may land either side of the recording.)
    check(!!firstLast && firstLast.record, `C. the read that brought the last move brought the boast with it (${firstLast ? JSON.stringify(firstLast) : 'no such read'}; ${firstLast?.ended ? 'this read landed after the recording' : 'before the match was recorded'})`);
    note(T.ended !== null && T.boast !== null && T.ended < T.boast ? `the arena was still a move or two behind when the match was recorded (ENDED at ${T.ended} s): the boast still played before the result` : `ENDED at ${T.ended} s`);
  }
  const key = /\/live\/([A-Za-z0-9_-]{24})(?:#|$)/.exec(frame.url())[1];
  const handed = await page.evaluate(async (k) => { const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token; return (await fetch(`/live-frames/${k}?from=100000`, { headers: { Authorization: `Bearer ${t}` } })).json(); }, key);
  const rp = await page.evaluate(async (id) => { const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token; return (await fetch(`/replay-page/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } })).json(); }, matchId);
  const replayRec = await page.evaluate(async (u) => { const h = await (await fetch(u)).text(); return JSON.parse(/<script type="application\/json" id="match-data">([\s\S]*?)<\/script>/.exec(h)[1].replace(/\\u003c/g, '<')).record; }, rp.url);
  check(JSON.stringify(handed.record) === JSON.stringify(replayRec), `C. the record handed to the arena is the replay's (boast ${end.boast?.itemId ?? 'none'})`);
  await shot(page, 'ended');
  await page.click('#replay .rp-close');
}

// ---- D: Settings -> Play ------------------------------------------------------------
console.log('\n[D] Settings -> Play: Ask for 2× in every match');
{
  await page.goto(url + '#/settings');
  check(await until(async () => (await page.$('#ask-2x-every')) !== null, 15000, 250), 'D. the switch is in Settings -> Play');
  check((await page.$eval('#ask-2x-every', (e) => e.getAttribute('aria-checked'))) === 'false', 'D. off by default');
  await page.click('#ask-2x-every');
  check(await until(async () => (await apiGet(page, '/api/account/settings')).body.ask2xEveryMatch === true, 10000, 250), 'D. on: saved to the account');
  // A match of hers already live started before the setting: only a later one asks.
  const before = new Set([matchId, (await apiGet(page, '/api/live')).body.mine].filter(Boolean));
  // Another browser (a fresh context, signed in again) reads the account's setting.
  const other = await open();
  // The first browser still runs its liquid background; this one can take a while to answer in software WebGL.
  await other.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await other.page.waitForSelector('#signin:not([hidden])', { timeout: 90000 });
  await other.page.fill('#si-login', 'nova');
  await other.page.fill('#si-pass', 'a long demo password');
  await other.page.click('#si-go');
  await other.page.waitForSelector('#wgrid, .wempty h3', { timeout: 90000 });
  await other.page.goto(url + '#/settings', { waitUntil: 'domcontentloaded' });
  check(await until(async () => (await other.page.$eval('#ask-2x-every', (e) => e.getAttribute('aria-checked')).catch(() => null)) === 'true', 30000, 250), 'D. read back in another browser, signed in again: on');
  await other.page.screenshot({ path: resolve(OUT, 'v2-s56-settings.jpg'), type: 'jpeg', quality: 80, timeout: 20000 }).catch(() => note('(the settings still timed out)'));
  await other.ctx.close();
  const nextMine = async () => { const l = (await apiGet(page, '/api/live')).body; const mm = l.matches.find((x) => x.matchId === l.mine); return mm && !before.has(mm.matchId) ? mm : null; };
  check(await until(async () => !!(await nextMine()), 400000, 1000), "D. Nova's next match goes live (one that started after the switch)");
  const nm = await nextMine();
  const me = nm.p1.ownerName === 'Nova' ? 'p1' : 'p2';
  check(nm.speed.asks[me] === true, `D. it starts with her ask (asks ${JSON.stringify(nm.speed.asks)}, rate ${nm.speed.rate})`);
  await page.click('#ask-2x-every');
  check(await until(async () => (await apiGet(page, '/api/account/settings')).body.ask2xEveryMatch === false, 10000, 250), 'D. off again: saved');
}

check(external.length === 0, `no external requests${external.length ? `: ${external.slice(0, 3).join(', ')}` : ''}`);
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
console.log(`\n${passes} pass, ${fails} fail${fails ? '' : ' — ALL PASS'}`);
await ctx.close();
await browser.close();
process.kill(-demo.pid);
process.exit(fails ? 1 : 0);
