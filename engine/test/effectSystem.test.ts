// Deterministic, assertion-based proof that the effect system actually
// resolves every mechanic category DESIGN.md's "no shortcuts" section calls
// out by name: keywords, triggered abilities, activated abilities,
// static/continuous auras, targeted effects, AOE, conditionals, and
// state-mutating (board-scaling) stats — plus a cross-card cascade, and the
// Magic-style priority/stack algorithm (LIFO resolution, real cross-turn
// instant-speed responses).
//
// Ported from the old dev/effectSystemDemo.ts (a manually-run script) into
// real vitest tests, one per scenario, so a regression shows up as a named
// failing test instead of requiring someone to remember to re-run a script
// by hand. This is a whitebox suite, not a played match (see cli.ts /
// match.ts for that): it builds small controlled board states directly so
// each scenario is deterministic and isolated.

import { describe, test, expect } from "vitest";
import assert from "node:assert/strict";
import { Rng } from "../src/state/rng.js";
import { currentAttack, currentHealth, findUnit } from "../src/state/queries.js";
import { applyMove } from "../src/engine/engine.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { applyDamage } from "../src/effects/resolver.js";
import {
  signalDrone,
  firewallSentinel,
  barrierNode,
  swarmLarva,
  diagnosticPulse,
  cascadePurge,
  backupProtocol,
  mainframeCore,
  cortexEngineer,
  recursiveConstruct,
  overclockBeast,
  retaliationNode,
  failsafeUnit,
  interruptHandler,
  reflexSpike,
} from "../src/data/cards.js";
import type { UnitCard } from "../src/cards/types.js";
import type { PlayerId } from "../src/state/types.js";
import { emptyState, putUnit, drainStack } from "./helpers.js";

describe("keywords", () => {
  test("Rush lets a unit attack the turn it's played", () => {
    const state = emptyState();
    const rng = new Rng(1);
    state.players.p1.hand.push(signalDrone); // has Rush
    state.players.p1.energy = 1;
    state.players.p1.maxEnergy = 1;
    applyMove(state, { type: "playCard", handIndex: 0 }, rng);
    const drone = state.players.p1.board[0]!;
    expect(drone.enteredTurn, "unit entered this same turn").toBe(state.turnNumber);
    const legal = getLegalMoves(state);
    const canAttack = legal.some((m) => m.type === "attack" && m.attackerInstanceId === drone.instanceId);
    expect(canAttack, "Rush unit should have a legal attack move despite entering play this turn").toBe(true);
  });

  test("Guard forces attacks onto the guarding unit", () => {
    const state = emptyState();
    putUnit(state, "p1", signalDrone);
    putUnit(state, "p2", swarmLarva); // no Guard
    const guard = putUnit(state, "p2", firewallSentinel); // Guard
    const legal = getLegalMoves(state);
    const attackMoves = legal.filter((m) => m.type === "attack");
    expect(attackMoves.length, "there should be legal attacks").toBeGreaterThan(0);
    for (const move of attackMoves) {
      assert.ok(move.type === "attack");
      expect(move.target, "every attack must target the Guard unit").toEqual({ kind: "unit", instanceId: guard.instanceId });
    }
  });

  test("Barrier absorbs exactly one instance of damage", () => {
    const state = emptyState();
    const rng = new Rng(2);
    const shielded = putUnit(state, "p1", barrierNode);
    expect(shielded.statuses.some((s) => s.kind === "Barrier"), "Barrier Node should enter play with a Barrier status").toBe(true);

    applyDamage(state, { kind: "unit", instanceId: shielded.instanceId }, 5, "test-hit-1", rng);
    expect(shielded.damageTaken, "first hit should be fully absorbed").toBe(0);
    expect(shielded.statuses.some((s) => s.kind === "Barrier"), "Barrier should be consumed after absorbing").toBe(false);

    applyDamage(state, { kind: "unit", instanceId: shielded.instanceId }, 1, "test-hit-2", rng);
    expect(shielded.damageTaken, "second hit should land normally, no Barrier left").toBe(1);
  });
});

test("triggered onPlay ability resolves a targeted effect", () => {
  const state = emptyState();
  const rng = new Rng(3);
  // signalDrone, not swarmLarva: a plain damage target with no baseArmor
  // (see cards/types.ts's UnitCard.baseArmor, added 2026-09-20 Phase 2 item
  // 5) — this test is about the targeted-damage mechanism, not about
  // Swarm Larva's own new mitigation, which would otherwise eat into the
  // exact damage amount asserted below.
  const target = putUnit(state, "p2", signalDrone);
  state.players.p1.hand.push(diagnosticPulse);
  state.players.p1.energy = 1;
  state.players.p1.maxEnergy = 1;
  applyMove(state, { type: "playCard", handIndex: 0, target: { kind: "unit", instanceId: target.instanceId } }, rng);
  expect(currentHealth(state, target), "a cast Command should sit on the stack, not resolve immediately").toBe(target.card.health);
  drainStack(state, rng);
  expect(currentHealth(state, target), "Diagnostic Pulse should deal exactly 2 targeted damage once it resolves off the stack").toBe(
    target.card.health - 2,
  );
});

test("AOE effect hits every legal target, not just one", () => {
  const state = emptyState();
  const rng = new Rng(4);
  // signalDrone, not swarmLarva — same reasoning as the targeted-damage test
  // above: this test is about AOE reaching every target, not about Swarm
  // Larva's baseArmor.
  const enemyA = putUnit(state, "p2", signalDrone);
  const enemyB = putUnit(state, "p2", signalDrone);
  const ally = putUnit(state, "p1", signalDrone);
  state.players.p1.hand.push(cascadePurge);
  state.players.p1.energy = 4;
  state.players.p1.maxEnergy = 4;
  applyMove(state, { type: "playCard", handIndex: 0 }, rng);
  drainStack(state, rng);
  expect(currentHealth(state, enemyA), "enemy A should take AOE damage").toBe(enemyA.card.health - 2);
  expect(currentHealth(state, enemyB), "enemy B should take AOE damage").toBe(enemyB.card.health - 2);
  expect(currentHealth(state, ally), "ally on the caster's own side must be untouched (filter side=opponent)").toBe(ally.card.health);
});

test("conditional effect branches on live game state (both directions)", () => {
  const lowHealthState = emptyState();
  const rng1 = new Rng(5);
  // The heal resolves before the threshold check (effects run in order), so
  // the condition reads POST-heal health: starting at 6 lands on 9, which
  // is still <=10 and should fire the draw.
  lowHealthState.players.p1.health = 6;
  lowHealthState.players.p1.deck.push(swarmLarva); // something for the conditional draw to actually draw
  lowHealthState.players.p1.hand.push(backupProtocol);
  lowHealthState.players.p1.energy = 2;
  lowHealthState.players.p1.maxEnergy = 2;
  const handBefore = lowHealthState.players.p1.hand.length; // includes the card about to be cast
  applyMove(lowHealthState, { type: "playCard", handIndex: 0 }, rng1);
  drainStack(lowHealthState, rng1);
  expect(lowHealthState.players.p1.health, "Backup Protocol should heal 3 (6 -> 9)").toBe(9);
  expect(lowHealthState.players.p1.hand.length, "at <=10 post-heal health the conditional draw should replace the cast card").toBe(
    handBefore,
  );

  const fullHealthState = emptyState();
  const rng2 = new Rng(6);
  fullHealthState.players.p1.health = 20; // above threshold
  fullHealthState.players.p1.hand.push(backupProtocol);
  fullHealthState.players.p1.energy = 2;
  fullHealthState.players.p1.maxEnergy = 2;
  const handBefore2 = fullHealthState.players.p1.hand.length;
  applyMove(fullHealthState, { type: "playCard", handIndex: 0 }, rng2);
  drainStack(fullHealthState, rng2);
  expect(fullHealthState.players.p1.hand.length, "above the threshold, no draw — hand should just shrink by the cast card").toBe(
    handBefore2 - 1,
  );
});

test("activated ability spends energy and applies its effect", () => {
  const state = emptyState();
  const rng = new Rng(7);
  const engineer = putUnit(state, "p1", cortexEngineer, 2); // 3 base health, 2 damage taken
  state.players.p1.energy = 1;
  state.players.p1.maxEnergy = 1;
  const legal = getLegalMoves(state);
  const activate = legal.find((m) => m.type === "activateAbility" && m.sourceInstanceId === engineer.instanceId);
  expect(activate, "activated ability should be legal with enough energy").toBeTruthy();
  applyMove(state, activate!, rng);
  expect(state.players.p1.energy, "activating should spend its energy cost immediately, even before it resolves").toBe(0);
  drainStack(state, rng);
  expect(currentHealth(state, engineer), "healed back to full (2 damage - 2 heal) once the ability resolves off the stack").toBe(
    engineer.card.health,
  );
});

test("static aura buffs live units with no explicit recompute call", () => {
  const state = emptyState();
  const ally = putUnit(state, "p1", swarmLarva);
  expect(currentAttack(state, ally), "baseline attack with no aura").toBe(1);
  const directive = { instanceId: "test-d1", card: mainframeCore, controller: "p1" as PlayerId };
  state.players.p1.directives.push(directive);
  expect(currentAttack(state, ally), "aura should apply the instant it's in play, no cache to refresh").toBe(2);
  expect(currentHealth(state, ally), "aura's health bonus should apply too").toBe(ally.card.health + 1);
  state.players.p1.directives.pop();
  expect(currentAttack(state, ally), "removing the aura source should revert stats immediately — nothing is stale").toBe(1);
});

test("unit stats mutate live with board state, both attack- and health-scaling", () => {
  const state = emptyState();
  const construct = putUnit(state, "p1", recursiveConstruct);
  expect(currentAttack(state, construct), "attack = number of controller units in play (itself = 1)").toBe(1);
  putUnit(state, "p1", swarmLarva);
  expect(currentAttack(state, construct), "adding a second allied unit should raise attack live").toBe(2);

  const beast = putUnit(state, "p2", overclockBeast);
  expect(currentHealth(state, beast), "health = 2 + opponent's unit count (p1 already has 2 units in play)").toBe(4);
  putUnit(state, "p1", swarmLarva);
  expect(currentHealth(state, beast), "a third opposing unit should raise the beast's health to 5").toBe(5);
});

test("a multi-card combo: onDamaged triggers an AOE that kills a unit, cascading into its onDeath", () => {
  const state = emptyState();
  const rng = new Rng(8);
  const node = putUnit(state, "p1", retaliationNode); // onDamaged: 1 dmg to ALL enemy units
  const fragileFailsafe = putUnit(state, "p2", failsafeUnit, 1); // 2 health, 1 damage already taken -> exactly 1 hit from death
  const sturdyBystander = putUnit(state, "p2", firewallSentinel); // 5 health, should survive the 1 damage
  state.players.p2.deck.push(swarmLarva); // something for fragileFailsafe's onDeath draw to actually draw

  const drawsBefore = state.players.p2.hand.length;
  // A single point of damage to Retaliation Node triggers its onDamaged
  // ability, which is what actually kills fragileFailsafe and fires ITS
  // onDeath — this is the chain under test, not the setup hit itself.
  applyDamage(state, { kind: "unit", instanceId: node.instanceId }, 1, "test-provoke", rng);

  expect(findUnit(state, fragileFailsafe.instanceId), "the 1hp Fail-safe Unit should have died to the retaliation AOE").toBeUndefined();
  expect(state.players.p2.hand.length, "its onDeath should have drawn its controller a card").toBe(drawsBefore + 1);
  expect(findUnit(state, sturdyBystander.instanceId), "the 5-health Sentinel should have survived the same AOE tick").toBeTruthy();
  expect(currentHealth(state, sturdyBystander), "and still shows the 1 damage it took").toBe(sturdyBystander.card.health - 1);
});

test(
  "priority passes correctly between players, and a same-window instant-speed response resolves before (and changes the outcome of) the spell it responded to",
  () => {
    const state = emptyState();
    const rng = new Rng(9);
    const engineer = putUnit(state, "p1", cortexEngineer, 1); // 3 base health, 1 damage taken -> 2 current health
    state.players.p2.hand.push(interruptHandler); // Instant, 2 cost, 2 damage to target enemy unit
    state.players.p2.energy = 2;
    state.players.p2.maxEnergy = 2;
    state.players.p1.energy = 1; // for the engineer's own Instant repair ability (cost 1)
    state.players.p1.maxEnergy = 1;

    // Hand priority to p2 first (even though it's p1's default turn/active
    // player) to prove priority is a real, independent thing an agent can
    // hold and act on, not just a synonym for "whose turn is it."
    state.priority = "p2";
    applyMove(state, { type: "playCard", handIndex: 0, target: { kind: "unit", instanceId: engineer.instanceId } }, rng);
    expect(state.stack.length, "the removal spell should be queued on the stack, not resolved immediately").toBe(1);
    expect(currentHealth(state, engineer), "no damage should land until the spell actually resolves").toBe(2);

    applyMove(state, { type: "passPriority" }, rng); // p2 passes, opening a real response window
    expect(state.priority, "p1 should now hold priority, with a chance to respond before the spell resolves").toBe("p1");

    const legal = getLegalMoves(state);
    const repair = legal.find((m) => m.type === "activateAbility" && m.sourceInstanceId === engineer.instanceId);
    expect(repair, "p1 should have a legal Instant-speed response available, not just a forced pass").toBeTruthy();
    applyMove(state, repair!, rng); // p1 responds with the engineer's own instant repair, on top of the removal spell
    expect(state.stack.length, "both the removal spell and the response should now be stacked").toBe(2);

    applyMove(state, { type: "passPriority" }, rng); // p1 passes back...
    applyMove(state, { type: "passPriority" }, rng); // ...and p2 has nothing left to add: the TOP of the stack resolves
    expect(state.stack.length, "only the response should have resolved — the removal spell is still waiting underneath").toBe(1);
    expect(
      currentHealth(state, engineer),
      "the response (last on, first resolved — LIFO) should heal the engineer to full BEFORE the removal spell hits",
    ).toBe(3);

    applyMove(state, { type: "passPriority" }, rng);
    applyMove(state, { type: "passPriority" }, rng); // now the removal spell resolves
    expect(state.stack.length, "the stack should be empty now").toBe(0);
    expect(
      currentHealth(state, engineer),
      "3 (post-heal max) - 2 (the removal spell, resolving after the heal) = 1: the reactive play kept the unit alive",
    ).toBe(1);
  },
);

test("an instant-speed combat trick resolves before combat damage and changes who survives the trade", () => {
  const state = emptyState();
  const rng = new Rng(10);
  const testAttacker: UnitCard = {
    id: "test-atk",
    name: "Test Attacker",
    faction: "Swarm",
    rarity: "Common",
    cost: 1,
    type: "Unit",
    attack: 2,
    health: 2,
    keywords: [],
    art: "placeholder",
    flavor: "",
    abilities: [],
  };
  const testDefender: UnitCard = {
    id: "test-def",
    name: "Test Defender",
    faction: "Cortex",
    rarity: "Common",
    cost: 1,
    type: "Unit",
    attack: 2,
    health: 2,
    keywords: [],
    art: "placeholder",
    flavor: "",
    abilities: [],
  };
  const attacker = putUnit(state, "p1", testAttacker);
  const defender = putUnit(state, "p2", testDefender);
  state.players.p2.hand.push(reflexSpike); // Instant, +0/+3 to target friendly unit
  state.players.p2.energy = 1;
  state.players.p2.maxEnergy = 1;

  applyMove(state, { type: "attack", attackerInstanceId: attacker.instanceId, target: { kind: "unit", instanceId: defender.instanceId } }, rng);
  expect(state.stack.length, "combat damage should be pending on the stack, not applied on declaration").toBe(1);
  expect(currentHealth(state, defender), "no damage should have landed yet").toBe(2);

  applyMove(state, { type: "passPriority" }, rng); // p1 (holding priority after declaring) passes
  expect(state.priority, "the defending player gets a real window to respond before damage resolves").toBe("p2");

  const legal = getLegalMoves(state);
  const trick = legal.find((m) => m.type === "playCard");
  expect(trick, "p2 should have a legal Instant-speed trick available in response to the attack").toBeTruthy();
  applyMove(state, trick!, rng); // p2 casts Reflex Spike on their own defender — now on top of the pending combat damage
  applyMove(state, { type: "passPriority" }, rng);
  applyMove(state, { type: "passPriority" }, rng); // top of stack resolves first (LIFO): the trick, not the combat damage yet
  expect(currentHealth(state, defender), "the trick should resolve before combat damage: 2 base + 3 buff, 0 damage taken yet").toBe(5);

  applyMove(state, { type: "passPriority" }, rng);
  applyMove(state, { type: "passPriority" }, rng); // now combat damage resolves, computed live against the now-buffed defender

  expect(
    currentHealth(state, defender),
    "2 base health + 3 from the trick - 2 combat damage = 3: the trick saved a unit that would otherwise have died",
  ).toBe(3);
  expect(findUnit(state, attacker.instanceId), "the attacker should still have died to the (unbuffed) defender's own return damage").toBeUndefined();
});
