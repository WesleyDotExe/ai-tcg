// The Daily rewards widget at S, M and L (render session 66; the owner's
// 2026-11-06 Season 0 brief, section 1):
//
//   S  a progress ring: credits from wins today, of the most wins can pay
//      (0/90 at Season 0's schedule);
//   M  + the row of today's rewards with the claim button underneath: the
//      free daily pack (the only reward an owner claims) and one node per
//      paying win, sized by what it pays, ticked once paid;
//   L  + the reset timer (ticking), rewarded wins (n/10) as a bar, the next
//      win's payout, today's wins and losses as the server counted them.
//
// Pure: strings from `GET /api/daily` (and at M and L the free pack from
// `GET /api/packs`), so the tests draw every size in Node and the page shows
// exactly that. Nothing is invented: wins pay themselves when the match is
// recorded (ECONOMY.md), so their nodes have no button; the pack's is the
// page's existing `claim-daily` action. Season 0 has no quests, weekly
// challenge or streak reward (the brief keeps them out), and the widget says
// so once, at L.

import type { SiteDaily } from "./siteBoard.js";
import { dailyView } from "./siteBoard.js";
import type { SiteDailyPack } from "./siteApi.js";
import { clockLeft } from "./siteShop.js";
import { zoneCity } from "./siteStore.js";
import { amount } from "./siteLook.js";
import { esc } from "./siteModel.js";
import type { SeasonFrozen } from "./siteSeason.js";

/** One paying win of the day, as the reward row draws it. */
export interface WinStep {
  nth: number;
  /** What this win paid (the server's, once paid) or will pay (the
   * schedule's). */
  credits: number;
  /** What the schedule pays for this place in the day: the node's size, so
   * the row keeps the schedule's shape even when a paid figure differs (the
   * server counts the place by end time, the payout by recording order; the
   * two can differ only if matches are recorded out of order). */
  slot: number;
  /** paid: the win is recorded (its credits the server's); next: the next
   * win lands here; ahead: later. */
  state: "paid" | "next" | "ahead";
  /** The schedule row this win sits in (0 = the first win's row): the row
   * draws a small gap between rows. */
  band: number;
  endedAt: string | null;
}

/** The paying wins of the day, from the server's schedule (the rows with
 * an end and a payout; the open "and after" row pays nothing in Season 0,
 * and one that paid would have no last node to draw). */
export function winSteps(d: SiteDaily): WinStep[] {
  const out: WinStep[] = [];
  const nextNth = d.wins.length + 1;
  d.schedule.forEach((row, band) => {
    if (row.toWin === null || row.credits <= 0) return;
    for (let n = row.fromWin; n <= row.toWin; n++) {
      const win = d.wins.find((w) => w.nth === n) ?? null;
      out.push({ nth: n, credits: win ? win.credits : row.credits, slot: row.credits, state: win ? "paid" : n === nextNth && d.nextWinPays > 0 ? "next" : "ahead", band, endedAt: win?.endedAt ?? null });
    }
  });
  return out;
}

/** The ring: credits from wins of the day's most, as an SVG arc (it grows
 * from empty when drawn, off under reduce motion). */
export function dailyRingSvg(fromWins: number, cap: number, px: number): string {
  const r = 42;
  const len = 2 * Math.PI * r;
  const pct = cap > 0 ? Math.max(0, Math.min(1, fromWins / cap)) : 0;
  const full = pct >= 1 ? " full" : "";
  return `<span class="dr-ring${full}" style="--s:${px}px" role="img" aria-label="${fromWins} of ${cap} credits from wins today">`
    + `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="dr-tr" cx="50" cy="50" r="${r}"/><circle class="dr-arc" cx="50" cy="50" r="${r}" style="--len:${len.toFixed(1)};--off:${(len * (1 - pct)).toFixed(1)}"/></svg>`
    + `<span class="dr-rv"><b>${fromWins}</b><small>of ${cap}</small></span></span>`;
}

/** The free daily pack's node: Claim while one waits (with how many), else
 * "Claimed" and the ticking clock to the next (the server's `nextPackAt`). */
export function packNodeHtml(p: SiteDailyPack | null, nowMs: number, frozen: SeasonFrozen | null = null): string {
  // Render session 73: the season has ended: nothing to claim, no next one.
  if (frozen) return `<li class="dr-pk done closed"><span class="dr-pki" aria-hidden="true"></span><span class="dr-lb">Free pack</span><button type="button" class="btn sm" disabled title="${esc(frozen.daily)}">Closed</button><span class="dr-nx">${esc(frozen.short)}</span></li>`;
  if (!p) return `<li class="dr-pk wait"><span class="dr-pki" aria-hidden="true"></span><span class="dr-lb">Free pack</span><span class="muted small">Loading…</span></li>`;
  const n = p.waiting;
  if (n > 0) {
    return `<li class="dr-pk on"><span class="dr-pki" aria-hidden="true">${n > 1 ? `<b>${n}</b>` : ""}</span><span class="dr-lb">Free pack</span>`
      + `<button type="button" class="btn pri sm" data-act="claim-daily">${n > 1 ? `Claim (${n})` : "Claim"}</button></li>`;
  }
  const next = p.nextPackAt ? `<b class="sh-clock" data-until="${esc(p.nextPackAt)}">${clockLeft(nowMs, p.nextPackAt)}</b>` : "";
  return `<li class="dr-pk done"><span class="dr-pki" aria-hidden="true"></span><span class="dr-lb">Free pack</span>`
    + `<button type="button" class="btn sm" disabled>Claimed</button>${next ? `<span class="dr-nx">next in ${next}</span>` : ""}</li>`;
}

function winNodeHtml(s: WinStep, first: boolean): string {
  const tier = s.slot >= 30 ? "t3" : s.slot >= 10 ? "t2" : "t1";
  const what = s.state === "paid" ? `paid ${s.credits}` : s.state === "next" ? `pays ${s.credits}, next` : `pays ${s.credits}`;
  return `<li class="dr-w ${s.state} ${tier}${first ? " band" : ""}" title="Win ${s.nth}: ${what}"><span class="dr-wn" aria-hidden="true">${s.state === "paid" ? "✓" : s.nth}</span><span class="dr-wc">+${s.credits}</span><span class="vh">Win ${s.nth}, ${what}</span></li>`;
}

/** The row of the day's rewards: the free pack, then each paying win. */
export function rewardRowHtml(d: SiteDaily, pack: SiteDailyPack | null, nowMs: number, frozen: SeasonFrozen | null = null): string {
  const steps = winSteps(d);
  const wins = steps.map((s, i) => winNodeHtml(s, i > 0 && steps[i - 1]!.band !== s.band)).join("");
  return `<ol class="dr-row" aria-label="Today's rewards">${packNodeHtml(pack, nowMs, frozen)}${wins}</ol>`;
}

function nextLine(d: SiteDaily, frozen: SeasonFrozen | null = null): string {
  if (frozen) return esc(frozen.wins);
  return d.nextWinPays > 0 ? `Next win <b>+${d.nextWinPays}</b>` : "Wins pay nothing more today";
}

function clockTime(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  const x = new Date(t);
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}

/** The Daily rewards widget's body at its size. `pack` is the free daily
 * pack from `GET /api/packs` (M and L; null while that read is out). */
export function dailyBody(size: "S" | "M" | "L", d: SiteDaily, pack: SiteDailyPack | null, nowMs: number, frozen: SeasonFrozen | null = null): string {
  const v = dailyView(d, nowMs);
  if (size === "S") {
    return `<div class="dr-s">${dailyRingSvg(v.fromWins, v.winCap, 72)}<div class="dn"><b>Credits from wins</b><div class="small">${nextLine(d, frozen)}</div></div></div>`;
  }
  const head = `<div class="dr-head">${dailyRingSvg(v.fromWins, v.winCap, size === "L" ? 104 : 84)}<div class="dn"><b>Credits from wins today</b><div class="dr-next">${nextLine(d, frozen)}</div>`
    + (size === "M" ? `<div class="muted small">${v.rewarded} of ${v.rewardedCap} wins paid</div>` : "")
    + `</div></div>`;
  const row = rewardRowHtml(d, pack, nowMs, frozen);
  if (size === "M") return head + row;
  const city = zoneCity(d.timeZone);
  const reset = frozen ? "" : `<div class="dr-reset"><span class="sh-clock-ic" aria-hidden="true"></span><span>Resets in</span><b class="sh-clock" data-until="${esc(d.resetsAt)}">${clockLeft(nowMs, d.resetsAt)}</b><small>midnight ${esc(city)}</small></div>`;
  const pct = v.rewardedCap > 0 ? Math.min(100, Math.round((v.rewarded / v.rewardedCap) * 100)) : 0;
  const rewarded = `<div class="dr-rw"><div class="row between"><b>Rewarded wins</b><span class="dr-rwn"><b>${v.rewarded}</b>/${v.rewardedCap}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  const wins = d.rewardedWins.length
    ? `<ul class="dr-list">${d.rewardedWins.map((x) => `<li><span class="wl w">W</span><span>Win ${x.nth}</span><span class="muted">${esc(clockTime(x.endedAt))}</span><b>+${x.credits}</b></li>`).join("")}</ul>`
    : `<p class="muted small">No rewarded wins yet today.</p>`;
  const paidLosses = Math.min(d.losses, d.maxPaidLosses);
  const losses = `<div class="small">Losses and draws: <b>${d.losses}</b> · ${paidLosses} of ${d.maxPaidLosses} paid · +${d.creditsFromLosses}${d.nextLossPays > 0 ? ` <span class="muted">(next pays ${d.nextLossPays})</span>` : ""}</div>`;
  return head + row + reset + rewarded + `<h4>Today's wins</h4>${wins}${losses}<div class="dr-tot"><span>In all today</span><b>${amount(d.credits)}</b><small>credits</small></div><p class="muted small dr-nq">No quests, weekly challenge or streak in Season 0.</p>`;
}
