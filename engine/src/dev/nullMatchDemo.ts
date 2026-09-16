// Stage-3-continuation evidence (progress/roadmap.md item 1, the fourth
// faction): a REAL played match, not a whitebox scenario — see
// test/nullFaction.test.ts for that — searched over seeds for one where
// Null's board-development cards actually fire during real play (the same
// approach aegisMatchDemo.ts used for Aegis). Both agents are the existing
// dummy agents talking to the engine through the same Agent interface; no
// new agent logic was needed since getLegalMoves already offers Null's
// cards like any other card.

import { buildNullDeck, buildAegisDeck } from "../data/decks.js";
import { RandomAgent } from "../agents/randomAgent.js";
import { AggressiveAgent } from "../agents/aggressiveAgent.js";
import { runMatch } from "../engine/match.js";
import { formatLog } from "../log/format.js";
import type { GameState, GameEvent } from "../state/types.js";

/** Unlike aegisMatchDemo.ts's generic telegraph/evolve/tool check, this
 * looks specifically for NULL's own copies of each mechanic firing (not
 * just any faction's) — Fork Bomb/Deprecated Routine arming, Corrupted
 * Process evolving into Kernel Panic (which exercises the new `destroy`
 * effect), and a Null Tool attaching — plus at least one death, since
 * Null's whole identity is attrition/removal. */
function hasEventsOfInterest(state: GameState) {
  const named = (e: GameEvent, ...names: string[]) => {
    const text = JSON.stringify(e);
    return names.some((n) => text.includes(n));
  };
  return {
    nullTelegraphArmed: state.log.some((e) => e.type === "telegraphArmed" && named(e, "Fork Bomb", "Deprecated Routine")),
    nullEvolve: state.log.some((e) => e.type === "evolve" && named(e, "Corrupted Process", "Kernel Panic", "Glitch Seed")),
    nullTool: state.log.some((e) => e.type === "toolAttached" && named(e, "Corruption Patch", "Null Shell", "Decay Ward")),
    death: state.log.some((e) => e.type === "death"),
  };
}

async function findDemonstratingSeed(maxSeed: number) {
  for (let seed = 1; seed <= maxSeed; seed++) {
    const deckA = buildNullDeck("p1", "Null Deck");
    const deckB = buildAegisDeck("p2", "Aegis Deck");
    const agentA = new RandomAgent("Random-Null", seed);
    const agentB = new AggressiveAgent("Aggressive-Aegis");
    const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed);
    const hits = hasEventsOfInterest(state);
    if (hits.nullTelegraphArmed && hits.nullEvolve && hits.nullTool && hits.death) {
      return { seed, state, movesPlayed, deckA, deckB, agentA, agentB };
    }
  }
  return undefined;
}

const maxSeed = Number(process.argv[2] ?? 500);
const found = await findDemonstratingSeed(maxSeed);

if (!found) {
  console.error(`No seed in [1, ${maxSeed}] produced a match exercising Null's own telegraph+evolve+tool+a death. Try a higher range.`);
  process.exit(1);
}

const { seed, state, movesPlayed, deckA, deckB, agentA, agentB } = found;
console.log(`AI-TCG fourth-faction evidence — Null faction real match — demonstrating seed ${seed}`);
console.log(`${agentA.name} (Null, p1) vs ${agentB.name} (Aegis, p2)`);
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
const deaths = state.log.filter((e) => e.type === "death").length;
console.log(`Board-development events — telegraphed: ${telegraphPlaced} (armed: ${telegraphArmed}), evolutions: ${evolves}, tools attached: ${toolsAttached}`);
console.log(`Deaths this match: ${deaths} (Null's identity leans on removal/decay, not just combat — see progress/log.md for which cards fired)`);
