// Shared measuring loop for Lookahead-vs-Lookahead cross-faction edges, plus
// the interval statistics the owner's 2026-09-26 "cross-project" entry asked
// balance calls to use (judge in/out of band on a confidence interval, not
// a point estimate).
//
// lookaheadEdgeCheck.ts (the CLI) and nullTrimSearch.ts (the Null
// consistency-trim search) both run through measureEdges, so a trimmed pool
// is measured on exactly the seeding the standard check uses: seeds 1-300
// here still reproduce balanceReport.ts's Lookahead section.
//
// The statistics (pooled two-proportion z-test, Wilson score interval per
// group, Newcombe hybrid interval for the difference) live here, and AI TCG
// has no external runtime dependencies (owner-feedback 2026-09-30). Nothing
// here calls out to anything. engine/test/edgeMeasure.test.ts pins them to a
// hardcoded fixture, so they cannot drift silently.

import { buildDeck, buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck, withSetMythicSignature } from "../data/decks.js";
import { CORTEX_CARDS, SWARM_CARDS } from "../data/cards.js";
import { AEGIS_CARDS } from "../data/aegisCards.js";
import { NULL_CARDS } from "../data/nullCards.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import type { DeckSpec } from "../state/init.js";
import type { Card, DeckFaction as Faction } from "../cards/types.js";
import type { GameState, PlayerId } from "../state/types.js";

export const FACTIONS: Faction[] = ["Cortex", "Swarm", "Aegis", "Null"];

export type DeckBuilder = (id: DeckSpec["id"], name: string) => DeckSpec;
export type Pool = { card: Card; copies: number }[];

const defaultBuilders: Record<Faction, DeckBuilder> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
  Null: buildNullDeck,
};

/** A faction's shipped deck list, copied so a search can edit it freely. */
export function shippedPool(faction: Faction): Pool {
  const lists: Record<Faction, Pool> = { Cortex: CORTEX_CARDS, Swarm: SWARM_CARDS, Aegis: AEGIS_CARDS, Null: NULL_CARDS };
  return lists[faction].map((p) => ({ ...p }));
}

export interface EdgeResult {
  opponent: Faction;
  games: number;
  selfWins: number;
  draws: number;
  /** Games in which `trackCard` (a card name, if given) was played by `faction`. */
  trackedPlays: number;
}

/**
 * Plays `faction` against each other faction on seeds
 * [firstSeed, firstSeed + count), both sides LookaheadAgent. `pool`, when
 * given, replaces `faction`'s own deck list (and is linted and copy-limited
 * by buildDeck like any real deck); opponents always use their shipped
 * decks.
 */
export async function measureEdges(
  faction: Faction,
  firstSeed: number,
  count: number,
  opts: { pool?: Pool; trackCard?: string } = {},
): Promise<EdgeResult[]> {
  const builders: Record<Faction, DeckBuilder> = { ...defaultBuilders };
  if (opts.pool) {
    const pool = opts.pool;
    builders[faction] = (id, name) => buildDeck(id, name, pool);
  }
  const results: EdgeResult[] = [];
  for (const opponent of FACTIONS.filter((f) => f !== faction)) {
    results.push(await measurePairing(faction, opponent, firstSeed, count, { builders, trackCard: opts.trackCard }));
  }
  return results;
}

/**
 * One pairing of measureEdges, on its own: `faction` against `opponent` on
 * seeds [firstSeed, firstSeed + count), both LookaheadAgent, same seeding
 * and seat order as measureEdges (so the two always agree). ringRegression.ts
 * uses it to measure only the six ring edges.
 */
export async function measurePairing(
  faction: Faction,
  opponent: Faction,
  firstSeed: number,
  count: number,
  opts: {
    builders?: Record<Faction, DeckBuilder>;
    trackCard?: string;
    signature?: boolean;
    /** Sees every finished game, for reports that need more than the win count. */
    onGame?: (state: GameState, selfPid: PlayerId) => void;
  } = {},
): Promise<EdgeResult> {
  const base = opts.builders ?? defaultBuilders;
  // `signature`: each deck's set Mythic leaves the deck and stands in as its
  // signature card (withSetMythicSignature), the way the ring regression
  // check measures since the signature zone landed (session 31).
  const builders: Record<Faction, DeckBuilder> = opts.signature
    ? (Object.fromEntries(FACTIONS.map((f) => [f, (id: DeckSpec["id"], name: string) => withSetMythicSignature(base[f](id, name))])) as Record<Faction, DeckBuilder>)
    : base;
  // balanceReport.ts puts the earlier faction in FACTIONS order in slot A.
  const aIsSelf = FACTIONS.indexOf(faction) < FACTIONS.indexOf(opponent);
  const [factionA, factionB] = aIsSelf ? [faction, opponent] : [opponent, faction];
  const r: EdgeResult = { opponent, games: count, selfWins: 0, draws: 0, trackedPlays: 0 };
  for (let seed = firstSeed; seed < firstSeed + count; seed++) {
    const aGoesFirst = seed % 2 === 1;
    const deckA = builders[factionA]("p1", `${factionA} Deck`);
    const deckB = builders[factionB]("p2", `${factionB} Deck`);
    const agentA = new LookaheadAgent(`Lookahead-${factionA}`, seed * 104729 + 31);
    const agentB = new LookaheadAgent(`Lookahead-${factionB}`, seed * 104729 + 31);
    const { state } = aGoesFirst
      ? await runMatch(deckA, deckB, agentA, agentB, seed)
      : await runMatch(deckB, deckA, agentB, agentA, seed);
    const selfPid: PlayerId = aGoesFirst === aIsSelf ? "p1" : "p2";
    if (opts.trackCard && playedCard(state, selfPid, opts.trackCard)) r.trackedPlays++;
    opts.onGame?.(state, selfPid);
    if (state.winner === "draw") {
      r.draws++;
      continue;
    }
    if (state.winner === selfPid) r.selfWins++;
  }
  return r;
}

/** Same "played" definition as balanceReport.ts's playedCardNames. */
function playedCard(state: GameState, pid: PlayerId, name: string): boolean {
  return state.log.some(
    (e) =>
      ((e.type === "play" || e.type === "cast") && e.player === pid && e.card === name) ||
      (e.type === "toolAttached" && e.player === pid && e.tool === name) ||
      (e.type === "evolve" && e.player === pid && e.to === name),
  );
}

/** Wilson score interval for x successes in n trials (z = 1.96 for 95%). */
export function wilson(x: number, n: number, z = 1.96): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 1 };
  const p = x / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/**
 * Newcombe's hybrid score interval (method 10) for p1 - p2, built from the
 * two Wilson intervals. Used to say whether a before/after change is
 * distinguishable from noise.
 */
export function newcombeDiff(
  x1: number,
  n1: number,
  x2: number,
  n2: number,
  z = 1.96,
): { diff: number; lo: number; hi: number } {
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const w1 = wilson(x1, n1, z);
  const w2 = wilson(x2, n2, z);
  const d = p1 - p2;
  const lo = d - Math.sqrt((p1 - w1.lo) ** 2 + (w2.hi - p2) ** 2);
  const hi = d + Math.sqrt((w1.hi - p1) ** 2 + (p2 - w2.lo) ** 2);
  return { diff: d, lo, hi };
}

/** Standard normal CDF, via the Abramowitz-Stegun 7.1.26 erf
 * approximation (absolute error under 1.5e-7, far below anything a band
 * call reads). */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Pooled two-proportion z-test for p1 = p2, with its two-sided p-value. */
export function twoProportionZ(x1: number, n1: number, x2: number, n2: number): { z: number; p: number } {
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return { z: 0, p: 1 };
  const z = (x1 / n1 - x2 / n2) / se;
  return { z, p: 2 * (1 - normalCdf(Math.abs(z))) };
}

/** Everything compare_two_proportions reports, in one call: both Wilson
 * intervals, the Newcombe interval on the difference, the z-test, and a
 * plain verdict (the difference is real at 95% when its interval excludes
 * zero). */
export function compareTwoProportions(x1: number, n1: number, x2: number, n2: number) {
  const diff = newcombeDiff(x1, n1, x2, n2);
  const test = twoProportionZ(x1, n1, x2, n2);
  const real = diff.lo > 0 || diff.hi < 0;
  return {
    group1: { rate: x1 / n1, ...wilson(x1, n1) },
    group2: { rate: x2 / n2, ...wilson(x2, n2) },
    diff,
    z: test.z,
    p: test.p,
    verdict: real ? (diff.diff > 0 ? "group 1 higher" : "group 2 higher") : "no detectable difference",
  } as const;
}

/**
 * The owner's band rule: a pairing is OUT of band only when the whole 95%
 * interval misses the band, IN band only when the whole interval sits inside
 * it, and otherwise the sample can't tell.
 */
export function bandVerdict(
  x: number,
  n: number,
  band: { lo: number; hi: number },
): "IN BAND" | "OUT OF BAND" | "UNRESOLVED" {
  const ci = wilson(x, n);
  if (ci.hi < band.lo || ci.lo > band.hi) return "OUT OF BAND";
  if (ci.lo >= band.lo && ci.hi <= band.hi) return "IN BAND";
  return "UNRESOLVED";
}

/** The ring (owner-feedback 2026-09-23): Null > Aegis > Cortex > Swarm > Null,
 * with Null-Cortex and Aegis-Swarm the ~even pairings. Returned as the band
 * for `self`'s win rate against `opponent`. */
export function ringBand(self: Faction, opponent: Faction): { lo: number; hi: number } {
  const beats: Record<Faction, Faction> = { Null: "Aegis", Aegis: "Cortex", Cortex: "Swarm", Swarm: "Null" };
  if (beats[self] === opponent) return { lo: 0.55, hi: 0.6 };
  if (beats[opponent] === self) return { lo: 0.4, hi: 0.45 };
  return { lo: 0.45, hi: 0.55 };
}
