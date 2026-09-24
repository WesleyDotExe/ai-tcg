import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, RandomAgent, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import { captureMatch } from "../src/capture.js";

describe("captureMatch", () => {
  it("captures one frame per move, starting from an empty-board frame 0", async () => {
    const replay = await captureMatch({
      title: "test match",
      seed: 42,
      deckA: buildCortexDeck("p1", "Cortex"),
      deckB: buildSwarmDeck("p2", "Swarm"),
      agentA: new RandomAgent("RandomA", 1),
      agentB: new RandomAgent("RandomB", 2),
      boardSlots: BOARD_SLOTS,
    });

    expect(replay.frames.length).toBe(replay.movesPlayed + 1);
    expect(replay.frames[0]!.players.p1.board).toEqual([]);
    expect(replay.frames[0]!.players.p2.board).toEqual([]);
    expect(replay.frames[0]!.turnNumber).toBe(1);
  });

  it("ends with a winner or the turn cap reached, never mid-game", async () => {
    const replay = await captureMatch({
      title: "test match",
      seed: 7,
      deckA: buildCortexDeck("p1", "Cortex"),
      deckB: buildSwarmDeck("p2", "Swarm"),
      agentA: new RandomAgent("RandomA", 3),
      agentB: new RandomAgent("RandomB", 4),
      boardSlots: BOARD_SLOTS,
    });
    const last = replay.frames[replay.frames.length - 1]!;
    const reachedCap = last.turnNumber >= replay.turnCap;
    expect(last.winner !== undefined || reachedCap).toBe(true);
  });

  it("never reports more board+directive occupants than the shared slot cap", async () => {
    const replay = await captureMatch({
      title: "test match",
      seed: 99,
      deckA: buildCortexDeck("p1", "Cortex"),
      deckB: buildSwarmDeck("p2", "Swarm"),
      agentA: new RandomAgent("RandomA", 5),
      agentB: new RandomAgent("RandomB", 6),
      boardSlots: BOARD_SLOTS,
    });
    for (const frame of replay.frames) {
      for (const pid of ["p1", "p2"] as const) {
        const p = frame.players[pid];
        expect(p.slotsUsed).toBeLessThanOrEqual(p.slotsMax);
        expect(p.board.length + p.directives.length).toBe(p.slotsUsed);
      }
    }
  });

  it("keeps health within [0, maxHealth] and energy within [0, maxEnergy] every frame", async () => {
    const replay = await captureMatch({
      title: "test match",
      seed: 123,
      deckA: buildCortexDeck("p1", "Cortex"),
      deckB: buildSwarmDeck("p2", "Swarm"),
      agentA: new RandomAgent("RandomA", 8),
      agentB: new RandomAgent("RandomB", 9),
      boardSlots: BOARD_SLOTS,
    });
    for (const frame of replay.frames) {
      for (const pid of ["p1", "p2"] as const) {
        const p = frame.players[pid];
        expect(p.health).toBeGreaterThanOrEqual(0);
        expect(p.health).toBeLessThanOrEqual(p.maxHealth);
        expect(p.energy).toBeGreaterThanOrEqual(0);
        expect(p.energy).toBeLessThanOrEqual(p.maxEnergy);
      }
    }
  });

  it("attaches a momentum reading to every frame, computed from that frame's own snapshot", async () => {
    const replay = await captureMatch({
      title: "test match",
      seed: 55,
      deckA: buildCortexDeck("p1", "Cortex"),
      deckB: buildSwarmDeck("p2", "Swarm"),
      agentA: new RandomAgent("RandomA", 10),
      agentB: new RandomAgent("RandomB", 11),
      boardSlots: BOARD_SLOTS,
    });
    for (const frame of replay.frames) {
      expect(["p1", "p2", "even"]).toContain(frame.momentum.leader);
      expect(frame.momentum.reasons.length).toBeGreaterThan(0);
    }
  });
});
