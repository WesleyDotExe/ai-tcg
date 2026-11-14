// Render session 76: the faction lock marked buildable or not (owner
// 2026-11-14, game session 99's call (a)). Pure fixtures for the words and
// the drawing; then the real owner API over a real store: the site's reading
// of the collection gives the same number the store's own deck build refuses
// with, and the crafting plan it names really makes the deck buildable.
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { getCard, holdingsOf, largestDeck, SHIPPED_DECK_LISTS } from "@ai-tcg/engine";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { siteApi, type SiteFaction } from "../src/site/siteApi.js";
import type { SiteCollection } from "../src/site/siteBoard.js";
import { craftPlan, holdingsFromCollection, lockAriaLabel, lockNote, lockNoteHtml, lockSegHtml, lockToast, lockableView, planText, type LockableView } from "../src/site/siteLockable.js";

const FACTIONS: SiteFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];

/** A collection holding the given copies (the fields the lock reads). */
function collectionOf(held: Map<string, number>): SiteCollection {
  return {
    copies: [...held.values()].reduce((s, n) => s + n, 0),
    distinctCards: held.size,
    cards: [...held].map(([cardId, owned]) => ({ cardId, name: getCard(cardId)!.name, rarity: getCard(cardId)!.rarity, faction: null, owned, salvageable: owned, copies: [] })),
    sets: [],
    recentPulls: [],
  };
}

/** One faction's starter list, as copies held. */
function starter(faction: SiteFaction): Map<string, number> {
  return new Map(SHIPPED_DECK_LISTS[faction].map((e) => [e.cardId, e.copies]));
}

describe("which factions can be built, from the collection", () => {
  it("a Swarm starter builds Swarm only; every other faction is short, with its count", () => {
    const views = lockableView({ lockableFactions: FACTIONS }, collectionOf(starter("Swarm")))!;
    const swarm = views.find((v) => v.faction === "Swarm")!;
    expect(swarm).toMatchObject({ buildable: true, short: 0, source: "collection", plan: [] });
    expect(swarm.cards).toBe(largestDeck("Swarm", starter("Swarm")));
    for (const v of views.filter((x) => x.faction !== "Swarm")) {
      expect(v.buildable).toBe(false);
      expect(v.cards).toBeLessThan(20);
      expect(v.short).toBe(20 - v.cards);
      expect(v.needed).toBe(20);
    }
  });

  it("nothing in hand yet: no marks (the lock draws as it always did)", () => {
    expect(lockableView({ lockableFactions: FACTIONS }, null)).toBeNull();
    const html = lockSegHtml(FACTIONS, null, null);
    expect(html).not.toContain("short");
    expect(html).toContain('id="faction-lock"');
    expect(html.match(/<button/g)!.length).toBe(5);
  });

  it("the server's field wins when it is sent (cards and buildable as it says)", () => {
    const lockable = FACTIONS.map((faction) => ({ faction, buildable: faction === "Null", cards: faction === "Null" ? 40 : 7, needed: 20 }));
    const views = lockableView({ lockableFactions: FACTIONS, lockable }, null)!;
    expect(views.map((v) => [v.faction, v.buildable, v.cards, v.source])).toEqual([
      ["Cortex", false, 7, "server"],
      ["Swarm", false, 7, "server"],
      ["Aegis", false, 7, "server"],
      ["Null", true, 40, "server"],
    ]);
    // No collection to plan from: the count only.
    expect(views[0]!.plan).toEqual([]);
  });
});

describe("the cheapest crafts to a deck", () => {
  it("each step raises the largest deck by one, cheapest first, from the faction's starter list", () => {
    const held = starter("Swarm");
    const { plan, packPoints, reaches, size } = craftPlan("Aegis", held);
    expect(reaches).toBe(true);
    expect(size).toBe(20);
    const copies = plan.reduce((s, x) => s + x.copies, 0);
    expect(copies).toBe(20 - largestDeck("Aegis", held));
    const list = new Set(SHIPPED_DECK_LISTS.Aegis.map((e) => e.cardId));
    expect(plan.every((s) => list.has(s.cardId))).toBe(true);
    expect(packPoints).toBe(plan.reduce((s, x) => s + x.packPoints, 0));
    // Applying it really reaches 20.
    const after = new Map(held);
    for (const s of plan) after.set(s.cardId, (after.get(s.cardId) ?? 0) + s.copies);
    expect(largestDeck("Aegis", after)).toBe(20);
    // Commons first: the plan costs no more than the same number of the
    // cheapest prices could.
    expect(plan.every((s) => s.rarity === "Common" || s.rarity === "Uncommon")).toBe(true);
  });

  it("one short: one craft; already there: nothing", () => {
    const held = starter("Aegis");
    expect(craftPlan("Aegis", held).plan).toEqual([]);
    // Take cards away until the deck is 19.
    const less = new Map(held);
    for (const e of SHIPPED_DECK_LISTS.Aegis) {
      while ((less.get(e.cardId) ?? 0) > 0 && largestDeck("Aegis", less) > 19) less.set(e.cardId, less.get(e.cardId)! - 1);
      if (largestDeck("Aegis", less) === 19) break;
    }
    expect(largestDeck("Aegis", less)).toBe(19);
    const p = craftPlan("Aegis", less);
    expect(p.plan.reduce((s, x) => s + x.copies, 0)).toBe(1);
    expect(p.reaches).toBe(true);
  });
});

describe("the lock on the Settings page", () => {
  const views = lockableView({ lockableFactions: FACTIONS }, collectionOf(starter("Swarm")))!;
  const aegis = views.find((v) => v.faction === "Aegis")!;

  it("greys a short faction with its count, still pressable; names it for a screen reader", () => {
    const html = lockSegHtml(FACTIONS, views, "Swarm");
    expect(html).toContain(`data-v="Aegis" class="short"`);
    expect(html).toContain(`>${aegis.cards}/20</span>`);
    expect(html).not.toContain(`data-v="Swarm" class="short"`);
    expect(html).not.toMatch(/disabled/);
    expect(lockAriaLabel(aegis)).toBe(`Aegis: can't build a deck yet, ${aegis.cards} of 20 cards`);
    expect(html).toContain('data-v="Swarm" aria-pressed="true"');
  });

  it("under the lock: a quiet line when others are greyed; a warning when the lock itself is short", () => {
    const quiet = lockNote(views, "Swarm")!;
    expect(quiet.tone).toBe("muted");
    expect(quiet.text).toContain(`Aegis ${aegis.cards}/20`);
    const warn = lockNote(views, "Aegis")!;
    expect(warn.tone).toBe("warn");
    expect(warn.text).toMatch(/^Your agent sits out every round: it can't build an Aegis deck yet\./);
    expect(warn.text).toContain(planText(aegis));
    expect(warn.text).toContain(`yet. Your cards make at most ${aegis.cards} of the 20`);
    expect(lockNoteHtml(views, "Aegis")).toContain('href="#/collection"');
    // Every faction buildable: nothing.
    const all = lockableView({ lockableFactions: FACTIONS }, collectionOf(new Map(FACTIONS.flatMap((f) => [...starter(f)]))))!;
    expect(all.every((v) => v.buildable)).toBe(true);
    expect(lockNote(all, "Aegis")).toBeNull();
    expect(lockNoteHtml(all, null)).toBe("");
  });

  it("the toast after locking a short faction keeps the lock and says what to craft; none for a buildable one", () => {
    expect(lockToast(views, "Swarm")).toBeNull();
    expect(lockToast(views, null)).toBeNull();
    const t = lockToast(views, "Aegis")!;
    expect(t).toBe(`Locked to Aegis, but your agent sits out every round until it can build an Aegis deck: ${aegis.cards} of 20 cards. What to craft is under the lock.`);
  });

  it("the plan in words", () => {
    const v: LockableView = { ...aegis, plan: [{ cardId: "a", name: "Aegis Cadet", rarity: "Common", copies: 2, packPoints: 80 }, { cardId: "b", name: "Signal Ward", rarity: "Uncommon", copies: 1, packPoints: 80 }], planPackPoints: 160 };
    expect(planText(v)).toBe("Aegis Cadet ×2 and Signal Ward (160 pack points)");
  });
});

// ---- over the real owner API ----------------------------------------------------------

const PW = "correct horse battery";
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) {
    await r.idle();
    await r.close();
  }
});

describe("the real owner API: an owner locks a faction they can't build yet", () => {
  it("the site's count is the store's own refusal; crafting the plan makes the deck build", async () => {
    const store = EconomyStore.open(":memory:");
    const me = store.createAccount({ name: "ada", username: "ada", password: PW });
    store.grantStarterCollection(me.ownerId, "Swarm");
    store.createAgent({ ownerId: me.ownerId, name: "Vector" });
    // Pack points for the crafts: packs opened (5 points each).
    for (let i = 0; i < 40; i++) store.grantPack(me.ownerId, "S0", "weeklyChallenge");
    store.openPacks(me.ownerId, 10, { seeds: Array.from({ length: 10 }, (_, i) => i) });
    store.openPacks(me.ownerId, 10, { seeds: Array.from({ length: 10 }, (_, i) => 10 + i) });
    store.openPacks(me.ownerId, 10, { seeds: Array.from({ length: 10 }, (_, i) => 20 + i) });
    store.openPacks(me.ownerId, 10, { seeds: Array.from({ length: 10 }, (_, i) => 30 + i) });
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const { token } = await client.signIn("ada", PW);

    // The site's reading equals the engine's rule on the store's own copies.
    const collection = await client.collection(token);
    const holdings = holdingsFromCollection(collection);
    expect(holdings).toEqual(holdingsOf(store.collection(me.ownerId).map((c) => c.cardId)));

    const locked = await client.setFactionLock(token, "Aegis");
    expect(locked.factionLock).toBe("Aegis"); // the lock stays allowed
    const views = lockableView(locked, collection)!;
    const aegis = views.find((v) => v.faction === "Aegis")!;
    expect(views.find((v) => v.faction === "Swarm")!.buildable).toBe(true);
    expect(aegis.buildable).toBe(false);
    expect(aegis.cards).toBeGreaterThanOrEqual(7); // the booster cards opened count
    // The store's own build refuses with the same number.
    await expect(store.buildAgentDeck(me.ownerId, { games: 0 })).rejects.toThrow(`at most ${aegis.cards} usable cards, under 20`);
    expect(lockToast(views, "Aegis")).toContain(`${aegis.cards} of 20 cards`);
    expect(lockNote(views, "Aegis")!.text).toContain(`craft at least ${aegis.short} more card`);

    // Craft the plan through the API (the owner's real path).
    expect(aegis.planReaches).toBe(true);
    expect(store.balance(me.ownerId, "packPoints")).toBeGreaterThanOrEqual(aegis.planPackPoints);
    for (const step of aegis.plan) for (let i = 0; i < step.copies; i++) await client.craftCard(token, step.cardId);
    const after = lockableView(await client.play(token), await client.collection(token))!;
    expect(after.find((v) => v.faction === "Aegis")!).toMatchObject({ buildable: true, cards: 20, short: 0 });
    expect(lockNote(after, "Aegis")?.tone).not.toBe("warn");
    // And the store now builds the Aegis deck: 20 cards.
    const built = await store.buildAgentDeck(me.ownerId, { games: 0 });
    expect(built.faction).toBe("Aegis");
    expect(built.deck.copyIds.length).toBe(20);
  });
});
