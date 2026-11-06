// Evidence for session 68's small asks over HTTP (owner 2026-11-02, the
// render 47, 48 and 49 entries): "Watch again" (GET /api/packs/:id/opening
// answers the PackOpening POST /api/packs/open gave), the card viewer's craft
// price and copy limit, signature cards and earned promos for the Promos tab,
// and the deck's faction and list in GET /api/play.
//
//   npx tsx src/dev/collectionAsksApiDemo.ts > ../progress/owner-api-demo-006-collection-asks.txt
//
// A real season database file, one owner, the owner API on a real port, every
// read an HTTP request. Halfway the API and store are closed and reopened on
// the same file, to show the reveal is stored, not remembered. Ids are
// replaced by names, so the output is the same every run.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { demoFetch } from "./demoFetch.js";

const tempDir = mkdtempSync(join(tmpdir(), "collection-asks-demo-"));
const dbFile = join(tempDir, "season-0.db");
const clock = new Date("2026-11-02T01:00:00.000Z");
let store = EconomyStore.open(dbFile, { now: () => clock });
const say = (line = "") => console.log(line);
const PASSWORD = "a long demo password";
const nova = store.createAccount({ name: "Nova Kestrel", username: "nova", password: PASSWORD });
const names = new Map<string, string>([[nova.ownerId, "<owner Nova>"]]);
const redact = (text: string) =>
  text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => {
    if (!names.has(id)) names.set(id, `<id ${names.size}>`);
    return names.get(id)!;
  });

let seed = 6800;
let api: RunningOwnerApi = await startOwnerApi({ store, port: 0, packSeed: () => ++seed });
let token = "";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const res = await demoFetch(`http://localhost:${api.port}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  say(redact(`> ${method} ${path}  -> ${res.status}`));
  return { status: res.status, body: text === "" ? null : JSON.parse(text) };
}
const signIn = async () => {
  token = "";
  token = (await call("POST", "/api/session", { login: "nova", password: PASSWORD })).body.token;
};
const section = (title: string) => {
  say();
  say(title);
  say("-".repeat(72));
};
const same = (a: unknown, b: unknown) => (JSON.stringify(a) === JSON.stringify(b) ? "IDENTICAL" : "DIFFERENT");
const checks: [string, boolean][] = [];

try {
  say("Owner API demo 006 — session 68's collection and deck asks over HTTP");
  say("=".repeat(72));
  await signIn();

  section("1. The starter collection and two packs opened (one alone, then the rest)");
  const { copies } = store.grantStarterCollection(nova.ownerId, "Aegis");
  const deck = store.saveDeck(nova.ownerId, "Aegis starter", copies.map((c) => c.copyId));
  store.setActiveDeck(nova.ownerId, deck.deckId);
  const one = (await call("POST", "/api/packs/open", {})).body.packs[0];
  const rest = (await call("POST", "/api/packs/open", {})).body.packs[0];
  const showPack = (p: { packId: string; cards: { name: string; slot: string; finish: string; isNew: boolean; ownedAfter: number }[]; pity: unknown; starterHit: boolean; packPoints: number }) => {
    say(redact(`  pack ${p.packId}: starterHit ${p.starterHit}, pity ${JSON.stringify(p.pity)}, +${p.packPoints} pack points`));
    for (const c of p.cards) say(`    ${c.slot.padEnd(8)} ${c.name.padEnd(26)} ${c.finish.padEnd(9)} ${c.isNew ? "NEW " : "    "} x${c.ownedAfter} owned`);
  };
  showPack(one);
  showPack(rest);

  section("2. Watch again: the opening read back, after a restart on the same file");
  await api.close();
  store.close();
  store = EconomyStore.open(dbFile, { now: () => clock });
  api = await startOwnerApi({ store, port: 0, packSeed: () => ++seed });
  await signIn();
  say(`  schema v${store.schemaVersion}`);
  for (const p of [one, rest]) {
    const back = await call("GET", `/api/packs/${p.packId}/opening`);
    say(`  the same PackOpening POST /api/packs/open answered: ${same(back.body, p)}`);
    checks.push([`reveal ${checks.length + 1} identical after restart`, same(back.body, p) === "IDENTICAL"]);
  }
  await call("GET", "/api/packs/not-a-pack/opening");

  section("3. The card viewer: copy limit and craft price, from the API");
  const held = store.collectionSummary(nova.ownerId).cards;
  const byRarity = (r: string) => held.find((c) => c.rarity === r);
  for (const r of ["Common", "Uncommon", "Rare", "Mythic"]) {
    const c = byRarity(r);
    if (!c) continue;
    const h = (await call("GET", `/api/collection/cards/${c.cardId}`)).body;
    say(`  ${c.name} (${r}): owned ${h.owned}, copyLimit ${h.copyLimit}, craft ${JSON.stringify(h.craft)}`);
  }

  section("4. The Promos tab: two generated agents, the second connected, and one earned promo");
  for (const s of [11, 12]) {
    const draft = store.startAgentDraft(nova.ownerId, { seed: s });
    store.pickDraftAgent(nova.ownerId, draft.draftId, 0, { seed: s + 1000 });
    const made = store.confirmAgentDraft(nova.ownerId, draft.draftId, 0);
    if (s === 12) store.connectAgent(nova.ownerId, made.agent.agentId);
  }
  store.grantCopy({ ownerId: nova.ownerId, cardId: held[0]!.cardId, origin: "promo", stamp: "DEMO STAMP", seriesKind: "promo", seriesCode: "PR-900" });
  const promos = (await call("GET", "/api/collection")).body.promos;
  for (const c of promos.signatureCards) say(redact(`  signature ${c.collectorNumber} ${c.name} (agent ${c.agentName}${c.connected ? ", connected" : ""}), copy ${c.copyId ? "held" : "missing"}, art ${c.art.replace(/\d+$/, "<slot, drawn at random>")}`));
  for (const e of promos.earned) say(`  earned   ${e.seriesCode} ${e.name} (${e.rarity}, ${e.origin}, stamp "${e.stamp}")`);
  const sigHolding = (await call("GET", `/api/collection/cards/${promos.signatureCards[0].cardId}`)).body;
  say(`  a signature card in the card viewer: copyLimit ${sigHolding.copyLimit}, craft ${sigHolding.craft}`);
  checks.push(["one connected signature card", promos.signatureCards.filter((c: { connected: boolean }) => c.connected).length === 1]);

  section("5. The deck's faction and list in GET /api/play");
  const play = (await call("GET", "/api/play")).body;
  const d = play.activeDeck;
  say(`  active deck "${d.name}": faction ${d.faction}, ${d.cards} cards, ${d.list.length} distinct`);
  say(`  list: ${d.list.map((l: { cardId: string; copies: number }) => `${l.cardId} x${l.copies}`).join(", ")}`);
  checks.push(["the list adds up to the deck", d.list.reduce((t: number, l: { copies: number }) => t + l.copies, 0) === d.cards]);
  checks.push(["the starter deck plays Aegis", d.faction === "Aegis"]);

  section("Checks");
  for (const [what, ok] of checks) say(`  ${ok ? "PASS" : "FAIL"}  ${what}`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
} finally {
  await api.close();
  store.close();
  rmSync(tempDir, { recursive: true, force: true });
}
