// Why does Aegis beat Cortex so heavily once signature cards are in play?
// (owner 2026-10-18, answers to session 42, item 2: "find out why Aegis
// beats Cortex so heavily (71.5%) once signature cards are in play. Also
// report any other signature-mode edges that are far outside their bands.
// Show what drives it ... measured the same way as balance-report-029. Then
// propose fixes at an [OWNER CHECK-IN]. Don't change any cards or signature
// options without the owner's OK.")
//
// NO CARD IS CHANGED by this file. Trials patch a deck for the run only.
//
// The ring's "signature mode" (ringRegression.ts --signature) puts each
// faction's SET MYTHIC in the signature zone. A real match does something
// else: the store (economy/src/store.ts, the match setup) gives each agent
// its generated Neutral signature card from the approved menu lines, and
// the set Mythic, if the owner has one, stays a deck card. So this report
// measures the six ring edges in four ways, all on the gate's seeding
// (measurePairing's: seed parity picks who goes first, the same agent seed
// for both sides, the current LookaheadAgent):
//   gate      decks as shipped, no signature card (ringBaseline.json)
//   mythic    set Mythic as signature card (ringBaselineSignature.json)
//   plain     set Mythic in the deck, both sides the plain Neutral 5-cost
//             3/6 stand-in (the fairness test's reference)
//   approved  set Mythic in the deck, each side an approved menu line,
//             drawn per seed and seat (the nearest stand-in for real play)
// Then, for the mythic mode: which side's Mythic-in-the-zone moves each
// edge (each side's Mythic moved to the zone alone, the analogue of
// balance-report-029's pilot split), and how each signature card is used.
// Then trial fixes, measured in every mode they touch.
//
//   npx tsx src/dev/signatureRingDrivers.ts [seeds=2500] [--section 1,2,3,4]

import { buildDeck, buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck, withSetMythicSignature } from "../data/decks.js";
import { primeAegis } from "../data/aegisCards.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import { FACTIONS, ringBand, wilson, compareTwoProportions, shippedPool, APPROVED_SIGNATURE_CARDS as APPROVED_CARDS, approvedSignatureFor } from "./edgeMeasure.js";
import { RING_EDGES, edgeName, type RingEdge } from "./ringRegression.js";
import { REFERENCE_SIGNATURE } from "./signatureFairness.js";
import type { DeckSpec } from "../state/init.js";
import type { DeckFaction as Faction, UnitCard } from "../cards/types.js";
import type { GameState, PlayerId } from "../state/types.js";

const args = process.argv.slice(2);
const seeds = Number(args.find((a) => /^\d+$/.test(a)) ?? 2500);
const sectionArg = args[args.indexOf("--section") + 1];
const sections = new Set((args.includes("--section") ? sectionArg! : "1,2,3,4").split(",").map(Number));
const pct = (x: number) => (x * 100).toFixed(1);
const signed = (x: number) => (x >= 0 ? "+" : "") + pct(x);
const say = (line = "") => console.log(line);

const SHIPPED: Record<Faction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
  Null: buildNullDeck,
};
const MYTHIC: Record<Faction, UnitCard> = Object.fromEntries(
  FACTIONS.map((f) => [f, withSetMythicSignature(SHIPPED[f]("p1", f)).signature!]),
) as Record<Faction, UnitCard>;

/** Builds one side's deck for one game. `seat` is 0 for the edge's first
 * faction, 1 for the other, so a per-seed draw differs by side. */
type DeckMaker = (f: Faction, seed: number, seat: 0 | 1) => DeckSpec;

type Builders = Record<Faction, (id: DeckSpec["id"], name: string) => DeckSpec>;
function modesFor(b: Builders): Record<string, DeckMaker> {
  return {
    gate: (f) => b[f]("p1", `${f} Deck`),
    mythic: (f) => withSetMythicSignature(b[f]("p1", `${f} Deck`)),
    plain: (f) => ({ ...b[f]("p1", `${f} Deck`), signature: REFERENCE_SIGNATURE }),
    approved: (f, seed, seat) => ({
      ...b[f]("p1", `${f} Deck`),
      // The ring's --real draw: every line appears equally often over the seeds.
      signature: approvedSignatureFor(seed, seat),
    }),
  };
}
const MODES = modesFor(SHIPPED);

interface SideStats {
  /** Games its signature card was played (or, without one, its set Mythic from the deck). */
  keyPlayed: number;
  firstTurnSum: number;
  plays: number;
  /** Signature card deaths (each sends it back to the zone). */
  returns: number;
  /** Games where it was played and died at least once. */
  diedGames: number;
  /** The first-named side's wins in games where this side's key card was
   * played and never died ("stuck"), and in all other games. */
  stuckGames: number;
  stuckWinsSelf: number;
  otherGames: number;
  otherWinsSelf: number;
}
const emptySide = (): SideStats => ({ keyPlayed: 0, firstTurnSum: 0, plays: 0, returns: 0, diedGames: 0, stuckGames: 0, stuckWinsSelf: 0, otherGames: 0, otherWinsSelf: 0 });

interface EdgeRun {
  edge: string;
  games: number;
  selfWins: number;
  turns: number;
  side: { self: SideStats; opp: SideStats };
}

/** How one side used its key card in a finished game: the signature card
 * if it has one, else its set Mythic played from the deck. Turns are that
 * player's own turn count (1 = its first turn). */
function keyUse(state: GameState, pid: PlayerId, mythicName: string): { first?: number; plays: number; returns: number; deaths: number } {
  let ownTurns = 0, first: number | undefined, plays = 0, returns = 0, deaths = 0;
  const ids = new Set<string>();
  const hasZone = state.players[pid].signature !== null;
  for (const e of state.log) {
    if (e.type === "turnStart" && e.player === pid) ownTurns++;
    else if (e.type === "play" && e.player === pid && (hasZone ? e.fromSignatureZone : e.card === mythicName)) {
      plays++;
      first ??= ownTurns;
      if (e.instanceId) ids.add(e.instanceId);
    } else if (e.type === "signatureReturn" && e.player === pid) returns++;
    else if (e.type === "death" && e.controller === pid && e.instanceId && ids.has(e.instanceId)) deaths++;
  }
  return { first, plays, returns, deaths };
}

async function playEdge(e: RingEdge, make: DeckMaker, n: number): Promise<EdgeRun> {
  // measurePairing's seat order: the earlier faction in FACTIONS is slot A,
  // and A goes first on odd seeds.
  const aIsSelf = FACTIONS.indexOf(e.self) < FACTIONS.indexOf(e.opponent);
  const [fa, fb] = aIsSelf ? [e.self, e.opponent] : [e.opponent, e.self];
  const run: EdgeRun = { edge: edgeName(e), games: 0, selfWins: 0, turns: 0, side: { self: emptySide(), opp: emptySide() } };
  for (let seed = 1; seed <= n; seed++) {
    const aFirst = seed % 2 === 1;
    const deckA = { ...make(fa, seed, aIsSelf ? 0 : 1), id: "p1" as const };
    const deckB = { ...make(fb, seed, aIsSelf ? 1 : 0), id: "p2" as const };
    const agentA = new LookaheadAgent(`Lookahead-${fa}`, seed * 104729 + 31);
    const agentB = new LookaheadAgent(`Lookahead-${fb}`, seed * 104729 + 31);
    const { state } = aFirst ? await runMatch(deckA, { ...deckB, id: "p2" }, agentA, agentB, seed) : await runMatch({ ...deckB, id: "p1" }, { ...deckA, id: "p2" }, agentB, agentA, seed);
    const selfPid: PlayerId = aFirst === aIsSelf ? "p1" : "p2";
    const oppPid: PlayerId = selfPid === "p1" ? "p2" : "p1";
    const won = state.winner === selfPid;
    run.games++;
    run.turns += state.turnNumber;
    if (won) run.selfWins++;
    for (const [key, pid, f] of [["self", selfPid, e.self], ["opp", oppPid, e.opponent]] as const) {
      const s = run.side[key];
      const u = keyUse(state, pid, MYTHIC[f].name);
      if (u.first !== undefined) {
        s.keyPlayed++;
        s.firstTurnSum += u.first;
      }
      s.plays += u.plays;
      s.returns += u.returns;
      if (u.deaths > 0) s.diedGames++;
      if (u.first !== undefined && u.deaths === 0) {
        s.stuckGames++;
        if (won) s.stuckWinsSelf++;
      } else {
        s.otherGames++;
        if (won) s.otherWinsSelf++;
      }
    }
  }
  return run;
}

function verdict(wins: number, n: number, band: { lo: number; hi: number }): string {
  const w = wilson(wins, n);
  if (w.lo >= band.lo && w.hi <= band.hi) return "IN";
  if (w.hi < band.lo || w.lo > band.hi) return "OUT";
  return "UNRES";
}
function distance(rate: number, band: { lo: number; hi: number }): number {
  return rate < band.lo ? rate - band.lo : rate > band.hi ? rate - band.hi : 0;
}
function cellText(r: EdgeRun, e: RingEdge): string {
  const band = ringBand(e.self, e.opponent);
  const rate = r.selfWins / r.games;
  const d = distance(rate, band);
  return `${pct(rate).padStart(5)}% ${verdict(r.selfWins, r.games, band).padEnd(5)}${d === 0 ? "".padEnd(7) : `(${signed(d)})`.padEnd(7)}`;
}
function change(a: EdgeRun, b: EdgeRun): string {
  const c = compareTwoProportions(a.selfWins, a.games, b.selfWins, b.games);
  return `${signed(c.diff.diff).padStart(5)} [${pct(c.diff.lo)}, ${pct(c.diff.hi)}]${c.verdict === "no detectable difference" ? "     " : " real"}`;
}

const t0 = Date.now();
say(`# Balance report driver: the ring with signature cards (${seeds} gate seeds per edge, current LookaheadAgent both sides)`);
say(`  Win rates are the edge's first-named faction; bands from ringBand; (+x) / (-x) = points outside the band.`);
say(`  Set Mythics: ${FACTIONS.map((f) => `${f} ${MYTHIC[f].name} (${MYTHIC[f].cost}, ${MYTHIC[f].attack}/${MYTHIC[f].health})`).join(", ")}`);
say(`  Approved menu lines drawn in "approved" mode: ${APPROVED_CARDS.length}`);
say();

const runs = new Map<string, EdgeRun>();
const key = (mode: string, e: RingEdge) => `${mode}|${edgeName(e)}`;
async function measure(mode: string, make: DeckMaker): Promise<void> {
  for (const e of RING_EDGES) runs.set(key(mode, e), await playEdge(e, make, seeds));
}

if (sections.has(1) || sections.has(2) || sections.has(3)) {
  for (const mode of ["gate", "mythic", "plain", "approved"]) await measure(mode, MODES[mode]!);
}

if (sections.has(1)) {
  say("== 1. The six ring edges in four ways ==");
  say(`  ${"edge (band)".padEnd(28)} ${"gate".padEnd(19)} ${"mythic in zone".padEnd(19)} ${"plain stand-in".padEnd(19)} ${"approved lines".padEnd(19)}`);
  for (const e of RING_EDGES) {
    const band = ringBand(e.self, e.opponent);
    const cells = ["gate", "mythic", "plain", "approved"].map((m) => cellText(runs.get(key(m, e))!, e).padEnd(19));
    say(`  ${`${edgeName(e)} (${pct(band.lo)}-${pct(band.hi)})`.padEnd(28)} ${cells.join(" ")}`);
  }
  say();
  say("  Change from the gate (points, Newcombe 95%):");
  for (const e of RING_EDGES) {
    const g = runs.get(key("gate", e))!;
    say(`  ${edgeName(e).padEnd(16)} mythic ${change(runs.get(key("mythic", e))!, g)}   plain ${change(runs.get(key("plain", e))!, g)}   approved ${change(runs.get(key("approved", e))!, g)}`);
  }
  say();
}

if (sections.has(2)) {
  for (const mode of ["mythic", "approved"]) {
    say(mode === "mythic"
      ? "== 2a. Which side's Mythic-in-the-zone moves each edge (mythic mode) =="
      : "== 2b. Which side's signature card moves each edge (approved mode: what a menu card is worth to each faction) ==");
    say(mode === "mythic"
      ? "  Each edge with only one side's set Mythic moved to the zone (the other keeps it in the deck)."
      : "  Each edge with only one side given an approved signature card (both keep their set Mythic in the deck).");
    say("  Four cells: neither (= gate), only the first-named side, only the other, both. Changes in points, Newcombe 95%.");
    const name = (f: Faction) => (mode === "mythic" ? `${MYTHIC[f].name} to the zone` : `${f} gets a signature card`);
    for (const e of RING_EDGES) {
      const m = MODES[mode]!, g = MODES.gate!;
      const onlySelf: DeckMaker = (f, seed, seat) => (f === e.self ? m : g)(f, seed, seat);
      const onlyOpp: DeckMaker = (f, seed, seat) => (f === e.opponent ? m : g)(f, seed, seat);
      runs.set(key(`${mode}-onlySelf`, e), await playEdge(e, onlySelf, seeds));
      runs.set(key(`${mode}-onlyOpp`, e), await playEdge(e, onlyOpp, seeds));
    }
    for (const e of RING_EDGES) {
      const [g, s, o, b] = ["gate", `${mode}-onlySelf`, `${mode}-onlyOpp`, mode].map((m) => runs.get(key(m, e))!);
      say(`  ${edgeName(e)}: neither ${pct(g!.selfWins / g!.games)}%, only ${e.self} ${pct(s!.selfWins / s!.games)}%, only ${e.opponent} ${pct(o!.selfWins / o!.games)}%, both ${pct(b!.selfWins / b!.games)}%`);
      say(`      ${name(e.self).padEnd(32)} ${change(s!, g!)}   (with the other already there: ${change(b!, o!)})`);
      say(`      ${name(e.opponent).padEnd(32)} ${change(o!, g!)}   (with the other already there: ${change(b!, s!)})`);
    }
    say();
  }
}

if (sections.has(3)) {
  say("== 3. How each side uses its key card (gate: the set Mythic from the deck; other modes: the signature card) ==");
  say("  played = share of games it was played at all; turn = mean own turn of the first play; plays/returns per game;");
  say("  died = share of the games it was played in where it died at least once;");
  say("  stuck = games it was played and never died: their share, and the first-named side's win rate in them | in the rest.");
  for (const mode of ["gate", "mythic", "plain", "approved"]) {
    say(`  -- ${mode} --`);
    for (const e of RING_EDGES) {
      const r = runs.get(key(mode, e))!;
      const line = (f: Faction, s: SideStats) =>
        `${f.padEnd(6)} played ${pct(s.keyPlayed / r.games).padStart(5)}%  turn ${(s.keyPlayed ? s.firstTurnSum / s.keyPlayed : 0).toFixed(1).padStart(4)}` +
        `  plays ${(s.plays / r.games).toFixed(2)}  returns ${(s.returns / r.games).toFixed(2)}` +
        `  died ${s.keyPlayed ? pct(s.diedGames / s.keyPlayed).padStart(5) : "    -"}%` +
        `  stuck ${pct(s.stuckGames / r.games).padStart(5)}%, ${e.self} wins ${s.stuckGames ? pct(s.stuckWinsSelf / s.stuckGames).padStart(5) : "    -"}% | ${s.otherGames ? pct(s.otherWinsSelf / s.otherGames).padStart(5) : "    -"}%`;
      say(`  ${edgeName(e).padEnd(16)} ${line(e.self, r.side.self)}`);
      say(`  ${"".padEnd(16)} ${line(e.opponent, r.side.opp)}   (mean game ${(r.turns / r.games).toFixed(1)} turns)`);
    }
  }
  say();
}

if (sections.has(4)) {
  // Trial fixes on Prime Aegis, the card section 2a names. Each patches every
  // copy (deck and zone) for this run only, and is measured in the three
  // modes that matter: the gate (today's CI), mythic (the second CI
  // baseline) and approved (the nearest stand-in for real matches).
  const aegisAura = primeAegis.abilities.find((a) => a.id === "prime-aegis-aura-ally")!;
  const TRIALS: { label: string; card: UnitCard }[] = [
    { label: "P1: Prime Aegis costs 7", card: { ...primeAegis, cost: 7 } },
    { label: "P2: Prime Aegis loses \"Enemy units get -1/-0\"", card: { ...primeAegis, abilities: [aegisAura] } },
    { label: "P3: Prime Aegis 4/8 -> 4/6", card: { ...primeAegis, health: 6 } },
  ];
  say("== 4. Trial fixes on Prime Aegis (card data patched for the run only; nothing is written) ==");
  say("  Each cell: the trial's rate, verdict, then the change from the same mode as shipped.");
  const shipped = new Map<string, EdgeRun>();
  for (const mode of ["gate", "mythic", "approved"]) {
    for (const e of RING_EDGES.filter((x) => x.self === "Aegis" || x.opponent === "Aegis")) shipped.set(key(mode, e), runs.get(key(mode, e)) ?? (await playEdge(e, MODES[mode]!, seeds)));
  }
  for (const t of TRIALS) {
    const pool = shippedPool("Aegis").map((p) => (p.card.id === primeAegis.id ? { ...p, card: t.card } : p));
    const modes = modesFor({ ...SHIPPED, Aegis: (id, name) => buildDeck(id, name, pool) });
    say(`  ${t.label}`);
    // Edges without Aegis replay the same games, so only Aegis's three are shown.
    for (const e of RING_EDGES.filter((x) => x.self === "Aegis" || x.opponent === "Aegis")) {
      const cells: string[] = [];
      for (const mode of ["gate", "mythic", "approved"]) {
        const r = await playEdge(e, modes[mode]!, seeds);
        cells.push(`${mode} ${cellText(r, e)}${change(r, shipped.get(key(mode, e))!)}`);
      }
      say(`    ${edgeName(e).padEnd(16)} ${cells.join("  ")}`);
    }
  }
  say();
}

export { playEdge, MODES, MYTHIC, SHIPPED, cellText, change, type DeckMaker, type EdgeRun };
say(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
