// The Season 0 dry run (session 93, game lane; owner 2026-11-13 plan item 4:
// "start clean-up early. Run the full Season 0 dry run in the session's own
// environment, and write the owner's step-by-step guide for the Mac mini").
// It follows the guide (progress/mac-mini-guide.md) step by step with the
// real commands, as child processes, on the real clock, except that the
// machine's clock is set to 23:30 Sydney first (clockShift.mjs), so the run
// crosses the daily reset:
//   1. A new season file: `npm run season:setup` (the owner's admin login,
//      agent and the four house owners), the password piped in.
//   2. The launch agents: `bash server/launchd/install.sh <file>`, then each
//      plist's command run exactly as launchd runs it (its ProgramArguments,
//      WorkingDirectory, environment and log files), restarted as its
//      KeepAlive says. launchd itself is macOS only; this is as far as the
//      session's Linux machine goes.
//   3. The website through the site host: sign in, who am I, the page.
//   4. Packs: the daily pack claimed, one opened, 1 and 10 bought, ten opened.
//   5. Auto-play with 15 minutes: the ring's states as the server reads them,
//      the agent's live match on Watch live, the time running out.
//   6. Midnight Sydney: today's earnings, the daily pack and the allowance
//      on both sides of it.
//   7. A crash (kill -9): restarted by the KeepAlive rule, the lock taken
//      over, the shown matches cancelled, the website back.
//   8. The season's end and the switch: the admin ends S0 on the website,
//      the agent is unloaded (SIGTERM), `npm run season:next`, install.sh on
//      the new file, the agent loaded again, the owner signs in on S1.
//   9. The logs: every line, their size, and what a season of them weighs.
//
//   npm run dry-run -w server > ../progress/season0-dry-run-001.txt
//
// About 45 minutes. Times print as the server's clock (Sydney); ids as m-1,
// m-2, ...; the temporary directory as <dir>.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EconomyStore } from "@ai-tcg/economy";
import { lockPathFor } from "../seasonLock.js";
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
  say("-".repeat(76));
};
const serverDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
const repo = join(serverDir, "..");
const dir = mkdtempSync(join(tmpdir(), "dry-run-"));
const data = join(dir, "ai-tcg-data");
const db = join(data, "season-0.db");
const db1 = join(data, "season-1.db");
const agentsDir = join(dir, "LaunchAgents");
const PASSWORD = "dry run password, not a real one";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- the machine's clock: 23:30:00 Sydney on the run's day ----
const START_UTC = Date.parse("2026-11-13T12:30:00.000Z"); // 23:30 AEDT (UTC+11)
const OFFSET = START_UTC - Date.now();
const clockNow = () => Date.now() + OFFSET;
const sydney = (t = clockNow()) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(t));
const MIDNIGHT = Date.parse("2026-11-13T13:00:00.000Z");
const clockEnv = {
  ...process.env,
  TZ: "Australia/Sydney",
  NODE_NO_WARNINGS: "1",
  DRY_RUN_CLOCK_OFFSET_MS: String(OFFSET),
  NODE_OPTIONS: `--import=${pathToFileURL(join(serverDir, "src/dev/clockShift.mjs")).href}`,
};

const matchNames = new Map<string, string>();
const matchName = (id: string) => {
  if (!matchNames.has(id)) matchNames.set(id, `m-${matchNames.size + 1}`);
  return matchNames.get(id)!;
};
const tidy = (text: string) =>
  text
    .split(dir)
    .join("<dir>")
    .split(repo)
    .join("<repo>")
    .split(process.execPath)
    .join("<node>")
    .replace(/process \d+/g, "process <pid>")
    .replace(/ on [^ ,]+, since/g, " on <host>, since")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "<time>")
    .replace(/m-[0-9a-f]{8}-[0-9a-f-]{27}/g, (id) => matchName(id))
    .replace(/signature card [^)]+\)/, "signature card <generated>)")
    .replace(/your agent [^(]+\(/, "your agent <generated> (")
    .trimEnd();

// ---- a launch agent, run as launchd runs it ----
interface Plist {
  Label: string;
  ProgramArguments: string[];
  WorkingDirectory: string;
  EnvironmentVariables?: Record<string, string>;
  KeepAlive?: { SuccessfulExit?: boolean };
  ThrottleInterval?: number;
  StandardOutPath: string;
  StandardErrorPath: string;
}
const readPlist = (path: string): Plist => {
  const r = spawnSync("python3", ["-I", "-c", "import json,plistlib,sys; print(json.dumps(plistlib.load(open(sys.argv[1],'rb'))))", path], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`plist ${path} doesn't parse: ${r.stderr}`);
  return JSON.parse(r.stdout) as Plist;
};

interface Job {
  label: string;
  plist: Plist;
  child: ChildProcess | null;
  starts: number;
  loaded: boolean;
  exits: { code: number | null; signal: NodeJS.Signals | null; restarted: boolean }[];
  exited: Promise<void>;
}
/** launchctl bootstrap: start it now (RunAtLoad) and keep it alive as its
 * KeepAlive says: started again after a failure or a kill (after
 * ThrottleInterval from the last start), not after exit 0. */
function bootstrap(plistPath: string): Job {
  const plist = readPlist(plistPath);
  const job: Job = { label: plist.Label, plist, child: null, starts: 0, loaded: true, exits: [], exited: Promise.resolve() };
  const start = () => {
    const [cmd, ...args] = plist.ProgramArguments;
    const out = openSync(plist.StandardOutPath, "a");
    const err = plist.StandardErrorPath === plist.StandardOutPath ? out : openSync(plist.StandardErrorPath, "a");
    const startedAt = Date.now();
    const child = spawn(cmd!, args, { cwd: plist.WorkingDirectory, env: { ...clockEnv, ...plist.EnvironmentVariables }, stdio: ["ignore", out, err] });
    job.child = child;
    job.starts++;
    job.exited = new Promise((done) =>
      child.once("exit", (code, signal) => {
        const failed = code !== 0;
        const restart = job.loaded && failed && plist.KeepAlive?.SuccessfulExit === false;
        job.exits.push({ code, signal, restarted: restart });
        job.child = null;
        if (restart) setTimeout(start, Math.max(0, (plist.ThrottleInterval ?? 10) * 1000 - (Date.now() - startedAt)));
        done();
      }),
    );
  };
  start();
  return job;
}
/** launchctl bootout: SIGTERM, wait, and it stays stopped. */
async function bootout(job: Job): Promise<void> {
  job.loaded = false;
  job.child?.kill("SIGTERM");
  await job.exited;
}

// ---- the log file, read as the owner would ----
const seasonLog = join(data, "season.log");
const siteLog = join(data, "site.log");
const logLines = (path = seasonLog) => (existsSync(path) ? readFileSync(path, "utf8").split("\n").filter((l) => l.length > 0) : []);
async function waitForLine(re: RegExp, ms: number, fromLine = 0, path = seasonLog): Promise<string> {
  const until = Date.now() + ms;
  for (;;) {
    const hit = logLines(path).slice(fromLine).find((l) => re.test(l));
    if (hit !== undefined) return hit;
    if (Date.now() > until) throw new Error(`no log line matching ${re} in ${ms / 1000} s; the log:\n${logLines(path).join("\n")}`);
    await wait(1000);
  }
}
async function waitUntilClock(t: number) {
  while (clockNow() < t) await wait(Math.min(5000, t - clockNow()));
}

// ---- the website, through the site host ----
let site = "";
let token = "";
async function api(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await demoFetch(`${site}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}
async function signIn(): Promise<boolean> {
  token = "";
  const r = await api("POST", "/api/session", { login: "owner", password: PASSWORD });
  if (r.status === 201) token = r.json.token;
  return r.status === 201;
}
const run = (cmd: string, args: string[], input?: string, cwd = repo) => {
  const r = spawnSync(cmd, args, { cwd, env: clockEnv, encoding: "utf8", input });
  return { code: r.status, out: `${r.stdout}${r.stderr}`.trim() };
};

const jobs: Job[] = [];
try {
  say("Season 0 dry run 001 — the owner's Mac mini guide followed step by step (session 93, game lane)");
  say("=".repeat(76));
  say("Owner 2026-11-13, plan item 4: the full Season 0 dry run in the session's own environment, and the guide.");
  say("Every step is the guide's own command, run as a child process on the real clock. The one change: the");
  say(`machine's clock reads 23:30:00 Sydney at the start (clockShift.mjs), so the run crosses midnight.`);
  say("launchd is macOS only: each launch agent's plist is run here exactly as launchd would run it.");

  section(`1. A new season file (guide step 3) — ${sydney()} Sydney`);
  const setupArgs = ["run", "season:setup", "-w", "server", "--", db, "--name", "The Owner", "--login", "owner", "--faction", "Swarm"];
  const setup = run("npm", setupArgs, `${PASSWORD}\n`);
  say(`  $ npm run season:setup -w server -- <dir>/ai-tcg-data/season-0.db --name "The Owner" --login owner --faction Swarm`);
  for (const l of setup.out.split("\n").filter((l) => l.includes("[setup]"))) say(`  ${tidy(l)}`);
  if (setup.code !== 0) say(tidy(setup.out));
  check("setup made the file and its folder (exit 0)", setup.code === 0 && existsSync(db));
  const again = run("npm", setupArgs, `${PASSWORD}\n`);
  check("setup again on the same file is refused (exit 1), the file untouched", again.code !== 0 && again.out.includes("already exists"));
  {
    // The test grant (stated): a first day's wins pay at most 90 credits
    // (+20 for losses), and a pack costs 100, so the owner can't buy one on
    // day one, nor hold ten to open at once for days. To run "packs bought
    // and opened (single and ten)" today, 1,100 credits are written to the
    // owner's ledger as a demoGrant row (as the site contract check does).
    const s = EconomyStore.open(db);
    const owner = s.listOwners().find((o) => o.kind === "player")!;
    s.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${owner.ownerId}', 'credits', 1100, 'demoGrant', '${new Date(clockNow()).toISOString()}')`);
    say(`  (test grant: 1,100 credits written to the owner's ledger as 'demoGrant', for the 1 + 10 pack buys below)`);
    s.close();
  }

  section(`2. The launch agents (guide step 4) — ${sydney()} Sydney`);
  const inst = spawnSync("bash", ["server/launchd/install.sh", db], { cwd: repo, encoding: "utf8", env: { ...process.env, LAUNCH_AGENTS_DIR: agentsDir } });
  say(`  $ bash server/launchd/install.sh <dir>/ai-tcg-data/season-0.db`);
  for (const l of `${inst.stdout}${inst.stderr}`.trim().split("\n")) say(`  ${tidy(l)}`);
  check("install.sh wrote both launch agents", inst.status === 0 && existsSync(join(agentsDir, "local.ai-tcg.season.plist")) && existsSync(join(agentsDir, "local.ai-tcg.site.plist")));
  const seasonPlist = readPlist(join(agentsDir, "local.ai-tcg.season.plist"));
  const sitePlist = readPlist(join(agentsDir, "local.ai-tcg.site.plist"));
  say(`  season agent runs: ${tidy(seasonPlist.ProgramArguments.join(" "))}  (in ${tidy(seasonPlist.WorkingDirectory)})`);
  say(`  site agent runs:   ${tidy(sitePlist.ProgramArguments.join(" "))}  (in ${tidy(sitePlist.WorkingDirectory)})`);
  check("both parse as property lists, with every path filled in (no @...@ left)", ![...seasonPlist.ProgramArguments, ...sitePlist.ProgramArguments, seasonPlist.StandardOutPath, sitePlist.WorkingDirectory].some((s) => s.includes("@")));
  check("the season agent's log is the season file's folder/season.log", seasonPlist.StandardOutPath === seasonLog && seasonPlist.StandardErrorPath === seasonLog);
  const season = bootstrap(join(agentsDir, "local.ai-tcg.season.plist"));
  jobs.push(season);
  const site1 = bootstrap(join(agentsDir, "local.ai-tcg.site.plist"));
  jobs.push(site1);
  const apiUp = await waitForLine(/owner API on/, 120_000);
  const siteUp = await waitForLine(/\[site\] http/, 60_000, 0, siteLog);
  site = "http://127.0.0.1:8080";
  say(`  ${tidy(apiUp)}`);
  say(`  site.log: ${tidy(siteUp)}`);
  check("the season server came up under its launch agent, the ladder running", apiUp.includes("the ladder running"));
  check("its log lines carry the Sydney time (the machine's clock)", /^2026-11-13 23:3\d:\d\d \[/.test(apiUp));

  section(`3. The website (guide step 5) — ${sydney()} Sydney`);
  const page = await demoFetch(`${site}/`);
  const html = await page.text();
  check(`the page at http://127.0.0.1:8080/ answers (${page.status}, ${Math.round(html.length / 1024)} KB of HTML)`, page.status === 200 && html.includes("<html"));
  check("signing in as the owner works through the site", await signIn());
  const me = await api("GET", "/api/me");
  say(`  who am I: ${me.json.name}, isAdmin ${me.json.isAdmin}, login ${me.json.username}`);
  check("the owner is the admin (Settings -> Admin, ending the season)", me.json.isAdmin === true);
  const ladder0 = await api("GET", "/api/ladder");
  check("the ladder lists every owner's row (the house plays from the first start)", ladder0.status === 200);

  section(`4. Packs: the daily pack, open 1, buy 1 and 10, open 10 — ${sydney()} Sydney`);
  const daily0 = await api("GET", "/api/packs/daily");
  say(`  daily pack: ${daily0.json.waiting} waiting on ${daily0.json.day}, the next at ${sydney(Date.parse(daily0.json.resetsAt))} Sydney`);
  check("one daily pack waits on the first day", daily0.json.waiting === 1);
  const claim = await api("POST", "/api/packs/daily/claim");
  check("claimed (201)", claim.status === 201);
  const claimAgain = await api("POST", "/api/packs/daily/claim");
  check(`a second claim the same day is refused (409: ${tidy(String(claimAgain.json.error))})`, claimAgain.status === 409);
  const w0 = (await api("GET", "/api/wallet")).json;
  say(`  wallet: ${w0.credits} credits, ${w0.packPoints} pack points, ${w0.unopenedPacks.length} unopened packs (3 starter + 1 daily)`);
  const open1 = await api("POST", "/api/packs/open", { count: 1 });
  const cards1 = open1.json.packs?.[0]?.cards?.length ?? open1.json.packs?.[0]?.reveals?.length;
  check(`open 1: one pack opened (${cards1} cards), no ten-pack summary`, open1.status === 200 && open1.json.packs.length === 1 && open1.json.summary === null);
  const buy1 = await api("POST", "/api/packs/buy", { setCode: "S0" });
  const buy10 = await api("POST", "/api/packs/buy", { setCode: "S0", count: 10 });
  check("buy 1 and buy 10 (201 each)", buy1.status === 201 && buy1.json.bought.length === 1 && buy10.status === 201 && buy10.json.bought.length === 10);
  const w1 = (await api("GET", "/api/wallet")).json;
  check(`1,100 credits paid for 11 packs (${w0.credits} -> ${w1.credits})`, w0.credits - w1.credits === 1100);
  const open10 = await api("POST", "/api/packs/open", { count: 10 });
  check(`open 10: ten packs opened with the summary (${open10.json.packs?.length} packs)`, open10.status === 200 && open10.json.packs.length === 10 && open10.json.summary !== null);
  const w2 = (await api("GET", "/api/wallet")).json;
  check(`pack points: 5 for each of the 11 opened (${w0.packPoints} -> ${w2.packPoints})`, w2.packPoints - w0.packPoints === 55);
  say(`  wallet now: ${w2.credits} credits, ${w2.packPoints} pack points, ${w2.unopenedPacks.length} unopened packs`);

  section(`5. Auto-play with 15 minutes (the Agent controls ring) — ${sydney()} Sydney`);
  const on = await api("PUT", "/api/play/auto-play", { on: true, minutes: 15 });
  const a0 = on.json.autoPlay.allowance;
  say(`  PUT /api/play/auto-play { on: true, minutes: 15 } at ${sydney()}: ${a0.label}, ${a0.minutesLeft} min left, ends ${sydney(Date.parse(a0.endsAt))}`);
  check("the allowance runs: 15 minutes, ending before midnight", a0.state === "running" && a0.totalMinutes === 15 && a0.endsAtReset === false);
  const endsAt = Date.parse(a0.endsAt);
  const states: string[] = [];
  let lastState = "";
  let watched = false;
  let ownMatches = new Set<string>();
  let liveAtTimeUp: string | null | undefined;
  let finishingSeen = false;
  let doneRead: any = null;
  // Polled as the widget does (every 15 s), until the time is up and the
  // agent's last match has been recorded.
  for (;;) {
    const play = (await api("GET", "/api/play")).json.autoPlay;
    const live = (await api("GET", "/api/live")).json;
    const st = play.allowance ? `${play.allowance.label} (${play.allowance.minutesLeft} min left)` : `off, stopped: ${play.stopped?.reason ?? "-"}`;
    const key = play.allowance?.state ?? `off:${play.stopped?.reason}`;
    if (live.mine) ownMatches.add(live.mine);
    if (key !== lastState) {
      states.push(`${sydney()}  ${st}${live.mine ? `, in ${matchName(live.mine)}` : ", between matches"}`);
      lastState = key;
    }
    if (play.allowance?.state === "finishing") finishingSeen = true;
    if (liveAtTimeUp === undefined && clockNow() >= endsAt) liveAtTimeUp = live.mine;
    if (live.mine && !watched) {
      const f0 = await api("GET", `/api/live/${live.mine}?from=0`);
      await wait(20_000);
      const f1 = await api("GET", `/api/live/${live.mine}?from=${f0.json.released}`);
      say(`  Watch live: ${matchName(live.mine)} ${f0.json.p1.ownerName} vs ${f0.json.p2.ownerName}, ${f0.json.released} moves out, 20 s later ${f1.json.released} (${f1.json.steps.length} new steps), viewers ${f1.json.viewers}`);
      check("the agent's live match is on Watch live and moves keep coming out", f0.status === 200 && f1.status === 200 && f1.json.released > f0.json.released && f1.json.steps.length === f1.json.released - f0.json.released);
      check("the owner reading the feed counts as a viewer", f1.json.viewers >= 1);
      watched = true;
    }
    if (play.allowance?.state === "done" && play.on === false && play.stopped?.reason === "timeUp") {
      doneRead = play;
      break;
    }
    if (clockNow() > endsAt + 12 * 60_000) break;
    await wait(15_000);
  }
  for (const s of states) say(`  ${s}`);
  const stopLine = logLines().find((l) => l.includes("auto-play is off: its play time is up"));
  if (stopLine) say(`  ${tidy(stopLine)}`);
  check("time up: the ring reads \"Time's up\" (state done, 0 left), auto-play off with reason timeUp", doneRead !== null && doneRead.allowance.label === "Time's up" && doneRead.allowance.secondsLeft === 0);
  say(
    liveAtTimeUp
      ? `  at ${sydney(endsAt)} (time up) the agent was in ${matchName(liveAtTimeUp)}: ${finishingSeen ? "\"Finishing match\" shown, then the match finished" : "the label didn't read \"Finishing match\""}`
      : `  at ${sydney(endsAt)} (time up) the agent was between matches, so it stopped at once (no "Finishing match" this run)`,
  );
  if (liveAtTimeUp) check("time ran out mid-match: \"Finishing match\", the match played to the end, then stopped", finishingSeen);
  const hist = (await api("GET", "/api/matches?limit=20")).json;
  say(`  the owner's matches so far: ${hist.matches.map((m: any) => `${matchName(m.matchId)} ${m.result} +${m.credits}`).join(", ")}`);
  check("every match the agent played in the window is in its history", [...ownMatches].every((id) => hist.matches.some((m: any) => m.matchId === id)));

  section("6. Midnight Sydney (the daily reset)");
  const before = { daily: (await api("GET", "/api/daily")).json, pack: (await api("GET", "/api/packs/daily")).json, play: (await api("GET", "/api/play")).json.autoPlay };
  say(`  ${sydney()}  daily: ${before.daily.day}, ${before.daily.wins.length} wins, ${before.daily.losses} losses, ${before.daily.credits} credits; daily pack ${before.pack.waiting} waiting; auto-play ${before.play.on ? "on" : "off"}, stopped ${before.play.stopped?.reason ?? "-"}`);
  await waitUntilClock(MIDNIGHT + 30_000);
  const after = { daily: (await api("GET", "/api/daily")).json, pack: (await api("GET", "/api/packs/daily")).json, play: (await api("GET", "/api/play")).json.autoPlay };
  say(`  ${sydney()}  daily: ${after.daily.day}, ${after.daily.wins.length} wins, ${after.daily.losses} losses, ${after.daily.credits} credits, next win pays ${after.daily.nextWinPays}; daily pack ${after.pack.waiting} waiting; auto-play ${after.play.on ? "on" : "off"}, stopped ${after.play.stopped?.reason ?? "-"}`);
  check("the day turned over at midnight Sydney (13 Nov -> 14 Nov)", before.daily.day === "2026-11-13" && after.daily.day === "2026-11-14");
  check("today's earnings start clean: no wins, the first win pays 30", after.daily.wins.length === 0 && after.daily.nextWinPays === 30);
  check("the allowance's \"Time's up\" belongs to yesterday: the new day reads clean", after.play.allowance === null && after.play.stopped === null);
  // The bell first: a daily pack's notification is written when the bell is
  // read while the pack waits (claiming it first leaves nothing to say).
  const notes = (await api("GET", "/api/notifications?limit=50")).json;
  check("a new daily pack waits, and claims", after.pack.waiting === 1 && (await api("POST", "/api/packs/daily/claim")).status === 201);
  say(`  notifications: ${notes.notifications.length} (${[...new Set(notes.notifications.map((n: any) => n.kind))].join(", ")}), ${notes.unread} unread`);
  check("the bell has the match results, the time-up stop and the daily pack", ["matchResult", "autoPlayStopped", "dailyPack"].every((k) => notes.notifications.some((n: any) => n.kind === k)));
  const roundsAfterMidnight = logLines().filter((l) => /^2026-11-14 00:0\d:\d\d \[ladder\] round/.test(l));
  check("the house ladder plays straight on over midnight", roundsAfterMidnight.length > 0 || (await api("GET", "/api/live")).json.matches.length > 0);

  section(`7. A crash (kill -9) — ${sydney()} Sydney`);
  await waitForLine(/\[ladder\] round \d+ since this start/, 10 * 60_000, logLines().length);
  await wait(10_000);
  const liveBefore = (await api("GET", "/api/live")).json.matches.map((m: any) => m.matchId as string);
  const pid = JSON.parse(readFileSync(lockPathFor(db), "utf8")).pid as number;
  const linesBefore = logLines().length;
  const killedAt = Date.now();
  process.kill(pid, "SIGKILL");
  say(`  kill -9 <pid> at ${sydney()}, ${liveBefore.length} match(es) being shown: ${liveBefore.map(matchName).join(", ")}`);
  const down = await api("GET", "/api/me").catch(() => ({ status: 0, json: null }));
  say(`  just after the kill, the website's API answers ${down.status}${down.status >= 500 ? " (the site host is up; the server isn't)" : ""}`);
  const took = await waitForLine(/\[lock\] took over/, 3 * 60_000, linesBefore);
  const cancelled = await waitForLine(/\[ladder\] cancelled/, 60_000, linesBefore);
  const back = await waitForLine(/owner API on/, 60_000, linesBefore);
  const backAfter = (Date.now() - killedAt) / 1000;
  say(`  ${tidy(took)}`);
  say(`  ${tidy(cancelled)}`);
  say(`  ${tidy(back)}`);
  say(`  back ${backAfter.toFixed(0)} s after the kill (ThrottleInterval counts 60 s from the last start, long past, so launchd starts it again at once)`);
  check("the KeepAlive rule started it again (a kill is not a clean exit)", season.starts === 2 && season.exits[0]?.signal === "SIGKILL" && season.exits[0]?.restarted === true);
  check("the stale lock was taken over and the shown matches cancelled", took.includes("no longer running") && liveBefore.every((id: string) => cancelled.includes(id)));
  check("the owner's sign-in survived the crash (the session is in the file)", (await api("GET", "/api/me")).status === 200);
  check("the website's process rode through it (never restarted)", site1.starts === 1 && site1.child !== null);
  await waitForLine(/\[ladder\] round 1 since this start/, 3 * 60_000, linesBefore);
  check("a new round is paired after the restart", true);

  section(`8. The season's end and the switch to S1 (guide step 8) — ${sydney()} Sydney`);
  const end = await api("POST", "/api/admin/season/end", { season: "S0" });
  say(`  POST /api/admin/season/end { season: "S0" } at ${sydney()}: ${end.status} ${end.json.state}`);
  check("the admin's end is taken (202 ending: the shown matches finish first)", end.status === 202 && end.json.state === "ending");
  const ended = await waitForLine(/\[season\] season S0 ended/, 12 * 60_000, linesBefore);
  say(`  ${tidy(ended)}`);
  const s0 = (await api("GET", "/api/season")).json;
  say(`  final standings: ${s0.standings.map((r: any) => `${r.rank ?? "-"}. ${r.ownerName} ${Math.round(r.rating)}`).join(", ")}`);
  check("S0 ended with its final standings", s0.state === "ended" && s0.standings.length > 0);
  const nextTry = run("npm", ["run", "season:next", "-w", "server", "--", db, db1, "S1"]);
  say(`  season:next while the agent still runs: ${tidy(nextTry.out.split("\n").find((l) => l.includes("[season]")) ?? nextTry.out)}`);
  check("season:next is refused while the server runs on the old file", nextTry.code !== 0 && nextTry.out.includes("is in use by"));
  await bootout(season);
  const stop = season.exits.at(-1)!;
  say(`  launchctl bootout (SIGTERM): exit ${stop.code ?? stop.signal}, ${stop.restarted ? "restarted" : "stays stopped"}; lock ${existsSync(lockPathFor(db)) ? "left" : "removed"}`);
  check("a clean stop: exit 0, not restarted, the lock removed", stop.code === 0 && !stop.restarted && !existsSync(lockPathFor(db)));
  const next = run("npm", ["run", "season:next", "-w", "server", "--", db, db1, "S1"]);
  say(`  $ npm run season:next -w server -- <dir>/ai-tcg-data/season-0.db <dir>/ai-tcg-data/season-1.db S1`);
  for (const l of next.out.split("\n").filter((l) => l.includes("[season]"))) say(`  ${tidy(l)}`);
  check("S1's file made from S0's archive", next.code === 0 && existsSync(db1));
  const inst1 = spawnSync("bash", ["server/launchd/install.sh", db1], { cwd: repo, encoding: "utf8", env: { ...process.env, LAUNCH_AGENTS_DIR: agentsDir } });
  check("install.sh points the season agent at the new file", inst1.status === 0 && readPlist(join(agentsDir, "local.ai-tcg.season.plist")).ProgramArguments.includes(db1));
  const s1Lines = logLines().length;
  const season1 = bootstrap(join(agentsDir, "local.ai-tcg.season.plist"));
  jobs.push(season1);
  const s1Up = await waitForLine(/owner API on/, 120_000, s1Lines);
  say(`  ${tidy(logLines().slice(s1Lines).find((l) => l.includes("[season] season")) ?? "")}`);
  check("the server is back on S1 (the same log file, the same site)", s1Up.includes("season-1.db"));
  check("the owner signs in on S1 with the same password", await signIn());
  const s1 = (await api("GET", "/api/season")).json;
  const w3 = (await api("GET", "/api/wallet")).json;
  say(`  S1: state ${s1.state}, made from ${s1.startedFrom?.fromSeason}; your seed ${s1.yourSeed ? Math.round(s1.yourSeed.rating) : "1500 (unrated in S0)"}; wallet ${w3.credits} credits, ${w3.unopenedPacks.length} unopened packs (the starter grant again)`);
  check("S1 open, made from S0, the starter packs granted again", s1.state === "open" && s1.startedFrom?.fromSeason === "S0" && w3.unopenedPacks.length === 3);
  await waitForLine(/\[ladder\] round 1 since this start/, 3 * 60_000, s1Lines);
  check("the ladder plays on S1", true);
  await bootout(season1);
  await bootout(site1);
  check("both agents unloaded cleanly", season1.exits.at(-1)?.code === 0 && !existsSync(lockPathFor(db1)));

  section("9. The logs: what the owner reads after a problem, and how big they get");
  const lines = logLines();
  for (const l of lines) say(`  | ${tidy(l)}`);
  const firstT = Date.parse(lines[0]!.slice(0, 19).replace(" ", "T") + "+11:00");
  const lastT = Date.parse(lines.at(-1)!.slice(0, 19).replace(" ", "T") + "+11:00");
  const hours = (lastT - firstT) / 3_600_000;
  const bytes = statSync(seasonLog).size;
  const siteBytes = existsSync(siteLog) ? statSync(siteLog).size : 0;
  const stamped = lines.filter((l) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} /.test(l)).length;
  say();
  say(`  season.log: ${lines.length} lines, ${bytes} bytes over ${(hours * 60).toFixed(0)} minutes; site.log: ${logLines(siteLog).length} lines, ${siteBytes} bytes`);
  check("every line in season.log says when", stamped === lines.length);
  const perDay = (bytes / hours) * 24;
  say(`  at this rate: ${(perDay / 1024).toFixed(0)} KB a day, ${((perDay * 7) / 1048576).toFixed(1)} MB a week, ${((perDay * 31) / 1048576).toFixed(1)} MB over a 31-day season`);
  const matchDir = `${db}.matches`;
  const mFiles = readdirSync(matchDir);
  const mBytes = mFiles.reduce((n, f) => n + statSync(join(matchDir, f)).size, 0);
  const recorded = mFiles.filter((f) => f.endsWith(".txt")).length;
  say(`  match files: ${recorded} matches, ${(mBytes / 1024).toFixed(0)} KB (${(mBytes / Math.max(1, recorded) / 1024).toFixed(0)} KB a match); season file ${(statSync(db).size / 1024).toFixed(0)} KB`);
  // Five owners, the house always playing: two matches a round, a round
  // about every 7-10 minutes (a round waits for its longest match).
  const s0Minutes = (Date.parse(ended.slice(0, 19).replace(" ", "T") + "+11:00") - firstT) / 60_000;
  const matchesPerDay = (recorded / s0Minutes) * 60 * 24;
  const filesPerDay = (mBytes / Math.max(1, recorded)) * matchesPerDay;
  say(`  at S0's rate (${recorded} matches in ${s0Minutes.toFixed(0)} minutes): ~${matchesPerDay.toFixed(0)} matches a day, ~${(filesPerDay / 1048576).toFixed(0)} MB of match files a day, ~${((filesPerDay * 31) / 1048576 / 1024).toFixed(1)} GB over a 31-day season`);
  check("the log stays small enough for a season without rotating it (under 50 MB a month)", perDay * 31 < 50 * 1048576);
} catch (err) {
  say();
  say(`STOPPED: ${(err as Error).stack ?? err}`);
  checks.push(["the dry run finished", false]);
} finally {
  for (const j of jobs) {
    j.loaded = false;
    j.child?.kill("SIGTERM");
  }
  await wait(2000);
  const passed = checks.filter(([, ok]) => ok).length;
  say();
  say(`${passed} of ${checks.length} checks PASS${passed === checks.length ? "" : `; FAILED: ${checks.filter(([, ok]) => !ok).map(([w]) => w).join("; ")}`}`);
  rmSync(dir, { recursive: true, force: true });
  process.exit(passed === checks.length ? 0 : 1);
}
