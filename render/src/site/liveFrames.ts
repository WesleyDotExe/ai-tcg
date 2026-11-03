// The live match as arena frames (render session 51, the big live board).
//
// The arena (renderHtml.ts) draws a match from `Frame`s: whole boards with
// every unit's live stats, keywords, tools, statuses and arm turn, the
// stack, both hands, and the engine events each move caused. A recorded
// match gets them by rebuilding it in the engine from its replay file
// (siteReplay.ts). A live match has no file yet: the server releases it a
// move at a time (OWNER_API.md "Watch live", `GET /api/live/:id?from=N`),
// each step the engine's move, the engine's own events, and a public
// snapshot of the board after it (server/src/ladder/timeline.ts).
//
// This builds the same frames from that feed, without the engine state:
//  - straight from the public snapshot: turn, active player, priority,
//    winner, each side's health, energy, deck and graveyard counts, every
//    board unit's instance, card, live attack/health/max health, pending
//    flag and tool names, every Directive;
//  - from the card itself (the engine's card registry, read-only): faction,
//    rarity, flavour, printed cost and stats, printed keywords, base armor,
//    whether it is an evolution, each tool's bonuses and granted keywords;
//  - from the engine's events, tracked move by move (all of them exact,
//    proven against captured frames in render/test/liveFrames.test.ts):
//    the stack (pushed by `cast`/`attack`, retargeted by `attackRedirected`,
//    popped by `stackResolve`), Barrier (on arrival, by a tool, by an
//    effect; gone on `barrierAbsorbed`), arm turns (`telegraphPlaced`),
//    whether a unit has attacked this turn;
//  - from the event and the card's own ability together: a `statusApplied`
//    or `buff` event doesn't carry its duration, the card that caused it
//    does. When the source's abilities name one duration for that effect,
//    it is used (a Stasis for 1 turn, a buff until end of turn); when they
//    don't, it is left out rather than guessed (see `unknown` below).
//
//  - hands (render session 53; the owner's render-51 answer: spectators see
//    both hands live, face up, as replays do): the snapshot has the count
//    only, but each step carries the engine's move and its events, so the
//    hand is rebuilt in the engine's own order. A `playCard` move names the
//    hand position it took (`handIndex`: the engine splices that card out
//    before anything else the move does); every `draw` event names the card
//    it appends. Each card's cost is worked out as the engine's
//    effectiveCardCost does, from the public board (every cost aura is a
//    static on a unit or a Directive, and a modal card's mode is on its
//    `play` event). The rebuilt count is checked against the snapshot's
//    after every move; if they ever disagree, that hand goes back to card
//    backs for the rest of the match (`handLost`, never a wrong card).
//
// What the public feed doesn't carry, and this doesn't invent:
//  - the opening hands: they are dealt before the engine's log starts, so
//    they are in no event. The live view sends them on its start since game
//    session 72 (`openingHands`, by card id), and `LiveStart.openingHands`
//    takes them: then every hand is whole from move 0. A feed without them
//    (the safety rule for real-time network agents) leaves those cards as
//    backs, each in its place, until it is played;
//  - a signature card's abilities: while one is in play (not dormant), a
//    cost on the hand may be off by its aura, if it has one, so those costs
//    are marked unsure (`costUnsure`) rather than shown as exact;
//  - the signature zone: the snapshot has the card's name and whether it has
//    been played, not the card, so the zone isn't drawn; a signature unit on
//    the board (its card isn't in the registry) shows its live stats with
//    the side's faction and no rules text;
//  - the deck's faction: the live view sends it per side since game session
//    72 (`LiveSideView.faction`, taken by `LiveStart.factions`); without it,
//    read from the first non-Neutral card the side reveals, Neutral until
//    then.
// Each is named for the game lane in progress/render/notes-for-owner.md.

import { CARD_REGISTRY, formatEvent, type Card, type GameEvent, type PlayerId, type ToolCard } from "@ai-tcg/engine";
import type { PublicSide, PublicSnapshot, TimelineStep } from "../../../server/src/ladder/timeline.js";
import { allAbilities, type Faction, type Keyword, type Rarity } from "../engineInternal.js";
import { visualPatternFor, visualSeedFor } from "../cardVisual.js";
import { computeMomentum } from "../momentum.js";
import { avatarSvg } from "../avatar.js";
import { assignSlots } from "../slotLayout.js";
import { buildFeedWithQuiet } from "../feed.js";
import { abilityTextFor } from "../capture.js";
import type { CardRef, DirectiveSnapshot, Frame, MatchReplay, PlayerSnapshot, StackItemSnapshot, UnitSnapshot } from "../types.js";

export type { PublicSnapshot, TimelineStep };

const PIDS: PlayerId[] = ["p1", "p2"];
const KEYWORDS: Keyword[] = ["Rush", "Guard", "Barrier"];

/** What the builder needs to start: the board before the first move. */
export interface LiveStart {
  matchId: string;
  names: Record<PlayerId, string>;
  start: PublicSnapshot;
  /** The feed's `startLines`: what the engine logged before the first move. */
  startLines: string[];
  /** The engine's board-slot cap (BOARD_SLOTS). */
  boardSlots: number;
  turnCap: number;
  energyCap: number;
  /** The opening hands by card id, in hand order, if the feed sends them
   * (the live view's `openingHands` on its start, game session 72). Without
   * them the opening cards are backs until played. */
  openingHands?: Record<PlayerId, string[]>;
  /** Each side's deck faction, if the feed sends it (`LiveSideView.faction`,
   * game session 72). Without it, the first non-Neutral card a side shows. */
  factions?: Record<PlayerId, Faction>;
}

type Status = UnitSnapshot["statuses"][number];

/** Per-unit state the snapshot doesn't carry, kept from the events. */
interface Tracked {
  statuses: Status[];
  turnBuff: { attack: number; health: number };
  armTurn?: number;
  attacked: boolean;
}

/** Every token a card in the registry can summon, as the engine builds its
 * card (effects/resolver.ts summonTokens: same id, Common, cost 0). */
const TOKENS = new Map<string, Card>();

/** A card by registry id, a token by its token id, or null (a signature card). */
function cardOf(cardId: string): Card | null {
  return CARD_REGISTRY.get(cardId) ?? TOKENS.get(cardId) ?? null;
}

const BY_NAME = new Map<string, Card>();
for (const c of CARD_REGISTRY.values()) if (!BY_NAME.has(c.name)) BY_NAME.set(c.name, c);

type Spec = NonNullable<ReturnType<typeof allAbilities>[number]["effects"]>[number];
function specsOf(card: Card): Spec[] {
  const out: Spec[] = [];
  const walk = (list: readonly Spec[] | undefined) => {
    for (const s of list ?? []) {
      out.push(s);
      if (s.kind === "conditional") {
        walk(s.then);
        walk(s.else);
      }
    }
  };
  for (const a of allAbilities(card)) walk(a.effects);
  return out;
}

/** The one duration `card`'s abilities give `status`, or undefined. */
function statusDuration(card: Card | null, status: string): Status["duration"] | undefined {
  if (!card) return undefined;
  const found = new Set(specsOf(card).flatMap((s) => (s.kind === "applyStatus" && s.status === status ? [JSON.stringify(s.duration)] : [])));
  return found.size === 1 ? (JSON.parse([...found][0]!) as Status["duration"]) : undefined;
}

/** "turn" or "permanent" when `card`'s abilities buff by exactly this much one way only. */
function buffDuration(card: Card | null, attack: number, health: number): "turn" | "permanent" | undefined {
  if (!card) return undefined;
  const found = new Set(specsOf(card).flatMap((s) => (s.kind === "buff" && s.attack === attack && s.health === health ? [s.duration] : [])));
  return found.size === 1 ? [...found][0] : undefined;
}

for (const c of CARD_REGISTRY.values()) {
  for (const spec of specsOf(c)) {
    if (spec.kind !== "summon") continue;
    const t = spec.token;
    const id = `token-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (TOKENS.has(id)) continue;
    TOKENS.set(id, { id, name: t.name, faction: t.faction, rarity: "Common", cost: 0, type: "Unit", art: t.art, flavor: t.flavor, abilities: [], attack: t.attack, health: t.health, keywords: t.keywords } as Card);
  }
}
for (const t of TOKENS.values()) if (!BY_NAME.has(t.name)) BY_NAME.set(t.name, t);

function hiddenCard(): CardRef {
  return { cardId: "", name: "", faction: "Neutral", rarity: "Common", type: "Unit", cost: 0, flavor: "", visualSeed: 0, visualPattern: 0, hidden: true };
}

/** One hand position: a card id once the feed has named the card, else null (a back). */
type HandSlot = string | null;

export class LiveFrameBuilder {
  readonly matchId: string;
  /** Each hand in the engine's order (render session 53). */
  private readonly hands: Record<PlayerId, HandSlot[]> = { p1: [], p2: [] };
  /** A hand whose rebuilt count ever disagreed with the snapshot's: backs from then on. */
  readonly handLost: Record<PlayerId, boolean> = { p1: false, p2: false };
  /** A modal card's chosen mode, by board instance (from `play` and `evolve`). */
  private readonly modeOf = new Map<string, string>();
  private readonly start: LiveStart;
  private readonly frames: Frame[] = [];
  private readonly tracked = new Map<string, Tracked>();
  private stack: StackItemSnapshot[] = [];
  private readonly faction: Record<PlayerId, Faction> = { p1: "Neutral", p2: "Neutral" };
  /** Durations the source card didn't settle (kept for the tests and the notes). */
  readonly unknown: { kind: "status" | "buff"; source: string; detail: string }[] = [];
  private turn: number;
  private lastSnap: PublicSnapshot;

  constructor(start: LiveStart) {
    this.matchId = start.matchId;
    this.start = start;
    this.turn = start.start.turn;
    this.lastSnap = start.start;
    for (const pid of PIDS) for (const u of start.start[pid].board) this.track(u.instanceId);
    for (const pid of PIDS) if (start.factions?.[pid]) this.faction[pid] = start.factions[pid];
    for (const pid of PIDS) {
      const given = start.openingHands?.[pid];
      this.hands[pid] = given && given.length === start.start[pid].hand ? given.map((id) => (cardOf(id) ? id : null)) : Array.from({ length: start.start[pid].hand }, () => null);
    }
    this.frames.push(this.frame(0, start.start, openingEvents(start)));
  }

  /** Moves turned into frames so far (frame 0 is the board before the first). */
  get released(): number {
    return this.frames.length - 1;
  }

  private track(iid: string): Tracked {
    let t = this.tracked.get(iid);
    if (!t) {
      t = { statuses: [], turnBuff: { attack: 0, health: 0 }, attacked: false };
      this.tracked.set(iid, t);
    }
    return t;
  }

  private unitCard(iid: string, snap: PublicSnapshot): Card | null {
    for (const pid of PIDS) {
      const u = snap[pid].board.find((x) => x.instanceId === iid);
      if (u) return cardOf(u.cardId);
      const d = snap[pid].directives.find((x) => x.instanceId === iid);
      if (d) return cardOf(d.cardId);
    }
    return null;
  }

  /** The card an event's source names: a board instance (before or after the move), else by name. */
  private sourceCard(sourceId: string | undefined, source: string, before: PublicSnapshot, after: PublicSnapshot): Card | null {
    if (sourceId) {
      const c = this.unitCard(sourceId, before) ?? this.unitCard(sourceId, after);
      if (c) return c;
    }
    return BY_NAME.get(source) ?? null;
  }

  /** Adds the next released step; returns its frame. */
  push(step: TimelineStep): Frame {
    if (step.n !== this.frames.length) throw new Error(`the live feed sent move ${step.n}, the board is at move ${this.frames.length - 1}`);
    const before = this.lastSnap;
    const after = step.after;
    // The engine takes the played card out of the hand first (playCard's
    // splice), then everything the move causes follows, draws included.
    if (step.move.type === "playCard" && !this.handLost[step.by]) {
      const hand = this.hands[step.by];
      if (step.move.handIndex >= 0 && step.move.handIndex < hand.length) hand.splice(step.move.handIndex, 1);
      else this.loseHand(step.by);
    }
    for (const ev of step.events) this.apply(ev, before, after);
    for (const pid of PIDS) if (!this.handLost[pid] && this.hands[pid].length !== after[pid].hand) this.loseHand(pid);
    this.turn = after.turn;
    this.lastSnap = after;
    const frame = this.frame(step.n, after, step.events);
    this.frames.push(frame);
    return frame;
  }

  private loseHand(pid: PlayerId): void {
    this.handLost[pid] = true;
    this.hands[pid] = [];
  }

  private apply(ev: GameEvent, before: PublicSnapshot, after: PublicSnapshot): void {
    switch (ev.type) {
      case "draw": {
        if (this.handLost[ev.player]) break;
        const card = BY_NAME.get(ev.card);
        this.hands[ev.player].push(card && CARD_REGISTRY.has(card.id) ? card.id : null);
        break;
      }
      case "turnStart":
        this.turn = ev.turn;
        // The engine clears "has attacked" for the player whose turn begins.
        for (const pid of PIDS) if (pid === ev.player) for (const u of [...before[pid].board, ...after[pid].board]) this.track(u.instanceId).attacked = false;
        break;
      case "turnEnd":
        // End of turn: the turn's buffs wear off for every unit; the ending
        // player's units count their statuses down.
        for (const t of this.tracked.values()) t.turnBuff = { attack: 0, health: 0 };
        for (const u of before[ev.player].board) {
          const t = this.track(u.instanceId);
          t.statuses = t.statuses.map((s) => (typeof s.duration === "number" ? { ...s, duration: s.duration - 1 } : s)).filter((s) => s.duration !== 0);
        }
        break;
      case "play":
      case "summon": {
        if (!ev.instanceId) break;
        const t = this.track(ev.instanceId);
        const unit = after.p1.board.concat(after.p2.board).find((u) => u.instanceId === ev.instanceId);
        const card = unit ? cardOf(unit.cardId) : null;
        if (card && card.type === "Unit" && card.keywords.includes("Barrier") && !t.statuses.some((s) => s.kind === "Barrier")) t.statuses.push({ kind: "Barrier", duration: "untilConsumed" });
        if (ev.type === "play") {
          this.reveal(ev.player, card ?? BY_NAME.get(ev.card) ?? null);
          if (ev.mode !== undefined) this.modeOf.set(ev.instanceId, ev.mode);
        }
        break;
      }
      case "cast": {
        this.reveal(ev.player, ev.sourceId ? null : (BY_NAME.get(ev.card) ?? null));
        if (!ev.stackId) break;
        const item: StackItemSnapshot = ev.sourceId
          ? { kind: "ability", stackId: ev.stackId, description: ev.card, controller: ev.player, sourceInstanceId: ev.sourceId }
          : { kind: "command", stackId: ev.stackId, description: ev.card, controller: ev.player };
        this.stack.push(item);
        break;
      }
      case "attack": {
        if (ev.attackerId) this.track(ev.attackerId).attacked = true;
        if (!ev.stackId || !ev.attackerId || !ev.defenderRef) break;
        const controller = PIDS.find((pid) => before[pid].board.some((u) => u.instanceId === ev.attackerId)) ?? "p1";
        const target = ev.defenderRef.kind === "unit" ? { kind: "unit" as const, instanceId: ev.defenderRef.instanceId } : ev.defenderRef.kind === "player" ? { kind: "player" as const, playerId: ev.defenderRef.playerId } : undefined;
        this.stack.push({ kind: "combatDamage", stackId: ev.stackId, description: `${ev.attacker}'s attack`, controller, attackerInstanceId: ev.attackerId, ...(target ? { target } : {}) });
        break;
      }
      case "attackRedirected": {
        const item = [...this.stack].reverse().find((s) => s.kind === "combatDamage" && (!ev.attackerId || s.attackerInstanceId === ev.attackerId));
        if (item && ev.toRef) item.target = ev.toRef.kind === "unit" ? { kind: "unit", instanceId: ev.toRef.instanceId } : ev.toRef.kind === "player" ? { kind: "player", playerId: ev.toRef.playerId } : item.target;
        break;
      }
      case "stackResolve":
        this.stack = this.stack.filter((s) => s.stackId !== ev.stackId);
        break;
      case "toolAttached": {
        const tool = BY_NAME.get(ev.tool);
        if (ev.unitId && tool && tool.type === "Tool" && tool.grantedKeywords.includes("Barrier")) {
          const t = this.track(ev.unitId);
          if (!t.statuses.some((s) => s.kind === "Barrier")) t.statuses.push({ kind: "Barrier", duration: "untilConsumed" });
        }
        this.reveal(ev.player, tool ?? null);
        break;
      }
      case "barrierAbsorbed":
        if (ev.unitId) {
          const t = this.track(ev.unitId);
          const k = t.statuses.findIndex((s) => s.kind === "Barrier");
          if (k >= 0) t.statuses.splice(k, 1);
        }
        break;
      case "statusApplied": {
        if (!ev.targetId) break;
        const duration = ev.status === "Barrier" ? "untilConsumed" : statusDuration(this.sourceCard(ev.sourceId, ev.source, before, after), ev.status);
        if (duration === undefined) {
          this.unknown.push({ kind: "status", source: ev.source, detail: ev.status });
          break;
        }
        this.track(ev.targetId).statuses.push({ kind: ev.status, duration });
        break;
      }
      case "buff": {
        if (!ev.targetId) break;
        const d = buffDuration(this.sourceCard(ev.sourceId, ev.source, before, after), ev.attack, ev.health);
        if (d === undefined) this.unknown.push({ kind: "buff", source: ev.source, detail: `${ev.attack}/${ev.health}` });
        if (d === "turn") {
          const t = this.track(ev.targetId);
          t.turnBuff = { attack: t.turnBuff.attack + ev.attack, health: t.turnBuff.health + ev.health };
        }
        break;
      }
      case "telegraphPlaced":
        // The engine's computeArmTurn: the controller's own turns, two engine turns each.
        if (ev.instanceId) this.track(ev.instanceId).armTurn = this.turn + 2 * ev.armIn;
        break;
      case "evolve": {
        this.reveal(ev.player, BY_NAME.get(ev.to) ?? null);
        if (ev.instanceId) {
          if (ev.mode !== undefined) this.modeOf.set(ev.instanceId, ev.mode);
          else this.modeOf.delete(ev.instanceId);
        }
        break;
      }
      default:
        break;
    }
  }

  /** The deck's faction: the first non-Neutral card a side shows. */
  private reveal(pid: PlayerId, card: Card | null): void {
    if (this.faction[pid] === "Neutral" && card && card.faction !== "Neutral") this.faction[pid] = card.faction;
  }

  private unit(pid: PlayerId, u: PublicSide["board"][number], signatureName: string | null): UnitSnapshot {
    const card = cardOf(u.cardId);
    const t = this.track(u.instanceId);
    const tools = u.tools.map((name) => {
      const tc = BY_NAME.get(name);
      const tool = tc && tc.type === "Tool" ? (tc as ToolCard) : null;
      return { name, attackBonus: tool?.attackBonus ?? 0, healthBonus: tool?.healthBonus ?? 0, grantedKeywords: tool ? [...tool.grantedKeywords] : [] };
    });
    const printed = card && card.type === "Unit" ? card : null;
    const isSignature = !card && signatureName !== null && u.name === signatureName;
    const keywords = KEYWORDS.filter((k) => (printed?.keywords.includes(k) ?? false) || tools.some((x) => x.grantedKeywords.includes(k)));
    return {
      instanceId: u.instanceId,
      cardId: u.cardId,
      name: u.name,
      // Every signature card is a Neutral Mythic (engine signatureMenu.ts
      // builds them so); another card the registry lacks shows as Neutral.
      faction: card?.faction ?? "Neutral",
      rarity: (card?.rarity ?? (isSignature ? "Mythic" : "Common")) as Rarity,
      flavor: card?.flavor ?? "",
      attack: u.attack,
      health: Math.max(0, u.health),
      maxHealth: u.maxHealth,
      keywords,
      pending: u.pending,
      // Kept after it arms, as the engine keeps it (the page shows it only while pending).
      ...(t.armTurn !== undefined ? { armTurn: t.armTurn } : {}),
      isEvolved: printed?.evolvesFrom !== undefined,
      canAttackThisTurn: !u.pending && !t.attacked,
      baseArmor: printed?.baseArmor ?? 0,
      barrierActive: t.statuses.some((s) => s.kind === "Barrier"),
      printedAttack: printed?.attack ?? u.attack,
      printedHealth: printed?.health ?? u.maxHealth,
      printedCost: card?.cost ?? 0,
      turnBuff: { ...t.turnBuff },
      tools,
      statuses: t.statuses.map((s) => ({ ...s })),
      visualSeed: visualSeedFor(u.cardId),
      visualPattern: visualPatternFor(u.cardId),
      ...(isSignature ? { isSignature: true as const } : {}),
    };
  }

  /** The abilities in play on `owner`'s side that can change a cost: every
   * active (not dormant) unit's and every Directive's, a modal card's mode
   * included. `unsure` when one of them is a card the registry lacks (a
   * signature unit: its abilities aren't public). */
  private costSources(snap: PublicSnapshot, owner: PlayerId): { abilities: Card["abilities"]; unsure: boolean } {
    const out: Card["abilities"][number][] = [];
    let unsure = false;
    const add = (iid: string, cardId: string) => {
      const card = cardOf(cardId);
      if (!card) {
        unsure = true;
        return;
      }
      out.push(...card.abilities);
      const mode = this.modeOf.get(iid);
      const m = mode === undefined ? undefined : card.modes?.find((x) => x.id === mode);
      if (m) out.push(...m.abilities);
    };
    for (const u of snap[owner].board) if (!u.pending) add(u.instanceId, u.cardId);
    for (const d of snap[owner].directives) add(d.instanceId, d.cardId);
    return { abilities: out, unsure };
  }

  /** The engine's effectiveCardCost, read off the public board. */
  private costOf(snap: PublicSnapshot, pid: PlayerId, card: Card): { cost: number; unsure: boolean } {
    let modifier = 0;
    let unsure = false;
    for (const owner of PIDS) {
      const src = this.costSources(snap, owner);
      unsure ||= src.unsure;
      for (const ability of src.abilities) {
        if (ability.trigger !== "static" || ability.staticEffect?.kind !== "cardCostModifier") continue;
        const se = ability.staticEffect;
        if (se.cardType && se.cardType !== card.type) continue;
        const applies = se.side === "any" || (se.side === "controller" ? owner === pid : owner !== pid);
        if (applies) modifier += se.amount;
      }
    }
    return { cost: Math.max(0, card.cost + modifier), unsure };
  }

  private handRefs(pid: PlayerId, snap: PublicSnapshot, count: number): CardRef[] {
    if (this.handLost[pid]) return Array.from({ length: count }, hiddenCard);
    return this.hands[pid].map((id) => {
      const card = id ? cardOf(id) : null;
      if (!card) return hiddenCard();
      const { cost, unsure } = this.costOf(snap, pid, card);
      return {
        cardId: card.id,
        name: card.name,
        faction: card.faction,
        rarity: card.rarity,
        type: card.type,
        cost,
        flavor: card.flavor,
        visualSeed: visualSeedFor(card.id),
        visualPattern: visualPatternFor(card.id),
        ...(unsure ? { costUnsure: true as const } : {}),
      };
    });
  }

  private side(pid: PlayerId, s: PublicSide, slotsMax: number, snap: PublicSnapshot): PlayerSnapshot {
    const directives: DirectiveSnapshot[] = s.directives.map((d) => {
      const card = cardOf(d.cardId);
      return {
        instanceId: d.instanceId,
        cardId: d.cardId,
        name: d.name,
        faction: card?.faction ?? this.faction[pid],
        rarity: card?.rarity ?? "Common",
        flavor: card?.flavor ?? "",
        printedCost: card?.cost ?? 0,
        visualSeed: visualSeedFor(d.cardId),
        visualPattern: visualPatternFor(d.cardId),
      };
    });
    return {
      id: pid,
      name: s.name,
      faction: this.faction[pid],
      health: Math.max(0, s.health),
      maxHealth: s.maxHealth,
      energy: s.energy,
      maxEnergy: s.maxEnergy,
      hand: this.handRefs(pid, snap, s.hand),
      deckSize: s.deck,
      graveyardSize: s.graveyard,
      board: s.board.map((u) => this.unit(pid, u, s.signature?.name ?? null)),
      directives,
      slotsUsed: s.board.length + s.directives.length,
      slotsMax,
      signature: null,
    };
  }

  private frame(index: number, snap: PublicSnapshot, events: GameEvent[]): Frame {
    for (const pid of PIDS) for (const u of snap[pid].board) this.reveal(pid, cardOf(u.cardId));
    for (const pid of PIDS) for (const d of snap[pid].directives) this.reveal(pid, cardOf(d.cardId));
    const players = { p1: this.side("p1", snap.p1, this.start.boardSlots, snap), p2: this.side("p2", snap.p2, this.start.boardSlots, snap) };
    // Statuses and buffs of units that left the board are no longer anyone's.
    const onBoard = new Set(PIDS.flatMap((pid) => snap[pid].board.map((u) => u.instanceId)));
    for (const iid of [...this.tracked.keys()]) if (!onBoard.has(iid)) this.tracked.delete(iid);
    return {
      index,
      turnNumber: snap.turn,
      activePlayer: snap.activePlayer,
      priority: snap.priority,
      ...(snap.winner ? { winner: snap.winner } : {}),
      stack: this.stack.map((s) => ({ ...s, ...(s.target ? { target: { ...s.target } } : {}) })),
      players,
      newEvents: events.map((event) => ({ event, text: formatEvent(event) })),
      momentum: computeMomentum(players.p1, players.p2, snap.winner),
    };
  }

  /** Every frame so far, with the fixed slots and the spectator feed (both
   * worked out from the first frame on, so a frame never changes once given). */
  allFrames(): Frame[] {
    const frames = assignSlots(this.frames.map((f) => ({ ...f, players: { p1: { ...f.players.p1 }, p2: { ...f.players.p2 } } })));
    const feed = buildFeedWithQuiet(frames, { names: this.start.names, abilityText: abilityTextFor([]) });
    return frames.map((frame, i) => ({ ...frame, feed: feed.entries[i]!, quietTriggers: feed.quiet[i]! }));
  }

  /** Frames from index `from` on. */
  framesFrom(from: number): Frame[] {
    return this.allFrames().slice(from);
  }

  /** The arena's replay object for everything released so far. */
  replay(): MatchReplay {
    const cardFactions: Record<string, Faction> = {};
    const cardRarities: Record<string, Rarity> = {};
    for (const c of CARD_REGISTRY.values()) {
      cardFactions[c.name] ??= c.faction;
      cardRarities[c.name] ??= c.rarity;
    }
    const frames = this.allFrames();
    for (const f of frames) for (const pid of PIDS) for (const u of f.players[pid].board) {
      cardFactions[u.name] ??= u.faction;
      cardRarities[u.name] ??= u.rarity;
    }
    const names = this.start.names;
    return {
      title: `${names.p1} vs ${names.p2}`,
      seed: seedOf(this.matchId),
      agentNames: { ...names },
      identities: { p1: { username: names.p1, avatarSvg: avatarSvg(names.p1) }, p2: { username: names.p2, avatarSvg: avatarSvg(names.p2) } },
      cardFactions,
      cardRarities,
      factions: { ...this.faction },
      movesPlayed: this.released,
      turnCap: this.start.turnCap,
      energyCap: this.start.energyCap,
      frames,
    };
  }
}

/** The events before the first move. The engine logs one there (capture.ts
 * and match.ts both begin turn 1 for p1 without a draw: its turnStart);
 * the feed sends it as a line only, so it is rebuilt and checked against
 * that line, and left out if the engine ever logs something else there. */
function openingEvents(start: LiveStart): GameEvent[] {
  const ev: GameEvent = { type: "turnStart", turn: start.start.turn, player: start.start.activePlayer };
  return start.startLines.length === 1 && start.startLines[0] === formatEvent(ev) ? [ev] : [];
}

/** A stable number from the match id: the arena seeds its Match Boot saying
 * and its boast's look with it. The live feed doesn't send the engine's seed
 * (it would let anyone replay the shuffle), and a saying only needs to be the
 * same for every viewer of this match. */
export function seedOf(matchId: string): number {
  let h = 2166136261;
  for (let i = 0; i < matchId.length; i++) {
    h ^= matchId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
