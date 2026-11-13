// The long-lived ladder (Season 0 game item 1, session 67): the ladder
// running inside the server process, round after round, each match shown at
// watch speed before it counts.
//
// A round: the house owners shop (their pack policy), agent decks rebuild
// where they need it, the queue is paired (Ladder.startRound), and every
// pair's match is played in the engine at once (Ladder.playPair), which
// takes well under a second. Then each match is *released* a move at a
// time on the watch-speed clock (timeline.ts: about 5-6 minutes for a
// typical match at 1x), and that release is what Watch live and the Live
// match widget read. When the last move's hold has passed, the match is
// recorded (Ladder.recordPlayed): only then do credits, ratings and the
// match history change, so nothing about the result shows anywhere before
// the viewers see it happen. The next round starts a gap after the round's
// last match ends.
//
// While a match is shown, the store holds it as live (startMatch), so its
// owners can't switch agents or loadouts mid-match, exactly as for a match
// played any other way.
//
// A restart mid-match: the matches being shown are in memory only. On
// start, any match the store still holds as live (from a process that
// stopped while showing it) is recorded as cancelled, "the server restarted
// mid-match": nobody's fault, so no credits and no rating, as for any
// cancel. (Proposed session 67, owner check-in item; replaying it from the
// seed would also work for in-process agents, but not for a network agent,
// which can't be asked to play the same match again.)
//
// The 2× vote (session 73, speedVote.ts): each match carries its own vote,
// reset every match. While both sides agree, every hold is half as long;
// a change part-way through a hold shortens or lengthens only what is left
// of it. The pace is all it changes: the match was decided before its first
// move was released.
//
// Featured picks and viewer counts (session 74, featured.ts, viewers.ts):
// the Top rated group is worked out from the live matches' starting
// ratings and tiers on every read; a viewer is an owner reading the match's
// feed in the last 30 s, kept in memory and dropped when the match is
// recorded.
//
// The clock is injected (`now`), and `tick()` does all the work for one
// moment, so tests and the demo run hours of ladder in milliseconds. The
// real server calls `start()`, which ticks on a timer.

import { coinOf, defaultPointOfView, type EconomyStore, type MatchBoast } from "@ai-tcg/economy";
import { deckFaction, type DeckFaction } from "@ai-tcg/engine";
import { Ladder, type LadderMatch, type LadderOptions, type PlayedMatch, type RoundReport } from "./ladderRunner.js";
import type { Pairing } from "./pairing.js";
import { rateOf, rescaleRemaining, speedView, startingVote, type SpeedRate, type SpeedView, type SpeedVote } from "./speedVote.js";
import { stepHoldMs, WATCH_PACE_MS, watchLengthMs, type PublicSnapshot, type TimelineStep } from "./timeline.js";
import { featuredPicks, type FeaturedOptions, type FeaturedPicks } from "./featured.js";
import { ViewerCounter } from "./viewers.js";

export interface LiveLadderOptions extends LadderOptions {
  /** The clock, in ms since the epoch. Default `Date.now`. */
  now?: () => number;
  /** The pause between a round's last match ending and the next round
   * (default 60 s). */
  roundGapMs?: number;
  /** How long to wait before trying again when nobody could be paired
   * (default 60 s). */
  idleRetryMs?: number;
  /** How often `start()` ticks (default 250 ms). */
  tickMs?: number;
  /** Called with each round as it starts (its report's matches empty). */
  onRound?: (r: RoundReport) => void;
  /** Called after each shown match is recorded. */
  onRecorded?: (m: LadderMatch, shown: { startedAt: number; endedAt: number }) => void;
  /** The Top rated rule's options (featured.ts; default: 3 matches, no
   * rating floor). */
  featured?: FeaturedOptions;
  /** How long after its last feed read an owner counts as watching
   * (default VIEWER_WINDOW_MS, 30 s). */
  viewerWindowMs?: number;
}

/** One side of a live match, for the Watch live list. */
export interface LiveSideView {
  ownerId: string;
  ownerName: string;
  agentId: string;
  agentName: string;
  playStyle: string;
  /** The owner's rating as the match started. */
  rating: number;
  tier: string;
  /** (v20) The coin this side flips (its equipped coin, else the Chrome
   * Token) and its arena background (null: none equipped). Both are sent so
   * a spectator can switch point of view (owner 2026-11-02). */
  coin: string;
  arena: string | null;
  /** (session 72) The faction of the deck this side plays (one faction
   * plus neutral cards), known from the start. */
  faction: DeckFaction;
}

/** A live match as Watch live and the Live match widget read it. */
export interface LiveMatchView {
  matchId: string;
  startedAt: string;
  /** Moves released so far. */
  released: number;
  /** When the next move is released (null once the last one is out and
   * the match is about to be recorded). */
  nextAt: string | null;
  p1: LiveSideView;
  p2: LiveSideView;
  /** Whose point of view a spectator who owns neither agent starts on: the
   * higher-rated side as the match started, p1 on a tie. */
  defaultView: "p1" | "p2";
  /** The board now (after the last released move). */
  now: PublicSnapshot;
  /** The last few log lines released, oldest first. */
  recentLines: string[];
  /** (session 72) The boast that plays, once the last move is out (while
   * the result holds, before the match is recorded): the one the record
   * will keep, by the same rule (the store's matchBoast). Null before
   * then, and for a match that ends without a winner. */
  boast: MatchBoast | null;
  /** (session 73) The 2× vote: the pace now and who asks. `nextAt` is
   * already at this pace. */
  speed: SpeedView;
  /** (session 74) How many signed-in owners are watching: each owner that
   * read this match's feed in the last 30 s, once however many tabs, the
   * two players' owners included (viewers.ts). */
  viewers: number;
}

/** A live match with the released moves from `from` on (the render's feed:
 * fetch from 0, then from `released` each time). */
export interface LiveMatchFeed extends LiveMatchView {
  /** The board before the first move; only when `from` is 0. */
  start: PublicSnapshot | null;
  startLines: string[] | null;
  /** (session 72) Each side's opening hand, by card id in hand order; only
   * when `from` is 0, beside `start`. Sent because every match this ladder
   * shows was decided in the engine before its first move was released
   * (owner 2026-11-03: spectators see hands live, face up, as replays do).
   * A seat played by a network agent in real time must not get this (the
   * owner's safety rule; built when network agents join the ladder). */
  openingHands: { p1: string[]; p2: string[] } | null;
  from: number;
  steps: TimelineStep[];
}

/** Read access to what is live, for the owner API. */
export interface LiveSource {
  liveMatches(): LiveMatchView[];
  /** The feed from `from` on. `viewer`, when given, is the owner reading
   * it: it counts as watching (and is in the answer's `viewers`). */
  liveMatch(matchId: string, from?: number, viewer?: string): LiveMatchFeed | null;
  /** (session 74) Watch live's featured groups, as match ids in order. */
  featured(): FeaturedPicks;
  liveMatchOf(ownerId: string): string | null;
  /** (session 82) Open, ending or ended. */
  seasonState(): SeasonState;
  /** (session 82) Ends the season: no new round starts; once the matches
   * being shown are recorded, the store ends it (endSeason). At once when
   * nothing is live. */
  endSeason(): Promise<SeasonState>;
  /** (session 73) The owner's "Ask for 2×" in a live match it plays in:
   * `ask` true asks, false takes the ask back. */
  askForSpeed(matchId: string, ownerId: string, ask: boolean): SpeedAskResult;
}

/** (session 82) Where the season stands, as the live ladder sees it:
 * open; ending (no new round starts, the matches being shown finish, then
 * the season ends); or ended. */
export type SeasonState = "open" | "ending" | "ended";

/** Why an ask wasn't taken, or the vote after it. */
export type SpeedAskResult =
  | { ok: true; speed: SpeedView; nextAt: string | null }
  | { ok: false; reason: "notLive" | "notYourMatch" | "house" };

interface Shown {
  played: PlayedMatch;
  startedAt: number;
  sides: { p1: LiveSideView; p2: LiveSideView };
  /** The boast the record will keep, worked out when the match is first
   * shown (the loadouts and decks can't change while it is live), sent
   * only once the last move is out. */
  boast: MatchBoast | null;
  /** Moves released so far. */
  released: number;
  /** When the next move is released; after the last, when the match is
   * recorded. At the pace `rate`. */
  nextAt: number;
  /** The 2× vote, and the pace it gives. */
  vote: SpeedVote;
  rate: SpeedRate;
  /** (session 92) Failed tries at recording it so far (it stays shown,
   * held at its end, until one succeeds). */
  recordTries: number;
}

const RECENT_LINES = 6;

/** (session 92) After a failed try at recording a finished match, the wait
 * before the next: 30 s, doubling to at most 10 minutes. */
export const RECORD_RETRY_MS = { first: 30_000, max: 10 * 60_000 } as const;

export class LiveLadder implements LiveSource {
  readonly ladder: Ladder;
  private readonly store: EconomyStore;
  private readonly opts: LiveLadderOptions;
  private readonly now: () => number;
  private readonly shown = new Map<string, Shown>();
  private readonly viewers: ViewerCounter;
  private nextRoundAt: number;
  private busy: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private recovered = false;
  private ending = false;

  constructor(opts: LiveLadderOptions) {
    this.opts = opts;
    this.store = opts.store;
    this.now = opts.now ?? Date.now;
    this.ladder = new Ladder(opts);
    this.viewers = new ViewerCounter(opts.viewerWindowMs);
    this.nextRoundAt = this.now();
  }

  /** Records any match the store holds as live from a stopped process as
   * cancelled. Runs once, before the first round (tick does it). Returns
   * the match ids it closed. */
  recoverOrphans(): string[] {
    this.recovered = true;
    const closed: string[] = [];
    for (const m of this.store.liveMatches()) {
      if (this.shown.has(m.matchId)) continue;
      this.store.recordMatch({ matchId: m.matchId, seed: 0, p1AgentId: m.p1AgentId, p2AgentId: m.p2AgentId, outcome: { kind: "cancelled" } });
      closed.push(m.matchId);
    }
    return closed;
  }

  /** Does everything due at this moment: release moves, record finished
   * matches, start the next round. Calls never overlap (a second call while
   * one runs waits for it). */
  async tick(): Promise<void> {
    while (this.busy) await this.busy;
    this.busy = this.doTick();
    try {
      await this.busy;
    } finally {
      this.busy = null;
    }
  }

  private async doTick(): Promise<void> {
    if (!this.recovered) this.recoverOrphans();
    const now = this.now();
    for (const [id, s] of this.shown) {
      const steps = this.release(s, now);
      if (s.released >= steps && now >= s.nextAt) {
        let m: LadderMatch | null = null;
        try {
          m = this.ladder.recordPlayed(s.played);
        } catch (err) {
          // (session 92) Recording is one transaction that also ends the
          // live match (the store's recordMatch), so a match the store
          // still holds as live was not recorded: keep it (held at its
          // end) and try again later. Dropping it here, as before, left
          // its owners live in the store with nothing showing the match,
          // so neither was ever paired again until a restart.
          const why = err instanceof Error ? err.message : String(err);
          if (this.store.liveMatches().some((x) => x.matchId === id)) {
            const wait = Math.min(RECORD_RETRY_MS.first * 2 ** s.recordTries, RECORD_RETRY_MS.max);
            s.recordTries++;
            s.nextAt = now + wait;
            console.error(`[ladder] couldn't record ${id} (${why}); it stays live and is tried again in ${wait / 1000} s (try ${s.recordTries})`);
            continue;
          }
          // Recorded; what failed came after (it is said, and the match
          // is done with).
          console.error(`[ladder] ${id} was recorded, but what follows recording it failed: ${why}`);
        }
        this.shown.delete(id);
        this.viewers.forget(id);
        if (m !== null) this.opts.onRecorded?.(m, { startedAt: s.startedAt, endedAt: now });
        if (this.shown.size === 0) this.nextRoundAt = now + (this.opts.roundGapMs ?? 60_000);
      }
    }
    // (session 94; owner 2026-11-13) The server ends the season at its end
    // time: from then no round starts, the matches being shown finish and
    // are recorded, then the season ends (as the admin's end call does). A
    // server started after the end time ends it on its first tick.
    if (!this.ending && this.store.seasonEndDue(new Date(now).toISOString())) {
      this.ending = true;
      const schedule = this.store.seasonSchedule()!;
      this.opts.onEvent?.({ kind: "seasonEndTime", season: this.store.season, endsAt: schedule.endsAt, live: this.shown.size });
    }
    if (this.ending && this.shown.size === 0) {
      this.finishSeason();
      return;
    }
    if (this.shown.size === 0 && now >= this.nextRoundAt && !this.store.seasonEnded()) await this.startRound(now);
  }

  /** The store ends the season now that nothing is live. */
  private finishSeason(): void {
    this.ending = false;
    if (this.store.seasonEnded()) return;
    const end = this.store.endSeason(new Date(this.now()).toISOString());
    this.opts.onEvent?.({
      kind: "seasonEnded",
      season: end.season,
      endedAt: end.endedAt,
      standings: end.standings.length,
      retiredCopies: end.retiredPrototypes.reduce((n, r) => n + r.retired, 0),
    });
  }

  seasonState(): SeasonState {
    if (this.store.seasonEnded()) return "ended";
    return this.ending ? "ending" : "open";
  }

  async endSeason(): Promise<SeasonState> {
    if (this.store.seasonEnded()) return "ended";
    this.ending = true;
    // A tick ends it at once when nothing is shown; otherwise the tick that
    // records the last shown match does.
    await this.tick();
    return this.seasonState();
  }

  /** Releases every move due by `now`, each hold at the match's pace.
   * Returns the match's move count. */
  private release(s: Shown, now: number): number {
    const steps = s.played.timeline?.steps.length ?? 0;
    while (s.released < steps && now >= s.nextAt) {
      s.released++;
      s.nextAt += (s.released < steps ? stepHoldMs(s.played.timeline!, s.released) : WATCH_PACE_MS.end) / s.rate;
    }
    return steps;
  }

  private async startRound(now: number): Promise<void> {
    const { report, pairs } = await this.ladder.startRound();
    this.opts.onRound?.(report);
    // The round's rebuilds may have taken real time; the matches start now.
    const at = Math.max(now, this.now());
    for (const p of pairs) {
      const played = await this.ladder.playPair(p);
      if (played === null) continue;
      if (played.timeline === null || played.timeline.steps.length === 0) {
        // Nothing to show (a seat never seated, an engine error): it counts
        // at once.
        const m = this.ladder.recordPlayed(played);
        this.opts.onRecorded?.(m, { startedAt: at, endedAt: at });
        continue;
      }
      const vote = startingVote({ p1: this.voter(played, "p1"), p2: this.voter(played, "p2") });
      const rate = rateOf(vote);
      this.shown.set(played.matchId, {
        played,
        startedAt: at,
        sides: { p1: this.side(played, "p1"), p2: this.side(played, "p2") },
        boast: this.boastOf(played),
        released: 0,
        nextAt: at + stepHoldMs(played.timeline, 0) / rate,
        vote,
        rate,
        recordTries: 0,
      });
    }
    if (this.shown.size === 0) this.nextRoundAt = at + (pairs.length === 0 ? (this.opts.idleRetryMs ?? 60_000) : (this.opts.roundGapMs ?? 60_000));
  }

  /** Whether a side is a house owner, and whether its owner asks for 2× in
   * every match (Settings -> Play), as the match starts. */
  private voter(played: PlayedMatch, seat: "p1" | "p2"): { house: boolean; askEveryMatch: boolean } {
    const ownerId = played.live[seat].ownerId;
    const house = this.store.getOwner(ownerId).kind === "house";
    return { house, askEveryMatch: !house && this.store.accountSettings(ownerId).ask2xEveryMatch };
  }

  private side(played: PlayedMatch, seat: "p1" | "p2"): LiveSideView {
    const live = played.live[seat];
    const owner = this.store.getOwner(live.ownerId);
    const agent = this.store.getAgent(live.agentId);
    const r = this.store.rating(live.ownerId);
    return {
      ownerId: owner.ownerId,
      ownerName: owner.name,
      agentId: agent.agentId,
      agentName: agent.name,
      playStyle: live.playStyle,
      rating: played.live.ratingsAtStart?.[seat] ?? r.rating,
      tier: r.tier,
      coin: coinOf(live.loadout),
      arena: live.loadout.arena,
      faction: deckFaction(live.deck.spec.cards),
    };
  }

  /** The boast a played match's record will keep: the store's own rule on
   * the winner's loadout, deck and final health. */
  private boastOf(played: PlayedMatch): MatchBoast | null {
    if (played.outcome.kind !== "win") return null;
    const seat = played.live.p1.agentId === played.outcome.winnerAgentId ? "p1" : "p2";
    const side = played.live[seat];
    return this.store.matchBoast(side.agentId, side.loadout, side.deck.deckId, played.finalHealth?.[seat] ?? null);
  }

  private view(s: Shown, at: number = this.now()): LiveMatchView {
    const t = s.played.timeline!;
    const released = t.steps.slice(0, s.released);
    const lines = [...t.startLines, ...released.flatMap((x) => x.lines)];
    return {
      matchId: s.played.matchId,
      startedAt: new Date(s.startedAt).toISOString(),
      released: s.released,
      nextAt: s.released < t.steps.length ? new Date(s.nextAt).toISOString() : null,
      p1: s.sides.p1,
      p2: s.sides.p2,
      defaultView: defaultPointOfView({ p1: s.sides.p1.rating, p2: s.sides.p2.rating }),
      now: s.released === 0 ? t.start : t.steps[s.released - 1]!.after,
      recentLines: lines.slice(-RECENT_LINES),
      boast: s.released >= t.steps.length ? s.boast : null,
      speed: speedView(s.vote),
      viewers: this.viewers.count(s.played.matchId, at),
    };
  }

  liveMatches(): LiveMatchView[] {
    return [...this.shown.values()].sort((a, b) => a.startedAt - b.startedAt).map((s) => this.view(s));
  }

  liveMatch(matchId: string, from = 0, viewer?: string): LiveMatchFeed | null {
    const s = this.shown.get(matchId);
    if (!s) return null;
    const at = this.now();
    if (viewer !== undefined) this.viewers.saw(matchId, viewer, at);
    const t = s.played.timeline!;
    const start = Math.min(Math.max(0, from), s.released);
    return {
      ...this.view(s, at),
      start: start === 0 ? t.start : null,
      startLines: start === 0 ? t.startLines : null,
      openingHands: start === 0 ? t.openingHands : null,
      from: start,
      steps: t.steps.slice(start, s.released),
    };
  }

  featured(): FeaturedPicks {
    return featuredPicks(this.liveMatches(), this.opts.featured);
  }

  liveMatchOf(ownerId: string): string | null {
    for (const s of this.shown.values()) if (s.sides.p1.ownerId === ownerId || s.sides.p2.ownerId === ownerId) return s.played.matchId;
    return null;
  }

  askForSpeed(matchId: string, ownerId: string, ask: boolean): SpeedAskResult {
    const s = this.shown.get(matchId);
    if (!s) return { ok: false, reason: "notLive" };
    const seat = s.sides.p1.ownerId === ownerId ? "p1" : s.sides.p2.ownerId === ownerId ? "p2" : null;
    if (seat === null) return { ok: false, reason: "notYourMatch" };
    if (s.vote.house[seat]) return { ok: false, reason: "house" };
    // Moves already due are released at the old pace first, so the change
    // starts from this moment, not from the last tick.
    const now = this.now();
    this.release(s, now);
    s.vote.asks[seat] = ask;
    const rate = rateOf(s.vote);
    if (rate !== s.rate) {
      s.nextAt = now + rescaleRemaining(Math.max(0, s.nextAt - now), s.rate, rate);
      s.rate = rate;
    }
    const steps = s.played.timeline!.steps.length;
    return { ok: true, speed: speedView(s.vote), nextAt: s.released < steps ? new Date(s.nextAt).toISOString() : null };
  }

  /** The pairs being shown, for the demo's account of a round. */
  showing(): { matchId: string; pairing: Pairing; lengthMs: number }[] {
    return [...this.shown.values()].map((s) => ({ matchId: s.played.matchId, pairing: s.played.pairing, lengthMs: watchLengthMs(s.played.timeline!) }));
  }

  /** Ticks on a timer until `stop()`. */
  start(): void {
    if (this.timer) return;
    const every = this.opts.tickMs ?? 250;
    let last = this.now();
    this.timer = setInterval(() => {
      // (session 92) Said once when it happens, so the log explains a
      // stretch with no matches or a round that ended all at once.
      const line = clockJumpLine(last, this.now(), every);
      if (line !== null) console.warn(line);
      last = this.now();
      this.tick().catch((err) => console.error("[ladder] tick failed:", err));
    }, every);
  }

  /** Stops ticking and waits for a tick in progress. Matches being shown
   * stay live in the store; the next start cancels them (recoverOrphans). */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    while (this.busy) await this.busy;
  }
}

/** (session 92) The line the running ladder prints when the clock moved
 * unlike a timer ticking every `tickMs`, or null. Forward by more than a
 * minute: the machine slept, or the process was paused, or the clock was
 * set ahead; every move due in the gap comes out at once, so a match being
 * shown ends at once. Back by more than a second: the clock was set back;
 * nothing new is released until it catches up (session 89). */
export function clockJumpLine(before: number, after: number, tickMs: number): string | null {
  const gap = after - before;
  const mins = (ms: number) => (ms >= 120_000 ? `${Math.round(ms / 60_000)} minutes` : `${Math.round(ms / 1000)} s`);
  if (gap > 60_000 + tickMs) return `[ladder] the clock moved ahead ${mins(gap)} since the last tick (the machine slept, or its clock was changed): moves due in that time are shown at once`;
  if (gap < -1_000) return `[ladder] the clock went back ${mins(-gap)} (it was changed): no move is shown until it catches up`;
  return null;
}
