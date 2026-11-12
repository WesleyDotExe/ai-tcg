// Render session 65: the Ladder, Rating & form and Notifications widgets at
// S, M and L (siteStanding.ts), on fixtures shaped as OWNER_API.md documents
// them for the edge cases, and on the real owner API over a real store for
// the numbers (every figure drawn must be the server's).
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { siteApi } from "../src/site/siteApi.js";
import {
  aroundYou,
  formBody,
  formPips,
  ladderBody,
  noticeView,
  notifBody,
  ratingChartSvg,
  tierProgress,
  weekTrend,
  type SiteLadder,
  type SiteLadderRow,
  type SiteNotifications,
  type SiteStats,
} from "../src/site/siteStanding.js";
import { miniCard, sourcesOf, widgetHtml, type WidgetData } from "../src/site/siteWidgets.js";

const TIERS: SiteLadder["tiers"] = [
  { tier: "Bronze", from: null },
  { tier: "Silver", from: 1350 },
  { tier: "Gold", from: 1500 },
  { tier: "Platinum", from: 1650 },
  { tier: "Diamond", from: 1800 },
  { tier: "Mythic", from: 1950 },
];

function row(i: number, over: Partial<SiteLadderRow> = {}): SiteLadderRow {
  return { rank: i + 1, ownerId: `o-${i}`, ownerName: `Owner ${i}`, ownerKind: i % 2 ? "house" : "player", agent: { agentId: `a-${i}`, name: `Agent ${i}` }, rating: 1700 - i * 25, rd: 80, tier: "Gold", ratedMatches: 12, wins: 8, losses: 4, draws: 0, lastDay: "2026-11-11", ...over };
}

function ladderOf(n: number, youAt: number | null, you: Partial<SiteLadderRow> = {}): SiteLadder {
  const standings = Array.from({ length: n }, (_, i) => row(i));
  const me = youAt === null ? row(99, { rank: null, tier: "Placement", ratedMatches: 2, ownerId: "o-me", ownerName: "Me <&>", ...you }) : { ...standings[youAt]!, ownerId: "o-me", ownerName: "Me <&>", ...you };
  if (youAt !== null) standings[youAt] = me;
  return { standings, you: me, owners: n, tiers: TIERS, placementMatches: 5 };
}

const NOW = Date.parse("2026-11-12T09:00:00.000Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

/** Today's earnings as GET /api/daily answers them (Season 0's schedule: win 1 pays 30, 2-4 10, 5-10 5). */
const TODAY: SiteStats["today"] = {
  day: "2026-11-12", timeZone: "Australia/Sydney", startedAt: "2026-11-11T13:00:00.000Z", resetsAt: "2026-11-12T13:00:00.000Z",
  schedule: [{ fromWin: 1, toWin: 1, credits: 30 }, { fromWin: 2, toWin: 4, credits: 10 }, { fromWin: 5, toWin: 10, credits: 5 }, { fromWin: 11, toWin: null, credits: 0 }],
  wins: [1, 2, 3, 4].map((nth) => ({ nth, matchId: `w${nth}`, endedAt: "2026-11-12T08:00:00.000Z", credits: nth === 1 ? 30 : 10 })),
  rewardedWins: [1, 2, 3, 4].map((nth) => ({ nth, matchId: `w${nth}`, endedAt: "2026-11-12T08:00:00.000Z", credits: nth === 1 ? 30 : 10 })),
  losses: 2, maxPaidLosses: 5, creditsFromWins: 60, creditsFromLosses: 10, credits: 70, nextWinPays: 5, nextLossPays: 5,
};

function stats(over: Partial<SiteStats> = {}): SiteStats {
  // 30 reset days ending 12 Nov, 1480 rising 4 a day (so Gold's 1500 floor is crossed), rated every third day.
  const chart = Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.UTC(2026, 10, 12 - 29 + i)).toISOString().slice(0, 10), rating: 1480 + i * 4, rated: i % 3 === 0 ? 2 : 0, wins: i % 3 === 0 ? 2 : 0, losses: 0, draws: 0 }));
  return {
    ownerId: "o-me",
    agentId: null,
    agents: [{ agentId: "a", name: "Vector", matches: 20 }],
    totals: { matches: 20, wins: 12, losses: 6, draws: 1, void: 1, winRate: 12 / 19, bestWinStreak: 5, currentStreak: { kind: "win", length: 3 }, creditsFromMatches: 412 },
    byFaction: ["Cortex", "Swarm", "Aegis", "Null"].map((faction, i) => ({ faction, matches: i ? 0 : 19, wins: i ? 0 : 12, losses: i ? 0 : 6, draws: i ? 0 : 1, void: 0, winRate: i ? 0 : 12 / 19 })),
    factionNotRecorded: { matches: 1, wins: 0, losses: 0, draws: 0, void: 1, winRate: 0 },
    byOpponentFaction: [],
    opponentFactionNotRecorded: { matches: 0, wins: 0, losses: 0, draws: 0, void: 0, winRate: 0 },
    recent: (["win", "win", "win", "loss", "draw", "cancelled", "abandonedByOpponent"] as const).map((result, i) => ({
      matchId: `m${i}`, endedAt: ago(10 + i * 30), result, agentId: "a", agentName: "Vector", faction: "Cortex",
      opponent: { ownerId: "o-2", ownerName: "House <Swarm>", agentId: "b", agentName: "Hive", faction: i % 2 ? null : "Swarm" },
      credits: result === "win" ? 30 : 0, rating: result === "cancelled" ? null : { before: 1600, after: 1612, change: result === "loss" ? -9 : 12 }, turns: 12,
    })),
    rating: { now: { ownerId: "o-me", rating: 1616.4, rd: 61.2, volatility: 0.06, ratedMatches: 19, tier: "Gold", lastDay: "2026-11-12" }, weekAgo: 1588.2, weekChange: 28.2, chart },
    today: TODAY,
    ...over,
  };
}

function notifs(): SiteNotifications {
  return {
    notifications: [
      { notificationId: 9, kind: "bigPull", createdAt: ago(2), readAt: null, bigPull: { packId: "p", setCode: "S0", jackpot: false, cards: [{ copyId: "c1", cardId: "cx-1", name: "Alpha <Node>", rarity: "Mythic", finish: "prototype", isNew: true, prototype: { runCode: "R", serial: 7, runSize: 25 } }, { copyId: "c2", cardId: "sw-1", name: "Brute", rarity: "Rare", finish: "gold", isNew: false, prototype: null }] } },
      { notificationId: 8, kind: "matchResult", createdAt: ago(20), readAt: null, matchResult: { matchId: "m", result: "win", agentId: "a", agentName: "Vector", opponent: { ownerId: "o-2", ownerName: "House", agentName: "Hive" }, credits: 30, rating: { before: 1600, after: 1612, change: 12.4 }, turns: 14 } },
      { notificationId: 7, kind: "autoPlayStopped", createdAt: ago(40), readAt: ago(30), autoPlayStopped: { reason: "timeUp", day: "2026-11-12", allowanceMinutes: 30 } },
      { notificationId: 6, kind: "dailyPack", createdAt: ago(60), readAt: ago(30), dailyPack: { day: "2026-11-12", readySince: ago(600), waiting: 2, cap: 3 } },
      { notificationId: 5, kind: "matchResult", createdAt: ago(80), readAt: ago(30), matchResult: { matchId: "m2", result: "cancelled", agentId: "a", agentName: "Vector", opponent: { ownerId: "o-2", ownerName: "House", agentName: "Hive" }, credits: 0, rating: null, turns: null } },
      { notificationId: 4, kind: "autoPlayStopped", createdAt: ago(90), readAt: ago(30), autoPlayStopped: { reason: "dailyRewardsMaxed", day: "2026-11-12", allowanceMinutes: null } },
    ],
    more: false,
    unread: 2,
    unreadByKind: { matchResult: 1, bigPull: 1, dailyPack: 0, autoPlayStopped: 0 },
  };
}

const clean = (h: string) => expect(h).not.toMatch(/undefined|NaN|\[object|>false<|>null<|Infinity/);
const mc = (c: Parameters<typeof miniCard>[0]) => miniCard(c);

describe("the Ladder widget", () => {
  it("the tier bar measures from the tier's floor to the next; placement counts the matches left; the top tier is full", () => {
    expect(tierProgress({ tier: "Gold", rating: 1575, ratedMatches: 9 }, TIERS, 5)).toEqual({ tier: "Gold", next: "Platinum", pct: 50, line: "75 to Platinum" });
    expect(tierProgress({ tier: "Gold", rating: 1649.2, ratedMatches: 9 }, TIERS, 5).line).toBe("1 to Platinum");
    expect(tierProgress({ tier: "Mythic", rating: 2100, ratedMatches: 40 }, TIERS, 5)).toMatchObject({ next: null, pct: 100, line: "Top tier" });
    expect(tierProgress({ tier: "Placement", rating: 1500, ratedMatches: 2 }, TIERS, 5)).toMatchObject({ pct: 40, line: "3 more rated matches to place" });
    expect(tierProgress({ tier: "Placement", rating: 1500, ratedMatches: 4 }, TIERS, 5).line).toBe("1 more rated match to place");
    // Bronze has no floor: the bar still reads 0-100 and never goes negative.
    const b = tierProgress({ tier: "Bronze", rating: 900, ratedMatches: 9 }, TIERS, 5);
    expect(b).toMatchObject({ next: "Silver", pct: 0, line: "450 to Silver" });
  });

  it("around you keeps the owner in the middle, clamps at the ends, and adds the owner's row when off the list", () => {
    const mid = aroundYou(ladderOf(20, 10), 5);
    expect(mid.rows.map((r) => r.rank)).toEqual([9, 10, 11, 12, 13]);
    expect(aroundYou(ladderOf(20, 0), 5).rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(aroundYou(ladderOf(20, 19), 5).rows.map((r) => r.rank)).toEqual([16, 17, 18, 19, 20]);
    expect(aroundYou(ladderOf(3, 1), 5).rows).toHaveLength(3);
    const off = aroundYou(ladderOf(20, null), 5);
    expect(off.rows.map((r) => r.ownerId)).toEqual(["o-0", "o-1", "o-2", "o-3", "o-me"]);
    expect(off.gapBeforeYou).toBe(true);
  });

  it("S, M and L differ in what they show; the owner's row is marked; names are escaped", () => {
    const l = ladderOf(20, 10);
    const S = ladderBody("S", l), M = ladderBody("M", l), L = ladderBody("L", l);
    for (const h of [S, M, L]) clean(h);
    // S: the badge, the rank, the rating and the bar; no list.
    expect(S).toContain('class="tbadge"');
    expect(S).toContain("<b>#11</b>");
    expect(S).toContain("of 20");
    expect(S).toContain('class="tbar"');
    expect(S).not.toContain('class="lrows"');
    // M: + how far to the next tier, the record, five rows around you.
    expect(M).toMatch(/\d+ to Platinum/);
    expect(M.match(/class="lr( you)?"/g)).toHaveLength(4);
    expect(M.match(/class="lr you"/g)).toHaveLength(1);
    expect(M).toContain("Me &lt;&amp;&gt;");
    expect(M).not.toContain('class="tladder"');
    // L: + the tier column (the owner's lit), the top 8, and around you (not in the top 8).
    expect(L).toContain('class="tladder"');
    expect(L.match(/class="tl on"/g)).toHaveLength(1);
    expect(L).toContain("<h4>Top 8</h4>");
    expect(L).toContain("<h4>Around you</h4>");
    expect(L).toContain("A tier shows after 5 rated matches");
    // In the top 8, no separate "around you".
    expect(ladderBody("L", ladderOf(20, 2))).not.toContain("Around you");
  });

  it("in placement there is no rank and no rating number; an empty ladder says so", () => {
    const p = ladderBody("M", ladderOf(6, null));
    clean(p);
    expect(p).toContain("<b>Placement</b>");
    expect(p).toContain("2/5 placed");
    expect(p).toContain("3 more rated matches to place");
    expect(p).toContain('class="tbadge plc"');
    expect(p).toContain('<li class="lr-gap"');
    expect(p).not.toContain(">1500<");
    const empty: SiteLadder = { standings: [], you: row(0, { rank: null, ratedMatches: 0, tier: "Placement", rating: 1500, wins: 0, losses: 0 }), owners: 0, tiers: TIERS, placementMatches: 5 };
    const e = ladderBody("L", empty);
    clean(e);
    expect(e).toContain("<b>Unranked</b>");
    expect(e).toContain("No one has a rated match yet");
  });
});

describe("the Rating & form widget", () => {
  it("the week's change is now minus a week ago, whole numbers, signed", () => {
    expect(weekTrend(stats())).toEqual({ value: "1616", change: "+28", tone: "up" });
    expect(weekTrend(stats({ rating: { ...stats().rating, weekAgo: 1640 } })).change).toBe("−24");
    expect(weekTrend(stats({ rating: { ...stats().rating, weekAgo: 1616.2 } }))).toMatchObject({ change: "±0", tone: "flat" });
  });

  it("the pips run oldest to newest; an abandon by the opponent is a W, a cancel a dash", () => {
    const h = formPips(stats().recent, 10);
    const letters = [...h.matchAll(/class="wl (\w)"[^>]*>([^<]+)</g)].map((m) => m[2]);
    expect(letters).toEqual(["W", "–", "D", "L", "W", "W", "W"]);
    expect(formPips([], 10)).toContain("No results yet.");
  });

  it("the chart: a line over the days, dots on rated days, the tier floors it crosses, never NaN", () => {
    const s = stats();
    const svg = ratingChartSvg(s.rating.chart, TIERS, 300, 64);
    clean(svg);
    expect(svg.match(/class="rc-d /g)).toHaveLength(10);
    // 1480 to 1596 crosses Gold's floor (1500) only.
    expect(svg.match(/class="rc-floor"/g)).toHaveLength(1);
    // A flat line (every day the same) still draws with a 40-point window.
    const flat = s.rating.chart.map((c) => ({ ...c, rating: 1500, rated: 0 }));
    const f = ratingChartSvg(flat, TIERS, 300, 64, { labels: true });
    clean(f);
    expect(f).toContain(">1520<");
    expect(f).toContain(">1480<");
    expect(f).toContain("Today");
    expect(ratingChartSvg(s.rating.chart.slice(0, 1), TIERS, 300, 64)).toContain("after two days");
  });

  it("S, M and L differ: S the rating and the week; M + the chart, the form and the streak; L + the totals, factions and recent", () => {
    const s = stats();
    const S = formBody("S", s, TIERS, NOW), M = formBody("M", s, TIERS, NOW), L = formBody("L", s, TIERS, NOW);
    for (const h of [S, M, L]) clean(h);
    expect(S).toContain("<b>1616</b>");
    expect(S).toContain("+28");
    expect(S).toContain("this week");
    expect(S).not.toContain("<svg class=\"rchart");
    expect(M).toContain('<svg class="rchart');
    expect(M).toContain("3 wins in a row");
    expect(M).toContain("Best streak</small> <b>5</b>");
    expect(M).not.toContain('class="fbars"');
    expect(L).toContain('class="fbars"');
    expect(L).toContain("63% <span class=\"muted\">of 19</span>"); // 12 of 19 decided
    expect(L).toContain("412 credits from matches");
    expect(L).toContain("1 void (cancelled or abandoned)");
    expect(L).toContain("1 older match kept no faction.");
    expect(L).toContain("House &lt;Swarm&gt;");
    expect(formBody("L", stats({ recent: [s.recent[5]!] }), TIERS, NOW)).toContain(">unrated<"); // the cancel
    expect(L.match(/<ul class="fm-rec">[\s\S]*?<\/ul>/)![0].match(/<li>/g)).toHaveLength(4);
    // A streak of one isn't one (as on My agent).
    expect(formBody("M", stats({ totals: { ...s.totals, currentStreak: { kind: "win", length: 1 } } }), TIERS, NOW)).toContain("No streak");
    // In placement no number shows (the ladder shows none either).
    const p = formBody("S", stats({ rating: { ...s.rating, now: { ...s.rating.now, tier: "Placement", ratedMatches: 3 } } }), TIERS, NOW);
    expect(p).toContain("<b>—</b>");
    expect(p).toContain("Placement · 3 rated");
  });

  it("with no decided match the ring says so and the factions read none", () => {
    const zero = { matches: 0, wins: 0, losses: 0, draws: 0, void: 0, winRate: 0 };
    const s = stats({ totals: { ...zero, bestWinStreak: 0, currentStreak: null, creditsFromMatches: 0 }, byFaction: stats().byFaction.map((f) => ({ ...f, ...zero })), recent: [], factionNotRecorded: zero });
    const L = formBody("L", s, null, NOW);
    clean(L);
    expect(L).toContain("No decided match yet");
    expect(L).toContain("No streak");
    expect(L.match(/>none</g)).toHaveLength(4);
    expect(L).not.toContain("kept no faction");
  });
});

describe("the Notifications widget", () => {
  it("each kind in the widget's words, from the server's fields", () => {
    const [big, win, time, daily, cancel, maxed] = notifs().notifications.map((n) => noticeView(n, NOW, (id) => (id === "cx-1" ? "Cortex" : null)));
    expect(big).toMatchObject({ title: "Prototype Alpha <Node> #7", line: "S0 pack and 1 more · new to you", unread: true, tone: "gold", href: "#/collection" });
    expect(big!.cards.map((c) => c.faction)).toEqual(["Cortex", null]);
    expect(win).toMatchObject({ title: "Won vs Hive", line: "Vector · +30 credits · +12 rating · 14 turns", tone: "w" });
    expect(time).toMatchObject({ title: "Your agent's time is up", line: "The 30 minutes ran out; it finished its match and stopped", unread: false });
    expect(daily).toMatchObject({ title: "2 free packs waiting", line: "Claim it in the Store (up to 3 wait)", href: "#/store" });
    expect(cancel).toMatchObject({ title: "Cancelled vs Hive", line: "Vector · no credits", tone: "x" });
    expect(maxed).toMatchObject({ title: "Today's rewards are maxed" });
  });

  it("S the bell and the latest; M + Mark all read and four; L + by kind and the pulled cards", () => {
    const p = notifs();
    const S = notifBody("S", p, NOW, { miniCard: mc }), M = notifBody("M", p, NOW, { miniCard: mc }), L = notifBody("L", p, NOW, { miniCard: mc });
    for (const h of [S, M, L]) clean(h);
    expect(S).toContain('<b class="nbadge">2</b>');
    expect(S).toContain("Prototype Alpha &lt;Node&gt; #7");
    expect(S).not.toContain("Mark all read");
    expect(M).toContain('data-act="notif-read"');
    expect(M.match(/<li class="nt /g)).toHaveLength(4);
    expect(M.match(/class="nt [^"]*unread/g)).toHaveLength(2);
    expect(M).not.toContain('class="mc ');
    expect(L.match(/<li class="nt /g)).toHaveLength(6);
    // At most 8 at L, with a line saying so.
    const many = { ...p, notifications: [...p.notifications, ...p.notifications.map((n) => ({ ...n, notificationId: n.notificationId + 100 }))] };
    expect(notifBody("L", many, NOW, { miniCard: mc }).match(/<li class="nt /g)).toHaveLength(8);
    expect(notifBody("L", many, NOW, { miniCard: mc })).toContain("Showing the latest 8.");
    expect(L).toContain('class="nk-row"');
    expect(L).toMatch(/Big pulls<\/span><b>1<\/b>/);
    expect(L).toMatch(/Daily pack<\/span><b>0<\/b>/);
    expect(L.match(/class="mc /g)).toHaveLength(2);
    // Nothing unread: no button; nothing at all: what will show and where to switch it.
    const read = { ...p, unread: 0, unreadByKind: { matchResult: 0, bigPull: 0, dailyPack: 0, autoPlayStopped: 0 }, notifications: p.notifications.map((n) => ({ ...n, readAt: ago(1) })) };
    expect(notifBody("M", read, NOW, { miniCard: mc })).not.toContain("notif-read");
    expect(notifBody("M", read, NOW, { miniCard: mc })).toContain("All read");
    const none = notifBody("L", { notifications: [], more: false, unread: 0, unreadByKind: read.unreadByKind }, NOW, { miniCard: mc });
    clean(none);
    expect(none).toContain("Which ones is in Settings.");
    expect(notifBody("S", { notifications: [], more: false, unread: 0, unreadByKind: read.unreadByKind }, NOW, { miniCard: mc })).toContain("All quiet");
    expect(notifBody("S", { ...p, unread: 140 }, NOW, { miniCard: mc })).toContain(">99+<");
  });

  it("the keyframes added for these widgets move only transform and opacity", async () => {
    const { SITE_CSS } = await import("../src/site/sitePage.js").then((m) => ({ SITE_CSS: (m as unknown as { SITE_CSS?: string }).SITE_CSS ?? "" }));
    const css = SITE_CSS || (await import("node:fs")).readFileSync(new URL("../src/site/sitePage.ts", import.meta.url), "utf8");
    for (const name of ["wg-grow", "wg-pop"]) {
      const m = new RegExp(`@keyframes ${name} \\{([^}]*\\}[^}]*)\\}`).exec(css);
      expect(m, name).not.toBeNull();
      const props = [...m![1]!.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]);
      expect(props.every((p) => p === "transform" || p === "opacity"), `${name}: ${props.join(",")}`).toBe(true);
    }
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.tbar i, \.fb-b i, \.nbell \.nbadge \{ animation: none; \} \}/);
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

describe("the three widgets on the real owner API", () => {
  it("draw the server's ladder, stats and notifications at every size; Mark all read clears the badge", async () => {
    const store = EconomyStore.open(":memory:");
    const me = store.createAccount({ name: "ada", username: "ada", password: PW });
    store.grantStarterCollection(me.ownerId, "Swarm");
    const other = store.createAccount({ name: "bob", username: "bob", password: PW });
    store.grantStarterCollection(other.ownerId, "Aegis");
    const a = store.createAgent({ ownerId: me.ownerId, name: "Vector" });
    const b = store.createAgent({ ownerId: other.ownerId, name: "Bastion" });
    // Seven rated matches over seven days: 5 wins, 2 losses (placed after 5).
    const outcomes = ["win", "win", "loss", "win", "win", "loss", "win"];
    outcomes.forEach((o, i) => store.recordMatch({ matchId: `m${i}`, seed: i, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: o === "win" ? a.agentId : b.agentId }, endedAt: new Date(Date.now() - (7 - i) * 86_400_000).toISOString() }));
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const { token } = await client.signIn("ada", PW);
    const [ladder, st, nt] = await Promise.all([client.ladder(token, 100), client.stats(token, { days: 30, recent: 20 }), client.notifications(token, 20)]);

    // The ladder: the server's rank, rating and record on the widget.
    expect(ladder.you.ownerId).toBe(me.ownerId);
    expect(ladder.you.wins).toBe(5);
    const L = ladderBody("L", ladder);
    clean(L);
    expect(L).toContain(`<b>${ladder.you.rank === null ? "Placement" : `#${ladder.you.rank}`}</b>`);
    expect(L).toContain(`>${Math.round(ladder.you.rating)}<`);
    expect(L).toContain("5W 2L");
    expect(L.match(/class="tl[ "]/g)).toHaveLength(ladder.tiers.length + 1);

    // The stats: the week's change and the record are the server's.
    const F = formBody("L", st, ladder.tiers, Date.now());
    clean(F);
    expect(F).toContain(`<b>${Math.round(st.rating.now.rating)}</b>`);
    expect(F).toContain(weekTrend(st).change);
    expect(st.totals.wins).toBe(5);
    expect(F).toContain(`<b class="w">5W</b> <b class="l">2L</b>`);
    expect(F.match(/class="rc-d /g)).toHaveLength(st.rating.chart.filter((c) => c.rated).length);
    expect(st.byFaction.map((f) => f.faction).sort()).toEqual(["Aegis", "Cortex", "Null", "Swarm"]);

    // Notifications: one per match result, newest first, all unread.
    expect(nt.notifications.filter((n) => n.kind === "matchResult")).toHaveLength(7);
    expect(nt.unread).toBeGreaterThanOrEqual(7);
    const N = notifBody("L", nt, Date.now(), { miniCard: mc });
    clean(N);
    expect(N).toContain(`<b class="nbadge">${nt.unread}</b>`);
    expect(N).toContain("Won vs Bastion");

    // Through the widget path (the same as the page), every size, nothing waiting.
    const data = { play: {} as WidgetData["play"], wallet: null, packs: null, collection: null, daily: null, store: null, live: null, history: null, ladder, stats: st, notif: nt, ownerId: me.ownerId, errors: {}, now: Date.now(), colFilter: "All" } as WidgetData;
    for (const type of ["ladder", "form", "notif"] as const) for (const size of ["S", "M", "L"] as const) {
      const h = widgetHtml({ id: "w", type, size }, data, { editing: false });
      clean(h);
      expect(h, `${type} ${size}`).not.toContain("Waits on the server");
      expect(h, `${type} ${size}`).not.toContain("Loading…");
      expect(sourcesOf({ type, size }).length).toBeGreaterThan(0);
    }

    // Mark all read: the server's unread goes to 0, and the widget drops the button.
    await client.markNotificationsRead(token, { all: true });
    const after = await client.notifications(token, 20);
    expect(after.unread).toBe(0);
    expect(after.notifications.every((n) => n.readAt !== null)).toBe(true);
    expect(notifBody("M", after, Date.now(), { miniCard: mc })).not.toContain("notif-read");
  });
});
