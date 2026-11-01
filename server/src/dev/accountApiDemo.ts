// Evidence for the owner API's account endpoints (session 63; owner
// 2026-11-01: "before match running, add the small endpoints the website is
// waiting on"): who am I, the account settings and the wallet.
//
//   npx tsx src/dev/accountApiDemo.ts > ../progress/owner-api-demo-003-account.txt
//
// A real season database file, a real owner and the house admin, the owner
// API on a real port, and every step below an HTTP request from this
// script. Halfway through, the API is shut down and a new one opened on the
// same file, to show the settings live on the account, not in the server.
// The store's clock and pack seeds are fixed; ids and tokens are replaced
// by names, so the output is the same every run.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";

const tempDir = mkdtempSync(join(tmpdir(), "account-api-demo-"));
const dbFile = join(tempDir, "season-0.db");
let clock = new Date("2026-11-01T09:00:00.000Z");
let store = EconomyStore.open(dbFile, { now: () => clock });
const say = (line = "") => console.log(line);
const PASSWORD = "a long demo password";

// ---- the owners, made the way sign-up and house setup would (store calls) ----
const nova = store.createAccount({ name: "Nova Kestrel", username: "nova", email: "nova@example.test", password: PASSWORD });
store.grantStarterCollection(nova.ownerId, "Cortex");
const house = store.createAccount({ name: "The House", username: "house", password: PASSWORD, kind: "house", isAdmin: true });
const novaAgent = store.createAgent({ ownerId: nova.ownerId, name: "Vector Halcyon" });
const houseAgent = store.createAgent({ ownerId: house.ownerId, name: "Glasshouse" });

const names = new Map<string, string>([
  [nova.ownerId, "<owner Nova>"],
  [house.ownerId, "<owner The House>"],
]);
const nameOf = (id: string) => {
  if (!names.has(id)) names.set(id, `<pack ${[...names.values()].filter((n) => n.startsWith("<pack ")).length + 1}>`);
  return names.get(id)!;
};
const redact = (text: string) => text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => nameOf(id));

let api: RunningOwnerApi = await startOwnerApi({ store, port: 0 });
let token = "";
async function call(method: string, path: string, body?: unknown, auth = token) {
  const res = await fetch(`http://localhost:${api.port}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = (text === "" ? null : JSON.parse(text)) as any;
  say(redact(`> ${method} ${path}${body === undefined ? "" : ` ${JSON.stringify(body)}`}  -> ${res.status}`));
  return { status: res.status, body: parsed };
}
const section = (title: string) => {
  say();
  say(title);
  say("-".repeat(64));
};
const settingsLine = (s: { theme: string; background: string; sound: { on: boolean; volume: number }; music: { on: boolean; volume: number }; skipHintSeen: boolean; updatedAt: string | null }) =>
  `  theme ${s.theme}, background ${s.background}, sound ${s.sound.on ? "on" : "off"} ${s.sound.volume}, music ${s.music.on ? "on" : "off"} ${s.music.volume}, skip hint seen: ${s.skipHintSeen ? "yes" : "no"}, saved: ${s.updatedAt ?? "never (defaults)"}`;
const walletLines = (w: { credits: number; packPoints: number; unopenedPacks: { packId: string; source: string; acquiredAt: string }[] }) => {
  say(`  credits ${w.credits}, pack points ${w.packPoints}, ${w.unopenedPacks.length} pack(s) to open`);
  for (const p of w.unopenedPacks) say(redact(`    ${p.packId}  ${p.source}, since ${p.acquiredAt}`));
};

try {
  say("Owner API demo 003 — who am I, account settings and the wallet over HTTP (session 63)");
  say("=".repeat(72));
  say(`Owner "Nova Kestrel" (login nova) holds the Cortex starter and its ${store.unopenedPacks(nova.ownerId).length} starter packs.`);
  say(`Owner "The House" (login house) is the house admin. The database is a real file; the store's clock reads ${clock.toISOString()}.`);

  section("1. Not signed in: every account endpoint answers 401");
  for (const [m, p] of [["GET", "/api/me"], ["GET", "/api/account/settings"], ["PATCH", "/api/account/settings"], ["GET", "/api/wallet"]] as const) {
    const r = await call(m, p, m === "PATCH" ? { theme: "dark" } : undefined, "");
    say(`  error: ${r.body.error}`);
  }

  section("2. Who am I (the account button and the Admin entry)");
  token = (await call("POST", "/api/session", { login: "nova", password: PASSWORD }, "")).body.token;
  let r = await call("GET", "/api/me");
  say(redact(`  ${JSON.stringify(r.body)}`));
  const houseToken = (await call("POST", "/api/session", { login: "house", password: PASSWORD }, "")).body.token;
  r = await call("GET", "/api/me", undefined, houseToken);
  say(redact(`  ${JSON.stringify(r.body)}`));
  say("  -> Nova gets no Admin entry; The House does.");

  section("3. Account settings: the defaults, then the owner's changes");
  r = await call("GET", "/api/account/settings");
  say(settingsLine(r.body));
  clock = new Date("2026-11-01T09:05:00.000Z");
  r = await call("PATCH", "/api/account/settings", { theme: "dark", background: "aurora" });
  say(settingsLine(r.body));
  clock = new Date("2026-11-01T09:06:00.000Z");
  r = await call("PATCH", "/api/account/settings", { music: { volume: 25 }, sound: { on: false } });
  say(settingsLine(r.body));
  say("  (the boast's Skip is pressed for the first time in the website:)");
  clock = new Date("2026-11-01T09:07:00.000Z");
  r = await call("PATCH", "/api/account/settings", { skipHintSeen: true });
  say(settingsLine(r.body));

  section("4. Bad settings are refused with the reason (400), and nothing changes");
  for (const body of [{ theme: "pink" }, { background: "neon" }, { music: { volume: 140 } }, { sound: { on: "yes" } }, { colour: "red" }]) {
    r = await call("PATCH", "/api/account/settings", body);
    say(`  error: ${r.body.error}`);
  }
  r = await call("GET", "/api/account/settings");
  say(settingsLine(r.body));
  r = await call("GET", "/api/account/settings", undefined, houseToken);
  say("  The House's settings are its own:");
  say(settingsLine(r.body));

  section("5. The server restarts on the same database file: the settings are on the account");
  await api.close();
  store.close();
  store = EconomyStore.open(dbFile, { now: () => clock });
  api = await startOwnerApi({ store, port: 0 });
  say("  (API closed, store closed, both reopened on the same file; Nova signs in again, as from another browser)");
  token = (await call("POST", "/api/session", { login: "nova@example.test", password: PASSWORD }, "")).body.token;
  r = await call("GET", "/api/account/settings");
  say(settingsLine(r.body));

  section("6. The wallet (the top bar: credits, pack points, the Open button)");
  r = await call("GET", "/api/wallet");
  walletLines(r.body);
  say("  (Nova opens the first pack listed, as the Open button would; pack opening's endpoint comes later)");
  const opened = store.openPack(nova.ownerId, r.body.unopenedPacks[0].packId, { seed: 6301 });
  say(redact(`  opened ${opened.packId}: ${opened.cards.length} cards, +${opened.packPoints} pack points`));
  r = await call("GET", "/api/wallet");
  walletLines(r.body);
  say("  (six days of one win each for Nova's agent over the house's, recorded through the store;");
  say("   the server's match runner is the next game-lane item, so nothing plays these yet)");
  for (let i = 0; i < 6; i++) {
    const endedAt = new Date(Date.parse("2026-11-01T10:00:00.000Z") + i * 86_400_000).toISOString();
    store.recordMatch({ matchId: `demo-${i}`, seed: i, p1AgentId: novaAgent.agentId, p2AgentId: houseAgent.agentId, outcome: { kind: "win", winnerAgentId: novaAgent.agentId }, endedAt });
  }
  r = await call("GET", "/api/wallet");
  walletLines(r.body);
  const bought = store.buyPack(nova.ownerId, "S0");
  say(redact(`  (Nova buys a pack with credits: ${bought.packId})`));
  r = await call("GET", "/api/wallet");
  walletLines(r.body);
  r = await call("GET", "/api/wallet", undefined, houseToken);
  say("  The House's wallet:");
  walletLines(r.body);
} finally {
  await api.close();
  store.close();
  rmSync(tempDir, { recursive: true, force: true });
}
