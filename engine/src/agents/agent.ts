import type { GameState, PlayerId, PlayerState } from "../state/types.js";
import type { Move } from "../engine/moves.js";
import type { Card } from "../cards/types.js";

/** What an agent is shown of the game before deciding a move. This is
 * deliberately a redacted projection of GameState — it hides the
 * opponent's hand and deck order, the way a real protocol boundary must —
 * so that swapping the in-process call below for a network call later
 * (build-order stage 2) changes nothing about what information an agent
 * can use to decide. */
export interface PlayerView {
  self: PlayerId;
  turnNumber: number;
  activePlayer: PlayerId;
  me: PlayerState;
  opponent: Omit<PlayerState, "hand" | "deck"> & { handSize: number; deckSize: number };
}

export function buildPlayerView(state: GameState, self: PlayerId): PlayerView {
  const opponentId: PlayerId = self === "p1" ? "p2" : "p1";
  const opponent = state.players[opponentId];
  const { hand, deck, ...rest } = opponent;
  return {
    self,
    turnNumber: state.turnNumber,
    activePlayer: state.activePlayer,
    me: state.players[self],
    opponent: { ...rest, handSize: hand.length, deckSize: deck.length },
  };
}

export interface Agent {
  name: string;
  /** Chooses one move from the supplied legal-move list. Must not consult
   * `state` for anything the `view` doesn't expose — dummy agents in this
   * stage are trusted to follow that rule since they run in-process, but
   * the shape here is exactly the request/response pair build-order stage
   * 2 turns into a real network protocol. */
  decideMove(view: PlayerView, legalMoves: Move[]): Move;
}

export function cardInHand(view: PlayerView, handIndex: number): Card | undefined {
  return view.me.hand[handIndex];
}
