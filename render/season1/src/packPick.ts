// Picking a pack from a row (render session 95; the owner's 2026-11-28
// entries: "several packs in a row; the centre one large and facing the
// owner, its neighbours angled back and dimmer, and more behind. Swipe,
// scroll, drag or the arrow keys move along the row with a little inertia
// and snap to the centre; a tap on the centre pack picks it: it lifts out of
// the row ... A tap on a side pack brings it to the centre.")
//
// Every pack in the row is the same booster with the same odds, and each has
// its own seed, made and kept by the server (owner 2026-11-28): the page
// holds nothing that tells one pack from another before the pick, and the
// screen doesn't say "every pack has the same odds". So the row's packs are
// drawn from one markup, told apart only by their place (data-slot), and the
// pick reports a slot number and nothing else.
//
// Pure: the row's geometry and its motion as plain functions. The page runs
// the same functions (PICK_JS, made from these, so the browser and the tests
// can never disagree).

/** How many packs the row holds (an odd number, so one starts in the middle). */
export const ROW_COUNT = 7;
export const ROW_START = 3;

export interface SlotPose {
  /** Across, in centre-pack widths from the middle. */
  x: number;
  /** Turned back about the vertical axis (degrees; neighbours face inward). */
  rotY: number;
  scale: number;
  /** Drawn behind the centre (larger is nearer). */
  z: number;
  /** Brightness (1 = the centre's). */
  light: number;
  opacity: number;
}

/** The pose of a pack `rel` places from the centre (fractional while the
 * row moves). Continuous in rel, so a drag moves every pack smoothly. */
export function slotPose(rel: number): SlotPose {
  const a = Math.abs(rel), s = Math.sign(rel);
  const near = Math.min(a, 1), far = Math.max(0, a - 1);
  const x = s * (near * 0.74 + far * 0.46);
  const rotY = -s * (near * 40 + Math.min(far, 2) * 7);
  const scale = 1 - near * 0.24 - Math.min(far, 2) * 0.09;
  const light = 1 - near * 0.42 - Math.min(far, 2) * 0.16;
  const opacity = a <= 2.6 ? 1 : Math.max(0, 1 - (a - 2.6) / 0.6);
  return { x: +x.toFixed(4), rotY: +rotY.toFixed(3), scale: +scale.toFixed(4), z: Math.round(100 - a * 10), light: +light.toFixed(4), opacity: +opacity.toFixed(4) };
}

/** Where a released drag comes to rest: its position carried on by its speed
 * (slots per ms) for a moment, then snapped to the nearest pack. One fling
 * moves at most three packs. */
export const FLING_MS = 220;
export function restingSlot(pos: number, velocity: number, count = ROW_COUNT): number {
  const carried = pos + Math.max(-3, Math.min(3, velocity * FLING_MS));
  return Math.max(0, Math.min(count - 1, Math.round(carried)));
}

/** One step of the row easing toward its resting slot (a critically damped
 * spring: no overshoot past a pack, settles in about 400 ms). */
export const SPRING = 0.00016;
export function ease(pos: number, vel: number, target: number, dtMs: number): { pos: number; vel: number } {
  const k = SPRING, c = 2 * Math.sqrt(k);
  let p = pos, v = vel;
  // small fixed sub-steps so a slow frame can't overshoot
  for (let t = 0; t < dtMs; t += 4) {
    const h = Math.min(4, dtMs - t);
    const a = -k * (p - target) - c * v;
    v += a * h; p += v * h;
  }
  if (Math.abs(p - target) < 0.001 && Math.abs(v) < 0.0001) return { pos: target, vel: 0 };
  return { pos: p, vel: v };
}

/** A drag of `dx` px across a row whose centre pack is `packPx` wide moves
 * it this many slots (a pack's width of drag is about one pack). */
export const dragSlots = (dx: number, packPx: number) => -dx / (packPx * 0.74);

/** The script the page runs: the same functions, as plain JavaScript. */
export const PICK_JS = `const ROW_COUNT=${ROW_COUNT},FLING_MS=${FLING_MS},SPRING=${SPRING};const slotPose=${slotPose.toString()};const restingSlot=${restingSlot.toString()};const ease=${ease.toString()};const dragSlots=${dragSlots.toString()};`;
