// Featured picks for Watch live (session 74; owner app spec 2026-10-05 C.4:
// "Featured live matches in two groups: Tournament (including the Season 0
// finale when it runs) and Top rated (high-rating players)"). The "Top
// rated" rule was left open by the owner; this is the proposed rule, an
// [OWNER CHECK-IN] item (progress/notes-for-owner.md):
//
//  - Only a match where BOTH sides have finished placement can be Top rated:
//    a rating before PLACEMENT_MATCHES rated matches is still a guess (the
//    tier reads "Placement"), so it can't make a match "top".
//  - A match is ranked by its LOWER side's rating as the match started: a
//    match is only as top as its weaker player, so a Mythic owner against a
//    newcomer doesn't headline over two Diamond owners.
//  - Ties: the higher side's rating, then the match that started first,
//    then the match id (so the order never flickers between two reads).
//  - At most TOP_RATED_MAX (3) matches. No rating floor in Season 0: the
//    in-house population is a handful of owners, and a floor would leave
//    the group empty most of the time. `minRating` is there for launch
//    scale (proposed: Gold, 1500, once the ladder is big enough).
//  - The ratings and tiers are the ones the match started with (they can't
//    change while it is live), so a match's place doesn't move mid-match
//    except as matches start and end around it.
//
// Tournament: there are no tournaments in Season 0 (they come after it), so
// the group is always empty; it is sent so the page's shape is fixed.

import type { LiveMatchView } from "./liveLadder.js";

/** The most matches in the Top rated group. */
export const TOP_RATED_MAX = 3;

/** The tier an owner shows before its placement matches are done. */
const PLACEMENT = "Placement";

export interface FeaturedOptions {
  /** The group's length (default TOP_RATED_MAX). */
  max?: number;
  /** The lowest the weaker side's starting rating may be (default none). */
  minRating?: number | null;
}

/** The featured groups, as match ids in display order. */
export interface FeaturedPicks {
  tournament: string[];
  topRated: string[];
}

/** What the rule reads from a live match. */
export type FeaturedInput = Pick<LiveMatchView, "matchId" | "startedAt"> & {
  p1: Pick<LiveMatchView["p1"], "rating" | "tier">;
  p2: Pick<LiveMatchView["p2"], "rating" | "tier">;
};

/** Whether a live match can be Top rated: both sides placed, and the
 * weaker side at `minRating` or above. */
export function topRatedEligible(m: FeaturedInput, minRating: number | null = null): boolean {
  if (m.p1.tier === PLACEMENT || m.p2.tier === PLACEMENT) return false;
  return minRating === null || Math.min(m.p1.rating, m.p2.rating) >= minRating;
}

/** The order of the Top rated group: negative when `a` comes first. */
export function compareTopRated(a: FeaturedInput, b: FeaturedInput): number {
  const lowA = Math.min(a.p1.rating, a.p2.rating);
  const lowB = Math.min(b.p1.rating, b.p2.rating);
  if (lowA !== lowB) return lowB - lowA;
  const highA = Math.max(a.p1.rating, a.p2.rating);
  const highB = Math.max(b.p1.rating, b.p2.rating);
  if (highA !== highB) return highB - highA;
  const startA = Date.parse(a.startedAt);
  const startB = Date.parse(b.startedAt);
  if (startA !== startB) return startA - startB;
  return a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0;
}

/** The featured groups for the matches live now. */
export function featuredPicks(matches: readonly FeaturedInput[], options: FeaturedOptions = {}): FeaturedPicks {
  const max = options.max ?? TOP_RATED_MAX;
  const minRating = options.minRating ?? null;
  const topRated = matches
    .filter((m) => topRatedEligible(m, minRating))
    .sort(compareTopRated)
    .slice(0, max)
    .map((m) => m.matchId);
  return { tournament: [], topRated };
}
