// The Match history tile in every state the owner API can put it in (render
// session 94, phase 2 "the tiles in groups", group 4's second half, with
// Notifications). The Home snapshot holds Nova (23 matches, the newest three
// without replays) and Wren (none), so the states between and beyond never
// reach the page: the first match, every result the API sends (a draw, a
// cancel, both abandons), two agents in one history, a losing day, and the
// longest names.
//
// Each state is a snapshot owner's real answer with only `matches` changed,
// in the API's own shape (server/OWNER_API.md, "Match history").
//
// Pure: data in, an HTML string out. Fenced off: nothing outside
// render/season1/ imports it.

import { resultOf, type HomeData, type OwnerData } from "./homeFacts.js";
import { from, statesSheet, type StateCase } from "./statesSheet.js";

type Row = OwnerData["matches"]["matches"][number];

const row = (i: number, result: string, opp: string, credits: number, change: number | null, o: Partial<Row> = {}): Row => ({
  matchId: `sheet-${i}`, endedAt: new Date(Date.parse("2026-11-22T02:20:00.000Z") - i * 37 * 60000).toISOString(),
  result, credits, rating: change === null ? null : { change }, opponent: { ownerName: "House " + opp.split(" ")[0], agentName: opp },
  agentName: "Wren's agent", turns: 9 + (i % 7), hasReplay: i % 3 !== 1, hasLog: true, ...o,
});

export function historyStateCases(data: HomeData): StateCase[] {
  const nova = data.owners.nova!, wren = data.owners.wren!;
  const set = (d: OwnerData, rows: Row[], total = rows.length) => { d.matches.matches = rows; d.matches.total = total; };
  return [
    { id: "served", name: "23 matches, the newest three before replays were kept (Nova, as served)", data: nova },
    { id: "new", name: "No matches yet (Wren, as served)", data: wren },
    { id: "first", name: "The first match: one win, nothing before it", data: from(wren, (d) => set(d, [row(0, "win", "Static Widow", 30, 41.7)])) },
    {
      id: "every-result", name: "Every result the API sends: a cancel, both abandons, a draw", data: from(wren, (d) => set(d, [
        row(0, "cancelled", "Static Widow", 0, null), row(1, "abandonedByOpponent", "Hive Courier", 0, 12.3), row(2, "draw", "Aegis Bastion", 2, -0.4),
        row(3, "abandonedByYou", "Kernel Moth", 0, -22.8), row(4, "loss", "Static Widow", 2, -15.1), row(5, "win", "Hive Courier", 10, 16.4), row(6, "win", "Aegis Bastion", 30, 20.9),
      ], 41)),
    },
    {
      id: "two-agents", name: "Two agents in one history (Nova's two)", data: from(nova, (d) => set(d, nova.matches.matches.map((m, i) => ({ ...m, agentName: i % 2 ? "Quill Static" : m.agentName })), nova.matches.total)),
    },
    {
      id: "losing-day", name: "A losing day: six losses in a row, replays kept", data: from(wren, (d) => set(d, Array.from({ length: 7 }, (_, i) => row(i, "loss", ["Static Widow", "Hive Courier", "Aegis Bastion"][i % 3]!, 2, -(14 + i * 3), { hasReplay: true })), 7)),
    },
    {
      id: "long-names", name: "The longest names, two agents", data: from(nova, (d) => set(d, [
        row(0, "win", "Sentinel of the Eleventh Firewall", 10, 18.2, { agentName: "Vector Halcyon the Second" }),
        row(1, "loss", "Quorum Cartographer Prime", 2, -12, { agentName: "Quill Static" }),
        row(2, "abandonedByOpponent", "Recursive Lattice Warden", 0, 9.6, { agentName: "Vector Halcyon the Second" }),
        row(3, "win", "Hive Courier", 5, 7.1, { agentName: "Quill Static" }),
      ], 4)),
    },
  ];
}

/** What the drawn tile must agree with: the last result's words (or "No
 * matches yet"); the rows before it at each size (M 3, L 6; none at S); a
 * Replay link at L only for a row with a replay. */
export function historyExpect(d: OwnerData) {
  const m = d.matches.matches;
  return {
    last: m[0] ? resultOf(m[0].result).word : "No matches yet", m: Math.max(0, Math.min(3, m.length - 1)), l: Math.max(0, Math.min(6, m.length - 1)),
    replays: m.slice(1, 7).filter((x) => x.hasReplay).length, shorts: m.slice(1, 7).map((x) => resultOf(x.result).short),
  };
}

export function historyStatesPage(data: HomeData): string {
  const cases = historyStateCases(data).map((c) => ({ ...c, expect: historyExpect(c.data) }));
  return statesSheet({ tile: "history", title: "Match history", session: 94, cases, note: (c) => `${c.data.matches.matches.length} shown of ${c.data.matches.total} · ${new Set(c.data.matches.matches.map((x) => x.agentName)).size} agent(s)` });
}
