// Balance report 023: the Neutral signature menu against the owner's
// fairness test (session 32). Prints the report from the raw results
// committed in progress/signature-fairness/, each produced by
// signatureFairness.ts (the exact commands are in that folder's README and
// at the top of the report), so the numbers can be re-derived from data
// without re-running ~40 minutes of games.
//
// Usage: npx tsx src/dev/signatureMenuReport.ts > ../progress/balance-report-023-signature-menu.txt

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { netChange, type CandidateResult, type Reference, type TuneResult } from "./signatureFairness.js";
import { onTable } from "../data/signatureMenu.js";

const DIR = fileURLToPath(new URL("../../../progress/signature-fairness/", import.meta.url));
const lines = (file: string) => readFileSync(DIR + file, "utf8").trim().split("\n").filter(Boolean);
const pct = (x: number) => (x * 100).toFixed(1);
const signed = (x: number) => `${x >= 0 ? "+" : ""}${pct(x)}`;

const reference = JSON.parse(readFileSync(fileURLToPath(new URL("./signatureReference.json", import.meta.url)), "utf8")) as Reference;
const table = readdirSync(DIR)
  .filter((f) => f.startsWith("on-table-900"))
  .flatMap((f) => lines(f).map((l) => JSON.parse(l) as CandidateResult));
const confirmed = lines("on-table-2500.jsonl").map((l) => JSON.parse(l) as CandidateResult);
const tuned = lines("tuned-cost5.jsonl").map((l) => JSON.parse(l) as TuneResult);

function row(r: CandidateResult): string {
  const factions = r.factions.map((f) => `${f.faction.slice(0, 2)} ${f.edges.map((e) => signed(e.change.diff)).join("/")}`).join("  ");
  return `${r.pass ? "PASS" : "    "} ${r.id.padEnd(30)} net ${signed(netChange(r)).padStart(5)}  worst ${pct(r.worst).padStart(4)}   ${factions}`;
}

const out: string[] = [];
const log = (s = "") => out.push(s);
log("AI-TCG balance report 023: the Neutral signature menu against the fairness test (session 32, 2026-10-12)");
log("=".repeat(110));
log();
log("The test (owner 2026-10-11, option A; 'in every faction' from the 2026-10-05 Neutral amendment):");
log("  Reference: all four factions play their shipped decks (set Mythic left in the deck) with the SAME plain");
log("  signature card, a Neutral 5-cost 3/6 with no ability. A candidate replaces ONE faction's plain card; the");
log("  other three keep theirs. It passes when, for each of the four factions in turn, that faction's three edges");
log("  each move 2.0 points or less. 12 edges per candidate.");
log("  Read as the point estimate of the PAIRED change: candidate and reference play the same seeds with the same");
log("  agent seeds, so each game is identical until the signature card makes a difference. Edge cells below are");
log("  that faction's three edges in FACTIONS order (Cortex, Swarm, Aegis, Null; its own pairing skipped). 'net' is");
log("  the mean change over all 12 edges: how much stronger than the plain 3/6 the candidate plays.");
log("  Instrument: measurePairing (Lookahead vs Lookahead, seed * 104729 + 31, alternating seats).");
log();
log("Commands (from engine/):");
log("  npx tsx src/dev/signatureFairness.ts reference --seeds 2500");
log("  npx tsx src/dev/signatureFairness.ts candidates --seeds 900 [--shard i/4] --out ...      (section 2, 4)");
log("  npx tsx src/dev/signatureFairness.ts candidates --seeds 2500 --ids ... --out ...          (section 2 confirmations)");
log("  npx tsx src/dev/signatureFairness.ts tune --ability K --tier 5 --seeds 500 --confirm 2500  (section 3)");
log();
log(`1. The reference ring (${reference.seeds} seeds per ordered pairing, plain 3/6 on every side)`);
log("-".repeat(110));
for (const [k, v] of Object.entries(reference.results)) log(`  ${k.padEnd(14)} ${pct([...v].filter((c) => c === "1").length / v.length)}%`);
log();
const t5 = table.filter((r) => r.spec.tier === 5).sort((a, b) => a.worst - b.worst);
log(`2. Cost 5, every line on the owner's table (${t5.length} candidates, 900 seeds per edge), sorted by worst edge`);
log("-".repeat(110));
for (const r of t5) log(row(r));
log();
log(`  ${t5.filter((r) => r.pass).length} of ${t5.length} pass at 900 seeds. Re-measured at 2,500 seeds:`);
for (const r of confirmed) log(row(r));
log();
log("3. 'If it fails, adjust its stats and test again' (owner 2026-10-05): the stat walk, cost 5");
log("-".repeat(110));
log("  From 3/6, one stat point at a time toward zero net change (screened at 500 seeds, attack 0-6, health 1-9),");
log("  then the neighbours of the closest line; the line with the smallest worst edge is re-measured at 2,500 seeds.");
log("  'off' = off the owner's cost-5 table (3/6, 4/5, 2/7).");
log();
for (const t of tuned) {
  const b = t.best;
  log(`${row(b)}  ${onTable(b.spec) ? "on table" : "off"}`);
  const path = [...t.tried].sort((x, y) => x.worst - y.worst).slice(0, 4).map((x) => `${x.id.split("-")[1]} net ${signed(x.net)} worst ${pct(x.worst)}`).join("; ");
  log(`       best screened lines: ${path}`);
}
log();
const passingOptions = new Set([...tuned.filter((t) => t.best.pass).map((t) => t.best.spec.ability), ...confirmed.filter((r) => r.pass).map((r) => r.spec.ability)]);
const onTablePassing = new Set(confirmed.filter((r) => r.pass && onTable(r.spec)).map((r) => r.spec.ability));
for (const t of tuned) if (t.best.pass && t.onTable) onTablePassing.add(t.best.spec.ability);
log(`  ${passingOptions.size} of ${tuned.length} options have a passing stat line at 2,500 seeds (${[...passingOptions].join(", ")});`);
log(`  ${onTablePassing.size} pass on the owner's table (${[...onTablePassing].join(", ")}, both at 3/6).`);
log();
const t67 = table.filter((r) => r.spec.tier !== 5).sort((a, b) => a.spec.tier - b.spec.tier || a.worst - b.worst);
log(`4. Costs 6 and 7 on the table, a first sample (${t67.length} candidates: the first options measured before the run was`);
log("   narrowed to cost 5; 900 seeds)");
log("-".repeat(110));
for (const r of t67) log(row(r));
log();
for (const tier of [6, 7] as const) {
  const rs = t67.filter((r) => r.spec.tier === tier);
  if (rs.length === 0) continue;
  const nets = rs.map(netChange);
  log(`  cost ${tier}: ${rs.length} candidates, net ${signed(Math.min(...nets))} to ${signed(Math.max(...nets))}, ${rs.filter((r) => r.pass).length} pass`);
}
log();
log("5. What the numbers say");
log("-".repeat(110));
log("  - Attack is the lever, health is not. One attack point moves a candidate ~5 points net; one health point");
log("    moves it a few tenths (a signature card rarely dies: in a 100-game Cortex-vs-Swarm check, a 3/6 died in 3). Integer attack steps are");
log("    coarser than the 2-point limit, so for most options no stat line lands inside it.");
log("  - Net ~0 is not enough: the same option helps the factions unevenly. Paid for with attack, an ability");
log("    usually costs Aegis the most (Aegis gains most from a raw body), so a line that is net-even still");
log("    leaves Aegis 3-6 points down and another faction 3-6 up (Smite 1/6, Commander's aura 1/3, Dampen 1/2).");
log("  - On the table, only the two options that barely change a game pass: Recycle (it only fires when the");
log("    card dies) and Tax. Guardian (Guard + Barrier) is the strongest by far (worst edge +40 to +47 on the table).");
log("  - The 6-cost tier plays far above the plain 5-cost reference (net up to +32); the 7-cost tier lands near");
log("    it (net -0.8 to +8.4), because a 7-cost card arrives late in ~13-turn games.");
console.log(out.join("\n"));
