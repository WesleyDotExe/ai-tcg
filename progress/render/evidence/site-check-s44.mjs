// Render session 44: the owner website's first slice, driven in a headless
// browser against the real owner API (render/src/site/siteDemo.ts: a fresh
// season database, the game lane's owner API unchanged, the site host in
// front). Every click below is an HTTP request through the page to the
// real store. Prints one line per check and writes stills.
//
//   node progress/render/evidence/site-check-s44.mjs [stills dir]
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

// The demo, on a port the OS picks... the demo prints its URL.
const demo = spawn('npx', ['tsx', 'src/site/siteDemo.ts', '--port', '0'], { cwd: resolve(ROOT, 'render'), stdio: ['ignore', 'pipe', 'pipe'] });
const url = await new Promise((ok, fail) => {
  let buf = '';
  demo.stdout.on('data', (d) => { buf += d; const m = /\[site-demo\] (http:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
  demo.on('exit', (c) => fail(new Error(`the demo exited (${c}) before it listened`)));
  setTimeout(() => fail(new Error('the demo took over 60 s to start')), 60000);
});

let passes = 0, fails = 0;
const check = (ok, line) => { if (ok) passes++; else fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${line}`); };
const chromium = await loadPlaywright();
const browser = await chromium.launch({ args: ['--disable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const external = [];
page.on('request', (r) => { if (!r.url().startsWith(url) && !r.url().startsWith('data:')) external.push(r.url()); });
const S = () => page.evaluate(() => window.__site.state());
const shot = (name) => page.screenshot({ path: resolve(OUT, `v2-s44-site-${name}.jpg`), type: 'jpeg', quality: 82 });
// Opens a page from the sidebar and waits for the hash route to draw it.
const go = async (id) => { await page.click(`a[data-page="${id}"]`); await page.waitForFunction((id) => window.__site.state().page === id, id); };
const toastText = () => page.evaluate(() => { const t = document.querySelector('#toast'); return t.classList.contains('on') ? t.textContent : null; });

try {
  // ---- sign-in ----
  await page.goto(url);
  await page.waitForSelector('#signin:not([hidden])');
  check(await page.isVisible('#si-login') && !(await S()).signedIn, 'A. a fresh browser opens on sign-in');
  await shot('signin');
  await page.click('#si-go');
  check((await page.textContent('#si-msg')) === 'Enter your login and password.', 'A. empty fields: asks for both, sends nothing');
  await page.fill('#si-login', 'nova'); await page.fill('#si-pass', 'not it');
  await page.click('#si-go');
  await page.waitForFunction(() => !document.querySelector('#si-msg').hidden && document.querySelector('#si-msg').textContent !== 'Enter your login and password.');
  check((await page.textContent('#si-msg')) === 'Wrong login or password.', `A. a wrong password: "${await page.textContent('#si-msg')}" (the API's 401)`);
  await page.fill('#si-pass', 'a long demo password');
  await page.click('#si-go');
  await page.waitForSelector('#shell:not([hidden])');
  const s1 = await S();
  check(s1.signedIn && s1.page === 'home' && s1.play.connectedAgent.name === 'Vector Halcyon', 'A. signed in: Home, with the connected agent from GET /api/play');

  // ---- the shell ----
  const nav = await page.$$eval('#nav .navb', (as) => as.map((a) => a.textContent.trim()));
  check(JSON.stringify(nav) === JSON.stringify(['Home', 'Agent match', 'Watch live', 'Collection', 'Store', 'TournamentSoon', 'Stats', 'Settings', 'Connect agent']), `B. the sidebar, in the spec's order: ${nav.join(' | ')}`);
  check((await page.textContent('#agent-card')).includes('Vector Halcyon') && (await page.textContent('#agent-card')).includes('Ready'), 'B. the agent card: name, play style, Ready');
  check((await page.textContent('#acct-btn')) === 'N' && (await page.textContent('#title')) === 'Home', 'B. the top bar: page title, account initial');
  const home = await page.textContent('#page');
  check(home.includes('no deck built yet') && home.includes("the agent hasn't built a deck yet"), "B. Home's Deck panel: no deck yet, and the store's rebuild reason");
  await shot('home-light');
  await page.click('a[data-page="tournament"]', { force: true });
  check((await S()).page === 'home' && (await toastText()) === 'Tournaments come after Season 0.', 'B. Tournament is "Soon": it stays on the page and says why');
  await go('collection');
  check((await page.textContent('#page')).includes('Waiting on the server for: wallet and collection.'), 'B. Collection says plainly what it waits on (no made-up numbers)');

  // ---- Settings -> Play: rebuild now ----
  await go('settings');
  const before = await page.isEnabled('#rebuild');
  await page.click('#rebuild');
  await page.waitForFunction(() => window.__site.state().play.rebuild.job && window.__site.state().play.rebuild.job.state === 'running');
  check(before && (await page.textContent('#rebuild')) === 'Building…' && await page.isDisabled('#rebuild'), 'C. Rebuild now: a running job, the button waits');
  await shot('settings-building');
  // The page keeps answering while the server's worker builds.
  await go('home');
  check((await S()).page === 'home', 'C. the site keeps working while the agent builds');
  await go('settings');
  await page.waitForFunction(() => { const j = window.__site.state().play.rebuild.job; return j && j.state !== 'running'; }, null, { timeout: 120000 });
  const done = (await S()).play;
  check(done.rebuild.job.state === 'done' && done.agentDeck && done.agentDeck.cards >= 20, `C. the job ends (polled): ${done.rebuild.job.state}, a ${done.agentDeck ? done.agentDeck.cards : '?'}-card ${done.rebuild.job.result ? done.rebuild.job.result.faction : '?'} deck`);
  await page.waitForTimeout(200);
  const txt = await page.textContent('#page');
  check(txt.includes('Last build') && txt.includes(`Built a ${done.agentDeck.cards}-card ${done.rebuild.job.result.faction} deck.`) && txt.includes("Your agent's deck is up to date."), 'C. the page shows the build and "up to date"');
  check((await page.$$('.deckrow')).length === done.decks.length && done.decks.length >= 1, `C. the saved decks list the built deck (${done.decks.length})`);
  await shot('settings-built');
  // Rebuild when up to date asks first (a centred dialog); Cancel sends nothing.
  await page.click('#rebuild');
  await page.waitForSelector('.dim.on .dlg');
  check((await page.textContent('.dlg h2')) === 'Rebuild anyway?', 'C. rebuilding an up-to-date deck asks first, in a centred dialog');
  await shot('dialog');
  await page.keyboard.press('Escape');
  check(!(await page.isVisible('.dim.on')) && (await S()).play.rebuild.job.jobId === done.rebuild.job.jobId, 'C. Escape cancels it, no new job');

  // ---- faction lock ----
  const built = done.rebuild.job.result.faction;
  const other = ['Cortex', 'Swarm', 'Aegis', 'Null'].find((f) => f !== built);
  await page.click(`#faction-lock button[data-v="${other}"]`);
  await page.waitForFunction((f) => window.__site.state().play.factionLock === f, other);
  check((await toastText() ?? '').startsWith(`The deck that plays now isn't ${other}.`), `D. locking to ${other} (the deck is ${built}): the API's activeDeckFits=false, said in words`);
  const rb = (await S()).play.rebuild.reasons;
  check(rb.length > 0 && (await page.textContent('.rb-note')).includes(rb[0]), `D. the store's new rebuild reason shows: "${rb[0]}"`);
  await page.click('#faction-lock button[data-v=""]');
  await page.waitForFunction(() => window.__site.state().play.factionLock === null);
  check((await page.getAttribute('#faction-lock button[data-v=""]', 'aria-pressed')) === 'true' && (await S()).play.rebuild.reasons.length === 0, 'D. back to Any: the reason goes with the lock');

  // ---- forced deck ----
  await page.click('.deckrow');
  await page.waitForFunction(() => window.__site.state().play.deckChoice === 'forced');
  check((await page.getAttribute('#deck-choice button[data-v="forced"]', 'aria-pressed')) === 'true' && await page.isDisabled('#rebuild'), 'E. picking a saved deck forces it; Rebuild now is off while forced');
  await page.click('#deck-choice button[data-v="agent"]');
  await page.waitForFunction(() => window.__site.state().play.deckChoice === 'agent');
  check(await page.isEnabled('#rebuild') && (await page.textContent('#page')).includes('Your agent picks:'), 'E. Agent picks: the choice goes back to the agent, Rebuild now is on again');

  // ---- play style ----
  const agents = (await S()).play.agents;
  await page.selectOption(`select[data-style-for="${agents[0].agentId}"]`, { index: 1 });
  await page.waitForFunction((id) => window.__site.state().play.agents.find((a) => a.agentId === id).playStyle !== 'calculator', agents[0].agentId);
  const p2 = (await S()).play;
  const newStyle = p2.playStyles.find((s) => s.id === p2.connectedAgent.playStyle).name;
  check((await page.textContent('#agent-card')).includes(newStyle), `F. a play style change saves (PUT /api/agents/:id/play-style) and the agent card says ${newStyle}`);

  // ---- theme ----
  await page.click('#theme-seg button[data-v="dark"]');
  check((await S()).drawn === 'dark', 'G. Dark from Settings -> Display');
  await go('home');
  await shot('home-dark');
  await go('settings');
  await shot('settings-dark');
  await page.click('#theme-btn');
  check((await S()).theme === 'system', 'G. the top bar button cycles on to System');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(50);
  const sysDark = (await S()).drawn;
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(50);
  check(sysDark === 'dark' && (await S()).drawn === 'light', 'G. System follows the computer (dark, then light)');

  // ---- a reload stays signed in; the server's sign-out ends it ----
  await page.reload();
  await page.waitForSelector('#shell:not([hidden])');
  check((await S()).page === 'settings', 'H. a reload stays signed in, on the same page (#/settings)');
  await page.click('#acct-btn');
  await page.click('#sign-out');
  await page.waitForSelector('.dim.on .dlg');
  await page.click('.dlg [data-a="yes"]');
  await page.waitForSelector('#signin:not([hidden])');
  check(!(await S()).signedIn && (await page.textContent('#si-msg')) === 'Signed out.', 'H. Sign out (confirmed): DELETE /api/session, back to sign-in');
  // An old token: signed in again, then the token revoked behind the page's back.
  await page.fill('#si-login', 'nova'); await page.fill('#si-pass', 'a long demo password'); await page.click('#si-go');
  await page.waitForSelector('#shell:not([hidden])');
  await page.evaluate(async () => { const s = JSON.parse(sessionStorage.getItem('aitcg.site.session')); await fetch('/api/session', { method: 'DELETE', headers: { Authorization: 'Bearer ' + s.token } }); });
  await page.click('#deck-choice button[data-v="forced"]');
  await page.waitForSelector('#signin:not([hidden])');
  check((await page.textContent('#si-msg')) === "You've been signed out. Sign in again.", 'H. a revoked token: the next request (401) returns to sign-in');

  // ---- narrow window ----
  await page.setViewportSize({ width: 700, height: 800 });
  await page.fill('#si-login', 'nova'); await page.fill('#si-pass', 'a long demo password'); await page.click('#si-go');
  await page.waitForSelector('#shell:not([hidden])');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(over <= 0, `I. a 700 px window: the sidebar folds to icons, nothing spills sideways (${over} px)`);
  await shot('narrow');

  check(errors.length === 0, `Z. no page errors (${errors.length}${errors.length ? ': ' + errors[0] : ''})`);
  check(external.length === 0, `Z. no request leaves the site's origin (${external.length})`);
} catch (err) {
  fails++;
  console.log('FAIL  the run stopped: ' + (err && err.stack || err));
} finally {
  await browser.close();
  demo.kill('SIGTERM');
}
console.log(`\n${passes} passed, ${fails} failed: ${fails ? 'FAIL' : 'ALL PASS'}`);
process.exit(fails ? 1 : 0);
