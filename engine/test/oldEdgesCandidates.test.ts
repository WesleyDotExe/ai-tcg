// The balance session's job 2 (session 61): the candidate errata in
// src/dev/oldEdgesCandidates.ts. Their numbers only mean something if each
// candidate changes exactly the card it names, still builds a legal deck
// (copy limits, size, neutral cap, pool lint) and never touches the shipped
// data in a process that didn't ask for it. Each test loads a fresh copy of
// the card modules (vi.resetModules), because applyCandidate mutates the
// card objects it is handed.

import { describe, expect, it, vi } from "vitest";
import { getCard as shippedGetCard } from "../src/data/registry.js";

async function fresh() {
  vi.resetModules();
  const registry = await import("../src/data/registry.js");
  const decks = await import("../src/data/decks.js");
  const cand = await import("../src/dev/oldEdgesCandidates.js");
  return { ...registry, ...decks, ...cand };
}

const snapshot = (m: Awaited<ReturnType<typeof fresh>>) =>
  new Map([...m.CARD_REGISTRY].map(([id, c]) => [id, JSON.stringify(c)]));

describe("the old-edges candidates", () => {
  it("every candidate builds legal decks for all four factions", async () => {
    const { CANDIDATES } = await fresh();
    for (const { key } of CANDIDATES) {
      const m = await fresh();
      m.applyCandidate(key, m.getCard);
      expect(() => {
        m.buildCortexDeck("p1", "c");
        m.buildSwarmDeck("p1", "s");
        m.buildAegisDeck("p1", "a");
        m.buildNullDeck("p1", "n");
      }, key).not.toThrow();
    }
  });

  it("each candidate changes only the cards it names, and 'shipped' changes nothing", async () => {
    const expected: Record<string, string[]> = {
      shipped: [],
      NA1: ["NL-018"], NA2: ["NL-018"], NA3: ["NL-004"], NA4: ["NL-009"], NA6: ["AG-013"], NA7: ["NL-013"],
      NA8: ["NL-015"], NA9: ["NL-015"], NA10: ["NL-015"], NA12: ["NL-015"], NA11: ["NL-014"],
      CS1: ["CX-005"], CS2: ["CX-020"], CS3: ["CX-013"], CS4: ["CX-023"], CS5: ["CX-021"], CS6: ["CX-024"],
      CS7: ["CX-019"], CS8: ["CX-019"],
      "NA12+CS7": ["CX-019", "NL-015"],
    };
    const { CANDIDATES } = await fresh();
    expect(Object.keys(expected).filter((k) => !k.includes("+")).sort()).toEqual(CANDIDATES.map((c) => c.key).sort());
    for (const [key, ids] of Object.entries(expected)) {
      const m = await fresh();
      const before = snapshot(m);
      m.applyCandidate(key, m.getCard);
      const after = snapshot(m);
      const changed = [...after].filter(([id, json]) => before.get(id) !== json).map(([id]) => id).sort();
      expect(changed, key).toEqual(ids);
    }
  });

  it("the two lead candidates read as their labels say", async () => {
    const m = await fresh();
    m.applyCandidate("NA12+CS7", m.getCard);
    const np = m.getCard("NL-015")!;
    expect(np.cost).toBe(2);
    expect(np.abilities).toEqual([]);
    expect(np.modes!.map((x) => x.name)).toEqual(["Dereference", "Null Out"]);
    expect(np.modes![1]!.abilities[0]!.effects).toEqual([{ kind: "buff", attack: -3, health: -3, duration: "permanent" }]);
    const fq = m.getCard("CX-019")!;
    expect(fq.modes!.map((x) => x.name)).toEqual(["Terminate", "Kill All"]);
    expect(fq.modes![1]!.abilities[0]!.targeting).toEqual({ scope: "all", filter: { side: "opponent", kind: "unit" } });
    // The printed answer is kept, unchanged, as the first mode.
    expect(fq.modes![0]!.abilities[0]!.effects).toEqual([{ kind: "destroy" }]);
  });

  it("never changes the shipped cards of a process that didn't apply one", async () => {
    const m = await fresh();
    m.applyCandidate("NA12+CS7", m.getCard);
    expect(shippedGetCard("NL-015")!.modes).toBeUndefined();
    expect(shippedGetCard("CX-019")!.modes).toBeUndefined();
  });

  it("refuses an unknown key", async () => {
    const m = await fresh();
    expect(() => m.applyCandidate("NA99", m.getCard)).toThrow(/no candidate NA99/);
  });
});
