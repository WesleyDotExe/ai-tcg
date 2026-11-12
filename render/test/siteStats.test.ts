// Render session 68: the Stats page (siteStats.ts), on fixtures shaped as
// OWNER_API.md documents `GET /api/stats` and `GET /api/ladder` for the edge
// cases, and on the real owner API over a real store for the numbers (every
// figure drawn must be the server's, under each filter).
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { siteApi } from "../src/site/siteApi.js";
import type { SiteLadder, SiteLadderRow, SiteStats } from "../src/site/siteStanding.js";
import {
  dayColumnsSvg,
  factionTableHtml,
  ladderSectionHtml,
  ratingHeroHtml,
  recentHtml,
  statsFilterHtml,
  statsPageHtml,
  tierCounts,
  todayHtml,
  totalsHtml,
  type StatsPageState,
} from "../src/site/siteStats.js";
import { SITE_CSS as CSS } from "../src/site/sitePage.js";

const clean = (h: string) => expect(h).not.toMatch(/undefined|NaN|\[object|>false<|>null<|Infinity/);
const count = (h: string, re: RegExp) => (h.match(re) ?? []).length;

const TIERS: SiteLadder["tiers"] = [
  { tier: "Bronze", from: null },
  { tier: "Silver", from: 1350 },
  { tier: "Gold", from: 1500 },
  { tier: "Platinum", from: 1650 },
  { tier: "Diamond", from: 1800 },
  { tier: "Mythic", from: 1950 },
];

const NOW = Date.parse("2026-11-12T09:00:00.000Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

const TODAY: SiteStats["today"] = {
  day: "2026-11-12", timeZone: "Australia/Sydney", startedAt: "2026-11-11T13:00:00.000Z", resetsAt: "2026-11-12T13:00:00.000Z",
  schedule: [{ fromWin: 1, toWin: 1, credits: 30 }, { fromWin: 2, toWin: 4, credits: 10 }, { fromWin: 5, toWin: 10, credits: 5 }, { fromWin: 11, toWin: null, credits: 0 }],
  wins: [1, 2, 3, 4].map((nth) => ({ nth, matchId: `w${nth}`, endedAt: ago(60 - nth), credits: nth === 1 ? 30 : 10 })),
  rewardedWins: [1, 2, 3, 4].map((nth) => ({ nth, matchId: `w${nth}`, endedAt: ago(60 - nth), credits: nth === 1 ? 30 : 10 })),
  losses: 2, maxPaidLosses: 5, creditsFromWins: 60, creditsFromLosses: 10, credits: 70, nextWinPays: 5, nextLossPays: 5,
};

function stats(over: Partial<SiteStats> = {}): SiteStats {
  // 30 reset days ending 12 Nov, rising 4 a day, rated every third day (2 wins), a loss on day 4.
  const chart = Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.UTC(2026, 10, 12 - 29 + i)).toISOString().slice(0, 10), rating: 1480 + i * 4, rated: i % 3 === 0 ? 2 : i === 4 ? 1 : 0, wins: i % 3 === 0 ? 2 : 0, losses: i === 4 ? 1 : 0, draws: i === 9 ? 1 : 0 }));
  return {
    ownerId: "o-me",
    agentId: null,
    agents: [{ agentId: "a", name: "Vector", matches: 14 }, { agentId: "b2", name: "Kestrel <&>", matches: 6 }],
    totals: { matches: 20, wins: 12, losses: 6, draws: 1, void: 1, winRate: 12 / 19, bestWinStreak: 5, currentStreak: { kind: "win", length: 3 }, creditsFromMatches: 1412 },
    byFaction: ["Cortex", "Swarm", "Aegis", "Null"].map((faction, i) => ({ faction, matches: i ? 0 : 19, wins: i ? 0 : 12, losses: i ? 0 : 6, draws: i ? 0 : 1, void: 0, winRate: i ? 0 : 12 / 19 })),
    factionNotRecorded: { matches: 1, wins: 0, losses: 0, draws: 0, void: 1, winRate: 0 },
    byOpponentFaction: ["Cortex", "Swarm", "Aegis", "Null"].map((faction, i) => ({ faction, matches: i === 1 ? 10 : i === 3 ? 9 : 0, wins: i === 1 ? 7 : i === 3 ? 5 : 0, losses: i === 1 ? 3 : i === 3 ? 3 : 0, draws: i === 3 ? 1 : 0, void: 0, winRate: i === 1 ? 0.7 : i === 3 ? 5 / 9 : 0 })),
    opponentFactionNotRecorded: { matches: 0, wins: 0, losses: 0, draws: 0, void: 0, winRate: 0 },
    recent: (["win", "win", "win", "loss", "draw", "cancelled", "abandonedByOpponent"] as const).map((result, i) => ({
      matchId: `m${i}`, endedAt: ago(10 + i * 30), result, agentId: i % 2 ? "b2" : "a", agentName: i % 2 ? "Kestrel <&>" : "Vector", faction: "Cortex",
      opponent: { ownerId: "o-2", ownerName: "House <Swarm>", agentId: "b", agentName: "Hive", faction: i % 2 ? null : "Swarm" },
      credits: result === "win" ? 30 : 0, rating: result === "cancelled" ? null : { before: 1600, after: 1612, change: result === "loss" ? -9 : 12 }, turns: 12,
    })),
    rating: { now: { ownerId: "o-me", rating: 1616.4, rd: 61.2, volatility: 0.06, ratedMatches: 19, tier: "Gold", lastDay: "2026-11-12" }, weekAgo: 1588.2, weekChange: 28.2, chart },
    today: TODAY,
    ...over,
  };
}

function row(i: number, over: Partial<SiteLadderRow> = {}): SiteLadderRow {
  const tier = i < 2 ? "Platinum" : i < 6 ? "Gold" : "Silver";
  return { rank: i + 1, ownerId: `o-${i}`, ownerName: `Owner ${i}`, ownerKind: i % 2 ? "house" : "player", agent: { agentId: `a-${i}`, name: `Agent ${i}` }, rating: 1700 - i * 25, rd: 80, tier, ratedMatches: 12, wins: 8, losses: 4, draws: i === 3 ? 1 : 0, lastDay: i ? "2026-11-11" : "2026-11-12", ...over };
}

function ladderOf(n: number, youAt: number | null): SiteLadder {
  const standings = Array.from({ length: n }, (_, i) => row(i));
  const me = youAt === null ? row(99, { rank: null, tier: "Placement", ratedMatches: 2, ownerId: "o-me", ownerName: "Me <&>" }) : { ...standings[youAt]!, ownerId: "o-me", ownerName: "Me <&>" };
  if (youAt !== null) standings[youAt] = me;
  return { standings, you: me, owners: n, tiers: TIERS, placementMatches: 5 };
}

/** The history's hasReplay: every recent match has one but m6 (recorded without). */
const REPLAYS: Record<string, boolean> = { m0: true, m1: true, m2: true, m3: true, m4: true, m5: true, m6: false };

function page(over: Partial<StatsPageState> = {}): StatsPageState {
  return { stats: stats(), ladder: ladderOf(9, 4), replays: REPLAYS, allRecent: false, agent: null, days: 30, loading: false, error: null, ladderError: null, ...over };
}

describe("the Stats page: the filter", () => {
  it("All agents and each of the owner's agents with its matches; the pressed one is the filter; the days' choice", () => {
    const f = statsFilterHtml(stats(), { agent: null, days: 30, loading: false });
    clean(f);
    expect(count(f, /data-act="stats-agent"/g)).toBe(3);
    expect(f).toContain(`data-agent="" aria-pressed="true">All agents <small>20</small>`);
    expect(f).toContain(`data-agent="b2" aria-pressed="false">Kestrel &lt;&amp;&gt; <small>6</small>`);
    expect(f).toMatch(/data-v="30" aria-pressed="true"/);
    expect(f).toMatch(/data-v="7" aria-pressed="false"/);
    expect(f).not.toContain("Reading…");
    const g = statsFilterHtml(stats(), { agent: "b2", days: 90, loading: true });
    expect(g).toContain(`data-agent="b2" aria-pressed="true"`);
    expect(g).toMatch(/data-v="90" aria-pressed="true"/);
    expect(g).toContain("Reading…");
  });

  it("one agent: no pills, its name and matches; none yet says so", () => {
    const one = statsFilterHtml(stats({ agents: [{ agentId: "a", name: "Vector", matches: 1 }] }), { agent: null, days: 7, loading: false });
    expect(one).not.toContain("stats-agent");
    expect(one).toContain("Vector · 1 match<");
    expect(statsFilterHtml(stats({ agents: [] }), { agent: null, days: 7, loading: false })).toContain("No agent yet");
  });
});

describe("the Stats page: the rating", () => {
  it("the day columns sit on the chart's x: a win column up, a loss down, a draw on the wins, a dot on a quiet day", () => {
    const s = stats();
    const svg = dayColumnsSvg(s.rating.chart, 760, 56);
    clean(svg);
    const withResults = s.rating.chart.filter((c) => c.wins + c.losses + c.draws).length;
    expect(count(svg, /<g><title>/g)).toBe(withResults);
    expect(count(svg, /class="dc-z"/g)).toBe(30 - withResults);
    expect(count(svg, /class="dc-w"/g)).toBe(s.rating.chart.filter((c) => c.wins).length);
    expect(count(svg, /class="dc-l"/g)).toBe(1);
    expect(count(svg, /class="dc-d"/g)).toBe(1);
    // Day 0 sits at the chart's left pad (30), the last day at its right edge (760 - 4).
    expect(svg).toMatch(/class="dc-w" x="(\d+\.\d)"/);
    const firstX = Number(/class="dc-w" x="([\d.]+)" [^>]*width="([\d.]+)"/.exec(svg)![1]) + Number(/class="dc-w" x="([\d.]+)" [^>]*width="([\d.]+)"/.exec(svg)![2]) / 2;
    expect(firstX).toBeCloseTo(30, 0);
    expect(svg).toContain(`cx="756.0"`);
    expect(dayColumnsSvg(s.rating.chart.slice(0, 1), 760, 56)).toBe("");
  });

  it("the hero: badge, rating and RD, rank of the ladder, the week's change, the bar to the next tier, the chart", () => {
    const h = ratingHeroHtml(stats(), ladderOf(9, 4), 30);
    clean(h);
    expect(h).toContain("<b>1616</b>");
    expect(h).toContain("Gold · ±61 · #5 of 9");
    expect(h).toContain("<b>+28</b><small>this week</small>");
    expect(h).toContain("34 to Platinum");
    expect(h).toContain(`class="rchart`);
    expect(h).toContain(`class="dcols"`);
    expect(h).toContain("30 days · from 1480");
    expect(h).not.toContain("whichever agent played");
    // Under an agent filter the rating is still the owner's: the page says so.
    const f = ratingHeroHtml(stats({ agentId: "b2" }), null, 7);
    expect(f).toContain("Kestrel &lt;&amp;&gt;'s");
    expect(f).not.toContain("st-tier");
    // In placement: no number, the rated matches instead.
    const p = ratingHeroHtml(stats({ rating: { ...stats().rating, now: { ...stats().rating.now, tier: "Placement", ratedMatches: 2 } } }), ladderOf(9, null), 30);
    expect(p).toContain("<b>—</b>");
    expect(p).toContain("Placement · 2 rated · In placement");
    expect(p).toContain("3 more rated matches to place");
  });
});

describe("the Stats page: the totals, today and the factions", () => {
  it("totals are the server's: matches, wins, losses, draws, streaks, credits, the void ones", () => {
    const t = totalsHtml(stats());
    clean(t);
    for (const [v, label] of [["20", "matches"], ["12", "wins"], ["6", "losses"], ["1", "draws"], ["5", "best streak"], ["3 wins", "streak now"], ["1,412", "credits from matches"]]) expect(t).toContain(`<b>${v}</b><span>${label}</span>`);
    expect(t).toContain("63% of 19 decided matches won");
    expect(t).toContain(`st-t hot`);
    expect(t).toContain("1 void (cancelled or abandoned)");
    const z = totalsHtml(stats({ totals: { matches: 0, wins: 0, losses: 0, draws: 0, void: 0, winRate: 0, bestWinStreak: 0, currentStreak: null, creditsFromMatches: 0 } }));
    clean(z);
    expect(z).toContain("No decided match yet");
    expect(z).toContain("<b>None</b><span>streak now</span>");
    expect(z).not.toContain("void");
    expect(totalsHtml(stats({ totals: { ...stats().totals, currentStreak: { kind: "loss", length: 2 } } }))).toContain(`st-t cold"><b>2 losses</b>`);
  });

  it("today is the server's `today`: earned, from wins of the most, rewarded wins, losses paid, the reset clock", () => {
    const d = todayHtml(TODAY, NOW);
    clean(d);
    expect(d).toContain("<b>70</b><small>credits</small>");
    expect(d).toContain("From wins <b>60</b> of 90");
    expect(d).toContain("60 of 90 credits from wins today");
    expect(d).toContain("<b>4</b>/10");
    expect(d).toContain("Next win pays <b>+5</b>");
    expect(d).toContain("Losses and draws today: <b>2</b> · 2 of 5 paid");
    expect(d).toContain(`data-until="${TODAY.resetsAt}">04:00:00<`);
    expect(d).toContain("midnight Sydney");
    const maxed = todayHtml({ ...TODAY, nextWinPays: 0, nextLossPays: 0 }, NOW);
    expect(maxed).toContain("Wins pay nothing more today");
    expect(maxed).not.toContain("next loss");
  });

  it("factions: all four, each with its W-L-D, none greyed, the older matches with no faction counted apart", () => {
    const s = stats();
    const f = factionTableHtml("By deck", s.byFaction, s.factionNotRecorded, "faction");
    clean(f);
    expect(count(f, /<li /g)).toBe(4);
    expect(f).toContain("<b class=\"st-fp\">63%</b><span class=\"small muted st-fr\">12-6-1</span>");
    expect(count(f, /class="none"/g)).toBe(3);
    expect(f).toContain("1 older match kept no faction.");
    const o = factionTableHtml("Against", s.byOpponentFaction, s.opponentFactionNotRecorded, "opponent's faction");
    expect(o).toContain(">70%</b><span class=\"small muted st-fr\">7-3</span>");
    expect(o).toContain(">56%</b><span class=\"small muted st-fr\">5-3-1</span>");
    expect(o).not.toContain("older match");
  });
});

describe("the Stats page: recent results and the ladder", () => {
  it("each result with who, when, credits, the rating change and its Replay where the history has one; a cancel has none; names escaped", () => {
    const r = recentHtml(stats(), NOW, REPLAYS);
    clean(r);
    expect(count(r, /class="hrow"/g)).toBe(7);
    // m5 is cancelled (never played out); m6 has no replay in the history.
    expect(count(r, /data-act="replay"/g)).toBe(5);
    expect(r).not.toContain(`data-act="replay" data-match="m5"`);
    expect(r).not.toContain(`data-act="replay" data-match="m6"`);
    expect(count(r, />No replay</g)).toBe(2);
    // Before the history is read: no button at all (a guess could 404).
    expect(recentHtml(stats(), NOW, null)).not.toContain(`data-act="replay"`);
    expect(recentHtml(stats(), NOW, {})).not.toContain(`data-act="replay"`);
    expect(r).toContain("House &lt;Swarm&gt;");
    expect(r).not.toContain("House <Swarm>");
    expect(r).toContain(`<small class="rt down">−9</small>`);
    expect(r).toContain(`<small class="rt none">unrated</small>`);
    // All agents, two agents: each row names which of the owner's agents played.
    expect(r).toContain("Kestrel &lt;&amp;&gt;");
    expect(recentHtml(stats({ agentId: "a" }), NOW)).not.toContain("Kestrel");
    // Twenty results: the newest 8 until "Show all 20"; the pips are all 20.
    const many = stats({ recent: Array.from({ length: 20 }, (_, i) => ({ ...stats().recent[0]!, matchId: `x${i}` })) });
    const few = recentHtml(many, NOW, {});
    expect(count(few, /class="hrow"/g)).toBe(8);
    expect(count(few, /class="wl w" title/g)).toBe(20);
    expect(few).toContain(`data-act="stats-recent">Show all 20<`);
    const allRows = recentHtml(many, NOW, {}, true);
    expect(count(allRows, /class="hrow"/g)).toBe(20);
    expect(allRows).toContain(">Show fewer<");
    expect(r).not.toContain("stats-recent");
    expect(recentHtml(stats({ recent: [] }), NOW)).toContain("No results yet");
  });

  it("the ladder: the tiers and how many stand in each, every listed row, the owner's lit", () => {
    const l = ladderOf(9, 4);
    expect(tierCounts(l).filter((c) => c.n)).toEqual([{ tier: "Silver", n: 3 }, { tier: "Gold", n: 4 }, { tier: "Platinum", n: 2 }]);
    const h = ladderSectionHtml(l, "2026-11-12");
    clean(h);
    expect(count(h, /<tr class="(you)?"/g)).toBe(9);
    expect(count(h, /aria-current="true"/g)).toBe(1);
    expect(h).toContain("Me &lt;&amp;&gt; · you");
    expect(h).toContain(">today<");
    expect(h).toContain("Silver 3, Gold 4, Platinum 2");
    expect(count(h, /class="tl[ "]/g)).toBe(TIERS.length + 1);
    expect(h).not.toContain("lt-you");
  });

  it("an owner off the list (in placement) is added at its foot; an empty ladder says so", () => {
    const h = ladderSectionHtml(ladderOf(5, null), null);
    clean(h);
    expect(h).toContain(`class="lt-you"`);
    expect(count(h, /aria-current="true"/g)).toBe(1);
    expect(h).toMatch(/<td class="lt-k">—<\/td>/);
    const e = ladderSectionHtml({ ...ladderOf(0, null), standings: [], owners: 0 }, null);
    expect(e).toContain("No one has a rated match yet");
  });
});

describe("the Stats page: the page", () => {
  it("loading, an error with Try again, the ladder's own failure, and a refresh error over drawn stats", () => {
    expect(statsPageHtml(page({ stats: null, ladder: null }), NOW)).toContain("Loading your stats…");
    const e = statsPageHtml(page({ stats: null, error: "The server is down." }), NOW);
    expect(e).toContain("Your stats couldn't be read");
    expect(e).toContain(`data-act="retry-stats"`);
    const l = statsPageHtml(page({ ladder: null, ladderError: "boom" }), NOW);
    clean(l);
    expect(l).toContain("Couldn't read the ladder: boom");
    expect(l).toContain("<b>1616</b>");
    expect(statsPageHtml(page({ error: "late" }), NOW)).toContain("Couldn't refresh: late");
  });

  it("the whole page draws every part once, with nothing invented", () => {
    const h = statsPageHtml(page(), NOW);
    clean(h);
    for (const cls of ["st-filter", "st-hero", "st-tot", "st-today", "st-rec", "st-ladder"]) expect(count(h, new RegExp(`class="[^"]*\\b${cls}\\b`, "g")), cls).toBe(1);
    expect(count(h, /class="panel glass st-fac"/g)).toBe(2);
    // No quests or achievements in Season 0 (owner 2026-11-06).
    expect(h).not.toMatch(/quest|achievement/i);
  });

  it("the page's motion is transform and opacity only, and off under reduce motion", () => {
    const kf = /@keyframes (st-[\w-]+) \{([^}]*\{[^}]*\})+[^}]*\}/g;
    const found = [...CSS.matchAll(kf)];
    expect(found.map((m) => m[1]).sort()).toEqual(["st-blink", "st-col"]);
    for (const m of found) expect(m[0].replace(/@keyframes [\w-]+/, "")).not.toMatch(/\b(width|height|top|left|margin|padding)\s*:/);
    expect(CSS).toMatch(/prefers-reduced-motion: reduce\) \{ \.dcols rect, \.st-sb i, \.st-busy \{ animation: none; \}/);
  });
});

// ---- over the real owner API ----------------------------------------------------------

const PW = "correct horse battery";
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) {
    await r.idle();
    await r.close();
  }
});

describe("the Stats page on the real owner API", () => {
  it("draws the server's stats under each filter, today's earnings and the ladder", async () => {
    const store = EconomyStore.open(":memory:");
    const me = store.createAccount({ name: "ada", username: "ada", password: PW });
    store.grantStarterCollection(me.ownerId, "Swarm");
    const other = store.createAccount({ name: "bob", username: "bob", password: PW });
    store.grantStarterCollection(other.ownerId, "Aegis");
    const a = store.createAgent({ ownerId: me.ownerId, name: "Vector" });
    const a2 = store.createAgent({ ownerId: me.ownerId, name: "Kestrel" });
    const b = store.createAgent({ ownerId: other.ownerId, name: "Bastion" });
    // Over seven days: Vector 4W 1L, Kestrel 1W 1L; today Vector wins twice and Kestrel loses once.
    const plan: [string, "win" | "loss", number][] = [
      [a.agentId, "win", 6], [a.agentId, "win", 5], [a2.agentId, "loss", 4], [a.agentId, "loss", 3], [a2.agentId, "win", 2], [a.agentId, "win", 0], [a.agentId, "win", 0], [a2.agentId, "loss", 0],
    ];
    plan.forEach(([agent, o, daysAgo], i) => store.recordMatch({ matchId: `m${i}`, seed: i, p1AgentId: agent, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: o === "win" ? agent : b.agentId }, endedAt: new Date(Date.now() - daysAgo * 86_400_000 - (8 - i) * 60_000).toISOString() }));
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const { token } = await client.signIn("ada", PW);
    const [all, ladder, daily] = await Promise.all([client.stats(token, { days: 30, recent: 20 }), client.ladder(token, 100), client.daily(token)]);

    // Every figure on the page is the server's.
    expect(all.totals).toMatchObject({ matches: 8, wins: 5, losses: 3 });
    const now = Date.now();
    const hist = await client.matches(token, 50);
    const replays = Object.fromEntries(hist.matches.map((m) => [m.matchId, m.hasReplay]));
    const P = statsPageHtml({ stats: all, ladder, replays, allRecent: true, agent: null, days: 30, loading: false, error: null, ladderError: null }, now);
    clean(P);
    expect(P).toContain(`<b>${all.totals.matches}</b><span>matches</span>`);
    expect(P).toContain(`<b>${all.totals.wins}</b><span>wins</span>`);
    expect(P).toContain(`<b>${Math.round(all.totals.winRate * 100)}%</b>`);
    expect(P).toContain(`<b>${all.totals.creditsFromMatches.toLocaleString("en-US")}</b><span>credits from matches</span>`);
    expect(P).toContain(`<b>${Math.round(all.rating.now.rating)}</b>`);
    expect(count(P, /data-act="stats-agent"/g)).toBe(3);
    expect(count(P, /class="hrow"/g)).toBe(all.recent.length);
    // Recorded here without a replay file: the history says so, and no Replay is offered.
    expect(all.recent.every((r) => replays[r.matchId] === false)).toBe(true);
    expect(P).not.toContain(`data-act="replay"`);
    expect(count(P, /class="dc-w"/g)).toBe(all.rating.chart.filter((c) => c.wins).length);
    // Today: the stats' `today` is GET /api/daily's, and the page draws it.
    expect(all.today).toEqual(daily);
    expect(all.today.rewardedWins).toHaveLength(2);
    expect(P).toContain(`<b>${all.today.credits}</b><small>credits</small>`);
    expect(P).toContain(`<b>${all.today.rewardedWins.length}</b>/10`);
    expect(P).toContain(`Losses and draws today: <b>${all.today.losses}</b>`);
    // The ladder: the owner's row lit, the server's rank.
    expect(ladder.you.ownerId).toBe(me.ownerId);
    expect(count(P, /aria-current="true"/g)).toBe(1);
    expect(P).toContain(`${ladder.you.rank === null ? "In placement" : `#${ladder.you.rank} of ${ladder.owners}`}`);

    // One agent: the totals follow the filter, the rating stays the owner's.
    const k = await client.stats(token, { agent: a2.agentId, days: 7, recent: 20 });
    expect(k.agentId).toBe(a2.agentId);
    expect(k.totals).toMatchObject({ matches: 3, wins: 1, losses: 2 });
    expect(k.rating.now.rating).toBe(all.rating.now.rating);
    expect(k.rating.chart).toHaveLength(7);
    const K = statsPageHtml({ stats: k, ladder, replays: {}, allRecent: false, agent: a2.agentId, days: 7, loading: false, error: null, ladderError: null }, now);
    clean(K);
    expect(K).toContain(`data-agent="${a2.agentId}" aria-pressed="true"`);
    expect(K).toMatch(/data-v="7" aria-pressed="true"/);
    expect(K).toContain(`<b>3</b><span>matches</span>`);
    expect(K).toContain("everything else on this page is Kestrel's");
    expect(count(K, /class="hrow"/g)).toBe(3);
  });
});
