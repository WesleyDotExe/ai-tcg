// Render session 49: the loadout picker in the Store, driven in a headless
// browser against the real owner API (render/src/site/siteDemo.ts: a fresh
// season database, the game lane's owner API unchanged, the site host in
// front). The Store's "Your agents' loadouts" rows read from the server;
// Change opens the standalone picker in its site mode, full screen, framed
// from the host's /loadout; Equip and empty are PUTs to the server and the
// page shows the loadout the server answers with; an item on sale is
// bought from inside the picker with the website's own confirm (shown above
// the picker), then equipped; a refused call (the session ended) shows the
// server's refusal and saves nothing; the second agent's loadout is its
// own; Close and Escape go back to the Store with focus on the row's
// button, and the row shows what was saved; a narrow window; reduce motion
// (the preview is the still); the page's headers; no external requests; no
// page errors.
//
//   node progress/render/evidence/site-check-s49.mjs [stills dir]
// (PW_CORE as in render/ci/browser-check.mjs, if playwright isn't found.)

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

const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const errors = [];
const external = [];
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  // The check's own refusal (an Equip after the session ended) logs a 401 by design.
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 401/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:') && r.url() !== 'about:blank') external.push(r.url()); });
  return { ctx, page };
}
const S = (page) => page.evaluate(() => window.__site.state());
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `v2-s49-loadout-${name}.jpg`), type: 'jpeg', quality: 80 });
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
  return r.json();
}, path);
const until = async (fn, ms = 15000, step = 80) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(step); } return false; };
const frameOf = (page) => page.frames().find((f) => f.url().endsWith('/loadout'));
const L = (page) => frameOf(page)?.evaluate(() => { const l = window.__loadout; const s = l.state(); const st = l.stats(); return { state: s, stats: { previews: st.previews, equips: st.equips, refused: st.refused, site: st.site, current: st.current } }; });
const toastText = (f) => f.evaluate(() => document.getElementById('toast').textContent);
async function goStore(page) {
  await page.click('#nav [data-page="store"]');
  await page.waitForSelector('.st-agents [data-act="dress"]');
}
// Clicking Change while the Store is still redrawing after the last Close
// can land on a button that is being replaced (seen once in this check, a
// race in the check, not a lost save): the check waits for the Store's
// reads to settle first, and fails loudly if the picker didn't open.
async function openFor(page, agentId) {
  await wait(600);
  await page.click(`[data-act="dress"][data-agent="${agentId}"]`);
  const opened = await until(async () => { const f = frameOf(page); return !!f && (await f.evaluate(() => !!window.__loadout && !!window.__loadout.state())); });
  if (!opened) throw new Error(`the picker didn't open for ${agentId}`);
  return frameOf(page);
}
async function railSlot(f, slot) {
  await f.click(`.rail-slot[data-slot="${slot}"]`);
  await f.waitForSelector(`.rail-slot.on[data-slot="${slot}"]`);
}
async function equip(f, key) {
  const before = (await f.evaluate(() => window.__loadout.stats().site.answers.length));
  await f.click(`[data-equip="${key}"]`);
  await until(() => f.evaluate((n) => window.__loadout.stats().site.answers.length > n, before));
  return f.evaluate(() => { const a = window.__loadout.stats().site.answers; return a[a.length - 1]; });
}

try {
  const { ctx, page } = await open();
  await signIn(page);
  const play = await apiGet(page, '/api/play');
  const [first, second] = play.agents;
  const conn = play.connectedAgent.agentId;
  const names = Object.fromEntries((await apiGet(page, '/api/cosmetics')).owned.map((o) => [o.itemId, o.item.name]));

  // A. The Store's rows, from the server.
  await goStore(page);
  const rows = await page.$$eval('.st-agents .st-agent', (rs) => rs.map((r) => ({ agent: r.querySelector('[data-act="dress"]').dataset.agent, text: r.textContent })));
  const lo1 = await apiGet(page, `/api/agents/${first.agentId}/loadout`);
  const lo2 = await apiGet(page, `/api/agents/${second.agentId}/loadout`);
  check(rows.length === play.agents.length && rows[0].agent === conn && rows[0].text.includes('Connected'), `A  "Your agents' loadouts": ${rows.length} rows, the connected agent first (${play.connectedAgent.name})`);
  const lineOf = (lo) => (lo.loadout.boast ? names[lo.loadout.boast] : 'Empty');
  check(rows.every((r) => { const lo = r.agent === first.agentId ? lo1 : lo2; return r.text.includes(`Victory boast: ${lineOf(lo)}`) && r.text.includes(`Close win: ${lo.loadout.closeWinBoast ? names[lo.loadout.closeWinBoast] : 'Empty: plays the victory boast'}`); }),
    `A  each row says what the server has equipped (${first.name}: ${lineOf(lo1)}; ${second.name}: ${lineOf(lo2)})`);
  const cosText = await page.textContent('.st-cos');
  check(!cosText.includes('comes to this page next'), 'A  the Cosmetics panel no longer says the picker is coming');
  await page.evaluate(() => document.querySelector('.st-agents').scrollIntoView({ block: 'center' }));
  check(await page.evaluate(() => { const r = document.querySelector('.st-agents').getBoundingClientRect(); return r.left < 760; }), 'A  the agents panel sits in the left column, under the packs waiting');
  await shot(page, 'store-rows');

  // B. Change opens the picker full screen.
  let f = await openFor(page, first.agentId);
  let s = await S(page);
  check(s.dress === first.agentId && await page.isVisible('#dress') && !(await page.isVisible('#opening')), `B  Change opens the picker over the website (the frame's page: ${f.url().replace(url, '/')})`);
  const head = await f.evaluate(() => ({ name: document.getElementById('ag-name').textContent, tag: document.getElementById('ag-faction').textContent, tabs: document.getElementById('sc-tabs').hidden, rail: [...document.querySelectorAll('.rail-slot')].map((b) => b.dataset.slot) }));
  check(head.name === first.name && head.tabs && head.rail.join(',') === 'boast,closeWinBoast,cardBack,avatar,arena', `B  the picker is this agent's: ${head.name}, the five slots, no scenario tabs`);
  check(head.tag === 'No deck built yet', `B  the agent has no deck yet and the page says so ("${head.tag}"), not a guessed faction`);
  const tiles = await f.$$eval('.tile', (ts) => ts.map((t) => ({ key: t.dataset.tile, locked: t.classList.contains('locked'), equipped: t.classList.contains('equipped'), buy: !!t.querySelector('[data-buy]'), equip: !!t.querySelector('[data-equip]') })));
  const store = await apiGet(page, '/api/store');
  const forSale = store.cosmetics.filter((c) => c.kind === 'boast' && !c.owned).map((c) => c.itemId);
  const choices = lo1.slots.find((x) => x.slot === 'boast').choices;
  check(tiles.filter((t) => !t.locked && t.key !== '').map((t) => t.key).sort().join() === [...choices].sort().join(), `B  the owned tiles are the server's choices for the slot (${choices.length})`);
  check(tiles.filter((t) => t.locked).map((t) => t.key).sort().join() === [...forSale].sort().join() && tiles.some((t) => t.key === ''), `B  the items on sale the owner lacks are locked tiles (${forSale.length}), plus the empty tile`);
  const credits = store.wallet.credits;
  const buyable = store.cosmetics.filter((c) => !c.owned && c.priceCredits <= credits).length;
  check(tiles.filter((t) => t.buy).length === buyable, `B  a locked tile has Buy when the owner can pay (${buyable} buyable on ${credits} credits)`);
  check(tiles.find((t) => t.key === lo1.loadout.boast)?.equipped, `B  the equipped tile is the server's (${names[lo1.loadout.boast]})`);
  await until(async () => ((await L(page)).stats.previews > 0));
  let l = await L(page);
  check(l.stats.previews > 0 && l.stats.current?.id === lo1.loadout.boast, `B  the preview plays the equipped boast on the board (${l.stats.current?.id})`);
  await wait(900);
  await shot(page, 'picker');

  // C. Equip a boast: a PUT, and the page shows the server's answer.
  const pick = choices.find((c) => c !== lo1.loadout.boast);
  let a = await equip(f, pick);
  let srv = await apiGet(page, `/api/agents/${first.agentId}/loadout`);
  l = await L(page);
  check(a.ok && srv.loadout.boast === pick && l.state.loadout.boast === pick, `C  Equip ${names[pick]}: the server has it, and the page shows the server's loadout`);
  check((await toastText(f)).includes(`Saved: ${names[pick]}`), `C  the page says it is saved ("${await toastText(f)}")`);
  check(await f.evaluate(() => document.activeElement && document.activeElement.classList.contains('rail-slot') || !!document.activeElement.closest('.tile')), 'C  focus stays in the slot panel after the redraw');

  // D. The close-win slot: equip, then empty.
  await railSlot(f, 'closeWinBoast');
  const cw = choices.find((c) => c !== pick);
  a = await equip(f, cw);
  srv = await apiGet(page, `/api/agents/${first.agentId}/loadout`);
  check(a.ok && srv.loadout.closeWinBoast === cw && srv.loadout.boast === pick, `D  close-win set to ${names[cw]}; the victory boast stays ${names[pick]}`);
  const railLine = await f.textContent('.rail-slot[data-slot="closeWinBoast"] .rs-val');
  check(railLine === names[cw], `D  the slot rail reads it (${railLine})`);
  a = await equip(f, '');
  srv = await apiGet(page, `/api/agents/${first.agentId}/loadout`);
  check(a.ok && srv.loadout.closeWinBoast === null, 'D  Equip on the empty tile empties the slot on the server');
  check((await f.textContent('.rail-slot[data-slot="closeWinBoast"] .rs-val')) === 'Empty: plays the main boast', 'D  the rail says what an empty close-win slot plays');

  // E. Buy from inside the picker: the website's confirm above it, then Equip.
  await railSlot(f, 'boast');
  const want = store.cosmetics.find((c) => !c.owned && c.priceCredits <= credits);
  await f.click(`[data-buy="${want.itemId}"]`);
  await page.waitForSelector('#dialog.on .dlg');
  const dlg = await page.textContent('#dialog .dlg');
  const onTop = await page.evaluate(() => { const b = document.querySelector('#dialog [data-a="yes"]').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return !!e && !!e.closest('#dialog'); });
  check(onTop && dlg.includes(want.name) && dlg.includes(String(want.priceCredits)), `E  Buy asks first, in the website's dialog, shown above the picker ("${dlg.replace(/\s+/g, ' ').slice(0, 70)}…")`);
  await shot(page, 'buy-confirm');
  await page.click('#dialog [data-a="no"]');
  await wait(300);
  let owned = (await apiGet(page, '/api/cosmetics')).owned.map((o) => o.itemId);
  check(!owned.includes(want.itemId) && (await apiGet(page, '/api/wallet')).credits === credits, 'E  Cancel buys nothing (credits unchanged)');
  await f.click(`[data-buy="${want.itemId}"]`);
  await page.waitForSelector('#dialog.on .dlg');
  await page.click('#dialog [data-a="yes"]');
  await until(() => f.evaluate((id) => !!document.querySelector(`[data-equip="${id}"]`), want.itemId));
  owned = (await apiGet(page, '/api/cosmetics')).owned.map((o) => o.itemId);
  const after = (await apiGet(page, '/api/wallet')).credits;
  l = await L(page);
  check(owned.includes(want.itemId) && after === credits - want.priceCredits && l.state.credits === after, `E  bought: the server owns ${want.name}, credits ${credits} -> ${after}, and the picker shows the new balance`);
  check((await S(page)).wallet.credits === after, 'E  the website\'s top bar shows the new balance too');
  check(l.state.slot === 'boast' && l.state.preview?.itemId === want.itemId, 'E  the picker stays on the slot, previewing what was bought');
  a = await equip(f, want.itemId);
  srv = await apiGet(page, `/api/agents/${first.agentId}/loadout`);
  check(a.ok && srv.loadout.boast === want.itemId, `E  then Equip: ${want.name} is the server's victory boast for ${first.name}`);
  await wait(900);
  await shot(page, 'bought-equipped');

  // F. Escape goes back to the Store; the row shows the saved loadout; focus on its button.
  await f.focus('body');
  await page.keyboard.press('Escape');
  await until(async () => !(await page.isVisible('#dress')));
  await until(async () => (await page.textContent(`.st-agent:has([data-agent="${first.agentId}"])`)).includes(want.name));
  const row1 = await page.textContent(`.st-agent:has([data-agent="${first.agentId}"])`);
  await until(async () => (await page.evaluate(() => document.activeElement?.dataset?.agent)) != null, 3000);
  const back = await page.evaluate(() => document.activeElement?.dataset?.agent);
  if (back !== first.agentId) note(`focus is on: ${await page.evaluate(() => { const a = document.activeElement; return a ? a.tagName + "#" + a.id + "." + a.className + " " + (a.dataset ? JSON.stringify(a.dataset) : "") : "none"; })}`);
  check(!(await page.isVisible('#dress')) && (await S(page)).dress === null, 'F  Escape closes the picker');
  check(row1.includes(`Victory boast: ${want.name}`) && back === first.agentId, `F  the row reads the server again (${want.name}) and focus is back on its Change button`);
  check((await page.textContent('.st-cos')).includes('Owned'), 'F  the Cosmetics panel shows the bought item as Owned');

  // G. The second agent's loadout is its own; Close button.
  f = await openFor(page, second.agentId);
  l = await L(page);
  const lo2b = await apiGet(page, `/api/agents/${second.agentId}/loadout`);
  check(l.state.loadout.boast === lo2b.loadout.boast && lo2b.loadout.boast !== want.itemId, `G  ${second.name}'s picker shows its own loadout (${names[lo2b.loadout.boast] ?? 'empty'}), not ${first.name}'s`);
  const ownedHere = await f.$$eval('.tile', (ts) => ts.filter((t) => !t.classList.contains('locked')).map((t) => t.dataset.tile));
  check(ownedHere.includes(want.itemId), `G  what the owner bought is offered to every agent (${want.name} has Equip here)`);
  await f.click('#close');
  await until(async () => !(await page.isVisible('#dress')));
  check(!(await page.isVisible('#dress')) && (await page.evaluate(() => document.activeElement?.dataset?.agent)) === second.agentId, 'G  Close goes back to the Store, focus on that agent\'s button');

  // H. A refused call: the session ended, so the PUT is refused; nothing saved.
  f = await openFor(page, first.agentId);
  const tok = await page.evaluate(() => JSON.parse(sessionStorage.getItem('aitcg.site.session')).token);
  await page.evaluate(async (t) => { await fetch('/api/session', { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } }); }, tok);
  const otherKey = choices[0] === want.itemId ? choices[1] : choices[0];
  a = await equip(f, otherKey);
  const said = await toastText(f);
  check(!a.ok && /Not saved/.test(said), `H  a refused Equip shows the refusal and saves nothing ("${said}")`);
  await until(async () => await page.isVisible('#signin'));
  check(await page.isVisible('#signin') && !(await page.isVisible('#dress')), 'H  the site then signs out (the picker is closed)');
  await signIn(page);
  srv = await apiGet(page, `/api/agents/${first.agentId}/loadout`);
  check(srv.loadout.boast === want.itemId, `H  the server still has ${want.name} (the refused change didn't land)`);
  await ctx.close();

  // I. A narrow window.
  const n = await open({ viewport: { width: 720, height: 900 } });
  await signIn(n.page);
  await goStore(n.page);
  const nf = await openFor(n.page, first.agentId);
  const wide = await nf.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(wide, 'I  720 px: the picker fits the window (no sideways scroll)');
  await wait(900);
  await shot(n.page, 'narrow');
  await n.ctx.close();

  // J. Reduce motion: the preview is the still, once.
  const r = await open({ reducedMotion: 'reduce' });
  await signIn(r.page);
  await goStore(r.page);
  await openFor(r.page, first.agentId);
  await until(async () => ((await L(r.page)).stats.current) != null);
  const rl = await L(r.page);
  check(rl.stats.current?.still === true, `J  under reduce motion the preview is the boast's still (still: ${rl.stats.current?.still})`);
  await r.ctx.close();

  // K. The page's headers: framed only by the site, fetches nothing.
  const h = await fetch(url + 'loadout');
  const csp = h.headers.get('content-security-policy') ?? '';
  check(h.status === 200 && /frame-ancestors 'self'/.test(csp) && !/connect-src/.test(csp), `K  /loadout: may be framed only by the site, no connect-src ("${csp.slice(0, 60)}…")`);
  const main = await fetch(url);
  check(/frame-src 'self'/.test(main.headers.get('content-security-policy') ?? ''), 'K  the website may frame its own pages (frame-src \'self\')');

  check(external.length === 0, `L  no request left the site (${external.length})`);
  check(errors.length === 0, `L  no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
} catch (e) {
  check(false, `the run stopped: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  try { process.kill(-demo.pid, 'SIGTERM'); } catch { /* gone */ }
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
}
