// The four first-seat fixes, measured (session 68; owner 2026-11-02 on
// session 67's check-in: "measure all four ... test only ... measure each
// on the shipped-deck mirrors (same agent both seats) and on the ladder's
// seat split; take the leaders through the ring check and the built-deck
// ring; bring every number to an owner check-in. No rule change ships
// without the owner's OK."). Nothing here changes a card, a deck or a rule.
//
//   npx tsx src/dev/firstSeatFixes.ts mirrors <id> > mirrors/<id>.json
//   npx tsx src/dev/firstSeatFixes.ts ring <id> gate|real > ring/<id>-<mode>.json
//   npx tsx src/dev/firstSeatFixes.ts report <dir> > report.txt
//
// The ladder's seat split comes from server/src/dev/firstSeatLadder.ts
// (<dir>/ladder/<id>.json), the built-deck rings from builtDeckRing.ts's
// `ring ... --rules <id>` (<dir>/built/<level>-<mode>-<id>.json), compared
// with the shipped rings in progress/built-deck-ring-004/rings.
//
// Mirrors: each faction's shipped deck against itself, the LookaheadAgent
// (default style) both seats, p1 always first, seeds 50,001-51,000: session
// 67's 400 seeds and 600 more. The variants draw nothing from the RNG, so
// every variant plays the same shuffles and the same agents' seeds as the
// shipped rules: the difference between two rows is the rule, not the deal.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDeck } from "../data/decks.js";
import { getCard, SHIPPED_DECK_LISTS } from "../data/registry.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import type { DeckFaction } from "../cards/types.js";
import { SEAT_VARIANTS, seatVariant } from "./seatVariants.js";
import { bandVerdict, measurePairing, ringBand, wilson } from "./edgeMeasure.js";
import { DECK_MODES, RING_EDGES, edgeName, judgeEdge, type EdgeMeasurement } from "./ringRegression.js";

const FACTIONS: DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];
const MIRROR_SEEDS = 1000;

interface Tally {
  firstWins: number;
  decided: number;
}
interface MirrorFile {
  variant: string;
  seeds: number;
  factions: Record<string, Tally & { draws: number; medianTurns: number }>;
}
interface RingCheckFile {
  variant: string;
  mode: "gate" | "real";
  edges: { edge: string; selfWins: number; games: number; pass: boolean; line: string }[];
}
interface LadderFile extends Tally {
  variant: string;
  rounds: number;
  matches: number;
  draws: number;
  mirror: Tally;
  byFirstFaction: Record<string, Tally>;
  byFirstStyle: Record<string, Tally>;
  medianTurns: number | null;
}
interface BuiltRingFile {
  level: string;
  mode: "real" | "gate";
  rules?: string;
  edges: { edge: string; selfWins: number; games: number }[];
}

async function mirrors(id: string): Promise<MirrorFile> {
  const v = seatVariant(id);
  const out: MirrorFile = { variant: v.id, seeds: MIRROR_SEEDS, factions: {} };
  for (const f of FACTIONS) {
    const spec = (pid: "p1" | "p2") => buildDeck(pid, `${f} (shipped)`, SHIPPED_DECK_LISTS[f].map((e) => ({ card: getCard(e.cardId)!, copies: e.copies })));
    let firstWins = 0;
    let decided = 0;
    let draws = 0;
    const turns: number[] = [];
    for (let seed = 1; seed <= MIRROR_SEEDS; seed++) {
      const r = await runMatch(spec("p1"), spec("p2"), new LookaheadAgent("A", seed * 2), new LookaheadAgent("B", seed * 2 + 1), 50_000 + seed, {}, v.rules);
      if (r.state.winner === "p1") firstWins++;
      if (r.state.winner === "p1" || r.state.winner === "p2") decided++;
      else draws++;
      turns.push(r.state.turnNumber);
    }
    turns.sort((a, b) => a - b);
    out.factions[f] = { firstWins, decided, draws, medianTurns: turns[Math.floor(turns.length / 2)]! };
  }
  return out;
}

async function ringCheck(id: string, mode: "gate" | "real"): Promise<RingCheckFile> {
  const v = seatVariant(id);
  const signature = mode === "real" ? "approved" : "none";
  const base = JSON.parse(readFileSync(fileURLToPath(new URL(DECK_MODES[signature].file, import.meta.url)), "utf8")) as { edges: EdgeMeasurement[] };
  const out: RingCheckFile = { variant: v.id, mode, edges: [] };
  for (const e of RING_EDGES) {
    const r = await measurePairing(e.self, e.opponent, 1, e.seeds, { signature, rules: v.rules });
    const now = { edge: edgeName(e), selfWins: r.selfWins, games: r.games };
    const j = judgeEdge(e, now, base.edges.find((b) => b.edge === edgeName(e))!);
    out.edges.push({ ...now, pass: j.pass, line: "" });
  }
  return out;
}

// ---------- the report ----------

const pct = (k: number, n: number) => (n === 0 ? "  -  " : ((100 * k) / n).toFixed(1));
const ci = (k: number, n: number) => {
  const w = wilson(k, n);
  return `${(100 * w.lo).toFixed(1)}-${(100 * w.hi).toFixed(1)}`;
};
function readJson<T>(dir: string): T[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as T);
}
const ORDER = SEAT_VARIANTS.map((v) => v.id);
const byOrder = <T extends { variant: string }>(xs: T[]) => [...xs].sort((a, b) => ORDER.indexOf(a.variant) - ORDER.indexOf(b.variant));
const label = (id: string) => seatVariant(id).label;

function report(dir: string): void {
  const say = (s = "") => console.log(s);
  const mirrorsAll = byOrder(readJson<MirrorFile>(join(dir, "mirrors")));
  const ladders = byOrder(readJson<LadderFile>(join(dir, "ladder")));
  const rings = readJson<RingCheckFile>(join(dir, "ring"));
  const built = readJson<BuiltRingFile>(join(dir, "built"));
  const shippedBuilt = readJson<BuiltRingFile>(fileURLToPath(new URL("../../../progress/built-deck-ring-004/rings", import.meta.url)));

  say("# The four first-seat fixes, measured (session 68)");
  say();
  say("Owner 2026-11-02: measure (a)-(d) on the shipped-deck mirrors and the ladder's seat split, the leaders through");
  say("the ring check and the built-deck ring, test only. No rule changed: each variant is a `rules` option the");
  say("measuring instruments pass to runMatch (engine/src/state/types.ts MatchRules); no match the game plays sets it.");
  say("The second seat is always p2. Extras (doses and pairs) are marked; the four asked are (a)-(d).");
  say("50% is a fair seat. The aim is the variant whose first-seat share is closest to 50% without moving the ring.");
  say();
  say("## 1. Shipped-deck mirrors (same deck, same agent both seats; p1 always first)");
  say();
  say(`${MIRROR_SEEDS} seeds per faction (seeds 50,001-51,000; the first 400 are session 67's), the same deals for every variant.`);
  say("First-seat share of decided games, % [95% Wilson interval]; median turns over all four.");
  say();
  say(`${"variant".padEnd(52)} ${"all four".padEnd(19)} ${FACTIONS.map((f) => f.padEnd(7)).join(" ")} turns`);
  for (const m of mirrorsAll) {
    const k = FACTIONS.reduce((s, f) => s + m.factions[f]!.firstWins, 0);
    const n = FACTIONS.reduce((s, f) => s + m.factions[f]!.decided, 0);
    const med = FACTIONS.map((f) => m.factions[f]!.medianTurns).sort((a, b) => a - b);
    say(`${label(m.variant).padEnd(52)} ${`${pct(k, n)} [${ci(k, n)}]`.padEnd(19)} ${FACTIONS.map((f) => pct(m.factions[f]!.firstWins, m.factions[f]!.decided).padEnd(7)).join(" ")} ${((med[1]! + med[2]!) / 2).toFixed(1)}`);
  }
  say();
  say("## 2. The ladder's seat split (session 67's 2,400-match run: 8 house owners, decks rebuilt as packs open)");
  say();
  say("Seats are a coin flip, so the first seat's share of decided matches is the edge itself. Same ladder seed for");
  say("every variant; the pairings and builds drift apart as results differ, so rows are not paired like the mirrors.");
  say();
  say(`${"variant".padEnd(52)} ${"all matches".padEnd(26)} ${"faction mirrors".padEnd(17)} ${FACTIONS.map((f) => `${f} 1st`.padEnd(10)).join(" ")}`);
  for (const l of ladders) {
    say(
      `${label(l.variant).padEnd(52)} ${`${pct(l.firstWins, l.decided)} [${ci(l.firstWins, l.decided)}] n=${l.decided}`.padEnd(26)} ${`${pct(l.mirror.firstWins, l.mirror.decided)} n=${l.mirror.decided}`.padEnd(17)} ${FACTIONS.map((f) => pct(l.byFirstFaction[f]!.firstWins, l.byFirstFaction[f]!.decided).padEnd(10)).join(" ")}`,
    );
  }
  if (ladders.length) {
    say();
    say("By the first seat's play style (all matches):");
    const styles = Object.keys(ladders[0]!.byFirstStyle);
    say(`${"variant".padEnd(52)} ${styles.map((s) => s.padEnd(11)).join(" ")}`);
    for (const l of ladders) say(`${label(l.variant).padEnd(52)} ${styles.map((s) => pct(l.byFirstStyle[s]!.firstWins, l.byFirstStyle[s]!.decided).padEnd(11)).join(" ")}`);
  }
  say();
  say("## 3. The ring check (the six edges, shipped decks, ring seeds; judged against the shipped baselines)");
  say();
  say("Each edge: the first-named side's win rate, its band verdict, and the ring check's PASS/FAIL against the");
  say("shipped baseline (FAIL = the verdict got worse, or an OUT edge moved further out by a real amount).");
  say("The ring alternates seats, so a seat rule should move it little; this checks it doesn't.");
  for (const mode of ["gate", "real"] as const) {
    const rs = byOrder(rings.filter((r) => r.mode === mode));
    if (!rs.length) continue;
    say();
    say(`### ${mode === "gate" ? "gate (decks only, CI's `ring`)" : "real (an approved signature card a side, CI's `ring:real`)"}`);
    say(`${"variant".padEnd(52)} ${RING_EDGES.map((e) => edgeName(e).padEnd(22)).join(" ")} result`);
    for (const r of rs) {
      const cells = RING_EDGES.map((e) => {
        const x = r.edges.find((y) => y.edge === edgeName(e))!;
        const v = bandVerdict(x.selfWins, x.games, ringBand(e.self, e.opponent));
        return `${pct(x.selfWins, x.games)} ${v === "IN BAND" ? "IN" : v === "OUT OF BAND" ? "OUT" : "unres"} ${x.pass ? "pass" : "FAIL"}`.padEnd(22);
      });
      const fails = r.edges.filter((x) => !x.pass).length;
      say(`${label(r.variant).padEnd(52)} ${cells.join(" ")} ${fails === 0 ? "PASS" : `FAIL (${fails})`}`);
    }
  }
  if (built.length) {
    say();
    say("## 4. The built-deck ring (session 62's builds: the store's decks at full, 37, 17 and 3 packs)");
    say();
    say("Each edge's move from the same ring under the shipped rules (progress/built-deck-ring-004), points, and how");
    say("many of the 24 edge-levels per mode stay in or reach their band. Same seeds and decks; only the rule differs.");
    for (const mode of ["real", "gate"] as const) {
      const variants = [...new Set(built.filter((b) => b.mode === mode).map((b) => b.rules!))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      if (!variants.length) continue;
      say();
      say(`### ${mode}`);
      const levels = ["full", "37", "17", "3"];
      const verdictCount = (files: BuiltRingFile[]) => {
        let inB = 0, out = 0, un = 0;
        for (const f of files) for (const e of RING_EDGES) {
          const x = f.edges.find((y) => y.edge === edgeName(e))!;
          const v = bandVerdict(x.selfWins, x.games, ringBand(e.self, e.opponent));
          if (v === "IN BAND") inB++; else if (v === "OUT OF BAND") out++; else un++;
        }
        return `${inB} in / ${un} unres. / ${out} out`;
      };
      const shippedFiles = levels.map((l) => shippedBuilt.find((b) => b.level === l && b.mode === mode)!).filter(Boolean);
      say(`shipped rules: ${verdictCount(shippedFiles)}`);
      for (const id of variants) {
        const files = levels.map((l) => built.find((b) => b.level === l && b.mode === mode && b.rules === id)).filter((x): x is BuiltRingFile => !!x);
        say(`${label(id)}: ${verdictCount(files)}`);
        let worst = 0;
        for (const e of RING_EDGES) {
          const moves = files.map((f) => {
            const s = shippedFiles.find((x) => x.level === f.level)!.edges.find((y) => y.edge === edgeName(e))!;
            const x = f.edges.find((y) => y.edge === edgeName(e))!;
            const d = 100 * (x.selfWins / x.games - s.selfWins / s.games);
            worst = Math.max(worst, Math.abs(d));
            return `${f.level} ${d >= 0 ? "+" : ""}${d.toFixed(1)}`;
          });
          say(`  ${edgeName(e).padEnd(16)} ${moves.join("   ")}`);
        }
        say(`  largest move: ${worst.toFixed(1)} points`);
      }
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "mirrors") console.log(JSON.stringify(await mirrors(a ?? "shipped")));
  else if (cmd === "ring") {
    if (b !== "gate" && b !== "real") throw new Error("ring <id> gate|real");
    console.log(JSON.stringify(await ringCheck(a ?? "shipped", b)));
  } else if (cmd === "report") report(a ?? ".");
  else throw new Error("usage: mirrors <id> | ring <id> gate|real | report <dir>");
}
