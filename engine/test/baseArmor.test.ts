// Phase 2 item 5 of the 2026-09-20 owner-feedback entry: "Keep the 'base
// must survive a turn' evolution rule, but let bases carry a small
// protection while unevolved (propose the mechanism at a checkpoint)." See
// cards/types.ts's UnitCard.baseArmor for the proposed mechanism: a flat,
// per-card damage reduction read straight off unit.card, so it disappears
// automatically the instant evolveUnit mutates the instance to the evolved
// form (which carries no baseArmor of its own). This proves the mechanism
// actually reduces damage, actually ends at evolution, and that every
// current evolution-line base in the pool (one per faction's line, plus
// Aegis/Null's own middle tier which is a base for a third tier) carries it.

import { test, expect } from "vitest";
import { Rng } from "../src/state/rng.js";
import { applyDamage } from "../src/effects/resolver.js";
import { currentHealth } from "../src/state/queries.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { applyMove } from "../src/engine/engine.js";
import { aegisCadet, aegisSentinel, aegisWarden } from "../src/data/aegisCards.js";
import { glitchSeed, corruptedProcess, kernelPanic } from "../src/data/nullCards.js";
import { initDaemon, compiledDaemon, swarmLarva, moltedStalker } from "../src/data/cards.js";
import { emptyState, putUnit } from "./helpers.js";

test.each([
  ["Aegis", aegisCadet, aegisSentinel, aegisWarden] as const,
  ["Null", glitchSeed, corruptedProcess, kernelPanic] as const,
])("%s's evolution line: both bases carry baseArmor 1, the top tier carries none", (_faction, base, mid, top) => {
  expect(base.baseArmor).toBe(1);
  expect(mid.baseArmor).toBe(1);
  expect(top.baseArmor).toBeUndefined();
});

test.each([
  ["Cortex", initDaemon, compiledDaemon] as const,
  ["Swarm", swarmLarva, moltedStalker] as const,
])("%s's single-tier evolution line: the base carries baseArmor 1, the evolved form carries none", (_faction, base, evolved) => {
  expect(base.baseArmor).toBe(1);
  expect(evolved.baseArmor).toBeUndefined();
});

test("base armor reduces incoming damage by its flat amount, floored at 0, and logs the reduction", () => {
  const state = emptyState();
  const rng = new Rng(1);
  const cadet = putUnit(state, "p1", aegisCadet); // baseArmor 1, health 2

  applyDamage(state, { kind: "unit", instanceId: cadet.instanceId }, 1, "test ping", rng);
  expect(currentHealth(state, cadet), "1 damage against 1 armor should be fully absorbed").toBe(2);
  expect(
    state.log.some((e) => e.type === "baseArmorReduced" && e.unit === "Aegis Cadet" && e.rawAmount === 1 && e.reducedTo === 0),
    "the absorption should be logged, not silently dropped",
  ).toBe(true);
  expect(state.log.some((e) => e.type === "damage"), "a fully-absorbed hit should not also log a 'damage' event").toBe(false);

  applyDamage(state, { kind: "unit", instanceId: cadet.instanceId }, 3, "test burst", rng);
  expect(currentHealth(state, cadet), "3 damage against 1 armor should land as 2 — reduced, not blocked outright").toBe(0);
  expect(state.log.some((e) => e.type === "baseArmorReduced" && e.rawAmount === 3 && e.reducedTo === 2)).toBe(true);
  expect(state.log.some((e) => e.type === "damage" && e.amount === 2)).toBe(true);
});

test("a fully-absorbed hit does not fire onDamaged and does not consume Barrier", () => {
  const state = emptyState();
  const rng = new Rng(2);
  const cadet = putUnit(state, "p1", aegisCadet);
  cadet.statuses.push({ kind: "Barrier", duration: "untilConsumed" });

  applyDamage(state, { kind: "unit", instanceId: cadet.instanceId }, 1, "test ping", rng);

  expect(currentHealth(state, cadet)).toBe(2);
  expect(cadet.statuses.some((s) => s.kind === "Barrier"), "Barrier should still be up — nothing got through to test it against").toBe(true);
  expect(state.log.some((e) => e.type === "barrierAbsorbed")).toBe(false);
});

test("evolving a base ends its protection immediately — the same instance takes full damage afterward", () => {
  const state = emptyState();
  const rng = new Rng(3);
  const cadet = putUnit(state, "p1", aegisCadet);
  cadet.enteredTurn = state.turnNumber - 1; // must have survived a turn boundary to be a legal evolve target
  state.players.p1.hand.push(aegisSentinel);
  state.players.p1.energy = aegisSentinel.cost;
  state.players.p1.maxEnergy = aegisSentinel.cost;

  const legal = getLegalMoves(state);
  const evolveMove = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === cadet.instanceId);
  expect(evolveMove, "evolving the cadet into a sentinel should be legal").toBeTruthy();
  applyMove(state, evolveMove!, rng);

  expect(cadet.card.id).toBe("AG-007"); // same instance, mutated to the evolved form
  expect(cadet.card.baseArmor, "the evolved form (Sentinel) is itself a base, so it keeps baseArmor 1 — not gone yet").toBe(1);

  // Deal 1 damage: Sentinel's own baseArmor should still absorb it.
  applyDamage(state, { kind: "unit", instanceId: cadet.instanceId }, 1, "test ping", rng);
  expect(currentHealth(state, cadet)).toBe(4); // Sentinel's own health, undamaged

  // Now evolve again into the top tier (Warden), which carries no baseArmor.
  cadet.enteredTurn = state.turnNumber - 1;
  state.players.p1.hand.push(aegisWarden);
  state.players.p1.energy = aegisWarden.cost;
  state.players.p1.maxEnergy = aegisWarden.cost;
  const legal2 = getLegalMoves(state);
  const evolveMove2 = legal2.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === cadet.instanceId);
  expect(evolveMove2, "evolving the sentinel into a warden should be legal").toBeTruthy();
  applyMove(state, evolveMove2!, rng);
  expect(cadet.card.id).toBe("AG-013");
  expect(cadet.card.baseArmor, "the top tier carries no protection at all").toBeUndefined();

  // Warden's own evolve-in ability grants Barrier (see aegisCards.ts) —
  // strip it here so this final check isolates baseArmor specifically,
  // Barrier's own absorption already being covered by an earlier test above.
  cadet.statuses = cadet.statuses.filter((s) => s.kind !== "Barrier");
  const healthBefore = currentHealth(state, cadet);
  applyDamage(state, { kind: "unit", instanceId: cadet.instanceId }, 1, "test ping", rng);
  expect(currentHealth(state, cadet), "with no baseArmor left, even a 1-damage ping should land in full").toBe(healthBefore - 1);
});

test("base armor also mitigates combat damage, not just effect damage — the single applyDamage choke point covers both", () => {
  const state = emptyState();
  const rng = new Rng(4);
  const cadet = putUnit(state, "p1", aegisCadet); // 1/2, baseArmor 1
  cadet.enteredTurn = state.turnNumber - 1;
  const attacker = putUnit(state, "p2", { ...swarmLarva, attack: 1 }); // a 1-attack unit
  attacker.enteredTurn = state.turnNumber - 1;

  state.activePlayer = "p2";
  state.priority = "p2";
  const legal = getLegalMoves(state);
  const attackMove = legal.find(
    (m) => m.type === "attack" && m.attackerInstanceId === attacker.instanceId && m.target.kind === "unit" && m.target.instanceId === cadet.instanceId,
  );
  expect(attackMove, "the attacker should have a legal attack against the cadet").toBeTruthy();
  applyMove(state, attackMove!, rng);
  applyMove(state, { type: "passPriority" }, rng);
  applyMove(state, { type: "passPriority" }, rng);

  expect(currentHealth(state, cadet), "a 1-attack hit against 1 baseArmor should be fully absorbed, same as effect damage").toBe(2);
});
