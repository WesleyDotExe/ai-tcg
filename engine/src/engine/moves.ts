import type { GameState, PlayerId } from "../state/types.js";
import { otherPlayer } from "../state/types.js";
import { isAlive } from "../state/queries.js";
import { enumerateTargets, type TargetRef } from "../effects/targeting.js";
import { evaluateCondition } from "../effects/conditions.js";

export type Move =
  | { type: "playCard"; handIndex: number; target?: TargetRef }
  | { type: "attack"; attackerInstanceId: string; target: TargetRef }
  | { type: "activateAbility"; sourceInstanceId: string; abilityId: string; target?: TargetRef }
  | { type: "endTurn" };

/** Enumerates every legal move for the active player in the current state.
 * This is the single source of truth for legality — agents (dummy or real)
 * never invent moves, they only choose from this list, and the engine
 * applies exactly what was offered. */
export function getLegalMoves(state: GameState): Move[] {
  if (state.winner) return [];
  const pid = state.activePlayer;
  const player = state.players[pid];
  const moves: Move[] = [{ type: "endTurn" }];

  player.hand.forEach((card, handIndex) => {
    if (card.cost > player.energy) return;
    const onPlay = card.abilities.find((a) => a.trigger === "onPlay");
    if (onPlay?.targeting && onPlay.targeting.scope === "chosen") {
      const options = enumerateTargets(onPlay.targeting.filter, pid, state);
      // A card whose enter-play ability requires a target can't be played
      // with no legal target on board (mirrors genre convention).
      for (const target of options) moves.push({ type: "playCard", handIndex, target });
    } else {
      moves.push({ type: "playCard", handIndex });
    }
  });

  pushAttackMoves(state, pid, moves);
  pushActivatedAbilityMoves(state, pid, moves);

  return moves;
}

function pushAttackMoves(state: GameState, pid: PlayerId, moves: Move[]): void {
  const enemyId = otherPlayer(pid);
  const enemy = state.players[enemyId];
  const guards = enemy.board.filter((u) => u.card.keywords.includes("Guard") && isAlive(state, u));
  const enemyTargets: TargetRef[] =
    guards.length > 0
      ? guards.map((u) => ({ kind: "unit", instanceId: u.instanceId }))
      : [
          ...enemy.board.map((u): TargetRef => ({ kind: "unit", instanceId: u.instanceId })),
          { kind: "player", playerId: enemyId },
        ];

  for (const unit of state.players[pid].board) {
    if (unit.hasAttackedThisTurn) continue;
    if (unit.statuses.some((s) => s.kind === "Stasis")) continue;
    const canAct = unit.enteredTurn < state.turnNumber || unit.card.keywords.includes("Rush");
    if (!canAct) continue;
    for (const target of enemyTargets) {
      moves.push({ type: "attack", attackerInstanceId: unit.instanceId, target });
    }
  }
}

function pushActivatedAbilityMoves(state: GameState, pid: PlayerId, moves: Move[]): void {
  const player = state.players[pid];
  const sources = [
    ...player.board.map((u) => ({ instanceId: u.instanceId, abilities: u.card.abilities })),
    ...player.directives.map((d) => ({ instanceId: d.instanceId, abilities: d.card.abilities })),
  ];
  for (const src of sources) {
    for (const ability of src.abilities) {
      if (ability.trigger !== "activated") continue;
      const cost = ability.cost?.energy ?? 0;
      if (cost > player.energy) continue;
      if (ability.condition && !evaluateCondition(ability.condition, state, pid)) continue;
      if (ability.targeting && ability.targeting.scope === "chosen") {
        const options = enumerateTargets(ability.targeting.filter, pid, state);
        for (const target of options) {
          moves.push({ type: "activateAbility", sourceInstanceId: src.instanceId, abilityId: ability.id, target });
        }
      } else {
        moves.push({ type: "activateAbility", sourceInstanceId: src.instanceId, abilityId: ability.id });
      }
    }
  }
}
