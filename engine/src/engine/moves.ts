import type { Ability, Speed } from "../cards/types.js";
import type { GameState, PlayerId, PlayerState } from "../state/types.js";
import { otherPlayer } from "../state/types.js";
import { isAlive, hasKeyword } from "../state/queries.js";
import { enumerateTargets, type TargetRef } from "../effects/targeting.js";
import { evaluateCondition } from "../effects/conditions.js";
import { BOARD_SLOTS } from "../state/init.js";

export type Move =
  | { type: "playCard"; handIndex: number; target?: TargetRef }
  | { type: "attack"; attackerInstanceId: string; target: TargetRef }
  | { type: "activateAbility"; sourceInstanceId: string; abilityId: string; target?: TargetRef }
  /** Passes priority. Legal for whoever currently holds it, always. Two
   * consecutive passes resolve the top of the stack, or — with the stack
   * empty — end the active player's turn. This replaces the old "endTurn"
   * move: ending your turn is just what a pass ends up doing once nothing
   * is left to respond to (see DESIGN.md's owner feedback on reactivity). */
  | { type: "passPriority" };

/** Enumerates every legal move for whoever currently holds priority. This is
 * the single source of truth for legality — agents (dummy or real) never
 * invent moves, they only choose from this list, and the engine applies
 * exactly what was offered.
 *
 * Timing has two tiers:
 * - "Sorcery timing": only the active player, only with an empty stack —
 *   their main phase. Playing a Unit/Directive, casting a Sorcery-speed
 *   Command, activating a Sorcery-speed ability, and declaring an attack
 *   are only legal here.
 * - Priority, full stop: an Instant-speed Command or activated ability is
 *   legal for whoever holds priority, any time — including the non-active
 *   player during the opponent's turn, or either player responding to
 *   something already on the stack. This is what makes instant-speed
 *   responses possible. */
export function getLegalMoves(state: GameState): Move[] {
  if (state.winner) return [];
  const actor = state.priority;
  const player = state.players[actor];
  const sorceryTiming = actor === state.activePlayer && state.stack.length === 0;
  const moves: Move[] = [{ type: "passPriority" }];

  pushPlayCardMoves(state, actor, moves, sorceryTiming);
  if (sorceryTiming) pushAttackMoves(state, actor, moves);
  pushActivatedAbilityMoves(state, actor, moves, sorceryTiming);

  return moves;
}

/** Board-development system: Units (new, non-evolving ones) and Directives
 * are the two card types that claim a fresh board slot — they share one
 * finite per-player pool (see BOARD_SLOTS). Evolving a Unit and attaching
 * a Tool both act on an *existing* occupant, so neither counts here. */
function boardSlotsUsed(player: PlayerState): number {
  return player.board.length + player.directives.length;
}

function pushPlayCardMoves(state: GameState, pid: PlayerId, moves: Move[], sorceryTiming: boolean): void {
  const player = state.players[pid];
  player.hand.forEach((card, handIndex) => {
    if (card.cost > player.energy) return;
    const speed: Speed = card.type === "Command" ? card.speed : "Sorcery";
    if (speed === "Sorcery" && !sorceryTiming) return;

    if (card.type === "Unit" && card.evolvesFrom) {
      // Evolution targets an existing, already-armed unit on the board
      // matching the required base card id — no target, no legal play.
      // It must also have survived to a LATER turn than the one it was
      // played on (owner overrule, 2026-09-13 stage-3 checkpoint feedback,
      // item 4): same-turn play-and-evolve let a base skip the "answer it
      // early while it's weak" exposure window entirely, which undercut the
      // whole point of the mechanic. `enteredTurn < state.turnNumber` is
      // the same "has this unit actually lived through a turn boundary"
      // check summoning sickness uses in pushAttackMoves below — evolution
      // gets no Rush-style bypass, unlike attacking.
      const bases = player.board.filter(
        (u) => !u.pending && u.card.id === card.evolvesFrom && u.enteredTurn < state.turnNumber,
      );
      for (const base of bases) {
        moves.push({ type: "playCard", handIndex, target: { kind: "unit", instanceId: base.instanceId } });
      }
      return;
    }

    if (card.type === "Tool") {
      // A Tool attaches to any friendly board unit (pending or armed —
      // tooling up a telegraphed threat before it arms is legal and
      // meaningful: it makes the eventual payoff bigger).
      for (const unit of player.board) {
        moves.push({ type: "playCard", handIndex, target: { kind: "unit", instanceId: unit.instanceId } });
      }
      return;
    }

    if ((card.type === "Unit" || card.type === "Directive") && boardSlotsUsed(player) >= BOARD_SLOTS) {
      return; // no free board slot — this card cannot be played right now
    }

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
}

function pushAttackMoves(state: GameState, pid: PlayerId, moves: Move[]): void {
  const enemyId = otherPlayer(pid);
  const enemy = state.players[enemyId];
  // A pending (unarmed) telegraphed unit is dormant and cannot force
  // attacks onto itself via Guard, same as it cannot attack itself.
  const guards = enemy.board.filter((u) => !u.pending && hasKeyword(u, "Guard") && isAlive(state, u));
  const enemyTargets: TargetRef[] =
    guards.length > 0
      ? guards.map((u) => ({ kind: "unit", instanceId: u.instanceId }))
      : [
          ...enemy.board.map((u): TargetRef => ({ kind: "unit", instanceId: u.instanceId })),
          { kind: "player", playerId: enemyId },
        ];

  for (const unit of state.players[pid].board) {
    if (unit.pending) continue; // dormant — cannot attack until it arms
    if (unit.hasAttackedThisTurn) continue;
    if (unit.statuses.some((s) => s.kind === "Stasis")) continue;
    const canAct = unit.enteredTurn < state.turnNumber || hasKeyword(unit, "Rush");
    if (!canAct) continue;
    for (const target of enemyTargets) {
      moves.push({ type: "attack", attackerInstanceId: unit.instanceId, target });
    }
  }
}

function pushActivatedAbilityMoves(state: GameState, pid: PlayerId, moves: Move[], sorceryTiming: boolean): void {
  const player = state.players[pid];
  const sources = [
    // A pending (unarmed) telegraphed unit is dormant — it cannot activate
    // abilities until it arms.
    ...player.board.filter((u) => !u.pending).map((u) => ({ instanceId: u.instanceId, abilities: u.card.abilities })),
    ...player.directives.map((d) => ({ instanceId: d.instanceId, abilities: d.card.abilities })),
  ];
  for (const src of sources) {
    for (const ability of src.abilities as Ability[]) {
      if (ability.trigger !== "activated") continue;
      const speed: Speed = ability.speed ?? "Sorcery";
      if (speed === "Sorcery" && !sorceryTiming) continue;
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
