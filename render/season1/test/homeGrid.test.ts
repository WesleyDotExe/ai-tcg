// The Season 1 Home grid (render session 86; owner 2026-11-23): one square
// unit, S 1x1, M 2x1, L 2x2, Watch live S 1x1, M 1x2 and L as many units as
// its 9:16 arena needs. These run the page's own grid code (GRID_JS).
import { describe, it, expect } from "vitest";
import { GRID_GAP, homeGrid } from "../src/homeGrid.js";
import type { Size } from "../src/homeSpec.js";

const g = homeGrid();
const overlap = (a: { col: number; row: number; w: number; h: number }, b: typeof a) => a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h;

describe("the Home grid", () => {
  it("gives 4 columns on a desktop, 2 on a tablet, 1 on a phone", () => {
    expect([1440, 1181, 1180, 1024, 721, 720, 390].map(g.cols)).toEqual([4, 4, 2, 2, 2, 1, 1]);
  });

  it("makes every tile one of the owner's shapes", () => {
    const u = g.unit(1388, 4, GRID_GAP);
    expect(u).toBeCloseTo(335, 5);
    for (const [s, w, h] of [["S", 1, 1], ["M", 2, 1], ["L", 2, 2]] as const) expect(g.shape("ladder", s, 4, u, GRID_GAP)).toEqual({ w, h });
    expect(g.shape("watch", "S", 4, u, GRID_GAP)).toEqual({ w: 1, h: 1 });
    expect(g.shape("watch", "M", 4, u, GRID_GAP)).toEqual({ w: 1, h: 2 });
    expect(g.shape("watch", "L", 4, u, GRID_GAP)).toEqual({ w: 2, h: 4 });
    // Never wider than the board: on one column an M is one unit.
    expect(g.shape("ladder", "M", 1, 362, 12)).toEqual({ w: 1, h: 1 });
  });

  it("gives Watch live's L just the rows its whole 9:16 arena needs at the tile's width", () => {
    for (const [n, width] of [[4, 1388], [4, 2000], [2, 972]] as const) {
      const u = g.unit(width, n, GRID_GAP);
      const s = g.shape("watch", "L", n, u, GRID_GAP);
      const c = g.CHROME;
      const arena = (s.w * u + (s.w - 1) * GRID_GAP - 2 * c.padX) * 16 / 9;
      const chrome = 2 * c.padY + c.header + c.score + c.footer + c.gaps;
      const tall = (h: number) => h * u + (h - 1) * GRID_GAP;
      expect(tall(s.h), `${n} cols at ${width}`).toBeGreaterThanOrEqual(arena + chrome);
      expect(tall(s.h - 1), `${n} cols at ${width}: one row fewer would cut the arena`).toBeLessThan(arena + chrome);
    }
    // On two columns its L is one unit wide (a 2-wide 9:16 arena would be about three screens tall).
    expect(g.shape("watch", "L", 2, 478, GRID_GAP).w).toBe(1);
  });

  it("packs first fit, row by row, with no overlap and every tile inside the board", () => {
    const ids = ["agent", "watch", "daily", "packs", "notif", "ladder", "store", "collection", "history", "music"];
    const sizes: Size[] = ["S", "M", "L"];
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let trial = 0; trial < 200; trial++) {
      const n = [1, 2, 4][trial % 3]!;
      const board = ids.map((tile) => ({ tile, size: sizes[Math.floor(rnd() * 3)]! }));
      const u = g.unit(n === 4 ? 1388 : n === 2 ? 972 : 362, n, GRID_GAP);
      const L = g.pack(board, n, u, GRID_GAP);
      expect(L.placed.map((p) => p.tile)).toEqual(ids);
      for (const p of L.placed) {
        expect(p.col + p.w).toBeLessThanOrEqual(n);
        expect(p.row + p.h).toBeLessThanOrEqual(L.rows);
      }
      for (let i = 0; i < L.placed.length; i++) for (let j = i + 1; j < L.placed.length; j++) expect(overlap(L.placed[i]!, L.placed[j]!), `${trial}: ${L.placed[i]!.tile}/${L.placed[j]!.tile}`).toBe(false);
    }
  });

  it("lets a later small tile fill an earlier hole (dense)", () => {
    const L = g.pack([{ tile: "agent", size: "S" }, { tile: "ladder", size: "L" }, { tile: "store", size: "L" }, { tile: "daily", size: "S" }], 4, 335, GRID_GAP);
    expect(L.placed.map((p) => `${p.tile}@${p.col},${p.row}`)).toEqual(["agent@0,0", "ladder@1,0", "store@0,2", "daily@3,0"]);
  });
});
