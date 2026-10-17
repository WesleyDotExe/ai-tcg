import { resolveAmount } from "../cards/types.js";
import type { Ability, EffectSpec, StatusKind, TokenSpec, UnitCard } from "../cards/types.js";
import type { GameState, PlayerId, UnitInstance } from "../state/types.js";
import type { Rng } from "../state/rng.js";
import { findUnit, findDirective, allUnits, isAlive, currentMaxHealth, boardSlotsUsed, signatureCost } from "../state/queries.js";
import { evaluateCondition } from "./conditions.js";
import { resolveTargets, type TargetRef } from "./targeting.js";
import { buildScalingContext } from "./scaling.js";
import { BOARD_SLOTS } from "../state/init.js";

/** Where an ability's owner lives, i.e. what "self" targeting means for it.
 * A Unit's "self" is the unit itself on the board; a Command has no board
 * presence, so its "self" is the controlling player (e.g. "restore 3
 * health to yourself"); a Directive is a non-unit permanent — same rule.
 * "detached" covers a unit ability firing after the unit has already left
 * the board (onDeath, fired post-removal) — "self" targeting isn't legal
 * for those abilities since there's no unit left to target. */
export type AbilitySource =
  | { kind: "unit"; instanceId: string; cardName: string }
  | { kind: "directive"; instanceId: string; cardName: string }
  | { kind: "command"; instanceId: string; cardName: string }
  | { kind: "detached"; instanceId: string; cardName: string };
// A Command's instanceId is its stack id (`c..`); a detached source's is the
// dead unit's old board id. Every source has one, so every event an ability
// causes can carry a sourceId (see GameEvent in state/types.ts).

/** Who an event is attributed to: the card name the text log prints, plus
 * the instance id the spectator client aims by (GameEvent's `sourceId`).
 * `id` is absent only for a source that isn't a card (Overload's tick). */
export interface EventSource {
  name: string;
  id?: string;
}

interface EffectContext {
  state: GameState;
  controller: PlayerId;
  source: EventSource;
  rng: Rng;
}

export interface ResolveAbilityParams {
  state: GameState;
  ability: Ability;
  controller: PlayerId;
  source: AbilitySource;
  /** The target the acting agent chose, for abilities whose targeting scope
   * is "chosen". Ignored otherwise. */
  chosen?: TargetRef;
  rng: Rng;
}

/** Resolves one ability firing: condition check, target resolution, effect
 * application, then cleans up anything the effects killed (cascading
 * onDeath triggers) and re-checks the win condition. This is the single
 * entry point every trigger (onPlay/onAttack/onDamaged/onDeath/turn
 * triggers/activated) goes through — there is no separate path for
 * "special" cards. */
export function resolveAbility(params: ResolveAbilityParams): void {
  const { state, ability, controller, source, chosen, rng } = params;
  if (ability.trigger === "static") return; // static abilities have no timeline
  if (ability.condition && !evaluateCondition(ability.condition, state, controller)) return;
  if (!ability.effects) return;
  // A "chosen"-scope ability fired with no target supplied means there was
  // no legal target for it when it was played/triggered (see engine/
  // moves.ts's evolution branch, and UnitInstance.armChosenTarget for the
  // telegraph-arm case) — skip it rather than crash. resolveTargets still
  // throws on this combination for every other caller, which is correct:
  // getLegalMoves never offers a plain unit/Command/activated-ability move
  // whose chosen target doesn't exist, so reaching this path any other way
  // would be a real bug worth surfacing loudly, not silently swallowing.
  if (ability.targeting?.scope === "chosen" && chosen === undefined) return;
  // A once-per-turn unit ability that already resolved this turn does
  // nothing (Ability.limit). The use is counted here, so every trigger kind
  // honours the limit the same way.
  if (ability.limit === "oncePerTurn" && source.kind === "unit") {
    const unit = findUnit(state, source.instanceId)?.unit;
    if (unit) {
      if (unit.usedThisTurn?.includes(ability.id)) return;
      (unit.usedThisTurn ??= []).push(ability.id);
    }
  }

  const selfRef: TargetRef | undefined =
    source.kind === "unit" ? { kind: "unit", instanceId: source.instanceId } : { kind: "player", playerId: controller };
  const targets = ability.targeting
    ? resolveTargets({ spec: ability.targeting, controller, state, chosen, selfRef, rng })
    : [];

  state.log.push({
    type: "abilityTrigger",
    source: source.cardName,
    ability: ability.id,
    trigger: ability.trigger,
    sourceId: source.instanceId,
    targets: targets.map((t) => ({ ...t })),
  });
  const ctx: EffectContext = { state, controller, source: { name: source.cardName, id: source.instanceId }, rng };
  applyEffects(ability.effects, targets, ctx);
  processDeaths(state, rng);
  checkGameOver(state);
}

export function applyEffects(effects: EffectSpec[], targets: TargetRef[], ctx: EffectContext): void {
  for (const effect of effects) {
    applyOneEffect(effect, targets, ctx);
  }
}

function applyOneEffect(effect: EffectSpec, targets: TargetRef[], ctx: EffectContext): void {
  switch (effect.kind) {
    case "damage": {
      const amount = resolveAmount(effect.amount, buildScalingContext(ctx.state, ctx.controller));
      for (const t of targets) applyDamage(ctx.state, t, amount, ctx.source, ctx.rng);
      return;
    }
    case "heal": {
      const amount = resolveAmount(effect.amount, buildScalingContext(ctx.state, ctx.controller));
      for (const t of targets) applyHeal(ctx.state, t, amount, ctx.source);
      return;
    }
    case "buff":
      for (const t of targets) buffUnit(ctx, t, effect.attack, effect.health, effect.duration);
      return;
    case "drawCard":
      drawCardsForPlayer(ctx.state, ctx.controller, effect.count);
      return;
    case "gainEnergy":
      gainEnergyEffect(ctx, ctx.controller, effect.amount);
      return;
    case "destroy":
      for (const t of targets) applyDestroy(ctx, t);
      return;
    case "applyStatus":
      for (const t of targets) applyStatusToUnit(ctx, t, effect.status, effect.duration, effect.amount);
      return;
    case "conditional": {
      const holds = evaluateCondition(effect.condition, ctx.state, ctx.controller);
      const branch = holds ? effect.then : effect.else;
      if (branch) applyEffects(branch, targets, ctx);
      return;
    }
    case "redirectAttack": {
      for (const t of targets) redirectTopAttack(ctx.state, t, ctx.source);
      return;
    }
    case "summon":
      summonTokens(ctx, effect.token, effect.count);
      return;
  }
}

function describeTargetRef(state: GameState, ref: TargetRef): string {
  if (ref.kind === "player") return state.players[ref.playerId].name;
  const found = findUnit(state, ref.instanceId);
  return found ? found.unit.card.name : ref.instanceId;
}

/** Redirects the nearest pending combat-damage stack item (searched from the
 * top down, since that's almost always the one this Instant was cast in
 * response to) to `newTarget` — the "intercept" mechanic: an Aegis unit
 * steps in front of an attack aimed at something else. The attack still
 * resolves in full once it comes off the stack, computed live against
 * whoever is now the target, exactly like any other combat damage; nothing
 * is destroyed or countered. No-ops (logged, not silent) if there's nothing
 * pending to redirect — same convention as any other effect whose target
 * has already vanished. See Aegis's Intercept Routine, data/aegisCards.ts. */
function redirectTopAttack(state: GameState, newTarget: TargetRef, source: EventSource): void {
  const sourceLabel = source.name;
  for (let i = state.stack.length - 1; i >= 0; i--) {
    const item = state.stack[i]!;
    if (item.kind !== "combatDamage") continue;
    const from = describeTargetRef(state, item.target);
    // Redirecting onto the unit the attack already targets changes nothing,
    // so it must not be logged as a redirect: commentators and the render
    // read attackRedirected as "the aim moved". Found when a LookaheadAgent
    // cast Intercept Routine on the unit already under attack.
    if (JSON.stringify(item.target) === JSON.stringify(newTarget)) {
      state.log.push({
        type: "fizzle",
        reason: `${sourceLabel}: ${item.attackerName}'s attack is already aimed at ${from}`,
        cause: "alreadyAimed",
        source: sourceLabel,
        sourceId: source.id,
        attacker: item.attackerName,
        attackerId: item.attackerInstanceId,
        target: from,
        targetRef: { ...item.target },
      });
      return;
    }
    const fromRef = item.target;
    item.target = newTarget;
    state.log.push({
      type: "attackRedirected",
      source: sourceLabel,
      attacker: item.attackerName,
      from,
      to: describeTargetRef(state, newTarget),
      sourceId: source.id,
      attackerId: item.attackerInstanceId,
      fromRef: { ...fromRef },
      toRef: { ...newTarget },
    });
    return;
  }
  state.log.push({ type: "fizzle", reason: `${sourceLabel} finds no pending attack to redirect`, cause: "noPendingAttack", source: sourceLabel, sourceId: source.id });
}

/** The single choke point for all damage to a unit or player — combat
 * damage and effect damage both route through here, so Barrier absorption
 * and onDamaged triggers fire consistently no matter the source. */
export function applyDamage(state: GameState, target: TargetRef, amount: number, source: EventSource, rng: Rng): void {
  if (amount <= 0) return;
  const sourceLabel = source.name;
  const sourceId = source.id;
  if (target.kind === "player") {
    const player = state.players[target.playerId];
    player.health -= amount;
    state.log.push({ type: "damage", target: player.name, targetKind: "player", amount, source: sourceLabel, sourceId, targetRef: { ...target } });
    return;
  }
  const found = findUnit(state, target.instanceId);
  if (!found) return; // already dead earlier in this resolution
  const { unit } = found;
  // Board-development system, Phase 2 item 5 (2026-09-20 owner-feedback
  // entry): a base card's flat baseArmor reduces incoming damage before
  // anything else sees it — read straight off unit.card, so the moment
  // evolveUnit mutates this instance's card to the evolved form (which has
  // no baseArmor of its own), the protection is simply gone, no separate
  // bookkeeping needed. A hit fully absorbed by armor never reaches Barrier
  // or onDamaged — nothing actually happened to the unit.
  const armor = unit.card.baseArmor ?? 0;
  const effectiveAmount = armor > 0 ? Math.max(0, amount - armor) : amount;
  if (armor > 0 && effectiveAmount !== amount) {
    state.log.push({
      type: "baseArmorReduced",
      unit: unit.card.name,
      source: sourceLabel,
      rawAmount: amount,
      reducedTo: effectiveAmount,
      sourceId,
      unitId: unit.instanceId,
    });
  }
  if (effectiveAmount <= 0) return;
  const barrierIdx = unit.statuses.findIndex((s) => s.kind === "Barrier");
  if (barrierIdx !== -1) {
    unit.statuses.splice(barrierIdx, 1);
    state.log.push({ type: "barrierAbsorbed", unit: unit.card.name, source: sourceLabel, sourceId, unitId: unit.instanceId });
    return;
  }
  const wasAlive = isAlive(state, unit);
  unit.damageTaken += effectiveAmount;
  if (wasAlive && !isAlive(state, unit) && sourceId) unit.lethalBy = sourceId;
  state.log.push({
    type: "damage",
    target: unit.card.name,
    targetKind: "unit",
    amount: effectiveAmount,
    source: sourceLabel,
    sourceId,
    targetRef: { kind: "unit", instanceId: unit.instanceId },
  });
  // A unit whose health has already dropped to 0 or below is dead in
  // substance even though processDeaths (which actually removes it from
  // the board and fires onDeath) only runs once the outer resolveAbility
  // call finishes cascading — see processDeaths's own comment on why
  // death handling is deferred to a fixed-point pass rather than done
  // inline here. Without this guard, two units that each retaliate against
  // damage by damaging the other (e.g. two copies of a card whose
  // onDamaged deals damage to all enemy units) recurse forever: each hit
  // re-triggers the other's onDamaged before either is ever removed from
  // the board, which is a real stack overflow reproduced by
  // dev/balanceReport.ts's Cortex-mirror matchup, not a hypothetical.
  if (!isAlive(state, unit)) return;
  for (const ability of unit.card.abilities) {
    if (ability.trigger === "onDamaged") {
      resolveAbility({
        state,
        ability,
        controller: unit.controller,
        source: { kind: "unit", instanceId: unit.instanceId, cardName: unit.card.name },
        rng,
      });
    }
  }
}

export function applyHeal(state: GameState, target: TargetRef, amount: number, source: EventSource): void {
  if (amount <= 0) return;
  const sourceLabel = source.name;
  const sourceId = source.id;
  if (target.kind === "player") {
    const player = state.players[target.playerId];
    const before = player.health;
    player.health = Math.min(player.maxHealth, player.health + amount);
    const healed = player.health - before;
    if (healed > 0) {
      state.log.push({ type: "heal", target: player.name, targetKind: "player", amount: healed, source: sourceLabel, sourceId, targetRef: { ...target } });
    }
    return;
  }
  const found = findUnit(state, target.instanceId);
  if (!found) return;
  const { unit } = found;
  const before = unit.damageTaken;
  unit.damageTaken = Math.max(0, unit.damageTaken - amount);
  const healed = before - unit.damageTaken;
  if (healed > 0) {
    state.log.push({
      type: "heal",
      target: unit.card.name,
      targetKind: "unit",
      amount: healed,
      source: sourceLabel,
      sourceId,
      targetRef: { kind: "unit", instanceId: unit.instanceId },
    });
  }
}

const FATIGUE_DAMAGE = 2;

/** Draws `count` cards for `playerId`, dealing fatigue damage per card when
 * the deck is empty. Used both by turn-start draws and by draw effects. */
export function drawCardsForPlayer(state: GameState, playerId: PlayerId, count: number): void {
  const player = state.players[playerId];
  for (let i = 0; i < count; i++) {
    const card = player.deck.shift();
    if (card) {
      player.hand.push(card);
      state.log.push({ type: "draw", player: playerId, card: card.name });
    } else {
      player.health -= FATIGUE_DAMAGE;
      state.log.push({ type: "fatigue", player: playerId, damage: FATIGUE_DAMAGE });
    }
  }
}

function buffUnit(ctx: EffectContext, target: TargetRef, attack: number, health: number, duration: "permanent" | "turn"): void {
  if (target.kind !== "unit") return;
  const found = findUnit(ctx.state, target.instanceId);
  if (!found) return;
  const { unit } = found;
  if (duration === "permanent") {
    unit.permanentBuff.attack += attack;
    unit.permanentBuff.health += health;
  } else {
    unit.turnBuff.attack += attack;
    unit.turnBuff.health += health;
  }
  ctx.state.log.push({ type: "buff", target: unit.card.name, attack, health, source: ctx.source.name, sourceId: ctx.source.id, targetId: unit.instanceId });
}

function applyStatusToUnit(
  ctx: EffectContext,
  target: TargetRef,
  status: StatusKind,
  duration: number | "untilConsumed",
  amount?: number,
): void {
  if (target.kind !== "unit") return;
  const found = findUnit(ctx.state, target.instanceId);
  if (!found) return;
  found.unit.statuses.push({ kind: status, duration, amount });
  ctx.state.log.push({
    type: "statusApplied",
    target: found.unit.card.name,
    status,
    source: ctx.source.name,
    sourceId: ctx.source.id,
    targetId: found.unit.instanceId,
  });
}

/** Unconditional removal, dispatched on the resolved target's own kind — a
 * unit (the original, pre-2026-09-20 behaviour) or a Directive (the new
 * "Directives must be removable" engine gap, 2026-09-20 owner-feedback
 * entry, Phase 2 item 3). A player target never reaches here: no filter
 * kind that resolves to "destroy" enumerates players. */
function applyDestroy(ctx: EffectContext, target: TargetRef): void {
  if (target.kind === "unit") {
    const found = findUnit(ctx.state, target.instanceId);
    if (!found) return;
    // Destroy bypasses Barrier (it isn't damage) and guarantees lethal
    // regardless of any buffs applied earlier this tick.
    const wasAlive = isAlive(ctx.state, found.unit);
    found.unit.damageTaken = currentMaxHealth(ctx.state, found.unit) + 1;
    if (wasAlive && ctx.source.id) found.unit.lethalBy = ctx.source.id;
  } else if (target.kind === "directive") {
    destroyDirective(ctx, target.instanceId);
  }
}

/** Removes a Directive from its controller's board straight to the
 * graveyard — Directives have no health/damage model (see DirectiveInstance:
 * no `damageTaken`, no death-processing pass), so unlike a unit this can't
 * route through processDeaths; it's a direct, immediate removal, logged with
 * its own event so a future commentator has something to narrate beyond "a
 * card was played" (the same gap named for Tariff Field in
 * progress/quality-debt.md, avoided here from the start). No-ops harmlessly
 * (same convention as every other effect whose target has already vanished)
 * if the directive is already gone. */
function destroyDirective(ctx: EffectContext, instanceId: string): void {
  const found = findDirective(ctx.state, instanceId);
  if (!found) return;
  const { directive, owner } = found;
  const player = ctx.state.players[owner];
  const idx = player.directives.findIndex((d) => d.instanceId === instanceId);
  if (idx === -1) return;
  player.directives.splice(idx, 1);
  player.graveyard.push(directive.card);
  ctx.state.log.push({
    type: "directiveDestroyed",
    directive: directive.card.name,
    controller: owner,
    source: ctx.source.name,
    sourceId: ctx.source.id,
    instanceId,
  });
}

/** Creates up to `count` fresh token units on the controller's board — the
 * "summon" effect kind (2026-09-20 owner-feedback entry, Phase 2 item 4).
 * Deliberately mirrors engine.ts's playCard Unit branch (same UnitInstance
 * shape, same board-slot accounting) rather than inventing a parallel
 * creation path, so a token behaves identically to a drawn-and-played unit
 * from the moment it lands: it can be buffed, evolved onto (its `id` is a
 * real, stable string so a future evolvesFrom could target it), attached to,
 * and goes to the graveyard on death exactly like any other unit. Bound by
 * the same BOARD_SLOTS cap a normal play would be — a wide board that's
 * already full gets no benefit from a summon effect, same as it couldn't
 * play another Unit from hand either; if there isn't room for every token
 * asked for, as many as fit are created and the rest fizzle, logged rather
 * than silently dropped (mirroring the project's existing fizzle
 * convention — see redirectTopAttack above). */
function summonTokens(ctx: EffectContext, token: TokenSpec, count: number): void {
  const player = ctx.state.players[ctx.controller];
  const cardId = `token-${token.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const card: UnitCard = {
    id: cardId,
    name: token.name,
    faction: token.faction,
    rarity: "Common",
    cost: 0,
    type: "Unit",
    art: token.art,
    flavor: token.flavor,
    abilities: [],
    attack: token.attack,
    health: token.health,
    keywords: token.keywords,
  };
  for (let i = 0; i < count; i++) {
    if (boardSlotsUsed(player) >= BOARD_SLOTS) {
      ctx.state.log.push({ type: "summonFizzle", player: ctx.controller, token: token.name, source: ctx.source.name, sourceId: ctx.source.id });
      continue;
    }
    const instanceId = `u${ctx.state.nextInstanceId++}`;
    const unit: UnitInstance = {
      instanceId,
      card,
      controller: ctx.controller,
      permanentBuff: { attack: 0, health: 0 },
      turnBuff: { attack: 0, health: 0 },
      damageTaken: 0,
      statuses: card.keywords.includes("Barrier") ? [{ kind: "Barrier", duration: "untilConsumed" }] : [],
      enteredTurn: ctx.state.turnNumber,
      hasAttackedThisTurn: false,
      tools: [],
    };
    player.board.push(unit);
    ctx.state.log.push({ type: "summon", player: ctx.controller, token: token.name, instanceId, source: ctx.source.name, sourceId: ctx.source.id });
  }
}

function gainEnergyEffect(ctx: EffectContext, playerId: PlayerId, amount: number): void {
  const player = ctx.state.players[playerId];
  const before = player.energy;
  player.energy = Math.min(player.maxEnergy, player.energy + amount);
  const gained = player.energy - before;
  if (gained > 0) {
    ctx.state.log.push({ type: "gainEnergy", player: playerId, amount: gained, source: ctx.source.name, sourceId: ctx.source.id });
  }
}

/** Removes any unit whose derived health has dropped to 0 or below, fires
 * its onDeath triggers, and repeats — a death trigger can itself kill more
 * units, so this must loop to a fixed point rather than run once. */
export function processDeaths(state: GameState, rng: Rng): void {
  let round = allUnits(state).filter((u) => !isAlive(state, u));
  while (round.length > 0) {
    for (const unit of round) {
      const player = state.players[unit.controller];
      const idx = player.board.findIndex((u) => u.instanceId === unit.instanceId);
      if (idx === -1) continue;
      player.board.splice(idx, 1);
      // A signature card goes back to its zone instead (see SignatureZone),
      // to be played again at a higher cost; its Tools still go down.
      const zone = unit.signature ? player.signature : null;
      if (!zone) player.graveyard.push(unit.card);
      // Attached Tools (see ToolCard) go down with the unit they were on.
      for (const tool of unit.tools) player.graveyard.push(tool);
      state.log.push({ type: "death", unit: unit.card.name, controller: unit.controller, instanceId: unit.instanceId });
      if (zone) {
        zone.inZone = true;
        state.log.push({
          type: "signatureReturn",
          player: unit.controller,
          card: zone.card.name,
          instanceId: unit.instanceId,
          nextCost: signatureCost(state, unit.controller)!,
        });
      }
    }
    for (const unit of round) {
      for (const ability of unit.card.abilities) {
        if (ability.trigger === "onDeath") {
          resolveAbility({
            state,
            ability,
            controller: unit.controller,
            source: { kind: "detached", instanceId: unit.instanceId, cardName: unit.card.name },
            rng,
          });
        }
      }
    }
    // onKill: the unit that dealt the killing hit, if it is still on the
    // board (a unit that died in the same exchange gets nothing).
    for (const unit of round) {
      if (!unit.lethalBy) continue;
      const killer = findUnit(state, unit.lethalBy)?.unit;
      if (!killer || !isAlive(state, killer)) continue;
      for (const ability of killer.card.abilities) {
        if (ability.trigger !== "onKill") continue;
        resolveAbility({
          state,
          ability,
          controller: killer.controller,
          source: { kind: "unit", instanceId: killer.instanceId, cardName: killer.card.name },
          rng,
        });
      }
    }
    round = allUnits(state).filter((u) => !isAlive(state, u));
  }
}

export function checkGameOver(state: GameState): void {
  if (state.winner) return;
  const p1Dead = state.players.p1.health <= 0;
  const p2Dead = state.players.p2.health <= 0;
  if (p1Dead && p2Dead) {
    state.winner = "draw";
    state.log.push({ type: "gameOver", winner: "draw", reason: "both players' health reached 0 at once", cause: { kind: "healthDepleted", losers: ["p1", "p2"] } });
  } else if (p1Dead) {
    state.winner = "p2";
    state.log.push({ type: "gameOver", winner: "p2", reason: "p1's health reached 0", cause: { kind: "healthDepleted", losers: ["p1"] } });
  } else if (p2Dead) {
    state.winner = "p1";
    state.log.push({ type: "gameOver", winner: "p1", reason: "p2's health reached 0", cause: { kind: "healthDepleted", losers: ["p2"] } });
  }
}
