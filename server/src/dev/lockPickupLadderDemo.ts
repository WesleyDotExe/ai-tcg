// Evidence for game session 101 (hardening; session 100's debt: "a ladder
// round shown picking up an agent whose lock just became buildable"). Real
// ladder rounds (the server's `Ladder`, real engine matches) over an
// in-memory store, four house owners, one of them (the Swarm starter only)
// locked to Aegis:
//   1. Round 1, before the lock: everyone plays, the owner's agent in Swarm.
//   2. The owner locks Aegis. Round 2: the locked owner is left out, with the reason, while
//      `lockableFactions` says Aegis is not buildable; the other three play
//      (one pair, one sits out).
//   3. The owner crafts the Aegis starter's cards until one short of a deck
//      (19 of 20): round 3 still leaves them out, and says so.
//   4. One more craft (20 of 20, buildable): round 4 rebuilds the agent's
//      deck in Aegis with no Rebuild now call, pairs the owner, and the
//      match is played and recorded with that deck.
//   5. Round 5 rebuilds nothing for them (the deck is what the cards allow)
//      and they play again.
//
//   npx tsx src/dev/lockPickupLadderDemo.ts > ../progress/lock-pickup-ladder-001.txt

import { getCard, SHIPPED_DECK_LISTS, type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { Ladder, type RoundReport } from "../ladder/ladderRunner.js";

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

let clock = new Date("2026-12-07T22:00:00.000Z"); // 09:00 Tue 8 Dec in Sydney
const store = EconomyStore.open(":memory:", { now: () => clock });
const names = new Map<string, string>();
const make = (name: string, faction: DeckFaction) => {
  const o = store.createOwner({ name, kind: "house" });
  store.grantStarterCollection(o.ownerId, faction);
  const a = store.createAgent({ ownerId: o.ownerId, name: `${name}'s agent` });
  store.connectAgent(o.ownerId, a.agentId);
  names.set(o.ownerId, name);
  return o.ownerId;
};
const locked = make("locked", "Swarm");
make("cortex", "Cortex");
make("aegis", "Aegis");
make("null", "Null");
let n = 0;
const ladder = new Ladder({
  store,
  seed: 101,
  build: { games: 0 },
  matchId: () => `lock-${++n}`,
  housePacks: false,
  afterMatch: () => {
    clock = new Date(clock.getTime() + 600_000);
  },
});
const who = (id: string) => names.get(id) ?? id;
const aegisNow = () => store.lockableFactions(locked).find((x) => x.faction === "Aegis")!;
const report = (r: RoundReport) => {
  say(`  round ${r.round}:`);
  for (const b of r.rebuilt) say(`    rebuilt   ${who(b.ownerId).padEnd(7)} ${b.faction}, ${b.cards} cards (${b.reasons.join("; ")})`);
  for (const x of r.excluded) say(`    left out  ${who(x.ownerId).padEnd(7)} ${x.reason}`);
  for (const p of r.pairs) say(`    paired    ${who(p.p1)} v ${who(p.p2)}`);
  for (const id of r.sitOut) say(`    sits out  ${who(id)} (odd queue)`);
  for (const m of r.matches) say(`    played    ${m.record.matchId}: ${m.record.outcome}, ${m.record.turns} turns`);
};
const plays = (r: RoundReport) => r.pairs.some((p) => p.p1 === locked || p.p2 === locked);
const leftOut = (r: RoundReport) => r.excluded.find((x) => x.ownerId === locked)?.reason ?? null;

say("# A faction lock picked up by the ladder once it can be built (game session 101, hardening)");
say();
say("Session 100 served `lockable` (buildable or not) and showed a rebuild over the API (Rebuild now). This run");
say("shows the other path: the ladder's own between-round rebuild picks the agent up at its next round, with no");
say("call from the owner, once the crafted cards make a 20-card deck.");

section("1. Round 1, before the lock: the owner's agent plays Swarm");
const r0 = await ladder.runRound();
report(r0);
check("all four play round 1 (two pairs)", r0.matches.length === 2 && plays(r0));
const swarmDeck = store.agentDeckId(locked);
check("the owner's agent deck is a Swarm deck", swarmDeck !== null && store.deckStatus(swarmDeck).faction === "Swarm");

section("2. Locked to Aegis with no Aegis card: round 2");
const fits = store.setFactionLock(locked, "Aegis");
say(`  setFactionLock: activeDeckFits ${fits.activeDeckFits}`);
say(`  lockableFactions: Aegis ${aegisNow().cards}/${aegisNow().needed} ${aegisNow().buildable ? "buildable" : "NOT buildable"}`);
const r1 = await ladder.runRound();
report(r1);
check("the locked owner is left out of round 2", leftOut(r1) !== null);
check("the reason says the agent's deck couldn't be rebuilt", /couldn't be rebuilt/.test(leftOut(r1) ?? ""));
check("the other three still play: one pair, one sits out", r1.pairs.length === 1 && r1.sitOut.length === 1 && r1.matches.length === 1);

section("3. Crafting the Aegis starter's cards, stopping one short: round 3");
store.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${locked}', 'packPoints', 100000, 'testGrant', '${clock.toISOString()}')`);
say("  (pack points from a test grant; each craft is the store's craftCard, what the API's craft calls)");
const queue: string[] = SHIPPED_DECK_LISTS.Aegis.flatMap(({ cardId, copies }) => Array.from({ length: copies }, () => cardId));
let crafted = 0;
while (!aegisNow().buildable) {
  const next = queue[crafted]!;
  store.craftCard(locked, next);
  crafted++;
  if (aegisNow().cards === aegisNow().needed - 1) break;
}
say(`  ${crafted} crafts: Aegis ${aegisNow().cards}/${aegisNow().needed} ${aegisNow().buildable ? "buildable" : "NOT buildable"}`);
check("one short of a deck (19 of 20), not buildable", aegisNow().cards === 19 && !aegisNow().buildable);
const r2 = await ladder.runRound();
report(r2);
check("round 3 still leaves the owner out", leftOut(r2) !== null && !plays(r2));
check("the old Swarm deck was never played under the lock (no match of theirs in rounds 2-3)", ![...r1.matches, ...r2.matches].some((m) => m.record.p1OwnerId === locked || m.record.p2OwnerId === locked));

section("4. One more craft, buildable: round 4");
const last = queue[crafted]!;
store.craftCard(locked, last);
crafted++;
say(`  craft ${crafted}: ${getCard(last)!.name} -> Aegis ${aegisNow().cards}/${aegisNow().needed} ${aegisNow().buildable ? "buildable" : "NOT buildable"}`);
check("lockableFactions now says Aegis is buildable", aegisNow().buildable);
const deckBefore = store.getOwner(locked).activeDeckId;
const r3 = await ladder.runRound();
report(r3);
const rebuilt = r3.rebuilt.find((b) => b.ownerId === locked);
check("round 4 rebuilds the agent's deck itself (no Rebuild now)", rebuilt !== undefined);
check("for the lock and the crafted cards", rebuilt !== undefined && rebuilt.reasons.some((x) => /faction lock changed/.test(x)) && rebuilt.reasons.some((x) => /cards held changed/.test(x)));
check(`in Aegis, of lockable's count (${aegisNow().cards})`, rebuilt?.faction === "Aegis" && rebuilt.cards === aegisNow().cards);
check("the owner is not left out, and is paired", leftOut(r3) === null && plays(r3));
const match = r3.matches.find((m) => m.record.p1OwnerId === locked || m.record.p2OwnerId === locked);
const deckId = match ? (match.record.p1OwnerId === locked ? match.record.p1DeckId : match.record.p2DeckId) : null;
check("the match is played and recorded", match !== undefined && match.record.outcome !== "cancelled");
check("with the rebuilt Aegis deck (the agent's deck, rebuilt in place, active)", deckId !== null && deckId === swarmDeck && deckId === deckBefore && store.deckStatus(deckId).faction === "Aegis");

section("5. The round after: round 5");
const r4 = await ladder.runRound();
report(r4);
check("nothing to rebuild for the owner", !r4.rebuilt.some((b) => b.ownerId === locked));
check("and they play again", plays(r4) && leftOut(r4) === null);

const passed = checks.filter(([, ok]) => ok).length;
say();
say(`Checks: ${passed} of ${checks.length} PASS.`);
if (passed < checks.length) process.exitCode = 1;
