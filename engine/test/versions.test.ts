// Versioned replays (session 70): the rules and card versions a recorded
// match names, and the frozen cards-1 every ai-tcg-replay/1 file reads.

import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  cardDigest,
  cardSetDigest,
  CARDS_1_BY_ID,
  CARDS_VERSIONS,
  CURRENT_CARDS_VERSION,
  CURRENT_RULES_VERSION,
  digest,
  registryDigest,
  rulesOfVersion,
  RULES_VERSIONS,
} from "../src/engine/versions.js";
import { CARD_REGISTRY } from "../src/data/registry.js";
import { buildCortexDeck, buildSwarmDeck } from "../src/data/decks.js";
import { createInitialState } from "../src/state/init.js";
import { Rng } from "../src/state/rng.js";
import { isShippedRules, MATCH_RULES_FIELDS, type MatchRules } from "../src/state/types.js";

describe("card versions", () => {
  it("today's registry is the newest published card version (a card change needs a new CARDS_VERSIONS entry)", () => {
    // If this fails you changed a card. Add a new entry to CARDS_VERSIONS
    // (engine/src/engine/versions.ts) with the digest below and a note; do
    // not edit an old one. Replays written from then on name the new version;
    // older ones keep playing their own cards.
    expect(CARDS_VERSIONS[CARDS_VERSIONS.length - 1]!.digest, `today's registry digest is ${registryDigest()}`).toBe(registryDigest());
    expect(CURRENT_CARDS_VERSION).toBe(CARDS_VERSIONS[CARDS_VERSIONS.length - 1]!.id);
  });

  it("the frozen cards-1 snapshot is exactly cards-1, whatever the registry becomes", () => {
    expect(cardSetDigest(CARDS_1_BY_ID.values())).toBe(CARDS_VERSIONS.find((v) => v.id === "cards-1")!.digest);
    expect(CARDS_1_BY_ID.size).toBe(99);
  });

  it("version ids are unique", () => {
    expect(new Set(CARDS_VERSIONS.map((v) => v.id)).size).toBe(CARDS_VERSIONS.length);
    expect(new Set(RULES_VERSIONS.map((v) => v.id)).size).toBe(RULES_VERSIONS.length);
  });

  it("a digest ignores key order and undefined fields, and sees any real change", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: undefined, c: 3 }] })).toBe('{"a":[2,{"c":3}],"b":1}');
    const card = structuredClone(CARD_REGISTRY.values().next().value!);
    const reordered = Object.fromEntries(Object.entries(card).reverse()) as typeof card;
    expect(cardDigest(reordered)).toBe(cardDigest(card));
    expect(cardDigest({ ...card, cost: card.cost + 1 })).not.toBe(cardDigest(card));
    expect(cardSetDigest([card, card])).toBe(cardSetDigest([card]));
    expect(() => cardSetDigest([card, { ...card, cost: card.cost + 1 }])).toThrow(/two different cards share the id/);
    expect(digest("")).toMatch(/^[0-9a-f]{16}$/);
    expect(digest("a")).not.toBe(digest("b"));
  });
});

describe("rules versions", () => {
  it("rules-2 is the rules the game plays today: 24 for the second seat, 20 for the first", () => {
    expect(CURRENT_RULES_VERSION).toBe("rules-2");
    expect(rulesOfVersion("rules-2")).toEqual({ secondSeatExtraHealth: 4 });
    expect(isShippedRules(rulesOfVersion(CURRENT_RULES_VERSION))).toBe(true);
    const s = createInitialState(buildCortexDeck("p1", "A"), buildSwarmDeck("p2", "B"), new Rng(1));
    expect([s.players.p1.health, s.players.p1.maxHealth, s.players.p2.health, s.players.p2.maxHealth]).toEqual([20, 20, 24, 24]);
    expect("rules" in s).toBe(false);
  });

  it("rules-1 names its 20 and 20 explicitly, so the new base can't change what it means", () => {
    expect(rulesOfVersion("rules-1")).toEqual({ secondSeatExtraHealth: 0 });
    const s = createInitialState(buildCortexDeck("p1", "A"), buildSwarmDeck("p2", "B"), new Rng(1), rulesOfVersion("rules-1"));
    expect([s.players.p1.health, s.players.p2.health, s.players.p2.maxHealth]).toEqual([20, 20, 20]);
    expect(s.rules).toEqual({ secondSeatExtraHealth: 0 });
  });

  it("every version names every MatchRules field (none leans on today's default)", () => {
    for (const v of RULES_VERSIONS) expect(Object.keys(v.rules).sort(), v.id).toEqual([...MATCH_RULES_FIELDS].sort());
  });

  it("the rules change takes nothing from the RNG: the same seed deals the same hands and decks under both", () => {
    const deal = (rules?: MatchRules) => {
      const s = createInitialState(buildCortexDeck("p1", "A"), buildSwarmDeck("p2", "B"), new Rng(7), rules);
      return (["p1", "p2"] as const).map((p) => [s.players[p].hand.map((c) => c.id), s.players[p].deck.map((c) => c.id)]);
    };
    expect(deal(rulesOfVersion("rules-1"))).toEqual(deal());
  });

  it("an unknown version is refused, never guessed", () => {
    expect(() => rulesOfVersion("rules-0")).toThrow(/isn't one this engine knows/);
    expect(() => rulesOfVersion("rules-3")).toThrow(/isn't one this engine knows/);
  });
});
