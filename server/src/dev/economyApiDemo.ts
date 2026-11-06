// Evidence for the owner API's board and economy endpoints (session 64;
// owner 2026-11-01: "the economy endpoints come with the board layout,
// before match running"): the saved Home board, today's earnings on the
// Sydney day, buying and opening packs, the collection and binder, salvage
// and crafting, the store, cosmetics and loadouts, and the ledger.
//
//   npx tsx src/dev/economyApiDemo.ts > ../progress/owner-api-demo-004-economy.txt
//
// A real season database file, two owners, the owner API on a real port,
// and every step below an HTTP request from this script except the match
// results (the match runner is the next game-lane item, so wins are recorded
// through the store, as session 63's demo did). Partway through, the API is
// shut down and a new one opened on the same file, to show the board and
// the packs live on the account, not in the server. The store's clock and
// the pack seeds are fixed; ids and tokens are replaced by names, so the
// output is the same every run.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { demoFetch } from "./demoFetch.js";

const tempDir = mkdtempSync(join(tmpdir(), "economy-api-demo-"));
const dbFile = join(tempDir, "season-0.db");
let clock = new Date("2026-11-01T09:00:00.000Z");
let store = EconomyStore.open(dbFile, { now: () => clock });
const say = (line = "") => console.log(line);
const PASSWORD = "a long demo password";
let seed = 6400;
const packSeed = () => ++seed;

const nova = store.createAccount({ name: "Nova Kestrel", username: "nova", password: PASSWORD });
store.grantStarterCollection(nova.ownerId, "Cortex");
const house = store.createAccount({ name: "The House", username: "house", password: PASSWORD, kind: "house", isAdmin: true });
const novaAgent = store.createAgent({ ownerId: nova.ownerId, name: "Vector Halcyon" });
const houseAgent = store.createAgent({ ownerId: house.ownerId, name: "Glasshouse" });

const names = new Map<string, string>([
  [nova.ownerId, "<owner Nova>"],
  [house.ownerId, "<owner The House>"],
  [novaAgent.agentId, "<agent Vector Halcyon>"],
  [houseAgent.agentId, "<agent Glasshouse>"],
]);
const counters = new Map<string, number>();
const nameOf = (id: string, kind = "id") => {
  if (!names.has(id)) {
    const n = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, n);
    names.set(id, `<${kind} ${n}>`);
  }
  return names.get(id)!;
};
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const redact = (text: string) => text.replace(UUID, (id) => nameOf(id));
const packName = (id: string) => nameOf(id, "pack");

let api: RunningOwnerApi = await startOwnerApi({ store, port: 0, packSeed });
let token = "";
async function call(method: string, path: string, body?: unknown, auth = token) {
  const res = await demoFetch(`http://localhost:${api.port}${path}`, {
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
  say("-".repeat(72));
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const walletLine = (w: any) => say(`  wallet: credits ${w.credits}, pack points ${w.packPoints}, ${w.unopenedPacks.length} pack(s) to open`);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const boardLine = (b: any) =>
  say(`  ${b.widgets.map((w: { id: string; type: string; size: string }) => `${w.type}:${w.size}`).join("  ") || "(empty board)"}   [${b.recommended ? "recommended, never saved" : `saved ${b.updatedAt}`}]`);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cardLine = (c: any) => {
  const extra = [c.finish !== "standard" ? c.finish : null, c.prototype ? `Prototype ${c.prototype.runCode} #${c.prototype.serial}/${c.prototype.runSize}` : null, c.secret ? `secret ${c.secret.code}` : null]
    .filter(Boolean)
    .join(", ");
  return `${c.collectorNumber} ${c.name} (${c.rarity}${extra ? `, ${extra}` : ""})${c.isNew ? " NEW" : ""} x${c.ownedAfter} owned`;
};
/** Nova's agent beats the house's at `endedAt` (the match runner isn't built). */
let matchNo = 0;
const novaWins = (endedAt: string) =>
  store.recordMatch({ matchId: `demo-${++matchNo}`, seed: matchNo, p1AgentId: novaAgent.agentId, p2AgentId: houseAgent.agentId, outcome: { kind: "win", winnerAgentId: novaAgent.agentId }, endedAt });

try {
  say("Owner API demo 004 — the Home board and the economy endpoints over HTTP (session 64)");
  say("=".repeat(80));
  say(`Owner "Nova Kestrel" (login nova) holds the Cortex starter and its ${store.unopenedPacks(nova.ownerId).length} starter packs; "The House" is the opponent.`);
  say(`The database is a real file; the store's clock starts at ${clock.toISOString()} (20:00 in Sydney).`);

  section("1. Not signed in: refused (one of each family shown)");
  for (const [m, p] of [["GET", "/api/board"], ["GET", "/api/collection"], ["POST", "/api/packs/open"], ["GET", "/api/store"], ["GET", "/api/daily"]] as const) {
    const r = await call(m, p, undefined, "");
    say(`  error: ${r.body.error}`);
  }
  token = (await call("POST", "/api/session", { login: "nova", password: PASSWORD }, "")).body.token;

  section("2. The Home board: the recommended layout until saved, then Nova's own");
  let r = await call("GET", "/api/board");
  boardLine(r.body);
  say(`  rules: ${r.body.rules.widgetTypes.map((t: { type: string; limit: number }) => `${t.type}${t.limit > 1 ? ` x${t.limit}` : ""}`).join(", ")}; sizes ${r.body.rules.sizes.join("/")}; at most ${r.body.rules.maxWidgets} widgets`);
  clock = new Date("2026-11-01T09:01:00.000Z");
  const myBoard = [
    { id: "w1", type: "agent", size: "L" },
    { id: "w2", type: "packs", size: "M" },
    { id: "w3", type: "daily", size: "S" },
    { id: "w4", type: "watch", size: "M" },
    { id: "w5", type: "watch", size: "S" },
    { id: "w6", type: "collection", size: "M" },
  ];
  r = await call("PUT", "/api/board", { widgets: myBoard });
  boardLine(r.body);
  say("  Bad boards are refused with the reason (400) and nothing is saved:");
  for (const widgets of [
    [{ id: "w1", type: "tournament", size: "M" }],
    [{ id: "w1", type: "watch", size: "M" }, { id: "w2", type: "watch", size: "M" }, { id: "w3", type: "watch", size: "S" }],
    [{ id: "w1", type: "packs", size: "XL" }],
    [{ id: "w1", type: "packs", size: "M" }, { id: "w1", type: "store", size: "M" }],
  ]) {
    r = await call("PUT", "/api/board", { widgets });
    say(`  error: ${r.body.error}`);
  }

  section("3. Today's earnings on the Sydney day (the Daily rewards widget)");
  say("  (results recorded through the store: Nova's agent wins at 11:30 and 12:50 UTC on 1 Nov,");
  say("   22:30 and 23:50 in Sydney, then at 13:10 UTC, ten past midnight on 2 Nov in Sydney)");
  // Sixteen earlier days of one win each first: the credits the packs and boast below spend.
  for (let d = 16; d >= 1; d--) novaWins(new Date(Date.parse("2026-11-01T09:00:00.000Z") - d * 86_400_000).toISOString());
  novaWins("2026-11-01T11:30:00.000Z");
  novaWins("2026-11-01T12:50:00.000Z");
  clock = new Date("2026-11-01T12:55:00.000Z");
  r = await call("GET", "/api/daily");
  const dailyLine = (d: typeof r.body) =>
    say(
      `  day ${d.day} (${d.timeZone}), started ${d.startedAt}, resets ${d.resetsAt}; wins ${d.wins.map((w: { credits: number }) => `+${w.credits}`).join(" ") || "none"}; ` +
        `credits today ${d.credits}; next win pays ${d.nextWinPays}, next loss ${d.nextLossPays}`,
    );
  dailyLine(r.body);
  say(`  schedule: ${r.body.schedule.map((s: { fromWin: number; toWin: number | null; credits: number }) => `wins ${s.fromWin}${s.toWin === null ? "+" : s.toWin === s.fromWin ? "" : `-${s.toWin}`}: ${s.credits}`).join("; ")}`);
  novaWins("2026-11-01T13:10:00.000Z");
  clock = new Date("2026-11-01T13:15:00.000Z");
  r = await call("GET", "/api/daily");
  dailyLine(r.body);
  say("  -> the win ten minutes after Sydney midnight is the 1st of a new day and pays 30 (in UTC it would have been the 3rd, paying 10).");

  section("4. Packs: what's sold, buying with credits (all or none), opening");
  r = await call("GET", "/api/packs");
  say(`  offer: ${r.body.offer.map((o: { setCode: string; name: string; priceCredits: number }) => `${o.setCode} "${o.name}" ${o.priceCredits} credits`).join("; ")}; open 1 or ${r.body.bulkOpenCount}`);
  say(`  pity: ${r.body.pity.packsSinceFullArt} pack(s) since a Full Art, ${r.body.pity.packsSinceMythic} since a Mythic`);
  walletLine(r.body.wallet);
  r = await call("POST", "/api/packs/buy", { setCode: "S0", count: 10 });
  say(`  error: ${r.body.error}`);
  r = await call("POST", "/api/packs/buy", { setCode: "S0", count: 2 });
  say(`  bought ${r.body.bought.map((p: { packId: string }) => packName(p.packId)).join(", ")}`);
  walletLine(r.body.wallet);
  r = await call("POST", "/api/packs/open", {});
  for (const p of r.body.packs) {
    say(`  ${packName(p.packId)} (${store.packOpening(p.packId).seed === p.seed ? "seed logged" : "?"}, +${p.packPoints} pack points):`);
    for (const c of p.cards) say(`    ${cardLine(c)}`);
  }
  walletLine(r.body.wallet);

  section("5. The server restarts on the same file: the board and the packs are on the account");
  await api.close();
  store.close();
  store = EconomyStore.open(dbFile, { now: () => clock });
  api = await startOwnerApi({ store, port: 0, packSeed });
  token = (await call("POST", "/api/session", { login: "nova", password: PASSWORD }, "")).body.token;
  r = await call("GET", "/api/board");
  boardLine(r.body);
  r = await call("GET", "/api/wallet");
  walletLine(r.body);
  const newest = r.body.unopenedPacks.at(-1).packId;
  r = await call("POST", "/api/packs/open", { packId: newest });
  say(`  opened the chosen pack, ${packName(r.body.packs[0].packId)}, not the oldest:`);
  for (const c of r.body.packs[0].cards) say(`    ${cardLine(c)}`);
  r = await call("POST", "/api/packs/open", { count: 10 });
  say(`  error: ${r.body.error}`);
  say("  (eight of the owner's daily packs granted through the store, as the daily-pack reward would)");
  for (let i = 0; i < 8; i++) store.grantPack(nova.ownerId, "S0", "ownerDaily");
  r = await call("POST", "/api/packs/open", { count: 10 });
  for (const p of r.body.packs) packName(p.packId);
  const sum = r.body.summary;
  say(`  ten packs: ${sum.cards} cards, ${sum.newCards} new, +${sum.packPoints} pack points; by rarity ${Object.entries(sum.byRarity).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  say(`  by finish ${Object.entries(sum.byFinish).map(([k, v]) => `${k} ${v}`).join(", ")}; full reveals: ${sum.fullReveals.length}`);
  for (const p of r.body.packs) {
    const hits = p.cards.filter((c: { finish: string; rarity: string }) => c.finish !== "standard" || c.rarity === "Mythic");
    if (hits.length > 0) say(`    ${packName(p.packId)}: ${hits.map(cardLine).join("; ")}`);
  }
  walletLine(r.body.wallet);

  section("6. The collection: by card, by set, and the recent pulls");
  r = await call("GET", "/api/collection?recentPacks=2");
  say(`  ${r.body.copies} copies of ${r.body.distinctCards} cards`);
  for (const s of r.body.sets) {
    say(`  set ${s.setCode}: base ${s.base.held}/${s.base.total}, secrets ${s.secrets.held}/${s.secrets.total}, Glitch ${s.glitch.held}/${s.glitch.total}, Gold ${s.gold.held}/${s.gold.total}, Prototype runs ${s.prototypes.runsHeld}/${s.prototypes.runs}`);
  }
  const top = [...r.body.cards].sort((a: { owned: number }, b: { owned: number }) => b.owned - a.owned).slice(0, 3);
  for (const c of top) {
    const by = (k: string) => Object.entries(c.copies.reduce((m: Record<string, number>, x: Record<string, string>) => ({ ...m, [x[k]!]: (m[x[k]!] ?? 0) + 1 }), {})).map(([k2, v]) => `${k2} ${v}`).join(", ");
    say(`  ${c.name} (${c.rarity}, ${c.faction}): ${c.owned} owned, ${c.salvageable} salvageable; origin ${by("origin")}; finish ${by("finish")}`);
  }
  say(`  recent pulls: ${r.body.recentPulls.map((p: { packId: string; cards: unknown[] }) => `${packName(p.packId)} (${p.cards.length} cards)`).join(", ")}`);
  r = await call("GET", "/api/collection/binder/S0");
  const owned = r.body.base.entries.filter((e: { owned: number }) => e.owned > 0).slice(0, 4);
  say(`  binder, first held places: ${owned.map((e: { number: string; name: string; owned: number }) => `${e.number} ${e.name} x${e.owned}`).join("; ")}`);

  section("7. Salvage (plan first, then do it) and crafting with pack points");
  const summary = store.collectionSummary(nova.ownerId);
  const spare = summary.cards.find((c) => c.salvageable >= 2)!;
  r = await call("GET", `/api/collection/cards/${spare.cardId}`);
  say(`  ${spare.name}: ${r.body.owned} owned, ${r.body.salvageable} salvageable at ${r.body.packPointsEach} each; not salvageable: ${r.body.notSalvageable.map((n: { reason: string; count: number }) => `${n.count} x ${n.reason}`).join("; ") || "none"}`);
  r = await call("GET", `/api/collection/cards/${spare.cardId}/salvage?quantity=2`);
  say(`  plan: ${r.body.quantity} go for ${r.body.packPoints} pack points, ${r.body.ownedAfter} left; decks left short: ${r.body.affectedDecks.length}`);
  r = await call("POST", `/api/collection/cards/${spare.cardId}/salvage`, { quantity: 2 });
  say(`  salvaged ${r.body.copies.length} for +${r.body.packPoints}; now ${r.body.holdings.owned} owned`);
  walletLine(r.body.wallet);
  r = await call("POST", `/api/collection/cards/${spare.cardId}/salvage`, { quantity: 99 });
  say(`  error: ${r.body.error}`);
  const binder = store.binder(nova.ownerId, "S0");
  const missing = binder.base.entries.find((e) => e.rarity === "Common" && e.owned === 0)!;
  r = await call("POST", `/api/collection/cards/${missing.cardId}/craft`);
  if (r.status === 201) {
    say(`  crafted ${missing.name}: origin ${r.body.copy.origin}, account-bound ${r.body.copy.accountBound}; now ${r.body.holdings.owned} owned`);
    walletLine(r.body.wallet);
  } else say(`  error: ${r.body.error}`);
  const secret = binder.secrets.entries.find((e) => e.kind === "illustration")!;
  r = await call("POST", `/api/collection/secrets/${secret.secretCode}/craft`);
  say(`  error: ${r.body.error}`);

  section("8. The store, cosmetics and the loadout");
  r = await call("GET", "/api/store");
  for (const c of r.body.cosmetics) say(`  on sale: ${c.name} (${c.kind}) ${c.priceCredits} credits${c.owned ? ", owned" : ""}`);
  walletLine(r.body.wallet);
  r = await call("POST", "/api/store/cosmetics/boast-s0-dial-up-fireworks/buy");
  say(`  bought ${r.body.cosmetic.item.name} (${r.body.cosmetic.source})`);
  walletLine(r.body.wallet);
  r = await call("POST", "/api/store/cosmetics/boast-s0-boot-sequence/buy");
  say(`  error: ${r.body.error}`);
  r = await call("GET", `/api/agents/${novaAgent.agentId}/loadout`);
  for (const s of r.body.slots) say(`  slot ${s.slot} (${s.kind}): ${s.itemId ?? "empty"}; owned choices: ${s.choices.join(", ") || "none"}`);
  r = await call("PUT", `/api/agents/${novaAgent.agentId}/loadout/boast`, { itemId: "boast-s0-dial-up-fireworks" });
  say(`  boast slot now ${r.body.loadout.boast}`);
  r = await call("PUT", `/api/agents/${novaAgent.agentId}/loadout/cardBack`, { itemId: "boast-s0-dial-up-fireworks" });
  say(`  error: ${r.body.error}`);
  r = await call("GET", `/api/agents/${houseAgent.agentId}/loadout`);
  say(redact(`  error: ${r.body.error}  (the house's agent reads as missing to Nova)`));

  section("9. The ledger, newest first (the wallet's history)");
  r = await call("GET", "/api/ledger?limit=12");
  for (const e of r.body.entries) {
    const kind = /^pack/.test(e.reason) ? "pack" : /^(salvage|craft)/.test(e.reason) ? "copy" : "id";
    const ref = e.ref === null ? "" : ` ${e.ref.replace(UUID, (id: string) => nameOf(id, kind))}`;
    say(`  #${e.entryId} ${e.createdAt} ${e.currency} ${e.delta > 0 ? "+" : ""}${e.delta} ${e.reason}${ref}`);
  }
  say(`  more: ${r.body.more}`);
} finally {
  await api.close();
  store.close();
  rmSync(tempDir, { recursive: true, force: true });
}
