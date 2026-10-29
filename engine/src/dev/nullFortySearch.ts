// Null's 4 added cards (owner 2026-10-26 and 2026-10-29: every starter deck
// is the same size, so Null's 36-card list grows to 40; the 4 cards are
// chosen in the pre-launch test-only balance session and go to an owner
// check-in with their full results). TEST ONLY: this never changes a card,
// a deck or a rule. It measures candidate 40-card Null lists.
//
// What can be added: one more copy of a Null card under its copy limit, or
// a neutral-pool card (the neutral cap and the pool lint still apply, since
// every list goes through buildDeck). Zero-Day cards are left out: they are
// secret cards, never in a starter.
//
// Objective (the same as neutralPackageSearch.ts's): for each of Null's
// three ring edges, the distance from the edge's win rate to its band (0
// inside the band), squared and summed, in BOTH ring modes (gate: decks
// only; real: an approved signature card per side). A card that moves
// Null's edges toward their bands lowers it. Guard: an add may not lower
// Null's mean win rate (over its six measurements) by more than
// MAX_MEAN_DROP, so the search can't reach the bands by padding with blanks.
//
// Two steps:
//   search: from the 36, measure every legal single add on the SEARCH seeds
//     (from SEARCH_FIRST, far from the ring's), take the best that passes the
//     guard, and repeat until 40. Step 1's table is the single-card screen.
//     Each step also keeps a runner-up, so the held-out step has more than
//     one greedy line to compare.
//   heldout: candidate 40-card lists against the 36 on the ring check's own
//     seeds (from 1; 2,500 per win/lose edge, 900 per even edge), both modes,
//     with Wilson intervals and band verdicts. These seeds never steer the
//     search, so they are an honest check on its picks. The same numbers are
//     what `npm run ring`/`ring:real` would print with that list shipped
//     (measurePairing with Null's builder replaced is exactly the ring's run).
//
//   npx tsx src/dev/nullFortySearch.ts search [--seeds 1000] [--out f.json]
//   npx tsx src/dev/nullFortySearch.ts heldout --sets f.json [--first 1] [--out f.json]
//   npx tsx src/dev/nullFortySearch.ts pool a.json b.json ...              (heldout files on different seed blocks, pooled)
//   npx tsx src/dev/nullFortySearch.ts built label=dir ...                  (built-deck rings side by side, from builtDeckRing.ts ring files)
//   npx tsx src/dev/nullFortySearch.ts measure <adds> --first F --seeds N   (one child process's work)
//
// <adds> is card ids joined by commas (a card twice is two copies). The
// script runs its measurements in WORKERS child processes.

import { spawn } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeckFaction } from "../cards/types.js";
import { buildDeck, buildCortexDeck, buildSwarmDeck, buildAegisDeck } from "../data/decks.js";
import { getCard, CARD_REGISTRY } from "../data/registry.js";
import { bandVerdict, measurePairing, newcombeDiff, ringBand, shippedPool, wilson, type DeckBuilder, type Pool, type SignatureMode } from "./edgeMeasure.js";
import { RING_EDGES, edgeName } from "./ringRegression.js";

const SELF: DeckFaction = "Null";
const TARGET = 40;
const SEARCH_FIRST = 300_001;
const MAX_MEAN_DROP = 0.005;
const WORKERS = 4;
const MODES: { mode: SignatureMode; label: string }[] = [
  { mode: "none", label: "gate" },
  { mode: "approved", label: "real" },
];
/** Null's three ring edges, as the ring check measures them. */
const NULL_EDGES = RING_EDGES.filter((e) => e.self === SELF || e.opponent === SELF);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
}

/** The shipped Null list plus `adds` (card ids; repeats are copies). */
export function withAdds(adds: readonly string[]): Pool {
  const pool = shippedPool(SELF);
  for (const id of adds) {
    const card = getCard(id);
    if (!card) throw new Error(`no card "${id}"`);
    const entry = pool.find((p) => p.card.id === id);
    if (entry) entry.copies++;
    else pool.push({ card, copies: 1 });
  }
  return pool;
}

/** Whether buildDeck accepts the list (copy limits, neutral cap, pool lint, size). */
export function legal(pool: Pool): boolean {
  try {
    buildDeck("p1", "candidate", pool);
    return true;
  } catch {
    return false;
  }
}

/** Every card one more copy of which could join a Null list. */
export function addable(): string[] {
  return [...CARD_REGISTRY.values()]
    .filter((c) => (c.faction === SELF || c.faction === "Neutral") && !c.topTier)
    .map((c) => c.id)
    .sort();
}

export interface EdgeCount {
  edge: string;
  mode: string;
  selfWins: number;
  games: number;
}

/** Null's three ring edges in both modes for one list, on [first, first + seeds)
 * (`seeds` 0 means the ring check's own counts). */
async function measureList(adds: readonly string[], first: number, seeds: number): Promise<EdgeCount[]> {
  const pool = withAdds(adds);
  const builders: Record<DeckFaction, DeckBuilder> = {
    Cortex: buildCortexDeck,
    Swarm: buildSwarmDeck,
    Aegis: buildAegisDeck,
    Null: (id, name) => buildDeck(id, name, pool),
  };
  const out: EdgeCount[] = [];
  for (const { mode, label } of MODES) {
    for (const e of NULL_EDGES) {
      const r = await measurePairing(e.self, e.opponent, first, seeds || e.seeds, { builders, signature: mode });
      out.push({ edge: edgeName(e), mode: label, selfWins: r.selfWins, games: r.games });
    }
  }
  return out;
}

/** Null's own win rate on an edge (the ring names some edges from the other side). */
function nullRate(c: EdgeCount): number {
  const e = NULL_EDGES.find((x) => edgeName(x) === c.edge)!;
  const r = c.selfWins / c.games;
  return e.self === SELF ? r : 1 - r;
}

function miss(c: EdgeCount): number {
  const e = NULL_EDGES.find((x) => edgeName(x) === c.edge)!;
  const band = ringBand(e.self, e.opponent);
  const r = c.selfWins / c.games;
  return r < band.lo ? band.lo - r : r > band.hi ? r - band.hi : 0;
}

export interface Score {
  adds: string[];
  objective: number;
  mean: number;
  edges: EdgeCount[];
}

function score(adds: string[], edges: EdgeCount[]): Score {
  return {
    adds,
    objective: edges.reduce((s, c) => s + miss(c) ** 2, 0),
    mean: edges.reduce((s, c) => s + nullRate(c), 0) / edges.length,
    edges,
  };
}

/** Measures every list in `lists` across WORKERS child processes. */
async function measureMany(lists: string[][], first: number, seeds: number): Promise<Score[]> {
  const self = fileURLToPath(import.meta.url);
  const results: Score[] = new Array(lists.length);
  let next = 0;
  const run = async (): Promise<void> => {
    while (next < lists.length) {
      const i = next++;
      const adds = lists[i]!;
      const text = await new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, [...process.execArgv, self, "measure", adds.join(",") || "-", "--first", String(first), "--seeds", String(seeds)], {
          stdio: ["ignore", "pipe", "inherit"],
        });
        let buf = "";
        child.stdout.on("data", (d) => (buf += d));
        child.on("exit", (code) => (code === 0 ? resolve(buf) : reject(new Error(`measure ${adds.join(",")} exited ${code}`))));
      });
      results[i] = score(adds, JSON.parse(text) as EdgeCount[]);
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, run));
  return results;
}

const pct = (x: number) => (x * 100).toFixed(1);
const names = (adds: readonly string[]) => (adds.length ? adds.map((id) => getCard(id)!.name).join(" + ") : "(the 36 as shipped)");
const rates = (s: Score) => MODES.map(({ label }) => `${label} ${s.edges.filter((c) => c.mode === label).map((c) => pct(c.selfWins / c.games)).join("/")}`).join("  ");
const line = (s: Score) => `obj ${(s.objective * 1e4).toFixed(1).padStart(6)}  Null mean ${pct(s.mean)}  ${rates(s)}`;

function size(pool: Pool): number {
  return pool.reduce((n, p) => n + p.copies, 0);
}

async function search(): Promise<void> {
  const seeds = Number(arg("seeds") ?? 1000);
  const outPath = arg("out");
  const start = shippedPool(SELF);
  console.log(`Null's 4 added cards: greedy search on seeds ${SEARCH_FIRST}-${SEARCH_FIRST + seeds - 1} (${seeds} per edge per mode)`);
  console.log(`Edges: ${NULL_EDGES.map(edgeName).join(", ")}; modes gate and real. Objective: squared band misses summed (x1e4).`);
  console.log(`Edge rates are the first-named side's, in the order above. Guard: Null's mean may not drop more than ${pct(MAX_MEAN_DROP)} points per add.\n`);
  const [base] = await measureMany([[]], SEARCH_FIRST, seeds);
  console.log(`start (36 cards): ${line(base!)}\n`);
  const steps: { step: number; from: string[]; tried: Score[]; picked: string[]; runnerUp?: string[] }[] = [];
  // Two greedy lines: the best pick each step, and one that takes the
  // runner-up at step 1 then goes greedy (a single greedy line can be led
  // off by one noisy first pick).
  const lines: { label: string; adds: string[]; current: Score }[] = [];
  let current = base!;
  let adds: string[] = [];
  let firstRunnerUp: string[] | undefined;
  for (let step = 1; size(withAdds(adds)) < TARGET; step++) {
    const options = addable().filter((id) => legal(withAdds([...adds, id])));
    const tried = (await measureMany(options.map((id) => [...adds, id]), SEARCH_FIRST, seeds)).sort((a, b) => a.objective - b.objective || b.mean - a.mean);
    console.log(`-- step ${step}: from ${names(adds)} (${size(withAdds(adds))} cards), ${tried.length} legal adds --`);
    for (const s of tried) console.log(`  ${(" +" + getCard(s.adds.at(-1)!)!.name).padEnd(24)} ${line(s)}${s.mean < current.mean - MAX_MEAN_DROP ? "  (guard)" : ""}`);
    const ok = tried.filter((s) => s.mean >= current.mean - MAX_MEAN_DROP);
    const pick = ok[0] ?? tried.sort((a, b) => b.mean - a.mean)[0]!;
    if (step === 1 && ok[1]) firstRunnerUp = ok[1].adds;
    console.log(`  => +${getCard(pick.adds.at(-1)!)!.name}${ok[0] ? "" : " (none passed the guard: the highest mean)"}\n`);
    steps.push({ step, from: adds, tried, picked: pick.adds, runnerUp: ok[1]?.adds });
    adds = pick.adds;
    current = pick;
  }
  lines.push({ label: "greedy", adds, current });
  if (firstRunnerUp) {
    let a = firstRunnerUp;
    let cur = steps[0]!.tried.find((s) => s.adds.join() === a.join())!;
    console.log(`-- second line: step 1's runner-up (+${getCard(a[0]!)!.name}), then greedy --`);
    while (size(withAdds(a)) < TARGET) {
      const options = addable().filter((id) => legal(withAdds([...a, id])));
      const tried = (await measureMany(options.map((id) => [...a, id]), SEARCH_FIRST, seeds)).sort((x, y) => x.objective - y.objective || y.mean - x.mean);
      const ok = tried.filter((s) => s.mean >= cur.mean - MAX_MEAN_DROP);
      const pick = ok[0] ?? tried.sort((x, y) => y.mean - x.mean)[0]!;
      console.log(`  +${getCard(pick.adds.at(-1)!)!.name.padEnd(22)} ${line(pick)}  (best of ${tried.length})`);
      a = pick.adds;
      cur = pick;
    }
    lines.push({ label: "runner-up line", adds: a, current: cur });
    console.log("");
  }
  console.log("== the search's 40-card lists ==");
  for (const l of lines) console.log(`  ${l.label}: ${names(l.adds)}\n    ${line(l.current)}`);
  if (outPath) writeFileSync(outPath, JSON.stringify({ seeds, first: SEARCH_FIRST, base, steps, lines: lines.map((l) => ({ label: l.label, adds: l.adds, score: l.current })) }, null, 1) + "\n");
}

async function heldout(): Promise<void> {
  const setsPath = arg("sets");
  if (!setsPath) throw new Error("heldout needs --sets f.json ({ \"label\": [card ids] })");
  const sets = JSON.parse(readFileSync(setsPath, "utf8")) as Record<string, string[]>;
  const labels = ["the 36 (shipped)", ...Object.keys(sets)];
  const lists = [[], ...Object.values(sets)];
  for (const [i, l] of lists.entries()) if (i > 0 && (!legal(withAdds(l)) || size(withAdds(l)) !== TARGET)) throw new Error(`${labels[i]} is not a legal 40-card list`);
  // --first moves the block (a repeat on fresh seeds); the counts stay the ring's.
  const first = Number(arg("first") ?? 1);
  const scores = await measureMany(lists, first, 0);
  console.log(`Held-out: ${first === 1 ? "the ring check's own seeds (from 1" : `fresh seeds (from ${first}`}; 2,500 per win/lose edge, 900 per even edge), Lookahead vs Lookahead.`);
  console.log("Rates are the first-named side's; [95% Wilson]; verdict against the ring band. Only Null's list differs; the other three edges cannot move.\n");
  for (const [i, s] of scores.entries()) {
    console.log(`${labels[i]}${i > 0 ? `: ${names(s.adds)}` : ""}`);
    for (const c of s.edges) {
      const e = NULL_EDGES.find((x) => edgeName(x) === c.edge)!;
      const w = wilson(c.selfWins, c.games);
      const v = bandVerdict(c.selfWins, c.games, ringBand(e.self, e.opponent));
      const b = scores[0]!.edges.find((x) => x.edge === c.edge && x.mode === c.mode)!;
      const d = c.selfWins / c.games - b.selfWins / b.games;
      console.log(`  ${c.mode.padEnd(4)} ${c.edge.padEnd(14)} ${pct(c.selfWins / c.games)} [${pct(w.lo)}-${pct(w.hi)}] ${v.padEnd(11)}${i > 0 ? ` change ${d >= 0 ? "+" : ""}${pct(d)}` : ""}`);
    }
    console.log(`  objective ${(s.objective * 1e4).toFixed(1)}, Null mean ${pct(s.mean)}\n`);
  }
  const outPath = arg("out");
  if (outPath) writeFileSync(outPath, JSON.stringify(Object.fromEntries(scores.map((s, i) => [labels[i], s])), null, 1) + "\n");
}

/** Pools several heldout files (the same lists on different seed blocks):
 * per edge and mode the summed games, the change from the 36 with its
 * Newcombe 95% interval, and Null's mean over all of them. One block's
 * noise (about 1 point on an edge) is what pooling is for. */
function pooled(): void {
  const files = process.argv.slice(3).filter((a) => !a.startsWith("--"));
  const all = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as Record<string, Score>);
  const labels = Object.keys(all[0]!);
  const total = (label: string): EdgeCount[] =>
    all[0]![label]!.edges.map((c, i) => ({ ...c, selfWins: all.reduce((n, f) => n + f[label]!.edges[i]!.selfWins, 0), games: all.reduce((n, f) => n + f[label]!.edges[i]!.games, 0) }));
  const base = score([], total(labels[0]!));
  console.log(`Pooled over ${files.length} seed blocks (${files.join(", ")}). Change from the 36 per edge, first-named side, [Newcombe 95%].\n`);
  console.log(`${"list".padEnd(24)}${base.edges.map((c) => `${c.mode} ${c.edge}`.padStart(21)).join("")}   Null mean (change)   objective`);
  for (const label of labels) {
    const s = score(all[0]![label]!.adds, total(label));
    const cells = s.edges.map((c, i) => {
      const b = base.edges[i]!;
      if (label === labels[0]) return `${pct(c.selfWins / c.games)} (${c.games})`.padStart(21);
      const d = newcombeDiff(c.selfWins, c.games, b.selfWins, b.games);
      return `${d.diff >= 0 ? "+" : ""}${pct(d.diff)} [${pct(d.lo)},${pct(d.hi)}]`.padStart(21);
    });
    const m = label === labels[0] ? pct(s.mean) : `${pct(s.mean)} (${s.mean >= base.mean ? "+" : ""}${pct(s.mean - base.mean)})`;
    console.log(`${label.slice(0, 23).padEnd(24)}${cells.join("")}   ${m.padEnd(19)}  ${(s.objective * 1e4).toFixed(1)}`);
  }
}

/** Built-deck rings side by side (builtDeckRing.ts ring files, one
 * directory per run, given as label=dir): each faction's mean over its three
 * edges, and Null's three edges, per mode and collection level. */
function builtSideBySide(): void {
  const runs = process.argv.slice(3).map((a) => {
    const [label, dir] = a.split("=") as [string, string];
    const rings = readdirSync(join(dir, "rings")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, "rings", f), "utf8")) as { level: string; mode: string; edges: { edge: string; selfWins: number; games: number }[] });
    return { label, rings };
  });
  const levels = ["full", "37", "17", "3"];
  for (const mode of ["real", "gate"]) {
    console.log(`== ${mode === "real" ? "REAL-MATCH MODE" : "GATE MODE"} ==`);
    const rows: [string, (rates: Map<string, number>) => number][] = [
      ...(["Cortex", "Swarm", "Aegis", "Null"] as const).map((f): [string, (rates: Map<string, number>) => number] => [
        `${f} mean`,
        (rates) => RING_EDGES.reduce((s, e) => s + (e.self === f ? rates.get(edgeName(e))! : e.opponent === f ? 1 - rates.get(edgeName(e))! : 0), 0) / 3,
      ]),
      ...NULL_EDGES.map((e): [string, (rates: Map<string, number>) => number] => [edgeName(e), (rates) => rates.get(edgeName(e))!]),
    ];
    console.log(`${"".padEnd(16)}${runs.map((r) => r.label.padStart(26)).join("")}`);
    console.log(`${"".padEnd(16)}${runs.map(() => levels.map((l) => (l === "full" ? "full" : `${l}p`).padStart(6)).join("").padStart(26)).join("")}`);
    for (const [name, f] of rows) {
      const cells = runs.map((r) =>
        levels
          .map((l) => {
            const ring = r.rings.find((x) => x.level === l && x.mode === mode);
            if (!ring) return "-".padStart(6);
            return pct(f(new Map(ring.edges.map((e) => [e.edge, e.selfWins / e.games])))).padStart(6);
          })
          .join("")
          .padStart(26),
      );
      console.log(`${name.padEnd(16)}${cells.join("")}`);
    }
    console.log("");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cmd = process.argv[2];
  if (cmd === "measure") {
    const raw = process.argv[3]!;
    const adds = raw === "-" ? [] : raw.split(",");
    process.stdout.write(JSON.stringify(await measureList(adds, Number(arg("first")), Number(arg("seeds")))));
  } else if (cmd === "search") await search();
  else if (cmd === "heldout") await heldout();
  else if (cmd === "pool") pooled();
  else if (cmd === "built") builtSideBySide();
  else throw new Error("usage: search [--seeds N] [--out f] | heldout --sets f.json [--out f] | measure <adds> --first F --seeds N");
}
