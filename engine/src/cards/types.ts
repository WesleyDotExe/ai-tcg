// Card schema and the data-driven ability/effect system.
//
// Nothing in this file is card-specific. Every card's behaviour is expressed
// as data (Ability / EffectSpec / Condition / TargetSpec trees) that the
// engine's effect resolver interprets generically. There must never be a
// "if (card.id === 'x')" special case anywhere in the engine — new mechanics
// are added by extending these unions and teaching the resolver the new
// variant, not by special-casing individual cards.

export type Faction = "Cortex" | "Aegis" | "Swarm" | "Null";

export type Rarity = "Common" | "Uncommon" | "Rare" | "Mythic";

export type CardType = "Unit" | "Command" | "Directive" | "Tool";

/** When a Command or an activated ability may be played/activated.
 * "Sorcery" = only during the active player's own priority window with an
 * empty stack (their "main phase"). "Instant" = any time its controller
 * holds priority, including during the opponent's turn or in response to
 * something already on the stack — this is the mechanism behind Magic-style
 * reactivity (see DESIGN.md's owner feedback on the turn/priority model).
 * Units and Directives have no speed of their own: they are permanents,
 * always sorcery-speed timing, and always resolve immediately rather than
 * using the stack (see engine/engine.ts). */
export type Speed = "Instant" | "Sorcery";

/** Static combat keywords. Each keyword is interpreted generically by the
 * engine (combat resolution, legal-move generation) rather than expanded
 * into ad-hoc per-card flags. */
export type Keyword =
  /** Can attack the turn it is played (bypasses summoning sickness). */
  | "Rush"
  /** Enemy units must attack this unit before attacking anything else on
   * this controller's board (a taunt-style forced-target keyword). */
  | "Guard"
  /** Absorbs the next instance of damage this unit would take, then is
   * consumed. Represented in-state as a status, granted at play by this
   * keyword. */
  | "Barrier";

/** A status effect currently applied to a unit. Statuses are the
 * general-purpose "this unit is temporarily modified" mechanism used by
 * keywords (Barrier) and by effects (applyStatus). */
export type StatusKind = "Barrier" | "Stasis" | "Overload";

export interface StatusEffect {
  kind: StatusKind;
  /** Turns remaining, or "permanent"/"untilConsumed" for statuses that end
   * via an event (e.g. Barrier ends when it absorbs a hit) rather than a
   * timer. */
  duration: number | "untilConsumed";
  /** Extra numeric payload, e.g. Overload's end-of-turn damage amount. */
  amount?: number;
}

/** A quantity that can either be a flat number or scale off live board
 * state — the mechanism behind "cards whose stats mutate based on the
 * evolving board state" (design principle 1). */
export type ScalingAmount =
  | { mode: "flat"; value: number }
  | {
      mode: "scaling";
      base: number;
      multiplier: number;
      per: ScalingSource;
    };

export type ScalingSource =
  | "controllerUnitsInPlay"
  | "opponentUnitsInPlay"
  | "controllerHandSize"
  | "controllerGraveyardSize"
  | "turnNumber";

export function resolveAmount(amount: ScalingAmount, ctx: ScalingContext): number {
  if (amount.mode === "flat") return amount.value;
  const sample = ctx.sample(amount.per);
  return amount.base + amount.multiplier * sample;
}

export interface ScalingContext {
  sample(source: ScalingSource): number;
}

/** Who/what a condition or target filter evaluates relative to. */
export type Side = "controller" | "opponent" | "any";

export type Condition =
  | { kind: "always" }
  | { kind: "not"; condition: Condition }
  | { kind: "healthAtMost"; side: Exclude<Side, "any">; threshold: number }
  | { kind: "healthAtLeast"; side: Exclude<Side, "any">; threshold: number }
  | { kind: "unitsInPlayAtLeast"; side: Exclude<Side, "any">; count: number }
  | { kind: "handSizeAtLeast"; side: Exclude<Side, "any">; count: number }
  | { kind: "controllerFactionInPlay"; faction: Faction };

export interface TargetFilter {
  side: Side;
  /** "unit" = board units only, "player" = players only, "any" = either. */
  kind: "unit" | "player" | "any";
  /** Only matches units whose total (derived) max health — base stat plus
   * tools and permanent buffs, but NOT reduced by damage already taken;
   * see state/queries.ts's currentMaxHealth — is at most this value.
   * Ignored for "player" targets. A generic stat-threshold filter, not
   * tied to any one card — the mechanism for "a removal effect that only
   * threatens small/mid units, not a faction's biggest stacked
   * investments" (see Kernel Panic in data/nullCards.ts for the first
   * user, and progress/owner-feedback.md's 2026-09-17 entry for why this
   * exists). */
  maxHealth?: number;
}

export type TargetSpec =
  | { scope: "none" }
  | { scope: "self" }
  /** Player chooses one legal target matching the filter at cast/activation
   * time. Used for single-target removal/burn/buffs. */
  | { scope: "chosen"; filter: TargetFilter }
  /** Every legal target matching the filter — the AOE case. */
  | { scope: "all"; filter: TargetFilter }
  /** `count` random legal targets matching the filter. */
  | { scope: "random"; filter: TargetFilter; count: number };

export type EffectSpec =
  | { kind: "damage"; amount: ScalingAmount }
  | { kind: "heal"; amount: ScalingAmount }
  | { kind: "buff"; attack: number; health: number; duration: "permanent" | "turn" }
  | { kind: "drawCard"; count: number }
  | { kind: "gainEnergy"; amount: number }
  | { kind: "destroy" }
  | { kind: "applyStatus"; status: StatusKind; duration: number | "untilConsumed"; amount?: number }
  | { kind: "conditional"; condition: Condition; then: EffectSpec[]; else?: EffectSpec[] };

export type TriggerKind =
  | "onPlay"
  | "onAttack"
  | "onDamaged"
  | "onDeath"
  | "onTurnStart"
  | "onTurnEnd"
  /** Always-on continuous modifier recomputed on every state change; has no
   * `effects` timeline, only a `staticEffect` payload. */
  | "static"
  /** Player-activated during their main phase, may have a cost. */
  | "activated";

export type StaticEffectSpec =
  | { kind: "buffAllies"; attack: number; health: number; filter: TargetFilter }
  /** Overrides the source unit's own attack/health with a live-computed
   * value every time it's read, instead of adding a flat bonus. This is
   * the "stats mutate with board state" mechanic from design principle 1. */
  | { kind: "selfStatFromScaling"; attack?: ScalingAmount; health?: ScalingAmount };

export interface Ability {
  id: string;
  trigger: TriggerKind;
  /** Human-readable text. Not used by the resolver — kept so future
   * commentator agents and the spectator UI have real text to work from
   * instead of inventing flavour at render time. */
  text: string;
  /** Gates whether the ability fires/can be activated at all. */
  condition?: Condition;
  /** Only meaningful for trigger "activated": what the controller pays. */
  cost?: { energy: number };
  /** Only meaningful for trigger "activated": when this may be activated.
   * Defaults to "Sorcery" (active player, empty stack) when omitted, so
   * every ability written before this field existed keeps its old timing. */
  speed?: Speed;
  /** How targets are selected for `effects`. Omit for untargeted abilities. */
  targeting?: TargetSpec;
  /** Ordered effects applied when the ability resolves. Required for every
   * trigger except "static". */
  effects?: EffectSpec[];
  /** Only meaningful for trigger "static". */
  staticEffect?: StaticEffectSpec;
}

interface CardBase {
  id: string;
  name: string;
  faction: Faction;
  rarity: Rarity;
  cost: number;
  type: CardType;
  /** Art reference. In this stage-1 build this is a placeholder id resolved
   * by the (future) spectator client to a generative placeholder frame —
   * see DESIGN.md's art section. Never a rendered image at this stage. */
  art: string;
  flavor: string;
  abilities: Ability[];
}

export interface UnitCard extends CardBase {
  type: "Unit";
  attack: number;
  health: number;
  keywords: Keyword[];
  /** Board-development system (owner design-directive batch, 2026-09-12):
   * the id of the Unit card this one evolves from. Playing this card
   * requires an *active* (non-pending) unit with that exact card id
   * already on the controller's board, AND that unit must have survived to
   * a turn later than the one it was played on (owner overrule, 2026-09-13
   * stage-3 checkpoint feedback, item 4 — same-turn play-and-evolve was
   * letting a base skip the "answer it early while it's weak" exposure
   * window entirely) — see getLegalMoves' evolution targeting and
   * engine.ts's evolveUnit. The base-id requirement itself is strict (exact
   * card id, not "any lower tier") for this first implementation; a looser
   * requirement is an open question left for a future checkpoint. Evolving
   * mutates the existing board unit in place (same instanceId, same
   * accumulated damage/buffs/statuses/attached tools) rather than
   * replacing it, so it never costs an extra board slot. */
  evolvesFrom?: string;
  /** Board-development system: a telegraphed threat. When played, this
   * unit occupies a board slot face-up immediately (fully visible, a
   * legal removal target) but is "pending" — it cannot attack, cannot
   * activate abilities, contributes no static aura, and its onPlay
   * ability does not fire yet. It "arms" (pending clears, onPlay fires)
   * at the start of its controller's turn `telegraph` of their own turns
   * later — see engine.ts's computeArmTurn/processTelegraphArming. This
   * gives the opponent a real window, visible on the board, to answer it
   * before its impact lands. */
  telegraph?: number;
}

export interface CommandCard extends CardBase {
  type: "Command";
  /** Every Command uses the stack when cast (see engine/engine.ts); this
   * only gates *when* it may legally be cast — see the Speed doc comment. */
  speed: Speed;
}

export interface DirectiveCard extends CardBase {
  type: "Directive";
}

/** Board-development system: a Tool attaches to a friendly unit already in
 * play (chosen as the playCard move's target) rather than occupying a
 * board slot of its own — it amplifies an existing occupant instead of
 * competing with it for space. Deliberately simple for this first
 * implementation: a flat stat bonus plus optionally-granted keywords, no
 * independent ability timeline. See UnitInstance.tools. */
export interface ToolCard extends CardBase {
  type: "Tool";
  attackBonus: number;
  healthBonus: number;
  grantedKeywords: Keyword[];
}

export type Card = UnitCard | CommandCard | DirectiveCard | ToolCard;
