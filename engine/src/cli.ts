import { buildCortexDeck, buildSwarmDeck } from "./data/decks.js";
import { RandomAgent } from "./agents/randomAgent.js";
import { AggressiveAgent } from "./agents/aggressiveAgent.js";
import { runMatch } from "./engine/match.js";
import { formatLog } from "./log/format.js";

const seed = Number(process.argv[2] ?? 1);

const deckA = buildCortexDeck("p1", "Cortex Deck");
const deckB = buildSwarmDeck("p2", "Swarm Deck");
const agentA = new RandomAgent("Random-Cortex", seed);
const agentB = new AggressiveAgent("Aggressive-Swarm");

const { state, movesPlayed } = runMatch(deckA, deckB, agentA, agentB, seed);

console.log(`AI-TCG sample match — seed ${seed}`);
console.log(`${agentA.name} (Cortex, p1) vs ${agentB.name} (Swarm, p2)`);
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
