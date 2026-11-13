// The season's end on the website (render session 72; owner 2026-11-13: the
// season's end is decided by the server, at a time set before it starts;
// Season 0 ends at midnight Sydney at the end of 26 December 2026). Pure, so
// the tests draw it in Node: `GET /api/season`'s state and `endsAt` (game
// session 94, schema v29) worded for the Stats page's ladder, in Sydney time
// (the game's day is Sydney's, as the daily reset).

import { esc } from "./siteModel.js";

/** `GET /api/season` (OWNER_API.md "The season's end"), the parts the site
 * reads. The archive fields (`standings`, `retiredPrototypes`, ...) are
 * typed loosely: no page draws them in Season 0. */
export interface SiteSeason {
  season: string;
  state: "open" | "ending" | "ended";
  endedAt: string | null;
  /** (v29) When the server ends the season; null: no end time set. Absent
   * on a server older than v29. */
  endsAt?: string | null;
  liveMatches: number;
  tierCoinsNow: { tier: string; coins: string[] } | null;
  you: unknown;
  standings: unknown[] | null;
  retiredPrototypes: unknown[] | null;
  startedFrom: unknown;
  yourSeed: unknown;
}

const SYD = "Australia/Sydney";
// Three letters every month (en-AU's short months say "June" and "Sept").
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mon = (m: string | undefined) => MONTHS[Number(m) - 1] ?? m ?? "";

/** "Season 0" from "S0". */
export function seasonName(code: string): string {
  const m = /^S(\d+)$/.exec(code);
  return m ? `Season ${m[1]}` : code;
}

/** A time in Sydney: "the end of Sat 26 Dec" for a midnight (so 00:00 on the
 * 27th reads as the owner said it, the end of the 26th), else "Sat 26 Dec,
 * 23:00". */
export function sydneyWhen(iso: string): string {
  const d = new Date(iso);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-AU", { timeZone: SYD, weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((p) => [p.type, p.value]));
  if (parts.hour === "00" && parts.minute === "00") {
    // The day before, in Sydney (midnight minus a minute).
    const before = Object.fromEntries(new Intl.DateTimeFormat("en-AU", { timeZone: SYD, weekday: "short", day: "numeric", month: "numeric" }).formatToParts(new Date(d.getTime() - 60_000)).map((p) => [p.type, p.value]));
    return `midnight at the end of ${before.weekday} ${before.day} ${mon(before.month)}`;
  }
  return `${parts.weekday} ${parts.day} ${mon(parts.month)}, ${parts.hour}:${parts.minute}`;
}

/** "in 43 days", "in 5 h", "in 12 min", "in under a minute". */
export function untilText(ms: number): string {
  if (ms < 60_000) return "in under a minute";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `in ${h} h`;
  return `in ${Math.floor(h / 24)} days`;
}

export interface SeasonEndView {
  /** "open" with an end time, "open" with none, "ending" or "ended". */
  tone: "open" | "none" | "ending" | "ended";
  /** The line: "Season 0 ends at midnight at the end of Sat 26 Dec (Sydney time), in 43 days." */
  line: string;
  /** The short chip beside the ladder's title: "Ends in 43 days". */
  chip: string;
}

/** The season's end in words, at `now` (the page's clock). Null with no
 * season read yet. */
export function seasonEndView(s: SiteSeason | null, now: number): SeasonEndView | null {
  if (!s) return null;
  const name = seasonName(s.season);
  if (s.state === "ended") {
    return { tone: "ended", line: `${name} has ended${s.endedAt ? ` (its last match recorded ${sydneyWhen(s.endedAt)}, Sydney time)` : ""}. The ladder is its final standings.`, chip: "Ended" };
  }
  if (s.state === "ending") {
    const shown = s.liveMatches === 0 ? "it ends in a moment" : s.liveMatches === 1 ? "the match on screen finishes and counts, then it ends" : `the ${s.liveMatches} matches on screen finish and count, then it ends`;
    return { tone: "ending", line: `${name} is ending: no new round starts; ${shown}.`, chip: "Ending now" };
  }
  if (!s.endsAt) return { tone: "none", line: `${name} has no end time set yet.`, chip: "No end time" };
  const left = Date.parse(s.endsAt) - now;
  if (left <= 0) return { tone: "ending", line: `${name}'s end time has passed: it ends once the matches on screen finish.`, chip: "Ending now" };
  const until = untilText(left);
  return { tone: "open", line: `${name} ends at ${sydneyWhen(s.endsAt)} (Sydney time), ${until}. The server ends it: no new round starts from then.`, chip: `Ends ${until}` };
}

/** The line under the ladder's title, or "" with no season read. */
export function seasonEndHtml(v: SeasonEndView | null): string {
  if (!v) return "";
  return `<p class="st-season t-${v.tone}" role="note"><b>${esc(v.chip)}</b> ${esc(v.line)}</p>`;
}

/** The season no longer starts matches (ending, ended, or its end time
 * passed on the page's clock): the short reason Agent controls gives for
 * Start and the time buttons being off, or null while it is open. */
export interface SeasonClosed {
  ended: boolean;
  /** "Season 0 has ended: no new match starts." */
  why: string;
}

export function seasonClosed(s: SiteSeason | null, now: number): SeasonClosed | null {
  const v = seasonEndView(s, now);
  if (!v || !s || (v.tone !== "ending" && v.tone !== "ended")) return null;
  const name = seasonName(s.season);
  return v.tone === "ended" ? { ended: true, why: `${name} has ended: no new match starts.` } : { ended: false, why: `${name} is ending: no new round starts.` };
}
