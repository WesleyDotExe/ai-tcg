// Phase 1 item 1 evidence (2026-09-20 owner feedback, "fix the instrument
// before any further balance change"): a real played match showing
// LookaheadAgent actually using the fix this session made to it — see
// agents/lookaheadAgent.ts's own header comment on the "all"/"self"-scope
// bug a first 300-seed balanceReport.ts run caught (an AOE sweep or
// self-heal scored zero forever, because it has no Move.target for the
// old per-move-target scoring to read). This searches for a seed where a
// LookaheadAgent actually casts one of the specific cards that bug broke
// (Cascade Purge, Lockdown Field, Rally Cry, Backup Protocol, Diagnostic
// Ward — all "all"/"self" scope, all previously unplayable by this agent).

import { buildCortexDeck, buildAegisDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import { formatLog } from "../log/format.js";
import type { GameState } from "../state/types.js";

const FIXED_CARDS = ["Cascade Purge", "Lockdown Field", "Rally Cry", "Backup Protocol", "Diagnostic Ward"];

function castOneOfTheFixedCards(state: GameState): string | undefined {
  for (const event of state.log) {
    if (event.type === "cast" && FIXED_CARDS.includes(event.card)) return event.card;
  }
  return undefined;
}

async function findDemonstratingSeed(maxSeed: number) {
  for (let seed = 1; seed <= maxSeed; seed++) {
    const deckA = buildCortexDeck("p1", "Cortex Deck");
    const deckB = buildAegisDeck("p2", "Aegis Deck");
    const agentA = new LookaheadAgent("Lookahead-Cortex", seed * 104729 + 31);
    const agentB = new LookaheadAgent("Lookahead-Aegis", seed * 104729 + 31);
    const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed);
    const fixedCard = castOneOfTheFixedCards(state);
    if (fixedCard) return { seed, state, movesPlayed, deckA, deckB, agentA, agentB, fixedCard };
  }
  return undefined;
}

const maxSeed = Number(process.argv[2] ?? 500);
const found = await findDemonstratingSeed(maxSeed);

if (!found) {
  console.error(`No seed in [1, ${maxSeed}] produced a match where LookaheadAgent cast one of ${FIXED_CARDS.join(", ")}. Try a higher range.`);
  process.exit(1);
}

const { seed, state, movesPlayed, deckA, deckB, agentA, agentB, fixedCard } = found;
console.log(`AI-TCG LookaheadAgent evidence — real match, demonstrating seed ${seed}`);
console.log(`${agentA.name} (Cortex, p1) vs ${agentB.name} (Aegis, p2)`);
console.log(`Deck sizes: p1=${deckA.cards.length}, p2=${deckB.cards.length}`);
console.log(`This match's proof: LookaheadAgent actually cast "${fixedCard}" — an "all"/"self"-scope Command that`);
console.log(`the pre-fix scoring valued at zero forever (see lookaheadAgent.ts's header comment).`);
console.log("");
console.log(formatLog(state.log));
console.log("");
console.log("--- Summary ---");
console.log(`Winner: ${state.winner}`);
console.log(`Turns played: ${state.turnNumber}`);
console.log(`Moves applied: ${movesPlayed}`);
console.log(`Final health — p1 (${state.players.p1.name}): ${state.players.p1.health}, p2 (${state.players.p2.name}): ${state.players.p2.health}`);
const fizzles = state.log.filter((e) => e.type === "fizzle").length;
const redirects = state.log.filter((e) => e.type === "attackRedirected").length;
console.log(`Fizzles this match: ${fizzles}, attack redirects: ${redirects}`);
console.log(
  `(A fizzle here would mean a reactive card was cast with nothing to react to — the "holds Instants for a target"`,
);
console.log(`requirement this agent is also built to satisfy; see lookaheadAgent.test.ts for a dedicated, isolated test of that.)`);
