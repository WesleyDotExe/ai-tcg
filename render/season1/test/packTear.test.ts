// The opening's grip and tear (render session 96): the grab zone the owner
// asked for (2026-11-28 point 9), the gesture (any direction, a slant, a
// crooked path), the tremble, the torn edge, the honest tell's light, and the
// page (no row buttons, no way back after a pick: points 6-7).
import { describe, expect, it } from "vitest";
import { cutLength, inZone, isHit, OPEN, TEAR, TEAR_JS, TEAR_Y, tearLight, tearProgress, tearZone, tornClips, tornEdge, trembleAmp, trembleAt } from "../src/packTear.js";
import { packPickPage } from "../src/packWrapperPage.js";
import { REDUCED_CEILING } from "../src/openingStoryboard.js";

const desk = { left: 500, top: 280, width: 290, height: 464 };
const phone = { left: 95, top: 300, width: 160, height: 256 };

describe("the grab zone", () => {
  it("is the pack's top quarter plus a margin above and to each side", () => {
    const z = tearZone(desk, false);
    expect(z.bottom - desk.top).toBeCloseTo(desk.height * 0.25, 5);
    expect(desk.top - z.top).toBeGreaterThanOrEqual(16);
    expect(desk.left - z.left).toBeCloseTo(desk.width * TEAR.margin, 5);
    expect(z.right - (desk.left + desk.width)).toBeCloseTo(desk.width * TEAR.margin, 5);
  });
  it("is never under 48 px tall on a touch screen, nor its margin under 16 px", () => {
    const tiny = { left: 10, top: 100, width: 60, height: 96 };
    const z = tearZone(tiny, true);
    expect(z.bottom - tiny.top).toBeGreaterThanOrEqual(48);
    expect(tiny.top - z.top).toBeGreaterThanOrEqual(16);
    expect(z.bottom - z.top).toBeGreaterThanOrEqual(48);
    expect(tearZone(phone, true).bottom - phone.top).toBeGreaterThanOrEqual(48);
  });
  it("takes the crimp, the band, the margins, and not the body", () => {
    const z = tearZone(desk, false);
    expect(inZone(z, desk.left + 5, desk.top + 3)).toBe(true); // the crimp
    expect(inZone(z, desk.left + desk.width / 2, desk.top + desk.height * 0.24)).toBe(true);
    expect(inZone(z, desk.left - 20, desk.top + 30)).toBe(true); // beside it
    expect(inZone(z, desk.left + 100, desk.top - 25)).toBe(true); // above it
    expect(inZone(z, desk.left + 100, desk.top + desk.height * 0.4)).toBe(false);
  });
});

describe("the gesture", () => {
  const w = desk.width, cx = desk.left + w / 2, third = w / 3;
  it("tears after about a third of the pack's width, either way", () => {
    expect(tearProgress(520, 300, 520 + third, 300, w, cx)).toEqual({ progress: 1, dir: 1 });
    expect(tearProgress(760, 300, 760 - third, 300, w, cx)).toEqual({ progress: 1, dir: -1 });
    expect(tearProgress(520, 300, 520 + third / 2, 300, w, cx).progress).toBeCloseTo(0.5, 3);
  });
  it("counts a slanted drag as much as a straight one (it needn't follow a line)", () => {
    const d = third / Math.SQRT2;
    expect(tearProgress(520, 300, 520 + d, 300 + d, w, cx).progress).toBeCloseTo(1, 3);
    expect(tearProgress(520, 300, 520 + d, 300 - d, w, cx).dir).toBe(1);
  });
  it("runs a drag with no sideways part from the side it started nearer", () => {
    expect(tearProgress(530, 300, 531, 300 + third, w, cx).dir).toBe(1);
    expect(tearProgress(770, 300, 769, 300 + third, w, cx).dir).toBe(-1);
  });
  it("leads the finger with the cut, and the cut is whole once torn", () => {
    expect(cutLength(0)).toBeGreaterThan(0);
    expect(cutLength(0.5)).toBeGreaterThan(0.3);
    expect(cutLength(0.5)).toBeLessThan(0.5);
    expect(cutLength(1)).toBeLessThan(1); // the page runs the rest in TEAR.finishMs
  });
});

describe("the grip", () => {
  it("trembles harder the longer it is held: 0.5 px to 3 px over 1.6 s at a 270 px pack, scaled to the pack", () => {
    expect(trembleAmp(0, 270)).toBeCloseTo(0.5, 3);
    expect(trembleAmp(800, 270)).toBeGreaterThan(1.5);
    expect(trembleAmp(1600, 270)).toBeCloseTo(3, 3);
    expect(trembleAmp(5000, 270)).toBeCloseTo(3, 3);
    expect(trembleAmp(1600, 135)).toBeCloseTo(1.5, 3);
    for (let t = 0; t < 2000; t += 7) { const o = trembleAt(t, 270); expect(Math.hypot(o.x, o.y)).toBeLessThanOrEqual(trembleAmp(t, 270) * 1.17 + 1e-9); }
  });
});

describe("the torn edge", () => {
  it("is jagged, stays near the line under the crimp, and spans the pack", () => {
    const e = tornEdge();
    expect(e[0]!.x).toBe(0); expect(e[e.length - 1]!.x).toBe(100);
    for (const p of e) { expect(Math.abs(p.y - TEAR_Y)).toBeLessThanOrEqual(2.2); }
    for (let k = 1; k < e.length; k++) expect(e[k]!.x).toBeGreaterThan(e[k - 1]!.x);
    const ups = e.slice(1).filter((p, k) => (p.y - TEAR_Y) * (e[k]!.y - TEAR_Y) < 0).length;
    expect(ups).toBeGreaterThan(e.length / 2); // it zigzags
    expect(tornEdge(96)).toEqual(tornEdge(96));
  });
  it("cuts the pack in two pieces along the same line", () => {
    const { body, strip } = tornClips();
    expect(body).toMatch(/^polygon\(/); expect(strip).toMatch(/^polygon\(/);
    const pts = (s: string) => s.slice(8, -1).split(", ");
    const mid = (s: string) => pts(s).filter((p) => !/-30%|130%/.test(p));
    expect(mid(body)).toEqual(mid(strip).reverse());
  });
});

describe("the light", () => {
  it("glows the seam only for a hit (Full Art or better), in the tell's colour", () => {
    expect(isHit("plain")).toBe(false); expect(isHit("foil")).toBe(false);
    expect(isHit("fullArt")).toBe(true); expect(isHit("gold")).toBe(true); expect(isHit("zeroDay")).toBe(true);
    expect(tearLight("plain", false).seam).toBe(0);
    expect(tearLight("foil", false).seam).toBe(0);
    expect(tearLight("gold", false).seam).toBeGreaterThan(0.5);
    expect(tearLight("gold", false).colour).toBe("#ffcf6a");
  });
  it("never uses saturated red, even for a Zero-Day", () => {
    for (const b of ["plain", "foil", "fullArt", "gold", "prototype", "zeroDay"] as const) {
      const c = tearLight(b, false).colour!, r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), bl = parseInt(c.slice(5, 7), 16);
      expect(r / (r + g + bl)).toBeLessThan(0.6);
    }
  });
  it("keeps a plain pack's open lower than a hit's, and Reduce flashing lowers every light", () => {
    expect(tearLight("plain", false).swell).toBeLessThan(tearLight("gold", false).swell / 2);
    for (const b of ["plain", "gold", "zeroDay"] as const) {
      const f = tearLight(b, false), r = tearLight(b, true);
      expect(r.seam).toBeLessThanOrEqual(f.seam); expect(r.leak).toBeLessThanOrEqual(f.leak); expect(r.swell).toBeLessThan(f.swell);
      // the swell is a glow over the dark room (luminance 0.03): at this alpha its lift stays under the reduced-flash ceiling
      expect(r.swell * 0.6).toBeLessThan(REDUCED_CEILING);
    }
  });
});

describe("the page", () => {
  const h = packPickPage();
  it("has no arrows, no 'Pick this pack' and no 'Back to the row' (owner 2026-11-28, points 6-7)", () => {
    expect(h).not.toMatch(/id="(prev|next|choose|again)"/);
    expect(h).not.toMatch(/Pick this pack|Back to the row/);
  });
  it("runs the same functions as here, and the open's numbers", () => {
    const f = new Function(`${TEAR_JS}; return { tearZone, tearProgress, cutLength, trembleAt, TORN, OPEN };`)() as {
      tearZone: typeof tearZone; tearProgress: typeof tearProgress; cutLength: typeof cutLength; trembleAt: typeof trembleAt; TORN: { edge: unknown; clips: unknown }; OPEN: typeof OPEN };
    expect(f.tearZone(phone, true)).toEqual(tearZone(phone, true));
    expect(f.tearProgress(1, 2, 80, 40, 160, 90)).toEqual(tearProgress(1, 2, 80, 40, 160, 90));
    expect(f.cutLength(0.37)).toBe(cutLength(0.37));
    expect(f.trembleAt(333, 200)).toEqual(trembleAt(333, 200));
    expect(f.TORN).toEqual({ edge: tornEdge(), clips: tornClips() });
    expect(f.OPEN).toEqual(OPEN);
  });
  it("carries the tell's light per finish, and still no seed, card or odds line", () => {
    const lights = JSON.parse(/<script type="application\/json" id="tear-lights">(.*?)<\/script>/.exec(h)![1]!);
    expect(lights.gold.full).toEqual(tearLight("gold", false));
    expect(lights.zeroDay.reduced).toEqual(tearLight("zeroDay", true));
    expect(h).not.toMatch(/seed|same odds|\bodds\b/i);
  });
});
