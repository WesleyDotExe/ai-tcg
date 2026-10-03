// Phase 5 gate (session 26): measures the one pre-authorized gate-time lever,
// dropping Quorum Arbiter from the Cortex deck (owner-feedback 2026-09-26
// item 3: "If Cortex-vs-Null is still out of band there, THEN drop Quorum
// Arbiter"). The session-22 finding was that Cortex's rates vs Null and vs
// Swarm move together, so this prints all three Cortex edges for the shipped
// deck and for the deck without the Mythic, each with its ring-band verdict,
// plus the Newcombe interval on the change. Run on the gate's own seeds and
// again on a held-out range, so a result isn't a fit to one seed set.
//
// Usage: npx tsx src/dev/phase5GateLevers.ts [firstSeed=1] [count=2500]

import { measureEdges, newcombeDiff, shippedPool, wilson, bandVerdict, ringBand } from "./edgeMeasure.js";
import type { Pool } from "./edgeMeasure.js";

const firstSeed = Number(process.argv[2] ?? 1);
const count = Number(process.argv[3] ?? 2500);
const pct = (x: number) => (x * 100).toFixed(1);

const variants: { label: string; pool: Pool }[] = [
  { label: "shipped Cortex", pool: shippedPool("Cortex") },
  { label: "Cortex -1 Quorum Arbiter", pool: shippedPool("Cortex").filter((p) => p.card.name !== "Quorum Arbiter") },
];

console.log(`Phase 5 gate lever: Quorum Arbiter, LookaheadAgent, seeds ${firstSeed}-${firstSeed + count - 1}`);
const base = await measureEdges("Cortex", firstSeed, count, { pool: variants[0]!.pool });
for (const v of variants) {
  const rs = v === variants[0] ? base : await measureEdges("Cortex", firstSeed, count, { pool: v.pool });
  const size = v.pool.reduce((n, p) => n + p.copies, 0);
  console.log(`  ${v.label} (${size} cards)`);
  for (const r of rs) {
    const ci = wilson(r.selfWins, r.games);
    const band = ringBand("Cortex", r.opponent);
    const b = base.find((x) => x.opponent === r.opponent)!;
    const d = newcombeDiff(r.selfWins, r.games, b.selfWins, b.games);
    console.log(
      `    vs ${r.opponent.padEnd(6)} Cortex ${pct(r.selfWins / r.games)}% (CI ${pct(ci.lo)}-${pct(ci.hi)}) ` +
        `band ${pct(band.lo)}-${pct(band.hi)}: ${bandVerdict(r.selfWins, r.games, band)}` +
        (v === variants[0] ? "" : `  change ${d.diff >= 0 ? "+" : ""}${pct(d.diff)} [${pct(d.lo)}, ${pct(d.hi)}]`),
    );
  }
}
