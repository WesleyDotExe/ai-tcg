// Victory boasts (render half, slice 1 of the owner-approved plan,
// 2026-10-19): the short animation that plays when an agent wins a match.
//
// A boast is a new event category, "victory" (EFFECTS.md), with one grammar
// for every boast: it RISES and RADIATES from the winner's side of the board
// and ends on the winner's name. It never moves toward the loser and never
// touches the loser's cards or panel, so a boast can borrow shapes that
// already mean something elsewhere (Aegis plates, Null's dark star) without
// a viewer reading "the loser's cards are being destroyed".
//
// Three parts, the same split as the other FX modules:
//   BOAST_SPECS: each boast as data, a list of beats over a small set of
//     victory primitives (panel, wall, embers, flash, gather, lock, name).
//     Adding a boast is a new spec, not new drawing code (slice 2 adds the
//     other three starter boasts and the primitives they need).
//   boastPlan(spec, geom, seed): the beats laid out on the winner's real
//     geometry (their row of slots, their side of the board, their panel) as
//     plain marks with absolute times. boastPlanProblem(plan, geom) checks the
//     grammar on that plan: every mark inside the winner's side, nothing
//     inside the loser's, no piece ever moving down, sparks only upward and
//     only as far as the side reaches. The tests run it over both seats, a
//     full and an empty row, desktop and phone layouts, and the page runs it
//     before playing: a plan that breaks the grammar plays as the still.
//   BOAST (runtime): a CFX plug-in that plays a plan on the replay's
//     canvases, plus the DOM parts (the winner's panel lit, the loser's side
//     dimmed, the name plate, the Skip button). Reduced motion (or no canvas)
//     plays boastStill: the final pose, still, with the name, about 1 s.
//
// The render plays whichever boast it is told to (boastIdFor: the match
// record's boast once slice 3 reads it, else the winner's faction starter
// boast); it never picks one itself. Same single-source rule as the rest:
// the page embeds BOAST_PURE_SOURCE verbatim and Node evaluates the same
// text for the tests.

export const BOAST_PURE_SOURCE = String.raw`
  // How long a boast may run, the reduced-motion still, and the wait after
  // the lethal beat (the lethal flash peaks, the winner's HP bar settles).
  var BOAST_MS_MAX = 3200, BOAST_STILL_MS = 1000, BOAST_LEAD_MS = 900;
  // The catalogue's starter boast per faction (economy/src/cosmetics.ts
  // STARTER_BOASTS; a test keeps the ids and names in step).
  var BOAST_STARTER = { Aegis: 'boast-aegis-shield-slam', Swarm: 'boast-swarm-hive-burst', Null: 'boast-null-void-collapse', Cortex: 'boast-cortex-data-cascade' };
  var BOAST_PRIMS = ['panel', 'wall', 'embers', 'flash', 'veil', 'gather', 'lock', 'name'];
  // Each boast as data. Times in ms from the boast's start; sizes as a share
  // of a slot's width; sprites are names in the FX atlases (FX_SP).
  var BOAST_SPECS = {
    'boast-aegis-shield-slam': {
      id: 'boast-aegis-shield-slam', name: 'Shield Slam', faction: 'Aegis', ms: 3000,
      beats: [
        // The winner's panel lights first; the loser's side dims (the host).
        { p: 'panel', at: 0 },
        // Hex plates slam UP out of the floor of every slot, centre first,
        // two to a slot, into a wall along the winner's row.
        { p: 'wall', at: 120, sprite: 'hexPlate', perSlot: 2, rise: 170, stagger: 70, size: 0.56, order: 'centreOut', sound: 'impact' },
        // Embers lift off the wall while it stands.
        { p: 'embers', at: 360, until: 2350, every: 70 },
        // The wall locks as one: a flat shock runs along the row.
        { p: 'flash', at: 1180 },
        // A dark wash over the winner's own row, so the crest and the name
        // read over the cards (it never reaches the loser's side).
        { p: 'veil', at: 1440, ms: 360, a: 0.62 },
        // The bottom plates lift into a hex crest over the name; the top
        // plates rise away and fade.
        { p: 'gather', at: 1480, ms: 560, stagger: 45, formation: 'hexRing' },
        // The crest locks: shock, flare, a ring, sparks up, the sting.
        { p: 'lock', at: 2120, sound: 'boast' },
        // The winner's name, under the crest.
        { p: 'name', at: 2160 }
      ]
    }
  };

  // Which boast plays: the match record's (once slice 3 reads it) when the
  // render can draw it, else the winner's faction starter boast, else none.
  function boastIdFor(recordId, faction) {
    if (recordId && BOAST_SPECS[recordId]) return recordId;
    var s = BOAST_STARTER[faction];
    return s && BOAST_SPECS[s] ? s : null;
  }

  // Why a spec can't be played, or null.
  function boastSpecProblem(spec) {
    if (!spec || typeof spec.id !== 'string' || !spec.id) return 'a boast needs an id';
    if (!(spec.ms > 0) || spec.ms > BOAST_MS_MAX) return spec.id + ': length must be 1-' + BOAST_MS_MAX + ' ms';
    if (!spec.beats || !spec.beats.length) return spec.id + ': no beats';
    var last = -1, named = false, i;
    for (i = 0; i < spec.beats.length; i++) {
      var b = spec.beats[i];
      if (BOAST_PRIMS.indexOf(b.p) < 0) return spec.id + ': unknown primitive "' + b.p + '"';
      if (!(b.at >= 0) || b.at < last) return spec.id + ': beats must be in time order';
      if (b.at >= spec.ms) return spec.id + ': beat "' + b.p + '" starts after the boast ends';
      if (b.p === 'gather' && !spec.beats.some(function (x) { return x.p === 'wall' && x.at < b.at; })) return spec.id + ': gather needs a wall before it';
      if (b.p === 'name') named = true;
      last = b.at;
    }
    if (!named) return spec.id + ': a boast ends on the winner\'s name';
    return null;
  }

  function boastRng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function boastCx(r) { return (r.l + r.r) / 2; }
  function boastCy(r) { return (r.t + r.b) / 2; }

  // boastPlan(spec, geom, seed) -> { id, faction, ms, pieces, marks, anchor }
  //   geom: { band, panel, slots: [{ l, t, r, b, filled }], loser: [rects] }
  //     in document pixels (rects as { l, t, r, b }). band is the winner's
  //     side of the board, panel the winner's HUD panel.
  //   pieces: sprites that move along keyframes [{ t, x, y, s, a }] (the
  //     runtime eases between keys; key.e names the easing into that key).
  //   marks: one-shot moments at time t: shock, flare, ring, sparks, grid,
  //     sound, duck, panel, pulse, name, end.
  function boastPlan(spec, geom, seed) {
    var rand = boastRng(seed == null ? 1 : seed);
    var band = geom.band, bw = band.r - band.l, bh = band.b - band.t, cx = boastCx(band);
    var slots = (geom.slots || []).slice();
    var pieces = [], marks = [], crestPieces = [];
    var slotW = slots.length ? Math.min.apply(null, slots.map(function (s) { return s.r - s.l; })) : Math.min(118, bw / 6);
    var slotH = slots.length ? Math.min.apply(null, slots.map(function (s) { return s.b - s.t; })) : Math.min(158, bh * 0.85);
    // The crest sits in the upper part of the winner's side, the name under it.
    var crest = { x: cx, y: band.t + bh * 0.34, r: Math.max(12, Math.min(bh * 0.19, bw * 0.12, 50)) };
    var nameY = band.t + bh * 0.8;
    var wallBeat = null, ends = spec.ms;
    // Sparks fly upward only as far as the winner's side reaches: a burst
    // near the top of the side flies slower (or not at all).
    function mark(m) {
      if (m.k === 'sparks') {
        var room = Math.min(m.y - band.t - 3, (Math.min(m.x - band.l, band.r - m.x) - 3) / Math.sin(m.spread));
        var reach = m.spd * 1.05 * m.life * 1.15;
        if (reach > room) m.spd = m.spd * room / reach;
        if (!(m.spd >= 25)) return null;
      }
      marks.push(m); return m;
    }

    spec.beats.forEach(function (b) {
      if (b.p === 'panel') mark({ k: 'panel', t: b.at });
      else if (b.p === 'wall') {
        wallBeat = b;
        var order = slots.map(function (s, i) { return i; });
        if (b.order === 'centreOut') order.sort(function (x, y) { return Math.abs(boastCx(slots[x]) - cx) - Math.abs(boastCx(slots[y]) - cx) || boastCx(slots[x]) - boastCx(slots[y]); });
        order.forEach(function (si, k) {
          var s = slots[si], sh = s.b - s.t, sw = s.r - s.l;
          var size = Math.min(sw * b.size, sh * 0.8 / b.perSlot);
          var T = b.at + k * b.stagger;
          for (var j = 0; j < b.perSlot; j++) {
            // Rest a little above the slot's floor so even the bottom plate
            // has room to rise; it starts smaller, just above the side's edge.
            var restY = s.b - sh * (0.32 + j * 0.8 / b.perSlot), x = boastCx(s);
            var fromY = Math.max(restY, Math.min(band.b - size * 0.35 - 1, restY + sh * 0.5));
            var t0 = T + j * 40, t1 = t0 + b.rise;
            pieces.push({ sp: b.sprite, rot: 0, row: j, slot: si, keys: [
              { t: t0, x: x, y: fromY, s: size * 0.7, a: 0 },
              { t: t1, x: x, y: restY, s: size, a: 1, e: 'slam' }
            ] });
            // The landing: a small shock and sparks thrown upward.
            mark({ k: 'shock', t: t1, x: x, y: restY, R: size * 0.42, sx: 1, sy: 0.6 });
            mark({ k: 'sparks', t: t1, x: x, y: restY - size * 0.3, n: 5, spd: 150, life: 0.45, angle: -Math.PI / 2, spread: 0.7 });
            if (j === 0) {
              mark({ k: 'grid', t: t1, x: x, y: restY, f: 260, r: Math.min(60, sh * 0.2) });
              if (b.sound) mark({ k: 'sound', t: t1, kind: b.sound, tier: 'subtle', x: x });
            }
          }
        });
      } else if (b.p === 'embers') {
        var until = Math.min(b.until || ends, ends);
        for (var t = b.at; t < until && pieces.length; t += b.every) {
          var pc = pieces[(rand() * pieces.length) | 0], last = pc.keys[pc.keys.length - 1];
          if (last.t > t) continue;
          mark({ k: 'sparks', t: t, x: last.x + (rand() - 0.5) * last.s * 0.6, y: last.y - last.s * 0.35, n: 2, spd: 70, life: 0.7, angle: -Math.PI / 2, spread: 0.35, ember: true });
        }
      } else if (b.p === 'flash') {
        var rowY = slots.length ? boastCy({ t: Math.min.apply(null, slots.map(function (s) { return s.t; })), b: Math.max.apply(null, slots.map(function (s) { return s.b; })) }) : boastCy(band);
        mark({ k: 'pulse', t: b.at, ms: 380 });
        mark({ k: 'shock', t: b.at, x: cx, y: rowY, R: Math.min(bw * 0.2, 150), sx: 2.2, sy: 0.25 });
        mark({ k: 'sound', t: b.at, kind: 'block', tier: 'normal', x: cx });
      } else if (b.p === 'veil') {
        mark({ k: 'veil', t: b.at, ms: b.ms, a: b.a, l: band.l + 4, t2: band.t + 4, r: band.r - 4, b: band.b - 4 });
      } else if (b.p === 'gather') {
        // Hex ring around the crest: six places, flat top. Each takes the
        // nearest plate that sits at or below it (a piece only ever rises).
        var targets = [];
        for (var q = 0; q < 6; q++) {
          var an = -Math.PI / 2 + q * Math.PI / 3;
          targets.push({ x: crest.x + Math.cos(an) * crest.r * 1.15, y: crest.y + Math.sin(an) * crest.r * 1.15 });
        }
        targets.sort(function (u, v) { return v.y - u.y; });
        var free = pieces.slice();
        var crestSize = crest.r * 1.05;
        targets.forEach(function (tg, n) {
          var best = -1, bd = Infinity;
          free.forEach(function (pc, i) {
            var k = pc.keys[pc.keys.length - 1];
            if (k.y + 0.5 < tg.y) return;
            var d = Math.hypot(k.x - tg.x, k.y - tg.y);
            if (d < bd) { bd = d; best = i; }
          });
          var t0 = b.at + n * b.stagger, t1 = t0 + b.ms;
          if (best >= 0) {
            var pc = free.splice(best, 1)[0], k0 = pc.keys[pc.keys.length - 1];
            pc.keys.push({ t: t0, x: k0.x, y: k0.y, s: k0.s, a: 1 });
            pc.keys.push({ t: t1, x: tg.x, y: tg.y, s: crestSize, a: 1, e: 'out' });
            crestPieces.push(pc);
          } else {
            // Nothing below this place (an empty board has its plates, but
            // a strange layout might not): the plate forms in place.
            var np = { sp: wallBeat ? wallBeat.sprite : 'hexPlate', rot: 0, keys: [{ t: t1 - 160, x: tg.x, y: tg.y, s: crestSize * 0.6, a: 0 }, { t: t1, x: tg.x, y: tg.y, s: crestSize, a: 1, e: 'out' }] };
            pieces.push(np); crestPieces.push(np);
          }
        });
        // The rest rise away and fade, never past the top of the side.
        free.forEach(function (pc, n) {
          var k0 = pc.keys[pc.keys.length - 1], t0 = b.at + (n % 6) * b.stagger;
          var topY = Math.min(k0.y, band.t + k0.s * 0.5 + 2);
          pc.keys.push({ t: t0, x: k0.x, y: k0.y, s: k0.s, a: 1 });
          pc.keys.push({ t: t0 + b.ms * 0.9, x: k0.x, y: topY, s: k0.s * 0.8, a: 0, e: 'out' });
        });
      } else if (b.p === 'lock') {
        // The crest's centre plate forms; the moment radiates outward.
        var cp = { sp: wallBeat ? wallBeat.sprite : 'hexPlate', rot: 0, centre: true, keys: [
          { t: b.at, x: crest.x, y: crest.y, s: crest.r * 0.7, a: 0 },
          { t: b.at + 140, x: crest.x, y: crest.y, s: crest.r * 1.25, a: 1, e: 'out' }
        ] };
        pieces.push(cp); crestPieces.push(cp);
        mark({ k: 'shock', t: b.at, x: crest.x, y: crest.y, R: crest.r * 1.1, sx: 1, sy: 1 });
        mark({ k: 'flare', t: b.at, x: crest.x, y: crest.y, s: crest.r * 2.2 });
        mark({ k: 'ring', t: b.at, x: crest.x, y: crest.y, R: crest.r * 1.6 });
        mark({ k: 'sparks', t: b.at, x: crest.x, y: crest.y - crest.r * 0.4, n: 18, spd: 190, life: 0.5, angle: -Math.PI / 2, spread: 1.2 });
        mark({ k: 'grid', t: b.at, x: crest.x, y: crest.y, f: 900, r: Math.min(bh * 0.3, 90) });
        mark({ k: 'pulse', t: b.at, ms: 420 });
        if (b.sound) {
          mark({ k: 'sound', t: b.at, kind: b.sound, tier: 'spectacle', x: crest.x });
          mark({ k: 'duck', t: b.at, ms: Math.max(600, ends - b.at + 300) });
        }
      } else if (b.p === 'name') {
        mark({ k: 'name', t: b.at, x: cx, y: nameY, w: Math.min(bw * 0.86, 640), h: Math.min(bh * 0.26, 46) });
      }
    });

    // Everything holds its last key to the end, then the crest fades as the
    // result line lands.
    pieces.forEach(function (pc) {
      var k = pc.keys[pc.keys.length - 1];
      if (k.a > 0) {
        if (k.t < ends) pc.keys.push({ t: ends, x: k.x, y: k.y, s: k.s, a: k.a });
        pc.keys.push({ t: Math.max(k.t, ends) + 320, x: k.x, y: k.y, s: k.s, a: 0 });
      }
    });
    mark({ k: 'end', t: ends });
    marks.sort(function (u, v) { return u.t - v.t; });
    return { id: spec.id, faction: spec.faction, name: spec.name, ms: ends, pieces: pieces, marks: marks, crest: crest, crestPieces: crestPieces.length };
  }

  // The reduced-motion still: the plan's final pose (everything that still
  // shows at the end), held for BOAST_STILL_MS, with the panel and the name.
  // No shocks, sparks, grid or flares.
  function boastStill(plan) {
    var pieces = [], ms = BOAST_STILL_MS;
    plan.pieces.forEach(function (pc) {
      var at = boastPieceAt(pc, plan.ms);
      if (!at || at.a < 0.5) return;
      pieces.push({ sp: pc.sp, rot: pc.rot, centre: pc.centre, keys: [
        { t: 0, x: at.x, y: at.y, s: at.s, a: at.a },
        { t: ms, x: at.x, y: at.y, s: at.s, a: at.a },
        { t: ms + 200, x: at.x, y: at.y, s: at.s, a: 0 }
      ] });
    });
    var marks = plan.marks.filter(function (m) { return m.k === 'panel' || m.k === 'name' || m.k === 'veil' || (m.k === 'sound' && m.tier === 'spectacle'); })
      .map(function (m) { var c = {}; for (var k in m) c[k] = m[k]; c.t = 0; if (c.k === 'veil') c.ms = 0; return c; });
    marks.push({ k: 'end', t: ms });
    return { id: plan.id, faction: plan.faction, name: plan.name, ms: ms, pieces: pieces, marks: marks, crest: plan.crest, still: true };
  }

  // The victory grammar, checked on a laid-out plan. Returns the first
  // problem, or null. A piece's whole sprite and every shock, flare, ring,
  // spark reach, grid push and the name plate stay inside the winner's side
  // (the panel only lights, it draws nothing); none touches a loser rect;
  // no piece ever moves down; sparks only fly upward.
  function boastPlanProblem(plan, geom) {
    var band = geom.band, tol = 2, loser = geom.loser || [];
    function inside(l, t, r, b) { return l >= band.l - tol && r <= band.r + tol && t >= band.t - tol && b <= band.b + tol; }
    function hitsLoser(l, t, r, b) { return loser.some(function (x) { return l < x.r && r > x.l && t < x.b && b > x.t; }); }
    function box(l, t, r, b, what) {
      if (!inside(l, t, r, b)) return what + ' leaves the winner\'s side';
      if (hitsLoser(l, t, r, b)) return what + ' touches the loser';
      return null;
    }
    var i, j, p;
    for (i = 0; i < plan.pieces.length; i++) {
      var pc = plan.pieces[i];
      for (j = 0; j < pc.keys.length; j++) {
        var k = pc.keys[j], h = k.s / 2;
        if (k.a > 0 || (j > 0 && pc.keys[j - 1].a > 0)) { p = box(k.x - h, k.y - h, k.x + h, k.y + h, 'piece ' + i); if (p) return p; }
        if (j > 0 && k.y > pc.keys[j - 1].y + 0.5) return 'piece ' + i + ' moves down';
        if (j > 0 && k.t < pc.keys[j - 1].t) return 'piece ' + i + ' keys out of order';
      }
    }
    for (i = 0; i < plan.marks.length; i++) {
      var m = plan.marks[i];
      if (m.t > plan.ms + 1) return m.k + ' after the boast ends';
      if (m.k === 'shock') {
        var hx = m.R * 1.05 * (m.sx || 1), hy = m.R * 1.05 * (m.sy || 1);
        p = box(m.x - hx, m.y - hy, m.x + hx, m.y + hy, 'shock'); if (p) return p;
      } else if (m.k === 'flare') {
        var fh = m.s * 0.55; p = box(m.x - fh, m.y - fh, m.x + fh, m.y + fh, 'flare'); if (p) return p;
      } else if (m.k === 'ring') {
        p = box(m.x - m.R, m.y - m.R, m.x + m.R, m.y + m.R, 'ring'); if (p) return p;
      } else if (m.k === 'sparks') {
        if (Math.abs(m.angle + Math.PI / 2) > 1e-9 || !(m.spread < Math.PI / 2)) return 'sparks must fly upward';
        var reach = m.spd * 1.05 * m.life * 1.15, side = reach * Math.sin(m.spread);
        p = box(m.x - side, m.y - reach, m.x + side, m.y, 'sparks'); if (p) return p;
      } else if (m.k === 'grid') {
        p = box(m.x - m.r, m.y - m.r, m.x + m.r, m.y + m.r, 'grid push'); if (p) return p;
      } else if (m.k === 'name') {
        p = box(m.x - m.w / 2, m.y - m.h / 2, m.x + m.w / 2, m.y + m.h / 2, 'name'); if (p) return p;
      } else if (m.k === 'veil') {
        p = box(m.l, m.t2, m.r, m.b, 'veil'); if (p) return p;
      }
    }
    if (!plan.marks.some(function (m) { return m.k === 'name'; })) return 'no name';
    return null;
  }

  // Where a piece is at time t (ms): eased between its keys.
  //   slam: accelerates into the key and stops dead (a plate hitting home);
  //   out: decelerates into it.
  function boastPieceAt(pc, t) {
    var ks = pc.keys;
    if (t < ks[0].t) return null;
    for (var i = 1; i < ks.length; i++) {
      if (t <= ks[i].t) {
        var a = ks[i - 1], b = ks[i], u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
        var e = b.e === 'slam' ? u * u * u : b.e === 'out' ? 1 - Math.pow(1 - u, 3) : u;
        return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, s: a.s + (b.s - a.s) * e, a: a.a + (b.a - a.a) * (b.e === 'slam' ? Math.min(1, u * 3) : u) };
      }
    }
    return null;
  }
`;

export const BOAST_RUNTIME_SOURCE = String.raw`
  var BOAST = (function () {
    var cur = null, plugged = false, stats = { played: 0, skipped: 0, still: 0, refused: 0, last: null };
    function rect(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect(), sx = window.scrollX, sy = window.scrollY;
      return { l: r.left + sx, t: r.top + sy, r: r.right + sx, b: r.bottom + sy };
    }
    // The winner's geometry, read from the elements the host passes:
    //   { band, panel, row, loser: [elements] }
    function geomOf(els) {
      var slots = [];
      // The row's children are its slots: an empty slot, or the card that
      // fills one (a replay puts the card itself in the row).
      if (els.row) Array.prototype.forEach.call(els.row.children, function (s) {
        if (!s.classList.contains('slot') && !s.classList.contains('card')) return;
        var r = rect(s); if (r.r - r.l < 4) return;
        r.filled = s.classList.contains('card') || !!s.querySelector('.card'); slots.push(r);
      });
      return { band: rect(els.band), panel: rect(els.panel), slots: slots, loser: (els.loser || []).filter(Boolean).map(rect) };
    }
    function rgbOf(f) { return fxRgbOf(f); }
    function plugin() {
      return {
        update: function () {
          if (!cur) return;
          var now = performance.now();
          cur.t = now - cur.t0;
          while (cur.next < cur.plan.marks.length && cur.plan.marks[cur.next].t <= cur.t) fire(cur.plan.marks[cur.next++]);
          if (cur && cur.t > cur.plan.ms + 400 && cur.ended) cur = null;
        },
        drawFloor: function () {},
        drawTop: function (ctx) {
          if (!cur) return;
          var K = CFX.kit, c = cur.rgb, glow = 0;
          cur.pulses = cur.pulses.filter(function (p) { return cur.t < p.t + p.ms; });
          cur.pulses.forEach(function (p) { glow = Math.max(glow, 1 - (cur.t - p.t) / p.ms); });
          if (cur.veil) {
            var v = cur.veil, va = v.a * (v.ms > 0 ? Math.min(1, (cur.t - v.t) / v.ms) : 1);
            if (cur.t > cur.plan.ms) va *= Math.max(0, 1 - (cur.t - cur.plan.ms) / 320);
            if (cur.ended && !cur.fadeOut) va = 0;
            if (va > 0.003) {
              ctx.globalCompositeOperation = 'source-over';
              ctx.fillStyle = 'rgba(4,6,12,' + va.toFixed(3) + ')';
              var vr = Math.min(10, (v.r - v.l) / 8), vw = v.r - v.l, vh = v.b - v.t2;
              ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(v.l, v.t2, vw, vh, vr); else ctx.rect(v.l, v.t2, vw, vh);
              ctx.fill();
              ctx.globalCompositeOperation = 'lighter';
            }
          }
          var n = 0;
          for (var i = 0; i < cur.plan.pieces.length; i++) {
            var pc = cur.plan.pieces[i], at = boastPieceAt(pc, cur.t);
            if (!at || at.a <= 0.003 || at.s <= 0) continue;
            n++;
            var tx = K.tex(FX_SP[pc.sp], c);
            K.drawGlow(ctx, at.x, at.y, at.s * (0.75 + glow * 0.5), c, at.a * (0.35 + glow * 0.6));
            ctx.globalAlpha = Math.min(1, at.a);
            ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(pc.rot || 0);
            ctx.drawImage(tx, -at.s / 2, -at.s / 2, at.s, at.s);
            if (glow > 0 || pc.centre) { ctx.globalAlpha = Math.min(1, at.a) * Math.max(glow * 0.8, pc.centre ? 0.45 : 0); ctx.drawImage(K.tex(FX_SP[pc.sp], K.mix(c, [255, 255, 255], 0.6)), -at.s / 2, -at.s / 2, at.s, at.s); }
            ctx.restore();
          }
          ctx.globalAlpha = 1;
          if (n > stats.peakPieces) stats.peakPieces = n;
          stats.drawn++;
        },
        alive: function () { return !!cur; },
        hasTop: function () { return !!cur; },
        clear: function () {}
      };
    }
    function fire(m) {
      var K = CFX.kit, c = cur.rgb, still = cur.plan.still;
      stats.fired[m.k] = (stats.fired[m.k] || 0) + 1;
      if (m.k === 'shock' && !still) K.shock(m.x, m.y, c, m.R, 0.42, m.sx, m.sy);
      else if (m.k === 'flare' && !still) K.flare(m.x, m.y, c, m.s, 0.5);
      else if (m.k === 'ring' && !still) K.ring(m.x, m.y, c, m.R, 0.6, 2.5);
      else if (m.k === 'sparks' && !still) K.sparks(m.x, m.y, m.ember ? K.mix(c, [255, 220, 150], 0.35) : c, m.n, m.spd, { angle: m.angle, spread: m.spread, life: m.life, size: m.ember ? 1.6 : undefined });
      else if (m.k === 'grid' && !still) { K.gridForce(m.x, m.y, m.f, m.r); K.gridTint(m.x, m.y, c, m.r); }
      else if (m.k === 'pulse') cur.pulses.push({ t: m.t, ms: m.ms });
      else if (m.k === 'veil') cur.veil = m;
      else if (m.k === 'sound' && typeof SND !== 'undefined') SND.play(m.kind, cur.plan.faction, m.tier, { left: m.x - window.scrollX, width: 0 });
      else if (m.k === 'duck' && typeof MUS !== 'undefined' && MUS.duckHold) MUS.duckHold(m.ms / 1000);
      else if (m.k === 'panel') { if (cur.els.panel) { cur.els.panel.style.setProperty('--fc', fxKitOf(cur.plan.faction).col); cur.els.panel.classList.add('boast-panel'); } }
      else if (m.k === 'name') showName(m);
      else if (m.k === 'end') finish('end');
    }
    function showName(m) {
      var el = document.createElement('div');
      el.className = 'boast-name' + (cur.plan.still ? ' still' : '');
      el.style.setProperty('--fc', fxKitOf(cur.plan.faction).col);
      el.style.left = (m.x - m.w / 2) + 'px'; el.style.top = (m.y - m.h / 2) + 'px';
      el.style.width = m.w + 'px'; el.style.height = m.h + 'px';
      var nm = document.createElement('div'); nm.className = 'boast-who'; nm.textContent = cur.who;
      var tag = document.createElement('div'); tag.className = 'boast-tag'; tag.textContent = cur.plan.name.toUpperCase() + ' · VICTORY';
      el.appendChild(nm); el.appendChild(tag);
      document.body.appendChild(el);
      // Long names shrink to fit the plate, never cut off.
      var max = parseFloat(getComputedStyle(nm).fontSize) || 28;
      for (var fs = max; fs > 11 && nm.scrollWidth > m.w; fs -= 1) nm.style.fontSize = fs + 'px';
      cur.dom.push(el);
    }
    function onKey(e) { if (e.key === 'Escape' && cur && !cur.ended) { e.preventDefault(); skip(); } }
    function onDown(e) { if (cur && !cur.ended) skip(); }
    function teardown() {
      if (!cur) return;
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
      cur.dom.forEach(function (d) { d.classList.add('gone'); setTimeout(function () { d.remove(); }, 340); });
      cur.dom = [];
      if (cur.els.panel) cur.els.panel.classList.remove('boast-panel');
      (cur.els.dim || []).forEach(function (d) { if (d) d.classList.remove('boast-dim'); });
    }
    function finish(reason) {
      if (!cur || cur.ended) return;
      cur.ended = true;
      stats.last = { id: cur.plan.id, reason: reason, t: Math.round(cur.t), still: !!cur.plan.still };
      var done = cur.onEnd;
      teardown();
      // Skipped or cancelled: the pieces go at once. Ended: they fade out
      // on their own last keys while the result lands.
      if (reason !== 'end') cur = null; else cur.fadeOut = true;
      if (done) done(reason);
    }
    function skip() { if (cur && !cur.ended) { stats.skipped++; finish('skip'); } }
    function cancel() { if (cur) { var c0 = cur; c0.onEnd = null; finish('cancel'); cur = null; } }
    // play(id, els, opts): opts { who (the winner's name), onEnd(reason),
    // reduced, seed }. Returns the plan played (or null when nothing can be).
    function play(id, els, opts) {
      opts = opts || {};
      cancel();
      var spec = BOAST_SPECS[id];
      if (!spec || boastSpecProblem(spec)) { stats.refused++; if (opts.onEnd) opts.onEnd('none'); return null; }
      var reduced = opts.reduced != null ? !!opts.reduced : CFX.kit.reduced;
      // A boast the viewer can't see is no boast: on a phone the winner's
      // side may be scrolled away, so bring it into view first. The plan is
      // in document coordinates, so the scroll doesn't move it.
      if (els.band && els.band.scrollIntoView) {
        var vr = els.band.getBoundingClientRect(), vh = window.innerHeight || 0;
        if (vr.top < 0 || vr.bottom > vh) els.band.scrollIntoView({ block: vr.height > vh ? 'start' : 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      }
      var geom = geomOf(els);
      if (!geom.band) { stats.refused++; if (opts.onEnd) opts.onEnd('none'); return null; }
      var plan = boastPlan(spec, geom, opts.seed || 1);
      var problem = boastPlanProblem(plan, geom);
      var canDraw = CFX.isReady();
      if (problem || reduced || !canDraw) plan = boastStill(plan);
      if (plan.still) stats.still++;
      stats.played++;
      stats.problem = problem;
      stats.fired = {}; stats.peakPieces = 0; stats.drawn = 0;
      cur = { plan: plan, els: els, who: opts.who || '', onEnd: opts.onEnd || null, rgb: rgbOf(plan.faction), t0: performance.now(), t: 0, next: 0, pulses: [], dom: [], ended: false };
      (els.dim || []).forEach(function (d) { if (d) d.classList.add('boast-dim'); });
      // The Skip button sits at the top right of the winner's side.
      var sk = document.createElement('button');
      sk.type = 'button'; sk.className = 'boast-skip'; sk.textContent = 'Skip ▸▸';
      sk.style.top = (geom.band.t + 6) + 'px';
      document.body.appendChild(sk); cur.dom.push(sk);
      sk.style.left = (geom.band.r - sk.offsetWidth - 8) + 'px';
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('pointerdown', onDown, true);
      if (!plugged && canDraw) { CFX.plug(plugin()); plugged = true; }
      if (canDraw) CFX.kit.kick();
      else {
        // No canvas: the DOM parts still play (panel, name, end) on timers.
        plan.marks.forEach(function (m) { var me = cur; setTimeout(function () { if (cur === me && !me.ended) fire(m); }, m.t); });
        cur.next = plan.marks.length;
      }
      return plan;
    }
    return { play: play, skip: skip, cancel: cancel, active: function () { return !!cur && !cur.ended; }, geomOf: geomOf,
      stats: function () { return { active: !!cur && !cur.ended, t: cur ? Math.round(cur.t) : null, id: cur ? cur.plan.id : null, still: cur ? !!cur.plan.still : null, played: stats.played, skipped: stats.skipped, stillCount: stats.still, refused: stats.refused, problem: stats.problem || null, fired: stats.fired || {}, peakPieces: stats.peakPieces || 0, drawn: stats.drawn || 0, last: stats.last }; } };
  })();
`;

// The page's CSS for the boast's DOM parts. Reduced motion keeps the
// panel lit and the plate in place, without the rise or the pop.
export const BOAST_CSS = `
.boast-dim { opacity: 0.7; transition: opacity 300ms ease; }
.hud.boast-panel { box-shadow: 0 0 0 1px var(--fc, #fff), 0 0 22px var(--fc, #fff); transition: box-shadow 250ms ease; }
.boast-name { position: absolute; z-index: 96; pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; color: var(--fc); border-radius: 6px;
  background: linear-gradient(90deg, rgba(4,6,12,0), rgba(4,6,12,0.78) 14%, rgba(4,6,12,0.78) 86%, rgba(4,6,12,0)); animation: boast-rise 420ms cubic-bezier(.2,.9,.3,1.2) both; transition: opacity 320ms ease; }
.boast-name .boast-who { font-weight: bold; font-size: 28px; letter-spacing: 0.12em; white-space: nowrap; line-height: 1.1;
  text-shadow: 0 0 10px var(--fc), 0 0 2px #000, 0 2px 4px #000; }
.boast-name .boast-tag { font-size: 10px; letter-spacing: 0.3em; color: var(--ink, #dfe7ff); opacity: 0.85; margin-top: 2px; text-shadow: 0 1px 3px #000; }
.boast-name.gone, .boast-skip.gone { opacity: 0; }
@keyframes boast-rise { from { opacity: 0; transform: translateY(10px) scale(0.92); } to { opacity: 1; transform: none; } }
.boast-skip { position: absolute; z-index: 97; font: inherit; font-size: 0.72rem; letter-spacing: 0.06em; color: var(--ink, #dfe7ff);
  background: rgba(10,12,22,0.82); border: 1px solid var(--line, #334); border-radius: 4px; padding: 4px 9px; cursor: pointer; transition: opacity 320ms ease; }
.boast-skip:hover, .boast-skip:focus-visible { border-color: var(--ink, #dfe7ff); }
.turnbar .win.land { display: inline-block; animation: boast-land 520ms cubic-bezier(.2,.9,.3,1.3) both; }
@keyframes boast-land { from { opacity: 0; transform: translateY(6px) scale(1.25); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .boast-name, .turnbar .win.land { animation: none; } }
`;

export interface BoastRect { l: number; t: number; r: number; b: number }
export interface BoastSlot extends BoastRect { filled?: boolean }
export interface BoastGeom { band: BoastRect; panel?: BoastRect | null; slots: BoastSlot[]; loser?: BoastRect[] }
export interface BoastKey { t: number; x: number; y: number; s: number; a: number; e?: "slam" | "out" }
export interface BoastPiece { sp: string; rot: number; centre?: boolean; row?: number; slot?: number; keys: BoastKey[] }
export interface BoastMark {
  k: "shock" | "flare" | "ring" | "sparks" | "grid" | "sound" | "duck" | "panel" | "pulse" | "veil" | "name" | "end";
  t: number;
  [key: string]: unknown;
}
export interface BoastBeat { p: string; at: number; [key: string]: unknown }
export interface BoastSpec { id: string; name: string; faction: string; ms: number; beats: BoastBeat[] }
export interface BoastPlan {
  id: string; faction: string; name: string; ms: number;
  pieces: BoastPiece[]; marks: BoastMark[];
  crest: { x: number; y: number; r: number };
  crestPieces?: number; still?: boolean;
}

const impl = new Function(`${BOAST_PURE_SOURCE}; return { BOAST_MS_MAX: BOAST_MS_MAX, BOAST_STILL_MS: BOAST_STILL_MS, BOAST_LEAD_MS: BOAST_LEAD_MS, BOAST_STARTER: BOAST_STARTER, BOAST_PRIMS: BOAST_PRIMS, BOAST_SPECS: BOAST_SPECS, boastIdFor: boastIdFor, boastSpecProblem: boastSpecProblem, boastPlan: boastPlan, boastStill: boastStill, boastPlanProblem: boastPlanProblem, boastPieceAt: boastPieceAt };`)() as {
  BOAST_MS_MAX: number;
  BOAST_STILL_MS: number;
  BOAST_LEAD_MS: number;
  BOAST_STARTER: Record<string, string>;
  BOAST_PRIMS: string[];
  BOAST_SPECS: Record<string, BoastSpec>;
  boastIdFor: (recordId: string | null | undefined, faction: string) => string | null;
  boastSpecProblem: (spec: BoastSpec) => string | null;
  boastPlan: (spec: BoastSpec, geom: BoastGeom, seed?: number) => BoastPlan;
  boastStill: (plan: BoastPlan) => BoastPlan;
  boastPlanProblem: (plan: BoastPlan, geom: BoastGeom) => string | null;
  boastPieceAt: (pc: BoastPiece, t: number) => { x: number; y: number; s: number; a: number } | null;
};

export const BOAST_MS_MAX = impl.BOAST_MS_MAX;
export const BOAST_STILL_MS = impl.BOAST_STILL_MS;
export const BOAST_LEAD_MS = impl.BOAST_LEAD_MS;
export const BOAST_STARTER = impl.BOAST_STARTER;
export const BOAST_PRIMS = impl.BOAST_PRIMS;
export const BOAST_SPECS = impl.BOAST_SPECS;
export const boastIdFor = impl.boastIdFor;
export const boastSpecProblem = impl.boastSpecProblem;
export const boastPlan = impl.boastPlan;
export const boastStill = impl.boastStill;
export const boastPlanProblem = impl.boastPlanProblem;
export const boastPieceAt = impl.boastPieceAt;
