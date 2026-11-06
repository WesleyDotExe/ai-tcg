// How long the Season 0 server stops answering while the ladder starts a
// round (session 81, hardening; quality-debt session 80: "the rule-change
// rebuild is all at once ... measured on a store with many agent decks").
//
//   npm run measure:ladder-stall -w server -- [owners ...]   (default: 8 24)
//
// The server as `seasonCli.ts` runs it, in one process: the owner API and the
// LiveLadder over one store, deck builds on the worker chooser's threads.
// Each cast is N house owners (factions in turn, a starter collection plus 10
// packs each), whose agent decks were built under the plain rule, as every
// deck before v25 was, so the first round asks every one of them to rebuild
// ("the builder's rule changed"), with the store's real build settings. The
// house pack policy is off, so round 2 has nothing to rebuild and shows the
// matches alone.
//
// While each round starts, a viewer polls GET /api/live every 100 ms, and a
// 10 ms timer records how late it fires (the event loop's stalls). Printed per
// round and phase (the rebuilds and pairing; then playing the round's matches,
// which the ladder does in this thread before showing them): the wall time,
// the longest stall, and the API's response times.
//
// Output: progress/ladder-stall-001.txt (a record, not a CI demo).
// Wall times depend on the machine; every number here is a measurement, not a
// fixed output, so this is not one of the CI demos.

import { availableParallelism } from "node:os";
import { performance } from "node:perf_hooks";
import { DEFAULT_BUILD, DECK_FACTIONS, PLAY_STYLES, type PlayStyleId } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { workerChooser, defaultMaxWorkers } from "../deckBuild/workerChooser.js";
import { LiveLadder } from "../ladder/liveLadder.js";
import { startOwnerApi } from "../ownerApi.js";
import { demoFetch, demoFetchRetries } from "./demoFetch.js";

const sizes = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n >= 2);
const CASTS = sizes.length > 0 ? sizes : [8, 24];
const STYLES = Object.keys(PLAY_STYLES) as PlayStyleId[];
const SEED_BUILD = { games: 4, trials: 4, confirmGames: 8, keepDesigned: null } as const;
const say = (line = "") => console.log(line);
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

type Phase = "rebuilds" | "matches";
interface PhaseLog {
  start: number;
  end: number;
  stalls: number[];
  latencies: number[];
}

const pct = (xs: number[], p: number) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};

say("# The ladder's round start vs the owner API, in one process (session 81)");
say();
say(`machine: ${availableParallelism()} CPUs; the worker chooser runs ${defaultMaxWorkers()} builds at once`);
say(`the store's build settings (each rebuild): games ${DEFAULT_BUILD.games}, trials ${DEFAULT_BUILD.trials}, confirm games ${DEFAULT_BUILD.confirmGames}, keepDesigned ${DEFAULT_BUILD.keepDesigned}`);
say();

for (const n of CASTS) {
  const clock = { t: Date.parse("2026-11-01T22:00:00.000Z") };
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  for (let i = 0; i < n; i++) {
    const faction = DECK_FACTIONS[i % DECK_FACTIONS.length]!;
    const o = store.createOwner({ name: `House ${i + 1}`, kind: "house" });
    store.grantStarterCollection(o.ownerId, faction);
    for (let k = 0; k < 10; k++) store.grantPack(o.ownerId, "S0", "weeklyChallenge");
    store.openPacks(o.ownerId, 10, { seeds: Array.from({ length: 10 }, (_, k) => 81_000 + i * 10 + k) });
    const a = store.createAgent({ ownerId: o.ownerId, name: `Agent ${i + 1}` });
    store.setPlayStyle(o.ownerId, a.agentId, STYLES[i % STYLES.length]!);
    store.connectAgent(o.ownerId, a.agentId);
    await store.buildAgentDeck(o.ownerId, SEED_BUILD);
  }
  store.createAccount({ name: "Viewer", username: "viewer", password: "correct horse battery", kind: "player" });
  const asking = store.listOwners().filter((o) => o.kind === "house" && store.agentDeckRebuildReasons(o.ownerId).length > 0).length;

  const chooser = workerChooser();
  const phases: { round: number; phase: Phase; log: PhaseLog }[] = [];
  let current: PhaseLog | null = null;
  const begin = (round: number, phase: Phase) => {
    if (current) current.end = performance.now();
    current = { start: performance.now(), end: NaN, stalls: [], latencies: [] };
    phases.push({ round, phase, log: current });
  };
  let round = 0;
  let rebuiltThisRound = 0;
  const live = new LiveLadder({
    store,
    chooser: chooser.choose,
    seed: 8100 + n,
    housePacks: false,
    now: () => clock.t,
    roundGapMs: 60_000,
    idleRetryMs: 60_000,
    onRound: () => begin(round, "matches"),
    onEvent: (e) => {
      if (e.kind === "rebuilt") rebuiltThisRound++;
    },
  });
  live.recoverOrphans();
  const api = await startOwnerApi({ store, port: 0, chooser: chooser.choose, live });
  const base = `http://localhost:${api.port}`;
  const signIn = await demoFetch(`${base}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: "viewer", password: "correct horse battery" }) });
  const token = ((await signIn.json()) as { token: string }).token;

  // The stall timer and the viewer, running through both rounds.
  let running = true;
  let last = performance.now();
  const timer = setInterval(() => {
    const t = performance.now();
    (current as PhaseLog | null)?.stalls.push(t - last - 10);
    last = t;
  }, 10);
  const viewer = (async () => {
    while (running) {
      const t = performance.now();
      const res = await demoFetch(`${base}/api/live`, { headers: { Authorization: `Bearer ${token}` } });
      await res.text();
      (current as PhaseLog | null)?.latencies.push(performance.now() - t);
      await new Promise((r) => setTimeout(r, 100));
    }
  })();

  const rounds: { round: number; rebuilt: number; pairs: number }[] = [];
  for (round = 1; round <= 2; round++) {
    begin(round, "rebuilds");
    rebuiltThisRound = 0;
    await live.tick();
    (current as PhaseLog | null)!.end = performance.now();
    current = null;
    rounds.push({ round, rebuilt: rebuiltThisRound, pairs: live.liveMatches().length });
    // Let every match finish (the clock jumps; the viewer keeps polling).
    clock.t += 60 * 60_000;
    await live.tick();
    clock.t += 60 * 60_000; // past the round gap, so the next tick starts round 2
  }
  running = false;
  clearInterval(timer);
  await viewer;

  say(`## ${n} house owners (${asking} agent decks built under the plain rule, so they ask to rebuild)`);
  say();
  say("round  phase      wall     longest stall   API answers   API time p50 / p99 / max");
  for (const { round: r, phase, log } of phases) {
    const wall = log.end - log.start;
    const stall = Math.max(0, ...log.stalls);
    const l = log.latencies;
    say(
      `${String(r).padEnd(6)} ${phase.padEnd(10)} ${sec(wall).padStart(7)}  ${`${stall.toFixed(0)} ms`.padStart(12)}   ${String(l.length).padStart(10)}   ${
        l.length ? `${pct(l, 0.5).toFixed(0)} / ${pct(l, 0.99).toFixed(0)} / ${Math.max(...l).toFixed(0)} ms` : "none answered"
      }`,
    );
  }
  for (const r of rounds) say(`round ${r.round}: ${r.rebuilt} decks rebuilt, ${r.pairs} matches played, then shown`);
  say();
  await live.stop();
  await api.close();
  await chooser.terminateAll();
  store.close();
}
say(`connection resets retried by the viewer: ${demoFetchRetries}`);
