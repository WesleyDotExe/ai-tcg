// Session 87 (game lane, a spare session): what a ladder round costs at a
// season's history, measured instead of guessed.
//
// Every round, `Ladder.startRound` asks each queued owner's last two
// opponents (the pairing's "not the same opponent again" rule). Until
// session 87 that read the owner's WHOLE match history
// (`store.matchHistory({ ownerId })`, every record with its ratings,
// loadouts and boasts) and kept the last two. A house agent plays one match
// a round, all day: at a ~9-minute round (a 6.7-minute median match plus
// the 60 s gap, the round waiting on its slowest match) that is ~150 a day,
// ~6,300 over Season 0's ~42 days, and the history carries on into the next
// season (owner 2026-11-10). The read also puts every match id into one
// `IN (...)` list, and SQLite refuses more than 32,766 of them.
//
//   npx tsx src/dev/ladderScaleMeasure.ts > ../progress/ladder-scale-001.txt
//
// Eight house owners (the house cast), each on its starter deck, on a file
// on disk as the server runs; the history is written by `recordMatch`
// directly (the round's own matches are not played: only `startRound`, the
// pairing, is timed, with house shopping off so it times the same work
// every run). A record (progress/demos.json "records"): the times vary.

import { mkdtempSync, rmSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { EconomyStore } from "@ai-tcg/economy";
import type { DeckFaction } from "@ai-tcg/engine";
import { Ladder } from "../ladder/ladderRunner.js";

const say = (line = "") => console.log(line);
const START = Date.parse("2026-12-04T13:00:00.000Z"); // midnight 5 Dec, Sydney
let clock = new Date(START);
const dir = mkdtempSync(join(tmpdir(), "ladder-scale-"));

const CAST: { name: string; faction: DeckFaction }[] = [
  { name: "Lattice Warden", faction: "Cortex" },
  { name: "Quiet Theorem", faction: "Cortex" },
  { name: "Hive Courier", faction: "Swarm" },
  { name: "Brood Cartographer", faction: "Swarm" },
  { name: "Chrome Bastion", faction: "Aegis" },
  { name: "Mirror Sentry", faction: "Aegis" },
  { name: "Static Widow", faction: "Null" },
  { name: "Dead Channel", faction: "Null" },
];
type Side = { ownerId: string; agentId: string; deckId: string };

function time(fn: () => unknown, runs = 10): { median: number; max: number } {
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
async function timeAsync(fn: () => Promise<unknown>, runs = 10): Promise<{ median: number; max: number }> {
  await fn();
  const ms: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    await fn();
    ms.push(performance.now() - t);
  }
  ms.sort((a, b) => a - b);
  return { median: ms[Math.floor(runs / 2)]!, max: ms[runs - 1]! };
}
const f = (n: number) => n.toFixed(1).padStart(7);
const line = (what: string, t: { median: number; max: number }) => say(`    ${what.padEnd(44)} ${f(t.median)} ms (max ${f(t.max)}) [timing, varies per run]`);

try {
  say("Ladder scale 001 — a ladder round's pairing at a season's history (session 87, game lane)");
  say("=".repeat(72));
  say(`Machine: ${cpus().length} cores, ${cpus()[0]?.model ?? "?"}; node ${process.version}. Times in ms, median and max of 10.`);
  say("Eight house owners on their starter decks, every one in every round (one match each a round), on a file on disk.");
  say("startRound: the whole pairing step the live ladder runs before each round (house shopping off).");
  say("Per owner: its last two opponents, read the old way (the whole history, keep the last two) and by SQL now.");
  say();
  const store = EconomyStore.open(join(dir, "season.db"), { now: () => clock });
  const sides: Side[] = CAST.map((c) => {
    const o = store.createOwner({ name: `House ${c.name}`, kind: "house" });
    const { copies } = store.grantStarterCollection(o.ownerId, c.faction);
    const deck = store.saveDeck(o.ownerId, "starter", copies.map((x) => x.copyId));
    store.setActiveDeck(o.ownerId, deck.deckId);
    store.setDeckChoice(o.ownerId, "forced");
    const a = store.createAgent({ ownerId: o.ownerId, name: c.name });
    store.connectAgent(o.ownerId, a.agentId);
    return { ownerId: o.ownerId, agentId: a.agentId, deckId: deck.deckId };
  });
  const ladder = new Ladder({ store, seed: 8701, housePacks: false });
  const ada = sides[0]!;
  let n = 0;
  let rounds = 0;
  /** One round of history: the eight paired off in a rotation, 9 minutes on. */
  const round = () => {
    clock = new Date(clock.getTime() + 9 * 60_000);
    rounds++;
    for (let i = 0; i < 4; i++) {
      const a = sides[(i + rounds) % 8]!;
      const b = sides[(7 - i + rounds) % 8]!;
      if (a === b) continue;
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
  // Each round gives every owner one match, so an owner's count is the
  // rounds written (counted without the whole-history read, which is what
  // 33,000 refuses).
  const levels = [0, 150, 2_500, 6_300, 12_600, 33_000];
  for (const target of levels) {
    const t0 = performance.now();
    while (rounds < target) round();
    const recordS = (performance.now() - t0) / 1000;
    const days = (clock.getTime() - START) / 86_400_000;
    const count = rounds;
    say(`  ${count} matches per owner (${n} in the file; ${days.toFixed(1)} days at ~150 rounds a day)`);
    say(`    (history written in ${recordS.toFixed(1)} s) [timing, varies per run]`);
    line("startRound(), all eight", await timeAsync(() => ladder.startRound()));
    let old: { median: number; max: number } | string;
    try {
      old = time(() => store.matchHistory({ ownerId: ada.ownerId }).slice(-2));
    } catch (err) {
      old = err instanceof Error ? err.message : String(err);
    }
    if (typeof old === "string") say(`    one owner, the whole history (old)             refused: ${old}`);
    else line("one owner, the whole history (old)", old);
    line("one owner, store.recentOpponents (SQL)", time(() => store.recentOpponents(ada.ownerId, 2)));
    say();
  }
  store.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}
