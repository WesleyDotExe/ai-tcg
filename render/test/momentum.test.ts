import { describe, expect, it } from "vitest";
import { computeMomentum } from "../src/momentum.js";
import type { PlayerSnapshot } from "../src/types.js";

function player(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    id: "p1",
    name: "Test",
    faction: "Aegis",
    health: 20,
    maxHealth: 20,
    energy: 3,
    maxEnergy: 5,
    hand: [],
    deckSize: 30,
    graveyardSize: 0,
    board: [],
    directives: [],
    slotsUsed: 0,
    slotsMax: 6,
    ...overrides,
  };
}

describe("computeMomentum", () => {
  it("reads even with identical snapshots", () => {
    const reading = computeMomentum(player({ id: "p1" }), player({ id: "p2" }));
    expect(reading.leader).toBe("even");
    expect(reading.score).toBe(0);
    expect(reading.reasons).toContain("close — no single clear edge yet");
  });

  it("favours p1 when p1 has clearly more health, and names why", () => {
    const reading = computeMomentum(player({ id: "p1", name: "Kestrel", health: 20 }), player({ id: "p2", name: "Mote", health: 5 }));
    expect(reading.leader).toBe("p1");
    expect(reading.score).toBeGreaterThan(0);
    expect(reading.reasons).toContain("Kestrel ahead on health");
  });

  it("favours p2 when p2 has clearly more board power", () => {
    const bigBoard: PlayerSnapshot["board"] = [
      { instanceId: "u1", cardId: "X", name: "Big", faction: "Swarm", rarity: "Common", flavor: "", attack: 5, health: 5, maxHealth: 5, keywords: [], pending: false, isEvolved: false, canAttackThisTurn: true, tools: [], statuses: [], visualSeed: 0, visualPattern: 0 },
    ];
    const reading = computeMomentum(player({ id: "p1", board: [] }), player({ id: "p2", board: bigBoard }));
    expect(reading.leader).toBe("p2");
    expect(reading.reasons.some((r) => r.includes("board"))).toBe(true);
  });

  it("ignores pending (telegraphed, dormant) units as board power", () => {
    const dormant: PlayerSnapshot["board"] = [
      { instanceId: "u1", cardId: "X", name: "Dormant", faction: "Aegis", rarity: "Common", flavor: "", attack: 5, health: 5, maxHealth: 5, keywords: [], pending: true, armTurn: 3, isEvolved: false, canAttackThisTurn: false, tools: [], statuses: [], visualSeed: 0, visualPattern: 0 },
    ];
    const withDormant = computeMomentum(player({ id: "p1", board: dormant }), player({ id: "p2" }));
    const withoutAny = computeMomentum(player({ id: "p1", board: [] }), player({ id: "p2" }));
    expect(withDormant.score).toBe(withoutAny.score);
  });

  it("clamps the score into [-100, 100] for extreme swings", () => {
    const reading = computeMomentum(player({ id: "p1", health: 30, hand: new Array(10).fill(null) as any }), player({ id: "p2", health: 0 }));
    expect(reading.score).toBeLessThanOrEqual(100);
    expect(reading.score).toBeGreaterThanOrEqual(-100);
  });
});
