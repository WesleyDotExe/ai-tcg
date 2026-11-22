// Builds Season 1 Home mockups B and C (render session 84) and the
// side-by-side comparison page, from the same snapshot of the Season 0 site
// demo's owner API as mockup A (season1/mockup/snapshot.ts).
//   npx tsx season1/mockup/buildMockups.ts      (in render/)
// Writes render/season1/output/home-mockup-b.html, home-mockup-c.html and
// home-compare.html (self-contained: no outside requests). Mockup A is built
// by buildMockupA.ts.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mockupBPage } from "../src/homeMockupB.js";
import { mockupCPage } from "../src/homeMockupC.js";
import { comparePage } from "../src/homeCompare.js";
import type { HomeData } from "../src/homeFacts.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "data", "home-data.json"), "utf8")) as HomeData;
const outDir = join(here, "..", "output");
mkdirSync(outDir, { recursive: true });
for (const [name, html] of [["home-mockup-b.html", mockupBPage(data)], ["home-mockup-c.html", mockupCPage(data)], ["home-compare.html", comparePage(data)]] as const) {
  writeFileSync(join(outDir, name), html);
  console.log(`[mockups] wrote ${join(outDir, name)} (${(html.length / 1024).toFixed(0)} KB)`);
}
