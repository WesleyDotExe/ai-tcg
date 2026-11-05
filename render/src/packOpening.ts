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
  /** A modal ("choose one") card's modes, each with its printed name and
   * rules text (engine CardMode). Empty on every other card. A modal card's
   * `abilities` hold only what every mode shares (usually nothing), so
   * without these its face had no rules text at all (owner 2026-10-18). */
  modes: { name: string; text: string }[];
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
  /** The starter guarantee upgraded this pack's shine slot to a hit (the
   * owner's last starter pack, when the earlier ones held none). Shown only
   * on the summary, after the reveal, like pity: the pack and the tear
   * never look different (owner 2026-10-19). */
  starterHit: boolean;
  packPoints: number;
  /** In reveal order: the four plain slots as rolled, then the shine slot,
   * then a Prototype's bonus 6th card. */
  cards: RevealCard[];
  /** The sealed pack's tells (render session 58, the ceremony part 1):
   * the backdrop's colour and the burst at the end of the tear. */
  tell: PackTell;
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
    starterHit: opening.starterHit,
    packPoints: opening.packPoints,
    cards,
    tell: packTellOf(cards, opening.seed),
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
      modes: [],
      flavor: "Signal acquired. Payload withheld.",
      visualSeed: visualSeedFor(c.cardId),
      visualPattern: visualPatternFor(c.cardId),
    };
  }
  return faceOfCard(card);
}

/** The printed face of any card the engine can build, set card or not (an
 * agent's signature card is in no set, so getCard doesn't know it). */
export function faceOfCard(card: Card): CardFace {
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
    modes: (card.modes ?? []).map((m) => ({ name: m.name, text: m.text })),
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

/** The speeds the owner can pick. Owner 2026-10-18 (feel notes): they
 * apply to Auto only; the tap-driven opening runs at 1x. */
export const BULK_SPEEDS = [1, 2, 4] as const;

/** The tap-driven ten-pack opening (owner 2026-10-18 feel notes: "nothing
 * plays on its own. Each tap or swipe tears the next pack. Its cards deal
 * into the row, and the owner taps to flip the face-down ones, then moves on
 * to the next pack"). Proposed, in milliseconds; BULK_TIMINGS' tear, deal
 * and flip are reused at 1x. */
export const BULK_TAP_TIMINGS = {
  /** The tapped pack showing sealed before it rips: just long enough to see
   * which pack it is. */
  sealed: 140,
  /** After a hit turns over, a tap on the row waits this long before it
   * moves on, so the hit's pop is never cut off by a double tap. Flipping
   * another card is never held up. */
  hitPop: 600,
  /** Auto, during a big pull's full reveal: the beat between one step of the
   * reveal ending and the next starting (full length at every speed). */
  autoStackBeat: 700,
} as const;

/** Hold to tilt (owner 2026-10-18, as corrected the same day): press and
 * hold a revealed card (or the sealed pack being opened), then drag, and it
 * tilts in 3D towards the finger as one solid piece (no art depth), the
 * finish's shine following the tilt; letting go springs it back flat. A
 * quick tap still does what it did. Proposed, in milliseconds, pixels and
 * degrees. */
export const TILT = {
  /** A press held this long without moving starts the tilt. */
  holdMs: 200,
  /** A press that moves this far starts the tilt straight away, where a
   * move has no other meaning (the viewer, the sealed pack below its tear
   * strip, the ten-pack's front pack). On the reveal stack a quick sideways
   * move is still the swipe to the next card; there only the hold starts
   * the tilt. */
  dragPx: 8,
  /** The most the card leans, side to side and up and down. */
  maxDeg: 15,
  /** With reduced motion: a smaller lean, and no spring. */
  reducedMaxDeg: 6,
  /** The sealed pack leans this much towards a mouse moving over it, not
   * held (render session 58; the brief's "the pack tilts with the mouse");
   * holding it still leans it fully. None on touch (a finger over it is a
   * press), none with reduced motion. */
  hoverDeg: 5,
  reducedHoverDeg: 0,
  /** How fast the card catches up with the finger while held. */
  followMs: 70,
  /** The spring back to flat on release (it overshoots a little). */
  springMs: 560,
  /** With reduced motion: a short, plain ease back (no overshoot). */
  reducedReturnMs: 150,
} as const;

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

// ---- the sealed pack's tells (render session 58; the owner's 2026-11-06
// Season 0 brief, section 3, beats 1 and 2) ---------------------------------
//
// "Layered tells: hints stack gradually so the owner starts suspecting a hit
// before they know. Occasionally a tell under-promises, so it never becomes
// fully predictable." Three layers, each honest about the pack in hand:
//  1. the backdrop behind the sealed pack: its colour and pulse are a rung on
//     the ladder below, the best card's rung or, on about one pack in four
//     that holds more than a plain card, one rung LOWER. It never shows a
//     rung above the best card (an over-promise is a fake-out, and the
//     2026-10-18 rule against fake-outs stands);
//  2. the light leaking through the tear as it opens: the backdrop's rung;
//  3. the burst when the tear finishes: the best card's own rung and colour,
//     never lowered. The sparks (iff the pack holds a hit) stay as they were.
// The pack itself, and its tilt, look the same whatever is inside.
//
// Nothing here is random: the under-promise is read from the opening's own
// seed (the store's roll), so a pack shows the same tells every time it is
// replayed, and the plan stays a pure function of the opening.

/** The rungs, lowest first. Each reveal kind sits on one (the finishes in
 * the summary's best-first order, grouped). */
export const TELL_RUNGS = ["calm", "shimmer", "charged", "radiant", "overload"] as const;
export type TellRung = (typeof TELL_RUNGS)[number];

export const RUNG_OF: Record<RevealKind, TellRung> = {
  plain: "calm",
  foil: "shimmer",
  fullArt: "charged",
  altArt: "charged",
  glitch: "charged",
  secret: "radiant",
  gold: "radiant",
  prototype: "overload",
  zeroDay: "overload",
};

/** The best first, as the summary orders finishes (packPage's
 * packFinishOrder); a tournament copy reveals as a Prototype. */
const BEST_FINISH: readonly Finish[] = ["zeroDay", "prototype", "tournament", "secret", "gold", "glitch", "altArt", "fullArt", "foil", "standard"];
const RARITY_RANK_TELL: Record<string, number> = { Mythic: 3, Rare: 2, Uncommon: 1, Common: 0 };

/** The backdrop at each rung: three gradient stops (core, middle, rim), the
 * glow over it, and the pulse's period and strength. Proposed (an owner
 * check-in): each rung warmer and faster than the one below. */
export const TELL_BACKDROPS: Record<TellRung, { core: string; mid: string; rim: string; glow: string; pulseMs: number; pulse: number }> = {
  calm: { core: "#1d2350", mid: "#0b0e24", rim: "#05060d", glow: "#6a8cff", pulseMs: 7000, pulse: 0.12 },
  shimmer: { core: "#0f4a72", mid: "#0a1f3e", rim: "#04070f", glow: "#7fe3ff", pulseMs: 5600, pulse: 0.2 },
  charged: { core: "#43207a", mid: "#1a0d3c", rim: "#06040f", glow: "#c48bff", pulseMs: 4300, pulse: 0.3 },
  radiant: { core: "#6a4310", mid: "#2a170a", rim: "#080502", glow: "#ffcf6a", pulseMs: 3200, pulse: 0.42 },
  overload: { core: "#7a2a4a", mid: "#2e0a1e", rim: "#07020a", glow: "#fff1b8", pulseMs: 2200, pulse: 0.55 },
};

/** The burst's colour per reveal kind (a plain pack's takes the best card's
 * faction). */
const BURST_HEX: Record<Exclude<RevealKind, "plain">, string> = {
  foil: "#9fe0ff",
  fullArt: "#c9a2ff",
  altArt: "#ffa2e0",
  glitch: "#6dffb0",
  secret: "#ff6a9a",
  gold: "#f6d77a",
  prototype: "#fff1b8",
  zeroDay: "#ff3b3b",
};
export const FACTION_TELL_HEX: Record<string, string> = { Cortex: "#35c9ff", Aegis: "#ff7d24", Swarm: "#8bff5c", Null: "#d565ff", Neutral: "#fff0c2" };

/** One in this many packs whose best card is above plain shows its backdrop
 * a rung low. */
export const UNDER_PROMISE_ONE_IN = 4;

export interface PackTell {
  /** The best card: its place in reveal order and how it reveals. */
  bestIndex: number;
  best: RevealKind;
  bestFaction: string;
  /** The best card's rung (0 calm .. 4 overload). */
  rung: number;
  /** The backdrop's rung: `rung`, or one lower when `underPromise`. */
  backdropRung: number;
  underPromise: boolean;
  backdrop: TellRung;
  /** The burst at the end of the tear: the best card's own colour, its
   * faction's as the second colour, and its size (0-1) by the best rung. */
  burst: { colour: string; faction: string; size: number; rung: TellRung };
}

/** The best card of a pack: the best finish (the summary's order), then the
 * higher rarity, then the later card (the shine slot and the bonus card
 * come last, as they're revealed). */
export function bestCardIndex(cards: readonly Pick<RevealCard, "finish" | "face">[]): number {
  let best = 0;
  const score = (c: Pick<RevealCard, "finish" | "face">) => [BEST_FINISH.length - BEST_FINISH.indexOf(c.finish), RARITY_RANK_TELL[c.face.rarity] ?? 0];
  for (let i = 1; i < cards.length; i++) {
    const [f, r] = score(cards[i]!);
    const [bf, br] = score(cards[best]!);
    if (f! > bf! || (f === bf && r! >= br!)) best = i;
  }
  return best;
}

/** Whether the opening's seed puts this pack among the under-promised ones:
 * a 32-bit mix of the seed, one in UNDER_PROMISE_ONE_IN. */
export function underPromises(seed: number): boolean {
  let h = (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h % UNDER_PROMISE_ONE_IN === 0;
}

export function packTellOf(cards: readonly RevealCard[], seed: number): PackTell {
  if (!cards.length) {
    return { bestIndex: -1, best: "plain", bestFaction: "Neutral", rung: 0, backdropRung: 0, underPromise: false, backdrop: "calm", burst: { colour: FACTION_TELL_HEX.Neutral!, faction: FACTION_TELL_HEX.Neutral!, size: 0.35, rung: "calm" } };
  }
  const bestIndex = bestCardIndex(cards);
  const c = cards[bestIndex]!;
  const rung = TELL_RUNGS.indexOf(RUNG_OF[c.reveal]);
  const underPromise = rung > 0 && underPromises(seed);
  const backdropRung = underPromise ? rung - 1 : rung;
  const faction = FACTION_TELL_HEX[c.face.faction] ?? FACTION_TELL_HEX.Neutral!;
  return {
    bestIndex,
    best: c.reveal,
    bestFaction: c.face.faction,
    rung,
    backdropRung,
    underPromise,
    backdrop: TELL_RUNGS[backdropRung]!,
    burst: { colour: c.reveal === "plain" ? faction : BURST_HEX[c.reveal], faction, size: [0.35, 0.5, 0.7, 0.85, 1][rung]!, rung: TELL_RUNGS[rung]! },
  };
}
