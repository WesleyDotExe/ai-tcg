// Real, unscripted-play evidence for Phase 3's two Null card redesigns
// (cards/poolLint.ts + data/nullCards.ts's own comments): Corrupted
// Process's evolve effect (damage -> draw a card) and Fork Bomb's arm
// effect (AOE damage -> summon two Fork Child tokens). Both were changed to
// bring Null's pool under the lint's 25% removal/debuff density cap and,
// for Corrupted Process specifically, to give Null the card flow its pool
// had none of at all. This searches real LookaheadAgent-vs-LookaheadAgent
// play — decks built from the actual, lint-passing card pools, drawn and
// cast under real game conditions, not placed by test setup — for a seed
// where both redesigned effects actually fire.

import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import { formatLog } from "../log/format.js";
import type { GameState, GameEvent } from "../state/types.js";
import type { DeckSpec } from "../state/init.js";

const OPPONENTS: { name: string; build: (id: DeckSpec["id"], name: string) => DeckSpec }[] = [
  { name: "Cortex", build: buildCortexDeck },
  { name: "Swarm", build: buildSwarmDeck },
  { name: "Aegis", build: buildAegisDeck },
];

function corruptedProcessDraws(state: GameState): GameEvent[] {
  return state.log.filter((e) => e.type === "abilityTrigger" && e.ability === "corrupted-process-evolve");
}

function forkBombSummons(state: GameState): GameEvent[] {
  return state.log.filter((e) => e.type === "summon" && e.token === "Fork Child");
}

async function findDemonstratingSeed(maxSeed: number) {
  let bestPartial: Awaited<ReturnType<typeof tryOne>> | undefined;

  for (const opponent of OPPONENTS) {
    for (let seed = 1; seed <= maxSeed; seed++) {
      const result = await tryOne(opponent, seed);
      if (result.draws.length > 0 && result.summons.length > 0) return result;
      if (!bestPartial && (result.draws.length > 0 || result.summons.length > 0)) bestPartial = result;
    }
  }
  return bestPartial;
}

async function tryOne(opponent: (typeof OPPONENTS)[number], seed: number) {
  const deckA = buildNullDeck("p1", "Null Deck");
  const deckB = opponent.build("p2", `${opponent.name} Deck`);
  const agentA = new LookaheadAgent(`Lookahead-Null`, seed);
  const agentB = new LookaheadAgent(`Lookahead-${opponent.name}`, seed + 1);
  const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed);
  return {
    matchup: `Null vs ${opponent.name}`,
    seed,
    state,
    movesPlayed,
    deckA,
    deckB,
    agentA,
    agentB,
    draws: corruptedProcessDraws(state),
    summons: forkBombSummons(state),
  };
}

const maxSeed = Number(process.argv[2] ?? 200);
const found = await findDemonstratingSeed(maxSeed);

if (!found) {
  console.error(`No seed in [1, ${maxSeed}] across any matchup produced either redesigned effect. Try a higher range.`);
  process.exit(1);
}

const { matchup, seed, state, movesPlayed, deckA, deckB, agentA, agentB, draws, summons } = found;
console.log(`AI-TCG pool-lint redesign evidence (Phase 3, 2026-09-20 owner feedback) — seed ${seed}, ${matchup}`);
console.log(`${agentA.name} (p1) vs ${agentB.name} (p2)`);
console.log(`Deck sizes: p1=${deckA.cards.length}, p2=${deckB.cards.length}`);
console.log("");
console.log(formatLog(state.log));
console.log("");
console.log("--- Summary ---");
console.log(`Winner: ${state.winner}`);
console.log(`Turns played: ${state.turnNumber}`);
console.log(`Moves applied: ${movesPlayed}`);
console.log(`Corrupted Process evolve-draws this match: ${draws.length}`);
console.log(`Fork Bomb tokens summoned this match: ${summons.length}`);
if (draws.length === 0) console.log("  (Corrupted Process's redesigned draw did not fire in this particular match — see quality-debt.md.)");
if (summons.length === 0) console.log("  (Fork Bomb's redesigned summon did not arm in this particular match — see quality-debt.md.)");
