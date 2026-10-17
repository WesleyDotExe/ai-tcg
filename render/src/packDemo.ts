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
// Also prints a transcript (each pack's cards and its tells) for the
// evidence folder.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cardSet, EconomyStore, FULL_ART_OR_BETTER, LIVE_PACK_ODDS, rollPack, type PackRoll, type PityState } from "@ai-tcg/economy";
import { planReveal, type PackReveal } from "./packOpening.js";
import { renderPackOpeningHtml } from "./packPage.js";

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
      out.push({ label: w.label, reveal: planReveal(opening) });
    }
    return out;
  } finally {
    store.close();
  }
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
    lines.push(`${s.label}: seed ${r.seed}, +${r.packPoints} pack points, ${tells}`);
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
  const out = join(here, "..", "output", "pack-opening.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderPackOpeningHtml({ title: "Season Zero pack opening", packs: showcase }));
  process.stdout.write(transcript(showcase));
  process.stderr.write(`wrote ${out}\n`);
}
