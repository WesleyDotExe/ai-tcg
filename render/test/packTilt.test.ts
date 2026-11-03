// Render session 27: hold to tilt (owner 2026-10-18, as corrected the same
// day). The page is driven in a real browser, with a mouse and with touch,
// by progress/render/evidence/pack-tilt-check.mjs; these tests pin what can
// be pinned in Node:
//  1. the press rule: a hold or (where a move means nothing else) a drag
//     starts the tilt; on the reveal stack a quick move stays a swipe;
//  2. the lean: towards the finger, never past the maximum, flat at the
//     centre;
//  3. the page ships the tilt timings, and the tilt never reads what a pack
//     holds (the honest tell);
//  4. the correction: no art depth, the card leans as one piece.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TILT } from "../src/packOpening.js";
import { PACK_CSS, PACK_PAGE_PURE_SOURCE, PACK_PAGE_RUNTIME_SOURCE } from "../src/packPage.js";

const pure = new Function(`${PACK_PAGE_PURE_SOURCE}; return { packHoldState, packTiltAngles, packGesture, packLateTap };`)() as {
  packLateTap: (heldMs: number, dist: number, leans: number, T: typeof TILT) => boolean;
  packHoldState: (dx: number, dy: number, ms: number, swipe: boolean, T: typeof TILT) => "pending" | "tilt" | "move";
  packTiltAngles: (x: number, y: number, max: number) => { rx: number; ry: number };
  packGesture: (dx: number, dy: number, ms: number) => string;
};

describe("the press rule", () => {
  it("a press held still past holdMs tilts, anywhere", () => {
    for (const swipe of [true, false]) {
      expect(pure.packHoldState(0, 0, TILT.holdMs - 1, swipe, TILT)).toBe("pending");
      expect(pure.packHoldState(2, 3, TILT.holdMs, swipe, TILT)).toBe("tilt");
    }
  });
  it("a drag tilts at once where a move means nothing else; on the stack it stays a swipe", () => {
    expect(pure.packHoldState(TILT.dragPx, 0, 30, false, TILT)).toBe("tilt");
    expect(pure.packHoldState(TILT.dragPx, 0, 30, true, TILT)).toBe("move");
    expect(pure.packHoldState(TILT.dragPx - 1, 0, 30, true, TILT)).toBe("pending");
  });
  it("a quick tap never reaches the tilt, and still reads as a tap", () => {
    // A tap is shorter than the hold and moves less than the drag.
    expect(pure.packHoldState(3, 2, 120, false, TILT)).toBe("pending");
    expect(pure.packGesture(3, 2, 120)).toBe("tap");
    // The tap's own slop is wider than the drag start, so a press that
    // moved enough to tilt is never still in the middle of being a tap
    // where a move is a swipe: there it is a move.
    expect(TILT.dragPx).toBeLessThan(10);
  });
  it("proposes the owner's numbers: about 0.2 s, a few pixels, about 15 degrees", () => {
    expect(TILT.holdMs).toBe(200);
    expect(TILT.dragPx).toBeGreaterThanOrEqual(4);
    expect(TILT.dragPx).toBeLessThanOrEqual(12);
    expect(TILT.maxDeg).toBe(15);
    expect(TILT.reducedMaxDeg).toBeLessThan(TILT.maxDeg);
  });
});

describe("the lean", () => {
  const { packTiltAngles } = pure;
  it("is flat with the finger at the centre", () => {
    expect(packTiltAngles(0.5, 0.5, 15)).toEqual({ rx: 0, ry: 0 });
  });
  it("leans towards the finger: the side under it dips away", () => {
    expect(packTiltAngles(1, 0.5, 15)).toEqual({ rx: 0, ry: 15 });
    expect(packTiltAngles(0, 0.5, 15)).toEqual({ rx: 0, ry: -15 });
    expect(packTiltAngles(0.5, 0, 15)).toEqual({ rx: 15, ry: 0 });
    expect(packTiltAngles(0.5, 1, 15)).toEqual({ rx: -15, ry: 0 });
  });
  it("never passes the maximum, even with the finger far off the card", () => {
    for (const [x, y] of [[-3, -3], [4, 0.2], [0.5, 9], [-1, 2]]) {
      const a = packTiltAngles(x!, y!, 15);
      expect(Math.abs(a.rx)).toBeLessThanOrEqual(15);
      expect(Math.abs(a.ry)).toBeLessThanOrEqual(15);
      const r = packTiltAngles(x!, y!, TILT.reducedMaxDeg);
      expect(Math.abs(r.rx)).toBeLessThanOrEqual(TILT.reducedMaxDeg);
    }
  });
  it("moves smoothly with the finger (no jump bigger than the step)", () => {
    let last = packTiltAngles(0, 0.5, 15).ry;
    for (let i = 1; i <= 100; i++) {
      const ry = packTiltAngles(i / 100, 0.5, 15).ry;
      expect(ry).toBeGreaterThanOrEqual(last);
      expect(ry - last).toBeLessThanOrEqual(0.4);
      last = ry;
    }
  });
});

describe("the page", () => {
  const page = readFileSync(new URL("../output/pack-opening.html", import.meta.url), "utf8");
  it("ships the tilt timings", () => {
    const tm = JSON.parse(/<script type="application\/json" id="pack-timings">(.*?)<\/script>/s.exec(page)![1]!);
    expect(tm.tilt).toEqual(TILT);
  });
  it("tilts the pack, the stack's card, the viewer and the fan's front pack, and nothing else", () => {
    const whats = [...PACK_PAGE_RUNTIME_SOURCE.matchAll(/what: '(\w+)'/g)].map((m) => m[1]).sort();
    expect(whats).toEqual(["card", "fan", "pack", "viewer"]);
  });
  it("the tilt never reads what the pack holds (the honest tell)", () => {
    // The tilt's own code, from its header to the reveals.
    const start = PACK_PAGE_RUNTIME_SOURCE.indexOf("// ---------- hold to tilt");
    const end = PACK_PAGE_RUNTIME_SOURCE.indexOf("// ---------- the reveals");
    const code = PACK_PAGE_RUNTIME_SOURCE.slice(start, end).replace(/\/\/.*$/gm, "");
    expect(start).toBeGreaterThan(0);
    for (const word of ["sparks", "hit", "jackpot", "fullReveal", "finish", "reveal", "S.cur"]) expect(code).not.toMatch(new RegExp(`\\b${word}\\b`));
  });
  it("leans the card as one piece: no art offset or depth layer", () => {
    // Correction 2026-10-18: no parallax. Only the whole card (or pack) is
    // rotated; nothing inside it moves on its own.
    expect(PACK_PAGE_RUNTIME_SOURCE).not.toMatch(/translateZ|parallax/i);
    expect(PACK_CSS).not.toMatch(/translateZ|parallax/i);
  });
  it("marks the tear strip", () => {
    expect(page).toContain('<span class="tab">TEAR</span>');
    expect(PACK_CSS).toMatch(/\.pack \.strip \{/);
  });
});

// Render session 54: the check-E flake, found. Under load the hold timer
// fired before a quick tap's queued release was handled, the tap became a
// tilt and was ignored (site-check-s47's second pack stalled on card 0).
describe("a tap is never lost to a slow page", () => {
  it("a release the hold timer beat is still a tap if the finger was down under holdMs, still, never leant", () => {
    expect(pure.packLateTap(40, 0, 1, TILT)).toBe(true);
    expect(pure.packLateTap(TILT.holdMs - 1, TILT.dragPx - 1, 1, TILT)).toBe(true);
  });
  it("a real hold, a drag or a lean stays a tilt", () => {
    expect(pure.packLateTap(TILT.holdMs, 0, 1, TILT)).toBe(false);
    expect(pure.packLateTap(40, TILT.dragPx, 1, TILT)).toBe(false);
    expect(pure.packLateTap(40, 0, 2, TILT)).toBe(false);
    expect(pure.packLateTap(-5, 0, 1, TILT)).toBe(false);
  });
  it("the release asks it, and every tap or swipe is timed by the events' own timestamps", () => {
    expect(PACK_PAGE_RUNTIME_SOURCE).toMatch(/packLateTap\(e\.timeStamp - p\.down/);
    const calls = PACK_PAGE_RUNTIME_SOURCE.match(/packGesture\([^;]*\)/g) ?? [];
    expect(calls.length).toBe(3);
    for (const c of calls) expect(c, c).toContain("pressMs(e, ");
    expect(PACK_PAGE_RUNTIME_SOURCE).not.toMatch(/packGesture\([^;]*performance\.now\(\)/);
  });
});
