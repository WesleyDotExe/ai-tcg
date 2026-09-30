// Phase 5 step (ii): the neutral pool (owner-feedback 2026-09-20 item 10).
// Three layers, each tested: the "utility, not identity" lint on neutral
// cards; the hybrid-deck rules in buildDeck; and the cards' own mechanisms.
// Plus the LookaheadAgent fixes this slice needed (heal and energy valued
// only up to what the resolver can deliver).

import { test, expect } from "vitest";
import { applyMove, beginTurn } from "../src/engine/engine.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { processDeaths } from "../src/effects/resolver.js";
import { Rng } from "../src/state/rng.js";
import { neutralCardViolations } from "../src/cards/poolLint.js";
import type { Card, CommandCard, UnitCard } from "../src/cards/types.js";
import {
  NEUTRAL_POOL,
  burstCredit,
  powerReserve,
  uplinkTower,
  scrapRecycler,
  rollbackPoint,
  relayCourier,
  spareCycles,
} from "../src/data/neutralCards.js";
import { buildDeck, deckFaction, MAX_NEUTRAL_COPIES, buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../src/data/decks.js";
import { CORTEX_CARDS, SWARM_CARDS, cortexEngineer, signalDrone } from "../src/data/cards.js";
import { NULL_CARDS, glitchSeed } from "../src/data/nullCards.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { buildPlayerView } from "../src/agents/agent.js";
import { emptyState, putUnit } from "./helpers.js";

test("the neutral pool: 10 unique cards, every one passes the utility-not-identity lint", () => {
  expect(NEUTRAL_POOL).toHaveLength(10);
  expect(new Set(NEUTRAL_POOL.map((c) => c.id)).size).toBe(10);
  expect(new Set(NEUTRAL_POOL.map((c) => c.art)).size, "every card has its own art slot").toBe(10);
  for (const card of NEUTRAL_POOL) {
    expect(card.faction).toBe("Neutral");
    expect(neutralCardViolations(card), card.name).toEqual([]);
  }
});

test("variation rule: no two neutral cards are identical apart from name, art and flavour", () => {
  const shape = (c: Card) => JSON.stringify({ ...c, id: 0, name: 0, art: 0, flavor: 0, abilities: c.abilities.map((a) => ({ ...a, id: 0, text: 0 })) });
  expect(new Set(NEUTRAL_POOL.map(shape)).size).toBe(NEUTRAL_POOL.length);
});

test("the neutral lint refuses faction identity: removal, Mythic, signature keywords, summons, statics", () => {
  const base: UnitCard = { ...relayCourier, id: "NT-X", name: "Probe", abilities: [] };
  expect(neutralCardViolations(base)).toEqual([]);
  expect(neutralCardViolations({ ...base, rarity: "Mythic" })[0]).toMatch(/Mythic/);
  expect(neutralCardViolations({ ...base, keywords: ["Guard"] })[0]).toMatch(/Guard/);
  expect(neutralCardViolations({ ...base, evolvesFrom: "NT-003" })[0]).toMatch(/evolution/);
  const ping: UnitCard = {
    ...base,
    abilities: [{ id: "p", trigger: "onPlay", text: "", targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit" } }, effects: [{ kind: "damage", amount: { mode: "flat", value: 1 } }] }],
  };
  expect(neutralCardViolations(ping).join()).toMatch(/removal/);
  const summoner: UnitCard = {
    ...base,
    abilities: [{ id: "s", trigger: "onPlay", text: "", effects: [{ kind: "summon", count: 1, token: { name: "T", faction: "Neutral", attack: 1, health: 1, keywords: [], art: "", flavor: "" } }] }],
  };
  expect(neutralCardViolations(summoner).join()).toMatch(/summon/);
  const aura: UnitCard = {
    ...base,
    abilities: [{ id: "a", trigger: "static", text: "", staticEffect: { kind: "buffAllies", attack: 1, health: 0, filter: { side: "controller", kind: "unit" } } }],
  };
  expect(neutralCardViolations(aura).join()).toMatch(/static/);
  expect(neutralCardViolations(signalDrone)[0]).toMatch(/not a Neutral card/);
});

test("hybrid decks: one faction plus neutral cards, capped at MAX_NEUTRAL_COPIES", () => {
  const cortexMinus = (n: number) => {
    // Take n copies off Cortex's list (from the most-copied cards) to make room.
    const pool = CORTEX_CARDS.map((p) => ({ ...p }));
    let left = n;
    for (const p of pool) while (left > 0 && p.copies > 1) (p.copies--, left--);
    return pool;
  };
  const withNeutral = (n: number) => {
    const pool: { card: Card; copies: number }[] = cortexMinus(n);
    const fill = [spareCycles, relayCourier, rollbackPoint, uplinkTower];
    let left = n;
    for (const card of fill) {
      const c = Math.min(left, card.rarity === "Rare" ? 2 : 3);
      if (c > 0) pool.push({ card, copies: c });
      left -= c;
    }
    return pool;
  };
  const deck = buildDeck("p1", "Hybrid", withNeutral(MAX_NEUTRAL_COPIES));
  expect(deck.cards).toHaveLength(40);
  expect(deckFaction(deck.cards)).toBe("Cortex");
  expect(() => buildDeck("p1", "Too neutral", withNeutral(MAX_NEUTRAL_COPIES + 1))).toThrow(/neutral cap/);

  const twoFactions = [...CORTEX_CARDS.slice(0, 10), ...NULL_CARDS.slice(0, 6)];
  expect(() => buildDeck("p1", "Two factions", twoFactions)).toThrow(/one faction plus neutral/);
  expect(() => buildDeck("p1", "All neutral", NEUTRAL_POOL.map((card) => ({ card, copies: 2 })))).toThrow(/neutral cards alone/);

  // A card claiming to be Neutral that the pool lint never saw is refused.
  const forged: CommandCard = { ...spareCycles, id: "NT-999", name: "Forged Cycles" };
  expect(() => buildDeck("p1", "Forged", [...cortexMinus(1), { card: forged, copies: 1 }])).toThrow(/not in the neutral pool/);
});

test("card flow is faction identity: neutral draw cannot stand in for a faction's own", () => {
  // Swarm with every drawing card removed, topped up with neutral draw.
  const noDraw = SWARM_CARDS.filter((p) => !p.card.abilities.some((a) => (a.effects ?? []).some((e) => e.kind === "drawCard" || (e.kind === "conditional" && e.then.some((t) => t.kind === "drawCard")))));
  const size = noDraw.reduce((n, p) => n + p.copies, 0);
  expect(size, "the probe needs Swarm to actually lose its draw cards").toBeLessThan(40);
  const pool = [...noDraw, { card: spareCycles, copies: 3 }, { card: relayCourier, copies: 3 }];
  expect(() => buildDeck("p1", "Borrowed flow", pool)).toThrow(/no card flow/);
});

test("every shipped deck builds, and stays inside the neutral cap", () => {
  for (const build of [buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck]) {
    const deck = build("p1", "Shipped");
    const neutral = deck.cards.filter((c) => c.faction === "Neutral").length;
    expect(neutral).toBeLessThanOrEqual(MAX_NEUTRAL_COPIES);
    expect(() => deckFaction(deck.cards)).not.toThrow();
  }
});

test("Burst Credit refunds spent energy, never above the maximum", () => {
  const cast = (energy: number): number => {
    const state = emptyState();
    const rng = new Rng(1);
    state.players.p1.maxEnergy = 5;
    state.players.p1.energy = energy;
    state.players.p1.hand.push(burstCredit);
    const play = getLegalMoves(state).find((m) => m.type === "playCard" && m.handIndex === 0)!;
    applyMove(state, play, rng);
    applyMove(state, { type: "passPriority" }, rng);
    applyMove(state, { type: "passPriority" }, rng);
    return state.players.p1.energy;
  };
  expect(cast(1), "spent 4: gets 2 back").toBe(3);
  expect(cast(4), "spent 1: only 1 fits").toBe(5);
  expect(cast(5), "full: nothing").toBe(5);
});

test("Power Reserve hands back 1 energy at the end of its controller's turn", () => {
  const state = emptyState();
  const rng = new Rng(1);
  state.players.p1.directives.push({ instanceId: "test-reserve", card: powerReserve, controller: "p1" });
  state.players.p1.maxEnergy = 4;
  state.players.p1.energy = 0;
  applyMove(state, { type: "passPriority" }, rng);
  applyMove(state, { type: "passPriority" }, rng);
  expect(state.activePlayer).toBe("p2");
  expect(state.players.p1.energy, "held into the opponent's turn").toBe(1);
});

test("Uplink Tower draws at turn start only while its controller's hand is low", () => {
  const run = (cardsInHand: number): number => {
    const state = emptyState();
    const rng = new Rng(1);
    putUnit(state, "p1", uplinkTower);
    state.players.p1.deck.push(glitchSeed, glitchSeed, glitchSeed);
    for (let i = 0; i < cardsInHand; i++) state.players.p1.hand.push(glitchSeed);
    beginTurn(state, "p1", rng, { draw: false });
    return state.players.p1.hand.length - cardsInHand;
  };
  expect(run(0)).toBe(1);
  expect(run(2)).toBe(1);
  expect(run(3), "three cards: no draw").toBe(0);
});

test("Scrap Recycler restores 2 health to its controller when it dies", () => {
  const state = emptyState();
  const rng = new Rng(1);
  state.players.p1.health = 10;
  putUnit(state, "p1", scrapRecycler, scrapRecycler.health);
  processDeaths(state, rng);
  expect(state.players.p1.health).toBe(12);
  expect(state.players.p2.health, "the opponent is not healed").toBe(state.players.p2.maxHealth);
});

// --- LookaheadAgent fixes found by this slice ---------------------------

function agentMove(state: ReturnType<typeof emptyState>) {
  const legal = getLegalMoves(state);
  return new LookaheadAgent("probe", 1).decideMove(buildPlayerView(state, "p1"), legal);
}

test("LookaheadAgent does not repair an undamaged unit, and repairs a damaged one", () => {
  const state = emptyState();
  state.players.p1.maxEnergy = 3;
  state.players.p1.energy = 3;
  putUnit(state, "p1", cortexEngineer);
  expect(agentMove(state).type, "0 damage: nothing to repair").toBe("passPriority");
  state.players.p1.board[0]!.damageTaken = 2;
  expect(agentMove(state).type).toBe("activateAbility");
});

test("LookaheadAgent does not stack a second repair on top of its own pending one", () => {
  const state = emptyState();
  const rng = new Rng(1);
  state.players.p1.maxEnergy = 3;
  state.players.p1.energy = 3;
  const engineer = putUnit(state, "p1", cortexEngineer, 2);
  const first = agentMove(state);
  expect(first.type).toBe("activateAbility");
  applyMove(state, first, rng);
  expect(state.stack).toHaveLength(1);
  // p1 holds priority again with its 2-point repair pending on a 2-damage unit.
  if (state.priority === "p1") expect(agentMove(state).type).toBe("passPriority");
  expect(engineer.damageTaken).toBe(2);
});

test("LookaheadAgent holds Burst Credit and Rollback Point when they would do nothing", () => {
  const state = emptyState();
  state.players.p1.maxEnergy = 5;
  state.players.p1.energy = 5;
  state.players.p1.hand.push(burstCredit);
  expect(agentMove(state).type, "full energy: a refund is worthless").toBe("passPriority");

  const healState = emptyState();
  healState.players.p1.maxEnergy = 5;
  healState.players.p1.energy = 5;
  healState.players.p1.hand.push(rollbackPoint);
  expect(agentMove(healState).type, "full health: nothing to restore").toBe("passPriority");
  healState.players.p1.health = 12;
  expect(agentMove(healState).type, "at 12/20 the heal is worth casting").toBe("playCard");
});
