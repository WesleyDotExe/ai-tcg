// Evidence for session 77: notifications (schema v23; owner 2026-11-05 and
// 2026-11-06, the top bar's bell and the Notifications widget), over HTTP on
// a real port, from the long-lived ladder on a fake clock.
//   1. Two player owners and two house owners. Ada reads her bell: today's
//      free daily pack is waiting. She claims it (that reads it).
//   2. Ada opens a pack holding a big pull (seeded, through the store, so the
//      demo reproduces; the HTTP open picks its own seed).
//   3. Ada turns auto-play on with 30 minutes; Bram, with match results
//      switched off, turns it on with no time limit. The ladder plays at watch
//      speed and Ada's bell is read every 30 s as the top bar would; each
//      change is printed with what the ladder did.
//   4. Ada's feed in full (GET /api/notifications), newest first, and a page
//      filtered to one kind.
//   5. The day's rewards cap: Cyra's 10 rewarded wins are recorded straight
//      into the store (the ladder at watch speed would take hours), then the
//      server's check after a match switches auto-play off and tells her.
//   6. Reading and clearing: by ids, then all; bad requests change nothing.
//   7. The next Sydney day: a new daily pack notification.
//
//   npx tsx src/dev/notificationsApiDemo.ts > ../progress/notifications-001.txt
//
// Ids are match numbers, notification numbers and owner names, so the output
// is the same every run.

import { type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore, LIVE_PACK_ODDS, cardSet, rollPack } from "@ai-tcg/economy";
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
const sydney = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const clockText = (iso: string | number) => sydney.format(new Date(iso));

/** One feed line, as the Notifications widget might word it. */
function line(x: any): string {
  const head = `#${String(x.notificationId).padStart(2)} ${clockText(x.createdAt)} ${x.readAt ? "read  " : "UNREAD"} ${x.kind.padEnd(15)}`;
  switch (x.kind) {
    case "matchResult": {
      const m = x.matchResult;
      const rating = m.rating === null ? "unrated" : `${m.rating.change >= 0 ? "+" : ""}${m.rating.change.toFixed(1)} rating`;
      return `${head} ${m.matchId}: ${m.agentName} ${m.result} v ${m.opponent.agentName} (${m.opponent.ownerName}), ${m.credits} credits, ${rating}, ${m.turns ?? "?"} turns`;
    }
    case "bigPull":
      return `${head} ${x.bigPull.jackpot ? "Jackpot pack: " : ""}${x.bigPull.cards.map((c: any) => `${c.name} (${c.rarity}, ${c.finish}${c.isNew ? ", NEW" : ""}${c.prototype ? `, ${c.prototype.serial} of ${c.prototype.runSize}` : ""})`).join("; ")}`;
    case "dailyPack":
      return `${head} free daily pack ready for ${x.dailyPack.day} (since ${clockText(x.dailyPack.readySince)}), ${x.dailyPack.waiting} of ${x.dailyPack.cap} waiting`;
    case "autoPlayStopped": {
      const a = x.autoPlayStopped;
      return `${head} auto-play off: ${a.reason === "timeUp" ? `your agent's ${a.allowanceMinutes} minutes are up` : "today's rewards are maxed"} (${a.day})`;
    }
  }
  return head;
}

const apis: RunningOwnerApi[] = [];

try {
  say("Notifications demo 001 — the bell and the Notifications widget (session 77)");
  say("=".repeat(72));
  say("Owner 2026-11-05 / 2026-11-06: what produces a notification in Season 0, and how it is read and cleared.");
  say("The list: match results, big pulls, the free daily pack ready (the 2026-10-05 spec's Settings ->");
  say("Notifications, each with its switch), and auto-play switched off: at the day's rewards cap, or with the");
  say("play-time allowance's time up (no switch). Player owners only. Times below are Sydney wall-clock.");

  const clock = { t: Date.parse("2026-11-08T23:00:00.000Z") }; // 10:00 Mon 9 Nov in Sydney
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const names = new Map<string, string>();
  const agents = new Map<string, string>();
  const join1 = (name: string, faction: DeckFaction, kind: "house" | "player") => {
    const acct = store.createAccount({ name, username: name.toLowerCase(), password: PASSWORD, kind });
    store.grantStarterCollection(acct.ownerId, faction);
    const a = store.createAgent({ ownerId: acct.ownerId, name: `${name}-agent` });
    store.connectAgent(acct.ownerId, a.agentId);
    names.set(acct.ownerId, name);
    agents.set(acct.ownerId, a.agentId);
    return acct.ownerId;
  };
  const ada = join1("Ada", "Cortex", "player");
  const bram = join1("Bram", "Swarm", "player");
  const hub = join1("Hub", "Null", "house");
  join1("Kiln", "Aegis", "house");
  const name = (id: string) => names.get(id) ?? id;

  let n = 0;
  const log: string[] = [];
  const live = new LiveLadder({
    store,
    seed: 77,
    build: { games: 0 },
    matchId: () => `m${++n}`,
    now: () => clock.t,
    housePacks: false,
    roundGapMs: 30_000,
    idleRetryMs: 30_000,
    onEvent: (e) => {
      if (e.kind === "autoPlayStopped") log.push(`auto-play off for ${name(e.ownerId)}: ${e.reason}`);
    },
    onRecorded: (m) => log.push(`${m.record.matchId} recorded (${m.record.outcome}): ${name(m.record.p1OwnerId)} v ${name(m.record.p2OwnerId)}`),
  });
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
  const tAda = (await call("POST", "/api/session", { body: { login: "ada", password: PASSWORD } })).body.token as string;
  const tBram = (await call("POST", "/api/session", { body: { login: "bram", password: PASSWORD } })).body.token as string;
  const bell = async (token: string) => (await call("GET", "/api/notifications?limit=1", { token })).body;

  section("1. The free daily pack (GET /api/notifications, POST /api/packs/daily/claim)");
  let b = await bell(tAda);
  say(`  Ada's bell: ${b.unread} unread; latest: ${line(b.notifications[0])}`);
  check("a new owner's first daily pack is waiting, so the first read tells her", b.unread === 1 && b.notifications[0].kind === "dailyPack");
  const claim = await call("POST", "/api/packs/daily/claim", { token: tAda });
  b = await bell(tAda);
  say(`  claim: ${claim.status}; bell after: ${b.unread} unread (${b.notifications[0].readAt ? "read" : "unread"} at ${clockText(b.notifications[0].readAt)})`);
  check("claiming the last waiting pack marks its notification read", claim.status === 201 && b.unread === 0 && b.notifications[0].readAt !== null);
  b = await bell(tAda);
  check("reading again the same day writes no second one", (await call("GET", "/api/notifications", { token: tAda })).body.notifications.length === 1);

  section("2. A big pull (a pack the ceremony gives its full reveal)");
  const S0 = cardSet("S0");
  const runs = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
  const BIG = new Set(["gold", "prototype", "secret", "zeroDay"]);
  const pity = store.pityStatus(ada);
  let bigSeed = 0;
  while (!rollPack(bigSeed, S0, pity, runs, LIVE_PACK_ODDS).pulls.some((p) => BIG.has(p.finish))) bigSeed++;
  const opened = store.openPack(ada, undefined, { seed: bigSeed });
  say(`  Ada opens her daily pack (seed ${bigSeed}): ${opened.cards.map((c) => `${c.name} [${c.finish}]`).join(", ")}`);
  b = await bell(tAda);
  say(`  bell: ${b.unread} unread; latest: ${line(b.notifications[0])}`);
  check("the full-reveal pack is one bigPull naming its big card(s)", opened.fullReveal && b.notifications[0].kind === "bigPull" && b.notifications[0].bigPull.cards.every((c: any) => BIG.has(c.finish)));

  section("3. The ladder at watch speed; Ada's bell read every 30 s (changes only)");
  await call("PATCH", "/api/account/settings", { token: tBram, body: { notifications: { matchResults: false } } });
  const on = await call("PUT", "/api/play/auto-play", { token: tAda, body: { on: true, minutes: 30 } });
  await call("PUT", "/api/play/auto-play", { token: tBram, body: { on: true } });
  say(`  Ada: auto-play on, 30 minutes (ends ${clockText(on.body.autoPlay.allowance.endsAt)}). Bram: on, no time limit, match results switched off.`);
  let lastUnread = b.unread;
  for (let s = 0; s <= 50 * 60; s += 5) {
    await live.tick();
    for (const l of log.splice(0)) say(`  ${clockText(clock.t)}  ladder: ${l}`);
    if (s % 30 === 0) {
      const now = await bell(tAda);
      if (now.unread !== lastUnread) {
        say(`  ${clockText(clock.t)}  Ada's bell: ${now.unread} unread — ${line(now.notifications[0])}`);
        lastUnread = now.unread;
      }
    }
    clock.t += 5000;
  }
  await call("PUT", "/api/play/auto-play", { token: tBram, body: { on: false } });
  const adaMatches = store.matchHistory({ ownerId: ada });
  const bramMatches = store.matchHistory({ ownerId: bram });
  say(`  Ada played ${adaMatches.length} match(es); Bram ${bramMatches.length} (switched off by hand at ${clockText(clock.t)}).`);

  section("4. Ada's feed (GET /api/notifications), newest first");
  const feed = (await call("GET", "/api/notifications?limit=100", { token: tAda })).body;
  for (const x of feed.notifications) say(`  ${line(x)}`);
  say(`  unread ${feed.unread}; by kind ${JSON.stringify(feed.unreadByKind)}; more=${feed.more}`);
  const results = feed.notifications.filter((x: any) => x.kind === "matchResult");
  check("one match result per match Ada played, in order, each matching the recorded match", results.length === adaMatches.length && results.map((x: any) => x.matchResult.matchId).reverse().join() === adaMatches.map((m) => m.matchId).join());
  check(
    "each result's credits and rating change are the match's own",
    results.every((x: any) => {
      const m = adaMatches.find((h) => h.matchId === x.matchResult.matchId)!;
      const seat = m.p1OwnerId === ada ? "p1" : "p2";
      const r = m.ratings?.[seat];
      return x.matchResult.credits === (seat === "p1" ? m.p1Credits : m.p2Credits) && (r ? Math.abs(x.matchResult.rating.change - (r.after.rating - r.before.rating)) < 1e-9 : x.matchResult.rating === null);
    }),
  );
  check("the time up comes after the last match, once, with the allowance's 30 minutes", feed.notifications[0].kind === "autoPlayStopped" && feed.notifications[0].autoPlayStopped.reason === "timeUp" && feed.notifications[0].autoPlayStopped.allowanceMinutes === 30 && feed.unreadByKind.autoPlayStopped === 1);
  const bramFeed = (await call("GET", "/api/notifications?limit=100", { token: tBram })).body;
  say(`  Bram's feed: ${bramFeed.notifications.map((x: any) => x.kind).join(", ") || "(empty)"}`);
  check("Bram, with match results off, got none of his matches", bramMatches.length > 0 && !bramFeed.notifications.some((x: any) => x.kind === "matchResult"));
  check("house owners got none", store.notifications(hub).notifications.length === 0);
  const filtered = (await call("GET", "/api/notifications?kind=bigPull", { token: tAda })).body;
  say(`  ?kind=bigPull: ${filtered.notifications.length} shown, unread still ${filtered.unread} (the badge counts every kind)`);
  check("a kind filter narrows the list but not the badge", filtered.notifications.length === 1 && filtered.unread === feed.unread);

  section("5. The day's rewards cap (Cyra; 10 wins recorded straight into the store)");
  const cyra = join1("Cyra", "Aegis", "player");
  store.updateAccountSettings(cyra, { notifications: { matchResults: false, dailyPack: false } });
  store.setAutoPlay(cyra, true);
  for (let i = 0; i < 10; i++) {
    clock.t += 60_000;
    store.recordMatch({ matchId: `cap${i + 1}`, seed: i, p1AgentId: agents.get(cyra)!, p2AgentId: agents.get(hub)!, outcome: { kind: "win", winnerAgentId: agents.get(cyra)! } });
  }
  const stopped = store.stopAutoPlayIfMaxed(cyra);
  const cyFeed = store.notifications(cyra).notifications;
  for (const x of cyFeed) say(`  ${line(x)}`);
  check("the cap switches auto-play off and tells her once, though her other switches are off", stopped && cyFeed.length === 1 && cyFeed[0]!.kind === "autoPlayStopped" && !store.stopAutoPlayIfMaxed(cyra));

  section("6. Reading and clearing (POST /api/notifications/read, /clear)");
  const ids: number[] = feed.notifications.map((x: any) => x.notificationId);
  const bramId = bramFeed.notifications[0]?.notificationId ?? 9999;
  for (const [what, path, body] of [
    ["read, no body", "read", undefined],
    ["read { ids: [] }", "read", { ids: [] }],
    ["clear { all: false }", "clear", { all: false }],
    [`read { ids: [${ids[0]}, ${bramId}] } (Bram's)`, "read", { ids: [ids[0], bramId] }],
  ] as const) {
    const r = await call("POST", `/api/notifications/${path}`, { token: tAda, body });
    say(`  ${what.padEnd(38)} ${r.status}  ${r.body.error}`);
  }
  check("bad requests changed nothing", (await bell(tAda)).unread === feed.unread);
  const r1 = await call("POST", "/api/notifications/read", { token: tAda, body: { ids: ids.slice(0, 2) } });
  say(`  read { ids: [${ids.slice(0, 2).join(", ")}] }`.padEnd(40) + ` ${r1.status}  ${JSON.stringify(r1.body)}`);
  const r2 = await call("POST", "/api/notifications/clear", { token: tAda, body: { ids: [ids.at(-1)] } });
  say(`  clear { ids: [${ids.at(-1)}] }`.padEnd(40) + ` ${r2.status}  ${JSON.stringify(r2.body)}`);
  const r3 = await call("POST", "/api/notifications/read", { token: tAda, body: { all: true } });
  say(`  read { all: true }`.padEnd(40) + ` ${r3.status}  ${JSON.stringify(r3.body)}`);
  check("read by ids, cleared one (gone from the feed), then all read", r1.body.marked === 2 && r2.body.cleared === 1 && r3.body.unread === 0 && !(await call("GET", "/api/notifications?limit=100", { token: tAda })).body.notifications.some((x: any) => x.notificationId === ids.at(-1)));

  section("7. The next Sydney day");
  clock.t = Date.parse("2026-11-09T19:30:00.000Z"); // 06:30 Tue 10 Nov in Sydney
  b = await bell(tAda);
  say(`  Ada's bell: ${b.unread} unread; latest: ${line(b.notifications[0])}`);
  check("a new day's pack is a new notification, ready since midnight Sydney", b.unread === 1 && b.notifications[0].kind === "dailyPack" && b.notifications[0].dailyPack.day === "2026-11-10" && clockText(b.notifications[0].dailyPack.readySince) === "00:00:00");
  const cleared = await call("POST", "/api/notifications/clear", { token: tAda, body: { all: true } });
  say(`  clear { all: true } ${cleared.status} ${JSON.stringify(cleared.body)}; feed now ${(await call("GET", "/api/notifications", { token: tAda })).body.notifications.length} item(s)`);

  say();
  say(`Schema v${store.schemaVersion}. ${checks.filter(([, ok]) => ok).length} PASS, ${checks.filter(([, ok]) => !ok).length} FAIL.`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
} finally {
  for (const a of apis) await a.close();
}
