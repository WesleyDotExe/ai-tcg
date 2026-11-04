// Match Boot (render session 35, slice 1 of the owner-approved plan,
// 2026-10-19): the short intro at the start of every match and replay.
//
// A new event category, "intro" (EFFECTS.md), with its own grammar:
// SYMMETRIC and CENTRE-OUT. Whatever happens in one half of the board
// happens in the other at the same moment, mirrored across the centre line
// between them; the only pieces that aren't mirrored are HANDSHAKE OK and the
// saying, which sit on the centre line itself, in neutral white-chrome. Any
// movement inside a half goes away from the centre line. So the intro
// favours neither side, and it is the opposite of a victory boast, which
// rises from the winner's side alone.
//
// The one exception (render session 53, the coin flip, owner-approved
// 2026-11-02): after the coin lands, a short edge pulse runs from the centre
// line into the FIRST player's half alone. The coin itself and its result
// line are centre pieces like HANDSHAKE OK (coinFx.ts has the coin).
//
// The beats (about 2.6 s before the coin; 3.4 s with it since session 53:
// the coin flicks up at 1.5 s, lands at 2.1 s, its line types at 2.2 s and
// the saying moves from 1.6 s to 2.4 s):
//   0-0.52 s  both halves power on like CRTs at the same instant, each in
//             its own faction's colour (a dot, a line, the picture opening
//             from it, a flicker), with one tube thump;
//   0.56 s    each half types its agent's line at the same speed,
//             `LOADING AGENT: <name> [<FACTION>]`; the shorter line is padded
//             so both finish together;
//   1.34 s    HANDSHAKE OK types once on the centre line, with a chirp;
//   1.6 s     the centre line flashes and the saying slams in across it in
//             the dot font, with a hit and a rising chord; both agent lines
//             lift away from the centre and fade;
//   2.2-2.6 s the saying swells and fades, the screens and scanlines go, and
//             the first board shows. The match starts.
//
// Three parts, the same split as the boasts:
//   bootSaying(seed): the saying, from the match's own seed (list 1, frozen:
//     a change to the list asks the game lane to store the saying on the
//     match record). 1 in 100 seeds is > SUDO FIGHT, the other eight equally.
//   bootPlan(geom, who, seed): the intro laid out on the page's real halves.
//     bootPlanProblem(plan, geom) checks the grammar on it: each half's
//     pieces inside that half, the two halves mirror images in place, size
//     and time, the centre pieces centred on the centre line, every move in
//     a half away from the centre, every sound panned to the centre.
//   BOOT (runtime): draws a plan on its own canvas over the board (code-drawn
//     text and the dot font: no atlas sprites, so it never waits on the FX
//     atlases), plays its sounds, and the Skip button. Reduced motion plays
//     bootStill: everything lit and still for about 1 s.
//
// Slice 2 (render session 38, sound and the phone): the sounds are queued on
// the audio clock (a dropped frame can't make one late), dead centre, and a
// skip cuts them; the intro has its own power-on (two tubes and a degauss
// hum) instead of Boot Sequence's; the rare saying has its own flourish; the
// music is silent under the intro and starts when it ends (owner call 8); on
// a narrow board the agent lines break after LOADING AGENT: so they read
// bigger; Skip is finger-sized on a touch screen.
//
// The page embeds MATCH_BOOT_PURE_SOURCE verbatim after BOAST_PURE_SOURCE
// (it reuses the dot font) and Node evaluates the same text for the tests.

import { BOAST_PURE_SOURCE } from "./boastFx.js";
import { COIN_PURE_SOURCE } from "./coinFx.js";

export const MATCH_BOOT_PURE_SOURCE = String.raw`
  // The intro's length, the reduced-motion still's, and when the outro starts.
  // Render session 53: 2.6 s -> 3.4 s with the coin flip (the saying lands
  // at COIN_GONE_AT, 2.4 s); the still 1.0 s -> 1.3 s (the landed coin, then
  // the saying from BOOT_STILL_SAY_AT).
  var BOOT_MS = 3400, BOOT_STILL_MS = 1300, BOOT_OUT_AT = 3000, BOOT_STILL_SAY_AT = 600;
  // The sayings, list 1 (owner 2026-10-19; frozen: render session 34's plan,
  // call 9). Never a card name; not JACK IN. Old replays show the saying the
  // seed picks from this list, so changing it (adding, removing, reordering)
  // changes theirs: the game lane must store the saying on the match record
  // first.
  var BOOT_LIST_VERSION = 1;
  var BOOT_SAYINGS = ['FIGHT', 'ENGAGE', '> RUN MATCH.EXE', 'EXECUTE', 'LINK ESTABLISHED', 'ACCESS GRANTED', 'OVERCLOCK', 'BREACH'];
  var BOOT_RARE = '> SUDO FIGHT';
  // Neutral white-chrome for the centre pieces.
  var BOOT_CHROME = [228, 238, 255];
  // A seed's hash: a 32-bit finaliser over the seed (and its high bits, for
  // a seed past 2^32), so neighbouring seeds land far apart.
  function bootHash(seed) {
    var n = Math.abs(Math.floor(Number(seed) || 0)), lo = n >>> 0, hi = Math.floor(n / 4294967296) >>> 0;
    var h = Math.imul(lo ^ 0x2545F491, 0x9E3779B1) ^ Math.imul((hi + 0x6B43A9B5) | 0, 0x85EBCA77);
    h ^= h >>> 16; h = Math.imul(h, 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
    return h >>> 0;
  }
  // The match's saying: exactly 1 in 100 hashes is the rare one; the rest
  // spread evenly over the eight.
  function bootSaying(seed) {
    var h = bootHash(seed);
    if (h % 100 === 0) return BOOT_RARE;
    return BOOT_SAYINGS[Math.floor(h / 100) % BOOT_SAYINGS.length];
  }
  var BOOT_HEAD = 'LOADING AGENT: ';
  function bootTail(name, faction) { return String(name || 'AGENT') + ' [' + String(faction || 'Neutral').toUpperCase() + ']'; }
  function bootLine(name, faction) { return BOOT_HEAD + bootTail(name, faction); }
  // A monospace character's width, as a share of the type size (the BIOS
  // type Boot Sequence uses; the runtime squeezes a wider font to fit).
  var BOOT_CH = 0.62;
  // The agent lines' type size: at most 15 px on one line. When the board's
  // width is what squeezes one line (a phone), the line breaks after
  // LOADING AGENT: and the two rows may reach 20 px (render session 38).
  var BOOT_FS_MAX = 15, BOOT_FS2_MAX = 20, BOOT_LH = 1.3;

  // bootPlan(geom, who, seed, opts) -> the intro on this page's layout.
  //   geom: { top, bot, area } in document pixels ({ l, t, r, b }): the top
  //     and bottom halves of the board (seat 2's side and seat 1's) and the
  //     area the intro covers (both halves and the gap between them).
  //   who: { top: { name, faction }, bot: { name, faction } }.
  //   opts.saying: shows this saying instead of the seed's (the sheet only).
  //   opts.coin: the coin flip (render session 53): { id (the coin's item
  //     id), first ('top' | 'bot': the half of the player who goes first),
  //     portraitUp (it lands on the portrait: the bottom player, whose coin
  //     it is, goes first), line (the result line, coinResult) }. Without
  //     it, the bottom player goes first on the house coin.
  // The halves are laid out from distances to the centre line (mid), never
  // from one half's own box, so they come out mirror images even when the
  // page gives one half a pixel more.
  function bootPlan(geom, who, seed, opts) {
    opts = opts || {};
    who = who || {};
    var top = geom.top, bot = geom.bot, area = geom.area;
    var mid = (top.b + bot.t) / 2;
    var l = Math.max(top.l, bot.l), r = Math.min(top.r, bot.r), cx = (l + r) / 2, W = r - l;
    var dNear = Math.max(mid - top.b, bot.t - mid), dFar = Math.min(mid - top.t, bot.b - mid), H = dFar - dNear;
    var saying = opts.saying || bootSaying(seed);
    function pad(t, k) { while (t.length < k) t += ' '; return t; }
    var lines = { top: bootLine(who.top && who.top.name, who.top && who.top.faction), bot: bootLine(who.bot && who.bot.name, who.bot && who.bot.faction) };
    var tails = { top: bootTail(who.top && who.top.name, who.top && who.top.faction), bot: bootTail(who.bot && who.bot.name, who.bot && who.bot.faction) };
    // The shorter line is padded so both type for the same time.
    var n = Math.max(lines.top.length, lines.bot.length);
    var fit1 = (W - 24) / (BOOT_CH * (n + 1)), fs = Math.max(7, Math.min(BOOT_FS_MAX, H * 0.12, fit1));
    // Two rows, LOADING AGENT: over the name, when the width squeezes one
    // row and two come out a fifth bigger or more. Both halves break the
    // same way (the rows padded to one length), so they stay mirror images.
    var nTail = Math.max(tails.top.length, tails.bot.length), nRow = Math.max(BOOT_HEAD.length, nTail);
    var fs2 = Math.min(BOOT_FS2_MAX, H * 0.1, (W - 24) / (BOOT_CH * (nRow + 1)));
    var two = fit1 < BOOT_FS_MAX && fs2 >= fs * 1.2;
    if (two) { fs = fs2; n = BOOT_HEAD.length + nTail; }
    var lineW = BOOT_CH * fs * ((two ? nRow : n) + 1), x0 = cx - lineW / 2;
    var dLine = dNear + H * 0.5;
    var typeAt = 560, typeMs = Math.min(720, n * 22);
    function half(side) {
      var s = side === 'top' ? -1 : 1, f = (who[side] && who[side].faction) || 'Neutral';
      var nearY = mid + s * (dNear + 4), farY = mid + s * (dFar - 4);
      var line = { txt: pad(lines[side], two ? 0 : n), len: lines[side].length, x0: x0, w: lineW, y: mid + s * dLine, fs: fs, t0: typeAt, ms: typeMs,
        // The readouts clear as the saying lands: each lifts AWAY from the
        // centre line and fades.
        clear: { t: COIN_GONE_AT, ms: 260, dy: s * fs * 1.2 } };
      // Two rows type one after the other, as one line of n characters;
      // y is the middle of the pair, the rows BOOT_LH type sizes apart.
      if (two) line.rows = [pad(BOOT_HEAD.replace(/ $/, ''), BOOT_HEAD.length), pad(tails[side], nTail)];
      return {
        side: side, faction: f,
        screen: { l: l + 4, r: r - 4, t: Math.min(nearY, farY), b: Math.max(nearY, farY) },
        on: { t: 0, ms: 420, flick: 520 },
        line: line
      };
    }
    var halves = [half('top'), half('bot')];
    var hsFs = Math.max(8, Math.min(fs * 1.1, 16));
    var handshake = { txt: 'HANDSHAKE OK', x: cx, y: mid, fs: hsFs, t0: 1340, ms: 140, gone: COIN_FLICK_AT };
    // The saying: the dot font as large as fits across the board and about
    // two thirds of the way into each half; it breaks onto two lines when
    // that makes it bigger (a phone).
    var sayH = Math.max(14, Math.min(150, (dNear + H * 0.66) * 2));
    var fit = boastBitsFit(saying, W * 0.86, sayH, 12);
    var say = { text: saying, rare: saying === BOOT_RARE, bits: fit.bits, cell: fit.cell, x: cx, y: mid,
      w: fit.bits.cols * fit.cell, h: fit.bits.rows * fit.cell, t: COIN_GONE_AT, slam: 140, out: [BOOT_OUT_AT, BOOT_MS], grow: 0.08 };
    // The coin and its result line: one block centred on the centre line,
    // the coin above the line, clear of both agent lines even at the top of
    // its rise (COIN_PEAK).
    var co = opts.coin || {};
    var first = co.first === 'top' ? 'top' : 'bot';
    var portraitUp = co.portraitUp != null ? !!co.portraitUp : first === 'bot';
    var resTxt = String(co.line || ((who[first] && who[first].name ? String(who[first].name).toUpperCase() : 'AGENT') + ' GOES FIRST'));
    var rfs = Math.max(7, Math.min(14, (W * 0.8) / (BOOT_CH * (resTxt.length + 1))));
    var gap = rfs * 0.5, lineHalf = fs * 0.6 + (two ? fs * BOOT_LH / 2 : 0), avail = dLine - lineHalf - 4;
    // reach: how far the coin's light goes past its rim (a neon or phosphor
    // rim's halo, render session 55), as a share of its size; the block
    // keeps that clear of the agent lines too.
    var coinSpec = coinSpecOf(co.id), reach = coinSpec.spec.neon ? COIN_NEON_REACH : 1;
    var cr = Math.max(5, Math.min(40, (avail - (gap + rfs) / 2) / (COIN_PEAK * reach), avail - gap / 2 - rfs * 0.6));
    var coin = { id: coinSpec.id, fallback: coinSpec.fallback, x: cx, y: mid - (gap + rfs) / 2, r: cr, reach: reach, t0: COIN_FLICK_AT, land: COIN_LAND_AT, gone: COIN_GONE_AT,
      halfTurns: coinHalfTurns(portraitUp), portraitUp: portraitUp, whir: coinSpec.spec.whir || 'coinWhir' };
    var result = { txt: resTxt, x: cx, y: mid + cr + gap / 2, fs: rfs, t0: COIN_LINE_AT, ms: Math.min(220, resTxt.length * 12), gone: COIN_GONE_AT };
    // The edge pulse: a band of the first player's colour runs from the
    // centre edge of their half's screen to its far edge, and fades.
    var fh = halves[first === 'top' ? 0 : 1].screen, fsgn = first === 'top' ? -1 : 1;
    var pulse = { side: first, t: COIN_PULSE_AT, ms: COIN_PULSE_MS, l: fh.l, r: fh.r, from: first === 'top' ? fh.b : fh.t, to: first === 'top' ? fh.t : fh.b, dir: fsgn };
    var marks = [];
    // Every sound sits on the centre: its pan favours neither side (x is
    // the board's centre line; the runtime plays them at pan 0, dead centre
    // of the speakers, wherever the board sits in the window).
    function snd(t, kind, tier) { marks.push({ k: 'sound', t: t, kind: kind, tier: tier || 'normal', x: cx }); }
    // Its own power-on (two tubes and a degauss hum), not Boot Sequence's.
    snd(0, 'bootOn');
    // One key click for each pair of characters, shared by both lines (they
    // type in step).
    for (var q = 0; q < n; q += 2) snd(typeAt + typeMs * q / n, 'type', 'subtle');
    snd(handshake.t0, 'handshake');
    for (var q2 = 0; q2 < 4; q2++) snd(handshake.t0 + q2 * 30, 'type', 'subtle');
    // The coin: the flick off the thumb, its whir as it spins, the clink as
    // it lands; dead centre like every intro sound.
    snd(coin.t0, 'coinFlick');
    snd(coin.t0 + 40, coin.whir);
    snd(coin.land, 'coinClink');
    snd(say.t, 'bootHit', 'spectacle');
    // The rare saying is heard too: root access granted, over the hit.
    if (say.rare) snd(say.t + 60, 'bootRoot', 'normal');
    // The music is silent under the whole intro and starts when it ends
    // (the owner's call 8, "music starts after").
    marks.push({ k: 'music', t: 0, ms: BOOT_MS });
    marks.push({ k: 'end', t: BOOT_MS });
    marks.sort(function (u, v) { return u.t - v.t; });
    return { ms: BOOT_MS, out: BOOT_OUT_AT, list: BOOT_LIST_VERSION, saying: saying, mid: mid, cx: cx, area: { l: area.l, t: area.t, r: area.r, b: area.b },
      halves: halves, handshake: handshake, say: say, marks: marks, first: first, coin: coin, result: result, pulse: pulse };
  }

  // The reduced-motion still: both halves lit, both agent lines whole, the
  // coin already landed with its result line and the first player's half
  // lit at its edge (render session 53), then at BOOT_STILL_SAY_AT the
  // saying on the centre line and HANDSHAKE OK under it (when it fits above
  // the bottom line), held to BOOT_STILL_MS. Cuts, no motion: no spin, no
  // flash, no swell; the tube's thump, the coin's clink and the saying's hit
  // still sound.
  function bootStill(plan) {
    var out = JSON.parse(JSON.stringify(plan));
    out.still = true; out.ms = BOOT_STILL_MS; out.out = BOOT_STILL_MS - 200;
    out.halves.forEach(function (h) { h.on = { t: 0, ms: 0, flick: 0 }; h.line.t0 = 0; h.line.ms = 0; h.line.clear = null; });
    var hs = out.handshake, bl = out.halves[1].line;
    hs.y = plan.mid + out.say.h / 2 + out.say.cell * 1.5 + hs.fs * 0.9; hs.t0 = BOOT_STILL_SAY_AT; hs.ms = 0; hs.gone = Infinity;
    if (hs.y + hs.fs / 2 > bl.y - bl.fs * 0.7) out.handshake = null;
    out.say.t = BOOT_STILL_SAY_AT; out.say.slam = 0; out.say.grow = 0; out.say.out = [out.out, out.ms];
    out.coin.t0 = 0; out.coin.land = 0; out.coin.gone = BOOT_STILL_SAY_AT;
    out.result.t0 = 0; out.result.ms = 0; out.result.gone = BOOT_STILL_SAY_AT;
    // The pulse becomes the first player's half lit at its edge, still.
    out.pulse.t = 0; out.pulse.ms = 0; out.pulse.gone = BOOT_STILL_SAY_AT;
    var AT = { bootOn: 0, coinClink: 0, bootHit: BOOT_STILL_SAY_AT, bootRoot: BOOT_STILL_SAY_AT };
    out.marks = out.marks.filter(function (m) { return m.k === 'music' || (m.k === 'sound' && m.kind in AT); })
      .map(function (m) { var c = {}; for (var k in m) c[k] = m[k]; c.t = c.k === 'sound' ? AT[c.kind] : 0; if (c.k === 'music') c.ms = BOOT_STILL_MS; return c; });
    out.marks.sort(function (u, v) { return u.t - v.t; });
    out.marks.push({ k: 'end', t: BOOT_STILL_MS });
    return out;
  }

  // The intro grammar, checked on a laid-out plan. Returns the first
  // problem, or null.
  function bootPlanProblem(plan, geom) {
    var tol = 1.5, mid = plan.mid, cx = plan.cx;
    function inBox(a, o) { return a.l >= o.l - tol && a.r <= o.r + tol && a.t >= o.t - tol && a.b <= o.b + tol; }
    function near(a, b) { return Math.abs(a - b) <= tol; }
    if (!plan.still && !(plan.ms >= 2000 && plan.ms <= 3500)) return 'the intro runs 2-3.5 s';
    if (BOOT_SAYINGS.indexOf(plan.saying) < 0 && plan.saying !== BOOT_RARE) return 'the saying is not on list ' + BOOT_LIST_VERSION;
    if (!(plan.halves && plan.halves.length === 2)) return 'two halves';
    var T = plan.halves[0], B = plan.halves[1];
    if (T.side !== 'top' || B.side !== 'bot') return 'the halves are top, then bottom';
    if (!(geom.top.b <= mid + tol && geom.bot.t >= mid - tol)) return 'the centre line lies between the halves';
    // Each half inside its own side; its agent line inside its screen.
    var halfBoxes = { top: geom.top, bot: geom.bot };
    for (var i = 0; i < 2; i++) {
      var h = plan.halves[i], ln = h.line;
      if (!inBox(h.screen, halfBoxes[h.side])) return h.side + ' screen leaves its half';
      var hh = ln.fs * 0.6 + (ln.rows ? ln.fs * BOOT_LH / 2 : 0);
      var lb = { l: ln.x0, r: ln.x0 + ln.w, t: ln.y - hh, b: ln.y + hh };
      if (!inBox(lb, h.screen)) return h.side + ' agent line leaves its screen';
      if (ln.t0 < h.on.t + h.on.ms) return h.side + ' agent line types before its screen is on';
      if (ln.clear) {
        var away = h.side === 'top' ? ln.clear.dy < 0 : ln.clear.dy > 0;
        if (!away) return h.side + ' agent line moves toward the centre';
        var cb = { l: lb.l, r: lb.r, t: lb.t + Math.min(0, ln.clear.dy), b: lb.b + Math.max(0, ln.clear.dy) };
        if (!inBox(cb, h.screen)) return h.side + ' agent line clears out of its screen';
      }
    }
    // The two halves are mirror images across the centre line.
    var ts = T.screen, bs = B.screen;
    if (!near(ts.l, bs.l) || !near(ts.r, bs.r) || !near(mid - ts.b, bs.t - mid) || !near(mid - ts.t, bs.b - mid)) return 'the screens are not mirror images';
    if (T.on.t !== B.on.t || T.on.ms !== B.on.ms || T.on.flick !== B.on.flick) return 'the halves power on at different times';
    var tl = T.line, bl = B.line;
    if (!!tl.rows !== !!bl.rows) return 'one agent line breaks onto two rows and the other does not';
    if (tl.rows ? (tl.rows[0].length !== bl.rows[0].length || tl.rows[1].length !== bl.rows[1].length) : tl.txt.length !== bl.txt.length) return 'the agent lines are padded to different lengths';
    if (tl.t0 !== bl.t0 || tl.ms !== bl.ms) return 'the agent lines type at different times';
    if (!near(tl.fs, bl.fs) || !near(tl.x0, bl.x0) || !near(tl.w, bl.w) || !near(mid - tl.y, bl.y - mid)) return 'the agent lines are not mirror images';
    if (!!tl.clear !== !!bl.clear || (tl.clear && (tl.clear.t !== bl.clear.t || tl.clear.ms !== bl.clear.ms || !near(-tl.clear.dy, bl.clear.dy)))) return 'the agent lines clear differently';
    // The centre pieces: centred across, on (or, in the still, under) the
    // centre line, inside the area.
    var s = plan.say;
    if (!near(s.x, cx) || !near(s.y, mid)) return 'the saying is off the centre line';
    var grow = 1 + (s.grow || 0);
    if (!inBox({ l: s.x - s.w * grow / 2, r: s.x + s.w * grow / 2, t: s.y - s.h * grow / 2, b: s.y + s.h * grow / 2 }, plan.area)) return 'the saying leaves the board';
    var hs = plan.handshake;
    if (hs) {
      if (!near(hs.x, cx)) return 'HANDSHAKE OK is off centre';
      if (!plan.still && !near(hs.y, mid)) return 'HANDSHAKE OK is off the centre line';
      var hw = BOOT_CH * hs.fs * hs.txt.length;
      if (!inBox({ l: hs.x - hw / 2, r: hs.x + hw / 2, t: hs.y - hs.fs * 0.6, b: hs.y + hs.fs * 0.6 }, plan.area)) return 'HANDSHAKE OK leaves the board';
    }
    // The coin and its result line (render session 53): one block centred
    // on the centre line, inside the board at the top of the rise, clear of
    // both agent lines while they show, gone as the saying lands; it lands
    // on the face it says.
    var co = plan.coin, rs = plan.result;
    if (!co || !rs) return 'no coin flip';
    if (!near(co.x, cx) || !near(rs.x, cx)) return 'the coin is off centre';
    if (!near(((co.y - co.r) + (rs.y + rs.fs / 2)) / 2, mid)) return 'the coin and its line are not centred on the centre line';
    var peak = plan.still ? 1 : COIN_PEAK, pr = co.r * peak * (co.reach || 1);
    var coinBox = { l: co.x - pr, r: co.x + pr, t: co.y - pr, b: co.y + pr };
    var rw = BOOT_CH * rs.fs * (rs.txt.length + 1);
    var resBox = { l: rs.x - rw / 2, r: rs.x + rw / 2, t: rs.y - rs.fs * 0.6, b: rs.y + rs.fs * 0.6 };
    if (!inBox(coinBox, plan.area)) return 'the coin leaves the board';
    if (!inBox(resBox, plan.area)) return 'the result line leaves the board';
    function hit(a, o) { return a.l < o.r - tol && a.r > o.l + tol && a.t < o.b - tol && a.b > o.t + tol; }
    for (i = 0; i < 2; i++) {
      var L = plan.halves[i].line, lh = L.fs * 0.6 + (L.rows ? L.fs * BOOT_LH / 2 : 0);
      var box = { l: L.x0, r: L.x0 + L.w, t: L.y - lh, b: L.y + lh };
      var shownTo = L.clear ? L.clear.t + L.clear.ms : Infinity;
      if (co.t0 < shownTo && (hit(coinBox, box) || hit(resBox, box))) return 'the coin runs into the ' + plan.halves[i].side + ' agent line';
    }
    if (plan.handshake && plan.handshake.gone > co.t0) {
      var hs2 = plan.handshake, hw2 = BOOT_CH * hs2.fs * hs2.txt.length;
      if (hit(coinBox, { l: hs2.x - hw2 / 2, r: hs2.x + hw2 / 2, t: hs2.y - hs2.fs * 0.6, b: hs2.y + hs2.fs * 0.6 })) return 'the coin shows over HANDSHAKE OK';
    }
    if (!(co.land >= co.t0 && rs.t0 >= co.land && co.gone <= s.t && rs.gone <= s.t)) return 'the coin is out of order: flick, land, its line, gone as the saying lands';
    if (coinFaceAt(coinFlight(1, co.halfTurns).angle) !== (co.portraitUp ? 'portrait' : 'design')) return 'the coin lands on the wrong face';
    // The one exception to the grammar: the edge pulse, in the first
    // player's half only, moving away from the centre, after the landing.
    var pu = plan.pulse;
    if (!pu || pu.side !== plan.first) return 'the edge pulse is not in the half of the player who goes first';
    var ph = plan.halves[pu.side === 'top' ? 0 : 1].screen;
    if (!(pu.l >= ph.l - tol && pu.r <= ph.r + tol && Math.min(pu.from, pu.to) >= ph.t - tol && Math.max(pu.from, pu.to) <= ph.b + tol)) return 'the edge pulse leaves its half';
    if (!(Math.abs(pu.to - mid) > Math.abs(pu.from - mid))) return 'the edge pulse moves toward the centre';
    if (pu.t < co.land) return 'the edge pulse runs before the coin lands';
    for (i = 0; i < plan.marks.length; i++) {
      var m = plan.marks[i];
      if (m.t > plan.ms + 1) return m.k + ' after the intro ends';
      if (m.k === 'sound' && !near(m.x, cx)) return 'a sound is panned off centre';
    }
    if (!plan.marks.some(function (m) { return m.k === 'end'; })) return 'no end';
    var mu = plan.marks.filter(function (m) { return m.k === 'music'; });
    if (mu.length !== 1 || mu[0].t !== 0 || mu[0].ms !== plan.ms) return 'the music does not wait for the whole intro';
    return null;
  }
`;

export const MATCH_BOOT_RUNTIME_SOURCE = String.raw`
  var BOOT = (function () {
    var cur = null, stats = { played: 0, skipped: 0, still: 0, cancelled: 0, ended: 0, last: null };
    var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    function rect(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect(), sx = window.scrollX, sy = window.scrollY;
      return { l: r.left + sx, t: r.top + sy, r: r.right + sx, b: r.bottom + sy };
    }
    function css(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + Math.max(0, a).toFixed(3) + ')'; }
    function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
    function hash3(a, b, d) {
      var x = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(d | 0, 1274126177);
      x = Math.imul(x ^ (x >>> 13), 1274126177);
      return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
    }
    function ease(u) { u = Math.max(0, Math.min(1, u)); return 1 - Math.pow(1 - u, 3); }
    var MONO = 'ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace';

    // How much of the intro still shows: all of it until the outro, then it
    // fades to the board.
    function outFade(t) { var p = cur.plan; return t < p.out ? 1 : Math.max(0, 1 - (t - p.out) / Math.max(1, p.ms - p.out)); }

    // One half powering on: a dot widens into a line along the half's
    // middle, the picture opens from it, a flicker, then a dark screen with
    // the faction's faint haze and scanlines.
    function drawScreen(ctx, h, t, fade) {
      var s = h.screen, W = s.r - s.l, H = s.b - s.t, mx = (s.l + s.r) / 2, my = (s.t + s.b) / 2, c = h.rgb;
      var u = h.on.ms > 0 ? (t - h.on.t) / h.on.ms : 1, ft = t - h.on.t - h.on.ms;
      if (u < 0) return;
      var rr = Math.min(12, W / 10), open = H;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = css(mix(c, [0, 0, 0], 0.93), 0.9 * fade);
      if (u >= 0.35) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(s.l, s.t, W, H, rr); else ctx.rect(s.l, s.t, W, H); ctx.fill(); }
      ctx.globalCompositeOperation = 'lighter';
      if (u < 0.35) {
        var lw = Math.max(4, W * u / 0.35);
        ctx.fillStyle = css(c, 0.3 * fade); ctx.fillRect(mx - lw / 2, my - 4, lw, 8);
        ctx.fillStyle = css(mix(c, [255, 255, 255], 0.7), 0.95 * fade); ctx.fillRect(mx - lw / 2, my - 1, lw, 2);
        open = 2;
      } else if (u < 1) {
        var v = (u - 0.35) / 0.65;
        open = H * (0.02 + 0.98 * ease(v));
        ctx.fillStyle = css(c, (0.45 * (1 - v) + 0.05) * fade); ctx.fillRect(s.l, my - open / 2, W, open);
      } else {
        var fl = ft < h.on.flick - h.on.ms && !cur.plan.still ? 0.75 + 0.25 * hash3(Math.floor(ft / 45), 11, 5) : 1;
        ctx.fillStyle = css(c, 0.06 * fade * fl); ctx.fillRect(s.l, s.t, W, H);
        // The tube's edge glow.
        ctx.strokeStyle = css(c, 0.35 * fade * fl); ctx.lineWidth = 1;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(s.l + 0.5, s.t + 0.5, W - 1, H - 1, rr); else ctx.rect(s.l + 0.5, s.t + 0.5, W - 1, H - 1); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,' + (0.32 * fade).toFixed(3) + ')';
      for (var y = Math.ceil(my - open / 2); y < my + open / 2; y += 3) ctx.fillRect(s.l, y, W, 1);
      ctx.globalCompositeOperation = 'lighter';
    }
    // Terminal type: the phosphor's bleed a pixel either side, then the
    // bright pass. x is the line's left edge, w its room; a wider font is
    // squeezed to fit.
    function drawType(ctx, txt, shown, x, y, fs, w, c, a, cursor) {
      if (a <= 0.003) return;
      ctx.save();
      ctx.font = '600 ' + fs.toFixed(1) + 'px ' + MONO;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      var mw = ctx.measureText(txt + ' ').width, sc = mw > w ? w / mw : 1;
      ctx.translate(x, y); ctx.scale(sc, 1);
      ctx.globalAlpha = a * 0.4; ctx.fillStyle = css(c, 1);
      ctx.fillText(shown, -1, 0); ctx.fillText(shown, 1, 0);
      ctx.globalAlpha = a; ctx.fillStyle = css(mix(c, [255, 255, 255], 0.35), 1); ctx.fillText(shown, 0, 0);
      if (cursor) ctx.fillRect(ctx.measureText(shown).width + fs * 0.1, -fs * 0.42, fs * 0.5, fs * 0.84);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    function drawLine(ctx, h, t, fade) {
      var ln = h.line;
      if (t < ln.t0) return;
      var k = ln.ms > 0 ? Math.min(ln.txt.length, Math.ceil(ln.txt.length * (t - ln.t0) / ln.ms)) : ln.txt.length;
      var shown = ln.txt.slice(0, k), y = ln.y, a = fade;
      if (ln.clear && t >= ln.clear.t) {
        var u = (t - ln.clear.t) / ln.clear.ms;
        if (u >= 1) return;
        y += ln.clear.dy * ease(u); a *= 1 - u;
      }
      // The cursor runs on through a shorter line's padding, so both stop
      // together; then it blinks until the line clears.
      var blink = cur.plan.still || Math.floor(t / 260) % 2 === 0;
      if (ln.rows) {
        // Two rows typed as one line: the first row, then the second.
        var r0 = ln.rows[0], r1 = ln.rows[1], all = r0.length + r1.length, gap = ln.fs * BOOT_LH / 2;
        var kk = ln.ms > 0 ? Math.min(all, Math.ceil(all * (t - ln.t0) / ln.ms)) : all;
        var k0 = Math.min(kk, r0.length), k1 = Math.max(0, kk - r0.length);
        drawType(ctx, r0, r0.slice(0, k0), ln.x0, y - gap, ln.fs, ln.w, h.rgb, a, k0 < r0.length);
        if (kk >= r0.length) drawType(ctx, r1, r1.slice(0, k1), ln.x0, y + gap, ln.fs, ln.w, h.rgb, a, k1 < r1.length || blink);
        return;
      }
      var typing = k < ln.txt.length;
      drawType(ctx, ln.txt, shown, ln.x0, y, ln.fs, ln.w, h.rgb, a, typing || blink);
    }
    function drawHandshake(ctx, hs, t, fade) {
      if (!hs || t < hs.t0 || t >= hs.gone) return;
      var k = hs.ms > 0 ? Math.min(hs.txt.length, Math.ceil(hs.txt.length * (t - hs.t0) / hs.ms)) : hs.txt.length;
      var w = BOOT_CH * hs.fs * (hs.txt.length + 1);
      // A dark band behind it, so it reads over both screens' edges.
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(3,5,10,' + (0.85 * fade).toFixed(3) + ')';
      ctx.fillRect(hs.x - w / 2 - 8, hs.y - hs.fs * 0.75, w + 16, hs.fs * 1.5);
      ctx.globalCompositeOperation = 'lighter';
      drawType(ctx, hs.txt, hs.txt.slice(0, k), hs.x - w / 2, hs.y, hs.fs, w, BOOT_CHROME, fade, k < hs.txt.length);
    }
    // The centre line flashes as the saying lands: a white line runs out
    // from the centre to both edges at once and fades.
    function drawFlash(ctx, p, t) {
      var s = p.say, u = (t - s.t) / 300;
      if (p.still || u < 0 || u >= 1) return;
      var W = p.halves[0].screen.r - p.halves[0].screen.l, w = W * Math.min(1, ease(u * 2.5)), a = 1 - u;
      ctx.fillStyle = css(BOOT_CHROME, 0.3 * a); ctx.fillRect(p.cx - w / 2, p.mid - 5, w, 10);
      ctx.fillStyle = css([255, 255, 255], 0.95 * a); ctx.fillRect(p.cx - w / 2, p.mid - 1, w, 2);
    }
    // The saying in the dot font, white-chrome: each dot lit from white at
    // the top of a letter to a cool steel at its foot, over a soft glow.
    function drawSaying(ctx, p, t) {
      var s = p.say;
      if (t < s.t) return;
      var u = s.slam > 0 ? Math.min(1, (t - s.t) / s.slam) : 1, sc = 1.3 - 0.3 * ease(u), a = Math.min(1, u * 2.5);
      if (t >= s.out[0]) { var v = Math.min(1, (t - s.out[0]) / Math.max(1, s.out[1] - s.out[0])); sc *= 1 + (s.grow || 0) * ease(v); a *= 1 - v; }
      if (a <= 0.003) return;
      var cell = s.cell * sc, bt = s.bits, x0 = s.x - bt.cols * cell / 2, y0 = s.y - bt.rows * cell / 2, d, i;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(3,5,10,' + (0.55 * a).toFixed(3) + ')';
      ctx.fillRect(x0 - cell * 2, y0 - cell * 1.5, bt.cols * cell + cell * 4, bt.rows * cell + cell * 3);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = css(BOOT_CHROME, a * 0.28);
      for (i = 0; i < bt.dots.length; i++) { d = bt.dots[i]; ctx.fillRect(x0 + d[0] * cell - cell * 0.15, y0 + d[1] * cell - cell * 0.15, cell * 1.3, cell * 1.3); }
      var ins = cell * 0.1;
      for (i = 0; i < bt.dots.length; i++) {
        d = bt.dots[i];
        var row = d[1] % 9;
        ctx.fillStyle = css(mix([255, 255, 255], [150, 178, 222], row / 6), a);
        ctx.fillRect(x0 + d[0] * cell + ins, y0 + d[1] * cell + ins, cell - ins * 2, cell - ins * 2);
      }
    }
    // The coin flip (render session 53, coinFx.ts draws the coin).
    function drawCoinFlip(ctx, p, t, fade) {
      var co = p.coin, rs = p.result;
      if (!co || t < co.t0 || t >= co.gone + 140) return;
      var a = fade * (t < co.gone ? 1 : 1 - (t - co.gone) / 140);
      var fl = co.land > co.t0 ? coinFlight((t - co.t0) / (co.land - co.t0), co.halfTurns) : coinFlight(1, co.halfTurns);
      // A small settle on the landing: it bounces once, a tenth of its size.
      var since = t - co.land, settle = since >= 0 && since < 160 && !p.still ? 1 + 0.06 * Math.sin(Math.PI * since / 160) : 1;
      ctx.globalCompositeOperation = 'source-over';
      var spec = COIN_SPECS[co.id] || COIN_SPECS[COIN_DEFAULT], trail = null;
      // A trailing coin (Neon Nickel): where it was 20, 40 and 60 ms ago, in
      // the air only.
      if (spec.trail && !p.still && t < co.land && co.land > co.t0) {
        trail = [];
        for (var tk = 1; tk <= 3; tk++) { var tt = t - tk * 20; if (tt > co.t0) { var fk = coinFlight((tt - co.t0) / (co.land - co.t0), co.halfTurns); trail.push([fk.angle, fk.scale]); } }
      }
      coinDraw(ctx, { spec: spec, x: co.x, y: co.y, r: co.r, angle: fl.angle, scale: fl.scale * settle, img: cur.coinImg, faceRgb: cur.coinRgb, a: a, t: t, trail: trail });
      // The landing's ring: a chrome circle widening from the coin and fading.
      if (since >= 0 && since < 300 && !p.still) {
        var u = since / 300;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = css(BOOT_CHROME, 0.5 * (1 - u) * a); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(co.x, co.y, co.r * (1.05 + 0.6 * ease(u)), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      if (rs && t >= rs.t0 && t < rs.gone + 140) {
        var k = rs.ms > 0 ? Math.min(rs.txt.length, Math.ceil(rs.txt.length * (t - rs.t0) / rs.ms)) : rs.txt.length;
        var w = BOOT_CH * rs.fs * (rs.txt.length + 1), ra = fade * (t < rs.gone ? 1 : 1 - (t - rs.gone) / 140);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(3,5,10,' + (0.85 * ra).toFixed(3) + ')';
        ctx.fillRect(rs.x - w / 2 - 6, rs.y - rs.fs * 0.75, w + 12, rs.fs * 1.5);
        ctx.globalCompositeOperation = 'lighter';
        drawType(ctx, rs.txt, rs.txt.slice(0, k), rs.x - w / 2, rs.y, rs.fs, w, BOOT_CHROME, ra, k < rs.txt.length);
      }
    }
    // The edge pulse into the first player's half: a band of their colour
    // from the centre edge of their screen to its far edge. In the still,
    // that edge is lit and holds.
    function drawPulse(ctx, p, t, fade) {
      var pu = p.pulse;
      if (!pu) return;
      var h = p.halves[pu.side === 'top' ? 0 : 1], c = h.rgb;
      ctx.globalCompositeOperation = 'lighter';
      if (pu.ms === 0) {
        if (t >= (pu.gone == null ? Infinity : pu.gone)) return;
        ctx.fillStyle = css(c, 0.5 * fade); ctx.fillRect(pu.l, pu.from - (pu.dir > 0 ? 0 : 3), pu.r - pu.l, 3);
        return;
      }
      var u = (t - pu.t) / pu.ms;
      if (u < 0 || u >= 1) return;
      var y = pu.from + (pu.to - pu.from) * ease(u), a = (1 - u) * fade, bandH = Math.max(6, Math.abs(pu.to - pu.from) * 0.12);
      var g = ctx.createLinearGradient(0, y - pu.dir * bandH, 0, y);
      g.addColorStop(0, css(c, 0)); g.addColorStop(1, css(c, 0.55 * a));
      ctx.fillStyle = g;
      ctx.fillRect(pu.l, Math.min(y, y - pu.dir * bandH), pu.r - pu.l, bandH);
      ctx.fillStyle = css(mix(c, [255, 255, 255], 0.5), 0.9 * a); ctx.fillRect(pu.l, y - 1, pu.r - pu.l, 2);
      // The half's own edge flares as the pulse leaves it.
      ctx.fillStyle = css(c, 0.6 * (1 - u) * fade); ctx.fillRect(pu.l, pu.from - (pu.dir > 0 ? 0 : 3), pu.r - pu.l, 3);
    }
    function draw() {
      if (!cur) return;
      var p = cur.plan, t = cur.t, ctx = cur.ctx, fade = outFade(t), dpr = cur.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cur.cv.width, cur.cv.height);
      ctx.setTransform(dpr, 0, 0, dpr, -cur.ox * dpr, -cur.oy * dpr);
      // The board goes dark first, then each half's tube lights in it.
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(3,5,10,' + (0.96 * fade).toFixed(3) + ')';
      ctx.fillRect(p.area.l, p.area.t, p.area.r - p.area.l, p.area.b - p.area.t);
      ctx.globalCompositeOperation = 'lighter';
      p.halves.forEach(function (h) { drawScreen(ctx, h, t, fade); });
      p.halves.forEach(function (h) { drawLine(ctx, h, t, fade); });
      drawHandshake(ctx, p.handshake, t, fade);
      drawPulse(ctx, p, t, fade);
      drawCoinFlip(ctx, p, t, fade);
      drawFlash(ctx, p, t);
      drawSaying(ctx, p, t);
      ctx.globalCompositeOperation = 'source-over';
      stats.drawn = (stats.drawn || 0) + 1;
    }
    // The sounds run on the audio clock, not the frames (render session 38):
    // SND.sequence queues each one a little ahead at its exact time, so a
    // dropped or late frame can't make a key click late or merge two into
    // one; one too late to queue (the context still waking up) is dropped,
    // never played late. They all go through one group, so a skip cuts
    // them all at once, ringing or queued. (Session 39 moved the scheduler
    // into SND, shared with the victory boasts.)
    function schedule() { if (cur && cur.seq) cur.seq.tick(); }
    // The other marks run on the frames (sounds are the sequence's).
    function fire(m) {
      if (m.k === 'sound') return;
      stats.fired[m.k] = (stats.fired[m.k] || 0) + 1;
      if (m.k === 'music' && typeof MUS !== 'undefined' && MUS.startAfter) { MUS.startAfter(m.ms / 1000); cur.music = true; }
      else if (m.k === 'end') finish('end');
    }
    function frame() {
      if (!cur) return;
      var me = cur;
      cur.t = performance.now() - cur.t0;
      schedule();
      while (cur && cur.next < cur.plan.marks.length && cur.plan.marks[cur.next].t <= cur.t) fire(cur.plan.marks[cur.next++]);
      if (cur !== me) return;
      draw();
      cur.raf = requestAnimationFrame(frame);
    }
    function onKey(e) { if (e.key === 'Escape' && cur) { e.preventDefault(); e.stopPropagation(); skip(); } }
    // A tap anywhere skips it, except on the playback controls: there the
    // control does its own job (pause stops the intro; a step jumps past it).
    // The same for the "Watch as" switch (render session 52): it waits for
    // the intro to end, then flips the board.
    function onDown(e) { if (cur && !(e.target && e.target.closest && e.target.closest('.controls, .pov'))) skip(); }
    function teardown(c) {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
      cancelAnimationFrame(c.raf);
      if (c.seq) c.seq.stop();
      c.cv.remove();
      c.dom.forEach(function (d) { d.remove(); });
    }
    function finish(reason) {
      if (!cur) return;
      var c = cur;
      cur = null;
      teardown(c);
      // A skip or a cancel cuts the intro's sounds (a 30 ms fade) and starts
      // the music now; at its own end the last sounds ring out and the
      // music is already coming in.
      if (reason !== 'end') {
        if (c.seq) c.seq.cut();
        if (c.music && typeof MUS !== 'undefined' && MUS.startAfter) MUS.startAfter(0);
      }
      stats.last = { reason: reason, t: Math.round(c.t), saying: c.plan.saying, still: !!c.plan.still };
      if (reason === 'skip') stats.skipped++;
      else if (reason === 'cancel') stats.cancelled++;
      else stats.ended++;
      if (c.onEnd && reason !== 'cancel') c.onEnd(reason);
    }
    function skip() { if (cur) { skipHintSeen(); finish('skip'); } }
    function cancel() { if (cur) finish('cancel'); }
    // play(els, opts) -> the plan played, or null when the page can't lay
    // one out.
    //   els: { top, bot, area } (elements: seat 2's side, seat 1's side,
    //     the board area holding both).
    //   opts: { who: { top: { name, faction }, bot: { ... } }, seed,
    //     onEnd(reason: 'end' | 'skip'), reduced, saying (the sheet only),
    //     coin: { id, first, portraitUp, line, img (the bottom player's
    //     portrait, an Image), faction (its ring's colour) } }.
    // A cancel (a jump, a pause) ends it without onEnd.
    function play(els, opts) {
      opts = opts || {};
      cancel();
      var reduced = opts.reduced != null ? !!opts.reduced : REDUCED;
      // On a phone the board may be partly scrolled away: centre it first.
      if (els.area && els.area.scrollIntoView) {
        var vr = els.area.getBoundingClientRect(), vh = window.innerHeight || 0;
        if (vr.top < 0 || vr.bottom > vh) els.area.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
      var geom = { top: rect(els.top), bot: rect(els.bot), area: rect(els.area) };
      if (!geom.top || !geom.bot || !geom.area || geom.top.b > geom.bot.t || geom.top.r - geom.top.l < 40) return null;
      var plan = bootPlan(geom, opts.who, opts.seed, { saying: opts.saying, coin: opts.coin });
      var problem = bootPlanProblem(plan, geom);
      if (problem || reduced) plan = bootStill(plan);
      var still = bootPlanProblem(plan, geom);
      if (still) { stats.problem = problem || still; return null; }
      plan.halves.forEach(function (h) { h.rgb = fxRgbOf(h.faction); });
      var cv = document.createElement('canvas');
      cv.className = 'boot-canvas'; cv.setAttribute('aria-hidden', 'true');
      var dpr = Math.min(2, window.devicePixelRatio || 1), A = plan.area;
      cv.style.left = A.l + 'px'; cv.style.top = A.t + 'px';
      cv.style.width = (A.r - A.l) + 'px'; cv.style.height = (A.b - A.t) + 'px';
      cv.width = Math.round((A.r - A.l) * dpr); cv.height = Math.round((A.b - A.t) * dpr);
      document.body.appendChild(cv);
      stats.played++; if (plan.still) stats.still++;
      stats.problem = problem || null; stats.fired = {}; stats.drawn = 0;
      cur = { plan: plan, cv: cv, ctx: cv.getContext('2d'), dpr: dpr, ox: A.l, oy: A.t, t0: performance.now(), t: 0, next: 0, raf: 0, dom: [], onEnd: opts.onEnd || null,
        seq: null, music: false, coinImg: (opts.coin && opts.coin.img) || null, coinRgb: fxRgbOf((opts.coin && opts.coin.faction) || (opts.who && opts.who.bot && opts.who.bot.faction) || 'Neutral') };
      var sk = document.createElement('button');
      sk.type = 'button'; sk.className = 'boast-skip boot-skip'; sk.textContent = 'Skip ▸▸';
      sk.addEventListener('click', function (e) { e.stopPropagation(); skip(); });
      sk.style.top = (A.t + 6) + 'px';
      document.body.appendChild(sk); cur.dom.push(sk);
      sk.style.left = (A.r - sk.offsetWidth - 8) + 'px';
      // Under it, the "tap to skip" hint (skipHint.ts, shared with the
      // boast): inside the board, clear of the agent lines and the saying.
      var avoid = plan.halves.map(function (h) { var L = h.line, k = L.rows ? 2.2 : 1.4; return { l: L.x0, t: L.y - L.fs * k, r: L.x0 + L.w, b: L.y + L.fs * k }; });
      if (plan.say) avoid.push({ l: plan.say.x - plan.say.w / 2 - 4, t: plan.say.y - plan.say.h / 2 - 4, r: plan.say.x + plan.say.w / 2 + 4, b: plan.say.y + plan.say.h / 2 + 4 });
      var hint = skipHintShow(sk, A, avoid, 'board');
      if (hint) cur.dom.push(hint);
      cur.hint = hint ? hint.textContent : null;
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('pointerdown', onDown, true);
      // The music mark (at 0) and the first sounds go out at once.
      while (cur.next < plan.marks.length && plan.marks[cur.next].t <= 0 && plan.marks[cur.next].k !== 'end') fire(plan.marks[cur.next++]);
      var sounds = plan.marks.filter(function (m) { return m.k === 'sound'; });
      stats.planned = sounds.length; stats.seq = null;
      if (typeof SND !== 'undefined' && SND.sequence) {
        stats.seq = cur.seq = SND.sequence(sounds, { t0: cur.t0, pan: 0, onQueue: function (m) { stats.fired['sound:' + m.kind] = (stats.fired['sound:' + m.kind] || 0) + 1; } });
      }
      draw();
      cur.raf = requestAnimationFrame(frame);
      return plan;
    }
    return { play: play, skip: skip, cancel: cancel, active: function () { return !!cur; }, plan: function () { return cur ? cur.plan : null; },
      stats: function () { var q = stats.seq ? stats.seq.stats() : null; return { active: !!cur, t: cur ? Math.round(cur.t) : null, saying: cur ? cur.plan.saying : null, still: cur ? !!cur.plan.still : null,
        lines: cur ? cur.plan.halves.map(function (h) { return h.line.txt.replace(/\s+$/, ''); }) : null, played: stats.played, skipped: stats.skipped, stillCount: stats.still, hint: cur ? cur.hint : null, hintSeen: SKIP_HINT_STATE.seen,
        cancelled: stats.cancelled, ended: stats.ended, problem: stats.problem || null, fired: stats.fired || {}, drawn: stats.drawn || 0, last: stats.last,
        coin: cur && cur.plan.coin ? { id: cur.plan.coin.id, fallback: cur.plan.coin.fallback, portraitUp: cur.plan.coin.portraitUp, line: cur.plan.result.txt, first: cur.plan.first, face: coinFaceAt(coinFlight(cur.plan.coin.land > cur.plan.coin.t0 ? (cur.t - cur.plan.coin.t0) / (cur.plan.coin.land - cur.plan.coin.t0) : 1, cur.plan.coin.halfTurns).angle) } : null,
        sched: q ? q.sched : [], late: q ? q.late : 0, planned: stats.planned == null ? null : stats.planned, audioBase: q && q.base != null ? q.base : null, rows: cur ? !!cur.plan.halves[0].line.rows : null, fs: cur ? cur.plan.halves[0].line.fs : null }; } };
  })();
`;

// The intro's canvas sits over the board and the cards (above the FX top
// canvas, under the boast's plate and Skip).
export const MATCH_BOOT_CSS = `
.boot-canvas { position: absolute; z-index: 92; pointer-events: none; }
/* Its Skip is a .boast-skip: finger-sized on a touch screen by BOAST_CSS. */
`;

export interface BootRect { l: number; t: number; r: number; b: number }
export interface BootGeom { top: BootRect; bot: BootRect; area: BootRect }
export interface BootWho { top?: { name?: string; faction?: string }; bot?: { name?: string; faction?: string } }
export interface BootLine { txt: string; len: number; x0: number; w: number; y: number; fs: number; t0: number; ms: number; clear: { t: number; ms: number; dy: number } | null; rows?: [string, string] }
export interface BootHalf { side: "top" | "bot"; faction: string; screen: BootRect; on: { t: number; ms: number; flick: number }; line: BootLine }
export interface BootPlan {
  ms: number; out: number; list: number; saying: string; mid: number; cx: number; area: BootRect; still?: boolean;
  halves: BootHalf[];
  handshake: { txt: string; x: number; y: number; fs: number; t0: number; ms: number; gone: number } | null;
  say: { text: string; rare: boolean; bits: { cols: number; rows: number; chars: number; dots: [number, number, number][] }; cell: number; x: number; y: number; w: number; h: number; t: number; slam: number; out: [number, number]; grow: number };
  marks: { k: "sound" | "music" | "end"; t: number; kind?: string; tier?: string; x?: number; ms?: number }[];
  first: "top" | "bot";
  coin: { id: string; fallback: boolean; x: number; y: number; r: number; t0: number; land: number; gone: number; halfTurns: number; portraitUp: boolean; reach: number; whir: string };
  result: { txt: string; x: number; y: number; fs: number; t0: number; ms: number; gone: number };
  pulse: { side: "top" | "bot"; t: number; ms: number; l: number; r: number; from: number; to: number; dir: number; gone?: number };
}
export interface BootCoin { id?: string; first?: "top" | "bot"; portraitUp?: boolean; line?: string }

const impl = new Function(`${BOAST_PURE_SOURCE}${COIN_PURE_SOURCE}${MATCH_BOOT_PURE_SOURCE}; return { BOOT_STILL_SAY_AT: BOOT_STILL_SAY_AT, BOOT_MS: BOOT_MS, BOOT_STILL_MS: BOOT_STILL_MS, BOOT_OUT_AT: BOOT_OUT_AT, BOOT_LIST_VERSION: BOOT_LIST_VERSION, BOOT_SAYINGS: BOOT_SAYINGS, BOOT_RARE: BOOT_RARE, BOOT_CH: BOOT_CH, BOOT_FS_MAX: BOOT_FS_MAX, BOOT_FS2_MAX: BOOT_FS2_MAX, BOOT_LH: BOOT_LH, BOOT_HEAD: BOOT_HEAD, bootHash: bootHash, bootSaying: bootSaying, bootLine: bootLine, bootPlan: bootPlan, bootStill: bootStill, bootPlanProblem: bootPlanProblem };`)() as {
  BOOT_STILL_SAY_AT: number;
  BOOT_MS: number;
  BOOT_STILL_MS: number;
  BOOT_OUT_AT: number;
  BOOT_LIST_VERSION: number;
  BOOT_SAYINGS: string[];
  BOOT_RARE: string;
  BOOT_CH: number;
  BOOT_FS_MAX: number;
  BOOT_FS2_MAX: number;
  BOOT_LH: number;
  BOOT_HEAD: string;
  bootHash: (seed: number) => number;
  bootSaying: (seed: number) => string;
  bootLine: (name: string, faction: string) => string;
  bootPlan: (geom: BootGeom, who: BootWho, seed: number, opts?: { saying?: string; coin?: BootCoin }) => BootPlan;
  bootStill: (plan: BootPlan) => BootPlan;
  bootPlanProblem: (plan: BootPlan, geom: BootGeom) => string | null;
};

export const BOOT_STILL_SAY_AT = impl.BOOT_STILL_SAY_AT;
export const BOOT_MS = impl.BOOT_MS;
export const BOOT_STILL_MS = impl.BOOT_STILL_MS;
export const BOOT_OUT_AT = impl.BOOT_OUT_AT;
export const BOOT_LIST_VERSION = impl.BOOT_LIST_VERSION;
export const BOOT_SAYINGS = impl.BOOT_SAYINGS;
export const BOOT_RARE = impl.BOOT_RARE;
export const BOOT_CH = impl.BOOT_CH;
export const BOOT_FS_MAX = impl.BOOT_FS_MAX;
export const BOOT_FS2_MAX = impl.BOOT_FS2_MAX;
export const BOOT_LH = impl.BOOT_LH;
export const BOOT_HEAD = impl.BOOT_HEAD;
export const bootHash = impl.bootHash;
export const bootSaying = impl.bootSaying;
export const bootLine = impl.bootLine;
export const bootPlan = impl.bootPlan;
export const bootStill = impl.bootStill;
export const bootPlanProblem = impl.bootPlanProblem;
