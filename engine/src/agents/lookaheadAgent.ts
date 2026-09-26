import type { Agent, PlayerView } from "./agent.js";
import type { Move } from "../engine/moves.js";
import type { TargetRef } from "../effects/targeting.js";
import type { DirectiveInstance, PlayerId, StackItem, UnitInstance } from "../state/types.js";
import { otherPlayer } from "../state/types.js";
import type { Ability, EffectSpec, ScalingContext, ScalingSource, StaticEffectSpec, TargetFilter, TargetSpec } from "../cards/types.js";
import { resolveAmount } from "../cards/types.js";
import { Rng } from "../state/rng.js";

const FACE_DAMAGE_WEIGHT = 2;
const CARD_ADVANTAGE_WEIGHT = 1.5;
const ENERGY_WEIGHT = 0.4;
/** Expected number of times a Directive's recurring turn trigger fires
 * before the match ends or the Directive is removed — see scorePlayCard. */
const DIRECTIVE_TURN_TRIGGER_HORIZON = 2;

/** Dummy agent #3 (2026-09-20 owner feedback, "fix the instrument before any
 * further balance change"): the other two dummy agents both value a move by
 * a fixed rule of thumb — Random by chance, Aggressive by raw card cost —
 * neither of which asks "what does the board look like after this?" This
 * one does: it scores every legal move by estimating the board-state change
 * it causes and takes the best-scoring one, which is what "one-step
 * lookahead" means here — a shallow, local evaluation of each move's own
 * effect, not a real search over the opponent's reply (this agent, like the
 * other two, only ever sees a redacted `PlayerView`, never the internal
 * `GameState` `applyMove` needs, so it cannot literally replay the engine to
 * see the result — see agent.ts's doc comment on why that redaction exists
 * and must stay true for every agent, dummy or real).
 *
 * The generic effect-kind scoring below (effectValueOverTargets/
 * estimateStaticEffect) is what makes this "one-step lookahead" instead of
 * "one more hardcoded heuristic": it reads the same data-driven
 * `EffectSpec`/`StaticEffectSpec`/`TargetSpec` unions the real resolver
 * interprets (cards/types.ts), so a brand-new effect or targeting kind added
 * to a future card set is scored by its *kind*, not by name — no
 * `if (card.name === ...)` anywhere in this file, matching the project's own
 * rule against that shortcut (DESIGN.md's "no shortcuts").
 *
 * This is also the mechanism behind the owner's other two requirements:
 * - "Holds Instants for a target" / "never plays a reactive card with
 *   nothing to react to": nothing special-cases this. A card's estimated
 *   effect value already comes out at (or below) zero when there's nothing
 *   worth targeting — e.g. `redirectAttack` (Intercept Routine) finds no
 *   pending combat damage on `view.stack` to redirect and scores below
 *   passing — so it loses to `passPriority` (always scored 0) on its own,
 *   the same way every other move does when it isn't worth making.
 *
 * A real, demonstrated bug this design had to be corrected for during this
 * session: an ability whose targeting scope is "all" or "self" (an AOE
 * sweep, a self-heal) has no `Move.target` at all (see engine/moves.ts —
 * only a "chosen" scope puts anything there), so scoring these off
 * `move.target` alone silently valued every one of them at zero. A first
 * 300-seed LookaheadAgent run caught this directly: several real, useful
 * Commands (an AOE damage spell, a self-heal, a team-wide buff, a mass
 * stun) were never once played across 700+ games where they were drawn —
 * not "rarely good," literally always scored at or below passing. The fix
 * (resolveViewTargets/enumerateViewTargets below) resolves a "self" or
 * "all" scope's real target(s) from the ability's own targeting spec, the
 * same way effects/targeting.ts's enumerateTargets does from the real
 * GameState, just reading a PlayerView's public board state instead. */
export class LookaheadAgent implements Agent {
  name: string;
  private rng: Rng;

  constructor(name: string, seed: number) {
    this.name = name;
    this.rng = new Rng(seed);
  }

  decideMove(view: PlayerView, legalMoves: Move[]): Move {
    let bestScore = -Infinity;
    let bestMoves: Move[] = [];
    for (const move of legalMoves) {
      const score = this.scoreMove(view, move);
      if (score > bestScore + 1e-9) {
        bestScore = score;
        bestMoves = [move];
      } else if (score > bestScore - 1e-9) {
        bestMoves.push(move);
      }
    }
    return this.rng.pick(bestMoves);
  }

  private scoreMove(view: PlayerView, move: Move): number {
    switch (move.type) {
      case "passPriority":
        return 0;
      case "attack":
        return this.scoreAttack(view, move);
      case "playCard":
        return this.scorePlayCard(view, move);
      case "activateAbility":
        return this.scoreActivateAbility(view, move);
    }
  }

  private scoreAttack(view: PlayerView, move: Extract<Move, { type: "attack" }>): number {
    const attacker = view.me.board.find((u) => u.instanceId === move.attackerInstanceId);
    if (!attacker) return -Infinity;
    const atk = approxAttack(attacker);

    const attackTarget = move.target;
    if (attackTarget.kind === "player") {
      return atk * FACE_DAMAGE_WEIGHT;
    }

    const defender = view.opponent.board.find((u) => u.instanceId === attackTarget.instanceId);
    if (!defender) return -Infinity;
    const defenderHealth = approxHealth(defender);
    const defenderAtk = approxAttack(defender);
    const attackerHealth = approxHealth(attacker);

    // Combat is mutual (see engine.ts's resolveCombatDamage): the defender
    // hits back for its own attack power if it's still standing — even a
    // defender that's about to die deals its return hit first, since death
    // processing is deferred until after both sides have applied damage.
    let value = atk >= defenderHealth ? unitValue(defender) : atk;
    if (defenderAtk >= attackerHealth) value -= unitValue(attacker);
    return value;
  }

  private scorePlayCard(view: PlayerView, move: Extract<Move, { type: "playCard" }>): number {
    const card = view.me.hand[move.handIndex];
    if (!card) return -Infinity;
    let value = -card.cost * ENERGY_WEIGHT;

    if (card.type === "Tool") {
      value += card.attackBonus + card.healthBonus + card.grantedKeywords.length * 1.5;
      return value;
    }

    if (card.type === "Unit") {
      const evolveTarget = move.target;
      if (card.evolvesFrom && evolveTarget?.kind === "unit") {
        const base = view.me.board.find((u) => u.instanceId === evolveTarget.instanceId);
        const oldBodyValue = base ? approxAttack(base) + approxHealth(base) : 0;
        const newBodyValue = card.attack + card.health;
        // Only the upgrade delta counts — the base's own body value is
        // already on the board and would double-count otherwise.
        value += Math.max(0, newBodyValue - oldBodyValue);
        const onPlay = card.abilities.find((a) => a.trigger === "onPlay");
        // Evolution mutates the base's own instance in place (engine.ts's
        // evolveUnit) — "self" targeting for the evolved form's onPlay
        // means that same, already-real instance.
        if (onPlay) value += this.estimateAbility(view, onPlay, move.abilityTarget, { kind: "unit", instanceId: evolveTarget.instanceId });
      } else {
        // A telegraphed unit sits dormant (can't attack, can't activate,
        // no static aura, no onPlay yet — see UnitCard.telegraph) until it
        // arms turns later, so its body/ability value is real but not yet
        // realised — discounted, not ignored, since board presence and the
        // opponent's need to answer it are worth something right now too.
        const telegraphDiscount = card.telegraph ? 0.4 : 1;
        value += (card.attack + card.health) * telegraphDiscount;
        const onPlay = card.abilities.find((a) => a.trigger === "onPlay");
        // A brand-new unit's own instance doesn't exist in the view yet
        // (it's created by this very move), so "self" targeting has
        // nothing real to resolve against — a named simplification: any
        // self-targeting onPlay effect on a *newly played* (non-evolving)
        // unit scores 0 rather than guessing at an instance that isn't on
        // the board yet. Non-self targeting (chosen/all/opponent, etc.)
        // is unaffected and scored normally.
        if (onPlay && !card.telegraph) value += this.estimateAbility(view, onPlay, move.target, undefined);
      }
      return value;
    }

    if (card.type === "Directive") {
      const onPlay = card.abilities.find((a) => a.trigger === "onPlay");
      const selfRef: TargetRef = { kind: "player", playerId: view.self };
      if (onPlay) value += this.estimateAbility(view, onPlay, move.target, selfRef);
      const staticAbility = card.abilities.find((a) => a.trigger === "static");
      if (staticAbility?.staticEffect) value += this.estimateStaticEffect(view, staticAbility.staticEffect);
      // A Directive whose value comes from a recurring turn trigger
      // (onTurnStart/onTurnEnd) used to score only its cost here — i.e.
      // always below passPriority's 0, so this policy could never play one
      // (found by the Phase 5 Null slice: Watchdog Timer measured 0 plays
      // in 900 Lookahead games). Each such trigger is valued as one firing
      // estimated against the current board, times a short expected
      // lifetime — a named heuristic constant, same category as this
      // file's other weights. No Directive before that slice had a turn
      // trigger, so this changes no earlier measurement.
      for (const turnAbility of card.abilities.filter((a) => a.trigger === "onTurnStart" || a.trigger === "onTurnEnd")) {
        value += this.estimateAbility(view, turnAbility, undefined, selfRef) * DIRECTIVE_TURN_TRIGGER_HORIZON;
      }
      return value;
    }

    // Command: "self" always means the controlling player (see
    // effects/resolver.ts's resolveAbility — only a unit source's "self" is
    // itself; a Command has no board presence of its own).
    const onPlay = card.abilities.find((a) => a.trigger === "onPlay");
    const selfRef: TargetRef = { kind: "player", playerId: view.self };
    if (onPlay) value += this.estimateAbility(view, onPlay, move.target ?? move.abilityTarget, selfRef);
    return value;
  }

  private scoreActivateAbility(view: PlayerView, move: Extract<Move, { type: "activateAbility" }>): number {
    const found = this.findAbility(view, move.sourceInstanceId, move.abilityId);
    if (!found) return -Infinity;
    let value = -(found.ability.cost?.energy ?? 0) * ENERGY_WEIGHT;
    value += this.estimateAbility(view, found.ability, move.target, found.selfRef);
    return value;
  }

  private findAbility(view: PlayerView, sourceInstanceId: string, abilityId: string): { ability: Ability; selfRef: TargetRef } | undefined {
    const unit = view.me.board.find((u) => u.instanceId === sourceInstanceId);
    if (unit) {
      const ability = unit.card.abilities.find((a) => a.id === abilityId);
      return ability ? { ability, selfRef: { kind: "unit", instanceId: sourceInstanceId } } : undefined;
    }
    const directive = view.me.directives.find((d) => d.instanceId === sourceInstanceId);
    if (directive) {
      const ability = directive.card.abilities.find((a) => a.id === abilityId);
      return ability ? { ability, selfRef: { kind: "player", playerId: view.self } } : undefined;
    }
    return undefined;
  }

  /** Resolves `ability`'s real target list from a `PlayerView` (mirroring
   * effects/targeting.ts's resolveTargets/enumerateTargets, but reading
   * public board state instead of the internal GameState) and sums its
   * effects' estimated value over those targets. */
  private estimateAbility(view: PlayerView, ability: Ability, chosen: TargetRef | undefined, selfRef: TargetRef | undefined): number {
    if (!ability.effects) return 0;
    const { targets, scale } = this.resolveViewTargets(view, ability.targeting, chosen, selfRef);
    return this.estimateEffectsOverTargets(view, ability.effects, targets) * scale;
  }

  private resolveViewTargets(
    view: PlayerView,
    spec: TargetSpec | undefined,
    chosen: TargetRef | undefined,
    selfRef: TargetRef | undefined,
  ): { targets: TargetRef[]; scale: number } {
    if (!spec) return { targets: [], scale: 1 };
    switch (spec.scope) {
      case "none":
        return { targets: [], scale: 1 };
      case "self":
        return { targets: selfRef ? [selfRef] : [], scale: 1 };
      case "chosen":
        return { targets: chosen ? [chosen] : [], scale: 1 };
      case "all":
        return { targets: this.enumerateViewTargets(spec.filter, view), scale: 1 };
      case "random": {
        // The real resolver picks `count` of these at random with no
        // replacement. For a linear sum of per-target effect values,
        // scoring every match and scaling by the fraction actually hit is
        // the exact expected value of that random pick (linearity of
        // expectation) — not a guess, a real equivalence.
        const matches = this.enumerateViewTargets(spec.filter, view);
        const scale = matches.length > 0 ? Math.min(spec.count, matches.length) / matches.length : 1;
        return { targets: matches, scale };
      }
    }
  }

  private enumerateViewTargets(filter: TargetFilter, view: PlayerView): TargetRef[] {
    const refs: TargetRef[] = [];
    const includeMine = filter.side !== "opponent";
    const includeTheirs = filter.side !== "controller";
    const sides: { units: UnitInstance[]; directives: DirectiveInstance[]; playerId: PlayerId }[] = [];
    if (includeMine) sides.push({ units: view.me.board, directives: view.me.directives, playerId: view.self });
    if (includeTheirs) sides.push({ units: view.opponent.board, directives: view.opponent.directives, playerId: otherPlayer(view.self) });

    for (const side of sides) {
      if (filter.kind === "unit" || filter.kind === "any") {
        for (const unit of side.units) {
          // Same "derived total max health, tools included" rule as the
          // real enumerateTargets — approximated here without tool bonuses
          // (see approxHealth's own doc comment on that tradeoff), a small,
          // named inaccuracy rather than a silent one.
          if (filter.maxHealth !== undefined && approxMaxHealth(unit) > filter.maxHealth) continue;
          refs.push({ kind: "unit", instanceId: unit.instanceId });
        }
      }
      if (filter.kind === "player" || filter.kind === "any") {
        refs.push({ kind: "player", playerId: side.playerId });
      }
      if (filter.kind === "directive") {
        for (const directive of side.directives) refs.push({ kind: "directive", instanceId: directive.instanceId });
      }
    }
    return refs;
  }

  private estimateEffectsOverTargets(view: PlayerView, effects: EffectSpec[], targets: TargetRef[]): number {
    let total = 0;
    for (const effect of effects) total += this.effectValueOverTargets(view, effect, targets);
    return total;
  }

  /** Dispatches by effect kind: drawCard/gainEnergy are flat (the real
   * resolver ignores `targets` for these too — see effects/resolver.ts's
   * applyOneEffect); conditional recurses over the same target list (the
   * real resolver reuses the outer targets for whichever branch fires); the
   * rest sum their single-target value (estimateEffect) across every
   * resolved target, exactly like applyEffects' `for (const t of targets)`
   * loop. */
  private effectValueOverTargets(view: PlayerView, effect: EffectSpec, targets: TargetRef[]): number {
    switch (effect.kind) {
      case "drawCard":
        return effect.count * CARD_ADVANTAGE_WEIGHT;
      case "gainEnergy":
        return effect.amount * ENERGY_WEIGHT * 1.5;
      case "summon":
        // Flat, like drawCard/gainEnergy above — a summon always benefits
        // its own controller and has no TargetSpec to resolve (see
        // cards/types.ts's doc comment on why), so there's no `targets`
        // list to dispatch against in the first place. Valued the same way
        // a freshly-played unit's own body is valued in scorePlayCard
        // (attack + health, no extra weight) times how many the effect
        // creates — a named approximation that doesn't discount for the
        // board-slot cap a full board would impose (see
        // effects/resolver.ts's summonTokens), the same category of
        // unmeasured simplification as this file's other heuristic
        // constants (see quality-debt.md).
        return effect.count * (effect.token.attack + effect.token.health);
      case "conditional": {
        // A full condition check (evaluateCondition) reads GameState-only
        // facts an agent's redacted PlayerView doesn't carry (e.g. exact
        // opponent graveyard contents). Rather than guess at the branch,
        // this discounts the "then" branch instead of resolving it exactly
        // — a named simplification (see progress/quality-debt.md), not a
        // silent one.
        return this.estimateEffectsOverTargets(view, effect.then, targets) * 0.5;
      }
      case "damage":
      case "heal":
      case "buff":
      case "destroy":
      case "applyStatus":
      case "redirectAttack":
        return targets.reduce((sum, t) => sum + this.estimateEffect(view, effect, t), 0);
    }
  }

  /** The heart of the "lookahead": maps one effect applied to one already-
   * resolved target to an estimated value swing, from `view.self`'s point
   * of view, using only what a `PlayerView` actually exposes (both boards,
   * own hand/graveyard, the full stack — see agent.ts's doc comment on why
   * the stack in particular is public information here). No branch below
   * reads a card name; every branch reads only the effect's own kind and
   * payload. */
  private estimateEffect(
    view: PlayerView,
    effect: Extract<EffectSpec, { kind: "damage" | "heal" | "buff" | "destroy" | "applyStatus" | "redirectAttack" }>,
    target: TargetRef,
  ): number {
    switch (effect.kind) {
      case "damage": {
        const amount = resolveAmount(effect.amount, this.scalingContext(view));
        if (target.kind === "player") {
          const mine = target.playerId === view.self;
          return mine ? -amount * FACE_DAMAGE_WEIGHT : amount * FACE_DAMAGE_WEIGHT;
        }
        const found = this.findUnit(view, target.instanceId);
        if (!found.unit) return 0;
        const lethal = amount >= approxHealth(found.unit);
        const raw = lethal ? unitValue(found.unit) : amount;
        return found.mine ? -raw : raw;
      }
      case "heal": {
        const amount = resolveAmount(effect.amount, this.scalingContext(view));
        if (target.kind === "player") {
          return (target.playerId === view.self ? amount : -amount) * 0.5;
        }
        const found = this.findUnit(view, target.instanceId);
        if (!found.unit) return 0;
        return (found.mine ? amount : -amount) * 0.5;
      }
      case "buff": {
        if (target.kind !== "unit") return 0;
        const found = this.findUnit(view, target.instanceId);
        if (!found.unit) return 0;
        const magnitude = effect.attack + effect.health;
        const durationScale = effect.duration === "permanent" ? 1 : 0.4;
        return (found.mine ? magnitude : -magnitude) * durationScale;
      }
      case "destroy": {
        if (target.kind === "unit") {
          const found = this.findUnit(view, target.instanceId);
          if (!found.unit) return 0;
          const value = unitValue(found.unit);
          return found.mine ? -value : value;
        }
        if (target.kind === "directive") {
          // A Directive has no attack/health for unitValue's shape to read
          // — its only visible signal in a PlayerView is its own cost, the
          // same proxy the rest of this file already leans on elsewhere
          // (e.g. this class's own -card.cost * ENERGY_WEIGHT play cost).
          // Named, not silent: an ongoing aura's real value depends on how
          // long it has left to matter, which a one-shot estimate can't see.
          const found = this.findDirective(view, target.instanceId);
          if (!found.directive) return 0;
          const value = found.directive.card.cost * 2;
          return found.mine ? -value : value;
        }
        return 0;
      }
      case "applyStatus": {
        if (target.kind !== "unit") return 0;
        const found = this.findUnit(view, target.instanceId);
        if (!found.unit) return 0;
        // A rough "a turn or so of that unit's offense denied" estimate —
        // Stasis/Overload/Barrier all read as "this unit is worth less for
        // a while," which is the shared shape worth scoring generically.
        const denial = approxAttack(found.unit) * 0.6;
        return found.mine ? -denial : denial;
      }
      case "redirectAttack": {
        const pending = [...view.stack].reverse().find((s): s is Extract<StackItem, { kind: "combatDamage" }> => s.kind === "combatDamage");
        if (!pending) return -1; // a real fizzle — worse than doing nothing
        const pendingTarget = pending.target;
        const goingAtMe = pendingTarget.kind === "player" && pendingTarget.playerId === view.self;
        const goingAtMyUnit = pendingTarget.kind === "unit" && view.me.board.some((u) => u.instanceId === pendingTarget.instanceId);
        if (!goingAtMe && !goingAtMyUnit) return 0; // already aimed at the opponent — nothing to gain
        const attacker = this.findUnit(view, pending.attackerInstanceId).unit;
        const prevented = attacker ? approxAttack(attacker) : 2;
        return prevented * 1.2;
      }
    }
  }

  private estimateStaticEffect(view: PlayerView, staticEffect: StaticEffectSpec): number {
    switch (staticEffect.kind) {
      case "buffAllies": {
        const affectsMine = staticEffect.filter.side !== "opponent";
        const affectsTheirs = staticEffect.filter.side !== "controller";
        const magnitude = staticEffect.attack + staticEffect.health;
        let total = 0;
        if (affectsMine) total += view.me.board.length * magnitude;
        if (affectsTheirs) total -= view.opponent.board.length * magnitude;
        // Ongoing, not one-shot — discounted for a single decision point.
        return total * 0.5;
      }
      case "selfStatFromScaling": {
        const atk = staticEffect.attack ? resolveAmount(staticEffect.attack, this.scalingContext(view)) : 0;
        const hp = staticEffect.health ? resolveAmount(staticEffect.health, this.scalingContext(view)) : 0;
        return (atk + hp) * 0.5;
      }
      case "cardCostModifier": {
        const sign = staticEffect.side === "controller" ? -1 : 1;
        // A flat, rough "worth several future turns of tax/discount"
        // estimate — this is an ongoing aura, not a one-shot effect.
        return sign * staticEffect.amount * 2;
      }
    }
  }

  private findUnit(view: PlayerView, instanceId: string): { unit?: UnitInstance; mine: boolean } {
    const mine = view.me.board.find((u) => u.instanceId === instanceId);
    if (mine) return { unit: mine, mine: true };
    const theirs = view.opponent.board.find((u) => u.instanceId === instanceId);
    if (theirs) return { unit: theirs, mine: false };
    return { mine: false };
  }

  private findDirective(view: PlayerView, instanceId: string): { directive?: DirectiveInstance; mine: boolean } {
    const mine = view.me.directives.find((d) => d.instanceId === instanceId);
    if (mine) return { directive: mine, mine: true };
    const theirs = view.opponent.directives.find((d) => d.instanceId === instanceId);
    if (theirs) return { directive: theirs, mine: false };
    return { mine: false };
  }

  private scalingContext(view: PlayerView): ScalingContext {
    return {
      sample: (source: ScalingSource): number => {
        switch (source) {
          case "controllerUnitsInPlay":
            return view.me.board.length;
          case "opponentUnitsInPlay":
            return view.opponent.board.length;
          case "controllerHandSize":
            return view.me.hand.length;
          case "controllerGraveyardSize":
            return view.me.graveyard.length;
          case "opponentGraveyardSize":
            return view.opponent.graveyard.length;
          case "turnNumber":
            return view.turnNumber;
        }
      },
    };
  }
}

/** Same "approximate from visible instance fields, not the full
 * static-aura-aware queries.ts" tradeoff AggressiveAgent documents — a real
 * agent (dummy or not) only ever sees a PlayerView, not the GameState those
 * queries need. */
function approxHealth(unit: UnitInstance): number {
  return approxMaxHealth(unit) - unit.damageTaken;
}

function approxMaxHealth(unit: UnitInstance): number {
  return unit.card.health + unit.permanentBuff.health + unit.turnBuff.health;
}

function approxAttack(unit: UnitInstance): number {
  return unit.card.attack + unit.permanentBuff.attack + unit.turnBuff.attack;
}

function unitValue(unit: UnitInstance): number {
  return approxAttack(unit) + approxHealth(unit);
}
