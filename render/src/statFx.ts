// EFFECTS.md slice 2 — buff (rise) and penalty (sink) grammar. This module
// is the pure "what kind of stat change just happened to this unit" half;
// renderHtml.ts's inline JS mirrors it by hand (no bundler — same pattern
// as fxMagnitude.ts) and does the DOM half. test/statFx.test.ts runs the
// inline mirror against this module on the same cases so the two can't
// silently drift.
//
// Why a decomposition and not just "attack went up/down": before this
// slice the render keyed its buff flash off a raw attack delta and its
// heal flash off a raw health delta, which misread two real, common cases:
//   - a debuff (Null's -2/-2, the -1 ATK opponent auras) flashed in the
//     SAME gold "buff" treatment as a buff — breaking EFFECTS.md's one
//     invariant (a debuff always reads as a debuff);
//   - a +health buff (maxHealth up, health up with it) read as a HEAL.
// The engine's health model makes an exact split possible without any
// event-name matching: currentHealth = currentMaxHealth - damageTaken
// (engine/src/state/queries.ts), so a maxHealth change is a stat shift and
// whatever health change is left over is damage/heal, precisely.
import type { Faction } from "./engineInternal.js";

/** Statuses that are purely bad for the unit carrying them (Stasis: can't
 * attack; Overload: end-of-turn damage). Barrier is defence, not a penalty,
 * and has its own slice-1 treatment. */
export const PENALTY_STATUSES = ["Stasis", "Overload"] as const;

export interface StatSide {
  attack: number;
  maxHealth: number;
  /** The unit's temporary (this-turn) buff totals — lets the classifier
   * tell "a turn buff just wore off" apart from "a penalty just landed". */
  turnBuffAttack: number;
  turnBuffHealth: number;
  statuses: string[];
}

export type StatShiftKind = "buff" | "penalty" | "expire";

export interface StatShift {
  kind: StatShiftKind;
  /** Net attack/maxHealth change attributed to this shift (for `expire`,
   * the change caused by the temporary buff ending). */
  attack: number;
  health: number;
  /** Penalty statuses newly applied this move. */
  newStatuses: string[];
  /** Short floating label, e.g. "+2 ATK", "-2/-2", "STASIS". */
  label: string;
}

function signed(n: number): string {
  return (n > 0 ? "+" : "") + n;
}

export function statLabel(attack: number, health: number): string {
  if (attack !== 0 && health === 0) return `${signed(attack)} ATK`;
  if (attack === 0 && health !== 0) return `${signed(health)} HP`;
  return `${signed(attack)}/${signed(health)}`;
}

/** Classifies one surviving, non-evolving unit's change between two frames.
 * Returns null when nothing buff/penalty-shaped happened (damage and heal
 * are separate categories, handled by the caller from `healthResidual`). */
export function classifyStatShift(prev: StatSide, next: StatSide): StatShift | null {
  const atkDelta = next.attack - prev.attack;
  const maxDelta = next.maxHealth - prev.maxHealth;
  const expAtk = prev.turnBuffAttack !== 0 && next.turnBuffAttack === 0 ? -prev.turnBuffAttack : 0;
  const expHp = prev.turnBuffHealth !== 0 && next.turnBuffHealth === 0 ? -prev.turnBuffHealth : 0;
  let actAtk = atkDelta - expAtk;
  let actHp = maxDelta - expHp;
  // Live stats are clamped (attack >= 0, maxHealth >= 1 — see
  // engine/src/state/queries.ts), so when a clamp may be in play the
  // expiry can't be subtracted blindly: a -1 turn debuff on a 0-attack
  // unit wearing off moves nothing visible, and must not be misread as a
  // fresh -1 penalty. If the leftover points the opposite way from what
  // the viewer actually saw, attribute nothing to it.
  if (expAtk !== 0 && (prev.attack === 0 || next.attack === 0) && Math.sign(actAtk) !== Math.sign(atkDelta)) actAtk = 0;
  if (expHp !== 0 && (prev.maxHealth === 1 || next.maxHealth === 1) && Math.sign(actHp) !== Math.sign(maxDelta)) actHp = 0;
  const newStatuses = next.statuses.filter(
    (s) => (PENALTY_STATUSES as readonly string[]).includes(s) && !prev.statuses.includes(s),
  );

  if (actAtk === 0 && actHp === 0 && newStatuses.length === 0) {
    if (expAtk === 0 && expHp === 0) return null;
    // Only report an expiry the viewer can actually see move.
    if (atkDelta === 0 && maxDelta === 0) return null;
    return { kind: "expire", attack: atkDelta, health: maxDelta, newStatuses: [], label: statLabel(atkDelta, maxDelta) };
  }

  const net = actAtk + actHp;
  const kind: StatShiftKind = newStatuses.length > 0 || net < 0 || (net === 0 && actAtk < 0) ? "penalty" : "buff";
  const parts: string[] = [];
  if (actAtk !== 0 || actHp !== 0) parts.push(statLabel(actAtk, actHp));
  for (const s of newStatuses) parts.push(s.toUpperCase());
  return { kind, attack: actAtk, health: actHp, newStatuses, label: parts.join(" ") };
}

/** The damage (<0) or heal (>0) part of a unit's health change, with the
 * maxHealth (stat) part removed. Exact under the engine's
 * health = maxHealth - damageTaken model. */
export function healthResidual(prevHealth: number, nextHealth: number, prevMax: number, nextMax: number): number {
  return nextHealth - prevHealth - (nextMax - prevMax);
}

/** Faction whose palette tints a buff/penalty (EFFECTS.md axis 2: faction
 * is skin, never meaning). The effect's own source card's faction when the
 * event log names one we know; otherwise the side that almost always
 * causes it — a buff is overwhelmingly your own side's doing, a penalty the
 * opponent's (every printed -ATK aura targets `side: "opponent"`). */
export function tintFaction(kind: StatShiftKind, ownerFaction: Faction, opponentFaction: Faction, sourceFaction?: Faction): Faction {
  if (sourceFaction) return sourceFaction;
  return kind === "penalty" ? opponentFaction : ownerFaction;
}
