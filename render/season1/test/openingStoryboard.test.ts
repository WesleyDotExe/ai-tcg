// The Season 1 pack-opening storyboard (render session 85) held to the flash
// limit by the flash check's own measure: the storyboard's light plan, drawn
// as frames, read by flashScan exactly as the frame sampler reads a page.
import { describe, expect, it } from "vitest";
import { analyse, blocksOf, FlashTracker } from "../src/flashScan.js";
import { BIG_PULL, BUDGET, lightFrames, REDUCED_CEILING, STORYBOARD, timeline, type Beat } from "../src/openingStoryboard.js";

const W = 256, H = 192, FPS = 30;
function measure(beats: readonly Beat[], reduced = false) {
  const t = new FlashTracker();
  for (const f of lightFrames(beats, { fps: FPS, w: W, h: H, reduced })) t.push(blocksOf(f));
  return analyse(t, FPS, W, H);
}
// A Zero-Day pack: the takeover in place of the plain hit.
const ZERO_DAY = [...STORYBOARD.filter((b) => b.id !== "hit" && b.id !== "summary"), ...BIG_PULL, STORYBOARD.find((b) => b.id === "summary")!];
// A pack with no hit: no build, no hit.
const NO_HIT = STORYBOARD.filter((b) => b.id !== "build" && b.id !== "hit");

describe("the Season 1 pack-opening storyboard", () => {
  it("has the owner's beats in order: build-up (grip, tear), then the reveal and the big pull, then the summary", () => {
    expect(STORYBOARD.map((b) => b.id)).toEqual(["arrive", "grip", "tear", "open", "deal", "build", "hit", "summary"]);
    expect(BIG_PULL.map((b) => b.id)).toEqual(["blackout", "terminal", "arrival"]);
    for (const b of [...STORYBOARD, ...BIG_PULL]) for (const k of ["see", "hear", "move", "reduced", "before"] as const) expect(b[k].length, `${b.id}.${k}`).toBeGreaterThan(20);
  });

  for (const [name, beats] of [["a Gold pull", STORYBOARD], ["a Zero-Day pull", ZERO_DAY], ["a pack with no hit", NO_HIT]] as const) {
    it(`${name}: within the design's budget (at most ${BUDGET.flashesPerSecond} flash a second), well under WCAG's three, and no red flash`, () => {
      const r = measure(beats);
      expect(r.pass).toBe(true);
      expect(r.worst.flashes).toBeLessThanOrEqual(BUDGET.flashesPerSecond);
      expect(r.worst.changes).toBeLessThanOrEqual(2 * BUDGET.flashesPerSecond);
      expect(r.worstRed.redFlashes).toBe(0);
      // Big counted flashes at least a second apart.
      for (let i = 1; i < r.bigFlashes.length; i++) expect(r.bigFlashes[i]!.at - r.bigFlashes[i - 1]!.at).toBeGreaterThanOrEqual(BUDGET.minGapMs);
    });
    it(`${name}, reduced flash: no counted flash at all (at most one change in any second, never its return)`, () => {
      const r = measure(beats, true);
      expect(r.worst.changes).toBeLessThanOrEqual(1);
      expect(r.bigFlashes).toEqual([]);
    });
  }

  it("the hit and the Zero-Day arrival are each one counted flash (the moment is kept, once)", () => {
    const tl = timeline(STORYBOARD), hitStart = tl.find((x) => x.beat.id === "hit")!.start;
    const r = measure(STORYBOARD);
    expect(r.bigFlashes.some((f) => Math.abs(f.at - hitStart) < 400)).toBe(true);
    const zr = measure(ZERO_DAY), arr = timeline(ZERO_DAY).find((x) => x.beat.id === "arrival")!.start;
    expect(zr.bigFlashes.some((f) => Math.abs(f.at - arr) < 400)).toBe(true);
  });

  it("every bright light rises and falls no faster than the budget; reduced-flash lights stay under the line", () => {
    for (const b of [...STORYBOARD, ...BIG_PULL]) {
      for (const l of b.lights) if (Math.abs(l.peak) >= 0.1) {
        expect(l.riseMs, `${b.id} ${l.colour} rise`).toBeGreaterThanOrEqual(BUDGET.minRiseMs);
        if (l.fallMs) expect(l.fallMs, `${b.id} ${l.colour} fall`).toBeGreaterThanOrEqual(BUDGET.minFallMs);
      }
      for (const l of b.reducedLights) expect(Math.abs(l.peak), `${b.id} ${l.colour} reduced`).toBeLessThanOrEqual(REDUCED_CEILING);
      for (const l of [...b.lights, ...b.reducedLights]) expect(l.red ?? false, `${b.id} ${l.colour} red`).toBe(false);
    }
  });

  it("the check is not blind: Season 0's hit, drawn the same way, counts (a full-opacity flash with no rise)", () => {
    // Season 0's top-tier hit: the flash layer at 1.0 opacity at once, fading over 800 ms, three held cards 1.2 s apart in a ten-pack.
    const s0: Beat = { ...STORYBOARD[6]!, id: "s0", ms: 1200, lights: [{ at: 0, peak: 0.6, area: 0.5, riseMs: 0, holdMs: 0, fallMs: 800, colour: "white" }], reducedLights: [] };
    const r = measure([STORYBOARD[0]!, s0, s0, s0]);
    expect(r.bigFlashes.length).toBe(3);
    expect(r.worst.flashes).toBeGreaterThanOrEqual(1);
  });
});
