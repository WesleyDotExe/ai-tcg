// Every economy number in one place (owner 2026-10-05, "one economy config
// file for every number"), so Season 0 data can tune them without hunting
// through the store. Rules (who may do what) stay in the store and schema;
// only the amounts live here.

import type { Rarity } from "@ai-tcg/engine";

/** Credits for the 1st win of a UTC day, wins 2-4, wins 5-10, and after the
 * 10th (owner 2026-10-05, trimmed from 40/15/5). */
export const WIN_CREDITS = { first: 30, secondToFourth: 10, fifthToTenth: 5, afterTenth: 0 } as const;

/** A loss (or draw) pays this, owner-approved 2026-10-05. It must stay below
 * the smallest paying win so a win always pays more than a loss. */
export const LOSS_CREDITS = 2;

/** Losses stop paying after this many in a UTC day (owner-approved). */
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
