// The standing balance regression check (owner-feedback 2026-10-04, A.5):
// "the CI band verdicts become the standing check on every change. Any new
// card or set must pass it before entering packs. No more open-ended tuning
// sessions." Built session 27, when Phase 5 closed.
//
// It measures the six ring edges at the gate's seed counts (2,500 seeds for
// the win/lose edges, 900 for the two even ones; Lookahead vs Lookahead,
// measurePairing's seeding) and compares each with the recorded Phase 5
// baseline in ringBaseline.json. An edge FAILS when:
//   1. its band verdict gets worse (IN > UNRESOLVED > OUT), or
//   2. it was already OUT at the baseline (the owner accepted Null > Aegis
//      and Aegis > Cortex as OUT on 2026-10-04) and it moves further from
//      its band by a real amount (the Newcombe 95% interval on the change
//      excludes zero).
// Anything else passes, including a real move toward or inside the band.
// Same seeds both times, so an unchanged engine reproduces the baseline
// exactly; any difference comes from the change under test.
//
// When a change is deliberate and owner-approved (a buff, a new set), rerun
// with --write-baseline and commit the new baseline next to the balance
// report that justifies it, so the baseline only ever moves on purpose.
//
// Usage:
//   npx tsx src/dev/ringRegression.ts                  all six edges
//   npx tsx src/dev/ringRegression.ts --write-baseline measure all six and record them
// Exit code 1 on any failing edge. All six edges (11,800 games) take about
// 15 seconds, so CI runs the whole thing on every engine change
// (.github/workflows/test.yml).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { measurePairing, wilson, bandVerdict, ringBand, newcombeDiff } from "./edgeMeasure.js";
import type { DeckFaction as Faction } from "../cards/types.js";

export interface RingEdge {
  /** The side whose win rate the band is about (the predator for a W edge). */
  self: Faction;
  opponent: Faction;
  seeds: number;
}

/** The six edges in the order of the gate table (balance-report-020). */
export const RING_EDGES: RingEdge[] = [
  { self: "Null", opponent: "Aegis", seeds: 2500 },
  { self: "Aegis", opponent: "Cortex", seeds: 2500 },
  { self: "Cortex", opponent: "Swarm", seeds: 2500 },
  { self: "Swarm", opponent: "Null", seeds: 2500 },
  { self: "Null", opponent: "Cortex", seeds: 900 },
  { self: "Aegis", opponent: "Swarm", seeds: 900 },
];

type Verdict = ReturnType<typeof bandVerdict>;
const RANK: Record<Verdict, number> = { "IN BAND": 2, UNRESOLVED: 1, "OUT OF BAND": 0 };

export interface EdgeMeasurement {
  edge: string;
  selfWins: number;
  games: number;
}

export function edgeName(e: RingEdge): string {
  const band = ringBand(e.self, e.opponent);
  return `${e.self} ${band.lo === 0.45 ? "~" : ">"} ${e.opponent}`;
}

/** Distance of a rate from its band (0 inside it). */
function distanceFromBand(rate: number, band: { lo: number; hi: number }): number {
  return rate < band.lo ? band.lo - rate : rate > band.hi ? rate - band.hi : 0;
}

export interface EdgeJudgement {
  edge: string;
  rate: number;
  ci: { lo: number; hi: number };
  verdict: Verdict;
  baseRate: number;
  baseVerdict: Verdict;
  change: { diff: number; lo: number; hi: number };
  pass: boolean;
  why: string;
}

/** Applies the two rules above to one edge. Exported for the unit test. */
export function judgeEdge(e: RingEdge, now: EdgeMeasurement, base: EdgeMeasurement): EdgeJudgement {
  const band = ringBand(e.self, e.opponent);
  const verdict = bandVerdict(now.selfWins, now.games, band);
  const baseVerdict = bandVerdict(base.selfWins, base.games, band);
  const rate = now.selfWins / now.games;
  const baseRate = base.selfWins / base.games;
  const change = newcombeDiff(now.selfWins, now.games, base.selfWins, base.games);
  let pass = true;
  let why = "verdict held or improved";
  if (RANK[verdict] < RANK[baseVerdict]) {
    pass = false;
    why = `verdict worsened: ${baseVerdict} -> ${verdict}`;
  } else if (baseVerdict === "OUT OF BAND") {
    const realChange = change.lo > 0 || change.hi < 0;
    const furtherOut = distanceFromBand(rate, band) > distanceFromBand(baseRate, band);
    if (realChange && furtherOut) {
      pass = false;
      why = "accepted-OUT edge moved further from its band (real change at 95%)";
    } else {
      why = "accepted OUT; did not move further out";
    }
  }
  return { edge: edgeName(e), rate, ci: wilson(now.selfWins, now.games), verdict, baseRate, baseVerdict, change, pass, why };
}

const pct = (x: number) => (x * 100).toFixed(1);

export function formatJudgement(j: EdgeJudgement, games: number): string {
  return (
    `  ${j.edge.padEnd(16)} ${String(games).padStart(5)} seeds  ${pct(j.rate)}% (CI ${pct(j.ci.lo)}-${pct(j.ci.hi)}) ${j.verdict.padEnd(11)}` +
    ` | baseline ${pct(j.baseRate)}% ${j.baseVerdict.padEnd(11)} change ${j.change.diff >= 0 ? "+" : ""}${pct(j.change.diff)} ` +
    `[${pct(j.change.lo)}, ${pct(j.change.hi)}]  ${j.pass ? "PASS" : "FAIL"} (${j.why})`
  );
}

const BASELINE_PATH = fileURLToPath(new URL("./ringBaseline.json", import.meta.url));

interface BaselineFile {
  _about: string;
  recorded: string;
  edges: EdgeMeasurement[];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const write = args.includes("--write-baseline");
  const edges = RING_EDGES;

  const measured: EdgeMeasurement[] = [];
  for (const e of edges) {
    const r = await measurePairing(e.self, e.opponent, 1, e.seeds);
    measured.push({ edge: edgeName(e), selfWins: r.selfWins, games: r.games });
  }

  if (write) {
    const file: BaselineFile = {
      _about:
        "Ring regression baseline (engine/src/dev/ringRegression.ts). selfWins = wins for the first-named faction, " +
        "Lookahead vs Lookahead, seeds 1..games. Only rewrite with --write-baseline for an owner-approved change, " +
        "committed alongside the balance report that justifies it.",
      recorded: new Date().toISOString().slice(0, 10),
      edges: measured,
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(file, null, 2) + "\n");
    console.log(`Wrote ${BASELINE_PATH}`);
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as BaselineFile;
  console.log(`Ring regression vs baseline recorded ${baseline.recorded} (Lookahead vs Lookahead, seeds from 1)`);
  let failed = 0;
  edges.forEach((e, i) => {
    const base = baseline.edges.find((b) => b.edge === edgeName(e));
    if (!base || base.games !== e.seeds) throw new Error(`no baseline for ${edgeName(e)} at ${e.seeds} seeds`);
    const j = judgeEdge(e, measured[i]!, base);
    if (!j.pass) failed++;
    console.log(formatJudgement(j, e.seeds));
  });
  console.log(failed === 0 ? "RING REGRESSION: PASS" : `RING REGRESSION: FAIL (${failed} edge(s))`);
  if (failed > 0) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
