// Render session 78: a pulled card's versions in the pack viewer (render debt
// from session 75: the versions row was in the Collection's viewer only, and
// the booster cards' Gold, Glitch and illustration reveals had been checked
// on the face sheet, never in a live reveal). In a headless browser:
//
//   A The demo page (render/output/pack-opening.html), the debug panel's
//     real openings: for Gold, Glitch, Secret (illustration) and Prototype,
//     the pack is torn, revealed to its summary (Skip once the cards are up),
//     the best tile opened in the viewer: the row lists the card's versions,
//     this pull's ringed and held, the line under it; the pulled card is a
//     booster card with its number in range. Then a Zero-Day pull: no row.
//   B The website on the real owner API (siteDemo.ts, Nova): a pack opened
//     from the top bar, skipped to its summary, every tile in the viewer: the
//     row equals GET /api/collection/binder/S0 read after the open (each
//     chip's number and held), and this pull's chip is held.
//   C A ten-pack open on the website: its summary's tiles carry the row too.
//   D A 390 px phone: the viewer with the row fits (the card, the row and
//     Close inside the window, nothing sideways).
//   E No external requests, no page errors.
//
//   node progress/render/evidence/pack-versions-check-s78.mjs [stills dir]

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

let passes = 0, fails = 0;
const check = (ok, line) => { if (ok) passes++; else fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); };
const note = (line) => console.log(`      ${line}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000, step = 80) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
const num = (n) => Number(String(n).split('/')[0]);

const chromium = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];
const external = [];
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `v2-s78-${name}.jpg`), type: 'jpeg', quality: 80, timeout: 30000 }).catch(() => note(`(the still "${name}" timed out)`));

/** In a pack page (a page or a frame), tear the pack in front, wait for the
 * cards, Skip to the summary. `mouse` clicks in page coordinates. */
async function toSummary(f, mouse, offset = [0, 0]) {
  const P = () => f.evaluate(() => window.__pack && { phase: window.__pack.phase }).catch(() => null);
  if (!(await until(async () => (await P())?.phase === 'pack', 60000))) return false;
  const pk = await f.locator('#pack').boundingBox();
  await mouse.click(pk.x + offset[0] + pk.width / 2, pk.y + offset[1] + pk.height / 2);
  if (!(await until(async () => (await P())?.phase === 'cards', 60000))) { note(`the tear never reached the cards (phase ${(await P())?.phase})`); return false; }
  await until(async () => f.evaluate(() => !document.getElementById('skip').hidden), 20000);
  await f.evaluate(() => document.getElementById('skip').click());
  return until(async () => (await P())?.phase === 'summary', 30000);
}
/** Open the viewer on tile `i` of the summary on screen; read the row. */
async function viewerRow(f, i) {
  await f.evaluate((i) => document.querySelector(`.tile[data-ti="${i}"] .mini`).click(), i);
  await until(async () => f.evaluate(() => !document.getElementById('viewer').hidden), 5000);
  const r = await f.evaluate(() => {
    const v = document.getElementById('vvers');
    return {
      shown: !v.hidden,
      chips: [...v.querySelectorAll('.vchip')].map((c) => ({ label: c.childNodes[0].textContent.trim(), number: c.querySelector('small').textContent, held: c.classList.contains('held'), on: c.classList.contains('on'), aria: c.getAttribute('aria-label') })),
      line: v.querySelector('.vline')?.textContent ?? null,
      cap: document.getElementById('vcap').textContent,
    };
  });
  return r;
}
const closeViewer = (f) => f.evaluate(() => document.getElementById('vclose').click());

try {
  // ---- A: the demo page's debug openings ----
  const demoUrl = pathToFileURL(resolve(ROOT, 'render/output/pack-opening.html')).href;
  for (const step of ['gold', 'glitch', 'secret', 'prototype', 'zeroDay']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`demo ${step}: ${e}`));
    page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
    await page.goto(`${demoUrl}?debug=${step}`);
    await until(() => page.evaluate(() => !!window.PACK), 20000);
    await page.evaluate(() => window.PACK.openPack(0));
    const ok = await toSummary(page.mainFrame(), page.mouse);
    const cards = await page.evaluate(() => window.__pack.cur.cards.map((c) => ({ id: c.cardId, name: c.face.name, finish: c.finish, n: c.collectorNumber, lvl: c.build.level, run: c.prototype && c.prototype.runCode, versions: c.versions || null })));
    let bi = 0; cards.forEach((c, i) => { if (c.lvl >= cards[bi].lvl) bi = i; });
    const b = cards[bi];
    const row = await viewerRow(page.mainFrame(), bi);
    if (step === 'zeroDay') {
      check(ok && b.finish === 'zeroDay' && !row.shown && b.versions === null, `A Zero-Day (${b.name}): no versions row (its own kind, one version); caption "${row.cap}"`);
      // The other cards of the same pack still get theirs.
      const other = cards.findIndex((c) => c.finish !== 'zeroDay');
      await closeViewer(page);
      const r2 = await viewerRow(page.mainFrame(), other);
      check(r2.shown && r2.chips.filter((c) => c.on).length === 1, `A   the same pack's ${cards[other].name} (${cards[other].finish}) has its row: ${r2.chips.map((c) => c.label).join(', ')}`);
    } else {
      const want = { gold: 'Gold', glitch: 'Glitch', secret: 'Illustration', prototype: 'Prototype' }[step];
      const on = row.chips.filter((c) => c.on);
      const inRange = b.finish === 'gold' ? num(b.n) >= 125 && num(b.n) <= 152 : b.finish === 'secret' ? num(b.n) >= 153 : b.finish === 'prototype' ? true : num(b.n) >= 97 && num(b.n) <= 124;
      check(ok && row.shown && on.length === 1 && on[0].label.startsWith(want) && on[0].held, `A ${want}: ${b.name} ${b.finish === 'prototype' ? b.run : b.n}; the row: ${row.chips.map((c) => `${c.on ? '[' : ''}${c.label} ${c.number}${c.held ? ' held' : ''}${c.on ? ']' : ''}`).join(' · ')}`);
      check(on[0] && on[0].number === (b.finish === 'prototype' ? b.run : b.n) && inRange, `A   this pull's chip carries its own number (${on[0]?.number}), in the booster range for its version`);
      check(row.line === (row.chips.every((c) => c.held) ? `You hold all ${row.chips.length} of its versions.` : `You hold ${row.chips.filter((c) => c.held).length} of its ${row.chips.length} versions.`) && /this pull, held$/.test(on[0]?.aria ?? ''), `A   the line "${row.line}"; the chip says "${on[0]?.aria}"`);
      if (step === 'gold' || step === 'prototype') { await wait(500); await shot(page, `demo-viewer-${step}`); }
    }
    await ctx.close();
  }

  // ---- B, C: the website on the real owner API ----
  const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const url = await new Promise((ok, fail) => {
    let buf = '';
    demo.stdout.on('data', (d) => { buf += d; const m = /\[site-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
    demo.stderr.on('data', (d) => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
    demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
    setTimeout(() => fail(new Error('the demo took over 120 s to start')), 120000);
  });
  try {
    for (const [w, h] of [[1440, 1000], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`site ${w}: ${e}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`site ${w} console: ${m.text()}`); });
      page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
      await page.goto(url);
      await page.waitForSelector('#signin:not([hidden])');
      await page.fill('#si-login', 'nova');
      await page.fill('#si-pass', 'a long demo password');
      await page.click('#si-go');
      await page.waitForSelector('#wgrid, .wempty h3');
      const api = (path) => page.evaluate(async (path) => {
        const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
        const r = await fetch(path, { headers: { Authorization: `Bearer ${t}` } });
        return r.json();
      }, path);
      const frameOf = () => page.frames().find((f) => f.url().endsWith('/pack-opening'));
      const frameBox = async () => { const r = await page.$eval('#opening iframe', (el) => { const b = el.getBoundingClientRect(); return [b.x, b.y]; }); return r; };

      // One pack from the top bar (the desktop run's ten used the demo
      // owner's last packs: buy one through the API when none waits).
      const waiting = (await page.evaluate(async () => {
        const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
        return (await (await fetch('/api/wallet', { headers: { Authorization: `Bearer ${t}` } })).json()).unopenedPacks.length;
      }));
      if (!waiting) {
        const st = await page.evaluate(async () => {
          const t = JSON.parse(sessionStorage.getItem('aitcg.site.session')).token;
          return (await fetch('/api/packs/buy', { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ setCode: 'S0' }) })).status;
        });
        note(`no pack waiting at ${w} px: bought one (${st})`);
        await page.reload();
        await page.waitForSelector('#wgrid, .wempty h3');
      }
      await page.waitForSelector('#open-btn:not([disabled])', { timeout: 20000 });
      await page.click('#open-btn');
      await page.waitForSelector('#opening:not([hidden]) iframe');
      await until(() => !!frameOf(), 20000);
      const f = frameOf();
      const ok = await toSummary(f, page.mouse, await frameBox());
      const binder = await api('/api/collection/binder/S0');
      const cards = await f.evaluate(() => window.__pack.cur.cards.map((c) => ({ id: c.cardId, name: c.face.name, finish: c.finish, n: c.collectorNumber, secret: c.secret && c.secret.code, run: c.prototype && c.prototype.runCode })));
      if (w === 1440) {
        let agree = 0, held = 0;
        const bad = [];
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i];
          const row = await viewerRow(f, i);
          await closeViewer(f);
          if (c.finish === 'zeroDay') { if (!row.shown) agree++; else bad.push(`${c.name}: a row on a Zero-Day`); continue; }
          const expect = [
            ...binder.base.entries.filter((e) => e.cardId === c.id).map((e) => ({ label: 'Set', number: e.number, held: e.owned > 0 })),
            ...binder.secrets.entries.filter((e) => e.cardId === c.id && e.kind !== 'zeroDay').map((e) => ({ label: 'Illustration', number: e.number, held: e.owned > 0 })),
            ...binder.glitch.entries.filter((e) => e.cardId === c.id).map((e) => ({ label: 'Glitch', number: e.number, held: e.owned > 0 })),
            ...binder.gold.entries.filter((e) => e.cardId === c.id).map((e) => ({ label: 'Gold', number: e.number, held: e.owned > 0 })),
            ...binder.prototypes.filter((r) => r.cardId === c.id).map((r) => ({ label: `Prototype /${r.runSize}`, number: r.runCode, held: r.serialsHeld.length > 0 })),
          ];
          const got = row.chips.map((x) => ({ label: x.label, number: x.number, held: x.held }));
          if (JSON.stringify(got) === JSON.stringify(expect)) agree++; else bad.push(`${c.name}: ${JSON.stringify(got)} vs ${JSON.stringify(expect)}`);
          if (row.chips.some((x) => x.on && x.held)) held++;
          if (i === 0) note(`${c.name} (${c.finish} ${c.n}): ${row.chips.map((x) => `${x.on ? '[' : ''}${x.label} ${x.number}${x.held ? ' held' : ''}${x.on ? ']' : ''}`).join(' · ')}; "${row.line}"`);
        }
        const nz = cards.filter((c) => c.finish !== 'zeroDay').length;
        check(ok && agree === cards.length && held === nz, `B site, one pack (${cards.map((c) => `${c.n} ${c.finish}`).join(', ')}): every tile's row equals GET /api/collection/binder/S0 read after the open (${agree}/${cards.length}), this pull held in ${held}/${nz}${bad.length ? '; ' + bad.join(' | ') : ''}`);
        const best = cards.reduce((a, c, i) => (c.finish !== 'standard' ? i : a), 0);
        await viewerRow(f, best);
        await wait(500);
        await shot(page, 'site-viewer-1440');
        await closeViewer(f);

        // ---- C: ten packs, from the summary's own buttons or the Store ----
        const unopenedList = (await api('/api/wallet')).unopenedPacks; const unopened = Array.isArray(unopenedList) ? unopenedList.length : unopenedList;
        note(`unopened packs before the ten: ${unopened}`);
        // A single pack's summary offers one more, not ten: Done, then the
        // Store page's "Open 10".
        const doneState = await f.evaluate(() => [...document.querySelectorAll('.btns button')].map((b) => `${b.dataset.site}${b.disabled ? ' (off)' : ''}`).join(', '));
        note(`the single summary's buttons: ${doneState}`);
        await f.evaluate(() => window.PACK.close('done'));
        await until(() => page.evaluate(() => document.getElementById('opening').hidden), 10000);
        await page.evaluate(() => { location.hash = '#/store'; });
        const tenBtn = await page.waitForSelector('#open10-btn:not([disabled])', { timeout: 15000 }).catch(() => null);
        if (!tenBtn) {
          check(false, 'C the Store offers no live "Open 10" (not enough packs?)');
        } else {
          const before = await f.evaluate(() => window.__pack.log.length);
          await tenBtn.click();
          await page.waitForSelector('#opening:not([hidden]) iframe');
          // The ten plays its fast sequence and stops on held cards; jump the
          // bulk to its summary through the page's own path: tap through.
          // Done when the page logs this open's bulk summary (a big pull inside
          // the ten has its own one-pack summary first, then goes on).
          const done = await until(async () => {
            if (await f.evaluate((from) => window.__pack.log.slice(from).some((e) => e.kind === 'bulkSummary'), before)) return true;
            // A stop waits for a tap on the held card / the screen.
            await f.evaluate(() => { const b = document.getElementById('skip'); if (b && !b.hidden) b.click(); });
            const box = await f.locator('#stage').boundingBox().catch(() => null);
            const fb = await frameBox();
            if (box) await page.mouse.click(fb[0] + box.x + box.width / 2, fb[1] + box.y + box.height / 2);
            return false;
          }, 240000, 600);
          const tiles = await f.evaluate(() => [...document.querySelectorAll('.tile')].length);
          const log = await f.evaluate((from) => window.__pack.log.slice(from).map((e) => e.kind), before);
          note(`the ten: ${done ? 'reached its summary' : 'did not reach its summary'}; ${tiles} tiles; beats: ${[...new Set(log)].slice(0, 12).join(', ')}`);
          let withRow = 0, onHeld = 0;
          for (let i = 0; i < tiles; i++) {
            const row = await viewerRow(f, i);
            await closeViewer(f);
            if (row.shown) withRow++;
            if (row.chips.some((x) => x.on && x.held)) onHeld++;
          }
          check(done && tiles > 10 && withRow >= tiles - 3 && onHeld === withRow, `C site, ten packs: ${withRow} of ${tiles} summary tiles open a row (Zero-Day tiles have none), this pull held in ${onHeld}`);
        }
      } else {
        // ---- D: the phone ----
        const best = cards.reduce((a, c, i) => (c.finish !== 'standard' && c.finish !== 'zeroDay' ? i : a), 0);
        const row = await viewerRow(f, best);
        await wait(800); // the card's rise animation, before measuring
        const fit = await f.evaluate(() => {
          const r = (id) => document.getElementById(id).getBoundingClientRect();
          const vw = innerWidth, vh = innerHeight;
          const card = r('vcard'), vers = r('vvers'), close = r('vclose');
          return { vw, vh, card: [card.top, card.bottom], vers: [vers.left, vers.right, vers.top, vers.bottom], close: close.bottom, sideways: document.documentElement.scrollWidth > vw };
        });
        const inside = fit.card[0] >= 0 && fit.card[1] <= fit.vers[2] && fit.close <= fit.vh && fit.vers[0] >= 0 && fit.vers[1] <= fit.vw && !fit.sideways;
        check(ok && row.shown && inside, `D 390 px: the viewer with its ${row.chips.length}-chip row fits (card ${Math.round(fit.card[0])}-${Math.round(fit.card[1])}, row ${Math.round(fit.vers[2])}-${Math.round(fit.vers[3])}, Close to ${Math.round(fit.close)} of ${fit.vh}; nothing sideways)`);
        await wait(500);
        await shot(page, 'site-viewer-phone');
      }
      await ctx.close();
    }
  } finally {
    try { process.kill(-demo.pid, 'SIGINT'); } catch { /* gone */ }
  }
} finally {
  // ---- E ----
  check(external.length === 0, `E no external requests (${external.length})`);
  check(errors.length === 0, `E no page errors (${errors.length})${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
  console.log(`\n${passes} PASS, ${fails} FAIL`);
  await browser.close();
  setTimeout(() => process.exit(fails ? 1 : 0), 1500);
}
