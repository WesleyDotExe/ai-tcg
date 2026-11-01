// Glicko-2 skill ratings for the ladder (owner 2026-10-05, Season 0 setup:
// "a skill rating (Glicko-2) drives matchmaking; spectators see named
// tiers"; rating is per owner, ECONOMY.md "Who owns what"). Built session 66.
//
// This is Glickman's Glicko-2 as written in "Example of the Glicko-2 system"
// (Mark E. Glickman, 2013), steps 1-8, with the Illinois algorithm for the
// new volatility. The worked example from that paper is pinned by a test
// (1500/200/0.06 against three opponents -> 1464.06 / 151.52 / 0.05999).
//
// How the ladder uses it (the calls are the store's, see store.ts):
// - every rated match is its own rating period for its two owners, both
//   updated from their pre-match ratings (simultaneous, so seat order
//   doesn't matter);
// - a reset day (midnight Sydney) with no rated match for an owner is one
//   empty period: its RD grows by its volatility (step 6 with no games), so
//   an owner back after a break is matched and moved as less certain;
// - RD never goes above the starting RD (350): an unknown owner is never
//   less known than a new one.
// Pure functions; no store, no clock.

/** Glicko's display scale: 1500 is the start, 173.7178 converts to the
 * internal (mu, phi) scale. */
export const GLICKO_SCALE = 173.7178;

/** Where every owner starts (Glickman's recommended defaults). */
export const RATING_START = { rating: 1500, rd: 350, volatility: 0.06 } as const;

/** The system constant tau: how fast volatility may change. Glickman
 * suggests 0.3-1.2; 0.5 is his example's value. */
export const GLICKO_TAU = 0.5;

/** The Illinois algorithm's convergence tolerance (Glickman's value). */
const EPSILON = 0.000001;

export interface Glicko2Rating {
  rating: number;
  rd: number;
  volatility: number;
}

/** One game in a rating period: the opponent's pre-period rating and this
 * player's score (1 win, 0.5 draw, 0 loss). */
export interface Glicko2Game {
  opponent: Glicko2Rating;
  score: 0 | 0.5 | 1;
}

const toMu = (r: number) => (r - RATING_START.rating) / GLICKO_SCALE;
const toPhi = (rd: number) => rd / GLICKO_SCALE;
const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expected = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

const capRd = (rd: number) => Math.min(rd, RATING_START.rd);

/** The chance (0-1) that `a` beats `b`, by the Glicko-2 expectation with
 * both deviations combined. The matchmaker and the ladder's "expected"
 * column read this; it is not used in the update itself. */
export function winProbability(a: Glicko2Rating, b: Glicko2Rating): number {
  const phi = Math.sqrt(toPhi(a.rd) ** 2 + toPhi(b.rd) ** 2);
  return 1 / (1 + Math.exp(-g(phi) * (toMu(a.rating) - toMu(b.rating))));
}

/** `periods` empty rating periods: RD grows (step 6 with no games),
 * capped at the starting RD; rating and volatility don't change. */
export function idle(player: Glicko2Rating, periods: number): Glicko2Rating {
  if (!Number.isInteger(periods) || periods < 0) throw new RangeError(`periods is a whole number >= 0, got ${periods}`);
  if (periods === 0) return { ...player };
  const phi = toPhi(player.rd);
  const grown = Math.sqrt(phi * phi + periods * player.volatility * player.volatility) * GLICKO_SCALE;
  return { rating: player.rating, rd: capRd(grown), volatility: player.volatility };
}

/** One rating period: steps 2-8 of Glickman's paper. With no games it is
 * `idle(player, 1)`. */
export function ratePeriod(player: Glicko2Rating, games: readonly Glicko2Game[], tau: number = GLICKO_TAU): Glicko2Rating {
  for (const r of [player, ...games.map((x) => x.opponent)]) {
    if (!(Number.isFinite(r.rating) && r.rd > 0 && r.volatility > 0)) throw new RangeError(`bad rating ${JSON.stringify(r)}`);
  }
  if (games.length === 0) return idle(player, 1);
  // Step 2: to the Glicko-2 scale.
  const mu = toMu(player.rating);
  const phi = toPhi(player.rd);
  const sigma = player.volatility;
  // Steps 3 and 4: the estimated variance v and the improvement delta.
  let vInv = 0;
  let sum = 0;
  for (const { opponent, score } of games) {
    const muJ = toMu(opponent.rating);
    const phiJ = toPhi(opponent.rd);
    const e = expected(mu, muJ, phiJ);
    const gj = g(phiJ);
    vInv += gj * gj * e * (1 - e);
    sum += gj * (score - e);
  }
  const v = 1 / vInv;
  const delta = v * sum;
  // Step 5: the new volatility, by the Illinois algorithm.
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }
  const sigmaNew = Math.exp(A / 2);
  // Steps 6 and 7: the pre-period deviation, then the new deviation and
  // rating.
  const phiStar = Math.sqrt(phi * phi + sigmaNew * sigmaNew);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * sum;
  // Step 8: back to the display scale.
  return { rating: muNew * GLICKO_SCALE + RATING_START.rating, rd: capRd(phiNew * GLICKO_SCALE), volatility: sigmaNew };
}

/** A single rated match between two owners as its own period for both,
 * each updated from the other's pre-match rating. `scoreA` is A's score. */
export function rateMatch(a: Glicko2Rating, b: Glicko2Rating, scoreA: 0 | 0.5 | 1): { a: Glicko2Rating; b: Glicko2Rating } {
  const scoreB = (1 - scoreA) as 0 | 0.5 | 1;
  return { a: ratePeriod(a, [{ opponent: b, score: scoreA }]), b: ratePeriod(b, [{ opponent: a, score: scoreB }]) };
}
