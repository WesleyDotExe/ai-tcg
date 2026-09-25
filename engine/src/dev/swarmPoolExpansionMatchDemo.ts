// Real, unscripted-play evidence for the Swarm slice of Phase 5 pool
// expansion (2026-09-25/26 owner-feedback entries: "Swarm next would help
// both its own weak matchups and the Aegis-vs-Swarm drift"). Searches real
// LookaheadAgent-vs-LookaheadAgent games for two of this session's new
// cards actually firing mid-game, not just a whitebox fixture: Bloodswarm
// Alpha's onPlay summon, and Warren Guardian forcing an attack onto itself
// (Guard) while other Swarm units survive untouched. Mirrors
// phase5Slice1MatchDemo.ts's shape.

import { buildSwarmDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { createInitialState } from "../state/init.js";
import { Rng } from "../state/rng.js";
import { getLegalMoves } from "../engine/moves.js";
import { applyMove, beginTurn } from "../engine/engine.js";
import { buildPlayerView } from "../agents/agent.js";
import { formatLog } from "../log/format.js";
import type { GameState } from "../state/types.js";

interface Attempt {
  seed: number;
  state: GameState;
  alphaSummon: string | undefined;
  guardRedirect: string | undefined;
}

async function tryOne(seed: number): Promise<Attempt> {
  const deckA = buildSwarmDeck("p1", "Swarm Deck");
  const deckB = buildNullDeck("p2", "Null Deck");
  const agentA = new LookaheadAgent("Lookahead-Swarm", seed);
  const agentB = new LookaheadAgent("Lookahead-Null", seed + 1);

  const rng = new Rng(seed);
  const state = createInitialState(deckA, deckB, rng);
  state.players.p1.name = agentA.name;
  state.players.p2.name = agentB.name;
  state.turnNumber = 1;
  state.activePlayer = "p1";
  beginTurn(state, "p1", rng, { draw: false });

  const agents = { p1: agentA, p2: agentB } as const;
  let alphaSummon: string | undefined;
  let guardRedirect: string | undefined;
  let movesPlayed = 0;

  while (!state.winner && movesPlayed < 5000) {
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) break;
    const agent = agents[state.priority];
    const view = buildPlayerView(state, state.priority);
    const move = await agent.decideMove(view, legalMoves);
    applyMove(state, move, rng);
    movesPlayed++;

    const latest = state.log[state.log.length - 1];
    if (latest?.type === "summon" && latest.source === "Bloodswarm Alpha" && !alphaSummon) {
      alphaSummon = latest.token;
    }
    if (latest?.type === "attack" && latest.defender === "Warren Guardian" && !guardRedirect) {
      const attackerOwner = latest.attacker;
      guardRedirect = `${attackerOwner} attacked into Warren Guardian instead of a softer target`;
    }
  }

  return { seed, state, alphaSummon, guardRedirect };
}

const maxSeed = Number(process.argv[2] ?? 300);

let alphaFound: Attempt | undefined;
let guardFound: Attempt | undefined;
for (let seed = 1; seed <= maxSeed && !(alphaFound && guardFound); seed++) {
  const attempt = await tryOne(seed);
  if (attempt.alphaSummon && !alphaFound) alphaFound = attempt;
  if (attempt.guardRedirect && !guardFound) guardFound = attempt;
}

console.log(`AI-TCG Phase 5 Swarm slice evidence (2026-09-25/26 "start Phase 5" entries)`);
console.log("Both sides played by LookaheadAgent, Swarm vs Null.");
console.log("");
console.log("--- Bloodswarm Alpha: onPlay summons a Swarm Larva token ---");
if (alphaFound) {
  console.log(`  Found at seed ${alphaFound.seed}: Bloodswarm Alpha summoned "${alphaFound.alphaSummon}".`);
} else {
  console.log(`  Not observed in seeds [1, ${maxSeed}] — try a higher range.`);
}
console.log("");
console.log("--- Warren Guardian: Guard forces the attack onto it ---");
if (guardFound) {
  console.log(`  Found at seed ${guardFound.seed}: ${guardFound.guardRedirect}.`);
} else {
  console.log(`  Not observed in seeds [1, ${maxSeed}] — try a higher range.`);
}
console.log("");

if (alphaFound) {
  console.log("=== Full match log: Bloodswarm Alpha summon evidence ===");
  console.log(formatLog(alphaFound.state.log));
  console.log("");
  console.log(`Winner: ${alphaFound.state.winner}, turns: ${alphaFound.state.turnNumber}`);
  console.log("");
}
if (guardFound && guardFound.seed !== alphaFound?.seed) {
  console.log("=== Full match log: Warren Guardian evidence ===");
  console.log(formatLog(guardFound.state.log));
  console.log("");
  console.log(`Winner: ${guardFound.state.winner}, turns: ${guardFound.state.turnNumber}`);
}
