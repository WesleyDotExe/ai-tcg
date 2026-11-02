// EFFECTS.md v2, slice 5 — faction wards for signature abilities.
//
// A faction ward appears ONLY when a Rare or Mythic uses an attack, buff or
// defence unique to its rarity: the abilities listed in mythics.json's
// `signatureAbilities` (owner-approved 2026-10-04). Rules, all from
// EFFECTS.md "Wards (v2)":
//   - Rare = the faction sheet's single-ring cell (cell 3). Neutral has no
//     ward. A Mythic that carries its own unique ward (slice 6) flares that
//     ward instead (WARDS.pulse); one without a sheet gets nothing until
//     slice 7's fallback ward.
//   - First fire only (owner 2026-10-04): the ward flares the first time an
//     ability fires on a card instance, never on repeats. A fire that did
//     nothing (Rate Limiter's condition failing, an empty target list) is
//     not counted, so the first ward goes with the first fire a viewer can
//     actually see land.
//   - The ward draws itself in over its source, spins up, the effect leaves
//     from it, then it collapses. What else it does depends on the role,
//     read from what the ability actually did this move (never the card's
//     name):
//       attack  - anything aimed at the other side (damage, a removal, a
//                 debuff or a stun on an enemy counts as an attack);
//       defence - it gave a Barrier: a copy of the ward travels onto each
//                 protected unit and stays there, behind the card, for as
//                 long as that Barrier stands; when the Barrier takes the
//                 hit (or the unit leaves) the copy cracks apart;
//       buff    - it helped its own side: a smaller copy settles on each ally
//                 it reached, then goes;
//       self    - it only touched its own card (Overload Capacitor): the
//                 ward plays in place.
//   - Ordinary attacks, arrivals and deaths never show a faction ward.
//
// Meaning stays constant (EFFECTS.md's invariant): the ward says "this is a
// signature move"; the effect it launches still carries its own category's
// grammar (spell, removal, debuff, buff) in the source faction's material.
//
// Same single-source rule as the other FX modules: the page embeds
// SIG_WARD_PURE_SOURCE and SIG_WARD_RUNTIME_SOURCE verbatim, and Node
// evaluates the pure half together with effectFx.ts's resolveEffects, so
// test/sigWardFx.test.ts runs exactly what the page runs. The runtime needs
// a DOM and a 2D canvas: progress/render/evidence/.
//
// Self-contained (owner 2026-09-30): only the faction sheets of factions
// whose signature ward actually plays in this replay are embedded.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PlayerId } from "@ai-tcg/engine";
import { EFFECT_FX_SOURCE } from "./effectFx.js";
import type { EffectEnd } from "./effectFx.js";
import type { Frame, MatchReplay } from "./types.js";

export const SIG_WARD_PURE_SOURCE = String.raw`
  // Factions that have a ward sheet (render/assets/wards/faction/<key>.webp).
  var SIG_WARD_FACTIONS = { Cortex: 'cortex', Aegis: 'aegis', Swarm: 'swarm', Null: 'null' };
  // The single-ring cell of the 2x2 faction sheet (lab: LAYERS.rare).
  var SIG_CELL = 3;
  var SIG_SPIN = 0.13;
  // Radii as a share of the card's height (the lab's rare ward: R 92 on a
  // 123 px card; its mini copy R 62). guard: behind the card, the ring
  // reaches past the card's sides, top and bottom.
  var SIG_R = { flare: 0.75, mini: 0.5, guard: 0.72 };
  // Seconds. drawIn: the ring sweeps in. pulse: the spin-up flare as the
  // effect leaves. collapse: it folds away. travel: a guard copy flying
  // onto its unit. sink: a guard crossfading from over the card to behind.
  // mini: how long a buff copy rests on its ally before it goes. holdMax:
  // a flare left waiting for its close still folds away after this.
  var SIG_T = { drawIn: 0.45, pulse: 0.7, collapse: 0.38, travel: 0.5, sink: 0.5, mini: 0.9, waitMax: 4, holdMax: 3 };
  // Behind the card a guard rests quietly: it is a standing state (this
  // Barrier came from a signature move), not an event, and a full row of
  // guards at Mythic-ward brightness read as a wall of rings (render
  // session 16's stills). boost: per-copy opacity multiplier while behind.
  var SIG_BEHIND = { alpha: 0.5, boost: 1 };

  // mythics.json's signatureAbilities: card name -> ability ids. Returns a
  // lookup { name: { abilityId: true } }, skipping the "_about" note.
  function sigTable(raw) {
    var out = {};
    Object.keys(raw || {}).forEach(function (name) {
      if (name.charAt(0) === '_' || !Array.isArray(raw[name])) return;
      out[name] = {};
      raw[name].forEach(function (id) { out[name][id] = true; });
    });
    return out;
  }
  // Which side a unit / player / stack end belongs to, looking at both
  // frames (a unit can die or arrive on this move).
  function sigSideOf(end, prevFrame, newFrame) {
    if (!end) return null;
    if (end.kind === 'player') return end.playerId;
    if (end.kind === 'stack') return end.owner;
    var side = null;
    [prevFrame, newFrame].forEach(function (f) {
      ['p1', 'p2'].forEach(function (pid) {
        f.players[pid].board.forEach(function (u) { if (u.instanceId === end.instanceId) side = pid; });
        f.players[pid].directives.forEach(function (d) { if (d.instanceId === end.instanceId) side = pid; });
      });
    });
    return side;
  }
  // The role a signature fire plays, from what its effects did this move.
  function sigRole(effects, owner, prevFrame, newFrame) {
    var hostile = effects.some(function (e) {
      if (e.category === 'heal' || e.category === 'buff') return false;
      var side = sigSideOf(e.target, prevFrame, newFrame);
      return !!side && side !== owner;
    });
    if (hostile) return 'attack';
    if (effects.some(function (e) { return e.status === 'Barrier'; })) return 'defence';
    if (effects.every(function (e) { return e.self; })) return 'self';
    return 'buff';
  }
  function sigUnitIn(frame, iid) {
    var hit = null;
    ['p1', 'p2'].forEach(function (pid) { frame.players[pid].board.forEach(function (u) { if (u.instanceId === iid) hit = u; }); });
    return hit;
  }
  function sigSourceMatches(end, sourceId) {
    return end.kind === 'unit' ? end.instanceId === sourceId : end.kind === 'stack' ? end.stackId === sourceId : false;
  }

  // Every signature ward a whole replay shows, by frame index (the move
  // that ends on that frame). First fire only, per card instance and
  // ability; a Command's id is its stack id, so every copy cast is its own
  // first fire.
  function signatureFires(frames, table, cardFactions, cardRarities) {
    var seen = {}, out = {};
    for (var k = 1; k < frames.length; k++) {
      var prev = frames[k - 1], next = frames[k];
      var events = next.newEvents.map(function (x) { return x.event; });
      if (!events.some(function (ev) { return ev.type === 'abilityTrigger' && table[ev.source] && table[ev.source][ev.ability]; })) continue;
      var effects = resolveEffects(prev, next);
      events.forEach(function (ev) {
        if (ev.type !== 'abilityTrigger' || !ev.sourceId || !table[ev.source] || !table[ev.source][ev.ability]) return;
        var mine = effects.filter(function (e) { return e.ability === ev.ability && sigSourceMatches(e.source, ev.sourceId); });
        if (!mine.length) return;
        var key = ev.sourceId + '|' + ev.ability;
        if (seen[key]) return;
        seen[key] = true;
        var source = mine[0].source;
        var owner = sigSideOf(source, prev, next);
        var unit = source.kind === 'unit' ? (sigUnitIn(prev, source.instanceId) || sigUnitIn(next, source.instanceId)) : null;
        var faction = unit ? unit.faction : (cardFactions[ev.source] || null);
        var rarity = unit ? unit.rarity : (cardRarities[ev.source] || 'Rare');
        var targets = [], tseen = {};
        mine.forEach(function (e) {
          var tk = JSON.stringify(e.target);
          if (e.self || tseen[tk]) return;
          tseen[tk] = true;
          targets.push(e.target);
        });
        var guarded = [];
        mine.forEach(function (e) {
          if (e.status !== 'Barrier' || e.target.kind !== 'unit') return;
          var u = sigUnitIn(next, e.target.instanceId);
          if (u && u.barrierActive && guarded.indexOf(e.target.instanceId) === -1) guarded.push(e.target.instanceId);
        });
        (out[k] = out[k] || []).push({ ability: ev.ability, name: ev.source, sourceId: ev.sourceId, source: source, owner: owner,
          faction: faction, rarity: rarity, role: sigRole(mine, owner, prev, next), targets: targets, guarded: guarded,
          ward: !!SIG_WARD_FACTIONS[faction] });
      });
    }
    return out;
  }

  // The guard copies standing on each frame: a unit a signature defence
  // gave a Barrier keeps its guard until that Barrier is gone or the unit
  // leaves the board. frame index -> [{ iid, faction, src }].
  function signatureGuards(frames, fires) {
    var active = {}, order = [], out = [];
    for (var k = 0; k < frames.length; k++) {
      (fires[k] || []).forEach(function (f) {
        if (f.role !== 'defence' || !f.ward) return;
        f.guarded.forEach(function (iid) {
          if (!active[iid]) order.push(iid);
          active[iid] = { iid: iid, faction: f.faction, src: f.sourceId };
        });
      });
      order = order.filter(function (iid) {
        var u = active[iid] && sigUnitIn(frames[k], iid);
        if (!u || !u.barrierActive) { delete active[iid]; return false; }
        return true;
      });
      out.push(order.map(function (iid) { return active[iid]; }));
    }
    return out;
  }

  function sigEase(k) { k = k < 0 ? 0 : k > 1 ? 1 : k; return k * k * (3 - 2 * k); }
  // A ward's look at time mt in its mode. top / under: how much is drawn
  // over the card and behind it (they sum to 1 once visible). a: opacity;
  // s: scale; reveal: how far the ring has swept in.
  //   flare:    manifest -> pulse -> collapse (over the card throughout)
  //   mini:     manifest -> collapse (over the ally)
  //   guard:    wait -> travel -> sink -> perm (behind) -> crack
  function sigLook(mode, mt, t) {
    var hold = 0.82 * (0.9 + 0.1 * Math.sin(t * 3));
    if (mode === 'wait') return { top: 0, under: 0, a: 0, s: 1, reveal: 0 };
    if (mode === 'manifest') {
      var e = 1 - Math.pow(1 - Math.min(1, mt / SIG_T.drawIn), 3);
      return { top: 1, under: 0, a: mt < 0.55 ? 1 : hold, s: 1.25 - 0.25 * e, reveal: Math.min(1, mt / SIG_T.drawIn) };
    }
    if (mode === 'pulse') {
      var k = Math.min(1, mt / SIG_T.pulse);
      return { top: 1, under: 0, a: hold + (1 - hold) * (1 - k), s: 1 + 0.18 * Math.sin(Math.PI * Math.min(1, mt / 0.45)), reveal: 1 };
    }
    if (mode === 'collapse') {
      var c = Math.min(1, mt / SIG_T.collapse);
      return { top: 1, under: 0, a: hold * (1 - c), s: 1 - 0.8 * c * c, reveal: 1 };
    }
    if (mode === 'travel') return { top: 1, under: 0, a: hold, s: 1, reveal: 1 };
    if (mode === 'sink') {
      var q = sigEase(mt / SIG_T.sink);
      return { top: 1 - q, under: q, a: hold, s: 1, reveal: 1 };
    }
    // perm: behind the card for as long as the Barrier stands.
    return { top: 0, under: 1, a: SIG_BEHIND.alpha * (0.88 + 0.12 * Math.sin(t * 1.7)), s: 1, reveal: 1 };
  }
  // Mode after mt seconds in it (null = the ward is finished and removed).
  function sigNextMode(mode, mt, kind) {
    if (mode === 'manifest' && kind === 'mini' && mt >= SIG_T.mini) return 'collapse';
    if (mode === 'pulse' && mt >= SIG_T.pulse) return 'hold';
    // A flare whose close never came (the page was paused mid-move) still goes.
    if (mode === 'hold' && mt >= SIG_T.holdMax) return 'collapse';
    if (mode === 'collapse' && mt >= SIG_T.collapse) return null;
    if (mode === 'travel' && mt >= SIG_T.travel) return 'sink';
    if (mode === 'sink' && mt >= SIG_T.sink) return 'perm';
    if (mode === 'wait' && mt >= SIG_T.waitMax) return 'perm';
    return mode;
  }
  // How long the ward leads its effect (ms): long enough to draw in and
  // spin up, scaled with the replay speed so fast play stays fast.
  function sigLeadMs(speedMs) { return Math.round(Math.min(600, Math.max(200, speedMs * 0.75))); }
`;

export const SIG_WARD_RUNTIME_SOURCE = String.raw`
  var FWARDS = (function () {
    var K = CFX.kit, rand = K.rand, mix = K.mix, WHITE = [255, 255, 255];
    var dataEl = document.getElementById('sigward-data');
    var DATA = dataEl ? JSON.parse(dataEl.textContent || '{}') : {};
    var IMG = {}, cache = {}, wedgeCache = {};
    var BLANK = document.createElement('canvas'); BLANK.width = BLANK.height = 2;
    Object.keys(DATA.atlases || {}).forEach(function (f) {
      var im = new Image();
      im.onload = function () { IMG[f] = im; };
      im.src = DATA.atlases[f];
    });
    // The single-ring cell, tinted with the faction colour once per size.
    function ringTex(faction, small) {
      var key = faction + (small ? 's' : 'l');
      if (cache[key]) return cache[key];
      var im = IMG[faction];
      if (!im) return BLANK;
      var cell = (im.naturalWidth || im.width) / 2, S = small ? 256 : Math.min(512, cell);
      var cv = document.createElement('canvas'); cv.width = cv.height = S;
      var g = cv.getContext('2d');
      g.drawImage(im, (SIG_CELL % 2) * cell, ((SIG_CELL / 2) | 0) * cell, cell, cell, 0, 0, S, S);
      var d = g.getImageData(0, 0, S, S); fxTintPixels(d.data, fxRgbOf(faction)); g.putImageData(d, 0, 0);
      return cache[key] = cv;
    }
    function wedgeTex(faction, j, N) {
      var key = faction + '|' + j;
      if (wedgeCache[key]) return wedgeCache[key];
      var S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
      var g = cv.getContext('2d'), a0 = j / N * 6.283, a1 = (j + 1) / N * 6.283;
      g.beginPath(); g.moveTo(S / 2, S / 2); g.arc(S / 2, S / 2, S / 2, a0, a1); g.closePath(); g.clip();
      g.drawImage(ringTex(faction, true), 0, 0, S, S);
      return wedgeCache[key] = cv;
    }
    function ready(faction) { return !!(K.ok && CFX.isReady() && IMG[faction]); }

    var wards = [], bits = [], seq = 0;
    var counts = { flares: 0, minis: 0, guards: 0, cracked: 0 };
    function cardEl(iid) { return document.querySelector('#app .card[data-iid="' + iid + '"]'); }
    // Sized from a board card, never from a smaller anchor: a Command's
    // ward plays on its stack entry, a strip a fraction of a card's height.
    function cardH() { var el = document.querySelector('#app .card'); var r = el ? el.getBoundingClientRect() : null; return r && r.height > 0 ? r.height : 158; }
    function place(w, rect) {
      if (!rect || !(rect.width > 0)) return;
      var p = K.docCentre(rect);
      w.x = p.x; w.y = p.y; w.h = Math.max(rect.height, cardH());
    }
    function make(kind, faction, rect, mode, o) {
      o = o || {};
      var w = { id: o.id || ('s' + (++seq)), kind: kind, faction: faction, rgb: fxRgbOf(faction), iid: o.iid || null, x: 0, y: 0, h: 158,
        rot: rand(0, 6.283), t: rand(0, 6), mt: 0, mode: mode, spin: 5, gone: false, tw: null, el: null };
      place(w, rect);
      wards.push(w);
      K.kick();
      return w;
    }
    function find(id) { for (var i = 0; i < wards.length; i++) if (wards[i].id === id) return wards[i]; return null; }
    function radius(w) { return w.h * SIG_R[w.kind]; }

    // ---- the flare on the source: open -> fire -> close ----
    function open(rect, faction) {
      if (!ready(faction) || !rect) return null;
      var w = make('flare', faction, rect, 'manifest');
      counts.flares++;
      K.shock(w.x, w.y, w.rgb, radius(w) * 1.1, 0.45);
      SND.play('ward', faction, 'normal', rect);
      return w.id;
    }
    function fire(id) {
      var w = find(id);
      if (!w) return false;
      w.mode = 'pulse'; w.mt = 0; w.spin = 7;
      K.ring(w.x, w.y, w.rgb, radius(w) * 1.4, 0.5, 2.5);
      K.gridForce(w.x, w.y, 500, radius(w) * 1.4, false);
      SND.play('wardPulse', w.faction, 'normal', null);
      K.kick();
      return true;
    }
    function close(id) {
      var w = find(id);
      if (!w || w.mode === 'collapse') return false;
      w.mode = 'collapse'; w.mt = 0; w.spin = 6;
      return true;
    }
    // ---- buff: a smaller copy settles on the ally, then goes ----
    function mini(rect, faction) {
      if (!ready(faction) || !rect) return false;
      var w = make('mini', faction, rect, 'manifest');
      counts.minis++;
      K.ring(w.x, w.y + w.h * 0.25, w.rgb, radius(w), 0.52, 2, { squash: 0.5 });
      return true;
    }
    // ---- defence: guard copies that live behind the card ----
    // The page's per-frame truth: the guards standing on this frame. A new
    // one waits for its cue when stepping (the page flies it in from the
    // source); on a jump it is simply there. A guard whose Barrier went is
    // kept one step when stepping, so the page can crack it at the block.
    function syncGuards(list, o) {
      o = o || {};
      var seen = {};
      list.forEach(function (g) {
        seen[g.iid] = true;
        if (!IMG[g.faction]) return;
        var w = find('g:' + g.iid);
        if (!w) {
          w = make('guard', g.faction, null, o.stepping ? 'wait' : 'perm', { id: 'g:' + g.iid, iid: g.iid });
          if (!o.stepping) w.spin = 1;
          return;
        }
        w.gone = false;
        // A jump away while it waited for its fly-in: just show it.
        if (!o.stepping && w.mode === 'wait') { w.mode = 'perm'; w.mt = 0; }
      });
      for (var i = wards.length - 1; i >= 0; i--) {
        var w = wards[i];
        if (w.kind !== 'guard' || seen[w.iid]) continue;
        if (o.stepping && !w.gone) { w.gone = true; continue; }
        wards.splice(i, 1);
      }
    }
    function guardIn(iid, fromRect) {
      var w = find('g:' + iid);
      if (!w) return false;
      var el = cardEl(iid);
      var to = el ? el.getBoundingClientRect() : null;
      if (!to) return false;
      var b = K.docCentre(to);
      var a = fromRect && fromRect.width > 0 ? K.docCentre(fromRect) : b;
      w.h = to.height; w.x = a.x; w.y = a.y;
      w.tw = { x0: a.x, y0: a.y, x1: b.x, y1: b.y, t: 0 };
      w.mode = 'travel'; w.mt = 0; w.spin = 6;
      counts.guards++;
      K.kick();
      return true;
    }
    // The Barrier took its hit (or the unit left): the guard cracks into
    // spinning pieces over the board.
    function crack(iid) {
      var w = find('g:' + iid);
      if (!w) return false;
      wards.splice(wards.indexOf(w), 1);
      counts.cracked++;
      var N = 8, r = radius(w) * 0.95;
      for (var j = 0; j < N; j++) {
        var dir = (j + 0.5) / N * 6.283 + w.rot, sp = rand(110, 240);
        bits.push({ tex: wedgeTex(w.faction, j, N), x: w.x, y: w.y, r: r, rot: w.rot, vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp,
          vr: rand(-2.5, 2.5), age: 0, life: rand(0.7, 1.05), fric: 0.93, grav: 60 });
      }
      K.shock(w.x, w.y, w.rgb, radius(w) * 0.8, 0.4);
      SND.play('wardBreak', w.faction, 'normal', null);
      K.kick();
      return true;
    }
    function goneGuards() { return wards.filter(function (w) { return w.kind === 'guard' && w.gone; }).map(function (w) { return w.iid; }); }

    function update(dt) {
      for (var i = wards.length - 1; i >= 0; i--) {
        var w = wards[i];
        w.t += dt; w.mt += dt;
        w.spin += (1 - w.spin) * Math.min(1, dt * 1.6);
        if (!K.reduced) w.rot += SIG_SPIN * w.spin * dt;
        if (w.kind === 'guard' && !w.tw && !w.gone && w.mode !== 'wait') {
          if (!w.el || !w.el.isConnected) w.el = cardEl(w.iid);
          if (w.el) place(w, w.el.getBoundingClientRect());
        }
        if (w.tw) {
          var q = w.tw; q.t += dt / SIG_T.travel;
          var e = q.t >= 1 ? 1 : 1 - Math.pow(1 - q.t, 3);
          w.x = q.x0 + (q.x1 - q.x0) * e; w.y = q.y0 + (q.y1 - q.y0) * e;
          if (q.t >= 1) w.tw = null;
        }
        var next = sigNextMode(w.mode, w.mt, w.kind);
        if (next === null) { wards.splice(i, 1); continue; }
        if (next !== w.mode) { w.mode = next; w.mt = 0; }
      }
      for (i = bits.length - 1; i >= 0; i--) {
        var b = bits[i];
        b.age += dt;
        if (b.age >= b.life) { bits.splice(i, 1); continue; }
        var f = Math.pow(b.fric, dt * 60);
        b.vx *= f; b.vy *= f; b.vy += b.grav * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      }
    }
    function lookOf(w) {
      // 'hold' is a flare after its pulse, waiting for close().
      return sigLook(w.mode === 'hold' ? 'travel' : w.mode, w.mt, w.t);
    }
    function drawWard(ctx, w, look, weight, behind) {
      var R = radius(w) * look.s * (w.kind === 'guard' && w.tw ? 1 + 0.4 * (1 - w.tw.t) : 1);
      var a = Math.min(1, look.a * weight * (behind ? SIG_BEHIND.boost : 1));
      if (a <= 0.003) return;
      K.drawGlow(ctx, w.x, w.y, R * 1.15, w.rgb, a * 0.1);
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.rot);
      if (look.reveal < 1) {
        var pr = Math.max(0, Math.min(1, look.reveal * 1.5));
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R * 1.05, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); ctx.closePath(); ctx.clip();
        var ea = -Math.PI / 2 + pr * 6.283;
        if (pr < 1) K.drawGlow(ctx, Math.cos(ea) * R * 0.95, Math.sin(ea) * R * 0.95, 12, WHITE, 0.9 * weight);
      }
      ctx.globalAlpha = a;
      ctx.drawImage(ringTex(w.faction, 2 * R * K.dpr <= 300), -R, -R, 2 * R, 2 * R);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    function drawFloor(ctx) {
      for (var i = 0; i < wards.length; i++) {
        var w = wards[i], look = lookOf(w);
        if (look.under > 0) drawWard(ctx, w, look, look.under, true);
      }
    }
    function drawTop(ctx) {
      for (var i = 0; i < wards.length; i++) {
        var w = wards[i], look = lookOf(w);
        if (look.top > 0) drawWard(ctx, w, look, look.top, false);
      }
      for (i = 0; i < bits.length; i++) {
        var b = bits[i], k = b.age / b.life, a = k < 0.65 ? 1 : (1 - k) / 0.35;
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.drawImage(b.tex, -b.r, -b.r, 2 * b.r, 2 * b.r); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    function hasTop() {
      if (bits.length) return true;
      for (var i = 0; i < wards.length; i++) if (lookOf(wards[i]).top > 0) return true;
      return false;
    }
    var api = {
      open: open, fire: fire, close: close, mini: mini, syncGuards: syncGuards, guardIn: guardIn, crack: crack, goneGuards: goneGuards,
      ready: ready,
      hasGuard: function (iid) { return !!find('g:' + iid); },
      stats: function () {
        return { wards: wards.map(function (w) { var l = lookOf(w); return { id: w.id, kind: w.kind, faction: w.faction, iid: w.iid, mode: w.mode, top: +l.top.toFixed(2), under: +l.under.toFixed(2), R: Math.round(radius(w)) }; }),
          bits: bits.length, loaded: Object.keys(IMG), counts: counts };
      }
    };
    CFX.plug({ update: update, drawFloor: drawFloor, drawTop: drawTop, hasTop: hasTop,
      alive: function () { return wards.length > 0 || bits.length > 0; },
      // A jump: nothing transient survives; guards are re-placed by sync.
      clear: function () { bits.length = 0; for (var i = wards.length - 1; i >= 0; i--) if (wards[i].kind !== 'guard') wards.splice(i, 1); } });
    window.__sigwards = api;
    return api;
  })();
`;

export type SigRole = "attack" | "defence" | "buff" | "self";
export interface SignatureFire {
  ability: string;
  name: string;
  sourceId: string;
  source: EffectEnd;
  owner: PlayerId | null;
  faction: string | null;
  rarity: string;
  role: SigRole;
  /** Every end the ability reached other than its own card. */
  targets: EffectEnd[];
  /** Units it gave a Barrier that still has it after the move (guard copies). */
  guarded: string[];
  /** Whether a faction ward exists for it (Neutral has none). */
  ward: boolean;
}
export interface SignatureGuard { iid: string; faction: string; src: string }
export type SigWardMode = "wait" | "manifest" | "pulse" | "collapse" | "travel" | "sink" | "perm";
export interface SigLook { top: number; under: number; a: number; s: number; reveal: number }

const pure = new Function(
  `${EFFECT_FX_SOURCE}; ${SIG_WARD_PURE_SOURCE}; return { SIG_WARD_FACTIONS: SIG_WARD_FACTIONS, SIG_CELL: SIG_CELL, SIG_R: SIG_R, SIG_T: SIG_T, SIG_BEHIND: SIG_BEHIND, sigTable: sigTable, sigRole: sigRole, signatureFires: signatureFires, signatureGuards: signatureGuards, sigLook: sigLook, sigNextMode: sigNextMode, sigLeadMs: sigLeadMs };`,
)() as {
  SIG_WARD_FACTIONS: Record<string, string>;
  SIG_CELL: number;
  SIG_R: { flare: number; mini: number; guard: number };
  SIG_T: { drawIn: number; pulse: number; collapse: number; travel: number; sink: number; mini: number; waitMax: number; holdMax: number };
  SIG_BEHIND: { alpha: number; boost: number };
  sigTable: (raw: Record<string, unknown>) => Record<string, Record<string, true>>;
  sigRole: (effects: unknown[], owner: PlayerId | null, prev: Frame, next: Frame) => SigRole;
  signatureFires: (frames: Frame[], table: Record<string, Record<string, true>>, cardFactions: Record<string, string>, cardRarities: Record<string, string>) => Record<number, SignatureFire[]>;
  signatureGuards: (frames: Frame[], fires: Record<number, SignatureFire[]>) => SignatureGuard[][];
  sigLook: (mode: SigWardMode, mt: number, t: number) => SigLook;
  sigNextMode: (mode: SigWardMode | "hold", mt: number, kind: "flare" | "mini" | "guard") => SigWardMode | "hold" | null;
  sigLeadMs: (speedMs: number) => number;
};

export const { SIG_WARD_FACTIONS, SIG_CELL, SIG_R, SIG_T, SIG_BEHIND, sigTable, sigRole, signatureGuards, sigLook, sigNextMode, sigLeadMs } = pure;

const RENDER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let tableCache: Record<string, Record<string, true>> | null = null;
/** mythics.json's signatureAbilities as a name -> ability id lookup. */
export function signatureTable(): Record<string, Record<string, true>> {
  if (!tableCache) {
    const raw = JSON.parse(readFileSync(resolve(RENDER_DIR, "presentation/mythics.json"), "utf8")) as { signatureAbilities: Record<string, unknown> };
    tableCache = sigTable(raw.signatureAbilities);
  }
  return tableCache;
}

/** Every signature ward a replay shows, by the frame index its move ends on. */
export function signatureFires(replay: MatchReplay, table = signatureTable()): Record<number, SignatureFire[]> {
  return pure.signatureFires(replay.frames, table, replay.cardFactions, replay.cardRarities ?? {});
}

/** The page's #sigward-data block: the signature table, plus a faction's
 * ring sheet only when one of its signature wards plays in this replay. */
export function sigWardDataFor(replay: MatchReplay, opts: { all?: boolean } = {}): { table: Record<string, Record<string, true>>; atlases: Record<string, string> } {
  const table = signatureTable();
  const fires = signatureFires(replay, table);
  const atlases: Record<string, string> = {};
  // A live match (render session 51): any faction's ring may still fire.
  if (opts.all) {
    for (const [faction, file] of Object.entries(SIG_WARD_FACTIONS as Record<string, string>)) {
      atlases[faction] = `data:image/webp;base64,${readFileSync(resolve(RENDER_DIR, "assets/wards/faction", `${file}.webp`)).toString("base64")}`;
    }
    return { table, atlases };
  }
  for (const list of Object.values(fires)) for (const f of list) {
    if (!f.ward || !f.faction || atlases[f.faction]) continue;
    // A Mythic with its own ward flares that ward instead.
    if (f.rarity === "Mythic") continue;
    const file = resolve(RENDER_DIR, "assets/wards/faction", `${SIG_WARD_FACTIONS[f.faction]}.webp`);
    atlases[f.faction] = `data:image/webp;base64,${readFileSync(file).toString("base64")}`;
  }
  return { table, atlases };
}
