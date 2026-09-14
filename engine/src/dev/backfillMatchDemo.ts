// Evidence for the board-development backfill (data/cards.ts): searches
// real Cortex-vs-Swarm games — the two stage-1 factions, not Aegis — for one
// where BOTH sides' new telegraph/evolution/Tool cards actually fire, the
// same "search real games for a demonstrating seed" approach
// dev/aegisMatchDemo.ts used for stage 3. This is the direct proof that the
// backfill isn't just data that type-checks: it's mechanically alive in
// real, unscripted play on both factions the system was previously missing
// from.

import { buildCortexDeck, buildSwarmDeck } from "../data/decks.js";
import { RandomAgent } from "../agents/randomAgent.js";
import { AggressiveAgent } from "../agents/aggressiveAgent.js";
import { runMatch } from "../engine/match.js";
import { formatLog } from "../log/format.js";
import type { GameState } from "../state/types.js";

const CORTEX_EVOLVE_TO = "Compiled Daemon";
const SWARM_EVOLVE_TO = "Molted Stalker";
const CORTEX_TOOL = "Overclock Shunt";
const SWARM_TOOL = "Chitin Plating";

function hits(state: GameState) {
  const telegraphArmed = state.log.filter((e) => e.type === "telegraphArmed").map((e) => e.unit);
  const evolves = state.log.filter((e) => e.type === "evolve").map((e) => e.to);
  const tools = state.log.filter((e) => e.type === "toolAttached").map((e) => e.tool);
  return {
    cortexTelegraph: telegraphArmed.includes("Dormant Exploit"),
    swarmTelegraph: telegraphArmed.includes("Dormant Egg Sac"),
    cortexEvolve: evolves.includes(CORTEX_EVOLVE_TO),
    swarmEvolve: evolves.includes(SWARM_EVOLVE_TO),
    cortexTool: tools.includes(CORTEX_TOOL),
    swarmTool: tools.includes(SWARM_TOOL),
  };
}

function allHit(h: ReturnType<typeof hits>): boolean {
  return Object.values(h).every(Boolean);
}

async function findDemonstratingSeed(maxSeed: number) {
  let best: { seed: number; state: GameState; movesPlayed: number; score: number } | undefined;
  for (let seed = 1; seed <= maxSeed; seed++) {
    const deckA = buildCortexDeck("p1", "Cortex Deck");
    const deckB = buildSwarmDeck("p2", "Swarm Deck");
    const agentA = seed % 2 === 0 ? new RandomAgent("Random-Cortex", seed) : new AggressiveAgent("Aggressive-Cortex");
    const agentB = seed % 2 === 0 ? new AggressiveAgent("Aggressive-Swarm") : new RandomAgent("Random-Swarm", seed);
    const { state, movesPlayed } = await runMatch(deckA, deckB, agentA, agentB, seed);
    const h = hits(state);
    if (allHit(h)) return { seed, state, movesPlayed, agentA, agentB, deckA, deckB };
    const score = Object.values(h).filter(Boolean).length;
    if (!best || score > best.score) best = { seed, state, movesPlayed, score };
  }
  return { best };
}

const maxSeed = Number(process.argv[2] ?? 2000);
const found = await findDemonstratingSeed(maxSeed);

if (!("seed" in found) || found.seed === undefined) {
  const b = (found as { best?: { seed: number; score: number } }).best;
  console.error(
    `No seed in [1, ${maxSeed}] hit all 6 backfill events in one game (best: seed ${b?.seed} with ${b?.score}/6). Try a higher range.`,
  );
  process.exit(1);
}

const { seed, state, movesPlayed, agentA, agentB, deckA, deckB } = found as {
  seed: number;
  state: GameState;
  movesPlayed: number;
  agentA: { name: string };
  agentB: { name: string };
  deckA: { cards: unknown[] };
  deckB: { cards: unknown[] };
};

console.log(`AI-TCG board-development backfill evidence — Cortex vs Swarm real match — demonstrating seed ${seed}`);
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
const h = hits(state);
console.log(`Backfill events — Cortex telegraph armed (Dormant Exploit): ${h.cortexTelegraph}, Swarm telegraph armed (Dormant Egg Sac): ${h.swarmTelegraph}`);
console.log(`Backfill events — Cortex evolve (-> ${CORTEX_EVOLVE_TO}): ${h.cortexEvolve}, Swarm evolve (-> ${SWARM_EVOLVE_TO}): ${h.swarmEvolve}`);
console.log(`Backfill events — Cortex tool attached (${CORTEX_TOOL}): ${h.cortexTool}, Swarm tool attached (${SWARM_TOOL}): ${h.swarmTool}`);
