// Victory boasts (render half, slice 1 of the owner-approved plan,
// 2026-10-19): the short animation that plays when an agent wins a match.
//
// A boast is a new event category, "victory" (EFFECTS.md), with one grammar
// for every boast: it RISES and RADIATES from the winner's side of the board
// and ends on the winner's name, on a plate that says "<NAME> WINS" (owner
// 2026-10-21; a close win shows "CLOSE CALL" on the plate first). It never
// moves toward the loser and never
// touches the loser's cards or panel, so a boast can borrow shapes that
// already mean something elsewhere (Aegis plates, Null's dark star) without
// a viewer reading "the loser's cards are being destroyed".
//
// Three parts, the same split as the other FX modules:
//   BOAST_SPECS: each boast as data, a list of beats over a small set of
//     victory primitives (slice 1: panel, wall, embers, flash, veil, gather,
//     lock, name; slice 2: bloom, burst, stream, star, pull, bars). Adding a
//     boast is a new spec, not new drawing code. All four starter boasts are
//     drawn (slice 2). Slice 2b (render session 33) adds the two neutral
//     Season 0 boasts, Boot Sequence and Dial-Up Fireworks, and the
//     primitives they need: crt, scroll, banner, skyline and rockets, drawn
//     by the runtime as code-drawn shapes (text, a 5x7 dot font, towers,
//     pixels) rather than atlas sprites. A neutral boast carries its own
//     colour; its panel and sting take the winner's faction.
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
// The render plays whichever boast it is told to (boastFromRecord: the
// match record's boast, else the winner's faction starter boast); it never
// picks one itself. Same single-source rule as the rest:
// the page embeds BOAST_PURE_SOURCE verbatim and Node evaluates the same
// text for the tests.

export const BOAST_PURE_SOURCE = String.raw`
  // How long a boast may run, the reduced-motion still, and the wait after
  // the lethal beat (the lethal flash peaks, the winner's HP bar settles).
  var BOAST_MS_MAX = 3200, BOAST_STILL_MS = 1000, BOAST_LEAD_MS = 900;
  // How fast whatever the lethal beat left on the loser's side fades as the
  // boast starts (the page's CFX.fadeOutIn).
  var BOAST_CLEAR_MS = 280;
  // A close win (owner 2026-10-21): the plate shows the close-call line
  // first, alone, for this long, then the winner's line. Everything else in
  // the boast keeps its time, so a close win runs this much longer and the
  // winner's line holds as long as in any other win.
  var BOAST_CLOSE_MS = 600;
  // The plate's words. Every boast ends on "<AGENT NAME> WINS"; a close win
  // shows BOAST_CLOSE_LINE before it.
  var BOAST_WINS = 'WINS', BOAST_CLOSE_LINE = 'CLOSE CALL';
  // How far a flare of size s lights, from its centre: CFX's flare blooms
  // to 0.6 s x 1.2 (canvasFx.ts, flare()).
  var BOAST_FLARE_REACH = 0.72;
  // The catalogue's starter boast per faction (economy/src/cosmetics.ts
  // STARTER_BOASTS; a test keeps the ids and names in step).
  var BOAST_STARTER = { Aegis: 'boast-aegis-shield-slam', Swarm: 'boast-swarm-hive-burst', Null: 'boast-null-void-collapse', Cortex: 'boast-cortex-data-cascade' };
  // The victory primitives. Slice 1: panel, wall, embers, flash, veil,
  // gather, lock, name. Slice 2: bloom and burst (Swarm), star, pull and
  // bars (Null), stream (Cortex). Slice 2b, the Season 0 boasts: crt,
  // scroll and banner (Boot Sequence), skyline and rockets (Dial-Up
  // Fireworks).
  var BOAST_PRIMS = ['panel', 'wall', 'embers', 'flash', 'veil', 'gather', 'lock', 'name', 'bloom', 'burst', 'stream', 'star', 'pull', 'bars', 'crt', 'scroll', 'banner', 'skyline', 'rockets'];
  // Dial-Up Fireworks' colours, one per burst, and its neon skyline's edges.
  var BOAST_NEON = ['#ff4fd8', '#4ff0ff', '#ffe14f', '#7dff7a', '#ff9a3d', '#b18cff'];
  function boastHex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  // A 5x7 dot font for the boasts that spell in pixels (Boot Sequence's
  // SYSTEM READY, Dial-Up Fireworks' name). It covers every character an
  // agent name may use (letters, digits, space and ' . - _) and a little
  // more: seven rows of five bits, two hex digits a row, the left column
  // the high bit. Anything else draws as an empty box.
  var BOAST_FONT = {
    A: '0e11111f111111', B: '1e11111e11111e', C: '0e11101010110e', D: '1e11111111111e', E: '1f10101e10101f',
    F: '1f10101e101010', G: '0e11101711110f', H: '1111111f111111', I: '0e04040404040e', J: '0702020202120c',
    K: '11121418141211', L: '1010101010101f', M: '111b1515111111', N: '11111915131111', O: '0e11111111110e',
    P: '1e11111e101010', Q: '0e11111115120d', R: '1e11111e141211', S: '0f10100e01011e', T: '1f040404040404',
    U: '1111111111110e', V: '11111111110a04', W: '1111111515150a', X: '11110a040a1111', Y: '1111110a040404',
    Z: '1f01020408101f',
    '0': '0e11131519110e', '1': '040c040404040e', '2': '0e11010204081f', '3': '1f02040201110e', '4': '02060a121f0202',
    '5': '1f101e0101110e', '6': '0608101e11110e', '7': '1f010204080808', '8': '0e11110e11110e', '9': '0e11110f01020c',
    ' ': '00000000000000', '-': '0000001f000000', '.': '00000000000c0c', "'": '0c040800000000', '_': '0000000000001f',
    '!': '04040404040004', '?': '0e110102040004', ':': '000c0c000c0c00', ',': '000000000c0408', '&': '0c12140815120d',
    '/': '01010204081010', '#': '0a0a1f0a1f0a0a', '+': '0004041f040400', '(': '02040808080402', ')': '08040202020408',
    '>': '10080402040810'
  };
  function boastGlyph(ch) {
    var s = BOAST_FONT[ch];
    // An accented letter draws as its plain letter.
    if (s == null && ch.normalize) s = BOAST_FONT[ch.normalize('NFD').charAt(0)];
    if (s == null) s = '1f11111111111f';
    var rows = [];
    for (var i = 0; i < 7; i++) rows.push(parseInt(s.substr(i * 2, 2), 16));
    return rows;
  }
  // boastBits(lines) -> { cols, rows, chars, dots: [[col, row, char], ...] }:
  // lines of text in the dot font (upper case), a blank column between
  // characters, two blank rows between lines, each line centred. char
  // numbers the drawn characters (not spaces) in reading order; chars is
  // how many there are.
  function boastBits(lines) {
    var widths = lines.map(function (l) { return l.length ? l.length * 6 - 1 : 0; });
    var cols = Math.max.apply(null, widths.concat([1])), rows = lines.length * 9 - 2, dots = [], n = 0;
    lines.forEach(function (line, li) {
      var off = Math.floor((cols - widths[li]) / 2);
      for (var ci = 0; ci < line.length; ci++) {
        var ch = line.charAt(ci).toUpperCase();
        if (ch === ' ') continue;
        var g = boastGlyph(ch);
        for (var r = 0; r < 7; r++) for (var c = 0; c < 5; c++) if (g[r] & (16 >> c)) dots.push([off + ci * 6 + c, li * 9 + r, n]);
        n++;
      }
    });
    return { cols: cols, rows: rows, chars: n, dots: dots };
  }
  // The text in the dot font as large as it fits a w x h box: on one line,
  // or on two (split at the space nearest the middle) when that gives
  // bigger dots. cell: a dot's pitch in px, at most maxCell.
  function boastBitsFit(text, w, h, maxCell) {
    var one = boastBits([text]), best = { bits: one, cell: Math.min(w / one.cols, h / one.rows) };
    var sp = -1, mid = (text.length - 1) / 2;
    for (var i = 0; i < text.length; i++) if (text.charAt(i) === ' ' && (sp < 0 || Math.abs(i - mid) < Math.abs(sp - mid))) sp = i;
    if (sp > 0) {
      var two = boastBits([text.slice(0, sp), text.slice(sp + 1)]), c2 = Math.min(w / two.cols, h / two.rows);
      if (c2 > best.cell) best = { bits: two, cell: c2 };
    }
    best.cell = Math.min(best.cell, maxCell || Infinity);
    return best;
  }
  // The beats whose pieces a later gather can lift into a formation.
  var BOAST_CARRIERS = { wall: 'wall', burst: 'spore', stream: 'head' };
  // The shapes a gather lifts pieces into, over the name. Units are the
  // crest's radius; cells are listed bottom first (the planner fills them
  // in that order); size is a cell's sprite size; lock is where the lock's
  // own piece forms [x, y, size].
  var BOAST_FORMATIONS = {
    // Aegis: a hex ring of six plates; the lock's plate is its centre.
    hexRing: { size: 1.05, lock: [0, 0, 1.25], cells: (function () {
      var c = [];
      for (var q = 0; q < 6; q++) { var an = -Math.PI / 2 + q * Math.PI / 3; c.push([Math.cos(an) * 1.15, Math.sin(an) * 1.15]); }
      return c;
    })() },
    // Swarm: a rising column of spores, zig-zagging like a comb; the lock's
    // spore crowns it.
    sporeColumn: { size: 0.85, lock: [0, -1.1, 1.0], cells: [[-0.32, 1.05], [0.32, 0.7], [-0.32, 0.35], [0.32, 0], [-0.32, -0.35], [0.32, -0.7]] },
    // Cortex: wireframe blocks stacked three, two, then the lock's one.
    pyramid: { size: 0.95, lock: [0, -0.9, 1.0], cells: [[-1.0, 0.9], [0, 0.9], [1.0, 0.9], [-0.5, 0], [0.5, 0]] }
  };
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
    },
    'boast-swarm-hive-burst': {
      id: 'boast-swarm-hive-burst', name: 'Hive Burst', faction: 'Swarm', ms: 3000,
      beats: [
        { p: 'panel', at: 0 },
        // A dark wash first, so green on the winner's own green cards reads.
        { p: 'veil', at: 60, ms: 420, a: 0.5 },
        // An egg sac swells up in every slot of the winner's row, centre
        // first. It grows where it sits; it never drops in.
        { p: 'bloom', at: 100, sprite: 'eggs', size: 0.64, ms: 380, stagger: 70, order: 'centreOut', sound: 'buff' },
        // The sacs swell a last time and burst in the same order, each
        // throwing spores straight up; two spores from each rise and drift
        // in toward the middle of the side.
        { p: 'burst', at: 860, sprite: 'spores', spores: 2, ms: 450, stagger: 50, sound: 'impact' },
        // Spore motes keep lifting off them (green, not the ember's warmth).
        { p: 'embers', at: 1000, until: 2300, every: 80, warm: false },
        // Six spores climb into a zig-zag column over the name; the rest
        // rise on up and fade: the rising spore column.
        { p: 'gather', at: 1550, ms: 520, stagger: 50, formation: 'sporeColumn' },
        // A last spore crowns the column with the sting.
        { p: 'lock', at: 2150, sprite: 'spores', sound: 'boast' },
        { p: 'name', at: 2190 }
      ]
    },
    'boast-null-void-collapse': {
      id: 'boast-null-void-collapse', name: 'Void Collapse', faction: 'Null', ms: 3000,
      beats: [
        { p: 'panel', at: 0 },
        // A dark star opens over the winner's row, feeds, collapses to a
        // point and holds there a beat (the silence before the bloom).
        { p: 'star', at: 120, sprite: 'darkStar', size: 2.0, grow: 320, collapse: 1300, gone: 1700, sound: 'cast' },
        // The winner's side goes dark as its light is pulled in.
        { p: 'veil', at: 260, ms: 900, a: 0.55 },
        // Motes of light lift out of every slot and are drawn into the star
        // (up or sideways, never down: a mote above the star moves across).
        { p: 'pull', at: 300, sprite: 'glass', perSlot: 3, every: 100, stagger: 50, ms: 560, size: 0.3, order: 'centreOut' },
        // The bloom: the star opens wide with the sting.
        { p: 'lock', at: 1700, sprite: 'darkStar', size: 2.2, sound: 'boast', core: true, spin: 0.9 },
        // Glitch bars tear out sideways from it and fade; then four bars
        // slide in at the name line and frame the name.
        { p: 'bars', at: 1720, sprite: 'glitch', n: 10, stagger: 22, ms: 520, settle: 2120 },
        { p: 'name', at: 2180 }
      ]
    },
    'boast-cortex-data-cascade': {
      id: 'boast-cortex-data-cascade', name: 'Data Cascade', faction: 'Cortex', ms: 3000,
      beats: [
        { p: 'panel', at: 0 },
        // A dark wash first, so cyan on the winner's own cyan cards reads.
        { p: 'veil', at: 60, ms: 420, a: 0.5 },
        // Columns of pixels stream UP out of every slot, centre first (an
        // upload, not a rain: down is the debuff's direction); each column's
        // lead pixel waits at the top of its column.
        { p: 'stream', at: 100, sprite: 'pixels', size: 0.34, rise: 520, every: 65, until: 1500, stagger: 60, order: 'centreOut', sound: 'beam' },
        // The columns sync: the row flashes as one.
        { p: 'flash', at: 1180 },
        // The lead pixels climb into a stack of wireframe blocks, three then
        // two, each snapping from pixel to block as it lands.
        { p: 'gather', at: 1480, ms: 520, stagger: 50, formation: 'pyramid', into: 'cube' },
        // The top block locks with the sting.
        { p: 'lock', at: 2120, sprite: 'cube', sound: 'boast' },
        { p: 'name', at: 2160 }
      ]
    },
    // The Season 0 boasts (owner 2026-10-19): neutral, so any faction's
    // agent can equip them. Each carries its own colour (col); the winner's
    // panel and the sting's voice stay the winner's faction.
    'boast-s0-boot-sequence': {
      id: 'boast-s0-boot-sequence', name: 'Boot Sequence', faction: null, col: '#7dffa8', ms: 3000,
      beats: [
        { p: 'panel', at: 0 },
        // The winner's side powers on like an old CRT: a dot, a line, the
        // raster opening and a flicker, then a dark screen with scanlines to
        // the end. The POST beep as it settles.
        { p: 'crt', at: 60, on: 380, flicker: 480, a: 0.88, sound: 'crt', beep: 'post' },
        // BIOS lines print one at a time at the bottom of the screen and
        // scroll UP, as a terminal does; then the screen clears upward.
        { p: 'scroll', at: 560, every: 180, type: 110, clear: 1660,
          lines: ['AI-TCG ARENA BIOS  REV S0', 'MEMORY TEST  65536K  OK', 'AGENT  {FACTION}  ONLINE', 'LOADING  VICTORY.SYS', 'BOOT >'] },
        // The winner's name types out in the plate under the last line, in
        // the BIOS's own type, a key at a time.
        { p: 'name', at: 1540, mono: true, type: 40 },
        // SYSTEM READY in chunky dot letters over the name: it flashes
        // twice and holds, with the sting.
        { p: 'banner', at: 2200, text: 'SYSTEM READY', sound: 'boast' }
      ]
    },
    'boast-s0-dial-up-fireworks': {
      id: 'boast-s0-dial-up-fireworks', name: 'Dial-Up Fireworks', faction: null, col: '#ff4fd8', ms: 3000,
      beats: [
        { p: 'panel', at: 0 },
        // Night falls on the winner's side (dark enough that the dot letters
        // read over bright cards and a Mythic ward).
        { p: 'veil', at: 0, ms: 380, a: 0.8 },
        // The modem handshake screeches (the music dips under it) while a
        // neon skyline rises out of the winner's row, centre first; its
        // windows flicker like data until the line connects.
        { p: 'skyline', at: 60, ms: 520, stagger: 30, data: [360, 1060], sound: 'modem', duck: 1050 },
        // Rockets go up from the rooftops and burst, left to right; each
        // burst's pixels fly up into its part of the winner's name, spelled
        // in the dot font, and the rest fan up and fade.
        { p: 'rockets', at: 1000, stagger: 100, rise: 340, fly: 460, extra: 8, sound: 'whistle', pop: 'pop' },
        // The name lights as one, with the sting.
        { p: 'lock', at: 2300, piece: false, sound: 'boast' },
        { p: 'name', at: 2340 }
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

  // The boast a replay plays at its end (slice 3), from the match record's
  // boast (replay.record.boast: { side, itemId, slot, winnerHealth }), which
  // the store chose as the match ended: the winner's main boast, its
  // close-win boast (it ended on 5 health or less) or, with the boast slot
  // empty, its deck faction's starter. The render never chooses: it only
  // falls back to the winner's faction starter when the record can't be
  // played here (no record: a match from before the record, or a sample
  // replay; a record whose boast is another side's; a boast this render
  // can't draw). Returns { id, slot, close } or null for no boast. slot is
  // the record's, or 'fallback'; close is true for a close-win boast.
  function boastFromRecord(boast, winner, faction) {
    if (!winner || winner === 'draw') return null;
    if (boast && boast.side === winner && BOAST_SPECS[boast.itemId]) {
      return { id: boast.itemId, slot: boast.slot, close: boast.slot === 'closeWinBoast' };
    }
    var id = boastIdFor(null, faction);
    return id ? { id: id, slot: 'fallback', close: false } : null;
  }

  // The "Cosmetics: on / off" switch (owner decision 7, render session 30):
  // whether a side's cosmetics (its boast; later its card back, avatar and
  // arena) show. viewer: null for a spectator, or the side the viewing
  // owner's agent sits on. A spectator's switch hides both sides; on an
  // owner's own page it hides only the other side's, never their own.
  function boastCosmeticsShown(viewer, side, on) {
    if (viewer && viewer === side) return true;
    return on !== false;
  }

  // Why a spec can't be played, or null.
  function boastSpecProblem(spec) {
    if (!spec || typeof spec.id !== 'string' || !spec.id) return 'a boast needs an id';
    if (!spec.faction && !/^#[0-9a-f]{6}$/i.test(spec.col || '')) return spec.id + ': a neutral boast needs its own colour (col)';
    if (!(spec.ms > 0) || spec.ms > BOAST_MS_MAX) return spec.id + ': length must be 1-' + BOAST_MS_MAX + ' ms';
    if (!spec.beats || !spec.beats.length) return spec.id + ': no beats';
    var last = -1, named = false, i;
    function before(b, kinds) { return spec.beats.some(function (x) { return kinds.indexOf(x.p) >= 0 && x.at < b.at; }); }
    for (i = 0; i < spec.beats.length; i++) {
      var b = spec.beats[i];
      if (BOAST_PRIMS.indexOf(b.p) < 0) return spec.id + ': unknown primitive "' + b.p + '"';
      if (!(b.at >= 0) || b.at < last) return spec.id + ': beats must be in time order';
      if (b.at >= spec.ms) return spec.id + ': beat "' + b.p + '" starts after the boast ends';
      if (b.p === 'gather' && !before(b, Object.keys(BOAST_CARRIERS))) return spec.id + ': gather needs pieces to lift before it (a wall, a burst or a stream)';
      if (b.p === 'gather' && !BOAST_FORMATIONS[b.formation]) return spec.id + ': unknown formation "' + b.formation + '"';
      if (b.p === 'burst' && !before(b, ['bloom'])) return spec.id + ': burst needs a bloom before it';
      if (b.p === 'pull' && !before(b, ['star'])) return spec.id + ': pull needs a star before it';
      if (b.p === 'star' && !(b.at + b.grow <= b.collapse && b.collapse + 220 <= b.gone)) return spec.id + ': a star grows, then collapses, then goes';
      if (b.p === 'scroll' && !before(b, ['crt'])) return spec.id + ': scroll needs a crt screen before it';
      if (b.p === 'scroll' && !(b.lines && b.lines.length)) return spec.id + ': scroll needs lines';
      if (b.p === 'rockets' && !before(b, ['skyline'])) return spec.id + ': rockets need a skyline to go up from';
      if (b.p === 'banner' && !(typeof b.text === 'string' && b.text)) return spec.id + ': banner needs its text';
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

  // boastPlan(spec, geom, seed, who) -> { id, faction, ms, pieces, marks, anchor }
  //   geom: { band, panel, slots: [{ l, t, r, b, filled }], loser: [rects] }
  //     in document pixels (rects as { l, t, r, b }). band is the winner's
  //     side of the board, panel the winner's HUD panel.
  //   who: { name, faction, close }: the winner (a boast that spells or
  //     types the name lays it out here; a neutral boast takes the winner's
  //     faction for its panel and its sting's voice). close: a close win;
  //     the plate holds the close-call line BOAST_CLOSE_MS before the
  //     winner's line, and the boast ends that much later.
  //   pieces: sprites that move along keyframes [{ t, x, y, s, a }] (the
  //     runtime eases between keys; key.e names the easing into that key).
  //     s is the sprite's height; sx (optional) stretches it sideways, or w
  //     fixes its width in px. A piece with a shape is code-drawn, not an
  //     atlas sprite: 'text' (txt, in the BIOS type), 'bits' (a block of the
  //     dot font), 'dot' (one pixel) or 'tower' (a skyline building); rgb
  //     colours a piece other than the boast's colour.
  //   marks: one-shot moments at time t: shock, flare, ring, sparks, grid,
  //     sound, duck, panel, pulse, veil, crt, name, end (rgb, optional,
  //     colours a shock, flare, ring or sparks).
  function boastPlan(spec, geom, seed, who) {
    var rand = boastRng(seed == null ? 1 : seed);
    who = who || {};
    var winName = String(who.name || 'WINNER'), faction = spec.faction || who.faction || 'Neutral';
    var closeMs = who.close ? BOAST_CLOSE_MS : 0;
    var band = geom.band, bw = band.r - band.l, bh = band.b - band.t, cx = boastCx(band);
    var slots = (geom.slots || []).slice();
    var pieces = [], marks = [], crestPieces = [], groups = {};
    var slotW = slots.length ? Math.min.apply(null, slots.map(function (s) { return s.r - s.l; })) : Math.min(118, bw / 6);
    var slotH = slots.length ? Math.min.apply(null, slots.map(function (s) { return s.b - s.t; })) : Math.min(158, bh * 0.85);
    // The crest sits in the upper part of the winner's side, the name under it.
    var crest = { x: cx, y: band.t + bh * 0.34, r: Math.max(12, Math.min(bh * 0.19, bw * 0.12, 50)) };
    var nameY = band.t + bh * 0.8, nameW = Math.min(bw * 0.86, 640), nameH = Math.min(bh * 0.26, 46);
    var carrier = null, carrierSprite = 'hexPlate', form = BOAST_FORMATIONS.hexRing, ends = spec.ms + closeMs;
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
    function add(pc, grp) { pc.grp = grp; pieces.push(pc); (groups[grp] = groups[grp] || []).push(pc); return pc; }
    function lastKey(pc) { return pc.keys[pc.keys.length - 1]; }
    // The slots in the beat's order: as laid out, or centre first.
    function slotOrder(order) {
      var o = slots.map(function (s, i) { return i; });
      if (order === 'centreOut') o.sort(function (x, y) { return Math.abs(boastCx(slots[x]) - cx) - Math.abs(boastCx(slots[y]) - cx) || boastCx(slots[x]) - boastCx(slots[y]); });
      return o;
    }

    spec.beats.forEach(function (b) {
      if (b.p === 'panel') mark({ k: 'panel', t: b.at });
      else if (b.p === 'wall') {
        carrier = 'wall'; carrierSprite = b.sprite;
        slotOrder(b.order).forEach(function (si, k) {
          var s = slots[si], sh = s.b - s.t, sw = s.r - s.l;
          var size = Math.min(sw * b.size, sh * 0.8 / b.perSlot);
          var T = b.at + k * b.stagger;
          for (var j = 0; j < b.perSlot; j++) {
            // Rest a little above the slot's floor so even the bottom plate
            // has room to rise; it starts smaller, just above the side's edge.
            var restY = s.b - sh * (0.32 + j * 0.8 / b.perSlot), x = boastCx(s);
            var fromY = Math.max(restY, Math.min(band.b - size * 0.35 - 1, restY + sh * 0.5));
            var t0 = T + j * 40, t1 = t0 + b.rise;
            add({ sp: b.sprite, rot: 0, row: j, slot: si, keys: [
              { t: t0, x: x, y: fromY, s: size * 0.7, a: 0 },
              { t: t1, x: x, y: restY, s: size, a: 1, e: 'slam' }
            ] }, 'wall');
            // The landing: a small shock and sparks thrown upward.
            mark({ k: 'shock', t: t1, x: x, y: restY, R: size * 0.42, sx: 1, sy: 0.6 });
            mark({ k: 'sparks', t: t1, x: x, y: restY - size * 0.3, n: 5, spd: 150, life: 0.45, angle: -Math.PI / 2, spread: 0.7 });
            if (j === 0) {
              mark({ k: 'grid', t: t1, x: x, y: restY, f: 260, r: Math.min(60, sh * 0.2) });
              if (b.sound) mark({ k: 'sound', t: t1, kind: b.sound, tier: 'subtle', x: x });
            }
          }
        });
      } else if (b.p === 'bloom') {
        // A sac grows where it sits, low in its slot: no movement at all.
        slotOrder(b.order).forEach(function (si, k) {
          var s = slots[si], sh = s.b - s.t, sw = s.r - s.l;
          var size = Math.min(sw * b.size, sh * 0.6), x = boastCx(s), y = s.b - sh * 0.4;
          var t0 = b.at + k * b.stagger, t1 = t0 + b.ms;
          add({ sp: b.sprite, rot: 0, slot: si, keys: [
            { t: t0, x: x, y: y, s: size * 0.2, a: 0 },
            { t: t1, x: x, y: y, s: size, a: 1, e: 'out' }
          ] }, 'sac');
          mark({ k: 'grid', t: t1, x: x, y: y, f: 120, r: Math.min(50, sh * 0.18) });
          if (b.sound) mark({ k: 'sound', t: t1 - b.ms * 0.4, kind: b.sound, tier: 'subtle', x: x });
        });
      } else if (b.p === 'burst') {
        carrier = 'spore'; carrierSprite = b.sprite;
        (groups.sac || []).forEach(function (sac, k) {
          var k0 = lastKey(sac), s = slots[sac.slot], sh = s.b - s.t;
          var T = Math.max(b.at + k * b.stagger, k0.t);
          // One last swell, then the pop: it grows and fades in place.
          sac.keys.push({ t: T, x: k0.x, y: k0.y, s: k0.s * 1.15, a: 1 });
          sac.keys.push({ t: T + 130, x: k0.x, y: k0.y, s: k0.s * 1.5, a: 0, e: 'out' });
          mark({ k: 'shock', t: T, x: k0.x, y: k0.y, R: k0.s * 0.45, sx: 1, sy: 0.8 });
          mark({ k: 'sparks', t: T, x: k0.x, y: k0.y - k0.s * 0.25, n: 8, spd: 170, life: 0.5, angle: -Math.PI / 2, spread: 0.6 });
          if (b.sound) mark({ k: 'sound', t: T, kind: b.sound, tier: 'subtle', x: k0.x });
          // The spores rise, sway and drift in toward the middle, coming to
          // rest below the crest (a gather lifts them on from there).
          var y1 = Math.min(k0.y, Math.max(crest.y + crest.r * 1.25, k0.y - sh * 0.45));
          for (var j = 0; j < b.spores; j++) {
            var sz = k0.s * (0.4 + rand() * 0.12), sway = (j % 2 ? 1 : -1) * k0.s * (0.25 + rand() * 0.2);
            var x1 = k0.x + (cx - k0.x) * (0.3 + rand() * 0.1);
            var tj = T + 20 + j * 35;
            add({ sp: b.sprite, rot: 0, keys: [
              { t: tj, x: k0.x, y: k0.y, s: sz * 0.5, a: 0 },
              { t: tj + b.ms * 0.45, x: k0.x + sway, y: k0.y - (k0.y - y1) * 0.6, s: sz, a: 1, e: 'out' },
              { t: tj + b.ms, x: x1, y: y1, s: sz, a: 1, e: 'out' }
            ] }, 'spore');
          }
        });
      } else if (b.p === 'stream') {
        carrier = 'head'; carrierSprite = b.sprite;
        slotOrder(b.order).forEach(function (si, k) {
          var s = slots[si], sh = s.b - s.t, sw = s.r - s.l, x = boastCx(s);
          var size = Math.min(sw * b.size, sh * 0.2);
          var floorY = s.b - sh * 0.12;
          // The lead pixel rests no higher than the formation's bottom row,
          // so a gather can lift it on.
          var headY = Math.min(floorY, Math.max(s.t + sh * 0.28, crest.y + crest.r * 0.9));
          var T = b.at + k * b.stagger;
          add({ sp: b.sprite, rot: 0, slot: si, keys: [
            { t: T, x: x, y: floorY, s: size * 0.6, a: 0 },
            { t: T + b.rise, x: x, y: headY, s: size, a: 1, e: 'out' }
          ] }, 'head');
          // The column behind it: pixels rise from the floor and fade as
          // they climb, until the beat's end.
          for (var t = T + b.every; t < b.until; t += b.every) {
            var jx = (rand() - 0.5) * sw * 0.25, sz = size * (0.6 + rand() * 0.4);
            var top = floorY - (floorY - (s.t + sh * 0.2)) * (0.6 + rand() * 0.4);
            add({ sp: b.sprite, rot: 0, keys: [
              { t: t, x: x + jx, y: floorY, s: sz, a: 0 },
              { t: t + b.rise * 0.3, x: x + jx, y: floorY - (floorY - top) * 0.3, s: sz, a: 0.9 },
              { t: t + b.rise, x: x + jx, y: top, s: sz * 0.7, a: 0, e: 'out' }
            ] }, 'trail');
          }
          mark({ k: 'grid', t: T, x: x, y: floorY, f: 140, r: Math.min(40, sh * 0.1) });
          if (b.sound) mark({ k: 'sound', t: T, kind: b.sound, tier: 'subtle', x: x });
        });
      } else if (b.p === 'star') {
        // Grows in place at the crest, swells as it feeds, collapses to a
        // point and holds there; the lock's bloom replaces it.
        var ss = crest.r * (b.size || 1.3), X = crest.x, Y = crest.y;
        add({ sp: b.sprite, rot: 0, core: true, spin: 1.4, keys: [
          { t: b.at, x: X, y: Y, s: ss * 0.3, a: 0 },
          { t: b.at + b.grow, x: X, y: Y, s: ss, a: 1, e: 'out' },
          { t: b.collapse, x: X, y: Y, s: ss * 1.15, a: 1 },
          { t: b.collapse + 220, x: X, y: Y, s: ss * 0.3, a: 1, e: 'in' },
          { t: b.gone, x: X, y: Y, s: ss * 0.3, a: 1 },
          { t: b.gone + 60, x: X, y: Y, s: ss * 0.3, a: 0 }
        ] }, 'star');
        if (b.sound) mark({ k: 'sound', t: b.at, kind: b.sound, tier: 'normal', x: X });
      } else if (b.p === 'pull') {
        slotOrder(b.order).forEach(function (si, k) {
          var s = slots[si], sh = s.b - s.t, sw = s.r - s.l;
          for (var j = 0; j < b.perSlot; j++) {
            var t0 = b.at + k * b.stagger + j * b.every;
            // A mote that would start above the star starts level with it
            // and is pulled straight across.
            var x0 = s.l + sw * (0.2 + 0.6 * rand()), y0 = Math.max(crest.y, s.b - sh * (0.15 + 0.5 * rand()));
            var sz = sw * b.size * (0.7 + 0.5 * rand());
            add({ sp: b.sprite, rot: 0, keys: [
              { t: t0, x: x0, y: y0, s: sz * 0.6, a: 0 },
              { t: t0 + 90, x: x0, y: y0, s: sz, a: 1 },
              { t: t0 + b.ms, x: crest.x, y: crest.y, s: sz * 0.25, a: 0, e: 'in' }
            ] }, 'mote');
          }
        });
      } else if (b.p === 'bars') {
        var barH = Math.max(4, crest.r * 0.22);
        // The bloom: bars tear out sideways from the star and fade.
        for (var q = 0; q < b.n; q++) {
          var by = crest.y + (rand() - 0.5) * crest.r * 1.6, dir = q % 2 ? 1 : -1, bsx = 3 + rand() * 3;
          var reachX = Math.max(crest.r * 0.6, Math.min(bw * 0.42 - barH * bsx / 2, crest.r * (2.4 + rand() * 1.6)));
          var tq = b.at + q * b.stagger;
          add({ sp: b.sprite, rot: 0, sx: bsx, keys: [
            { t: tq, x: crest.x, y: by, s: barH, a: 0 },
            { t: tq + 40, x: crest.x + dir * crest.r * 0.5, y: by, s: barH, a: 1 },
            { t: tq + b.ms, x: crest.x + dir * reachX, y: by, s: barH, a: 0, e: 'out' }
          ] }, 'bar');
        }
        // The settle: two bars a side slide in along the name line and stop
        // at the plate's faded ends, framing the name.
        var fw = Math.min(nameW * 0.16, 70), fsx = fw / barH;
        [-1, 1].forEach(function (side) {
          for (var j = 0; j < 2; j++) {
            var fy = nameY + (j ? 1 : -1) * nameH * 0.32;
            var xEnd = cx + side * (nameW / 2 - fw / 2);
            var lim = side > 0 ? band.r - fw / 2 - 4 : band.l + fw / 2 + 4;
            var xStart = side > 0 ? Math.min(xEnd + 60, lim) : Math.max(xEnd - 60, lim);
            var ts = b.settle + j * 40;
            add({ sp: b.sprite, rot: 0, sx: fsx, frame: true, keys: [
              { t: ts, x: xStart, y: fy, s: barH, a: 0 },
              { t: ts + 60, x: xStart + (xEnd - xStart) * 0.3, y: fy, s: barH, a: 1 },
              { t: ts + 260, x: xEnd, y: fy, s: barH, a: 1, e: 'out' }
            ] }, 'bar');
          }
        });
      } else if (b.p === 'crt') {
        // The whole side is the screen (inset like the veil). The runtime
        // draws the power-on from the mark; the plan only places it.
        mark({ k: 'crt', t: b.at, on: b.on, flick: b.flicker || 0, a: b.a, l: band.l + 4, t2: band.t + 4, r: band.r - 4, b: band.b - 4 });
        mark({ k: 'flare', t: b.at, x: cx, y: boastCy(band), s: Math.min(bh * 0.5, 60) });
        if (b.sound) mark({ k: 'sound', t: b.at, kind: b.sound, tier: 'normal', x: cx });
        if (b.beep) mark({ k: 'sound', t: b.at + b.on, kind: b.beep, tier: 'normal', x: cx });
      } else if (b.p === 'scroll') {
        // Each line prints at the bottom of a text window and every earlier
        // line steps UP one line (a terminal's scroll: nothing ever moves
        // down). The type shrinks to fit a short or narrow side.
        var lines = b.lines.map(function (l) { return l.replace('{FACTION}', faction.toUpperCase()); });
        var nl = lines.length, maxCh = Math.max.apply(null, lines.map(function (l) { return l.length + 1; }));
        var y0 = band.t + bh * 0.6, avail = y0 - band.t - 4;
        var fs = Math.min(14, bh * 0.075, avail / ((nl - 1) * 1.3 + 0.5), bw * 0.9 / (0.62 * maxCh));
        var lh = fs * 1.3, x0 = cx - Math.min(bw * 0.9, 0.62 * fs * Math.max(maxCh, 26)) / 2;
        lines.forEach(function (txt, i) {
          var T = b.at + i * b.every, last = i === nl - 1;
          // The last line keeps a blinking cursor (one character's room).
          var wch = 0.62 * (txt.length + (last ? 1 : 0)), x = x0 + fs * wch / 2, y = y0;
          var keys = [{ t: T, x: x, y: y, s: fs, a: 0 }, { t: T + 30, x: x, y: y, s: fs, a: 1 }];
          for (var j = i + 1; j < nl; j++) {
            var Tj = b.at + j * b.every;
            keys.push({ t: Tj, x: x, y: y, s: fs, a: 1 });
            y -= lh;
            keys.push({ t: Tj + 70, x: x, y: y, s: fs, a: 1, e: 'out' });
          }
          // The screen clears: the lines lift and fade, the top one first.
          var Tc = Math.max(b.clear + i * 30, keys[keys.length - 1].t), yc = Math.min(y, Math.max(band.t + fs / 2 + 2, y - lh));
          keys.push({ t: Tc, x: x, y: y, s: fs, a: 1 });
          keys.push({ t: Tc + 260, x: x, y: yc, s: fs, a: 0, e: 'out' });
          var pc = { shape: 'text', txt: txt, sx: wch, rot: 0, type: { t0: T, ms: Math.min(b.type, txt.length * 14) }, keys: keys };
          if (last) pc.cursor = true;
          add(pc, 'line');
          for (var q = 0; q < 3; q++) mark({ k: 'sound', t: T + q * 35, kind: 'type', tier: 'subtle', x: x });
        });
      } else if (b.p === 'banner') {
        // Chunky dot letters over the name: they rise a little into place,
        // flash twice and hold.
        var H = Math.min(bh * 0.4, crest.r * 2.4), fit = boastBitsFit(b.text, bw * 0.8, H, 9);
        var bwid = fit.bits.cols * fit.cell, bhgt = fit.bits.rows * fit.cell;
        var bny = Math.max(crest.y, band.t + 3 + bhgt / 2), bnx = crest.x;
        var lift = Math.max(0, Math.min(fit.cell * 1.5, band.b - 3 - bhgt / 2 - bny)), T0 = b.at;
        var flick = [[130, 0.12], [190, 0.12], [200, 1], [260, 1], [270, 0.12], [320, 0.12], [330, 1]];
        var bkeys = [{ t: T0, x: bnx, y: bny + lift, s: bhgt, a: 0 }, { t: T0 + 40, x: bnx, y: bny + lift * 0.4, s: bhgt, a: 1, e: 'out' }, { t: T0 + 120, x: bnx, y: bny, s: bhgt, a: 1, e: 'out' }];
        flick.forEach(function (f) { bkeys.push({ t: T0 + f[0], x: bnx, y: bny, s: bhgt, a: f[1] }); });
        crestPieces.push(add({ shape: 'bits', bits: fit.bits, sx: fit.bits.cols / fit.bits.rows, rot: 0, centre: true, keys: bkeys }, 'crest'));
        // A flat shock along it (as tall as the side allows), a flare, sparks
        // up off its top edge, the sting and the music ducked. No grid push:
        // the screen is dark glass, and a push this near the side's top edge
        // bent the background grid's lines over into the loser's side (seen
        // in the browser check, render session 33).
        var R = Math.min(bwid / 2, bw * 0.45) / 2.31;
        R = Math.min(R, (Math.min(bny - band.t, band.b - bny) - 3) / 0.315);
        if (R > 4) mark({ k: 'shock', t: T0, x: bnx, y: bny, R: R, sx: 2.2, sy: 0.3 });
        mark({ k: 'flare', t: T0, x: bnx, y: bny, s: Math.min(crest.r * 2.2, (bny - band.t - 2) / BOAST_FLARE_REACH, (band.b - bny - 2) / BOAST_FLARE_REACH) });
        for (var sq = 0; sq < 4; sq++) mark({ k: 'sparks', t: T0 + 20, x: bnx + (sq - 1.5) / 1.5 * bwid * 0.38, y: bny - bhgt / 2, n: 4, spd: 160, life: 0.45, angle: -Math.PI / 2, spread: 0.5 });
        mark({ k: 'pulse', t: T0, ms: 420 });
        if (b.sound) {
          mark({ k: 'sound', t: T0, kind: b.sound, tier: 'spectacle', x: bnx });
          mark({ k: 'duck', t: T0, ms: Math.max(600, ends - T0 + 300) });
        }
      } else if (b.p === 'skyline') {
        // Towers across the whole side, 5-11% of its width each, rising out
        // of the floor, centre first. A tower's foot stays on the floor as
        // it grows (its centre and height ease together), so it only rises.
        var floor = band.b - 4, W = bw - 12, acc = 0, towers = [];
        while (acc < W - 6) {
          var tw = Math.min(W * (0.05 + rand() * 0.06), W - acc);
          if (tw < 6) break;
          towers.push({ x: band.l + 6 + acc + tw / 2, w: tw, h: bh * (0.14 + rand() * 0.2), ant: rand() < 0.3, seed: (rand() * 1e9) | 0 });
          acc += tw + 2 + rand() * 4;
        }
        towers.sort(function (u, v) { return Math.abs(u.x - cx) - Math.abs(v.x - cx) || u.x - v.x; });
        towers.forEach(function (tw, k) {
          var T = b.at + k * b.stagger;
          add({ shape: 'tower', w: tw.w - 1, rgb: boastHex(BOAST_NEON[[1, 0, 5][k % 3]]), ant: tw.ant, seed: tw.seed, data: b.data, rot: 0, keys: [
            { t: T, x: tw.x, y: floor - 1, s: 2, a: 0 },
            { t: T + b.ms, x: tw.x, y: floor - tw.h / 2, s: tw.h, a: 1, e: 'out' }
          ] }, 'tower');
        });
        if (b.sound) mark({ k: 'sound', t: b.at, kind: b.sound, tier: 'normal', x: cx });
        if (b.duck) mark({ k: 'duck', t: b.at, ms: b.duck });
      } else if (b.p === 'rockets') {
        // The winner's name in the dot font, over the skyline where the crest
        // would be. One rocket per stretch of columns, left to right; each
        // bursts under its stretch, and its pixels fly up into those letters.
        var fitN = boastBitsFit(winName.toUpperCase(), bw * 0.9, bh * 0.34, 8), cellN = fitN.cell, bits = fitN.bits;
        var blkW = bits.cols * cellN, blkH = bits.rows * cellN;
        var bcy = Math.max(crest.y, band.t + 4 + blkH / 2), bx0 = cx - blkW / 2, by0 = bcy - blkH / 2;
        // A burst spells whole letters (a letter is never two colours).
        var nb = Math.max(1, Math.min(6, bits.chars, Math.ceil(bits.chars / 3)));
        var rs = Math.max(3, cellN * 1.2), burstY = Math.min(by0 + blkH + Math.max(cellN * 2.5, 8), band.b - 4 - rs);
        var stg = nb > 1 ? Math.min(b.stagger, 480 / (nb - 1)) : 0, towersG = groups.tower || [];
        for (var g = 0; g < nb; g++) {
          var c0 = Math.floor(bits.chars * g / nb), c1 = Math.floor(bits.chars * (g + 1) / nb);
          var mine = bits.dots.filter(function (d) { return d[2] >= c0 && d[2] < c1; });
          var bxg = bx0 + (mine.reduce(function (a, d) { return a + d[0] + 0.5; }, 0) / Math.max(1, mine.length)) * cellN, col = boastHex(BOAST_NEON[g % BOAST_NEON.length]);
          var tL = b.at + g * stg, tB = tL + b.rise;
          // It goes up from the nearest rooftop (or the side's floor).
          var lx = bxg, ly = band.b - 6, bd2 = Infinity;
          towersG.forEach(function (tw) { var k = lastKey(tw); if (Math.abs(k.x - bxg) < bd2) { bd2 = Math.abs(k.x - bxg); lx = k.x; ly = k.y - k.s / 2 - 2; } });
          ly = Math.max(burstY, Math.min(band.b - 6, Math.max(ly, burstY + 10)));
          add({ shape: 'dot', rgb: col, rot: 0, keys: [
            { t: tL, x: lx, y: ly, s: rs, a: 0 },
            { t: tL + 40, x: lx + (bxg - lx) * 0.1, y: ly - (ly - burstY) * 0.12, s: rs, a: 1 },
            { t: tB, x: bxg, y: burstY, s: rs, a: 1, e: 'out' },
            { t: tB + 50, x: bxg, y: burstY, s: rs * 2, a: 0 }
          ] }, 'rocket');
          for (var tr = 1; tr <= 3; tr++) {
            var u = tr / 4, ue = 1 - Math.pow(1 - u, 3);
            mark({ k: 'sparks', t: tL + b.rise * u, x: lx + (bxg - lx) * ue, y: ly - (ly - burstY) * ue, n: 2, spd: 40, life: 0.3, angle: -Math.PI / 2, spread: 0.25, rgb: col });
          }
          if (b.sound) mark({ k: 'sound', t: tL, kind: b.sound, tier: 'subtle', x: lx });
          // The burst.
          mark({ k: 'flare', t: tB, x: bxg, y: burstY, s: Math.min(cellN * 9, 70, (band.b - burstY - 2) / BOAST_FLARE_REACH, (burstY - band.t - 2) / BOAST_FLARE_REACH, (bxg - band.l - 2) / BOAST_FLARE_REACH, (band.r - bxg - 2) / BOAST_FLARE_REACH), rgb: col });
          mark({ k: 'sparks', t: tB, x: bxg, y: burstY, n: 12, spd: 150, life: 0.45, angle: -Math.PI / 2, spread: 1.1, rgb: col });
          if (b.pop) mark({ k: 'sound', t: tB, kind: b.pop, tier: 'subtle', x: bxg });
          mine.forEach(function (d) {
            var dl = rand() * 60;
            crestPieces.push(add({ shape: 'dot', rgb: col, twinkle: true, ph: rand() * 6.28, rot: 0, keys: [
              { t: tB + dl, x: bxg, y: burstY, s: cellN * 0.4, a: 0 },
              { t: tB + dl + b.fly, x: bx0 + (d[0] + 0.5) * cellN, y: by0 + (d[1] + 0.5) * cellN, s: cellN * 0.86, a: 1, e: 'out' }
            ] }, 'letter'));
          });
          // The rest of the burst fans up and fades.
          for (var ex = 0; ex < b.extra; ex++) {
            var th = (rand() * 2 - 1) * 1.2, dist = cellN * (6 + rand() * 10);
            var exx = Math.max(band.l + 6, Math.min(band.r - 6, bxg + Math.sin(th) * dist)), exy = Math.max(band.t + 6, burstY - Math.cos(th) * dist);
            add({ shape: 'dot', rgb: col, rot: 0, keys: [
              { t: tB, x: bxg, y: burstY, s: cellN * 0.7, a: 0 },
              { t: tB + b.fly * 0.35, x: bxg + (exx - bxg) * 0.6, y: burstY + (exy - burstY) * 0.6, s: cellN * 0.7, a: 1, e: 'out' },
              { t: tB + b.fly * 1.1, x: exx, y: exy, s: cellN * 0.5, a: 0, e: 'out' }
            ] }, 'fan');
          }
        }
      } else if (b.p === 'embers') {
        var until = Math.min(b.until || ends, ends);
        for (var t = b.at; t < until && pieces.length; t += b.every) {
          var pc = pieces[(rand() * pieces.length) | 0], last = lastKey(pc);
          if (last.t > t) continue;
          mark({ k: 'sparks', t: t, x: last.x + (rand() - 0.5) * last.s * 0.6, y: last.y - last.s * 0.35, n: 2, spd: 70, life: 0.7, angle: -Math.PI / 2, spread: 0.35, ember: true, warm: b.warm !== false });
        }
      } else if (b.p === 'flash') {
        var rowY = slots.length ? boastCy({ t: Math.min.apply(null, slots.map(function (s) { return s.t; })), b: Math.max.apply(null, slots.map(function (s) { return s.b; })) }) : boastCy(band);
        mark({ k: 'pulse', t: b.at, ms: 380 });
        mark({ k: 'shock', t: b.at, x: cx, y: rowY, R: Math.min(bw * 0.2, 150), sx: 2.2, sy: 0.25 });
        mark({ k: 'sound', t: b.at, kind: 'block', tier: 'normal', x: cx });
      } else if (b.p === 'veil') {
        mark({ k: 'veil', t: b.at, ms: b.ms, a: b.a, l: band.l + 4, t2: band.t + 4, r: band.r - 4, b: band.b - 4 });
      } else if (b.p === 'gather') {
        // Each cell of the formation takes the nearest carrier piece that
        // sits at or below it (a piece only ever rises).
        form = BOAST_FORMATIONS[b.formation];
        var targets = form.cells.map(function (c) { return { x: crest.x + c[0] * crest.r, y: crest.y + c[1] * crest.r }; });
        targets.sort(function (u, v) { return v.y - u.y; });
        var free = (groups[carrier] || []).filter(function (pc) { return lastKey(pc).a > 0; });
        var cellSize = crest.r * form.size;
        targets.forEach(function (tg, n) {
          var best = -1, bd = Infinity;
          free.forEach(function (pc, i) {
            var k = lastKey(pc);
            if (k.y + 0.5 < tg.y) return;
            var d = Math.hypot(k.x - tg.x, k.y - tg.y);
            if (d < bd) { bd = d; best = i; }
          });
          if (best >= 0) {
            var pc = free.splice(best, 1)[0], k0 = lastKey(pc);
            var t0 = Math.max(b.at + n * b.stagger, k0.t), t1 = t0 + b.ms;
            pc.keys.push({ t: t0, x: k0.x, y: k0.y, s: k0.s, a: 1 });
            pc.keys.push({ t: t1, x: tg.x, y: tg.y, s: cellSize, a: 1, e: 'out' });
            if (b.into) {
              // It snaps into a different piece as it lands (a pixel into
              // a block): the carrier goes out as the new piece pops in.
              pc.keys.push({ t: t1 + 90, x: tg.x, y: tg.y, s: cellSize, a: 0 });
              crestPieces.push(add({ sp: b.into, rot: 0, keys: [
                { t: t1, x: tg.x, y: tg.y, s: cellSize * 0.6, a: 0 },
                { t: t1 + 120, x: tg.x, y: tg.y, s: cellSize, a: 1, e: 'out' }
              ] }, 'crest'));
              mark({ k: 'flare', t: t1, x: tg.x, y: tg.y, s: cellSize * 0.9 });
            } else crestPieces.push(pc);
          } else {
            // Nothing below this place (an empty board has its plates, but
            // a strange layout might not): the piece forms in place.
            var t1b = b.at + n * b.stagger + b.ms;
            crestPieces.push(add({ sp: b.into || carrierSprite, rot: 0, keys: [{ t: t1b - 160, x: tg.x, y: tg.y, s: cellSize * 0.6, a: 0 }, { t: t1b, x: tg.x, y: tg.y, s: cellSize, a: 1, e: 'out' }] }, 'crest'));
          }
        });
        // The rest rise away and fade, never past the top of the side.
        free.forEach(function (pc, n) {
          var k0 = lastKey(pc), t0 = Math.max(b.at + (n % 6) * b.stagger, k0.t);
          var topY = Math.min(k0.y, band.t + k0.s * 0.5 + 2);
          pc.keys.push({ t: t0, x: k0.x, y: k0.y, s: k0.s, a: 1 });
          pc.keys.push({ t: t0 + b.ms * 0.9, x: k0.x, y: topY, s: k0.s * 0.8, a: 0, e: 'out' });
        });
      } else if (b.p === 'lock') {
        // The formation's lock piece forms; the moment radiates outward.
        var lx = crest.x + form.lock[0] * crest.r, ly = crest.y + form.lock[1] * crest.r;
        var ls = crest.r * (b.size || form.lock[2]);
        // piece: false (Dial-Up Fireworks): the formation is already whole;
        // only the moment radiates.
        if (b.piece !== false) {
          var lp = { sp: b.sprite || carrierSprite, rot: 0, centre: true, keys: [
            { t: b.at, x: lx, y: ly, s: ls * 0.56, a: 0 },
            { t: b.at + 140, x: lx, y: ly, s: ls, a: 1, e: 'out' }
          ] };
          if (b.core) lp.core = true;
          if (b.spin) lp.spin = b.spin;
          crestPieces.push(add(lp, 'crest'));
        }
        mark({ k: 'shock', t: b.at, x: crest.x, y: crest.y, R: crest.r * 1.1, sx: 1, sy: 1 });
        mark({ k: 'flare', t: b.at, x: crest.x, y: crest.y, s: crest.r * 2.2 });
        mark({ k: 'ring', t: b.at, x: crest.x, y: crest.y, R: crest.r * 1.6 });
        mark({ k: 'sparks', t: b.at, x: lx, y: ly - crest.r * 0.4, n: 18, spd: 190, life: 0.5, angle: -Math.PI / 2, spread: 1.2 });
        mark({ k: 'grid', t: b.at, x: crest.x, y: crest.y, f: 900, r: Math.min(bh * 0.3, 90) });
        mark({ k: 'pulse', t: b.at, ms: 420 });
        if (b.sound) {
          mark({ k: 'sound', t: b.at, kind: b.sound, tier: 'spectacle', x: crest.x });
          mark({ k: 'duck', t: b.at, ms: Math.max(600, ends - b.at + 300) });
        }
      } else if (b.p === 'name') {
        // The plate: the winner's line, "<NAME> WINS"; on a close win the
        // close-call line first, alone (close: how long it holds).
        var nmk = mark({ k: 'name', t: b.at, x: cx, y: nameY, w: nameW, h: nameH });
        if (closeMs) nmk.close = closeMs;
        if (b.mono) nmk.mono = true;
        if (b.type) {
          // The winner's line typed a key at a time (in at most 0.6 s), a
          // key's click each.
          var line = winName + ' ' + BOAST_WINS, t1 = b.at + closeMs;
          nmk.type = Math.min(b.type, 600 / line.length);
          for (var ki = 0; ki < Math.min(line.length, 16); ki++) mark({ k: 'sound', t: t1 + ki * nmk.type * line.length / Math.min(line.length, 16), kind: 'type', tier: 'subtle', x: cx });
        }
      }
    });

    // Everything holds its last key to the end, then the crest fades as the
    // result line lands.
    pieces.forEach(function (pc) {
      var k = lastKey(pc);
      if (k.a > 0) {
        if (k.t < ends) pc.keys.push({ t: ends, x: k.x, y: k.y, s: k.s, a: k.a });
        pc.keys.push({ t: Math.max(k.t, ends) + 320, x: k.x, y: k.y, s: k.s, a: 0 });
      }
    });
    mark({ k: 'end', t: ends });
    marks.sort(function (u, v) { return u.t - v.t; });
    var out = { id: spec.id, faction: faction, name: spec.name, ms: ends, pieces: pieces, marks: marks, crest: crest, crestPieces: crestPieces.length };
    if (closeMs) out.close = true;
    if (spec.col) { out.col = spec.col; out.rgb = boastHex(spec.col); }
    return out;
  }

  // The reduced-motion still: the plan's final pose (everything that still
  // shows at the end), held for BOAST_STILL_MS, with the panel and the name.
  // No shocks, sparks, grid or flares. A close win's plate still shows the
  // close-call line first (a swap of words, no motion), so its still holds
  // BOAST_CLOSE_MS longer.
  function boastStill(plan) {
    var pieces = [], ms = BOAST_STILL_MS + (plan.close ? BOAST_CLOSE_MS : 0);
    plan.pieces.forEach(function (pc) {
      var at = boastPieceAt(pc, plan.ms);
      if (!at || at.a < 0.5) return;
      var sp = { sp: pc.sp, rot: pc.rot, centre: pc.centre, keys: [
        { t: 0, x: at.x, y: at.y, s: at.s, a: at.a },
        { t: ms, x: at.x, y: at.y, s: at.s, a: at.a },
        { t: ms + 200, x: at.x, y: at.y, s: at.s, a: 0 }
      ] };
      if (pc.sx) sp.sx = pc.sx;
      if (pc.core) sp.core = true;
      // A code-drawn piece keeps its shape; text shows whole (no typing),
      // and nothing twinkles or flickers.
      ['shape', 'w', 'rgb', 'txt', 'bits', 'seed', 'ant'].forEach(function (f) { if (pc[f] !== undefined) sp[f] = pc[f]; });
      pieces.push(sp);
    });
    var marks = plan.marks.filter(function (m) { return m.k === 'panel' || m.k === 'name' || m.k === 'veil' || m.k === 'crt' || (m.k === 'sound' && m.tier === 'spectacle'); })
      .map(function (m) { var c = {}; for (var k in m) c[k] = m[k]; c.t = 0; if (c.k === 'veil') c.ms = 0; if (c.k === 'crt') { c.on = 0; c.flick = 0; } if (c.k === 'name') delete c.type; return c; });
    marks.push({ k: 'end', t: ms });
    var out = { id: plan.id, faction: plan.faction, name: plan.name, ms: ms, pieces: pieces, marks: marks, crest: plan.crest, still: true };
    if (plan.close) out.close = true;
    if (plan.col) { out.col = plan.col; out.rgb = plan.rgb; }
    return out;
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
        // A spinning sprite sweeps its square's corners.
        var k = pc.keys[j], h = k.s / 2 * (pc.spin ? Math.SQRT2 : 1), w = pc.w ? pc.w / 2 : h * (pc.sx || 1);
        if (k.a > 0 || (j > 0 && pc.keys[j - 1].a > 0)) { p = box(k.x - w, k.y - h, k.x + w, k.y + h, 'piece ' + i); if (p) return p; }
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
        // The flare's sprite reaches 0.55 s; its bloom (a fading glow drawn
        // under it) reaches 0.72 s, so the bloom is what must stay inside.
        var fh = m.s * BOAST_FLARE_REACH; p = box(m.x - fh, m.y - fh, m.x + fh, m.y + fh, 'flare'); if (p) return p;
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
      } else if (m.k === 'crt') {
        p = box(m.l, m.t2, m.r, m.b, 'crt screen'); if (p) return p;
      }
    }
    if (!plan.marks.some(function (m) { return m.k === 'name'; })) return 'no name';
    return null;
  }

  // Where a piece is at time t (ms): eased between its keys.
  //   slam: accelerates into the key and stops dead (a plate hitting home);
  //   in: accelerates into it (a mote drawn into the star);
  //   out: decelerates into it.
  function boastPieceAt(pc, t) {
    var ks = pc.keys;
    if (t < ks[0].t) return null;
    for (var i = 1; i < ks.length; i++) {
      if (t <= ks[i].t) {
        var a = ks[i - 1], b = ks[i], u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
        var e = b.e === 'slam' ? u * u * u : b.e === 'in' ? u * u : b.e === 'out' ? 1 - Math.pow(1 - u, 3) : u;
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
          if (cur.crt) drawCrt(ctx, cur.crt, c);
          var n = 0;
          for (var i = 0; i < cur.plan.pieces.length; i++) {
            var pc = cur.plan.pieces[i], at = boastPieceAt(pc, cur.t);
            if (!at || at.a <= 0.003 || at.s <= 0) continue;
            n++;
            if (pc.shape) { drawShape(ctx, pc, at, pc.rgb || c, glow); continue; }
            var tx = K.tex(FX_SP[pc.sp], c), w = at.s * (pc.sx || 1);
            K.drawGlow(ctx, at.x, at.y, at.s * (0.75 + glow * 0.5), c, at.a * (0.35 + glow * 0.6));
            if (pc.core) {
              // A dark core under the sprite (Null's star): drawn over, not
              // added, so it reads as a hole in the light.
              ctx.globalCompositeOperation = 'source-over';
              var cg = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, at.s * 0.42);
              cg.addColorStop(0, 'rgba(0,0,0,' + (0.92 * Math.min(1, at.a)).toFixed(3) + ')');
              cg.addColorStop(0.6, 'rgba(2,0,6,' + (0.7 * Math.min(1, at.a)).toFixed(3) + ')');
              cg.addColorStop(1, 'rgba(2,0,6,0)');
              ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(at.x, at.y, at.s * 0.42, 0, Math.PI * 2); ctx.fill();
              ctx.globalCompositeOperation = 'lighter';
            }
            ctx.globalAlpha = Math.min(1, at.a);
            ctx.save(); ctx.translate(at.x, at.y); ctx.rotate((pc.rot || 0) + (pc.spin || 0) * (cur.plan.still ? 0 : cur.t / 1000));
            ctx.drawImage(tx, -w / 2, -at.s / 2, w, at.s);
            if (glow > 0 || pc.centre) { ctx.globalAlpha = Math.min(1, at.a) * Math.max(glow * 0.8, pc.centre ? 0.45 : 0); ctx.drawImage(K.tex(FX_SP[pc.sp], K.mix(c, [255, 255, 255], 0.6)), -w / 2, -at.s / 2, w, at.s); }
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
    function css(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }
    function hash3(a, b, d) {
      var x = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(d | 0, 1274126177);
      x = Math.imul(x ^ (x >>> 13), 1274126177);
      return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
    }
    // How strongly the boast still shows (its own fade after the end; gone
    // at once when skipped).
    function fadeNow() {
      var f = 1;
      if (cur.t > cur.plan.ms) f = Math.max(0, 1 - (cur.t - cur.plan.ms) / 320);
      if (cur.ended && !cur.fadeOut) f = 0;
      return f;
    }
    // Boot Sequence's screen: the winner's side powers on like a tube. A
    // dot widens into a line, the raster opens from it and dims, a flicker;
    // then a dark screen with scanlines until the boast ends.
    function drawCrt(ctx, m, c) {
      var u = m.on > 0 ? (cur.t - m.t) / m.on : 1, fade = fadeNow();
      if (u < 0 || fade <= 0.003) return;
      var W = m.r - m.l, H = m.b - m.t2, mx = (m.l + m.r) / 2, my = (m.t2 + m.b) / 2, rr = Math.min(14, W / 10);
      var sa = m.a * Math.min(1, u * 3) * fade, ft = cur.t - m.t - m.on;
      if (ft > 0 && ft < m.flick) sa *= 0.8 + 0.2 * hash3(Math.floor(ft / 45), 7, 3);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(2,7,5,' + sa.toFixed(3) + ')';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(m.l, m.t2, W, H, rr); else ctx.rect(m.l, m.t2, W, H); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      var open = H;
      if (u < 0.35) {
        var lw = Math.max(4, W * u / 0.35);
        ctx.fillStyle = css(c, 0.25 * fade); ctx.fillRect(mx - lw / 2, my - 4, lw, 8);
        ctx.fillStyle = css(CFX.kit.mix(c, [255, 255, 255], 0.7), 0.95 * fade); ctx.fillRect(mx - lw / 2, my - 1, lw, 2);
        open = 2;
      } else if (u < 1) {
        var v = (u - 0.35) / 0.65;
        open = H * (0.02 + 0.98 * (1 - Math.pow(1 - v, 3)));
        ctx.fillStyle = css(c, (0.45 * (1 - v) + 0.04) * fade); ctx.fillRect(m.l, my - open / 2, W, open);
      } else {
        // The phosphor's faint haze, brighter while it flickers.
        ctx.fillStyle = css(c, (ft < m.flick ? 0.06 : 0.035) * fade); ctx.fillRect(m.l, m.t2, W, H);
      }
      // Scanlines over the lit part: a dark line every 3 px.
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,' + (0.3 * fade).toFixed(3) + ')';
      for (var y = Math.ceil(my - open / 2); y < my + open / 2; y += 3) ctx.fillRect(m.l, y, W, 1);
      ctx.globalCompositeOperation = 'lighter';
    }
    // The code-drawn pieces (Season 0): text in the BIOS type, a block of
    // the dot font, one pixel, a skyline tower. Each stays inside its
    // piece's box (s high, w or s x sx wide), which is what the grammar
    // check measured.
    function drawShape(ctx, pc, at, c, glow) {
      var K = CFX.kit, a = Math.min(1, at.a), still = cur.plan.still, t = cur.t;
      var hot = K.mix(c, [255, 255, 255], 0.3 + glow * 0.5);
      if (pc.shape === 'dot') {
        var tw = pc.twinkle && !still ? 0.86 + 0.14 * Math.sin(t * 0.018 + (pc.ph || 0)) : 1, s = at.s;
        ctx.fillStyle = css(c, a * 0.35 * tw); ctx.fillRect(at.x - s / 2, at.y - s / 2, s, s);
        ctx.fillStyle = css(hot, a * tw); ctx.fillRect(at.x - s * 0.31, at.y - s * 0.31, s * 0.62, s * 0.62);
      } else if (pc.shape === 'bits') {
        var bt = pc.bits, cell = at.s / bt.rows, x0 = at.x - bt.cols * cell / 2, y0 = at.y - at.s / 2, d, i;
        ctx.fillStyle = css(c, a * 0.32);
        for (i = 0; i < bt.dots.length; i++) { d = bt.dots[i]; ctx.fillRect(x0 + d[0] * cell, y0 + d[1] * cell, cell, cell); }
        ctx.fillStyle = css(hot, a);
        var ins = cell * 0.12;
        for (i = 0; i < bt.dots.length; i++) { d = bt.dots[i]; ctx.fillRect(x0 + d[0] * cell + ins, y0 + d[1] * cell + ins, cell - ins * 2, cell - ins * 2); }
      } else if (pc.shape === 'text') {
        var fs = at.s, Wt = fs * pc.sx, full = pc.txt, shown = full;
        if (pc.type && !still) shown = full.slice(0, Math.max(0, Math.min(full.length, Math.ceil(full.length * (t - pc.type.t0) / pc.type.ms))));
        ctx.save();
        ctx.font = '600 ' + fs.toFixed(1) + 'px ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace';
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        // Squeeze the line if this font runs wider than the plan allowed.
        var room = Wt - (pc.cursor ? fs * 0.62 : 0), mw = ctx.measureText(full).width, sc = mw > room ? room / mw : 1;
        ctx.translate(at.x - Wt / 2, at.y); ctx.scale(sc, 1);
        // The phosphor's bleed: the text a pixel either side, dimmer, under
        // the bright pass (shadowBlur looked the same and cost a third of
        // the frame rate on a CPU canvas).
        ctx.globalAlpha = a * 0.4; ctx.fillStyle = css(c, 1);
        ctx.fillText(shown, -1, 0); ctx.fillText(shown, 1, 0);
        ctx.globalAlpha = a; ctx.fillStyle = css(hot, 1); ctx.fillText(shown, 0, 0);
        if (pc.cursor && shown.length === full.length && (still || Math.floor(t / 260) % 2 === 0)) ctx.fillRect(ctx.measureText(full).width + fs * 0.12, -fs * 0.42, fs * 0.5, fs * 0.84);
        ctx.restore(); ctx.globalAlpha = 1;
      } else if (pc.shape === 'tower') {
        var tw2 = pc.w, bodyH = at.s * (pc.ant ? 0.84 : 1), bot = at.y + at.s / 2, top = bot - bodyH, l = at.x - tw2 / 2;
        // A dark silhouette (drawn over, so it hides the card behind), a
        // neon edge, lit windows.
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(6,4,18,' + (0.94 * a).toFixed(3) + ')'; ctx.fillRect(l, top, tw2, bodyH);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = css(c, a * (0.8 + glow * 0.2)); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(l + 0.75, bot); ctx.lineTo(l + 0.75, top + 0.75); ctx.lineTo(l + tw2 - 0.75, top + 0.75); ctx.lineTo(l + tw2 - 0.75, bot); ctx.stroke();
        var dw = pc.data, phase = dw && !still && t >= dw[0] && t < dw[1] ? Math.floor(t / 70) : -1;
        var cols = Math.max(1, Math.floor((tw2 - 4) / 7)), rows = Math.floor((bodyH - 6) / 9), wx0 = l + (tw2 - cols * 7 + 3) / 2;
        ctx.fillStyle = 'rgba(255,214,120,' + (0.8 * a).toFixed(3) + ')';
        for (var r = 0; r < rows; r++) for (var q = 0; q < cols; q++) {
          if (hash3(pc.seed, r * 31 + q, phase) < (phase >= 0 ? 0.5 : 0.38)) ctx.fillRect(wx0 + q * 7, top + 5 + r * 9, 3, 4);
        }
        if (pc.ant) {
          var ah = at.s - bodyH;
          ctx.fillStyle = css(c, a * 0.8); ctx.fillRect(at.x - 0.75, top - ah + 2, 1.5, ah - 2);
          if (still || Math.floor(t / 400) % 2 === 0) { ctx.fillStyle = 'rgba(255,60,60,' + a.toFixed(3) + ')'; ctx.fillRect(at.x - 1.5, top - ah, 3, 3); }
        }
      }
    }
    function fire(m) {
      var K = CFX.kit, c = m.rgb || cur.rgb, still = cur.plan.still;
      stats.fired[m.k] = (stats.fired[m.k] || 0) + 1;
      if (m.k === 'shock' && !still) K.shock(m.x, m.y, c, m.R, 0.42, m.sx, m.sy);
      else if (m.k === 'flare' && !still) K.flare(m.x, m.y, c, m.s, 0.5);
      else if (m.k === 'ring' && !still) K.ring(m.x, m.y, c, m.R, 0.6, 2.5);
      else if (m.k === 'sparks' && !still) K.sparks(m.x, m.y, m.ember && m.warm !== false ? K.mix(c, [255, 220, 150], 0.35) : c, m.n, m.spd, { angle: m.angle, spread: m.spread, life: m.life, size: m.ember ? 1.6 : undefined });
      else if (m.k === 'grid' && !still) { K.gridForce(m.x, m.y, m.f, m.r); K.gridTint(m.x, m.y, c, m.r); }
      else if (m.k === 'pulse') cur.pulses.push({ t: m.t, ms: m.ms });
      else if (m.k === 'veil') cur.veil = m;
      else if (m.k === 'crt') cur.crt = m;
      else if (m.k === 'sound' && typeof SND !== 'undefined') SND.play(m.kind, cur.plan.faction, m.tier, { left: m.x - window.scrollX, width: 0 });
      else if (m.k === 'duck' && typeof MUS !== 'undefined' && MUS.duckHold) MUS.duckHold(m.ms / 1000);
      else if (m.k === 'panel') { if (cur.els.panel) { cur.els.panel.style.setProperty('--fc', fxKitOf(cur.plan.faction).col); cur.els.panel.classList.add('boast-panel'); } }
      else if (m.k === 'name') showName(m);
      else if (m.k === 'end') finish('end');
    }
    // The plate: "<NAME> WINS" (the name in the boast's colour, WINS in
    // white) over the boast's own name. On a close win the plate opens on
    // the close-call line alone and swaps to the winner's line m.close ms
    // later (in the still too: a swap of words, no motion).
    function showName(m) {
      var el = document.createElement('div');
      el.className = 'boast-name' + (cur.plan.still ? ' still' : '') + (m.mono ? ' mono' : '');
      el.style.setProperty('--fc', cur.plan.col || fxKitOf(cur.plan.faction).col);
      el.style.left = (m.x - m.w / 2) + 'px'; el.style.top = (m.y - m.h / 2) + 'px';
      el.style.width = m.w + 'px'; el.style.height = m.h + 'px';
      var tag = document.createElement('div'); tag.className = 'boast-tag'; tag.textContent = cur.plan.name.toUpperCase();
      el.appendChild(tag);
      document.body.appendChild(el);
      cur.dom.push(el);
      if (!m.close) { showWho(el, tag, m); return; }
      var cl = document.createElement('div'); cl.className = 'boast-close'; cl.textContent = BOAST_CLOSE_LINE;
      el.insertBefore(cl, tag);
      var me = cur;
      cur.timers.push(setTimeout(function () {
        if (cur !== me || me.ended) return;
        cl.remove();
        el.classList.add('swapped');
        showWho(el, tag, m);
      }, m.close));
    }
    function showWho(el, tag, m) {
      var nm = document.createElement('div'); nm.className = 'boast-who';
      var who = document.createElement('span'); who.className = 'boast-wn'; who.textContent = cur.who;
      var wins = document.createElement('span'); wins.className = 'boast-wins'; wins.textContent = ' ' + BOAST_WINS;
      nm.appendChild(who); nm.appendChild(wins);
      el.insertBefore(nm, tag);
      // Boot Sequence's plate ends on a block cursor; it is measured with it.
      var cu = null;
      if (m.mono) { cu = document.createElement('span'); cu.className = 'boast-cur'; nm.appendChild(cu); }
      // Long names shrink to fit the plate, never cut off. Measured by
      // layout width: WINS starts its stamp scaled up, which scrollWidth
      // would count.
      function lineW() {
        var w = 0;
        for (var c = nm.firstChild; c; c = c.nextSibling) { var cs = getComputedStyle(c); w += c.offsetWidth + (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0); }
        return w;
      }
      var max = parseFloat(getComputedStyle(nm).fontSize) || 28;
      for (var fs = max; fs > 11 && lineW() > m.w; fs -= 1) nm.style.fontSize = fs + 'px';
      if (m.type && !cur.plan.still) {
        // Typed a key at a time, left to right, behind the cursor: the
        // plate keeps the whole line's width so the text doesn't shift.
        var name = cur.who, full = name + ' ' + BOAST_WINS, k = 0, me = cur;
        // (scrollWidth, not the rect: the plate is still scaled by its rise.)
        nm.style.width = (lineW() + 1) + 'px';
        who.textContent = ''; wins.textContent = '';
        var iv = setInterval(function () {
          if (cur !== me || me.ended) { clearInterval(iv); return; }
          k++;
          who.textContent = full.slice(0, Math.min(k, name.length));
          wins.textContent = k > name.length ? full.slice(name.length, k) : '';
          if (k >= full.length) clearInterval(iv);
        }, m.type);
        cur.timers.push(iv);
      }
    }
    function onKey(e) { if (e.key === 'Escape' && cur && !cur.ended) { e.preventDefault(); skip(); } }
    function onDown(e) { if (cur && !cur.ended) skip(); }
    function teardown() {
      if (!cur) return;
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
      cur.dom.forEach(function (d) { d.classList.add('gone'); setTimeout(function () { d.remove(); }, 340); });
      cur.dom = [];
      // (Intervals and the close-call swap's timeout: one id pool.)
      cur.timers.forEach(function (iv) { clearInterval(iv); clearTimeout(iv); });
      cur.timers = [];
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
    // play(id, els, opts): opts { who (the winner's name), faction (the
    // winner's: a neutral boast's panel and sting), onEnd(reason), reduced,
    // seed, close (a close win: the close-call line before the winner's
    // line, the boast BOAST_CLOSE_MS longer) }. Returns the plan played (or
    // null when nothing can be).
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
      var plan = boastPlan(spec, geom, opts.seed || 1, { name: opts.who, faction: opts.faction, close: !!opts.close });
      var problem = boastPlanProblem(plan, geom);
      var canDraw = CFX.isReady();
      if (problem || reduced || !canDraw) plan = boastStill(plan);
      if (plan.still) stats.still++;
      stats.played++;
      stats.problem = problem;
      stats.fired = {}; stats.peakPieces = 0; stats.drawn = 0; stats.groups = {};
      plan.pieces.forEach(function (pc) { var g = pc.grp || pc.shape || pc.sp; stats.groups[g] = (stats.groups[g] || 0) + 1; });
      cur = { plan: plan, els: els, who: opts.who || '', close: !!opts.close, onEnd: opts.onEnd || null, rgb: plan.rgb || rgbOf(plan.faction), t0: performance.now(), t: 0, next: 0, pulses: [], dom: [], timers: [], ended: false };
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
      stats: function () { return { active: !!cur && !cur.ended, t: cur ? Math.round(cur.t) : null, id: cur ? cur.plan.id : null, who: cur ? cur.who : null, close: cur ? cur.close : null, still: cur ? !!cur.plan.still : null, played: stats.played, skipped: stats.skipped, stillCount: stats.still, refused: stats.refused, problem: stats.problem || null, fired: stats.fired || {}, groups: stats.groups || {}, peakPieces: stats.peakPieces || 0, drawn: stats.drawn || 0, last: stats.last }; } };
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
.boast-name .boast-wins { white-space: pre; color: #f4f7ff; text-shadow: 0 0 10px rgba(220,232,255,0.75), 0 0 2px #000, 0 2px 4px #000; }
.boast-name:not(.mono) .boast-wins { display: inline-block; animation: boast-wins 300ms 160ms cubic-bezier(.2,.9,.3,1.4) both; }
@keyframes boast-wins { from { opacity: 0; transform: scale(1.5); } to { opacity: 1; transform: none; } }
.boast-name .boast-close { font-weight: bold; font-size: 26px; letter-spacing: 0.24em; white-space: nowrap; line-height: 1.1; color: #ffcf4a;
  text-shadow: 0 0 12px rgba(255,190,40,0.8), 0 0 2px #000, 0 2px 4px #000; animation: boast-close 260ms cubic-bezier(.2,.9,.3,1.3) both; }
@keyframes boast-close { from { opacity: 0; transform: scale(1.35); } to { opacity: 1; transform: none; } }
.boast-name.swapped .boast-who { animation: boast-rise 320ms cubic-bezier(.2,.9,.3,1.2) both; }
.boast-name .boast-tag { font-size: 10px; letter-spacing: 0.3em; color: var(--ink, #dfe7ff); opacity: 0.85; margin-top: 2px; text-shadow: 0 1px 3px #000; }
.boast-name.gone, .boast-skip.gone { opacity: 0; }
@keyframes boast-rise { from { opacity: 0; transform: translateY(10px) scale(0.92); } to { opacity: 1; transform: none; } }
.boast-skip { position: absolute; z-index: 97; font: inherit; font-size: 0.72rem; letter-spacing: 0.06em; color: var(--ink, #dfe7ff);
  background: rgba(10,12,22,0.82); border: 1px solid var(--line, #334); border-radius: 4px; padding: 4px 9px; cursor: pointer; transition: opacity 320ms ease; }
.boast-skip:hover, .boast-skip:focus-visible { border-color: var(--ink, #dfe7ff); }
.turnbar .win.land { display: inline-block; animation: boast-land 520ms cubic-bezier(.2,.9,.3,1.3) both; }
@keyframes boast-land { from { opacity: 0; transform: translateY(6px) scale(1.25); } to { opacity: 1; transform: none; } }
/* Boot Sequence's plate: the name in the BIOS's type, behind a block cursor. */
.boast-name.mono .boast-who { font-family: ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace; letter-spacing: 0.04em; text-align: left; }
.boast-name .boast-cur { display: inline-block; width: 0.55em; height: 0.85em; margin-left: 0.1em; vertical-align: -0.06em; background: var(--fc); box-shadow: 0 0 8px var(--fc); animation: boast-blink 0.52s steps(1) infinite; }
@keyframes boast-blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .boast-name, .turnbar .win.land, .boast-name .boast-cur, .boast-name .boast-wins, .boast-name .boast-close, .boast-name.swapped .boast-who { animation: none; } }
`;

import type { ReplayBoast } from "./types.js";

export interface BoastRect { l: number; t: number; r: number; b: number }
export interface BoastSlot extends BoastRect { filled?: boolean }
export interface BoastGeom { band: BoastRect; panel?: BoastRect | null; slots: BoastSlot[]; loser?: BoastRect[] }
export interface BoastKey { t: number; x: number; y: number; s: number; a: number; e?: "slam" | "in" | "out" }
export interface BoastBits { cols: number; rows: number; chars: number; dots: [number, number, number][] }
export interface BoastPiece {
  sp?: string; rot: number; centre?: boolean; row?: number; slot?: number; grp?: string; sx?: number; frame?: boolean; core?: boolean; spin?: number;
  /** Code-drawn (Season 0): text, a dot-font block, one pixel or a tower. */
  shape?: "text" | "bits" | "dot" | "tower"; w?: number; rgb?: [number, number, number];
  txt?: string; type?: { t0: number; ms: number }; cursor?: boolean; bits?: BoastBits;
  twinkle?: boolean; ph?: number; seed?: number; ant?: boolean; data?: [number, number];
  keys: BoastKey[];
}
export interface BoastMark {
  k: "shock" | "flare" | "ring" | "sparks" | "grid" | "sound" | "duck" | "panel" | "pulse" | "veil" | "crt" | "name" | "end";
  t: number;
  [key: string]: unknown;
}
export interface BoastBeat { p: string; at: number; [key: string]: unknown }
export interface BoastSpec { id: string; name: string; faction: string | null; col?: string; ms: number; beats: BoastBeat[] }
export interface BoastWho { name?: string; faction?: string; close?: boolean }
export interface BoastPlan {
  id: string; faction: string; name: string; ms: number; col?: string; rgb?: [number, number, number];
  pieces: BoastPiece[]; marks: BoastMark[];
  crest: { x: number; y: number; r: number };
  crestPieces?: number; still?: boolean; close?: boolean;
}

const impl = new Function(`${BOAST_PURE_SOURCE}; return { BOAST_MS_MAX: BOAST_MS_MAX, BOAST_CLEAR_MS: BOAST_CLEAR_MS, BOAST_CLOSE_MS: BOAST_CLOSE_MS, BOAST_WINS: BOAST_WINS, BOAST_CLOSE_LINE: BOAST_CLOSE_LINE, BOAST_STILL_MS: BOAST_STILL_MS, BOAST_LEAD_MS: BOAST_LEAD_MS, BOAST_STARTER: BOAST_STARTER, BOAST_PRIMS: BOAST_PRIMS, BOAST_FORMATIONS: BOAST_FORMATIONS, BOAST_SPECS: BOAST_SPECS, BOAST_FONT: BOAST_FONT, BOAST_NEON: BOAST_NEON, boastBits: boastBits, boastBitsFit: boastBitsFit, boastIdFor: boastIdFor, boastFromRecord: boastFromRecord, boastCosmeticsShown: boastCosmeticsShown, boastSpecProblem: boastSpecProblem, boastPlan: boastPlan, boastStill: boastStill, boastPlanProblem: boastPlanProblem, boastPieceAt: boastPieceAt };`)() as {
  BOAST_MS_MAX: number;
  BOAST_CLEAR_MS: number;
  BOAST_CLOSE_MS: number;
  BOAST_WINS: string;
  BOAST_CLOSE_LINE: string;
  BOAST_STILL_MS: number;
  BOAST_LEAD_MS: number;
  BOAST_STARTER: Record<string, string>;
  BOAST_PRIMS: string[];
  BOAST_FORMATIONS: Record<string, { size: number; lock: [number, number, number]; cells: [number, number][] }>;
  BOAST_SPECS: Record<string, BoastSpec>;
  BOAST_FONT: Record<string, string>;
  BOAST_NEON: string[];
  boastBits: (lines: string[]) => BoastBits;
  boastBitsFit: (text: string, w: number, h: number, maxCell?: number) => { bits: BoastBits; cell: number };
  boastIdFor: (recordId: string | null | undefined, faction: string) => string | null;
  boastFromRecord: (boast: ReplayBoast | null | undefined, winner: string | null | undefined, faction: string) => { id: string; slot: ReplayBoast["slot"] | "fallback"; close: boolean } | null;
  boastCosmeticsShown: (viewer: string | null | undefined, side: string, on: boolean) => boolean;
  boastSpecProblem: (spec: BoastSpec) => string | null;
  boastPlan: (spec: BoastSpec, geom: BoastGeom, seed?: number, who?: BoastWho) => BoastPlan;
  boastStill: (plan: BoastPlan) => BoastPlan;
  boastPlanProblem: (plan: BoastPlan, geom: BoastGeom) => string | null;
  boastPieceAt: (pc: BoastPiece, t: number) => { x: number; y: number; s: number; a: number } | null;
};

export const BOAST_MS_MAX = impl.BOAST_MS_MAX;
export const BOAST_CLEAR_MS = impl.BOAST_CLEAR_MS;
export const BOAST_CLOSE_MS = impl.BOAST_CLOSE_MS;
export const BOAST_WINS = impl.BOAST_WINS;
export const BOAST_CLOSE_LINE = impl.BOAST_CLOSE_LINE;
export const BOAST_STILL_MS = impl.BOAST_STILL_MS;
export const BOAST_LEAD_MS = impl.BOAST_LEAD_MS;
export const BOAST_STARTER = impl.BOAST_STARTER;
export const BOAST_PRIMS = impl.BOAST_PRIMS;
export const BOAST_FORMATIONS = impl.BOAST_FORMATIONS;
export const BOAST_SPECS = impl.BOAST_SPECS;
export const BOAST_FONT = impl.BOAST_FONT;
export const BOAST_NEON = impl.BOAST_NEON;
export const boastBits = impl.boastBits;
export const boastBitsFit = impl.boastBitsFit;
export const boastIdFor = impl.boastIdFor;
export const boastFromRecord = impl.boastFromRecord;
export const boastCosmeticsShown = impl.boastCosmeticsShown;
export const boastSpecProblem = impl.boastSpecProblem;
export const boastPlan = impl.boastPlan;
export const boastStill = impl.boastStill;
export const boastPlanProblem = impl.boastPlanProblem;
export const boastPieceAt = impl.boastPieceAt;
