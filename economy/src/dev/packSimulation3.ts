// The booster-card pack simulation (session 97; owner 2026-11-14, option B,
// call 7 "the odds become a new version (S0-odds-3) ... with the pack
// simulation re-run", and the same day "starter cards are Standard only").
//
// Rolls S0-odds-3 (live from session 97) beside S0-odds-2 on the same seeds,
// through packs.ts rollPack, the function openPack uses, and checks:
//  - the set: the 96 starter-era cards keep 001 to 096, the 28 booster
//    cards are 097 to 124 with Gold numbers 125 to 152, the secret cards
//    above them; the chase lists and Prototype runs are on booster cards;
//  - no starter card is ever pulled, in any slot or finish, over every pack;
//  - the pack's rates are S0-odds-2's (same table numbers): hits, Foil,
//    Mythic in the Rare slot, Zero-Day, Jackpot, pity;
//  - every booster card comes up, each faction about a quarter of pulls;
//  - how many packs complete the booster cards (one of each, and a playable
//    set: 3 / 3 / 2 / 1), against S0-odds-2's 96-card base set;
//  - the old tables still roll the set as it stood (their seed hashes).
// Seeded, so the file reproduces.
//
// Usage (from economy/): npx tsx src/dev/packSimulation3.ts > ../progress/pack-sim-004-booster.txt

import { createHash } from "node:crypto";
import { COPY_LIMITS, getCard, isBoosterCard, type Rarity } from "@ai-tcg/engine";
import { PACK_ODDS_TABLES, PACK_ODDS_V2, PACK_ODDS_V3, type PackOdds } from "../config.js";
import { baseHitPercent, cardSet, FULL_ART_OR_BETTER, nextPity, rollPack, type PackRoll, type PityState } from "../packs.js";

const out: string[] = [];
const say = (s = "") => out.push(s);
let passes = 0;
let fails = 0;
const check = (ok: boolean, what: string) => {
  if (ok) passes++;
  else fails++;
  say(`  [${ok ? "PASS" : "FAIL"}] ${what}`);
};
const pct = (x: number, d = 2) => `${(100 * x).toFixed(d)}%`;
const set = cardSet("S0");
const legacy = set.legacy!;
const NO_PITY: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
const fullRuns = () => new Map(set.prototypes.map((r) => [r.code, r.runSize]));
const RARITIES: readonly Rarity[] = ["Common", "Uncommon", "Rare", "Mythic"];
const q = (xs: number[], f: number) => [...xs].sort((a, b) => a - b)[Math.floor(f * (xs.length - 1))]!;

say("AI-TCG booster-card pack simulation (session 97): S0-odds-3 (live) beside S0-odds-2, on the same seeds");
say("Command (from economy/): npx tsx src/dev/packSimulation3.ts. Every pack is rollPack(seed, ...), the function openPack uses.");
say();

// ---- 1. The set ----
say("1. The set");
say("------------------------------------------------------------------------");
const starter = set.cards.filter((c) => !isBoosterCard(c.cardId));
const booster = set.cards.filter((c) => isBoosterCard(c.cardId));
say(`  ${set.cards.length} base cards: ${starter.length} starter-era (${starter[0]!.collectorNumber} to ${starter.at(-1)!.collectorNumber}), ${booster.length} booster (${booster[0]!.collectorNumber} to ${booster.at(-1)!.collectorNumber})`);
say("  The booster cards (number, Gold number, card, rarity, faction):");
for (const c of booster) say(`    ${c.collectorNumber}  ${c.goldNumber}  ${c.cardId}  ${c.name.padEnd(20)} ${c.rarity.padEnd(9)} ${getCard(c.cardId)!.faction}`);
check(starter.length === 96 && booster.length === 28, "96 starter-era cards and 28 booster cards");
check(
  starter.every((c, i) => c.cardId === legacy.cards[i]!.cardId && c.collectorNumber.split("/")[0] === legacy.cards[i]!.collectorNumber.split("/")[0]),
  "the 96 keep their numbers 001 to 096 in their old order (only the total moved, /096 to /124)",
);
check(starter.every((c) => c.goldNumber === null) && booster.every((c, i) => c.goldNumber === `${125 + i}/124`), "only booster cards have a Gold number: 125/124 to 152/124");
const byRarity = Object.fromEntries(RARITIES.map((r) => [r, booster.filter((c) => c.rarity === r).length]));
check(JSON.stringify(byRarity) === JSON.stringify({ Common: 8, Uncommon: 8, Rare: 8, Mythic: 4 }), `booster rarities 8 C / 8 U / 8 R / 4 M (call 2 (a)): ${JSON.stringify(byRarity)}`);
say();
say("  Secret cards (proposed this session, for the owner's check-in):");
for (const s of set.secrets) say(`    ${s.collectorNumber}  ${s.code.padEnd(8)} ${s.kind.padEnd(12)} ${s.name}${s.kind === "illustration" ? ` (${s.rarity})` : ""}`);
say(`  Glitch versions: ${set.glitch.map((id) => getCard(id)!.name).join(", ")}`);
say("  Prototype runs:");
for (const r of set.prototypes) say(`    ${r.code}  /${String(r.runSize).padEnd(4)} ${getCard(r.cardId)!.name} (${getCard(r.cardId)!.rarity})`);
const illus = set.secrets.filter((s) => s.kind === "illustration");
check(illus.every((s) => isBoosterCard(s.cardId)) && set.glitch.every(isBoosterCard) && set.prototypes.every((r) => isBoosterCard(r.cardId)), "every illustration, Glitch version and Prototype run is on a booster card");
check(set.secrets.at(-1)!.collectorNumber === "171/124" && set.secrets[0]!.collectorNumber === "153/124", "the secret cards run 153/124 to 171/124, the Zero-Day cards at the top");
check(set.prototypes.reduce((t, r) => t + r.runSize, 0) === 1516, "the Prototype pyramid still holds 1,516 copies in 15 runs");
say();

// ---- 2. The rates ----
const N = 200_000;
interface Tally {
  packs: number;
  hits: number;
  foil: number;
  mythicRare: number;
  zeroDay: number;
  jackpots: number;
  starterPulls: number;
  pityHits: number;
  byFinish: Map<string, number>;
  byCard: Map<string, number>;
  byFaction: Map<string, number>;
  plainPulls: number;
}
function measure(odds: PackOdds): Tally {
  const t: Tally = { packs: 0, hits: 0, foil: 0, mythicRare: 0, zeroDay: 0, jackpots: 0, starterPulls: 0, pityHits: 0, byFinish: new Map(), byCard: new Map(), byFaction: new Map(), plainPulls: 0 };
  let pity = NO_PITY;
  for (let seed = 0; seed < N; seed++) {
    const r: PackRoll = rollPack(4_000_000 + seed, set, pity, fullRuns(), odds);
    t.packs++;
    if (r.pulls.some((p) => FULL_ART_OR_BETTER.includes(p.finish))) t.hits++;
    if (r.pity.fullArt) t.pityHits++;
    if (r.pulls[4]!.finish === "foil") t.foil++;
    if (r.pulls[3]!.rarity === "Mythic") t.mythicRare++;
    if (r.pulls.some((p) => p.finish === "zeroDay")) t.zeroDay++;
    if (r.jackpot) t.jackpots++;
    for (const p of r.pulls) {
      t.byFinish.set(p.finish, (t.byFinish.get(p.finish) ?? 0) + 1);
      if (p.finish === "zeroDay") continue;
      if (!isBoosterCard(p.cardId)) t.starterPulls++;
      t.byCard.set(p.cardId, (t.byCard.get(p.cardId) ?? 0) + 1);
      const f = getCard(p.cardId)!.faction;
      t.byFaction.set(f, (t.byFaction.get(f) ?? 0) + 1);
      t.plainPulls++;
    }
    pity = nextPity(pity, r.pulls);
  }
  return t;
}
say(`2. ${N.toLocaleString("en-US")} packs per table, pity carried from pack to pack (one owner opening them all)`);
say("------------------------------------------------------------------------");
const v2 = measure(PACK_ODDS_V2);
const v3 = measure(PACK_ODDS_V3);
const row = (label: string, a: string, b: string) => say(`  ${label.padEnd(36)} ${a.padStart(10)}  ${b.padStart(10)}`);
row("", "S0-odds-2", "S0-odds-3");
row("packs with Full Art or better", pct(v2.hits / N), pct(v3.hits / N));
row("  of which forced by pity", pct(v2.pityHits / N), pct(v3.pityHits / N));
row("shine slot Foil", pct(v2.foil / N), pct(v3.foil / N));
row("Rare slot a Mythic", pct(v2.mythicRare / N), pct(v3.mythicRare / N));
row("packs with a Zero-Day card", `1 in ${Math.round(N / v2.zeroDay)}`, `1 in ${Math.round(N / v3.zeroDay)}`);
row("Jackpot packs", String(v2.jackpots), String(v3.jackpots));
for (const f of ["standard", "foil", "fullArt", "glitch", "altArt", "secret", "gold", "zeroDay", "prototype"]) row(`  pulls in ${f}`, String(v2.byFinish.get(f) ?? 0), String(v3.byFinish.get(f) ?? 0));
row("pulls of a starter card", String(v2.starterPulls), String(v3.starterPulls));
check(v3.starterPulls === 0, `S0-odds-3: no starter card in ${N.toLocaleString("en-US")} packs, in any slot or finish`);
check(Math.abs(v3.hits - v2.hits) / N < 0.004, `the hit rate is S0-odds-2's (${pct(v3.hits / N)} vs ${pct(v2.hits / N)}; table base ${baseHitPercent(PACK_ODDS_V3).toFixed(1)}% before pity)`);
check(Math.abs(v3.mythicRare - v2.mythicRare) / N < 0.004 && Math.abs(v3.foil - v2.foil) / N < 0.004, "Foil and the Mythic Rare slot are S0-odds-2's");
check(Math.abs(v3.jackpots - N / 2000) < 4 * Math.sqrt(N / 2000), `Jackpot about 1 in 2,000 (${v3.jackpots}, expected ${N / 2000})`);
say();
say("  S0-odds-3 pulls by card (every slot and finish but Zero-Day), per rarity: fewest and most per card");
for (const r of RARITIES) {
  const counts = booster.filter((c) => c.rarity === r).map((c) => v3.byCard.get(c.cardId) ?? 0);
  say(`    ${r.padEnd(9)} ${String(counts.length).padStart(2)} cards  ${Math.min(...counts)} to ${Math.max(...counts)} pulls each`);
}
check(booster.every((c) => (v3.byCard.get(c.cardId) ?? 0) > 0), "every booster card was pulled");
say("  S0-odds-3 pulls by faction:");
for (const f of ["Cortex", "Swarm", "Aegis", "Null"]) say(`    ${f.padEnd(7)} ${pct((v3.byFaction.get(f) ?? 0) / v3.plainPulls, 1)}`);
check(["Cortex", "Swarm", "Aegis", "Null"].every((f) => Math.abs((v3.byFaction.get(f) ?? 0) / v3.plainPulls - 0.25) < 0.01), "each faction is 25% of pulls, within a point");
say();

// ---- 3. Completion ----
const OWNERS = 400;
function completion(odds: PackOdds, cards: readonly { cardId: string; rarity: Rarity }[], need: (r: Rarity) => number, seedBase: number): number[] {
  const res: number[] = [];
  for (let o = 0; o < OWNERS; o++) {
    const held = new Map<string, number>();
    let missing = cards.length;
    let pity = NO_PITY;
    let n = 0;
    while (missing > 0 && n < 5000) {
      const r = rollPack(seedBase + o * 10_000 + n, set, pity, fullRuns(), odds);
      n++;
      for (const p of r.pulls) {
        const c = cards.find((x) => x.cardId === p.cardId);
        if (!c) continue;
        const h = (held.get(p.cardId) ?? 0) + 1;
        held.set(p.cardId, h);
        if (h === need(c.rarity)) missing--;
      }
      pity = nextPity(pity, r.pulls);
    }
    res.push(n);
  }
  return res;
}
say(`3. Packs to complete, ${OWNERS} owners each, from packs alone (no crafting; any finish counts)`);
say("------------------------------------------------------------------------");
const line = (label: string, xs: number[]) => say(`  ${label.padEnd(58)} median ${String(q(xs, 0.5)).padStart(4)}  p10 ${String(q(xs, 0.1)).padStart(4)}  p90 ${String(q(xs, 0.9)).padStart(4)}`);
const one = () => 1;
const playset = (r: Rarity) => COPY_LIMITS[r];
const v3One = completion(PACK_ODDS_V3, booster, one, 6_000_000);
const v3Play = completion(PACK_ODDS_V3, booster, playset, 7_000_000);
const v2One = completion(PACK_ODDS_V2, legacy.cards, one, 6_000_000);
line("S0-odds-3: one of each of the 28 booster cards", v3One);
line(`S0-odds-3: a playable set of them (${RARITIES.map((r) => COPY_LIMITS[r]).join(" / ")} by rarity)`, v3Play);
line("S0-odds-2 (before): one of each of the 96 base cards", v2One);
say("  At ECONOMY.md's ~2.4 packs a day, the median owner holds one of every booster card");
say(`  after about ${(q(v3One, 0.5) / 2.4).toFixed(0)} days and a playable set after about ${(q(v3Play, 0.5) / 2.4).toFixed(0)} days (Season 0 runs 21 days).`);
check(q(v3One, 0.5) < q(v2One, 0.5), "the 28 booster cards complete sooner than the old 96-card base set did");
say();

// ---- 4. The old tables ----
say("4. The old tables still roll the set as it stood (every logged opening reproduces)");
say("------------------------------------------------------------------------");
const PINNED: Record<string, string> = {
  "S0-odds-1": "1efcc4db932d08a61afdc422a6f94a5141756fb2ed1b5ce5ee2bbbed983ef66c",
  "S0-odds-2": "3fdd1b3fbb4c1959635fa21490d50baddda5cc89c1efb584ed05a7eba1fb4ada",
};
const canon = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canon).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
          .sort()
          .map((k) => `${k}:${canon((v as Record<string, unknown>)[k])}`)
          .join(",")}}`
      : JSON.stringify(v);
const NO_RUNS = new Map(set.prototypes.map((r) => [r.code, 0]));
const PITIES: PityState[] = [NO_PITY, { packsSinceFullArt: 10, packsSinceMythic: 0 }, { packsSinceFullArt: 0, packsSinceMythic: 40 }, { packsSinceFullArt: 10, packsSinceMythic: 40 }];
for (const [version, odds] of PACK_ODDS_TABLES) {
  const h = createHash("sha256");
  for (let seed = 1; seed <= 20_000; seed++) h.update(canon(rollPack(seed, set, PITIES[seed % 4]!, seed % 7 === 0 ? NO_RUNS : fullRuns(), odds)));
  const d = h.digest("hex");
  say(`  ${version}: ${d}`);
  if (PINNED[version]) check(d === PINNED[version], `${version} rolls exactly as it did before the booster cards (the hash chase.test.ts pinned in session 39)`);
}
say();
say(`${passes} PASS, ${fails} FAIL.`);
console.log(out.join("\n"));
process.exitCode = fails === 0 ? 0 : 1;
