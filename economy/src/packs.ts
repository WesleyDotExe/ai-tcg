// Sets and pack contents (ECONOMY.md "Card identity", "Rarity and finish",
// "Packs" and "Prototypes"; roadmap item 5). Built session 36.
//
// This file is pure: no database. `rollPack` turns a seed, the owner's pity
// state and the Prototype runs still open into a pack's cards, so the same
// inputs always give the same pack. The store (store.ts `openPack`) draws
// the seed server-side, works out pity from the owner's pack history, writes
// the copies and logs the opening with its seed and the odds version. The
// simulation (dev/packSimulation.ts) calls the same function hundreds of
// thousands of times to check the published rates.

import { CARD_REGISTRY, Rng, type Rarity } from "@ai-tcg/engine";
import { PACK_ODDS } from "./config.js";
import type { Finish } from "./schema.js";

const RARITIES: readonly Rarity[] = ["Common", "Uncommon", "Rare", "Mythic"];
const FACTION_ORDER = ["Cortex", "Swarm", "Aegis", "Null", "Neutral"];

// ---- sets ----

export interface SetCard {
  cardId: string;
  name: string;
  rarity: Rarity;
  /** "056/096": the number printed on the card face. */
  collectorNumber: string;
  /** A Gold copy's number, above the set total ("152/096"): the set's
   * secret cards. */
  goldNumber: string;
}

export interface PrototypeRun {
  /** "S0-P01": the series code on every copy of the run. */
  code: string;
  cardId: string;
  runSize: number;
}

export interface CardSet {
  code: string;
  name: string;
  /** The set symbol, drawn by the render beside the collector number. */
  symbol: string;
  cards: readonly SetCard[];
  /** The season's 15 Prototype runs (ECONOMY.md "Prototypes"). */
  prototypes: readonly PrototypeRun[];
}

/** Season 0's set: every ownable card (the four faction pools and the
 * neutral pool), numbered by faction, then rarity, then name. The card id
 * and copy id never appear on a card; only the collector number does. */
function seasonZeroSet(): CardSet {
  const cards = [...CARD_REGISTRY.values()].sort(
    (a, b) =>
      FACTION_ORDER.indexOf(a.faction) - FACTION_ORDER.indexOf(b.faction) ||
      RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) ||
      a.name.localeCompare(b.name),
  );
  const total = cards.length;
  const width = Math.max(3, String(total * 2).length);
  const pad = (n: number) => String(n).padStart(width, "0");
  return {
    code: "S0",
    name: "Season Zero",
    symbol: "S0-boot",
    cards: cards.map((c, i) => ({
      cardId: c.id,
      name: c.name,
      rarity: c.rarity,
      collectorNumber: `${pad(i + 1)}/${pad(total)}`,
      goldNumber: `${pad(total + i + 1)}/${pad(total)}`,
    })),
    // The pyramid is the owner's (4 x /250, 3 x /100, 3 x /50, 2 x /25, /10,
    // /5 and one 1/1: 1,516 copies). WHICH cards get a run is session 36's
    // proposal for the owner's check-in: every faction's Mythic at the top,
    // Rares below, all five pools represented. The owner checks the art
    // previews before a season's list goes live.
    prototypes: [
      ["NL-014", 1],
      ["AG-014", 5],
      ["CX-024", 10],
      ["SW-006", 25],
      ["NL-013", 25],
      ["SW-004", 50],
      ["AG-013", 50],
      ["CX-007", 50],
      ["SW-020", 100],
      ["NL-011", 100],
      ["NT-008", 100],
      ["CX-003", 250],
      ["AG-011", 250],
      ["SW-010", 250],
      ["NL-019", 250],
    ].map(([cardId, runSize], i) => ({ code: `S0-P${String(i + 1).padStart(2, "0")}`, cardId: cardId as string, runSize: runSize as number })),
  };
}

export const CARD_SETS: ReadonlyMap<string, CardSet> = new Map([["S0", seasonZeroSet()]]);

export function cardSet(code: string): CardSet {
  const set = CARD_SETS.get(code);
  if (!set) throw new Error(`no card set "${code}"`);
  return set;
}

// ---- rolling a pack ----

export type PackSlot = "Common" | "Uncommon" | "Rare" | "shine" | "bonus";

export interface PackPull {
  cardId: string;
  rarity: Rarity;
  slot: PackSlot;
  finish: Finish;
  /** The number printed on this copy ("056/096", or the Gold number). */
  collectorNumber: string;
  /** Only on a Prototype: its run. The store gives it the next serial. */
  prototypeRun?: string;
}

export interface PityState {
  /** Opened packs in a row, most recent last, with no Full Art or better. */
  packsSinceFullArt: number;
  /** Opened packs in a row with no Mythic. */
  packsSinceMythic: number;
}

/** What a roll forced, so the opening log and the result can say so. */
export interface PackRoll {
  pulls: PackPull[];
  jackpot: boolean;
  pity: { fullArt: boolean; mythic: boolean };
  /** A Prototype was due but every run was used up, so the bonus is Gold. */
  prototypeFallbackGold: boolean;
}

/** Finishes that count as "Full Art or better" for the pity timer. */
export const FULL_ART_OR_BETTER: readonly Finish[] = ["fullArt", "altArt", "gold", "prototype"];

export function pityDue(state: PityState): { fullArt: boolean; mythic: boolean } {
  return {
    fullArt: state.packsSinceFullArt >= PACK_ODDS.pity.fullArtAfter,
    mythic: state.packsSinceMythic >= PACK_ODDS.pity.mythicAfter,
  };
}

/** The pity state after a pack with these pulls. */
export function nextPity(state: PityState, pulls: readonly Pick<PackPull, "finish" | "rarity">[]): PityState {
  return {
    packsSinceFullArt: pulls.some((p) => FULL_ART_OR_BETTER.includes(p.finish)) ? 0 : state.packsSinceFullArt + 1,
    packsSinceMythic: pulls.some((p) => p.rarity === "Mythic") ? 0 : state.packsSinceMythic + 1,
  };
}

/**
 * One pack: 2 Commons, 1 Uncommon, the Rare slot (a Mythic 1 time in 8),
 * and the shine slot (any rarity, and the only slot with a finish), plus a
 * Prototype as a bonus 6th card 1 pack in 1,000. A Jackpot pack (1 in
 * 2,000) rolls Foil or better on every card. Pity, when due, makes the
 * shine slot Full Art or better and the Rare slot a Mythic.
 *
 * `prototypesLeft` is how many copies each run still has; a Prototype's run
 * is picked in proportion to them, and if all are used up the bonus is a
 * Gold instead. Same arguments, same pack.
 */
export function rollPack(
  seed: number,
  set: CardSet,
  pity: PityState,
  prototypesLeft: ReadonlyMap<string, number>,
): PackRoll {
  const rng = new Rng(seed);
  const due = pityDue(pity);
  const byRarity = new Map<Rarity, SetCard[]>(RARITIES.map((r) => [r, set.cards.filter((c) => c.rarity === r)]));
  const pickOf = (rarity: Rarity) => rng.pick(byRarity.get(rarity)!);
  const jackpot = rng.next() < PACK_ODDS.jackpotPack;

  const pulls: PackPull[] = [];
  const add = (card: SetCard, slot: PackSlot, finish: Finish) =>
    pulls.push({ cardId: card.cardId, rarity: card.rarity, slot, finish, collectorNumber: finish === "gold" ? card.goldNumber : card.collectorNumber });

  for (const rarity of ["Common", "Uncommon"] as const) {
    for (let i = 0; i < PACK_ODDS.slots[rarity]; i++) {
      const card = pickOf(rarity);
      add(card, rarity, jackpot ? foilOrBetter(rng, card.rarity) : "standard");
    }
  }
  const rareSlotRarity: Rarity = due.mythic || rng.next() < PACK_ODDS.mythicInRareSlot ? "Mythic" : "Rare";
  const rareCard = pickOf(rareSlotRarity);
  add(rareCard, "Rare", jackpot ? foilOrBetter(rng, rareCard.rarity) : "standard");

  // The shine slot: the finish first, then a card that can carry it (Alt
  // Art exists only on Rares and Mythics).
  const shineFinish = due.fullArt ? fullArtOrBetter(rng) : jackpot ? foilOrBetter(rng, undefined) : anyFinish(rng);
  const shineRarities = shineFinish === "altArt" ? (["Rare", "Mythic"] as const) : RARITIES;
  const shineRarity = weightedPick(rng, shineRarities.map((r) => [r, PACK_ODDS.shineRarity[r]] as const));
  add(pickOf(shineRarity), "shine", shineFinish);

  let prototypeFallbackGold = false;
  if (rng.next() < PACK_ODDS.prototypeBonus) {
    const open = [...prototypesLeft.entries()].filter(([, left]) => left > 0);
    if (open.length === 0) {
      prototypeFallbackGold = true;
      const card = weightedPick(rng, RARITIES.map((r) => [r, PACK_ODDS.shineRarity[r]] as const));
      add(pickOf(card), "bonus", "gold");
    } else {
      const code = weightedPick(rng, open.map(([c, left]) => [c, left] as const));
      const run = set.prototypes.find((p) => p.code === code)!;
      const card = set.cards.find((c) => c.cardId === run.cardId)!;
      pulls.push({ cardId: card.cardId, rarity: card.rarity, slot: "bonus", finish: "prototype", collectorNumber: card.collectorNumber, prototypeRun: code });
    }
  }
  return { pulls, jackpot, pity: due, prototypeFallbackGold };
}

/** The shine slot's ordinary finish roll. */
function anyFinish(rng: Rng): Finish {
  const { foil, fullArt, altArt, gold } = PACK_ODDS.shineFinish;
  return weightedPick(rng, [
    ["standard", 100 - foil - fullArt - altArt - gold],
    ["foil", foil],
    ["fullArt", fullArt],
    ["altArt", altArt],
    ["gold", gold],
  ] as const);
}

/** Pity: Full Art or better, in the table's own proportions. */
function fullArtOrBetter(rng: Rng): Finish {
  const { fullArt, altArt, gold } = PACK_ODDS.shineFinish;
  return weightedPick(rng, [["fullArt", fullArt], ["altArt", altArt], ["gold", gold]] as const);
}

/** A Jackpot card: Foil or better, in the table's own proportions. Alt Art
 * only on a Rare or Mythic (`rarity` undefined: the card isn't drawn yet,
 * and the shine slot then draws a Rare or Mythic for it). */
function foilOrBetter(rng: Rng, rarity: Rarity | undefined): Finish {
  const { foil, fullArt, altArt, gold } = PACK_ODDS.shineFinish;
  const alt = rarity === undefined || rarity === "Rare" || rarity === "Mythic";
  return weightedPick(rng, [["foil", foil], ["fullArt", fullArt], ...(alt ? ([["altArt", altArt]] as const) : []), ["gold", gold]] as const);
}

export function weightedPick<T>(rng: Rng, table: readonly (readonly [T, number])[]): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [item, w] of table) if ((roll -= w) < 0) return item;
  return table[table.length - 1]![0];
}

/** The card behind a set card id, for callers that need its name. */
export function setCardOf(set: CardSet, cardId: string): SetCard | undefined {
  return set.cards.find((c) => c.cardId === cardId);
}

