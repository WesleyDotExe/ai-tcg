// Render session 67: the Watch live tile's arena, the parts without a
// browser (which match it holds, how the frame is scaled). The redraw around
// the frame (patchAround) is checked in a real browser:
// progress/render/evidence/watch-arena-check-s67.mjs.
import { describe, expect, it } from "vitest";
import { TILE_ARENA_HOLD_END_MS, TILE_ARENA_HOLD_GONE_MS, TILE_ARENA_W, arenaFit, arenaPick, type HeldArena } from "../src/site/siteTileArena.js";
import { renderMatchHtml } from "../src/renderHtml.js";

const H = (o: Partial<HeldArena> = {}): HeldArena => ({ matchId: "a", ended: false, endedAt: null, goneAt: null, ...o });

describe("which match the tile's arena shows", () => {
  it("nothing held: the first live match; nothing live: none", () => {
    expect(arenaPick(null, ["a", "b"], 0)).toEqual({ matchId: "a", ended: false });
    expect(arenaPick(null, [], 0)).toBeNull();
  });
  it("the held match while it is live, even when it is no longer first", () => {
    expect(arenaPick(H({ matchId: "b" }), ["a", "b"], 0)).toEqual({ matchId: "b", ended: false });
  });
  it("gone from the list: held (as over) until its feed's end plus the hold, then the next", () => {
    const t = 1_000_000;
    const ended = H({ ended: true, endedAt: t, goneAt: t });
    expect(arenaPick(ended, ["b"], t + TILE_ARENA_HOLD_END_MS - 1)).toEqual({ matchId: "a", ended: true });
    expect(arenaPick(ended, ["b"], t + TILE_ARENA_HOLD_END_MS)).toEqual({ matchId: "b", ended: false });
    expect(arenaPick(ended, [], t + TILE_ARENA_HOLD_END_MS)).toBeNull();
  });
  it("gone with no word from its feed (an expired page): held at most the longer hold", () => {
    const t = 5_000;
    const gone = H({ goneAt: t });
    expect(arenaPick(gone, ["b"], t + TILE_ARENA_HOLD_GONE_MS - 1)).toEqual({ matchId: "a", ended: true });
    expect(arenaPick(gone, ["b"], t + TILE_ARENA_HOLD_GONE_MS)).toEqual({ matchId: "b", ended: false });
    // Not yet stamped (the first read that misses it): held.
    expect(arenaPick(H(), ["b"], t)).toEqual({ matchId: "a", ended: true });
  });
});

describe("the frame's fit", () => {
  it("laid out at the arena's own width and scaled to the slot exactly", () => {
    expect(TILE_ARENA_W).toBe(1180);
    expect(arenaFit(590, 350)).toEqual({ width: 1180, height: 700, scale: 0.5 });
    const f = arenaFit(760, 420);
    expect(f.width * f.scale).toBeCloseTo(760, 6);
    expect(Math.abs(f.height * f.scale - 420)).toBeLessThan(1);
    expect(arenaFit(0, 0)).toEqual({ width: 1180, height: 1, scale: 1 });
  });
});

describe("the arena's embed mode", () => {
  it("is in the page: framed with embed=1 only; sound and music never mounted; the tile can set the side", () => {
    const html = renderMatchHtml({ title: "t", seed: 0, frames: [] } as never, { live: true });
    expect(html).toContain("const EMBED = FRAMED && viewHash.embed === '1';");
    expect(html).toContain("if (!EMBED) SND.mount(");
    expect(html).toContain("if (!EMBED) MUS.mount(");
    expect(html).toContain("e.data.type !== 'ai-tcg-set-view'");
    expect(html).toMatch(/body\.embed \.controls, body\.embed #eventlog/);
  });
});
