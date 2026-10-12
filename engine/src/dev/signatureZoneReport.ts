// Balance report 022: the ring with each set Mythic in the signature zone
// (session 31). The owner's unique-Mythic entry (2026-10-05) says: after the
// signature zone lands, re-baseline the ring once with each faction's set
// Mythic standing in as its signature card. This measures the six ring
// edges both ways on the same seeds, so the only difference between the two
// columns is where the Mythic lives, and it says how the agents used the
// zone: how often each faction's signature card was played and replayed,
// and how often the same Mythic was ever played when it sat in the deck.
//
// Usage: npx tsx src/dev/signatureZoneReport.ts > ../progress/balance-report-022-signature-zone.txt

import { measurePairing, wilson, bandVerdict, ringBand, newcombeDiff, FACTIONS, type DeckBuilder } from "./edgeMeasure.js";
import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { RING_EDGES, edgeName } from "./ringRegression.js";
import type { DeckFaction as Faction } from "../cards/types.js";
import { REFERENCE_SIGNATURE } from "./signatureFairness.js";
import type { GameState, PlayerId } from "../state/types.js";
import { otherPlayer } from "../state/types.js";

const pct = (x: number) => (x * 100).toFixed(1);

const shipped: Record<Faction, DeckBuilder> = { Cortex: buildCortexDeck, Swarm: buildSwarmDeck, Aegis: buildAegisDeck, Null: buildNullDeck };
const withReference = Object.fromEntries(
  FACTIONS.map((f) => [f, (id: "p1" | "p2", name: string) => ({ ...shipped[f](id, name), signature: REFERENCE_SIGNATURE })]),
) as Record<Faction, DeckBuilder>;

interface SideStats {
  games: number;
  /** Deck mode: games in which the Mythic was played at all. */
  mythicPlayed: number;
  /** Signature mode. */
  sigPlays: number;
  sigPlayedGames: number;
  sigReplayGames: number;
  firstPlayTurnSum: number;
  maxPlays: number;
  turns: number;
}

const fresh = (): SideStats => ({ games: 0, mythicPlayed: 0, sigPlays: 0, sigPlayedGames: 0, sigReplayGames: 0, firstPlayTurnSum: 0, maxPlays: 0, turns: 0 });

function mythicName(state: GameState, pid: PlayerId): string | undefined {
  const p = state.players[pid];
  return p.signature?.card.name ?? [...p.hand, ...p.deck, ...p.graveyard].find((c) => c.rarity === "Mythic")?.name ?? p.board.find((u) => u.card.rarity === "Mythic")?.card.name;
}

function record(stats: SideStats, state: GameState, pid: PlayerId, signature: boolean): void {
  stats.games++;
  stats.turns += state.turnNumber;
  if (!signature) {
    const name = mythicName(state, pid);
    if (state.log.some((e) => e.type === "play" && e.player === pid && e.card === name)) stats.mythicPlayed++;
    return;
  }
  const plays = state.log.flatMap((e, i) => (e.type === "play" && e.player === pid && e.fromSignatureZone ? [i] : []));
  stats.sigPlays += plays.length;
  stats.maxPlays = Math.max(stats.maxPlays, plays.length);
  if (plays.length > 0) {
    stats.sigPlayedGames++;
    // The turn of the first play: the last turnStart before it.
    const turnStart = state.log.slice(0, plays[0]).reverse().find((e) => e.type === "turnStart");
    stats.firstPlayTurnSum += turnStart && turnStart.type === "turnStart" ? turnStart.turn : 0;
  }
  if (plays.length > 1) stats.sigReplayGames++;
}

async function main(): Promise<void> {
  const out: string[] = [];
  const log = (s = "") => out.push(s);
  log("AI-TCG balance report 022: the ring with each set Mythic in the signature zone (session 31, 2026-10-10)");
  log("=".repeat(100));
  log();
  log("Instrument: measurePairing (Lookahead vs Lookahead, seed * 104729 + 31, alternating seats), the ring");
  log("regression check's six edges at its seed counts. Both columns play the SAME seeds; the only change is");
  log("where each deck's one set Mythic lives: in the deck (as shipped), or in the signature zone (one card");
  log("shorter deck, always available, back to the zone on death, +2 per replay).");
  log();
  log("1. The six ring edges, both ways");
  log("-".repeat(100));
  const perFaction: Record<"deck" | "signature", Partial<Record<Faction, SideStats>>> = { deck: {}, signature: {} };
  for (const e of RING_EDGES) {
    const band = ringBand(e.self, e.opponent);
    const row: string[] = [];
    const wins: number[] = [];
    for (const mode of ["deck", "signature"] as const) {
      const signature = mode === "signature";
      const r = await measurePairing(e.self, e.opponent, 1, e.seeds, {
        signature,
        onGame: (state, selfPid) => {
          for (const [f, pid] of [
            [e.self, selfPid],
            [e.opponent, otherPlayer(selfPid)],
          ] as const) {
            const s = (perFaction[mode][f] ??= fresh());
            record(s, state, pid, signature);
          }
        },
      });
      wins.push(r.selfWins);
      const ci = wilson(r.selfWins, r.games);
      row.push(`${pct(r.selfWins / r.games)}% (CI ${pct(ci.lo)}-${pct(ci.hi)}) ${bandVerdict(r.selfWins, r.games, band)}`);
    }
    const d = newcombeDiff(wins[1]!, e.seeds, wins[0]!, e.seeds);
    log(`  ${edgeName(e).padEnd(15)} band ${pct(band.lo)}-${pct(band.hi)}, ${e.seeds} seeds`);
    log(`    Mythic in deck:      ${row[0]}`);
    log(`    Mythic as signature: ${row[1]}`);
    log(`    change: ${d.diff >= 0 ? "+" : ""}${pct(d.diff)} points [95% ${pct(d.lo)}, ${pct(d.hi)}]${d.lo > 0 || d.hi < 0 ? "  REAL" : ""}`);
  }
  log();
  log("2. How the agents used the Mythic, per faction (all of that faction's games above, both seats)");
  log("-".repeat(100));
  log("  faction  Mythic (cost)            | in deck: games played | signature: games played, with a replay, plays/game, max, avg first-play turn");
  const names: Record<Faction, string> = { Cortex: "Quorum Arbiter (5)", Swarm: "Hive Mother (5)", Aegis: "Prime Aegis (6)", Null: "Null Singularity (7)" };
  for (const f of ["Cortex", "Swarm", "Aegis", "Null"] as Faction[]) {
    const d = perFaction.deck[f]!;
    const s = perFaction.signature[f]!;
    log(
      `  ${f.padEnd(7)}  ${names[f].padEnd(24)} | ${pct(d.mythicPlayed / d.games).padStart(5)}%              | ` +
        `${pct(s.sigPlayedGames / s.games).padStart(5)}%, ${pct(s.sigReplayGames / s.games).padStart(5)}%, ${(s.sigPlays / s.games).toFixed(2)}, ${s.maxPlays}, ` +
        `turn ${(s.firstPlayTurnSum / Math.max(1, s.sigPlayedGames)).toFixed(1)}`,
    );
  }
  log();
  log("3. The same edges with an IDENTICAL signature card on both sides (a vanilla 5-cost 3/6 Neutral");
  log("   stand-in; each set Mythic stays in its deck as shipped). Closer to real play, where both agents");
  log("   carry an equal-budget Neutral signature card.");
  log("-".repeat(100));
  for (const e of RING_EDGES) {
    const band = ringBand(e.self, e.opponent);
    const deck = await measurePairing(e.self, e.opponent, 1, e.seeds);
    const ref = await measurePairing(e.self, e.opponent, 1, e.seeds, { builders: withReference });
    const ci = wilson(ref.selfWins, ref.games);
    const d = newcombeDiff(ref.selfWins, e.seeds, deck.selfWins, e.seeds);
    log(
      `  ${edgeName(e).padEnd(15)} ${pct(ref.selfWins / ref.games)}% (CI ${pct(ci.lo)}-${pct(ci.hi)}) ${bandVerdict(ref.selfWins, ref.games, band).padEnd(11)}` +
        ` vs no signature ${pct(deck.selfWins / deck.games)}%: ${d.diff >= 0 ? "+" : ""}${pct(d.diff)} [${pct(d.lo)}, ${pct(d.hi)}]${d.lo > 0 || d.hi < 0 ? "  REAL" : ""}`,
    );
  }
  log();
  log("4. Match length (turns, all ring games in sections 1-2)");
  log("-".repeat(100));
  for (const mode of ["deck", "signature"] as const) {
    const all = Object.values(perFaction[mode]) as SideStats[];
    const games = all.reduce((n, s) => n + s.games, 0);
    const turns = all.reduce((n, s) => n + s.turns, 0);
    log(`  ${mode === "deck" ? "Mythic in deck     " : "Mythic as signature"}: ${(turns / games).toFixed(1)} turns per game`);
  }
  console.log(out.join("\n"));
}

await main();
