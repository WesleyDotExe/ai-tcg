// Evidence for session 78: the Stats page's data (roadmap 2e; owner
// 2026-11-05, the 2026-10-05 spec's Stats page and the Rating & form
// widget), over HTTP on a real port, from the long-lived ladder on a fake
// clock playing real engine matches.
//   1. Three player owners (Ada Cortex, Bram Aegis, Cyra Swarm) and a house
//      owner (Hub, Null). Mon 2 Nov (Sydney): everyone's agent on auto-play
//      for 45 minutes at watch speed.
//   2. Wed 4 Nov: Ada connects a second agent and plays 45 minutes more.
//   3. Tue 10 Nov: Ada reads GET /api/stats ("All agents"): the totals, win
//      rate by her faction and by the opponent's, recent results, the
//      rating chart over 14 days and the weekly trend. Every figure is
//      checked against the match history it is counted from.
//   4. The agent filter, one agent at a time: the counts add up to "All
//      agents"; the rating (the owner's) is the same under every filter.
//   5. Bad requests.
//
//   npx tsx src/dev/statsApiDemo.ts > ../progress/stats-001.txt
//
// Ids are match numbers and names, so the output is the same every run.

import { type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";

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
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const sign = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}`;
const apis: RunningOwnerApi[] = [];

try {
  say("Stats demo 001 — the Stats page and the Rating & form widget (session 78)");
  say("=".repeat(72));
  say("Owner 2026-11-05 (roadmap 2e), the 2026-10-05 spec's Stats page: rating chart; matches, wins, win rate");
  say("and best streak; recent results; win rate by faction; today's earnings; the \"All agents\" / one-agent");
  say("filter. Quests and achievements are after Season 0 (not built). Cancelled and abandoned matches are void");
  say("in every count (as the economy pays them nothing); an abandon is still rated. The rating is the owner's.");

  const clock = { t: Date.parse("2026-11-01T23:00:00.000Z") }; // 10:00 Mon 2 Nov in Sydney
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const names = new Map<string, string>();
  const join1 = (name: string, faction: DeckFaction, kind: "house" | "player") => {
    const acct = store.createAccount({ name, username: name.toLowerCase(), password: PASSWORD, kind });
    store.grantStarterCollection(acct.ownerId, faction);
    const a = store.createAgent({ ownerId: acct.ownerId, name: `${name}-agent` });
    store.connectAgent(acct.ownerId, a.agentId);
    names.set(acct.ownerId, name);
    return { ownerId: acct.ownerId, agentId: a.agentId };
  };
  const ada = join1("Ada", "Cortex", "player");
  const bram = join1("Bram", "Aegis", "player");
  const cyra = join1("Cyra", "Swarm", "player");
  join1("Hub", "Null", "house");

  let n = 0;
  const live = new LiveLadder({ store, seed: 78, build: { games: 0 }, matchId: () => `m${++n}`, now: () => clock.t, housePacks: false, roundGapMs: 30_000, idleRetryMs: 30_000 });
  const api = await startOwnerApi({ store, port: 0, live });
  apis.push(api);
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await fetch(`http://localhost:${api.port}${path}`, {
      method,
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  const token = async (login: string) => (await call("POST", "/api/session", { body: { login, password: PASSWORD } })).body.token as string;
  const tAda = await token("ada");
  const tokens = [tAda, await token("bram"), await token("cyra")];
  const play = async (minutes: number) => {
    for (const t of tokens) await call("PUT", "/api/play/auto-play", { token: t, body: { on: true } });
    for (let s = 0; s < minutes * 60; s += 5) {
      await live.tick();
      clock.t += 5000;
    }
    for (const t of tokens) await call("PUT", "/api/play/auto-play", { token: t, body: { on: false } });
    // Let the last round's matches finish before anyone switches agents.
    for (let s = 0; s < 20 * 60 && store.liveMatches().length > 0; s += 5) {
      await live.tick();
      clock.t += 5000;
    }
  };

  section("1-2. The ladder: Mon 2 Nov 45 min; Wed 4 Nov 45 min, Ada on a second agent");
  await play(45);
  const day1 = store.matchHistory({ ownerId: ada.ownerId }).length;
  say(`  Mon 2 Nov: Ada played ${day1} match(es) with Ada-agent.`);
  clock.t = Date.parse("2026-11-03T23:00:00.000Z"); // 10:00 Wed 4 Nov
  const two = store.createAgent({ ownerId: ada.ownerId, name: "Ada-two" }).agentId;
  store.connectAgent(ada.ownerId, two);
  await play(45);
  const history = store.matchHistory({ ownerId: ada.ownerId });
  say(`  Wed 4 Nov: Ada played ${history.length - day1} more with Ada-two.`);
  check("a live match's deck faction is kept on every record (schema v24)", history.every((m) => m.factions.p1 !== null && m.factions.p2 !== null));

  section("3. Tue 10 Nov: GET /api/stats?days=14 (All agents)");
  clock.t = Date.parse("2026-11-09T23:00:00.000Z"); // 10:00 Tue 10 Nov
  const res = await call("GET", "/api/stats?days=14", { token: tAda });
  const st = res.body;
  say(`  ${res.status}; filter choices: ${st.agents.map((a: any) => `${a.name} (${a.matches} matches)`).join(", ")}`);
  const t = st.totals;
  say(
    `  totals: ${t.matches} matches, ${t.wins} W / ${t.losses} L / ${t.draws} D / ${t.void} void, win rate ${pct(t.winRate)}, best streak ${t.bestWinStreak}, ` +
      `now ${t.currentStreak ? `${t.currentStreak.length} ${t.currentStreak.kind}${t.currentStreak.length > 1 ? (t.currentStreak.kind === "win" ? "s" : "es") : ""}` : "none"}, ${t.creditsFromMatches} credits from matches`,
  );
  say("  win rate by Ada's faction / by the opponent's faction (W-L-D, void apart):");
  for (let i = 0; i < st.byFaction.length; i++) {
    const f = st.byFaction[i];
    const o = st.byOpponentFaction[i];
    const cell = (x: any) => (x.matches === 0 ? "—".padEnd(22) : `${x.wins}-${x.losses}-${x.draws} (${x.void} void) ${pct(x.winRate)}`.padEnd(22));
    say(`    ${f.faction.padEnd(7)} played ${cell(f)} against ${cell(o)}`.trimEnd());
  }
  say(`    not recorded (before v24): ${st.factionNotRecorded.matches} / ${st.opponentFactionNotRecorded.matches}`);

  const seatOf = (m: (typeof history)[number]) => (m.p1OwnerId === ada.ownerId ? "p1" : "p2");
  const resultOf = (m: (typeof history)[number]) => (m.outcome === "win" ? (m.winnerOwnerId === ada.ownerId ? "win" : "loss") : m.outcome);
  const count = (pred: (m: (typeof history)[number]) => boolean) => history.filter(pred).length;
  check(
    "totals agree with the match history (and with ownerStats, the older count)",
    t.matches === history.length &&
      t.wins === count((m) => resultOf(m) === "win") &&
      t.losses === count((m) => resultOf(m) === "loss") &&
      t.draws === count((m) => resultOf(m) === "draw") &&
      t.void === count((m) => m.outcome === "cancelled" || m.outcome === "abandoned") &&
      JSON.stringify([t.wins, t.losses, t.draws, t.void, t.bestWinStreak, t.creditsFromMatches]) ===
        JSON.stringify((({ wins, losses, draws, void: v, bestWinStreak, creditsFromMatches }) => [wins, losses, draws, v, bestWinStreak, creditsFromMatches])(store.ownerStats(ada.ownerId))),
  );
  check(
    "every opponent-faction row is the matches against that faction in the history",
    st.byOpponentFaction.every((o: any) => o.matches === count((m) => m.factions[seatOf(m) === "p1" ? "p2" : "p1"] === o.faction)),
  );
  check("Ada's own faction is Cortex in every match", st.byFaction.find((f: any) => f.faction === "Cortex").matches === history.length);

  say("  recent results (newest first):");
  for (const r of st.recent) {
    say(
      `    ${r.matchId.padEnd(4)} ${r.endedAt.slice(0, 16)}Z ${r.agentName.padEnd(9)} ${r.result.padEnd(9)} v ${r.opponent.agentName} (${r.opponent.ownerName}, ${r.opponent.faction}), ` +
        `${r.credits} credits, ${r.rating === null ? "unrated" : `${sign(r.rating.change)} rating`}, ${r.turns} turns`,
    );
  }
  check("recent results are the newest 10, newest first", st.recent.map((r: any) => r.matchId).join() === history.map((m) => m.matchId).reverse().slice(0, 10).join());

  say("  rating chart (14 Sydney days, ending today):");
  for (const d of st.rating.chart) {
    say(`    ${d.day}  ${d.rating.toFixed(1).padStart(7)}  ${d.rated === 0 ? "" : `${d.rated} rated: ${d.wins}-${d.losses}-${d.draws}`}`.trimEnd());
  }
  say(`  now ${st.rating.now.rating.toFixed(1)} (RD ${st.rating.now.rd.toFixed(1)}, ${st.rating.now.tier}); a week ago (end of Tue 3 Nov) ${st.rating.weekAgo.toFixed(1)}; weekly trend ${sign(st.rating.weekChange)}`);
  const byDay = new Map(st.rating.chart.map((d: any) => [d.day, d]));
  const lastOn = (prefix: string) => {
    const rated = history.filter((m) => m.ratings !== null && m.endedAt <= prefix);
    const last = rated.at(-1);
    return last ? last.ratings![seatOf(last)].after.rating : 1500;
  };
  check("Mon 2 Nov closes on the rating after that day's last rated match", (byDay.get("2026-11-02") as any).rating === lastOn("2026-11-02T13:00:00.000Z"));
  check("idle days carry the rating over; the chart ends today at the rating now", (byDay.get("2026-11-03") as any).rating === (byDay.get("2026-11-02") as any).rating && st.rating.chart.at(-1).day === "2026-11-10" && st.rating.chart.at(-1).rating === st.rating.now.rating);
  check("the weekly trend is now minus the end of Tue 3 Nov, so it holds Wed 4 Nov's matches", st.rating.weekAgo === (byDay.get("2026-11-03") as any).rating && Math.abs(st.rating.weekChange - (st.rating.now.rating - st.rating.weekAgo)) < 1e-9);
  say(`  today's earnings (as GET /api/daily): ${st.today.day}, ${st.today.credits} credits, next win pays ${st.today.nextWinPays}`);
  check("today's earnings are GET /api/daily's", JSON.stringify(st.today) === JSON.stringify((await call("GET", "/api/daily", { token: tAda })).body));

  section("4. The agent filter (GET /api/stats?agent=...)");
  const per: any[] = [];
  for (const a of st.agents) {
    const one = (await call("GET", `/api/stats?agent=${a.agentId}&days=14`, { token: tAda })).body;
    per.push(one);
    const o = one.totals;
    say(`  ${a.name.padEnd(9)} ${o.matches} matches, ${o.wins} W / ${o.losses} L / ${o.draws} D / ${o.void} void, ${pct(o.winRate)}, best streak ${o.bestWinStreak}; recent: ${one.recent.map((r: any) => r.matchId).join(" ")}`);
  }
  check("the two agents' counts add up to All agents", ["matches", "wins", "losses", "draws", "void", "creditsFromMatches"].every((k) => per.reduce((s, p) => s + p.totals[k], 0) === t[k]));
  check("each agent's recent results are only that agent's", per.every((p) => p.recent.every((r: any) => r.agentId === p.agentId)));
  check("the rating is the owner's: the same chart under every filter", per.every((p) => JSON.stringify(p.rating) === JSON.stringify(st.rating)));

  section("5. Bad requests");
  for (const q of ["days=6", "days=91", "recent=0", "recent=51", `agent=${bram.agentId}`]) {
    const r = await call("GET", `/api/stats?${q}`, { token: tAda });
    say(`  ?${q.replace(bram.agentId, "<Bram's agent>")}: ${r.status} ${r.body.error.replace(bram.agentId, "<Bram's agent>")}`);
  }
  check("400 for days or recent out of range; 404 for another owner's agent", (await call("GET", "/api/stats?days=6", { token: tAda })).status === 400 && (await call("GET", `/api/stats?agent=${cyra.agentId}`, { token: tAda })).status === 404);

  say();
  const failed = checks.filter(([, ok]) => !ok);
  say(`${checks.length - failed.length} PASS, ${failed.length} FAIL`);
  if (failed.length > 0) process.exitCode = 1;
} finally {
  for (const a of apis) await a.close();
}
