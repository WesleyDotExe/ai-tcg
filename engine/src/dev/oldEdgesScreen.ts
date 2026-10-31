// The balance session's job 2 (session 61, test only): a first screen of
// candidate card fixes for the two old out-of-band edges.
//
//   Null > Aegis    inverted (Aegis wins it): real-match 45.9%, gate 51.6%, band 55-60
//   Cortex > Swarm  under its band in the real-match mode: 53.0% (gate 58.2%)
//
// Owner 2026-10-22 (call 2) and 2026-10-31: "one or two candidate card fixes
// for each of the two old out-of-band edges ... measured on the ring check
// (shipped decks, real-match and gate modes) AND on the built-deck ring at
// every collection level ... TEST ONLY". This file is the first half: it
// screens a wider set of candidates on the ring check, both modes, so the
// one or two per edge that go on to the (slow) built-deck ring are chosen on
// numbers, not guesses. The built-deck ring runs each chosen candidate on a
// throwaway copy of the repo (progress/old-edges/run-candidate.sh).
//
// NO CARD IS CHANGED by this file. A candidate is an erratum applied to the
// card objects in this process only, before any match is played (the decks
// hold the same objects, so every deck and both sides see it).
//
//   npx tsx src/dev/oldEdgesScreen.ts run <key> <firstSeed> [--out file.json]
//   npx tsx src/dev/oldEdgesScreen.ts report <dir> <firstSeed>
//   npx tsx src/dev/oldEdgesScreen.ts list
//
// `run` plays the six ring edges at the ring's own seed counts (2,500 a W
// edge, 900 an even edge) from `firstSeed`, in both modes (gate = no
// signature cards; real = set Mythic in the deck, an approved menu line each
// side). With firstSeed 1 that is exactly the ring check's games, so the
// "shipped" candidate reproduces both baselines. `report` reads every
// <key>-<firstSeed>.json in <dir> and judges each candidate the way CI does
// (judgeEdge against the shipped run at the same seeds), with each edge's
// band verdict.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCard } from "../data/registry.js";
import { CORTEX_CARDS, SWARM_CARDS } from "../data/cards.js";
import { AEGIS_CARDS } from "../data/aegisCards.js";
import { NULL_CARDS } from "../data/nullCards.js";
import { measurePairing, ringBand, bandVerdict, newcombeDiff, type SignatureMode } from "./edgeMeasure.js";
import { RING_EDGES, edgeName, judgeEdge, type EdgeMeasurement } from "./ringRegression.js";
import { CANDIDATES, applyCandidate, candidateLabel, type Candidate } from "./oldEdgesCandidates.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const card = (id: string): any => {
  const c = getCard(id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};

const MODES: { mode: SignatureMode; tag: "gate" | "real" }[] = [
  { mode: "none", tag: "gate" },
  { mode: "approved", tag: "real" },
];

interface RunFile {
  key: string;
  firstSeed: number;
  gate: EdgeMeasurement[];
  real: EdgeMeasurement[];
}

/** An ablation, not a fix: "cut:<card id>" plays the shipped game with one
 * copy of that card taken out of its faction's shipped list (39 cards, a
 * legal deck), to find which cards carry a matchup. */
function ablation(key: string): Candidate | undefined {
  const m = /^cut:(.+)$/.exec(key);
  if (!m) return undefined;
  const id = m[1]!;
  const lists = [CORTEX_CARDS, SWARM_CARDS, AEGIS_CARDS, NULL_CARDS];
  return {
    key, edge: "-", label: `ablation: one copy of ${card(id).name} cut from its faction's list`, why: "",
    apply: () => {
      const owner = lists.find((l) => l.some((p) => p.card.id === id && p.copies > 0));
      if (!owner) throw new Error(`${id} is in no shipped list`);
      owner.find((p) => p.card.id === id)!.copies--;
    },
  };
}

async function run(key: string, firstSeed: number, out?: string): Promise<void> {
  const cut = ablation(key);
  if (cut) cut.apply();
  else applyCandidate(key, getCard);
  const file: RunFile = { key, firstSeed, gate: [], real: [] };
  for (const { mode, tag } of MODES) {
    for (const e of RING_EDGES) {
      const r = await measurePairing(e.self, e.opponent, firstSeed, e.seeds, { signature: mode });
      file[tag].push({ edge: edgeName(e), selfWins: r.selfWins, games: r.games });
    }
  }
  const text = JSON.stringify(file);
  if (out) writeFileSync(out, text + "\n");
  else console.log(text);
}

const pct = (x: number) => (x * 100).toFixed(1);
const signed = (x: number) => (x >= 0 ? "+" : "") + pct(x);

function report(dir: string, firstSeed: number): void {
  const runs = new Map<string, RunFile>();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(`-${firstSeed}.json`)) continue;
    const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as RunFile;
    runs.set(r.key, r);
  }
  const base = runs.get("shipped");
  if (!base) throw new Error(`no shipped run at seed ${firstSeed} in ${dir}`);
  console.log(`# Old-edges screen, seeds from ${firstSeed} (the ring's own counts: 2,500 a W edge, 900 an even edge)`);
  console.log(`# Each cell: the edge's first-named faction's rate, band verdict, change from shipped at the same seeds`);
  console.log(`# (Newcombe 95%; * = a real change), and CI's rule (judgeEdge against shipped): PASS / FAIL.`);
  const keys = [
    ...CANDIDATES.map((c) => c.key),
    ...[...runs.keys()].filter((k) => k.includes("+")).sort(),
    ...[...runs.keys()].filter((k) => k.startsWith("cut:")).sort(),
  ];
  for (const key of keys) {
    const c = CANDIDATES.find((x) => x.key === key) ??
      ablation(key) ?? { key, edge: "-" as const, label: candidateLabel(key), why: "", apply: () => {} };
    const r = runs.get(c.key);
    if (!r) continue;
    console.log("");
    const aim = c.edge === "NA" ? "for Null > Aegis" : c.edge === "CS" ? "for Cortex > Swarm" : key.includes("+") ? "both edges" : key.startsWith("cut:") ? "ablation" : "reference";
    console.log(`${c.key} [${aim}] ${c.label}`);
    if (c.edge !== "-") console.log(`    aim: ${c.why}`);
    let fails = 0;
    for (const e of RING_EDGES) {
      const name = edgeName(e);
      const band = ringBand(e.self, e.opponent);
      const cells: string[] = [];
      for (const tag of ["real", "gate"] as const) {
        const now = r[tag].find((x) => x.edge === name)!;
        const b = base[tag].find((x) => x.edge === name)!;
        const verdict = bandVerdict(now.selfWins, now.games, band);
        const d = newcombeDiff(now.selfWins, now.games, b.selfWins, b.games);
        const real = d.lo > 0 || d.hi < 0;
        const j = judgeEdge(e, now, b);
        if (!j.pass) fails++;
        cells.push(
          `${tag} ${pct(now.selfWins / now.games).padStart(4)}% ${verdict.padEnd(11)}` +
            (c.key === "shipped" ? "" : ` ${signed(d.diff).padStart(5)}${real ? "*" : " "} ${j.pass ? "PASS" : "FAIL"}`),
        );
      }
      console.log(`  ${name.padEnd(15)} ${cells.join("   ")}`);
    }
    if (c.key !== "shipped") console.log(`  -> CI rule on both checks: ${fails === 0 ? "PASS" : `FAIL (${fails} cell(s))`}`);
  }
}

/** The ablation as one table: per cut card, each edge's change (points,
 * first-named side) from shipped in both modes; * = a real change at 95%. */
function ablationTable(dir: string): void {
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as RunFile;
  const base = read("shipped-1.json");
  const cuts = readdirSync(dir).filter((f) => f.startsWith("cut_") && f.endsWith("-1.json")).map(read);
  const short = ["N>A", "A>C", "C>S", "S>N", "N~C", "A~S"];
  console.log("# Ablation: one copy cut from a shipped list (39 cards), ring seeds from 1, both modes.");
  console.log("# Each cell: the edge's change in points for its FIRST-named faction (N>A = Null's rate vs Aegis).");
  console.log("# * = a real change at 95% (Newcombe). A cut that RAISES N>A means Aegis (or Null) wins less (more) without it.");
  console.log(`${"card cut".padEnd(30)} ${"real: " + short.map((x) => x.padStart(6)).join("")}   ${"gate: " + short.map((x) => x.padStart(6)).join("")}`);
  const byFaction = new Map<string, RunFile[]>();
  for (const r of cuts) {
    const id = r.key.slice(4);
    const f = card(id).faction === "Neutral" ? `Neutral (cut from ${["Cortex", "Swarm", "Aegis", "Null"].find((x) => [CORTEX_CARDS, SWARM_CARDS, AEGIS_CARDS, NULL_CARDS][["Cortex", "Swarm", "Aegis", "Null"].indexOf(x)]!.some((p) => p.card.id === id))})` : card(id).faction;
    byFaction.set(f, [...(byFaction.get(f) ?? []), r]);
  }
  const diffOf = (r: RunFile, tag: "real" | "gate", e: (typeof RING_EDGES)[number]) => {
    const n = r[tag].find((x) => x.edge === edgeName(e))!;
    const b = base[tag].find((x) => x.edge === edgeName(e))!;
    return newcombeDiff(n.selfWins, n.games, b.selfWins, b.games);
  };
  const groups = [...byFaction].sort();
  for (const [f, rs] of groups) {
    console.log(`-- ${f}`);
    for (const r of rs) {
      const cells = (tag: "real" | "gate") =>
        RING_EDGES.map((e) => {
          const d = diffOf(r, tag, e);
          return (signed(d.diff) + (d.lo > 0 || d.hi < 0 ? "*" : " ")).padStart(6);
        }).join("");
      const id = r.key.slice(4);
      console.log(`${(card(id).name + " (" + id + ")").padEnd(30)}       ${cells("real")}         ${cells("gate")}`);
    }
  }
  // Any cut makes a 39-card deck, and a shorter deck draws its good cards
  // more often (session 57), so every cut carries a small bonus of its own.
  // Measured against the faction's average cut, that bonus drops out: a
  // card well BELOW its faction's average (for that faction's own rate)
  // is one that carries the matchup.
  console.log("");
  console.log("# The same, minus the faction's average cut (drops the shorter-deck bonus every cut shares).");
  console.log("# Read from the cut faction's side: for an Aegis card, a NEGATIVE A>C or A~S, or a POSITIVE N>A, is a card");
  console.log("# Aegis wins those games with (it does worse than its average cut without it).");
  for (const [f, rs] of groups) {
    const mean = (tag: "real" | "gate", e: (typeof RING_EDGES)[number]) => rs.reduce((a, r) => a + diffOf(r, tag, e).diff, 0) / rs.length;
    console.log(`-- ${f}: average cut  real ${RING_EDGES.map((e) => signed(mean("real", e)).padStart(6)).join("")}   gate ${RING_EDGES.map((e) => signed(mean("gate", e)).padStart(6)).join("")}`);
    for (const r of rs) {
      const cells = (tag: "real" | "gate") => RING_EDGES.map((e) => signed(diffOf(r, tag, e).diff - mean(tag, e)).padStart(6)).join("");
      const id = r.key.slice(4);
      console.log(`${(card(id).name + " (" + id + ")").padEnd(30)}       ${cells("real")}         ${cells("gate")}`);
    }
  }
}

/** How often each side casts a modal candidate card, and in which mode,
 * per opponent (seeds from `firstSeed`, `count` per pairing, real mode):
 * a fix the agent never plays would be a hollow result. */
async function modeUse(key: string, firstSeed: number, count: number): Promise<void> {
  applyCandidate(key, getCard);
  const modal = ["NL-015", "CX-019"].map((id) => card(id));
  const factions = ["Cortex", "Swarm", "Aegis", "Null"] as const;
  console.log(`# Mode use for ${key}, real-match mode, seeds ${firstSeed}-${firstSeed + count - 1} per pairing (casts per game by the card's faction)`);
  for (const c of modal) {
    for (const opp of factions.filter((f) => f !== c.faction)) {
      const counts = new Map<string, number>();
      let games = 0;
      await measurePairing(c.faction, opp, firstSeed, count, {
        signature: "approved",
        onGame: (state, selfPid) => {
          games++;
          for (const e of state.log as any[]) {
            if (e.type === "cast" && e.player === selfPid && e.card === c.name) counts.set(e.modeName ?? "(none)", (counts.get(e.modeName ?? "(none)") ?? 0) + 1);
          }
        },
      });
      const names = c.modes ? c.modes.map((m: any) => m.name) : ["(none)"];
      const cells = names.map((n: string) => `${n === "(none)" ? "cast" : n} ${((counts.get(n) ?? 0) / games).toFixed(2)}`).join("   ");
      console.log(`  ${c.name.padEnd(12)} (${c.faction}) vs ${opp.padEnd(6)}  ${cells}`);
    }
  }
}

/** The built-deck ring side by side: each candidate's rings (the
 * run-candidate.sh output dirs) against the shipped game's
 * (progress/built-deck-ring-003/rings), per mode and collection level:
 * each edge's rate for its first-named faction and its change from shipped
 * at the same level (* = real at 95%), then each faction's mean over its
 * three edges. */
function sideBySide(shippedRings: string, candidates: { key: string; rings: string }[]): void {
  type Ring = { level: string; mode: string; edges: { edge: string; selfWins: number; games: number }[] };
  const load = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Ring);
  const base = load(shippedRings);
  const cands = candidates.map((c) => ({ ...c, rings: load(c.rings) }));
  const levels = ["full", "37", "17", "3"];
  const factions = ["Cortex", "Swarm", "Aegis", "Null"] as const;
  console.log("# The built-deck ring, side by side (the deck-building agent's decks on both sides; ring seeds from 1).");
  console.log("# shipped = progress/built-deck-ring-003 (today's game). Each candidate cell: rate, then the change from shipped");
  console.log("# at the same level and mode (points; * = a real change at 95%, Newcombe). Bands: predator 55-60, even 45-55.");
  for (const mode of ["real", "gate"]) {
    console.log("");
    console.log(`== ${mode === "real" ? "REAL-MATCH MODE (an approved signature card per side)" : "GATE MODE (no signature card)"} ==`);
    const head = ["shipped", ...cands.map((c) => c.key)];
    console.log(`${"".padEnd(16)}${head.map((h) => h.padStart(levels.length * 13)).join("  ")}`);
    console.log(`${"edge".padEnd(16)}${head.map(() => levels.map((l) => (l === "full" ? "full" : l + "p").padStart(13)).join("")).join("  ")}`);
    const cell = (rs: Ring[], level: string, edge: string) => rs.find((r) => r.level === level && r.mode === mode)?.edges.find((e) => e.edge === edge);
    for (const e of RING_EDGES) {
      const name = edgeName(e);
      const row = [levels.map((l) => { const b = cell(base, l, name)!; return pct(b.selfWins / b.games).padStart(13); }).join("")];
      for (const c of cands) {
        row.push(levels.map((l) => {
          const b = cell(base, l, name)!;
          const n = cell(c.rings, l, name);
          if (!n) return "-".padStart(13);
          const d = newcombeDiff(n.selfWins, n.games, b.selfWins, b.games);
          return `${pct(n.selfWins / n.games)} ${signed(d.diff)}${d.lo > 0 || d.hi < 0 ? "*" : " "}`.padStart(13);
        }).join(""));
      }
      console.log(`${name.padEnd(16)}${row.join("  ")}`);
    }
    const mean = (rs: Ring[], level: string, f: string) => {
      const rates = RING_EDGES.filter((e) => e.self === f || e.opponent === f).map((e) => {
        const x = cell(rs, level, edgeName(e));
        if (!x) return NaN;
        const r = x.selfWins / x.games;
        return e.self === f ? r : 1 - r;
      });
      return rates.reduce((a, b) => a + b, 0) / rates.length;
    };
    for (const f of factions) {
      const row = [levels.map((l) => pct(mean(base, l, f)).padStart(13)).join("")];
      for (const c of cands) row.push(levels.map((l) => { const m = mean(c.rings, l, f); return Number.isNaN(m) ? "-".padStart(13) : `${pct(m)} ${signed(m - mean(base, l, f))} `.padStart(13); }).join(""));
      console.log(`${(f + " mean").padEnd(16)}${row.join("  ")}`);
    }
  }
}

async function main(): Promise<void> {
  const [cmd, a, b, ...rest] = process.argv.slice(2);
  if (cmd === "list") {
    for (const c of CANDIDATES) console.log(`${c.key}\t${c.label}`);
  } else if (cmd === "run") {
    const outIdx = rest.indexOf("--out");
    await run(a!, Number(b ?? 1), outIdx >= 0 ? rest[outIdx + 1] : undefined);
  } else if (cmd === "modes") {
    await modeUse(a!, Number(b ?? 1), Number(rest[0] ?? 300));
  } else if (cmd === "side") {
    // side <shipped rings dir> <key>=<rings dir> ...
    sideBySide(a!, [b!, ...rest].filter(Boolean).map((x) => { const [key, rings] = x.split("="); return { key: key!, rings: rings! }; }));
  } else if (cmd === "ablation") {
    ablationTable(a!);
  } else if (cmd === "report") {
    report(a!, Number(b ?? 1));
  } else {
    throw new Error("usage: oldEdgesScreen.ts run <key> <firstSeed> [--out f] | report <dir> <firstSeed> | list");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
