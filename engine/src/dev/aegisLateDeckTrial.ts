// Option C of the session-44 check-in (owner 2026-10-19): "Try an Aegis deck
// change that adds late-game plays using real Aegis cards (not test
// stand-ins), so Aegis's late turns aren't empty and a signature card adds
// less. Measure it on all six edges of the real-match ring, and the gate.
// Test only. Don't put any deck or card change in without the owner's OK."
//
// NO DECK OR CARD IS CHANGED by this file. Each trial is a copy-count change
// to the shipped Aegis list, built through buildDeck, so the copy limits,
// deck size, neutral cap and pool lint apply exactly as to a real deck. The
// Aegis list is already 40 of 40 cards and runs every Aegis card, so a trial
// can only raise a card already in it, paid for by cutting a cheap one.
//
// Each trial is judged the way CI judges the ring (ringRegression.ts's
// judgeEdge): the gate against ringBaseline.json, the real-match mode
// (set Mythic in the deck, an approved menu line each side) against
// ringBaselineReal.json. The three edges without Aegis never see the Aegis
// deck, so they cannot move; they are measured once, shipped, to show both
// baselines reproduce.
//
//   npx tsx src/dev/aegisLateDeckTrial.ts [--confirm <seeds> <keys>]
// --confirm re-measures the shipped list and the named trials (comma
// separated, e.g. C3,N1) on the three Aegis edges at <seeds> per cell.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildDeck } from "../data/decks.js";
import { AEGIS_CARDS } from "../data/aegisCards.js";
import { NEUTRAL_POOL } from "../data/neutralCards.js";
import { ringBand } from "./edgeMeasure.js";
import { RING_EDGES, edgeName, judgeEdge, type RingEdge, type EdgeMeasurement } from "./ringRegression.js";
import { play, rate, gainText, pct, signed, type Builder, type Run, type Side } from "./signatureGainHarness.js";
import type { Card, DeckFaction as Faction } from "../cards/types.js";

const args = process.argv.slice(2);
const confirmSeeds = args.includes("--confirm") ? Number(args[args.indexOf("--confirm") + 1]) : 0;
const confirmKeys = confirmSeeds > 0 ? (args[args.indexOf("--confirm") + 2] ?? "").split(",").filter(Boolean) : [];
const say = (line = "") => console.log(line);

/** A trial: new copy counts by card name (0 cuts the card), applied to the
 * shipped Aegis list. Neutral cards not in the list are added from the
 * neutral pool by name. */
interface Trial {
  key: string;
  label: string;
  copies: Record<string, number>;
  /** Outside the owner's brief (real cards, but not Aegis cards): shown for comparison only. */
  comparison?: boolean;
}

export const TRIALS: Trial[] = [
  {
    key: "C1",
    label: "one more late play: Lockdown Field 1 -> 2 (cost 4), Barrier Drone 2 -> 1",
    copies: { "Lockdown Field": 2, "Barrier Drone": 1 },
  },
  {
    key: "C2",
    label: "every Aegis Rare at its cap: Lockdown Field, Tariff Field, Latent Ward, Barrier Shim 1 -> 2; Barrier Drone and Aegis Line Trooper 2 -> 0",
    copies: { "Lockdown Field": 2, "Tariff Field": 2, "Latent Ward": 2, "Barrier Shim": 2, "Barrier Drone": 0, "Aegis Line Trooper": 0 },
  },
  {
    key: "C3",
    label: "the heaviest all-Aegis list: C2, plus Static Ward Beacon 1 -> 3 and Reinforced Bastion 2 -> 3; Plating Module 3 -> 0",
    copies: {
      "Lockdown Field": 2, "Tariff Field": 2, "Latent Ward": 2, "Barrier Shim": 2, "Barrier Drone": 0, "Aegis Line Trooper": 0,
      "Static Ward Beacon": 3, "Reinforced Bastion": 3, "Plating Module": 0,
    },
  },
  {
    key: "C4",
    label: "C3, but the 1-cost cuts fall on the Cadets instead of Plating Module (Aegis Cadet 3 -> 0, Plating Module stays 3)",
    copies: {
      "Lockdown Field": 2, "Tariff Field": 2, "Latent Ward": 2, "Barrier Shim": 2, "Barrier Drone": 0, "Aegis Line Trooper": 0,
      "Static Ward Beacon": 3, "Reinforced Bastion": 3, "Aegis Cadet": 0,
    },
  },
  {
    key: "N1",
    label: "comparison, neutral cards: Cache Warmup 0 -> 2 (cost 3, draw two), Uplink Tower 1 -> 2; Barrier Drone 2 -> 0, Aegis Line Trooper 2 -> 1",
    copies: { "Cache Warmup": 2, "Uplink Tower": 2, "Barrier Drone": 0, "Aegis Line Trooper": 1 },
    comparison: true,
  },
  {
    key: "N2",
    label: "comparison, card draw alone: Cache Warmup 0 -> 2; Barrier Drone 2 -> 0",
    copies: { "Cache Warmup": 2, "Barrier Drone": 0 },
    comparison: true,
  },
];

type Pool = { card: Card; copies: number }[];

/** The shipped Aegis list with a trial's copy counts applied. Throws on a
 * card name that is in neither the list nor the neutral pool. */
export function trialPool(copies: Record<string, number>): Pool {
  const pool: Pool = AEGIS_CARDS.map((p) => ({ card: p.card, copies: copies[p.card.name] ?? p.copies }));
  for (const name of Object.keys(copies)) {
    if (pool.some((p) => p.card.name === name)) continue;
    const card = NEUTRAL_POOL.find((c) => c.name === name);
    if (!card) throw new Error(`trial names "${name}", which is neither in the Aegis list nor the neutral pool`);
    pool.push({ card, copies: copies[name]! });
  }
  return pool.filter((p) => p.copies > 0);
}

const builderFor = (pool: Pool): Builder => (id, name) => buildDeck(id, name, pool);

/** Mean cost and the count of 4+ cost cards in a built list. */
function curve(pool: Pool): string {
  const cards = pool.flatMap((p) => Array<Card>(p.copies).fill(p.card));
  const mean = cards.reduce((m, c) => m + c.cost, 0) / cards.length;
  const n = (lo: number, hi = 99) => cards.filter((c) => c.cost >= lo && c.cost <= hi).length;
  return `${cards.length} cards, mean cost ${mean.toFixed(2)}; cost 1: ${n(1, 1)}, 2: ${n(2, 2)}, 3: ${n(3, 3)}, 4+: ${n(4)}`;
}

const here = (f: string) => fileURLToPath(new URL(f, import.meta.url));
const loadBaseline = (f: string): EdgeMeasurement[] => JSON.parse(readFileSync(here(f), "utf8")).edges;
const GATE_BASE = loadBaseline("./ringBaseline.json");
const REAL_BASE = loadBaseline("./ringBaselineReal.json");
const baseOf = (list: EdgeMeasurement[], e: RingEdge) => list.find((b) => b.edge === edgeName(e))!;

const aegisEdges = RING_EDGES.filter((e) => e.self === "Aegis" || e.opponent === "Aegis");
const otherEdges = RING_EDGES.filter((e) => !aegisEdges.includes(e));
const asMeasurement = (e: RingEdge, r: Run): EdgeMeasurement => ({ edge: edgeName(e), selfWins: r.side[e.self].wins, games: r.games });

/** The three runs a trial needs on one Aegis edge. */
interface EdgeRuns {
  gate: Run;
  onlyAegis: Run;
  real: Run;
}
async function measure(e: RingEdge, builders: Partial<Record<Faction, Builder>> | undefined, n = e.seeds): Promise<EdgeRuns> {
  const opp = e.self === "Aegis" ? e.opponent : e.self;
  return {
    gate: await play(e, { sig: new Set(), builders }, n),
    onlyAegis: await play(e, { sig: new Set<Faction>(["Aegis"]), builders }, n),
    real: await play(e, { sig: new Set<Faction>(["Aegis", opp]), builders }, n),
  };
}

const lateLeft = (s: Side) => (s.lateTurns ? s.lateUnspent / s.lateTurns : 0);
const emptyHand = (s: Side) => (s.lateTurns ? s.lateEmptyHand / s.lateTurns : 0);
const opponentOf = (e: RingEdge) => (e.self === "Aegis" ? e.opponent : e.self);

/** Prints a trial's (or the shipped list's) table: per Aegis edge, the gate
 * and real-match rates judged against the baselines, Aegis's signature gain
 * and late spare energy. Returns whether every edge passes both checks. */
function report(label: string, runs: Map<RingEdge, EdgeRuns>, shipped?: Map<RingEdge, EdgeRuns>): { pass: boolean; nullAegisReal: number; meanGain: number } {
  say(`  ${label}`);
  let pass = true, gainSum = 0;
  for (const e of aegisEdges) {
    const r = runs.get(e)!;
    const jg = judgeEdge(e, asMeasurement(e, r.gate), baseOf(GATE_BASE, e));
    const jr = judgeEdge(e, asMeasurement(e, r.real), baseOf(REAL_BASE, e));
    pass &&= jg.pass && jr.pass;
    const a = (run: Run) => run.side.Aegis;
    const gain = rate(a(r.onlyAegis)) - rate(a(r.gate));
    gainSum += gain;
    const cell = (j: typeof jg) => `${pct(j.rate)}% ${j.verdict.padEnd(11)} ${signed(j.change.diff).padStart(5)} ${j.pass ? "PASS" : "FAIL"}`;
    say(`    ${edgeName(e).padEnd(15)} gate ${cell(jg)}   real ${cell(jr)}`);
    const sh = shipped?.get(e);
    const shippedLine = sh ? `  (shipped ${signed(rate(a(sh.onlyAegis)) - rate(a(sh.gate)))}; ${lateLeft(a(sh.gate)).toFixed(2)} left, empty hand ${pct(emptyHand(a(sh.gate)))}%)` : "";
    say(`    ${"".padEnd(15)} Aegis vs ${opponentOf(e).padEnd(6)} signature gain ${gainText(a(r.onlyAegis), a(r.gate))}  late turns (gate): ${lateLeft(a(r.gate)).toFixed(2)} energy left, 3+ ${pct(a(r.gate).lateFloat3 / a(r.gate).lateTurns)}%, empty hand ${pct(emptyHand(a(r.gate)))}%${shippedLine}`);
    if (jg.pass && jr.pass) continue;
    say(`    ${"".padEnd(15)} ${[jg, jr].filter((j) => !j.pass).map((j) => j.why).join("; ")}`);
  }
  const nullAegis = runs.get(aegisEdges.find((e) => e.self === "Null")!)!.real;
  const meanGain = gainSum / aegisEdges.length;
  say(`    -> CI ${pass ? "PASS" : "FAIL"} on both checks; Aegis's mean signature gain ${signed(meanGain)}`);
  return { pass, nullAegisReal: rate(nullAegis.side.Null), meanGain };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t0 = Date.now();
  say("# Option C: an Aegis list with more late plays, built only from real cards (test only; nothing is written)");
  say("# Ring seeding, current LookaheadAgent both sides; the ring's own seed counts (2,500 a W edge, 900 an even edge).");
  say("# Gate = no signature cards, judged against ringBaseline.json. Real = set Mythic in the deck and an approved");
  say("# menu line each side, judged against ringBaselineReal.json. Each cell: rate, verdict, change from the");
  say("# baseline, and what CI's rule says. Signature gain = Aegis's rate holding one alone minus the gate (Newcombe 95%).");
  say();

  say("== 1. The three edges without Aegis: shipped, both modes (a trial cannot move them) ==");
  for (const e of otherEdges) {
    const g = await play(e, { sig: new Set() }, e.seeds);
    const r = await play(e, { sig: new Set<Faction>([e.self, e.opponent]) }, e.seeds);
    const jg = judgeEdge(e, asMeasurement(e, g), baseOf(GATE_BASE, e));
    const jr = judgeEdge(e, asMeasurement(e, r), baseOf(REAL_BASE, e));
    const same = (j: typeof jg, b: EdgeMeasurement) => (Math.abs(j.rate - b.selfWins / b.games) < 1e-12 ? "= baseline" : "DIFFERS from baseline");
    say(`  ${edgeName(e).padEnd(15)} gate ${pct(jg.rate)}% ${jg.verdict.padEnd(11)} ${same(jg, baseOf(GATE_BASE, e))}   real ${pct(jr.rate)}% ${jr.verdict.padEnd(11)} ${same(jr, baseOf(REAL_BASE, e))}`);
  }
  say();

  say("== 2. The Aegis lists ==");
  say(`  shipped  ${curve(AEGIS_CARDS)}`);
  for (const t of TRIALS) {
    builderFor(trialPool(t.copies))("p1", `Aegis ${t.key}`); // throws unless it is a legal deck
    say(`  ${t.key.padEnd(8)} ${curve(trialPool(t.copies))}, builds and lints${t.comparison ? "  (comparison)" : ""}`);
  }
  say();

  say("== 3. The three Aegis edges, shipped and per trial ==");
  const shipped = new Map<RingEdge, EdgeRuns>();
  for (const e of aegisEdges) shipped.set(e, await measure(e, undefined));
  const base = report("shipped Aegis list (must reproduce both baselines)", shipped);
  say();
  const results: { t: Trial; r: ReturnType<typeof report> }[] = [];
  for (const t of TRIALS) {
    const builders = { Aegis: builderFor(trialPool(t.copies)) };
    const runs = new Map<RingEdge, EdgeRuns>();
    for (const e of aegisEdges) runs.set(e, await measure(e, builders));
    results.push({ t, r: report(`${t.key}: ${t.label}${t.comparison ? " [outside the brief: not Aegis cards]" : ""}`, runs, shipped) });
    say();
  }

  say("== 4. Summary: Null > Aegis in the real-match mode (band 55-60) ==");
  say(`  shipped  ${pct(base.nullAegisReal)}%   Aegis signature gain ${signed(base.meanGain)}`);
  for (const { t, r } of results) {
    say(`  ${t.key.padEnd(8)} ${pct(r.nullAegisReal)}% (${signed(r.nullAegisReal - base.nullAegisReal)})   Aegis signature gain ${signed(r.meanGain)}   CI ${r.pass ? "PASS" : "FAIL"}${t.comparison ? "  (comparison)" : ""}`);
  }
  say();

  if (confirmSeeds > 0) {
    say(`== 5. Confirmation at ${confirmSeeds} seeds a cell: shipped vs ${confirmKeys.join(", ")} on the Aegis edges ==`);
    say("  Each cell: the edge's first-named faction's rate, and the trial's change from shipped (Newcombe 95%).");
    const lists: { key: string; builders?: Partial<Record<Faction, Builder>> }[] = [
      { key: "shipped" },
      ...confirmKeys.map((key) => ({ key, builders: { Aegis: builderFor(trialPool(TRIALS.find((t) => t.key === key)!.copies)) } })),
    ];
    for (const e of aegisEdges) {
      const band = ringBand(e.self, e.opponent);
      say(`  ${edgeName(e)} (band ${pct(band.lo)}-${pct(band.hi)})`);
      for (const [mode, sig] of [["real", new Set<Faction>(["Aegis", opponentOf(e)])], ["gate", new Set<Faction>()]] as const) {
        const rs: Run[] = [];
        for (const l of lists) rs.push(await play(e, { sig, builders: l.builders }, confirmSeeds));
        const cells = rs.map((r, i) => `${lists[i]!.key} ${pct(rate(r.side[e.self]))}%${i ? ` (${gainText(r.side[e.self], rs[0]!.side[e.self]).trim()})` : ""}`);
        say(`    ${mode.padEnd(4)} ${cells.join("   ")}`);
      }
    }
    say();
  }
  say(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
