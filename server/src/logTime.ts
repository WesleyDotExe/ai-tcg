// (session 92, the hardening pass for the 7-day unattended run) Every line
// the Season 0 server prints starts with the machine's local date and time,
// so an owner reading the terminal (or a file it was sent to) after a
// problem can tell when each thing happened: "2026-12-05 09:00:00 [ladder]
// round 1: 2 matches". The machine's own clock and time zone, the ones the
// owner sees; the daily reset is still at midnight Sydney whatever the
// machine's zone is (economy/src/dailyReset.ts).

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** `d` as the local "YYYY-MM-DD HH:MM:SS". */
export function localStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** A line printed by a stamped console starts with this (the dev scripts
 * that read the server's output take it off). */
export const STAMP_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} /gm;

/** Makes console.log, info, warn and error start each call's output with
 * the local time (`now`, for tests). Idempotent. */
export function stampConsole(now: () => Date = () => new Date()): void {
  const c = console as Console & { __stamped?: true };
  if (c.__stamped) return;
  c.__stamped = true;
  for (const level of ["log", "info", "warn", "error"] as const) {
    const write = c[level].bind(c);
    c[level] = (...args: unknown[]) => {
      const stamp = localStamp(now());
      if (typeof args[0] === "string") write(`${stamp} ${args[0]}`, ...args.slice(1));
      else write(stamp, ...args);
    };
  }
}
