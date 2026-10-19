// Measures the deck-building agent (roadmap 2b) against the shipped decks:
// "it's measured by playing its decks against the shipped decks"
// (session 35's check-in, accepted by the owner 2026-10-16).
//
// For each faction, from a full collection (every live card at its deck
// limit), it builds both starting decks and the searched deck, and plays
// them, and the shipped deck itself, against the four shipped decks on the
// same fresh seeds. The shipped deck's own score is the bar: a built deck that
// scores near it is as good as the designed list; above it, better against
// the field. Then the free pick (no faction forced) on the same holdings,
// and a faction's starter list alone (what a new owner holds before packs).
//
//   npx tsx src/dev/deckBuilderReport.ts [games] [trials] [confirm] > out.txt
//
// Deterministic: the same arguments print the same report.

import { buildFaction, chooseDeck, formatList, fullHoldings, playGauntlet, shippedList, DECK_FACTIONS, type GauntletScore } from "../deckbuilder/deckBuilder.js";
import { wilson } from "./edgeMeasure.js";

const [gamesArg, trialsArg, confirmArg] = process.argv.slice(2);
const games = Number(gamesArg ?? 100);
const trials = Number(trialsArg ?? 60);
const confirmGames = Number(confirmArg ?? 500);
const fresh = 1 + 1_000_000;

function pct(s: GauntletScore): string {
  const ci = wilson(s.wins, s.games);
  const by = DECK_FACTIONS.map((f) => `${f} ${(s.byOpponent[f] * 100).toFixed(1)}`).join(", ");
  return `${((s.wins / s.games) * 100).toFixed(1)}% [${(ci.lo * 100).toFixed(1)}, ${(ci.hi * 100).toFixed(1)}] (${by})`;
}

const started = Date.now();
console.log("Deck-building agent report (roadmap 2b)");
console.log(`Search: ${trials} one-copy changes per faction, each measured on ${games} games per shipped opponent (${games * 4} games).`);
console.log(`Confirm: ${confirmGames} games per shipped opponent (${confirmGames * 4} games) on fresh seeds from ${fresh}; the shipped deck plays the same seeds.`);
console.log("Every game is Lookahead vs Lookahead; the opponents are the four shipped decks, mirror included. Win rates count draws as not won.");
console.log("");

const full = fullHoldings();
console.log("== 1. A full collection, each faction forced ==");
const summary: string[] = [];
for (const faction of DECK_FACTIONS) {
  const lines: string[] = [];
  const build = await buildFaction(faction, full, { games, trials, confirmGames, log: (l) => lines.push(`  ${l}`) });
  const shipped = (await playGauntlet(shippedList(faction), fresh, confirmGames)).score;
  console.log(`-- ${faction} --`);
  for (const l of lines) console.log(l);
  console.log(`  shipped deck   ${pct(shipped)}`);
  for (const st of build.starts) console.log(`  ${`${st.from} start`.padEnd(15)}${pct(st.score!)}`);
  console.log(`  built deck     ${pct(build.score!)}  (searched from the ${build.searchedFrom} start; ${build.chosen} deck kept; ${build.kept.length} of ${build.tried} changes kept)`);
  console.log("  built list:");
  for (const l of formatList(build.deck!)) console.log(`    ${l}`);
  const gap = (build.score!.wins - shipped.wins) / shipped.games;
  summary.push(`${faction}: built ${((build.score!.wins / build.score!.games) * 100).toFixed(1)}% vs shipped ${((shipped.wins / shipped.games) * 100).toFixed(1)}% (${gap >= 0 ? "+" : ""}${(gap * 100).toFixed(1)})`);
  console.log("");
}
console.log("Summary (fresh seeds, against the four shipped decks):");
for (const s of summary) console.log(`  ${s}`);
console.log("");

console.log("== 2. A full collection, no faction forced (the free pick) ==");
const pick = await chooseDeck(full, { games: 0 });
console.log(`  Without games (rating only): ${pick.faction}`);
console.log("  With games: the pick is the best fresh-seed score in section 1, by construction (chooseDeck runs the same");
console.log("  buildFaction per faction and keeps the highest).");
console.log("");

console.log("== 3. One faction's starter list alone (a new owner before opening packs) ==");
for (const faction of DECK_FACTIONS) {
  const holdings = shippedList(faction);
  const lines: string[] = [];
  const built = await chooseDeck(holdings, { games, trials: Math.floor(trials / 2), confirmGames, log: (l) => lines.push(l) });
  const other = built.factions.filter((b) => b.infeasible).map((b) => b.faction);
  const shipped = (await playGauntlet(shippedList(faction), fresh, confirmGames)).score;
  const mine = built.factions.find((b) => b.faction === built.faction)!;
  console.log(`-- ${faction} starter: picks ${built.faction}; ${other.join(", ")} can't be built --`);
  console.log(`  shipped deck ${pct(shipped)}`);
  console.log(`  built deck   ${pct(mine.score!)}  (${mine.chosen} deck kept; ${mine.kept.length} of ${mine.tried} changes kept; ${built.spec.cards.length} cards)`);
  for (const k of mine.kept) console.log(`    kept ${k}`);
}
console.log("");
console.log(`Ran in ${Math.round((Date.now() - started) / 1000)} s.`);
