// The first-seat fixes the owner asked to measure (2026-11-02, on session
// 67's check-in: the first seat wins about 65%). Test only: these are the
// `rules` the measuring instruments pass to runMatch; no match the game
// plays uses one until the owner picks a fix.
//
//   (a) the second player draws one extra card in its opening hand;
//   (b) the second player gets +1 energy on its first turn only;
//   (c) the second player starts with more health (22 instead of 20);
//   (d) the first player can't attack on its first turn.
//
// Besides the four as asked, a few doses and pairs, labelled as extras, so
// the check-in can say how far each lever moves the seat and whether one
// alone is enough.

import type { MatchRules } from "../state/types.js";

export interface SeatVariant {
  id: string;
  label: string;
  rules: MatchRules;
  /** One of the four the owner named (the rest are extras). */
  asked: boolean;
}

export const SEAT_VARIANTS: SeatVariant[] = [
  { id: "shipped", label: "the rules as shipped", rules: {}, asked: true },
  { id: "a", label: "(a) second seat +1 card in the opening hand", rules: { secondSeatExtraOpeningCards: 1 }, asked: true },
  { id: "b", label: "(b) second seat +1 energy on its first turn", rules: { secondSeatFirstTurnEnergy: 1 }, asked: true },
  { id: "c", label: "(c) second seat starts on 22 health", rules: { secondSeatExtraHealth: 2 }, asked: true },
  { id: "d", label: "(d) first seat can't attack on its first turn", rules: { firstSeatNoFirstTurnAttack: true }, asked: true },
  { id: "c4", label: "extra: second seat starts on 24 health", rules: { secondSeatExtraHealth: 4 }, asked: false },
  { id: "a2", label: "extra: second seat +2 cards in the opening hand", rules: { secondSeatExtraOpeningCards: 2 }, asked: false },
  { id: "b2", label: "extra: second seat +2 energy on its first turn", rules: { secondSeatFirstTurnEnergy: 2 }, asked: false },
  { id: "ab", label: "extra: (a) and (b) together", rules: { secondSeatExtraOpeningCards: 1, secondSeatFirstTurnEnergy: 1 }, asked: false },
  { id: "ac", label: "extra: (a) and (c) together", rules: { secondSeatExtraOpeningCards: 1, secondSeatExtraHealth: 2 }, asked: false },
  { id: "bc", label: "extra: (b) and (c) together", rules: { secondSeatFirstTurnEnergy: 1, secondSeatExtraHealth: 2 }, asked: false },
];

export function seatVariant(id: string): SeatVariant {
  const v = SEAT_VARIANTS.find((x) => x.id === id);
  if (!v) throw new Error(`no seat variant "${id}" (one of ${SEAT_VARIANTS.map((x) => x.id).join(", ")})`);
  return v;
}
