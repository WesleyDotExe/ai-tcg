// Phase 5 slice 1 (2026-09-25 owner-feedback entry: "accept the ring as
// directionally done; start Phase 5" + item 3's "aim some of Aegis's new
// cards at its Cortex matchup — immediate-board-impact cards"). Bulwark
// Chassis, Reinforced Bastion, and Aegis Line Trooper are stat-only (no
// abilities to test); Salvage Reflex's onDeath ability is the one new piece
// of real behaviour this batch adds, so this file proves it does what its
// text says rather than just that the pool loads.

import { test, expect } from "vitest";
import { Rng } from "../src/state/rng.js";
import { processDeaths } from "../src/effects/resolver.js";
import { salvageReflex, aegisCadet, AEGIS_CARDS } from "../src/data/aegisCards.js";
import { buildAegisDeck } from "../src/data/decks.js";
import { emptyState, putUnit } from "./helpers.js";

test("Salvage Reflex: dying with an ally present grants that ally Barrier", () => {
  const state = emptyState();
  const rng = new Rng(1);
  const reflex = putUnit(state, "p1", salvageReflex);
  const ally = putUnit(state, "p1", aegisCadet);

  reflex.damageTaken = 10;
  processDeaths(state, rng);

  expect(state.players.p1.graveyard.some((c) => c.id === salvageReflex.id), "Salvage Reflex itself should be in the graveyard").toBe(true);
  expect(ally.statuses.some((s) => s.kind === "Barrier"), "the surviving ally should have gained Barrier").toBe(true);
});

test("Salvage Reflex: dying alone (no allies) does not error and grants nothing", () => {
  const state = emptyState();
  const rng = new Rng(2);
  const reflex = putUnit(state, "p1", salvageReflex);

  reflex.damageTaken = 10;
  expect(() => processDeaths(state, rng)).not.toThrow();

  expect(state.players.p1.board.length, "a lone Salvage Reflex dying should leave an empty board").toBe(0);
});

test("Salvage Reflex never targets itself: with two other allies alive, exactly one (not the dying unit) gains Barrier", () => {
  const state = emptyState();
  const rng = new Rng(3);
  const reflex = putUnit(state, "p1", salvageReflex);
  const allyA = putUnit(state, "p1", aegisCadet);
  const allyB = putUnit(state, "p1", aegisCadet);

  reflex.damageTaken = 10;
  processDeaths(state, rng);

  const barriered = [allyA, allyB].filter((u) => u.statuses.some((s) => s.kind === "Barrier"));
  expect(barriered.length, "exactly one surviving ally should have gained Barrier").toBe(1);
});

test("Aegis pool still builds a legal deck (lint + copy limits + size) after Phase 5 slice 1's growth", () => {
  const deck = buildAegisDeck("p1", "Aegis Test Deck");
  expect(deck.cards.length).toBe(40);
  const totalCopies = AEGIS_CARDS.reduce((sum, p) => sum + p.copies, 0);
  expect(totalCopies).toBe(40);
  const uniqueCount = new Set(AEGIS_CARDS.map((p) => p.card.id)).size;
  expect(uniqueCount, "Phase 5 slice 1 should have grown the pool from 18 to 22 unique cards").toBe(22);
});
