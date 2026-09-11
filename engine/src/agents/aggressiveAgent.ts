import type { Agent, PlayerView } from "./agent.js";
import type { Move } from "../engine/moves.js";
import type { TargetRef } from "../effects/targeting.js";
import type { StackItem, UnitInstance } from "../state/types.js";

/** Dummy agent #2: a simple greedy face-damage heuristic — dump the
 * biggest affordable card, throw every available attacker at the
 * opponent's life total (or secure the cheapest kill on an enemy unit if
 * going face isn't legal because of Guard), then pass. It has no lookahead
 * and does not model the opponent's future turn; it exists to exercise the
 * engine with a *different* decision policy than pure random, not to play
 * well.
 *
 * It also has one reactive rule, deliberately simple but genuine: outside
 * its own sorcery-speed main phase (someone else's turn, or something
 * already on the stack) it only has instant-speed moves to choose from at
 * all, and it prefers one that saves its own unit from a lethal pending
 * attack over anything else — a real, if narrow, instant-speed decision,
 * not just "cast whatever's biggest whenever legal."
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
    const mainPhase = view.self === view.activePlayer && view.stack.length === 0;

    if (!mainPhase) {
      return this.pickReactiveResponse(view, legalMoves) ?? { type: "passPriority" };
    }

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

    return { type: "passPriority" };
  }

  /** Outside the main phase, every playCard/activateAbility move offered is
   * already, by construction of getLegalMoves, an Instant-speed one (that's
   * the only thing legal here) — so there's no need to re-check speed. */
  private pickReactiveResponse(view: PlayerView, legalMoves: Move[]): Move | undefined {
    const threat = this.findLethalCombatThreat(view);
    if (threat) {
      const save = legalMoves.find(
        (m) =>
          (m.type === "playCard" || m.type === "activateAbility") &&
          (this.targetsRef(m, threat.target) || this.targetsRef(m, { kind: "unit", instanceId: threat.attackerInstanceId })),
      );
      if (save) return save;
    }

    const playMoves = legalMoves.filter((m): m is Extract<Move, { type: "playCard" }> => m.type === "playCard");
    if (playMoves.length > 0) return this.pickBiggestCard(view, playMoves);

    const abilityMoves = legalMoves.filter((m): m is Extract<Move, { type: "activateAbility" }> => m.type === "activateAbility");
    if (abilityMoves.length > 0) return abilityMoves[0]!;

    return undefined;
  }

  /** A pending combat-damage stack item where the target is one of my units
   * and the attacker's approximate power would kill it outright. */
  private findLethalCombatThreat(view: PlayerView): Extract<StackItem, { kind: "combatDamage" }> | undefined {
    for (const item of view.stack) {
      if (item.kind !== "combatDamage") continue;
      const target = item.target;
      if (target.kind !== "unit") continue;
      const myUnit = view.me.board.find((u) => u.instanceId === target.instanceId);
      if (!myUnit) continue;
      const attacker =
        view.me.board.find((u) => u.instanceId === item.attackerInstanceId) ??
        view.opponent.board.find((u) => u.instanceId === item.attackerInstanceId);
      if (!attacker) continue;
      if (approximateAttack(attacker) >= approximateHealth(myUnit)) return item;
    }
    return undefined;
  }

  private targetsRef(move: Extract<Move, { type: "playCard" | "activateAbility" }>, ref: TargetRef): boolean {
    const target = move.target;
    if (!target) return false;
    if (target.kind === "unit" && ref.kind === "unit") return target.instanceId === ref.instanceId;
    if (target.kind === "player" && ref.kind === "player") return target.playerId === ref.playerId;
    return false;
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

function approximateAttack(unit: UnitInstance): number {
  return unit.card.attack + unit.permanentBuff.attack + unit.turnBuff.attack;
}
