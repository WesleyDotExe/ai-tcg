// The deck-size check's deck makers (engine/src/dev/deckSizeCheck.ts): its
// measurements only say something about size if every deck it plays is
// legal, of the size it claims, and (for the size-alone pairs) the same
// cards in the same proportions.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROPORTIONAL_PAIRS, TRIM_SIZES, cutTo, largestDeck, pairedZ, proportionalPair, type DeckResult } from "../src/dev/deckSizeCheck.js";
import { DECK_FACTIONS, constructDeck, deckSpec, fullHoldings, listProblem, type DeckList } from "../src/deckbuilder/deckBuilder.js";
import { Rng } from "../src/state/rng.js";

const size = (l: DeckList) => [...l.values()].reduce((a, b) => a + b, 0);
const full = fullHoldings();

describe("cutTo", () => {
  for (const faction of DECK_FACTIONS) {
    it(`cuts the ${faction} 40-card deck to every size, legally, keeping only its own cards`, () => {
      const start = constructDeck(faction, full);
      if (!("list" in start)) throw new Error(start.infeasible);
      expect(size(start.list)).toBe(40);
      for (const target of TRIM_SIZES) {
        for (const rng of [undefined, new Rng(target)]) {
          const cut = cutTo(start.list, target, faction, full, rng);
          expect(size(cut)).toBe(target);
          expect(listProblem(cut, faction, full)).toBeUndefined();
          for (const [id, n] of cut) expect(n).toBeLessThanOrEqual(start.list.get(id)!);
          expect(() => deckSpec(cut, "p1", "cut")).not.toThrow();
        }
      }
    });
  }

  it("takes the lowest-rated copies first without an rng, the same cut every time", () => {
    const start = constructDeck("Cortex", full) as { list: DeckList };
    expect([...cutTo(start.list, 32, "Cortex", full)]).toEqual([...cutTo(start.list, 32, "Cortex", full)]);
  });
});

describe("proportionalPair", () => {
  for (const faction of DECK_FACTIONS) {
    it(`makes legal ${faction} pairs with the same cards in the same proportions`, () => {
      const start = constructDeck(faction, full) as { list: DeckList };
      for (const { distinct, high, low } of PROPORTIONAL_PAIRS) {
        const { big, small } = proportionalPair(start.list, faction, full, distinct, high, low);
        expect([...big.keys()].sort()).toEqual([...small.keys()].sort());
        expect(big.size).toBe(distinct);
        expect([...big.values()].every((n) => n === high)).toBe(true);
        expect([...small.values()].every((n) => n === low)).toBe(true);
        expect(listProblem(big, faction, full)).toBeUndefined();
        expect(listProblem(small, faction, full)).toBeUndefined();
      }
    });
  }
});

describe("largestDeck", () => {
  it("finds the demo owner's Null cards stop at 27 (17 Null copies and the 10-card neutral cap)", () => {
    const file = JSON.parse(readFileSync(new URL("../../progress/deck-size/demo-owner-holdings.json", import.meta.url), "utf8")) as { holdings: [string, number][] };
    expect(largestDeck(new Map(file.holdings), "Null")).toBe(27);
  });

  it("is 40 from a full collection and null when the faction can't be built", () => {
    for (const f of DECK_FACTIONS) expect(largestDeck(full, f)).toBe(40);
    expect(largestDeck(new Map(), "Aegis")).toBeNull();
  });
});

describe("pairedZ", () => {
  it("is the sign test on the games that came out differently", () => {
    const r = { gained: 30, lost: 10 } as DeckResult;
    expect(pairedZ(r)).toBeCloseTo(20 / Math.sqrt(40));
    expect(pairedZ({ gained: 0, lost: 0 } as DeckResult)).toBe(0);
  });
});
