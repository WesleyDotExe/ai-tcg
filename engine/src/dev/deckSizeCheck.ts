// The deck-size check (owner 2026-10-24, a question for the next owner
// check-in: "a Null-locked owner (starter plus 10 packs, Controller style)
// got a 26-card agent deck. Please confirm what the minimum (and maximum)
// legal deck size is today, where it is defined, and whether a deck under
// 40 cards is intended ... Whether a shorter deck gives an advantage
// (drawing its best cards more often), measured against 40-card decks built
// from the same holdings, and whether the deck builder prefers short decks
// when it doesn't have to. A recommendation ... Test only: no rule change
// without the owner's OK").
//
// Test only: nothing here changes a card, a deck, a rule or the builder.
// Three steps, the games sharded by faction so they run in parallel:
//
//  1. holdings: no games. Why the demo's deck was 26 cards (its holdings,
//     written by economy/src/dev/deckSizeHoldings.ts), and over every
//     realistic collection of the built-deck ring (32 owners at 3, 17 and
//     37 packs, each under all four faction locks) the largest legal deck
//     the cards allow, next to the sizes the store's builder actually kept
//     for the ring's own builds.
//  2. trim <faction>: games. A 40-card deck from a full collection (the
//     builder's rating start, the same cards an owner with the whole set is
//     offered) against the same deck cut to 36, 32, 27 and 20 cards, cut two
//     ways: "best kept" takes out the lowest-rated copy first (the builder's
//     own prior: a short deck that keeps its best cards), "random cut" takes
//     out random copies (the size alone), three cuts per size. Every cut
//     stays legal by the builder's rules. Each deck plays the four shipped
//     decks on the same seeds as the 40-card deck (Lookahead against
//     Lookahead, Calculator, the deck going first on odd seeds: exactly
//     playGauntlet's games), so the two compare game by game.
//  3. report: everything above as one text file.
//
//   npx tsx src/dev/deckSizeCheck.ts holdings --collections c.json --builds dir --demo h.json --out f.json
//   npx tsx src/dev/deckSizeCheck.ts trim <faction> [--seeds n] --out f.json
//   npx tsx src/dev/deckSizeCheck.ts report --dir dir
//
// Each file reproduces byte for byte (no timings are recorded).

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeckFaction } from "../cards/types.js";
import { REMOVAL_DEBUFF_MAX_SHARE, isRemovalOrDebuffCard } from "../cards/poolLint.js";
import { MAX_DECK_SIZE, MAX_NEUTRAL_COPIES, MIN_DECK_SIZE } from "../data/decks.js";
import { SHIPPED_DECK_LISTS, getCard } from "../data/registry.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { cardRating } from "../deckbuilder/cardRating.js";
import { DECK_FACTIONS, buildFaction, constructDeck, deckSpec, drawsCards, formatList, fullHoldings, listProblem, playableCopies, playableHoldings, shippedList, type DeckList, type Holdings } from "../deckbuilder/deckBuilder.js";
import { runMatch } from "../engine/match.js";
import { Rng } from "../state/rng.js";

/** The sizes the 40-card deck is cut to: Null's designed list (36), two
 * between, the demo's largest legal Null deck (27) and the rule's floor. */
export const TRIM_SIZES: readonly number[] = [36, 32, 27, MIN_DECK_SIZE];
/** Random cuts per size. */
export const RANDOM_CUTS = 3;
/** Seeds per shipped opponent (each seed is one game per opponent). */
export const SEEDS = 1000;

function size(list: DeckList): number {
  let n = 0;
  for (const c of list.values()) n += c;
  return n;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
}

// ---- step 1: holdings ----

export interface HoldingsFile {
  demo: {
    copies: number;
    /** Usable copies under a Null lock: Null cards and neutral cards, each at its deck limit. */
    nullCards: number;
    neutralCards: number;
    /** The largest legal Null deck (neutral capped at 10). */
    largest: number;
    /** Both of the builder's starts, as built from these holdings. */
    starts: { from: string; size: number; list: string[] }[];
    /** The store's build of these holdings under the Null lock in Controller, as the demo ran it. */
    build: { chosen: string; size: number; kept: string[]; tried: number; confirm: { label: string; size: number; wins: number; games: number }[] };
  };
  /** One row per (pack level, starting faction, lock faction): the largest legal deck per owner. */
  survey: { packs: number; home: DeckFaction; lock: DeckFaction; largest: (number | null)[] }[];
  /** The sizes the store's builder kept in the built-deck ring (home faction only). */
  ringBuilds: { level: string; faction: DeckFaction; largest: (number | null)[]; kept: number[]; chosen: string[] }[];
}

/** The largest legal deck `holdings` allows under `faction`: the rating
 * start, which fills to 40 while any usable card is left (and trims removal
 * to the 25% share of a short deck), or null when none can be built. */
export function largestDeck(holdings: Holdings, faction: DeckFaction): number | null {
  const built = constructDeck(faction, holdings);
  const designed = constructDeck(faction, holdings, shippedList(faction));
  const sizes = [built, designed].flatMap((b) => ("list" in b ? [size(b.list)] : []));
  return sizes.length === 0 ? null : Math.max(...sizes);
}

async function holdingsStep(): Promise<HoldingsFile> {
  const demoPath = arg("demo");
  const collectionsPath = arg("collections");
  const buildsDir = arg("builds");
  if (!demoPath || !collectionsPath || !buildsDir) throw new Error("holdings needs --demo, --collections and --builds");
  const demoFile = JSON.parse(readFileSync(demoPath, "utf8")) as { copies: number; holdings: [string, number][] };
  const demo = new Map(demoFile.holdings);
  let nullCards = 0;
  let neutralCards = 0;
  for (const [id, n] of playableHoldings(demo, "Null")) {
    if (getCard(id)!.faction === "Null") nullCards += n;
    else neutralCards += n;
  }
  const starts: HoldingsFile["demo"]["starts"] = [];
  for (const [from, b] of [["rating", constructDeck("Null", demo)], ["designed", constructDeck("Null", demo, shippedList("Null"))]] as const) {
    if ("list" in b) starts.push({ from, size: size(b.list), list: formatList(b.list) });
  }

  // The demo's own build: the store passes no build options (DEFAULT_BUILD), the lock and the style.
  const fb = await buildFaction("Null", demo, { style: "controller" });
  const searched = fb.chosen === "searched" ? [{ label: "searched", size: size(fb.deck!), wins: fb.score!.wins, games: fb.score!.games }] : [];
  const build = {
    chosen: fb.chosen!,
    size: size(fb.deck!),
    kept: fb.kept,
    tried: fb.tried,
    confirm: [...fb.starts.map((s) => ({ label: `${s.from} start`, size: size(s.list), wins: s.score!.wins, games: s.score!.games })), ...searched],
  };

  const collections = (JSON.parse(readFileSync(collectionsPath, "utf8")) as { collections: { faction: DeckFaction; owner: number; packs: number; holdings: [string, number][] }[] }).collections;
  const levels = [...new Set(collections.map((c) => c.packs))].sort((a, b) => a - b);
  const survey: HoldingsFile["survey"] = [];
  for (const packs of levels) {
    for (const home of DECK_FACTIONS) {
      const owners = collections.filter((c) => c.packs === packs && c.faction === home).sort((a, b) => a.owner - b.owner);
      for (const lock of DECK_FACTIONS) survey.push({ packs, home, lock, largest: owners.map((o) => largestDeck(new Map(o.holdings), lock)) });
    }
  }

  const ringBuilds: HoldingsFile["ringBuilds"] = [];
  for (const level of ["3", "17", "37", "full"]) {
    for (const faction of DECK_FACTIONS) {
      const file = JSON.parse(readFileSync(join(buildsDir, `${level}-${faction}.json`), "utf8")) as { decks: { owner: number; list: [string, number][]; chosen: string }[] };
      const largest = file.decks.map((d) => {
        if (level === "full") return largestDeck(fullHoldings(), faction);
        const c = collections.find((x) => x.packs === Number(level) && x.faction === faction && x.owner === d.owner)!;
        return largestDeck(new Map(c.holdings), faction);
      });
      ringBuilds.push({ level, faction, largest, kept: file.decks.map((d) => size(new Map(d.list))), chosen: file.decks.map((d) => d.chosen) });
    }
  }
  return { demo: { copies: demoFile.copies, nullCards, neutralCards, largest: Math.min(MAX_DECK_SIZE, nullCards + Math.min(MAX_NEUTRAL_COPIES, neutralCards)), starts, build }, survey, ringBuilds };
}

// ---- step 2: trim ----

export interface DeckResult {
  label: string;
  size: number;
  /** Games won of `games`, and per shipped opponent. */
  wins: number;
  games: number;
  byOpponent: Record<DeckFaction, number>;
  /** Against the 40-card deck on the same seeds: games this deck won that it lost, and the reverse. */
  gained: number;
  lost: number;
  /** Games in which this deck's side drew from an empty deck (fatigue). */
  fatigueGames: number;
  /** Cards this side drew, on average (opening hand included). */
  meanDrawn: number;
  /** The average match length, in turns. */
  meanTurns: number;
  list: [string, number][];
}

export interface TrimFile {
  faction: DeckFaction;
  seeds: number;
  base: DeckResult;
  cuts: { size: number; best: DeckResult; random: DeckResult[] }[];
  /** Size alone (PROPORTIONAL_PAIRS): the same cards in the same proportions at two sizes, on the same seeds. */
  proportional: { big: DeckResult; small: DeckResult }[];
  /** The cut that won most above, and the 40-card deck, replayed on fresh seeds (selection
   * on the first seeds inflates the winner's number; these seeds never chose it). */
  fresh: { firstSeed: number; base: DeckResult; winner: DeckResult };
}

/** The first seed of the fresh replay. */
export const FRESH_SEED = 1_000_001;

/** The same-proportion pairs: `distinct` cards at `high` copies each
 * against the same cards at `low` copies each. */
export const PROPORTIONAL_PAIRS: readonly { distinct: number; high: number; low: number }[] = [
  { distinct: 20, high: 2, low: 1 },
  { distinct: 13, high: 3, low: 2 },
];

/** `distinct` cards that may run `high` copies: `list`'s own, most copies
 * first (then rating, then id), then the rest of the pool by rating, chosen
 * so that both the `high`-copy and the `low`-copy deck are legal; throws if
 * no such cards exist. */
export function proportionalPair(list: DeckList, faction: DeckFaction, holdings: Holdings, distinct: number, high: number, low: number): { big: DeckList; small: DeckList } {
  // The deck's own cards first; when too few of them fit, the faction's and
  // the neutral pool's other cards, best rated first.
  const fits = (id: string) => (holdings.get(id) ?? 0) >= high && playableCopies(getCard(id)!, Infinity) >= high;
  const rest = [...holdings.keys()]
    .filter((id) => !list.has(id) && [faction, "Neutral"].includes(getCard(id)!.faction))
    .sort((a, b) => cardRating(getCard(b)!) - cardRating(getCard(a)!) || a.localeCompare(b));
  // A faction card that draws goes first (the pool lint needs one, and the
  // greedy fill below can run out of room before reaching it).
  const ranked0 = [
    ...[...list.keys()].sort((a, b) => list.get(b)! - list.get(a)! || cardRating(getCard(b)!) - cardRating(getCard(a)!) || a.localeCompare(b)),
    ...rest,
  ].filter(fits);
  // (Null's only one at 3 copies is an evolution, so its base comes with it.)
  const baseOf = (id: string) => { const c = getCard(id)!; return c.type === "Unit" ? c.evolvesFrom : undefined; };
  const drawer = ranked0.find((id) => getCard(id)!.faction === faction && drawsCards(getCard(id)!) && (!baseOf(id) || ranked0.includes(baseOf(id)!)));
  const head = drawer ? [...(baseOf(drawer) ? [baseOf(drawer)!] : []), drawer] : [];
  const ranked = [...head, ...ranked0.filter((id) => !head.includes(id))];
  // Removal is held to the 25% share of the whole list as the list grows;
  // an evolution waits for its base (the second pass picks it up).
  const removalCap = Math.floor(REMOVAL_DEBUFF_MAX_SHARE * distinct);
  const chosen: string[] = [];
  const legal = (ids: string[], copies: number) => listProblem(new Map(ids.map((id) => [id, copies])), faction, holdings);
  // Greedy: take each card in rank order while both decks can still be made
  // legal; the checks that depend on the whole list (size, a card that
  // draws, an attacker) are read only at the end.
  const later = /cards, outside|no faction card that draws|no faction unit that attacks|removal cards of/;
  for (const id of [...ranked, ...ranked]) {
    if (chosen.length === distinct) break;
    if (chosen.includes(id)) continue;
    const card = getCard(id)!;
    if (card.type === "Unit" && card.evolvesFrom && !chosen.includes(card.evolvesFrom)) continue;
    if (isRemovalOrDebuffCard(card) && chosen.filter((c) => isRemovalOrDebuffCard(getCard(c)!)).length >= removalCap) continue;
    const next = [...chosen, id];
    const p = legal(next, high);
    if (p && !later.test(p)) continue;
    const q = legal(next, low);
    if (q && !later.test(q)) continue;
    chosen.push(id);
  }
  const problem = legal(chosen, high) ?? legal(chosen, low);
  if (chosen.length < distinct || problem) throw new Error(`${faction}: no legal ${distinct}-card pair (${chosen.length} cards; ${problem})`);
  return { big: new Map(chosen.map((id) => [id, high])), small: new Map(chosen.map((id) => [id, low])) };
}

/** The deck's copies that can come out with the list staying legal by the
 * builder's rules (an evolution's last base never goes before it does). */
function removable(list: DeckList, faction: DeckFaction, holdings: Holdings): string[] {
  return [...list.keys()].filter((id) => {
    const next = new Map(list);
    const n = next.get(id)! - 1;
    if (n > 0) next.set(id, n);
    else next.delete(id);
    return listProblem(next, faction, holdings) === undefined;
  });
}

/** `list` cut to `target` cards, one copy at a time: the lowest-rated
 * removable copy (`rng` absent) or a random removable copy. Throws if no
 * legal cut gets there. */
export function cutTo(list: DeckList, target: number, faction: DeckFaction, holdings: Holdings, rng?: Rng): DeckList {
  const out = new Map(list);
  while (size(out) > target) {
    let options = removable(out, faction, holdings);
    if (options.length === 0) throw new Error(`no legal cut of the ${faction} deck below ${size(out)} cards`);
    options = options.sort((a, b) => a.localeCompare(b));
    const id = rng ? rng.pick(options) : options.sort((a, b) => cardRating(getCard(a)!) - cardRating(getCard(b)!) || a.localeCompare(b))[0]!;
    const n = out.get(id)! - 1;
    if (n > 0) out.set(id, n);
    else out.delete(id);
  }
  return out;
}

/** playGauntlet's games (same seeds, agents and seating), also counting
 * fatigue, cards drawn and turns for the deck's side. */
async function gauntlet(label: string, list: DeckList, seeds: number, base?: boolean[], firstSeed = 1): Promise<{ result: DeckResult; results: boolean[] }> {
  const results: boolean[] = [];
  const byOpponent = {} as Record<DeckFaction, number>;
  let fatigueGames = 0;
  let drawn = 0;
  let turns = 0;
  for (const opponent of DECK_FACTIONS) {
    let wins = 0;
    for (let seed = firstSeed; seed < firstSeed + seeds; seed++) {
      const mine = deckSpec(list, "p1", "Built deck");
      const theirs = deckSpec(shippedList(opponent), "p2", `${opponent} (shipped)`);
      const a = new LookaheadAgent("Builder", seed * 104729 + 31);
      const b = new LookaheadAgent(`Shipped-${opponent}`, seed * 104729 + 31);
      const first = seed % 2 === 1;
      const { state } = first ? await runMatch(mine, theirs, a, b, seed) : await runMatch({ ...theirs, id: "p1" }, { ...mine, id: "p2" }, b, a, seed);
      const me = first ? "p1" : "p2";
      const won = state.winner === me;
      results.push(won);
      if (won) wins++;
      if (state.log.some((e) => e.type === "fatigue" && e.player === me)) fatigueGames++;
      // The opening hand is dealt before the log starts; every later card is a "draw" event.
      drawn += 4 + state.log.filter((e) => e.type === "draw" && e.player === me).length;
      turns += state.turnNumber;
    }
    byOpponent[opponent] = wins / seeds;
  }
  let gained = 0;
  let lost = 0;
  if (base) {
    results.forEach((w, i) => {
      if (w && !base[i]) gained++;
      if (!w && base[i]) lost++;
    });
  }
  const games = results.length;
  return {
    results,
    result: {
      label,
      size: size(list),
      wins: results.filter(Boolean).length,
      games,
      byOpponent,
      gained,
      lost,
      fatigueGames,
      meanDrawn: Math.round((drawn / games) * 100) / 100,
      meanTurns: Math.round((turns / games) * 100) / 100,
      list: [...list].sort(([x], [y]) => x.localeCompare(y)),
    },
  };
}

async function trimStep(faction: DeckFaction, seeds: number): Promise<TrimFile> {
  const holdings = fullHoldings();
  const start = constructDeck(faction, holdings);
  if (!("list" in start)) throw new Error(`${faction}: ${start.infeasible}`);
  if (size(start.list) !== MAX_DECK_SIZE) throw new Error(`${faction}: the full-collection rating start is ${size(start.list)} cards, not ${MAX_DECK_SIZE}`);
  const base = await gauntlet("40 cards", start.list, seeds);
  const cuts: TrimFile["cuts"] = [];
  for (const target of TRIM_SIZES) {
    const best = await gauntlet(`${target}, best kept`, cutTo(start.list, target, faction, holdings), seeds, base.results);
    const random: DeckResult[] = [];
    for (let k = 0; k < RANDOM_CUTS; k++) {
      const rng = new Rng(57_000 + DECK_FACTIONS.indexOf(faction) * 1_000 + target * 10 + k);
      random.push((await gauntlet(`${target}, random cut ${k + 1}`, cutTo(start.list, target, faction, holdings, rng), seeds, base.results)).result);
    }
    cuts.push({ size: target, best: best.result, random });
  }
  const proportional: TrimFile["proportional"] = [];
  for (const { distinct, high, low } of PROPORTIONAL_PAIRS) {
    const pair = proportionalPair(start.list, faction, holdings, distinct, high, low);
    const big = await gauntlet(`${distinct} cards x${high} = ${distinct * high}`, pair.big, seeds);
    const small = await gauntlet(`${distinct} cards x${low} = ${distinct * low}`, pair.small, seeds, big.results);
    proportional.push({ big: big.result, small: small.result });
  }

  const all = cuts.flatMap((c) => [c.best, ...c.random]);
  const top = all.reduce((a, b) => (b.wins > a.wins ? b : a));
  const freshBase = await gauntlet("40 cards", start.list, seeds, undefined, FRESH_SEED);
  const winner = await gauntlet(top.label, new Map(top.list), seeds, freshBase.results, FRESH_SEED);
  return { faction, seeds, base: base.result, cuts, proportional, fresh: { firstSeed: FRESH_SEED, base: freshBase.result, winner: winner.result } };
}

// ---- step 3: report ----

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Paired sign test of a deck against the 40-card deck: (gained - lost) / sqrt(gained + lost). */
export function pairedZ(r: DeckResult): number {
  return r.gained + r.lost === 0 ? 0 : (r.gained - r.lost) / Math.sqrt(r.gained + r.lost);
}

function row(r: DeckResult, base: DeckResult): string {
  const delta = (r.wins - base.wins) / r.games;
  const opp = DECK_FACTIONS.map((f) => `${f.slice(0, 2)} ${(r.byOpponent[f] * 100).toFixed(0).padStart(3)}`).join(" ");
  const vs = r === base ? "".padEnd(26) : `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)} pts (z ${pairedZ(r).toFixed(1).padStart(4)})`.padEnd(26);
  return `  ${r.label.padEnd(20)} ${pct(r.wins / r.games).padStart(6)}  ${vs} ${opp}   fatigue ${pct(r.fatigueGames / r.games).padStart(5)}  drawn ${r.meanDrawn.toFixed(1).padStart(4)}  turns ${r.meanTurns.toFixed(1)}`;
}

function sizesLine(xs: (number | null)[]): string {
  return xs.map((x) => (x === null ? "--" : String(x))).join(" ");
}

function report(dir: string): string {
  const h = JSON.parse(readFileSync(join(dir, "holdings.json"), "utf8")) as HoldingsFile;
  const trims = readdirSync(dir)
    .filter((f) => f.startsWith("trim-"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as TrimFile)
    .sort((a, b) => DECK_FACTIONS.indexOf(a.faction) - DECK_FACTIONS.indexOf(b.faction));
  const out: string[] = [];
  const say = (line = "") => out.push(line);
  say("Deck-size check (owner 2026-10-24's question). Test only: no card, deck, rule or builder change.");
  say("Written by engine/src/dev/deckSizeCheck.ts from the files in progress/deck-size/.");
  say();
  say("== 1. The rule today ==");
  say(`  Legal size: ${MIN_DECK_SIZE} to ${MAX_DECK_SIZE} cards (MIN_DECK_SIZE, MAX_DECK_SIZE in engine/src/data/decks.ts;`);
  say("  buildDeck throws outside it, so every deck that plays, built, saved or shipped, passes it).");
  say(`  The builder imports the same two constants (engine/src/deckbuilder/deckBuilder.ts, MIN_DECK/MAX_DECK).`);
  say("  The floor was set at stage 3 so the first small test pools (23 and 32 cards) still built; the");
  say("  stage-3 note called both numbers a first proposal, not a playtested target.");
  say(`  Shipped decks: ${DECK_FACTIONS.map((f) => `${f} ${SHIPPED_DECK_LISTS[f].reduce((s, e) => s + e.copies, 0)}`).join(", ")}.`);
  say(`  Other rules that cap size: copy limits (3/3/2/1 by rarity, 1 per Zero-Day card), at most ${MAX_NEUTRAL_COPIES} neutral`);
  say("  cards, removal at most 25% of the deck. An empty deck does not lose: each draw from it deals 2 fatigue.");
  say("  How the builder picks a size: the rating start fills to 40 while any usable card is left; the");
  say("  designed start fills to the shipped list's own size (Null 36); the search's one-in-five size");
  say("  changes grow or shrink by one copy, kept only when it wins clearly more of the same games;");
  say("  the confirm step keeps the best of the searched deck and the starts on fresh seeds.");
  say();
  say("== 2. The demo's 26-card Null deck ==");
  say(`  The demo owner (Cortex starter + 10 packs, ${h.demo.copies} cards) holds ${h.demo.nullCards} usable Null copies and ${h.demo.neutralCards} usable neutral ones`);
  say(`  (each at its deck limit). With at most ${MAX_NEUTRAL_COPIES} neutral cards, the largest legal Null deck is ${h.demo.largest} cards.`);
  for (const s of h.demo.starts) say(`  The ${s.from} start: ${s.size} cards${s.size === h.demo.largest ? " (every usable card, neutral capped)" : ""}.`);
  const b = h.demo.build;
  say(`  The store's build of it (Null lock, Controller, default settings), re-run here: ${b.tried} changes tried, kept:`);
  for (const k of b.kept) say(`    ${k}`);
  if (b.kept.length === 0) say("    none");
  say(`  Fresh seeds: ${b.confirm.map((c) => `${c.label} (${c.size} cards) ${c.wins} of ${c.games}`).join(", ")}; the ${b.chosen} deck, ${b.size} cards, is kept.`);
  if (h.demo.starts.some((s) => s.size === h.demo.largest)) say(`  Nothing could make it 40: every usable card is already in the start.`);
  say("  The rating start's list:");
  for (const line of h.demo.starts[0]?.list ?? []) say(`    ${line}`);
  say();
  say("== 3. How often the cards cap the size (no games) ==");
  say("  The largest legal deck per owner (8 owners each), from the built-deck ring's realistic collections");
  say("  (each faction's starter plus packs from the live roller), under each faction lock. -- = none legal.");
  for (const packs of [...new Set(h.survey.map((s) => s.packs))]) {
    say(`  ${packs} packs:`);
    for (const home of DECK_FACTIONS) {
      const cells = DECK_FACTIONS.map((lock) => {
        const r = h.survey.find((s) => s.packs === packs && s.home === home && s.lock === lock)!;
        return `${lock}: ${sizesLine(r.largest)}`;
      });
      say(`    ${(home + " starter").padEnd(15)} ${cells.join(" | ")}`);
    }
  }
  const home = h.survey.filter((s) => s.home === s.lock).flatMap((s) => s.largest);
  const off = h.survey.filter((s) => s.home !== s.lock).flatMap((s) => s.largest);
  const under = (xs: (number | null)[]) => `${xs.filter((x) => x !== null && x < MAX_DECK_SIZE).length} of ${xs.length} under 40, ${xs.filter((x) => x === null).length} none legal`;
  say(`  Own faction: ${under(home)}. Another faction's lock: ${under(off)}.`);
  say();
  say("  What the store's builder kept in the built-deck ring (own faction, store settings), beside the largest");
  say("  legal deck the same holdings allow:");
  for (const r of h.ringBuilds) {
    say(`    ${(r.level === "full" ? "full" : `${r.level} packs`).padEnd(8)} ${r.faction.padEnd(7)} kept ${r.kept.join(" ").padEnd(24)} largest ${sizesLine(r.largest).padEnd(24)} chosen ${r.chosen.join(",")}`);
  }
  const kept = h.ringBuilds.flatMap((r) => r.kept.map((k, i) => ({ k, max: r.largest[i]!, chosen: r.chosen[i]!, f: r.faction })));
  const shortBy = kept.filter((x) => x.k < x.max);
  say(`  ${shortBy.length} of ${kept.length} kept decks are shorter than the holdings allow: by ${[...new Set(shortBy.map((x) => x.max - x.k))].sort((a, b) => a - b).join(" or ")} cards.`);
  say(`  Of those, ${shortBy.filter((x) => x.f === "Null" && x.chosen === "designed").length} are Null's designed start (the shipped list's 36), the rest searched cuts.`);
  say();
  say("== 4. Does a shorter deck win more? (games) ==");
  if (trims.length > 0) {
    say(`  A 40-card deck from a full collection (the rating start) against itself cut to ${TRIM_SIZES.join(", ")}.`);
    say(`  ${trims[0]!.seeds} seeds x 4 shipped opponents = ${trims[0]!.seeds * 4} games per deck, the same games for every deck;`);
    say("  z is the paired sign test against the 40-card deck (|z| > 2 is a real difference).");
    say("  'best kept' cuts the lowest-rated copies first; 'random cut' cuts random copies (three cuts, averaged");
    say("  in the 'random, mean' line). fatigue = games where the deck's side drew from an empty deck.");
    for (const t of trims) {
      say();
      say(`  ${t.faction}:`);
      say(row(t.base, t.base));
      for (const c of t.cuts) {
        say(row(c.best, t.base));
        for (const r of c.random) say(row(r, t.base));
        const mean = c.random.reduce((s, r) => s + r.wins, 0) / c.random.reduce((s, r) => s + r.games, 0);
        const d = mean - t.base.wins / t.base.games;
        say(`  ${`${c.size}, random, mean`.padEnd(20)} ${pct(mean).padStart(6)}  ${d >= 0 ? "+" : ""}${(d * 100).toFixed(1)} pts`);
      }
    }
    say();
    say("  Size alone: the same cards in the same proportions at two sizes (20 cards at 2 copies against 1 copy;");
    say("  13 cards at 3 copies against 2). The cards are each 40-card deck's own, most copies first, then the");
    say("  best-rated others where too few fit; z pairs the smaller deck against the larger.");
    for (const t of trims) {
      say(`  ${t.faction}:`);
      for (const p of t.proportional) {
        say(row(p.big, p.big));
        say(row(p.small, p.big));
      }
    }
    say();
    say(`  The best cut of each faction above, replayed on fresh seeds (from ${trims[0]!.fresh.firstSeed}) beside the 40-card deck:`);
    for (const t of trims) {
      say(`  ${t.faction}:`);
      say(row(t.fresh.base, t.fresh.base));
      say(row(t.fresh.winner, t.fresh.base));
    }
    say();
    say("  Summary, points against the 40-card deck (best kept / random mean):");
    for (const t of trims) {
      const cells = t.cuts.map((c) => {
        const b = ((c.best.wins - t.base.wins) / t.base.games) * 100;
        const r = (c.random.reduce((s, x) => s + x.wins, 0) / c.random.reduce((s, x) => s + x.games, 0) - t.base.wins / t.base.games) * 100;
        const f = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}`;
        return `${c.size}: ${f(b)} / ${f(r)}`;
      });
      say(`    ${t.faction.padEnd(7)} ${cells.join("   ")}`);
    }
    say();
    say("  The 40-card decks:");
    for (const t of trims) {
      say(`    ${t.faction}: ${t.base.list.map(([id, n]) => `${n}x ${getCard(id)!.name}`).join(", ")}`);
    }
    say("  Removal copies stay within 25% of every cut deck (checked by listProblem on each cut).");
  }
  return out.join("\n") + "\n";
}

// ---- entry ----

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [step, faction] = process.argv.slice(2);
  const outPath = arg("out");
  if (step === "holdings") {
    writeFileSync(outPath!, JSON.stringify(await holdingsStep(), null, 1) + "\n");
  } else if (step === "trim") {
    if (!DECK_FACTIONS.includes(faction as DeckFaction)) throw new Error(`trim needs a faction, got "${faction}"`);
    const seeds = Number(arg("seeds") ?? SEEDS);
    writeFileSync(outPath!, JSON.stringify(await trimStep(faction as DeckFaction, seeds), null, 1) + "\n");
  } else if (step === "report") {
    process.stdout.write(report(arg("dir")!));
  } else {
    throw new Error("step is holdings, trim <faction> or report");
  }
}
