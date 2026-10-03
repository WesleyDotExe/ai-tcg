// EFFECTS.md v2, slice 1 — the canvas FX layer, the floor layer, the sprite
// atlases with their tint cache, and attack travel + impact ported to sprite
// materials (owner-directed 2026-10-03; working reference:
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
//     the cards (ground marks — scorch, goo, rift, rune, circuit trace — and
//     debris that settles on the table, then fades).
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
  // orange, owner 2026-10-02). The kit is the lab's K block, cut to what
  // travel + impact use; slice 2 adds the spell/removal/heal/buff/debuff
  // variants to the same rows.
  var FX_KITS = {
    Cortex:  { col: '#35c9ff', debris: [FX_SP.pixels, FX_SP.shard, FX_SP.cube, FX_SP.circuit],
               trail: FX_SP.pixels, head: FX_SP.shard, decal: FX_SP.circuit, smoke: 0.35, flavor: 'arc' },
    Aegis:   { col: '#ff7d24', debris: [FX_SP.shrapnel, FX_SP.hexPlate, FX_SP.crackedHex, FX_SP.molten],
               trail: FX_SP.embers, head: FX_SP.molten, decal: FX_SP.scorch, smoke: 1.1, flavor: 'molten' },
    Swarm:   { col: '#8bff5c', debris: [FX_SP.chitin, FX_SP.wing, FX_SP.claw, FX_SP.spores],
               trail: FX_SP.spores, head: FX_SP.spores, decal: FX_SP.goo, smoke: 0.5, flavor: 'spore' },
    Null:    { col: '#d565ff', debris: [FX_SP.glitch, FX_SP.glass, FX_SP.pixels, FX_SP.glass],
               trail: FX_SP.glitch, head: FX_SP.darkStar, decal: FX_SP.rift, smoke: 0.7, flavor: 'glitch' },
    Neutral: { col: '#ffcf5c', debris: [FX_SP.glint, FX_SP.dust, FX_SP.feather, FX_SP.glint],
               trail: FX_SP.dust, head: FX_SP.glint, decal: FX_SP.rune, smoke: 0.3, flavor: 'glint' }
  };
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
  var FX_IMPACT = {
    subtle:    { sparks: 12, white: 4,  speed: 260, debris: 4,  linger: 0.15, shock: 34,  flare: 60,  decal: 0,   decalLife: 0,   smoke: 0, flavor: 0, ring: 26 },
    normal:    { sparks: 30, white: 10, speed: 400, debris: 10, linger: 0.3,  shock: 56,  flare: 100, decal: 76,  decalLife: 3.5, smoke: 2, flavor: 1, ring: 40 },
    spectacle: { sparks: 70, white: 24, speed: 620, debris: 22, linger: 0.35, shock: 120, flare: 190, decal: 130, decalLife: 5,   smoke: 4, flavor: 2, ring: 70 }
  };
  // How far past a hit card's larger side its ground mark reaches.
  function fxDecalCover(tier) { return tier === 'spectacle' ? 1.6 : tier === 'normal' ? 1.3 : 0; }
  function fxTravelRecipe(tier, small) {
    var r = FX_TRAVEL[tier] || FX_TRAVEL.normal;
    if (!small) return r;
    return { size: r.size * 0.7, trailLen: Math.round(r.trailLen * 0.7), headScale: r.headScale, trailEvery: 2 };
  }
  // A hit on a player (their avatar) is wider and flatter than a hit on a
  // card: the lab's impactFace squashes the shockwave across the HUD.
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
`;

export const CANVAS_FX_RUNTIME_SOURCE = String.raw`
  var CFX = (function () {
    var DPR = Math.min(2, window.devicePixelRatio || 1);
    // Loop state first: size() below may kick the loop during setup.
    var running = false, lastT = 0, frames = 0, peak = 0, fpsAcc = 0, fpsN = 0, fps = 0;
    var floorC = document.createElement('canvas');
    floorC.className = 'fx-canvas fx-floor';
    floorC.setAttribute('aria-hidden', 'true');
    var fxC = document.createElement('canvas');
    fxC.className = 'fx-canvas fx-top';
    fxC.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(floorC, document.body.firstChild);
    document.body.appendChild(fxC);
    var flc = floorC.getContext('2d'), fxc = fxC.getContext('2d');
    var ok = !!(flc && fxc);
    var VW = 0, VH = 0;
    function size() {
      VW = window.innerWidth; VH = window.innerHeight;
      [floorC, fxC].forEach(function (c) { c.width = Math.round(VW * DPR); c.height = Math.round(VH * DPR); c.style.width = VW + 'px'; c.style.height = VH + 'px'; });
      if (ok) kick();
    }
    window.addEventListener('resize', size);
    size();

    function rand(a, b) { return a + Math.random() * (b - a); }
    function pick(a) { return a[(Math.random() * a.length) | 0]; }
    function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
    var WHITE = [255, 255, 255];

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
    // a kit or an impact can ask for, in every faction colour and white.
    function prewarm() {
      var ids = [FX_SP.shock, FX_SP.flare, FX_SP.smoke, FX_SP.smokeTrail, FX_SP.arc, FX_SP.molten, FX_SP.spores, FX_SP.goo, FX_SP.glitch, FX_SP.darkStar, FX_SP.glint, FX_SP.rays];
      var jobs = [];
      Object.keys(FX_KITS).forEach(function (f) {
        var k = FX_KITS[f], c = fxHexRgb(k.col);
        var mine = ids.concat(k.debris, [k.trail, k.head, k.decal]);
        mine.forEach(function (id) { jobs.push([id, c]); });
      });
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
    var P = [], proj = [], rings = [], MAXP = 1600;
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
    function smoke(x, y, c, n, str) {
      for (var i = 0; i < n; i++) spr(FX_SP.smoke, c, x + rand(-22, 22), y + rand(-16, 16), { vx: rand(-20, 20), vy: rand(-46, -10), s0: rand(40, 60), s1: rand(110, 160), a: 0.2 * str, life: rand(1.4, 2.4), fade: 'inout', vr: rand(-0.5, 0.5) });
    }
    function shock(x, y, c, R, life, sx, sy) { spr(FX_SP.shock, c, x, y, { s0: R * 0.25, s1: R * 2.1, life: life, fade: 'out', sx: sx || 1, sy: sy || 1 }); }
    function flare(x, y, c, s, life) { spr(FX_SP.flare, c, x, y, { s0: s * 0.7, s1: s * 1.1, life: life, rot: 0 }); addP({ kind: 'bloom', x: x, y: y, c: c, r: s * 0.6, life: life, vx: 0, vy: 0, fric: 1, grav: 0 }); }
    function decal(x, y, id, c, s, life, a) { spr(id, c, x, y, { s0: s * 0.8, s1: s, life: life, fade: 'late', a: a, layer: 0 }); }
    function ring(x, y, c, maxR, dur, w) { rings.push({ x: x, y: y, c: c, maxR: maxR, t: 0, dur: dur, w: w }); }
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

    function docCentre(rect) { return { x: rect.left + rect.width / 2 + window.scrollX, y: rect.top + rect.height / 2 + window.scrollY }; }

    // travel(from, to): the head and its trail follow the aim line's arc and
    // arrive exactly at 'ms' (clocked on performance.now, the same clock the
    // caller's later() timers run on).
    function travel(fromRect, toRect, faction, tier, ms, small) {
      if (!ready || failed || !fromRect || !toRect) return false;
      var a = docCentre(fromRect), b = docCentre(toRect);
      var arc = arcBetween(a, b);
      var kit = fxKitOf(faction);
      proj.push({ arc: arc, kit: kit, c: fxHexRgb(kit.col), r: fxTravelRecipe(tier, small), t0: performance.now(), ms: Math.max(40, ms), trail: [], n: 0 });
      // The lab's chargeUp: a small ring and a puff of trail material on the
      // attacker as it commits.
      ring(a.x, a.y, fxHexRgb(kit.col), small ? 30 : 44, 0.26, 2);
      spr(kit.trail, fxHexRgb(kit.col), a.x, a.y, { s0: 20, s1: small ? 44 : 64, life: 0.3, a: 0.7 });
      kick();
      return true;
    }

    // impact(target): sparks, debris in the faction's material, a shockwave
    // and flare, a ground mark on the floor layer, the faction's flavour.
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
      // stands in its scorch / goo / rift); a player's HUD panel is opaque,
      // so a face hit leaves no mark (the flare and shock carry it).
      if (r.decal > 0 && targetKind !== 'player') {
        var ds = Math.max(r.decal, Math.max(rect.width, rect.height) * fxDecalCover(tier));
        decal(p.x, p.y + 6, kit.decal, c, ds, r.decalLife, 0.42);
      }
      if (r.smoke > 0) smoke(p.x, p.y, c, r.smoke, kit.smoke);
      if (r.flavor > 0) flavor(kit, c, p.x, p.y, r.flavor);
      kick();
      return true;
    }

    function clear() { P.length = 0; proj.length = 0; rings.length = 0; }

    // ---- the loop: runs only while something is alive, so an idle replay
    // costs nothing ----
    function kick() { if (running || !ok) return; running = true; lastT = performance.now(); requestAnimationFrame(frame); }
    function frame(now) {
      var raw = Math.max(0, Math.min(0.05, (now - lastT) / 1000)); lastT = now;
      frames++; fpsAcc += raw; fpsN++; if (fpsAcc >= 1) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
      update(raw, now);
      draw();
      peak = Math.max(peak, P.length);
      if (P.length || proj.length || rings.length) requestAnimationFrame(frame);
      else { running = false; flc.setTransform(1, 0, 0, 1, 0, 0); flc.clearRect(0, 0, floorC.width, floorC.height); fxc.setTransform(1, 0, 0, 1, 0, 0); fxc.clearRect(0, 0, fxC.width, fxC.height); }
    }
    function update(dt, now) {
      var i, p;
      for (i = P.length - 1; i >= 0; i--) {
        p = P[i]; p.age += dt;
        if (p.age >= p.life) { P.splice(i, 1); continue; }
        if (p.age < 0) continue;
        var f = Math.pow(p.fric, dt * 60);
        p.vx *= f; p.vy *= f; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
        if (p.jit && Math.random() < 0.15) p.x += rand(-p.jit, p.jit);
      }
      for (i = proj.length - 1; i >= 0; i--) {
        var q = proj[i];
        var tt = Math.min(1, (now - q.t0) / q.ms);
        var pos = fxArcPoint(q.arc, fxFlightEase(tt));
        // Null's stutter: the head jumps off the line, never off the target.
        if (q.kit.flavor === 'glitch' && tt < 0.95 && Math.random() < 0.3) { pos = { x: pos.x + rand(-5, 5), y: pos.y + rand(-5, 5) }; }
        if (dt > 0) { q.trail.push(pos); if (q.trail.length > q.r.trailLen) q.trail.shift(); q.n++; emitTrail(q, pos); }
        q.pos = pos;
        if (tt >= 1) proj.splice(i, 1);
      }
      for (i = rings.length - 1; i >= 0; i--) { rings[i].t += dt / rings[i].dur; if (rings[i].t >= 1) rings.splice(i, 1); }
    }
    function emitTrail(q, pos) {
      var kit = q.kit, c = q.c, tr = q.trail;
      var back = tr.length > 1 ? tr[tr.length - 2] : pos;
      var a = Math.atan2(pos.y - back.y, pos.x - back.x) + Math.PI;
      var big = q.r.size >= 5;
      if (q.n % q.r.trailEvery === 0) spr(kit.trail, c, pos.x + rand(-4, 4), pos.y + rand(-4, 4), { vx: Math.cos(a) * rand(20, 70) + rand(-20, 20), vy: Math.sin(a) * rand(20, 70) + rand(-20, 20), vr: rand(-4, 4), s0: rand(10, 18) * (big ? 1.4 : 1), s1: rand(4, 10), life: rand(0.35, 0.6), a: 0.9 });
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
      if (p.blink && Math.random() < p.blink) a *= 0.15;
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
      if (p.kind === 'bloom') { var b = Math.pow(1 - k, 2); drawGlow(c, p.x, p.y, p.r * (0.7 + 0.5 * k), p.c, b * 0.75); drawGlow(c, p.x, p.y, p.r * 0.25, WHITE, b * 0.5); }
    }
    function draw() {
      var sx = window.scrollX, sy = window.scrollY;
      flc.setTransform(DPR, 0, 0, DPR, -sx * DPR, -sy * DPR); flc.clearRect(sx, sy, VW, VH);
      fxc.setTransform(DPR, 0, 0, DPR, -sx * DPR, -sy * DPR); fxc.clearRect(sx, sy, VW, VH);
      flc.globalCompositeOperation = 'lighter';
      var i;
      for (i = 0; i < P.length; i++) if (P[i].layer === 0) drawP(flc, P[i]);
      flc.globalCompositeOperation = 'source-over';
      var c = fxc;
      c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
      for (i = 0; i < rings.length; i++) {
        var r = rings[i], e = 1 - Math.pow(1 - r.t, 3), rad = r.maxR * e, ra = 1 - r.t;
        c.strokeStyle = rgba(r.c, ra * 0.28); c.lineWidth = r.w * 3.5; c.beginPath(); c.arc(r.x, r.y, rad, 0, 6.283); c.stroke();
        c.strokeStyle = rgba(mix(r.c, WHITE, 0.5), ra); c.lineWidth = r.w; c.beginPath(); c.arc(r.x, r.y, rad, 0, 6.283); c.stroke();
      }
      for (i = 0; i < proj.length; i++) {
        var q = proj[i], tr = q.trail, n = tr.length, sz = q.r.size, col = q.c, j, f;
        for (j = 1; j < n; j += 2) { f = j / n; drawGlow(c, tr[j].x, tr[j].y, sz * 4.5 * f + 2, col, f * 0.3); }
        for (j = 1; j < n; j++) { f = j / n; c.strokeStyle = rgba(col, f * 0.36); c.lineWidth = sz * 4 * f; c.beginPath(); c.moveTo(tr[j - 1].x, tr[j - 1].y); c.lineTo(tr[j].x, tr[j].y); c.stroke(); }
        for (j = 1; j < n; j++) { f = j / n; c.strokeStyle = rgba(mix(col, WHITE, 0.45), f); c.lineWidth = Math.max(0.6, sz * 0.9 * f); c.beginPath(); c.moveTo(tr[j - 1].x, tr[j - 1].y); c.lineTo(tr[j].x, tr[j].y); c.stroke(); }
        var h = q.pos;
        if (!h) continue;
        drawGlow(c, h.x, h.y, sz * 9, col, 0.9);
        var hs = sz * q.r.headScale;
        c.save(); c.translate(h.x, h.y); c.rotate(q.n * 0.15); c.drawImage(tex(q.kit.head, col), -hs / 2, -hs / 2, hs, hs); c.restore();
        drawGlow(c, h.x, h.y, sz * 2.4, WHITE, 1);
      }
      for (i = 0; i < P.length; i++) if (P[i].layer !== 0) drawP(c, P[i]);
      c.globalCompositeOperation = 'source-over';
    }

    var api = { travel: travel, impact: impact, clear: clear,
      isReady: function () { return ready && !failed; },
      stats: function () { return { ready: ready && !failed, particles: P.length, projectiles: proj.length, frames: frames, peak: peak, fps: fps, tinted: Object.keys(tcache).length }; } };
    window.__cfx = api;
    return api;
  })();
`;

const pure = new Function(
  `${CANVAS_FX_PURE_SOURCE}; return { FX_SP: FX_SP, FX_KITS: FX_KITS, FX_TRAVEL: FX_TRAVEL, FX_IMPACT: FX_IMPACT, fxKitOf: fxKitOf, fxRgbOf: fxRgbOf, fxTintPixels: fxTintPixels, fxTravelRecipe: fxTravelRecipe, fxImpactRecipe: fxImpactRecipe, fxDecalCover: fxDecalCover, fxFlightEase: fxFlightEase, fxArcPoint: fxArcPoint };`,
)() as {
  FX_SP: Record<string, number>;
  FX_KITS: Record<string, FxKit>;
  FX_TRAVEL: Record<FxTier, TravelRecipe>;
  FX_IMPACT: Record<FxTier, Record<string, number>>;
  fxKitOf: (faction: string | null | undefined) => FxKit;
  fxRgbOf: (faction: string | null | undefined) => [number, number, number];
  fxTintPixels: (p: Uint8ClampedArray, c: [number, number, number]) => Uint8ClampedArray;
  fxTravelRecipe: (tier: FxTier, small: boolean) => TravelRecipe;
  fxImpactRecipe: (tier: FxTier, targetKind: "unit" | "player") => ImpactRecipe;
  fxFlightEase: (t: number) => number;
  fxDecalCover: (tier: FxTier) => number;
  fxArcPoint: (arc: Arc, t: number) => { x: number; y: number };
};

export interface FxKit {
  col: string;
  debris: number[];
  trail: number;
  head: number;
  decal: number;
  smoke: number;
  flavor: "arc" | "molten" | "spore" | "glitch" | "glint";
}
export interface TravelRecipe { size: number; trailLen: number; headScale: number; trailEvery: number }
export interface ImpactRecipe {
  sparks: number; white: number; speed: number; debris: number; linger: number; shock: number; flare: number;
  decal: number; decalLife: number; smoke: number; flavor: number; ring: number; shockSx: number; shockSy: number;
}
export interface Arc { a: { x: number; y: number }; c: { x: number; y: number }; b: { x: number; y: number } }

export const FX_SP = pure.FX_SP;
export const FX_KITS = pure.FX_KITS;
export const FX_TRAVEL = pure.FX_TRAVEL;
export const FX_IMPACT = pure.FX_IMPACT;
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
