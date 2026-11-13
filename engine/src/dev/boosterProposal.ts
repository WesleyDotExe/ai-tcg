// The Season 0 booster-card proposal's check (owner 2026-11-14, option B;
// the cards: dev/boosterDraft.ts, DRAFT, not shipped). Test only: nothing
// here changes a shipped card, deck, rule, pack or the registry.
//
// What it shows, for the owner's check-in:
//  1. Every proposed card is legal card data the engine accepts: each
//     faction's starter deck with its booster cards swapped in still passes
//     buildDeck (copy limits, deck size, the pool lint), and every modal
//     card passes the modal rules.
//  2. Every proposed card resolves in real matches: how many games it was
//     played in, and how many times each of its abilities fired (from the
//     match log's own abilityTrigger events).
//  3. A first power read: the deck builder's prior (cardRating) for each
//     card beside the starter pool's, and each faction's starter deck with
//     all 7 booster cards in (11 copies, each out for the lowest-rated
//     starter copy of the same kind: removal for removal) against the four
//     shipped decks, beside the shipped deck itself on the same seeds; with
//     the flags, each card's share of that (leave one out), a control (the
//     same cuts with blank vanilla bodies in) and each card alone. This is
//     not the balance re-run the owner named (that is the built-deck ring,
//     with the cards in the registry and the packs); it is the early read
//     that tells the owner whether the list is in the right range before it
//     is built.
//
// npx tsx src/dev/boosterProposal.ts [gamesPerOpponent=100] [--singles] [--leave-one-out] [--control]

import type { Card, DeckFaction } from "../cards/types.js";
import { allAbilities } from "../cards/modes.js";
import { buildDeck, COPY_LIMITS } from "../data/decks.js";
import { SHIPPED_DECK_LISTS, getCard } from "../data/registry.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { runMatch } from "../engine/match.js";
import type { DeckSpec } from "../state/init.js";
import { cardRating } from "../deckbuilder/cardRating.js";
import { drawsCards } from "../deckbuilder/deckBuilder.js";
import { isRemovalOrDebuffCard } from "../cards/poolLint.js";
import { BOOSTER_DRAFT } from "./boosterDraft.js";

const FACTIONS: DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];
const GAMES = Number(process.argv[2] ?? 100);
/** `--singles`: also play each card alone in its starter deck (section 7). */
const SINGLES = process.argv.includes("--singles");
/** `--leave-one-out`: also play the full probe deck minus each card (section 5). */
const LEAVE_ONE_OUT = process.argv.includes("--leave-one-out");
/** `--control`: the same cuts with blank bodies in (section 6). */
const CONTROL = process.argv.includes("--control");
/** Copies of each booster card in the probe deck: what an owner a few weeks
 * into the season might hold of a card of that rarity. */
const PROBE_COPIES = { Common: 2, Uncommon: 2, Rare: 1, Mythic: 1 } as const;

type Entry = { card: Card; copies: number };

function shipped(faction: DeckFaction): Entry[] {
  return SHIPPED_DECK_LISTS[faction].map((e) => ({ card: getCard(e.cardId)!, copies: e.copies }));
}

/** The starter deck with booster cards in at PROBE_COPIES, each copy out
 * for the lowest-rated starter copy (never a Mythic, never an evolution's
 * base while its evolution is in the deck). A removal/debuff card goes in
 * for a removal/debuff card (the pool lint's definition), so the deck's
 * removal share never moves: the starter decks sit near the 25% cap, and
 * that cap is a deck rule the store's builder keeps too. The last faction
 * card that draws stays unless a booster card in draws (the lint's card
 * flow rule). Same size as the starter. */
function probeDeck(faction: DeckFaction, cards: readonly Card[] = BOOSTER_DRAFT[faction]): { pool: Entry[]; out: string[] } {
  const pool = shipped(faction).map((e) => ({ ...e }));
  const adds = cards.map((card) => ({ card, copies: PROBE_COPIES[card.rarity] }));
  const isBase = (c: Card) => pool.some((p) => p.copies > 0 && p.card.type === "Unit" && p.card.evolvesFrom === c.id);
  // The pool lint needs a faction card that draws (card flow); never cut
  // the last copy of the last one unless a booster card going in draws.
  const draws = (c: Card) => c.faction !== "Neutral" && drawsCards(c);
  const lastDraw = (p: Entry) =>
    draws(p.card) && !adds.some((a) => draws(a.card)) && pool.filter((q) => q.copies > 0 && draws(q.card)).reduce((n, q) => n + q.copies, 0) <= 1;
  const out: string[] = [];
  for (const add of adds) {
    for (let i = 0; i < add.copies; i++) {
      const removal = isRemovalOrDebuffCard(add.card);
      const pick = pool
        .filter((p) => p.copies > 0 && !isBase(p.card) && p.card.rarity !== "Mythic" && isRemovalOrDebuffCard(p.card) === removal && !lastDraw(p))
        .sort((a, b) => cardRating(a.card) - cardRating(b.card) || a.card.id.localeCompare(b.card.id))[0];
      if (!pick) throw new Error(`${faction}: nothing left to cut for ${add.card.name}`);
      pick.copies--;
      out.push(`${pick.card.name} (${pick.card.id})`);
    }
  }
  return { pool: [...pool.filter((p) => p.copies > 0), ...adds], out };
}

interface Tally {
  wins: number;
  games: number;
  byOpp: Record<DeckFaction, number>;
  playedIn: Map<string, number>;
  fired: Map<string, number>;
}

async function gauntlet(deck: (id: DeckSpec["id"]) => DeckSpec, watch: Set<string>): Promise<Tally> {
  const t: Tally = { wins: 0, games: 0, byOpp: {} as Record<DeckFaction, number>, playedIn: new Map(), fired: new Map() };
  for (const opp of FACTIONS) {
    let wins = 0;
    for (let seed = 1; seed <= GAMES; seed++) {
      const theirs = (id: DeckSpec["id"]) => buildDeck(id, `${opp} (shipped)`, shipped(opp));
      const a = new LookaheadAgent("Probe", seed * 104729 + 31);
      const b = new LookaheadAgent(`Shipped-${opp}`, seed * 104729 + 31);
      const first = seed % 2 === 1;
      const me = first ? "p1" : "p2";
      const { state } = first ? await runMatch(deck("p1"), theirs("p2"), a, b, seed) : await runMatch(theirs("p1"), deck("p2"), b, a, seed);
      const won = state.winner === me;
      if (won) wins++;
      t.games++;
      const seen = new Set<string>();
      for (const ev of state.log) {
        if (ev.type === "play" && ev.player === me && watch.has(ev.card)) seen.add(ev.card);
        if (ev.type === "cast" && ev.player === me && watch.has(ev.card)) seen.add(ev.card);
        if (ev.type === "evolve" && ev.player === me && watch.has(ev.to)) seen.add(ev.to);
        // A Tool logs only its attachment (engine.ts), never a "play".
        if (ev.type === "toolAttached" && ev.player === me && watch.has(ev.tool)) seen.add(ev.tool);
        if (ev.type === "abilityTrigger" && watch.has(ev.source)) {
          // Both seats may hold the same card only in a mirror; the probe
          // deck is the only one with booster cards, so every trigger is its.
          t.fired.set(ev.ability, (t.fired.get(ev.ability) ?? 0) + 1);
        }
      }
      for (const name of seen) t.playedIn.set(name, (t.playedIn.get(name) ?? 0) + 1);
    }
    t.byOpp[opp] = wins / GAMES;
    t.wins += wins;
  }
  return t;
}

const pct = (x: number) => (x * 100).toFixed(1);
/** 95% Wilson interval, in points. */
function wilson(wins: number, n: number): string {
  const z = 1.96, p = wins / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return `[${pct(c - h)}-${pct(c + h)}]`;
}

async function main(): Promise<void> {
  const lines: string[] = [];
  const say = (s = "") => { lines.push(s); console.log(s); };
  say("Season 0 booster-card proposal: the engine's check (DRAFT cards, engine/src/dev/boosterDraft.ts; test only)");
  say(`Lookahead vs Lookahead, Calculator style, ${GAMES} games against each shipped deck (seeds 1-${GAMES}, seats alternate).`);
  say("No shipped card, deck, rule, pack or registry entry changed: the cards are not ownable.");
  say();

  // 1. Every card's data, its rating beside its faction's starter pool.
  say("== 1. The cards (cardRating: the deck builder's prior, value above a vanilla unit of the cost) ==");
  for (const f of FACTIONS) {
    const starter = shipped(f).filter((e) => e.card.faction === f).map((e) => cardRating(e.card));
    const sorted = [...starter].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    say(`${f}: starter pool rating min ${sorted[0]!.toFixed(2)}, median ${median.toFixed(2)}, max ${sorted[sorted.length - 1]!.toFixed(2)}`);
    for (const c of BOOSTER_DRAFT[f]) {
      const stats = c.type === "Unit" ? ` ${c.attack}/${c.health}${c.keywords.length ? " " + c.keywords.join(",") : ""}` : c.type === "Tool" ? ` +${c.attackBonus}/+${c.healthBonus}` : c.type === "Command" ? ` ${c.speed}` : "";
      const rank = starter.filter((r) => r > cardRating(c)).length + 1;
      say(`  ${c.id} ${c.rarity.padEnd(8)} ${String(c.cost)} ${c.type.padEnd(9)} ${c.name.padEnd(18)}${stats.padEnd(14)} rating ${cardRating(c).toFixed(2).padStart(5)} (rank ${rank} of ${starter.length + 1} beside the starter cards)`);
      const text = c.modes ? c.modes.map((m) => `${m.name}: ${m.text}`).join(" | ") : c.abilities.map((a) => a.text).join(" ");
      if (text) say(`        ${text}`);
    }
  }
  say();

  // 2 and 3. The probe decks: legal, played, and against the field.
  say("== 2. The probe decks (each starter deck with its 7 booster cards in, buildDeck: copy limits, size, pool lint) ==");
  const probes = {} as Record<DeckFaction, Entry[]>;
  for (const f of FACTIONS) {
    const { pool, out } = probeDeck(f);
    const spec = buildDeck("p1", `${f} + boosters`, pool); // throws on any rule
    probes[f] = pool;
    const ins = BOOSTER_DRAFT[f].map((c) => `${PROBE_COPIES[c.rarity]}x ${c.name}`).join(", ");
    const counts = new Map<string, number>();
    for (const o of out) counts.set(o, (counts.get(o) ?? 0) + 1);
    say(`${f}: ${spec.cards.length} cards, legal. In: ${ins}.`);
    say(`  Out (lowest-rated starter copies): ${[...counts].map(([n, k]) => `${k}x ${n}`).join(", ")}.`);
    if (BOOSTER_DRAFT[f].some((c) => PROBE_COPIES[c.rarity] > COPY_LIMITS[c.rarity])) throw new Error("probe over a copy limit");
  }
  say();

  say("== 3. Against the four shipped decks (the probe deck, then the shipped deck itself on the same seeds) ==");
  say("deck                 vs Cortex  vs Swarm  vs Aegis  vs Null   overall [95%]          change");
  const usage: string[] = [];
  for (const f of FACTIONS) {
    const watch = new Set(BOOSTER_DRAFT[f].map((c) => c.name));
    const base = await gauntlet((id) => buildDeck(id, `${f} (shipped)`, shipped(f)), new Set());
    const probe = await gauntlet((id) => buildDeck(id, `${f} + boosters`, probes[f]), watch);
    const row = (name: string, t: Tally) =>
      `${name.padEnd(20)} ${FACTIONS.map((o) => pct(t.byOpp[o]).padStart(6) + "   ").join("")}${pct(t.wins / t.games).padStart(5)} ${wilson(t.wins, t.games).padEnd(13)}`;
    say(row(`${f} shipped`, base));
    say(row(`${f} + boosters`, probe) + `  ${((probe.wins - base.wins) / probe.games * 100 >= 0 ? "+" : "")}${pct((probe.wins - base.wins) / probe.games)}`);
    usage.push(`${f} (${probe.games} games):`);
    for (const c of BOOSTER_DRAFT[f]) {
      const fired = allAbilities(c).map((a) => (a.trigger === "static" ? `${a.id} static (live while in play)` : `${a.id} ${probe.fired.get(a.id) ?? 0}`)).join(", ");
      usage.push(`  ${c.name.padEnd(18)} played in ${String(probe.playedIn.get(c.name) ?? 0).padStart(4)} games (${pct((probe.playedIn.get(c.name) ?? 0) / probe.games).padStart(5)}%)${fired ? "; fired: " + fired : ""}`);
    }
  }
  say();
  say("== 4. Every booster card in play (games it was played in, and each ability's fires from the match log) ==");
  for (const u of usage) say(u);
  // A static ability logs no trigger (the engine reads it on every state
  // change), so it counts as working when its card was in play: the
  // engine's own tests cover each static kind.
  const all = FACTIONS.flatMap((f) => BOOSTER_DRAFT[f].flatMap((c) => allAbilities(c).map((a) => ({ c, a }))));
  const never = all.filter(({ c, a }) =>
    a.trigger === "static" ? !usage.some((u) => u.trimStart().startsWith(c.name) && !/played in +0 games/.test(u)) : !usage.some((u) => new RegExp(`${a.id} [1-9]`).test(u)),
  );
  say();
  say(
    never.length === 0
      ? `Every ability of every proposed card resolved in these games (${all.filter((x) => x.a.trigger !== "static").length} triggered/activated abilities fired; ${all.filter((x) => x.a.trigger === "static").length} statics were in play).`
      : `NEVER RESOLVED: ${never.map((x) => x.a.id).join(", ")}`,
  );
  if (LEAVE_ONE_OUT) {
    // 5. Leave one out: the full probe deck without one booster card (its
    // copies go back to the starter cards they replaced), so each card's
    // share of the full deck's gain shows, synergy included.
    say();
    say(`== 5. Leave one out (the full probe deck minus one booster card, ${GAMES} games against each shipped deck) ==`);
    say("deck                        overall [95%]          the card's share (full probe minus this)");
    for (const f of FACTIONS) {
      const full = await gauntlet((id) => buildDeck(id, `${f} + boosters`, probes[f]), new Set());
      say(`${(f + " + boosters").padEnd(26)}  ${pct(full.wins / full.games).padStart(5)} ${wilson(full.wins, full.games)}`);
      for (const c of BOOSTER_DRAFT[f]) {
        const { pool } = probeDeck(f, BOOSTER_DRAFT[f].filter((x) => x !== c));
        const t = await gauntlet((id) => buildDeck(id, `${f} - ${c.name}`, pool), new Set());
        const d = (full.wins - t.wins) / t.games;
        say(`  without ${c.name.padEnd(18)} ${pct(t.wins / t.games).padStart(5)} ${wilson(t.wins, t.games).padEnd(13)}  ${d >= 0 ? "+" : ""}${pct(d)}`);
      }
    }
  }
  if (CONTROL) {
    // 6. The control: the same probe decks (the same cuts), but every
    // booster card replaced by a blank Unit of its cost and rarity
    // (attack = cost, health = cost + 1, the deck builder's vanilla line, no
    // keyword, no ability). The gap
    // between this and the shipped deck is what the cuts and plain bodies
    // give on their own; the gap between this and the full probe is what
    // the booster cards' abilities add.
    say();
    say(`== 6. Control: the same cuts, blank bodies in place of the booster cards (${GAMES} games against each shipped deck) ==`);
    say("deck                        overall [95%]          change vs shipped   booster cards over the blanks");
    for (const f of FACTIONS) {
      const base = await gauntlet((id) => buildDeck(id, `${f} (shipped)`, shipped(f)), new Set());
      const full = await gauntlet((id) => buildDeck(id, `${f} + boosters`, probes[f]), new Set());
      const blanks = probes[f].map((e) => {
        // A booster card that draws stays as it is when the cuts took the
        // starter deck's only other draw card (the lint's card flow rule):
        // Aegis's Hardlight Shell, in place of Diagnostic Ward.
        if (!BOOSTER_DRAFT[f].includes(e.card as never) || (drawsCards(e.card) && !probes[f].some((q) => q.card.faction === f && !BOOSTER_DRAFT[f].includes(q.card as never) && drawsCards(q.card)))) return e;
        const c = e.card;
        const blank: Card = { id: `${c.id}-blank`, name: `Blank ${c.cost}-drop (${c.id})`, faction: f, rarity: c.rarity, cost: c.cost, type: "Unit", attack: c.cost, health: c.cost + 1, keywords: [], art: "placeholder:blank", flavor: "", abilities: [] };
        return { card: blank, copies: e.copies };
      });
      const t = await gauntlet((id) => buildDeck(id, `${f} blanks`, blanks), new Set());
      const d = (t.wins - base.wins) / t.games, g = (full.wins - t.wins) / t.games;
      say(`${(f + " blanks").padEnd(26)}  ${pct(t.wins / t.games).padStart(5)} ${wilson(t.wins, t.games).padEnd(13)}  ${(d >= 0 ? "+" : "") + pct(d)}`.padEnd(70) + `${g >= 0 ? "+" : ""}${pct(g)}`);
    }
  }
  if (!SINGLES) return;

  // 7. One card at a time: the starter deck with only that booster card in
  // (at PROBE_COPIES, out for the lowest-rated starter copies), against the
  // field, beside the shipped deck on the same seeds. Which single card
  // adds the most, and whether any one card is out of line.
  say();
  say(`== 7. One card at a time (the starter deck plus only that card, ${GAMES} games against each shipped deck) ==`);
  say("card                 copies  overall [95%]          change vs shipped (same seeds)");
  for (const f of FACTIONS) {
    const base = await gauntlet((id) => buildDeck(id, `${f} (shipped)`, shipped(f)), new Set());
    say(`${(f + " shipped").padEnd(20)}         ${pct(base.wins / base.games).padStart(5)} ${wilson(base.wins, base.games)}`);
    for (const c of BOOSTER_DRAFT[f]) {
      const { pool } = probeDeck(f, [c]);
      const t = await gauntlet((id) => buildDeck(id, `${f} + ${c.name}`, pool), new Set());
      const d = (t.wins - base.wins) / t.games;
      say(`  ${c.name.padEnd(18)} ${String(PROBE_COPIES[c.rarity]).padStart(4)}   ${pct(t.wins / t.games).padStart(5)} ${wilson(t.wins, t.games).padEnd(13)}  ${d >= 0 ? "+" : ""}${pct(d)}`);
    }
  }
}

await main();
