// The v2 FX sheet (EFFECTS.md v2 slices 1-2 evidence). Part 1: every
// faction's sprite travel + impact, one row per faction, the three tiers side
// by side plus a hit on a player avatar. Part 2 (slice 2): every faction x
// every category (spell damage, heal, buff, debuff, removal ending in a
// spectacle kill), each from a source card to a target card, looping. It runs the replay page's own
// CANVAS_FX sources verbatim (same canvases, same tint cache, same recipes),
// so what it shows is exactly what a replay draws — just all five materials
// at once, which a replay (one strike at a time) can't show.
// Usage: npm run fx-sheet -w @ai-tcg/render  -> render/output/fx-sheet.html
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CANVAS_FX_PURE_SOURCE, CANVAS_FX_RUNTIME_SOURCE, fxAtlasDataUris } from "./canvasFx.js";
import { CSS } from "./renderHtml.js";

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
.row2 { position: relative; height: 170px; border-bottom: 1px solid var(--line); }
.row2 .lab { position: absolute; left: 8px; top: 8px; font-size: 0.9rem; font-weight: bold; }
.blk.gone { opacity: 0; transition: opacity 0.05s; }
</style>
</head>
<body>
<h1>AI·TCG // FX MATERIALS (EFFECTS.md v2 slices 1-2)</h1>
<p class="note">Attack travel + impact in each faction's sprite material, drawn by the replay's own canvas code. Columns: subtle / normal / spectacle hit on a card, then a normal hit on a player. Ground marks stay on the floor layer under the cards for a few seconds. Meaning is constant: every shot leaves the glowing card and lands on its target; only the material and size change.</p>
<div class="ctl"><button id="go">Replay volley</button> <span id="st"></span></div>
<div class="sheet" id="sheet" data-fx-camera></div>
<h1>CATEGORIES (slice 2): SPELL · HEAL · BUFF · DEBUFF · REMOVAL + KILL</h1>
<p class="note">Each category keeps one grammar in every faction (spell: shots leave the source and land on the target; heal: an orb carries it in, the light gathers; buff: rises; debuff: sinks, slate ring; removal: locks on, strikes, and the card shatters with hit-stop, colour split and camera punch). Only the material changes: Cortex lasers and scanlines, Aegis shells and plates, Swarm spores and tendrils, Null packets and glitch, Neutral lances and light. Neutral's debuff is Swarm's acid in gold. The background grid warps under every hit.</p>
<div class="ctl"><button id="go2">Replay categories</button></div>
<div class="sheet" id="sheet2"></div>
<script type="application/json" id="fx-atlases">${JSON.stringify(fxAtlasDataUris())}</script>
<script>
(function () {
  function arcBetween(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1, bend = Math.min(60, len * 0.14);
    return { a: a, b: b, c: { x: (a.x + b.x) / 2 - (dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend } };
  }
${CANVAS_FX_PURE_SOURCE}
${CANVAS_FX_RUNTIME_SOURCE}
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
