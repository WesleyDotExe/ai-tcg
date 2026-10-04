// Match payouts in credits. The rule DESIGN.md protects: a win pays most, a
// loss pays a little, a cancelled or abandoned match pays nothing. On top of
// that, the owner's 2026-10-04 economy answers (section 6) cap what wins pay
// in a day: the 1st win 40, wins 2-4 15 each, wins 5-10 5 each, nothing
// after the 10th. Daily quests, the weekly challenge and the owner's daily
// pack are the main income and are built in a later session; this file is
// only the per-match part.

/** What a match ended as, from one agent's point of view. */
export type MatchResultForAgent = "win" | "loss" | "draw" | "cancelled" | "abandoned";

/** Credits for the nth win of a UTC day (n starts at 1). Owner-set. */
export function winCredits(nthWinToday: number): number {
  if (!Number.isInteger(nthWinToday) || nthWinToday < 1) throw new Error(`nthWinToday must be a positive integer, got ${nthWinToday}`);
  if (nthWinToday === 1) return 40;
  if (nthWinToday <= 4) return 15;
  if (nthWinToday <= 10) return 5;
  return 0;
}

/** Provisional, not owner-set (ECONOMY.md, "Provisional numbers"): a loss
 * pays 2 credits. It has to stay below the smallest win that still pays (5)
 * so that a win always pays more than a loss. */
export const LOSS_CREDITS = 2;

/** Provisional: losses stop paying after this many in a UTC day, so a loss
 * stream can't become an income. */
export const MAX_PAID_LOSSES_PER_DAY = 10;

/** How many wins/losses this agent already has recorded on the match's UTC
 * day, not counting the match being paid. Draws count as losses here. */
export interface DailyTally {
  winsToday: number;
  lossesToday: number;
}

/** Credits one agent earns for one match. Pure: the store supplies the tally
 * from match history.
 *
 * The invariant the tests check over every tally: at any moment, the credits
 * for a win are at least the credits for a loss, which are at least 0 (what a
 * cancel or abandon pays), and strictly more whenever a win still pays at
 * all. That's why a loss stops paying once the agent's next win would pay 0
 * (10 wins already today): an 11th win can't be worth less than a loss. */
export function matchCredits(result: MatchResultForAgent, tally: DailyTally): number {
  switch (result) {
    case "win":
      return winCredits(tally.winsToday + 1);
    case "loss":
    case "draw":
      // A draw pays as a loss for both sides (provisional; ECONOMY.md).
      if (winCredits(tally.winsToday + 1) === 0) return 0;
      if (tally.lossesToday >= MAX_PAID_LOSSES_PER_DAY) return 0;
      return LOSS_CREDITS;
    case "cancelled":
    case "abandoned":
      return 0;
  }
}
