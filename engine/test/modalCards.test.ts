// The generic "choose one" mechanic (owner 2026-10-16 amendment; built
// session 40) and its first users, the 3 Season 0 Zero-Day cards (owner
// 2026-10-18). A modal card offers each mode as its own legal move; the
// copy played carries the chosen mode's abilities and nothing of the other;
// the choice is logged; the card goes to the graveyard as printed.

import { describe, expect, it } from "vitest";
import { getLegalMoves, type Move } from "../src/engine/moves.js";
import { applyMove } from "../src/engine/engine.js";
import { runMatch } from "../src/engine/match.js";
import { Rng } from "../src/state/rng.js";
import { currentAttack, currentMaxHealth, effectiveCardCost } from "../src/state/queries.js";
import { buildPlayerView } from "../src/agents/agent.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { RandomAgent } from "../src/agents/randomAgent.js";
import { formatEvent } from "../src/log/format.js";
import { withMode, printedCard, playVariants, chosenModeOf } from "../src/cards/modes.js";
import { isRemovalOrDebuffCard, modalCardViolations, zeroDayCardViolations } from "../src/cards/poolLint.js";
import { patientZero, rootAccess, killSwitch, ZERO_DAY_CARDS } from "../src/data/zeroDayCards.js";
import { buildDeck, buildCortexDeck, buildSwarmDeck } from "../src/data/decks.js";
import { CORTEX_CARDS, SWARM_CARDS } from "../src/data/cards.js";
import { getCard } from "../src/data/registry.js";
import type { Card, CommandCard, DirectiveCard, ToolCard, UnitCard } from "../src/cards/types.js";
import type { GameState, PlayerId } from "../src/state/types.js";
import { emptyState, putUnit, drainStack } from "./helpers.js";
import { createInitialState } from "../src/state/init.js";

const vanilla: UnitCard = {
  id: "TEST-VAN",
  name: "Test Body",
  faction: "Cortex",
  rarity: "Common",
  cost: 1,
  type: "Unit",
  attack: 2,
  health: 2,
  keywords: [],
  art: "placeholder:test/body",
  flavor: "",
  abilities: [],
};

/** p1's main phase with `energy`, holding `hand`. */
function mainPhase(hand: Card[], energy = 10): GameState {
  const state = emptyState();
  state.turnNumber = 3;
  state.players.p1.hand = [...hand];
  state.players.p1.energy = energy;
  state.players.p1.maxEnergy = energy;
  return state;
}

function plays(state: GameState): Extract<Move, { type: "playCard" }>[] {
  return getLegalMoves(state).filter((m): m is Extract<Move, { type: "playCard" }> => m.type === "playCard");
}

function play(state: GameState, mode: string, rng = new Rng(1)): void {
  const move = plays(state).find((m) => m.mode === mode);
  expect(move, `a legal move for mode ${mode}`).toBeDefined();
  applyMove(state, move!, rng);
}

describe("modal cards: one legal move per mode", () => {
  it("a modal unit is offered once per mode, a plain card with no mode", () => {
    const state = mainPhase([patientZero, vanilla]);
    const moves = plays(state);
    expect(moves.filter((m) => m.handIndex === 0).map((m) => m.mode)).toEqual(["outbreak", "carrier"]);
    expect(moves.filter((m) => m.handIndex === 1)).toEqual([{ type: "playCard", handIndex: 1 }]);
  });

  it("a mode whose onPlay has no legal target offers nothing; the other mode stays playable", () => {
    const zap: CommandCard = {
      id: "TEST-ZAP",
      name: "Test Zap",
      faction: "Cortex",
      rarity: "Common",
      cost: 2,
      type: "Command",
      speed: "Sorcery",
      art: "placeholder:test/zap",
      flavor: "",
      abilities: [],
      modes: [
        {
          id: "shock",
          name: "Shock",
          text: "Deal 2 damage to an enemy unit.",
          abilities: [{ id: "zap-shock", trigger: "onPlay", text: "", targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } }, effects: [{ kind: "damage", amount: { mode: "flat", value: 2 } }] }],
        },
        { id: "think", name: "Think", text: "Draw a card.", abilities: [{ id: "zap-think", trigger: "onPlay", text: "", targeting: { scope: "none" }, effects: [{ kind: "drawCard", count: 1 }] }] },
      ],
    };
    const state = mainPhase([zap]);
    expect(plays(state).map((m) => m.mode)).toEqual(["think"]);
    const enemy = putUnit(state, "p2", vanilla);
    const moves = plays(state);
    expect(moves.map((m) => m.mode)).toEqual(["shock", "think"]);
    expect(moves[0]!.target).toEqual({ kind: "unit", instanceId: enemy.instanceId });
  });

  it("cost and timing are the printed card's: an unaffordable or off-timing modal card offers no mode", () => {
    expect(plays(mainPhase([killSwitch], 6))).toEqual([]);
    expect(plays(mainPhase([killSwitch], 7)).map((m) => m.mode)).toEqual(["lights-out", "wipe"]);
    const state = mainPhase([killSwitch], 7);
    state.priority = "p2";
    state.players.p2.hand = [killSwitch];
    state.players.p2.energy = 7;
    expect(plays(state)).toEqual([]); // Sorcery, not p2's turn
  });

  it("the engine refuses a modal play without a mode, and a mode on a plain card", () => {
    expect(() => applyMove(mainPhase([patientZero]), { type: "playCard", handIndex: 0 }, new Rng(1))).toThrow(/needs a mode/);
    expect(() => applyMove(mainPhase([vanilla]), { type: "playCard", handIndex: 0, mode: "outbreak" }, new Rng(1))).toThrow(/has no modes/);
    expect(() => applyMove(mainPhase([patientZero]), { type: "playCard", handIndex: 0, mode: "nope" }, new Rng(1))).toThrow(/no mode "nope"/);
  });
});

describe("modal cards: the copy in play carries the chosen mode only", () => {
  it("Patient Zero, Carrier: your other units get +1/+1, it doesn't, and it has no Outbreak", () => {
    const state = mainPhase([patientZero]);
    const ally = putUnit(state, "p1", vanilla);
    const enemy = putUnit(state, "p2", vanilla);
    play(state, "carrier");
    const pz = state.players.p1.board.find((u) => u.card.id === "S0-ZD1")!;
    expect(pz.card.chosenMode).toBe("carrier");
    expect(pz.card.abilities.map((a) => a.id)).toEqual(["patient-zero-carrier"]);
    expect([currentAttack(state, ally), currentMaxHealth(state, ally)]).toEqual([3, 3]);
    expect([currentAttack(state, pz), currentMaxHealth(state, pz)]).toEqual([2, 4]);
    expect([currentAttack(state, enemy), currentMaxHealth(state, enemy)]).toEqual([2, 2]);
    // Dies: no Outbreak, the enemy is untouched; the graveyard gets the printed card.
    pz.damageTaken = 4;
    // Two passes on an empty stack end the turn, which clears the dead.
    applyMove(state, { type: "passPriority" }, new Rng(1));
    applyMove(state, { type: "passPriority" }, new Rng(1));
    expect(state.players.p1.board.some((u) => u.card.id === "S0-ZD1")).toBe(false);
    expect(enemy.damageTaken).toBe(0);
    expect(state.players.p1.graveyard).toContainEqual(patientZero);
    expect(state.players.p1.graveyard.some((c) => c.chosenMode !== undefined)).toBe(false);
  });

  it("Patient Zero, Outbreak: no aura; when it dies, 2 damage to every enemy unit", () => {
    const state = mainPhase([patientZero, vanilla]);
    const enemies = [putUnit(state, "p2", vanilla), putUnit(state, "p2", { ...vanilla, health: 5 })];
    play(state, "outbreak");
    applyMove(state, { type: "playCard", handIndex: 0 }, new Rng(1));
    const ally = state.players.p1.board.find((u) => u.card.id === "TEST-VAN")!;
    expect(currentAttack(state, ally)).toBe(2);
    const pz = state.players.p1.board.find((u) => u.card.id === "S0-ZD1")!;
    pz.damageTaken = 4;
    applyMove(state, { type: "passPriority" }, new Rng(1));
    applyMove(state, { type: "passPriority" }, new Rng(1));
    expect(state.players.p2.board.map((u) => u.card.health - u.damageTaken)).toEqual([3]); // the 2/2 died, the 2/5 is at 3
    expect(enemies[0]!.damageTaken).toBe(2);
    const trigger = state.log.find((e) => e.type === "abilityTrigger" && e.ability === "patient-zero-outbreak");
    expect(trigger).toBeDefined();
  });

  it("Root Access, Privilege Escalation: attack is 1 plus every other unit in play, live", () => {
    const state = mainPhase([rootAccess]);
    putUnit(state, "p1", vanilla);
    putUnit(state, "p2", vanilla);
    putUnit(state, "p2", vanilla);
    play(state, "privilege-escalation");
    const ra = state.players.p1.board.find((u) => u.card.id === "S0-ZD2")!;
    expect(currentAttack(state, ra)).toBe(4);
    state.players.p2.board.pop();
    expect(currentAttack(state, ra)).toBe(3);
    expect(currentMaxHealth(state, ra)).toBe(6);
  });

  it("Root Access, Lockout: enemy cards cost 1 more, yours don't, and attack stays printed", () => {
    const state = mainPhase([rootAccess]);
    putUnit(state, "p2", vanilla);
    play(state, "lockout");
    const ra = state.players.p1.board.find((u) => u.card.id === "S0-ZD2")!;
    expect(currentAttack(state, ra)).toBe(3);
    expect(effectiveCardCost(state, "p2", vanilla)).toBe(2);
    expect(effectiveCardCost(state, "p1", vanilla)).toBe(1);
  });

  it("Kill Switch, Wipe: 3 to every enemy unit and a card drawn; logged with its mode; printed to the graveyard", () => {
    const state = mainPhase([killSwitch]);
    state.players.p1.deck = [vanilla];
    const big = putUnit(state, "p2", { ...vanilla, health: 6 });
    putUnit(state, "p2", vanilla);
    const rng = new Rng(1);
    play(state, "wipe", rng);
    const cast = state.log.find((e) => e.type === "cast")!;
    expect(cast).toMatchObject({ card: "Kill Switch", mode: "wipe", modeName: "Wipe" });
    expect(formatEvent(cast)).toBe("p1 casts Kill Switch, choosing Wipe [Sorcery] (goes on the stack)");
    drainStack(state, rng);
    expect(state.log.find((e) => e.type === "stackResolve")).toMatchObject({ description: "Kill Switch (Wipe)" });
    expect(state.players.p2.board).toEqual([big]);
    expect(big.damageTaken).toBe(3);
    expect(state.players.p1.hand).toEqual([vanilla]);
    expect(state.players.p1.graveyard).toEqual([killSwitch]);
  });

  it("Kill Switch, Lights Out: every enemy unit stunned through two of its controller's turns, no damage, no draw", () => {
    const state = mainPhase([killSwitch]);
    state.players.p1.deck = [vanilla];
    const enemy = putUnit(state, "p2", vanilla);
    const rng = new Rng(1);
    play(state, "lights-out", rng);
    drainStack(state, rng);
    expect(enemy.statuses).toEqual([{ kind: "Stasis", duration: 2 }]);
    expect(enemy.damageTaken).toBe(0);
    expect(state.players.p1.hand).toEqual([]);
  });
});

describe("modal cards: the log and every kind of play", () => {
  it("a unit's play event names the mode, and the formatted line says it", () => {
    const state = mainPhase([patientZero]);
    play(state, "carrier");
    const ev = state.log.find((e) => e.type === "play")!;
    expect(ev).toMatchObject({ card: "Patient Zero", mode: "carrier", modeName: "Carrier" });
    expect(formatEvent(ev)).toMatch(/^p1 plays Patient Zero, choosing Carrier \(u\d+\)$/);
  });

  it("a plain card's events carry no mode fields at all", () => {
    const state = mainPhase([vanilla]);
    applyMove(state, { type: "playCard", handIndex: 0 }, new Rng(1));
    const ev = state.log.find((e) => e.type === "play")!;
    expect("mode" in ev || "modeName" in ev).toBe(false);
  });

  it("a modal evolution crosses each base with each mode, and the evolve event names the mode", () => {
    const base: UnitCard = { ...vanilla, id: "TEST-BASE", name: "Test Base" };
    const evo: UnitCard = {
      ...vanilla,
      id: "TEST-EVO",
      name: "Test Evolved",
      cost: 2,
      attack: 3,
      health: 3,
      evolvesFrom: "TEST-BASE",
      modes: [
        { id: "hard", name: "Hardened", text: "", abilities: [{ id: "evo-hard", trigger: "static", text: "", staticEffect: { kind: "buffAllies", attack: 0, health: 1, filter: { side: "controller", kind: "unit" } } }] },
        { id: "sharp", name: "Sharpened", text: "", abilities: [{ id: "evo-sharp", trigger: "static", text: "", staticEffect: { kind: "buffAllies", attack: 1, health: 0, filter: { side: "controller", kind: "unit" } } }] },
      ],
    };
    const state = mainPhase([evo]);
    const b1 = putUnit(state, "p1", base);
    b1.enteredTurn = 1;
    const b2 = putUnit(state, "p1", base);
    b2.enteredTurn = 1;
    const moves = plays(state);
    expect(moves.map((m) => [m.target, m.mode])).toEqual([
      [{ kind: "unit", instanceId: b1.instanceId }, "hard"],
      [{ kind: "unit", instanceId: b2.instanceId }, "hard"],
      [{ kind: "unit", instanceId: b1.instanceId }, "sharp"],
      [{ kind: "unit", instanceId: b2.instanceId }, "sharp"],
    ]);
    applyMove(state, moves[2]!, new Rng(1));
    expect(state.log.at(-1)).toMatchObject({ type: "evolve", from: "Test Base", to: "Test Evolved", mode: "sharp", modeName: "Sharpened" });
    expect(currentAttack(state, b2)).toBe(3); // b1's Sharpened aura reaches b2
    expect(currentAttack(state, b1)).toBe(4);
    expect(formatEvent(state.log.at(-1)!)).toBe("  Test Base evolves into Test Evolved, choosing Sharpened");
  });

  it("a modal Directive keeps its mode's static while it stays in play", () => {
    const tax: DirectiveCard = {
      id: "TEST-DIR",
      name: "Test Policy",
      faction: "Aegis",
      rarity: "Rare",
      cost: 3,
      type: "Directive",
      art: "placeholder:test/policy",
      flavor: "",
      abilities: [],
      modes: [
        { id: "tax", name: "Tax", text: "", abilities: [{ id: "dir-tax", trigger: "static", text: "", staticEffect: { kind: "cardCostModifier", side: "opponent", amount: 1 } }] },
        { id: "rebate", name: "Rebate", text: "", abilities: [{ id: "dir-rebate", trigger: "static", text: "", staticEffect: { kind: "cardCostModifier", side: "controller", amount: -1 } }] },
      ],
    };
    const state = mainPhase([tax, vanilla]);
    play(state, "rebate");
    expect(state.players.p1.directives[0]!.card.chosenMode).toBe("rebate");
    expect(effectiveCardCost(state, "p1", vanilla)).toBe(0);
    expect(effectiveCardCost(state, "p2", vanilla)).toBe(1);
  });
});

describe("modes.ts helpers", () => {
  it("withMode then printedCard gives back the printed card; playVariants is one per mode", () => {
    for (const card of ZERO_DAY_CARDS) {
      for (const { card: played, mode } of playVariants(card)) {
        expect(chosenModeOf(played)).toBe(mode);
        expect(printedCard(played)).toEqual(card);
      }
    }
    expect(playVariants(vanilla)).toEqual([{ card: vanilla }]);
    expect(() => withMode(withMode(patientZero, "carrier"), "outbreak")).toThrow(/already played/);
  });
});

describe("modal and Zero-Day lint", () => {
  it("the 3 Zero-Day cards pass their own rules", () => {
    expect(ZERO_DAY_CARDS.flatMap(zeroDayCardViolations)).toEqual([]);
    expect(ZERO_DAY_CARDS.map((c) => c.id)).toEqual(["S0-ZD1", "S0-ZD2", "S0-ZD3"]);
  });

  it("refuses one mode, shared ids or names, an empty mode, a modal Tool, two onPlays, a printed chosen mode", () => {
    const one = { ...patientZero, modes: [patientZero.modes![0]!] };
    expect(modalCardViolations(one).join()).toMatch(/at least two modes/);
    const dupId = { ...patientZero, modes: [patientZero.modes![0]!, { ...patientZero.modes![1]!, id: "outbreak" }] };
    expect(modalCardViolations(dupId).join()).toMatch(/share an id/);
    const dupAbility = { ...patientZero, modes: [patientZero.modes![0]!, { ...patientZero.modes![1]!, abilities: patientZero.modes![0]!.abilities }] };
    expect(modalCardViolations(dupAbility).join()).toMatch(/ability id repeats/);
    const empty = { ...patientZero, modes: [patientZero.modes![0]!, { ...patientZero.modes![1]!, abilities: [] }] };
    expect(modalCardViolations(empty).join()).toMatch(/has no abilities/);
    const tool: ToolCard = { id: "T", name: "T", faction: "Cortex", rarity: "Common", cost: 1, type: "Tool", attackBonus: 1, healthBonus: 0, grantedKeywords: [], art: "", flavor: "", abilities: [], modes: patientZero.modes };
    expect(modalCardViolations(tool).join()).toMatch(/Tool can't be modal/);
    const twoOnPlay = { ...killSwitch, abilities: [{ ...killSwitch.modes![1]!.abilities[0]!, id: "printed-onplay" }] };
    expect(modalCardViolations(twoOnPlay).join()).toMatch(/two onPlay abilities/);
    expect(modalCardViolations(withMode(patientZero, "carrier")).join()).toMatch(/no chosen mode/);
    expect(zeroDayCardViolations({ ...vanilla, modes: patientZero.modes }).join()).toMatch(/not marked as a Zero-Day card/);
  });

  it("a deck may run each Zero-Day card once, and only the real Zero-Day objects", () => {
    const pool = [...CORTEX_CARDS.slice(0, -1), { card: patientZero, copies: 1 }];
    expect(buildDeck("p1", "ZD", pool).cards.filter((c) => c === patientZero)).toHaveLength(1);
    expect(() => buildDeck("p1", "ZD", [...CORTEX_CARDS, { card: patientZero, copies: 2 }])).toThrow(/copies of "Patient Zero"/);
    expect(() => buildDeck("p1", "ZD", [...CORTEX_CARDS, { card: { ...patientZero }, copies: 1 }])).toThrow(/is not a Zero-Day card/);
  });

  it("a signature card can't be modal (playSignature names no mode)", () => {
    expect(() =>
      createInitialState({ id: "p1", name: "A", cards: [], signature: patientZero }, { id: "p2", name: "B", cards: [] }, new Rng(1)),
    ).toThrow(/can't be modal/);
  });

  it("is not live: the card registry doesn't hold them, so the economy keeps its reserved entries", () => {
    for (const card of ZERO_DAY_CARDS) expect(getCard(card.id)).toBeUndefined();
  });
});

describe("agents and real matches", () => {
  /** p1's main phase from `self`'s point of view, Patient Zero in hand. */
  function lookaheadPick(setup: (s: GameState) => void): string | undefined {
    const state = mainPhase([patientZero], 3);
    setup(state);
    const moves = getLegalMoves(state).filter((m) => m.type === "playCard" || m.type === "passPriority");
    const pick = new LookaheadAgent("L", 1).decideMove(buildPlayerView(state, "p1"), moves);
    return pick.type === "playCard" ? pick.mode : undefined;
  }

  it("Lookahead reads the board: Carrier beside a wide own board, Outbreak into a wide enemy board", () => {
    expect(lookaheadPick((s) => [1, 2, 3].forEach(() => putUnit(s, "p1", vanilla)))).toBe("carrier");
    expect(lookaheadPick((s) => [1, 2, 3].forEach(() => putUnit(s, "p2", vanilla)))).toBe("outbreak");
  });

  it("real matches with the Zero-Day cards in decks: both modes of every card get played, nothing breaks", async () => {
    const withZeroDays = (base: { card: Card; copies: number }[]) => {
      // Make room: drop three copies of removal cards, so the deck stays
      // under the 25% removal share with two Zero-Day answers added.
      const pool = base.map((p) => ({ ...p }));
      let cut = 0;
      for (const removalFirst of [true, false]) {
        for (const p of pool) if (cut < 3 && (!removalFirst || isRemovalOrDebuffCard(p.card)) && p.copies > 1) (p.copies -= 1), cut++;
      }
      return [...pool, ...ZERO_DAY_CARDS.map((card) => ({ card, copies: 1 }))];
    };
    const seen = new Map<string, number>();
    for (let seed = 1; seed <= 40; seed++) {
      const result = await runMatch(
        buildDeck("p1", "Cortex+ZD", withZeroDays(CORTEX_CARDS)),
        buildDeck("p2", "Swarm+ZD", withZeroDays(SWARM_CARDS)),
        new LookaheadAgent("A", seed),
        new RandomAgent("B", seed + 1000),
        seed,
      );
      expect(result.state.winner).toBeDefined();
      for (const e of result.state.log) {
        if ((e.type === "play" || e.type === "cast") && e.mode) seen.set(`${e.card}/${e.modeName}`, (seen.get(`${e.card}/${e.modeName}`) ?? 0) + 1);
      }
    }
    const names = ZERO_DAY_CARDS.flatMap((c) => c.modes!.map((m) => `${c.name}/${m.name}`));
    for (const n of names) expect(seen.get(n) ?? 0, n).toBeGreaterThan(0);
  });

  it("the shipped decks are untouched: no deck carries a modal card yet", () => {
    for (const build of [buildCortexDeck, buildSwarmDeck]) {
      expect(build("p1" as PlayerId, "x").cards.some((c) => c.modes)).toBe(false);
    }
  });
});
