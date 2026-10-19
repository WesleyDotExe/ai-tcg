// The victory boast sheet (render slice: victory boasts, slices 1-2 evidence).
// Each boast on a full and an empty winning row, the winner below (seat 1)
// and above (seat 2), on a phone-width board (two lines of three), and the
// reduced-motion still. It runs the replay page's own sources verbatim
// (CANVAS_FX, SOUND, MUSIC, BOAST), so what it shows is what a replay plays;
// a replay only ever shows one boast, at its end, on one layout.
// Usage: npm run boast-sheet -w @ai-tcg/render  -> render/output/boast-sheet.html
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CANVAS_FX_PURE_SOURCE, CANVAS_FX_RUNTIME_SOURCE, fxAtlasDataUris } from "./canvasFx.js";
import { SOUND_FX_PURE_SOURCE, SOUND_FX_RUNTIME_SOURCE } from "./soundFx.js";
import { MUSIC_PURE_SOURCE, MUSIC_RUNTIME_SOURCE } from "./musicFx.js";
import { BOAST_PURE_SOURCE, BOAST_RUNTIME_SOURCE, BOAST_SPECS } from "./boastFx.js";
import { CSS } from "./renderHtml.js";

/** One scene: who won, where they sit, how full each row is, and the layout. */
export interface BoastScene {
  key: string;
  title: string;
  boast: string;
  winner: { name: string; faction: string; seat: "p1" | "p2"; cards: number };
  loser: { name: string; faction: string; cards: number };
  phone?: boolean;
  reduced?: boolean;
}

export function boastScenes(): BoastScene[] {
  const scenes: BoastScene[] = [];
  for (const spec of Object.values(BOAST_SPECS)) {
    const f = spec.faction;
    const foe = f === "Swarm" ? "Null" : "Swarm";
    scenes.push(
      { key: `${spec.id}-full`, title: `${spec.name}: full row, winner below`, boast: spec.id, winner: { name: "Bastion Relay", faction: f, seat: "p1", cards: 6 }, loser: { name: "Brood Signal", faction: foe, cards: 4 } },
      { key: `${spec.id}-empty`, title: `${spec.name}: empty row, winner below`, boast: spec.id, winner: { name: "Bastion Relay", faction: f, seat: "p1", cards: 0 }, loser: { name: "Brood Signal", faction: foe, cards: 5 } },
      { key: `${spec.id}-top`, title: `${spec.name}: winner above (seat 2), 3 cards`, boast: spec.id, winner: { name: "Coiljackal's Croupier", faction: f, seat: "p2", cards: 3 }, loser: { name: "Brood Signal", faction: foe, cards: 2 } },
      { key: `${spec.id}-phone`, title: `${spec.name}: phone width, two lines of three`, boast: spec.id, winner: { name: "Bastion Relay", faction: f, seat: "p1", cards: 4 }, loser: { name: "Brood Signal", faction: foe, cards: 3 }, phone: true },
      { key: `${spec.id}-reduced`, title: `${spec.name}: reduced motion (the still, about 1 s)`, boast: spec.id, winner: { name: "Bastion Relay", faction: f, seat: "p1", cards: 6 }, loser: { name: "Brood Signal", faction: foe, cards: 4 }, reduced: true },
    );
  }
  return scenes;
}


function sideHtml(key: string, who: "w" | "l", seat: "p1" | "p2", faction: string, cards: number): string {
  const slots = Array.from({ length: 6 }, (_, k) =>
    k < cards
      ? `<div class="slot"><div class="card sheetcard faction-${faction}"><div class="head"><span class="cost">${(k % 5) + 2}</span></div><div class="art"></div><div class="name">${faction} unit ${k + 1}</div></div></div>`
      : `<div class="slot empty"></div>`,
  ).join("");
  return `<div class="side" id="${key}-side-${who}" data-seat="${seat}"><div class="board-row faction-${faction}" id="${key}-row-${who}">${slots}</div></div>`;
}

function sceneHtml(s: BoastScene): string {
  const w = s.winner, l = s.loser;
  const top = w.seat === "p2" ? sideHtml(s.key, "w", "p2", w.faction, w.cards) : sideHtml(s.key, "l", "p2", l.faction, l.cards);
  const bottom = w.seat === "p2" ? sideHtml(s.key, "l", "p1", l.faction, l.cards) : sideHtml(s.key, "w", "p1", w.faction, w.cards);
  const hudW = `<div class="hud faction-${w.faction}" id="${s.key}-hud-w"><div class="name"><span style="color:var(--fc)">${w.name}</span><span class="faction-tag">${w.faction}</span></div><div class="meta">HP 4 / 30</div></div>`;
  const hudL = `<div class="hud faction-${l.faction}" id="${s.key}-hud-l"><div class="name"><span style="color:var(--fc)">${l.name}</span><span class="faction-tag">${l.faction}</span></div><div class="meta">HP 0 / 30</div></div>`;
  const huds = w.seat === "p1" ? hudW + hudL : hudL + hudW;
  return `<section class="scene${s.phone ? " phone" : ""}" id="${s.key}" data-boast="${s.boast}" data-seat="${w.seat}" data-who="${w.name}"${s.reduced ? ' data-reduced="1"' : ""}>
<h2>${s.title} <button class="go" data-scene="${s.key}">Play</button></h2>
<div class="scene-body"><div class="huds">${huds}</div>${top}<div class="midline"></div>${bottom}<div class="turnbar" id="${s.key}-result"></div></div>
</section>`;
}

export function renderBoastSheet(): string {
  const scenes = boastScenes();
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Victory boasts — AI-TCG render</title>
<style>${CSS}
body { padding: 12px 16px; }
h1 { font-size: 0.95rem; letter-spacing: 0.1em; color: var(--ink-dim); font-weight: normal; margin: 4px 0 2px; }
h2 { font-size: 0.8rem; letter-spacing: 0.08em; color: var(--ink); font-weight: normal; margin: 18px 0 6px; display: flex; gap: 10px; align-items: center; }
.note { font-size: 0.72rem; color: var(--ink-dim); margin: 0 0 8px; max-width: 980px; }
.ctl { margin: 8px 0; font-size: 0.75rem; color: var(--ink-dim); }
.ctl button, h2 button { background: var(--panel-2); border: 1px solid var(--line); color: var(--ink); border-radius: 4px; padding: 3px 9px; cursor: pointer; font-family: inherit; }
.scene { position: relative; z-index: 1; width: 860px; max-width: 100%; }
.scene.phone { width: 380px; }
.scene-body { border: 1px solid var(--line); border-radius: 8px; padding: 8px; background: rgba(8,10,18,0.6); }
.huds { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 6px; }
.scene.phone .huds { grid-template-columns: 1fr; }
.midline { height: 14px; }
.scene.phone .board-row { zoom: 0.72; max-width: 420px; margin: 0 auto; }
.sheetcard { background: linear-gradient(160deg, color-mix(in srgb, var(--fc) 70%, #fff 0%), color-mix(in srgb, var(--fc) 35%, #000)); }
.sheetcard .art { background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.25), rgba(0,0,0,0) 60%); }
.scene .turnbar { margin-top: 6px; min-height: 1.4em; }
</style>
</head>
<body>
<h1>AI·TCG // VICTORY BOASTS (render slices 1-2: the victory grammar and the four starter boasts)</h1>
<p class="note">A victory boast plays when an agent wins, after the lethal beat and before the result line. Every boast follows one grammar: it rises and radiates from the winner's side of the board and ends on the winner's name. Nothing moves toward the loser or touches the loser's cards or panel; the loser's side dims to 70% and stays still. Each faction's free starter boast, about 3 s each. <b>Shield Slam</b> (Aegis): hex plates slam up out of every slot into a wall, centre first; the wall locks as one; the bottom plates lift into a hex crest and the rest rise away; the crest locks with the sting. <b>Hive Burst</b> (Swarm): an egg sac swells in every slot, centre first, then each bursts, throwing spores straight up; the spores climb into a zig-zag column and a last spore crowns it with the sting. <b>Void Collapse</b> (Null): a dark star opens over the row and pulls motes of light out of every slot (the side goes dark); it collapses to a point and holds a silent beat, then blooms with the sting, tearing glitch bars out sideways; four bars slide in and frame the name. <b>Data Cascade</b> (Cortex): columns of pixels stream up out of every slot (an upload; down is the debuff's direction); the row flashes as one; each column's lead pixel climbs and snaps into a wireframe block, stacked three then two; the top block locks with the sting. A tap, Escape or Skip ends it. Reduced motion shows the final pose, still, with the name, for about 1 s. The result line under each scene lands as the boast ends.</p>
<div class="ctl"><span data-audio-ctl><button id="snd">Sound on</button> <input type="range" id="sndvol" min="0" max="100" value="80" aria-label="Effects volume"> <button id="mus">Music on</button> <input type="range" id="musvol" min="0" max="100" value="60" aria-label="Music volume"> <span id="musmeter"></span></span>
 <button id="all">Play all in turn</button> <span id="st"></span></div>
${scenes.map(sceneHtml).join("\n")}
<script type="application/json" id="fx-atlases">${JSON.stringify(fxAtlasDataUris())}</script>
<script>
(function () {
${CANVAS_FX_PURE_SOURCE}
${CANVAS_FX_RUNTIME_SOURCE}
${SOUND_FX_PURE_SOURCE}
${SOUND_FX_RUNTIME_SOURCE}
${MUSIC_PURE_SOURCE}
${MUSIC_RUNTIME_SOURCE}
${BOAST_PURE_SOURCE}
${BOAST_RUNTIME_SOURCE}
  window.__boast = BOAST; // read by the browser checks (progress/render/evidence/boast-check.mjs)
  SND.mount(document.getElementById('snd'), document.getElementById('sndvol'));
  MUS.mount(document.getElementById('mus'), document.getElementById('musvol'), document.getElementById('musmeter'));
  var st = document.getElementById('st');
  function playScene(key, done) {
    var sc = document.getElementById(key);
    var res = document.getElementById(key + '-result');
    res.innerHTML = '';
    var els = {
      band: document.getElementById(key + '-side-w'), panel: document.getElementById(key + '-hud-w'),
      row: document.getElementById(key + '-row-w'),
      loser: [document.getElementById(key + '-side-l'), document.getElementById(key + '-hud-l')],
      dim: [document.getElementById(key + '-side-l'), document.getElementById(key + '-hud-l')]
    };
    var plan = BOAST.play(sc.getAttribute('data-boast'), els, {
      who: sc.getAttribute('data-who'), seed: 7, reduced: sc.hasAttribute('data-reduced') ? true : undefined,
      onEnd: function (reason) {
        res.innerHTML = '<span class="win land">GAME OVER: ' + sc.getAttribute('data-who') + ' WINS</span>';
        st.textContent = key + ': ' + reason + ' at ' + (BOAST.stats().last || {}).t + ' ms';
        if (done) setTimeout(done, 900);
      }
    });
    var s = BOAST.stats();
    st.textContent = key + ': playing' + (s.still ? ' (still)' : '') + (s.problem ? ' — grammar problem: ' + s.problem : '');
    return plan;
  }
  window.playBoastScene = playScene;
  document.querySelectorAll('button.go').forEach(function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); setTimeout(function () { playScene(b.getAttribute('data-scene')); }, 0); });
  });
  document.getElementById('all').addEventListener('click', function () {
    var keys = Array.prototype.map.call(document.querySelectorAll('.scene'), function (s) { return s.id; });
    (function next(k) { if (k < keys.length) { document.getElementById(keys[k]).scrollIntoView({ block: 'center' }); setTimeout(function () { playScene(keys[k], function () { next(k + 1); }); }, 350); } })(0);
  });
})();
</script>
</body>
</html>
`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = resolve(here, "../output/boast-sheet.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderBoastSheet(), "utf8");
  console.log(`Wrote ${out}`);
}
