// Match running and the ladder (Season 0 game item 1; roadmap 6b). Built
// session 66.
//
// The server runs rounds of ranked matches between owners: it checks each
// queued owner's agent deck (rebuilding it when the store's rebuild reasons
// say so: packs opened, crafting, salvage, a lock or style change), pairs
// the queue by Glicko-2 rating (pairing.ts), and for each pair starts the
// match through the store (each owner's connected agent and active deck),
// plays it in the engine, and records it with the result, turns, moves and
// each side's final health (the close-win boast). The store pays the
// credits on the daily win schedule (midnight Sydney) and moves both
// ratings in the same transaction. This closes the loop:
// play -> earn -> owner opens packs -> agent rebuilds -> play.
//
// Who plays a seat is the `AgentSeater`'s job, the seam where a connected
// network agent (RemoteAgent) plugs in later. Season 0's house agents play
// in-process: the engine's LookaheadAgent in the agent's play style
// (`houseSeater`). Whatever the seater returns is wrapped so that a move it
// fails to give (it throws, or returns a move that isn't legal) ends the
// match as abandoned by that seat: no credits for either side (the economy
// rule), and a loss on the rating for the side that walked out. An error
// that is nobody's seat (the engine itself) records the match as cancelled:
// no credits, not rated.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { formatLog, LookaheadAgent, runMatch, type Agent, type DeckBuildOptions, type Move, type PlayerId, type PlayStyleId } from "@ai-tcg/engine";
import { EconomyError, type DeckChooser, type EconomyStore, type LiveMatch, type MatchRecord, type RecordedOutcome } from "@ai-tcg/economy";
import { deepEqual } from "../deepEqual.js";
import { pairRound, seededRandom, type Pairing, type QueueEntry, type Random } from "./pairing.js";

export interface SeatInput {
  matchId: string;
  seat: PlayerId;
  ownerId: string;
  agentId: string;
  agentName: string;
  playStyle: PlayStyleId;
  /** A seed for the agent's own choices, drawn from the match's seed. */
  seed: number;
}

/** Gives the agent that plays one seat of a match. */
export interface AgentSeater {
  seat(input: SeatInput): Agent | Promise<Agent>;
}

/** Season 0's house agents: the engine's LookaheadAgent in the agent's
 * play style, in-process. */
export const houseSeater: AgentSeater = {
  seat: (s) => new LookaheadAgent(s.agentName, s.seed, { style: s.playStyle }),
};

/** A seat that failed to give a legal move. */
export class SeatFault extends Error {
  constructor(
    readonly seat: PlayerId,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps a seat's agent: a throw or an illegal move becomes a SeatFault. */
function guarded(agent: Agent, seat: PlayerId): Agent {
  return {
    name: agent.name,
    async decideMove(view, legalMoves): Promise<Move> {
      let move: Move;
      try {
        move = await agent.decideMove(view, legalMoves);
      } catch (err) {
        throw new SeatFault(seat, `${agent.name} gave no move: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (!legalMoves.some((m) => deepEqual(m, move))) throw new SeatFault(seat, `${agent.name} played an illegal move: ${JSON.stringify(move)}`);
      return move;
    },
  };
}

export type LadderEvent =
  | { kind: "rebuilt"; ownerId: string; reasons: string[]; faction: string; cards: number }
  | { kind: "excluded"; ownerId: string; reason: string }
  | { kind: "paired"; pairing: Pairing }
  | { kind: "match"; result: LadderMatch };

export interface LadderMatch {
  record: MatchRecord;
  /** Why the match didn't resolve normally, for an abandon or a cancel. */
  note: string | null;
  /** Where its log was written, if a log directory is set. */
  logPath: string | null;
}

export interface RoundReport {
  round: number;
  rebuilt: { ownerId: string; reasons: string[]; faction: string; cards: number }[];
  excluded: { ownerId: string; reason: string }[];
  pairs: Pairing[];
  sitOut: string[];
  matches: LadderMatch[];
}

export interface LadderOptions {
  store: EconomyStore;
  seater?: AgentSeater;
  /** The seed for pairing and match seeds; a fixed one makes a run
   * reproducible. Default: random. */
  seed?: number;
  /** How hard a between-match rebuild searches (the store's default
   * otherwise). */
  build?: Omit<DeckBuildOptions, "faction" | "style">;
  /** What plays a rebuild's games (the server's worker-thread chooser);
   * the engine's chooseDeck on this thread otherwise. */
  chooser?: DeckChooser;
  /** A new match's id; default `m-<uuid>`. */
  matchId?: () => string;
  /** Each match's formatted log is written here as `<matchId>.txt`. */
  logDir?: string;
  /** Called after each match is recorded (the demo moves its clock here). */
  afterMatch?: (m: LadderMatch) => void | Promise<void>;
  onEvent?: (e: LadderEvent) => void;
}

export class Ladder {
  private readonly store: EconomyStore;
  private readonly seater: AgentSeater;
  private readonly random: Random;
  private readonly opts: LadderOptions;
  private readonly satOut = new Map<string, number>();
  private rounds = 0;

  constructor(opts: LadderOptions) {
    this.opts = opts;
    this.store = opts.store;
    this.seater = opts.seater ?? houseSeater;
    this.random = seededRandom(opts.seed ?? Math.floor(Math.random() * 2 ** 32));
    if (opts.logDir) mkdirSync(opts.logDir, { recursive: true });
  }

  /** Owners who can queue: a connected agent, not in a live match. */
  eligibleOwners(): string[] {
    return this.store
      .listOwners()
      .filter((o) => o.connectedAgentId !== null && this.store.liveMatchOf(o.ownerId) === null)
      .map((o) => o.ownerId);
  }

  /** Last opponents of an owner, most recent first, from match history
   * (so a restart remembers them). */
  private recentOpponents(ownerId: string): string[] {
    return this.store
      .matchHistory({ ownerId })
      .slice(-2)
      .reverse()
      .map((m) => (m.p1OwnerId === ownerId ? m.p2OwnerId : m.p1OwnerId));
  }

  private emit(e: LadderEvent): void {
    this.opts.onEvent?.(e);
  }

  /** One round: rebuild what needs it, pair, play and record every pair.
   * `queue` defaults to every eligible owner. */
  async runRound(queue: readonly string[] = this.eligibleOwners()): Promise<RoundReport> {
    const report: RoundReport = { round: ++this.rounds, rebuilt: [], excluded: [], pairs: [], sitOut: [], matches: [] };
    // Rebuilds run side by side (on the worker chooser's threads, when the
    // server passes it); results are reported in queue order.
    const prepared = await Promise.all(queue.map((ownerId) => this.prepare(ownerId)));
    const ready: string[] = [];
    queue.forEach((ownerId, i) => {
      const { rebuilt, reason } = prepared[i]!;
      if (rebuilt) {
        report.rebuilt.push(rebuilt);
        this.emit({ kind: "rebuilt", ...rebuilt });
      }
      if (reason === null) ready.push(ownerId);
      else {
        report.excluded.push({ ownerId, reason });
        this.emit({ kind: "excluded", ownerId, reason });
      }
    });
    const entries: QueueEntry[] = ready.map((ownerId) => ({
      ownerId,
      rating: this.store.rating(ownerId),
      satOut: this.satOut.get(ownerId) ?? 0,
      recentOpponents: this.recentOpponents(ownerId),
    }));
    const round = pairRound(entries, this.random);
    report.pairs = round.pairs;
    report.sitOut = round.sitOut;
    for (const id of round.sitOut) this.satOut.set(id, (this.satOut.get(id) ?? 0) + 1);
    for (const p of round.pairs) {
      this.satOut.delete(p.p1);
      this.satOut.delete(p.p2);
      this.emit({ kind: "paired", pairing: p });
      const m = await this.playPair(p);
      if (m === null) continue;
      report.matches.push(m);
      this.emit({ kind: "match", result: m });
      await this.opts.afterMatch?.(m);
    }
    return report;
  }

  /** Readies an owner for a match: rebuilds its agent's deck when the store
   * names a reason. Null when ready, else why it can't play this round. */
  private async prepare(ownerId: string): Promise<{ rebuilt: RoundReport["rebuilt"][number] | null; reason: string | null }> {
    const owner = this.store.getOwner(ownerId);
    if (owner.connectedAgentId === null) return { rebuilt: null, reason: "no connected agent" };
    if (this.store.liveMatchOf(ownerId) !== null) return { rebuilt: null, reason: "already in a live match" };
    let rebuilt: RoundReport["rebuilt"][number] | null = null;
    if (owner.deckChoice === "agent") {
      try {
        const r = await this.store.rebuildAgentDeckIfNeeded(ownerId, this.opts.build, this.opts.chooser);
        if (r !== null) rebuilt = { ownerId, reasons: r.reasons, faction: r.build.faction, cards: r.build.deck.copyIds.length };
      } catch (err) {
        return { rebuilt: null, reason: `the agent's deck couldn't be rebuilt: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    const fresh = this.store.getOwner(ownerId);
    if (fresh.activeDeckId === null) return { rebuilt, reason: "no active deck" };
    const status = this.store.deckStatus(fresh.activeDeckId);
    if (!status.complete) {
      return { rebuilt, reason: `the active deck is short: ${status.missing.map((m) => `${m.cardId} (uses ${m.uses}, holds ${m.owned})`).join(", ")}` };
    }
    return { rebuilt, reason: null };
  }

  private async playPair(p: Pairing): Promise<LadderMatch | null> {
    const matchId = this.opts.matchId?.() ?? `m-${randomUUID()}`;
    let live: LiveMatch;
    try {
      live = this.store.startMatch({ matchId, p1OwnerId: p.p1, p2OwnerId: p.p2 });
    } catch (err) {
      // Refused before anything was played (a deck went short since the
      // check, say): nothing to record.
      if (err instanceof EconomyError) {
        for (const ownerId of [p.p1, p.p2]) this.emit({ kind: "excluded", ownerId, reason: `match not started: ${err.message}` });
        return null;
      }
      throw err;
    }
    const seed = Math.floor(this.random() * 2 ** 31);
    const seat = async (s: PlayerId) => {
      const side = live[s];
      const agent = this.store.getAgent(side.agentId);
      let seated: Agent;
      try {
        seated = await this.seater.seat({
          matchId,
          seat: s,
          ownerId: side.ownerId,
          agentId: side.agentId,
          agentName: agent.name,
          playStyle: side.playStyle,
          seed: seed * 2 + (s === "p1" ? 0 : 1),
        });
      } catch (err) {
        // No agent for the seat (a network agent that isn't there, say):
        // that side didn't show up.
        throw new SeatFault(s, `${agent.name} couldn't be seated: ${err instanceof Error ? err.message : String(err)}`);
      }
      return guarded(seated, s);
    };
    let outcome: RecordedOutcome;
    let note: string | null = null;
    let turns: number | null = null;
    let moves: number | null = null;
    let finalHealth: { p1: number; p2: number } | null = null;
    let log: string | null = null;
    try {
      const [a1, a2] = [await seat("p1"), await seat("p2")];
      const { state, movesPlayed } = await runMatch({ ...live.p1.deck.spec, id: "p1" }, { ...live.p2.deck.spec, id: "p2" }, a1, a2, seed);
      turns = state.turnNumber;
      moves = movesPlayed;
      finalHealth = { p1: state.players.p1.health, p2: state.players.p2.health };
      log = formatLog(state.log);
      if (state.winner === "p1" || state.winner === "p2") outcome = { kind: "win", winnerAgentId: live[state.winner].agentId };
      else if (state.winner === "draw") outcome = { kind: "draw" };
      else {
        // The engine's move safety stop: not a result anyone earned.
        outcome = { kind: "cancelled" };
        note = `no result after ${movesPlayed} moves (the engine's safety stop)`;
      }
    } catch (err) {
      if (err instanceof SeatFault) {
        outcome = { kind: "abandoned", byAgentId: live[err.seat].agentId };
        note = err.message;
      } else {
        outcome = { kind: "cancelled" };
        note = `engine error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    const record = this.store.recordMatch({
      matchId,
      seed,
      p1AgentId: live.p1.agentId,
      p2AgentId: live.p2.agentId,
      p1DeckId: live.p1.deck.deckId,
      p2DeckId: live.p2.deck.deckId,
      outcome,
      turns,
      moves,
      finalHealth,
    });
    let logPath: string | null = null;
    if (this.opts.logDir && log !== null) {
      logPath = join(this.opts.logDir, `${matchId}.txt`);
      writeFileSync(logPath, `${log}\n`);
    }
    return { record, note, logPath };
  }
}
