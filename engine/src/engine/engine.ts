import type { GameState, PlayerId, StackItem, UnitInstance, DirectiveInstance } from "../state/types.js";
import { otherPlayer } from "../state/types.js";
import { MAX_ENERGY_CAP } from "../state/init.js";
import { currentAttack, allUnits, findUnit, effectiveCardCost } from "../state/queries.js";
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
import type { Ability, ToolCard, UnitCard } from "../cards/types.js";

/** Applies one legal move (as produced by getLegalMoves) to the state,
 * mutating it in place. The caller is responsible for only ever passing a
 * move that came from getLegalMoves for the current state.
 *
 * The actor is whoever currently holds priority (`state.priority`), not
 * necessarily `state.activePlayer` — that's what lets the non-active player
 * act during their opponent's turn. Playing a Command, activating an
 * ability, or declaring an attack puts something on the stack instead of
 * resolving it immediately (Units/Directives are the one exception — see
 * playCard below); passPriority is what actually resolves the stack or
 * advances the turn, via the priority algorithm in passPriority(). */
export function applyMove(state: GameState, move: Move, rng: Rng): void {
  const pid = state.priority;
  switch (move.type) {
    case "playCard":
      playCard(state, pid, move.handIndex, move.target, move.abilityTarget, rng);
      break;
    case "attack":
      declareAttack(state, pid, move.attackerInstanceId, move.target, rng);
      break;
    case "activateAbility":
      activateAbility(state, pid, move.sourceInstanceId, move.abilityId, move.target, rng);
      break;
    case "passPriority":
      passPriority(state, rng);
      return; // passPriority manages its own cleanup/turn-advance
  }
  // Any non-pass action means the opponent hasn't yet had a chance to
  // respond to *this* — the pass counter starts over, but priority itself
  // stays with the actor (they may keep acting, or pass, next).
  state.passes = 0;
  processDeaths(state, rng);
  checkGameOver(state);
}

function playCard(
  state: GameState,
  pid: PlayerId,
  handIndex: number,
  target: TargetRef | undefined,
  abilityTarget: TargetRef | undefined,
  rng: Rng,
): void {
  const player = state.players[pid];
  const card = player.hand[handIndex];
  if (!card) throw new Error(`playCard: no card at hand index ${handIndex}`);
  player.hand.splice(handIndex, 1);
  player.energy -= effectiveCardCost(state, pid, card);

  if (card.type === "Tool") {
    if (!target || target.kind !== "unit") throw new Error(`playCard: Tool ${card.name} requires a unit target`);
    attachTool(state, pid, card, target.instanceId);
    return;
  }

  if (card.type === "Unit" && card.evolvesFrom) {
    if (!target || target.kind !== "unit") throw new Error(`playCard: evolution ${card.name} requires a unit target`);
    evolveUnit(state, pid, card, target.instanceId, abilityTarget, rng);
    return;
  }

  if (card.type === "Command") {
    // Every Command uses the stack, Instant or Sorcery alike — speed only
    // gates *when* it was legal to cast it (see getLegalMoves). Its onPlay
    // ability doesn't resolve until this item comes off the stack, which
    // is what gives an opponent a real window to respond to it.
    const instanceId = `c${state.nextInstanceId++}`;
    state.stack.push({ kind: "command", instanceId, controller: pid, card, chosen: target });
    state.log.push({ type: "cast", player: pid, card: card.name, speed: card.speed });
    return;
  }

  const onPlay = card.abilities.find((a) => a.trigger === "onPlay");
  if (card.type === "Unit") {
    const instanceId = `u${state.nextInstanceId++}`;
    const isTelegraphed = card.telegraph !== undefined && card.telegraph > 0;
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
      tools: [],
      // `target` doubles as this unit's onPlay ability's own chosen target
      // when it isn't spoken for by a structural reference (see the Move
      // type's doc comment) — for a telegraphed unit, that ability doesn't
      // fire until processTelegraphArming, turns from now, with no agent
      // decision point of its own, so the choice made *now* is captured
      // here and replayed then (see UnitInstance.armChosenTarget).
      ...(isTelegraphed ? { pending: true, armTurn: computeArmTurn(state, card.telegraph!), armChosenTarget: target } : {}),
    };
    player.board.push(unit);
    state.log.push({ type: "play", player: pid, card: card.name, instanceId });
    if (isTelegraphed) {
      // Dormant on arrival — see UnitCard.telegraph: its onPlay ability
      // (if any) is deferred to processTelegraphArming, not fired here.
      state.log.push({ type: "telegraphPlaced", unit: card.name, armIn: card.telegraph! });
    } else if (onPlay) {
      resolveAbility({
        state,
        ability: onPlay,
        controller: pid,
        source: { kind: "unit", instanceId, cardName: card.name },
        chosen: target,
        rng,
      });
    }
  } else {
    // Directive: a non-unit permanent, played and resolved immediately —
    // see the module doc comment for why permanents skip the stack.
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
  }
}

/** Board-development system: how many single-player turnNumber ticks from
 * now a telegraphed unit arms. `telegraph` counts the controller's own
 * turns (a "round"), and turnNumber advances once per single player's turn
 * (see advanceTurn), so one controller-round is 2 ticks — this lands
 * processTelegraphArming's `turnNumber >= armTurn` check exactly on the
 * controller's own turn, `telegraph` of their turns later. */
function computeArmTurn(state: GameState, telegraph: number): number {
  return state.turnNumber + 2 * telegraph;
}

/** Board-development system: evolves `targetInstanceId` in place — same
 * instanceId, same accumulated damage/buffs/statuses/attached tools —
 * mutating only its `card` to the evolved form. The consumed base card
 * goes to the graveyard (evolution spends it, mirroring the copy-limit
 * economy: a base-tier card is a real resource, not a free upgrade
 * trigger). Never costs a board slot: the board array's length is
 * unchanged. Only legal at Sorcery timing (see moves.ts), so the stack is
 * always empty here — no stack reference to the old card identity can be
 * left dangling. */
function evolveUnit(
  state: GameState,
  pid: PlayerId,
  card: UnitCard,
  targetInstanceId: string,
  abilityTarget: TargetRef | undefined,
  rng: Rng,
): void {
  const player = state.players[pid];
  const unit = player.board.find((u) => u.instanceId === targetInstanceId);
  if (!unit) throw new Error(`evolveUnit: no unit ${targetInstanceId} on ${pid}'s board`);
  const fromName = unit.card.name;
  player.graveyard.push(unit.card);
  unit.card = card;
  state.log.push({ type: "evolve", player: pid, from: fromName, to: card.name });
  const onPlay = card.abilities.find((a) => a.trigger === "onPlay");
  if (onPlay) {
    resolveAbility({
      state,
      ability: onPlay,
      controller: pid,
      source: { kind: "unit", instanceId: unit.instanceId, cardName: card.name },
      chosen: abilityTarget,
      rng,
    });
  }
}

/** Board-development system: attaches a Tool to an existing board unit —
 * see ToolCard. A Tool that grants Barrier applies the actual consumable
 * status immediately (mirroring how the Barrier *keyword* grants it at
 * creation time in playCard above), since Barrier's behaviour lives in
 * `statuses`, not in a live keyword check. */
function attachTool(state: GameState, pid: PlayerId, card: ToolCard, targetInstanceId: string): void {
  const player = state.players[pid];
  const unit = player.board.find((u) => u.instanceId === targetInstanceId);
  if (!unit) throw new Error(`attachTool: no unit ${targetInstanceId} on ${pid}'s board`);
  unit.tools.push(card);
  if (card.grantedKeywords.includes("Barrier") && !unit.statuses.some((s) => s.kind === "Barrier")) {
    unit.statuses.push({ kind: "Barrier", duration: "untilConsumed" });
  }
  state.log.push({ type: "toolAttached", player: pid, tool: card.name, unit: unit.card.name });
}

function declareAttack(state: GameState, pid: PlayerId, attackerInstanceId: string, target: TargetRef, rng: Rng): void {
  const attacker = state.players[pid].board.find((u) => u.instanceId === attackerInstanceId);
  if (!attacker) throw new Error(`attack: no unit ${attackerInstanceId} on attacker's board`);
  attacker.hasAttackedThisTurn = true;

  // onAttack fires immediately on declaration (not deferred to the stack —
  // see quality-debt.md on the scope this simplifies away); the damage
  // itself is what waits for priority to pass, so a response can still
  // change how much damage actually lands.
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

  // An attack's target is always a unit or a player — getLegalMoves never
  // offers a Directive as an attack target (a Directive has no combat
  // presence) — so this narrows safely even though TargetRef now has a
  // third "directive" variant (2026-09-20 owner-feedback entry, Phase 2
  // item 3).
  const defenderName =
    target.kind === "player"
      ? state.players[target.playerId].name
      : (state.players[otherPlayer(pid)].board.find((u) => u.instanceId === target.instanceId)?.card.name ?? target.instanceId);
  const defenderKind: "unit" | "player" = target.kind === "player" ? "player" : "unit";
  state.log.push({ type: "attack", attacker: attacker.card.name, defender: defenderName, defenderKind });

  const stackInstanceId = `k${state.nextInstanceId++}`;
  state.stack.push({
    kind: "combatDamage",
    instanceId: stackInstanceId,
    controller: pid,
    attackerInstanceId: attacker.instanceId,
    attackerName: attacker.card.name,
    target,
  });
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
  const stackInstanceId = `a${state.nextInstanceId++}`;
  state.stack.push({
    kind: "ability",
    instanceId: stackInstanceId,
    controller: pid,
    ability,
    source: { kind: sourceKind, instanceId: sourceInstanceId, cardName: card.name },
    chosen: target,
  });
  state.log.push({ type: "cast", player: pid, card: `${card.name} — ${ability.text}`, speed: ability.speed ?? "Sorcery" });
}

/** The priority algorithm: the core of Magic-style reactivity. Passing
 * hands priority to the other player; a *second* consecutive pass with
 * nothing acted on in between means neither player has anything left to do
 * right now, so something happens — the top of the stack resolves if it's
 * non-empty, or, with an empty stack, the active player's turn ends. Either
 * way the active player receives priority first afterwards (the standard
 * Magic rule), which is why turn-advance and stack-resolution both end by
 * setting state.priority = state.activePlayer / the new active player. */
function passPriority(state: GameState, rng: Rng): void {
  state.log.push({ type: "priorityPass", player: state.priority });
  state.passes += 1;
  if (state.passes < 2) {
    state.priority = otherPlayer(state.priority);
    return;
  }
  state.passes = 0;
  if (state.stack.length > 0) {
    resolveTopOfStack(state, rng);
    if (state.winner) return;
    state.priority = state.activePlayer;
    return;
  }
  advanceTurn(state, rng);
}

function resolveTopOfStack(state: GameState, rng: Rng): void {
  const item = state.stack.pop();
  if (!item) return;
  state.log.push({ type: "stackResolve", description: describeStackItem(item) });
  switch (item.kind) {
    case "command": {
      const onPlay = item.card.abilities.find((a) => a.trigger === "onPlay");
      if (onPlay) {
        resolveAbility({
          state,
          ability: onPlay,
          controller: item.controller,
          source: { kind: "command", cardName: item.card.name },
          chosen: item.chosen,
          rng,
        });
      }
      state.players[item.controller].graveyard.push(item.card);
      break;
    }
    case "ability":
      resolveAbility({ state, ability: item.ability, controller: item.controller, source: item.source, chosen: item.chosen, rng });
      break;
    case "combatDamage":
      resolveCombatDamage(state, item, rng);
      break;
  }
  processDeaths(state, rng);
  checkGameOver(state);
}

function describeStackItem(item: StackItem): string {
  switch (item.kind) {
    case "command":
      return item.card.name;
    case "ability":
      return `${item.source.cardName} — ${item.ability.text}`;
    case "combatDamage":
      return `${item.attackerName}'s attack`;
  }
}

/** Combat damage is computed live, at resolution time — never snapshotted
 * when the attack was declared — so an instant-speed response that buffs,
 * heals, or kills either combatant before this resolves genuinely changes
 * the outcome, not just the flavour text. If the attacker (or a unit
 * target) is gone by the time this resolves, the attack fizzles instead of
 * crashing or dealing damage from nothing. */
function resolveCombatDamage(state: GameState, item: Extract<StackItem, { kind: "combatDamage" }>, rng: Rng): void {
  const attacker = state.players[item.controller].board.find((u) => u.instanceId === item.attackerInstanceId);
  if (!attacker) {
    state.log.push({ type: "fizzle", reason: `${item.attackerName}'s attack fizzles — the attacker is no longer in play` });
    return;
  }
  const attackerPower = currentAttack(state, attacker);
  if (item.target.kind === "player") {
    applyDamage(state, item.target, attackerPower, attacker.card.name, rng);
    return;
  }
  const defenderFound = findUnit(state, item.target.instanceId);
  if (!defenderFound) {
    state.log.push({ type: "fizzle", reason: `${attacker.card.name}'s attack fizzles — its target is no longer in play` });
    return;
  }
  const defenderPower = currentAttack(state, defenderFound.unit);
  applyDamage(state, item.target, attackerPower, attacker.card.name, rng);
  // Re-check the attacker is still standing (a response could have killed
  // it as part of resolving the defender's side first) before it takes the
  // defender's return damage.
  if (findUnit(state, attacker.instanceId)) {
    applyDamage(state, { kind: "unit", instanceId: attacker.instanceId }, defenderPower, defenderFound.unit.card.name, rng);
  }
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
 * reset, draw, priority reset, and onTurnStart triggers. Exported so match
 * setup can start the very first turn the same way the engine starts every
 * later one (minus the opening draw, by convention — see match.ts). */
export function beginTurn(state: GameState, pid: PlayerId, rng: Rng, options: { draw: boolean } = { draw: true }): void {
  const player = state.players[pid];
  player.maxEnergy = Math.min(MAX_ENERGY_CAP, player.maxEnergy + 1);
  player.energy = player.maxEnergy;
  for (const unit of player.board) unit.hasAttackedThisTurn = false;
  state.priority = pid;
  state.passes = 0;
  if (options.draw) drawCardsForPlayer(state, pid, 1);
  state.log.push({ type: "turnStart", turn: state.turnNumber, player: pid });
  processTelegraphArming(state, pid, rng);
  fireTurnAbilities(state, pid, "onTurnStart", rng);
  processDeaths(state, rng);
  checkGameOver(state);
}

/** Board-development system: arms every telegraphed unit of `pid`'s whose
 * countdown has elapsed (see UnitCard.telegraph/computeArmTurn), firing
 * its onPlay ability now that it's finally live. Runs before this turn's
 * onTurnStart triggers so a freshly-armed unit's own onTurnStart (if any)
 * fires in the same batch as everything else this turn. */
function processTelegraphArming(state: GameState, pid: PlayerId, rng: Rng): void {
  for (const unit of state.players[pid].board) {
    if (!unit.pending || unit.armTurn === undefined || state.turnNumber < unit.armTurn) continue;
    unit.pending = false;
    state.log.push({ type: "telegraphArmed", unit: unit.card.name });
    const onPlay = unit.card.abilities.find((a) => a.trigger === "onPlay");
    if (onPlay) {
      resolveAbility({
        state,
        ability: onPlay,
        controller: pid,
        source: { kind: "unit", instanceId: unit.instanceId, cardName: unit.card.name },
        chosen: unit.armChosenTarget,
        rng,
      });
    }
  }
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
