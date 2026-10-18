// Evidence for cosmetics and victory boasts, the game lane's half (session
// 47; owner 2026-10-19: plan approved with all 6 suggested defaults).
//
//   npx tsx src/dev/boastDemo.ts > ../progress/economy-demo-012.txt
//
// In a real database file: a Season 0 file made at schema v10 (two owners
// with starter collections, an agent each, a recorded match) is opened by
// this code and migrated to v11, which gives both owners the four starter
// boasts and their agents their faction's boast. Then real engine matches
// (LookaheadAgent on both sides, the owners' active starter decks) are
// started with startMatch and recorded with each side's final health: the
// winner's credits pay for a 300-credit season boast, the owner equips it
// and a close-win boast, and each recorded match shows which boast played
// and why. The match history is read back after the loadout changes, then
// the refusals. Seeds and the clock are fixed so the output reproduces.
//
// The shipped catalogue sells nothing yet (which Season 0 items go on sale
// is the owner's call); the season boast here is a DEMO item passed to the
// store as its catalogue, priced and windowed like a real one.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LookaheadAgent, runMatch, type DeckFaction } from "@ai-tcg/engine";
import { CLOSE_WIN_HEALTH, COSMETICS, EconomyStore, SEASON_BOAST_PRICE_CREDITS, STARTER_BOASTS, type CosmeticItem, type MatchRecord } from "../index.js";

const DEMO_BOAST: CosmeticItem = {
  itemId: "boast-s0-demo-overclock",
  kind: "boast",
  name: "DEMO Overclock",
  season: "S0",
  faction: null,
  priceCredits: SEASON_BOAST_PRICE_CREDITS,
  sale: { from: "2026-10-01T00:00:00.000Z", until: "2026-11-01T00:00:00.000Z" },
  artRef: "code:boast/demo-overclock",
  description: "A demo season boast (not a shipped item).",
};
const CATALOGUE = [...COSMETICS, DEMO_BOAST];

const tempDir = mkdtempSync(join(tmpdir(), "boast-demo-"));
const dbPath = join(tempDir, "season-0.db");
let clock = new Date("2026-10-19T09:00:00.000Z");
const now = () => clock;
const say = (line = "") => console.log(line);
const itemName = new Map(CATALOGUE.map((i) => [i.itemId, i.name]));
const show = (id: string | null) => (id === null ? "-" : itemName.get(id) ?? id);
const showLoadout = (l: Record<string, string | null>) =>
  Object.entries(l)
    .map(([slot, id]) => `${slot}=${show(id)}`)
    .join("  ");

say("# Cosmetics and victory boasts: the game lane's half (session 47)");
say();

// ---- 1. a v10 file, migrated ----
say("## 1. A Season 0 file made at schema v10, opened by this code (migration 11)");
say();
let store = EconomyStore.open(dbPath, { now, migrateTo: 10, cosmetics: CATALOGUE });
function seat(name: string, faction: DeckFaction) {
  const owner = store.createOwner({ name });
  const { copies } = store.grantStarterCollection(owner.ownerId, faction);
  const agent = store.createAgent({ ownerId: owner.ownerId, name: `${name}'s agent` });
  const deck = store.saveDeck(owner.ownerId, `${faction} starter`, copies.map((c) => c.copyId));
  store.setActiveDeck(owner.ownerId, deck.deckId);
  store.connectAgent(owner.ownerId, agent.agentId);
  return { ownerId: owner.ownerId, agentId: agent.agentId, name, faction };
}
const ada = seat("ada", "Cortex");
const bo = seat("bo", "Aegis");
store.recordMatch({ matchId: "pre-v11", seed: 1, p1AgentId: ada.agentId, p2AgentId: bo.agentId, outcome: { kind: "win", winnerAgentId: bo.agentId } });
say(`before: schema v${store.schemaVersion}; ada owns ${store.ownedCosmetics(ada.ownerId).length} cosmetics; match "pre-v11" recorded`);
store.close();

store = EconomyStore.open(dbPath, { now, cosmetics: CATALOGUE });
say(`after:  schema v${store.schemaVersion}`);
for (const p of [ada, bo]) {
  const owned = store.ownedCosmetics(p.ownerId);
  say(`  ${p.name} (${p.faction} starter): owns ${owned.map((c) => `${c.item?.name} [${c.source}]`).join(", ")}`);
  say(`    agent loadout: ${showLoadout(store.loadout(p.agentId))}`);
}
const pre = store.matchHistory()[0]!;
say(`  match "pre-v11": loadouts ${pre.loadouts === null ? "none (recorded before v11)" : "?"}, boast ${pre.boast === null ? "none (the render falls back to the winner's faction starter)" : "?"}`);
say();

// ---- 2. real matches ----
let matchNo = 0;
async function play(day: string, minute: number): Promise<MatchRecord> {
  const matchId = `s0-b${String(++matchNo).padStart(3, "0")}`;
  clock = new Date(`${day}T10:${String(minute).padStart(2, "0")}:00.000Z`);
  const live = store.startMatch({ matchId, p1OwnerId: ada.ownerId, p2OwnerId: bo.ownerId });
  const seed = 4700 + matchNo;
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
function row(m: MatchRecord): string {
  const result = m.outcome === "win" ? `${who(m.winnerAgentId)} wins` : m.outcome;
  const boast = m.boast === null ? "no boast" : `boast: ${show(m.boast.itemId)} (${m.boast.slot}, winner on ${m.boast.winnerHealth})`;
  return `${m.matchId}  T${String(m.turns).padStart(2)}  ${result.padEnd(9)} ada +${String(m.p1Credits).padEnd(2)} bo +${String(m.p2Credits).padEnd(2)}  ${boast}`;
}

say("## 2. Real matches (LookaheadAgent, starter decks, startMatch -> runMatch -> recordMatch)");
say(`ada and bo play until ada has ${SEASON_BOAST_PRICE_CREDITS} credits, 10 matches a day; both agents wear their faction starter boast`);
say();
const days = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"];
earn: for (const day of days) {
  for (let i = 0; i < 10; i++) {
    const m = await play(day, i * 5);
    say(row(m));
    if (store.balance(ada.ownerId) >= SEASON_BOAST_PRICE_CREDITS) break earn;
  }
}
say();
say(`ada's credits: ${store.balance(ada.ownerId)}; bo's: ${store.balance(bo.ownerId)}`);
say();

// ---- 3. buy and equip ----
say("## 3. ada buys a season boast and sets a close-win boast");
say();
say(`on sale for ada: ${store.cosmeticsOnSale(ada.ownerId).map((i) => `${i.name} (${i.priceCredits} credits${i.owned ? ", owned" : ""})`).join(", ")}`);
const bought = store.buyCosmetic(ada.ownerId, DEMO_BOAST.itemId);
const payment = store.ledger(ada.ownerId).find((e) => e.entryId === bought.ledgerEntryId)!;
say(`bought ${bought.item?.name}: ledger #${payment.entryId} ${payment.delta} ${payment.currency} "${payment.reason}" ref ${payment.ref}; credits now ${store.balance(ada.ownerId)}`);
store.setLoadout(ada.ownerId, ada.agentId, "boast", DEMO_BOAST.itemId);
store.setLoadout(ada.ownerId, ada.agentId, "closeWinBoast", STARTER_BOASTS.Null.itemId);
say(`ada's agent: ${showLoadout(store.loadout(ada.agentId))}`);
store.setLoadout(bo.ownerId, bo.agentId, "boast", null);
say(`bo empties the boast slot: ${showLoadout(store.loadout(bo.agentId))}`);
say(`(close win = the winner ends on ${CLOSE_WIN_HEALTH} health or less; an empty boast slot plays the deck faction's starter)`);
say();

// ---- 4. more matches ----
say("## 4. More real matches: which boast each win played, and why");
say();
const tally = new Map<string, number>();
const later: MatchRecord[] = [];
for (let i = 0; i < 24; i++) {
  const m = await play(i < 12 ? "2026-10-30" : "2026-10-31", (i % 12) * 4);
  later.push(m);
  say(row(m));
  const key = m.boast === null ? "none (draw)" : `${who(m.boast.agentId)}: ${m.boast.slot}`;
  tally.set(key, (tally.get(key) ?? 0) + 1);
}
say();
say(`tally: ${[...tally.entries()].sort().map(([k, n]) => `${k} x${n}`).join(", ")}`);
const wrong = later.filter((m) => {
  if (m.boast === null) return m.outcome === "win";
  const health = m.boast.winnerHealth!;
  if (m.boast.agentId === ada.agentId) return m.boast.itemId !== (health <= CLOSE_WIN_HEALTH ? STARTER_BOASTS.Null.itemId : DEMO_BOAST.itemId);
  return m.boast.itemId !== STARTER_BOASTS.Aegis.itemId || m.boast.slot !== "factionStarter";
});
say(`checked against the rule: ${later.length - wrong.length} of ${later.length} matches right`);
say();

// ---- 5. replays keep what the agents had then ----
say("## 5. ada changes the loadout; the history still shows what each match had");
say();
store.setLoadout(ada.ownerId, ada.agentId, "boast", STARTER_BOASTS.Swarm.itemId);
store.setLoadout(ada.ownerId, ada.agentId, "closeWinBoast", null);
say(`ada's agent now: ${showLoadout(store.loadout(ada.agentId))}`);
const history = store.matchHistory();
const sample = [history[0]!, history.find((m) => m.matchId === later[0]!.matchId)!, history.at(-1)!];
for (const m of sample) {
  say(`  ${m.matchId}: ada had ${m.loadouts ? showLoadout(m.loadouts.p1) : "(no loadout on record)"}`);
  say(`  ${" ".repeat(m.matchId.length)}  ${m.boast ? `${who(m.boast.agentId)} won and played ${show(m.boast.itemId)} (${m.boast.slot})` : "no boast on record"}`);
}
const same = later.every((m) => {
  const h = history.find((x) => x.matchId === m.matchId)!;
  return JSON.stringify(h.loadouts) === JSON.stringify(m.loadouts) && JSON.stringify(h.boast) === JSON.stringify(m.boast);
});
say(`every section-4 match reads back as recorded: ${same}`);
say();

// ---- 6. refusals ----
say("## 6. Refusals");
say();
const attempt = (what: string, fn: () => unknown) => {
  try {
    fn();
    say(`  ${what}: ALLOWED (bug)`);
  } catch (err) {
    say(`  ${what}: refused: ${(err as Error).message}`);
  }
};
attempt("ada buys the same boast again", () => store.buyCosmetic(ada.ownerId, DEMO_BOAST.itemId));
const cy = store.createOwner({ name: "cy" });
store.grantStarterCollection(cy.ownerId, "Swarm");
const cyAgent = store.createAgent({ ownerId: cy.ownerId, name: "cy's agent" });
attempt(`cy (${store.balance(cy.ownerId)} credits) buys it`, () => store.buyCosmetic(cy.ownerId, DEMO_BOAST.itemId));
attempt("cy equips a boast cy doesn't own", () => store.setLoadout(cy.ownerId, cyAgent.agentId, "boast", DEMO_BOAST.itemId));
attempt("ada buys a starter boast", () => store.buyCosmetic(ada.ownerId, STARTER_BOASTS.Aegis.itemId));
attempt("bo equips a boast as an arena", () => store.setLoadout(bo.ownerId, bo.agentId, "arena", STARTER_BOASTS.Aegis.itemId));
attempt("bo dresses ada's agent", () => store.setLoadout(bo.ownerId, ada.agentId, "boast", STARTER_BOASTS.Aegis.itemId));
store.startMatch({ matchId: "live-x", p1OwnerId: ada.ownerId, p2OwnerId: bo.ownerId });
attempt("ada changes the boast mid-match", () => store.setLoadout(ada.ownerId, ada.agentId, "boast", DEMO_BOAST.itemId));
store.recordMatch({ matchId: "live-x", seed: 0, p1AgentId: ada.agentId, p2AgentId: bo.agentId, outcome: { kind: "cancelled" } });
attempt("raw SQL: delete an owned cosmetic", () => store.unsafeExec("DELETE FROM owned_cosmetics"));
attempt("raw SQL: move an owned cosmetic", () => store.unsafeExec(`UPDATE owned_cosmetics SET owner_id = '${bo.ownerId}' WHERE owner_id = '${ada.ownerId}'`));
attempt("raw SQL: rewrite a match's boast", () => store.unsafeExec("UPDATE match_boasts SET item_id = 'boast-null-void-collapse'"));
attempt("raw SQL: grant a 'bought' boast with no payment", () =>
  store.unsafeExec(`INSERT INTO owned_cosmetics (owner_id, item_id, kind, source, ledger_entry_id, acquired_at) VALUES ('${cy.ownerId}', '${DEMO_BOAST.itemId}', 'boast', 'purchase', 1, '${clock.toISOString()}')`),
);
clock = new Date("2026-11-01T00:00:00.000Z");
say(`  bo has ${store.balance(bo.ownerId)} credits`);
attempt("bo buys the boast after its sale window (retired)", () => store.buyCosmetic(bo.ownerId, DEMO_BOAST.itemId));
say(`  ada still owns it after retirement: ${store.ownedCosmetics(ada.ownerId).some((c) => c.itemId === DEMO_BOAST.itemId)}`);

store.close();
rmSync(tempDir, { recursive: true, force: true });
