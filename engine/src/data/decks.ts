import type { Card, Rarity } from "../cards/types.js";
import type { DeckSpec } from "../state/init.js";
import { CORTEX_CARDS, SWARM_CARDS } from "./cards.js";
import { AEGIS_CARDS } from "./aegisCards.js";

/** Copy-limit rule: a small cap on how many copies of one card a deck may
 * run, tighter at higher rarity. This is deck-construction, not just a
 * convention — buildDeck() enforces it and throws on violation, so a
 * miswritten card pool (or a future deck-builder UI) can't silently exceed
 * it. Full deck-construction UX (owned-card pools, size limits) is stage 5
 * work; this is the rule itself, real from day one. */
const COPY_LIMITS: Record<Rarity, number> = {
  Common: 3,
  Uncommon: 3,
  Rare: 2,
  Mythic: 1,
};

/** Deck-size rule (new for stage 3 — this was named debt in
 * progress/quality-debt.md: "no minimum/maximum deck size rule"). A
 * genuine, enforced floor and ceiling, not just the copy limit. Chosen
 * conservatively so the existing Cortex (32 cards) and Swarm (23 cards)
 * *test* pools — never meant to be tightly tuned decks, see data/cards.ts's
 * own header comment — still build without churning their tested card
 * lists; the freshly-designed Aegis deck (34 cards) sits comfortably
 * inside the range too. These numbers are a first proposal, not a
 * playtested target — flagged as an open parameter at the stage-3
 * checkpoint alongside BOARD_SLOTS. */
const MIN_DECK_SIZE = 20;
const MAX_DECK_SIZE = 40;

export function buildDeck(id: DeckSpec["id"], name: string, pool: { card: Card; copies: number }[]): DeckSpec {
  const cards: Card[] = [];
  for (const { card, copies } of pool) {
    const limit = COPY_LIMITS[card.rarity];
    if (copies > limit) {
      throw new Error(
        `Deck ${name}: ${copies} copies of "${card.name}" exceeds the ${limit}-copy limit for ${card.rarity} cards`,
      );
    }
    for (let i = 0; i < copies; i++) cards.push(card);
  }
  if (cards.length < MIN_DECK_SIZE || cards.length > MAX_DECK_SIZE) {
    throw new Error(
      `Deck ${name}: ${cards.length} cards is outside the legal deck size range [${MIN_DECK_SIZE}, ${MAX_DECK_SIZE}]`,
    );
  }
  return { id, name, cards };
}

export function buildCortexDeck(id: DeckSpec["id"], name: string): DeckSpec {
  return buildDeck(id, name, CORTEX_CARDS);
}

export function buildSwarmDeck(id: DeckSpec["id"], name: string): DeckSpec {
  return buildDeck(id, name, SWARM_CARDS);
}

export function buildAegisDeck(id: DeckSpec["id"], name: string): DeckSpec {
  return buildDeck(id, name, AEGIS_CARDS);
}
