// The first seat's win rate over a large ladder run (owner 2026-11-02, on
// session 66's call 3: "the first seat won 56% in the demo (72 matches).
// Measure the first-seat win rate over a larger ladder run and report it,
// with whether it is inside noise"). Session 67.
//
//   npm run measure:first-seat -w server > ../progress/first-seat-001.txt
//
// The same eight house owners as the ladder demo (two per starting
// faction, six play styles), the server's own ladder: the house pack
// policy on (so decks rebuild as packs are opened), the coin-flip seats,
// 7 minutes of clock per match. Who goes first is the coin flip, so each
// side's deck and agent are first as often as second on average: the share
// of decided matches the first seat wins is the first-seat edge itself.
// It is tested against 50% with a two-sided binomial test (normal
// approximation), and given per faction pairing and per play style of the
// first seat for a look at where it comes from. Seeds and the clock are
// fixed: the output is the same every run.

import { buildDeck, getCard, LookaheadAgent, PLAY_STYLES, runMatch, SHIPPED_DECK_LISTS, type DeckFaction, type PlayStyleId } from "@ai-tcg/engine";
import { EconomyStore, type MatchRecord } from "@ai-tcg/economy";
import { Ladder } from "../ladder/ladderRunner.js";

const ROUNDS = Number(process.argv[2] ?? 600);
const BUILD = { games: 4, trials: 8, confirmGames: 8 };
const MINUTES_PER_MATCH = 7;
const CAST: { agent: string; faction: DeckFaction; style: PlayStyleId }[] = [
  { agent: "Lattice Warden", faction: "Cortex", style: "calculator" },
  { agent: "Quiet Theorem", faction: "Cortex", style: "controller" },
  { agent: "Hive Courier", faction: "Swarm", style: "rusher" },
  { agent: "Brood Cartographer", faction: "Swarm", style: "tempo" },
  { agent: "Chrome Bastion", faction: "Aegis", style: "fortress" },
  { agent: "Mirror Sentry", faction: "Aegis", style: "calculator" },
  { agent: "Static Widow", faction: "Null", style: "gambler" },
  { agent: "Dead Channel", faction: "Null", style: "tempo" },
];

let clock = new Date("2026-11-01T22:00:00.000Z");
const store = EconomyStore.open(":memory:", { now: () => clock });
const styleOf = new Map<string, PlayStyleId>();
for (const c of CAST) {
  const owner = store.createOwner({ name: `House ${c.agent}`, kind: "house" });
  store.grantStarterCollection(owner.ownerId, c.faction);
  const agent = store.createAgent({ ownerId: owner.ownerId, name: c.agent });
  store.setPlayStyle(owner.ownerId, agent.agentId, c.style);
  store.connectAgent(owner.ownerId, agent.agentId);
  styleOf.set(owner.ownerId, c.style);
}
const factionOf = new Map<string, string>();
let n = 0;
let packSeed = 67_000;
const ladder = new Ladder({
  store,
  seed: 6701,
  build: BUILD,
  matchId: () => `fs-${++n}`,
  housePacks: { packSeed: () => ++packSeed },
  afterMatch: () => {
    clock = new Date(clock.getTime() + MINUTES_PER_MATCH * 60_000);
  },
  onEvent: (e) => {
    if (e.kind === "rebuilt") factionOf.set(e.ownerId, e.faction);
  },
});
const matchFaction = new Map<string, { p1: string; p2: string }>();
let rebuilds = 0;
for (let r = 0; r < ROUNDS; r++) {
  const report = await ladder.runRound();
  rebuilds += report.rebuilt.length;
  for (const m of report.matches) matchFaction.set(m.record.matchId, { p1: factionOf.get(m.record.p1OwnerId)!, p2: factionOf.get(m.record.p2OwnerId)! });
}

const history = store.matchHistory();
const say = (line = "") => console.log(line);
const decided = (ms: MatchRecord[]) => ms.filter((m) => m.outcome === "win");
const firstWins = (ms: MatchRecord[]) => decided(ms).filter((m) => m.winnerOwnerId === m.p1OwnerId).length;

/** Two-sided p-value of k successes in n against 50% (normal approximation
 * with continuity correction). */
function pValue(k: number, total: number): number {
  if (total === 0) return 1;
  const z = (Math.abs(k - total / 2) - 0.5) / Math.sqrt(total / 4);
  return Math.min(1, 2 * (1 - phi(Math.max(0, z))));
}
function phi(z: number): number {
  // Abramowitz-Stegun 26.2.17.
  const t = 1 / (1 + 0.2316419 * z);
  const d = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
  return 1 - d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
}
const pct = (k: number, total: number) => (total === 0 ? "-" : `${((100 * k) / total).toFixed(1)}%`);
const ci = (k: number, total: number) => {
  const p = k / total;
  const h = 1.96 * Math.sqrt((p * (1 - p)) / total);
  return `${(100 * (p - h)).toFixed(1)}-${(100 * (p + h)).toFixed(1)}%`;
};

say("# The first seat's win rate over a large ladder run (session 67)");
say();
say(`Eight house owners (two per faction, six play styles), the server's ladder with the house pack policy on;`);
say(`${ROUNDS} rounds of 4 matches, ${MINUTES_PER_MATCH} minutes of clock each (${Math.round((ROUNDS * 4 * MINUTES_PER_MATCH) / 60 / 24)} Sydney days); ${rebuilds} deck builds and rebuilds.`);
say("Seats are a coin flip, so the first seat's share of decided matches is the first-seat edge.");
say();
const d = decided(history).length;
const k = firstWins(history);
say("## Overall");
say();
say(`matches ${history.length}; decided ${d}; draws ${history.filter((m) => m.outcome === "draw").length}; cancelled ${history.filter((m) => m.outcome === "cancelled").length}; abandoned ${history.filter((m) => m.outcome === "abandoned").length}`);
say(`first seat won ${k} of ${d} = ${pct(k, d)} (95% interval ${ci(k, d)}); two-sided p = ${pValue(k, d).toFixed(4)} against 50%`);
say(`verdict: ${pValue(k, d) < 0.05 ? "OUTSIDE noise: the first seat has a real edge at this sample size" : "inside noise: no first-seat edge this sample can tell from chance"}`);
say(`for scale: session 66's demo had 40 of 71 decided (56.3%); at 71 matches the 95% interval is about +/-11.6 points.`);
say();
say("## By time (is it stable?)");
say();
const quarter = Math.ceil(history.length / 4);
for (let q = 0; q < 4; q++) {
  const part = history.slice(q * quarter, (q + 1) * quarter);
  const pd = decided(part).length;
  const pk = firstWins(part);
  say(`matches ${q * quarter + 1}-${Math.min(history.length, (q + 1) * quarter)}: ${pk}/${pd} = ${pct(pk, pd)}`);
}
say();
say("## By the factions the two agents built (first seat's faction first)");
say();
const byPair = new Map<string, MatchRecord[]>();
for (const m of history) {
  const f = matchFaction.get(m.matchId);
  if (!f) continue;
  const key = `${f.p1} first vs ${f.p2}`;
  byPair.set(key, [...(byPair.get(key) ?? []), m]);
}
for (const [key, ms] of [...byPair].sort((a, b) => b[1].length - a[1].length)) {
  const pd = decided(ms).length;
  say(`${key.padEnd(26)} ${String(firstWins(ms)).padStart(4)}/${String(pd).padEnd(4)} ${pct(firstWins(ms), pd).padStart(6)}`);
}
say();
say("## Mirror pairings only (the same faction on both sides: the deck can't explain the edge)");
say();
const mirror = history.filter((m) => {
  const f = matchFaction.get(m.matchId);
  return f && f.p1 === f.p2;
});
const md = decided(mirror).length;
say(`first seat won ${firstWins(mirror)} of ${md} = ${pct(firstWins(mirror), md)}${md ? ` (95% interval ${ci(firstWins(mirror), md)}; p = ${pValue(firstWins(mirror), md).toFixed(4)})` : ""}`);
say();
say("## By the first seat's play style");
say();
for (const style of Object.keys(PLAY_STYLES) as PlayStyleId[]) {
  const ms = history.filter((m) => styleOf.get(m.p1OwnerId) === style);
  if (ms.length === 0) continue;
  const pd = decided(ms).length;
  say(`${PLAY_STYLES[style].name.padEnd(12)} ${String(firstWins(ms)).padStart(4)}/${String(pd).padEnd(4)} ${pct(firstWins(ms), pd).padStart(6)}`);
}
say();
say("## The engine alone: the shipped decks in mirror, the same agent both sides, no ladder");
say();
say("To tell whether the edge is the ladder's or the game's: each faction's shipped deck against itself, the");
say("LookaheadAgent (default style) in both seats, 400 games each, p1 always first. Nothing here touches the ladder.");
say("(The balance report's 'mirror matches (first-player-advantage baseline)' lines alternate who goes first");
say("within the mirror, so they measure deck A against an identical deck B, about 50% by construction, not the");
say("first seat. This is the first direct measurement.)");
say();
let allFirst = 0;
let allDecided = 0;
for (const f of ["Cortex", "Swarm", "Aegis", "Null"] as const) {
  const spec = (id: "p1" | "p2") => buildDeck(id, `${f} (shipped)`, SHIPPED_DECK_LISTS[f].map((e) => ({ card: getCard(e.cardId)!, copies: e.copies })));
  let first = 0;
  let dec = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const r = await runMatch(spec("p1"), spec("p2"), new LookaheadAgent("A", seed * 2), new LookaheadAgent("B", seed * 2 + 1), 50_000 + seed);
    if (r.state.winner === "p1") first++;
    if (r.state.winner === "p1" || r.state.winner === "p2") dec++;
  }
  allFirst += first;
  allDecided += dec;
  say(`${f.padEnd(7)} mirror: first seat ${first}/${dec} = ${pct(first, dec)} (95% interval ${ci(first, dec)})`);
}
say(`all four: ${allFirst}/${allDecided} = ${pct(allFirst, allDecided)} (95% interval ${ci(allFirst, allDecided)}); p = ${pValue(allFirst, allDecided).toFixed(4)}`);
store.close();
