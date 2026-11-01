// Every economy number in one place (owner 2026-10-05, "one economy config
// file for every number"), so Season 0 data can tune them without hunting
// through the store. Rules (who may do what) stay in the store and schema;
// only the amounts live here.

import type { Rarity } from "@ai-tcg/engine";

/** The daily reset (owner 2026-11-01): midnight Sydney time, following
 * daylight saving, for the daily win schedule and every daily reward.
 * dailyReset.ts turns it into each day's start and end. */
export const DAILY_RESET_TIME_ZONE = "Australia/Sydney";

/** Credits for the 1st win of a reset day, wins 2-4, wins 5-10, and after the
 * 10th (owner 2026-10-05, trimmed from 40/15/5). */
export const WIN_CREDITS = { first: 30, secondToFourth: 10, fifthToTenth: 5, afterTenth: 0 } as const;

/** A loss (or draw) pays this, owner-approved 2026-10-05. It must stay below
 * the smallest paying win so a win always pays more than a loss. */
export const LOSS_CREDITS = 2;

/** Losses stop paying after this many in a reset day (owner-approved). */
export const MAX_PAID_LOSSES_PER_DAY = 10;

/** Price of one pack in credits. */
export const PACK_PRICE_CREDITS = 100;

/** Packs in the starter collection, granted once per owner. */
export const STARTER_PACKS = 3;

/** Pack points for salvaging one extra standard-finish pack copy. */
export const SALVAGE_PACK_POINTS: Readonly<Record<Rarity, number>> = { Common: 5, Uncommon: 10, Rare: 30, Mythic: 100 };

/** Pack points to craft one standard-finish copy (about 8x salvage). Crafting
 * itself is built with the pack session; the number lives here now. */
export const CRAFT_PACK_POINTS: Readonly<Record<Rarity, number>> = { Common: 40, Uncommon: 80, Rare: 250, Mythic: 800 };

/** Season 0 sign-in (owner app spec C.1). A password needs at least this
 * many characters; nothing else is required of it. */
export const PASSWORD_MIN_LENGTH = 10;

/** scrypt cost for new password hashes: N = 2^15, r = 8, p = 1 (about 32 MB
 * and tens of milliseconds per hash). The cost is stored inside each hash, so
 * raising it later re-hashes each password at its owner's next sign-in. */
export const SCRYPT_COST = { log2N: 15, r: 8, p: 1 } as const;

/** A sign-in session lasts this many days, then the owner signs in again. */
export const SESSION_DAYS = 30;

/** After this many failed sign-ins for one login within the window, that
 * login is refused (without checking the password) until the window passes. */
export const SIGN_IN_LOCKOUT = { failures: 10, windowMinutes: 15 } as const;

/** Pack points every opened pack pays, free packs included (ECONOMY.md,
 * "Packs"). */
export const PACK_POINTS_PER_PACK = 5;

/** How many packs one bulk open takes (owner 2026-10-05: "1 pack or 10 at
 * once"; same odds, no discount, no bonus). */
export const BULK_OPEN_COUNT = 10;

/** Pieces in a season's signature art pool (owner 2026-10-16: 500,
 * accepted as planned). Each signature card records one slot at creation;
 * the images arrive with the late art pass. */
export const SIGNATURE_ART_POOL_SIZE = 500;

/**
 * The pack odds table S0-odds-1, live from session 36 to session 39 and kept
 * so its openings reproduce (ECONOMY.md "Rarity and finish" and "Packs"). One
 * versioned table drives both the game and the published odds; every
 * opening records the version it used. Change a number here only together
 * with a new `version`, so an old opening still names the table it rolled
 * against.
 *
 * Fixed by the owner (2026-10-04 and amendments): 5 cards (2 Common, 1
 * Uncommon, 1 Rare slot, 1 shine slot); 1 Rare slot in 8 is a Mythic; only
 * the shine slot rolls a finish (Standard ~56%, Foil 30%, Full Art 10%, Alt
 * Art ~1 in 30 on Rares and Mythics only, Gold ~1 in 150); a Jackpot pack
 * (~1 in 2,000) is Foil or better throughout; a Prototype is a bonus 6th
 * card in 1 pack in 1,000; pity after 10 packs without Full Art or better
 * and after 40 without a Mythic.
 *
 * PROPOSED by session 36, for the owner's check-in: the shine slot's rarity
 * weights ("any card, any rarity" didn't fix them), and that an Alt Art
 * roll draws its card from the Rares and Mythics (so the ~1 in 30 holds).
 */
export const PACK_ODDS = {
  version: "S0-odds-1",
  slots: { Common: 2, Uncommon: 1, Rare: 1 },
  /** The Rare slot is a Mythic this often. */
  mythicInRareSlot: 1 / 8,
  /** The shine slot's rarity, before its finish (proposal). */
  shineRarity: { Common: 60, Uncommon: 25, Rare: 12, Mythic: 3 },
  /** The shine slot's finish, in percent: Standard is what's left (56). */
  shineFinish: { foil: 30, fullArt: 10, altArt: 100 / 30, gold: 100 / 150 },
  jackpotPack: 1 / 2000,
  prototypeBonus: 1 / 1000,
  pity: { fullArtAfter: 10, mythicAfter: 40 },
} as const;

/**
 * The pack odds table S0-odds-2: the chase cards (owner 2026-10-16, "more
 * collectable chase cards", items 2-4). Proposed and measured in session 38
 * (`progress/pack-sim-002.txt`), approved as proposed 2026-10-18 (answer
 * 4A), live since session 39. What stays from S0-odds-1: the 5 slots, a
 * Mythic in 1 Rare slot in 8, only the shine slot rolling a finish, the
 * Jackpot pack at 1 in 2,000 (Foil or better throughout), the Prototype
 * bonus at 1 in 1,000, both pity timers at 10 and 40.
 *
 * What changes: the shine slot's finish table gains Glitch, secret
 * illustrations and Zero-Day (about 1 pack in 500), and each special
 * version draws its card from a chosen list instead of the slot's
 * 60/25/12/3 rarity weights, so Full Art and up land on cards people want.
 * Foil stays on any card.
 */
export const PACK_ODDS_V2 = {
  version: "S0-odds-2",
  slots: PACK_ODDS.slots,
  mythicInRareSlot: PACK_ODDS.mythicInRareSlot,
  /** Standard and Foil shine cards: any card, by these rarity weights (as S0-odds-1). */
  shineRarity: PACK_ODDS.shineRarity,
  /** The shine slot's finish, in percent; Standard is what's left (53.6). */
  shineFinish: { foil: 28, fullArt: 9, glitch: 4, altArt: 3, secret: 1.5, gold: 0.7, zeroDay: 0.2 },
  /** Which cards a special version lands on: rarity weights over the set's
   * cards (Full Art, Alt Art, Gold), or a chosen list (Glitch, secrets). */
  fullArtRarity: { Uncommon: 40, Rare: 45, Mythic: 15 },
  altArtRarity: { Rare: 75, Mythic: 25 },
  goldRarity: { Rare: 70, Mythic: 30 },
  jackpotPack: PACK_ODDS.jackpotPack,
  prototypeBonus: PACK_ODDS.prototypeBonus,
  pity: PACK_ODDS.pity,
} as const;

export type PackOdds = typeof PACK_ODDS | typeof PACK_ODDS_V2;

/** The table every pack opened now rolls against, whatever its season
 * (owner 2026-10-18, answer 6A: older seasons' packs stay openable). */
export const LIVE_PACK_ODDS: PackOdds = PACK_ODDS_V2;

/** Every table ever live, by version, so a logged opening can be rolled
 * again from its seed. */
export const PACK_ODDS_TABLES: ReadonlyMap<string, PackOdds> = new Map<string, PackOdds>([
  [PACK_ODDS.version, PACK_ODDS],
  [PACK_ODDS_V2.version, PACK_ODDS_V2],
]);

/** Pack points to craft one secret card (owner 2026-10-18, answer 5A):
 * a secret illustration 750, a Zero-Day card 3,000. Measured in
 * `progress/pack-sim-002.txt`: about 5 months to the master set and 7 to
 * the full set for a dedicated owner. */
export const SECRET_CRAFT_PACK_POINTS = { illustration: 750, zeroDay: 3000 } as const;

/** Pack points each rename after an agent's first costs (owner 2026-10-17,
 * option D: naming at creation and the first rename are free, every rename
 * after that costs this; the price is session 37's proposal, kept). 100
 * sits between crafting an Uncommon (80) and a Rare (250): about 20 packs'
 * worth from opening alone, so a rename is a choice, not a whim. */
export const AGENT_RENAME_PACK_POINTS = 100;
