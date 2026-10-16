// Pack simulation (session 36; ECONOMY.md "Packs" and "Prototypes": "test
// this with simulated pack openings; never raise the drop rate to test it").
// Rolls packs with the real odds table and the real roll function, and
// prints what an owner would see: the published rates against the measured
// ones, how often pity fires, Prototype finds against the pyramid, and how
// many packs it takes to see the set. Seeded, so the file reproduces.
//
// Usage (from economy/): npx tsx src/dev/packSimulation.ts > ../progress/pack-sim-001.txt

import { getCard, type Rarity } from "@ai-tcg/engine";
import { PACK_ODDS, PACK_PRICE_CREDITS, WIN_CREDITS } from "../config.js";
import { cardSet, FULL_ART_OR_BETTER, nextPity, rollPack, type PityState } from "../packs.js";

const out: string[] = [];
const say = (s = "") => out.push(s);
const pct = (x: number, d = 2) => `${(100 * x).toFixed(d)}%`;
const set = cardSet("S0");
const fullRuns = () => new Map(set.prototypes.map((r) => [r.code, r.runSize]));

say("AI-TCG pack simulation (session 36)");
say(`Set ${set.code} "${set.name}": ${set.cards.length} cards. Odds table ${PACK_ODDS.version} (economy/src/config.ts PACK_ODDS).`);
say("Command (from economy/): npx tsx src/dev/packSimulation.ts. Every pack is rollPack(seed, ...), the function openPack uses.");
say();

// ---- 1. the published rates, no pity ----
{
  const N = 400_000;
  let mythicRare = 0;
  let jackpots = 0;
  let protos = 0;
  const shine: Record<string, number> = {};
  const shineRarity: Record<string, number> = {};
  const anyFinish: Record<string, number> = {};
  let cards = 0;
  for (let seed = 0; seed < N; seed++) {
    const r = rollPack(seed, set, { packsSinceFullArt: 0, packsSinceMythic: 0 }, fullRuns());
    if (r.pulls[3]!.rarity === "Mythic") mythicRare++;
    shine[r.pulls[4]!.finish] = (shine[r.pulls[4]!.finish] ?? 0) + 1;
    shineRarity[r.pulls[4]!.rarity] = (shineRarity[r.pulls[4]!.rarity] ?? 0) + 1;
    if (r.jackpot) jackpots++;
    if (r.pulls.length === 6) protos++;
    for (const p of r.pulls) {
      anyFinish[p.finish] = (anyFinish[p.finish] ?? 0) + 1;
      cards++;
    }
  }
  const f = PACK_ODDS.shineFinish;
  const standard = 100 - f.foil - f.fullArt - f.altArt - f.gold;
  say(`1. Published rates against ${N.toLocaleString("en-US")} simulated packs (pity off, so these are the base odds)`);
  say();
  say("   what                              published      measured");
  const row = (what: string, published: string, got: number) => say(`   ${what.padEnd(34)}${published.padEnd(15)}${pct(got / N, 3)}`);
  row("Rare slot is a Mythic", "1 in 8 (12.5%)", mythicRare);
  row("Shine slot Standard", `~${standard.toFixed(0)}%`, shine.standard ?? 0);
  row("Shine slot Foil", "30%", shine.foil ?? 0);
  row("Shine slot Full Art", "10%", shine.fullArt ?? 0);
  row("Shine slot Alt Art (R/M only)", "~1 in 30", shine.altArt ?? 0);
  row("Shine slot Gold", "~1 in 150", shine.gold ?? 0);
  row("Jackpot pack", "~1 in 2,000", jackpots);
  row("Prototype bonus 6th card", "1 in 1,000", protos);
  say();
  say("   Shine slot rarity (PROPOSED weights 60 / 25 / 12 / 3; an Alt Art roll draws a Rare or Mythic):");
  say(`   ${(["Common", "Uncommon", "Rare", "Mythic"] as Rarity[]).map((r) => `${r} ${pct((shineRarity[r] ?? 0) / N)}`).join(", ")}`);
  say(`   Any Mythic in a pack (Rare slot or shine slot): about ${pct(mythicRare / N + (shineRarity.Mythic ?? 0) / N)} of packs.`);
  say(`   Every card, every slot (${cards.toLocaleString("en-US")} cards): ` + Object.entries(anyFinish).map(([k, v]) => `${k} ${pct(v / cards, 3)}`).join(", "));
  say();
}

// ---- 2. pity, per owner ----
{
  const OWNERS = 2000;
  const PACKS = 120;
  let fullArtFired = 0;
  let mythicFired = 0;
  let longestFullArtDry = 0;
  let longestMythicDry = 0;
  let total = 0;
  let seed = 1_000_000;
  for (let o = 0; o < OWNERS; o++) {
    let pity: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
    for (let p = 0; p < PACKS; p++) {
      const r = rollPack(seed++, set, pity, fullRuns());
      if (r.pity.fullArt) fullArtFired++;
      if (r.pity.mythic) mythicFired++;
      pity = nextPity(pity, r.pulls);
      longestFullArtDry = Math.max(longestFullArtDry, pity.packsSinceFullArt);
      longestMythicDry = Math.max(longestMythicDry, pity.packsSinceMythic);
      total++;
    }
  }
  say(`2. Pity per owner: ${OWNERS.toLocaleString("en-US")} owners x ${PACKS} packs each, timers carried pack to pack as openPack does`);
  say();
  say(`   Full Art or better pity (after ${PACK_ODDS.pity.fullArtAfter} dry packs) fired in ${pct(fullArtFired / total)} of packs; the longest dry run was ${longestFullArtDry}.`);
  say(`   Mythic pity (after ${PACK_ODDS.pity.mythicAfter} dry packs) fired in ${pct(mythicFired / total, 3)} of packs; the longest dry run was ${longestMythicDry}.`);
  say(`   ("Full Art or better" = ${FULL_ART_OR_BETTER.join(", ")}. With ~14% of packs naturally Full Art or better,`);
  say("   10 dry packs in a row is about a 1 in 5 event, so the timer fires often; with ~16% of packs holding a");
  say("   Mythic, 40 dry packs is rare, so that timer is a backstop. Both numbers are the owner's.)");
  say();
}

// ---- 3. Prototypes against the pyramid ----
{
  const N = 2_000_000;
  const marks = [250_000, 500_000, 1_000_000, 2_000_000];
  const left = fullRuns();
  const snapshots: Map<string, number>[] = [];
  let gold = 0;
  for (let seed = 0; seed < N; seed++) {
    const r = rollPack(5_000_000 + seed, set, { packsSinceFullArt: 0, packsSinceMythic: 0 }, left);
    const bonus = r.pulls[5];
    if (bonus?.prototypeRun) left.set(bonus.prototypeRun, left.get(bonus.prototypeRun)! - 1);
    else if (bonus) gold++;
    if (marks.includes(seed + 1)) snapshots.push(new Map(left));
  }
  say(`3. Prototypes found across a season, by packs opened season-wide (the real 1 in 1,000 rate; runs used up as found)`);
  say();
  say("   run     card                         size  " + marks.map((m) => `@${(m / 1000).toLocaleString("en-US")}k`.padStart(8)).join(""));
  for (const r of set.prototypes) {
    const name = getCard(r.cardId)!.name;
    say(`   ${r.code}  ${name.padEnd(28)} ${String(r.runSize).padStart(4)}  ` + snapshots.map((m) => String(r.runSize - m.get(r.code)!).padStart(8)).join(""));
  }
  const totals = snapshots.map((m) => 1516 - [...m.values()].reduce((t, v) => t + v, 0));
  say(`   all 15                               1516  ` + totals.map((t) => String(t).padStart(8)).join(""));
  say(`   ${gold} bonus Golds once every run had run out. A run is picked in proportion to the copies it has left,`);
  say("   so every run empties at about the same pace, share for share; the 1/1 is as likely to go early as late.");
  say(`   For scale: 1,000,000 packs is ${(1_000_000 * PACK_PRICE_CREDITS).toLocaleString("en-US")} credits, or ${Math.floor((1_000_000 * PACK_PRICE_CREDITS) / WIN_CREDITS.first).toLocaleString("en-US")} first-win-of-the-day payouts.`);
  say();
}

// ---- 4. how many packs to see the set ----
{
  const OWNERS = 500;
  const counts: number[] = [];
  const mythicCounts: number[] = [];
  let seed = 9_000_000;
  for (let o = 0; o < OWNERS; o++) {
    const seen = new Set<string>();
    const mythics = set.cards.filter((c) => c.rarity === "Mythic").length;
    let seenMythics = 0;
    let pity: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
    let packs = 0;
    let allMythicsAt = 0;
    while (seen.size < set.cards.length) {
      const r = rollPack(seed++, set, pity, fullRuns());
      pity = nextPity(pity, r.pulls);
      packs++;
      for (const p of r.pulls) {
        if (!seen.has(p.cardId)) {
          seen.add(p.cardId);
          if (p.rarity === "Mythic" && ++seenMythics === mythics) allMythicsAt = packs;
        }
      }
    }
    counts.push(packs);
    mythicCounts.push(allMythicsAt);
  }
  const q = (xs: number[], f: number) => [...xs].sort((a, b) => a - b)[Math.floor(f * (xs.length - 1))]!;
  say(`4. Packs to see every card of the set at least once (${OWNERS} simulated owners, pity on)`);
  say();
  say(`   median ${q(counts, 0.5)} packs (10th percentile ${q(counts, 0.1)}, 90th ${q(counts, 0.9)}); every Mythic: median ${q(mythicCounts, 0.5)}.`);
  say(`   At ${PACK_PRICE_CREDITS} credits a pack, the median is ${(q(counts, 0.5) * PACK_PRICE_CREDITS).toLocaleString("en-US")} credits. Crafting with pack points (5 a pack) and the`);
  say("   starter packs shorten this; a playable deck needs far less than the whole set.");
}

process.stdout.write(out.join("\n") + "\n");
