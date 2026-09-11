import type { ScalingContext, ScalingSource } from "../cards/types.js";
import type { GameState, PlayerId } from "../state/types.js";
import { otherPlayer } from "../state/types.js";

/** Builds the live-state sampler that ScalingAmount values read from —
 * this is the mechanism behind stats/effects that mutate with the board
 * (design principle 1) rather than being fixed numbers. */
export function buildScalingContext(state: GameState, forPlayer: PlayerId): ScalingContext {
  const opponent = otherPlayer(forPlayer);
  return {
    sample(source: ScalingSource): number {
      switch (source) {
        case "controllerUnitsInPlay":
          return state.players[forPlayer].board.length;
        case "opponentUnitsInPlay":
          return state.players[opponent].board.length;
        case "controllerHandSize":
          return state.players[forPlayer].hand.length;
        case "controllerGraveyardSize":
          return state.players[forPlayer].graveyard.length;
        case "turnNumber":
          return state.turnNumber;
      }
    },
  };
}
