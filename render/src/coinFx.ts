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
// Coin looks are code-drawn placeholders until the art pass. This slice
// draws the free starter, the Chrome Token (a silver hex). The two Season 0
// store coins and the three tier coins are the second coin slice: until
// then any other coin id flips the Chrome Token (`coinSpecOf` says so with
// `fallback`), which is safe because none of them can be owned yet (the
// store coins aren't on sale until drawn; the tier coins are granted at
// season end).
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
  // The house coin: every owner's starter, an empty slot's, every match
  // recorded before coins (OWNER_API.md "Coin skins").
  var COIN_DEFAULT = 'coin-chrome-token';
  // The looks, by the economy's item id (economy/src/cosmetics.ts). Colours
  // are RGB. sides: the outline's corners (6: a hex token).
  var COIN_SPECS = {
    'coin-chrome-token': {
      name: 'Chrome Token',
      sides: 6,
      // The metal, light to dark: a polished silver with cool steel shadows.
      metal: [[252, 253, 255], [214, 221, 232], [150, 160, 178], [84, 92, 110]],
      rim: [236, 241, 250],
      engrave: [92, 102, 124],
      glow: [205, 222, 255]
    }
  };
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
  // Image or null), faceRgb (the portrait's faction colour), a (alpha) }.
  // The coin turns about its horizontal axis: its height is |cos(angle)|,
  // and its edge shows as a band when it is nearly edge on.
  function coinDraw(ctx, c) {
    var s = c.spec, R = c.r * c.scale, k = Math.cos(c.angle), h = Math.abs(k), a = c.a == null ? 1 : c.a;
    if (a <= 0.003) return;
    function rgba(col, al) { return 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',' + Math.max(0, Math.min(1, al)).toFixed(3) + ')'; }
    function outline(rad, sy) {
      ctx.beginPath();
      for (var i = 0; i < s.sides; i++) {
        var th = -Math.PI / 2 + i * 2 * Math.PI / s.sides;
        var px = c.x + Math.cos(th) * rad, py = c.y + Math.sin(th) * rad * sy;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.save();
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = 'source-over';
    // Its shadow on the board, wider and softer the higher it rises.
    var lift = Math.max(0, c.scale - 1) / 0.3;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.35 * (1 - 0.5 * lift)).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(c.x, c.y + c.r * (0.9 + 0.5 * lift), c.r * (0.9 + 0.3 * lift), c.r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    // The edge: a dark band under the face, thickest edge on.
    var th = Math.max(1.5, R * 0.14) * Math.sqrt(1 - h * h);
    if (th > 0.5) {
      ctx.fillStyle = rgba(s.metal[3], 1);
      outline(R, Math.max(0.02, h)); ctx.save(); ctx.translate(0, th); ctx.fill(); ctx.restore();
      ctx.fillRect(c.x - R * 0.866, c.y, R * 1.732, th);
    }
    var sy = Math.max(0.02, h);
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
    var face = coinFaceAt(c.angle);
    if (face === 'design') {
      // The Chrome Token's own face: an engraved inner hex, three traces
      // from its centre to alternate corners, a node at each end.
      ctx.strokeStyle = rgba(s.engrave, 0.9); ctx.lineWidth = Math.max(0.8, R * 0.05);
      outline(R * 0.56, sy); ctx.stroke();
      ctx.beginPath();
      for (var j = 0; j < 3; j++) {
        var tj = -Math.PI / 2 + j * 2 * Math.PI / 3;
        ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(tj) * R * 0.56, c.y + Math.sin(tj) * R * 0.56 * sy);
      }
      ctx.stroke();
      ctx.fillStyle = rgba(s.engrave, 0.95);
      ctx.beginPath(); ctx.ellipse(c.x, c.y, R * 0.11, R * 0.11 * sy, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(s.metal[0], 0.9);
      ctx.beginPath(); ctx.ellipse(c.x - R * 0.03, c.y - R * 0.03 * sy, R * 0.04, R * 0.04 * sy, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // The portrait face: the player's avatar inside the inner hex, in a
      // ring of their faction colour (the avatar is drawn the right way up,
      // squashed with the turn).
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
    // A glint that runs across the face as it turns.
    ctx.globalCompositeOperation = 'lighter';
    var gl = ctx.createRadialGradient(c.x - R * 0.35, c.y - R * 0.4 * sy, 0, c.x - R * 0.35, c.y - R * 0.4 * sy, R * 0.9);
    gl.addColorStop(0, rgba(s.glow, 0.35 * (0.4 + 0.6 * h))); gl.addColorStop(1, rgba(s.glow, 0));
    outline(R, sy); ctx.fillStyle = gl; ctx.fill();
    ctx.restore();
  }
`;

export interface CoinSpec { name: string; sides: number; metal: [number, number, number][]; rim: number[]; engrave: number[]; glow: number[] }
export interface CoinView { near: "p1" | "p2"; own: boolean; first?: "p1" | "p2"; names: Record<"p1" | "p2", string> }

const impl = new Function(`${COIN_PURE_SOURCE}; return { COIN_FLICK_AT, COIN_LAND_AT, COIN_LINE_AT, COIN_GONE_AT, COIN_PULSE_AT, COIN_PULSE_MS, COIN_PEAK, COIN_DEFAULT, COIN_SPECS, coinSpecOf, coinResult, coinHalfTurns, coinFlight, coinFaceAt };`)() as {
  COIN_FLICK_AT: number;
  COIN_LAND_AT: number;
  COIN_LINE_AT: number;
  COIN_GONE_AT: number;
  COIN_PULSE_AT: number;
  COIN_PULSE_MS: number;
  COIN_PEAK: number;
  COIN_DEFAULT: string;
  COIN_SPECS: Record<string, CoinSpec>;
  coinSpecOf: (itemId: string | null | undefined) => { id: string; spec: CoinSpec; fallback: boolean };
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
export const COIN_DEFAULT = impl.COIN_DEFAULT;
export const COIN_SPECS = impl.COIN_SPECS;
export const coinSpecOf = impl.coinSpecOf;
export const coinResult = impl.coinResult;
export const coinHalfTurns = impl.coinHalfTurns;
export const coinFlight = impl.coinFlight;
export const coinFaceAt = impl.coinFaceAt;
