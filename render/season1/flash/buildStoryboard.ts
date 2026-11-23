// Builds the storyboard page (render session 85):
//   npx tsx render/season1/flash/buildStoryboard.ts [auditDir]
// -> render/season1/output/pack-opening-storyboard.html, with the Season 0
// audit's results read from the frame sampler's summaries in auditDir
// (default progress/render/evidence/season1-flash-audit-s85/).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderStoryboardHtml, type AuditLine } from "../src/storyboardPage.js";

const ROOT = resolve(new URL("../../..", import.meta.url).pathname);
const dir = resolve(process.argv[2] ?? resolve(ROOT, "progress/render/evidence/season1-flash-audit-s85"));
function read(file: string): AuditLine[] {
  const p = resolve(dir, file);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").filter((l) => /^(PASS|FAIL) /.test(l)).map((l) => {
    const m = /^(PASS|FAIL) (\S+)(?: \(([^)]*)\))?: (.*)$/.exec(l)!;
    return { pass: m[1] === "PASS", run: m[2]!, label: m[3] ?? "", text: m[4]! };
  });
}
const html = renderStoryboardHtml({ owner: read("summary.txt"), fastest: read("summary-fastest.txt"), reduced: read("summary-reduced.txt"), repeats: read("summary-repeats.txt"), reducedRepeats: read("summary-reduced-repeats.txt") });
const out = resolve(ROOT, "render/season1/output/pack-opening-storyboard.html");
writeFileSync(out, html);
console.log(`wrote ${out} (${Math.round(html.length / 1024)} KB)`);
