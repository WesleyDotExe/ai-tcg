// Fixed-slot board layout (owner feedback 2026-09-27, item 3).
//
// The engine keeps each player's board as two packed arrays (units, then
// directives) and has no notion of a card's position: no mechanic reads
// board order (nothing is "adjacent" or "leftmost"). The render used to lay
// those arrays out left to right, so whenever a card left, every card to its
// right slid one slot over. That broke three things a spectator relies on:
// a dying card's ghost stood in its old spot while the next card slid into
// that same spot underneath it; a unit a viewer was tracking jumped sideways
// for no in-game reason; and an aim line drawn to a card on one move pointed
// at a different card's spot on the next.
//
// Here every board card is given a slot when it enters and keeps it until it
// leaves. The assignment is computed once, over the whole match, in Node, and
// written into each frame (`PlayerSnapshot.slots`), so every navigation path
// in the page (step, play, scrub, jump) shows the same layout for a given
// move.
//
// Rules, in order:
// 1. A card already on the board keeps its slot (an evolution keeps the same
//    instance, so it keeps its slot too).
// 2. Units fill from the left; Directives fill from the right. Standing
//    effects then sit apart from the fighters instead of interleaving with
//    them, and a new unit never lands between two directives.
// 3. A card entering on the same move another card left does not take the
//    slot that just emptied if any other slot is free. That spot is where
//    the leaving card's ghost is still fading out; putting a new card under
//    it is the exact overlap this module exists to remove.
// 4. If rule 3 leaves nowhere to go (the board was full and one card
//    replaced another in the same move), the freshly emptied slot is used.
//    The engine's slot cap guarantees rule 4 always finds room.

import type { PlayerId } from "@ai-tcg/engine";
import type { Frame } from "./types.js";

type Kind = "unit" | "dir";

function pickSlot(slots: (string | null)[], vacated: Set<number>, kind: Kind): number {
  const order = slots.map((_, i) => i);
  if (kind === "dir") order.reverse();
  const clean = order.find((i) => slots[i] === null && !vacated.has(i));
  if (clean !== undefined) return clean;
  const any = order.find((i) => slots[i] === null);
  if (any !== undefined) return any;
  throw new Error("slotLayout: no free slot for an entering card. The board is over the engine's slot cap.");
}

/** Assigns each board card a fixed slot and writes the result into every
 * frame's `players[pid].slots` (length `slotsMax`, instanceId or null).
 * Mutates the frames in place and returns them. */
export function assignSlots(frames: Frame[]): Frame[] {
  for (const pid of ["p1", "p2"] as PlayerId[]) {
    let prev: (string | null)[] = [];
    for (const frame of frames) {
      const snap = frame.players[pid];
      const occupants: { iid: string; kind: Kind }[] = [
        ...snap.board.map((u) => ({ iid: u.instanceId, kind: "unit" as const })),
        ...snap.directives.map((d) => ({ iid: d.instanceId, kind: "dir" as const })),
      ];
      const present = new Set(occupants.map((o) => o.iid));
      const slots: (string | null)[] = Array.from({ length: snap.slotsMax }, (_, i) => prev[i] ?? null);
      const vacated = new Set<number>();
      slots.forEach((iid, i) => {
        if (iid !== null && !present.has(iid)) {
          slots[i] = null;
          vacated.add(i);
        }
      });
      const placed = new Set(slots.filter((s): s is string => s !== null));
      for (const o of occupants) {
        if (placed.has(o.iid)) continue;
        slots[pickSlot(slots, vacated, o.kind)] = o.iid;
        placed.add(o.iid);
      }
      snap.slots = slots;
      prev = slots;
    }
  }
  return frames;
}
