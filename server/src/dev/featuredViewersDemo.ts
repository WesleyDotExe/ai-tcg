// Evidence for session 74: featured picks ("Top rated" in Watch live) and
// viewer counts, over HTTP on a real port, from the long-lived ladder on a
// fake clock. Nothing here is set by hand: every rating comes from matches
// the ladder itself played and recorded.
//   1. Eight house owners play five rounds on the ladder, so each finishes
//      placement with a rating from real matches.
//   2. Two new owners join (still in placement). The next round: every
//      live match with its sides' starting ratings and tiers, which are
//      featured and why, and the group checked against the rule by hand.
//   3. Viewers: three spectators and one player owner watch on the site's
//      own cadence (a read every 3 s on screen, every 15 s in a hidden
//      tab), then leave; the count read from the list every 10 s, and each
//      change checked against who read the feed in the last 30 s.
//   4. The match is recorded: its count goes, the next round starts at 0.
//
//   npx tsx src/dev/featuredViewersDemo.ts > ../progress/featured-viewers-001.txt
//
// Ids are match numbers and owner names, so the output is the same every run.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore, PLACEMENT_MATCHES } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { LiveLadder, type LiveMatchView } from "../ladder/liveLadder.js";
import { TOP_RATED_MAX } from "../ladder/featured.js";
import { VIEWER_WINDOW_MS } from "../ladder/viewers.js";
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
const pad = (s: string | number, n: number) => String(s).padEnd(n);

const HOUSE: [string, DeckFaction][] = [
  ["Arc", "Cortex"],
  ["Bit", "Swarm"],
  ["Cog", "Aegis"],
  ["Dex", "Null"],
  ["Echo", "Cortex"],
  ["Flux", "Swarm"],
  ["Grid", "Aegis"],
  ["Hex", "Null"],
];
const LATE: [string, DeckFaction][] = [
  ["Ion", "Cortex"],
  ["Jot", "Aegis"],
];

const tmp: string[] = [];
const apis: RunningOwnerApi[] = [];

try {
  say("Featured and viewers demo 001 — Watch live's \"Top rated\" group and viewer counts (session 74)");
  say("=".repeat(72));
  say("Proposed Top rated rule (an owner check-in): both sides out of placement; ranked by the weaker");
  say(`side's rating as the match started; ties by the stronger side, the earlier start, the id; at most`);
  say(`${TOP_RATED_MAX}; no rating floor in Season 0. Tournament: empty until tournaments exist (after Season 0).`);
  say(`Proposed viewer rule: a signed-in owner reading the match's feed (GET /api/live/:id) in the last`);
  say(`${VIEWER_WINDOW_MS / 1000} s, once however many tabs; the players' own owners count; reading the list isn't watching.`);

  const clock = { t: Date.parse("2026-11-05T22:00:00.000Z") };
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const join1 = (name: string, faction: DeckFaction, kind: "house" | "player") => {
    const acct = store.createAccount({ name, username: name.toLowerCase(), password: PASSWORD, kind });
    store.grantStarterCollection(acct.ownerId, faction);
    const a = store.createAgent({ ownerId: acct.ownerId, name: `${name}-agent` });
    store.connectAgent(acct.ownerId, a.agentId);
    return acct.ownerId;
  };
  for (const [name, faction] of HOUSE) join1(name, faction, "house");
  for (const name of ["Viewer1", "Viewer2", "Viewer3"]) store.createAccount({ name, username: name.toLowerCase(), password: PASSWORD, kind: "player" });

  const logDir = mkdtempSync(join(tmpdir(), "featured-demo-"));
  tmp.push(logDir);
  let n = 0;
  let recordedCount = 0;
  const live = new LiveLadder({
    store,
    seed: 74,
    build: { games: 0 },
    matchId: () => `m${++n}`,
    now: () => clock.t,
    logDir,
    housePacks: false,
    roundGapMs: 30_000,
    onRecorded: () => recordedCount++,
  });
  const api = await startOwnerApi({ store, port: 0, live, matchFiles: logDir });
  apis.push(api);
  const tokens = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = async (path: string, who: string): Promise<{ status: number; body: any }> => {
    if (!tokens.has(who)) {
      const res = await demoFetch(`http://localhost:${api.port}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: who.toLowerCase(), password: PASSWORD }) });
      tokens.set(who, ((await res.json()) as { token: string }).token);
    }
    const res = await demoFetch(`http://localhost:${api.port}${path}`, { headers: { Authorization: `Bearer ${tokens.get(who)}` } });
    return { status: res.status, body: await res.json() };
  };
  /** Ticks a second at a time until every live match is recorded. */
  const runRound = async () => {
    await live.tick();
    while (live.liveMatches().length > 0) {
      clock.t += 1000;
      await live.tick();
    }
    clock.t += 30_000;
  };

  // ---------------------------------------------------------------------
  section("1. Five ladder rounds: eight house owners play out their placement");
  for (let round = 1; round <= 5; round++) {
    await live.tick();
    const pairs = live.liveMatches().map((x) => `${x.p1.ownerName}-${x.p2.ownerName}`);
    await runRound();
    say(`  round ${round}: ${pairs.join(", ")}`);
  }
  say();
  say(`  ${pad("owner", 8)}${pad("rating", 8)}${pad("matches", 9)}tier`);
  for (const [name] of HOUSE) {
    const r = store.rating(store.listOwners().find((o) => o.name === name)!.ownerId);
    say(`  ${pad(name, 8)}${pad(Math.round(r.rating), 8)}${pad(r.ratedMatches, 9)}${r.tier}`);
  }
  check(
    `every house owner has ${PLACEMENT_MATCHES} rated matches and a tier`,
    HOUSE.every(([name]) => {
      const r = store.rating(store.listOwners().find((o) => o.name === name)!.ownerId);
      return r.ratedMatches >= PLACEMENT_MATCHES && r.tier !== "Placement";
    }),
  );

  // ---------------------------------------------------------------------
  section("2. Two new owners join; round 6 as Watch live lists it");
  for (const [name, faction] of LATE) join1(name, faction, "house");
  await live.tick();
  const list = (await call("/api/live", "Viewer1")).body;
  const matches = list.matches as LiveMatchView[];
  say(`  GET /api/live: ${matches.length} live, featured ${JSON.stringify(list.featured)}`);
  say();
  say(`  ${pad("match", 7)}${pad("p1", 20)}${pad("p2", 20)}${pad("weaker", 8)}verdict`);
  const low = (x: LiveMatchView) => Math.min(x.p1.rating, x.p2.rating);
  const high = (x: LiveMatchView) => Math.max(x.p1.rating, x.p2.rating);
  const side = (s: LiveMatchView["p1"]) => `${s.ownerName} ${Math.round(s.rating)} ${s.tier}`;
  for (const x of matches) {
    const at = list.featured.topRated.indexOf(x.matchId);
    const placement = x.p1.tier === "Placement" || x.p2.tier === "Placement";
    const verdict = at >= 0 ? `Top rated #${at + 1}` : placement ? "not featured: a side is in placement" : `not featured: below the top ${TOP_RATED_MAX}`;
    say(`  ${pad(x.matchId, 7)}${pad(side(x.p1), 20)}${pad(side(x.p2), 20)}${pad(Math.round(low(x)), 8)}${verdict}`);
  }
  const byHand = matches
    .filter((x) => x.p1.tier !== "Placement" && x.p2.tier !== "Placement")
    .sort((a, b) => low(b) - low(a) || high(b) - high(a) || Date.parse(a.startedAt) - Date.parse(b.startedAt) || (a.matchId < b.matchId ? -1 : 1))
    .slice(0, TOP_RATED_MAX)
    .map((x) => x.matchId);
  check(`the Top rated group is the rule worked by hand on the list: ${JSON.stringify(byHand)}`, JSON.stringify(list.featured.topRated) === JSON.stringify(byHand));
  check("no match with a side in placement is featured", matches.every((x) => !(x.p1.tier === "Placement" || x.p2.tier === "Placement") || !list.featured.topRated.includes(x.matchId)));
  check(`at most ${TOP_RATED_MAX} featured, and the tournament group is empty`, list.featured.topRated.length <= TOP_RATED_MAX && list.featured.tournament.length === 0);
  check("each side's rating is the one the match started with (ratingAtStart on the store's live record)", matches.every((x) => {
    const r = store.liveMatches().find((l) => l.matchId === x.matchId)?.ratingsAtStart;
    return r != null && r.p1 === x.p1.rating && r.p2 === x.p2.rating;
  }));

  // ---------------------------------------------------------------------
  const target = list.featured.topRated[0] as string;
  const tm = matches.find((x) => x.matchId === target)!;
  const player = tm.p1.ownerName;
  section(`3. Viewers on the top pick, ${target} (${tm.p1.ownerName} v ${tm.p2.ownerName})`);
  say("  Who reads the feed, on the site's cadence (3 s on screen, 15 s in a hidden tab):");
  say("    Viewer1: on screen for the whole of the first 3 minutes, then closes the page");
  say("    Viewer2: two tabs open from 0:30 to 1:30");
  say("    Viewer3: on screen from 1:00, the tab hidden from 2:00 (15 s reads), closed at 4:00");
  say(`    ${player} (the p1 side's owner): watching its own agent from 0:00 to 2:00`);
  type Plan = { who: string; reads: (s: number) => number };
  // How many feed reads each owner makes in second `s` of the window.
  const plans: Plan[] = [
    { who: "Viewer1", reads: (s) => (s < 180 && s % 3 === 0 ? 1 : 0) },
    { who: "Viewer2", reads: (s) => (s >= 30 && s < 90 && s % 3 === 0 ? 2 : 0) },
    { who: "Viewer3", reads: (s) => (s >= 60 && s < 120 && s % 3 === 0 ? 1 : s >= 120 && s < 240 && s % 15 === 0 ? 1 : 0) },
    { who: player, reads: (s) => (s < 120 && s % 3 === 0 ? 1 : 0) },
  ];
  const start = clock.t;
  const lastRead = new Map<string, number>();
  let mismatches = 0;
  const seenCounts: number[] = [];
  say();
  say("  time   viewers  (expected: owners with a read in the last 30 s)");
  for (let s = 0; s <= 300; s++) {
    clock.t = start + s * 1000;
    await live.tick();
    if (live.liveMatch(target) === null) break;
    for (const p of plans) for (let k = 0; k < p.reads(s); k++) {
      await call(`/api/live/${target}?from=0`, p.who);
      lastRead.set(p.who, clock.t);
    }
    if (s % 10 === 0) {
      const got = ((await call("/api/live", "Viewer1")).body.matches as LiveMatchView[]).find((x) => x.matchId === target)!.viewers;
      const want = [...lastRead.entries()].filter(([, t]) => clock.t - t < VIEWER_WINDOW_MS);
      if (got !== want.length) mismatches++;
      seenCounts.push(got);
      say(`  ${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, "0")}   ${pad(got, 9)}${want.map(([w]) => w).join(", ") || "-"}`);
    }
  }
  check("every count read matches the owners who read the feed in the last 30 s", mismatches === 0);
  check("the count reached 4 (Viewer2's two tabs counted once)", Math.max(...seenCounts) === 4);
  check("Viewer3's hidden tab (a read every 15 s) kept it counted", seenCounts[15] !== undefined && seenCounts[15] >= 1);
  check("everyone gone: the count fell back to 0", seenCounts[seenCounts.length - 1] === 0);

  // ---------------------------------------------------------------------
  section("4. The match is recorded");
  await call(`/api/live/${target}?from=0`, "Viewer1");
  while (live.liveMatches().length > 0) {
    clock.t += 1000;
    await live.tick();
  }
  const ended = await call(`/api/live/${target}`, "Viewer1");
  say(`  GET /api/live/${target}: ${ended.status} ${ended.body.error ?? ""}`);
  check("the feed answers 404 once the match is recorded", ended.status === 404);
  clock.t += 31_000;
  await live.tick();
  const next = (await call("/api/live", "Viewer1")).body;
  say(`  round 7: ${next.matches.length} live, viewers ${JSON.stringify((next.matches as LiveMatchView[]).map((x) => x.viewers))}, featured ${JSON.stringify(next.featured)}`);
  check("every match of the next round starts with 0 viewers", (next.matches as LiveMatchView[]).every((x) => x.viewers === 0));
  check(`${recordedCount} matches recorded over the demo, each with a result`, recordedCount > 0 && store.matchHistory({}).length >= recordedCount);

  say();
  const failed = checks.filter(([, ok]) => !ok).length;
  say(`${checks.length - failed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
} finally {
  for (const a of apis) await a.close();
  for (const d of tmp) rmSync(d, { recursive: true, force: true });
}
