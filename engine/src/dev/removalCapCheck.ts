// The removal-cap check the owner asked for when shipping NA12 and CS7
// (2026-11-01: "Null is exactly at the 25% removal cap (10 of 40). Confirm
// whether Null Pointer's new -3/-3 mode changes how it counts against the
// removal cap, and that Null's list and starter still fit the cap").
//
// For every faction list: each removal/debuff card, its copies, and how each
// of its modes classifies on its own (cards/poolLint.ts's
// isRemovalOrDebuffCard on the copy played in that mode). The lint counts a
// card once, by copies, if ANY way of playing it is removal, so a modal card
// whose printed mode was already removal counts exactly as before whatever
// its new mode is. The starter collections are the shipped lists (economy's
// starter grant), so the list's line is the starter's line.
//
//   npx tsx src/dev/removalCapCheck.ts

import { REMOVAL_DEBUFF_MAX_SHARE, isRemovalOrDebuffCard, lintCardPool } from "../cards/poolLint.js";
import { withMode } from "../cards/modes.js";
import type { Card } from "../cards/types.js";
import { AEGIS_CARDS } from "../data/aegisCards.js";
import { CORTEX_CARDS, SWARM_CARDS } from "../data/cards.js";
import { NULL_CARDS } from "../data/nullCards.js";

const LISTS: [string, { card: Card; copies: number }[]][] = [
  ["Cortex", CORTEX_CARDS], ["Swarm", SWARM_CARDS], ["Aegis", AEGIS_CARDS], ["Null", NULL_CARDS],
];

const modeLine = (card: Card): string =>
  card.modes
    ? card.modes.map((m) => `${m.name}: ${isRemovalOrDebuffCard({ ...withMode(card, m.id), modes: undefined }) ? "removal" : "not removal"}`).join("; ")
    : "-";

let ok = true;
console.log(`Removal/debuff cap: ${REMOVAL_DEBUFF_MAX_SHARE * 100}% of a list's copies (cards/poolLint.ts rule 1).\n`);
for (const [name, list] of LISTS) {
  const total = list.reduce((s, p) => s + p.copies, 0);
  const removal = list.filter((p) => isRemovalOrDebuffCard(p.card));
  const count = removal.reduce((s, p) => s + p.copies, 0);
  const cap = Math.floor(REMOVAL_DEBUFF_MAX_SHARE * total);
  let lint = "lint passes";
  try { lintCardPool(list, name); } catch (e) { lint = `LINT FAILS: ${(e as Error).message}`; ok = false; }
  console.log(`${name}: ${count}/${total} copies removal (${((count / total) * 100).toFixed(1)}%), cap ${cap}; ${lint}`);
  for (const { card, copies } of removal) {
    console.log(`  ${copies} x ${card.name} (${card.id})${card.modes ? `  modes: ${modeLine(card)}` : ""}`);
  }
  const modalNonRemoval = list.filter((p) => p.card.modes && !isRemovalOrDebuffCard(p.card));
  for (const { card, copies } of modalNonRemoval) console.log(`  (not removal) ${copies} x ${card.name}  modes: ${modeLine(card)}`);
  console.log("");
}
if (!ok) process.exit(1);
