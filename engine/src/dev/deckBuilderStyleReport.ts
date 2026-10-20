// The deck builder measured in each play style (roadmap 2b part 3; owner
// 2026-10-20, call 6: "the deck builder still builds with Calculator; making
// it use the agent's style is the next step for 2b").
//
// Two questions, from a full collection (every live card at its deck limit):
//  1. Build: does each style build a different deck, and pick a different
//     faction? `buildFaction` runs per faction with the style playing the
//     built deck in the confirm step (the shipped opponents play
//     Calculator), exactly as the store's agent deck is built. The search
//     plays Calculator (the builder's default) or, with `--search own`, the
//     style itself (the session-53 experiment that set that default).
//  2. Cross: does a style play its own deck better than the deck Calculator
//     built? Every style pilots every style's built deck (and the shipped
//     deck) against the four shipped decks on seeds neither the search nor
//     the confirm step saw. The gain is paired seed by seed against the
//     Calculator-built deck under the same pilot, so deal and shuffle cancel.
//
//   npx tsx src/dev/deckBuilderStyleReport.ts build <style> [--search calculator|own] [--games 100] [--trials 60] [--confirm 500] --out f.json
//   npx tsx src/dev/deckBuilderStyleReport.ts cross <pilot> --builds dir [--games 500] --out f.json
//   npx tsx src/dev/deckBuilderStyleReport.ts report --builds dir --cross dir
//
// Every step is deterministic: the same arguments write the same file.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLAY_STYLE_IDS, PLAY_STYLES, isPlayStyleId, type PlayStyleId } from "../agents/playStyles.js";
import type { DeckFaction } from "../cards/types.js";
import { getCard } from "../data/registry.js";
import { DECK_FACTIONS, buildFaction, formatList, fullHoldings, playGauntlet, shippedList, type DeckList, type GauntletScore } from "../deckbuilder/deckBuilder.js";
import { wilson } from "./edgeMeasure.js";

/** The cross step's first seed: past the search's (1...) and the confirm's (1,000,001...). */
export const CROSS_SEED = 3_000_001;

export interface StyleBuildFile {
  style: PlayStyleId;
  /** The style the search played in. */
  searchStyle: PlayStyleId;
  games: number;
  trials: number;
  confirmGames: number;
  factions: {
    faction: DeckFaction;
    list: [string, number][];
    chosen: string;
    searchedFrom: string;
    kept: string[];
    tried: number;
    score: GauntletScore;
    starts: { from: string; score: GauntletScore }[];
  }[];
}

export interface StyleCrossFile {
  pilot: PlayStyleId;
  firstSeed: number;
  games: number;
  /** Per faction, per deck ("shipped" or the style that built it): each game's result, "1" won. */
  results: Record<string, Record<string, string>>;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
}

function styleArg(x: string | undefined): PlayStyleId {
  if (!x || !isPlayStyleId(x)) throw new Error(`expected a play style (${PLAY_STYLE_IDS.join(", ")}), got "${x}"`);
  return x;
}

const listOf = (pairs: [string, number][]): DeckList => new Map(pairs);

function readDir<T>(dir: string): T[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as T);
}

async function build(style: PlayStyleId): Promise<StyleBuildFile> {
  const games = Number(arg("games") ?? 100);
  const trials = Number(arg("trials") ?? 60);
  const confirmGames = Number(arg("confirm") ?? 500);
  const search = arg("search") ?? "calculator";
  if (search !== "calculator" && search !== "own") throw new Error(`--search is "calculator" or "own", got "${search}"`);
  const searchStyle: PlayStyleId = search === "own" ? style : "calculator";
  const full = fullHoldings();
  const out: StyleBuildFile = { style, searchStyle, games, trials, confirmGames, factions: [] };
  for (const faction of DECK_FACTIONS) {
    const b = await buildFaction(faction, full, { games, trials, confirmGames, style, searchStyle, log: (l) => console.error(`[${style}] ${l}`) });
    out.factions.push({
      faction,
      list: [...b.deck!].sort(([a], [c]) => a.localeCompare(c)),
      chosen: b.chosen!,
      searchedFrom: b.searchedFrom!,
      kept: b.kept,
      tried: b.tried,
      score: b.score!,
      starts: b.starts.map((st) => ({ from: st.from, score: st.score! })),
    });
  }
  return out;
}

async function cross(pilot: PlayStyleId, builds: StyleBuildFile[]): Promise<StyleCrossFile> {
  const games = Number(arg("games") ?? 500);
  const out: StyleCrossFile = { pilot, firstSeed: CROSS_SEED, games, results: {} };
  for (const faction of DECK_FACTIONS) {
    const decks: [string, DeckList][] = [["shipped", shippedList(faction)], ...builds.map((b) => [b.style, listOf(b.factions.find((f) => f.faction === faction)!.list)] as [string, DeckList])];
    const row: Record<string, string> = {};
    for (const [name, list] of decks) {
      const { results } = await playGauntlet(list, CROSS_SEED, games, pilot);
      row[name] = results.map((w) => (w ? "1" : "0")).join("");
      console.error(`[${pilot}] ${faction} ${name}: ${results.filter(Boolean).length} of ${results.length}`);
    }
    out.results[faction] = row;
  }
  return out;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}`;
const signed = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}`;
const rate = (s: string) => [...s].filter((c) => c === "1").length / s.length;

/** Paired difference a - b over the same seeds, with one standard error
 * from the discordant games (the sign test's spread). */
function paired(a: string, b: string): { diff: number; se: number } {
  let gained = 0;
  let lost = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "1" && b[i] === "0") gained++;
    if (a[i] === "0" && b[i] === "1") lost++;
  }
  return { diff: (gained - lost) / a.length, se: Math.sqrt(gained + lost) / a.length };
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

function report(builds: StyleBuildFile[], crosses: StyleCrossFile[]): void {
  const order = (s: PlayStyleId) => PLAY_STYLE_IDS.indexOf(s);
  builds.sort((a, b) => order(a.style) - order(b.style));
  crosses.sort((a, b) => order(a.pilot) - order(b.pilot));
  const calc = builds.find((b) => b.style === "calculator");
  if (!calc) throw new Error("the report needs Calculator's build");
  const b0 = builds[0]!;
  const c0 = crosses[0];
  console.log("Deck builder by play style (roadmap 2b part 3)");
  console.log(`From a full collection. Build: ${b0.trials} one-copy changes per faction, ${b0.games} games per shipped opponent each; confirm on ${b0.confirmGames} per opponent (fresh seeds from 1000001).`);
  if (c0) console.log(`Cross: every style pilots every style's deck, ${c0.games} games per shipped opponent (${c0.games * 4} per cell), seeds from ${c0.firstSeed}, unseen by any build.`);
  const searchOwn = builds.some((b) => b.searchStyle === b.style && b.style !== "calculator");
  console.log(
    searchOwn
      ? "Search and confirm both play the built deck in the style (the --search own experiment)."
      : "The search plays the built deck as Calculator (the builder's default); the confirm step, which picks the deck kept, plays it in the style.",
  );
  console.log("The four shipped opponents always play Calculator. Win rates count draws as not won.");
  console.log("");

  console.log("== 1. What each style built (confirm-step win rate against the four shipped decks) ==");
  console.log(`${"style".padEnd(12)}${DECK_FACTIONS.map((f) => f.padStart(9)).join("")}   free pick`);
  for (const b of builds) {
    const cells = DECK_FACTIONS.map((f) => {
      const x = b.factions.find((y) => y.faction === f)!;
      return pct(x.score.wins / x.score.games).padStart(9);
    });
    const best = b.factions.reduce((a, c) => (c.score.wins / c.score.games > a.score.wins / a.score.games ? c : a));
    console.log(`${PLAY_STYLES[b.style].name.padEnd(12)}${cells.join("")}   ${best.faction}`);
  }
  console.log("");
  console.log("How each style's deck differs from Calculator's (the deck it kept: a start, or the searched deck):");
  for (const b of builds) {
    if (b.style === "calculator") continue;
    console.log(`-- ${PLAY_STYLES[b.style].name} --`);
    for (const f of DECK_FACTIONS) {
      const mine = b.factions.find((x) => x.faction === f)!;
      const theirs = calc.factions.find((x) => x.faction === f)!;
      const d = listDiff(listOf(mine.list), listOf(theirs.list));
      console.log(`  ${f.padEnd(7)}${mine.chosen.padEnd(9)}${d === "" ? "same deck as Calculator" : d}`);
    }
  }
  console.log("");

  if (crosses.length > 0) {
    console.log("== 2. Cross: each pilot style with each style's deck (win rate % on the cross seeds) ==");
    for (const f of DECK_FACTIONS) {
      console.log(`-- ${f} --`);
      console.log(`${"pilot \\ deck".padEnd(12)}${["shipped", ...builds.map((b) => b.style)].map((d) => (d === "shipped" ? "shipped" : PLAY_STYLES[d as PlayStyleId].name).padStart(11)).join("")}`);
      for (const c of crosses) {
        const row = c.results[f]!;
        const cells = ["shipped", ...builds.map((b) => b.style)].map((d) => {
          const own = d === c.pilot ? "*" : " ";
          return `${pct(rate(row[d]!))}${own}`.padStart(11);
        });
        console.log(`${PLAY_STYLES[c.pilot].name.padEnd(12)}${cells.join("")}`);
      }
    }
    console.log("(* = the pilot's own deck)");
    console.log("");

    console.log("== 3. The gain: each pilot with its own deck vs with Calculator's deck (paired, points, ± 1 s.e.) ==");
    console.log(`${"pilot".padEnd(12)}${DECK_FACTIONS.map((f) => f.padStart(15)).join("")}${"all four".padStart(15)}`);
    for (const c of crosses) {
      if (c.pilot === "calculator") continue;
      let num = 0;
      let disc = 0;
      let n = 0;
      const cells = DECK_FACTIONS.map((f) => {
        const row = c.results[f]!;
        const p = paired(row[c.pilot]!, row.calculator!);
        num += p.diff * row[c.pilot]!.length;
        disc += (p.se * row[c.pilot]!.length) ** 2;
        n += row[c.pilot]!.length;
        return (row[c.pilot] === row.calculator ? "same" : `${signed(p.diff)} ±${(p.se * 100).toFixed(1)}`).padStart(15);
      });
      console.log(`${PLAY_STYLES[c.pilot].name.padEnd(12)}${cells.join("")}${`${signed(num / n)} ±${((Math.sqrt(disc) / n) * 100).toFixed(1)}`.padStart(15)}`);
    }
    console.log("");
    const calcCross = crosses.find((c) => c.pilot === "calculator");
    if (calcCross) {
      console.log("Calculator piloting each style's deck (does a style's deck only suit its style?), vs Calculator's own deck:");
      for (const b of builds) {
        if (b.style === "calculator") continue;
        const cells = DECK_FACTIONS.map((f) => {
          const row = calcCross.results[f]!;
          const p = paired(row[b.style]!, row.calculator!);
          return (row[b.style] === row.calculator ? "same" : `${signed(p.diff)} ±${(p.se * 100).toFixed(1)}`).padStart(15);
        });
        console.log(`  ${`${PLAY_STYLES[b.style].name}'s`.padEnd(14)}${cells.join("")}`);
      }
      console.log("");
    }
    console.log("Shipped deck vs each pilot's own deck, all four factions (the built-deck lift each style gets):");
    for (const c of crosses) {
      const own = DECK_FACTIONS.map((f) => rate(c.results[f]![c.pilot]!));
      const shipped = DECK_FACTIONS.map((f) => rate(c.results[f]!.shipped!));
      const games = c.games * 4;
      const ownAll = own.reduce((a, x) => a + x, 0) / 4;
      const shAll = shipped.reduce((a, x) => a + x, 0) / 4;
      const ci = wilson(Math.round(ownAll * games * 4), games * 4);
      console.log(`  ${PLAY_STYLES[c.pilot].name.padEnd(12)}own ${pct(ownAll)} [${pct(ci.lo)}, ${pct(ci.hi)}]  shipped ${pct(shAll)}  lift ${signed(ownAll - shAll)}`);
    }
    console.log("");
  }

  console.log("== 4. The decks ==");
  for (const b of builds) {
    console.log(`-- ${PLAY_STYLES[b.style].name} --`);
    for (const f of b.factions) {
      console.log(`  ${f.faction}: ${f.chosen} deck kept (searched from the ${f.searchedFrom} start; ${f.kept.length} of ${f.tried} changes kept); confirm ${pct(f.score.wins / f.score.games)}%${f.starts.map((st) => `, ${st.from} start ${pct(st.score.wins / st.score.games)}%`).join("")}`);
      for (const k of f.kept) console.log(`    kept ${k}`);
      if (b.style === "calculator") for (const l of formatList(listOf(f.list))) console.log(`    ${l}`);
    }
  }
}

const isMain = process.argv[1]?.endsWith("deckBuilderStyleReport.ts");
if (isMain) {
  const [mode, who] = process.argv.slice(2);
  const outFile = arg("out");
  if (mode === "build") {
    const r = await build(styleArg(who));
    writeFileSync(outFile ?? `build-${who}.json`, `${JSON.stringify(r)}\n`);
  } else if (mode === "cross") {
    const r = await cross(styleArg(who), readDir<StyleBuildFile>(arg("builds") ?? "."));
    writeFileSync(outFile ?? `cross-${who}.json`, `${JSON.stringify(r)}\n`);
  } else if (mode === "report") {
    report(readDir<StyleBuildFile>(arg("builds") ?? "."), arg("cross") ? readDir<StyleCrossFile>(arg("cross")!) : []);
  } else {
    throw new Error("usage: build <style> | cross <pilot> --builds dir | report --builds dir [--cross dir]");
  }
}
