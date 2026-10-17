// Session 41 (owner 2026-10-18, "fix the reference agent first: value auras
// over several turns and stuns by how long they last, for every card, not
// only modal ones"). Each test pins one valuation LookaheadAgent got wrong
// before, on real engine-produced moves and views.

import { describe, expect, it } from "vitest";
import { getLegalMoves, type Move } from "../src/engine/moves.js";
import { buildPlayerView } from "../src/agents/agent.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { killSwitch, patientZero } from "../src/data/zeroDayCards.js";
import type { Ability, Card, CommandCard, UnitCard } from "../src/cards/types.js";
import type { GameState } from "../src/state/types.js";
import { emptyState, putUnit } from "./helpers.js";

const unit = (id: string, attack: number, health: number, abilities: Ability[] = [], cost = 3): UnitCard => ({
  id,
  name: id,
  faction: "Cortex",
  rarity: "Common",
  cost,
  type: "Unit",
  attack,
  health,
  keywords: [],
  art: "placeholder:test/body",
  flavor: "",
  abilities,
});

const command = (id: string, ability: Ability, cost = 2): CommandCard => ({
  id,
  name: id,
  faction: "Cortex",
  rarity: "Common",
  cost,
  type: "Command",
  speed: "Sorcery",
  art: "placeholder:test/command",
  flavor: "",
  abilities: [ability],
});

const stun = (turns: number): CommandCard =>
  command(`TEST-STUN-${turns}`, {
    id: `test-stun-${turns}`,
    trigger: "onPlay",
    text: `Stun an enemy unit for ${turns} turns.`,
    targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } },
    effects: [{ kind: "applyStatus", status: "Stasis", duration: turns }],
  });

const shield = command("TEST-SHIELD", {
  id: "test-shield",
  trigger: "onPlay",
  text: "Your unit gains Barrier.",
  targeting: { scope: "chosen", filter: { side: "controller", kind: "unit" } },
  effects: [{ kind: "applyStatus", status: "Barrier", duration: "untilConsumed" }],
}, 1);

/** p1's main phase on turn 3 with `hand` and full energy. */
function mainPhase(hand: Card[], energy = 10): GameState {
  const state = emptyState();
  state.turnNumber = 3;
  state.players.p1.hand = [...hand];
  state.players.p1.energy = energy;
  state.players.p1.maxEnergy = energy;
  return state;
}

/** Lookahead's pick among the card plays and passing (attacks left out, so
 * only the valuation under test decides). The agent breaks exact ties at
 * random, so the pick must be the same for 8 agent seeds: a tie (the old
 * agent's answer to most of these) can't pass by luck. */
function pick(state: GameState): Move {
  const moves = getLegalMoves(state).filter((m) => m.type === "playCard" || m.type === "passPriority");
  const picks = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => new LookaheadAgent("L", seed).decideMove(buildPlayerView(state, "p1"), moves));
  for (const p of picks) expect(p, "the same pick for every agent seed").toEqual(picks[0]);
  return picks[0]!;
}

const pickedCard = (state: GameState, move: Move) => (move.type === "playCard" ? state.players.p1.hand[move.handIndex]!.name : "pass");

describe("a plain unit's own abilities count (one path for plain and modal)", () => {
  it("an aura unit beats the same body without one beside a board of allies", () => {
    const aura = unit("TEST-AURA", 3, 3, [
      { id: "test-aura", trigger: "static", text: "Your units get +1/+0.", staticEffect: { kind: "buffAllies", attack: 1, health: 0, filter: { side: "controller", kind: "unit" } } },
    ]);
    const state = mainPhase([unit("TEST-PLAIN", 3, 3), aura]);
    for (let i = 0; i < 3; i++) putUnit(state, "p1", unit("TEST-ALLY", 1, 1));
    expect(pickedCard(state, pick(state))).toBe("TEST-AURA");
  });

  it("a death trigger is worth something: the same body with 'when this dies, draw a card' is preferred", () => {
    const state = mainPhase([
      unit("TEST-PLAIN", 2, 2),
      unit("TEST-LASTWORD", 2, 2, [{ id: "test-lastword", trigger: "onDeath", text: "When this dies, draw a card.", effects: [{ kind: "drawCard", count: 1 }] }]),
    ]);
    expect(pickedCard(state, pick(state))).toBe("TEST-LASTWORD");
  });

  it("a stat that scales with your units counts the unit being played, less its printed stat", () => {
    // Attack = your units in play. With two allies the played copy will be
    // a 3/3 once it lands, so it beats a vanilla 2/3 of the same cost and
    // loses to a vanilla 4/3.
    const scaler = unit("TEST-SCALER", 0, 3, [
      { id: "test-scaler", trigger: "static", text: "Attack equals your units in play.", staticEffect: { kind: "selfStatFromScaling", attack: { mode: "scaling", base: 0, multiplier: 1, per: "controllerUnitsInPlay" } } },
    ]);
    const smaller = mainPhase([unit("TEST-2-3", 2, 3), scaler]);
    const bigger = mainPhase([unit("TEST-4-3", 4, 3), scaler]);
    for (const s of [smaller, bigger]) for (let i = 0; i < 2; i++) putUnit(s, "p1", unit("TEST-ALLY", 1, 1));
    expect(pickedCard(smaller, pick(smaller))).toBe("TEST-SCALER");
    expect(pickedCard(bigger, pick(bigger))).toBe("TEST-4-3");
  });
});

describe("statuses by kind and duration", () => {
  it("a 2-turn stun is worth more than a 1-turn stun of the same unit", () => {
    const state = mainPhase([stun(1), stun(2)]);
    putUnit(state, "p2", unit("TEST-THREAT", 5, 5));
    expect(pickedCard(state, pick(state))).toBe("TEST-STUN-2");
  });

  it("stunning a unit already held for as long is worth nothing, so the agent keeps the card", () => {
    const state = mainPhase([stun(2)]);
    const held = putUnit(state, "p2", unit("TEST-THREAT", 5, 5));
    held.statuses.push({ kind: "Stasis", duration: 2 });
    expect(pick(state).type).toBe("passPriority");
  });

  it("a Barrier on your own unit is a gain, not a loss (it scored below passing before), and goes where there is none", () => {
    const state = mainPhase([shield]);
    const covered = putUnit(state, "p1", unit("TEST-COVERED", 4, 4));
    covered.statuses.push({ kind: "Barrier", duration: "untilConsumed" });
    const bare = putUnit(state, "p1", unit("TEST-BARE", 4, 4));
    const move = pick(state);
    expect(move.type).toBe("playCard");
    expect(move.type === "playCard" && move.target).toEqual({ kind: "unit", instanceId: bare.instanceId });
  });
});

describe("the Zero-Day mode choices the session-40 agent misread", () => {
  it("Kill Switch: Lights Out into big bodies Wipe can't kill, Wipe into small ones it can", () => {
    const big = mainPhase([killSwitch]);
    for (let i = 0; i < 3; i++) putUnit(big, "p2", unit("TEST-BIG", 5, 7));
    const small = mainPhase([killSwitch]);
    for (let i = 0; i < 3; i++) putUnit(small, "p2", unit("TEST-SMALL", 2, 3));
    const modeOf = (m: Move) => (m.type === "playCard" ? m.mode : undefined);
    expect(modeOf(pick(big))).toBe("lights-out");
    expect(modeOf(pick(small))).toBe("wipe");
  });

  it("Patient Zero: Carrier beside two allies and an empty enemy board", () => {
    const state = mainPhase([patientZero], 3);
    for (let i = 0; i < 2; i++) putUnit(state, "p1", unit("TEST-ALLY", 2, 2));
    const move = pick(state);
    expect(move.type === "playCard" && move.mode).toBe("carrier");
  });
});
