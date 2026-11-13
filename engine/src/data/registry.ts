import type { Card, DeckFaction } from "../cards/types.js";
import { CORTEX_BOOSTER_CARDS, CORTEX_CARDS, SWARM_BOOSTER_CARDS, SWARM_CARDS } from "./cards.js";
import { AEGIS_BOOSTER_CARDS, AEGIS_CARDS } from "./aegisCards.js";
import { NULL_BOOSTER_CARDS, NULL_CARDS } from "./nullCards.js";
import { NEUTRAL_POOL } from "./neutralCards.js";
import { ZERO_DAY_CARDS } from "./zeroDayCards.js";

/** Season 0's pack-only booster cards (owner 2026-11-14, option B; built
 * session 97): 7 per faction, in no starter deck. The economy's set numbers
 * them after the 96 starter-era cards (097 to 124) and, from S0-odds-3,
 * rolls only these in a pack's plain slots and every special version
 * (owner 2026-11-14: "starter cards are Standard only"). By faction. */
export const S0_BOOSTER_CARDS: Readonly<Record<DeckFaction, readonly Card[]>> = {
  Cortex: CORTEX_BOOSTER_CARDS,
  Swarm: SWARM_BOOSTER_CARDS,
  Aegis: AEGIS_BOOSTER_CARDS,
  Null: NULL_BOOSTER_CARDS,
};

/** The booster cards' ids, for "is this a booster card?". */
export const S0_BOOSTER_CARD_IDS: ReadonlySet<string> = new Set(Object.values(S0_BOOSTER_CARDS).flatMap((cs) => cs.map((c) => c.id)));

/** True for a Season 0 booster card (pack-only, never in a starter deck). */
export function isBoosterCard(id: string): boolean {
  return S0_BOOSTER_CARD_IDS.has(id);
}

/** Every card a player can own today, by card id: the four shipped faction
 * pools, the neutral pool, the 3 Zero-Day cards and (session 97) the 28
 * Season 0 booster cards (live since session 42,
 * owner 2026-10-18: "go live at the proposed numbers"). A Zero-Day card is a
 * secret card, not a base-set card: the economy's set leaves `topTier`
 * cards out of the base numbering and lists them at the top of the secret
 * cards (226/096 to 228/096), and only ever records them in the Zero-Day
 * finish. This is what the economy (`@ai-tcg/economy`)
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
    ...ZERO_DAY_CARDS,
    ...Object.values(S0_BOOSTER_CARDS).flat(),
  ];
  for (const card of all) {
    const existing = map.get(card.id);
    if (existing && existing !== card) throw new Error(`card registry: two different cards share the id "${card.id}"`);
    map.set(card.id, card);
  }
  return map;
})();

// A booster card is never in a starter deck (owner 2026-11-14: the four
// starter decks stay a separate, fixed product).
for (const f of Object.keys(S0_BOOSTER_CARDS) as DeckFaction[]) {
  for (const c of S0_BOOSTER_CARDS[f]) if (c.faction !== f) throw new Error(`booster card ${c.id} is listed under ${f} but is ${c.faction}`);
}

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

for (const [f, list] of Object.entries(SHIPPED_DECK_LISTS)) {
  const booster = list.find((e) => S0_BOOSTER_CARD_IDS.has(e.cardId));
  if (booster) throw new Error(`the ${f} starter deck holds booster card ${booster.cardId}`);
}
