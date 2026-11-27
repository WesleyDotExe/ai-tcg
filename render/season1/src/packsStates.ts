// The Packs tile in every state the owner API can put it in (render session
// 91, phase 2 "the tiles in groups", group 3, with Store). The Home snapshot
// holds Nova (11 packs waiting, pulls to show) and Wren (3 starter packs, no
// pulls yet), so the states between and beyond never reach the page: none
// waiting, one waiting, a long stack, a Full Art or a Mythic due in the very
// next pack.
//
// Each state is a snapshot owner's real answer with only `packs.unopened`,
// `packs.pity` and `collection.recentPulls` changed, in the API's own shape
// (server/OWNER_API.md, "Packs"; the pity counts against economy/src/config.ts
// `pity: { fullArtAfter: 10, mythicAfter: 40 }`).
//
// Pure: data in, an HTML string out. Fenced off: nothing outside
// render/season1/ imports it.

import { LIVE_PACK_ODDS } from "@ai-tcg/economy";
import type { HomeData, OwnerData } from "./homeFacts.js";
import { from, statesSheet, type StateCase } from "./statesSheet.js";

/** n waiting packs, copied from the owner's own first pack record. */
const waiting = (d: OwnerData, n: number) => {
  const one = (d.packs.unopened[0] ?? { setCode: "S0", source: "purchase", openedAt: null }) as Record<string, unknown>;
  d.packs.unopened = Array.from({ length: n }, (_, i) => ({ ...one, packId: `sheet-${i}` }));
};

export function packsStateCases(data: HomeData): StateCase[] {
  const nova = data.owners.nova!, wren = data.owners.wren!;
  const { fullArtAfter, mythicAfter } = LIVE_PACK_ODDS.pity;
  return [
    { id: "served", name: "11 waiting, pulls to show (Nova, as served)", data: nova },
    { id: "new", name: "3 starter packs, nothing opened yet (Wren, as served)", data: wren },
    { id: "none", name: "None waiting, pulls to show", data: from(nova, (d) => waiting(d, 0)) },
    { id: "one", name: "One waiting", data: from(nova, (d) => waiting(d, 1)) },
    { id: "stack", name: "A long stack: 128 waiting", data: from(nova, (d) => waiting(d, 128)) },
    { id: "due", name: "A Full Art and a Mythic both due in the next pack", data: from(nova, (d) => { d.packs.pity.packsSinceFullArt = fullArtAfter - 1; d.packs.pity.packsSinceMythic = mythicAfter - 1; }) },
    { id: "new-none", name: "A new player who opened their 3 (no match yet, none waiting)", data: from(wren, (d) => { d.collection.recentPulls = nova.collection.recentPulls.slice(0, 3); waiting(d, 0); d.packs.pity.packsSinceFullArt = 3; d.packs.pity.packsSinceMythic = 3; }) },
  ];
}

export function packsStatesPage(data: HomeData): string {
  return statesSheet({ tile: "packs", title: "Packs", session: 91, cases: packsStateCases(data), note: (c) => `${c.data.packs.unopened.length} waiting · ${c.data.collection.recentPulls.length} recent openings · ${c.data.packs.pity.packsSinceFullArt} since a Full Art` });
}
