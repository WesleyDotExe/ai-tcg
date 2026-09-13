// Stage-3 evidence: a REAL played match (not a whitebox scenario — see
// effectSystemDemo.ts for that) using the new Aegis faction deck, searched
// over seeds for one where all three new board-development mechanics
// (telegraph arming, evolution, tool attachment) actually fire during real
// play, the same "search real games for a demonstrating seed" approach the
// stage-1/2 sessions used (e.g. the 60-seed stress run in progress/log.md).
// Both agents are the existing dummy agents (RandomAgent/AggressiveAgent)
// talking to the engine through the same in-process Agent interface stage 2
// proved works over a real network boundary too — no new agent logic was
// needed for the new mechanics because getLegalMoves already offers them
// like any other move.

import { buildAegisDeck, buildCortexDeck } from "../data/decks.js";
import { RandomAgent } from "../agents/randomAgent.js";
import { AggressiveAgent } from "../agents/aggressiveAgent.js";
import { runMatch } from "../engine/match.js";
import { formatLog } from "../log/format.js";
import type { GameState } from "../state/types.js";

function hasEventsOfInterest(state: GameState): { telegraph: boolean; evolve: boolean; tool: boolean } {
  return {
    telegraph: state.log.some((e) => e.type === "telegraphArmed"),
    evolve: state.log.some((e) => e.type === "evolve"),
    tool: state.log.some((e) => e.type === "toolAttached"),
  };
}

async function findDemonstratingSeed(maxSeed: number) {
  for (let seed = 1; seed <= maxSeed; seed++) {
    const deckA = buildAegisDeck("p1", "Aegis Deck");
    const deckB = buildCortexDeck("p2", "Cortex Deck");
    const agentA = new RandomAgent("Random-Aegis", seed);
    const agentB = new AggressiveAgent("Aggressive-Cortex");
    const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed);
    const hits = hasEventsOfInterest(state);
    if (hits.telegraph && hits.evolve && hits.tool) {
      return { seed, state, movesPlayed, deckA, deckB, agentA, agentB };
    }
  }
  return undefined;
}

const maxSeed = Number(process.argv[2] ?? 500);
const found = await findDemonstratingSeed(maxSeed);

if (!found) {
  console.error(`No seed in [1, ${maxSeed}] produced a match exercising telegraph+evolve+tool. Try a higher range.`);
  process.exit(1);
}

const { seed, state, movesPlayed, deckA, deckB, agentA, agentB } = found;
console.log(`AI-TCG Stage 3 evidence — Aegis faction real match — demonstrating seed ${seed}`);
console.log(`${agentA.name} (Aegis, p1) vs ${agentB.name} (Cortex, p2)`);
console.log(`Deck sizes: p1=${deckA.cards.length}, p2=${deckB.cards.length}`);
console.log("");
console.log(formatLog(state.log));
console.log("");
console.log("--- Summary ---");
console.log(`Winner: ${state.winner}`);
console.log(`Turns played: ${state.turnNumber}`);
console.log(`Moves applied: ${movesPlayed}`);
console.log(`Final health — p1 (${state.players.p1.name}): ${state.players.p1.health}, p2 (${state.players.p2.name}): ${state.players.p2.health}`);
console.log(`p1 board size: ${state.players.p1.board.length}, p2 board size: ${state.players.p2.board.length}`);
console.log(`p1 graveyard: ${state.players.p1.graveyard.length}, p2 graveyard: ${state.players.p2.graveyard.length}`);
const telegraphPlaced = state.log.filter((e) => e.type === "telegraphPlaced").length;
const telegraphArmed = state.log.filter((e) => e.type === "telegraphArmed").length;
const evolves = state.log.filter((e) => e.type === "evolve").length;
const toolsAttached = state.log.filter((e) => e.type === "toolAttached").length;
console.log(`Board-development events — telegraphed: ${telegraphPlaced} (armed: ${telegraphArmed}), evolutions: ${evolves}, tools attached: ${toolsAttached}`);
