// Board rows fit the screen (render/src/boardFit.ts, render session 20).
// The six slots used to wrap 5 + 1 at 768 px and 2 + 2 + 2 on a phone. The
// rule: one line, zoomed, while the cards stay at least MIN_LINE_ZOOM of
// their size; two framed lines of three below that; never scaled up. The
// widths here are the side's width (viewport minus the page's 24 px of
// padding), with the page's gaps (8 px, 6 px below 560 px). The browser
// side is checked in headless Chromium (progress/render/evidence/
// board-fit-check.txt); the pins below keep the page wired to this module.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck } from "@ai-tcg/engine";
import { LookaheadAgent } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import { BOARD_FIT_SOURCE, MIN_LINE_ZOOM, TWO_LINE_FRAME, boardFit, ghostPlacement, labelScale, lineWidth } from "../src/boardFit.js";

const SLOTS = 6;

describe("boardFit", () => {
  it("leaves a row that fits alone, and never scales up", () => {
    expect(lineWidth(SLOTS, 8)).toBe(748);
    for (const avail of [756, 900, 1156, 4000]) expect(boardFit(avail, SLOTS, 8)).toEqual({ zoom: 1, perLine: 6, lines: 1 });
  });

  it("keeps six on one line from a 600 px screen up, zoomed to fit", () => {
    for (const viewport of [600, 680, 768]) {
      const avail = viewport - 24;
      const fit = boardFit(avail, SLOTS, 8);
      expect(fit.lines).toBe(1);
      expect(fit.perLine).toBe(6);
      expect(fit.zoom).toBeGreaterThanOrEqual(MIN_LINE_ZOOM);
      expect(fit.zoom).toBeLessThan(1);
      // It fits, with room left for the browser's rounding.
      expect(lineWidth(6, 8) * fit.zoom).toBeLessThanOrEqual(avail - 3);
    }
  });

  it("splits into two lines of three on a phone, framed, without wrapping a third", () => {
    for (const viewport of [360, 390, 430, 540]) {
      const avail = viewport - 24;
      const fit = boardFit(avail, SLOTS, 6);
      expect(fit).toMatchObject({ lines: 2, perLine: 3 });
      expect((lineWidth(3, 6) + TWO_LINE_FRAME) * fit.zoom).toBeLessThanOrEqual(avail - 3);
    }
    // Three full-size cards fit from about 410 px, so a phone that wide
    // shows them unscaled.
    expect(boardFit(430 - 24, SLOTS, 6).zoom).toBe(1);
    expect(boardFit(360 - 24, SLOTS, 6).zoom).toBeGreaterThan(0.85);
  });

  it("switches at the readable floor, not before", () => {
    // Just above the floor: one line. Just below: two.
    const floor = Math.ceil(lineWidth(6, 8) * MIN_LINE_ZOOM) + 4;
    expect(boardFit(floor + 1, SLOTS, 8).lines).toBe(1);
    expect(boardFit(floor - 2, SLOTS, 8).lines).toBe(2);
  });

  it("handles odd and degenerate inputs", () => {
    expect(boardFit(0, SLOTS, 8)).toEqual({ zoom: 1, perLine: 6, lines: 1 });
    expect(boardFit(Number.NaN, SLOTS, 8)).toEqual({ zoom: 1, perLine: 6, lines: 1 });
    expect(boardFit(300, 5, 8)).toMatchObject({ lines: 2, perLine: 3 });
    expect(boardFit(60, 1, 8)).toMatchObject({ lines: 1, perLine: 1 });
  });
});

describe("ghostPlacement", () => {
  it("gives a ghost the card's zoom and unscales its position", () => {
    const g = ghostPlacement({ left: 200, top: 300, width: 118 * 0.8 });
    expect(g.zoom).toBeCloseTo(0.8, 6);
    // Zoomed left/top are themselves scaled, so this lands back on 200, 300.
    expect(g.left * g.zoom).toBeCloseTo(200, 6);
    expect(g.top * g.zoom).toBeCloseTo(300, 6);
  });

  it("leaves a full-size card alone", () => {
    expect(ghostPlacement({ left: 10, top: 20, width: 118 })).toEqual({ zoom: 1, left: 10, top: 20 });
    expect(ghostPlacement({ left: 10, top: 20, width: 0 })).toEqual({ zoom: 1, left: 10, top: 20 });
  });
});

describe("labelScale (render session 23)", () => {
  it("shrinks a label with its card's zoom, and never grows it", () => {
    expect(labelScale({ left: 0, top: 0, width: 118 * MIN_LINE_ZOOM })).toBeCloseTo(MIN_LINE_ZOOM, 6);
    expect(labelScale({ left: 0, top: 0, width: 85 })).toBeCloseTo(85 / 118, 6);
    expect(labelScale({ left: 0, top: 0, width: 118 })).toBe(1);
    // A card hovered larger, or a rect with no width, keeps full size.
    expect(labelScale({ left: 0, top: 0, width: 160 })).toBe(1);
    expect(labelScale({ left: 0, top: 0, width: 0 })).toBe(1);
  });

  it("snaps to the nearest row zoom, so a card mid hit-flash doesn't skew it", () => {
    // Seen in the browser check: ON HIT tags at 0.772 on a 0.737 row.
    expect(labelScale({ left: 0, top: 0, width: 118 * 0.772 }, [0.737, 0.737])).toBe(0.737);
    expect(labelScale({ left: 0, top: 0, width: 118 * 0.9 }, [0.737, 1])).toBe(1);
    expect(labelScale({ left: 0, top: 0, width: 118 * 0.8 }, [0.737, 1])).toBe(0.737);
  });
});

describe("the page", () => {
  it("embeds the module, fits the rows at load and on resize, and zooms the ghost", async () => {
    const r = await captureMatch({
      title: "plain", seed: 1, deckA: buildCortexDeck("p1", "C"), deckB: buildAegisDeck("p2", "A"),
      agentA: new LookaheadAgent("A", 3), agentB: new LookaheadAgent("B", 4), boardSlots: BOARD_SLOTS,
    });
    const html = renderMatchHtml(r);
    expect(html).toContain(BOARD_FIT_SOURCE);
    expect(html).toContain("const fit = boardFit(side.clientWidth, frames[0].players[pid].slotsMax, gap);");
    expect(html).toContain("fitBoards();\n  renderFrame();");
    expect(html).toContain("window.addEventListener('resize', function () { fitBoards(); drawAimLines(frames[i], {}); });");
    expect(html).toContain("const gp = ghostPlacement(rect);");
    // The ghost no longer squeezes a 118 px card into a smaller box.
    expect(html).not.toContain("cardEl.style.width = rect.width + 'px';");
    expect(html).toContain(".board-row.two-line { margin: 2px auto; padding: 6px;");
    // Floating labels over a card shrink with it; over a player they don't.
    expect(html).toContain("const z = onCard ? cardLabelScale(rect) : 1;");
    expect(html).toContain("spawnNumber(el.getBoundingClientRect(), String(residual), 'dmg', t, 0, true);");
    expect(html).toContain("centreOn(spawnNumber(landR, text, numCls, tier), landR);");
    expect(html).toContain("const z = fx.anchor === 'card' ? cardLabelScale(rect) : 1;");
  }, 60_000);
});
