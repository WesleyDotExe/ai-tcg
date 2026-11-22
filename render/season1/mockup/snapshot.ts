// The Season 1 Home mockups' data (render session 83): the Season 0 site demo
// with the ladder playing (the real owner API over a real store), read as two
// owners through the API, the same pair the tile audit used (render 82):
//   - Nova: weeks in (matches, packs opened, credits, packs waiting);
//   - Wren: a brand-new owner, made with sign-up's store calls (a starter,
//     one agent, connected, no match yet).
// It writes season1/mockup/data/home-data.json, which the mockups draw from,
// so a mockup shows real answers, not invented numbers. Season 0 is a fixed
// upstream: nothing in it changes.
//
//   npx tsx season1/mockup/snapshot.ts      (in render/)

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startSiteDemo, DEMO_PASSWORD, DEMO_LOGIN } from "../../src/site/siteDemo.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "data", "home-data.json");
export const NEW_LOGIN = "wren";

/** The endpoints a Home tile answers from (server/OWNER_API.md). */
const READS: Record<string, string> = {
  me: "/api/me",
  wallet: "/api/wallet",
  play: "/api/play",
  rating: "/api/rating?recent=10",
  ladder: "/api/ladder?limit=100",
  stats: "/api/stats?days=30&recent=10",
  packs: "/api/packs",
  dailyPack: "/api/packs/daily",
  collection: "/api/collection?recentPacks=3",
  store: "/api/store",
  daily: "/api/daily",
  matches: "/api/matches?limit=6",
  notifications: "/api/notifications?limit=20",
  live: "/api/live",
  settings: "/api/account/settings",
};

const demo = await startSiteDemo({ port: 0, ladder: true, speed: 8 });
try {
  const wren = demo.store.createAccount({ name: "Wren", username: NEW_LOGIN, password: DEMO_PASSWORD });
  demo.store.grantStarterCollection(wren.ownerId, "Swarm");
  const agent = demo.store.createAgent({ ownerId: wren.ownerId, name: "Moth Lantern" });
  demo.store.connectAgent(wren.ownerId, agent.agentId);

  const call = async (token: string | null, method: string, path: string, body?: unknown) => {
    const r = await fetch(demo.url.replace(/\/$/, "") + path, { method, headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    return { status: r.status, body: text ? JSON.parse(text) : null };
  };
  const signIn = async (login: string) => {
    const r = await call(null, "POST", "/api/session", { login, password: DEMO_PASSWORD });
    if (r.status !== 201) throw new Error(`sign-in ${login}: ${r.status} ${JSON.stringify(r.body)}`);
    return r.body.token as string;
  };

  // Wait (up to 120 s) until the featured live match is a few turns in, so
  // Watch live has a board to show, not turn 1's empty one.
  const nova = await signIn(DEMO_LOGIN);
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    const live = await call(nova, "GET", "/api/live");
    if ((live.body?.matches?.[0]?.now?.turn ?? 0) >= 5) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  const owners: Record<string, Record<string, unknown>> = {};
  for (const [login, token] of [[DEMO_LOGIN, nova], [NEW_LOGIN, await signIn(NEW_LOGIN)]] as const) {
    const o: Record<string, unknown> = {};
    for (const [k, path] of Object.entries(READS)) {
      const r = await call(token, "GET", path);
      o[k] = r.status === 200 ? r.body : { error: r.status, body: r.body };
    }
    owners[login] = o;
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ takenAt: new Date().toISOString(), takenFrom: "the Season 0 site demo (render/src/site/siteDemo.ts), ladder on, speed 8", reads: READS, owners }, null, 1) + "\n");
  console.log(`[snapshot] wrote ${OUT}`);
  for (const [l, o] of Object.entries(owners)) console.log(`  ${l}: ${Object.entries(o).map(([k, v]) => `${k}${(v as any)?.error ? `(${(v as any).error})` : ""}`).join(" ")}`);
} finally {
  await demo.close();
}
process.exit(0);
