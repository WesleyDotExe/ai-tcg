// Balance report 026: the near misses and the approved lines at 10,000 games
// per edge, and the new sizes (session 35; owner 2026-10-15, "grow the
// pool"). Printed from the raw results committed in
// progress/signature-fairness/ (remeasure-10k-*.jsonl, s35-grid-*.jsonl,
// s35-confirm-*.jsonl) and the cached reference; the findings are computed
// from the data.
//
// Usage: npx tsx src/dev/signatureTenThousandReport.ts > ../progress/balance-report-026-signature-10k.txt

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FAIRNESS_LIMIT, netChange, type CandidateResult, type GridLine, type Reference } from "./signatureFairness.js";
import { menuOption, optionAtSize, signatureComboId, type SignatureSpec } from "../data/signatureMenu.js";
import { APPROVED_SIGNATURE_LINES } from "../data/signatureApproved.js";

const DIR = fileURLToPath(new URL("../../../progress/signature-fairness/", import.meta.url));
const REFERENCE = fileURLToPath(new URL("./signatureReference-s37.json", import.meta.url));
const pct = (x: number) => (x * 100).toFixed(1);
const pct2 = (x: number) => (x * 100).toFixed(2);
const signed = (x: number) => `${x >= 0 ? "+" : ""}${pct(x)}`;
const files = (prefix: string) => readdirSync(DIR).filter((f) => f.startsWith(prefix) && f.endsWith(".jsonl")).sort();
const read = <T>(prefix: string): T[] => files(prefix).flatMap((f) => readFileSync(DIR + f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T));

/** Every full result at exactly 2,500 seeds before this session, by id (the best, as the approved list read them). */
function at2500(): Map<string, CandidateResult> {
  const out = new Map<string, CandidateResult>();
  const changed = new Set(["guardian", "bulwark"]);
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".jsonl") && !x.startsWith("remeasure-") && !x.startsWith("s35-"))) {
    const after34 = f.startsWith("grid-") || f.startsWith("levers-s34-");
    for (const text of readFileSync(DIR + f, "utf8").split("\n").filter(Boolean)) {
      const o = JSON.parse(text) as { factions?: unknown; best?: CandidateResult; confirmed?: CandidateResult[] };
      const rs = o.confirmed ?? (o.best ? [o.best] : o.factions ? [o as CandidateResult] : []);
      for (const r of rs) {
        if (r.seeds !== 2500 || r.spec.ability.startsWith("rework:")) continue;
        if (changed.has(r.spec.ability) && !after34) continue;
        const id = signatureComboId(r.spec);
        if (!out.has(id) || out.get(id)!.worst > r.worst) out.set(id, r);
      }
    }
  }
  return out;
}

function row(r: CandidateResult): string {
  const factions = r.factions.map((f) => `${f.faction.slice(0, 2)} ${f.edges.map((e) => signed(e.change.diff)).join("/")}`).join("  ");
  return `${r.pass ? "PASS" : "    "} ${r.id.padEnd(30)} net ${signed(netChange(r)).padStart(5)}  worst ${pct2(r.worst).padStart(5)}   ${factions}`;
}
/** The worst edge and its paired 95% interval. */
function worstEdge(r: CandidateResult): string {
  let best = { name: "", diff: 0, lo: 0, hi: 0 };
  for (const f of r.factions) for (const e of f.edges) if (Math.abs(e.change.diff) >= Math.abs(best.diff)) best = { name: `${f.faction}>${e.opponent}`, ...e.change };
  return `${best.name} ${signed(best.diff)} [${signed(best.lo)}, ${signed(best.hi)}]`;
}
function sizeText(spec: Pick<SignatureSpec, "ability" | "size">): string {
  return spec.size ? `size ${spec.size}: "${optionAtSize(menuOption(spec.ability), spec.size).text}"` : `standard: "${menuOption(spec.ability).text}"`;
}

/** The --ids list of the re-measure run, in its order: the owner's near
 * misses, then session 34's approved lines. */
const RUN_IDS = [
  "sig5-2x9-sweep.r2", "sig5-2x8-sweep.r2", "sig5-3x5-guardian", "sig5-3x4-guardian", "sig5-3x6-guardian", "sig5-2x9-smite.d1", "sig5-2x8-smite.d1",
  "sig5-2x8-energy-surge.e2", "sig5-2x9-energy-surge.e2", "sig5-3x4-inspire.a0", "sig5-3x4-restore.r1", "sig5-3x5-inspire.a0", "sig5-3x5-rally.a0",
  "sig5-3x5-recycle", "sig5-3x5-recycle.c3", "sig5-3x5-restore.r1", "sig5-3x6-rally.a0", "sig5-3x6-recycle", "sig5-3x6-recycle.c1",
  "sig5-3x6-restore.r1", "sig5-3x6-supply-line.low", "sig5-3x6-tax", "sig5-3x7-supply-line.low",
];

const out: string[] = [];
const log = (s = "") => out.push(s);

const ten = read<CandidateResult>("remeasure-10k-");
if ([...new Set(ten.map((r) => r.id))].sort().join() !== [...RUN_IDS].sort().join()) throw new Error("RUN_IDS doesn't match remeasure-10k-*.jsonl");
const before = at2500();
/** Session 34's approved list: every line that passed at 2,500. */
const approvedBefore = new Set([...before.values()].filter((r) => r.pass).map((r) => r.id));

log("AI-TCG balance report 026: the signature lines at 10,000 games per edge, and new sizes (session 35)");
log("Owner 2026-10-15, question 1, option A: grow the pool. Re-measure the near misses (Sweep, Guardian, Smite) at");
log("10,000 games per edge against a 10,000-game reference, and add new sizes for the next tuner pass.");
log();
log(`The test (unchanged): swap the candidate in for one faction's plain 3/6 stand-in; it passes when every one of the`);
log(`twelve edges moves by ${pct(FAIRNESS_LIMIT)} points or less (paired change, same seeds).`);
log();
log("Commands (from engine/), all seeded:");
log("  reference: npx tsx src/dev/signatureFairness.ts reference --seeds 10000          (about 2 minutes, one core)");
log("  remeasure: npx tsx src/dev/signatureFairness.ts remeasure --ids <IDS> --seeds 10000 --shard i/4 --out remeasure-10k-i.jsonl");
log("             (sharding is by position in the list, so the order matters) IDS =");
for (let i = 0; i < RUN_IDS.length; i += 4) log(`             ${RUN_IDS.slice(i, i + 4).join(",")}${i + 4 < RUN_IDS.length ? "," : ""}`);
log("  new sizes: npx tsx src/dev/signatureFairness.ts grid --abilities smite,sweep --sizes d2m3,d1hp15,d2hp15,hp15,r2hp15 --seeds 1000 --shard i/4 --out s35-grid-i.jsonl");
log("  confirm:   npx tsx src/dev/signatureFairness.ts confirm --in s35-grid-0..3.jsonl --top 3 --seeds 10000 --shard i/4 --out s35-confirm-i.jsonl");
log();

// ---- 1. the reference ----
const ref = JSON.parse(readFileSync(REFERENCE, "utf8")) as Reference;
log(`1. The reference ring at ${ref.seeds.toLocaleString("en-US")} games per ordered pairing (every faction with the plain 3/6)`);
log("   The first 2,500 games of each pairing are exactly the old 2,500-game reference (same seeds), checked when it was made.");
log();
log("   pairing          2,500    10,000");
for (const [k, v] of Object.entries(ref.results)) {
  const rate = (s: string) => [...s].filter((c) => c === "1").length / s.length;
  log(`   ${k.padEnd(15)} ${pct(rate(v.slice(0, 2500))).padStart(6)}%  ${pct(rate(v)).padStart(6)}%`);
}
log();

// ---- 2. the re-measure ----
log("2. Re-measured at 10,000 games per edge: the 7 near misses the owner named, and all 16 approved lines");
log("   (the approved lines too, because a pass at 2,500 is no more certain than a near miss: at 2,500 an edge's 95%");
log("   interval is about +/-1 point, so a 1.8 can be a 2.2. At 10,000 it is about +/-0.5.)");
log();
log("   line                            2,500   10,000   verdict at 10,000   was approved   worst edge at 10,000 [95% interval]");
const sorted = [...ten].sort((a, b) => a.spec.ability.localeCompare(b.spec.ability) || a.worst - b.worst);
for (const r of sorted) {
  const b = before.get(r.id);
  const was = approvedBefore.has(r.id);
  const verdict = r.pass ? (was ? "PASS (stays)" : "PASS (joins)") : was ? "FAIL (leaves)" : "fail";
  log(`   ${r.id.padEnd(30)} ${b ? pct2(b.worst).padStart(6) : "     -"}  ${pct2(r.worst).padStart(6)}   ${verdict.padEnd(18)}  ${(was ? "yes" : "no").padEnd(12)}   ${worstEdge(r)}`);
}
log();
log("   Per faction (each faction's three edges: vs the other three in Cortex, Swarm, Aegis, Null order):");
for (const r of sorted) log(`   ${row(r)}`);
log();

// ---- 3. the new sizes ----
const grid = read<GridLine>("s35-grid-");
const confirm = read<CandidateResult>("s35-confirm-");
if (grid.length > 0) {
  log("3. New sizes (for the next tuner pass): every body with attack 2-4 and health 3-9 at cost 5, 1,000 games per edge.");
  log("   Smite d1 and Sweep r2 miss on a faction split, not on strength (net change near zero at 10,000), so the new");
  log("   sizes change who they help: Smite only on small units, and both only when you're behind (15 or less health).");
  log("   Worst edge in points; lower is better; * = 2.0 or less at 1,000 games.");
  log();
  const bySize = new Map<string, GridLine[]>();
  for (const g of grid) {
    const k = `${g.spec.ability}|${g.spec.size ?? ""}`;
    bySize.set(k, [...(bySize.get(k) ?? []), g]);
  }
  for (const [k, gs] of [...bySize].sort()) {
    const [ability, size] = k.split("|") as [string, string];
    log(`   ${menuOption(ability).name}, ${sizeText({ ability, size: size || undefined })}`);
    const attacks = [...new Set(gs.map((g) => g.spec.attack))].sort();
    const healths = [...new Set(gs.map((g) => g.spec.health))].sort((a, b) => a - b);
    log(`     atk \\ hp ${healths.map((h) => String(h).padStart(6)).join("")}`);
    for (const a of attacks) {
      const cells = healths.map((h) => {
        const g = gs.find((x) => x.spec.attack === a && x.spec.health === h);
        return g ? `${pct(g.worst)}${g.worst <= FAIRNESS_LIMIT + 1e-9 ? "*" : " "}`.padStart(6) : "     -";
      });
      log(`     ${String(a).padStart(8)} ${cells.join("")}`);
    }
    const best = [...gs].sort((x, y) => x.worst - y.worst)[0]!;
    log(`     best: ${best.id} worst ${pct(best.worst)}, net ${signed(best.net)}`);
    log();
  }
  if (confirm.length > 0) {
    log(`   The best ${confirm.length} grid lines re-measured at ${confirm[0]!.seeds.toLocaleString("en-US")} games per edge:`);
    for (const r of [...confirm].sort((a, b) => a.worst - b.worst)) log(`   ${row(r)}`);
    log();
  }
}

// ---- 4. findings ----
const passing = new Map<string, CandidateResult>();
for (const r of [...ten, ...confirm]) if (r.pass && (!passing.has(r.id) || passing.get(r.id)!.worst > r.worst)) passing.set(r.id, r);
const left = sorted.filter((r) => !r.pass && approvedBefore.has(r.id));
const joined = [...passing.values()].filter((r) => !approvedBefore.has(r.id));
log(`${grid.length > 0 ? 4 : 3}. Findings (computed from the data above)`);
log(`   - Before: ${approvedBefore.size} approved lines over ${new Set([...approvedBefore].map((id) => before.get(id)!.spec.ability)).size} options, each passing at 2,500.`);
log(`   - Leave at 10,000: ${left.length ? left.map((r) => `${r.id} (${pct2(r.worst)})`).join(", ") : "none"}.`);
log(`   - Join at 10,000: ${joined.length ? joined.map((r) => `${r.id} (${pct2(r.worst)})`).join(", ") : "none"}.`);
const after = APPROVED_SIGNATURE_LINES;
log(`   - The approved list as generated now (largest measurement decides): ${after.length} lines over ${new Set(after.map((l) => l.spec.ability)).size} options: ${[...new Set(after.map((l) => l.spec.ability))].sort().join(", ")}.`);
const nets = ten.map((r) => netChange(r));
log(`   - Net change over all twelve edges stays small for every re-measured line (${signed(Math.min(...nets))} to ${signed(Math.max(...nets))}): what fails is one`);
log(`     faction's edge, not the card's overall strength.`);

process.stdout.write(out.join("\n") + "\n");
