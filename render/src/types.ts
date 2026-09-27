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
  /** Board-development system's flat per-hit damage reduction (base cards
   * only, see engine/src/cards/types.ts's UnitCard.baseArmor) — 0 when the
   * unit carries none. Drives the render's "deflect" flourish (EFFECTS.md
   * slice 1); read straight off the card like the engine itself does, so it
   * disappears the instant a unit evolves past it, same as the mechanic. */
  baseArmor: number;
  /** Whether this unit currently holds an unconsumed Barrier status — NOT
   * the same as `keywords.includes("Barrier")`, which only says the card
   * *grants* Barrier when played and stays true even after it's been
   * consumed. This is the live, per-frame signal EFFECTS.md slice 1's
   * interpose/absorb/shatter animation and shield badge key off. */
  barrierActive: boolean;
  /** Printed (card) attack/health — the live stats above are compared
   * against these to show a persistent above/below-printed marker on the
   * stat numbers (EFFECTS.md slice 2: the rise/sink animation says "it just
   * changed", the marker keeps saying "it is still changed"). */
  printedAttack: number;
  printedHealth: number;
  /** This-turn-only buff totals (engine UnitInstance.turnBuff) — what lets
   * render/src/statFx.ts tell a temporary buff wearing off at end of turn
   * apart from a real penalty landing. */
  turnBuff: { attack: number; health: number };
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

/** Where a pending attack is aimed — a unit (exact instance) or a player.
 * Mirrors the engine's TargetRef minus its "directive" variant, which an
 * attack can never carry (getLegalMoves never offers a Directive as an
 * attack target). */
export type AttackTargetSnapshot = { kind: "unit"; instanceId: string } | { kind: "player"; playerId: PlayerId };

export interface StackItemSnapshot {
  kind: StackItem["kind"];
  /** The engine's own stack-item instance id (StackItem.instanceId). Lets
   * the render follow ONE item across frames: see it pushed, see its target
   * change (a redirect), and see it leave (it resolved — nothing else ever
   * pops the engine's stack). */
  stackId: string;
  description: string;
  controller: PlayerId;
  /** For a combatDamage item: the exact attacking instance and its current
   * target (engine StackItem.attackerInstanceId / .target, read-only). The
   * event log's `attack` event names both by card NAME only; these are what
   * let attack travel (EFFECTS.md slice 4) fly from the right card to the
   * right card, mirror matches included. */
  attackerInstanceId?: string;
  target?: AttackTargetSnapshot;
  /** For an activated-ability item: the exact instance whose ability it is
   * (engine StackItem.source.instanceId, read-only). The event log names
   * the source by card name only; this is what lets the cast flourish
   * (EFFECTS.md slice 3) land on the right copy when two share a board. */
  sourceInstanceId?: string;
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

/** Render-side player identity (owner-feedback 2026-09-26): each AI player
 * gets a username AND a profile/avatar image, so spectators and commentators
 * can tell the two apart at a glance. `avatarUrl` is the drop-in slot for a
 * real image (the platform/onboarding stage's account model will supply
 * one); until then `avatarSvg` is a deterministic username-seeded
 * placeholder from render/src/avatar.ts. Render-only data — the engine
 * knows nothing about avatars. */
export interface PlayerIdentity {
  username: string;
  avatarUrl?: string;
  avatarSvg: string;
}

export interface MatchReplay {
  title: string;
  seed: number;
  agentNames: Record<PlayerId, string>;
  identities: Record<PlayerId, PlayerIdentity>;
  /** Card/token name -> faction, for every card either deck contains and
   * every token that appeared on board. Lets the replay tint a buff/penalty
   * by its SOURCE card's faction when the event log names it (EFFECTS.md
   * axis 2). A name->faction lookup is unambiguous even in a mirror match —
   * it never has to say which instance, only which faction. */
  cardFactions: Record<string, Faction>;
  /** Card/token name -> rarity, same coverage as cardFactions. Sizes a
   * Command's cast flourish (EFFECTS.md slice 3) — a Command never sits on
   * the board, so there is no unit snapshot to read its rarity from. */
  cardRarities: Record<string, Rarity>;
  factions: Record<PlayerId, Faction>;
  movesPlayed: number;
  turnCap: number;
  frames: Frame[];
}
