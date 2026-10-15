// The signature-card fairness test (owner 2026-10-11, "signature zone
// check-in, option A"), built session 32.
//
// The reference: every faction plays its shipped deck (its set Mythic left
// in the deck) with the SAME plain signature card, a Neutral 5-cost 3/6
// with no ability (REFERENCE_SIGNATURE). A candidate is measured by swapping
// it in for ONE faction's plain stand-in, the other three keeping theirs,
// and playing that faction's three pairings. Owner rule: the candidate
// passes when, in every faction (the 2026-10-05 Neutral amendment: "in
// every faction"), each of that faction's three edges moves by 2 points or
// less.
//
// How "moves by 2 points or less" is read (session-32 call, flagged for the
// owner): on the point estimate of the paired change. Candidate and
// reference play the same seeds with the same agent seeds, so each game is
// identical until the signature card changes something; the change is the
// mean of the per-seed differences and its interval is the paired
// interval, much tighter than two independent samples. The interval is
// printed beside every number, so an edge that "passes" on a point estimate
// its interval can't actually vouch for is visible.
//
// The gate (ringRegression.ts, decks as shipped) is untouched by a
// signature card: under option A no real match carries one yet, so "the
// ring regression check must still pass" holds by construction and is
// re-run once per session, not per candidate.
//
// Usage (from engine/):
//   npx tsx src/dev/signatureFairness.ts reference [--seeds N]
//       measure the reference ring once and cache per-seed results
//       (src/dev/signatureReference.json)
//   npx tsx src/dev/signatureFairness.ts candidates [--seeds N] [--tier 5|6|7] [--ability key] [--shard i/k] [--out file]
//       test candidates against the cached reference; JSON lines
//   npx tsx src/dev/signatureFairness.ts tune --ability key --tier 5|6|7 [--keyword K] [--aura key] [--seeds N] [--confirm N] [--out file]
//       "if it fails, adjust its stats and test again" (owner 2026-10-05):
//       walk the stat line (off the table if need be) toward zero net
//       change, then confirm the best line found at --confirm seeds
//   npx tsx src/dev/signatureFairness.ts levers [--ability key | --shard i/k] [--coarse N] [--seeds N] [--confirm N] [--out file]
//       the tuner with the owner's 2026-10-13 levers: the ability's size
//       and the cost tier as well as the stat line (attack 2 or more)
//   npx tsx src/dev/signatureFairness.ts grid --abilities a,b [--tier 5] [--attack 2-4] [--health 3-9] [--seeds N] [--shard i/k] [--out file]
//       the finer pass (owner 2026-10-15): every size of each option x every
//       body in the grid, no greedy walk; one compact line per candidate
//   npx tsx src/dev/signatureFairness.ts confirm --in file,... [--top N] [--seeds N] [--shard i/k] [--out file]
//       the N best grid lines per option re-measured at --seeds (2,500)
//   npx tsx src/dev/signatureFairness.ts report file... [--seeds N]
//       the table for a balance report

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { measurePairing, FACTIONS, type DeckBuilder } from "./edgeMeasure.js";
import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import {
  allSignatureSpecs,
  buildSignatureCard,
  menuOption,
  optionAtSize,
  signatureComboId,
  onTable,
  SIGNATURE_MENU,
  SIGNATURE_TIERS,
  TIER6_KEYWORDS,
  type SignatureSpec,
  type SignatureTier,
} from "../data/signatureMenu.js";
import type { DeckFaction as Faction, UnitCard } from "../cards/types.js";

/** A measuring stand-in only, never a real card: the bottom of the cost-5
 * tier (3/6) with no ability at all. */
export const REFERENCE_SIGNATURE: UnitCard = {
  id: "REF-SIG",
  name: "Reference Signature",
  faction: "Neutral",
  rarity: "Mythic",
  cost: 5,
  type: "Unit",
  attack: 3,
  health: 6,
  keywords: [],
  art: "placeholder:dev/reference-signature",
  flavor: "",
  abilities: [],
};

/** The stat walk's bounds (tuneCandidate). Attack stays at 2 or more so the
 * card still reads as a Mythic (owner 2026-10-13); session 32's walk went
 * down to 0 and is not reproduced by this one below 2. */
export const MIN_TUNED_ATTACK = 2;
const MAX_TUNED_ATTACK = 6;
const MAX_TUNED_HEALTH = 9;

/** Owner's limit: 2 points. */
export const FAIRNESS_LIMIT = 0.02;

const SHIPPED: Record<Faction, DeckBuilder> = { Cortex: buildCortexDeck, Swarm: buildSwarmDeck, Aegis: buildAegisDeck, Null: buildNullDeck };

/** Every faction with `signatures[f]` (default: the reference stand-in). */
export function buildersWith(signatures: Partial<Record<Faction, UnitCard>> = {}): Record<Faction, DeckBuilder> {
  return Object.fromEntries(
    FACTIONS.map((f) => [f, (id: "p1" | "p2", name: string) => ({ ...SHIPPED[f](id, name), signature: signatures[f] ?? REFERENCE_SIGNATURE })]),
  ) as Record<Faction, DeckBuilder>;
}

/** Per-seed results of `self` vs `opponent`, from `self`'s side: "1" win,
 * "0" loss, "d" draw. */
export async function seedResults(self: Faction, opponent: Faction, seeds: number, builders: Record<Faction, DeckBuilder>): Promise<string> {
  let out = "";
  await measurePairing(self, opponent, 1, seeds, {
    builders,
    onGame: (state, selfPid) => {
      out += state.winner === "draw" ? "d" : state.winner === selfPid ? "1" : "0";
    },
  });
  return out;
}

export interface PairedChange {
  /** Win rate with the candidate, and in the reference. */
  rate: number;
  refRate: number;
  /** Mean per-seed change, with its paired 95% interval. */
  diff: number;
  lo: number;
  hi: number;
}

/** The paired change between two per-seed result strings (wins count 1,
 * losses and draws 0, as the ring counts them). */
export function pairedChange(candidate: string, reference: string): PairedChange {
  if (candidate.length !== reference.length) throw new Error("pairedChange: different seed counts");
  const n = candidate.length;
  let sum = 0;
  let sumSq = 0;
  let wins = 0;
  let refWins = 0;
  for (let i = 0; i < n; i++) {
    const c = candidate[i] === "1" ? 1 : 0;
    const r = reference[i] === "1" ? 1 : 0;
    wins += c;
    refWins += r;
    const d = c - r;
    sum += d;
    sumSq += d * d;
  }
  const diff = sum / n;
  const variance = n > 1 ? (sumSq - n * diff * diff) / (n - 1) : 0;
  const half = 1.96 * Math.sqrt(variance / n);
  return { rate: wins / n, refRate: refWins / n, diff, lo: diff - half, hi: diff + half };
}

export interface Reference {
  seeds: number;
  /** Keyed "Self>Opponent", all 12 ordered pairs. */
  results: Record<string, string>;
}

const REFERENCE_FILE = fileURLToPath(new URL("./signatureReference.json", import.meta.url));

export async function measureReference(seeds: number): Promise<Reference> {
  const builders = buildersWith();
  const results: Record<string, string> = {};
  for (const self of FACTIONS) for (const opponent of FACTIONS) if (self !== opponent) results[`${self}>${opponent}`] = await seedResults(self, opponent, seeds, builders);
  return { seeds, results };
}

/** Signed mean change over all twelve edges: how much stronger than the
 * reference stand-in the candidate plays, on average. */
export function netChange(r: CandidateResult): number {
  const all = r.factions.flatMap((f) => f.edges.map((e) => e.change.diff));
  return all.reduce((a, b) => a + b, 0) / all.length;
}

export interface TuneResult {
  /** The table line the walk started from, and every line it measured. */
  start: SignatureSpec;
  tried: { id: string; net: number; worst: number }[];
  /** The best line found (smallest worst edge), re-measured at the confirm
   * seed count. */
  best: CandidateResult;
  onTable: boolean;
}

/**
 * The owner's "adjust its stats and test again". From `start` (a table
 * line), step one stat point at a time toward zero net change: while the
 * candidate plays stronger than the reference, try -1 attack and -1 health
 * and keep whichever lands closer to zero; while weaker, +1 of either. Stop
 * when no step gets closer, then measure the neighbours of the closest line
 * and take the one with the smallest worst edge. Screening runs at the
 * reference's seed count; the winner is re-measured at `confirm`.
 */
export async function tuneCandidate(start: SignatureSpec, screen: Reference, confirm: Reference, log: (s: string) => void = () => {}): Promise<TuneResult> {
  const cache = new Map<string, CandidateResult>();
  const measure = async (spec: SignatureSpec): Promise<CandidateResult | undefined> => {
    // Bounds: health is a weak lever here (a signature card rarely dies),
    // so an unbounded walk can climb health forever chasing a few tenths of
    // a point (session 32: Sweep walked to 1/16). Keep bodies plausible.
    if (spec.attack < MIN_TUNED_ATTACK || spec.attack > MAX_TUNED_ATTACK || spec.health < 1 || spec.health > MAX_TUNED_HEALTH) return undefined;
    const id = signatureComboId(spec);
    if (!cache.has(id)) {
      const r = await testCandidate(buildSignatureCard(spec, { anyStats: true }), spec, screen);
      cache.set(id, r);
      log(`  ${id.padEnd(36)} net ${signed(netChange(r))}  worst ${pct(r.worst)}`);
    }
    return cache.get(id);
  };
  let current = start;
  let currentResult = (await measure(current))!;
  for (let step = 0; step < 12; step++) {
    const net = netChange(currentResult);
    const dir = net > 0 ? -1 : 1;
    const options = [
      { ...current, attack: current.attack + dir },
      { ...current, health: current.health + dir },
    ];
    let bestNext: { spec: SignatureSpec; r: CandidateResult } | undefined;
    for (const o of options) {
      const r = await measure(o);
      if (r && (!bestNext || Math.abs(netChange(r)) < Math.abs(netChange(bestNext.r)))) bestNext = { spec: o, r };
    }
    if (!bestNext || Math.abs(netChange(bestNext.r)) >= Math.abs(net)) break;
    current = bestNext.spec;
    currentResult = bestNext.r;
  }
  // The neighbourhood of the closest line: an equal net can hide a lopsided
  // faction split, so the final pick is by worst edge.
  for (const [da, dh] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]] as const) {
    await measure({ ...current, attack: current.attack + da, health: current.health + dh });
  }
  const ranked = [...cache.values()].sort((a, b) => a.worst - b.worst);
  const bestScreen = ranked[0]!;
  const best = confirm.seeds === screen.seeds ? bestScreen : await testCandidate(buildSignatureCard(bestScreen.spec, { anyStats: true }), bestScreen.spec, confirm);
  log(`  best ${best.id} at ${confirm.seeds} seeds: net ${signed(netChange(best))}  worst ${pct(best.worst)}  ${best.pass ? "PASS" : "fail"}`);
  return {
    start,
    tried: [...cache.values()].map((r) => ({ id: r.id, net: netChange(r), worst: r.worst })),
    best,
    onTable: onTable(best.spec),
  };
}

export interface FactionResult {
  faction: Faction;
  edges: { opponent: Faction; change: PairedChange }[];
  /** Largest |change| over the three edges. */
  worst: number;
  pass: boolean;
}

export interface CandidateResult {
  id: string;
  spec: SignatureSpec;
  seeds: number;
  factions: FactionResult[];
  /** Largest |change| over all twelve edges. */
  worst: number;
  pass: boolean;
}

/** The owner's test for one candidate, against a measured reference. */
export async function testCandidate(card: UnitCard, spec: SignatureSpec, reference: Reference): Promise<CandidateResult> {
  const factions: FactionResult[] = [];
  for (const faction of FACTIONS) {
    const builders = buildersWith({ [faction]: card });
    const edges: FactionResult["edges"] = [];
    for (const opponent of FACTIONS.filter((f) => f !== faction)) {
      const results = await seedResults(faction, opponent, reference.seeds, builders);
      edges.push({ opponent, change: pairedChange(results, reference.results[`${faction}>${opponent}`]!) });
    }
    const worst = Math.max(...edges.map((e) => Math.abs(e.change.diff)));
    factions.push({ faction, edges, worst, pass: worst <= FAIRNESS_LIMIT + 1e-9 });
  }
  const worst = Math.max(...factions.map((f) => f.worst));
  return { id: signatureComboId(spec), spec, seeds: reference.seeds, factions, worst, pass: factions.every((f) => f.pass) };
}

/** One lever setting short of the stat line: the ability's size, its cost
 * tier, and that tier's extra (the 6-cost keyword or the 7-cost aura). */
export type LeverConfig = Pick<SignatureSpec, "ability" | "tier" | "size" | "keyword" | "secondAura">;

/** Every size x tier x extra the table allows for `ability` (owner
 * 2026-10-13: "the size of the ability itself, and the cost tier"). */
export function leverConfigs(ability: string): LeverConfig[] {
  const option = menuOption(ability);
  const out: LeverConfig[] = [];
  for (const size of [undefined, ...option.sizes.map((z) => z.key)]) {
    const keywords = optionAtSize(option, size).keywords;
    const base = size ? { ability, size } : { ability };
    out.push({ ...base, tier: 5 });
    for (const keyword of TIER6_KEYWORDS) if (!keywords.includes(keyword)) out.push({ ...base, tier: 6, keyword });
    for (const aura of SIGNATURE_MENU) if (aura.aura && aura.key !== ability) out.push({ ...base, tier: 7, secondAura: aura.key });
  }
  return out;
}

export interface LeverResult {
  ability: string;
  /** Every table line of every config, at the coarse screen. */
  screened: { id: string; net: number; worst: number }[];
  /** The stat walks from the best configs. */
  walks: TuneResult[];
  /** The best lines overall, re-measured at the confirm seed count, best
   * first. */
  confirmed: CandidateResult[];
}

/**
 * The tuner with all three levers. (1) Every table line of every lever
 * config at the coarse screen. (2) From the `walkFrom` configs whose best
 * table line has the smallest worst edge, the stat walk (tuneCandidate,
 * attack 2 or more). (3) The `confirmTop` best distinct lines over all of
 * it re-measured at the confirm seed count; a candidate passes only on that
 * confirmed measurement.
 */
export async function tuneWithLevers(
  ability: string,
  refs: { coarse: Reference; screen: Reference; confirm: Reference },
  opts: { walkFrom?: number; confirmTop?: number; log?: (s: string) => void } = {},
): Promise<LeverResult> {
  const log = opts.log ?? (() => {});
  const screened: { spec: SignatureSpec; r: CandidateResult }[] = [];
  for (const config of leverConfigs(ability)) {
    for (const [attack, health] of SIGNATURE_TIERS[config.tier as SignatureTier].stats) {
      const spec: SignatureSpec = { ...config, attack, health } as SignatureSpec;
      const r = await testCandidate(buildSignatureCard(spec), spec, refs.coarse);
      screened.push({ spec, r });
      log(`  screen ${r.id.padEnd(44)} net ${signed(netChange(r))}  worst ${pct(r.worst)}`);
    }
  }
  // Best table line per config, then the best configs.
  const configKey = (s: SignatureSpec) => `${s.tier}|${s.size ?? ""}|${s.keyword ?? ""}|${s.secondAura ?? ""}`;
  const bestPerConfig = new Map<string, { spec: SignatureSpec; r: CandidateResult }>();
  for (const x of screened) {
    const k = configKey(x.spec);
    const cur = bestPerConfig.get(k);
    if (!cur || x.r.worst < cur.r.worst) bestPerConfig.set(k, x);
  }
  const starts = [...bestPerConfig.values()].sort((a, b) => a.r.worst - b.r.worst).slice(0, opts.walkFrom ?? 3);
  const walks: TuneResult[] = [];
  for (const start of starts) {
    log(` walk from ${start.r.id}`);
    walks.push(await tuneCandidate(start.spec, refs.screen, refs.screen, log));
  }
  // Candidates for confirmation: every walked line, plus the screened
  // table lines (they may beat a walk), ranked by worst edge at their own
  // seed count. Distinct ids only.
  const pool = new Map<string, { spec: SignatureSpec; worst: number }>();
  for (const w of walks) for (const t of w.tried) if (!pool.has(t.id) || pool.get(t.id)!.worst > t.worst) pool.set(t.id, { spec: specOf(w, t.id), worst: t.worst });
  for (const x of screened) if (!pool.has(x.r.id)) pool.set(x.r.id, { spec: x.spec, worst: x.r.worst });
  const ranked = [...pool.values()].sort((a, b) => a.worst - b.worst).slice(0, opts.confirmTop ?? 3);
  const confirmed: CandidateResult[] = [];
  for (const c of ranked) {
    const r = await testCandidate(buildSignatureCard(c.spec, { anyStats: true }), c.spec, refs.confirm);
    confirmed.push(r);
    log(` confirm ${r.id.padEnd(44)} net ${signed(netChange(r))}  worst ${pct(r.worst)}  ${r.pass ? "PASS" : "fail"}`);
  }
  confirmed.sort((a, b) => a.worst - b.worst);
  return { ability, screened: screened.map((x) => ({ id: x.r.id, net: netChange(x.r), worst: x.r.worst })), walks, confirmed };
}

/** The spec a walk measured under `id` (walks keep the start's levers and
 * change only the stat line). */
function specOf(w: TuneResult, id: string): SignatureSpec {
  const m = /-(\d+)x(\d+)-/.exec(id);
  if (!m) throw new Error(`specOf: ${id}`);
  return { ...w.start, attack: Number(m[1]), health: Number(m[2]) };
}

/** One grid line, compact: the per-edge changes without their intervals
 * (the confirm step keeps the full result). */
export interface GridLine {
  id: string;
  spec: SignatureSpec;
  seeds: number;
  net: number;
  worst: number;
  /** "Faction>Opponent" -> paired change. */
  edges: Record<string, number>;
}

export function compactResult(r: CandidateResult): GridLine {
  const edges: Record<string, number> = {};
  for (const f of r.factions) for (const e of f.edges) edges[`${f.faction}>${e.opponent}`] = Math.round(e.change.diff * 10000) / 10000;
  return { id: r.id, spec: r.spec, seeds: r.seeds, net: netChange(r), worst: r.worst, edges };
}

/**
 * The finer pass's search space (owner 2026-10-15: "a finer tuner pass" on
 * the near misses and the reworked Guardian). Session 33's tuner screened
 * the table lines at 300 seeds and walked greedily from the 3 best configs,
 * so a line next to a noisy screen was never measured. This one measures
 * every size of each option at every body in a fixed grid (attack never
 * below MIN_TUNED_ATTACK), at one seed count, so nothing depends on which
 * line happened to screen well.
 */
export function gridSpecs(abilities: readonly string[], tier: SignatureTier, attacks: readonly number[], healths: readonly number[]): SignatureSpec[] {
  const out: SignatureSpec[] = [];
  for (const ability of abilities) {
    const option = menuOption(ability);
    if (SIGNATURE_TIERS[tier].extra !== "none") throw new Error("gridSpecs covers the cost-5 tier only (no extra to choose)");
    for (const size of [undefined, ...option.sizes.map((z) => z.key)]) {
      for (const attack of attacks) {
        if (attack < MIN_TUNED_ATTACK) throw new Error(`attack ${attack} is below the owner's floor of ${MIN_TUNED_ATTACK}`);
        for (const health of healths) out.push({ ability, tier, attack, health, ...(size ? { size } : {}) });
      }
    }
  }
  return out;
}

const range = (s: string): number[] => {
  const [a, b] = s.split("-").map(Number) as [number, number];
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const pct = (x: number) => (x * 100).toFixed(1);
const signed = (x: number) => `${x >= 0 ? "+" : ""}${pct(x)}`;

function loadReference(seeds: number): Reference {
  if (!existsSync(REFERENCE_FILE)) throw new Error(`No ${REFERENCE_FILE}; run the "reference" command first`);
  const ref = JSON.parse(readFileSync(REFERENCE_FILE, "utf8")) as Reference;
  if (ref.seeds < seeds) throw new Error(`Cached reference has ${ref.seeds} seeds, need ${seeds}`);
  const results = Object.fromEntries(Object.entries(ref.results).map(([k, v]) => [k, v.slice(0, seeds)]));
  return { seeds, results };
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const seeds = Number(arg("seeds") ?? 2500);
  if (command === "reference") {
    const ref = await measureReference(seeds);
    writeFileSync(REFERENCE_FILE, JSON.stringify(ref) + "\n");
    for (const [k, v] of Object.entries(ref.results)) console.log(`${k.padEnd(14)} ${pct([...v].filter((c) => c === "1").length / v.length)}%`);
    return;
  }
  if (command === "candidates") {
    const reference = loadReference(seeds);
    const [shard, shards] = (arg("shard") ?? "0/1").split("/").map(Number) as [number, number];
    const tier = arg("tier");
    const ability = arg("ability");
    const only = arg("ids")?.split(",");
    const out = arg("out");
    const specs = allSignatureSpecs().filter(
      (s) => (!tier || s.tier === Number(tier)) && (!ability || s.ability === ability) && (!only || only.includes(signatureComboId(s))),
    );
    for (const [i, spec] of specs.entries()) {
      if (i % shards !== shard) continue;
      const result = await testCandidate(buildSignatureCard(spec), spec, reference);
      const line = JSON.stringify(result);
      if (out) appendFileSync(out, line + "\n");
      else console.log(line);
      console.error(`${result.id.padEnd(36)} worst ${pct(result.worst)}  ${result.pass ? "PASS" : "fail"}`);
    }
    return;
  }
  if (command === "tune") {
    const ability = arg("ability");
    const tier = Number(arg("tier") ?? 5) as SignatureSpec["tier"];
    if (!ability) throw new Error("tune needs --ability");
    const [attack, health] = SIGNATURE_TIERS[tier].stats[0]!;
    const start: SignatureSpec = { ability, tier, attack, health };
    if (arg("keyword")) start.keyword = arg("keyword") as SignatureSpec["keyword"];
    if (arg("aura")) start.secondAura = arg("aura");
    const screen = loadReference(Number(arg("seeds") ?? 500));
    const confirm = loadReference(Number(arg("confirm") ?? 2500));
    console.error(`tune ${signatureComboId(start)} (screen ${screen.seeds} seeds, confirm ${confirm.seeds})`);
    const result = await tuneCandidate(start, screen, confirm, (s) => console.error(s));
    const out = arg("out");
    if (out) appendFileSync(out, JSON.stringify(result) + "\n");
    else console.log(JSON.stringify(result));
    return;
  }
  if (command === "levers") {
    // --ability K (one option) or --shard i/k over the 16 options.
    const only = arg("ability");
    const [shard, shards] = (arg("shard") ?? "0/1").split("/").map(Number) as [number, number];
    const options = SIGNATURE_MENU.map((o) => o.key).filter((k, i) => (only ? k === only : i % shards === shard));
    const refs = {
      coarse: loadReference(Number(arg("coarse") ?? 300)),
      screen: loadReference(Number(arg("seeds") ?? 500)),
      confirm: loadReference(Number(arg("confirm") ?? 2500)),
    };
    const out = arg("out");
    for (const ability of options) {
      console.error(`levers ${ability} (coarse ${refs.coarse.seeds}, walk ${refs.screen.seeds}, confirm ${refs.confirm.seeds})`);
      const result = await tuneWithLevers(ability, refs, { log: (s) => console.error(s) });
      if (out) appendFileSync(out, JSON.stringify(result) + "\n");
      else console.log(JSON.stringify(result));
    }
    return;
  }
  if (command === "grid") {
    const abilities = (arg("abilities") ?? "").split(",").filter(Boolean);
    if (abilities.length === 0) throw new Error("grid needs --abilities");
    const tier = Number(arg("tier") ?? 5) as SignatureTier;
    const [shard, shards] = (arg("shard") ?? "0/1").split("/").map(Number) as [number, number];
    const reference = loadReference(Number(arg("seeds") ?? 1000));
    const out = arg("out");
    const specs = gridSpecs(abilities, tier, range(arg("attack") ?? "2-4"), range(arg("health") ?? "3-9"));
    for (const [i, spec] of specs.entries()) {
      if (i % shards !== shard) continue;
      const line = compactResult(await testCandidate(buildSignatureCard(spec, { anyStats: true }), spec, reference));
      if (out) appendFileSync(out, JSON.stringify(line) + "\n");
      else console.log(JSON.stringify(line));
      console.error(`${line.id.padEnd(36)} net ${signed(line.net)}  worst ${pct(line.worst)}`);
    }
    return;
  }
  if (command === "confirm") {
    const files = (arg("in") ?? "").split(",").filter(Boolean);
    const top = Number(arg("top") ?? 5);
    const [shard, shards] = (arg("shard") ?? "0/1").split("/").map(Number) as [number, number];
    const reference = loadReference(Number(arg("seeds") ?? 2500));
    const out = arg("out");
    const lines = files.flatMap((f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as GridLine));
    const picks = [...new Set(lines.map((l) => l.spec.ability))].flatMap((ability) =>
      lines.filter((l) => l.spec.ability === ability).sort((a, b) => a.worst - b.worst || a.id.localeCompare(b.id)).slice(0, top),
    );
    for (const [i, pick] of picks.entries()) {
      if (i % shards !== shard) continue;
      const r = await testCandidate(buildSignatureCard(pick.spec, { anyStats: true }), pick.spec, reference);
      if (out) appendFileSync(out, JSON.stringify(r) + "\n");
      else console.log(JSON.stringify(r));
      console.error(`confirm ${r.id.padEnd(36)} net ${signed(netChange(r))}  worst ${pct(r.worst)}  ${r.pass ? "PASS" : "fail"}`);
    }
    return;
  }
  if (command === "report") {
    const files = process.argv.slice(3).filter((a, i, all) => !a.startsWith("--") && !all[i - 1]?.startsWith("--"));
    const rows: CandidateResult[] = files.flatMap((f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as CandidateResult));
    rows.sort((a, b) => a.spec.tier - b.spec.tier || a.worst - b.worst);
    for (const r of rows) {
      const cells = r.factions.map((f) => `${f.faction} ${f.edges.map((e) => signed(e.change.diff)).join("/")}`).join("  ");
      console.log(`${r.pass ? "PASS" : "    "} ${r.id.padEnd(36)} worst ${pct(r.worst).padStart(4)}  ${cells}`);
    }
    return;
  }
  console.error("usage: signatureFairness.ts reference|candidates|tune|levers|grid|confirm|report ...");
  process.exit(2);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
