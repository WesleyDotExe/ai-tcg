import type { GameState, PlayerId, UnitInstance, DirectiveInstance } from "../state/types.js";
import { otherPlayer } from "../state/types.js";
import { MAX_ENERGY_CAP } from "../state/init.js";
import { currentAttack, allUnits } from "../state/queries.js";
import type { Rng } from "../state/rng.js";
import type { Move } from "./moves.js";
import {
  resolveAbility,
  applyDamage,
  drawCardsForPlayer,
  processDeaths,
  checkGameOver,
} from "../effects/resolver.js";
import type { TargetRef } from "../effects/targeting.js";
import type { Ability } from "../cards/types.js";

/** Applies one legal move (as produced by getLegalMoves) to the state,
 * mutating it in place. The caller is responsible for only ever passing a
 * move that came from getLegalMoves for the current state. */
export function applyMove(state: GameState, move: Move, rng: Rng): void {
  const pid = state.activePlayer;
  switch (move.type) {
    case "playCard":
      playCard(state, pid, move.handIndex, move.target, rng);
      break;
    case "attack":
      resolveAttack(state, pid, move.attackerInstanceId, move.target, rng);
      break;
    case "activateAbility":
      activateAbility(state, pid, move.sourceInstanceId, move.abilityId, move.target, rng);
      break;
    case "endTurn":
      advanceTurn(state, rng);
      return; // advanceTurn already runs its own cleanup passes
  }
  processDeaths(state, rng);
  checkGameOver(state);
}

function playCard(state: GameState, pid: PlayerId, handIndex: number, target: TargetRef | undefined, rng: Rng): void {
  const player = state.players[pid];
  const card = player.hand[handIndex];
  if (!card) throw new Error(`playCard: no card at hand index ${handIndex}`);
  player.hand.splice(handIndex, 1);
  player.energy -= card.cost;

  const onPlay = card.abilities.find((a) => a.trigger === "onPlay");

  if (card.type === "Unit") {
    const instanceId = `u${state.nextInstanceId++}`;
    const unit: UnitInstance = {
      instanceId,
      card,
      controller: pid,
      permanentBuff: { attack: 0, health: 0 },
      turnBuff: { attack: 0, health: 0 },
      damageTaken: 0,
      statuses: card.keywords.includes("Barrier") ? [{ kind: "Barrier", duration: "untilConsumed" }] : [],
      enteredTurn: state.turnNumber,
      hasAttackedThisTurn: false,
    };
    player.board.push(unit);
    state.log.push({ type: "play", player: pid, card: card.name, instanceId });
    if (onPlay) {
      resolveAbility({
        state,
        ability: onPlay,
        controller: pid,
        source: { kind: "unit", instanceId, cardName: card.name },
        chosen: target,
        rng,
      });
    }
  } else if (card.type === "Directive") {
    const instanceId = `d${state.nextInstanceId++}`;
    const directive: DirectiveInstance = { instanceId, card, controller: pid };
    player.directives.push(directive);
    state.log.push({ type: "play", player: pid, card: card.name, instanceId });
    if (onPlay) {
      resolveAbility({
        state,
        ability: onPlay,
        controller: pid,
        source: { kind: "directive", instanceId, cardName: card.name },
        chosen: target,
        rng,
      });
    }
  } else {
    // Command: one-shot effect, then straight to the graveyard.
    state.log.push({ type: "play", player: pid, card: card.name });
    if (onPlay) {
      resolveAbility({ state, ability: onPlay, controller: pid, source: { kind: "command", cardName: card.name }, chosen: target, rng });
    }
    player.graveyard.push(card);
  }
}

function resolveAttack(state: GameState, pid: PlayerId, attackerInstanceId: string, target: TargetRef, rng: Rng): void {
  const attacker = state.players[pid].board.find((u) => u.instanceId === attackerInstanceId);
  if (!attacker) throw new Error(`attack: no unit ${attackerInstanceId} on attacker's board`);
  attacker.hasAttackedThisTurn = true;

  const onAttack = attacker.card.abilities.find((a) => a.trigger === "onAttack");
  if (onAttack) {
    resolveAbility({
      state,
      ability: onAttack,
      controller: pid,
      source: { kind: "unit", instanceId: attacker.instanceId, cardName: attacker.card.name },
      rng,
    });
  }

  // Snapshot attack values before either side takes damage so combat is
  // simultaneous, not sequential (a lethal hit doesn't dodge a trade).
  const attackerPower = currentAttack(state, attacker);
  const defenderBefore =
    target.kind === "unit" ? state.players[otherPlayer(pid)].board.find((u) => u.instanceId === target.instanceId) : undefined;
  const defenderName = target.kind === "player" ? state.players[target.playerId].name : (defenderBefore?.card.name ?? target.instanceId);
  state.log.push({ type: "attack", attacker: attacker.card.name, defender: defenderName, defenderKind: target.kind });

  if (target.kind === "player") {
    applyDamage(state, target, attackerPower, attacker.card.name, rng);
    return;
  }

  const defenderPower = defenderBefore ? currentAttack(state, defenderBefore) : 0;
  applyDamage(state, target, attackerPower, attacker.card.name, rng);
  if (defenderBefore) {
    applyDamage(state, { kind: "unit", instanceId: attacker.instanceId }, defenderPower, defenderBefore.card.name, rng);
  }
}

function activateAbility(
  state: GameState,
  pid: PlayerId,
  sourceInstanceId: string,
  abilityId: string,
  target: TargetRef | undefined,
  rng: Rng,
): void {
  const player = state.players[pid];
  const unitSource = player.board.find((u) => u.instanceId === sourceInstanceId);
  const directiveSource = player.directives.find((d) => d.instanceId === sourceInstanceId);
  const card = unitSource?.card ?? directiveSource?.card;
  if (!card) throw new Error(`activateAbility: no source ${sourceInstanceId} on ${pid}'s side`);
  const ability = card.abilities.find((a) => a.id === abilityId);
  if (!ability) throw new Error(`activateAbility: card ${card.name} has no ability ${abilityId}`);

  player.energy -= ability.cost?.energy ?? 0;
  const sourceKind = unitSource ? "unit" : "directive";
  resolveAbility({
    state,
    ability,
    controller: pid,
    source: { kind: sourceKind, instanceId: sourceInstanceId, cardName: card.name },
    chosen: target,
    rng,
  });
}

function advanceTurn(state: GameState, rng: Rng): void {
  const endingPlayer = state.activePlayer;
  state.log.push({ type: "turnEnd", turn: state.turnNumber, player: endingPlayer });
  fireTurnAbilities(state, endingPlayer, "onTurnEnd", rng);
  processEndOfTurnStatuses(state, endingPlayer, rng);
  clearAllTurnBuffs(state);
  processDeaths(state, rng);
  checkGameOver(state);
  if (state.winner) return;

  const nextPlayer = otherPlayer(endingPlayer);
  state.turnNumber += 1;
  state.activePlayer = nextPlayer;
  if (state.turnNumber > state.turnCap) {
    resolveTurnCapTiebreak(state);
    return;
  }
  beginTurn(state, nextPlayer, rng);
}

/** Runs start-of-turn processing for `pid`: energy refill, attack-flag
 * reset, draw, and onTurnStart triggers. Exported so match setup can start
 * the very first turn the same way the engine starts every later one
 * (minus the opening draw, by convention — see match.ts). */
export function beginTurn(state: GameState, pid: PlayerId, rng: Rng, options: { draw: boolean } = { draw: true }): void {
  const player = state.players[pid];
  player.maxEnergy = Math.min(MAX_ENERGY_CAP, player.maxEnergy + 1);
  player.energy = player.maxEnergy;
  for (const unit of player.board) unit.hasAttackedThisTurn = false;
  if (options.draw) drawCardsForPlayer(state, pid, 1);
  state.log.push({ type: "turnStart", turn: state.turnNumber, player: pid });
  fireTurnAbilities(state, pid, "onTurnStart", rng);
  processDeaths(state, rng);
  checkGameOver(state);
}

interface TurnAbilitySource {
  kind: "unit" | "directive";
  instanceId: string;
  card: { name: string; abilities: Ability[] };
}

function fireTurnAbilities(state: GameState, pid: PlayerId, trigger: "onTurnStart" | "onTurnEnd", rng: Rng): void {
  const player = state.players[pid];
  const sources: TurnAbilitySource[] = [
    ...player.board.map((u): TurnAbilitySource => ({ kind: "unit", instanceId: u.instanceId, card: u.card })),
    ...player.directives.map((d): TurnAbilitySource => ({ kind: "directive", instanceId: d.instanceId, card: d.card })),
  ];
  for (const src of sources) {
    for (const ability of src.card.abilities) {
      if (ability.trigger !== trigger) continue;
      resolveAbility({
        state,
        ability,
        controller: pid,
        source: { kind: src.kind, instanceId: src.instanceId, cardName: src.card.name },
        rng,
      });
    }
  }
}

function processEndOfTurnStatuses(state: GameState, pid: PlayerId, rng: Rng): void {
  for (const unit of state.players[pid].board) {
    const overload = unit.statuses.find((s) => s.kind === "Overload");
    if (overload) {
      applyDamage(state, { kind: "unit", instanceId: unit.instanceId }, overload.amount ?? 1, "Overload", rng);
    }
    unit.statuses = unit.statuses
      .map((s) => (typeof s.duration === "number" ? { ...s, duration: s.duration - 1 } : s))
      .filter((s) => s.duration !== 0);
  }
}

function clearAllTurnBuffs(state: GameState): void {
  for (const unit of allUnits(state)) {
    unit.turnBuff = { attack: 0, health: 0 };
  }
}

/** Guarantees a match resolves — see DESIGN.md's pacing principle. Once the
 * turn cap is hit, whoever has more health wins outright (ties are a draw)
 * rather than letting a stalled match run forever. */
function resolveTurnCapTiebreak(state: GameState): void {
  const { p1, p2 } = state.players;
  if (p1.health === p2.health) {
    state.winner = "draw";
    state.log.push({ type: "gameOver", winner: "draw", reason: "turn cap reached, health tied" });
  } else {
    const winner: PlayerId = p1.health > p2.health ? "p1" : "p2";
    state.winner = winner;
    state.log.push({ type: "gameOver", winner, reason: "turn cap reached, ahead on health" });
  }
}
