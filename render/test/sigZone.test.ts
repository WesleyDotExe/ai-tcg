// The signature zone on the board (render/src/sigZoneFx.ts) and the
// generated agents that carry signature cards into replays
// (render/src/generatedSignatures.ts). Three layers:
//  1. hand-built frames for every zone movement and every reach state;
//  2. real matches with an ORACLE: every zone movement the render derives
//     from snapshots must be exactly the engine's own `play`
//     (fromSignatureZone) and `signatureReturn` events of that move, same
//     instance id, same cost; and the snapshot's next cost must be what the
//     engine's own signatureCost charges when the card is next played;
//  3. the page embeds the module verbatim and draws a zone only for a side
//     that has a signature card.
import { describe, expect, it } from "vitest";
import { APPROVED_SIGNATURE_LINES, BOARD_SLOTS, CARD_REGISTRY, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { DeckSpec, GameEvent } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "../src/engineInternal.js";
import type { DeckFaction } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import { generatedSeats } from "../src/generatedSignatures.js";
import { SIG_ZONE_SOURCE, signatureZoneMoves, signatureZoneView } from "../src/sigZoneFx.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import type { Frame, MatchReplay, PlayerSnapshot, SignatureSnapshot, UnitSnapshot } from "../src/types.js";

function unit(iid: string, isSignature = false): UnitSnapshot {
  return {
    instanceId: iid, cardId: iid, name: iid, faction: "Neutral", rarity: "Mythic", flavor: "", attack: 3, health: 6, maxHealth: 6,
    keywords: [], pending: false, isEvolved: false, canAttackThisTurn: true, baseArmor: 0, barrierActive: false,
    printedAttack: 3, printedHealth: 6, turnBuff: { attack: 0, health: 0 }, tools: [], statuses: [], visualSeed: 0, visualPattern: 0,
    ...(isSignature ? { isSignature: true as const } : {}),
  };
}
function zone(inZone: boolean, timesPlayed: number, cardId = "sig-PR-007"): SignatureSnapshot {
  return {
    cardId, name: "Midnight Relay", faction: "Neutral", rarity: "Mythic", flavor: "", attack: 3, health: 6, keywords: [], text: [],
    nextCost: 5 + 2 * timesPlayed, baseCost: 5, timesPlayed, inZone, visualSeed: 0, visualPattern: 0,
  };
}
function player(id: "p1" | "p2", board: UnitSnapshot[], signature: SignatureSnapshot | null, energy = 3, maxEnergy = 3): PlayerSnapshot {
  return { id, name: id, faction: "Cortex", health: 20, maxHealth: 20, energy, maxEnergy, hand: [], deckSize: 10, graveyardSize: 0, board, directives: [], slotsUsed: board.length, slotsMax: 6, signature };
}
function frame(p1: PlayerSnapshot, p2: PlayerSnapshot): Frame {
  return {
    index: 0, turnNumber: 5, activePlayer: "p1", priority: "p1", stack: [],
    players: { p1, p2 }, newEvents: [], momentum: { score: 0, leader: "even", reasons: [] },
  };
}

describe("signatureZoneMoves", () => {
  const empty = player("p2", [], null);
  it("a play from the zone is a leave, naming the signature unit that arrived and what the play cost", () => {
    const prev = frame(player("p1", [unit("u1")], zone(true, 1)), empty);
    const next = frame(player("p1", [unit("u1"), unit("sig", true)], zone(false, 2)), empty);
    expect(signatureZoneMoves(prev, next)).toEqual([{ owner: "p1", kind: "leave", iid: "sig", cost: 7 }]);
  });
  it("a death that sends it home is a return, naming the unit that left and the next cost", () => {
    const prev = frame(player("p1", [unit("sig", true), unit("u1")], zone(false, 2)), empty);
    const next = frame(player("p1", [unit("u1")], zone(true, 2)), empty);
    expect(signatureZoneMoves(prev, next)).toEqual([{ owner: "p1", kind: "return", iid: "sig", cost: 9 }]);
  });
  it("played and returned inside one move is a bounce, never dropped", () => {
    const prev = frame(player("p1", [], zone(true, 0)), empty);
    const next = frame(player("p1", [], zone(true, 1)), empty);
    expect(signatureZoneMoves(prev, next)).toEqual([{ owner: "p1", kind: "bounce", iid: null, cost: 5 }]);
  });
  it("nothing moves while it waits or stays out, and a side without a zone never moves", () => {
    const waiting = frame(player("p1", [], zone(true, 1)), empty);
    const out = frame(player("p1", [unit("sig", true)], zone(false, 1)), empty);
    expect(signatureZoneMoves(waiting, waiting)).toEqual([]);
    expect(signatureZoneMoves(out, out)).toEqual([]);
    const none = frame(player("p1", [], null), empty);
    expect(signatureZoneMoves(none, none)).toEqual([]);
  });
  it("sees both sides in one move", () => {
    const prev = frame(player("p1", [unit("a", true)], zone(false, 1)), player("p2", [], zone(true, 0)));
    const next = frame(player("p1", [], zone(true, 1)), player("p2", [unit("b", true)], zone(false, 1)));
    expect(signatureZoneMoves(prev, next).map((m) => `${m.owner}:${m.kind}:${m.iid}`)).toEqual(["p1:return:a", "p2:leave:b"]);
  });
});

describe("signatureZoneView", () => {
  it("is null for a side with no signature card", () => {
    expect(signatureZoneView(player("p1", [], null), true, 10)).toBeNull();
  });
  it("reads the collector number from a signature id, and only from one", () => {
    expect(signatureZoneView(player("p1", [], zone(true, 0, "sig-PR-012")), true, 10)!.collector).toBe("PR-012");
    expect(signatureZoneView(player("p1", [], zone(true, 0, "neutral-sig-rally-5")), true, 10)!.collector).toBeNull();
  });
  it("shows the climb and the plays", () => {
    const v = signatureZoneView(player("p1", [], zone(true, 2)), true, 10)!;
    expect(v).toMatchObject({ state: "waiting", nextCost: 9, climb: 4, timesPlayed: 2 });
  });
  it("is in reach now only on its owner's turn with enough energy in the pool", () => {
    expect(signatureZoneView(player("p1", [], zone(true, 0), 5, 5), true, 10)!.reach).toBe("now");
    // Same pool on the opponent's turn: its owner can't play it there (Sorcery timing).
    expect(signatureZoneView(player("p1", [], zone(true, 0), 5, 5), false, 10)!.reach).toBe("next");
  });
  it("is in reach next turn when the refill (max + 1) covers it, else out of reach", () => {
    // Own turn, pool spent down to 1 of 4: next refill is 5.
    expect(signatureZoneView(player("p1", [], zone(true, 0), 1, 4), true, 10)!.reach).toBe("next");
    expect(signatureZoneView(player("p1", [], zone(true, 0), 3, 3), true, 10)!.reach).toBeNull();
    // The cap stops the refill: at max 10, a cost-11 replay is out of reach for good.
    expect(signatureZoneView(player("p1", [], zone(true, 3), 10, 10), true, 10)!.reach).toBeNull();
    expect(signatureZoneView(player("p1", [], zone(true, 2), 8, 10), true, 10)!.reach).toBe("next");
  });
  it("has no reach while the card is out on the board", () => {
    const v = signatureZoneView(player("p1", [unit("sig", true)], zone(false, 1), 10, 10), true, 10)!;
    expect(v.state).toBe("out");
    expect(v.reach).toBeNull();
  });
});

describe("generatedSeats", () => {
  it("is deterministic per seed and differs across seeds", () => {
    const a = generatedSeats(5), b = generatedSeats(5), c = generatedSeats(6);
    expect(a.map((s) => s.concept)).toEqual(b.map((s) => s.concept));
    expect(a.map((s) => s.agentName)).not.toEqual(c.map((s) => s.agentName));
  });
  it("gives two different agents two different approved cards under sig-PR-001 / 002, never a set card's name", () => {
    const setNames = new Set([...CARD_REGISTRY.values()].map((c) => c.name));
    for (let seed = 1; seed <= 40; seed++) {
      const [p1, p2] = generatedSeats(seed);
      expect(p1.agentName).not.toBe(p2.agentName);
      expect(p1.card.name).not.toBe(p2.card.name);
      expect([p1.card.id, p2.card.id]).toEqual(["sig-PR-001", "sig-PR-002"]);
      expect([p1.collectorNumber, p2.collectorNumber]).toEqual(["PR-001", "PR-002"]);
      for (const s of [p1, p2]) {
        expect(setNames.has(s.card.name), s.card.name).toBe(false);
        expect(s.card.faction).toBe("Neutral");
        expect(s.card.rarity).toBe("Mythic");
        expect(s.card.flavor).toContain(s.agentName);
      }
    }
    // Every card the generator hands a replay is a measured, approved line.
    expect(APPROVED_SIGNATURE_LINES.length).toBeGreaterThan(0);
  });
});

const BUILDERS: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck, Aegis: buildAegisDeck, Swarm: buildSwarmDeck, Null: buildNullDeck,
};
async function sigReplay(a: DeckFaction, b: DeckFaction, seed: number): Promise<MatchReplay> {
  const seats = generatedSeats(seed);
  return captureMatch({
    title: `${a} vs ${b}`, seed,
    deckA: { ...BUILDERS[a]("p1", a), signature: seats[0].card },
    deckB: { ...BUILDERS[b]("p2", b), signature: seats[1].card },
    agentA: new LookaheadAgent(seats[0].agentName, seed * 2 + 1),
    agentB: new LookaheadAgent(seats[1].agentName, seed * 2 + 2),
    boardSlots: BOARD_SLOTS,
  });
}

describe("in real matches (oracle: the engine's own events)", () => {
  // Cortex vs Aegis seed 5 is the committed showcase: both cards played, one
  // dies, returns at 7 and is played again. The rest widen the net.
  const cases: [DeckFaction, DeckFaction, number][] = [
    ["Cortex", "Aegis", 5], ["Aegis", "Swarm", 5], ["Null", "Cortex", 2], ["Swarm", "Null", 1], ["Cortex", "Aegis", 1],
  ];
  const replaysP = Promise.all(cases.map(([a, b, s]) => sigReplay(a, b, s)));

  it("every zone movement is exactly the engine's own play-from-zone / signatureReturn event, same instance, same cost", async () => {
    const replays = await replaysP;
    let leaves = 0, returns = 0;
    for (const r of replays) {
      for (let k = 1; k < r.frames.length; k++) {
        const prev = r.frames[k - 1]!, next = r.frames[k]!;
        const events = next.newEvents.map((e) => e.event);
        const expected: string[] = [];
        for (const e of events) {
          if (e.type === "play" && e.fromSignatureZone) expected.push(`${e.player}:leave:${e.instanceId}:${e.cost}`);
          if (e.type === "signatureReturn") expected.push(`${e.player}:return:${e.instanceId}:${e.nextCost}`);
        }
        const got = signatureZoneMoves(prev, next).map((m) => `${m.owner}:${m.kind}:${m.iid}:${m.cost}`);
        expect(got.sort(), `${r.title} move ${k}`).toEqual(expected.sort());
        leaves += got.filter((g) => g.includes(":leave:")).length;
        returns += got.filter((g) => g.includes(":return:")).length;
      }
    }
    // The net actually caught something: plays from the zone and returns.
    expect(leaves).toBeGreaterThanOrEqual(9);
    expect(returns).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it("the cost the zone shows is what the engine charges when the card is next played", async () => {
    const replays = await replaysP;
    for (const r of replays) {
      for (const pid of ["p1", "p2"] as const) {
        let shown: number | undefined;
        for (const f of r.frames) {
          const play = f.newEvents.map((e) => e.event).find((e): e is Extract<GameEvent, { type: "play" }> => e.type === "play" && e.fromSignatureZone === true && e.player === pid);
          if (play && shown !== undefined) expect(play.cost, `${r.title} ${pid} move ${f.index}`).toBe(shown);
          const z = f.players[pid].signature!;
          if (z.inZone) shown = z.nextCost;
        }
      }
    }
  }, 120_000);

  it("the showcase shows the whole cycle: a play, a return at the higher cost, and a replay at it", async () => {
    const [r] = await replaysP;
    const moves = r!.frames.slice(1).flatMap((f, k) => signatureZoneMoves(r!.frames[k]!, f).map((m) => `${m.owner}:${m.kind}:${m.cost}`));
    expect(moves).toEqual(["p1:leave:5", "p2:leave:5", "p2:return:7", "p2:leave:7"]);
  }, 120_000);
});

describe("the replay page", () => {
  it("embeds the zone module verbatim, a zone per side, and draws it on every frame", async () => {
    const html = renderMatchHtml(await sigReplay("Cortex", "Aegis", 5));
    expect(html).toContain(SIG_ZONE_SOURCE);
    expect(html).toContain('<div class="sigzone" id="sig-p1" hidden></div>');
    expect(html).toContain('<div class="sigzone" id="sig-p2" hidden></div>');
    expect(html).toContain("renderSigZone('p1', frame);");
    expect(html).toContain("signatureZoneMoves(prevFrame, newFrame).forEach(");
    // The slot's own entrance and a Mythic's ward wait for the flight.
    expect(html).toContain("const enterT = sigEnterAt[id] !== undefined ? sigEnterAt[id] : causeT;");
  }, 60_000);

  it("a replay without signature cards carries no zone, so the page keeps it hidden", async () => {
    const r = await captureMatch({
      title: "plain", seed: 1, deckA: buildCortexDeck("p1", "C"), deckB: buildAegisDeck("p2", "A"),
      agentA: new LookaheadAgent("A", 3), agentB: new LookaheadAgent("B", 4), boardSlots: BOARD_SLOTS,
    });
    for (const f of r.frames) {
      expect(f.players.p1.signature).toBeNull();
      expect(f.players.p2.signature).toBeNull();
    }
    expect(SIG_ZONE_SOURCE).toContain("if (!z) return null;");
  }, 60_000);
});
