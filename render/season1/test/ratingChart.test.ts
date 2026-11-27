// The Ladder tile's "Rating, 30 days" chart (render session 92, owner
// 2026-11-28 point 8): tier names off the line, no straight drop unless the
// data has one, and then a step with its value. The browser half of the
// check (in screen px, at every unit) is ci/tile-states-check.mjs ladder.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { H, MIN_PLOT_PX, W, hitsLine, ratingChart, ratingChartHtml, type ChartRow } from "../src/ratingChart.js";
import type { HomeData } from "../src/homeFacts.js";
import { ladderStateCases } from "../src/ladderStates.js";

const data = JSON.parse(readFileSync(join(import.meta.dirname, "..", "mockup", "data", "home-data.json"), "utf8")) as HomeData;
const nova = data.owners.nova!;
const floors = nova.ladder.tiers.filter((t) => t.from !== null) as { tier: string; from: number }[];
const rows = (vals: (number | null)[]): ChartRow[] => vals.map((rating, i) => ({ day: `2026-11-${String(i + 1).padStart(2, "0")}`, rating, rated: rating === null ? 0 : 2 }));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

describe("the rating chart", () => {
  it("Nova as served: the line ends at the headline rating, today's fall is one step with its value", () => {
    const c = ratingChart(nova.stats.rating.chart, floors, nova.rating.rating.rating)!;
    // The snapshot's chart ends at 1724 (two more demo matches than its rating
    // read); the line ends at the tile's 1,774.
    expect(Math.round(c.last)).toBe(1774);
    expect(c.steps).toHaveLength(1);
    const s = c.steps[0]!;
    expect(s.day).toBe("2026-11-22");
    expect(Math.round(s.change)).toBe(-68);
    expect(s.label).not.toBeNull();
    // The step lands before the last point: a flat landing to the end dot.
    expect(s.x).toBeLessThan(c.end.x);
    expect(c.end.x).toBeLessThan(W);
    const html = ratingChartHtml(c, {}, esc);
    expect(html).toContain(">−68</span>");
    expect(html).toContain('title="Big days: −68 points on 22 Nov, 7 matches"');
  });

  it("the tier names sit in their own gutter, outside the plot (never on the line)", () => {
    const html = ratingChartHtml(ratingChart(nova.stats.rating.chart, floors, nova.rating.rating.rating)!, {}, esc);
    const floorsAt = html.indexOf('class="floors"'), plotAt = html.indexOf('class="plot"');
    expect(floorsAt).toBeGreaterThan(-1);
    // The names come before (and outside) the plot's span.
    expect(html.slice(floorsAt, plotAt)).toContain(">Diamond</span>");
    expect(html.slice(plotAt)).not.toContain(">Diamond</span>");
  });

  it("a quiet month has no step: every day a slope, no vertical", () => {
    const c = ratingChart(rows([1600, 1606, 1611, 1609, 1615, 1622, 1618, 1625, 1630]), floors)!;
    expect(c.steps).toHaveLength(0);
    for (let k = 1; k < c.line.length; k++) expect(c.line[k]!.x).toBeGreaterThan(c.line[k - 1]!.x);
  });

  it("x is by the day: idle days keep their width (the line is the rating over the days)", () => {
    const c = ratingChart(rows([1600, 1610, 1610, 1610, 1610, 1610, 1610, 1610, 1610, 1620]), floors)!;
    const xs = c.line.map((p) => p.x);
    const gaps = xs.slice(1).map((v, i) => v - xs[i]!);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.2);
  });

  it("a big day is a step: flat, exactly vertical, flat; the value never touches the line", () => {
    const c = ratingChart(rows([1660, 1664, 1661, 1668, 1830, 1834, 1829, 1836]), floors)!;
    expect(c.steps).toHaveLength(1);
    const s = c.steps[0]!;
    const v = c.line.findIndex((p, k) => k > 0 && p.x === c.line[k - 1]!.x);
    expect(v).toBeGreaterThan(0);
    expect(c.line[v - 1]!.y).toBeCloseTo(s.y0, 0);
    expect(c.line[v]!.y).toBeCloseTo(s.y1, 0);
    expect(s.label).not.toBeNull();
    expect(hitsLine(s.label!, c.line)).toBe(false);
  });

  it("days before the first rated row are left out; null rows don't break the line", () => {
    const c = ratingChart(rows([null, null, 1500, 1520, 1540]), floors)!;
    expect(c.line[0]!.x).toBe(0);
    expect(ratingChart(rows([null, null]), floors)).toBeNull();
  });

  it("every state on the sheet: values clear of the line, inside the plot and of each other; names never closer than a label's height", () => {
    for (const k of ladderStateCases(data)) {
      const d = k.data;
      const c = ratingChart(d.stats.rating.chart, d.ladder.tiers.filter((t) => t.from !== null) as { tier: string; from: number }[], d.rating.rating.rating);
      if (!c) continue;
      const boxes = c.steps.flatMap((s) => (s.label ? [s.label] : []));
      for (const b of boxes) {
        expect(hitsLine(b, c.line), `${k.id}`).toBe(false);
        expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, `${k.id} inside`).toBe(true);
      }
      const named = c.floors.filter((f) => f.named).map((f) => f.y).sort((a, b) => a - b);
      for (let i = 1; i < named.length; i++) expect(((named[i]! - named[i - 1]!) * MIN_PLOT_PX.h) / H, k.id).toBeGreaterThanOrEqual(12);
    }
  });
});
