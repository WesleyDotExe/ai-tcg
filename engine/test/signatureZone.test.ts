// The signature zone (owner 2026-10-05, "the unique Mythic"; ECONOMY.md
// "Unique Mythic (signature card)"; built session 31). One Unit per player
// that takes no deck slot: it starts in its own zone, is never drawn,
// discarded or shuffled, is playable at Sorcery timing whenever its
// controller can afford it, and when it dies it goes back to the zone and
// costs 2 more each time it is played again that match.

import { describe, expect, it } from "vitest";
import { createInitialState, SIGNATURE_REPLAY_SURCHARGE, type DeckSpec } from "../src/state/init.js";
import { getLegalMoves, type Move } from "../src/engine/moves.js";
import { applyMove } from "../src/engine/engine.js";
import { runMatch } from "../src/engine/match.js";
import { Rng } from "../src/state/rng.js";
import { processDeaths } from "../src/effects/resolver.js";
import { signatureCost } from "../src/state/queries.js";
import { buildPlayerView } from "../src/agents/agent.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { AggressiveAgent } from "../src/agents/aggressiveAgent.js";
import { buildAegisDeck, buildCortexDeck, buildNullDeck, buildSwarmDeck, withSetMythicSignature } from "../src/data/decks.js";
import { quorumArbiter, diagnosticPulse, signalDrone } from "../src/data/cards.js";
import { formatEvent } from "../src/log/format.js";
import type { ToolCard, UnitCard } from "../src/cards/types.js";
import type { GameState } from "../src/state/types.js";
import { emptyState, putUnit } from "./helpers.js";
import { BOARD_SLOTS } from "../src/state/init.js";

/** A plain test signature: 4 cost, 3/5, no abilities. */
const testSignature: UnitCard = {
  id: "TEST-SIG",
  name: "Test Signature",
  faction: "Neutral",
  rarity: "Mythic",
  cost: 4,
  type: "Unit",
  attack: 3,
  health: 5,
  keywords: [],
  art: "placeholder:test/signature",
  flavor: "",
  abilities: [],
};

/** A signature whose onPlay needs a chosen enemy unit. */
const targetingSignature: UnitCard = {
  ...testSignature,
  id: "TEST-SIG-T",
  name: "Targeting Signature",
  abilities: [
    {
      id: "test-sig-t-play",
      trigger: "onPlay",
      text: "Deal 2 damage to target enemy unit.",
      targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
      effects: [{ kind: "damage", amount: { mode: "flat", value: 2 } }],
    },
  ],
};

/** An evolution that names the test signature as its base. */
const evolvesFromSignature: UnitCard = { ...testSignature, id: "TEST-EVO", name: "Test Evolution", rarity: "Rare", cost: 1, evolvesFrom: "TEST-SIG" };

const testTool: ToolCard = {
  id: "TEST-TOOL",
  name: "Test Tool",
  faction: "Neutral",
  rarity: "Common",
  cost: 1,
  type: "Tool",
  attackBonus: 1,
  healthBonus: 0,
  grantedKeywords: [],
  keywords: [],
  art: "placeholder:test/tool",
  flavor: "",
  abilities: [],
};

/** A main-phase state for p1 with `energy`, holding `signature`. */
function stateWith(signature: UnitCard, energy: number): GameState {
  const rng = new Rng(7);
  const state = createInitialState(
    { id: "p1", name: "P1", cards: [], signature },
    { id: "p2", name: "P2", cards: [] },
    rng,
  );
  state.turnNumber = 3;
  state.players.p1.energy = energy;
  state.players.p1.maxEnergy = energy;
  return state;
}

const signatureMoves = (state: GameState) => getLegalMoves(state).filter((m): m is Extract<Move, { type: "playSignature" }> => m.type === "playSignature");

describe("the signature zone", () => {
  it("starts the match in its own zone: never in the deck or the hand, and takes no deck slot", () => {
    const deck = Array.from({ length: 20 }, () => signalDrone);
    const state = createInitialState(
      { id: "p1", name: "P1", cards: deck, signature: testSignature },
      { id: "p2", name: "P2", cards: deck },
      new Rng(1),
    );
    const p1 = state.players.p1;
    expect(p1.signature).toEqual({ card: testSignature, timesPlayed: 0, inZone: true });
    expect(p1.hand.length + p1.deck.length).toBe(20);
    expect([...p1.hand, ...p1.deck].includes(testSignature)).toBe(false);
    expect(state.players.p2.signature).toBeNull();
    // Public, like the board: the opponent's view shows it.
    expect(buildPlayerView(state, "p2").opponent.signature).toEqual(p1.signature);
  });

  it("refuses a signature card that isn't a plain Unit", () => {
    const deck: DeckSpec = { id: "p2", name: "P2", cards: [] };
    expect(() =>
      createInitialState({ id: "p1", name: "P1", cards: [], signature: diagnosticPulse as unknown as UnitCard }, deck, new Rng(1)),
    ).toThrow(/must be a Unit/);
    expect(() => createInitialState({ id: "p1", name: "P1", cards: [], signature: evolvesFromSignature }, deck, new Rng(1))).toThrow(
      /can't be an evolution/,
    );
  });

  it("is playable at Sorcery timing when affordable, and only then", () => {
    expect(signatureMoves(stateWith(testSignature, 3))).toEqual([]); // can't afford 4
    const state = stateWith(testSignature, 4);
    expect(signatureMoves(state)).toEqual([{ type: "playSignature" }]);

    // Not while something is on the stack, and never for the opponent in a priority window.
    state.players.p1.hand.push(diagnosticPulse);
    state.players.p1.energy = 10;
    putUnit(state, "p2", signalDrone);
    const rng = new Rng(1);
    applyMove(state, getLegalMoves(state).find((m) => m.type === "playCard")!, rng);
    expect(state.stack).toHaveLength(1);
    expect(signatureMoves(state)).toEqual([]);
    applyMove(state, { type: "passPriority" }, rng);
    expect(state.priority).toBe("p2");
    state.players.p2.signature = { card: testSignature, timesPlayed: 0, inZone: true };
    state.players.p2.energy = 10;
    expect(signatureMoves(state)).toEqual([]);
  });

  it("needs a free board slot", () => {
    const state = stateWith(testSignature, 10);
    for (let i = 0; i < BOARD_SLOTS; i++) putUnit(state, "p1", signalDrone);
    expect(signatureMoves(state)).toEqual([]);
    state.players.p1.board.pop();
    expect(signatureMoves(state)).toHaveLength(1);
  });

  it("offers one move per legal target for a chosen-target onPlay, and none with no target", () => {
    const state = stateWith(targetingSignature, 10);
    expect(signatureMoves(state)).toEqual([]);
    const a = putUnit(state, "p2", signalDrone);
    const b = putUnit(state, "p2", signalDrone);
    expect(signatureMoves(state)).toEqual([
      { type: "playSignature", target: { kind: "unit", instanceId: a.instanceId } },
      { type: "playSignature", target: { kind: "unit", instanceId: b.instanceId } },
    ]);
    applyMove(state, signatureMoves(state)[1]!, new Rng(1));
    expect(b.damageTaken).toBe(2);
    expect(a.damageTaken).toBe(0);
  });

  it("plays out of the zone at its cost, marked as the signature unit, and can't be played twice at once", () => {
    const state = stateWith(testSignature, 10);
    applyMove(state, { type: "playSignature" }, new Rng(1));
    const p1 = state.players.p1;
    expect(p1.energy).toBe(6);
    expect(p1.signature).toMatchObject({ timesPlayed: 1, inZone: false });
    expect(p1.board).toHaveLength(1);
    expect(p1.board[0]).toMatchObject({ card: testSignature, signature: true });
    expect(signatureMoves(state)).toEqual([]);
    const play = state.log.find((e) => e.type === "play")!;
    expect(play).toEqual({ type: "play", player: "p1", card: "Test Signature", instanceId: p1.board[0]!.instanceId, fromSignatureZone: true, cost: 4 });
    expect(formatEvent(play)).toBe(`p1 plays Test Signature from the signature zone for 4 energy (${p1.board[0]!.instanceId})`);
  });

  it("goes back to the zone when it dies, never the graveyard, and costs 2 more each replay", () => {
    const state = stateWith(testSignature, 10);
    const rng = new Rng(1);
    const p1 = state.players.p1;
    const costs: number[] = [];
    for (let play = 0; play < 3; play++) {
      p1.energy = 10;
      costs.push(signatureCost(state, "p1")!);
      applyMove(state, { type: "playSignature" }, rng);
      const unit = p1.board.find((u) => u.signature)!;
      if (play === 1) unit.tools.push(testTool);
      unit.damageTaken = 99;
      processDeaths(state, rng);
      expect(p1.board).toHaveLength(0);
      expect(p1.signature).toMatchObject({ timesPlayed: play + 1, inZone: true });
    }
    expect(costs).toEqual([4, 4 + SIGNATURE_REPLAY_SURCHARGE, 4 + 2 * SIGNATURE_REPLAY_SURCHARGE]);
    // The card itself never reaches the graveyard; the Tool on it did.
    expect(p1.graveyard).toEqual([testTool]);
    const returns = state.log.filter((e) => e.type === "signatureReturn");
    expect(returns.map((e) => e.nextCost)).toEqual([6, 8, 10]);
    expect(formatEvent(returns[0]!)).toBe("  Test Signature returns to p1's signature zone (next play costs 6)");
    // Each return follows its own death event.
    const deathIdx = state.log.findIndex((e) => e.type === "death");
    expect(state.log[deathIdx + 1]?.type).toBe("signatureReturn");
  });

  it("is never an evolution base", () => {
    const state = stateWith(testSignature, 10);
    applyMove(state, { type: "playSignature" }, new Rng(1));
    state.turnNumber += 2; // it has lived through a turn boundary
    state.players.p1.hand.push(evolvesFromSignature);
    expect(getLegalMoves(state).some((m) => m.type === "playCard")).toBe(false);
    // A plain copy of the same card on the board can still evolve.
    const plain = putUnit(state, "p1", testSignature);
    plain.enteredTurn = 0;
    expect(getLegalMoves(state).filter((m) => m.type === "playCard")).toEqual([
      { type: "playCard", handIndex: 0, target: { kind: "unit", instanceId: plain.instanceId } },
    ]);
  });

  it("leaves a deck without a signature card exactly as before", () => {
    const state = emptyState();
    expect(state.players.p1.signature).toBeNull();
    state.turnNumber = 3;
    state.players.p1.energy = 10;
    expect(signatureMoves(state)).toEqual([]);
  });
});

describe("withSetMythicSignature (the ring's stand-in)", () => {
  it("moves each faction's one set Mythic out of the deck into the signature zone", () => {
    for (const build of [buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck]) {
      const full = build("p1", "deck");
      const sig = withSetMythicSignature(full);
      expect(sig.cards).toHaveLength(full.cards.length - 1);
      expect(sig.signature?.rarity).toBe("Mythic");
      expect(sig.cards.some((c) => c.rarity === "Mythic")).toBe(false);
    }
    expect(withSetMythicSignature(buildCortexDeck("p1", "d")).signature).toBe(quorumArbiter);
  });

  it("refuses a deck with no Mythic", () => {
    expect(() => withSetMythicSignature({ id: "p1", name: "plain", cards: [signalDrone] })).toThrow(/exactly one Mythic/);
  });
});

describe("the agents use the zone in real matches", () => {
  const sigDeck = (build: typeof buildCortexDeck, id: "p1" | "p2") => withSetMythicSignature(build(id, "deck"));

  it("Lookahead plays its signature card, replays it at the surcharge, and the card never leaves its zone or the board", async () => {
    let plays = 0;
    let replays = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { state } = await runMatch(
        sigDeck(buildCortexDeck, "p1"),
        sigDeck(buildSwarmDeck, "p2"),
        new LookaheadAgent("a", seed),
        new LookaheadAgent("b", seed + 1000),
        seed,
      );
      for (const pid of ["p1", "p2"] as const) {
        const p = state.players[pid];
        const card = p.signature!.card;
        // Conservation: the card is never in the hand, deck or graveyard.
        expect([...p.hand, ...p.deck, ...p.graveyard].includes(card)).toBe(false);
        const onBoard = p.board.filter((u) => u.signature).length;
        expect(onBoard).toBe(p.signature!.inZone ? 0 : 1);
        const sigPlays = state.log.filter((e) => e.type === "play" && e.player === pid && e.fromSignatureZone);
        expect(sigPlays).toHaveLength(p.signature!.timesPlayed);
        sigPlays.forEach((e, i) => expect(e.type === "play" && e.cost).toBe(card.cost + SIGNATURE_REPLAY_SURCHARGE * i));
        plays += sigPlays.length;
        replays += Math.max(0, sigPlays.length - 1);
      }
    }
    expect(plays).toBeGreaterThan(40);
    expect(replays).toBeGreaterThan(0);
  });

  it("Aggressive plays it too", async () => {
    const { state } = await runMatch(
      sigDeck(buildAegisDeck, "p1"),
      sigDeck(buildNullDeck, "p2"),
      new AggressiveAgent("a"),
      new AggressiveAgent("b"),
      3,
    );
    expect(state.log.some((e) => e.type === "play" && e.fromSignatureZone)).toBe(true);
  });
});
