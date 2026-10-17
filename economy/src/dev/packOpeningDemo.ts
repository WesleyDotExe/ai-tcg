// Evidence for pack contents and opening (session 36; ECONOMY.md "Packs",
// roadmap item 5), and the signature art-pool slot (owner 2026-10-16).
//
//   npx tsx src/dev/packOpeningDemo.ts > ../progress/economy-demo-006.txt
//
// (economy-demo-006.txt was made under S0-odds-1; since session 39 packs
// open under S0-odds-2, so a rerun shows different packs. The chase cards'
// own evidence is chaseLiveDemo.ts, economy-demo-009.txt.)
//
// In a real database file: a new owner takes the starter collection and
// opens its 3 starter packs one at a time (the pack-result screen's data:
// slot, card, rarity, finish, collector number, NEW and "x N owned"), earns
// credits from recorded matches, buys a pack, gets 10 more and opens them as
// one bulk open (the summary the sped-up reveal ends on), checks its pity
// timers, reveals a logged seed, crafts a card with pack points, and
// generates an agent whose signature card records its art-pool slot. Then
// the schema refuses what it should, through raw SQL.
// Seeds are fixed here so the output reproduces; the store draws them
// server-side otherwise.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EconomyError, EconomyStore, LIVE_PACK_ODDS, PACK_PRICE_CREDITS, type PackOpening } from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "pack-opening-demo-"));
const dbPath = join(tempDir, "season-0.db");
let clock = new Date("2026-10-16T09:00:00.000Z");
const tick = (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000));
let store = EconomyStore.open(dbPath, { now: () => clock });
const say = (line = "") => console.log(line);
const FINISH: Record<string, string> = { standard: "", foil: "FOIL", fullArt: "FULL ART", altArt: "ALT ART", gold: "GOLD", prototype: "PROTOTYPE", glitch: "GLITCH", secret: "SECRET", zeroDay: "ZERO-DAY" };

function showPack(p: PackOpening, title: string): void {
  const flags = [p.jackpot && "JACKPOT PACK", p.pity.fullArt && "pity: Full Art or better", p.pity.mythic && "pity: Mythic", p.fullReveal && "full reveal"].filter(Boolean);
  say(`${title}  seed ${p.seed}  odds ${p.oddsVersion}  +${p.packPoints} pack points${flags.length ? `  [${flags.join(", ")}]` : ""}`);
  for (const c of p.cards) {
    const proto = c.prototype ? ` ${String(c.prototype.serial).padStart(2, "0")}/${c.prototype.runSize} ${c.prototype.runCode}` : "";
    say(
      `    ${c.slot.padEnd(9)} ${c.collectorNumber}  ${c.name.padEnd(24)} ${c.rarity.padEnd(9)} ${(FINISH[c.finish] + proto).padEnd(10)} ${c.isNew ? "NEW" : "   "}  x${c.ownedAfter} owned`,
    );
  }
}

say("# Pack contents and opening (session 36)");
say(`database: <temp>/season-0.db  schema v${store.schemaVersion}  season ${store.season}  odds table ${LIVE_PACK_ODDS.version}`);
say();

// ---- the starter collection and its 3 packs, one at a time ----
const owner = store.createOwner({ name: "demo-owner" });
const house = store.createOwner({ name: "house-cortex", kind: "house" });
const ownerAgent = store.createAgent({ ownerId: owner.ownerId, name: "Demo agent" });
const houseAgent = store.createAgent({ ownerId: house.ownerId, name: "Lookahead-Cortex" });
const starter = store.grantStarterCollection(owner.ownerId, "Swarm");
say(`## 1. Starter collection: ${starter.copies.length} bound Swarm copies and ${starter.packs.length} starter packs`);
say();
for (const [i, seed] of [1101, 1102, 1103].entries()) {
  tick(1);
  showPack(store.openPack(owner.ownerId, undefined, { seed }), `starter pack ${i + 1}`);
}
say();
say("(A card in the Swarm starter deck is never NEW: the owner already holds its starter copies.)");
say();

// ---- earning, buying ----
say("## 2. Credits from play, then a purchase");
for (let i = 0; i < 12; i++) {
  tick(20);
  store.recordMatch({ matchId: `m${i}`, seed: i, p1AgentId: ownerAgent.agentId, p2AgentId: houseAgent.agentId, outcome: { kind: "win", winnerAgentId: ownerAgent.agentId } });
}
say(`12 wins today: ${store.balance(owner.ownerId)} credits (the daily schedule stops paying after the 10th win).`);
try {
  store.buyPack(owner.ownerId, "S0");
} catch (err) {
  say(`buy a pack (${PACK_PRICE_CREDITS} credits): refused, ${(err as EconomyError).message}`);
}
tick(24 * 60);
for (let i = 0; i < 2; i++) {
  tick(20);
  store.recordMatch({ matchId: `n${i}`, seed: i, p1AgentId: ownerAgent.agentId, p2AgentId: houseAgent.agentId, outcome: { kind: "win", winnerAgentId: ownerAgent.agentId } });
}
const bought = store.buyPack(owner.ownerId, "S0");
say(`next day, 2 more wins: bought a pack; ${store.balance(owner.ownerId)} credits left.`);
tick(1);
showPack(store.openPack(owner.ownerId, bought.packId, { seed: 2201 }), "bought pack");
say();

// ---- a 10-pack bulk open ----
say("## 3. Ten weekly-challenge packs, opened as one bulk open (same odds, no discount, no bonus)");
for (let i = 0; i < 10; i++) store.grantPack(owner.ownerId, "S0", "weeklyChallenge");
tick(1);
const bulk = store.openPacks(owner.ownerId, 10, { seeds: Array.from({ length: 10 }, (_, i) => 3300 + i) });
for (const [i, p] of bulk.packs.entries()) {
  const best = p.cards.filter((c) => c.finish !== "standard" || c.rarity === "Mythic" || c.rarity === "Rare");
  const newCount = p.cards.filter((c) => c.isNew).length;
  say(
    `  pack ${String(i + 1).padStart(2)}  seed ${p.seed}  ${newCount} NEW  highlights: ` +
      (best.map((c) => `${c.name} (${c.rarity}${FINISH[c.finish] ? `, ${FINISH[c.finish]}` : ""})`).join("; ") || "-") +
      (p.fullReveal ? "  [full reveal]" : ""),
  );
}
const sm = bulk.summary;
say(`  summary: ${sm.cards} cards, ${sm.newCards} new cards, +${sm.packPoints} pack points`);
say(`           by rarity ${Object.entries(sm.byRarity).map(([r, n]) => `${r} ${n}`).join(", ")}; by finish ${Object.entries(sm.byFinish).map(([f, n]) => `${f} ${n}`).join(", ")}`);
say(`           packs keeping their full reveal: ${sm.fullReveals.length}`);
say();

// ---- pity and the logged seed ----
const pity = store.pityStatus(owner.ownerId);
say("## 4. Pity timers (worked out from the owner's opening history)");
say(`  packs in a row with no Full Art or better: ${pity.packsSinceFullArt} (guaranteed at ${LIVE_PACK_ODDS.pity.fullArtAfter}); with no Mythic: ${pity.packsSinceMythic} (at ${LIVE_PACK_ODDS.pity.mythicAfter})`);
say(`  next pack guarantees: ${pity.next.fullArt || pity.next.mythic ? JSON.stringify(pity.next) : "nothing yet"}`);
const log = store.packOpening(bulk.packs[0]!.packId);
say(`  the opening log for bulk pack 1: seed ${log.seed}, odds ${log.oddsVersion}, ${log.copies.length} copies, opened ${log.openedAt}`);
say();

// ---- crafting ----
say("## 5. Crafting with pack points");
const points = store.balance(owner.ownerId, "packPoints");
const held = (id: string) => store.collection(owner.ownerId).filter((c) => c.cardId === id).length;
// A Common the owner holds just one copy of.
const target = store
  .collection(owner.ownerId)
  .map((c) => c.cardId)
  .find((id) => store.cardHoldings(owner.ownerId, id).rarity === "Common" && held(id) === 1)!;
const crafted = store.craftCard(owner.ownerId, target);
say(`  ${points} pack points; crafted a standard ${target} (held 1, now ${held(target)}): ${crafted.origin}, account-bound ${crafted.accountBound}; ${store.balance(owner.ownerId, "packPoints")} pack points left`);
try {
  const mythic = store.collection(owner.ownerId).find((c) => c.cardId === "SW-006")?.cardId ?? "SW-006";
  store.craftCard(owner.ownerId, mythic);
} catch (err) {
  say(`  craft a Mythic: refused, ${(err as EconomyError).message}`);
}
say();

// ---- the art-pool slot ----
say("## 6. Generating an agent: themed agent names, and the signature card's art-pool slot");
const draft = store.startAgentDraft(owner.ownerId, { seed: 36 });
say(`  agents offered: ${draft.agents.map((a) => a.name).join(" | ")}`);
store.pickDraftAgent(owner.ownerId, draft.draftId, 0, { seed: 136 });
const made = store.confirmAgentDraft(owner.ownerId, draft.draftId, 0, { artSlot: 217 });
say(`  confirmed ${made.agent.name}: ${made.signature.card.name} (${made.signature.collectorNumber})`);
say(`  art pool ${made.signature.art!.pool}, slot ${made.signature.art!.slot} of 500; card art reference ${made.signature.card.art}`);
say();

// ---- reopen, and the schema's refusals ----
store.close();
store = EconomyStore.open(dbPath, { now: () => clock });
say("## 7. Reopened from the file, then raw SQL against the rules");
say(`  same collection after reopening: ${store.collection(owner.ownerId).length} copies; same art slot: ${store.signatureCard(made.agent.agentId)!.art!.slot}`);
const refusals: [string, () => void][] = [
  ["open the same pack again", () => store.openPack(owner.ownerId, bought.packId)],
  ["mark a pack opened without an opening", () => {
    const p = store.grantPack(owner.ownerId, "S0", "weeklyChallenge");
    store.unsafeExec(`UPDATE packs SET opened_at = '${clock.toISOString()}' WHERE pack_id = '${p.packId}'`);
  }],
  ["change a logged seed", () => store.unsafeExec("UPDATE pack_openings SET seed = 1")],
  ["delete an opening", () => store.unsafeExec("DELETE FROM pack_openings")],
  ["forge a 7th card into an opened pack", () => {
    for (let i = 0; i < 2; i++) store.grantCopy({ ownerId: owner.ownerId, cardId: "SW-001", origin: "pack", originRef: `pack:${bought.packId}` });
  }],
  ["move a signature card to another art slot", () => store.unsafeExec("UPDATE signature_cards SET art_slot = 1")],
  ["open 3 packs at once", () => store.openPacks(owner.ownerId, 3)],
];
for (const [what, act] of refusals) {
  try {
    act();
    say(`  ${what}: ALLOWED (bug)`);
  } catch (err) {
    say(`  ${what}: refused, ${(err as Error).message.replace(bought.packId, "<the bought pack>")}`);
  }
}
store.close();
rmSync(tempDir, { recursive: true, force: true });
