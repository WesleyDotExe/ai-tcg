import type { Card, Rarity } from "../cards/types.js";
import type { DeckSpec } from "../state/init.js";
import { CORTEX_CARDS, SWARM_CARDS } from "./cards.js";

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
  return { id, name, cards };
}

export function buildCortexDeck(id: DeckSpec["id"], name: string): DeckSpec {
  return buildDeck(id, name, CORTEX_CARDS);
}

export function buildSwarmDeck(id: DeckSpec["id"], name: string): DeckSpec {
  return buildDeck(id, name, SWARM_CARDS);
}
