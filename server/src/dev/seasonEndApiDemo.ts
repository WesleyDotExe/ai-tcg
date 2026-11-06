// Evidence for session 82: the season's end, part 1 (Season 0 game item 3;
// ECONOMY.md "Seasons" and "Prototypes"), over HTTP on a real port, with
// the long-lived ladder on a fake clock playing real engine matches.
//   1. A v25 season file (four house owners, the first the house admin,
//      and two player owners) opens at v26 with the season open.
//   2. Three hours of ladder (everyone on auto-play), so ratings spread and
//      owners place. One Prototype is found from a pack.
//   3. GET /api/season while open: the tier coins the tier would earn now.
//   4. The admin's POST /api/admin/season/end: refused for the wrong season
//      and for a non-admin; then 202 "ending" while matches are shown. The
//      shown matches finish and count; no new round starts; the season ends.
//   5. GET /api/season after: the final standings, each owner's tier coins,
//      the 15 retired Prototype runs with what each found.
//   6. After the end: hours of ladder pair nobody; a pack whose seed rolled
//      a Prototype before rolls a Gold now; ratings don't move; a second
//      POST is refused; the end is kept on disk.
//
//   npx tsx src/dev/seasonEndApiDemo.ts > ../progress/season-end-001.txt
//
// Ids are match numbers and names, so the output is the same every run.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore, LIVE_PACK_ODDS, cardSet, rollPack } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";
import type { LadderEvent } from "../ladder/ladderRunner.js";
import { demoFetch } from "./demoFetch.js";

const say = (line = "") => console.log(line);
const PASSWORD = "a long demo password";
const checks: [string, boolean][] = [];
const check = (what: string, ok: boolean) => {
  checks.push([what, ok]);
  say(`  [${ok ? "PASS" : "FAIL"}] ${what}`);
};
const section = (title: string) => {
  say();
  say(title);
  say("-".repeat(72));
};
const apis: RunningOwnerApi[] = [];
const dir = mkdtempSync(join(tmpdir(), "season-end-demo-"));

try {
  say("Season end demo 001 — ending a season (session 82; Season 0 game item 3, part 1)");
  say("=".repeat(72));
  say("ECONOMY.md: each season is its own file, kept as the season's archive; Prototypes never pulled are");
  say("retired at season end, forever; the tier coins are granted when the season ends, first (roadmap item 3).");
  say("Not in this part: the Season 1 file (what carries over, the ratings' soft reset): an owner check-in.");

  const clock = { t: Date.parse("2026-12-13T23:00:00.000Z") }; // 10:00 Mon 14 Dec in Sydney
  const path = join(dir, "season-0.db");
  const names = new Map<string, string>();

  section("1. A v25 season file opens at v26, the season open");
  {
    const v25 = EconomyStore.open(path, { now: () => new Date(clock.t), migrateTo: 25 });
    const join1 = (name: string, faction: DeckFaction, kind: "house" | "player", isAdmin = false) => {
      const acct = v25.createAccount({ name, username: name.toLowerCase(), password: PASSWORD, kind, isAdmin });
      v25.grantStarterCollection(acct.ownerId, faction);
      const a = v25.createAgent({ ownerId: acct.ownerId, name: `${name}-agent` });
      v25.connectAgent(acct.ownerId, a.agentId);
    };
    join1("Hub", "Null", "house", true);
    join1("Kit", "Cortex", "house");
    join1("Lux", "Swarm", "house");
    join1("Mox", "Aegis", "house");
    join1("Ada", "Cortex", "player");
    join1("Bram", "Aegis", "player");
    say(`  written at schema v${v25.schemaVersion}: ${v25.listOwners().length} owners`);
    v25.close();
  }
  const store = EconomyStore.open(path, { now: () => new Date(clock.t) });
  for (const o of store.listOwners()) names.set(o.ownerId, o.name);
  say(`  reopened: schema v${store.schemaVersion}, season ${store.season}`);
  check("the migrated file's season is open", !store.seasonEnded() && store.seasonEnd() === null);

  const events: LadderEvent[] = [];
  let n = 0;
  const live = new LiveLadder({
    store,
    seed: 82,
    build: { games: 0 },
    matchId: () => `m${++n}`,
    now: () => clock.t,
    housePacks: false,
    roundGapMs: 30_000,
    idleRetryMs: 30_000,
    onEvent: (e) => events.push(e),
  });
  const api = await startOwnerApi({ store, port: 0, live });
  apis.push(api);
  const call = async (method: string, p: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await demoFetch(`http://localhost:${api.port}${p}`, {
      method,
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  const token = async (login: string) => (await call("POST", "/api/session", { body: { login, password: PASSWORD } })).body.token as string;
  const tHub = await token("hub");
  const tAda = await token("ada");
  const tBram = await token("bram");
  const tick = async (seconds: number) => {
    for (let s = 0; s < seconds; s += 5) {
      await live.tick();
      clock.t += 5000;
    }
  };

  section("2. Three hours of ladder; one Prototype found");
  for (const t of [tAda, tBram]) await call("PUT", "/api/play/auto-play", { token: t, body: { on: true } });
  await tick(3 * 3600);
  say(`  ${store.matchHistory().length} matches recorded, ${store.liveMatches().length} being shown now`);
  for (const r of store.ladder()) {
    say(`  ${(r.rank === null ? "-" : `#${r.rank}`).padStart(3)} ${r.ownerName.padEnd(5)} ${r.rating.toFixed(0)} (RD ${r.rd.toFixed(0)}) ${r.tier.padEnd(9)} ${r.wins}-${r.losses}-${r.draws}`);
  }
  const S0 = cardSet("S0");
  const allRuns = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
  let protoSeed = 0;
  while (rollPack(protoSeed, S0, { packsSinceFullArt: 0, packsSinceMythic: 0 }, allRuns, LIVE_PACK_ODDS).pulls[5]?.finish !== "prototype") protoSeed++;
  const adaId = store.listOwners().find((o) => o.name === "Ada")!.ownerId;
  store.grantPack(adaId, "S0", "weeklyChallenge");
  const found = store.openPack(adaId, undefined, { seed: protoSeed }).cards[5]!;
  say(`  Ada opens a pack (seed ${protoSeed}): bonus card ${found.cardId}, ${found.finish}, run ${found.prototype!.runCode} #${found.prototype!.serial}`);

  section("3. GET /api/season while the season is open");
  const open = await call("GET", "/api/season", { token: tAda });
  say(`  ${open.status}: season ${open.body.season}, state ${open.body.state}, ${open.body.liveMatches} match(es) live`);
  for (const [who, t] of [["Hub", tHub], ["Ada", tAda], ["Bram", tBram]] as const) {
    const v = (await call("GET", "/api/season", { token: t })).body;
    say(`  ${who}: tier now ${v.tierCoinsNow.tier}; would earn: ${v.tierCoinsNow.coins.map((c: any) => c.name).join(", ") || "no coin"}`);
  }
  check("open: no standings, no retired runs yet", open.body.standings === null && open.body.retiredPrototypes === null && open.body.endedAt === null);

  section("4. The admin ends the season");
  const wrong = await call("POST", "/api/admin/season/end", { token: tHub, body: { season: "S1" } });
  say(`  Hub, season "S1": ${wrong.status} ${wrong.body.error}`);
  const notAdmin = await call("POST", "/api/admin/season/end", { token: tAda, body: { season: "S0" } });
  say(`  Ada, season "S0": ${notAdmin.status} ${notAdmin.body.error}`);
  check("refused for the wrong season (400) and for a non-admin (403)", wrong.status === 400 && notAdmin.status === 403);
  const shownAtAsk = live.showing().map((s) => s.matchId).sort();
  const recordedAtAsk = store.matchHistory().length;
  const asked = await call("POST", "/api/admin/season/end", { token: tHub, body: { season: "S0" } });
  say(`  Hub, season "S0": ${asked.status}, state ${asked.body.state}, ${asked.body.liveMatches} match(es) being shown: ${shownAtAsk.join(", ")}`);
  let ticks = 0;
  while (!store.seasonEnded() && ticks < 30 * 60) {
    await tick(5);
    ticks += 5;
  }
  const end = store.seasonEnd()!;
  const after = store.matchHistory();
  say(`  ended ${end.endedAt}, ${Math.round(ticks / 60)} min after the ask; ${after.length - recordedAtAsk} match(es) recorded meanwhile`);
  const meanwhile = after.filter((m) => shownAtAsk.includes(m.matchId));
  say(`  ${meanwhile.map((m) => `${m.matchId}: ${m.outcome === "win" ? `${names.get(m.winnerOwnerId!)} wins` : m.outcome}`).join("; ")}`);
  check(
    "the shown matches finished and counted (none cancelled), and no other match started",
    after.length - recordedAtAsk === shownAtAsk.length && meanwhile.length === shownAtAsk.length && meanwhile.every((m) => m.outcome !== "cancelled"),
  );
  const ev = events.find((e) => e.kind === "seasonEnded");
  say(`  ladder event: ${JSON.stringify(ev)}`);

  section("5. GET /api/season after the end");
  const ended = (await call("GET", "/api/season", { token: tAda })).body;
  say(`  state ${ended.state}, ended ${ended.endedAt}, ${ended.liveMatches} live`);
  say("  final standings (rating, RD, tier, W-L-D, tier coins):");
  for (const r of ended.standings) {
    say(
      `  ${(r.rank === null ? "-" : `#${r.rank}`).padStart(3)} ${r.ownerName.padEnd(5)} ${r.agentName.padEnd(11)} ${r.rating.toFixed(1).padStart(6)} ${r.rd.toFixed(1).padStart(5)} ${r.tier.padEnd(9)} ${`${r.wins}-${r.losses}-${r.draws}`.padEnd(8)} ${r.tierCoins.join(", ") || "-"}`,
    );
  }
  say(`  Ada's own line: ${ended.you.rank === null ? "unranked" : `#${ended.you.rank}`}, ${ended.you.tier}`);
  const ladderNow = store.ladder({ at: end.endedAt });
  check(
    "the standings are the ladder as it stood at the end",
    JSON.stringify(ladderNow.map((r) => [r.ownerId, r.rank, r.tier, r.wins, r.losses, r.draws])) === JSON.stringify(ended.standings.map((r: any) => [r.ownerId, r.rank, r.tier, r.wins, r.losses, r.draws])),
  );
  check(
    "each owner holds exactly the tier coins its final tier earns",
    ended.standings.every((r: any) => JSON.stringify(store.seasonTierCoins(r.ownerId, end.endedAt).coins.map((c) => c.itemId)) === JSON.stringify(r.tierCoins)),
  );
  say("  retired Prototype runs (found / retired of the run):");
  for (const r of ended.retiredPrototypes) say(`    ${r.runCode} ${r.cardId.padEnd(7)} /${String(r.runSize).padEnd(4)} found ${r.found}, retired ${r.retired}`);
  const retired = ended.retiredPrototypes.reduce((k: number, r: any) => k + r.retired, 0);
  say(`  ${retired} of 1516 copies retired, ${1516 - retired} found`);
  check("every run is retired, and the one find is counted", ended.retiredPrototypes.length === 15 && retired === 1515 && ended.retiredPrototypes.find((r: any) => r.runCode === found.prototype!.runCode).found === 1);

  section("6. After the end");
  const ratingsNow = () => JSON.stringify(store.listOwners().map((o) => [store.rating(o.ownerId).rating, store.rating(o.ownerId).ratedMatches]));
  const ratingsBefore = ratingsNow();
  const recordedAtEnd = store.matchHistory().length;
  await tick(3 * 3600);
  say(`  three more hours of ladder: ${store.matchHistory().length - recordedAtEnd} matches, ${live.showing().length} shown, auto-play still on for Ada: ${store.autoPlay(adaId).on}`);
  check("no round pairs anyone after the end, and no rating moved", store.matchHistory().length === recordedAtEnd && store.liveMatches().length === 0 && ratingsNow() === ratingsBefore);
  store.grantPack(adaId, "S0", "weeklyChallenge");
  const gold = store.openPack(adaId, undefined, { seed: protoSeed }).cards[5]!;
  say(`  Ada opens a pack with the same seed ${protoSeed}: bonus card ${gold.cardId}, ${gold.finish} (the runs are retired)`);
  check("the Prototype bonus is a Gold now", gold.finish === "gold" && gold.prototype === null);
  const again = await call("POST", "/api/admin/season/end", { token: tHub, body: { season: "S0" } });
  say(`  Hub asks again: ${again.status} ${again.body.error}`);
  let refusal = "";
  try {
    store.unsafeExec("UPDATE ratings SET rating = rating + 100");
  } catch (err) {
    refusal = (err as Error).message;
  }
  say(`  a hand-run edit of the ratings: ${refusal}`);
  check("a second end is refused (409) and the ratings are final in the schema", again.status === 409 && /ratings are final/.test(refusal));
  for (const a of apis.splice(0)) await a.close();
  store.close();
  const reopened = EconomyStore.open(path, { now: () => new Date(clock.t) });
  const kept = reopened.seasonEnd();
  say(`  reopened the file: season ${kept?.season} ended ${kept?.endedAt}, ${kept?.standings.length} standings, ${kept?.retiredPrototypes.length} retired runs`);
  check("the end is kept on disk", kept !== null && kept.endedAt === end.endedAt && JSON.stringify(kept) === JSON.stringify(end));
  reopened.close();

  say();
  say(`Schema v26. ${checks.filter(([, ok]) => ok).length} PASS, ${checks.filter(([, ok]) => !ok).length} FAIL.`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
} finally {
  for (const a of apis) await a.close();
  rmSync(dir, { recursive: true, force: true });
}
