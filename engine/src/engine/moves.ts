import type { Ability, Speed } from "../cards/types.js";
import type { GameState, PlayerId } from "../state/types.js";
import { otherPlayer } from "../state/types.js";
import { hasKeyword, activeGuards, effectiveCardCost, boardSlotsUsed, signatureCost } from "../state/queries.js";
import { enumerateTargets, type TargetRef } from "../effects/targeting.js";
import { evaluateCondition } from "../effects/conditions.js";
import { BOARD_SLOTS } from "../state/init.js";

export type Move =
  | {
      type: "playCard";
      handIndex: number;
      /** The structural target: an evolution's base unit to mutate, a
       * Tool's attach host, or — for a plain Unit/Directive/Command with a
       * "chosen"-scope onPlay ability — that ability's own chosen target
       * (there's no structural target competing for the slot in that
       * case). */
      target?: TargetRef;
      /** Only used for an evolution Unit whose onPlay ability *also* needs
       * a "chosen" target, independent of `target` (which is already
       * spoken for by the evolution base). See engine.ts's evolveUnit and
       * the 2026-09-19 owner-feedback entry ("the chosen-targeting gap")
       * this field closes. */
      abilityTarget?: TargetRef;
    }
  /** Plays the signature card from the signature zone (see SignatureZone
   * in state/types.ts). Sorcery timing, a free board slot, and its current
   * cost (base plus the replay surcharge). `target` is its onPlay ability's
   * chosen target, exactly as for a plain Unit played from the hand. */
  | { type: "playSignature"; target?: TargetRef }
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
  if (sorceryTiming) pushPlaySignatureMoves(state, actor, moves);
  if (sorceryTiming) pushAttackMoves(state, actor, moves);
  pushActivatedAbilityMoves(state, actor, moves, sorceryTiming);

  return moves;
}

function pushPlayCardMoves(state: GameState, pid: PlayerId, moves: Move[], sorceryTiming: boolean): void {
  const player = state.players[pid];
  player.hand.forEach((card, handIndex) => {
    if (effectiveCardCost(state, pid, card) > player.energy) return;
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
      // A signature unit never evolves: it must stay the card that goes
      // back to the signature zone when it dies.
      const bases = player.board.filter(
        (u) => !u.pending && !u.signature && u.card.id === card.evolvesFrom && u.enteredTurn < state.turnNumber,
      );
      const onEvolve = card.abilities.find((a) => a.trigger === "onPlay");
      for (const base of bases) {
        // If the evolved form's onPlay ability itself needs a "chosen"
        // target (e.g. Kernel Panic's destroy, data/nullCards.ts), that
        // target is independent of which base is evolving — enumerate it
        // separately and cross it with each base, carried in
        // `abilityTarget` since `target` is already the base reference
        // (see the Move type's own doc comment; this is the fix for the
        // 2026-09-19 owner-feedback "chosen-targeting gap"). A card whose
        // ability has no legal target right now offers no move for that
        // base at all, mirroring the existing convention for a plain
        // card's own chosen-target onPlay ability below.
        if (onEvolve?.targeting && onEvolve.targeting.scope === "chosen") {
          const abilityOptions = enumerateTargets(onEvolve.targeting.filter, pid, state);
          if (abilityOptions.length > 0) {
            for (const abilityTarget of abilityOptions) {
              moves.push({ type: "playCard", handIndex, target: { kind: "unit", instanceId: base.instanceId }, abilityTarget });
            }
          } else {
            // No legal target for the bonus ability right now — evolving
            // is still legal (the base's upgrade isn't conditional on it),
            // the ability just doesn't fire; see resolveAbility's matching
            // guard. Unlike a plain new unit's own chosen-target onPlay
            // (which blocks the whole play with no legal target), evolving
            // has a structural target of its own that doesn't depend on
            // the bonus ability having anywhere to point.
            moves.push({ type: "playCard", handIndex, target: { kind: "unit", instanceId: base.instanceId } });
          }
        } else {
          moves.push({ type: "playCard", handIndex, target: { kind: "unit", instanceId: base.instanceId } });
        }
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

/** The signature card, when it is waiting in its zone: same rules as a
 * plain Unit from the hand (a free board slot; a "chosen" onPlay needs a
 * legal target), always Sorcery timing, paid at signatureCost. */
function pushPlaySignatureMoves(state: GameState, pid: PlayerId, moves: Move[]): void {
  const player = state.players[pid];
  const zone = player.signature;
  if (!zone || !zone.inZone) return;
  if ((signatureCost(state, pid) ?? Infinity) > player.energy) return;
  if (boardSlotsUsed(player) >= BOARD_SLOTS) return;
  const onPlay = zone.card.abilities.find((a) => a.trigger === "onPlay");
  if (onPlay?.targeting && onPlay.targeting.scope === "chosen") {
    for (const target of enumerateTargets(onPlay.targeting.filter, pid, state)) moves.push({ type: "playSignature", target });
  } else {
    moves.push({ type: "playSignature" });
  }
}

function pushAttackMoves(state: GameState, pid: PlayerId, moves: Move[]): void {
  const enemyId = otherPlayer(pid);
  const enemy = state.players[enemyId];
  // A pending (unarmed) telegraphed unit is dormant and cannot force
  // attacks onto itself via Guard, same as it cannot attack itself.
  const guards = activeGuards(state, enemyId);
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
    ...player.board.filter((u) => !u.pending).map((u) => ({ instanceId: u.instanceId, abilities: u.card.abilities, used: u.usedThisTurn })),
    ...player.directives.map((d) => ({ instanceId: d.instanceId, abilities: d.card.abilities, used: undefined as string[] | undefined })),
  ];
  for (const src of sources) {
    for (const ability of src.abilities as Ability[]) {
      if (ability.trigger !== "activated") continue;
      // A once-per-turn ability already used this turn would resolve to
      // nothing (resolver.ts), so it isn't offered: paying for a no-op is
      // never a real choice. The same holds while an activation of it is
      // still on the stack: the use is counted when that one resolves, so a
      // second one in response would be paid for and then do nothing.
      if (ability.limit === "oncePerTurn" && src.used?.includes(ability.id)) continue;
      if (
        ability.limit === "oncePerTurn" &&
        state.stack.some((item) => item.kind === "ability" && item.source.instanceId === src.instanceId && item.ability.id === ability.id)
      )
        continue;
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
