// The Ladder tile's "Rating, 30 days" chart (render session 92, the hardening
// pass; owner 2026-11-28 point 8). The first chart (render 89) put each tier's
// name at the left end of its floor line, where the rating's own line often
// runs (Nova's "Diamond" sat on it), and drew one day's 118-point fall as a
// straight drop at the right-hand edge. This module lays the chart out so:
//
//   - the tier names never touch the line: they sit in a gutter of their own,
//     left of the plot, at their floor's height (the plot starts after it);
//     two names too close to read apart keep the one nearer the rating now;
//   - the line is the rating over the days: one point per Sydney day (the
//     API's `chart`, one row per day, idle days carrying the day before), x
//     by the day, so a quiet week is a flat run, not squeezed out;
//   - no near-vertical drop unless the data has one: a day whose change would
//     be drawn steeper than about 68 degrees is drawn as a step (flat, the step just after the
//     day before closed, flat across the day) with its value beside it ("−118"), placed
//     where it touches neither the line, the plot's edge nor another value;
//     at most MAX_VALUES values (the latest step's first, then the biggest),
//     each only where it fits clear, so a volatile month stays legible: a step
//     without room for its value has it in the chart's title and description;
//   - the end of the line has a dot (the rating today, the same number as the
//     tile's headline), clear of the edge.
//
// Pure: numbers in, geometry and an HTML string out. Fenced off: nothing
// outside render/season1/ imports it.

/** One row of `GET /api/stats`'s `rating.chart` (server/OWNER_API.md). */
export interface ChartRow { day: string; rating: number | null; rated: number }
export interface Floor { tier: string; from: number }

/** The plot's own units (the SVG's viewBox, stretched to the box). */
export const W = 300, H = 100;
/** Room kept clear at the plot's right end (for the end dot and a last-day step). */
export const PAD_R = 14;
/** Room kept at the top and bottom inside the plot, in points beyond the data. */
export const PAD_PTS = 40;
/** A day's change is a step when its slope, drawn on the smallest plot, rises
 * more than this over its run (about 68 degrees; the browser check fails a
 * slope over 75)... */
export const STEEP = 2.5;
/** ...and it is at least this many points (a quiet chart's 20-point day stays a slope). */
export const STEP_MIN = 25;
/** Room kept between a value and the line or another value (px). */
const CLEAR_PX = 2.5;
/** Where in the day's gap the step falls (0 = the day before's close). */
export const STEP_AT = 0.15;
/** The most step values written on the chart (the latest step's first, then
 * the biggest); the rest are in the chart's title and its description. */
export const MAX_VALUES = 4;
/** The smallest plot the chart is drawn in on the Home (px; the box is 110 px
 * tall, the plot 125 px wide on the 1280 px grid, measured in render 92): the
 * value labels are placed for it; a larger plot only makes them relatively
 * smaller, inside the same anchored region, so a place clear here is clear
 * everywhere. */
export const MIN_PLOT_PX = { w: 120, h: 110 };
/** A step's value label at 10 px bold, in px (a "−118" or "+204"). */
const LABEL_PX = { w: 30, h: 14, gap: 4 };
/** Two tier names closer than this (px, at the smallest box) keep only one. */
const NAME_GAP_PX = 12;

export interface Step { i: number; day: string; from: number; to: number; change: number; matches: number; x: number; y0: number; y1: number; label: (Box & Anchor) | null }
/** Which edges of a label face the step: "r" its right edge is held to the
 * step (the label left of it), "l" its left edge; "c" centred; "b" its bottom
 * edge held above the line's end, "t" its top below it. A larger plot shrinks
 * the label toward these edges, inside the box that was checked. */
export interface Anchor { ax: "l" | "r" | "c"; ay: "t" | "b" | "c" }
export interface Box { x: number; y: number; w: number; h: number }
export interface Chart {
  lo: number; hi: number;
  /** The line, as points in plot units (steps included: flat, vertical, flat). */
  line: { x: number; y: number }[];
  floors: { tier: string; from: number; y: number; named: boolean }[];
  steps: Step[];
  end: { x: number; y: number; rating: number };
  first: number; last: number;
}

const round = (v: number) => Math.round(v * 10) / 10;

/** Lay out the chart. `rows` is the API's series (oldest first, one per day). */
export function ratingChart(rows: ChartRow[], floors: Floor[], now?: number): Chart | null {
  const days = rows.map((r, i) => ({ ...r, i })).filter((r) => r.rating !== null) as (ChartRow & { rating: number; i: number })[];
  if (!days.length) return null;
  // One source: the line ends at the rating the tile's headline says. The
  // chart's last row is today's rating after its last rated match, so the two
  // agree on a live server; when a read lags (the snapshot's chart was taken
  // after two more demo matches than its rating), the rating wins.
  if (now !== undefined && days[days.length - 1]!.i === rows.length - 1) days[days.length - 1]!.rating = now;
  const i0 = days[0]!.i, i1 = days[days.length - 1]!.i;
  const vals = days.map((d) => d.rating);
  const lo = Math.min(...vals) - PAD_PTS, hi = Math.max(...vals) + PAD_PTS;
  const x = (i: number) => (i1 === i0 ? W - PAD_R : ((i - i0) / (i1 - i0)) * (W - PAD_R));
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;

  // Which day-to-day changes are steps: big next to the span (drawn as a
  // slope, one would look like a straight drop at this size).
  const span = hi - lo;
  const big = days.slice(1).map((d, k) => ({ k: k + 1, change: d.rating - days[k]!.rating }))
    .filter((c) => {
      // Measured in px on the smallest plot: a day's slope steeper than
      // STEEP (rise over run) and taller than 6 px reads as a straight drop.
      const dx = (MIN_PLOT_PX.w * (x(days[c.k]!.i) - x(days[c.k - 1]!.i))) / W, dy = (MIN_PLOT_PX.h * Math.abs(c.change)) / span;
      return Math.abs(c.change) >= STEP_MIN && dy > 6 && dy > STEEP * dx;
    });
  const isStep = new Set(big.map((c) => c.k));

  const line: { x: number; y: number }[] = [{ x: x(days[0]!.i), y: y(days[0]!.rating) }];
  const stepAt: { k: number; xs: number }[] = [];
  for (let k = 1; k < days.length; k++) {
    const a = days[k - 1]!, b = days[k]!;
    if (isStep.has(k)) {
      // The step is near the start of the day it happened on (just after the
      // day before closed), so the new rating holds flat across that day: at
      // the right-hand end, today's change reads as a step onto a landing,
      // not a line falling off the edge.
      const xs = x(a.i) + STEP_AT * (x(b.i) - x(a.i));
      line.push({ x: xs, y: y(a.rating) }, { x: xs, y: y(b.rating) });
      stepAt.push({ k, xs });
    }
    line.push({ x: x(b.i), y: y(b.rating) });
  }

  // Value labels: beside the step's middle, then above its higher end or below its lower end;
  // the first place clear of the line, the plot's edges and the labels placed.
  const sx = W / MIN_PLOT_PX.w, sy = H / MIN_PLOT_PX.h;
  const lw = LABEL_PX.w * sx, lh = LABEL_PX.h * sy, g = LABEL_PX.gap * sx, gy = LABEL_PX.gap * sy;
  const placed: Box[] = [];
  const floorYs = floors.filter((f) => f.from > lo && f.from < hi).map((f) => y(f.from));
  // Place the values in priority order (the latest step, then the biggest).
  const order = [...stepAt].sort((p, q) => (p.k === Math.max(...stepAt.map((z) => z.k)) ? -1 : q.k === Math.max(...stepAt.map((z) => z.k)) ? 1 : Math.abs(days[q.k]!.rating - days[q.k - 1]!.rating) - Math.abs(days[p.k]!.rating - days[p.k - 1]!.rating)));
  const labels = new Map<number, Box & Anchor>();
  for (const { k, xs } of order) {
    if (labels.size >= MAX_VALUES) break;
    const a = days[k - 1]!, b = days[k]!;
    const y0 = y(a.rating), y1 = y(b.rating), mid = (y0 + y1) / 2, top = Math.min(y0, y1), bot = Math.max(y0, y1);
    const at = (ax: Anchor["ax"], ay: Anchor["ay"], bx: number, by: number) => ({ ax, ay, x: bx, y: by, w: lw, h: lh });
    const tries: (Box & Anchor)[] = [
      at("r", "c", xs - g - lw, mid - lh / 2), // left of the step, at its middle
      at("l", "c", xs + g, mid - lh / 2), // right of it
      at("r", "b", xs - g - lw, top - gy - lh), // above its higher end, to the left
      at("l", "b", xs + g, top - gy - lh), // ... to the right
      at("r", "t", xs - g - lw, bot + gy), // below its lower end, to the left
      at("l", "t", xs + g, bot + gy), // ... to the right
      at("c", "b", xs - lw / 2, top - gy - lh), // centred above
      at("c", "t", xs - lw / 2, bot + gy), // centred below
    ];
    const pad = (t: Box): Box => ({ x: t.x - CLEAR_PX * sx, y: t.y - CLEAR_PX * sy, w: t.w + 2 * CLEAR_PX * sx, h: t.h + 2 * CLEAR_PX * sy });
    const clear = (t: Box) => inside(t) && !hitsLine(pad(t), line) && !placed.some((p) => overlaps(p, pad(t)));
    // Best clear of the tier floors' dashed lines too; clear of the line,
    // the edges and the other values is the rule.
    const label = tries.find((t) => clear(t) && !floorYs.some((fy) => fy >= t.y && fy <= t.y + t.h)) ?? tries.find(clear);
    if (!label) continue;
    placed.push(label);
    labels.set(k, { ...label, x: round(label.x), y: round(label.y), w: round(label.w), h: round(label.h) });
  }
  const steps: Step[] = stepAt.sort((p, q) => p.k - q.k).map(({ k, xs }) => {
    const a = days[k - 1]!, b = days[k]!;
    return { i: b.i, day: b.day, from: a.rating, to: b.rating, change: b.rating - a.rating, matches: b.rated, x: round(xs), y0: round(y(a.rating)), y1: round(y(b.rating)), label: labels.get(k) ?? null };
  });

  // Tier names: every floor inside the plotted span; two too close keep the
  // one nearer the rating now (the tier you're in or the next one).
  const last = vals[vals.length - 1]!;
  const inSpan = floors.filter((f) => f.from > lo && f.from < hi).map((f) => ({ ...f, y: round(y(f.from)), named: false }));
  const gapUnits = NAME_GAP_PX * sy;
  for (const f of [...inSpan].sort((p, q) => Math.abs(p.from - last) - Math.abs(q.from - last))) {
    if (!inSpan.some((o) => o.named && Math.abs(o.y - f.y) < gapUnits)) f.named = true;
  }

  return {
    lo, hi,
    line: line.map((p) => ({ x: round(p.x), y: round(p.y) })),
    floors: inSpan, steps,
    end: { x: round(x(i1)), y: round(y(last)), rating: last },
    first: vals[0]!, last,
  };
}

const inside = (b: Box) => b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Does any segment of the polyline pass through the box (edges included)? */
export function hitsLine(b: Box, line: { x: number; y: number }[]): boolean {
  for (let k = 1; k < line.length; k++) {
    const p = line[k - 1]!, q = line[k]!;
    // Sample the segment finely (the boxes are a few units wide).
    const n = Math.max(2, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 0.5));
    for (let s = 0; s <= n; s++) {
      const px = p.x + ((q.x - p.x) * s) / n, py = p.y + ((q.y - p.y) * s) / n;
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return true;
    }
  }
  return false;
}

const minus = (v: number) => (Math.round(v) > 0 ? `+${Math.round(v)}` : `−${Math.abs(Math.round(v))}`);
const pct = (v: number, of: number) => `${round((100 * v) / of)}%`;
const dayName = (day: string) => {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m! - 1]}`;
};

/** The chart's markup: the names' gutter, the plot (SVG line, floors, end dot)
 * and the step values over it. `esc` and `tierHex` come from the tile. */
export function ratingChartHtml(c: Chart, tierHex: Record<string, string>, esc: (s: string) => string): string {
  const n0 = (v: number) => Math.round(v).toLocaleString("en-AU");
  const floorLines = c.floors.map((f) => `<line x1="0" x2="${W}" y1="${f.y}" y2="${f.y}" stroke="${tierHex[f.tier]}" stroke-dasharray="3 4" opacity=".9" vector-effect="non-scaling-stroke"/>`).join("");
  const names = c.floors.filter((f) => f.named).map((f) => `<span data-tier="${esc(f.tier)}" style="top:${pct(f.y, H)};--tc:${tierHex[f.tier]}">${esc(f.tier)}</span>`).join("");
  const path = c.line.map((p, k) => `${k ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  const said = (s: Step) => `${minus(s.change)} points on ${dayName(s.day)}${s.matches ? `, ${s.matches} ${s.matches === 1 ? "match" : "matches"}` : ""}`;
  const steps = c.steps.filter((s) => s.label).map((s) => { const l = s.label!; return `<span class="stepv ${s.change < 0 ? "down" : "up"}" data-step="${s.day}" data-ax="${l.ax}" data-ay="${l.ay}" title="${said(s)}" style="left:${pct(l.ax === "r" ? l.x + l.w : l.ax === "l" ? l.x : l.x + l.w / 2, W)};top:${pct(l.ay === "b" ? l.y + l.h : l.ay === "t" ? l.y : l.y + l.h / 2, H)}">${minus(s.change)}</span>`; }).join("");
  // Every step is in the plot's title (hover) and the chart's description,
  // whether or not its value fitted on the chart.
  const title = c.steps.length ? ` title="${esc(`Big days: ${c.steps.map(said).join("; ")}`)}"` : "";
  const stepsSaid = c.steps.length ? `, ${c.steps.map((s) => `${minus(s.change)} on ${dayName(s.day)}`).join(", ")}` : "";
  return `<span class="chartbox"><span class="floors" aria-hidden="true">${names}</span><span class="plot"${title}><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="rating over 30 days, ${n0(c.first)} to ${n0(c.last)}${esc(stepsSaid)}, with the tier floors">${floorLines}<path class="rline" d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><i class="enddot" aria-hidden="true" style="left:${pct(c.end.x, W)};top:${pct(c.end.y, H)}"></i>${steps}</span></span>`;
}
