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
// The beats (about 2.6 s):
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
// The page embeds MATCH_BOOT_PURE_SOURCE verbatim after BOAST_PURE_SOURCE
// (it reuses the dot font) and Node evaluates the same text for the tests.

import { BOAST_PURE_SOURCE } from "./boastFx.js";

export const MATCH_BOOT_PURE_SOURCE = String.raw`
  // The intro's length, the reduced-motion still's, and when the outro starts.
  var BOOT_MS = 2600, BOOT_STILL_MS = 1000, BOOT_OUT_AT = 2200;
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
  function bootLine(name, faction) {
    return 'LOADING AGENT: ' + String(name || 'AGENT') + ' [' + String(faction || 'Neutral').toUpperCase() + ']';
  }
  // A monospace character's width, as a share of the type size (the BIOS
  // type Boot Sequence uses; the runtime squeezes a wider font to fit).
  var BOOT_CH = 0.62;

  // bootPlan(geom, who, seed, opts) -> the intro on this page's layout.
  //   geom: { top, bot, area } in document pixels ({ l, t, r, b }): the top
  //     and bottom halves of the board (seat 2's side and seat 1's) and the
  //     area the intro covers (both halves and the gap between them).
  //   who: { top: { name, faction }, bot: { name, faction } }.
  //   opts.saying: shows this saying instead of the seed's (the sheet only).
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
    var lines = { top: bootLine(who.top && who.top.name, who.top && who.top.faction), bot: bootLine(who.bot && who.bot.name, who.bot && who.bot.faction) };
    // The shorter line is padded so both type for the same time.
    var n = Math.max(lines.top.length, lines.bot.length);
    var fs = Math.max(7, Math.min(15, H * 0.12, (W - 24) / (BOOT_CH * (n + 1))));
    var lineW = BOOT_CH * fs * (n + 1), x0 = cx - lineW / 2;
    var dLine = dNear + H * 0.5;
    var typeAt = 560, typeMs = Math.min(720, n * 22);
    function half(side) {
      var s = side === 'top' ? -1 : 1, f = (who[side] && who[side].faction) || 'Neutral';
      var nearY = mid + s * (dNear + 4), farY = mid + s * (dFar - 4);
      var txt = lines[side];
      while (txt.length < n) txt += ' ';
      return {
        side: side, faction: f,
        screen: { l: l + 4, r: r - 4, t: Math.min(nearY, farY), b: Math.max(nearY, farY) },
        on: { t: 0, ms: 420, flick: 520 },
        line: { txt: txt, len: lines[side].length, x0: x0, w: lineW, y: mid + s * dLine, fs: fs, t0: typeAt, ms: typeMs,
          // The readouts clear as the saying lands: each lifts AWAY from the
          // centre line and fades.
          clear: { t: 1600, ms: 260, dy: s * fs * 1.2 } }
      };
    }
    var halves = [half('top'), half('bot')];
    var hsFs = Math.max(8, Math.min(fs * 1.1, 16));
    var handshake = { txt: 'HANDSHAKE OK', x: cx, y: mid, fs: hsFs, t0: 1340, ms: 140, gone: 1600 };
    // The saying: the dot font as large as fits across the board and about
    // two thirds of the way into each half; it breaks onto two lines when
    // that makes it bigger (a phone).
    var sayH = Math.max(14, Math.min(150, (dNear + H * 0.66) * 2));
    var fit = boastBitsFit(saying, W * 0.86, sayH, 12);
    var say = { text: saying, rare: saying === BOOT_RARE, bits: fit.bits, cell: fit.cell, x: cx, y: mid,
      w: fit.bits.cols * fit.cell, h: fit.bits.rows * fit.cell, t: 1600, slam: 140, out: [BOOT_OUT_AT, BOOT_MS], grow: 0.08 };
    var marks = [];
    // Every sound sits on the centre: its pan favours neither side.
    function snd(t, kind, tier) { marks.push({ k: 'sound', t: t, kind: kind, tier: tier || 'normal', x: cx }); }
    snd(0, 'crt');
    // One key click for each pair of characters, shared by both lines (they
    // type in step).
    for (var q = 0; q < n; q += 2) snd(typeAt + typeMs * q / n, 'type', 'subtle');
    snd(handshake.t0, 'handshake');
    for (var q2 = 0; q2 < 4; q2++) snd(handshake.t0 + q2 * 30, 'type', 'subtle');
    snd(say.t, 'bootHit', 'spectacle');
    // The music waits under the whole intro and comes up after it.
    marks.push({ k: 'duck', t: 0, ms: BOOT_MS + 200 });
    marks.push({ k: 'end', t: BOOT_MS });
    marks.sort(function (u, v) { return u.t - v.t; });
    return { ms: BOOT_MS, out: BOOT_OUT_AT, list: BOOT_LIST_VERSION, saying: saying, mid: mid, cx: cx, area: { l: area.l, t: area.t, r: area.r, b: area.b },
      halves: halves, handshake: handshake, say: say, marks: marks };
  }

  // The reduced-motion still: both halves lit, both agent lines whole, the
  // saying on the centre line and HANDSHAKE OK under it (when it fits above
  // the bottom line), held for BOOT_STILL_MS. No flash, no swell; the
  // tube's thump and the saying's hit still sound.
  function bootStill(plan) {
    var out = JSON.parse(JSON.stringify(plan));
    out.still = true; out.ms = BOOT_STILL_MS; out.out = BOOT_STILL_MS - 200;
    out.halves.forEach(function (h) { h.on = { t: 0, ms: 0, flick: 0 }; h.line.t0 = 0; h.line.ms = 0; h.line.clear = null; });
    var hs = out.handshake, bl = out.halves[1].line;
    hs.y = plan.mid + out.say.h / 2 + out.say.cell * 1.5 + hs.fs * 0.9; hs.t0 = 0; hs.ms = 0; hs.gone = Infinity;
    if (hs.y + hs.fs / 2 > bl.y - bl.fs * 0.7) out.handshake = null;
    out.say.t = 0; out.say.slam = 0; out.say.grow = 0; out.say.out = [out.out, out.ms];
    out.marks = out.marks.filter(function (m) { return m.k === 'duck' || (m.k === 'sound' && (m.kind === 'crt' || m.kind === 'bootHit')); })
      .map(function (m) { var c = {}; for (var k in m) c[k] = m[k]; c.t = 0; if (c.k === 'duck') c.ms = BOOT_STILL_MS + 200; return c; });
    out.marks.push({ k: 'end', t: BOOT_STILL_MS });
    return out;
  }

  // The intro grammar, checked on a laid-out plan. Returns the first
  // problem, or null.
  function bootPlanProblem(plan, geom) {
    var tol = 1.5, mid = plan.mid, cx = plan.cx;
    function inBox(a, o) { return a.l >= o.l - tol && a.r <= o.r + tol && a.t >= o.t - tol && a.b <= o.b + tol; }
    function near(a, b) { return Math.abs(a - b) <= tol; }
    if (!plan.still && !(plan.ms >= 2000 && plan.ms <= 3000)) return 'the intro runs 2-3 s';
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
      var lb = { l: ln.x0, r: ln.x0 + ln.w, t: ln.y - ln.fs * 0.6, b: ln.y + ln.fs * 0.6 };
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
    if (tl.txt.length !== bl.txt.length) return 'the agent lines are padded to different lengths';
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
    for (i = 0; i < plan.marks.length; i++) {
      var m = plan.marks[i];
      if (m.t > plan.ms + 1) return m.k + ' after the intro ends';
      if (m.k === 'sound' && !near(m.x, cx)) return 'a sound is panned off centre';
    }
    if (!plan.marks.some(function (m) { return m.k === 'end'; })) return 'no end';
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
      var typing = k < ln.txt.length, blink = cur.plan.still || Math.floor(t / 260) % 2 === 0;
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
      drawFlash(ctx, p, t);
      drawSaying(ctx, p, t);
      ctx.globalCompositeOperation = 'source-over';
      stats.drawn = (stats.drawn || 0) + 1;
    }
    function fire(m) {
      stats.fired[m.k + (m.kind ? ':' + m.kind : '')] = (stats.fired[m.k + (m.kind ? ':' + m.kind : '')] || 0) + 1;
      if (m.k === 'sound' && typeof SND !== 'undefined') SND.play(m.kind, 'Neutral', m.tier, { left: m.x - window.scrollX, width: 0 });
      else if (m.k === 'duck' && typeof MUS !== 'undefined' && MUS.duckHold) MUS.duckHold(m.ms / 1000);
      else if (m.k === 'end') finish('end');
    }
    function frame() {
      if (!cur) return;
      var me = cur;
      cur.t = performance.now() - cur.t0;
      while (cur && cur.next < cur.plan.marks.length && cur.plan.marks[cur.next].t <= cur.t) fire(cur.plan.marks[cur.next++]);
      if (cur !== me) return;
      draw();
      cur.raf = requestAnimationFrame(frame);
    }
    function onKey(e) { if (e.key === 'Escape' && cur) { e.preventDefault(); e.stopPropagation(); skip(); } }
    // A tap anywhere skips it, except on the playback controls: there the
    // control does its own job (pause stops the intro; a step jumps past it).
    function onDown(e) { if (cur && !(e.target && e.target.closest && e.target.closest('.controls'))) skip(); }
    function teardown(c) {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
      cancelAnimationFrame(c.raf);
      c.cv.remove();
      c.dom.forEach(function (d) { d.remove(); });
    }
    function finish(reason) {
      if (!cur) return;
      var c = cur;
      cur = null;
      teardown(c);
      stats.last = { reason: reason, t: Math.round(c.t), saying: c.plan.saying, still: !!c.plan.still };
      if (reason === 'skip') stats.skipped++;
      else if (reason === 'cancel') stats.cancelled++;
      else stats.ended++;
      if (c.onEnd && reason !== 'cancel') c.onEnd(reason);
    }
    function skip() { if (cur) finish('skip'); }
    function cancel() { if (cur) finish('cancel'); }
    // play(els, opts) -> the plan played, or null when the page can't lay
    // one out.
    //   els: { top, bot, area } (elements: seat 2's side, seat 1's side,
    //     the board area holding both).
    //   opts: { who: { top: { name, faction }, bot: { ... } }, seed,
    //     onEnd(reason: 'end' | 'skip'), reduced, saying (the sheet only) }.
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
      var plan = bootPlan(geom, opts.who, opts.seed, { saying: opts.saying });
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
      cur = { plan: plan, cv: cv, ctx: cv.getContext('2d'), dpr: dpr, ox: A.l, oy: A.t, t0: performance.now(), t: 0, next: 0, raf: 0, dom: [], onEnd: opts.onEnd || null };
      var sk = document.createElement('button');
      sk.type = 'button'; sk.className = 'boast-skip boot-skip'; sk.textContent = 'Skip ▸▸';
      sk.addEventListener('click', function (e) { e.stopPropagation(); skip(); });
      sk.style.top = (A.t + 6) + 'px';
      document.body.appendChild(sk); cur.dom.push(sk);
      sk.style.left = (A.r - sk.offsetWidth - 8) + 'px';
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('pointerdown', onDown, true);
      draw();
      cur.raf = requestAnimationFrame(frame);
      return plan;
    }
    return { play: play, skip: skip, cancel: cancel, active: function () { return !!cur; },
      stats: function () { return { active: !!cur, t: cur ? Math.round(cur.t) : null, saying: cur ? cur.plan.saying : null, still: cur ? !!cur.plan.still : null,
        lines: cur ? cur.plan.halves.map(function (h) { return h.line.txt.replace(/\s+$/, ''); }) : null, played: stats.played, skipped: stats.skipped, stillCount: stats.still,
        cancelled: stats.cancelled, ended: stats.ended, problem: stats.problem || null, fired: stats.fired || {}, drawn: stats.drawn || 0, last: stats.last }; } };
  })();
`;

// The intro's canvas sits over the board and the cards (above the FX top
// canvas, under the boast's plate and Skip).
export const MATCH_BOOT_CSS = `
.boot-canvas { position: absolute; z-index: 92; pointer-events: none; }
`;

export interface BootRect { l: number; t: number; r: number; b: number }
export interface BootGeom { top: BootRect; bot: BootRect; area: BootRect }
export interface BootWho { top?: { name?: string; faction?: string }; bot?: { name?: string; faction?: string } }
export interface BootLine { txt: string; len: number; x0: number; w: number; y: number; fs: number; t0: number; ms: number; clear: { t: number; ms: number; dy: number } | null }
export interface BootHalf { side: "top" | "bot"; faction: string; screen: BootRect; on: { t: number; ms: number; flick: number }; line: BootLine }
export interface BootPlan {
  ms: number; out: number; list: number; saying: string; mid: number; cx: number; area: BootRect; still?: boolean;
  halves: BootHalf[];
  handshake: { txt: string; x: number; y: number; fs: number; t0: number; ms: number; gone: number } | null;
  say: { text: string; rare: boolean; bits: { cols: number; rows: number; chars: number; dots: [number, number, number][] }; cell: number; x: number; y: number; w: number; h: number; t: number; slam: number; out: [number, number]; grow: number };
  marks: { k: "sound" | "duck" | "end"; t: number; kind?: string; tier?: string; x?: number; ms?: number }[];
}

const impl = new Function(`${BOAST_PURE_SOURCE}${MATCH_BOOT_PURE_SOURCE}; return { BOOT_MS: BOOT_MS, BOOT_STILL_MS: BOOT_STILL_MS, BOOT_OUT_AT: BOOT_OUT_AT, BOOT_LIST_VERSION: BOOT_LIST_VERSION, BOOT_SAYINGS: BOOT_SAYINGS, BOOT_RARE: BOOT_RARE, BOOT_CH: BOOT_CH, bootHash: bootHash, bootSaying: bootSaying, bootLine: bootLine, bootPlan: bootPlan, bootStill: bootStill, bootPlanProblem: bootPlanProblem };`)() as {
  BOOT_MS: number;
  BOOT_STILL_MS: number;
  BOOT_OUT_AT: number;
  BOOT_LIST_VERSION: number;
  BOOT_SAYINGS: string[];
  BOOT_RARE: string;
  BOOT_CH: number;
  bootHash: (seed: number) => number;
  bootSaying: (seed: number) => string;
  bootLine: (name: string, faction: string) => string;
  bootPlan: (geom: BootGeom, who: BootWho, seed: number, opts?: { saying?: string }) => BootPlan;
  bootStill: (plan: BootPlan) => BootPlan;
  bootPlanProblem: (plan: BootPlan, geom: BootGeom) => string | null;
};

export const BOOT_MS = impl.BOOT_MS;
export const BOOT_STILL_MS = impl.BOOT_STILL_MS;
export const BOOT_OUT_AT = impl.BOOT_OUT_AT;
export const BOOT_LIST_VERSION = impl.BOOT_LIST_VERSION;
export const BOOT_SAYINGS = impl.BOOT_SAYINGS;
export const BOOT_RARE = impl.BOOT_RARE;
export const BOOT_CH = impl.BOOT_CH;
export const bootHash = impl.bootHash;
export const bootSaying = impl.bootSaying;
export const bootLine = impl.bootLine;
export const bootPlan = impl.bootPlan;
export const bootStill = impl.bootStill;
export const bootPlanProblem = impl.bootPlanProblem;
