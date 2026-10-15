// The signature zone on the board (render slice after EFFECTS.md v2).
//
// Every agent's signature card waits in its own zone, off the board, and
// can be played from there whenever its controller can afford it. When it
// dies it goes back to the zone, not the graveyard, and every replay that
// match costs 2 more (engine SignatureZone / signatureCost). Before this
// slice the board didn't show the zone at all: a signature card that died
// just left, and its replay came from nowhere.
//
// This module answers two questions from the captured snapshots alone
// (PlayerSnapshot.signature, UnitSnapshot.isSignature), never from event
// text:
//   signatureZoneMoves(prev, next) -> what crossed between the zone and the
//     board this move: `leave` (played from the zone; `iid` is the unit that
//     arrived) or `return` (died and went back; `iid` is the unit that
//     left). `bounce` covers a card played and returned inside one move, so
//     nothing is ever silently dropped.
//   signatureZoneView(player, isActive, energyCap) -> what the zone shows:
//     waiting or out on the board, the next cost and how far it has climbed,
//     how many plays so far, and whether it is within reach: `now` (its
//     owner's turn, enough energy in the pool) or `next` (the refill at the
//     start of its owner's next turn covers it). Principle 2: the threat of
//     a returning signature card should be visible before it lands.
//
// Same single-source pattern as attackFx.ts: SIG_ZONE_SOURCE is embedded in
// the page verbatim AND evaluated here for Node callers and tests.
import type { Frame, PlayerSnapshot } from "./types.js";
import type { PlayerId } from "@ai-tcg/engine";

export interface SignatureZoneMove {
  owner: PlayerId;
  kind: "leave" | "return" | "bounce";
  /** The signature unit on the board (arrived for `leave`, left for
   * `return`); null when no unit can be named (`bounce`). */
  iid: string | null;
  /** What the play cost (`leave`, `bounce`) or what the next play will
   * cost (`return`). */
  cost: number;
}

export interface SignatureZoneView {
  state: "waiting" | "out";
  nextCost: number;
  /** nextCost minus the printed cost: the replay surcharge so far (cost
   * modifiers on the board can also move it). */
  climb: number;
  timesPlayed: number;
  reach: "now" | "next" | null;
  /** "PR-001" when the card id is a signature id (sig-PR-001), else null. */
  collector: string | null;
}

export const SIG_ZONE_SOURCE = `
  function signatureZoneMoves(prev, next) {
    const out = [];
    ['p1', 'p2'].forEach(function (pid) {
      const a = prev.players[pid].signature, b = next.players[pid].signature;
      if (!a || !b) return;
      function sigUnit(frame) {
        const u = frame.players[pid].board.filter(function (x) { return x.isSignature; })[0];
        return u ? u.instanceId : null;
      }
      if (a.inZone && !b.inZone) out.push({ owner: pid, kind: 'leave', iid: sigUnit(next), cost: a.nextCost });
      else if (!a.inZone && b.inZone) out.push({ owner: pid, kind: 'return', iid: sigUnit(prev), cost: b.nextCost });
      else if (a.inZone && b.inZone && b.timesPlayed > a.timesPlayed) out.push({ owner: pid, kind: 'bounce', iid: null, cost: a.nextCost });
    });
    return out;
  }

  function signatureZoneView(p, isActive, energyCap) {
    const z = p.signature;
    if (!z) return null;
    // The pool its owner will have after the next refill (engine beginTurn:
    // maxEnergy + 1, capped). On its own turn the pool has already refilled,
    // so "now" reads the live energy.
    const refill = Math.min(p.maxEnergy + 1, energyCap);
    let reach = null;
    if (z.inZone) {
      if (isActive && p.energy >= z.nextCost) reach = 'now';
      else if (refill >= z.nextCost) reach = 'next';
    }
    const m = /^sig-(PR-[0-9]+)$/.exec(z.cardId);
    return {
      state: z.inZone ? 'waiting' : 'out',
      nextCost: z.nextCost,
      climb: z.nextCost - z.baseCost,
      timesPlayed: z.timesPlayed,
      reach: reach,
      collector: m ? m[1] : null,
    };
  }
`;

const impl = new Function(`${SIG_ZONE_SOURCE}; return { signatureZoneMoves: signatureZoneMoves, signatureZoneView: signatureZoneView };`)() as {
  signatureZoneMoves: (prev: Frame, next: Frame) => SignatureZoneMove[];
  signatureZoneView: (p: PlayerSnapshot, isActive: boolean, energyCap: number) => SignatureZoneView | null;
};

export const signatureZoneMoves = impl.signatureZoneMoves;
export const signatureZoneView = impl.signatureZoneView;
