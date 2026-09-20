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
}

export type GameEvent =
  | { type: "turnStart"; turn: number; player: PlayerId }
  | { type: "turnEnd"; turn: number; player: PlayerId }
  | { type: "draw"; player: PlayerId; card: string }
  | { type: "fatigue"; player: PlayerId; damage: number }
  | { type: "play"; player: PlayerId; card: string; instanceId?: string }
  | { type: "abilityTrigger"; source: string; ability: string; trigger: string }
  | { type: "damage"; target: string; targetKind: "unit" | "player"; amount: number; source: string }
  | { type: "heal"; target: string; targetKind: "unit" | "player"; amount: number; source: string }
  | { type: "buff"; target: string; attack: number; health: number; source: string }
  | { type: "statusApplied"; target: string; status: string; source: string }
  | { type: "barrierAbsorbed"; unit: string; source: string }
  | { type: "death"; unit: string; controller: PlayerId }
  | { type: "attack"; attacker: string; defender: string; defenderKind: "unit" | "player" }
  | { type: "gainEnergy"; player: PlayerId; amount: number; source: string }
  | { type: "cast"; player: PlayerId; card: string; speed: Speed }
  | { type: "priorityPass"; player: PlayerId }
  | { type: "stackResolve"; description: string }
  | { type: "fizzle"; reason: string }
  | { type: "telegraphPlaced"; unit: string; armIn: number }
  | { type: "telegraphArmed"; unit: string }
  | { type: "evolve"; player: PlayerId; from: string; to: string }
  | { type: "toolAttached"; player: PlayerId; tool: string; unit: string }
  | { type: "attackRedirected"; source: string; attacker: string; from: string; to: string }
  | { type: "directiveDestroyed"; directive: string; controller: PlayerId; source: string }
  | { type: "gameOver"; winner: PlayerId | "draw"; reason: string };

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
}

export function otherPlayer(id: PlayerId): PlayerId {
  return id === "p1" ? "p2" : "p1";
}
