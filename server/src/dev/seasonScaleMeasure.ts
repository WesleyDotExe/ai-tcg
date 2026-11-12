// Session 88 (game lane, a spare session): the rest of session 87's scale
// gaps, measured on a season-size file instead of guessed. Session 87 timed
// only the round's pairing; quality-debt.md (session 87) named what wasn't:
//   - recording a played match through the live ladder (`Ladder.recordPlayed`:
//     the store's record with its payouts, ratings, notifications and daily
//     tally, then the log and replay files and the auto-play checks),
//   - the Stats page (`store.stats`, GET /api/stats) past 5,000 matches,
//   - the ladder standings (`store.ladder`, GET /api/ladder),
//   - the season's end (`store.endSeason`: the tier coins, the frozen
//     standings) and the next season's file (`EconomyStore.startNextSeason`)
//     at Season 0's end, ~6,300 matches per house owner.
//
//   npx tsx src/dev/seasonScaleMeasure.ts > ../progress/season-scale-001.txt
//
// The house cast (seven house owners) and one player owner on auto-play, on
// a file on disk as the server runs. The history is written by `recordMatch`
// directly (fast); then at each level one real round is played (the
// server's own Ladder, the house agents) and each `recordPlayed` timed. The
// season end and next season run on a copy of the file (VACUUM INTO), so the
// next level keeps playing. A record (progress/demos.json "records"): the
// times vary per run.

import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { EconomyStore } from "@ai-tcg/economy";
import type { DeckFaction, PlayStyleId } from "@ai-tcg/engine";
import { Ladder } from "../ladder/ladderRunner.js";

const say = (line = "") => console.log(line);
const START = Date.parse("2026-12-04T13:00:00.000Z"); // midnight 5 Dec, Sydney
let clock = new Date(START);
const dir = mkdtempSync(join(tmpdir(), "season-scale-"));

const CAST: { name: string; faction: DeckFaction; style: PlayStyleId; player?: true }[] = [
  { name: "Lattice Warden", faction: "Cortex", style: "calculator", player: true },
  { name: "Quiet Theorem", faction: "Cortex", style: "controller" },
  { name: "Hive Courier", faction: "Swarm", style: "rusher" },
  { name: "Brood Cartographer", faction: "Swarm", style: "tempo" },
  { name: "Chrome Bastion", faction: "Aegis", style: "fortress" },
  { name: "Mirror Sentry", faction: "Aegis", style: "calculator" },
  { name: "Static Widow", faction: "Null", style: "gambler" },
  { name: "Dead Channel", faction: "Null", style: "tempo" },
];
type Side = { ownerId: string; agentId: string; deckId: string };
type T = { median: number; max: number };

function time(fn: () => unknown, runs = 10): T {
  fn();
  const ms: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    fn();
    ms.push(performance.now() - t);
  }
  ms.sort((a, b) => a - b);
  return { median: ms[Math.floor(runs / 2)]!, max: ms[runs - 1]! };
}
const once = <R>(fn: () => R): { ms: number; value: R } => {
  const t = performance.now();
  const value = fn();
  return { ms: performance.now() - t, value };
};
const f = (n: number) => n.toFixed(1).padStart(7);
const line = (what: string, t: T) => say(`    ${what.padEnd(46)} ${f(t.median)} ms (max ${f(t.max)}) [timing, varies per run]`);
const one = (what: string, ms: number) => say(`    ${what.padEnd(46)} ${f(ms)} ms (once) [timing, varies per run]`);

try {
  say("Season scale 001 — recording a match, the Stats page, the standings and the season's end at a season's history");
  say("(session 88, game lane)");
  say("=".repeat(72));
  say(`Machine: ${cpus().length} cores, ${cpus()[0]?.model ?? "?"}; node ${process.version}. Times in ms; median and max of 10 unless "once".`);
  say("Seven house owners and one player owner (Lattice Warden's, on auto-play), every one in every round, on a file on");
  say("disk. History written by recordMatch (one match each a round, 9 minutes apart); then one real round played by the");
  say("server's Ladder and each recordPlayed timed (the log and replay files written too). The season end and the next");
  say("season's file are made from a copy of the file at each level.");
  say();
  const path = join(dir, "season.db");
  const store = EconomyStore.open(path, { now: () => clock });
  const sides: Side[] = CAST.map((c) => {
    const o = store.createOwner({ name: `${c.player ? "Player" : "House"} ${c.name}`, kind: c.player ? "player" : "house" });
    const { copies } = store.grantStarterCollection(o.ownerId, c.faction);
    const deck = store.saveDeck(o.ownerId, "starter", copies.map((x) => x.copyId));
    store.setActiveDeck(o.ownerId, deck.deckId);
    store.setDeckChoice(o.ownerId, "forced");
    const a = store.createAgent({ ownerId: o.ownerId, name: c.name });
    store.connectAgent(o.ownerId, a.agentId);
    store.setPlayStyle(o.ownerId, a.agentId, c.style);
    return { ownerId: o.ownerId, agentId: a.agentId, deckId: deck.deckId };
  });
  const player = sides[0]!;
  const house = sides[1]!;
  let real = 0;
  const ladder = new Ladder({ store, seed: 8801, logDir: dir, housePacks: false, matchId: () => `real-${++real}` });
  let n = 0;
  let rounds = 0;
  const round = () => {
    clock = new Date(clock.getTime() + 9 * 60_000);
    rounds++;
    for (let i = 0; i < 4; i++) {
      const a = sides[(i + rounds) % 8]!;
      const b = sides[(7 - i + rounds) % 8]!;
      const r = (n + i) % 10;
      store.recordMatch({
        matchId: `m-${++n}`,
        seed: n,
        p1AgentId: a.agentId,
        p2AgentId: b.agentId,
        p1DeckId: a.deckId,
        p2DeckId: b.deckId,
        turns: 9 + (n % 7),
        outcome: r < 5 ? { kind: "win", winnerAgentId: a.agentId } : r < 9 ? { kind: "win", winnerAgentId: b.agentId } : { kind: "draw" },
      });
    }
  };
  const levels = [150, 2_500, 6_300, 12_600];
  for (const target of levels) {
    const t0 = performance.now();
    while (rounds < target) round();
    const recordS = (performance.now() - t0) / 1000;
    const days = (clock.getTime() - START) / 86_400_000;
    say(`  ${rounds} matches per owner (${n} in the file; ${days.toFixed(1)} days at ~150 rounds a day)`);
    say(`    (history written in ${recordS.toFixed(1)} s) [timing, varies per run]`);

    // One real round, just after the next midnight Sydney: the player owner
    // back on auto-play (the day's rewards cap switches it off as the history
    // is written, and it can go back on only on a new day).
    const day = 86_400_000;
    clock = new Date(START + Math.ceil((clock.getTime() + 1 - START) / day) * day + 60_000);
    store.setAutoPlay(player.ownerId, true);
    const { pairs } = await ladder.startRound();
    const recorded: number[] = [];
    for (const p of pairs) {
      const played = await ladder.playPair(p);
      if (played === null) continue;
      recorded.push(once(() => ladder.recordPlayed(played)).ms);
    }
    recorded.sort((a, b) => a - b);
    const files = readdirSync(dir).filter((x) => x.startsWith("real-"));
    const fileBytes = files.reduce((sum, x) => sum + statSync(join(dir, x)).size, 0);
    store.unsafeExec("PRAGMA wal_checkpoint(TRUNCATE)");
    say(`    season file ${(statSync(path).size / 1048576).toFixed(1)} MB (${((statSync(path).size / n) / 1024).toFixed(2)} KB a match); the log and replay of a real match ${(fileBytes / real / 1024).toFixed(0)} KB (${real} so far)`);
    line(`Ladder.recordPlayed (${recorded.length} real matches)`, { median: recorded[Math.floor(recorded.length / 2)]!, max: recorded[recorded.length - 1]! });
    line("store.stats(), a house owner", time(() => store.stats(house.ownerId)));
    line("store.stats(), the player owner, recent 50", time(() => store.stats(player.ownerId, { recent: 50 })));
    line("store.ladder() (GET /api/ladder)", time(() => store.ladder()));
    line("store.rating(), one owner", time(() => store.rating(house.ownerId)));
    line("store.ratingHistory(), 20 (GET /api/rating)", time(() => store.ratingHistory(house.ownerId, 20)));
    line("store.notifications(), the player owner", time(() => store.notifications(player.ownerId)));

    const copy = join(dir, `copy-${target}.db`);
    store.unsafeExec(`VACUUM INTO '${copy}'`);
    const ended = EconomyStore.open(copy, { now: () => clock });
    const end = once(() => ended.endSeason());
    ended.close();
    one(`store.endSeason() (${end.value.standings.length} standings)`, end.ms);
    const nextPath = join(dir, `next-${target}.db`);
    const next = once(() => EconomyStore.startNextSeason(copy, nextPath, { season: "S1", now: () => clock }));
    one("EconomyStore.startNextSeason()", next.ms);
    for (const p of [copy, nextPath]) for (const x of ["", "-wal", "-shm", ".lock"]) rmSync(`${p}${x}`, { force: true });
    say();
  }
  store.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}
