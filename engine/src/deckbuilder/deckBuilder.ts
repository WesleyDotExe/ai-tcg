// The deck-building agent (roadmap 2b; owner 2026-10-15: "the owner can
// force a specific deck or faction. Otherwise the agent picks the best
// faction and deck it can build from the cards the owner holds").
//
// Given what an owner holds (card id -> copies), it builds the strongest
// legal deck it can find for each faction it may play, measures each one by
// playing it, and picks the faction whose deck plays best. How:
//
//  1. Construct (no games): two starting decks from the owned cards, under
//     every deck rule (copy limits and what is owned, 1 per Zero-Day card,
//     at most 10 neutral cards, the pool lint's 25% removal share, a
//     faction card that draws, 20-40 cards) plus two rules of its own: no
//     evolution without its base, and the deck's size is the largest the
//     owned cards allow (`largestDeck`): 40 whenever the owner holds 40
//     usable cards, else every usable card (owner 2026-10-26, option B;
//     progress/deck-size-report-001.txt measured that a shorter deck of the
//     same cards wins more, so the builder never cuts one short).
//       - "rating": greedy by cardRating's prior, shaped to the shipped
//         decks' mana curve.
//       - "designed": the faction's shipped list (the set's designed deck)
//         as far as the owner holds it, its gaps filled the same greedy way
//         up to the same size (every designed list is 40 since session
//         60, so from a full collection the designed start is the shipped
//         list; an owner missing copies gets the gaps filled).
//     Two starts because neither prior is right everywhere: from a full
//     collection the rating deck beats the designed one in Cortex and
//     Aegis and loses to it in Swarm and Null (progress/
//     deckbuilder-report-001.txt), and from a big partial collection the
//     rating deck alone fell 13 points under the designed list the owner
//     could already play (economy-demo-014's first run).
//  2. Search (games): the start that plays best on the search's seeds is
//     changed a copy at a time (swap a card for an owned spare; the size
//     never changes, since session 58), each change played against the four shipped
//     decks on the same seeds as the current deck and kept only when it
//     wins clearly more of those games.
//  3. Confirm (games): the searched deck and both starts replay on fresh
//     seeds the search never saw, and the best of them is the faction's
//     deck, so a change that only fit the search's seeds can't stick. The
//     faction pick reads these fresh-seed results too.
//
// Every game is Lookahead against Lookahead, the agent every real match
// uses. The opponents are the shipped decks (the ring's decks), so "best"
// means "best against the designed decks of every faction, mirror
// included". The owner's play style (`options.style`; owner 2026-10-20:
// "the deck builder still builds with Calculator; making it use the agent's
// style is the next step") plays the built deck in the confirm step, so the
// deck kept is the one that style plays best; the shipped decks are always
// played by Calculator, the field every balance measurement uses. The
// search itself plays Calculator (`options.searchStyle`): measured session
// 53 (progress/deckbuilder-styles-report-001.txt), a search played in each
// style kept decks 2-3 points worse than Calculator's for every style,
// that style included, so the style's signal is smaller than the search's
// noise and only the larger confirm step should read it. Nothing here reads a card's name or id: a new set's cards are
// built with the day they exist. A forced deck is the store's business (it
// is a saved deck); a forced faction is `options.faction`.

import type { Card, DeckFaction, EffectSpec } from "../cards/types.js";
import { allAbilities } from "../cards/modes.js";
import { REMOVAL_DEBUFF_MAX_SHARE, isRemovalOrDebuffCard } from "../cards/poolLint.js";
import { buildDeck, COPY_LIMITS, MAX_DECK_SIZE, MAX_NEUTRAL_COPIES, MIN_DECK_SIZE, TOP_TIER_COPY_LIMIT } from "../data/decks.js";
import { CARD_REGISTRY, SHIPPED_DECK_LISTS, getCard } from "../data/registry.js";
import { LookaheadAgent } from "../agents/lookaheadAgent.js";
import { DEFAULT_PLAY_STYLE, type PlayStyleId } from "../agents/playStyles.js";
import { runMatch } from "../engine/match.js";
import type { DeckSpec } from "../state/init.js";
import { Rng } from "../state/rng.js";
import { cardRating } from "./cardRating.js";

export const DECK_FACTIONS: readonly DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];

/** The deck rules the builder holds itself to. The size range and the
 * removal share are the engine's own constants (data/decks.ts,
 * cards/poolLint.ts), imported rather than copied since session 55, so a
 * rule change reaches the builder; buildDeck re-checks every one of them on
 * the result. */
export const MIN_DECK = MIN_DECK_SIZE;
export const MAX_DECK = MAX_DECK_SIZE;
const REMOVAL_SHARE = REMOVAL_DEBUFF_MAX_SHARE;

/** What an owner holds: copies per card id. Ids the registry doesn't know
 * (a signature card, a reserved card) are ignored. */
export type Holdings = ReadonlyMap<string, number>;

/** A deck as card id -> copies. */
export type DeckList = Map<string, number>;

export interface DeckBuildOptions {
  /** Build only this faction (the owner's faction lock or forced faction). */
  faction?: DeckFaction;
  /** Games per shipped opponent in each search measurement. 0 skips the
   * search and the confirm step: the first deck is the answer, and the
   * faction is picked by its rating. */
  games?: number;
  /** One-copy changes tried per faction. */
  trials?: number;
  /** Games per shipped opponent in the confirm step (fresh seeds). */
  confirmGames?: number;
  /** The search's first seed; the confirm seeds start 1,000,000 later. */
  seed?: number;
  /** The play style the built deck is played in, in every game (the
   * owner's agent's style). Calculator by default; the shipped opponents
   * always play Calculator. */
  style?: PlayStyleId;
  /** The play style the search (step 2) plays the deck in. Calculator by
   * default, whatever `style` is (see the header). */
  searchStyle?: PlayStyleId;
  /** Keep the designed start unless another deck beats it by more than
   * noise on the confirm step (owner 2026-11-03, session 71's call 1; TEST
   * ONLY until the owner approves it for the store, so off by default). The
   * number is the margin in standard deviations of a paired sign test on
   * the confirm seeds: a challenger must win `keepDesigned` x sqrt(d) more
   * of the d seeds where the two decks' games came out differently than the
   * designed start does, and at least 2 more. Without a designed start (it
   * can't be built, or it is the rating start's list) nothing changes. */
  keepDesigned?: number;
  /** Narrates the build, one line per step. */
  log?: (line: string) => void;
}

export interface GauntletScore {
  games: number;
  wins: number;
  /** Win rate against each shipped deck. */
  byOpponent: Record<DeckFaction, number>;
}

/** Where a start came from (see the header). */
export type StartKind = "rating" | "designed";

export interface FactionBuild {
  faction: DeckFaction;
  /** Why the faction can't be built, if it can't. */
  infeasible?: string;
  /** The starting decks, each with its fresh-seed result when games ran
   * (the designed start is left out when it can't be built or is the
   * rating start's list). */
  starts: { from: StartKind; list: DeckList; score?: GauntletScore }[];
  /** The start the search began from (the better one on the search seeds). */
  searchedFrom?: StartKind;
  /** What the faction plays: the best of the searched deck and the starts
   * on fresh seeds ("searched" when the search's deck won). */
  deck?: DeckList;
  chosen?: StartKind | "searched";
  /** Fresh-seed result of `deck` (the confirm step), when games ran. */
  score?: GauntletScore;
  /** With `keepDesigned`: the deck the plain rule (the most confirm wins)
   * would have kept, and the paired test against the designed start that
   * decided it. Absent when the option is off or the plain rule already
   * kept the designed start. */
  keepDesigned?: { plain: StartKind | "searched"; plainWins: number; designedWins: number; gained: number; lost: number; margin: number; kept: "designed" | "plain" };
  /** The changes the search kept, in order ("-1 X +1 Y: 52 -> 61 of 160"). */
  kept: string[];
  tried: number;
}

export interface BuiltDeck {
  faction: DeckFaction;
  /** The play style every game was played in. */
  style: PlayStyleId;
  list: DeckList;
  spec: DeckSpec;
  /** Every faction considered, the picked one included. */
  factions: FactionBuild[];
}

/** Every card that may go in a `faction` deck: that faction's cards, the
 * neutral pool and the Zero-Day cards. */
function eligible(card: Card, faction: DeckFaction): boolean {
  return card.faction === faction || card.faction === "Neutral";
}

function isNeutral(card: Card): boolean {
  return card.faction === "Neutral";
}

/** The most copies of `card` a deck may hold given `owned`. */
export function playableCopies(card: Card, owned: number): number {
  const limit = card.topTier ? TOP_TIER_COPY_LIMIT : COPY_LIMITS[card.rarity];
  return Math.max(0, Math.min(owned, limit));
}

function* walk(effects: readonly EffectSpec[]): Generator<EffectSpec> {
  for (const e of effects) {
    yield e;
    if (e.kind === "conditional") {
      yield* walk(e.then);
      if (e.else) yield* walk(e.else);
    }
  }
}

/** A card that draws (the pool lint's card flow). */
export function drawsCards(card: Card): boolean {
  return allAbilities(card).some((a) => [...walk(a.effects ?? [])].some((e) => e.kind === "drawCard"));
}

function size(list: DeckList): number {
  let n = 0;
  for (const c of list.values()) n += c;
  return n;
}

/** A list's cards in card-id order, so the same list always builds the
 * same DeckSpec (the deck's order seeds its shuffle). */
function cardsOf(list: DeckList): { card: Card; copies: number }[] {
  return [...list]
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, copies]) => ({ card: getCard(id)!, copies }));
}

/** Why `list` breaks a deck rule for `faction`, or undefined if it is legal
 * (by the builder's rules, which include the engine's). */
export function listProblem(list: DeckList, faction: DeckFaction, holdings: Holdings): string | undefined {
  const n = size(list);
  if (n < MIN_DECK || n > MAX_DECK) return `${n} cards, outside ${MIN_DECK}-${MAX_DECK}`;
  let neutral = 0;
  let removal = 0;
  let flow = false;
  let clock = false;
  for (const { card, copies } of cardsOf(list)) {
    if (!eligible(card, faction)) return `${card.name} is not a ${faction} or Neutral card`;
    if (copies > playableCopies(card, holdings.get(card.id) ?? 0)) return `${copies} copies of ${card.name}, more than allowed or owned`;
    if (isNeutral(card)) neutral += copies;
    if (isRemovalOrDebuffCard(card)) removal += copies;
    if (!isNeutral(card) && drawsCards(card)) flow = true;
    if (!isNeutral(card) && card.type === "Unit" && card.attack > 0) clock = true;
    if (card.type === "Unit" && card.evolvesFrom && !(list.get(card.evolvesFrom) ?? 0)) return `${card.name} without its base`;
  }
  if (neutral > MAX_NEUTRAL_COPIES) return `${neutral} neutral cards, over ${MAX_NEUTRAL_COPIES}`;
  if (removal > REMOVAL_SHARE * n) return `${removal} removal cards of ${n}, over ${REMOVAL_SHARE * 100}%`;
  if (!flow) return "no faction card that draws";
  if (!clock) return "no faction unit that attacks";
  return undefined;
}

/** The shipped decks' average share of cards at each cost (6 = 6 or more):
 * the curve the first deck is shaped to. */
const CURVE: readonly number[] = (() => {
  const share = [0, 0, 0, 0, 0, 0, 0];
  for (const f of DECK_FACTIONS) {
    const list = SHIPPED_DECK_LISTS[f];
    const total = list.reduce((s, e) => s + e.copies, 0);
    for (const e of list) share[Math.min(6, getCard(e.cardId)!.cost)]! += e.copies / total / DECK_FACTIONS.length;
  }
  return share;
})();

function bucket(card: Card): number {
  return Math.min(6, card.cost);
}

/** The cards `holdings` lets a `faction` deck use, best rating first. */
function candidates(faction: DeckFaction, holdings: Holdings): Card[] {
  const out: Card[] = [];
  for (const [id, owned] of holdings) {
    const card = getCard(id);
    if (!card || !eligible(card, faction) || playableCopies(card, owned) === 0) continue;
    out.push(card);
  }
  return out.sort((a, b) => cardRating(b) - cardRating(a) || a.id.localeCompare(b.id));
}

/**
 * The most cards a legal `faction` deck can hold from `holdings`, at most
 * 40: the size every deck the builder makes has (owner 2026-10-26, option
 * B). Below MIN_DECK no deck can be built. Every usable copy counts except
 * an evolution whose base can't go in, under the two caps that bind a
 * size: at most 10 neutral cards, filled with non-removal ones first (each
 * of those also raises the removal allowance), and removal at most 25% of
 * the deck. The flow and clock rules need one card each and don't limit
 * the size.
 */
export function largestDeck(faction: DeckFaction, holdings: Holdings): number {
  const pool = candidates(faction, holdings);
  const ids = new Set(pool.map((c) => c.id));
  const usable = (c: Card, depth = 0): boolean =>
    !(c.type === "Unit" && c.evolvesFrom) || (depth < 8 && ids.has(c.evolvesFrom) && usable(getCard(c.evolvesFrom)!, depth + 1));
  const n = { factionPlain: 0, factionRemoval: 0, neutralPlain: 0, neutralRemoval: 0 };
  for (const card of pool) {
    if (!usable(card)) continue;
    const copies = playableCopies(card, holdings.get(card.id) ?? 0);
    const key = `${isNeutral(card) ? "neutral" : "faction"}${isRemovalOrDebuffCard(card) ? "Removal" : "Plain"}` as keyof typeof n;
    n[key] += copies;
  }
  const neutralPlain = Math.min(MAX_NEUTRAL_COPIES, n.neutralPlain);
  const neutralRemoval = Math.min(MAX_NEUTRAL_COPIES - neutralPlain, n.neutralRemoval);
  const plain = n.factionPlain + neutralPlain;
  // removal <= share * (plain + removal)  <=>  removal <= plain * share / (1 - share)
  const removal = Math.min(n.factionRemoval + neutralRemoval, Math.floor((plain * REMOVAL_SHARE) / (1 - REMOVAL_SHARE) + 1e-9));
  return Math.min(MAX_DECK, plain + removal);
}

/**
 * The greedy first deck for `faction` from `holdings`, or the reason none
 * can be built. Picks the best-rated faction card that draws first (the
 * lint needs one), then fills each cost bucket toward the shipped curve
 * with the best-rated cards that fit, then fills to `largestDeck` by
 * rating. A card is added only while the list stays within the rules that
 * adding can break (copies, neutral cap, removal share of that size,
 * evolution base). A deck that can't reach that size is not built.
 *
 * With a `start` list (the designed start), the list goes in first and only
 * its gaps are filled, to the same size. (Session 54 filled it to the
 * start's own size instead, so a full collection's Null start was its
 * 36-card designed list; the owner's option B, 2026-10-26, makes every
 * built deck 40 when 40 usable cards are held, Null's included.)
 */
export function constructDeck(faction: DeckFaction, holdings: Holdings, start?: DeckList): { list: DeckList } | { infeasible: string } {
  const pool = candidates(faction, holdings);
  const list: DeckList = new Map();
  const target = largestDeck(faction, holdings);
  if (target < MIN_DECK) return { infeasible: `can't build a legal deck from the owned cards (at most ${target} usable cards, under ${MIN_DECK})` };
  const removalCap = Math.floor(REMOVAL_SHARE * target);
  const count = { neutral: 0, removal: 0 };
  const byBucket = [0, 0, 0, 0, 0, 0, 0];
  const canAdd = (card: Card): boolean => {
    const have = list.get(card.id) ?? 0;
    if (have >= playableCopies(card, holdings.get(card.id) ?? 0)) return false;
    if (size(list) >= target) return false;
    if (isNeutral(card) && count.neutral >= MAX_NEUTRAL_COPIES) return false;
    if (isRemovalOrDebuffCard(card) && count.removal >= removalCap) return false;
    if (card.type === "Unit" && card.evolvesFrom && !(list.get(card.evolvesFrom) ?? 0)) return false;
    return true;
  };
  const add = (card: Card): void => {
    list.set(card.id, (list.get(card.id) ?? 0) + 1);
    if (isNeutral(card)) count.neutral++;
    if (isRemovalOrDebuffCard(card)) count.removal++;
    byBucket[bucket(card)]!++;
  };

  // A starting list goes in first, as far as it fits (again until nothing
  // more does, so an evolution listed before its base still goes in).
  if (start) {
    let more = true;
    while (more) {
      more = false;
      for (const [id, n] of start) {
        const card = getCard(id);
        if (!card || !eligible(card, faction)) continue;
        while ((list.get(id) ?? 0) < n && canAdd(card)) {
          add(card);
          more = true;
        }
      }
    }
  }

  // The best faction card that draws, with its base first if it evolves.
  const baseOf = (c: Card): Card | undefined => (c.type === "Unit" && c.evolvesFrom ? pool.find((b) => b.id === c.evolvesFrom) : undefined);
  const flow = pool.find((c) => !isNeutral(c) && drawsCards(c) && (!(c.type === "Unit" && c.evolvesFrom) || baseOf(c) !== undefined));
  if (!flow) return { infeasible: "no owned faction card that draws (the pool lint needs one)" };
  if (![...list.keys()].some((id) => !isNeutral(getCard(id)!) && drawsCards(getCard(id)!))) {
    const flowBase = baseOf(flow);
    if (flowBase && canAdd(flowBase)) add(flowBase);
    if (canAdd(flow)) add(flow);
  }

  // Fill toward the curve, best cards first, a copy at a time so the best
  // card in a bucket gets every copy before the next one. An evolution's
  // base may sit later in the rating, so loop until nothing more fits.
  let grew = true;
  while (grew) {
    grew = false;
    for (const card of pool) {
      const b = bucket(card);
      while (byBucket[b]! < Math.round(CURVE[b]! * target) && canAdd(card)) {
        add(card);
        grew = true;
      }
    }
  }
  // Then fill to the target by rating alone (again until nothing more fits).
  const fill = (): void => {
    let more = true;
    while (more && size(list) < target) {
      more = false;
      for (const card of pool) {
        while (canAdd(card)) {
          add(card);
          more = true;
        }
      }
    }
  };
  fill();
  // A neutral removal card can fill a neutral slot a plain neutral card
  // should have: it spends a removal slot too, so the deck stops short of
  // the target. Swap the lowest-rated one for the best plain neutral spare
  // and fill again, until the target is reached or no such swap is left.
  while (size(list) < target && count.neutral >= MAX_NEUTRAL_COPIES) {
    const out = cardsOf(list)
      .filter(({ card }) => isNeutral(card) && isRemovalOrDebuffCard(card))
      .sort((a, b) => cardRating(a.card) - cardRating(b.card) || a.card.id.localeCompare(b.card.id))[0];
    const spare = pool.find((c) => isNeutral(c) && !isRemovalOrDebuffCard(c) && (list.get(c.id) ?? 0) < playableCopies(c, holdings.get(c.id) ?? 0));
    if (!out || !spare) break;
    const n = list.get(out.card.id)! - 1;
    if (n > 0) list.set(out.card.id, n);
    else list.delete(out.card.id);
    count.neutral--;
    count.removal--;
    byBucket[bucket(out.card)]!--;
    add(spare);
    fill();
  }
  // A safety net: the removal cap above is the target's share, so this
  // only acts if the fill went past it (found session 54, when the cap was
  // a full 40's: a Null owner's day-one collection stopped at 37 cards with
  // 10 removal). Take out the lowest-rated removal copies until it holds.
  const removalIn = () => cardsOf(list).filter(({ card }) => isRemovalOrDebuffCard(card));
  while (count.removal > REMOVAL_SHARE * size(list) && size(list) > MIN_DECK) {
    const isBase = (id: string) => [...list.keys()].some((k) => { const c = getCard(k)!; return c.type === "Unit" && c.evolvesFrom === id; });
    const out = removalIn()
      .filter(({ card }) => !isBase(card.id))
      .sort((a, b) => cardRating(a.card) - cardRating(b.card) || a.card.id.localeCompare(b.card.id))[0];
    if (!out) break;
    const n = list.get(out.card.id)! - 1;
    if (n > 0) list.set(out.card.id, n);
    else list.delete(out.card.id);
    count.removal--;
    if (isNeutral(out.card)) count.neutral--;
  }
  const problem = listProblem(list, faction, holdings);
  if (problem) return { infeasible: `can't build a legal deck from the owned cards (${problem})` };
  if (size(list) !== target) return { infeasible: `built ${size(list)} cards, short of the ${target} the owned cards allow` };
  return { list };
}

/** The deck list as a playable DeckSpec (through buildDeck, which enforces
 * every engine deck rule again). */
export function deckSpec(list: DeckList, id: DeckSpec["id"], name: string): DeckSpec {
  return buildDeck(id, name, cardsOf(list));
}

const SHIPPED_SPECS: Record<DeckFaction, (id: DeckSpec["id"]) => DeckSpec> = Object.fromEntries(
  DECK_FACTIONS.map((f) => [
    f,
    (id: DeckSpec["id"]) =>
      buildDeck(
        id,
        `${f} (shipped)`,
        SHIPPED_DECK_LISTS[f].map((e) => ({ card: getCard(e.cardId)!, copies: e.copies })),
      ),
  ]),
) as Record<DeckFaction, (id: DeckSpec["id"]) => DeckSpec>;

/** One game per seed against each shipped deck: true where `list` won.
 * The deck goes first on odd seeds. The same seeds give the same games to
 * any two lists, so two lists' results compare game by game. `style` is
 * how the list is played (the shipped decks play Calculator); Calculator
 * plays exactly the games it played before styles existed. */
export async function playGauntlet(
  list: DeckList,
  firstSeed: number,
  games: number,
  style: PlayStyleId = DEFAULT_PLAY_STYLE,
): Promise<{ results: boolean[]; score: GauntletScore }> {
  const results: boolean[] = [];
  const byOpponent = {} as Record<DeckFaction, number>;
  for (const opponent of DECK_FACTIONS) {
    let wins = 0;
    for (let seed = firstSeed; seed < firstSeed + games; seed++) {
      const mine = deckSpec(list, "p1", "Built deck");
      const theirs = SHIPPED_SPECS[opponent]("p2");
      const a = new LookaheadAgent("Builder", seed * 104729 + 31, { style });
      const b = new LookaheadAgent(`Shipped-${opponent}`, seed * 104729 + 31);
      const first = seed % 2 === 1;
      const { state } = first ? await runMatch(mine, { ...theirs, id: "p2" }, a, b, seed) : await runMatch({ ...theirs, id: "p1" }, { ...mine, id: "p2" }, b, a, seed);
      const won = state.winner === (first ? "p1" : "p2");
      results.push(won);
      if (won) wins++;
    }
    byOpponent[opponent] = wins / games;
  }
  const wins = results.filter(Boolean).length;
  return { results, score: { games: results.length, wins, byOpponent } };
}

/** A one-copy change to a deck list. */
interface Change {
  out?: string;
  in?: string;
}

function describe(change: Change): string {
  const parts: string[] = [];
  if (change.out) parts.push(`-1 ${getCard(change.out)!.name}`);
  if (change.in) parts.push(`+1 ${getCard(change.in)!.name}`);
  return parts.join(" ");
}

function apply(list: DeckList, change: Change): DeckList {
  const next = new Map(list);
  if (change.out) {
    const n = (next.get(change.out) ?? 0) - 1;
    if (n > 0) next.set(change.out, n);
    else next.delete(change.out);
    // Taking out an evolution's last base takes its evolutions out too.
    if (n <= 0) {
      for (const [id] of next) {
        const c = getCard(id)!;
        if (c.type === "Unit" && c.evolvesFrom === change.out) next.delete(id);
      }
    }
  }
  if (change.in) next.set(change.in, (next.get(change.in) ?? 0) + 1);
  return next;
}

/** Proposes the next change to try: alternately the "obvious" swap (the
 * lowest-rated card in the deck for the best-rated owned spare, walking
 * down both lists as earlier pairs are used) and a random one. Every
 * change keeps the deck's size (session 58: the size is `largestDeck`'s;
 * before, one change in five grew or shrank the deck by a card, and with
 * nothing pushing it back up the kept decks drifted 1-5 cards short). */
function* proposals(faction: DeckFaction, holdings: Holdings, rng: Rng, current: () => DeckList): Generator<Change> {
  const tried = new Set<string>();
  const key = (c: Change) => `${c.out ?? ""}>${c.in ?? ""}`;
  for (let step = 0; step < 10_000; step++) {
    const list = current();
    const inDeck = [...list.keys()].sort((a, b) => cardRating(getCard(a)!) - cardRating(getCard(b)!) || a.localeCompare(b));
    const spares = candidates(faction, holdings).filter((c) => (list.get(c.id) ?? 0) < playableCopies(c, holdings.get(c.id) ?? 0)).map((c) => c.id);
    const options: Change[] = [];
    if (step % 2 === 0) {
      for (const out of inDeck) for (const id of spares) if (out !== id) options.push({ out, in: id });
    } else {
      const outs = rng.shuffle(inDeck);
      const ins = rng.shuffle(spares);
      for (const out of outs) for (const id of ins) if (out !== id) options.push({ out, in: id });
    }
    // Taking out an evolution's last base takes the evolution out too,
    // which would shrink the deck: not a swap.
    const next = options.find((c) => !tried.has(key(c)) && size(apply(list, c)) === size(list) && listProblem(apply(list, c), faction, holdings) === undefined);
    if (!next) continue;
    tried.add(key(next));
    yield next;
  }
}

/** The build's sizes when the options leave them out: what the store's
 * agent deck is built with. */
export const DEFAULT_BUILD = { games: 40, trials: 24, confirmGames: 100, seed: 1 } as const;

/** Builds, searches and confirms one faction's deck. */
export async function buildFaction(faction: DeckFaction, holdings: Holdings, options: DeckBuildOptions = {}): Promise<FactionBuild> {
  const log = options.log ?? (() => {});
  const games = options.games ?? DEFAULT_BUILD.games;
  const trials = options.trials ?? DEFAULT_BUILD.trials;
  const confirmGames = options.confirmGames ?? DEFAULT_BUILD.confirmGames;
  const seed = options.seed ?? DEFAULT_BUILD.seed;
  const style = options.style ?? DEFAULT_PLAY_STYLE;
  const searchStyle = options.searchStyle ?? DEFAULT_PLAY_STYLE;
  // Either start alone is enough: one that can't be built is left out.
  const built = constructDeck(faction, holdings);
  const designed = constructDeck(faction, holdings, shippedList(faction));
  const starts: FactionBuild["starts"] = [];
  if ("list" in built) starts.push({ from: "rating", list: built.list });
  if ("list" in designed && !("list" in built && sameList(designed.list, built.list))) starts.push({ from: "designed", list: designed.list });
  if (starts.length === 0) {
    const why = "infeasible" in built ? built.infeasible : "no legal start";
    log(`${faction}: ${why}`);
    return { faction, infeasible: why, starts: [], kept: [], tried: 0 };
  }
  log(`${faction}: starts ${starts.map((st) => `${st.from} ${size(st.list)} cards`).join(", ")}`);
  if (games === 0) return { faction, starts, deck: starts[0]!.list, chosen: starts[0]!.from, kept: [], tried: 0 };

  // Search from the start that plays best on the search's seeds.
  let from = starts[0]!;
  let base = await playGauntlet(from.list, seed, games, searchStyle);
  for (const st of starts.slice(1)) {
    const g = await playGauntlet(st.list, seed, games, searchStyle);
    if (g.score.wins > base.score.wins) {
      from = st;
      base = g;
    }
  }
  log(`${faction}: searching from the ${from.from} start (${base.score.wins} of ${base.score.games})`);
  let list = from.list;
  const rng = new Rng(seed * 7919 + DECK_FACTIONS.indexOf(faction));
  const kept: string[] = [];
  let tried = 0;
  const gen = proposals(faction, holdings, rng, () => list);
  for (; tried < trials; tried++) {
    const next = gen.next();
    if (next.done) break;
    const change = next.value;
    const candidate = apply(list, change);
    const trial = await playGauntlet(candidate, seed, games, searchStyle);
    // Paired: only the seeds where the two lists' games came out
    // differently say anything. Keep the change when it wins at least one
    // standard deviation more of those (sign test), and at least 2 more.
    let gained = 0;
    let lost = 0;
    trial.results.forEach((w, i) => {
      if (w && !base.results[i]) gained++;
      if (!w && base.results[i]) lost++;
    });
    const margin = Math.max(2, Math.sqrt(gained + lost));
    if (gained - lost >= margin) {
      const line = `${describe(change)}: ${base.score.wins} -> ${trial.score.wins} of ${trial.score.games}`;
      kept.push(line);
      log(`${faction}: kept ${line}`);
      list = candidate;
      base = trial;
    }
  }

  // Confirm on seeds the search never played: the searched deck and every
  // start; the best wins (the searched deck on a tie, then the earlier start).
  const fresh = seed + 1_000_000;
  const confirmResults = new Map<FactionBuild["starts"][number], boolean[]>();
  for (const st of starts) {
    const g = await playGauntlet(st.list, fresh, confirmGames, style);
    st.score = g.score;
    confirmResults.set(st, g.results);
  }
  const searchedGame = kept.length === 0 ? undefined : await playGauntlet(list, fresh, confirmGames, style);
  const searched = searchedGame ? searchedGame.score : from.score!;
  const searchedResults = searchedGame ? searchedGame.results : confirmResults.get(from)!;
  let best: { chosen: StartKind | "searched"; list: DeckList; score: GauntletScore; results: boolean[] } = { chosen: kept.length === 0 ? from.from : "searched", list, score: searched, results: searchedResults };
  for (const st of starts) if (st.score!.wins > best.score.wins) best = { chosen: st.from, list: st.list, score: st.score!, results: confirmResults.get(st)! };
  // The designed start is the incumbent: a challenger replaces it only by
  // more than noise (the same paired sign test as the search, at the
  // option's margin), so a deck that only fits the shipped field's seeds
  // by a few games can't push the set's designed deck out.
  let keepDesignedNote: FactionBuild["keepDesigned"];
  const designedStart = starts.find((st) => st.from === "designed");
  if (options.keepDesigned !== undefined && designedStart && best.chosen !== "designed") {
    const d = confirmResults.get(designedStart)!;
    let gained = 0;
    let lost = 0;
    best.results.forEach((w, i) => {
      if (w && !d[i]) gained++;
      if (!w && d[i]) lost++;
    });
    const margin = Math.max(2, options.keepDesigned * Math.sqrt(gained + lost));
    const beats = gained - lost >= margin;
    keepDesignedNote = { plain: best.chosen, plainWins: best.score.wins, designedWins: designedStart.score!.wins, gained, lost, margin: Math.round(margin * 10) / 10, kept: beats ? "plain" : "designed" };
    log(`${faction}: ${best.chosen} vs designed on the confirm seeds: +${gained} -${lost} (needs +${keepDesignedNote.margin} net): ${beats ? `${best.chosen} beats it` : "designed deck kept"}`);
    if (!beats) best = { chosen: "designed", list: designedStart.list, score: designedStart.score!, results: d };
  }
  log(
    `${faction}: fresh seeds, ${starts.map((st) => `${st.from} ${st.score!.wins}`).join(", ")}, searched ${searched.wins} (of ${searched.games}): ${best.chosen} deck kept`,
  );
  return {
    faction,
    starts,
    searchedFrom: from.from,
    deck: best.list,
    chosen: best.chosen,
    score: best.score,
    kept: best.chosen === "searched" ? kept : [],
    tried,
    ...(keepDesignedNote ? { keepDesigned: keepDesignedNote } : {}),
  };
}

function sameList(a: DeckList, b: DeckList): boolean {
  if (a.size !== b.size) return false;
  for (const [id, n] of a) if (b.get(id) !== n) return false;
  return true;
}

/** The average rating of a list's cards: the faction pick when no games run. */
function meanRating(list: DeckList): number {
  let total = 0;
  for (const [id, n] of list) total += cardRating(getCard(id)!) * n;
  return total / size(list);
}

/**
 * The deck-building agent: the best deck `holdings` can build for
 * `options.style`, in the forced faction or, without one, in whichever
 * faction that style plays best on the confirm step's fresh seeds (ties go to the earlier faction in
 * DECK_FACTIONS). Throws when no faction can be built.
 */
export async function chooseDeck(holdings: Holdings, options: DeckBuildOptions = {}): Promise<BuiltDeck> {
  const factions = options.faction ? [options.faction] : DECK_FACTIONS;
  const builds: FactionBuild[] = [];
  for (const f of factions) builds.push(await buildFaction(f, holdings, options));
  const feasible = builds.filter((b) => b.deck);
  if (feasible.length === 0) {
    throw new Error(`no deck can be built: ${builds.map((b) => `${b.faction}: ${b.infeasible}`).join("; ")}`);
  }
  const value = (b: FactionBuild) => (b.score ? b.score.wins / b.score.games : meanRating(b.deck!));
  const best = feasible.reduce((a, b) => (value(b) > value(a) ? b : a));
  return { faction: best.faction, style: options.style ?? DEFAULT_PLAY_STYLE, list: best.deck!, spec: deckSpec(best.deck!, "p1", `${best.faction} (built)`), factions: builds };
}

/** Holdings as copies per card id, from any list of owned card ids (one
 * entry per copy). */
export function holdingsOf(cardIds: Iterable<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of cardIds) if (CARD_REGISTRY.has(id)) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

/**
 * What the builder can see of `holdings`: each card a deck of `faction`
 * (of any faction when none is given) may use, at most its deck limit.
 * Copies past a card's limit and cards of other factions never reach a
 * deck, so `chooseDeck` builds the same decks from this as from the whole
 * holdings (pinned by a test). The store reads it to tell whether a change
 * in the cards held can change the agent's deck (session 55).
 */
export function playableHoldings(holdings: Holdings, faction?: DeckFaction): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, owned] of holdings) {
    const card = getCard(id);
    if (!card || (faction && !eligible(card, faction))) continue;
    const n = playableCopies(card, owned);
    if (n > 0) out.set(id, n);
  }
  return out;
}

/** A faction's shipped deck as a deck list. */
export function shippedList(faction: DeckFaction): DeckList {
  return new Map(SHIPPED_DECK_LISTS[faction].map((e) => [e.cardId, e.copies]));
}

/** A full collection: every live card at its deck limit. */
export function fullHoldings(): Map<string, number> {
  const out = new Map<string, number>();
  for (const card of CARD_REGISTRY.values()) out.set(card.id, playableCopies(card, Infinity));
  return out;
}

/** The cards in a list, for printing: "2x Name" lines by cost. */
export function formatList(list: DeckList): string[] {
  return cardsOf(list)
    .sort((a, b) => a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name))
    .map(({ card, copies }) => `${copies}x ${card.name} (${card.faction} ${card.type} ${card.cost}, ${card.rarity})`);
}
