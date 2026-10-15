// The cost circle on board cards (render session 19, a hardening pass).
// Until now every unit and Directive on the board showed 0 there: the page
// had no cost to give it. The snapshot now carries the printed cost, and an
// ORACLE checks it on every frame of real matches: a set card's printed
// cost is the engine registry's; a signature card's is its generated card's
// (its replay surcharge is shown in the zone, not on the card). The page
// must pass that cost through and never fall back to a literal 0.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, CARD_REGISTRY, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { DeckSpec } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "../src/engineInternal.js";
import type { DeckFaction } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import { generatedSeats } from "../src/generatedSignatures.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import type { MatchReplay } from "../src/types.js";

const BUILDERS: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck, Aegis: buildAegisDeck, Swarm: buildSwarmDeck, Null: buildNullDeck,
};

async function replay(a: DeckFaction, b: DeckFaction, seed: number, signatures: boolean) {
  const seats = signatures ? generatedSeats(seed) : undefined;
  const r = await captureMatch({
    title: `${a} vs ${b}`, seed,
    deckA: { ...BUILDERS[a]("p1", a), ...(seats ? { signature: seats[0].card } : {}) },
    deckB: { ...BUILDERS[b]("p2", b), ...(seats ? { signature: seats[1].card } : {}) },
    agentA: new LookaheadAgent(seats ? seats[0].agentName : "A", seed * 2 + 1),
    agentB: new LookaheadAgent(seats ? seats[1].agentName : "B", seed * 2 + 2),
    boardSlots: BOARD_SLOTS,
  });
  const sigCost = new Map((seats ?? []).map((s) => [s.card.id, s.card.cost]));
  return { r, sigCost };
}

function expectedCost(cardId: string, sigCost: Map<string, number>): number | undefined {
  return sigCost.get(cardId) ?? CARD_REGISTRY.get(cardId)?.cost;
}

describe("the cost circle on board cards", () => {
  const cases: [DeckFaction, DeckFaction, number, boolean][] = [
    ["Cortex", "Aegis", 5, true], ["Null", "Swarm", 2, false], ["Aegis", "Cortex", 1, false], ["Swarm", "Null", 8, false],
  ];
  const replaysP = Promise.all(cases.map(([a, b, s, sig]) => replay(a, b, s, sig)));

  it("every unit and Directive on every frame carries its printed cost, as the engine has it", async () => {
    let units = 0, directives = 0, signatures = 0, nonZero = 0;
    for (const { r, sigCost } of await replaysP) {
      for (const f of r.frames) {
        for (const pid of ["p1", "p2"] as const) {
          for (const u of f.players[pid].board) {
            const want = expectedCost(u.cardId, sigCost);
            expect(want, `${r.title} move ${f.index}: ${u.cardId} is a known card`).toBeDefined();
            expect(u.printedCost, `${r.title} move ${f.index}: ${u.name}`).toBe(want);
            units++;
            if (u.printedCost > 0) nonZero++;
            if (u.isSignature) signatures++;
          }
          for (const d of f.players[pid].directives) {
            expect(d.printedCost, `${r.title} move ${f.index}: ${d.name}`).toBe(expectedCost(d.cardId, sigCost));
            directives++;
          }
        }
      }
    }
    // The net caught real boards: units, Directives and signature units.
    expect(units).toBeGreaterThan(500);
    expect(directives).toBeGreaterThan(0);
    expect(signatures).toBeGreaterThan(0);
    expect(nonZero).toBeGreaterThan(units * 0.9);
  }, 120_000);

  it("a signature unit on the board shows its printed cost, not what the replay charged", async () => {
    const [{ r, sigCost }] = await replaysP;
    let seenAfterReplay = false;
    for (const f of r!.frames) {
      for (const pid of ["p1", "p2"] as const) {
        const z = f.players[pid].signature!;
        const u = f.players[pid].board.find((x) => x.isSignature);
        if (!u) continue;
        expect(u.printedCost).toBe(sigCost.get(u.cardId));
        expect(u.printedCost).toBe(z.baseCost);
        if (z.timesPlayed >= 2) seenAfterReplay = true;
      }
    }
    // The showcase replays a card, so this covers the climbed case.
    expect(seenAfterReplay).toBe(true);
  }, 120_000);

  it("the page passes the snapshot's cost through, with no literal 0", async () => {
    const [{ r }] = await replaysP;
    const html = renderMatchHtml(r as MatchReplay);
    expect(html).toContain("cost: u.printedCost, type: 'Unit'");
    expect(html).toContain("cost: d.printedCost, type: 'Directive'");
    expect(html).not.toMatch(/cost: 0, type: '(Unit|Directive)'/);
  }, 60_000);
});

describe("narrow screens", () => {
  // The page is checked for sideways overflow in headless Chromium (see
  // progress/render/evidence/narrow-overflow-check.txt); these pins keep
  // the rules that fixed it from being dropped by accident.
  it("keeps the shrinking HUD, the stacked gauge and the stacked lower row", async () => {
    const r = await captureMatch({
      title: "plain", seed: 1, deckA: buildCortexDeck("p1", "C"), deckB: buildAegisDeck("p2", "A"),
      agentA: new LookaheadAgent("A", 3), agentB: new LookaheadAgent("B", 4), boardSlots: BOARD_SLOTS,
    });
    const html = renderMatchHtml(r);
    expect(html).toContain("@media (max-width: 900px) {\n  .hud-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }");
    expect(html).toContain(".hud-row .momentum { grid-column: 1 / -1; order: 3; }");
    expect(html).toContain("@media (max-width: 560px) {\n  .hud-row { grid-template-columns: minmax(0, 1fr); }");
    expect(html).toContain(".lower .eventlog { grid-column: 1 / -1; order: 3; }");
    // Status badges sit under the head, clear of the cost circle.
    expect(html).toContain(".card .shields { position: absolute; top: 22px;");
  }, 60_000);
});

describe("the FX sheet's Neutral ward gallery", () => {
  it("shows the generated signature cards the committed replays carry, not the old placeholders", async () => {
    const { renderFxSheet, galleryNeutralNames } = await import("../src/fxSheet.js");
    const names = galleryNeutralNames();
    expect(names).toEqual([...generatedSeats(5).map((s) => s.card.name), generatedSeats(2)[0].card.name]);
    const html = renderFxSheet();
    expect(html).toContain(`['Neutral', ${JSON.stringify(names)}]`);
    expect(html).not.toContain("Consensus Lantern");
    expect(html).not.toContain("Tollgate Daemon");
  }, 60_000);
});
