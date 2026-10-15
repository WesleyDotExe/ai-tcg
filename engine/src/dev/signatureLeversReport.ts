// Balance report 024: the Neutral signature menu against the owner's
// fairness test, with the tuner's new levers (session 33; owner 2026-10-13,
// option A: "give the tuner levers beyond stats: the size of the ability
// itself, and the cost tier. Keep attack at 2 or more"). Printed from the raw
// results committed in progress/signature-fairness/levers-*.jsonl, each
// produced by `signatureFairness.ts levers` (the command is at the top of the
// report), so the numbers can be re-derived without re-running the games.
//
// Usage: npx tsx src/dev/signatureLeversReport.ts > ../progress/balance-report-024-signature-levers.txt

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { netChange, type CandidateResult, type LeverResult } from "./signatureFairness.js";
import type { ReworkResult } from "./signatureReworkProbe.js";
import { SIGNATURE_MENU, menuOption, onTable, optionAtSize, type SignatureSpec } from "../data/signatureMenu.js";

const DIR = fileURLToPath(new URL("../../../progress/signature-fairness/", import.meta.url));
const pct = (x: number) => (x * 100).toFixed(1);
const signed = (x: number) => `${x >= 0 ? "+" : ""}${pct(x)}`;

const results = new Map<string, LeverResult>();
for (const f of readdirSync(DIR).filter((f) => f.startsWith("levers-") && !f.startsWith("levers-s34-") && f.endsWith(".jsonl"))) {
  for (const l of readFileSync(DIR + f, "utf8").trim().split("\n").filter(Boolean)) {
    const r = JSON.parse(l) as LeverResult;
    results.set(r.ability, r);
  }
}
const reworks = readFileSync(DIR + "reworks.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l) as ReworkResult);
const session32 = readFileSync(DIR + "on-table-2500.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l) as CandidateResult);

function row(r: CandidateResult): string {
  const factions = r.factions.map((f) => `${f.faction.slice(0, 2)} ${f.edges.map((e) => signed(e.change.diff)).join("/")}`).join("  ");
  return `${r.pass ? "PASS" : "    "} ${r.id.padEnd(40)} net ${signed(netChange(r)).padStart(5)}  worst ${pct(r.worst).padStart(4)}   ${factions}`;
}

/** The levers a line uses, in words. */
function describe(spec: SignatureSpec): string {
  const option = menuOption(spec.ability);
  const parts = [`cost ${spec.tier}`, `${spec.attack}/${spec.health}${onTable(spec) ? " (on the table)" : " (off the table)"}`];
  parts.push(spec.size ? `size ${spec.size}: "${optionAtSize(option, spec.size).text}"` : "standard size");
  if (spec.keyword) parts.push(`+ ${spec.keyword}`);
  if (spec.secondAura) parts.push(`+ ${menuOption(spec.secondAura).name}`);
  return parts.join(", ");
}

// Read off sections 1-4 (session 33). Kept here, next to the tables they
// summarise, so a re-run that changes the data shows up as a mismatch.
const FINDINGS = [
  "  - The size lever is the one that works. All four new passes are a smaller size at cost 5 on or next to the",
  "    table: Rally +0/+1 at 3/6, Restore on one random unit at 3/6, Supply line only from a hand of 2 or fewer",
  "    at 3/6, Inspire +0/+1 at 3/4 or 3/5. Recycle and Tax still pass as before (Recycle now also at 1 card).",
  "  - The cost lever rarely helps. Cost 6 still plays above the reference for almost every option; cost 7 lands",
  "    near it in net terms, but only with bodies far off the table (Guardian 3/2, Bulwark 3/4), and its",
  "    second aura splits the factions: Cortex and Swarm up 3-6, Aegis down 2-6.",
  "  - Three options are close (worst edge 2.4-2.6): Smite at 1 damage, Energy surge as written, Sweep on 2",
  "    random units. Each misses on one edge, and a 1-health step is the finest lever left, so another tuner",
  "    pass at finer resolution (more seeds per step, more starting points) is worth a run before reworking them.",
  "  - Commander's aura, Hunter, Shield wall, Suppress and Dampen fail at every size and tier (3.2-5.2). Hunter is",
  "    simply too strong even at its smallest size (net +2.7, every edge up). The other four show report 023's",
  "    pattern: at a net-even line the factions still split, Aegis down 1.6-3.6 points on some edge while another",
  "    faction gains 3.2-4.8 on one of its own, so the 12 edges can't all sit inside 2 at once.",
  "  - Guardian and Bulwark fail by the most, as you expected. Guard is the problem, not Barrier: Barrier alone at",
  "    3/4 misses by 0.1 (2.1), Guard alone at 3/3 is still 8.1 off. Every attack-pulling version of Bulwark",
  "    fails too (3.9-9.1), the 'only attacks aimed at your units' version least.",
];

const out: string[] = [];
const log = (s = "") => out.push(s);
log("AI-TCG balance report 024: the Neutral signature menu with the tuner's new levers (session 33, 2026-10-14)");
log("=".repeat(118));
log();
log("The test is unchanged from report 023 (owner 2026-10-11, option A): every faction plays its shipped deck with the");
log("same plain Neutral 5-cost 3/6 signature card; a candidate replaces ONE faction's plain card, and passes when each of");
log("that faction's three edges moves 2.0 points or less, for all four factions (12 edges). Read on the paired point");
log("estimate (owner 2026-10-13, call 1: the measured change on the same games, not the whole interval).");
log();
log("What is new (owner 2026-10-13, option A):");
log("  - The size lever. Every option except Guardian and Bulwark has smaller and/or larger sizes in the menu data");
log("    (engine/src/data/signatureMenu.ts, MenuOption.sizes): the same mechanic with a number turned up or down, a");
log("    narrower target, or an 'only while' condition. Guardian and Bulwark have no size between all and nothing.");
log("  - The cost-tier lever. Each size is tried at cost 5, at cost 6 with each keyword it doesn't print (Rush, Guard,");
log("    Barrier), and at cost 7 with each other aura (Commander's aura, Shield wall, Dampen, Tax).");
log("  - Attack stays at 2 or more everywhere (the walk no longer goes below 2).");
log("  - Bulwark now stands aside while a Guard unit protects its side (owner 2026-10-13, call 3), measured here.");
log();
log("Method, per option (signatureFairness.ts tuneWithLevers):");
log("  1. every table stat line of every size x tier x extra, at 300 seeds per edge (the coarse screen);");
log("  2. from the 3 configs with the best table line, the stat walk (attack 2-6, health 1-9) at 500 seeds;");
log("  3. the 3 best lines over all of it re-measured at 2,500 seeds. Only a 2,500-seed result counts as a pass.");
log("Command (from engine/): npx tsx src/dev/signatureFairness.ts levers --shard i/4 --coarse 300 --seeds 500 --confirm 2500 \\");
log("  --out ../progress/signature-fairness/levers-i.jsonl     (i = 0..3, in parallel; everything is seeded)");
log();

log("1. Result per option: the best confirmed line (2,500 seeds), with the levers it uses");
log("-".repeat(118));
const passing: string[] = [];
const failing: { key: string; best: CandidateResult }[] = [];
for (const option of SIGNATURE_MENU) {
  const r = results.get(option.key);
  if (!r) {
    log(`  ${option.name}: NOT MEASURED`);
    continue;
  }
  const best = r.confirmed[0]!;
  const passes = r.confirmed.filter((c) => c.pass);
  if (passes.length > 0) passing.push(option.key);
  else failing.push({ key: option.key, best });
  log(`${option.name} (${option.category}) - ${passes.length > 0 ? `PASSES (${passes.length} of ${r.confirmed.length} confirmed lines)` : "fails"}`);
  for (const c of r.confirmed) {
    log(row(c));
    log(`       ${describe(c.spec)}`);
  }
  const old = session32.find((c) => c.spec.ability === option.key);
  if (old) log(`       (session 32, standard size on the table: ${old.id} worst ${pct(old.worst)})`);
  log();
}
log(`  ${passing.length} of ${SIGNATURE_MENU.length} options pass: ${passing.map((k) => menuOption(k).name).join(", ") || "none"}.`);
log(`  Still failing: ${failing.map((f) => `${menuOption(f.key).name} (worst ${pct(f.best.worst)})`).join(", ") || "none"}.`);
log();

log("2. The coarse screen: each option's 5 best table lines over every size x tier x extra (300 seeds)");
log("-".repeat(118));
for (const option of SIGNATURE_MENU) {
  const r = results.get(option.key);
  if (!r) continue;
  const top = [...r.screened].sort((a, b) => a.worst - b.worst).slice(0, 5);
  log(`  ${option.name.padEnd(18)} ${r.screened.length} lines; best: ${top.map((t) => `${t.id.replace(/^sig/, "")} ${pct(t.worst)}`).join(", ")}`);
}
log();

log("3. Where the levers help: best table line per tier, over every size (300 seeds; net = mean change, worst = largest edge)");
log("-".repeat(118));
for (const option of SIGNATURE_MENU) {
  const r = results.get(option.key);
  if (!r) continue;
  const cells = [5, 6, 7].map((tier) => {
    const rows = r.screened.filter((s) => s.id.startsWith(`sig${tier}-`));
    if (rows.length === 0) return `cost ${tier}: -`;
    const b = rows.reduce((x, y) => (y.worst < x.worst ? y : x));
    return `cost ${tier}: ${pct(b.worst).padStart(4)} (net ${signed(b.net)})`;
  });
  log(`  ${option.name.padEnd(18)} ${cells.join("   ")}`);
}
log();

log("4. Rework proposals for Guardian and Bulwark (not menu options: each is a different ability, the owner's call)");
log("-".repeat(118));
log("  Command (from engine/): npx tsx src/dev/signatureReworkProbe.ts --out ../progress/signature-fairness/reworks.jsonl");
log("  Each at cost 5: a body grid (attack 2-4) at 500 seeds, the 2 best re-measured at 2,500 seeds.");
log();
for (const r of reworks) {
  log(`${r.key} (replaces ${menuOption(r.replaces).name}): "${r.text}"`);
  for (const c of r.confirmed) log(row(c));
  log();
}

log("5. What the numbers say");
log("-".repeat(118));
for (const line of FINDINGS) log(line);
console.log(out.join("\n"));
