import type { Card, DeckFaction, Rarity } from "../cards/types.js";
import type { DeckSpec } from "../state/init.js";
import { lintCardPool, neutralCardViolations } from "../cards/poolLint.js";
import { NEUTRAL_POOL } from "./neutralCards.js";
import { CORTEX_CARDS, SWARM_CARDS } from "./cards.js";
import { AEGIS_CARDS } from "./aegisCards.js";
import { NULL_CARDS } from "./nullCards.js";

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

/** Neutral share cap (Phase 5 item 10, "faction cards carry identity;
 * neutral cards carry utility"): at most a quarter of a full 40-card deck
 * may come from the neutral pool, so every deck is at least three-quarters
 * its own faction. A first proposal, flagged to the owner. */
export const MAX_NEUTRAL_COPIES = 10;

// The neutral pool is checked once at load, card by card, so a bad neutral
// card fails the whole engine at import rather than only the decks that run
// it.
{
  const bad = NEUTRAL_POOL.flatMap(neutralCardViolations);
  if (bad.length > 0) throw new Error(`Neutral pool lint failed:\n  - ${bad.join("\n  - ")}`);
}

/** The one faction a deck is built around: its only non-Neutral faction.
 * Throws for a deck with none (all neutral) or with two. */
export function deckFaction(cards: readonly Card[]): DeckFaction {
  const factions = [...new Set(cards.map((c) => c.faction))].filter((f): f is DeckFaction => f !== "Neutral");
  if (factions.length !== 1) {
    throw new Error(
      factions.length === 0
        ? "a deck needs one faction; it cannot be built from neutral cards alone"
        : `a deck runs one faction plus neutral cards, not ${factions.join(" + ")}`,
    );
  }
  return factions[0]!;
}

export function buildDeck(id: DeckSpec["id"], name: string, pool: { card: Card; copies: number }[]): DeckSpec {
  // Hybrid-deck rule (Phase 5 item 10): one faction plus up to
  // MAX_NEUTRAL_COPIES neutral cards, each of which must pass the neutral
  // lint. A neutral card is identified by faction, and must also be the
  // pool's own object, so a deck can't smuggle in a "Neutral" card the pool
  // lint never saw.
  let faction: DeckFaction;
  try {
    faction = deckFaction(pool.map((p) => p.card));
  } catch (e) {
    throw new Error(`Deck ${name}: ${(e as Error).message}`);
  }
  const neutral = pool.filter((p) => p.card.faction === "Neutral");
  for (const { card } of neutral) {
    if (!NEUTRAL_POOL.includes(card)) throw new Error(`Deck ${name}: "${card.name}" is marked Neutral but is not in the neutral pool`);
  }
  const neutralCopies = neutral.reduce((n, p) => n + p.copies, 0);
  if (neutralCopies > MAX_NEUTRAL_COPIES) {
    throw new Error(`Deck ${name}: ${neutralCopies} neutral cards exceeds the ${MAX_NEUTRAL_COPIES}-card neutral cap`);
  }

  // Phase 3 (2026-09-20 owner-feedback entry): the card-pool lint, enforced
  // at load time exactly like the copy-limit/deck-size checks below — a
  // pool-construction rule violation fails to build a deck at all, not
  // something a future card author has to remember. See
  // cards/poolLint.ts for the four rules and their reasoning.
  lintCardPool(pool, faction);

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

export function buildNullDeck(id: DeckSpec["id"], name: string): DeckSpec {
  return buildDeck(id, name, NULL_CARDS);
}
