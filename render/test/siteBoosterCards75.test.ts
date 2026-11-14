// Render session 75: Season 0's booster cards on the website's Collection
// (owner 2026-11-14: "starter cards are Standard only; every special version
// belongs to the booster cards"; game session 97 built them as 097-124).
// The Set tab splits into the starter cards and the booster cards; the card
// viewer says where a card comes from and lists its versions in the binder,
// each a button to its own place. Against real store binders and
// collections (the same shapes the owner API sends).

import { describe, expect, it } from "vitest";
import { CARD_REGISTRY, S0_BOOSTER_CARD_IDS, SHIPPED_DECK_LISTS } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { PACK_PAGE_PURE_SOURCE } from "../src/packPage.js";
import type { SiteCollection } from "../src/site/siteBoard.js";
import {
  DEFAULT_FILTERS,
  binderBlocks,
  cardOrigin,
  originView,
  starterDecksOf,
  versionsOf,
  type BinderSlot,
  type SiteBinder,
} from "../src/site/siteCollection.js";
import { collectionPageHtml, faceRenderer, viewerHtml, type FaceFns } from "../src/site/siteCollectionHtml.js";

const FACE_FNS = new Function(`${PACK_PAGE_PURE_SOURCE}; return { packFaceHtml, packFinishLayerName };`)() as FaceFns;
const face = faceRenderer(FACE_FNS);

function owner(packs = 20) {
  const store = EconomyStore.open(":memory:");
  const o = store.createAccount({ name: "tess", username: "tess", password: "a long test password" });
  store.grantStarterCollection(o.ownerId, "Cortex");
  for (let i = 0; i < packs; i++) store.grantPack(o.ownerId, "S0", "weeklyChallenge");
  let seed = 7500;
  while (store.unopenedPacks(o.ownerId).length) store.openPack(o.ownerId, undefined, { seed: seed++ });
  const json = <T>(v: unknown) => JSON.parse(JSON.stringify(v)) as T;
  return { b: json<SiteBinder>(store.binder(o.ownerId, "S0")), c: json<SiteCollection>(store.collectionSummary(o.ownerId, { recentPacks: 1 })) };
}
const allSlots = (b: SiteBinder, c: SiteCollection): BinderSlot[] =>
  (["set", "secrets", "prototypes"] as const).flatMap((tab) => binderBlocks(b, c, { tab, faction: "All", show: "all" }).flatMap((x) => x.slots));

describe("where a card comes from", () => {
  it("28 booster cards, the starter decks' cards, and the 7 starter-era neutrals only crafting makes", () => {
    const by = { booster: [] as string[], starter: [] as string[], craftOnly: [] as string[] };
    for (const id of CARD_REGISTRY.keys()) by[cardOrigin(id)].push(id);
    expect(by.booster.sort()).toEqual([...S0_BOOSTER_CARD_IDS].sort());
    expect(by.booster.length).toBe(28);
    // Owner 2026-11-14, game 97 call 5 (a): these seven are in no starter deck and no pack.
    // (The 3 Zero-Day cards are in the registry too; they are secret cards, never a base place.)
    expect(by.craftOnly.filter((id) => !id.startsWith("S0-ZD")).sort()).toEqual(["NT-001", "NT-002", "NT-003", "NT-006", "NT-007", "NT-009", "NT-010"]);
    const inDecks = new Set(Object.values(SHIPPED_DECK_LISTS).flatMap((l) => l.map((e) => e.cardId)));
    expect(by.starter.every((id) => inDecks.has(id))).toBe(true);
  });
  it("the viewer's line: a booster card is packs-only in every finish; a starter card is Standard only, in its deck(s); a craft-only card says crafting is the only way", () => {
    const boost = originView({ cardId: [...S0_BOOSTER_CARD_IDS][0]!, kind: "card", section: "base" })!;
    expect(boost.tag).toBe("Booster card");
    expect(boost.line).toMatch(/packs, in every finish/);
    expect(originView({ cardId: [...S0_BOOSTER_CARD_IDS][0]!, kind: "gold", section: "gold" })!.line).toMatch(/only comes from packs/);
    const starterId = SHIPPED_DECK_LISTS.Cortex[0]!.cardId;
    const st = originView({ cardId: starterId, kind: "card", section: "base" })!;
    expect(st.tag).toBe("Starter card");
    expect(st.line).toContain("Cortex starter deck");
    expect(st.line).toMatch(/Standard only: never in packs/);
    // A neutral in more than one starter deck names them all.
    const shared = [...CARD_REGISTRY.keys()].find((id) => starterDecksOf(id).length > 1);
    if (shared) expect(originView({ cardId: shared, kind: "card", section: "base" })!.line).toMatch(/ and .* starter decks/);
    const nt = originView({ cardId: "NT-001", kind: "card", section: "base" })!;
    expect(nt.tag).toBe("Starter-era card");
    expect(nt.line).toMatch(/crafting a Standard copy is the only way/);
    expect(originView({ cardId: "S0-ZD1", kind: "zeroDay", section: "secrets" })).toBe(null);
  });
});

describe("the Set tab in two parts", () => {
  const { b, c } = owner();
  it("Starter cards 001-096 then Booster cards 097-124, each with its own held count; the filters apply inside both", () => {
    const [st, bo] = binderBlocks(b, c, DEFAULT_FILTERS);
    expect(st!.title).toBe("Starter cards · 001–096");
    expect(bo!.title).toBe("Booster cards · 097–124");
    expect([st!.total, bo!.total]).toEqual([96, 28]);
    expect(bo!.slots.every((s) => cardOrigin(s.cardId) === "booster")).toBe(true);
    expect(st!.slots.every((s) => cardOrigin(s.cardId) !== "booster")).toBe(true);
    expect(bo!.held).toBe(bo!.slots.filter((s) => s.owned > 0).length);
    // The held counts stay unfiltered; the slots are filtered.
    const missing = binderBlocks(b, c, { ...DEFAULT_FILTERS, show: "missing" });
    expect(missing.map((x) => x.held)).toEqual([st!.held, bo!.held]);
    expect(missing[1]!.slots.length).toBe(28 - bo!.held);
    const html = collectionPageHtml(b, c, DEFAULT_FILTERS, 0, face);
    expect(html).toContain('data-block="base" data-part="starter"');
    expect(html).toContain('data-block="base" data-part="booster"');
  });
  it("a set with no booster cards keeps the one block", () => {
    const old: SiteBinder = { ...b, base: { ...b.base, entries: b.base.entries.filter((e) => cardOrigin(e.cardId) !== "booster") } };
    const blocks = binderBlocks(old, c, DEFAULT_FILTERS);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.part).toBeUndefined();
  });
});

describe("a card's versions in the viewer", () => {
  const { b, c } = owner();
  const slots = allSlots(b, c);
  const byKey = new Map(slots.map((s) => [s.key, s]));
  it("Heat Death (the 1/1's card) lists the set place, its illustration, Glitch, Gold and the Prototype run of 1, each a real place", () => {
    const heat = slots.find((s) => s.section === "base" && s.name === "Heat Death")!;
    const v = versionsOf(heat, b, c);
    expect(v.map((x) => x.label)).toEqual(["Set", "Illustration", "Glitch", "Gold", "Prototype /1"]);
    expect(v.filter((x) => x.current).map((x) => x.key)).toEqual([heat.key]);
    for (const x of v) {
      const s = byKey.get(x.key)!;
      expect(s.cardId, x.key).toBe(heat.cardId);
      expect(x.held).toBe(s.owned > 0);
      expect(x.number).toBe(s.number);
    }
    // From the Gold place, the same list with Gold marked.
    const gold = slots.find((s) => s.section === "gold" && s.cardId === heat.cardId)!;
    expect(versionsOf(gold, b, c).find((x) => x.current)!.label).toBe("Gold");
  });
  it("every booster card has a Gold version at least; a starter card and a Zero-Day card have no versions row", () => {
    for (const s of slots.filter((x) => x.section === "base")) {
      const v = versionsOf(s, b, c);
      if (cardOrigin(s.cardId) === "booster") expect(v.some((x) => x.label === "Gold"), s.name).toBe(true);
      else expect(v, s.name).toEqual([]);
    }
    for (const z of slots.filter((x) => x.kind === "zeroDay")) expect(versionsOf(z, b, c)).toEqual([]);
  });
  it("the viewer draws the origin line and the versions as buttons to their places (the one on screen not a button)", () => {
    const heat = slots.find((s) => s.section === "base" && s.name === "Heat Death")!;
    const html = viewerHtml(heat, b, c, { key: heat.key, holdings: null, holdingsError: null, quantity: 1, busy: false }, 0, { prev: null, next: null }, face);
    expect(html).toContain('class="cv-origin" data-origin="booster"');
    const targets = [...html.matchAll(/class="vchip[^"]*" data-act="view-slot" data-slot="([^"]+)"/g)].map((m) => m[1]!);
    expect(targets.length).toBe(4);
    for (const k of targets) expect(byKey.has(k), k).toBe(true);
    expect(html).toContain('aria-current="true"');
    const starter = slots.find((s) => s.section === "base" && cardOrigin(s.cardId) === "starter")!;
    const sh = viewerHtml(starter, b, c, { key: starter.key, holdings: null, holdingsError: null, quantity: 1, busy: false }, 0, { prev: null, next: null }, face);
    expect(sh).toContain('data-origin="starter"');
    expect(sh).not.toContain("cv-vers");
  });
});
