import type { DeckSpec } from "../state/init.js";
import { createInitialState } from "../state/init.js";
import { Rng } from "../state/rng.js";
import { getLegalMoves, type Move } from "./moves.js";
import { applyMove, beginTurn } from "./engine.js";
import type { Agent } from "../agents/agent.js";
import { buildPlayerView } from "../agents/agent.js";
import type { GameState, MatchRules } from "../state/types.js";

export interface MatchResult {
  state: GameState;
  /** Total moves applied — a sanity/debugging figure, not the same as
   * turnNumber (each turn is many moves). */
  movesPlayed: number;
}

export interface MatchHooks {
  /** Called once the initial state is fully set up (decks shuffled, turn 1
   * begun) but before the first move is requested. Lets a caller that needs
   * to observe the pre-move state — e.g. `@ai-tcg/server` sending its
   * `matchStart` message with the real initial `PlayerView` — do so without
   * reconstructing state itself (which would risk drifting from what this
   * function actually built). */
  onMatchStart?(state: GameState): void;
  /** Called after each move is applied, with the move and the count so far
   * (1 for the first). The state is live: read it, don't keep it or change
   * it. Lets the server's ladder keep a move-by-move timeline (the replay's
   * moves and Watch live's public snapshots) without its own copy of this
   * loop. */
  onMove?(state: GameState, move: Move, movesPlayed: number): void;
}

// A hard safety valve against an engine bug producing an infinite inner
// loop (e.g. a move that never reduces to endTurn). Real matches finish in
// a small fraction of this.
const MAX_MOVES_SAFETY = 5000;

/** A match's state before the first move: both decks shuffled from the
 * seed, turn 1 begun for p1. runMatch and replayMatch share it, so a replay
 * starts from exactly the state the match did. */
function setupMatch(deckA: DeckSpec, deckB: DeckSpec, nameA: string, nameB: string, seed: number, rules?: MatchRules): { state: GameState; rng: Rng } {
  const rng = new Rng(seed);
  const state = createInitialState(deckA, deckB, rng, rules);
  // Players are agents (see DESIGN.md) — display names follow the agent,
  // not the deck list.
  state.players.p1.name = nameA;
  state.players.p2.name = nameB;
  state.turnNumber = 1;
  state.activePlayer = "p1";
  // By convention the player going first does not draw on turn 1.
  beginTurn(state, "p1", rng, { draw: false });
  return { state, rng };
}

/** Replays a recorded match (session 67): the same decks, names and seed,
 * then each recorded move in order. The engine is deterministic, so this
 * rebuilds the match exactly: every state, every log event, the result. A
 * move that isn't legal where the recording puts it throws (the recording
 * doesn't belong to these decks and seed, or to this engine). `onMove` sees
 * each state as runMatch's hook does. */
export function replayMatch(
  deckA: DeckSpec,
  deckB: DeckSpec,
  names: { p1: string; p2: string },
  seed: number,
  moves: readonly Move[],
  hooks: MatchHooks = {},
  rules?: MatchRules,
): MatchResult {
  const { state, rng } = setupMatch(deckA, deckB, names.p1, names.p2, seed, rules);
  hooks.onMatchStart?.(state);
  let movesPlayed = 0;
  for (const move of moves) {
    if (state.winner) throw new Error(`the recording goes on after the match ended (move ${movesPlayed + 1})`);
    const legal = getLegalMoves(state);
    const key = JSON.stringify(move);
    if (!legal.some((m) => JSON.stringify(m) === key)) throw new Error(`move ${movesPlayed + 1} isn't legal here: ${key}`);
    applyMove(state, move, rng);
    movesPlayed++;
    hooks.onMove?.(state, move, movesPlayed);
  }
  return { state, movesPlayed };
}

export async function runMatch(
  deckA: DeckSpec,
  deckB: DeckSpec,
  agentA: Agent,
  agentB: Agent,
  seed: number,
  hooks: MatchHooks = {},
  /** Seat-rule variants under measurement (types.ts MatchRules); left out,
   * the rules as shipped. */
  rules?: MatchRules,
): Promise<MatchResult> {
  const { state, rng } = setupMatch(deckA, deckB, agentA.name, agentB.name, seed, rules);
  hooks.onMatchStart?.(state);

  const agents: Record<GameState["activePlayer"], Agent> = { p1: agentA, p2: agentB };
  let movesPlayed = 0;
  while (!state.winner && movesPlayed < MAX_MOVES_SAFETY) {
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) break; // passPriority is always legal; this would be an engine bug
    const agent = agents[state.priority];
    const view = buildPlayerView(state, state.priority);
    const move = await agent.decideMove(view, legalMoves);
    applyMove(state, move, rng);
    movesPlayed++;
    hooks.onMove?.(state, move, movesPlayed);
  }

  return { state, movesPlayed };
}
