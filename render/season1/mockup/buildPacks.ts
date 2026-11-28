// Builds the Season 1 pack pages (render session 95): the three wrapper
// designs and the pick row.
//   npx tsx season1/mockup/buildPacks.ts      (in render/)
// Writes render/season1/output/pack-wrappers.html and pack-pick.html
// (self-contained: no outside requests).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packPickPage, packWrappersPage } from "../src/packWrapperPage.js";

const here = dirname(fileURLToPath(import.meta.url));
for (const [name, html] of [["pack-wrappers", packWrappersPage()], ["pack-pick", packPickPage()]] as const) {
  const out = join(here, "..", "output", `${name}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`[packs] wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
}
