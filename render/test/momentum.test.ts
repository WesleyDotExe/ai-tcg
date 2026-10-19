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
  // Render session 35 (owner 2026-10-19): at the end of the close-win replay
  // the board terms had the loser ahead while the boast played.
  it("reads the result once the match is won, even when the board favours the loser", () => {
    const loserBoard: PlayerSnapshot["board"] = [
      { instanceId: "u1", cardId: "X", name: "Big", faction: "Swarm", rarity: "Common", flavor: "", attack: 9, health: 9, maxHealth: 9, keywords: [], pending: false, isEvolved: false, canAttackThisTurn: true, tools: [], statuses: [], visualSeed: 0, visualPattern: 0 },
    ];
    const p1 = player({ id: "p1", name: "Kestrel", health: 3 }), p2 = player({ id: "p2", name: "Mote", health: 0, board: loserBoard, hand: new Array(6).fill(null) as any });
    expect(computeMomentum(p1, p2).leader).toBe("p2");
    const won = computeMomentum(p1, p2, "p1");
    expect(won).toEqual({ score: 100, leader: "p1", reasons: ["Mote out of health"] });
    const wonTop = computeMomentum(player({ id: "p1", name: "Kestrel", health: 4 }), player({ id: "p2", name: "Mote", health: 2 }), "p2");
    expect(wonTop).toEqual({ score: -100, leader: "p2", reasons: ["Mote won the match"] });
  });

  it("a draw or a match still running reads the board", () => {
    const a = player({ id: "p1", name: "Kestrel", health: 20 }), b = player({ id: "p2", name: "Mote", health: 5 });
    expect(computeMomentum(a, b, "draw")).toEqual(computeMomentum(a, b));
    expect(computeMomentum(a, b, null)).toEqual(computeMomentum(a, b));
  });
});
