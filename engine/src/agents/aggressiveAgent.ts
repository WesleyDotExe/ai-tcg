import type { Agent, PlayerView } from "./agent.js";
import type { Move } from "../engine/moves.js";
import type { UnitInstance } from "../state/types.js";

/** Dummy agent #2: a simple greedy face-damage heuristic — dump the
 * biggest affordable card, throw every available attacker at the
 * opponent's life total (or secure the cheapest kill on an enemy unit if
 * going face isn't legal because of Guard), then pass. It has no lookahead
 * and does not model the opponent's future turn; it exists to exercise the
 * engine with a *different* decision policy than pure random, not to play
 * well.
 *
 * Stats are approximated from base card stats + accumulated buffs, not the
 * full static-aura-aware `currentAttack`/`currentHealth` in state/queries —
 * that function needs the whole GameState, which a real agent would only
 * ever see through the protocol's PlayerView. Good enough for a dummy. */
export class AggressiveAgent implements Agent {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  decideMove(view: PlayerView, legalMoves: Move[]): Move {
    const playMoves = legalMoves.filter((m): m is Extract<Move, { type: "playCard" }> => m.type === "playCard");
    if (playMoves.length > 0) {
      return this.pickBiggestCard(view, playMoves);
    }

    const attackMoves = legalMoves.filter((m): m is Extract<Move, { type: "attack" }> => m.type === "attack");
    if (attackMoves.length > 0) {
      return this.pickBestAttack(view, attackMoves);
    }

    const abilityMoves = legalMoves.filter((m): m is Extract<Move, { type: "activateAbility" }> => m.type === "activateAbility");
    if (abilityMoves.length > 0) {
      return abilityMoves[0]!;
    }

    return { type: "endTurn" };
  }

  private pickBiggestCard(view: PlayerView, moves: Extract<Move, { type: "playCard" }>[]): Move {
    let best = moves[0]!;
    let bestCost = -1;
    for (const move of moves) {
      const card = view.me.hand[move.handIndex];
      const cost = card?.cost ?? 0;
      // Among target options for the same card, prefer hitting the
      // opponent's face over their board.
      const targetsFace = move.target?.kind === "player";
      const bestTargetsFace = best.target?.kind === "player";
      if (cost > bestCost || (cost === bestCost && targetsFace && !bestTargetsFace)) {
        best = move;
        bestCost = cost;
      }
    }
    return best;
  }

  private pickBestAttack(view: PlayerView, moves: Extract<Move, { type: "attack" }>[]): Move {
    const faceAttack = moves.find((m) => m.target.kind === "player");
    if (faceAttack) return faceAttack;

    // No face swing available (an enemy Guard is up): trade into whichever
    // legal target has the least remaining health, to secure a kill.
    const opponentBoard = view.opponent.board;
    let best = moves[0]!;
    let bestHealth = Number.POSITIVE_INFINITY;
    for (const move of moves) {
      if (move.target.kind !== "unit") continue;
      const targetId = move.target.instanceId;
      const unit = opponentBoard.find((u) => u.instanceId === targetId);
      const health = unit ? approximateHealth(unit) : Number.POSITIVE_INFINITY;
      if (health < bestHealth) {
        bestHealth = health;
        best = move;
      }
    }
    return best;
  }
}

function approximateHealth(unit: UnitInstance): number {
  const maxHealth = unit.card.health + unit.permanentBuff.health + unit.turnBuff.health;
  return maxHealth - unit.damageTaken;
}
