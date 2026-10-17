// Chase cards: secret cards and the Glitch tier (owner 2026-10-16, "more
// collectable chase cards", items 1-3). Proposed and measured in session 38;
// approved by the owner 2026-10-18 ("yes on 1-6", option A throughout) and
// live since session 39: packs.ts puts these lists on the set, rollPack
// rolls them under S0-odds-2 (config.ts PACK_ODDS_V2), and schema v10 holds
// the copies.
//  - the secret cards: 33 illustration versions of chosen cards plus the 3
//    Zero-Day cards, numbered above the Gold numbers, each its own
//    collection entry with a placeholder art slot until the art pass;
//  - the Glitch tier: which cards have a Glitch version, and how it looks.
// The 3 Zero-Day cards themselves are designed with build-order step 2 (the
// "choose one" mechanic first); until then they are reserved entries.

import type { Rarity } from "@ai-tcg/engine";
import type { CardSet } from "./packs.js";

// ---- the secret cards ----

export interface SecretCard {
  /** "S0-SR01" ... "S0-SR33" for illustrations, "S0-ZD1" ... "S0-ZD3". */
  code: string;
  kind: "illustration" | "zeroDay";
  /** The card a copy of this entry plays as: an illustration's base card.
   * A Zero-Day card is its own card, designed with build-order step 2 under
   * this id, which is its code ("S0-ZD1"). */
  cardId: string;
  name: string;
  /** Gameplay rarity: the base card's for an illustration; Zero-Day cards
   * count as Mythic, for the Mythic pity timer too (owner 2026-10-18). */
  rarity: Rarity;
  /** "193/096": above the set total and above every Gold number. */
  collectorNumber: string;
  /** Placeholder until the owner-funded art pass, as the signature art pool. */
  art: string;
  /** Zero-Day cards move and reach past the frame (owner item 2). */
  animated: boolean;
}

/** Season 0's illustration versions, proposed session 38 and approved as
 * proposed (owner 2026-10-18, answer 1A).
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
export function secretCards(set: Pick<CardSet, "code" | "cards">, illustrations: readonly string[]): SecretCard[] {
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
    out.push({ code, kind: "zeroDay", cardId: code, name: `Zero-Day ${i} (not designed yet)`, rarity: "Mythic", collectorNumber: `${pad(next++)}/${pad(total)}`, art: `placeholder:zero-day/${code}`, animated: true });
  }
  if (new Set(illustrations).size !== illustrations.length) throw new Error("an illustration is listed twice");
  return out;
}

// ---- the Glitch tier ----

/** The cards with a Glitch version in Season 0, proposed session 38 and
 * approved as proposed (owner 2026-10-18, answer 3A). Units only: a corrupted creature or
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
