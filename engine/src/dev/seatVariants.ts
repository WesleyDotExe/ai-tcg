// Seat rules the measuring instruments can play (`--rules <id>`), beside the
// rules the game plays today.
//
// Session 68 measured four first-seat fixes here, test only (owner
// 2026-11-02). The owner picked "the player going second starts with 24
// health" and session 71 shipped it as rules-2 (engine/src/engine/versions.ts),
// so the losing three ((a) an extra opening card, (b) first-turn energy,
// (d) no first-turn attack) left the engine. Their numbers stay in
// progress/first-seat-002-fixes.txt and progress/first-seat-fixes/, where
// "shipped" means rules-1 (they were measured before the change).
//
// What is left: "shipped" (today's rules, rules-2) and "rules-1" (the old
// 20 and 20), so any instrument can show what the change did on the same
// seeds and deals.

import type { MatchRules } from "../state/types.js";
import { rulesOfVersion } from "../engine/versions.js";

export interface SeatVariant {
  id: string;
  label: string;
  rules: MatchRules;
}

export const SEAT_VARIANTS: SeatVariant[] = [
  { id: "shipped", label: "the rules as shipped (rules-2: second seat on 24)", rules: {} },
  { id: "rules-1", label: "rules-1 (before session 71: both on 20)", rules: rulesOfVersion("rules-1") },
];

export function seatVariant(id: string): SeatVariant {
  const v = SEAT_VARIANTS.find((x) => x.id === id);
  if (!v) throw new Error(`no seat variant "${id}" (one of ${SEAT_VARIANTS.map((x) => x.id).join(", ")})`);
  return v;
}
