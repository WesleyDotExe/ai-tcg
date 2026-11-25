// The Season 1 Home grid (render session 86; owner 2026-11-23, "the Season 1
// Home grid (mockup B)": one square grid unit; S = 1x1, M = 2x1, L = 2x2;
// Watch live snaps to the same unit in tall shapes: M 1x2, S 1x1, and at L "as
// many units as it needs to show the whole arena", 9:16).
//
// This replaces mockup B's masonry (render 84), which the owner overruled on
// 2026-11-23 ("every tile fits one uniform tile size ratio, so all tiles line
// up regardless of whether they are S, M or L").
//
// The layout is written once, as plain browser JavaScript (GRID_JS), so the
// page places its tiles with exactly the code the tests run: `homeGrid()`
// evaluates the same source in Node. Nothing here touches the DOM.
//
//   - columns: 4 on a desktop (wider than 1180 px), 2 on a tablet, 1 on a phone
//     (720 px and under). A phone shows every tile's S face and Watch live its
//     M (the owner's earlier rule, kept on 2026-11-23); two columns of 175 px
//     squares were tried first in render 86 and could not hold an S face's
//     facts legibly (Daily rewards' three facts ran over its button), so a
//     phone's square is the screen's width;
//   - the unit is square: (board width - gaps) / columns, so a tile's height in
//     px is set by the width it has, and every edge lines up;
//   - a shape never runs wider than the board (on two columns an L is the
//     whole width), and Watch live's L is one unit narrower than the board on
//     two columns, so its 9:16 arena stays about a screen tall on a tablet;
//   - Watch live's L height is counted from the arena: the tile's chrome
//     (padding, header, scoreboard, footer, the gaps between them) plus the
//     arena at the tile's full inner width and 9:16, rounded up to whole units;
//   - placement is first fit, row by row from the top-left, in board order,
//     and a later small tile may fill an earlier hole (CSS's "dense" rule):
//     the packer gives every tile its column and row, and the page sets them.
//
// Fenced off: nothing outside render/season1/ imports it.

import type { Size } from "./homeSpec.js";

export interface Shape { w: number; h: number }
export interface Placed { tile: string; size: Size; col: number; row: number; w: number; h: number }
export interface GridLayout { cols: number; rows: number; placed: Placed[] }
/** The px a Watch live tile spends outside its arena (`WATCH_CHROME_PX`). */
export interface Chrome { padY: number; padX: number; header: number; score: number; footer: number; gaps: number }

/** Plain browser JavaScript: defines `HOME_GRID`. The page inlines it; the
 * tests evaluate it. Keep it ES2020 and self-contained. */
export const GRID_JS = String.raw`var HOME_GRID = (function () {
  var SHAPES = { S: { w: 1, h: 1 }, M: { w: 2, h: 1 }, L: { w: 2, h: 2 } };
  var WATCH = { S: { w: 1, h: 1 }, M: { w: 1, h: 2 } };
  // The Watch live tile's chrome at L, in px (the page's CSS draws to these).
  var CHROME = { padY: 14, padX: 16, header: 30, score: 64, footer: 38, gaps: 3 * 8 };
  function cols(width) { return width > 1180 ? 4 : width > 720 ? 2 : 1; }
  function unit(boardWidth, n, gap) { return (boardWidth - (n - 1) * gap) / n; }
  // How many units tall Watch live's L must be to show the whole 9:16 arena
  // at the tile's full inner width.
  function watchRows(w, u, gap, chrome) {
    var c = chrome || CHROME;
    var inner = w * u + (w - 1) * gap - 2 * c.padX;
    var need = 2 * c.padY + c.header + c.score + c.footer + c.gaps + inner * 16 / 9;
    return Math.max(2, Math.ceil((need + gap) / (u + gap)));
  }
  function watchWidth(n) { return n >= 4 ? 2 : 1; }
  function shape(tile, size, n, u, gap) {
    if (tile === 'watch') {
      if (size !== 'L') return WATCH[size];
      var w = watchWidth(n);
      return { w: w, h: watchRows(w, u, gap) };
    }
    var s = SHAPES[size];
    return { w: Math.min(s.w, n), h: s.h };
  }
  // First fit, row by row from the top-left, in board order (dense).
  function pack(board, n, u, gap) {
    var used = [];
    var free = function (r, c, w, h) {
      if (c + w > n) return false;
      for (var y = r; y < r + h; y++) for (var x = c; x < c + w; x++) if (used[y] && used[y][x]) return false;
      return true;
    };
    var placed = board.map(function (b) {
      var s = shape(b.tile, b.size, n, u, gap);
      for (var r = 0; ; r++) for (var c = 0; c < n; c++) if (free(r, c, s.w, s.h)) {
        for (var y = r; y < r + s.h; y++) { used[y] = used[y] || []; for (var x = c; x < c + s.w; x++) used[y][x] = b.tile; }
        return { tile: b.tile, size: b.size, col: c, row: r, w: s.w, h: s.h };
      }
    });
    return { cols: n, rows: used.length, placed: placed };
  }
  return { SHAPES: SHAPES, WATCH: WATCH, CHROME: CHROME, cols: cols, unit: unit, watchRows: watchRows, watchWidth: watchWidth, shape: shape, pack: pack };
})();`;

export interface HomeGrid {
  SHAPES: Record<Size, Shape>;
  WATCH: Record<"S" | "M", Shape>;
  CHROME: Chrome;
  cols(width: number): number;
  unit(boardWidth: number, cols: number, gap: number): number;
  watchRows(w: number, unit: number, gap: number, chrome?: Chrome): number;
  watchWidth(cols: number): number;
  shape(tile: string, size: Size, cols: number, unit: number, gap: number): Shape;
  pack(board: { tile: string; size: Size }[], cols: number, unit: number, gap: number): GridLayout;
}

let cached: HomeGrid | null = null;
/** The page's own grid code, run here (the tests' handle on it). */
export function homeGrid(): HomeGrid {
  cached ??= new Function(`${GRID_JS}; return HOME_GRID;`)() as HomeGrid;
  return cached;
}

/** The board's gap between tiles, px (desktop and tablet; a phone's is 12). */
export const GRID_GAP = 16;
export const PHONE_GAP = 12;
