// The site contract check (game session 90, a spare session; a read-only
// check of the render lane's site types against what the server serves).
//
//   npm run check:site-contract -w server > ../progress/site-contract-001.txt
//
// The website's client (`render/src/site/siteApi.ts`, the render lane's) says
// what every owner API call returns, as TypeScript types. Nothing checked
// those types against the server: the render lane wrote them from
// `server/OWNER_API.md` and its tests feed them hand-made answers. This
// drives the render's own client (its `siteApi()`, unchanged, loaded at run
// time) against the real owner API on a real port, over a real season file
// with the real live ladder playing on a fixed clock, and keeps each answer
// as the client parsed it. Then it writes each answer into a TypeScript file
// as a literal assigned to the client's declared return type
// (`Awaited<ReturnType<SiteApi["me"]>>`) and runs the TypeScript compiler on
// it with the render workspace's own settings. Two kinds of finding:
//
//   MISMATCH  the server's answer doesn't fit the type the site reads it as
//             (a field the type needs is missing, or has another shape).
//             The site's code may read something that isn't there.
//   UNTYPED   the server sends a field the site's type doesn't name (an
//             excess property). Harmless to the page; listed so the render
//             lane knows what it could read.
//
// Session 91 (the hardening pass): the run also sets up the shapes one plain
// run never reaches (every history result, a live match's boast, the allowance
// finishing and done, a Prototype, a secret craft, a cosmetic buy); a "Shapes
// reached" list is printed and an unreached one fails the check.
//
// The game lane doesn't edit render files: what this finds goes to the render
// lane in progress/notes-for-owner.md. (One exception, session 94: a new
// allowance state the server sends ("waiting", schema v29) needed the site's
// type and ring to match before CI could pass; said in notes-for-owner.md.) Seeds and the clock are fixed, so the
// output is the same every run.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { type DeckFaction, type PlayStyleId } from "@ai-tcg/engine";
import { EconomyStore, cardSet } from "@ai-tcg/economy";
import { startOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";
import { demoFetch } from "./demoFetch.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const RENDER_API = join(ROOT, "render/src/site/siteApi.ts");
const PW = "correct horse battery";
const BUILD = { games: 4, trials: 8, confirmGames: 8 };
const say = (line = "") => console.log(line);

const CAST: { name: string; login: string | null; kind: "house" | "player"; agent: string; faction: DeckFaction; style: PlayStyleId }[] = [
  { name: "House Cortex", login: null, kind: "house", agent: "Lattice Warden", faction: "Cortex", style: "calculator" },
  { name: "House Swarm", login: null, kind: "house", agent: "Hive Courier", faction: "Swarm", style: "rusher" },
  { name: "House Null", login: null, kind: "house", agent: "Static Widow", faction: "Null", style: "gambler" },
  { name: "Player One", login: "one", kind: "player", agent: "Night Relay", faction: "Aegis", style: "tempo" },
  { name: "Player Two", login: "two", kind: "player", agent: "Quiet Lattice", faction: "Swarm", style: "rusher" },
];

/** One call made through the site's client, and the answer it parsed. */
interface Answer {
  /** The SiteApi method. */
  method: string;
  /** What was asked, for the report. */
  call: string;
  value: unknown;
}

// The render's client, unchanged. Loaded by path at run time so the server's
// own typecheck doesn't take in the render workspace (the seam stays clean).
type AnyApi = Record<string, (...args: unknown[]) => Promise<unknown>>;
const { siteApi } = (await import(pathToFileURL(RENDER_API).href)) as { siteApi: (f: unknown, base: string) => AnyApi };

const dir = mkdtempSync(join(tmpdir(), "site-contract-"));
// 09:00 on Thu 12 Nov 2026 in Sydney.
const clock = { t: Date.parse("2026-11-11T22:00:00.000Z") };
const store = EconomyStore.open(join(dir, "season-0.db"), { now: () => new Date(clock.t) });
const owners: Record<string, string> = {};
for (const c of CAST) {
  const o = c.login ? store.createAccount({ name: c.name, username: c.login, password: PW, kind: c.kind }) : store.createOwner({ name: c.name, kind: c.kind });
  store.grantStarterCollection(o.ownerId, c.faction);
  const a =
    c.faction === "Null"
      ? (() => {
          // Made the way an owner's is (the draft, then its signature card),
          // so the live view has a signature to send.
          const d = store.startAgentDraft(o.ownerId, { seed: 9042 });
          const picked = store.pickDraftAgent(o.ownerId, d.draftId, 0, { seed: 9043 });
          return store.confirmAgentDraft(o.ownerId, picked.draftId, 0, { name: c.agent }).agent;
        })()
      : store.createAgent({ ownerId: o.ownerId, name: c.agent });
  store.setPlayStyle(o.ownerId, a.agentId, c.style);
  store.connectAgent(o.ownerId, a.agentId);
  owners[c.name] = o.ownerId;
}
const one = owners["Player One"]!;
const two = owners["Player Two"]!;
// Packs to open over the API (one, then ten, so the ten-pack summary is sent).
for (let i = 0; i < 11; i++) store.grantPack(one, "S0", "weeklyChallenge");
// Earlier days, one win each over Player Two (the daily schedule's first
// win), so the owner can afford a pack in the Store.
const oneAgent = store.listAgents(one)[0]!.agentId;
const twoAgent = store.listAgents(two)[0]!.agentId;
for (let i = 0; i < 6; i++) {
  const endedAt = new Date(Date.parse("2026-11-01T01:00:00.000Z") + i * 86_400_000).toISOString();
  store.recordMatch({ matchId: `earlier-${i}`, seed: 300 + i, p1AgentId: oneAgent, p2AgentId: twoAgent, outcome: { kind: "win", winnerAgentId: oneAgent }, endedAt });
}
// (session 91) The other history rows a page can be handed: a draw, a
// cancelled match, and an abandon each way (by the owner and by the
// opponent), on earlier days.
const earlierDay = (i: number) => new Date(Date.parse("2026-11-07T03:00:00.000Z") + i * 3_600_000).toISOString();
store.recordMatch({ matchId: "earlier-draw", seed: 400, p1AgentId: oneAgent, p2AgentId: twoAgent, outcome: { kind: "draw" }, endedAt: earlierDay(0) });
store.recordMatch({ matchId: "earlier-cancelled", seed: 401, p1AgentId: oneAgent, p2AgentId: twoAgent, outcome: { kind: "cancelled" }, endedAt: earlierDay(1) });
store.recordMatch({ matchId: "earlier-abandoned-by-two", seed: 402, p1AgentId: oneAgent, p2AgentId: twoAgent, outcome: { kind: "abandoned", byAgentId: twoAgent }, endedAt: earlierDay(2) });
store.recordMatch({ matchId: "earlier-abandoned-by-one", seed: 403, p1AgentId: twoAgent, p2AgentId: oneAgent, outcome: { kind: "abandoned", byAgentId: oneAgent }, endedAt: earlierDay(3) });
// (session 91) A Prototype copy (serial 1 of its run) for the binder's runs
// and the card viewer's "found so far".
const S0 = cardSet("S0");
const run = S0.prototypes[0]!;
store.grantCopy({ ownerId: one, cardId: run.cardId, origin: "pack", finish: "prototype", seriesKind: "prototype", seriesCode: run.code, serial: 1, runSize: run.runSize });
// (session 91) Enough credits for a 300-credit cosmetic and pack points for
// a secret illustration (750), so the two buys are answered. A ledger row
// as the coin-skins demo writes one; no store rule pays these in the run.
const grant = (ownerId: string, currency: "credits" | "packPoints", amount: number) =>
  store.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${ownerId}', '${currency}', ${amount}, 'demoGrant', '${new Date(clock.t).toISOString()}')`);
grant(one, "credits", 400);
grant(one, "packPoints", 800);
store.setAutoPlay(one, true);
store.setAutoPlay(two, true);

let n = 0;
let packSeed = 90_000;
const live = new LiveLadder({
  store,
  seed: 9000,
  build: BUILD,
  matchId: () => `contract-${String(++n).padStart(3, "0")}`,
  logDir: join(dir, "matches"),
  now: () => clock.t,
  roundGapMs: 60_000,
  idleRetryMs: 60_000,
  housePacks: { packSeed: () => ++packSeed },
});
let apiSeed = 70_000;
const api = await startOwnerApi({ store, port: 0, live, matchFiles: join(dir, "matches"), build: BUILD, packSeed: () => ++apiSeed });
const tick = async (ms: number) => {
  const until = clock.t + ms;
  while (clock.t < until) {
    clock.t = Math.min(until, clock.t + 5000);
    await live.tick();
  }
};

const answers: Answer[] = [];
/** (session 91) The shapes a field can take that a plain run doesn't reach,
 * and whether this run reached each (the report lists them). */
const shapes: Record<string, boolean> = {};
const refusals: string[] = [];
/** (session 95) The refusals the run asks for (the season has ended). */
const seasonRefusals: string[] = [];
const client = siteApi((url: string, init?: RequestInit) => demoFetch(url, init), `http://localhost:${api.port}`);
async function ask(method: string, call: string, ...args: unknown[]): Promise<unknown> {
  try {
    const value = await client[method]!(...args);
    answers.push({ method, call, value });
    return value;
  } catch (err) {
    refusals.push(`${call}: ${(err as Error).message}`);
    return undefined;
  }
}

try {
  // Play until Player One has a history and a match is live with moves out.
  let rounds = 0;
  while (rounds < 40) {
    await tick(60_000);
    rounds++;
    const showing = live.showing();
    if (n >= 8 && showing.length > 0) break;
  }
  // Let the shown match release a few moves.
  await tick(20_000);

  const s1 = (await ask("signIn", "POST /api/session (one)", "one", PW)) as { token: string };
  const s2 = (await ask("signIn", "POST /api/session (two)", "two", PW)) as { token: string };
  const t = s1.token;
  const agentId = oneAgent;

  // The reads, as the pages make them.
  await ask("me", "GET /api/me", t);
  await ask("accountSettings", "GET /api/account/settings", t);
  await ask("wallet", "GET /api/wallet", t);
  await ask("play", "GET /api/play", t);
  await ask("board", "GET /api/board", t);
  await ask("daily", "GET /api/daily", t);
  await ask("collection", "GET /api/collection?recentPacks=3", t, 3);
  await ask("packs", "GET /api/packs", t);
  await ask("store", "GET /api/store", t);
  await ask("dailyPack", "GET /api/packs/daily", t);
  await ask("binder", "GET /api/collection/binder/S0", t, "S0");
  await ask("cosmetics", "GET /api/cosmetics", t);
  await ask("loadout", "GET /api/agents/:id/loadout", t, agentId);
  await ask("rating", "GET /api/rating?recent=10", t, 10);
  await ask("ladder", "GET /api/ladder?limit=10", t, 10);
  await ask("stats", "GET /api/stats", t);
  await ask("notifications", "GET /api/notifications?limit=10", t, 10);
  // (session 95; owner 2026-11-14, render 72's ask) The season: open with no
  // end time, then open with Season 0's (set as season:setup sets it).
  const noEnd = (await ask("season", "GET /api/season (open, no end time)", t)) as { state: string; endsAt?: string | null } | undefined;
  store.setSeasonEndTime("2026-12-26T13:00:00.000Z");
  const withEnd = (await ask("season", "GET /api/season (open, the end time set)", t)) as { state: string; endsAt?: string | null } | undefined;
  shapes["season \"open\", endsAt null"] = noEnd?.state === "open" && noEnd.endsAt === null;
  shapes["season \"open\", endsAt set"] = withEnd?.state === "open" && typeof withEnd.endsAt === "string";
  const liveNow = (await ask("live", "GET /api/live", t)) as { matches: { matchId: string; released: number; p1: { ownerId: string }; p2: { ownerId: string } }[] };
  const shown = liveNow?.matches[0];
  if (shown) await ask("liveFeed", "GET /api/live/:id?from=N (the last two moves)", t, shown.matchId, Math.max(0, shown.released - 2));
  if (shown) await ask("liveFeed", "GET /api/live/:id?from=0 (from the start)", t, shown.matchId, 0);
  const hist = (await ask("matches", "GET /api/matches?limit=50 (every result kind)", t, 50)) as { matches: { matchId: string; result: string; hasLog: boolean }[] };
  // One record of every result kind the history holds, for the match view.
  const seenKinds = new Set<string>();
  for (const row of hist?.matches ?? []) {
    if (seenKinds.has(row.result)) continue;
    seenKinds.add(row.result);
    await ask("match", `GET /api/matches/:id (${row.result})`, t, row.matchId);
  }
  const withLog = hist?.matches.find((m) => m.hasLog);
  if (withLog) await ask("matchLog", "GET /api/matches/:id/log (text)", t, withLog.matchId);

  // The writes the pages make (their answers are read the same way).
  await ask("updateAccountSettings", "PATCH /api/account/settings", t, { theme: "dark", sound: { volume: 50 } });
  await ask("openPacks", "POST /api/packs/open {count:1}", t, { count: 1 });
  await ask("openPacks", "POST /api/packs/open {count:10}", t, { count: 10 });
  await ask("claimDailyPack", "POST /api/packs/daily/claim", t);
  await ask("buyPacks", "POST /api/packs/buy", t, "S0", 1);
  // A card the owner has spare copies of (pulled, not account-bound), for the
  // card viewer, salvage and crafting.
  const counts = new Map<string, number>();
  for (const c of store.collection(one)) if (c.origin === "pack" && c.finish === "standard" && !c.accountBound) counts.set(c.cardId, (counts.get(c.cardId) ?? 0) + 1);
  const spare = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  if (spare) {
    await ask("cardHoldings", "GET /api/collection/cards/:id", t, spare);
    await ask("salvagePlan", "GET /api/collection/cards/:id/salvage?quantity=1", t, spare, 1);
    await ask("salvage", "POST /api/collection/cards/:id/salvage", t, spare, 1, true);
  }
  // Crafting: the first Common the owner holds none of (salvage paid the points).
  const binder = (await client.binder!(t, "S0")) as { base: { entries: { cardId: string; kind: string; rarity: string; owned: number }[] } };
  for (const e of binder.base.entries.filter((x) => x.kind === "card" && x.rarity === "Common" && x.owned === 0)) {
    try {
      answers.push({ method: "craftCard", call: "POST /api/collection/cards/:id/craft", value: await client.craftCard!(t, e.cardId) });
      break;
    } catch {
      /* this one can't be crafted: the next */
    }
  }
  // (session 91) The Prototype copy in the card viewer, a secret illustration
  // crafted, and a cosmetic bought (the first on sale the owner can afford).
  await ask("cardHoldings", "GET /api/collection/cards/:id (a Prototype copy)", t, run.cardId);
  const heldSecrets = new Set(store.collection(one).map((c) => c.secretCode));
  const secret = S0.secrets.find((x) => x.kind === "illustration" && !heldSecrets.has(x.code));
  if (secret) await ask("craftSecret", "POST /api/collection/secrets/:code/craft", t, secret.code);
  const shop = (await client.store!(t)) as { cosmetics: { itemId: string; owned: boolean; priceCredits: number | null }[]; wallet: { credits: number } };
  for (const c of shop.cosmetics.filter((x) => !x.owned && x.priceCredits !== null && x.priceCredits <= shop.wallet.credits)) {
    try {
      answers.push({ method: "buyCosmetic", call: `POST /api/store/cosmetics/:id/buy`, value: await client.buyCosmetic!(t, c.itemId) });
      break;
    } catch {
      /* not on sale to this owner: the next */
    }
  }
  await ask("collection", "GET /api/collection (after the Prototype and the secret)", t, 3);
  const board = (await client.board!(t)) as { widgets: unknown[] };
  await ask("saveBoard", "PUT /api/board", t, board.widgets);
  const play = (await client.play!(t)) as { decks: { deckId: string; complete: boolean }[] };
  const deck = play.decks.find((d) => d.complete);
  if (deck) await ask("setActiveDeck", "PUT /api/play/active-deck", t, deck.deckId);
  await ask("setDeckChoice", "PUT /api/play/deck-choice", t, "agent");
  await ask("setFactionLock", "PUT /api/play/faction-lock", t, null);
  await ask("setPlayStyle", "PUT /api/agents/:id/play-style", t, agentId, "tempo");
  // (session 94, v29) The clock starts at the agent's first pairing: these
  // answers are "waiting" (no window yet).
  const waitingAnswer = (await ask("setAutoPlay", "PUT /api/play/auto-play {on, minutes:30} (waiting for the next round)", t, true, 30)) as { autoPlay: { allowance?: { state: string } | null } } | undefined;
  const waitingAdded = (await ask("addPlayTime", "POST /api/play/auto-play/time (while waiting)", t, 15)) as { autoPlay: { allowance?: { state: string; totalMinutes: number } | null } } | undefined;
  shapes["autoPlay.allowance in \"waiting\" (startedAt and endsAt null)"] = waitingAnswer?.autoPlay.allowance?.state === "waiting" && waitingAdded?.autoPlay.allowance?.totalMinutes === 45;
  const mine = (liveNow?.matches ?? []).find((m) => m.p1.ownerId === one || m.p2.ownerId === one);
  if (mine) await ask("setLiveSpeed", "PUT /api/live/:id/speed", t, mine.matchId, true);
  await ask("markNotificationsRead", "POST /api/notifications/read {all}", t, { all: true });
  // The loadout is locked while the agent plays: auto-play off, the match
  // played out, then the change.
  await ask("setAutoPlay", "PUT /api/play/auto-play {on:false}", t, false);
  for (let i = 0; i < 400 && live.showing().some((m) => m.pairing.p1 === one || m.pairing.p2 === one); i++) await tick(5000);
  await ask("setLoadout", "PUT /api/agents/:id/loadout/coin", t, agentId, "coin", null);
  await ask("rebuild", "POST /api/play/rebuild", t);
  await new Promise((r) => setTimeout(r, 0));
  await api.idle();
  await ask("rebuildJob", "GET /api/play/rebuild (finished)", t);

  // (session 91) The allowance's other states and a finished live match.
  // Player Two starts 15 minutes; the clock runs on until the time is up
  // with its match still live ("finishing"), then until that match is
  // recorded ("done", stopped "timeUp", the notification). On the way, the
  // first live match seen with its last move out (nextAt null) is read with
  // its boast, before the ladder records it.
  const t2 = s2.token;
  await ask("setAutoPlay", "PUT /api/play/auto-play {on, minutes:15} (two)", t2, true, 15);
  let finishedRead = false;
  let boastServed = false;
  let finishingRead = false;
  let runningRead = false;
  const RETRY_MINUTES = [30, 60, 15] as const;
  let retries = 0;
  for (let i = 0; i < 720; i++) {
    await tick(5000);
    if (!finishedRead) {
      const l = (await client.live!(t)) as { matches: { matchId: string; nextAt: string | null; released: number }[] };
      const done = l.matches.find((m) => m.nextAt === null);
      if (done) {
        finishedRead = true;
        await ask("live", "GET /api/live (a match with its last move out)", t);
        const f = (await ask("liveFeed", "GET /api/live/:id?from=N (the last move out, the boast)", t, done.matchId, Math.max(0, done.released - 1))) as { boast?: unknown } | undefined;
        boastServed = f?.boast !== null && f?.boast !== undefined;
      }
    }
    const al = store.autoPlay(two, new Date(clock.t).toISOString()).allowance;
    if (!runningRead && al?.state === "running") {
      runningRead = true;
      await ask("play", "GET /api/play (two: the allowance running, from its first pairing)", t2);
    }
    if (!finishingRead && al?.state === "finishing") {
      finishingRead = true;
      await ask("play", "GET /api/play (two: the allowance finishing)", t2);
    }
    // (session 94) From v29 the window opens at the first pairing, so it
    // can run out between two matches (straight to "done"); then two is
    // given another 15 minutes until one runs out mid-match.
    // (session 99) Each window starts at a pairing, so a retry with the same
    // 15 minutes ends at the same point of the ladder's round cycle, and
    // with cards-3's shorter matches that point is the gap between matches
    // every time (the check never reached "finishing"). The retries go
    // through the other lengths the site offers, 30 then 60, so the end
    // lands somewhere else in the cycle.
    if (!finishingRead && store.autoPlay(two, new Date(clock.t).toISOString()).allowance?.state === "done") store.setAutoPlay(two, true, RETRY_MINUTES[retries++ % RETRY_MINUTES.length]);
    if (finishingRead && store.liveMatchOf(two) === null && (finishedRead || i > 600)) break;
  }
  const doneAnswer = (await ask("play", "GET /api/play (two: the allowance done, stopped timeUp)", t2)) as { autoPlay: { allowance?: { state: string } | null; stopped: { reason: string } | null } } | undefined;
  shapes["a live match with its last move out"] = finishedRead;
  shapes["the live feed's boast, not null (the winner's)"] = boastServed;
  shapes["autoPlay.allowance in \"running\""] = runningRead;
  shapes["autoPlay.allowance in \"finishing\""] = finishingRead;
  shapes["autoPlay.allowance in \"done\""] = doneAnswer?.autoPlay.allowance?.state === "done";
  shapes["autoPlay.stopped (\"timeUp\")"] = doneAnswer?.autoPlay.stopped?.reason === "timeUp";
  for (const k of ["win", "loss", "draw", "cancelled", "abandonedByYou", "abandonedByOpponent"]) shapes[`a history row and match view: ${k}`] = seenKinds.has(k);
  shapes["a Prototype copy (binder run, card viewer)"] = store.collection(one).some((c) => c.finish === "prototype");
  shapes["a crafted secret illustration"] = answers.some((a) => a.method === "craftSecret");
  shapes["a cosmetic bought"] = answers.some((a) => a.method === "buyCosmetic");
  const feed = (await ask("notifications", "GET /api/notifications (two: the time-up notice)", t2, 10)) as { notifications: { notificationId: number }[] } | undefined;
  // (session 94; owner 2026-11-13, after render 70's bell) Clearing: one by
  // id, then all.
  const firstId = feed?.notifications[0]?.notificationId;
  const clearedOne = firstId === undefined ? undefined : ((await ask("clearNotifications", "POST /api/notifications/clear {ids} (one)", t2, { ids: [firstId] })) as { cleared: number } | undefined);
  const clearedAll = (await ask("clearNotifications", "POST /api/notifications/clear {all}", t2, { all: true })) as { cleared: number; unread: number } | undefined;
  const after = (await client.notifications!(t2, 10)) as { notifications: unknown[] };
  shapes["clearNotifications: one by id, then all (the feed empty after)"] = clearedOne?.cleared === 1 && clearedAll !== undefined && clearedAll.unread === 0 && after.notifications.length === 0;

  // (session 95) The season's end, last: with a match on screen the end time
  // is brought forward to 10 s from now, so the season reads "ending" (the
  // match finishes and counts), then "ended" with its final standings. Then
  // auto-play on and more time must be refused (409), as a pack buy is.
  for (let i = 0; i < 120 && live.showing().length === 0; i++) await tick(5000);
  store.setSeasonEndTime(new Date(clock.t + 10_000).toISOString());
  await tick(10_000);
  const ending = (await ask("season", "GET /api/season (ending: the end time passed, a match still on screen)", t)) as { state: string; liveMatches: number } | undefined;
  for (let i = 0; i < 400 && !store.seasonEnded(); i++) await tick(5000);
  const ended = (await ask("season", "GET /api/season (ended: the final standings)", t)) as { state: string; standings: unknown[] | null; you: unknown } | undefined;
  shapes["season \"ending\" (a match on screen)"] = ending?.state === "ending" && ending.liveMatches > 0;
  shapes["season \"ended\" (standings and the caller's line)"] = ended?.state === "ended" && (ended.standings?.length ?? 0) > 0 && ended.you !== null;
  const refusedWith = async (f: () => Promise<unknown>): Promise<{ status: number; message: string } | null> => {
    try {
      await f();
      return null;
    } catch (err) {
      const e = err as { status?: number; message: string };
      return { status: e.status ?? 0, message: e.message };
    }
  };
  const onRefused = await refusedWith(() => client.setAutoPlay!(t, true, 15));
  const plainRefused = await refusedWith(() => client.setAutoPlay!(t, true));
  const timeRefused = await refusedWith(() => client.addPlayTime!(t, 15));
  for (const [what, r] of [["PUT /api/play/auto-play {on, minutes:15}", onRefused], ["PUT /api/play/auto-play {on}", plainRefused], ["POST /api/play/auto-play/time", timeRefused]] as const) {
    seasonRefusals.push(`${what}: ${r === null ? "ANSWERED (not refused)" : `${r.status} ${r.message}`}`);
  }
  shapes["auto-play on refused once the season has ended (409)"] =
    onRefused?.status === 409 && plainRefused?.status === 409 && /has ended: auto-play doesn't go on/.test(onRefused.message) && timeRefused?.status === 409;
  const offAfter = (await ask("setAutoPlay", "PUT /api/play/auto-play {on:false} (after the end: still answered)", t, false)) as { autoPlay: { on: boolean } } | undefined;
  shapes["auto-play off still answered after the end"] = offAfter?.autoPlay.on === false;
} finally {
  await api.close();
  await live.stop();
  store.close();
}


// ---- The type check -------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Path = (string | number)[];
/** A path with every array index as `[]`: one line for every row's field. */
const generic = (p: Path) => p.map((k) => (typeof k === "number" ? "[]" : `.${k}`)).join("").replace(/^\./, "") || "(top)";

/** Writes `value` as a TypeScript literal, one key per line, and the path of
 * the value each line opens, so a compiler error's line names its field. */
function literal(value: Json, path: Path, indent: string, out: { text: string; path: Path }[], prefix: string, suffix: string): void {
  if (value === null || typeof value !== "object") {
    out.push({ text: `${indent}${prefix}${JSON.stringify(value)}${suffix}`, path });
    return;
  }
  const isArr = Array.isArray(value);
  const entries: [string | number, Json][] = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
  if (entries.length === 0) {
    out.push({ text: `${indent}${prefix}${isArr ? "[]" : "{}"}${suffix}`, path });
    return;
  }
  out.push({ text: `${indent}${prefix}${isArr ? "[" : "{"}`, path });
  entries.forEach(([k, v], i) => literal(v, [...path, k], indent + " ", out, isArr ? "" : `${JSON.stringify(k)}: `, i < entries.length - 1 ? "," : ""));
  out.push({ text: `${indent}${isArr ? "]" : "}"}${suffix}`, path });
}

function dropAt(value: Json, path: Path): void {
  let v: Json = value;
  for (const k of path.slice(0, -1)) v = (v as Record<string, Json>)[k as string]!;
  delete (v as Record<string, Json>)[path.at(-1) as string];
}

interface Checked {
  label: string;
  method: string;
  value: Json;
}
interface Result {
  mismatches: string[];
  untyped: string[];
  stray: string[];
}

const tsc = join(dirname(createRequire(import.meta.url).resolve("typescript/package.json")), "bin/tsc");

/** Type-checks every answer; repeats with each reported excess field taken
 * out (the compiler names one per object literal) until none is left, so
 * every untyped field is listed. */
function typeCheck(items: Checked[]): Result[] {
  const work = mkdtempSync(join(tmpdir(), "site-contract-ts-"));
  const file = join(work, "contract.ts");
  writeFileSync(
    join(work, "tsconfig.json"),
    JSON.stringify({ extends: join(ROOT, "render/tsconfig.json"), compilerOptions: { noEmit: true, typeRoots: [join(ROOT, "node_modules/@types")], noErrorTruncation: true }, include: [], files: [file] }),
  );
  const importPath = relative(work, RENDER_API).replace(/\\/g, "/").replace(/\.ts$/, ".js");
  const values = items.map((x) => structuredClone(x.value));
  const results: Result[] = items.map(() => ({ mismatches: [], untyped: [], stray: [] }));
  try {
    for (let pass = 0; pass < 50; pass++) {
      const lines: { text: string; path: Path; item: number }[] = [
        { text: `import type { SiteApi } from "${importPath.startsWith(".") ? importPath : `./${importPath}`}";`, path: [], item: -1 },
        { text: `type R<K extends keyof SiteApi> = Awaited<ReturnType<SiteApi[K]>>;`, path: [], item: -1 },
      ];
      values.forEach((v, i) => {
        const out: { text: string; path: Path }[] = [];
        literal(v, [], "", out, `export const a${i}: R<${JSON.stringify(items[i]!.method)}> = `, ";");
        lines.push(...out.map((o) => ({ ...o, item: i })));
      });
      writeFileSync(file, lines.map((l) => l.text).join("\n") + "\n");
      const run = spawnSync(process.execPath, [tsc, "-p", join(work, "tsconfig.json"), "--pretty", "false"], { encoding: "utf8" });
      let dropped = 0;
      for (const raw of `${run.stdout}${run.stderr}`.split("\n")) {
        const m = /^(.*)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(raw);
        if (!m) {
          if (raw.trim() && run.status !== 0 && !/^\s/.test(raw)) results[0]!.stray.push(raw);
          continue;
        }
        const [, p, lineS, , code, msg] = m;
        const at = lines[Number(lineS) - 1];
        if (resolve(p!) !== file || !at || at.item < 0) {
          if (pass === 0) results[0]!.stray.push(raw.replaceAll(ROOT, "<repo>").replaceAll(work, "<check>"));
          continue;
        }
        const r = results[at.item]!;
        if (code === "TS2353") {
          const field = /'([^']+)' does not exist in type/.exec(msg!)?.[1]?.replace(/^"(.*)"$/, "$1") ?? "?";
          // The excess property's own line: its path ends with the field.
          const path = at.path.at(-1) === field ? at.path : [...at.path, field];
          const line = `${generic(path)} is sent; the type doesn't name it`;
          if (!r.untyped.includes(line)) r.untyped.push(line);
          dropAt(values[at.item]!, path);
          dropped++;
        } else {
          const line = `at ${generic(at.path)}: ${msg!.replace(/import\("[^"]+"\)\./g, "")}`;
          if (!r.mismatches.includes(line)) r.mismatches.push(line);
        }
      }
      if (dropped === 0) break;
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return results;
}

const items: Checked[] = answers.filter((a) => a.value !== undefined && a.value !== null).map((a) => ({ label: a.call, method: a.method, value: a.value as Json }));
// Controls: the check must catch a broken answer. Copies of three real
// answers, each broken the way a server change could break it.
const pick = (method: string) => structuredClone(items.find((x) => x.method === method)!.value) as Record<string, Json>;
const meNoKind = pick("me");
delete meNoKind.kind;
const walletText = pick("wallet");
walletText.credits = String(walletText.credits);
const historyRenamed = pick("matches");
for (const row of historyRenamed.matches as Record<string, Json>[]) {
  row.outcome = row.result!;
  delete row.result;
}
// (session 91) Two more on the shapes this session reached: a union member
// the site doesn't know (the allowance renamed "ending"), and the stop
// reason's object sent as bare text.
const finishing = structuredClone(items.find((x) => x.label.includes("allowance finishing"))?.value ?? null) as { autoPlay: { allowance: { state: string } } } | null;
if (finishing) finishing.autoPlay.allowance.state = "ending";
// (session 94) The clear answer with its count sent as text.
const clearText = structuredClone(items.find((x) => x.method === "clearNotifications")?.value ?? null) as { cleared: Json } | null;
if (clearText) clearText.cleared = String(clearText.cleared);
// (session 95) The season's state as a word the site doesn't know.
const seasonClosed = structuredClone(items.find((x) => x.method === "season" && x.label.includes("(ended"))?.value ?? null) as { state: Json } | null;
if (seasonClosed) seasonClosed.state = "closed";
const stoppedText = structuredClone(items.find((x) => x.label.includes("stopped timeUp"))?.value ?? null) as { autoPlay: { stopped: Json } } | null;
if (stoppedText) stoppedText.autoPlay.stopped = "timeUp";
const controls: Checked[] = [
  { label: "control: GET /api/me with `kind` taken out", method: "me", value: meNoKind },
  { label: "control: GET /api/wallet with `credits` sent as text", method: "wallet", value: walletText },
  { label: "control: GET /api/matches with `result` renamed `outcome`", method: "matches", value: historyRenamed },
  ...(finishing ? [{ label: "control: GET /api/play with the allowance's state \"ending\" (not a state the site knows)", method: "play", value: finishing as unknown as Json }] : []),
  ...(stoppedText ? [{ label: "control: GET /api/play with `autoPlay.stopped` sent as text", method: "play", value: stoppedText as unknown as Json }] : []),
  ...(seasonClosed ? [{ label: "control: GET /api/season with its state \"closed\" (not a state the site knows)", method: "season", value: seasonClosed as unknown as Json }] : []),
  ...(clearText ? [{ label: "control: POST /api/notifications/clear with `cleared` sent as text", method: "clearNotifications", value: clearText as unknown as Json }] : []),
];
const results = typeCheck([...items, ...controls]);

say("# The site contract check: the render's site types against the served answers (game sessions 90-91, 94-95)");
say();
say("The website's own client (render/src/site/siteApi.ts, unchanged) called the real owner API over a real");
say("season file with the live ladder playing (5 owners, a fixed clock and seeds). Each answer it parsed was");
say("type-checked as a literal of the type the client declares for that call, with the render workspace's");
say("compiler settings.");
say("  MISMATCH  the answer doesn't fit the type: the site may read something that isn't there.");
say("  UNTYPED   the server sends a field the type doesn't name: harmless; the site could read it.");
say("            (Every one is listed: the check repeats with each reported field taken out.)");
say();
say(`Ladder: ${n} matches started before the reads; calls made: ${answers.length}; refused: ${refusals.length}.`);
say();
let mismatchCalls = 0;
let untypedTotal = 0;
const untypedAll = new Set<string>();
items.forEach((x, i) => {
  const r = results[i]!;
  if (r.mismatches.length) mismatchCalls++;
  untypedTotal += r.untyped.length;
  for (const u of r.untyped) untypedAll.add(`${x.method}: ${u}`);
  say(`${r.mismatches.length ? "MISMATCH" : r.untyped.length ? "fits (with untyped fields)" : "fits"}  ${x.label}  (SiteApi.${x.method})`);
  for (const m of r.mismatches) say(`    MISMATCH  ${m}`);
  for (const u of [...r.untyped].sort()) say(`    UNTYPED   ${u}`);
});
say();
say("Shapes reached (unions and nullable fields a plain run leaves on one side; session 91):");
for (const [k, v] of Object.entries(shapes)) say(`    ${v ? "reached" : "NOT REACHED"}  ${k}`);
// Every method of the site's client this run didn't get an answer from.
const HOST_ONLY = new Set(["replayPage", "livePage", "liveFrames"]);
const asked = new Set(items.map((x) => x.method));
const notRun = Object.keys(client).filter((m) => !asked.has(m)).sort();
say();
say("Not checked here:");
say(`    the site host's own calls (not the owner API): ${notRun.filter((m) => HOST_ONLY.has(m)).join(", ") || "none"}`);
say(`    owner API calls with no JSON answer checked: ${notRun.filter((m) => !HOST_ONLY.has(m)).join(", ") || "none"}`);
say();
say("Refused on purpose once the season had ended (session 95; each must be a 409):");
for (const r of seasonRefusals) say(`    ${r}`);
if (refusals.length) {
  say();
  say("Refused (an HTTP error, so no answer to check):");
  for (const r of refusals) say(`    ${r}`);
}
const stray = results.flatMap((r) => r.stray);
if (stray.length) {
  say();
  say("Compiler errors outside the answers (the render's own files, or the check itself):");
  for (const s of stray) say(`    ${s}`);
}
say();
say("The controls (broken copies of real answers; each must be a MISMATCH):");
let controlsCaught = 0;
controls.forEach((c, i) => {
  const r = results[items.length + i]!;
  if (r.mismatches.length) controlsCaught++;
  say(`${r.mismatches.length ? "caught " : "MISSED "}  ${c.label}`);
  if (r.mismatches[0]) say(`    ${r.mismatches[0]}${r.mismatches.length > 1 ? ` (and ${r.mismatches.length - 1} more like it)` : ""}`);
});
say();
say(`Totals: ${mismatchCalls} call(s) with a mismatch; ${untypedTotal} untyped field line(s); controls caught ${controlsCaught} of ${controls.length}.`);
rmSync(dir, { recursive: true, force: true });
// (session 91) The run is seeded and on a fixed clock, so a shape it stops
// reaching means the run drifted (a rule or pace change): fail, so the
// check never quietly loses what it covered.
const unreached = Object.entries(shapes).filter(([, v]) => !v).length;
if (unreached > 0) say(`${unreached} shape(s) NOT REACHED: the run no longer covers them; fix the run before trusting its zero.`);
if (mismatchCalls > 0 || controlsCaught < controls.length || stray.length > 0 || unreached > 0) process.exitCode = 1;
