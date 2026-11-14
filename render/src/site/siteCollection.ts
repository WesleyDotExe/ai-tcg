// The Collection page's model (render session 48, Season 0 render item 1:
// "Collection (wide binder)"). Pure: no DOM, no fetch. siteClient.ts draws
// what these functions answer, and the tests import them directly, so what
// is tested is what runs.
//
// Everything comes from the owner API: the set's binder (`GET
// /api/collection/binder/:setCode`, every collection entry in its place),
// the collection (`GET /api/collection`, every copy with its finish, origin
// and bound flag), the card viewer's holdings (`GET
// /api/collection/cards/:cardId`) and the salvage plan. The page never
// decides what the store accepts: crafting and salvage are sent to the
// server and its answer (or refusal) is what the page shows. The costs and
// limits shown beside the buttons are read from the same constants the
// store enforces (the economy's config and the engine's copy limits), not
// restated here; the server serves no price list for crafting.
//
// The owner's spec (2026-10-05, Screens 5): the collection grouped by set;
// tabs Set, Secrets, Prototypes, Promos; a faction filter; a binder with
// numbered empty slots for missing cards; a card viewer with tilt, and craft
// with pack points. Salvage is the owner's own choice from the card viewer
// (2026-10-07). Bound copies carry an "Account-bound" tag (2026-10-05). A
// Prototype's viewer spells it out ("Prototype, serial 7 of 50, Season 0.
// Not part of the 96-card set.") and says how many of the run were found
// (2026-10-04).

import { COPY_LIMITS, getCard, isBoosterCard, SHIPPED_DECK_LISTS, type Rarity } from "@ai-tcg/engine";
// The economy's config file holds every economy number (owner 2026-10-05:
// "one economy config file for every number"); it imports only a type from
// the engine, so it bundles for the browser. The site's esbuild alias maps
// the "@ai-tcg/economy" barrel to packs.ts, so this is imported by path.
import { CRAFT_PACK_POINTS, SECRET_CRAFT_PACK_POINTS } from "../../../economy/src/config.js";
import { cardFaceOf, revealKindOf, type CardFace, type RevealKind } from "../packOpening.js";
import type { Finish } from "@ai-tcg/economy";
import { FINISH_NAMES, type SiteCollection } from "./siteBoard.js";

// ---- the API's shapes (server/OWNER_API.md "The collection") ---------------

export type BinderKind = "card" | "illustration" | "zeroDay" | "glitch" | "gold";

export interface SiteBinderEntry {
  number: string;
  kind: BinderKind;
  cardId: string;
  secretCode: string | null;
  name: string;
  rarity: Rarity;
  owned: number;
}
export interface SiteBinderSection {
  title: string;
  held: number;
  total: number;
  entries: SiteBinderEntry[];
}
export interface SitePrototypeRun {
  runCode: string;
  cardId: string;
  name: string;
  runSize: number;
  found: number;
  serialsHeld: number[];
}
export interface SiteBinder {
  setCode: string;
  base: SiteBinderSection;
  secrets: SiteBinderSection;
  glitch: SiteBinderSection;
  gold: SiteBinderSection;
  prototypes: SitePrototypeRun[];
}
/** The card viewer's holdings (`GET /api/collection/cards/:cardId`). */
export interface SiteHoldings {
  cardId: string;
  rarity: Rarity;
  owned: number;
  salvageable: number;
  packPointsEach: number;
  notSalvageable: { reason: string; count: number }[];
  decks: { deckId: string; name: string; uses: number; active: boolean }[];
}
export interface SiteDeckShortfall {
  deckId: string;
  name: string;
  uses: number;
  owned: number;
  active: boolean;
}
/** What salvaging N would do (`GET .../salvage?quantity=N`). */
export interface SiteSalvagePlan {
  cardId: string;
  quantity: number;
  packPoints: number;
  ownedAfter: number;
  affectedDecks: SiteDeckShortfall[];
}
/** A copy as the collection lists it (every field the API sends that the page reads). */
export interface SiteCopy {
  copyId: string;
  cardId: string;
  finish: string;
  seriesKind?: string;
  seriesCode?: string | null;
  serial: number | null;
  runSize: number | null;
  secretCode: string | null;
  origin?: string;
  accountBound?: boolean;
  acquiredAt: string;
}

// ---- tabs and filters --------------------------------------------------------

export type CollectionTab = "set" | "secrets" | "prototypes" | "promos";
export const COLLECTION_TABS: { id: CollectionTab; label: string }[] = [
  { id: "set", label: "Set" },
  { id: "secrets", label: "Secrets" },
  { id: "prototypes", label: "Prototypes" },
  { id: "promos", label: "Promos" },
];
export const FACTION_FILTERS = ["All", "Cortex", "Aegis", "Swarm", "Null", "Neutral"] as const;
export type FactionFilter = (typeof FACTION_FILTERS)[number];
export type ShowFilter = "all" | "owned" | "missing";
export const SHOW_FILTERS: { id: ShowFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "owned", label: "Owned" },
  { id: "missing", label: "Missing" },
];

export interface CollectionFilters {
  tab: CollectionTab;
  faction: FactionFilter;
  show: ShowFilter;
}
export const DEFAULT_FILTERS: CollectionFilters = { tab: "set", faction: "All", show: "all" };

// ---- the binder's slots --------------------------------------------------------

/** The section a slot sits in. */
export type SlotSection = "base" | "secrets" | "glitch" | "gold" | "prototypes";

/** One place in the binder, as the page draws it. */
export interface BinderSlot {
  /** Unique on the page: the section and the entry. */
  key: string;
  section: SlotSection;
  kind: BinderKind | "prototype";
  number: string;
  cardId: string;
  secretCode: string | null;
  runCode: string | null;
  name: string;
  rarity: Rarity;
  faction: string;
  owned: number;
  /** The finish the slot's face wears: the best one held (a base slot), the
   * section's own (the others), or null for an empty slot. */
  finish: Finish | null;
  /** A Prototype run's size and how many of it were found; null elsewhere. */
  run: { size: number; found: number; serialsHeld: number[] } | null;
}

/** The finishes, best first (the pack page's own order, packFinishOrder). */
const FINISH_ORDER: Finish[] = ["zeroDay", "prototype", "tournament", "secret", "gold", "glitch", "altArt", "fullArt", "foil", "standard"];

/** A card's faction, from the engine's registry (the binder doesn't send
 * it); a Zero-Day entry not live yet is the set's Neutral. */
export function factionOfCard(cardId: string): string {
  return getCard(cardId)?.faction ?? "Neutral";
}

/** The copies the collection lists, by card id. */
export function copiesByCard(c: SiteCollection): Map<string, SiteCopy[]> {
  return new Map(c.cards.map((x) => [x.cardId, x.copies as SiteCopy[]]));
}

/** Which copies fill a slot: any copy of the card (the base set, as the
 * store counts it), a secret card's own copies, a Glitch or Gold version's,
 * or a Prototype run's. */
export function copiesOfSlot(slot: Pick<BinderSlot, "section" | "cardId" | "secretCode" | "runCode">, copies: Map<string, SiteCopy[]>): SiteCopy[] {
  const all = copies.get(slot.cardId) ?? [];
  if (slot.section === "base") return all;
  if (slot.section === "secrets") return all.filter((c) => c.secretCode === slot.secretCode);
  if (slot.section === "glitch") return all.filter((c) => c.finish === "glitch");
  if (slot.section === "gold") return all.filter((c) => c.finish === "gold");
  return all.filter((c) => c.seriesKind === "prototype" && c.seriesCode === slot.runCode);
}

/** The best finish among copies, best first; a base slot leaves the secret
 * cards to their own places (they have their own art there). */
export function bestFinish(copies: readonly SiteCopy[], section: SlotSection): Finish | null {
  const held = new Set(copies.map((c) => c.finish));
  for (const f of FINISH_ORDER) {
    if (section === "base" && (f === "secret" || f === "zeroDay")) continue;
    if (held.has(f)) return f;
  }
  // Only a secret copy held: the base slot still shows the card (plainly).
  return copies.length ? "standard" : null;
}

const SECTION_FINISH: Record<Exclude<SlotSection, "base">, (e: SiteBinderEntry) => Finish> = {
  secrets: (e) => (e.kind === "zeroDay" ? "zeroDay" : "secret"),
  glitch: () => "glitch",
  gold: () => "gold",
  prototypes: () => "prototype",
};

function slotOf(section: SlotSection, e: SiteBinderEntry, copies: Map<string, SiteCopy[]>): BinderSlot {
  const slot: BinderSlot = {
    key: `${section}:${e.secretCode ?? e.cardId}`,
    section,
    kind: e.kind,
    number: e.number,
    cardId: e.cardId,
    secretCode: e.secretCode,
    runCode: null,
    name: e.name,
    rarity: e.rarity,
    faction: factionOfCard(e.cardId),
    owned: e.owned,
    finish: null,
    run: null,
  };
  if (e.owned > 0) slot.finish = section === "base" ? bestFinish(copiesOfSlot(slot, copies), "base") : SECTION_FINISH[section](e);
  return slot;
}

function prototypeSlot(r: SitePrototypeRun): BinderSlot {
  const card = getCard(r.cardId);
  return {
    key: `prototypes:${r.runCode}`,
    section: "prototypes",
    kind: "prototype",
    number: r.runCode,
    cardId: r.cardId,
    secretCode: null,
    runCode: r.runCode,
    name: r.name,
    rarity: card?.rarity ?? "Mythic",
    faction: factionOfCard(r.cardId),
    owned: r.serialsHeld.length,
    finish: r.serialsHeld.length ? "prototype" : null,
    run: { size: r.runSize, found: r.found, serialsHeld: r.serialsHeld },
  };
}

/** One titled block of slots on a tab. */
export interface BinderBlock {
  id: SlotSection;
  /** The Set tab's two parts (render session 75): the starter cards and the
   * booster cards, each its own block. Absent on every other block. */
  part?: "starter" | "booster";
  title: string;
  /** "61 / 96" style: entries held of the section's total (unfiltered). */
  held: number;
  total: number;
  note: string;
  slots: BinderSlot[];
}

/** What a tab shows, filtered: the blocks of slots in the binder's order. */
export function binderBlocks(b: SiteBinder, c: SiteCollection, f: CollectionFilters): BinderBlock[] {
  const copies = copiesByCard(c);
  const keep = (s: BinderSlot) =>
    (f.faction === "All" || s.faction === f.faction) && (f.show === "all" || (f.show === "owned" ? s.owned > 0 : s.owned === 0));
  const block = (id: Exclude<SlotSection, "prototypes">, note: string): BinderBlock => {
    const sec = b[id];
    return { id, title: sec.title, held: sec.held, total: sec.total, note, slots: sec.entries.map((e) => slotOf(id, e, copies)).filter(keep) };
  };
  const baseTotal = b.base.total;
  if (f.tab === "set") {
    // Render session 75 (owner 2026-11-14: starter cards are Standard only;
    // every special version belongs to the booster cards): the set in two
    // parts, so the line between "never in packs" and "only in packs" is on
    // the page. A set with no booster cards keeps the one block.
    const all = b.base.entries.map((e) => slotOf("base", e, copies));
    const isB = (s: BinderSlot) => cardOrigin(s.cardId) === "booster";
    if (!all.some(isB)) return [block("base", `Every card in ${b.setCode}, numbered. A copy of any finish fills its place.`)];
    const part = (which: "starter" | "booster", slots: BinderSlot[], title: string, note: string): BinderBlock => ({
      id: "base",
      part: which,
      title: `${title} · ${numberRange(slots)}`,
      held: slots.filter((s) => s.owned > 0).length,
      total: slots.length,
      note,
      slots: slots.filter(keep),
    });
    return [
      part("starter", all.filter((s) => !isB(s)), "Starter cards", "The cards of the four starter decks and the starter-era neutrals. Standard only: never in packs, and no other version. Crafting makes a Standard copy."),
      part("booster", all.filter(isB), "Booster cards", `${b.setCode}'s booster cards: the only cards packs hold. Each comes in every finish; the Glitch, Gold, secret illustrations and Prototype runs are versions of these.`),
    ];
  }
  if (f.tab === "secrets") {
    return [
      block("secrets", `Numbered above the set's ${baseTotal}: illustration versions with their own art, then the Zero-Day cards.`),
      block("glitch", "Corrupted-colour versions of chosen cards. Each is its own entry; they keep their card's number."),
      block("gold", `Gold versions of every card, numbered above the set's ${baseTotal}.`),
    ];
  }
  if (f.tab === "prototypes") {
    const slots = b.prototypes.map(prototypeSlot).filter(keep);
    const held = b.prototypes.filter((r) => r.serialsHeld.length > 0).length;
    return [
      {
        id: "prototypes",
        title: "Prototype runs",
        held,
        total: b.prototypes.length,
        note: `Serial-numbered, never reprinted, not part of the ${baseTotal}-card set. Unpulled ones retire at season end.`,
        slots,
      },
    ];
  }
  return [];
}

/** "001–096": a run of slots' first and last numbers, without the set
 * total ("/124"). */
function numberRange(slots: readonly BinderSlot[]): string {
  const n = (s: BinderSlot | undefined) => (s ? s.number.split("/")[0]! : "");
  return slots.length > 1 ? `${n(slots[0])}–${n(slots.at(-1))}` : n(slots[0]);
}

// ---- where a card comes from (render session 75) --------------------------------

/** Where a set card comes from, by the engine's own registry: a booster card
 * (packs only, every finish), a starter card (in a starter deck, Standard
 * only, never in packs), or a starter-era card in no starter deck (crafting
 * only; owner 2026-11-14, game 97 call 5 (a)). */
export type CardOrigin = "booster" | "starter" | "craftOnly";
export function cardOrigin(cardId: string): CardOrigin {
  if (isBoosterCard(cardId)) return "booster";
  return starterDecksOf(cardId).length ? "starter" : "craftOnly";
}
/** The starter decks (by faction) that hold a card, in the registry's order. */
export function starterDecksOf(cardId: string): string[] {
  return Object.entries(SHIPPED_DECK_LISTS).filter(([, list]) => list.some((e) => e.cardId === cardId)).map(([f]) => f);
}

/** The viewer's "where it comes from" line: a short tag and a sentence. A
 * Zero-Day card (its own kind, packs only) has none. */
export interface OriginView {
  origin: CardOrigin;
  tag: string;
  line: string;
}
export function originView(s: Pick<BinderSlot, "cardId" | "kind" | "section">): OriginView | null {
  if (s.kind === "zeroDay" || !getCard(s.cardId)) return null;
  const origin = cardOrigin(s.cardId);
  if (origin === "booster") {
    return {
      origin,
      tag: "Booster card",
      line: s.section === "base"
        ? "From packs, in every finish. Crafting makes a Standard copy."
        : "A version of a booster card: it only comes from packs.",
    };
  }
  if (origin === "starter") {
    const decks = starterDecksOf(s.cardId);
    const where = decks.length === 1 ? `the ${decks[0]} starter deck` : `the ${decks.slice(0, -1).join(", ")} and ${decks.at(-1)} starter decks`;
    return { origin, tag: "Starter card", line: `In ${where}. Standard only: never in packs, no other version. Crafting makes a Standard copy.` };
  }
  return { origin, tag: "Starter-era card", line: "In no starter deck and never in packs: crafting a Standard copy is the only way to get one. Standard only." };
}

/** One of a card's versions in the binder, for the viewer's row: the set
 * place, a secret illustration, the Glitch and Gold versions, a Prototype
 * run. Each opens its own place. */
export interface VersionChip {
  key: string;
  label: string;
  number: string;
  held: boolean;
  current: boolean;
}
export function versionsOf(s: Pick<BinderSlot, "cardId" | "key" | "kind">, b: SiteBinder, c: SiteCollection): VersionChip[] {
  if (s.kind === "zeroDay") return [];
  const copies = copiesByCard(c);
  const out: VersionChip[] = [];
  const add = (slot: BinderSlot, label: string) => out.push({ key: slot.key, label, number: slot.number, held: slot.owned > 0, current: slot.key === s.key });
  for (const e of b.base.entries) if (e.cardId === s.cardId) add(slotOf("base", e, copies), "Set");
  for (const e of b.secrets.entries) if (e.cardId === s.cardId && e.kind !== "zeroDay") add(slotOf("secrets", e, copies), "Illustration");
  for (const e of b.glitch.entries) if (e.cardId === s.cardId) add(slotOf("glitch", e, copies), "Glitch");
  for (const e of b.gold.entries) if (e.cardId === s.cardId) add(slotOf("gold", e, copies), "Gold");
  for (const r of b.prototypes) if (r.cardId === s.cardId) add(prototypeSlot(r), `Prototype /${r.runSize}`);
  return out.length > 1 ? out : [];
}

/** The summary panel's numbers: the base set's completion and each chase list's. */
export interface CollectionSummary {
  setCode: string;
  held: number;
  total: number;
  pct: number;
  lines: { label: string; held: number; total: number }[];
  copies: number;
  distinct: number;
}
export function collectionSummary(b: SiteBinder, c: SiteCollection): CollectionSummary {
  const protoHeld = b.prototypes.filter((r) => r.serialsHeld.length > 0).length;
  return {
    setCode: b.setCode,
    held: b.base.held,
    total: b.base.total,
    pct: b.base.total > 0 ? Math.floor((b.base.held / b.base.total) * 100) : 0,
    lines: [
      { label: "Secrets", held: b.secrets.held, total: b.secrets.total },
      { label: "Glitch", held: b.glitch.held, total: b.glitch.total },
      { label: "Gold", held: b.gold.held, total: b.gold.total },
      { label: "Prototypes", held: protoHeld, total: b.prototypes.length },
    ],
    copies: c.copies,
    distinct: c.distinctCards,
  };
}

// ---- the face a slot draws -----------------------------------------------------

/** What the pack page's face code (packFaceHtml) takes: the same face the
 * pack reveal, its summary and the card-face sheet draw. */
export interface FaceInput {
  face: CardFace;
  finish: Finish;
  reveal: RevealKind;
  collectorNumber: string;
  prototype: { serial: number; runSize: number } | null;
  hit: boolean;
}

/** The face of a slot: its finish (an empty slot's face is plain, for the
 * viewer, which shows a missing card as it would print). */
export function faceOfSlot(s: BinderSlot): FaceInput {
  const finish: Finish = s.finish ?? (s.section === "base" ? "standard" : s.section === "secrets" ? (s.kind === "zeroDay" ? "zeroDay" : "secret") : s.section === "prototypes" ? "prototype" : s.section === "glitch" ? "glitch" : "gold");
  const serial = s.run && s.run.serialsHeld.length ? s.run.serialsHeld[0]! : null;
  return {
    face: cardFaceOf({ cardId: s.cardId, name: s.name, rarity: s.rarity }),
    finish,
    reveal: revealKindOf(finish),
    collectorNumber: s.number,
    prototype: s.section === "prototypes" && s.run ? { serial: serial ?? 0, runSize: s.run.size } : null,
    hit: finish !== "standard" && finish !== "foil",
  };
}

// ---- the card viewer -----------------------------------------------------------

const ORIGIN_NAMES: Record<string, string> = {
  pack: "From a pack",
  starter: "Starter deck",
  crafted: "Crafted",
  promo: "Promo",
  prize: "Prize",
  tournament: "Prize",
};
export function originName(origin: string | undefined): string {
  if (!origin) return "";
  return ORIGIN_NAMES[origin] ?? origin.charAt(0).toUpperCase() + origin.slice(1);
}

/** One line per copy held: its finish, where it came from, bound or not. */
export interface CopyLine {
  copyId: string;
  finish: string;
  origin: string;
  bound: boolean;
  serial: string | null;
  acquiredAt: string;
}
export function copyLines(copies: readonly SiteCopy[]): CopyLine[] {
  const rank = (f: string) => {
    const i = FINISH_ORDER.indexOf(f as Finish);
    return i < 0 ? FINISH_ORDER.length : i;
  };
  return [...copies]
    .sort((a, b) => rank(a.finish) - rank(b.finish) || a.acquiredAt.localeCompare(b.acquiredAt))
    .map((c) => ({
      copyId: c.copyId,
      finish: FINISH_NAMES[c.finish] || "Standard",
      origin: originName(c.origin),
      bound: c.accountBound === true,
      serial: c.serial !== null && c.runSize !== null ? `${c.serial} of ${c.runSize}` : null,
      acquiredAt: c.acquiredAt,
    }));
}

/** The craft button: what it costs and whether it can be pressed, with the
 * reason when not. The store checks it all again (and its refusal is what
 * the page shows if they ever disagree). */
export interface CraftView {
  /** null: this entry can't be crafted at all (`why` says so). */
  cost: number | null;
  can: boolean;
  why: string;
  /** Which call it is: a set card, or a secret card by its code. */
  call: { kind: "card"; cardId: string } | { kind: "secret"; code: string } | null;
}
export function craftView(s: BinderSlot, held: { cardCopies: number }, packPoints: number): CraftView {
  if (s.section === "base") {
    const cost = CRAFT_PACK_POINTS[s.rarity];
    const limit = COPY_LIMITS[s.rarity];
    const call = { kind: "card" as const, cardId: s.cardId };
    if (!getCard(s.cardId)) return { cost: null, can: false, why: "This card isn't live yet.", call: null };
    if (held.cardCopies >= limit) return { cost, can: false, why: `You hold ${held.cardCopies}: crafting stops at the playable limit of ${limit}.`, call };
    if (packPoints < cost) return { cost, can: false, why: `${cost - packPoints} pack points short: you have ${packPoints}.`, call };
    return { cost, can: true, why: `Makes one standard copy, account-bound. You hold ${held.cardCopies} of ${limit} playable.`, call };
  }
  if (s.section === "secrets" && s.secretCode) {
    const cost = SECRET_CRAFT_PACK_POINTS[s.kind === "zeroDay" ? "zeroDay" : "illustration"];
    const call = { kind: "secret" as const, code: s.secretCode };
    if (s.kind === "zeroDay" && !getCard(s.cardId)) return { cost, can: false, why: "Not designed yet: until it is, it can only be pulled from a pack.", call: null };
    if (s.owned > 0) return { cost, can: false, why: "You hold it: crafting makes the one copy a collection needs.", call };
    if (packPoints < cost) return { cost, can: false, why: `${cost - packPoints} pack points short: you have ${packPoints}.`, call };
    return { cost, can: true, why: "Makes the one copy your collection needs, account-bound.", call };
  }
  const where = s.section === "glitch" ? "Glitch versions" : s.section === "gold" ? "Gold versions" : "Prototypes";
  return { cost: null, can: false, why: `${where} can't be crafted: they only come from packs.`, call: null };
}

/** The salvage control: how many can go (1 to the salvageable count), for
 * how many pack points, and why the rest can't. Only on a base slot: salvage
 * is per card, and takes only unbound standard copies from packs. */
export interface SalvageView {
  max: number;
  quantity: number;
  packPoints: number;
  each: number;
  why: string[];
}
export function salvageView(h: SiteHoldings, quantity: number): SalvageView {
  const max = h.salvageable;
  const q = max === 0 ? 0 : Math.max(1, Math.min(max, Math.floor(quantity) || 1));
  const why = h.notSalvageable.map((r) => `${r.count} ${r.count === 1 ? "copy" : "copies"}: ${r.reason}`);
  if (max === 0 && h.owned === 0) why.unshift("You hold no copies.");
  return { max, quantity: q, packPoints: q * h.packPointsEach, each: h.packPointsEach, why };
}

/** The confirm dialog's body for a salvage plan; with decks it would leave
 * short, the server's list (it refused once: 409 needsConfirmation). */
export function salvageConfirmText(name: string, plan: Pick<SiteSalvagePlan, "quantity" | "packPoints" | "ownedAfter">, decks: readonly SiteDeckShortfall[]): string {
  const head = `${plan.quantity === 1 ? "One copy" : `${plan.quantity} copies`} of ${name} for ${plan.packPoints} pack points. You'll hold ${plan.ownedAfter}.`;
  if (!decks.length) return head;
  const list = decks.map((d) => `${d.name}${d.active ? " (playing)" : ""} uses ${d.uses}`).join("; ");
  return `${head} ${decks.length === 1 ? "This deck" : "These decks"} would be short until you hold the copies again or change ${decks.length === 1 ? "it" : "them"}: ${list}.`;
}

/** The viewer's caption under the card: the entry in words. */
export function slotCaption(s: BinderSlot, setTotal: number, setCode: string): string {
  if (s.section === "prototypes" && s.run) {
    const held = s.run.serialsHeld;
    const found = `${s.run.size === 1 ? "A run of 1" : `Run of ${s.run.size}`}: ${s.run.found} found.`;
    if (!held.length) return `Prototype · ${s.runCode}. Not part of the ${setTotal}-card set. ${found}`;
    return `Prototype, serial ${held.join(", ")} of ${s.run.size}, ${seasonName(setCode)}. Not part of the ${setTotal}-card set. ${found}`;
  }
  const what =
    s.section === "base" ? `${s.number} · ${s.rarity}` :
    s.section === "secrets" ? `${s.kind === "zeroDay" ? "Zero-Day" : "Secret illustration"} · ${s.number}` :
    s.section === "glitch" ? `Glitch · ${s.number}` :
    `Gold · ${s.number}`;
  return `${what} · ${s.faction}`;
}
function seasonName(setCode: string): string {
  const m = /^S(\d+)$/.exec(setCode);
  return m ? `Season ${m[1]}` : setCode;
}

/** The slot an id names, for the viewer's arrows: the next and previous
 * slots on the tab as filtered. */
export function neighbours(blocks: readonly BinderBlock[], key: string): { prev: string | null; next: string | null } {
  const keys = blocks.flatMap((b) => b.slots.map((s) => s.key));
  const i = keys.indexOf(key);
  if (i < 0) return { prev: null, next: null };
  return { prev: i > 0 ? keys[i - 1]! : null, next: i < keys.length - 1 ? keys[i + 1]! : null };
}
