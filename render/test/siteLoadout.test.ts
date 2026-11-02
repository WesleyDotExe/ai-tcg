// The loadout picker in the Store (render session 49): the page's data built
// from the real owner API's answers, Equip and Buy through the real server,
// the server's refusals, and the page's site mode.

import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore, LOADOUT_SLOTS, SEASON_0_BOASTS, STARTER_BOASTS } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { loadoutAnswerApply, loadoutLockAction, loadoutPreview, loadoutSlotText, renderLoadoutHtml } from "../src/loadoutPicker.js";
import { SiteApiError, siteApi, type SitePlay } from "../src/site/siteApi.js";
import { startSiteHost, type RunningSiteHost } from "../src/site/siteHost.js";
import { agentLoadoutRows, deckFactionOf, loadoutPayload, previewCards, starterFactionOf } from "../src/site/siteLoadout.js";
import { renderSiteLoadoutPage, renderSitePage, siteScript } from "../src/site/sitePage.js";

const PW = "a long test password";
const running: (RunningOwnerApi | RunningSiteHost)[] = [];
afterEach(async () => {
  while (running.length) await running.pop()!.close();
});

/** An owner with the Swarm starter, two agents (the first connected, its
 * starter deck active), credits from real recorded wins, and a second
 * owner to play against. Over the site host, as the website talks to it. */
async function stack(opts: { wins?: number } = {}) {
  const store = EconomyStore.open(":memory:");
  const owner = store.createAccount({ name: "ada", username: "ada", password: PW });
  const { copies } = store.grantStarterCollection(owner.ownerId, "Swarm");
  const a1 = store.createAgent({ ownerId: owner.ownerId, name: "Lattice Wren" });
  const a2 = store.createAgent({ ownerId: owner.ownerId, name: "Mote Engine" });
  const deck = store.saveDeck(owner.ownerId, "Swarm starter", copies.map((c) => c.copyId));
  store.setActiveDeck(owner.ownerId, deck.deckId);
  store.connectAgent(owner.ownerId, a1.agentId);
  const foe = store.createAccount({ name: "bo", username: "boris", password: PW });
  const fc = store.grantStarterCollection(foe.ownerId, "Aegis").copies;
  const fa = store.createAgent({ ownerId: foe.ownerId, name: "Foe" });
  const fd = store.saveDeck(foe.ownerId, "Aegis starter", fc.map((c) => c.copyId));
  store.setActiveDeck(foe.ownerId, fd.deckId);
  store.connectAgent(foe.ownerId, fa.agentId);
  for (let i = 0; i < (opts.wins ?? 0); i++) {
    const endedAt = new Date(Date.parse("2026-10-01T10:00:00.000Z") + i * 86_400_000).toISOString();
    store.recordMatch({ matchId: `w-${i}`, seed: i, p1AgentId: a1.agentId, p2AgentId: fa.agentId, outcome: { kind: "win", winnerAgentId: a1.agentId }, endedAt });
  }
  const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
  running.push(api);
  const host = await startSiteHost({ api: `http://localhost:${api.port}`, port: 0 });
  running.push(host);
  const base = `http://127.0.0.1:${host.port}`;
  const client = siteApi((u, i) => fetch(u, i), base);
  const { token } = await client.signIn("ada", PW);
  const payloadFor = async (agentId: string) => {
    const [play, loadout, owned, shop, collection] = await Promise.all([client.play(token), client.loadout(token, agentId), client.cosmetics(token), client.store(token), client.collection(token)]);
    const agent = play.agents.find((x) => x.agentId === agentId)!;
    return { play, loadout, payload: loadoutPayload({ agent, loadout, owned: owned.owned, onSale: shop.cosmetics, play, collection, credits: shop.wallet.credits }) };
  };
  return { store, owner, foe, a1, a2, fa, deck, client, token, base, payloadFor };
}

describe("the picker's data, from the real owner API", () => {
  it("owned tiles are the server's choices; on-sale items the owner lacks are locked; the empty tile; the server's loadout", async () => {
    const { a1, payloadFor } = await stack();
    const { payload, loadout } = await payloadFor(a1.agentId);
    const sc = payload.scenario;
    expect(sc.slots.map((s) => s.slot)).toEqual([...LOADOUT_SLOTS]);
    expect(sc.loadout).toEqual(loadout.loadout);
    // The store equips the owner's starting faction's boast on a new agent.
    expect(sc.loadout.boast).toBe(STARTER_BOASTS.Swarm.itemId);
    const text = loadoutSlotText(5);
    for (const v of sc.slots) {
      const server = loadout.slots.find((s) => s.slot === v.slot)!;
      const owned = v.tiles.filter((t) => t.itemId !== null && t.owned).map((t) => t.itemId).sort();
      expect(owned).toEqual([...server.choices].sort());
      expect(v.tiles.at(-1)!.itemId).toBeNull();
      expect(v.label).toBe(text[v.slot].label);
    }
    const boast = sc.slots[0]!;
    // The four starters first (Aegis, Swarm, Null, Cortex), then the Season 0 boasts locked, then empty.
    expect(boast.tiles.map((t) => t.itemId)).toEqual([...["Aegis", "Swarm", "Null", "Cortex"].map((f) => STARTER_BOASTS[f as "Aegis"].itemId), ...SEASON_0_BOASTS.map((b) => b.itemId), null]);
    const locked = boast.tiles.filter((t) => !t.owned);
    expect(locked.map((t) => t.priceCredits)).toEqual(SEASON_0_BOASTS.map((b) => b.priceCredits));
    expect(locked.every((t) => t.description.length > 0 && t.season === "S0")).toBe(true);
    expect(boast.tiles.filter((t) => t.owned && t.itemId).every((t) => t.source === "starter")).toBe(true);
    // Card back, avatar, arena: nothing exists yet, so only the empty tile.
    for (const v of sc.slots.slice(2)) expect(v.tiles).toHaveLength(1);
    expect(payload.starters).toEqual(Object.fromEntries(Object.entries(STARTER_BOASTS).map(([f, b]) => [f, b.itemId])));
    expect(sc.live).toBeNull();
  });

  it("the deck's faction: unknown without a build or a lock (said, not guessed); the lock names it, and an empty boast then plays its starter", async () => {
    const { a1, client, token, payloadFor } = await stack();
    let { payload } = await payloadFor(a1.agentId);
    expect(payload.scenario.agent.deckFaction).toBeNull();
    // The preview row still wears the owner's starting faction's colours.
    expect(payload.scenario.agent.rowFaction).toBe("Swarm");
    expect(loadoutPreview({ ...payload.scenario.loadout, boast: null }, "boast", null, payload.starters)).toBeNull();
    expect(payload.scenario.slots[0]!.tiles.at(-1)!.description).toContain("no deck is built yet");
    await client.setFactionLock(token, "Null");
    ({ payload } = await payloadFor(a1.agentId));
    expect(payload.scenario.agent.deckFaction).toBe("Null");
    expect(payload.scenario.slots[0]!.tiles.at(-1)!.description).toContain(`Null: ${STARTER_BOASTS.Null.name}`);
    expect(loadoutPreview({ ...payload.scenario.loadout, boast: null }, "boast", "Null", payload.starters)).toEqual({ id: STARTER_BOASTS.Null.itemId, close: false });
  });

  it("deckFactionOf: the latest build's faction only when it is the deck the agent plays; else the lock", () => {
    const base = { activeDeck: { deckId: "d1" }, factionLock: null, rebuild: { reasons: [], job: { result: { deckId: "d1", faction: "Cortex" } } } } as unknown as SitePlay;
    expect(deckFactionOf(base)).toBe("Cortex");
    expect(deckFactionOf({ ...base, activeDeck: { deckId: "d2" } } as unknown as SitePlay)).toBeNull();
    expect(deckFactionOf({ ...base, activeDeck: { deckId: "d2" }, factionLock: "Aegis" } as unknown as SitePlay)).toBe("Aegis");
    expect(deckFactionOf({ ...base, activeDeck: null, rebuild: { reasons: [], job: null } } as unknown as SitePlay)).toBeNull();
  });

  it("the preview row: up to six of the owner's units of the faction, one of each, cheapest first", async () => {
    const { client, token, store, owner } = await stack();
    const c = await client.collection(token);
    expect(starterFactionOf(c)).toBe(store.getOwner(owner.ownerId).startingFaction);
    const row = previewCards(c, "Swarm");
    expect(row.length).toBe(6);
    expect(new Set(row.map((r) => r.name)).size).toBe(6);
    expect(row.map((r) => r.cost)).toEqual([...row.map((r) => r.cost)].sort((x, y) => x - y));
    expect(row.every((r) => r.attack !== null && r.health !== null)).toBe(true);
    expect(previewCards(c, "Cortex")).toEqual([]);
  });
});

describe("Equip and Buy through the real server", () => {
  it("each Equip's answer is the server's loadout; the page's state after it equals a fresh read", async () => {
    const { a1, client, token, payloadFor } = await stack();
    const { payload } = await payloadFor(a1.agentId);
    let state = { ...payload.scenario.loadout };
    const starters = Object.values(STARTER_BOASTS).map((b) => b.itemId);
    // A fixed walk through both boast slots, including emptying them.
    const steps: [string, string | null][] = [["boast", starters[0]!], ["closeWinBoast", starters[2]!], ["boast", null], ["closeWinBoast", starters[3]!], ["closeWinBoast", null], ["boast", starters[1]!]];
    for (const [slot, itemId] of steps) {
      const l = await client.setLoadout(token, a1.agentId, slot, itemId);
      const r = loadoutAnswerApply(state, { ok: true, loadout: l.loadout });
      expect(r.ok).toBe(true);
      state = r.state;
      expect(state).toEqual((await client.loadout(token, a1.agentId)).loadout);
      expect(state[slot as "boast"]).toBe(itemId);
    }
  });

  it("refusals come back in the server's words and change nothing: not owned (409), wrong kind (409), no such slot (404), another owner's agent (404)", async () => {
    const { a1, fa, client, token } = await stack();
    const before = (await client.loadout(token, a1.agentId)).loadout;
    const tries: [string, string, string | null, number][] = [
      [a1.agentId, "boast", SEASON_0_BOASTS[0]!.itemId, 409],
      [a1.agentId, "cardBack", STARTER_BOASTS.Aegis.itemId, 409],
      [a1.agentId, "hat", null, 404],
      [fa.agentId, "boast", null, 404],
    ];
    for (const [agent, slot, item, status] of tries) {
      const err = (await client.setLoadout(token, agent, slot, item).catch((e: unknown) => e)) as SiteApiError;
      expect(err).toBeInstanceOf(SiteApiError);
      expect(err.status).toBe(status);
      const r = loadoutAnswerApply(before, { ok: false, error: err.message });
      expect(r.ok).toBe(false);
      expect(r.state).toBe(before);
      expect(r.error).toBe(err.message);
    }
    expect((await client.loadout(token, a1.agentId)).loadout).toEqual(before);
  });

  it("a live match locks the loadout: the page is told, and the server refuses every change", async () => {
    const { a1, store, owner, foe, client, token, payloadFor } = await stack();
    store.startMatch({ matchId: "live-1", p1OwnerId: owner.ownerId, p2OwnerId: foe.ownerId });
    const { payload, loadout } = await payloadFor(a1.agentId);
    expect(loadout.locked).toBe(true);
    expect(payload.scenario.live).toMatchObject({ matchId: "live-1" });
    const err = (await client.setLoadout(token, a1.agentId, "boast", null).catch((e: unknown) => e)) as SiteApiError;
    expect(err.status).toBe(409);
    expect(err.message).toMatch(/live match/);
    expect((await client.loadout(token, a1.agentId)).loadout.boast).toBe(STARTER_BOASTS.Swarm.itemId);
  });

  it("Buy: the locked tile has Buy only when the owner can pay; after buying, the item is an owned tile on every agent and equips", async () => {
    const poor = await stack();
    const p0 = (await poor.payloadFor(poor.a1.agentId)).payload;
    const lockedPoor = p0.scenario.slots[0]!.tiles.filter((t) => !t.owned);
    expect(lockedPoor.every((t) => loadoutLockAction(true, t.priceCredits, p0.scenario.credits).kind === "plate")).toBe(true);

    const rich = await stack({ wins: 14 });
    let { payload } = await rich.payloadFor(rich.a1.agentId);
    const credits = payload.scenario.credits;
    const target = SEASON_0_BOASTS[0]!;
    expect(credits).toBeGreaterThanOrEqual(target.priceCredits!);
    expect(loadoutLockAction(true, target.priceCredits, credits)).toEqual({ kind: "buy", price: target.priceCredits });
    // Standalone (no server to buy from): always the plate.
    expect(loadoutLockAction(false, target.priceCredits, credits).kind).toBe("plate");
    const bought = await rich.client.buyCosmetic(rich.token, target.itemId);
    expect(bought.wallet.credits).toBe(credits - target.priceCredits!);
    for (const agent of [rich.a1, rich.a2]) {
      ({ payload } = await rich.payloadFor(agent.agentId));
      const t = payload.scenario.slots[0]!.tiles.find((x) => x.itemId === target.itemId)!;
      expect(t).toMatchObject({ owned: true, source: "purchase", priceCredits: null });
      expect(payload.scenario.credits).toBe(credits - target.priceCredits!);
    }
    const l = await rich.client.setLoadout(rich.token, rich.a2.agentId, "boast", target.itemId);
    expect(l.loadout.boast).toBe(target.itemId);
    // The other agent's loadout is its own.
    expect((await rich.client.loadout(rich.token, rich.a1.agentId)).loadout.boast).toBe(STARTER_BOASTS.Swarm.itemId);
  });

  it("the Store's rows: the connected agent first, each with what its two boast slots play", async () => {
    const { a1, a2, client, token } = await stack();
    await client.setLoadout(token, a2.agentId, "closeWinBoast", STARTER_BOASTS.Null.itemId);
    await client.setLoadout(token, a2.agentId, "boast", null);
    const play = await client.play(token);
    // Put the unconnected agent first in the list: the rows still lead with the connected one.
    const flipped = { ...play, agents: [...play.agents].reverse() };
    const loadouts = { [a1.agentId]: await client.loadout(token, a1.agentId), [a2.agentId]: await client.loadout(token, a2.agentId) };
    const names = Object.fromEntries((await client.cosmetics(token)).owned.map((o) => [o.itemId, o.item.name]));
    const rows = agentLoadoutRows(flipped, loadouts, names);
    expect(rows.map((r) => r.agentId)).toEqual([a1.agentId, a2.agentId]);
    expect(rows[0]).toMatchObject({ connected: true, boast: STARTER_BOASTS.Swarm.name, closeWin: "Empty: plays the victory boast", others: 0 });
    expect(rows[1]).toMatchObject({ connected: false, boast: "Empty: plays the deck's starter", closeWin: STARTER_BOASTS.Null.name });
    // Not yet read: an ellipsis, never a made-up name.
    expect(agentLoadoutRows(play, {}, names).every((r) => r.boast === "…")).toBe(true);
  });
});

describe("the page's site mode, and the host", () => {
  it("the site's picker page starts empty and hidden, with Close and no scenario tabs; the standalone page is unchanged in that", () => {
    const html = renderSiteLoadoutPage();
    expect(html).toContain('<html lang="en" data-theme="dark" class="site">');
    expect(html).toContain('<main id="picker" hidden>');
    expect(html).toContain('id="close"');
    expect(html).toMatch(/id="sc-tabs" aria-label="Store states" hidden/);
    expect(html).toContain('"scenarios":[]');
    expect(html).toContain('"site":true');
    const standalone = renderLoadoutHtml({ title: "t", closeWinHealth: 5, starters: {}, names: {}, scenarios: [] });
    expect(standalone).not.toContain('id="close"');
    expect(standalone).not.toContain('class="site"');
  });

  it("serves /loadout: framed only by the site, fetching nothing; GET and HEAD only", async () => {
    const { base } = await stack();
    const res = await fetch(`${base}/loadout`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(renderSiteLoadoutPage());
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("connect-src");
    expect((await fetch(`${base}/loadout`, { method: "POST" })).status).toBe(405);
  });

  it("the website has the overlay and the Store's rows, and its bundle keeps the economy to what the browser can run", () => {
    const page = renderSitePage();
    expect(page).toContain('<div id="dress" class="opening" hidden role="dialog" aria-modal="true" aria-label="Agent loadout">');
    const js = siteScript();
    expect(js).toContain("LOADOUT_SITE_HOST");
    expect(js).not.toMatch(/node:sqlite|node:fs|readFileSync/);
  });

  it("loadoutAnswerApply takes the server's whole loadout, slot for slot, and nothing else", () => {
    const state = { boast: "a", closeWinBoast: null, cardBack: null, avatar: null, arena: null };
    const r = loadoutAnswerApply(state, { ok: true, loadout: { boast: "b", closeWinBoast: "c", cardBack: null, avatar: null, arena: null, extra: "x" } as never });
    expect(r.state).toEqual({ boast: "b", closeWinBoast: "c", cardBack: null, avatar: null, arena: null });
    expect(loadoutAnswerApply(state, null).ok).toBe(false);
    expect(loadoutAnswerApply(state, { ok: true } as never).state).toBe(state);
  });
});
