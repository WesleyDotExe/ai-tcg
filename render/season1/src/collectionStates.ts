// The Collection tile in every state the owner API can put it in (render
// session 93, phase 2 "the tiles in groups", group 4, with Daily rewards).
// The Home snapshot holds Nova (49 of 124, three packs opened) and Wren (the
// starter deck, nothing opened, three packs waiting), so the states between
// and beyond never reach the page: the first pack just opened, a binder in
// all five factions with Mythics and the special finishes, a long card name,
// the whole set held.
//
// Each state is a snapshot owner's real answer with only `collection` (and,
// for the new player, `packs.unopened`) changed, in the API's own shape
// (server/OWNER_API.md, "The collection"). The extra cards are real cards
// from the registry (CARD_REGISTRY), named as made-up holdings for the sheet.
//
// Pure: data in, an HTML string out. Fenced off: nothing outside
// render/season1/ imports it.

import { CARD_REGISTRY } from "@ai-tcg/engine";
import type { HomeData, OwnerData } from "./homeFacts.js";
import { from, statesSheet, type StateCase } from "./statesSheet.js";

type Held = OwnerData["collection"]["cards"][number];

/** A real registry card held in `owned` copies, the first in `finish`. */
function held(cardId: string, owned = 1, finish = "standard"): Held {
  const c = CARD_REGISTRY.get(cardId) as { id: string; name: string; rarity: string; faction?: string } | undefined;
  if (!c) throw new Error(`no card ${cardId} in the registry`);
  return { cardId: c.id, name: c.name, rarity: c.rarity, faction: c.faction ?? "Neutral", owned, copies: Array.from({ length: owned }, (_, i) => ({ finish: i ? "standard" : finish })) };
}

/** Add cards the owner didn't have (each once), keeping the counts the API derives in step. */
function add(d: OwnerData, cards: Held[]) {
  const have = new Set(d.collection.cards.map((c) => c.cardId));
  for (const c of cards) if (!have.has(c.cardId)) d.collection.cards.push(c);
  d.collection.distinctCards = d.collection.cards.length;
}

export function collectionStateCases(data: HomeData): StateCase[] {
  const nova = data.owners.nova!, wren = data.owners.wren!;
  const set = (d: OwnerData) => d.collection.sets[0]!;
  return [
    { id: "served", name: "49 of 124, three packs opened (Nova, as served)", data: nova },
    { id: "new", name: "The starter deck only, 3 packs waiting (Wren, as served)", data: wren },
    {
      id: "first-pack", name: "A new player who opened their first pack (2 waiting)", data: from(wren, (d) => {
        d.collection.recentPulls = nova.collection.recentPulls.slice(0, 1);
        add(d, d.collection.recentPulls[0]!.cards.map((c) => held(c.cardId, 1, c.finish)));
        set(d).base.held = d.collection.cards.length;
        d.packs.unopened = d.packs.unopened.slice(0, 2);
      }),
    },
    {
      id: "five-factions", name: "Every faction, Mythics and special finishes (made-up holdings of real cards)", data: from(nova, (d) => {
        add(d, [held("CX-024", 1, "glitch"), held("SW-006", 2, "fullArt"), held("AG-014", 1, "gold"), held("NL-014", 1, "foil"), held("S0-ZD1", 1, "prototype"), held("AG-107", 1, "altArt")]);
        set(d).base.held = 97; set(d).secrets.held = 6; set(d).prototypes.runsHeld = 2;
      }),
    },
    {
      id: "long-names", name: "The longest card names as the best cards (made-up holdings)", data: from(wren, (d) => {
        d.collection.cards = [held("AG-006", 2, "fullArt"), held("CX-003", 1, "glitch"), held("NL-008", 1, "foil"), held("CX-011", 3), held("SW-016", 1, "altArt")];
        d.collection.distinctCards = 5;
        d.collection.recentPulls = nova.collection.recentPulls.slice(0, 1);
        set(d).base.held = 5;
      }),
    },
    {
      id: "complete", name: "The whole set: 124 of 124, every secret and prototype run", data: from(nova, (d) => {
        add(d, [...CARD_REGISTRY.values()].filter((c) => /^(CX|SW|AG|NL|S0)-/.test(c.id)).slice(0, 124).map((c) => held(c.id)));
        const s = set(d); s.base.held = s.base.total; s.secrets.held = s.secrets.total; s.prototypes.runsHeld = s.prototypes.runs;
      }),
    },
  ];
}

/** What the drawn tile must agree with: the held count, how many best
 * cards each size draws (3 at M, 5 at L, fewer when fewer are held), the
 * factions in the binder. */
export function collectionExpect(d: OwnerData) {
  const kinds = d.collection.cards.length;
  return { held: d.collection.sets[0]!.base.held, m: Math.min(3, kinds), l: Math.min(5, kinds), factions: new Set(d.collection.cards.map((c) => c.faction)).size };
}

export function collectionStatesPage(data: HomeData): string {
  const cases = collectionStateCases(data).map((c) => ({ ...c, expect: collectionExpect(c.data) }));
  return statesSheet({ tile: "collection", title: "Collection", session: 93, cases, note: (c) => {
    const s = c.data.collection.sets[0]!;
    return `${s.base.held} of ${s.base.total} · ${c.data.collection.distinctCards} kinds held · ${c.data.collection.recentPulls.length} packs opened recently · ${c.data.packs.unopened.length} waiting`;
  } });
}
