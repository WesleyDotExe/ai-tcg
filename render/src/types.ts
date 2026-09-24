import type { GameEvent, PlayerId, StackItem } from "@ai-tcg/engine";
import type { Faction, Rarity, CardType, Keyword } from "./engineInternal.js";

/** A single face-up board occupant (Unit) as the render lane needs it —
 * already resolved to *live* stats (tools/static auras/permanent buffs
 * baked in), not the printed card values, since those are frequently wrong
 * to show directly (see engineInternal.ts). */
export interface UnitSnapshot {
  instanceId: string;
  cardId: string;
  name: string;
  faction: Faction;
  rarity: Rarity;
  flavor: string;
  attack: number;
  health: number;
  maxHealth: number;
  keywords: Keyword[];
  pending: boolean;
  armTurn?: number;
  isEvolved: boolean;
  canAttackThisTurn: boolean;
  tools: { name: string; attackBonus: number; healthBonus: number; grantedKeywords: Keyword[] }[];
  statuses: { kind: string; duration: number | "untilConsumed" }[];
  visualSeed: number;
  visualPattern: number;
}

export interface DirectiveSnapshot {
  instanceId: string;
  cardId: string;
  name: string;
  faction: Faction;
  rarity: Rarity;
  flavor: string;
  visualSeed: number;
  visualPattern: number;
}

export interface CardRef {
  cardId: string;
  name: string;
  faction: Faction;
  rarity: Rarity;
  type: CardType;
  cost: number;
  flavor: string;
  visualSeed: number;
  visualPattern: number;
}

export interface PlayerSnapshot {
  id: PlayerId;
  name: string;
  faction: Faction;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  hand: CardRef[];
  deckSize: number;
  graveyardSize: number;
  board: UnitSnapshot[];
  directives: DirectiveSnapshot[];
  slotsUsed: number;
  slotsMax: number;
}

export interface StackItemSnapshot {
  kind: StackItem["kind"];
  description: string;
  controller: PlayerId;
}

/** One step of the replay: the board state *after* one engine move was
 * applied, plus the events that move produced (formatted for display and
 * kept structured for anything that wants to key off event type). */
export interface MomentumReading {
  score: number;
  leader: PlayerId | "even";
  reasons: string[];
}

export interface Frame {
  index: number;
  turnNumber: number;
  activePlayer: PlayerId;
  priority: PlayerId;
  winner?: PlayerId | "draw";
  stack: StackItemSnapshot[];
  players: Record<PlayerId, PlayerSnapshot>;
  newEvents: { event: GameEvent; text: string }[];
  momentum: MomentumReading;
}

export interface MatchReplay {
  title: string;
  seed: number;
  agentNames: Record<PlayerId, string>;
  factions: Record<PlayerId, Faction>;
  movesPlayed: number;
  turnCap: number;
  frames: Frame[];
}
