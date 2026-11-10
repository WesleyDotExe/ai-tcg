// Evidence for session 83: the next season's file (Season 0 game item 3,
// part 2; owner 2026-11-07 answers 1-7, 2026-11-08 on unopened packs),
// made from season-end-001's own ended file.
//   1. The season-end demo runs again (it must print progress/season-end-001.txt
//      exactly) and keeps its ended Season 0 file.
//   2. The archive, per owner, as it ended: rating, tier, credits, pack
//      points, cards, unopened packs, decks, cosmetics.
//   3. startNextSeason makes the Season 1 file: what carried, what stayed.
//   4. The Season 1 file over HTTP: every owner signs in with its Season 0
//      password; GET /api/season names where it came from and the caller's
//      soft-reset seed; per owner the same columns as step 2.
//   5. The retired Prototype runs carried: the pack seed that found a
//      Prototype in Season 0 rolls a Gold here.
//   6. Two hours of Season 1 ladder: the agents build decks from the new
//      starter grant, ratings move from the seeds, everyone places again.
//   7. The archive is byte for byte the file it was; making Season 1 twice,
//      or from an open season, is refused.
//
//   npx tsx src/dev/seasonNextApiDemo.ts > ../progress/season-next-001.txt
//
// Ids are match numbers and names, so the output is the same every run.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EconomyStore, LIVE_PACK_ODDS, cardSet, rollPack } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";
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
const here = dirname(fileURLToPath(import.meta.url));
const apis: RunningOwnerApi[] = [];
const dir = mkdtempSync(join(tmpdir(), "season-next-demo-"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);

try {
  say("Season next demo 001 — the next season's file (session 83; Season 0 game item 3, part 2)");
  say("=".repeat(72));
  say("Owner 2026-11-07: cosmetics and loadouts carry; accounts, logins, settings, the Home board, agents and");
  say("names, signature cards carry; the collection, decks, credits, pack points, ratings, history, notifications");
  say("and the daily bank start empty; unopened packs are lost (2026-11-08); ratings soft-reset to");
  say("1500 + (final - 1500) / 2, RD 250, and everyone places again; every owner gets the starter grant again;");
  say("an ended file is frozen completely.");

  section("1. Season 0, ended: season-end-001's own file");
  const s0Path = join(dir, "season-0.db");
  const run = spawnSync(process.execPath, ["--import", "tsx", join(here, "seasonEndApiDemo.ts")], {
    env: { ...process.env, SEASON_END_DEMO_KEEP: s0Path },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const committed = readFileSync(join(here, "../../../progress/season-end-001.txt"), "utf8");
  say(`  the season-end demo ran (exit ${run.status}); its last line: ${run.stdout.trim().split("\n").at(-1)}`);
  check("it printed progress/season-end-001.txt exactly, so this is that file", run.status === 0 && run.stdout === committed);
  const s0Hash = sha(s0Path);

  const clock = { t: Date.parse("2027-01-17T23:00:00.000Z") }; // 10:00 Mon 18 Jan in Sydney
  const now = () => new Date(clock.t);

  section("2. The archive, per owner, as Season 0 ended");
  const columns = (s: EconomyStore) => {
    say("  owner kind    rating   RD   tier       credits  pp  cards unopened decks cosmetics agent (coin)");
    for (const o of s.listOwners()) {
      const r = s.rating(o.ownerId);
      const w = s.wallet(o.ownerId);
      const agent = s.connectedAgent(o.ownerId);
      say(
        `  ${o.name.padEnd(5)} ${o.kind.padEnd(6)} ${r.rating.toFixed(1).padStart(7)} ${r.rd.toFixed(0).padStart(4)}  ${r.tier.padEnd(9)} ${String(w.credits).padStart(8)} ${String(w.packPoints).padStart(3)} ${String(s.collection(o.ownerId).length).padStart(6)} ${String(s.unopenedPacks(o.ownerId).length).padStart(8)} ${String(s.listDecks(o.ownerId).length).padStart(5)} ${String(s.ownedCosmetics(o.ownerId).length).padStart(9)} ${agent?.name ?? "-"} (${agent ? s.loadout(agent.agentId).coin : "-"})`,
      );
    }
  };
  const archive = EconomyStore.open(s0Path, { now });
  say(`  season ${archive.season}, schema v${archive.schemaVersion}, ended ${archive.seasonEnd()!.endedAt}`);
  columns(archive);
  const s0 = {
    owners: archive.listOwners().map((o) => ({ ...o, agent: archive.connectedAgent(o.ownerId), cosmetics: archive.ownedCosmetics(o.ownerId).map((c) => c.itemId) })),
    standings: new Map(archive.seasonEnd()!.standings.map((r) => [r.ownerId, r])),
    sigs: new Map(archive.listAgents().map((a) => [a.agentId, archive.collection(a.ownerId).filter((c) => c.originRef === `signature:${a.agentId}`).map((c) => c.copyId)])),
  };
  archive.close();

  section("3. startNextSeason: the Season 1 file");
  const s1Path = join(dir, "season-1.db");
  const report = EconomyStore.startNextSeason(s0Path, s1Path, { season: "S1", now });
  say(`  ${report.season} made from ${report.fromSeason} (ended ${report.fromEndedAt}) at ${report.startedAt}`);
  say(`  carried: ${report.owners} owners, ${report.logins} logins, ${report.sessions} live sessions, ${report.agents} agents, ${report.signatureCopies} signature copies,`);
  say(`           ${report.cosmetics} cosmetics, ${report.loadoutSlots} loadout slots, ${report.retiredPrototypeRuns} retired Prototype runs, ${report.ratingSeeds} rating seeds`);
  say(`  starter grants: ${report.starterGrants.map((g) => `${s0.owners.find((o) => o.ownerId === g.ownerId)!.name} ${g.faction} ${g.copies} cards + ${g.packs} packs`).join("; ")}`);
  const l = report.leftBehind;
  say(`  left in the archive: ${l.cardCopies} card copies, ${l.unopenedPacks} unopened packs, ${l.decks} decks, ${l.credits} credits, ${l.packPoints} pack points, ${l.matches} matches, ${l.notifications} notifications`);
  check("every owner, login and agent carried, and every one with a starter collection got it again", report.owners === 6 && report.logins === 6 && report.agents === 6 && report.starterGrants.length === 6);

  section("4. The Season 1 file over HTTP");
  const store = EconomyStore.open(s1Path, { now });
  let n = 0;
  const live = new LiveLadder({ store, seed: 83, build: { games: 0 }, matchId: () => `s1-m${++n}`, now: () => clock.t, housePacks: false, roundGapMs: 30_000, idleRetryMs: 30_000 });
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
  say(`  season ${store.season}, schema v${store.schemaVersion}, packs from set ${store.currentSetCode} (no S1 set yet)`);
  const tokens = new Map<string, string>();
  for (const o of s0.owners) {
    const signIn = await call("POST", "/api/session", { body: { login: o.name.toLowerCase(), password: PASSWORD } });
    tokens.set(o.name, signIn.body.token);
  }
  check("every owner signs in with its Season 0 password", [...tokens.values()].every((t) => typeof t === "string" && t.length > 0));
  const hub = (await call("GET", "/api/me", { token: tokens.get("Hub") })).body;
  say(`  Hub: admin ${hub.isAdmin}`);
  for (const who of ["Kit", "Ada", "Bram"]) {
    const v = (await call("GET", "/api/season", { token: tokens.get(who) })).body;
    const f = s0.standings.get(s0.owners.find((o) => o.name === who)!.ownerId)!;
    say(
      `  ${who.padEnd(4)} GET /api/season: ${v.season} ${v.state}, from ${v.startedFrom.fromSeason}; seed ${v.yourSeed.rating.toFixed(1)} (RD ${v.yourSeed.rd}) from final ${f.rating.toFixed(1)} ${f.tier}`,
    );
  }
  columns(store);
  const after = s0.owners.map((o) => ({ o, now: store.getOwner(o.ownerId) }));
  check(
    "names, kinds, factions and the connected agent carried",
    after.every(({ o, now: x }) => x.name === o.name && x.kind === o.kind && x.startingFaction === o.startingFaction && x.connectedAgentId === o.connectedAgentId),
  );
  check(
    "every cosmetic carried (from S0), the loadouts too; the tier coins among them",
    s0.owners.every((o) => JSON.stringify(store.ownedCosmetics(o.ownerId).map((c) => c.itemId)) === JSON.stringify(o.cosmetics) && store.ownedCosmetics(o.ownerId).every((c) => c.carriedFrom === "S0")) &&
      store.ownedCosmetics(s0.owners.find((o) => o.name === "Kit")!.ownerId).some((c) => c.source === "seasonReward"),
  );
  const sigCount = [...s0.sigs.values()].reduce((k, ids) => k + ids.length, 0);
  say(`  signature copies: ${sigCount} in the archive (season-end-001's agents were made plainly, without the generator), ${report.signatureCopies} carried;`);
  say("  a generated agent's card and bound copy carrying over is in economy/test/nextSeason.test.ts");
  check(
    "every signature copy the archive holds carried, with its copy id",
    report.signatureCopies === sigCount && [...s0.sigs].every(([agentId, ids]) => ids.every((id) => store.getCopy(id).originRef === `signature:${agentId}`)),
  );
  check(
    "credits, pack points, decks and history start empty; the S0 packs are gone; only the starter grant is held",
    s0.owners.every(
      (o) =>
        store.wallet(o.ownerId).credits === 0 &&
        store.wallet(o.ownerId).packPoints === 0 &&
        store.listDecks(o.ownerId).length === 0 &&
        store.matchHistory({ ownerId: o.ownerId }).length === 0 &&
        store.unopenedPacks(o.ownerId).length === 3,
    ),
  );
  check(
    "every seed is 1500 + (final - 1500) / 2 at RD 250, volatility kept, and everyone is in placement",
    s0.owners.every((o) => {
      const f = s0.standings.get(o.ownerId)!;
      const r = store.rating(o.ownerId);
      return Math.abs(r.rating - (1500 + (f.rating - 1500) / 2)) < 1e-9 && r.rd === 250 && r.volatility === f.volatility && r.tier === "Placement";
    }),
  );

  section("5. The retired Prototype runs carried");
  const S0 = cardSet("S0");
  const allRuns = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
  let protoSeed = 0;
  while (rollPack(protoSeed, S0, { packsSinceFullArt: 0, packsSinceMythic: 0 }, allRuns, LIVE_PACK_ODDS).pulls[5]?.finish !== "prototype") protoSeed++;
  const ada = s0.owners.find((o) => o.name === "Ada")!;
  store.grantPack(ada.ownerId, store.currentSetCode, "weeklyChallenge");
  const gold = store.openPack(ada.ownerId, store.unopenedPacks(ada.ownerId).at(-1)!.packId, { seed: protoSeed }).cards[5]!;
  say(`  Ada opens a pack with seed ${protoSeed} (a Prototype in Season 0): bonus card ${gold.cardId}, ${gold.finish}`);
  check("the Prototype bonus is a Gold: no retired run mints again", gold.finish === "gold" && gold.prototype === null);

  section("6. Two hours of Season 1 ladder");
  say(`  auto-play for Ada and Bram: ${store.autoPlay(ada.ownerId).on ? "on" : "off"} (it starts off; they switch it on)`);
  for (const who of ["Ada", "Bram"]) await call("PUT", "/api/play/auto-play", { token: tokens.get(who), body: { on: true } });
  for (let s = 0; s < 2 * 3600; s += 5) {
    await live.tick();
    clock.t += 5000;
  }
  say(`  ${store.matchHistory().length} matches recorded`);
  for (const r of store.ladder()) {
    const seed = store.ratingSeed(r.ownerId)!;
    say(`  ${(r.rank === null ? "-" : `#${r.rank}`).padStart(3)} ${r.ownerName.padEnd(5)} ${r.rating.toFixed(0)} (RD ${r.rd.toFixed(0)}) ${r.tier.padEnd(9)} ${`${r.wins}-${r.losses}-${r.draws}`.padEnd(8)} seed ${seed.rating.toFixed(0)}`);
  }
  for (const o of s0.owners.slice(0, 2)) {
    const d = store.listDecks(o.ownerId)[0];
    say(`  ${o.name}'s agent deck: ${d ? `${d.faction}, ${d.list.reduce((k: number, c: { copies: number }) => k + c.copies, 0)} cards, built from the new starter grant` : "none"}`);
  }
  const first = store.matchById("s1-m1")!;
  say(`  s1-m1: ${s0.owners.find((o) => o.ownerId === first.p1OwnerId)!.name} played from ${first.ratings!.p1.before.rating.toFixed(1)} (RD ${first.ratings!.p1.before.rd})`);
  const p1Seed = store.ratingSeed(first.p1OwnerId)!;
  check("the season's first match rated from the seeds", first.ratings !== null && Math.abs(first.ratings.p1.before.rating - p1Seed.rating) < 1e-9 && first.ratings.p1.before.rd === 250);
  check("every owner placed again after 5 rated matches, not before", store.ladder().every((r) => (r.rank !== null) === (r.ratedMatches >= 5)));

  section("7. The archive, and the refusals");
  for (const a of apis.splice(0)) await a.close();
  store.close();
  // (The hash itself differs per run: ids and password salts are random.)
  say(`  Season 0 file: sha256 before and after ${sha(s0Path) === s0Hash ? "the same" : "DIFFERENT"}`);
  check("the archive is byte for byte the file it was", sha(s0Path) === s0Hash);
  const refused = (fn: () => unknown) => {
    try {
      fn();
      return "(not refused)";
    } catch (err) {
      return (err as Error).message;
    }
  };
  const twice = refused(() => EconomyStore.startNextSeason(s0Path, s1Path, { season: "S1", now }));
  const fromOpen = refused(() => EconomyStore.startNextSeason(s1Path, join(dir, "season-2.db"), { season: "S2", now }));
  say(`  Season 1 again onto its file: ${twice.replace(dir, "<dir>")}`);
  say(`  Season 2 from the open Season 1: ${fromOpen}`);
  check("both are refused", /already exists/.test(twice) && /hasn't ended/.test(fromOpen));

  say();
  say(`Schema v${EconomyStore.open(":memory:").schemaVersion}. ${checks.filter(([, ok]) => ok).length} PASS, ${checks.filter(([, ok]) => !ok).length} FAIL.`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
} finally {
  for (const a of apis) await a.close();
  rmSync(dir, { recursive: true, force: true });
}
