// Real, unscripted-play evidence for the 2026-09-25 owner-feedback entry
// ("accept the ring as directionally done; start Phase 5"), item 3: "aim
// some of Aegis's new cards at its Cortex matchup — immediate-board-impact
// cards." Searches real LookaheadAgent-vs-LookaheadAgent Aegis-vs-Cortex
// games for two of this session's new cards actually firing mid-game, not
// just a whitebox fixture: Salvage Reflex's onDeath Barrier grant (the one
// new card with real ability behaviour) and a Bulwark Chassis/Reinforced
// Bastion body surviving a Cortex point-removal spell (the stat-line thesis
// this whole slice is built on). Mirrors ring2609MatchDemo.ts's shape.

import { buildAegisDeck, buildCortexDeck } from "../data/decks.js";
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
  reflexGrant: string | undefined;
  survivedRemoval: string | undefined;
}

async function tryOne(seed: number): Promise<Attempt> {
  const deckA = buildAegisDeck("p1", "Aegis Deck");
  const deckB = buildCortexDeck("p2", "Cortex Deck");
  const agentA = new LookaheadAgent("Lookahead-Aegis", seed);
  const agentB = new LookaheadAgent("Lookahead-Cortex", seed + 1);

  const rng = new Rng(seed);
  const state = createInitialState(deckA, deckB, rng);
  state.players.p1.name = agentA.name;
  state.players.p2.name = agentB.name;
  state.turnNumber = 1;
  state.activePlayer = "p1";
  beginTurn(state, "p1", rng, { draw: false });

  const agents = { p1: agentA, p2: agentB } as const;
  let reflexGrant: string | undefined;
  let survivedRemoval: string | undefined;
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
    if (latest?.type === "statusApplied" && latest.source === "Salvage Reflex" && latest.status === "Barrier") {
      reflexGrant = latest.target;
    }
    if (
      latest?.type === "damage" &&
      latest.targetKind === "unit" &&
      (latest.source === "Diagnostic Pulse" || latest.source === "Interrupt Handler" || latest.source === "Cascade Purge") &&
      (latest.target === "Bulwark Chassis" || latest.target === "Reinforced Bastion")
    ) {
      const stillAlive = state.players.p1.board.some((u) => u.card.name === latest.target);
      if (stillAlive) survivedRemoval = latest.target;
    }
  }

  return { seed, state, reflexGrant, survivedRemoval };
}

const maxSeed = Number(process.argv[2] ?? 300);

// Each mechanism gets its own independent seed search, exactly like
// ring2609MatchDemo.ts's guardFound/reachFound — a single game satisfying
// both at once isn't guaranteed and isn't the point; the point is proving
// each mechanism fires for real, at least once, in unscripted play.
let reflexFound: Attempt | undefined;
let removalFound: Attempt | undefined;
for (let seed = 1; seed <= maxSeed && !(reflexFound && removalFound); seed++) {
  const attempt = await tryOne(seed);
  if (attempt.reflexGrant && !reflexFound) reflexFound = attempt;
  if (attempt.survivedRemoval && !removalFound) removalFound = attempt;
}

console.log(`AI-TCG Phase 5 slice 1 evidence (2026-09-25 "start Phase 5" entry, item 3)`);
console.log("Both sides played by LookaheadAgent, Aegis vs Cortex.");
console.log("");
console.log("--- Salvage Reflex: dying grants a random ally Barrier ---");
if (reflexFound) {
  console.log(`  Found at seed ${reflexFound.seed}: Salvage Reflex granted Barrier to "${reflexFound.reflexGrant}".`);
} else {
  console.log(`  Not observed in seeds [1, ${maxSeed}] — try a higher range.`);
}
console.log("");
console.log("--- Bulwark Chassis / Reinforced Bastion surviving a Cortex point-removal spell ---");
if (removalFound) {
  console.log(`  Found at seed ${removalFound.seed}: "${removalFound.survivedRemoval}" took a Cortex removal spell and stayed on the board.`);
} else {
  console.log(`  Not observed in seeds [1, ${maxSeed}] — try a higher range.`);
}
console.log("");

if (reflexFound) {
  console.log("=== Full match log: Salvage Reflex evidence ===");
  console.log(formatLog(reflexFound.state.log));
  console.log("");
  console.log(`Winner: ${reflexFound.state.winner}, turns: ${reflexFound.state.turnNumber}`);
  console.log("");
}
if (removalFound) {
  console.log("=== Full match log: removal-survival evidence ===");
  console.log(formatLog(removalFound.state.log));
  console.log("");
  console.log(`Winner: ${removalFound.state.winner}, turns: ${removalFound.state.turnNumber}`);
}
