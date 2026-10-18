// Evidence for the starter guarantee (session 46; owner 2026-10-19, render
// session 28 call 9): every new owner sees at least one hit (Full Art or
// better) across the 3 starter packs.
//
//   npx tsx src/dev/starterGuaranteeDemo.ts > ../progress/economy-demo-011.txt
//
// In a real database file, through the store's own openPack: an owner whose
// first two starter packs miss gets a hit in the third (shown next to what
// the same seed rolls without the guarantee); an owner with an early hit gets
// nothing extra; an owner who opens another pack first and the starters out
// of order still gets it on the last starter pack, across a store restart;
// what the opening log records; then 1,000 new owners. Seeds are fixed here
// so the output reproduces; the store draws them server-side otherwise. The
// rates and the effect on the wider economy are in pack-sim-003-starter.txt.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { cardSet, EconomyStore, FULL_ART_OR_BETTER, LIVE_PACK_ODDS, rollPack, type PackOpening, type PityState } from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "starter-guarantee-demo-"));
const dbPath = join(tempDir, "season-0.db");
let clock = new Date("2026-10-19T09:00:00.000Z");
const tick = () => (clock = new Date(clock.getTime() + 60_000));
let store = EconomyStore.open(dbPath, { now: () => clock });
const say = (line = "") => console.log(line);
const S0 = cardSet("S0");
const runs = new Map(S0.prototypes.map((r) => [r.code, r.runSize]));
const NO_PITY: PityState = { packsSinceFullArt: 0, packsSinceMythic: 0 };
const FINISH: Record<string, string> = { standard: "", foil: "FOIL", fullArt: "FULL ART", altArt: "ALT ART", gold: "GOLD", prototype: "PROTOTYPE", glitch: "GLITCH", secret: "SECRET", zeroDay: "ZERO-DAY" };
const isHitFinish = (f: string) => (FULL_ART_OR_BETTER as readonly string[]).includes(f);
const plainHit = (seed: number) => rollPack(seed, S0, NO_PITY, runs, LIVE_PACK_ODDS).pulls.some((p) => isHitFinish(p.finish));
/** The first seed from `start` whose plain pack is (or isn't) a hit. */
const seedFrom = (start: number, hit: boolean) => {
  for (let s = start; ; s++) if (plainHit(s) === hit) return s;
};

function showPack(p: PackOpening, title: string): void {
  const flags = [p.starterHit && "starter guarantee: shine slot made a hit", p.pity.fullArt && "pity: Full Art or better", p.jackpot && "JACKPOT PACK"].filter(Boolean);
  say(`${title}  seed ${p.seed}${flags.length ? `  [${flags.join(", ")}]` : ""}`);
  for (const c of p.cards) say(`    ${c.slot.padEnd(9)} ${c.collectorNumber}  ${c.name.padEnd(24)} ${c.rarity.padEnd(9)} ${FINISH[c.finish]}`);
}
function newOwner(name: string) {
  const o = store.createOwner({ name });
  store.grantStarterCollection(o.ownerId, "Null");
  return o.ownerId;
}

say("# The starter guarantee (session 46)");
say(`database: <temp>/season-0.db  schema v${store.schemaVersion}  odds table ${LIVE_PACK_ODDS.version}`);
say(`hit = Full Art or better: ${FULL_ART_OR_BETTER.join(", ")}`);
say();

// ---- 1. two misses, then the guarantee ----
say("## 1. Starter packs 1 and 2 have no hit: pack 3's shine slot is made a hit");
say();
const a = newOwner("owner-a");
const aSeeds = [seedFrom(1, false), seedFrom(100, false), seedFrom(200, false)];
for (const [i, seed] of aSeeds.entries()) {
  tick();
  showPack(store.openPack(a, undefined, { seed }), `starter pack ${i + 1}`);
}
const without = rollPack(aSeeds[2]!, S0, NO_PITY, runs, LIVE_PACK_ODDS).pulls[4]!;
say(`  the same seed without the guarantee: shine slot ${S0.cards.find((c) => c.cardId === without.cardId)!.name} ${FINISH[without.finish] || "(standard)"}, no hit`);
say(`  pity afterwards: ${store.pityStatus(a).packsSinceFullArt} packs without a hit`);
say();

// ---- 2. an early hit ----
say("## 2. A hit in starter pack 1: packs 2 and 3 roll as any pack does");
say();
const b = newOwner("owner-b");
for (const [i, seed] of [seedFrom(1, true), seedFrom(300, false), seedFrom(400, false)].entries()) {
  tick();
  showPack(store.openPack(b, undefined, { seed }), `starter pack ${i + 1}`);
}
say();

// ---- 3. another pack first, starters out of order, a restart in between ----
say("## 3. Another pack with a hit first, the starters out of order, the store restarted between them");
say();
const c = newOwner("owner-c");
const weekly = store.grantPack(c, "S0", "weeklyChallenge");
const starters = store.unopenedPacks(c).filter((p) => p.source === "starter");
tick();
showPack(store.openPack(c, weekly.packId, { seed: seedFrom(500, true) }), "weekly challenge pack (not a starter pack)");
tick();
showPack(store.openPack(c, starters[2]!.packId, { seed: seedFrom(600, false) }), "starter pack (granted 3rd)");
store.close();
store = EconomyStore.open(dbPath, { now: () => clock });
say("  -- store closed and reopened --");
tick();
showPack(store.openPack(c, starters[0]!.packId, { seed: seedFrom(700, false) }), "starter pack (granted 1st)");
tick();
showPack(store.openPack(c, starters[1]!.packId, { seed: seedFrom(800, false) }), "starter pack (granted 2nd, the last one opened)");
say();

// ---- 4. the opening log ----
say("## 4. What the opening log records (pack_openings.pity_json, raw)");
say();
store.close();
{
  const db = new DatabaseSync(dbPath);
  const rows = db
    .prepare("SELECT o.opening_no, p.source, o.seed, o.pity_json FROM pack_openings o JOIN packs p ON p.pack_id = o.pack_id JOIN owners w ON w.owner_id = o.owner_id WHERE w.name = 'owner-c' ORDER BY o.opening_no")
    .all() as { opening_no: number; source: string; seed: number; pity_json: string }[];
  for (const r of rows) say(`  opening ${String(r.opening_no).padStart(2)}  ${r.source.padEnd(16)} seed ${String(r.seed).padEnd(5)} ${r.pity_json}`);
  db.close();
}
store = EconomyStore.open(dbPath, { now: () => clock });
say();

// ---- 5. 1,000 new owners ----
say("## 5. 1,000 new owners through openPack (seeds 900,000 + 3i + k)");
say();
let withHit = 0;
let applied = 0;
const position = [0, 0, 0];
for (let i = 0; i < 1_000; i++) {
  const o = newOwner(`owner-n${i}`);
  const packs = [0, 1, 2].map((k) => store.openPack(o, undefined, { seed: 900_000 + 3 * i + k }));
  if (packs.some((p) => p.cards.some((x) => isHitFinish(x.finish)))) withHit++;
  packs.forEach((p, k) => {
    if (p.starterHit) {
      applied++;
      position[k]!++;
    }
  });
}
say(`  owners with at least one hit in their starter packs: ${withHit} / 1,000`);
say(`  owners the guarantee applied to: ${applied} (on starter pack 1/2/3: ${position.join(" / ")})`);
store.close();
rmSync(tempDir, { recursive: true, force: true });
