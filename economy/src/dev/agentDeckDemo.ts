// Evidence for the deck-building agent in the store (session 51, roadmap 2b;
// owner 2026-10-15: "the owner can force a specific deck or faction.
// Otherwise the agent picks the best faction and deck it can build from the
// cards the owner holds").
//
//   npx tsx src/dev/agentDeckDemo.ts > ../progress/economy-demo-014.txt
//
// Real owners in a real database file: starter collections, packs opened
// with the live roller, then each agent builds its deck (the engine's
// chooseDeck: a first deck from the owned cards, a measured search, a
// confirm on fresh seeds) and real matches are started and recorded with
// the built decks. Seeds and the clock are fixed so the output reproduces.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCard, holdingsOf, largestDeck, LookaheadAgent, runMatch, SHIPPED_DECK_LISTS, type DeckFaction } from "@ai-tcg/engine";
import { CRAFT_PACK_POINTS, EconomyStore, type AgentDeckBuild } from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "agent-deck-demo-"));
const store = EconomyStore.open(join(tempDir, "season-0.db"), { now: () => new Date("2026-10-19T09:00:00.000Z") });
const say = (line = "") => console.log(line);
const BUILD = { games: 40, trials: 16, confirmGames: 100 };

function seat(name: string, faction: DeckFaction) {
  const o = store.createOwner({ name, kind: "house" });
  store.grantStarterCollection(o.ownerId, faction);
  const agent = store.createAgent({ ownerId: o.ownerId, name: `${name}'s agent` });
  store.connectAgent(o.ownerId, agent.agentId);
  return { ownerId: o.ownerId, agentId: agent.agentId };
}

let packSeed = 5100;
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

/** The built deck against a faction's starter list: what the agent changed. */
function diff(build: AgentDeckBuild): string {
  const deck = store.loadDeck(build.deck.deckId).spec.cards;
  const mine = new Map<string, number>();
  for (const c of deck) mine.set(c.id, (mine.get(c.id) ?? 0) + 1);
  const starter = new Map(SHIPPED_DECK_LISTS[build.faction].map((e) => [e.cardId, e.copies]));
  const out: string[] = [];
  for (const id of new Set([...mine.keys(), ...starter.keys()])) {
    const d = (mine.get(id) ?? 0) - (starter.get(id) ?? 0);
    if (d !== 0) out.push(`${d > 0 ? "+" : ""}${d} ${getCard(id)!.name}`);
  }
  return out.sort().join(", ") || "(the starter list, unchanged)";
}

function report(name: string, build: AgentDeckBuild): void {
  for (const f of build.factions) {
    if (f.infeasible) say(`  ${f.faction}: can't build: ${f.infeasible}`);
    else {
      const starts = f.starts!.map((st) => `${st.from} start ${(st.winRate! * 100).toFixed(1)}%`).join(", ");
      say(`  ${f.faction}: ${(f.winRate! * 100).toFixed(1)}% against the four shipped decks on fresh seeds (${starts}); keeps the ${f.chosen} deck${f.kept.length ? `, changes: ${f.kept.join("; ")}` : ""}`);
    }
  }
  const deck = store.loadDeck(build.deck.deckId);
  say(`  -> ${name}'s agent plays ${build.faction}: "${deck.name}", ${deck.spec.cards.length} cards, active: ${store.getOwner(store.deckStatus(build.deck.deckId).ownerId).activeDeckId === build.deck.deckId}`);
  say(`     against the ${build.faction} starter list: ${diff(build)}`);
}

say("# The deck-building agent in the store (session 51)");
say();
say(`Every build: ${BUILD.trials} one-copy changes tried per faction, ${BUILD.games} games per shipped opponent each; confirm on ${BUILD.confirmGames} fresh-seed games per opponent.`);
say();

say("## 1. A new owner: the Swarm starter collection and its 3 starter packs");
const ada = seat("ada", "Swarm");
say(`  ada opens ${openAll(ada.ownerId)} packs; holds ${store.collection(ada.ownerId).length} copies; deck choice: ${store.getOwner(ada.ownerId).deckChoice}`);
const adaBuild = await store.buildAgentDeck(ada.ownerId, BUILD);
report("ada", adaBuild);
say();

say("## 2. An owner with the Cortex starter and 60 more packs: the free pick");
const bo = seat("bo", "Cortex");
for (let i = 0; i < 60; i++) store.grantPack(bo.ownerId, "S0", "weeklyChallenge");
say(`  bo opens ${openAll(bo.ownerId)} packs; holds ${store.collection(bo.ownerId).length} copies`);
const boBuild = await store.buildAgentDeck(bo.ownerId, BUILD);
report("bo", boBuild);
say();

say("## 3. The same owner crafts into Aegis and locks it (the forced faction): the agent rebuilds in place");
say(`  ${craftToBuildable(bo.ownerId, "Aegis")}`);
store.setFactionLock(bo.ownerId, "Aegis");
const boAegis = await store.buildAgentDeck(bo.ownerId, BUILD);
report("bo", boAegis);
say(`  same deck id as before: ${boAegis.deck.deckId === boBuild.deck.deckId}; bo's saved decks: ${store.listDecks(bo.ownerId).length}`);
say();

say("## 4. A forced deck: the owner makes their own deck active");
const cy = seat("cy", "Null");
const hand = store.saveDeck(cy.ownerId, "cy's own", store.collection(cy.ownerId).map((c) => c.copyId));
store.setActiveDeck(cy.ownerId, hand.deckId);
say(`  cy forces "${hand.name}": deck choice ${store.getOwner(cy.ownerId).deckChoice}`);
try {
  await store.buildAgentDeck(cy.ownerId, BUILD);
} catch (err) {
  say(`  buildAgentDeck refused: ${(err as Error).message}`);
}
store.setDeckChoice(cy.ownerId, "agent");
say(`  back to the agent: choice ${store.getOwner(cy.ownerId).deckChoice}, active deck ${store.getOwner(cy.ownerId).activeDeckId ?? "none (the agent hasn't built one yet)"}`);
const cyBuild = await store.buildAgentDeck(cy.ownerId, BUILD);
report("cy", cyBuild);
say();

say("## 5. Real matches with the built decks (startMatch -> runMatch -> recordMatch)");
const pairs: [typeof ada, typeof bo, string, string][] = [
  [ada, bo, "ada", "bo"],
  [bo, cy, "bo", "cy"],
  [cy, ada, "cy", "ada"],
];
const wins: Record<string, number> = { ada: 0, bo: 0, cy: 0 };
let matchNo = 0;
for (let round = 0; round < 4; round++) {
  for (const [p1, p2, n1, n2] of pairs) {
    const matchId = `s0-d${String(++matchNo).padStart(3, "0")}`;
    const live = store.startMatch({ matchId, p1OwnerId: p1.ownerId, p2OwnerId: p2.ownerId });
    const seed = 5100 + matchNo;
    const result = await runMatch(
      { ...live.p1.deck.spec, id: "p1" },
      { ...live.p2.deck.spec, id: "p2" },
      new LookaheadAgent(`${n1}'s agent`, seed * 2),
      new LookaheadAgent(`${n2}'s agent`, seed * 2 + 1),
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
      endedAt: "2026-10-19T10:00:00.000Z",
    });
    const winner = w === "p1" ? n1 : w === "p2" ? n2 : "draw";
    if (winner !== "draw") wins[winner]!++;
    say(`  ${matchId}  ${n1} (${live.p1.deck.name}) vs ${n2} (${live.p2.deck.name})  T${rec.turns}  ${winner === "draw" ? "draw" : `${winner} wins`}`);
  }
}
say(`  wins: ada ${wins.ada}, bo ${wins.bo}, cy ${wins.cy} (12 matches; a showcase, not a measurement)`);

store.close();
rmSync(tempDir, { recursive: true, force: true });
