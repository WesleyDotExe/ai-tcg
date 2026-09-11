import type { Agent, PlayerView } from "./agent.js";
import type { Move } from "../engine/moves.js";
import { Rng } from "../state/rng.js";

/** Dummy agent #1: picks uniformly at random among legal moves. Ending the
 * turn is deliberately down-weighted (not forbidden) so a random walk
 * doesn't degenerate into passing every turn — it is still blind, it just
 * isn't suicidal about wasting its whole turn. */
export class RandomAgent implements Agent {
  name: string;
  private rng: Rng;

  constructor(name: string, seed: number) {
    this.name = name;
    this.rng = new Rng(seed);
  }

  decideMove(_view: PlayerView, legalMoves: Move[]): Move {
    const nonEndTurn = legalMoves.filter((m) => m.type !== "endTurn");
    if (nonEndTurn.length > 0 && this.rng.next() < 0.85) {
      return this.rng.pick(nonEndTurn);
    }
    return this.rng.pick(legalMoves);
  }
}
