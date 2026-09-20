// Real, unscripted-play evidence for Phase 2 item 4 of the 2026-09-20
// owner-feedback entry ("Add a 'summon' (token) effect kind so wide decks
// can rebuild after board-wide damage"). test/summon.test.ts already proves
// the mechanism whitebox (Brood Reserves creates two real, fully-functional
// token units, respects the board-slot cap, and scores correctly for
// LookaheadAgent); this searches real LookaheadAgent-vs-LookaheadAgent play —
// decks built from the actual card pools, drawn and cast under real game
// conditions, not placed by test setup — for a seed where Brood Reserves is
// actually drawn and cast, producing a real "summon" event.

import { buildSwarmDeck, buildCortexDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import { formatLog } from "../log/format.js";
import type { GameState } from "../state/types.js";
import type { DeckSpec } from "../state/init.js";

const OPPONENTS: { name: string; build: (id: DeckSpec["id"], name: string) => DeckSpec }[] = [
  { name: "Cortex", build: buildCortexDeck },
  { name: "Aegis", build: buildAegisDeck },
  { name: "Null", build: buildNullDeck },
];

function summonEvents(state: GameState) {
  return state.log.filter((e) => e.type === "summon");
}

async function findDemonstratingSeed(maxSeed: number) {
  for (const opponent of OPPONENTS) {
    for (let seed = 1; seed <= maxSeed; seed++) {
      const deckA = buildSwarmDeck("p1", "Swarm Deck");
      const deckB = opponent.build("p2", `${opponent.name} Deck`);
      const agentA = new LookaheadAgent(`Lookahead-Swarm`, seed);
      const agentB = new LookaheadAgent(`Lookahead-${opponent.name}`, seed + 1);
      const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed);
      const hits = summonEvents(state);
      if (hits.length > 0) {
        return { matchup: `Swarm vs ${opponent.name}`, seed, state, movesPlayed, deckA, deckB, agentA, agentB, hits };
      }
    }
  }
  return undefined;
}

const maxSeed = Number(process.argv[2] ?? 200);
const found = await findDemonstratingSeed(maxSeed);

if (!found) {
  console.error(`No seed in [1, ${maxSeed}] across any matchup produced a real summon event. Try a higher range.`);
  process.exit(1);
}

const { matchup, seed, state, movesPlayed, deckA, deckB, agentA, agentB, hits } = found;
console.log(`AI-TCG summon/token evidence (2026-09-20 owner feedback, Phase 2 item 4) — demonstrating seed ${seed}, ${matchup}`);
console.log(`${agentA.name} (p1) vs ${agentB.name} (p2)`);
console.log(`Deck sizes: p1=${deckA.cards.length}, p2=${deckB.cards.length}`);
console.log("");
console.log(formatLog(state.log));
console.log("");
console.log("--- Summary ---");
console.log(`Winner: ${state.winner}`);
console.log(`Turns played: ${state.turnNumber}`);
console.log(`Moves applied: ${movesPlayed}`);
console.log(`Token(s) summoned this match: ${hits.length}`);
for (const hit of hits) {
  if (hit.type === "summon") {
    console.log(`  - ${hit.source} summoned ${hit.token} (${hit.instanceId}) for ${hit.player}`);
  }
}
