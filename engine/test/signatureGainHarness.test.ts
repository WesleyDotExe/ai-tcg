// The report drivers behind balance reports 031 and 032 (aegisSignatureGain.ts,
// aegisLateDeckTrial.ts) share signatureGainHarness.ts. Two things they rely
// on are pinned here, cheaply, so the drivers can't drift silently between
// the sessions that run them: the harness plays the ring's own games, and
// every option-C trial list is a legal deck.

import { describe, expect, it } from "vitest";
import { play } from "../src/dev/signatureGainHarness.js";
import { measurePairing } from "../src/dev/edgeMeasure.js";
import { RING_EDGES } from "../src/dev/ringRegression.js";
import { TRIALS, trialPool } from "../src/dev/aegisLateDeckTrial.js";
import { buildDeck } from "../src/data/decks.js";
import { AEGIS_CARDS } from "../src/data/aegisCards.js";
import type { DeckFaction as Faction } from "../src/cards/types.js";

describe("signature gain harness", () => {
  it("plays the same games as the ring, in the gate and in the real-match mode", async () => {
    const e = RING_EDGES.find((x) => x.self === "Null" && x.opponent === "Aegis")!;
    const n = 6;
    for (const [mode, sig] of [["none", new Set<Faction>()], ["approved", new Set<Faction>(["Null", "Aegis"])]] as const) {
      const ring = await measurePairing(e.self, e.opponent, 1, n, { signature: mode });
      const ours = await play(e, { sig }, n);
      expect(ours.side[e.self].wins, mode).toBe(ring.selfWins);
    }
  }, 60_000);

  it("every option-C trial list builds and lints as a real 40-card deck, and changes only copy counts", () => {
    const shippedIds = new Set(AEGIS_CARDS.map((p) => p.card.id));
    for (const t of TRIALS) {
      const pool = trialPool(t.copies);
      expect(buildDeck("p1", t.key, pool).cards.length, t.key).toBe(40);
      // In the brief: Aegis cards already in the list. Comparisons may add neutral cards.
      for (const p of pool) if (!t.comparison) expect(shippedIds.has(p.card.id), `${t.key} ${p.card.name}`).toBe(true);
    }
    expect(() => trialPool({ "No Such Card": 1 })).toThrow(/neither in the Aegis list/);
  });
});
