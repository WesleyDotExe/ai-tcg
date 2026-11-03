// The 2× vote (session 73; owner app spec 2026-10-05 D, "Match speed: 2×
// only when both owners agree"):
//  - a match starts at 1×; it runs at 2× only while both owners agree;
//  - each owner can tap "Ask for 2×" during the match (and tap again to take
//    it back), or turn on "Ask for 2× in every match" in Settings, which asks
//    for them as each match starts;
//  - the screen shows when you're waiting on the other owner;
//  - the vote resets every match (it lives with the live match, in memory);
//  - speed changes only the pace moves are released at, never the match:
//    every match is decided in the engine before its first move is shown,
//    so its moves, log, replay, result and payouts are the same at any pace.
//
// A house owner has no person watching to ask, so a house side never asks
// by itself: it agrees to whatever a player owner across the board asks
// (proposed session 73, an owner call). A house-against-house match always
// shows at 1×: nobody in it can ask, and it is what spectators watch.

export type Seat = "p1" | "p2";
export type SpeedRate = 1 | 2;

export interface SpeedVote {
  /** Whether each side's owner is asking for 2× now. Always false for a
   * house side. */
  asks: { p1: boolean; p2: boolean };
  /** Whether each side is a house owner (it defers to the other side). */
  house: { p1: boolean; p2: boolean };
}

/** The vote as the live view sends it. */
export interface SpeedView {
  /** The pace now: 2 while both sides agree, else 1. */
  rate: SpeedRate;
  asks: { p1: boolean; p2: boolean };
  house: { p1: boolean; p2: boolean };
  /** The side the other is waiting on: set while one player owner asks and
   * the other player owner hasn't; null otherwise (nobody asks, both agree,
   * or a house side is in the match). */
  waitingOn: Seat | null;
}

const other = (seat: Seat): Seat => (seat === "p1" ? "p2" : "p1");

/** Whether `seat` agrees to 2×: its own ask, or for a house side, the
 * other side's (a player's) ask. */
export function agrees(vote: SpeedVote, seat: Seat): boolean {
  if (!vote.house[seat]) return vote.asks[seat];
  const o = other(seat);
  return !vote.house[o] && vote.asks[o];
}

export function rateOf(vote: SpeedVote): SpeedRate {
  return agrees(vote, "p1") && agrees(vote, "p2") ? 2 : 1;
}

export function speedView(vote: SpeedVote): SpeedView {
  const rate = rateOf(vote);
  let waitingOn: Seat | null = null;
  if (rate === 1 && !vote.house.p1 && !vote.house.p2 && vote.asks.p1 !== vote.asks.p2) waitingOn = vote.asks.p1 ? "p2" : "p1";
  return { rate, asks: { ...vote.asks }, house: { ...vote.house }, waitingOn };
}

/** A new match's vote: each player side asks at once when its owner has
 * "Ask for 2× in every match" on. */
export function startingVote(sides: { p1: { house: boolean; askEveryMatch: boolean }; p2: { house: boolean; askEveryMatch: boolean } }): SpeedVote {
  return {
    asks: { p1: !sides.p1.house && sides.p1.askEveryMatch, p2: !sides.p2.house && sides.p2.askEveryMatch },
    house: { p1: sides.p1.house, p2: sides.p2.house },
  };
}

/** The wait still to go before a release, when the pace changes from
 * `from` to `to` part-way through it: the part not yet waited is shortened
 * (or lengthened) in proportion, so a hold half done at 1× has half its 2×
 * length left. Whole milliseconds. */
export function rescaleRemaining(remainingMs: number, from: SpeedRate, to: SpeedRate): number {
  return Math.max(0, Math.round((remainingMs * from) / to));
}
