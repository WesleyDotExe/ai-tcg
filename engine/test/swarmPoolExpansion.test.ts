// Phase 5 pool expansion, Swarm slice (2026-09-25/26 owner-feedback entries:
// "Swarm next would help both its own weak matchups and the Aegis-vs-Swarm
// drift"). Brood Skitterer and Carapace Grunt are stat-only (no abilities to
// test beyond the pool building legally); Warren Guardian's real behaviour is
// its Guard keyword (already a generically-tested engine mechanism — this
// file proves the new card actually carries it); Bloodswarm Alpha's onPlay
// summon is the one genuinely new piece of behaviour this batch adds.

import { test, expect } from "vitest";
import { getLegalMoves } from "../src/engine/moves.js";
import { applyMove } from "../src/engine/engine.js";
import { Rng } from "../src/state/rng.js";
import { bloodswarmAlpha, warrenGuardian, swarmLarva, SWARM_CARDS } from "../src/data/cards.js";
import { signalDrone } from "../src/data/cards.js";
import { buildSwarmDeck } from "../src/data/decks.js";
import { emptyState, putUnit, drainStack } from "./helpers.js";

test("Warren Guardian carries the Guard keyword and forces attacks onto itself", () => {
  const state = emptyState();
  putUnit(state, "p1", signalDrone);
  putUnit(state, "p2", swarmLarva); // no Guard
  const guard = putUnit(state, "p2", warrenGuardian);
  const legal = getLegalMoves(state);
  const attackMoves = legal.filter((m) => m.type === "attack");
  expect(attackMoves.length, "there should be legal attacks").toBeGreaterThan(0);
  for (const move of attackMoves) {
    if (move.type !== "attack") continue;
    expect(move.target, "every attack must target the Guard unit").toEqual({ kind: "unit", instanceId: guard.instanceId });
  }
});

test("Bloodswarm Alpha's onPlay summons a real, fully-functional 1/1 Swarm Larva alongside itself", () => {
  const state = emptyState();
  const rng = new Rng(1);
  state.players.p1.hand.push(bloodswarmAlpha);
  state.players.p1.energy = bloodswarmAlpha.cost;
  state.players.p1.maxEnergy = bloodswarmAlpha.cost;
  const legal = getLegalMoves(state);
  const move = legal.find((m) => m.type === "playCard" && m.handIndex === 0);
  expect(move, "Bloodswarm Alpha should be a legal play with energy available").toBeTruthy();
  applyMove(state, move!, rng);
  drainStack(state, rng);

  expect(state.players.p1.board, "the played unit plus the summoned token should both be on the board").toHaveLength(2);
  const alpha = state.players.p1.board.find((u) => u.card.id === bloodswarmAlpha.id);
  const token = state.players.p1.board.find((u) => u.card.name === "Swarm Larva");
  expect(alpha, "Bloodswarm Alpha itself should be on the board").toBeTruthy();
  expect(token, "a summoned Swarm Larva token should be on the board").toBeTruthy();
  expect(token!.card.attack).toBe(1);
  expect(token!.card.health).toBe(1);
});

test("Swarm pool still builds a legal deck (lint + copy limits + size) after the Phase 5 Swarm slice's growth", () => {
  const deck = buildSwarmDeck("p1", "Swarm Test Deck");
  expect(deck.cards.length).toBe(40);
  const totalCopies = SWARM_CARDS.reduce((sum, p) => sum + p.copies, 0);
  expect(totalCopies).toBe(40);
  const uniqueCount = new Set(SWARM_CARDS.map((p) => p.card.id)).size;
  expect(uniqueCount, "the Swarm slice should have grown the pool from 16 to 20 unique cards").toBe(20);
});
