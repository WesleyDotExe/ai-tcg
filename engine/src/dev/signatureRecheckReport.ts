// Balance report 033: the approved signature list re-checked with the
// current agent (session 48, a hardening pass). The 14 approved lines were
// measured at 10,000 games per edge in session 35, against a reference
// measured the same session, with the LookaheadAgent as it was before
// session 41's fix (it now values signature statics and turn triggers it
// ignored before). Both the reference and the 14 lines are measured again
// here with today's agent; no line or card is changed by this file.
//
// Printed from the raw results committed in
// progress/signature-fairness/agent41/ (recheck-10k-*.jsonl), the new
// reference (signatureReference.json) and the session-37 one
// (signatureReference-s37.json), so the numbers re-derive without the games.
//
// Usage: npx tsx src/dev/signatureRecheckReport.ts > ../progress/balance-report-033-signature-recheck.txt

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FAIRNESS_LIMIT, netChange, type CandidateResult, type Reference } from "./signatureFairness.js";
import { APPROVED_SIGNATURE_LINES } from "../data/signatureApproved.js";

const DIR = fileURLToPath(new URL("../../../progress/signature-fairness/agent41/", import.meta.url));
const readRef = (f: string) => JSON.parse(readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8")) as Reference;
const pct = (x: number) => (x * 100).toFixed(1);
const pct2 = (x: number) => (x * 100).toFixed(2);
const signed = (x: number) => `${x >= 0 ? "+" : ""}${pct(x)}`;
const rate = (s: string) => [...s].filter((c) => c === "1").length / s.length;

const results = readdirSync(DIR)
  .filter((f) => f.startsWith("recheck-10k-") && f.endsWith(".jsonl"))
  .sort()
  .flatMap((f) => readFileSync(DIR + f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as CandidateResult));
const byId = new Map(results.map((r) => [r.id, r]));
const missing = APPROVED_SIGNATURE_LINES.filter((l) => !byId.has(l.id)).map((l) => l.id);
if (missing.length) throw new Error(`no re-check result for ${missing.join(", ")}`);

/** The edge with the largest |change|, and its paired 95% interval. */
function worstEdge(r: CandidateResult): string {
  let best = { name: "", diff: 0, lo: 0, hi: 0 };
  for (const f of r.factions) for (const e of f.edges) if (Math.abs(e.change.diff) >= Math.abs(best.diff)) best = { name: `${f.faction}>${e.opponent}`, ...e.change };
  return `${best.name.padEnd(13)} ${signed(best.diff).padStart(5)} [${signed(best.lo)}, ${signed(best.hi)}]`;
}

const out: string[] = [];
const log = (s = "") => out.push(s);
const now = readRef("./signatureReference.json");
const then = readRef("./signatureReference-s37.json");

log("AI-TCG balance report 033: the approved signature list re-checked with the current agent (session 48)");
log("A hardening pass. The 14 approved lines' fairness numbers (balance report 026, session 35) predate session 41's");
log("agent fix, which taught the LookaheadAgent to value signature statics and turn triggers. Re-measured here with");
log("today's agent, against a reference re-measured with it. Nothing is changed: the approved list stands as it is;");
log("this report says whether it still holds.");
log();
log(`The test (unchanged): swap the candidate in for one faction's plain 3/6 stand-in; it passes when every one of the`);
log(`twelve edges moves by ${pct(FAIRNESS_LIMIT)} points or less (paired change, same seeds).`);
log();
log("Commands (from engine/), all seeded:");
log(`  reference: npx tsx src/dev/signatureFairness.ts reference --seeds ${now.seeds}          (3 min 17 s, one core)`);
log("  remeasure: npx tsx src/dev/signatureFairness.ts remeasure --approved --seeds 10000 --shard i/4 \\");
log("               --out ../progress/signature-fairness/agent41/recheck-10k-i.jsonl     (i = 0..3, in parallel)");
log();

log(`1. The reference ring, ${now.seeds} seeds per ordered pairing (plain 3/6 on every side): session 35's agent -> today's`);
for (const [k, v] of Object.entries(now.results)) {
  const before = then.results[k]!;
  log(`  ${k.padEnd(14)} ${pct(rate(before)).padStart(5)}% -> ${pct(rate(v)).padStart(5)}%   (${signed(rate(v) - rate(before))})`);
}
log();

log("2. The 14 approved lines: session 35's worst edge -> today's (10,000 games per edge both times)");
log("   worst = largest |change| over the twelve edges; net = mean signed change (how much stronger than the stand-in).");
log();
log(`  ${"line".padEnd(28)} ${"then".padStart(6)} ${"now".padStart(6)}  ${"net".padStart(5)}  verdict  worst edge now [95% paired interval]`);
let passing = 0;
for (const line of APPROVED_SIGNATURE_LINES) {
  const r = byId.get(line.id)!;
  if (r.seeds !== 10000) throw new Error(`${line.id} measured at ${r.seeds} seeds`);
  if (r.pass) passing++;
  log(`  ${line.id.padEnd(28)} ${pct2(line.worst).padStart(6)} ${pct2(r.worst).padStart(6)}  ${signed(netChange(r)).padStart(5)}  ${(r.pass ? "PASS" : "FAIL").padEnd(7)}  ${worstEdge(r)}`);
}
log();
log(`  ${passing} of ${APPROVED_SIGNATURE_LINES.length} pass with today's agent.`);
const failing = APPROVED_SIGNATURE_LINES.filter((l) => !byId.get(l.id)!.pass);
if (failing.length) {
  log();
  log("3. The lines that no longer pass, every edge over the limit:");
  for (const l of failing) {
    const r = byId.get(l.id)!;
    for (const f of r.factions) for (const e of f.edges) {
      if (Math.abs(e.change.diff) > FAIRNESS_LIMIT + 1e-9) log(`  ${l.id.padEnd(28)} ${f.faction}>${e.opponent}`.padEnd(46) + ` ${signed(e.change.diff)} [${signed(e.change.lo)}, ${signed(e.change.hi)}]`);
    }
  }
}
log();
const worstNow = Math.max(...results.map((r) => r.worst));
const meanThen = APPROVED_SIGNATURE_LINES.reduce((a, l) => a + l.worst, 0) / APPROVED_SIGNATURE_LINES.length;
const meanNow = APPROVED_SIGNATURE_LINES.reduce((a, l) => a + byId.get(l.id)!.worst, 0) / APPROVED_SIGNATURE_LINES.length;
log(`Mean worst edge: ${pct2(meanThen)} -> ${pct2(meanNow)} points; the largest today ${pct2(worstNow)} (limit ${pct(FAIRNESS_LIMIT)}).`);

console.log(out.join("\n"));
