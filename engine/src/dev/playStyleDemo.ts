// Play styles side by side (session 52): the same deal played by each style.
//
// For each seed, p1 pilots one deck with each of the six styles in turn,
// against the same p2 (Calculator, same deck, same agent seed), so every
// game starts from the identical shuffle. Printed per style: the result,
// the length, attacks at the opponent's health against attacks at units,
// and the first decisions where the style picked a move Calculator would
// not have, in words. This is the "plays visibly differently" evidence at
// the level of single moves; dev/playStyleRing.ts has the averages.
//
// Usage (from engine/): npx tsx src/dev/playStyleDemo.ts [seed,seed,...]

import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { PLAY_STYLES, PLAY_STYLE_IDS } from "../agents/playStyles.js";
import { buildAegisDeck, buildCortexDeck, buildNullDeck, buildSwarmDeck } from "../data/decks.js";
import { runMatch } from "../engine/match.js";
import type { Agent, PlayerView } from "../agents/agent.js";
import type { Move } from "../engine/moves.js";
import type { TargetRef } from "../effects/targeting.js";
import type { DeckFaction } from "../cards/types.js";
import type { DeckSpec } from "../state/init.js";
import { approvedSignatureFor } from "./edgeMeasure.js";
import { behaviourOf } from "./playStyleRing.js";

const BUILDERS: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
  Null: buildNullDeck,
};

function targetName(view: PlayerView, t: TargetRef | undefined): string {
  if (!t) return "";
  if (t.kind === "player") return t.playerId === view.self ? "itself" : "the opponent's health";
  const u = [...view.me.board, ...view.opponent.board].find((x) => x.instanceId === t.instanceId);
  if (u) return `${view.me.board.includes(u) ? "its" : "the enemy"} ${u.card.name}`;
  const d = [...view.me.directives, ...view.opponent.directives].find((x) => x.instanceId === t.instanceId);
  return d ? d.card.name : "?";
}

export function describeMove(view: PlayerView, m: Move): string {
  const on = (t: TargetRef | undefined) => (t ? ` on ${targetName(view, t)}` : "");
  switch (m.type) {
    case "passPriority":
      return view.activePlayer === view.self && view.stack.length === 0 ? "end the turn" : "pass";
    case "attack": {
      const a = view.me.board.find((u) => u.instanceId === m.attackerInstanceId);
      return `attack ${targetName(view, m.target)} with ${a?.card.name ?? "?"}`;
    }
    case "playCard":
      return `play ${view.me.hand[m.handIndex]?.name ?? "?"}${m.mode ? ` (${m.mode})` : ""}${on(m.target ?? m.abilityTarget)}`;
    case "playSignature":
      return `play the signature card ${view.me.signature?.card.name ?? ""}${on(m.target)}`;
    case "activateAbility": {
      const src = [...view.me.board, ...view.me.directives].find((x) => x.instanceId === m.sourceInstanceId);
      return `activate ${src?.card.name ?? "?"}${on(m.target)}`;
    }
  }
}

/** Records where the styled agent leaves Calculator's best moves. */
class Narrated implements Agent {
  readonly name: string;
  readonly departures: string[] = [];
  private shadow = new LookaheadAgent("shadow", 1);
  constructor(private inner: LookaheadAgent) {
    this.name = inner.name;
  }
  decideMove(view: PlayerView, legal: Move[]): Move {
    const move = this.inner.decideMove(view, legal);
    if (legal.length > 1) {
      const best = this.shadow.bestMoves(view, legal);
      const key = JSON.stringify(move);
      if (!best.some((b) => JSON.stringify(b) === key)) {
        this.departures.push(`turn ${view.turnNumber}: ${describeMove(view, move)} (Calculator: ${describeMove(view, best[0]!)})`);
      }
    }
    return move;
  }
}

const seeds = (process.argv[2] ?? "7,12").split(",").map(Number);
const pairings: [DeckFaction, DeckFaction][] = [
  ["Cortex", "Swarm"],
  ["Aegis", "Null"],
];
console.log("AI-TCG play styles side by side: the same deal, p1 played by each style, p2 always Calculator.");
console.log("Shipped decks, an approved signature card each side. 'Departs' lists the first moves where the style");
console.log("chose differently from what Calculator would have played in the same position (often the same plan in a");
console.log("different order, like attacking before playing a card). Signature stand-ins are named by their menu line id.\n");
for (const [i, seed] of seeds.entries()) {
  const [f1, f2] = pairings[i % pairings.length]!;
  console.log(`== seed ${seed}: p1 ${f1} vs p2 ${f2} (Calculator)`);
  for (const id of PLAY_STYLE_IDS) {
    const style = PLAY_STYLES[id];
    const me = new Narrated(new LookaheadAgent(style.name, seed * 104729 + 31, { style: id }));
    const { state } = await runMatch(
      { ...BUILDERS[f1]("p1", f1), signature: approvedSignatureFor(seed, 0) },
      { ...BUILDERS[f2]("p2", f2), signature: approvedSignatureFor(seed, 1) },
      me,
      new LookaheadAgent("Calculator", seed * 104729 + 31),
      seed,
    );
    const b = behaviourOf(state, "p1");
    const result = state.winner === "p1" ? "WIN " : state.winner === "draw" ? "DRAW" : "loss";
    console.log(
      `  ${style.name.padEnd(11)} ${result} in ${b.turns} turns; health ${state.players.p1.health} to ${state.players.p2.health}; ` +
        `attacks ${b.faceAttacks} at health, ${b.attacks - b.faceAttacks} at units; ${b.cardsPlayed} cards; ${me.departures.length} departures`,
    );
    for (const d of me.departures.slice(0, 3)) console.log(`      departs ${d}`);
  }
  console.log("");
}
