// Evidence for the long-lived ladder, Watch live, auto-play and match
// history (Season 0 game item 1, session 67).
//
//   npm run demo:live-ladder -w server > ../progress/ladder-demo-002-live.txt
//
// A real season database file, the owner API on a real port, and the
// LiveLadder on a fixed clock that the demo moves (so a Sydney day of
// watch-speed matches runs in seconds). The cast: four house owners and two
// player owners with accounts. One player turns auto-play on over the API;
// the other leaves it off, so it never plays. Then:
//   1. Round 1 starts. Watch live (GET /api/live) lists the matches; one is
//      followed through GET /api/live/:id, fetching only what is new each
//      time, minute by minute of clock, until it ends. Nothing about the
//      result is in the history until the last move has been shown.
//   2. The ladder runs on, round after round, until the player's 10th win
//      of the day switches its auto-play off (with the reason).
//   3. A restart mid-match: the process stops while matches are shown; the
//      next one cancels them (no credits, no rating) and carries on.
//   4. Match history over the API: the player's page, one match's log, and
//      its replay rebuilt in the engine and checked against the log.
//   5. The watch lengths of every match shown (the pacing), and checks.
// Seeds and the clock are fixed and ids are replaced by names, so the
// output is the same every run.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatLog, PLAY_STYLES, replayMatch, type DeckFaction, type PlayStyleId } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";
import { replayDeckSpec, type LadderMatch, type ReplayFile } from "../ladder/ladderRunner.js";
import { timelineRecorder, WATCH_PACE_MS, watchLengthMs } from "../ladder/timeline.js";

const tempDir = mkdtempSync(join(tmpdir(), "live-ladder-demo-"));
const dbFile = join(tempDir, "season-0.db");
const matchDir = join(tempDir, "matches");
const PW = "correct horse battery";
const BUILD = { games: 4, trials: 8, confirmGames: 8 };
// 09:00 on Mon 2 Nov in Sydney (AEDT, +11).
const clock = { t: Date.parse("2026-11-01T22:00:00.000Z") };
const say = (line = "") => console.log(line);
const sydney = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const at = (t = clock.t) => sydney.format(new Date(t));
const mins = (ms: number) => `${(ms / 60_000).toFixed(1)} min`;

const CAST: { name: string; login: string | null; kind: "house" | "player"; agent: string; faction: DeckFaction; style: PlayStyleId }[] = [
  { name: "House Cortex", login: null, kind: "house", agent: "Lattice Warden", faction: "Cortex", style: "calculator" },
  { name: "House Swarm", login: null, kind: "house", agent: "Hive Courier", faction: "Swarm", style: "rusher" },
  { name: "House Aegis", login: null, kind: "house", agent: "Chrome Bastion", faction: "Aegis", style: "fortress" },
  { name: "House Null", login: null, kind: "house", agent: "Static Widow", faction: "Null", style: "gambler" },
  { name: "Player One", login: "one", kind: "player", agent: "Night Relay", faction: "Swarm", style: "tempo" },
  { name: "Player Two", login: "two", kind: "player", agent: "Soft Reboot", faction: "Aegis", style: "controller" },
];

let store = EconomyStore.open(dbFile, { now: () => new Date(clock.t) });
const names = new Map<string, string>();
const short = (id: string) => names.get(id) ?? id;
for (const c of CAST) {
  const o = c.login ? store.createAccount({ name: c.name, username: c.login, password: PW, kind: c.kind }) : store.createOwner({ name: c.name, kind: c.kind });
  store.grantStarterCollection(o.ownerId, c.faction);
  const a = store.createAgent({ ownerId: o.ownerId, name: c.agent });
  store.setPlayStyle(o.ownerId, a.agentId, c.style);
  store.connectAgent(o.ownerId, a.agentId);
  names.set(o.ownerId, c.agent);
}
const ownerByAgent = (agent: string) => [...names].find(([, v]) => v === agent)![0];
const one = ownerByAgent("Night Relay");

let matchNo = 0;
let packSeed = 67_100;
const recorded: { m: LadderMatch; startedAt: number; endedAt: number }[] = [];
const autoStops: string[] = [];
let api!: RunningOwnerApi;
let live!: LiveLadder;
function boot(): { closed: string[] } {
  live = new LiveLadder({
    store,
    seed: 6700 + matchNo,
    build: BUILD,
    matchId: () => `s0-live-${String(++matchNo).padStart(3, "0")}`,
    logDir: matchDir,
    housePacks: { packSeed: () => ++packSeed },
    now: () => clock.t,
    roundGapMs: 60_000,
    idleRetryMs: 60_000,
    onRecorded: (m, shown) => recorded.push({ m, ...shown }),
    onEvent: (e) => {
      if (e.kind === "autoPlayStopped") autoStops.push(e.ownerId);
    },
  });
  return { closed: live.recoverOrphans() };
}

const call = async (method: string, path: string, token?: string, body?: unknown) => {
  const res = await fetch(`http://localhost:${api.port}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: res.headers.get("content-type")?.startsWith("application/json") ? JSON.parse(text) : text };
};

/** Moves the clock to `until`, ticking every `stepMs`. */
async function runUntil(until: number, stepMs = 1000): Promise<void> {
  while (clock.t < until) {
    clock.t = Math.min(until, clock.t + stepMs);
    await live.tick();
  }
}

boot();
api = await startOwnerApi({ store, port: 0, live, matchFiles: matchDir });
const tokenOne = (await call("POST", "/api/session", undefined, { login: "one", password: PW })).body.token as string;

say("# The long-lived ladder: watch speed, Watch live, auto-play, match history (session 67)");
say();
say(`Six owners on a real season file; the owner API on a real port; the ladder on a fixed clock the demo moves.`);
say(`Watch speed at 1x: an action waits ${WATCH_PACE_MS.action / 1000} s, a pass ${WATCH_PACE_MS.pass / 1000} s, a new turn ${WATCH_PACE_MS.newTurn / 1000} s more; the result holds ${WATCH_PACE_MS.end / 1000} s.`);
say();
say("## The cast");
say();
for (const c of CAST) say(`${c.agent.padEnd(15)} ${c.name.padEnd(12)} ${c.kind.padEnd(6)} ${c.faction.padEnd(6)} ${PLAY_STYLES[c.style].name}`);
say();
say("## 1. Auto-play and the first round");
say();
const ap = await call("PUT", "/api/play/auto-play", tokenOne, { on: true });
say(`PUT /api/play/auto-play {on: true} as Player One -> ${ap.status}, on=${ap.body.autoPlay.on}`);
const tokenTwo = (await call("POST", "/api/session", undefined, { login: "two", password: PW })).body.token as string;
say(`Player Two leaves it off: GET /api/play -> autoPlay.on=${(await call("GET", "/api/play", tokenTwo)).body.autoPlay.on}`);
say(`queued: ${live.ladder.eligibleOwners().map(short).join(", ")}`);
say();
await live.tick();
const list = (await call("GET", "/api/live", tokenOne)).body as { matches: { matchId: string; p1: { agentName: string; rating: number }; p2: { agentName: string }; released: number; now: { turn: number } }[]; mine: string | null };
say(`${at()} GET /api/live as Player One: ${list.matches.length} live; mine = ${list.mine} (five queued: one sits out, and goes first next round)`);
for (const m of list.matches) say(`  ${m.matchId}  ${m.p1.agentName} vs ${m.p2.agentName}  turn ${m.now.turn}, ${m.released} moves out`);
say();

// Follow the first match minute by minute.
const followed = list.mine ?? list.matches[0]!.matchId;
const length = live.showing().find((s) => s.matchId === followed)!.lengthMs;
const begin = clock.t;
say(`### Watching ${followed} (its moves add up to ${mins(length)} at 1x)`);
say();
let from = 0;
let lines: string[] = [];
let lastMinute = -1;
let recordedEarly = false;
for (;;) {
  clock.t += 5000;
  await live.tick();
  const res = await call("GET", `/api/live/${followed}?from=${from}`, tokenOne);
  if (res.status !== 200) {
    say(`${at()} GET /api/live/${followed} -> ${res.status}: ${res.body.error}`);
    break;
  }
  const feed = res.body as { from: number; released: number; startLines: string[] | null; steps: { lines: string[] }[]; now: { turn: number; p1: { health: number; name: string; board: unknown[] }; p2: { health: number; name: string; board: unknown[] }; winner: string | null } };
  // The opening comes with every fetch from 0; keep it once.
  if (feed.startLines && lines.length === 0) lines.push(...feed.startLines);
  lines.push(...feed.steps.flatMap((s) => s.lines));
  from = feed.released;
  if (store.matchById(followed) !== null) recordedEarly = true;
  const minute = Math.floor((clock.t - begin) / 60_000);
  if (minute !== lastMinute || feed.now.winner) {
    lastMinute = minute;
    const n = feed.now;
    say(
      `${at()} +${String(minute).padStart(2)} min  ${String(feed.released).padStart(3)} moves out, turn ${String(n.turn).padStart(2)}  ${n.p1.name} ${n.p1.health} hp (${n.p1.board.length} on board) vs ${n.p2.name} ${n.p2.health} hp (${n.p2.board.length})${
        n.winner ? `  winner: ${n.winner}` : ""
      }  history has it: ${store.matchById(followed) !== null ? "yes" : "no"}`,
    );
  }
}
const rec = recorded.find((r) => r.m.record.matchId === followed)!;
const logText = readFileSync(rec.m.logPath!, "utf8");
say();
say(`recorded at ${at(rec.endedAt)}, ${mins(rec.endedAt - rec.startedAt)} after it started; the lines fetched add up to the match log exactly: ${`${lines.join("\n")}\n` === logText ? "yes" : "NO"}`);
say(`the last lines released:`);
for (const l of lines.slice(-4)) say(`  ${l}`);
say();

say("## 2. The ladder runs on until Player One's day is maxed");
say();
const dayEnd = Date.parse("2026-11-02T12:59:00.000Z"); // 23:59 Mon in Sydney
while (autoStops.length === 0 && clock.t < dayEnd) await runUntil(clock.t + 60_000, 5000);
const status = (await call("GET", "/api/play", tokenOne)).body.autoPlay;
say(`${at()} Player One's auto-play: on=${status.on}, stopped=${JSON.stringify(status.stopped)}, canTurnOn=${status.canTurnOn}`);
const earnings = store.dailyEarnings(one);
say(`its day: ${earnings.wins.length} wins (${earnings.rewardedWins.length} rewarded), ${earnings.losses} losses, +${earnings.credits} credits; next win pays ${earnings.nextWinPays}`);
const again = await call("PUT", "/api/play/auto-play", tokenOne, { on: true });
say(`PUT /api/play/auto-play {on: true} -> ${again.status}: ${again.body.error}`);
say(`queued now: ${live.ladder.eligibleOwners().map(short).join(", ")}`);
say();
say("matches so far:");
for (const r of recorded) {
  const x = r.m.record;
  const who = x.outcome === "win" ? `${short(x.winnerOwnerId!)} wins` : x.outcome;
  say(`  ${x.matchId} ${at(r.startedAt)}-${at(r.endedAt)} ${short(x.p1OwnerId)} vs ${short(x.p2OwnerId)}: ${who}, T${x.turns}, +${x.p1Credits}/+${x.p2Credits}`);
}
say();

say("## 3. A restart mid-match");
say();
// A minute on, with a match on screen.
while (live.liveMatches().length === 0) await runUntil(clock.t + 5000, 5000);
await runUntil(clock.t + 60_000, 5000);
while (live.liveMatches().length === 0) await runUntil(clock.t + 5000, 5000);
const showing = live.liveMatches().map((m) => `${m.matchId} (${m.released} moves out)`);
say(`${at()} live: ${showing.join(", ")}`);
await live.stop();
await api.close();
store.close();
say(`${at()} the process stops (the ladder, the API and the store closed)`);
clock.t += 5 * 60_000;
store = EconomyStore.open(dbFile, { now: () => new Date(clock.t) });
const { closed } = boot();
api = await startOwnerApi({ store, port: 0, live, matchFiles: matchDir });
say(`${at()} a new process on the same file cancels what was live: ${closed.join(", ")}`);
for (const id of closed) {
  const m = store.matchById(id)!;
  say(`  ${id}: ${m.outcome}, +${m.p1Credits}/+${m.p2Credits}, rated: ${m.ratings !== null}`);
}
await live.tick();
say(`${at()} and starts the next round: ${live.liveMatches().map((m) => `${m.matchId} ${m.p1.agentName} vs ${m.p2.agentName}`).join("; ")}`);
await runUntil(clock.t + 15 * 60_000, 5000);
say();

say("## 4. Match history over the API (as Player One)");
say();
const token = (await call("POST", "/api/session", undefined, { login: "one", password: PW })).body.token as string;
const page = (await call("GET", "/api/matches?limit=5", token)).body as { total: number; more: boolean; matches: { matchId: string; result: string; credits: number; rating: { change: number } | null; opponent: { agentName: string }; turns: number; hasReplay: boolean }[] };
say(`GET /api/matches?limit=5 -> ${page.matches.length} of ${page.total}, more: ${page.more}`);
for (const r of page.matches) say(`  ${r.matchId} vs ${r.opponent.agentName.padEnd(15)} ${r.result.padEnd(5)} +${String(r.credits).padEnd(3)} rating ${r.rating ? `${r.rating.change >= 0 ? "+" : ""}${r.rating.change.toFixed(1)}` : "-"}  T${r.turns}  replay: ${r.hasReplay}`);
const logRes = await call("GET", `/api/matches/${followed}/log`, token);
say(`GET /api/matches/${followed}/log -> ${logRes.status}, ${(logRes.body as string).split("\n").length - 1} lines; the first:`);
say(`  ${(logRes.body as string).split("\n")[0]}`);
const replay = (await call("GET", `/api/matches/${followed}/replay`, token)).body as ReplayFile;
const rebuilt = replayMatch(replayDeckSpec(replay.decks.p1, "p1"), replayDeckSpec(replay.decks.p2, "p2"), replay.names, replay.seed, replay.moves);
say(`GET /api/matches/${followed}/replay -> ${replay.format}, ${replay.moves.length} moves; rebuilt in the engine, its log equals the served log: ${`${formatLog(rebuilt.state.log)}\n` === logRes.body ? "yes" : "NO"}`);
say();

say("## 5. The pacing and the checks");
say();
const shownMatches = recorded.filter((r) => r.endedAt > r.startedAt);
const lengths = shownMatches.map((r) => r.endedAt - r.startedAt).sort((a, b) => a - b);
const q = (p: number) => lengths[Math.min(lengths.length - 1, Math.floor(p * lengths.length))]!;
say(`${shownMatches.length} matches shown at 1x: median ${mins(q(0.5))}, 10th-90th percentile ${mins(q(0.1))}-${mins(q(0.9))}, shortest ${mins(lengths[0]!)}, longest ${mins(lengths.at(-1)!)}`);
const inTarget = lengths.filter((l) => l >= 4 * 60_000 && l <= 7 * 60_000).length;
say(`within 4-7 minutes: ${inTarget} of ${lengths.length}`);
say();
const history = store.matchHistory();
const ok = (label: string, pass: boolean) => say(`${pass ? "PASS" : "FAIL"}  ${label}`);
ok("the followed match was not in the history before its last move was shown", !recordedEarly);
ok(`every match is recorded once (${history.length})`, new Set(history.map((m) => m.matchId)).size === history.length && history.length === recorded.length + closed.length);
ok("each shown match was recorded at its start plus its watch length (to the 5 s tick)", shownMatches.every((r) => Math.abs(r.endedAt - r.startedAt - watchLength(r.m)) < 5000));
ok("Player Two (auto-play off) never played", history.every((m) => short(m.p1OwnerId) !== "Soft Reboot" && short(m.p2OwnerId) !== "Soft Reboot"));
ok("Player One's auto-play went off on its 10th rewarded win, and only then", autoStops.length === 1 && autoStops[0] === one && store.dailyEarnings(one, new Date(dayEnd).toISOString()).rewardedWins.length === 10);
ok("Player One played no match after its auto-play went off (except one already live)", history.filter((m) => (m.p1OwnerId === one || m.p2OwnerId === one) && Date.parse(m.endedAt) > recorded.find((r) => r.m.autoPlayStopped.includes(one))!.endedAt).length === 0);
ok("the restart's cancels paid nothing and weren't rated", closed.length > 0 && closed.every((id) => { const m = store.matchById(id)!; return m.outcome === "cancelled" && m.p1Credits + m.p2Credits === 0 && m.ratings === null; }));
ok("every match with moves has a log and a replay on disk", recorded.filter((r) => r.m.record.turns !== null).every((r) => r.m.logPath !== null && r.m.replayPath !== null));
ok("no owner left in a live match after the last tick but the ones on screen", store.liveMatches().length === live.liveMatches().length);

/** A match's watch length, worked out again from its replay file alone:
 * rebuilt in the engine, cut into its timeline, the holds added up. */
function watchLength(m: LadderMatch): number {
  const r = JSON.parse(readFileSync(m.replayPath!, "utf8")) as ReplayFile;
  const rec = timelineRecorder();
  replayMatch(replayDeckSpec(r.decks.p1, "p1"), replayDeckSpec(r.decks.p2, "p2"), r.names, r.seed, r.moves, rec.hooks);
  return watchLengthMs(rec.timeline);
}

await live.stop();
await api.close();
store.close();
rmSync(tempDir, { recursive: true, force: true });
