// Evidence for the owner API's deck settings (session 56, roadmap 2b step
// 3: "exposing both settings (server endpoints, item 3)").
//
//   npx tsx src/dev/ownerApiDemo.ts > ../progress/owner-api-demo-002.txt
// (001 is session 56's run; 002 re-ran it in session 58, after option B)
//
// A real season database file, a real owner (a starter and 10 packs opened
// with the live roller), the owner API listening on a real port, and every
// step below an HTTP request from this script. "Rebuild now" runs at the
// store's full build settings on a worker thread while the script keeps
// asking the server for the settings page, to show it answers throughout.
// Seeds and the store's clock are fixed; ids and tokens are replaced by
// names, and the only lines that change run to run are the marked timings.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_BUILD } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { workerChooser } from "../deckBuild/workerChooser.js";
import { startOwnerApi } from "../ownerApi.js";
import { demoFetch } from "./demoFetch.js";

const tempDir = mkdtempSync(join(tmpdir(), "owner-api-demo-"));
const store = EconomyStore.open(join(tempDir, "season-0.db"), { now: () => new Date("2026-10-23T09:00:00.000Z") });
const say = (line = "") => console.log(line);
const PASSWORD = "a long demo password";

// ---- the owner, made the way sign-up would (store calls, not yet endpoints) ----
const nova = store.createAccount({ name: "Nova", username: "nova", password: PASSWORD });
store.grantStarterCollection(nova.ownerId, "Cortex");
for (let i = 0; i < 10; i++) store.grantPack(nova.ownerId, "S0", "ownerDaily");
let seed = 5600;
while (store.unopenedPacks(nova.ownerId).length > 0) store.openPack(nova.ownerId, undefined, { seed: seed++ });
const first = store.createAgent({ ownerId: nova.ownerId, name: "Vector Halcyon" });
const second = store.createAgent({ ownerId: nova.ownerId, name: "Quill Static" });
store.connectAgent(nova.ownerId, first.agentId);
const other = store.createAccount({ name: "Rook", username: "rook", password: PASSWORD });
store.grantStarterCollection(other.ownerId, "Aegis");
const rooksAgent = store.createAgent({ ownerId: other.ownerId, name: "Rook's agent" });

// Ids read as names in the output.
const names = new Map<string, string>([
  [first.agentId, "<agent Vector Halcyon>"],
  [second.agentId, "<agent Quill Static>"],
  [rooksAgent.agentId, "<Rook's agent>"],
]);
const nameOf = (id: string | null | undefined, kind = "deck") => {
  if (id === null || id === undefined) return "none";
  if (!names.has(id)) names.set(id, `<${kind} ${[...names.values()].filter((n) => n.startsWith(`<${kind} `)).length + 1}>`);
  return names.get(id)!;
};

const chooser = workerChooser();
const api = await startOwnerApi({ store, port: 0, chooser: chooser.choose });
const base = `http://localhost:${api.port}`;
let token = "";
async function call(method: string, path: string, body?: unknown, auth = token) {
  const res = await demoFetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: (text === "" ? null : JSON.parse(text)) as any };
}
/** Every id in a printed line read as its name (an unseen one is a deck). */
const redact = (text: string) => text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => nameOf(id));
const show = (method: string, path: string, body: unknown, status: number) =>
  say(redact(`> ${method} ${path}${body === undefined ? "" : ` ${JSON.stringify(body)}`}  -> ${status}`));
async function step(method: string, path: string, body?: unknown, auth?: string) {
  const res = await call(method, path, body, auth);
  show(method, path, body, res.status);
  if (res.status >= 400) say(redact(`  error: ${res.body.error}`));
  return res;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summary(play: any) {
  const deck = (d: { deckId: string; name: string; cards: number; complete: boolean } | null) =>
    d === null ? "none" : `${nameOf(d.deckId)} "${d.name}", ${d.cards} cards${d.complete ? "" : ", INCOMPLETE"}`;
  say(`  deck choice: ${play.deckChoice}   faction lock: ${play.factionLock ?? "none"}`);
  say(`  connected agent: ${play.connectedAgent ? `${play.connectedAgent.name} (${play.connectedAgent.playStyle})` : "none"}`);
  say(`  active deck: ${deck(play.activeDeck)}`);
  say(`  agent's deck: ${deck(play.agentDeck)}${play.agentDeck?.builtFrom ? ` (built as ${play.agentDeck.builtFrom.style}, lock ${play.agentDeck.builtFrom.factionLock ?? "none"})` : ""}`);
  say(`  rebuild reasons: ${play.rebuild.reasons.length === 0 ? "none (up to date)" : play.rebuild.reasons.join("; ")}`);
  if ("activeDeckFits" in play) say(`  active deck fits the lock: ${play.activeDeckFits}`);
}

/** "Rebuild now", then keep asking for the settings page until the build
 * ends; reports how the server answered meanwhile. */
async function rebuild() {
  const started = Date.now();
  const res = await step("POST", "/api/play/rebuild");
  if (res.status !== 202) return;
  say(`  job: ${res.body.job.state}; reasons when it started: ${res.body.job.reasons.join("; ") || "none (rebuilt anyway)"}`);
  let answered = 0;
  let slowest = 0;
  for (;;) {
    const asked = Date.now();
    const play = await call("GET", "/api/play");
    slowest = Math.max(slowest, Date.now() - asked);
    if (play.body.rebuild.job.state !== "running") break;
    answered++;
    await new Promise((r) => setTimeout(r, 200));
  }
  const job = (await call("GET", "/api/play/rebuild")).body.job;
  say(`  [timing, varies per run] build took ${((Date.now() - started) / 1000).toFixed(1)} s; GET /api/play answered ${answered} times while it ran, slowest ${slowest} ms`);
  say(`  job: ${job.state}${job.error ? `: ${job.error}` : ""}`);
  if (job.result) {
    say(`  saved ${nameOf(job.result.deckId)}: ${job.result.faction}, ${job.result.cards} cards, played as ${job.result.style}`);
    for (const f of job.result.factions) {
      say(`    ${f.faction.padEnd(7)} ${f.infeasible ? `can't build: ${f.infeasible}` : f.winRate === null ? "not measured" : `${(f.winRate * 100).toFixed(1)}% against the shipped decks (fresh seeds)`}`);
    }
  }
}

say("Owner API demo 002 — the deck settings over HTTP (session 56; re-run session 58, the builder builds to the size the cards allow)");
say("=".repeat(64));
say(`Owner "Nova": the Cortex starter and 10 packs opened (${store.collection(nova.ownerId).length} cards held), agents`);
say(`Vector Halcyon (connected) and Quill Static. Owner "Rook" holds the Aegis starter.`);
say(`Builds run at the store's settings (engine DEFAULT_BUILD: ${JSON.stringify(DEFAULT_BUILD)}) on a worker thread.`);
say();

say("1. Signing in");
say("-".repeat(64));
await step("GET", "/api/play", undefined, "");
await step("POST", "/api/session", { login: "nova", password: "wrong" }, "");
const session = await step("POST", "/api/session", { login: "nova", password: PASSWORD }, "");
token = session.body.token;
say(`  token: <${token.length} characters>, expires ${session.body.expiresAt}`);
say();

say("2. Settings -> Play, before the agent has built anything");
say("-".repeat(64));
summary((await step("GET", "/api/play")).body);
const styles = (await call("GET", "/api/play")).body.playStyles;
say(`  play styles offered: ${styles.map((s: { name: string }) => s.name).join(", ")}`);
say();

say("3. Rebuild now (no faction lock: the agent weighs every faction)");
say("-".repeat(64));
await rebuild();
summary((await step("GET", "/api/play")).body);
say();

say("4. A second rebuild while one runs, and a rebuild with nothing to do");
say("-".repeat(64));
await step("POST", "/api/play/rebuild");
await step("POST", "/api/play/rebuild");
await api.idle();
say("  (the second request is refused; the first finished with no reasons: an owner may rebuild anyway)");
say(`  the agent's deck is still ${nameOf((await call("GET", "/api/play")).body.agentDeck.deckId)}, rebuilt in place`);
say();

say("5. The play style: the connected agent to Controller, then another owner's agent");
say("-".repeat(64));
summary((await step("PUT", `/api/agents/${first.agentId}/play-style`, { style: "controller" })).body);
await step("PUT", `/api/agents/${first.agentId}/play-style`, { style: "berserker" });
await step("PUT", `/api/agents/${rooksAgent.agentId}/play-style`, { style: "rusher" });
say(`  Rook's agent's style is still ${store.getAgent(rooksAgent.agentId).playStyle}`);
summary((await step("PUT", `/api/agents/${second.agentId}/play-style`, { style: "fortress" })).body);
say("  (Quill Static isn't connected, so its style asks nothing of the deck)");
say();

say("6. The faction lock: Swarm, which Nova's cards can't build; then something that isn't a faction");
say("-".repeat(64));
summary((await step("PUT", "/api/play/faction-lock", { faction: "Swarm" })).body);
await rebuild();
await step("PUT", "/api/play/faction-lock", { faction: "Chrome" });
await step("PUT", "/api/play/faction-lock", {});
say();

say("7. Locked to Null instead, and rebuilt in Controller");
say("-".repeat(64));
summary((await step("PUT", "/api/play/faction-lock", { faction: "Null" })).body);
await rebuild();
summary((await step("GET", "/api/play")).body);
say();

say("8. Forcing a deck: the owner saves the starter list and plays it");
say("-".repeat(64));
const starter = store.saveDeck(
  nova.ownerId,
  "Cortex starter",
  store.collection(nova.ownerId).filter((c) => c.origin === "starter").map((c) => c.copyId),
);
summary((await step("PUT", "/api/play/faction-lock", { faction: null })).body);
summary((await step("PUT", "/api/play/active-deck", { deckId: starter.deckId })).body);
await step("POST", "/api/play/rebuild");
const rooksDeck = store.saveDeck(other.ownerId, "Rook's deck", store.collection(other.ownerId).map((c) => c.copyId));
names.set(rooksDeck.deckId, "<Rook's deck>");
await step("PUT", "/api/play/active-deck", { deckId: rooksDeck.deckId });
say("  (another owner's deck reads as no deck: the refusal doesn't name its faction)");
say();

say("9. Handing the deck back to the agent");
say("-".repeat(64));
summary((await step("PUT", "/api/play/deck-choice", { choice: "agent" })).body);
say();

say("10. Signing out");
say("-".repeat(64));
await step("DELETE", "/api/session");
await step("GET", "/api/play");
say();

say(`Worker threads still running at the end: ${chooser.running}`);
await api.close();
store.close();
rmSync(tempDir, { recursive: true, force: true });
