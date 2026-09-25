// Owner feedback (2026-09-25, "scale animation magnitude to event
// magnitude"): the eight FX classes session 2 built all play at one fixed
// size/duration regardless of what actually happened — a 1-damage ping
// looks as loud as an unconditional destroy, a common unit entering looks
// as loud as a Mythic entering. This module is the "judge magnitude from
// the effect and the swing" half of the fix (renderHtml.ts's inline JS does
// the other half: applying the tier to CSS and to play-loop pacing).
//
// Pure and unit-testable on purpose, unlike the rest of this lane's FX code
// (which has to live inside renderHtml.ts's inline <script> string, since
// there's no bundler to import a real module into the browser page). The
// inline JS mirrors this file's logic by hand — see the comment above
// `magnitudeOf` in renderHtml.ts.
import type { Rarity } from "./engineInternal.js";

export type FxTier = "subtle" | "normal" | "spectacle";

const RARITY_WEIGHT: Record<Rarity, number> = { Common: 1.0, Uncommon: 1.3, Rare: 1.8, Mythic: 2.6 };

const SUBTLE_MAX = 0.9;
const SPECTACLE_MIN = 2.4;

export function tierFromScore(score: number): FxTier {
  if (score >= SPECTACLE_MIN) return "spectacle";
  if (score <= SUBTLE_MAX) return "subtle";
  return "normal";
}

/** A card/directive newly appearing on the board (played or summoned). */
export function enterScore(rarity: Rarity): number {
  return { Common: 0.6, Uncommon: 1.4, Rare: 1.8, Mythic: 2.6 }[rarity];
}

/** A unit dying. `wasEffectKill` = died in a move with no `attack` event of
 * its own (i.e. a removal/destroy effect, not ordinary combat) — those read
 * as more significant regardless of the unit's stats (a Kernel Panic
 * unconditional destroy is the named example). */
export function deathScore(rarity: Rarity, wasEffectKill: boolean): number {
  return RARITY_WEIGHT[rarity] + (wasEffectKill ? 0.9 : 0);
}

/** Damage landing on a unit or a player. `aoeCount` is how many units took
 * damage in the same move (0/1 = single-target). */
export function hitScore(amount: number, aoeCount: number): number {
  const delta = Math.abs(amount);
  const base = delta <= 1 ? 0.5 : delta <= 3 ? 1.3 : delta <= 5 ? 2.0 : 3.0;
  const aoeBonus = aoeCount >= 3 ? 1.3 : aoeCount === 2 ? 0.5 : 0;
  return base + aoeBonus;
}

/** Damage landing on a player specifically — same shape as a unit hit but a
 * touch louder at every size, since it's progress toward the actual win
 * condition. `isLethal` (the hit that ends the game) always maxes out. */
export function playerHitScore(amount: number, isLethal: boolean): number {
  if (isLethal) return SPECTACLE_MIN + 2;
  const delta = Math.abs(amount);
  return delta <= 1 ? 0.8 : delta <= 3 ? 1.6 : delta <= 5 ? 2.3 : 3.0;
}

export function healScore(amount: number): number {
  const delta = Math.abs(amount);
  return delta <= 1 ? 0.5 : delta <= 4 ? 1.2 : 2.8;
}

export function buffScore(atkDelta: number): number {
  const delta = Math.abs(atkDelta);
  return delta <= 1 ? 0.6 : delta <= 3 ? 1.3 : 2.6;
}

/** An evolution completing is always a spectacle beat — named explicitly by
 * the owner alongside Mythics entering and unconditional destroys. */
export function evolveScore(): number {
  return 2.8;
}

/** A telegraphed unit's dormant window ending and it firing for real. */
export function armedScore(rarity: Rarity): number {
  return { Common: 1.0, Uncommon: 1.2, Rare: 1.9, Mythic: 2.5 }[rarity];
}

/** How far the momentum gauge swung this move, independent of any single
 * card event — a quiet-looking move can still be a big swing (e.g. a card
 * drawn into an empty hand), and this lets pacing/the gauge itself react to
 * that even when no single unit's FX would have crossed the spectacle line. */
export function momentumSwingScore(prevScore: number, newScore: number): number {
  const delta = Math.abs(newScore - prevScore);
  return delta <= 6 ? 0 : delta <= 15 ? 1.2 : delta <= 25 ? 2.0 : 3.2;
}

const TIER_RANK: Record<FxTier, number> = { subtle: 0, normal: 1, spectacle: 2 };

export function maxTier(tiers: FxTier[]): FxTier {
  return tiers.reduce((max, t) => (TIER_RANK[t] > TIER_RANK[max] ? t : max), "subtle" as FxTier);
}
