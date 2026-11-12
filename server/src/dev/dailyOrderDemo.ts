// Evidence for the daily-earnings order fix (owner 2026-11-12, game session
// 89): a day's wins are numbered in the order they were recorded, which is
// the order they were paid in, so a win's place in the schedule always
// matches what it was paid.
//
//   npm run demo:daily-order -w server > ../progress/daily-order-001.txt
//
// The bug (render session 66's note): GET /api/daily numbered the wins by
// end time but each was paid by how many of the day's wins were already
// recorded. The two disagree only when a match is recorded with an earlier
// end time than one already recorded. Two ways that happens, both run here
// on a real season file, the owner API on a real port and the real
// LiveLadder on a clock the demo moves:
//   1. The site demo's warm-up: "today's" wins recorded at the real time,
//      then the ladder started on a clock two hours behind.
//   2. Real play: the server's clock steps back mid-day (set by hand, or a
//      large time-sync correction) by more than the gap between two of an
//      owner's matches.
// Each part prints GET /api/daily's wins with the schedule's credits for
// their place, then the numbering the old rule (end time) would have given.
// Seeds and the clock are fixed, so the output is the same every run.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DeckFaction, type PlayStyleId } from "@ai-tcg/engine";
import { EconomyStore, winCredits } from "@ai-tcg/economy";
import { startOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";
import { demoFetch } from "./demoFetch.js";

const PW = "correct horse battery";
const BUILD = { games: 4, trials: 8, confirmGames: 8 };
const say = (line = "") => console.log(line);
const sydney = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const hm = (iso: string | number) => sydney.format(new Date(iso));
let failures = 0;
const ok = (what: string, pass: boolean) => {
  if (!pass) failures++;
  say(`${pass ? "PASS" : "FAIL"}  ${what}`);
};

const CAST: { name: string; login: string | null; kind: "house" | "player"; agent: string; faction: DeckFaction; style: PlayStyleId }[] = [
  { name: "House Cortex", login: null, kind: "house", agent: "Lattice Warden", faction: "Cortex", style: "calculator" },
  { name: "House Swarm", login: null, kind: "house", agent: "Hive Courier", faction: "Swarm", style: "rusher" },
  { name: "House Null", login: null, kind: "house", agent: "Static Widow", faction: "Null", style: "gambler" },
  { name: "Player One", login: "one", kind: "player", agent: "Night Relay", faction: "Swarm", style: "tempo" },
];

interface DailyWin {
  nth: number;
  matchId: string;
  endedAt: string;
  credits: number;
}

async function part(title: string, run: (ctx: { store: EconomyStore; live: () => LiveLadder; restart: () => Promise<string[]>; clock: { t: number }; one: string; rook: string | null; tick: (ms: number) => Promise<void>; winsOfOne: () => number }) => Promise<void>, seed: number, start: string, withRook: boolean) {
  const dir = mkdtempSync(join(tmpdir(), "daily-order-demo-"));
  const clock = { t: Date.parse(start) };
  const store = EconomyStore.open(join(dir, "season-0.db"), { now: () => new Date(clock.t) });
  let one = "";
  for (const c of CAST) {
    const o = c.login ? store.createAccount({ name: c.name, username: c.login, password: PW, kind: c.kind }) : store.createOwner({ name: c.name, kind: c.kind });
    store.grantStarterCollection(o.ownerId, c.faction);
    const a = store.createAgent({ ownerId: o.ownerId, name: c.agent });
    store.setPlayStyle(o.ownerId, a.agentId, c.style);
    store.connectAgent(o.ownerId, a.agentId);
    if (c.login === "one") one = o.ownerId;
  }
  // A second player, never on the ladder: only the opponent of the wins
  // recorded by hand in part 1 (as the site demo's Rook is).
  let rook: string | null = null;
  if (withRook) {
    const r = store.createOwner({ name: "Rook" });
    rook = store.createAgent({ ownerId: r.ownerId, name: "Rook's agent" }).agentId;
  }
  store.setAutoPlay(one, true);
  let n = 0;
  let boots = 0;
  let packSeed = seed * 10;
  const boot = () =>
    new LiveLadder({
      store,
      seed: seed + 10 * boots++,
      build: BUILD,
      matchId: () => `ladder-${String(++n).padStart(3, "0")}`,
      logDir: join(dir, "matches"),
      now: () => clock.t,
      roundGapMs: 60_000,
      idleRetryMs: 60_000,
      housePacks: { packSeed: () => ++packSeed },
    });
  let live = boot();
  // A server restart: the old process stops (Ctrl-C), a new one starts on
  // the same file and cancels whatever was being shown.
  const restart = async () => {
    await live.stop();
    live = boot();
    return live.recoverOrphans();
  };
  const api = await startOwnerApi({ store, port: 0, live, matchFiles: join(dir, "matches") });
  const winsOfOne = () => store.dailyEarnings(one, new Date(clock.t).toISOString()).wins.length;
  const tick = async (ms: number) => {
    const until = clock.t + ms;
    while (clock.t < until) {
      clock.t = Math.min(until, clock.t + 5000);
      await live.tick();
    }
  };
  say(`## ${title}`);
  say();
  try {
    await run({ store, live: () => live, restart, clock, one, rook, tick, winsOfOne });
    // Read the day the way the site does.
    const base = `http://localhost:${api.port}`;
    const login = (await (await demoFetch(`${base}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: "one", password: PW }) })).json()) as { token: string };
    const day = (await (await demoFetch(`${base}/api/daily`, { headers: { Authorization: `Bearer ${login.token}` } })).json()) as { day: string; wins: DailyWin[]; rewardedWins: DailyWin[]; credits: number; creditsFromWins: number; creditsFromLosses: number; losses: number; nextWinPays: number };
    say();
    say(`GET /api/daily as Player One (${day.day}, Sydney), now numbered in recording (= payment) order:`);
    say();
    say("  win  ended  match          paid  schedule for its place");
    for (const w of day.wins) say(`  ${String(w.nth).padStart(3)}  ${hm(w.endedAt)}  ${w.matchId.padEnd(13)}  +${String(w.credits).padEnd(3)}  +${winCredits(w.nth)}${w.credits === winCredits(w.nth) ? "" : "  <- MISMATCH"}`);
    say();
    // What the old rule (by end time) would have numbered them as.
    const byEnd = [...day.wins].sort((a, b) => (a.endedAt < b.endedAt ? -1 : a.endedAt > b.endedAt ? 1 : 0));
    const oldMismatch = byEnd.filter((w, i) => w.credits !== winCredits(i + 1));
    say(`The old rule (numbered by end time) on the same wins: ${byEnd.map((w, i) => `Win ${i + 1} +${w.credits}`).join(", ")}`);
    say(`  wins whose paid credits didn't match their place: ${oldMismatch.length}${oldMismatch.length ? ` (${oldMismatch.map((w) => w.matchId).join(", ")})` : ""}`);
    say();
    const ledger = store.ledger(one).filter((l) => l.reason.startsWith("match")).reduce((t, l) => t + l.delta, 0);
    ok("every win's credits are the schedule's credits for its place", day.wins.every((w) => w.credits === winCredits(w.nth)));
    ok("the places run 1, 2, 3, ... with no gap or repeat", day.wins.every((w, i) => w.nth === i + 1));
    ok("the rewarded wins are the paid ones, in the same order", JSON.stringify(day.rewardedWins) === JSON.stringify(day.wins.filter((w) => w.credits > 0)));
    ok(`the day's credits (+${day.credits}) are what the ledger paid for matches (+${ledger})`, day.credits === ledger);
    ok("this part does put wins out of end-time order (the case being tested)", oldMismatch.length > 0);
    say();
  } finally {
    await api.close();
    await live.stop();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

say("# The day's wins numbered in the order they were paid (game session 89)");
say();
say(`The schedule: Win 1 +${winCredits(1)}, Wins 2-4 +${winCredits(2)}, Wins 5-10 +${winCredits(5)}, after the 10th +${winCredits(11)}.`);
say("A win is paid by how many of the day's wins were already recorded; GET /api/daily now numbers them the same way.");
say();

// Part 1: 10:00 on Thu 12 Nov in Sydney (AEDT, +11) is the "real time";
// the ladder's clock starts two hours behind, as the site demo's does.
await part(
  "1. The site demo's warm-up: wins recorded at the real time, then the ladder on a clock two hours behind",
  async ({ store, clock, one, rook, tick, winsOfOne }) => {
    const real = Date.parse("2026-11-11T23:00:00.000Z");
    const agent = store.listAgents(one)[0]!.agentId;
    for (const [i, ago] of [70, 3].entries()) {
      const endedAt = new Date(real - ago * 60_000).toISOString();
      const m = store.recordMatch({ matchId: `today-${i}`, seed: 100 + i, p1AgentId: agent, p2AgentId: rook!, outcome: { kind: "win", winnerAgentId: agent }, endedAt });
      say(`recorded by hand: ${m.matchId}, ended ${hm(endedAt)}, Player One paid +${m.p1Credits}`);
    }
    clock.t = real - 2 * 3_600_000;
    say(`the ladder starts at ${hm(clock.t)}, before both of those`);
    while (winsOfOne() < 5) await tick(60_000);
    say(`by ${hm(clock.t)} Player One has ${winsOfOne()} wins today`);
  },
  8900,
  "2026-11-11T21:00:00.000Z",
  true,
);

// Part 2: from 09:00 on Thu 12 Nov in Sydney; after Player One's second
// ladder win the clock steps back 90 minutes. (a) The running ladder only
// waits: its next round is due at a time on the old clock, and every match
// is recorded when its last move's hold is over, also on the old clock. So
// one process can't record out of order. (b) A restart while the clock is
// behind: the new process starts its first round at once, on the new time.
await part(
  "2. Real play: the server's clock steps back 90 minutes mid-day",
  async ({ store, clock, live, restart, tick, winsOfOne, one }) => {
    while (winsOfOne() < 2) await tick(60_000);
    while (live().showing().length > 0) await tick(5000);
    const lastEnd = store.dailyEarnings(one, new Date(clock.t).toISOString()).wins.at(-1)!.endedAt;
    let before = clock.t;
    clock.t -= 90 * 60_000;
    say(`(a) after ${winsOfOne()} wins (the last ended ${hm(lastEnd)}) the clock steps back from ${hm(before)} to ${hm(clock.t)}, the server still running`);
    const stepped = clock.t;
    while (live().showing().length === 0 && clock.t < stepped + 3 * 3_600_000) await tick(60_000);
    say(`    the running ladder starts its next round only at ${hm(clock.t)}, when the clock is back past the old time: nothing is recorded out of order`);
    while (live().showing().length > 0) await tick(5000);
    const lastEnd2 = store.dailyEarnings(one, new Date(clock.t).toISOString()).wins.at(-1)!.endedAt;
    before = clock.t;
    clock.t -= 90 * 60_000;
    const closed = await restart();
    say(`(b) after ${winsOfOne()} wins (the last ended ${hm(lastEnd2)}) the clock steps back from ${hm(before)} to ${hm(clock.t)} and the server restarts (${closed.length} live matches cancelled)`);
    say(`    the new process starts its first round at once, on the new time:`);
    while (winsOfOne() < 6) await tick(60_000);
    say(`    by ${hm(clock.t)} Player One has ${winsOfOne()} wins today`);
  },
  8950,
  "2026-11-11T22:00:00.000Z",
  false,
);

say(failures === 0 ? "All checks pass." : `${failures} check(s) FAILED.`);
if (failures > 0) process.exitCode = 1;
