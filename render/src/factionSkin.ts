// EFFECTS.md slice 5 — the faction skinning pass (axis 2: faction = HOW it
// looks). Every particle primitive the render owns (bolt, cast, mote,
// burst) reads its per-faction character from ONE table, FACTION_SKINS, and
// lays its particles out with ONE generic function per primitive. Adding a
// faction is a new row in the table plus its CSS shape rules; there is no
// per-faction animation code anywhere.
//
// The one invariant (EFFECTS.md): meaning never follows the faction. The
// layout functions take the meaning-carrying inputs (a mote's direction,
// a bolt's endpoints) from the CALLER and the skin only reshapes what
// travels: no skin field can flip a mote's direction, stop a bolt short of
// its target, or change a cast tag. test/factionSkin.test.ts checks that
// for every skin x tier x direction.
//
// The characters (DESIGN placeholders until the art pass):
//   Cortex — clean, networked, precise: square data packets that snap to
//            lanes and travel in strict file, a bolt that is a train of
//            evenly spaced packets, a square sigil, a dashed double ring.
//   Swarm  — many small, organic: more, smaller round spores that drift
//            sideways as they rise/sink, a bolt that is a loose cloud of
//            spores weaving around the arc and converging on the target,
//            a dotted ring.
//   Aegis  — chrome, solid, shield-forward: fewer, larger chrome plates, a
//            bolt that is one heavy elongated slug turned along its flight,
//            a hexagonal sigil, a thick solid ring.
//   Null   — glitch, corruption, decay: thin bars that jump in discrete
//            steps with sideways tears, a bolt that stutters along the arc
//            with an RGB split, a broken sigil, a flickering ring.
//   Neutral — plain: today's shapes (arrow motes, a round bolt with a
//            smooth trail, the diamond sigil). The faction-agnostic look.
//
// Same single-source rule as castFx.ts: the page embeds
// FACTION_SKIN_SOURCE verbatim and Node evaluates the same text, so the
// tests exercise exactly what the page runs.
import type { FxTier } from "./fxMagnitude.js";

export type SkinName = "cortex" | "swarm" | "aegis" | "null" | "neutral";

export interface FactionSkin {
  name: SkinName;
  mote: {
    /** Multiplies the tier's mote count. */
    countMul: number;
    /** Multiplies the mote size. */
    sizeMul: number;
    /** Sideways drift, as a fraction of the travel distance (alternating
     * left/right per mote). */
    drift: number;
    /** When > 0, motes snap to this many evenly spaced vertical lanes. */
    lanes: number;
    /** Discrete-step motion (glitch) instead of a smooth ease. */
    steps: number;
    /** Sideways tear in px at each step (only with steps). */
    tear: number;
  };
  bolt: {
    /** Multiplies the tier's bolt core size. */
    sizeMul: number;
    /** Trail particles behind the head, on top of the tier's own trail. */
    extraTrail: number;
    /** Gap between trail particles, as a fraction of the flight time. */
    trailGap: number;
    /** Extra particles flying beside the head (a cloud), with a
     * perpendicular weave that is zero at both ends. */
    cloud: number;
    /** Max perpendicular weave of cloud particles, px. */
    weave: number;
    /** The head is stretched along its flight direction by this factor
     * (1 = round). */
    stretch: number;
    /** Discrete-step flight (stutter) when > 0: keyframes per flight. */
    steps: number;
    /** Perpendicular jitter in px at each step (only with steps). */
    jitter: number;
  };
  cast: {
    /** Multiplies the tier's ray count (rounded; 0 rays stays 0). */
    rayMul: number;
  };
}

export interface MoteParticle {
  /** Start position relative to the card's left/top, px. */
  x: number;
  y: number;
  /** Keyframe offsets from the start, px; the last is the end point. */
  path: { dx: number; dy: number }[];
  size: number;
  delayMs: number;
}

export interface BoltParticle {
  /** "head" | "trail" | "cloud" */
  role: string;
  /** Keyframes along the flight: absolute page coordinates. */
  path: { x: number; y: number; scale: number; rot: number }[];
  size: number;
  /** Delay as a fraction of the flight time. */
  lag: number;
  /** Discrete-step easing count, 0 = smooth. */
  steps: number;
}

export const FACTION_SKIN_SOURCE = String.raw`
  var FACTION_SKINS = {
    Cortex:  { name: 'cortex',  mote: { countMul: 1,   sizeMul: 0.85, drift: 0,    lanes: 3, steps: 0, tear: 0 },
               bolt: { sizeMul: 0.8,  extraTrail: 3, trailGap: 0.09, cloud: 0, weave: 0,  stretch: 1,   steps: 0, jitter: 0 },
               cast: { rayMul: 1 } },
    Swarm:   { name: 'swarm',   mote: { countMul: 1.7, sizeMul: 0.7,  drift: 0.35, lanes: 0, steps: 0, tear: 0 },
               bolt: { sizeMul: 0.7,  extraTrail: 0, trailGap: 0.07, cloud: 5, weave: 16, stretch: 1,   steps: 0, jitter: 0 },
               cast: { rayMul: 1.5 } },
    Aegis:   { name: 'aegis',   mote: { countMul: 0.6, sizeMul: 1.5,  drift: 0,    lanes: 0, steps: 0, tear: 0 },
               bolt: { sizeMul: 1.15, extraTrail: 0, trailGap: 0.05, cloud: 0, weave: 0,  stretch: 2.3, steps: 0, jitter: 0 },
               cast: { rayMul: 0.67 } },
    Null:    { name: 'null',    mote: { countMul: 0.5, sizeMul: 1,    drift: 0,    lanes: 0, steps: 4, tear: 5 },
               bolt: { sizeMul: 1,    extraTrail: 1, trailGap: 0.06, cloud: 0, weave: 0,  stretch: 1,   steps: 6, jitter: 7 },
               cast: { rayMul: 1 } },
    Neutral: { name: 'neutral', mote: { countMul: 1,   sizeMul: 1,    drift: 0,    lanes: 0, steps: 0, tear: 0 },
               bolt: { sizeMul: 1,    extraTrail: 0, trailGap: 0.07, cloud: 0, weave: 0,  stretch: 1,   steps: 0, jitter: 0 },
               cast: { rayMul: 1 } }
  };
  // Anything unknown (a future faction before its row exists) wears the
  // plain skin rather than breaking.
  function skinOf(faction) { return FACTION_SKINS[faction] || FACTION_SKINS.Neutral; }

  var SKIN_MOTE_COUNT = { subtle: 3, normal: 6, spectacle: 12 };
  var SKIN_MOTE_SIZE = { subtle: 7, normal: 7, spectacle: 10 };
  var SKIN_BOLT_SIZE = { subtle: 9, normal: 13, spectacle: 19 };
  var SKIN_BOLT_TRAIL = { subtle: 0, normal: 2, spectacle: 4 };
  var SKIN_CAST_RAYS = { subtle: 0, normal: 6, spectacle: 10 };

  // Deterministic per-index pseudo-noise in [-1, 1]: replaying a move looks
  // the same every time (the render never uses a random source).
  function skinNoise(k, salt) {
    var s = Math.sin((k + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  }

  // rise/sink motes. dir ('up' | 'down') is the MEANING and is applied
  // here, outside the skin: every path point's dy has dir's sign and the
  // last one is the full travel. The skin only picks count, size, x
  // placement, sideways drift and stepping.
  function moteLayout(faction, dir, tier, width, height) {
    var sk = skinOf(faction).mote;
    var n = Math.max(2, Math.round((SKIN_MOTE_COUNT[tier] || 6) * sk.countMul));
    var travel = height * (tier === 'spectacle' ? 0.95 : tier === 'subtle' ? 0.45 : 0.7);
    var sign = dir === 'up' ? -1 : 1;
    var size = Math.round((SKIN_MOTE_SIZE[tier] || 7) * sk.sizeMul);
    var y0 = dir === 'up' ? height * 0.8 : height * 0.15;
    var out = [];
    for (var k = 0; k < n; k++) {
      var x = width * ((k + 0.5) / n) + ((k * 7) % 5 - 2);
      if (sk.lanes > 0) x = width * ((k % sk.lanes) + 0.5) / sk.lanes;
      var path = [];
      var stepsN = sk.steps > 0 ? sk.steps : 4;
      for (var s = 1; s <= stepsN; s++) {
        var f = s / stepsN;
        var dx = sk.drift ? (k % 2 ? 1 : -1) * travel * sk.drift * Math.sin(Math.PI * f * 0.9) : 0;
        if (sk.steps > 0 && s < stepsN) dx += skinNoise(k * 7 + s, 3) * sk.tear;
        path.push({ dx: Math.round(dx * 10) / 10, dy: Math.round(sign * travel * f * 10) / 10 });
      }
      // Lanes stagger in strict file (a packet stream); others ripple.
      var delayMs = sk.lanes > 0 ? Math.floor(k / sk.lanes) * 70 : (k % 4) * 30;
      out.push({ x: Math.round(x * 10) / 10, y: Math.round(y0 * 10) / 10, path: path, size: Math.max(3, size), delayMs: delayMs });
    }
    return out;
  }

  // travel(from, to) particles along a quadratic arc { a, c, b }. Every
  // particle's first point is the attacker's centre and its last is the
  // target's: the skin can shape the flight, never where it lands.
  function boltLayout(faction, tier, small, arc) {
    var sk = skinOf(faction).bolt;
    var N = sk.steps > 0 ? sk.steps : 10;
    function at(t) {
      var u = 1 - t;
      return { x: u * u * arc.a.x + 2 * u * t * arc.c.x + t * t * arc.b.x, y: u * u * arc.a.y + 2 * u * t * arc.c.y + t * t * arc.b.y };
    }
    function tangent(t) {
      return { x: 2 * (1 - t) * (arc.c.x - arc.a.x) + 2 * t * (arc.b.x - arc.c.x), y: 2 * (1 - t) * (arc.c.y - arc.a.y) + 2 * t * (arc.b.y - arc.c.y) };
    }
    function track(weave, phase, jitterSalt) {
      var path = [];
      for (var k = 0; k <= N; k++) {
        var t = k / N, p = at(t), tg = tangent(t);
        var len = Math.sqrt(tg.x * tg.x + tg.y * tg.y) || 1;
        var nx = -tg.y / len, ny = tg.x / len;
        // Envelope sin(pi t) is 0 at both ends: weave/jitter never moves
        // the start or the landing point.
        var env = Math.sin(Math.PI * t);
        var off = weave * env * Math.sin(Math.PI * 2 * t + phase);
        if (sk.steps > 0 && k > 0 && k < N) off += skinNoise(k, jitterSalt) * sk.jitter * env;
        path.push({ x: p.x + nx * off, y: p.y + ny * off, scale: 0.7 + 0.5 * env, rot: Math.atan2(tg.y, tg.x) * 180 / Math.PI });
      }
      return path;
    }
    var size = Math.round((SKIN_BOLT_SIZE[tier] || 13) * sk.sizeMul * (small ? 0.65 : 1));
    var trail = small ? 0 : (SKIN_BOLT_TRAIL[tier] || 0) + (tier === 'subtle' ? 0 : sk.extraTrail);
    var steps = sk.steps;
    var out = [{ role: 'head', path: track(0, 0, 1), size: Math.max(4, size), lag: 0, steps: steps }];
    // The whole trail arrives within 35% of the flight after the head, so a
    // long packet train still lands inside the move's own window.
    var gap = trail > 0 ? Math.min(sk.trailGap, 0.35 / trail) : 0;
    for (var k = 1; k <= trail; k++) {
      out.push({ role: 'trail', path: track(0, 0, 1 + k), size: Math.max(3, size - k * (sk.extraTrail ? 1 : 2)), lag: Math.round(k * gap * 1000) / 1000, steps: steps });
    }
    var cloud = small ? Math.round(sk.cloud / 2) : sk.cloud;
    if (tier === 'subtle') cloud = Math.min(cloud, 2);
    for (var c = 0; c < cloud; c++) {
      out.push({ role: 'cloud', path: track(sk.weave * (0.5 + 0.5 * Math.abs(skinNoise(c, 5))), c * 2.1, 9 + c), size: Math.max(3, Math.round(size * 0.55)), lag: (c % 3) * 0.04, steps: steps });
    }
    return out;
  }

  // cast(source) rays: count and angles. A tier with no rays stays at none.
  function castRayAngles(faction, tier) {
    var base = SKIN_CAST_RAYS[tier] || 0;
    if (!base) return [];
    var n = Math.max(3, Math.round(base * skinOf(faction).cast.rayMul));
    var a = [];
    for (var k = 0; k < n; k++) a.push(Math.round((360 / n) * k + (n === 6 ? 30 : 0)));
    return a;
  }
`;

const impl = new Function(
  `${FACTION_SKIN_SOURCE}; return { FACTION_SKINS: FACTION_SKINS, skinOf: skinOf, moteLayout: moteLayout, boltLayout: boltLayout, castRayAngles: castRayAngles };`,
)() as {
  FACTION_SKINS: Record<string, FactionSkin>;
  skinOf: (faction: string | null | undefined) => FactionSkin;
  moteLayout: (faction: string, dir: "up" | "down", tier: FxTier, width: number, height: number) => MoteParticle[];
  boltLayout: (
    faction: string,
    tier: FxTier,
    small: boolean,
    arc: { a: { x: number; y: number }; c: { x: number; y: number }; b: { x: number; y: number } },
  ) => BoltParticle[];
  castRayAngles: (faction: string, tier: FxTier) => number[];
};

export const FACTION_SKINS = impl.FACTION_SKINS;
export const skinOf = impl.skinOf;
/** rise/sink motes for one card: direction is the caller's, never the skin's. */
export const moteLayout = impl.moteLayout;
/** travel(from, to) particles along an attack arc. */
export const boltLayout = impl.boltLayout;
/** cast(source) ray angles in degrees. */
export const castRayAngles = impl.castRayAngles;
