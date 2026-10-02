// The faction skin sheet (EFFECTS.md slice 5 evidence): every particle
// primitive, frozen mid-flight, one row per faction, drawn with the replay
// page's own CSS and the same FACTION_SKIN_SOURCE layouts the replays run.
// It exists so the five characters can be judged side by side, which a
// replay (one strike at a time, a few hundred ms each) doesn't allow.
// Usage: npm run skin-sheet -w @ai-tcg/render  -> render/output/skin-sheet.html
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FACTION_SKIN_SOURCE } from "./factionSkin.js";
import { CSS } from "./renderHtml.js";

export function renderSkinSheet(): string {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Faction skins — AI-TCG render</title>
<style>${CSS}
body { padding: 12px 16px; }
h1 { font-size: 0.95rem; letter-spacing: 0.1em; color: var(--ink-dim); font-weight: normal; margin: 4px 0 2px; }
.note { font-size: 0.72rem; color: var(--ink-dim); margin: 0 0 8px; max-width: 900px; }
.sheet { position: relative; width: 1180px; }
.row { position: relative; height: 200px; border-bottom: 1px solid var(--line); }
.row .lab { position: absolute; left: 8px; top: 8px; font-size: 0.9rem; font-weight: bold; }
.col { position: absolute; top: 10px; font-size: 0.66rem; color: var(--ink-dim); letter-spacing: 0.08em; }
.sheet .fx-layer { position: absolute; }
.sheet .fx-layer * { animation-play-state: paused !important; }
</style>
</head>
<body>
<h1>AI·TCG // FACTION SKINS (EFFECTS.md slice 5)</h1>
<p class="note">Every primitive frozen mid-flight at spectacle tier. Meaning (direction, landing point, tag colour) is the same in every row; only the particle character changes. Placeholder art, pending the art pass.</p>
<div class="sheet" id="sheet"><div class="fx-layer" id="layer"></div></div>
<script>
(function () {
${FACTION_SKIN_SOURCE}
  var sheet = document.getElementById('sheet'), layer = document.getElementById('layer');
  ['Cortex', 'Swarm', 'Aegis', 'Null', 'Neutral'].forEach(function (f, i) {
    var top = i * 200 + 30, tint = 'var(--' + f.toLowerCase() + ')', sk = skinOf(f);
    var row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = '<div class="lab" style="color:' + tint + '">' + f + '</div>' +
      '<div class="col" style="left:150px">BOLT (travel)</div><div class="col" style="left:455px">BUFF MOTES (rise)</div>' +
      '<div class="col" style="left:610px">PENALTY MOTES (sink)</div><div class="col" style="left:810px">CAST</div><div class="col" style="left:1030px">BURST</div>';
    sheet.insertBefore(row, layer);
    function add(el) { el.style.setProperty('--fx-tint', tint); layer.appendChild(el); return el; }
    var arc = { a: { x: 110, y: top + 160 }, c: { x: 200, y: top + 40 }, b: { x: 380, y: top + 60 } };
    boltLayout(f, 'spectacle', false, arc).forEach(function (p) {
      var n = p.path.length - 1, q = p.path[Math.round(Math.max(0, 0.6 - p.lag) * n)];
      var el = document.createElement('div');
      el.className = 'fx-bolt skin-' + sk.name + (p.role === 'head' ? '' : ' ' + p.role);
      el.style.setProperty('--bolt-size', p.size + 'px');
      var w = sk.bolt.stretch !== 1 && p.role === 'head' ? Math.round(p.size * sk.bolt.stretch) : p.size;
      el.style.width = w + 'px'; el.style.marginLeft = (-w / 2) + 'px';
      el.style.transform = 'translate(' + q.x + 'px,' + q.y + 'px) rotate(' + Math.round(q.rot) + 'deg) scale(' + q.scale + ')';
      add(el);
    });
    [['up', 440], ['down', 610]].forEach(function (d) {
      moteLayout(f, d[0], 'spectacle', 118, 158).forEach(function (m) {
        var q = m.path[Math.floor(m.path.length / 2)];
        var el = document.createElement('div');
        el.className = 'fx-mote ' + d[0] + ' skin-' + sk.name;
        el.style.setProperty('--mote-size', m.size + 'px');
        el.style.left = (d[1] + m.x) + 'px';
        el.style.top = (top + 10 + m.y * 0.8) + 'px';
        el.style.opacity = '1';
        el.style.transform = 'translate(' + q.dx + 'px,' + (q.dy * 0.5) + 'px)';
        add(el);
      });
    });
    function cast(cls, ray) {
      var el = document.createElement('div');
      el.className = cls + ' skin-' + sk.name;
      el.style.setProperty('--cast-ms', '1000ms');
      el.style.setProperty('--cast-scale', '2.1');
      if (ray !== undefined) el.style.setProperty('--ray-a', ray + 'deg');
      el.style.left = '830px'; el.style.top = (top + 90) + 'px';
      el.style.animationDelay = '-450ms';
      add(el);
    }
    cast('fx-cast-ring'); cast('fx-cast-sigil');
    castRayAngles(f, 'spectacle').forEach(function (a) { cast('fx-cast-ray', a); });
    var b = document.createElement('div');
    b.className = 'fx-burst skin-' + sk.name;
    b.style.setProperty('--burst-color', tint);
    b.style.left = '1050px'; b.style.top = (top + 90) + 'px';
    b.style.animationDelay = '-200ms';
    add(b);
  });
})();
</script>
</body>
</html>
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const out = resolve(dirname(fileURLToPath(import.meta.url)), "../output/skin-sheet.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderSkinSheet(), "utf8");
  console.log(`Wrote ${out}`);
}
