import type { Card, DirectiveCard, StatusEffect, UnitCard } from "../cards/types.js";

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
}

export interface DirectiveInstance {
  instanceId: string;
  card: DirectiveCard;
  controller: PlayerId;
}

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
  | { type: "gameOver"; winner: PlayerId | "draw"; reason: string };

export interface GameState {
  turnNumber: number;
  activePlayer: PlayerId;
  players: Record<PlayerId, PlayerState>;
  log: GameEvent[];
  winner?: PlayerId | "draw";
  turnCap: number;
  /** Monotonic counter for unit/directive instance ids. */
  nextInstanceId: number;
}

export function otherPlayer(id: PlayerId): PlayerId {
  return id === "p1" ? "p2" : "p1";
}
