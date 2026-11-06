// Evidence for session 69: the game lane's half of coin skins (owner
// 2026-11-02, built as approved with two changes) over HTTP. The migration
// that gives existing owners the Chrome Token; the loadout's sixth slot;
// the store's coins (not on sale until drawn, a tier coin never); a live
// match showing both sides' coins, arenas and starting ratings and the
// spectator's default view; the same on the recorded match and its replay;
// that the coin is cosmetic only (the same seed plays the same match whatever
// coin a side flips); and the Season 0 tier coins granted at season end.
//
//   npx tsx src/dev/coinSkinsApiDemo.ts > ../progress/owner-api-demo-007-coins.txt
//
// Real season database files, the owner API on a real port, every read an
// HTTP request. Ids are replaced by names, so the output is the same every
// run.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatLog } from "@ai-tcg/engine";
import { COSMETICS, EconomyStore, SEASON_0_COINS, type CosmeticItem } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";
import { Ladder, rebuildReplay, type ReplayFile } from "../ladder/ladderRunner.js";
import { demoFetch } from "./demoFetch.js";

const tempDir = mkdtempSync(join(tmpdir(), "coin-skins-demo-"));
const say = (line = "") => console.log(line);
const PASSWORD = "a long demo password";
const names = new Map<string, string>();
const redact = (text: string) =>
  text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => {
    if (!names.has(id)) names.set(id, `<id ${names.size}>`);
    return names.get(id)!;
  });
const section = (title: string) => {
  say();
  say(title);
  say("-".repeat(72));
};
const checks: [string, boolean][] = [];
const check = (what: string, ok: boolean) => checks.push([what, ok]);

/** The shipped catalogue with the two store coins marked drawn, as the
 * render lane will mark them in its coin slice (nothing is drawn yet). */
const DRAWN: readonly CosmeticItem[] = COSMETICS.map((c) => (SEASON_0_COINS.some((s) => s.itemId === c.itemId) ? { ...c, drawn: true } : c));

const clock = { t: Date.parse("2026-11-02T02:00:00.000Z") }; // 13:00 in Sydney
let api: RunningOwnerApi | null = null;
let token = "";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const res = await demoFetch(`http://localhost:${api!.port}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  const parsed = text === "" ? null : res.headers.get("content-type")?.startsWith("application/json") ? JSON.parse(text) : text;
  say(redact(`> ${method} ${path}  -> ${res.status}${res.status >= 400 && parsed?.error ? `  (${parsed.error})` : ""}`));
  return { status: res.status, body: parsed };
}
const signIn = async (login: string) => {
  token = "";
  token = (await call("POST", "/api/session", { login, password: PASSWORD })).body.token;
};
function credit(s: EconomyStore, ownerId: string, amount: number) {
  s.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${ownerId}', 'credits', ${amount}, 'demoGrant', '${new Date(clock.t).toISOString()}')`);
}
function rate(s: EconomyStore, ownerId: string, rating: number) {
  s.unsafeExec(
    `INSERT INTO ratings (owner_id, rating, rd, volatility, matches, last_day, updated_at) VALUES ('${ownerId}', ${rating}, 70, 0.06, 8, '2026-11-02', '${new Date(clock.t).toISOString()}')
     ON CONFLICT (owner_id) DO UPDATE SET rating = excluded.rating, matches = excluded.matches`,
  );
}

let store: EconomyStore | null = null;
try {
  say("Owner API demo 007 — coin skins, the game lane's half (session 69)");
  say("=".repeat(72));

  section("1. A season file from before coins (schema v19), opened by this code (v20)");
  const dbFile = join(tempDir, "season-0.db");
  const v19 = EconomyStore.open(dbFile, { now: () => new Date(clock.t), migrateTo: 19, cosmetics: COSMETICS.filter((c) => c.kind !== "coin" || c.itemId === "coin-chrome-token") });
  const mk = (s: EconomyStore, name: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null", kind: "player" | "house" = "player") => {
    const o = s.createAccount({ name, username: name.toLowerCase(), password: PASSWORD, kind });
    names.set(o.ownerId, `<owner ${name}>`);
    const { copies } = s.grantStarterCollection(o.ownerId, faction);
    const a = s.createAgent({ ownerId: o.ownerId, name: `${name}-unit` });
    names.set(a.agentId, `<agent ${name}-unit>`);
    const deck = s.saveDeck(o.ownerId, `${faction} starter`, copies.map((c) => c.copyId));
    s.setActiveDeck(o.ownerId, deck.deckId);
    s.connectAgent(o.ownerId, a.agentId);
    return { ownerId: o.ownerId, agentId: a.agentId };
  };
  const nova = mk(v19, "Nova", "Swarm");
  const vex = mk(v19, "Vex", "Aegis", "house");
  v19.startMatch({ matchId: "before-v20", p1OwnerId: nova.ownerId, p2OwnerId: vex.ownerId });
  v19.recordMatch({ matchId: "before-v20", seed: 1, p1AgentId: nova.agentId, p2AgentId: vex.agentId, outcome: { kind: "win", winnerAgentId: vex.agentId }, finalHealth: { p1: 0, p2: 7 } });
  say(`  v${v19.schemaVersion}: Nova owns ${v19.ownedCosmetics(nova.ownerId).map((c) => c.itemId).join(", ")}`);
  say(`  v${v19.schemaVersion}: one match recorded ("before-v20")`);
  v19.close();
  store = EconomyStore.open(dbFile, { now: () => new Date(clock.t), cosmetics: DRAWN });
  say(`  reopened: schema v${store.schemaVersion}`);
  api = await startOwnerApi({ store, port: 0 });
  await signIn("nova");
  const owned = (await call("GET", "/api/cosmetics")).body.owned;
  const token0 = owned.find((c: { itemId: string }) => c.itemId === "coin-chrome-token");
  say(`  Nova now owns ${owned.length} cosmetics; the coin: ${token0.itemId} (${token0.kind}, source ${token0.source}, acquired ${token0.acquiredAt})`);
  check("the migration gives the Chrome Token with the starter collection's time", token0.acquiredAt === store.getOwner(nova.ownerId).starterGrantedAt);
  const old = (await call("GET", "/api/matches/before-v20")).body;
  say(`  the old match: coins ${JSON.stringify(old.coins)}, ratingAtStart p1 ${old.p1.ratingAtStart} / p2 ${old.p2.ratingAtStart}, defaultView ${old.defaultView}`);
  say(`    (no coin was recorded before v20, so it reads as the Chrome Token; the v19 match was rated, so its starting ratings come from its ratings' "before")`);

  section("2. The loadout's sixth slot: Coin");
  const lo = (await call("GET", `/api/agents/${nova.agentId}/loadout`)).body;
  for (const sl of lo.slots) say(`  ${sl.slot.padEnd(13)} kind ${sl.kind.padEnd(8)} equipped ${String(sl.itemId).padEnd(28)} choices [${sl.choices.join(", ")}]`);
  check("six slots, the coin last, the Chrome Token equipped", lo.slots.length === 6 && lo.slots[5].slot === "coin" && lo.loadout.coin === "coin-chrome-token");

  section("3. The store's coins (marked drawn here, as the render lane will mark them)");
  credit(store, nova.ownerId, 400);
  const before = store.balance(nova.ownerId);
  const shop = (await call("GET", "/api/store")).body;
  for (const c of shop.cosmetics.filter((x: { kind: string }) => x.kind === "coin")) say(`  on sale: ${c.itemId} "${c.name}", ${c.priceCredits} credits, season ${c.season}`);
  await call("POST", "/api/store/cosmetics/coin-chrome-token/buy");
  await call("POST", "/api/store/cosmetics/coin-s0-mythic/buy");
  const bought = (await call("POST", "/api/store/cosmetics/coin-s0-neon-nickel/buy")).body;
  say(`  bought ${bought.cosmetic.itemId}; credits left ${bought.wallet.credits}`);
  await call("POST", "/api/store/cosmetics/coin-s0-dial-up-dime/buy");
  await call("PUT", `/api/agents/${nova.agentId}/loadout/coin`, { itemId: "boast-swarm-hive-burst" });
  const equipped = (await call("PUT", `/api/agents/${nova.agentId}/loadout/coin`, { itemId: "coin-s0-neon-nickel" })).body;
  say(`  Nova-unit's coin: ${equipped.loadout.coin}`);
  check("Neon Nickel bought for 300 and equipped", bought.wallet.credits === before - 300 && equipped.loadout.coin === "coin-s0-neon-nickel");

  section("4. A live match: both coins, both arenas, starting ratings, the default view");
  rate(store, vex.ownerId, 1712.4); // Vex goes in rated higher than Nova (1500)
  const logDir = join(tempDir, "matches");
  await api.close();
  let n = 0;
  const live = new LiveLadder({ store, seed: 69, build: { games: 0 }, matchId: () => `live-${++n}`, now: () => clock.t, logDir, housePacks: false, roundGapMs: 30_000 });
  api = await startOwnerApi({ store, port: 0, live, matchFiles: logDir });
  await signIn("nova");
  await call("PUT", "/api/play/auto-play", { on: true });
  await live.tick();
  const lv = (await call("GET", "/api/live")).body.matches[0];
  for (const seat of ["p1", "p2"] as const) {
    const s = lv[seat];
    say(redact(`  ${seat}: ${s.ownerName.padEnd(5)} rating ${s.rating.toFixed(1)} (${s.tier}), coin ${s.coin}, arena ${s.arena}`));
  }
  const vexSeat = lv.p1.ownerId === vex.ownerId ? "p1" : "p2";
  say(`  defaultView: ${lv.defaultView} (the higher-rated side: Vex is ${vexSeat})`);
  check("the live view's default is the higher-rated side", lv.defaultView === vexSeat);
  check("the live view sends both coins", [lv.p1.coin, lv.p2.coin].sort().join() === "coin-chrome-token,coin-s0-neon-nickel");
  const lockedTry = await call("PUT", `/api/agents/${nova.agentId}/loadout/coin`, { itemId: "coin-chrome-token" });
  check("no coin change during the live match", lockedTry.status === 409);

  section("5. The recorded match and its replay");
  clock.t += 60 * 60_000;
  await live.tick();
  const id = lv.matchId as string;
  const rec = (await call("GET", `/api/matches/${id}`)).body;
  say(redact(`  outcome ${rec.outcome}, winner ${rec.winnerOwnerId}, turns ${rec.turns}`));
  say(`  coins ${JSON.stringify(rec.coins)}`);
  say(`  ratingAtStart p1 ${rec.p1.ratingAtStart.toFixed(1)} / p2 ${rec.p2.ratingAtStart.toFixed(1)}; rating now p1 ${rec.p1.rating.after.rating.toFixed(1)} / p2 ${rec.p2.rating.after.rating.toFixed(1)}`);
  say(`  defaultView ${rec.defaultView}`);
  check("the record keeps the live view's coins and default", JSON.stringify(rec.coins) === JSON.stringify({ p1: lv.p1.coin, p2: lv.p2.coin }) && rec.defaultView === lv.defaultView);
  check("the record keeps the starting ratings, not the new ones", rec[vexSeat].ratingAtStart === 1712.4 && rec[vexSeat].rating.after.rating !== 1712.4);
  const replay = (await call("GET", `/api/matches/${id}/replay`)).body as ReplayFile;
  say(`  replay ${replay.format}: coins ${JSON.stringify(replay.coins)}`);
  const log = (await call("GET", `/api/matches/${id}/log`)).body as string;
  const { state } = rebuildReplay(replay);
  const rebuilt = `${formatLog(state.log)}\n` === log;
  say(`  the replay rebuilt in the engine equals the served log: ${rebuilt ? "IDENTICAL" : "DIFFERENT"}`);
  check("the replay carries the record's coins", JSON.stringify(replay.coins) === JSON.stringify(rec.coins));
  check("the replay rebuilds the served log", rebuilt);

  section("6. The coin is cosmetic only: one seed, two coins, the same match");
  const playWith = async (coin: string | null) => {
    const s = EconomyStore.open(":memory:", { now: () => new Date(clock.t), cosmetics: DRAWN });
    // House owners always queue (players only with auto-play on).
    const a = mk(s, "Ada", "Cortex", "house");
    const b = mk(s, "Bit", "Null", "house");
    credit(s, a.ownerId, 300);
    s.buyCosmetic(a.ownerId, "coin-s0-dial-up-dime");
    s.setLoadout(a.ownerId, a.agentId, "coin", coin);
    const dir = join(tempDir, `cosmetic-${coin ?? "none"}`);
    const ladder = new Ladder({ store: s, seed: 4242, build: { games: 0 }, matchId: () => "same-seed", logDir: dir, housePacks: false });
    const round = await ladder.runRound();
    const m = round.matches[0]!;
    const out = { log: readFileSync(m.logPath!, "utf8"), credits: [m.record.p1Credits, m.record.p2Credits], rating: m.record.ratings!.p1.after.rating, coins: (JSON.parse(readFileSync(m.replayPath!, "utf8")) as ReplayFile).coins };
    s.close();
    return out;
  };
  const dime = await playWith("coin-s0-dial-up-dime");
  const token1 = await playWith("coin-chrome-token");
  say(`  Ada flips the Dial-Up Dime: replay coins ${JSON.stringify(dime.coins)}`);
  say(`  Ada flips the Chrome Token: replay coins ${JSON.stringify(token1.coins)}`);
  say(`  match log: ${dime.log === token1.log ? "IDENTICAL" : "DIFFERENT"} (${dime.log.split("\n").length - 1} lines); credits ${JSON.stringify(dime.credits)} vs ${JSON.stringify(token1.credits)}; Ada's new rating ${dime.rating.toFixed(3)} vs ${token1.rating.toFixed(3)}`);
  check("the same seed plays the same match whatever the coin", dime.log === token1.log && JSON.stringify(dime.credits) === JSON.stringify(token1.credits) && dime.rating === token1.rating);

  section("7. Season end: the Season 0 tier coins (Platinum, Diamond, Mythic)");
  const end = EconomyStore.open(join(tempDir, "season-end.db"), { now: () => new Date(clock.t) });
  const finishers: [string, number][] = [["Mira", 1985], ["Dax", 1820], ["Pell", 1660], ["Gus", 1600], ["Boz", 1210]];
  const ids = finishers.map(([name, r]) => {
    const o = end.createAccount({ name, username: name.toLowerCase(), password: PASSWORD });
    names.set(o.ownerId, `<owner ${name}>`);
    end.grantStarterCollection(o.ownerId, "Aegis");
    rate(end, o.ownerId, r);
    return o.ownerId;
  });
  const placing = end.createAccount({ name: "Ivo", username: "ivo", password: PASSWORD });
  names.set(placing.ownerId, "<owner Ivo>");
  for (const id2 of [...ids, placing.ownerId]) {
    const p = end.seasonTierCoins(id2);
    say(redact(`  ${id2}: tier ${p.tier.padEnd(9)} earns [${p.coins.map((c) => c.name).join(", ")}]`));
  }
  const granted = end.grantSeasonTierCoins();
  say("  grantSeasonTierCoins():");
  for (const g of granted) say(redact(`    ${g.ownerId} (${g.tier}): ${g.granted.join(", ")}`));
  const again = end.grantSeasonTierCoins();
  say(`  run again: ${again.reduce((t, g) => t + g.granted.length, 0)} coins granted`);
  await api.close();
  api = await startOwnerApi({ store: end, port: 0 });
  await signIn("mira");
  const miraCoins = (await call("GET", "/api/cosmetics")).body.owned.filter((c: { kind: string }) => c.kind === "coin");
  for (const c of miraCoins) say(`  Mira owns ${c.itemId.padEnd(18)} source ${c.source.padEnd(12)} rewardRef ${c.rewardRef}`);
  const miraAgent = end.createAgent({ ownerId: ids[0]!, name: "Mira-unit" });
  names.set(miraAgent.agentId, "<agent Mira-unit>");
  const wear = (await call("PUT", `/api/agents/${miraAgent.agentId}/loadout/coin`, { itemId: "coin-s0-mythic" })).body;
  say(`  Mira-unit's coin: ${wear.loadout.coin}`);
  check("Mythic gets all three, Diamond two, Platinum one; Gold, Bronze and Placement none", JSON.stringify(granted.map((g) => g.granted.length)) === "[3,2,1]");
  check("a second run grants nothing", again.every((g) => g.granted.length === 0));
  end.close();

  section("Checks");
  for (const [what, ok] of checks) say(`  ${ok ? "PASS" : "FAIL"}  ${what}`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
} finally {
  await api?.close();
  store?.close();
  rmSync(tempDir, { recursive: true, force: true });
}
