// The My agent and Agent controls widgets (render session 57; the owner's
// 2026-11-06 Season 0 brief, section 1). Pure: each piece is a view (plain
// data, tested on its own) and its HTML, built from the owner API's answers;
// no DOM, no fetch. siteWidgets.ts calls the two bodies.
//
// Sizes differ in what they show, not just in scale (the brief's principle):
//   My agent        S portrait, name, status, rating
//                   M + today's W/L, the streak, the deck's faction
//                   L + the rating trend and the recent matches
//   Agent controls  S portrait in the time ring, status, Start / Stop
//                   M + the personality dial, the time buttons, the deck, "Go to match"
//                   L + the deck switcher, the match history, +15 / +30
//
// The time ring reads a `TimeAllowance`, made by `allowanceOf` from
// `GET /api/play`'s `autoPlay.allowance` (the server's play-time allowance,
// game session 76; wired in render session 58). With no allowance (no time
// limit, or off, or an older server) the ring shows auto-play as it is: on
// with no time limit, or stopped. The 15 / 30 / 60 buttons start auto-play
// with that many minutes; +15 / +30 add to a running allowance.

import { avatarSvg } from "../avatar.js";
import type { SiteAutoPlay, SiteHistory, SiteHistoryRow, SiteLive, SitePlay } from "./siteApi.js";
import type { SiteDaily } from "./siteBoard.js";
import { autoPlayView, historyRowHtml, historyRowView, myLiveMatch, type AutoPlayView } from "./siteMatches.js";
import { FACTION_HEX, agentStatus, deckLine, esc, styleName } from "./siteModel.js";

// ---- the rating (GET /api/rating) ---------------------------------------------

/** `GET /api/rating` (OWNER_API.md "The ladder and the rating"). */
export interface SiteRating {
  rating: { ownerId: string; rating: number; rd: number; volatility: number; ratedMatches: number; tier: string; lastDay: string | null };
  recent: {
    matchId: string;
    endedAt: string;
    opponentOwnerId: string;
    ownerId: string;
    score: 1 | 0.5 | 0;
    before: { rating: number; rd: number; volatility: number };
    after: { rating: number; rd: number; volatility: number };
  }[];
}

export interface RatingLine {
  /** The whole-number rating, "1532". */
  value: string;
  /** "Gold", or "Placement" while the owner is placed. */
  tier: string;
  /** "±62" (the RD, rounded). */
  rd: string;
  /** "Gold · 1532", or "Placement · 2 rated" (no number shows in placement:
   * the ladder shows none either). */
  line: string;
}

export function ratingLine(r: SiteRating): RatingLine {
  const value = String(Math.round(r.rating.rating));
  const rd = `±${Math.round(r.rating.rd)}`;
  const placed = r.rating.tier !== "Placement";
  const n = r.rating.ratedMatches;
  return { value, tier: r.rating.tier, rd, line: placed ? `${r.rating.tier} · ${value}` : `Placement · ${n} rated match${n === 1 ? "" : "es"}` };
}

export interface RatingTrend {
  /** Ratings oldest first: each recent match's rating before it, then now. */
  points: number[];
  /** Now minus the first point, whole: "+38", "−12", "±0". */
  change: string;
  tone: "up" | "down" | "flat";
  /** "over the last 10 rated matches". */
  over: string;
}

/** The trend from the server's recent list (newest first). Null with fewer
 * than two rated matches: there is no line to draw. */
export function ratingTrend(r: SiteRating): RatingTrend | null {
  const recent = [...r.recent].reverse();
  if (recent.length < 2) return null;
  const points = [...recent.map((x) => x.before.rating), recent[recent.length - 1]!.after.rating];
  const d = Math.round(points[points.length - 1]!) - Math.round(points[0]!);
  return { points, change: d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "±0", tone: d > 0 ? "up" : d < 0 ? "down" : "flat", over: `over the last ${recent.length} rated matches` };
}

/** The trend as an inline SVG line (no chart library: the page is
 * self-contained). The newest point is marked. */
export function trendSvg(t: RatingTrend, w = 220, h = 54): string {
  const lo = Math.min(...t.points);
  const hi = Math.max(...t.points);
  const span = hi - lo || 1;
  const pad = 4;
  const xy = t.points.map((p, i) => [pad + (i * (w - 2 * pad)) / (t.points.length - 1), pad + (1 - (p - lo) / span) * (h - 2 * pad)] as const);
  const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1]!;
  const area = `${pad},${h - pad} ${pts} ${(w - pad).toFixed(1)},${h - pad}`;
  return `<svg class="trend ${t.tone}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(`Rating ${t.change} ${t.over}`)}"><polygon points="${area}" class="tr-area"/><polyline points="${pts}" class="tr-line"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5" class="tr-dot"/></svg>`;
}

// ---- today and the streak -------------------------------------------------------

/** Today's results from `GET /api/daily` (the Sydney day): its wins, and its
 * losses and draws (the daily answer counts those together). */
export function todayLine(d: SiteDaily): { wins: number; losses: number; line: string } {
  const wins = d.wins.length;
  return { wins, losses: d.losses, line: `${wins}W ${d.losses}L today` };
}

export interface Streak {
  kind: "W" | "L";
  n: number;
  /** "3 wins in a row", "Lost 2 in a row". */
  line: string;
}

/** The current streak from the history (newest first): wins (an opponent's
 * abandon counts as a win, as the rating does) or losses (your own abandon
 * counts as a loss) in a row. A cancel isn't a result and is skipped; a draw
 * ends a streak. Null with no result, or a streak of one. */
export function streakOf(rows: readonly SiteHistoryRow[]): Streak | null {
  let kind: "W" | "L" | null = null;
  let n = 0;
  for (const r of rows) {
    if (r.result === "cancelled") continue;
    const k = r.result === "win" || r.result === "abandonedByOpponent" ? "W" : r.result === "loss" || r.result === "abandonedByYou" ? "L" : null;
    if (k === null) break;
    if (kind === null) kind = k;
    if (k !== kind) break;
    n++;
  }
  if (kind === null || n < 2) return null;
  return { kind, n, line: kind === "W" ? `${n} wins in a row` : `Lost ${n} in a row` };
}

// ---- the time ring --------------------------------------------------------------

/** The play-time allowance as the ring draws it, read from the server's
 * `autoPlay.allowance` by `allowanceOf`. */
export interface TimeAllowance {
  /** The window's length and what is left of it, in seconds. */
  secondsTotal: number;
  secondsLeft: number;
  /** running: time left, playing or queued; finishing: time is up, the
   * current match plays out; done: stopped for today. */
  state: "running" | "finishing" | "done";
  /** The window ends at midnight Sydney: no more time can go on today. */
  endsAtReset: boolean;
  /** "+15 / +30" can be pressed now (the server's `canAddTime`). */
  canAddTime: boolean;
}

/** The ring's allowance from `GET /api/play`'s `autoPlay`, `now` the
 * client's clock. A running allowance drains from the server's own
 * `secondsLeft` by the time since it was read (`readAt`), so the ring moves
 * between reads without trusting the client's clock against the server's;
 * each read sets it right again. It never drains past zero, and never
 * changes state on its own: "Finishing match" and "Done for today" are the
 * server's word, on the next read. Null with no allowance (no time limit,
 * off, or a server before v22). */
export function allowanceOf(ap: SiteAutoPlay, now: number): TimeAllowance | null {
  const a = ap.allowance;
  if (!a) return null;
  const total = Math.max(1, Math.round(a.totalMinutes * 60));
  const since = ap.readAt === undefined ? 0 : Math.max(0, (now - ap.readAt) / 1000);
  const left = a.state === "running" ? Math.max(0, a.secondsLeft - since) : 0;
  return { secondsTotal: total, secondsLeft: Math.min(total, left), state: a.state, endsAtReset: a.endsAtReset, canAddTime: !!ap.canAddTime };
}

export interface TimeRingView {
  /** 0-100: how much of the ring is lit. */
  pct: number;
  /** The ring's centre, short: "42" (with `unit` "min"), "Finishing match". */
  centre: string;
  unit: string | null;
  /** The line beside it (M and L): "42 min left today". */
  caption: string;
  tone: "run" | "low" | "finish" | "done" | "open" | "off";
}

/** The ring's state. `inMatch`: the agent has a match live now. Minutes
 * round up, as the server's do ("1 min left" until the last second); the
 * ring itself drains by the second. */
export function timeRingView(allowance: TimeAllowance | null, ap: AutoPlayView, inMatch: boolean): TimeRingView {
  if (allowance) {
    const total = Math.max(1, allowance.secondsTotal);
    const left = Math.max(0, Math.min(total, allowance.secondsLeft));
    if (allowance.state === "done") return { pct: 0, centre: "Done for today", unit: null, caption: "Done for today. The time resets at midnight (Sydney).", tone: "done" };
    if (allowance.state === "finishing" || left <= 0)
      return { pct: 0, centre: "Finishing match", unit: null, caption: inMatch ? "Time's up: your agent is finishing its last match." : "Time's up: no new match starts today.", tone: "finish" };
    const mins = Math.ceil(left / 60);
    const pct = Math.max(1, Math.round((left / total) * 100));
    return { pct, centre: String(mins), unit: "min", caption: `${mins} min left today${allowance.endsAtReset ? " · stops at midnight" : ""}`, tone: left / total <= 0.2 ? "low" : "run" };
  }
  // No allowance: auto-play as it is today.
  if (!ap.shown) return { pct: 100, centre: "Always", unit: null, caption: "A house agent always plays.", tone: "open" };
  if (ap.on) return { pct: 100, centre: "On", unit: null, caption: inMatch ? "Playing · no time limit set" : "Auto-play on · no time limit set", tone: "open" };
  return { pct: 0, centre: "Off", unit: null, caption: ap.stopped ? (ap.stoppedWhy === "timeUp" ? "Done for today: the time you gave ran out" : "Stopped: today's rewards are maxed") : inMatch ? "Stopped · the match live finishes" : "Stopped", tone: "off" };
}

/** The agent's portrait inside the ring. The ring is an SVG arc (a stroke
 * that drains as the time runs down); the centre text sits under the
 * portrait at S, beside it in the caption at M and L. */
export function ringPortraitHtml(name: string, faction: string | null, v: TimeRingView, size: number): string {
  const c = (faction && FACTION_HEX[faction]) || "#8f8cff";
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const lit = (circ * v.pct) / 100;
  const inner = size - 22;
  const label = v.unit ? `${v.centre} ${v.unit} left` : v.centre;
  return `<div class="tring t-${v.tone}" style="--c:${c};width:${size}px;height:${size}px" role="img" aria-label="${esc(`${name}: ${label}`)}">`
    + `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle class="tr-bg" cx="${size / 2}" cy="${size / 2}" r="${r.toFixed(1)}"/>`
    + `<circle class="tr-fg" cx="${size / 2}" cy="${size / 2}" r="${r.toFixed(1)}" stroke-dasharray="${lit.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`
    + `<span class="av" style="--c:${c};width:${inner}px;height:${inner}px">${avatarSvg(name)}</span>`
    + `<b class="tr-c${v.unit ? "" : " word"}">${esc(v.centre)}${v.unit ? `<small>${esc(v.unit)}</small>` : ""}</b></div>`;
}

// ---- the personality dial ------------------------------------------------------

export interface DialView {
  agentId: string;
  /** Every play style, in the server's order, with its angle on the dial
   * (degrees clockwise from the top). */
  stops: { id: string; name: string; summary: string; angle: number; on: boolean }[];
  /** The style the agent plays from its next match. */
  current: { id: string; name: string; summary: string };
  /** The pointer's angle. */
  angle: number;
  /** "Applies from the next match", or, with a match live in another
   * style, what this match plays and what comes next. */
  note: string;
}

/** The dial (the brief: switches between the play styles that exist; a
 * change applies from the next match, never mid-match: the ladder seats
 * each agent with its style as the match starts). `liveStyle`: the style
 * the agent's live match started with, or null with no match live. */
export function dialView(p: SitePlay, liveStyle: string | null): DialView | null {
  const a = p.connectedAgent;
  if (!a || !p.playStyles.length) return null;
  const n = p.playStyles.length;
  const stops = p.playStyles.map((s, i) => ({ id: s.id, name: s.name, summary: s.summary, angle: Math.round((360 * i) / n), on: s.id === a.playStyle }));
  const cur = stops.find((s) => s.on) ?? { id: a.playStyle, name: styleName(p, a.playStyle), summary: "", angle: 0, on: true };
  const note = liveStyle && liveStyle !== a.playStyle
    ? `This match: ${styleName(p, liveStyle)}. ${cur.name} from the next match.`
    : liveStyle
      ? "A change applies from the next match."
      : "Applies from the next match.";
  return { agentId: a.agentId, stops, current: { id: cur.id, name: cur.name, summary: cur.summary }, angle: cur.angle, note };
}

/** The dial as HTML: a round knob with a pointer, one notch per style around
 * it (each a real button: its style's name is its label), and the chosen
 * style's name and summary beside it. */
export function dialHtml(v: DialView, opts: { busy?: boolean; size?: number; summary?: boolean } = {}): string {
  const size = opts.size ?? 112;
  const r = size / 2 - 9;
  const notches = v.stops
    .map((s) => {
      const rad = (s.angle * Math.PI) / 180;
      const x = size / 2 + r * Math.sin(rad);
      const y = size / 2 - r * Math.cos(rad);
      return `<button type="button" class="dn-stop${s.on ? " on" : ""}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px" data-act="play-style" data-agent="${esc(v.agentId)}" data-style="${esc(s.id)}" aria-pressed="${s.on}" aria-label="${esc(`${s.name} play style`)}" title="${esc(s.summary ? `${s.name}: ${s.summary}` : s.name)}"${opts.busy ? " disabled" : ""}></button>`;
    })
    .join("");
  return `<div class="dial"><div class="dn-knob" style="width:${size}px;height:${size}px" role="group" aria-label="Personality dial">${notches}<span class="dn-face" aria-hidden="true"><i style="transform:rotate(${v.angle}deg)"></i></span></div>`
    + `<div class="dn-txt"><span class="muted small">Personality</span><b>${esc(v.current.name)}</b>${v.current.summary && opts.summary !== false ? `<span class="small">${esc(v.current.summary)}</span>` : ""}<span class="muted small">${esc(v.note)}</span></div></div>`;
}

// ---- the deck switcher ------------------------------------------------------------

export interface DeckOption {
  /** "agent" for "your agent picks", else a deck id. */
  value: string;
  name: string;
  detail: string;
  faction: string | null;
  on: boolean;
  /** Why it can't be picked (an incomplete deck), or null. */
  blocked: string | null;
}

/** The deck switcher's choices: "Your agent picks" first, then the owner's
 * decks. The chosen one is the server's (`deckChoice` and the active deck). */
export function deckOptions(p: SitePlay): DeckOption[] {
  const agentOn = p.deckChoice === "agent";
  const built = p.agentDeck;
  const out: DeckOption[] = [{ value: "agent", name: "Your agent picks", detail: built ? `${built.name} · ${built.cards} cards` : "No deck built yet", faction: built?.faction ?? null, on: agentOn, blocked: null }];
  for (const d of p.decks) {
    if (built && d.deckId === built.deckId) continue;
    out.push({
      value: d.deckId,
      name: d.name,
      detail: `${d.cards} cards${d.complete ? "" : ` · ${d.missing.length} card${d.missing.length === 1 ? "" : "s"} missing`}`,
      faction: d.faction ?? null,
      on: !agentOn && p.activeDeck?.deckId === d.deckId,
      blocked: d.complete ? null : "Incomplete: you don't hold every card it uses",
    });
  }
  return out;
}

export function deckSwitcherHtml(opts: readonly DeckOption[], busy = false): string {
  return `<div class="dsw" role="group" aria-label="Which deck plays">${opts
    .map((o) => {
      const c = (o.faction && FACTION_HEX[o.faction]) || "#8f8cff";
      const dis = o.blocked || busy ? " disabled" : "";
      return `<button type="button" class="dsw-o${o.on ? " on" : ""}" style="--c:${c}" data-act="ctl-deck" data-deck="${esc(o.value)}" aria-pressed="${o.on}"${dis}${o.blocked ? ` title="${esc(o.blocked)}"` : ""}><i aria-hidden="true"></i><span><b>${esc(o.name)}</b><small>${esc(o.detail)}</small></span></button>`;
    })
    .join("")}</div>`;
}

// ---- the widgets ------------------------------------------------------------------

export interface AgentWidgetData {
  play: SitePlay;
  rating: SiteRating | null;
  daily: SiteDaily | null;
  history: SiteHistory | null;
  live: SiteLive | null;
  errors: Partial<Record<"rating" | "daily" | "history" | "live", string>>;
  now: number;
  busy?: boolean;
}

function factionOf(p: SitePlay): string | null {
  return p.activeDeck?.faction ?? p.factionLock ?? p.rebuild.job?.result?.faction ?? null;
}

function ftag(f: string | null): string {
  return f ? `<span class="ftag" style="--c:${FACTION_HEX[f] ?? "#8f8cff"}">${esc(f.toUpperCase())}</span>` : "";
}

function avatar(name: string, faction: string | null, size: number): string {
  const c = (faction && FACTION_HEX[faction]) || "#8f8cff";
  return `<span class="av" style="--c:${c};width:${size}px;height:${size}px">${avatarSvg(name)}</span>`;
}

function noAgent(): string {
  return `<b>No agent connected</b><p class="muted small">Connect an agent to play matches.</p><a class="btn pri sm" href="#/connect">Connect agent</a>`;
}

function pending(d: AgentWidgetData, src: "rating" | "daily" | "history" | "live", what: string): string {
  const err = d.errors[src];
  return `<span class="muted small">${err ? `${esc(what)} couldn't be read` : `${esc(what)}: loading…`}</span>`;
}

function statusPill(p: SitePlay): string {
  const st = agentStatus(p);
  return `<span class="status ${st.tone}"><i></i>${esc(st.label)}</span>`;
}

/** My agent: who the agent is and how it's doing. */
export function myAgentHtml(size: "S" | "M" | "L", d: AgentWidgetData): string {
  const p = d.play;
  const a = p.connectedAgent;
  if (!a) return noAgent();
  const fac = factionOf(p);
  const rl = d.rating ? ratingLine(d.rating) : null;
  const rating = rl
    ? `<div class="ma-rt"><b>${esc(rl.tier === "Placement" ? "—" : rl.value)}</b><span class="small">${esc(rl.tier)}</span></div>`
    : `<div class="ma-rt">${pending(d, "rating", "Rating")}</div>`;
  const head = `<div class="ma-head">${avatar(a.name, fac, size === "S" ? 52 : 64)}<div class="mya-t"><div class="mya-n">${esc(a.name)}</div>${statusPill(p)}</div>${rating}</div>`;
  if (size === "S") return head;
  const today = d.daily ? todayLine(d.daily) : null;
  const streak = d.history ? streakOf(d.history.matches) : null;
  const chips = `<div class="ma-chips">`
    + (today ? `<span class="chip"><b class="w">${today.wins}W</b> <b class="l">${today.losses}L</b> <small>today</small></span>` : pending(d, "daily", "Today"))
    + (streak ? `<span class="chip ${streak.kind === "W" ? "hot" : "cold"}">${esc(streak.line)}</span>` : d.history ? `<span class="chip"><small>No streak</small></span>` : pending(d, "history", "Streak"))
    + (fac ? `<span class="chip">${ftag(fac)}<small>deck</small></span>` : `<span class="chip"><small>No deck yet</small></span>`)
    + `</div>`;
  const rd = rl ? `<div class="muted small">${esc(rl.line)} ${esc(rl.rd)} · ${esc(styleName(p, a.playStyle))} play style</div>` : "";
  if (size === "M") return head + chips + rd;
  const trend = d.rating ? ratingTrend(d.rating) : null;
  const trendHtml = trend
    ? `<div class="ma-trend"><div class="row between"><h4>Rating trend</h4><span class="rt ${trend.tone}"><b>${esc(trend.change)}</b> <small class="muted">${esc(trend.over)}</small></span></div>${trendSvg(trend, 300, 64)}</div>`
    : d.rating
      ? `<p class="muted small">The rating trend draws after two rated matches.</p>`
      : pending(d, "rating", "Rating trend");
  const recent = d.history
    ? d.history.matches.length
      ? `<ul class="hlist">${d.history.matches.slice(0, 4).map((r) => historyRowHtml(historyRowView(r, d.now), { compact: true })).join("")}</ul>`
      : `<p class="muted small">No matches yet.</p>`
    : pending(d, "history", "Recent matches");
  return `<div class="wsplit wide-l"><div class="wcol">${head}${chips}${rd}${trendHtml}</div><div class="wcol"><h4>Recent matches</h4>${recent}</div></div>`;
}

const TIME_PRESETS = [15, 30, 60] as const;
const TIME_ADDS = [15, 30] as const;
export interface TimeButtonsView {
  /** 15 / 30 / 60: start auto-play with that many minutes. */
  start: { enabled: boolean; title: string };
  /** +15 / +30: add to the running allowance. */
  add: { enabled: boolean; title: string };
}

/** When the time buttons can be pressed, and what each says when it can't
 * (or, for 15 / 30 / 60 over a running allowance, what pressing it does:
 * the server replaces the allowance, it never adds to it). */
export function timeButtonsView(ap: AutoPlayView, a: TimeAllowance | null, busy: boolean): TimeButtonsView {
  const canStart = ap.shown && (ap.on || ap.enabled);
  const start = !ap.shown
    ? { enabled: false, title: "A house agent always plays." }
    : !canStart
      ? { enabled: false, title: ap.note }
      : a && a.state !== "done"
        ? { enabled: !busy, title: "Starts over: that many minutes from now (the time left is dropped)." }
        : { enabled: !busy, title: "Auto-play for that many minutes, then the agent finishes its match and stops." };
  const add = !ap.shown
    ? { enabled: false, title: "A house agent always plays." }
    : a === null
      ? { enabled: false, title: ap.on ? "No time limit is set: start with 15, 30 or 60 minutes to add time." : "Start with 15, 30 or 60 minutes first." }
      : a.state === "done"
        ? { enabled: false, title: "Done for today: start again with 15, 30 or 60 minutes." }
        : !a.canAddTime
          ? { enabled: false, title: a.endsAtReset ? "Today's time already runs to midnight (Sydney)." : "Time can't be added now." }
          : { enabled: !busy, title: a.state === "finishing" ? "Plays on: the agent is paired again next round." : "Adds to the time left." };
  return { start, add };
}

function timeButtons(mins: readonly number[], plus: boolean, st: { enabled: boolean; title: string }): string {
  return `<div class="tbtns" role="group" aria-label="${plus ? "Add time" : "Give the agent time"}">${mins.map((m) => `<button type="button" class="btn sm" data-act="play-time" data-min="${m}" data-add="${plus ? 1 : 0}" title="${esc(st.title)}"${st.enabled ? "" : " disabled"}>${plus ? "+" : ""}${m} min</button>`).join("")}</div>`;
}

/** Start / Stop: the auto-play switch as one big button (auto-play is how
 * the agent plays in Season 0). A house agent always plays. */
function startStop(ap: AutoPlayView, busy: boolean): string {
  if (!ap.shown) return `<span class="pill on">Always plays</span>`;
  const dis = ap.enabled && !busy ? "" : " disabled";
  return ap.on
    ? `<button type="button" class="btn sm ss stop" data-act="auto-play" data-on="0"${dis}>Stop</button>`
    : `<button type="button" class="btn pri sm ss" data-act="auto-play" data-on="1"${dis}${ap.enabled ? "" : ` title="${esc(ap.note)}"`}>Start</button>`;
}

/** Agent controls (replaces Live match): run the agent. */
export function agentControlsHtml(size: "S" | "M" | "L", d: AgentWidgetData): string {
  const p = d.play;
  const a = p.connectedAgent;
  if (!a) return noAgent();
  const fac = factionOf(p);
  const ap = autoPlayView(p.autoPlay, true);
  const inMatch = !!p.liveMatch;
  const allowance = allowanceOf(p.autoPlay, d.now);
  const ring = timeRingView(allowance, ap, inMatch);
  const tb = timeButtonsView(ap, allowance, !!d.busy);
  // "Go to match" sits beside Start / Stop from M up (S has no room).
  const go = inMatch ? `<a class="btn pri sm" href="#/match">Go to match</a>` : "";
  const top = `<div class="ac-top">${ringPortraitHtml(a.name, fac, ring, size === "S" ? 76 : 88)}<div class="wcol"><b class="ac-n">${esc(a.name)}</b>${statusPill(p)}${size === "S" ? "" : `<span class="small">${esc(ring.caption)}</span>`}<div class="row">${startStop(ap, !!d.busy)}${size === "S" ? "" : go}</div></div></div>`;
  if (size === "S") return top;
  const mine = myLiveMatch(d.live);
  const liveStyle = mine ? (mine.p1.agentId === a.agentId ? mine.p1.playStyle : mine.p2.agentId === a.agentId ? mine.p2.playStyle : null) : null;
  const dv = dialView(p, liveStyle);
  // At M the dial is smaller and its style's summary is the notches' titles.
  const dial = dv ? dialHtml(dv, { busy: d.busy, size: size === "M" ? 92 : 112, summary: size === "L" }) : `<p class="muted small">No play styles on this server.</p>`;
  const deck = `<div class="small">${ftag(fac)} ${esc(deckLine(p))}</div>`;
  const idle = inMatch ? "" : `<span class="muted small">No match live${ap.on ? ": joins the next ladder round" : ""}</span>`;
  const stopped = ap.stopped ? `<p class="muted small">${esc(ap.stopped)}</p>` : "";
  const time = `<div class="wcol tight tgrp"><span class="muted small">Give your agent</span>${timeButtons(TIME_PRESETS, false, tb.start)}</div>`;
  if (size === "M") return top + `<div class="ac-mid">${dial}<div class="wcol tight">${deck}${idle}${time}</div></div>` + stopped;
  const hist = d.history
    ? d.history.matches.length
      ? `<ul class="hlist">${d.history.matches.slice(0, 5).map((r) => historyRowHtml(historyRowView(r, d.now), { compact: true })).join("")}</ul>`
      : `<p class="muted small">No matches yet.</p>`
    : pending(d, "history", "Match history");
  const adds = `<div class="wcol tight tgrp"><span class="muted small">Add time while it runs</span>${timeButtons(TIME_ADDS, true, tb.add)}</div>`;
  return `<div class="wsplit wide-l"><div class="wcol">${top}${dial}${idle}${stopped}<div class="row top">${time}${adds}</div></div>`
    + `<div class="wcol"><h4>Deck</h4>${deckSwitcherHtml(deckOptions(p), !!d.busy)}<span class="muted small">A deck change applies from the next match.</span><h4>Match history</h4>${hist}</div></div>`;
}
