// The match pages' pure logic (render session 50): match history, the live
// scoreboard and the auto-play switch, read from the owner API's answers
// (OWNER_API.md "Auto-play", "Watch live", "Match history"). No DOM, no
// fetch: the page bundles this file and the tests import it, so what is
// tested is what runs. Every number shown is one the server sent.

import { esc } from "./siteModel.js";
import type { SiteAutoPlay, SiteHistoryResult, SiteHistoryRow, SiteLive, SiteLiveMatch, SitePublicSide } from "./siteApi.js";

/** How a result reads, and its tone (the row's letter and colour). */
export const RESULT_WORDS: Record<SiteHistoryResult, { word: string; letter: string; tone: "w" | "l" | "d" | "x" }> = {
  win: { word: "Win", letter: "W", tone: "w" },
  loss: { word: "Loss", letter: "L", tone: "l" },
  draw: { word: "Draw", letter: "D", tone: "d" },
  cancelled: { word: "Cancelled", letter: "C", tone: "x" },
  abandonedByYou: { word: "Abandoned (you)", letter: "A", tone: "l" },
  abandonedByOpponent: { word: "Abandoned (opponent)", letter: "A", tone: "w" },
};

export interface HistoryRowView {
  matchId: string;
  letter: string;
  tone: "w" | "l" | "d" | "x";
  word: string;
  /** "vs Hive Courier (House Swarm)". */
  versus: string;
  /** "+60 credits", "No credits" (a cancel, an abandon by you, a maxed day). */
  credits: string;
  /** "+14 rating", "-9 rating", "Not rated" (a cancel). Whole numbers. */
  rating: string;
  ratingTone: "up" | "down" | "flat" | "none";
  /** "12 turns", or null when the match never started. */
  turns: string | null;
  when: string;
  canReplay: boolean;
  canLog: boolean;
  /** Why there's no replay, when there isn't one (said, not hidden). */
  noReplay: string | null;
}

/** A signed whole number: "+14", "-9", "0". */
export function signed(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : r < 0 ? `−${Math.abs(r)}` : "0";
}

export function historyRowView(r: SiteHistoryRow, now: number): HistoryRowView {
  const w = RESULT_WORDS[r.result];
  const change = r.rating ? Math.round(r.rating.after) - Math.round(r.rating.before) : null;
  return {
    matchId: r.matchId,
    letter: w.letter,
    tone: w.tone,
    word: w.word,
    versus: `vs ${r.opponent.agentName} (${r.opponent.ownerName})`,
    credits: r.credits > 0 ? `+${r.credits} credits` : "No credits",
    rating: change === null ? "Not rated" : `${signed(change)} rating`,
    ratingTone: change === null ? "none" : change > 0 ? "up" : change < 0 ? "down" : "flat",
    turns: r.turns === null ? null : `${r.turns} turn${r.turns === 1 ? "" : "s"}`,
    when: whenText(r.endedAt, now),
    canReplay: r.hasReplay,
    canLog: r.hasLog,
    noReplay: r.hasReplay
      ? null
      : r.result === "abandonedByYou" || r.result === "abandonedByOpponent"
        ? "No replay: the match didn't resolve"
        : r.hasLog
          ? "No replay for this match"
          : "No replay: the match never started",
  };
}

/** "just now", "5 min ago", "3 h ago", then the date ("2 Nov, 14:05"). */
export function whenText(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  const s = Math.round((now - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 6 * 3600) return `${Math.floor(s / 3600)} h ago`;
  const d = new Date(t);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${d.getDate()} ${month}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The record over some rows: wins, losses and draws (cancels and
 * abandons by the opponent aren't games you lost; an abandon by you is). */
export function recordOf(rows: readonly SiteHistoryRow[]): { wins: number; losses: number; draws: number; line: string } {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const r of rows) {
    if (r.result === "win" || r.result === "abandonedByOpponent") wins++;
    else if (r.result === "loss" || r.result === "abandonedByYou") losses++;
    else if (r.result === "draw") draws++;
  }
  return { wins, losses, draws, line: `${wins}W ${losses}L${draws ? ` ${draws}D` : ""}` };
}

// ---- the auto-play switch ----------------------------------------------------

export interface AutoPlayView {
  /** Show the switch at all (a house owner has none: it always plays). */
  shown: boolean;
  on: boolean;
  /** The switch can be flipped now. */
  enabled: boolean;
  label: string;
  /** The line under it. */
  note: string;
  /** The server turned it off today: the message to show until midnight. */
  stopped: string | null;
}

export function autoPlayView(a: SiteAutoPlay, hasAgent: boolean): AutoPlayView {
  if (a.house) return { shown: false, on: true, enabled: false, label: "Always plays", note: "A house agent always plays.", stopped: null };
  const stopped = a.stopped ? "Auto-play turned off: today's rewards are maxed. Turn it on again after midnight (Sydney)." : null;
  if (!hasAgent) return { shown: true, on: a.on, enabled: false, label: "Auto-play", note: "Connect an agent to play matches.", stopped };
  if (a.on) return { shown: true, on: true, enabled: true, label: "Auto-play", note: "Your agent joins every ladder round. A match already live finishes if you turn it off.", stopped };
  if (!a.canTurnOn) return { shown: true, on: false, enabled: false, label: "Auto-play", note: "Today's rewards are maxed; auto-play can go on again after midnight (Sydney).", stopped };
  return { shown: true, on: false, enabled: true, label: "Auto-play", note: "Off: your agent sits out the ladder rounds.", stopped };
}

/** The switch as HTML (a real checkbox-role button, so a screen reader
 * hears "Auto-play, switch, on"). `id` names it on the page. */
export function autoPlaySwitch(v: AutoPlayView, id: string, busy = false): string {
  if (!v.shown) return `<span class="pill on" id="${id}">Always plays</span>`;
  return `<button type="button" class="switch${v.on ? " on" : ""}" id="${id}" role="switch" aria-checked="${v.on}" data-act="auto-play" data-on="${v.on ? "0" : "1"}"${v.enabled && !busy ? "" : " disabled"}><i aria-hidden="true"></i><span>${v.label}</span></button>`;
}

// ---- the live scoreboard -----------------------------------------------------

export interface ScoreSide {
  agentName: string;
  ownerName: string;
  rating: number;
  tier: string;
  health: number;
  maxHealth: number;
  /** 0-100, for the bar. */
  healthPct: number;
  energy: string;
  hand: number;
  units: number;
  isTurn: boolean;
  won: boolean;
}

export interface Scoreboard {
  matchId: string;
  p1: ScoreSide;
  p2: ScoreSide;
  /** "Turn 7 · Night Relay to play", "Night Relay wins", "Draw". */
  status: string;
  lastLine: string | null;
  /** Which side is the viewer's agent (null: watching someone else's). */
  mine: "p1" | "p2" | null;
  moves: number;
}

function scoreSide(side: SiteLiveMatch["p1"], pub: SitePublicSide, isTurn: boolean, won: boolean): ScoreSide {
  return {
    agentName: side.agentName,
    ownerName: side.ownerName,
    rating: Math.round(side.rating),
    tier: side.tier,
    health: Math.max(0, pub.health),
    maxHealth: pub.maxHealth,
    healthPct: pub.maxHealth > 0 ? Math.round((Math.max(0, pub.health) / pub.maxHealth) * 100) : 0,
    energy: `${pub.energy}/${pub.maxEnergy}`,
    hand: pub.hand,
    units: pub.board.length,
    isTurn,
    won,
  };
}

export function scoreboardOf(m: SiteLiveMatch, viewerOwnerId: string | null): Scoreboard {
  const n = m.now;
  const name = (s: "p1" | "p2") => m[s].agentName;
  const status = n.winner === "draw" ? "Draw" : n.winner ? `${name(n.winner)} wins` : `Turn ${n.turn} · ${name(n.activePlayer)} to play`;
  return {
    matchId: m.matchId,
    p1: scoreSide(m.p1, n.p1, !n.winner && n.activePlayer === "p1", n.winner === "p1"),
    p2: scoreSide(m.p2, n.p2, !n.winner && n.activePlayer === "p2", n.winner === "p2"),
    status,
    lastLine: tidyLines(m.recentLines, { p1: m.p1.agentName, p2: m.p2.agentName }).pop() ?? null,
    mine: viewerOwnerId === null ? null : m.p1.ownerId === viewerOwnerId ? "p1" : m.p2.ownerId === viewerOwnerId ? "p2" : null,
    moves: m.released,
  };
}

/** The viewer's own live match in `GET /api/live`, if any. */
export function myLiveMatch(live: SiteLive | null): SiteLiveMatch | null {
  if (!live || !live.mine) return null;
  return live.matches.find((m) => m.matchId === live.mine) ?? null;
}

// ---- HTML (shared by the widgets and the Agent match page) -------------------

/** One history row: the result letter, who it was against, what it paid
 * and did to the rating, and its Replay and Log buttons. `compact` (the
 * widget at M) drops the buttons' words to icons' titles. */
export function historyRowHtml(v: HistoryRowView, opts: { compact?: boolean } = {}): string {
  const replay = v.canReplay
    ? `<button type="button" class="btn sm" data-act="replay" data-match="${esc(v.matchId)}">Replay</button>`
    : `<span class="muted small" title="${esc(v.noReplay ?? "")}">No replay</span>`;
  const log = v.canLog && !opts.compact ? `<button type="button" class="btn sm ghost" data-act="match-log" data-match="${esc(v.matchId)}">Log</button>` : "";
  return `<li class="hrow" data-match="${esc(v.matchId)}"><span class="wl ${v.tone}" aria-hidden="true">${esc(v.letter)}</span>`
    + `<span class="hr-main"><b>${esc(v.word)}</b> <span class="hr-vs">${esc(v.versus)}</span><small class="muted">${esc(v.when)}${v.turns ? ` · ${esc(v.turns)}` : ""}</small></span>`
    + `<span class="hr-num"><b>${esc(v.credits)}</b><small class="rt ${v.ratingTone}">${esc(v.rating)}</small></span>`
    + `<span class="hr-act">${replay}${log}</span></li>`;
}

function sideHtml(s: ScoreSide, seat: "near" | "far", mine: boolean): string {
  return `<div class="sb-side ${seat}${s.isTurn ? " turn" : ""}${s.won ? " won" : ""}${mine ? " mine" : ""}">`
    + `<div class="sb-name"><b>${esc(s.agentName)}</b><small class="muted">${esc(s.ownerName)} · ${s.rating} ${esc(s.tier)}</small></div>`
    + `<div class="sb-hp" role="img" aria-label="${esc(`${s.agentName}: ${s.health} of ${s.maxHealth} health`)}"><b>${s.health}</b><span class="bar"><i style="width:${s.healthPct}%"></i></span></div>`
    + `<div class="sb-meta small muted">Energy ${esc(s.energy)} · Hand ${s.hand} · Units ${s.units}</div></div>`;
}

/** The live scoreboard: both sides' names, health, energy, hand and units,
 * the turn, and (unless `small`) the last log line released. */
export function scoreboardHtml(sb: Scoreboard, opts: { small?: boolean } = {}): string {
  // The owner's own agent is always on the near (left) side (owner
  // 2026-11-02: owners keep their own agent's view); a spectator sees p1 left.
  const [a, b] = nearFirst(sb.mine);
  return `<div class="sb${opts.small ? " sb-s" : ""}" data-match="${esc(sb.matchId)}" data-near="${a}">${sideHtml(sb[a], "near", sb.mine === a)}<div class="sb-mid"><span class="live-dot" aria-hidden="true"></span><b>${esc(sb.status)}</b></div>${sideHtml(sb[b], "far", sb.mine === b)}</div>`
    + (opts.small || !sb.lastLine ? "" : `<p class="sb-line small" title="The last play released">${esc(sb.lastLine)}</p>`);
}

/** Which seat shows first (near) and second: the viewer's own seat first. */
export function nearFirst(mine: "p1" | "p2" | null): ["p1" | "p2", "p1" | "p2"] {
  return mine === "p2" ? ["p2", "p1"] : ["p1", "p2"];
}

/** A released log line (the engine's formatEvent text, OWNER_API.md
 * TimelineStep.lines) as the play-by-play reads it: seats by agent name,
 * no instance ids, and none of the bookkeeping (priority passes, turn
 * ends). null: the line is dropped. */
export function tidyLine(line: string, names: Record<"p1" | "p2", string>): string | null {
  let t = line.trim();
  if (!t || /passes priority$/.test(t) || /^\[end of turn /.test(t)) return null;
  const turn = /^--- Turn (\d+) \((p[12])\) ---$/.exec(t);
  if (turn) return `Turn ${turn[1]} · ${names[turn[2] as "p1" | "p2"]}`;
  const over = /^=== GAME OVER: (.*) ===$/.exec(t);
  if (over) t = `Game over: ${over[1]}`;
  const res = /^>>> resolving: (.*)$/.exec(t);
  if (res) t = `${res[1]} resolves`;
  const ab = /^ability: (.*) — (.*) \([a-zA-Z]+\)$/.exec(t);
  // The log names the ability by its id; the play-by-play says whose it is.
  if (ab) t = `${ab[1]}'s ability triggers`;
  t = t.replace(/ \(goes on the stack\)/, "").replace(/ \[(Instant|Sorcery)\]/, "").replace(/ \((unit)\)$/, "").replace(/ \([a-z]\d+\)/g, "").replace(/ \((p[12])\) dies$/, " dies");
  t = t.replace(/\b(p[12])\b/g, (_, s: "p1" | "p2") => names[s]);
  return t;
}

/** Tidies a run of lines, dropping what tidyLine drops. */
export function tidyLines(lines: readonly string[], names: Record<"p1" | "p2", string>): string[] {
  const out: string[] = [];
  for (const l of lines) {
    const t = tidyLine(l, names);
    if (t !== null) out.push(t);
  }
  return out;
}

function unitChips(side: SitePublicSide): string {
  if (!side.board.length) return `<span class="muted small">No units</span>`;
  return side.board.map((u) => `<span class="uc${u.pending ? " pend" : ""}" title="${esc(`${u.name} ${u.attack}/${u.health}${u.pending ? " (arming)" : ""}${u.tools.length ? ` · ${u.tools.join(", ")}` : ""}`)}"><b>${esc(u.name)}</b> ${u.attack}/${Math.max(0, u.health)}</span>`).join("");
}

/** The compact board (Live match M and L): each side's units by name and
 * stats, as released. Counts only for the hand (the server sends no hand). */
export function compactBoard(m: SiteLiveMatch, mine: "p1" | "p2" | null = null): string {
  const [a, b] = nearFirst(mine);
  return `<div class="cboard"><div class="cb-row" data-seat="${a}">${unitChips(m.now[a])}</div><div class="cb-row" data-seat="${b}">${unitChips(m.now[b])}</div></div>`;
}

/** One live match as a single line (the Watch live widget's list). */
export function liveLineHtml(sb: Scoreboard): string {
  const [a, b] = nearFirst(sb.mine);
  return `<li class="lline"><span class="live-dot" aria-hidden="true"></span><b>${esc(sb[a].agentName)}</b> <span class="lhp">${sb[a].health}–${sb[b].health}</span> <b>${esc(sb[b].agentName)}</b> <small class="muted">${esc(sb.status)}</small></li>`;
}

