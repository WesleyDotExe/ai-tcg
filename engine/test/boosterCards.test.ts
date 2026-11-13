// Season 0's booster cards, registered session 97 (owner 2026-11-14, option
// B; the list approved as proposed, progress/booster-proposal-s0.md): their
// shape, their place in the registry, the set-Mythic stand-in with two
// Mythics in a deck, and real matches with the deck builder's own decks
// from a starter collection plus booster cards.

import { describe, expect, it } from "vitest";
import { CARD_REGISTRY, S0_BOOSTER_CARDS, S0_BOOSTER_CARD_IDS, SHIPPED_DECK_LISTS, getCard, isBoosterCard } from "../src/data/registry.js";
import type { DeckFaction, Rarity } from "../src/cards/types.js";
import { buildDeck, withSetMythicSignature } from "../src/data/decks.js";
import { CARDS_1_BY_ID, cardDigest } from "../src/engine/versions.js";
import { DECK_FACTIONS, constructDeck, deckSpec, drawsCards, shippedList } from "../src/deckbuilder/deckBuilder.js";
import { isRemovalOrDebuffCard } from "../src/cards/poolLint.js";
import { COPY_LIMITS } from "../src/data/decks.js";
import { runMatch } from "../src/engine/match.js";
import { AggressiveAgent } from "../src/agents/aggressiveAgent.js";
import { RandomAgent } from "../src/agents/randomAgent.js";

const PREFIX: Record<DeckFaction, string> = { Cortex: "CX", Swarm: "SW", Aegis: "AG", Null: "NL" };

describe("the booster cards in the registry", () => {
  it("28 cards, 7 per faction: 2 Common, 2 Uncommon, 2 Rare, 1 Mythic, ids 101 to 107 of the faction's prefix", () => {
    expect(S0_BOOSTER_CARD_IDS.size).toBe(28);
    for (const f of DECK_FACTIONS) {
      const cards = S0_BOOSTER_CARDS[f];
      expect(cards.map((c) => c.id).sort(), f).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => `${PREFIX[f]}-10${n}`));
      expect(cards.every((c) => c.faction === f)).toBe(true);
      const split: Partial<Record<Rarity, number>> = {};
      for (const c of cards) split[c.rarity] = (split[c.rarity] ?? 0) + 1;
      expect(split, f).toEqual({ Common: 2, Uncommon: 2, Rare: 2, Mythic: 1 });
      for (const c of cards) expect(getCard(c.id)).toBe(c);
    }
  });

  it("are in no starter deck, and leave every cards-1 card as it was (cards-2 only adds)", () => {
    for (const f of DECK_FACTIONS) expect(SHIPPED_DECK_LISTS[f].some((e) => isBoosterCard(e.cardId)), f).toBe(false);
    expect(CARD_REGISTRY.size).toBe(CARDS_1_BY_ID.size + 28);
    for (const [id, card] of CARDS_1_BY_ID) expect(cardDigest(CARD_REGISTRY.get(id)!), id).toBe(cardDigest(card));
    // Names are new: no booster card shares a name with another card.
    const names = [...CARD_REGISTRY.values()].map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("the set-Mythic stand-in (withSetMythicSignature) with a booster Mythic in the deck", () => {
  it("stands in the starter Mythic, the one the starter deck was measured with, and keeps the booster Mythic in the deck", () => {
    for (const f of DECK_FACTIONS) {
      const boosterMythic = S0_BOOSTER_CARDS[f].find((c) => c.rarity === "Mythic")!;
      const pool = [...shippedList(f)].map(([id, copies]) => ({ card: getCard(id)!, copies }));
      // Out: one copy of the lowest-cost non-Mythic card of the same kind
      // (removal for removal, so the deck stays under the 25% removal cap;
      // never a card that draws, so it keeps its card flow), size held.
      const removal = isRemovalOrDebuffCard(boosterMythic);
      const cut = pool
        .filter((p) => p.card.rarity !== "Mythic" && p.copies > 1 && isRemovalOrDebuffCard(p.card) === removal && !drawsCards(p.card))
        .sort((a, b) => a.card.cost - b.card.cost || a.card.id.localeCompare(b.card.id))[0]!;
      cut.copies--;
      const spec = buildDeck("p1", `${f} + ${boosterMythic.name}`, [...pool, { card: boosterMythic, copies: 1 }]);
      const starterMythic = spec.cards.find((c) => c.rarity === "Mythic" && !isBoosterCard(c.id))!;
      const stood = withSetMythicSignature(spec);
      expect(stood.signature!.id, f).toBe(starterMythic.id);
      expect(stood.cards.some((c) => c.id === boosterMythic.id), f).toBe(true);
      expect(stood.cards.length).toBe(spec.cards.length - 1);
    }
  });
});

describe("the deck builder's decks with booster cards", () => {
  /** A starter collection plus a playable set of the faction's booster
   * cards (a few weeks of packs). */
  const holdings = (f: DeckFaction) => {
    const h = new Map(shippedList(f));
    for (const c of S0_BOOSTER_CARDS[f]) h.set(c.id, COPY_LIMITS[c.rarity]);
    return h;
  };

  it.each(DECK_FACTIONS)("%s: the builder's first deck takes booster cards, is legal, and its booster cards resolve in real matches", async (f) => {
    const built = constructDeck(f, holdings(f));
    if (!("list" in built)) throw new Error(built.infeasible);
    const inDeck = [...built.list.keys()].filter(isBoosterCard);
    expect(inDeck.length, `${f}: booster cards the builder took`).toBeGreaterThan(0);
    const names = new Set(inDeck.map((id) => getCard(id)!.name));
    const played = new Set<string>();
    const fired = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const first = seed % 2 === 1;
      const me = first ? "p1" : "p2";
      const mine = deckSpec(built.list, me, `${f} built`);
      const opp = DECK_FACTIONS[(DECK_FACTIONS.indexOf(f) + seed) % 4]!;
      const theirs = buildDeck(first ? "p2" : "p1", "Opponent", [...shippedList(opp)].map(([id, copies]) => ({ card: getCard(id)!, copies })));
      const [p1, p2] = first ? [mine, theirs] : [theirs, mine];
      const { state } = await runMatch(p1, p2, new AggressiveAgent(`a${seed}`), new RandomAgent(`r${seed}`, seed), seed);
      expect(state.winner === "p1" || state.winner === "p2" || state.winner === "draw" || state.winner === null).toBe(true);
      for (const ev of state.log) {
        if ((ev.type === "play" || ev.type === "cast") && ev.player === me && names.has(ev.card)) played.add(ev.card);
        if (ev.type === "toolAttached" && ev.player === me && names.has(ev.tool)) played.add(ev.tool);
        // Only this deck holds booster cards (the opponent is a starter deck).
        if (ev.type === "abilityTrigger" && names.has(ev.source)) fired.add(ev.source);
      }
    }
    // Most of the booster cards the builder took were played, and booster
    // abilities fired: the cards are live in real decks.
    expect(played.size, `${f}: played ${[...played].join(", ")} of ${[...names].join(", ")}`).toBeGreaterThanOrEqual(Math.ceil(names.size / 2));
    expect(fired.size, `${f}: abilities fired on ${[...fired].join(", ")}`).toBeGreaterThan(0);
  }, 60_000);
});
