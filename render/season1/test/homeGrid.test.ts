// The Season 1 Home's uniform grid (render session 86; the owner's
// 2026-11-23 decision: one square unit, S 1x1, M 2x1, L 2x2, Watch live in
// tall shapes, its L as many units as the whole 9:16 arena needs).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { GRID, GRID_JS, boardWidth, columnsFor, layout, packBoard, shapeOf, watchArena } from "../src/homeGrid.js";
import { GRID_BOARDS, GRID_RECOMMENDED, gridTileHtml, homePage } from "../src/homePage.js";
import { TILES, type Size } from "../src/homeSpec.js";
import { factsIn, featured, type HomeData } from "../src/homeFacts.js";

const data = JSON.parse(readFileSync(join(import.meta.dirname, "..", "mockup", "data", "home-data.json"), "utf8")) as HomeData;
const nova = data.owners.nova!, wren = data.owners.wren!;
const SIZES: Size[] = ["S", "M", "L"];

describe("the grid's columns and unit", () => {
  it("fits as many square units of at least 188 px as the board holds, an even number, at least 2", () => {
    expect(columnsFor(boardWidth(1440))).toEqual({ cols: 6, unit: 218, gap: 16 });
    expect(columnsFor(boardWidth(1280)).cols).toBe(6);
    expect(columnsFor(boardWidth(1024))).toEqual({ cols: 4, unit: 231, gap: 16 });
    for (let w = 300; w <= 1440; w += 7) {
      const c = columnsFor(w);
      expect(c.cols % 2, `${w}`).toBe(0);
      expect(c.cols).toBeGreaterThanOrEqual(2);
      if (c.cols > 2) expect(c.unit, `${w}`).toBeGreaterThanOrEqual(GRID.minUnit);
      // The columns and gaps fill the board, no more.
      expect(c.cols * c.unit + (c.cols - 1) * c.gap).toBeLessThanOrEqual(w + 0.01);
      expect(c.cols * c.unit + (c.cols - 1) * c.gap).toBeGreaterThan(w - c.cols * 0.01 - 0.01);
    }
  });

  it("gives a phone two columns with a 12 px gap", () => {
    expect(columnsFor(boardWidth(390), true)).toEqual({ cols: 2, unit: 175, gap: 12 });
  });
});

describe("the shapes (owner 2026-11-23)", () => {
  it("makes S 1x1, M 2x1 and L 2x2 for every tile but Watch live", () => {
    for (const t of TILES.filter((x) => x.id !== "watch")) {
      expect(shapeOf(t.id, "S", 218)).toEqual({ w: 1, h: 1 });
      expect(shapeOf(t.id, "M", 218)).toEqual({ w: 2, h: 1 });
      expect(shapeOf(t.id, "L", 218)).toEqual({ w: 2, h: 2 });
    }
  });

  it("makes Watch live S 1x1, M 1x2, and L two units wide by the rows its whole arena needs", () => {
    expect(shapeOf("watch", "S", 218)).toEqual({ w: 1, h: 1 });
    expect(shapeOf("watch", "M", 218)).toEqual({ w: 1, h: 2 });
    for (const unit of [175, 191.33, 200, 218, 231, 260]) {
      const a = watchArena(unit);
      expect(shapeOf("watch", "L", unit)).toEqual({ w: 2, h: a.rows });
      // The arena is 9:16 at the tile's inner width ...
      expect(a.arenaW).toBe(Math.floor(2 * unit + GRID.gap - GRID.padX));
      expect(a.arenaH / a.arenaW).toBeCloseTo(16 / 9, 1);
      // ... and the rows hold it and its parts, with less than a unit to spare.
      const need = GRID.padY + GRID.watchChrome + a.arenaH;
      expect(a.tileH).toBeGreaterThanOrEqual(need);
      expect(a.tileH - (unit + GRID.gap)).toBeLessThan(need + 1);
    }
    expect(watchArena(218).rows).toBe(5);
  });
});

describe("placing a board", () => {
  it("puts each tile in the first free spot, row by row, so a later small tile fills a hole", () => {
    const p = packBoard([{ w: 2, h: 1 }, { w: 2, h: 2 }, { w: 1, h: 1 }, { w: 1, h: 1 }], 3);
    expect(p.placed).toEqual([{ x: 0, y: 0, w: 2, h: 1 }, { x: 0, y: 1, w: 2, h: 2 }, { x: 2, y: 0, w: 1, h: 1 }, { x: 2, y: 1, w: 1, h: 1 }]);
    expect(p.rows).toBe(3);
    expect(p.holes).toBe(1);
  });

  it("never overlaps two tiles, on any board at any width", () => {
    const rnd = (() => { let s = 7; return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31); })();
    for (let k = 0; k < 300; k++) {
      const board = [...TILES].sort(() => rnd() - 0.5).map((t) => ({ tile: t.id, size: SIZES[Math.floor(rnd() * 3)]! }));
      const l = layout(board, 300 + Math.floor(rnd() * 1100));
      const cells = new Set<string>();
      l.placed.forEach((p, i) => {
        expect(p.x + p.w).toBeLessThanOrEqual(l.cols);
        expect(p.w).toBe(Math.min(l.shapes[i]!.w, l.cols));
        for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
          expect(cells.has(`${x},${y}`)).toBe(false);
          cells.add(`${x},${y}`);
        }
      });
      expect(cells.size + l.holes).toBe(l.cols * l.rows);
    }
  });

  it("packs the recommended board with no hole at 1440, 1280 and 1024 px, the agent and the match first", () => {
    expect(GRID_RECOMMENDED.slice(0, 2).map((b) => b.tile)).toEqual(["agent", "watch"]);
    const decided = TILES.filter((t) => t.status === "decided").map((t) => t.id).sort();
    expect(GRID_RECOMMENDED.map((b) => b.tile).sort()).toEqual(decided);
    for (const vw of [1440, 1280, 1024]) {
      const l = layout(GRID_RECOMMENDED, boardWidth(vw));
      expect(l.holes, `${vw}`).toBe(0);
    }
    expect(layout(GRID_RECOMMENDED, boardWidth(1440)).rows).toBe(4);
    for (const s of SIZES) expect(GRID_BOARDS[s]!.every((b) => b.size === s)).toBe(true);
  });
});

describe("the Season 1 Home page (B on the grid)", () => {
  const html = homePage(data);

  it("runs the same layout code the tests run, light by default", () => {
    expect(html).toContain(`<script>${GRID_JS}</script>`);
    expect(html).toContain('<html lang="en" data-theme="light">');
    expect(html).toMatch(/"theme":"light"/);
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toMatch(/class="[^"]*mgrid/); // no masonry: fixed shapes
  });

  it("draws exactly the spec's facts in each tile at each size, one next action each", () => {
    for (const t of TILES) for (const s of SIZES) for (const d of [nova, wren]) {
      const h = gridTileHtml(t.id, s, d);
      expect([...factsIn(h)].sort(), `${t.id} ${s}`).toEqual([...t.sizes[s]].sort());
      expect(/<footer>([\s\S]*?)<\/footer>/.exec(h)![1]!.match(/<button/g), `${t.id} ${s}`).toHaveLength(1);
      expect(h).toContain('class="qb"');
    }
  });

  it("puts Watch live's Live badge beside Watch at S and in the header at L, none at M", () => {
    expect(featured(nova)).not.toBeNull();
    const at = (s: Size) => gridTileHtml("watch", s, nova);
    expect(/<footer>[\s\S]*data-live/.test(at("S"))).toBe(true);
    expect(/<header>[\s\S]*data-live[\s\S]*<\/header>/.test(at("L"))).toBe(true);
    expect(at("M")).not.toContain("data-live");
  });

  it("is fenced off: nothing outside render/season1 names the grid or the page", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (f === "node_modules" || f === "output" || f === "season1") continue;
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|mjs|js|html)$/.test(f) && /homeGrid\.js|homePage\.js|season1\/output\/home\.html/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(join(import.meta.dirname, "..", ".."));
    expect(hits).toEqual([]);
  });
});
