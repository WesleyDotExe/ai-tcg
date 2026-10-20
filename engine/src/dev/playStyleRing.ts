// The play-style fairness ring (owner 2026-10-15: "each style should play
// visibly differently, and the styles should be fair against each other. No
// style should win clearly more often overall, tested the same way as
// signature cards"). Built session 52.
//
// Every pair of styles plays every ordered faction pairing (16, mirrors
// included) on the same seeds, each game twice with the styles swapped
// between the seats: same decks, same seat order, same shuffle, same agent
// seed, so the deck, the seat and the draw cancel and only the style
// differs. Decks are the shipped lists, and each side gets an approved
// signature card the way a real match does (edgeMeasure.ts's
// approvedSignatureFor, the real-match ring's draw).
//
// A game scores 1 for a win, 0.5 for a draw and 0 for a loss, so the field
// averages exactly 50%. The rule proposed for the owner (the signature
// card's 2-point limit, read on the overall rate): every style's score
// against the field (the other styles, every faction, both seats) is
// within 2 points of 50%. Pairwise edges are reported, not gated: a style
// beating another is the rock-paper-scissors principle 3 wants, as long as
// no style beats the field.
//
// Each style's behaviour is measured from the same games (attacks at the
// opponent's health vs at units, damage to the opponent, cards played,
// Instants cast on the opponent's turn, units lost, game length), which is
// the evidence that the styles play visibly differently.
//
// Usage (from engine/):
//   npx tsx src/dev/playStyleRing.ts run [--seeds N] [--first S] [--styles a,b,..] [--set style.weight=x,..] [--shard i/k] [--out file]
//       aggregates as JSON (to --out, else stdout)
//   npx tsx src/dev/playStyleRing.ts report file...
//       the merged table (shards are summed)

import { readFileSync, writeFileSync } from "node:fs";
import { FACTIONS, approvedSignatureFor, wilson } from "./edgeMeasure.js";
import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { PLAY_STYLES, PLAY_STYLE_IDS, isPlayStyleId, type PlayStyleId, type PlayStyleWeights } from "../agents/playStyles.js";
import { runMatch } from "../engine/match.js";
import type { DeckFaction as Faction } from "../cards/types.js";
import type { GameState, PlayerId } from "../state/types.js";
import type { Agent, PlayerView } from "../agents/agent.js";
import type { Move } from "../engine/moves.js";
import type { DeckSpec } from "../state/init.js";

/** The owner's signature-card limit, applied to the overall rate. */
export const STYLE_FAIRNESS_LIMIT = 0.02;

const BUILDERS: Record<Faction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
  Null: buildNullDeck,
};

/** What one side did in one game. */
export interface Behaviour {
  games: number;
  attacks: number;
  faceAttacks: number;
  faceDamage: number;
  cardsPlayed: number;
  opponentTurnInstants: number;
  unitsLost: number;
  turns: number;
  /** Energy left in the pool when the style passed to end its own turn. */
  unspentEnergy: number;
  turnsEnded: number;
  /** Decisions with more than one legal move, and how many of them picked
   * a move Calculator would not have (not among its best). */
  decisions: number;
  divergent: number;
}

const emptyBehaviour = (): Behaviour => ({
  games: 0,
  attacks: 0,
  faceAttacks: 0,
  faceDamage: 0,
  cardsPlayed: 0,
  opponentTurnInstants: 0,
  unitsLost: 0,
  turns: 0,
  unspentEnergy: 0,
  turnsEnded: 0,
  decisions: 0,
  divergent: 0,
});

/** Wraps a styled agent and records, per decision, whether Calculator
 * would have picked the same move, and the energy left when it ends its
 * own turn. The shadow only scores; it never moves. */
class Observed implements Agent {
  readonly name: string;
  readonly seen = { unspentEnergy: 0, turnsEnded: 0, decisions: 0, divergent: 0 };
  private shadow: LookaheadAgent;
  constructor(private inner: LookaheadAgent, private isCalculator: boolean) {
    this.name = inner.name;
    this.shadow = new LookaheadAgent("shadow", 1);
  }
  decideMove(view: PlayerView, legalMoves: Move[]): Move {
    const move = this.inner.decideMove(view, legalMoves);
    if (move.type === "passPriority" && view.activePlayer === view.self && view.stack.length === 0) {
      this.seen.unspentEnergy += view.me.energy;
      this.seen.turnsEnded++;
    }
    if (legalMoves.length > 1) {
      this.seen.decisions++;
      if (!this.isCalculator) {
        const key = JSON.stringify(move);
        if (!this.shadow.bestMoves(view, legalMoves).some((m) => JSON.stringify(m) === key)) this.seen.divergent++;
      }
    }
    return move;
  }
}

function addBehaviour(into: Behaviour, b: Behaviour): void {
  for (const k of Object.keys(into) as (keyof Behaviour)[]) into[k] += b[k];
}

/** One side's behaviour, read from the match log. */
export function behaviourOf(state: GameState, pid: PlayerId): Behaviour {
  const b = emptyBehaviour();
  b.games = 1;
  const opp: PlayerId = pid === "p1" ? "p2" : "p1";
  let active: PlayerId = "p1";
  let lastTurn = 0;
  for (const e of state.log) {
    switch (e.type) {
      case "turnStart":
        active = e.player;
        lastTurn = e.turn;
        break;
      case "attack":
        if (active !== pid) break;
        b.attacks++;
        if (e.defenderKind === "player") b.faceAttacks++;
        break;
      case "damage":
        if (e.targetKind === "player" && e.targetRef?.kind === "player" && e.targetRef.playerId === opp) b.faceDamage += e.amount;
        break;
      case "play":
        if (e.player === pid) b.cardsPlayed++;
        break;
      case "cast":
        if (e.player !== pid || e.sourceId !== undefined) break;
        b.cardsPlayed++;
        if (e.speed === "Instant" && active !== pid) b.opponentTurnInstants++;
        break;
      case "death":
        if (e.controller === pid) b.unitsLost++;
        break;
    }
  }
  b.turns = lastTurn;
  return b;
}

/** Score totals for `style` against `opponent`, split by the faction
 * `style` piloted. */
export interface PairCell {
  games: number;
  /** Wins count 1, draws 0.5. */
  points: number;
}

export interface RingAggregate {
  seeds: number;
  firstSeed: number;
  styles: PlayStyleId[];
  weights: Record<PlayStyleId, PlayStyleWeights>;
  /** cells[style][opponent][faction] */
  cells: Record<string, Record<string, Record<string, PairCell>>>;
  /** behaviour[style][faction] */
  behaviour: Record<string, Record<string, Behaviour>>;
}

function cell(agg: RingAggregate, a: string, b: string, f: string): PairCell {
  const byOpp = (agg.cells[a] ??= {});
  const byF = (byOpp[b] ??= {});
  return (byF[f] ??= { games: 0, points: 0 });
}

function behaviourCell(agg: RingAggregate, s: string, f: string): Behaviour {
  const byF = (agg.behaviour[s] ??= {});
  return (byF[f] ??= emptyBehaviour());
}

/** Plays the ring (or one shard of it). Work units are (pair, pairing,
 * seed); shard i of k takes every unit whose index is i mod k. */
export async function playRing(opts: {
  seeds: number;
  firstSeed?: number;
  styles?: PlayStyleId[];
  weights?: Partial<Record<PlayStyleId, PlayStyleWeights>>;
  shard?: { i: number; k: number };
}): Promise<RingAggregate> {
  const styles = opts.styles ?? [...PLAY_STYLE_IDS];
  const weights = Object.fromEntries(styles.map((s) => [s, opts.weights?.[s] ?? PLAY_STYLES[s].weights])) as Record<PlayStyleId, PlayStyleWeights>;
  const firstSeed = opts.firstSeed ?? 1;
  const agg: RingAggregate = { seeds: opts.seeds, firstSeed, styles, weights, cells: {}, behaviour: {} };
  const shard = opts.shard ?? { i: 0, k: 1 };
  let unit = 0;
  for (let x = 0; x < styles.length; x++) {
    for (let y = x + 1; y < styles.length; y++) {
      const sx = styles[x]!;
      const sy = styles[y]!;
      for (const fa of FACTIONS) {
        for (const fb of FACTIONS) {
          for (let seed = firstSeed; seed < firstSeed + opts.seeds; seed++) {
            if (unit++ % shard.k !== shard.i) continue;
            const agentSeed = seed * 104729 + 31;
            for (const [p1Style, p2Style] of [[sx, sy], [sy, sx]] as const) {
              const deck1 = { ...BUILDERS[fa]("p1", fa), signature: approvedSignatureFor(seed, 0) };
              const deck2 = { ...BUILDERS[fb]("p2", fb), signature: approvedSignatureFor(seed, 1) };
              const a1 = new Observed(new LookaheadAgent(PLAY_STYLES[p1Style].name, agentSeed, { style: weights[p1Style] }), p1Style === "calculator");
              const a2 = new Observed(new LookaheadAgent(PLAY_STYLES[p2Style].name, agentSeed, { style: weights[p2Style] }), p2Style === "calculator");
              const { state } = await runMatch(deck1, deck2, a1, a2, seed);
              const p1Points = state.winner === "draw" ? 0.5 : state.winner === "p1" ? 1 : 0;
              const c1 = cell(agg, p1Style, p2Style, fa);
              c1.games++;
              c1.points += p1Points;
              const c2 = cell(agg, p2Style, p1Style, fb);
              c2.games++;
              c2.points += 1 - p1Points;
              addBehaviour(behaviourCell(agg, p1Style, fa), { ...behaviourOf(state, "p1"), ...a1.seen });
              addBehaviour(behaviourCell(agg, p2Style, fb), { ...behaviourOf(state, "p2"), ...a2.seen });
            }
          }
        }
      }
    }
  }
  return agg;
}

export function mergeAggregates(parts: RingAggregate[]): RingAggregate {
  const first = parts[0];
  if (!first) throw new Error("nothing to merge");
  const out: RingAggregate = { seeds: first.seeds, firstSeed: first.firstSeed, styles: first.styles, weights: first.weights, cells: {}, behaviour: {} };
  for (const p of parts) {
    if (JSON.stringify(p.weights) !== JSON.stringify(first.weights) || p.seeds !== first.seeds || p.firstSeed !== first.firstSeed) throw new Error("shards measured different rings");
    for (const [a, byOpp] of Object.entries(p.cells))
      for (const [b, byF] of Object.entries(byOpp))
        for (const [f, c] of Object.entries(byF)) {
          const t = cell(out, a, b, f);
          t.games += c.games;
          t.points += c.points;
        }
    for (const [s, byF] of Object.entries(p.behaviour)) for (const [f, b] of Object.entries(byF)) addBehaviour(behaviourCell(out, s, f), b);
  }
  return out;
}

const sumCells = (cells: PairCell[]): PairCell => cells.reduce((t, c) => ({ games: t.games + c.games, points: t.points + c.points }), { games: 0, points: 0 });

/** A style's score against the field (every other style in the ring). */
export function fieldScore(agg: RingAggregate, style: PlayStyleId): PairCell {
  return sumCells(Object.values(agg.cells[style] ?? {}).flatMap((byF) => Object.values(byF)));
}

export function pairScore(agg: RingAggregate, style: PlayStyleId, opponent: PlayStyleId, faction?: Faction): PairCell {
  const byF = agg.cells[style]?.[opponent] ?? {};
  return sumCells(faction ? [byF[faction] ?? { games: 0, points: 0 }] : Object.values(byF));
}

export function passesFairness(agg: RingAggregate, style: PlayStyleId): boolean {
  const c = fieldScore(agg, style);
  return Math.abs(c.points / c.games - 0.5) <= STYLE_FAIRNESS_LIMIT + 1e-12;
}

const pct = (x: number) => (x * 100).toFixed(1);
const interval = (c: PairCell) => {
  const w = wilson(c.points, c.games);
  return `[${pct(w.lo)}, ${pct(w.hi)}]`;
};

export function formatReport(agg: RingAggregate): string {
  const lines: string[] = [];
  const styles = agg.styles;
  const games = styles.reduce((n, s) => n + fieldScore(agg, s).games, 0) / 2;
  lines.push(`AI-TCG play-style ring: ${styles.length} styles, every pair x 16 faction pairings x ${agg.seeds} seeds (from ${agg.firstSeed}) x both seats = ${games} games.`);
  lines.push("Shipped decks, an approved signature card each side (the real-match draw). Win 1, draw 0.5, loss 0; the field averages 50%.");
  lines.push(`Rule (proposed): each style's score against the field within ${STYLE_FAIRNESS_LIMIT * 100} points of 50%.`);
  lines.push("");
  lines.push("Weights (changes from Calculator):");
  const calc = PLAY_STYLES.calculator.weights;
  for (const s of styles) {
    const wts = agg.weights[s];
    const changes = (Object.keys(wts) as (keyof PlayStyleWeights)[]).filter((k) => wts[k] !== calc[k]).map((k) => `${k} ${wts[k]}`);
    lines.push(`  ${PLAY_STYLES[s].name.padEnd(11)} ${changes.length ? changes.join(", ") : "(the reference)"}`);
  }
  lines.push("");
  lines.push("1. Against the field");
  for (const s of styles) {
    const c = fieldScore(agg, s);
    const r = c.points / c.games;
    lines.push(
      `  ${PLAY_STYLES[s].name.padEnd(11)} ${pct(r).padStart(5)}% ${interval(c).padEnd(14)} of ${String(c.games).padStart(6)}  ` +
        `${(r - 0.5 >= 0 ? "+" : "") + pct(r - 0.5)} pts  ${passesFairness(agg, s) ? "PASS" : "FAIL"}`,
    );
  }
  lines.push("");
  lines.push("2. Head to head (row's score against column)");
  lines.push("  " + "".padEnd(11) + styles.map((s) => PLAY_STYLES[s].name.slice(0, 10).padStart(11)).join(""));
  for (const a of styles) {
    lines.push(
      "  " +
        PLAY_STYLES[a].name.padEnd(11) +
        styles
          .map((b) => {
            if (a === b) return "-".padStart(11);
            const c = pairScore(agg, a, b);
            return `${pct(c.points / c.games)}%`.padStart(11);
          })
          .join(""),
    );
  }
  lines.push("");
  lines.push("3. Against the field, by the faction the style pilots");
  lines.push("  " + "".padEnd(11) + FACTIONS.map((f) => f.padStart(9)).join(""));
  for (const s of styles) {
    lines.push(
      "  " +
        PLAY_STYLES[s].name.padEnd(11) +
        FACTIONS.map((f) => {
          const c = sumCells(styles.filter((o) => o !== s).map((o) => pairScore(agg, s, o, f)));
          return `${pct(c.points / c.games)}%`.padStart(9);
        }).join(""),
    );
  }
  if (styles.includes("calculator")) {
    lines.push("");
    lines.push("4. Against Calculator (today's agent), by faction piloted (the signature test's shape: each edge vs the reference)");
    lines.push("  " + "".padEnd(11) + FACTIONS.map((f) => f.padStart(9)).join("") + "      all");
    for (const s of styles.filter((x) => x !== "calculator")) {
      lines.push(
        "  " +
          PLAY_STYLES[s].name.padEnd(11) +
          FACTIONS.map((f) => {
            const c = pairScore(agg, s, "calculator", f);
            return `${pct(c.points / c.games)}%`.padStart(9);
          }).join("") +
          `${pct(pairScore(agg, s, "calculator").points / pairScore(agg, s, "calculator").games)}%`.padStart(9),
      );
    }
  }
  lines.push("");
  lines.push("5. How each style plays (per game, all factions)");
  lines.push("  " + "".padEnd(11) + ["attacks", "at face", "face dmg", "cards", "opp-turn inst", "units lost", "unspent/turn", "turns", "off Calc"].map((h) => h.padStart(14)).join(""));
  for (const s of styles) {
    const b = emptyBehaviour();
    for (const f of FACTIONS) addBehaviour(b, agg.behaviour[s]?.[f] ?? emptyBehaviour());
    const per = (x: number) => (x / b.games).toFixed(2).padStart(14);
    lines.push(
      "  " +
        PLAY_STYLES[s].name.padEnd(11) +
        per(b.attacks) +
        `${pct(b.faceAttacks / Math.max(1, b.attacks))}%`.padStart(14) +
        per(b.faceDamage) +
        per(b.cardsPlayed) +
        per(b.opponentTurnInstants) +
        per(b.unitsLost) +
        (b.unspentEnergy / Math.max(1, b.turnsEnded)).toFixed(2).padStart(14) +
        per(b.turns) +
        `${pct(b.divergent / Math.max(1, b.decisions))}%`.padStart(14),
    );
  }
  return lines.join("\n");
}

/** `--set rusher.face=2.5,gambler.margin=1` on top of the presets. */
export function parseOverrides(spec: string | undefined): Partial<Record<PlayStyleId, PlayStyleWeights>> {
  const out: Partial<Record<PlayStyleId, PlayStyleWeights>> = {};
  if (!spec) return out;
  for (const part of spec.split(",")) {
    const m = /^(\w+)\.(\w+)=(-?[\d.]+)$/.exec(part.trim());
    if (!m || !isPlayStyleId(m[1]!) || !(m[2]! in PLAY_STYLES.calculator.weights)) throw new Error(`bad --set entry "${part}"`);
    const id = m[1] as PlayStyleId;
    out[id] = { ...(out[id] ?? PLAY_STYLES[id].weights), [m[2]!]: Number(m[3]) };
  }
  return out;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1]?.endsWith("playStyleRing.ts")) {
  const cmd = process.argv[2];
  if (cmd === "run") {
    const seeds = Number(arg("seeds") ?? 100);
    const firstSeed = Number(arg("first") ?? 1);
    const styles = arg("styles")?.split(",").filter(isPlayStyleId);
    const shardArg = arg("shard");
    const shard = shardArg ? { i: Number(shardArg.split("/")[0]), k: Number(shardArg.split("/")[1]) } : undefined;
    const agg = await playRing({ seeds, firstSeed, styles, weights: parseOverrides(arg("set")), shard });
    const out = arg("out");
    if (out) writeFileSync(out, JSON.stringify(agg));
    else console.log(formatReport(agg));
  } else if (cmd === "report") {
    const files = process.argv.slice(3).filter((a) => !a.startsWith("--"));
    console.log(formatReport(mergeAggregates(files.map((f) => JSON.parse(readFileSync(f, "utf8")) as RingAggregate))));
  } else {
    console.error("usage: playStyleRing.ts run [--seeds N] [--first S] [--styles a,b] [--set s.w=x] [--shard i/k] [--out file] | report file...");
    process.exit(1);
  }
}
