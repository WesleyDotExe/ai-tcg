// Builds the Season 1 Home, phase 2 (render session 86): mockup B on the
// uniform grid, from the same snapshot of the Season 0 site demo's owner API
// as the mockups (season1/mockup/snapshot.ts).
//   npx tsx season1/mockup/buildHome.ts      (in render/)
// Writes render/season1/output/home.html (self-contained: no outside requests).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homePage } from "../src/homePage.js";
import type { HomeData } from "../src/homeFacts.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "data", "home-data.json"), "utf8")) as HomeData;
const out = join(here, "..", "output", "home.html");
mkdirSync(dirname(out), { recursive: true });
const html = homePage(data);
writeFileSync(out, html);
console.log(`[home] wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
