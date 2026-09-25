// Design principle 3 ("A self-disrupting metagame") says explicitly:
// "Measure it: track whether one archetype dominates win rates over time;
// if it does, that's a balance bug to fix, and the record should show it
// being fixed." This script was first written (session 7) to measure the
// three factions that existed then (Cortex, Swarm, Aegis); it now also
// covers Null, the fourth faction (session 8) — see progress/roadmap.md's
// "Finish and harden the card game" item 1.
//
// Design of the measurement, and why: matchSmoke.test.ts already proves
// matches resolve cleanly, but it alternates RandomAgent/AggressiveAgent
// per side, which mixes agent-skill difference into any win-rate signal —
// useless for isolating faction balance. Here both sides always run the
// SAME agent policy, so the only things that differ between games are the
// faction card pools and the seed-driven shuffle/draw order and any
// randomly-targeted effects. We also alternate which faction plays first
// across seeds so a real first-player advantage doesn't get misread as a
// faction imbalance.
//
// 2026-09-20 owner feedback ("balance is a systems problem; fix the
// instrument before any further balance change") — Phase 1, both items:
//
// 1. A THIRD reference agent (LookaheadAgent) now runs alongside Aggressive
//    and Random. The two original policies share a real blind spot:
//    Aggressive picks by raw card cost and Random picks uniformly, so
//    neither can tell a genuinely useful reactive/situational card from a
//    dead one — see progress/owner-feedback.md's 2026-09-19 entry, where
//    this was named as the likely cause of a measured regression from
//    Aegis's new defensive cards. LookaheadAgent scores moves by their
//    estimated board-state effect instead (see agents/lookaheadAgent.ts). A
//    pairing is now flagged only when ALL THREE policies agree — a strictly
//    higher bar than the old two-policy cross-check, by design.
// 2. Per-card "win rate when drawn" / "win rate when played" instrumentation
//    (first done as scratch, uncommitted `npx tsx` one-offs in session 10 —
//    see progress/quality-debt.md's "session 10" section naming that as
//    debt) is now a standing, always-on part of this report, accumulated
//    per faction across every game a policy plays. Every future balance
//    change should start by reading this table, not guessing.

import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { AggressiveAgent } from "../agents/aggressiveAgent.js";
import { RandomAgent } from "../agents/randomAgent.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import { TURN_CAP } from "../state/init.js";
import type { Agent } from "../agents/agent.js";
import type { DeckSpec } from "../state/init.js";
import type { GameState, PlayerId } from "../state/types.js";

const FACTIONS = ["Cortex", "Swarm", "Aegis", "Null"] as const;
type Faction = (typeof FACTIONS)[number];

const deckBuilders: Record<Faction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
  Null: buildNullDeck,
};

const SEEDS_PER_MATCHUP = Number(process.argv[2] ?? 300);
const FLAG_THRESHOLD = 0.6;

interface MatchupResult {
  factionA: Faction;
  factionB: Faction;
  gamesPlayed: number;
  aWins: number;
  bWins: number;
  draws: number;
  cappedGames: number;
  totalTurns: number;
}

/** Per-card, per-faction tally (Phase 1 item 2). "Drawn" = this card was in
 * the player's hand at any point in the game (their opening hand, counted
 * via `onMatchStart`, plus every later `draw` event) — a card sitting
 * unseen in the deck can't have won or lost anyone the game. "Played" =
 * this card was actually committed: a Unit/Directive `play`, a Command
 * `cast`, a Tool `toolAttached`, or an evolution `evolve` (counted as its
 * *evolved* form being played) — all four now carry a `player` field (this
 * session added it to the latter two) specifically so this tally can
 * attribute them correctly. */
interface CardStats {
  seenGames: number;
  seenWins: number;
  playedGames: number;
  playedWins: number;
}

function emptyCardStats(): CardStats {
  return { seenGames: 0, seenWins: 0, playedGames: 0, playedWins: 0 };
}

class CardStatsTracker {
  private byFaction = new Map<Faction, Map<string, CardStats>>();

  private bucket(faction: Faction, cardName: string): CardStats {
    let cards = this.byFaction.get(faction);
    if (!cards) {
      cards = new Map();
      this.byFaction.set(faction, cards);
    }
    let stats = cards.get(cardName);
    if (!stats) {
      stats = emptyCardStats();
      cards.set(cardName, stats);
    }
    return stats;
  }

  /** Records one finished game for one player's side of it. `faction` is
   * safe to attribute every card name in `drawn`/`played` to because every
   * deck this report builds is single-faction (see data/decks.ts) — there
   * is no cross-faction card to misattribute. */
  record(faction: Faction, drawn: Set<string>, played: Set<string>, won: boolean): void {
    for (const name of drawn) {
      const stats = this.bucket(faction, name);
      stats.seenGames++;
      if (won) stats.seenWins++;
    }
    for (const name of played) {
      const stats = this.bucket(faction, name);
      stats.playedGames++;
      if (won) stats.playedWins++;
    }
  }

  report(): string[] {
    const lines: string[] = [];
    for (const faction of FACTIONS) {
      const cards = this.byFaction.get(faction);
      if (!cards || cards.size === 0) continue;
      lines.push(`  --- ${faction} per-card win rates ---`);
      const rows = [...cards.entries()].sort((a, b) => b[1].playedGames - a[1].playedGames);
      for (const [name, s] of rows) {
        const seenRate = s.seenGames > 0 ? ((s.seenWins / s.seenGames) * 100).toFixed(1) : "-";
        const playedRate = s.playedGames > 0 ? ((s.playedWins / s.playedGames) * 100).toFixed(1) : "-";
        lines.push(
          `    ${name.padEnd(28)} drawn ${String(s.seenGames).padStart(4)} games (${seenRate}% win)  ` +
            `played ${String(s.playedGames).padStart(4)} games (${playedRate}% win)`,
        );
      }
    }
    return lines;
  }
}

/** Every card name this player's hand held at any point this game: the
 * opening hand (captured via `onMatchStart`, before any `draw` event exists
 * for it) plus every card named in a `draw` event attributed to them. */
function drawnCardNames(state: GameState, pid: PlayerId, openingHand: string[]): Set<string> {
  const names = new Set(openingHand);
  for (const event of state.log) {
    if (event.type === "draw" && event.player === pid) names.add(event.card);
  }
  return names;
}

/** Every card name this player actually committed to the board/stack this
 * game — see CardStats's own doc comment for why these four event types are
 * the complete set. Note: `cast` also fires for an *activated ability*
 * (engine.ts's activateAbility), logged as `${card.name} — ${ability.text}`
 * rather than a bare card name — that's not a card being played (the card
 * was already played when its Unit/Directive entered the board; activating
 * an ability again isn't playing it again), so those are filtered out here
 * rather than polluting the table with a synthetic pseudo-card. */
function playedCardNames(state: GameState, pid: PlayerId): Set<string> {
  const names = new Set<string>();
  for (const event of state.log) {
    if (event.type === "play" && event.player === pid) names.add(event.card);
    else if (event.type === "cast" && event.player === pid && !event.card.includes(" — ")) names.add(event.card);
    else if (event.type === "toolAttached" && event.player === pid) names.add(event.tool);
    else if (event.type === "evolve" && event.player === pid) names.add(event.to);
  }
  return names;
}

function pairings(): [Faction, Faction][] {
  const pairs: [Faction, Faction][] = [];
  for (let i = 0; i < FACTIONS.length; i++) {
    for (let j = i + 1; j < FACTIONS.length; j++) {
      pairs.push([FACTIONS[i]!, FACTIONS[j]!]);
    }
  }
  return pairs;
}

async function runMatchup(
  factionA: Faction,
  factionB: Faction,
  makeAgent: (name: string, seed: number) => Agent,
  seeds: number,
  cardStats: CardStatsTracker,
): Promise<MatchupResult> {
  const result: MatchupResult = {
    factionA,
    factionB,
    gamesPlayed: 0,
    aWins: 0,
    bWins: 0,
    draws: 0,
    cappedGames: 0,
    totalTurns: 0,
  };

  for (let seed = 1; seed <= seeds; seed++) {
    // Alternate who goes first across seeds so first-player advantage
    // (a real, separate effect — see the mirror matchups below) doesn't
    // leak into the cross-faction win-rate signal.
    const aGoesFirst = seed % 2 === 1;
    const deckA = deckBuilders[factionA]("p1", `${factionA} Deck`);
    const deckB = deckBuilders[factionB]("p2", `${factionB} Deck`);
    const agentA = makeAgent(factionA, seed);
    const agentB = makeAgent(factionB, seed);

    const openingHand: Record<PlayerId, string[]> = { p1: [], p2: [] };
    const { state } = aGoesFirst
      ? await runMatch(deckA, deckB, agentA, agentB, seed, {
          onMatchStart: (s) => {
            openingHand.p1 = s.players.p1.hand.map((c) => c.name);
            openingHand.p2 = s.players.p2.hand.map((c) => c.name);
          },
        })
      : await runMatch(deckB, deckA, agentB, agentA, seed, {
          onMatchStart: (s) => {
            openingHand.p1 = s.players.p1.hand.map((c) => c.name);
            openingHand.p2 = s.players.p2.hand.map((c) => c.name);
          },
        });

    result.gamesPlayed++;
    result.totalTurns += state.turnNumber;
    if (state.turnNumber >= TURN_CAP) result.cappedGames++;

    // winner is always expressed as "p1" | "p2" | "draw" by the engine;
    // translate back to which faction that was given aGoesFirst.
    if (state.winner === "draw") {
      result.draws++;
    } else if (state.winner === "p1") {
      if (aGoesFirst) result.aWins++;
      else result.bWins++;
    } else if (state.winner === "p2") {
      if (aGoesFirst) result.bWins++;
      else result.aWins++;
    }

    const factionOfPid: Record<PlayerId, Faction> = aGoesFirst
      ? { p1: factionA, p2: factionB }
      : { p1: factionB, p2: factionA };
    for (const pid of ["p1", "p2"] as const) {
      const won = state.winner === pid;
      cardStats.record(factionOfPid[pid], drawnCardNames(state, pid, openingHand[pid]), playedCardNames(state, pid), won);
    }
  }

  return result;
}

function formatMatchup(r: MatchupResult): string {
  const aRate = ((r.aWins / r.gamesPlayed) * 100).toFixed(1);
  const bRate = ((r.bWins / r.gamesPlayed) * 100).toFixed(1);
  const avgTurns = (r.totalTurns / r.gamesPlayed).toFixed(1);
  const capRate = ((r.cappedGames / r.gamesPlayed) * 100).toFixed(1);
  const flag = Math.max(r.aWins, r.bWins) / r.gamesPlayed >= FLAG_THRESHOLD ? `  <-- FLAG: >=${FLAG_THRESHOLD * 100}% win rate` : "";
  return (
    `  ${r.factionA} ${r.aWins}-${r.bWins} ${r.factionB}  ` +
    `(${r.factionA} ${aRate}% / ${r.factionB} ${bRate}%, ${r.draws} draws, ` +
    `avg ${avgTurns} turns, ${capRate}% hit turn cap)${flag}`
  );
}

async function runPolicy(label: string, makeAgent: (name: string, seed: number) => Agent) {
  console.log(`\n=== ${label} ===`);
  const results: MatchupResult[] = [];
  const cardStats = new CardStatsTracker();
  for (const [factionA, factionB] of pairings()) {
    const r = await runMatchup(factionA, factionB, makeAgent, SEEDS_PER_MATCHUP, cardStats);
    results.push(r);
    console.log(formatMatchup(r));
  }
  console.log(`  --- mirror matches (first-player-advantage baseline) ---`);
  for (const faction of FACTIONS) {
    const r = await runMatchup(faction, faction, makeAgent, SEEDS_PER_MATCHUP, cardStats);
    // In a mirror match "aWins"/"bWins" are both the same faction; report
    // as first-player vs second-player instead, which is the only real
    // signal a mirror match can carry.
    const firstRate = ((r.aWins / r.gamesPlayed) * 100).toFixed(1);
    console.log(
      `  ${faction} mirror: first-player ${r.aWins}-${r.bWins} second-player ` +
        `(first-player win rate ${firstRate}%, ${r.draws} draws, avg ${(r.totalTurns / r.gamesPlayed).toFixed(1)} turns)`,
    );
  }
  console.log(`  --- per-card win-rate instrumentation (drawn vs. played), accumulated across all of the above ---`);
  for (const line of cardStats.report()) console.log(line);
  return results;
}

console.log(`AI-TCG balance report — design principle 3 measurement`);
console.log(
  `${SEEDS_PER_MATCHUP} seeds per matchup, ${pairings().length} cross-faction pairings + ${FACTIONS.length} mirror matchups per agent policy.`,
);

const aggressiveResults = await runPolicy(
  "AggressiveAgent vs AggressiveAgent (same policy both sides)",
  (name, _seed) => new AggressiveAgent(`Aggressive-${name}`),
);
const randomResults = await runPolicy(
  "RandomAgent vs RandomAgent (same policy both sides)",
  (name, seed) => new RandomAgent(`Random-${name}`, seed * 7919 + 13),
);
const lookaheadResults = await runPolicy(
  "LookaheadAgent vs LookaheadAgent (same policy both sides) — the board-state-aware third policy, Phase 1 item 1",
  (name, seed) => new LookaheadAgent(`Lookahead-${name}`, seed * 104729 + 31),
);

console.log(`\n=== Cross-check: flagged under ALL THREE agent policies? ===`);
console.log(`(Previously this checked Aggressive+Random only. Per the 2026-09-20 owner feedback, LookaheadAgent`);
console.log(` now has to agree too — a strictly higher bar, by design, than the two-policy check it replaces.)`);
let anyTripleFlag = false;
for (const ar of aggressiveResults) {
  const rr = randomResults.find((r) => r.factionA === ar.factionA && r.factionB === ar.factionB);
  const lr = lookaheadResults.find((r) => r.factionA === ar.factionA && r.factionB === ar.factionB);
  if (!rr || !lr) continue;
  const aggressiveFlag = Math.max(ar.aWins, ar.bWins) / ar.gamesPlayed >= FLAG_THRESHOLD;
  const randomFlag = Math.max(rr.aWins, rr.bWins) / rr.gamesPlayed >= FLAG_THRESHOLD;
  const lookaheadFlag = Math.max(lr.aWins, lr.bWins) / lr.gamesPlayed >= FLAG_THRESHOLD;
  const aggWinner = ar.aWins > ar.bWins ? ar.factionA : ar.factionB;
  const randWinner = rr.aWins > rr.bWins ? rr.factionA : rr.factionB;
  const lookWinner = lr.aWins > lr.bWins ? lr.factionA : lr.factionB;
  // Bug fix (2026-09-23 owner-feedback entry, "Phase 4 session 17
  // follow-ups", found while re-mapping this report to the corrected ring
  // labels below): this check used to flag a pairing whenever all three
  // policies independently cleared the >=60% threshold, WITHOUT checking
  // they cleared it for the SAME side. That let a pairing where e.g.
  // Aggressive favours faction A at 65% and Random/Lookahead favour faction
  // B at 60%+ print as "FLAGGED" — three real signals pointing in two
  // different directions is not "a dominant archetype," it's disagreement,
  // and disagreement is exactly what a genuine soft-countered, healthy
  // matchup looks like policy-to-policy. Requiring the SAME winner across
  // all three is what "all three agree" (the 2026-09-20 entry's own phrase
  // introducing this cross-check) actually means.
  if (aggressiveFlag && randomFlag && lookaheadFlag && aggWinner === randWinner && randWinner === lookWinner) {
    console.log(
      `  ${ar.factionA} vs ${ar.factionB}: FLAGGED under all three policies ` +
        `(all three favor ${aggWinner}: Aggressive ${aggWinner}, Random ${randWinner}, Lookahead ${lookWinner})`,
    );
    anyTripleFlag = true;
  } else if (aggressiveFlag && randomFlag && lookaheadFlag) {
    console.log(
      `  ${ar.factionA} vs ${ar.factionB}: three independent >=${FLAG_THRESHOLD * 100}% signals but NOT the same winner ` +
        `(Aggressive favors ${aggWinner}, Random favors ${randWinner}, Lookahead favors ${lookWinner}) — not flagged; this is policy disagreement, not a dominant archetype`,
    );
  }
}
if (!anyTripleFlag) {
  console.log(`  None. No cross-faction pairing shows the SAME side winning >=${FLAG_THRESHOLD * 100}% under all three agent policies — no strong evidence of a dominant archetype from this measurement.`);
}

// --- Ring-target report (2026-09-23 owner-feedback entries: "Phase 4
// decisions" proposed the four-faction counter-cycle ring, and "Phase 4
// session 17 follow-ups" corrected two mislabelled edges — see this
// constant's own comment for the corrected shape). Previously the ring's
// target bands lived only in prose (checkpoints.md/notes-for-owner.md/log
// entries), hand-computed against this report's raw numbers after the
// fact — exactly how the mislabelling happened in the first place (session
// 17 wrote "Cortex vs Swarm [E]" and "Cortex vs Aegis [E]" in
// balance-report-011's table when the ring actually calls both of those
// decisive [W] edges). Encoding the ring here, once, as data the report
// itself checks every run, is the same "fix the instrument, don't
// hand-recompute it each time" instinct Phase 1 already applied to the
// agent-policy cross-check above.
type RingEdge = { winner: Faction; loser: Faction; band: [number, number] };
const RING_DECISIVE: RingEdge[] = [
  { winner: "Null", loser: "Aegis", band: [0.55, 0.6] },
  { winner: "Aegis", loser: "Cortex", band: [0.55, 0.6] },
  { winner: "Cortex", loser: "Swarm", band: [0.55, 0.6] },
  { winner: "Swarm", loser: "Null", band: [0.55, 0.6] },
];
const RING_EVEN: [Faction, Faction, [number, number]][] = [
  ["Null", "Cortex", [0.45, 0.55]],
  ["Aegis", "Swarm", [0.45, 0.55]],
];

function ringStatusFor(results: MatchupResult[], a: Faction, b: Faction): { label: string; rate: number; band: [number, number]; inBand: boolean } | undefined {
  const r = results.find((x) => (x.factionA === a && x.factionB === b) || (x.factionA === b && x.factionB === a));
  if (!r) return undefined;
  const decisive = RING_DECISIVE.find((e) => e.winner === a && e.loser === b);
  if (decisive) {
    const winnerRate = r.factionA === a ? r.aWins / r.gamesPlayed : r.bWins / r.gamesPlayed;
    return { label: `${a} should beat ${b}`, rate: winnerRate, band: decisive.band, inBand: winnerRate >= decisive.band[0] && winnerRate <= decisive.band[1] };
  }
  const even = RING_EVEN.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (even) {
    const aRate = r.factionA === a ? r.aWins / r.gamesPlayed : r.bWins / r.gamesPlayed;
    return { label: `${a} vs ${b} should be ~even`, rate: aRate, band: even[2], inBand: aRate >= even[2][0] && aRate <= even[2][1] };
  }
  return undefined;
}

console.log(`\n=== Ring targets: Null > Aegis > Cortex > Swarm > Null ===`);
console.log(`(Decisive edges [W] target 55-60% for the named winner; the two "across" pairings [E] target 45-55% even.`);
console.log(` Corrected 2026-09-23 — Cortex-vs-Swarm and Aegis-vs-Cortex are BOTH decisive [W] edges, not "even":`);
console.log(` only Null-vs-Cortex and Aegis-vs-Swarm are the ~even pairings.)`);
for (const [policyLabel, results] of [
  ["Aggressive", aggressiveResults],
  ["Random", randomResults],
  ["Lookahead", lookaheadResults],
] as const) {
  console.log(`  --- ${policyLabel} ---`);
  for (const edge of RING_DECISIVE) {
    const s = ringStatusFor(results, edge.winner, edge.loser);
    if (!s) continue;
    console.log(`    [W] ${s.label}: ${(s.rate * 100).toFixed(1)}% (target ${s.band[0] * 100}-${s.band[1] * 100}%) ${s.inBand ? "IN BAND" : "out of band"}`);
  }
  for (const [x, y, band] of RING_EVEN) {
    const s = ringStatusFor(results, x, y);
    if (!s) continue;
    console.log(`    [E] ${s.label}: ${x} ${(s.rate * 100).toFixed(1)}% (target ${band[0] * 100}-${band[1] * 100}%) ${s.inBand ? "IN BAND" : "out of band"}`);
  }
}
