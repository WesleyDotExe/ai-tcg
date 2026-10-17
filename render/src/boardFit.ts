// Fitting a row of board slots to the screen (render session 20; the top
// item of progress/render/quality-debt.md).
//
// A board card is a fixed 118 x 158 px box, and every board row has six
// slots (engine BOARD_SLOTS). Six cards and their gaps need 748 px. Before
// this module the rows simply wrapped when they ran out of room: 5 + 1 at
// 768 px, 3 + 3 or 2 + 2 + 2 on a phone. A wrapped row stopped reading as
// one side's line, and the two opposing rows interleaved in the middle of
// the screen.
//
// boardFit(avail, slots, gap) decides how a row is laid out in `avail`
// pixels:
//   - one line of all the slots, scaled down (CSS zoom) to fit, as long as
//     the cards stay at least MIN_LINE_ZOOM of their size (85 px wide);
//   - below that (a phone), two even lines (3 + 3), scaled only if even
//     three don't fit. The page then frames each side's two lines as one
//     block, so they still read as one side.
// It never scales up: 1 is the largest zoom.
//
// The scale is applied with CSS `zoom`, not a transform. A zoomed element
// is laid out at its zoomed size and getBoundingClientRect reports what is
// on screen, so the FX that aim at a card's rect (hits, wards, aim lines,
// the signature card's flight) follow it with no other change. The one
// exception is a card the FX copy into the fixed overlay (a dying card's
// ghost): it must carry the same zoom, or its 118 px layout is squeezed
// into a smaller box (ghostPlacement).
//
// Same single-source pattern as attackFx.ts: BOARD_FIT_SOURCE is embedded
// in the page verbatim AND evaluated here for Node callers and tests.

export interface BoardFit {
  /** CSS zoom for the row, (0, 1]. */
  zoom: number;
  /** Slots per line: all of them, or half (rounded up) on two lines. */
  perLine: number;
  /** Number of lines (1 or 2). */
  lines: number;
}

export interface GhostPlacement {
  zoom: number;
  left: number;
  top: number;
}

export const BOARD_FIT_SOURCE = `
  var BOARD_CARD_W = 118;
  var MIN_LINE_ZOOM = 0.72;
  // The frame round a two-line row (6 px padding and a 1 px border on each
  // side, renderHtml.ts .board-row.two-line). It zooms with the row.
  var TWO_LINE_FRAME = 14;
  // Room left for rounding: a zoomed border never drops below one device
  // pixel, so a row zoomed to fit exactly can still be a pixel short and
  // wrap its last card (seen at 360 px).
  var FIT_SLACK = 4;
  function lineWidth(n, gap) { return n * BOARD_CARD_W + Math.max(0, n - 1) * gap; }
  function roundZoom(z) { return Math.floor(z * 1000) / 1000; }
  function boardFit(avail, slots, gap) {
    slots = Math.max(1, slots | 0);
    if (!(avail > FIT_SLACK)) return { zoom: 1, perLine: slots, lines: 1 };
    avail -= FIT_SLACK;
    var one = avail / lineWidth(slots, gap);
    if (one >= 1) return { zoom: 1, perLine: slots, lines: 1 };
    if (one >= MIN_LINE_ZOOM || slots < 2) return { zoom: roundZoom(one), perLine: slots, lines: 1 };
    var half = Math.ceil(slots / 2);
    return { zoom: roundZoom(Math.min(1, avail / (lineWidth(half, gap) + TWO_LINE_FRAME))), perLine: half, lines: 2 };
  }
  // A card copied into the fixed FX overlay at a zoomed card's on-screen
  // rect: give it the same zoom, and the position divided by it, since a
  // zoomed element's left and top are themselves scaled.
  function ghostPlacement(rect) {
    var z = rect && rect.width > 0 ? rect.width / BOARD_CARD_W : 1;
    if (Math.abs(z - 1) < 0.005) z = 1;
    return { zoom: z, left: rect.left / z, top: rect.top / z };
  }
  // The scale for a label floated over a card at rect (render session
  // 23): a damage number, a stat label, FIZZLED, a cast tag. The labels sit
  // in the fixed overlay, outside the zoomed row, so on their own they stay
  // full size next to an 85 px card. Same measure as the ghost: the card's
  // on-screen width over its unzoomed width, never above 1. A card mid-FX
  // (a hit flash scales it up a little) measures a few percent off, so
  // when the rows' own zooms are given the nearest one is used.
  function labelScale(rect, rowZooms) {
    var z = Math.min(1, ghostPlacement(rect).zoom);
    if (!rowZooms || !rowZooms.length) return z;
    var best = rowZooms[0];
    rowZooms.forEach(function (r) { if (Math.abs(r - z) < Math.abs(best - z)) best = r; });
    return Math.min(1, best);
  }
`;

const impl = new Function(`${BOARD_FIT_SOURCE}; return { boardFit: boardFit, ghostPlacement: ghostPlacement, labelScale: labelScale, MIN_LINE_ZOOM: MIN_LINE_ZOOM, TWO_LINE_FRAME: TWO_LINE_FRAME, lineWidth: lineWidth };`)() as {
  boardFit: (avail: number, slots: number, gap: number) => BoardFit;
  ghostPlacement: (rect: { left: number; top: number; width: number }) => GhostPlacement;
  labelScale: (rect: { left: number; top: number; width: number }, rowZooms?: number[]) => number;
  MIN_LINE_ZOOM: number;
  TWO_LINE_FRAME: number;
  lineWidth: (n: number, gap: number) => number;
};

/** How a row of `slots` board slots, `gap` px apart, fits in `avail` px. */
export function boardFit(avail: number, slots: number, gap: number): BoardFit {
  return impl.boardFit(avail, slots, gap);
}

/** Where and how big to draw a fixed-overlay copy of a card shown at `rect`. */
export function ghostPlacement(rect: { left: number; top: number; width: number }): GhostPlacement {
  return impl.ghostPlacement(rect);
}

/** How much to shrink a floating label over a card shown at `rect`;
 * `rowZooms` (the board rows' zooms) snaps it to the row the card is in. */
export function labelScale(rect: { left: number; top: number; width: number }, rowZooms?: number[]): number {
  return impl.labelScale(rect, rowZooms);
}

export const MIN_LINE_ZOOM = impl.MIN_LINE_ZOOM;
/** Width the two-line row's frame adds, unzoomed. */
export const TWO_LINE_FRAME = impl.TWO_LINE_FRAME;
/** Unzoomed width of `n` cards and their gaps. */
export const lineWidth = impl.lineWidth;
