// The pack-opening reveal, slice 1 (owner 2026-10-18: "the pack-opening
// reveal is the render lane's next priority"): the data side. It turns one
// real opening from the economy store (`EconomyStore.openPack`, seeded, so a
// run reproduces) into what the reveal page plays: the cards in reveal
// order, each with its card face and the reveal its finish gets, and the
// pack-level tells (sparks, Jackpot).
//
// The one rule this module exists to keep: the reveal only SHOWS a result
// that was already rolled. Nothing here draws a random number or changes a
// card; it reorders the pulls for the reveal (the shine slot last) and
// reads every flag from the opening itself. The tests check that the plan
// holds exactly the opening's copies, and that the sparks are honest (on
// exactly when the pack holds a hit, as the pity timer counts one).
//
// Read-only on the economy and the engine, like the rest of the render:
// it imports their public types and lookups, never changes them.

import { getCard, type Card } from "@ai-tcg/engine";
import { FULL_ART_OR_BETTER, type BulkOpening, type Finish, type OpenedCard, type PackOpening } from "@ai-tcg/economy";
import { visualPatternFor, visualSeedFor } from "./cardVisual.js";

/** How a card is revealed. One per finish: the owner's 2026-10-18 list
 * (Foil, Full Art, Glitch, secret illustration, Gold, Zero-Day, Prototype),
 * plus Alt Art, which the list doesn't name (see notes-for-owner: it gets
 * the Full Art expansion with its own composition). */
export type RevealKind = "plain" | "foil" | "fullArt" | "altArt" | "glitch" | "secret" | "gold" | "prototype" | "zeroDay";

const REVEAL_OF: Record<Finish, RevealKind> = {
  standard: "plain",
  foil: "foil",
  fullArt: "fullArt",
  altArt: "altArt",
  glitch: "glitch",
  secret: "secret",
  gold: "gold",
  prototype: "prototype",
  // A tournament prize copy is serial-numbered like a Prototype and never
  // comes out of a pack; if one is ever revealed, it gets the serial moment.
  tournament: "prototype",
  zeroDay: "zeroDay",
};

export function revealKindOf(finish: Finish): RevealKind {
  return REVEAL_OF[finish];
}

/** Proposed timings, in milliseconds (an open detail for the checkpoint).
 * `flip` is the face-down-to-face-up turn; `hold` is how long the card
 * stays before the viewer may move on (a tap during it is ignored, so a
 * reveal can't be skipped by a double tap); `fly` is the card leaving. */
export const REVEAL_TIMINGS: Record<RevealKind, { flip: number; hold: number }> = {
  plain: { flip: 0, hold: 120 },
  foil: { flip: 420, hold: 500 },
  fullArt: { flip: 480, hold: 1100 },
  altArt: { flip: 480, hold: 1100 },
  glitch: { flip: 950, hold: 700 },
  secret: { flip: 1900, hold: 1300 },
  gold: { flip: 650, hold: 1200 },
  prototype: { flip: 900, hold: 1300 },
  // The Zero-Day takeover runs before the card arrives; see ZERO_DAY_TIMINGS.
  zeroDay: { flip: 600, hold: 1400 },
};

/** The pack-level beats. */
export const PACK_TIMINGS = {
  /** A tap (not a drag) tears the pack this fast. */
  autoTear: 420,
  /** The torn top strip flying off, and the sparks when the pack holds a hit. */
  tear: 650,
  sparks: 1300,
  /** The Jackpot banner, before the cards rise. */
  jackpotBanner: 1500,
  /** The cards rising out of the pack as a stack. */
  rise: 700,
  /** A card leaving the top of the stack. Plain cards move quickly. */
  fly: 220,
} as const;

/** The Zero-Day takeover (owner 2026-10-18): the screen drops to black, a
 * terminal types "ZERO-DAY DETECTED", a short breach sequence plays, then the
 * animated card arrives. */
export const ZERO_DAY_TIMINGS = {
  black: 450,
  typePerChar: 55,
  breach: 1900,
  arrive: 700,
} as const;

/** The card face the page draws: everything printed on a card under the
 * owner-approved layout (render/reference/card-text-layout.html). */
export interface CardFace {
  name: string;
  type: Card["type"] | "Reserved";
  faction: Card["faction"];
  rarity: Card["rarity"];
  cost: number | null;
  attack: number | null;
  health: number | null;
  /** Keywords, then each ability's rules text, one line each. */
  text: string[];
  flavor: string;
  /** The placeholder art's seeds (cardVisual.ts), from the card id. */
  visualSeed: number;
  visualPattern: number;
}

export interface RevealCard {
  copyId: string;
  cardId: string;
  face: CardFace;
  finish: Finish;
  reveal: RevealKind;
  slot: OpenedCard["slot"];
  collectorNumber: string;
  /** A hit (Full Art or better, as the pity timer counts one). */
  hit: boolean;
  /** Arrives face down and glowing, waiting for a tap: every finish but
   * Standard (the owner app spec: "special cards arrive face-down and
   * glowing; tap to reveal"). Foil isn't a hit, but it still gets a flip. */
  faceDown: boolean;
  isNew: boolean;
  ownedAfter: number;
  prototype: OpenedCard["prototype"];
  secret: OpenedCard["secret"];
}

export interface PackReveal {
  packId: string;
  setCode: string;
  oddsVersion: string;
  seed: number;
  jackpot: boolean;
  /** The honest tell: the tear throws sparks exactly when the pack holds a
   * hit. Never a fake-out either way. */
  sparks: boolean;
  /** A bulk open would still give this pack its full reveal (the store's
   * own flag). Unused by a single-pack open, which always reveals fully. */
  fullReveal: boolean;
  pity: PackOpening["pity"];
  packPoints: number;
  /** In reveal order: the four plain slots as rolled, then the shine slot,
   * then a Prototype's bonus 6th card. */
  cards: RevealCard[];
}

/** Reveal order: Common, Common, Uncommon, Rare as rolled, the shine slot
 * last of the five (owner 2026-10-18), and a bonus 6th card after the five,
 * as its own moment. The store returns the pulls in that order already;
 * this sorts by slot anyway, so the rule doesn't lean on the store's
 * habit. */
const SLOT_ORDER: Record<OpenedCard["slot"], number> = { Common: 0, Uncommon: 1, Rare: 2, shine: 3, bonus: 4 };

export function planReveal(opening: PackOpening): PackReveal {
  const cards = opening.cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => SLOT_ORDER[a.c.slot] - SLOT_ORDER[b.c.slot] || a.i - b.i)
    .map(({ c }) => revealCard(c));
  return {
    packId: opening.packId,
    setCode: opening.setCode,
    oddsVersion: opening.oddsVersion,
    seed: opening.seed,
    jackpot: opening.jackpot,
    sparks: cards.some((c) => c.hit),
    fullReveal: opening.fullReveal,
    pity: opening.pity,
    packPoints: opening.packPoints,
    cards,
  };
}

function revealCard(c: OpenedCard): RevealCard {
  return {
    copyId: c.copyId,
    cardId: c.cardId,
    face: cardFaceOf(c),
    finish: c.finish,
    reveal: revealKindOf(c.finish),
    slot: c.slot,
    collectorNumber: c.collectorNumber,
    hit: FULL_ART_OR_BETTER.includes(c.finish),
    faceDown: c.finish !== "standard",
    isNew: c.isNew,
    ownedAfter: c.ownedAfter,
    prototype: c.prototype,
    secret: c.secret,
  };
}

/** The printed face of an opened card. A Zero-Day pull whose card isn't
 * live yet (game session 40 built the 3 cards but keeps them out of the
 * registry until the owner's OK) shows its reserved entry, as the owner
 * asked: "Until the 3 cards are built, show the reserved entry." */
export function cardFaceOf(c: Pick<OpenedCard, "cardId" | "name" | "rarity">): CardFace {
  const card = getCard(c.cardId);
  if (!card) {
    return {
      name: c.name,
      type: "Reserved",
      faction: "Neutral",
      rarity: c.rarity,
      cost: null,
      attack: null,
      health: null,
      text: ["Reserved entry. This card is designed and waits to go live."],
      flavor: "Signal acquired. Payload withheld.",
      visualSeed: visualSeedFor(c.cardId),
      visualPattern: visualPatternFor(c.cardId),
    };
  }
  const keywords = card.type === "Unit" ? card.keywords : card.type === "Tool" ? card.grantedKeywords.map((k) => `Grants ${k}`) : [];
  const text = [...(keywords.length ? [keywords.join(", ")] : []), ...card.abilities.map((a) => a.text)];
  if (card.type === "Tool") text.unshift(`+${card.attackBonus}/+${card.healthBonus}`);
  if (card.type === "Unit" && card.telegraph) text.unshift(`Telegraph ${card.telegraph}`);
  return {
    name: card.name,
    type: card.type,
    faction: card.faction,
    rarity: card.rarity,
    cost: card.cost,
    attack: card.type === "Unit" ? card.attack : null,
    health: card.type === "Unit" ? card.health : null,
    text,
    flavor: card.flavor,
    visualSeed: visualSeedFor(card.id),
    visualPattern: visualPatternFor(card.id),
  };
}

// ---------- the ten-pack opening (slice 2) ----------

/** The ten-pack fast sequence (owner 2026-10-05 and 2026-10-18: "fast flips
 * with skip and speed-up controls, a summary grid at the end, and full
 * reveals only for the big pulls"). Proposed timings in milliseconds at 1x;
 * each speed divides them. A pack the store marks `fullReveal` leaves the
 * fast sequence and plays the single-pack reveal at its own timings, at
 * every speed. */
export const BULK_TIMINGS = {
  /** The pack sitting sealed before it tears by itself. */
  sealed: 260,
  /** The tear, and the sparks when the pack holds a hit. */
  tear: 380,
  /** The cards dealing out of the pack into a row, one after another. */
  deal: 70,
  /** One face-down card turning over; they turn one after another. */
  flip: 230,
  /** How long a pack's row stays before the next pack: longer with a hit. */
  hold: 520,
  hitHold: 1100,
} as const;

/** The speeds the owner can pick. */
export const BULK_SPEEDS = [1, 2, 4] as const;

/** One tile of the ten-pack summary grid: every copy of the same card in
 * the same finish, folded into one tile with a count. A Prototype copy is
 * always its own tile (its serial is its own). */
export interface SummaryTile {
  cardId: string;
  face: CardFace;
  finish: Finish;
  reveal: RevealKind;
  hit: boolean;
  collectorNumber: string;
  /** Copies in this tile. */
  count: number;
  /** The packs (1-based, in opening order) the copies came out of. */
  packs: number[];
  /** The first copy of a collection entry the owner didn't have before this
   * open. One badge per entry: a card new in pack 2 isn't new again in pack
   * 5, and a Glitch or secret copy is its own entry (as the store counts). */
  isNew: boolean;
  /** Copies of the card held after the whole open. */
  ownedAfter: number;
  prototype: OpenedCard["prototype"];
  secret: OpenedCard["secret"];
}

export interface BulkReveal {
  /** Each pack's own reveal plan, in opening order. */
  packs: PackReveal[];
  /** The store's own summary of the open, as returned. */
  summary: BulkOpening["summary"];
  /** The summary grid, best first. */
  tiles: SummaryTile[];
}

/** Best first: the finish's place on the ladder, then rarity, then the
 * order the cards came out. */
const FINISH_RANK: Record<Finish, number> = {
  zeroDay: 0, prototype: 1, tournament: 1, secret: 2, gold: 3, glitch: 4, altArt: 5, fullArt: 6, foil: 7, standard: 8,
};
const RARITY_RANK: Record<string, number> = { Mythic: 0, Rare: 1, Uncommon: 2, Common: 3 };

/** The collection entry a copy fills (the store's own rule, economy
 * store.ts collectionEntryKey, which it doesn't export). */
export function entryKeyOf(c: Pick<OpenedCard, "cardId" | "finish" | "secret">): string {
  if (c.secret) return `secret:${c.secret.code}`;
  if (c.finish === "glitch") return `glitch:${c.cardId}`;
  return `card:${c.cardId}`;
}

export function planBulkReveal(bulk: BulkOpening): BulkReveal {
  const packs = bulk.packs.map(planReveal);
  const tiles: SummaryTile[] = [];
  const byKey = new Map<string, SummaryTile>();
  const newEntries = new Set<string>();
  const ownedAfter = new Map<string, number>();
  packs.forEach((p, pi) => {
    for (const c of p.cards) {
      ownedAfter.set(c.cardId, Math.max(ownedAfter.get(c.cardId) ?? 0, c.ownedAfter));
      const entry = entryKeyOf(c);
      const isNew = c.isNew && !newEntries.has(entry);
      if (isNew) newEntries.add(entry);
      const key = c.prototype ? `proto:${c.copyId}` : `${entry}|${c.finish}`;
      const had = byKey.get(key);
      if (had) {
        had.count++;
        if (!had.packs.includes(pi + 1)) had.packs.push(pi + 1);
        had.isNew ||= isNew;
        continue;
      }
      const t: SummaryTile = {
        cardId: c.cardId, face: c.face, finish: c.finish, reveal: c.reveal, hit: c.hit, collectorNumber: c.collectorNumber,
        count: 1, packs: [pi + 1], isNew, ownedAfter: 0, prototype: c.prototype, secret: c.secret,
      };
      byKey.set(key, t);
      tiles.push(t);
    }
  });
  for (const t of tiles) t.ownedAfter = ownedAfter.get(t.cardId)!;
  const order = new Map(tiles.map((t, i) => [t, i]));
  tiles.sort((a, b) => FINISH_RANK[a.finish] - FINISH_RANK[b.finish] || RARITY_RANK[a.face.rarity]! - RARITY_RANK[b.face.rarity]! || order.get(a)! - order.get(b)!);
  return { packs, summary: bulk.summary, tiles };
}
