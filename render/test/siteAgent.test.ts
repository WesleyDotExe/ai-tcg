// My agent and Agent controls (render session 57; the owner's 2026-11-06
// Season 0 brief, section 1): the pure views at every size and state, then
// the same widgets over the real owner API with the game lane's ladder
// playing real matches on a clock the test moves (the rating, the streak,
// the personality dial applying from the next match, the deck switcher).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { LiveLadder } from "../../server/src/ladder/liveLadder.js";
import { siteApi, type SiteAutoPlay, type SiteHistoryRow, type SitePlay } from "../src/site/siteApi.js";
import {
  agentControlsHtml,
  deckOptions,
  dialHtml,
  dialView,
  myAgentHtml,
  ratingLine,
  ratingTrend,
  allowanceOf,
  ringPortraitHtml,
  streakOf,
  timeButtonsView,
  timeRingView,
  todayLine,
  trendSvg,
  type AgentWidgetData,
  type SiteRating,
} from "../src/site/siteAgent.js";
import { autoPlayView, myLiveMatch } from "../src/site/siteMatches.js";
import { widgetHtml, type WidgetData } from "../src/site/siteWidgets.js";
import type { SiteDaily } from "../src/site/siteBoard.js";

const AUTO: SiteAutoPlay = { on: true, changedAt: null, stopped: null, dailyRewardsMaxed: false, canTurnOn: true, house: false };
const STYLES = [
  { id: "calculator", name: "Calculator", summary: "Plays the numbers." },
  { id: "rusher", name: "Rusher", summary: "Goes face." },
  { id: "controller", name: "Controller", summary: "Answers everything." },
  { id: "tempo", name: "Tempo", summary: "Trades up." },
  { id: "fortress", name: "Fortress", summary: "Walls up." },
  { id: "gambler", name: "Gambler", summary: "Rolls the dice." },
];
const DECK = (id: string, over: Partial<SitePlay["decks"][number]> = {}) => ({ deckId: id, name: `Deck ${id}`, ownerId: "o", active: false, complete: true, missing: [], cards: 30, faction: "Swarm" as const, ...over });
const PLAY: SitePlay = {
  deckChoice: "forced", factionLock: null, lockableFactions: [], activeDeck: DECK("d1", { active: true }), agentDeck: null, rebuild: { reasons: [], job: null },
  connectedAgent: { agentId: "a1", name: "Vector <Halcyon>", playStyle: "tempo" }, agents: [], playStyles: STYLES,
  decks: [DECK("d1", { active: true }), DECK("d2", { complete: false, missing: [{ cardId: "x", uses: 2, owned: 0 }], faction: "Aegis" })],
  liveMatch: null, autoPlay: AUTO,
};
const RATING: SiteRating = {
  rating: { ownerId: "o", rating: 1561.7, rd: 88.2, volatility: 0.06, ratedMatches: 7, tier: "Gold", lastDay: "2026-11-05" },
  recent: [
    { matchId: "m3", endedAt: "", opponentOwnerId: "x", ownerId: "o", score: 1, before: { rating: 1540, rd: 90, volatility: 0.06 }, after: { rating: 1561.7, rd: 88.2, volatility: 0.06 } },
    { matchId: "m2", endedAt: "", opponentOwnerId: "x", ownerId: "o", score: 0, before: { rating: 1552, rd: 95, volatility: 0.06 }, after: { rating: 1540, rd: 90, volatility: 0.06 } },
    { matchId: "m1", endedAt: "", opponentOwnerId: "x", ownerId: "o", score: 1, before: { rating: 1530, rd: 99, volatility: 0.06 }, after: { rating: 1552, rd: 95, volatility: 0.06 } },
  ],
};
const ROW = (result: SiteHistoryRow["result"], i = 0): SiteHistoryRow => ({
  matchId: `h${i}`, endedAt: "2026-11-05T08:00:00.000Z", seat: "p1", result, credits: 10, rating: null, opponent: { ownerId: "x", ownerName: "Rook", agentName: "Foe" }, agentName: "Me", turns: 12, hasLog: true, hasReplay: true,
});
const DAILY = { wins: [{ nth: 1, matchId: "a", endedAt: "", credits: 20 }, { nth: 2, matchId: "b", endedAt: "", credits: 20 }], losses: 1 } as unknown as SiteDaily;
const DATA: AgentWidgetData = {
  play: PLAY, rating: RATING, daily: DAILY, history: { total: 3, more: false, matches: [ROW("win", 1), ROW("cancelled", 2), ROW("abandonedByOpponent", 3), ROW("loss", 4)] }, live: null,
  errors: {}, now: Date.parse("2026-11-05T09:00:00.000Z"),
};

describe("My agent and Agent controls: the views (pure)", () => {
  it("the rating line, placed and in placement; the trend from the recent list, oldest first", () => {
    expect(ratingLine(RATING)).toEqual({ value: "1562", tier: "Gold", rd: "±88", line: "Gold · 1562" });
    expect(ratingLine({ ...RATING, rating: { ...RATING.rating, tier: "Placement", ratedMatches: 1 } }).line).toBe("Placement · 1 rated match");
    const t = ratingTrend(RATING)!;
    expect(t.points).toEqual([1530, 1552, 1540, 1561.7]);
    expect(t).toMatchObject({ change: "+32", tone: "up", over: "over the last 3 rated matches" });
    expect(ratingTrend({ ...RATING, recent: RATING.recent.slice(0, 1) })).toBeNull();
    const step = (before: number, after: number) => ({ ...RATING.recent[0]!, before: { rating: before, rd: 1, volatility: 0 }, after: { rating: after, rd: 1, volatility: 0 } });
    const down = ratingTrend({ ...RATING, recent: [step(1580, 1550), step(1600, 1580)] })!;
    expect(down).toMatchObject({ points: [1600, 1580, 1550], change: "−50", tone: "down" });
    const svg = trendSvg(t, 200, 50);
    expect(svg).toContain('class="trend up"');
    expect(svg.match(/,/g)!.length).toBeGreaterThanOrEqual(t.points.length);
    expect(svg).not.toMatch(/NaN|undefined/);
    // A flat line (every point the same) still draws.
    expect(trendSvg({ points: [1500, 1500], change: "±0", tone: "flat", over: "" })).not.toMatch(/NaN|Infinity/);
  });

  it("the streak skips cancels, counts abandons as the rating does, and a draw ends it", () => {
    expect(streakOf([ROW("win"), ROW("cancelled"), ROW("abandonedByOpponent"), ROW("loss")])).toEqual({ kind: "W", n: 2, line: "2 wins in a row" });
    expect(streakOf([ROW("loss"), ROW("abandonedByYou"), ROW("loss"), ROW("win")])).toEqual({ kind: "L", n: 3, line: "Lost 3 in a row" });
    expect(streakOf([ROW("win"), ROW("draw"), ROW("win")])).toBeNull(); // a streak of one isn't shown
    expect(streakOf([ROW("draw"), ROW("win"), ROW("win")])).toBeNull();
    expect(streakOf([])).toBeNull();
    expect(todayLine(DAILY)).toEqual({ wins: 2, losses: 1, line: "2W 1L today" });
  });

  it("the time ring: every state the brief names, and auto-play as it is today when the server has no allowance", () => {
    const on = autoPlayView(AUTO, true);
    const A = (secondsTotal: number, secondsLeft: number, state: "running" | "finishing" | "done" = "running", endsAtReset = false) => ({ secondsTotal, secondsLeft, state, endsAtReset, canAddTime: true });
    expect(timeRingView(A(3600, 42 * 60), on, true)).toEqual({ pct: 70, centre: "42", unit: "min", caption: "42 min left today", tone: "run" });
    expect(timeRingView(A(3600, 9 * 60), on, false).tone).toBe("low");
    // Minutes round up, as the server's do: "1 min left" until the last second.
    expect(timeRingView(A(900, 61), on, false).centre).toBe("2");
    expect(timeRingView(A(900, 1), on, false)).toMatchObject({ centre: "1", pct: 1 });
    // A window cut at midnight Sydney says so.
    expect(timeRingView(A(1800, 1200, "running", true), on, false).caption).toBe("20 min left today · stops at midnight");
    // At zero: "Finishing match", then "Done for today".
    expect(timeRingView(A(1800, 0, "finishing"), on, true)).toMatchObject({ pct: 0, centre: "Finishing match", caption: "Time's up: your agent is finishing its last match." });
    expect(timeRingView(A(1800, 0, "done"), on, false)).toMatchObject({ pct: 0, centre: "Done for today", tone: "done" });
    // Drained to zero on the client before the server's next read: already "Finishing match".
    expect(timeRingView(A(900, 0), on, true).centre).toBe("Finishing match");
    // Time never runs past the ring.
    expect(timeRingView(A(900, 99 * 60), on, false).pct).toBe(100);
    // No allowance: on with no limit, off, stopped at the day's cap or at time up, a house agent.
    expect(timeRingView(null, on, false)).toMatchObject({ pct: 100, centre: "On", caption: "Auto-play on · no time limit set", tone: "open" });
    expect(timeRingView(null, autoPlayView({ ...AUTO, on: false }, true), true)).toMatchObject({ pct: 0, centre: "Off", caption: "Stopped · the match live finishes" });
    expect(timeRingView(null, autoPlayView({ ...AUTO, on: false, canTurnOn: false, stopped: { reason: "dailyRewardsMaxed", day: "d" } }, true), false).caption).toBe("Stopped: today's rewards are maxed");
    expect(timeRingView(null, autoPlayView({ ...AUTO, on: false, stopped: { reason: "timeUp", day: "d" } }, true), false).caption).toBe("Done for today: the time you gave ran out");
    expect(timeRingView(null, autoPlayView({ ...AUTO, house: true }, true), false).centre).toBe("Always");
    // The arc's lit length is the share of the time left.
    const h = ringPortraitHtml("Nova", "Cortex", timeRingView(A(3600, 1800), on, false), 80);
    const [lit, circ] = /stroke-dasharray="([\d.]+) ([\d.]+)"/.exec(h)!.slice(1).map(Number);
    expect(lit! / circ!).toBeCloseTo(0.5, 2);
    expect(h).toContain('aria-label="Nova: 30 min left"');
  });

  it("the allowance from GET /api/play: drains from the server's secondsLeft by the time since the read, never past zero, never changing state on its own", () => {
    const allowance = { state: "running" as const, startedAt: "", endsAt: "", totalMinutes: 30, secondsLeft: 600, minutesLeft: 10, endsAtReset: false };
    const ap: SiteAutoPlay = { ...AUTO, allowance, canAddTime: true, readAt: 1_000_000 };
    expect(allowanceOf(ap, 1_000_000)).toEqual({ secondsTotal: 1800, secondsLeft: 600, state: "running", endsAtReset: false, canAddTime: true });
    expect(allowanceOf(ap, 1_000_000 + 90_000)!.secondsLeft).toBe(510);
    expect(allowanceOf(ap, 1_000_000 + 900_000)).toMatchObject({ secondsLeft: 0, state: "running" });
    // A clock behind the read (another tab, a test) never adds time.
    expect(allowanceOf(ap, 999_000)!.secondsLeft).toBe(600);
    // Finishing and done hold at zero; an answer never stamped is read as is.
    expect(allowanceOf({ ...ap, allowance: { ...allowance, state: "finishing", secondsLeft: 0 } }, 5e6)).toMatchObject({ secondsLeft: 0, state: "finishing" });
    expect(allowanceOf({ ...ap, readAt: undefined }, 5e6)!.secondsLeft).toBe(600);
    // A window cut at midnight (25 min of 60 chosen) is its own length.
    expect(allowanceOf({ ...ap, allowance: { ...allowance, totalMinutes: 25, secondsLeft: 1500 } }, 1_000_000)).toMatchObject({ secondsTotal: 1500, secondsLeft: 1500 });
    // None: no time limit, off, an older server.
    expect(allowanceOf(AUTO, 0)).toBeNull();
    expect(allowanceOf({ ...AUTO, allowance: null }, 0)).toBeNull();
  });

  it("the time buttons: 15 / 30 / 60 start (or start over), +15 / +30 only while the server says time can be added", () => {
    const on = autoPlayView(AUTO, true);
    const run = { secondsTotal: 1800, secondsLeft: 900, state: "running" as const, endsAtReset: false, canAddTime: true };
    // No limit: start enabled, add refused with the reason.
    let v = timeButtonsView(on, null, false);
    expect(v.start.enabled).toBe(true);
    expect(v.add).toEqual({ enabled: false, title: "No time limit is set: start with 15, 30 or 60 minutes to add time." });
    v = timeButtonsView(autoPlayView({ ...AUTO, on: false }, true), null, false);
    expect(v.start).toEqual({ enabled: true, title: "Auto-play for that many minutes, then the agent finishes its match and stops." });
    expect(v.add.title).toBe("Start with 15, 30 or 60 minutes first.");
    // Running: both; a preset says it starts over.
    v = timeButtonsView(on, run, false);
    expect(v.start.title).toMatch(/^Starts over/);
    expect(v.add).toEqual({ enabled: true, title: "Adds to the time left." });
    // To midnight already: no adding. Finishing: adding plays on. Done: start again.
    expect(timeButtonsView(on, { ...run, canAddTime: false, endsAtReset: true }, false).add).toEqual({ enabled: false, title: "Today's time already runs to midnight (Sydney)." });
    expect(timeButtonsView(on, { ...run, state: "finishing", secondsLeft: 0 }, false).add).toEqual({ enabled: true, title: "Plays on: the agent is paired again next round." });
    const done = timeButtonsView(autoPlayView({ ...AUTO, on: false, stopped: { reason: "timeUp", day: "d" } }, true), { ...run, state: "done", secondsLeft: 0, canAddTime: false }, false);
    expect(done.start.enabled).toBe(true);
    expect(done.add.enabled).toBe(false);
    // Rewards maxed: nothing starts. A house agent: nothing at all. Busy: nothing pressable.
    expect(timeButtonsView(autoPlayView({ ...AUTO, on: false, canTurnOn: false }, true), null, false).start.enabled).toBe(false);
    expect(timeButtonsView(autoPlayView({ ...AUTO, house: true }, true), null, false).start.enabled).toBe(false);
    v = timeButtonsView(on, run, true);
    expect([v.start.enabled, v.add.enabled]).toEqual([false, false]);
  });

  it("the dial: one notch per play style, the pointer on the agent's, and a change applies from the next match", () => {
    const v = dialView(PLAY, null)!;
    expect(v.stops.map((s) => s.angle)).toEqual([0, 60, 120, 180, 240, 300]);
    expect(v.current.name).toBe("Tempo");
    expect(v.angle).toBe(180);
    expect(v.note).toBe("Applies from the next match.");
    expect(dialView(PLAY, "rusher")!.note).toBe("This match: Rusher. Tempo from the next match.");
    expect(dialView(PLAY, "tempo")!.note).toBe("A change applies from the next match.");
    expect(dialView({ ...PLAY, connectedAgent: null }, null)).toBeNull();
    const h = dialHtml(v);
    expect(h.match(/data-act="play-style"/g)).toHaveLength(6);
    expect(h.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(h).toContain('data-style="tempo" aria-pressed="true"');
    expect(h).toContain("rotate(180deg)");
    expect(dialHtml(v, { busy: true }).match(/ disabled/g)).toHaveLength(6);
  });

  it("the deck switcher: your agent picks, then each deck; the server's choice is the one on; an incomplete deck can't be picked", () => {
    const o = deckOptions(PLAY);
    expect(o.map((x) => [x.value, x.on, !!x.blocked])).toEqual([["agent", false, false], ["d1", true, false], ["d2", false, true]]);
    expect(o[2]!.detail).toBe("30 cards · 1 card missing");
    const agent = deckOptions({ ...PLAY, deckChoice: "agent", agentDeck: { ...DECK("d1"), builtFrom: null } });
    // The agent's own deck is the "your agent picks" row, not listed twice.
    expect(agent.map((x) => [x.value, x.on])).toEqual([["agent", true], ["d2", false]]);
    expect(agent[0]!.detail).toBe("Deck d1 · 30 cards");
  });

  it("each size shows more, not just bigger (the brief's table), escaped, with nothing undefined", () => {
    const sizes = ["S", "M", "L"] as const;
    for (const s of sizes) for (const f of [myAgentHtml, agentControlsHtml]) expect(f(s, DATA), `${f.name} ${s}`).not.toMatch(/undefined|NaN|\[object|>null<|<Halcyon>/);
    // My agent: S portrait, name, status, rating; M + today, streak, faction; L + trend and recent matches.
    const [s, m, l] = sizes.map((x) => myAgentHtml(x, DATA));
    expect(s).toContain("Vector &lt;Halcyon&gt;");
    expect(s).toContain("1562");
    expect(s).toContain("Ready");
    expect(s).not.toContain("today");
    expect(m).toContain('<b class="w">2W</b> <b class="l">1L</b> <small>today</small>');
    expect(m).toContain("2 wins in a row");
    expect(m).toContain("SWARM");
    expect(m).not.toContain("Rating trend");
    expect(l).toContain("Rating trend");
    expect(l).toContain('<svg class="trend up"');
    expect(l).toContain("Recent matches");
    expect(l.match(/class="hrow"/g)).toHaveLength(4);
    // Agent controls: S ring, status, Start/Stop; M + dial, time, deck, Go to match; L + switcher, history, +15/+30.
    const [cs, cm, cl] = sizes.map((x) => agentControlsHtml(x, DATA));
    expect(cs).toContain('class="tring t-open"');
    expect(cs).toContain('data-act="auto-play" data-on="0"');
    expect(cs).not.toContain("data-act=\"play-style\"");
    expect(cm.match(/data-act="play-style"/g)).toHaveLength(6);
    expect(cm).toMatch(/data-min="15" data-add="0" title="[^"]*">15 min/); // on, no limit: a preset can start a timed run
    expect(cm).toContain("No match live: joins the next ladder round");
    expect(cm).not.toContain('data-act="ctl-deck"');
    expect(cm).not.toContain('data-add="1"');
    expect(cl.match(/data-act="ctl-deck"/g)).toHaveLength(3);
    expect(cl).toMatch(/data-min="30" data-add="1" title="No time limit is set[^"]*" disabled/);
    expect(cl).toContain("Match history");
    // A match live: "Go to match"; stopped: Start.
    expect(agentControlsHtml("M", { ...DATA, play: { ...PLAY, liveMatch: { matchId: "m", startedAt: "" } } })).toContain('href="#/match">Go to match');
    expect(agentControlsHtml("S", { ...DATA, play: { ...PLAY, autoPlay: { ...AUTO, on: false } } })).toContain('data-act="auto-play" data-on="1"');
    // A read still out or failed says so, never a made-up number.
    const waiting = myAgentHtml("M", { ...DATA, rating: null, daily: null, errors: { daily: "down" } });
    expect(waiting).toContain("Rating: loading…");
    expect(waiting).toContain("Today couldn't be read");
    // The widget frame names the replacement.
    const wd = { play: PLAY, wallet: null, packs: null, collection: null, daily: DAILY, store: null, live: null, history: DATA.history, rating: RATING, ownerId: "o", errors: {}, now: DATA.now, colFilter: "All" } as WidgetData;
    expect(widgetHtml({ id: "w", type: "live", size: "M" }, wd, { editing: false })).toContain('<span class="wtt">Agent controls</span>');
  });
});

// ---- over the real owner API ----------------------------------------------------

const PW = "a long test password";
const running: (RunningOwnerApi | { close(): Promise<void> })[] = [];
afterEach(async () => {
  while (running.length) await running.pop()!.close();
});

describe("My agent and Agent controls over the real owner API, with the ladder playing", () => {
  it("the rating and streak are the server's; the dial's change applies from the next match; the deck switcher's choice is saved", async () => {
    const clock = { t: Date.parse("2026-11-05T00:00:00.000Z") };
    const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
    const owners = [
      { name: "Ada", login: "ada", agent: "Lattice Wren", faction: "Swarm" as const },
      { name: "Boris", login: "boris", agent: "Mote Engine", faction: "Aegis" as const },
    ].map((c) => {
      const o = store.createAccount({ name: c.name, username: c.login, password: PW });
      const { copies } = store.grantStarterCollection(o.ownerId, c.faction);
      const a = store.createAgent({ ownerId: o.ownerId, name: c.agent });
      const d = store.saveDeck(o.ownerId, `${c.faction} starter`, copies.map((x) => x.copyId));
      store.setActiveDeck(o.ownerId, d.deckId);
      store.connectAgent(o.ownerId, a.agentId);
      store.setAutoPlay(o.ownerId, true);
      return { ...o, agent: a };
    });
    const dir = mkdtempSync(join(tmpdir(), "site-agent-"));
    let n = 0;
    const live = new LiveLadder({ store, seed: 57, build: { games: 0 }, matchId: () => `t-${++n}`, logDir: dir, housePacks: false, now: () => clock.t, roundGapMs: 60_000 });
    await live.tick();
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 }, live, matchFiles: dir });
    running.push({ close: async () => rmSync(dir, { recursive: true, force: true }) });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const ada = (await client.signIn("ada", PW)).token;
    const playOut = async () => {
      for (let i = 0; i < 4000 && live.showing().length > 0; i++) {
        clock.t += 1000;
        await live.tick();
      }
    };
    const nextMatch = async () => {
      for (let i = 0; i < 400 && live.showing().length === 0; i++) {
        clock.t += 1000;
        await live.tick();
      }
    };
    // Three matches recorded.
    for (let k = 0; k < 3; k++) {
      await nextMatch();
      await playOut();
    }
    const [rating, ladder, history, daily] = await Promise.all([client.rating(ada, 20), fetch(`http://127.0.0.1:${api.port}/api/ladder`, { headers: { authorization: `Bearer ${ada}` } }).then((r) => r.json() as Promise<{ you: { rating: number; tier: string } }>), client.matches(ada, 20), client.daily(ada)]);
    expect(rating.recent.length).toBe(3);
    expect(ratingLine(rating).value).toBe(String(Math.round(ladder.you.rating)));
    expect(ratingLine(rating).tier).toBe(ladder.you.tier);
    const trend = ratingTrend(rating)!;
    expect(trend.points[trend.points.length - 1]).toBe(rating.rating.rating);
    expect(trend.points[0]).toBe(rating.recent[2]!.before.rating);
    // Today's W/L is the daily answer's; it adds up with the history's results today.
    const t = todayLine(daily);
    const rated = history.matches.filter((r) => r.result !== "cancelled");
    expect(t.wins + t.losses).toBe(rated.length);
    const streak = streakOf(history.matches);
    if (streak) expect(history.matches.slice(0, streak.n).every((r) => (streak.kind === "W" ? r.result === "win" || r.result === "abandonedByOpponent" : r.result === "loss" || r.result === "abandonedByYou"))).toBe(true);

    // The dial during a match: the style the match started with stays; the new one plays from the next match.
    await nextMatch();
    let l = await client.live(ada);
    const mine = myLiveMatch(l)!;
    expect(mine).not.toBeNull();
    const adaAgent = owners[0]!.agent.agentId;
    const side = mine.p1.agentId === adaAgent ? "p1" : "p2";
    const was = mine[side].playStyle;
    const next = was === "rusher" ? "fortress" : "rusher";
    let play = await client.setPlayStyle(ada, adaAgent, next); // what the dial's notch sends
    const html = agentControlsHtml("M", { play, rating, daily, history, live: l, errors: {}, now: clock.t });
    expect(html).toContain(`data-style="${next}" aria-pressed="true"`);
    const styleName = (id: string) => play.playStyles.find((s) => s.id === id)!.name;
    expect(html).toContain(`This match: ${styleName(was)}. ${styleName(next)} from the next match.`);
    expect(html).toContain('href="#/match">Go to match');
    l = await client.live(ada);
    expect(myLiveMatch(l)![side].playStyle).toBe(was); // unchanged mid-match
    await playOut();
    await nextMatch();
    l = await client.live(ada);
    const after = myLiveMatch(l)!;
    expect(after.matchId).not.toBe(mine.matchId);
    expect((after.p1.agentId === adaAgent ? after.p1 : after.p2).playStyle).toBe(next);

    // The deck switcher: "Your agent picks" (what its button sends), then back to the starter deck.
    const starter = play.activeDeck!.deckId;
    play = await client.setDeckChoice(ada, "agent");
    expect(deckOptions(play).find((o) => o.on)!.value).toBe("agent");
    play = await client.setActiveDeck(ada, starter);
    expect(deckOptions(play).find((o) => o.on)!.value).toBe(starter);
    expect((await client.play(ada)).deckChoice).toBe("forced");
    const htmlL = agentControlsHtml("L", { play, rating, daily, history, live: l, errors: {}, now: clock.t });
    expect(htmlL).toContain(`data-deck="${starter}" aria-pressed="true"`);
    expect(htmlL).not.toMatch(/undefined|NaN|>null</);
  }, 60_000);
});

describe("Agent controls' time ring over the real owner API (render session 58, on game session 76's allowance)", () => {
  it("15 minutes from the button: the ring drains, shows Finishing match in the last match, +15 plays on, then Done for today; the agent isn't paired again", async () => {
    const clock = { t: Date.parse("2026-11-05T00:00:00.000Z") }; // 11:00 Sydney
    const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
    const owners = [
      { name: "Ada", login: "ada", agent: "Lattice Wren", faction: "Swarm" as const },
      { name: "Boris", login: "boris", agent: "Mote Engine", faction: "Aegis" as const },
      { name: "Cyra", login: "cyra", agent: "Quiet Relay", faction: "Cortex" as const },
    ].map((c) => {
      const o = store.createAccount({ name: c.name, username: c.login, password: PW });
      const { copies } = store.grantStarterCollection(o.ownerId, c.faction);
      const a = store.createAgent({ ownerId: o.ownerId, name: c.agent });
      const d = store.saveDeck(o.ownerId, `${c.faction} starter`, copies.map((x) => x.copyId));
      store.setActiveDeck(o.ownerId, d.deckId);
      store.connectAgent(o.ownerId, a.agentId);
      if (c.login !== "ada") store.setAutoPlay(o.ownerId, true);
      return { ...o, agent: a };
    });
    const dir = mkdtempSync(join(tmpdir(), "site-time-"));
    let n = 0;
    const live = new LiveLadder({ store, seed: 58, build: { games: 0 }, matchId: () => `t-${++n}`, logDir: dir, housePacks: false, now: () => clock.t, roundGapMs: 60_000 });
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 }, live, matchFiles: dir });
    running.push({ close: async () => rmSync(dir, { recursive: true, force: true }) });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const ada = (await client.signIn("ada", PW)).token;
    const adaAgent = owners[0]!.agent.agentId;
    const adaOwner = owners[0]!.ownerId;
    const inAdasMatch = () => live.showing().some((m) => m.pairing.p1 === adaOwner || m.pairing.p2 === adaOwner);
    const ctl = async (size: "S" | "M" | "L") => {
      const play = await client.play(ada);
      const l = await client.live(ada);
      return { play, html: agentControlsHtml(size, { play, rating: null, daily: null, history: null, live: l, errors: {}, now: Date.now() }) };
    };

    // The "15 min" button sends PUT /api/play/auto-play { on: true, minutes: 15 }.
    const started = await client.setAutoPlay(ada, true, 15);
    expect(started.autoPlay.allowance).toMatchObject({ state: "running", totalMinutes: 15, secondsLeft: 900 });
    expect(started.autoPlay.readAt).toBeTypeOf("number");
    let { play, html } = await ctl("S");
    expect(allowanceOf(play.autoPlay, Date.now())).toMatchObject({ secondsTotal: 900, state: "running" });
    expect(html).toContain('class="tring t-run"');
    expect(html).toContain('aria-label="Lattice Wren: 15 min left"');

    // Five minutes on the server's clock: the ring is two thirds lit.
    const advance = async (ms: number) => {
      for (let t = 0; t < ms; t += 1000) {
        clock.t += 1000;
        await live.tick();
      }
    };
    await advance(5 * 60_000);
    ({ play, html } = await ctl("M"));
    expect(play.autoPlay.allowance!.minutesLeft).toBe(10);
    expect(html).toContain("10 min left today");
    const lit = (h: string) => { const [a, c] = /class="tr-fg"[^>]*stroke-dasharray="([\d.]+) ([\d.]+)"/.exec(h)!.slice(1).map(Number); return a! / c!; };
    expect(lit(html)).toBeCloseTo(10 / 15, 1);

    // Run the clock until time is up while Ada is in a match: Finishing match.
    let guard = 0;
    while (guard++ < 3600 && !(play.autoPlay.allowance?.state === "finishing")) {
      await advance(1000);
      if (play.autoPlay.allowance && play.autoPlay.allowance.secondsLeft === 0 && !inAdasMatch()) break;
      play = await client.play(ada);
    }
    const seenFinishing = play.autoPlay.allowance?.state === "finishing";
    // Seed 58 runs out mid-match (the path the ring must show); the
    // between-rounds path (straight to done) is game session 76's test.
    expect(seenFinishing).toBe(true);
    if (seenFinishing) {
      ({ play, html } = await ctl("L"));
      expect(html).toContain("Finishing match");
      expect(html).toContain("Time&#39;s up: your agent is finishing its last match.");
      expect(play.autoPlay.on).toBe(true);
      // +15 while finishing opens a new window: running again, paired again next round.
      expect(html).toMatch(/data-min="15" data-add="1" title="Plays on[^"]*">\+15 min/);
      const more = await client.addAutoPlayTime(ada, 15);
      expect(more.autoPlay.allowance).toMatchObject({ state: "running", totalMinutes: 15 });
      // Then let it run out for good.
      guard = 0;
      while (guard++ < 3600) {
        await advance(1000);
        play = await client.play(ada);
        if (play.autoPlay.allowance?.state === "done") break;
      }
    } else {
      // Time ran out between rounds: straight to done (a real path, game session 76).
      play = await client.play(ada);
    }
    // Play out whatever match is left, then read: Done for today.
    for (let i = 0; i < 4000 && inAdasMatch(); i++) await advance(1000);
    ({ play, html } = await ctl("L"));
    expect(play.autoPlay.on).toBe(false);
    expect(play.autoPlay.stopped?.reason).toBe("timeUp");
    expect(play.autoPlay.allowance?.state).toBe("done");
    expect(html).toContain('class="tring t-done"');
    expect(html).toContain("Done for today");
    expect(html).toContain("the time you gave your agent ran out");
    expect(html).toMatch(/data-min="15" data-add="1" title="Done for today[^"]*" disabled/);
    expect(html).toMatch(/data-min="30" data-add="0" title="Auto-play for that many minutes[^"]*">30 min/);
    expect(html).not.toMatch(/undefined|NaN|>null</);
    // Not paired again: ten more minutes of rounds without Ada.
    for (let i = 0; i < 600; i++) {
      await advance(1000);
      expect(inAdasMatch()).toBe(false);
    }
    // +15 on a done allowance is refused in the server's words.
    await expect(client.addAutoPlayTime(ada, 15)).rejects.toMatchObject({ status: 409 });
  }, 120_000);
});
