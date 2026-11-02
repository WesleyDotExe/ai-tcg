import type { Ability, Card, CommandCard, DirectiveCard, Speed, StatusEffect, ToolCard, UnitCard } from "../cards/types.js";
// These are type-only imports from modules that themselves only import
// *types* from this file (see effects/targeting.ts, effects/resolver.ts) —
// there is no runtime cycle, only a type-level one, which `import type`
// erases at compile time.
import type { TargetRef } from "../effects/targeting.js";
import type { AbilitySource } from "../effects/resolver.js";

export type PlayerId = "p1" | "p2";

export interface UnitInstance {
  instanceId: string;
  card: UnitCard;
  controller: PlayerId;
  /** Accumulated permanent stat buffs (from "buff" effects with
   * duration:"permanent"). Current attack/health are always *derived* — see
   * state/queries.ts — never stored directly, so static auras and
   * scaling stats can never go stale. */
  permanentBuff: { attack: number; health: number };
  /** Buffs granted this turn that expire when the current turn ends. */
  turnBuff: { attack: number; health: number };
  /** Damage accumulated; current health = derived max health - this. */
  damageTaken: number;
  statuses: StatusEffect[];
  /** Turn number this unit entered play, used for summoning sickness unless
   * it has Rush. */
  enteredTurn: number;
  hasAttackedThisTurn: boolean;
  /** Board-development system. `pending` is set while a telegraphed threat
   * (UnitCard.telegraph) is still "arming": true from the moment it's
   * played until `armTurn` is reached, at which point engine.ts's
   * processTelegraphArming clears it and fires the card's onPlay ability.
   * A pending unit is still a fully real, targetable board occupant — it
   * just can't attack, activate abilities, or project static auras yet
   * (see moves.ts/statics.ts). Absent entirely for non-telegraphed units. */
  pending?: boolean;
  armTurn?: number;
  /** The target the controller chose, at play time, for this unit's
   * deferred arm-time onPlay ability (only meaningful when that ability's
   * targeting scope is "chosen" — see UnitCard.telegraph and engine.ts's
   * processTelegraphArming). Telegraph arming happens automatically at a
   * later turn boundary with no agent decision point of its own, so a
   * "chosen" target has to be captured now, when the card is played, and
   * replayed later — the general fix for the "triggered abilities can't
   * use chosen targeting" architectural gap (progress/quality-debt.md,
   * 2026-09-19 owner feedback). If the chosen target is no longer on the
   * board by arm time, the effect no-ops harmlessly, same as any other
   * effect whose target has already vanished. */
  armChosenTarget?: TargetRef;
  /** Tool cards attached to this unit (see ToolCard) — always present,
   * empty for a unit with nothing attached. Their stat bonuses/granted
   * keywords are read live by state/queries.ts, and they travel with the
   * unit across an evolution (see engine.ts's evolveUnit) since evolution
   * mutates this same instance rather than replacing it. */
  tools: ToolCard[];
  /** True for the controller's signature card (see SignatureZone). When
   * it dies it goes back to the signature zone, not the graveyard. Absent
   * for every other unit. */
  signature?: true;
  /** The instance id of whatever dealt the hit that took this unit from
   * alive to dead (or destroyed it). Read by processDeaths to fire the
   * killer's onKill. Absent until then. */
  lethalBy?: string;
  /** Ids of this unit's `limit: "oncePerTurn"` abilities that have already
   * resolved this turn. Cleared for every unit when any turn ends. */
  usedThisTurn?: string[];
}

/** The signature zone (owner 2026-10-05, "the unique Mythic"; built
 * session 31). One Unit card per player that takes no deck slot: it starts
 * the match here, is never drawn, discarded or shuffled, and can be played
 * from here at Sorcery timing whenever its controller can afford it. When it
 * dies it comes back here instead of going to the graveyard, and every
 * replay that match costs SIGNATURE_REPLAY_SURCHARGE more than the last
 * (see state/queries.ts's signatureCost). Public information, like the
 * board: both players always know the card, whether it's waiting, and how
 * many times it has been played. */
export interface SignatureZone {
  card: UnitCard;
  /** How many times it has been played this match. */
  timesPlayed: number;
  /** True while it waits in the zone; false while it is on the board. */
  inZone: boolean;
}

export interface DirectiveInstance {
  instanceId: string;
  card: DirectiveCard;
  controller: PlayerId;
}

/** A spell or ability waiting to resolve, in Magic-style last-in-first-out
 * order (see GameState.stack). Units and Directives never appear here —
 * they resolve immediately when played (see engine/engine.ts) — this is
 * for Commands, activated abilities, and pending combat damage, the three
 * things a player can hold priority to respond to before they resolve. */
export type StackItem =
  | { kind: "command"; instanceId: string; controller: PlayerId; card: CommandCard; chosen?: TargetRef }
  | { kind: "ability"; instanceId: string; controller: PlayerId; ability: Ability; source: AbilitySource; chosen?: TargetRef }
  | {
      kind: "combatDamage";
      instanceId: string;
      controller: PlayerId;
      attackerInstanceId: string;
      /** Display-only snapshot for the log; the actual damage math is
       * always recomputed live at resolution time (see resolveCombatDamage)
       * so a response that buffs/kills either side before it resolves
       * genuinely changes the outcome, not just the flavour text. */
      attackerName: string;
      target: TargetRef;
    };

export interface PlayerState {
  id: PlayerId;
  name: string;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  hand: Card[];
  deck: Card[];
  board: UnitInstance[];
  directives: DirectiveInstance[];
  graveyard: Card[];
  /** The signature zone, or null when this player has no signature card. */
  signature: SignatureZone | null;
}

/**
 * Identity fields (owner-feedback 2026-10-03, balance lane item b; built
 * session 27). Every event that names a card on the board also says WHICH
 * one, by instance id, so a spectator client can make a spell or ability
 * travel to its exact target and pair each hit with the card that caused
 * it, even with two copies of the same card in play. The names stay
 * (formatEvent prints them, and the committed match logs read the same);
 * the ids sit alongside them.
 *
 * - `sourceId`: the instance id of whatever caused the event. A unit or
 *   Directive is its board instance id; a Command is its stack id (`c..`,
 *   the same id its `cast` event carries); an onDeath ability is the dead
 *   unit's old instance id (the matching `death` event carries it too).
 *   Absent only when no card caused it: Overload's end-of-turn damage
 *   comes from a status, not a card.
 * - `targetRef` / `defenderRef` / `fromRef` / `toRef`: a full TargetRef
 *   (unit, Directive or player), so a hit on a player's face is as exact as
 *   a hit on a unit.
 * - `stackId`: the id of the stack item an event opens or closes, pairing
 *   `cast` and `attack` with their later `stackResolve`.
 *
 * They are optional in the type so event fixtures written before ids
 * existed (render tests build frames by hand) stay valid, but the engine
 * always fills them: engine/test/eventIds.test.ts plays real matches for
 * every faction pairing and fails if any id is missing or names the wrong
 * card.
 */
export type GameEvent =
  | { type: "turnStart"; turn: number; player: PlayerId }
  | { type: "turnEnd"; turn: number; player: PlayerId }
  | { type: "draw"; player: PlayerId; card: string }
  | { type: "fatigue"; player: PlayerId; damage: number }
  | {
      type: "play";
      player: PlayerId;
      card: string;
      instanceId?: string;
      /** Set when the card came from the signature zone, not the hand. */
      fromSignatureZone?: true;
      /** What it cost, for a signature play (the base cost plus the replay
       * surcharge), so the log and a spectator can show the climb. */
      cost?: number;
      /** A modal card's chosen mode: its id and printed name (session 40).
       * Absent for every other card. */
      mode?: string;
      modeName?: string;
    }
  | {
      type: "abilityTrigger";
      source: string;
      ability: string;
      trigger: string;
      sourceId?: string;
      /** Everything the ability resolved against, in resolution order,
       * before any effect applied. Empty for an untargeted ability (draw,
       * gain energy, summon). This is where a spell's travel aims, even
       * when the effect then does nothing (a hit fully eaten by armor). */
      targets?: TargetRef[];
    }
  | { type: "damage"; target: string; targetKind: "unit" | "player"; amount: number; source: string; sourceId?: string; targetRef?: TargetRef }
  | { type: "heal"; target: string; targetKind: "unit" | "player"; amount: number; source: string; sourceId?: string; targetRef?: TargetRef }
  | { type: "buff"; target: string; attack: number; health: number; source: string; sourceId?: string; targetId?: string }
  | { type: "statusApplied"; target: string; status: string; source: string; sourceId?: string; targetId?: string }
  | { type: "barrierAbsorbed"; unit: string; source: string; sourceId?: string; unitId?: string }
  | { type: "death"; unit: string; controller: PlayerId; instanceId?: string }
  /** A signature card that died goes back to its zone (it follows its own
   * `death` event). `nextCost` is what playing it again would cost now. */
  | { type: "signatureReturn"; player: PlayerId; card: string; instanceId?: string; nextCost: number }
  | {
      type: "attack";
      attacker: string;
      defender: string;
      defenderKind: "unit" | "player";
      attackerId?: string;
      defenderRef?: TargetRef;
      stackId?: string;
    }
  | { type: "gainEnergy"; player: PlayerId; amount: number; source: string; sourceId?: string }
  | {
      type: "cast";
      player: PlayerId;
      card: string;
      speed: Speed;
      stackId?: string;
      /** An activated ability's board source; absent for a Command, whose
       * own identity is its stackId. */
      sourceId?: string;
      /** The target chosen at cast time, if the spell or ability has one.
       * It can still fizzle or change before the stack item resolves. */
      targetRef?: TargetRef;
      /** A modal Command's chosen mode, as on `play`. */
      mode?: string;
      modeName?: string;
    }
  | { type: "priorityPass"; player: PlayerId }
  | { type: "stackResolve"; description: string; stackId?: string }
  | {
      type: "fizzle";
      /** Readable text for the raw log. Readers that word it themselves
       * (the spectator feed, commentary) use the fields below. */
      reason: string;
      /** Why it fizzled, as data. An attack's fizzle (session 38): its
       * attacker, or its unit target, left play before it resolved. An
       * attack redirect's fizzle (Intercept Routine, session 39): the attack
       * was already aimed at the chosen unit, or no attack was pending.
       * Absent on other fizzles (an ability with nothing to do) and in logs
       * written before those sessions. */
      cause?: "attackerGone" | "targetGone" | "alreadyAimed" | "noPendingAttack";
      /** The attack's attacker (every cause but `noPendingAttack`). */
      attacker?: string;
      attackerId?: string;
      /** A redirect's fizzle: the card whose redirect did nothing. */
      source?: string;
      sourceId?: string;
      /** `alreadyAimed`: the unit the attack was, and stays, aimed at. */
      target?: string;
      targetRef?: TargetRef;
    }
  | { type: "telegraphPlaced"; unit: string; armIn: number; instanceId?: string }
  | { type: "telegraphArmed"; unit: string; instanceId?: string }
  | { type: "evolve"; player: PlayerId; from: string; to: string; instanceId?: string; mode?: string; modeName?: string }
  | { type: "toolAttached"; player: PlayerId; tool: string; unit: string; unitId?: string }
  | {
      type: "attackRedirected";
      source: string;
      attacker: string;
      from: string;
      to: string;
      sourceId?: string;
      attackerId?: string;
      fromRef?: TargetRef;
      toRef?: TargetRef;
    }
  | { type: "directiveDestroyed"; directive: string; controller: PlayerId; source: string; sourceId?: string; instanceId?: string }
  | { type: "summon"; player: PlayerId; token: string; instanceId: string; source: string; sourceId?: string }
  | { type: "summonFizzle"; player: PlayerId; token: string; source: string; sourceId?: string }
  | { type: "baseArmorReduced"; unit: string; source: string; rawAmount: number; reducedTo: number; sourceId?: string; unitId?: string }
  | {
      type: "gameOver";
      winner: PlayerId | "draw";
      /** Readable text for the raw log, naming seats ("p2's health reached
       * 0"). Readers that word it themselves use `cause`. */
      reason: string;
      /** Absent in logs written before session 38. */
      cause?: GameOverCause;
    };

/** What ended a match, as data (owner 2026-10-18: the feed and the
 * commentators word it, not a fixed sentence). `losers` is every player
 * whose health reached 0: both on a simultaneous lethal (a draw). */
export type GameOverCause = { kind: "healthDepleted"; losers: PlayerId[] } | { kind: "turnCap"; tied: boolean };

export interface GameState {
  turnNumber: number;
  activePlayer: PlayerId;
  players: Record<PlayerId, PlayerState>;
  log: GameEvent[];
  winner?: PlayerId | "draw";
  turnCap: number;
  /** Monotonic counter for unit/directive/stack-item instance ids. */
  nextInstanceId: number;
  /** Pending spells/abilities/combat damage, resolved last-in-first-out.
   * Public information — both players can always see it, same as Magic's
   * stack. */
  stack: StackItem[];
  /** Whoever currently holds priority: the player entitled to act next
   * (play an instant, activate an instant ability, or pass). Not the same
   * as `activePlayer` — the non-active player receives priority windows of
   * their own any time the active player passes, which is what makes
   * instant-speed responses possible. */
  priority: PlayerId;
  /** Consecutive priority passes with no action in between. Reaching 2
   * means both players passed in a row: the stack's top item resolves (if
   * any), or, if the stack is empty, the active player's turn ends. Reset
   * to 0 by any non-pass action. */
  passes: number;
  /** Seat-rule variants under measurement (session 68, the first-seat
   * fixes). Absent in every match the game ships: the rules as printed. Only
   * the measuring instruments set it, until the owner picks a fix. */
  rules?: MatchRules;
}

/** Test-only seat rules (owner 2026-11-02: "measure all four first-seat
 * fixes, test only ... no rule change ships without the owner's OK"). p1 is
 * always the first seat (match.ts), so "the second seat" is p2. Every field
 * left out is the rule as shipped. */
export interface MatchRules {
  /** (a) Cards the second seat draws into its opening hand on top of the
   * usual four. */
  secondSeatExtraOpeningCards?: number;
  /** (b) Energy the second seat gets on its first turn only (this turn's
   * pool, not its maximum). */
  secondSeatFirstTurnEnergy?: number;
  /** (c) Health the second seat starts with on top of the usual 20 (its
   * maximum too). */
  secondSeatExtraHealth?: number;
  /** (d) The first seat can't attack on its first turn. */
  firstSeatNoFirstTurnAttack?: boolean;
}

/** True when `rules` changes nothing (absent, or every field at the shipped
 * value), so a match keeps no `rules` field and plays byte-identically. */
export function isShippedRules(rules: MatchRules | undefined): boolean {
  return (
    !rules ||
    (!rules.secondSeatExtraOpeningCards && !rules.secondSeatFirstTurnEnergy && !rules.secondSeatExtraHealth && !rules.firstSeatNoFirstTurnAttack)
  );
}

export function otherPlayer(id: PlayerId): PlayerId {
  return id === "p1" ? "p2" : "p1";
}
