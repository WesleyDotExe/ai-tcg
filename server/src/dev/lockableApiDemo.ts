// Evidence for game session 100 (owner 2026-11-14, answer (a) to game 99's
// call): `GET /api/play`'s `lockable`, each lockable faction buildable now
// or not, with the cards held and needed. Over real HTTP on a real port:
//   1. A new owner with the Swarm starter only: what `lockable` says, and
//      that it is the engine's `largestDeck` on the cards held.
//   2. The owner locks Aegis (allowed); the faction-lock answer carries
//      `lockable`; a rebuild fails, as "not buildable" says it will.
//   3. The owner crafts Aegis starter cards one at a time over the API
//      (pack points from a test grant), and `lockable` is read after each:
//      the count rises by the rule and Aegis turns buildable at 20.
//   4. The rebuild then builds an Aegis deck of exactly `cards` cards.
//
//   npx tsx src/dev/lockableApiDemo.ts > ../progress/lockable-api-001.txt

import { getCard, holdingsOf, largestDeck, MIN_DECK_SIZE, SHIPPED_DECK_LISTS } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi } from "../ownerApi.js";
import { demoFetch } from "./demoFetch.js";

type Lockable = { faction: string; buildable: boolean; cards: number; needed: number };
const say = (line = "") => console.log(line);
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
const PW = "correct horse battery";

const store = EconomyStore.open(":memory:");
const owner = store.createAccount({ name: "Demo Owner", username: "demo", password: PW });
store.grantStarterCollection(owner.ownerId, "Swarm");
const agent = store.createAgent({ ownerId: owner.ownerId, name: "demo-agent" });
store.connectAgent(owner.ownerId, agent.agentId);
const api = await startOwnerApi({ port: 0, store, build: { games: 0 } });
const call = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
  const res = await demoFetch(`http://localhost:${api.port}${path}`, {
    method,
    headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  return { status: res.status, body: text === "" ? null : JSON.parse(text) };
};
const job = async (token: string) => {
  await api.idle();
  return (await call("GET", "/api/play/rebuild", { token })).body.job;
};
const engineSays = (): Lockable[] => {
  const holdings = holdingsOf(store.collection(owner.ownerId).map((c) => c.cardId));
  return (["Cortex", "Swarm", "Aegis", "Null"] as const).map((faction) => {
    const cards = largestDeck(faction, holdings);
    return { faction, buildable: cards >= MIN_DECK_SIZE, cards, needed: MIN_DECK_SIZE };
  });
};
const row = (x: Lockable) => `    ${x.faction.padEnd(7)} ${x.buildable ? "buildable    " : "NOT buildable"}  ${String(x.cards).padStart(2)}/${x.needed}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

say("# The lockable factions over the owner API (game session 100)");
say();
say("Owner 2026-11-14, answer (a) to game 99's call: the API marks each lockable faction as buildable or not, with");
say("the cards held and needed, and the site greys out the ones that can't be built yet. The site's half shipped in");
say("render session 76 (it worked the numbers out from GET /api/collection until the server sent them).");

try {
  const token = (await call("POST", "/api/session", { body: { login: "demo", password: PW } })).body.token as string;

  section("1. A new owner with the Swarm starter only");
  const play = (await call("GET", "/api/play", { token })).body;
  say(`  cards held: ${store.collection(owner.ownerId).length}`);
  for (const x of play.lockable as Lockable[]) say(row(x));
  check("one entry per lockableFactions entry, in its order", same((play.lockable as Lockable[]).map((x) => x.faction), play.lockableFactions));
  check("every entry is the engine's largestDeck on the cards held (cards, buildable, needed 20)", same(play.lockable, engineSays()));
  const swarm = (play.lockable as Lockable[]).find((x) => x.faction === "Swarm")!;
  const aegis0 = (play.lockable as Lockable[]).find((x) => x.faction === "Aegis")!;
  check("Swarm (the starter's faction) is buildable", swarm.buildable);
  check("Aegis (no Aegis card held) is not", !aegis0.buildable);

  section("2. The owner locks Aegis anyway");
  const locked = await call("PUT", "/api/play/faction-lock", { token, body: { faction: "Aegis" } });
  check("the lock is allowed (200), as before", locked.status === 200 && locked.body.factionLock === "Aegis");
  check("the faction-lock answer carries lockable too", same(locked.body.lockable, engineSays()));
  await call("POST", "/api/play/rebuild", { token });
  const failed = await job(token);
  say(`  the rebuild: ${failed.state}: ${failed.error}`);
  check("a rebuild under a lock marked not buildable fails", failed.state === "failed");

  section("3. The owner crafts Aegis starter cards, one at a time");
  store.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${owner.ownerId}', 'packPoints', 100000, 'testGrant', '${new Date().toISOString()}')`);
  say("  (pack points from a test grant; each craft is POST /api/collection/cards/:cardId/craft)");
  let last = aegis0;
  let rising = true;
  let byRule = true;
  let flipped: number | null = null;
  let crafts = 0;
  for (const { cardId, copies } of SHIPPED_DECK_LISTS.Aegis) {
    for (let i = 0; i < copies; i++) {
      const res = await call("POST", `/api/collection/cards/${cardId}/craft`, { token });
      if (res.status !== 201) {
        say(`  craft ${cardId} refused: ${JSON.stringify(res.body)}`);
        continue;
      }
      crafts++;
      const lockable = (await call("GET", "/api/play", { token })).body.lockable as Lockable[];
      const now = lockable.find((x) => x.faction === "Aegis")!;
      if (now.cards < last.cards) rising = false;
      if (!same(lockable, engineSays())) byRule = false;
      if (now.buildable && flipped === null) flipped = crafts;
      say(`  craft ${String(crafts).padStart(2)}: ${getCard(cardId)!.name.padEnd(24)} -> Aegis ${String(now.cards).padStart(2)}/${now.needed} ${now.buildable ? "buildable" : ""}`);
      last = now;
    }
  }
  check("every read after a craft is the engine's rule on the cards held", byRule);
  check("the count never falls as cards are added", rising);
  check(`Aegis turns buildable (at craft ${flipped ?? "never"}) and stays so`, flipped !== null && last.buildable);

  section("4. The rebuild, now");
  await call("POST", "/api/play/rebuild", { token });
  const done = await job(token);
  say(`  the rebuild: ${done.state}: ${done.result ? `${done.result.faction}, ${done.result.cards} cards` : done.error}`);
  check("it builds an Aegis deck", done.state === "done" && done.result.faction === "Aegis");
  check(`of exactly lockable's count (${last.cards})`, done.result?.cards === last.cards);
  const after = (await call("GET", "/api/play", { token })).body;
  check("the agent's deck is the active deck, and it fits the lock", after.activeDeck?.faction === "Aegis");
} finally {
  await api.idle();
  await api.close();
}

const passed = checks.filter(([, ok]) => ok).length;
say();
say(`Checks: ${passed} of ${checks.length} PASS.`);
if (passed < checks.length) process.exitCode = 1;
