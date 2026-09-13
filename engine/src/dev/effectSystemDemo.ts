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
import { applyMove, beginTurn } from "../engine/engine.js";
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
  interruptHandler,
  reflexSpike,
} from "../data/cards.js";
import {
  aegisCadet,
  aegisSentinel,
  perimeterTurret,
  platingModule,
  guardDirectiveChip,
  barrierShim,
} from "../data/aegisCards.js";
import type { UnitCard } from "../cards/types.js";
import { BOARD_SLOTS } from "../state/init.js";
import { hasKeyword } from "../state/queries.js";

/** Casting a Command or activating an ability now only queues it on the
 * stack (see engine/engine.ts) — it takes two consecutive passPriority
 * moves per stack item to actually resolve it. This drains the whole
 * stack the same way a real match's priority loop would when nobody has
 * anything left to respond with, so scenarios that don't care about
 * priority itself (4, 5, 6, 7) can still assert on the resolved effect. */
function drainStack(state: GameState, rng: Rng): void {
  let guard = 0;
  while (state.stack.length > 0 && guard++ < 20) {
    applyMove(state, { type: "passPriority" }, rng);
    applyMove(state, { type: "passPriority" }, rng);
  }
  assert.ok(guard < 20, "drainStack: stack never emptied — possible infinite loop in the priority algorithm");
}

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
    tools: [],
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
  assert.equal(currentHealth(state, target), target.card.health, "a cast Command should sit on the stack, not resolve immediately");
  drainStack(state, rng);
  assert.equal(currentHealth(state, target), target.card.health - 2, "Diagnostic Pulse should deal exactly 2 targeted damage once it resolves off the stack");
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
  drainStack(state, rng);
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
  drainStack(lowHealthState, rng1);
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
  drainStack(fullHealthState, rng2);
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
  assert.equal(state.players.p1.energy, 0, "activating should spend its energy cost immediately, even before it resolves");
  drainStack(state, rng);
  assert.equal(currentHealth(state, engineer), engineer.card.health, "healed back to full (2 damage - 2 heal) once the ability resolves off the stack");
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

// --- 11. Priority + LIFO stack resolution: a real instant-speed response ---
scenario(
  "Priority passes correctly between players, and a same-window instant-speed response resolves before (and changes the outcome of) the spell it responded to",
  () => {
    const state = emptyState();
    const rng = new Rng(9);
    const engineer = putUnit(state, "p1", cortexEngineer, 1); // 3 base health, 1 damage taken -> 2 current health
    state.players.p2.hand.push(interruptHandler); // Instant, 1 cost, 2 damage to target enemy unit
    state.players.p2.energy = 1;
    state.players.p2.maxEnergy = 1;
    state.players.p1.energy = 1; // for the engineer's own Instant repair ability (cost 1)
    state.players.p1.maxEnergy = 1;

    // Hand priority to p2 first (even though it's p1's default turn/active
    // player) to prove priority is a real, independent thing an agent can
    // hold and act on, not just a synonym for "whose turn is it."
    state.priority = "p2";
    applyMove(
      state,
      { type: "playCard", handIndex: 0, target: { kind: "unit", instanceId: engineer.instanceId } },
      rng,
    );
    assert.equal(state.stack.length, 1, "the removal spell should be queued on the stack, not resolved immediately");
    assert.equal(currentHealth(state, engineer), 2, "no damage should land until the spell actually resolves");

    applyMove(state, { type: "passPriority" }, rng); // p2 passes, opening a real response window
    assert.equal(state.priority, "p1", "p1 should now hold priority, with a chance to respond before the spell resolves");

    const legal = getLegalMoves(state);
    const repair = legal.find((m) => m.type === "activateAbility" && m.sourceInstanceId === engineer.instanceId);
    assert.ok(repair, "p1 should have a legal Instant-speed response available, not just a forced pass");
    applyMove(state, repair!, rng); // p1 responds with the engineer's own instant repair, on top of the removal spell
    assert.equal(state.stack.length, 2, "both the removal spell and the response should now be stacked");

    applyMove(state, { type: "passPriority" }, rng); // p1 passes back...
    applyMove(state, { type: "passPriority" }, rng); // ...and p2 has nothing left to add: the TOP of the stack resolves
    assert.equal(state.stack.length, 1, "only the response should have resolved — the removal spell is still waiting underneath");
    assert.equal(
      currentHealth(state, engineer),
      3,
      "the response (last on, first resolved — LIFO) should heal the engineer to full BEFORE the removal spell hits",
    );

    applyMove(state, { type: "passPriority" }, rng);
    applyMove(state, { type: "passPriority" }, rng); // now the removal spell resolves
    assert.equal(state.stack.length, 0, "the stack should be empty now");
    assert.equal(
      currentHealth(state, engineer),
      1,
      "3 (post-heal max) - 2 (the removal spell, resolving after the heal) = 1: the reactive play kept the unit alive",
    );
  },
);

// --- 12. Instant-speed combat trick changes a fight's outcome -------------
scenario("An instant-speed combat trick resolves before combat damage and changes who survives the trade", () => {
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
  assert.equal(state.stack.length, 1, "combat damage should be pending on the stack, not applied on declaration");
  assert.equal(currentHealth(state, defender), 2, "no damage should have landed yet");

  applyMove(state, { type: "passPriority" }, rng); // p1 (holding priority after declaring) passes
  assert.equal(state.priority, "p2", "the defending player gets a real window to respond before damage resolves");

  const legal = getLegalMoves(state);
  const trick = legal.find((m) => m.type === "playCard");
  assert.ok(trick, "p2 should have a legal Instant-speed trick available in response to the attack");
  applyMove(state, trick!, rng); // p2 casts Reflex Spike on their own defender — now on top of the pending combat damage
  applyMove(state, { type: "passPriority" }, rng);
  applyMove(state, { type: "passPriority" }, rng); // top of stack resolves first (LIFO): the trick, not the combat damage yet
  assert.equal(currentHealth(state, defender), 5, "the trick should resolve before combat damage: 2 base + 3 buff, 0 damage taken yet");

  applyMove(state, { type: "passPriority" }, rng);
  applyMove(state, { type: "passPriority" }, rng); // now combat damage resolves, computed live against the now-buffed defender

  assert.equal(
    currentHealth(state, defender),
    3,
    "2 base health + 3 from the trick - 2 combat damage = 3: the trick saved a unit that would otherwise have died",
  );
  assert.ok(!findUnit(state, attacker.instanceId), "the attacker should still have died to the (unbuffed) defender's own return damage");
});

// --- 13. Board-development: telegraphed threat is dormant, then arms -------
scenario("A telegraphed unit is dormant on arrival and only fires its ability once armed", () => {
  const state = emptyState();
  const rng = new Rng(11);
  const victim = putUnit(state, "p2", swarmLarva); // 1 health — the turret's arm-time ability will kill it
  state.players.p1.hand.push(perimeterTurret); // cost 2, telegraph 1
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;

  applyMove(state, { type: "playCard", handIndex: 0 }, rng);
  const turret = state.players.p1.board[0]!;
  assert.equal(turret.pending, true, "a telegraphed unit should enter pending, not active");
  assert.equal(currentHealth(state, victim), 1, "the turret's damage effect must not fire while still dormant");
  const legalWhilePending = getLegalMoves(state);
  assert.ok(
    !legalWhilePending.some((m) => m.type === "attack" && m.attackerInstanceId === turret.instanceId),
    "a pending unit must not have a legal attack move",
  );

  // Simulate one full round elapsing (turnNumber advances by 2: the
  // opponent's turn, then back to p1's own) and start p1's next turn, the
  // same call beginTurn makes at every real turn boundary.
  state.turnNumber += 2;
  beginTurn(state, "p1", rng, { draw: false });

  assert.equal(turret.pending, false, "the turret should have armed once its controller's next turn began");
  assert.equal(currentHealth(state, victim), 1 - 3, "the turret's arm-time ability should now have fired its 3 damage");
});

// --- 14. Board-development: evolution mutates in place, carries state forward
scenario("Evolving a unit keeps its instance identity and carries damage/tools forward, and spends the base card", () => {
  const state = emptyState();
  const rng = new Rng(12);
  const cadet = putUnit(state, "p1", aegisCadet, 1); // 1 damage already taken
  cadet.tools.push(platingModule); // simulate a tool attached before evolving
  const cadetInstanceId = cadet.instanceId;
  state.players.p1.hand.push(aegisSentinel); // evolvesFrom AG-001 (Aegis Cadet), cost 3, onPlay: gain 1 energy
  state.players.p1.energy = 3;
  state.players.p1.maxEnergy = 3;

  const legal = getLegalMoves(state);
  const evolve = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === cadetInstanceId);
  assert.ok(evolve, "evolving into Aegis Sentinel should be offered, targeting the Aegis Cadet already in play");
  applyMove(state, evolve!, rng);

  const evolved = state.players.p1.board.find((u) => u.instanceId === cadetInstanceId);
  assert.ok(evolved, "evolution must mutate the existing board unit in place, not remove and replace it");
  assert.equal(evolved!.card.id, aegisSentinel.id, "the instance should now be the evolved card");
  assert.equal(state.players.p1.board.length, 1, "evolving must not consume an extra board slot");
  assert.equal(evolved!.damageTaken, 1, "accumulated damage should carry forward onto the evolved form");
  assert.ok(evolved!.tools.includes(platingModule), "an attached tool should carry forward onto the evolved form");
  assert.ok(
    state.players.p1.graveyard.some((c) => c.id === aegisCadet.id),
    "the consumed base card should go to the graveyard",
  );
  assert.equal(state.players.p1.energy, 1, "the evolved card's own onPlay (gain 1 energy) should have fired: 3 - 3 (cost) + 1 = 1");
});

// --- 15. Board-development: a Tool attaches, boosting stats and granting a keyword
scenario("A Tool attaches to a friendly unit, boosting its live stats and granting a keyword", () => {
  const state = emptyState();
  const rng = new Rng(13);
  const drone = putUnit(state, "p1", aegisCadet); // 1/2, no keywords
  assert.equal(hasKeyword(drone, "Guard"), false, "baseline: no Guard");
  state.players.p1.hand.push(guardDirectiveChip); // Tool: +1/+1, grants Guard
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;

  const legal = getLegalMoves(state);
  const attach = legal.find((m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === drone.instanceId);
  assert.ok(attach, "attaching the Tool to the friendly unit should be a legal move");
  applyMove(state, attach!, rng);

  assert.equal(currentAttack(state, drone), 2, "1 base + 1 tool bonus");
  assert.equal(currentHealth(state, drone), 3, "2 base + 1 tool bonus");
  assert.ok(hasKeyword(drone, "Guard"), "the Tool's granted keyword should now apply, live, with no card change");
  assert.equal(drone.tools.length, 1, "the tool should be recorded as attached");

  // A Tool granting Barrier should apply the actual consumable status, not
  // just a live keyword flag — Barrier's behaviour lives in `statuses`.
  const shieldTarget = putUnit(state, "p1", aegisCadet);
  state.players.p1.hand.push(barrierShim);
  state.players.p1.energy = 2;
  const legal2 = getLegalMoves(state);
  const attachShim = legal2.find(
    (m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === shieldTarget.instanceId,
  );
  assert.ok(attachShim, "attaching Barrier Shim should be legal");
  applyMove(state, attachShim!, rng);
  assert.ok(shieldTarget.statuses.some((s) => s.kind === "Barrier"), "Barrier Shim should grant an actual Barrier status on attach");
});

// --- 16. Board-development: the finite board-slot cap is real ---------------
scenario("The board-slot cap blocks new Units/Directives once full, but never blocks Tools", () => {
  const state = emptyState();
  const rng = new Rng(14);
  for (let i = 0; i < BOARD_SLOTS; i++) putUnit(state, "p1", swarmLarva);
  assert.equal(state.players.p1.board.length, BOARD_SLOTS, "board should be at capacity");

  state.players.p1.hand.push(aegisCadet); // a plain new Unit — should be unplayable, no free slot
  state.players.p1.hand.push(platingModule); // a Tool — should still be playable, it doesn't need a slot
  state.players.p1.energy = 3;
  state.players.p1.maxEnergy = 3;

  const legal = getLegalMoves(state);
  assert.ok(!legal.some((m) => m.type === "playCard" && m.handIndex === 0), "a full board must block playing a new Unit");
  assert.ok(legal.some((m) => m.type === "playCard" && m.handIndex === 1), "a full board must NOT block attaching a Tool");
});

console.log(`\nAll ${scenarioCount} effect-system scenarios passed.`);
