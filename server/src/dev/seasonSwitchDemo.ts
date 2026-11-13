// Evidence for session 85: the season switch made safe (game lane, the
// quality-debt list; the switch stays by hand, as the owner set: stop the
// server, `npm run season:next`, start it again on the new file).
//   1. The two easy mistakes at start, through the real `npm run season`
//      CLI: a mistyped file name (it used to create an empty Season 0 file
//      and run the ladder on it), and the ended season's file after the
//      switch. Both refused before the file is opened; nothing is created.
//   2. `npm run season:next` from a mistyped ended file: refused, nothing
//      created (it used to create the typo as an empty file).
//   3. `npm run season:next` from the archive: the archive is byte for byte
//      the same afterwards, and so is an archive at an older schema (it used
//      to be migrated in place); the new file is made from a migrated copy.
//   4. The server on the new file starts and says which season it is on;
//      GET /api/season over HTTP.
//   5. The archive served on purpose (--archive) and a first start (--new).
//
//   npx tsx src/dev/seasonSwitchDemo.ts > ../progress/season-switch-001.txt
//
// The temporary directory prints as <dir>, times as <time> and ports as
// <port>, so the output is the same every run.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { EconomyStore } from "@ai-tcg/economy";
import { STAMP_RE } from "../logTime.js";
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
const dir = mkdtempSync(join(tmpdir(), "season-switch-demo-"));
const tidy = (text: string) =>
  text
    .replace(STAMP_RE, "") // (session 92) the server's time on every line
    .split(dir)
    .join("<dir>")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "<time>")
    .replace(/localhost:\d+/g, "localhost:<port>")
    .trimEnd();
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
const schemaOf = (path: string) => {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
  } finally {
    db.close();
  }
};
const files = () => readdirSync(dir).filter((f) => !f.endsWith("-wal") && !f.endsWith("-shm") && !f.endsWith(".matches")).sort();
const PASSWORD = "a long demo password";
const LATEST = EconomyStore.open(":memory:").schemaVersion;

/** Runs a server CLI to its exit (a refusal). */
function run(script: string, args: string[]): { code: number | null; out: string } {
  const r = spawnSync(tsx, [script, ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, NODE_NO_WARNINGS: "1" } });
  return { code: r.status, out: tidy(`${r.stdout}${r.stderr}`) };
}

/** Starts `npm run season` and waits for it to listen; returns its port, what
 * it printed up to then, and a stop. */
function startSeason(args: string[]): Promise<{ port: number; out: string; stop: () => Promise<void> }> {
  const child = spawn(tsx, ["src/seasonCli.ts", ...args], { cwd: serverDir, env: { ...process.env, NODE_NO_WARNINGS: "1" } });
  let out = "";
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`the server didn't start:\n${out}`)), 60_000);
    const onData = (d: Buffer) => {
      out += d.toString();
      const m = /owner API on http:\/\/localhost:(\d+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        resolve({
          port: Number(m[1]),
          out: tidy(tidy(out).split("\n").filter((l) => l.startsWith("[season]")).join("\n")),
          stop: () =>
            new Promise((done) => {
              child.once("exit", () => done());
              child.kill("SIGTERM");
            }),
        });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => reject(new Error(`the server exited (${code}):\n${out}`)));
  });
}

async function signedInSeason(port: number, login: string) {
  const base = `http://localhost:${port}`;
  const s = await demoFetch(`${base}/api/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login, password: PASSWORD }) });
  const token = ((await s.json()) as { token: string }).token;
  const r = await demoFetch(`${base}/api/season`, { headers: { authorization: `Bearer ${token}` } });
  return (await r.json()) as { season: string; state: string; endedAt: string | null; startedFrom: { fromSeason: string } | null };
}

/** An ended Season 0 file with one owner, at `migrateTo` (default: this code's schema). */
function endedSeason(name: string, migrateTo?: number): string {
  const path = join(dir, name);
  const s = EconomyStore.open(path, { migrateTo });
  s.createAccount({ name: "Ada", username: "ada", password: PASSWORD });
  s.endSeason();
  s.close();
  return path;
}

try {
  say("Season switch demo 001 — the season switch made safe (session 85, game lane)");
  say("=".repeat(72));
  say("The switch stays by hand (owner 2026-11-10): stop the server, make the next season's file with");
  say("`npm run season:next`, start the server again on it. This checks the two easy mistakes and that the");
  say("archive is never written.");

  const s0 = endedSeason("season-0.db");
  const s0Hash = sha(s0);
  say();
  say(`Made: <dir>/season-0.db, Season 0 with one owner, ended (schema v${schemaOf(s0)}).`);

  section("1. Starting the server on the wrong file (npm run season)");
  const typo = run("src/seasonCli.ts", [join(dir, "season-1,db")]);
  say(`  $ npm run season -- <dir>/season-1,db`);
  say(`    exit ${typo.code}: ${typo.out}`);
  check("a mistyped file name is refused (exit 1)", typo.code === 1 && typo.out.includes("pass --new"));
  check("and no file is created for it", !existsSync(join(dir, "season-1,db")));
  const onArchive = run("src/seasonCli.ts", [s0]);
  say(`  $ npm run season -- <dir>/season-0.db`);
  say(`    exit ${onArchive.code}: ${onArchive.out}`);
  check("the ended season's file is refused (exit 1), naming the next-season command", onArchive.code === 1 && onArchive.out.includes("npm run season:next"));
  const badFlag = run("src/seasonCli.ts", [s0, "--archve"]);
  say(`  $ npm run season -- <dir>/season-0.db --archve`);
  say(`    exit ${badFlag.code}: ${badFlag.out.split("\n")[0]}`);
  check("a mistyped option is refused, not read as a path", badFlag.code === 1);
  check("the archive is untouched by all three", sha(s0) === s0Hash);

  section("2. Making the next season from a mistyped file (npm run season:next)");
  const nextTypo = run("src/nextSeasonCli.ts", [join(dir, "season-O.db"), join(dir, "season-1.db"), "S1"]);
  say(`  $ npm run season:next -- <dir>/season-O.db <dir>/season-1.db S1`);
  say(`    exit ${nextTypo.code}: ${nextTypo.out}`);
  check("refused (exit 1)", nextTypo.code === 1);
  check("neither the typo nor the new file is created", !existsSync(join(dir, "season-O.db")) && !existsSync(join(dir, "season-1.db")));

  section("3. Making the next season: the archive is only read");
  const made = run("src/nextSeasonCli.ts", [s0, join(dir, "season-1.db"), "S1"]);
  say(`  $ npm run season:next -- <dir>/season-0.db <dir>/season-1.db S1`);
  for (const line of made.out.split("\n")) say(`    ${line}`);
  check("made (exit 0)", made.code === 0 && existsSync(join(dir, "season-1.db")));
  say(`  season-0.db sha256 before ${s0Hash}, after ${sha(s0)} [timing, varies per run] (the file holds random ids and times)`);
  check("the archive is byte for byte the file it was", sha(s0) === s0Hash);
  const old = endedSeason("season-0-older.db", LATEST - 1);
  const oldHash = sha(old);
  say();
  say(`  An archive at an older schema: <dir>/season-0-older.db, schema v${schemaOf(old)} (this code: v${LATEST}).`);
  const madeOld = run("src/nextSeasonCli.ts", [old, join(dir, "season-1-older.db"), "S1"]);
  say(`  $ npm run season:next -- <dir>/season-0-older.db <dir>/season-1-older.db S1`);
  say(`    exit ${madeOld.code}: ${madeOld.out.split("\n")[0]}`);
  check("made (exit 0), at this code's schema", madeOld.code === 0 && schemaOf(join(dir, "season-1-older.db")) === LATEST);
  say(`  season-0-older.db: schema v${schemaOf(old)}, sha256 before ${oldHash}, after ${sha(old)} [timing, varies per run] (the file holds random ids and times)`);
  check(`the older archive stays v${LATEST - 1}, byte for byte (it used to be migrated in place)`, sha(old) === oldHash && schemaOf(old) === LATEST - 1);
  check("no temporary copy is left behind", !readdirSync(tmpdir()).some((f) => f.startsWith("ai-tcg-archive-")));

  section("4. The server on the new file");
  {
    const srv = await startSeason([join(dir, "season-1.db"), "0"]);
    for (const line of srv.out.split("\n")) say(`  ${line}`);
    const season = await signedInSeason(srv.port, "ada");
    say(`  GET /api/season (Ada, signed in with her Season 0 password): season ${season.season}, ${season.state}, made from ${season.startedFrom?.fromSeason}`);
    check("it starts on Season 1 and says it was made from Season 0", srv.out.includes("season S1 (made from S0's archive)") && season.season === "S1" && season.state === "open");
    await srv.stop();
  }

  section("5. On purpose: serving the archive (--archive), and a first start (--new)");
  {
    const srv = await startSeason([s0, "0", "--archive"]);
    for (const line of srv.out.split("\n")) say(`  ${line}`);
    const season = await signedInSeason(srv.port, "ada");
    say(`  GET /api/season: season ${season.season}, ${season.state}`);
    check("--archive serves the ended file and says no match will be paired", srv.out.includes("no match will be paired") && season.state === "ended");
    await srv.stop();
  }
  {
    const srv = await startSeason([join(dir, "season-0-fresh.db"), "0", "--new"]);
    for (const line of srv.out.split("\n")) say(`  ${line}`);
    check("--new creates and starts a new Season 0 file", existsSync(join(dir, "season-0-fresh.db")) && srv.out.includes("season S0 on"));
    await srv.stop();
  }
  const again = run("src/seasonCli.ts", [join(dir, "season-0-fresh.db"), "--new"]);
  say(`  $ npm run season -- <dir>/season-0-fresh.db --new`);
  say(`    exit ${again.code}: ${again.out}`);
  check("--new on a file that exists is refused", again.code === 1);
  say();
  say(`  Files in <dir> at the end: ${files().join(", ")}`);

  say();
  say("=".repeat(72));
  const failed = checks.filter(([, ok]) => !ok);
  say(`${checks.length - failed.length} PASS, ${failed.length} FAIL`);
  if (failed.length) process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
