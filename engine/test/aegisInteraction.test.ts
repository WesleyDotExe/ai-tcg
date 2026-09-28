// Aegis defensive interaction (2026-09-19 owner feedback): "Aegis gets
// defensive answers, not removal" — intercepting/redirecting attacks,
// taxing what the opponent commits, and blunting what hits it. Three new
// mechanics, none of them destroy/remove — see data/aegisCards.ts's own
// header comment on this batch for the design reasoning.

import { test, expect } from "vitest";
import { Rng } from "../src/state/rng.js";
import { currentAttack } from "../src/state/queries.js";
import { effectiveCardCost } from "../src/state/queries.js";
import { applyMove } from "../src/engine/engine.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { applyDamage } from "../src/effects/resolver.js";
import { STARTING_HEALTH } from "../src/state/init.js";
import { aegisSentinel, aegisWarden, aegisCadet, interceptRoutine, tariffField, feedbackPlating } from "../src/data/aegisCards.js";
import { emptyState, putUnit, drainStack } from "./helpers.js";

test("Intercept Routine redirects a pending attack away from the player, onto a unit instead", () => {
  const state = emptyState();
  const rng = new Rng(41);
  const attacker = putUnit(state, "p1", aegisSentinel); // 3/4
  attacker.permanentBuff.health = 10; // survive the guardian's return hit for a clean assertion below
  const guardian = putUnit(state, "p2", aegisWarden); // 5/7 — survives the attacker's 3 damage easily
  const guardianInstanceId = guardian.instanceId;

  applyMove(state, { type: "attack", attackerInstanceId: attacker.instanceId, target: { kind: "player", playerId: "p2" } }, rng);
  applyMove(state, { type: "passPriority" }, rng); // hand priority to p2 so it gets a real response window

  state.players.p2.hand.push(interceptRoutine);
  state.players.p2.energy = 1;
  state.players.p2.maxEnergy = 1;
  const legal = getLegalMoves(state);
  const intercept = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === guardianInstanceId);
  expect(intercept, "redirecting the attack onto the guardian should be a legal Instant-speed response").toBeTruthy();
  applyMove(state, intercept!, rng);
  drainStack(state, rng); // Intercept Routine is a Command — it resolves off the stack, not immediately

  expect(state.log.some((e) => e.type === "attackRedirected"), "the redirect should be logged, real evidence, not just an inferred effect").toBe(true);
  expect(state.players.p2.health, "the original target (p2's face) must take zero damage — it was redirected away").toBe(STARTING_HEALTH);
  expect(guardian.damageTaken, "the new target should take the attacker's full power instead").toBe(3);
  // Unit-vs-unit combat is mutual (see engine.ts's resolveCombatDamage) —
  // stepping in front of an attack means the interceptor fights back too,
  // an emergent, thematically fitting consequence of redirecting onto a
  // unit rather than a purpose-built "block" mechanic. The attacker here is
  // an Aegis Sentinel, itself a base (for Aegis Warden) — its own baseArmor
  // (cards/types.ts's UnitCard.baseArmor, 2026-09-20 Phase 2 item 5) shaves
  // 1 off Warden's 5-power return hit, landing 4, not 5.
  expect(attacker.damageTaken, "the attacker should take the guardian's return damage, reduced by its own baseArmor").toBe(4);
});

test("Intercept Routine no-ops harmlessly (logged, not silent) when there's nothing pending to redirect", () => {
  const state = emptyState();
  const rng = new Rng(42);
  const defender = putUnit(state, "p1", aegisWarden);
  state.players.p1.hand.push(interceptRoutine);
  state.players.p1.energy = 1;
  state.players.p1.maxEnergy = 1;
  const legal = getLegalMoves(state);
  const cast = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === defender.instanceId);
  expect(cast, "Intercept Routine should still be castable proactively, with no attack on the stack").toBeTruthy();
  applyMove(state, cast!, rng);
  expect(() => drainStack(state, rng)).not.toThrow();
  expect(state.log.some((e) => e.type === "fizzle" && e.reason.includes("no pending attack")), "the no-op should be logged").toBe(true);
});

test("Intercept Routine onto the unit the attack already targets is a logged no-op, not a redirect", () => {
  // Found in real play (render attackFx scan, Null vs Aegis seed 3): the
  // engine logged attackRedirected with from === to, which the render and
  // commentators would read as the aim moving.
  const state = emptyState();
  const rng = new Rng(43);
  const attacker = putUnit(state, "p1", aegisSentinel);
  const guardian = putUnit(state, "p2", aegisWarden);
  applyMove(state, { type: "attack", attackerInstanceId: attacker.instanceId, target: { kind: "unit", instanceId: guardian.instanceId } }, rng);
  applyMove(state, { type: "passPriority" }, rng);
  state.players.p2.hand.push(interceptRoutine);
  state.players.p2.energy = 1;
  state.players.p2.maxEnergy = 1;
  const same = getLegalMoves(state).find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === guardian.instanceId);
  expect(same, "targeting the already-attacked unit is still legal (the card is Instant, any unit)").toBeTruthy();
  applyMove(state, same!, rng);
  drainStack(state, rng);
  expect(state.log.some((e) => e.type === "attackRedirected"), "nothing moved, so no redirect may be logged").toBe(false);
  expect(state.log.some((e) => e.type === "fizzle" && e.reason.includes("already aimed at")), "the no-op should be logged").toBe(true);
  expect(guardian.damageTaken, "the attack still lands on its original target").toBe(3);
});

test("Tariff Field taxes the opponent's card costs by 1, in both the cost math and legal-move gating", () => {
  const state = emptyState();
  state.players.p1.directives.push({ instanceId: "test-tariff", card: tariffField, controller: "p1" });

  expect(effectiveCardCost(state, "p2", aegisCadet), "an opponent of Tariff Field's controller pays cost + 1").toBe(aegisCadet.cost + 1);
  expect(effectiveCardCost(state, "p1", aegisCadet), "Tariff Field's own controller pays no tax").toBe(aegisCadet.cost);

  state.activePlayer = "p2";
  state.priority = "p2";
  state.players.p2.hand.push(aegisCadet); // cost 1, taxed to 2
  state.players.p2.energy = 1;
  state.players.p2.maxEnergy = 1;
  expect(
    getLegalMoves(state).some((m) => m.type === "playCard" && m.handIndex === 0),
    "1 energy should no longer afford a cost-1 card once Tariff Field taxes it to 2",
  ).toBe(false);

  state.players.p2.energy = 2;
  expect(
    getLegalMoves(state).some((m) => m.type === "playCard" && m.handIndex === 0),
    "2 energy should still afford the taxed cost — this blunts the curve, it doesn't lock cards out",
  ).toBe(true);
});

test("Feedback Plating blunts every enemy unit's attack for the rest of the turn whenever it's damaged", () => {
  const state = emptyState();
  const plating = putUnit(state, "p1", feedbackPlating); // 1/4
  const enemyA = putUnit(state, "p2", aegisCadet); // 1/2
  const enemyB = putUnit(state, "p2", aegisSentinel); // 3/4
  expect(currentAttack(state, enemyA)).toBe(1);
  expect(currentAttack(state, enemyB)).toBe(3);

  applyDamage(state, { kind: "unit", instanceId: plating.instanceId }, 1, "test hit", new Rng(1));

  expect(currentAttack(state, enemyA), "the whole enemy board should be blunted, clamped at 0, not just the attacker").toBe(0);
  expect(currentAttack(state, enemyB), "including units that never touched Feedback Plating").toBe(2);
});
