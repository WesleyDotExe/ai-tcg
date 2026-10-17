// Principle 2 (DESIGN.md): "the render must surface enough legible signal
// (momentum, threat, who's winning) that commentary + visuals together make
// the match gripping even though the underlying game is beyond the viewer."
// Full AI commentary is stage 7 (a separate, later lane) — this is the
// render's own, simpler contribution: a live "who's ahead and why" read a
// spectator can grasp at a glance without tracking the whole board
// themselves, computed from the same public snapshot the board itself
// renders from (no hidden information, nothing an agent couldn't also see).
import type { PlayerId } from "@ai-tcg/engine";
import type { PlayerSnapshot, MomentumReading } from "./types.js";

export type { MomentumReading };

function boardPower(p: PlayerSnapshot): number {
  return p.board.filter((u) => !u.pending).reduce((sum, u) => sum + u.attack + u.health, 0);
}

/** Each term is a genuinely different axis a spectator would care about —
 * not one number in disguise. Weights are a first, reasoned proposal (not
 * tuned against real matches yet): health is the actual win condition so it
 * dominates; live board power (only *active*, non-pending units — a
 * telegraphed threat isn't board presence yet) is the next clearest "who's
 * winning the fight" signal; hand size is card advantage, the standard TCG
 * tell for "who has more options"; energy is minor, tie-breaking texture. */
const WEIGHTS = { health: 1.0, board: 0.6, hand: 1.5, energy: 0.5 };

export function computeMomentum(p1: PlayerSnapshot, p2: PlayerSnapshot): MomentumReading {
  const healthDelta = p1.health - p2.health;
  const boardDelta = boardPower(p1) - boardPower(p2);
  const handDelta = p1.hand.length - p2.hand.length;
  const energyDelta = p1.energy - p2.energy;

  const raw =
    WEIGHTS.health * healthDelta + WEIGHTS.board * boardDelta + WEIGHTS.hand * handDelta + WEIGHTS.energy * energyDelta;
  // Squash into a stable -100..100 display range instead of an unbounded
  // number that would make the gauge's scale meaningless turn to turn.
  const score = Math.max(-100, Math.min(100, Math.round((raw / 40) * 100)));

  const reasons: string[] = [];
  // Players by their agent names (render session 21): the gauge sits next
  // to both names, and "P1" meant nothing to a spectator.
  const ahead = (delta: number) => (delta > 0 ? p1.name : p2.name);
  if (Math.abs(healthDelta) >= 3) reasons.push(`${ahead(healthDelta)} ahead on health`);
  if (Math.abs(boardDelta) >= 4) reasons.push(`${ahead(boardDelta)} ahead on board`);
  if (Math.abs(handDelta) >= 2) reasons.push(`${ahead(handDelta)} has more cards in hand`);
  if (reasons.length === 0) reasons.push("close — no single clear edge yet");

  const leader: PlayerId | "even" = score > 8 ? "p1" : score < -8 ? "p2" : "even";
  return { score, leader, reasons };
}
