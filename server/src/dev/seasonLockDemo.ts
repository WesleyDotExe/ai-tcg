// Evidence for session 86 (the game lane's hardening pass; owner 2026-11-11,
// answer 4 to session 85): `npm run season:next` refuses to run while a
// server is still running on the old season's file. Every step drives the
// real CLIs as child processes, as season-switch-001 does.
//   1. `npm run season` on an open Season 0 file holds `<file>.lock`.
//   2. A second `npm run season`, and `npm run ladder`, on that file: refused.
//   3. The admin ends the season over HTTP with the server still running;
//      `npm run season:next` from it: refused, no new file, the archive
//      untouched.
//   4. The server stopped (Ctrl-C): the lock is gone; `season:next` makes
//      Season 1.
//   5. A server killed outright (no clean-up) leaves its lock behind; the
//      next start sees its process is gone and takes the lock over, saying so.
//
//   npx tsx src/dev/seasonLockDemo.ts > ../progress/season-lock-001.txt
//
// The temporary directory prints as <dir>, times as <time>, ports as
// <port>, process ids as <pid> and the machine's name as <host>, so the
// output is the same every run.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EconomyStore } from "@ai-tcg/economy";
import { lockPathFor, type LockHolder } from "../seasonLock.js";
import { demoFetch } from "./demoFetch.js";

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
const dir = mkdtempSync(join(tmpdir(), "season-lock-demo-"));
const host = hostname();
const tidy = (text: string) =>
  text
    .split(dir)
    .join("<dir>")
    .split(` on ${host},`)
    .join(" on <host>,")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "<time>")
    .replace(/localhost:\d+/g, "localhost:<port>")
    .replace(/process \d+/g, "process <pid>")
    .trimEnd();
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
const files = () => readdirSync(dir).filter((f) => !f.endsWith("-wal") && !f.endsWith("-shm") && !f.endsWith(".matches")).sort();
const lockOf = (db: string): LockHolder | null => (existsSync(lockPathFor(db)) ? (JSON.parse(readFileSync(lockPathFor(db), "utf8")) as LockHolder) : null);
const PASSWORD = "a long demo password";
const env = { ...process.env, NODE_NO_WARNINGS: "1" };

/** Runs a server CLI to its exit. */
function run(script: string, args: string[]): { code: number | null; out: string } {
  const r = spawnSync(tsx, [script, ...args], { cwd: serverDir, encoding: "utf8", env });
  return { code: r.status, out: tidy(`${r.stdout}${r.stderr}`) };
}

interface Running {
  child: ChildProcess;
  port: number;
  out: string;
  stop: () => Promise<void>;
}
/** Starts `npm run season` and waits for it to listen. */
function startSeason(args: string[]): Promise<Running> {
  const child = spawn(tsx, ["src/seasonCli.ts", ...args], { cwd: serverDir, env });
  let out = "";
  let started = false;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`the server didn't start:\n${out}`)), 60_000);
    const onData = (d: Buffer) => {
      out += d.toString();
      const m = /owner API on http:\/\/localhost:(\d+)/.exec(out);
      if (m && !started) {
        started = true;
        clearTimeout(timer);
        child.removeAllListeners("exit");
        resolve({
          child,
          port: Number(m[1]),
          out: tidy(out.split("\n").filter((l) => l.startsWith("[season]") || l.startsWith("[lock]")).join("\n")),
          stop: () =>
            new Promise((done) => {
              if (child.exitCode !== null || child.signalCode !== null) return done();
              child.once("exit", () => done());
              // Ctrl-C: a terminal sends SIGINT to the server process
              // itself (the one under tsx, which the lock names).
              const pid = lockOf(args[0]!)?.pid;
              if (pid) process.kill(pid, "SIGINT");
              else child.kill("SIGTERM");
            }),
        });
      }
    };
    child.stdout!.on("data", onData);
    child.stderr!.on("data", onData);
    child.once("exit", (code) => reject(new Error(`the server exited (${code}):\n${out}`)));
  });
}

async function signIn(port: number, login: string): Promise<string> {
  const r = await demoFetch(`http://localhost:${port}/api/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login, password: PASSWORD }) });
  return ((await r.json()) as { token: string }).token;
}

const running: Running[] = [];
try {
  say("Season lock demo 001 — season:next refuses while a server runs on the old file (session 86, game lane)");
  say("=".repeat(72));
  say("Owner 2026-11-11 (answer 4 to session 85): a lock file so `npm run season:next` refuses to run while a");
  say("server is still running on the old season's file. Every server CLI holds `<file>.lock` while it runs;");
  say("season:next takes the same lock while it reads the ended file.");

  const s0 = join(dir, "season-0.db");
  {
    const s = EconomyStore.open(s0);
    s.createAccount({ name: "Hub", username: "hub", password: PASSWORD, kind: "house", isAdmin: true });
    s.createAccount({ name: "Ada", username: "ada", password: PASSWORD });
    s.close();
  }
  say();
  say("Made: <dir>/season-0.db, an open Season 0 with the house admin (Hub) and one owner (Ada).");

  section("1. The server on Season 0 holds the lock");
  const srv0 = await startSeason([s0, "0"]);
  running.push(srv0);
  say(`  $ npm run season -- <dir>/season-0.db 0`);
  for (const line of srv0.out.split("\n")) say(`    ${line}`);
  const held0 = lockOf(s0);
  say(`  <dir>/season-0.db.lock: ${tidy(JSON.stringify(held0 && { ...held0, pid: "<pid>", host: "<host>" }))}`);
  check("the lock names the running server's process", held0 !== null && held0.command === "npm run season" && held0.host === host);

  section("2. A second process on the same file is refused");
  const second = run("src/seasonCli.ts", [s0, "0"]);
  say(`  $ npm run season -- <dir>/season-0.db 0`);
  say(`    exit ${second.code}: ${second.out}`);
  check("a second `npm run season` is refused (exit 1), naming the one running", second.code === 1 && second.out.includes("is in use by npm run season"));
  const ladder = run("src/ladderCli.ts", [s0, "1"]);
  say(`  $ npm run ladder -- <dir>/season-0.db 1`);
  say(`    exit ${ladder.code}: ${ladder.out}`);
  check("`npm run ladder` is refused too (two ladders would pair the same owners)", ladder.code === 1 && ladder.out.includes("is in use by"));
  check("the running server's lock is still its own", JSON.stringify(lockOf(s0)) === JSON.stringify(held0));

  section("3. The season ends with the server still running; season:next is refused");
  const hub = await signIn(srv0.port, "hub");
  const ended = await demoFetch(`http://localhost:${srv0.port}/api/admin/season/end`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${hub}` },
    body: JSON.stringify({ season: "S0" }),
  });
  const endBody = (await ended.json()) as { state: string };
  say(`  POST /api/admin/season/end { season: "S0" } (Hub): ${ended.status} ${endBody.state}`);
  check("Season 0 ends (nothing was live)", ended.status === 200 && endBody.state === "ended");
  // The old server still writes to its file after the end: a sign-in is a
  // new session row, which a Season 1 file made now would never see.
  const ada = await signIn(srv0.port, "ada");
  say(`  Ada signs in on the old server after the end: ${ada ? "signed in (a new session row in the archive)" : "refused"}`);
  const before = sha(s0);
  const refused = run("src/nextSeasonCli.ts", [s0, join(dir, "season-1.db"), "S1"]);
  say(`  $ npm run season:next -- <dir>/season-0.db <dir>/season-1.db S1`);
  say(`    exit ${refused.code}: ${refused.out}`);
  check("refused (exit 1): the server is still running on the ended file", refused.code === 1 && refused.out.includes("not made: \"<dir>/season-0.db\" is in use by npm run season"));
  check("no Season 1 file is made", !existsSync(join(dir, "season-1.db")));
  check("the archive is untouched by the refusal", sha(s0) === before);
  check("and the server's lock is still its own", JSON.stringify(lockOf(s0)) === JSON.stringify(held0));

  section("4. The server stopped (Ctrl-C); season:next makes Season 1");
  await srv0.stop();
  running.pop();
  check("the stopped server removed its lock", !existsSync(lockPathFor(s0)));
  const made = run("src/nextSeasonCli.ts", [s0, join(dir, "season-1.db"), "S1"]);
  say(`  $ npm run season:next -- <dir>/season-0.db <dir>/season-1.db S1`);
  for (const line of made.out.split("\n")) say(`    ${line}`);
  check("made (exit 0)", made.code === 0 && existsSync(join(dir, "season-1.db")));
  check("season:next released its lock on the archive when done", !existsSync(lockPathFor(s0)));

  section("5. A server killed outright leaves its lock; the next start takes it over");
  const s1 = join(dir, "season-1.db");
  const srv1 = await startSeason([s1, "0"]);
  running.push(srv1);
  const held1 = lockOf(s1)!;
  say(`  $ npm run season -- <dir>/season-1.db 0`);
  for (const line of srv1.out.split("\n")) say(`    ${line}`);
  // Kill the process that holds the lock (the server itself, under tsx)
  // with no chance to clean up, as a crash or a power cut would.
  const exited = new Promise<void>((done) => srv1.child.once("exit", () => done()));
  process.kill(held1.pid, "SIGKILL");
  await exited;
  running.pop();
  say(`  kill -9 <pid> (the server, no clean-up)`);
  check("its lock is left behind", existsSync(lockPathFor(s1)) && lockOf(s1)?.pid === held1.pid);
  const srv1b = await startSeason([s1, "0"]);
  running.push(srv1b);
  say(`  $ npm run season -- <dir>/season-1.db 0`);
  for (const line of srv1b.out.split("\n")) say(`    ${line}`);
  check(
    "the next start takes the stale lock over and says whose it was",
    srv1b.out.includes("[lock] took over a stale lock left by npm run season (process <pid> on <host>") && srv1b.out.includes("is no longer running"),
  );
  check("the lock is now the new server's", lockOf(s1)!.pid !== held1.pid);
  await srv1b.stop();
  running.pop();
  check("and it removes it on Ctrl-C", !existsSync(lockPathFor(s1)));

  say();
  say(`  Files in <dir> at the end: ${files().join(", ")}`);
  say();
  say("=".repeat(72));
  const failed = checks.filter(([, ok]) => !ok);
  say(`${checks.length - failed.length} PASS, ${failed.length} FAIL`);
  if (failed.length) process.exitCode = 1;
} finally {
  for (const r of running) await r.stop();
  rmSync(dir, { recursive: true, force: true });
}
