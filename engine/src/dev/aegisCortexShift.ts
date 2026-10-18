// Why did Aegis > Cortex move? (owner 2026-10-18, answers to session 41,
// item 2: "investigate why the edge moved and propose a fix at a check-in.
// Don't change any cards for it without the owner's OK.")
//
// Session 41's agent fix moved the gate edge from 52.2% to 49.3% with no
// card changed, so the move is the agent playing differently. This report
// splits it by seat: the same Aegis vs Cortex games (measurePairing's
// seeding: seed parity picks who goes first, the same agent seed for both)
// with each side piloted by the session-40 agent or the current one, all
// four combinations. Then, for the old/old and new/new games, each side's
// card use (share of games the card was played, and the first faction's win
// rate in those games), so the cards whose use moved are named.
//
// The session-40 agent is loaded from a module path, as agentHeadToHead.ts
// does:
//   git show 7a1151c:engine/src/agents/lookaheadAgent.ts > src/agents/lookaheadAgentPrev.ts
//   npx tsx src/dev/aegisCortexShift.ts ../agents/lookaheadAgentPrev.js [seeds=2500]
// (delete the copy afterwards). Seeds 1..2500 are the gate's own, so the
// new/new cell reproduces ringBaseline.json's 1,233 of 2,500.

import { compareTwoProportions, wilson } from "./edgeMeasure.js";
import { buildAegisDeck, buildCortexDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import type { Agent } from "../agents/agent.js";
import type { GameState, PlayerId } from "../state/types.js";

const [modulePath, seedArg] = process.argv.slice(2);
if (!modulePath) {
  console.error("Usage: aegisCortexShift.ts <module exporting the older LookaheadAgent, relative to src/dev/> [seeds=2500]");
  process.exit(1);
}
const seeds = Number(seedArg ?? 2500);
const Prev = (await import(modulePath)).LookaheadAgent as new (name: string, seed: number) => Agent;
const pct = (x: number) => (x * 100).toFixed(1);
const say = (line = "") => console.log(line);

type Pilot = "old" | "new";
interface CardUse { games: number; aegisWins: number }
interface Cell {
  games: number;
  aegisWins: number;
  draws: number;
  turns: number;
  turnCap: number;
  /** By side, then card name: games it was played in. */
  use: Record<"Aegis" | "Cortex", Map<string, CardUse>>;
  /** Average total energy each side spent, and units it lost. */
  spent: Record<"Aegis" | "Cortex", number>;
  unitsLost: Record<"Aegis" | "Cortex", number>;
}

function playedNames(state: GameState, pid: PlayerId): Set<string> {
  const out = new Set<string>();
  for (const e of state.log) {
    if ((e.type === "play" || e.type === "cast") && e.player === pid) out.add(e.card.split(" — ")[0]!);
    else if (e.type === "toolAttached" && e.player === pid) out.add(e.tool);
    else if (e.type === "evolve" && e.player === pid) out.add(e.to);
  }
  return out;
}

async function cell(aegis: Pilot, cortex: Pilot): Promise<Cell> {
  const c: Cell = {
    games: 0, aegisWins: 0, draws: 0, turns: 0, turnCap: 0,
    use: { Aegis: new Map(), Cortex: new Map() },
    spent: { Aegis: 0, Cortex: 0 },
    unitsLost: { Aegis: 0, Cortex: 0 },
  };
  const make = (p: Pilot, name: string, seed: number): Agent => (p === "new" ? new LookaheadAgent(name, seed) : new Prev(name, seed));
  for (let seed = 1; seed <= seeds; seed++) {
    // measurePairing: Cortex is slot A (earlier in FACTIONS), and A goes first on odd seeds.
    const agentSeed = seed * 104729 + 31;
    const cortexFirst = seed % 2 === 1;
    const deckC = buildCortexDeck("p1", "Cortex Deck");
    const deckA = buildAegisDeck("p2", "Aegis Deck");
    const agentC = make(cortex, "Lookahead-Cortex", agentSeed);
    const agentA = make(aegis, "Lookahead-Aegis", agentSeed);
    const { state } = cortexFirst
      ? await runMatch(deckC, deckA, agentC, agentA, seed)
      : await runMatch(deckA, deckC, agentA, agentC, seed);
    const pid: Record<"Aegis" | "Cortex", PlayerId> = cortexFirst ? { Cortex: "p1", Aegis: "p2" } : { Aegis: "p1", Cortex: "p2" };
    c.games++;
    c.turns += state.turnNumber;
    const won = state.winner === pid.Aegis;
    if (state.winner === "draw") c.draws++;
    if (won) c.aegisWins++;
    const over = state.log.find((e) => e.type === "gameOver");
    if (over?.cause?.kind === "turnCap") c.turnCap++;
    for (const side of ["Aegis", "Cortex"] as const) {
      for (const name of playedNames(state, pid[side])) {
        const u = c.use[side].get(name) ?? { games: 0, aegisWins: 0 };
        u.games++;
        if (won) u.aegisWins++;
        c.use[side].set(name, u);
      }
      c.unitsLost[side] += state.log.filter((e) => e.type === "death" && e.controller === pid[side]).length;
    }
  }
  return c;
}

say(`# Aegis vs Cortex, split by pilot: ${seeds} gate seeds per cell (measurePairing's seeding)`);
say();
const cells = new Map<string, Cell>();
for (const aegis of ["old", "new"] as Pilot[]) {
  for (const cortex of ["old", "new"] as Pilot[]) {
    const t0 = Date.now();
    const c = await cell(aegis, cortex);
    cells.set(`${aegis}/${cortex}`, c);
    const w = wilson(c.aegisWins, c.games);
    say(`  Aegis piloted by the ${aegis.padEnd(3)} agent, Cortex by the ${cortex.padEnd(3)}: Aegis wins ${pct(c.aegisWins / c.games)}% [${pct(w.lo)}, ${pct(w.hi)}]` +
      `  draws ${c.draws}  turn-cap ends ${c.turnCap}  mean turns ${(c.turns / c.games).toFixed(1)}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
}
say();
const get = (k: string) => cells.get(k)!;
const diff = (a: string, b: string, label: string) => {
  const x = get(a), y = get(b);
  const r = compareTwoProportions(x.aegisWins, x.games, y.aegisWins, y.games);
  say(`  ${label.padEnd(58)} ${(r.diff.diff * 100 >= 0 ? "+" : "") + (r.diff.diff * 100).toFixed(1)} [${(r.diff.lo * 100).toFixed(1)}, ${(r.diff.hi * 100).toFixed(1)}]${r.verdict === "no detectable difference" ? "" : "  real"}`);
};
say("## Where the move comes from (Aegis win rate, change in points, Newcombe 95%)");
diff("new/new", "old/old", "both agents changed (the gate's move)");
diff("old/new", "old/old", "only Cortex's pilot changed");
diff("new/old", "old/old", "only Aegis's pilot changed");
diff("new/new", "new/old", "Cortex's pilot changed, Aegis already new");
diff("new/new", "old/new", "Aegis's pilot changed, Cortex already new");
say();

function useTable(side: "Aegis" | "Cortex"): void {
  const before = get("old/old"), after = get("new/new");
  const names = new Set([...before.use[side].keys(), ...after.use[side].keys()]);
  const rows = [...names].map((name) => {
    const b = before.use[side].get(name) ?? { games: 0, aegisWins: 0 };
    const a = after.use[side].get(name) ?? { games: 0, aegisWins: 0 };
    return { name, b, a, move: a.games / after.games - b.games / before.games };
  }).sort((x, y) => Math.abs(y.move) - Math.abs(x.move));
  say(`## ${side}'s cards: share of games played, old/old -> new/new (Aegis's win rate in those games)`);
  for (const r of rows) {
    const share = (u: CardUse, n: number) => `${pct(u.games / n).padStart(5)}%`;
    const wr = (u: CardUse) => (u.games ? `${pct(u.aegisWins / u.games).padStart(5)}%` : "    -");
    say(`  ${r.name.padEnd(24)} ${share(r.b, before.games)} (${wr(r.b)}) -> ${share(r.a, after.games)} (${wr(r.a)})   ${(r.move * 100 >= 0 ? "+" : "") + (r.move * 100).toFixed(1)}`);
  }
  say(`  units lost a game: ${(before.unitsLost[side] / before.games).toFixed(2)} -> ${(after.unitsLost[side] / after.games).toFixed(2)}`);
  say();
}
useTable("Cortex");
useTable("Aegis");
