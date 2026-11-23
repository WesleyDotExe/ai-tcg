// The automatic flash check's measure (render session 85; the owner's
// 2026-11-22 plan, phase 1 step 4, and decision 22: "pack opening and every
// effect meet WCAG 2.3.1: no more than three flashes in any one second, no
// saturated red flashing; an automatic flash check keeps it so").
//
// Pure: no browser, no file system. It takes frames (decoded PNGs, or any
// RGBA pixels) sampled at a fixed rate and answers, for every one-second
// window, how many flashes a large enough area made. The frame sampler
// (season1/flash/sample.ts) feeds it frames from headless Chromium.
//
// The rule, as WCAG 2.2 defines it (Understanding 2.3.1, "general flash and
// red flash thresholds"), and how it is measured here:
//
// - A **flash** is a pair of opposing changes in relative luminance of 10% or
//   more of the maximum (0.1 on WCAG's 0..1 scale), where the darker of the
//   two states is below 0.80. Measured per block (BLOCK px squares, linear
//   light averaged over the block), with a hysteresis tracker: a change
//   counts once the swing from the last extreme reaches 0.1, in the opposite
//   direction to the last change. A slow fade counts once, a pulse twice (one
//   flash), a strobe every swing.
// - A **red flash** is a pair of opposing transitions where one state is
//   saturated red (R / (R + G + B) >= 0.8, in linear light) and the two
//   states are more than 0.2 apart on the CIE 1976 u'v' chromaticity diagram.
//   Near-black blocks (luminance under RED_MIN_LUM) are ignored: their
//   chromaticity is noise, not a colour anyone sees.
// - **Area:** flashes only count when they happen together over more than
//   25% of any 10-degree field of view, which WCAG gives, for content viewed
//   at 1024 x 768, as a 341 x 256 px rectangle anywhere on the screen. The
//   rectangle here is scaled to the frame's own size (on a 1024 x 768 frame
//   it is exactly WCAG's).
// - **Fails** when, in any one-second window, more than three flashes (seven
//   or more changes) happen in blocks that together cover more than 25% of
//   some such rectangle; the same for red flashes, where WCAG allows none
//   above the area, but its own "three per second" rule still applies, so
//   red fails at the same count (and the report gives every red flash, so a
//   single one is visible too).

export const BLOCK = 8;
export const LUM_STEP = 0.1;
export const DARK_LIMIT = 0.8;
export const RED_RATIO = 0.8;
export const RED_UV = 0.2;
export const RED_MIN_LUM = 0.02;
/** More than three flashes = seven or more changes in one second. */
export const FAIL_CHANGES = 7;
/** WCAG's field of view at 1024 x 768, and the share of it that counts. */
export const FIELD = { w: 341, h: 256, of: { w: 1024, h: 768 }, share: 0.25 };

// ---------- PNG decode (8-bit RGB / RGBA, non-interlaced: what Chromium writes) ----------

import { inflateSync } from "node:zlib";

export interface Rgba { w: number; h: number; data: Uint8Array }

export function decodePng(buf: Uint8Array): Rgba {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error("not a PNG");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat: Uint8Array[] = [];
  while (p < buf.length) {
    const len = dv.getUint32(p); const type = String.fromCharCode(buf[p + 4]!, buf[p + 5]!, buf[p + 6]!, buf[p + 7]!);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); depth = body[8]!; ctype = body[9]!; interlace = body[12]!; }
    else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (depth !== 8 || (ctype !== 2 && ctype !== 6) || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth}, colour type ${ctype}, interlace ${interlace})`);
  const bpp = ctype === 6 ? 4 : 3, stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat.map((b) => Buffer.from(b.buffer, b.byteOffset, b.byteLength))));
  const out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!, row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp]! : 0, b = prev[x]!, c = x >= bpp ? prev[x - bpp]! : 0, v = row[x]!;
      let r: number;
      if (f === 0) r = v;
      else if (f === 1) r = v + a;
      else if (f === 2) r = v + b;
      else if (f === 3) r = v + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[x] = r & 255;
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; out[o] = cur[x * bpp]!; out[o + 1] = cur[x * bpp + 1]!; out[o + 2] = cur[x * bpp + 2]!; out[o + 3] = bpp === 4 ? cur[x * bpp + 3]! : 255; }
    const t = prev; prev = cur; cur = t;
  }
  return { w, h, data: out };
}

// ---------- one frame -> blocks ----------

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

/** One frame as blocks: each block's relative luminance, whether it is
 * saturated red, and its u'v' chromaticity. */
export interface BlockFrame { bw: number; bh: number; lum: Float32Array; red: Uint8Array; u: Float32Array; v: Float32Array; meanLum: number }

export function blocksOf(img: Rgba, block = BLOCK): BlockFrame {
  const bw = Math.floor(img.w / block), bh = Math.floor(img.h / block), n = bw * bh;
  const lum = new Float32Array(n), red = new Uint8Array(n), u = new Float32Array(n), v = new Float32Array(n);
  let total = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let R = 0, G = 0, B = 0;
    for (let y = by * block; y < (by + 1) * block; y++) for (let x = bx * block; x < (bx + 1) * block; x++) {
      const o = (y * img.w + x) * 4; R += LIN[img.data[o]!]!; G += LIN[img.data[o + 1]!]!; B += LIN[img.data[o + 2]!]!;
    }
    const k = block * block; R /= k; G /= k; B /= k;
    const i = by * bw + bx, L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    lum[i] = L; total += L;
    const s = R + G + B;
    red[i] = s > 0 && L >= RED_MIN_LUM && R / s >= RED_RATIO ? 1 : 0;
    // linear sRGB -> XYZ (D65) -> u'v'
    const X = 0.4124 * R + 0.3576 * G + 0.1805 * B, Y = L, Z = 0.0193 * R + 0.1192 * G + 0.9505 * B;
    const d = X + 15 * Y + 3 * Z;
    u[i] = d > 0 ? (4 * X) / d : 0.2105; v[i] = d > 0 ? (9 * Y) / d : 0.4737;
  }
  return { bw, bh, lum, red, u, v, meanLum: total / n };
}

// ---------- the trackers ----------

/** Feeds frames one by one; records, per frame, which blocks changed. */
export class FlashTracker {
  readonly lumChanges: Int32Array[] = [];
  readonly redChanges: Int32Array[] = [];
  readonly meanLum: number[] = [];
  private n = 0; private bw = 0; private bh = 0;
  // luminance: direction (0 at rest, +1 rising, -1 falling), the running
  // extreme in that direction; at rest, the low and high seen so far.
  private dir!: Int8Array; private peak!: Float32Array; private lo!: Float32Array; private hi!: Float32Array; private last!: Float32Array;
  // red: 0 unknown, 1 in a red state, 2 in a far state; the anchor's u'v'.
  private rstate!: Uint8Array; private ru!: Float32Array; private rv!: Float32Array;

  get size() { return { bw: this.bw, bh: this.bh }; }
  get frames() { return this.lumChanges.length; }

  push(f: BlockFrame): void {
    if (!this.n) {
      this.bw = f.bw; this.bh = f.bh; this.n = f.bw * f.bh;
      this.dir = new Int8Array(this.n); this.peak = new Float32Array(f.lum); this.lo = new Float32Array(f.lum); this.hi = new Float32Array(f.lum); this.last = new Float32Array(f.lum);
      this.rstate = new Uint8Array(this.n); this.ru = new Float32Array(this.n); this.rv = new Float32Array(this.n);
      for (let i = 0; i < this.n; i++) if (f.red[i]) { this.rstate[i] = 1; this.ru[i] = f.u[i]!; this.rv[i] = f.v[i]!; }
      this.lumChanges.push(new Int32Array(0)); this.redChanges.push(new Int32Array(0)); this.meanLum.push(f.meanLum);
      return;
    }
    if (f.bw !== this.bw || f.bh !== this.bh) throw new Error("frame size changed");
    const lc: number[] = [], rc: number[] = [];
    for (let i = 0; i < this.n; i++) {
      const x = f.lum[i]!;
      const d = this.dir[i]!;
      if (d === 0) {
        if (x < this.lo[i]!) this.lo[i] = x;
        if (x > this.hi[i]!) this.hi[i] = x;
        if (this.hi[i]! - this.lo[i]! >= LUM_STEP && this.lo[i]! < DARK_LIMIT) { lc.push(i); this.dir[i] = x >= this.hi[i]! ? 1 : -1; this.peak[i] = x; }
      } else if (d === 1) {
        if (x > this.peak[i]!) this.peak[i] = x;
        else if (this.peak[i]! - x >= LUM_STEP && x < DARK_LIMIT) { lc.push(i); this.dir[i] = -1; this.peak[i] = x; }
      } else {
        if (x < this.peak[i]!) this.peak[i] = x;
        else if (x - this.peak[i]! >= LUM_STEP && this.peak[i]! < DARK_LIMIT) { lc.push(i); this.dir[i] = 1; this.peak[i] = x; }
      }
      this.last[i] = x;
      // red
      const s = this.rstate[i]!, isRed = f.red[i] === 1;
      if (s === 0) { if (isRed) { this.rstate[i] = 1; this.ru[i] = f.u[i]!; this.rv[i] = f.v[i]!; } }
      else if (s === 1) {
        if (isRed) { this.ru[i] = f.u[i]!; this.rv[i] = f.v[i]!; }
        else if (Math.hypot(f.u[i]! - this.ru[i]!, f.v[i]! - this.rv[i]!) > RED_UV) { rc.push(i); this.rstate[i] = 2; this.ru[i] = f.u[i]!; this.rv[i] = f.v[i]!; }
      } else {
        if (isRed && Math.hypot(f.u[i]! - this.ru[i]!, f.v[i]! - this.rv[i]!) > RED_UV) { rc.push(i); this.rstate[i] = 1; this.ru[i] = f.u[i]!; this.rv[i] = f.v[i]!; }
        else if (!isRed) { this.ru[i] = f.u[i]!; this.rv[i] = f.v[i]!; }
      }
    }
    this.lumChanges.push(Int32Array.from(lc)); this.redChanges.push(Int32Array.from(rc)); this.meanLum.push(f.meanLum);
  }
}

// ---------- the windows ----------

export interface Second {
  /** The window's start, in ms from the first frame. */
  at: number;
  /** The most changes any field-sized area made in this window (a flash is
   * two: "more than three flashes" is seven or more). */
  changes: number;
  redChanges: number;
  /** changes / 2: 3.5 is more than three flashes. */
  flashes: number;
  redFlashes: number;
  /** The largest share of one field of view that flashed at least once (changed twice). */
  flashArea: number;
}

export interface FlashReport {
  fps: number; frames: number; ms: number;
  field: { w: number; h: number; blocks: number };
  /** One entry per window start (every frame). */
  windows: Second[];
  worst: Second; worstRed: Second;
  pass: boolean;
  /** Each failing stretch: from, to (ms), the worst count in it (changes; flashes = changes / 2). */
  fails: { from: number; to: number; changes: number; red: boolean }[];
  /** The biggest jump in the whole screen's mean luminance within 250 ms (a whole-screen pulse). */
  biggestScreenJump: { at: number; from: number; to: number };
  /** Every single flash big enough to count (area over 25% of a field), at its frame: the moments that flash at all. */
  bigFlashes: { at: number; area: number }[];
}

/** Largest number of marked blocks in any fw x fh rectangle of a bw x bh grid. */
function maxInRect(mark: Uint8Array, bw: number, bh: number, fw: number, fh: number, sat: Int32Array): number {
  const W = bw + 1;
  for (let y = 0; y < bh; y++) { let row = 0; for (let x = 0; x < bw; x++) { row += mark[y * bw + x]!; sat[(y + 1) * W + x + 1] = sat[y * W + x + 1]! + row; } }
  let best = 0;
  const rw = Math.min(fw, bw), rh = Math.min(fh, bh);
  for (let y = 0; y + rh <= bh; y++) for (let x = 0; x + rw <= bw; x++) {
    const s = sat[(y + rh) * W + x + rw]! - sat[y * W + x + rw]! - sat[(y + rh) * W + x]! + sat[y * W + x]!;
    if (s > best) best = s;
  }
  return best;
}

export function analyse(t: FlashTracker, fps: number, frameW: number, frameH: number, block = BLOCK): FlashReport {
  const { bw, bh } = t.size, n = bw * bh, F = t.frames, win = Math.max(1, Math.round(fps));
  const fw = Math.max(1, Math.round((FIELD.w * frameW) / FIELD.of.w / block)), fh = Math.max(1, Math.round((FIELD.h * frameH) / FIELD.of.h / block));
  const need = FIELD.share * fw * fh;
  const lumCount = new Int16Array(n), redCount = new Int16Array(n);
  const mark = new Uint8Array(n), sat = new Int32Array((bw + 1) * (bh + 1));
  const ms = (f: number) => Math.round((f * 1000) / fps);
  // How many changes the field-sized areas make: the largest k with more
  // than `need` blocks of >= k changes inside one rectangle.
  const changesOf = (count: Int16Array): number => {
    let maxC = 0; for (let i = 0; i < n; i++) if (count[i]! > maxC) maxC = count[i]!;
    let lo = 0, hi = maxC;
    while (lo < hi) {
      const k = Math.ceil((lo + hi + 1) / 2);
      for (let i = 0; i < n; i++) mark[i] = count[i]! >= k ? 1 : 0;
      if (maxInRect(mark, bw, bh, fw, fh, sat) > need) lo = k; else hi = k - 1;
    }
    return lo;
  };
  const windows: Second[] = [];
  const fails: FlashReport["fails"] = [];
  let open: FlashReport["fails"][number] | null = null;
  for (let f = 0; f < F; f++) {
    for (const i of t.lumChanges[f]!) lumCount[i]!++;
    for (const i of t.redChanges[f]!) redCount[i]!++;
    if (f - win >= 0) { for (const i of t.lumChanges[f - win]!) lumCount[i]!--; for (const i of t.redChanges[f - win]!) redCount[i]!--; }
    if (f < Math.min(win, F) - 1) continue;
    const start = Math.max(0, f - win + 1);
    for (let i = 0; i < n; i++) mark[i] = lumCount[i]! >= 2 ? 1 : 0;
    const flashArea = maxInRect(mark, bw, bh, fw, fh, sat) / (fw * fh);
    const c = changesOf(lumCount), rc = changesOf(redCount);
    const s: Second = { at: ms(start), changes: c, redChanges: rc, flashes: c / 2, redFlashes: rc / 2, flashArea: Math.round(flashArea * 1000) / 1000 };
    windows.push(s);
    if (c >= FAIL_CHANGES || rc >= FAIL_CHANGES) {
      const worst = Math.max(c, rc), red = rc >= FAIL_CHANGES;
      if (open && open.to >= ms(start)) { open.to = ms(f + 1); open.changes = Math.max(open.changes, worst); open.red ||= red; }
      else { open = { from: ms(start), to: ms(f + 1), changes: worst, red }; fails.push(open); }
    }
  }
  const zero: Second = { at: 0, changes: 0, redChanges: 0, flashes: 0, redFlashes: 0, flashArea: 0 };
  const worst = windows.reduce((a, b) => (b.changes > a.changes || (b.changes === a.changes && b.flashArea > a.flashArea) ? b : a), zero);
  const worstRed = windows.reduce((a, b) => (b.redChanges > a.redChanges ? b : a), zero);
  // Whole-screen jumps within 250 ms.
  const span = Math.max(1, Math.round(fps / 4));
  let jump = { at: 0, from: t.meanLum[0] ?? 0, to: t.meanLum[0] ?? 0 };
  for (let f = 0; f < F; f++) for (let g = Math.max(0, f - span); g < f; g++) {
    if (Math.abs(t.meanLum[f]! - t.meanLum[g]!) > Math.abs(jump.to - jump.from)) jump = { at: ms(g), from: t.meanLum[g]!, to: t.meanLum[f]! };
  }
  jump = { at: jump.at, from: Math.round(jump.from * 1000) / 1000, to: Math.round(jump.to * 1000) / 1000 };
  // Single flashes that are big enough to count at all: blocks with a change
  // at this frame and another within the next half second, over the area.
  const bigFlashes: FlashReport["bigFlashes"] = [];
  const half = Math.max(1, Math.round(fps / 2));
  const changedAt = new Int32Array(n).fill(-1);
  for (let f = 0; f < F; f++) {
    if (!t.lumChanges[f]!.length) continue;
    for (const i of t.lumChanges[f]!) changedAt[i] = f;
    mark.fill(0);
    let any = false;
    for (let g = f + 1; g < Math.min(F, f + 1 + half); g++) for (const i of t.lumChanges[g]!) if (changedAt[i] === f) { mark[i] = 1; any = true; }
    if (!any) continue;
    const a = maxInRect(mark, bw, bh, fw, fh, sat) / (fw * fh);
    if (a > FIELD.share && (!bigFlashes.length || ms(f) - bigFlashes[bigFlashes.length - 1]!.at > 300)) bigFlashes.push({ at: ms(f), area: Math.round(a * 100) / 100 });
  }
  return { fps, frames: F, ms: ms(F), field: { w: fw, h: fh, blocks: Math.round(need) }, windows, worst, worstRed, pass: fails.length === 0, fails, biggestScreenJump: jump, bigFlashes };
}
