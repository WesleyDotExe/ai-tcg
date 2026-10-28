// EFFECTS.md v2, slices 1-2 — the canvas FX layer, the floor layer, the sprite
// atlases with their tint cache, attack travel + impact in sprite materials
// (slice 1), and (slice 2) every other category's faction material — spell
// damage, removal, heal, buff, debuff — plus the magnitude polish: kills that
// shatter, hit-stop, colour split, camera punch, lingering marks and a
// warping background grid (owner-directed 2026-10-03; working reference:
// render/reference/effects-lab.html).
//
// What changes and what does not:
//   - The DOM board, the timeline (when a strike lands, when its
//     consequences play) and every v1 primitive's attribution stay exactly
//     as they were. renderHtml.ts still decides WHAT happens and WHEN; this
//     module only changes what an attack's travel and its impact are drawn
//     with: Nano Banana Pro sprites on two full-viewport canvases instead of
//     CSS-shaped divs.
//   - Two canvases: the FX canvas sits above the cards (below the floating
//     numbers, so a "-3" is never painted over), the floor canvas sits under
//     the cards: at its bottom the background grid that impacts warp, then
//     ground marks (scorch, goo, rift, rune, circuit trace) and debris that
//     settles on the table, then fades.
//   - Slice 2's pairing (which card's ability hit which card) is not decided
//     here: render/src/effectFx.ts reads it from the event log's instance
//     ids, and renderHtml.ts passes the two rects in.
//   - Meaning is the caller's: travel always leaves the attacker and lands
//     on the target along the same arc the aim line uses; impact is always
//     at the target. The faction kit only picks which sprites the trail,
//     head, debris and ground mark are made of (axis 2), the tier only
//     scales counts and sizes (axis 3). test/canvasFx.test.ts checks both.
//
// Same single-source rule as castFx.ts / factionSkin.ts: the page embeds
// CANVAS_FX_PURE_SOURCE (data + maths) and CANVAS_FX_RUNTIME_SOURCE (the
// canvas code) verbatim, and Node evaluates the pure half so the tests
// exercise exactly what the page runs. The runtime half needs a DOM and a 2D
// canvas, so it is proven in a real browser instead (the evidence capture in
// progress/render/).
//
// Self-contained (owner 2026-09-30): the three atlases are committed static
// files, embedded into each replay as data URIs at build time
// (fxAtlasDataUris below). Nothing is fetched at runtime. If the atlases fail
// to decode, or the browser has no 2D canvas, the page falls back to the v1
// DOM bolt and burst, so an attack never goes undrawn.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FxTier } from "./fxMagnitude.js";

export const CANVAS_FX_PURE_SOURCE = String.raw`
  // Sprite ids: three 4x4 atlases, 16 cells each, row-major, in the order
  // render/assets/manifest.json lists them (the test checks the names).
  var FX_SP = { smoke: 0, smokeTrail: 1, embers: 2, molten: 3, shrapnel: 4, hexPlate: 5, crackedHex: 6, scorch: 7,
    goo: 8, chitin: 9, spores: 10, tendril: 11, glitch: 12, pixels: 13, circuit: 14, arc: 15,
    shard: 16, laser: 17, reticle: 18, cube: 19, wing: 20, claw: 21, acid: 22, eggs: 23,
    rift: 24, vortex: 25, glass: 26, darkStar: 27, glint: 28, rays: 29, rune: 30, feather: 31,
    shock: 32, flare: 33, column: 34, dome: 35, ice: 36, iceShatter: 37, sphere: 38, ballLightning: 39,
    chevrons: 40, drips: 41, crosses: 42, portal: 43, cards: 44, orb: 45, dust: 46, crater: 47 };
  var FX_ATLAS_CELL = 192, FX_TEX_SIZE = 160;

  // Axis 2 — faction = what it is made of. Colours per EFFECTS.md (Aegis is
  // orange, owner 2026-10-02). The kit is the lab's K block. Slice 2 added
  // one variant name per category (EFFECTS.md's material table): the
  // category's grammar stays the same, the variant only picks the material.
  // Neutral's debuff is Swarm's acid, in white-gold (owner 2026-10-03;
  // white-gold #fff0c2 replaced gold #ffcf5c, owner 2026-10-05).
  var FX_KITS = {
    Cortex:  { col: '#35c9ff', debris: [FX_SP.pixels, FX_SP.shard, FX_SP.cube, FX_SP.circuit],
               trail: FX_SP.pixels, head: FX_SP.shard, decal: FX_SP.circuit, smoke: 0.35, flavor: 'arc',
               spell: 'laser', removal: 'orbital', heal: 'scan', buff: 'cubes', debuff: 'throttle' },
    Aegis:   { col: '#ff7d24', debris: [FX_SP.shrapnel, FX_SP.hexPlate, FX_SP.crackedHex, FX_SP.molten],
               trail: FX_SP.embers, head: FX_SP.molten, decal: FX_SP.scorch, smoke: 1.1, flavor: 'molten',
               spell: 'shells', removal: 'breach', heal: 'weld', buff: 'plates', debuff: 'crack' },
    Swarm:   { col: '#8bff5c', debris: [FX_SP.chitin, FX_SP.wing, FX_SP.claw, FX_SP.spores],
               trail: FX_SP.spores, head: FX_SP.spores, decal: FX_SP.goo, smoke: 0.5, flavor: 'spore',
               spell: 'swarm', removal: 'devour', heal: 'bloom', buff: 'tendrils', debuff: 'acid' },
    Null:    { col: '#d565ff', debris: [FX_SP.glitch, FX_SP.glass, FX_SP.pixels, FX_SP.glass],
               trail: FX_SP.glitch, head: FX_SP.darkStar, decal: FX_SP.rift, smoke: 0.7, flavor: 'glitch',
               spell: 'blink', removal: 'vortex', heal: 'reverse', buff: 'darkstar', debuff: 'bitrot' },
    Neutral: { col: '#fff0c2', debris: [FX_SP.glint, FX_SP.dust, FX_SP.feather, FX_SP.glint],
               trail: FX_SP.dust, head: FX_SP.glint, decal: FX_SP.rune, smoke: 0.3, flavor: 'glint',
               spell: 'lances', removal: 'smite', heal: 'crosses', buff: 'chevrons', debuff: 'acid' }
  };
  var FX_CATEGORIES = ['spell', 'removal', 'heal', 'buff', 'debuff'];
  function fxVariant(faction, category) { return fxKitOf(faction)[category]; }
  function fxKitOf(faction) { return FX_KITS[faction] || FX_KITS.Neutral; }
  function fxHexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function fxRgbOf(faction) { return fxHexRgb(fxKitOf(faction).col); }

  // The tint (lab: tex()/tintInto()). The atlases are greyscale on black:
  // luminance l becomes l x colour, plus a small white core that only the
  // brightest pixels reach (l^3), so a sprite reads as hot in the middle.
  // Then alpha = the brightest channel and the colour is renormalised by it,
  // which is what makes the black background transparent over the DOM cards
  // while the additive ('lighter') draw still adds the right amount of light.
  function fxTintPixels(p, c) {
    for (var j = 0; j < p.length; j += 4) {
      var l = p[j] / 255, h = l * l * l * 0.62 * 255;
      var r = Math.min(255, c[0] * l + h), g = Math.min(255, c[1] * l + h), b = Math.min(255, c[2] * l + h);
      var m = Math.max(r, g, b);
      if (m < 1) { p[j] = 0; p[j + 1] = 0; p[j + 2] = 0; p[j + 3] = 0; continue; }
      var k = 255 / m;
      p[j] = r * k; p[j + 1] = g * k; p[j + 2] = b * k; p[j + 3] = m;
    }
    return p;
  }

  // Axis 3 — magnitude = how big. One row per tier; every number grows with
  // the tier (the test checks monotonicity). 'normal' stays readable at play
  // speed: the approved pacing is the tick, and none of this changes it.
  var FX_TRAVEL = {
    subtle:    { size: 3,   trailLen: 14, headScale: 5.5, trailEvery: 2 },
    normal:    { size: 4,   trailLen: 20, headScale: 6.5, trailEvery: 2 },
    spectacle: { size: 5.5, trailLen: 26, headScale: 7,   trailEvery: 1 }
  };
  // grid = how hard the hit pushes the background grid; hitStop / punch /
  // shake are the slice-2 camera beats, which only a spectacle hit gets
  // (EFFECTS.md axis 3: "for kills and other spectacle moments").
  var FX_IMPACT = {
    subtle:    { sparks: 12, white: 4,  speed: 260, debris: 4,  linger: 0.15, shock: 34,  flare: 60,  decal: 0,   decalLife: 0,   smoke: 0, flavor: 0, ring: 26, grid: 260,  hitStop: 0,  punch: 0,    shake: 0 },
    normal:    { sparks: 30, white: 10, speed: 400, debris: 10, linger: 0.3,  shock: 56,  flare: 100, decal: 76,  decalLife: 3.5, smoke: 2, flavor: 1, ring: 40, grid: 600,  hitStop: 0,  punch: 0,    shake: 0 },
    spectacle: { sparks: 70, white: 24, speed: 620, debris: 22, linger: 0.35, shock: 120, flare: 190, decal: 130, decalLife: 5,   smoke: 4, flavor: 2, ring: 70, grid: 1500, hitStop: 70, punch: 0.02, shake: 5 }
  };
  // A card destroyed (EFFECTS.md axis 1: "the card shatters"). The card
  // breaks into cols x rows x 2 triangles in the victim's colour. Hit-stop
  // (~120 ms), the colour split (fringe) and the strong camera punch are
  // spectacle-only; a normal kill gets a small punch and shake.
  var FX_KILL = {
    subtle:    { cols: 3, rows: 4, sparks: 40,  debris: 8,  cards: 2, shock: 70,  ring: 90,  grid: 500,  decal: 0, hitStop: 0,   fringe: 0,   punch: 0,     shake: 0, flash: 0 },
    normal:    { cols: 4, rows: 5, sparks: 90,  debris: 16, cards: 3, shock: 100, ring: 120, grid: 1100, decal: 1, hitStop: 0,   fringe: 0,   punch: 0.012, shake: 2, flash: 0 },
    spectacle: { cols: 4, rows: 5, sparks: 170, debris: 26, cards: 5, shock: 120, ring: 150, grid: 2300, decal: 1, hitStop: 120, fringe: 200, punch: 0.035, shake: 7, flash: 0.8 }
  };

  // Spell / ability damage (slice 2). How many shots a variant fires per
  // tier: the subtle tier halves it, spectacle adds half again.
  var FX_SPELL_SHOTS = { laser: 3, shells: 2, swarm: 9, blink: 3, lances: 2 };
  function fxShotCount(variant, tier) {
    var b = FX_SPELL_SHOTS[variant] || 2;
    return tier === 'spectacle' ? Math.round(b * 1.5) : tier === 'subtle' ? Math.max(1, Math.round(b * 0.5)) : b;
  }
  // When each shot of a volley launches (at) and how long it flies (dur), in
  // ms from the start of the effect. Every shot lands by 'ms', and the LAST
  // lands exactly at 'ms': the moment the caller shows the damage number, so
  // the number never comes before the thing that caused it.
  //   laser / blink: the source charges for the first ~45%, then the shots
  //     fire (laser: instant beams; blink: a short teleporting hop each).
  //   swarm: spores leave a few ms apart and arrive at slightly different
  //     times, the last one on the beat.
  //   shells / lances: launched one after another, all flying until 'ms'.
  function fxVolleySchedule(variant, n, ms) {
    var out = [], i;
    if (!(n > 0)) return out;
    if (variant === 'laser' || variant === 'blink') {
      var first = ms * 0.45, step = n > 1 ? (ms - first) / (n - 1) : 0;
      var hop = variant === 'blink' ? Math.min(ms * 0.3, 140) : 0;
      for (i = 0; i < n; i++) {
        var land = n > 1 ? first + step * i : ms;
        out.push({ at: land - hop, dur: hop });
      }
    } else if (variant === 'swarm') {
      var gap = Math.min(30, ms * 0.04);
      for (i = 0; i < n; i++) {
        var a = gap * i, k = i === n - 1 ? 1 : 0.72 + 0.28 * (((i * 7) % 5) / 4);
        out.push({ at: a, dur: (ms - a) * k });
      }
    } else {
      var g = n > 1 ? Math.min((ms * 0.35) / (n - 1), 170) : 0;
      for (i = 0; i < n; i++) out.push({ at: g * i, dur: ms - g * i });
    }
    return out;
  }
  // A quadratic path from a to b (the lab's fly()): 'bend' is the bow as a
  // fraction of the distance, 'side' which way it bows, 'lob' a vertical
  // lift for lobbed shells. Endpoints are exact at t = 0 and t = 1.
  function fxCurve(a, b, bend, side, lob) {
    var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / d, ny = dx / d;
    return { a: a, b: b, c: { x: (a.x + b.x) / 2 + nx * d * bend * side, y: (a.y + b.y) / 2 + ny * d * bend * side + (lob || 0) } };
  }
  // How far past a hit card's larger side its ground mark reaches.
  function fxDecalCover(tier) { return tier === 'spectacle' ? 1.6 : tier === 'normal' ? 1.3 : 0; }
  function fxTravelRecipe(tier, small) {
    var r = FX_TRAVEL[tier] || FX_TRAVEL.normal;
    if (!small) return r;
    return { size: r.size * 0.7, trailLen: Math.round(r.trailLen * 0.7), headScale: r.headScale, trailEvery: 2 };
  }
  // A hit on a player lands mid-board on their side (owner 2026-10-05) and
  // is wider and flatter than a hit on a card: the lab's impactFace
  // squashes the shockwave across their row of slots.
  function fxImpactRecipe(tier, targetKind) {
    var r = FX_IMPACT[tier] || FX_IMPACT.normal;
    var out = {};
    for (var k in r) out[k] = r[k];
    out.shockSx = targetKind === 'player' ? 1.9 : 1;
    out.shockSy = targetKind === 'player' ? 0.55 : 1;
    if (targetKind === 'player') { out.sparks = Math.round(out.sparks * 1.4); out.debris = Math.round(out.debris * 1.3); }
    return out;
  }

  // The flight curve, shared with the DOM bolt it replaces (renderHtml.ts
  // arcBetween / its cubic-bezier(.45,0,.75,1) feel): a gentle ease-in so
  // the head accelerates into the target. t in [0,1] -> progress in [0,1],
  // monotonic, exact at both ends, so the head is ON the target exactly when
  // the strike's consequences start (the caller's later(strikeT, ...)).
  function fxFlightEase(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * 0.55 + t * 0.45; }
  function fxArcPoint(arc, t) {
    var u = 1 - t;
    return { x: u * u * arc.a.x + 2 * u * t * arc.c.x + t * t * arc.b.x, y: u * u * arc.a.y + 2 * u * t * arc.c.y + t * t * arc.b.y };
  }

  // How far from its centre a particle can light pixels over its whole
  // life, as drawP draws it (render session 40): a sprite's turned square
  // at its larger size and stretch, a spark's tail (at most 44 px) and
  // stroke, a square's halo, an ember's or a mote's glow, a shard's corners,
  // a bloom's glow at its widest. The loser's side is cleared by this reach,
  // not by the centre alone, so a big smoke sprite just outside it is caught.
  function fxParticleReach(p) {
    var k = p.kind;
    if (k === 'spr') return Math.max(p.s0 || 0, p.s1 || 0) / 2 * Math.max(p.sx || 1, p.sy || 1) * Math.SQRT2;
    if (k === 'spark') return 44 + (p.size || 0) * 2.1;
    if (k === 'square' || k === 'ember') return (p.size || 0) * 3;
    if (k === 'mote') return (p.size || 0) * 4;
    if (k === 'shard') { var m = 0; (p.pts || []).forEach(function (v) { m = Math.max(m, Math.abs(v)); }); return m * Math.SQRT2; }
    if (k === 'bloom') return (p.r || 0) * 1.2;
    return 0;
  }
`;

export const CANVAS_FX_RUNTIME_SOURCE = String.raw`
  var CFX = (function () {
    var DPR = Math.min(2, window.devicePixelRatio || 1);
    // prefers-reduced-motion: no hit-stop, shake, punch, colour split or
    // grid warp. The particles still say what happened, smaller and calmer.
    var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // Loop state first: size() below may kick the loop during setup.
    var running = false, lastT = 0, frames = 0, peak = 0, fpsAcc = 0, fpsN = 0, fps = 0;
    // Where frame time goes (ms per frame, averaged), for the evidence runs.
    var cost = { update: 0, grid: 0, draw: 0, n: 0 };
    function mkCanvas(cls) { var c = document.createElement('canvas'); c.className = 'fx-canvas ' + cls; c.setAttribute('aria-hidden', 'true'); return c; }
    var floorC = mkCanvas('fx-floor'), fxC = mkCanvas('fx-top');
    document.body.insertBefore(floorC, document.body.firstChild);
    document.body.appendChild(fxC);
    var flc = floorC.getContext('2d'), fxc = fxC.getContext('2d');
    var ok = !!(flc && fxc);
    var VW = 0, VH = 0;
    // The element the camera beats move (punch, shake, colour split). The
    // floating numbers, aim lines and canvases are body children, so they
    // never inherit its transform.
    var camEl = document.getElementById('app') || document.querySelector('[data-fx-camera]');

    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(a) { return a[(Math.random() * a.length) | 0]; }
    function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
    var WHITE = [255, 255, 255], SLATE = [154, 166, 189];

    // ---- atlases + tint cache (pre-tinted once per sprite x colour) ----
    var ATL = [], loaded = 0, ready = false, failed = false;
    var srcs = [];
    try { srcs = JSON.parse(document.getElementById('fx-atlases').textContent); } catch (e) { srcs = []; }
    if (!ok || srcs.length !== 3) failed = true;
    else srcs.forEach(function (src, i) {
      var im = new Image();
      im.onload = function () { ATL[i] = im; loaded++; if (loaded === 3) { ready = true; prewarm(); } };
      im.onerror = function () { failed = true; };
      im.src = src;
    });
    var tcache = {};
    var BLANK = document.createElement('canvas'); BLANK.width = BLANK.height = 2;
    function tex(id, c) {
      var key = id + '|' + c[0] + ',' + c[1] + ',' + c[2];
      var cv = tcache[key];
      if (cv) return cv;
      var a = ATL[(id / 16) | 0], k = id % 16;
      if (!a) return BLANK;
      cv = document.createElement('canvas'); cv.width = cv.height = FX_TEX_SIZE;
      var g = cv.getContext('2d');
      g.drawImage(a, (k % 4) * FX_ATLAS_CELL, ((k / 4) | 0) * FX_ATLAS_CELL, FX_ATLAS_CELL, FX_ATLAS_CELL, 0, 0, FX_TEX_SIZE, FX_TEX_SIZE);
      var d = g.getImageData(0, 0, FX_TEX_SIZE, FX_TEX_SIZE);
      fxTintPixels(d.data, c);
      g.putImageData(d, 0, 0);
      tcache[key] = cv;
      return cv;
    }
    // Warm the cache in small idle slices (never a long frame): every sprite
    // a kit or an effect can ask for, in every faction colour, plus the few
    // fixed colours (white, the debuff slate, a lightened faction colour for
    // heals and shards).
    var KIT_EXTRA = {
      Cortex: [FX_SP.laser, FX_SP.reticle, FX_SP.column, FX_SP.cube, FX_SP.chevrons],
      Aegis: [FX_SP.hexPlate, FX_SP.crackedHex, FX_SP.embers],
      Swarm: [FX_SP.tendril, FX_SP.claw, FX_SP.eggs, FX_SP.acid, FX_SP.chitin],
      Null: [FX_SP.vortex, FX_SP.glitch],
      Neutral: [FX_SP.rune, FX_SP.column, FX_SP.crosses, FX_SP.chevrons, FX_SP.acid]
    };
    function prewarm() {
      var ids = [FX_SP.shock, FX_SP.flare, FX_SP.smoke, FX_SP.smokeTrail, FX_SP.arc, FX_SP.molten, FX_SP.spores, FX_SP.goo, FX_SP.glitch, FX_SP.darkStar, FX_SP.glint, FX_SP.rays, FX_SP.orb, FX_SP.crater];
      var jobs = [];
      Object.keys(FX_KITS).forEach(function (f) {
        var k = FX_KITS[f], c = fxHexRgb(k.col);
        ids.concat(k.debris, [k.trail, k.head, k.decal], KIT_EXTRA[f] || []).forEach(function (id) { jobs.push([id, c]); });
        jobs.push([FX_SP.orb, mix(c, WHITE, 0.35)]);
        jobs.push([FX_SP.cards, mix(c, WHITE, 0.3)]);
      });
      [FX_SP.flare, FX_SP.glint, FX_SP.laser].forEach(function (id) { jobs.push([id, WHITE]); jobs.push([id, SLATE]); });
      (function step() {
        var t0 = performance.now();
        while (jobs.length && performance.now() - t0 < 8) { var j = jobs.shift(); tex(j[0], j[1]); }
        if (jobs.length) setTimeout(step, 16);
      })();
    }

    // ---- glow (code, cached per colour) ----
    var glows = {};
    function glowSprite(c) {
      var k = c.join(',');
      if (glows[k]) return glows[k];
      var cv = document.createElement('canvas'); cv.width = cv.height = 64;
      var g = cv.getContext('2d');
      var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(' + k + ',1)'); gr.addColorStop(0.22, 'rgba(' + k + ',.55)');
      gr.addColorStop(0.55, 'rgba(' + k + ',.12)'); gr.addColorStop(1, 'rgba(' + k + ',0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return glows[k] = cv;
    }
    function drawGlow(ctx, x, y, r, c, a) {
      if (a <= 0 || r <= 0) return;
      ctx.globalAlpha = Math.min(1, a); ctx.drawImage(glowSprite(c), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
    }

    // ---- particles (document coordinates: rect + scroll, so a mark left
    // on the table stays on the table when the page scrolls) ----
    var P = [], proj = [], rings = [], beams = [], timers = [], MAXP = 1800;
    function spr(id, c, x, y, o) {
      o = o || {};
      if (P.length >= MAXP) return;
      var s0 = o.s0 != null ? o.s0 : 40, s1 = o.s1 != null ? o.s1 : s0;
      P.push({ kind: 'spr', id: id, c: c, x: x, y: y, vx: o.vx || 0, vy: o.vy || 0, rot: o.rot != null ? o.rot : rand(0, 6.283), vr: o.vr || 0,
        s0: s0, s1: s1, a: o.a != null ? o.a : 1, age: -(o.delay || 0), life: o.life || 0.6, fric: o.fric != null ? o.fric : 1, grav: o.grav || 0,
        fade: o.fade || 'out', layer: o.layer != null ? o.layer : 1, sx: o.sx || 1, sy: o.sy || 1, blink: o.blink || 0, jit: o.jit || 0 });
    }
    function addP(p) {
      if (P.length >= MAXP) return;
      p.age = p.age || 0; if (p.layer == null) p.layer = 1; if (p.a == null) p.a = 1; if (!p.fade) p.fade = 'out'; if (p.vr == null) p.vr = 0;
      if (p.fric == null) p.fric = 1; if (p.grav == null) p.grav = 0;
      P.push(p);
    }
    function sparks(x, y, c, n, spd, o) {
      o = o || {};
      var life = o.life || 0.6;
      for (var i = 0; i < n; i++) {
        var a = o.angle != null ? o.angle + rand(-(o.spread || Math.PI), o.spread || Math.PI) : rand(0, 6.283), s = spd * rand(0.25, 1.05);
        addP({ kind: 'spark', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.55, 1.15), c: c, size: o.size || rand(1.2, 2.2), fric: 0.9, grav: o.grav || 0 });
      }
    }
    function debris(x, y, kit, c, n, spd, o) {
      o = o || {};
      for (var i = 0; i < n; i++) {
        var a = rand(0, 6.283), s = spd * rand(0.3, 1.05);
        // Some pieces settle on the floor and linger; the rest fly and fall.
        if (Math.random() < (o.linger || 0)) spr(pick(kit.debris), c, x, y, { vx: Math.cos(a) * s * 0.8, vy: Math.sin(a) * s * 0.8, vr: rand(-7, 7), s0: rand(14, 34), life: rand(2.4, 3.6), fric: 0.86, fade: 'late', a: 0.7, layer: 0 });
        else spr(pick(kit.debris), c, x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, vr: rand(-9, 9), s0: rand(14, o.max || 36), life: rand(0.8, 1.4), fric: 0.91, grav: 280, fade: 'late' });
      }
    }
    function smoke(x, y, c, n, str, o) {
      o = o || {};
      var sc = o.sc || 1;
      for (var i = 0; i < n; i++) spr(FX_SP.smoke, c, x + rand(-22, 22) * sc, y + rand(-16, 16) * sc, { vx: rand(-20, 20), vy: rand(-46, -10) * (o.rise || 1), s0: rand(40, 60) * sc, s1: rand(110, 160) * sc, a: 0.2 * str, life: rand(1.4, 2.4), fade: 'inout', vr: rand(-0.5, 0.5), delay: o.delay ? rand(0, o.delay) : 0 });
    }
    function embersRise(x, y, c, n, rad, lm) {
      for (var i = 0; i < n; i++) { var a = rand(0, 6.283), d = rand(0, rad); addP({ kind: 'ember', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: rand(-25, 25), vy: rand(-80, -20), life: rand(1.2, 2.4) * (lm || 1), c: c, size: rand(1.6, 3.2), fric: 0.97, grav: -8 }); }
    }
    // A squashed shock (sx != sy) is a flat ring on the floor (a face hit, a
    // boast's flash along a row): it stays level. Only a round one turns at
    // random. (Render session 33: a tilted flat ring reached past the side a
    // boast's checker had measured it in.)
    function shock(x, y, c, R, life, sx, sy, delay) { spr(FX_SP.shock, c, x, y, { s0: R * 0.25, s1: R * 2.1, life: life, fade: 'out', sx: sx || 1, sy: sy || 1, delay: delay || 0, rot: (sx || 1) !== (sy || 1) ? 0 : undefined }); }
    function flare(x, y, c, s, life) { spr(FX_SP.flare, c, x, y, { s0: s * 0.7, s1: s * 1.1, life: life, rot: 0 }); addP({ kind: 'bloom', x: x, y: y, c: c, r: s * 0.6, life: life, vx: 0, vy: 0, fric: 1, grav: 0 }); }
    function decal(x, y, id, c, s, life, a) { spr(id, c, x, y, { s0: s * 0.8, s1: s, life: life, fade: 'late', a: a, layer: 0 }); }
    function ring(x, y, c, maxR, dur, w, o) { o = o || {}; rings.push({ x: x, y: y, c: c, maxR: maxR, t: 0, dur: dur, w: w, dy: o.dy || 0, squash: o.squash || 1 }); }
    function motesIn(x, y, c, n, rad, o) {
      o = o || {};
      for (var i = 0; i < n; i++) { var a = rand(0, 6.283), d = rand(rad * 0.6, rad); addP({ kind: o.square ? 'square' : 'mote', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: -Math.cos(a) * d * 1.9 - Math.sin(a) * (o.swirl || 0), vy: -Math.sin(a) * d * 1.9 + Math.cos(a) * (o.swirl || 0), life: rand(0.45, 0.7), age: o.late ? -0.25 : 0, c: c, size: o.size || 1.4, fric: 0.97, grav: 0 }); }
    }
    function flavor(kit, c, x, y, m) {
      var i;
      switch (kit.flavor) {
        case 'arc':
          for (i = 0; i < 1 + m; i++) spr(FX_SP.arc, c, x + rand(-26, 26), y + rand(-26, 26), { s0: rand(50, 90) * m, life: 0.16 + i * 0.05, blink: 0.4 });
          for (i = 0; i < 8 * m; i++) addP({ kind: 'square', x: x, y: y, vx: rand(-200, 200), vy: rand(-200, 200), life: rand(0.4, 0.8), c: c, size: rand(0.8, 1.6), fric: 0.9, grav: 0 });
          break;
        case 'molten':
          for (i = 0; i < 5 * m; i++) spr(FX_SP.molten, c, x, y, { vx: rand(-160, 160), vy: rand(-260, -60), grav: 520, s0: rand(14, 26), life: rand(0.6, 1), fade: 'late', fric: 0.98, vr: rand(-3, 3) });
          for (i = 0; i < 10 * m; i++) addP({ kind: 'ember', x: x + rand(-24, 24), y: y + rand(-24, 24), vx: rand(-25, 25), vy: rand(-70, -12), life: rand(1.1, 2), c: c, size: rand(1.8, 3.4), fric: 0.97, grav: -6 });
          break;
        case 'spore':
          spr(FX_SP.spores, c, x, y, { s0: 30, s1: 100 * m, life: 1, a: 0.7, fade: 'inout', vr: 0.5 });
          spr(FX_SP.goo, c, x, y, { s0: 40, s1: 80 * m, life: 0.35, a: 0.9 });
          break;
        case 'glitch':
          for (i = 0; i < 2 + m; i++) spr(FX_SP.glitch, c, x + rand(-30, 30), y + rand(-24, 24), { s0: rand(44, 80) * m, life: rand(0.15, 0.32), rot: 0, blink: 0.35, jit: 10 });
          spr(FX_SP.darkStar, c, x, y, { s0: 40, s1: 130 * m, life: 0.3, a: 0.9 });
          break;
        default:
          for (i = 0; i < 2 + m; i++) spr(FX_SP.glint, c, x + rand(-30, 30), y + rand(-30, 30), { s0: 10, s1: rand(36, 64) * m, life: rand(0.3, 0.5), rot: 0, delay: i * 0.05 });
          spr(FX_SP.rays, c, x, y - 30, { s0: 60, s1: 110 * m, life: 0.4, rot: Math.PI, a: 0.7 });
      }
    }

    // ---- timers on the FX loop's own clock (performance.now, the same
    // clock the page's later() runs on) ----
    function at(ms, fn) { timers.push({ t: performance.now() + Math.max(0, ms), fn: fn }); kick(); }

    // ---- camera beats (slice 2): hit-stop freezes the particles for a
    // moment (the page's own timeline keeps running, so pacing is
    // untouched); punch scales the board toward the impact; shake jitters
    // it; the colour split (fringe) splits red/blue at the edges ----
    var freeze = 0, punch = 0, fringeT = 0, shakeS = null, flashS = null;
    function hitStop(ms) { if (!REDUCED && ms > 0) freeze = Math.max(freeze, ms / 1000); }
    function doPunch(v, x, y) {
      if (REDUCED || !camEl || !(v > 0)) return;
      if (v > punch) {
        var r = camEl.getBoundingClientRect();
        camEl.style.transformOrigin = Math.round(x - window.scrollX - r.left) + 'px ' + Math.round(y - window.scrollY - r.top) + 'px';
      }
      punch = Math.max(punch, v);
    }
    function doShake(amp, ms) { if (!REDUCED && amp > 0) shakeS = { amp: amp, t: 0, dur: ms / 1000 }; }
    function doFringe(ms) { if (!REDUCED && ms > 0) fringeT = Math.max(fringeT, ms / 1000); }
    function doFlash(c, a) { if (a > 0) flashS = { c: c, a: a }; }
    var camLive = false;
    function camera(raw) {
      if (!camEl) return;
      var sx = 0, sy = 0;
      if (shakeS) { shakeS.t += raw; if (shakeS.t >= shakeS.dur) shakeS = null; else { var k = (1 - shakeS.t / shakeS.dur) * shakeS.amp; sx = rand(-k, k); sy = rand(-k, k); } }
      punch *= Math.pow(0.002, raw); if (punch < 0.0005) punch = 0;
      var tf = (sx || sy || punch) ? 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) scale(' + (1 + punch).toFixed(4) + ')' : '';
      if (fringeT > 0) fringeT -= raw;
      var k2 = Math.max(0, fringeT) * 30;
      var fl = k2 > 0.2 ? 'drop-shadow(' + k2.toFixed(1) + 'px 0 0 rgba(255,30,80,.55)) drop-shadow(' + (-k2).toFixed(1) + 'px 0 0 rgba(30,150,255,.55))' : '';
      if (tf || fl || camLive) { camEl.style.transform = tf; camEl.style.filter = fl; }
      camLive = !!(tf || fl);
    }
    function resetCamera() { punch = 0; fringeT = 0; shakeS = null; flashS = null; freeze = 0; if (camEl) { camEl.style.transform = ''; camEl.style.filter = ''; } camLive = false; }

    // ---- the warping background grid (slice 2; the lab's spring grid). It
    // is the bottom of the floor canvas, in viewport coordinates, under the
    // ground marks. (A third full-viewport canvas of its own measurably cost
    // frame rate to composite, so it shares the floor, which is redrawn
    // every frame anyway.) At rest it is one cheap path, and the floor is
    // left showing it when the loop stops; it only animates while an impact
    // has it displaced or tinted, then settles. ----
    var G = { sp: 34, cols: 0, rows: 0, dx: null, dy: null, vx: null, vy: null, tint: null, live: false };
    function gridResize() {
      G.cols = Math.ceil(VW / G.sp) + 2; G.rows = Math.ceil(VH / G.sp) + 2;
      var n = G.cols * G.rows;
      G.dx = new Float32Array(n); G.dy = new Float32Array(n); G.vx = new Float32Array(n); G.vy = new Float32Array(n); G.tint = new Float32Array(n * 3);
      G.live = false;
    }
    function gridSpan(x, y, rad) {
      return { i0: Math.max(1, Math.floor((x - rad) / G.sp)), i1: Math.min(G.cols - 2, Math.ceil((x + rad) / G.sp)),
        j0: Math.max(1, Math.floor((y - rad) / G.sp)), j1: Math.min(G.rows - 2, Math.ceil((y + rad) / G.sp)) };
    }
    function gridForce(docX, docY, str, rad, implode) {
      if (!ok || REDUCED || !G.dx || !(str > 0)) return;
      var x = docX - window.scrollX, y = docY - window.scrollY, s = gridSpan(x, y, rad), C = G.cols;
      for (var j = s.j0; j <= s.j1; j++) for (var i = s.i0; i <= s.i1; i++) {
        var k = j * C + i, ddx = i * G.sp + G.dx[k] - x, ddy = j * G.sp + G.dy[k] - y, d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d < rad && d > 0.01) { var f = str * Math.pow(1 - d / rad, 2) * (implode ? -1 : 1); G.vx[k] += ddx / d * f; G.vy[k] += ddy / d * f; }
      }
      G.live = true; kick();
    }
    function gridTint(docX, docY, c, rad) {
      if (!ok || REDUCED || !G.tint) return;
      var x = docX - window.scrollX, y = docY - window.scrollY, s = gridSpan(x, y, rad), C = G.cols;
      for (var j = s.j0; j <= s.j1; j++) for (var i = s.i0; i <= s.i1; i++) {
        var k = j * C + i, d = Math.hypot(i * G.sp - x, j * G.sp - y);
        if (d < rad) { var t = 1 - d / rad; G.tint[k * 3] = Math.max(G.tint[k * 3], c[0] * t); G.tint[k * 3 + 1] = Math.max(G.tint[k * 3 + 1], c[1] * t); G.tint[k * 3 + 2] = Math.max(G.tint[k * 3 + 2], c[2] * t); }
      }
      G.live = true; kick();
    }
    function gridUpdate(dt) {
      if (!G.live || !(dt > 0)) return;
      var KA = 46, KC = 170, damp = Math.pow(0.84, dt * 60), C = G.cols, R = G.rows, j, i, k, energy = 0;
      for (j = 1; j < R - 1; j++) for (i = 1; i < C - 1; i++) {
        k = j * C + i;
        var lx = (G.dx[k - 1] + G.dx[k + 1] + G.dx[k - C] + G.dx[k + C]) * 0.25 - G.dx[k], ly = (G.dy[k - 1] + G.dy[k + 1] + G.dy[k - C] + G.dy[k + C]) * 0.25 - G.dy[k];
        G.vx[k] = (G.vx[k] + (-KA * G.dx[k] + KC * lx) * dt) * damp; G.vy[k] = (G.vy[k] + (-KA * G.dy[k] + KC * ly) * dt) * damp;
      }
      for (j = 1; j < R - 1; j++) for (i = 1; i < C - 1; i++) {
        k = j * C + i;
        G.dx[k] += G.vx[k] * dt; G.dy[k] += G.vy[k] * dt;
        var m = Math.sqrt(G.dx[k] * G.dx[k] + G.dy[k] * G.dy[k]);
        if (m > 46) { G.dx[k] *= 46 / m; G.dy[k] *= 46 / m; m = 46; }
        energy += m + Math.abs(G.vx[k]) * 0.05 + Math.abs(G.vy[k]) * 0.05;
      }
      var td = Math.pow(0.93, dt * 60), tsum = 0;
      for (k = 0; k < G.tint.length; k++) { G.tint[k] *= td; tsum += G.tint[k]; }
      // Settled: snap to rest and stop animating the grid.
      if (energy < 0.5 && tsum < 30) { G.dx.fill(0); G.dy.fill(0); G.vx.fill(0); G.vy.fill(0); G.tint.fill(0); G.live = false; }
    }
    var GRID_BASE = [30, 40, 104], GRID_HOT = [86, 112, 240];
    function gridDraw(gc) {
      if (!G.dx) return;
      gc.setTransform(DPR, 0, 0, DPR, 0, 0);
      var C = G.cols, R = G.rows, sp = G.sp;
      gc.globalCompositeOperation = 'lighter'; gc.lineCap = 'round';
      // Everything at rest is one path in the base colour; only the
      // displaced or tinted segments are stroked one by one.
      gc.beginPath();
      var hot = [];
      function seg(k1, k2) {
        var d1 = Math.abs(G.dx[k1]) + Math.abs(G.dy[k1]), d2 = Math.abs(G.dx[k2]) + Math.abs(G.dy[k2]);
        var t1 = G.tint[k1 * 3] + G.tint[k1 * 3 + 1] + G.tint[k1 * 3 + 2], t2 = G.tint[k2 * 3] + G.tint[k2 * 3 + 1] + G.tint[k2 * 3 + 2];
        var x1 = (k1 % C) * sp + G.dx[k1], y1 = ((k1 / C) | 0) * sp + G.dy[k1], x2 = (k2 % C) * sp + G.dx[k2], y2 = ((k2 / C) | 0) * sp + G.dy[k2];
        if (d1 + d2 < 0.3 && t1 + t2 < 6) { gc.moveTo(x1, y1); gc.lineTo(x2, y2); return; }
        hot.push(k1, k2, x1, y1, x2, y2);
      }
      var i, j;
      for (j = 0; j < R; j++) for (i = 0; i < C - 1; i++) seg(j * C + i, j * C + i + 1);
      for (j = 0; j < R - 1; j++) for (i = 0; i < C; i++) seg(j * C + i, (j + 1) * C + i);
      gc.strokeStyle = rgba(GRID_BASE, 0.17); gc.lineWidth = 1; gc.stroke();
      for (var h = 0; h < hot.length; h += 6) {
        var k1 = hot[h], k2 = hot[h + 1];
        var disp = Math.min(1, (Math.hypot(G.dx[k1], G.dy[k1]) + Math.hypot(G.dx[k2], G.dy[k2])) / 30);
        var tr = (G.tint[k1 * 3] + G.tint[k2 * 3]) / 2, tg = (G.tint[k1 * 3 + 1] + G.tint[k2 * 3 + 1]) / 2, tb = (G.tint[k1 * 3 + 2] + G.tint[k2 * 3 + 2]) / 2;
        var tm = Math.min(1, (tr + tg + tb) / 300);
        var hc = tm > 0.02 ? [tr / Math.max(tm, 0.001), tg / Math.max(tm, 0.001), tb / Math.max(tm, 0.001)].map(function (v) { return Math.min(255, v); }) : GRID_HOT;
        var kk = Math.min(1, disp * 1.1 + tm * 0.6);
        var col = [0, 1, 2].map(function (q) { return Math.round(GRID_BASE[q] * (1 - kk) + hc[q] * kk); });
        gc.strokeStyle = rgba(col, 0.17 + disp * 0.45 + tm * 0.25); gc.lineWidth = 1 + disp * 1.1;
        gc.beginPath(); gc.moveTo(hot[h + 2], hot[h + 3]); gc.lineTo(hot[h + 4], hot[h + 5]); gc.stroke();
      }
      gc.globalCompositeOperation = 'source-over';
    }
    // Idle: the floor shows only the grid at rest; the FX canvas is empty.
    function paintIdle() {
      if (!ok) return;
      flc.setTransform(1, 0, 0, 1, 0, 0); flc.clearRect(0, 0, floorC.width, floorC.height);
      fxc.setTransform(1, 0, 0, 1, 0, 0); fxc.clearRect(0, 0, fxC.width, fxC.height);
      gridDraw(flc);
    }

    function size() {
      VW = window.innerWidth; VH = window.innerHeight;
      [floorC, fxC].forEach(function (c) { c.width = Math.round(VW * DPR); c.height = Math.round(VH * DPR); c.style.width = VW + 'px'; c.style.height = VH + 'px'; });
      gridResize();
      if (ok) { paintIdle(); kick(); }
    }
    window.addEventListener('resize', size);

    function docCentre(rect) { return { x: rect.left + rect.width / 2 + window.scrollX, y: rect.top + rect.height / 2 + window.scrollY }; }

    // ---- projectiles: one generic flight (the lab's fly()), used by attack
    // travel and by every slice-2 category. Lands exactly at 'ms' after its
    // own launch delay, then calls onArrive(position). ----
    function launch(o) {
      proj.push({ arc: o.arc || fxCurve(o.from, o.to, o.bend || 0, o.side || 1, o.lob || 0), kit: o.kit, c: o.c,
        size: o.size, trailLen: o.trailLen, headScale: o.headScale, trailEvery: o.trailEvery || 2, head: o.head != null ? o.head : o.kit.head,
        ease: o.ease || 'acc', t0: performance.now() + (o.delay || 0), ms: Math.max(30, o.ms), trail: [], n: 0, onArrive: o.onArrive || null });
      kick();
    }
    // The lab's chargeUp: a ring and a puff of the faction's trail material
    // on the card as it commits.
    function charge(p, kit, c, soft) {
      ring(p.x, p.y, c, soft ? 32 : 44, 0.26, 2);
      spr(kit.trail, c, p.x, p.y, { s0: 20, s1: soft ? 48 : 64, life: 0.3, a: 0.7 });
      if (!soft) sparks(p.x, p.y, c, 10, 140, { life: 0.35 });
    }

    // travel(from, to): the attack head and its trail follow the aim line's
    // arc and arrive exactly at 'ms'.
    function travel(fromRect, toRect, faction, tier, ms, small) {
      if (!ready || failed || !fromRect || !toRect) return false;
      var a = docCentre(fromRect), b = docCentre(toRect);
      var kit = fxKitOf(faction), c = fxHexRgb(kit.col), r = fxTravelRecipe(tier, small);
      launch({ arc: arcBetween(a, b), kit: kit, c: c, size: r.size, trailLen: r.trailLen, headScale: r.headScale, trailEvery: r.trailEvery, ms: ms });
      ring(a.x, a.y, c, small ? 30 : 44, 0.26, 2);
      spr(kit.trail, c, a.x, a.y, { s0: 20, s1: small ? 44 : 64, life: 0.3, a: 0.7 });
      return true;
    }

    // impact(target): sparks, debris in the faction's material, a shockwave
    // and flare, a ground mark on the floor layer, the faction's flavour, a
    // push on the grid; a spectacle hit adds hit-stop, punch and shake.
    function impact(rect, faction, tier, targetKind) {
      if (!ready || failed || !rect) return false;
      var p = docCentre(rect), kit = fxKitOf(faction), c = fxHexRgb(kit.col);
      var r = fxImpactRecipe(tier, targetKind);
      sparks(p.x, p.y, c, r.sparks, r.speed, { life: 0.6 });
      sparks(p.x, p.y, WHITE, r.white, r.speed * 0.75, { life: 0.3 });
      debris(p.x, p.y, kit, c, r.debris, r.speed * 0.9, { linger: r.linger, max: tier === 'spectacle' ? 46 : 34 });
      shock(p.x, p.y, c, r.shock, tier === 'spectacle' ? 0.55 : 0.4, r.shockSx, r.shockSy);
      flare(p.x, p.y, c, r.flare, tier === 'spectacle' ? 0.45 : 0.3);
      ring(p.x, p.y, c, r.ring, 0.42, tier === 'spectacle' ? 3 : 2.5);
      // The ground mark lives on the floor, under the cards. Under a card it
      // is sized past the card's own edges so it shows around it (the card
      // stands in its scorch / goo / rift). A hit on a player lands in the
      // middle of their side of the board and marks the floor there too.
      if (r.decal > 0) {
        var ds = Math.max(r.decal, Math.max(rect.width, rect.height) * fxDecalCover(tier));
        decal(p.x, p.y + 6, kit.decal, c, ds, r.decalLife, 0.42);
      }
      if (r.smoke > 0) smoke(p.x, p.y, c, r.smoke, kit.smoke);
      if (r.flavor > 0) flavor(kit, c, p.x, p.y, r.flavor);
      gridForce(p.x, p.y, r.grid, targetKind === 'player' ? 220 : 120);
      gridTint(p.x, p.y, c, targetKind === 'player' ? 260 : 130);
      hitStop(r.hitStop); doPunch(r.punch, p.x, p.y); doShake(r.shake, 220);
      if (tier === 'spectacle' && targetKind === 'player') doFlash(c, 0.5);
      kick();
      return true;
    }

    // ---- slice 2: every other category, in its faction's material -------
    // effect(category, from, to, faction, tier, ms, o): the travel leaves the
    // source card (or a Command's stack entry) and its effect lands on the
    // target exactly at 'ms', the moment the page shows the number. o.self:
    // source and target are the same card, so it plays in place, no travel.
    // o.targetKind: 'unit' | 'player'.
    function effect(cat, fromRect, toRect, faction, tier, ms, o) {
      if (!ready || failed || !toRect) return false;
      o = o || {};
      var kit = fxKitOf(faction), c = fxHexRgb(kit.col), v = kit[cat];
      if (!v) return false;
      var b = docCentre(toRect), a = fromRect && !o.self ? docCentre(fromRect) : null;
      var m = tier === 'spectacle' ? 1.5 : tier === 'subtle' ? 0.6 : 1;
      // An in-place effect (self) lands when the page shows the number,
      // which may be right away; a flight needs a few frames to read.
      ms = Math.max(a ? 60 : 0, ms || 0);
      if (cat === 'spell') spell(v, a, b, toRect, kit, c, tier, m, ms, o.targetKind || 'unit');
      else if (cat === 'removal') removal(v, a, b, toRect, kit, c, ms);
      else {
        var land = function () {
          if (cat === 'heal') healAt(v, b, toRect, kit, c, m);
          else if (cat === 'buff') buffAt(v, b, toRect, kit, c, m);
          else debuffAt(v, b, toRect, kit, c, m);
        };
        if (a) {
          charge(a, kit, c, true);
          var dx = b.x - a.x;
          launch({ from: a, to: b, kit: kit, c: c, size: 3.6 + m, trailLen: 12, headScale: 7, head: FX_SP.orb, bend: cat === 'debuff' ? 0.12 : 0.4, side: dx < 0 ? 1 : -1, ms: ms, onArrive: land });
        } else at(ms, land);
      }
      kick();
      return true;
    }

    function hitAt(p, kit, c, m) {
      sparks(p.x, p.y, c, Math.round(22 * m), 360, { life: 0.45 });
      debris(p.x, p.y, kit, c, Math.max(1, Math.round(3 * m)), 300, { linger: 0.2, max: 30 });
      flare(p.x, p.y, c, 60 * m, 0.24); shock(p.x, p.y, c, 26 * m, 0.3);
      flavor(kit, c, p.x, p.y, 0.6 * m);
      gridForce(p.x, p.y, 260 * m, 80); gridTint(p.x, p.y, c, 90);
    }
    function spell(v, a, b, rect, kit, c, tier, m, ms, targetKind) {
      if (!a) a = { x: b.x, y: b.y - 140 };
      var n = fxShotCount(v, tier), plan = fxVolleySchedule(v, n, ms);
      var spread = Math.min(rect.width, rect.height) * 0.18;
      charge(a, kit, c, false);
      if (v === 'laser') spr(FX_SP.reticle, c, b.x, b.y, { s0: Math.max(rect.width, rect.height) * 1.1, s1: Math.max(rect.width, rect.height) * 0.7, life: ms / 1000 + 0.15, vr: 2.4, fade: 'late', rot: 0, a: 0.8 });
      plan.forEach(function (s, i) {
        var last = i === n - 1;
        var q = last ? b : { x: b.x + rand(-spread, spread), y: b.y + rand(-spread * 1.2, spread * 1.2) };
        var hm = v === 'swarm' && !last ? m * 0.45 : m;
        var land = function (p) {
          p = p || q;
          hitAt(p, kit, c, hm);
          if (!last) return;
          // The last shot is the one the number arrives with: it leaves the
          // faction's mark (not on a player's opaque HUD) and, at spectacle,
          // the camera beat.
          if (tier !== 'subtle') decal(p.x, p.y + 6, kit.decal, c, Math.max(70, Math.max(rect.width, rect.height) * fxDecalCover(tier)), 3.5, 0.38);
          if (tier === 'spectacle') { hitStop(70); doPunch(0.015, p.x, p.y); doShake(3, 180); }
        };
        if (v === 'laser') at(s.at, function () {
          beams.push({ from: a, to: q, c: c, t: 0, dur: 0.14, w: 0.7 * m });
          var ang = Math.atan2(q.y - a.y, q.x - a.x), len = Math.hypot(q.x - a.x, q.y - a.y);
          spr(FX_SP.laser, c, (a.x + q.x) / 2, (a.y + q.y) / 2, { s0: len * 1.1, rot: ang, sy: 0.35, life: 0.16 });
          land(q);
        });
        else if (v === 'blink') {
          // Packets teleport along the line: four short blinks, then the hit.
          for (var st = 1; st <= 4; st++) (function (st) {
            at(s.at + (s.dur * (st - 1)) / 4, function () {
              var x = a.x + (q.x - a.x) * st / 4 + (st < 4 ? rand(-14, 14) : 0), y = a.y + (q.y - a.y) * st / 4 + (st < 4 ? rand(-14, 14) : 0);
              spr(FX_SP.glitch, c, x, y, { s0: 46, life: 0.14, rot: 0, jit: 8 });
              spr(FX_SP.darkStar, c, x, y, { s0: 18, s1: 44, life: 0.14 });
            });
          })(st);
          at(s.at + s.dur, function () { land(q); });
        }
        else if (v === 'shells') launch({ from: a, to: q, kit: kit, c: c, size: 4.6, trailLen: 18, headScale: 7, head: FX_SP.molten, bend: 0.05, side: 1, lob: -Math.min(170, Math.hypot(q.x - a.x, q.y - a.y) * 0.5), delay: s.at, ms: s.dur,
          onArrive: function (p) { land(p); smoke(p.x, p.y, c, 2, 1); } });
        else if (v === 'swarm') launch({ from: a, to: q, kit: kit, c: c, size: 2.2, trailLen: 10, headScale: 9, head: FX_SP.spores, bend: rand(0.2, 0.9), side: Math.random() < 0.5 ? 1 : -1, delay: s.at, ms: s.dur, onArrive: land });
        else launch({ from: a, to: q, kit: kit, c: c, size: 3.6, trailLen: 14, headScale: 10, head: FX_SP.glint, bend: 0, side: 1, ease: 'lin', delay: s.at, ms: s.dur,
          onArrive: function (p) { land(p); spr(FX_SP.rays, c, p.x, p.y - 40, { s0: 50, s1: 110, life: 0.35, rot: Math.PI, a: 0.7 }); } });
      });
    }

    // Removal "locks on first and is louder than a combat death" (EFFECTS.md
    // axis 1): the lock plays on the target from the start, the strike lands
    // at 'ms'. The shatter itself is kill(), which the page calls for the
    // death at the same moment, so a removal is lock + strike + shatter.
    function removal(v, a, b, rect, kit, c, ms) {
      var S = ms / 1000, w = rect.width, h = rect.height, top = { x: b.x, y: window.scrollY };
      if (v === 'orbital') {
        spr(FX_SP.reticle, c, b.x, b.y, { s0: Math.max(w, h) * 1.5, s1: Math.max(w, h) * 0.75, life: S + 0.25, vr: 2.6, fade: 'late', rot: 0 });
        at(ms * 0.7, function () {
          spr(FX_SP.column, c, b.x, b.y - 150, { s0: 330, s1: 300, sx: 0.55, sy: 1.1, life: 0.5, rot: 0 });
          beams.push({ from: top, to: b, c: c, t: 0, dur: 0.35, w: 1.6 });
          gridForce(b.x, b.y, 1300, 170, true);
        });
      } else if (v === 'breach') {
        // The charge flies from the source, sticks, beeps three times, blows.
        var src = a || { x: b.x, y: b.y - 160 };
        launch({ from: src, to: b, kit: kit, c: c, size: 5, trailLen: 16, headScale: 6, head: FX_SP.hexPlate, bend: 0.05, side: 1, lob: -140, ms: ms * 0.5,
          onArrive: function (p) { spr(FX_SP.hexPlate, c, p.x, p.y, { s0: 44, life: S * 0.5 + 0.1, rot: 0, fade: 'late' }); } });
        [0.62, 0.78, 0.92].forEach(function (f) { at(ms * f, function () { ring(b.x, b.y, c, 44, 0.24, 2); spr(FX_SP.flare, c, b.x, b.y, { s0: 40, s1: 70, life: 0.14, rot: 0 }); }); });
        at(ms, function () { smoke(b.x, b.y, c, 4, 1.2, { sc: 1.3 }); });
      } else if (v === 'devour') {
        for (var i = 0; i < 6; i++) {
          var an = -Math.PI / 2 + (i - 2.5) * 0.42, bx = b.x + (i - 2.5) * (w / 6), by = b.y + h / 2 + 10;
          spr(FX_SP.tendril, c, bx, by - 40, { s0: 30, s1: 150, rot: an + Math.PI / 2, life: S + 0.4, fade: 'late', delay: i * 0.04 });
          spr(FX_SP.claw, c, bx, by - 70, { s0: 20, s1: 60, rot: an + Math.PI / 2, life: S + 0.2, fade: 'late', delay: 0.1 + i * 0.04 });
        }
        at(ms, function () { spr(FX_SP.goo, c, b.x, b.y, { s0: 60, s1: 180, life: 0.5, a: 0.9 }); });
      } else if (v === 'vortex') {
        spr(FX_SP.vortex, c, b.x, b.y, { s0: 40, s1: 200, vr: -9, life: S + 0.2, fade: 'late' });
        for (var k = 0; k < 60; k++) { var aa = rand(0, 6.283), d = rand(70, 120); addP({ kind: 'spark', x: b.x + Math.cos(aa) * d, y: b.y + Math.sin(aa) * d, vx: -Math.cos(aa) * d * 2.6 - Math.sin(aa) * 120, vy: -Math.sin(aa) * d * 2.6 + Math.cos(aa) * 120, life: Math.min(0.35, S), c: c, size: 1.4, fric: 1, grav: 0 }); }
        gridForce(b.x, b.y, 1500, 190, true);
        at(ms, function () { spr(FX_SP.darkStar, c, b.x, b.y, { s0: 60, s1: 300, life: 0.45 }); decal(b.x, b.y, FX_SP.rift, c, 150, 5.5, 0.55); });
      } else {
        spr(FX_SP.rune, c, b.x, b.y, { s0: Math.max(w, h) * 1.4, s1: Math.max(w, h) * 1.05, vr: 1.2, life: S + 0.3, fade: 'late', rot: 0 });
        at(ms * 0.75, function () {
          spr(FX_SP.rays, c, b.x, b.y - 120, { s0: 260, life: 0.5, rot: Math.PI, a: 0.9 });
          spr(FX_SP.column, c, b.x, b.y - 150, { s0: 330, sx: 0.45, sy: 1.1, life: 0.45, rot: 0 });
          beams.push({ from: top, to: b, c: c, t: 0, dur: 0.3, w: 1.2 });
        });
      }
    }

    function healAt(v, b, rect, kit, c, m) {
      var L = mix(c, WHITE, 0.35), w = rect.width, h = rect.height;
      flare(b.x, b.y, c, 110 * m, 0.5);
      spr(FX_SP.orb, L, b.x, b.y, { s0: 40, s1: 140 * m, life: 0.6, a: 0.6 });
      motesIn(b.x, b.y, L, Math.round(30 * m), 100, { swirl: 90 });
      ring(b.x, b.y, c, 60 * m, 0.52, 2);
      var i;
      if (v === 'scan') {
        for (i = 0; i < 2; i++) spr(FX_SP.laser, c, b.x, b.y - h / 2, { s0: w * 1.9, sy: 0.45, rot: 0, vy: h / 0.45, life: 0.45, fade: 'in', delay: i * 0.3 });
        motesIn(b.x, b.y, c, Math.round(26 * m), 90, { square: true });
      } else if (v === 'weld') {
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (o) {
          var x = b.x + o[0] * w * 0.45, y = b.y + o[1] * h * 0.45;
          sparks(x, y, mix(c, WHITE, 0.4), Math.round(12 * m), 220, { grav: 420, life: 0.6 });
          spr(FX_SP.embers, c, x, y, { s0: 30, s1: 60, life: 0.4 });
        });
        for (i = 0; i < 6; i++) { var an = i / 6 * 6.283, d = 95; spr(FX_SP.hexPlate, c, b.x + Math.cos(an) * d, b.y + Math.sin(an) * d, { vx: -Math.cos(an) * d * 2.3, vy: -Math.sin(an) * d * 2.3, s0: 30, s1: 14, life: 0.42, vr: 4, delay: i * 0.04 }); }
      } else if (v === 'bloom') {
        spr(FX_SP.eggs, c, b.x, b.y + 10, { s0: 30, s1: 120 * m, life: 1.1, fade: 'inout' });
        for (i = 0; i < 9; i++) spr(FX_SP.spores, L, b.x + rand(-40, 40), b.y + rand(-10, 50), { vy: rand(-70, -30), s0: rand(18, 28), s1: rand(40, 60), life: rand(0.8, 1.2), fade: 'inout', delay: i * 0.05 });
        spr(FX_SP.tendril, c, b.x - 30, b.y, { s0: 40, s1: 150, rot: -0.3, life: 0.9, fade: 'inout' });
        spr(FX_SP.tendril, c, b.x + 30, b.y, { s0: 40, s1: 150, rot: 0.3 + Math.PI, life: 0.9, fade: 'inout' });
      } else if (v === 'reverse') {
        // The vortex runs backwards: dark motes are thrown out, light pulled in.
        spr(FX_SP.vortex, c, b.x, b.y, { s0: 220, s1: 60, vr: 7, life: 0.9, fade: 'inout' });
        for (i = 0; i < 24; i++) { var a2 = rand(0, 6.283); addP({ kind: 'mote', x: b.x, y: b.y, vx: Math.cos(a2) * rand(90, 170), vy: Math.sin(a2) * rand(90, 170), life: 0.5, c: mix(c, [40, 0, 60], 0.4), size: 1.2, fric: 0.94, grav: 0 }); }
        motesIn(b.x, b.y, WHITE, 24, 100, { late: true, size: 1.2 });
      } else {
        for (i = 0; i < 3; i++) spr(FX_SP.crosses, mix(c, WHITE, 0.2), b.x + rand(-20, 20), b.y + 20, { vy: -55, s0: 50, s1: 110, life: 1.0, fade: 'inout', rot: 0, delay: i * 0.12 });
        spr(FX_SP.rays, c, b.x, b.y + 30, { s0: 90, s1: 170, life: 0.7, rot: 0, a: 0.6, fade: 'inout' });
        for (i = 0; i < 4; i++) spr(FX_SP.glint, WHITE, b.x + rand(-40, 40), b.y + rand(-50, 50), { s0: 8, s1: 40, life: 0.4, rot: 0, delay: 0.1 + i * 0.1 });
      }
    }

    // Buff: rise + brighten, moving upward (axis 1). The squashed ring lifts.
    function buffAt(v, b, rect, kit, c, m) {
      ring(b.x, b.y, c, 40 * m, 0.52, 2, { dy: 40, squash: 0.5 });
      var i;
      if (v === 'cubes') {
        for (i = 0; i < 3; i++) spr(FX_SP.cube, c, b.x + rand(-18, 18), b.y - 10, { vy: -80, s0: 36, s1: 58, vr: 0.8, life: 0.9, fade: 'inout', delay: i * 0.12 });
        spr(FX_SP.chevrons, c, b.x, b.y - 30, { vy: -40, s0: 56, s1: 80, life: 0.8, rot: 0, a: 0.75, fade: 'inout' });
      } else if (v === 'plates') {
        for (i = 0; i < 3; i++) {
          var ox = (i - 1) * 28;
          spr(FX_SP.hexPlate, c, b.x + ox, b.y - 110, { vy: 520, s0: 34, life: 0.2, rot: 0, fade: 'in', delay: i * 0.08 });
          spr(FX_SP.hexPlate, c, b.x + ox, b.y - 6, { s0: 34, life: 0.7, rot: 0, fade: 'late', delay: 0.2 + i * 0.08 });
          shock(b.x + ox, b.y, c, 26, 0.3, 1, 1, 0.2 + i * 0.08);
        }
      } else if (v === 'tendrils') {
        for (i = 0; i < 4; i++) spr(FX_SP.tendril, c, b.x + (i - 1.5) * 26, b.y + 20, { s0: 20, s1: 110, rot: rand(-0.3, 0.3), life: 0.95, fade: 'inout', delay: i * 0.06 });
        spr(FX_SP.chitin, c, b.x, b.y - 40, { vy: -40, s0: 20, s1: 44, life: 0.8, fade: 'inout' });
      } else if (v === 'darkstar') {
        spr(FX_SP.darkStar, c, b.x, b.y, { s0: 40, s1: 150 * m, life: 0.7, vr: 1, fade: 'inout' });
        for (i = 0; i < 4; i++) spr(FX_SP.glitch, c, b.x + rand(-20, 20), b.y + 20, { vy: -120, s0: 40, life: 0.4, rot: 0, jit: 6, delay: i * 0.08 });
      } else {
        for (i = 0; i < 2; i++) spr(FX_SP.chevrons, c, b.x, b.y, { vy: -90, s0: 56, s1: 84, life: 0.8, rot: 0, fade: 'inout', delay: i * 0.15 });
        for (i = 0; i < 3; i++) spr(FX_SP.glint, WHITE, b.x + rand(-40, 40), b.y + rand(-50, 30), { s0: 8, s1: 36, life: 0.4, rot: 0, delay: 0.1 + i * 0.1 });
      }
    }

    // Debuff: sink + desaturate, moving downward (axis 1). Slate ring sinks,
    // the faction's material falls away. Neutral's is Swarm's acid, in white-gold.
    function debuffAt(v, b, rect, kit, c, m) {
      var w = rect.width, h = rect.height, i;
      ring(b.x, b.y, SLATE, 60 * m, 0.5, 2, { dy: -20 });
      if (v === 'throttle') {
        spr(FX_SP.reticle, c, b.x, b.y, { s0: 130, s1: 90, life: 0.6, vr: 2, rot: 0, fade: 'late' });
        for (i = 0; i < 36 * m; i++) addP({ kind: 'square', x: b.x + rand(-w / 2, w / 2), y: b.y + rand(-h / 2, h / 3), vx: rand(-8, 8), vy: rand(10, 50), life: rand(0.7, 1.2), c: c, size: rand(0.8, 1.4), fric: 0.98, grav: 180 });
        for (i = 0; i < 3; i++) spr(FX_SP.laser, SLATE, b.x, b.y + rand(-50, 50), { s0: w * 1.6, sy: 0.4, rot: 0, life: 0.12, delay: i * 0.12 });
      } else if (v === 'crack') {
        for (i = 0; i < 4; i++) spr(FX_SP.crackedHex, c, b.x + rand(-30, 30), b.y + rand(-50, 20), { vx: rand(-30, 30), vy: rand(0, 40), grav: 600, s0: rand(30, 46), vr: rand(-3, 3), life: 1.1, fade: 'late', delay: 0.15 + i * 0.08 });
        spr(FX_SP.crackedHex, c, b.x, b.y, { s0: 90, life: 0.4, rot: 0, a: 0.8 });
      } else if (v === 'acid') {
        spr(FX_SP.acid, c, b.x, b.y - h / 2 + 30, { vy: 30, s0: 120, s1: 145, life: 1.2, rot: 0, fade: 'late' });
        decal(b.x, b.y + h / 2 + 4, FX_SP.goo, c, 100, 4, 0.45);
        smoke(b.x, b.y, c, 3, 0.5, { sc: 0.7 });
      } else {
        for (i = 0; i < 7; i++) spr(FX_SP.glitch, c, b.x + rand(-20, 20), b.y + rand(-60, 60), { s0: rand(50, 90), life: rand(0.2, 0.45), rot: 0, blink: 0.4, jit: 10, delay: i * 0.08 });
        for (i = 0; i < 24 * m; i++) addP({ kind: 'square', x: b.x + rand(-w / 2, w / 2), y: b.y + rand(-h / 2, h / 2), vx: 0, vy: rand(20, 70), life: rand(0.6, 1), c: c, size: rand(0.8, 1.5), fric: 0.98, grav: 160 });
      }
      for (i = 0; i < 26 * m; i++) addP({ kind: 'mote', x: b.x + rand(-w / 2, w / 2), y: b.y + rand(-h / 2, h / 3), vx: rand(-10, 10), vy: rand(20, 80), life: rand(0.6, 1.1), c: c, size: rand(1, 1.8), fric: 0.98, grav: 140 });
    }

    // kill(card): the card shatters into triangles in the victim's colour,
    // with the killer's material and the victim's in the debris, a crater
    // and the killer's mark left on the table, and the camera beat for the
    // tier (spectacle: hit-stop, colour split, strong punch, flash).
    function shatter(rect, c, from, cols, rows) {
      var x0 = rect.left + window.scrollX, y0 = rect.top + window.scrollY, cw = rect.width / cols, ch = rect.height / rows;
      for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
        var ax = x0 + i * cw, ay = y0 + j * ch;
        [[ax, ay, ax + cw, ay, ax, ay + ch], [ax + cw, ay, ax + cw, ay + ch, ax, ay + ch]].forEach(function (t) {
          var cx = (t[0] + t[2] + t[4]) / 3, cy = (t[1] + t[3] + t[5]) / 3, dx = cx - from.x, dy = cy - from.y, d = Math.hypot(dx, dy) || 1, sp = rand(140, 440);
          addP({ kind: 'shard', x: cx, y: cy, vx: dx / d * sp + rand(-60, 60), vy: dy / d * sp + rand(-60, 60), life: rand(0.9, 1.5), c: c, fric: 0.955, grav: 110, rot: 0, vr: rand(-9, 9),
            pts: [t[0] - cx, t[1] - cy, t[2] - cx, t[3] - cy, t[4] - cx, t[5] - cy] });
        });
      }
    }
    function kill(rect, killerFaction, victimFaction, tier) {
      if (!ready || failed || !rect || (rect.width === 0 && rect.height === 0)) return false;
      var p = docCentre(rect), kk = fxKitOf(killerFaction), vk = fxKitOf(victimFaction), c = fxHexRgb(kk.col), vc = fxHexRgb(vk.col);
      var r = FX_KILL[tier] || FX_KILL.normal, i;
      shatter(rect, vc, { x: p.x + rand(-8, 8), y: p.y + rand(-8, 8) }, r.cols, r.rows);
      for (i = 0; i < r.cards; i++) spr(FX_SP.cards, mix(vc, WHITE, 0.3), p.x, p.y, { vx: rand(-260, 260), vy: rand(-320, -60), grav: 420, vr: rand(-8, 8), s0: rand(34, 52), life: rand(1, 1.5), fric: 0.95, fade: 'late' });
      sparks(p.x, p.y, c, r.sparks, 860, { life: 1.1 });
      sparks(p.x, p.y, vc, Math.round(r.sparks * 0.65), 680, { life: 1 });
      sparks(p.x, p.y, WHITE, Math.round(r.sparks * 0.3), 560, { life: 0.4, size: 1.7 });
      debris(p.x, p.y, kk, c, r.debris, 620, { linger: 0.4, max: 58 });
      debris(p.x, p.y, vk, vc, Math.round(r.debris * 0.7), 500, { linger: 0.5, max: 46 });
      shock(p.x, p.y, mix(c, WHITE, 0.3), r.shock, 0.5);
      shock(p.x, p.y, vc, r.shock * 1.6, 0.75, 1, 1, 0.09);
      flare(p.x, p.y, vc, r.shock * 1.25, 0.45);
      flare(p.x, p.y, c, r.shock * 0.9, 0.6);
      if (tier === 'spectacle') spr(FX_SP.flare, WHITE, p.x, p.y, { s0: 90, s1: 170, life: 0.16, rot: 0, a: 0.75 });
      smoke(p.x, p.y, vc, tier === 'spectacle' ? 7 : 3, Math.max(kk.smoke, 0.6), { sc: 1.25, rise: 1.6, delay: 0.25 });
      if (r.decal) {
        var ds = Math.max(rect.width, rect.height) * (tier === 'spectacle' ? 1.7 : 1.4);
        decal(p.x, p.y + 4, FX_SP.crater, c, ds, 5.5, 0.5);
        decal(p.x, p.y + 4, kk.decal, c, ds * 0.8, 5.5, 0.45);
      }
      flavor(kk, c, p.x, p.y, tier === 'spectacle' ? 2 : 1);
      if (tier !== 'subtle') { flavor(vk, vc, p.x, p.y, 1); embersRise(p.x, p.y, vc, tier === 'spectacle' ? 46 : 20, 70, 1.4); }
      ring(p.x, p.y, mix(c, WHITE, 0.3), r.ring, 0.52, 4);
      at(90, function () { ring(p.x, p.y, vc, r.ring * 1.5, 0.7, 2.5); });
      gridForce(p.x, p.y, r.grid, 230); gridTint(p.x, p.y, vc, 260);
      hitStop(r.hitStop); doFringe(r.fringe); doPunch(r.punch, p.x, p.y); doShake(r.shake, 320); doFlash(vc, r.flash);
      kick();
      return true;
    }

    // fadeOutIn(rect, ms): every particle reaching into a document rect (by
    // fxParticleReach, not only its centre) fades out
    // over ms (one not yet started there never starts). A victory boast
    // clears the loser's side with it, so the lethal attack's smoke and
    // scorch don't linger there under the boast (owner 2026-10-19).
    // countIn(rect): how many particles sit inside one, for the checks.
    function within(p, r) { var e = fxParticleReach(p); return p.x + e >= r.l && p.x - e <= r.r && p.y + e >= r.t && p.y - e <= r.b; }
    function fadeOutIn(r, ms) {
      var n = 0, life = Math.max(0.001, (ms || 0) / 1000);
      for (var i = P.length - 1; i >= 0; i--) {
        var p = P[i];
        if (!within(p, r)) continue;
        n++;
        if (p.age < 0) P.splice(i, 1);
        else if (!p.ko || p.ko - p.kt > life) { p.ko = life; p.kt = 0; }
      }
      kick();
      return n;
    }
    function countIn(r) { var n = 0; for (var i = 0; i < P.length; i++) if (within(P[i], r)) n++; return n; }

    function clear() { P.length = 0; proj.length = 0; rings.length = 0; beams.length = 0; timers.length = 0; resetCamera(); plugins.forEach(function (pl) { if (pl.clear) pl.clear(); }); }

    // ---- plug-ins (slice 6: render/src/wardFx.ts) ----
    // A plug-in is a layer with its own state that draws on the same two
    // canvases, inside the same frame: update(dt, raw) each frame (dt is 0
    // during hit-stop), drawFloor(ctx) under the cards after the ground
    // marks, drawTop(ctx) over the cards before rings, beams and
    // projectiles, alive() to keep the loop running, clear() on a jump,
    // and optionally hasTop() (false = nothing over the cards this frame).
    // Both contexts are already in document coordinates and 'lighter'.
    var plugins = [];
    function plug(pl) { plugins.push(pl); kick(); return pl; }
    function pluginsAlive() { for (var i = 0; i < plugins.length; i++) if (plugins[i].alive()) return true; return false; }

    // ---- the loop: runs only while something is alive, so an idle replay
    // costs nothing ----
    function alive() { return P.length || proj.length || rings.length || beams.length || timers.length || G.live || punch || shakeS || fringeT > 0 || flashS || camLive || pluginsAlive(); }
    function kick() { if (running || !ok) return; running = true; lastT = performance.now(); requestAnimationFrame(frame); }
    function frame(now) {
      var raw = Math.max(0, Math.min(0.05, (now - lastT) / 1000)); lastT = now;
      frames++; fpsAcc += raw; fpsN++; if (fpsAcc >= 1) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
      // Hit-stop: the particles hold still for a beat; timers, flights and
      // the page's timeline keep real time, so nothing lands late.
      var dt = raw;
      if (freeze > 0) { freeze -= raw; dt = 0; }
      for (var i = 0; i < timers.length; i++) if (timers[i].t <= now) { var tm = timers.splice(i, 1)[0]; i--; tm.fn(); }
      var c0 = performance.now();
      update(dt, raw, now);
      for (var pi = 0; pi < plugins.length; pi++) plugins[pi].update(dt, raw);
      camera(raw);
      var c1 = performance.now();
      gridUpdate(dt);
      var c2 = performance.now();
      draw();
      var c3 = performance.now();
      cost.update += c1 - c0; cost.grid += c2 - c1; cost.draw += c3 - c2; cost.n++;
      // (cost.draw includes drawing the grid onto the floor.)
      peak = Math.max(peak, P.length);
      if (alive()) requestAnimationFrame(frame);
      else { running = false; paintIdle(); }
    }
    function update(dt, raw, now) {
      var i, p;
      for (i = P.length - 1; i >= 0; i--) {
        p = P[i]; p.age += dt;
        if (p.age >= p.life) { P.splice(i, 1); continue; }
        if (p.ko) { p.kt += dt; if (p.kt >= p.ko) { P.splice(i, 1); continue; } }
        if (p.age < 0) continue;
        var f = Math.pow(p.fric, dt * 60);
        p.vx *= f; p.vy *= f; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
        if (p.jit && dt > 0 && Math.random() < 0.15) p.x += rand(-p.jit, p.jit);
      }
      for (i = proj.length - 1; i >= 0; i--) {
        var q = proj[i];
        if (now < q.t0) continue;
        var tt = Math.min(1, (now - q.t0) / q.ms);
        var pos = fxArcPoint(q.arc, q.ease === 'lin' ? tt : fxFlightEase(tt));
        // Null's stutter: the head jumps off the line, never off the target.
        if (q.kit.flavor === 'glitch' && tt < 0.95 && Math.random() < 0.3) { pos = { x: pos.x + rand(-5, 5), y: pos.y + rand(-5, 5) }; }
        if (raw > 0) { q.trail.push(pos); if (q.trail.length > q.trailLen) q.trail.shift(); q.n++; emitTrail(q, pos); }
        q.pos = pos;
        if (tt >= 1) { proj.splice(i, 1); if (q.onArrive) q.onArrive(q.arc.b); }
      }
      for (i = rings.length - 1; i >= 0; i--) { rings[i].t += dt / rings[i].dur; if (rings[i].t >= 1) rings.splice(i, 1); }
      for (i = beams.length - 1; i >= 0; i--) { beams[i].t += raw; if (beams[i].t >= beams[i].dur) beams.splice(i, 1); }
      if (flashS) { flashS.a -= raw * 2.6; if (flashS.a <= 0) flashS = null; }
    }
    function emitTrail(q, pos) {
      var kit = q.kit, c = q.c, tr = q.trail;
      var back = tr.length > 1 ? tr[tr.length - 2] : pos;
      var a = Math.atan2(pos.y - back.y, pos.x - back.x) + Math.PI;
      var big = q.size >= 5;
      if (q.n % q.trailEvery === 0) spr(kit.trail, c, pos.x + rand(-4, 4), pos.y + rand(-4, 4), { vx: Math.cos(a) * rand(20, 70) + rand(-20, 20), vy: Math.sin(a) * rand(20, 70) + rand(-20, 20), vr: rand(-4, 4), s0: rand(10, 18) * (big ? 1.4 : 1), s1: rand(4, 10), life: rand(0.35, 0.6), a: 0.9 });
      if (big && q.n % 3 === 0) spr(FX_SP.smokeTrail, c, pos.x, pos.y, { rot: a + Math.PI / 2, s0: 30, s1: 58, a: 0.16 * kit.smoke + 0.06, life: 0.6 });
      if (q.n % 2 === 0) sparks(pos.x, pos.y, c, 1, 90, { angle: a, spread: 0.45, life: 0.3 });
      if (kit.flavor === 'glitch' && Math.random() < 0.2) spr(FX_SP.glitch, c, pos.x + rand(-12, 12), pos.y, { s0: 24, life: 0.12, rot: 0, a: 0.8 });
      if (kit.flavor === 'molten' && q.n % 3 === 0) addP({ kind: 'ember', x: pos.x, y: pos.y, vx: rand(-20, 20), vy: rand(10, 60), life: 0.7, c: c, size: 2, fric: 0.96, grav: 200 });
    }
    function alphaOf(p) {
      var k = p.age / p.life, a = p.a;
      if (p.fade === 'out') a *= 1 - k;
      else if (p.fade === 'inout') a *= Math.min(1, k * 5) * (1 - k);
      else if (p.fade === 'late') a *= k < 0.65 ? 1 : (1 - k) / 0.35;
      else if (p.fade === 'in') a *= Math.min(1, k * 4);
      if (p.blink && Math.random() < p.blink) a *= 0.15;
      if (p.ko) a *= 1 - p.kt / p.ko;
      return Math.max(0, a);
    }
    function drawP(c, p) {
      if (p.age < 0) return;
      var a = alphaOf(p);
      if (a <= 0.003) return;
      var k = p.age / p.life;
      if (p.kind === 'spr') {
        var e = 1 - Math.pow(1 - k, 2), s = p.s0 + (p.s1 - p.s0) * e;
        if (s <= 0) return;
        c.globalAlpha = Math.min(1, a); c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        if (p.sx !== 1 || p.sy !== 1) c.scale(p.sx, p.sy);
        c.drawImage(tex(p.id, p.c), -s / 2, -s / 2, s, s); c.restore(); c.globalAlpha = 1;
        return;
      }
      if (p.kind === 'spark') {
        var sp = Math.hypot(p.vx, p.vy) || 1, L = Math.min(44, 3 + sp * 0.065), ux = p.vx / sp, uy = p.vy / sp;
        c.strokeStyle = rgba(p.c, a * 0.42); c.lineWidth = p.size * 4.2; c.beginPath(); c.moveTo(p.x - ux * L, p.y - uy * L); c.lineTo(p.x, p.y); c.stroke();
        c.strokeStyle = rgba(mix(p.c, WHITE, 0.55), a); c.lineWidth = p.size * 1.25; c.beginPath(); c.moveTo(p.x - ux * L, p.y - uy * L); c.lineTo(p.x, p.y); c.stroke();
        return;
      }
      if (p.kind === 'square') { var q = p.size * 3; c.fillStyle = rgba(p.c, a * 0.3); c.fillRect(p.x - q, p.y - q, q * 2, q * 2); c.fillStyle = rgba(mix(p.c, WHITE, 0.5), a); c.fillRect(p.x - q / 2, p.y - q / 2, q, q); return; }
      if (p.kind === 'ember') { drawGlow(c, p.x, p.y, p.size * 3, p.c, a * 0.8); drawGlow(c, p.x, p.y, p.size * 0.9, WHITE, a * 0.6); return; }
      if (p.kind === 'mote') { drawGlow(c, p.x, p.y, p.size * 4, p.c, a); drawGlow(c, p.x, p.y, p.size, WHITE, a * 0.7); return; }
      if (p.kind === 'shard') {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); c.moveTo(p.pts[0], p.pts[1]); c.lineTo(p.pts[2], p.pts[3]); c.lineTo(p.pts[4], p.pts[5]); c.closePath();
        c.fillStyle = rgba(p.c, a * 0.45); c.fill(); c.strokeStyle = rgba(mix(p.c, WHITE, 0.6), a); c.lineWidth = 1.2; c.stroke(); c.restore();
        return;
      }
      if (p.kind === 'bloom') { var b = Math.pow(1 - k, 2); drawGlow(c, p.x, p.y, p.r * (0.7 + 0.5 * k), p.c, b * 0.75); drawGlow(c, p.x, p.y, p.r * 0.25, WHITE, b * 0.5); }
    }
    // Whether anything will be drawn over the cards this frame. A resting
    // Mythic ward keeps the loop alive (slice 6) but draws only on the
    // floor, so the top canvas is left untouched (not even cleared) until
    // something needs it, and the browser doesn't repaint it every frame.
    var topWasDrawn = true;
    function topBusy() {
      if (rings.length || beams.length || proj.length || flashS) return true;
      for (var q = 0; q < P.length; q++) if (P[q].layer !== 0) return true;
      for (q = 0; q < plugins.length; q++) if (!plugins[q].hasTop || plugins[q].hasTop()) return true;
      return false;
    }
    function draw() {
      var sx = window.scrollX, sy = window.scrollY;
      flc.setTransform(1, 0, 0, 1, 0, 0); flc.clearRect(0, 0, floorC.width, floorC.height);
      gridDraw(flc);
      flc.setTransform(DPR, 0, 0, DPR, -sx * DPR, -sy * DPR);
      var busy = topBusy();
      if (busy || topWasDrawn) { fxc.setTransform(DPR, 0, 0, DPR, -sx * DPR, -sy * DPR); fxc.clearRect(sx, sy, VW, VH); }
      topWasDrawn = busy;
      flc.globalCompositeOperation = 'lighter';
      var i;
      for (i = 0; i < P.length; i++) if (P[i].layer === 0) drawP(flc, P[i]);
      for (i = 0; i < plugins.length; i++) plugins[i].drawFloor(flc);
      flc.globalCompositeOperation = 'source-over';
      if (!busy) return;
      var c = fxc;
      c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
      for (i = 0; i < plugins.length; i++) plugins[i].drawTop(c);
      for (i = 0; i < rings.length; i++) {
        var r = rings[i], e = 1 - Math.pow(1 - r.t, 3), rad = r.maxR * e, ra = 1 - r.t;
        c.save(); c.translate(r.x, r.y - r.dy * e); c.scale(1, r.squash);
        c.strokeStyle = rgba(r.c, ra * 0.28); c.lineWidth = r.w * 3.5 / r.squash; c.beginPath(); c.arc(0, 0, rad, 0, 6.283); c.stroke();
        c.strokeStyle = rgba(mix(r.c, WHITE, 0.5), ra); c.lineWidth = r.w / r.squash; c.beginPath(); c.arc(0, 0, rad, 0, 6.283); c.stroke();
        c.restore();
      }
      for (i = 0; i < beams.length; i++) {
        var bm = beams[i], ba = 1 - bm.t / bm.dur, jx = rand(-2, 2), jy = rand(-2, 2), bw = bm.w || 1;
        c.strokeStyle = rgba(bm.c, ba * 0.3); c.lineWidth = 16 * bw; c.beginPath(); c.moveTo(bm.from.x, bm.from.y); c.lineTo(bm.to.x + jx, bm.to.y + jy); c.stroke();
        c.strokeStyle = rgba(mix(bm.c, WHITE, 0.5), ba); c.lineWidth = 4 * bw; c.beginPath(); c.moveTo(bm.from.x, bm.from.y); c.lineTo(bm.to.x + jx, bm.to.y + jy); c.stroke();
        c.strokeStyle = rgba(WHITE, ba); c.lineWidth = 1.4 * bw; c.beginPath(); c.moveTo(bm.from.x, bm.from.y); c.lineTo(bm.to.x, bm.to.y); c.stroke();
      }
      for (i = 0; i < proj.length; i++) {
        var q = proj[i], tr = q.trail, n = tr.length, sz = q.size, col = q.c, j, f;
        for (j = 1; j < n; j += 2) { f = j / n; drawGlow(c, tr[j].x, tr[j].y, sz * 4.5 * f + 2, col, f * 0.3); }
        for (j = 1; j < n; j++) { f = j / n; c.strokeStyle = rgba(col, f * 0.36); c.lineWidth = sz * 4 * f; c.beginPath(); c.moveTo(tr[j - 1].x, tr[j - 1].y); c.lineTo(tr[j].x, tr[j].y); c.stroke(); }
        for (j = 1; j < n; j++) { f = j / n; c.strokeStyle = rgba(mix(col, WHITE, 0.45), f); c.lineWidth = Math.max(0.6, sz * 0.9 * f); c.beginPath(); c.moveTo(tr[j - 1].x, tr[j - 1].y); c.lineTo(tr[j].x, tr[j].y); c.stroke(); }
        var h = q.pos;
        if (!h) continue;
        drawGlow(c, h.x, h.y, sz * 9, col, 0.9);
        var hs = sz * q.headScale;
        c.save(); c.translate(h.x, h.y); c.rotate(q.n * 0.15); c.drawImage(tex(q.head, col), -hs / 2, -hs / 2, hs, hs); c.restore();
        drawGlow(c, h.x, h.y, sz * 2.4, WHITE, 1);
      }
      for (i = 0; i < P.length; i++) if (P[i].layer !== 0) drawP(c, P[i]);
      if (flashS) { c.setTransform(DPR, 0, 0, DPR, 0, 0); c.fillStyle = rgba(flashS.c, flashS.a * 0.13); c.fillRect(0, 0, VW, VH); }
      c.globalCompositeOperation = 'source-over';
    }

    size();
    var api = { travel: travel, impact: impact, effect: effect, kill: kill, clear: clear, plug: plug, fadeOutIn: fadeOutIn, countIn: countIn,
      // What a plug-in may draw with: the same glow, rings, shockwaves,
      // sprites, sparks and grid pushes the effects use.
      kit: { ok: ok, reduced: REDUCED, dpr: DPR, drawGlow: drawGlow, tex: tex, ring: ring, shock: shock, flare: flare, spr: spr, sparks: sparks,
        gridForce: gridForce, gridTint: gridTint, rand: rand, mix: mix, rgba: rgba, kick: kick, docCentre: docCentre },
      isReady: function () { return ready && !failed; },
      stats: function () { return { ready: ready && !failed, particles: P.length, projectiles: proj.length, beams: beams.length, timers: timers.length, frames: frames, peak: peak, fps: fps, tinted: Object.keys(tcache).length, gridLive: G.live, camera: camLive, reduced: REDUCED,
        msPerFrame: cost.n ? { update: +(cost.update / cost.n).toFixed(2), grid: +(cost.grid / cost.n).toFixed(2), draw: +(cost.draw / cost.n).toFixed(2) } : null }; } };
    window.__cfx = api;
    return api;
  })();
`;

const pure = new Function(
  `${CANVAS_FX_PURE_SOURCE}; return { FX_SP: FX_SP, FX_KITS: FX_KITS, FX_TRAVEL: FX_TRAVEL, FX_IMPACT: FX_IMPACT, FX_KILL: FX_KILL, FX_CATEGORIES: FX_CATEGORIES, FX_SPELL_SHOTS: FX_SPELL_SHOTS, fxKitOf: fxKitOf, fxRgbOf: fxRgbOf, fxVariant: fxVariant, fxTintPixels: fxTintPixels, fxTravelRecipe: fxTravelRecipe, fxImpactRecipe: fxImpactRecipe, fxDecalCover: fxDecalCover, fxFlightEase: fxFlightEase, fxArcPoint: fxArcPoint, fxParticleReach: fxParticleReach, fxShotCount: fxShotCount, fxVolleySchedule: fxVolleySchedule, fxCurve: fxCurve };`,
)() as {
  FX_SP: Record<string, number>;
  FX_KITS: Record<string, FxKit>;
  FX_TRAVEL: Record<FxTier, TravelRecipe>;
  FX_IMPACT: Record<FxTier, Record<string, number>>;
  FX_KILL: Record<FxTier, Record<string, number>>;
  FX_CATEGORIES: FxCategory[];
  FX_SPELL_SHOTS: Record<string, number>;
  fxVariant: (faction: string | null | undefined, category: FxCategory) => string;
  fxShotCount: (variant: string, tier: FxTier) => number;
  fxVolleySchedule: (variant: string, n: number, ms: number) => { at: number; dur: number }[];
  fxCurve: (a: { x: number; y: number }, b: { x: number; y: number }, bend: number, side: number, lob?: number) => Arc;
  fxKitOf: (faction: string | null | undefined) => FxKit;
  fxRgbOf: (faction: string | null | undefined) => [number, number, number];
  fxTintPixels: (p: Uint8ClampedArray, c: [number, number, number]) => Uint8ClampedArray;
  fxTravelRecipe: (tier: FxTier, small: boolean) => TravelRecipe;
  fxImpactRecipe: (tier: FxTier, targetKind: "unit" | "player") => ImpactRecipe;
  fxFlightEase: (t: number) => number;
  fxDecalCover: (tier: FxTier) => number;
  fxArcPoint: (arc: Arc, t: number) => { x: number; y: number };
  fxParticleReach: (p: { kind: string; s0?: number; s1?: number; sx?: number; sy?: number; size?: number; pts?: number[]; r?: number }) => number;
};

export interface FxKit {
  col: string;
  debris: number[];
  trail: number;
  head: number;
  decal: number;
  smoke: number;
  flavor: "arc" | "molten" | "spore" | "glitch" | "glint";
  spell: string;
  removal: string;
  heal: string;
  buff: string;
  debuff: string;
}
export type FxCategory = "spell" | "removal" | "heal" | "buff" | "debuff";
export interface TravelRecipe { size: number; trailLen: number; headScale: number; trailEvery: number }
export interface ImpactRecipe {
  sparks: number; white: number; speed: number; debris: number; linger: number; shock: number; flare: number;
  decal: number; decalLife: number; smoke: number; flavor: number; ring: number; shockSx: number; shockSy: number;
  grid: number; hitStop: number; punch: number; shake: number;
}
export interface Arc { a: { x: number; y: number }; c: { x: number; y: number }; b: { x: number; y: number } }

export const FX_SP = pure.FX_SP;
export const FX_KITS = pure.FX_KITS;
export const FX_TRAVEL = pure.FX_TRAVEL;
export const FX_IMPACT = pure.FX_IMPACT;
export const FX_KILL = pure.FX_KILL;
export const FX_CATEGORIES = pure.FX_CATEGORIES;
export const FX_SPELL_SHOTS = pure.FX_SPELL_SHOTS;
/** The faction's material variant for a slice-2 category (EFFECTS.md table). */
export const fxVariant = pure.fxVariant;
export const fxShotCount = pure.fxShotCount;
/** Launch time + flight time of each shot in a spell volley; the last lands exactly at ms. */
export const fxVolleySchedule = pure.fxVolleySchedule;
export const fxCurve = pure.fxCurve;
export const fxKitOf = pure.fxKitOf;
export const fxRgbOf = pure.fxRgbOf;
/** In-place tint of RGBA pixels from a greyscale-on-black atlas cell. */
export const fxTintPixels = pure.fxTintPixels;
export const fxTravelRecipe = pure.fxTravelRecipe;
export const fxImpactRecipe = pure.fxImpactRecipe;
export const fxFlightEase = pure.fxFlightEase;
/** How far past a hit card's larger side its floor mark reaches (0 = none). */
export const fxDecalCover = pure.fxDecalCover;
export const fxArcPoint = pure.fxArcPoint;
export const fxParticleReach = pure.fxParticleReach;

const ASSET_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/fx");
export const FX_ATLAS_FILES = ["atlas-a.webp", "atlas-b.webp", "atlas-c.webp"] as const;
let atlasCache: string[] | null = null;
/** The three committed atlases as data URIs, read once per process. */
export function fxAtlasDataUris(): string[] {
  if (!atlasCache) {
    atlasCache = FX_ATLAS_FILES.map((f) => `data:image/webp;base64,${readFileSync(resolve(ASSET_DIR, f)).toString("base64")}`);
  }
  return atlasCache;
}
