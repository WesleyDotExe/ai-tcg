// Evidence for session 76: the play-time allowance on auto-play (owner
// 2026-11-06, progress/season0-final-brief.md section 1), over HTTP on a real
// port, from the long-lived ladder on a fake clock.
//   1. Three player owners and two house owners. Ada starts auto-play with
//      30 minutes, Bram with 15 and adds +30 while it runs, Cyra turns it on
//      with no time chosen (as before). The ladder plays at watch speed;
//      every 30 s each owner's GET /api/play is read as the Agent controls
//      widget would, and each change is printed with what the ladder did.
//   2. Checks: each allowance owner's matches all started inside its window,
//      the one live as time ran out finished and counted ("finishing"), and
//      it was never paired again ("done", stopped with "timeUp"); Cyra, with no
//      time limit, played on.
//   3. Midnight Sydney: 60 minutes started at 23:30 run to midnight only,
//      +15 is refused, and the next day reads clean.
//
//   npx tsx src/dev/playTimeApiDemo.ts > ../progress/play-time-001.txt
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
  say("Play-time demo 001 — \"give the agent X minutes\" on auto-play (session 76)");
  say("=".repeat(72));
  say("Owner 2026-11-06: auto-play on with 15 / 30 / 60 minutes, +15 / +30 while it runs; when time runs out");
  say("the agent finishes its current match and isn't paired again; no carry-over, resets at midnight Sydney;");
  say("no time chosen is auto-play as before. Times below are Sydney wall-clock.");

  const clock = { t: Date.parse("2026-11-08T23:00:00.000Z") }; // 10:00 Mon 9 Nov in Sydney
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
  const bo = join1("Bram", "Swarm", "player");
  const cy = join1("Cyra", "Aegis", "player");
  join1("Hub", "Null", "house");
  join1("Kiln", "Cortex", "house");
  const name = (id: string) => names.get(id) ?? id;

  let n = 0;
  const log: string[] = [];
  const shown: { matchId: string; owners: string[]; outcome: string; startedAt: number; endedAt: number }[] = [];
  const live = new LiveLadder({
    store,
    seed: 76,
    build: { games: 0 },
    matchId: () => `m${++n}`,
    now: () => clock.t,
    housePacks: false,
    roundGapMs: 30_000,
    idleRetryMs: 30_000,
    onEvent: (e) => {
      if (e.kind === "paired") log.push(`paired ${name(e.pairing.p1)} v ${name(e.pairing.p2)}`);
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
  const token = new Map<string, string>();
  for (const [id, login] of [[ada, "ada"], [bo, "bram"], [cy, "cyra"]] as const) {
    token.set(id, (await call("POST", "/api/session", { body: { login, password: PASSWORD } })).body.token);
  }

  section("1. Turning it on (PUT /api/play/auto-play)");
  const show = (who: string, r: { status: number; body: any }) => {
    const a = r.body.autoPlay;
    const al = a?.allowance;
    say(
      `  ${who.padEnd(26)} ${r.status}  on=${a?.on}  ${al ? `${al.state}, ${al.minutesLeft} of ${al.totalMinutes} min, ends ${clockText(Date.parse(al.endsAt))}${al.endsAtReset ? " (midnight)" : ""}` : "no time limit"}  canAddTime=${a?.canAddTime}`,
    );
    return a;
  };
  show("Ada { on, minutes: 30 }", await call("PUT", "/api/play/auto-play", { token: token.get(ada), body: { on: true, minutes: 30 } }));
  show("Bram { on, minutes: 15 }", await call("PUT", "/api/play/auto-play", { token: token.get(bo), body: { on: true, minutes: 15 } }));
  show("Cyra { on }", await call("PUT", "/api/play/auto-play", { token: token.get(cy), body: { on: true } }));
  const bad = await call("PUT", "/api/play/auto-play", { token: token.get(cy), body: { on: true, minutes: 45 } });
  say(`  Cyra { on, minutes: 45 }    ${bad.status}  ${bad.body.error}`);
  const noLimit = await call("POST", "/api/play/auto-play/time", { token: token.get(cy), body: { minutes: 15 } });
  say(`  Cyra POST time +15         ${noLimit.status}  ${noLimit.body.error}`);
  check("no time chosen is auto-play as before (no allowance, nothing to add to)", store.autoPlay(cy).allowance === null && noLimit.status === 409);

  section("2. The ladder at watch speed; each owner's widget read every 30 s (changes only)");
  const begin = clock.t;
  const adaEnds = begin + 30 * 60_000;
  let boEnds = begin + 15 * 60_000;
  const widget = new Map<string, string>();
  const seenStates = new Map<string, string[]>();
  const finishingLive = new Map<string, boolean>();
  let boAdded = false;
  for (let s = 0; s <= 75 * 60; s += 5) {
    await live.tick();
    if (!boAdded && clock.t >= begin + 10 * 60_000) {
      boAdded = true;
      const r = await call("POST", "/api/play/auto-play/time", { token: token.get(bo), body: { minutes: 30 } });
      boEnds = Date.parse(r.body.autoPlay.allowance.endsAt);
      log.push(`Bram adds +30 (POST /api/play/auto-play/time): ${r.status}, now ends ${clockText(boEnds)}`);
    }
    if (s % 30 === 0) {
      for (const id of [ada, bo, cy]) {
        const a = (await call("GET", "/api/play", { token: token.get(id) })).body.autoPlay;
        const state = a.allowance?.state ?? (a.on ? "on, no limit" : "off");
        const states = seenStates.get(id) ?? [];
        if (states.at(-1) !== state) states.push(state);
        seenStates.set(id, states);
        const inMatch = live.liveMatchOf(id);
        if (state === "finishing") finishingLive.set(id, (finishingLive.get(id) ?? false) || (inMatch !== null && a.on === true));
        const text = `${state}${a.allowance && a.allowance.state !== "done" ? ` ${a.allowance.minutesLeft} min` : ""}${inMatch ? ` [in ${inMatch}]` : ""}${a.stopped ? ` stopped=${a.stopped.reason}` : ""}`;
        // Print on a state change, or each whole 5 minutes of a countdown.
        const prev = widget.get(id);
        const coarse = text.replace(/ \d+ min/, (m) => ` ${Math.ceil(parseInt(m) / 5) * 5}~`);
        if (prev !== coarse) {
          for (const l of log.splice(0)) say(`  ${clockText(clock.t).padEnd(9)} * ${l}`);
          say(`  ${clockText(clock.t).padEnd(9)} ${name(id).padEnd(5)} ${text}`);
          widget.set(id, coarse);
        }
      }
    }
    clock.t += 5000;
  }
  for (const l of log.splice(0)) say(`  ${clockText(clock.t).padEnd(9)} * ${l}`);

  section("3. Checks");
  const of = (id: string) => shown.filter((m) => m.owners.includes(id));
  for (const [id, ends, label] of [[ada, adaEnds, "Ada (30 min)"], [bo, boEnds, "Bram (15 + 30 min)"]] as const) {
    const mine = of(id);
    say(`  ${label}: ${mine.length} matches, ${mine.map((m) => `${m.matchId} ${clockText(m.startedAt)}-${clockText(m.endedAt)}`).join(", ")}; time up ${clockText(ends)}`);
    check(`${label}: widget states went running -> finishing -> done`, JSON.stringify(seenStates.get(id)) === JSON.stringify(["running", "finishing", "done"]));
    check(`${label}: every match started inside the window`, mine.length > 0 && mine.every((m) => m.startedAt < ends));
    check(`${label}: the match live as time ran out finished and counted ("finishing" read while it was live)`, (finishingLive.get(id) ?? false) && mine.at(-1)!.endedAt > ends && mine.at(-1)!.outcome !== "cancelled");
    const st = store.autoPlay(id);
    check(`${label}: then off with "timeUp", never paired again`, st.on === false && st.stopped?.reason === "timeUp" && !live.ladder.eligibleOwners().includes(id));
  }
  check("Bram's +30 moved the end 30 minutes", boEnds === begin + 45 * 60_000);
  const cyMatches = of(cy);
  check(`Cyra (no time limit) played on throughout: ${cyMatches.length} matches, the last ending ${clockText(cyMatches.at(-1)?.endedAt ?? 0)}, still on`, cyMatches.length > of(bo).length && store.autoPlay(cy).on);

  section("4. Midnight Sydney: no carry-over");
  await live.stop();
  clock.t = Date.parse("2026-11-09T12:30:00.000Z"); // 23:30 Mon 9 Nov
  const late = show("Ada at 23:30 { minutes: 60 }", await call("PUT", "/api/play/auto-play", { token: token.get(ada), body: { on: true, minutes: 60 } }));
  const more = await call("POST", "/api/play/auto-play/time", { token: token.get(ada), body: { minutes: 15 } });
  say(`  Ada at 23:30 POST time +15  ${more.status}  ${more.body.error}`);
  check("60 minutes at 23:30 run to midnight only (30 min), and nothing more can go on", late.allowance.totalMinutes === 30 && late.allowance.endsAtReset && more.status === 409);
  clock.t = Date.parse("2026-11-09T12:59:30.000Z");
  show("Ada at 23:59:30", await call("GET", "/api/play", { token: token.get(ada) }));
  clock.t = Date.parse("2026-11-09T13:00:00.000Z");
  const next = show("Ada at 00:00 Tue", await call("GET", "/api/play", { token: token.get(ada) }));
  check("at midnight the unused time is gone and Tuesday reads clean (off, no message, no allowance)", next.on === false && next.stopped === null && next.allowance === null && next.canTurnOn);
  show("Ada at 00:00 { minutes: 15 }", await call("PUT", "/api/play/auto-play", { token: token.get(ada), body: { on: true, minutes: 15 } }));

  say();
  const failed = checks.filter(([, ok]) => !ok).length;
  say(`${checks.length - failed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
} finally {
  for (const api of apis) await api.close();
}
