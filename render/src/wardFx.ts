// EFFECTS.md v2, slice 6 — Mythic unique wards in the replays.
//
// Every Mythic on the board carries its own one-of-a-kind ward (the 2x2
// sheet the mythic-wards action made for it: outer / middle / core /
// ornament), counter-rotating, for as long as the card is on the board.
// Owner 2026-10-11: the ward sits BEHIND the card.
//   - Arrival: the ward draws itself in on top of the card, holds there for
//     a few seconds (WARD_T.onTop), then crossfades behind it (WARD_T.sink).
//   - After that it stays behind: it is drawn on the floor canvas, under the
//     DOM cards, so the card art, name and stats stay fully visible and only
//     the parts that reach past the card's edges show. The core sits inside
//     the card's outline and is hidden. To keep a Mythic standing out the
//     outer layers are brightened and slightly enlarged while behind
//     (WARD_BEHIND).
//   - Its live behaviour (seats, aura, heartbeat, gravity) and any flare for
//     a signature move play behind the card too.
//   - Death: the ward shatters into spinning pieces, over the board.
//
// Meaning stays constant (EFFECTS.md): the ward only says "this is a Mythic,
// and this is what it does"; the behaviour is read from mythics.json, never
// from the card's name in code.
//
// Same single-source rule as the other FX modules: the page embeds
// WARD_FX_PURE_SOURCE and WARD_FX_RUNTIME_SOURCE verbatim and Node evaluates
// the pure half, so test/wardFx.test.ts runs exactly what the page runs. The
// runtime needs a DOM and a 2D canvas, so it is proven in a real browser
// (progress/render/evidence/).
//
// Self-contained (owner 2026-09-30): only the ward sheets of Mythics that
// actually reach the board in this replay are embedded, as data URIs.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MatchReplay } from "./types.js";

export const WARD_FX_PURE_SOURCE = String.raw`
  // The unique ward's three drawn layers (cell index in the 2x2 sheet,
  // radius as a share of R, spin in rad/s): outer and core turn one way,
  // the middle the other. Cell 3 is the ornament (seats, crests, larvae,
  // pointers). Lab: LAYERS.unique.
  var WARD_LAYERS = [{ i: 0, r: 1, spd: 0.05 }, { i: 1, r: 0.74, spd: -0.09 }, { i: 2, r: 0.37, spd: 0.14 }];
  // R per pixel of card height (the lab's R 122 on a 123 px card).
  var WARD_R_PER_CARD_H = 0.98;
  // Seconds. drawIn: the ring sweeps in. onTop: how long an arriving ward
  // stays over the card before it starts to sink (owner 2026-10-11: "after
  // a few seconds"). sink: the crossfade from over to behind. pulse: a
  // signature-move flare. waitMax: a ward created for an arrival that never
  // gets its cue still shows after this long.
  var WARD_T = { drawIn: 0.45, onTop: 2.6, sink: 0.8, pulse: 1.0, waitMax: 4 };
  // Behind the card (owner 2026-10-11: the render may enlarge or brighten
  // the outer layers so a Mythic still stands out). alpha is the resting
  // opacity behind (the lab's over-the-card rest was 0.52); boost and scale
  // are per layer (outer, middle, core). The core stays as it was: it is
  // hidden by the card anyway.
  var WARD_BEHIND = { alpha: 0.82, boost: [1.45, 1.3, 1], scale: [1.16, 1.08, 1] };
  var WARD_BEHAVIOURS = ['seats', 'aura', 'heartbeat', 'gravity'];

  function wardRadius(cardH) { return (cardH > 0 ? cardH : 158) * WARD_R_PER_CARD_H; }
  function wardEase(k) { k = k < 0 ? 0 : k > 1 ? 1 : k; return k * k * (3 - 2 * k); }
  // Hive Mother's heartbeat: a strong beat and a softer echo, every 1.7 s.
  function wardBeat(t) {
    var p = t % 1.7;
    function b(q) { return Math.exp(-Math.pow((p - q) / 0.06, 2)); }
    return b(0) + 0.6 * b(0.22);
  }
  // How much of the ward is drawn over the card (top) and how much behind
  // it (under); the two always sum to 1 once it is visible. Only an
  // arrival is ever on top.
  function wardLayering(mode, mt) {
    if (mode === 'wait') return { top: 0, under: 0 };
    if (mode === 'manifest') {
      if (mt < WARD_T.onTop) return { top: 1, under: 0 };
      var k = wardEase((mt - WARD_T.onTop) / WARD_T.sink);
      return { top: 1 - k, under: k };
    }
    return { top: 0, under: 1 };
  }
  // Opacity and scale of the ward's two copies at this moment (lab:
  // wardState). t is the ward's own clock, mt the time in its mode.
  function wardLook(mode, mt, t, beh) {
    var hold = 0.82 * (0.9 + 0.1 * Math.sin(t * 3));
    var beat = beh === 'heartbeat' ? wardBeat(t) : 0;
    var rest = { a: WARD_BEHIND.alpha * (0.88 + 0.12 * Math.sin(t * 1.7)) + beat * 0.25, s: 1 + beat * 0.035 };
    var reveal = mode === 'manifest' ? Math.min(1, mt / WARD_T.drawIn) : mode === 'wait' ? 0 : 1;
    var top = null, under = rest;
    if (mode === 'manifest') {
      var e = 1 - Math.pow(1 - Math.min(1, mt / WARD_T.drawIn), 3);
      top = { a: mt < 0.55 ? 1 : hold, s: 1.25 - 0.25 * e };
    } else if (mode === 'pulse') {
      var k = Math.min(1, mt / WARD_T.pulse);
      under = { a: rest.a + (1 - rest.a) * (1 - k), s: rest.s + 0.18 * Math.sin(Math.PI * Math.min(1, mt / 0.45)) };
    }
    return { top: top, under: under, reveal: reveal };
  }
  // Mode after dt more seconds in it (the runtime's state machine).
  function wardNextMode(mode, mt) {
    if (mode === 'manifest' && mt >= WARD_T.onTop + WARD_T.sink) return 'perm';
    if (mode === 'pulse' && mt >= WARD_T.pulse) return 'perm';
    if (mode === 'wait' && mt >= WARD_T.waitMax) return 'perm';
    return mode;
  }
  // Quorum Arbiter: one seat per enemy unit, up to the ring's seat count.
  function wardSeatsLit(enemies, seats) {
    var n = Math.max(0, Math.floor(enemies || 0));
    return Math.min(seats > 0 ? seats : 12, n);
  }
  // The Mythic units on the board with a ward, as the runtime wants them:
  // which side, how many enemy units (seats), which allies (aura tethers,
  // larvae). specs is mythics.json's "mythics" table (name -> entry).
  function wardsOnBoard(players, specs) {
    var out = [];
    ['p1', 'p2'].forEach(function (pid) {
      var me = players[pid], foe = players[pid === 'p1' ? 'p2' : 'p1'];
      me.board.forEach(function (u) {
        if (u.rarity !== 'Mythic' || !specs[u.name]) return;
        out.push({ iid: u.instanceId, name: u.name, faction: u.faction, side: pid, beh: specs[u.name].behaviour,
          enemies: foe.board.length,
          allies: me.board.filter(function (a) { return a.instanceId !== u.instanceId; }).map(function (a) { return a.instanceId; }) });
      });
    });
    return out;
  }
`;

export const WARD_FX_RUNTIME_SOURCE = String.raw`
  var WARDS = (function () {
    var K = CFX.kit, rand = K.rand, mix = K.mix, rgba = K.rgba, WHITE = [255, 255, 255];
    var dataEl = document.getElementById('ward-data');
    var DATA = dataEl ? JSON.parse(dataEl.textContent || '{}') : {};
    var SPECS = DATA.specs || {}, IMG = {}, cache = {}, wedgeCache = {};
    var BLANK = document.createElement('canvas'); BLANK.width = BLANK.height = 2;
    Object.keys(DATA.atlases || {}).forEach(function (name) {
      var im = new Image();
      im.onload = function () { IMG[name] = im; };
      im.src = DATA.atlases[name];
    });
    // One tinted canvas per (card, cell, size): the sheet is greyscale on
    // black, tinted with the faction colour exactly like the FX atlases.
    function cellTex(w, i, small) {
      var key = w.name + '|' + i + '|' + (small ? 's' : 'l');
      if (cache[key]) return cache[key];
      var im = IMG[w.name];
      if (!im) return BLANK;
      var cell = (im.naturalWidth || im.width) / 2, S = small ? 256 : Math.min(512, cell);
      var cv = document.createElement('canvas'); cv.width = cv.height = S;
      var g = cv.getContext('2d');
      g.drawImage(im, (i % 2) * cell, ((i / 2) | 0) * cell, cell, cell, 0, 0, S, S);
      var d = g.getImageData(0, 0, S, S); fxTintPixels(d.data, w.rgb); g.putImageData(d, 0, 0);
      return cache[key] = cv;
    }
    function layerTex(w, i, px) { return cellTex(w, i, px <= 300); }
    function wedgeTex(w, i, j, N) {
      var key = w.name + '|' + i + '|' + j;
      if (wedgeCache[key]) return wedgeCache[key];
      var S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
      var g = cv.getContext('2d'), a0 = j / N * 6.283, a1 = (j + 1) / N * 6.283;
      g.beginPath(); g.moveTo(S / 2, S / 2); g.arc(S / 2, S / 2, S / 2, a0, a1); g.closePath(); g.clip();
      g.drawImage(cellTex(w, i, true), 0, 0, S, S);
      return wedgeCache[key] = cv;
    }

    var wards = [], bits = [], pulses = [];
    var counts = { arrived: 0, shattered: 0, pulsed: 0, seatChanges: 0, larvae: 0, pointers: 0, auraRings: 0 };
    function find(iid) { for (var i = 0; i < wards.length; i++) if (wards[i].iid === iid) return wards[i]; return null; }
    function cardEl(iid) { return document.querySelector('#app .card[data-iid="' + iid + '"]'); }
    function rectOf(iid) { var el = cardEl(iid); if (!el) return null; var r = el.getBoundingClientRect(); return r.width > 0 ? r : null; }
    function anchor(w) {
      if (!w.el || !w.el.isConnected) w.el = cardEl(w.iid);
      if (!w.el) return;
      var r = w.el.getBoundingClientRect();
      if (!(r.width > 0)) return;
      var p = K.docCentre(r);
      w.x = p.x; w.y = p.y; w.h = r.height; w.R = wardRadius(r.height);
    }
    function make(o, mode) {
      var spec = SPECS[o.name] || {};
      var w = { iid: o.iid, name: o.name, faction: o.faction, rgb: fxRgbOf(o.faction), side: o.side, beh: o.beh || spec.behaviour || 'generic',
        params: spec.behaviourParams || {}, enemies: o.enemies || 0, allies: o.allies || [], x: 0, y: 0, h: 158, R: wardRadius(158),
        rot: WARD_LAYERS.map(function () { return rand(0, 6.283); }), t: rand(0, 6), mt: 0, mode: mode, spin: mode === 'perm' ? 1 : 5,
        lit: -1, bt: rand(0, 1), el: null, gone: false };
      anchor(w);
      w.lit = w.beh === 'seats' ? wardSeatsLit(w.enemies, w.params.seats) : -1;
      wards.push(w);
      K.kick();
      return w;
    }

    // The page's per-frame truth: the Mythics on this frame's board. A
    // ward that is new appears at rest behind its card, unless this is a
    // move-by-move step (the page cues its arrival). A ward whose card left
    // is kept for one step when stepping, so the page can shatter it at the
    // kill moment; on a jump it simply goes.
    function sync(list, o) {
      o = o || {};
      var seen = {};
      list.forEach(function (it) {
        seen[it.iid] = true;
        if (!SPECS[it.name] || !DATA.atlases || !DATA.atlases[it.name]) return;
        var w = find(it.iid);
        if (!w) { make(it, o.stepping ? 'wait' : 'perm'); return; }
        w.enemies = it.enemies; w.allies = it.allies; w.gone = false;
      });
      for (var i = wards.length - 1; i >= 0; i--) {
        var w = wards[i];
        if (seen[w.iid]) continue;
        if (o.stepping && !w.gone) { w.gone = true; continue; }
        wards.splice(i, 1);
      }
    }
    function arrive(iid) {
      var w = find(iid);
      if (!w) return false;
      w.mode = 'manifest'; w.mt = 0; w.spin = 5;
      anchor(w);
      counts.arrived++;
      K.gridForce(w.x, w.y, 900, 200, true);
      K.shock(w.x, w.y, w.rgb, w.R * 1.4, 0.6);
      K.sparks(w.x, w.y, w.rgb, 60, 520, { life: 0.8 });
      K.gridTint(w.x, w.y, w.rgb, 260);
      SND.play('ward', w.faction, 'spectacle', w.el ? w.el.getBoundingClientRect() : null);
      K.kick();
      return true;
    }
    // A signature move: the ward flares and spins up, behind the card.
    function pulse(iid) {
      var w = find(iid);
      if (!w || w.mode === 'wait') return false;
      w.mode = 'pulse'; w.mt = 0; w.spin = 7;
      counts.pulsed++;
      pulses.push({ x: w.x, y: w.y, c: w.rgb, maxR: w.R * 1.15, t: 0, dur: 0.5, w: 2.5, sq: 1 });
      SND.play('wardPulse', w.faction, 'normal', w.el ? w.el.getBoundingClientRect() : null);
      K.kick();
      return true;
    }
    // The card died: the ward breaks into spinning pieces over the board.
    function shatter(iid) {
      var w = find(iid);
      if (!w) return false;
      wards.splice(wards.indexOf(w), 1);
      counts.shattered++;
      var N = 8;
      WARD_LAYERS.forEach(function (L, k) {
        var r = w.R * L.r * 0.95;
        for (var j = 0; j < N; j++) {
          var dir = (j + 0.5) / N * 6.283 + w.rot[k], sp = rand(120, 300) * (1.2 - L.r * 0.4);
          bits.push({ kind: 'wedge', top: true, tex: wedgeTex(w, L.i, j, N), x: w.x, y: w.y, r: r, rot: w.rot[k],
            vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp, vr: rand(-2.5, 2.5), age: 0, life: rand(0.8, 1.2), fric: 0.93, grav: 60, a: 1 });
        }
      });
      K.shock(w.x, w.y, w.rgb, w.R * 0.9, 0.5);
      K.flare(w.x, w.y, w.rgb, w.R * 1.3, 0.22);
      SND.play('wardBreak', w.faction, 'spectacle', null);
      K.kick();
      return true;
    }

    // ---- live behaviour (mythics.json "behaviour"), all behind the card ----
    function liveRects(iids) { var out = []; iids.forEach(function (id) { var r = rectOf(id); if (r) out.push(r); }); return out; }
    function behave(w, dt) {
      w.bt += dt;
      if (w.mode === 'wait') return;
      var sc = w.R / 122;
      if (w.beh === 'seats') {
        var n = wardSeatsLit(w.enemies, w.params.seats);
        if (n !== w.lit) {
          if (w.lit >= 0) { pulses.push({ x: w.x, y: w.y, c: w.rgb, maxR: w.R * 1.05, t: 0, dur: 0.5, w: 2, sq: 1 }); counts.seatChanges++; }
          w.lit = n;
        }
      } else if (w.beh === 'aura') {
        if (w.bt > 2.6) { w.bt = 0; pulses.push({ x: w.x, y: w.y, c: w.rgb, maxR: 300 * sc, t: 0, dur: 1.1, w: 2, sq: 0.3 }); counts.auraRings++; }
      } else if (w.beh === 'heartbeat') {
        var every = Number(w.params.spawnEverySeconds) || 1.5;
        if (w.bt > every) {
          w.bt = 0;
          var al = liveRects(w.allies);
          if (al.length) {
            var t = K.docCentre(al[(Math.random() * al.length) | 0]), a = Math.atan2(t.y - w.y, t.x - w.x), d = Math.hypot(t.x - w.x, t.y - w.y) - 40 * sc;
            bits.push({ kind: 'ornament', w: w, x: w.x + Math.cos(a) * 40 * sc, y: w.y + Math.sin(a) * 40 * sc, vx: Math.cos(a) * d / 1.5, vy: Math.sin(a) * d / 1.5,
              s: 24 * sc, rot: a + Math.PI / 2, vr: 0, age: 0, life: 1.5, fric: 1, grav: 0, a: 0.95, inout: true });
            counts.larvae++;
          }
        }
      } else if (w.beh === 'gravity') {
        if (dt > 0) K.gridForce(w.x, w.y, 22, 170 * sc, true);
        if (w.bt > 0.18) {
          w.bt = 0;
          var ang = rand(0, 6.283), rad = rand(200, 300) * sc;
          bits.push({ kind: 'spiral', w: w, cx: w.x, cy: w.y, ang: ang, rad: rad, x: w.x + Math.cos(ang) * rad, y: w.y + Math.sin(ang) * rad,
            s: rand(12, 20) * sc, rot: 0, age: 0, life: 2.2, a: 0.9, inout: true });
          counts.pointers++;
        }
      }
    }
    function update(dt) {
      var i;
      for (i = 0; i < wards.length; i++) {
        var w = wards[i];
        if (!w.gone) anchor(w);
        w.t += dt; w.mt += dt;
        w.spin += (1 - w.spin) * Math.min(1, dt * 1.6);
        if (!K.reduced) for (var k = 0; k < WARD_LAYERS.length; k++) w.rot[k] += WARD_LAYERS[k].spd * w.spin * dt;
        if (w.beh === 'gravity' && !K.reduced) w.rot[1] += dt * 0.5;
        var next = wardNextMode(w.mode, w.mt);
        if (next !== w.mode) { w.mode = next; w.mt = 0; }
        behave(w, dt);
      }
      for (i = bits.length - 1; i >= 0; i--) {
        var b = bits[i];
        b.age += dt;
        if (b.age >= b.life) { bits.splice(i, 1); continue; }
        if (b.kind === 'spiral') {
          b.rad *= Math.pow(0.42, dt); b.ang += dt * (1.6 + 70 / Math.max(8, b.rad));
          b.x = b.cx + Math.cos(b.ang) * b.rad; b.y = b.cy + Math.sin(b.ang) * b.rad; b.rot = b.ang + Math.PI * 0.75;
          if (b.rad < 10) b.age = b.life;
          continue;
        }
        var f = Math.pow(b.fric, dt * 60);
        b.vx *= f; b.vy *= f; b.vy += b.grav * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      }
      for (i = pulses.length - 1; i >= 0; i--) { pulses[i].t += dt / pulses[i].dur; if (pulses[i].t >= 1) pulses.splice(i, 1); }
    }

    // ---- drawing ----
    function drawWard(ctx, w, look, weight, behind) {
      var c = w.rgb;
      K.drawGlow(ctx, w.x, w.y, w.R * 1.15 * look.s, c, look.a * weight * 0.16);
      var reveal = wardLook(w.mode, w.mt, w.t, w.beh).reveal;
      WARD_LAYERS.forEach(function (L, k) {
        var r = w.R * L.r * look.s * (behind ? WARD_BEHIND.scale[k] : 1);
        ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.rot[k]);
        if (reveal < 1) {
          var pr = Math.max(0, Math.min(1, reveal * 1.5 - k * 0.22));
          if (pr <= 0) { ctx.restore(); return; }
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 1.05, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); ctx.closePath(); ctx.clip();
          var ea = -Math.PI / 2 + pr * 6.283;
          if (pr < 1) K.drawGlow(ctx, Math.cos(ea) * r * 0.95, Math.sin(ea) * r * 0.95, 14, WHITE, 0.9 * weight);
        }
        ctx.globalAlpha = Math.min(1, look.a * weight * (behind ? WARD_BEHIND.boost[k] : 1) * (k === 2 ? 1.1 : 1));
        ctx.drawImage(layerTex(w, L.i, 2 * r * K.dpr), -r, -r, 2 * r, 2 * r);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      if (reveal >= 1) drawBehaviour(ctx, w, look, weight);
    }
    function drawBehaviour(ctx, w, look, weight) {
      var c = w.rgb, orn = cellTex(w, 3, true), sc = w.R / 122;
      if (w.beh === 'seats') {
        var seats = w.params.seats > 0 ? w.params.seats : 12;
        for (var k = 0; k < seats; k++) {
          var a = w.rot[0] + k / seats * 6.283 - Math.PI / 2, x = w.x + Math.cos(a) * w.R * 0.93 * look.s, y = w.y + Math.sin(a) * w.R * 0.93 * look.s, on = k < w.lit;
          ctx.globalAlpha = (on ? 1 : 0.22) * weight;
          ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); ctx.drawImage(orn, -10 * sc, -10 * sc, 20 * sc, 20 * sc); ctx.restore();
          if (on) K.drawGlow(ctx, x, y, 14 * sc, mix(c, WHITE, 0.4), 0.8 * weight);
        }
        ctx.globalAlpha = 1;
      } else if (w.beh === 'aura') {
        liveRects(w.allies).forEach(function (r) {
          var t = K.docCentre(r), ty = t.y - r.height / 2 + 4, ph = (w.t * 0.6 + t.x * 0.003) % 1;
          ctx.strokeStyle = rgba(c, 0.3 * weight); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(t.x, ty); ctx.stroke();
          K.drawGlow(ctx, w.x + (t.x - w.x) * ph, w.y + (ty - w.y) * ph, 7, mix(c, WHITE, 0.5), 0.9 * weight);
          ctx.globalAlpha = 0.85 * weight; ctx.drawImage(orn, t.x - 11, t.y - r.height / 2 - 28, 22, 22); ctx.globalAlpha = 1;
        });
      }
      for (var m = 0; m < 3; m++) {
        var ma = w.rot[0] * 1.6 + m * 2.094;
        K.drawGlow(ctx, w.x + Math.cos(ma) * w.R * 0.93 * look.s, w.y + Math.sin(ma) * w.R * 0.93 * look.s, 7, mix(c, WHITE, 0.5), Math.min(1, look.a * 1.2) * weight);
      }
    }
    function bitAlpha(b) { var k = b.age / b.life; if (b.inout) return b.a * Math.min(1, k * 5) * (1 - k); return b.a * (k < 0.65 ? 1 : (1 - k) / 0.35); }
    function drawBits(ctx, top) {
      for (var i = 0; i < bits.length; i++) {
        var b = bits[i];
        if (!!b.top !== top) continue;
        var a = bitAlpha(b);
        if (a <= 0.003) continue;
        ctx.globalAlpha = Math.min(1, a);
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        if (b.kind === 'wedge') ctx.drawImage(b.tex, -b.r, -b.r, 2 * b.r, 2 * b.r);
        else ctx.drawImage(cellTex(b.w, 3, true), -b.s / 2, -b.s / 2, b.s, b.s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    function drawPulses(ctx) {
      pulses.forEach(function (r) {
        var e = 1 - Math.pow(1 - r.t, 3), rad = r.maxR * e, a = 1 - r.t;
        ctx.save(); ctx.translate(r.x, r.y); ctx.scale(1, r.sq);
        ctx.strokeStyle = rgba(r.c, a * 0.28); ctx.lineWidth = r.w * 3.5 / r.sq; ctx.beginPath(); ctx.arc(0, 0, rad, 0, 6.283); ctx.stroke();
        ctx.strokeStyle = rgba(mix(r.c, WHITE, 0.5), a); ctx.lineWidth = r.w / r.sq; ctx.beginPath(); ctx.arc(0, 0, rad, 0, 6.283); ctx.stroke();
        ctx.restore();
      });
    }
    function drawFloor(ctx) {
      drawPulses(ctx);
      for (var i = 0; i < wards.length; i++) {
        var w = wards[i], lay = wardLayering(w.mode, w.mt);
        if (lay.under > 0) drawWard(ctx, w, wardLook(w.mode, w.mt, w.t, w.beh).under, lay.under, true);
      }
      drawBits(ctx, false);
    }
    function drawTop(ctx) {
      for (var i = 0; i < wards.length; i++) {
        var w = wards[i], lay = wardLayering(w.mode, w.mt), look = wardLook(w.mode, w.mt, w.t, w.beh);
        if (lay.top > 0 && look.top) drawWard(ctx, w, look.top, lay.top, false);
      }
      drawBits(ctx, true);
    }

    var api = {
      sync: sync, arrive: arrive, pulse: pulse, shatter: shatter,
      has: function (iid) { return !!find(iid); },
      stats: function () {
        return { wards: wards.map(function (w) { var lay = wardLayering(w.mode, w.mt); return { iid: w.iid, name: w.name, mode: w.mode, top: +lay.top.toFixed(2), under: +lay.under.toFixed(2), lit: w.lit, R: Math.round(w.R) }; }),
          bits: bits.length, loaded: Object.keys(IMG), counts: counts };
      }
    };
    function hasTop() {
      for (var i = 0; i < wards.length; i++) if (wardLayering(wards[i].mode, wards[i].mt).top > 0) return true;
      for (i = 0; i < bits.length; i++) if (bits[i].top) return true;
      return false;
    }
    CFX.plug({ update: update, drawFloor: drawFloor, drawTop: drawTop, hasTop: hasTop,
      alive: function () { return wards.length > 0 || bits.length > 0 || pulses.length > 0; },
      clear: function () { bits.length = 0; pulses.length = 0; } });
    window.__wards = api;
    return api;
  })();
`;

const pure = new Function(
  `${WARD_FX_PURE_SOURCE}; return { WARD_LAYERS: WARD_LAYERS, WARD_R_PER_CARD_H: WARD_R_PER_CARD_H, WARD_T: WARD_T, WARD_BEHIND: WARD_BEHIND, WARD_BEHAVIOURS: WARD_BEHAVIOURS, wardRadius: wardRadius, wardBeat: wardBeat, wardLayering: wardLayering, wardLook: wardLook, wardNextMode: wardNextMode, wardSeatsLit: wardSeatsLit, wardsOnBoard: wardsOnBoard };`,
)() as {
  WARD_LAYERS: { i: number; r: number; spd: number }[];
  WARD_R_PER_CARD_H: number;
  WARD_T: { drawIn: number; onTop: number; sink: number; pulse: number; waitMax: number };
  WARD_BEHIND: { alpha: number; boost: number[]; scale: number[] };
  WARD_BEHAVIOURS: string[];
  wardRadius: (cardH: number) => number;
  wardBeat: (t: number) => number;
  wardLayering: (mode: WardMode, mt: number) => { top: number; under: number };
  wardLook: (mode: WardMode, mt: number, t: number, beh: string) => { top: WardLookPart | null; under: WardLookPart; reveal: number };
  wardNextMode: (mode: WardMode, mt: number) => WardMode;
  wardSeatsLit: (enemies: number, seats: number) => number;
  wardsOnBoard: (players: WardPlayers, specs: Record<string, MythicSpec>) => WardOnBoard[];
};

export type WardMode = "wait" | "manifest" | "perm" | "pulse";
export interface WardLookPart { a: number; s: number }
interface WardUnit { instanceId: string; name: string; faction: string; rarity: string }
export type WardPlayers = Record<"p1" | "p2", { board: WardUnit[] }>;
export interface WardOnBoard { iid: string; name: string; faction: string; side: "p1" | "p2"; beh: string; enemies: number; allies: string[] }
export interface MythicSpec { faction: string; behaviour: string; behaviourParams?: Record<string, unknown>; ward?: string }

export const { WARD_LAYERS, WARD_R_PER_CARD_H, WARD_T, WARD_BEHIND, WARD_BEHAVIOURS, wardRadius, wardBeat, wardLayering, wardLook, wardNextMode, wardSeatsLit, wardsOnBoard } = pure;

const RENDER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_DIR = resolve(RENDER_DIR, "..");
let specCache: Record<string, MythicSpec> | null = null;
/** mythics.json's "mythics" table (presentation data, owner-approved). */
export function mythicSpecs(): Record<string, MythicSpec> {
  if (!specCache) {
    const raw = JSON.parse(readFileSync(resolve(RENDER_DIR, "presentation/mythics.json"), "utf8")) as { mythics: Record<string, MythicSpec> };
    specCache = raw.mythics;
  }
  return specCache;
}

/** The names of the Mythics with a ward that reach the board at any point in this replay. */
export function mythicsInReplay(replay: MatchReplay, specs: Record<string, MythicSpec> = mythicSpecs()): string[] {
  const seen = new Set<string>();
  for (const f of replay.frames) for (const pid of ["p1", "p2"] as const) {
    for (const u of f.players[pid].board) if (u.rarity === "Mythic" && specs[u.name]) seen.add(u.name);
  }
  return [...seen].sort();
}

/** The page's #ward-data block: specs for every ward Mythic, sheets only for the ones in this replay. */
export function wardDataFor(replay: MatchReplay): { specs: Record<string, MythicSpec>; atlases: Record<string, string> } {
  const specs = mythicSpecs();
  const atlases: Record<string, string> = {};
  for (const name of mythicsInReplay(replay, specs)) {
    const file = specs[name]!.ward;
    if (!file) continue;
    atlases[name] = `data:image/webp;base64,${readFileSync(resolve(REPO_DIR, file)).toString("base64")}`;
  }
  const slim: Record<string, MythicSpec> = {};
  for (const [name, s] of Object.entries(specs)) slim[name] = { faction: s.faction, behaviour: s.behaviour, behaviourParams: s.behaviourParams };
  return { specs: slim, atlases };
}
