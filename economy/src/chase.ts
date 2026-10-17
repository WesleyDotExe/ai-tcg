// Chase cards: secret cards, the Glitch tier and S0-odds-2 (owner
// 2026-10-16, "more collectable chase cards", items 1-4; the build order the
// owner accepted 2026-10-17, option A). Session 38.
//
// A PROPOSAL, NOT LIVE. Nothing here is used by the store: openPack still
// rolls S0-odds-1 with packs.ts `rollPack`, and every pack already opened
// keeps reproducing from its seed. This file holds what the owner is asked
// to approve:
//  - the secret-card list: 33 illustration versions of chosen cards plus the
//    3 Zero-Day slots, numbered above the Gold numbers, each its own
//    collection entry with a placeholder art slot;
//  - the Glitch tier: which cards qualify, and how it looks;
//  - S0-odds-2: the shine slot pointed at chosen cards (owner item 4), with
//    the new tiers, Zero-Day at about 1 pack in 500.
// `rollPackV2` rolls a pack against it, so dev/packSimulation2.ts can measure
// it against the owner's targets with the same machinery as S0-odds-1.
//
// Going live needs, after the owner's approval: schema v10 (the new
// finishes and secret entries on copies), openPack switched to the new
// table, the binder and checklist entries, and the 3 Zero-Day cards
// themselves (build-order step 2: the "choose one" mechanic first).

import { getCard, Rng, type Rarity } from "@ai-tcg/engine";
import { PACK_ODDS } from "./config.js";
import { pityDue, weightedPick, type CardSet, type PackSlot, type PityState, type SetCard } from "./packs.js";
import type { Finish } from "./schema.js";

const RARITIES: readonly Rarity[] = ["Common", "Uncommon", "Rare", "Mythic"];

/** A finish under S0-odds-2. Glitch is a code-drawn variant of a listed
 * card; secret and zeroDay pulls are secret cards (their own entries). */
export type ChaseFinish = Finish | "glitch" | "secret" | "zeroDay";

// ---- the secret cards ----

export interface SecretCard {
  /** "S0-SR01" ... "S0-SR33" for illustrations, "S0-ZD1" ... "S0-ZD3". */
  code: string;
  kind: "illustration" | "zeroDay";
  /** The card an illustration is a version of. A Zero-Day card is its own
   * card, not designed yet (build-order step 2), so it has none. */
  cardId?: string;
  name: string;
  /** Gameplay rarity: the base card's for an illustration; Zero-Day cards
   * count as Mythic (proposal). */
  rarity: Rarity;
  /** "193/096": above the set total and above every Gold number. */
  collectorNumber: string;
  /** Placeholder until the owner-funded art pass, as the signature art pool. */
  art: string;
  /** Zero-Day cards move and reach past the frame (owner item 2). */
  animated: boolean;
}

/** The illustration versions PROPOSED for Season 0, for the owner to approve
 * (owner item 1: "the owner approves which cards get secret versions").
 * Every faction's Mythic; the Rares that define each faction's plan; a few
 * Uncommons and Commons whose names are scenes worth painting (an
 * illustration of a humble card is part of the charm, as in the benchmark).
 * 8 Cortex, 7 Swarm, 7 Aegis, 7 Null, 4 Neutral. */
export const S0_ILLUSTRATIONS: readonly string[] = [
  // Cortex
  "CX-024", // Quorum Arbiter (Mythic)
  "CX-007", // Mainframe Core
  "CX-003", // Recursive Construct
  "CX-011", // Overload Capacitor
  "CX-002", // Firewall Sentinel (Uncommon)
  "CX-010", // Watchtower Relay (Uncommon)
  "CX-001", // Signal Drone (Common)
  "CX-015", // Init Daemon (Common)
  // Swarm
  "SW-006", // Hive Mother (Mythic)
  "SW-020", // Bloodswarm Alpha
  "SW-004", // Overclock Beast
  "SW-010", // Dormant Egg Sac
  "SW-011", // Molted Stalker (Uncommon)
  "SW-007", // Spore Cluster (Uncommon)
  "SW-001", // Swarm Larva (Common)
  // Aegis
  "AG-014", // Prime Aegis (Mythic)
  "AG-013", // Aegis Warden
  "AG-011", // Latent Ward
  "AG-012", // Lockdown Field
  "AG-020", // Reinforced Bastion (Uncommon)
  "AG-005", // Perimeter Turret (Uncommon)
  "AG-001", // Aegis Cadet (Common)
  // Null
  "NL-014", // Null Singularity (Mythic)
  "NL-013", // Kernel Panic
  "NL-011", // Entropy Harvester
  "NL-012", // Segmentation Fault
  "NL-005", // Fork Bomb (Uncommon)
  "NL-020", // Garbage Collector (Uncommon)
  "NL-001", // Glitch Seed (Common)
  // Neutral
  "NT-008", // Uplink Tower (Rare)
  "NT-006", // Power Reserve (Uncommon)
  "NT-003", // Relay Courier (Common)
  "NT-009", // Scrap Recycler (Common)
];

/** How many Zero-Day cards a season has (owner 2026-10-16: 3 per season). */
export const ZERO_DAY_PER_SEASON = 3;

/** The secret cards of `set`: illustrations, then the Zero-Day slots at the
 * very top of the numbering. */
export function secretCards(set: CardSet, illustrations: readonly string[] = S0_ILLUSTRATIONS): SecretCard[] {
  const total = set.cards.length;
  const width = Math.max(3, String(total * 2 + illustrations.length + ZERO_DAY_PER_SEASON).length);
  const pad = (n: number) => String(n).padStart(width, "0");
  // Gold numbers run total+1 .. 2*total; secret numbers start after them.
  let next = 2 * total + 1;
  const out: SecretCard[] = illustrations.map((cardId, i) => {
    const card = set.cards.find((c) => c.cardId === cardId);
    if (!card) throw new Error(`illustration of ${cardId}: not a card of ${set.code}`);
    const code = `${set.code}-SR${String(i + 1).padStart(2, "0")}`;
    return { code, kind: "illustration", cardId, name: card.name, rarity: card.rarity, collectorNumber: `${pad(next++)}/${pad(total)}`, art: `placeholder:secret/${code}`, animated: false };
  });
  for (let i = 1; i <= ZERO_DAY_PER_SEASON; i++) {
    const code = `${set.code}-ZD${i}`;
    out.push({ code, kind: "zeroDay", name: `Zero-Day ${i} (not designed yet)`, rarity: "Mythic", collectorNumber: `${pad(next++)}/${pad(total)}`, art: `placeholder:zero-day/${code}`, animated: true });
  }
  if (new Set(illustrations).size !== illustrations.length) throw new Error("an illustration is listed twice");
  return out;
}

// ---- the Glitch tier ----

/** The cards PROPOSED to get a Glitch version in Season 0 (owner item 3:
 * "propose which cards qualify"). Units only: a corrupted creature or
 * machine reads as a glitch; a corrupted spell frame reads as a rendering
 * bug. Four per pool, leaning on each faction's Mythic and the units its
 * decks are built around; Neutral has four units in all, so all four. */
export const S0_GLITCH_CARDS: readonly string[] = [
  "CX-024", "CX-003", "CX-002", "CX-001", // Quorum Arbiter, Recursive Construct, Firewall Sentinel, Signal Drone
  "SW-006", "SW-004", "SW-005", "SW-011", // Hive Mother, Overclock Beast, Corrosive Spitter, Molted Stalker
  "AG-014", "AG-013", "AG-005", "AG-007", // Prime Aegis, Aegis Warden, Perimeter Turret, Aegis Sentinel
  "NL-014", "NL-013", "NL-011", "NL-016", // Null Singularity, Kernel Panic, Entropy Harvester, Zombie Process
  "NT-008", "NT-003", "NT-009", "NT-007", // Uplink Tower, Relay Courier, Scrap Recycler, Commodity Rack
];

/** How a Glitch version is drawn (for the render lane; all in code, no new
 * art, owner item 3). Recorded here so the proposal is one place. */
export const GLITCH_LOOK = [
  "the card's own art and frame, with its faction palette rotated to a corrupted one (hue shift, crushed channels)",
  "horizontal scanlines and a slow vertical roll",
  "block-displacement tears that jump every few seconds, and a brief RGB channel split on reveal",
  "the collector number keeps the base card's number with a glitch mark; it is not numbered above the total",
] as const;

// ---- S0-odds-2 ----

/**
 * PROPOSED odds table S0-odds-2 (not live). What stays from S0-odds-1: the
 * 5 slots, a Mythic in 1 Rare slot in 8, only the shine slot rolling a
 * finish, the Jackpot pack at 1 in 2,000 (Foil or better throughout), the
 * Prototype bonus at 1 in 1,000, both pity timers at 10 and 40.
 *
 * What changes (owner items 2-4): the shine slot's finish table gains
 * Glitch, secret illustrations and Zero-Day, and each special version draws
 * its card from a chosen list instead of the slot's 60/25/12/3 rarity
 * weights, so Full Art and up land on cards people want. Foil stays on any
 * card. The percentages are tuned with dev/packSimulation2.ts against the
 * owner's targets (about 20% of packs with Full Art or better, pity
 * included), never raised to make a test pass.
 */
export const PACK_ODDS_V2 = {
  version: "S0-odds-2",
  slots: PACK_ODDS.slots,
  mythicInRareSlot: PACK_ODDS.mythicInRareSlot,
  /** Standard and Foil shine cards: any card, by these rarity weights (as S0-odds-1). */
  shineRarity: PACK_ODDS.shineRarity,
  /** The shine slot's finish, in percent; Standard is what's left. */
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

export type ChaseOdds = typeof PACK_ODDS_V2;

/** Under S0-odds-2, what counts as a hit ("Full Art or better") for the
 * pity timer and the owner's 20% target. Glitch counts: it is a chase
 * version and its own collection entry (proposal). Foil doesn't: it stays
 * the common "lite" hit (owner). */
export const HIT_FINISHES: readonly ChaseFinish[] = ["fullArt", "glitch", "altArt", "gold", "secret", "zeroDay", "prototype"];

export interface ChasePull {
  /** The base card (illustrations and every finish), or a Zero-Day code. */
  cardId: string;
  rarity: Rarity;
  slot: PackSlot;
  finish: ChaseFinish;
  collectorNumber: string;
  /** A secret card's code ("S0-SR07", "S0-ZD2"). */
  secret?: string;
  prototypeRun?: string;
}

export interface ChaseRoll {
  pulls: ChasePull[];
  jackpot: boolean;
  pity: { fullArt: boolean; mythic: boolean };
  prototypeFallbackGold: boolean;
}

/** The pity state after a pack under S0-odds-2 (hits per HIT_FINISHES). */
export function nextPityV2(state: PityState, pulls: readonly Pick<ChasePull, "finish" | "rarity">[]): PityState {
  return {
    packsSinceFullArt: pulls.some((p) => HIT_FINISHES.includes(p.finish)) ? 0 : state.packsSinceFullArt + 1,
    packsSinceMythic: pulls.some((p) => p.rarity === "Mythic") ? 0 : state.packsSinceMythic + 1,
  };
}

export interface ChaseLists {
  secrets: readonly SecretCard[];
  glitch: readonly string[];
}

export function seasonZeroChase(set: CardSet): ChaseLists {
  for (const id of S0_GLITCH_CARDS) {
    if (!set.cards.some((c) => c.cardId === id)) throw new Error(`Glitch version of ${id}: not a card of ${set.code}`);
    if (getCard(id)?.type !== "Unit") throw new Error(`Glitch version of ${id}: Units only`);
  }
  if (new Set(S0_GLITCH_CARDS).size !== S0_GLITCH_CARDS.length) throw new Error("a Glitch card is listed twice");
  return { secrets: secretCards(set), glitch: S0_GLITCH_CARDS };
}

/**
 * One pack under S0-odds-2. The same shape as packs.ts `rollPack`: 2
 * Commons, 1 Uncommon, the Rare slot, the shine slot, and the Prototype
 * bonus; Jackpot and pity as there. Kept separate from `rollPack` so that
 * S0-odds-1 packs keep reproducing from their seeds exactly.
 *
 * The shine slot rolls its finish first, then a card that can carry it:
 * Standard and Foil any card by the slot's rarity weights; Full Art, Alt
 * Art and Gold a card by their own rarity weights; Glitch a card from the
 * Glitch list; secret an illustration; Zero-Day one of the 3. In a Jackpot
 * pack the other four cards roll Foil or better among the finishes their
 * own card can carry (secret cards come only in the shine slot).
 */
export function rollPackV2(
  seed: number,
  set: CardSet,
  chase: ChaseLists,
  pity: PityState,
  prototypesLeft: ReadonlyMap<string, number>,
  odds: ChaseOdds = PACK_ODDS_V2,
): ChaseRoll {
  const rng = new Rng(seed);
  const due = pityDue(pity);
  const byRarity = new Map<Rarity, SetCard[]>(RARITIES.map((r) => [r, set.cards.filter((c) => c.rarity === r)]));
  const pickOf = (rarity: Rarity) => rng.pick(byRarity.get(rarity)!);
  const glitchable = new Set(chase.glitch);
  const jackpot = rng.next() < odds.jackpotPack;

  const pulls: ChasePull[] = [];
  const addCard = (card: SetCard, slot: PackSlot, finish: ChaseFinish) =>
    pulls.push({ cardId: card.cardId, rarity: card.rarity, slot, finish, collectorNumber: finish === "gold" ? card.goldNumber : card.collectorNumber });

  /** A Jackpot card's finish: Foil or better among what this card can carry. */
  const jackpotFinish = (card: SetCard): ChaseFinish => {
    const f = odds.shineFinish;
    const table: [ChaseFinish, number][] = [["foil", f.foil]];
    if (card.rarity !== "Common") table.push(["fullArt", f.fullArt]);
    if (glitchable.has(card.cardId)) table.push(["glitch", f.glitch]);
    if (card.rarity === "Rare" || card.rarity === "Mythic") table.push(["altArt", f.altArt], ["gold", f.gold]);
    return weightedPick(rng, table);
  };

  for (const rarity of ["Common", "Uncommon"] as const) {
    for (let i = 0; i < odds.slots[rarity]; i++) {
      const card = pickOf(rarity);
      addCard(card, rarity, jackpot ? jackpotFinish(card) : "standard");
    }
  }
  const rareCard = pickOf(due.mythic || rng.next() < odds.mythicInRareSlot ? "Mythic" : "Rare");
  addCard(rareCard, "Rare", jackpot ? jackpotFinish(rareCard) : "standard");

  // The shine slot.
  const finish = shineFinish(rng, odds, due.fullArt ? "hit" : jackpot ? "foilOrBetter" : "any");
  if (finish === "secret" || finish === "zeroDay") {
    const pool = chase.secrets.filter((s) => (finish === "secret" ? s.kind === "illustration" : s.kind === "zeroDay"));
    const s = rng.pick(pool);
    pulls.push({ cardId: s.cardId ?? s.code, rarity: s.rarity, slot: "shine", finish, collectorNumber: s.collectorNumber, secret: s.code });
  } else if (finish === "glitch") {
    const cardId = rng.pick([...chase.glitch]);
    const card = set.cards.find((c) => c.cardId === cardId)!;
    addCard(card, "shine", "glitch");
  } else {
    const weights =
      finish === "fullArt" ? odds.fullArtRarity : finish === "altArt" ? odds.altArtRarity : finish === "gold" ? odds.goldRarity : odds.shineRarity;
    const rarity = weightedPick(rng, Object.entries(weights) as [Rarity, number][]);
    addCard(pickOf(rarity), "shine", finish);
  }

  let prototypeFallbackGold = false;
  if (rng.next() < odds.prototypeBonus) {
    const open = [...prototypesLeft.entries()].filter(([, left]) => left > 0);
    if (open.length === 0) {
      prototypeFallbackGold = true;
      addCard(pickOf(weightedPick(rng, Object.entries(odds.goldRarity) as [Rarity, number][])), "bonus", "gold");
    } else {
      const code = weightedPick(rng, open.map(([c, left]) => [c, left] as const));
      const run = set.prototypes.find((p) => p.code === code)!;
      const card = set.cards.find((c) => c.cardId === run.cardId)!;
      pulls.push({ cardId: card.cardId, rarity: card.rarity, slot: "bonus", finish: "prototype", collectorNumber: card.collectorNumber, prototypeRun: code });
    }
  }
  return { pulls, jackpot, pity: due, prototypeFallbackGold };
}

/** The shine slot's finish: the whole table, Foil or better (Jackpot), or
 * a hit only (pity), each in the table's own proportions. */
function shineFinish(rng: Rng, odds: ChaseOdds, mode: "any" | "foilOrBetter" | "hit"): ChaseFinish {
  const f = odds.shineFinish;
  const hits: [ChaseFinish, number][] = [
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
export function baseHitPercent(odds: ChaseOdds = PACK_ODDS_V2): number {
  const f = odds.shineFinish;
  return f.fullArt + f.glitch + f.altArt + f.secret + f.gold + f.zeroDay;
}
