// A deterministic, assertion-based demonstration that the effect system
// actually resolves every mechanic category DESIGN.md's "no shortcuts"
// section calls out by name: keywords, triggered abilities, activated
// abilities, static/continuous auras, targeted effects, AOE, conditionals,
// and state-mutating (board-scaling) stats — plus a cross-card cascade to
// prove trigger chains resolve correctly, not just single effects in
// isolation.
//
// This is a whitebox harness, not a played match (see cli.ts / match.ts for
// that): it builds small controlled board states directly so each scenario
// is deterministic and isolated, then asserts real outcomes with
// node:assert. A failed assertion throws and exits non-zero — this is a
// real check, not a printout of claims.

import assert from "node:assert/strict";
import { createInitialState } from "../state/init.js";
import { Rng } from "../state/rng.js";
import type { GameState, PlayerId, UnitInstance } from "../state/types.js";
import { currentAttack, currentHealth, findUnit } from "../state/queries.js";
import { applyMove } from "../engine/engine.js";
import { getLegalMoves } from "../engine/moves.js";
import { applyDamage } from "../effects/resolver.js";
import {
  signalDrone,
  firewallSentinel,
  barrierNode,
  swarmLarva,
  diagnosticPulse,
  cascadePurge,
  backupProtocol,
  mainframeCore,
  failsafeUnit,
  cortexEngineer,
  recursiveConstruct,
  overclockBeast,
  retaliationNode,
} from "../data/cards.js";
import type { UnitCard } from "../cards/types.js";

let scenarioCount = 0;

function scenario(title: string, run: () => void): void {
  scenarioCount++;
  run();
  console.log(`  PASS  [${scenarioCount}] ${title}`);
}

/** Bare, empty two-player state for whitebox setup — no cards in either
 * deck, since scenarios place units directly rather than drawing them. */
function emptyState(): GameState {
  const rng = new Rng(42);
  return createInitialState({ id: "p1", name: "P1", cards: [] }, { id: "p2", name: "P2", cards: [] }, rng);
}

function putUnit(state: GameState, controller: PlayerId, card: UnitCard, damageTaken = 0): UnitInstance {
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
  };
  state.players[controller].board.push(unit);
  return unit;
}

console.log("AI-TCG effect system demo — deterministic mechanic-by-mechanic proof\n");

// --- 1. Keyword: Rush ------------------------------------------------------
scenario("Keyword Rush lets a unit attack the turn it's played", () => {
  const state = emptyState();
  const rng = new Rng(1);
  state.players.p1.hand.push(signalDrone); // has Rush
  state.players.p1.energy = 1;
  state.players.p1.maxEnergy = 1;
  applyMove(state, { type: "playCard", handIndex: 0 }, rng);
  const drone = state.players.p1.board[0]!;
  assert.equal(drone.enteredTurn, state.turnNumber, "unit entered this same turn");
  const legal = getLegalMoves(state);
  const canAttack = legal.some((m) => m.type === "attack" && m.attackerInstanceId === drone.instanceId);
  assert.ok(canAttack, "Rush unit should have a legal attack move despite entering play this turn");
});

// --- 2. Keyword: Guard ------------------------------------------------------
scenario("Keyword Guard forces attacks onto the guarding unit", () => {
  const state = emptyState();
  putUnit(state, "p1", signalDrone);
  putUnit(state, "p2", swarmLarva); // no Guard
  const guard = putUnit(state, "p2", firewallSentinel); // Guard
  const legal = getLegalMoves(state);
  const attackMoves = legal.filter((m) => m.type === "attack");
  assert.ok(attackMoves.length > 0, "there should be legal attacks");
  for (const move of attackMoves) {
    assert.ok(move.type === "attack");
    assert.deepEqual(move.target, { kind: "unit", instanceId: guard.instanceId }, "every attack must target the Guard unit");
  }
});

// --- 3. Keyword: Barrier ----------------------------------------------------
scenario("Keyword Barrier absorbs exactly one instance of damage", () => {
  const state = emptyState();
  const rng = new Rng(2);
  const shielded = putUnit(state, "p1", barrierNode);
  assert.ok(shielded.statuses.some((s) => s.kind === "Barrier"), "Barrier Node should enter play with a Barrier status");

  applyDamage(state, { kind: "unit", instanceId: shielded.instanceId }, 5, "test-hit-1", rng);
  assert.equal(shielded.damageTaken, 0, "first hit should be fully absorbed");
  assert.ok(!shielded.statuses.some((s) => s.kind === "Barrier"), "Barrier should be consumed after absorbing");

  applyDamage(state, { kind: "unit", instanceId: shielded.instanceId }, 1, "test-hit-2", rng);
  assert.equal(shielded.damageTaken, 1, "second hit should land normally, no Barrier left");
});

// --- 4. Triggered: onPlay, targeted -----------------------------------------
scenario("Triggered onPlay ability resolves a targeted effect", () => {
  const state = emptyState();
  const rng = new Rng(3);
  const target = putUnit(state, "p2", swarmLarva);
  state.players.p1.hand.push(diagnosticPulse);
  state.players.p1.energy = 1;
  state.players.p1.maxEnergy = 1;
  applyMove(state, { type: "playCard", handIndex: 0, target: { kind: "unit", instanceId: target.instanceId } }, rng);
  assert.equal(currentHealth(state, target), target.card.health - 2, "Diagnostic Pulse should deal exactly 2 targeted damage");
});

// --- 5. AOE ------------------------------------------------------------------
scenario("AOE effect hits every legal target, not just one", () => {
  const state = emptyState();
  const rng = new Rng(4);
  const enemyA = putUnit(state, "p2", swarmLarva);
  const enemyB = putUnit(state, "p2", swarmLarva);
  const ally = putUnit(state, "p1", swarmLarva);
  state.players.p1.hand.push(cascadePurge);
  state.players.p1.energy = 4;
  state.players.p1.maxEnergy = 4;
  applyMove(state, { type: "playCard", handIndex: 0 }, rng);
  assert.equal(currentHealth(state, enemyA), enemyA.card.health - 2, "enemy A should take AOE damage");
  assert.equal(currentHealth(state, enemyB), enemyB.card.health - 2, "enemy B should take AOE damage");
  assert.equal(currentHealth(state, ally), ally.card.health, "ally on the caster's own side must be untouched (filter side=opponent)");
});

// --- 6. Conditional ----------------------------------------------------------
scenario("Conditional effect branches on live game state (both directions)", () => {
  const lowHealthState = emptyState();
  const rng1 = new Rng(5);
  // The heal resolves before the threshold check (effects run in order),
  // so the condition reads POST-heal health: starting at 6 lands on 9,
  // which is still <=10 and should fire the draw.
  lowHealthState.players.p1.health = 6;
  lowHealthState.players.p1.deck.push(swarmLarva); // something for the conditional draw to actually draw
  lowHealthState.players.p1.hand.push(backupProtocol);
  lowHealthState.players.p1.energy = 2;
  lowHealthState.players.p1.maxEnergy = 2;
  const handBefore = lowHealthState.players.p1.hand.length; // includes the card about to be cast
  applyMove(lowHealthState, { type: "playCard", handIndex: 0 }, rng1);
  assert.equal(lowHealthState.players.p1.health, 9, "Backup Protocol should heal 3 (6 -> 9)");
  assert.equal(lowHealthState.players.p1.hand.length, handBefore, "at <=10 post-heal health the conditional draw should replace the cast card");

  const fullHealthState = emptyState();
  const rng2 = new Rng(6);
  fullHealthState.players.p1.health = 20; // above threshold
  fullHealthState.players.p1.hand.push(backupProtocol);
  fullHealthState.players.p1.energy = 2;
  fullHealthState.players.p1.maxEnergy = 2;
  const handBefore2 = fullHealthState.players.p1.hand.length;
  applyMove(fullHealthState, { type: "playCard", handIndex: 0 }, rng2);
  assert.equal(fullHealthState.players.p1.hand.length, handBefore2 - 1, "above the threshold, no draw — hand should just shrink by the cast card");
});

// --- 7. Activated ability -----------------------------------------------------
scenario("Activated ability spends energy and applies its effect", () => {
  const state = emptyState();
  const rng = new Rng(7);
  const engineer = putUnit(state, "p1", cortexEngineer, 2); // 3 base health, 2 damage taken
  state.players.p1.energy = 1;
  state.players.p1.maxEnergy = 1;
  const legal = getLegalMoves(state);
  const activate = legal.find((m) => m.type === "activateAbility" && m.sourceInstanceId === engineer.instanceId);
  assert.ok(activate, "activated ability should be legal with enough energy");
  applyMove(state, activate!, rng);
  assert.equal(state.players.p1.energy, 0, "activating should spend its energy cost");
  assert.equal(currentHealth(state, engineer), engineer.card.health, "healed back to full (2 damage - 2 heal)");
});

// --- 8. Static / continuous aura ---------------------------------------------
scenario("Static aura buffs live units with no explicit recompute call", () => {
  const state = emptyState();
  const ally = putUnit(state, "p1", swarmLarva);
  assert.equal(currentAttack(state, ally), 1, "baseline attack with no aura");
  const directive = { instanceId: "test-d1", card: mainframeCore, controller: "p1" as PlayerId };
  state.players.p1.directives.push(directive);
  assert.equal(currentAttack(state, ally), 2, "aura should apply the instant it's in play, no cache to refresh");
  assert.equal(currentHealth(state, ally), ally.card.health + 1, "aura's health bonus should apply too");
  state.players.p1.directives.pop();
  assert.equal(currentAttack(state, ally), 1, "removing the aura source should revert stats immediately — nothing is stale");
});

// --- 9. State-mutating (board-scaling) stats ---------------------------------
scenario("Unit stats mutate live with board state, both attack- and health-scaling", () => {
  const state = emptyState();
  const construct = putUnit(state, "p1", recursiveConstruct);
  assert.equal(currentAttack(state, construct), 1, "attack = number of controller units in play (itself = 1)");
  putUnit(state, "p1", swarmLarva);
  assert.equal(currentAttack(state, construct), 2, "adding a second allied unit should raise attack live");

  const beast = putUnit(state, "p2", overclockBeast);
  assert.equal(currentHealth(state, beast), 4, "health = 2 + opponent's unit count (p1 already has 2 units in play)");
  putUnit(state, "p1", swarmLarva);
  assert.equal(currentHealth(state, beast), 5, "a third opposing unit should raise the beast's health to 5");
});

// --- 10. Cross-card cascade: onDamaged -> AOE -> onDeath ---------------------
scenario("A multi-card combo: onDamaged triggers an AOE that kills a unit, cascading into its onDeath", () => {
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

  assert.ok(!findUnit(state, fragileFailsafe.instanceId), "the 1hp Fail-safe Unit should have died to the retaliation AOE");
  assert.equal(state.players.p2.hand.length, drawsBefore + 1, "its onDeath should have drawn its controller a card");
  assert.ok(findUnit(state, sturdyBystander.instanceId), "the 5-health Sentinel should have survived the same AOE tick");
  assert.equal(currentHealth(state, sturdyBystander), sturdyBystander.card.health - 1, "and still shows the 1 damage it took");
});

console.log(`\nAll ${scenarioCount} effect-system scenarios passed.`);
