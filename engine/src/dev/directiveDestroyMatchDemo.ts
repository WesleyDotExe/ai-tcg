// Real, unscripted-play evidence for Phase 2 item 3 of the 2026-09-20
// owner-feedback entry ("Directives must be removable ... give every
// faction one answer"). test/directiveDestroy.test.ts already proves the
// mechanism whitebox (each faction's new card destroys a directive placed
// directly on the board); this searches real LookaheadAgent-vs-LookaheadAgent
// play — decks built from the actual card pools, drawn and cast under real
// game conditions, not placed by test setup — for a seed where at least one
// of the four new answer cards (Force Quit, Breach Charge, Bore Swarm, Null
// Pointer) actually destroys a real enemy directive. LookaheadAgent is used
// on both sides deliberately: it's the one reference agent whose scoring
// (this session's own addition to it) knows a Directive is worth destroying
// at all — see agents/lookaheadAgent.ts's estimateEffect "destroy" case.

import { buildCortexDeck, buildAegisDeck, buildSwarmDeck } from "../data/decks.js";
import { buildNullDeck } from "../data/decks.js";
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

function directiveDestroyedEvents(state: GameState) {
  return state.log.filter((e) => e.type === "directiveDestroyed");
}

async function findDemonstratingSeed(maxSeed: number) {
  for (const matchup of MATCHUPS) {
    for (let seed = 1; seed <= maxSeed; seed++) {
      const deckA = matchup.buildA("p1", `${matchup.name.split(" vs ")[0]} Deck`);
      const deckB = matchup.buildB("p2", `${matchup.name.split(" vs ")[1]} Deck`);
      const agentA = new LookaheadAgent(`Lookahead-${deckA.name}`, seed);
      const agentB = new LookaheadAgent(`Lookahead-${deckB.name}`, seed + 1);
      const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed);
      const hits = directiveDestroyedEvents(state);
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
  console.error(`No seed in [1, ${maxSeed}] across any matchup produced a real directiveDestroyed event. Try a higher range.`);
  process.exit(1);
}

const { matchup, seed, state, movesPlayed, deckA, deckB, agentA, agentB, hits } = found;
console.log(`AI-TCG directive-removal evidence (2026-09-20 owner feedback, Phase 2 item 3) — demonstrating seed ${seed}, ${matchup}`);
console.log(`${agentA.name} (p1) vs ${agentB.name} (p2)`);
console.log(`Deck sizes: p1=${deckA.cards.length}, p2=${deckB.cards.length}`);
console.log("");
console.log(formatLog(state.log));
console.log("");
console.log("--- Summary ---");
console.log(`Winner: ${state.winner}`);
console.log(`Turns played: ${state.turnNumber}`);
console.log(`Moves applied: ${movesPlayed}`);
console.log(`Directive(s) destroyed this match: ${hits.length}`);
for (const hit of hits) {
  if (hit.type === "directiveDestroyed") {
    console.log(`  - ${hit.source} destroyed ${hit.directive} (controlled by ${hit.controller})`);
  }
}
