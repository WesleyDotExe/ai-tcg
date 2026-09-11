import type { Card } from "../cards/types.js";
import type { GameState, PlayerId, PlayerState } from "./types.js";
import type { Rng } from "./rng.js";

const STARTING_HEALTH = 20;
const MAX_ENERGY_CAP = 10;
const OPENING_HAND_SIZE = 4;
const TURN_CAP = 40;

export { MAX_ENERGY_CAP, STARTING_HEALTH, TURN_CAP };

export interface DeckSpec {
  id: PlayerId;
  name: string;
  /** Deck list as a flat list of cards, one entry per copy (copy-limit
   * enforcement happens at deck-construction time — see decks.ts). */
  cards: Card[];
}

function freshPlayerState(spec: DeckSpec, rng: Rng): PlayerState {
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
  };
}

export function createInitialState(deckA: DeckSpec, deckB: DeckSpec, rng: Rng): GameState {
  const p1 = freshPlayerState(deckA, rng);
  const p2 = freshPlayerState(deckB, rng);
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
  };
}
