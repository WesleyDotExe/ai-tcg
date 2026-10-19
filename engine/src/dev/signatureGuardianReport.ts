// Balance report 034: the tuner looks for a Guardian line that passes with
// today's agent (session 49; owner 2026-10-19, option C on session 48's
// check-in: "take Guardian 3/5 off, and have the tuner look for a Guardian
// line that passes with today's agent, so the menu keeps a Guardian option.
// If none passes, the list stays at 13"). Also prints the approved list as
// regenerated from today's agent's results (the owner's answer to question 2).
//
// Printed from the raw results committed in
// progress/signature-fairness/agent41/ (guardian-grid-*, guardian-levers,
// guardian-confirm-10k-*, and recheck-10k-* for Guardian 3/5 itself), so the
// numbers re-derive without the games.
//
// Usage: npx tsx src/dev/signatureGuardianReport.ts > ../progress/balance-report-034-guardian-search.txt

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FAIRNESS_LIMIT, netChange, type CandidateResult, type GridLine, type LeverResult } from "./signatureFairness.js";
import { APPROVED_SIGNATURE_LINES } from "../data/signatureApproved.js";

const DIR = fileURLToPath(new URL("../../../progress/signature-fairness/agent41/", import.meta.url));
const pct = (x: number) => (x * 100).toFixed(1);
const pct2 = (x: number) => (x * 100).toFixed(2);
const signed = (x: number) => `${x >= 0 ? "+" : ""}${pct(x)}`;
const lines = <T>(prefix: string): T[] =>
  readdirSync(DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".jsonl"))
    .sort()
    .flatMap((f) => readFileSync(DIR + f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T));

const grid = lines<GridLine>("guardian-grid-").sort((a, b) => a.worst - b.worst || a.id.localeCompare(b.id));
const levers = lines<LeverResult>("guardian-levers")[0];
const confirms = lines<CandidateResult>("guardian-confirm-10k-");
const old = lines<CandidateResult>("recheck-10k-").find((r) => r.id === "sig5-3x5-guardian");
if (grid.length !== 21) throw new Error(`expected the 21 cost-5 Guardian bodies in the grid, found ${grid.length}`);
if (!levers) throw new Error("no guardian-levers result");
if (!old) throw new Error("no 10,000-game re-check of sig5-3x5-guardian");

/** The edge with the largest |change|, from a compact grid line. */
function gridWorst(g: GridLine): string {
  const [edge, diff] = Object.entries(g.edges).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]!;
  return `${edge} ${signed(diff)}`;
}

const out: string[] = [];
const log = (s = "") => out.push(s);

log("AI-TCG balance report 034: a Guardian line with today's agent; the approved list from today's agent (session 49)");
log("Owner 2026-10-19 (answers to session 48): Guardian 3/5 comes off the approved list (option C); the tuner looks for a");
log("Guardian line that passes with today's agent; and from now on the approved list is read from today's agent's results.");
log();
log(`The test (unchanged): swap the candidate in for one faction's plain 3/6 stand-in; it passes when every one of the`);
log(`twelve edges moves by ${pct(FAIRNESS_LIMIT)} points or less (paired change, same seeds, against signatureReference.json, today's`);
log("agent). A line's largest measurement decides; the approved list needs 2,500 seeds or more, and every line on it today");
log("was measured at 10,000.");
log();
log("Guardian is \"Barrier.\" (owner 2026-10-15, option A). A keyword has no size, so the levers are the body and the cost tier.");
log();
log("Commands (from engine/), all seeded, run in parallel:");
log("  grid:    npx tsx src/dev/signatureFairness.ts grid --abilities guardian --seeds 1000 --shard i/4 \\");
log("             --out ../progress/signature-fairness/agent41/guardian-grid-i.jsonl              (i = 0..3)");
log("  levers:  npx tsx src/dev/signatureFairness.ts levers --ability guardian --coarse 300 --seeds 500 --confirm 2500 \\");
log("             --out ../progress/signature-fairness/agent41/guardian-levers.jsonl");
log("  confirm: npx tsx src/dev/signatureFairness.ts remeasure --ids sig5-3x4-guardian,sig5-3x6-guardian --seeds 10000 \\");
log("             --shard i/2 --out ../progress/signature-fairness/agent41/guardian-confirm-10k-i.jsonl  (i = 0..1)");
log();

log("1. Every cost-5 Guardian body (attack 2-4, health 3-9), 1,000 games per edge, best first");
log(`  ${"line".padEnd(22)} ${"net".padStart(5)} ${"worst".padStart(5)}  worst edge`);
for (const g of grid) log(`  ${g.id.padEnd(22)} ${signed(g.net).padStart(5)} ${pct(g.worst).padStart(5)}  ${gridWorst(g)}`);
log();
log("  Attack 2 is too weak everywhere (net -2 to -4: a Barrier 2/x is a worse card than the plain 3/6), attack 4 too");
log("  strong; only attack 3 comes near, and only health 4-6.");
log();

log(`2. The tuner with the levers (cost tiers 5, 6 and 7): ${levers.screened.length} table lines screened at 300 games, stat walks`);
log("   from the three best configurations at 500, the three best lines overall confirmed at 2,500");
const byTier = new Map<string, { id: string; net: number; worst: number }>();
for (const s of levers.screened) {
  const tier = s.id.slice(0, 4);
  const cur = byTier.get(tier);
  if (!cur || s.worst < cur.worst) byTier.set(tier, s);
}
for (const [tier, s] of [...byTier].sort()) log(`  best screened at cost ${tier.slice(3)}: ${s.id.padEnd(34)} net ${signed(s.net).padStart(5)}  worst ${pct(s.worst)}`);
for (const w of levers.walks) log(`  walk from ${w.start.ability} cost ${w.start.tier}: ${w.tried.length} lines tried, best ${w.best.id} worst ${pct(w.best.worst)} at ${w.best.seeds}`);
log("  confirmed at 2,500:");
for (const r of levers.confirmed) log(`    ${r.id.padEnd(34)} net ${signed(netChange(r)).padStart(5)}  worst ${pct2(r.worst)}  ${r.pass ? "PASS" : "fail"}`);
log();

log("3. The nearest lines at 10,000 games per edge (Guardian 3/5 from session 48's re-check, for comparison)");
let passing: CandidateResult[] = [];
for (const r of [old, ...confirms.sort((a, b) => a.id.localeCompare(b.id))]) {
  if (r.seeds !== 10000) throw new Error(`${r.id} measured at ${r.seeds} seeds`);
  if (r.pass && r !== old) passing.push(r);
  log(`  ${r.id.padEnd(22)} net ${signed(netChange(r)).padStart(5)}  worst ${pct2(r.worst)}  ${r.pass ? "PASS" : "FAIL"}`);
  for (const f of r.factions) {
    log(`      ${f.faction.padEnd(6)} ${f.edges.map((e) => `>${e.opponent} ${signed(e.change.diff)} [${signed(e.change.lo)}, ${signed(e.change.hi)}]`).join("  ")}`);
  }
}
log();
passing = passing.sort((a, b) => a.worst - b.worst);
if (passing.length) {
  log(`  Passing: ${passing.map((r) => `${r.id} (worst ${pct2(r.worst)})`).join(", ")}.`);
} else {
  log("  No Guardian line passes at 10,000 games with today's agent. Under the owner's answer the list stays at 13.");
}
log();

log("4. The approved list, regenerated from today's agent's results (src/dev/signatureApprovedList.ts reads agent41/ only)");
for (const l of APPROVED_SIGNATURE_LINES) log(`  ${l.id.padEnd(28)} worst ${pct2(l.worst)} at ${l.seeds}  ${l.source.replace("progress/signature-fairness/", "")}`);
log();
const options = [...new Set(APPROVED_SIGNATURE_LINES.map((l) => l.spec.ability))].sort();
log(`  ${APPROVED_SIGNATURE_LINES.length} lines over ${options.length} options (${options.join(", ")}).`);
log(`  Guardian 3/5 is ${APPROVED_SIGNATURE_LINES.some((l) => l.id === "sig5-3x5-guardian") ? "STILL ON (bug)" : "off"}; agents that hold one keep it (a stored card is rebuilt from its spec).`);

log();

// The real-match ring (ringRegression.ts --real) plays an approved line as
// each side's signature card, so a new list changes its matches. The
// session-44 baseline (recorded 2026-10-18), as committed before this
// session, for the comparison:
const BEFORE: Record<string, number> = { "Null > Aegis": 1135, "Aegis > Cortex": 1402, "Cortex > Swarm": 1335, "Swarm > Null": 1394, "Null ~ Cortex": 456, "Aegis ~ Swarm": 506 };
const real = JSON.parse(readFileSync(fileURLToPath(new URL("./ringBaselineReal.json", import.meta.url)), "utf8")) as { recorded: string; edges: { edge: string; selfWins: number; games: number }[] };
log("5. The real-match ring (npm run ring:real), which draws its signature cards from this list");
log("   The new list (and a draw that works for any list size; session 44's needed an even one) changes every match");
log("   with a signature card. Against the old baseline, five edges held their verdict and Cortex > Swarm went from");
log("   UNRESOLVED to OUT OF BAND on a -0.4 change [-3.2, +2.3]: noise from the new draw, no card changed. The baseline");
log(`   was re-recorded (${real.recorded}) because the stand-in has to follow the approved list; the gate (decks as shipped) is`);
log("   unaffected and passes against its own baseline.");
log(`  ${"edge".padEnd(16)} ${"before".padStart(7)} ${"after".padStart(7)}  change`);
for (const e of real.edges) {
  const before = BEFORE[e.edge]! / e.games, after = e.selfWins / e.games;
  log(`  ${e.edge.padEnd(16)} ${(pct(before) + "%").padStart(7)} ${(pct(after) + "%").padStart(7)}  ${signed(after - before)}   (${e.games} games)`);
}

console.log(out.join("\n"));
