import type { Move, PlayerView } from "@ai-tcg/protocol";
import { Rng } from "./rng.js";

/** Ported from the engine's in-process `RandomAgent`: uniform among legal
 * moves, with passing down-weighted (not forbidden) so a random walk
 * doesn't degenerate into passing every turn. */
export function makeRandomDecision(seed: number): (view: PlayerView, legalMoves: Move[]) => Move {
  const rng = new Rng(seed);
  return (_view, legalMoves) => {
    const nonPass = legalMoves.filter((m) => m.type !== "passPriority");
    if (nonPass.length > 0 && rng.next() < 0.85) {
      return rng.pick(nonPass);
    }
    return rng.pick(legalMoves);
  };
}
