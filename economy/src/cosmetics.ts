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

export const COSMETIC_KINDS = ["boast", "cardBack", "avatar", "arena", "coin"] as const;
export type CosmeticKind = (typeof COSMETIC_KINDS)[number];

/** An agent's equip slots: one per kind, plus the close-win boast (owner
 * 2026-10-19 decision 5), a second boast the store plays when the winner
 * ends on CLOSE_WIN_HEALTH or less. The sixth, `coin` (schema v20; owner
 * 2026-11-02, coin skins), is the coin the first-player flip shows. */
export const LOADOUT_SLOTS = ["boast", "closeWinBoast", "cardBack", "avatar", "arena", "coin"] as const;
export type LoadoutSlot = (typeof LOADOUT_SLOTS)[number];

/** The kind of item each slot takes. */
export const SLOT_KIND: Readonly<Record<LoadoutSlot, CosmeticKind>> = {
  boast: "boast",
  closeWinBoast: "boast",
  cardBack: "cardBack",
  avatar: "avatar",
  arena: "arena",
  coin: "coin",
};

/** Each kind with its article, for messages and the loadout picker. */
export const KIND_LABEL: Readonly<Record<CosmeticKind, string>> = {
  boast: "a victory boast",
  cardBack: "a card back",
  avatar: "an avatar",
  arena: "an arena background",
  coin: "a coin",
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
  /** For a season reward (schema v20, the tier coins): the end-of-season
   * ladder tier that earns it. Granted, never sold; absent otherwise. */
  tierReward?: SeasonRewardTier;
  /** Whether the render lane has drawn it (for a boast, a spec under its
   * item id in render/src/boastFx.ts's BOAST_SPECS; for a coin, a spec
   * under its item id in render/src/coinFx.ts's COIN_SPECS: all six Season 0
   * coins since render session 55, the second coin slice). An item that isn't
   * drawn is never on sale, whatever its window (owner 2026-10-19: "neither
   * goes on sale until the render lane has drawn it"). The render lane
   * flips this in the same change that adds the spec; a test in
   * economy/test/cosmetics.test.ts fails if the two disagree. */
  drawn: boolean;
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
    description: "Hex plates slam up along the winner's row and lock into a crest over the name.",
    drawn: true,
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
    description: "Egg sacs swell in the winner's slots and burst, throwing spores up into a zig-zag column over the name.",
    drawn: true,
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
    description: "A dark star pulls in the winner's light, holds a silent beat, and blooms out in glitch bars that frame the name.",
    drawn: true,
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
    description: "Columns of pixels stream up out of the winner's row and snap into a stack of wireframe blocks over the name.",
    drawn: true,
  },
};

/** What Season 0 sells (owner 2026-10-19, answering session 47's
 * question 1): two neutral season boasts at the season boast price, on sale
 * for the whole of Season 0 (no window inside it), then retired. No card
 * backs, avatars or arenas in Season 0 until the render lane can draw them.
 * `sale: null` is the whole season. Each goes on sale only once the render lane has drawn it (`drawn`). */
export const SEASON_0_BOASTS: readonly CosmeticItem[] = [
  {
    itemId: "boast-s0-boot-sequence",
    kind: "boast",
    name: "Boot Sequence",
    season: "S0",
    faction: null,
    priceCredits: SEASON_BOAST_PRICE_CREDITS,
    sale: null,
    artRef: "code:boast/s0-boot-sequence",
    description: "The screen flickers on like an old CRT, a retro BIOS types out the winner's name line by line, then a chunky SYSTEM READY flash.",
    drawn: true,
  },
  {
    itemId: "boast-s0-dial-up-fireworks",
    kind: "boast",
    name: "Dial-Up Fireworks",
    season: "S0",
    faction: null,
    priceCredits: SEASON_BOAST_PRICE_CREDITS,
    sale: null,
    artRef: "code:boast/s0-dial-up-fireworks",
    description: "A modem handshake screech, then pixel fireworks burst over a neon city skyline and spell out the winner's name.",
    drawn: true,
  },
];

// ---- coin skins (schema v20; owner 2026-11-02) ----
//
// Who goes first is the server's coin flip for every match
// (server/src/ladder/pairing.ts). The coin is how that flip looks, and
// nothing else: it never changes who goes first or the odds, and the flip's
// animation shows the server's real result. Each owner sees their own
// agent's coin; a spectator who owns neither agent sees the coin of the
// player whose point of view they watch (the higher-rated by default).

/** The tiers whose end-of-season finish earns a coin (owner 2026-11-02:
 * Platinum, Diamond and Mythic, so every tier coin is earned; Gold is the
 * starting rating's tier). Lowest first. */
export const SEASON_REWARD_TIERS = ["Platinum", "Diamond", "Mythic"] as const;
export type SeasonRewardTier = (typeof SEASON_REWARD_TIERS)[number];

/** Price of a Season 0 store coin (owner 2026-11-02: 300 credits, the
 * season boast's price). */
export const SEASON_COIN_PRICE_CREDITS = 300;

/** The free starter coin (owner 2026-11-02): granted to every owner with the
 * starter collection, equipped on every agent, never sold. An empty coin
 * slot flips this coin too. */
export const STARTER_COIN: CosmeticItem = {
  itemId: "coin-chrome-token",
  kind: "coin",
  name: "Chrome Token",
  season: "standard",
  faction: null,
  priceCredits: null,
  sale: null,
  artRef: "code:coin/chrome-token",
  description: "A silver hex token, polished to a mirror: the house coin every owner starts with.",
  drawn: true,
};

/** The two Season 0 store coins (owner 2026-11-02): 300 credits each, sold
 * for the whole of Season 0, then retired. On sale only once drawn. */
export const SEASON_0_COINS: readonly CosmeticItem[] = [
  {
    itemId: "coin-s0-dial-up-dime",
    kind: "coin",
    name: "Dial-Up Dime",
    season: "S0",
    faction: null,
    priceCredits: SEASON_COIN_PRICE_CREDITS,
    sale: null,
    artRef: "code:coin/s0-dial-up-dime",
    description: "A dark coin with a green CRT-phosphor rim that hums like a modem as it spins.",
    drawn: true,
  },
  {
    itemId: "coin-s0-neon-nickel",
    kind: "coin",
    name: "Neon Nickel",
    season: "S0",
    faction: null,
    priceCredits: SEASON_COIN_PRICE_CREDITS,
    sale: null,
    artRef: "code:coin/s0-neon-nickel",
    description: "A chrome coin edged in magenta and cyan neon, trailing light through the flip.",
    drawn: true,
  },
];

/** The Season 0 tier coins (owner 2026-11-02): granted when the season
 * ends, by the owner's end-of-season ladder tier, placement done. A higher
 * tier gets the lower coins too. Bound to the owner (every cosmetic is),
 * never sold, kept over the season reset. */
export const SEASON_0_TIER_COINS: Readonly<Record<SeasonRewardTier, CosmeticItem>> = {
  Platinum: {
    itemId: "coin-s0-platinum",
    kind: "coin",
    name: "Platinum Coin",
    season: "S0",
    faction: null,
    priceCredits: null,
    sale: null,
    artRef: "code:coin/s0-platinum",
    description: "Season 0's Platinum finish: a brushed platinum coin for owners who ended the season Platinum or higher.",
    tierReward: "Platinum",
    drawn: true,
  },
  Diamond: {
    itemId: "coin-s0-diamond",
    kind: "coin",
    name: "Diamond Coin",
    season: "S0",
    faction: null,
    priceCredits: null,
    sale: null,
    artRef: "code:coin/s0-diamond",
    description: "Season 0's Diamond finish: prismatic facets that split the light as it turns.",
    tierReward: "Diamond",
    drawn: true,
  },
  Mythic: {
    itemId: "coin-s0-mythic",
    kind: "coin",
    name: "Mythic Coin",
    season: "S0",
    faction: null,
    priceCredits: null,
    sale: null,
    artRef: "code:coin/s0-mythic",
    description: "Season 0's Mythic finish: the Mythic ward's moving sheen, for the season's very top.",
    tierReward: "Mythic",
    drawn: true,
  },
};

/** The coin a side flips: its equipped coin, else the Chrome Token (an
 * empty slot, or a match recorded before v20). */
export function coinOf(loadout: { coin?: string | null } | null | undefined): string {
  return loadout?.coin ?? STARTER_COIN.itemId;
}

/** Whose point of view a spectator who owns neither agent starts on
 * (owner 2026-11-02, render session 50): the side whose owner was rated
 * higher as the match started; on a tie, or with no starting ratings
 * known, the player who goes first (p1). */
export function defaultPointOfView(ratingsAtStart: { p1: number; p2: number } | null | undefined): "p1" | "p2" {
  return ratingsAtStart && ratingsAtStart.p2 > ratingsAtStart.p1 ? "p2" : "p1";
}

/** The tier coins an end-of-season tier earns, lowest first (a Mythic
 * finish earns all three; Gold and below, or Placement, earn none). */
export function tierCoinsFor(tier: string, coins: Readonly<Record<SeasonRewardTier, CosmeticItem>> = SEASON_0_TIER_COINS): CosmeticItem[] {
  const reached = SEASON_REWARD_TIERS.indexOf(tier as SeasonRewardTier);
  return reached < 0 ? [] : SEASON_REWARD_TIERS.slice(0, reached + 1).map((t) => coins[t]);
}

/** The shipped catalogue: the free starter items, what each season sells,
 * and each season's rewards. */
export const COSMETICS: readonly CosmeticItem[] = [
  ...Object.values(STARTER_BOASTS),
  ...SEASON_0_BOASTS,
  STARTER_COIN,
  ...SEASON_0_COINS,
  ...Object.values(SEASON_0_TIER_COINS),
];

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
    if (item.tierReward !== undefined) {
      if (!SEASON_REWARD_TIERS.includes(item.tierReward)) return `cosmetic "${item.itemId}" rewards unknown tier "${item.tierReward}"`;
      if (item.priceCredits !== null) return `cosmetic "${item.itemId}" is a season reward, so it is granted, never sold`;
      if (item.season === "standard") return `cosmetic "${item.itemId}" is a season reward, so it belongs to a season`;
      const twin = items.find((o) => o !== item && o.season === item.season && o.tierReward === item.tierReward && o.kind === item.kind);
      if (twin) return `season ${item.season} rewards ${item.tierReward} with two ${item.kind}s ("${item.itemId}", "${twin.itemId}")`;
    }
  }
  const starterCoin = items.find((i) => i.itemId === STARTER_COIN.itemId);
  if (!starterCoin || starterCoin.kind !== "coin" || starterCoin.priceCredits !== null || starterCoin.season !== "standard") {
    return `the starter coin "${STARTER_COIN.itemId}" must be listed, free and standard`;
  }
  for (const boast of Object.values(STARTER_BOASTS)) {
    const listed = items.find((i) => i.itemId === boast.itemId);
    if (!listed || listed.kind !== "boast" || listed.priceCredits !== null) return `the starter boast "${boast.itemId}" must be listed, free`;
  }
  return null;
}

/** Whether `item` can be bought in `season` at time `at`: priced, drawn, in
 * its own season and inside its sale window. */
export function onSale(item: CosmeticItem, season: string, at: string): boolean {
  if (item.priceCredits === null || !item.drawn || item.season !== season) return false;
  const t = Date.parse(at);
  if (item.sale?.from && t < Date.parse(item.sale.from)) return false;
  if (item.sale?.until && t >= Date.parse(item.sale.until)) return false;
  return true;
}
