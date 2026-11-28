// The Daily rewards tile in every state the owner API can put it in (render
// session 93, phase 2 "the tiles in groups", group 4, with Collection). The
// Home snapshot holds Nova (5 wins today, 65 of 90, one free pack waiting)
// and Wren (nothing yet today, one pack waiting), so the states between and
// beyond never reach the page: the free pack claimed, two packs waiting (the
// cap), every win paid (90 of 90), and a day of losses only.
//
// Each state is a snapshot owner's real answer with only `daily` and
// `dailyPack` changed, in the API's own shape (server/OWNER_API.md, "Daily
// rewards" and "The owner's daily pack"): the schedule is the served one
// (1: 30; 2-4: 10; 5-10: 5; 11 on: 0), so the credits follow from the wins.
//
// Pure: data in, an HTML string out. Fenced off: nothing outside
// render/season1/ imports it.

import type { HomeData, OwnerData } from "./homeFacts.js";
import { from, statesSheet, type StateCase } from "./statesSheet.js";

/** n wins and k losses today, paid by the owner's own schedule. */
export function day(d: OwnerData, wins: number, losses: number) {
  const pays = (nth: number) => d.daily.schedule.find((r) => nth >= r.fromWin && (r.toWin === null || nth <= r.toWin))?.credits ?? 0;
  d.daily.wins = Array.from({ length: wins }, (_, i) => ({ nth: i + 1, matchId: `sheet-${i}`, endedAt: new Date(Date.parse("2026-11-21T22:10:00.000Z") + i * 47 * 60000).toISOString(), credits: pays(i + 1) }));
  d.daily.creditsFromWins = d.daily.wins.reduce((s: number, w) => s + (w as { credits: number }).credits, 0);
  d.daily.nextWinPays = pays(wins + 1);
  d.daily.losses = losses;
  const rw = d.daily.wins as { nth: number; endedAt: string; credits: number }[];
  d.daily.rewardedWins = rw.filter((w) => w.credits > 0);
  d.daily.creditsFromLosses = Math.min(losses, d.daily.maxPaidLosses) * 2;
  d.daily.nextLossPays = losses >= d.daily.maxPaidLosses ? 0 : 2;
}

/** The free pack: `waiting` now; null nextPackAt while the cap waits (as the API). */
function pack(d: OwnerData, waiting: number) {
  d.dailyPack.waiting = waiting;
  (d.dailyPack as { nextPackAt: string | null }).nextPackAt = waiting >= d.dailyPack.cap ? null : d.dailyPack.nextPackAt;
}

export function dailyStateCases(data: HomeData): StateCase[] {
  const nova = data.owners.nova!, wren = data.owners.wren!;
  return [
    { id: "served", name: "5 wins today, 65 of 90, the free pack waiting (Nova, as served)", data: nova },
    { id: "new", name: "Nothing yet today, the free pack waiting (Wren, as served)", data: wren },
    { id: "claimed", name: "One win (30), the free pack claimed", data: from(wren, (d) => { day(d, 1, 0); pack(d, 0); }) },
    { id: "two-packs", name: "Two free packs waiting (the cap): nothing more comes until one is claimed", data: from(nova, (d) => { day(d, 2, 1); pack(d, 2); }) },
    { id: "maxed", name: "Every win paid: 10 wins, 90 of 90, pack claimed", data: from(nova, (d) => { day(d, 12, 3); pack(d, 0); }) },
    { id: "losses", name: "A day of losses only: 10 losses (the most that pay), no win yet", data: from(wren, (d) => { day(d, 0, 10); pack(d, 0); }) },
  ];
}

/** What the drawn tile must agree with: the day's credits from wins, the
 * next win's pay, the free packs waiting (Claim when one waits), the step
 * the next win falls in (none once every paid win is in), and L's results
 * (the paid wins, one line for the unpaid ones, one for the losses). */
export function dailyExpect(d: OwnerData) {
  const paid = d.daily.rewardedWins?.length ?? 0;
  const next = d.daily.wins.length + 1;
  const steps = d.daily.schedule.filter((r) => r.toWin !== null);
  return {
    earned: d.daily.creditsFromWins, nextPays: d.daily.nextWinPays, waiting: d.dailyPack.waiting,
    nowStep: steps.findIndex((r) => next >= r.fromWin && next <= r.toWin!),
    results: paid + (d.daily.wins.length > paid ? 1 : 0) + (d.daily.losses ? 1 : 0),
  };
}

export function dailyStatesPage(data: HomeData): string {
  const cases = dailyStateCases(data).map((c) => ({ ...c, expect: dailyExpect(c.data) }));
  return statesSheet({ tile: "daily", title: "Daily rewards", session: 93, cases, note: (c) =>
    `${c.data.daily.wins.length} wins, ${c.data.daily.losses} losses · ${c.data.daily.creditsFromWins} from wins · next win ${c.data.daily.nextWinPays} · ${c.data.dailyPack.waiting} free pack${c.data.dailyPack.waiting === 1 ? "" : "s"} waiting` });
}
