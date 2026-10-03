// Null card-vs-agent check (owner-feedback 2026-09-29 note 3, and 2026-10-01
// item 4): Null's removal/debuff cards (Bit Rot, Null Pointer, Watchdog
// Timer, Decay Ward) measure as its weakest copies under LookaheadAgent. Is
// that the cards, or the agent playing them badly? The Cortex Engineer heal
// bug (session 24) showed the agent can misplay a card enough to move an
// edge ~6 points, so this checks for the same kind of failure.
//
// Method: the shipped Null deck plays every other shipped deck, both sides
// LookaheadAgent, seeding identical to lookaheadEdgeCheck.ts. The Null side's
// agent is wrapped so every time it chooses one of the four cards, the view
// it chose from is classified by what the card can actually do in that
// position:
//   - Bit Rot (-3/-0 to an enemy unit, this turn only): does the chosen unit
//     take part in a combat this turn? Live if combat damage involving it is
//     on the stack (it attacks Null, or Null attacked it), else dead: the
//     shrink wears off at end of turn before the unit fights.
//   - Decay Ward (Tool, grants Barrier): is the host already carrying
//     Barrier (the engine doesn't stack it, so the card does nothing), and
//     is it the most valuable unit the Ward could have gone on?
//   - Null Pointer (destroy a Directive): the cost of what it hit, and
//     whether a costlier target was available.
//   - Watchdog Timer (Directive, draws at end of turn only on a hand of 1
//     or fewer since session 26; empty-hand only before): hand size after the cast, and how many times it actually drew
//     over the rest of the game.
// It also counts games where each card sat in hand and was never played.
//
// --show prints the full log of the first game in which Bit Rot answered a
// declared attack (the sample-match evidence for the session-25 fix).
// --show-watchdog instead prints the first game in which Watchdog Timer drew
// into a 1-card hand (the sample-match evidence for the session-26 buff).
//
// Usage: npx tsx src/dev/nullCardPlayCheck.ts [seedsPerOpponent=300] [--policy=lookahead|aggressive] [--show|--show-watchdog]

import { FACTIONS } from "./edgeMeasure.js";
import { buildCortexDeck, buildSwarmDeck, buildAegisDeck, buildNullDeck } from "../data/decks.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { AggressiveAgent } from "../agents/aggressiveAgent.js";
import { runMatch } from "../engine/match.js";
import type { Agent, PlayerView } from "../agents/agent.js";
import type { Move } from "../engine/moves.js";
import type { DeckFaction } from "../cards/types.js";
import type { DeckSpec } from "../state/init.js";
import type { GameState, PlayerId, UnitInstance } from "../state/types.js";
import { formatLog } from "../log/format.js";

const seeds = Number(process.argv.slice(2).find((a) => !a.startsWith("--")) ?? 300);
const SHOW = process.argv.includes("--show");
const SHOW_WATCHDOG = process.argv.includes("--show-watchdog");
let liveResponseThisGame = false;
let watchdogOneCardDrawThisGame: number | undefined;
let shown: { label: string; state: GameState } | undefined;
const policy = (process.argv.find((a) => a.startsWith("--policy="))?.split("=")[1] ?? "lookahead") as "lookahead" | "aggressive";
const builders: Record<Exclude<DeckFaction, "Null">, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck,
  Swarm: buildSwarmDeck,
  Aegis: buildAegisDeck,
};

const unitValue = (u: UnitInstance) =>
  u.card.attack + u.permanentBuff.attack + u.turnBuff.attack + u.card.health + u.permanentBuff.health + u.turnBuff.health - u.damageTaken;

interface Counts {
  [key: string]: number;
}
const counts: Record<string, Counts> = { "Bit Rot": {}, "Decay Ward": {}, "Null Pointer": {}, "Watchdog Timer": {} };
const bump = (card: string, key: string, by = 1) => (counts[card]![key] = (counts[card]![key] ?? 0) + by);

class Recorder implements Agent {
  name: string;
  constructor(private inner: Agent) {
    this.name = inner.name;
  }
  async decideMove(view: PlayerView, legal: Move[]): Promise<Move> {
    const move = await this.inner.decideMove(view, legal);
    if (move.type === "attack" && move.target.kind === "unit") {
      const t = move.target;
      const i = pendingShrinks.findIndex((s) => s.id === t.instanceId && s.turn === view.turnNumber);
      if (i >= 0) {
        bump("Bit Rot", "  (of DEAD: Null attacked that unit later the same turn)");
        pendingShrinks.splice(i, 1);
      }
    }
    if (move.type !== "playCard") return move;
    const card = view.me.hand[move.handIndex];
    if (!card || !(card.name in counts)) return move;
    const myTurn = view.activePlayer === view.self;
    bump(card.name, "plays");
    bump(card.name, myTurn ? "on own turn" : "on opponent's turn");
    if (card.name === "Bit Rot") {
      const t = move.target;
      const id = t?.kind === "unit" ? t.instanceId : undefined;
      const inCombat = view.stack.some(
        (s) => s.kind === "combatDamage" && (s.attackerInstanceId === id || (s.target.kind === "unit" && s.target.instanceId === id)),
      );
      if (inCombat) {
        const attacking = view.stack.some((s) => s.kind === "combatDamage" && s.attackerInstanceId === id);
        bump(card.name, attacking ? "LIVE: target is attacking Null" : "LIVE: target is defending vs Null's attack");
        if (attacking) liveResponseThisGame = true;
      } else {
        bump(card.name, "DEAD: target not in a pending combat");
        // A shrink on Null's own turn before it attacks could still matter
        // if the agent attacked into that unit afterwards; recorded below.
        if (myTurn && id) pendingShrinks.push({ id, turn: view.turnNumber });
      }
    } else if (card.name === "Decay Ward") {
      const t = move.target;
      const host = t?.kind === "unit" ? view.me.board.find((u) => u.instanceId === t.instanceId) : undefined;
      if (!host) bump(card.name, "host not found");
      else {
        if (host.statuses.some((s) => s.kind === "Barrier")) bump(card.name, "WASTED: host already has Barrier");
        const best = Math.max(...view.me.board.filter((u) => !u.statuses.some((s) => s.kind === "Barrier")).map(unitValue), -Infinity);
        if (unitValue(host) >= best) bump(card.name, "host is the most valuable unprotected unit");
        else bump(card.name, `host below best unprotected unit`);
        bump(card.name, "sum host value", unitValue(host));
        if (best > -Infinity) bump(card.name, "sum best value", best);
      }
    } else if (card.name === "Null Pointer") {
      const t = move.target;
      const hit = t?.kind === "directive" ? view.opponent.directives.find((d) => d.instanceId === t.instanceId) : undefined;
      const best = Math.max(...view.opponent.directives.map((d) => d.card.cost));
      if (hit) {
        bump(card.name, `hit a cost-${hit.card.cost} directive`);
        if (hit.card.cost < best) bump(card.name, "a costlier directive was available");
      }
    } else if (card.name === "Watchdog Timer") {
      bump(card.name, `hand size after cast: ${view.me.hand.length - 1}`);
    }
    return move;
  }
}
// Wraps BOTH agents so it sees the state between every pair of moves. A
// Watchdog draw happens inside the move that ends Null's turn, and the next
// decision belongs to the opponent, so at that point Null's hand is exactly
// the hand it ended its turn with plus the drawn card. That gives the hand
// size the condition was checked against, which the log alone doesn't carry.
class Watcher implements Agent {
  name: string;
  constructor(
    private inner: Agent,
    private game: { state?: GameState; seen: number; pid: PlayerId },
  ) {
    this.name = inner.name;
  }
  async decideMove(view: PlayerView, legal: Move[]): Promise<Move> {
    const g = this.game;
    const log = g.state!.log;
    for (let i = Math.max(g.seen, 1); i < log.length; i++) {
      const e = log[i]!;
      const prev = log[i - 1]!;
      if (e.type === "draw" && e.player === g.pid && prev.type === "abilityTrigger" && prev.source === "Watchdog Timer") {
        const before = g.state!.players[g.pid].hand.length - 1;
        bump("Watchdog Timer", `draws it produced (hand size at end of turn: ${before})`);
        if (before === 1 && watchdogOneCardDrawThisGame === undefined) watchdogOneCardDrawThisGame = g.state!.turnNumber - 1;
      }
    }
    g.seen = log.length;
    return this.inner.decideMove(view, legal);
  }
}
let pendingShrinks: { id: string; turn: number }[] = [];

let games = 0;
let nullWins = 0;
for (const opp of FACTIONS.filter((f): f is Exclude<DeckFaction, "Null"> => f !== "Null")) {
  for (let seed = 1; seed <= seeds; seed++) {
    const oppFirst = seed % 2 === 1;
    const mk = (name: string): Agent =>
      policy === "aggressive" ? new AggressiveAgent(name) : new LookaheadAgent(name, seed * 104729 + 31);
    const pid: PlayerId = oppFirst ? "p2" : "p1";
    const game: { state?: GameState; seen: number; pid: PlayerId } = { seen: 0, pid };
    const nul = new Watcher(new Recorder(mk("Null")), game);
    const other = new Watcher(mk(opp), game);
    pendingShrinks = [];
    liveResponseThisGame = false;
    watchdogOneCardDrawThisGame = undefined;
    const hooks = { onMatchStart: (s: GameState) => (game.state = s) };
    const { state } = oppFirst
      ? await runMatch(builders[opp]("p1", opp), buildNullDeck("p2", "Null"), other, nul, seed, hooks)
      : await runMatch(buildNullDeck("p1", "Null"), builders[opp]("p2", opp), nul, other, seed, hooks);
    const label = `${oppFirst ? `${opp} (p1) vs Null (p2)` : `Null (p1) vs ${opp} (p2)`}, seed ${seed}`;
    if (SHOW && liveResponseThisGame && !shown) shown = { label: `${label}; Bit Rot cast in answer to a declared attack`, state };
    if (SHOW_WATCHDOG && watchdogOneCardDrawThisGame !== undefined && !shown)
      shown = { label: `${label}; Watchdog Timer drew into a 1-card hand at the end of turn ${watchdogOneCardDrawThisGame}`, state };
    games++;
    if (state.winner === pid) nullWins++;
    // Held and never played.
    const playedNames = new Set(state.log.filter((e) => (e.type === "play" || e.type === "cast") && e.player === pid).map((e) => (e as { card: string }).card));
    const attached = new Set(state.log.filter((e) => e.type === "toolAttached" && e.player === pid).map((e) => (e as { tool: string }).tool));
    for (const name of Object.keys(counts)) {
      const inHand = state.players[pid].hand.some((c) => c.name === name);
      if (inHand && !playedNames.has(name) && !attached.has(name)) bump(name, "games ended with it unplayed in hand");
    }
  }
}

console.log(`AI-TCG Null card-vs-agent check: shipped Null vs each shipped deck, ${policy} vs ${policy}`);
console.log(`${seeds} seeds per opponent (${games} games), seeding identical to lookaheadEdgeCheck.ts. Null won ${((nullWins / games) * 100).toFixed(1)}%.`);
for (const [card, c] of Object.entries(counts)) {
  console.log("");
  console.log(`${card}:`);
  for (const [k, v] of Object.entries(c).sort()) console.log(`  ${k.padEnd(52)} ${v}`);
}

if (shown) {
  console.log("");
  console.log(`=== Full match log: ${shown.label} ===`);
  console.log("");
  console.log(formatLog(shown.state.log));
  console.log("");
  console.log(`Winner: ${shown.state.winner}, turns: ${shown.state.turnNumber}`);
}
