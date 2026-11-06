// The pre-launch built-deck ring (owner 2026-10-19, firm; roadmap
// "Standing: built-deck balance before launch"): the six ring edges with
// the deck-building agent's decks on BOTH sides, from full collections and
// from realistic ones, with today's agent (Lookahead, Calculator), at the
// ring check's bar (2,500 seeds for the four win/lose edges, 900 for the two
// even ones), reported against the ring's bands, Aegis called out.
//
// Three steps, sharded like deckBuilderStyleReport.ts so they run in
// parallel and each writes a file that reproduces byte for byte:
//
//  1. build <level> <faction>: the faction's built decks at one collection
//     level, with the store's own build (chooseDeck's defaults: 40 games per
//     shipped opponent, 24 one-copy changes, a 100-game confirm; search
//     seed 1; Calculator), forced to the faction:
//       - "full": one deck from a full collection (every live card at its
//         deck limit), as an owner with the whole set gets;
//       - "full-report": the deck session 53's report built from a full
//         collection with the stronger settings (100 games, 60 changes,
//         500-game confirm; progress/deckbuilder-styles/builds/calculator.json),
//         read, not rebuilt: is a better-searched deck a different balance?
//         Built before session 54's two builder fixes (a short deck's removal
//         share; the designed start no longer padded to 40), so its Null deck
//         is a padded one.
//       - a pack count (3, 17, 37): one deck per simulated owner who started
//         in that faction (economy/src/dev/realisticCollections.ts: the
//         faction's starter collection plus packs from the live roller).
//  2. ring <level> --mode real|gate: the six edges, built deck against built
//     deck. "real" is how a real match plays (ring:real: each side also gets
//     an approved menu line as its signature card); "gate" is the shipped
//     gate's decks-only mode. At a pack level each seed seats one owner per
//     side (see `ownersFor`), so an edge's games spread evenly over every
//     owner of both factions, each owner going first and second equally.
//  3. report: every level beside the shipped-deck baseline of the same mode.
//
//   npx tsx src/dev/builtDeckRing.ts build <level> <faction> --collections f.json --out f.json
//   npx tsx src/dev/builtDeckRing.ts ring <level> --mode real|gate --builds dir --out f.json [--rules <seat variant>]
//   npx tsx src/dev/builtDeckRing.ts report --builds dir --rings dir
//
// (`--games`/`--trials`/`--confirm` on build and `--seeds` on ring shrink a
// run for the smoke test; `--search-seed` on build changes the builder's
// search seed for a noise check; the files record what ran.)
//
// Nothing here changes a card, a deck or a rule; it only measures.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeckFaction } from "../cards/types.js";
import { getCard } from "../data/registry.js";
import { DECK_FACTIONS, DEFAULT_BUILD, buildFaction, deckSpec, fullHoldings, playGauntlet, shippedList, type DeckList, type GauntletScore } from "../deckbuilder/deckBuilder.js";
import { bandVerdict, measurePairing, ringBand, wilson, type DeckBuilder, type SignatureMode } from "./edgeMeasure.js";
import { DECK_MODES, RING_EDGES, edgeName } from "./ringRegression.js";
import { seatVariant, type SeatVariant } from "./seatVariants.js";

export type RingMode = "real" | "gate";
const SIGNATURE: Record<RingMode, SignatureMode> = { real: "approved", gate: "none" };
const BASELINE: Record<RingMode, string> = { real: "./ringBaselineReal.json", gate: "./ringBaseline.json" };

/** The store's build: chooseDeck's defaults (the store passes none). */
const STORE_BUILD = DEFAULT_BUILD;

export interface BuiltDeckFile {
  level: string;
  faction: DeckFaction;
  settings: { games: number; trials: number; confirmGames: number; searchSeed?: number; keepDesigned?: number };
  decks: {
    owner: number;
    /** Copies the owner held (all factions). */
    copies: number;
    list: [string, number][];
    chosen: string;
    kept: string[];
    /** The confirm step's result against the four shipped decks. */
    score: GauntletScore;
    /** The shipped list's result on the same confirm seeds (Calculator). */
    shipped?: GauntletScore;
    /** With `--keep-designed`: what the plain rule would have kept and the test that decided (deckBuilder's `keepDesigned`). */
    keepDesigned?: { plain: string; plainWins: number; designedWins: number; gained: number; lost: number; margin: number; kept: "designed" | "plain" };
  }[];
}

export interface RingFile {
  level: string;
  mode: RingMode;
  owners: number;
  /** The seat variant played (seatVariants.ts id; session 68), absent for the rules as shipped. */
  rules?: string;
  edges: { edge: string; selfWins: number; draws: number; games: number; perSelfOwner: number[]; perSelfOwnerGames: number[] }[];
}

interface CollectionFile {
  oddsVersion: string;
  collections: { faction: DeckFaction; owner: number; packs: number; copies: number; holdings: [string, number][] }[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
}

function factionArg(x: string | undefined): DeckFaction {
  if (!x || !(DECK_FACTIONS as readonly string[]).includes(x)) throw new Error(`expected a faction (${DECK_FACTIONS.join(", ")}), got "${x}"`);
  return x as DeckFaction;
}

/** The build settings: the store's, unless a smoke test asks for fewer
 * games (`--games`, `--trials`, `--confirm`; recorded in the file), or a
 * noise check asks for another search seed (`--search-seed`, session 60:
 * how much one full-collection build swings by its seed alone; the confirm
 * seeds stay the same). */
function buildSettings(): { games: number; trials: number; confirmGames: number; seed: number; keepDesigned?: number } {
  const keep = arg("keep-designed");
  return {
    ...(keep !== undefined ? { keepDesigned: Number(keep) } : {}),
    games: Number(arg("games") ?? STORE_BUILD.games),
    trials: Number(arg("trials") ?? STORE_BUILD.trials),
    confirmGames: Number(arg("confirm") ?? STORE_BUILD.confirmGames),
    seed: Number(arg("search-seed") ?? STORE_BUILD.seed),
  };
}

const sorted = (list: DeckList): [string, number][] => [...list].sort(([a], [b]) => a.localeCompare(b));
const listOf = (pairs: [string, number][]): DeckList => new Map(pairs);
const CONFIRM_SEED = STORE_BUILD.seed + 1_000_000;

/** Step 1 for one level and faction. */
async function build(level: string, faction: DeckFaction, collectionsPath: string | undefined): Promise<BuiltDeckFile> {
  const settings = buildSettings();
  const shipped = (await playGauntlet(shippedList(faction), CONFIRM_SEED, settings.confirmGames)).score;
  if (level === "full-report") {
    const path = fileURLToPath(new URL("../../../progress/deckbuilder-styles/builds/calculator.json", import.meta.url));
    const file = JSON.parse(readFileSync(path, "utf8")) as { games: number; trials: number; confirmGames: number; factions: { faction: DeckFaction; list: [string, number][]; chosen: string; kept: string[]; score: GauntletScore }[] };
    const f = file.factions.find((x) => x.faction === faction)!;
    // Its confirm ran 500 games per opponent; replay the store's 100 so the
    // "vs shipped" column compares like with like.
    const score = (await playGauntlet(listOf(f.list), CONFIRM_SEED, settings.confirmGames)).score;
    return { level, faction, settings: { games: file.games, trials: file.trials, confirmGames: file.confirmGames }, decks: [{ owner: 0, copies: -1, list: f.list, chosen: f.chosen, kept: f.kept, score, shipped }] };
  }
  const owners: { owner: number; copies: number; holdings: Map<string, number> }[] = [];
  if (level === "full") {
    const h = fullHoldings();
    owners.push({ owner: 0, copies: [...h.values()].reduce((s, n) => s + n, 0), holdings: h });
  } else {
    const packs = Number(level);
    if (!Number.isInteger(packs) || !collectionsPath) throw new Error(`level is full, full-report or a pack count with --collections, got "${level}"`);
    const file = JSON.parse(readFileSync(collectionsPath, "utf8")) as CollectionFile;
    for (const c of file.collections) if (c.faction === faction && c.packs === packs) owners.push({ owner: c.owner, copies: c.copies, holdings: new Map(c.holdings) });
    if (owners.length === 0) throw new Error(`no ${faction} collections at ${packs} packs in ${collectionsPath}`);
  }
  const out: BuiltDeckFile = { level, faction, settings: { games: settings.games, trials: settings.trials, confirmGames: settings.confirmGames, ...(settings.seed !== STORE_BUILD.seed ? { searchSeed: settings.seed } : {}), ...(settings.keepDesigned !== undefined ? { keepDesigned: settings.keepDesigned } : {}) }, decks: [] };
  for (const o of owners) {
    const b = await buildFaction(faction, o.holdings, { ...settings, log: (l) => console.error(`[${level} ${faction} #${o.owner}] ${l}`) });
    if (!b.deck) throw new Error(`${faction} owner ${o.owner} at ${level}: ${b.infeasible}`);
    out.decks.push({ owner: o.owner, copies: o.copies, list: sorted(b.deck), chosen: b.chosen!, kept: b.kept, score: b.score!, shipped, ...(b.keepDesigned ? { keepDesigned: b.keepDesigned } : {}) });
  }
  return out;
}

/** Which owner of each side plays seed `seed` (seeds from 1), with `n`
 * owners per faction. Seeds come in pairs (odd: the first-named faction's
 * deck goes first; even: second), and both seeds of a pair seat the same
 * two owners, so every owner goes first and second equally. The opponent's
 * owner shifts by one more each time the self owners wrap round, so the
 * pairings vary. */
export function ownersFor(seed: number, n: number): { self: number; opponent: number } {
  const pair = Math.floor((seed - 1) / 2);
  const self = pair % n;
  const opponent = (self + Math.floor(pair / n)) % n;
  return { self, opponent };
}

/** Step 2 for one level and mode. */
export async function ring(level: string, mode: RingMode, builds: BuiltDeckFile[], maxSeeds = Infinity, variant?: SeatVariant): Promise<RingFile> {
  const decks = {} as Record<DeckFaction, DeckList[]>;
  for (const f of DECK_FACTIONS) {
    const b = builds.find((x) => x.level === level && x.faction === f);
    if (!b) throw new Error(`no ${f} build at level ${level}`);
    decks[f] = [...b.decks].sort((a, c) => a.owner - c.owner).map((d) => listOf(d.list));
  }
  const n = decks.Cortex.length;
  if (DECK_FACTIONS.some((f) => decks[f].length !== n)) throw new Error(`level ${level}: factions have different owner counts`);
  const out: RingFile = { level, mode, owners: n, ...(variant && variant.id !== "shipped" ? { rules: variant.id } : {}), edges: [] };
  for (const ringEdge of RING_EDGES) {
    const e = { ...ringEdge, seeds: Math.min(ringEdge.seeds, maxSeeds) };
    let selfWins = 0;
    let draws = 0;
    const perSelfOwner = Array.from({ length: n }, () => 0);
    const perSelfOwnerGames = Array.from({ length: n }, () => 0);
    for (let seed = 1; seed <= e.seeds; seed++) {
      const who = ownersFor(seed, n);
      const builder = (f: DeckFaction, owner: number): DeckBuilder => (id, name) => deckSpec(decks[f][owner]!, id, name);
      const builders = { ...Object.fromEntries(DECK_FACTIONS.map((f) => [f, builder(f, 0)])), [e.self]: builder(e.self, who.self), [e.opponent]: builder(e.opponent, who.opponent) } as Record<DeckFaction, DeckBuilder>;
      const r = await measurePairing(e.self, e.opponent, seed, 1, { builders, signature: SIGNATURE[mode], rules: variant?.rules });
      selfWins += r.selfWins;
      draws += r.draws;
      perSelfOwner[who.self]! += r.selfWins;
      perSelfOwnerGames[who.self]!++;
    }
    console.error(`[${level} ${mode}] ${edgeName(e)}: ${selfWins} of ${e.seeds}`);
    out.edges.push({ edge: edgeName(e), selfWins, draws, games: e.seeds, perSelfOwner, perSelfOwnerGames });
  }
  return out;
}

function readDir<T>(dir: string): T[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as T);
}

const pct = (x: number) => (x * 100).toFixed(1);
const signed = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`;
const LEVEL_ORDER = ["full-report", "full", "37", "17", "3"];
const LEVEL_NAME: Record<string, string> = {
  "full-report": "full collection, session 53's stronger build (before this session's builder fixes)",
  full: "full collection, the store's build",
  "37": "starter + 37 packs (about two weeks)",
  "17": "starter + 17 packs (about a week)",
  "3": "starter + its 3 starter packs (day one)",
};

function baseline(mode: RingMode): { edge: string; selfWins: number; games: number }[] {
  return (JSON.parse(readFileSync(fileURLToPath(new URL(BASELINE[mode], import.meta.url)), "utf8")) as { edges: { edge: string; selfWins: number; games: number }[] }).edges;
}

/** Each faction's mean win rate over its three edges (the ring covers every pair once). */
function factionMeans(rates: Map<string, number>): Record<DeckFaction, number> {
  const sum = Object.fromEntries(DECK_FACTIONS.map((f) => [f, 0])) as Record<DeckFaction, number>;
  for (const e of RING_EDGES) {
    const r = rates.get(edgeName(e))!;
    sum[e.self] += r / 3;
    sum[e.opponent] += (1 - r) / 3;
  }
  return sum;
}

function verdictShort(v: ReturnType<typeof bandVerdict>): string {
  return v === "IN BAND" ? "IN" : v === "OUT OF BAND" ? "OUT" : "unres.";
}

function report(builds: BuiltDeckFile[], rings: RingFile[]): void {
  const levels = LEVEL_ORDER.filter((l) => rings.some((r) => r.level === l));
  console.log("The built-deck ring (pre-launch gate, owner 2026-10-19): the six ring edges with the deck-building agent's decks on both sides");
  console.log("Lookahead vs Lookahead, Calculator style, ring seeds (2,500 for the win/lose edges, 900 for the even ones, seeds from 1).");
  console.log(`Builds: the store's own (chooseDeck's defaults: ${STORE_BUILD.games} games per shipped opponent, ${STORE_BUILD.trials} one-copy changes, ${STORE_BUILD.confirmGames}-game confirm, search seed ${STORE_BUILD.seed}), forced to the owner's starting faction.`);
  console.log("Realistic owners: 8 per faction, each the faction's starter collection plus packs from the live roller (economy/src/dev/realisticCollections.ts);");
  console.log("at a pack level each seed seats one owner per side, every owner equally often and on both seats.");
  console.log("Bands: predator 55-60%, prey 40-45%, even 45-55%. Verdicts on the 95% Wilson interval: IN only when it sits inside the band, OUT only when it misses it.");
  const keep = [...new Set(builds.map((b) => b.settings.keepDesigned).filter((x): x is number => x !== undefined))];
  if (keep.length > 0) console.log(`TEST ONLY: built with keepDesigned ${keep.join(", ")} (the designed start is kept unless another deck beats it by more than ${keep.join(", ")} standard deviations, paired, on the confirm seeds); the store builds without it.`);
  console.log("No card, deck or rule changed: this only measures.");
  console.log("");

  for (const mode of ["real", "gate"] as RingMode[]) {
    const rs = levels.map((l) => rings.find((r) => r.level === l && r.mode === mode)).filter((r): r is RingFile => !!r);
    if (rs.length === 0) continue;
    const base = baseline(mode);
    console.log(`== ${mode === "real" ? "REAL-MATCH MODE (how a real match plays: an approved signature card per side; ring:real's mode)" : "GATE MODE (decks only, no signature card; the shipped gate's mode)"} ==`);
    console.log(`Decks: ${DECK_MODES[SIGNATURE[mode]].label}.`);
    const cols = ["shipped", ...rs.map((r) => r.level)];
    console.log(`${"edge (band)".padEnd(24)}${cols.map((c) => (c === "shipped" ? "shipped decks" : c === "full-report" ? "full (report)" : c === "full" ? "full (store)" : `${c} packs`).padStart(24)).join("")}`);
    const rateBy = new Map<string, Map<string, number>>();
    for (const c of cols) rateBy.set(c, new Map());
    for (const e of RING_EDGES) {
      const band = ringBand(e.self, e.opponent);
      const name = edgeName(e);
      const cells: string[] = [];
      for (const c of cols) {
        const m = c === "shipped" ? base.find((b) => b.edge === name)! : rs.find((r) => r.level === c)!.edges.find((x) => x.edge === name)!;
        const ci = wilson(m.selfWins, m.games);
        rateBy.get(c)!.set(name, m.selfWins / m.games);
        cells.push(`${pct(m.selfWins / m.games)} [${pct(ci.lo)}-${pct(ci.hi)}] ${verdictShort(bandVerdict(m.selfWins, m.games, band))}`.padStart(24));
      }
      console.log(`${`${name} (${Math.round(band.lo * 100)}-${Math.round(band.hi * 100)})`.padEnd(24)}${cells.join("")}`);
    }
    console.log(`${"in band / unres. / out".padEnd(24)}${cols
      .map((c) => {
        const vs = RING_EDGES.map((e) => {
          const m = c === "shipped" ? base.find((b) => b.edge === edgeName(e))! : rs.find((r) => r.level === c)!.edges.find((x) => x.edge === edgeName(e))!;
          return bandVerdict(m.selfWins, m.games, ringBand(e.self, e.opponent));
        });
        return `${vs.filter((v) => v === "IN BAND").length} / ${vs.filter((v) => v === "UNRESOLVED").length} / ${vs.filter((v) => v === "OUT OF BAND").length}`.padStart(24);
      })
      .join("")}`);
    console.log("");
    console.log("Each faction's mean win rate over its three edges (50 = even with the field; the ring itself is built to be even):");
    console.log(`${"faction".padEnd(24)}${cols.map((c) => (c === "shipped" ? "shipped" : c).padStart(24)).join("")}`);
    for (const f of DECK_FACTIONS) {
      console.log(`${f.padEnd(24)}${cols.map((c) => `${pct(factionMeans(rateBy.get(c)!)[f])}${c === "shipped" ? "" : ` (${signed(factionMeans(rateBy.get(c)!)[f] - factionMeans(rateBy.get("shipped")!)[f])})`}`.padStart(24)).join("")}`);
    }
    console.log("");
    console.log("Each edge's move from the shipped decks (points, first-named side), and how far outside its band it lands:");
    for (const e of RING_EDGES) {
      const band = ringBand(e.self, e.opponent);
      const name = edgeName(e);
      const s = rateBy.get("shipped")!.get(name)!;
      const parts = rs.map((r) => {
        const x = rateBy.get(r.level)!.get(name)!;
        const off = x < band.lo ? x - band.lo : x > band.hi ? x - band.hi : 0;
        return `${r.level}: ${signed(x - s)}${off === 0 ? "" : ` (${signed(off)} outside)`}`;
      });
      console.log(`  ${name.padEnd(16)}${parts.join("   ")}`);
    }
    console.log("");
    const packLevels = rs.filter((r) => r.owners > 1);
    if (packLevels.length > 0) {
      console.log("Spread between owners (the first-named side's win rate per owner of that side; at a pack level every owner plays ~1/8 of the edge):");
      for (const r of packLevels) {
        for (const e of r.edges) {
          const per = e.perSelfOwner.map((w, i) => w / e.perSelfOwnerGames[i]!);
          console.log(`  ${`${r.level} packs`.padEnd(10)}${e.edge.padEnd(16)}min ${pct(Math.min(...per))}  max ${pct(Math.max(...per))}  (${per.map((x) => pct(x)).join(" ")})`);
        }
      }
      console.log("");
    }
  }

  console.log("== The built decks ==");
  console.log("Confirm-step win rate against the four shipped decks (100 games each, fresh seeds), beside the shipped list on the same seeds:");
  for (const l of LEVEL_ORDER) {
    const bs = builds.filter((b) => b.level === l);
    if (bs.length === 0) continue;
    console.log(`-- ${LEVEL_NAME[l]} --`);
    for (const f of DECK_FACTIONS) {
      const b = bs.find((x) => x.faction === f);
      if (!b) continue;
      const rates = b.decks.map((d) => d.score.wins / d.score.games);
      const shipped = b.decks[0]!.shipped!;
      const mean = rates.reduce((s, x) => s + x, 0) / rates.length;
      const chosen = b.decks.map((d) => d.chosen).join(" ");
      const size = b.decks.map((d) => d.list.reduce((s, [, n]) => s + n, 0)).join(" ");
      console.log(`  ${f.padEnd(7)}built ${pct(mean)}${rates.length > 1 ? ` (owners ${pct(Math.min(...rates))}-${pct(Math.max(...rates))})` : ""}  shipped ${pct(shipped.wins / shipped.games)}  lift ${signed(mean - shipped.wins / shipped.games)}  kept: ${chosen}  sizes: ${size}`);
    }
  }
  if (builds.some((b) => b.settings.keepDesigned !== undefined)) {
    console.log("");
    console.log("keepDesigned: every deck where the plain rule (the most confirm wins) would have kept another deck than the designed start,");
    console.log("with the paired test on the confirm seeds (challenger's wins the designed start lost, and the reverse; the net it needed):");
    let n = 0;
    for (const l of LEVEL_ORDER) {
      for (const f of DECK_FACTIONS) {
        const b = builds.find((x) => x.level === l && x.faction === f);
        if (!b) continue;
        for (const d of b.decks) {
          const k = d.keepDesigned;
          if (!k) continue;
          n++;
          console.log(`  ${l.padEnd(5)}${f.padEnd(7)}#${d.owner}  ${k.plain} ${k.plainWins} vs designed ${k.designedWins}: +${k.gained} -${k.lost}, net ${k.gained - k.lost >= 0 ? "+" : ""}${k.gained - k.lost} (needs +${k.margin}): ${k.kept === "designed" ? "designed kept" : `${k.plain} kept`}; at 1 SD (needs +${Math.max(2, Math.sqrt(k.gained + k.lost)).toFixed(1)}): ${k.gained - k.lost >= Math.max(2, Math.sqrt(k.gained + k.lost)) ? k.plain : "designed"}`);
        }
      }
    }
    if (n === 0) console.log("  (none: the plain rule kept the designed start wherever there was one)");
  }
  console.log("");
  console.log("How each full-collection deck differs from its shipped list:");
  for (const l of ["full-report", "full"]) {
    for (const f of DECK_FACTIONS) {
      const b = builds.find((x) => x.level === l && x.faction === f);
      if (!b) continue;
      console.log(`  ${l.padEnd(12)}${f.padEnd(7)}${listDiff(listOf(b.decks[0]!.list), shippedList(f)) || "the shipped list"}`);
    }
  }
  console.log("");
  console.log("Cards the realistic owners' decks use that their shipped list doesn't (owners of 8 playing it, at the largest pack level):");
  const top = LEVEL_ORDER.filter((l) => /^\d+$/.test(l) && builds.some((b) => b.level === l))[0];
  if (top) {
    for (const f of DECK_FACTIONS) {
      const b = builds.find((x) => x.level === top && x.faction === f);
      if (!b) continue;
      const shipped = shippedList(f);
      const count = new Map<string, number>();
      for (const d of b.decks) for (const [id] of d.list) if (!shipped.has(id)) count.set(id, (count.get(id) ?? 0) + 1);
      const parts = [...count].sort((a, c) => c[1] - a[1] || a[0].localeCompare(c[0])).map(([id, n]) => `${getCard(id)!.name} ${n}`);
      console.log(`  ${f.padEnd(7)}${parts.join(", ") || "(none)"}`);
    }
  }
}

/** Cards in which two lists differ, as "+2 X, -1 Y" (empty when identical). */
function listDiff(a: DeckList, b: DeckList): string {
  const ids = [...new Set([...a.keys(), ...b.keys()])].sort();
  const parts: string[] = [];
  for (const id of ids) {
    const d = (a.get(id) ?? 0) - (b.get(id) ?? 0);
    if (d !== 0) parts.push(`${d > 0 ? "+" : ""}${d} ${getCard(id)!.name}`);
  }
  return parts.join(", ");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [mode, a, b] = process.argv.slice(2);
  const outFile = arg("out");
  if (mode === "build") {
    const r = await build(a!, factionArg(b), arg("collections"));
    writeFileSync(outFile ?? `build-${a}-${b}.json`, `${JSON.stringify(r)}\n`);
  } else if (mode === "ring") {
    const m = arg("mode") ?? "real";
    if (m !== "real" && m !== "gate") throw new Error(`--mode is real or gate, got "${m}"`);
    const rules = arg("rules");
    const r = await ring(a!, m, readDir<BuiltDeckFile>(arg("builds") ?? "."), Number(arg("seeds") ?? Infinity), rules ? seatVariant(rules) : undefined);
    writeFileSync(outFile ?? `ring-${a}-${m}.json`, `${JSON.stringify(r)}\n`);
  } else if (mode === "report") {
    report(readDir<BuiltDeckFile>(arg("builds") ?? "."), readDir<RingFile>(arg("rings") ?? "."));
  } else {
    throw new Error("usage: build <level> <faction> | ring <level> --mode real|gate | report");
  }
}
