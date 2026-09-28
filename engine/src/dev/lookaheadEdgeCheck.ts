// A larger-sample, Lookahead-only check of one faction's three cross-faction
// edges, on any seed range. balanceReport.ts is the standard instrument (300
// seeds, all three policies). This exists because 300 seeds gives about a
// 2.9-point standard error, and the Phase 5 Cortex slice found that was not
// enough: the baseline Null-vs-Cortex edge read 55.0% Cortex on seeds 1-300
// (in its even band) but 59.3% on seeds 301-900. It also lets a tuning pass
// pick a card mix on one seed range and confirm it on another, so a result
// is not just a fit to the seeds it was chosen on.
//
// Seeding, deck ids and who-goes-first match balanceReport.ts's Lookahead
// section exactly, so seeds 1-300 here reproduce its Lookahead numbers.
//
// Each edge also prints its 95% Wilson interval and a verdict against the
// ring band on that interval (edgeMeasure.ts's bandVerdict), per the owner's
// 2026-09-26 entry: out of band only when the interval misses the band.
//
// Usage: npx tsx src/dev/lookaheadEdgeCheck.ts <Faction> [firstSeed=1] [count=900]

import { FACTIONS, measureEdges, wilson, bandVerdict, ringBand } from "./edgeMeasure.js";
import type { Faction } from "../cards/types.js";

const faction = process.argv[2] as Faction;
if (!FACTIONS.includes(faction)) {
  console.error(`Usage: lookaheadEdgeCheck.ts <${FACTIONS.join("|")}> [firstSeed] [count]`);
  process.exit(1);
}
const firstSeed = Number(process.argv[3] ?? 1);
const count = Number(process.argv[4] ?? 900);

console.log(`LookaheadAgent vs LookaheadAgent, ${faction} against each other faction, seeds ${firstSeed}-${firstSeed + count - 1}`);
for (const r of await measureEdges(faction, firstSeed, count)) {
  const rate = r.selfWins / r.games;
  const se = Math.sqrt((rate * (1 - rate)) / r.games) * 100;
  const ci = wilson(r.selfWins, r.games);
  const band = ringBand(faction, r.opponent);
  console.log(
    `  ${faction} vs ${r.opponent}: ${faction} ${(rate * 100).toFixed(1)}% (+/- ${se.toFixed(1)} one SE, ` +
      `95% CI ${(ci.lo * 100).toFixed(1)}-${(ci.hi * 100).toFixed(1)}, ${r.draws} draws) ` +
      `band ${(band.lo * 100).toFixed(0)}-${(band.hi * 100).toFixed(0)}: ${bandVerdict(r.selfWins, r.games, band)}`,
  );
}
