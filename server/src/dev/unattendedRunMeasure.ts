// Evidence for session 92 (the game lane's hardening pass for the 7-day
// unattended run on the Mac mini; owner 2026-11-13, item 2): the real
// server (`npm run season`, as a child process, on the real clock) is
// crashed and stopped mid-match, started again, and has to carry on:
//   1. A Season 0 file with four house owners (they always queue), started
//      as an owner would start it.
//   2. Mid-match, the server is killed outright (kill -9: a crash, a power
//      cut). The next start takes over the stale lock, cancels the matches
//      that were being shown (no credits, no rating) and pairs a new round.
//   3. That round's matches are shown to the end and recorded: the ladder
//      carries on after a crash, not just starts.
//   4. Stopped by the system (SIGTERM, as a shutdown or a service manager
//      sends) mid-match: a clean stop, the lock removed, and the next start
//      cancels what was being shown.
//   5. A lock from before the machine last started (a reboot), naming a
//      process id that is alive again: taken over, not honoured.
//   6. What the owner's terminal shows: every line the server printed,
//      with the time it was printed, and the disk the run used.
//
//   npx tsx src/dev/unattendedRunMeasure.ts > ../progress/unattended-run-001.txt
//
// It runs on the real clock (about 15 minutes: a match is shown at watch
// speed), so it is a record, not a reproduced demo. Times print as offsets
// from the start of the run; the temporary directory as <dir>; process ids as
// <pid>.

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { hostname, tmpdir, uptime } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { EconomyStore } from "@ai-tcg/economy";
import type { DeckFaction, PlayStyleId } from "@ai-tcg/engine";
import { lockPathFor, type LockHolder } from "../seasonLock.js";

const say = (line = "") => console.log(line);
const checks: [string, boolean][] = [];
const check = (what: string, ok: boolean) => {
  checks.push([what, ok]);
  say(`  [${ok ? "PASS" : "FAIL"}] ${what}`);
};
const section = (title: string) => {
  say();
  say(title);
  say("-".repeat(72));
};
const serverDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
const tsx = join(serverDir, "../node_modules/.bin/tsx");
const dir = mkdtempSync(join(tmpdir(), "unattended-run-"));
const db = join(dir, "season-0.db");
const matchDir = `${db}.matches`;
const env = { ...process.env, NODE_NO_WARNINGS: "1" };
const t0 = Date.now();
const since = (t = Date.now()) => `+${((t - t0) / 1000).toFixed(0).padStart(4)} s`;
const tidy = (text: string) =>
  text
    .split(dir)
    .join("<dir>")
    .split(` on ${hostname()},`)
    .join(" on <host>,")
    .replace(/process \d+/g, "process <pid>")
    .replace(/localhost:\d+/g, "localhost:<port>")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "<time>")
    .replace(/m-[0-9a-f]{8}-[0-9a-f-]{27}/g, (id) => matchName(id))
    .trimEnd();
/** Match ids are random: each prints as m-1, m-2, ... in the order seen. */
const matchNames = new Map<string, string>();
const matchName = (id: string) => {
  if (!matchNames.has(id)) matchNames.set(id, `m-${matchNames.size + 1}`);
  return matchNames.get(id)!;
};
const lockOf = (): LockHolder | null => (existsSync(lockPathFor(db)) ? (JSON.parse(readFileSync(lockPathFor(db), "utf8")) as LockHolder) : null);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CAST: { name: string; agent: string; faction: DeckFaction; style: PlayStyleId }[] = [
  { name: "House Cortex", agent: "Lattice Warden", faction: "Cortex", style: "calculator" },
  { name: "House Swarm", agent: "Hive Courier", faction: "Swarm", style: "rusher" },
  { name: "House Aegis", agent: "Chrome Bastion", faction: "Aegis", style: "fortress" },
  { name: "House Null", agent: "Static Widow", faction: "Null", style: "gambler" },
];

/** Every line every server run printed, with when (the owner's view). */
const transcript: string[] = [];

interface Running {
  child: ChildProcess;
  run: number;
  lines: string[];
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  /** Resolves with the first printed line matching `re` (from now on, or
   * already printed). */
  waitFor: (re: RegExp, ms: number) => Promise<string>;
}
let runs = 0;
function startSeason(args: string[]): Running {
  const run = ++runs;
  const child = spawn(tsx, ["src/seasonCli.ts", db, "0", ...args], { cwd: serverDir, env });
  const lines: string[] = [];
  const waiters: { re: RegExp; done: (l: string) => void }[] = [];
  let buf = "";
  const onData = (d: Buffer) => {
    buf += d.toString();
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      lines.push(line);
      transcript.push(`${since()}  run ${run} | ${tidy(line)}`);
      for (const w of [...waiters]) {
        if (w.re.test(line)) {
          waiters.splice(waiters.indexOf(w), 1);
          w.done(line);
        }
      }
    }
  };
  child.stdout!.on("data", onData);
  child.stderr!.on("data", onData);
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((done) => child.once("exit", (code, signal) => done({ code, signal })));
  return {
    child,
    run,
    lines,
    exited,
    waitFor: (re, ms) =>
      new Promise((resolve, reject) => {
        const hit = lines.find((l) => re.test(l));
        if (hit !== undefined) return resolve(hit);
        const timer = setTimeout(() => reject(new Error(`run ${run}: no line matching ${re} in ${ms / 1000} s:\n${lines.join("\n")}`)), ms);
        waiters.push({ re, done: (l) => (clearTimeout(timer), resolve(l)) });
      }),
  };
}
/** The server process itself (under tsx), which the lock names. */
const serverPid = () => lockOf()?.pid ?? null;

/** Reads the season file read-only, beside the running server (WAL). */
function rows(sql: string): Record<string, unknown>[] {
  const d = new DatabaseSync(db, { readOnly: true });
  try {
    return d.prepare(sql).all() as Record<string, unknown>[];
  } finally {
    d.close();
  }
}

let current: Running | null = null;
try {
  say("Unattended run 001 — the real server crashed, stopped and started again mid-match (session 92, game lane)");
  say("=".repeat(72));
  say("Owner 2026-11-13 (item 2): a hardening pass aimed at the 7-day unattended run on the Mac mini: the server");
  say("comes back after a restart, takes over its lock and carries on. Every step drives `npm run season` as a");
  say("child process on the real clock; nothing is simulated inside the server.");
  {
    const s = EconomyStore.open(db);
    for (const c of CAST) {
      const o = s.createOwner({ name: c.name, kind: "house" });
      s.grantStarterCollection(o.ownerId, c.faction);
      const a = s.createAgent({ ownerId: o.ownerId, name: c.agent });
      s.setPlayStyle(o.ownerId, a.agentId, c.style);
      s.connectAgent(o.ownerId, a.agentId);
    }
    s.close();
  }
  say();
  say(`Made: <dir>/season-0.db, an open Season 0 with ${CAST.length} house owners (${CAST.map((c) => c.name).join(", ")}).`);

  section("1. The first start");
  current = startSeason([]);
  await current.waitFor(/owner API on/, 120_000);
  const r1 = await current.waitFor(/\[ladder\] round 1[ :]/, 600_000);
  say(`  ${tidy(r1)}`);
  await wait(15_000);
  const live1 = rows("SELECT match_id FROM live_matches ORDER BY match_id").map((r) => String(r.match_id));
  say(`  15 s into round 1: ${live1.length} match(es) being shown`);
  check("round 1 is being shown (two matches live in the store)", live1.length === 2);

  section("2. Killed outright mid-match (kill -9), then started again");
  const pid1 = serverPid()!;
  process.kill(pid1, "SIGKILL");
  await current.exited;
  say(`  kill -9 <pid> at ${since()}`);
  check("the lock is left behind (nothing could clean up)", lockOf()?.pid === pid1);
  check("the two matches are still live in the file", rows("SELECT COUNT(*) AS n FROM live_matches")[0]!.n === 2);
  const restartAt = Date.now();
  current = startSeason([]);
  const took = await current.waitFor(/\[lock\] took over/, 120_000);
  const cancelled = await current.waitFor(/\[ladder\] cancelled/, 120_000);
  await current.waitFor(/owner API on/, 120_000);
  const r2 = await current.waitFor(/\[ladder\] round 1[ :]/, 600_000);
  say(`  ${tidy(took)}`);
  say(`  ${tidy(cancelled)}`);
  say(`  ${tidy(r2)}  (${((Date.now() - restartAt) / 1000).toFixed(0)} s after the restart)`);
  check("the new start takes the stale lock over and says why", took.includes("is no longer running"));
  check("it cancels exactly the two matches that were being shown", live1.every((id) => cancelled.includes(id)) && cancelled.includes("2 match(es)"));
  const after = rows(`SELECT match_id, outcome, p1_credits, p2_credits FROM matches WHERE match_id IN (${live1.map((id) => `'${id}'`).join(",")})`);
  check("recorded as cancelled, no credits", after.length === 2 && after.every((r) => r.outcome === "cancelled" && r.p1_credits === 0 && r.p2_credits === 0));
  check("no rating moved (no rating rows for them)", rows(`SELECT COUNT(*) AS n FROM match_ratings WHERE match_id IN (${live1.map((id) => `'${id}'`).join(",")})`)[0]!.n === 0);
  check("a new round is paired at once (no wait for the old round)", Date.now() - restartAt < 120_000);

  section("3. The ladder carries on: the new round shown to the end and recorded");
  const first = await current.waitFor(/\[ladder\] m-[0-9a-f-]+ .* vs .*: /, 15 * 60_000);
  const second = await current.waitFor(new RegExp(`\\[ladder\\] (?!${first.match(/\] (m-[0-9a-f-]+) /)![1]})m-[0-9a-f-]+ .* vs .*: `), 15 * 60_000);
  say(`  ${tidy(first)}`);
  say(`  ${tidy(second)}`);
  const recorded = rows("SELECT COUNT(*) AS n FROM matches WHERE outcome <> 'cancelled'")[0]!.n as number;
  check("both of the new round's matches were recorded with a result", recorded === 2);
  check("each has its log and replay in the match directory", readdirSync(matchDir).filter((f) => f.endsWith(".txt")).length === 2 && readdirSync(matchDir).filter((f) => f.endsWith(".replay.json")).length === 2);
  const r3 = await current.waitFor(/\[ladder\] round 2[ :]/, 5 * 60_000);
  say(`  ${tidy(r3)}`);
  check("and the next round starts after the gap (round 2 since this start)", /round 2 since this start/.test(r3));

  section("4. Stopped by the system (SIGTERM) mid-match, then started again");
  await wait(10_000);
  const live2 = rows("SELECT match_id FROM live_matches").map((r) => String(r.match_id));
  const pid2 = serverPid()!;
  process.kill(pid2, "SIGTERM");
  const ex = await current.exited;
  say(`  SIGTERM at ${since()}: exit ${ex.code ?? ex.signal}`);
  check("a clean stop: exit 0 and \"[season] stopping\" printed", ex.code === 0 && current.lines.some((l) => l.includes("[season] stopping")));
  check("the lock is removed", lockOf() === null);
  current = startSeason([]);
  const cancelled2 = await current.waitFor(/\[ladder\] cancelled/, 120_000);
  await current.waitFor(/owner API on/, 120_000);
  say(`  ${tidy(cancelled2)}`);
  check("the next start cancels the matches the stop cut off", live2.length === 2 && live2.every((id) => cancelled2.includes(id)));
  check("no lock to take over this time", !current.lines.some((l) => l.includes("[lock]")));
  process.kill(serverPid()!, "SIGINT");
  await current.exited;
  current = null;

  section("5. A lock from before the machine last started (a reboot), its process id alive again");
  // After a reboot the old server's process id can belong to another
  // process. This one (the measuring script) stands in for it: alive, but
  // the lock was taken before the machine started.
  const booted = Date.now() - uptime() * 1000;
  const stale: LockHolder = { pid: process.pid, host: hostname(), command: "npm run season", startedAt: new Date(booted - 3_600_000).toISOString() };
  writeFileSync(lockPathFor(db), `${JSON.stringify(stale)}\n`);
  say(`  wrote <dir>/season-0.db.lock naming a live process, taken an hour before this machine started`);
  current = startSeason([]);
  const took3 = await current.waitFor(/\[lock\] took over/, 120_000);
  await current.waitFor(/owner API on/, 120_000);
  say(`  ${tidy(took3)}`);
  check("taken over: the machine has restarted since it was taken", took3.includes("the machine has restarted since it was taken"));
  process.kill(serverPid()!, "SIGINT");
  await current.exited;
  current = null;

  section("6. What the owner's terminal showed, every line, and the disk used");
  for (const l of transcript) say(`  ${l}`);
  say();
  const size = (p: string) => (existsSync(p) ? statSync(p).size : 0);
  const matchFiles = readdirSync(matchDir);
  const matchBytes = matchFiles.reduce((n, f) => n + size(join(matchDir, f)), 0);
  say(`  season file ${size(db)} bytes, -wal ${size(`${db}-wal`)} bytes; match directory ${matchFiles.length} files, ${matchBytes} bytes`);
  const timed = transcript.filter((l) => /\| \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \[/.test(l)).length;
  const printed = transcript.length;
  say(`  lines printed: ${printed}; lines that carry the time they were printed: ${timed}`);
  check("every line the server printed says when (an owner reading it after a problem needs the time)", timed === printed);
} catch (err) {
  say();
  say(`STOPPED: ${err instanceof Error ? err.message : String(err)}`);
  checks.push(["the run finished", false]);
} finally {
  const pid = serverPid();
  if (current && current.child.exitCode === null && pid) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // gone
    }
  }
  rmSync(dir, { recursive: true, force: true });
}
say();
say("=".repeat(72));
const failed = checks.filter(([, ok]) => !ok);
say(`${checks.length - failed.length} of ${checks.length} checks pass${failed.length ? `; FAILED: ${failed.map(([w]) => w).join("; ")}` : ""}`);
say(`[timing, varies per run] ${((Date.now() - t0) / 60_000).toFixed(1)} minutes`);
process.exit(failed.length ? 1 : 0);
