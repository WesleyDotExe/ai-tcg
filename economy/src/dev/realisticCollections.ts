// Realistic collections for the pre-launch built-deck ring (owner
// 2026-10-19, firm: "measure the faction ring with built decks on both
// sides ... from full collections, and from realistic collections (for
// example a starter plus a typical number of packs)").
//
// One simulated owner per (faction, index): the faction's starter
// collection (its shipped deck, as `grantStarterCollection` grants it), then
// packs rolled with the live roller exactly as the store opens them: the
// live odds table, pity carried from the owner's own history, and the
// starter guarantee on the third starter pack. Each owner's collection is
// read off after 3 packs (day one: the starter packs only), 17 (about a
// week at ECONOMY.md's ~2.4 packs a day) and 37 (about two weeks), so one
// owner's later collection always contains its earlier one. Owners are
// independent: every owner's Prototype runs start full (the store shares
// them across owners; at a handful of copies per run this only moves which
// finish a few bonus slots get, never which card).
//
//   npx tsx src/dev/realisticCollections.ts > ../progress/built-deck-ring/collections.json
//
// Deterministic: the same file every time. The engine's builtDeckRing.ts
// reads it; this file never builds a deck or plays a game.

import { LIVE_PACK_ODDS, STARTER_PACKS } from "../config.js";
import { cardSet, FULL_ART_OR_BETTER, nextPity, rollPack, type PityState } from "../packs.js";
import { CARD_REGISTRY, SHIPPED_DECK_LISTS, type DeckFaction } from "@ai-tcg/engine";

export const FACTIONS: readonly DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];
/** Packs opened when each collection is read off (the first 3 are the starter packs). */
export const PACK_LEVELS: readonly number[] = [3, 17, 37];
/** Owners per faction. */
export const OWNERS_PER_FACTION = 8;

export interface CollectionFile {
  _about: string;
  oddsVersion: string;
  packLevels: number[];
  ownersPerFaction: number;
  /** One entry per owner per pack level; holdings are copies per card id (registry cards only). */
  collections: { faction: DeckFaction; owner: number; packs: number; copies: number; holdings: [string, number][] }[];
}

/** The pack seed of an owner's `j`th pack (0-based): fixed, and far from
 * every other driver's seeds. */
export function packSeed(faction: DeckFaction, owner: number, j: number): number {
  return 9_100_000 + FACTIONS.indexOf(faction) * 100_000 + owner * 1_000 + j;
}

export function collections(): CollectionFile {
  const set = cardSet("S0");
  const odds = LIVE_PACK_ODDS;
  const last = Math.max(...PACK_LEVELS);
  const out: CollectionFile["collections"] = [];
  for (const faction of FACTIONS) {
    for (let owner = 0; owner < OWNERS_PER_FACTION; owner++) {
      const held = new Map<string, number>();
      for (const e of SHIPPED_DECK_LISTS[faction]) held.set(e.cardId, (held.get(e.cardId) ?? 0) + e.copies);
      const runs = new Map(set.prototypes.map((r) => [r.code, r.runSize]));
      let pity: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
      let starterHitSeen = false;
      for (let j = 0; j < last; j++) {
        const starterHit = j === STARTER_PACKS - 1 && !starterHitSeen;
        const roll = rollPack(packSeed(faction, owner, j), set, pity, runs, odds, { starterHit });
        pity = nextPity(pity, roll.pulls);
        if (j < STARTER_PACKS && roll.pulls.some((p) => FULL_ART_OR_BETTER.includes(p.finish))) starterHitSeen = true;
        for (const p of roll.pulls) held.set(p.cardId, (held.get(p.cardId) ?? 0) + 1);
        if (PACK_LEVELS.includes(j + 1)) {
          const holdings = [...held].filter(([id]) => CARD_REGISTRY.has(id)).sort(([a], [b]) => a.localeCompare(b));
          out.push({ faction, owner, packs: j + 1, copies: holdings.reduce((s, [, n]) => s + n, 0), holdings });
        }
      }
    }
  }
  return {
    _about:
      "Realistic collections for the built-deck ring (economy/src/dev/realisticCollections.ts): a faction's starter " +
      "collection plus packs from the live roller, read off after each pack level.",
    oddsVersion: odds.version,
    packLevels: [...PACK_LEVELS],
    ownersPerFaction: OWNERS_PER_FACTION,
    collections: out,
  };
}

if (process.argv[1]?.endsWith("realisticCollections.ts")) console.log(JSON.stringify(collections(), null, 1));
