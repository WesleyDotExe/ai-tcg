// The realistic collections behind the built-deck ring
// (economy/src/dev/realisticCollections.ts): a starter collection plus packs
// from the live roller, read off at each pack level.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHIPPED_DECK_LISTS } from "@ai-tcg/engine";
import { collections, FACTIONS, OWNERS_PER_FACTION, PACK_LEVELS } from "../src/dev/realisticCollections.js";

describe("realistic collections", () => {
  const file = collections();

  it("has one collection per owner per pack level, 5 cards a pack (6 with a bonus) on top of the starter deck", () => {
    expect(file.collections).toHaveLength(FACTIONS.length * OWNERS_PER_FACTION * PACK_LEVELS.length);
    for (const c of file.collections) {
      const starter = SHIPPED_DECK_LISTS[c.faction].reduce((s, e) => s + e.copies, 0);
      expect(c.copies).toBeGreaterThanOrEqual(starter + 5 * c.packs);
      expect(c.copies).toBeLessThanOrEqual(starter + 6 * c.packs);
    }
  });

  it("holds the whole starter deck, and each owner's later collection contains its earlier one", () => {
    for (const f of FACTIONS) {
      for (let owner = 0; owner < OWNERS_PER_FACTION; owner++) {
        const mine = file.collections.filter((c) => c.faction === f && c.owner === owner).sort((a, b) => a.packs - b.packs);
        const first = new Map(mine[0]!.holdings);
        for (const e of SHIPPED_DECK_LISTS[f]) expect(first.get(e.cardId) ?? 0).toBeGreaterThanOrEqual(e.copies);
        for (let i = 1; i < mine.length; i++) {
          const later = new Map(mine[i]!.holdings);
          for (const [id, n] of mine[i - 1]!.holdings) expect(later.get(id) ?? 0).toBeGreaterThanOrEqual(n);
        }
      }
    }
  });

  it("gives different owners different packs", () => {
    const at37 = file.collections.filter((c) => c.faction === "Aegis" && c.packs === 37).map((c) => JSON.stringify(c.holdings));
    expect(new Set(at37).size).toBe(OWNERS_PER_FACTION);
  });

  it("is the committed file, byte for byte", () => {
    const committed = readFileSync(fileURLToPath(new URL("../../progress/built-deck-ring/collections.json", import.meta.url)), "utf8");
    expect(`${JSON.stringify(file, null, 1)}\n`).toBe(committed);
  });
});
