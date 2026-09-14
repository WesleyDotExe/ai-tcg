// Shared whitebox test setup, used across the engine's vitest suites. Split
// out of the old dev/effectSystemDemo.ts (a manually-run assertion script)
// so the same scenarios now run as real, individually-reported, CI-able
// tests instead of a printout someone has to remember to re-run by hand —
// see progress/quality-debt.md's "no real test runner" entry and the
// owner's 2026-09-13 stage-3 checkpoint feedback endorsing this as the
// next session's priority.

import { expect } from "vitest";
import { createInitialState } from "../src/state/init.js";
import { Rng } from "../src/state/rng.js";
import { applyMove } from "../src/engine/engine.js";
import type { GameState, PlayerId, UnitInstance } from "../src/state/types.js";
import type { UnitCard } from "../src/cards/types.js";

/** Bare, empty two-player state for whitebox setup — no cards in either
 * deck, since scenarios place units directly rather than drawing them. */
export function emptyState(): GameState {
  const rng = new Rng(42);
  return createInitialState({ id: "p1", name: "P1", cards: [] }, { id: "p2", name: "P2", cards: [] }, rng);
}

export function putUnit(state: GameState, controller: PlayerId, card: UnitCard, damageTaken = 0): UnitInstance {
  const unit: UnitInstance = {
    instanceId: `test-u${state.nextInstanceId++}`,
    card,
    controller,
    permanentBuff: { attack: 0, health: 0 },
    turnBuff: { attack: 0, health: 0 },
    damageTaken,
    statuses: card.keywords.includes("Barrier") ? [{ kind: "Barrier", duration: "untilConsumed" }] : [],
    enteredTurn: state.turnNumber,
    hasAttackedThisTurn: false,
    tools: [],
  };
  state.players[controller].board.push(unit);
  return unit;
}

/** Casting a Command or activating an ability only queues it on the stack
 * (see engine/engine.ts) — it takes two consecutive passPriority moves per
 * stack item to actually resolve it. This drains the whole stack the same
 * way a real match's priority loop would once nobody has anything left to
 * respond with, so scenarios that don't care about priority itself can
 * still assert on the resolved effect. */
export function drainStack(state: GameState, rng: Rng): void {
  let guard = 0;
  while (state.stack.length > 0 && guard++ < 20) {
    applyMove(state, { type: "passPriority" }, rng);
    applyMove(state, { type: "passPriority" }, rng);
  }
  expect(guard, "drainStack: stack never emptied — possible infinite loop in the priority algorithm").toBeLessThan(20);
}
