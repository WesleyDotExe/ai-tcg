// The Ladder tile in every state the owner API can put it in (render
// session 89, phase 2 "the tiles in groups", group 2: the Ladder tile with
// Rating & form merged in). The Home snapshot holds Nova (rank 1 of 2,
// Platinum, settling, down this week) and Wren (no match yet), so the
// states between and beyond them never reach the page: part-way through
// placement, just placed, settled, the top tier, far down a long ladder
// (with long names and a draw). This sheet draws each at S, M and L on the
// grid's three units, for ci/tile-states-check.mjs to measure.
//
// Each state is a snapshot owner's real answer with only the rating, ladder
// and stats fields changed, in the API's own shape (server/OWNER_API.md,
// "The ladder and the rating"): the tier always follows from the rating
// and the ladder's tier floors, the rank from the standings.
//
// Pure: data in, an HTML string out. Fenced off: nothing outside
// render/season1/ imports it.

import { climbOf, isPlaced, type HomeData, type OwnerData } from "./homeFacts.js";
import { from, statesSheet, type StateCase } from "./statesSheet.js";

type Standing = OwnerData["ladder"]["standings"][number];
type Result = "win" | "loss" | "draw";

const tierFor = (d: OwnerData, rating: number) => [...d.ladder.tiers].reverse().find((t) => t.from === null || t.from <= rating)!.tier;

/** Make the owner placed at a rating and rank, the standings re-ranked by
 * rating (ranked rows only; rows in placement keep rank null). */
function placeAt(d: OwnerData, o: { rating: number; rd: number; matches: number; week: number; recent: Result[]; streak?: { kind: string; length: number } | null; best?: number }) {
  const tier = tierFor(d, o.rating);
  Object.assign(d.rating.rating, { rating: o.rating, rd: o.rd, ratedMatches: o.matches, tier });
  const me = d.ladder.you.ownerName;
  const others = d.ladder.standings.filter((s) => s.ownerName !== me);
  const wins = o.recent.filter((r) => r === "win").length;
  const mine: Standing = { ...(d.ladder.standings.find((s) => s.ownerName === me) ?? d.ladder.standings[0]!), ownerName: me, agent: { name: d.play.connectedAgent?.name ?? "agent" }, rating: o.rating, tier, rank: 0, wins, losses: o.matches - wins };
  rerank(d, [...others, mine]);
  d.stats.rating.weekChange = o.week;
  d.stats.recent = o.recent.map((result) => ({ result }));
  d.stats.totals = { ...d.stats.totals, matches: o.matches, wins, losses: o.matches - wins, currentStreak: o.streak === undefined ? d.stats.totals.currentStreak : o.streak, bestWinStreak: o.best ?? d.stats.totals.bestWinStreak };
  // The chart's last points walk to the rating (the API serves a 30-day series).
  const ch = d.stats.rating.chart;
  // A week ago it was rating - week; the last 7 days walk there in a line.
  ch.forEach((p, i) => { const back = ch.length - 1 - i; if (p.rating !== null) p.rating = o.rating - o.week * Math.min(1, back / 7) - (back > 7 ? 6 * Math.sin(i) : 0); });
}

function rerank(d: OwnerData, rows: Standing[]) {
  const ranked = rows.filter((s) => s.rank !== null).sort((a, b) => b.rating - a.rating);
  ranked.forEach((s, i) => { s.rank = i + 1; s.tier = tierFor(d, s.rating); });
  d.ladder.standings = [...ranked, ...rows.filter((s) => s.rank === null)];
  const me = ranked.find((s) => s.ownerName === d.ladder.you.ownerName);
  d.ladder.you = { ...d.ladder.you, rank: me ? me.rank : null };
}

const extra = (name: string, rating: number): Standing => ({ rank: 0, ownerName: name, agent: { name: `${name}'s agent` }, rating, tier: "", wins: 10, losses: 10 });

/** Set the chart's last days to a series (render 92: the chart's own states;
 * the days before the series hold its first value, as an idle stretch does). */
function chartEndingIn(d: OwnerData, series: number[]) {
  const ch = d.stats.rating.chart, off = ch.length - series.length;
  ch.forEach((p, i) => { p.rating = series[Math.max(0, i - off)]!; p.rated = i >= off && i > 0 && series[i - off] !== series[Math.max(0, i - off - 1)] ? 3 : 0; });
}

export function ladderStateCases(data: HomeData): StateCase[] {
  const nova = data.owners.nova!, wren = data.owners.wren!;
  return [
    { id: "placed", name: "Placed, #1, settling, down this week (Nova, as served)", data: nova },
    { id: "new", name: "Just signed up, 0 of 5 (Wren, as served)", data: wren },
    { id: "placing", name: "Part-way through placement: 3 of 5", data: from(wren, (d) => {
      Object.assign(d.rating.rating, { rating: 1561, rd: 260, ratedMatches: 3, tier: "Placement" });
      d.stats.recent = (["win", "loss", "win"] as Result[]).map((result) => ({ result }));
      d.stats.totals = { ...d.stats.totals, matches: 3, wins: 2, losses: 1, currentStreak: { kind: "win", length: 1 }, bestWinStreak: 1 };
      d.matches.total = 3;
      d.stats.byFaction[0] = { ...d.stats.byFaction[0]!, matches: 3, wins: 2, winRate: 2 / 3 };
    }) },
    { id: "just-placed", name: "Just placed: Gold, #2 of 3, settling", data: from(wren, (d) => {
      placeAt(d, { rating: 1583, rd: 238, matches: 5, week: 83, recent: ["win", "win", "loss", "win", "loss"], streak: { kind: "win", length: 2 }, best: 2 });
      d.matches.total = 5;
      d.stats.byFaction[2] = { ...d.stats.byFaction[2]!, matches: 5, wins: 3, winRate: 0.6 };
    }) },
    { id: "settled", name: "Settled, up this week", data: from(nova, (d) => placeAt(d, { rating: 1716, rd: 84, matches: 61, week: 42, recent: ["win", "win", "win", "loss", "win", "win", "loss", "win", "win", "win"], streak: { kind: "win", length: 3 } })) },
    { id: "top-tier", name: "The top tier: Mythic, #1", data: from(nova, (d) => placeAt(d, { rating: 2012, rd: 71, matches: 140, week: 0, recent: ["win", "win", "win", "win", "win", "win", "win", "win", "win", "win"], streak: { kind: "win", length: 12 }, best: 19 })) },
    // The chart's own states (render 92, owner 2026-11-28 point 8): a big day
    // in the middle of the month, crossing a floor; and a volatile month with
    // more big days than the chart draws as steps.
    { id: "big-day", name: "A big day mid-month: +164 in one day, up through the Diamond floor", data: from(nova, (d) => {
      placeAt(d, { rating: 1866, rd: 96, matches: 74, week: 22, recent: ["win", "win", "loss", "win", "win", "win", "loss", "win", "win", "win"], streak: { kind: "win", length: 3 } });
      chartEndingIn(d, [1668, 1671, 1665, 1672, 1676, 1680, 1677, 1683, 1690, 1686, 1694, 1858, 1851, 1847, 1855, 1849, 1844, 1850, 1856, 1852, 1858, 1861, 1857, 1860, 1864, 1866]);
    }) },
    { id: "volatile", name: "A volatile month: six big days, across three floors", data: from(nova, (d) => {
      placeAt(d, { rating: 1712, rd: 168, matches: 31, week: -96, recent: ["loss", "win", "loss", "loss", "win", "win", "loss", "win", "loss", "win"], streak: { kind: "loss", length: 1 } });
      chartEndingIn(d, [1500, 1500, 1610, 1622, 1615, 1490, 1484, 1495, 1690, 1702, 1698, 1560, 1566, 1559, 1571, 1745, 1752, 1740, 1808, 1801, 1795, 1712]);
    }) },
    { id: "far-down", name: "Far down a long ladder: Bronze, #5 of 7, long names, a draw", data: from(nova, (d) => {
      d.ladder.standings.push(extra("Quantum Lattice Overseer", 1902), extra("Penumbra Cartographer", 1611), extra("Halcyon Driftworks", 1498), extra("Ossuary Nine", 1402), extra("Little Engine That Could", 1168));
      placeAt(d, { rating: 1291, rd: 122, matches: 48, week: -121, recent: ["loss", "loss", "draw", "loss", "loss", "win", "loss", "win", "loss", "loss"], streak: { kind: "loss", length: 2 }, best: 4 });
      d.stats.byFaction = d.stats.byFaction.map((f, i) => ({ ...f, matches: [20, 14, 9, 5][i]!, wins: [8, 5, 3, 1][i]!, winRate: [8 / 20, 5 / 14, 3 / 9, 1 / 5][i]! }));
    }) },
  ];
}

export function ladderStatesPage(data: HomeData): string {
  return statesSheet({ tile: "ladder", title: "Ladder", session: 89, cases: ladderStateCases(data), note: (c) => {
    const k = climbOf(c.data);
    return isPlaced(c.data) ? `${c.data.rating.rating.tier} · #${c.data.ladder.you.rank} · ${k.kind === "top" ? "top tier" : `${k.points} to ${k.next}`}` : `in placement · ${k.done} of ${k.of}`;
  } });
}
