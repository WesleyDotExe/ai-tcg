// The Notifications tile in every state the owner API can put it in (render
// session 94, phase 2 "the tiles in groups", group 4's second half, with
// Match history). The Home snapshot holds Nova (24 new: 23 results and the
// free pack, two agents) and Wren (one alert, the free pack), so the states
// between and beyond never reach the page: everything read, a file with no
// alerts at all (a file migrated to v23 starts empty), every kind the API
// writes (a big pull, a Jackpot pack, both of the agent's stops, a cancel
// and an abandon), and the longest names.
//
// Each state is a snapshot owner's real answer with only `notifications`
// (and, for one agent, `play.agents`) changed, in the API's own shape
// (server/OWNER_API.md, "Notifications"). The big pulls name real cards
// from the registry, as made-up pulls for the sheet.
//
// Pure: data in, an HTML string out. Fenced off: nothing outside
// render/season1/ imports it.

import { CARD_REGISTRY } from "@ai-tcg/engine";
import { alertSummary, type Alert, type HomeData, type OwnerData } from "./homeFacts.js";
import { from, statesSheet, type StateCase } from "./statesSheet.js";

const KINDS = ["matchResult", "bigPull", "dailyPack", "autoPlayStopped"] as const;

/** Keep `unread` and `unreadByKind` in step with the list, as the API does. */
export function recount(d: OwnerData) {
  const n = d.notifications.notifications;
  d.notifications.unread = n.filter((a) => !a.readAt).length;
  d.notifications.unreadByKind = Object.fromEntries(KINDS.map((k) => [k, n.filter((a) => !a.readAt && a.kind === k).length]));
}

const at = (min: number) => new Date(Date.parse("2026-11-22T02:20:00.000Z") - min * 60000).toISOString();
const card = (id: string, finish: string, prototype = false) => {
  const c = CARD_REGISTRY.get(id) as { id: string; name: string; rarity: string } | undefined;
  if (!c) throw new Error(`no card ${id} in the registry`);
  return { cardId: c.id, name: c.name, rarity: c.rarity, finish, isNew: true, prototype: prototype ? { run: 1 } : null };
};
const result = (min: number, result: string, opp: string, credits: number, change: number | null, agentName = "Wren's agent"): Alert => ({
  kind: "matchResult", createdAt: at(min), readAt: null,
  matchResult: { result, agentName, opponent: { ownerName: "House " + opp.split(" ")[0], agentName: opp }, credits, rating: change === null ? null : { change }, turns: 14 },
});

export function notifStateCases(data: HomeData): StateCase[] {
  const nova = data.owners.nova!, wren = data.owners.wren!;
  const set = (d: OwnerData, list: Alert[]) => { d.notifications.notifications = list; recount(d); };
  return [
    { id: "served", name: "24 new: 23 results and the free pack, two agents (Nova, as served)", data: nova },
    { id: "new", name: "A new player's one alert: the free pack (Wren, as served)", data: wren },
    { id: "read", name: "Everything read: the same alerts, none new", data: from(nova, (d) => { d.notifications.notifications.forEach((a) => { a.readAt = "2026-11-22T02:25:00.000Z"; }); recount(d); }) },
    { id: "empty", name: "No alerts at all (a file migrated to v23 starts empty)", data: from(wren, (d) => set(d, [])) },
    {
      id: "every-kind", name: "Every kind the API writes, one agent (made-up pulls of real cards)", data: from(wren, (d) => set(d, [
        { kind: "autoPlayStopped", createdAt: at(2), readAt: null, autoPlayStopped: { reason: "timeUp", allowanceMinutes: 45 } },
        { kind: "bigPull", createdAt: at(9), readAt: null, bigPull: { jackpot: false, cards: [card("S0-ZD1", "prototype", true), card("CX-024", "glitch")] } },
        result(15, "cancelled", "Static Widow", 0, null),
        { kind: "bigPull", createdAt: at(31), readAt: null, bigPull: { jackpot: true, cards: [card("AG-014", "gold"), card("SW-006", "fullArt")] } },
        result(48, "abandonedByOpponent", "Hive Courier", 0, 11.2),
        { kind: "dailyPack", createdAt: at(70), readAt: null, dailyPack: { waiting: 2, cap: 2 } },
        { kind: "autoPlayStopped", createdAt: at(1500), readAt: "2026-11-21T20:00:00.000Z", autoPlayStopped: { reason: "dailyRewardsMaxed" } },
      ])),
    },
    {
      id: "long-names", name: "The longest names: two agents, long opponents", data: from(nova, (d) => set(d, [
        result(4, "abandonedByYou", "Sentinel of the Eleventh Firewall", 0, -21.4, "Vector Halcyon the Second"),
        result(20, "draw", "Quorum Cartographer Prime", 2, 0.2, "Quill Static"),
        result(36, "win", "Recursive Lattice Warden", 30, 18, "Vector Halcyon the Second"),
        ...nova.notifications.notifications.slice(1, 4),
      ])),
    },
  ];
}

/** What the drawn tile must agree with: the new count; the rows each size
 * draws (S none, M the newest 3, L 5); the newest alert's words; the
 * "more new" line when more are new than shown. */
export function notifExpect(d: OwnerData) {
  const n = d.notifications.notifications;
  const newIn = (k: number) => n.slice(0, k).filter((a) => !a.readAt).length;
  return {
    unread: d.notifications.unread, m: Math.min(3, n.length), l: Math.min(5, n.length),
    latest: n[0] && d.notifications.unread ? alertSummary(n[0], d).title : "",
    moreM: d.notifications.unread - newIn(3), moreL: d.notifications.unread - newIn(5),
    titles: n.slice(0, 5).map((a) => alertSummary(a, d).title),
  };
}

export function notifStatesPage(data: HomeData): string {
  const cases = notifStateCases(data).map((c) => ({ ...c, expect: notifExpect(c.data) }));
  return statesSheet({ tile: "notif", title: "Notifications", session: 94, cases, note: (c) => {
    const n = c.data.notifications;
    return `${n.notifications.length} alerts · ${n.unread} new · ${c.data.play.agents.length} agent${c.data.play.agents.length === 1 ? "" : "s"}`;
  } });
}
