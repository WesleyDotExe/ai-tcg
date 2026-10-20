// Play styles (session 52, owner 2026-10-15): presets of the LookaheadAgent's
// weights. Calculator must be today's agent exactly (every balance
// measurement uses it), and each other style must change the decisions its
// weights say it changes, on real engine states and legal moves.

import { test, expect } from "vitest";
import type { CommandCard, UnitCard } from "../src/cards/types.js";
import { getLegalMoves } from "../src/engine/moves.js";
import { buildPlayerView } from "../src/agents/agent.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { CALCULATOR_WEIGHTS, PLAY_STYLES, PLAY_STYLE_IDS, isPlayStyleId } from "../src/agents/playStyles.js";
import { aegisSentinel } from "../src/data/aegisCards.js";
import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../src/data/decks.js";
import { runMatch } from "../src/engine/match.js";
import { behaviourOf, fieldScore, mergeAggregates, passesFairness, playRing } from "../src/dev/playStyleRing.js";
import { emptyState, putUnit } from "./helpers.js";

const unit = (id: string, cost: number, attack: number, health: number): UnitCard => ({
  id,
  name: id,
  faction: "Cortex",
  rarity: "Common",
  cost,
  type: "Unit",
  attack,
  health,
  keywords: [],
  art: "placeholder",
  flavor: "",
  abilities: [],
});

/** p1 to move with an armed 3/14 attacker; p2 has a 6/3 (a kill worth 9 to
 * Calculator, against 6 for 3 face damage). */
function attackChoice() {
  const state = emptyState();
  const attacker = putUnit(state, "p1", aegisSentinel);
  attacker.enteredTurn = -1;
  attacker.permanentBuff.health = 10;
  putUnit(state, "p2", unit("test-glass", 1, 6, 3));
  return { state, legal: getLegalMoves(state), view: buildPlayerView(state, "p1") };
}

test("six presets; Calculator is the default weights; every other style changes something", () => {
  expect(PLAY_STYLE_IDS).toHaveLength(6);
  expect(PLAY_STYLES.calculator.weights).toEqual(CALCULATOR_WEIGHTS);
  for (const id of PLAY_STYLE_IDS) {
    expect(PLAY_STYLES[id].id).toBe(id);
    expect(isPlayStyleId(id)).toBe(true);
    if (id !== "calculator") expect(PLAY_STYLES[id].weights).not.toEqual(CALCULATOR_WEIGHTS);
  }
  expect(isPlayStyleId("berserker")).toBe(false);
});

test("Calculator plays exactly the moves the unstyled agent plays (the balance reference is unchanged)", async () => {
  const builders = [buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck];
  for (const [i, a] of builders.entries()) {
    for (const [j, b] of builders.entries()) {
      const seed = 1 + i * 4 + j;
      const plain = await runMatch(a("p1", "a"), b("p2", "b"), new LookaheadAgent("a", seed), new LookaheadAgent("b", seed + 1), seed);
      const styled = await runMatch(
        a("p1", "a"),
        b("p2", "b"),
        new LookaheadAgent("a", seed, { style: "calculator" }),
        new LookaheadAgent("b", seed + 1, { style: "calculator" }),
        seed,
      );
      expect(JSON.stringify(styled.state.log)).toBe(JSON.stringify(plain.state.log));
    }
  }
});

test("Rusher swings at the opponent's health where Calculator takes the kill", () => {
  const { legal, view } = attackChoice();
  const calc = new LookaheadAgent("c", 1).decideMove(view, legal);
  const rusher = new LookaheadAgent("r", 1, { style: "rusher" }).decideMove(view, legal);
  expect(calc.type === "attack" && calc.target.kind).toBe("unit");
  expect(rusher.type === "attack" && rusher.target.kind).toBe("player");
});

test("Fortress picks the tougher of two equal bodies; Calculator sees a tie", () => {
  const state = emptyState();
  state.players.p1.hand.push(unit("test-glass-cannon", 3, 4, 2), unit("test-wall", 3, 2, 4));
  state.players.p1.energy = 3;
  state.players.p1.maxEnergy = 3;
  const legal = getLegalMoves(state);
  const view = buildPlayerView(state, "p1");
  const played = (m: ReturnType<LookaheadAgent["decideMove"]>) => (m.type === "playCard" ? view.me.hand[m.handIndex]!.id : m.type);
  for (let seed = 1; seed <= 8; seed++) expect(played(new LookaheadAgent("f", seed, { style: "fortress" }).decideMove(view, legal))).toBe("test-wall");
  const calcBest = new LookaheadAgent("c", 1).bestMoves(view, legal).map(played).sort();
  expect(calcBest).toEqual(["test-glass-cannon", "test-wall"]);
});

test("the reserve weight holds energy up for an Instant in hand, and only on its own turn", () => {
  const instant: CommandCard = {
    id: "test-instant",
    name: "test-instant",
    faction: "Cortex",
    rarity: "Common",
    cost: 2,
    type: "Command",
    speed: "Instant",
    art: "placeholder",
    flavor: "",
    abilities: [{ id: "test-instant-draw", trigger: "onPlay", effects: [{ kind: "drawCard", count: 1 }] }],
  };
  const make = (energy: number) => {
    const state = emptyState();
    state.players.p1.hand.push(unit("test-body", 3, 2, 2), instant);
    state.players.p1.energy = energy;
    state.players.p1.maxEnergy = energy;
    return { legal: getLegalMoves(state), view: buildPlayerView(state, "p1") };
  };
  const holder = (seed: number) => new LookaheadAgent("h", seed, { style: { ...CALCULATOR_WEIGHTS, reserve: 100, cards: 0 } });
  const bodyPlayed = (r: ReturnType<typeof make>, m: ReturnType<LookaheadAgent["decideMove"]>) =>
    m.type === "playCard" && r.view.me.hand[m.handIndex]!.id === "test-body";
  // 4 energy: the 3-cost body would leave 1, under the Instant's 2.
  const tight = make(4);
  expect(bodyPlayed(tight, new LookaheadAgent("c", 1, { style: { ...CALCULATOR_WEIGHTS, cards: 0 } }).decideMove(tight.view, tight.legal))).toBe(true);
  expect(bodyPlayed(tight, holder(1).decideMove(tight.view, tight.legal))).toBe(false);
  // 5 energy: the body leaves 2, enough for the Instant, so no penalty.
  const roomy = make(5);
  expect(bodyPlayed(roomy, holder(1).decideMove(roomy.view, roomy.legal))).toBe(true);
});

test("Gambler picks among the moves near the best, never a far worse one", () => {
  const { legal, view } = attackChoice();
  // Unit kill 9, face 6, pass 0. At margin 3.5 both attacks are in reach.
  const wide = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) {
    const m = new LookaheadAgent("g", seed, { style: { ...CALCULATOR_WEIGHTS, margin: 3.5 } }).decideMove(view, legal);
    wide.add(m.type === "attack" ? m.target.kind : m.type);
  }
  expect([...wide].sort()).toEqual(["player", "unit"]);
  // The shipped Gambler's margin (0.6) keeps only the kill here.
  for (let seed = 1; seed <= 30; seed++) {
    const m = new LookaheadAgent("g", seed, { style: "gambler" }).decideMove(view, legal);
    expect(m.type === "attack" && m.target.kind).toBe("unit");
  }
});

test("every style finishes full matches in every faction", async () => {
  const builders = [buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck];
  for (const [i, id] of PLAY_STYLE_IDS.entries()) {
    for (const [j, b] of builders.entries()) {
      const seed = 100 + i * 4 + j;
      const other = PLAY_STYLE_IDS[(i + 1) % PLAY_STYLE_IDS.length]!;
      const { state } = await runMatch(b("p1", "a"), buildNullDeck("p2", "b"), new LookaheadAgent("a", seed, { style: id }), new LookaheadAgent("b", seed, { style: other }), seed);
      expect(state.winner, `${id} on seed ${seed}`).toBeDefined();
      const me = behaviourOf(state, "p1");
      expect(me.games).toBe(1);
      expect(me.faceAttacks).toBeLessThanOrEqual(me.attacks);
    }
  }
});

test("the style ring: each game twice with the styles swapped, shards merge to the whole", async () => {
  const whole = await playRing({ seeds: 2, styles: ["calculator", "rusher", "gambler"] });
  const parts = await Promise.all([0, 1].map((i) => playRing({ seeds: 2, styles: ["calculator", "rusher", "gambler"], shard: { i, k: 2 } })));
  const merged = mergeAggregates(parts);
  // 3 pairs x 16 pairings x 2 seeds x 2 seatings; each style plays 2 pairs of them.
  for (const s of ["calculator", "rusher", "gambler"] as const) {
    expect(fieldScore(whole, s).games).toBe(2 * 16 * 2 * 2);
    expect(fieldScore(merged, s)).toEqual(fieldScore(whole, s));
  }
  // Every game hands out exactly one point between its two sides.
  const total = (["calculator", "rusher", "gambler"] as const).reduce((t, s) => t + fieldScore(whole, s).points, 0);
  expect(total).toBe(3 * 16 * 2 * 2);
  expect(typeof passesFairness(whole, "rusher")).toBe("boolean");
});
