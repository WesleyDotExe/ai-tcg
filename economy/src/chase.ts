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
// The 3 Zero-Day cards were reserved entries until they were designed
// (session 40) and went live (session 42): an entry takes its card's name
// from the engine's registry once the card is there.

import { getCard, type Rarity } from "@ai-tcg/engine";
import type { CardSet } from "./packs.js";

// ---- the secret cards ----

export interface SecretCard {
  /** "S0-SR01" ... "S0-SR33" for illustrations, "S0-ZD1" ... "S0-ZD3". */
  code: string;
  kind: "illustration" | "zeroDay";
  /** The card a copy of this entry plays as: an illustration's base card.
   * A Zero-Day card is its own card under this id, which is its code
   * ("S0-ZD1" is Patient Zero). */
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

/** Season 0's illustration versions from session 39 to session 96, the
 * list S0-odds-2 rolls (and the legacy set holds), proposed session 38 and
 * approved as proposed (owner 2026-10-18, answer 1A). Replaced for packs
 * opened now by S0_ILLUSTRATIONS below (owner 2026-11-14: starter cards are
 * Standard only). Never edit: logged openings roll again from it.
 * Every faction's Mythic; the Rares that define each faction's plan; a few
 * Uncommons and Commons whose names are scenes worth painting (an
 * illustration of a humble card is part of the charm, as in the benchmark).
 * 8 Cortex, 7 Swarm, 7 Aegis, 7 Null, 4 Neutral. */
export const S0_ILLUSTRATIONS_V2: readonly string[] = [
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

/** Season 0's illustration versions from S0-odds-3 (session 97): booster
 * cards only (owner 2026-11-14: "every special version belongs to the
 * booster cards ... re-points ... the secret-illustration list"). PROPOSED
 * at session 97's [OWNER CHECK-IN] (progress/notes-for-owner.md), the shape
 * of the old list on the new cards: every faction's Mythic, both its Rares
 * (the cards that carry its plan), and one Common whose name is a scene
 * worth painting. 4 per faction, 16 in all (the old list was 33 of 96 cards;
 * this is 16 of 28, so each illustration is about twice as likely a pull as
 * before at the same 1.5% secret rate). */
export const S0_ILLUSTRATIONS: readonly string[] = [
  // Cortex
  "CX-107", // Grid Consensus (Mythic)
  "CX-105", // Parity Checker (Rare)
  "CX-106", // Job Scheduler (Rare)
  "CX-101", // Port Scanner (Common)
  // Swarm
  "SW-107", // Colony Overmind (Mythic)
  "SW-105", // Swarm Surge (Rare)
  "SW-106", // Brood Tyrant (Rare)
  "SW-101", // Egg Courier (Common)
  // Aegis
  "AG-107", // Aegis Overwatch (Mythic)
  "AG-105", // Mirror Bulwark (Rare)
  "AG-106", // Hardening Protocol (Rare)
  "AG-101", // Shield Relay (Common)
  // Null
  "NL-107", // Heat Death (Mythic)
  "NL-105", // Heap Spray (Rare)
  "NL-106", // Decay Engine (Rare)
  "NL-101", // Bad Sector (Common)
];

/** How many Zero-Day cards a season has (owner 2026-10-16: 3 per season). */
export const ZERO_DAY_PER_SEASON = 3;

/** The secret cards of `set`: illustrations, then the Zero-Day slots at the
 * very top of the numbering. */
export function secretCards(set: Pick<CardSet, "code" | "cards">, illustrations: readonly string[]): SecretCard[] {
  const total = set.cards.length;
  // Gold numbers run total+1 up, one per card with a Gold version (every
  // card in the legacy set; the booster cards only, from session 97);
  // secret numbers start after the highest.
  const golds = set.cards.filter((c) => c.goldNumber !== null).length;
  const width = Math.max(3, String(total + golds + illustrations.length + ZERO_DAY_PER_SEASON).length);
  const pad = (n: number) => String(n).padStart(width, "0");
  let next = total + golds + 1;
  const out: SecretCard[] = illustrations.map((cardId, i) => {
    const card = set.cards.find((c) => c.cardId === cardId);
    if (!card) throw new Error(`illustration of ${cardId}: not a card of ${set.code}`);
    const code = `${set.code}-SR${String(i + 1).padStart(2, "0")}`;
    return { code, kind: "illustration", cardId, name: card.name, rarity: card.rarity, collectorNumber: `${pad(next++)}/${pad(total)}`, art: `placeholder:secret/${code}`, animated: false };
  });
  for (let i = 1; i <= ZERO_DAY_PER_SEASON; i++) {
    const code = `${set.code}-ZD${i}`;
    const card = getCard(code);
    if (card && (card.topTier !== "zeroDay" || card.rarity !== "Mythic")) throw new Error(`${code}: the registry's card under this id is not a Mythic Zero-Day card`);
    out.push({ code, kind: "zeroDay", cardId: code, name: card?.name ?? `Zero-Day ${i} (not designed yet)`, rarity: "Mythic", collectorNumber: `${pad(next++)}/${pad(total)}`, art: `placeholder:zero-day/${code}`, animated: true });
  }
  if (new Set(illustrations).size !== illustrations.length) throw new Error("an illustration is listed twice");
  return out;
}

// ---- the Glitch tier ----

/** The cards with a Glitch version in Season 0 from session 39 to session
 * 96 (S0-odds-2 and the legacy set), proposed session 38 and approved as
 * proposed (owner 2026-10-18, answer 3A). Never edit: logged openings roll
 * again from it. Units only: a corrupted creature or
 * machine reads as a glitch; a corrupted spell frame reads as a rendering
 * bug. Four per pool, leaning on each faction's Mythic and the units its
 * decks are built around; Neutral has four units in all, so all four. */
export const S0_GLITCH_CARDS_V2: readonly string[] = [
  "CX-024", "CX-003", "CX-002", "CX-001", // Quorum Arbiter, Recursive Construct, Firewall Sentinel, Signal Drone
  "SW-006", "SW-004", "SW-005", "SW-011", // Hive Mother, Overclock Beast, Corrosive Spitter, Molted Stalker
  "AG-014", "AG-013", "AG-005", "AG-007", // Prime Aegis, Aegis Warden, Perimeter Turret, Aegis Sentinel
  "NL-014", "NL-013", "NL-011", "NL-016", // Null Singularity, Kernel Panic, Entropy Harvester, Zombie Process
  "NT-008", "NT-003", "NT-009", "NT-007", // Uplink Tower, Relay Courier, Scrap Recycler, Commodity Rack
];

/** The cards with a Glitch version from S0-odds-3 (session 97): booster
 * Units only (owner 2026-11-14). PROPOSED at session 97's [OWNER CHECK-IN]:
 * four per faction, the old list's shape (the Mythic and the units the
 * faction's plan is built around). Aegis has exactly four booster Units, so
 * all four. No Neutral: there are no neutral booster cards (call 2). 16 in
 * all (was 20). */
export const S0_GLITCH_CARDS: readonly string[] = [
  "CX-107", "CX-105", "CX-103", "CX-102", // Grid Consensus, Parity Checker, Cluster Node, Mutex Lock
  "SW-107", "SW-106", "SW-103", "SW-104", // Colony Overmind, Brood Tyrant, Hive Relay, Acid Drone
  "AG-107", "AG-105", "AG-103", "AG-101", // Aegis Overwatch, Mirror Bulwark, Bastion Array, Shield Relay
  "NL-107", "NL-105", "NL-106", "NL-104", // Heat Death, Heap Spray, Decay Engine, Zombie Fork
];

/** How a Glitch version is drawn (for the render lane; all in code, no new
 * art, owner item 3). Recorded here so the proposal is one place. */
export const GLITCH_LOOK = [
  "the card's own art and frame, with its faction palette rotated to a corrupted one (hue shift, crushed channels)",
  "horizontal scanlines and a slow vertical roll",
  "block-displacement tears that jump every few seconds, and a brief RGB channel split on reveal",
  "the collector number keeps the base card's number with a glitch mark; it is not numbered above the total",
] as const;
