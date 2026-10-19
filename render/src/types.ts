import type { GameEvent, PlayerId, StackItem } from "@ai-tcg/engine";
import type { FeedEntry } from "./feed.js";
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
  /** Printed (card) cost, for the cost circle. Cost modifiers on the board
   * and a signature card's replay surcharge aren't in it: what a play cost
   * is shown where it happens (the hand, the signature zone). */
  printedCost: number;
  /** This-turn-only buff totals (engine UnitInstance.turnBuff) — what lets
   * render/src/statFx.ts tell a temporary buff wearing off at end of turn
   * apart from a real penalty landing. */
  turnBuff: { attack: number; health: number };
  tools: { name: string; attackBonus: number; healthBonus: number; grantedKeywords: Keyword[] }[];
  statuses: { kind: string; duration: number | "untilConsumed" }[];
  visualSeed: number;
  visualPattern: number;
  /** True for the controller's signature card (engine
   * UnitInstance.signature): when it dies it goes back to the signature
   * zone, not the graveyard. Absent on every other unit. */
  isSignature?: true;
}

/** The signature zone (engine SignatureZone), as a spectator sees it. It is
 * public information in the engine too: both players always know the
 * card, whether it waits in the zone, and what playing it again costs. */
export interface SignatureSnapshot {
  cardId: string;
  name: string;
  faction: Faction;
  rarity: Rarity;
  flavor: string;
  /** Printed body. A signature card carries no tools or buffs while it
   * waits, so the printed stats are what arrives. */
  attack: number;
  health: number;
  keywords: Keyword[];
  /** The card's abilities, in rules text. */
  text: string[];
  /** What playing it now (or once it is back) costs: the engine's own
   * signatureCost, base plus the replay surcharge per earlier play. */
  nextCost: number;
  /** Its printed cost, so the page can show the climb. */
  baseCost: number;
  timesPlayed: number;
  /** True while it waits in the zone; false while it is on the board. */
  inZone: boolean;
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
  /** Printed (card) cost, for the cost circle. */
  printedCost: number;
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
  /** The signature zone, or absent/null when this player has none. */
  signature?: SignatureSnapshot | null;
  /** Fixed-slot layout (render/src/slotLayout.ts): which board card sits in
   * each of the `slotsMax` slots, by instanceId, or null for an empty slot.
   * A card keeps its slot from the move it enters until the move it leaves.
   * Filled in by captureMatch after the match is played. */
  slots?: (string | null)[];
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
  /** The spectator feed's entries for this move (render/src/feed.ts):
   * names, no priority passes, attacks folded with their damage. Filled in
   * by captureMatch after the match is played; the page falls back to
   * newEvents' raw text when it is absent. */
  feed?: FeedEntry[];
  /** Indices into newEvents of the abilityTrigger events the feed dropped
   * because they changed nothing (render/src/feed.ts buildFeedWithQuiet).
   * The board's cast flourish skips them too (castFx.ts). Filled in with
   * the feed; absent means none are skipped. */
  quietTriggers?: number[];
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

/** The boast the match record says played (the economy store's
 * `MatchBoast`, with the winning agent turned into its seat). The store
 * chose it as the match ended; the replay only plays it. */
export interface ReplayBoast {
  side: PlayerId;
  itemId: string;
  slot: "boast" | "closeWinBoast" | "factionStarter";
  winnerHealth: number | null;
}

/** What a replay takes from the economy store's match record (schema v11):
 * the record it plays, each seat's loadout at match time (item ids by
 * slot, null for an empty slot) and the boast that played. */
export interface ReplayRecord {
  matchId: string;
  loadouts: Record<PlayerId, Record<string, string | null>> | null;
  boast: ReplayBoast | null;
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
  /** The engine's energy cap (MAX_ENERGY_CAP): the signature zone uses it
   * to say whether the next refill puts the card within reach. Absent on
   * replays captured before the zone was drawn (the page assumes 10). */
  energyCap?: number;
  frames: Frame[];
  /** The economy store's record of this match, when it was played through
   * the store (render/src/recordedMatch.ts). Absent on the sample replays
   * and on any match recorded before the store kept loadouts: those play
   * the winner's faction starter boast. */
  record?: ReplayRecord;
}
