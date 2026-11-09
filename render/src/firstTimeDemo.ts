// Builds the self-contained first-time page (render/output/first-time.html):
// the Season 0 sign-up played through the economy store for every choice
// the page offers (firstTime.ts), around the real pack opening.
//
//   npm run first-time -w @ai-tcg/render
//
// Prints a transcript of what the store returned, for the evidence folder.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { firstTimeData, firstTimeTranscript } from "./firstTime.js";
import { renderPackOpeningHtml } from "./packPage.js";
import { packWardRings } from "./packWards.js";

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const flow = firstTimeData();
  const out = join(here, "..", "output", "first-time.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderPackOpeningHtml({ title: "Season Zero sign-up", packs: [], flow, wards: packWardRings() }));
  process.stdout.write(firstTimeTranscript(flow));
  process.stderr.write(`wrote ${out}\n`);
}
