// Trials for the Aegis vs Cortex check-in (owner 2026-10-18, answers to
// session 41, item 2). aegisCortexShift.ts showed the gate's move comes
// entirely from Cortex's pilot, and the card whose use moved most is
// Mainframe Core (a 3-cost Directive, "Your units get +1/+1"), the aura the
// session-40 agent under-valued. These trials measure what a change to it
// would do to every Cortex edge in the gate, before anything ships: the
// card data is patched for the run only, nothing is written. NO CARD IS
// CHANGED by this file; the owner picks at the check-in.
//
//   npx tsx src/dev/cortexAuraTrials.ts [seeds=2500] [--signature]
//
// --signature measures the ring's second mode (each set Mythic as the
// deck's signature card, ringBaselineSignature.json).
// Each trial plays Cortex against Aegis, Null and Swarm on the gate's seeds
// 1..seeds (measurePairing's seeding, the current LookaheadAgent both
// sides), so the "shipped" row reproduces ringBaseline.json's Cortex edges
// (Aegis > Cortex 1,233 of 2,500 for Aegis).

import { measurePairing, ringBand, compareTwoProportions, wilson, shippedPool, type DeckBuilder, type Pool } from "./edgeMeasure.js";
import { buildDeck, buildAegisDeck, buildNullDeck, buildSwarmDeck, buildCortexDeck } from "../data/decks.js";
import { mainframeCore, signalDrone } from "../data/cards.js";
import type { Card, DeckFaction, DirectiveCard } from "../cards/types.js";

const args = process.argv.slice(2);
const signature = args.includes("--signature");
const seeds = Number(args.find((a) => !a.startsWith("--")) ?? 2500);
const pct = (x: number) => (x * 100).toFixed(1);
const say = (line = "") => console.log(line);

/** Mainframe Core with its aura (and cost) replaced, under its own id. */
function core(patch: { cost?: number; attack?: number; health?: number }): DirectiveCard {
  const a = mainframeCore.abilities[0]!;
  const fx = a.staticEffect as { kind: "buffAllies"; attack: number; health: number; filter: unknown };
  const attack = patch.attack ?? fx.attack, health = patch.health ?? fx.health;
  return {
    ...mainframeCore,
    cost: patch.cost ?? mainframeCore.cost,
    abilities: [{ ...a, text: `Your units get +${attack}/+${health}.`, staticEffect: { ...fx, attack, health } as typeof a.staticEffect }],
  };
}

/** The shipped Cortex list with Mainframe Core replaced by `card` x `copies`
 * and the freed copies (if any) going to Signal Drone, the list's 1-copy
 * Common filler (Neutral package swap, session 18). */
function cortexWith(card: Card, copies: number): Pool {
  const pool = shippedPool("Cortex");
  const i = pool.findIndex((p) => p.card.id === mainframeCore.id);
  const freed = pool[i]!.copies - copies;
  if (copies > 0) pool[i] = { card, copies };
  else pool.splice(i, 1);
  if (freed > 0) pool.find((p) => p.card.id === signalDrone.id)!.copies += freed;
  return pool;
}

const TRIALS: { label: string; pool?: Pool }[] = [
  { label: "shipped (Mainframe Core 3 energy, +1/+1, 2 copies)" },
  { label: "A: Mainframe Core costs 4", pool: cortexWith(core({ cost: 4 }), 2) },
  { label: "B: Mainframe Core +1/+0", pool: cortexWith(core({ health: 0 }), 2) },
  { label: "C: Mainframe Core 1 copy (+1 Signal Drone)", pool: cortexWith(mainframeCore, 1) },
  { label: "context: no Mainframe Core (+2 Signal Drone)", pool: cortexWith(mainframeCore, 0) },
];

const OPPONENTS: DeckFaction[] = ["Aegis", "Null", "Swarm"];
const base: Record<DeckFaction, DeckBuilder> = { Cortex: buildCortexDeck, Swarm: buildSwarmDeck, Aegis: buildAegisDeck, Null: buildNullDeck };
const verdict = (wins: number, n: number, band: { lo: number; hi: number }) => {
  const w = wilson(wins, n);
  if (w.lo >= band.lo && w.hi <= band.hi) return "IN";
  if (w.hi < band.lo || w.lo > band.hi) return "OUT";
  return "UNRESOLVED";
};

say(`# Cortex aura trials${signature ? " (signature mode)" : ""}: ${seeds} gate seeds per edge, current LookaheadAgent both sides`);
say(`  Win rates are the edge's first-named faction, as the gate reports them; bands from ringBand.`);
say();
const shippedWins = new Map<DeckFaction, number>();
for (const t of TRIALS) {
  const builders = { ...base };
  if (t.pool) {
    const pool = t.pool;
    builders.Cortex = (id, name) => buildDeck(id, name, pool);
  }
  const t0 = Date.now();
  const cells: string[] = [];
  for (const opp of OPPONENTS) {
    // The gate names Aegis > Cortex and Null ~ Cortex from the other side.
    const self: DeckFaction = opp === "Swarm" ? "Cortex" : opp;
    const other: DeckFaction = self === "Cortex" ? opp : "Cortex";
    const r = await measurePairing(self, other, 1, seeds, { builders, signature });
    const band = ringBand(self, other);
    const name = opp === "Swarm" ? "Cortex > Swarm" : opp === "Aegis" ? "Aegis > Cortex" : "Null ~ Cortex";
    let move = "";
    if (!t.pool) shippedWins.set(opp, r.selfWins);
    else {
      const c = compareTwoProportions(r.selfWins, seeds, shippedWins.get(opp)!, seeds);
      move = ` ${(c.diff.diff * 100 >= 0 ? "+" : "") + (c.diff.diff * 100).toFixed(1)} [${(c.diff.lo * 100).toFixed(1)}, ${(c.diff.hi * 100).toFixed(1)}]`;
    }
    cells.push(`${name} ${pct(r.selfWins / seeds)}% ${verdict(r.selfWins, seeds, band)} (band ${pct(band.lo)}-${pct(band.hi)})${move}`);
  }
  say(`  ${t.label}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  for (const c of cells) say(`      ${c}`);
}
