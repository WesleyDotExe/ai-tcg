// `deepEqual` is what stands between "the client chose one of the legal
// moves we offered" and "the client cheated / is broken" — RemoteAgent uses
// it to structurally match a client's reply against the legalMoves list it
// sent, specifically so a client that reconstructs a move with a different
// key order isn't wrongly forfeited (see deepEqual.ts's own doc comment).

import { describe, expect, it } from "vitest";
import { deepEqual } from "../src/deepEqual.js";

describe("deepEqual", () => {
  it("matches primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("a", "b")).toBe(false);
  });

  it("matches objects regardless of key order", () => {
    const a = { type: "playCard", handIndex: 0, target: { kind: "player", playerId: "p2" } };
    const b = { target: { playerId: "p2", kind: "player" }, handIndex: 0, type: "playCard" };
    expect(deepEqual(a, b)).toBe(true);
  });

  it("rejects objects with a mismatched value at any depth", () => {
    const a = { type: "attack", attackerInstanceId: "u1", target: { kind: "unit", instanceId: "u2" } };
    const b = { type: "attack", attackerInstanceId: "u1", target: { kind: "unit", instanceId: "u3" } };
    expect(deepEqual(a, b)).toBe(false);
  });

  it("rejects objects with a missing or extra key", () => {
    expect(deepEqual({ type: "passPriority" }, { type: "passPriority", extra: true })).toBe(false);
    expect(deepEqual({ type: "passPriority", extra: true }, { type: "passPriority" })).toBe(false);
  });

  it("compares arrays positionally and by length", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 3, 2])).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("does not consider an array and an object with the same entries equal", () => {
    expect(deepEqual([0, 1], { 0: 0, 1: 1 })).toBe(false);
  });

  it("treats null distinctly from an empty object", () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
  });
});
