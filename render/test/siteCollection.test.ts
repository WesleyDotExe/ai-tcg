// The Collection page on the website (render session 48): the pure model
// (siteCollection.ts) against real store binders and collections, the page
// and the card viewer as HTML (siteCollectionHtml.ts) drawn with the pack
// page's own face code, the face's CSS and script cut from the pack page
// (siteFaces.ts), and the API client's collection calls against the game
// lane's real owner API (its own code, unchanged, over an in-memory store):
// the binder, the card viewer's holdings, salvage (incl. the 409 that asks
// before leaving a saved deck short) and crafting.

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { COPY_LIMITS, getCard, type Rarity } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { CRAFT_PACK_POINTS, SECRET_CRAFT_PACK_POINTS } from "../../economy/src/config.js";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { PACK_CSS, PACK_PAGE_PURE_SOURCE } from "../src/packPage.js";
import { faceHtml as sheetFaceHtml } from "../src/faceSheet.js";
import { SiteApiError, salvageNeedsConfirmation, siteApi } from "../src/site/siteApi.js";
import type { SiteCollection } from "../src/site/siteBoard.js";
import {
  DEFAULT_FILTERS,
  bestFinish,
  binderBlocks,
  collectionSummary,
  copiesByCard,
  copiesOfSlot,
  copyLines,
  craftView,
  faceOfSlot,
  neighbours,
  salvageConfirmText,
  salvageView,
  slotCaption,
  type BinderSlot,
  type SiteBinder,
  type SiteCopy,
  type SiteHoldings,
} from "../src/site/siteCollection.js";
import { collectionPageHtml, faceRenderer, viewerHtml, type FaceFns } from "../src/site/siteCollectionHtml.js";
import { FACE_CSS, FACE_EXPORTS, FACE_SCRIPT, cssRules, faceRules, faceSymbols } from "../src/site/siteFaces.js";
import { renderSitePage } from "../src/site/sitePage.js";
import { PAGE_WAITS } from "../src/site/siteModel.js";

const PW = "a long test password";
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  while (running.length) await running.pop()!.close();
});

/** The pack page's face functions, built from its own source (as the
 * card-face sheet does and as window.SITE_FACE is in the browser). */
const FACE_FNS = new Function(`${PACK_PAGE_PURE_SOURCE}; return { packFaceHtml, packFinishLayerName };`)() as FaceFns;
const face = faceRenderer(FACE_FNS);

/** A real owner: the Cortex starter (account-bound) plus seeded packs, the
 * shapes as the API sends them (through JSON). */
function owner(packs = 12) {
  const store = EconomyStore.open(":memory:");
  const o = store.createAccount({ name: "tess", username: "tess", password: PW });
  store.grantStarterCollection(o.ownerId, "Cortex");
  for (let i = 0; i < packs; i++) store.grantPack(o.ownerId, "S0", "weeklyChallenge");
  let seed = 900;
  while (store.unopenedPacks(o.ownerId).length) store.openPack(o.ownerId, undefined, { seed: seed++ });
  const json = <T>(v: unknown) => JSON.parse(JSON.stringify(v)) as T;
  return {
    store,
    ownerId: o.ownerId,
    binder: () => json<SiteBinder>(store.binder(o.ownerId, "S0")),
    collection: () => json<SiteCollection>(store.collectionSummary(o.ownerId, { recentPacks: 1 })),
  };
}

const allSlots = (b: SiteBinder, c: SiteCollection) =>
  (["set", "secrets", "prototypes"] as const).flatMap((tab) => binderBlocks(b, c, { tab, faction: "All", show: "all" }).flatMap((x) => x.slots));

describe("the binder's slots", () => {
  const o = owner();
  const b = o.binder();
  const c = o.collection();
  it("the Set tab is the base set in the binder's order, every place numbered, held ones counted as the store counts them", () => {
    const [base] = binderBlocks(b, c, DEFAULT_FILTERS);
    expect(base!.id).toBe("base");
    expect(base!.slots.map((s) => s.number)).toEqual(b.base.entries.map((e) => e.number));
    expect(base!.slots.length).toBe(b.base.total);
    for (const s of base!.slots) {
      expect(s.owned).toBe(copiesOfSlot(s, copiesByCard(c)).length);
      expect(s.finish === null).toBe(s.owned === 0);
    }
    expect(base!.held).toBe(b.base.held);
    // Every place on every tab: its count is its own copies (a Glitch place counts only Glitch copies, ...).
    for (const s of allSlots(b, c)) expect(s.owned, s.key).toBe(copiesOfSlot(s, copiesByCard(c)).length);
  });
  it("the faction filter keeps the engine's faction; Owned and Missing split the places", () => {
    for (const faction of ["Cortex", "Aegis", "Swarm", "Null", "Neutral"] as const) {
      const [blk] = binderBlocks(b, c, { ...DEFAULT_FILTERS, faction });
      expect(blk!.slots.length).toBeGreaterThan(0);
      for (const s of blk!.slots) expect(getCard(s.cardId)!.faction).toBe(faction);
    }
    const owned = binderBlocks(b, c, { ...DEFAULT_FILTERS, show: "owned" })[0]!.slots;
    const missing = binderBlocks(b, c, { ...DEFAULT_FILTERS, show: "missing" })[0]!.slots;
    expect(owned.length).toBe(b.base.held);
    expect(owned.length + missing.length).toBe(b.base.total);
    expect(owned.every((s) => s.owned > 0) && missing.every((s) => s.owned === 0)).toBe(true);
  });
  it("Secrets holds the secret cards, the Glitch versions and the Gold versions; Prototypes the runs; Promos nothing (it waits)", () => {
    expect(binderBlocks(b, c, { ...DEFAULT_FILTERS, tab: "secrets" }).map((x) => [x.id, x.slots.length])).toEqual([
      ["secrets", b.secrets.total],
      ["glitch", b.glitch.total],
      ["gold", b.gold.total],
    ]);
    const [p] = binderBlocks(b, c, { ...DEFAULT_FILTERS, tab: "prototypes" });
    expect(p!.slots.map((s) => s.runCode)).toEqual(b.prototypes.map((r) => r.runCode));
    expect(p!.slots.every((s) => s.run!.size > 0)).toBe(true);
    expect(binderBlocks(b, c, { ...DEFAULT_FILTERS, tab: "promos" })).toEqual([]);
  });
  it("every slot's key is unique across the tabs, and the viewer's arrows walk them in order", () => {
    const slots = allSlots(b, c);
    expect(new Set(slots.map((s) => s.key)).size).toBe(slots.length);
    const blocks = binderBlocks(b, c, DEFAULT_FILTERS);
    const keys = blocks[0]!.slots.map((s) => s.key);
    expect(neighbours(blocks, keys[0]!)).toEqual({ prev: null, next: keys[1] });
    expect(neighbours(blocks, keys[5]!)).toEqual({ prev: keys[4], next: keys[6] });
    expect(neighbours(blocks, keys.at(-1)!)).toEqual({ prev: keys.at(-2), next: null });
  });
  it("a base place shows the best finish held, but leaves a secret copy to its own place", () => {
    const cp = (finish: string, secretCode: string | null = null): SiteCopy => ({ copyId: finish, cardId: "X", finish, serial: null, runSize: null, secretCode, acquiredAt: "2026-01-01" });
    expect(bestFinish([cp("standard"), cp("foil")], "base")).toBe("foil");
    expect(bestFinish([cp("foil"), cp("gold"), cp("fullArt")], "base")).toBe("gold");
    expect(bestFinish([cp("secret", "S0-SR01"), cp("standard")], "base")).toBe("standard");
    expect(bestFinish([cp("secret", "S0-SR01")], "base")).toBe("standard");
    expect(bestFinish([], "base")).toBe(null);
  });
  it("the summary is the binder's own numbers", () => {
    const sum = collectionSummary(b, c);
    expect([sum.held, sum.total, sum.copies, sum.distinct]).toEqual([b.base.held, b.base.total, c.copies, c.distinctCards]);
    expect(sum.pct).toBe(Math.floor((b.base.held / b.base.total) * 100));
    expect(sum.lines.map((l) => l.label)).toEqual(["Secrets", "Glitch", "Gold", "Prototypes"]);
  });
  afterAll(() => o.store.close());
});

describe("the face a slot draws", () => {
  const o = owner();
  const b = o.binder();
  const c = o.collection();
  it("is the engine card's printed face with the slot's finish, number and reveal", () => {
    for (const s of allSlots(b, c)) {
      const f = faceOfSlot(s);
      expect(f.collectorNumber).toBe(s.number);
      expect(f.face.name).toBe(getCard(s.cardId)?.name ?? s.name);
      if (s.section === "gold") expect(f.finish).toBe("gold");
      if (s.section === "glitch") expect(f.finish).toBe("glitch");
      if (s.section === "prototypes") expect(f.prototype?.runSize).toBe(s.run!.size);
      if (s.section === "secrets") expect(f.finish).toBe(s.kind === "zeroDay" ? "zeroDay" : "secret");
    }
  });
  it("draws exactly what the card-face sheet draws for the same card (the same code)", () => {
    const s = allSlots(b, c).find((x) => x.section === "base" && x.owned > 0)!;
    const f = faceOfSlot(s);
    expect(face(f, "S0")).toBe(sheetFaceHtml(f));
    const g = faceOfSlot(allSlots(b, c).find((x) => x.section === "gold")!);
    expect(face(g, "S0")).toContain("fx-css-gold");
    expect(face(g, "S0")).toContain("goldframe");
  });
  afterAll(() => o.store.close());
});

describe("crafting and salvage, as the page offers them", () => {
  it("craft costs and limits are the store's own; the page offers a craft exactly when the store makes one", () => {
    const o = owner(30);
    const ownerId = o.ownerId;
    // Give the owner points to spend (salvaging what can go).
    for (const card of o.store.collectionSummary(ownerId).cards) {
      const h = o.store.cardHoldings(ownerId, card.cardId);
      if (h.salvageable > 0) o.store.salvage(ownerId, card.cardId, h.salvageable, { confirmDeckImpact: true });
    }
    let offered = 0, refused = 0;
    const b = o.binder();
    const c = o.collection();
    const slots = allSlots(b, c).filter((s) => s.section === "base" || s.section === "secrets");
    for (const s of slots.slice(0, 60)) {
      const pp = o.store.wallet(ownerId).packPoints;
      const now = copiesByCard(o.collection());
      const cv = craftView({ ...s, owned: s.section === "secrets" ? o.store.binder(ownerId, "S0").secrets.entries.find((e) => e.secretCode === s.secretCode)!.owned : s.owned }, { cardCopies: now.get(s.cardId)?.length ?? 0 }, pp);
      if (s.section === "base") {
        expect(cv.cost).toBe(CRAFT_PACK_POINTS[s.rarity]);
        if (cv.why.includes("limit")) expect(cv.why).toContain(String(COPY_LIMITS[s.rarity]));
      } else expect(cv.cost).toBe(SECRET_CRAFT_PACK_POINTS[s.kind === "zeroDay" ? "zeroDay" : "illustration"]);
      if (!cv.call) continue;
      const tryIt = () => (cv.call!.kind === "card" ? o.store.craftCard(ownerId, cv.call!.cardId) : o.store.craftSecret(ownerId, cv.call!.code));
      if (cv.can) {
        expect(tryIt).not.toThrow();
        offered++;
      } else {
        expect(tryIt).toThrow();
        refused++;
      }
    }
    expect(offered).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
    o.store.close();
  });
  it("Glitch, Gold and Prototype places can't be crafted, and say why", () => {
    const o = owner(0);
    const b = o.binder();
    const c = o.collection();
    for (const s of allSlots(b, c).filter((x) => x.section === "glitch" || x.section === "gold" || x.section === "prototypes")) {
      const cv = craftView(s, { cardCopies: 0 }, 99999);
      expect([cv.cost, cv.can, cv.call]).toEqual([null, false, null]);
      expect(cv.why).toMatch(/only come from packs/);
    }
    o.store.close();
  });
  it("salvage: 1 to the salvageable count, its pack points, and why the rest can't go", () => {
    const h: SiteHoldings = { cardId: "X", rarity: "Rare", owned: 5, salvageable: 3, packPointsEach: 30, notSalvageable: [{ reason: "Account-bound (starter copy)", count: 2 }], decks: [] };
    expect(salvageView(h, 0).quantity).toBe(1);
    expect(salvageView(h, 7).quantity).toBe(3);
    expect(salvageView(h, 2)).toMatchObject({ quantity: 2, packPoints: 60, max: 3, each: 30 });
    expect(salvageView(h, 2).why).toEqual(["2 copies: Account-bound (starter copy)"]);
    expect(salvageView({ ...h, owned: 0, salvageable: 0, notSalvageable: [] }, 1)).toMatchObject({ max: 0, quantity: 0, why: ["You hold no copies."] });
  });
  it("the confirm names the decks it would leave short", () => {
    const plan = { quantity: 2, packPoints: 20, ownedAfter: 1 };
    expect(salvageConfirmText("Hotfix", plan, [])).toBe("2 copies of Hotfix for 20 pack points. You'll hold 1.");
    expect(salvageConfirmText("Hotfix", plan, [{ deckId: "d", name: "Cortex starter", uses: 2, owned: 1, active: true }])).toMatch(/This deck would be short .*Cortex starter \(playing\) uses 2/);
  });
});

describe("the page and the card viewer as HTML", () => {
  const o = owner();
  const b = o.binder();
  const c = o.collection();
  it("held places are faces with their count; missing places are numbered empty slots", () => {
    const html = collectionPageHtml(b, c, DEFAULT_FILTERS, 65, face);
    expect((html.match(/class="bslot held"/g) ?? []).length).toBe(b.base.held);
    expect((html.match(/class="bslot miss"/g) ?? []).length).toBe(b.base.total - b.base.held);
    const missing = b.base.entries.find((e) => e.owned === 0)!;
    expect(html).toContain(`<b>${missing.number}</b>`);
    const two = b.base.entries.find((e) => e.owned > 1)!;
    expect(html).toContain(`you hold ${two.owned}`);
    expect(html).toContain(`<span class="bcount">×${two.owned}</span>`);
    expect(html).toContain(`${b.base.held} / ${b.base.total}`);
  });
  it("Promos says what it waits on (no made-up cards)", () => {
    const html = collectionPageHtml(b, c, { ...DEFAULT_FILTERS, tab: "promos" }, 0, face);
    expect(html).toContain("Waiting on the server for");
    expect(html).not.toContain("bslot");
  });
  it("the viewer: every copy with its finish and origin, Account-bound on bound copies; craft and salvage from the numbers", () => {
    const s = allSlots(b, c).find((x) => x.section === "base" && x.owned > 0 && getCard(x.cardId)!.faction === "Cortex")!;
    const h = o.store.cardHoldings(o.ownerId, s.cardId) as SiteHoldings;
    const html = viewerHtml(s, b, c, { key: s.key, holdings: h, holdingsError: null, quantity: 1, busy: false }, 0, { prev: null, next: "x" }, face);
    const lines = copyLines(copiesOfSlot(s, copiesByCard(c)));
    expect((html.match(/<li><b>/g) ?? []).length).toBe(lines.length);
    const bound = lines.filter((l) => l.bound).length;
    expect((html.match(/Account-bound<\/span>/g) ?? []).length).toBe(bound);
    expect(bound).toBeGreaterThan(0); // the Cortex starter's copies
    expect(html).toContain(`You hold ${lines.length}`);
    expect(html).toMatch(/id="craft-btn"[^>]* disabled/); // 0 pack points
    expect(html).toMatch(/id="cv-prev"[^>]* disabled/);
    expect(html).not.toMatch(/id="cv-next"[^>]* disabled/);
  });
  it("a Prototype's caption spells it out; a run with none held says how many were found", () => {
    const p: BinderSlot = { ...allSlots(b, c).find((x) => x.section === "prototypes")!, owned: 1, finish: "prototype", run: { size: 50, found: 11, serialsHeld: [7] } };
    expect(slotCaption(p, 96, "S0")).toBe("Prototype, serial 7 of 50, Season 0. Not part of the 96-card set. Run of 50: 11 found.");
    expect(slotCaption({ ...p, owned: 0, run: { size: 1, found: 0, serialsHeld: [] } }, 96, "S0")).toBe(`Prototype · ${p.runCode}. Not part of the 96-card set. A run of 1: 0 found.`);
  });
  afterAll(() => o.store.close());
});

describe("the face's CSS and script, cut from the pack page", () => {
  it("keeps every .face rule the pack page has (scoped under .cface), the keyframes they use, and nothing else of the page's", () => {
    const pageFace = cssRules(PACK_CSS).filter((r) => !r.prelude.startsWith("@") && r.prelude.split(",").some((s) => /^\.(face|faction-)/.test(s.trim())));
    expect(faceRules(PACK_CSS).length).toBe(pageFace.length);
    expect(pageFace.length).toBeGreaterThan(50);
    for (const sel of FACE_CSS.split("\n").filter((l) => !l.startsWith("@") && /^[.]/.test(l)).map((l) => l.slice(0, l.indexOf("{")))) {
      for (const one of sel.split(",")) expect(one.trim().startsWith(".cface")).toBe(true);
    }
    expect(FACE_CSS).toMatch(/@keyframes sheen/);
    expect(FACE_CSS).not.toMatch(/@keyframes (deal|rise|glow)\b/);
    expect(FACE_CSS).toMatch(/--gold2:/);
  });
  it("the script hands the website the face functions; the page carries it, the set symbol and the viewer", () => {
    const w: Record<string, unknown> = {};
    new Function("window", FACE_SCRIPT)(w);
    const api = w.SITE_FACE as Record<string, unknown>;
    for (const n of FACE_EXPORTS) expect(typeof api[n]).toBe("function");
    expect(FACE_SCRIPT).not.toMatch(/<\/script/i);
    const page = renderSitePage();
    expect(page).toContain(FACE_SCRIPT);
    expect(page).toContain(faceSymbols());
    expect(faceSymbols()).toContain('<symbol id="setsym"');
    expect(page).toContain('<div id="viewer" hidden></div>');
    expect(PAGE_WAITS.collection).toBeUndefined();
  });
});

describe("the collection, through the API client, over the real owner API", () => {
  async function serve(setup: (s: EconomyStore, ownerId: string) => void = () => {}) {
    const store = EconomyStore.open(":memory:");
    const o = store.createAccount({ name: "tess", username: "tess", password: PW });
    const { copies } = store.grantStarterCollection(o.ownerId, "Cortex");
    const deck = store.saveDeck(o.ownerId, "Cortex starter", copies.map((c) => c.copyId));
    store.setActiveDeck(o.ownerId, deck.deckId);
    for (let i = 0; i < 8; i++) store.grantPack(o.ownerId, "S0", "weeklyChallenge");
    let seed = 300;
    while (store.unopenedPacks(o.ownerId).length) store.openPack(o.ownerId, undefined, { seed: seed++ });
    setup(store, o.ownerId);
    const api = await startOwnerApi({ store, port: 0 });
    running.push(api);
    const client = siteApi((input, init) => fetch(input, init), `http://127.0.0.1:${api.port}`);
    const { token } = await client.signIn("tess", PW);
    return { store, ownerId: o.ownerId, client, token, starter: copies, deckId: deck.deckId };
  }

  it("the binder and the holdings are the store's; the page's slots read them", async () => {
    const t = await serve();
    const b = await t.client.binder(t.token, "S0");
    expect(b).toEqual(JSON.parse(JSON.stringify(t.store.binder(t.ownerId, "S0"))));
    const c = await t.client.collection(t.token, 1);
    const s = binderBlocks(b, c, DEFAULT_FILTERS)[0]!.slots.find((x) => x.owned > 0)!;
    const h = await t.client.cardHoldings(t.token, s.cardId);
    expect(h.owned).toBe(s.owned);
    await expect(t.client.binder(t.token, "S9")).rejects.toBeInstanceOf(SiteApiError);
  });

  it("salvage: the plan, then the 409 that names a saved deck it would leave short, then confirmed; pack points paid", async () => {
    // A deck that lists a pack copy: the starter with one copy swapped for
    // a pulled, salvageable copy (Cortex or Neutral) the deck can take. The
    // deck then uses one more of that card than the starter alone holds, so
    // salvaging every salvageable copy leaves it short.
    let swapped = "";
    const t = await serve((store, ownerId) => {
      const pulled = store.collection(ownerId).filter((c) => c.origin === "pack" && c.finish === "standard" && !c.accountBound && ["Cortex", "Neutral"].includes(getCard(c.cardId)?.faction ?? ""));
      const starter = store.collection(ownerId).filter((c) => c.origin === "starter");
      for (const p of pulled) {
        try {
          store.saveDeck(ownerId, "Swapped", [...starter.slice(1).map((c) => c.copyId), p.copyId]);
          swapped = p.cardId;
          return;
        } catch {
          /* not legal with this one: try the next */
        }
      }
    });
    expect(swapped).not.toBe("");
    const h = await t.client.cardHoldings(t.token, swapped);
    expect(h.salvageable).toBeGreaterThan(0);
    const q = h.salvageable;
    const plan = await t.client.salvagePlan(t.token, swapped, q);
    expect(plan.affectedDecks.map((d) => d.name)).toEqual(["Swapped"]);
    // Sent without the confirm: refused, nothing salvaged, the decks named.
    const err = await t.client.salvage(t.token, swapped, q, false).catch((e: unknown) => e);
    expect(salvageNeedsConfirmation(err)?.map((d) => d.name)).toEqual(["Swapped"]);
    expect((await t.client.cardHoldings(t.token, swapped)).owned).toBe(h.owned);
    // Another refusal isn't read as one.
    expect(salvageNeedsConfirmation(new SiteApiError(409, "x", { error: "x" }))).toBe(null);
    expect(salvageNeedsConfirmation(new SiteApiError(409, "x", { error: "x", affectedDecks: [] }))).toBe(null);
    const before = t.store.wallet(t.ownerId).packPoints;
    const r = await t.client.salvage(t.token, swapped, q, true);
    expect(r.packPoints).toBe(q * h.packPointsEach);
    expect(r.wallet.packPoints).toBe(before + q * h.packPointsEach);
    expect(r.holdings.owned).toBe(h.owned - q);
  });

  it("crafting a set card and a secret card; the store's refusals come back with its words", async () => {
    const t = await serve();
    const c = await t.client.collection(t.token, 1);
    const b = await t.client.binder(t.token, "S0");
    const missing = binderBlocks(b, c, { ...DEFAULT_FILTERS, show: "missing" })[0]!.slots.find((s) => s.rarity === ("Common" as Rarity))!;
    const pp = t.store.wallet(t.ownerId).packPoints;
    if (pp < CRAFT_PACK_POINTS.Common) {
      const err = await t.client.craftCard(t.token, missing.cardId).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SiteApiError);
      expect((err as SiteApiError).message).toMatch(/costs 40 pack points/);
    } else {
      const r = await t.client.craftCard(t.token, missing.cardId);
      expect(r.copy.accountBound).toBe(true);
      expect(r.wallet.packPoints).toBe(pp - CRAFT_PACK_POINTS.Common);
      expect(r.holdings.owned).toBe(1);
    }
    const secret = b.secrets.entries.find((e) => e.kind === "illustration")!;
    const err = await t.client.craftSecret(t.token, secret.secretCode!).catch((e: unknown) => e);
    expect((err as SiteApiError).status).toBe(409);
    expect((err as SiteApiError).message).toMatch(/costs 750 pack points/);
  });
});
