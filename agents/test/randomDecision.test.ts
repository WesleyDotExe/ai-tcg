import { describe, expect, it } from "vitest";
import type { Move, PlayerView } from "@ai-tcg/protocol";
import { makeRandomDecision } from "../src/randomDecision.js";

const dummyView = {} as PlayerView;

describe("makeRandomDecision", () => {
  it("only ever returns a move from the supplied legalMoves list", () => {
    const decide = makeRandomDecision(1);
    const legalMoves: Move[] = [
      { type: "passPriority" },
      { type: "playCard", handIndex: 0 },
      { type: "playCard", handIndex: 1 },
    ];
    for (let i = 0; i < 100; i++) {
      const move = decide(dummyView, legalMoves);
      expect(legalMoves).toContainEqual(move);
    }
  });

  it("is deterministic for a given seed", () => {
    const legalMoves: Move[] = [
      { type: "passPriority" },
      { type: "playCard", handIndex: 0 },
      { type: "attack", attackerInstanceId: "u1", target: { kind: "player", playerId: "p2" } },
    ];
    const a = makeRandomDecision(55);
    const b = makeRandomDecision(55);
    const sequenceA = Array.from({ length: 20 }, () => a(dummyView, legalMoves));
    const sequenceB = Array.from({ length: 20 }, () => b(dummyView, legalMoves));
    expect(sequenceA).toEqual(sequenceB);
  });

  it("returns the only legal move when passPriority is the sole option", () => {
    const decide = makeRandomDecision(2);
    const legalMoves: Move[] = [{ type: "passPriority" }];
    expect(decide(dummyView, legalMoves)).toEqual({ type: "passPriority" });
  });

  it("picks a non-pass move far more often than passing when both are available", () => {
    const decide = makeRandomDecision(3);
    const legalMoves: Move[] = [{ type: "passPriority" }, { type: "playCard", handIndex: 0 }];
    let passes = 0;
    const samples = 500;
    for (let i = 0; i < samples; i++) {
      if (decide(dummyView, legalMoves).type === "passPriority") passes++;
    }
    // Weighted 15% pass / 85% non-pass (randomDecision.ts) — assert it's
    // meaningfully down-weighted, not an exact statistical bound.
    expect(passes / samples).toBeLessThan(0.3);
  });
});
