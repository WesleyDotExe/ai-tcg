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
  it("rules-1 is the base rules; an unknown version is refused, never guessed", () => {
    expect(CURRENT_RULES_VERSION).toBe("rules-1");
    expect(rulesOfVersion("rules-1")).toEqual({});
    expect(() => rulesOfVersion("rules-0")).toThrow(/isn't one this engine knows/);
  });
});
