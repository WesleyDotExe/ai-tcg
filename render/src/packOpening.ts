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
import { FULL_ART_OR_BETTER, type Finish, type OpenedCard, type PackOpening } from "@ai-tcg/economy";
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
