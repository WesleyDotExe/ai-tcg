import type { DeckSpec } from "../state/init.js";
import { createInitialState } from "../state/init.js";
import { Rng } from "../state/rng.js";
import { getLegalMoves } from "./moves.js";
import { applyMove, beginTurn } from "./engine.js";
import type { Agent } from "../agents/agent.js";
import { buildPlayerView } from "../agents/agent.js";
import type { GameState } from "../state/types.js";

export interface MatchResult {
  state: GameState;
  /** Total moves applied — a sanity/debugging figure, not the same as
   * turnNumber (each turn is many moves). */
  movesPlayed: number;
}

// A hard safety valve against an engine bug producing an infinite inner
// loop (e.g. a move that never reduces to endTurn). Real matches finish in
// a small fraction of this.
const MAX_MOVES_SAFETY = 5000;

export function runMatch(deckA: DeckSpec, deckB: DeckSpec, agentA: Agent, agentB: Agent, seed: number): MatchResult {
  const rng = new Rng(seed);
  const state = createInitialState(deckA, deckB, rng);
  // Players are agents (see DESIGN.md) — display names follow the agent,
  // not the deck list.
  state.players.p1.name = agentA.name;
  state.players.p2.name = agentB.name;
  state.turnNumber = 1;
  state.activePlayer = "p1";
  // By convention the player going first does not draw on turn 1.
  beginTurn(state, "p1", rng, { draw: false });

  const agents: Record<GameState["activePlayer"], Agent> = { p1: agentA, p2: agentB };
  let movesPlayed = 0;
  while (!state.winner && movesPlayed < MAX_MOVES_SAFETY) {
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) break; // passPriority is always legal; this would be an engine bug
    const agent = agents[state.priority];
    const view = buildPlayerView(state, state.priority);
    const move = agent.decideMove(view, legalMoves);
    applyMove(state, move, rng);
    movesPlayed++;
  }

  return { state, movesPlayed };
}
