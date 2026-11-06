// Sets and pack contents (ECONOMY.md "Card identity", "Rarity and finish",
// "Packs", "Prototypes" and "Chase cards"; roadmap item 5). Built session
// 36; the chase cards and S0-odds-2 went live in session 39.
//
// This file is pure: no database. `rollPack` turns a seed, the owner's pity
// state and the Prototype runs still open into a pack's cards, so the same
// inputs always give the same pack. The store (store.ts `openPack`) draws
// the seed server-side, works out pity from the owner's pack history, writes
// the copies and logs the opening with its seed and the odds version. The
// simulation (dev/packSimulation.ts) calls the same function hundreds of
// thousands of times to check the published rates.

import { CARD_REGISTRY, getCard, Rng, type Rarity } from "@ai-tcg/engine";
import { LIVE_PACK_ODDS, PACK_ODDS, PACK_ODDS_V2, type PackOdds } from "./config.js";
import { S0_GLITCH_CARDS, S0_ILLUSTRATIONS, secretCards, type SecretCard } from "./chase.js";
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
  /** (session 82) The season the set belongs to: its Prototype runs are
   * retired when that season ends (the store's endSeason). */
  season: string;
  /** The set symbol, drawn by the render beside the collector number. */
  symbol: string;
  cards: readonly SetCard[];
  /** The season's 15 Prototype runs (ECONOMY.md "Prototypes"). */
  prototypes: readonly PrototypeRun[];
  /** The secret cards, numbered above every Gold number: illustrations,
   * then the Zero-Day cards at the very top (chase.ts). */
  secrets: readonly SecretCard[];
  /** The cards with a Glitch version (Units only, chase.ts). */
  glitch: readonly string[];
}

/** Season 0's set: every ownable card (the four faction pools and the
 * neutral pool), numbered by faction, then rarity, then name. The card id
 * and copy id never appear on a card; only the collector number does. The
 * Zero-Day cards are ownable too but are secret cards, numbered at the top
 * of the secret list (chase.ts), never base-set cards: no base number, no
 * Gold version, never rolled in a plain slot. */
function seasonZeroSet(): CardSet {
  const cards = [...CARD_REGISTRY.values()].filter((c) => !c.topTier).sort(
    (a, b) =>
      FACTION_ORDER.indexOf(a.faction) - FACTION_ORDER.indexOf(b.faction) ||
      RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) ||
      a.name.localeCompare(b.name),
  );
  const total = cards.length;
  const width = Math.max(3, String(total * 2).length);
  const pad = (n: number) => String(n).padStart(width, "0");
  const set = {
    code: "S0",
    name: "Season Zero",
    season: "S0",
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
  // The chase lists the owner approved 2026-10-18 (answers 1 and 3).
  return { ...set, secrets: secretCards(set, S0_ILLUSTRATIONS), glitch: glitchList(set, S0_GLITCH_CARDS) };
}

/** A set's Glitch list, checked: every card is a Unit of the set, none twice. */
function glitchList(set: Pick<CardSet, "code" | "cards">, ids: readonly string[]): readonly string[] {
  for (const id of ids) {
    if (!set.cards.some((c) => c.cardId === id)) throw new Error(`Glitch version of ${id}: not a card of ${set.code}`);
    if (getCard(id)?.type !== "Unit") throw new Error(`Glitch version of ${id}: Units only`);
  }
  if (new Set(ids).size !== ids.length) throw new Error("a Glitch card is listed twice");
  return ids;
}

export const CARD_SETS: ReadonlyMap<string, CardSet> = new Map([["S0", seasonZeroSet()]]);

/** The sets of a season (the ones whose Prototype runs its end retires). */
export function seasonSets(season: string): CardSet[] {
  return [...CARD_SETS.values()].filter((s) => s.season === season);
}

export function cardSet(code: string): CardSet {
  const set = CARD_SETS.get(code);
  if (!set) throw new Error(`no card set "${code}"`);
  return set;
}

// ---- rolling a pack ----

export type PackSlot = "Common" | "Uncommon" | "Rare" | "shine" | "bonus";

export interface PackPull {
  /** The card: the base card for every finish and for an illustration;
   * for a Zero-Day pull, its secret code (the card takes that id). */
  cardId: string;
  rarity: Rarity;
  slot: PackSlot;
  finish: Finish;
  /** The number printed on this copy ("056/096", the Gold number, or a
   * secret card's number above every Gold number). */
  collectorNumber: string;
  /** A secret card's code ("S0-SR07", "S0-ZD2"), on secret and zeroDay pulls. */
  secret?: string;
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
  /** The starter guarantee made the shine slot a hit: the owner's last
   * starter pack, after starter packs with none (owner 2026-10-19, render
   * session 28 call 9). Absent when it didn't apply, or when hit pity was
   * already due and forced the same thing. */
  starterHit?: true;
}

/** What the store asks of one roll beyond pity. */
export interface RollOptions {
  /** Make the shine slot Full Art or better, as hit pity does, in the
   * table's own proportions (the starter guarantee). */
  starterHit?: boolean;
}

/** Finishes that count as a hit, "Full Art or better", for the pity timer
 * and the owner's 20% target. S0-odds-1 packs only ever roll the first four
 * of the chase-era list below, so one list serves both tables. Glitch counts
 * (owner 2026-10-18, call 7.1); Foil doesn't (the common "lite" hit). */
export const FULL_ART_OR_BETTER: readonly Finish[] = ["fullArt", "glitch", "altArt", "gold", "secret", "zeroDay", "prototype"];

export function pityDue(state: PityState, odds: PackOdds = LIVE_PACK_ODDS): { fullArt: boolean; mythic: boolean } {
  return {
    fullArt: state.packsSinceFullArt >= odds.pity.fullArtAfter,
    mythic: state.packsSinceMythic >= odds.pity.mythicAfter,
  };
}

/** The pity state after a pack with these pulls. A Zero-Day pull counts as
 * a Mythic (owner 2026-10-18, answer 2). */
export function nextPity(state: PityState, pulls: readonly Pick<PackPull, "finish" | "rarity">[]): PityState {
  return {
    packsSinceFullArt: pulls.some((p) => FULL_ART_OR_BETTER.includes(p.finish)) ? 0 : state.packsSinceFullArt + 1,
    packsSinceMythic: pulls.some((p) => p.rarity === "Mythic") ? 0 : state.packsSinceMythic + 1,
  };
}

/**
 * One pack under `odds` (an odds table from config.ts: `PACK_ODDS` is
 * S0-odds-1, `PACK_ODDS_V2` S0-odds-2, live since session 39). Both tables
 * share the pack's shape: 2 Commons, 1 Uncommon, the Rare slot (a Mythic 1
 * time in 8), the shine slot (the only slot with a finish), and a Prototype
 * as a bonus 6th card 1 pack in 1,000. A Jackpot pack (1 in 2,000) rolls
 * Foil or better on every card. Pity, when due, makes the shine slot Full
 * Art or better and the Rare slot a Mythic.
 *
 * Where the tables differ:
 *  - S0-odds-1: the shine slot rolls its finish, then a card by the slot's
 *    rarity weights (Alt Art from the Rares and Mythics); a Jackpot card
 *    rolls Foil or better by its rarity.
 *  - S0-odds-2 (owner 2026-10-16 items 2-4, accepted 2026-10-18): the shine
 *    slot rolls its finish, then a card that can carry it: Standard and
 *    Foil any card by the slot's rarity weights; Full Art, Alt Art and Gold
 *    by their own rarity weights; Glitch from the set's Glitch list; secret
 *    an illustration; Zero-Day one of the 3. A Jackpot card rolls Foil or
 *    better among the finishes its own card can carry; secret cards come
 *    only in the shine slot.
 * Each table draws its random numbers in the order it always has, so every
 * logged opening reproduces from its seed and odds version (pinned by a
 * seed test in packs.test.ts).
 *
 * `prototypesLeft` is how many copies each run still has; a Prototype's run
 * is picked in proportion to them, and if all are used up the bonus is a
 * Gold instead. Same arguments, same pack.
 *
 * `options.starterHit` (the starter guarantee) makes the shine slot a hit
 * exactly as a due hit pity does: the same draws, so a pack without it
 * rolls as it always has.
 */
export function rollPack(
  seed: number,
  set: CardSet,
  pity: PityState,
  prototypesLeft: ReadonlyMap<string, number>,
  odds: PackOdds,
  options: RollOptions = {},
): PackRoll {
  const rng = new Rng(seed);
  const due = pityDue(pity, odds);
  const starterHit = options.starterHit === true && !due.fullArt;
  const hitDue = due.fullArt || starterHit;
  const byRarity = new Map<Rarity, SetCard[]>(RARITIES.map((r) => [r, set.cards.filter((c) => c.rarity === r)]));
  const pickOf = (rarity: Rarity) => rng.pick(byRarity.get(rarity)!);
  const jackpot = rng.next() < odds.jackpotPack;

  const pulls: PackPull[] = [];
  const add = (card: SetCard, slot: PackSlot, finish: Finish) =>
    pulls.push({ cardId: card.cardId, rarity: card.rarity, slot, finish, collectorNumber: finish === "gold" ? card.goldNumber : card.collectorNumber });
  const jackpotFinish = (card: SetCard): Finish =>
    odds.version === "S0-odds-1" ? foilOrBetterV1(rng, odds, card.rarity) : jackpotFinishV2(rng, odds, set, card);

  for (const rarity of ["Common", "Uncommon"] as const) {
    for (let i = 0; i < odds.slots[rarity]; i++) {
      const card = pickOf(rarity);
      add(card, rarity, jackpot ? jackpotFinish(card) : "standard");
    }
  }
  const rareCard = pickOf(due.mythic || rng.next() < odds.mythicInRareSlot ? "Mythic" : "Rare");
  add(rareCard, "Rare", jackpot ? jackpotFinish(rareCard) : "standard");

  // The shine slot: the finish first, then a card that can carry it.
  if (odds.version === "S0-odds-1") {
    const finish = hitDue ? fullArtOrBetterV1(rng, odds) : jackpot ? foilOrBetterV1(rng, odds, undefined) : anyFinishV1(rng, odds);
    const rarities = finish === "altArt" ? (["Rare", "Mythic"] as const) : RARITIES;
    add(pickOf(weightedPick(rng, rarities.map((r) => [r, odds.shineRarity[r]] as const))), "shine", finish);
  } else {
    const finish = shineFinishV2(rng, odds, hitDue ? "hit" : jackpot ? "foilOrBetter" : "any");
    if (finish === "secret" || finish === "zeroDay") {
      const s = rng.pick(set.secrets.filter((x) => (finish === "secret" ? x.kind === "illustration" : x.kind === "zeroDay")));
      pulls.push({ cardId: s.cardId, rarity: s.rarity, slot: "shine", finish, collectorNumber: s.collectorNumber, secret: s.code });
    } else if (finish === "glitch") {
      const cardId = rng.pick([...set.glitch]);
      add(set.cards.find((c) => c.cardId === cardId)!, "shine", "glitch");
    } else {
      const weights =
        finish === "fullArt" ? odds.fullArtRarity : finish === "altArt" ? odds.altArtRarity : finish === "gold" ? odds.goldRarity : odds.shineRarity;
      add(pickOf(weightedPick(rng, Object.entries(weights) as [Rarity, number][])), "shine", finish);
    }
  }

  let prototypeFallbackGold = false;
  if (rng.next() < odds.prototypeBonus) {
    const open = [...prototypesLeft.entries()].filter(([, left]) => left > 0);
    if (open.length === 0) {
      prototypeFallbackGold = true;
      // S0-odds-1 draws the fallback Gold's rarity by the shine slot's
      // weights; S0-odds-2 by Gold's own (Rares and Mythics).
      const weights = odds.version === "S0-odds-1" ? odds.shineRarity : odds.goldRarity;
      add(pickOf(weightedPick(rng, Object.entries(weights) as [Rarity, number][])), "bonus", "gold");
    } else {
      const code = weightedPick(rng, open.map(([c, left]) => [c, left] as const));
      const run = set.prototypes.find((p) => p.code === code)!;
      const card = set.cards.find((c) => c.cardId === run.cardId)!;
      pulls.push({ cardId: card.cardId, rarity: card.rarity, slot: "bonus", finish: "prototype", collectorNumber: card.collectorNumber, prototypeRun: code });
    }
  }
  return { pulls, jackpot, pity: due, prototypeFallbackGold, ...(starterHit ? { starterHit: true as const } : {}) };
}

// S0-odds-1's finish rolls.

/** The shine slot's ordinary finish roll. */
function anyFinishV1(rng: Rng, odds: typeof PACK_ODDS): Finish {
  const { foil, fullArt, altArt, gold } = odds.shineFinish;
  return weightedPick(rng, [
    ["standard", 100 - foil - fullArt - altArt - gold],
    ["foil", foil],
    ["fullArt", fullArt],
    ["altArt", altArt],
    ["gold", gold],
  ] as const);
}

/** Pity: Full Art or better, in the table's own proportions. */
function fullArtOrBetterV1(rng: Rng, odds: typeof PACK_ODDS): Finish {
  const { fullArt, altArt, gold } = odds.shineFinish;
  return weightedPick(rng, [["fullArt", fullArt], ["altArt", altArt], ["gold", gold]] as const);
}

/** A Jackpot card: Foil or better, in the table's own proportions. Alt Art
 * only on a Rare or Mythic (`rarity` undefined: the card isn't drawn yet,
 * and the shine slot then draws a Rare or Mythic for it). */
function foilOrBetterV1(rng: Rng, odds: typeof PACK_ODDS, rarity: Rarity | undefined): Finish {
  const { foil, fullArt, altArt, gold } = odds.shineFinish;
  const alt = rarity === undefined || rarity === "Rare" || rarity === "Mythic";
  return weightedPick(rng, [["foil", foil], ["fullArt", fullArt], ...(alt ? ([["altArt", altArt]] as const) : []), ["gold", gold]] as const);
}

// S0-odds-2's finish rolls.

/** A Jackpot card's finish: Foil or better among what this card can carry. */
function jackpotFinishV2(rng: Rng, odds: typeof PACK_ODDS_V2, set: CardSet, card: SetCard): Finish {
  const f = odds.shineFinish;
  const table: [Finish, number][] = [["foil", f.foil]];
  if (card.rarity !== "Common") table.push(["fullArt", f.fullArt]);
  if (set.glitch.includes(card.cardId)) table.push(["glitch", f.glitch]);
  if (card.rarity === "Rare" || card.rarity === "Mythic") table.push(["altArt", f.altArt], ["gold", f.gold]);
  return weightedPick(rng, table);
}

/** The shine slot's finish: the whole table, Foil or better (Jackpot), or
 * a hit only (pity), each in the table's own proportions. */
function shineFinishV2(rng: Rng, odds: typeof PACK_ODDS_V2, mode: "any" | "foilOrBetter" | "hit"): Finish {
  const f = odds.shineFinish;
  const hits: [Finish, number][] = [
    ["fullArt", f.fullArt],
    ["glitch", f.glitch],
    ["altArt", f.altArt],
    ["secret", f.secret],
    ["gold", f.gold],
    ["zeroDay", f.zeroDay],
  ];
  if (mode === "hit") return weightedPick(rng, hits);
  if (mode === "foilOrBetter") return weightedPick(rng, [["foil", f.foil], ...hits]);
  const standard = 100 - Object.values(f).reduce((s, x) => s + x, 0);
  return weightedPick(rng, [["standard", standard], ["foil", f.foil], ...hits]);
}

/** The shine slot's base hit rate under `odds`, in percent (before pity). */
export function baseHitPercent(odds: PackOdds = LIVE_PACK_ODDS): number {
  // Every shine finish but Foil is a hit; Standard is not in the table.
  return Object.entries(odds.shineFinish).reduce((sum, [finish, pct]) => (finish === "foil" ? sum : sum + pct), 0);
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

/** The secret card with this code ("S0-SR07", "S0-ZD2"), in any set. */
export function secretCardOf(code: string): SecretCard | undefined {
  for (const set of CARD_SETS.values()) {
    const s = set.secrets.find((x) => x.code === code);
    if (s) return s;
  }
  return undefined;
}

