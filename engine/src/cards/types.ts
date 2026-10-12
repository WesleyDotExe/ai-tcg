// Card schema and the data-driven ability/effect system.
//
// Nothing in this file is card-specific. Every card's behaviour is expressed
// as data (Ability / EffectSpec / Condition / TargetSpec trees) that the
// engine's effect resolver interprets generically. There must never be a
// "if (card.id === 'x')" special case anywhere in the engine — new mechanics
// are added by extending these unions and teaching the resolver the new
// variant, not by special-casing individual cards.

export type Faction = "Cortex" | "Aegis" | "Swarm" | "Null" | "Neutral";

/** A faction a deck can be built around. "Neutral" is the shared utility
 * pool (data/neutralCards.ts): any deck may run some of it, but no deck is a
 * Neutral deck (see data/decks.ts's buildDeck). */
export type DeckFaction = Exclude<Faction, "Neutral">;

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
  /** The opponent's graveyard size — a unit that scales off what the
   * OPPONENT has lost rather than what its own controller has (contrast
   * controllerGraveyardSize). First user: Null's Entropy Harvester
   * (2026-09-22, Phase 4 backstop step 3 — see data/nullCards.ts's own
   * comment on why). Both graveyards are public zones (state/types.ts),
   * so this is exposed to PlayerView the same as any other opponent-facing
   * count and needs no new redaction rule. */
  | "opponentGraveyardSize"
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
  /** "unit" = board units only, "player" = players only, "directive" = board
   * Directives only (see DirectiveInstance — a non-unit permanent), "any" =
   * unit or player (directives were never part of "any"'s meaning and stay
   * out of it now — a card written before "directive" existed must keep
   * seeing exactly what it always saw). */
  kind: "unit" | "player" | "directive" | "any";
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
  /** Unconditional removal, ignoring stats entirely. Works on a unit (see
   * Null's Kernel Panic) or, since the 2026-09-20 owner-feedback entry
   * ("Directives must be removable"), a Directive (see targeting.ts's
   * TargetRef and effects/resolver.ts's applyDestroy) — the same effect
   * kind, dispatched on the resolved target's own kind, not two separate
   * mechanics. */
  | { kind: "destroy" }
  | { kind: "applyStatus"; status: StatusKind; duration: number | "untilConsumed"; amount?: number }
  | { kind: "conditional"; condition: Condition; then: EffectSpec[]; else?: EffectSpec[] }
  /** Redirects the nearest pending combat-damage stack item to a new
   * target — an "intercept," not removal: nothing is destroyed, the attack
   * still lands in full, just against whoever now stands in the way. See
   * Aegis's Intercept Routine (data/aegisCards.ts) for the first user and
   * effects/resolver.ts's redirectTopAttack for the mechanism. No-ops
   * harmlessly if nothing is currently pending to redirect. */
  | { kind: "redirectAttack" }
  /** Creates `count` fresh token Unit(s) directly on the controller's board
   * — not drawn from hand or deck, generated on the fly from `token`'s own
   * stat block (2026-09-20 owner-feedback entry, Phase 2 item 4: "so wide
   * decks can rebuild after board-wide damage" — this is the rebuild
   * mechanism the entry names Swarm as lacking). Untargeted, like drawCard/
   * gainEnergy — a summon always benefits its own controller, never the
   * opponent, so it needs no TargetSpec. Respects the same shared board-slot
   * cap (state/init.ts's BOARD_SLOTS) every other Unit/Directive entering
   * play does: if there isn't room for every token, as many as fit are
   * created and the rest fizzle (logged, not silently dropped) — see
   * effects/resolver.ts's summonTokens. A token has no abilities of its own
   * and never sits in a hand/deck; once on the board it behaves exactly like
   * any other unit (can be buffed, evolved onto, attached to, killed, and
   * goes to the graveyard on death). */
  | { kind: "summon"; token: TokenSpec; count: number };

/** The self-contained stat block for a "summon" effect's token — deliberately
 * shaped like CardBase's own fields (not a reference to some other card)
 * because a token has no printed card of its own to point at; the effect
 * that creates it fully describes what it is. `faction` is written explicitly
 * per token rather than inferred from the summoning card's controller, since
 * nothing elsewhere in the engine tracks "which faction is this player
 * playing" as live state (only the deck's card list does) — the card author
 * supplies it directly, the same way every other card's own faction is
 * authored, not derived. */
export interface TokenSpec {
  name: string;
  faction: Faction;
  attack: number;
  health: number;
  keywords: Keyword[];
  art: string;
  flavor: string;
}

export type TriggerKind =
  | "onPlay"
  | "onAttack"
  | "onDamaged"
  | "onDeath"
  | "onTurnStart"
  | "onTurnEnd"
  /** Fires on a unit when a unit it destroyed leaves the board: its damage
   * (combat or effect) was the hit that took the victim to 0, or its
   * effect destroyed it. Fires after the victim's own onDeath, and only if
   * the killer is still on the board. First user: the Neutral signature
   * menu's Hunter (data/signatureMenu.ts). */
  | "onKill"
  /** Fires on each of a player's units when the OPPONENT declares an
   * attack against that player or any of their units, right after the
   * attack goes on the stack (so a redirectAttack effect can move it).
   * First user: the signature menu's Bulwark, with `limit: "oncePerTurn"`. */
  | "onEnemyAttack"
  /** Always-on continuous modifier recomputed on every state change; has no
   * `effects` timeline, only a `staticEffect` payload. */
  | "static"
  /** Player-activated during their main phase, may have a cost. */
  | "activated";

export type StaticEffectSpec =
  /** `excludeSelf`: the source unit doesn't buff itself ("your OTHER
   * units"). */
  | { kind: "buffAllies"; attack: number; health: number; filter: TargetFilter; excludeSelf?: boolean }
  /** Overrides the source unit's own attack/health with a live-computed
   * value every time it's read, instead of adding a flat bonus. This is
   * the "stats mutate with board state" mechanic from design principle 1. */
  | { kind: "selfStatFromScaling"; attack?: ScalingAmount; health?: ScalingAmount }
  /** Modifies the energy cost of cards `side` plays (positive = costs more,
   * negative = a discount) — a taxing/blunting aura, not removal. See
   * Aegis's Tariff Field (data/aegisCards.ts) and
   * state/queries.ts's effectiveCardCost, the generic mechanism this
   * plugs into. `cardType`, when given, limits it to that card type (the
   * signature menu's Tax: "enemy Commands cost 1 more"). It never touches a
   * signature play's +2 replay surcharge, only the card's own cost. */
  | { kind: "cardCostModifier"; side: Side; amount: number; cardType?: CardType };

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
  /** "oncePerTurn": a unit's ability resolves at most once per turn (each
   * single player's turn counts; see UnitInstance.usedThisTurn). Checked in
   * effects/resolver.ts's resolveAbility for every trigger with a unit
   * source. Omit for no limit. */
  limit?: "oncePerTurn";
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
  /** Board-development system (2026-09-20 owner-feedback entry, Phase 2
   * item 5): "bases carry a small protection while unevolved." A base card
   * — one some *other* card's `evolvesFrom` points at, whether or not this
   * card is itself also an evolved form of something earlier (e.g. Aegis's
   * middle tier, Sentinel, is both AG-001's evolution *and* AG-013's own
   * base) — reduces every incoming point of damage against it by this flat
   * amount (floor 0; see effects/resolver.ts's applyDamage). This exists
   * specifically to protect the "answer it early while it's weak" exposure
   * window the 2026-09-13 checkpoint feedback built same-turn-evolve
   * restriction around: without it, a 1-2 health base sits fully targetable
   * for a whole turn boundary with no defence at all, so a throwaway 1-damage
   * ping (common at low cost across every faction) can snipe it before its
   * controller ever gets a real choice about evolving it. A *small*
   * protection, not durability: still not a Barrier-style full absorb (see
   * StatusKind), so a real removal/burn effect above the threshold still
   * gets through, just for less. Read directly off `unit.card` — no separate
   * per-instance state is needed, since evolving mutates the same instance's
   * `card` to the evolved form (engine.ts's evolveUnit), which has no
   * `baseArmor` of its own once it's past the tier this protects — the
   * moment a unit evolves, this protection ends automatically, which is
   * exactly "while unevolved." A first proposed value (1, applied to every
   * current base — see data/*.ts), not owner-confirmed; flagged as a
   * checkpoint decision per the entry's own instruction to propose the
   * mechanism rather than finalise it unilaterally. */
  baseArmor?: number;
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
