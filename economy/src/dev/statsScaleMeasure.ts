// Session 86 (the game lane's hardening pass): how long the Stats page's read
// (`store.stats`, behind GET /api/stats) and the match history read
// (`store.matchHistory`, behind GET /api/matches) take at a full season's
// history, measured instead of guessed. quality-debt.md (session 78) said
// "fine for Season 0, not for launch" without a number.
//
// Season 0 runs 5 Dec to about mid-January: ~42 days. An owner on auto-play
// all day plays ~60 matches a day, so ~2,500 matches; this measures 500,
// 2,500 and 5,000 (two seasons' worth) for one owner, in a file on disk
// (as the server runs), each read timed 20 times after one warm-up.
//
//   npx tsx src/dev/statsScaleMeasure.ts > ../progress/stats-scale-001.txt
//
// A measurement on this machine, kept as a record (progress/demos.json
// "records"); the times vary run to run.

import { mkdtempSync, rmSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import type { DeckFaction } from "@ai-tcg/engine";
import { EconomyStore } from "../index.js";

const say = (line = "") => console.log(line);
const START = Date.parse("2026-12-04T13:00:00.000Z"); // midnight 5 Dec, Sydney
let clock = new Date(START);
const dir = mkdtempSync(join(tmpdir(), "stats-scale-"));

type Side = { ownerId: string; agentId: string; deckId: string };
function owner(store: EconomyStore, name: string, faction: DeckFaction): Side {
  const o = store.createOwner({ name, kind: "player" });
  const { copies } = store.grantStarterCollection(o.ownerId, faction);
  const deck = store.saveDeck(o.ownerId, "starter", copies.map((c) => c.copyId));
  store.setActiveDeck(o.ownerId, deck.deckId);
  const a = store.createAgent({ ownerId: o.ownerId, name: `${name}-agent` });
  store.connectAgent(o.ownerId, a.agentId);
  return { ownerId: o.ownerId, agentId: a.agentId, deckId: deck.deckId };
}

function time(fn: () => unknown, runs = 20): { median: number; max: number } {
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
const f = (n: number) => n.toFixed(1).padStart(6);

try {
  say("Stats scale 001 — the Stats and match history reads at a season's history (session 86, game lane)");
  say("=".repeat(72));
  say(`Machine: ${cpus().length} cores, ${cpus()[0]?.model ?? "?"}; node ${process.version}. Times in ms, median and max of 20.`);
  say("One owner (Ada) plays every match, against 5 others in turn, 24 minutes apart (60 a day), on a file on disk.");
  say();
  const store = EconomyStore.open(join(dir, "season.db"), { now: () => clock });
  const factions: DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null", "Cortex", "Swarm"];
  const [ada, ...others] = factions.map((fac, i) => owner(store, ["Ada", "Bo", "Cy", "Di", "Ed", "Fy"][i]!, fac));
  let n = 0;
  const playTo = (total: number) => {
    while (n < total) {
      clock = new Date(clock.getTime() + 24 * 60_000);
      const opp = others[n % others.length]!;
      const r = n % 10;
      store.recordMatch({
        matchId: `m-${++n}`,
        seed: n,
        p1AgentId: n % 2 ? ada!.agentId : opp.agentId,
        p2AgentId: n % 2 ? opp.agentId : ada!.agentId,
        p1DeckId: n % 2 ? ada!.deckId : opp.deckId,
        p2DeckId: n % 2 ? opp.deckId : ada!.deckId,
        turns: 9 + (n % 7),
        outcome: r < 5 ? { kind: "win", winnerAgentId: ada!.agentId } : r < 9 ? { kind: "win", winnerAgentId: opp.agentId } : { kind: "draw" },
      });
    }
  };
  say("stats(): the Stats page (GET /api/stats), all agents and one. matchHistory(): every record, which GET /api/matches");
  say("read for each page until session 86 and ownerStats (the admin view, per house owner) counted. matchHistoryPage(): the");
  say("page of 20 by SQL that GET /api/matches reads now (the newest, and one deep in the history). ownerStats(): counted from");
  say("four columns now.");
  say();
  for (const total of [500, 2500, 5000]) {
    const t0 = performance.now();
    playTo(total);
    const recordMs = performance.now() - t0;
    const s = time(() => store.stats(ada!.ownerId));
    const r = time(() => store.stats(ada!.ownerId, { agentId: ada!.agentId, recent: 50 }));
    const h = time(() => store.matchHistory({ ownerId: ada!.ownerId }));
    const deep = `m-${Math.floor(total / 2)}`;
    const p1 = time(() => store.matchHistoryPage(ada!.ownerId, { limit: 20 }));
    const p2 = time(() => store.matchHistoryPage(ada!.ownerId, { limit: 20, before: deep }));
    const o = time(() => store.ownerStats(ada!.ownerId));
    const page = store.stats(ada!.ownerId);
    const days = Math.round((clock.getTime() - START) / 86_400_000);
    const line = (what: string, t: { median: number; max: number }) => say(`    ${what.padEnd(34)} ${f(t.median)} ms (max ${f(t.max)}) [timing, varies per run]`);
    say(`  ${total} matches for Ada (${days} days at 60 a day): ${page.totals.wins}-${page.totals.losses}-${page.totals.draws}`);
    say(`    (recorded in ${(recordMs / 1000).toFixed(1)} s) [timing, varies per run]`);
    line("stats(), all agents", s);
    line("stats(), one agent, recent 50", r);
    line("matchHistory(), every record", h);
    line("matchHistoryPage(), newest 20", p1);
    line(`matchHistoryPage(), 20 before ${deep}`, p2);
    line("ownerStats()", o);
    say();
  }
  store.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}
