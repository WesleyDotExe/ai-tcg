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
  /** Why (the server's reason): the day's rewards maxed, or the play-time
   * allowance ran out (render session 58). */
  stoppedWhy?: "dailyRewardsMaxed" | "timeUp" | null;
}

export function autoPlayView(a: SiteAutoPlay, hasAgent: boolean): AutoPlayView {
  if (a.house) return { shown: false, on: true, enabled: false, label: "Always plays", note: "A house agent always plays.", stopped: null, stoppedWhy: null };
  const stoppedWhy = !a.stopped ? null : a.stopped.reason === "timeUp" ? "timeUp" : "dailyRewardsMaxed";
  const stopped = !a.stopped
    ? null
    : stoppedWhy === "timeUp"
      ? "Auto-play stopped: the time you gave your agent ran out. Give it more time, or start it with no limit."
      : "Auto-play turned off: today's rewards are maxed. Turn it on again after midnight (Sydney).";
  const base = { shown: true, label: "Auto-play", stopped, stoppedWhy } as const;
  if (!hasAgent) return { ...base, on: a.on, enabled: false, note: "Connect an agent to play matches." };
  if (a.on) return { ...base, on: true, enabled: true, note: "Your agent joins every ladder round. A match already live finishes if you turn it off." };
  if (!a.canTurnOn) return { ...base, on: false, enabled: false, note: "Today's rewards are maxed; auto-play can go on again after midnight (Sydney)." };
  return { ...base, on: false, enabled: true, note: "Off: your agent sits out the ladder rounds." };
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
  /** The side shown near (first, left; on the arena, at the bottom): the
   * viewer's own agent, else the side the viewer chose to watch as, else
   * the server's `defaultView` (the higher rating at the start, p1 on a
   * tie), else p1 (render session 52, the spectator point of view). */
  near: "p1" | "p2";
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

/** The side a viewer sees near: their own agent's seat always (owner
 * 2026-11-02: an owner keeps their own agent's view); a spectator's choice
 * for this match; the server's `defaultView`; p1. */
export function nearSeat(mine: "p1" | "p2" | null, chosen: "p1" | "p2" | null | undefined, defaultView: "p1" | "p2" | null | undefined): "p1" | "p2" {
  if (mine) return mine;
  if (chosen === "p1" || chosen === "p2") return chosen;
  return defaultView === "p2" ? "p2" : "p1";
}

export function scoreboardOf(m: SiteLiveMatch, viewerOwnerId: string | null, chosen: "p1" | "p2" | null = null): Scoreboard {
  const n = m.now;
  const name = (s: "p1" | "p2") => m[s].agentName;
  const status = n.winner === "draw" ? "Draw" : n.winner ? `${name(n.winner)} wins` : `Turn ${n.turn} · ${name(n.activePlayer)} to play`;
  const mine = viewerOwnerId === null ? null : m.p1.ownerId === viewerOwnerId ? "p1" : m.p2.ownerId === viewerOwnerId ? "p2" : null;
  return {
    matchId: m.matchId,
    p1: scoreSide(m.p1, n.p1, !n.winner && n.activePlayer === "p1", n.winner === "p1"),
    p2: scoreSide(m.p2, n.p2, !n.winner && n.activePlayer === "p2", n.winner === "p2"),
    status,
    lastLine: tidyLines(m.recentLines, { p1: m.p1.agentName, p2: m.p2.agentName }).pop() ?? null,
    mine,
    near: nearSeat(mine, chosen, m.defaultView),
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
  // 2026-11-02: owners keep their own agent's view); a spectator sees the
  // side they watch as (render session 52), by default the higher-rated.
  const [a, b] = nearFirst(sb.near);
  return `<div class="sb${opts.small ? " sb-s" : ""}" data-match="${esc(sb.matchId)}" data-near="${a}">${sideHtml(sb[a], "near", sb.mine === a)}<div class="sb-mid"><span class="live-dot" aria-hidden="true"></span><b>${esc(sb.status)}</b></div>${sideHtml(sb[b], "far", sb.mine === b)}</div>`
    + (opts.small || !sb.lastLine ? "" : `<p class="sb-line small" title="The last play released">${esc(sb.lastLine)}</p>`);
}

/** Which seat shows first (near) and second. */
export function nearFirst(near: "p1" | "p2" | null): ["p1" | "p2", "p1" | "p2"] {
  return near === "p2" ? ["p2", "p1"] : ["p1", "p2"];
}

/** The spectator's "Watch as: <A> | <B>" switch (owner 2026-11-02, the
 * point of view): one two-button group with the agents' names, the side
 * watched as pressed. On every view of a match the viewer doesn't own; none
 * on their own agent's match (they always see their own side), so "" there.
 * `idPrefix` keeps the buttons' ids unique per place (focus survives a redraw). */
export function watchAsHtml(sb: Scoreboard, idPrefix: string): string {
  if (sb.mine) return "";
  const btn = (seat: "p1" | "p2") => {
    const on = sb.near === seat;
    return `<button type="button" class="wa-b${on ? " on" : ""}" id="${esc(`${idPrefix}-${sb.matchId}-${seat}`)}" data-act="watch-as" data-match="${esc(sb.matchId)}" data-seat="${seat}" aria-pressed="${on}" title="${esc(`Watch as ${sb[seat].agentName}: their side near`)}">${esc(sb[seat].agentName)}</button>`;
  };
  return `<div class="watch-as" role="group" aria-label="Watch as"><span class="wa-l small">Watch as:</span>${btn("p1")}${btn("p2")}</div>`;
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
export function compactBoard(m: SiteLiveMatch, near: "p1" | "p2" | null = null): string {
  const [a, b] = nearFirst(near);
  return `<div class="cboard"><div class="cb-row" data-seat="${a}">${unitChips(m.now[a])}</div><div class="cb-row" data-seat="${b}">${unitChips(m.now[b])}</div></div>`;
}

/** One live match as a single line (the Watch live widget's list). */
export function liveLineHtml(sb: Scoreboard): string {
  const [a, b] = nearFirst(sb.near);
  return `<li class="lline"><span class="live-dot" aria-hidden="true"></span><b>${esc(sb[a].agentName)}</b> <span class="lhp">${sb[a].health}–${sb[b].health}</span> <b>${esc(sb[b].agentName)}</b> <small class="muted">${esc(sb.status)}</small></li>`;
}


// ---- the 2× vote (render session 56; game session 73) -----------------------
//
// The owner's 2026-11-04 order: on the owner's own live match, "Ask for 2×"
// (and taking it back), who asks and who is being waited on, from the live
// view's `speed` (OWNER_API.md SpeedView). The rule is the server's: a match
// runs at 2× only while both sides agree; a house side agrees to whatever its
// player opponent asks. This only words what the server sent.

export interface SpeedControlView {
  /** The viewer's own match, still releasing moves: the button shows. */
  canVote: boolean;
  rate: 1 | 2;
  /** The status line: "2× · both owners agreed", "You asked for 2×. Waiting on Boris.", ... */
  line: string;
  /** The button's words and what it sends (`ask`), or null for no button. */
  button: { label: string; ask: boolean } | null;
  /** A short pill for a spectator's card ("2×"), or null at 1×. */
  pill: string | null;
}

export function speedControlView(m: SiteLiveMatch, viewerOwnerId: string | null): SpeedControlView | null {
  const sp = m.speed;
  if (!sp) return null;
  const mine = viewerOwnerId === null ? null : m.p1.ownerId === viewerOwnerId ? "p1" : m.p2.ownerId === viewerOwnerId ? "p2" : null;
  const ended = m.nextAt === null || m.now.winner !== null;
  const pill = sp.rate === 2 && !ended ? "2×" : null;
  if (!mine || ended) {
    const line = ended ? "" : sp.rate === 2 ? (sp.house.p1 || sp.house.p2 ? "2×: the player's owner asked, the house agrees" : "2×: both owners agreed") : "";
    return { canVote: false, rate: sp.rate, line, button: null, pill };
  }
  const other = mine === "p1" ? "p2" : "p1";
  const otherName = m[other].ownerName;
  const vsHouse = sp.house[other];
  if (sp.rate === 2) {
    return { canVote: true, rate: 2, line: vsHouse ? "Playing at 2×: the house agrees to what you ask." : `Playing at 2×: you and ${otherName} agreed.`, button: { label: "Back to 1×", ask: false }, pill };
  }
  if (sp.asks[mine]) {
    // Asked, still 1×: the other owner hasn't agreed yet.
    return { canVote: true, rate: 1, line: `You asked for 2×. Waiting on ${otherName}.`, button: { label: "Take back", ask: false }, pill };
  }
  if (sp.asks[other] && sp.waitingOn === mine) {
    return { canVote: true, rate: 1, line: `${otherName} asks for 2×. It starts when you agree.`, button: { label: "Agree to 2×", ask: true }, pill };
  }
  return { canVote: true, rate: 1, line: vsHouse ? "Against the house, your ask alone makes it 2×." : `2× needs you and ${otherName} to agree.`, button: { label: "Ask for 2×", ask: true }, pill };
}

/** The control as HTML: the status line and its button. `id` names the
 * button (focus is kept across redraws by id). */
export function speedControlHtml(v: SpeedControlView | null, id: string, matchId: string, busy = false): string {
  if (!v || (!v.canVote && !v.line)) return "";
  const btn = v.button ? `<button type="button" class="btn sm${v.button.ask ? " pri" : ""}" id="${id}" data-act="live-speed" data-match="${esc(matchId)}" data-ask="${v.button.ask ? "1" : "0"}"${busy ? " disabled" : ""}>${esc(v.button.label)}</button>` : "";
  return `<div class="speed-ctl${v.rate === 2 ? " fast" : ""}" role="status"><span class="speed-rate" aria-hidden="true">${v.rate}×</span><span class="speed-line small">${esc(v.line)}</span>${btn}</div>`;
}
