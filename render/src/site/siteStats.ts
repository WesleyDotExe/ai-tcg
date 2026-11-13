// The Stats page (render session 68; the 2026-10-05 spec's Stats page, as the
// server serves it since game session 78, and roadmap render item 5, the
// ladder, placed inside the Stats page: a checkpoint call).
//
//   the filter     "All agents" or one agent (`agents`, the server's), and
//                  the chart's reach: 7, 30 or 90 reset days;
//   the rating     the tier badge, the rating and its RD, the week's change,
//                  the tier bar to the next tier, and the rating chart over
//                  the days with each day's results as columns under it;
//   the totals     matches, wins, win rate, best and current streak, credits
//                  from matches, and the void ones (cancelled or abandoned);
//   today          the day's earnings (`today`, the same as GET /api/daily):
//                  credits from wins of the most, rewarded wins, losses paid,
//                  the day's total and the reset clock;
//   factions       win rate by the faction the owner's deck played, and by the
//                  opponent's, with each W-L-D;
//   recent         the last results, each with its Replay;
//   the ladder     the tiers with how many owners stand in each, and the whole
//                  public list (the top 100) with the owner's row lit.
//
// Pure: strings from the server's answers (`GET /api/stats`, `GET
// /api/ladder`), so the tests draw the page in Node and the browser shows
// exactly that. Nothing here invents a figure: what the server doesn't send
// isn't drawn (quests and achievements come after Season 0, owner
// 2026-11-06; matches recorded before schema v24 kept no faction and are
// counted apart, as the server counts them).

import type { SiteDaily } from "./siteBoard.js";
import { dailyView } from "./siteBoard.js";
import { dailyRingSvg } from "./siteDaily.js";
import { clockLeft } from "./siteShop.js";
import { zoneCity } from "./siteStore.js";
import { amount } from "./siteLook.js";
import { FACTION_HEX, esc } from "./siteModel.js";
import { signed, whenText } from "./siteMatches.js";
import { seasonEndHtml, seasonEndView, type SiteSeason } from "./siteSeason.js";
import {
  formPips,
  ratingChartSvg,
  TIER_HEX,
  tierBadge,
  tierLadderHtml,
  tierProgress,
  weekTrend,
  type SiteLadder,
  type SiteLadderRow,
  type SiteResult,
  type SiteStats,
  type SiteTally,
} from "./siteStanding.js";

export type StatsDays = 7 | 30 | 90;
/** The chart's reach (the server takes 7 to 90 reset days). */
export const STATS_DAYS: StatsDays[] = [7, 30, 90];
/** How many recent results the page asks for (the server takes 1 to 50). */
export const STATS_RECENT = 20;

export interface StatsPageState {
  stats: SiteStats | null;
  ladder: SiteLadder | null;
  /** Which matches have a replay (`hasReplay` from the history's newest
   * page, by match id); null until read. A recent row not in it shows no
   * Replay button: the stats don't say, and a guess could 404. */
  replays: Record<string, boolean> | null;
  /** "Show all" pressed on the recent results (else the newest few). */
  allRecent: boolean;
  /** The agent filter: an agent id, or null for "All agents". */
  agent: string | null;
  days: StatsDays;
  loading: boolean;
  error: string | null;
  ladderError: string | null;
  /** `GET /api/season` (render session 72): the season's end under the
   * ladder's title; null until read (or on a server without it). */
  season?: SiteSeason | null;
}

// ---- the filter ----------------------------------------------------------------------

/** "All agents" and each of the owner's agents (the server's list, oldest
 * first, with its matches all time), then the chart's reach. */
export function statsFilterHtml(s: SiteStats | null, st: Pick<StatsPageState, "agent" | "days" | "loading">): string {
  const agents = s?.agents ?? [];
  const pill = (id: string | null, label: string, n: number | null) => {
    const on = (st.agent ?? null) === id;
    return `<button type="button" class="pill${on ? " on" : ""}" data-act="stats-agent" data-agent="${esc(id ?? "")}" aria-pressed="${on}">${esc(label)}${n === null ? "" : ` <small>${n}</small>`}</button>`;
  };
  const all = agents.reduce((a, x) => a + x.matches, 0);
  const pills = agents.length > 1 || st.agent !== null
    ? `<div class="pills st-agents" role="group" aria-label="Whose matches">${pill(null, "All agents", all)}${agents.map((a) => pill(a.agentId, a.name, a.matches)).join("")}</div>`
    : `<span class="small muted">${agents.length ? `${esc(agents[0]!.name)} · ${agents[0]!.matches} match${agents[0]!.matches === 1 ? "" : "es"}` : "No agent yet"}</span>`;
  const days = `<div class="seg" id="stats-days" role="group" aria-label="The chart's days">${STATS_DAYS.map((d) => `<button type="button" data-v="${d}" aria-pressed="${st.days === d}">${d} days</button>`).join("")}</div>`;
  return `<div class="st-filter">${pills}<span class="sp"></span>${st.loading ? `<span class="small muted st-busy" role="status">Reading…</span>` : ""}${days}</div>`;
}

// ---- the rating ----------------------------------------------------------------------

/** Each day's results as columns under the chart, on the chart's own x
 * (the same padding as `ratingChartSvg` with labels): wins up in green,
 * losses down in red, draws a grey cap on the wins. A day with none is a
 * dot on the line. */
export function dayColumnsSvg(chart: SiteStats["rating"]["chart"], w: number, h: number): string {
  if (chart.length < 2) return "";
  const padX = 30;
  const mid = Math.round(h / 2);
  const most = Math.max(1, ...chart.map((c) => Math.max(c.wins + c.draws, c.losses)));
  const unit = (mid - 2) / most;
  const step = (w - padX - 4) / (chart.length - 1);
  const bw = Math.max(2, Math.min(14, step * 0.62));
  const x = (i: number) => padX + i * step;
  const cols = chart.map((c, i) => {
    const cx = x(i);
    const left = (cx - bw / 2).toFixed(1);
    const tip = `${c.day}: ${c.wins}W ${c.losses}L${c.draws ? ` ${c.draws}D` : ""}`;
    if (!c.wins && !c.losses && !c.draws) return `<circle class="dc-z" cx="${cx.toFixed(1)}" cy="${mid}" r="1.3"><title>${esc(`${c.day}: no rated match`)}</title></circle>`;
    const win = c.wins ? `<rect class="dc-w" x="${left}" y="${(mid - c.wins * unit).toFixed(1)}" width="${bw.toFixed(1)}" height="${(c.wins * unit).toFixed(1)}" rx="1.5"/>` : "";
    const draw = c.draws ? `<rect class="dc-d" x="${left}" y="${(mid - (c.wins + c.draws) * unit).toFixed(1)}" width="${bw.toFixed(1)}" height="${(c.draws * unit).toFixed(1)}" rx="1.5"/>` : "";
    const loss = c.losses ? `<rect class="dc-l" x="${left}" y="${mid + 1}" width="${bw.toFixed(1)}" height="${(c.losses * unit).toFixed(1)}" rx="1.5"/>` : "";
    return `<g><title>${esc(tip)}</title>${win}${draw}${loss}</g>`;
  }).join("");
  const days = chart.filter((c) => c.wins + c.losses + c.draws).length;
  return `<svg class="dcols" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(`Results by day: ${days} of ${chart.length} days with rated matches`)}"><line class="dc-axis" x1="${padX}" x2="${w - 4}" y1="${mid + 0.5}" y2="${mid + 0.5}"/>${cols}<text class="rc-l" x="${padX - 4}" y="${mid - 4}" text-anchor="end">W</text><text class="rc-l" x="${padX - 4}" y="${mid + 12}" text-anchor="end">L</text></svg>`;
}

export function ratingHeroHtml(s: SiteStats, ladder: SiteLadder | null, days: StatsDays): string {
  const now = s.rating.now;
  const placed = now.tier !== "Placement";
  const t = weekTrend(s);
  const you = ladder?.you;
  const rank = you ? (you.rank === null ? (now.ratedMatches ? "In placement" : "Unranked") : `#${you.rank} of ${ladder!.owners}`) : "";
  const prog = ladder ? tierProgress({ tier: now.tier, rating: now.rating, ratedMatches: now.ratedMatches }, ladder.tiers, ladder.placementMatches) : null;
  const bar = prog
    ? `<div class="st-tier"><div class="tbar" style="--t:${TIER_HEX[prog.tier] ?? "#8f8cff"};--n:${TIER_HEX[prog.next ?? prog.tier] ?? "#8f8cff"}" role="img" aria-label="${esc(prog.line)}"><i style="width:${prog.pct}%"></i></div><span class="small">${esc(prog.line)}</span></div>`
    : "";
  const head = `<div class="st-rh">${tierBadge(now.tier, 64)}<div class="st-rv"><b>${esc(placed ? t.value : "—")}</b><small class="muted">${esc(now.tier)}${placed ? ` · ±${Math.round(now.rd)}` : ` · ${now.ratedMatches} rated`}${rank ? ` · ${esc(rank)}` : ""}</small></div><div class="st-wk rt ${t.tone}"><b>${esc(t.change)}</b><small>this week</small></div></div>`;
  const first = s.rating.chart[0];
  const span = first ? `${days} days · from ${Math.round(first.rating)}` : `${days} days`;
  const filtered = s.agentId !== null ? `<p class="muted small">The rating is yours, one per owner, whichever agent played; everything else on this page is ${esc(s.agents.find((a) => a.agentId === s.agentId)?.name ?? "this agent")}'s.</p>` : "";
  return `<section class="panel glass st-hero">${head}${bar}<div class="row between nowrap st-ch"><h4>Rating</h4><span class="muted small">${esc(span)}</span></div><div class="st-chart">${ratingChartSvg(s.rating.chart, ladder?.tiers ?? null, 760, 190, { labels: true })}${dayColumnsSvg(s.rating.chart, 760, 56)}</div>${filtered}</section>`;
}

// ---- the totals ----------------------------------------------------------------------

function decided(t: Pick<SiteTally, "wins" | "losses" | "draws">): number {
  return t.wins + t.losses + t.draws;
}

function pct(t: SiteTally): string {
  return decided(t) ? `${Math.round(t.winRate * 100)}%` : "—";
}

export function totalsHtml(s: SiteStats): string {
  const t = s.totals;
  const cur = t.currentStreak && t.currentStreak.length >= 2 ? (t.currentStreak.kind === "win" ? `${t.currentStreak.length} wins` : `${t.currentStreak.length} losses`) : "None";
  const curTone = t.currentStreak && t.currentStreak.length >= 2 ? (t.currentStreak.kind === "win" ? " hot" : " cold") : "";
  const n = decided(t);
  const ring = `<div class="ring wr st-ring" style="--p:${n ? Math.round(t.winRate * 100) : 0}" role="img" aria-label="${n ? `${pct(t)} of ${n} decided matches won` : "No decided match yet"}"><b>${pct(t)}</b></div>`;
  const tile = (v: string, label: string, cls = "") => `<div class="st-t${cls}"><b>${esc(v)}</b><span>${esc(label)}</span></div>`;
  return `<section class="panel glass st-tot"><div class="st-wr">${ring}<div><b>Win rate</b><small class="muted">${n ? `of ${n} decided` : "no decided match yet"}</small></div></div><div class="st-tiles">${tile(String(t.matches), "matches")}${tile(String(t.wins), "wins", " w")}${tile(String(t.losses), "losses", " l")}${tile(String(t.draws), "draws")}${tile(String(t.bestWinStreak), "best streak")}${tile(cur, "streak now", curTone)}${tile(amount(t.creditsFromMatches), "credits from matches")}</div>${t.void ? `<p class="muted small">${t.void} void (cancelled or abandoned): they count for nobody and paid nothing.</p>` : ""}</section>`;
}

// ---- today ---------------------------------------------------------------------------

/** Today's earnings, the server's `today` (the same as GET /api/daily). */
export function todayHtml(d: SiteDaily, nowMs: number): string {
  const v = dailyView(d, nowMs);
  const paidLosses = Math.min(d.losses, d.maxPaidLosses);
  const rw = v.rewardedCap > 0 ? Math.min(100, Math.round((v.rewarded / v.rewardedCap) * 100)) : 0;
  const reset = `<div class="dr-reset"><span class="sh-clock-ic" aria-hidden="true"></span><span>Resets in</span><b class="sh-clock" data-until="${esc(d.resetsAt)}">${clockLeft(nowMs, d.resetsAt)}</b><small>midnight ${esc(zoneCity(d.timeZone))}</small></div>`;
  return `<section class="panel glass st-today"><div class="row between nowrap"><h4>Today</h4><span class="st-day muted small">${esc(d.day)}</span></div>`
    + `<div class="st-td">${dailyRingSvg(v.fromWins, v.winCap, 96)}<div class="wcol"><div class="dr-tot"><span>Earned today</span><b>${amount(d.credits)}</b><small>credits</small></div>`
    + `<div class="small">From wins <b>${d.creditsFromWins}</b> of ${v.winCap} · from losses and draws <b>${d.creditsFromLosses}</b></div>`
    + `<div class="small">${d.nextWinPays > 0 ? `Next win pays <b>+${d.nextWinPays}</b>` : "Wins pay nothing more today"}${d.nextLossPays > 0 ? ` · next loss <b>+${d.nextLossPays}</b>` : ""}</div></div></div>`
    + `<div class="dr-rw"><div class="row between"><b>Rewarded wins</b><span class="dr-rwn"><b>${v.rewarded}</b>/${v.rewardedCap}</span></div><div class="bar"><i style="width:${rw}%"></i></div></div>`
    + `<div class="small">Losses and draws today: <b>${d.losses}</b> · ${paidLosses} of ${d.maxPaidLosses} paid</div>${reset}</section>`;
}

// ---- factions ------------------------------------------------------------------------

export function factionTableHtml(title: string, rows: (SiteTally & { faction: string })[], notRecorded: SiteTally, what: string): string {
  const list = rows.map((f) => {
    const n = decided(f);
    const p = n ? Math.round(f.winRate * 100) : 0;
    return `<li style="--c:${FACTION_HEX[f.faction] ?? "#8f8cff"}"${n ? "" : ` class="none"`}><span class="ftag">${esc(f.faction.toUpperCase())}</span><span class="fb-b" role="img" aria-label="${esc(n ? `${f.faction}: ${p}% of ${n}` : `${f.faction}: none`)}"><i style="width:${n ? Math.max(3, p) : 0}%"></i></span><b class="st-fp">${n ? `${p}%` : "—"}</b><span class="small muted st-fr">${n ? `${f.wins}-${f.losses}${f.draws ? `-${f.draws}` : ""}` : "none"}${f.void ? ` · ${f.void} void` : ""}</span></li>`;
  }).join("");
  const nr = notRecorded.matches ? `<p class="muted small">${notRecorded.matches} older match${notRecorded.matches === 1 ? "" : "es"} kept no ${what}${decided(notRecorded) ? ` (${notRecorded.wins}-${notRecorded.losses}${notRecorded.draws ? `-${notRecorded.draws}` : ""})` : ""}.</p>` : "";
  return `<section class="panel glass st-fac"><h4>${esc(title)}</h4><ul class="st-fbars">${list}</ul>${nr}</section>`;
}

// ---- recent results ------------------------------------------------------------------

const RESULT: Record<SiteResult, { letter: string; tone: string; word: string }> = {
  win: { letter: "W", tone: "w", word: "Won" },
  loss: { letter: "L", tone: "l", word: "Lost" },
  draw: { letter: "D", tone: "d", word: "Drew" },
  cancelled: { letter: "–", tone: "x", word: "Cancelled" },
  abandonedByYou: { letter: "L", tone: "l", word: "You abandoned" },
  abandonedByOpponent: { letter: "W", tone: "w", word: "Opponent abandoned" },
};

function ftag(faction: string | null): string {
  return faction ? `<span class="ftag" style="--c:${FACTION_HEX[faction] ?? "#8f8cff"}">${esc(faction.toUpperCase())}</span>` : "";
}

/** Recent rows shown before "Show all" (the column stays about as tall as the page's main one). */
export const RECENT_SHOWN = 8;

export function recentHtml(s: SiteStats, nowMs: number, replays: Record<string, boolean> | null = null, all = false): string {
  if (!s.recent.length) return `<section class="panel glass st-rec"><h4>Recent results</h4><p class="muted small">No results yet. Your agent's matches show here once they are recorded.</p></section>`;
  const rows = s.recent.slice(0, all ? s.recent.length : RECENT_SHOWN).map((r) => {
    const p = RESULT[r.result];
    const rt = r.rating ? `<small class="rt ${r.rating.change > 0 ? "up" : r.rating.change < 0 ? "down" : "flat"}">${esc(signed(r.rating.change))}</small>` : `<small class="rt none">unrated</small>`;
    // The history says which have a replay (a cancelled match never played
    // out; a match recorded without one has none).
    const has = r.result !== "cancelled" && replays?.[r.matchId] === true;
    const replay = has ? `<button type="button" class="btn sm" data-act="replay" data-match="${esc(r.matchId)}">Replay</button>` : `<span class="muted small" title="${replays === null ? "Reading your matches…" : "This match has no replay"}">${replays === null ? "" : "No replay"}</span>`;
    const own = s.agents.length > 1 && s.agentId === null ? `${esc(r.agentName)} ${ftag(r.faction)} ` : r.faction ? `${ftag(r.faction)} ` : "";
    return `<li class="hrow" data-match="${esc(r.matchId)}"><span class="wl ${p.tone}" aria-hidden="true">${esc(p.letter)}</span>`
      + `<span class="hr-main"><b>${esc(p.word)}</b> <span class="hr-vs">${own}vs ${esc(r.opponent.agentName)} ${ftag(r.opponent.faction)}</span><small class="muted">${esc(r.opponent.ownerName)} · ${esc(whenText(r.endedAt, nowMs))}${r.turns ? ` · ${r.turns} turns` : ""}</small></span>`
      + `<span class="hr-num"><b>${r.credits > 0 ? `+${r.credits}` : "0"}</b>${rt}</span><span class="hr-act">${replay}</span></li>`;
  }).join("");
  return `<section class="panel glass st-rec"><div class="row between nowrap"><h4>Recent results</h4><span class="muted small">last ${s.recent.length}</span></div>${formPips(s.recent, s.recent.length)}<ul class="hlist">${rows}</ul>${s.recent.length > RECENT_SHOWN ? `<button type="button" class="btn sm ghost" data-act="stats-recent">${all ? "Show fewer" : `Show all ${s.recent.length}`}</button>` : ""}<p class="muted small">All your matches, with their logs, are under <a href="#/match">Agent match</a>.</p></section>`;
}

// ---- the ladder ----------------------------------------------------------------------

/** How many listed owners stand in each tier (placement apart). */
export function tierCounts(l: SiteLadder): { tier: string; n: number }[] {
  const names = [...l.tiers.map((t) => t.tier), "Placement"];
  return names.map((tier) => ({ tier, n: l.standings.filter((r) => r.tier === tier).length }));
}

function tierSpreadHtml(l: SiteLadder): string {
  const counts = tierCounts(l).filter((c) => c.n);
  const total = counts.reduce((a, c) => a + c.n, 0);
  if (!total) return "";
  const segs = [...counts].reverse().map((c) => `<i style="--t:${TIER_HEX[c.tier] ?? "#8f8cff"};flex:${c.n}" title="${esc(`${c.tier}: ${c.n}`)}"></i>`).join("");
  const keys = [...counts].reverse().map((c) => `<span style="--t:${TIER_HEX[c.tier] ?? "#8f8cff"}"><i></i>${esc(c.tier)} <b>${c.n}</b></span>`).join("");
  return `<div class="st-spread" role="img" aria-label="${esc(counts.map((c) => `${c.tier} ${c.n}`).join(", "))}"><div class="st-sb">${segs}</div><div class="st-sk small">${keys}</div></div>`;
}

function ladderRow(r: SiteLadderRow, youId: string, nowDay: string | null): string {
  const you = r.ownerId === youId;
  const placed = r.tier !== "Placement";
  const last = r.lastDay ? (r.lastDay === nowDay ? "today" : r.lastDay) : "—";
  return `<tr class="${you ? "you" : ""}" style="--t:${TIER_HEX[r.tier] ?? "#8f8cff"}"${you ? ` aria-current="true"` : ""}><td class="lt-k">${r.rank === null ? "—" : r.rank}</td><td class="lt-n"><b>${esc(r.agent?.name ?? r.ownerName)}</b><small>${esc(r.ownerName)}${r.ownerKind === "house" ? " · house" : ""}${you ? " · you" : ""}</small></td><td class="lt-t"><i></i>${esc(r.tier)}</td><td class="lt-r">${placed ? Math.round(r.rating) : "—"}<small> ±${Math.round(r.rd)}</small></td><td class="lt-w">${r.wins}-${r.losses}${r.draws ? `-${r.draws}` : ""}</td><td class="lt-m">${r.ratedMatches}</td><td class="lt-d small muted">${esc(last)}</td></tr>`;
}

/** The ladder on the Stats page: the tiers (the owner's lit), how the
 * listed owners spread over them, and the public list with the owner's
 * row lit (and added at the foot when off the list, as in placement). */
export function ladderSectionHtml(l: SiteLadder, nowDay: string | null, seasonLine = ""): string {
  const youIn = l.standings.some((r) => r.ownerId === l.you.ownerId);
  const rows = l.standings.map((r) => ladderRow(r, l.you.ownerId, nowDay)).join("");
  const foot = youIn ? "" : `<tbody class="lt-you"><tr class="lt-gap"><td colspan="7">⋯</td></tr>${ladderRow(l.you, l.you.ownerId, nowDay)}</tbody>`;
  const placed = l.standings.filter((r) => r.rank !== null).length;
  const table = l.standings.length
    ? `<div class="lt-wrap"><table class="ltable"><thead><tr><th>#</th><th>Agent</th><th>Tier</th><th>Rating</th><th title="Wins-losses-draws">Record</th><th>Rated</th><th>Last</th></tr></thead><tbody>${rows}</tbody>${foot}</table></div>`
    : `<p class="muted small">No one has a rated match yet. The ladder fills as the rounds are played.</p>`;
  return `<section class="panel glass st-ladder"><div class="row between nowrap"><h4>Season ladder</h4><span class="muted small">${l.owners} owner${l.owners === 1 ? "" : "s"} rated · ${placed} placed</span></div>${seasonLine}${tierSpreadHtml(l)}<div class="st-ll">${tierLadderHtml(l)}${table}</div><p class="muted small">Glicko-2, one rating per owner. A tier and a rank show after ${l.placementMatches} rated matches; ± is how sure the rating is.</p></section>`;
}

// ---- the page ------------------------------------------------------------------------

export function statsPageHtml(st: StatsPageState, nowMs: number): string {
  const s = st.stats;
  const filter = statsFilterHtml(s, st);
  if (!s) {
    return `<div class="pg-wide st-pg">${filter}<div class="wempty glass"><h3>${st.error ? "Your stats couldn't be read" : "Loading your stats…"}</h3>${st.error ? `<p class="muted">${esc(st.error)}</p><button type="button" class="btn pri" data-act="retry-stats">Try again</button>` : ""}</div></div>`;
  }
  const err = st.error ? `<div class="banner warn" role="status">Couldn't refresh: ${esc(st.error)}</div>` : "";
  const today = s.rating.chart[s.rating.chart.length - 1]?.day ?? null;
  const ladder = st.ladder
    ? ladderSectionHtml(st.ladder, today, seasonEndHtml(seasonEndView(st.season ?? null, nowMs)))
    : `<section class="panel glass st-ladder"><h4>Season ladder</h4><p class="muted small">${st.ladderError ? `Couldn't read the ladder: ${esc(st.ladderError)}` : "Loading the ladder…"}</p></section>`;
  return `<div class="pg-wide st-pg">${err}${filter}<div class="st-grid">`
    + `<div class="st-main">${ratingHeroHtml(s, st.ladder, st.days)}${totalsHtml(s)}<div class="st-two">${factionTableHtml("Win rate by your deck's faction", s.byFaction, s.factionNotRecorded, "faction")}${factionTableHtml("Against each faction", s.byOpponentFaction, s.opponentFactionNotRecorded, "opponent's faction")}</div></div>`
    + `<div class="st-side">${todayHtml(s.today, nowMs)}${recentHtml(s, nowMs, st.replays, st.allRecent)}</div></div>${ladder}</div>`;
}
