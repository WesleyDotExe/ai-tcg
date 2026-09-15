// Regression test for a real stack-overflow bug found by
// dev/balanceReport.ts's Cortex-mirror matchup (session 7): two units whose
// onDamaged trigger deals damage to all enemy units (Retaliation Node) can
// end up on opposite sides of the board and retaliate against each other
// forever, because applyDamage kept firing a unit's onDamaged trigger even
// after that unit's health had already dropped to 0 or below — the "dead"
// unit isn't actually removed from the board until the whole cascade
// unwinds (see processDeaths), so nothing stopped it from continuing to
// react. Fixed in effects/resolver.ts by checking isAlive() before firing
// onDamaged.

import { test, expect } from "vitest";
import { Rng } from "../src/state/rng.js";
import { applyDamage } from "../src/effects/resolver.js";
import { retaliationNode } from "../src/data/cards.js";
import { emptyState, putUnit } from "./helpers.js";

test("two mutually-retaliating onDamaged units do not recurse forever", () => {
  const state = emptyState();
  const rng = new Rng(1);
  const a = putUnit(state, "p1", retaliationNode);
  const b = putUnit(state, "p2", retaliationNode);

  // A single point of damage to one Retaliation Node used to recurse
  // without bound (A hits B, B hits A, A hits B, ...) until the process
  // crashed with a stack overflow. This call must simply return.
  expect(() => applyDamage(state, { kind: "unit", instanceId: a.instanceId }, 1, "test", rng)).not.toThrow();

  // Both units have 3 health; the retaliation chain should have killed at
  // least one of them (each hit is 1 damage, bouncing back and forth) but
  // the game must still be in a sane, finite state, not silently corrupted.
  expect(a.damageTaken).toBeGreaterThan(0);
  expect(b.damageTaken).toBeGreaterThan(0);
});
