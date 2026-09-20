// Phase 2 item 4 of the 2026-09-20 owner-feedback entry: "Add a 'summon'
// (token) effect kind so wide decks can rebuild after board-wide damage" —
// named motivation: Swarm has no way to recover after a sweep. Before this,
// there was no way to create a unit that wasn't drawn from a deck (see
// quality-debt.md's "Architectural gaps": "No 'summon' effect kind. Can't
// create token units."). This proves the new generic mechanism (EffectSpec's
// "summon" kind, effects/resolver.ts's summonTokens) actually creates real,
// fully-functional board units — not just that it compiles — and that
// Swarm's new card (Brood Reserves) uses it for real.

import { test, expect } from "vitest";
import { getLegalMoves } from "../src/engine/moves.js";
import { applyMove } from "../src/engine/engine.js";
import { Rng } from "../src/state/rng.js";
import { buildPlayerView } from "../src/agents/agent.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { broodReserves, swarmLarva } from "../src/data/cards.js";
import { currentAttack, currentHealth } from "../src/state/queries.js";
import { BOARD_SLOTS } from "../src/state/init.js";
import { processDeaths } from "../src/effects/resolver.js";
import { emptyState, putUnit, drainStack } from "./helpers.js";

function castBroodReserves(state: ReturnType<typeof emptyState>, rng: Rng): void {
  state.players.p1.hand.push(broodReserves);
  state.players.p1.energy = broodReserves.cost;
  state.players.p1.maxEnergy = broodReserves.cost;
  const legal = getLegalMoves(state);
  const move = legal.find((m) => m.type === "playCard" && m.handIndex === 0);
  expect(move, "Brood Reserves should be a legal play with energy available and no targeting requirement").toBeTruthy();
  applyMove(state, move!, rng);
  drainStack(state, rng);
}

test("summon creates real, fully-functional token units on the controller's board", () => {
  const state = emptyState();
  const rng = new Rng(1);
  castBroodReserves(state, rng);

  expect(state.players.p1.board, "both tokens should have been created").toHaveLength(2);
  for (const token of state.players.p1.board) {
    expect(token.card.name).toBe("Swarm Larva");
    expect(token.controller).toBe("p1");
    expect(currentAttack(state, token)).toBe(1);
    expect(currentHealth(state, token)).toBe(1);
  }
  const summonEvents = state.log.filter((e) => e.type === "summon");
  expect(summonEvents, "each token creation should be logged with its own event, not just inferred from board state").toHaveLength(2);
});

test("a summoned token behaves exactly like any other unit: it can attack, take damage, and die to the graveyard", () => {
  const state = emptyState();
  const rng = new Rng(2);
  castBroodReserves(state, rng);
  const token = state.players.p1.board[0]!;
  // Give it a turn boundary so summoning sickness clears, same as any drawn
  // unit would need.
  token.enteredTurn = state.turnNumber - 1;

  const legal = getLegalMoves(state);
  const attackMove = legal.find((m) => m.type === "attack" && m.attackerInstanceId === token.instanceId && m.target.kind === "player");
  expect(attackMove, "a summoned token should be a legal attacker once it's not summoning-sick, exactly like a drawn unit").toBeTruthy();
  const healthBefore = state.players.p2.health;
  applyMove(state, attackMove!, rng);
  drainStack(state, rng);
  expect(state.players.p2.health).toBe(healthBefore - 1);

  // Kill it and confirm it dies and goes to the graveyard like any other unit.
  token.damageTaken = 10;
  processDeaths(state, rng);
  expect(state.players.p1.board.some((u) => u.instanceId === token.instanceId)).toBe(false);
  expect(state.players.p1.graveyard.some((c) => c.name === "Swarm Larva")).toBe(true);
});

test("summon respects the shared board-slot cap: partial room creates only what fits and logs a fizzle for the rest", () => {
  const state = emptyState();
  const rng = new Rng(3);
  // Fill the board to exactly one slot short of BOARD_SLOTS.
  for (let i = 0; i < BOARD_SLOTS - 1; i++) putUnit(state, "p1", swarmLarva);
  expect(state.players.p1.board).toHaveLength(BOARD_SLOTS - 1);

  castBroodReserves(state, rng);

  expect(state.players.p1.board, "only one of the two tokens should fit").toHaveLength(BOARD_SLOTS);
  const summonEvents = state.log.filter((e) => e.type === "summon");
  const fizzleEvents = state.log.filter((e) => e.type === "summonFizzle");
  expect(summonEvents).toHaveLength(1);
  expect(fizzleEvents, "the token that didn't fit should be logged as a fizzle, not silently dropped").toHaveLength(1);
});

test("summon onto a completely full board fizzles both tokens and crashes nothing", () => {
  const state = emptyState();
  const rng = new Rng(4);
  for (let i = 0; i < BOARD_SLOTS; i++) putUnit(state, "p1", swarmLarva);
  expect(state.players.p1.board).toHaveLength(BOARD_SLOTS);

  castBroodReserves(state, rng);

  expect(state.players.p1.board).toHaveLength(BOARD_SLOTS);
  const fizzleEvents = state.log.filter((e) => e.type === "summonFizzle");
  expect(fizzleEvents).toHaveLength(2);
});

test("LookaheadAgent casts Brood Reserves rather than passing when it has room and energy", () => {
  const state = emptyState();
  state.players.p1.hand.push(broodReserves);
  state.players.p1.energy = broodReserves.cost;
  state.players.p1.maxEnergy = broodReserves.cost;

  const legal = getLegalMoves(state);
  const view = buildPlayerView(state, "p1");
  const agent = new LookaheadAgent("test", 5);
  const move = agent.decideMove(view, legal);

  expect(move.type, "two free 1/1 bodies should clearly beat passing").toBe("playCard");
});
