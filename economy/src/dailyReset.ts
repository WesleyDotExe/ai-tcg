// The daily reset (owner 2026-11-01, Season 0 decisions: "midnight Sydney
// time (Australia/Sydney, following daylight saving), for the daily win
// schedule and any daily rewards"). Before session 64 the day was the UTC
// date of a match's end; now it is the date on a Sydney clock, and a day
// runs from one Sydney midnight to the next, so it is 24 hours long except
// across a daylight-saving change (23 hours on the first Sunday of October,
// 25 on the first Sunday of April).
//
// Node's built-in time zone data (Intl) does the conversion; no external
// service and no package.

import { DAILY_RESET_TIME_ZONE } from "./config.js";

/** One reset day: its date on the reset clock, and the instants (UTC ISO,
 * the form `recordMatch` stores) it starts at and the next one starts at. */
export interface ResetDay {
  /** "2026-11-02": the date on the reset clock. */
  day: string;
  timeZone: string;
  startsAt: string;
  /** When the next day starts: the next reset. */
  endsAt: string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The wall-clock fields of `ms` in `timeZone`. */
function wallClock(ms: number, timeZone: string): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return { y: +parts.year!, mo: +parts.month!, d: +parts.day!, h: +parts.hour!, mi: +parts.minute!, s: +parts.second! };
}

/** The zone's offset from UTC at `ms`, in milliseconds (Sydney: +10 h or
 * +11 h). Whole seconds; Sydney's offsets are whole hours. */
function offsetAt(ms: number, timeZone: string): number {
  const w = wallClock(ms, timeZone);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
}

/** The instant the reset clock reads 00:00:00 on a date. Sydney never skips
 * or repeats midnight (its changes are at 02:00 and 03:00), so there is
 * exactly one; two corrections settle any offset change. */
function midnight(y: number, mo: number, d: number, timeZone: string): number {
  const wall = Date.UTC(y, mo - 1, d);
  let guess = wall - offsetAt(wall, timeZone);
  guess = wall - offsetAt(guess, timeZone);
  return guess;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** The reset day an instant falls in. Throws on a time that isn't valid. */
export function resetDayOf(at: string | Date, timeZone: string = DAILY_RESET_TIME_ZONE): ResetDay {
  const ms = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (Number.isNaN(ms)) throw new RangeError(`not a valid time: "${String(at)}"`);
  const w = wallClock(ms, timeZone);
  const start = midnight(w.y, w.mo, w.d, timeZone);
  const next = new Date(Date.UTC(w.y, w.mo - 1, w.d + 1));
  const end = midnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone);
  const day = `${String(w.y).padStart(4, "0")}-${String(w.mo).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`;
  return { day, timeZone, startsAt: iso(start), endsAt: iso(end) };
}
