// Real-play evidence for the generic "choose one" mechanic (owner
// 2026-10-16; built session 40), with its first users, the 3 Season 0
// Zero-Day cards (owner 2026-10-18).
//
// Two shipped decks each make room for all 3 Zero-Day cards (one copy each,
// the guardrail): each card replaces one spare copy of a card already in the
// deck, a removal card for a Zero-Day card that counts as removal where the
// deck has a spare one (so the deck's 25% removal share holds; buildDeck
// checks it). Both sides are LookaheadAgent with the
// edge-measure seeding, the set Mythic standing in as the signature card is
// NOT used (a deck with a Zero-Day card holds two Mythics). Prints the first
// game in which at least `minModes` different modes are chosen, with every
// mode choice marked MODE, and a count of the legal moves the choice was
// made from (one per mode, per target).
//
// Usage: npx tsx src/dev/modalMatchDemo.ts [maxSeed=400] [minModes=4]

import { buildDeck } from "../data/decks.js";
import { CORTEX_CARDS, SWARM_CARDS } from "../data/cards.js";
import { ZERO_DAY_CARDS } from "../data/zeroDayCards.js";
import { isRemovalOrDebuffCard } from "../cards/poolLint.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import type { Agent } from "../agents/agent.js";
import { runMatch } from "../engine/match.js";
import { formatEvent } from "../log/format.js";
import type { Card } from "../cards/types.js";
import type { GameState } from "../state/types.js";

const maxSeed = Number(process.argv[2] ?? 400);
const minModes = Number(process.argv[3] ?? 4);

type Pool = { card: Card; copies: number }[];

/** `base` with all 3 Zero-Day cards, each in place of one spare copy. */
export function withZeroDays(base: Pool): Pool {
  const pool = base.map((p) => ({ ...p }));
  for (const zd of ZERO_DAY_CARDS) {
    const spare = pool.filter((p) => p.copies > 1 && p.card.rarity !== "Mythic" && !p.card.topTier);
    const cut = spare.find((p) => isRemovalOrDebuffCard(p.card) === isRemovalOrDebuffCard(zd)) ?? spare[0];
    if (!cut) throw new Error(`no spare copy to make room for ${zd.name}`);
    cut.copies -= 1;
    pool.push({ card: zd, copies: 1 });
  }
  return pool;
}

/** Records, for each modal play, how many legal moves offered that card. */
function observe(agent: Agent, offered: Map<number, string>, state: () => GameState | undefined): Agent {
  return {
    name: agent.name,
    async decideMove(view, legal) {
      const move = await agent.decideMove(view, legal);
      if (move.type === "playCard" && move.mode) {
        const same = legal.filter((m) => m.type === "playCard" && m.handIndex === move.handIndex);
        const modes = [...new Set(same.map((m) => (m.type === "playCard" ? m.mode : undefined)))];
        offered.set(state()!.log.length, `${same.length} legal plays of this card: ${modes.map((m) => `${m} x${same.filter((x) => x.type === "playCard" && x.mode === m).length}`).join(", ")}`);
      }
      return move;
    },
  };
}

for (let seed = 1; seed <= maxSeed; seed++) {
  const cortex = buildDeck("p1", "Cortex + Zero-Day", withZeroDays(CORTEX_CARDS));
  const swarm = buildDeck("p2", "Swarm + Zero-Day", withZeroDays(SWARM_CARDS));
  let live: GameState | undefined;
  const offered = new Map<number, string>();
  const a = observe(new LookaheadAgent("Lookahead-Cortex", seed * 104729 + 31), offered, () => live);
  const b = observe(new LookaheadAgent("Lookahead-Swarm", seed * 104729 + 31), offered, () => live);
  const { state } = await runMatch(cortex, swarm, a, b, seed, { onMatchStart: (s) => (live = s) });
  const choices = state.log.filter((e) => (e.type === "play" || e.type === "cast" || e.type === "evolve") && e.mode);
  const distinct = new Set(choices.map((e) => ("modeName" in e ? `${"card" in e ? e.card : ""}/${e.modeName}` : "")));
  if (distinct.size < minModes) continue;

  const lines: string[] = [];
  lines.push(`AI-TCG "choose one" demo (owner 2026-10-16; session 40): Cortex vs Swarm, both decks running the 3 Zero-Day cards, seed ${seed}`);
  lines.push(`(first seed in 1-${maxSeed} with at least ${minModes} different modes chosen)`);
  lines.push(`p1 = ${state.players.p1.name}, p2 = ${state.players.p2.name}`);
  for (const zd of ZERO_DAY_CARDS) {
    const body = zd.type === "Unit" ? `, ${zd.attack}/${zd.health}` : "";
    lines.push(`  ${zd.name}: ${zd.cost} energy ${zd.type}${body}. Choose one: ${zd.modes!.map((m) => `${m.name}: "${m.text}"`).join(" / ")}`);
  }
  lines.push("MODE = a modal card played; the line under it says which legal moves the agent chose from.");
  lines.push("");
  state.log.forEach((e, i) => {
    const text = formatEvent(e);
    const isChoice = (e.type === "play" || e.type === "cast" || e.type === "evolve") && e.mode;
    if (isChoice) {
      lines.push(`MODE ${text.trimStart()}`);
      // The play is logged right after the move was chosen at this log length.
      const note = offered.get(i);
      if (note) lines.push(`       (${note})`);
    } else lines.push(text);
  });
  lines.push("");
  lines.push(`Turns: ${state.turnNumber}. Winner: ${state.winner}.`);
  lines.push(`Mode choices: ${choices.map((e) => ("modeName" in e ? `${e.player} ${"card" in e ? e.card : ""} -> ${e.modeName}` : "")).join("; ")}.`);
  const graveModal = [...state.players.p1.graveyard, ...state.players.p2.graveyard].filter((c) => c.chosenMode !== undefined).length;
  lines.push(`Graveyard cards still carrying a chosen mode (must be 0): ${graveModal}.`);
  console.log(lines.join("\n"));
  process.exit(0);
}
console.log(`no game in seeds 1-${maxSeed} with ${minModes} different modes`);
