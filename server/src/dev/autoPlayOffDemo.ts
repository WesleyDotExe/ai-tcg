// Game session 104 (game lane, hardening and fixes only): an owner switching
// auto-play off by hand, as `npm run season` prints it. Sessions 102 and 103
// named it: the ladder printed the server's own stops (the day's rewards
// maxed, the play time up) but an owner turning the switch off on the
// website left nothing in the season log, so a log read later couldn't say
// why a player owner stopped being paired.
//
// The real owner API on a real port, the long-lived ladder (LiveLadder) at
// watch speed on a fake clock, and the season server's own lines
// (LadderLog, wired as seasonCli.ts wires it):
//   1. Two house owners and two player owners on auto-play with no limit.
//   2. Ada switches it off (PUT /api/play/auto-play { on: false }) while her
//      agent is in a match on screen: the match finishes and counts, and the
//      next round's start says she switched it off, once.
//   3. Ada switches it back on: paired again, nothing said. Then off and on
//      again between two rounds: nothing said (she never left the queue).
//   4. Ada off once more: said again, once. Bram, on all along, never.
//
//   npx tsx src/dev/autoPlayOffDemo.ts > ../progress/auto-play-off-001.txt
//
// Ids are match numbers and owner names, the clock is fixed, so the output
// is the same every run (in the demo set, progress/demos.json).

// The season log's times are the machine's local clock (logTime.ts); this
// demo's machine is the owner's, in Sydney, so the output is the same
// wherever it runs. Set before any date is made.
process.env.TZ = "Australia/Sydney";

import { type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";
import { LadderLog } from "../ladder/ladderLog.js";
import { localStamp } from "../logTime.js";
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

try {
  say("Auto-play off by hand, in the season log (game session 104)");
  say("=".repeat(72));
  say("The season server's ladder lines (LadderLog) as `npm run season` prints them, each with the");
  say("Sydney time it was printed. Owners switch auto-play over the real owner API.");

  const clock = { t: Date.parse("2026-12-05T00:00:00.000Z") }; // 11:00 Sat 5 Dec in Sydney
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const names = new Map<string, string>();
  const join1 = (name: string, faction: DeckFaction, kind: "house" | "player") => {
    const acct = store.createAccount({ name, username: name.toLowerCase(), password: PASSWORD, kind });
    store.grantStarterCollection(acct.ownerId, faction);
    const a = store.createAgent({ ownerId: acct.ownerId, name: `${name}-agent` });
    store.connectAgent(acct.ownerId, a.agentId);
    names.set(acct.ownerId, name);
    return acct.ownerId;
  };
  const ada = join1("Ada", "Cortex", "player");
  const bram = join1("Bram", "Swarm", "player");
  join1("Hub", "Null", "house");
  join1("Kiln", "Aegis", "house");
  const name = (id: string) => names.get(id) ?? id;

  const lines: { at: number; line: string }[] = [];
  const print = (ls: string[]) => {
    for (const line of ls) {
      lines.push({ at: clock.t, line });
      say(`  ${clockText(clock.t)}  ${line}`);
    }
  };
  const ladderLog = new LadderLog(name);
  let n = 0;
  const live = new LiveLadder({
    store,
    seed: 104,
    build: { games: 0 },
    matchId: () => `m${++n}`,
    now: () => clock.t,
    housePacks: false,
    roundGapMs: 30_000,
    idleRetryMs: 30_000,
    onRound: (r) => print(ladderLog.round(r)),
    onEvent: (e) => print(ladderLog.event(e)),
  });
  const api = await startOwnerApi({ store, port: 0, live });
  apis.push(api);
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await demoFetch(`http://localhost:${api.port}${path}`, {
      method,
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  const token = new Map<string, string>();
  for (const [id, login] of [[ada, "ada"], [bram, "bram"]] as const) {
    token.set(id, (await call("POST", "/api/session", { body: { login, password: PASSWORD } })).body.token);
  }
  const switchTo = async (id: string, on: boolean) => {
    const r = await call("PUT", "/api/play/auto-play", { token: token.get(id), body: { on } });
    say(`  ${clockText(clock.t)}  (website) ${name(id)}: PUT /api/play/auto-play { on: ${on} } -> ${r.status}, on=${r.body.autoPlay?.on}`);
    return r;
  };
  /** Ticks the ladder every 5 s until `until` holds (or `maxMinutes` pass). */
  const runUntil = async (until: () => boolean, maxMinutes: number) => {
    const end = clock.t + maxMinutes * 60_000;
    while (clock.t < end) {
      await live.tick();
      if (until()) return true;
      clock.t += 5_000;
    }
    return false;
  };
  const offLines = (who: string) => lines.filter((l) => l.line === `[ladder] ${who}'s auto-play is off: switched off by its owner` || l.line.startsWith(`[ladder] ${who}'s auto-play is off: switched off by its owner at `));
  const adaLive = () => store.liveMatchOf(ada) !== null;
  const roundLines = () => lines.filter((l) => l.line.startsWith("[ladder] round ")).length;

  section("1. Both player owners switch auto-play on (no time limit)");
  await switchTo(ada, true);
  await switchTo(bram, true);

  section("2. Ada switches it off while her agent's match is on screen");
  check("Ada's agent was paired and is on screen", await runUntil(adaLive, 10));
  const offAt = clock.t;
  const off = await switchTo(ada, false);
  const adaMatch = store.liveMatchOf(ada)!.matchId;
  const recordedAda = () => store.matchHistory().some((m) => m.matchId === adaMatch);
  check("her match keeps going (the switch only keeps her out of the next round)", off.status === 200 && store.liveMatchOf(ada) !== null);
  check("nothing printed yet: the ladder sees the switch at the next round's start", offLines("Ada").length === 0);
  const roundsBefore = roundLines();
  await runUntil(() => roundLines() > roundsBefore, 30);
  check(`her match ${adaMatch} finished on screen and was recorded`, recordedAda());
  const first = offLines("Ada");
  check(
    `the next round's start says she switched it off, once, with when (${first[0] ? clockText(first[0].at) : "-"})`,
    first.length === 1 && first[0]!.line.endsWith(` at ${localStamp(new Date(offAt))}`),
  );
  const roundAfter = lines.findIndex((l) => l.line.startsWith("[ladder] round ") && l.at >= first[0]!.at);
  check("the line comes before that round's own line", roundAfter > lines.indexOf(first[0]!));
  // Two more rounds: she isn't paired, and it isn't said again.
  const roundsNow = roundLines();
  await runUntil(() => roundLines() >= roundsNow + 2, 30);
  const sinceOff = store.matchHistory().filter((m) => (m.p1OwnerId === ada || m.p2OwnerId === ada) && m.matchId !== adaMatch && Date.parse(m.endedAt) >= offAt);
  check("two rounds on: not paired, and not said again", sinceOff.length === 0 && offLines("Ada").length === 1);

  section("3. Ada back on; then off and on again between two rounds");
  await switchTo(ada, true);
  check("paired again", await runUntil(adaLive, 20));
  await runUntil(() => !adaLive(), 30);
  // Off and back on before the next round starts: she never left the queue.
  await switchTo(ada, false);
  await switchTo(ada, true);
  check("paired again in the next round (she never left the queue)", await runUntil(adaLive, 20));
  check("neither said anything (still the one line from part 2)", offLines("Ada").length === 1);

  section("4. Ada off once more");
  await runUntil(() => !adaLive(), 30);
  const offAt2 = clock.t;
  await switchTo(ada, false);
  const roundsThen = roundLines();
  await runUntil(() => roundLines() > roundsThen, 30);
  const all = offLines("Ada");
  check("said again, once, with the new time", all.length === 2 && all[1]!.line.endsWith(` at ${localStamp(new Date(offAt2))}`));
  check("Bram, on all along, never gets the line", offLines("Bram").length === 0);
  check("no server stop was printed for anyone (none happened)", !lines.some((l) => /auto-play is off: (its play time is up|today's rewards are maxed)/.test(l.line)));
  check("the store agrees: Ada off with no stop reason; Bram on", store.autoPlay(ada).on === false && store.autoPlay(ada).stopped === null && store.autoPlay(bram).on === true);
  await live.stop();
} finally {
  for (const a of apis) await a.close();
}

say();
const failed = checks.filter(([, ok]) => !ok);
say(`${checks.length - failed.length} of ${checks.length} checks PASS${failed.length ? `; FAILED: ${failed.map(([w]) => w).join("; ")}` : ""}`);
if (failed.length) process.exitCode = 1;
