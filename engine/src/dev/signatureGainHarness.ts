// The measuring harness behind aegisSignatureGain.ts (session 44) and
// aegisLateDeckTrial.ts (session 45), split out so both report drivers play
// exactly the same games: the ring's seeding (seed parity picks who goes
// first, the same agent seed for both sides, the current LookaheadAgent),
// the approved signature draw when a side holds one, and an agent wrapper
// that only records what each player was shown when it ended its own turn.
//
// No card is changed here. A Setup's builders patch a deck for the run only.

import { buildDeck, buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { kernelPanic, nullSingularity } from "../data/nullCards.js";
import { aegisCadet, platingModule } from "../data/aegisCards.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import type { Agent, PlayerView } from "../agents/agent.js";
import type { Move } from "../engine/moves.js";
import { runMatch } from "../engine/match.js";
import { FACTIONS, ringBand, wilson, compareTwoProportions, approvedSignatureFor, shippedPool } from "./edgeMeasure.js";
import { RING_EDGES, edgeName, type RingEdge } from "./ringRegression.js";
import { REFERENCE_SIGNATURE } from "./signatureFairness.js";
import type { DeckSpec } from "../state/init.js";
import type { Card, DeckFaction as Faction, ToolCard, UnitCard } from "../cards/types.js";
import type { GameState, PlayerId } from "../state/types.js";

export const pct = (x: number) => (x * 100).toFixed(1);
export const signed = (x: number) => (x >= 0 ? "+" : "") + pct(x);

export type Builder = (id: DeckSpec["id"], name: string) => DeckSpec;
export const SHIPPED: Record<Faction, Builder> = { Cortex: buildCortexDeck, Swarm: buildSwarmDeck, Aegis: buildAegisDeck, Null: buildNullDeck };

/** Records, for each of its player's own turns, the energy left and the hand
 * size at the last move of that turn (the pass that ends it), and passes
 * every decision through to the wrapped agent unchanged. */
export class EnergyWatch implements Agent {
  readonly name: string;
  /** turnNumber -> what was left when the player last passed on its own turn. */
  readonly endOfTurn = new Map<number, { energy: number; maxEnergy: number; hand: number }>();
  constructor(private readonly inner: Agent) {
    this.name = inner.name;
  }
  async decideMove(view: PlayerView, legal: Move[]): Promise<Move> {
    const move = await this.inner.decideMove(view, legal);
    if (view.activePlayer === view.self && view.stack.length === 0 && move.type === "passPriority") {
      this.endOfTurn.set(view.turnNumber, { energy: view.me.energy, maxEnergy: view.me.maxEnergy, hand: view.me.hand.length });
    }
    return move;
  }
}

/** One side's tallies over an edge's games. */
export interface Side {
  games: number;
  wins: number;
  /** Own turns at 5+ max energy, the energy left unspent at their end, and
   * how many of them ended with 3+ unspent or an empty hand. */
  lateTurns: number;
  lateUnspent: number;
  lateFloat3: number;
  lateEmptyHand: number;
  /** Signature card use: games it was played, tools attached to it, buff
   * events on it, attacks it made, damage it dealt to the opposing player,
   * attacks aimed at it (after redirects), attacks redirected onto it. */
  sigGames: number;
  sigTools: number;
  sigBuffs: number;
  sigAttacks: number;
  sigFaceDamage: number;
  sigAttacked: number;
  sigRedirectedTo: number;
}
export const emptySide = (): Side => ({
  games: 0, wins: 0, lateTurns: 0, lateUnspent: 0, lateFloat3: 0, lateEmptyHand: 0,
  sigGames: 0, sigTools: 0, sigBuffs: 0, sigAttacks: 0, sigFaceDamage: 0, sigAttacked: 0, sigRedirectedTo: 0,
});

export function tally(s: Side, state: GameState, pid: PlayerId, watch: EnergyWatch): void {
  s.games++;
  if (state.winner === pid) s.wins++;
  for (const t of watch.endOfTurn.values()) {
    if (t.maxEnergy < 5) continue;
    s.lateTurns++;
    s.lateUnspent += t.energy;
    if (t.energy >= 3) s.lateFloat3++;
    if (t.hand === 0) s.lateEmptyHand++;
  }
  const sigIds = new Set<string>();
  for (const e of state.log) {
    if (e.type === "play" && e.player === pid && e.fromSignatureZone && e.instanceId) sigIds.add(e.instanceId);
    else if (e.type === "toolAttached" && e.player === pid && e.unitId && sigIds.has(e.unitId)) s.sigTools++;
    else if (e.type === "buff" && e.targetId && sigIds.has(e.targetId)) s.sigBuffs++;
    else if (e.type === "attack") {
      if (e.attackerId && sigIds.has(e.attackerId)) s.sigAttacks++;
      if (e.defenderRef?.kind === "unit" && sigIds.has(e.defenderRef.instanceId)) s.sigAttacked++;
    } else if (e.type === "attackRedirected" && e.toRef?.kind === "unit" && sigIds.has(e.toRef.instanceId)) s.sigRedirectedTo++;
    else if (e.type === "damage" && e.targetKind === "player" && e.sourceId && sigIds.has(e.sourceId)) s.sigFaceDamage += e.amount;
  }
  if (sigIds.size > 0) s.sigGames++;
}

/** Who gets a signature card in a run: "none" (the gate), "self" (only the
 * edge's named `who`), or "both" (the ring's --real mode). */
export interface Setup {
  /** The factions given a signature card. */
  sig: Set<Faction>;
  /** Per-faction deck builder overrides (trials). */
  builders?: Partial<Record<Faction, Builder>>;
  /** Trial rule: neither agent may attach a tool to a signature card. Only an
   * agent's own move attaches a tool, so filtering the legal moves is the
   * rule exactly. */
  noToolsOnSignature?: boolean;
  /** Trial rule: every signature card's base cost (5 on the approved lines). */
  signatureCost?: number;
}

/** Drops every legal move that attaches a tool to a signature card. */
export class NoToolsOnSignature implements Agent {
  readonly name: string;
  constructor(private readonly inner: Agent) {
    this.name = inner.name;
  }
  decideMove(view: PlayerView, legal: Move[]): Move | Promise<Move> {
    const sig = new Set(view.me.board.filter((u) => u?.signature).map((u) => u!.instanceId));
    const kept = legal.filter(
      (m) => !(m.type === "playCard" && view.me.hand[m.handIndex]?.type === "Tool" && m.target?.kind === "unit" && sig.has(m.target.instanceId)),
    );
    return this.inner.decideMove(view, kept);
  }
}

export interface Run {
  games: number;
  aWins: number;
  side: Record<Faction, Side>;
}

/** Plays `a` vs `b` on the gate's seeding (measurePairing's: the earlier
 * faction in FACTIONS is slot A and goes first on odd seeds; seat 0 is the
 * edge's first-named faction for the approved draw). */
export async function play(e: RingEdge, setup: Setup, n: number): Promise<Run> {
  const aIsSelf = FACTIONS.indexOf(e.self) < FACTIONS.indexOf(e.opponent);
  const [fa, fb] = aIsSelf ? [e.self, e.opponent] : [e.opponent, e.self];
  const side = { [fa]: emptySide(), [fb]: emptySide() } as Record<Faction, Side>;
  const run: Run = { games: 0, aWins: 0, side };
  const deck = (f: Faction, seed: number): DeckSpec => {
    const d = (setup.builders?.[f] ?? SHIPPED[f])("p1", `${f} Deck`);
    if (!setup.sig.has(f)) return d;
    const card = approvedSignatureFor(seed, f === e.self ? 0 : 1);
    return { ...d, signature: setup.signatureCost === undefined ? card : { ...card, cost: setup.signatureCost } };
  };
  for (let seed = 1; seed <= n; seed++) {
    const aFirst = seed % 2 === 1;
    const agent = (f: Faction): Agent => {
      const a = new LookaheadAgent(`Lookahead-${f}`, seed * 104729 + 31);
      return setup.noToolsOnSignature ? new NoToolsOnSignature(a) : a;
    };
    const wa = new EnergyWatch(agent(fa));
    const wb = new EnergyWatch(agent(fb));
    const da = deck(fa, seed), db = deck(fb, seed);
    const { state } = aFirst
      ? await runMatch({ ...da, id: "p1" }, { ...db, id: "p2" }, wa, wb, seed)
      : await runMatch({ ...db, id: "p1" }, { ...da, id: "p2" }, wb, wa, seed);
    const pa: PlayerId = aFirst ? "p1" : "p2";
    const pb: PlayerId = aFirst ? "p2" : "p1";
    run.games++;
    if (state.winner === pa) run.aWins++;
    tally(side[fa], state, pa, wa);
    tally(side[fb], state, pb, wb);
  }
  return run;
}

export const rate = (s: Side) => s.wins / s.games;
export function gainText(withSig: Side, without: Side): string {
  const c = compareTwoProportions(withSig.wins, withSig.games, without.wins, without.games);
  return `${signed(c.diff.diff).padStart(5)} [${pct(c.diff.lo)}, ${pct(c.diff.hi)}]${c.verdict === "no detectable difference" ? "     " : " real"}`;
}
export function verdict(wins: number, n: number, band: { lo: number; hi: number }): string {
  const w = wilson(wins, n);
  if (w.lo >= band.lo && w.hi <= band.hi) return "IN";
  if (w.hi < band.lo || w.lo > band.hi) return "OUT";
  return "UNRES";
}
