// Balance report 025: the finer tuner pass and the reworked Guardian and
// Bulwark (session 34; owner 2026-10-15, option A). Printed from the raw
// results committed in progress/signature-fairness/ (grid-*.jsonl,
// grid-confirm-*.jsonl, levers-s34-*.jsonl); the commands that made them are
// at the top of the report, so the numbers can be re-derived without
// re-running the games.
//
// Unlike report 024, the findings at the end are computed from the data, not
// written by hand, so a re-run with different numbers changes them too.
//
// Usage: npx tsx src/dev/signatureFinerPassReport.ts > ../progress/balance-report-025-signature-finer-pass.txt

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FAIRNESS_LIMIT, netChange, type CandidateResult, type GridLine, type LeverResult } from "./signatureFairness.js";
import { menuOption, onTable, optionAtSize, type SignatureSpec } from "../data/signatureMenu.js";
import { APPROVED_SIGNATURE_LINES } from "../data/signatureApproved.js";

const DIR = fileURLToPath(new URL("../../../progress/signature-fairness/", import.meta.url));
const pct = (x: number) => (x * 100).toFixed(1);
const signed = (x: number) => `${x >= 0 ? "+" : ""}${pct(x)}`;
const lines = <T>(prefix: string): T[] =>
  readdirSync(DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".jsonl"))
    .sort()
    .flatMap((f) => readFileSync(DIR + f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T));

const grid = lines<GridLine>("grid-").filter((l) => !("factions" in l));
const confirmed = lines<CandidateResult>("grid-confirm-");
const levers = lines<LeverResult>("levers-s34-");
const OPTIONS = [...new Set(grid.map((g) => g.spec.ability))];

function row(r: CandidateResult): string {
  const factions = r.factions.map((f) => `${f.faction.slice(0, 2)} ${f.edges.map((e) => signed(e.change.diff)).join("/")}`).join("  ");
  return `${r.pass ? "PASS" : "    "} ${r.id.padEnd(34)} net ${signed(netChange(r)).padStart(5)}  worst ${pct(r.worst).padStart(4)}   ${factions}`;
}
function sizeText(spec: Pick<SignatureSpec, "ability" | "size">): string {
  return spec.size ? `size ${spec.size}: "${optionAtSize(menuOption(spec.ability), spec.size).text}"` : `standard: "${menuOption(spec.ability).text}"`;
}

const out: string[] = [];
const log = (s = "") => out.push(s);

log("AI-TCG balance report 025: the finer tuner pass, and the reworked Guardian and Bulwark (session 34)");
log("Owner 2026-10-15, option A: Guardian becomes Barrier only and gets one more tuner pass; Bulwark becomes");
log("'takes the first attack aimed at one of your units (never you)' and stays off the generator until it");
log("passes; the three near misses (Smite, Energy surge, Sweep) get a finer tuner pass.");
log();
log("The test (unchanged): swap the candidate in for one faction's plain 3/6 stand-in; it passes when every one of");
log(`the twelve edges moves by ${pct(FAIRNESS_LIMIT)} points or less (paired change, same seeds). Only a 2,500-seed measurement counts.`);
log();
log("Commands (from engine/), all seeded, so each reproduces its lines exactly:");
log("  grid:    npx tsx src/dev/signatureFairness.ts grid --abilities smite,energy-surge,sweep,guardian,bulwark --seeds 1000 --shard i/4 --out grid-i.jsonl");
log("  confirm: npx tsx src/dev/signatureFairness.ts confirm --in grid-0..3.jsonl --top 5 --seeds 2500 --shard i/4 --out grid-confirm-i.jsonl");
log("  levers:  npx tsx src/dev/signatureFairness.ts levers --ability guardian|bulwark --coarse 300 --seeds 500 --confirm 2500 --out levers-s34-K.jsonl");
log();
log("What 'finer' means here. Session 33's tuner screened table lines at 300 seeds and walked greedily from the 3 best");
log("configs at 500, so a line next to a noisy screen was never measured. This pass measures EVERY size of each option at");
log("EVERY cost-5 body with attack 2-4 and health 3-9 (21 bodies), all at 1,000 seeds, then re-measures the 5 best lines");
log("of each option at 2,500. Nothing depends on which line happened to screen well.");
log();

log("1. The grid (1,000 seeds): worst edge in points, by size and body. Lower is better; * = 2.0 or less at 1,000 seeds.");
const healths = [...new Set(grid.map((g) => g.spec.health))].sort((a, b) => a - b);
for (const ability of OPTIONS) {
  log();
  log(`  ${menuOption(ability).name}`);
  const sizes = [...new Set(grid.filter((g) => g.spec.ability === ability).map((g) => g.spec.size ?? ""))];
  for (const size of sizes) {
    log(`    ${sizeText({ ability, size: size || undefined })}`);
    log(`      atk \\ hp ${healths.map((h) => String(h).padStart(6)).join("")}`);
    const attacks = [...new Set(grid.filter((g) => g.spec.ability === ability).map((g) => g.spec.attack))].sort((a, b) => a - b);
    for (const attack of attacks) {
      const cells = healths.map((health) => {
        const g = grid.find((x) => x.spec.ability === ability && (x.spec.size ?? "") === size && x.spec.attack === attack && x.spec.health === health);
        return g ? `${pct(g.worst)}${g.worst <= FAIRNESS_LIMIT + 1e-9 ? "*" : " "}`.padStart(6) : "     -";
      });
      log(`      ${String(attack).padStart(7)}   ${cells.join("")}`);
    }
  }
}
log();

log("2. Confirmed at 2,500 seeds: the 5 best grid lines of each option (edges per faction: vs the other three, in");
log("   Cortex/Swarm/Aegis/Null order without itself).");
for (const ability of OPTIONS) {
  log();
  log(`  ${menuOption(ability).name}`);
  for (const r of confirmed.filter((c) => c.spec.ability === ability).sort((a, b) => a.worst - b.worst)) log(`  ${row(r)}`);
}
log();

log("3. Guardian (Barrier only) and Bulwark (units only) at every lever, session 33's tuner: every table line of every");
log("   size x tier x extra at 300 seeds, stat walks from the 3 best configs at 500, the 3 best lines at 2,500.");
for (const l of levers) {
  log();
  log(`  ${menuOption(l.ability).name}: best table line per tier at 300 seeds`);
  for (const tier of [5, 6, 7]) {
    const best = l.screened.filter((s) => s.id.startsWith(`sig${tier}-`)).sort((a, b) => a.worst - b.worst)[0];
    if (best) log(`    cost ${tier}: ${best.id.padEnd(36)} net ${signed(best.net).padStart(5)}  worst ${pct(best.worst)}`);
  }
  log("  confirmed at 2,500:");
  for (const r of l.confirmed) log(`  ${row(r)}`);
}
log();

// ---- findings, computed ----
const all2500 = [...confirmed, ...levers.flatMap((l) => l.confirmed)];
const passes = all2500.filter((r) => r.pass);
const bestOf = (ability: string) => all2500.filter((r) => r.spec.ability === ability).sort((a, b) => a.worst - b.worst)[0];
const abilities = [...new Set([...OPTIONS, ...levers.map((l) => l.ability)])];
log("4. Findings (computed from sections 1-3)");
for (const ability of abilities) {
  const best = bestOf(ability);
  if (!best) continue;
  const own = passes.filter((p) => p.spec.ability === ability);
  const worstEdge = best.factions.flatMap((f) => f.edges.map((e) => ({ f: f.faction, o: e.opponent, d: e.change.diff }))).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0]!;
  const where = `${best.id} (${onTable(best.spec) ? "on" : "off"} the table), worst ${(best.worst * 100).toFixed(2)} on ${worstEdge.f} vs ${worstEdge.o} (${signed(worstEdge.d)})`;
  log(own.length > 0 ? `  - ${menuOption(ability).name}: PASSES, ${own.length} line(s); best ${where}.` : `  - ${menuOption(ability).name}: fails; closest ${where}, ${((best.worst - FAIRNESS_LIMIT) * 100).toFixed(2)} over the limit.`);
}
const optionsApproved = new Set(APPROVED_SIGNATURE_LINES.map((l) => l.spec.ability));
log(`  - The generator's pool (src/data/signatureApproved.ts): ${APPROVED_SIGNATURE_LINES.length} lines over ${optionsApproved.size} options (${[...optionsApproved].map((k) => menuOption(k).name).join(", ")}).`);
log(`    No two agents in a season share a combination, so at most ${APPROVED_SIGNATURE_LINES.length} agents can be generated per season, and a draft`);
log(`    needs 3 free lines: the ${APPROVED_SIGNATURE_LINES.length - 2}th agent is the last one that can be generated.`);
console.log(out.join("\n"));
