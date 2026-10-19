// The deck builder's first guess at what a card is worth (roadmap 2b, owner
// 2026-10-15: "the agent picks the best faction and deck it can build from
// the cards the owner holds"). This is only the prior: it orders the greedy
// first deck and the swaps the measured search tries (deckBuilder.ts), and
// the games decide. It reads a card's data alone (stats, keywords, triggers,
// effect trees, statics, modes), never its name or id, so a card from next
// month's set gets a rating the day it exists.
//
// Units are worth their stats; every other effect is priced in the same
// "stat points" so one number compares a 2/3 to a draw-2. The prices are
// rough by design and the search is what corrects them: the test
// (engine/test/deckBuilder.test.ts) only pins that the rating is complete
// (every live card gets a finite number) and sane on a few clear orderings.

import type { Ability, Card, EffectSpec, Keyword, ScalingAmount, StaticEffectSpec, TargetSpec, TriggerKind } from "../cards/types.js";

/** Stat points a vanilla unit gets for its cost: attack + health = 2 x cost
 * + 1 (a 1-cost 1/2, a 3-cost 3/4). A card's surplus is its value above
 * this line. */
export function vanillaValue(cost: number): number {
  return 2 * cost + 1;
}

const KEYWORD_VALUE: Record<Keyword, number> = { Rush: 1.5, Guard: 1, Barrier: 1.5 };

/** How often a trigger can be expected to fire over a unit's life. */
const TRIGGER_WEIGHT: Record<TriggerKind, number> = {
  onPlay: 1,
  onAttack: 1.5,
  onDamaged: 1,
  onDeath: 0.8,
  onTurnStart: 2,
  onTurnEnd: 2,
  onKill: 0.8,
  onEnemyAttack: 1.2,
  static: 1,
  activated: 1.5,
};

/** A scaling amount read at a typical board (2 of whatever it counts; 6 for
 * the turn number). */
function typical(amount: ScalingAmount): number {
  if (amount.mode === "flat") return amount.value;
  const sample = amount.per === "turnNumber" ? 6 : 2;
  return amount.base + amount.multiplier * sample;
}

/** How many things a targeting spec hits, for pricing an effect once per target. */
function targetCount(targeting: TargetSpec | undefined): number {
  if (!targeting) return 1;
  if (targeting.scope === "all") return targeting.filter.kind === "player" ? 1 : 2.5;
  if (targeting.scope === "random") return targeting.count;
  return 1;
}

/** Whether the targeting reaches the opponent (so a damage or minus-stats
 * effect is offence) or only one's own side. */
function hitsOpponent(targeting: TargetSpec | undefined): boolean {
  if (!targeting || targeting.scope === "none" || targeting.scope === "self") return false;
  return targeting.filter.side !== "controller";
}

function hitsFace(targeting: TargetSpec | undefined): boolean {
  if (!targeting || targeting.scope === "none" || targeting.scope === "self") return false;
  return targeting.filter.kind === "player";
}

function effectValue(effect: EffectSpec, targeting: TargetSpec | undefined): number {
  const n = targetCount(targeting);
  switch (effect.kind) {
    case "damage": {
      const v = typical(effect.amount);
      // Face damage is a clock; unit damage is removal. A "self" damage
      // effect (a drawback) costs what it would have dealt.
      if (targeting?.scope === "self") return -0.8 * v;
      return (hitsFace(targeting) ? 0.8 : 1.2) * v * n;
    }
    case "heal":
      return 0.4 * typical(effect.amount) * n;
    case "buff": {
      const size = effect.attack + 0.7 * effect.health;
      const lasting = effect.duration === "permanent" ? 1 : 0.4;
      // A minus-stats effect on the enemy is removal and is worth its size.
      if (hitsOpponent(targeting)) return Math.abs(size) * lasting * n;
      return size * lasting * n;
    }
    case "drawCard":
      return 2.5 * effect.count;
    case "gainEnergy":
      return 1.2 * effect.amount;
    case "destroy":
      return 6 * n;
    case "applyStatus": {
      const turns = effect.duration === "untilConsumed" ? 1 : effect.duration;
      if (effect.status === "Barrier") return 1.5 * n;
      if (effect.status === "Stasis") return 2 * turns * n;
      return (effect.amount ?? 1) * turns * n;
    }
    case "conditional":
      return 0.6 * effectsValue(effect.then, targeting) + 0.4 * effectsValue(effect.else ?? [], targeting);
    case "redirectAttack":
      return 2;
    case "summon": {
      const t = effect.token;
      const keywords = t.keywords.reduce((s, k) => s + KEYWORD_VALUE[k], 0);
      return effect.count * (t.attack + t.health + keywords);
    }
  }
}

function effectsValue(effects: readonly EffectSpec[], targeting: TargetSpec | undefined): number {
  return effects.reduce((s, e) => s + effectValue(e, targeting), 0);
}

function staticValue(se: StaticEffectSpec): number {
  switch (se.kind) {
    // An aura over a typical board of 2.5 units, friend or foe, for as
    // long as its source stays (counted as 1.5 boards' worth).
    case "buffAllies":
      return 3.75 * Math.abs(se.attack + 0.7 * se.health);
    case "selfStatFromScaling":
      // Counted in the unit's own stats (unitStats below).
      return 0;
    case "cardCostModifier":
      return 2 * Math.abs(se.amount);
  }
}

function abilityValue(ability: Ability): number {
  if (ability.trigger === "static") return ability.staticEffect ? staticValue(ability.staticEffect) : 0;
  const weight = TRIGGER_WEIGHT[ability.trigger];
  const paid = ability.cost?.energy ?? 0;
  const value = weight * effectsValue(ability.effects ?? [], ability.targeting) - (ability.trigger === "activated" ? paid : 0);
  return ability.condition ? 0.7 * value : value;
}

/** A unit's own attack and health, reading a scaling stat override at a
 * typical board. */
function unitStats(card: Extract<Card, { type: "Unit" }>): number {
  let attack = card.attack;
  let health = card.health;
  for (const a of card.abilities) {
    if (a.trigger === "static" && a.staticEffect?.kind === "selfStatFromScaling") {
      if (a.staticEffect.attack) attack = typical(a.staticEffect.attack);
      if (a.staticEffect.health) health = typical(a.staticEffect.health);
    }
  }
  return attack + health;
}

/** What `card` is worth in stat points, before its cost. */
export function cardValue(card: Card): number {
  const abilities = card.abilities.reduce((s, a) => s + abilityValue(a), 0);
  // A modal card is played in its best mode.
  const modes = card.modes && card.modes.length > 0 ? Math.max(...card.modes.map((m) => m.abilities.reduce((s, a) => s + abilityValue(a), 0))) : 0;
  const text = abilities + modes;
  switch (card.type) {
    case "Unit": {
      const keywords = card.keywords.reduce((s, k) => s + KEYWORD_VALUE[k], 0);
      let v = unitStats(card) + keywords + text + (card.baseArmor ?? 0) * 0.5;
      // A telegraphed unit gives the opponent a window; an evolution needs
      // its base already on the board.
      if (card.telegraph) v *= 0.85;
      if (card.evolvesFrom) v *= 0.85;
      return v;
    }
    case "Tool": {
      const keywords = card.grantedKeywords.reduce((s, k) => s + KEYWORD_VALUE[k], 0);
      // A Tool needs a host to live on.
      return 0.85 * (card.attackBonus + card.healthBonus + keywords + text);
    }
    case "Command":
      return card.speed === "Instant" ? 1.1 * text : text;
    case "Directive":
      return text;
  }
}

/** `card`'s value above a vanilla unit of its cost: the deck builder's prior. */
export function cardRating(card: Card): number {
  return cardValue(card) - vanillaValue(card.cost);
}
