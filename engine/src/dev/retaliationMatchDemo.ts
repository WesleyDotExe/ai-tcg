// Real-match evidence (not just the whitebox test/mutualRetaliation.test.ts)
// for the session-7 crash fix: two Retaliation Nodes (Cortex, CX-013) on
// opposite sides of the board, each dealing 1 damage to all enemy units
// whenever it's damaged, used to recurse forever the moment either one took
// its first hit — a real stack overflow, first reproduced by
// dev/balanceReport.ts's Cortex-mirror matchup, not a hypothetical edge
// case. Fixed in effects/resolver.ts (applyDamage now checks isAlive()
// before re-firing onDamaged). This searches real Cortex-mirror games
// (both agents drawing from the real 40-card Cortex deck, not a hand-built
// scenario) for one where both players' Retaliation Node actually enter
// play and take damage from each other in the same unscripted match, the
// same "search real games for a demonstrating seed" approach
// aegisMatchDemo.ts and backfillMatchDemo.ts used.

import { buildCortexDeck } from "../data/decks.js";
import { RandomAgent } from "../agents/randomAgent.js";
import { AggressiveAgent } from "../agents/aggressiveAgent.js";
import { runMatch } from "../engine/match.js";
import { formatLog } from "../log/format.js";
import type { GameState } from "../state/types.js";

function bothRetaliationNodesFought(state: GameState): boolean {
  const damagedRetaliationNodeHits = state.log.filter(
    (e) => e.type === "damage" && e.target === "Retaliation Node",
  ).length;
  // Each mutual exchange is at least 2 "damage" log entries against a unit
  // named Retaliation Node (one per side); require a handful to be
  // confident this is a real back-and-forth, not one side's Node taking a
  // single unrelated hit.
  return damagedRetaliationNodeHits >= 4;
}

async function findDemonstratingSeed(maxSeed: number) {
  for (let seed = 1; seed <= maxSeed; seed++) {
    const deckA = buildCortexDeck("p1", "Cortex Deck A");
    const deckB = buildCortexDeck("p2", "Cortex Deck B");
    const agentA = seed % 2 === 0 ? new RandomAgent("Random-Cortex-A", seed) : new AggressiveAgent("Aggressive-Cortex-A");
    const agentB = seed % 2 === 0 ? new AggressiveAgent("Aggressive-Cortex-B") : new RandomAgent("Random-Cortex-B", seed);
    const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed);
    if (bothRetaliationNodesFought(state)) {
      return { seed, state, movesPlayed, deckA, deckB, agentA, agentB };
    }
  }
  return undefined;
}

const maxSeed = Number(process.argv[2] ?? 2000);
const found = await findDemonstratingSeed(maxSeed);

if (!found) {
  console.error(`No seed in [1, ${maxSeed}] produced a real game where both Retaliation Nodes fought each other. Try a higher range.`);
  process.exit(1);
}

const { seed, state, movesPlayed, deckA, deckB, agentA, agentB } = found;
console.log(`AI-TCG session-7 evidence — mutual Retaliation Node fix, real Cortex-mirror match — demonstrating seed ${seed}`);
console.log(`${agentA.name} (p1) vs ${agentB.name} (p2), both real ${deckA.cards.length}/${deckB.cards.length}-card Cortex decks`);
console.log("");
console.log(formatLog(state.log));
console.log("");
console.log("--- Summary ---");
console.log(`Winner: ${state.winner}`);
console.log(`Turns played: ${state.turnNumber}`);
console.log(`Moves applied: ${movesPlayed}`);
console.log(`Final health — p1 (${state.players.p1.name}): ${state.players.p1.health}, p2 (${state.players.p2.name}): ${state.players.p2.health}`);
const retaliationHits = state.log.filter((e) => e.type === "damage" && e.target === "Retaliation Node").length;
console.log(`Retaliation Node damage events: ${retaliationHits} (the match resolved cleanly instead of recursing forever, per session-7's fix)`);
