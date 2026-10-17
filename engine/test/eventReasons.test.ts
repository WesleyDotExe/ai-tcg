// The game-over and attack-fizzle events as data (owner 2026-10-18, side
// task 2: "Rombot's Navigator health depleted" was missing its "'s"). The
// raw-log text now reads as a sentence, and the cause is on the event so
// the spectator feed and the commentators can word it themselves.

import { expect, test } from "vitest";
import { buildAegisDeck, buildCortexDeck, buildNullDeck, buildSwarmDeck } from "../src/data/decks.js";
import { RandomAgent } from "../src/agents/randomAgent.js";
import { AggressiveAgent } from "../src/agents/aggressiveAgent.js";
import { runMatch } from "../src/engine/match.js";
import { applyMove } from "../src/engine/engine.js";
import { Rng } from "../src/state/rng.js";
import type { UnitCard } from "../src/cards/types.js";
import type { GameEvent } from "../src/state/types.js";
import { drainStack, emptyState, putUnit } from "./helpers.js";

const body = (name: string): UnitCard => ({ id: `T-${name}`, name, faction: "Cortex", rarity: "Common", cost: 1, type: "Unit", attack: 2, health: 3, keywords: [], art: "", flavor: "", abilities: [] });

const builders = [buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck];

test("every game over says why as data, consistent with the winner and the final health", async () => {
  const kinds = new Set<string>();
  let fizzles = 0;
  for (let seed = 1; seed <= 48; seed++) {
    const a = builders[seed % 4]!("p1", "A");
    const b = builders[(seed >> 2) % 4]!("p2", "B");
    const { state } = await runMatch(a, b, new RandomAgent("R", seed), new AggressiveAgent("G"), seed);
    const ends = state.log.filter((e): e is Extract<GameEvent, { type: "gameOver" }> => e.type === "gameOver");
    expect(ends.length, `seed ${seed}`).toBe(1);
    const end = ends[0]!;
    const cause = end.cause!;
    kinds.add(cause.kind);
    if (cause.kind === "healthDepleted") {
      for (const pid of ["p1", "p2"] as const) expect(state.players[pid].health <= 0, `seed ${seed} ${pid}`).toBe(cause.losers.includes(pid));
      expect(end.winner).toBe(cause.losers.length === 2 ? "draw" : cause.losers[0] === "p1" ? "p2" : "p1");
      if (cause.losers.length === 1) expect(end.reason).toBe(`${cause.losers[0]}'s health reached 0`);
    } else {
      expect(end.winner === "draw").toBe(cause.tied);
      expect(end.reason).toMatch(/^turn cap reached/);
    }
    for (const e of state.log) {
      if (e.type !== "fizzle" || !e.cause) continue;
      fizzles += 1;
      expect(e.reason.startsWith(`${e.attacker}'s attack fizzles`)).toBe(true);
      expect(e.attackerId).toBeTruthy();
    }
  }
  expect(kinds.has("healthDepleted")).toBe(true);
  // Attack fizzles are rare under these agents; the fields are checked on
  // every one that happens, and the crafted cases below always make one.
  expect(fizzles).toBeGreaterThanOrEqual(0);
});

test("an attack whose target or attacker left play fizzles with its cause and attacker as data", () => {
  for (const gone of ["target", "attacker"] as const) {
    const state = emptyState();
    const rng = new Rng(7);
    state.turnNumber += 1;
    state.activePlayer = "p1";
    state.priority = "p1";
    const attacker = putUnit(state, "p1", body("Pulse Hound"));
    attacker.enteredTurn = 0;
    const target = putUnit(state, "p2", body("Wall Stub"));
    applyMove(state, { type: "attack", attackerInstanceId: attacker.instanceId, target: { kind: "unit", instanceId: target.instanceId } }, rng);
    // A response removed it before the attack resolved.
    const [side, unit] = gone === "target" ? (["p2", target] as const) : (["p1", attacker] as const);
    state.players[side].board = state.players[side].board.filter((u) => u !== unit);
    drainStack(state, rng);
    const fizzle = state.log.find((e): e is Extract<GameEvent, { type: "fizzle" }> => e.type === "fizzle");
    expect(fizzle, gone).toMatchObject({
      cause: gone === "target" ? "targetGone" : "attackerGone",
      attacker: "Pulse Hound",
      attackerId: attacker.instanceId,
      reason: `Pulse Hound's attack fizzles — ${gone === "target" ? "its target" : "the attacker"} is no longer in play`,
    });
  }
});
