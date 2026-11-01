// Phase 2 item 3 of the 2026-09-20 owner-feedback entry: "Directives must be
// removable ... give every faction one answer." Before this, a Directive
// (see DirectiveInstance) had no removal path anywhere in the engine — see
// quality-debt.md's "Architectural gaps" entry, "Directives can never leave
// play." This proves the new generic mechanism (TargetFilter.kind
// "directive", the "destroy" effect dispatching on the resolved target's own
// kind — effects/resolver.ts's applyDestroy) actually works, not just that
// it compiles, and that all four factions' new answer cards use it for real.

import { test, expect } from "vitest";
import { getLegalMoves } from "../src/engine/moves.js";
import { applyMove } from "../src/engine/engine.js";
import { Rng } from "../src/state/rng.js";
import { buildPlayerView } from "../src/agents/agent.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { mainframeCore, forceQuit } from "../src/data/cards.js";
import { staticWardBeacon, breachCharge } from "../src/data/aegisCards.js";
import { boreSwarm } from "../src/data/cards.js";
import { segmentationFault, nullPointer } from "../src/data/nullCards.js";
import type { DirectiveCard, CommandCard } from "../src/cards/types.js";
import { emptyState, drainStack } from "./helpers.js";

type State = ReturnType<typeof emptyState>;

function giveDirective(state: State, controller: "p1" | "p2", card: DirectiveCard): string {
  const instanceId = `test-d${state.nextInstanceId++}`;
  state.players[controller].directives.push({ instanceId, card, controller });
  return instanceId;
}

test("destroying a directive removes it from the board straight to the graveyard, logged", () => {
  const state = emptyState();
  const directiveId = giveDirective(state, "p2", mainframeCore);
  state.players.p1.hand.push(forceQuit);
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;

  const legal = getLegalMoves(state);
  const move = legal.find((m) => m.type === "playCard" && m.target?.kind === "directive" && m.target.instanceId === directiveId);
  expect(move, "Force Quit should offer the enemy directive as a legal target").toBeTruthy();

  const rng = new Rng(1);
  applyMove(state, move!, rng);
  drainStack(state, rng);

  expect(state.players.p2.directives, "the directive should be gone from p2's board").toHaveLength(0);
  expect(state.players.p2.graveyard.some((c) => c.id === mainframeCore.id), "it should land in the graveyard, not vanish").toBe(true);
  expect(
    state.log.some((e) => e.type === "directiveDestroyed" && e.directive === mainframeCore.name && e.controller === "p2"),
    "the destruction should be logged with real evidence, not just inferred from board state",
  ).toBe(true);
});

test("a 'directive' filter never offers the controller's own directives, only the opponent's", () => {
  const state = emptyState();
  giveDirective(state, "p1", mainframeCore); // p1's own — must never be a legal Force Quit target
  const enemyDirectiveId = giveDirective(state, "p2", mainframeCore);
  state.players.p1.hand.push(forceQuit);
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;

  const options = getLegalMoves(state).filter((m) => m.type === "playCard" && m.target?.kind === "directive");
  expect(options).toHaveLength(1);
  expect(options[0]!.type === "playCard" && options[0]!.target).toEqual({ kind: "directive", instanceId: enemyDirectiveId });
});

test("Force Quit's Terminate mode offers no legal play when the opponent has no directive to destroy", () => {
  // Since session 62 Force Quit is modal (Terminate / Kill All). Terminate
  // keeps the old rule: no legal target means no legal play, same as any
  // other chosen-target card. Kill All hits every enemy unit (scope "all"),
  // so, like any board-wide card, it stays castable into an empty board.
  const state = emptyState();
  state.players.p1.hand.push(forceQuit);
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;

  const plays = getLegalMoves(state).filter((m) => m.type === "playCard" && m.handIndex === 0);
  expect(plays.map((m) => m.type === "playCard" && m.mode)).toEqual(["kill-all"]);
});

test.each([
  ["Aegis", breachCharge, staticWardBeacon] as const,
  ["Swarm", boreSwarm, mainframeCore] as const,
  ["Null", nullPointer, segmentationFault] as const,
])("%s's directive-answer card destroys an enemy directive for real", (_faction, card: CommandCard, directive) => {
  const state = emptyState();
  const directiveId = giveDirective(state, "p2", directive);
  state.players.p1.hand.push(card);
  state.players.p1.energy = card.cost;
  state.players.p1.maxEnergy = card.cost;

  const legal = getLegalMoves(state);
  const move = legal.find((m) => m.type === "playCard" && m.target?.kind === "directive" && m.target.instanceId === directiveId);
  expect(move, `${card.name} should offer the enemy directive as a legal target`).toBeTruthy();

  const rng = new Rng(2);
  applyMove(state, move!, rng);
  drainStack(state, rng);

  expect(state.players.p2.directives).toHaveLength(0);
  expect(state.log.some((e) => e.type === "directiveDestroyed")).toBe(true);
});

test("LookaheadAgent destroys a valuable enemy directive rather than passing", () => {
  const state = emptyState();
  giveDirective(state, "p2", mainframeCore); // an ongoing +1/+1 team aura — clearly worth removing
  state.players.p1.hand.push(forceQuit);
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;

  const legal = getLegalMoves(state);
  const view = buildPlayerView(state, "p1");
  const agent = new LookaheadAgent("test", 9);
  const move = agent.decideMove(view, legal);

  expect(move.type, "destroying a real enemy aura should beat passing").toBe("playCard");
});

test("LookaheadAgent does not cast Force Quit into nothing when there is nothing to hit", () => {
  // With no enemy directive Terminate is never offered (the test above), so
  // the session-12 zero-scoring bug class has no hole for "directive"
  // targeting. Kill All is offered into an empty enemy board: the agent must
  // see it does nothing and pass rather than spend 2 energy on it.
  const state = emptyState();
  state.players.p1.hand.push(forceQuit);
  state.players.p1.energy = 2;
  state.players.p1.maxEnergy = 2;

  const legal = getLegalMoves(state);
  expect(legal.some((m) => m.type === "playCard" && m.handIndex === 0 && m.mode === "terminate")).toBe(false);

  const view = buildPlayerView(state, "p1");
  const agent = new LookaheadAgent("test", 10);
  const move = agent.decideMove(view, legal);
  expect(move.type).toBe("passPriority");
});
