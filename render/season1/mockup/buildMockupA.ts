// Builds Season 1 Home mockup A (render session 83) from the snapshot of the
// Season 0 site demo's owner API (season1/mockup/snapshot.ts).
//   npx tsx season1/mockup/buildMockupA.ts      (in render/)
// Writes render/season1/output/home-mockup-a.html (self-contained: no
// outside requests).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mockupAPage } from "../src/homeMockupA.js";
import type { HomeData } from "../src/homeFacts.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "data", "home-data.json"), "utf8")) as HomeData;
const out = join(here, "..", "output", "home-mockup-a.html");
mkdirSync(dirname(out), { recursive: true });
const html = mockupAPage(data);
writeFileSync(out, html);
console.log(`[mockup-a] wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
