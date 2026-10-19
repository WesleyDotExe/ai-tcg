// Evidence for what Season 0 sells (session 48; owner 2026-10-19: two
// neutral season boasts, Boot Sequence and Dial-Up Fireworks, 300 credits
// each, on sale for the whole of Season 0, then retired; neither on sale
// until the render lane has drawn it).
//
//   npx tsx src/dev/season0BoastsDemo.ts > ../progress/economy-demo-013.txt
//
// Section 1 prints the SHIPPED catalogue (both boasts drawn since render
// session 33). Sections 2-4 pin an undrawn copy of it (both Season 0 boasts'
// `drawn` set to false, as the economy test does), so the gate they show
// doesn't change as the render lane draws: in a real database file an owner
// earns 300 credits in real engine matches (LookaheadAgent both sides,
// starter decks, startMatch -> runMatch -> recordMatch) and can't buy either
// boast. Then the same file is reopened with only Boot Sequence marked drawn
// (the change the render lane makes with its spec): Boot Sequence is on sale
// and bought, Dial-Up Fireworks still isn't, and the next real win plays Boot
// Sequence on the match record. Section 4: a Season 1 file sells neither,
// retired. Section 5: a Season 0 file with the shipped catalogue sells both.
// Seeds and the clock are fixed so the output reproduces.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LookaheadAgent, runMatch, type DeckFaction } from "@ai-tcg/engine";
import { COSMETICS, EconomyError, EconomyStore, SEASON_0_BOASTS, SEASON_BOAST_PRICE_CREDITS, onSale, type CosmeticItem, type MatchRecord } from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "s0-boasts-"));
const dbPath = join(tempDir, "season-0.db");
let clock = new Date("2026-10-19T09:00:00.000Z");
const now = () => clock;
const say = (line = "") => console.log(line);
const [boot, dialUp] = SEASON_0_BOASTS as [CosmeticItem, CosmeticItem];
const names = new Map(COSMETICS.map((i) => [i.itemId, i.name]));
const show = (id: string | null) => (id === null ? "-" : names.get(id) ?? id);
const onSaleList = (s: EconomyStore, ownerId: string) => {
  const items = s.cosmeticsOnSale(ownerId);
  return items.length === 0 ? "nothing" : items.map((i) => `${i.name} (${i.priceCredits} credits${i.owned ? ", owned" : ""})`).join(", ");
};
function tryBuy(s: EconomyStore, ownerId: string, item: CosmeticItem): string {
  try {
    const owned = s.buyCosmetic(ownerId, item.itemId);
    return `bought (ledger row ${owned.ledgerEntryId}, ${owned.source})`;
  } catch (err) {
    if (!(err instanceof EconomyError)) throw err;
    return `refused: ${err.message}`;
  }
}

say("# What Season 0 sells: the two Season 0 boasts (session 48)");
say();

// ---- 1. the shipped catalogue ----
say("## 1. The shipped catalogue");
say();
for (const i of COSMETICS) {
  const price = i.priceCredits === null ? "free (starter)" : `${i.priceCredits} credits`;
  say(`${i.itemId.padEnd(28)} ${i.name.padEnd(18)} ${i.season.padEnd(8)} ${(i.faction ?? "neutral").padEnd(7)} ${price.padEnd(15)} drawn: ${i.drawn ? "yes" : "no "}  on sale in S0 now: ${onSale(i, "S0", clock.toISOString()) ? "yes" : "no"}`);
}
say();
say(`${boot.name}: ${boot.description}`);
say(`${dialUp.name}: ${dialUp.description}`);
say();

// ---- 2. a Season 0 file, neither boast drawn: earn 300, can't buy ----
const undrawn = COSMETICS.map((i) => (SEASON_0_BOASTS.includes(i) ? { ...i, drawn: false } : i));
let store = EconomyStore.open(dbPath, { now, cosmetics: undrawn });
function seat(name: string, faction: DeckFaction) {
  const owner = store.createOwner({ name });
  const { copies } = store.grantStarterCollection(owner.ownerId, faction);
  const agent = store.createAgent({ ownerId: owner.ownerId, name: `${name}'s agent` });
  const deck = store.saveDeck(owner.ownerId, `${faction} starter`, copies.map((c) => c.copyId));
  store.setActiveDeck(owner.ownerId, deck.deckId);
  store.connectAgent(owner.ownerId, agent.agentId);
  return { ownerId: owner.ownerId, agentId: agent.agentId, name };
}
const ada = seat("ada", "Swarm");
const bo = seat("bo", "Null");

let matchNo = 0;
async function play(): Promise<MatchRecord> {
  const matchId = `s0-m${String(++matchNo).padStart(3, "0")}`;
  clock = new Date(Date.UTC(2026, 9, 19 + Math.floor((matchNo - 1) / 10), 10, ((matchNo - 1) % 10) * 5));
  const live = store.startMatch({ matchId, p1OwnerId: ada.ownerId, p2OwnerId: bo.ownerId });
  const seed = 4800 + matchNo;
  const result = await runMatch(
    { ...live.p1.deck.spec, id: "p1" },
    { ...live.p2.deck.spec, id: "p2" },
    new LookaheadAgent("ada's agent", seed * 2),
    new LookaheadAgent("bo's agent", seed * 2 + 1),
    seed,
  );
  const w = result.state.winner;
  return store.recordMatch({
    matchId,
    seed,
    p1AgentId: live.p1.agentId,
    p2AgentId: live.p2.agentId,
    p1DeckId: live.p1.deck.deckId,
    p2DeckId: live.p2.deck.deckId,
    outcome: w === "p1" ? { kind: "win", winnerAgentId: ada.agentId } : w === "p2" ? { kind: "win", winnerAgentId: bo.agentId } : { kind: "draw" },
    turns: result.state.turnNumber,
    moves: result.movesPlayed,
    finalHealth: { p1: result.state.players.p1.health, p2: result.state.players.p2.health },
    endedAt: clock.toISOString(),
  });
}
const who = (agentId: string | null) => (agentId === ada.agentId ? "ada" : agentId === bo.agentId ? "bo" : "-");
const row = (m: MatchRecord) => {
  const result = m.outcome === "win" ? `${who(m.winnerAgentId)} wins` : m.outcome;
  const boast = m.boast === null ? "no boast" : `boast: ${show(m.boast.itemId)} (${m.boast.slot}, winner on ${m.boast.winnerHealth})`;
  return `${m.matchId}  T${String(m.turns).padStart(2)}  ${result.padEnd(9)} ada +${String(m.p1Credits).padEnd(2)}  ${boast}`;
};

say("## 2. A Season 0 file with neither Season 0 boast drawn (an undrawn copy of the catalogue): ada earns 300 credits in real matches");
say();
while (store.balance(ada.ownerId) < SEASON_BOAST_PRICE_CREDITS) say(row(await play()));
say();
say(`ada's credits: ${store.balance(ada.ownerId)}`);
say(`on sale for ada: ${onSaleList(store, ada.ownerId)}`);
say(`buy ${boot.name}: ${tryBuy(store, ada.ownerId, boot)}`);
say(`buy ${dialUp.name}: ${tryBuy(store, ada.ownerId, dialUp)}`);
say(`ada's credits after: ${store.balance(ada.ownerId)} (nothing debited)`);
store.close();
say();

// ---- 3. the same file once the render lane has drawn Boot Sequence ----
const bootDrawn = undrawn.map((i) => (i.itemId === boot.itemId ? { ...i, drawn: true } : i));
store = EconomyStore.open(dbPath, { now, cosmetics: bootDrawn });
say(`## 3. The same file, reopened with only ${boot.name} marked drawn (the render lane's change when it ships the spec)`);
say();
say(`on sale for ada: ${onSaleList(store, ada.ownerId)}`);
say(`buy ${dialUp.name}: ${tryBuy(store, ada.ownerId, dialUp)}`);
say(`buy ${boot.name}: ${tryBuy(store, ada.ownerId, boot)}`);
const payment = store.ledger(ada.ownerId).at(-1)!;
say(`  ledger: ${payment.delta} credits, ${payment.reason}, ref ${payment.ref}; ada's credits now ${store.balance(ada.ownerId)}`);
say(`buy ${boot.name} again: ${tryBuy(store, ada.ownerId, boot)}`);
say(`on sale for ada: ${onSaleList(store, ada.ownerId)}`);
store.setLoadout(ada.ownerId, ada.agentId, "boast", boot.itemId);
say(`ada's agent loadout: boast=${show(store.loadout(ada.agentId).boast)}  (bo's: boast=${show(store.loadout(bo.agentId).boast)})`);
say();
say("Real matches until ada's agent wins:");
let win: MatchRecord;
do {
  win = await play();
  say(row(win));
} while (!(win.outcome === "win" && win.winnerAgentId === ada.agentId));
say();
say(`the win's record: boast ${win.boast?.itemId} (${win.boast?.slot}); ada's saved loadout boast=${show(win.loadouts?.p1?.boast ?? null)}`);
store.close();
say();

// ---- 4. Season 1: retired ----
say("## 4. A Season 1 file with the same catalogue: both Season 0 boasts are retired");
say();
const s1 = EconomyStore.open(join(tempDir, "season-1.db"), { now, season: "S1", cosmetics: bootDrawn });
const cy = s1.createOwner({ name: "cy" });
s1.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${cy.ownerId}', 'credits', 1000, 'demoGrant', '${clock.toISOString()}')`);
say(`on sale for cy (1000 credits): ${onSaleList(s1, cy.ownerId)}`);
say(`buy ${boot.name}: ${tryBuy(s1, cy.ownerId, boot)}`);
say(`buy ${dialUp.name}: ${tryBuy(s1, cy.ownerId, dialUp)}`);
s1.close();
say();

// ---- 5. the shipped catalogue today: both drawn, both on sale ----
say("## 5. A Season 0 file with the shipped catalogue: both boasts are drawn, so both are on sale");
say();
const s0 = EconomyStore.open(join(tempDir, "season-0-shipped.db"), { now });
const di = s0.createOwner({ name: "di" });
s0.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${di.ownerId}', 'credits', 1000, 'demoGrant', '${clock.toISOString()}')`);
say(`on sale for di (1000 credits): ${onSaleList(s0, di.ownerId)}`);
say(`buy ${boot.name}: ${tryBuy(s0, di.ownerId, boot)}`);
say(`buy ${dialUp.name}: ${tryBuy(s0, di.ownerId, dialUp)}`);
say(`di's credits after: ${s0.balance(di.ownerId)}`);
s0.close();

rmSync(tempDir, { recursive: true, force: true });
