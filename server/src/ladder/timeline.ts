// A match's move-by-move timeline (session 67): what the ladder keeps while
// the engine plays a match, so the server can release it at watch speed
// (Watch live, the Live match widget) and write a replay that rebuilds the
// match exactly.
//
// The engine plays a ladder match headless, start to end, in well under a
// second. The timeline is that match cut into steps, one per move: the move
// itself, the log events it caused (the engine's own events, the ones a
// spectator client animates, and their formatted lines), and a public
// snapshot of the board after it. Watch live is this timeline released a
// step at a time on the watch-speed clock (`pace` below), so nobody watching,
// and no agent, can see a step before its time: the match is already over
// in the engine, which is also why watching it can never feed back into it.

import { currentAttack, currentHealth, currentMaxHealth, formatEvent, signatureCost, type GameEvent, type GameState, type Move, type PlayerId } from "@ai-tcg/engine";

/** A side's signature card as anyone watching may see it (session 72, the
 * owner's render-51 ask): the card itself and its zone, as the engine's
 * SignatureZone has them. The signature card is public information in the
 * engine (both players always know it), so this hides nothing. */
export interface PublicSignature {
  cardId: string;
  name: string;
  /** The printed cost, attack and health (the card, not a unit in play:
   * a played signature card's live stats are its board entry's). */
  cost: number;
  attack: number;
  health: number;
  keywords: string[];
  /** The card's rules text, one line per ability, as printed (a card whose
   * only text is a keyword has none: draw its keywords). */
  rulesText: string[];
  /** The card's art reference (its generated art slot) and flavour. */
  art: string;
  flavor: string;
  /** How many times it has been played this match. */
  timesPlayed: number;
  /** True while it waits in the signature zone; false while on the board. */
  inZone: boolean;
  /** What playing it would cost now: its effective cost (cost modifiers in
   * play apply) plus the replay surcharge for every earlier play. Read it
   * while `inZone`; on the board it is what the next replay would cost if
   * it came back now. */
  nextCost: number;
  /** timesPlayed > 0 (the field before session 72, kept). */
  played: boolean;
}

/** One side of the board, as anyone watching may see it (no hand or deck
 * contents: counts only). */
export interface PublicSide {
  name: string;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  hand: number;
  deck: number;
  graveyard: number;
  board: { instanceId: string; cardId: string; name: string; attack: number; health: number; maxHealth: number; pending: boolean; tools: string[] }[];
  directives: { instanceId: string; cardId: string; name: string }[];
  /** The signature card in full (session 72); null without one. */
  signature: PublicSignature | null;
}

export interface PublicSnapshot {
  turn: number;
  activePlayer: PlayerId;
  priority: PlayerId;
  /** Items waiting on the stack (Commands, abilities, attacks). */
  stack: number;
  winner: PlayerId | "draw" | null;
  p1: PublicSide;
  p2: PublicSide;
}

export interface TimelineStep {
  /** 1 for the first move. */
  n: number;
  move: Move;
  /** Who made it. */
  by: PlayerId;
  /** The engine events this move caused, in order. */
  events: GameEvent[];
  /** The same events as the match log prints them. */
  lines: string[];
  /** The board after the move. */
  after: PublicSnapshot;
}

export interface Timeline {
  /** The board before the first move (opening hands drawn, turn 1 begun). */
  start: PublicSnapshot;
  /** (session 72) Each side's opening hand, by card id in hand order, as it
   * stood before the first move. The timeline always keeps it; whether a
   * live feed may send it is the feed's call (liveLadder.ts: only for a
   * match decided before it is shown). */
  openingHands: { p1: string[]; p2: string[] };
  /** Lines logged before the first move (the opening draws). */
  startLines: string[];
  steps: TimelineStep[];
}

export function publicSnapshot(state: GameState): PublicSnapshot {
  const side = (pid: PlayerId): PublicSide => {
    const p = state.players[pid];
    return {
      name: p.name,
      health: p.health,
      maxHealth: p.maxHealth,
      energy: p.energy,
      maxEnergy: p.maxEnergy,
      hand: p.hand.length,
      deck: p.deck.length,
      graveyard: p.graveyard.length,
      board: p.board.map((u) => ({
        instanceId: u.instanceId,
        cardId: u.card.id,
        name: u.card.name,
        attack: currentAttack(state, u),
        health: Math.max(0, currentHealth(state, u)),
        maxHealth: currentMaxHealth(state, u),
        pending: u.pending === true,
        tools: u.tools.map((t) => t.name),
      })),
      directives: p.directives.map((d) => ({ instanceId: d.instanceId, cardId: d.card.id, name: d.card.name })),
      signature: p.signature === null ? null : publicSignature(state, pid),
    };
  };
  return {
    turn: state.turnNumber,
    activePlayer: state.activePlayer,
    priority: state.priority,
    stack: state.stack.length,
    winner: state.winner ?? null,
    p1: side("p1"),
    p2: side("p2"),
  };
}

function publicSignature(state: GameState, pid: PlayerId): PublicSignature {
  const zone = state.players[pid].signature!;
  const card = zone.card;
  return {
    cardId: card.id,
    name: card.name,
    cost: card.cost,
    attack: card.attack,
    health: card.health,
    keywords: [...card.keywords],
    rulesText: card.abilities.map((a) => a.text),
    art: card.art,
    flavor: card.flavor,
    timesPlayed: zone.timesPlayed,
    inZone: zone.inZone,
    nextCost: signatureCost(state, pid)!,
    played: zone.timesPlayed > 0,
  };
}

/** Keeps a timeline from runMatch's hooks: pass `hooks` to runMatch (or
 * replayMatch) and read `timeline` after. */
export function timelineRecorder(): {
  hooks: { onMatchStart(state: GameState): void; onMove(state: GameState, move: Move, n: number): void };
  timeline: Timeline;
} {
  const timeline: Timeline = { start: undefined as unknown as PublicSnapshot, openingHands: { p1: [], p2: [] }, startLines: [], steps: [] };
  let logged = 0;
  // Who holds priority is who moves next: read it before the move applies.
  let mover: PlayerId = "p1";
  return {
    timeline,
    hooks: {
      onMatchStart(state) {
        timeline.start = publicSnapshot(state);
        timeline.openingHands = { p1: state.players.p1.hand.map((c) => c.id), p2: state.players.p2.hand.map((c) => c.id) };
        timeline.startLines = state.log.map(formatEvent);
        logged = state.log.length;
        mover = state.priority;
      },
      onMove(state, move, n) {
        const events = state.log.slice(logged).map((e) => structuredClone(e));
        logged = state.log.length;
        timeline.steps.push({ n, move: structuredClone(move), by: mover, events, lines: events.map(formatEvent), after: publicSnapshot(state) });
        mover = state.priority;
      },
    },
  };
}

/** Watch speed (proposed session 67; owner check-in item): the wait at 1x
 * before each step is released (the board as it stood holds that long).
 * Measured on the shipped decks (40 house matches): a median match is 109
 * moves, 38 of them actions and 72 passes, over 14 turns. An action waits
 * 6 s, a pass 1 s, and a pass that starts a new turn 3 s more; the last
 * move holds 8 s (the result) before the match is recorded. That puts the
 * median match at about 5.8 minutes (the 5-6 minute target, DESIGN.md
 * principle 4). Speed changes only the pace, never the match. */
export const WATCH_PACE_MS = { action: 6000, pass: 1000, newTurn: 3000, end: 8000 } as const;

/** The wait at 1x before step `i` (0-based) is released. */
export function stepHoldMs(timeline: Timeline, i: number): number {
  const step = timeline.steps[i]!;
  const before = i === 0 ? timeline.start : timeline.steps[i - 1]!.after;
  let ms = step.move.type === "passPriority" ? WATCH_PACE_MS.pass : WATCH_PACE_MS.action;
  if (step.after.turn !== before.turn) ms += WATCH_PACE_MS.newTurn;
  return ms;
}

/** The whole match's length at 1x, in ms. */
export function watchLengthMs(timeline: Timeline): number {
  let total = 0;
  for (let i = 0; i < timeline.steps.length; i++) total += stepHoldMs(timeline, i);
  return total + WATCH_PACE_MS.end;
}
