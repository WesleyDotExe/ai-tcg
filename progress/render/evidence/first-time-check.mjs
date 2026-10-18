// Render session 28: the first-time flow (owner 2026-10-18, slice 3 of the
// pack-opening work), driven like a new owner would in a real (headless)
// Chromium. Not a repo dependency: run with playwright-core against the
// preinstalled Chromium:
//   node first-time-check.mjs <outDir> <render/output/first-time.html> [video]
// Three runs, each from a fresh profile: 1280 x 800 with a mouse; 390 x 844
// with real touch events (CDP, so the page sees pointerType "touch"); and
// 390 x 844 with touch and reduced motion.
//   A. The whole flow by hand: Begin, a faction, the starter deck, the 3
//      starter packs through the real opening (torn by a tap, every card
//      tapped through, the summary), the agent, its signature card, the
//      mint, Continue, the ready screen.
//   B. Honest: each pack's summary shows exactly that faction's opened
//      cards with their NEW badges; the mint's terminal prints the store's
//      values; the made card is the one picked, with its number, its art
//      piece (not the empty window), the agent's name in its flavour.
//   C. The mint can't be skipped or cut short: taps, Escape and a hold on
//      the card during it change nothing, and there is no Continue until
//      the card has settled. Its beats run in order.
//   D. The ward really draws (lit pixels on its canvas) and folds into a
//      halo; the card can be held and tilted once it is free (never past
//      15 degrees, 6 with reduced motion).
//   E. No name is cut off with "..." on the faction, signature or ready
//      screens (the name fit).
//   F. The ready screen's totals: starter deck + pack cards + 1.
//   G. (render session 29, the name field) Desktop and phone type a name:
//      the field shows once an agent is picked, a name the store's rules
//      refuse (a staff word) disables the confirm with the store's reason,
//      "Keep generated" clears it, a good name renames the picked dossier
//      (the old name struck through) and redraws its avatar; on the phone a
//      tap focuses the field (the stage's pointer handling doesn't eat it).
//      The typed name, tidied, is then the one on the signature screen, in
//      the mint's terminal, in the card's flavour line and on the ready
//      screen. The reduced-motion run leaves it blank: the generated name.
//   H. (session 29, a session-28 bug) On the faction, agent and card
//      screens a pick can be changed: the first tap picks another plate,
//      the second the wanted one, and the plates not picked stay in place
//      and visible (they were taken out of the layout and hidden by the
//      pack page's full-screen .dim rule).
//   I. (render session 30, the starter guarantee) Every faction's 3 packs
//      hold a hit. The "Starter guarantee" note is nowhere on the page
//      while a pack is sealed, torn or revealing; on the summary it shows
//      exactly on the pack the store upgraded (reveal.starterHit). The
//      sealed pack looks the same on all 3 packs (same markup, same
//      classes), so nothing hints at the upgrade before the tear.
// Stills of every screen go to outDir; with "video", a desktop and a phone
// clip of the agent pick, the card pick, the mint and the ready screen.
import { chromium } from '/opt/node-tools/node_modules/playwright-core/index.mjs';
import { mkdirSync, renameSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [outDir, fileArg, video, tag = 'v2-s28'] = process.argv.slice(2);
// Session 29 keeps only the stills its change touches.
// Session 30 keeps only the pack stills (the note on the last summary).
const STILLS = tag === 'v2-s28' ? null : tag === 'v2-s30' ? new Set(['4-pack', '4b-last-summary']) : new Set(['5b-name-refused', '5c-name-typed', '6-sigs', '7d-mint-settled', '8-ready']);
const tidy = (n) => n.trim().replace(/\s+/g, ' ');
const file = resolve(fileArg);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const html = readFileSync(file, 'utf8');
const DATA = JSON.parse(/<script type="application\/json" id="pack-data">([\s\S]*?)<\/script>/.exec(html)[1]).flow;
let fails = 0;
const say = (s) => console.log(s);
const S = (p, fn, arg) => p.evaluate(fn, arg);
async function waitFor(p, fn, arg, ms = 30000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(40); }
  return false;
}
function pointer(p, touch, cdp) {
  async function t(type, x, y) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] }); }
  return {
    async down(x, y) { if (touch) await t('touchStart', x, y); else { await p.mouse.move(x, y); await p.mouse.down(); } },
    async move(x, y) { if (touch) await t('touchMove', x, y); else await p.mouse.move(x, y); },
    async up() { if (touch) await t('touchEnd'); else await p.mouse.up(); },
    async tap(x, y) {
      if (touch) await Promise.all([t('touchStart', x, y), t('touchEnd')]);
      else await Promise.all([p.mouse.move(x, y), p.mouse.down(), p.mouse.up()]);
    },
  };
}
const centre = async (p, sel) => { const r = await p.locator(sel).first().boundingBox({ timeout: 5000 }).catch(() => null); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2, r }; };
// A name is cut off when its text is wider than its box.
const cutNames = (p) => S(p, () => [...document.querySelectorAll('.face .name')].filter((n) => n.offsetParent).map((n) => { const r = document.createRange(); r.selectNodeContents(n); return { name: n.textContent, over: r.getBoundingClientRect().width - n.getBoundingClientRect().width }; }).filter((x) => x.over > 0.5));

async function run(name, size, touch, reduce, F_I, A_I, S_I, TYPED = null) {
  const ctx = await b.newContext({ viewport: size, hasTouch: touch, isMobile: touch, reducedMotion: reduce ? 'reduce' : 'no-preference', ...(video && !reduce ? { recordVideo: { dir: outDir, size } } : {}) });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const P = pointer(p, touch, cdp);
  const problems = [];
  const check = (ok, what) => { if (!ok) problems.push(what); };
  const still = (n) => (reduce || (STILLS && !STILLS.has(n)) ? null : p.screenshot({ path: `${outDir}/${tag}-${n}-${name}.jpg`, quality: 72 }));
  // Scrolled into view first, as a thumb would (on a phone the confirm
  // buttons sit below the fold of the scrolling pane).
  const tapSel = async (sel) => { await p.locator(sel).first().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(120); const c = await centre(p, sel); check(!!c, 'missing ' + sel); if (c) await P.tap(c.x, c.y); };
  const ft = () => S(p, () => window.__ft.step);
  // H: pick another plate first, then the wanted one; every plate stays
  // laid out and visible, and only the wanted one is selected.
  const pickChanged = async (sel, want, n) => {
    await tapSel(`${sel}[data-i="${(want + 1) % n}"]`); await p.waitForTimeout(200);
    await tapSel(`${sel}[data-i="${want}"]`); await p.waitForTimeout(250);
    const st = await S(p, (q) => [...document.querySelectorAll(q)].map((e) => { const cs = getComputedStyle(e); return { sel: e.classList.contains('sel'), pos: cs.position, op: Number(cs.opacity), h: Math.round(e.getBoundingClientRect().height) }; }), sel);
    const hs = st.map((x) => x.h);
    check(st.length === n && st.every((x, i) => x.sel === (i === want) && x.pos !== 'absolute' && x.op > 0.3) && Math.max(...hs) < Math.min(...hs) * 1.6 + 40, `H: changing the pick on ${sel} broke the plates: ` + JSON.stringify(st));
  };
  await p.goto('file://' + file);
  await waitFor(p, () => window.__ft && window.__ft.step === 'welcome');
  await p.waitForTimeout(1200); await still('1-welcome');
  await tapSel('#ft-go');
  check(await waitFor(p, () => window.__ft.step === 'faction'), 'A: Begin did not reach the faction screen');
  await p.waitForTimeout(900);
  check((await cutNames(p)).length === 0, 'E: a name is cut on the faction screen ' + JSON.stringify(await cutNames(p)));
  await pickChanged('.ft-fac', F_I, DATA.factions.length);
  await p.waitForTimeout(250); await still('2-faction');
  check((await S(p, () => document.getElementById('ft-ok').textContent)) === 'Start with ' + DATA.factions[F_I].faction, 'A: the confirm does not name the faction');
  await tapSel('#ft-ok');
  check(await waitFor(p, () => window.__ft.step === 'starter'), 'A: no starter screen');
  await p.waitForTimeout(2000); await still('3-starter');
  const fac = DATA.factions[F_I];
  check((await S(p, () => document.querySelectorAll('.ft-sc').length)) === 5, 'A: the starter fan is not 5 cards');
  await tapSel('#ft-open');
  // The 3 starter packs, through the real opening.
  check(fac.packs.some((pk) => pk.reveal.cards.some((c) => c.hit)), `I: ${fac.faction}'s starter packs hold no hit`);
  const noteShown = () => /Starter guarantee/.test(document.body.innerText);
  const sealed = [];
  for (let k = 0; k < fac.packs.length; k++) {
    check(await waitFor(p, () => window.__pack.phase === 'pack'), `A: pack ${k + 1} not sealed`);
    await p.waitForTimeout(150);
    sealed.push(await S(p, () => document.getElementById('pack').outerHTML.replace(/style="[^"]*"/g, '')));
    check(!(await S(p, noteShown)), `I: the guarantee note shows on sealed pack ${k + 1}`);
    check((await S(p, () => document.getElementById('ftbadge').textContent)) === `STARTER PACK ${k + 1} OF ${3}`, `A: pack ${k + 1} badge`);
    if (k === 0) await still('4-pack');
    await p.waitForTimeout(300);
    const pk = await centre(p, '#pack'); await P.tap(pk.x, pk.y + pk.r.height * 0.25);
    check(await waitFor(p, () => window.__pack.phase === 'cards' || window.__pack.phase === 'summary'), `A: pack ${k + 1} did not tear`);
    for (let guard = 0; guard < 40; guard++) {
      if ((await S(p, () => window.__pack.phase)) === 'summary') break;
      check(!(await S(p, noteShown)), `I: the guarantee note shows before pack ${k + 1}'s summary`);
      await waitFor(p, () => performance.now() >= window.__pack.busyUntil, null, 8000);
      const st = await centre(p, '.stack'); if (st) await P.tap(st.x, st.y);
      await p.waitForTimeout(260);
    }
    check(await waitFor(p, () => window.__pack.phase === 'summary'), `A: pack ${k + 1} never reached its summary`);
    const shown = await S(p, () => window.__pack.log.filter((e) => e.kind === 'summary').pop().cards);
    const want = fac.packs[k].reveal.cards.map((c) => ({ name: c.face.name, finish: c.finish, isNew: c.isNew }));
    check(JSON.stringify(shown) === JSON.stringify(want), `B: pack ${k + 1}'s summary is not the store's opening`);
    check((await S(p, noteShown)) === fac.packs[k].reveal.starterHit, `I: pack ${k + 1}'s summary note is not the store's starterHit (${fac.packs[k].reveal.starterHit})`);
    if (k === fac.packs.length - 1) { await p.waitForTimeout(600); await still('4b-last-summary'); check(/You now hold \d+ cards/.test(await S(p, () => document.querySelector('.ft-held')?.textContent || '')), 'F: no holdings line after the last pack'); }
    await tapSel('#ft-next');
  }
  check(sealed.every((h) => h === sealed[0]), 'I: the sealed packs differ: ' + sealed.map((h) => h.length).join(','));
  check(await waitFor(p, () => window.__ft.step === 'agents'), 'A: no agent screen after the packs');
  check(await waitFor(p, () => document.querySelectorAll('.ft-aname.typed').length === 3), 'A: the agent names never finished typing');
  const names = await S(p, () => [...document.querySelectorAll('.ft-aname')].map((n) => n.textContent));
  check(JSON.stringify(names) === JSON.stringify(DATA.agents.map((a) => a.name)), 'B: the agent names are not the draft');
  await still('5-agents');
  if (video && !reduce) await p.waitForTimeout(600);
  await pickChanged('.ft-agent', A_I, DATA.agents.length);
  const gen = DATA.agents[A_I].name;
  check(await S(p, () => !document.getElementById('ft-nm').hidden), 'G: no name field after picking an agent');
  check(/^Season 0 sign-up/.test(await S(p, () => document.getElementById('foot').textContent)), 'G: the agent screen still shows the pack footer');
  check((await S(p, () => document.getElementById('ft-name').placeholder)) === gen, 'G: the field does not offer the generated name');
  check((await S(p, () => document.getElementById('ft-ok').textContent)) === 'Pick ' + gen, 'G: the blank field does not keep the generated name');
  let agentName = gen;
  if (TYPED !== null) {
    const typeIn = async (t) => { await tapSel('#ft-name'); await p.keyboard.type(t, { delay: 15 }); await p.waitForTimeout(150); };
    await tapSel('#ft-name');
    check(await S(p, () => document.activeElement && document.activeElement.id === 'ft-name'), 'G: a tap did not focus the name field');
    await typeIn('TheRealAdmin');
    const bad = await S(p, () => ({ dis: document.getElementById('ft-ok').disabled, txt: document.getElementById('ft-ok').textContent, msg: document.getElementById('ft-nmmsg').textContent, cls: document.getElementById('ft-nm').className }));
    check(bad.dis && bad.txt === 'Name not allowed' && /pose as staff or the game \("admin"\)/.test(bad.msg) && /bad/.test(bad.cls), 'G: a refused name was not refused: ' + JSON.stringify(bad));
    const keepBtn = await S(p, () => { const k = document.getElementById('ft-nmkeep'), cs = getComputedStyle(k); return { shown: !k.hidden && k.offsetWidth > 0, text: k.textContent, color: cs.color, bg: cs.backgroundColor }; });
    check(keepBtn.shown && keepBtn.text === 'Keep generated' && keepBtn.color !== keepBtn.bg && !/255, 255, 255/.test(keepBtn.bg), 'G: the Keep generated button is not readable: ' + JSON.stringify(keepBtn));
    await still('5b-name-refused');
    await tapSel('#ft-ok');
    check((await ft()) === 'agents', 'G: a refused name could be confirmed');
    await tapSel('#ft-nmkeep');
    check((await S(p, () => document.getElementById('ft-name').value)) === '' && (await S(p, () => document.getElementById('ft-ok').textContent)) === 'Pick ' + gen, 'G: Keep generated did not clear the name');
    const avBefore = await S(p, (i) => document.querySelector(`.ft-agent[data-i="${i}"] .ft-av`).innerHTML, A_I);
    await typeIn(TYPED);
    agentName = tidy(TYPED);
    const good = await S(p, (i) => ({ dis: document.getElementById('ft-ok').disabled, txt: document.getElementById('ft-ok').textContent, shown: document.querySelector(`.ft-agent[data-i="${i}"] .ft-aname`).innerText, was: document.querySelector(`.ft-agent[data-i="${i}"] .ft-aname .was`)?.textContent, av: document.querySelector(`.ft-agent[data-i="${i}"] .ft-av`).innerHTML, cls: document.getElementById('ft-nm').className }), A_I);
    check(!good.dis && good.txt === 'Pick ' + agentName && /good/.test(good.cls), 'G: a good name was not taken: ' + JSON.stringify({ ...good, av: undefined }));
    check(good.shown.startsWith(agentName) && good.was === gen, 'G: the dossier does not show the typed name over the generated one: ' + good.shown);
    check(good.av !== avBefore, 'G: the avatar did not follow the typed name');
    await p.locator('#ft-name').blur(); await p.waitForTimeout(200);
    await still('5c-name-typed');
  }
  await tapSel('#ft-ok');
  check(await waitFor(p, () => window.__ft.step === 'sigs'), 'A: no signature screen');
  check((await S(p, () => document.querySelector('.ft-pane h2').textContent)) === agentName.toUpperCase() + '’S SIGNATURE CARD', 'G: the signature screen does not name ' + agentName);
  await p.waitForTimeout(1000);
  check((await cutNames(p)).length === 0, 'E: a name is cut on the signature screen ' + JSON.stringify(await cutNames(p)));
  check((await S(p, () => document.querySelectorAll('.ft-sig .face .art').length)) === 3 && (await S(p, () => [...document.querySelectorAll('.ft-sig .art')].every((a) => a.textContent.includes('ART PIECE')))), 'B: a pick-screen card shows art before it is made');
  await pickChanged('.ft-sig', S_I, 3); await p.waitForTimeout(100); await still('6-sigs');
  if (video && !reduce) await p.waitForTimeout(500);
  await tapSel('#ft-ok');
  const t0 = Date.now();
  check(await waitFor(p, () => window.__ft.step === 'mint'), 'A: the mint did not start');
  // C: nothing skips it. Taps on the card and the backdrop, Escape, a hold.
  // With reduced motion every beat is cut to a flash (the pack page's rule),
  // so the whole mint is over in about a second; there it is checked for its
  // end state and its order, below, not probed half way.
  if (!reduce) {
  await p.waitForTimeout(1300); await still('7a-mint-terminal');
  const card = await centre(p, '#mcard');
  await P.tap(card.x, card.y); await P.tap(20, size.height - 20); await p.keyboard.press('Escape'); await p.keyboard.press('Enter');
  await P.down(card.x, card.y); await p.waitForTimeout(350); await P.move(card.r.x + card.r.width, card.r.y); await p.waitForTimeout(150);
  const leanEarly = await S(p, () => document.querySelector('#mcard .mtilt').style.transform);
  await P.up();
  check(!/rotate/.test(leanEarly), 'C: the card tilted before it was free: ' + leanEarly);
  check((await ft()) === 'mint', 'C: a tap or a key moved the mint on');
  check((await S(p, () => !document.getElementById('ft-cont'))), 'C: Continue showed before the card settled');
  }
  check(await waitFor(p, () => window.__ft.mintLog.some((e) => e.kind === 'ward')), 'D: the ward never started');
  await p.waitForTimeout(500);
  const lit = await S(p, () => { const c = document.getElementById('mward'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 37) if (d[i] + d[i + 1] + d[i + 2] > 180) n++; return n; });
  check(lit > 200, 'D: the ward canvas is dark (' + lit + ' lit samples)');
  await still('7b-mint-ward');
  check(await waitFor(p, () => window.__ft.mintLog.some((e) => e.kind === 'stamp')), 'C: no stamp');
  await still('7c-mint-stamp');
  check(await S(p, () => (window.getSelection() + '').length === 0), 'C: a drag during the mint selected text');
  check(await waitFor(p, () => window.__ft.step === 'minted'), 'C: the mint never freed');
  const took = Date.now() - t0;
  if (reduce) check(took < 4000, 'C: with reduced motion the mint still took ' + took + ' ms');
  const log = await S(p, () => window.__ft.mintLog);
  const order = ['gather', 'line', 'ward', 'forge', 'stamp', 'settle', 'free'];
  const firstAt = order.map((k) => log.find((e) => e.kind === k)?.t ?? -1);
  check(firstAt.every((t, i) => t >= 0 && (i === 0 || t >= firstAt[i - 1])), 'C: the beats ran out of order ' + JSON.stringify(log.map((e) => e.kind)));
  // B: the terminal and the made card are the store's.
  // What confirmAgentDraft makes under that name (firstTime.test.ts pins
  // this against the store): the name, and the flavour line printed with it.
  const a = DATA.agents[A_I], c = a.signatures[S_I];
  const m = { ...a.minted[S_I], agentName, face: { ...a.minted[S_I].face, flavor: a.minted[S_I].face.flavor.split(gen).join(agentName) } };
  const term = await S(p, () => document.getElementById('mterm').innerText);
  for (const v of [m.agentName, c.name, `piece ${m.art.slot} of ${m.art.of}`, c.comboId, m.collectorNumber, '1 of 1']) check(term.includes(v), 'B: the terminal lacks ' + v);
  const face = await S(p, () => { const f = document.querySelector('#mcard .face'); return { cls: f.className, text: f.innerText, pending: f.querySelector('.art').textContent.includes('ART PIECE') }; });
  check(face.cls.includes('sigface') && face.cls.includes('full'), 'B: the made card is not a signature face: ' + face.cls);
  check(!face.pending, 'B: the made card still shows the empty art window');
  check(face.text.includes(m.collectorNumber) && face.text.includes('1 OF 1') && face.text.includes(m.agentName), 'B: the made card lacks its number, 1 OF 1 or the agent in its flavour');
  check(face.text.replace(/\s+/g, ' ').includes(m.face.flavor.replace(/\s+/g, ' ')), 'G: the flavour line is not the one the store prints: ' + m.face.flavor);
  if (agentName !== gen) check(!face.text.includes(gen), 'G: the made card still names the generated agent');
  check(await S(p, () => !!document.querySelector('#mcard .fxgl-signature') || document.querySelector('#mcard .face').classList.contains('fx-css-signature')), 'D: no signature light on the made card');
  await p.waitForTimeout(400); await still('7d-mint-settled');
  // D: free to tilt now.
  const c2 = await centre(p, '#mcard');
  await P.down(c2.x, c2.y); await p.waitForTimeout(320);
  for (let i = 1; i <= 8; i++) { await P.move(c2.x + (c2.r.width * 0.6) * i / 8, c2.y - (c2.r.height * 0.6) * i / 8); await p.waitForTimeout(30); }
  await p.waitForTimeout(150);
  const lean = await S(p, () => { const m = /rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\)/.exec(document.querySelector('#mcard .mtilt').style.transform); return m ? [Number(m[1]), Number(m[2])] : null; });
  const max = reduce ? 6 : 15;
  check(lean && Math.abs(lean[0]) > 1 && Math.abs(lean[1]) > 1 && Math.abs(lean[0]) <= max + 0.01 && Math.abs(lean[1]) <= max + 0.01, 'D: the made card did not lean within ' + max + ': ' + JSON.stringify(lean));
  if (!reduce) await still('7e-mint-tilt');
  await P.up(); await p.waitForTimeout(700);
  check((await ft()) === 'minted', 'C: letting go of the tilt moved the mint on');
  await tapSel('#ft-cont');
  check(await waitFor(p, () => window.__ft.step === 'ready'), 'A: Continue did not reach the ready screen');
  await p.waitForTimeout(900); await still('8-ready');
  check((await cutNames(p)).length === 0, 'E: a name is cut on the ready screen ' + JSON.stringify(await cutNames(p)));
  const tot = await S(p, () => [...document.querySelectorAll('.ft-hold b')].map((x) => Number(x.textContent)));
  check(JSON.stringify(tot) === JSON.stringify([fac.deckSize, fac.heldAfter.copies - fac.deckSize, 1, fac.heldAfter.copies + 1]), 'F: the totals are wrong ' + JSON.stringify(tot));
  const readyText = await S(p, () => document.querySelector('.ft-pane').innerText);
  check(readyText.includes(agentName.toUpperCase() + ' IS READY') && readyText.includes('bound to ' + agentName), 'G: the ready screen does not name ' + agentName);
  await tapSel('#ft-view');
  check(await waitFor(p, () => !document.getElementById('viewer').hidden), 'A: the card viewer did not open');
  await p.waitForTimeout(500); await still('9-viewer');
  check(errs.length === 0, 'page errors: ' + errs.join(' | '));
  say(`${name}: ${problems.length ? 'FAIL' : 'pass'} (faction ${fac.faction}, starter guarantee on pack ${fac.packs.findIndex((pk) => pk.reveal.starterHit) + 1 || 'none'}, agent ${a.name}${agentName !== gen ? ` typed as "${agentName}"` : ''}, card ${c.name}; mint ${took} ms tap-to-free, beats ${log.filter((e) => order.includes(e.kind) && e.kind !== 'line').map((e) => e.kind + '@' + e.t).join(' ')}; lean ${JSON.stringify(lean)}; ward lit ${lit})`);
  problems.forEach((x) => say('  - ' + x));
  fails += problems.length;
  const v = video && !reduce ? p.video() : null;
  await ctx.close();
  if (v) renameSync(await v.path(), `${outDir}/${tag}-first-time-${name}.webm`);
}

mkdirSync(outDir, { recursive: true });
// From session 29 the desktop and phone runs type a name; the defaults
// (tag v2-s28) are session 28's runs, unchanged apart from the G checks on
// the blank field.
const typing = tag !== 'v2-s28';
await run('desktop', { width: 1280, height: 800 }, false, false, 2, 1, 1, typing ? '  Night   Shift 99 ' : null);
await run('phone', { width: 390, height: 844 }, true, false, 0, 2, 0, typing ? 'Bit by Bit' : null);
await run('phone-reduced', { width: 390, height: 844 }, true, true, 3, 0, 2);
await b.close();
say(fails ? `FAILED: ${fails} problem(s)` : 'all pass');
process.exit(fails ? 1 : 0);
