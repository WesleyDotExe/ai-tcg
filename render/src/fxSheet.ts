// The v2 FX sheet (EFFECTS.md v2 slices 1-2 evidence). Part 1: every
// faction's sprite travel + impact, one row per faction, the three tiers side
// by side plus a hit on a player avatar. Part 2 (slice 2): every faction x
// every category (spell damage, heal, buff, debuff, removal ending in a
// spectacle kill), each from a source card to a target card, looping. It runs the replay page's own
// CANVAS_FX sources verbatim (same canvases, same tint cache, same recipes),
// so what it shows is exactly what a replay draws — just all five materials
// at once, which a replay (one strike at a time) can't show. Part 3
// (slice 3): the sound audition grid. Part 4 (slice 4): the music desk.
// Part 5 (slice 7): the fallback ward generator's gallery, drawn by the
// replay's own FALLBACK_WARD sources.
// Usage: npm run fx-sheet -w @ai-tcg/render  -> render/output/fx-sheet.html
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CANVAS_FX_PURE_SOURCE, CANVAS_FX_RUNTIME_SOURCE, fxAtlasDataUris } from "./canvasFx.js";
import { SOUND_FX_PURE_SOURCE, SOUND_FX_RUNTIME_SOURCE } from "./soundFx.js";
import { MUSIC_PURE_SOURCE, MUSIC_RUNTIME_SOURCE } from "./musicFx.js";
import { FALLBACK_WARD_PURE_SOURCE, FALLBACK_WARD_RUNTIME_SOURCE } from "./fallbackWard.js";
import { CSS } from "./renderHtml.js";
import { generatedSeats } from "./generatedSignatures.js";

/** Neutral's gallery row: the generated signature cards the two committed
 * signature replays carry (seeds 5 and 2), the names a spectator meets. */
export function galleryNeutralNames(): string[] {
  return [5, 2].flatMap((seed) => generatedSeats(seed).map((s) => s.card.name)).slice(0, 3);
}

export function renderFxSheet(): string {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FX materials — AI-TCG render</title>
<style>${CSS}
body { padding: 12px 16px; }
h1 { font-size: 0.95rem; letter-spacing: 0.1em; color: var(--ink-dim); font-weight: normal; margin: 4px 0 2px; }
.note { font-size: 0.72rem; color: var(--ink-dim); margin: 0 0 8px; max-width: 980px; }
.sheet { position: relative; width: 1180px; z-index: 1; }
.row { position: relative; height: 150px; border-bottom: 1px solid var(--line); }
.row .lab { position: absolute; left: 8px; top: 8px; font-size: 0.9rem; font-weight: bold; }
.col { position: absolute; top: 8px; font-size: 0.62rem; color: var(--ink-dim); letter-spacing: 0.08em; }
.blk { position: absolute; width: 70px; height: 94px; border-radius: 6px; border: 1px solid var(--line);
  background: linear-gradient(160deg, var(--panel-2), var(--panel)); box-shadow: 0 0 10px rgba(0,0,0,.6); }
.blk.src { border-color: var(--fc); box-shadow: 0 0 12px var(--fc); }
.blk.face { width: 46px; height: 46px; border-radius: 8px; }
.ctl { margin: 8px 0; font-size: 0.75rem; color: var(--ink-dim); }
.ctl button, .ctl select, .snd button { background: var(--panel-2); border: 1px solid var(--line); color: var(--ink); border-radius: 4px; padding: 4px 9px; cursor: pointer; font-family: inherit; }
.snd { border-collapse: collapse; margin: 6px 0 40px; font-size: 0.72rem; }
.snd th, .snd td { padding: 3px; text-align: center; }
.snd td button { width: 46px; }
.row2 { position: relative; height: 170px; border-bottom: 1px solid var(--line); }
.row2 .lab { position: absolute; left: 8px; top: 8px; font-size: 0.9rem; font-weight: bold; }
.blk.gone { opacity: 0; transition: opacity 0.05s; }
.fwrow { display: flex; gap: 14px; align-items: flex-start; margin: 0 0 10px; }
.fwrow .lab { width: 80px; padding-top: 8px; font-size: 0.9rem; font-weight: bold; color: var(--fc); }
.fwcell { width: 200px; text-align: center; font-size: 0.66rem; color: var(--ink-dim); }
.fwcell canvas { display: block; width: 200px; height: 200px; background: #05060b; border: 1px solid var(--line); border-radius: 6px; }
.fwcell b { color: var(--ink); font-weight: normal; display: block; margin-top: 3px; }
</style>
</head>
<body>
<h1>AI·TCG // FX MATERIALS + SOUND + MUSIC + FALLBACK WARDS (EFFECTS.md v2 slices 1-4, 7)</h1>
<p class="note">Attack travel + impact in each faction's sprite material, drawn by the replay's own canvas code. Columns: subtle / normal / spectacle hit on a card, then a normal hit on a player. Ground marks stay on the floor layer under the cards for a few seconds. Meaning is constant: every shot leaves the glowing card and lands on its target; only the material and size change.</p>
<div class="ctl"><button id="go">Replay volley</button> <span id="st"></span></div>
<div class="sheet" id="sheet" data-fx-camera></div>
<h1>CATEGORIES (slice 2): SPELL · HEAL · BUFF · DEBUFF · REMOVAL + KILL</h1>
<p class="note">Each category keeps one grammar in every faction (spell: shots leave the source and land on the target; heal: an orb carries it in, the light gathers; buff: rises; debuff: sinks, slate ring; removal: locks on, strikes, and the card shatters with hit-stop, colour split and camera punch). Only the material changes: Cortex lasers and scanlines, Aegis shells and plates, Swarm spores and tendrils, Null packets and glitch, Neutral lances and light. Neutral's debuff is Swarm's acid in white-gold. The background grid warps under every hit.</p>
<div class="ctl"><button id="go2">Replay categories</button></div>
<div class="sheet" id="sheet2"></div>
<h1>SOUND (slice 3): FACTION VOICES</h1>
<p class="note">Every sound is synthesised in the browser (no files). Switch sound on, then click any cell to hear that event in that faction's voice, or play a whole row or column. Cortex: clean square-wave blips. Aegis: heavy metal clangs. Swarm: wet chitters and squelches. Null: broken pitch and glitch blips. Neutral: bells. The meaning stays the same in every voice: an impact always thumps, a heal always rises, a debuff always falls, a block always rings. The tier picks the volume.</p>
<div class="ctl"><span data-audio-ctl><button id="snd">Sound on</button> volume <input type="range" id="sndvol" min="0" max="100" value="80" aria-label="Effects volume"></span> tier <select id="sndtier"><option>subtle</option><option selected>normal</option><option>spectacle</option></select> <span id="sndst"></span></div>
<table class="snd" id="sndgrid"></table>
<h1>MUSIC (slice 4): ADAPTIVE, PROCEDURAL</h1>
<p class="note">A minor at 104 BPM (Am, F, C, G), generated live like the effects. It rests calm (pad and bass). Every hit, kill and Mythic arrival raises the intensity, bringing in the kick, then the arpeggio, then a driving bass and hats, then the snare and four on the floor; it settles back over a few seconds. The arpeggio plays in the acting side's faction voice. A Mythic in play on the acting side adds a bell every other bar and keeps the music a little higher. Effects dip it slightly (to 80%) and it never drops out on a kill. Pick a voice, then push the intensity with the buttons; the effects grid above pushes it too.</p>
<div class="ctl"><span data-audio-ctl><button id="mus">Music on</button> volume <input type="range" id="musvol" min="0" max="100" value="60" aria-label="Music volume"></span>
 voice <select id="musvoice"><option>Cortex</option><option>Aegis</option><option>Swarm</option><option>Null</option><option>Neutral</option></select>
 <label><input type="checkbox" id="musmythic"> Mythic in play</label>
 <button id="mushit">hit</button> <button id="musbig">big hit</button> <button id="muskill">kill</button> <button id="musmyth">Mythic arrives</button>
 <span id="musmeter"></span> <span id="musst"></span></div>
<h1>FALLBACK WARDS (slice 7): A WARD FOR EVERY MYTHIC WITHOUT ART</h1>
<p class="note">A Mythic with no ward art (an agent's signature card, or a new Mythic the art pipeline hasn't reached) gets a ward drawn by code from its name and faction: the same name always gives the same ward. Each ward below is that generator's sheet, tinted and spun as a replay spins it (outer, middle and core counter-rotating; sped up here). The faction is only the material: Cortex chips and straight traces, Aegis heavy plates, Swarm eggs and curves, Null torn rings, Neutral rune tablets and broken arcs. The first column of each faction row is the fallback its set Mythic would get without its art, for comparison; Neutral shows the two demo signature cards and a signature menu id.</p>
<div id="fwgal"></div>
<script type="application/json" id="fx-atlases">${JSON.stringify(fxAtlasDataUris())}</script>
<script>
(function () {
  function arcBetween(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1, bend = Math.min(60, len * 0.14);
    return { a: a, b: b, c: { x: (a.x + b.x) / 2 - (dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend } };
  }
${CANVAS_FX_PURE_SOURCE}
${CANVAS_FX_RUNTIME_SOURCE}
${SOUND_FX_PURE_SOURCE}
${SOUND_FX_RUNTIME_SOURCE}
${MUSIC_PURE_SOURCE}
${MUSIC_RUNTIME_SOURCE}
${FALLBACK_WARD_PURE_SOURCE}
${FALLBACK_WARD_RUNTIME_SOURCE}
  var FACTIONS = ['Cortex', 'Aegis', 'Swarm', 'Null', 'Neutral'];
  var COLS = [['subtle', 330, 'unit'], ['normal', 560, 'unit'], ['spectacle', 790, 'unit'], ['normal', 1040, 'player']];
  var sheet = document.getElementById('sheet');
  var rows = FACTIONS.map(function (f) {
    var row = document.createElement('div');
    row.className = 'row faction-' + f;
    row.innerHTML = '<div class="lab" style="color:var(--fc)">' + f + '</div>' +
      '<div class="blk src" style="left:120px;top:36px"></div>' +
      COLS.map(function (c) { return '<div class="col" style="left:' + (c[1] - 10) + 'px">' + c[0].toUpperCase() + (c[2] === 'player' ? ' / PLAYER' : '') + '</div>' +
        '<div class="blk' + (c[2] === 'player' ? ' face' : '') + '" style="left:' + c[1] + 'px;top:' + (c[2] === 'player' ? 60 : 36) + 'px"></div>'; }).join('');
    sheet.appendChild(row);
    return row;
  });
  var MS = { subtle: 190, normal: 240, spectacle: 320 };
  function volley() {
    rows.forEach(function (row, r) {
      var f = FACTIONS[r], blks = row.querySelectorAll('.blk'), src = blks[0].getBoundingClientRect();
      COLS.forEach(function (c, k) {
        var to = blks[k + 1].getBoundingClientRect(), d = k * 260 + r * 60;
        setTimeout(function () {
          CFX.travel(src, to, f, c[0], MS[c[0]], false);
          setTimeout(function () { CFX.impact(to, f, c[0], c[2]); }, MS[c[0]]);
        }, d);
      });
    });
  }
  // Part 2: categories. Source on the left of each pair, target on the
  // right; heal and buff go to an ally, the rest to an enemy.
  var CATS = [['spell', 300, 'normal'], ['heal', 520, 'normal'], ['buff', 740, 'normal'], ['debuff', 960, 'normal'], ['removal', 1150, 'spectacle']];
  var sheet2 = document.getElementById('sheet2');
  var rows2 = FACTIONS.map(function (f) {
    var row = document.createElement('div');
    row.className = 'row2 faction-' + f;
    row.innerHTML = '<div class="lab" style="color:var(--fc)">' + f + '</div>' +
      CATS.map(function (c) { return '<div class="col" style="left:' + (c[1] - 130) + 'px">' + c[0].toUpperCase() + ' · ' + fxVariant(f, c[0]) + '</div>' +
        '<div class="blk src" style="left:' + (c[1] - 140) + 'px;top:56px"></div>' +
        '<div class="blk" data-cat="' + c[0] + '" style="left:' + (c[1] - 40) + 'px;top:' + (c[0] === 'spell' || c[0] === 'removal' ? 26 : 56) + 'px"></div>'; }).join('');
    sheet2.appendChild(row);
    return row;
  });
  var EMS = { spell: 260, heal: 240, buff: 240, debuff: 240, removal: 420 };
  function categories() {
    rows2.forEach(function (row, r) {
      var f = FACTIONS[r], blks = row.querySelectorAll('.blk');
      CATS.forEach(function (c, k) {
        var src = blks[k * 2], tgt = blks[k * 2 + 1], d = k * 420 + r * 90;
        setTimeout(function () {
          tgt.classList.remove('gone');
          var from = src.getBoundingClientRect(), to = tgt.getBoundingClientRect();
          CFX.effect(c[0], from, to, f, c[2], EMS[c[0]], { targetKind: 'unit' });
          // A removal is lock + strike + shatter: the page calls kill() for
          // the death at the moment the strike lands.
          if (c[0] === 'removal') setTimeout(function () { CFX.kill(to, f, FACTIONS[(r + 1) % FACTIONS.length], 'spectacle'); tgt.classList.add('gone'); setTimeout(function () { tgt.classList.remove('gone'); }, 1600); }, EMS.removal);
        }, d);
      });
    });
  }
  window.__fxCategories = categories;
  // Part 3: the sound audition grid. Sound only plays while switched on.
  var grid = document.getElementById('sndgrid');
  grid.innerHTML = '<tr><th></th>' + SFX_KINDS.map(function (k) { return '<th><button data-col="' + k + '">' + k + '</button></th>'; }).join('') + '</tr>' +
    FACTIONS.map(function (f) { return '<tr class="faction-' + f + '"><th><button data-row="' + f + '" style="color:var(--fc)">' + f + '</button></th>' +
      SFX_KINDS.map(function (k) { return '<td><button data-f="' + f + '" data-k="' + k + '">\u25B6</button></td>'; }).join('') + '</tr>'; }).join('');
  function sndTier() { return document.getElementById('sndtier').value; }
  function hear(f, k, el) { SND.play(k, f, sndTier(), el ? el.getBoundingClientRect() : null, { targetKind: 'unit', victim: 'Aegis' }); }
  grid.onclick = function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.k) hear(b.dataset.f, b.dataset.k, b);
    else if (b.dataset.row) SFX_KINDS.forEach(function (k, i) { setTimeout(function () { hear(b.dataset.row, k, b); }, i * 650); });
    else if (b.dataset.col) FACTIONS.forEach(function (f, i) { setTimeout(function () { hear(f, b.dataset.col, b); }, i * 650); });
  };
  SND.mount(document.getElementById('snd'), document.getElementById('sndvol'));
  // Part 4: the music desk. The buttons go through SND.play like a replay's
  // events do, so they bump (and, with effects on, duck) exactly as a match.
  MUS.mount(document.getElementById('mus'), document.getElementById('musvol'), document.getElementById('musmeter'));
  function scene() { MUS.setScene(document.getElementById('musvoice').value, document.getElementById('musmythic').checked); }
  document.getElementById('musvoice').onchange = scene;
  document.getElementById('musmythic').onchange = scene;
  scene();
  function musFx(kind, tier) { var f = document.getElementById('musvoice').value; SND.play(kind, f, tier, null, { targetKind: 'unit', victim: 'Aegis' }); }
  document.getElementById('mushit').onclick = function () { musFx('impact', 'normal'); };
  document.getElementById('musbig').onclick = function () { musFx('impact', 'spectacle'); };
  document.getElementById('muskill').onclick = function () { musFx('kill', 'spectacle'); };
  document.getElementById('musmyth').onclick = function () { MUS.event('mythic', 'spectacle'); document.getElementById('musmythic').checked = true; scene(); };
  setInterval(function () { var m = MUS.stats(), L = m.layers; document.getElementById('musst').textContent = m.on ? 'I ' + m.I.toFixed(2) + ' · ' + ['pad', 'bass ' + L.bass, L.kick ? 'kick x' + L.kick : '', L.arp ? 'arp 1/' + L.arp : '', L.hats ? 'hats' : '', L.offHats ? 'off-hats' : '', L.snare ? 'snare' : ''].filter(Boolean).join(' + ') : ''; }, 300);
  setInterval(function () { var s = SND.stats(); document.getElementById('sndst').textContent = s.on ? 'sounds ' + s.played + ' · voices ' + s.voices + ' · alive ' + s.active : ''; }, 300);
  // Part 5: the fallback ward gallery. Each ward's sheet is tinted per cell
  // (the replay's own fxTintPixels) and its three layers counter-rotate at
  // the replay's radii (1, 0.74, 0.37).
  var FW_GALLERY = [
    ['Cortex', ['Quorum Arbiter', 'Unreleased Cortex Mythic I', 'Unreleased Cortex Mythic II']],
    ['Aegis', ['Prime Aegis', 'Unreleased Aegis Mythic I', 'Unreleased Aegis Mythic II']],
    ['Swarm', ['Hive Mother', 'Unreleased Swarm Mythic I', 'Unreleased Swarm Mythic II']],
    ['Null', ['Null Singularity', 'Unreleased Null Mythic I', 'Unreleased Null Mythic II']],
    ['Neutral', ${JSON.stringify(galleryNeutralNames())}]
  ];
  var FW_LAYERS = [{ i: 0, r: 1, spd: 0.2 }, { i: 1, r: 0.74, spd: -0.36 }, { i: 2, r: 0.37, spd: 0.56 }];
  var fwItems = [];
  var gal = document.getElementById('fwgal');
  FW_GALLERY.forEach(function (row) {
    var f = row[0], div = document.createElement('div');
    div.className = 'fwrow faction-' + f;
    div.innerHTML = '<div class="lab">' + f + '</div>';
    row[1].forEach(function (name) {
      var plan = fallbackWardPlan(name, f), sheet = fallbackWardSheet(plan), rgb = fxRgbOf(f), cells = [];
      for (var c = 0; c < 3; c++) {
        var cv = document.createElement('canvas'); cv.width = cv.height = 256;
        var g = cv.getContext('2d');
        g.drawImage(sheet, (c % 2) * FW_CELL, ((c / 2) | 0) * FW_CELL, FW_CELL, FW_CELL, 0, 0, 256, 256);
        var d = g.getImageData(0, 0, 256, 256); fxTintPixels(d.data, rgb); g.putImageData(d, 0, 0);
        cells.push(cv);
      }
      var cell = document.createElement('div'); cell.className = 'fwcell';
      var view = document.createElement('canvas'); view.width = view.height = 400;
      cell.appendChild(view);
      var cap = document.createElement('b'); cap.textContent = name; cell.appendChild(cap);
      var sub = document.createElement('span'); sub.textContent = plan.middle.mode + ' · ' + plan.outer.nodes + ' nodes · core ' + plan.core.n; cell.appendChild(sub);
      div.appendChild(cell);
      fwItems.push({ ctx: view.getContext('2d'), cells: cells, rot: [0, 0, 0] });
    });
    gal.appendChild(div);
  });
  var fwLast = 0;
  function fwTick(t) {
    var dt = fwLast ? Math.min(0.1, (t - fwLast) / 1000) : 0; fwLast = t;
    fwItems.forEach(function (it) {
      var g = it.ctx; g.clearRect(0, 0, 400, 400); g.globalCompositeOperation = 'lighter';
      FW_LAYERS.forEach(function (L, k) {
        it.rot[k] += L.spd * dt;
        var r = 190 * L.r;
        g.save(); g.translate(200, 200); g.rotate(it.rot[k]); g.drawImage(it.cells[L.i], -r, -r, 2 * r, 2 * r); g.restore();
      });
      g.globalCompositeOperation = 'source-over';
    });
    requestAnimationFrame(fwTick);
  }
  requestAnimationFrame(fwTick);
  window.__fwGallery = function () { return fwItems.length; };
  document.getElementById('go2').onclick = categories;
  document.getElementById('go').onclick = volley;
  window.__fxVolley = volley;
  (function wait() {
    if (!CFX.isReady()) { setTimeout(wait, 50); return; }
    volley(); setInterval(volley, 4200);
    setTimeout(function () { categories(); setInterval(categories, 5200); }, 1500);
  })();
  setInterval(function () { var s = CFX.stats(); document.getElementById('st').textContent = 'particles ' + s.particles + ' · peak ' + s.peak + ' · ' + s.fps + ' fps'; }, 500);
})();
</script>
</body>
</html>
`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = resolve(dirname(fileURLToPath(import.meta.url)), "../output/fx-sheet.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderFxSheet(), "utf8");
  console.log(`Wrote ${out}`);
}
