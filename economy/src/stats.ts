// The Stats page's data (session 78; roadmap 2e; owner 2026-11-05, the
// 2026-10-05 owner app spec's Stats: "Rating chart; matches, wins, win rate
// and best streak; recent results. Win rate by faction; today's earnings
// and quests; achievements. Filter: 'All agents' or the agent that played";
// and the Rating & form widget: S "rating, weekly trend", M "chart, recent
// results", L "chart, stats, win rate by faction").
//
// Pure: the store reads one owner's matches (one row per match, from the
// owner's side) and its rated matches, and these functions count them. No
// clock and no database here, so the counting is tested on its own.
//
// The rules, one place:
// - A cancelled or abandoned match is VOID, as in `ownerStats`: it counts as
//   a match but neither wins, loses, nor breaks or extends a streak. (An
//   abandon is rated, as a loss for the side that walked out, so it can move
//   the rating chart; the tallies keep the economy's rule that walking out is
//   never a result.)
// - A draw breaks a win streak and a loss streak.
// - Win rate is wins / (wins + losses + draws), 0 before any decided match,
//   the same as `OwnerStats.winRate`.
// - The rating is the owner's, not an agent's (one rating per owner, schema
//   v17), so the chart and the weekly trend don't change with the agent
//   filter; every other figure does.

import { DECK_FACTIONS, type DeckFaction } from "@ai-tcg/engine";

/** What a match was for the owner. */
export type StatsResult = "win" | "loss" | "draw" | "cancelled" | "abandoned";

/** One of the owner's matches, from the owner's side, oldest first. */
export interface StatsMatchRow {
  matchId: string;
  endedAt: string;
  result: StatsResult;
  /** For an abandon: whether the owner's side walked out. */
  abandonedByYou: boolean;
  agentId: string;
  /** The faction the owner's deck played; null before schema v24. */
  faction: DeckFaction | null;
  opponentOwnerId: string;
  opponentAgentId: string;
  opponentFaction: DeckFaction | null;
  credits: number;
  /** The owner's rating before and after; null for an unrated match (a
   * cancel, or one recorded before v17). */
  ratingBefore: number | null;
  ratingAfter: number | null;
  turns: number | null;
}

/** A count of results. */
export interface ResultTally {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  /** Cancelled and abandoned matches. */
  void: number;
  winRate: number;
}

export interface FactionTally extends ResultTally {
  faction: DeckFaction;
}

/** The streak running now, from the newest decided match back: "win" or
 * "loss" and its length; null before any decided match or right after a
 * draw. Void matches are skipped. */
export interface CurrentStreak {
  kind: "win" | "loss";
  length: number;
}

export interface StatsTotals extends ResultTally {
  bestWinStreak: number;
  currentStreak: CurrentStreak | null;
  creditsFromMatches: number;
}

/** The owner's matches counted: totals, by the owner's faction, by the
 * opponent's faction. */
export interface StatsTallies {
  totals: StatsTotals;
  /** Every deck faction, in the engine's order, zeros included, so the
   * page's rows don't move. */
  byFaction: FactionTally[];
  /** Matches whose faction wasn't recorded (before schema v24). */
  factionNotRecorded: ResultTally;
  byOpponentFaction: FactionTally[];
  opponentFactionNotRecorded: ResultTally;
}

const emptyTally = (): ResultTally => ({ matches: 0, wins: 0, losses: 0, draws: 0, void: 0, winRate: 0 });

function add(t: ResultTally, r: StatsResult): void {
  t.matches++;
  if (r === "win") t.wins++;
  else if (r === "loss") t.losses++;
  else if (r === "draw") t.draws++;
  else t.void++;
}

function finish<T extends ResultTally>(t: T): T {
  const decided = t.wins + t.losses + t.draws;
  t.winRate = decided === 0 ? 0 : t.wins / decided;
  return t;
}

/** Counts the rows (oldest first). */
export function tallyMatches(rows: readonly StatsMatchRow[]): StatsTallies {
  const totals: StatsTotals = { ...emptyTally(), bestWinStreak: 0, currentStreak: null, creditsFromMatches: 0 };
  const mine = new Map<DeckFaction, FactionTally>(DECK_FACTIONS.map((f) => [f, { faction: f, ...emptyTally() }]));
  const theirs = new Map<DeckFaction, FactionTally>(DECK_FACTIONS.map((f) => [f, { faction: f, ...emptyTally() }]));
  const mineUnknown = emptyTally();
  const theirsUnknown = emptyTally();
  let streak: CurrentStreak | null = null;
  for (const m of rows) {
    add(totals, m.result);
    totals.creditsFromMatches += m.credits;
    add(m.faction === null ? mineUnknown : mine.get(m.faction)!, m.result);
    add(m.opponentFaction === null ? theirsUnknown : theirs.get(m.opponentFaction)!, m.result);
    if (m.result === "win" || m.result === "loss") {
      streak = streak !== null && streak.kind === m.result ? { kind: m.result, length: streak.length + 1 } : { kind: m.result, length: 1 };
      if (streak.kind === "win") totals.bestWinStreak = Math.max(totals.bestWinStreak, streak.length);
    } else if (m.result === "draw") {
      streak = null;
    }
  }
  totals.currentStreak = streak;
  return {
    totals: finish(totals),
    byFaction: [...mine.values()].map(finish),
    factionNotRecorded: finish(mineUnknown),
    byOpponentFaction: [...theirs.values()].map(finish),
    opponentFactionNotRecorded: finish(theirsUnknown),
  };
}

/** One reset day (midnight to midnight Sydney) of the chart. */
export interface ChartDayWindow {
  day: string;
  startsAt: string;
  endsAt: string;
}

/** A rated match for the chart: when it ended and the rating after it. */
export interface RatedPoint {
  endedAt: string;
  ratingAfter: number;
  score: 0 | 0.5 | 1;
}

/** One day of the rating chart. */
export interface RatingChartDay {
  day: string;
  /** The rating at the end of the day: after its last rated match, or the
   * day before's when it had none (a Glicko-2 rating doesn't move while
   * idle; only its RD grows). */
  rating: number;
  /** The rated matches that day: wins, losses and draws (an abandon is
   * rated: a loss for the side that walked out, a win for the other). */
  rated: number;
  wins: number;
  losses: number;
  draws: number;
}

/** The chart over `days` (oldest first, contiguous), starting from the
 * rating before the first day (`startRating`). Points outside the days are
 * ignored; points must be oldest first. */
export function ratingChart(days: readonly ChartDayWindow[], points: readonly RatedPoint[], startRating: number): RatingChartDay[] {
  let rating = startRating;
  let i = 0;
  const out: RatingChartDay[] = [];
  for (const d of days) {
    const row: RatingChartDay = { day: d.day, rating, rated: 0, wins: 0, losses: 0, draws: 0 };
    while (i < points.length && points[i]!.endedAt < d.startsAt) i++;
    while (i < points.length && points[i]!.endedAt < d.endsAt) {
      const p = points[i++]!;
      row.rated++;
      if (p.score === 1) row.wins++;
      else if (p.score === 0) row.losses++;
      else row.draws++;
      rating = p.ratingAfter;
    }
    row.rating = rating;
    out.push(row);
  }
  return out;
}
