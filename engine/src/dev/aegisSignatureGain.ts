// Why does a signature card help Aegis about twice as much as the other
// factions? (owner 2026-10-18, answers to session 43, option A: "find out
// why Aegis gains about twice as much from a signature card as the other
// factions (+10-12 points against 4-6), and propose a fix for Null > Aegis
// (45.2%, band 55-60) in the real-match mode at a check-in. Change no cards
// without the owner's OK.")
//
// NO CARD IS CHANGED by this file. Trials patch a deck for the run only.
//
// Every game here is the ring's real-match mode (ringRegression.ts --real):
// set Mythic in the deck, each side that has a signature card draws an
// approved menu line with edgeMeasure.approvedSignatureFor, on the gate's
// seeding (seed parity picks who goes first, the same agent seed for both
// sides, the current LookaheadAgent). "Gain" is the change in a faction's
// win rate when only it gets a signature card (the other side has none),
// against the gate, as in balance-report-030 section 2b.
//
// The agents are wrapped by EnergyWatch, which only records what each
// player was shown when it ended its own turn and passes the move through,
// so every game is the same game the ring plays.
//
//   npx tsx src/dev/aegisSignatureGain.ts [seeds=2500] [--section 1,2,3,4,5]

import { buildDeck, buildAegisDeck } from "../data/decks.js";
import { kernelPanic, nullSingularity } from "../data/nullCards.js";
import { aegisCadet, platingModule } from "../data/aegisCards.js";
import { FACTIONS, ringBand, shippedPool } from "./edgeMeasure.js";
import { RING_EDGES, edgeName, type RingEdge } from "./ringRegression.js";
import { REFERENCE_SIGNATURE } from "./signatureFairness.js";
import type { Card, DeckFaction as Faction, ToolCard, UnitCard } from "../cards/types.js";
import { play, rate, gainText, verdict, pct, signed, type Setup, type Run, type Side, type Builder } from "./signatureGainHarness.js";

const args = process.argv.slice(2);
const seeds = Number(args.find((a) => /^\d+$/.test(a)) ?? 2500);
const sections = new Set((args.includes("--section") ? args[args.indexOf("--section") + 1]! : "1,2,3,4,5").split(",").map(Number));
const say = (line = "") => console.log(line);

const t0 = Date.now();
say(`# Aegis's signature gain (${seeds} gate seeds per cell, the ring's real-match mode, current LookaheadAgent both sides)`);
say();

// The three setups every section reads: the gate, each side alone with a
// signature card, and both (the ring's --real mode).
const runs = new Map<string, Run>();
const k = (label: string, e: RingEdge) => `${label}|${edgeName(e)}`;
for (const e of RING_EDGES) {
  runs.set(k("gate", e), await play(e, { sig: new Set() }, seeds));
  runs.set(k("only-self", e), await play(e, { sig: new Set([e.self]) }, seeds));
  runs.set(k("only-opp", e), await play(e, { sig: new Set([e.opponent]) }, seeds));
  runs.set(k("both", e), await play(e, { sig: new Set([e.self, e.opponent]) }, seeds));
}
/** Each faction's three edges, as (edge, the faction, its opponent). */
const facing = (f: Faction) => RING_EDGES.filter((e) => e.self === f || e.opponent === f).map((e) => ({ e, opp: e.self === f ? e.opponent : e.self }));
const alone = (f: Faction, e: RingEdge) => (f === e.self ? "only-self" : "only-opp");

if (sections.has(1)) {
  say("== 1. What a signature card is worth to each faction (the corrected draw: all 14 lines) ==");
  say("  Gain = the faction's win rate with only it holding a signature card, minus the gate. Newcombe 95%.");
  for (const f of FACTIONS) {
    const cells = facing(f).map(({ e, opp }) => {
      const g = runs.get(k("gate", e))!.side[f], s = runs.get(k(alone(f, e), e))!.side[f];
      return `vs ${opp.padEnd(6)} ${gainText(s, g)}`;
    });
    const mean = facing(f).reduce((m, { e }) => m + rate(runs.get(k(alone(f, e), e))!.side[f]) - rate(runs.get(k("gate", e))!.side[f]), 0) / 3;
    say(`  ${f.padEnd(6)} mean ${signed(mean).padStart(5)}   ${cells.join("   ")}`);
  }
  say();
  say("  The ring's six edges, real-match mode (both sides hold one), against the gate:");
  for (const e of RING_EDGES) {
    const band = ringBand(e.self, e.opponent);
    const b = runs.get(k("both", e))!.side[e.self], g = runs.get(k("gate", e))!.side[e.self];
    say(`  ${edgeName(e).padEnd(16)} gate ${pct(rate(g))}%  real ${pct(rate(b))}% ${verdict(b.wins, b.games, band).padEnd(5)}  change ${gainText(b, g)}`);
  }
  say();
}

if (sections.has(2)) {
  say("== 2. Spare energy: what each faction leaves unspent late in a game, with and without its signature card ==");
  say("  Own turns at 5+ max energy (the signature card costs 5): mean energy left at the end of the turn,");
  say("  share of those turns ending with 3+ unspent, share ending with an empty hand. Over the faction's three edges.");
  for (const f of FACTIONS) {
    const sum = (label: (e: RingEdge) => string) => {
      const acc = { turns: 0, unspent: 0, float3: 0, empty: 0, games: 0 };
      for (const { e } of facing(f)) {
        const s = runs.get(k(label(e), e))!.side[f];
        acc.turns += s.lateTurns; acc.unspent += s.lateUnspent; acc.float3 += s.lateFloat3; acc.empty += s.lateEmptyHand; acc.games += s.games;
      }
      return acc;
    };
    const g = sum(() => "gate"), s = sum((e) => alone(f, e));
    const line = (a: typeof g) =>
      `${(a.unspent / a.turns).toFixed(2)} left, 3+ ${pct(a.float3 / a.turns).padStart(5)}%, empty hand ${pct(a.empty / a.turns).padStart(5)}% (${(a.turns / a.games).toFixed(1)} turns/game)`;
    say(`  ${f.padEnd(6)} gate:  ${line(g)}`);
    say(`  ${"".padEnd(6)} + sig: ${line(s)}   energy put to use: ${((g.unspent / g.turns - s.unspent / s.turns)).toFixed(2)} a late turn`);
  }
  say();
}

if (sections.has(3)) {
  say("== 3. What happens to the signature card itself (only the faction holds one), per game it was played ==");
  say("  tools = tools attached to it; buffs = buff events on it; attacks made; face damage dealt;");
  say("  attacked = attacks aimed at it; redirected = attacks redirected onto it (Intercept Routine).");
  for (const f of FACTIONS) {
    for (const { e, opp } of facing(f)) {
      const s = runs.get(k(alone(f, e), e))!.side[f];
      const per = (x: number) => (s.sigGames ? x / s.sigGames : 0).toFixed(2);
      say(`  ${f.padEnd(6)} vs ${opp.padEnd(6)} played ${pct(s.sigGames / s.games).padStart(5)}%  tools ${per(s.sigTools)}  buffs ${per(s.sigBuffs)}  attacks ${per(s.sigAttacks)}` +
        `  face dmg ${per(s.sigFaceDamage)}  attacked ${per(s.sigAttacked)}  redirected ${per(s.sigRedirectedTo)}`);
    }
  }
  say();
  say();
}

if (sections.has(4)) {
  // Trial fixes for Null > Aegis in the real-match mode. Each is measured on
  // every edge it can move (Null's three and Aegis's three), with both sides
  // holding a signature card (the ring's --real mode), and, where it touches
  // a deck card, in the gate too. Nothing is written.
  const withReach = (n: number): UnitCard => ({
    ...kernelPanic,
    abilities: kernelPanic.abilities.map((a) =>
      a.id === "kernel-panic-evolve"
        ? { ...a, text: `When this evolves in, destroy target enemy unit with ${n} or less health.`, targeting: { scope: "chosen", filter: { side: "opponent", kind: "unit", maxHealth: n } } }
        : a,
    ),
  });
  const nullWith = (card: Card): Builder => {
    const pool = shippedPool("Null").map((p) => (p.card.id === card.id ? { ...p, card } : p));
    return (id, name) => buildDeck(id, name, pool);
  };
  const aegisWith = (card: ToolCard): Builder => {
    const pool = shippedPool("Aegis").map((p) => (p.card.id === card.id ? { ...p, card } : p));
    return (id, name) => buildDeck(id, name, pool);
  };
  const TRIALS: { label: string; setup: Omit<Setup, "sig">; touchesGate: boolean }[] = [
    { label: "T1: a signature card can't carry tools (a rule, both sides)", setup: { noToolsOnSignature: true }, touchesGate: false },
    { label: "T2: Kernel Panic destroys a unit with 5 or less health (was 4; session 10's number)", setup: { builders: { Null: nullWith(withReach(5)) } }, touchesGate: true },
    { label: "T3: Kernel Panic destroys a unit with 6 or less health (reaches every 3/6 signature line)", setup: { builders: { Null: nullWith(withReach(6)) } }, touchesGate: true },
    { label: "T4: Plating Module gives +0/+2 (was +0/+3)", setup: { builders: { Aegis: aegisWith({ ...platingModule, healthBonus: 2 }) } }, touchesGate: true },
    { label: "T5: Null Singularity costs 6 (was 7)", setup: { builders: { Null: nullWith({ ...nullSingularity, cost: 6 }) } }, touchesGate: true },
    { label: "T6: every signature card costs 6 (was 5; a rule, both sides)", setup: { signatureCost: 6 }, touchesGate: false },
  ];
  const touched = RING_EDGES.filter((e) => [e.self, e.opponent].some((f) => f === "Null" || f === "Aegis"));
  say("== 4. Trial fixes for Null > Aegis (patched for the run only; nothing is written) ==");
  say("  Each cell: the trial's rate for the edge's first-named faction, verdict, and the change from the same mode as shipped.");
  for (const t of TRIALS) {
    say(`  ${t.label}`);
    for (const e of touched) {
      const band = ringBand(e.self, e.opponent);
      const cells: string[] = [];
      for (const [mode, sig] of [["real", new Set([e.self, e.opponent])], ["gate", new Set<Faction>()]] as const) {
        if (mode === "gate" && !t.touchesGate) continue;
        const r = (await play(e, { ...t.setup, sig }, seeds)).side[e.self];
        const base = runs.get(k(mode === "real" ? "both" : "gate", e))!.side[e.self];
        cells.push(`${mode} ${pct(rate(r)).padStart(5)}% ${verdict(r.wins, r.games, band).padEnd(5)} ${gainText(r, base)}`);
      }
      say(`    ${edgeName(e).padEnd(16)} ${cells.join("   ")}`);
    }
  }
  say();
}

if (sections.has(5)) {
  // The cause check: if a signature card is worth more to Aegis because
  // Aegis has nothing else to spend late energy on, then giving Aegis's own
  // deck more late plays should shrink that gain toward the other factions'.
  // A dev-only deck (built directly, outside buildDeck's lint: it is a
  // measuring tool, never a real deck): Aegis's three Aegis Cadets (1-cost
  // 1/2) become three 5-cost 3/6 vanilla Aegis units, the plain stand-in's
  // body as a deck card.
  const heavy: UnitCard = { ...REFERENCE_SIGNATURE, id: "DEV-AEGIS-5", name: "Dev 5-drop", faction: "Aegis", rarity: "Common" };
  const heavier: Builder = (id, name) => {
    const d = buildAegisDeck(id, name);
    return { ...d, cards: d.cards.map((c) => (c.id === aegisCadet.id ? heavy : c)) };
  };
  say("== 5. The cause check: the same gain with a heavier Aegis deck (3 Aegis Cadets -> 3 vanilla 5-cost 3/6) ==");
  say("  Per Aegis edge: Aegis's win rate in the gate and with only Aegis holding a signature card, shipped and heavier,");
  say("  and what Aegis leaves unspent on late turns (5+ max energy) in each.");
  for (const { e, opp } of facing("Aegis")) {
    const g = runs.get(k("gate", e))!.side.Aegis, s = runs.get(k(alone("Aegis", e), e))!.side.Aegis;
    const hg = (await play(e, { sig: new Set(), builders: { Aegis: heavier } }, seeds)).side.Aegis;
    const hs = (await play(e, { sig: new Set<Faction>(["Aegis"]), builders: { Aegis: heavier } }, seeds)).side.Aegis;
    const left = (x: Side) => (x.lateUnspent / x.lateTurns).toFixed(2);
    say(`  vs ${opp.padEnd(6)} shipped: gate ${pct(rate(g))}% (${left(g)} left), + sig ${pct(rate(s))}%, gain ${gainText(s, g)}`);
    say(`  ${"".padEnd(9)} heavier: gate ${pct(rate(hg))}% (${left(hg)} left), + sig ${pct(rate(hs))}%, gain ${gainText(hs, hg)}`);
  }
  say();
}

say(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
