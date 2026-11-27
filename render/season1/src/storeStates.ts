// The Store tile in every state the owner API can put it in (render session
// 91, phase 2 "the tiles in groups", group 3; owner 2026-11-28 point 9: the
// tile's hero is the packs for sale, the cosmetics stay in the Store). The
// Home snapshot holds Nova (449 credits: four packs, not ten) and Wren (0),
// so the states between and beyond never reach the page: short of one pack,
// exactly one, enough for ten, and the pack offer as a list of two or three
// (GET /api/packs serves `offer` as an array; Season 0 sells one, a later
// season may sell its own pack beside an older one), or none.
//
// Each state is a snapshot owner's real answer with only `wallet.credits`
// and `packs.offer` changed, in the API's own shape (server/OWNER_API.md,
// "Packs"). The extra offers are made up for the sheet (named as such); the
// price and the 1-to-10 buy are the API's.
//
// Pure: data in, an HTML string out. Fenced off: nothing outside
// render/season1/ imports it.

import { featuredOffer, type HomeData } from "./homeFacts.js";
import { from, statesSheet, type StateCase } from "./statesSheet.js";

const S1 = { setCode: "S1", name: "Season One", priceCredits: 120 };
const S1X = { setCode: "S1X", name: "Glitch Season Expansion", priceCredits: 150 };

export function storeStateCases(data: HomeData): StateCase[] {
  const nova = data.owners.nova!, wren = data.owners.wren!;
  const credits = (n: number) => (d: typeof nova) => { d.wallet.credits = n; };
  return [
    { id: "served", name: "449 credits: four packs, not ten (Nova, as served)", data: nova },
    { id: "new", name: "0 credits, just signed up (Wren, as served)", data: wren },
    { id: "short", name: "60 credits: short of one pack", data: from(wren, credits(60)) },
    { id: "one", name: "Exactly one pack: 100 credits", data: from(wren, credits(100)) },
    { id: "ten", name: "Enough for ten: 2,350 credits", data: from(nova, credits(2350)) },
    { id: "two-offers", name: "Two packs on sale (made-up Season One pack first, Season Zero second), 1,000 credits", data: from(nova, (d) => { d.wallet.credits = 1000; d.packs.offer = [S1, ...d.packs.offer]; }) },
    { id: "three-offers", name: "Three packs on sale (two made up): L shows two, names the third", data: from(nova, (d) => { d.wallet.credits = 449; d.packs.offer = [S1, S1X, ...d.packs.offer]; }) },
    { id: "none", name: "No pack on sale (the offer list empty)", data: from(nova, (d) => { d.packs.offer = []; }) },
  ];
}

export function storeStatesPage(data: HomeData): string {
  return statesSheet({ tile: "store", title: "Store", session: 91, cases: storeStateCases(data), note: (c) => {
    const o = c.data.packs.offer.length ? featuredOffer(c.data) : null;
    return `${c.data.wallet.credits.toLocaleString("en-AU")} credits · ${c.data.packs.offer.length} on sale${o ? ` · ${Math.floor(c.data.wallet.credits / o.priceCredits)} of ${o.name}` : ""}`;
  } });
}
