// Evidence for the chase cards going live (session 39; owner 2026-10-18,
// answers to session 38: "yes on 1-6").
//
//   npx tsx src/dev/chaseLiveDemo.ts > ../progress/economy-demo-009.txt
//
// In a real database file: a Season 0 file made at schema v9 (an owner with
// starter copies, a saved deck and an opened S0-odds-1-era pack) is
// upgraded to v10 and keeps every copy; then packs open under S0-odds-2
// through the store, showing a secret illustration, a Glitch card and a
// Zero-Day card as the pack-result screen gets them; 2,000 packs opened
// through the store are counted against the table; an owner crafts a secret
// card; the binder shows its five sections; and the schema refuses what it
// should, through raw SQL. Seeds are fixed so the output reproduces.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cardSet,
  EconomyError,
  EconomyStore,
  FULL_ART_OR_BETTER,
  LIVE_PACK_ODDS,
  PACK_POINTS_PER_PACK,
  rollPack,
  SECRET_CRAFT_PACK_POINTS,
  type Binder,
  type PackOpening,
  type PityState,
} from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "chase-live-demo-"));
const dbPath = join(tempDir, "season-0.db");
let clock = new Date("2026-10-18T09:00:00.000Z");
const tick = (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000));
const say = (line = "") => console.log(line);
const S0 = cardSet("S0");
const RUNS = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
const FINISH: Record<string, string> = {
  standard: "",
  foil: "FOIL",
  fullArt: "FULL ART",
  altArt: "ALT ART",
  gold: "GOLD",
  prototype: "PROTOTYPE",
  glitch: "GLITCH",
  secret: "SECRET",
  zeroDay: "ZERO-DAY",
};

function showPack(p: PackOpening, title: string): void {
  const flags = [p.jackpot && "JACKPOT PACK", p.pity.fullArt && "pity: Full Art or better", p.pity.mythic && "pity: Mythic", p.fullReveal && "full reveal"].filter(Boolean);
  say(`${title}  seed ${p.seed}  odds ${p.oddsVersion}  +${p.packPoints} pack points${flags.length ? `  [${flags.join(", ")}]` : ""}`);
  for (const c of p.cards) {
    const secret = c.secret ? ` ${c.secret.code} art ${c.secret.art}${c.secret.animated ? " (animated)" : ""}` : "";
    say(`    ${c.slot.padEnd(9)} ${c.collectorNumber}  ${c.name.padEnd(30)} ${c.rarity.padEnd(9)} ${FINISH[c.finish]!.padEnd(9)} ${c.isNew ? "NEW" : "   "}  x${c.ownedAfter} owned${secret}`);
  }
}

/** The first seed from `start` whose pack, for this pity state, passes `want`. */
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

function showBinder(b: Binder): void {
  for (const s of [b.base, b.secrets, b.glitch, b.gold]) say(`    ${s.title.padEnd(14)} ${String(s.held).padStart(3)}/${s.total}`);
  say(`    Prototypes     ${b.prototypes.filter((r) => r.serialsHeld.length > 0).length}/${b.prototypes.length} runs held`);
}

say("# The chase cards go live (session 39)");
say();

// ---- 1. a v9 file upgrades to v10 ----
say("## 1. A Season 0 file made at schema v9 upgrades to v10");
say();
{
  const v9 = EconomyStore.open(dbPath, { now: () => clock, migrateTo: 9 });
  const o = v9.createOwner({ name: "early-owner" }).ownerId;
  const grant = v9.grantStarterCollection(o, "Aegis");
  const deck = v9.saveDeck(o, "Aegis starter", grant.copies.map((c) => c.copyId));
  v9.openPack(o, undefined, { seed: 4242 });
  const before = v9.collection(o).map((c) => `${c.copyId}|${c.cardId}|${c.finish}|${c.origin}|${c.accountBound}`);
  say(`    v${v9.schemaVersion}: ${before.length} copies held, deck "${deck.name}" complete: ${v9.deckStatus(deck.deckId).complete}`);
  v9.close();
  const v10 = EconomyStore.open(dbPath, { now: () => clock });
  const after = v10.collection(o).map((c) => `${c.copyId}|${c.cardId}|${c.finish}|${c.origin}|${c.accountBound}`);
  say(`    v${v10.schemaVersion}: ${after.length} copies held, every copy unchanged: ${JSON.stringify(after) === JSON.stringify(before)}, secret codes: ${v10.collection(o).filter((c) => c.secretCode !== null).length}, deck complete: ${v10.deckStatus(deck.deckId).complete}`);
  v10.close();
}
say();

const store = EconomyStore.open(dbPath, { now: () => clock });
const owner = store.createOwner({ name: "demo-owner" }).ownerId;
store.grantStarterCollection(owner, "Cortex");
for (let i = 0; i < 200; i++) store.grantPack(owner, "S0", "weeklyChallenge");

// ---- 2. the chase pulls, as the pack-result screen gets them ----
say(`## 2. Packs open under ${LIVE_PACK_ODDS.version}: a secret illustration, a Glitch card and a Zero-Day card`);
say();
const startPity = store.pityStatus(owner);
const secretSeed = seedFor(startPity, (r) => r.pulls[4]!.finish === "secret" && !r.jackpot, 0);
tick(1);
showPack(store.openPack(owner, undefined, { seed: secretSeed }), "secret pack");
const glitchSeed = seedFor(store.pityStatus(owner), (r) => r.pulls[4]!.finish === "glitch" && !r.jackpot, 0);
tick(1);
showPack(store.openPack(owner, undefined, { seed: glitchSeed }), "glitch pack");
const zdSeed = seedFor(store.pityStatus(owner), (r) => r.pulls[4]!.finish === "zeroDay" && !r.jackpot, 0);
tick(1);
const zdPack = store.openPack(owner, undefined, { seed: zdSeed });
showPack(zdPack, "zero-day pack");
say();
say("(Seeds were searched for here so each kind shows; the store draws them server-side otherwise.)");
say();

// ---- 3. a bulk open ----
say("## 3. A 10-pack open (seeds 1-10)");
say();
tick(1);
const bulk = store.openPacks(owner, 10, { seeds: Array.from({ length: 10 }, (_, i) => i + 1) });
say(`    ${bulk.summary.cards} cards, ${bulk.summary.newCards} new, +${bulk.summary.packPoints} pack points`);
say(`    by finish: ${Object.entries(bulk.summary.byFinish).map(([f, n]) => `${f} ${n}`).join(", ")}`);
say(`    packs keeping their full reveal: ${bulk.summary.fullReveals.length}`);
const pity = store.pityStatus(owner);
say(`    pity now: ${pity.packsSinceFullArt} packs without a hit, ${pity.packsSinceMythic} without a Mythic`);
say();

// ---- 4. 2,000 packs through the store ----
{
  const OWNERS = 20;
  const PER = 100;
  say(`## 4. ${(OWNERS * PER).toLocaleString("en-US")} packs opened through the store (${OWNERS} owners x ${PER}, seeds 50,000 up), counted against ${LIVE_PACK_ODDS.version}`);
  say();
  const finishes: Record<string, number> = {};
  let hits = 0;
  let pityFired = 0;
  let seed = 50_000;
  for (let o = 0; o < OWNERS; o++) {
    const id = store.createOwner({ name: `sim-${o}` }).ownerId;
    for (let i = 0; i < PER; i++) store.grantPack(id, "S0", "weeklyChallenge");
    for (let i = 0; i < PER / 10; i++) {
      const b = store.openPacks(id, 10, { seeds: Array.from({ length: 10 }, () => seed++) });
      for (const p of b.packs) {
        if (p.cards.some((c) => FULL_ART_OR_BETTER.includes(c.finish))) hits++;
        if (p.pity.fullArt) pityFired++;
        const shine = p.cards[4]!.finish;
        finishes[shine] = (finishes[shine] ?? 0) + 1;
      }
    }
  }
  const n = OWNERS * PER;
  const f = LIVE_PACK_ODDS.shineFinish as Record<string, number>;
  const standard = 100 - Object.values(f).reduce((a, b) => a + b, 0);
  say("    shine slot        table      store (pity on)");
  for (const k of ["standard", "foil", "fullArt", "glitch", "altArt", "secret", "gold", "zeroDay"]) {
    const set = k === "standard" ? standard : f[k]!;
    say(`    ${k.padEnd(16)}${`${set.toFixed(1)}%`.padStart(7)}    ${`${((100 * (finishes[k] ?? 0)) / n).toFixed(2)}%`.padStart(8)}  (${finishes[k] ?? 0})`);
  }
  say(`    packs with a hit: ${((100 * hits) / n).toFixed(1)}% (target about 20% with pity; pack-sim-002 measured 20.7% over 1,000,000 packs); pity fired in ${pityFired}`);
  say("    (2,000 packs is a small sample for the rare rows; pack-sim-002.txt measures the table over a million packs.)");
}
say();

// ---- 5. crafting a secret card ----
say(`## 5. Crafting secret cards (${SECRET_CRAFT_PACK_POINTS.illustration} pack points an illustration, ${SECRET_CRAFT_PACK_POINTS.zeroDay.toLocaleString("en-US")} a Zero-Day card)`);
say();
{
  // The demo owner opens its remaining packs to earn points.
  while (store.unopenedPacks(owner).length >= 10) {
    tick(1);
    store.openPacks(owner, 10, { seeds: Array.from({ length: 10 }, (_, i) => 100_000 + store.unopenedPacks(owner).length * 10 + i) });
  }
  const points = store.balance(owner, "packPoints");
  say(`    pack points after ${store.ledger(owner).filter((e) => e.reason === "packOpened").length} opened packs (${PACK_POINTS_PER_PACK} each): ${points}`);
  const held = new Set(store.collection(owner).map((c) => c.secretCode));
  const target = S0.secrets.find((s) => s.kind === "illustration" && !held.has(s.code))!;
  const copy = store.craftSecret(owner, target.code);
  say(`    crafted ${target.name} (${target.code}, ${target.collectorNumber}): finish ${copy.finish}, origin ${copy.origin}, account-bound ${copy.accountBound}; pack points now ${store.balance(owner, "packPoints")}`);
  refusal(`crafting ${target.code} again`, () => store.craftSecret(owner, target.code));
  const zd = S0.secrets.find((s) => s.kind === "zeroDay")!;
  refusal(`crafting ${zd.code}`, () => store.craftSecret(owner, zd.code));
  const poor = store.createOwner({ name: "no-points" }).ownerId;
  refusal("crafting with no pack points", () => store.craftSecret(poor, target.code));
}
say();

// ---- 6. the binder ----
say("## 6. The demo owner's binder (set checklist)");
say();
const binder = store.binder(owner, "S0");
showBinder(binder);
say("    secret cards held:");
for (const e of binder.secrets.entries.filter((x) => x.owned > 0)) say(`      ${e.number}  ${e.name.padEnd(30)} ${e.kind.padEnd(12)} x${e.owned}`);
say("    Glitch held:");
for (const e of binder.glitch.entries.filter((x) => x.owned > 0)) say(`      ${e.number}  ${e.name.padEnd(30)} x${e.owned}`);
say();

// ---- 7. refusals ----
say("## 7. What the store and the schema refuse");
say();
{
  const zdCopy = zdPack.cards[4]!;
  const deckCopies = store.collection(owner).filter((c) => c.origin === "starter").map((c) => c.copyId);
  // Session 39 refused this while the Zero-Day cards weren't designed yet.
  // They went live in session 42 (owner 2026-10-18): a deck may hold one
  // now, so the line checks that instead (corrected in session 70's
  // hardening pass, when this demo was found printing a stale "bug").
  try {
    store.saveDeck(owner, "zd", [...deckCopies.slice(0, 29), zdCopy.copyId]);
    say(`    a deck holding the Zero-Day card (live since session 42): saved, as it should be`);
  } catch (err) {
    say(`    a deck holding the Zero-Day card (live since session 42): REFUSED (this is a bug: ${err instanceof Error ? err.message : String(err)})`);
  }
  refusal("salvaging the Zero-Day copy (raw SQL)", () => store.unsafeExec(`UPDATE card_copies SET disposed_at = 'x', disposed_reason = 'salvaged' WHERE copy_id = '${zdCopy.copyId}'`));
  refusal("changing a copy's secret code (raw SQL)", () => store.unsafeExec(`UPDATE card_copies SET secret_code = 'S0-SR01' WHERE copy_id = '${zdCopy.copyId}'`));
  refusal("a secret copy with no secret code (raw SQL)", () =>
    store.unsafeExec(`INSERT INTO card_copies (copy_id, owner_id, card_id, finish, series_kind, origin, account_bound, acquired_at) VALUES ('x', '${owner}', 'CX-001', 'secret', 'set', 'pack', 0, 'x')`),
  );
  refusal("a Glitch copy of a card with no Glitch version", () => store.grantCopy({ ownerId: owner, cardId: "CX-015", origin: "pack", finish: "glitch" }));
  const salvageable = store.cardHoldings(owner, zdCopy.cardId);
  say(`    the card viewer for ${zdCopy.cardId}: owned ${salvageable.owned}, salvageable ${salvageable.salvageable}, why not: ${salvageable.notSalvageable.map((r) => r.reason).join("; ")}`);
}
store.close();
rmSync(tempDir, { recursive: true, force: true });
