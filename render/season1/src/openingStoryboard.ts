// The storyboard for Season 1's pack opening (render session 85; the
// owner's 2026-11-22 plan, phase 1 step 4: "a storyboard for the new
// opening (the build-up: shake, tear, sound, no strobe; then the reveal and
// big-pull moments within the limit, plus a reduced-flash setting)").
//
// Pure data and two small functions; no DOM. The beats are what phase 3
// builds from. Each beat carries its light plan: how bright the light it
// makes gets, over what share of the screen, and how fast it rises and
// falls. `lightFrames` turns a whole opening's plan into frames, and the
// flash check's own measure (flashScan.ts) reads them, so the storyboard is
// held to WCAG 2.3.1 by the same code that holds the built page to it
// (test/openingStoryboard.test.ts). When phase 3 builds the opening, the
// frame sampler (flash/sample.ts) runs on the built page against the same
// limits.
//
// Season 0's opening, as measured (progress/render/evidence/
// season1-flash-audit-s85/), is the "before"; the storyboard says beat by
// beat what changes.

/** One beat's light: rises from the room's level to `peak` over `riseMs`,
 * holds `holdMs`, falls back over `fallMs`. `area` is its share of the
 * screen (centred). `colour` names it (the faction or the tell). A level of
 * 0 is the room; 1 is white. */
export interface Light { at: number; peak: number; area: number; riseMs: number; holdMs: number; fallMs: number; colour: string; red?: boolean }

export interface Beat {
  id: string;
  name: string;
  /** Who moves it on: the owner's gesture, or time. */
  trigger: string;
  /** Length in ms (a held beat: until the owner acts; this is a typical wait). */
  ms: number;
  see: string;
  hear: string;
  /** Motion that is not light: shakes, tears, flights (transforms only). */
  move: string;
  /** What reduced flash (and reduced motion) does to this beat. */
  reduced: string;
  /** Season 0's version of this beat, as measured, and what changes. */
  before: string;
  /** Lights, ms from the beat's start. */
  lights: Light[];
  /** Lights under the reduced-flash setting (none = the beat makes no light change that counts). */
  reducedLights: Light[];
}

/** The room's light: the neon-night stage at rest (Season 0's stage
 * measured 0.02-0.05 mean relative luminance). */
export const ROOM = 0.03;
/** A light change smaller than this never counts as a flash (WCAG: 0.1 of the maximum). The reduced-flash setting keeps every light under it. */
export const REDUCED_CEILING = 0.08;
/** The design's own budget, tighter than WCAG's three: at most one counted
 * flash in any second, and big lights at least this far apart. */
export const BUDGET = { flashesPerSecond: 1, minGapMs: 1000, minRiseMs: 250, minFallMs: 400 } as const;

/** One pack of five, the shine-slot card a Gold (a big pull), as the owner
 * sees it at a calm pace. A pack with no hit drops beats 6-7 (its fifth card
 * snaps like the others); a Prototype or Zero-Day's takeover replaces 7's
 * plain bloom with its own beats (BIG_PULL). */
export const STORYBOARD: readonly Beat[] = [
  {
    id: "arrive", name: "1. The pack arrives", trigger: "time", ms: 1400,
    see: "The room dims to the neon night (the grid running to a horizon behind the glass). The sealed pack rises into the middle: a crimped foil wrapper, the set logo along the top crimp, the faction mascot as the hero (placeholder art until the owner approves the art), the set symbol low on the front. A slow sheen crosses the foil once every 4 s.",
    hear: "A low room tone fades in; a soft whoosh as the pack rises.",
    move: "The pack rises 40 px and settles; an idle bob of 6 px every 3.4 s.",
    reduced: "The pack fades in in place; no bob; the sheen stays (a sheen's light change is under 0.05).",
    before: "Season 0: the pack rises and bobs with a shader shimmer; the page's first second measured 1-2 flashes over 80-88% of a field of view as the stage and the pack draw in (pack=1..10, worst second at 0.0-0.5 s). The new room fades in over 600 ms, which is under the flash line.",
    lights: [{ at: 0, peak: 0.06, area: 0.5, riseMs: 600, holdMs: 800, fallMs: 0, colour: "room" }],
    reducedLights: [{ at: 0, peak: 0.06, area: 0.5, riseMs: 600, holdMs: 800, fallMs: 0, colour: "room" }],
  },
  {
    id: "grip", name: "2. Grip", trigger: "the owner presses and holds the pack (or taps: the same beat, 600 ms)", ms: 900,
    see: "The pack is held: it leans toward the finger and trembles, harder the longer it is held. The honest tell from Season 0 stays: when the pack holds a hit (Full Art or better), the top crimp's seam starts to glow in the best card's colour, rising and holding, never pulsing.",
    hear: "The foil crinkles under the finger; a held tone rises with the tremble.",
    move: "Tremble: 0.5 px growing to 3 px, 18 times a second (a shake, not a light: it moves the pack, the light stays still).",
    reduced: "No tremble (reduced motion); the seam's glow is capped under the flash line.",
    before: "Season 0 has no grip beat: a tap tears at once. The owner asked for the build-up to be shake, tear and sound, not light.",
    lights: [{ at: 300, peak: 0.12, area: 0.04, riseMs: 600, holdMs: 0, fallMs: 900, colour: "tell" }],
    reducedLights: [{ at: 300, peak: 0.07, area: 0.04, riseMs: 600, holdMs: 0, fallMs: 900, colour: "tell" }],
  },
  {
    id: "tear", name: "3. The tear", trigger: "the owner drags along the top crimp (a tap plays it by itself in 700 ms)", ms: 900,
    see: "The foil rips along the finger's path: a jagged edge, curling scraps thrown off the head of the tear, the inside showing through the cut. The seam's glow becomes light leaking through the cut, one steady rise as the cut lengthens.",
    hear: "A tearing sound whose pitch and grain follow the finger's speed; the held tone swells.",
    move: "The strip peels; scraps fly; the pack sways with the pull.",
    reduced: "The strip slides off without scraps; the leak rises under the flash line.",
    before: "Season 0's tear throws sparks for a hit (kept: the honest tell) and ends in the burst below.",
    lights: [{ at: 0, peak: 0.16, area: 0.08, riseMs: 900, holdMs: 0, fallMs: 1100, colour: "tell" }],
    reducedLights: [{ at: 0, peak: 0.075, area: 0.08, riseMs: 900, holdMs: 0, fallMs: 1100, colour: "tell" }],
  },
  {
    id: "open", name: "4. Open", trigger: "time (the tear completes)", ms: 1200,
    see: "The top strip flies off; light from inside the pack swells up the screen in the best card's colour and slowly settles. One rise, one long fall: at most one flash, and only for a hit. The cards rise out of the pack as a stack, backs up.",
    hear: "A deep 'whump' (the best card's tier sets its weight) and a rising shimmer.",
    move: "The pack body drops away; the stack rises 20% and settles.",
    reduced: "The light rises and falls under the flash line; the stack fades up.",
    before: "Season 0's burst: a screen flash at 0.22-0.70 opacity (packBurstPlan: 0.22 + 0.12 a rung) over 620-1300 ms, plus a burst disc and a shock ring, all at once. Measured: counted flashes at the tear in every pack. The new open keeps the size of the moment in sound and motion and spends its light on one slow swell (rise 300 ms, fall 800 ms).",
    lights: [{ at: 0, peak: 0.32, area: 0.45, riseMs: 300, holdMs: 100, fallMs: 800, colour: "best card" }],
    reducedLights: [{ at: 0, peak: 0.075, area: 0.45, riseMs: 300, holdMs: 100, fallMs: 800, colour: "best card" }],
  },
  {
    id: "deal", name: "5. Plain cards", trigger: "a tap or swipe per card", ms: 4 * 900,
    see: "Each plain card flips with a snap (150 ms) and flies off to the side on the next tap; the next card is under it. A card never flashes white between back and face: the flip turns the card edge-on, so the change is a narrow sliver, never a full-card cut.",
    hear: "A snap per card, each a step higher in pitch.",
    move: "The flip turns the card about its long edge in 150 ms; on the next tap it flies off to the right, 300 ms.",
    reduced: "The face cross-fades over 200 ms instead of the flip; no flight (the card slides).",
    before: "Season 0 at an owner's pace (a tap 900 ms after the page takes one) measured no failing second; tapping as fast as the page allows, the card swaps themselves count (a new card face over a field of view is a light change): see the 'fastest' figures. Keeping the flip edge-on and the next card already under the top one keeps a fast thumb under the limit.",
    lights: [],
    reducedLights: [],
  },
  {
    id: "build", name: "6. The build (a held card)", trigger: "a tap on the face-down shine-slot card", ms: 2600,
    see: "The room dims (over 500 ms). The card's back glows through its stages (shimmer, charged, radiant, overload: the tell's colours, Season 0's ladder), each stage a rise that holds: the glow only ever climbs, it never drops between stages, so the stages are not flashes. A small pause after each where it might stop.",
    hear: "The rest of the sound drops near silence; a riser climbs with each stage.",
    move: "The card trembles, faster each stage (Season 0's tremble).",
    reduced: "No tremble; the glow's stages climb under the flash line; the dim is a 900 ms fade.",
    before: "Season 0's build is already a climb (glow stages, a dim). Kept, with the dim's own fall (the room going darker is a light change too) made slow enough to stay under the line on its own.",
    lights: [
      { at: 0, peak: -0.025, area: 1, riseMs: 500, holdMs: 2100, fallMs: 0, colour: "dim" },
      { at: 200, peak: 0.06, area: 0.12, riseMs: 300, holdMs: 2100, fallMs: 700, colour: "shimmer" },
      { at: 900, peak: 0.1, area: 0.12, riseMs: 300, holdMs: 1400, fallMs: 700, colour: "charged" },
      { at: 1600, peak: 0.15, area: 0.14, riseMs: 300, holdMs: 700, fallMs: 700, colour: "radiant" },
    ],
    reducedLights: [
      { at: 0, peak: -0.02, area: 1, riseMs: 900, holdMs: 1700, fallMs: 0, colour: "dim" },
      { at: 200, peak: 0.02, area: 0.12, riseMs: 300, holdMs: 2100, fallMs: 700, colour: "shimmer" },
      { at: 900, peak: 0.02, area: 0.12, riseMs: 300, holdMs: 1400, fallMs: 700, colour: "charged" },
      { at: 1600, peak: 0.02, area: 0.14, riseMs: 300, holdMs: 700, fallMs: 700, colour: "radiant" },
    ],
  },
  {
    id: "hit", name: "7. The hit", trigger: "time (the build completes)", ms: 1800,
    see: "The flip (slow for a big pull) and the land: one bloom of light from the card in its finish's colour, rising in 250 ms and falling over 900 ms, while the room comes back up behind it; the faction ward flares and turns; motes in the faction's colour. The finish's own shine (foil sweep, gold sheen) starts after the bloom has fallen.",
    hear: "A bass hit (its weight by tier), the finish's sting.",
    move: "A screen shake (Season 0's: up to 12 px for the top tier), the card's settle.",
    reduced: "No shake; the bloom rises and falls under the flash line; the ward fades in without its spin.",
    before: "Season 0's hit: a screen flash at 0.22-1.0 opacity (0.22 + 0.78 x the ladder's weight), 300-800 ms, at the same time as the dim lifting, the ward flaring and the motes: measured as counted flashes at each held card's land. The new hit caps the bloom's height and slows its fall so the bloom and the room coming back can't stack into a second change inside the same second.",
    lights: [
      { at: 0, peak: 0.025, area: 1, riseMs: 700, holdMs: 1100, fallMs: 0, colour: "room up" },
      { at: 0, peak: 0.3, area: 0.4, riseMs: 250, holdMs: 0, fallMs: 900, colour: "finish" },
    ],
    reducedLights: [
      { at: 0, peak: 0.02, area: 1, riseMs: 900, holdMs: 900, fallMs: 0, colour: "room up" },
      { at: 0, peak: 0.07, area: 0.4, riseMs: 250, holdMs: 0, fallMs: 900, colour: "finish" },
    ],
  },
  {
    id: "summary", name: "8. The summary", trigger: "a tap after the last card", ms: 1500,
    see: "The five cards fan in with their finishes and NEW badges; pack points; Open another / Done.",
    hear: "A soft chord per NEW card.",
    move: "The fan deals in, 70 ms apart; NEW stamps slam (small).",
    reduced: "The fan fades in together; no slams.",
    before: "Season 0's summary is quiet (kept).",
    lights: [],
    reducedLights: [],
  },
];

/** The big pulls' takeover (Prototype, Zero-Day), replacing beat 7's plain
 * hit. Season 0's Zero-Day takeover has a spinning red-to-green ring
 * (rgba(255,30,60,0.75): saturated red by WCAG's measure) round the card and
 * a three-times shake of the terminal; the new one has no saturated red. */
export const BIG_PULL: readonly Beat[] = [
  {
    id: "blackout", name: "7a. Zero-Day: the room goes dark", trigger: "time (the build completes)", ms: 900,
    see: "The room falls to black over 600 ms (slow enough not to count: one change, no return inside the second).",
    hear: "Everything cuts to silence; a single low tone.",
    move: "None: the card already lifted by the build hangs still in the dark.",
    reduced: "The same, over 900 ms.",
    before: "Season 0: the screen drops to black with a 'zd on' fade.",
    lights: [{ at: 0, peak: -0.03, area: 1, riseMs: 600, holdMs: 300, fallMs: 0, colour: "black" }],
    reducedLights: [{ at: 0, peak: -0.03, area: 1, riseMs: 900, holdMs: 0, fallMs: 0, colour: "black" }],
  },
  {
    id: "terminal", name: "7b. Zero-Day: the terminal", trigger: "time", ms: 2200,
    see: "A terminal types ZERO-DAY DETECTED, then the breach lines (scanning, privilege ROOT, payload, containment FAILED) in phosphor green. The breach is a glitch: the text tears sideways in bands (motion), not a strobe; the cursor blinks at 1.25 Hz on a tiny area.",
    hear: "Key clicks per character; a rising alarm, two notes.",
    move: "Bands of the text slip left and right; no screen shake.",
    reduced: "The text types without the band slips; the cursor holds steady.",
    before: "Season 0: the terminal shakes three times in 1.26 s (0.42 s each) and the Zero-Day shader ramps to full behind it.",
    lights: [{ at: 0, peak: 0.05, area: 0.25, riseMs: 400, holdMs: 1800, fallMs: 600, colour: "phosphor" }],
    reducedLights: [{ at: 0, peak: 0.05, area: 0.25, riseMs: 400, holdMs: 1800, fallMs: 600, colour: "phosphor" }],
  },
  {
    id: "arrival", name: "7c. Zero-Day: the arrival", trigger: "time", ms: 2000,
    see: "The card arrives large and settles; one bloom in the Zero-Day colour (a cold green-white, never saturated red); the ring round the card is a slow turning band in green and violet, not red.",
    hear: "The rise; the bass hit at its heaviest.",
    move: "The card scales from 1.5 to 1; a shake as the top tier's.",
    reduced: "No shake, no scale: the card fades in; the bloom under the line; the ring still.",
    before: "Season 0: the arrival, the hit's flash at full weight (1.0 opacity) and a red-green conic ring spinning once every 3 s.",
    lights: [
      { at: 0, peak: 0.055, area: 1, riseMs: 800, holdMs: 1200, fallMs: 0, colour: "room up" },
      { at: 0, peak: 0.34, area: 0.45, riseMs: 250, holdMs: 0, fallMs: 1000, colour: "zero-day" },
    ],
    reducedLights: [
      { at: 0, peak: 0.05, area: 1, riseMs: 1000, holdMs: 1000, fallMs: 0, colour: "room up" },
      { at: 0, peak: 0.07, area: 0.45, riseMs: 250, holdMs: 0, fallMs: 1000, colour: "zero-day" },
    ],
  },
];

/** The opening as a timeline: each beat starts when the one before ends. */
export function timeline(beats: readonly Beat[]): { beat: Beat; start: number }[] {
  let t = 0;
  return beats.map((beat) => { const r = { beat, start: t }; t += beat.ms; return r; });
}

/** A light's level at time t (ms from its beat's start). */
export function lightAt(l: Light, t: number): number {
  const u = t - l.at;
  if (u < 0) return 0;
  if (u < l.riseMs) return (l.peak * u) / l.riseMs;
  if (u < l.riseMs + l.holdMs) return l.peak;
  if (!l.fallMs) return l.peak;
  const v = u - l.riseMs - l.holdMs;
  return v < l.fallMs ? l.peak * (1 - v / l.fallMs) : 0;
}

/** The opening's light, as frames for the flash check: a w x h screen whose
 * every pixel is the room's level plus every light that covers it (each
 * light a centred rectangle of its area share). Returns grey RGBA frames. */
export function lightFrames(beats: readonly Beat[], opts: { fps: number; w: number; h: number; reduced?: boolean }): { w: number; h: number; data: Uint8Array }[] {
  const { fps, w, h } = opts;
  const tl = timeline(beats);
  const total = tl.length ? tl[tl.length - 1]!.start + tl[tl.length - 1]!.beat.ms : 0;
  const frames: { w: number; h: number; data: Uint8Array }[] = [];
  // Lights in order of start, with their rectangle.
  const lights = tl.flatMap(({ beat, start }) => (opts.reduced ? beat.reducedLights : beat.lights).map((l) => {
    const s = Math.sqrt(Math.min(1, l.area)), rw = Math.round(w * s), rh = Math.round(h * s);
    return { l, start, x0: Math.round((w - rw) / 2), y0: Math.round((h - rh) / 2), x1: Math.round((w + rw) / 2), y1: Math.round((h + rh) / 2) };
  }));
  const enc = (L: number) => { const c = Math.max(0, Math.min(1, L)); const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(s * 255); };
  for (let f = 0; f * 1000 / fps < total + 500; f++) {
    const t = (f * 1000) / fps;
    const data = new Uint8Array(w * h * 4);
    const level = new Float32Array(w * h).fill(ROOM);
    // A light with no fall holds to the end (the room's own level: the dim,
    // the room coming back, the blackout); every other light falls by itself.
    for (const g of lights) {
      const v = lightAt(g.l, t - g.start);
      if (!v) continue;
      for (let y = g.y0; y < g.y1; y++) for (let x = g.x0; x < g.x1; x++) level[y * w + x] = level[y * w + x]! + v;
    }
    for (let i = 0; i < w * h; i++) { const c = enc(level[i]!); data[i * 4] = c; data[i * 4 + 1] = c; data[i * 4 + 2] = c; data[i * 4 + 3] = 255; }
    frames.push({ w, h, data });
  }
  return frames;
}
