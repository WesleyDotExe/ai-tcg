// Render session 71: Top rated and viewer counts on Watch live (the owner's
// 2026-11-12 entry, item 1; the 2026-11-13 plan, item 5), driven in a
// headless browser against the real owner API over a real store with the
// game lane's ladder playing (render/src/site/siteDemo.ts --ladder --speed 8,
// unchanged rules: four owners, two matches a round; the house agents leave
// placement at their 5th rated match). Nothing is mocked: every number the
// page shows is checked against the server's own answer to GET /api/live.
//
//   A  A round with a side in placement: no Top rated group, the page says
//      why; every match under "Live now"; each card's eye is the server's
//      `viewers`.
//   B  A round with both sides out of placement: the Top rated group, its
//      cards in the server's `featured.topRated` order, "Top rated #k" and
//      the weaker side's rating and tier as the match started.
//   C  Viewers: Nova opens the top pick on the arena (the host reads its
//      feed with her token); Rook, on Watch live in another browser, sees
//      the count rise to the server's number; Nova closes it and the count
//      falls back within the server's 30 s. Rook's list read never counts.
//   D  Home: Watch live at M leads with the top pick (its chip and eye), the
//      others as lines with "#k" and their eye, "N live · K top rated"; at L
//      the tile's arena embeds the top pick; at S the score alone.
//   E  A phone (390 px) and dark: no sideways scroll; stills.
//   F  No external requests, no page errors.
//
//   node progress/render/evidence/featured-check-s71.mjs [stills dir]

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

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0', '--ladder', '--speed', '8', '--warm', '4'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const url = await new Promise((ok, fail) => {
  let buf = '';
  demo.stdout.on('data', (d) => { buf += d; const m = /\[site-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
  demo.stderr.on('data', (d) => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
  demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
  setTimeout(() => fail(new Error('the demo took over 240 s to start')), 240000);
});

let passes = 0, fails = 0;
const check = (ok, line) => { if (ok) passes++; else fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); };
const note = (line) => console.log(`      ${line}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000, step = 200) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
const chromium = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];
const external = [];
const watchPage = (p, who) => {
  p.on('pageerror', (e) => errors.push(`${who}: ${String(e)}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${who} console: ${m.text()}`); });
  p.on('response', (r) => { if (r.status() >= 400 && !/\/api\/live\/[^/?]+(\?|$)/.test(r.url())) errors.push(`${who} HTTP ${r.status()} ${r.request().method()} ${r.url().replace(url, '/')}`); });
  p.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
};
const signIn = async (p, login) => {
  await p.goto(url);
  await p.waitForSelector('#signin:not([hidden])');
  await p.fill('#si-login', login);
  await p.fill('#si-pass', 'a long demo password');
  await p.click('#si-go');
  await p.waitForSelector('#wgrid, .wempty h3');
};
const apiOf = (p) => (method, path, body) => p.evaluate(async ([method, path, body]) => {
  const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}, [method, path, body]);
const shot = async (p, name, sel) => {
  const el = sel ? await p.$(sel) : null;
  try { await (el ?? p).screenshot({ path: resolve(OUT, `v2-s71-${name}.jpg`), type: 'jpeg', quality: 82, timeout: 20000 }); } catch { note(`(the still "${name}" timed out)`); }
};
/** The Watch live page as drawn: its groups and each card's tags. */
const livePageState = (p) => p.evaluate(() => ({
  groups: [...document.querySelectorAll('#live-list .lgroup')].map((g) => ({
    title: g.querySelector('h3')?.childNodes[0]?.textContent.trim() ?? '',
    count: g.querySelector('h3 small')?.textContent ?? '',
    cards: [...g.querySelectorAll('.live-card')].map((c) => ({
      id: c.dataset.match,
      top: c.classList.contains('top'),
      chip: c.querySelector('.pill.top')?.textContent ?? null,
      why: c.querySelector('.lc-why')?.textContent ?? null,
      eye: c.querySelector('.vw')?.getAttribute('aria-label') ?? null,
      eyeN: c.querySelector('.vw b')?.textContent ?? null,
    })),
  })),
  none: document.querySelector('#live-list .lg-none')?.textContent ?? null,
}));
// The arena takes Escape inside its frame; the website's own Escape closes it.
const closeArena = (p) => p.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
/** The Watch live widget on Nova's Home, as drawn. */
const readWatch = () => nova.$eval('#wgrid .wg[data-type="watch"]', (e) => ({
  first: e.querySelector('.sb')?.dataset.match ?? null,
  chip: e.querySelector('.mtags .pill.top')?.textContent ?? null,
  eye: e.querySelector('.mtags .vw')?.getAttribute('aria-label') ?? null,
  lines: [...e.querySelectorAll('.lline')].map((x) => ({ tag: x.querySelector('.ltags .pill.top')?.textContent ?? null, eye: x.querySelector('.ltags .vw')?.getAttribute('aria-label') ?? null })),
  foot: [...e.querySelectorAll('.row .muted.small')].map((x) => x.textContent).pop() ?? null,
  arena: e.querySelector('.wl-arena')?.dataset.match ?? null,
  text: e.innerText,
}));
const weakerWhy = (m) => { const w = Math.round(m.p1.rating) <= Math.round(m.p2.rating) ? m.p1 : m.p2; return `Weaker side ${Math.round(w.rating)} ${w.tier}`; };
const eyeWords = (n) => (n === 0 ? 'No one watching' : `${n} watching`);

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const nova = await ctx.newPage();
watchPage(nova, 'nova');
const rookCtx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
const rook = await rookCtx.newPage();
watchPage(rook, 'rook');

try {
  await signIn(nova, 'nova');
  const api = apiOf(nova);
  await signIn(rook, 'rook');
  const rapi = apiOf(rook);
  // Nova keeps Home light while Watch live is read (no tile arena reading feeds).
  await api('PUT', '/api/board', { widgets: [{ id: 'w2', type: 'daily', size: 'S' }] });
  const live = async () => (await api('GET', '/api/live')).body;
  let l = await live();
  note(`first read: ${l.matches.length} live, featured ${JSON.stringify(l.featured)}`);
  for (const m of l.matches) note(`  ${m.matchId}: ${m.p1.agentName} ${Math.round(m.p1.rating)} ${m.p1.tier} v ${m.p2.agentName} ${Math.round(m.p2.rating)} ${m.p2.tier}, viewers ${m.viewers}`);

  console.log('\n[A] a round with a side in placement');
  await rook.evaluate(() => { location.hash = '#/live'; });
  check(await until(async () => (await live()).matches.length > 0, 120000, 1000), 'A. the ladder has a live match');
  l = await live();
  if (l.featured.topRated.length === 0) {
    await rook.waitForSelector('#live-list .live-card');
    await wait(3500);
    const s = await livePageState(rook);
    l = await live();
    check(!s.groups.some((g) => g.title === 'Top rated'), `A. no Top rated group while the server's is empty (${JSON.stringify(l.featured.topRated)})`);
    check(/every live match has a side still in placement/.test(s.none ?? ''), `A. the page says why: "${s.none}"`);
    const all = s.groups.find((g) => g.title === 'Live now');
    check(!!all && all.cards.map((c) => c.id).join() === l.matches.map((m) => m.matchId).join(), `A. every match under "Live now", in the server's order (${all?.cards.map((c) => c.id).join(', ')})`);
    check(!!all && all.cards.every((c) => { const m = l.matches.find((x) => x.matchId === c.id); return m && c.eye === eyeWords(m.viewers) && c.eyeN === String(m.viewers); }), `A. each card's eye is the server's viewers (${all?.cards.map((c) => `${c.id} ${c.eyeN}`).join(', ')})`);
    check(l.matches.some((m) => m.p1.tier === 'Placement' || m.p2.tier === 'Placement'), 'A. (the server agrees: a live match has a side in placement)');
    await shot(rook, 'live-none');
  } else {
    note('(the first live round already has Top rated matches; A skipped)');
  }

  console.log('\n[B] a round with Top rated matches');
  check(await until(async () => (await live()).featured.topRated.length > 0, 8 * 60000, 1500), 'B. the server features a round (both sides out of placement)');
  await wait(3500);
  let s = await livePageState(rook);
  l = await live();
  const top = s.groups.find((g) => g.title === 'Top rated');
  check(!!top, 'B. the Top rated group is drawn');
  check(s.groups[0]?.title === 'Top rated', `B. it comes first (groups: ${s.groups.map((g) => g.title).join(', ')})`);
  check(top?.cards.map((c) => c.id).join() === l.featured.topRated.join(), `B. its cards are featured.topRated in order (${top?.cards.map((c) => c.id).join(', ')} / ${l.featured.topRated.join(', ')})`);
  check(top?.count === String(l.featured.topRated.length), `B. the heading counts them (${top?.count})`);
  check(!!top && top.cards.every((c, i) => c.chip === `Top rated #${i + 1}` && c.top), `B. each says "Top rated #k" and is marked (${top?.cards.map((c) => c.chip).join(', ')})`);
  check(!!top && top.cards.every((c) => { const m = l.matches.find((x) => x.matchId === c.id); return m && c.why === weakerWhy(m); }), `B. each says the weaker side's rating and tier as it started (${top?.cards.map((c) => c.why).join('; ')})`);
  check(!!top && top.cards.every((c) => { const m = l.matches.find((x) => x.matchId === c.id); return m && m.p1.tier !== 'Placement' && m.p2.tier !== 'Placement'; }), 'B. (the server agrees: no featured side is in placement)');
  const rest = s.groups.find((g) => g.title === 'Also live');
  const restIds = l.matches.map((m) => m.matchId).filter((id) => !l.featured.topRated.includes(id));
  check((rest?.cards.map((c) => c.id) ?? []).join() === restIds.join(), `B. the rest under "Also live" (${restIds.length ? restIds.join(', ') : 'none: every live match is featured'})`);
  const tipTitle = await rook.$eval('#live-list .live-card .pill.top', (e) => e.getAttribute('title')).catch(() => '');
  check(/both sides out of placement/.test(tipTitle), `B. the chip's hover says the rule: "${tipTitle}"`);
  await shot(rook, 'live-top');
  const topId = l.featured.topRated[0];

  console.log('\n[C] viewers');
  l = await live();
  const before = l.matches.find((m) => m.matchId === topId)?.viewers ?? -1;
  check(before === 0, `C. before anyone opens it, the top pick has no viewers (${before}); Rook reading the list doesn't count`);
  await nova.evaluate(() => { location.hash = '#/live'; });
  await nova.waitForSelector(`#arena-${topId}`);
  await nova.click(`#arena-${topId}`);
  check(await until(async () => ((await live()).matches.find((m) => m.matchId === topId)?.viewers ?? 0) >= 1, 20000, 500), 'C. Nova opens it on the arena: the server counts her');
  let shown = '';
  const rose = await until(async () => {
    const [st, ll] = [await livePageState(rook), await live()];
    const c = st.groups.flatMap((g) => g.cards).find((x) => x.id === topId);
    const m = ll.matches.find((x) => x.matchId === topId);
    shown = `${c?.eyeN} / server ${m?.viewers}`;
    return c && m && c.eyeN === String(m.viewers) && m.viewers >= 1 && c.eye === eyeWords(m.viewers);
  }, 12000, 500);
  check(rose, `C. Rook's card shows the server's count within a list poll (${shown})`);
  await shot(rook, 'live-viewers', `#live-list .live-card[data-match="${topId}"]`);
  // Rook opens it too: 2.
  await rook.click(`#arena-${topId}`);
  check(await until(async () => ((await live()).matches.find((m) => m.matchId === topId)?.viewers ?? 0) >= 2, 20000, 500), `C. Rook opens it too: the server counts 2 (${(await live()).matches.find((m) => m.matchId === topId)?.viewers})`);
  await closeArena(rook);
  await wait(400);
  // Nova closes hers; within the server's 30 s both drop out.
  await closeArena(nova);
  await nova.evaluate(() => { location.hash = '#/'; });
  const t0 = Date.now();
  const fell = await until(async () => { const m = (await live()).matches.find((x) => x.matchId === topId); return !m || m.viewers === 0; }, 45000, 1000);
  check(fell, `C. both closed: the count falls to 0 within ${Math.round((Date.now() - t0) / 1000)} s (the server's window is 30 s)`);
  if ((await live()).matches.some((m) => m.matchId === topId)) {
    await rook.evaluate(() => { location.hash = '#/live'; });
    const zero = await until(async () => (await livePageState(rook)).groups.flatMap((g) => g.cards).find((x) => x.id === topId)?.eye === 'No one watching', 8000, 500);
    check(zero, 'C. and Rook\'s card says "No one watching"');
  } else note('(the top pick ended meanwhile)');

  console.log('\n[D] Home: Watch live at S, M and L');
  // A featured round live again for the widget.
  await until(async () => (await live()).featured.topRated.length > 0, 8 * 60000, 1500);
  for (const size of ['M', 'L', 'S']) {
    await api('PUT', '/api/board', { widgets: [{ id: 'w1', type: 'watch', size }, { id: 'w2', type: 'daily', size: 'S' }] });
    await nova.goto(url + '#/home');
    // A hash-only goto doesn't reload: the saved board is read on a load.
    await nova.reload();
    await nova.waitForSelector('#wgrid .wg[data-type="watch"] .sb, #wgrid .wg[data-type="watch"] .wl-l');
    await wait(3500);
    // Read the server and the widget back to back; a round change between them is retried.
    let w;
    for (let k = 0; k < 5; k++) {
      l = await live();
      w = await readWatch();
      const again = await live();
      if (JSON.stringify(again.featured) === JSON.stringify(l.featured) && again.matches.map((m) => m.matchId).join() === l.matches.map((m) => m.matchId).join()) break;
      await wait(3500);
    }
    const order = [...l.featured.topRated, ...l.matches.map((m) => m.matchId).filter((id) => !l.featured.topRated.includes(id))];
    if (size === 'S') {
      check(w.first === order[0] && !w.chip && !w.eye, `D. S: the score alone, of the top pick (${w.first})`);
      continue;
    }
    if (size === 'L') {
      check(w.arena === order[0], `D. L: the tile's arena embeds the top pick (${w.arena} / ${order[0]})`);
    } else {
      check(w.first === order[0], `D. M: the first scoreboard is the top pick (${w.first} / ${order[0]})`);
    }
    const m0 = l.matches.find((m) => m.matchId === order[0]);
    check(w.chip === 'Top rated #1', `D. ${size}: it wears "Top rated #1" (${w.chip})`);
    // At L the tile itself reads the feed, so Nova counts.
    check(!!m0 && /watching$/.test(w.eye ?? ''), `D. ${size}: its eye (${w.eye}; the server now ${m0?.viewers})`);
    check(w.lines.length === order.length - 1 && w.lines.every((x, i) => (l.featured.topRated.includes(order[i + 1]) ? x.tag === `#${i + 2}` : x.tag === null) && /watching$/.test(x.eye ?? '')), `D. ${size}: the others as lines with their rank and eye (${w.lines.map((x) => `${x.tag ?? '-'} ${x.eye}`).join('; ')})`);
    check(w.foot === `${l.matches.length} live · ${l.featured.topRated.length} top rated`, `D. ${size}: "${w.foot}"`);
    check(!/featured picks come later/.test(w.text), `D. ${size}: "featured picks come later" is gone`);
    if (size === 'L') {
      check(await until(async () => ((await live()).matches.find((m) => m.matchId === order[0])?.viewers ?? 0) >= 1, 20000, 500), 'D. L: the tile\'s arena reads the feed, so the server counts Nova watching');
    }
    await shot(nova, `widget-${size}`, '#wgrid .wg[data-type="watch"]');
  }

  console.log('\n[E] a phone, and dark');
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pp = await phone.newPage();
  watchPage(pp, 'phone');
  await signIn(pp, 'rook');
  await until(async () => (await live()).featured.topRated.length > 0, 8 * 60000, 1500);
  await pp.evaluate(() => { location.hash = '#/live'; });
  await pp.waitForSelector('#live-list .live-card');
  await wait(3500);
  const fit = await pp.evaluate(() => ({ sx: document.documentElement.scrollWidth, w: innerWidth, cards: [...document.querySelectorAll('.live-card')].every((c) => c.getBoundingClientRect().right <= innerWidth + 0.5) }));
  check(fit.sx <= fit.w && fit.cards, `E. Watch live fits a 390 px phone (page ${fit.sx} wide of ${fit.w})`);
  await shot(pp, 'live-phone');
  await pp.evaluate(() => { document.body.dataset.theme = 'dark'; });
  await wait(300);
  await shot(pp, 'live-phone-dark');
  await phone.close();
  await rook.evaluate(() => { document.body.dataset.theme = 'dark'; location.hash = '#/live'; });
  await wait(3500);
  await shot(rook, 'live-dark');
} catch (e) {
  check(false, `the check stopped: ${e && e.stack || e}`);
}

console.log('\n[F] the page');
check(external.length === 0, `F. no external requests${external.length ? `: ${external.slice(0, 3).join(', ')}` : ''}`);
check(errors.length === 0, `F. no page errors${errors.length ? `: ${errors.slice(0, 4).join(' | ')}` : ''}`);
console.log(`\n${passes} PASS, ${fails} FAIL`);
await browser.close();
try { process.kill(-demo.pid); } catch { /* gone */ }
