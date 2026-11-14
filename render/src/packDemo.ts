// Builds the self-contained pack-opening page (render/output/pack-opening.html)
// from REAL openings: one owner in a fresh economy database (in memory),
// opening packs through `EconomyStore.openPack` with fixed seeds, so every
// run opens the same packs (the same cards, finishes, NEW badges and
// serials). Only the store's own random ids (pack and copy ids) differ
// from run to run.
//
//   npm run pack-opening -w @ai-tcg/render
//
// The seeds are searched the way the economy's own chase demo does
// (economy/src/dev/chaseLiveDemo.ts): for each pack the showcase wants (a
// plain pack, then one per finish, then a Jackpot pack), the first seed
// from 1 whose roll, for the owner's pity state at that moment, has it.
// The search only picks WHICH real pack to open; the store then rolls,
// records and returns it, and the page reveals exactly that. Nothing on the
// page rolls anything.
//
// Then the ten-pack showcases (slice 2, openBulkShowcase): real 10-at-once
// opens, one fresh owner each.
//
// Also prints a transcript (each pack's cards and its tells) for the
// evidence folder.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BULK_OPEN_COUNT, cardSet, EconomyStore, FULL_ART_OR_BETTER, LIVE_PACK_ODDS, rollPack, type BulkOpening, type PackRoll, type PityState } from "@ai-tcg/economy";
import { bestStepOf, DEBUG_STEP_LABEL, DEBUG_STEPS, planBulkReveal, planReveal, withSetBar, type BulkReveal, type PackReveal, type RevealStep } from "./packOpening.js";
import { renderPackOpeningHtml } from "./packPage.js";
import { packWardRings } from "./packWards.js";
import { withBulkPullVersions, withPullVersions } from "./packVersions.js";

/** One showcase pack: what the picker calls it, and what its roll must have. */
export interface ShowcaseWant {
  label: string;
  want: (r: PackRoll) => boolean;
}

const shine = (r: PackRoll) => r.pulls.find((p) => p.slot === "shine")!;
const noBonus = (r: PackRoll) => !r.pulls.some((p) => p.slot === "bonus");
const plainExtras = (r: PackRoll) => !r.jackpot && noBonus(r);

export const SHOWCASE: readonly ShowcaseWant[] = [
  { label: "No hit", want: (r) => plainExtras(r) && shine(r).finish === "standard" },
  { label: "Foil", want: (r) => plainExtras(r) && shine(r).finish === "foil" },
  { label: "Full Art", want: (r) => plainExtras(r) && shine(r).finish === "fullArt" },
  { label: "Alt Art", want: (r) => plainExtras(r) && shine(r).finish === "altArt" },
  { label: "Glitch", want: (r) => plainExtras(r) && shine(r).finish === "glitch" },
  { label: "Secret", want: (r) => plainExtras(r) && shine(r).finish === "secret" },
  { label: "Gold", want: (r) => plainExtras(r) && shine(r).finish === "gold" },
  { label: "Zero-Day", want: (r) => plainExtras(r) && shine(r).finish === "zeroDay" },
  // A Prototype bonus 6th card, in a pack with no other hit, so the
  // bonus moment is the pack's own.
  { label: "Prototype", want: (r) => !r.jackpot && r.pulls.some((p) => p.finish === "prototype") && !r.pulls.some((p) => p.slot === "shine" && FULL_ART_OR_BETTER.includes(p.finish)) },
  // A Jackpot pack with a hit in it, so its sparks show too (most Jackpot
  // packs are all Foil, which is no hit and so no sparks).
  { label: "Jackpot", want: (r) => r.jackpot && noBonus(r) && r.pulls.some((p) => FULL_ART_OR_BETTER.includes(p.finish)) },
];

export interface Showcase {
  label: string;
  reveal: PackReveal;
}

/** Opens the showcase packs, in order, for one owner in a fresh database. */
export function openShowcase(wants: readonly ShowcaseWant[] = SHOWCASE): Showcase[] {
  // A fixed clock, so the openings are the same every run.
  let clock = new Date("2026-10-18T12:00:00.000Z");
  const store = EconomyStore.open(":memory:", { now: () => clock });
  try {
    const owner = store.createOwner({ name: "pack-demo" }).ownerId;
    const set = cardSet("S0");
    const runs = new Map(set.prototypes.map((r) => [r.code, r.runSize]));
    const out: Showcase[] = [];
    for (const w of wants) {
      store.grantPack(owner, "S0", "weeklyChallenge");
      const pity: PityState = store.pityStatus(owner);
      let seed = 1;
      while (!w.want(rollPack(seed, set, pity, runs, LIVE_PACK_ODDS))) seed++;
      clock = new Date(clock.getTime() + 60_000);
      const opening = store.openPack(owner, undefined, { seed });
      // A Prototype run's copy is taken once opened: the next search sees it.
      for (const c of opening.cards) if (c.prototype) runs.set(c.prototype.runCode, runs.get(c.prototype.runCode)! - 1);
      // The set bar: the binder's base count after the open (render 61).
      // Render session 78: each card's versions, from the same binder.
      const binder = store.binder(owner, "S0");
      out.push({ label: w.label, reveal: withPullVersions(withSetBar(planReveal(opening), binder.base), binder) });
    }
    return out;
  } finally {
    store.close();
  }
}

/** One ten-pack showcase: what the picker calls it, and what the open must
 * have. */
export interface BulkWant {
  label: string;
  want: (b: BulkOpening) => boolean;
}

const hits = (b: BulkOpening) => b.packs.flatMap((p) => p.cards).filter((c) => FULL_ART_OR_BETTER.includes(c.finish)).length;

export const BULK_SHOWCASE: readonly BulkWant[] = [
  // The everyday ten: no big pull, so the whole open is the fast sequence,
  // but at least one hit so its short flourish shows.
  { label: "10 packs", want: (b) => b.summary.fullReveals.length === 0 && hits(b) >= 1 },
  // A ten with a big pull in it (about 1 open in 4 has one), and a smaller
  // hit besides, so the fast sequence and a full reveal both show.
  { label: "10 packs, big pull", want: (b) => b.summary.fullReveals.length >= 1 && hits(b) >= 2 },
];

export interface BulkShowcase {
  label: string;
  reveal: BulkReveal;
}

/** Opens the ten-pack showcases. Each is a fresh owner's first ten packs in
 * a fresh database (`EconomyStore.openPacks`, 10 at once), seeded with ten
 * consecutive seeds from a base. The search tries bases 1, 11, 21, ... and
 * keeps the first open that has what the showcase wants; the open it keeps
 * is the store's own, not a re-roll. */
export function openBulkShowcase(wants: readonly BulkWant[] = BULK_SHOWCASE): BulkShowcase[] {
  return wants.map((w) => {
    for (let base = 1; ; base += BULK_OPEN_COUNT) {
      const store = EconomyStore.open(":memory:", { now: () => new Date("2026-10-18T12:00:00.000Z") });
      try {
        const owner = store.createOwner({ name: "pack-demo" }).ownerId;
        for (let i = 0; i < BULK_OPEN_COUNT; i++) store.grantPack(owner, "S0", "weeklyChallenge");
        const bulk = store.openPacks(owner, BULK_OPEN_COUNT, { seeds: Array.from({ length: BULK_OPEN_COUNT }, (_, k) => base + k) });
        if (w.want(bulk)) return { label: w.label, reveal: withBulkPullVersions(planBulkReveal(bulk), store.binder(owner, "S0")) };
      } finally {
        store.close();
      }
    }
  });
}

// ---- the debug panel's packs (render session 62; the brief: "Debug panel
// (owner-only, demo pages): force the best card of the next pack to any
// reveal kind, including Prototype, to tune each sequence without opening
// 1,000 packs") ---------------------------------------------------------
//
// "Force" here never makes a card up. For each kind the panel offers, the
// search below finds the first seed from 1 whose roll, for a fresh owner,
// has that kind as its best card (no Jackpot; no bonus card except for the
// Prototype, whose best card IS the bonus), and the store then opens that
// pack for real. The panel just picks which of these real openings the next
// pack is. The ten-pack version opens that seed as pack 1 of a real
// ten-at-once open (the next nine seeds after it), so Open 10's stops and
// its big-pull path can be tuned per kind too.

export interface DebugPack {
  step: Exclude<RevealStep, "snap">;
  label: string;
  reveal: PackReveal;
}
export interface DebugBulk {
  step: Exclude<RevealStep, "snap">;
  label: string;
  reveal: BulkReveal;
}
export interface DebugPacks {
  single: DebugPack[];
  bulk: DebugBulk[];
}

const DEBUG_CLOCK = "2026-11-10T12:00:00.000Z";

/** The first seed from 1 whose roll, for a fresh owner, has `step` as its
 * best card. */
export function debugSeedFor(step: Exclude<RevealStep, "snap">, limit = 2_000_000): number {
  const set = cardSet("S0");
  const runs = new Map(set.prototypes.map((r) => [r.code, r.runSize]));
  const store = EconomyStore.open(":memory:", { now: () => new Date(DEBUG_CLOCK) });
  let pity: PityState;
  try {
    const owner = store.createOwner({ name: "pack-debug" }).ownerId;
    pity = store.pityStatus(owner);
  } finally {
    store.close();
  }
  for (let seed = 1; seed <= limit; seed++) {
    const r = rollPack(seed, set, pity, runs, LIVE_PACK_ODDS);
    if (r.jackpot) continue;
    if (step !== "prototype" && r.pulls.some((p) => p.slot === "bonus")) continue;
    if (bestStepOf(r.pulls) === step) return seed;
  }
  throw new Error(`no seed up to ${limit} has a ${step} as its best card`);
}

export function openDebugPacks(steps: readonly Exclude<RevealStep, "snap">[] = DEBUG_STEPS): DebugPacks {
  const single: DebugPack[] = [], bulk: DebugBulk[] = [];
  for (const step of steps) {
    const seed = debugSeedFor(step);
    const label = DEBUG_STEP_LABEL[step];
    {
      const store = EconomyStore.open(":memory:", { now: () => new Date(DEBUG_CLOCK) });
      try {
        const owner = store.createOwner({ name: "pack-debug" }).ownerId;
        store.grantPack(owner, "S0", "weeklyChallenge");
        const opening = store.openPack(owner, undefined, { seed });
        if (bestStepOf(opening.cards) !== step) throw new Error(`seed ${seed} opened without its ${step}`);
        const binder = store.binder(owner, "S0");
        single.push({ step, label, reveal: withPullVersions(withSetBar(planReveal(opening), binder.base), binder) });
      } finally {
        store.close();
      }
    }
    {
      const store = EconomyStore.open(":memory:", { now: () => new Date(DEBUG_CLOCK) });
      try {
        const owner = store.createOwner({ name: "pack-debug" }).ownerId;
        for (let i = 0; i < BULK_OPEN_COUNT; i++) store.grantPack(owner, "S0", "weeklyChallenge");
        const open = store.openPacks(owner, BULK_OPEN_COUNT, { seeds: Array.from({ length: BULK_OPEN_COUNT }, (_, k) => seed + k) });
        if (bestStepOf(open.packs[0]!.cards) !== step) throw new Error(`seed ${seed} opened as pack 1 without its ${step}`);
        bulk.push({ step, label, reveal: withBulkPullVersions(planBulkReveal(open), store.binder(owner, "S0")) });
      } finally {
        store.close();
      }
    }
  }
  return { single, bulk };
}

export function debugTranscript(d: DebugPacks): string {
  const lines = [
    "Debug panel packs (render session 62): for each kind, the first seed from 1 whose roll for a fresh owner",
    `has that kind as its best card, opened for real (EconomyStore.openPack; and as pack 1 of openPacks(owner, 10)), odds ${LIVE_PACK_ODDS.version}.`,
    "",
  ];
  d.single.forEach((s, i) => {
    const r = s.reveal, b = d.bulk[i]!.reveal;
    const best = r.cards.reduce((a, c) => (c.build.level >= a.build.level ? c : a));
    lines.push(`${s.label.padEnd(9)} seed ${String(r.seed).padStart(6)}  best: ${best.face.name} (${best.face.rarity}, ${best.finish})  tap to hit ${best.build.hitAt} ms` +
      `  | ten: pack 1 ${b.packs[0]!.fullReveal ? "big pull" : "row"}, ${b.packs.flatMap((p) => p.cards).filter((c) => c.build.held).length} stops in 10 packs`);
  });
  return lines.join("\n") + "\n";
}

export function bulkTranscript(bulks: readonly BulkShowcase[]): string {
  const lines = [
    "Ten-pack showcase (render session 25): real opens through EconomyStore.openPacks(owner, 10),",
    `each a fresh owner's first ten packs, odds ${LIVE_PACK_ODDS.version}. * = a hit (Full Art or better).`,
    "",
  ];
  for (const b of bulks) {
    const r = b.reveal, sm = r.summary;
    lines.push(`${b.label}: seeds ${r.packs[0]!.seed}-${r.packs[r.packs.length - 1]!.seed}; ${sm.cards} cards, ${sm.newCards} new, +${sm.packPoints} pack points`);
    lines.push(`  by finish: ${Object.entries(sm.byFinish).map(([f, n]) => `${f} ${n}`).join(", ")}`);
    r.packs.forEach((p, i) => {
      const best = p.cards.filter((c) => c.finish !== "standard").map((c) => `${c.hit ? "*" : ""}${c.face.name} (${c.finish})`).join(", ") || "all standard";
      lines.push(`  pack ${String(i + 1).padStart(2)}: seed ${p.seed} ${p.fullReveal ? "FULL REVEAL" : "fast       "} ${p.sparks ? "sparks   " : "no sparks"}  ${best}`);
    });
    lines.push(`  summary grid: ${r.tiles.length} tiles for ${sm.cards} cards, ${r.tiles.filter((t) => t.isNew).length} NEW badges, ${r.tiles.filter((t) => t.count > 1).length} folded duplicates`);
    lines.push("");
  }
  return lines.join("\n");
}

export function transcript(showcase: readonly Showcase[]): string {
  const lines = [
    "Pack-opening showcase (render session 24): real openings through EconomyStore.openPack,",
    `one owner, a fresh database, odds ${LIVE_PACK_ODDS.version}. Reveal order; * = a hit (Full Art or better).`,
    "",
  ];
  for (const s of showcase) {
    const r = s.reveal;
    const tells = [r.sparks ? "SPARKS" : "no sparks", r.jackpot ? "JACKPOT" : "", r.pity.fullArt ? "pity: hit" : "", r.pity.mythic ? "pity: Mythic" : ""].filter(Boolean).join(", ");
    lines.push(`${s.label}: seed ${r.seed}, +${r.packPoints} pack points, ${tells}${r.setBar ? `, set ${r.setBar.before} -> ${r.setBar.after}/${r.setBar.total}` : ""}`);
    for (const c of r.cards) {
      const extra = [c.isNew ? "NEW" : "", c.prototype ? `serial ${c.prototype.serial}/${c.prototype.runSize} (${c.prototype.runCode})` : "", c.secret ? c.secret.code : ""].filter(Boolean).join(" ");
      lines.push(`  ${c.hit ? "*" : " "} ${c.slot.padEnd(8)} ${c.collectorNumber}  ${c.face.name.padEnd(30)} ${c.face.rarity.padEnd(9)} ${c.finish.padEnd(9)} ${c.faceDown ? "face down" : "face up  "}  ${extra}`);
    }
  }
  return lines.join("\n") + "\n";
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const showcase = openShowcase();
  const bulks = openBulkShowcase();
  const debug = openDebugPacks();
  const out = join(here, "..", "output", "pack-opening.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderPackOpeningHtml({ title: "Season Zero pack opening", packs: showcase, bulks, wards: packWardRings(), debug }));
  process.stdout.write(transcript(showcase) + "\n" + bulkTranscript(bulks) + "\n" + debugTranscript(debug));
  process.stderr.write(`wrote ${out}\n`);
}
