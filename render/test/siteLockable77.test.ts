// Render session 77: the faction lock on the server's own field. Game session
// 100 serves `GET /api/play`'s `lockable`; the site draws the marks from it at
// once, makes the craft plan from the collection only when that collection
// gives the server's own count (a stale one would plan from cards no longer
// held), and says whether the owner's pack points cover the plan.
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { getCard, largestDeck, SHIPPED_DECK_LISTS } from "@ai-tcg/engine";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { siteApi, type SiteFaction } from "../src/site/siteApi.js";
import type { SiteCollection } from "../src/site/siteBoard.js";
import { affordLine, holdingsFromCollection, lockNote, lockNoteHtml, lockableView, planText } from "../src/site/siteLockable.js";

const FACTIONS: SiteFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];

function collectionOf(held: Map<string, number>): SiteCollection {
  return {
    copies: [...held.values()].reduce((s, n) => s + n, 0),
    distinctCards: held.size,
    cards: [...held].map(([cardId, owned]) => ({ cardId, name: getCard(cardId)!.name, rarity: getCard(cardId)!.rarity, faction: null, owned, salvageable: owned, copies: [] })),
    sets: [],
    recentPulls: [],
  };
}
const starter = (f: SiteFaction) => new Map(SHIPPED_DECK_LISTS[f].map((e) => [e.cardId, e.copies]));
/** The server's field for these holdings, as the store computes it. */
const served = (held: Map<string, number>) => FACTIONS.map((faction) => { const cards = largestDeck(faction, held); return { faction, buildable: cards >= 20, cards, needed: 20 }; });

describe("the server's field and the collection in hand", () => {
  const held = starter("Swarm");

  it("they agree: the server's numbers, with a plan from the collection", () => {
    const views = lockableView({ lockableFactions: FACTIONS, lockable: served(held) }, collectionOf(held))!;
    for (const v of views) {
      expect(v.source).toBe("server");
      expect(v.stale).toBe(false);
    }
    const aegis = views.find((v) => v.faction === "Aegis")!;
    expect(aegis.plan.length).toBeGreaterThan(0);
    expect(aegis.planReaches).toBe(true);
  });

  it("they disagree (the collection read before a pack): the server's count, no plan from the stale cards", () => {
    const later = new Map(held);
    const aegisCadet = SHIPPED_DECK_LISTS.Aegis[0]!.cardId;
    later.set(aegisCadet, (later.get(aegisCadet) ?? 0) + 1);
    const views = lockableView({ lockableFactions: FACTIONS, lockable: served(later) }, collectionOf(held))!;
    const aegis = views.find((v) => v.faction === "Aegis")!;
    expect(aegis.cards).toBe(largestDeck("Aegis", later));
    expect(aegis.stale).toBe(true);
    expect(aegis.plan).toEqual([]);
    // The note still names the count and the gap, without a plan.
    const n = lockNote(views, "Aegis", 5000)!;
    expect(n.tone).toBe("warn");
    expect(n.text).toContain(`at most ${aegis.cards} of the 20`);
    expect(n.text).not.toContain("Cheapest");
    expect(n.text).not.toContain("You have");
    // A buildable faction is never stale-marked into a plan.
    expect(views.find((v) => v.faction === "Swarm")!.plan).toEqual([]);
  });

  it("the server's field with no collection yet: the marks at once, the plan later", () => {
    const views = lockableView({ lockableFactions: FACTIONS, lockable: served(held) }, null)!;
    expect(views.filter((v) => !v.buildable).map((v) => v.faction)).toEqual(["Cortex", "Aegis", "Null"]);
    expect(views.every((v) => v.plan.length === 0 && !v.stale)).toBe(true);
  });
});

describe("whether the pack points cover the plan", () => {
  const views = lockableView({ lockableFactions: FACTIONS }, collectionOf(starter("Swarm")))!;
  const aegis = views.find((v) => v.faction === "Aegis")!;

  it("enough, short, exactly enough, and nothing said without a wallet or a plan", () => {
    const cost = aegis.planPackPoints;
    expect(cost).toBeGreaterThan(0);
    expect(affordLine(aegis, cost + 1000)).toBe(`You have ${(cost + 1000).toLocaleString("en-US")} pack points, enough for all of it.`);
    expect(affordLine(aegis, cost)).toBe(`You have ${cost.toLocaleString("en-US")} pack points, enough for all of it.`);
    expect(affordLine(aegis, 120)).toBe(`You have 120 pack points, ${(cost - 120).toLocaleString("en-US")} short.`);
    expect(affordLine(aegis, 1)).toBe(`You have 1 pack point, ${(cost - 1).toLocaleString("en-US")} short.`);
    expect(affordLine(aegis, null)).toBe("");
    expect(affordLine(aegis, undefined)).toBe("");
    expect(affordLine({ ...aegis, plan: [], planPackPoints: 0 }, 900)).toBe("");
  });

  it("in the warning, after the plan and before the way out", () => {
    const n = lockNote(views, "Aegis", 50)!;
    expect(n.text).toContain(`${planText(aegis)}. You have 50 pack points, ${aegis.planPackPoints - 50} short. Or lock another faction.`);
    expect(lockNoteHtml(views, "Aegis", 50)).toContain("short. Or lock another faction.");
    // The quiet line (lock buildable) never carries it.
    expect(lockNote(views, "Swarm", 50)!.text).not.toContain("You have");
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

describe("the real owner API serves `lockable`", () => {
  it("the server's field equals the site's own reading; a pack opened after the read makes it stale until read again", async () => {
    const store = EconomyStore.open(":memory:");
    const me = store.createAccount({ name: "ada", username: "ada", password: PW });
    store.grantStarterCollection(me.ownerId, "Swarm");
    store.createAgent({ ownerId: me.ownerId, name: "Vector" });
    for (let i = 0; i < 12; i++) store.grantPack(me.ownerId, "S0", "weeklyChallenge");
    store.openPacks(me.ownerId, 10, { seeds: Array.from({ length: 10 }, (_, i) => i) });
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const { token } = await client.signIn("ada", PW);

    const play = await client.play(token);
    expect(play.lockable?.length).toBe(play.lockableFactions.length);
    const collection = await client.collection(token);
    const own = lockableView({ lockableFactions: play.lockableFactions }, collection)!;
    const server = lockableView(play, collection)!;
    // The fallback and the field give the same answer, faction by faction.
    expect(server.map((v) => [v.faction, v.buildable, v.cards])).toEqual(own.map((v) => [v.faction, v.buildable, v.cards]));
    expect(server.every((v) => v.source === "server" && !v.stale)).toBe(true);

    // Open the two packs left after the collection was read: the server's
    // count moves for a faction the packs added to; the old collection is
    // stale for it, and gives no plan.
    await client.openPacks(token, { count: 1 });
    await client.openPacks(token, { count: 1 });
    const play2 = await client.play(token);
    const moved = play2.lockable!.filter((s) => s.cards !== play.lockable!.find((x) => x.faction === s.faction)!.cards);
    expect(moved.length).toBeGreaterThan(0);
    const staleViews = lockableView(play2, collection)!;
    for (const s of moved) expect(staleViews.find((v) => v.faction === s.faction)!.stale).toBe(true);
    expect(staleViews.filter((v) => v.stale).every((v) => v.plan.length === 0)).toBe(true);
    // Read again: fresh, and the plan is made from the cards held now.
    const fresh = lockableView(play2, await client.collection(token))!;
    expect(fresh.every((v) => !v.stale)).toBe(true);
    for (const v of fresh.filter((x) => !x.buildable)) expect(v.planSize).toBeGreaterThan(v.cards);
    // The note's pack points are the wallet's.
    const wallet = await client.wallet(token);
    const short = fresh.find((v) => !v.buildable);
    if (short) expect(affordLine(short, wallet.packPoints)).toMatch(/^You have [\d,]+ pack points?, /);
    expect(holdingsFromCollection(await client.collection(token)).size).toBeGreaterThan(0);
  });
});
