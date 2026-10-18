// Evidence for the 3 Zero-Day cards going live (session 42; owner
// 2026-10-18, answers to session 41: "go live at the proposed numbers ...
// a pulled reserved copy becomes the real card, and Zero-Day crafting opens
// at 3,000 pack points").
//
//   npx tsx src/dev/zeroDayLiveDemo.ts > ../progress/economy-demo-010.txt
//
// Through the store, in a real database file: the secret list now names the
// 3 cards; an owner pulls a Zero-Day card from a pack and the copy is the
// live card; it goes in a saved deck, the deck loads for play and a match
// with it resolves, the agent choosing a mode when it plays the card; a
// second owner earns 3,000 pack points from packs and crafts one; and what
// stays refused. Seeds are fixed so the output reproduces.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LookaheadAgent, buildCortexDeck, formatEvent, getCard, runMatch, type Card } from "@ai-tcg/engine";
import { cardSet, EconomyError, EconomyStore, LIVE_PACK_ODDS, rollPack, SECRET_CRAFT_PACK_POINTS, type PityState } from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "zero-day-live-demo-"));
const dbPath = join(tempDir, "season-0.db");
let clock = new Date("2026-10-18T12:00:00.000Z");
const tick = (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000));
const say = (line = "") => console.log(line);
const S0 = cardSet("S0");
const RUNS = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));

function seedFor(pity: PityState, want: (r: ReturnType<typeof rollPack>) => boolean, start: number): number {
  for (let seed = start; ; seed++) if (want(rollPack(seed, S0, pity, RUNS, LIVE_PACK_ODDS))) return seed;
}
function refusal(what: string, fn: () => unknown): void {
  try {
    fn();
    say(`    ${what}: ALLOWED (this is a bug)`);
  } catch (err) {
    say(`    ${what}: refused (${err instanceof EconomyError || err instanceof Error ? err.message : String(err)})`);
  }
}
function modesOf(card: Card): string {
  return (card.modes ?? []).map((m) => `${m.name}: "${m.text}"`).join(" / ");
}

say("# The 3 Zero-Day cards go live (session 42)");
say();

// ---- 1. the secret list ----
say("## 1. The Zero-Day entries are the live cards");
say();
for (const s of S0.secrets.filter((x) => x.kind === "zeroDay")) {
  const card = getCard(s.cardId)!;
  const body = card.type === "Unit" ? ` ${card.attack}/${card.health}` : "";
  say(`    ${s.collectorNumber}  ${s.code}  ${card.name.padEnd(13)} ${card.faction} ${card.type}, ${card.cost} energy${body}, ${card.rarity}, 1 per deck`);
  say(`        ${modesOf(card)}`);
}
say(`    base set: ${S0.cards.length} cards (unchanged: the Zero-Day cards are secret cards, not base cards; no Gold or plain version)`);
say();

const store = EconomyStore.open(dbPath, { now: () => clock });

// ---- 2. a pulled copy plays ----
say("## 2. A Zero-Day card pulled from a pack goes in a deck and plays");
say();
const owner = store.createOwner({ name: "zero-day-owner" }).ownerId;
const starter = store.grantStarterCollection(owner, "Cortex").copies;
store.grantPack(owner, "S0", "weeklyChallenge");
const zdSeed = seedFor(store.pityStatus(owner), (r) => r.pulls[4]!.finish === "zeroDay" && !r.jackpot && r.pulls[4]!.cardId === "S0-ZD1", 0);
const pack = store.openPack(owner, undefined, { seed: zdSeed });
const pulled = pack.cards[4]!;
say(`    pack seed ${pack.seed} (${pack.oddsVersion}): shine slot ${pulled.collectorNumber} ${pulled.name}, finish ${pulled.finish}, ${pulled.isNew ? "NEW" : "held"}, full reveal ${pack.fullReveal}`);
const copy = store.getCopy(pulled.copyId);
say(`    the copy: card ${copy.cardId} (${getCard(copy.cardId)!.name}), finish ${copy.finish}, secret code ${copy.secretCode}, origin ${copy.origin}`);
// One Cortex starter card out (the first Common), the Zero-Day card in.
const out = starter.findIndex((c) => getCard(c.cardId)!.rarity === "Common");
const listed = [...starter.filter((_, i) => i !== out).map((c) => c.copyId), copy.copyId];
const saved = store.saveDeck(owner, "Cortex + Patient Zero", listed);
store.setActiveDeck(owner, saved.deckId);
const playable = store.loadDeck(saved.deckId);
say(`    saved deck "${saved.name}": ${playable.spec.cards.length} cards, ${getCard(starter[out]!.cardId)!.name} out, Patient Zero in; active; loads for play`);
// The first match seed (from 1) where the deck's owner plays the card.
let shown = false;
for (let seed = 1; seed <= 200 && !shown; seed++) {
  const { state } = await runMatch({ ...playable.spec, id: "p1" }, buildCortexDeck("p2", "Cortex"), new LookaheadAgent("zero-day-owner", seed), new LookaheadAgent("opponent", seed), seed);
  const played = state.log.findIndex((e) => e.type === "play" && e.player === "p1" && e.card === "Patient Zero");
  if (played < 0) continue;
  shown = true;
  say(`    match seed ${seed} against the shipped Cortex deck, LookaheadAgent both sides: the owner's agent plays it on turn ${state.log.slice(0, played).filter((e) => e.type === "turnStart").length}`);
  const id = (state.log[played] as { instanceId?: string }).instanceId;
  for (const e of state.log.slice(played)) {
    const line = formatEvent(e);
    const mentions = line.includes("Patient Zero") || (id !== undefined && JSON.stringify(e).includes(`"${id}"`));
    if (mentions || e.type === "gameOver") say(`        ${line}`);
  }
}
say();

// ---- 3. crafting ----
say(`## 3. Zero-Day crafting is open (${SECRET_CRAFT_PACK_POINTS.zeroDay.toLocaleString("en-US")} pack points)`);
say();
{
  const crafter = store.createOwner({ name: "crafting-owner" }).ownerId;
  for (let i = 0; i < 600; i++) store.grantPack(crafter, "S0", "weeklyChallenge");
  for (let i = 0; i < 60; i++) {
    tick(1);
    store.openPacks(crafter, 10, { seeds: Array.from({ length: 10 }, (_, k) => 500_000 + i * 10 + k) });
  }
  const held = new Set(store.collection(crafter).map((c) => c.secretCode));
  const target = S0.secrets.find((s) => s.kind === "zeroDay" && !held.has(s.code))!;
  const before = store.balance(crafter, "packPoints");
  const crafted = store.craftSecret(crafter, target.code);
  say(`    600 packs opened: ${before} pack points; Zero-Day cards pulled: ${[...held].filter((c) => c?.includes("ZD")).length}`);
  say(`    crafted ${target.name} (${target.code}, ${target.collectorNumber}): finish ${crafted.finish}, origin ${crafted.origin}, account-bound ${crafted.accountBound}; pack points now ${store.balance(crafter, "packPoints")}`);
  refusal(`crafting ${target.code} again`, () => store.craftSecret(crafter, target.code));
  refusal(`crafting ${target.code} with craftCard (the Mythic price)`, () => store.craftCard(crafter, target.code));
  const holdings = store.cardHoldings(crafter, target.code);
  say(`    the card viewer: owned ${holdings.owned}, salvageable ${holdings.salvageable} (${holdings.notSalvageable.map((r) => r.reason).join("; ")})`);
}
say();

// ---- 4. still refused ----
say("## 4. Still refused");
say();
refusal("a plain (standard finish) copy of Patient Zero", () => store.grantCopy({ ownerId: owner, cardId: "S0-ZD1", origin: "pack" }));
refusal("a Gold copy of Root Access", () => store.grantCopy({ ownerId: owner, cardId: "S0-ZD2", origin: "pack", finish: "gold" }));
{
  const second = store.grantCopy({ ownerId: owner, cardId: "S0-ZD1", origin: "pack", finish: "zeroDay", secretCode: "S0-ZD1" });
  refusal("two Patient Zero in one deck", () => store.saveDeck(owner, "two", [...listed.slice(1), second.copyId]));
}
store.close();
rmSync(tempDir, { recursive: true, force: true });
