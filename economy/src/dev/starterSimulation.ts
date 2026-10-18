// Starter guarantee simulation (session 46; owner 2026-10-19, render session
// 28 call 9: "every new owner sees at least one hit (Full Art or better) in
// their 3 starter packs ... report the resulting starter-pack rates and any
// effect on the wider pack economy"). Rolls new owners' 3 starter packs
// through packs.ts rollPack under the live table three ways:
//  - none: no guarantee (the store before this session);
//  - A (built): the last starter pack's shine slot is a hit when packs 1
//    and 2 had none (the store's `starterHitDue`, the owner's example);
//  - B (not built, for comparison): if none of the 3 has a hit, one of the
//    3, picked at random, gets its shine slot upgraded instead.
// Then plays each owner on for 40 more packs to see what the guarantee does
// to pity and to the hits after the starters. Seeded, so the file
// reproduces.
//
// Usage (from economy/): npx tsx src/dev/starterSimulation.ts > ../progress/pack-sim-003-starter.txt

import { LIVE_PACK_ODDS, STARTER_PACKS } from "../config.js";
import { baseHitPercent, cardSet, FULL_ART_OR_BETTER, nextPity, rollPack, type PackRoll, type PityState } from "../packs.js";
import type { Finish } from "../schema.js";
import { Rng } from "@ai-tcg/engine";

const out: string[] = [];
const say = (s = "") => out.push(s);
const pct = (x: number, d = 2) => `${(100 * x).toFixed(d)}%`;
const set = cardSet("S0");
const runs = new Map(set.prototypes.map((r) => [r.code, r.runSize]));
const NO_PITY: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
const odds = LIVE_PACK_ODDS;
const isHit = (r: PackRoll) => r.pulls.some((p) => FULL_ART_OR_BETTER.includes(p.finish));
const OWNERS = 200_000;
const LATER_OWNERS = 40_000;
const LATER_PACKS = 40;

type Method = "none" | "A" | "B";
const METHODS: Method[] = ["none", "A", "B"];

/** One new owner's 3 starter packs under `method`, from seeds `base..base+2`
 * (B also draws which pack to upgrade from `base`). Pity runs as the store
 * runs it, from the owner's own history. */
function starters(method: Method, base: number): { packs: PackRoll[]; pity: PityState } {
  let pity = NO_PITY;
  const packs: PackRoll[] = [];
  if (method === "B") {
    const plain = [0, 1, 2].map((k) => rollPack(base + k, set, NO_PITY, runs, odds));
    const upgrade = plain.some(isHit) ? -1 : new Rng(base ^ 0x5eed).int(STARTER_PACKS);
    for (let k = 0; k < STARTER_PACKS; k++) {
      // The upgraded pack needs a draw of its own: rolled again from its
      // seed, its finish would come only from the part of the hit table its
      // plain miss already ruled out (Full Art, Glitch, Alt Art; never Gold
      // or a secret card).
      const r = k === upgrade ? rollPack(base + k + 7_000_000, set, pity, runs, odds, { starterHit: true }) : plain[k]!;
      packs.push(r);
      pity = nextPity(pity, r.pulls);
    }
    return { packs, pity };
  }
  for (let k = 0; k < STARTER_PACKS; k++) {
    const due = method === "A" && k === STARTER_PACKS - 1 && !packs.some(isHit);
    const r = rollPack(base + k, set, pity, runs, odds, { starterHit: due });
    packs.push(r);
    pity = nextPity(pity, r.pulls);
  }
  return { packs, pity };
}

say("AI-TCG starter guarantee simulation (session 46): every new owner sees a hit across the 3 starter packs");
say(`Command (from economy/): npx tsx src/dev/starterSimulation.ts. Live table ${odds.version}; ${STARTER_PACKS} starter packs per owner.`);
say(`"Hit" = Full Art or better: ${FULL_ART_OR_BETTER.join(", ")}. Base hit rate of a shine slot: ${baseHitPercent(odds).toFixed(1)}%.`);
say(`${OWNERS.toLocaleString("en-US")} simulated new owners per method, the same seeds for every method (owner i opens seeds 3i+1..3i+3).`);
say("Methods: none = the store before session 46; A = BUILT: the last starter pack's shine slot is a hit when the first two had none;");
say("B = for comparison only, not built: if none of the 3 has a hit, one of the 3 picked at random gets its shine slot upgraded.");
say();

// ---- 1. starter rates ----
type Tally = {
  hits: number[]; // owners by number of packs with a hit (0..3)
  hitCards: number; // hit copies across all starter packs
  byPack: number[]; // packs with a hit, by position
  forced: number; // packs the guarantee upgraded
  forcedFinish: Map<Finish, number>;
  finishes: Map<Finish, number>; // every hit copy in starters, by finish
  mythicOwners: number;
  pityAfter: number[]; // packsSinceFullArt after the starters, 0..3
};
const tallies = new Map<Method, Tally>();
for (const m of METHODS) {
  const t: Tally = { hits: [0, 0, 0, 0], hitCards: 0, byPack: [0, 0, 0], forced: 0, forcedFinish: new Map(), finishes: new Map(), mythicOwners: 0, pityAfter: [0, 0, 0, 0] };
  for (let i = 0; i < OWNERS; i++) {
    const { packs, pity } = starters(m, 3 * i + 1);
    t.hits[packs.filter(isHit).length]!++;
    packs.forEach((r, k) => {
      if (isHit(r)) t.byPack[k]!++;
      if (r.starterHit) {
        t.forced++;
        t.forcedFinish.set(r.pulls[4]!.finish, (t.forcedFinish.get(r.pulls[4]!.finish) ?? 0) + 1);
      }
      for (const p of r.pulls) {
        if (!FULL_ART_OR_BETTER.includes(p.finish)) continue;
        t.hitCards++;
        t.finishes.set(p.finish, (t.finishes.get(p.finish) ?? 0) + 1);
      }
    });
    if (packs.some((r) => r.pulls.some((p) => p.rarity === "Mythic"))) t.mythicOwners++;
    t.pityAfter[Math.min(pity.packsSinceFullArt, 3)]!++;
  }
  tallies.set(m, t);
}
const col = (s: string, w = 14) => s.padEnd(w);
const a0 = () => tallies.get("A")!.forced / OWNERS;
say("1. The 3 starter packs");
say();
say(`   ${col("", 50)}${METHODS.map((m) => col(m === "A" ? "A (built)" : m)).join("")}`);
const row = (label: string, f: (t: Tally) => string) => say(`   ${col(label, 50)}${METHODS.map((m) => col(f(tallies.get(m)!))).join("")}`);
row("owners with at least one hit", (t) => pct(1 - t.hits[0]! / OWNERS));
row("owners with exactly 1 pack with a hit", (t) => pct(t.hits[1]! / OWNERS));
row("owners with 2 packs with a hit", (t) => pct(t.hits[2]! / OWNERS));
row("owners with 3 packs with a hit", (t) => pct(t.hits[3]! / OWNERS, 3));
row("hit copies per owner (mean)", (t) => (t.hitCards / OWNERS).toFixed(3));
row("starter pack 1 has a hit", (t) => pct(t.byPack[0]! / OWNERS));
row("starter pack 2 has a hit", (t) => pct(t.byPack[1]! / OWNERS));
row("starter pack 3 has a hit", (t) => pct(t.byPack[2]! / OWNERS));
row("owners the guarantee applied to", (t) => pct(t.forced / OWNERS));
row("owners with a Mythic card (any slot)", (t) => pct(t.mythicOwners / OWNERS));
say();
say(`   A applies whenever packs 1 and 2 had no hit (${pct(a0())}), so it also upgrades pack 3s that would have hit anyway; the owners`);
say(`   it rescues, who would otherwise have seen no hit at all, are the ${pct(tallies.get("none")!.hits[0]! / OWNERS)} that "none" leaves with 0.`);
say();
say("   Hit copies in the starter packs, per 100 new owners, by finish:");
const allFinishes: Finish[] = FULL_ART_OR_BETTER.filter((f) => METHODS.some((m) => tallies.get(m)!.finishes.has(f)));
say(`   ${col("", 50)}${METHODS.map((m) => col(m === "A" ? "A (built)" : m)).join("")}`);
for (const f of allFinishes) row(`   ${f}`, (t) => (100 * (t.finishes.get(f) ?? 0) / OWNERS).toFixed(2));
say();
const a = tallies.get("A")!;
say(`   The upgraded shine slot under A draws from the hit part of the table, in its own proportions (as hit pity does), ${a.forced.toLocaleString("en-US")} upgrades:`);
const hitTable = Object.entries(odds.shineFinish).filter(([f]) => f !== "foil") as [Finish, number][];
const hitTotal = hitTable.reduce((s, [, w]) => s + w, 0);
for (const [f, w] of hitTable) say(`     ${col(f, 10)} set ${pct(w / hitTotal, 1).padStart(6)}   measured ${pct((a.forcedFinish.get(f) ?? 0) / a.forced, 2).padStart(7)}`);
say();

// ---- 2. the wider pack economy ----
say(`2. After the starters: ${LATER_OWNERS.toLocaleString("en-US")} owners per method each open ${LATER_PACKS} more packs (the same later seeds for every method)`);
say();
type Later = { pityFired: number; hitPacks: number; firstHit: number[]; dryAfterStarter: number[] };
const later = new Map<Method, Later>();
for (const m of METHODS) {
  const l: Later = { pityFired: 0, hitPacks: 0, firstHit: [], dryAfterStarter: [] };
  for (let i = 0; i < LATER_OWNERS; i++) {
    let { pity } = starters(m, 3 * i + 1);
    l.dryAfterStarter.push(pity.packsSinceFullArt);
    let first = -1;
    for (let n = 0; n < LATER_PACKS; n++) {
      const r = rollPack(10_000_000 + i * LATER_PACKS + n, set, pity, runs, odds);
      if (r.pity.fullArt) l.pityFired++;
      if (isHit(r)) {
        l.hitPacks++;
        if (first < 0) first = n + 1;
      }
      pity = nextPity(pity, r.pulls);
    }
    l.firstHit.push(first);
  }
  later.set(m, l);
}
const lrow = (label: string, f: (l: Later) => string) => say(`   ${col(label, 50)}${METHODS.map((m) => col(f(later.get(m)!))).join("")}`);
say(`   ${col("", 50)}${METHODS.map((m) => col(m === "A" ? "A (built)" : m)).join("")}`);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
lrow("hit pity count after the starters (mean)", (l) => mean(l.dryAfterStarter).toFixed(3));
lrow("packs 4-43 with a hit", (l) => pct(l.hitPacks / (LATER_OWNERS * LATER_PACKS)));
lrow("packs 4-43 where hit pity fired", (l) => pct(l.pityFired / (LATER_OWNERS * LATER_PACKS), 3));
lrow("first post-starter hit, mean pack number", (l) => mean(l.firstHit).toFixed(2));
say();
say("   Hit pity counts from the owner's history, so a starter hit near the end of the starters restarts the 10-pack count");
say("   later. The starters are 3 packs of 43 here, so the later rows move by hundredths at most: the guarantee is a");
say("   one-off at sign-up, not a change to the odds of any pack an owner buys or earns.");
say();

// ---- 3. supply ----
const none = tallies.get("none")!;
const extra = (a.hitCards - none.hitCards) / OWNERS;
say("3. Supply: what the guarantee adds to the whole economy");
say();
say(`   A adds ${extra.toFixed(3)} hit copies per new owner (${(none.hitCards / OWNERS).toFixed(3)} -> ${(a.hitCards / OWNERS).toFixed(3)}), the hits of about ${(extra / (baseHitPercent(odds) / 100)).toFixed(1)} ordinary packs' shine slots.`);
const zdNone = (none.finishes.get("zeroDay") ?? 0) / OWNERS;
const zdA = (a.finishes.get("zeroDay") ?? 0) / OWNERS;
const secNone = (none.finishes.get("secret") ?? 0) / OWNERS;
const secA = (a.finishes.get("secret") ?? 0) / OWNERS;
say(`   Zero-Day cards per 10,000 new owners: ${(zdNone * 10_000).toFixed(1)} -> ${(zdA * 10_000).toFixed(1)}. Secret illustrations per 10,000 new owners: ${(secNone * 10_000).toFixed(1)} -> ${(secA * 10_000).toFixed(1)}.`);
say("   Prototypes: unchanged. The guarantee only touches the shine slot, never the bonus 6th card, so no run is used up faster.");
say("   Mythics: the Rare slot and the Mythic pity timer are untouched; the owners holding a Mythic card rise only because an");
say("   upgraded Full Art, Alt Art or Gold can land on a Mythic (15-30% of those) and a Zero-Day card is a Mythic.");
say();
say("   An owner opening a pack sees the same pack and the same tear in every case: the guarantee is worked out when the pack");
say("   is opened, from the owner's own starter packs, and only the opening's record (`starterHit`) says it applied.");
say(`   Under A an owner who knows the rule can tell, after packs 1 and 2 had no hit, that pack 3 will (pack 3: ${pct(a.byPack[2]! / OWNERS, 1)} hit).`);
const b = tallies.get("B")!;
say(`   Under B each of the 3 packs is equally likely to hold the guaranteed hit (${pct(b.byPack[0]! / OWNERS, 1)} / ${pct(b.byPack[1]! / OWNERS, 1)} / ${pct(b.byPack[2]! / OWNERS, 1)}), so packs 1 and 2 give less away;`);
say("   it would need all 3 starter packs rolled when the first is opened (or seeds drawn at grant and kept secret), plus a");
say("   separate draw for the upgraded pack (see the note in `starters`), a bigger change to the store for the same total.");
say("   A needs neither: the store knows the guarantee is due before it draws pack 3's seed, as with pity, so the upgraded");
say("   finish comes out in the table's own proportions (section 1).");

console.log(out.join("\n"));
