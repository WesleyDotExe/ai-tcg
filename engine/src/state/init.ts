import type { Card, UnitCard } from "../cards/types.js";
import { isShippedRules, secondSeatExtraHealth, type GameState, type MatchRules, type PlayerId, type PlayerState } from "./types.js";
import type { Rng } from "./rng.js";

const STARTING_HEALTH = 20;
const MAX_ENERGY_CAP = 10;
const OPENING_HAND_SIZE = 4;
const TURN_CAP = 40;
/** Board-development system (owner design-directive batch, 2026-09-12):
 * the finite number of face-up board slots each player has. Units and
 * Directives share this one pool per player — both are "meaningful
 * commitments to the board" per the design note, so both compete for the
 * same scarce space. Evolving a unit or attaching a Tool never consumes an
 * additional slot (see moves.ts/engine.ts). 6 is a first proposed number,
 * not a playtested one — flagged as an open parameter at the stage-3
 * checkpoint for the owner to weigh in on. */
const BOARD_SLOTS = 6;

/** How much more each replay of a signature card costs than the play before
 * it, within one match (owner 2026-10-05, the unique Mythic: "costs 2 more
 * each time it is played again"). */
const SIGNATURE_REPLAY_SURCHARGE = 2;

export { MAX_ENERGY_CAP, STARTING_HEALTH, TURN_CAP, BOARD_SLOTS, SIGNATURE_REPLAY_SURCHARGE };

export interface DeckSpec {
  id: PlayerId;
  name: string;
  /** Deck list as a flat list of cards, one entry per copy (copy-limit
   * enforcement happens at deck-construction time — see decks.ts). */
  cards: Card[];
  /** The signature card: outside `cards`, outside the copy limits and the
   * deck size, and never shuffled into the deck (see SignatureZone). */
  signature?: UnitCard;
}

function freshPlayerState(spec: DeckSpec, rng: Rng): PlayerState {
  if (spec.signature && spec.signature.type !== "Unit") {
    throw new Error(`${spec.name}: a signature card must be a Unit, not a ${(spec.signature as Card).type}`);
  }
  if (spec.signature?.modes) {
    // The signature zone plays its card as printed (no mode on playSignature).
    throw new Error(`${spec.name}: a signature card can't be modal (${spec.signature.name})`);
  }
  if (spec.signature?.evolvesFrom) {
    throw new Error(`${spec.name}: a signature card can't be an evolution (${spec.signature.name} evolves from ${spec.signature.evolvesFrom})`);
  }
  const deck = rng.shuffle(spec.cards);
  const hand: Card[] = [];
  for (let i = 0; i < OPENING_HAND_SIZE; i++) {
    const card = deck.shift();
    if (card) hand.push(card);
  }
  return {
    id: spec.id,
    name: spec.name,
    health: STARTING_HEALTH,
    maxHealth: STARTING_HEALTH,
    energy: 0,
    maxEnergy: 0,
    hand,
    deck,
    board: [],
    directives: [],
    graveyard: [],
    signature: spec.signature ? { card: spec.signature, timesPlayed: 0, inZone: true } : null,
  };
}

export function createInitialState(deckA: DeckSpec, deckB: DeckSpec, rng: Rng, rules?: MatchRules): GameState {
  const p1 = freshPlayerState(deckA, rng);
  const p2 = freshPlayerState(deckB, rng);
  // The second seat's extra health (rules-2: 24 against 20; types.ts
  // MatchRules). It takes nothing from the RNG, so both decks shuffle exactly
  // as under any other rules version on the same seed.
  const extra = secondSeatExtraHealth(rules);
  p2.health += extra;
  p2.maxHealth += extra;
  return {
    turnNumber: 0,
    activePlayer: "p1",
    players: { p1, p2 },
    log: [],
    turnCap: TURN_CAP,
    nextInstanceId: 1,
    stack: [],
    priority: "p1",
    passes: 0,
    ...(isShippedRules(rules) ? {} : { rules: { ...rules } }),
  };
}
