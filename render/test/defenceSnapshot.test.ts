// EFFECTS.md slice 1 (defence/shield) needs two new UnitSnapshot fields —
// baseArmor and barrierActive — to drive the deflect/interpose-shatter FX
// and the persistent shield badges. These whitebox tests prove capture.ts
// actually reads them off real engine state correctly, in real (not
// synthetic) matches, the same seed-scan style the balance lane's own
// dev-demo scripts use to find real scenarios rather than hand-fabricating
// fixtures.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, RandomAgent, buildAegisDeck, buildSwarmDeck } from "@ai-tcg/engine";
import { captureMatch } from "../src/capture.js";

describe("UnitSnapshot defence fields (EFFECTS.md slice 1)", () => {
  it("reports baseArmor: 1 on Aegis Cadet (AG-001), a real base card with the mechanic", async () => {
    let sawArmoredCadet = false;
    for (let seed = 1; seed <= 25 && !sawArmoredCadet; seed++) {
      const replay = await captureMatch({
        title: "defence-fields-scan",
        seed,
        deckA: buildAegisDeck("p1", "Aegis"),
        deckB: buildSwarmDeck("p2", "Swarm"),
        agentA: new RandomAgent("A", seed),
        agentB: new RandomAgent("B", seed + 1000),
        boardSlots: BOARD_SLOTS,
      });
      for (const frame of replay.frames) {
        for (const pid of ["p1", "p2"] as const) {
          for (const u of frame.players[pid].board) {
            if (u.cardId === "AG-001" && u.baseArmor === 1) sawArmoredCadet = true;
          }
        }
      }
    }
    expect(sawArmoredCadet).toBe(true);
  });

  it("units with no baseArmor on their card (e.g. the opposing deck's non-base units) report 0", async () => {
    const replay = await captureMatch({
      title: "no-armor-scan",
      seed: 1,
      deckA: buildAegisDeck("p1", "Aegis"),
      deckB: buildSwarmDeck("p2", "Swarm"),
      agentA: new RandomAgent("A", 1),
      agentB: new RandomAgent("B", 2),
      boardSlots: BOARD_SLOTS,
    });
    let sawUnarmored = false;
    for (const frame of replay.frames) {
      for (const u of frame.players.p2.board) {
        expect(u.baseArmor).toBeGreaterThanOrEqual(0);
        if (u.baseArmor === 0) sawUnarmored = true;
      }
    }
    expect(sawUnarmored).toBe(true);
  });

  it("marks barrierActive true the moment a Barrier-keyword unit (Barrier Node, SW-008) enters play", async () => {
    let sawActive = false;
    for (let seed = 1; seed <= 40 && !sawActive; seed++) {
      const replay = await captureMatch({
        title: "barrier-fields-scan",
        seed,
        deckA: buildSwarmDeck("p1", "Swarm"),
        deckB: buildAegisDeck("p2", "Aegis"),
        agentA: new RandomAgent("A", seed),
        agentB: new RandomAgent("B", seed + 2000),
        boardSlots: BOARD_SLOTS,
      });
      for (const frame of replay.frames) {
        for (const pid of ["p1", "p2"] as const) {
          for (const u of frame.players[pid].board) {
            if (u.cardId === "SW-008" && u.barrierActive) sawActive = true;
          }
        }
      }
    }
    expect(sawActive).toBe(true);
  });
});
