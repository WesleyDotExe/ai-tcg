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
//
// Session 67 split a match in two, so the long-lived ladder (liveLadder.ts)
// can show it at watch speed before it counts: `playPair` plays it in the
// engine (keeping its move-by-move timeline), `recordPlayed` records it.
// `runRound` still does both at once (the CLI, the demos, the tests). Also
// session 67: who queues (house owners always; a player owner only while
// its auto-play is on, which the store turns off once the day's rewards are
// maxed), the house owners' pack policy (owner 2026-11-02, option (a)), and
// a replay file beside each match log.

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { formatLog, getCard, isShippedRules, LookaheadAgent, runMatch, type Agent, type UnitCard, type DeckBuildOptions, type DeckSpec, type Move, type PlayerId, type PlayStyleId, type MatchRules } from "@ai-tcg/engine";
import { coinOf, EconomyError, PACK_PRICE_CREDITS, type AutoPlayStopReason, type DeckChooser, type EconomyStore, type LiveMatch, type MatchRecord, type RecordedOutcome } from "@ai-tcg/economy";
import { deepEqual } from "../deepEqual.js";
import { makeReplayFile, type ReplayFile } from "./replayFile.js";
import { pairRound, seededRandom, type Pairing, type QueueEntry, type Random } from "./pairing.js";
import { timelineRecorder, type Timeline } from "./timeline.js";

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
  | { kind: "housePacks"; ownerId: string; bought: number; opened: number; cards: number; newCards: number }
  | { kind: "autoPlayStopped"; ownerId: string; reason: AutoPlayStopReason }
  /** (session 104) A player owner the ladder queued on auto-play switched
   * it off themselves (the website's switch) since the last round started.
   * Seen at the next round's start; `changedAt` is when the switch moved.
   * Not the server's own stops (those are `autoPlayStopped`). */
  | { kind: "autoPlaySwitchedOff"; ownerId: string; changedAt: string | null }
  | { kind: "rebuilt"; ownerId: string; reasons: string[]; faction: string; cards: number }
  | { kind: "excluded"; ownerId: string; reason: string }
  | { kind: "paired"; pairing: Pairing }
  | { kind: "match"; result: LadderMatch }
  | { kind: "seasonEnded"; season: string; endedAt: string; standings: number; retiredCopies: number }
  /** (session 94) The season's end time has passed: no round starts from
   * now; `live` matches being shown finish first. */
  | { kind: "seasonEndTime"; season: string; endsAt: string; live: number };

export interface LadderMatch {
  record: MatchRecord;
  /** Why the match didn't resolve normally, for an abandon or a cancel. */
  note: string | null;
  /** Where its log was written, if a log directory is set. */
  logPath: string | null;
  /** Where its replay was written (`<matchId>.replay.json`), likewise. */
  replayPath: string | null;
  /** Owners whose auto-play the store switched off after this match (the
   * day's rewards maxed, or (session 76) the play-time allowance's time up
   * with this match finished). */
  autoPlayStopped: string[];
}

// The replay file's format (versioned, session 70) lives in replayFile.ts;
// re-exported here for the readers that import it from the ladder.
export { REPLAY_FORMAT, READABLE_REPLAY_FORMATS, replayDeckSpec, replaySetup, rebuildReplay, makeReplayFile } from "./replayFile.js";
export type { ReplayFile, ReplayFileV1, ReplayFileV2, ReplayDeck, ReplaySetup, ReplayResult, ReplayFormat } from "./replayFile.js";

/** A match the engine has played but the store hasn't recorded yet. */
export interface PlayedMatch {
  matchId: string;
  pairing: Pairing;
  live: LiveMatch;
  seed: number;
  outcome: RecordedOutcome;
  note: string | null;
  turns: number | null;
  moves: number | null;
  finalHealth: { p1: number; p2: number } | null;
  /** The formatted match log; null when no move was played. */
  log: string | null;
  /** The match move by move; null when it never started (a seat that
   * couldn't be seated, an engine error before the first move). */
  timeline: Timeline | null;
  replay: ReplayFile | null;
}

export interface RoundReport {
  round: number;
  housePacks: { ownerId: string; bought: number; opened: number; cards: number; newCards: number }[];
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
  /** The house owners' pack policy (owner 2026-11-02, option (a)): at the
   * start of each round, each queued house owner spends its credits on
   * packs of the season's set and opens every pack waiting, so its agent's
   * deck rebuilds from what it earned. Real owners' credits are never
   * touched. On by default; `false` turns it off (tests of the rest).
   * `packSeed` fixes each opened pack's seed (the demos). */
  housePacks?: false | { packSeed?: () => number };
  /** Called after each match is recorded (the demo moves its clock here). */
  afterMatch?: (m: LadderMatch) => void | Promise<void>;
  onEvent?: (e: LadderEvent) => void;
  /** A seat-rule variant under measurement (session 68, the first-seat
   * fixes): for the measuring instruments only. A replay doesn't record it
   * yet, so it can't be combined with `logDir`. */
  seatRules?: MatchRules;
}

export class Ladder {
  private readonly store: EconomyStore;
  private readonly seater: AgentSeater;
  private readonly random: Random;
  private readonly opts: LadderOptions;
  private readonly satOut = new Map<string, number>();
  private rounds = 0;
  /** (session 104) Player owners on auto-play at a round's start whose
   * switch this ladder hasn't yet seen go off: checked at the next round's
   * start, so one the owner switched off by hand gets a line, as the
   * server's own stops do. Starts empty: an owner switched off before this
   * ladder's first round isn't said. */
  private readonly onAutoPlay = new Set<string>();

  constructor(opts: LadderOptions) {
    if (opts.seatRules && !isShippedRules(opts.seatRules) && opts.logDir) throw new Error("seatRules is for measuring only: its replays wouldn't rebuild, so it can't write a logDir");
    this.opts = opts;
    this.store = opts.store;
    this.seater = opts.seater ?? houseSeater;
    this.random = seededRandom(opts.seed ?? Math.floor(Math.random() * 2 ** 32));
    if (opts.logDir) mkdirSync(opts.logDir, { recursive: true });
  }

  /** Owners who queue: house owners always; a player owner only while its
   * auto-play is on (owner app spec 2026-10-05 E). Either way with a
   * connected agent and not already in a live match. */
  eligibleOwners(): string[] {
    // (session 82) An ended season pairs nobody: its file is the archive.
    if (this.store.seasonEnded()) return [];
    const autoPlay = new Set(this.store.autoPlayOwners());
    return this.store
      .listOwners()
      .filter((o) => (o.kind === "house" || autoPlay.has(o.ownerId)) && o.connectedAgentId !== null && this.store.liveMatchOf(o.ownerId) === null)
      .map((o) => o.ownerId);
  }

  /** The house pack policy for one owner (see `housePacks`): buy with every
   * whole pack's worth of credits, then open every pack waiting. Null when
   * there was nothing to buy or open. */
  private houseShopping(ownerId: string): Extract<LadderEvent, { kind: "housePacks" }> | null {
    const policy = this.opts.housePacks ?? {};
    if (policy === false || this.store.getOwner(ownerId).kind !== "house") return null;
    const afford = Math.floor(this.store.balance(ownerId) / PACK_PRICE_CREDITS);
    if (afford > 0) this.store.buyPacks(ownerId, this.store.currentSetCode, afford);
    const waiting = this.store.unopenedPacks(ownerId);
    if (afford === 0 && waiting.length === 0) return null;
    let cards = 0;
    let newCards = 0;
    for (const pack of waiting) {
      const opening = this.store.openPack(ownerId, pack.packId, { seed: policy.packSeed?.() });
      cards += opening.cards.length;
      newCards += opening.cards.filter((c) => c.isNew).length;
    }
    return { kind: "housePacks", ownerId, bought: afford, opened: waiting.length, cards, newCards };
  }

  /** Last opponents of an owner, most recent first, from match history
   * (so a restart remembers them). (Session 87) Read by SQL, two rows: the
   * whole history's last two cost ~1.8 s of every round at Season 0's end
   * (progress/ladder-scale-001.txt). */
  private recentOpponents(ownerId: string): string[] {
    return this.store.recentOpponents(ownerId, 2);
  }

  private emit(e: LadderEvent): void {
    // The server's own stop is said by its event; it isn't the owner's.
    if (e.kind === "autoPlayStopped") this.onAutoPlay.delete(e.ownerId);
    this.opts.onEvent?.(e);
  }

  /** (session 104) Before a round is queued: every owner on auto-play at
   * the last round's start whose switch now reads off, with no stop by the
   * server today, was switched off by its owner. One still finishing its
   * last match on a time-up allowance still reads on and is checked again
   * next round (its stop, when written after the match, is the server's).
   * Then the owners on auto-play now are remembered for the next round. */
  private noteSwitchedOff(): void {
    for (const ownerId of [...this.onAutoPlay]) {
      const status = this.store.autoPlay(ownerId);
      if (status.on) continue;
      this.onAutoPlay.delete(ownerId);
      // A stop the server wrote that this ladder didn't make (another
      // process on the same file): not the owner's either.
      if (status.stopped !== null) continue;
      this.emit({ kind: "autoPlaySwitchedOff", ownerId, changedAt: status.changedAt });
    }
    for (const ownerId of this.store.autoPlayOwners()) this.onAutoPlay.add(ownerId);
  }

  /** One round: rebuild what needs it, pair, play and record every pair.
   * `queue` defaults to every eligible owner. `onPaired` (session 103, the
   * `npm run ladder` CLI's round line) is called once the round is paired,
   * before its matches are played; the report's `matches` are still empty
   * then. */
  async runRound(queue: readonly string[] = this.eligibleOwners(), onPaired?: (r: RoundReport) => void): Promise<RoundReport> {
    const { report, pairs } = await this.startRound(queue);
    onPaired?.(report);
    for (const p of pairs) {
      const played = await this.playPair(p);
      if (played === null) continue;
      const m = this.recordPlayed(played);
      report.matches.push(m);
      await this.opts.afterMatch?.(m);
    }
    return report;
  }

  /** A round up to the matches: the house owners shop, what needs it
   * rebuilds, the queue is paired. The pairs are returned to play (the
   * report's `matches` stay empty for the caller to fill). */
  async startRound(queue?: readonly string[]): Promise<{ report: RoundReport; pairs: Pairing[] }> {
    // (session 76) An allowance whose time ran out between rounds, with no
    // match to finish, is switched off here, so its owner hears of it; the
    // queue never held it either way (autoPlayOwners).
    for (const ownerId of this.store.stopAutoPlayTimeUp()) this.emit({ kind: "autoPlayStopped", ownerId, reason: "timeUp" });
    this.noteSwitchedOff();
    queue ??= this.eligibleOwners();
    if (this.store.seasonEnded()) queue = [];
    const report: RoundReport = { round: ++this.rounds, housePacks: [], rebuilt: [], excluded: [], pairs: [], sitOut: [], matches: [] };
    for (const ownerId of queue) {
      const shopped = this.houseShopping(ownerId);
      if (shopped === null) continue;
      report.housePacks.push(shopped);
      this.emit(shopped);
    }
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
    }
    return { report, pairs: round.pairs };
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

  /** Starts a pair's match in the store and plays it in the engine,
   * keeping its timeline. The store's live match stays open until
   * `recordPlayed`. Null when the store refused to start it. */
  async playPair(p: Pairing): Promise<PlayedMatch | null> {
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
    let timeline: Timeline | null = null;
    let replay: ReplayFile | null = null;
    const specs = { p1: { ...live.p1.deck.spec, id: "p1" as const }, p2: { ...live.p2.deck.spec, id: "p2" as const } };
    try {
      const [a1, a2] = [await seat("p1"), await seat("p2")];
      const recorder = timelineRecorder();
      timeline = recorder.timeline;
      const { state, movesPlayed } = await runMatch(specs.p1, specs.p2, a1, a2, seed, recorder.hooks, this.opts.seatRules);
      replay = makeReplay({
        matchId,
        seed,
        names: { p1: a1.name, p2: a2.name },
        moves: timeline.steps.map((s) => s.move),
        result: {
          outcome: state.winner ? (state.winner === "draw" ? "draw" : "win") : "cancelled",
          winner: state.winner ?? null,
          turns: state.turnNumber,
          moves: movesPlayed,
          finalHealth: { p1: state.players.p1.health, p2: state.players.p2.health },
        },
        // The loadouts can't change during a live match: these are the
        // coins the record keeps too.
        coins: { p1: coinOf(live.p1.loadout), p2: coinOf(live.p2.loadout) },
      }, specs, this.opts.seatRules);
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
      // What was played before the fault stays watchable (it ends where the
      // seat walked out); a replay file is only for a match that resolved.
      if (timeline !== null && timeline.steps.length === 0 && timeline.start === undefined) timeline = null;
      replay = null;
    }
    return { matchId, pairing: p, live, seed, outcome, note, turns, moves, finalHealth, log, timeline, replay };
  }

  /** Records a played match in the store (credits, ratings, the end of the
   * live match), writes its log and replay, and turns off the auto-play of
   * an owner whose day's rewards it maxed. */
  recordPlayed(played: PlayedMatch): LadderMatch {
    const { matchId, live, seed, outcome, turns, moves, finalHealth, log, replay, note } = played;
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
    let replayPath: string | null = null;
    // (session 92) The match is recorded by now: a log or replay that can't
    // be written (a full disk) is said and left out, as a replay that can't
    // be made is (makeReplay), and the match still counts.
    if (this.opts.logDir && log !== null) logPath = writeMatchFile(join(this.opts.logDir, `${matchId}.txt`), `${log}\n`, matchId, "log");
    if (this.opts.logDir && replay !== null) replayPath = writeMatchFile(join(this.opts.logDir, `${matchId}.replay.json`), `${JSON.stringify(replay)}\n`, matchId, "replay");
    // The rewards first: maxing them drops any allowance with the switch.
    const stops: { ownerId: string; reason: AutoPlayStopReason }[] = [];
    for (const ownerId of [record.p1OwnerId, record.p2OwnerId]) {
      if (this.store.stopAutoPlayIfMaxed(ownerId)) stops.push({ ownerId, reason: "dailyRewardsMaxed" });
      else if (this.store.stopAutoPlayIfTimeUp(ownerId)) stops.push({ ownerId, reason: "timeUp" });
    }
    const m: LadderMatch = { record, note, logPath, replayPath, autoPlayStopped: stops.map((x) => x.ownerId) };
    this.emit({ kind: "match", result: m });
    for (const stop of stops) this.emit({ kind: "autoPlayStopped", ...stop });
    return m;
  }
}

/** The replay file for a resolved match (`ai-tcg-replay/2`, replayFile.ts),
 * or null (with a warning) when it can't be written: the match still counts,
 * it just can't be replayed. Since session 70 the file carries every card in
 * full, so a deck card that isn't the registry's no longer stops it. */
function makeReplay(rest: Parameters<typeof makeReplayFile>[0], specs: { p1: DeckSpec; p2: DeckSpec }, rules?: MatchRules): ReplayFile | null {
  try {
    return makeReplayFile(rest, specs, rules);
  } catch (err) {
    console.warn(`[ladder] ${rest.matchId}: no replay: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Writes a match's log or replay, or warns and returns null when it can't
 * (the history then says the match has no log or replay). */
function writeMatchFile(path: string, text: string, matchId: string, what: "log" | "replay"): string | null {
  try {
    writeAtomic(path, text);
    return path;
  } catch (err) {
    console.warn(`[ladder] ${matchId}: no ${what} file: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Writes a file whole or not at all (a crash mid-write leaves no half log). */
function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}
