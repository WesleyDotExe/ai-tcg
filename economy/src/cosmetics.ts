// The cosmetics catalogue (owner 2026-10-19, "victory boasts"; plan approved
// the same day with all 6 suggested defaults). One catalogue for the four
// kinds the owner named: victory boasts, card backs, avatars and arena
// backgrounds. Like the card sets, the catalogue lives in code, not in the
// database: the database holds only who owns what (schema v11's
// owned_cosmetics) and what each agent has equipped (agent_loadouts).
//
// Cosmetic only: nothing here reaches the engine, the agents, the ring or
// any CI balance check. A boast is drawn by the render lane from its item id
// (code-drawn now; the art pass can add artwork at `artRef` later).

import type { DeckFaction } from "@ai-tcg/engine";

export const COSMETIC_KINDS = ["boast", "cardBack", "avatar", "arena"] as const;
export type CosmeticKind = (typeof COSMETIC_KINDS)[number];

/** An agent's equip slots: one per kind, plus the close-win boast (owner
 * 2026-10-19 decision 5), a second boast the store plays when the winner
 * ends on CLOSE_WIN_HEALTH or less. */
export const LOADOUT_SLOTS = ["boast", "closeWinBoast", "cardBack", "avatar", "arena"] as const;
export type LoadoutSlot = (typeof LOADOUT_SLOTS)[number];

/** The kind of item each slot takes. */
export const SLOT_KIND: Readonly<Record<LoadoutSlot, CosmeticKind>> = {
  boast: "boast",
  closeWinBoast: "boast",
  cardBack: "cardBack",
  avatar: "avatar",
  arena: "arena",
};

/** Each kind with its article, for messages and the loadout picker. */
export const KIND_LABEL: Readonly<Record<CosmeticKind, string>> = {
  boast: "a victory boast",
  cardBack: "a card back",
  avatar: "an avatar",
  arena: "an arena background",
};

/** A win where the winner ends on this much health or less plays the
 * close-win boast, if one is equipped (owner 2026-10-19 decision 5). A
 * turn-cap win counts the same way (render session 30 call 5). */
export const CLOSE_WIN_HEALTH = 5;

/** Price of one season boast in credits (owner 2026-10-19 decision 1: 300,
 * three packs' worth). */
export const SEASON_BOAST_PRICE_CREDITS = 300;

export interface CosmeticItem {
  itemId: string;
  kind: CosmeticKind;
  name: string;
  /** "standard" for the free starter items, else the season it belongs to
   * ("S0"). A season item is sold only in its season, inside its sale
   * window, then retired: never sold again, kept by everyone who has it
   * (owner 2026-10-19 decision 2). */
  season: string;
  /** The faction it is themed to, if any. Any agent may equip any owned
   * item whatever deck it plays. */
  faction: DeckFaction | null;
  /** Credits, or null for an item that is granted, never sold. */
  priceCredits: number | null;
  /** The sale window inside its season (ISO times, either end open). */
  sale: { from: string | null; until: string | null } | null;
  /** What the render draws from: a code-drawn spec id now ("code:..."),
   * the art pass's image later. */
  artRef: string;
  /** One line for the store and the loadout picker. */
  description: string;
}

/** The four free starter boasts, one per faction (owner 2026-10-19): every
 * owner gets all four with the starter collection, not only its starting
 * faction's, since agents can switch factions. Their looks are the render
 * lane's approved drafts (render session 30). */
export const STARTER_BOASTS: Readonly<Record<DeckFaction, CosmeticItem>> = {
  Aegis: {
    itemId: "boast-aegis-shield-slam",
    kind: "boast",
    name: "Shield Slam",
    season: "standard",
    faction: "Aegis",
    priceCredits: null,
    sale: null,
    artRef: "code:boast/aegis-shield-slam",
    description: "Hex plates slam down along the winner's row and lock into a crest over the name.",
  },
  Swarm: {
    itemId: "boast-swarm-hive-burst",
    kind: "boast",
    name: "Hive Burst",
    season: "standard",
    faction: "Swarm",
    priceCredits: null,
    sale: null,
    artRef: "code:boast/swarm-hive-burst",
    description: "Egg sacs bloom in the winner's slots and burst into a rising spore column that spells the name.",
  },
  Null: {
    itemId: "boast-null-void-collapse",
    kind: "boast",
    name: "Void Collapse",
    season: "standard",
    faction: "Null",
    priceCredits: null,
    sale: null,
    artRef: "code:boast/null-void-collapse",
    description: "A dark star pulls in the winner's light, holds a beat, and blooms out in glitch bars into the name.",
  },
  Cortex: {
    itemId: "boast-cortex-data-cascade",
    kind: "boast",
    name: "Data Cascade",
    season: "standard",
    faction: "Cortex",
    priceCredits: null,
    sale: null,
    artRef: "code:boast/cortex-data-cascade",
    description: "Columns of pixels rain onto the winner's row and assemble into the name as wireframe blocks.",
  },
};

/** The shipped catalogue. Season 0 sells nothing yet: which season boasts,
 * card backs, avatars and arenas go on sale (and when) is the owner's call,
 * asked in notes-for-owner.md. The purchase path is built and tested with a
 * catalogue passed to `EconomyStore.open`. */
export const COSMETICS: readonly CosmeticItem[] = Object.values(STARTER_BOASTS);

/** Why a catalogue can't be used, or null when it can: ids unique, every
 * starter boast present and free, prices whole and positive, sale windows
 * in order. The store checks this when it opens. */
export function catalogueProblem(items: readonly CosmeticItem[]): string | null {
  const seen = new Set<string>();
  for (const item of items) {
    if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(item.itemId)) return `cosmetic id "${item.itemId}" must be 3-64 lowercase letters, digits or dashes`;
    if (seen.has(item.itemId)) return `cosmetic id "${item.itemId}" is listed twice`;
    seen.add(item.itemId);
    if (!COSMETIC_KINDS.includes(item.kind)) return `cosmetic "${item.itemId}" has unknown kind "${item.kind}"`;
    if (item.priceCredits !== null && (!Number.isInteger(item.priceCredits) || item.priceCredits <= 0)) {
      return `cosmetic "${item.itemId}" needs a whole, positive price`;
    }
    if (item.priceCredits !== null && item.season === "standard") return `cosmetic "${item.itemId}" is standard, so it is granted, never sold`;
    if (item.priceCredits === null && item.sale !== null) return `cosmetic "${item.itemId}" has a sale window but no price`;
    if (item.sale?.from && item.sale.until && Date.parse(item.sale.from) >= Date.parse(item.sale.until)) {
      return `cosmetic "${item.itemId}"'s sale window ends before it starts`;
    }
  }
  for (const boast of Object.values(STARTER_BOASTS)) {
    const listed = items.find((i) => i.itemId === boast.itemId);
    if (!listed || listed.kind !== "boast" || listed.priceCredits !== null) return `the starter boast "${boast.itemId}" must be listed, free`;
  }
  return null;
}

/** Whether `item` can be bought in `season` at time `at`. */
export function onSale(item: CosmeticItem, season: string, at: string): boolean {
  if (item.priceCredits === null || item.season !== season) return false;
  const t = Date.parse(at);
  if (item.sale?.from && t < Date.parse(item.sale.from)) return false;
  if (item.sale?.until && t >= Date.parse(item.sale.until)) return false;
  return true;
}
