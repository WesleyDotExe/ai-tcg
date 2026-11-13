// Evidence for session 94: the server ends the season at its end time
// (schema v29; owner 2026-11-13, answer 2 to game session 93: "the season's
// end is decided by the server, not the player; the end time is set before
// the season starts", and Season 0 ends at midnight Sydney at the end of 26
// December 2026, 00:00 27 Dec AEDT = 13:00 UTC 26 Dec).
//   1. A season file made as the owner makes it (setUpSeason, what `npm run
//      season:setup` runs; the clock on 4 Dec): Season 0's end time is in it.
//      The line the server prints on start says when.
//   2. The last half hour of Season 0 on the long-lived ladder (the setup's
//      four house owners and the owner's agent, auto-play on with no limit),
//      over HTTP: GET /api/season before; at midnight no new round, the
//      matches on screen finish and count, the season ends; GET /api/season
//      after, and the final standings.
//   3. The server down over midnight: a copy of the file at 23:55 with matches
//      on screen, started again at 00:20: the matches left are cancelled
//      (nobody's fault, as after any restart) and the season ends at once.
//   4. The refusals: no match starts once the time has passed; the end time
//      can't be changed once the season has ended; a past time is refused.
//
//   npx tsx src/dev/seasonEndTimeDemo.ts > ../progress/season-end-002.txt
//
// Ids are match numbers and names, so the output is the same every run.

import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";
import type { LadderEvent } from "../ladder/ladderRunner.js";
import { setUpSeason } from "../seasonSetup.js";
import { seasonFileLine, sydney as sydneyDay } from "../seasonFile.js";
import { demoFetch } from "./demoFetch.js";

const say = (line = "") => console.log(line);
const PASSWORD = "a long demo password";
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
const sydney = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const clockText = (ms: number) => sydney.format(new Date(ms));
const apis: RunningOwnerApi[] = [];
const dir = mkdtempSync(join(tmpdir(), "season-end-time-demo-"));
const tidy = (s: string) => s.replaceAll(dir, "<dir>");

try {
  say("Season end demo 002 — the server ends the season at its end time (session 94, schema v29)");
  say("=".repeat(72));
  say("Owner 2026-11-13: the season's end is decided by the server, at a time set before the season starts;");
  say("Season 0 ends at midnight Sydney at the end of 26 Dec 2026 (00:00 27 Dec AEDT, 13:00 UTC 26 Dec).");
  say("Times below are Sydney wall-clock. (The admin's end call, session 82, stays as the fallback for a");
  say("file with no end time: progress/season-end-001.txt.)");

  section("1. The season file, made as the owner makes it (4 Dec)");
  const clock = { t: Date.parse("2026-12-04T09:00:00.000Z") }; // 20:00 Fri 4 Dec
  const path = join(dir, "season-0.db");
  const store = EconomyStore.open(path, { now: () => new Date(clock.t) });
  const made = setUpSeason(store, { name: "The Owner", username: "owner", password: PASSWORD, faction: "Aegis", seed: 94 });
  say(`  setUpSeason (npm run season:setup): the owner, its agent ${made.agentName}, ${made.house.map((h) => h.name).join(", ")}`);
  say(`  end time written: ${made.endsAt} (${made.endsAt ? sydneyDay(made.endsAt) : "-"} Sydney)`);
  say(`  the server's start line: ${tidy(seasonFileLine(store, path))}`);
  check("Season 0's end time is in the file: 13:00 UTC 26 Dec = 00:00 Sun 27 Dec Sydney", made.endsAt === "2026-12-26T13:00:00.000Z" && store.seasonSchedule()?.endsAt === made.endsAt);
  const endMs = Date.parse(made.endsAt!);

  section("2. The last half hour of Season 0, on the live ladder");
  clock.t = Date.parse("2026-12-26T12:33:00.000Z"); // 23:33 Sat 26 Dec
  store.setAutoPlay(made.ownerId, true);
  const name = (id: string) => store.getOwner(id).name;
  const log: string[] = [];
  const shown: { matchId: string; startedAt: number; endedAt: number; outcome: string }[] = [];
  let n = 0;
  const ladder = (s: EconomyStore, tag: string, events: LadderEvent[] = []) =>
    new LiveLadder({
      store: s,
      seed: 94,
      build: { games: 0 },
      matchId: () => `${tag}${++n}`,
      now: () => clock.t,
      housePacks: false,
      roundGapMs: 30_000,
      idleRetryMs: 30_000,
      onRound: (r) => log.push(`round ${r.round}: ${r.pairs.map((p) => `${name(p.p1)} v ${name(p.p2)}`).join(", ")}${r.sitOut.length ? `; ${r.sitOut.map(name).join(", ")} sits out` : ""}`),
      onEvent: (e) => {
        events.push(e);
        if (e.kind === "seasonEndTime") log.push(`[season] the end time has passed: no new round; ${e.live} match(es) on screen finish first`);
        if (e.kind === "seasonEnded") log.push(`[season] season ${e.season} ended at ${clockText(Date.parse(e.endedAt))}: ${e.standings} owners in the final standings`);
      },
      onRecorded: (m, w) => {
        shown.push({ matchId: m.record.matchId, ...w, outcome: m.record.outcome });
        log.push(`${m.record.matchId} recorded (${m.record.outcome}): ${name(m.record.p1OwnerId)} v ${name(m.record.p2OwnerId)}`);
      },
    });
  const events: LadderEvent[] = [];
  const live = ladder(store, "m", events);
  const api = await startOwnerApi({ store, port: 0, live });
  apis.push(api);
  const token = store.signIn("owner", PASSWORD).token;
  const season = async () => (await (await demoFetch(`http://localhost:${api.port}/api/season`, { headers: { Authorization: `Bearer ${token}` } })).json()) as any;
  const before = await season();
  say(`  ${clockText(clock.t)}  GET /api/season: state ${before.state}, endsAt ${before.endsAt}, endedAt ${before.endedAt}`);
  check("GET /api/season says the end time while the season is open", before.state === "open" && before.endsAt === made.endsAt && before.endedAt === null);
  let liveAtEnd = -1;
  let copied = false;
  const copyPath = join(dir, "season-0-at-2355.db");
  let stateAtEnd = "";
  for (let s = 0; s < 60 * 60 && !store.seasonEnded(); s += 5) {
    await live.tick();
    for (const l of log.splice(0)) say(`  ${clockText(clock.t)}  ${l}`);
    if (!copied && clock.t >= Date.parse("2026-12-26T12:55:00.000Z") && store.liveMatches().length > 0) {
      // For section 3: the file as it stands, matches on screen.
      store.unsafeExec("PRAGMA wal_checkpoint(TRUNCATE)");
      copyFileSync(path, copyPath);
      copied = true;
      say(`  ${clockText(clock.t)}  (the file copied for section 3, ${store.liveMatches().length} match(es) on screen)`);
    }
    if (liveAtEnd < 0 && clock.t >= endMs) {
      liveAtEnd = live.liveMatches().length;
      stateAtEnd = (await season()).state;
      say(`  ${clockText(clock.t)}  GET /api/season: state ${stateAtEnd}, ${liveAtEnd} match(es) on screen`);
    }
    clock.t += 5000;
  }
  for (const l of log.splice(0)) say(`  ${clockText(clock.t)}  ${l}`);
  const after = await season();
  say(`  ${clockText(clock.t)}  GET /api/season: state ${after.state}, endsAt ${after.endsAt}, endedAt ${after.endedAt}`);
  say("  The final standings:");
  for (const r of after.standings) say(`    ${String(r.rank ?? "-").padStart(2)}  ${r.ownerName.padEnd(14)} ${String(Math.round(r.rating)).padStart(5)}  ${r.tier.padEnd(9)} ${r.wins}W ${r.losses}L ${r.draws}D`);
  check("matches played up to midnight (none cancelled), each started before the end time", shown.length >= 4 && shown.every((m) => m.startedAt < endMs && m.outcome !== "cancelled"));
  check(`at midnight the season was "ending" with matches on screen (${liveAtEnd}), and no round started after it`, liveAtEnd > 0 && stateAtEnd === "ending");
  check("the matches on screen at midnight finished after it and counted", shown.filter((m) => m.endedAt > endMs).length === liveAtEnd && store.matchHistory({}).length === shown.length);
  check("then the season ended (once), at the last match's recording", events.filter((e) => e.kind === "seasonEnded").length === 1 && Date.parse(after.endedAt) === Math.max(...shown.map((m) => m.endedAt)));
  check("GET /api/season after: ended, the end time and the standings (all five owners)", after.state === "ended" && after.endsAt === made.endsAt && after.standings.length === 5);
  const playedBefore = shown.length;
  for (let s = 0; s < 30 * 60; s += 5) {
    clock.t += 5000;
    await live.tick();
  }
  check("half an hour on, nothing more is paired", shown.length === playedBefore);
  await live.stop();
  await api.close();
  apis.length = 0;

  section("3. The server down over midnight (the file as it was at 23:55, started again at 00:20)");
  clock.t = Date.parse("2026-12-26T13:20:00.000Z"); // 00:20 Sun
  const copy = EconomyStore.open(copyPath, { now: () => new Date(clock.t) });
  const left = copy.liveMatches().length;
  say(`  ${clockText(clock.t)}  ${tidy(seasonFileLine(copy, copyPath))}`);
  say(`  ${clockText(clock.t)}  the file holds ${left} match(es) left on screen by the stopped server`);
  const events2: LadderEvent[] = [];
  const again = ladder(copy, "r", events2);
  const closed = again.recoverOrphans();
  say(`  ${clockText(clock.t)}  [ladder] cancelled ${closed.length} match(es) left live by the last run: ${closed.join(", ")}`);
  await again.tick();
  for (const l of log.splice(0)) say(`  ${clockText(clock.t)}  ${l}`);
  check("the matches left on screen were cancelled, and the season ended on the first tick, with no round", closed.length === left && left > 0 && copy.seasonEnded() && copy.seasonEnd()!.endedAt === "2026-12-26T13:20:00.000Z" && !log.some((l) => l.startsWith("round")));
  check("the server said why", events2.some((e) => e.kind === "seasonEndTime" && e.live === 0));
  await again.stop();
  copy.close();

  section("4. The refusals");
  const tryIt = (label: string, f: () => unknown) => {
    try {
      f();
      say(`  ${label}: allowed`);
      return null;
    } catch (err) {
      say(`  ${label}: refused: ${(err as Error).message}`);
      return (err as Error).message;
    }
  };
  const ids = store.listOwners().map((o) => o.ownerId);
  const m1 = tryIt("a match after the season's end", () => store.startMatch({ matchId: "late", p1OwnerId: ids[1]!, p2OwnerId: ids[2]! }));
  const m2 = tryIt("the end time moved after the season ended", () => store.setSeasonEndTime("2027-01-02T13:00:00Z"));
  const fresh = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const m3 = tryIt("a new file's end time already past (setup on 27 Dec)", () => setUpSeason(fresh, { name: "Late", username: "late", password: PASSWORD, faction: "Swarm" }));
  check("each is refused, with the reason", m1 !== null && m2 !== null && /already passed/.test(m3 ?? "") && fresh.listOwners().length === 0);
  // A match after the end time in a file whose season hasn't been ended yet
  // (its server down over midnight): the store refuses it by itself.
  const t2 = { t: Date.parse("2026-12-20T00:00:00.000Z") };
  const open2 = EconomyStore.open(":memory:", { now: () => new Date(t2.t) });
  setUpSeason(open2, { name: "Owner", username: "owner2", password: PASSWORD, faction: "Null", seed: 1 });
  const hs = open2.listOwners().filter((o) => o.kind === "house").map((o) => o.ownerId);
  t2.t = Date.parse("2026-12-26T13:00:00.000Z");
  const m4 = tryIt("a match at 00:00 in a file not yet ended", () => open2.startMatch({ matchId: "x", p1OwnerId: hs[0]!, p2OwnerId: hs[1]! }));
  check("the store refuses a match from the end time, even before the season is ended", /end time .* has passed: no match starts/.test(m4 ?? "") && !open2.seasonEnded());
  open2.close();
  say();
  const failed = checks.filter(([, ok]) => !ok).length;
  say(`Schema v${store.schemaVersion}. ${checks.length - failed} PASS, ${failed} FAIL`);
  store.close();
  if (failed > 0) process.exitCode = 1;
} finally {
  for (const api of apis) await api.close();
  rmSync(dir, { recursive: true, force: true });
}
