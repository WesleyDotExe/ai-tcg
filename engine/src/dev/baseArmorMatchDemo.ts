// Real, unscripted-play evidence for Phase 2 item 5 of the 2026-09-20
// owner-feedback entry ("bases carry a small protection while unevolved").
// test/baseArmor.test.ts already proves the mechanism whitebox (damage is
// reduced by the card's flat baseArmor, floored at 0, and the protection
// ends the instant a unit evolves past the tier that carries it); this
// searches real LookaheadAgent-vs-LookaheadAgent play — decks built from the
// actual card pools, drawn and cast under real game conditions — for a seed
// where at least one of the six armored base cards (Aegis Cadet/Sentinel,
// Null Glitch Seed/Corrupted Process, Cortex Init Daemon, Swarm Larva)
// actually absorbs damage for real.

import { buildCortexDeck, buildAegisDeck, buildSwarmDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import { formatLog } from "../log/format.js";
import type { GameState } from "../state/types.js";
import type { DeckSpec } from "../state/init.js";

const MATCHUPS: { name: string; buildA: (id: DeckSpec["id"], name: string) => DeckSpec; buildB: (id: DeckSpec["id"], name: string) => DeckSpec }[] = [
  { name: "Cortex vs Aegis", buildA: buildCortexDeck, buildB: buildAegisDeck },
  { name: "Aegis vs Swarm", buildA: buildAegisDeck, buildB: buildSwarmDeck },
  { name: "Swarm vs Null", buildA: buildSwarmDeck, buildB: buildNullDeck },
  { name: "Null vs Cortex", buildA: buildNullDeck, buildB: buildCortexDeck },
];

function baseArmorEvents(state: GameState) {
  return state.log.filter((e) => e.type === "baseArmorReduced");
}

async function findDemonstratingSeed(maxSeed: number) {
  for (const matchup of MATCHUPS) {
    for (let seed = 1; seed <= maxSeed; seed++) {
      const deckA = matchup.buildA("p1", `${matchup.name.split(" vs ")[0]} Deck`);
      const deckB = matchup.buildB("p2", `${matchup.name.split(" vs ")[1]} Deck`);
      const agentA = new LookaheadAgent(`Lookahead-${deckA.name}`, seed);
      const agentB = new LookaheadAgent(`Lookahead-${deckB.name}`, seed + 1);
      const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed);
      const hits = baseArmorEvents(state);
      if (hits.length > 0) {
        return { matchup: matchup.name, seed, state, movesPlayed, deckA, deckB, agentA, agentB, hits };
      }
    }
  }
  return undefined;
}

const maxSeed = Number(process.argv[2] ?? 200);
const found = await findDemonstratingSeed(maxSeed);

if (!found) {
  console.error(`No seed in [1, ${maxSeed}] across any matchup produced a real baseArmorReduced event. Try a higher range.`);
  process.exit(1);
}

const { matchup, seed, state, movesPlayed, deckA, deckB, agentA, agentB, hits } = found;
console.log(`AI-TCG base-armor evidence (2026-09-20 owner feedback, Phase 2 item 5) — demonstrating seed ${seed}, ${matchup}`);
console.log(`${agentA.name} (p1) vs ${agentB.name} (p2)`);
console.log(`Deck sizes: p1=${deckA.cards.length}, p2=${deckB.cards.length}`);
console.log("");
console.log(formatLog(state.log));
console.log("");
console.log("--- Summary ---");
console.log(`Winner: ${state.winner}`);
console.log(`Turns played: ${state.turnNumber}`);
console.log(`Moves applied: ${movesPlayed}`);
console.log(`Base-armor reduction(s) this match: ${hits.length}`);
for (const hit of hits) {
  if (hit.type === "baseArmorReduced") {
    console.log(`  - ${hit.unit} reduced ${hit.rawAmount} damage from ${hit.source} to ${hit.reducedTo}`);
  }
}
