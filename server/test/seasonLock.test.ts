// (session 86) One process at a time on a season file (server/src/seasonLock.ts):
// the lock is taken whole, refused while its holder runs, taken over when its
// holder is gone, and only ever removed by its own holder.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireSeasonLock, lockPathFor, seasonLockState, tookOverLine, type LockHolder, type SeasonLock } from "../src/seasonLock.js";

const dirs: string[] = [];
const held: SeasonLock[] = [];
afterEach(() => {
  for (const l of held.splice(0)) l.release();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const dbIn = () => {
  const d = mkdtempSync(join(tmpdir(), "season-lock-"));
  dirs.push(d);
  return join(d, "season-0.db");
};
const take = (db: string, command = "npm run season", env = {}) => {
  const l = acquireSeasonLock(db, command, env);
  if ("problem" in l) throw new Error(l.problem);
  held.push(l);
  return l;
};
const writeLock = (db: string, h: Partial<LockHolder>) =>
  writeFileSync(lockPathFor(db), JSON.stringify({ pid: 4_000_000, host: hostname(), command: "npm run season", startedAt: new Date().toISOString(), ...h }));
/** A process id that was running a moment ago and isn't now. */
const deadPid = () => spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" }).stdout;

describe("acquireSeasonLock", () => {
  it("writes the holder whole and removes it on release", () => {
    const db = dbIn();
    const lock = take(db);
    const holder = JSON.parse(readFileSync(lockPathFor(db), "utf8")) as LockHolder;
    expect(holder).toMatchObject({ pid: process.pid, host: hostname(), command: "npm run season" });
    expect(lock.tookOver).toBeNull();
    expect(seasonLockState(db)).toEqual({ state: "held", holder });
    lock.release();
    lock.release();
    expect(existsSync(lockPathFor(db))).toBe(false);
    expect(seasonLockState(db)).toEqual({ state: "free" });
  });

  it("leaves no temporary file beside the lock, taken or refused", () => {
    const db = dbIn();
    take(db);
    expect(acquireSeasonLock(db, "npm run season:next")).toHaveProperty("problem");
    const dir = join(db, "..");
    expect(readdirSync(dir).sort()).toEqual(["season-0.db.lock"]);
  });

  it("refuses while the holder runs, naming it", () => {
    const db = dbIn();
    take(db);
    const second = acquireSeasonLock(db, "npm run season:next");
    expect("problem" in second && second.problem).toContain(`is in use by npm run season (process ${process.pid} on ${hostname()}`);
    expect("problem" in second && second.problem).toContain(`delete ${lockPathFor(db)}`);
  });

  it("takes over a lock whose process is gone, and says so", () => {
    const db = dbIn();
    const pid = Number(deadPid());
    writeLock(db, { pid });
    expect(seasonLockState(db)).toMatchObject({ state: "stale", why: `process ${pid} is no longer running` });
    const lock = take(db, "npm run season:next");
    expect(tookOverLine(lock)).toContain(`took over a stale lock left by npm run season (process ${pid} on`);
    expect((JSON.parse(readFileSync(lockPathFor(db), "utf8")) as LockHolder).pid).toBe(process.pid);
  });

  it("takes over a lock from before the machine last started, even if its process id is in use again", () => {
    const db = dbIn();
    writeLock(db, { pid: process.pid, startedAt: "2026-01-01T00:00:00.000Z" });
    expect(seasonLockState(db, { bootedAt: new Date("2026-02-01T00:00:00Z") })).toMatchObject({ state: "stale", why: "the machine has restarted since it was taken" });
    expect(seasonLockState(db, { bootedAt: new Date("2025-12-01T00:00:00Z") }).state).toBe("held");
  });

  it("takes over an unreadable lock", () => {
    const db = dbIn();
    writeFileSync(lockPathFor(db), "{ not json");
    expect(tookOverLine(take(db))).toBe("[lock] took over a stale lock: the lock file is unreadable");
  });

  it("honours a lock from another machine (it can't be checked)", () => {
    const db = dbIn();
    writeLock(db, { pid: Number(deadPid()), host: "another-machine" });
    const r = acquireSeasonLock(db, "npm run season");
    expect("problem" in r && r.problem).toContain("on another-machine");
  });

  it("release never removes a lock that has been taken over by another", () => {
    const db = dbIn();
    const mine = take(db);
    writeLock(db, { pid: 12345, command: "npm run owner-api" });
    mine.release();
    expect(existsSync(lockPathFor(db))).toBe(true);
  });

  it("is released when the process exits without releasing it", () => {
    const db = dbIn();
    const script = `import { acquireSeasonLock } from ${JSON.stringify(join(import.meta.dirname, "../src/seasonLock.ts"))};
      const l = acquireSeasonLock(${JSON.stringify(db)}, "test");
      if ("problem" in l) process.exit(2);
      process.exit(0);`;
    const tsx = join(import.meta.dirname, "../../node_modules/.bin/tsx");
    const r = spawnSync(tsx, ["-e", script], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(existsSync(lockPathFor(db))).toBe(false);
  });
});
