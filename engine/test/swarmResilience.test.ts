// 2026-09-23 owner-feedback entry ("Phase 4 decisions"), item 3: "give
// Swarm's kit real go-wide resilience so width answers removal." Two new
// cards (data/cards.ts), each reusing only already-generic engine
// mechanisms (summon, Ability.condition, selfStatFromScaling) rather than
// needing new engine work — this file proves both actually do what their
// text says, not just that they load.

import { test, expect } from "vitest";
import { Rng } from "../src/state/rng.js";
import { currentHealth } from "../src/state/queries.js";
import { processDeaths, applyDamage } from "../src/effects/resolver.js";
import { colonyBroodling, overgrownCarapace, swarmLarva } from "../src/data/cards.js";
import { emptyState, putUnit } from "./helpers.js";

test("Colony Broodling: dying with 2+ other units surviving it summons a replacement Swarm Larva", () => {
  const state = emptyState();
  const rng = new Rng(1);
  const broodling = putUnit(state, "p1", colonyBroodling);
  putUnit(state, "p1", swarmLarva);
  putUnit(state, "p1", swarmLarva);
  const boardBefore = state.players.p1.board.length;

  broodling.damageTaken = 10;
  processDeaths(state, rng);

  expect(state.players.p1.graveyard.some((c) => c.id === colonyBroodling.id), "Colony Broodling itself should be in the graveyard").toBe(true);
  const summonEvent = state.log.find((e) => e.type === "summon" && e.source === "Colony Broodling");
  expect(summonEvent, "dying with 2 other units alive should log a Colony Broodling summon").toBeTruthy();
  // boardBefore included the dying Broodling itself; after death+replacement
  // the board should be back to boardBefore - 1 (Broodling gone) + 1 (token) = boardBefore.
  expect(state.players.p1.board.length, "the replacement token should bring the board back to its pre-death count").toBe(boardBefore);
  expect(state.players.p1.board.some((u) => u.card.name === "Swarm Larva" && u.instanceId !== broodling.instanceId)).toBe(true);
});

test("Colony Broodling: dying with fewer than 2 other units does NOT summon a replacement", () => {
  const state = emptyState();
  const rng = new Rng(2);
  const broodling = putUnit(state, "p1", colonyBroodling);
  putUnit(state, "p1", swarmLarva); // only 1 other unit — condition (>=2 other units) is false

  broodling.damageTaken = 10;
  processDeaths(state, rng);

  const summonEvent = state.log.find((e) => e.type === "summon" && e.source === "Colony Broodling");
  expect(summonEvent, "with only 1 other unit surviving, the condition should gate the summon off entirely").toBeUndefined();
  expect(state.players.p1.board.length, "no replacement token should have entered play").toBe(1);
});

test("Colony Broodling: dying completely alone (no other units) does NOT summon a replacement", () => {
  const state = emptyState();
  const rng = new Rng(3);
  const broodling = putUnit(state, "p1", colonyBroodling);

  broodling.damageTaken = 10;
  processDeaths(state, rng);

  expect(state.players.p1.board.length, "a lone Colony Broodling dying should leave an empty board, not summon into it").toBe(0);
});

test("Overgrown Carapace: its own live health equals 1 + the controller's current unit count, and updates as the board changes", () => {
  const state = emptyState();
  const rng = new Rng(4);
  const carapace = putUnit(state, "p1", overgrownCarapace);

  // Alone: 1 + 1 (itself) = 2.
  expect(currentHealth(state, carapace), "with only itself on the board, health should be 1 + 1").toBe(2);

  const larva1 = putUnit(state, "p1", swarmLarva);
  const larva2 = putUnit(state, "p1", swarmLarva);
  expect(currentHealth(state, carapace), "with 2 more units in play, health should be 1 + 3").toBe(4);

  // Kill one ally — the live value should shrink back down immediately,
  // proving this reads live board state rather than a snapshot taken when
  // the card entered play.
  larva1.damageTaken = 10;
  processDeaths(state, rng);
  expect(currentHealth(state, carapace), "after an ally dies, health should drop back to 1 + 2").toBe(3);

  // Damage taken by Overgrown Carapace itself still reduces its live health
  // on top of the scaling base, the same as any other unit's health.
  applyDamage(state, { kind: "unit", instanceId: carapace.instanceId }, 1, "test hit", rng);
  expect(currentHealth(state, carapace), "a point of real damage should still come off the scaled total").toBe(2);

  expect(larva2.instanceId).toBeTruthy(); // keep the second larva referenced, not dead code
});
