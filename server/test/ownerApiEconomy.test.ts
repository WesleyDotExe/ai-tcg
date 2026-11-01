// The owner API's board and economy endpoints (session 64; owner
// 2026-11-01: "the economy endpoints come with the board layout, before
// match running"): the saved Home board, the collection and binder, salvage
// and crafting, the ledger, buying and opening packs, the store, cosmetics
// and loadouts, and today's earnings. Real HTTP against a real port, over an
// in-memory store, like ownerApiAccount.test.ts.

import { afterEach, describe, expect, it } from "vitest";
import { getCard, SHIPPED_DECK_LISTS } from "@ai-tcg/engine";
import { EconomyStore, PACK_PRICE_CREDITS, RECOMMENDED_LAYOUT, STARTER_PACKS } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../src/ownerApi.js";

const PW = "correct horse battery";
const DAY1 = "2026-11-01T10:00:00.000Z"; // 21:00 in Sydney
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const api of running.splice(0)) await api.close();
});

async function setup() {
  let clock = new Date(DAY1);
  const store = EconomyStore.open(":memory:", { now: () => clock });
  const ada = store.createAccount({ name: "Ada Lovecode", username: "ada", password: PW });
  store.grantStarterCollection(ada.ownerId, "Swarm");
  const adaAgent = store.createAgent({ ownerId: ada.ownerId, name: "Ada-1" });
  const bob = store.createAccount({ name: "Bob", username: "bob", password: PW });
  const bobAgent = store.createAgent({ ownerId: bob.ownerId, name: "Bob-1" });
  const api = await startOwnerApi({ store, port: 0 });
  running.push(api);
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await fetch(`http://localhost:${api.port}${path}`, {
      method,
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    return { status: res.status, body: text === "" ? null : JSON.parse(text), headers: res.headers };
  };
  const signIn = async (login: string) => (await call("POST", "/api/session", { body: { login, password: PW } })).body.token as string;
  let m = 0;
  /** Ada wins `n` matches at `at` (or now). */
  const adaWins = (n: number, at = clock.toISOString()) => {
    for (let i = 0; i < n; i++) {
      store.recordMatch({ matchId: `m${++m}`, seed: m, p1AgentId: adaAgent.agentId, p2AgentId: bobAgent.agentId, outcome: { kind: "win", winnerAgentId: adaAgent.agentId }, endedAt: at });
    }
  };
  /** Gives Ada `days` x 30 credits: one first win a day on earlier days. */
  const earn = (days: number) => {
    for (let d = 1; d <= days; d++) adaWins(1, new Date(Date.parse(DAY1) - d * 86_400_000).toISOString());
  };
  return { store, ada, adaAgent, bob, bobAgent, call, signIn, adaWins, earn, setClock: (iso: string) => (clock = new Date(iso)) };
}

const ENDPOINTS: [string, string, unknown?][] = [
  ["GET", "/api/board"],
  ["PUT", "/api/board", { widgets: [] }],
  ["GET", "/api/daily"],
  ["GET", "/api/ledger"],
  ["GET", "/api/collection"],
  ["GET", "/api/collection/binder/S0"],
  ["GET", "/api/collection/cards/x"],
  ["GET", "/api/collection/cards/x/salvage?quantity=1"],
  ["POST", "/api/collection/cards/x/salvage", { quantity: 1 }],
  ["POST", "/api/collection/cards/x/craft"],
  ["POST", "/api/collection/secrets/x/craft"],
  ["GET", "/api/packs"],
  ["POST", "/api/packs/buy", { setCode: "S0" }],
  ["POST", "/api/packs/open", {}],
  ["GET", "/api/packs/x/opening"],
  ["GET", "/api/packs/daily"],
  ["POST", "/api/packs/daily/claim"],
  ["GET", "/api/store"],
  ["POST", "/api/store/cosmetics/x/buy"],
  ["GET", "/api/cosmetics"],
  ["GET", "/api/agents/x/loadout"],
  ["PUT", "/api/agents/x/loadout/boast", { itemId: null }],
  ["GET", "/api/ladder"],
  ["GET", "/api/rating"],
];

describe("owner API: every board and economy endpoint needs a live session", () => {
  it("answers 401 with no token or a made-up one, and changes nothing", async () => {
    const { call, store, ada } = await setup();
    const before = JSON.stringify([store.wallet(ada.ownerId), store.collection(ada.ownerId).length]);
    for (const [method, path, body] of ENDPOINTS) {
      for (const token of [undefined, "made-up"]) {
        const res = await call(method, path, { token, body });
        expect([method, path, res.status, res.body]).toEqual([method, path, 401, { error: "not signed in" }]);
      }
    }
    expect(JSON.stringify([store.wallet(ada.ownerId), store.collection(ada.ownerId).length])).toBe(before);
  });
});

describe("owner API: the saved Home board", () => {
  it("reads the recommended layout with the rules, saves a board and reads it back", async () => {
    const { call, signIn, setClock } = await setup();
    const token = await signIn("ada");
    const first = await call("GET", "/api/board", { token });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ widgets: RECOMMENDED_LAYOUT, recommended: true, updatedAt: null });
    expect(first.body.rules.maxWidgets).toBe(13);
    expect(first.body.rules.sizes).toEqual(["S", "M", "L"]);
    expect(first.body.rules.widgetTypes).toContainEqual({ type: "watch", limit: 2 });
    expect(first.body.rules.widgetTypes).toHaveLength(12);
    expect(first.body.rules.widgetTypes.map((t: { type: string }) => t.type)).not.toContain("tournament");
    setClock("2026-11-01T10:30:00.000Z");
    const widgets = [
      { id: "w1", type: "daily", size: "L" },
      { id: "w2", type: "agent", size: "S" },
    ];
    const put = await call("PUT", "/api/board", { token, body: { widgets } });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ widgets, recommended: false, updatedAt: "2026-11-01T10:30:00.000Z" });
    expect((await call("GET", "/api/board", { token })).body.widgets).toEqual(widgets);
    // Bob's board is his own.
    expect((await call("GET", "/api/board", { token: await signIn("bob") })).body.recommended).toBe(true);
  });

  it("refuses a bad board with 400 and the reason, saving nothing", async () => {
    const { call, signIn } = await setup();
    const token = await signIn("ada");
    await call("PUT", "/api/board", { token, body: { widgets: [{ id: "w1", type: "packs", size: "M" }] } });
    for (const [body, message] of [
      [{ widgets: [{ id: "w1", type: "tournament", size: "M" }] }, /comes after Season 0/],
      [{ widgets: [{ id: "w1", type: "packs", size: "XL" }] }, /S, M or L/],
      [{ widgets: [{ id: "a", type: "agent", size: "M" }, { id: "b", type: "agent", size: "M" }] }, /one "agent" widget/],
      [{}, /"widgets" must be a list/],
      [{ widgets: [], extra: 1 }, /unknown field "extra"/],
    ] as const) {
      const res = await call("PUT", "/api/board", { token, body });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(message);
    }
    expect((await call("GET", "/api/board", { token })).body.widgets).toEqual([{ id: "w1", type: "packs", size: "M" }]);
    expect((await call("POST", "/api/board", { token })).headers.get("allow")).toBe("GET, PUT");
  });
});

describe("owner API: today's earnings and the ledger", () => {
  it("reads the Sydney day, the schedule and the wins, and the ledger newest first", async () => {
    const { call, signIn, adaWins } = await setup();
    const token = await signIn("ada");
    adaWins(1, "2026-10-31T12:59:00.000Z"); // 23:59 on 31 Oct in Sydney: yesterday
    adaWins(3);
    const daily = await call("GET", "/api/daily", { token });
    expect(daily.status).toBe(200);
    expect(daily.body).toMatchObject({
      day: "2026-11-01",
      timeZone: "Australia/Sydney",
      startedAt: "2026-10-31T13:00:00.000Z",
      resetsAt: "2026-11-01T13:00:00.000Z",
      creditsFromWins: 50,
      nextWinPays: 10,
      nextLossPays: 2,
    });
    expect(daily.body.rewardedWins.map((w: { credits: number }) => w.credits)).toEqual([30, 10, 10]);
    const page = await call("GET", "/api/ledger?limit=2", { token });
    expect(page.status).toBe(200);
    expect(page.body.entries.map((e: { delta: number }) => e.delta)).toEqual([10, 10]);
    expect(page.body.more).toBe(true);
    expect(page.body.wallet.credits).toBe(80);
    const older = await call("GET", `/api/ledger?limit=50&before=${page.body.entries[1].entryId}`, { token });
    expect(older.body.entries.map((e: { delta: number; reason: string }) => [e.reason, e.delta])).toEqual([
      ["matchWin", 30],
      ["matchWin", 30],
    ]);
    expect(older.body.more).toBe(false);
    for (const q of ["limit=0", "limit=501", "limit=two", "limit=1.5", "before=0"]) {
      const bad = await call("GET", `/api/ledger?${q}`, { token });
      expect([q, bad.status]).toEqual([q, 400]);
    }
  });
});

describe("owner API: buying and opening packs", () => {
  it("buys packs with credits, all or none, and opens one, a chosen one, or ten", async () => {
    const { call, signIn, earn, store, ada } = await setup();
    const token = await signIn("ada");
    const start = await call("GET", "/api/packs", { token });
    expect(start.body).toMatchObject({ offer: [{ setCode: "S0", priceCredits: PACK_PRICE_CREDITS }], bulkOpenCount: 10 });
    expect(start.body.unopened).toHaveLength(STARTER_PACKS);
    expect(start.body.pity.next).toEqual({ fullArt: false, mythic: false });
    // 0 credits: refused, nothing bought.
    const broke = await call("POST", "/api/packs/buy", { token, body: { setCode: "S0" } });
    expect([broke.status, broke.body.error]).toEqual([409, "1 pack(s) cost 100 credits; the owner has 0"]);
    earn(9); // 270 credits
    const two = await call("POST", "/api/packs/buy", { token, body: { setCode: "S0", count: 2 } });
    expect(two.status).toBe(201);
    expect(two.body.bought).toHaveLength(2);
    expect(two.body.wallet).toMatchObject({ credits: 70 });
    expect(two.body.wallet.unopenedPacks).toHaveLength(STARTER_PACKS + 2);
    for (const [body, status] of [
      [{ setCode: "S0", count: 11 }, 400],
      [{ setCode: "S0", count: 0 }, 400],
      [{ setCode: "S0", count: "2" }, 400],
      [{ count: 1 }, 400],
      [{ setCode: "S9" }, 404],
    ] as const) {
      expect((await call("POST", "/api/packs/buy", { token, body })).status).toBe(status);
    }
    // Open the oldest.
    const one = await call("POST", "/api/packs/open", { token, body: {} });
    expect(one.status).toBe(200);
    expect(one.body.packs).toHaveLength(1);
    expect(one.body.summary).toBeNull();
    expect(one.body.packs[0].packId).toBe(start.body.unopened[0].packId);
    expect(one.body.packs[0].cards.length).toBeGreaterThan(0);
    for (const c of one.body.packs[0].cards) {
      expect(typeof c.isNew).toBe("boolean");
      expect(c.ownedAfter).toBeGreaterThanOrEqual(1);
    }
    expect(one.body.wallet.packPoints).toBe(5);
    // Open a chosen one (the newest).
    const chosen = two.body.bought[1].packId;
    const picked = await call("POST", "/api/packs/open", { token, body: { packId: chosen } });
    expect(picked.body.packs[0].packId).toBe(chosen);
    expect((await call("POST", "/api/packs/open", { token, body: { packId: chosen } })).status).toBe(404);
    expect((await call("POST", "/api/packs/open", { token, body: { packId: chosen, count: 10 } })).status).toBe(400);
    expect((await call("POST", "/api/packs/open", { token, body: { count: 3 } })).status).toBe(400);
    // Ten at once needs ten: 3 left, refused, nothing opened.
    const ten = await call("POST", "/api/packs/open", { token, body: { count: 10 } });
    expect([ten.status, ten.body.error]).toEqual([409, "only 3 unopened pack(s); can't open 10"]);
    expect(store.unopenedPacks(ada.ownerId)).toHaveLength(3);
    for (let i = 0; i < 7; i++) store.grantPack(ada.ownerId, "S0", "ownerDaily");
    const bulk = await call("POST", "/api/packs/open", { token, body: { count: 10 } });
    expect(bulk.status).toBe(200);
    expect(bulk.body.packs).toHaveLength(10);
    expect(bulk.body.summary.cards).toBe(bulk.body.packs.reduce((t: number, p: { cards: unknown[] }) => t + p.cards.length, 0));
    expect(bulk.body.wallet.unopenedPacks).toHaveLength(0);
    // The logged opening, seed and all, for the owner only.
    const log = await call("GET", `/api/packs/${chosen}/opening`, { token });
    expect(log.status).toBe(200);
    expect(log.body).toMatchObject({ packId: chosen, ownerId: ada.ownerId });
    expect(typeof log.body.seed).toBe("number");
    expect((await call("GET", `/api/packs/${chosen}/opening`, { token: await signIn("bob") })).status).toBe(404);
    expect((await call("GET", "/api/packs/nope/opening", { token })).status).toBe(404);
  });
});

describe("owner API: the collection, binder, salvage and crafting", () => {
  it("lists the collection by card with each copy, set completion and the recent pulls", async () => {
    const { call, signIn, store, ada } = await setup();
    const token = await signIn("ada");
    store.openPack(ada.ownerId, undefined, { seed: 7 });
    const res = await call("GET", "/api/collection", { token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(JSON.parse(JSON.stringify(store.collectionSummary(ada.ownerId))));
    expect(res.body.copies).toBe(store.collection(ada.ownerId).length);
    expect(res.body.recentPulls).toHaveLength(1);
    expect((await call("GET", "/api/collection?recentPacks=0", { token })).status).toBe(400);
    const binder = await call("GET", "/api/collection/binder/S0", { token });
    expect(binder.body.base.total).toBe(store.binder(ada.ownerId, "S0").base.total);
    expect((await call("GET", "/api/collection/binder/S9", { token })).status).toBe(404);
    // Bob sees his own (empty) collection, not Ada's.
    expect((await call("GET", "/api/collection", { token: await signIn("bob") })).body.copies).toBe(0);
  });

  it("salvages with a plan first, asks before leaving a deck short, and crafts with pack points", async () => {
    const { call, signIn, store, bob } = await setup();
    const token = await signIn("bob");
    // Bob's deck is the shipped Swarm list, built from pack copies so they
    // salvage, plus one spare copy of a 3-of Common.
    const swarm = SHIPPED_DECK_LISTS.Swarm;
    const common = swarm.find((e) => e.copies === 3 && getCard(e.cardId)?.rarity === "Common")!.cardId;
    const copies = swarm.flatMap((e) => Array.from({ length: e.copies }, () => store.grantCopy({ ownerId: bob.ownerId, cardId: e.cardId, origin: "pack" }).copyId));
    const deck = store.saveDeck(bob.ownerId, "main", copies);
    store.grantCopy({ ownerId: bob.ownerId, cardId: common, origin: "pack" });

    const holdings = await call("GET", `/api/collection/cards/${common}`, { token });
    expect(holdings.body).toMatchObject({ cardId: common, owned: 4, salvageable: 4, packPointsEach: 5 });
    expect(holdings.body.decks).toEqual([{ deckId: deck.deckId, name: "main", uses: 3, active: false }]);
    expect((await call("GET", "/api/collection/cards/not-a-card", { token })).status).toBe(404);

    // The plan: one goes freely, two would leave the deck short.
    const plan1 = await call("GET", `/api/collection/cards/${common}/salvage?quantity=1`, { token });
    expect(plan1.body).toMatchObject({ quantity: 1, packPoints: 5, ownedAfter: 3, affectedDecks: [] });
    const plan3 = await call("GET", `/api/collection/cards/${common}/salvage?quantity=3`, { token });
    expect(plan3.body.affectedDecks).toEqual([{ deckId: deck.deckId, name: "main", uses: 3, owned: 1, active: false }]);
    expect((await call("GET", `/api/collection/cards/${common}/salvage`, { token })).status).toBe(400);
    expect((await call("GET", `/api/collection/cards/${common}/salvage?quantity=5`, { token })).status).toBe(409);
    for (const q of ["0", "x", "1.5"]) expect((await call("GET", `/api/collection/cards/${common}/salvage?quantity=${q}`, { token })).status).toBe(400);

    const one = await call("POST", `/api/collection/cards/${common}/salvage`, { token, body: { quantity: 1 } });
    expect(one.status).toBe(200);
    expect(one.body).toMatchObject({ packPoints: 5, incompleteDecks: [], holdings: { owned: 3 }, wallet: { packPoints: 5 } });
    // Two more: 409 with the decks, and nothing salvaged until confirmed.
    const ask = await call("POST", `/api/collection/cards/${common}/salvage`, { token, body: { quantity: 2 } });
    expect(ask.status).toBe(409);
    expect(ask.body).toMatchObject({ needsConfirmation: true, affectedDecks: [{ deckId: deck.deckId, uses: 3, owned: 1 }] });
    expect(ask.body.error).toMatch(/Confirm to salvage anyway/);
    expect(store.cardHoldings(bob.ownerId, common).owned).toBe(3);
    const yes = await call("POST", `/api/collection/cards/${common}/salvage`, { token, body: { quantity: 2, confirmDeckImpact: true } });
    expect(yes.status).toBe(200);
    expect(yes.body).toMatchObject({ packPoints: 10, holdings: { owned: 1 }, wallet: { packPoints: 15 } });
    expect(yes.body.incompleteDecks).toHaveLength(1);
    expect(store.deckStatus(deck.deckId).complete).toBe(false);
    for (const body of [{}, { quantity: 0 }, { quantity: "1" }, { quantity: 1, confirmDeckImpact: "yes" }]) {
      expect((await call("POST", `/api/collection/cards/${common}/salvage`, { token, body })).status).toBe(400);
    }

    // Crafting a Common costs 40: refused at 15, made once Bob has 40.
    const poor = await call("POST", `/api/collection/cards/${common}/craft`, { token });
    expect([poor.status, poor.body.error]).toEqual([409, expect.stringMatching(/costs 40 pack points; you have 15/)]);
    for (const e of swarm.filter((x) => x.cardId !== common && getCard(x.cardId)?.rarity === "Common").slice(0, 2)) {
      for (let i = 0; i < 3; i++) store.grantCopy({ ownerId: bob.ownerId, cardId: e.cardId, origin: "pack" });
      store.salvage(bob.ownerId, e.cardId, 3);
    }
    expect(store.balance(bob.ownerId, "packPoints")).toBe(45);
    const craft = await call("POST", `/api/collection/cards/${common}/craft`, { token });
    expect(craft.status).toBe(201);
    expect(craft.body.copy).toMatchObject({ cardId: common, origin: "crafted", accountBound: true });
    expect(craft.body).toMatchObject({ holdings: { owned: 2 }, wallet: { packPoints: 5 } });
    expect((await call("POST", "/api/collection/cards/not-a-card/craft", { token })).status).toBe(409);
    // A secret card costs 750: refused with the reason; an unknown one is 404.
    const secret = store.binder(bob.ownerId, "S0").secrets.entries.find((e) => e.kind === "illustration")!;
    const secretRes = await call("POST", `/api/collection/secrets/${secret.secretCode}/craft`, { token });
    expect([secretRes.status, secretRes.body.error]).toEqual([409, expect.stringMatching(/costs 750 pack points/)]);
    expect((await call("POST", "/api/collection/secrets/S0-NOPE/craft", { token })).status).toBe(404);
  });
});

describe("owner API: the store, cosmetics and loadouts", () => {
  it("lists what's on sale, buys a boast with credits and equips it", async () => {
    const { call, signIn, earn, adaAgent, bobAgent, store, ada } = await setup();
    const token = await signIn("ada");
    const shop = await call("GET", "/api/store", { token });
    expect(shop.status).toBe(200);
    expect(shop.body.packs).toEqual([{ setCode: "S0", name: expect.any(String), priceCredits: PACK_PRICE_CREDITS }]);
    const boots = shop.body.cosmetics.find((c: { itemId: string }) => c.itemId === "boast-s0-boot-sequence");
    expect(boots).toMatchObject({ priceCredits: 300, owned: false });
    const poor = await call("POST", "/api/store/cosmetics/boast-s0-boot-sequence/buy", { token });
    expect([poor.status, poor.body.error]).toEqual([409, `"Boot Sequence" costs 300 credits; the owner has 0`]);
    earn(10); // 300
    const bought = await call("POST", "/api/store/cosmetics/boast-s0-boot-sequence/buy", { token });
    expect(bought.status).toBe(201);
    expect(bought.body.cosmetic).toMatchObject({ itemId: "boast-s0-boot-sequence", source: "purchase" });
    expect(bought.body.wallet.credits).toBe(0);
    expect((await call("POST", "/api/store/cosmetics/boast-s0-boot-sequence/buy", { token })).status).toBe(409);
    expect((await call("POST", "/api/store/cosmetics/no-such-thing/buy", { token })).status).toBe(404);
    const after = await call("GET", "/api/store", { token });
    expect(after.body.cosmetics.find((c: { itemId: string }) => c.itemId === "boast-s0-boot-sequence").owned).toBe(true);
    const owned = await call("GET", "/api/cosmetics", { token });
    expect(owned.body.owned.map((c: { itemId: string }) => c.itemId)).toContain("boast-s0-boot-sequence");
    // The loadout: the starter boast is on; equip the bought one, then empty the slot.
    const lo = await call("GET", `/api/agents/${adaAgent.agentId}/loadout`, { token });
    expect(lo.status).toBe(200);
    expect(lo.body.loadout.boast).toBe("boast-swarm-hive-burst");
    const boastSlot = lo.body.slots.find((x: { slot: string }) => x.slot === "boast");
    expect(boastSlot.choices).toEqual(expect.arrayContaining(["boast-swarm-hive-burst", "boast-s0-boot-sequence"]));
    expect(lo.body.locked).toBe(false);
    const set = await call("PUT", `/api/agents/${adaAgent.agentId}/loadout/boast`, { token, body: { itemId: "boast-s0-boot-sequence" } });
    expect(set.status).toBe(200);
    expect(set.body.loadout.boast).toBe("boast-s0-boot-sequence");
    expect(store.loadout(adaAgent.agentId).boast).toBe("boast-s0-boot-sequence");
    const close = await call("PUT", `/api/agents/${adaAgent.agentId}/loadout/closeWinBoast`, { token, body: { itemId: null } });
    expect(close.body.loadout.closeWinBoast).toBeNull();
    // Refusals: a boast in the card-back slot, an unowned item, a bad slot, a bad body, another owner's agent.
    expect((await call("PUT", `/api/agents/${adaAgent.agentId}/loadout/cardBack`, { token, body: { itemId: "boast-s0-boot-sequence" } })).status).toBe(409);
    expect((await call("PUT", `/api/agents/${adaAgent.agentId}/loadout/boast`, { token, body: { itemId: "boast-s0-dial-up-fireworks" } })).status).toBe(409);
    expect((await call("PUT", `/api/agents/${adaAgent.agentId}/loadout/hat`, { token, body: { itemId: null } })).status).toBe(404);
    expect((await call("PUT", `/api/agents/${adaAgent.agentId}/loadout/boast`, { token, body: {} })).status).toBe(400);
    expect((await call("PUT", `/api/agents/${adaAgent.agentId}/loadout/boast`, { token, body: { itemId: 5 } })).status).toBe(400);
    expect((await call("GET", `/api/agents/${bobAgent.agentId}/loadout`, { token })).status).toBe(404);
    expect((await call("PUT", `/api/agents/${bobAgent.agentId}/loadout/boast`, { token, body: { itemId: null } })).status).toBe(404);
    expect(store.ownedCosmetics(ada.ownerId).length).toBeGreaterThan(0);
  });
});

describe("owner API: the owner's daily pack (session 65)", () => {
  it("reads the bank, claims one, refuses a second, and refills at Sydney midnight", async () => {
    const { call, signIn, store, ada, setClock } = await setup();
    const token = await signIn("ada");
    const unopened = store.unopenedPacks(ada.ownerId).length;

    const status = await call("GET", "/api/packs/daily", { token });
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ setCode: "S0", waiting: 1, cap: 2, day: "2026-11-01", resetsAt: "2026-11-01T13:00:00.000Z", claimedToday: 0 });
    // The Packs and Store widgets get it with what they already read.
    expect((await call("GET", "/api/packs", { token })).body.dailyPack).toEqual(status.body);
    expect((await call("GET", "/api/store", { token })).body.dailyPack).toEqual(status.body);

    const claimed = await call("POST", "/api/packs/daily/claim", { token });
    expect(claimed.status).toBe(201);
    expect(claimed.body.pack).toMatchObject({ ownerId: ada.ownerId, setCode: "S0", source: "ownerDaily", openedAt: null });
    expect(claimed.body.dailyPack).toMatchObject({ waiting: 0, claimedToday: 1, nextPackAt: "2026-11-01T13:00:00.000Z" });
    expect(claimed.body.wallet.unopenedPacks).toHaveLength(unopened + 1);

    const again = await call("POST", "/api/packs/daily/claim", { token });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/no daily pack to claim; the next one comes in at 2026-11-01T13:00:00.000Z/);
    expect(store.unopenedPacks(ada.ownerId)).toHaveLength(unopened + 1);

    // The claimed pack opens like any other.
    const opened = await call("POST", "/api/packs/open", { token, body: { packId: claimed.body.pack.packId } });
    expect(opened.status).toBe(200);
    expect(opened.body.packs[0].packId).toBe(claimed.body.pack.packId);

    setClock("2026-11-01T13:00:00.000Z");
    expect((await call("GET", "/api/packs/daily", { token })).body).toMatchObject({ day: "2026-11-02", waiting: 1 });
  });

  it("is the signed-in owner's own: bob's claim leaves ada's bank alone", async () => {
    const { call, signIn } = await setup();
    const bobToken = await signIn("bob");
    const adaToken = await signIn("ada");
    expect((await call("POST", "/api/packs/daily/claim", { token: bobToken })).status).toBe(201);
    expect((await call("GET", "/api/packs/daily", { token: bobToken })).body.waiting).toBe(0);
    expect((await call("GET", "/api/packs/daily", { token: adaToken })).body.waiting).toBe(1);
  });
});

describe("owner API: the ladder and the owner's rating (session 66)", () => {
  it("answers the standings with you in them, the tiers, and the owner's rating and form", async () => {
    const { call, signIn, adaWins, ada, bob, store } = await setup();
    const ada1 = await signIn("ada");
    // Before any rated match: an empty list, and you at the start.
    let res = await call("GET", "/api/ladder", { token: ada1 });
    expect(res.status).toBe(200);
    expect(res.body.standings).toEqual([]);
    expect(res.body.you).toMatchObject({ rank: null, ownerId: ada.ownerId, ownerName: "Ada Lovecode", rating: 1500, rd: 350, tier: "Placement", ratedMatches: 0 });
    expect(res.body.tiers[0]).toEqual({ tier: "Bronze", from: null });
    expect(res.body.tiers.map((t: { tier: string }) => t.tier)).toEqual(["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"]);
    expect(res.body.placementMatches).toBe(5);
    adaWins(5);
    res = await call("GET", "/api/ladder", { token: ada1 });
    expect(res.body.owners).toBe(2);
    expect(res.body.standings.map((r: { ownerId: string; rank: number }) => [r.ownerId, r.rank])).toEqual([
      [ada.ownerId, 1],
      [bob.ownerId, 2],
    ]);
    expect(res.body.you).toEqual(res.body.standings[0]);
    expect(res.body.you).toMatchObject({ wins: 5, losses: 0, ratedMatches: 5, agent: null }); // no agent connected in this setup
    expect(res.body.you.tier).not.toBe("Placement");
    // Bob's view: limit 1 leaves Bob off the list but still answers him.
    const bob1 = await signIn("bob");
    res = await call("GET", "/api/ladder?limit=1", { token: bob1 });
    expect(res.body.standings.map((r: { ownerId: string }) => r.ownerId)).toEqual([ada.ownerId]);
    expect(res.body.you).toMatchObject({ ownerId: bob.ownerId, rank: 2, losses: 5 });
    expect((await call("GET", "/api/ladder?limit=0", { token: bob1 })).status).toBe(400);
    expect((await call("GET", "/api/ladder?limit=101", { token: bob1 })).status).toBe(400);
    // The rating and its form, newest first.
    res = await call("GET", "/api/rating?recent=3", { token: ada1 });
    expect(res.status).toBe(200);
    expect(res.body.rating).toMatchObject({ ownerId: ada.ownerId, ratedMatches: 5 });
    expect(res.body.rating.rating).toBeCloseTo(store.rating(ada.ownerId).rating, 9);
    expect(res.body.recent).toHaveLength(3);
    expect(res.body.recent.map((r: { matchId: string }) => r.matchId)).toEqual(["m5", "m4", "m3"]);
    expect(res.body.recent[0]).toMatchObject({ score: 1, opponentOwnerId: bob.ownerId });
    expect(res.body.recent[0].before.rating).toBeCloseTo(res.body.recent[1].after.rating, 9);
    expect((await call("GET", "/api/rating?recent=0", { token: ada1 })).status).toBe(400);
  });
});
