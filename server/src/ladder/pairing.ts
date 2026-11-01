// The ladder's matchmaker (owner 2026-10-05: "a skill rating (Glicko-2)
// drives matchmaking"; opponents are server-assigned). Built session 66.
//
// One round pairs a queue of owners. Pure: the caller passes each owner's
// rating, how many rounds it has sat out, and its last opponents; a seeded
// random source makes a round reproducible.
//
// How a round pairs (proposed session 66; owner check-in item):
// 1. Owners who sat out more rounds pick first, then the higher rated (ties
//    keep the queue's order, which the ladder takes from the store: oldest
//    owner first).
// 2. The picker takes the unpaired owner with the lowest cost:
//      |rating gap| + a rematch penalty (REMATCH_PENALTY by recency: the
//      last opponent costs 300, the one before 150) + a jitter of up to
//      JITTER rating points.
//    The jitter is what keeps a small pool (Season 0's 8 house agents)
//    from replaying the same four pairs every round; the penalty makes an
//    immediate rematch rare but never impossible (two owners alone in the
//    queue still play).
// 3. With an odd queue the last owner sits out, and picks first next round.
// 4. Seats (who goes first) are a coin flip.
// An owner is never paired with itself, and each owner appears once.

import type { Glicko2Rating } from "@ai-tcg/economy";

export const REMATCH_PENALTY = [300, 150] as const;
export const JITTER = 75;

export interface QueueEntry {
  ownerId: string;
  rating: Glicko2Rating;
  /** Rounds this owner has been in the queue and not paired. */
  satOut: number;
  /** Owner ids of its last opponents, most recent first. */
  recentOpponents: readonly string[];
}

export interface Pairing {
  p1: string;
  p2: string;
  /** The rating gap between the two (for the log). */
  gap: number;
}

export interface Round {
  pairs: Pairing[];
  sitOut: string[];
}

/** A random source in [0, 1). */
export type Random = () => number;

/** Mulberry32: a small seeded generator, so a round is reproducible. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pairingCost(a: QueueEntry, b: QueueEntry): number {
  const recency = a.recentOpponents.indexOf(b.ownerId);
  const recencyB = b.recentOpponents.indexOf(a.ownerId);
  const penalty = (i: number) => (i >= 0 && i < REMATCH_PENALTY.length ? REMATCH_PENALTY[i]! : 0);
  return Math.abs(a.rating.rating - b.rating.rating) + Math.max(penalty(recency), penalty(recencyB));
}

export function pairRound(queue: readonly QueueEntry[], random: Random): Round {
  const ids = new Set<string>();
  for (const e of queue) {
    if (ids.has(e.ownerId)) throw new Error(`owner "${e.ownerId}" is in the queue twice`);
    ids.add(e.ownerId);
  }
  // A stable sort: owners tied on both keep the queue's own order.
  const order = [...queue].sort((a, b) => b.satOut - a.satOut || b.rating.rating - a.rating.rating);
  const unpaired = new Set(order.map((e) => e.ownerId));
  const byId = new Map(order.map((e) => [e.ownerId, e]));
  const pairs: Pairing[] = [];
  for (const picker of order) {
    if (!unpaired.has(picker.ownerId)) continue;
    unpaired.delete(picker.ownerId);
    let best: QueueEntry | null = null;
    let bestCost = Infinity;
    // Candidates in the fixed order, so the random draws line up the same
    // way every time for the same queue.
    for (const id of unpaired) {
      const other = byId.get(id)!;
      const cost = pairingCost(picker, other) + random() * JITTER;
      if (cost < bestCost) {
        bestCost = cost;
        best = other;
      }
    }
    if (best === null) {
      unpaired.add(picker.ownerId);
      break;
    }
    unpaired.delete(best.ownerId);
    const [p1, p2] = random() < 0.5 ? [picker, best] : [best, picker];
    pairs.push({ p1: p1.ownerId, p2: p2.ownerId, gap: Math.abs(p1.rating.rating - p2.rating.rating) });
  }
  return { pairs, sitOut: [...unpaired] };
}
