// The coin flip (render session 53, the first coin slice of the owner's
// approved plan, 2026-11-02): who goes first, shown inside Match Boot.
//
// Who goes first is the server's coin flip for every match (the seats: p1
// always moves first). The coin is only how that flip looks; it never
// changes who goes first. Each viewer sees ONE coin, the near player's (the
// near side is the viewer's own agent on their own match, else the player
// they watch as, render session 52): its two faces are that player's
// portrait (the generated avatar the arena already draws) and the coin's own
// design. Landing portrait up means the near player goes first.
//
// The result line (owner-approved): on the viewer's own match, YOU GO FIRST
// or THEY GO FIRST; for a spectator who owns neither agent, <NAME> GOES
// FIRST (the first player's name).
//
// The beats inside Match Boot (matchBootFx.ts lays them out; the intro goes
// from 2.6 s to 3.4 s):
//   1.5 s    HANDSHAKE OK goes; the coin flicks up from the centre: it rises
//            toward the viewer (it grows; it never moves up or down, so it
//            stays on the centre line and favours neither half), spinning
//            end over end;
//   2.1 s    it lands, face up, with a clink; a short edge pulse runs from
//            the centre line into the first player's half (the one exception
//            to the intro's "favours neither side" grammar, EFFECTS.md);
//   2.2 s    the result line types under the coin;
//   2.4 s    the saying slams in across the centre line; the coin and the
//            line go; the agent lines lift away;
//   3.0-3.4 s the saying swells and fades; the board.
// Reduced motion: the coin already landed with its line, still, then the
// saying, still (about 1.3 s in all).
//
// Coin looks are code-drawn placeholders until the art pass. Session 53
// drew the free starter, the Chrome Token (a silver hex). Session 55 (the
// second coin slice) drew the rest of Season 0's coins as approved on
// 2026-11-02: the store coins Dial-Up Dime (a green CRT-phosphor rim) and
// Neon Nickel (a magenta and cyan neon edge, trailing light), and the tier
// coins Platinum (the approved Gold look as a brushed platinum finish),
// Diamond (prismatic facets) and Mythic (the Mythic ward's moving sheen).
// A coin id this render doesn't know (a later season's, before it is
// drawn) still flips the Chrome Token (`coinSpecOf` says so with
// `fallback`); the catalogue never sells a coin before it is drawn.
//
// The page embeds COIN_PURE_SOURCE before MATCH_BOOT_PURE_SOURCE and
// COIN_RUNTIME_SOURCE before MATCH_BOOT_RUNTIME_SOURCE; Node evaluates the
// same pure text for the tests.

export const COIN_PURE_SOURCE = String.raw`
  // The beats, in ms from the start of Match Boot.
  var COIN_FLICK_AT = 1500, COIN_LAND_AT = 2100, COIN_LINE_AT = 2200, COIN_GONE_AT = 2400;
  // The edge pulse into the first player's half, from the landing.
  var COIN_PULSE_AT = 2120, COIN_PULSE_MS = 420;
  // How far the coin rises toward the viewer at the top of the flick (its
  // size there, as a share of its landed size).
  var COIN_PEAK = 1.3;
  // How far a neon or phosphor rim's halo reaches past the rim (coinDraw:
  // the outer tube at the rim, its halo half of 0.16 of the size wider).
  var COIN_NEON_REACH = 1.1;
  // The house coin: every owner's starter, an empty slot's, every match
  // recorded before coins (OWNER_API.md "Coin skins").
  var COIN_DEFAULT = 'coin-chrome-token';
  // The looks, by the economy's item id (economy/src/cosmetics.ts). Colours
  // are RGB. sides: the outline's corners (6: a hex token).
  var COIN_SPECS = {
    'coin-chrome-token': {
      name: 'Chrome Token',
      // sides: the outline's corners (6: a hex token; 0: round).
      sides: 6,
      // The face's design (coinDraw draws each): engraved traces.
      face: 'traces',
      // The metal, light to dark: a polished silver with cool steel shadows.
      metal: [[252, 253, 255], [214, 221, 232], [150, 160, 178], [84, 92, 110]],
      rim: [236, 241, 250],
      engrave: [92, 102, 124],
      glow: [205, 222, 255]
    },
    // The two Season 0 store coins (render session 55, the second coin
    // slice; looks as approved 2026-11-02).
    'coin-s0-dial-up-dime': {
      name: 'Dial-Up Dime',
      // A dark round coin; a green CRT-phosphor rim that glows; on its face
      // a little screen with scanlines and the handshake's waveform.
      sides: 0,
      face: 'phosphor',
      metal: [[96, 108, 104], [52, 60, 58], [30, 36, 35], [12, 16, 15]],
      rim: [120, 255, 150],
      engrave: [70, 230, 120],
      glow: [90, 255, 140],
      // A ring of light just outside the rim, in these colours (lighter).
      neon: [[90, 255, 140]],
      // Its spin: a modem's warble under the ticks (soundFx.ts).
      whir: 'coinWhirModem'
    },
    'coin-s0-neon-nickel': {
      name: 'Neon Nickel',
      // A chrome octagon edged in two neon tubes, magenta outside and cyan
      // inside, a neon bolt on its face; it trails light through the flip.
      sides: 8,
      face: 'neon',
      metal: [[238, 240, 248], [190, 196, 214], [120, 126, 150], [52, 54, 72]],
      rim: [255, 92, 214],
      engrave: [80, 236, 255],
      glow: [255, 140, 230],
      neon: [[255, 70, 210], [70, 230, 255]],
      trail: true,
      whir: 'coinWhirNeon'
    },
    // The Season 0 tier coins, granted at season end (render session 55).
    // Each carries its season's mark ("S0") on its face, so a later
    // season's coin of the same tier can keep the look with its own mark.
    'coin-s0-platinum': {
      name: 'Platinum Coin',
      // Brushed platinum: a round coin with a milled edge, fine circular
      // brushing, a four-point star and the season mark.
      sides: 0,
      face: 'platinum',
      metal: [[250, 250, 246], [222, 224, 222], [168, 172, 176], [98, 102, 110]],
      rim: [246, 247, 244],
      engrave: [118, 122, 130],
      glow: [240, 244, 255],
      mark: 'S0',
      milled: true
    },
    'coin-s0-diamond': {
      name: 'Diamond Coin',
      // Prismatic facets: an octagonal cut, its face a brilliant's facets,
      // each catching a different colour of the light as it turns.
      sides: 8,
      face: 'prism',
      metal: [[246, 252, 255], [196, 226, 246], [128, 168, 206], [52, 74, 112]],
      rim: [232, 248, 255],
      engrave: [120, 170, 220],
      glow: [190, 230, 255],
      mark: 'S0',
      whir: 'coinWhirShimmer'
    },
    'coin-s0-mythic': {
      name: 'Mythic Coin',
      // The Mythic ward's moving sheen: a dark violet coin, a gold rim, a
      // ring of ward ticks, and a bright band that sweeps across it over
      // time, landed or spinning.
      sides: 0,
      face: 'mythic',
      metal: [[118, 84, 188], [72, 44, 136], [40, 22, 86], [16, 8, 38]],
      rim: [255, 214, 120],
      engrave: [255, 200, 110],
      glow: [255, 220, 150],
      neon: [[255, 196, 96]],
      // Its rim's light, softer than a store coin's neon: a gold glow.
      neonGain: 0.45,
      mark: 'S0',
      sheen: true,
      whir: 'coinWhirShimmer'
    }
  };
  // The spin's sound for a coin (Match Boot): its own, else the plain whir.
  function coinWhirOf(itemId) { var s = coinSpecOf(itemId).spec; return s.whir || 'coinWhir'; }
  // The look a coin id flips: its own, or the Chrome Token's (fallback) for
  // one this render doesn't draw yet.
  function coinSpecOf(itemId) {
    var id = String(itemId || '');
    if (Object.prototype.hasOwnProperty.call(COIN_SPECS, id)) return { id: id, spec: COIN_SPECS[id], fallback: false };
    return { id: COIN_DEFAULT, spec: COIN_SPECS[COIN_DEFAULT], fallback: id !== '' && id !== COIN_DEFAULT };
  }
  // The result line. view: { near, own, first, names: { p1, p2 } }: own is
  // true on the viewer's own agent's match (near is their agent).
  function coinResult(view) {
    view = view || {};
    var first = view.first === 'p2' ? 'p2' : 'p1';
    if (view.own) return view.near === first ? 'YOU GO FIRST' : 'THEY GO FIRST';
    var names = view.names || {};
    return String(names[first] || 'AGENT').toUpperCase() + ' GOES FIRST';
  }
  // The flip: the coin starts design up and turns end over end. An even
  // number of half turns lands it design up, an odd number portrait up.
  function coinHalfTurns(portraitUp) { return portraitUp ? 9 : 8; }
  // u in [0, 1] over the flight (flick to landing) -> { angle, scale }. The
  // spin eases out (fast off the thumb, settling); the rise is a smooth hump
  // (1 at both ends, COIN_PEAK at the top).
  function coinFlight(u, halfTurns) {
    u = Math.max(0, Math.min(1, u));
    var spin = 1 - Math.pow(1 - u, 2.2);
    return { angle: Math.PI * halfTurns * spin, scale: 1 + (COIN_PEAK - 1) * Math.sin(Math.PI * u) };
  }
  // Which face shows at an angle: the design while the coin's front faces
  // the viewer (cos >= 0), the portrait while its back does.
  function coinFaceAt(angle) { return Math.cos(angle) >= -1e-9 ? 'design' : 'portrait'; }
`;

export const COIN_RUNTIME_SOURCE = String.raw`
  // Draws one coin. c: { spec, x, y, r, angle, scale, img (the portrait, an
  // Image or null), faceRgb (the portrait's faction colour), a (alpha), t
  // (ms on the page's clock, for a coin whose look moves: the Mythic
  // sheen), trail (earlier [angle, scale] samples of this flip, newest
  // first, for a coin that trails light) }.
  // The coin turns about its horizontal axis: its height is |cos(angle)|,
  // and its edge shows as a band when it is nearly edge on.
  function coinDraw(ctx, c) {
    var s = c.spec, R = c.r * c.scale, k = Math.cos(c.angle), h = Math.abs(k), a = c.a == null ? 1 : c.a, t = c.t || 0;
    if (a <= 0.003) return;
    function rgba(col, al) { return 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',' + Math.max(0, Math.min(1, al)).toFixed(3) + ')'; }
    function mixc(p, q, u) { return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u]; }
    // The outline: a polygon with a corner at the top, or a circle.
    function outline(rad, sy, x, y) {
      x = x == null ? c.x : x; y = y == null ? c.y : y;
      ctx.beginPath();
      if (!s.sides) { ctx.ellipse(x, y, rad, Math.max(0.01, rad * sy), 0, 0, Math.PI * 2); return; }
      for (var i = 0; i < s.sides; i++) {
        var th = -Math.PI / 2 + i * 2 * Math.PI / s.sides;
        var px = x + Math.cos(th) * rad, py = y + Math.sin(th) * rad * sy;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    // Half the outline's width on its middle line (where the edge band
    // shows): 1 for a circle, the widest corner for a polygon.
    var halfW = 1;
    if (s.sides) { halfW = 0; for (var hi = 0; hi < s.sides; hi++) halfW = Math.max(halfW, Math.abs(Math.cos(-Math.PI / 2 + hi * 2 * Math.PI / s.sides))); }
    var sy = Math.max(0.02, h);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = 'source-over';
    // Its shadow on the board, wider and softer the higher it rises.
    var lift = Math.max(0, c.scale - 1) / 0.3;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.35 * (1 - 0.5 * lift)).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(c.x, c.y + c.r * (0.9 + 0.5 * lift), c.r * (0.9 + 0.3 * lift), c.r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    // A trailing coin's afterimages: its neon outline where it was a moment
    // ago, fading (drawn under the coin).
    if (s.trail && c.trail && s.neon) {
      ctx.globalCompositeOperation = 'lighter';
      for (var ti = 0; ti < c.trail.length; ti++) {
        var tr = c.trail[ti], tsy = Math.max(0.02, Math.abs(Math.cos(tr[0]))), tal = 0.34 * (1 - (ti + 1) / (c.trail.length + 1));
        ctx.lineWidth = Math.max(1, c.r * tr[1] * 0.07);
        ctx.strokeStyle = rgba(s.neon[ti % s.neon.length], tal); outline(c.r * tr[1] * 1.0, tsy); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // The edge: a dark band under the face, thickest edge on.
    var th = Math.max(1.5, R * 0.14) * Math.sqrt(1 - h * h);
    if (th > 0.5) {
      ctx.fillStyle = rgba(s.metal[3], 1);
      outline(R, sy); ctx.save(); ctx.translate(0, th); ctx.fill(); ctx.restore();
      ctx.fillRect(c.x - R * halfW, c.y, R * halfW * 2, th);
      // A milled edge shows its ridges on the band.
      if (s.milled && th > 1.5) {
        ctx.fillStyle = rgba(s.metal[1], 0.7);
        for (var mi = -12; mi <= 12; mi++) { var mx = c.x + R * halfW * Math.sin(mi / 12 * Math.PI / 2); ctx.fillRect(mx - 0.5, c.y, 1, th); }
      }
      // A neon rim lights its edge too.
      if (s.neon) { ctx.fillStyle = rgba(s.neon[0], 0.55); ctx.fillRect(c.x - R * halfW, c.y + th * 0.4, R * halfW * 2, Math.max(1, th * 0.25)); }
    }
    // The face's metal: light bands sweeping as it turns.
    var g = ctx.createLinearGradient(c.x - R, c.y - R * sy, c.x + R, c.y + R * sy);
    var sweep = (Math.sin(c.angle * 1.7) + 1) / 2;
    g.addColorStop(0, rgba(s.metal[2], 1));
    g.addColorStop(Math.max(0.01, Math.min(0.98, sweep * 0.8)), rgba(s.metal[0], 1));
    g.addColorStop(Math.min(0.99, sweep * 0.8 + 0.18), rgba(s.metal[1], 1));
    g.addColorStop(1, rgba(s.metal[3], 1));
    outline(R, sy); ctx.fillStyle = g; ctx.fill();
    // The rim: a bright bevel just inside the outline.
    ctx.lineWidth = Math.max(1, R * 0.07); ctx.strokeStyle = rgba(s.rim, 0.95); outline(R * 0.94, sy); ctx.stroke();
    ctx.lineWidth = Math.max(0.6, R * 0.025); ctx.strokeStyle = rgba(s.metal[3], 0.8); outline(R * 0.86, sy); ctx.stroke();
    // A milled rim: fine ridges all round, between the bevel and the edge.
    if (s.milled) {
      ctx.strokeStyle = rgba(s.engrave, 0.55); ctx.lineWidth = Math.max(0.5, R * 0.012);
      ctx.beginPath();
      for (var ri = 0; ri < 72; ri++) {
        var ra = ri * Math.PI * 2 / 72, ca = Math.cos(ra), sa = Math.sin(ra);
        ctx.moveTo(c.x + ca * R * 0.88, c.y + sa * R * 0.88 * sy); ctx.lineTo(c.x + ca * R * 0.985, c.y + sa * R * 0.985 * sy);
      }
      ctx.stroke();
    }
    var face = coinFaceAt(c.angle);
    if (face === 'design') coinFace(ctx, c, s, R, sy, t, outline, rgba, mixc);
    else {
      // The portrait face: the player's avatar inside the inner outline, in
      // a ring of their faction colour (the avatar is drawn the right way
      // up, squashed with the turn).
      var ir = R * 0.74;
      ctx.save();
      outline(ir, sy); ctx.clip();
      ctx.fillStyle = rgba([10, 14, 22], 1); ctx.fillRect(c.x - ir, c.y - ir, ir * 2, ir * 2);
      if (c.img && c.img.complete && c.img.naturalWidth) {
        ctx.drawImage(c.img, c.x - ir * 0.92, c.y - ir * 0.92 * sy, ir * 1.84, ir * 1.84 * sy);
      } else {
        // No portrait yet (still loading): a head and shoulders in the
        // faction colour, never an empty face.
        ctx.fillStyle = rgba(c.faceRgb || s.glow, 0.85);
        ctx.beginPath(); ctx.ellipse(c.x, c.y - ir * 0.18 * sy, ir * 0.3, ir * 0.3 * sy, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(c.x, c.y + ir * 0.62 * sy, ir * 0.55, ir * 0.42 * sy, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.lineWidth = Math.max(1, R * 0.06); ctx.strokeStyle = rgba(c.faceRgb || s.glow, 0.95); outline(ir, sy); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    // A neon or phosphor rim: tubes of light just outside the bevel, on
    // both faces, with a soft halo (the halo breathes a little).
    if (s.neon) {
      var breath = 0.85 + 0.15 * Math.sin(t / 260);
      for (var ni = 0; ni < s.neon.length; ni++) {
        var nr = R * (1.0 - ni * 0.1);
        var gain = s.neonGain == null ? 1 : s.neonGain;
        ctx.lineWidth = Math.max(2, R * 0.16); ctx.strokeStyle = rgba(s.neon[ni], 0.16 * breath * gain); outline(nr, sy); ctx.stroke();
        ctx.lineWidth = Math.max(1, R * 0.05); ctx.strokeStyle = rgba(mixc(s.neon[ni], [255, 255, 255], 0.35 * gain), 0.9 * gain); outline(nr, sy); ctx.stroke();
      }
    }
    // The Mythic sheen: a bright band sweeping across the face over time
    // (one pass every 2.4 s), clipped to the coin; brighter face on.
    if (s.sheen) {
      ctx.save(); outline(R * 0.94, sy); ctx.clip();
      var ph = ((t % 2400) / 2400) * 3 - 1.5, bx = c.x + ph * R * 1.6;
      var sg = ctx.createLinearGradient(bx - R * 0.5, c.y - R * sy, bx + R * 0.5, c.y + R * sy);
      sg.addColorStop(0, rgba(s.glow, 0)); sg.addColorStop(0.5, rgba([255, 246, 220], 0.55 * (0.35 + 0.65 * h))); sg.addColorStop(1, rgba(s.glow, 0));
      ctx.fillStyle = sg; ctx.fillRect(c.x - R, c.y - R, R * 2, R * 2);
      ctx.restore();
    }
    // A glint that runs across the face as it turns.
    var gl = ctx.createRadialGradient(c.x - R * 0.35, c.y - R * 0.4 * sy, 0, c.x - R * 0.35, c.y - R * 0.4 * sy, R * 0.9);
    gl.addColorStop(0, rgba(s.glow, 0.35 * (0.4 + 0.6 * h))); gl.addColorStop(1, rgba(s.glow, 0));
    outline(R, sy); ctx.fillStyle = gl; ctx.fill();
    ctx.restore();
  }
  // The coin's own face (its design side), by spec.face.
  function coinFace(ctx, c, s, R, sy, t, outline, rgba, mixc) {
    var x = c.x, y = c.y;
    function dot(dx, dy, r, col, al) { ctx.fillStyle = rgba(col, al); ctx.beginPath(); ctx.ellipse(x + dx * R, y + dy * R * sy, r * R, Math.max(0.01, r * R * sy), 0, 0, Math.PI * 2); ctx.fill(); }
    // The season mark, small, under the emblem (a tier coin's).
    function mark(col, dy) {
      if (!s.mark || R < 9) return;
      ctx.save();
      ctx.translate(x, y + (dy == null ? 0.56 : dy) * R * sy); ctx.scale(1, sy);
      ctx.fillStyle = rgba(col, 0.9); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.max(5, R * 0.2).toFixed(1) + 'px ui-monospace, Menlo, Consolas, monospace';
      ctx.fillText(s.mark, 0, 0);
      ctx.restore();
    }
    if (s.face === 'phosphor') {
      // A small CRT screen: dark glass, scanlines, the handshake's waveform
      // in phosphor green, and a cursor that blinks.
      var sw = R * 0.62, sh = R * 0.44;
      ctx.fillStyle = rgba([4, 12, 8], 1);
      ctx.beginPath(); ctx.rect(x - sw, y - sh * sy, sw * 2, sh * 2 * sy); ctx.fill();
      ctx.strokeStyle = rgba(s.engrave, 0.8); ctx.lineWidth = Math.max(0.8, R * 0.035); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(x - sw, y - sh * sy, sw * 2, sh * 2 * sy); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(s.glow, 0.08);
      for (var li = 0; li < 9; li++) ctx.fillRect(x - sw, y + (-sh + li * sh * 2 / 9) * sy, sw * 2, Math.max(0.5, sh * 0.08 * sy));
      ctx.strokeStyle = rgba(s.glow, 0.95); ctx.lineWidth = Math.max(0.8, R * 0.045);
      ctx.beginPath();
      for (var wi = 0; wi <= 32; wi++) {
        var u = wi / 32, wx = x - sw * 0.86 + u * sw * 1.72;
        // A carrier that turns to noise toward the right: the handshake.
        var wy = Math.sin(u * Math.PI * 6) * 0.45 * (1 - u) + Math.sin(u * 71 + 1.3) * Math.sin(u * 23) * 0.5 * u;
        if (wi === 0) ctx.moveTo(wx, y + wy * sh * 0.75 * sy - sh * 0.12 * sy); else ctx.lineTo(wx, y + wy * sh * 0.75 * sy - sh * 0.12 * sy);
      }
      ctx.stroke();
      if (Math.floor(t / 400) % 2 === 0) { ctx.fillStyle = rgba(s.glow, 0.95); ctx.fillRect(x + sw * 0.5, y + sh * 0.45 * sy, sw * 0.22, Math.max(0.8, sh * 0.22 * sy)); }
      ctx.restore();
      // Two status lamps under the screen.
      dot(-0.18, 0.62, 0.05, s.glow, 0.9); dot(0.0, 0.62, 0.05, s.engrave, 0.5); dot(0.18, 0.62, 0.05, s.glow, Math.floor(t / 300) % 2 ? 0.9 : 0.3);
    } else if (s.face === 'neon') {
      // A neon bolt: a cyan tube with a magenta halo, a node at each end.
      var pts = [[-0.14, -0.5], [0.16, -0.08], [-0.08, -0.02], [0.14, 0.5]];
      function path() { ctx.beginPath(); for (var pi = 0; pi < pts.length; pi++) { var px = x + pts[pi][0] * R, py = y + pts[pi][1] * R * sy; if (pi === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } }
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = rgba([40, 30, 60], 0.9); ctx.lineWidth = Math.max(2, R * 0.17); path(); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(s.neon[0], 0.5); ctx.lineWidth = Math.max(2, R * 0.2); path(); ctx.stroke();
      ctx.strokeStyle = rgba(s.neon[1], 0.95); ctx.lineWidth = Math.max(1, R * 0.07); path(); ctx.stroke();
      ctx.strokeStyle = rgba([235, 255, 255], 0.9); ctx.lineWidth = Math.max(0.5, R * 0.025); path(); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      dot(pts[0][0], pts[0][1], 0.06, s.neon[0], 1); dot(pts[3][0], pts[3][1], 0.06, s.neon[0], 1);
    } else if (s.face === 'platinum') {
      // Fine circular brushing, a four-point star, the season mark.
      ctx.lineWidth = Math.max(0.4, R * 0.008);
      for (var bi = 1; bi < 14; bi++) { ctx.strokeStyle = rgba(bi % 2 ? s.metal[0] : s.metal[2], 0.22); outline(R * 0.06 * bi, sy); ctx.stroke(); }
      var star = function (rad, inner) {
        ctx.beginPath();
        for (var si = 0; si < 8; si++) {
          var sa = -Math.PI / 2 + si * Math.PI / 4, rr = si % 2 ? inner : rad;
          var sx = x + Math.cos(sa) * rr * R, ssy = y - R * 0.06 * sy + Math.sin(sa) * rr * R * sy;
          if (si === 0) ctx.moveTo(sx, ssy); else ctx.lineTo(sx, ssy);
        }
        ctx.closePath();
      };
      star(0.42, 0.11); ctx.fillStyle = rgba(s.metal[0], 1); ctx.fill();
      ctx.strokeStyle = rgba(s.engrave, 0.9); ctx.lineWidth = Math.max(0.6, R * 0.03); ctx.stroke();
      star(0.2, 0.05); ctx.fillStyle = rgba(s.engrave, 0.55); ctx.fill();
      mark(s.engrave, 0.6);
    } else if (s.face === 'prism') {
      // A brilliant's facets: an octagonal table, eight kites and eight
      // triangles round it, each a colour of the spectrum that moves with
      // the turn (so the colours run as it spins and settle as it lands).
      var tab = 0.36, mid = 0.66, n = 8;
      function P(rad, i) { var an = -Math.PI / 2 + i * 2 * Math.PI / n; return [x + Math.cos(an) * rad * R, y + Math.sin(an) * rad * R * sy]; }
      function hue(hh, l, al) {
        hh = ((hh % 1) + 1) % 1;
        var r6 = [Math.abs(hh * 6 - 3) - 1, 2 - Math.abs(hh * 6 - 2), 2 - Math.abs(hh * 6 - 4)].map(function (v) { return Math.max(0, Math.min(1, v)); });
        return rgba(mixc([r6[0] * 255, r6[1] * 255, r6[2] * 255], [255, 255, 255], l), al);
      }
      var turn = c.angle / Math.PI * 0.35 + t / 9000;
      for (var fi = 0; fi < n; fi++) {
        var a0 = P(tab, fi), a1 = P(tab, fi + 1), b0 = P(mid, fi + 0.5), o0 = P(0.94, fi), o1 = P(0.94, fi + 1);
        // The star facet (table edge to the middle ring).
        ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(b0[0], b0[1]); ctx.lineTo(a1[0], a1[1]); ctx.closePath();
        ctx.fillStyle = hue(turn + fi / n, 0.3, 0.75); ctx.fill();
        // The girdle facets (the middle ring to the rim).
        ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(o0[0], o0[1]); ctx.lineTo(b0[0], b0[1]); ctx.closePath();
        ctx.fillStyle = hue(turn + fi / n + 0.4, 0.38, 0.62); ctx.fill();
        ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(o0[0], o0[1]); ctx.lineTo(o1[0], o1[1]); ctx.closePath();
        ctx.fillStyle = hue(turn + fi / n + 0.15, 0.45, 0.5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(o1[0], o1[1]); ctx.lineTo(a1[0], a1[1]); ctx.closePath();
        ctx.fillStyle = hue(turn + fi / n + 0.6, 0.38, 0.56); ctx.fill();
      }
      // The table: bright, a touch of the colour under it.
      ctx.beginPath(); for (var ti2 = 0; ti2 < n; ti2++) { var q = P(tab, ti2); if (ti2 === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); } ctx.closePath();
      ctx.fillStyle = rgba(s.metal[0], 0.9); ctx.fill();
      ctx.strokeStyle = rgba(s.engrave, 0.8); ctx.lineWidth = Math.max(0.5, R * 0.02); ctx.stroke();
      // The facet edges, fine and white.
      ctx.strokeStyle = rgba([255, 255, 255], 0.5); ctx.lineWidth = Math.max(0.4, R * 0.012);
      ctx.beginPath();
      for (var ei = 0; ei < n; ei++) { var e0 = P(tab, ei), e1 = P(mid, ei + 0.5), e2 = P(0.94, ei), e3 = P(0.94, ei + 1); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(P(tab, ei + 1)[0], P(tab, ei + 1)[1]); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e2[0], e2[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e3[0], e3[1]); }
      ctx.stroke();
      mark(s.metal[3], 0.0);
    } else if (s.face === 'mythic') {
      // A ring of ward ticks that turns slowly, a gold diamond seal with a
      // dark core, the season mark.
      var spin = t / 6000 * Math.PI * 2;
      ctx.strokeStyle = rgba(s.engrave, 0.75); ctx.lineWidth = Math.max(0.6, R * 0.03);
      outline(R * 0.72, sy); ctx.stroke();
      ctx.beginPath();
      for (var mi = 0; mi < 24; mi++) {
        var ma = spin + mi * Math.PI * 2 / 24, l0 = mi % 3 === 0 ? 0.58 : 0.64;
        ctx.moveTo(x + Math.cos(ma) * R * l0, y + Math.sin(ma) * R * l0 * sy); ctx.lineTo(x + Math.cos(ma) * R * 0.7, y + Math.sin(ma) * R * 0.7 * sy);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - R * 0.42 * sy); ctx.lineTo(x + R * 0.3, y - R * 0.04 * sy); ctx.lineTo(x, y + R * 0.34 * sy); ctx.lineTo(x - R * 0.3, y - R * 0.04 * sy); ctx.closePath();
      var mg = ctx.createLinearGradient(x - R * 0.3, y - R * 0.4 * sy, x + R * 0.3, y + R * 0.3 * sy);
      mg.addColorStop(0, rgba([255, 240, 190], 1)); mg.addColorStop(0.5, rgba(s.rim, 1)); mg.addColorStop(1, rgba([160, 100, 30], 1));
      ctx.fillStyle = mg; ctx.fill();
      dot(0, -0.04, 0.09, s.metal[3], 1); dot(0, -0.04, 0.04, s.metal[0], 0.9);
      mark(s.engrave, 0.5);
    } else {
      // The Chrome Token's own face: an engraved inner hex, three traces
      // from its centre to alternate corners, a node at each end.
      ctx.strokeStyle = rgba(s.engrave, 0.9); ctx.lineWidth = Math.max(0.8, R * 0.05);
      outline(R * 0.56, sy); ctx.stroke();
      ctx.beginPath();
      for (var j = 0; j < 3; j++) {
        var tj = -Math.PI / 2 + j * 2 * Math.PI / 3;
        ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(tj) * R * 0.56, y + Math.sin(tj) * R * 0.56 * sy);
      }
      ctx.stroke();
      dot(0, 0, 0.11, s.engrave, 0.95);
      dot(-0.03, -0.03, 0.04, s.metal[0], 0.9);
    }
  }
`;

export interface CoinSpec {
  name: string;
  /** The outline's corners (0: round). */
  sides: number;
  /** The design face coinDraw draws. */
  face: "traces" | "phosphor" | "neon" | "platinum" | "prism" | "mythic";
  metal: [number, number, number][];
  rim: number[];
  engrave: number[];
  glow: number[];
  neon?: number[][];
  trail?: boolean;
  milled?: boolean;
  sheen?: boolean;
  /** How bright the neon rim is (1 without). */
  neonGain?: number;
  /** The season mark on a tier coin's face. */
  mark?: string;
  /** Its spin's sound (soundFx.ts); the plain whir without. */
  whir?: string;
}
export interface CoinView { near: "p1" | "p2"; own: boolean; first?: "p1" | "p2"; names: Record<"p1" | "p2", string> }

const impl = new Function(`${COIN_PURE_SOURCE}; return { COIN_FLICK_AT, COIN_LAND_AT, COIN_LINE_AT, COIN_GONE_AT, COIN_PULSE_AT, COIN_PULSE_MS, COIN_PEAK, COIN_NEON_REACH, COIN_DEFAULT, COIN_SPECS, coinSpecOf, coinWhirOf, coinResult, coinHalfTurns, coinFlight, coinFaceAt };`)() as {
  COIN_FLICK_AT: number;
  COIN_LAND_AT: number;
  COIN_LINE_AT: number;
  COIN_GONE_AT: number;
  COIN_PULSE_AT: number;
  COIN_PULSE_MS: number;
  COIN_PEAK: number;
  COIN_NEON_REACH: number;
  COIN_DEFAULT: string;
  COIN_SPECS: Record<string, CoinSpec>;
  coinSpecOf: (itemId: string | null | undefined) => { id: string; spec: CoinSpec; fallback: boolean };
  coinWhirOf: (itemId: string | null | undefined) => string;
  coinResult: (view: CoinView) => string;
  coinHalfTurns: (portraitUp: boolean) => number;
  coinFlight: (u: number, halfTurns: number) => { angle: number; scale: number };
  coinFaceAt: (angle: number) => "design" | "portrait";
};

export const COIN_FLICK_AT = impl.COIN_FLICK_AT;
export const COIN_LAND_AT = impl.COIN_LAND_AT;
export const COIN_LINE_AT = impl.COIN_LINE_AT;
export const COIN_GONE_AT = impl.COIN_GONE_AT;
export const COIN_PULSE_AT = impl.COIN_PULSE_AT;
export const COIN_PULSE_MS = impl.COIN_PULSE_MS;
export const COIN_PEAK = impl.COIN_PEAK;
export const COIN_NEON_REACH = impl.COIN_NEON_REACH;
export const COIN_DEFAULT = impl.COIN_DEFAULT;
export const COIN_SPECS = impl.COIN_SPECS;
export const coinSpecOf = impl.coinSpecOf;
export const coinWhirOf = impl.coinWhirOf;
export const coinResult = impl.coinResult;
export const coinHalfTurns = impl.coinHalfTurns;
export const coinFlight = impl.coinFlight;
export const coinFaceAt = impl.coinFaceAt;
