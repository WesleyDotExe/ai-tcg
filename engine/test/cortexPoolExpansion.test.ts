// Phase 5 pool expansion, Cortex slice (the last per-faction slice, per the
// 2026-09-26 owner-feedback entries). Each of the five new cards uses a
// shape the Cortex pool never had, so each gets a whitebox test proving that
// mechanism works on this card. The pool-level checks cover the legal
// 40-card deck, the lint, and the variety claim itself.

import { test, expect } from "vitest";
import { getLegalMoves } from "../src/engine/moves.js";
import { applyMove, beginTurn } from "../src/engine/engine.js";
import { currentAttack, currentHealth } from "../src/state/queries.js";
import { isRemovalOrDebuffCard } from "../src/cards/poolLint.js";
import { Rng } from "../src/state/rng.js";
import {
  rateLimiter,
  loadBalancer,
  hotfix,
  deadlockDetector,
  quorumArbiter,
  broodcaller,
  cortexEngineer,
  CORTEX_CARDS,
} from "../src/data/cards.js";
import { buildCortexDeck } from "../src/data/decks.js";
import { emptyState, putUnit, drainStack } from "./helpers.js";

test("Rate Limiter sweeps the enemy board at its controller's turn start, but only when the enemy has 3 or more units", () => {
  const run = (enemyUnits: number): number[] => {
    const state = emptyState();
    const rng = new Rng(1);
    state.players.p1.directives.push({ instanceId: "test-limiter", card: rateLimiter, controller: "p1" });
    const enemies = Array.from({ length: enemyUnits }, () => putUnit(state, "p2", broodcaller));
    beginTurn(state, "p1", rng, { draw: false });
    return enemies.map((u) => u.damageTaken);
  };
  expect(run(3), "3 enemy units: every one takes 1").toEqual([1, 1, 1]);
  expect(run(5), "5 enemy units: every one takes 1").toEqual([1, 1, 1, 1, 1]);
  expect(run(2), "2 enemy units: the condition is off, nothing happens").toEqual([0, 0]);
  expect(isRemovalOrDebuffCard(rateLimiter), "an onTurnStart trigger is outside the lint's removal count, by design").toBe(false);
});

test("Rate Limiter only fires at its own controller's turn start, not the opponent's", () => {
  const state = emptyState();
  const rng = new Rng(1);
  state.players.p1.directives.push({ instanceId: "test-limiter", card: rateLimiter, controller: "p1" });
  const enemies = [putUnit(state, "p2", broodcaller), putUnit(state, "p2", broodcaller), putUnit(state, "p2", broodcaller)];
  beginTurn(state, "p2", rng, { draw: false });
  expect(enemies.map((u) => u.damageTaken)).toEqual([0, 0, 0]);
});

test("Load Balancer's onAttack pings a random enemy unit for 1, on top of its own combat damage", () => {
  const state = emptyState();
  const rng = new Rng(1);
  const balancer = putUnit(state, "p1", loadBalancer);
  balancer.enteredTurn = state.turnNumber - 1; // not summoning sick
  const bystander = putUnit(state, "p2", broodcaller);
  const faceAttack = getLegalMoves(state).find(
    (m) => m.type === "attack" && m.attackerInstanceId === balancer.instanceId && m.target.kind === "player",
  );
  expect(faceAttack, "Load Balancer should be able to attack the enemy player").toBeTruthy();
  const healthBefore = state.players.p2.health;
  applyMove(state, faceAttack!, rng);
  drainStack(state, rng);
  expect(bystander.damageTaken, "the only enemy unit must take the onAttack ping").toBe(1);
  expect(state.players.p2.health, "the attack itself still lands on the player").toBe(healthBefore - loadBalancer.attack);
});

test("Hotfix gives a friendly unit +1/+2 for the turn only, and can be cast on the opponent's turn", () => {
  const state = emptyState();
  const rng = new Rng(1);
  // p1 is active; p2 (Cortex) holds Hotfix and gets priority after p1 passes once.
  const mine = putUnit(state, "p2", cortexEngineer); // 1/3
  state.players.p2.hand.push(hotfix);
  state.players.p2.energy = hotfix.cost;
  state.players.p2.maxEnergy = hotfix.cost;

  applyMove(state, { type: "passPriority" }, rng);
  expect(state.priority, "p2 should now hold priority on p1's turn").toBe("p2");
  const cast = getLegalMoves(state).find(
    (m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === mine.instanceId,
  );
  expect(cast, "Hotfix should be castable on the opponent's turn, targeting a friendly unit").toBeTruthy();
  applyMove(state, cast!, rng);
  drainStack(state, rng);

  expect(currentAttack(state, mine)).toBe(cortexEngineer.attack + 1);
  expect(currentHealth(state, mine)).toBe(cortexEngineer.health + 2);
  expect(mine.permanentBuff, "the buff must be temporary, not permanent").toEqual({ attack: 0, health: 0 });
  expect(isRemovalOrDebuffCard(hotfix), "a friendly buff is not removal").toBe(false);
});

test("Deadlock Detector stuns a random enemy unit on entry only when the enemy has 3 or more units", () => {
  const run = (enemyUnits: number): number => {
    const state = emptyState();
    const rng = new Rng(1);
    for (let i = 0; i < enemyUnits; i++) putUnit(state, "p2", broodcaller);
    state.players.p1.hand.push(deadlockDetector);
    state.players.p1.energy = deadlockDetector.cost;
    state.players.p1.maxEnergy = deadlockDetector.cost;
    const play = getLegalMoves(state).find((m) => m.type === "playCard" && m.handIndex === 0);
    expect(play, "Deadlock Detector should be a legal play").toBeTruthy();
    applyMove(state, play!, rng);
    drainStack(state, rng);
    return state.players.p2.board.filter((u) => u.statuses.some((s) => s.kind === "Stasis")).length;
  };
  expect(run(3), "3 enemy units: exactly one is stunned").toBe(1);
  expect(run(4), "4 enemy units: still exactly one").toBe(1);
  expect(run(2), "2 enemy units: the condition is off").toBe(0);
  expect(isRemovalOrDebuffCard(deadlockDetector), "an onPlay stun counts toward the removal/debuff density").toBe(true);
});

test("Quorum Arbiter's attack is 1 plus the number of enemy units, recomputed live", () => {
  const state = emptyState();
  const arbiter = putUnit(state, "p1", quorumArbiter);
  expect(currentAttack(state, arbiter), "empty enemy board").toBe(1);
  const enemies = [putUnit(state, "p2", broodcaller), putUnit(state, "p2", broodcaller), putUnit(state, "p2", broodcaller)];
  expect(currentAttack(state, arbiter), "three enemy units").toBe(4);
  state.players.p2.board = state.players.p2.board.filter((u) => u !== enemies[0]);
  expect(currentAttack(state, arbiter), "one enemy unit gone").toBe(3);
  expect(currentHealth(state, arbiter), "health is not scaled").toBe(quorumArbiter.health);
});

test("Cortex pool builds a legal 40-card deck at 24 unique cards, inside the removal cap", () => {
  const deck = buildCortexDeck("p1", "Cortex Test Deck");
  expect(deck.cards.length).toBe(40);
  const uniqueCount = new Set(CORTEX_CARDS.map((p) => p.card.id)).size;
  expect(uniqueCount, "the Cortex slice should grow the pool from 19 to 24 unique cards").toBe(24);
  const removal = CORTEX_CARDS.filter((p) => isRemovalOrDebuffCard(p.card)).reduce((s, p) => s + p.copies, 0);
  expect(removal, "trimming Diagnostic Pulse and Interrupt Handler funds Deadlock Detector").toBe(9);
  expect(CORTEX_CARDS.every((p) => p.copies >= 1), "no card was trimmed out of the deck entirely").toBe(true);
});

test("the Cortex slice is genuine variety: shapes the pool never used before", () => {
  const triggers = new Set(CORTEX_CARDS.flatMap((p) => p.card.abilities.map((a) => a.trigger)));
  expect(triggers.has("onAttack"), "Cortex pool should now use the onAttack trigger").toBe(true);
  const turnTriggerDirectives = CORTEX_CARDS.filter(
    (p) => p.card.type === "Directive" && p.card.abilities.some((a) => a.trigger === "onTurnStart" || a.trigger === "onTurnEnd"),
  );
  expect(turnTriggerDirectives.length, "Cortex should now have a Directive with a turn trigger").toBeGreaterThanOrEqual(1);
  const friendlyInstant = CORTEX_CARDS.filter(
    (p) =>
      p.card.type === "Command" &&
      p.card.speed === "Instant" &&
      p.card.abilities.some((a) => a.targeting && "filter" in a.targeting && a.targeting.filter.side === "controller"),
  );
  expect(friendlyInstant.length, "Cortex should now have an Instant trick for its own side").toBeGreaterThanOrEqual(1);
  const opponentScaled = CORTEX_CARDS.filter((p) =>
    p.card.abilities.some(
      (a) =>
        a.staticEffect?.kind === "selfStatFromScaling" &&
        a.staticEffect.attack?.mode === "scaling" &&
        a.staticEffect.attack.per === "opponentUnitsInPlay",
    ),
  );
  expect(opponentScaled.length, "Cortex should now have a stat scaled off the opponent's board").toBeGreaterThanOrEqual(1);
  expect(CORTEX_CARDS.some((p) => p.card.rarity === "Mythic"), "Cortex now has a Mythic, like the other three factions").toBe(true);
});
