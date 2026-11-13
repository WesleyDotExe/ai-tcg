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
  allowanceOf,
  DIAL_SAVE_MS,
  dialChoose,
  deckOptions,
  dialHtml,
  dialView,
  myAgentHtml,
  ratingLine,
  ratingTrend,
  dialKeyTarget,
  ringOfPlay,
  ringParts,
  ringPortraitHtml,
  ringTicks,
  statusPollMs,
  streakOf,
  timeRingView,
  todayLine,
  trendSvg,
  type AgentWidgetData,
  type SiteRating,
} from "../src/site/siteAgent.js";
import { autoPlayView, myLiveMatch } from "../src/site/siteMatches.js";
import { esc } from "../src/site/siteModel.js";
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
  allowance: null, errors: {}, now: Date.parse("2026-11-05T09:00:00.000Z"),
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
    expect(timeRingView({ minutesTotal: 60, minutesLeft: 42, state: "running" }, on, true)).toEqual({ pct: 70, centre: "42", unit: "min", caption: "42 min left today", tone: "run" });
    expect(timeRingView({ minutesTotal: 60, minutesLeft: 9, state: "running" }, on, false).tone).toBe("low");
    // At zero: "Finishing match", then "Time's up" (owner 2026-11-06).
    expect(timeRingView({ minutesTotal: 30, minutesLeft: 0, state: "finishing" }, on, true)).toMatchObject({ pct: 0, centre: "Finishing match", caption: "Time's up: your agent is finishing its last match." });
    expect(timeRingView({ minutesTotal: 30, minutesLeft: 0, state: "done" }, on, false)).toMatchObject({ pct: 0, centre: "Time's up", tone: "done" });
    // The server's words win over the ring's own (render 69, `allowance.label`)...
    expect(timeRingView({ minutesTotal: 30, minutesLeft: 0, state: "done", label: "Out of time" }, on, false).centre).toBe("Out of time");
    expect(timeRingView({ minutesTotal: 30, minutesLeft: 0, state: "finishing", label: "Last match" }, on, true).centre).toBe("Last match");
    // ...but only for the state they were sent with: a running allowance the
    // page's count took to zero says "Finishing match", not "Running".
    expect(timeRingView({ minutesTotal: 30, minutesLeft: 0, secondsLeft: 0, state: "running", label: "Running" }, on, true).centre).toBe("Finishing match");
    expect(timeRingView({ minutesTotal: 30, minutesLeft: 12, state: "running", label: "Running" }, on, false).centre).toBe("12");
    // (game session 94) Waiting for the first pairing: full, the server's words, not counting down.
    const waiting = { state: "waiting" as const, label: "Waiting for the next round", startedAt: null, endsAt: null, totalMinutes: 15, secondsLeft: 900, minutesLeft: 15, endsAtReset: false };
    const w = allowanceOf({ ...AUTO, on: true, allowance: waiting, canAddTime: true }, Date.parse("2026-12-05T00:00:00.000Z"));
    expect(w).toMatchObject({ state: "waiting", minutesTotal: 15, minutesLeft: 15, secondsLeft: 900 });
    expect(timeRingView(w, on, false)).toEqual({ pct: 100, centre: "Waiting for the next round", unit: null, caption: "15 min, counted from your agent's first match", tone: "run" });
    // Minutes never run past the ring.
    expect(timeRingView({ minutesTotal: 15, minutesLeft: 99, state: "running" }, on, false).pct).toBe(100);
    // No allowance: on with no limit, off, stopped at the day's cap, a house agent.
    expect(timeRingView(null, on, false)).toMatchObject({ pct: 100, centre: "On", caption: "Auto-play on · no time limit set", tone: "open" });
    expect(timeRingView(null, autoPlayView({ ...AUTO, on: false }, true), true)).toMatchObject({ pct: 0, centre: "Off", caption: "Stopped · the match live finishes" });
    expect(timeRingView(null, autoPlayView({ ...AUTO, on: false, canTurnOn: false, stopped: { reason: "dailyRewardsMaxed", day: "d" } }, true), false).caption).toBe("Stopped: today's rewards are maxed");
    expect(timeRingView(null, autoPlayView({ ...AUTO, house: true }, true), false).centre).toBe("Always");
    // The arc's lit length is the share of the time left.
    const h = ringPortraitHtml("Nova", "Cortex", timeRingView({ minutesTotal: 60, minutesLeft: 30, state: "running" }, on, false), 80);
    const [lit, circ] = /stroke-dasharray="([\d.]+) ([\d.]+)"/.exec(h)!.slice(1).map(Number);
    expect(lit! / circ!).toBeCloseTo(0.5, 2);
    expect(h).toContain('aria-label="Nova: 30 min left"');
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
    // A radio group (render session 59): one notch checked, one tab stop.
    expect(h).toContain('role="radiogroup" aria-label="Personality dial"');
    expect(h.match(/role="radio"/g)).toHaveLength(6);
    expect(h.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(h).toContain('data-style="tempo" role="radio" aria-checked="true" tabindex="0"');
    expect(h.match(/tabindex="0"/g)).toHaveLength(1);
    expect(h.match(/tabindex="-1"/g)).toHaveLength(5);
    expect(h).toContain("rotate(180deg)");
    expect(dialHtml(v, { busy: true }).match(/ disabled/g)).toHaveLength(6);
    // An arrow's choice shown before it is saved (render 69): pointer, notch
    // and name move; the note and the saved view stay; an unknown style is a no-op.
    const c = dialChoose(v, "rusher");
    expect(c.angle).toBe(v.stops.find((s) => s.id === "rusher")!.angle);
    expect(c.current.name).toBe("Rusher");
    expect(c.stops.filter((s) => s.on).map((s) => s.id)).toEqual(["rusher"]);
    expect(c.note).toBe(v.note);
    expect(v.current.name).toBe("Tempo");
    expect(dialChoose(v, "nope")).toBe(v);
    expect(dialHtml(c)).toContain('data-style="rusher" role="radio" aria-checked="true" tabindex="0"');
    expect(DIAL_SAVE_MS).toBeGreaterThanOrEqual(400);
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
    expect(cm).toMatch(/data-min="15" data-add="0" disabled/);
    expect(cm).toContain("No match live: joins the next ladder round");
    expect(cm).not.toContain('data-act="ctl-deck"');
    expect(cm).not.toContain('data-add="1"');
    expect(cl.match(/data-act="ctl-deck"/g)).toHaveLength(3);
    expect(cl).toMatch(/data-min="30" data-add="1" disabled/);
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
    const html = agentControlsHtml("M", { play, rating, daily, history, live: l, allowance: null, errors: {}, now: clock.t });
    expect(html).toContain(`data-style="${next}" role="radio" aria-checked="true"`);
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
    const htmlL = agentControlsHtml("L", { play, rating, daily, history, live: l, allowance: null, errors: {}, now: clock.t });
    expect(htmlL).toContain(`data-deck="${starter}" aria-pressed="true"`);
    expect(htmlL).not.toMatch(/undefined|NaN|>null</);
  }, 60_000);
});

// Render session 59 (hardening): the ring's once-a-second tick, the status
// read's cadence carried over from closed PR #137, and the dial's keys.
describe("the ring's tick, the status cadence, the dial's keys (render session 59)", () => {
  const T0 = Date.parse("2026-11-09T10:00:00.000Z");
  const running = (secondsLeft: number, total = 15): SiteAutoPlay => ({
    ...AUTO,
    allowance: { state: "running", startedAt: new Date(T0 - (total * 60 - secondsLeft) * 1000).toISOString(), endsAt: new Date(T0 + secondsLeft * 1000).toISOString(), totalMinutes: total, secondsLeft, minutesLeft: Math.ceil(secondsLeft / 60), endsAtReset: false },
    canAddTime: true,
  });

  it("the tick patches exactly what the drawn ring shows, at every second", () => {
    const p: SitePlay = { ...PLAY, autoPlay: running(600) };
    for (const dt of [0, 1, 59, 60, 61, 300, 599, 600, 700]) {
      const now = T0 + dt * 1000;
      const v = ringOfPlay(p, now);
      // The widget's own drawing at the same moment.
      const w = agentControlsHtml("M", { ...DATA, play: p, now, allowance: allowanceOf(p.autoPlay, now) });
      const g = ringParts(p.connectedAgent!.name, v, 88);
      expect(w).toContain(`stroke-dasharray="${g.dash}"`);
      expect(w).toContain(`class="tring t-${g.tone}" data-size="88"`);
      expect(w).toContain(`<b class="tr-c${g.word ? " word" : ""}">${g.centreHtml}</b>`);
      expect(w).toContain(`<span class="small ac-cap">${esc(v.caption)}</span>`);
    }
    // It drains: 10 min, 9 min after 61 s, "Finishing match" at zero.
    expect(ringOfPlay(p, T0).centre).toBe("10");
    expect(ringOfPlay(p, T0 + 61_000).centre).toBe("9");
    expect(ringOfPlay(p, T0 + 600_000)).toMatchObject({ centre: "Finishing match", tone: "finish" });
    const a = ringParts("Nova", ringOfPlay(p, T0 + 150_000), 80);
    const [lit, circ] = a.dash.split(" ").map(Number);
    expect(lit! / circ!).toBeCloseTo(450 / 900, 2);
  });

  it("the tick runs only while time runs down", () => {
    expect(ringTicks({ ...PLAY, autoPlay: running(600) })).toBe(true);
    expect(ringTicks({ ...PLAY, autoPlay: AUTO })).toBe(false);
    const fin = running(0);
    expect(ringTicks({ ...PLAY, autoPlay: { ...fin, allowance: { ...fin.allowance!, state: "finishing" } } })).toBe(false);
    expect(ringTicks({ ...PLAY, connectedAgent: null, autoPlay: running(600) })).toBe(false);
    expect(ringTicks(null)).toBe(false);
  });

  it("the status read: 1.5 s in a rebuild, 5 s near the end or finishing, else 15 s", () => {
    expect(statusPollMs(null, T0)).toBe(15000);
    expect(statusPollMs(PLAY, T0)).toBe(15000);
    expect(statusPollMs({ ...PLAY, autoPlay: running(600) }, T0)).toBe(15000);
    // 31 s left at the read; 2 s later the page's clock says 29.
    expect(statusPollMs({ ...PLAY, autoPlay: running(31) }, T0)).toBe(15000);
    expect(statusPollMs({ ...PLAY, autoPlay: running(31) }, T0 + 2000)).toBe(5000);
    expect(statusPollMs({ ...PLAY, autoPlay: running(10) }, T0)).toBe(5000);
    const fin = running(0);
    expect(statusPollMs({ ...PLAY, autoPlay: { ...fin, allowance: { ...fin.allowance!, state: "finishing" } } }, T0)).toBe(5000);
    expect(statusPollMs({ ...PLAY, autoPlay: { ...fin, allowance: { ...fin.allowance!, state: "done" } } }, T0)).toBe(15000);
    expect(statusPollMs({ ...PLAY, autoPlay: running(10), rebuild: { reasons: [], job: { jobId: "j", state: "running" } as never } }, T0)).toBe(1500);
  });

  it("the dial's keys: clockwise and back, wrapping; Home and End; nothing else", () => {
    const ids = STYLES.map((s) => s.id);
    expect(dialKeyTarget(ids, "tempo", "ArrowRight")).toBe("fortress");
    expect(dialKeyTarget(ids, "tempo", "ArrowDown")).toBe("fortress");
    expect(dialKeyTarget(ids, "tempo", "ArrowLeft")).toBe("controller");
    expect(dialKeyTarget(ids, "tempo", "ArrowUp")).toBe("controller");
    expect(dialKeyTarget(ids, "gambler", "ArrowRight")).toBe("calculator");
    expect(dialKeyTarget(ids, "calculator", "ArrowLeft")).toBe("gambler");
    expect(dialKeyTarget(ids, "tempo", "Home")).toBe("calculator");
    expect(dialKeyTarget(ids, "tempo", "End")).toBe("gambler");
    expect(dialKeyTarget(ids, "calculator", "Home")).toBeNull();
    expect(dialKeyTarget(ids, "tempo", "Enter")).toBeNull();
    expect(dialKeyTarget(ids, "tempo", "a")).toBeNull();
    expect(dialKeyTarget(["only"], "only", "ArrowRight")).toBeNull();
  });
});
