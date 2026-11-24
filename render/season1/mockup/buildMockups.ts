// Builds Season 1 Home mockup B (render session 84), the direction the owner
// picked, from the snapshot of the Season 0 site demo's owner API
// (season1/mockup/snapshot.ts). Mockups A and C and the side-by-side page
// were retired in render session 86 (their stills stay in
// progress/render/evidence/season1-home-mockup-a-s83/ and
// season1-home-mockups-s84/). The Home built on the grid is buildHome.ts.
//   npx tsx season1/mockup/buildMockups.ts      (in render/)
// Writes render/season1/output/home-mockup-b.html (self-contained).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mockupBPage } from "../src/homeMockupB.js";
import type { HomeData } from "../src/homeFacts.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "data", "home-data.json"), "utf8")) as HomeData;
const outDir = join(here, "..", "output");
mkdirSync(outDir, { recursive: true });
for (const [name, html] of [["home-mockup-b.html", mockupBPage(data)]] as const) {
  writeFileSync(join(outDir, name), html);
  console.log(`[mockups] wrote ${join(outDir, name)} (${(html.length / 1024).toFixed(0)} KB)`);
}
