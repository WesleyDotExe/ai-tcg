// Phase 3 of the 2026-09-20 owner-feedback entry ("balance is a systems
// problem; fix the loop, then expand the pool"): "pool-construction rules,
// enforced at load time." Balance-shaping constraints on card *design*
// should be checkable the same way copy limits and deck size already are
// (decks.ts's buildDeck), not left to a card author's memory or a code
// reviewer that doesn't exist here. This module is the lint: four rules,
// exactly as the entry names them, each implemented generically over the
// Ability/EffectSpec/StaticEffectSpec data — no "if (card.id === ...)"
// special-casing anywhere, per DESIGN.md's data-driven requirement.
//
// The entry's own words: "First rules, tune at a checkpoint" — the specific
// thresholds below (25%, cost+1, cost 4, cost 3) are the entry's own first
// numbers, wired up for real rather than guessed at again; the *definition*
// of "removal/debuff card" is this session's own first-cut formalisation
// (the entry doesn't define it precisely) and is flagged as a checkpoint
// proposal in progress/checkpoints.md — a future session or the owner may
// want to widen or narrow it.

import type {
  Ability,
  Card,
  Condition,
  EffectSpec,
  StaticEffectSpec,
  TargetFilter,
  TriggerKind,
} from "./types.js";

const REMOVAL_DEBUFF_MAX_SHARE = 0.25;
const TARGETED_DAMAGE_COST_THRESHOLD = 3;
const TARGETED_DAMAGE_MARGIN = 1;
const CHEAP_AURA_COST_THRESHOLD = 4;

/** Only these triggers count as "a card you deliberately commit as an
 * answer" for rule 1's density count. Reactive/passive triggers
 * (onAttack/onDamaged/onDeath/onTurnStart/onTurnEnd) are excluded on
 * purpose: a unit whose *secondary*, automatic-on-being-hit-or-dying
 * effect happens to graze the opponent (e.g. an onDeath ping) is not the
 * same deck-building commitment as a Command/Directive/onPlay/static/
 * activated effect a player chooses specifically to answer the board with.
 * This is the one genuinely debatable judgment call in this file — see the
 * checkpoint note above. */
const REMOVAL_ELIGIBLE_TRIGGERS: TriggerKind[] = ["onPlay", "static", "activated"];

function targetsOpponent(filter: TargetFilter | undefined): boolean {
  if (!filter) return false;
  return filter.side === "opponent" || filter.side === "any";
}

/** Flattens "conditional" effect trees so every leaf effect (including ones
 * nested inside a then/else branch) is visible to a single pass — used by
 * both the removal/debuff classifier and the targeted-damage-cap check, so
 * neither silently misses an effect that only fires conditionally. */
function* walkEffects(effects: EffectSpec[]): Generator<EffectSpec> {
  for (const effect of effects) {
    yield effect;
    if (effect.kind === "conditional") {
      yield* walkEffects(effect.then);
      if (effect.else) yield* walkEffects(effect.else);
    }
  }
}

function isRemovalOrDebuffEffect(
  effect: EffectSpec,
  scope: string | undefined,
  filter: TargetFilter | undefined,
): boolean {
  switch (effect.kind) {
    case "destroy":
      return targetsOpponent(filter);
    case "damage":
      return scope !== undefined && scope !== "self" && scope !== "none" && targetsOpponent(filter);
    case "applyStatus":
      // Stasis/Overload applied to an opponent's unit is control-denial or
      // damage-over-time on their board; Barrier applied to your own unit
      // (the only other user in the current pool) is not a debuff at all.
      return (effect.status === "Stasis" || effect.status === "Overload") && targetsOpponent(filter);
    case "buff":
      return (effect.attack < 0 || effect.health < 0) && targetsOpponent(filter);
    default:
      // heal/drawCard/gainEnergy/redirectAttack/summon never count: none of
      // them destroy, remove, or reduce anything the opponent controls —
      // redirectAttack in particular is a deliberate non-removal mechanic
      // (see aegisCards.ts's Intercept Routine) and must stay excluded.
      return false;
  }
}

function isRemovalOrDebuffStaticEffect(se: StaticEffectSpec): boolean {
  if (se.kind === "buffAllies") {
    return se.filter.side === "opponent" && (se.attack < 0 || se.health < 0);
  }
  if (se.kind === "cardCostModifier") {
    return se.side === "opponent" && se.amount > 0;
  }
  // selfStatFromScaling only ever touches the source unit's own stats.
  return false;
}

/** Rule 1's per-card classifier. Exported for reuse (e.g. a future
 * balanceReport.ts breakdown), not just an internal helper. */
export function isRemovalOrDebuffCard(card: Card): boolean {
  for (const ability of card.abilities) {
    if (!REMOVAL_ELIGIBLE_TRIGGERS.includes(ability.trigger)) continue;
    if (ability.trigger === "static") {
      if (ability.staticEffect && isRemovalOrDebuffStaticEffect(ability.staticEffect)) return true;
      continue;
    }
    const targeting = ability.targeting;
    const scope = targeting?.scope;
    const filter = targeting && "filter" in targeting ? targeting.filter : undefined;
    for (const effect of walkEffects(ability.effects ?? [])) {
      if (isRemovalOrDebuffEffect(effect, scope, filter)) return true;
    }
  }
  return false;
}

/** Rule 2: "no targeted damage above cost+1 under 3 mana." "Targeted" means
 * a player- or randomly-selected target (scope "chosen"/"random"), not a
 * board-wide sweep (scope "all") — an AOE card's cost/impact tradeoff is a
 * different curve, not this rule's concern. */
function findExcessiveTargetedDamage(card: Card): Ability | undefined {
  if (card.cost >= TARGETED_DAMAGE_COST_THRESHOLD) return undefined;
  for (const ability of card.abilities) {
    const scope = ability.targeting?.scope;
    if (scope !== "chosen" && scope !== "random") continue;
    for (const effect of walkEffects(ability.effects ?? [])) {
      if (
        effect.kind === "damage" &&
        effect.amount.mode === "flat" &&
        effect.amount.value > card.cost + TARGETED_DAMAGE_MARGIN
      ) {
        return ability;
      }
    }
  }
  return undefined;
}

/** Rule 3: "no permanent enemy-stat aura under 4 mana." Scoped narrowly to
 * a continuous stat aura (staticEffect "buffAllies" targeting the
 * opponent with a negative number) — the mechanism a "permanent...aura"
 * literally is in this engine. A cardCostModifier tax (see Aegis's Tariff
 * Field) is a different kind of standing pressure, not a stat aura, and is
 * deliberately left out of this specific rule (it still counts toward rule
 * 1's broader removal/debuff density). */
function violatesCheapPermanentEnemyAura(card: Card): Ability | undefined {
  if (card.cost >= CHEAP_AURA_COST_THRESHOLD) return undefined;
  for (const ability of card.abilities) {
    if (ability.trigger !== "static" || !ability.staticEffect) continue;
    const se = ability.staticEffect;
    if (se.kind === "buffAllies" && se.filter.side === "opponent" && (se.attack < 0 || se.health < 0)) {
      return ability;
    }
  }
  return undefined;
}

function poolHasCardFlow(cards: Card[]): boolean {
  return cards.some((card) =>
    card.abilities.some((ability) =>
      [...walkEffects(ability.effects ?? [])].some((effect) => effect.kind === "drawCard"),
    ),
  );
}

function poolHasClock(cards: Card[]): boolean {
  const hasAttacker = cards.some((card) => card.type === "Unit" && card.attack > 0);
  const hasFaceDamage = cards.some((card) =>
    card.abilities.some((ability) => {
      const targeting = ability.targeting;
      const filter = targeting && "filter" in targeting ? targeting.filter : undefined;
      if (!filter || filter.kind !== "player" || !targetsOpponent(filter)) return false;
      return [...walkEffects(ability.effects ?? [])].some((effect) => effect.kind === "damage");
    }),
  );
  return hasAttacker || hasFaceDamage;
}

/** Runs all four Phase 3 rules against a faction's full card pool (the same
 * `{card, copies}[]` shape decks.ts's buildDeck already takes) and throws a
 * single Error listing every violation found, mirroring buildDeck's own
 * copy-limit/deck-size throw pattern. Called from buildDeck itself, so it
 * is genuinely enforced every time any deck is built, not an optional
 * script. */
export function lintCardPool(pool: { card: Card; copies: number }[], factionName: string): void {
  const violations: string[] = [];

  const totalCopies = pool.reduce((sum, p) => sum + p.copies, 0);
  const removalCopies = pool
    .filter((p) => isRemovalOrDebuffCard(p.card))
    .reduce((sum, p) => sum + p.copies, 0);
  if (totalCopies > 0 && removalCopies / totalCopies > REMOVAL_DEBUFF_MAX_SHARE) {
    const pct = ((removalCopies / totalCopies) * 100).toFixed(1);
    violations.push(
      `removal/debuff cards are ${pct}% of the deck (${removalCopies}/${totalCopies} copies), ` +
        `over the ${REMOVAL_DEBUFF_MAX_SHARE * 100}% cap`,
    );
  }

  for (const { card } of pool) {
    const overCost = findExcessiveTargetedDamage(card);
    if (overCost) {
      violations.push(
        `"${card.name}" (cost ${card.cost}): targeted damage in ability "${overCost.id}" exceeds ` +
          `cost+${TARGETED_DAMAGE_MARGIN} for a card under ${TARGETED_DAMAGE_COST_THRESHOLD} mana`,
      );
    }
    const cheapAura = violatesCheapPermanentEnemyAura(card);
    if (cheapAura) {
      violations.push(
        `"${card.name}" (cost ${card.cost}): permanent enemy-stat aura in ability "${cheapAura.id}" ` +
          `costs under ${CHEAP_AURA_COST_THRESHOLD} mana`,
      );
    }
  }

  // Clock and card flow are a faction's own identity (a pool "has" them),
  // so they are checked on the faction's own cards only: a deck may not lean
  // on the neutral pool (data/neutralCards.ts) for its only card draw. The
  // 25% removal/debuff share above counts the whole deck, neutral cards
  // included, since that is what gets played.
  const cards = pool.map((p) => p.card).filter((c) => c.faction !== "Neutral");
  if (!poolHasClock(cards)) violations.push(`${factionName} pool has no clock (no card can pressure the opponent's health)`);
  if (!poolHasCardFlow(cards)) violations.push(`${factionName} pool has no card flow (no card draws)`);

  if (violations.length > 0) {
    throw new Error(`Card pool lint failed for ${factionName}:\n  - ${violations.join("\n  - ")}`);
  }
}

/** Keywords that are some faction's signature (Guard and Barrier walls,
 * Rush haste). A neutral card may not carry or grant them. */
const IDENTITY_KEYWORDS = ["Guard", "Barrier", "Rush"] as const;

function* walkConditions(effects: EffectSpec[]): Generator<Condition> {
  for (const effect of walkEffects(effects)) {
    if (effect.kind === "conditional") yield effect.condition;
  }
}

/**
 * Phase 5 item 10 (owner-feedback 2026-09-20): "Faction cards carry
 * identity; neutral cards carry utility." This is that sentence as a
 * load-time check. It returns every reason `card` is not a legal neutral
 * card, or an empty list. Called on the whole neutral pool and on every
 * neutral card in every built deck (data/decks.ts). See data/neutralCards.ts
 * for what the rule leaves room for.
 */
export function neutralCardViolations(card: Card): string[] {
  const out: string[] = [];
  if (card.faction !== "Neutral") return [`"${card.name}" is not a Neutral card`];
  if (card.rarity === "Mythic") out.push(`"${card.name}": a Mythic is a faction signature, never neutral`);
  if (isRemovalOrDebuffCard(card)) out.push(`"${card.name}": removal/debuff is faction identity`);
  const keywords = card.type === "Unit" ? card.keywords : card.type === "Tool" ? card.grantedKeywords : [];
  for (const k of keywords) {
    if ((IDENTITY_KEYWORDS as readonly string[]).includes(k)) out.push(`"${card.name}": the ${k} keyword is faction identity`);
  }
  if (card.type === "Unit" && (card.evolvesFrom || card.telegraph || card.baseArmor)) {
    out.push(`"${card.name}": evolution lines and telegraphs are faction identity`);
  }
  for (const ability of card.abilities) {
    const effects = ability.effects ?? [];
    if ([...walkEffects(effects)].some((e) => e.kind === "summon")) {
      out.push(`"${card.name}": summoning tokens is faction identity`);
    }
    if (ability.staticEffect) {
      // No neutral statics: board-scaling stats, ally auras and cost
      // auras are all faction mechanics.
      out.push(`"${card.name}": static/continuous effects are faction identity`);
    }
    const conditions = [...(ability.condition ? [ability.condition] : []), ...walkConditions(effects)];
    if (conditions.some((c) => JSON.stringify(c).includes("controllerFactionInPlay"))) {
      out.push(`"${card.name}": faction-conditional effects are faction identity`);
    }
  }
  return out;
}
