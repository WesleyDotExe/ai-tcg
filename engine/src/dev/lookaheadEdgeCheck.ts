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
// Usage: npx tsx src/dev/lookaheadEdgeCheck.ts <Faction> [firstSeed=1] [count=900]

import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import type { DeckSpec } from "../state/init.js";
import type { Faction } from "../cards/types.js";

const FACTIONS: Faction[] = ["Cortex", "Swarm", "Aegis", "Null"];
const deckBuilders: Record<Faction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
  Null: buildNullDeck,
};

const faction = process.argv[2] as Faction;
if (!FACTIONS.includes(faction)) {
  console.error(`Usage: lookaheadEdgeCheck.ts <${FACTIONS.join("|")}> [firstSeed] [count]`);
  process.exit(1);
}
const firstSeed = Number(process.argv[3] ?? 1);
const count = Number(process.argv[4] ?? 900);

console.log(`LookaheadAgent vs LookaheadAgent, ${faction} against each other faction, seeds ${firstSeed}-${firstSeed + count - 1}`);
for (const opponent of FACTIONS.filter((f) => f !== faction)) {
  // balanceReport.ts puts the earlier faction in FACTIONS order in slot A.
  const aIsSelf = FACTIONS.indexOf(faction) < FACTIONS.indexOf(opponent);
  const [factionA, factionB] = aIsSelf ? [faction, opponent] : [opponent, faction];
  let selfWins = 0;
  let draws = 0;
  for (let seed = firstSeed; seed < firstSeed + count; seed++) {
    const aGoesFirst = seed % 2 === 1;
    const deckA = deckBuilders[factionA]("p1", `${factionA} Deck`);
    const deckB = deckBuilders[factionB]("p2", `${factionB} Deck`);
    const agentA = new LookaheadAgent(`Lookahead-${factionA}`, seed * 104729 + 31);
    const agentB = new LookaheadAgent(`Lookahead-${factionB}`, seed * 104729 + 31);
    const { state } = aGoesFirst
      ? await runMatch(deckA, deckB, agentA, agentB, seed)
      : await runMatch(deckB, deckA, agentB, agentA, seed);
    if (state.winner === "draw") {
      draws++;
      continue;
    }
    const aWon = (state.winner === "p1") === aGoesFirst;
    if (aWon === aIsSelf) selfWins++;
  }
  const rate = selfWins / count;
  const se = Math.sqrt((rate * (1 - rate)) / count) * 100;
  console.log(`  ${faction} vs ${opponent}: ${faction} ${(rate * 100).toFixed(1)}% (+/- ${se.toFixed(1)} one SE, ${draws} draws)`);
}
