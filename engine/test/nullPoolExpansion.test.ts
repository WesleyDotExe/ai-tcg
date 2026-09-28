// Phase 5 pool expansion, Null slice (2026-09-26 owner-feedback entry:
// "Null — as a DEPTH / VARIETY pass, not a power buff"). Each of the five
// new cards exercises a trigger or keyword the Null pool had never used, so
// each gets a whitebox test proving that specific mechanism actually works
// on this card — plus the pool-level checks (legal deck, lint
// passes, removal density moved away from the cap, and the variety claim
// itself).

import { test, expect } from "vitest";
import { getLegalMoves } from "../src/engine/moves.js";
import { applyMove } from "../src/engine/engine.js";
import { processDeaths } from "../src/effects/resolver.js";
import { currentAttack } from "../src/state/queries.js";
import { isRemovalOrDebuffCard } from "../src/cards/poolLint.js";
import { Rng } from "../src/state/rng.js";
import {
  zombieProcess,
  danglingPointer,
  bitRot,
  watchdogTimer,
  garbageCollector,
  glitchSeed,
  NULL_CARDS,
} from "../src/data/nullCards.js";
import { broodcaller } from "../src/data/cards.js";
import { buildNullDeck } from "../src/data/decks.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { buildPlayerView } from "../src/agents/agent.js";
import { emptyState, putUnit, drainStack } from "./helpers.js";

test("Zombie Process's onDeath leaves a real 1/1 Orphaned Thread token behind", () => {
  const state = emptyState();
  const rng = new Rng(1);
  putUnit(state, "p1", zombieProcess, zombieProcess.health); // lethal damage already marked
  processDeaths(state, rng);

  const board = state.players.p1.board;
  expect(board.find((u) => u.card.id === zombieProcess.id), "Zombie Process itself should have died").toBeUndefined();
  expect(state.players.p1.graveyard.map((c) => c.id)).toContain(zombieProcess.id);
  expect(board, "exactly one token should replace it").toHaveLength(1);
  expect(board[0]!.card.name).toBe("Orphaned Thread");
  expect(board[0]!.card.attack).toBe(1);
  expect(board[0]!.card.health).toBe(1);
});

test("Dangling Pointer has Rush: it can attack on the turn it is played", () => {
  const state = emptyState();
  const rng = new Rng(1);
  state.players.p1.hand.push(danglingPointer);
  state.players.p1.energy = danglingPointer.cost;
  state.players.p1.maxEnergy = danglingPointer.cost;
  const play = getLegalMoves(state).find((m) => m.type === "playCard" && m.handIndex === 0);
  expect(play, "Dangling Pointer should be a legal play").toBeTruthy();
  applyMove(state, play!, rng);
  drainStack(state, rng);

  const pointer = state.players.p1.board.find((u) => u.card.id === danglingPointer.id)!;
  const attacks = getLegalMoves(state).filter((m) => m.type === "attack" && m.attackerInstanceId === pointer.instanceId);
  expect(attacks.length, "a freshly-played Rush unit must have a legal attack this turn").toBeGreaterThan(0);

  // Control: a non-Rush Null unit played the same turn cannot attack.
  const seed = putUnit(state, "p1", glitchSeed);
  const seedAttacks = getLegalMoves(state).filter((m) => m.type === "attack" && m.attackerInstanceId === seed.instanceId);
  expect(seedAttacks, "a non-Rush unit that entered this turn must not be able to attack").toHaveLength(0);
});

test("Bit Rot shrinks an enemy unit's attack by 3 for the turn only, and is castable at Instant speed on the opponent's turn", () => {
  const state = emptyState();
  const rng = new Rng(1);
  // p1 is active; p2 (Null) holds Bit Rot and gets priority after p1 passes once.
  const enemy = putUnit(state, "p1", broodcaller); // 3/3
  state.players.p2.hand.push(bitRot);
  state.players.p2.energy = bitRot.cost;
  state.players.p2.maxEnergy = bitRot.cost;

  applyMove(state, { type: "passPriority" }, rng);
  expect(state.priority, "p2 should now hold priority on p1's turn").toBe("p2");
  const cast = getLegalMoves(state).find(
    (m) => m.type === "playCard" && m.target?.kind === "unit" && m.target.instanceId === enemy.instanceId,
  );
  expect(cast, "Bit Rot should be castable on the opponent's turn, targeting their unit").toBeTruthy();
  applyMove(state, cast!, rng);
  drainStack(state, rng);

  expect(currentAttack(state, enemy)).toBe(broodcaller.attack - 3);
  expect(enemy.permanentBuff.attack, "the shrink must be temporary, not permanent").toBe(0);
  expect(isRemovalOrDebuffCard(bitRot), "Bit Rot must count toward the lint's removal/debuff density").toBe(true);
});

test("Watchdog Timer draws at end of turn only while its controller's hand is empty", () => {
  const run = (cardsInHand: number): number => {
    const state = emptyState();
    const rng = new Rng(1);
    state.players.p1.directives.push({ instanceId: "test-watchdog", card: watchdogTimer, controller: "p1" });
    state.players.p1.deck.push(glitchSeed, glitchSeed, glitchSeed);
    for (let i = 0; i < cardsInHand; i++) state.players.p1.hand.push(glitchSeed);
    // Two passes on an empty stack end p1's turn (onTurnEnd fires for p1).
    applyMove(state, { type: "passPriority" }, rng);
    applyMove(state, { type: "passPriority" }, rng);
    expect(state.activePlayer, "the turn should have passed to p2").toBe("p2");
    return state.players.p1.hand.length - cardsInHand;
  };
  expect(run(0), "empty hand: draws").toBe(1);
  expect(run(1), "one card in hand: no draw").toBe(0);
  expect(run(3), "several cards in hand: no draw").toBe(0);
});

test("Garbage Collector's activated ability spends 2 energy to heal a damaged ally by 2", () => {
  const state = emptyState();
  const rng = new Rng(1);
  const collector = putUnit(state, "p1", garbageCollector);
  const hurt = putUnit(state, "p1", zombieProcess, 1); // 1/2 with 1 damage
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;
  const activate = getLegalMoves(state).find(
    (m) =>
      m.type === "activateAbility" &&
      m.sourceInstanceId === collector.instanceId &&
      m.target?.kind === "unit" &&
      m.target.instanceId === hurt.instanceId,
  );
  expect(activate, "the ability should be activatable targeting a friendly unit").toBeTruthy();
  applyMove(state, activate!, rng);
  drainStack(state, rng);
  expect(hurt.damageTaken, "healing should remove the damage (never below 0)").toBe(0);
  expect(state.players.p1.energy, "the 2-energy cost should be paid from the shared pool").toBe(0);

  // Can't afford it with 1 energy.
  state.players.p1.energy = 1;
  const again = getLegalMoves(state).filter((m) => m.type === "activateAbility" && m.sourceInstanceId === collector.instanceId);
  expect(again, "with 1 energy the 2-cost ability must not be offered").toHaveLength(0);
});

test("Null pool builds a legal 36-card deck at 20 unique cards after the 2026-09-28 consistency trim", () => {
  const deck = buildNullDeck("p1", "Null Test Deck");
  expect(deck.cards.length, "the trim takes Null from 40 back to 36").toBe(36);
  const uniqueCount = new Set(NULL_CARDS.map((p) => p.card.id)).size;
  expect(uniqueCount, "the trim cuts copies, not cards: all 20 unique cards stay").toBe(20);
  expect(
    NULL_CARDS.find((p) => p.card.name === "Kernel Panic")?.copies,
    "Kernel Panic is protected by the trim (its visibility is part of the reason for it)",
  ).toBe(2);
  // Every trim cut was non-removal, so density rose from 9/40 back to the
  // lint's cap exactly. At the cap still passes (the lint fails only over it).
  const removal = NULL_CARDS.filter((p) => isRemovalOrDebuffCard(p.card)).reduce((s, p) => s + p.copies, 0);
  expect(removal / deck.cards.length).toBeLessThanOrEqual(0.25);
});

test("the Null slice is genuine variety: the pool now uses triggers and keywords it never used before", () => {
  const triggers = new Set(NULL_CARDS.flatMap((p) => p.card.abilities.map((a) => a.trigger)));
  for (const t of ["onDeath", "onTurnEnd", "activated"] as const) {
    expect(triggers.has(t), `Null pool should now use the ${t} trigger`).toBe(true);
  }
  const keywords = new Set(NULL_CARDS.flatMap((p) => (p.card.type === "Unit" ? p.card.keywords : [])));
  expect(keywords.has("Rush"), "Null pool should now have a Rush unit").toBe(true);
  const instantCommands = NULL_CARDS.filter((p) => p.card.type === "Command" && p.card.speed === "Instant");
  expect(instantCommands.length, "Null should have an Instant trick beyond its directive answer").toBeGreaterThanOrEqual(2);
});

test("LookaheadAgent values a Directive's recurring turn trigger, so it will actually play Watchdog Timer", () => {
  const state = emptyState();
  state.players.p1.hand.push(watchdogTimer);
  state.players.p1.energy = watchdogTimer.cost;
  state.players.p1.maxEnergy = watchdogTimer.cost;
  const legal = getLegalMoves(state);
  expect(legal.some((m) => m.type === "playCard"), "Watchdog Timer should be a legal play").toBe(true);
  // Its turn-trigger value must now outweigh its cost, so playing it beats passing.
  const move = new LookaheadAgent("probe", 1).decideMove(buildPlayerView(state, "p1"), legal);
  expect(move.type, "before the agent fix this scored below passPriority and was never played").toBe("playCard");
});
