// The Zero-Day cards' fairness measurement (owner 2026-10-16: "measure the
// strength with the same fairness test as signature cards ... propose the
// cap with the measurements"; owner 2026-10-18: "check that agents use both
// modes of each card"). Built session 40.
//
// The same shape as dev/signatureFairness.ts, for a deck card instead of a
// signature card:
//   - The reference: every faction plays its shipped deck with ONE slot
//     changed, one copy of a cut card replaced by a plain stand-in (a Neutral
//     card of the Zero-Day card's cost with no ability: a vanilla body for a
//     Unit, the cost tier's body for the Command). The signature zone holds
//     the plain reference signature (REFERENCE_SIGNATURE), as in the
//     signature test, so each deck's set Mythic stays in the deck.
//   - A candidate: one faction's stand-in becomes the Zero-Day card, in the
//     same deck position (so the shuffle, and every game until the card is
//     drawn, is identical), the other three keeping their stand-in.
//   - The change on each of that faction's three edges is the paired mean of
//     per-seed differences, with its 95% interval (signatureFairness.ts's
//     pairedChange: a win counts 1, a loss or a draw 0, as the ring counts).
//   - The cut card is the same in both runs: one copy of a removal card (any rarity below Mythic, with a spare copy) when
//     the Zero-Day card counts as removal (so the deck's 25% removal share
//     doesn't move), one copy of a non-removal card otherwise.
// It also counts, per card and faction, how often each mode was chosen.
//
// Usage (from engine/):
//   npx tsx src/dev/zeroDayFairness.ts reference --seeds N --out file
//   npx tsx src/dev/zeroDayFairness.ts candidate --card S0-ZD1 [--force mode] [--patch json] --ref file --out file
//   npx tsx src/dev/zeroDayFairness.ts report --ref file file...
//
// --patch (session 41, tuning to the owner's cap): a JSON object merged into
// the card for this run only (objects key by key, arrays index by index), to
// try other numbers without editing the card, e.g. '{"health":3}' or, for
// Patient Zero's Carrier, '{"modes":[{},{"abilities":[{"staticEffect":{"health":0}}]}]}'.
// The patched card must pass the Zero-Day lint and count as removal exactly
// when the designed card does. The stand-in and the cut card stay those of
// the designed card, so a patch that trims the body is measured against the
// designed body, not a stand-in trimmed with it.

import { readFileSync, writeFileSync } from "node:fs";
import { measurePairing, FACTIONS, shippedPool, type DeckBuilder, type Pool } from "./edgeMeasure.js";
import { REFERENCE_SIGNATURE, pairedChange, type PairedChange } from "./signatureFairness.js";
import { buildDeck } from "../data/decks.js";
import { ZERO_DAY_CARDS } from "../data/zeroDayCards.js";
import { isRemovalOrDebuffCard, zeroDayCardViolations } from "../cards/poolLint.js";
import { findMode, withMode } from "../cards/modes.js";
import type { Card, DeckFaction as Faction, UnitCard } from "../cards/types.js";

/** The plain stand-in at `card`'s cost: a Neutral vanilla Unit. A Unit's
 * stand-in keeps its body (so the measurement is the modes alone); the
 * Command's takes the cost tier's line, 7 energy for a 4/8. Never a real
 * card. */
export function standIn(card: Card): UnitCard {
  const body = card.type === "Unit" ? { attack: card.attack, health: card.health } : { attack: 4, health: 8 };
  return {
    id: `REF-${card.id}`,
    name: `Stand-in ${card.cost}`,
    faction: "Neutral",
    rarity: "Common",
    cost: card.cost,
    type: "Unit",
    ...body,
    keywords: [],
    art: "placeholder:dev/stand-in",
    flavor: "",
    abilities: [],
  };
}

/** `faction`'s shipped pool with one copy of the cut card replaced by
 * `slot`, which sits right after the cut card's entry. */
export function poolWith(faction: Faction, slot: Card, removalCut: boolean): Pool {
  const pool = shippedPool(faction);
  const i = pool.findIndex((p) => p.copies > 1 && p.card.rarity !== "Mythic" && isRemovalOrDebuffCard(p.card) === removalCut);
  if (i === -1) throw new Error(`${faction}: no card with a spare copy to cut (removal: ${removalCut})`);
  pool[i]!.copies -= 1;
  pool.splice(i + 1, 0, { card: slot, copies: 1 });
  return pool;
}

/** Builders for all four factions: each with `slots[f]` in its changed
 * slot, the reference signature in its zone. The list with `card` (the
 * Zero-Day card) in the slot must be a legal deck (lint, copy limits, size:
 * buildDeck checks it once here); a run with the stand-in in the slot plays
 * the same list in the same order, which buildDeck can't build only because
 * a stand-in isn't a neutral-pool card. */
function builders(slots: Record<Faction, Card>, card: Card): Record<Faction, DeckBuilder> {
  const removalCut = removalCutFor(card);
  return Object.fromEntries(
    FACTIONS.map((f) => {
      buildDeck("p1", `${f} + ${card.name}`, poolWith(f, card, removalCut));
      const pool = poolWith(f, slots[f], removalCut);
      const cards = pool.flatMap((p) => Array<Card>(p.copies).fill(p.card));
      return [f, (id: "p1" | "p2", name: string) => ({ id, name, cards, signature: REFERENCE_SIGNATURE })];
    }),
  ) as Record<Faction, DeckBuilder>;
}

const removalCutFor = (card: Card) => isRemovalOrDebuffCard(card);

interface PairResult {
  /** Per-seed result string from the earlier faction's side: 1 win, 0 loss, d draw. */
  results: string;
  /** Mode picks by the faction holding the Zero-Day card, if any: mode name -> games' plays. */
  modes?: Record<string, number>;
  /** Games in which that faction played the card at all. */
  played?: number;
}

/** `card` locked into one mode: the copy that mode makes, as a plain
 * (non-modal) card, so an agent can't pick the other. Plays exactly like
 * the modal card played in that mode; for the "is the pick worth anything"
 * comparison only. */
export function forcedMode(card: Card, modeId: string): Card {
  const { chosenMode: _c, modes: _m, ...plain } = withMode(card, modeId);
  return plain as Card;
}

/** `base` with `patch` merged in: objects key by key, arrays index by
 * index, anything else replaced. */
export function patched<T>(base: T, patch: unknown): T {
  if (Array.isArray(base) && Array.isArray(patch)) return base.map((v, i) => (i < patch.length ? patched(v, patch[i]) : v)) as T;
  if (base && typeof base === "object" && patch && typeof patch === "object" && !Array.isArray(patch)) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(patch)) out[k] = k in out ? patched(out[k], v) : v;
    return out as T;
  }
  return patch as T;
}

/** Plays every pairing involving `holder` (all six when no holder). With
 * `force`, the holder's copy is locked into that mode. `base` is the
 * designed card when `card` is a patched one: the stand-in and the deck
 * check come from it. */
async function measure(card: Card, holder: Faction | undefined, seeds: number, force?: string, base: Card = card): Promise<Record<string, PairResult>> {
  const stand = standIn(base);
  const held = force ? forcedMode(card, force) : card;
  const slots = Object.fromEntries(FACTIONS.map((f) => [f, f === holder ? held : stand])) as Record<Faction, Card>;
  const b = builders(slots, base);
  const out: Record<string, PairResult> = {};
  for (const [i, self] of FACTIONS.entries()) {
    for (const opponent of FACTIONS.slice(i + 1)) {
      if (holder && self !== holder && opponent !== holder) continue;
      let results = "";
      const modes: Record<string, number> = {};
      let played = 0;
      await measurePairing(self, opponent, 1, seeds, {
        builders: b,
        onGame: (state, selfPid) => {
          results += state.winner === "draw" ? "d" : state.winner === selfPid ? "1" : "0";
          if (!holder) return;
          const holderPid = holder === self ? selfPid : selfPid === "p1" ? "p2" : "p1";
          let any = false;
          for (const e of state.log) {
            if ((e.type === "play" || e.type === "cast") && e.player === holderPid && e.card === card.name) {
              const name = e.modeName ?? `${findMode(card, force!)!.name} (forced)`;
              modes[name] = (modes[name] ?? 0) + 1;
              any = true;
            }
          }
          if (any) played++;
        },
      });
      out[`${self}>${opponent}`] = holder ? { results, modes, played } : { results };
    }
  }
  return out;
}

/** From `self`'s side, the per-seed string of a pairing stored either way round. */
function sideOf(pairs: Record<string, PairResult>, self: Faction, opponent: Faction): string {
  const direct = pairs[`${self}>${opponent}`];
  if (direct) return direct.results;
  const flipped = pairs[`${opponent}>${self}`];
  if (!flipped) throw new Error(`no results for ${self} vs ${opponent}`);
  return [...flipped.results].map((c) => (c === "1" ? "0" : c === "0" ? "1" : "d")).join("");
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pts = (c: PairedChange) => `${c.diff >= 0 ? "+" : ""}${(c.diff * 100).toFixed(2)} [${(c.lo * 100).toFixed(2)}, ${(c.hi * 100).toFixed(2)}]`;

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === "reference") {
    const seeds = Number(arg("seeds") ?? 1000);
    // One reference per cut kind (removal or not): the stand-in's slot moves
    // with it. Kill Switch and Root Access cut a removal card, Patient Zero
    // a plain Common. Stand-ins are equal per cost, so one per card.
    const out: Record<string, unknown> = { seeds };
    for (const card of ZERO_DAY_CARDS) out[card.id] = await measure(card, undefined, seeds);
    writeFileSync(arg("out")!, JSON.stringify(out));
    return;
  }
  if (cmd === "candidate") {
    const base = ZERO_DAY_CARDS.find((c) => c.id === arg("card"))!;
    const ref = JSON.parse(readFileSync(arg("ref")!, "utf8")) as { seeds: number };
    const force = arg("force");
    const patch = arg("patch") ? (JSON.parse(arg("patch")!) as unknown) : undefined;
    const card = patch ? patched(base, patch) : base;
    if (patch) {
      const lint = zeroDayCardViolations(card);
      if (lint.length > 0) throw new Error(`patched ${base.name}: ${lint.join("; ")}`);
      if (isRemovalOrDebuffCard(card) !== isRemovalOrDebuffCard(base)) throw new Error(`patched ${base.name}: the patch changes whether it counts as removal`);
    }
    const out: Record<string, unknown> = { card: card.id, seeds: ref.seeds, ...(force ? { force } : {}), ...(patch ? { patch } : {}) };
    for (const holder of FACTIONS) out[holder] = await measure(card, holder, ref.seeds, force, base);
    writeFileSync(arg("out")!, JSON.stringify(out));
    return;
  }
  if (cmd === "report") {
    const ref = JSON.parse(readFileSync(arg("ref")!, "utf8")) as Record<string, Record<string, PairResult>> & { seeds: number };
    const files = process.argv.slice(3).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--ref");
    const lines: string[] = [];
    for (const file of files) {
      const cand = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, PairResult>> & { card: string; seeds: number; force?: string; patch?: unknown };
      const card = ZERO_DAY_CARDS.find((c) => c.id === cand.card)!;
      const how = (cand.force ? `LOCKED to ${findMode(card, cand.force)!.name}` : "agent chooses the mode") + (cand.patch ? `, PATCHED ${JSON.stringify(cand.patch)}` : "");
      lines.push(`${card.name} (${card.id}), ${how}; ${card.cost} energy ${card.type}, ${cand.seeds} seeds per pairing, vs stand-in "${standIn(card).name}" (${standIn(card).attack}/${standIn(card).health} vanilla)`);
      lines.push(`  cut: one copy of ${removalCutFor(card) ? "a removal card" : "a non-removal card"}`);
      let worst = 0;
      let sum = 0;
      for (const holder of FACTIONS) {
        const pairs = cand[holder]!;
        const edges = FACTIONS.filter((f) => f !== holder).map((opp) => {
          const change = pairedChange(sideOf(pairs, holder, opp), sideOf(ref[card.id]!, holder, opp));
          worst = Math.max(worst, Math.abs(change.diff));
          sum += change.diff;
          return `vs ${opp} ${pct(change.refRate)} -> ${pct(change.rate)} ${pts(change)}`;
        });
        const modes: Record<string, number> = {};
        let played = 0;
        for (const p of Object.values(pairs)) {
          for (const [m, n] of Object.entries(p.modes ?? {})) modes[m] = (modes[m] ?? 0) + n;
          played += p.played ?? 0;
        }
        const total = Object.values(modes).reduce((a, b) => a + b, 0);
        const split = Object.keys(modes).length === 0 ? "-" : Object.entries(modes).map(([m, n]) => `${m} ${n} (${pct(n / total)})`).join(", ");
        lines.push(`  ${holder.padEnd(6)} ${edges.join(" | ")}`);
        lines.push(`         played in ${played} of ${3 * cand.seeds} games; modes: ${split}`);
      }
      lines.push(`  worst edge move ${(worst * 100).toFixed(2)} points; mean move ${((sum / 12) * 100).toFixed(2)} points`);
      lines.push("");
    }
    console.log(lines.join("\n"));
    return;
  }
  throw new Error("usage: reference | candidate | report (see the header)");
}

await main();
