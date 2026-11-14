// (session 100; owner 2026-11-14, answer (a) to game 99's call) `GET
// /api/play`'s `lockable`: each lockable faction, buildable now or not,
// with the cards held and needed. Packs hold only booster cards, so an
// owner can lock a faction they hold too few cards of; the ladder then sits
// their agent out. These tests pin, over real HTTP, that the field is the
// store's own rule (the one `buildAgentDeck` checks a deck against), that a
// rebuild fails exactly when it says "not buildable", and that crafting the
// missing cards turns it buildable and the rebuild then builds that many.

import { afterEach, describe, expect, it } from "vitest";
import { getCard, holdingsOf, largestDeck, MIN_DECK_SIZE, SHIPPED_DECK_LISTS } from "@ai-tcg/engine";
import { CRAFT_PACK_POINTS, EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../src/ownerApi.js";

const PW = "correct horse battery";
const open: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const api of open.splice(0)) {
    await api.idle();
    await api.close();
  }
});

async function setup() {
  const store = EconomyStore.open(":memory:");
  const owner = store.createAccount({ name: "ada", username: "ada", password: PW });
  store.grantStarterCollection(owner.ownerId, "Swarm");
  const agent = store.createAgent({ ownerId: owner.ownerId, name: "ada-agent" });
  store.connectAgent(owner.ownerId, agent.agentId);
  const api = await startOwnerApi({ port: 0, store, build: { games: 0 } });
  open.push(api);
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await fetch(`http://localhost:${api.port}${path}`, {
      method,
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    return { status: res.status, body: text === "" ? null : JSON.parse(text) };
  };
  const token = (await call("POST", "/api/session", { body: { login: "ada", password: PW } })).body.token as string;
  const job = async () => {
    await api.idle();
    return (await call("GET", "/api/play/rebuild", { token })).body.job;
  };
  /** What the engine's rule says from the owner's cards, read from the store. */
  const expected = () => {
    const holdings = holdingsOf(store.collection(owner.ownerId).map((c) => c.cardId));
    return (["Cortex", "Swarm", "Aegis", "Null"] as const).map((faction) => {
      const cards = largestDeck(faction, holdings);
      return { faction, buildable: cards >= MIN_DECK_SIZE, cards, needed: MIN_DECK_SIZE };
    });
  };
  return { store, ownerId: owner.ownerId, call, token, job, expected };
}

describe("owner API: the lockable factions (buildable or not)", () => {
  it("lists each lockable faction once, in lockableFactions' order, by the engine's rule on the cards held", async () => {
    const { call, token, expected } = await setup();
    const play = (await call("GET", "/api/play", { token })).body;
    expect(play.lockable.map((x: { faction: string }) => x.faction)).toEqual(play.lockableFactions);
    expect(play.lockable).toEqual(expected());
    const by = Object.fromEntries(play.lockable.map((x: { faction: string }) => [x.faction, x]));
    // Ada holds the Swarm starter only: Swarm builds, Aegis (no Aegis card held) doesn't.
    expect(by.Swarm.buildable).toBe(true);
    expect(by.Swarm.cards).toBeGreaterThanOrEqual(MIN_DECK_SIZE);
    expect(by.Aegis.buildable).toBe(false);
    expect(by.Aegis.cards).toBeLessThan(MIN_DECK_SIZE);
    expect(by.Aegis.needed).toBe(20);
  });

  it("the faction-lock answer carries it too, and a lock on a faction marked not buildable fails its rebuild", async () => {
    const { call, token, job, expected } = await setup();
    const locked = await call("PUT", "/api/play/faction-lock", { token, body: { faction: "Aegis" } });
    expect(locked.status).toBe(200);
    expect(locked.body.lockable).toEqual(expected());
    await call("POST", "/api/play/rebuild", { token });
    const failed = await job();
    expect(failed.state).toBe("failed");
    expect(failed.error).toMatch(/no deck can be built|under 20/);
  });

  it("crafting the Aegis starter's cards raises the count by the rule, turns it buildable, and the rebuild then builds that many", { timeout: 60_000 }, async () => {
    const { store, ownerId, call, token, job, expected } = await setup();
    store.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${ownerId}', 'packPoints', 100000, 'testGrant', '${new Date().toISOString()}')`);
    await call("PUT", "/api/play/faction-lock", { token, body: { faction: "Aegis" } });
    const aegis = async () => (await call("GET", "/api/play", { token })).body.lockable.find((x: { faction: string }) => x.faction === "Aegis");

    let last = await aegis();
    let flippedAt: number | null = null;
    let crafts = 0;
    for (const { cardId, copies } of SHIPPED_DECK_LISTS.Aegis) {
      for (let i = 0; i < copies; i++) {
        const res = await call("POST", `/api/collection/cards/${cardId}/craft`, { token });
        expect(res.status, `${getCard(cardId)!.name}: ${JSON.stringify(res.body)}`).toBe(201);
        crafts++;
        const now = await aegis();
        expect(now.cards).toBeGreaterThanOrEqual(last.cards);
        expect(now.buildable).toBe(now.cards >= 20);
        if (now.buildable && flippedAt === null) flippedAt = crafts;
        last = now;
      }
    }
    expect(flippedAt).not.toBeNull();
    expect((await call("GET", "/api/play", { token })).body.lockable).toEqual(expected());
    expect(CRAFT_PACK_POINTS.Common).toBeGreaterThan(0);

    await call("POST", "/api/play/rebuild", { token });
    const done = await job();
    expect(done.state, done.error ?? "").toBe("done");
    expect(done.result.faction).toBe("Aegis");
    expect(done.result.cards).toBe(last.cards);
  });
});
