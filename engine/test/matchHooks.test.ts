// runMatch's onMove hook (session 67): the server's ladder keeps its
// move-by-move timeline (replays, Watch live) from it, so it must see every
// applied move, in order, with the live state after it, and the moves it
// saw must replay to the same game from the same seed.

import { expect, test } from "vitest";
import { buildCortexDeck, buildNullDeck } from "../src/data/decks.js";
import { LookaheadAgent } from "../src/agents/lookaheadAgent.js";
import { replayMatch, runMatch } from "../src/engine/match.js";
import type { Move } from "../src/engine/moves.js";

test("onMove sees every move once, in order, after it is applied; the moves replay to the same game", async () => {
  const seen: { move: Move; n: number; logLength: number; turn: number }[] = [];
  const result = await runMatch(buildCortexDeck("p1", "Cortex"), buildNullDeck("p2", "Null"), new LookaheadAgent("A", 1), new LookaheadAgent("B", 2), 4242, {
    onMove: (state, move, n) => seen.push({ move, n, logLength: state.log.length, turn: state.turnNumber }),
  });
  expect(seen.map((s) => s.n)).toEqual(Array.from({ length: result.movesPlayed }, (_, i) => i + 1));
  expect(seen.at(-1)!.logLength).toBe(result.state.log.length);
  for (let i = 1; i < seen.length; i++) expect(seen[i]!.logLength).toBeGreaterThanOrEqual(seen[i - 1]!.logLength);

  // Replay: the same seed, the same decks, the moves the hook saw.
  const replayed = replayMatch(buildCortexDeck("p1", "Cortex"), buildNullDeck("p2", "Null"), { p1: "A", p2: "B" }, 4242, seen.map((s) => s.move));
  expect(replayed.state.winner).toBe(result.state.winner);
  expect(replayed.state.log).toEqual(result.state.log);
  expect(replayed.movesPlayed).toBe(result.movesPlayed);
});

test("replayMatch refuses a recording that doesn't fit: an illegal move, or moves past the end", async () => {
  const moves: Move[] = [];
  await runMatch(buildCortexDeck("p1", "Cortex"), buildNullDeck("p2", "Null"), new LookaheadAgent("A", 1), new LookaheadAgent("B", 2), 7, {
    onMove: (_s, m) => moves.push(m),
  });
  const decks = () => [buildCortexDeck("p1", "Cortex"), buildNullDeck("p2", "Null")] as const;
  // Another seed deals other hands: the first card play no longer fits.
  const firstPlay = moves.findIndex((m) => m.type === "playCard");
  expect(() => replayMatch(...decks(), { p1: "A", p2: "B" }, 8, moves)).toThrow(/isn't legal here/);
  expect(firstPlay).toBeGreaterThanOrEqual(0);
  expect(() => replayMatch(...decks(), { p1: "A", p2: "B" }, 7, [...moves, { type: "passPriority" }])).toThrow(/after the match ended/);
});
