// Builds the Season 1 Home (render session 86: direction B on the owner's
// uniform grid) from the snapshot of the Season 0 site demo's owner API
// (season1/mockup/snapshot.ts).
//   npx tsx season1/mockup/buildHome.ts      (in render/)
// Writes render/season1/output/home.html (self-contained: no outside requests).
// Mockups A, B (masonry) and C are retired; their stills stay in
// progress/render/evidence/season1-home-mockup-a-s83/ and season1-home-mockups-s84/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homePage } from "../src/home.js";
import type { HomeData } from "../src/homeFacts.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "data", "home-data.json"), "utf8")) as HomeData;
const outDir = join(here, "..", "output");
mkdirSync(outDir, { recursive: true });
const html = homePage(data);
writeFileSync(join(outDir, "home.html"), html);
console.log(`[home] wrote ${join(outDir, "home.html")} (${(html.length / 1024).toFixed(0)} KB)`);
