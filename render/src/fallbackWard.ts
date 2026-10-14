// EFFECTS.md v2, slice 7 — the fallback ward generator.
//
// A Mythic with no ward art yet (a newly designed Mythic the mythic-wards
// action hasn't reached, or an agent's signature card: a Neutral Mythic with
// a generated name, never in mythics.json) still gets a one-of-a-kind ward.
// It is drawn by code, seeded from the card's name and faction, so the same
// name always gives the same ward and two names almost never share one
// (lab: genWardAtlas()).
//
// Two halves, the same single-source rule as the other FX modules:
//   - FALLBACK_WARD_PURE_SOURCE: the hash, the seeded generator and
//     fallbackWardPlan(name, faction), which makes EVERY random choice up
//     front and returns it as plain data (ring ticks, node count and shape,
//     glyph strokes, the middle layer's pattern, the core's polygons, the
//     ornament). Node runs exactly this text in the tests, so determinism,
//     variety and the symbol rules are checked without a browser.
//   - FALLBACK_WARD_RUNTIME_SOURCE: fallbackWardSheet(plan) draws that plan
//     into a 2x2 greyscale-on-black sheet in the same layout as the
//     Replicate sheets (outer / middle / core / ornament), so WARDS tints,
//     spins, flares and shatters it exactly like real art.
//
// The faction is material, never meaning (EFFECTS.md axis 2): Cortex chips
// and straight traces, Aegis heavy plates and thick lines, Swarm eggs and
// curves, Null broken rings with cuts, Neutral rune rings and light arcs.
// An unknown faction draws in the Neutral kit.
//
// Symbol rules (mythics.json _howToAddAMythic, which the Replicate prompts
// follow too): no stars, hexagrams, pentagrams, crosses, eyes or crescents.
// The plan only uses regular polygons nested at ONE orientation (two
// triangles or squares turned against each other would read as a star), no
// triangle in the core or the ornament, and the tests hold it to that.
//
// It must never block a card from rendering: the runtime wraps generation in
// try/catch and a Mythic whose ward fails simply shows no ward.

export const FALLBACK_WARD_PURE_SOURCE = String.raw`
  // One cell of the 2x2 sheet, in px (the lab's WT). The drawing space is
  // centred, radius 236 at the cell's edge.
  var FW_CELL = 512;
  // Material per faction. node: the outer ring's node shape. thick: line
  // weight. cuts: torn gaps cut out of the rings (Null). glyph: how the
  // small marks inside the outer ring are stroked. middles: the patterns
  // the middle layer may take.
  var FW_KITS = {
    Cortex: { node: 'chip', thick: 1, cuts: false, glyph: 'line', middles: ['spokes', 'polys', 'orbits'] },
    Aegis: { node: 'plate', thick: 1.8, cuts: false, glyph: 'line', middles: ['polys', 'spokes', 'plates'] },
    Swarm: { node: 'egg', thick: 1, cuts: false, glyph: 'curve', middles: ['curl', 'spokes', 'orbits'] },
    Null: { node: 'broken', thick: 1, cuts: true, glyph: 'line', middles: ['orbits', 'curl', 'polys'] },
    Neutral: { node: 'rune', thick: 1.2, cuts: false, glyph: 'arc', middles: ['runes', 'orbits', 'polys'] }
  };
  function fwKitName(faction) { return FW_KITS[faction] ? faction : 'Neutral'; }
  // FNV-1a, then mulberry32 (lab: hashStr, rng).
  function fwHash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function fwRng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function fwRound(x) { return Math.round(x * 100) / 100; }
  // Every choice the drawing makes, as data. Same (name, faction) in, same
  // plan out, on any machine.
  function fallbackWardPlan(name, faction) {
    var kitName = fwKitName(faction), kit = FW_KITS[kitName];
    var seed = fwHash(kitName + ':' + String(name));
    var R = fwRng(seed);
    function ri(a, b) { return a + Math.floor(R() * (b - a + 1)); }
    function pk(a) { return a[Math.floor(R() * a.length)]; }
    function cuts(n, minR, spanR, len) {
      var out = [];
      for (var i = 0; i < n; i++) out.push({ a: fwRound(R() * 6.283), r: fwRound(minR + R() * spanR), len: len });
      return out;
    }
    // Outer ring: a double rail with ticks, evenly spaced nodes, and small
    // stroked glyphs just inside it.
    var glyphCount = pk([12, 16, 24]), glyphs = [];
    for (var i = 0; i < glyphCount; i++) {
      var k = ri(2, 4), segs = [];
      for (var j = 0; j < k; j++) segs.push([fwRound((R() - 0.5) * 16), fwRound((R() - 0.5) * 16), fwRound((R() - 0.5) * 16), fwRound((R() - 0.5) * 16)]);
      glyphs.push(segs);
    }
    var outer = { ticks: pk([48, 60, 72, 96]), nodes: pk([6, 8, 10, 12]), glyphs: glyphs, cuts: kit.cuts ? cuts(5, 180, 0, 70) : [] };
    // Middle: one of the kit's patterns.
    var mode = pk(kit.middles), middle = { mode: mode };
    if (mode === 'spokes') {
      middle.n = ri(16, 40); middle.dots = [];
      for (i = 0; i < middle.n; i += 2) middle.dots.push(fwRound(120 + R() * 90));
    } else if (mode === 'polys') {
      middle.n = pk([4, 5, 6, 7, 8, 9, 10, 12]); middle.k = ri(3, 6); middle.rot = fwRound(R() * 6.283);
    } else if (mode === 'plates') {
      middle.n = ri(6, 10);
    } else if (mode === 'curl') {
      middle.n = ri(3, 7);
    } else if (mode === 'runes') {
      // Concentric rings broken into arcs with a notch at each break.
      middle.rings = [];
      var rings = ri(3, 5);
      for (i = 0; i < rings; i++) middle.rings.push({ r: 236 - i * 34, parts: ri(3, 9), gap: fwRound(0.12 + R() * 0.2), off: fwRound(R() * 6.283) });
    } else {
      middle.dashes = [];
      var rk = ri(4, 7);
      for (i = 0; i < rk; i++) middle.dashes.push(R() < 0.5 ? [2, 8] : [18, 10]);
    }
    middle.cuts = kit.cuts ? cuts(6, 60, 120, 80) : [];
    // Core: nested polygons at one orientation, two rings, a bright centre.
    var core = { n: pk([4, 5, 6, 7, 8]), rot: fwRound(R() * 6.283) };
    // Ornament: one filled polygon and a disc (seats, crests, larvae and
    // pointers in the behaviours are drawn from this cell).
    var ornament = { n: pk([4, 5, 6]) };
    return { name: String(name), faction: kitName, seed: seed, kit: kit, outer: outer, middle: middle, core: core, ornament: ornament };
  }
  // The coarse look of a plan: what a viewer can actually tell apart at a
  // glance (counts and patterns, not the exact glyph strokes).
  function fallbackWardLook(plan) {
    var m = plan.middle;
    return [plan.faction, plan.outer.ticks, plan.outer.nodes, plan.outer.glyphs.length, m.mode, m.n || 0, m.k || 0,
      (m.rings || m.dashes || []).length, plan.core.n, plan.ornament.n].join('|');
  }
  // Which Mythics in this replay need a fallback: every Mythic unit that
  // reaches the board and has no ward sheet. atlases is the page's
  // ward-data atlases (name -> data URI).
  function fallbackWardsNeeded(frames, atlases) {
    var seen = {}, out = [];
    (frames || []).forEach(function (f) {
      ['p1', 'p2'].forEach(function (pid) {
        f.players[pid].board.forEach(function (u) {
          if (u.rarity !== 'Mythic' || (atlases && atlases[u.name]) || seen[u.name]) return;
          seen[u.name] = true;
          out.push({ name: u.name, faction: u.faction });
        });
      });
    });
    return out;
  }
`;

export const FALLBACK_WARD_RUNTIME_SOURCE = String.raw`
  // Draws plan into a 2x2 greyscale-on-black sheet (FW_CELL px per cell),
  // the same layout as the Replicate sheets. Returns a canvas.
  function fallbackWardSheet(plan) {
    var WT = FW_CELL, kit = plan.kit, fk = plan.faction, thick = kit.thick;
    var cv = document.createElement('canvas'); cv.width = cv.height = WT * 2;
    var g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, WT * 2, WT * 2);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    var C = WT / 2;
    function at(cell, fn) { g.save(); g.translate((cell % 2) * WT + C, ((cell / 2) | 0) * WT + C); fn(); g.restore(); }
    function circle(r, w) { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.stroke(); }
    function poly(n, r, rot, w) {
      g.lineWidth = w; g.beginPath();
      for (var i = 0; i <= n; i++) { var a = rot + i / n * 6.283; if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.stroke();
    }
    function cut(list, h) {
      if (!list.length) return;
      g.globalCompositeOperation = 'destination-out';
      list.forEach(function (c) { g.save(); g.rotate(c.a); g.fillRect(c.r, -h / 2, c.len, h); g.restore(); });
      g.globalCompositeOperation = 'source-over';
    }
    function node() {
      if (kit.node === 'chip') { g.lineWidth = 2; g.strokeRect(-9, -9, 18, 18); g.fillRect(-3, -3, 6, 6); }
      else if (kit.node === 'plate') { g.lineWidth = 3; g.beginPath(); g.moveTo(-12, -16); g.lineTo(12, -12); g.lineTo(12, 12); g.lineTo(-12, 16); g.closePath(); g.stroke(); }
      else if (kit.node === 'egg') { g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 11, 15, 0, 0, 6.283); g.stroke(); g.beginPath(); g.arc(0, 0, 4, 0, 6.283); g.fill(); }
      // A rune tablet: an upright slab with one bar across it.
      else if (kit.node === 'rune') { g.lineWidth = 2; g.strokeRect(-7, -11, 14, 22); g.fillRect(-4, -2, 8, 4); }
      else { g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 11, 0.4, 5.6); g.stroke(); g.fillRect(-2, -2, 4, 4); }
    }
    g.shadowBlur = 10;
    // Cell 0: the outer ring.
    at(0, function () {
      var o = plan.outer;
      circle(236, 3 * thick); circle(212, 1.5 * thick);
      g.lineWidth = 1.2;
      for (var i = 0; i < o.ticks; i++) {
        var a = i / o.ticks * 6.283, l = i % 6 ? 6 : 14;
        g.beginPath(); g.moveTo(Math.cos(a) * 212, Math.sin(a) * 212); g.lineTo(Math.cos(a) * (212 - l), Math.sin(a) * (212 - l)); g.stroke();
      }
      for (i = 0; i < o.nodes; i++) { g.save(); g.rotate(i / o.nodes * 6.283); g.translate(224, 0); node(); g.restore(); }
      o.glyphs.forEach(function (segs, i) {
        var a = (i + 0.5) / o.glyphs.length * 6.283;
        g.save(); g.translate(Math.cos(a) * 190, Math.sin(a) * 190); g.rotate(a + Math.PI / 2); g.lineWidth = 2; g.beginPath();
        segs.forEach(function (s) {
          g.moveTo(s[0], s[1]);
          if (kit.glyph === 'curve') g.quadraticCurveTo(0, 0, s[2], s[3]);
          else if (kit.glyph === 'arc') g.arcTo(s[0], s[3], s[2], s[3], 5);
          else g.lineTo(s[2], s[3]);
        });
        g.stroke(); g.restore();
      });
      cut(o.cuts, 12);
    });
    // Cell 1: the middle layer.
    at(1, function () {
      var m = plan.middle, i;
      if (m.mode === 'spokes') {
        g.lineWidth = 1.3;
        for (i = 0; i < m.n; i++) {
          var a = i / m.n * 6.283;
          g.beginPath(); g.moveTo(Math.cos(a) * 70, Math.sin(a) * 70); g.lineTo(Math.cos(a) * 236, Math.sin(a) * 236); g.stroke();
          if (i % 2 === 0) { var d = m.dots[i / 2]; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 3, 0, 6.283); g.fill(); }
        }
        circle(236, 1.5);
      } else if (m.mode === 'polys') {
        for (i = 0; i < m.k; i++) poly(m.n, 236 - i * 28, m.rot, 1.6 * thick);
        circle(110, 1.2);
      } else if (m.mode === 'plates') {
        for (i = 0; i < m.n; i++) {
          g.save(); g.rotate(i / m.n * 6.283); g.lineWidth = 3; g.strokeRect(150, -30, 70, 60);
          g.beginPath(); g.moveTo(150, 0); g.lineTo(110, 0); g.stroke(); g.restore();
        }
        circle(236, 2);
      } else if (m.mode === 'curl') {
        g.lineWidth = 2.2;
        for (i = 0; i < m.n; i++) {
          g.save(); g.rotate(i / m.n * 6.283);
          g.beginPath(); g.moveTo(80, 0); g.bezierCurveTo(160, -60, 230, -10, 210, 70); g.stroke();
          g.beginPath(); g.moveTo(120, -20); g.quadraticCurveTo(150, -80, 185, -70); g.stroke();
          g.restore();
        }
        circle(236, 1.2);
      } else if (m.mode === 'runes') {
        m.rings.forEach(function (ring, k) {
          var step = 6.283 / ring.parts;
          g.lineWidth = (k === 0 ? 2.2 : 1.4) * thick;
          for (var p = 0; p < ring.parts; p++) {
            var a0 = ring.off + p * step, a1 = a0 + step * (1 - ring.gap);
            g.beginPath(); g.arc(0, 0, ring.r, a0, a1); g.stroke();
            g.beginPath(); g.moveTo(Math.cos(a1) * (ring.r - 7), Math.sin(a1) * (ring.r - 7)); g.lineTo(Math.cos(a1) * (ring.r + 7), Math.sin(a1) * (ring.r + 7)); g.stroke();
          }
        });
      } else {
        m.dashes.forEach(function (dash, k) { g.setLineDash(dash); circle(236 - k * 26, 1.4); });
        g.setLineDash([]);
      }
      cut(m.cuts, 10);
    });
    // Cell 2: the core.
    at(2, function () {
      var c = plan.core;
      circle(236, 2.5); poly(c.n, 200, c.rot, 2.5 * thick); poly(c.n, 150, c.rot, 1.5); circle(90, 2); circle(60, 1.2);
      g.shadowBlur = 0;
      var gr = g.createRadialGradient(0, 0, 0, 0, 0, 70);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 70, 0, 6.283); g.fill();
    });
    // Cell 3: the ornament.
    at(3, function () {
      g.fillStyle = '#fff'; poly(plan.ornament.n, 120, -Math.PI / 2, 10);
      g.beginPath(); g.arc(0, 0, 40, 0, 6.283); g.fill();
    });
    return cv;
  }
`;

const pure = new Function(
  `${FALLBACK_WARD_PURE_SOURCE}; return { FW_CELL: FW_CELL, FW_KITS: FW_KITS, fwKitName: fwKitName, fwHash: fwHash, fallbackWardPlan: fallbackWardPlan, fallbackWardLook: fallbackWardLook, fallbackWardsNeeded: fallbackWardsNeeded };`,
)() as {
  FW_CELL: number;
  FW_KITS: Record<string, FallbackKit>;
  fwKitName: (faction: string) => string;
  fwHash: (s: string) => number;
  fallbackWardPlan: (name: string, faction: string) => FallbackWardPlan;
  fallbackWardLook: (plan: FallbackWardPlan) => string;
  fallbackWardsNeeded: (frames: FallbackFrame[], atlases: Record<string, string>) => { name: string; faction: string }[];
};

export interface FallbackKit { node: string; thick: number; cuts: boolean; glyph: string; middles: string[] }
interface Cut { a: number; r: number; len: number }
export interface FallbackWardPlan {
  name: string;
  faction: string;
  seed: number;
  kit: FallbackKit;
  outer: { ticks: number; nodes: number; glyphs: number[][][]; cuts: Cut[] };
  middle: { mode: string; n?: number; k?: number; rot?: number; dots?: number[]; rings?: { r: number; parts: number; gap: number; off: number }[]; dashes?: number[][]; cuts: Cut[] };
  core: { n: number; rot: number };
  ornament: { n: number };
}
interface FallbackFrame { players: Record<"p1" | "p2", { board: { name: string; faction: string; rarity: string }[] }> }

export const { FW_CELL, FW_KITS, fwKitName, fwHash, fallbackWardPlan, fallbackWardLook, fallbackWardsNeeded } = pure;
