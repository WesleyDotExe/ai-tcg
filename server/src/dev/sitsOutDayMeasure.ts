// Game session 102 (game lane): two of session 100/101's "unmeasured" lines,
// measured instead of guessed (quality-debt.md, sessions 100 and 101):
//
//   1. "A locked owner left out is retried every round ... the season log
//      will carry one 'left out' line per round for such an owner until they
//      craft. Not measured over a day's rounds." A real day (24 hours on a
//      fixed clock) of the server's own LiveLadder: three house owners and
//      one player owner on auto-play with no time limit, locked to a faction
//      they hold no card of. Every event goes through the season server's
//      own log lines (`ladderLogLines`, what `npm run season` prints), and
//      the run counts what the log would carry, then the same day through
//      the old printing (one line per event), for the comparison.
//   2. "'buildable' computed on every GET /api/play, unmeasured at season
//      scale." `lockableFactions` and the whole `GET /api/play` timed over
//      the real owner API at collection sizes from the starter grant to
//      several seasons of packs.
//
//   npx tsx src/dev/sitsOutDayMeasure.ts > ../progress/sits-out-day-001.txt
//
// A record (progress/demos.json "records"): part 2's times vary per run;
// part 1's counts are fixed by the seeds.

import { mkdtempSync, rmSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { SHIPPED_DECK_LISTS, type DeckFaction, type PlayStyleId } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { LiveLadder } from "../ladder/liveLadder.js";
import { LadderLog } from "../ladder/ladderLog.js";
import type { LadderEvent } from "../ladder/ladderRunner.js";
import { startOwnerApi } from "../ownerApi.js";
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
const PW = "correct horse battery";
const BUILD = { games: 4, trials: 8, confirmGames: 8 };
const DAY = 86_400_000;
const dir = mkdtempSync(join(tmpdir(), "sits-out-day-"));

try {
  say("# A locked owner's day on the ladder, and `lockable` at season scale (game session 102)");
  say();
  say(`Machine: ${cpus().length} cores, ${cpus()[0]?.model ?? "?"}; node ${process.version}.`);

  // ---- 1. A day's rounds ----
  section("1. A day's rounds with a locked owner who can't build (the live ladder, 24 hours on a fixed clock)");
  // 09:00 Tue 8 Dec in Sydney.
  const clock = { t: Date.parse("2026-12-07T22:00:00.000Z") };
  const store = EconomyStore.open(join(dir, "season-0.db"), { now: () => new Date(clock.t) });
  const CAST: { name: string; login: string | null; faction: DeckFaction; style: PlayStyleId }[] = [
    { name: "House Cortex", login: null, faction: "Cortex", style: "calculator" },
    { name: "House Aegis", login: null, faction: "Aegis", style: "fortress" },
    { name: "House Null", login: null, faction: "Null", style: "gambler" },
    { name: "Player Locked", login: "locked", faction: "Swarm", style: "rusher" },
  ];
  const ids: Record<string, string> = {};
  for (const c of CAST) {
    const o = c.login ? store.createAccount({ name: c.name, username: c.login, password: PW, kind: "player" }) : store.createOwner({ name: c.name, kind: "house" });
    store.grantStarterCollection(o.ownerId, c.faction);
    const a = store.createAgent({ ownerId: o.ownerId, name: `${c.name}'s agent` });
    store.setPlayStyle(o.ownerId, a.agentId, c.style);
    store.connectAgent(o.ownerId, a.agentId);
    ids[c.name] = o.ownerId;
  }
  const locked = ids["Player Locked"]!;
  const name = (ownerId: string) => store.getOwner(ownerId).name;
  // The player locks Aegis before the day starts: no Aegis card held.
  const fits = store.setFactionLock(locked, "Aegis");
  store.setAutoPlay(locked, true);
  const aegis = store.lockableFactions(locked).find((x) => x.faction === "Aegis")!;
  say(`  Player Locked holds the Swarm starter only, locks Aegis (activeDeckFits ${fits.activeDeckFits}; lockable Aegis ${aegis.cards}/${aegis.needed}), auto-play on with no time limit.`);

  const log = new LadderLog(name);
  const printed: string[] = [];
  let oldLines = 0;
  let lockedExcluded = 0;
  let otherExcluded = 0;
  let rounds = 0;
  let matches = 0;
  const onEvent = (e: LadderEvent) => {
    // The old printing: one line for every event the season server printed.
    if (e.kind === "excluded" || e.kind === "rebuilt" || e.kind === "housePacks" || e.kind === "match" || e.kind === "autoPlayStopped") oldLines++;
    if (e.kind === "excluded") {
      if (e.ownerId === locked) lockedExcluded++;
      else otherExcluded++;
    }
    if (e.kind === "match") matches++;
    for (const l of log.event(e)) printed.push(l);
  };
  let n = 0;
  let packSeed = 50_000;
  const live = new LiveLadder({
    store,
    seed: 10_200,
    build: BUILD,
    matchId: () => `day-${String(++n).padStart(4, "0")}`,
    logDir: join(dir, "matches"),
    now: () => clock.t,
    roundGapMs: 60_000,
    idleRetryMs: 60_000,
    housePacks: { packSeed: () => ++packSeed },
    onRound: (r) => {
      rounds++;
      oldLines++;
      for (const l of log.round(r)) printed.push(l);
    },
    onEvent,
  });
  const start = clock.t;
  const wall = performance.now();
  // Crafting partway: at 18:00 Sydney (9 hours in) the owner crafts 19
  // Aegis cards (one short), so the reason changes once; the lock still
  // can't be built, and the day ends with them still out.
  let crafted = false;
  while (clock.t < start + DAY) {
    clock.t += 5000;
    await live.tick();
    if (!crafted && clock.t >= start + 9 * 3_600_000) {
      crafted = true;
      store.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${locked}', 'packPoints', 5000, 'demoGrant', '${new Date(clock.t).toISOString()}')`);
      const list = SHIPPED_DECK_LISTS.Aegis.flatMap((e) => Array.from({ length: e.copies }, () => e.cardId));
      let k = 0;
      for (const cardId of list) {
        if (k === 19) break;
        store.craftCard(locked, cardId);
        k++;
      }
      const a2 = store.lockableFactions(locked).find((x) => x.faction === "Aegis")!;
      printed.push(`(the run: Player Locked crafts 19 Aegis starter cards; lockable Aegis ${a2.cards}/${a2.needed})`);
    }
  }
  await live.stop();
  const wallS = ((performance.now() - wall) / 1000).toFixed(0);
  say(`  The day: ${rounds} rounds, ${matches} matches recorded (in ${wallS} s of real time).`);
  say(`  Player Locked left out: ${lockedExcluded} times (every round); anyone else left out: ${otherExcluded} times.`);
  const sitsOut = printed.filter((l) => l.includes("Player Locked") && (l.includes("sits out") || l.includes("still sits out")));
  say();
  say(`  The season log over the day (the server's lines for Player Locked, all of them):`);
  for (const l of printed.filter((x) => x.includes("Player Locked") || x.startsWith("(the run"))) say(`    ${l}`);
  say();
  const logLines = printed.filter((l) => !l.startsWith("(the run")).length;
  say(`  Lines the season log carries for the day: ${logLines} (the old printing: ${oldLines}).`);
  say(`  Of those, Player Locked "sits out" lines: ${sitsOut.length} (the old printing: ${lockedExcluded}).`);
  check(`Player Locked was left out of every round (${lockedExcluded} of ${rounds})`, lockedExcluded === rounds);
  check("the others played all day (nobody else left out)", otherExcluded === 0 && matches > 0);
  check("the log says why the first time (\"at most 0 usable cards\")", sitsOut.some((l) => l.includes("at most 0 usable cards")));
  check("the log says it again when the reason changes (\"at most 19 usable cards\")", sitsOut.some((l) => l.includes("at most 19 usable cards")));
  check(`a repeat is summed up, not printed every round (${sitsOut.length} lines, under 30 for the day)`, sitsOut.length > 0 && sitsOut.length < 30);
  store.close();

  // ---- 2. lockable at season scale ----
  section("2. `lockable` and GET /api/play at collection sizes (the real owner API)");
  const s2 = EconomyStore.open(join(dir, "scale.db"));
  const o = s2.createAccount({ name: "Collector", username: "collector", password: PW, kind: "player" });
  s2.grantStarterCollection(o.ownerId, "Aegis");
  const ag = s2.createAgent({ ownerId: o.ownerId, name: "Collector's agent" });
  s2.connectAgent(o.ownerId, ag.agentId);
  s2.setFactionLock(o.ownerId, "Aegis");
  const api = await startOwnerApi({ store: s2, port: 0, build: BUILD });
  const base = `http://localhost:${api.port}`;
  const session = (await (await demoFetch(`${base}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: "collector", password: PW }) })).json()) as { token: string };
  const getPlay = async () => {
    const r = await demoFetch(`${base}/api/play`, { headers: { Authorization: `Bearer ${session.token}` } });
    if (r.status !== 200) throw new Error(`GET /api/play ${r.status}`);
    return r.json();
  };
  const timeSync = (fn: () => unknown, runs = 20) => {
    fn();
    const ms: number[] = [];
    for (let i = 0; i < runs; i++) {
      const t = performance.now();
      fn();
      ms.push(performance.now() - t);
    }
    ms.sort((a, b) => a - b);
    return { median: ms[Math.floor(runs / 2)]!, max: ms[runs - 1]! };
  };
  const timeAsync = async (fn: () => Promise<unknown>, runs = 20) => {
    await fn();
    const ms: number[] = [];
    for (let i = 0; i < runs; i++) {
      const t = performance.now();
      await fn();
      ms.push(performance.now() - t);
    }
    ms.sort((a, b) => a - b);
    return { median: ms[Math.floor(runs / 2)]!, max: ms[runs - 1]! };
  };
  const ft = (x: number) => x.toFixed(2).padStart(7);
  say("  Packs opened | copies held | lockableFactions (ms, median / max of 20) | GET /api/play (ms, median / max of 20) [timing, varies per run]");
  let opened = 0;
  let seed = 7000;
  let worst = 0;
  for (const target of [0, 50, 200, 500, 1000]) {
    while (opened < target) {
      const batch = 10; // the store opens 1 or 10 at once (every target is a multiple of 10)
      for (let i = 0; i < batch; i++) s2.grantPack(o.ownerId, "S0", "weeklyChallenge");
      s2.openPacks(o.ownerId, batch, { seeds: Array.from({ length: batch }, () => ++seed) });
      opened += batch;
    }
    const held = s2.collection(o.ownerId).length;
    const lf = timeSync(() => s2.lockableFactions(o.ownerId));
    const gp = await timeAsync(getPlay);
    worst = Math.max(worst, gp.median);
    say(`  ${String(target).padStart(12)} | ${String(held).padStart(11)} | ${ft(lf.median)} / ${ft(lf.max)} | ${ft(gp.median)} / ${ft(gp.max)}`);
  }
  say("  (A Season 0 owner opens about 5 packs at the grant and at most a pack a day or two after it, so 50 is past");
  say("  a season; 1,000 packs is a margin, not a forecast.)");
  check(`GET /api/play stays under 50 ms (median) at every size measured (worst ${worst.toFixed(1)} ms)`, worst < 50);
  await api.close();
  s2.close();

  say();
  const failed = checks.filter(([, ok]) => !ok).length;
  say(`${checks.length - failed} of ${checks.length} PASS${failed ? `, ${failed} FAIL` : ""}`);
  if (failed) process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
