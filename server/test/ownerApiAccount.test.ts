// The owner API's account endpoints (session 63; owner 2026-11-01: "before
// match running, add the small endpoints the website is waiting on"): who
// am I, the account settings and the wallet. Real HTTP against a real port,
// over an in-memory store, like ownerApi.test.ts.

import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore, PACK_PRICE_CREDITS, STARTER_PACKS } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../src/ownerApi.js";

const PW = "correct horse battery";
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const api of running.splice(0)) await api.close();
});

async function setup() {
  const store = EconomyStore.open(":memory:");
  const ada = store.createAccount({ name: "Ada Lovecode", username: "ada", email: "ada@example.test", password: PW });
  store.grantStarterCollection(ada.ownerId, "Swarm");
  const root = store.createAccount({ name: "The House", username: "house", password: PW, kind: "house", isAdmin: true });
  const api = await startOwnerApi({ store, port: 0 });
  running.push(api);
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown; raw?: string } = {}) => {
    const res = await fetch(`http://localhost:${api.port}${path}`, {
      method,
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
      body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    });
    const text = await res.text();
    return { status: res.status, body: text === "" ? null : JSON.parse(text), headers: res.headers };
  };
  const signIn = async (login: string) => (await call("POST", "/api/session", { body: { login, password: PW } })).body.token as string;
  return { store, ada, root, call, signIn };
}

const PATHS: [string, string][] = [
  ["GET", "/api/me"],
  ["GET", "/api/account/settings"],
  ["PATCH", "/api/account/settings"],
  ["GET", "/api/wallet"],
];

describe("owner API: every account endpoint needs a live session", () => {
  it("answers 401 with no token, a made-up one or a signed-out one", async () => {
    const { call, signIn } = await setup();
    const token = await signIn("ada");
    await call("DELETE", "/api/session", { token });
    for (const [method, path] of PATHS) {
      for (const t of [undefined, "made-up", token]) {
        const res = await call(method, path, { token: t, body: method === "PATCH" ? { theme: "dark" } : undefined });
        expect([method, path, res.status, res.body]).toEqual([method, path, 401, { error: "not signed in" }]);
      }
    }
  });

  it("answers 405 with Allow for a wrong method", async () => {
    const { call, signIn } = await setup();
    const token = await signIn("ada");
    const put = await call("PUT", "/api/account/settings", { token, body: { theme: "dark" } });
    expect(put.status).toBe(405);
    expect(put.headers.get("allow")).toBe("GET, PATCH");
    expect((await call("POST", "/api/me", { token })).headers.get("allow")).toBe("GET");
    expect((await call("DELETE", "/api/wallet", { token })).status).toBe(405);
  });
});

describe("owner API: who am I", () => {
  it("names the signed-in owner (display name and login) and says whether it is the admin", async () => {
    const { ada, root, call, signIn } = await setup();
    const me = await call("GET", "/api/me", { token: await signIn("ADA@example.test") });
    expect(me.status).toBe(200);
    expect(me.headers.get("cache-control")).toBe("no-store");
    expect(me.body).toEqual({ ownerId: ada.ownerId, name: "Ada Lovecode", username: "ada", email: "ada@example.test", kind: "player", isAdmin: false });
    const admin = await call("GET", "/api/me", { token: await signIn("house") });
    expect(admin.body).toEqual({ ownerId: root.ownerId, name: "The House", username: "house", email: null, kind: "house", isAdmin: true });
  });
});

describe("owner API: account settings", () => {
  const DEFAULTS = { theme: "system", background: "glacier", sound: { on: true, volume: 80 }, music: { on: true, volume: 60 }, skipHintSeen: false, updatedAt: null };

  it("reads the defaults, saves a partial change on the owner's account, and keeps owners apart", async () => {
    const { call, signIn } = await setup();
    const ada = await signIn("ada");
    const root = await signIn("house");
    expect((await call("GET", "/api/account/settings", { token: ada })).body).toEqual(DEFAULTS);

    const changed = await call("PATCH", "/api/account/settings", { token: ada, body: { theme: "dark", music: { on: false }, skipHintSeen: true } });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ theme: "dark", background: "glacier", sound: { on: true, volume: 80 }, music: { on: false, volume: 60 }, skipHintSeen: true });
    expect(typeof changed.body.updatedAt).toBe("string");

    // Saved on the account: a new session (another browser) reads the same.
    const again = await signIn("ada");
    expect((await call("GET", "/api/account/settings", { token: again })).body).toEqual(changed.body);
    expect((await call("PATCH", "/api/account/settings", { token: again, body: { background: "purple" } })).body.background).toBe("purple");
    expect((await call("GET", "/api/account/settings", { token: ada })).body.background).toBe("purple");

    // The admin's settings are its own.
    expect((await call("GET", "/api/account/settings", { token: root })).body).toEqual(DEFAULTS);
    // An empty body changes nothing.
    const before = (await call("GET", "/api/account/settings", { token: ada })).body;
    expect((await call("PATCH", "/api/account/settings", { token: ada })).body).toEqual(before);
  });

  it("refuses a bad setting with 400 and the reason, changing nothing", async () => {
    const { call, signIn } = await setup();
    const token = await signIn("ada");
    await call("PATCH", "/api/account/settings", { token, body: { theme: "light" } });
    const before = (await call("GET", "/api/account/settings", { token })).body;
    const bad: [unknown, RegExp][] = [
      [{ theme: "pink" }, /"theme" must be one of system, light, dark/],
      [{ background: "Glacier" }, /"background" must be one of glacier, ocean/],
      [{ sound: { volume: 101 } }, /"sound.volume" must be a whole number from 0 to 100/],
      [{ music: "off" }, /"music" must be an object/],
      [{ skipHintSeen: "yes" }, /"skipHintSeen" must be true or false/],
      [{ theme: "dark", nickname: "x" }, /unknown setting "nickname"/],
    ];
    for (const [body, message] of bad) {
      const res = await call("PATCH", "/api/account/settings", { token, body });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(message);
    }
    expect((await call("PATCH", "/api/account/settings", { token, raw: "[1]" })).status).toBe(400);
    expect((await call("PATCH", "/api/account/settings", { token, raw: "{" })).status).toBe(400);
    expect((await call("GET", "/api/account/settings", { token })).body).toEqual(before);
  });
});

describe("owner API: the wallet", () => {
  it("shows both balances and the unopened packs, oldest first, and follows the store as they change", async () => {
    const { store, ada, root, call, signIn } = await setup();
    const token = await signIn("ada");
    const first = await call("GET", "/api/wallet", { token });
    expect(first.status).toBe(200);
    expect(first.body.credits).toBe(0);
    expect(first.body.packPoints).toBe(0);
    expect(first.body.unopenedPacks).toHaveLength(STARTER_PACKS);
    expect(first.body.unopenedPacks[0]).toEqual({ ...store.unopenedPacks(ada.ownerId)[0] });

    // The Open button opens the first pack listed.
    const opened = store.openPack(ada.ownerId);
    expect(opened.packId).toBe(first.body.unopenedPacks[0].packId);
    // Credits from a win (the house owner's agent against Ada's), then a pack bought with them.
    const a = store.createAgent({ ownerId: ada.ownerId, name: "ada-agent" });
    const h = store.createAgent({ ownerId: root.ownerId, name: "house-agent" });
    for (let i = 0; i < 6; i++) {
      const endedAt = new Date(Date.parse("2026-11-01T10:00:00Z") + i * 86_400_000).toISOString();
      store.recordMatch({ matchId: `m${i}`, seed: i, p1AgentId: a.agentId, p2AgentId: h.agentId, outcome: { kind: "win", winnerAgentId: a.agentId }, endedAt });
    }
    const earned = store.balance(ada.ownerId, "credits");
    expect(earned).toBeGreaterThanOrEqual(PACK_PRICE_CREDITS);
    const bought = store.buyPack(ada.ownerId, "S0");
    const now = (await call("GET", "/api/wallet", { token })).body;
    expect(now.credits).toBe(earned - PACK_PRICE_CREDITS);
    expect(now.packPoints).toBe(opened.packPoints);
    expect(now.unopenedPacks.map((p: { packId: string }) => p.packId)).toEqual([...first.body.unopenedPacks.slice(1).map((p: { packId: string }) => p.packId), bought.packId]);

    // Another owner sees only their own wallet.
    const house = (await call("GET", "/api/wallet", { token: await signIn("house") })).body;
    expect(house.unopenedPacks).toEqual([]);
    expect(house.credits).toBe(store.balance(root.ownerId, "credits"));
  });
});
