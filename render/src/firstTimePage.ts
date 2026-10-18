// The first-time flow's page (render session 28; owner 2026-10-18, slice 3
// of the pack-opening work: "the first-time flow: an agent's first packs and
// the leader (signature card) reveal"). It is the pack-opening page with a
// flow around it: renderPackOpeningHtml({ ..., flow }) adds this CSS and
// runtime, and the pack runtime hands the flow its pieces (window.PACK: the
// pack opening itself, the card faces, the tilt, the viewer, the finish
// layers, the sound).
//
// The screens, in order (each plays back what the economy store returned,
// firstTime.ts):
//   1. Welcome.
//   2. Pick a starting faction (4 plates, each showing its starter deck's
//      Mythic).
//   3. The starter deck: its box drops in, its rarest cards fan out, the 3
//      starter packs slide in beside it.
//   4. The 3 starter packs, one after another, through the real pack
//      opening (tear, stack, reveals, summary).
//   5. Generate your agent: 3 generated agents (avatar, name typing,
//      persona). One pick per draft, as in the store.
//   6. Its signature card: 3 cards to pick from. Their art window is empty:
//      the store draws the card's art-pool piece only when it is made.
//   7. The mint: the card is made in front of the owner. The other cards
//      fall away, the chosen one turns face down and flies to the middle,
//      the screen goes dark, a terminal prints what the store recorded
//      (agent, card, fairness line, art piece, number), the card's own ward
//      draws itself in behind it, the card turns face up as the made card
//      (its face burning in, its art developing), the number plate presses
//      in, and the ward folds into a halo with the signature light on.
//      Then it can be held and tilted.
//   8. Ready: the agent, its card, and what the owner now holds.

import { FALLBACK_WARD_PURE_SOURCE, FALLBACK_WARD_RUNTIME_SOURCE } from "./fallbackWard.js";

/** Pure helpers, run by the page and by the tests (new Function). */
export const FIRST_TIME_PURE_SOURCE = String.raw`
  // The flow's steps, as the rail at the top names them, and which rail
  // step each screen belongs to.
  var FT_RAIL = ['Faction', 'Packs', 'Agent', 'Signature'];
  function ftRailIndex(step) {
    return { welcome: -1, faction: 0, starter: 1, packs: 1, agents: 2, sigs: 3, mint: 3, minted: 3, ready: 3 }[step];
  }
  // The generator's concept reads "Name: cost 5, 3/6. ..."; the pick
  // screen prints the name above it, so only the part after the name.
  function ftConceptTail(name, concept) {
    return concept.indexOf(name + ': ') === 0 ? concept.slice(name.length + 2) : concept;
  }
  // What the mint's terminal prints, from what the store recorded. Each
  // line is [label, value]; the label prints at once, the value types.
  function ftMintLines(setCode, agent, choice, minted) {
    return [
      ['> MINT SIGNATURE', 'SEASON ' + setCode],
      ['  agent', minted.agentName],
      ['  card', choice.name],
      ['  fairness', 'passed at ' + choice.measured.seeds.toLocaleString('en-US') + ' games · ' + choice.comboId],
      ['  art', 'pool ' + minted.art.pool + ' · piece ' + minted.art.slot + ' of ' + minted.art.of],
      ['  number', minted.collectorNumber]
    ];
  }
  // The line printed when the plate presses in.
  function ftBoundLine(minted) { return ['  bound', 'SIGNATURE · 1 of 1 · never sold']; }
  // When each beat of the mint starts, in ms from the tap, for the given
  // lines and timings (MINT_TIMINGS). The page schedules from this, and the
  // tests check its order and length.
  function ftMintSchedule(lines, MT) {
    var t = MT.gather, starts = [];
    lines.forEach(function (ln) { starts.push(t); t += ln[1].length * MT.typePerChar + MT.lineGap; });
    var ward = starts.length > 1 ? starts[1] : MT.gather;
    // The card turns once the terminal is done and the ward has spun up.
    var forge = Math.max(t, ward + MT.wardIn);
    var stamp = forge + MT.forge, settle = stamp + MT.stamp, done = settle + MT.settle;
    return { lines: starts, ward: ward, forge: forge, stamp: stamp, settle: settle, done: done, free: done + MT.hold };
  }
  // A signature card as the pick screen shows it (art still to come, no
  // number yet), and as it is made.
  function ftCandidate(choice) { return { face: choice.face, reveal: 'signature', finish: 'signature', collectorNumber: 'PR-···', artPending: true, hit: true }; }
  function ftMinted(minted) { return { face: minted.face, reveal: 'signature', finish: 'signature', collectorNumber: minted.collectorNumber, artPending: false, hit: true }; }
  // A starter deck card's face entry.
  function ftStarterCard(c) { return { face: c.face, reveal: 'plain', finish: 'standard', collectorNumber: c.collectorNumber }; }
`;

export const FIRST_TIME_CSS = `
/* ---------- the first-time flow (render session 28) ---------- */
.rail { display: flex; gap: 4px; flex: 1 1 260px; min-width: 0; overflow-x: auto; padding: 0; margin: 0; list-style: none; counter-reset: rail; }
.rail li { flex: none; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #5b6b8f; padding: 3px 9px; border-radius: 999px; border: 1px solid transparent; counter-increment: rail; }
.rail li::before { content: counter(rail) " "; color: #3c4a6b; }
.rail li.done { color: var(--dim); }
.rail li.cur { color: var(--ink); border-color: #6a8cff; background: #17204a; }
.ftbadge { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 6; font-size: 11px; letter-spacing: 0.16em; font-weight: 800; color: var(--neutral); background: rgba(13,19,36,0.8); border: 1px solid rgba(255,240,194,0.35); border-radius: 999px; padding: 3px 12px; white-space: nowrap; }
.ftbadge:empty { display: none; }
.ft-pane { width: min(1040px, calc(100vw - 32px)); max-height: calc(100% - 16px); overflow-y: auto; padding: 18px 0 64px; text-align: center; touch-action: pan-y; }
.ft-pane h2 { margin: 0 0 4px; font-size: clamp(18px, 4.6vw, 26px); letter-spacing: 0.14em; }
.ft-pane .sub { margin: 0 auto 16px; max-width: 640px; color: var(--dim); font-size: 13px; }
.ft-pane .btns button[disabled] { opacity: 0.45; cursor: default; }
@keyframes ftin { from { opacity: 0; transform: translateY(18px) scale(0.97); } to { opacity: 1; transform: none; } }

/* 1. welcome */
.ft-wel { position: relative; text-align: center; padding: 16px; max-width: 560px; }
.ft-wel .ft-fan { position: relative; height: 150px; margin-bottom: 8px; --cw: 92px; }
.ft-wel .ft-fan .fb { position: absolute; left: 50%; top: 10px; width: 92px; height: 129px; margin-left: -46px; transform-origin: 50% 160%; transform: rotate(calc((var(--k) - 2) * 11deg)); animation: ftfan 0.9s cubic-bezier(.2,.9,.3,1) both; animation-delay: calc(var(--k) * 80ms); }
.ft-wel .ft-fan .fb .back { animation: none; }
@keyframes ftfan { from { transform: rotate(0deg) translateY(30px); opacity: 0; } }
.ft-logo { margin: 0; font-size: clamp(40px, 12vw, 72px); font-weight: 900; letter-spacing: 0.14em; background: linear-gradient(110deg, #9fb1dd, #fff 30%, var(--neutral) 50%, #fff 70%, #9fb1dd); background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: sheen 4s linear infinite; }
.ft-season { font-weight: 800; letter-spacing: 0.5em; color: var(--neutral); font-size: 13px; margin: 2px 0 14px; }
.ft-lede { color: var(--ink); margin: 0 0 10px; }
.ft-plan { text-align: left; display: inline-block; color: var(--dim); margin: 0 0 18px; padding-left: 22px; }
.ft-btn, .ft-pane .btns button.pri { font-size: 15px; }
.ft-wel .ft-btn { border: 0; border-radius: 10px; padding: 11px 30px; font-weight: 800; letter-spacing: 0.06em; background: linear-gradient(135deg, #3d7bff, #7a5cff); box-shadow: 0 0 24px rgba(122,92,255,0.5); }

/* 2. factions */
.ft-facs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 760px) { .ft-facs { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ft-fac { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 10px 12px; border-radius: 12px; border: 1px solid #24314f; background: linear-gradient(180deg, color-mix(in srgb, var(--fc) 16%, #0d1324), #0a0e1c 70%); animation: ftin 0.5s cubic-bezier(.2,.9,.3,1) both; animation-delay: calc(var(--i) * var(--stagger, 90ms)); transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
.ft-fac:hover { transform: translateY(-2px); }
.ft-fac.sel { border-color: var(--fc); box-shadow: 0 0 0 1px var(--fc), 0 0 28px color-mix(in srgb, var(--fc) 45%, transparent); transform: translateY(-4px); }
.ft-fac.dim { opacity: 0.55; }
.ft-fname { font-weight: 900; letter-spacing: 0.24em; color: var(--fc); font-size: 15px; }
.ft-fline { font-size: 12px; color: var(--ink); min-height: 3em; }
.ft-fmini { position: relative; width: min(130px, 34vw); aspect-ratio: 5 / 7; --cw: 100%; }
.ft-fmini .face { border-radius: 7px; }
.ft-fmeta { font-size: 11px; color: var(--dim); }

/* 3. the starter deck */
.ft-starter .ft-box { position: relative; display: flex; align-items: center; justify-content: center; gap: 18px; flex-wrap: wrap; margin: 6px 0 12px; }
.ft-deck { position: relative; width: 120px; height: 160px; border-radius: 10px; display: flex; flex-direction: column; justify-content: flex-end; padding: 12px; box-sizing: border-box; text-align: left;
  background: linear-gradient(160deg, color-mix(in srgb, var(--fc) 55%, #10141f), #0b0e18 75%); box-shadow: inset 0 0 0 2px var(--fc), 6px 8px 0 -2px #070a12, 6px 8px 0 0 color-mix(in srgb, var(--fc) 40%, #000), 0 18px 40px rgba(0,0,0,0.6);
  animation: ftdrop var(--drop, 520ms) cubic-bezier(.3,1.4,.5,1) both; }
.ft-deck span { font-weight: 900; letter-spacing: 0.18em; font-size: 15px; }
.ft-deck small { color: var(--dim); letter-spacing: 0.14em; font-size: 10px; }
.ft-deck b { position: absolute; top: 10px; right: 12px; font-size: 26px; color: var(--fc); }
@keyframes ftdrop { from { transform: translateY(-120px) rotate(-6deg); opacity: 0; } 70% { opacity: 1; } }
.ft-spread { position: relative; width: min(360px, 86vw); height: 236px; --cw: 120px; }
.ft-sc { position: absolute; left: 50%; bottom: 34px; width: 120px; height: 168px; margin-left: -60px; transform-origin: 50% 140%; animation: ftspread 0.6s cubic-bezier(.2,.9,.3,1) both; animation-delay: calc(var(--drop, 520ms) + var(--k) * var(--fan, 110ms)); transform: rotate(calc((var(--k) - 2) * 12deg)) translateY(calc(abs(var(--k) - 2) * 8px)); }
@keyframes ftspread { from { transform: rotate(0deg) translateY(40px) scale(0.8); opacity: 0; } }
.ft-sc .face { border-radius: 8px; }
.ft-packs { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 2px 0 6px; color: var(--neutral); font-weight: 800; letter-spacing: 0.08em; font-size: 13px; }
.ft-packs .mp3 { display: flex; gap: 6px; }
.ft-packs .mp3 i { display: block; width: 34px; height: 54px; border-radius: 4px; background: linear-gradient(160deg, #3e57d8, #241a6e); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.3), 0 4px 10px rgba(0,0,0,0.5); animation: ftslide 0.5s cubic-bezier(.2,.9,.3,1) both; animation-delay: calc(var(--packs, 650ms) + var(--k) * 90ms + var(--drop, 520ms)); }
@keyframes ftslide { from { transform: translateX(60px); opacity: 0; } }
.ft-held { color: var(--neutral) !important; }

/* 5. agents */
.ft-agents { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 700px) { .ft-agents { grid-template-columns: 1fr; } }
.ft-agent { display: grid; grid-template-columns: 64px 1fr; grid-template-rows: auto 1fr; column-gap: 12px; text-align: left; padding: 12px; border-radius: 12px; border: 1px solid #24314f; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px), #0a0f1f; font-family: ui-monospace, Menlo, Consolas, monospace; animation: ftin 0.5s cubic-bezier(.2,.9,.3,1) both; animation-delay: calc(var(--i) * var(--stagger, 90ms)); transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s; }
.ft-agent.sel { border-color: var(--neutral); box-shadow: 0 0 0 1px var(--neutral), 0 0 26px rgba(255,240,194,0.3); transform: translateY(-3px); }
.ft-agent.dim { opacity: 0.55; }
.ft-av { grid-row: 1 / 3; width: 64px; height: 64px; color: var(--neutral); }
.ft-av svg { width: 100%; height: 100%; }
.ft-aname { font-weight: 800; color: #fff; font-size: 14px; min-height: 1.4em; }
.ft-aname::after { content: "▌"; color: var(--neutral); animation: blink 0.8s steps(1) infinite; }
.ft-aname.typed::after { content: ""; }
.ft-apers { color: var(--dim); font-size: 12px; margin-top: 4px; }
.ft-later { color: #5b6b8f; font-size: 12px; margin: 12px 0 0; }

/* 6. signature cards */
.ft-sigs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start; }
.ft-sig { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 4px; border-radius: 12px; border: 1px solid transparent; background: none; animation: ftin 0.55s cubic-bezier(.2,.9,.3,1) both; animation-delay: calc(var(--i) * 140ms); transition: transform 0.25s, border-color 0.2s, opacity 0.2s; }
.ft-sigcard { position: relative; width: min(220px, 100%); aspect-ratio: 5 / 7; --cw: 100%; }
.ft-sigcard .face { border-radius: 9px; }
.ft-sig.sel { border-color: rgba(255,240,194,0.5); transform: translateY(-6px); }
.ft-sig.sel .ft-sigcard .face { box-shadow: 0 0 0 2px var(--neutral), 0 0 34px rgba(255,240,194,0.55); }
.ft-sig.dim { opacity: 0.5; }
.ft-sigcap { font-size: 12px; color: var(--dim); line-height: 1.35; }
.ft-sigcap b { color: var(--ink); }
.ft-sigcap small { color: #6f82a8; }
.ft-sig.fall { animation: ftfall 0.7s cubic-bezier(.5,0,.8,.4) forwards; pointer-events: none; }
@keyframes ftfall { to { transform: translateY(80px) rotate(var(--r, 6deg)); opacity: 0; } }
.ft-sig.taken .ft-sigcard { visibility: hidden; }
/* On a phone the three cards stack as rows, the card beside its text, so
   the text is readable without opening anything. */
@media (max-width: 640px) { .ft-sigs { grid-template-columns: 1fr; gap: 6px; } .ft-sig { flex-direction: row; align-items: center; text-align: left; gap: 12px; } .ft-sig .ft-sigcard { flex: none; width: 112px; } }

/* 7. the mint */
.mint { position: fixed; inset: 0; z-index: 48; display: grid; place-items: center; background: rgba(0,0,0,0); transition: background 0.5s; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.mint[hidden] { display: none; }
/* Opaque: the ward canvas blends only with this background (the overlay
   is its own stacking context), so anything see-through shows its edge. */
.mint.dark { background: #020206; }
.mint canvas.ward { position: absolute; left: 50%; top: 46%; width: min(150vw, 820px, 120dvh); height: min(150vw, 820px, 120dvh); transform: translate(-50%, -50%); pointer-events: none; mix-blend-mode: screen; filter: sepia(0.55) saturate(1.5) brightness(1.05); }
.mint .mterm { position: absolute; left: 16px; right: 16px; top: max(14px, env(safe-area-inset-top)); margin: 0 auto; max-width: 560px; font: 12px/1.55 ui-monospace, Menlo, Consolas, monospace; color: #c9ffd9; white-space: pre-wrap; text-align: left; text-shadow: 0 0 8px rgba(80,255,150,0.5); z-index: 3; padding: 6px 10px; border-radius: 6px; background: rgba(2,2,6,0.72); box-shadow: 0 0 24px 8px rgba(2,2,6,0.72); }
.mint .mterm .lab { color: #6f8f7a; }
.mint .mterm .val { color: #eaffef; }
.mint .mterm .bound .val { color: var(--neutral); text-shadow: 0 0 10px rgba(255,240,194,0.8); }
.mint .mcard { --mw: min(70vw, 300px, calc((100dvh - 250px) * 0.714)); --cw: var(--mw); position: relative; width: var(--mw); height: calc(var(--mw) * 1.4); z-index: 2; perspective: 1200px; margin-top: 30px; }
.mint .mcard .mtilt { position: absolute; inset: 0; transform-style: preserve-3d; }
.mint .mcard .flipper { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(.3,.7,.2,1); }
.mint .mcard .flipper.down { transform: rotateY(180deg); }
.mint .mcard .front { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.mint .mcard .back { transform: rotateY(180deg); }
.mint .mcard .face.forging { animation: ftforge var(--forge, 1300ms) cubic-bezier(.4,.1,.2,1) both; }
@keyframes ftforge { from { clip-path: circle(0% at 50% 33%); filter: brightness(3) saturate(0); } 55% { filter: brightness(1.6) saturate(0.6); } to { clip-path: circle(150% at 50% 33%); filter: none; } }
.mint .mcard .face.forging .art { animation: ftdevelop var(--forge, 1300ms) ease-out both; }
@keyframes ftdevelop { from { filter: blur(10px) brightness(2.4) saturate(0); } to { filter: none; } }
.mint .mcard .face .setno.lit { color: #fff; text-shadow: 0 0 10px var(--neutral); }
.mint .mstamp { position: absolute; left: 50%; bottom: 14%; z-index: 7; transform: translateX(-50%) rotate(-5deg); padding: 6px 16px; border-radius: 6px; font: 900 calc(var(--mw) * 0.1)/1 ui-monospace, Menlo, monospace; letter-spacing: 0.06em; color: #2b1a00; text-align: center; white-space: nowrap;
  background: linear-gradient(110deg, #b8862a, #fff8e0 45%, var(--neutral) 55%, #b8862a); box-shadow: 0 0 0 2px rgba(255,255,255,0.7), 0 10px 30px rgba(0,0,0,0.6), 0 0 40px rgba(255,240,194,0.7); animation: ftstamp var(--stamp, 520ms) cubic-bezier(.6,0,.4,1.4) both; }
.mint .mstamp small { display: block; font-size: 0.42em; letter-spacing: 0.3em; margin-top: 3px; }
.mint .mstamp.out { animation: ftlift 0.5s ease-in forwards; }
@keyframes ftstamp { from { transform: translateX(-50%) rotate(-14deg) scale(2.8); opacity: 0; } 60% { opacity: 1; } }
@keyframes ftlift { to { transform: translateX(-50%) translateY(40%) rotate(-5deg) scale(0.4); opacity: 0; } }
.mint.shake .mcard { animation: shake 0.32s linear; }
.mint .mcap { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 16px max(14px, env(safe-area-inset-bottom)); text-align: center; z-index: 3; color: var(--dim); font-size: 13px; background: linear-gradient(0deg, #020206 55%, rgba(2,2,6,0)); }
.mint .mcap .mt { font-weight: 900; letter-spacing: 0.3em; color: var(--neutral); font-size: 15px; text-shadow: 0 0 14px rgba(255,240,194,0.7); animation: ftin 0.6s both; }
.mint .mcap p { margin: 6px auto 10px; max-width: 520px; animation: ftin 0.6s 0.15s both; }
.mint .mcap b { color: var(--ink); }
.mint .mcap .btns { animation: ftin 0.6s 0.3s both; margin-top: 4px; }

/* 8. ready */
.ft-ready { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 22px; align-items: center; text-align: left; }
@media (max-width: 700px) { .ft-ready { grid-template-columns: 1fr; text-align: center; } }
.ft-ready .ft-agent { animation: none; cursor: default; }
.ft-ready .ft-sigcard { width: min(240px, 62vw); margin: 0 auto; cursor: zoom-in; }
.ft-hold { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 6px; }
.ft-hold li { text-align: left; display: flex; justify-content: space-between; gap: 14px; padding: 7px 12px; border-radius: 8px; background: #0d1324; border: 1px solid #1c2746; font-size: 13px; }
.ft-hold li b { color: var(--neutral); font-variant-numeric: tabular-nums; }
.ft-hold li.tot { border-color: rgba(255,240,194,0.35); }
@media (prefers-reduced-motion: reduce) { .ft-fac, .ft-agent, .ft-sig, .ft-deck, .ft-sc, .ft-packs .mp3 i, .ft-wel .ft-fan .fb { animation-duration: 0.01ms !important; animation-delay: 0ms !important; } }
`;

export const FIRST_TIME_RUNTIME_SOURCE = String.raw`
(function () {
  var P = window.PACK, S = P.S;
  var DATA = JSON.parse(document.getElementById('pack-data').textContent), FT = DATA.flow;
  var TM = JSON.parse(document.getElementById('pack-timings').textContent), MT = TM.mint, FL = TM.flow;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stage = document.getElementById('stage'), scene = document.getElementById('scene'), hint = document.getElementById('hint');
  var counter = document.getElementById('counter'), dim = document.getElementById('dim'), skipBtn = document.getElementById('skip');
  var badge = document.getElementById('ftbadge'), rail = document.getElementById('picker'), foot = document.getElementById('foot'), announce = document.getElementById('announce');
  var mint = document.getElementById('mint');
  var esc = P.esc, later = P.later, sfx = P.sfx;
  // The flow's state, for the page and the headless check: the screen, and
  // the owner's picks (faction, agent, signature card; -1 until made).
  var F = { step: 'welcome', f: -1, a: -1, s: -1, p: -1, mintLog: [] };
  window.__ft = F;
  stage.style.setProperty('--stagger', FL.stagger + 'ms');
  stage.style.setProperty('--drop', FL.boxDrop + 'ms');
  stage.style.setProperty('--fan', FL.fanOut + 'ms');
  stage.style.setProperty('--packs', FL.packsIn + 'ms');

  rail.className = 'rail'; rail.setAttribute('aria-label', 'Sign-up steps');
  rail.innerHTML = FT_RAIL.map(function (n) { return '<li>' + n + '</li>'; }).join('');
  function go(step) {
    F.step = step;
    var at = ftRailIndex(step);
    Array.prototype.forEach.call(rail.children, function (li, i) { li.className = i < at ? 'done' : i === at ? 'cur' : ''; });
    P.log('ft', { step: step, f: F.f, a: F.a, s: F.s, p: F.p });
  }
  // A flow screen in the stage, after whatever the pack opening left there.
  function screen(html) {
    P.clearTimers(); P.stopLayers(); S.onSummary = null;
    S.phase = 'flow'; dim.style.opacity = 0; counter.textContent = ''; hint.innerHTML = ''; skipBtn.hidden = true; badge.textContent = '';
    P.bulkControls(false);
    scene.innerHTML = html;
    var pane = scene.firstElementChild; if (pane) pane.scrollTop = 0;
  }
  function on(sel, fn) { var el = scene.querySelector(sel) || document.querySelector(sel); if (el) el.addEventListener('click', fn); return el; }
  function footer(t) { foot.innerHTML = t; }
  // A pick among plates: the tapped one is selected, the others dim, and
  // the confirm button names the pick.
  function picker(sel, label, set) {
    var ok = scene.querySelector('#ft-ok');
    scene.querySelectorAll(sel).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-i'));
        scene.querySelectorAll(sel).forEach(function (o) { o.classList.toggle('sel', o === b); o.classList.toggle('dim', o !== b); });
        set(i); ok.disabled = false; ok.textContent = label(i);
        sfx('flip', 'Neutral');
        P.log('ftPick', { step: F.step, i: i });
      });
    });
    return ok;
  }
  footer('Season 0 sign-up, played through the economy store (grantStarterCollection, openPack, startAgentDraft, pickDraftAgent, confirmAgentDraft) for every choice on this page, with fixed seeds. The page only shows what the store returned. Placeholder art until the art pass.');

  // ---------- 1. welcome ----------
  function welcome() {
    screen('<div class="ft-wel"><div class="ft-fan">' + [0, 1, 2, 3, 4].map(function (k) { return '<div class="fb" style="--k:' + k + '">' + P.backHtml() + '</div>'; }).join('') + '</div>' +
      '<h1 class="ft-logo">AI·TCG</h1><div class="ft-season">SEASON ZERO</div>' +
      '<p class="ft-lede">Your agent plays. You watch, collect and build its deck.</p>' +
      '<ol class="ft-plan"><li>Pick a starting faction</li><li>Open your 3 starter packs</li><li>Generate your agent and its one-of-a-kind card</li></ol><br>' +
      '<button class="ft-btn" id="ft-go">Begin</button></div>');
    go('welcome');
    on('#ft-go', factions);
  }

  // ---------- 2. a starting faction ----------
  function factions() {
    var plates = FT.factions.map(function (f, i) {
      var top = f.cards[0];
      return '<button class="ft-fac faction-' + f.faction + '" data-i="' + i + '" style="--i:' + i + '">' +
        '<span class="ft-fname">' + f.faction.toUpperCase() + '</span><span class="ft-fline">' + esc(f.line) + '</span>' +
        '<span class="ft-fmini">' + P.faceHtml(ftStarterCard(top), { settled: true }) + '</span>' +
        '<span class="ft-fmeta">' + f.deckSize + ' cards · ' + esc(top.face.rarity) + ': ' + esc(top.face.name) + '</span></button>';
    }).join('');
    screen('<div class="ft-pane"><h2>PICK A STARTING FACTION</h2><p class="sub">It decides your starter deck, once. Your agent can build in any faction later.</p>' +
      '<div class="ft-facs">' + plates + '</div><div class="btns"><button class="pri" id="ft-ok" disabled>Pick a faction</button></div></div>');
    go('faction');
    var ok = picker('.ft-fac', function (i) { return 'Start with ' + FT.factions[i].faction; }, function (i) { F.f = i; });
    ok.addEventListener('click', function () { if (F.f >= 0) starter(); });
  }

  // ---------- 3. the starter deck ----------
  function starter() {
    var f = FT.factions[F.f];
    var spread = f.cards.slice(0, 5).map(function (c, k) { return '<div class="ft-sc" style="--k:' + k + '">' + P.faceHtml(ftStarterCard(c), { settled: true }) + '</div>'; }).join('');
    screen('<div class="ft-pane ft-starter faction-' + f.faction + '"><h2>YOUR STARTER DECK</h2>' +
      '<p class="sub">' + f.deckSize + ' cards, ' + f.cards.length + ' different. Account-bound: yours to play, never to sell.</p>' +
      '<div class="ft-box"><div class="ft-deck"><b>' + f.deckSize + '</b><span>' + f.faction.toUpperCase() + '</span><small>STARTER · S0</small></div><div class="ft-spread">' + spread + '</div></div>' +
      '<div class="ft-packs"><span class="mp3">' + f.packs.map(function (_, k) { return '<i style="--k:' + k + '"></i>'; }).join('') + '</span><span>+ ' + f.packs.length + ' starter packs</span></div>' +
      '<div class="btns"><button class="pri" id="ft-open">Open pack 1</button></div></div>');
    go('starter');
    later(function () { sfx('stamp', 'Neutral'); }, FL.boxDrop * 0.6);
    f.cards.slice(0, 5).forEach(function (_, k) { later(function () { sfx('flip', f.faction); }, FL.boxDrop + k * FL.fanOut); });
    later(function () { sfx('tear', 'Neutral'); }, FL.boxDrop + FL.packsIn);
    announce.textContent = f.faction + ' starter deck: ' + f.deckSize + ' cards, and ' + f.packs.length + ' starter packs';
    on('#ft-open', function () { packs(0); });
  }

  // ---------- 4. the starter packs ----------
  function packs(i) {
    var f = FT.factions[F.f], n = f.packs.length;
    F.p = i;
    P.setPacks(f.packs);
    P.openPack(i);
    go('packs');
    badge.textContent = 'STARTER PACK ' + (i + 1) + ' OF ' + n;
    S.onSummary = function (btns) {
      var last = i >= n - 1;
      badge.textContent = '';
      if (last) btns.insertAdjacentHTML('beforebegin', '<p class="sub ft-held">You now hold ' + f.heldAfter.copies + ' cards: ' + f.deckSize + ' from the starter deck and ' + (f.heldAfter.copies - f.deckSize) + ' from your packs.</p>');
      btns.innerHTML = '<button class="pri" id="ft-next">' + (last ? 'Now, your agent' : 'Open pack ' + (i + 2) + ' of ' + n) + '</button>';
      btns.querySelector('#ft-next').addEventListener('click', function () { if (last) agents(); else packs(i + 1); });
      P.log('ftPackDone', { pack: i, last: last });
    };
  }

  // ---------- 5. generate your agent ----------
  function agents() {
    var cards = FT.agents.map(function (a, i) {
      return '<button class="ft-agent" data-i="' + i + '" style="--i:' + i + '"><span class="ft-av">' + a.avatar + '</span><span class="ft-aname" data-name="' + esc(a.name) + '"></span><span class="ft-apers">' + esc(a.persona) + '</span></button>';
    }).join('');
    screen('<div class="ft-pane"><h2>GENERATE YOUR AGENT</h2><p class="sub">Three agents, generated for you. Pick the one that plays for you. You can type it a new name later; the first rename is free.</p>' +
      '<div class="ft-agents">' + cards + '</div><p class="ft-later">Connect your own AI agent: after Season 0</p>' +
      '<div class="btns"><button class="pri" id="ft-ok" disabled>Pick an agent</button></div></div>');
    go('agents');
    // Each name types itself onto its dossier, one after another.
    scene.querySelectorAll('.ft-aname').forEach(function (el, k) {
      var name = el.getAttribute('data-name'), n = 0;
      later(function type() {
        if (n < name.length) { el.textContent = name.slice(0, ++n); if (n % 3 === 0) sfx('type', 'Neutral'); later(type, FL.namePerChar); return; }
        el.classList.add('typed');
      }, 250 + k * (FL.stagger * 4));
    });
    var ok = picker('.ft-agent', function (i) { return 'Pick ' + FT.agents[i].name; }, function (i) { F.a = i; });
    ok.addEventListener('click', function () { if (F.a >= 0) sigs(); });
  }

  // ---------- 6. its signature card ----------
  function sigs() {
    var a = FT.agents[F.a];
    var cards = a.signatures.map(function (c, i) {
      return '<button class="ft-sig" data-i="' + i + '" style="--i:' + i + ';--r:' + (i === 0 ? -7 : 7) + 'deg"><span class="ft-sigcard">' + P.faceHtml(ftCandidate(c), { settled: true }) + '</span>' +
        '<span class="ft-sigcap"><b>' + esc(c.name) + '</b><br>' + esc(ftConceptTail(c.name, c.concept)) + '<br><small>Passed the fairness test at ' + c.measured.seeds.toLocaleString('en-US') + ' games</small></span></button>';
    }).join('');
    screen('<div class="ft-pane"><h2>' + esc(a.name.toUpperCase()) + '’S SIGNATURE CARD</h2>' +
      '<p class="sub">Pick one. It is made for ' + esc(a.name) + ' alone: numbered, bound to it forever, never sold. It plays from its own zone in every match. Its art is drawn when it is made.</p>' +
      '<div class="ft-sigs">' + cards + '</div><div class="btns"><button class="pri" id="ft-ok" disabled>Pick a card</button></div></div>');
    go('sigs');
    var ok = picker('.ft-sig', function (i) { return 'Make ' + a.signatures[i].name; }, function (i) { F.s = i; });
    ok.addEventListener('click', function () { if (F.s >= 0) mintIt(); });
  }

  // ---------- 7. the mint ----------
  var mintLayers = [], wardRun = null;
  function mlog(kind, o) { var e = { kind: kind, t: Math.round(performance.now() - F.mintAt) }; for (var k in o) e[k] = o[k]; F.mintLog.push(e); P.log('mint', e); }
  function mintIt() {
    var a = FT.agents[F.a], c = a.signatures[F.s], m = a.minted[F.s];
    var lines = ftMintLines(FT.setCode || DATA.flow.setCode || 'S0', a, c, m);
    var plan = ftMintSchedule(lines, MT);
    if (REDUCE) plan = { lines: lines.map(function (_, i) { return 60 + i * 40; }), ward: 60, forge: 400, stamp: 650, settle: 800, done: 950, free: 1100 };
    F.mintAt = performance.now(); F.mintLog = []; F.plan = plan;
    go('mint');
    var tile = scene.querySelector('.ft-sig[data-i="' + F.s + '"]'), from = tile.querySelector('.ft-sigcard').getBoundingClientRect();
    scene.querySelectorAll('.ft-sig').forEach(function (el) { if (el !== tile) el.classList.add('fall'); });
    scene.querySelector('.btns').style.visibility = 'hidden';
    hint.innerHTML = ''; badge.textContent = '';
    mint.hidden = false; mint.className = 'mint';
    mint.innerHTML = '<canvas class="ward" id="mward" width="900" height="900"></canvas><div class="mterm" id="mterm" aria-hidden="true"></div>' +
      '<div class="mcard" id="mcard"><div class="mtilt"><div class="flipper" id="mflip"><div class="front">' + P.faceHtml(ftCandidate(c), { settled: true }) + '</div>' + P.backHtml() + '</div></div></div><div class="mcap" id="mcap"></div>';
    mint.style.setProperty('--forge', MT.forge + 'ms'); mint.style.setProperty('--stamp', MT.stamp + 'ms');
    var card = document.getElementById('mcard'), flip = document.getElementById('mflip'), term = document.getElementById('mterm');
    // From the tile to the middle (the card is laid out in the middle, then
    // started where the tile was).
    var to = card.getBoundingClientRect(), s0 = from.width / to.width;
    card.style.transition = 'none';
    card.style.transform = 'translate(' + (from.left + from.width / 2 - (to.left + to.width / 2)).toFixed(1) + 'px,' + (from.top + from.height / 2 - (to.top + to.height / 2)).toFixed(1) + 'px) scale(' + s0.toFixed(3) + ')';
    tile.classList.add('taken');
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      card.style.transition = 'transform ' + MT.gather + 'ms cubic-bezier(.3,.8,.25,1)';
      card.style.transform = '';
      flip.classList.add('down');
      mint.classList.add('dark');
    }); });
    sfx('flip', 'Neutral');
    mlog('gather', {});
    announce.textContent = 'Making ' + c.name + ' for ' + m.agentName;
    // The terminal: the label at once, the value typed.
    lines.forEach(function (ln, i) {
      later(function () {
        var row = document.createElement('div'); row.innerHTML = '<span class="lab">' + esc(ln[0]) + '</span>' + (ln[0].length < 12 ? ' '.repeat(12 - ln[0].length) : ' ');
        var val = document.createElement('span'); val.className = 'val'; row.appendChild(val); term.appendChild(row);
        // With reduced motion the value prints whole (the mint is a flash).
        var n = REDUCE ? ln[1].length - 1 : 0;
        (function type() {
          if (n < ln[1].length) { val.textContent = ln[1].slice(0, ++n); if (n % 4 === 1) sfx('type', 'Neutral'); setTimeout(type, MT.typePerChar); return; }
        })();
        mlog('line', { i: i, label: ln[0].trim(), value: ln[1] });
      }, plan.lines[i]);
    });
    later(function () { startWard(c.name, plan); sfx('ward', 'Neutral', 'spectacle'); mlog('ward', {}); }, plan.ward);
    later(function () { forge(card, flip, m); }, plan.forge);
    later(function () { stamp(card, m, term); }, plan.stamp);
    later(function () { settle(card, a, m); }, plan.settle);
    later(function () {
      F.step = 'minted';
      hint.innerHTML = '';
      mlog('free', {});
      P.log('ft', { step: 'minted', f: F.f, a: F.a, s: F.s });
    }, plan.free);
    card.addEventListener('pointerdown', function (e) {
      card.setPointerCapture && card.setPointerCapture(e.pointerId);
      P.pressTilt(e, { el: card.querySelector('.mtilt'), box: card, layers: function () { return mintLayers; }, swipe: false, what: 'signature', can: function () { return F.step === 'minted'; } });
    });
  }
  function forge(card, flip, m) {
    var front = flip.querySelector('.front');
    front.innerHTML = P.faceHtml(ftMinted(m), { settled: true });
    var face = front.querySelector('.face');
    face.classList.add('forging');
    flip.style.transition = 'transform ' + Math.round(MT.forge * 0.45) + 'ms cubic-bezier(.3,.7,.2,1)';
    flip.classList.remove('down');
    sfx('sparkle', 'Neutral', 'spectacle');
    burst(0.6);
    mlog('forge', { face: face.className, art: !!face.querySelector('.art svg') });
  }
  function stamp(card, m, term) {
    var plate = document.createElement('div'); plate.className = 'mstamp';
    plate.innerHTML = esc(m.collectorNumber) + '<small>1 OF 1</small>';
    card.appendChild(plate);
    later(function () {
      mint.classList.add('shake'); sfx('stamp', 'Neutral', 'spectacle'); burst(1);
      later(function () { mint.classList.remove('shake'); }, 340);
    }, MT.stamp * 0.55);
    var b = ftBoundLine(m), row = document.createElement('div'); row.className = 'bound';
    row.innerHTML = '<span class="lab">' + esc(b[0]) + '</span>' + ' '.repeat(12 - b[0].length) + '<span class="val">' + esc(b[1]) + '</span>';
    later(function () { term.appendChild(row); }, MT.stamp * 0.55);
    mlog('stamp', { number: m.collectorNumber });
  }
  function settle(card, a, m) {
    var plate = card.querySelector('.mstamp'); if (plate) { plate.classList.add('out'); later(function () { plate.remove(); }, 500); }
    var face = card.querySelector('.face');
    face.classList.remove('forging');
    var no = face.querySelector('.setno'); if (no) no.classList.add('lit');
    var l = FXGL.layer(face, 'signature', { amt: 0, seed: 21 });
    if (l) { l.ptr(0.5, 0.35); mintLayers.push(l); S.layers.push(l); var t0 = performance.now(); (function up() { var p = Math.min(1, (performance.now() - t0) / MT.settle); l.set(0.85 * p); if (p < 1) requestAnimationFrame(up); })(); }
    else face.classList.add('fx-css-signature');
    if (wardRun) wardRun.halo = performance.now();
    sfx('rise', 'Neutral', 'spectacle');
    document.getElementById('mcap').innerHTML = '<div class="mt">SIGNATURE · 1 OF 1</div><p>Made for <b>' + esc(m.agentName) + '</b> alone. Bound to it forever: no pack, shop or trade will ever hold another.</p><div class="btns"><button class="pri" id="ft-cont">Continue</button></div>';
    document.getElementById('ft-cont').addEventListener('click', function () { if (F.step === 'minted') ready(); });
    announce.textContent = m.face.name + ', signature card ' + m.collectorNumber + ', one of one, made for ' + m.agentName;
    mlog('settle', { layer: !!l });
  }
  // The card's ward, drawn by the fallback ward generator from the card's
  // name (the same ward its matches draw), its three rings spinning up
  // behind the card, then folding into a halo once the card has settled.
  var motes = [];
  function burst(k) {
    var n = Math.round(60 * k);
    for (var i = 0; i < n; i++) { var a = Math.random() * 6.283, v = 1.5 + Math.random() * 4 * k; motes.push({ x: 450, y: 450, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 }); }
  }
  function startWard(name, plan) {
    var cv = document.getElementById('mward'); if (!cv) return;
    var g = cv.getContext('2d'), sheet = null;
    try { sheet = fallbackWardSheet(fallbackWardPlan(name, 'Neutral')); } catch (e) { sheet = null; }
    var run = { t0: performance.now(), halo: 0 }; wardRun = run;
    var C = FW_CELL;
    function cell(k, rot, scale, alpha) {
      if (!sheet) return;
      g.save(); g.globalAlpha = alpha; g.translate(450, 450); g.rotate(rot); g.scale(scale, scale);
      g.drawImage(sheet, (k % 2) * C, ((k / 2) | 0) * C, C, C, -C / 2, -C / 2, C, C);
      g.restore();
    }
    (function frame(now) {
      if (wardRun !== run || mint.hidden) return;
      var t = (now - run.t0) / 1000, inP = Math.min(1, (now - run.t0) / (REDUCE ? 1 : MT.wardIn));
      var e = 1 - Math.pow(1 - inP, 3);
      var halo = run.halo ? Math.min(1, (now - run.halo) / MT.settle) : 0;
      var scale = (0.35 + 0.95 * e) * (1 - 0.3 * halo), alpha = e * (1 - 0.45 * halo);
      var spin = REDUCE ? 0 : 1;
      g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, 900, 900);
      g.globalCompositeOperation = 'lighter';
      // At most 1.3 x 1.2 x 512 px across, inside the 900 px canvas.
      cell(0, spin * t * (0.25 + 0.9 * (1 - inP)), scale * 1.2, alpha * 0.9);
      cell(1, -spin * t * (0.4 + 1.2 * (1 - inP)), scale * 0.95, alpha * 0.75);
      cell(2, spin * t * 0.6, scale * 0.7, alpha * (0.6 + 0.4 * Math.sin(t * 3) * (1 - halo)));
      for (var i = motes.length - 1; i >= 0; i--) {
        var p = motes[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.vy *= 0.985; p.life -= 0.012;
        if (p.life <= 0) { motes.splice(i, 1); continue; }
        g.fillStyle = 'rgba(255,240,194,' + p.life.toFixed(2) + ')'; g.fillRect(p.x, p.y, 3, 3);
      }
      requestAnimationFrame(frame);
    })(performance.now());
  }

  // ---------- 8. ready ----------
  function ready() {
    var f = FT.factions[F.f], a = FT.agents[F.a], m = a.minted[F.s];
    mint.hidden = true; mint.innerHTML = ''; wardRun = null; mintLayers.forEach(function (l) { l.stop(); }); mintLayers = [];
    screen('<div class="ft-pane"><h2>' + esc(m.agentName.toUpperCase()) + ' IS READY</h2><p class="sub">Connect it from the menu and it plays its first match with your ' + f.faction + ' starter deck and its signature card.</p>' +
      '<div class="ft-ready"><div><div class="ft-agent sel"><span class="ft-av">' + a.avatar + '</span><span class="ft-aname typed">' + esc(m.agentName) + '</span><span class="ft-apers">' + esc(m.persona) + '</span></div>' +
      '<ul class="ft-hold"><li><span>Starter deck (' + esc(f.faction) + ', account-bound)</span><b>' + f.deckSize + '</b></li><li><span>From your 3 starter packs</span><b>' + (f.heldAfter.copies - f.deckSize) + '</b></li><li><span>Signature card ' + esc(m.collectorNumber) + ' (bound to ' + esc(m.agentName) + ')</span><b>1</b></li><li class="tot"><span>Your collection</span><b>' + (f.heldAfter.copies + 1) + '</b></li></ul></div>' +
      '<div><div class="ft-sigcard" id="ft-view">' + P.faceHtml(ftMinted(m), { settled: true }).replace('class="face ', 'class="face fx-css-signature ') + '</div></div></div>' +
      '<div class="btns"><button id="ft-again">Start over</button></div></div>');
    go('ready');
    on('#ft-view', function () { P.openViewer(ftMinted(m)); });
    on('#ft-again', function () { F.f = F.a = F.s = F.p = -1; welcome(); });
  }

  // ?step=faction|agents|sigs|mint|ready (with f=, a=, s= as 0-based picks)
  // jumps straight there, for the checks and the stills.
  var q = function (k, d) { var r = new RegExp('[?&]' + k + '=([^&]+)').exec(location.search); return r ? decodeURIComponent(r[1]) : d; };
  var step = q('step', 'welcome');
  F.f = Number(q('f', -1)); F.a = Number(q('a', -1)); F.s = Number(q('s', -1));
  if (step === 'faction') factions();
  else if (step === 'starter' && F.f >= 0) starter();
  else if (step === 'packs' && F.f >= 0) packs(Number(q('p', 0)));
  else if (step === 'agents') agents();
  else if (step === 'sigs' && F.a >= 0) sigs();
  else if (step === 'mint' && F.a >= 0 && F.s >= 0) { sigs(); later(function () { mintIt(); }, 700); }
  else if (step === 'ready' && F.f >= 0 && F.a >= 0 && F.s >= 0) ready();
  else welcome();
  window.__ftApi = { welcome: welcome, factions: factions, starter: starter, packs: packs, agents: agents, sigs: sigs, mintIt: mintIt, ready: ready };
})();
`;

export const FIRST_TIME_WARD_SOURCE = `${FALLBACK_WARD_PURE_SOURCE}\n${FALLBACK_WARD_RUNTIME_SOURCE}`;
