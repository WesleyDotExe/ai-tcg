// One tile drawn in many states at S, M and L, on the grid's three units
// (render session 88 built it for My agent; render session 89 made it
// shared so the Ladder tile has its sheet too). The Home snapshot holds two
// owners, so most of a tile's states never reach the Home page; a sheet
// draws each one so the browser check (ci/tile-states-check.mjs) can
// measure that it fits its box, spills nothing, and reads on the glass.
//
// Pure: data in, an HTML string out. Fenced off: nothing outside
// render/season1/ imports it.

import { esc } from "../../src/site/siteModel.js";
import type { Size } from "./homeSpec.js";
import { homeArt, type OwnerData } from "./homeFacts.js";
import { bCss } from "./homeMockupB.js";
import { GRID } from "./homeGrid.js";
import { GRID_CSS, gridTileHtml } from "./homePage.js";

export interface StateCase { id: string; name: string; data: OwnerData }

/** The unit (px) the grid gives at each screen the checks measure. */
export const STATE_UNITS = [
  { screen: 1280, unit: 191 },
  { screen: 1440, unit: 218 },
  { screen: 1024, unit: 231 },
] as const;

const SIZES: Size[] = ["S", "M", "L"];

/** Deep-copy an owner's answer, then change it as the API documents. */
export const from = (base: OwnerData, f: (d: OwnerData) => void): OwnerData => {
  const d = JSON.parse(JSON.stringify(base)) as OwnerData;
  f(d);
  return d;
};

export function statesSheet(o: { tile: string; title: string; session: number; cases: StateCase[]; note: (c: StateCase) => string }): string {
  const art = homeArt();
  const sections = STATE_UNITS.map(({ screen, unit }) =>
    `<h2>Unit ${unit}px (the grid at ${screen} px wide)</h2>` +
    o.cases.map((c) => {
      // S at column 1, M at 2-3, L at 4-5 (rows 1-2): the grid's own shapes.
      const place: Record<Size, string> = { S: "1 / 1 / 2 / 2", M: "1 / 2 / 2 / 4", L: "1 / 4 / 3 / 6" };
      return `<section class="case" data-case="${c.id}" data-unit="${unit}"><h3>${esc(c.name)} <small>${esc(o.note(c))}</small></h3>` +
        `<div class="ugrid" style="--cols:5;--unit:${unit}px;--g:${GRID.gap}px">` +
        SIZES.map((s) => gridTileHtml(o.tile, s, c.data).replace(`style="--c:`, `style="grid-area:${place[s]};--c:`)).join("") +
        `</div></section>`;
    }).join("")).join("");
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)} states</title>
<style>
${bCss(art)}
${GRID_CSS}
main { max-width: none; }
h2 { font: 800 18px system-ui, sans-serif; margin: 28px 0 6px; }
.case { margin: 10px 0 22px; }
.case h3 { font: 700 13px system-ui, sans-serif; margin: 0 0 6px; } .case h3 small { color: var(--muted); font-weight: 600; }
</style></head><body>
<main id="main"><div class="top"><div><span class="kick">// prototype sheet</span><h1>${esc(o.title)}, every state</h1></div></div>
<p class="sub">Season 1 Home, render session ${o.session}. Each row is one state the owner API can serve, drawn at S, M and L on the grid's unit. Not a page of the site.</p>
${sections}</main>
${art.defs}
<script>${art.script}</script>
</body></html>`;
}
