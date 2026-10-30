// The pages the CI browser check reads (render/ci/browser-check.mjs), built
// fresh from the current source into a scratch directory, so the check sees
// what this commit renders, not whatever was last committed to
// render/output/. Two pages: the boast sheet (all six boasts, the phone
// scene) and one replay (Cortex vs Swarm, seed 6: its intro, and its end,
// the lethal beat then the boast).
// Usage: npm run ci-pages -w @ai-tcg/render -- <outDir>
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderBoastSheet } from "./boastSheet.js";
import { captureReplay } from "./replaySetup.js";
import { renderMatchHtml } from "./renderHtml.js";

/** The replay the check plays the intro and the end of; its saying is
 * ENGAGE, and it ends in a Cortex win with no record (the starter boast). */
export const CI_REPLAY = { a: "Cortex", b: "Swarm", seed: 6, file: "cortex-vs-swarm-seed6.html" } as const;

export async function ciPages(): Promise<Record<string, string>> {
  const { replay } = await captureReplay(CI_REPLAY.a, CI_REPLAY.b, CI_REPLAY.seed, false);
  return { "boast-sheet.html": renderBoastSheet(), [CI_REPLAY.file]: renderMatchHtml(replay) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dir = resolve(process.cwd(), process.argv[2] ?? "ci-pages");
  mkdirSync(dir, { recursive: true });
  for (const [name, html] of Object.entries(await ciPages())) {
    writeFileSync(resolve(dir, name), html, "utf8");
    console.log(`Wrote ${resolve(dir, name)}`);
  }
}
