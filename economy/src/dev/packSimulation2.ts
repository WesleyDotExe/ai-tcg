// Chase-card simulation (session 38; owner 2026-10-16 "more collectable
// chase cards": "measure with the pack simulation ... report the median
// packs to complete both"). Rolls S0-odds-1 (live, packs.ts rollPack) and the
// PROPOSED S0-odds-2 (chase.ts rollPackV2) side by side and checks the
// proposal against the owner's targets:
//  - about 20% of packs with Full Art or better, Foil a common "lite" hit;
//  - the base set still completes in a reasonable number of packs;
//  - the full set with secret cards takes months for a dedicated owner,
//    not weeks;
//  - Jackpot stays 1 in 2,000, the pity timers keep working;
//  - special versions land on chosen cards, not mostly on Commons.
// Seeded, so the file reproduces.
//
// Usage (from economy/): npx tsx src/dev/packSimulation2.ts > ../progress/pack-sim-002.txt

import type { Rarity } from "@ai-tcg/engine";
import { COPY_LIMITS } from "@ai-tcg/engine";
import { CRAFT_PACK_POINTS, PACK_ODDS, PACK_POINTS_PER_PACK, SALVAGE_PACK_POINTS } from "../config.js";
import { cardSet, FULL_ART_OR_BETTER, nextPity, rollPack, type PityState } from "../packs.js";
import { baseHitPercent, HIT_FINISHES, nextPityV2, PACK_ODDS_V2, rollPackV2, seasonZeroChase, type ChasePull } from "../chase.js";

const out: string[] = [];
const say = (s = "") => out.push(s);
const pct = (x: number, d = 2) => `${(100 * x).toFixed(d)}%`;
const oneIn = (x: number) => (x > 0 ? `1 in ${Math.round(1 / x).toLocaleString("en-US")}` : "never");
const set = cardSet("S0");
const chase = seasonZeroChase(set);
const illustrations = chase.secrets.filter((s) => s.kind === "illustration");
const zeroDays = chase.secrets.filter((s) => s.kind === "zeroDay");
const fullRuns = () => new Map(set.prototypes.map((r) => [r.code, r.runSize]));
const NO_PITY: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
/** ECONOMY.md "Earning": a typical active day is ~1.4 packs from credits
 * plus the owner's daily pack. A dedicated owner plays every day. */
const PACKS_PER_DAY = 2.4;
const months = (packs: number) => (packs / PACKS_PER_DAY / 30.4).toFixed(1);
const q = (xs: number[], f: number) => [...xs].sort((a, b) => a - b)[Math.floor(f * (xs.length - 1))]!;

/** Both tables behind one shape: a pack's pulls, Jackpot and pity fired. */
type Roll = { pulls: readonly Pick<ChasePull, "cardId" | "rarity" | "finish" | "secret" | "slot">[]; jackpot: boolean; pity: { fullArt: boolean; mythic: boolean } };
const TABLES = {
  "S0-odds-1": {
    roll: (seed: number, pity: PityState): Roll => rollPack(seed, set, pity, fullRuns()),
    next: (pity: PityState, r: Roll) => nextPity(pity, r.pulls as never),
    hits: FULL_ART_OR_BETTER as readonly string[],
  },
  "S0-odds-2": {
    roll: (seed: number, pity: PityState): Roll => rollPackV2(seed, set, chase, pity, fullRuns()),
    next: (pity: PityState, r: Roll) => nextPityV2(pity, r.pulls),
    hits: HIT_FINISHES as readonly string[],
  },
} as const;
type TableName = keyof typeof TABLES;
const NAMES = Object.keys(TABLES) as TableName[];

say("AI-TCG chase-card simulation (session 38): S0-odds-1 (live) against S0-odds-2 (PROPOSED, not live)");
say(`Set ${set.code}: ${set.cards.length} cards; S0-odds-2 adds ${illustrations.length} secret illustrations, ${zeroDays.length} Zero-Day slots and ${chase.glitch.length} Glitch versions.`);
say("Command (from economy/): npx tsx src/dev/packSimulation2.ts. S0-odds-1 packs are rollPack (what openPack uses today);");
say("S0-odds-2 packs are rollPackV2 (economy/src/chase.ts), the same pack shape with the proposed shine slot.");
say(`"Hit" = Full Art or better. S0-odds-1: ${FULL_ART_OR_BETTER.join(", ")}. S0-odds-2: ${HIT_FINISHES.join(", ")}.`);
say();

// ---- 1. rates, pity off ----
{
  const N = 400_000;
  const stats = new Map<TableName, { finish: Record<string, number>; hit: number; jackpot: number; proto: number; zd: Record<string, number>; anyMythic: number }>();
  for (const name of NAMES) {
    const s = { finish: {} as Record<string, number>, hit: 0, jackpot: 0, proto: 0, zd: {} as Record<string, number>, anyMythic: 0 };
    for (let seed = 0; seed < N; seed++) {
      const r = TABLES[name].roll(seed, NO_PITY);
      const shine = r.pulls.find((p) => p.slot === "shine")!;
      s.finish[shine.finish] = (s.finish[shine.finish] ?? 0) + 1;
      if (r.pulls.some((p) => TABLES[name].hits.includes(p.finish))) s.hit++;
      if (r.jackpot) s.jackpot++;
      if (r.pulls.some((p) => p.slot === "bonus" && p.finish === "prototype")) s.proto++;
      if (r.pulls.some((p) => p.rarity === "Mythic")) s.anyMythic++;
      for (const p of r.pulls) if (p.finish === "zeroDay") s.zd[p.secret!] = (s.zd[p.secret!] ?? 0) + 1;
    }
    stats.set(name, s);
  }
  const f2 = PACK_ODDS_V2.shineFinish;
  const f1 = PACK_ODDS.shineFinish;
  say(`1. Rates against ${N.toLocaleString("en-US")} simulated packs per table (pity off: the base odds)`);
  say();
  say("   shine slot                 S0-odds-1 set    measured     S0-odds-2 set    measured");
  const std1 = 100 - f1.foil - f1.fullArt - f1.altArt - f1.gold;
  const std2 = 100 - Object.values(f2).reduce((a, b) => a + b, 0);
  const rows: [string, string, number | undefined, string][] = [
    ["Standard", "standard", std1, `${std2.toFixed(1)}%`],
    ["Foil", "foil", f1.foil, `${f2.foil}%`],
    ["Full Art", "fullArt", f1.fullArt, `${f2.fullArt}%`],
    ["Glitch (new)", "glitch", undefined, `${f2.glitch}%`],
    ["Alt Art", "altArt", f1.altArt, `${f2.altArt}%`],
    ["Secret illustration (new)", "secret", undefined, `${f2.secret}%`],
    ["Gold", "gold", f1.gold, `${f2.gold}%`],
    ["Zero-Day (new)", "zeroDay", undefined, `${f2.zeroDay}%`],
  ];
  for (const [label, key, set1, set2] of rows) {
    const m1 = (stats.get("S0-odds-1")!.finish[key] ?? 0) / N;
    const m2 = (stats.get("S0-odds-2")!.finish[key] ?? 0) / N;
    say(`   ${label.padEnd(27)}${(set1 === undefined ? "-" : `${set1.toFixed(2)}%`).padEnd(17)}${(set1 === undefined ? "-" : pct(m1, 3)).padEnd(13)}${set2.padEnd(17)}${pct(m2, 3)}`);
  }
  say();
  for (const name of NAMES) {
    const s = stats.get(name)!;
    say(`   ${name}: a hit in ${pct(s.hit / N)} of packs (pity off); Jackpot ${oneIn(s.jackpot / N)}; Prototype bonus ${oneIn(s.proto / N)}; any Mythic in ${pct(s.anyMythic / N)}.`);
  }
  const zd = stats.get("S0-odds-2")!.zd;
  const zdTotal = Object.values(zd).reduce((a, b) => a + b, 0);
  say(`   S0-odds-2 Zero-Day: ${oneIn(zdTotal / N)} packs overall (target about 1 in 500); each card: ${zeroDays.map((z) => `${z.code} ${oneIn((zd[z.code] ?? 0) / N)}`).join(", ")} (target about 1 in 1,500).`);
  say(`   S0-odds-2 base hit rate as set: ${baseHitPercent().toFixed(1)}% of shine slots, before pity and the Prototype bonus.`);
  say();
}

// ---- 2. where special versions land ----
{
  const N = 400_000;
  say(`2. Where the special versions land (owner item 4: "on chosen cards people want, rather than mostly on Commons"), ${N.toLocaleString("en-US")} packs each`);
  say();
  say("   finish        table       Common  Uncommon      Rare    Mythic   distinct cards");
  for (const finish of ["fullArt", "glitch", "altArt", "secret", "gold"]) {
    for (const name of NAMES) {
      const by: Record<string, number> = {};
      const distinct = new Set<string>();
      let n = 0;
      for (let seed = 0; seed < N; seed++) {
        for (const p of TABLES[name].roll(seed, NO_PITY).pulls) {
          if (p.finish !== finish || p.slot !== "shine") continue;
          by[p.rarity] = (by[p.rarity] ?? 0) + 1;
          distinct.add(p.secret ?? p.cardId);
          n++;
        }
      }
      if (n === 0) continue;
      say(`   ${finish.padEnd(14)}${name.padEnd(10)}${(["Common", "Uncommon", "Rare", "Mythic"] as Rarity[]).map((r) => pct((by[r] ?? 0) / n, 1).padStart(10)).join("")}   ${distinct.size}`);
    }
  }
  say("   (Secret illustrations show the rarity of the card they illustrate. Foil stays on any card, as before.)");
  say();
}

// ---- 3. pity on: the 20% target, and the timers ----
{
  const OWNERS = 2000;
  const PACKS = 120;
  say(`3. Pity per owner: ${OWNERS.toLocaleString("en-US")} owners x ${PACKS} packs, timers carried pack to pack as openPack does`);
  say();
  for (const name of NAMES) {
    let hits = 0;
    let fullArtFired = 0;
    let mythicFired = 0;
    let longestDry = 0;
    let total = 0;
    let seed = 1_000_000;
    for (let o = 0; o < OWNERS; o++) {
      let pity = NO_PITY;
      for (let p = 0; p < PACKS; p++) {
        const r = TABLES[name].roll(seed++, pity);
        if (r.pity.fullArt) fullArtFired++;
        if (r.pity.mythic) mythicFired++;
        if (r.pulls.some((x) => TABLES[name].hits.includes(x.finish))) hits++;
        pity = TABLES[name].next(pity, r);
        longestDry = Math.max(longestDry, pity.packsSinceFullArt);
        total++;
      }
    }
    say(`   ${name}: a hit in ${pct(hits / total)} of packs (target about 20%); hit pity fired in ${pct(fullArtFired / total)}, Mythic pity in ${pct(mythicFired / total, 3)}; longest dry run ${longestDry} (the timer guarantees 10 at most).`);
  }
  say();
}

// ---- 4. completion: packs to collect each goal, pity on, no crafting ----
type Goal = { label: string; size: number; key: (p: Roll["pulls"][number]) => string | undefined; table: TableName };
const GOALS: Goal[] = [
  { label: "base set (every card, any version) S0-odds-1", size: set.cards.length, key: (p) => (p.secret ? undefined : p.cardId), table: "S0-odds-1" },
  { label: "base set (every card, any version) S0-odds-2", size: set.cards.length, key: (p) => (p.finish === "zeroDay" ? undefined : p.cardId), table: "S0-odds-2" },
  { label: `${illustrations.length} secret illustrations`, size: illustrations.length, key: (p) => (p.finish === "secret" ? p.secret : undefined), table: "S0-odds-2" },
  { label: `${chase.glitch.length} Glitch versions`, size: chase.glitch.length, key: (p) => (p.finish === "glitch" ? p.cardId : undefined), table: "S0-odds-2" },
  { label: `${zeroDays.length} Zero-Day cards`, size: zeroDays.length, key: (p) => (p.finish === "zeroDay" ? p.secret : undefined), table: "S0-odds-2" },
  { label: `one Zero-Day card (any of the ${zeroDays.length})`, size: 1, key: (p) => (p.finish === "zeroDay" ? "any" : undefined), table: "S0-odds-2" },
];
const completion = new Map<string, number[]>();
{
  const OWNERS = 400;
  const CAP = 60_000;
  say(`4. Packs to complete each goal, opening packs only (${OWNERS} simulated owners, pity on, no crafting; capped at ${CAP.toLocaleString("en-US")} packs)`);
  say(`   Months assume a dedicated owner at ~${PACKS_PER_DAY} packs a day (ECONOMY.md "Earning": ~1.4 from credits plus the daily pack).`);
  say();
  say("   goal                                              median      10th      90th   median months");
  for (const g of GOALS) {
    const counts: number[] = [];
    let seed = 20_000_000 + GOALS.indexOf(g) * 50_000_000;
    for (let o = 0; o < OWNERS; o++) {
      const seen = new Set<string>();
      let pity = NO_PITY;
      let packs = 0;
      while (seen.size < g.size && packs < CAP) {
        const r = TABLES[g.table].roll(seed++, pity);
        pity = TABLES[g.table].next(pity, r);
        packs++;
        for (const p of r.pulls) {
          const k = g.key(p);
          if (k !== undefined) seen.add(k);
        }
      }
      counts.push(packs);
    }
    completion.set(g.label, counts);
    say(`   ${g.label.padEnd(48)}${String(q(counts, 0.5)).padStart(8)}${String(q(counts, 0.1)).padStart(10)}${String(q(counts, 0.9)).padStart(10)}${months(q(counts, 0.5)).padStart(16)}`);
  }
  say();
  say("   Opening packs alone, the secret illustrations take years: 33 entries at 1.5% of packs is about 1 pack in");
  say("   2,200 for any one illustration, and the last few are the slow ones (the coupon collector's tail). The");
  say("   rate alone can't make 'months': halving the time needs about twice the rate, which would push hits");
  say("   past the 20% target. Section 5 measures the lever the benchmark uses: crafting with pack points.");
  say();
}

// ---- 5. a dedicated owner with crafting ----
{
  const OWNERS = 200;
  const CAP = 20_000;
  // Pack-point prices to craft a secret card, measured (owner item 5 asks
  // for this as a later proposal; it is measured now because the "months"
  // target can't be read without it). Nothing here is built.
  const OPTIONS: { label: string; secret: number; zeroDay: number | null; glitch: number | null }[] = [
    { label: "no secret crafting", secret: Infinity, zeroDay: null, glitch: null },
    { label: "secret 1,500 / Zero-Day 5,000", secret: 1500, zeroDay: 5000, glitch: null },
    { label: "secret 1,000 / Zero-Day 5,000", secret: 1000, zeroDay: 5000, glitch: null },
    { label: "secret 750 / Zero-Day 3,000", secret: 750, zeroDay: 3000, glitch: null },
    { label: "secret 500 / Zero-Day 2,500", secret: 500, zeroDay: 2500, glitch: null },
  ];
  say(`5. A dedicated owner who salvages and crafts (${OWNERS} owners per option, pity on, S0-odds-2; capped at ${CAP.toLocaleString("en-US")} packs)`);
  say(`   Each pack pays ${PACK_POINTS_PER_PACK} pack points; every standard copy beyond the playable limit (3/3/2/1) is salvaged (${Object.values(SALVAGE_PACK_POINTS).join("/")} by rarity);`);
  say(`   missing base cards are crafted at ${Object.values(CRAFT_PACK_POINTS).join("/")}, cheapest missing thing first, then secret cards at the price shown.`);
  say("   'Master set' = base set + the 33 illustrations; 'full set' = master set + the 3 Zero-Day cards. Glitch is its own checklist.");
  say();
  say("   option                              base set      master set (months)        full set (months)");
  for (const opt of OPTIONS) {
    const base: number[] = [];
    const master: number[] = [];
    const full: number[] = [];
    let seed = 700_000_000 + OPTIONS.indexOf(opt) * 10_000_000;
    for (let o = 0; o < OWNERS; o++) {
      const standardHeld = new Map<string, number>();
      const ownedBase = new Set<string>();
      const ownedSecret = new Set<string>();
      let points = 0;
      let pity = NO_PITY;
      let packs = 0;
      let baseAt = 0;
      let masterAt = 0;
      let fullAt = 0;
      // Everything craftable, cheapest first.
      let missing = [
        ...set.cards.map((c) => ({ key: c.cardId, cost: CRAFT_PACK_POINTS[c.rarity], secret: false })),
        ...chase.secrets.map((s) => ({ key: s.code, cost: s.kind === "zeroDay" ? (opt.zeroDay ?? Infinity) : opt.secret, secret: true })),
      ]
        .filter((m) => Number.isFinite(m.cost))
        .sort((a, b) => a.cost - b.cost);
      while (packs < CAP && fullAt === 0) {
        const r = rollPackV2(seed++, set, chase, pity, fullRuns());
        pity = nextPityV2(pity, r.pulls);
        packs++;
        points += PACK_POINTS_PER_PACK;
        let gained = false;
        for (const p of r.pulls) {
          if (p.secret) {
            if (!ownedSecret.has(p.secret)) gained = true;
            ownedSecret.add(p.secret);
            if (p.cardId !== p.secret && !ownedBase.has(p.cardId)) (gained = true), ownedBase.add(p.cardId);
            continue;
          }
          if (!ownedBase.has(p.cardId)) (gained = true), ownedBase.add(p.cardId);
          if (p.finish !== "standard") continue;
          const held = (standardHeld.get(p.cardId) ?? 0) + 1;
          if (held > COPY_LIMITS[p.rarity]) points += SALVAGE_PACK_POINTS[p.rarity];
          else standardHeld.set(p.cardId, held);
        }
        if (gained) missing = missing.filter((m) => !(m.secret ? ownedSecret : ownedBase).has(m.key));
        // Craft the cheapest missing things the points cover.
        while (missing.length > 0 && missing[0]!.cost <= points) {
          const next = missing.shift()!;
          points -= next.cost;
          (next.secret ? ownedSecret : ownedBase).add(next.key);
        }
        if (!baseAt && ownedBase.size === set.cards.length) baseAt = packs;
        if (!masterAt && baseAt && illustrations.every((s) => ownedSecret.has(s.code))) masterAt = packs;
        if (masterAt && zeroDays.every((s) => ownedSecret.has(s.code))) fullAt = packs;
      }
      base.push(baseAt || CAP);
      master.push(masterAt || CAP);
      full.push(fullAt || CAP);
    }
    const m = q(master, 0.5);
    const f = q(full, 0.5);
    const capped = (x: number) => (x >= CAP ? `>${CAP.toLocaleString("en-US")}` : String(x));
    say(`   ${opt.label.padEnd(34)}${String(q(base, 0.5)).padStart(10)}${capped(m).padStart(12)} (${m >= CAP ? "-" : months(m)})${capped(f).padStart(18)} (${f >= CAP ? "-" : months(f)})`);
  }
  say();
}

process.stdout.write(out.join("\n") + "\n");
