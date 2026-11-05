// A recorded match as the full arena replay (render session 50, the match
// pages): the server's replay file (OWNER_API.md "Match history",
// `ai-tcg-replay/1`) rebuilt in the engine and drawn by the same replay page
// every sample replay uses (renderHtml.ts). The owner's 2026-10-05 spec:
// "use the existing match renderer for the real board".
//
// The replay file holds the decks, the seed and every move. captureMatch
// (capture.ts) plays a match from the same start the engine's replayMatch
// does (both shuffle from the seed and begin turn 1 for p1 without a
// draw), so two scripted seats that hand back the recorded moves in order
// give every frame of the match as it was played. A recorded move that
// isn't legal where the file puts it throws: the file doesn't belong to
// this engine. Since game session 70 replays are versioned (the owner's
// 2026-11-02 call 6): an `ai-tcg-replay/2` file carries its rules version
// and every card in full, an `/1` file reads the frozen `cards-1`; the
// server's replaySetup reads either, so an old file after a card or rule
// change still shows the match it was.
//
// The boast is the match record's (`GET /api/matches/:id`'s `boast`), never
// one the render picks, checked against the rebuilt match the same way
// recordedMatch.ts's attachRecord checks the store's record.

import { BOARD_SLOTS, type Agent, type Move, type PlayerId } from "@ai-tcg/engine";
// The game lane's server, read-only (RENDER.md: a fixed upstream): its own
// reading of a replay file's decks, so both rebuild the same match.
import { READABLE_REPLAY_FORMATS, replaySetup, type ReplayFile } from "../../../server/src/ladder/ladderRunner.js";
import { captureMatch } from "../capture.js";
import type { MatchReplay, ReplayRecord } from "../types.js";
import type { SiteMatchView } from "./siteApi.js";

/** The replay formats this site reads (the server's own list). */
export const REPLAY_FORMATS: readonly string[] = READABLE_REPLAY_FORMATS;

/** Hands back the file's moves in order, from whichever seat has priority
 * (both seats share one cursor: the file is one sequence). */
function scriptedSeats(names: Record<PlayerId, string>, moves: readonly Move[]): { p1: Agent; p2: Agent; played: () => number } {
  let next = 0;
  const seat = (name: string): Agent => ({
    name,
    decideMove: (_view, legal) => {
      const move = moves[next];
      if (move === undefined) throw new Error(`the replay file ends after move ${next}, but the match goes on`);
      const key = JSON.stringify(move);
      if (!legal.some((m) => JSON.stringify(m) === key)) throw new Error(`move ${next + 1} isn't legal here: ${key}`);
      next++;
      return move;
    },
  });
  return { p1: seat(names.p1), p2: seat(names.p2), played: () => next };
}

/** The match record's boast, turned into its seat, checked against the
 * rebuilt match's end. */
export function recordOf(replay: MatchReplay, view: SiteMatchView): ReplayRecord {
  const last = replay.frames[replay.frames.length - 1]!;
  const replayWinner = last.winner ?? "draw";
  const viewWinner = view.outcome === "win" ? (view.winnerOwnerId === view.p1.ownerId ? "p1" : view.winnerOwnerId === view.p2.ownerId ? "p2" : null) : view.outcome === "draw" ? "draw" : null;
  if (viewWinner !== replayWinner) throw new Error(`the record says ${viewWinner ?? view.outcome}, the rebuilt match ends ${replayWinner}`);
  return { matchId: view.matchId, loadouts: null, boast: seatedBoast(replay, view, view.boast) };
}

/** A boast (`MatchBoast`) on its seat, checked against the board's end: it
 * must be the winner's, on the winner's health. */
function seatedBoast(replay: MatchReplay, sides: { p1: { agentId: string }; p2: { agentId: string } }, boast: SiteMatchView["boast"]): ReplayRecord["boast"] {
  if (!boast) return null;
  const last = replay.frames[replay.frames.length - 1]!;
  const winner = last.winner ?? "draw";
  const side: PlayerId | null = boast.agentId === sides.p1.agentId ? "p1" : boast.agentId === sides.p2.agentId ? "p2" : null;
  if (!side || side !== winner) throw new Error(`the record's boast is not the winner's`);
  if (boast.winnerHealth !== null && boast.winnerHealth !== last.players[side].health) {
    throw new Error(`the record has the winner on ${boast.winnerHealth} health, the rebuilt match on ${last.players[side].health}`);
  }
  return { side, itemId: boast.itemId, slot: boast.slot, winnerHealth: boast.winnerHealth };
}

/** The live view as a match record for the arena (render session 56), once
 * the last move is out: the live view then carries the boast the record
 * will keep (`LiveMatchView.boast`, game session 72), so live, as in a
 * replay, the boast plays before the result lands, not ~8 s after it when
 * the match is recorded. Null while moves are still to come (`nextAt` set,
 * or the board short of `released`), or when the board hasn't ended. Throws
 * on a boast that doesn't fit the board's end (the caller shows none). */
export function liveRecordOf(
  replay: MatchReplay,
  view: { matchId: string; released: number; nextAt: string | null; p1: { agentId: string }; p2: { agentId: string }; boast?: SiteMatchView["boast"] },
): ReplayRecord | null {
  if (view.nextAt !== null || view.boast === undefined) return null;
  if (replay.frames.length - 1 !== view.released) return null;
  const last = replay.frames[replay.frames.length - 1]!;
  if (!last.winner) return null;
  return { matchId: view.matchId, loadouts: null, boast: seatedBoast(replay, view, view.boast) };
}

/** The replay file and the match's record, as the arena replay. */
export async function replayOfFile(file: ReplayFile, view: SiteMatchView): Promise<MatchReplay> {
  if (!REPLAY_FORMATS.includes(file.format)) throw new Error(`a replay file in format "${String(file.format)}"; this site reads ${REPLAY_FORMATS.join(" and ")}`);
  if (file.matchId !== view.matchId) throw new Error(`the replay file is match "${file.matchId}", the record "${view.matchId}"`);
  const setup = replaySetup(file);
  const seats = scriptedSeats(setup.names, setup.moves);
  const replay = await captureMatch({
    title: `${file.names.p1} vs ${file.names.p2}`,
    seed: setup.seed,
    deckA: setup.decks.p1,
    deckB: setup.decks.p2,
    agentA: seats.p1,
    agentB: seats.p2,
    boardSlots: BOARD_SLOTS,
    ...(setup.rules ? { rules: setup.rules } : {}),
  });
  if (seats.played() !== file.moves.length) throw new Error(`the match ended after ${seats.played()} of the file's ${file.moves.length} moves`);
  const last = replay.frames[replay.frames.length - 1]!;
  const winner = last.winner ?? "draw";
  if (file.result.winner !== null && file.result.winner !== winner) throw new Error(`the file says ${file.result.winner} won, the rebuilt match ends ${winner}`);
  // The arena shows health below 0 as 0 (capture.ts), so the file's is read the same way.
  const fh = { p1: Math.max(0, file.result.finalHealth.p1), p2: Math.max(0, file.result.finalHealth.p2) };
  if (fh.p1 !== last.players.p1.health || fh.p2 !== last.players.p2.health) {
    throw new Error(`the file ends on ${file.result.finalHealth.p1}-${file.result.finalHealth.p2} health, the rebuilt match on ${last.players.p1.health}-${last.players.p2.health}`);
  }
  // The coins (render session 53): the record's, else the file's; neither
  // on a match from before coins (both flip the Chrome Token).
  const coins = view.coins ?? file.coins;
  return { ...replay, record: recordOf(replay, view), ...(coins ? { coins: { p1: coins.p1, p2: coins.p2 } } : {}) };
}
