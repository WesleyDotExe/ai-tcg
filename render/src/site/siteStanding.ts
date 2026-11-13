// The Ladder, Rating & form and Notifications widgets at S, M and L (render
// session 65; the owner's 2026-11-06 Season 0 brief, section 1: "Collection /
// Ladder / the rest: apply the S/M/L principle using only data they already
// show"). Until now the three said "waits on the server" though the game lane
// serves their data: `GET /api/ladder` and `GET /api/rating` (game 66),
// `GET /api/stats` (game 78), `GET /api/notifications` (game 77).
//
// Pure: strings from the server's answers, so the tests draw every size in
// Node and the page shows exactly that. Nothing here invents a number: a
// field the server doesn't send isn't shown (the pity thresholds, a rank in
// placement, a faction the match didn't record).
//
// S = the status at a glance, M = the key numbers and one action, L = the
// whole feature. Visual first: a tier badge and a tier bar, the rating chart,
// result pips, faction bars, kind glyphs and the pulled cards themselves.

import type { Notification, NotificationKind, NotificationPage } from "@ai-tcg/economy";
import type { SiteHistoryRow } from "./siteApi.js";
import { FACTION_HEX, esc } from "./siteModel.js";
import { signed, whenText } from "./siteMatches.js";
import { FINISH_NAMES, type MiniCard, type SiteDaily } from "./siteBoard.js";

// ---- the server's answers ----------------------------------------------------------

export interface SiteLadderRow {
  rank: number | null;
  ownerId: string;
  ownerName: string;
  ownerKind: "player" | "house";
  agent: { agentId: string; name: string } | null;
  rating: number;
  rd: number;
  tier: string;
  ratedMatches: number;
  wins: number;
  losses: number;
  draws: number;
  lastDay: string | null;
}

/** `GET /api/ladder` (OWNER_API.md "The ladder and the rating"). */
export interface SiteLadder {
  standings: SiteLadderRow[];
  you: SiteLadderRow;
  owners: number;
  tiers: { tier: string; from: number | null }[];
  placementMatches: number;
}

export type SiteResult = SiteHistoryRow["result"];

export interface SiteTally {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  void: number;
  winRate: number;
}

/** `GET /api/stats` (OWNER_API.md "The Stats page and the Rating & form widget"). */
export interface SiteStats {
  ownerId: string;
  agentId: string | null;
  agents: { agentId: string; name: string; matches: number }[];
  totals: SiteTally & { bestWinStreak: number; currentStreak: { kind: "win" | "loss"; length: number } | null; creditsFromMatches: number };
  byFaction: (SiteTally & { faction: string })[];
  factionNotRecorded: SiteTally;
  byOpponentFaction: (SiteTally & { faction: string })[];
  opponentFactionNotRecorded: SiteTally;
  recent: {
    matchId: string;
    endedAt: string;
    result: SiteResult;
    agentId: string;
    agentName: string;
    faction: string | null;
    opponent: { ownerId: string; ownerName: string; agentId: string; agentName: string; faction: string | null };
    credits: number;
    rating: { before: number; after: number; change: number } | null;
    turns: number | null;
  }[];
  rating: {
    now: { ownerId: string; rating: number; rd: number; volatility: number; ratedMatches: number; tier: string; lastDay: string | null };
    weekAgo: number;
    weekChange: number;
    chart: { day: string; rating: number; rated: number; wins: number; losses: number; draws: number }[];
  };
  /** Today's earnings, the same as `GET /api/daily` (the Stats page, render session 68). */
  today: SiteDaily;
}

export type SiteNotifications = NotificationPage;
export type SiteNotification = Notification;
export type SiteNotificationKind = NotificationKind;

// ---- tiers ---------------------------------------------------------------------------

/** Each tier's colour (the badge, the bar, the ladder's column). Placement is
 * grey: no tier yet. A tier the server adds later falls back to the accent. */
export const TIER_HEX: Record<string, string> = {
  Placement: "#9aa0b8",
  Bronze: "#c98b5a",
  Silver: "#b8c3d6",
  Gold: "#f6c445",
  Platinum: "#6fe0d2",
  Diamond: "#8fb3ff",
  Mythic: "#c95cff",
};

function tierHex(tier: string): string {
  return TIER_HEX[tier] ?? "#8f8cff";
}

/** A tier badge: a faceted gem in the tier's colour with its name. */
export function tierBadge(tier: string, size = 34): string {
  const placed = tier !== "Placement";
  return `<span class="tbadge${placed ? "" : " plc"}" style="--t:${tierHex(tier)};--s:${size}px" role="img" aria-label="${esc(tier)} tier"><svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path class="tb-o" d="M12 1.5 21.5 7v10L12 22.5 2.5 17V7z"/><path class="tb-i" d="M12 5.5 17.8 9v6L12 18.5 6.2 15V9z"/><path class="tb-h" d="M12 5.5 17.8 9 12 12.2 6.2 9z"/></svg></span>`;
}

export interface TierProgress {
  tier: string;
  /** The next tier up, or null at the top (or in placement). */
  next: string | null;
  /** How far the rating is from this tier's floor to the next's, 0-100. */
  pct: number;
  /** "38 to Platinum", "Top tier", "3 more rated matches to place". */
  line: string;
}

/** Where the owner sits in their tier, from the server's tier floors. In
 * placement: the rated matches left before a tier shows. */
export function tierProgress(you: Pick<SiteLadderRow, "tier" | "rating" | "ratedMatches">, tiers: SiteLadder["tiers"], placementMatches: number): TierProgress {
  if (you.tier === "Placement") {
    const left = Math.max(0, placementMatches - you.ratedMatches);
    return { tier: "Placement", next: null, pct: Math.round((Math.min(you.ratedMatches, placementMatches) / Math.max(1, placementMatches)) * 100), line: left ? `${left} more rated match${left === 1 ? "" : "es"} to place` : "Placed after the next match" };
  }
  const i = tiers.findIndex((t) => t.tier === you.tier);
  const next = i >= 0 && i + 1 < tiers.length ? tiers[i + 1]! : null;
  if (i < 0 || !next || next.from === null) return { tier: you.tier, next: null, pct: 100, line: "Top tier" };
  // Bronze has no floor: measure it from Silver's floor less the same width
  // as the tier above it (a bar, not a claim; the number shown is exact).
  const from = tiers[i]!.from ?? next.from - ((tiers[i + 2]?.from ?? next.from + 150) - next.from);
  const pct = Math.max(0, Math.min(100, Math.round(((you.rating - from) / Math.max(1, next.from - from)) * 100)));
  const gap = Math.max(1, Math.ceil(next.from - you.rating));
  return { tier: you.tier, next: next.tier, pct, line: `${gap} to ${next.tier}` };
}

function tierBar(p: TierProgress): string {
  return `<div class="tbar" style="--t:${tierHex(p.tier)};--n:${tierHex(p.next ?? p.tier)}" role="img" aria-label="${esc(p.line)}"><i style="width:${p.pct}%"></i></div>`;
}

function ratingText(r: Pick<SiteLadderRow, "tier" | "rating">): string {
  return r.tier === "Placement" ? "—" : String(Math.round(r.rating));
}

function record(r: Pick<SiteLadderRow, "wins" | "losses" | "draws">): string {
  return `${r.wins}W ${r.losses}L${r.draws ? ` ${r.draws}D` : ""}`;
}

// ---- the Ladder widget --------------------------------------------------------------

/** The rows to show around the owner: `n` rows with the owner as near the
 * middle as the list allows. Off the list (in placement, or past the
 * page): the top `n - 1` and the owner's own row last. */
export function aroundYou(l: SiteLadder, n: number): { rows: SiteLadderRow[]; youShown: boolean; gapBeforeYou: boolean } {
  const all = l.standings;
  const at = all.findIndex((r) => r.ownerId === l.you.ownerId);
  if (at < 0) return { rows: [...all.slice(0, Math.max(0, n - 1)), l.you], youShown: true, gapBeforeYou: all.length > n - 1 || l.you.rank === null };
  const start = Math.max(0, Math.min(at - Math.floor(n / 2), all.length - n));
  return { rows: all.slice(start, start + n), youShown: true, gapBeforeYou: false };
}

function ladderRowHtml(r: SiteLadderRow, youId: string, opts: { gap?: boolean } = {}): string {
  const you = r.ownerId === youId;
  const rank = r.rank === null ? "—" : String(r.rank);
  const who = r.agent ? `${r.agent.name}` : r.ownerName;
  return `${opts.gap ? `<li class="lr-gap" aria-hidden="true">⋯</li>` : ""}<li class="lr${you ? " you" : ""}" style="--t:${tierHex(r.tier)}"><span class="lr-k">${esc(rank)}</span><span class="lr-n"><b>${esc(who)}</b><small>${esc(r.ownerName)}${r.ownerKind === "house" ? " · house" : ""}${you ? " · you" : ""}</small></span><span class="lr-t" title="${esc(r.tier)}"><i></i>${esc(ratingText(r))}</span><span class="lr-r small muted">${esc(record(r))}</span></li>`;
}

/** The tier column at L: every tier, the owner's lit, with each floor. */
export function tierLadderHtml(l: SiteLadder): string {
  const rows = [...l.tiers].reverse().map((t) => {
    const on = t.tier === l.you.tier;
    return `<li class="tl${on ? " on" : ""}" style="--t:${tierHex(t.tier)}"><i></i><span>${esc(t.tier)}</span><small>${t.from === null ? "below " + (l.tiers[1]?.from ?? "") : `${t.from}+`}</small></li>`;
  });
  return `<ol class="tladder" aria-label="The tiers">${rows.join("")}<li class="tl${l.you.tier === "Placement" ? " on" : ""}" style="--t:${TIER_HEX.Placement}"><i></i><span>Placement</span><small>first ${l.placementMatches}</small></li></ol>`;
}

export function ladderBody(size: "S" | "M" | "L", l: SiteLadder): string {
  const y = l.you;
  const prog = tierProgress(y, l.tiers, l.placementMatches);
  const rank = y.rank === null ? (y.ratedMatches ? "Placement" : "Unranked") : `#${y.rank}`;
  const of = y.rank === null ? `${y.ratedMatches}/${l.placementMatches} placed` : `of ${l.owners}`;
  const head = `<div class="ld-head">${tierBadge(y.tier, size === "S" ? 38 : 46)}<div class="ld-k"><b>${esc(rank)}</b><small class="muted">${esc(of)}</small></div><div class="ld-rt"><b>${esc(ratingText(y))}</b><small class="muted">${esc(y.tier)}</small></div></div>`;
  if (size === "S") return head + tierBar(prog);
  const sub = `${tierBar(prog)}<div class="row between small"><span>${esc(prog.line)}</span><span class="muted">${esc(record(y))} · ±${Math.round(y.rd)}</span></div>`;
  if (!l.standings.length) return head + sub + `<p class="muted small">No one has a rated match yet. The ladder fills as the rounds are played.</p>`;
  // M: four rows, one line each (the owner names go at M: room); L: the top 8.
  const n = size === "M" ? 4 : 8;
  const a = aroundYou(l, n);
  const list = (rows: SiteLadderRow[], gapAt: number) => `<ol class="lrows">${rows.map((r, i) => ladderRowHtml(r, y.ownerId, { gap: i === gapAt })).join("")}</ol>`;
  const near = list(a.rows, a.gapBeforeYou ? a.rows.length - 1 : -1);
  if (size === "M") return head + sub + `<h4>Around you</h4>` + near;
  // L: the tier column, the top 8, and the owner's neighbours when they're not in it.
  const top = l.standings.slice(0, 8);
  const youInTop = top.some((r) => r.ownerId === y.ownerId);
  const topHtml = list(top, -1);
  const around = youInTop ? "" : `<h4>Around you</h4>${list(aroundYou(l, 3).rows, aroundYou(l, 3).gapBeforeYou ? 2 : -1)}`;
  const placed = l.standings.filter((r) => r.rank !== null).length;
  return `${head}${sub}<div class="ld-l">${tierLadderHtml(l)}<div class="wcol"><h4>Top ${top.length}</h4>${topHtml}${around}</div></div><p class="muted small">${l.owners} owner${l.owners === 1 ? "" : "s"} rated · ${placed} placed · Glicko-2, one rating per owner. A tier shows after ${l.placementMatches} rated matches.</p>`;
}

// ---- the Rating & form widget ---------------------------------------------------------

const RESULT_PIP: Record<SiteResult, { letter: string; tone: string; word: string }> = {
  win: { letter: "W", tone: "w", word: "Win" },
  loss: { letter: "L", tone: "l", word: "Loss" },
  draw: { letter: "D", tone: "d", word: "Draw" },
  cancelled: { letter: "–", tone: "x", word: "Cancelled" },
  abandonedByYou: { letter: "L", tone: "l", word: "You abandoned" },
  abandonedByOpponent: { letter: "W", tone: "w", word: "Opponent abandoned" },
};

/** The results as a row of pips, oldest left, newest right. */
export function formPips(recent: SiteStats["recent"], n: number): string {
  const rows = recent.slice(0, n).reverse();
  if (!rows.length) return `<span class="muted small">No results yet.</span>`;
  return `<div class="pips" role="list" aria-label="Recent results, oldest first">${rows.map((r) => {
    const p = RESULT_PIP[r.result];
    const ch = r.rating ? ` ${signed(r.rating.change)}` : "";
    return `<span role="listitem" class="wl ${p.tone}" title="${esc(`${p.word} vs ${r.opponent.agentName}${ch}`)}">${esc(p.letter)}</span>`;
  }).join("")}</div>`;
}

export interface WeekTrend {
  value: string;
  change: string;
  tone: "up" | "down" | "flat";
}

export function weekTrend(s: SiteStats): WeekTrend {
  const d = Math.round(s.rating.now.rating) - Math.round(s.rating.weekAgo);
  return { value: String(Math.round(s.rating.now.rating)), change: d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "±0", tone: d > 0 ? "up" : d < 0 ? "down" : "flat" };
}

/** The chart's days as one SVG: the rating line over the reset days, a
 * dot on each day with rated matches (green more wins, red more losses),
 * the tier floors crossing it as faint lines with their names. */
export function ratingChartSvg(chart: SiteStats["rating"]["chart"], tiers: SiteLadder["tiers"] | null, w: number, h: number, opts: { labels?: boolean } = {}): string {
  if (chart.length < 2) return `<p class="muted small">The chart draws after two days on the server.</p>`;
  const vals = chart.map((c) => c.rating);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 40) {
    const mid = (hi + lo) / 2;
    lo = mid - 20;
    hi = mid + 20;
  }
  const padX = opts.labels ? 30 : 4;
  const padY = 6;
  const bottom = opts.labels ? 16 : 4;
  const x = (i: number) => padX + (i * (w - padX - 4)) / (chart.length - 1);
  const y = (v: number) => padY + (1 - (v - lo) / (hi - lo)) * (h - padY - bottom);
  const pts = chart.map((c, i) => `${x(i).toFixed(1)},${y(c.rating).toFixed(1)}`).join(" ");
  const area = `${x(0).toFixed(1)},${(h - bottom).toFixed(1)} ${pts} ${x(chart.length - 1).toFixed(1)},${(h - bottom).toFixed(1)}`;
  const first = Math.round(chart[0]!.rating);
  const last = Math.round(chart[chart.length - 1]!.rating);
  const tone = last > first ? "up" : last < first ? "down" : "flat";
  const floors = (tiers ?? []).filter((t) => t.from !== null && t.from > lo && t.from < hi)
    .map((t) => `<line class="rc-floor" x1="${padX}" x2="${w - 4}" y1="${y(t.from!).toFixed(1)}" y2="${y(t.from!).toFixed(1)}" style="--t:${tierHex(t.tier)}"/>${opts.labels ? `<text class="rc-ft" x="${w - 6}" y="${(y(t.from!) - 3).toFixed(1)}" text-anchor="end" style="--t:${tierHex(t.tier)}">${esc(t.tier)}</text>` : ""}`).join("");
  const dots = chart.map((c, i) => (c.rated ? `<circle class="rc-d ${c.wins > c.losses ? "w" : c.losses > c.wins ? "l" : "e"}" cx="${x(i).toFixed(1)}" cy="${y(c.rating).toFixed(1)}" r="${opts.labels ? 3.2 : 2.4}"><title>${esc(`${c.day}: ${c.rated} rated, ${c.wins}W ${c.losses}L${c.draws ? ` ${c.draws}D` : ""} · ${Math.round(c.rating)}`)}</title></circle>` : "")).join("");
  const labels = opts.labels
    ? `<text class="rc-l" x="${padX - 4}" y="${(y(hi) + 4).toFixed(1)}" text-anchor="end">${Math.round(hi)}</text><text class="rc-l" x="${padX - 4}" y="${y(lo).toFixed(1)}" text-anchor="end">${Math.round(lo)}</text><text class="rc-l" x="${padX}" y="${h - 3}">${esc(shortDay(chart[0]!.day))}</text><text class="rc-l" x="${w - 4}" y="${h - 3}" text-anchor="end">Today</text>`
    : "";
  return `<svg class="rchart ${tone}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(`Rating over ${chart.length} days: ${first} to ${last}`)}">${floors}<polygon class="rc-a" points="${area}"/><polyline class="rc-line" points="${pts}"/>${dots}<circle class="rc-now" cx="${x(chart.length - 1).toFixed(1)}" cy="${y(chart[chart.length - 1]!.rating).toFixed(1)}" r="4"/>${labels}</svg>`;
}

function shortDay(day: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return `${Number(m[2])} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m[1]) - 1] ?? ""}`;
}

/** The win rate as a ring (the share of decided matches won). */
function winRing(t: SiteTally, px: number): string {
  const decided = t.wins + t.losses + t.draws;
  const pct = decided ? Math.round(t.winRate * 100) : 0;
  return `<div class="ring wr" style="--p:${pct};width:${px}px;height:${px}px" role="img" aria-label="${decided ? `${pct}% of ${decided} decided matches won` : "No decided match yet"}"><b style="width:${px - 14}px;height:${px - 14}px">${decided ? `${pct}%` : "—"}</b></div>`;
}

function factionBars(rows: SiteStats["byFaction"]): string {
  return `<ul class="fbars">${rows.map((f) => {
    const decided = f.wins + f.losses + f.draws;
    const pct = decided ? Math.round(f.winRate * 100) : 0;
    return `<li style="--c:${FACTION_HEX[f.faction] ?? "#8f8cff"}"><span class="fb-n">${esc(f.faction)}</span><span class="fb-b"><i style="width:${decided ? Math.max(3, pct) : 0}%"></i></span><span class="fb-v small">${decided ? `${pct}% <span class="muted">of ${decided}</span>` : `<span class="muted">none</span>`}</span></li>`;
  }).join("")}</ul>`;
}

function streakChip(s: SiteStats["totals"]["currentStreak"]): string {
  // A streak of one isn't one (My agent's rule, siteAgent.streakOf).
  if (!s || s.length < 2) return `<span class="chip"><small>No streak</small></span>`;
  return `<span class="chip ${s.kind === "win" ? "hot" : "cold"}">${s.kind === "win" ? `${s.length} wins in a row` : `Lost ${s.length} in a row`}</span>`;
}

export function formBody(size: "S" | "M" | "L", s: SiteStats, tiers: SiteLadder["tiers"] | null, now: number): string {
  const t = weekTrend(s);
  const placed = s.rating.now.tier !== "Placement";
  const head = `<div class="fm-head">${tierBadge(s.rating.now.tier, size === "S" ? 34 : 42)}<div class="fm-v"><b>${esc(placed ? t.value : "—")}</b><small class="muted">${esc(s.rating.now.tier)}${placed ? ` ±${Math.round(s.rating.now.rd)}` : ` · ${s.rating.now.ratedMatches} rated`}</small></div><div class="fm-w rt ${t.tone}"><b>${esc(t.change)}</b><small>this week</small></div></div>`;
  if (size === "S") return head;
  const tot = s.totals;
  const chips = `<div class="ma-chips">${streakChip(tot.currentStreak)}<span class="chip"><b class="w">${tot.wins}W</b> <b class="l">${tot.losses}L</b>${tot.draws ? ` <b>${tot.draws}D</b>` : ""}</span><span class="chip"><small>Best streak</small> <b>${tot.bestWinStreak}</b></span></div>`;
  const mid = head + ratingChartSvg(s.rating.chart, tiers, 300, 64) + `<div class="row between nowrap"><h4>Form</h4><span class="muted small">last ${Math.min(10, s.recent.length)}</span></div>` + formPips(s.recent, 10) + chips;
  if (size === "M") return mid;
  const recent = s.recent.length
    ? `<ul class="fm-rec">${s.recent.slice(0, 4).map((r) => {
        const p = RESULT_PIP[r.result];
        const fc = r.opponent.faction ? `<span class="ftag" style="--c:${FACTION_HEX[r.opponent.faction] ?? "#8f8cff"}">${esc(r.opponent.faction.toUpperCase())}</span>` : "";
        return `<li><span class="wl ${p.tone}">${esc(p.letter)}</span><span class="fr-n"><b>vs ${esc(r.opponent.agentName)}</b> ${fc}<small class="muted">${esc(r.opponent.ownerName)} · ${esc(whenText(r.endedAt, now))}</small></span><span class="rt ${r.rating ? (r.rating.change > 0 ? "up" : r.rating.change < 0 ? "down" : "flat") : "none"} small">${r.rating ? esc(signed(r.rating.change)) : "unrated"}</span></li>`;
      }).join("")}</ul>`
    : `<p class="muted small">No results yet.</p>`;
  const notRec = s.factionNotRecorded.matches ? `<p class="muted small">${s.factionNotRecorded.matches} older match${s.factionNotRecorded.matches === 1 ? "" : "es"} kept no faction.</p>` : "";
  const left = `<div class="wcol">${head}<div class="fm-chart">${ratingChartSvg(s.rating.chart, tiers, 440, 128, { labels: true })}</div>${chips}<div class="row between nowrap"><h4>Form</h4><span class="muted small">last ${Math.min(20, s.recent.length)}</span></div>${formPips(s.recent, 20)}</div>`;
  const right = `<div class="wcol"><div class="fm-tot">${winRing(tot, 72)}<div><b class="wbig-s">${tot.matches}</b> <span class="muted small">matches</span><div class="small">${amount0(tot.creditsFromMatches)} credits from matches</div>${tot.void ? `<div class="muted small">${tot.void} void (cancelled or abandoned)</div>` : ""}</div></div><h4>Win rate by deck faction</h4>${factionBars(s.byFaction)}${notRec}<h4>Recent</h4>${recent}</div>`;
  return `<div class="wsplit wide-l fm-l">${left}${right}</div>`;
}

function amount0(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// ---- the Notifications widget --------------------------------------------------------

export const KIND_INFO: Record<NotificationKind, { glyph: string; hue: string; name: string; href: string }> = {
  matchResult: { glyph: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', hue: "#8fb3ff", name: "Match results", href: "#/match" },
  bigPull: { glyph: '<path d="M12 3l2.2 6.3L20.5 12l-6.3 2.2L12 21l-2.2-6.8L3.5 12l6.3-2.7z"/>', hue: "#f6c445", name: "Big pulls", href: "#/collection" },
  dailyPack: { glyph: '<path d="M4 8h16l-1.5 12h-13z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>', hue: "#3cc47c", name: "Daily pack", href: "#/store" },
  autoPlayStopped: { glyph: '<rect x="6" y="6" width="12" height="12" rx="2"/>', hue: "#ff8a5c", name: "Auto-play", href: "#/" },
};

export interface NoticeView {
  id: number;
  kind: NotificationKind;
  unread: boolean;
  title: string;
  line: string;
  when: string;
  tone: "w" | "l" | "d" | "x" | "gold" | "ok" | "warn";
  href: string;
  /** A big pull's cards (L draws them). */
  cards: MiniCard[];
}

const RESULT_TITLE: Record<SiteResult, string> = {
  win: "Won",
  loss: "Lost",
  draw: "Drew",
  cancelled: "Cancelled",
  abandonedByYou: "You abandoned",
  abandonedByOpponent: "Opponent abandoned",
};

/** One notification in the widget's words (OWNER_API.md's table: what each
 * kind says). `factionOf` gives a pulled card's faction when the collection
 * is read (the notice doesn't carry it). */
export function noticeView(n: SiteNotification, now: number, factionOf: (cardId: string) => string | null = () => null): NoticeView {
  const base = { id: n.notificationId, kind: n.kind, unread: n.readAt === null, when: whenText(n.createdAt, now), href: KIND_INFO[n.kind].href, cards: [] as MiniCard[] };
  switch (n.kind) {
    case "matchResult": {
      const m = n.matchResult;
      const tone = m.result === "win" || m.result === "abandonedByOpponent" ? "w" : m.result === "loss" || m.result === "abandonedByYou" ? "l" : m.result === "draw" ? "d" : "x";
      const pay = m.credits > 0 ? `+${m.credits} credits` : "no credits";
      const rt = m.rating ? ` · ${signed(m.rating.change)} rating` : "";
      return { ...base, tone, title: `${RESULT_TITLE[m.result]} vs ${m.opponent.agentName}`, line: `${m.agentName} · ${pay}${rt}${m.turns ? ` · ${m.turns} turns` : ""}` };
    }
    case "bigPull": {
      const b = n.bigPull;
      const best = b.cards[0];
      const fin = best ? FINISH_NAMES[best.finish] ?? "" : "";
      const title = b.jackpot ? "Jackpot pack" : best?.prototype ? `Prototype ${best.name} #${best.prototype.serial}` : best ? `${fin ? fin + " " : ""}${best.name}` : "A big pull";
      const more = b.cards.length > 1 ? ` and ${b.cards.length - 1} more` : "";
      const fresh = b.cards.some((c) => c.isNew) ? " · new to you" : "";
      return {
        ...base,
        tone: "gold",
        title,
        line: `${b.setCode} pack${more}${fresh}`,
        cards: b.cards.map((c) => ({ cardId: c.cardId, name: c.name, rarity: c.rarity, faction: factionOf(c.cardId), finish: c.finish, serial: c.prototype?.serial ?? null })),
      };
    }
    case "dailyPack": {
      const d = n.dailyPack;
      return { ...base, tone: "ok", title: d.waiting > 1 ? `${d.waiting} free packs waiting` : "Your free daily pack is waiting", line: `Claim it in the Store (up to ${d.cap} wait)` };
    }
    case "autoPlayStopped": {
      const a = n.autoPlayStopped;
      return a.reason === "timeUp"
        ? { ...base, tone: "warn", title: "Your agent's time is up", line: `${a.allowanceMinutes ? `The ${a.allowanceMinutes} minutes` : "Its time"} ran out; it finished its match and stopped` }
        : { ...base, tone: "warn", title: "Today's rewards are maxed", line: "Auto-play switched off until the midnight reset" };
    }
  }
}

export function kindGlyph(kind: NotificationKind, px: number): string {
  const k = KIND_INFO[kind];
  return `<span class="nk" style="--k:${k.hue};width:${px}px;height:${px}px" aria-hidden="true"><svg viewBox="0 0 24 24" width="${Math.round(px * 0.55)}" height="${Math.round(px * 0.55)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${k.glyph}</svg></span>`;
}

function bell(unread: number, px: number): string {
  return `<span class="nbell" style="--s:${px}px" role="img" aria-label="${unread ? `${unread} unread` : "Nothing unread"}"><svg viewBox="0 0 24 24" width="${Math.round(px * 0.6)}" height="${Math.round(px * 0.6)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>${unread ? `<b class="nbadge">${unread > 99 ? "99+" : unread}</b>` : ""}</span>`;
}

function noticeHtml(v: NoticeView, opts: { cards: boolean; miniCard: (c: MiniCard) => string }): string {
  const cards = opts.cards && v.cards.length ? `<div class="mrow nt-cards">${v.cards.slice(0, 5).map(opts.miniCard).join("")}</div>` : "";
  return `<li class="nt t-${v.tone}${v.unread ? " unread" : ""}" data-nid="${v.id}">${kindGlyph(v.kind, 30)}<a class="nt-m" href="${v.href}"><b>${esc(v.title)}</b><small class="muted">${esc(v.line)}</small>${cards}</a><span class="nt-w small muted">${esc(v.when)}${v.unread ? `<i class="nt-dot" aria-label="unread"></i>` : ""}</span></li>`;
}

export function notifBody(size: "S" | "M" | "L", page: SiteNotifications, now: number, opts: { miniCard: (c: MiniCard) => string; factionOf?: (cardId: string) => string | null; busy?: boolean }): string {
  const views = page.notifications.map((n) => noticeView(n, now, opts.factionOf));
  const latest = views[0];
  if (size === "S") {
    return `<div class="nt-s">${bell(page.unread, 44)}<div class="dn">${latest ? `<b class="nt-s-t">${esc(latest.title)}</b><small class="muted">${esc(latest.when)}</small>` : `<b>All quiet</b><small class="muted">Nothing yet</small>`}</div></div>`;
  }
  const mark = page.unread ? `<button type="button" class="btn sm" data-act="notif-read"${opts.busy ? " disabled" : ""}>Mark all read</button>` : "";
  const head = `<div class="nt-head">${bell(page.unread, 40)}<div class="dn"><b>${page.unread ? `${page.unread} unread` : "All read"}</b><small class="muted">${page.notifications.length ? `latest ${whenText(page.notifications[0]!.createdAt, now)}` : "Nothing yet"}</small></div>${mark}</div>`;
  if (!views.length) return head + `<p class="muted small">Match results, big pulls, the free daily pack and auto-play stops show here. Which ones is in Settings.</p>`;
  if (size === "M") return head + `<ul class="ntl">${views.slice(0, 4).map((v) => noticeHtml(v, { cards: false, miniCard: opts.miniCard })).join("")}</ul>`;
  const kinds = (Object.keys(KIND_INFO) as NotificationKind[]).map((k) => `<span class="nk-c" style="--k:${KIND_INFO[k].hue}">${kindGlyph(k, 20)}<span>${esc(KIND_INFO[k].name)}</span><b>${page.unreadByKind[k] ?? 0}</b></span>`).join("");
  return head + `<div class="nk-row" aria-label="Unread by kind">${kinds}</div><ul class="ntl">${views.slice(0, 8).map((v) => noticeHtml(v, { cards: true, miniCard: opts.miniCard })).join("")}</ul>${page.more || views.length > 8 ? `<p class="muted small">Showing the latest 8.</p>` : ""}`;
}
