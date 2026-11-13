// Evidence for session 94: the play-time allowance's clock starts at the
// agent's first pairing (schema v29; owner 2026-11-13, answer 1 to game
// session 93: "(a) the clock starts when the agent is first paired, not when
// the owner presses the button; until then the ring reads 'Waiting for the
// next round'").
//
// Session 93's dry run (progress/season0-dry-run-001.txt) found that 15
// minutes switched on while a round was being shown bought one match: the
// agent waited for that round's slowest match (~11 minutes), played one, and
// the time was up. This replays that moment over HTTP on a real port with the
// long-lived ladder on a fake clock:
//   1. Three house owners play a round; Ada presses "15 min" 30 s into it.
//      Her GET /api/play is read every 30 s as the Agent controls widget would.
//   2. Checks: "Waiting for the next round" while the round plays on, the
//      window opening at her first pairing, every match inside it, the last
//      one finishing past it, then "Time's up"; what the v28 rule would have
//      given (the window from the button).
//   3. Midnight Sydney: switched on at 23:55, first paired at 00:05: the
//      minutes are the new day's; paired at 23:50, the window is cut at
//      midnight as before.
//
//   npx tsx src/dev/playTimeClockDemo.ts > ../progress/play-time-002.txt
//
// Ids are match numbers and owner names, so the output is the same every run.

import { type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";
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
  say("Play-time demo 002 — the allowance's clock starts at the first pairing (session 94, schema v29)");
  say("=".repeat(72));
  say("Owner 2026-11-13 (answer 1 to game session 93's dry run): the clock starts when the agent is first");
  say("paired, not when the owner presses the button; until then the ring reads \"Waiting for the next round\".");
  say("Times below are Sydney wall-clock.");

  const clock = { t: Date.parse("2026-12-06T23:00:00.000Z") }; // 10:00 Mon 7 Dec in Sydney
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
  const ada = join1("Ada", "Aegis", "player");
  join1("Hub", "Null", "house");
  join1("Kiln", "Cortex", "house");
  join1("Lux", "Swarm", "house");
  const name = (id: string) => names.get(id) ?? id;

  let n = 0;
  const log: string[] = [];
  const shown: { matchId: string; owners: string[]; outcome: string; startedAt: number; endedAt: number }[] = [];
  const live = new LiveLadder({
    store,
    seed: 97,
    build: { games: 0 },
    matchId: () => `m${++n}`,
    now: () => clock.t,
    housePacks: false,
    roundGapMs: 30_000,
    idleRetryMs: 30_000,
    onRound: (r) => log.push(`round ${r.round}: ${r.pairs.map((p) => `${name(p.p1)} v ${name(p.p2)}`).join(", ")}${r.sitOut.length ? `; ${r.sitOut.map(name).join(", ")} sits out` : ""}`),
    onEvent: (e) => {
      if (e.kind === "autoPlayStopped") log.push(`auto-play off for ${name(e.ownerId)}: ${e.reason}`);
    },
    onRecorded: (m, w) => {
      shown.push({ matchId: m.record.matchId, owners: [m.record.p1OwnerId, m.record.p2OwnerId], outcome: m.record.outcome, ...w });
      log.push(`${m.record.matchId} recorded (${m.record.outcome}): ${name(m.record.p1OwnerId)} v ${name(m.record.p2OwnerId)}`);
    },
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
  const token = (await call("POST", "/api/session", { body: { login: "ada", password: PASSWORD } })).body.token as string;
  const widget = (a: any) => {
    const al = a.allowance;
    if (!al) return a.on ? "on, no limit" : "off";
    const win = al.startedAt === null ? "no window yet" : `window ${clockText(Date.parse(al.startedAt))}-${clockText(Date.parse(al.endsAt))}`;
    return `"${al.label}" (${al.state}), ${al.state === "done" ? 0 : al.minutesLeft} of ${al.totalMinutes} min, ${win}`;
  };

  section("1. A round is on screen; Ada presses \"15 min\" 30 s into it");
  const flush = () => {
    for (const l of log.splice(0)) say(`  ${clockText(clock.t).padEnd(9)} * ${l}`);
  };
  await live.tick();
  flush();
  clock.t += 30_000;
  const pressed = clock.t;
  const on = await call("PUT", "/api/play/auto-play", { token, body: { on: true, minutes: 15 } });
  say(`  ${clockText(clock.t).padEnd(9)} Ada PUT /api/play/auto-play { on, minutes: 15 }: ${on.status}, ${widget(on.body.autoPlay)}`);
  const states: string[] = [on.body.autoPlay.allowance.state];
  let last = widget(on.body.autoPlay);
  let waitingWhileShown = false;
  for (let s = 0; s <= 60 * 60; s += 5) {
    clock.t += 5000;
    await live.tick();
    if (s % 30 === 0 || log.length > 0) {
      const a = (await call("GET", "/api/play", { token })).body.autoPlay;
      const state = a.allowance?.state ?? (a.on ? "on" : "off");
      if (states.at(-1) !== state) states.push(state);
      if (state === "waiting" && live.liveMatches().length > 0 && live.liveMatchOf(ada) === null) waitingWhileShown = true;
      const text = widget(a).replace(/, \d+ of/, (m) => (state === "running" ? m : m));
      const coarse = state === "running" ? text.replace(/"Running" \(running\), (\d+)/, (_m, d) => `"Running" (running), ${Math.ceil(Number(d) / 5) * 5}~`) : text;
      if (log.length > 0 || coarse !== last) {
        flush();
        if (coarse !== last) say(`  ${clockText(clock.t).padEnd(9)} Ada's widget: ${text}${live.liveMatchOf(ada) ? ` [in ${live.liveMatchOf(ada)}]` : ""}`);
        last = coarse;
      }
    }
    if (states.at(-1) === "done" && s > 30 * 60) break;
  }
  flush();

  section("2. Checks");
  const mine = shown.filter((m) => m.owners.includes(ada));
  const final = store.autoPlay(ada);
  const opened = Date.parse(final.allowance?.startedAt ?? "");
  const ends = Date.parse(final.allowance?.endsAt ?? "");
  say(`  Ada pressed at ${clockText(pressed)}; first paired at ${clockText(mine[0]?.startedAt ?? 0)}; window ${clockText(opened)}-${clockText(ends)}.`);
  say(`  Ada's matches: ${mine.map((m) => `${m.matchId} ${clockText(m.startedAt)}-${clockText(m.endedAt)} (${m.outcome})`).join(", ")}.`);
  // (With this seed the time runs out mid-match, so "finishing" shows; with
  // others it can run out between two matches, straight to "done". Seeds 94
  // to 97 were tried; all pass the rule, this one shows the most.)
  check(`the widget went ${["waiting", "running", "finishing", "done"].join(" -> ")}`, JSON.stringify(states) === JSON.stringify(["waiting", "running", "finishing", "done"]));
  check(`"Waiting for the next round" while the round on screen played on without her`, waitingWhileShown);
  check("the window opened at her first pairing, for the 15 minutes chosen", mine.length > 0 && opened === mine[0]!.startedAt && ends === opened + 15 * 60_000);
  check("the wait for the round on screen cost none of the 15 minutes", mine[0]!.startedAt - pressed > 60_000 && final.allowance?.totalMinutes === 15);
  check("every match started inside the window; the last finished past it and counted", mine.every((m) => m.startedAt >= opened && m.startedAt < ends) && mine.at(-1)!.endedAt > ends && mine.at(-1)!.outcome !== "cancelled");
  check('then off with "timeUp", not paired again', final.on === false && final.stopped?.reason === "timeUp" && !live.ladder.eligibleOwners().includes(ada));
  const v28End = pressed + 15 * 60_000;
  const underV28 = mine.filter((m) => m.startedAt < v28End).length;
  say(`  Under the v28 rule (the window from the button, ${clockText(pressed)}-${clockText(v28End)}) she would have started ${underV28} of these ${mine.length} match(es);`);
  say(`  her paired time inside the window is ${Math.round((Math.min(ends, mine.at(-1)!.endedAt) - opened) / 60_000)} minutes of the 15, against ${Math.round((v28End - mine[0]!.startedAt) / 60_000)} under v28.`);
  check("she got more of her 15 minutes than the v28 rule would have given", ends - opened > v28End - mine[0]!.startedAt);
  await live.stop();
  // The ladder is stopped: the matches it left on screen are cancelled (as
  // the next start would), so the hand-started ones below can pair.
  for (const m of store.liveMatches()) store.recordMatch({ matchId: m.matchId, seed: 0, p1AgentId: m.p1AgentId, p2AgentId: m.p2AgentId, outcome: { kind: "cancelled" } });

  section("3. Midnight Sydney (the store's rules, matches started by hand)");
  const hub = [...names.entries()].find(([, v]) => v === "Hub")![0];
  const startAt = (iso: string, id: string) => {
    clock.t = Date.parse(iso);
    store.startMatch({ matchId: id, p1OwnerId: ada, p2OwnerId: hub });
  };
  const end = (id: string) => store.recordMatch({ matchId: id, seed: 1, p1AgentId: store.getOwner(ada).connectedAgentId!, p2AgentId: store.getOwner(hub).connectedAgentId!, outcome: { kind: "cancelled" } });
  const read = async (label: string) => say(`  ${clockText(clock.t).padEnd(9)} ${label.padEnd(36)} ${widget((await call("GET", "/api/play", { token })).body.autoPlay)}`);
  clock.t = Date.parse("2026-12-07T12:40:00.000Z"); // 23:40 Mon
  await call("PUT", "/api/play/auto-play", { token, body: { on: true, minutes: 60 } });
  await read("Ada { minutes: 60 }");
  startAt("2026-12-07T12:50:00.000Z", "late-1");
  await read("paired at 23:50");
  const cut = store.autoPlay(ada);
  check("paired at 23:50, 60 minutes run to midnight only (10 min) and nothing more can go on", cut.allowance?.totalMinutes === 10 && cut.allowance.endsAtReset && !cut.canAddTime);
  clock.t = Date.parse("2026-12-07T12:54:00.000Z");
  end("late-1");
  await call("PUT", "/api/play/auto-play", { token, body: { on: true, minutes: 60 } });
  clock.t = Date.parse("2026-12-07T12:55:00.000Z");
  await read("set again at 23:54 { minutes: 60 }");
  clock.t = Date.parse("2026-12-07T13:05:00.000Z");
  await read("00:05 Tue, not paired yet");
  const carried = store.autoPlay(ada);
  startAt("2026-12-07T13:05:00.000Z", "late-2");
  await read("paired at 00:05");
  const tue = store.autoPlay(ada);
  check("a wait across midnight keeps the minutes chosen; paired at 00:05 they are Tuesday's full 60", carried.allowance?.state === "waiting" && tue.allowance?.totalMinutes === 60 && tue.allowance.endsAt === "2026-12-07T14:05:00.000Z");

  say();
  const failed = checks.filter(([, ok]) => !ok).length;
  say(`Schema v${store.schemaVersion}. ${checks.length - failed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
} finally {
  for (const api of apis) await api.close();
}
