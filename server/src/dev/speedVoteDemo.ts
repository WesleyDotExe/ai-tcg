// Evidence for session 73: the 2× vote (owner app spec 2026-10-05 D, "Match
// speed: 2× only when both owners agree"), over HTTP on a real port, from
// the long-lived ladder on a fake clock.
//   1. Two player owners: 1× at the start; one ask waits on the other; both
//      asking halves what is left of the hold and every hold after; taking
//      it back returns to 1×. The match is then checked against the same
//      seed played at 1× all through: record, log and replay the same.
//   2. The next match: the vote has reset.
//   3. A player owner against a house owner: one ask is enough; the house
//      account can't ask; a spectator can't vote.
//   4. "Ask for 2× in every match" on for four owners: ten matches at 2×
//      from the first move, against the same ten at 1×: half the watch time,
//      the same matches.
//   5. House against house: always 1×.
//
//   npx tsx src/dev/speedVoteDemo.ts > ../progress/speed-vote-001.txt
//
// Ids are replaced by names, so the output is the same every run.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";
import type { LadderMatch } from "../ladder/ladderRunner.js";
import { stepHoldMs, watchLengthMs, type Timeline } from "../ladder/timeline.js";

const say = (line = "") => console.log(line);
const PASSWORD = "a long demo password";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
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
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const mins = (ms: number) => `${(ms / 60_000).toFixed(2)} min`;
/** Ids renamed by first appearance, so two stores' copies of one match compare. */
const sameIds = (text: string) => {
  const seen = new Map<string, string>();
  return text.replace(UUID, (id) => {
    if (!seen.has(id)) seen.set(id, `id${seen.size}`);
    return seen.get(id)!;
  });
};

type Kind = "player" | "house";
interface Who {
  name: string;
  kind: Kind;
  faction: DeckFaction;
  ask?: boolean;
}

const tmp: string[] = [];
const apis: RunningOwnerApi[] = [];

async function ladder(owners: Who[], seed: number) {
  const clock = { t: Date.parse("2026-11-03T22:00:00.000Z") };
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const ownerIds = new Map<string, string>();
  for (const o of owners) {
    const acct = store.createAccount({ name: o.name, username: o.name.toLowerCase(), password: PASSWORD, kind: o.kind });
    store.grantStarterCollection(acct.ownerId, o.faction);
    const a = store.createAgent({ ownerId: acct.ownerId, name: `${o.name}-agent` });
    store.connectAgent(acct.ownerId, a.agentId);
    if (o.kind === "player") store.setAutoPlay(acct.ownerId, true);
    if (o.ask) store.updateAccountSettings(acct.ownerId, { ask2xEveryMatch: true });
    ownerIds.set(o.name, acct.ownerId);
  }
  // A spectator who owns no agent.
  store.createAccount({ name: "Viewer", username: "viewer", password: PASSWORD, kind: "player" });
  const logDir = mkdtempSync(join(tmpdir(), "speed-vote-demo-"));
  tmp.push(logDir);
  let n = 0;
  const recorded: { m: LadderMatch; startedAt: number; endedAt: number }[] = [];
  const live = new LiveLadder({
    store,
    seed,
    build: { games: 0 },
    matchId: () => `demo-${++n}`,
    now: () => clock.t,
    logDir,
    housePacks: false,
    roundGapMs: 30_000,
    onRecorded: (m, shown) => recorded.push({ m, ...shown }),
  });
  const api = await startOwnerApi({ store, port: 0, live, matchFiles: logDir });
  apis.push(api);
  const tokens = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = async (method: string, path: string, who: string, body?: unknown): Promise<{ status: number; body: any }> => {
    if (!tokens.has(who)) {
      const res = await fetch(`http://localhost:${api.port}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: who.toLowerCase(), password: PASSWORD }) });
      tokens.set(who, ((await res.json()) as { token: string }).token);
    }
    const res = await fetch(`http://localhost:${api.port}${path}`, {
      method,
      headers: { Authorization: `Bearer ${tokens.get(who)}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text === "" ? null : JSON.parse(text) };
  };
  const nameOf = (ownerId: string) => store.getOwner(ownerId).name;
  /** Ticks to the next due release (or record), returning the time. */
  const stepTo = async (matchId: string) => {
    const f = live.liveMatch(matchId);
    if (f === null) return null;
    clock.t = f.nextAt === null ? clock.t + 250 : Date.parse(f.nextAt);
    await live.tick();
    return clock.t;
  };
  const runOut = async (matchId: string) => {
    while (live.liveMatch(matchId) !== null) {
      clock.t += 250;
      await live.tick();
    }
  };
  return { clock, store, live, call, nameOf, ownerIds, recorded, stepTo, runOut };
}

const vote = (s: { rate: number; asks: { p1: boolean; p2: boolean }; house: { p1: boolean; p2: boolean }; waitingOn: string | null }) =>
  `rate ${s.rate}×  asks p1 ${s.asks.p1} p2 ${s.asks.p2}  house p1 ${s.house.p1} p2 ${s.house.p2}  waitingOn ${s.waitingOn ?? "-"}`;
const timelineOf = (feed: { start: Timeline["start"]; steps: Timeline["steps"] }): Timeline => ({ start: feed.start, steps: feed.steps, startLines: [], openingHands: { p1: [], p2: [] } });

try {
  say("Speed vote demo 001 — the 2× vote: both owners must agree (session 73)");
  say("=".repeat(72));
  say("Rule (owner app spec 2026-10-05 D): matches start at 1×; 2× only while both owners agree;");
  say("an owner taps \"Ask for 2×\" (PUT /api/live/:id/speed { ask }) or turns on \"Ask for 2× in every");
  say("match\" (PATCH /api/account/settings { ask2xEveryMatch }); the vote resets every match; speed");
  say("changes only the pace moves are released at. Proposed here: a house side agrees to what its");
  say("player opponent asks; house against house stays 1×.");

  // ---- 1 ----
  section("1. Ada and Bea (both player owners): ask, agree, take it back");
  const pvp = await ladder(
    [
      { name: "Ada", kind: "player", faction: "Cortex" },
      { name: "Bea", kind: "player", faction: "Swarm" },
    ],
    73,
  );
  await pvp.live.tick();
  const m1 = pvp.live.liveMatches()[0]!;
  const seat = (name: string) => (pvp.nameOf(m1.p1.ownerId) === name ? "p1" : "p2");
  say(`  match ${m1.matchId}: p1 ${pvp.nameOf(m1.p1.ownerId)} vs p2 ${pvp.nameOf(m1.p2.ownerId)}`);
  let view = (await pvp.call("GET", `/api/live/${m1.matchId}`, "Viewer")).body;
  say(`  at the start:          ${vote(view.speed)}`);
  check("a match starts at 1× with nobody asking", view.speed.rate === 1 && !view.speed.asks.p1 && !view.speed.asks.p2);
  const firstDue = Date.parse(view.nextAt);
  pvp.clock.t += 2000;
  let r = await pvp.call("PUT", `/api/live/${m1.matchId}/speed`, "Ada", { ask: true });
  say(`  +2.0 s, Ada asks:      ${vote(r.body.speed)}   next move in ${secs(Date.parse(r.body.nextAt) - pvp.clock.t)}`);
  check("one owner asking: still 1×, waiting on the other owner", r.body.speed.rate === 1 && r.body.speed.waitingOn === seat("Bea"));
  check("one ask alone doesn't move the next release", Date.parse(r.body.nextAt) === firstDue);
  const leftAt1 = firstDue - pvp.clock.t;
  r = await pvp.call("PUT", `/api/live/${m1.matchId}/speed`, "Bea", { ask: true });
  say(`  +2.0 s, Bea agrees:    ${vote(r.body.speed)}   next move in ${secs(Date.parse(r.body.nextAt) - pvp.clock.t)} (was ${secs(leftAt1)})`);
  check("both asking: 2×, and what was left of the hold is halved", r.body.speed.rate === 2 && Date.parse(r.body.nextAt) - pvp.clock.t === leftAt1 / 2);
  view = (await pvp.call("GET", `/api/live/${m1.matchId}`, "Viewer")).body;
  check("a spectator's GET shows the same vote and next release", view.speed.rate === 2 && view.nextAt === r.body.nextAt);

  // Twenty moves at 2×: each hold against the timeline's 1× hold.
  say();
  say("  the next 20 moves at 2× (hold = the wait before the move came out):");
  let prev = await pvp.stepTo(m1.matchId);
  let allHalf = true;
  for (let i = 0; i < 20; i++) {
    const at = await pvp.stepTo(m1.matchId);
    const f = pvp.live.liveMatch(m1.matchId, 0)!;
    const s = f.steps[f.released - 1]!;
    const oneX = stepHoldMs(timelineOf({ start: f.start!, steps: f.steps }), f.released - 1);
    const hold = at! - prev!;
    if (hold * 2 !== oneX) allHalf = false;
    const what = s.move.type === "passPriority" ? "pass" : s.move.type;
    say(`    move ${String(f.released).padStart(3)} ${s.by} ${what.padEnd(16)} turn ${String(s.after.turn).padStart(2)}  hold ${secs(hold).padStart(6)}  (1×: ${secs(oneX)})`);
    prev = at;
  }
  check("every one of the 20 holds is exactly half its 1× hold", allHalf);

  const due = Date.parse(pvp.live.liveMatch(m1.matchId)!.nextAt!);
  pvp.clock.t = due - 1000;
  r = await pvp.call("PUT", `/api/live/${m1.matchId}/speed`, "Ada", { ask: false });
  say();
  say(`  1.0 s before a release, Ada takes it back: ${vote(r.body.speed)}   next move in ${secs(Date.parse(r.body.nextAt) - pvp.clock.t)}`);
  check("taking it back: 1× again, waiting on Ada, what is left doubled", r.body.speed.rate === 1 && r.body.speed.waitingOn === seat("Ada") && Date.parse(r.body.nextAt) - pvp.clock.t === 2000);
  r = await pvp.call("PUT", `/api/live/${m1.matchId}/speed`, "Ada", { ask: true });
  say(`  Ada asks again:        ${vote(r.body.speed)}`);
  const bad = await pvp.call("PUT", `/api/live/${m1.matchId}/speed`, "Ada", { ask: "yes" });
  say(`  PUT { ask: "yes" } -> ${bad.status} ${bad.body.error}`);
  check("a bad body is 400", bad.status === 400);
  const spect = await pvp.call("PUT", `/api/live/${m1.matchId}/speed`, "Viewer", { ask: true });
  say(`  the spectator asks -> ${spect.status} ${spect.body.error}`);
  check("an owner whose agent isn't in the match can't vote (403)", spect.status === 403);
  await pvp.runOut(m1.matchId);
  const shown1 = pvp.recorded[0]!;
  const ended = await pvp.call("PUT", `/api/live/${m1.matchId}/speed`, "Ada", { ask: false });
  say(`  after it is recorded, Ada's PUT -> ${ended.status} ${ended.body.error}`);
  check("an ended match answers 404 pointing at its record", ended.status === 404 && /has ended/.test(ended.body.error));

  // The same seed at 1× all through.
  const slow = await ladder(
    [
      { name: "Ada", kind: "player", faction: "Cortex" },
      { name: "Bea", kind: "player", faction: "Swarm" },
    ],
    73,
  );
  await slow.live.tick();
  let sf = slow.live.liveMatch(m1.matchId, 0)!;
  while (slow.live.liveMatch(m1.matchId) !== null) {
    sf = slow.live.liveMatch(m1.matchId, 0)!;
    await slow.stepTo(m1.matchId);
  }
  const shownSlow = slow.recorded[0]!;
  const oneXLength = watchLengthMs(timelineOf({ start: sf.start!, steps: sf.steps }));
  say();
  say(`  shown in ${mins(shown1.endedAt - shown1.startedAt)} with the vote; the same match at 1× all through: ${mins(shownSlow.endedAt - shownSlow.startedAt)} (timeline at 1×: ${mins(oneXLength)})`);
  const rec = (x: LadderMatch) => {
    const { endedAt: _e, ...rest } = x.record as typeof x.record & { endedAt: string };
    return sameIds(JSON.stringify(rest));
  };
  say(`  record: ${shown1.m.record.outcome}, ${shown1.m.record.turns} turns, ${shown1.m.record.moves} moves, credits ${shown1.m.record.p1Credits}/${shown1.m.record.p2Credits}`);
  check("the record is the 1× match's (outcome, moves, credits, ratings, boast)", rec(shown1.m) === rec(shownSlow.m));
  check("the match log is the 1× match's, line for line", sameIds(readFileSync(shown1.m.logPath!, "utf8")) === sameIds(readFileSync(shownSlow.m.logPath!, "utf8")));
  check("the replay file is the 1× match's, byte for byte (ids aside)", sameIds(readFileSync(shown1.m.replayPath!, "utf8")) === sameIds(readFileSync(shownSlow.m.replayPath!, "utf8")));

  // ---- 2 ----
  section("2. The next match: the vote resets");
  pvp.clock.t += 31_000;
  await pvp.live.tick();
  const m2 = pvp.live.liveMatches()[0]!;
  say(`  match ${m2.matchId}: ${vote(m2.speed)}`);
  check("the next match starts at 1× with nobody asking", m2.matchId !== m1.matchId && m2.speed.rate === 1 && !m2.speed.asks.p1 && !m2.speed.asks.p2);
  await pvp.live.stop();
  await slow.live.stop();

  // ---- 3 ----
  section("3. Ada against the house: one ask is enough; the house can't ask");
  const pvh = await ladder(
    [
      { name: "Ada", kind: "player", faction: "Cortex" },
      { name: "Hal", kind: "house", faction: "Null" },
    ],
    74,
  );
  await pvh.live.tick();
  const m3 = pvh.live.liveMatches()[0]!;
  say(`  match ${m3.matchId}: p1 ${pvh.nameOf(m3.p1.ownerId)} vs p2 ${pvh.nameOf(m3.p2.ownerId)}; ${vote(m3.speed)}`);
  const hal = await pvh.call("PUT", `/api/live/${m3.matchId}/speed`, "Hal", { ask: true });
  say(`  Hal (the house account) asks -> ${hal.status} ${hal.body.error}`);
  check("a house account's ask is refused (409)", hal.status === 409);
  r = await pvh.call("PUT", `/api/live/${m3.matchId}/speed`, "Ada", { ask: true });
  say(`  Ada asks:              ${vote(r.body.speed)}`);
  check("against a house side, one player ask makes it 2×", r.body.speed.rate === 2 && r.body.speed.waitingOn === null);
  await pvh.live.stop();

  // ---- 4 ----
  section("4. \"Ask for 2× in every match\" on for four owners: ten matches at 2× against the same ten at 1×");
  const four = (ask: boolean): Who[] => [
    { name: "Ada", kind: "player", faction: "Cortex", ask },
    { name: "Bea", kind: "player", faction: "Swarm", ask },
    { name: "Cyd", kind: "player", faction: "Aegis", ask },
    { name: "Dot", kind: "player", faction: "Null", ask },
  ];
  const fast4 = await ladder(four(true), 75);
  const slow4 = await ladder(four(false), 75);
  const set = await fast4.call("GET", "/api/account/settings", "Ada");
  say(`  GET /api/account/settings (Ada): ask2xEveryMatch ${set.body.ask2xEveryMatch}`);
  const rates: number[] = [];
  for (const l of [fast4, slow4]) {
    while (l.recorded.length < 10) {
      l.clock.t += 1000;
      await l.live.tick();
      if (l === fast4) for (const m of l.live.liveMatches()) if (m.released === 0) rates.push(m.speed.rate);
    }
  }
  check("every match of the four 'every match' owners started at 2×", rates.length >= 10 && rates.every((x) => x === 2));
  say();
  say("  match      result               turns moves  shown at 2×   at 1×      ratio");
  const ratios: number[] = [];
  let sameAll = true;
  for (let i = 0; i < 10; i++) {
    const f = fast4.recorded[i]!;
    const s = slow4.recorded[i]!;
    const a = f.endedAt - f.startedAt;
    const b = s.endedAt - s.startedAt;
    ratios.push(a / b);
    if (rec(f.m) !== rec(s.m) || sameIds(readFileSync(f.m.logPath!, "utf8")) !== sameIds(readFileSync(s.m.logPath!, "utf8"))) sameAll = false;
    const result = f.m.record.outcome === "win" ? `win ${fast4.nameOf(f.m.record.winnerOwnerId!)}` : f.m.record.outcome;
    say(`  ${f.m.record.matchId.padEnd(10)} ${result.padEnd(20)} ${String(f.m.record.turns).padStart(5)} ${String(f.m.record.moves).padStart(5)}  ${mins(a).padStart(10)}  ${mins(b).padStart(10)}  ${(a / b).toFixed(3)}`);
  }
  const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)]!;
  const fastLen = fast4.recorded.slice(0, 10).map((x) => x.endedAt - x.startedAt);
  const slowLen = slow4.recorded.slice(0, 10).map((x) => x.endedAt - x.startedAt);
  say(`  median shown: ${mins(median(fastLen))} at 2×, ${mins(median(slowLen))} at 1×`);
  check("all ten matches: the same record and log at 2× as at 1×", sameAll);
  check("each shown in half the time, to within one 1 s tick", ratios.every((x, i) => Math.abs(fastLen[i]! - slowLen[i]! / 2) <= 1000));
  await fast4.live.stop();
  await slow4.live.stop();

  // ---- 5 ----
  section("5. House against house: always 1×");
  const hvh = await ladder(
    [
      { name: "Hal", kind: "house", faction: "Null", ask: false },
      { name: "Hux", kind: "house", faction: "Aegis", ask: false },
    ],
    76,
  );
  // The house accounts' own setting is ignored (no person watches a house side).
  hvh.store.updateAccountSettings(hvh.ownerIds.get("Hal")!, { ask2xEveryMatch: true });
  await hvh.live.tick();
  const m5 = hvh.live.liveMatches()[0]!;
  say(`  match ${m5.matchId}: ${vote(m5.speed)}`);
  const hux = await hvh.call("PUT", `/api/live/${m5.matchId}/speed`, "Hux", { ask: true });
  say(`  Hux asks -> ${hux.status} ${hux.body.error}`);
  check("house against house: 1×, with the house setting ignored, and no ask taken", m5.speed.rate === 1 && !m5.speed.asks.p1 && !m5.speed.asks.p2 && hux.status === 409);
  await hvh.live.stop();

  say();
  say("=".repeat(72));
  const passed = checks.filter(([, ok]) => ok).length;
  say(`${passed} PASS, ${checks.length - passed} FAIL`);
  if (passed !== checks.length) process.exitCode = 1;
} finally {
  for (const a of apis) await a.close();
  for (const d of tmp) rmSync(d, { recursive: true, force: true });
}
