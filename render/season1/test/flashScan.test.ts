// The flash check's measure (render session 85), on frames made up here
// with a known answer: strobes above and below WCAG 2.3.1's three flashes a
// second, a strobe too small to count, a slow fade, one pulse, a red strobe
// at an even luminance, and the PNG decoder on every filter type.
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { analyse, blocksOf, decodePng, FlashTracker, type Rgba } from "../src/flashScan.js";

const W = 256, H = 192, FPS = 30;

function frame(colour: (x: number, y: number) => [number, number, number]): Rgba {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b] = colour(x, y); const o = (y * W + x) * 4; data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255; }
  return { w: W, h: H, data };
}
function run(frames: number, at: (f: number) => (x: number, y: number) => [number, number, number]) {
  const t = new FlashTracker();
  for (let f = 0; f < frames; f++) t.push(blocksOf(frame(at(f))));
  return analyse(t, FPS, W, H);
}
const black: [number, number, number] = [10, 10, 20], white: [number, number, number] = [240, 240, 240];
// Toggles every `half` frames: FPS / (2 * half) cycles (flashes) a second.
const strobe = (half: number, inside: (x: number, y: number) => boolean = () => true, on = white, off = black) =>
  (f: number) => (x: number, y: number) => (inside(x, y) && Math.floor(f / half) % 2 === 1 ? on : off);

describe("the flash check's measure (WCAG 2.3.1)", () => {
  it("fails a full-screen strobe at 5 flashes a second", () => {
    const r = run(90, strobe(3));
    expect(r.pass).toBe(false);
    expect(r.worst.flashes).toBe(5);
    expect(r.worst.changes).toBe(10);
    expect(r.fails.length).toBeGreaterThan(0);
  });
  it("passes a full-screen strobe at exactly 3 flashes a second (the limit is more than three)", () => {
    const r = run(90, strobe(5));
    expect(r.worst.flashes).toBe(3);
    expect(r.pass).toBe(true);
  });
  it("passes a 5 a second strobe on an area under a quarter of the field of view", () => {
    // The field on a 256 x 192 frame is 85 x 64 px; a quarter of it is ~1360 px²: a 32 x 32 square is 1024.
    const r = run(90, strobe(3, (x, y) => x < 32 && y < 32));
    expect(r.pass).toBe(true);
    expect(r.worst.flashes).toBe(0);
  });
  it("fails the same strobe once it covers more than a quarter of the field", () => {
    const r = run(90, strobe(3, (x, y) => x < 48 && y < 48));
    expect(r.pass).toBe(false);
  });
  it("counts a slow fade from dark to light as no flash", () => {
    const r = run(60, (f) => () => { const c = Math.round(10 + (230 * f) / 59); return [c, c, c]; });
    // One change, never reversed: half of a flash's pair.
    expect(r.worst.changes).toBe(1);
    expect(r.worst.flashes).toBeLessThan(1);
    expect(r.pass).toBe(true);
    expect(r.bigFlashes).toEqual([]);
  });
  it("counts one bright pulse as one flash, and lists it", () => {
    const r = run(60, (f) => () => (f >= 20 && f < 26 ? white : black));
    expect(r.worst.flashes).toBe(1);
    expect(r.pass).toBe(true);
    expect(r.bigFlashes.length).toBe(1);
    expect(r.bigFlashes[0]!.at).toBeGreaterThanOrEqual(600);
    expect(r.biggestScreenJump.to - r.biggestScreenJump.from).toBeGreaterThan(0.5);
  });
  it("ignores a change that stays above 0.8 luminance (both states light)", () => {
    const r = run(90, strobe(3, () => true, [255, 255, 255], [235, 235, 235]));
    expect(r.worst.flashes).toBe(0);
  });
  it("fails a saturated red strobe even at an even luminance (a red flash, not a general one)", () => {
    // Pure red's luminance is 0.2126; sRGB 128 grey is 0.2159: no general flash, but a red one.
    const r = run(90, strobe(3, () => true, [255, 0, 0], [128, 128, 128]));
    expect(r.worst.flashes).toBe(0);
    expect(r.worstRed.redFlashes).toBe(5);
    expect(r.pass).toBe(false);
    expect(r.fails[0]!.red).toBe(true);
  });
  it("does not call a dark red glow 'saturated red' (too dark to see as red)", () => {
    const r = run(90, strobe(3, () => true, [30, 0, 0], [10, 10, 10]));
    expect(r.worstRed.redFlashes).toBe(0);
  });
});

describe("the PNG decoder", () => {
  function crc32(buf: Uint8Array) {
    let c = ~0;
    for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
    return ~c >>> 0;
  }
  function chunk(type: string, body: Uint8Array) {
    const out = new Uint8Array(12 + body.length), dv = new DataView(out.buffer);
    dv.setUint32(0, body.length); for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(body, 8); dv.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
    return out;
  }
  // Encodes RGBA with a different filter on each row (0..4), as encoders do.
  function encode(w: number, h: number, px: Uint8Array) {
    const stride = w * 4, raw = new Uint8Array(h * (stride + 1));
    for (let y = 0; y < h; y++) {
      const f = y % 5; raw[y * (stride + 1)] = f;
      for (let x = 0; x < stride; x++) {
        const v = px[y * stride + x]!, a = x >= 4 ? px[y * stride + x - 4]! : 0, b = y ? px[(y - 1) * stride + x]! : 0, c = x >= 4 && y ? px[(y - 1) * stride + x - 4]! : 0;
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        raw[y * (stride + 1) + 1 + x] = (v - pred) & 255;
      }
    }
    const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
    dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 6;
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array(0))];
    return Buffer.concat(parts);
  }
  it("decodes every filter type back to the same pixels", () => {
    const w = 13, h = 11, px = new Uint8Array(w * h * 4);
    for (let i = 0; i < px.length; i++) px[i] = (i * 37 + (i >> 3) * 11) & 255;
    const img = decodePng(encode(w, h, px));
    expect(img.w).toBe(w); expect(img.h).toBe(h);
    expect(Array.from(img.data)).toEqual(Array.from(px));
  });
  it("refuses what is not a PNG", () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/not a PNG/);
  });
});
