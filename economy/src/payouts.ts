// Match payouts in credits. The rule DESIGN.md protects: a win pays most, a
// loss pays a little, a cancelled or abandoned match pays nothing. On top of
// that, the owner caps what wins pay in a UTC day (2026-10-05: the 1st win
// 30, wins 2-4 10 each, wins 5-10 5 each, nothing after the 10th). The caps
// count per owner, not per agent: switching agents never resets them
// (owner app spec, 2026-10-05, section A). The amounts are in config.ts.
// Daily quests, the weekly challenge and the owner's daily pack are built in
// a later session; this file is only the per-match part.

import { LOSS_CREDITS, MAX_PAID_LOSSES_PER_DAY, WIN_CREDITS } from "./config.js";

export { LOSS_CREDITS, MAX_PAID_LOSSES_PER_DAY };

/** What a match ended as, from one side's point of view. */
export type MatchResultForAgent = "win" | "loss" | "draw" | "cancelled" | "abandoned";

/** Credits for the nth win of a UTC day (n starts at 1). Owner-set. */
export function winCredits(nthWinToday: number): number {
  if (!Number.isInteger(nthWinToday) || nthWinToday < 1) throw new Error(`nthWinToday must be a positive integer, got ${nthWinToday}`);
  if (nthWinToday === 1) return WIN_CREDITS.first;
  if (nthWinToday <= 4) return WIN_CREDITS.secondToFourth;
  if (nthWinToday <= 10) return WIN_CREDITS.fifthToTenth;
  return WIN_CREDITS.afterTenth;
}

/** How many wins/losses this owner already has recorded on the match's UTC
 * day, not counting the match being paid. Draws count as losses here. */
export interface DailyTally {
  winsToday: number;
  lossesToday: number;
}

/** Credits one side earns for one match. Pure: the store supplies the tally
 * from match history.
 *
 * The invariant the tests check over every tally: at any moment, the credits
 * for a win are at least the credits for a loss, which are at least 0 (what a
 * cancel or abandon pays), and strictly more whenever a win still pays at
 * all. That's why a loss stops paying once the owner's next win would pay 0
 * (10 wins already today): an 11th win can't be worth less than a loss. */
export function matchCredits(result: MatchResultForAgent, tally: DailyTally): number {
  switch (result) {
    case "win":
      return winCredits(tally.winsToday + 1);
    case "loss":
    case "draw":
      // A draw pays as a loss for both sides (owner-approved).
      if (winCredits(tally.winsToday + 1) === 0) return 0;
      if (tally.lossesToday >= MAX_PAID_LOSSES_PER_DAY) return 0;
      return LOSS_CREDITS;
    case "cancelled":
    case "abandoned":
      return 0;
  }
}
