// Season 1 arena prototype (owner 2026-11-14): the pure half. No DOM, no
// three.js: the 3D page (arenaClient.ts) draws what this file says, and the
// tests read it directly. Fenced off in render/season1/ (owner 2026-11-14):
// nothing outside this folder imports it. It reads Season 0's replay shape
// (render/src/types.ts MatchReplay) as a fixed upstream and never changes it.
//
// Spec: progress/season-1-ideas.md, "the Season 1 arena redesign (true 3D)",
// build-order step 1 (the new layout). World units: the arena is a disc of
// radius ARENA_RADIUS centred on the origin, y up. Seat p1 sits on the +z
// side, seat p2 on the -z side, always; "Watch as" moves the camera to the
// other seat rather than moving the cards, so a card keeps its place when
// the view flips (the owner's modification 3: cards face their owner, as on
// a real table, and the whole view flips).
import type { CardRef, Frame, MatchReplay, PlayerSnapshot, UnitSnapshot, DirectiveSnapshot, SignatureSnapshot } from "../../src/types.js";

export type Seat = "p1" | "p2";
export const SEATS: readonly Seat[] = ["p1", "p2"];
export const otherSeat = (s: Seat): Seat => (s === "p1" ? "p2" : "p1");

/** The raised round platform's top radius (the playmat circle). */
export const ARENA_RADIUS = 5.95;
/** A board card's footprint on the table. */
export const CARD_W = 1.15;
export const CARD_H = 1.6;
/** How far a unit row sits from the centre line. */
export const ROW_Z = 1.25;
/** Directives sit behind their side's units, smaller. */
export const DIRECTIVE_Z = 2.85;
export const DIRECTIVE_SCALE = 0.62;
/** The signature zone, on each side's right as its owner sees it. */
export const SIG_X = 4.55;
/** Draw pile and discard, on each side's left as its owner sees it. */
export const PILE_X = -4.5;
export const DECK_Z = 1.0;
export const DISCARD_Z = 2.5;
export const DISCARD_SCALE = 0.8;
/** The far side's held hand: up off the table behind its directives. */
export const HELD_Z = 4.15;
export const HELD_Y = 1.25;
/** Widest a unit row may be (centre to centre of its outer slots). */
const ROW_SPAN = 6.4;
const SLOT_GAP = 0.13;

/** +1 for the seat on the +z side (p1), -1 for p2. */
export const seatSign = (s: Seat): 1 | -1 => (s === "p1" ? 1 : -1);
/** A card at rest faces its owner's seat: yaw 0 reads upright from +z. */
export const restYaw = (s: Seat): number => (s === "p1" ? 0 : Math.PI);
/** The yaw that reads upright from the viewer's seat (the POV). */
export const viewerYaw = (pov: Seat): number => restYaw(pov);

export interface Vec3 { x: number; y: number; z: number }

/** The x of slot i of n, as its owner sees the row from their seat (slot 0 on
 * the owner's left). n slots share ROW_SPAN, never closer than a card and a
 * gap; past that they shrink (scale < 1) to keep the row on the disc. */
export function slotPlace(seat: Seat, i: number, n: number): { pos: Vec3; scale: number } {
  const s = seatSign(seat);
  const natural = CARD_W + SLOT_GAP;
  const pitch = n <= 1 ? 0 : Math.min(natural, ROW_SPAN / (n - 1));
  const scale = n <= 1 ? 1 : Math.min(1, pitch / natural);
  // The owner's left: p1 looks towards -z, so their left is -x; p2 looks
  // towards +z, so their left is +x.
  const x = (i - (n - 1) / 2) * pitch * s;
  return { pos: { x, y: 0.03, z: s * ROW_Z }, scale };
}

export function directivePlace(seat: Seat, i: number, n: number): { pos: Vec3; scale: number } {
  const s = seatSign(seat);
  const pitch = CARD_W * DIRECTIVE_SCALE + 0.14;
  const room = 4.4; // stays between the piles' column and the signature zone
  const p = n <= 1 ? 0 : Math.min(pitch, room / (n - 1));
  const scale = DIRECTIVE_SCALE * (n <= 1 ? 1 : Math.min(1, p / pitch));
  return { pos: { x: (i - (n - 1) / 2) * p * s, y: 0.03, z: s * DIRECTIVE_Z }, scale };
}

export const sigPlace = (seat: Seat): Vec3 => ({ x: SIG_X * seatSign(seat), y: 0.03, z: seatSign(seat) * ROW_Z });
export const deckPlace = (seat: Seat): Vec3 => ({ x: PILE_X * seatSign(seat), y: 0.02, z: seatSign(seat) * DECK_Z });
export const discardPlace = (seat: Seat): Vec3 => ({ x: PILE_X * seatSign(seat), y: 0.02, z: seatSign(seat) * DISCARD_Z });

/** The far side's held hand: card k of n, held up and fanned, backs to the
 * viewer. Its rotation tips the card back towards its holder; the page adds a
 * slow bob. */
export function heldPlace(seat: Seat, k: number, n: number): { pos: Vec3; tilt: number; yaw: number } {
  const s = seatSign(seat);
  const off = k - (n - 1) / 2;
  const spread = Math.min(0.55, 3.6 / Math.max(1, n - 1));
  return {
    pos: { x: off * spread * s, y: HELD_Y - Math.abs(off) * 0.05, z: s * (HELD_Z + Math.abs(off) * 0.04) },
    tilt: s * (Math.PI / 2 - 0.32),
    yaw: -off * 0.12 * s,
  };
}

/** The four corners of a card footprint (scale applied), for the fits-on-
 * the-disc test. */
export function footprint(pos: Vec3, scale = 1): { x: number; z: number }[] {
  const w = (CARD_W * scale) / 2, h = (CARD_H * scale) / 2;
  return [
    { x: pos.x - w, z: pos.z - h },
    { x: pos.x + w, z: pos.z - h },
    { x: pos.x - w, z: pos.z + h },
    { x: pos.x + w, z: pos.z + h },
  ];
}

// ---------------------------------------------------------------------------
// What a card shows

/** Everything a card face (and the hover/tap reader) needs, from whichever
 * snapshot it came from. Rules text comes from the page's cardText table
 * (the engine's own Ability.text, gathered at build time). */
export interface CardFace {
  cardId: string;
  name: string;
  faction: string;
  rarity: string;
  type: string;
  cost: number;
  flavor: string;
  attack?: number;
  health?: number;
  maxHealth?: number;
  printedAttack?: number;
  printedHealth?: number;
  keywords: string[];
  /** Short state words for the reader: "Barrier up", "Arming (turn 6)",
   * "Evolved", a tool's name, a status. */
  state: string[];
  signature?: true;
}

export function unitFace(u: UnitSnapshot): CardFace {
  const state: string[] = [];
  if (u.barrierActive) state.push("Barrier up");
  if (u.pending) state.push(u.armTurn !== undefined ? `Arming (turn ${u.armTurn})` : "Arming");
  if (u.isEvolved) state.push("Evolved");
  if (u.baseArmor > 0) state.push(`Armor ${u.baseArmor}`);
  for (const t of u.tools) state.push(`Tool: ${t.name}`);
  for (const st of u.statuses) if (st.kind !== "Barrier") state.push(st.duration === "untilConsumed" ? st.kind : `${st.kind} (${st.duration})`);
  return {
    cardId: u.cardId,
    name: u.name,
    faction: u.faction,
    rarity: u.rarity,
    type: "Unit",
    cost: u.printedCost,
    flavor: u.flavor,
    attack: u.attack,
    health: u.health,
    maxHealth: u.maxHealth,
    printedAttack: u.printedAttack,
    printedHealth: u.printedHealth,
    keywords: [...u.keywords],
    state,
    ...(u.isSignature ? { signature: true as const } : {}),
  };
}

export function directiveFace(d: DirectiveSnapshot): CardFace {
  return { cardId: d.cardId, name: d.name, faction: d.faction, rarity: d.rarity, type: "Directive", cost: d.printedCost, flavor: d.flavor, keywords: [], state: [] };
}

export function signatureFace(sig: SignatureSnapshot): CardFace {
  return {
    cardId: sig.cardId,
    name: sig.name,
    faction: sig.faction,
    rarity: sig.rarity,
    type: "Unit",
    cost: sig.nextCost,
    flavor: sig.flavor,
    attack: sig.attack,
    health: sig.health,
    maxHealth: sig.health,
    printedAttack: sig.attack,
    printedHealth: sig.health,
    keywords: [...sig.keywords],
    state: sig.timesPlayed > 0 ? [`Played ${sig.timesPlayed}x · now costs ${sig.nextCost} (base ${sig.baseCost})`] : [],
    signature: true,
  };
}

export function handFace(c: CardRef): CardFace | null {
  if (c.hidden) return null;
  return { cardId: c.cardId, name: c.name, faction: c.faction, rarity: c.rarity, type: c.type, cost: c.cost, flavor: c.flavor, keywords: [], state: c.costUnsure ? ["Cost may change"] : [] };
}

/** The placeholder art's rings for a card, seeded by its id (the same card
 * always draws the same). Unsigned shifts: a signed shift of a seed past 2^31
 * once gave a negative radius, the canvas threw, and that match's table drew
 * empty (render session 79's browser check). */
export function artRings(cardId: string): { r: number; dx: number }[] {
  let seed = 0;
  for (const ch of cardId) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: 7 }, (_, k) => ({ r: 14 + ((seed >>> k) % 9) * 10 + k * 6, dx: ((seed >>> (k + 3)) % 40) - 20 }));
}

// ---------------------------------------------------------------------------
// The scene at one frame

export type Zone = "slot" | "directive" | "signature";

/** One face-up card on the table. `key` is stable across frames for the same
 * card in the same place (a unit's instance id), so the page moves meshes
 * instead of rebuilding them. */
export interface TableCard {
  key: string;
  seat: Seat;
  zone: Zone;
  pos: Vec3;
  scale: number;
  /** Resting yaw: facing its owner. */
  yaw: number;
  face: CardFace;
  /** For a unit: its instance id (attacks and hits name it). */
  instanceId?: string;
}

export interface SceneModel {
  pov: Seat;
  table: TableCard[];
  /** The far side's held hand: how many backs, never which cards. Hidden
   * information stays hidden: the page gets a count and a back, no faces. */
  held: { seat: Seat; count: number };
  /** The near side's hand, fanned at the bottom edge as DOM cards. A null
   * face draws a card back (a hand the match doesn't show). */
  nearHand: { seat: Seat; cards: (CardFace | null)[] };
  piles: Record<Seat, { deck: number; discard: number }>;
  /** Each signature zone: the card waits there (face up, public), or it is
   * on the board (the zone shows its frame and "IN PLAY"), or none. */
  sigZone: Record<Seat, "waiting" | "in play" | "none">;
}

export function sceneAt(frame: Frame, pov: Seat): SceneModel {
  const table: TableCard[] = [];
  for (const seat of SEATS) {
    const p = frame.players[seat];
    const n = p.slotsMax;
    const slots = p.slots ?? Array.from({ length: n }, (_, i) => p.board[i]?.instanceId ?? null);
    const byId = new Map(p.board.map((u) => [u.instanceId, u] as const));
    slots.forEach((id, i) => {
      if (!id) return;
      const u = byId.get(id);
      if (!u) return;
      const { pos, scale } = slotPlace(seat, i, slots.length);
      table.push({ key: u.instanceId, seat, zone: "slot", pos, scale, yaw: restYaw(seat), face: unitFace(u), instanceId: u.instanceId });
    });
    p.directives.forEach((d, i) => {
      const { pos, scale } = directivePlace(seat, i, p.directives.length);
      table.push({ key: d.instanceId, seat, zone: "directive", pos, scale, yaw: restYaw(seat), face: directiveFace(d) });
    });
    if (p.signature?.inZone) {
      table.push({ key: `sig-${seat}`, seat, zone: "signature", pos: sigPlace(seat), scale: 1, yaw: restYaw(seat), face: signatureFace(p.signature) });
    }
  }
  const far = otherSeat(pov);
  return {
    pov,
    table,
    held: { seat: far, count: frame.players[far].hand.length },
    nearHand: { seat: pov, cards: frame.players[pov].hand.map(handFace) },
    piles: {
      p1: { deck: frame.players.p1.deckSize, discard: frame.players.p1.graveyardSize },
      p2: { deck: frame.players.p2.deckSize, discard: frame.players.p2.graveyardSize },
    },
    sigZone: {
      p1: sigState(frame.players.p1),
      p2: sigState(frame.players.p2),
    },
  };
}

function sigState(p: PlayerSnapshot): "waiting" | "in play" | "none" {
  if (!p.signature) return "none";
  return p.signature.inZone ? "waiting" : "in play";
}

// ---------------------------------------------------------------------------
// The HUDs: the far side's above the board, the POV's below it

export interface HudModel {
  seat: Seat;
  name: string;
  owner: string | null;
  faction: string;
  avatarSvg: string;
  avatarUrl: string | null;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  hand: number;
  deck: number;
  discard: number;
  /** "Ready · 6" (in the zone, its next cost), "In play", or null. */
  signature: string | null;
  coin: string;
  boast: string;
  active: boolean;
  hasPriority: boolean;
}

export interface Loadout { coin: string; boast: string; owner: string | null }

export function hudAt(replay: MatchReplay, frame: Frame, seat: Seat, loadout: Loadout): HudModel {
  const p = frame.players[seat];
  const id = replay.identities[seat];
  return {
    seat,
    name: replay.agentNames[seat],
    owner: loadout.owner,
    faction: replay.factions[seat],
    avatarSvg: id.avatarSvg,
    avatarUrl: id.avatarUrl ?? null,
    health: p.health,
    maxHealth: p.maxHealth,
    energy: p.energy,
    maxEnergy: p.maxEnergy,
    hand: p.hand.length,
    deck: p.deckSize,
    discard: p.graveyardSize,
    signature: p.signature ? (p.signature.inZone ? `Ready · ${p.signature.nextCost}` : "In play") : null,
    coin: loadout.coin,
    boast: loadout.boast,
    active: frame.activePlayer === seat,
    hasPriority: frame.priority === seat,
  };
}

// ---------------------------------------------------------------------------
// What moved between two frames (the motions the page plays)

export type Motion =
  /** A card arrived on the table: from its owner's hand (or, for a
   * signature card, from the signature zone). */
  | { kind: "enter"; key: string; seat: Seat; fromSignature: boolean }
  /** A card left the table (died, bounced, consumed). */
  | { kind: "leave"; key: string; seat: Seat }
  /** An attack was declared: the attacker travels at its target. */
  | { kind: "attack"; attacker: string; seat: Seat; target: { kind: "unit"; key: string } | { kind: "player"; seat: Seat } }
  /** A unit lost health and stayed on the table. */
  | { kind: "hurt"; key: string; seat: Seat; amount: number }
  /** A player lost health. */
  | { kind: "face"; seat: Seat; amount: number };

export function motionsBetween(prev: Frame | undefined, next: Frame): Motion[] {
  const out: Motion[] = [];
  if (!prev) return out;
  for (const seat of SEATS) {
    const a = prev.players[seat], b = next.players[seat];
    const before = new Map(a.board.map((u) => [u.instanceId, u] as const));
    const after = new Map(b.board.map((u) => [u.instanceId, u] as const));
    for (const [id, u] of after) if (!before.has(id)) out.push({ kind: "enter", key: id, seat, fromSignature: u.isSignature === true });
    for (const d of b.directives) if (!a.directives.some((x) => x.instanceId === d.instanceId)) out.push({ kind: "enter", key: d.instanceId, seat, fromSignature: false });
    for (const [id] of before) if (!after.has(id)) out.push({ kind: "leave", key: id, seat });
    for (const d of a.directives) if (!b.directives.some((x) => x.instanceId === d.instanceId)) out.push({ kind: "leave", key: d.instanceId, seat });
    for (const [id, u] of after) {
      const was = before.get(id);
      if (was && u.health < was.health) out.push({ kind: "hurt", key: id, seat, amount: was.health - u.health });
    }
    // A unit that died this move took a hit too: say how much it had left.
    if (b.health < a.health) out.push({ kind: "face", seat, amount: a.health - b.health });
  }
  const known = new Set(prev.stack.map((s) => s.stackId));
  for (const item of next.stack) {
    if (known.has(item.stackId) || item.kind !== "combatDamage" || !item.attackerInstanceId || !item.target) continue;
    const seat = item.controller as Seat;
    out.push({
      kind: "attack",
      attacker: item.attackerInstanceId,
      seat,
      target: item.target.kind === "unit" ? { kind: "unit", key: item.target.instanceId } : { kind: "player", seat: item.target.playerId as Seat },
    });
  }
  // Attacks first (they set up the hit), then arrivals, hits, departures.
  const order: Record<Motion["kind"], number> = { attack: 0, enter: 1, hurt: 2, face: 3, leave: 4 };
  return out.sort((x, y) => order[x.kind] - order[y.kind]);
}

// ---------------------------------------------------------------------------
// Playback: which frames are worth a beat

/** The frames the player stops on: the first, the last, and every frame
 * where something a viewer can see happened (a feed line, a motion, a new
 * turn). Priority passes that change nothing are skipped, as Season 0's
 * replay skips them. */
export function beatFrames(frames: Frame[]): number[] {
  const out: number[] = [];
  frames.forEach((f, i) => {
    if (i === 0 || i === frames.length - 1) return void out.push(i);
    const prev = frames[i - 1]!;
    if ((f.feed?.length ?? 0) > 0 || f.turnNumber !== prev.turnNumber || motionsBetween(prev, f).length > 0) out.push(i);
  });
  return out;
}

/** How long a beat holds, in ms at 1x: longer when more moves on screen. */
export function beatMs(prev: Frame | undefined, next: Frame): number {
  const m = motionsBetween(prev, next);
  let ms = 700;
  if (m.some((x) => x.kind === "attack")) ms += 700;
  if (m.some((x) => x.kind === "enter")) ms += 500;
  if (m.some((x) => x.kind === "leave")) ms += 300;
  if (next.winner) ms += 1500;
  return ms;
}

/** Who the page first watches as: the side its viewer owns, else p1 (Season
 * 0's rule: the higher-rated side, p1 on a tie or with no ratings; sample
 * replays carry none). */
export function initialPov(ownSeat: Seat | null): Seat {
  return ownSeat ?? "p1";
}
