// Evidence for the agent's deck in the agent's play style (session 53,
// roadmap 2b part 3; owner 2026-10-20, call 6: "the deck builder still
// builds with Calculator; making it use the agent's style is the next step").
//
//   npx tsx src/dev/agentDeckStyleDemo.ts > ../progress/economy-demo-016.txt
//
// Real owners in a real database file: a starter and packs opened with the
// live roller; the connected agent's deck built in its style; then the
// owner changes the style, connects another agent, opens packs and locks a
// faction, and the store names each reason to rebuild and rebuilds only
// when there is one. Real matches are then played with each side's deck
// and style and recorded. Section 7 (session 55) counts the pack openings
// that ask for a rebuild when only cards the deck could use count, against
// the session-53 rule that counted every card. Seeds and the clock are
// fixed so the output reproduces.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCard, holdingsOf, largestDeck, LookaheadAgent, PLAY_STYLES, runMatch, SHIPPED_DECK_LISTS, type DeckFaction } from "@ai-tcg/engine";
import { CRAFT_PACK_POINTS, EconomyStore, holdingsFingerprint, type AgentDeckBuild } from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "agent-deck-style-demo-"));
const store = EconomyStore.open(join(tempDir, "season-0.db"), { now: () => new Date("2026-10-20T09:00:00.000Z") });
const say = (line = "") => console.log(line);
const BUILD = { games: 40, trials: 16, confirmGames: 100 };

function seat(name: string, faction: DeckFaction) {
  const o = store.createOwner({ name, kind: "house" });
  store.grantStarterCollection(o.ownerId, faction);
  const agent = store.createAgent({ ownerId: o.ownerId, name: `${name}'s agent` });
  store.connectAgent(o.ownerId, agent.agentId);
  return { ownerId: o.ownerId, agentId: agent.agentId };
}

let packSeed = 5300;
function openAll(ownerId: string): number {
  let n = 0;
  while (store.unopenedPacks(ownerId).length > 0) {
    store.openPack(ownerId, undefined, { seed: packSeed++ });
    n++;
  }
  return n;
}

/** (session 99) Since session 97 packs roll booster cards only (7 per
 * faction), so an owner who holds one faction's starter can't reach a legal
 * 20-card deck in another faction from packs alone. The real way there is
 * crafting: the owner spends pack points on Standard copies of that
 * faction's starter-list cards, cheapest first, until a deck can be built. */
function craftToBuildable(ownerId: string, faction: DeckFaction): string {
  const size = () => largestDeck(faction, holdingsOf(store.collection(ownerId).map((c) => c.cardId)));
  const before = size();
  const list = [...SHIPPED_DECK_LISTS[faction]].sort((a, b) => CRAFT_PACK_POINTS[getCard(a.cardId)!.rarity] - CRAFT_PACK_POINTS[getCard(b.cardId)!.rarity] || a.cardId.localeCompare(b.cardId));
  const crafted: string[] = [];
  for (const { cardId } of list) {
    while (size() < 20) {
      try {
        store.craftCard(ownerId, cardId);
        crafted.push(getCard(cardId)!.name);
      } catch {
        break;
      }
    }
  }
  return `${faction} deck size from the cards held: ${before} before, ${size()} after crafting ${crafted.length} (${crafted.join(", ") || "none"}); pack points left ${store.balance(ownerId, "packPoints")}`;
}

function cardsOf(deckId: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of store.loadDeck(deckId).spec.cards) out.set(c.id, (out.get(c.id) ?? 0) + 1);
  return out;
}

function diff(a: Map<string, number>, b: Map<string, number>): string {
  const out: string[] = [];
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const d = (a.get(id) ?? 0) - (b.get(id) ?? 0);
    if (d !== 0) out.push(`${d > 0 ? "+" : ""}${d} ${getCard(id)!.name}`);
  }
  return out.sort().join(", ") || "(no change)";
}

function report(name: string, build: AgentDeckBuild): void {
  say(`  built in ${PLAY_STYLES[build.style].name}'s style:`);
  for (const f of build.factions) {
    if (f.infeasible) continue;
    const starts = f.starts!.map((st) => `${st.from} start ${(st.winRate! * 100).toFixed(1)}%`).join(", ");
    say(`    ${f.faction}: ${(f.winRate! * 100).toFixed(1)}% on fresh seeds (${starts}); keeps the ${f.chosen} deck${f.kept.length ? `; changes: ${f.kept.join("; ")}` : ""}`);
  }
  const from = store.agentDeckBuiltFrom(store.deckStatus(build.deck.deckId).ownerId)!;
  say(`  -> ${name}'s agent plays ${build.faction} (${store.loadDeck(build.deck.deckId).spec.cards.length} cards); recorded as built from: style ${from.style}, lock ${from.factionLock ?? "none"}, holdings ${from.holdings}, rule ${from.rule}`);
}

function reasons(ownerId: string): string {
  const r = store.agentDeckRebuildReasons(ownerId);
  return r.length ? r.join("; ") : "none (up to date)";
}

say("# The agent's deck in the agent's play style (session 53)");
say();
say(`Every build: ${BUILD.trials} one-copy changes tried per faction, ${BUILD.games} games per shipped opponent each; confirm on ${BUILD.confirmGames} fresh-seed games per opponent.`);
say("The built deck is played in the connected agent's style; the shipped opponents always play Calculator.");
say();

say("## 1. An owner with the Cortex starter and 30 more packs; a Calculator agent builds");
const ada = seat("ada", "Cortex");
for (let i = 0; i < 30; i++) store.grantPack(ada.ownerId, "S0", "weeklyChallenge");
say(`  ada opens ${openAll(ada.ownerId)} packs; holds ${store.collection(ada.ownerId).length} copies; agent style: ${store.connectedAgent(ada.ownerId)!.playStyle}`);
say(`  rebuild reasons: ${reasons(ada.ownerId)}`);
const calcBuild = await store.buildAgentDeck(ada.ownerId, BUILD);
report("ada", calcBuild);
const calcCards = cardsOf(calcBuild.deck.deckId);
say(`  rebuild reasons now: ${reasons(ada.ownerId)}; rebuildAgentDeckIfNeeded -> ${(await store.rebuildAgentDeckIfNeeded(ada.ownerId, BUILD)) === null ? "nothing to do" : "rebuilt"}`);
say();

say("## 2. The owner switches the agent to Rusher");
store.setPlayStyle(ada.ownerId, ada.agentId, "rusher");
say(`  rebuild reasons: ${reasons(ada.ownerId)}`);
const rush = (await store.rebuildAgentDeckIfNeeded(ada.ownerId, BUILD))!;
report("ada", rush.build);
const rushCards = cardsOf(rush.build.deck.deckId);
say(`  Rusher's deck against Calculator's: ${diff(rushCards, calcCards)}`);
say(`  same deck id: ${rush.build.deck.deckId === calcBuild.deck.deckId}; rebuild reasons now: ${reasons(ada.ownerId)}`);
say();

say("## 3. The owner connects a second agent, a Fortress");
const fort = store.createAgent({ ownerId: ada.ownerId, name: "ada's wall" });
store.setPlayStyle(fort.ownerId, fort.agentId, "fortress");
store.connectAgent(ada.ownerId, fort.agentId);
say(`  rebuild reasons: ${reasons(ada.ownerId)}`);
const fortress = (await store.rebuildAgentDeckIfNeeded(ada.ownerId, BUILD))!;
report("ada", fortress.build);
say(`  Fortress's deck against Calculator's: ${diff(cardsOf(fortress.build.deck.deckId), calcCards)}`);
say();

say("## 4. Back to the Rusher agent, 5 more packs, crafting into Aegis and an Aegis lock: one rebuild for all three");
store.connectAgent(ada.ownerId, ada.agentId);
for (let i = 0; i < 5; i++) store.grantPack(ada.ownerId, "S0", "weeklyChallenge");
openAll(ada.ownerId);
say(`  ${craftToBuildable(ada.ownerId, "Aegis")}`);
store.setFactionLock(ada.ownerId, "Aegis");
say(`  rebuild reasons: ${reasons(ada.ownerId)}`);
const locked = (await store.rebuildAgentDeckIfNeeded(ada.ownerId, BUILD))!;
report("ada", locked.build);
say(`  rebuild reasons now: ${reasons(ada.ownerId)}`);
store.setFactionLock(ada.ownerId, null);
const unlocked = (await store.rebuildAgentDeckIfNeeded(ada.ownerId, BUILD))!;
say(`  lock lifted: ${unlocked.reasons.join("; ")}; rebuilt in ${PLAY_STYLES[unlocked.build.style].name}'s style, plays ${unlocked.build.faction}`);
say();

say("## 5. An owner who forces a deck: nothing to rebuild, whatever changes");
const bo = seat("bo", "Null");
const hand = store.saveDeck(bo.ownerId, "bo's own", store.collection(bo.ownerId).map((c) => c.copyId));
store.setActiveDeck(bo.ownerId, hand.deckId);
store.setPlayStyle(bo.ownerId, bo.agentId, "controller");
say(`  bo forces "${hand.name}", agent style controller; rebuild reasons: ${reasons(bo.ownerId)}`);
store.setDeckChoice(bo.ownerId, "agent");
say(`  bo hands the deck back to the agent; rebuild reasons: ${reasons(bo.ownerId)}`);
const boBuild = (await store.rebuildAgentDeckIfNeeded(bo.ownerId, BUILD))!;
report("bo", boBuild.build);
say();

say("## 6. Real matches: each side's built deck, played in its style (startMatch -> runMatch -> recordMatch)");
const wins: Record<string, number> = { ada: 0, bo: 0 };
for (let i = 1; i <= 8; i++) {
  const [p1, p2, n1, n2] = i % 2 === 1 ? [ada, bo, "ada", "bo"] : [bo, ada, "bo", "ada"];
  const matchId = `s0-y${String(i).padStart(3, "0")}`;
  const live = store.startMatch({ matchId, p1OwnerId: p1.ownerId, p2OwnerId: p2.ownerId });
  const seed = 5300 + i;
  const result = await runMatch(
    { ...live.p1.deck.spec, id: "p1" },
    { ...live.p2.deck.spec, id: "p2" },
    new LookaheadAgent(`${n1}'s agent`, seed * 2, { style: live.p1.playStyle }),
    new LookaheadAgent(`${n2}'s agent`, seed * 2 + 1, { style: live.p2.playStyle }),
    seed,
  );
  const w = result.state.winner;
  const rec = store.recordMatch({
    matchId,
    seed,
    p1AgentId: live.p1.agentId,
    p2AgentId: live.p2.agentId,
    p1DeckId: live.p1.deck.deckId,
    p2DeckId: live.p2.deck.deckId,
    outcome: w === "p1" ? { kind: "win", winnerAgentId: p1.agentId } : w === "p2" ? { kind: "win", winnerAgentId: p2.agentId } : { kind: "draw" },
    turns: result.state.turnNumber,
    moves: result.movesPlayed,
    finalHealth: { p1: result.state.players.p1.health, p2: result.state.players.p2.health },
    endedAt: "2026-10-20T10:00:00.000Z",
  });
  const winner = w === "p1" ? n1 : w === "p2" ? n2 : "draw";
  if (winner !== "draw") wins[winner]!++;
  say(`  ${matchId}  ${n1} (${rec.playStyles?.p1 ?? "?"}) vs ${n2} (${rec.playStyles?.p2 ?? "?"})  T${rec.turns}  ${winner === "draw" ? "draw" : `${winner} wins`}`);
}
say(`  wins: ada ${wins.ada}, bo ${wins.bo} (8 matches; a showcase, not a measurement)`);
say(`  rebuild reasons after the matches: ada ${reasons(ada.ownerId)}; bo ${reasons(bo.ownerId)} (match credits buy packs, but a match grants no cards)`);

say();

say("## 7. Which pack openings ask for a rebuild (session 55: only cards the deck could use count)");
// A locked owner opens packs one at a time and the agent rebuilds whenever
// it is asked to. The session-53 rule asked whenever any card count changed
// (every pack); now a pack whose cards are all another faction's, or spares
// past a card's deck limit, asks for nothing.
for (const [name, faction, lock] of [["cy", "Aegis", "Aegis"], ["di", "Swarm", null]] as const) {
  const o = seat(name, faction);
  if (lock) store.setFactionLock(o.ownerId, lock);
  for (let i = 0; i < 40; i++) store.grantPack(o.ownerId, "S0", "weeklyChallenge");
  openAll(o.ownerId);
  await store.buildAgentDeck(o.ownerId, BUILD);
  let asked = 0;
  let oldRule = 0;
  const opened = 20;
  for (let i = 0; i < opened; i++) {
    const before = holdingsFingerprint(store.collection(o.ownerId).map((c) => c.cardId));
    store.grantPack(o.ownerId, "S0", "weeklyChallenge");
    openAll(o.ownerId);
    if (holdingsFingerprint(store.collection(o.ownerId).map((c) => c.cardId)) !== before) oldRule++;
    if ((await store.rebuildAgentDeckIfNeeded(o.ownerId, BUILD)) !== null) asked++;
  }
  say(`  ${name} (${faction} starter + 40 packs, lock ${lock ?? "none"}, ${store.collection(o.ownerId).length} copies after): ${opened} more packs opened one at a time; ${asked} asked for a rebuild (the session-53 rule: ${oldRule})`);
}

store.close();
rmSync(tempDir, { recursive: true, force: true });
