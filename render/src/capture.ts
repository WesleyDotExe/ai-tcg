// Runs a real match through the public engine API — createInitialState,
// getLegalMoves, applyMove, beginTurn, buildPlayerView, exactly what
// engine/src/engine/match.ts's runMatch itself calls — but, unlike
// runMatch (whose only hook is onMatchStart), takes a full board snapshot
// after *every* move, which is what lets the replay page step turn by turn
// instead of only showing the final result. This duplicates runMatch's loop
// body rather than modifying match.ts to add a hook, per RENDER.md's "never
// modify an engine file" guardrail — the loop itself is ~10 lines, entirely
// public API calls, so the duplication is small and honest, not a shortcut.
import {
  createInitialState,
  getLegalMoves,
  applyMove,
  beginTurn,
  buildPlayerView,
  Rng,
  formatEvent,
  otherPlayer,
  MAX_ENERGY_CAP,
  CARD_REGISTRY,
} from "@ai-tcg/engine";
import type { Agent, DeckSpec, GameState, PlayerId, Card, UnitInstance } from "@ai-tcg/engine";
import {
  currentAttack,
  currentHealth,
  currentMaxHealth,
  boardSlotsUsed,
  hasKeyword,
  effectiveCardCost,
  signatureCost,
} from "./engineInternal.js";
import { abilityKey, buildFeed } from "./feed.js";
import { visualPatternFor, visualSeedFor } from "./cardVisual.js";
import { computeMomentum } from "./momentum.js";
import { avatarSvg } from "./avatar.js";
import { assignSlots } from "./slotLayout.js";
import type { Faction, Rarity } from "./engineInternal.js";
import type { CardRef, PlayerIdentity, DirectiveSnapshot, SignatureSnapshot, Frame, MatchReplay, PlayerSnapshot, StackItemSnapshot, UnitSnapshot } from "./types.js";

const MAX_MOVES_SAFETY = 5000;

function toCardRef(state: GameState, pid: PlayerId, card: Card): CardRef {
  return {
    cardId: card.id,
    name: card.name,
    faction: card.faction,
    rarity: card.rarity,
    type: card.type,
    cost: effectiveCardCost(state, pid, card),
    flavor: card.flavor,
    visualSeed: visualSeedFor(card.id),
    visualPattern: visualPatternFor(card.id),
  };
}

function toUnitSnapshot(state: GameState, unit: UnitInstance): UnitSnapshot {
  return {
    instanceId: unit.instanceId,
    cardId: unit.card.id,
    name: unit.card.name,
    faction: unit.card.faction,
    rarity: unit.card.rarity,
    flavor: unit.card.flavor,
    attack: currentAttack(state, unit),
    health: Math.max(0, currentHealth(state, unit)),
    maxHealth: currentMaxHealth(state, unit),
    keywords: (["Rush", "Guard", "Barrier"] as const).filter((k) => hasKeyword(unit, k)),
    pending: unit.pending === true,
    armTurn: unit.armTurn,
    isEvolved: unit.card.evolvesFrom !== undefined,
    canAttackThisTurn: !unit.pending && !unit.hasAttackedThisTurn,
    baseArmor: unit.card.baseArmor ?? 0,
    barrierActive: unit.statuses.some((s) => s.kind === "Barrier"),
    printedAttack: unit.card.attack,
    printedHealth: unit.card.health,
    printedCost: unit.card.cost,
    turnBuff: { attack: unit.turnBuff.attack, health: unit.turnBuff.health },
    tools: unit.tools.map((t) => ({
      name: t.name,
      attackBonus: t.attackBonus,
      healthBonus: t.healthBonus,
      grantedKeywords: t.grantedKeywords,
    })),
    statuses: unit.statuses.map((s) => ({ kind: s.kind, duration: s.duration })),
    visualSeed: visualSeedFor(unit.card.id),
    visualPattern: visualPatternFor(unit.card.id),
    ...(unit.signature ? { isSignature: true as const } : {}),
  };
}

function toSignatureSnapshot(state: GameState, pid: PlayerId): SignatureSnapshot | null {
  const zone = state.players[pid].signature;
  if (!zone) return null;
  const card = zone.card;
  return {
    cardId: card.id,
    name: card.name,
    faction: card.faction,
    rarity: card.rarity,
    flavor: card.flavor,
    attack: card.attack,
    health: card.health,
    keywords: [...card.keywords],
    text: card.abilities.map((a) => a.text),
    nextCost: signatureCost(state, pid)!,
    baseCost: card.cost,
    timesPlayed: zone.timesPlayed,
    inZone: zone.inZone,
    visualSeed: visualSeedFor(card.id),
    visualPattern: visualPatternFor(card.id),
  };
}

function toDirectiveSnapshot(d: { instanceId: string; card: Card }): DirectiveSnapshot {
  return {
    instanceId: d.instanceId,
    cardId: d.card.id,
    name: d.card.name,
    faction: d.card.faction,
    rarity: d.card.rarity,
    flavor: d.card.flavor,
    printedCost: d.card.cost,
    visualSeed: visualSeedFor(d.card.id),
    visualPattern: visualPatternFor(d.card.id),
  };
}

function playerFaction(p: GameState["players"][PlayerId]): PlayerSnapshot["faction"] {
  const cards = [...p.deck, ...p.hand, ...p.graveyard, ...p.board.map((u) => u.card), ...p.directives.map((d) => d.card)];
  return cards.find((c) => c.faction !== "Neutral")?.faction ?? "Cortex";
}

function toPlayerSnapshot(state: GameState, pid: PlayerId, slotsMax: number): PlayerSnapshot {
  const p = state.players[pid];
  return {
    id: pid,
    name: p.name,
    // The deck's own faction, not the first card seen: a deck may run
    // Neutral cards (engine data/neutralCards.ts), so any one card can be
    // the wrong answer.
    faction: playerFaction(p),
    health: Math.max(0, p.health),
    maxHealth: p.maxHealth,
    energy: p.energy,
    maxEnergy: p.maxEnergy,
    hand: p.hand.map((c) => toCardRef(state, pid, c)),
    deckSize: p.deck.length,
    graveyardSize: p.graveyard.length,
    board: p.board.map((u) => toUnitSnapshot(state, u)),
    directives: p.directives.map(toDirectiveSnapshot),
    slotsUsed: boardSlotsUsed(p),
    slotsMax,
    signature: toSignatureSnapshot(state, pid),
  };
}

function describeStackItem(item: GameState["stack"][number]): StackItemSnapshot {
  if (item.kind === "command") {
    return { kind: "command", stackId: item.instanceId, description: item.card.name, controller: item.controller };
  }
  if (item.kind === "ability") {
    const snap: StackItemSnapshot = { kind: "ability", stackId: item.instanceId, description: `${item.source.cardName} — ${item.ability.text}`, controller: item.controller };
    if ("instanceId" in item.source) snap.sourceInstanceId = item.source.instanceId;
    return snap;
  }
  const snap: StackItemSnapshot = {
    kind: "combatDamage",
    stackId: item.instanceId,
    description: `${item.attackerName}'s attack`,
    controller: item.controller,
    attackerInstanceId: item.attackerInstanceId,
  };
  if (item.target.kind === "unit") snap.target = { kind: "unit", instanceId: item.target.instanceId };
  else if (item.target.kind === "player") snap.target = { kind: "player", playerId: item.target.playerId };
  return snap;
}

function buildFrame(state: GameState, index: number, slotsMax: number, newEvents: GameState["log"]): Frame {
  const players = {
    p1: toPlayerSnapshot(state, "p1", slotsMax),
    p2: toPlayerSnapshot(state, "p2", slotsMax),
  };
  return {
    index,
    turnNumber: state.turnNumber,
    activePlayer: state.activePlayer,
    priority: state.priority,
    winner: state.winner,
    stack: state.stack.map(describeStackItem),
    players,
    newEvents: newEvents.map((event) => ({ event, text: formatEvent(event) })),
    momentum: computeMomentum(players.p1, players.p2),
  };
}

export interface CaptureOptions {
  title: string;
  seed: number;
  deckA: DeckSpec;
  deckB: DeckSpec;
  agentA: Agent;
  agentB: Agent;
  /** Shared board-slot cap (state/init.ts's BOARD_SLOTS) — passed in rather
   * than hardcoded so a future engine change to the constant can't silently
   * desync the render's "slots used / N" display. */
  boardSlots: number;
}

export async function captureMatch(opts: CaptureOptions): Promise<MatchReplay> {
  const rng = new Rng(opts.seed);
  const state = createInitialState(opts.deckA, opts.deckB, rng);
  state.players.p1.name = opts.agentA.name;
  state.players.p2.name = opts.agentB.name;
  state.turnNumber = 1;
  state.activePlayer = "p1";
  beginTurn(state, "p1", rng, { draw: false });

  const frames: Frame[] = [buildFrame(state, 0, opts.boardSlots, state.log)];
  const agents: Record<PlayerId, Agent> = { p1: opts.agentA, p2: opts.agentB };
  let movesPlayed = 0;
  let lastLogLength = state.log.length;

  while (!state.winner && movesPlayed < MAX_MOVES_SAFETY) {
    const legalMoves = getLegalMoves(state);
    if (legalMoves.length === 0) break;
    const view = buildPlayerView(state, state.priority);
    const move = await agents[state.priority].decideMove(view, legalMoves);
    applyMove(state, move, rng);
    movesPlayed++;
    const newEvents = state.log.slice(lastLogLength);
    lastLogLength = state.log.length;
    frames.push(buildFrame(state, movesPlayed, opts.boardSlots, newEvents));
  }

  const factionOf = (pid: PlayerId): PlayerSnapshot["faction"] => frames[frames.length - 1]!.players[pid].faction;

  const cardFactions: Record<string, Faction> = {};
  const cardRarities: Record<string, Rarity> = {};
  for (const card of [...opts.deckA.cards, ...opts.deckB.cards]) {
    cardFactions[card.name] = card.faction;
    cardRarities[card.name] = card.rarity;
  }
  for (const frame of frames) {
    for (const pid of ["p1", "p2"] as const) {
      for (const u of frame.players[pid].board) {
        cardFactions[u.name] ??= u.faction;
        cardRarities[u.name] ??= u.rarity;
      }
    }
  }

  const identityFor = (name: string): PlayerIdentity => ({ username: name, avatarSvg: avatarSvg(name) });

  return {
    title: opts.title,
    seed: opts.seed,
    agentNames: { p1: opts.agentA.name, p2: opts.agentB.name },
    identities: { p1: identityFor(opts.agentA.name), p2: identityFor(opts.agentB.name) },
    cardFactions,
    cardRarities,
    factions: { p1: factionOf("p1"), p2: factionOf("p2") },
    movesPlayed,
    turnCap: state.turnCap,
    energyCap: MAX_ENERGY_CAP,
    frames: withFeed(assignSlots(frames), { p1: opts.agentA.name, p2: opts.agentB.name }, [opts.deckA, opts.deckB]),
  };
}

/** Every ability's rules text, keyed by card name and ability id
 * (feed.ts abilityKey): the set's cards and both decks' cards, signature
 * cards included (they are generated, not in the set). Not by id alone:
 * before game session 38 generated signature cards shared ids with
 * different numbers ("sig-recycle" was "Draw 2 cards." on one card and
 * "Draw 3 cards." on another), and replays recorded then still carry them. */
export function abilityTextFor(decks: DeckSpec[]): Record<string, string> {
  const text: Record<string, string> = {};
  const add = (card: Card) => {
    for (const a of card.abilities) text[abilityKey(card.name, a.id)] = a.text;
  };
  for (const card of CARD_REGISTRY.values()) add(card);
  for (const deck of decks) {
    for (const card of deck.cards) add(card);
    if (deck.signature) add(deck.signature);
  }
  return text;
}

/** Puts the spectator feed (render/src/feed.ts) on each frame. */
function withFeed(frames: Frame[], names: Record<PlayerId, string>, decks: DeckSpec[]): Frame[] {
  const feed = buildFeed(frames, { names, abilityText: abilityTextFor(decks) });
  return frames.map((frame, i) => ({ ...frame, feed: feed[i]! }));
}

// Re-exported so callers (cli.ts) don't need a second import line just for
// the one helper they need alongside captureMatch.
export { otherPlayer };
