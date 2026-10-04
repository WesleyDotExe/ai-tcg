import type { Card, DeckFaction } from "../cards/types.js";
import { CORTEX_CARDS, SWARM_CARDS } from "./cards.js";
import { AEGIS_CARDS } from "./aegisCards.js";
import { NULL_CARDS } from "./nullCards.js";
import { NEUTRAL_POOL } from "./neutralCards.js";

/** Every card a player can own today, by card id: the four shipped faction
 * pools plus the neutral pool. This is what the economy (`@ai-tcg/economy`)
 * checks a card id against before it records an owned copy, so a typo or a
 * trimmed card can't enter a collection. Cards cut from the pools (trimmed
 * in Phase 5) are not here on purpose: they can't be owned until a set puts
 * them back. */
export const CARD_REGISTRY: ReadonlyMap<string, Card> = (() => {
  const map = new Map<string, Card>();
  const all: Card[] = [
    ...CORTEX_CARDS.map((p) => p.card),
    ...SWARM_CARDS.map((p) => p.card),
    ...AEGIS_CARDS.map((p) => p.card),
    ...NULL_CARDS.map((p) => p.card),
    ...NEUTRAL_POOL,
  ];
  for (const card of all) {
    const existing = map.get(card.id);
    if (existing && existing !== card) throw new Error(`card registry: two different cards share the id "${card.id}"`);
    map.set(card.id, card);
  }
  return map;
})();

/** The shipped deck list for each faction, as card ids and copy counts.
 * These are the four decks the ring regression check measures. */
export const SHIPPED_DECK_LISTS: Readonly<Record<DeckFaction, readonly { cardId: string; copies: number }[]>> = {
  Cortex: CORTEX_CARDS.map((p) => ({ cardId: p.card.id, copies: p.copies })),
  Swarm: SWARM_CARDS.map((p) => ({ cardId: p.card.id, copies: p.copies })),
  Aegis: AEGIS_CARDS.map((p) => ({ cardId: p.card.id, copies: p.copies })),
  Null: NULL_CARDS.map((p) => ({ cardId: p.card.id, copies: p.copies })),
};

export function getCard(id: string): Card | undefined {
  return CARD_REGISTRY.get(id);
}


