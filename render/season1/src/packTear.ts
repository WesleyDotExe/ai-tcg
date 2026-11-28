// The opening's grip and tear, after the pick (render session 96; the
// owner's Season 1 plan, phase 3, "the pack opening rework, part one: the
// build-up: shake, tear, sound, no strobe", on the Crest design the owner
// picked, with the owner's 2026-11-28 entry, points 6-9):
//
//   8. Tearing the top of the picked pack starts the opening.
//   9. The tear is easier to hit. The grab zone is the whole top band of the
//      pack (about its top quarter, the crimp included) plus a margin above
//      and to each side, at least 48 px tall on a phone; a drag that starts
//      anywhere in it and moves about a third of the pack's width, either
//      way, tears (it needn't follow a line; a slanted drag counts); a tap or
//      click in the zone still tears (the 600 ms tear); a cue shows where to
//      tear until the first tear.
//
// And FLASH.md's storyboard, beats 2-4: the grip (hold the pack: it leans to
// the finger and trembles harder the longer it is held; the honest tell, the
// top seam glowing in the best card's colour for a hit, rising and holding,
// never pulsing), the tear (the foil rips along the finger's path, scraps
// thrown off the head of the cut, light leaking through it), and the open
// (the strip flies off, one slow swell of light, only for a hit, and the
// cards rise out as a stack, backs up).
//
// Pure: the zone, the gesture, the tremble, the torn edge and the light
// levels as plain functions. The page runs the same functions (TEAR_JS), so
// the browser and the tests can never disagree.

import { RUNG_OF, TELL_BACKDROPS, type TellRung } from "../../src/packOpening.js";

/** The tuning (owner 2026-11-28, point 9's starting values, tuned by hand
 * on a desktop and a phone in render session 96). */
export const TEAR = {
  /** The grab band: the top share of the pack's height (crimp included). */
  band: 0.25,
  /** The margin above the pack and past each side, as a share of its width. */
  margin: 0.14,
  /** The zone is never shorter than this (px) on a touch screen, nor its margin thinner than this. */
  minTouchPx: 48,
  minMarginPx: 16,
  /** A drag tears once it has moved this share of the pack's width, any direction. */
  tearShare: 1 / 3,
  /** Movement under this (px) is still a tap or a hold. */
  slopPx: 8,
  /** A tap's tear plays by itself over this long (ms). */
  tapMs: 600,
  /** Once a drag has torn, the cut runs the rest of the way in this long (ms). */
  finishMs: 260,
  /** A press held this long, unmoved, is a grip (ms); before it, a release is a tap. */
  holdMs: 220,
} as const;

export interface Box { left: number; top: number; width: number; height: number }
export interface Zone { left: number; top: number; right: number; bottom: number }

/** The grab zone for a pack drawn at `pack` (screen px): its top band plus a
 * margin above and to each side; on a touch screen never under 48 px tall. */
export function tearZone(pack: Box, touch: boolean): Zone {
  const margin = Math.max(TEAR.minMarginPx, pack.width * TEAR.margin);
  const band = Math.max(pack.height * TEAR.band, touch ? TEAR.minTouchPx : 0);
  return { left: pack.left - margin, right: pack.left + pack.width + margin, top: pack.top - margin, bottom: pack.top + band };
}

export const inZone = (z: Zone, x: number, y: number) => x >= z.left && x <= z.right && y >= z.top && y <= z.bottom;

/** How far a drag from (x0, y0) to (x, y) has torn a pack `packW` px wide:
 * 0 to 1, by the distance moved in any direction (a slanted or crooked drag
 * counts as much as a straight one), and which way the cut runs (+1 left to
 * right, -1 right to left; a drag with no sideways part runs from the side
 * it started nearer). */
export function tearProgress(x0: number, y0: number, x: number, y: number, packW: number, packCentreX: number): { progress: number; dir: 1 | -1 } {
  const dx = x - x0, dy = y - y0;
  const dist = Math.hypot(dx, dy);
  const p = Math.max(0, Math.min(1, dist / (packW * TEAR.tearShare)));
  const dir: 1 | -1 = Math.abs(dx) >= 4 ? (dx > 0 ? 1 : -1) : (x0 <= packCentreX ? 1 : -1);
  return { progress: +p.toFixed(4), dir };
}

/** The cut's length across the pack (0 to 1 of its width) while the finger
 * drags: it leads the finger a little, so the head of the cut is where the
 * finger is going; at 1 (torn) the page runs it to the far edge. */
export const cutLength = (progress: number) => +Math.min(1, 0.08 + progress * 0.62).toFixed(4);

/** The grip's tremble: grows from 0.5 px to 3 px (at a 270 px pack; scaled
 * to the pack) over 1.6 s of holding, 18 times a second. A shake moves the
 * pack; it never changes the light. */
export const TREMBLE = { fromPx: 0.5, toPx: 3, rampMs: 1600, hz: 18, atPackPx: 270 } as const;
export function trembleAmp(heldMs: number, packPx: number): number {
  const k = Math.max(0, Math.min(1, heldMs / TREMBLE.rampMs));
  const eased = k * k * (3 - 2 * k);
  return +((TREMBLE.fromPx + (TREMBLE.toPx - TREMBLE.fromPx) * eased) * (packPx / TREMBLE.atPackPx)).toFixed(3);
}
/** The tremble's offset at `t` ms into the hold (two frequencies, so it reads as a hand, not a buzz). */
export function trembleAt(t: number, packPx: number): { x: number; y: number } {
  const a = trembleAmp(t, packPx), w = (2 * Math.PI * TREMBLE.hz) / 1000;
  return { x: +(a * Math.sin(w * t)).toFixed(3), y: +(a * 0.6 * Math.sin(w * 1.37 * t + 1.1)).toFixed(3) };
}

/** Where the tear runs: just under the top crimp (pack units of 100 x 160;
 * the crimp is 9 tall), so the strip that flies off is the seal and a sliver
 * of foil. */
export const TEAR_Y = 12.5;

/** The torn edge as points across the pack (x 0-100, y in pack units of the
 * 160 height): jagged, from a seeded walk so it's the same every time for
 * the same seed, never further than 2.2 units from TEAR_Y. */
export function tornEdge(seed = 96, teeth = 26): { x: number; y: number }[] {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pts: { x: number; y: number }[] = [];
  for (let k = 0; k <= teeth; k++) {
    const x = (100 * k) / teeth + (k > 0 && k < teeth ? (rnd() - 0.5) * (60 / teeth) : 0);
    const y = TEAR_Y + (k % 2 ? 1 : -1) * (0.6 + rnd() * 1.4) + (rnd() - 0.5) * 0.4;
    pts.push({ x: +x.toFixed(2), y: +Math.max(TEAR_Y - 2.2, Math.min(TEAR_Y + 2.2, y)).toFixed(2) });
  }
  return pts;
}

/** The two clip paths the torn pack is drawn with (CSS polygons in % of the
 * pack's box): the body below the torn edge and the strip above it, each
 * reaching past the box so the glow and the reflection aren't cut. */
export function tornClips(edge = tornEdge()): { body: string; strip: string } {
  const H = 160, pct = (y: number) => `${((y / H) * 100).toFixed(2)}%`;
  const line = edge.map((p) => `${p.x.toFixed(2)}% ${pct(p.y)}`);
  const lead = `${-30}% ${pct(edge[0]!.y)}`, tail = `${130}% ${pct(edge[edge.length - 1]!.y)}`;
  return {
    body: `polygon(${[lead, ...line, tail, "130% 160%", "-30% 160%"].join(", ")})`,
    strip: `polygon(${["-30% -40%", "130% -40%", tail, ...line.slice().reverse(), lead].join(", ")})`,
  };
}

// ---------- the light: the honest tell and the open ----------

/** What the page learns from the server after the pick: the best card's
 * finish, and nothing else until the reveal (render/season1/PACKS.md). */
export type BestFinish = keyof typeof RUNG_OF;

/** The rungs that are a hit (the storyboard: Full Art or better): the seam glows for these, and only these. */
const HIT_RUNGS: readonly TellRung[] = ["charged", "radiant", "overload"];
export const isHit = (best: BestFinish) => HIT_RUNGS.includes(RUNG_OF[best]);

/** The light each beat may make, as the alpha of a soft glow over the dark
 * foil (the storyboard's light plan, beats 2-4, with its reduced-flash
 * levels). The page's glows are white-ish colours at these alphas over a room
 * at 0.03; the flash sampler measures the built page against FLASH.md's
 * budget (at most one counted flash a second; reduced flash: none). */
export interface TearLight { colour: string | null; seam: number; leak: number; swell: number; swellArea: number }
export function tearLight(best: BestFinish, reducedFlash: boolean): TearLight {
  const hit = isHit(best);
  const colour = hit ? TELL_BACKDROPS[RUNG_OF[best]].glow : null;
  if (reducedFlash) return { colour: colour ?? "#9fb4ff", seam: hit ? 0.22 : 0, leak: hit ? 0.2 : 0.12, swell: hit ? 0.1 : 0.06, swellArea: 0.45 };
  // Without a hit the open's light is the room's own blue, low: a swell is
  // the honest tell's job, so a plain pack's open never looks like a hit.
  return { colour: colour ?? "#9fb4ff", seam: hit ? 0.85 : 0, leak: hit ? 0.75 : 0.3, swell: hit ? 0.55 : 0.16, swellArea: 0.45 };
}

/** The swell's timing (the storyboard's beat 4: rise 300 ms, hold 100, fall 800). */
export const SWELL = { riseMs: 300, holdMs: 100, fallMs: 800 } as const;
/** The open: the strip flies off, then the stack of five rises out of the pack, backs up. */
export const OPEN = { stripMs: 650, stackDelayMs: 180, stackMs: 1100, cards: 5 } as const;

/** The script the page runs: the same functions and numbers, as plain JavaScript. */
export const TEAR_JS = `const TEAR=${JSON.stringify(TEAR)};const TREMBLE=${JSON.stringify(TREMBLE)};const SWELL=${JSON.stringify(SWELL)};const OPEN=${JSON.stringify(OPEN)};` +
  `const tearZone=${tearZone.toString()};const inZone=${inZone.toString()};const tearProgress=${tearProgress.toString()};const cutLength=${cutLength.toString()};` +
  `const trembleAmp=${trembleAmp.toString()};const trembleAt=${trembleAt.toString()};const TORN=${JSON.stringify({ edge: tornEdge(), clips: tornClips() })};`;
