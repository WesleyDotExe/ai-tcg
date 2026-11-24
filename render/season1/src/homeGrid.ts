// The Season 1 Home's uniform grid (render session 86; phase 2 of the owner's
// 2026-11-22 plan, in the direction picked on 2026-11-23: mockup B "on a
// uniform grid").
//
// The owner's decisions (2026-11-23, "the Season 1 Home grid"):
//   - one square grid unit; S = 1x1, M = 2x1 (two units side by side),
//     L = 2x2; every tile is one of these, so every edge lines up;
//   - Watch live is the exception in shape, not in grid: it snaps to the same
//     unit in tall shapes. S 1x1 (basic info), M 1x2 (the arena 9:16,
//     smaller), and L "as many units as it needs to show the whole arena":
//     two units wide, and as many units high as the arena at that width
//     (9:16) plus its scoreboard, turn line, lists and button need;
//   - phones keep the earlier rule: every tile its S face, Watch live its M.
//
// What this file decides (the session's own calls, written up for the owner
// in progress/render/checkpoints.md):
//   - the unit is a square near 200 px: the board takes as many columns as
//     fit at a unit of at least 188 px, rounded down to an even number (so
//     the two-unit tiles tile without a forced hole), at least 2. A 1440 px
//     screen gets 6 columns of 218 px; 1280 gets 6 of 191; 1024 gets 4; a
//     phone 2 (the gap 12 px there, 16 px elsewhere);
//   - tiles are placed in board order, each in the first free spot that
//     holds it, scanning row by row (as CSS's dense packing does), so a small
//     tile later on fills a hole left above it. Placement is explicit (each
//     tile gets its row and column), so the page and the tests agree exactly.
//
// The layout code is one plain-JavaScript source (GRID_JS): the page embeds
// it, and this module evaluates the same text for the tests and the build, so
// what the tests check is what the browser runs.
//
// Pure: no DOM. Fenced off: nothing outside render/season1/ imports it.

import type { Size } from "./homeSpec.js";

/** The grid's constants (px). */
export const GRID = {
  /** The smallest a unit may be on a desktop. */
  minUnit: 188,
  gap: 16,
  phoneGap: 12,
  /** Phones (the same breakpoint as the mockups): two columns. */
  phoneMax: 720,
  phoneCols: 2,
  /** The tile's inner padding (top + bottom) and the parts above and below a
   * Watch live arena, for its L height (measured in the browser check). */
  padY: 28,
  padX: 32,
  /** Watch live L, around the arena: header, scoreboard, the also-live and
   * play-by-play lists, the button, and the gaps between them. */
  watchChrome: 318,
} as const;

/** The layout code the page runs (plain JavaScript; no imports). */
export const GRID_JS = String.raw`
function columnsFor(width, phone, G) {
  // width: the board's own width in px.
  const gap = phone ? G.phoneGap : G.gap;
  let cols = phone ? G.phoneCols : Math.floor((width + gap) / (G.minUnit + gap));
  if (!phone) cols = Math.max(2, cols - (cols % 2));
  const unit = Math.floor(((width - gap * (cols - 1)) / cols) * 100) / 100;
  return { cols, unit, gap };
}
function watchArena(unit, gap, G) {
  // Watch live L: two units wide; the arena fills the tile's width at 9:16.
  const w = 2 * unit + gap - G.padX;
  const h = (w * 16) / 9;
  const need = G.padY + G.watchChrome + h;
  const rows = Math.max(2, Math.ceil((need + gap) / (unit + gap)));
  return { rows, arenaW: Math.floor(w), arenaH: Math.floor(h), tileH: rows * unit + (rows - 1) * gap };
}
function shapeOf(tile, size, unit, gap, G) {
  if (tile === 'watch') {
    if (size === 'S') return { w: 1, h: 1 };
    if (size === 'M') return { w: 1, h: 2 };
    return { w: 2, h: watchArena(unit, gap, G).rows };
  }
  return size === 'S' ? { w: 1, h: 1 } : size === 'M' ? { w: 2, h: 1 } : { w: 2, h: 2 };
}
function packBoard(items, cols) {
  // items: [{ w, h }] in board order. First free spot, row by row.
  const taken = [];
  const free = (x, y, w, h) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (taken[j] && taken[j][i]) return false;
    return true;
  };
  const out = [];
  let rows = 0;
  for (const it of items) {
    const w = Math.min(it.w, cols), h = it.h;
    let at = null;
    for (let y = 0; !at; y++) for (let x = 0; x + w <= cols; x++) if (free(x, y, w, h)) { at = { x, y }; break; }
    for (let j = at.y; j < at.y + h; j++) { taken[j] = taken[j] || []; for (let i = at.x; i < at.x + w; i++) taken[j][i] = true; }
    out.push({ x: at.x, y: at.y, w, h });
    rows = Math.max(rows, at.y + h);
  }
  let holes = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (!(taken[j] && taken[j][i])) holes++;
  return { placed: out, rows, holes };
}
`;

export interface Columns { cols: number; unit: number; gap: number }
export interface Shape { w: number; h: number }
export interface Placed { x: number; y: number; w: number; h: number }
export interface Packing { placed: Placed[]; rows: number; holes: number }

const api = new Function(`${GRID_JS}; return { columnsFor, watchArena, shapeOf, packBoard };`)() as {
  columnsFor(width: number, phone: boolean, G: typeof GRID): Columns;
  watchArena(unit: number, gap: number, G: typeof GRID): { rows: number; arenaW: number; arenaH: number; tileH: number };
  shapeOf(tile: string, size: Size, unit: number, gap: number, G: typeof GRID): Shape;
  packBoard(items: Shape[], cols: number): Packing;
};

/** How many columns and how big a unit, for a board this wide. */
export const columnsFor = (width: number, phone = false): Columns => api.columnsFor(width, phone, GRID);
/** Watch live L at this unit: its rows and its arena's size. */
export const watchArena = (unit: number, gap: number = GRID.gap) => api.watchArena(unit, gap, GRID);
/** A tile's shape in units. */
export const shapeOf = (tile: string, size: Size, unit: number, gap: number = GRID.gap): Shape => api.shapeOf(tile, size, unit, gap, GRID);
/** Place a board's tiles on the grid. */
export const packBoard = (items: Shape[], cols: number): Packing => api.packBoard(items, cols);

/** A whole board laid out at a board width (what the page does). */
export function layout(board: { tile: string; size: Size }[], width: number, phone = false) {
  const c = columnsFor(width, phone);
  const shapes = board.map((b) => shapeOf(b.tile, b.size, c.unit, c.gap));
  return { ...c, ...packBoard(shapes, c.cols), shapes };
}

/** The board's width for a window this wide (main's padding and its cap;
 * the same numbers as the page's CSS). */
export function boardWidth(viewport: number): number {
  const phone = viewport <= GRID.phoneMax;
  return Math.min(viewport, 1440) - (phone ? 28 : 52);
}
