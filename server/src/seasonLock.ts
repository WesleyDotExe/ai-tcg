import { hostname, uptime } from "node:os";
import { linkSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

// (session 86, the hardening pass; owner 2026-11-11 answer 4) One process at
// a time on a season file. Every CLI that opens a season file (`npm run
// season`, `owner-api`, `ladder`) holds `<file>.lock` while it runs, and
// `npm run season:next` holds the ended file's lock while it reads it. So:
//   - `season:next` refuses while a server is still running on the old
//     season's file (its writes after the new file is made would be lost to
//     the new season), and
//   - a second server on the same file is refused (two ladders pairing the
//     same owners, two processes writing one file).
// The lock is a small JSON file naming the process that holds it. A lock
// left behind by a process that died without cleaning up (killed, or the
// machine rebooted) is taken over, and the CLI says so. A lock from another
// machine can't be checked, so it is honoured.

export interface LockHolder {
  pid: number;
  host: string;
  /** What holds it, e.g. "npm run season". */
  command: string;
  startedAt: string;
}

export type LockState =
  | { state: "free" }
  | { state: "held"; holder: LockHolder }
  /** Left by a process that is gone; `why` says how that's known. */
  | { state: "stale"; holder: LockHolder | null; why: string };

export interface SeasonLock {
  path: string;
  /** The stale lock this one replaced, if any (the CLI prints it). */
  tookOver: { holder: LockHolder | null; why: string } | null;
  /** Removes the lock if it is still this one's. Safe to call twice. */
  release(): void;
}

export const lockPathFor = (dbPath: string) => `${dbPath}.lock`;

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: it exists but belongs to someone else, so it is alive.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function parseHolder(text: string): LockHolder | null {
  try {
    const h = JSON.parse(text) as Partial<LockHolder>;
    if (typeof h.pid === "number" && Number.isInteger(h.pid) && h.pid > 0 && typeof h.host === "string" && typeof h.command === "string" && typeof h.startedAt === "string") {
      return { pid: h.pid, host: h.host, command: h.command, startedAt: h.startedAt };
    }
  } catch {
    // fall through
  }
  return null;
}

export interface LockEnv {
  host?: string;
  /** When this machine last started (default: now - os.uptime()). */
  bootedAt?: Date;
  alive?: (pid: number) => boolean;
}

/** Who holds `dbPath`'s lock, without touching it. */
export function seasonLockState(dbPath: string, env: LockEnv = {}): LockState {
  const path = lockPathFor(dbPath);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { state: "free" };
    throw err;
  }
  const holder = parseHolder(text);
  // A lock is written whole (to a temporary file, then linked into place),
  // so one that doesn't parse was damaged, not half-written by a live holder.
  if (holder === null) return { state: "stale", holder: null, why: "the lock file is unreadable" };
  if (holder.host !== (env.host ?? hostname())) return { state: "held", holder };
  // A process id can be reused after a restart, so a lock older than this
  // machine's last start is stale even if some process has its number now.
  const booted = env.bootedAt ?? new Date(Date.now() - uptime() * 1000);
  const started = Date.parse(holder.startedAt);
  if (Number.isFinite(started) && started < booted.getTime() - 60_000) {
    return { state: "stale", holder, why: "the machine has restarted since it was taken" };
  }
  if (!(env.alive ?? pidAlive)(holder.pid)) return { state: "stale", holder, why: `process ${holder.pid} is no longer running` };
  return { state: "held", holder };
}

/** One line naming a lock's holder, for messages. */
export function describeHolder(h: LockHolder): string {
  return `${h.command} (process ${h.pid} on ${h.host}, since ${h.startedAt})`;
}

/**
 * Takes `dbPath`'s lock for this process, or says why it can't. A stale lock
 * is replaced. `command` names this process in the lock (and in another
 * process's refusal).
 */
export function acquireSeasonLock(dbPath: string, command: string, env: LockEnv = {}): SeasonLock | { problem: string } {
  const path = lockPathFor(dbPath);
  const holder: LockHolder = { pid: process.pid, host: env.host ?? hostname(), command, startedAt: new Date().toISOString() };
  const text = `${JSON.stringify(holder)}\n`;
  const temp = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  let tookOver: SeasonLock["tookOver"] = null;
  writeFileSync(temp, text);
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        linkSync(temp, path); // atomic: fails if a lock is already there
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          process.removeListener("exit", release);
          try {
            if (readFileSync(path, "utf8") === text) unlinkSync(path);
          } catch {
            // already gone
          }
        };
        process.on("exit", release);
        return { path, tookOver, release };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      }
      const state = seasonLockState(dbPath, env);
      if (state.state === "held") {
        return {
          problem:
            `"${dbPath}" is in use by ${describeHolder(state.holder)}. Stop that first. ` +
            `If you are sure nothing is running on it, delete ${path}.`,
        };
      }
      if (state.state === "stale") {
        tookOver = { holder: state.holder, why: state.why };
        try {
          unlinkSync(path);
        } catch {
          // someone else removed it first; try again
        }
      }
    }
    return { problem: `couldn't take the lock ${path}: it keeps changing (another process is starting on "${dbPath}")` };
  } finally {
    unlinkSync(temp);
  }
}

/** The line a CLI prints when it replaced a stale lock. */
export function tookOverLine(lock: SeasonLock): string | null {
  if (lock.tookOver === null) return null;
  const who = lock.tookOver.holder ? ` left by ${describeHolder(lock.tookOver.holder)}` : "";
  return `[lock] took over a stale lock${who}: ${lock.tookOver.why}`;
}


/** For a CLI with no shutdown of its own: Ctrl-C or a stop signal exits
 * through process.exit, so the lock's exit handler runs (a signal's default
 * action would skip it and leave the lock stale). */
export function exitOnStopSignals(): void {
  process.once("SIGINT", () => process.exit(130));
  process.once("SIGTERM", () => process.exit(143));
}
