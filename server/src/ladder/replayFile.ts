// Replay files, versioned (session 70, the hardening pass; owner 2026-11-02
// call 6: "replays carry the card and rule versions they were played under,
// old ones stay rebuildable", before any card or rule change ships).
//
// `ai-tcg-replay/2` (written from session 70) is self-contained: the rules
// version and the card version the match was played under, and the full
// definition of every card the two decks hold. A card whose text changes in
// a later set, or a new rules version, can't change what an old file plays:
// it rebuilds from its own cards and its own rules.
//
// `ai-tcg-replay/1` (sessions 67-69) named cards by id only. Those ids mean
// the frozen `cards-1` snapshot (engine/src/data/cardSnapshots/cards1.ts),
// the cards as they stood for every /1 file, and the rules `rules-1`: an /1
// file rebuilds the same forever too.
//
// Everything that reads a replay (the owner API's tests and demos, the
// render's match pages) goes through `replaySetup` / `rebuildReplay`, so
// both formats read the same way everywhere.
//
// Rules: an /1 file and every /2 file written before session 71 name
// rules-1 (both on 20); from session 71 the ladder writes rules-2 (the
// second seat on 24). Each version's rules are explicit in the engine, so
// both keep rebuilding as they were played.

import {
  canonicalJson,
  CARDS_1_BY_ID,
  cardSetDigest,
  CURRENT_RULES_VERSION,
  getCard,
  MATCH_RULES_FIELDS,
  publishedCardsVersion,
  secondSeatExtraHealth,
  replayMatch,
  rulesOfVersion,
  rulesVersionOf,
  type Card,
  type DeckSpec,
  type MatchHooks,
  type MatchResult,
  type MatchRules,
  type Move,
  type PlayerId,
  type UnitCard,
} from "@ai-tcg/engine";

/** The format every replay is written in today. */
export const REPLAY_FORMAT = "ai-tcg-replay/2";
/** Every format a replay can be read in, oldest first. */
export const READABLE_REPLAY_FORMATS = ["ai-tcg-replay/1", "ai-tcg-replay/2"] as const;
export type ReplayFormat = (typeof READABLE_REPLAY_FORMATS)[number];

/** A deck as the replay keeps it: card ids, one per copy, in list order,
 * and the signature card in full (it is the agent's own, generated card, in
 * no registry). */
export interface ReplayDeck {
  name: string;
  cardIds: string[];
  signature: UnitCard | null;
}

export interface ReplayResult {
  outcome: string;
  winner: PlayerId | "draw" | null;
  turns: number;
  moves: number;
  finalHealth: { p1: number; p2: number };
}

interface ReplayCommon {
  matchId: string;
  seed: number;
  names: { p1: string; p2: string };
  decks: { p1: ReplayDeck; p2: ReplayDeck };
  moves: Move[];
  result: ReplayResult;
  /** (v20) The coin each side flipped. Cosmetic only: who went first is the
   * server's coin flip. Absent in /1 files written before session 69. */
  coins?: { p1: string; p2: string };
}

/** Sessions 67-69. Card ids mean the frozen `cards-1`; the rules `rules-1`. */
export interface ReplayFileV1 extends ReplayCommon {
  format: "ai-tcg-replay/1";
}

/** Session 70 on: self-contained. */
export interface ReplayFileV2 extends ReplayCommon {
  format: "ai-tcg-replay/2";
  versions: {
    /** The rules version it was played under (engine RULES_VERSIONS), or
     * "measure" for a measuring instrument's seat variant (then `rules`
     * holds it). */
    rules: string;
    /** The published card version the game was on (engine CARDS_VERSIONS),
     * or null when a deck held a card that isn't that version's (a test
     * card, a card from a set not yet published). The file's own `cards`
     * are what it plays either way. */
    cards: string | null;
    /** `cardSetDigest` of this file's `cards`: a reader can check them. */
    cardsDigest: string;
  };
  /** Every distinct card the decks hold (not the signatures, which are in
   * their decks), in full, sorted by id. */
  cards: Card[];
  /** Only with `versions.rules` "measure": the seat variant played. */
  rules?: MatchRules;
}

/** A replay file in a format this server reads. */
export type ReplayFile = ReplayFileV1 | ReplayFileV2;

/** What the engine needs to rebuild a replay. */
export interface ReplaySetup {
  format: ReplayFormat;
  decks: { p1: DeckSpec; p2: DeckSpec };
  names: { p1: string; p2: string };
  seed: number;
  moves: readonly Move[];
  /** The start-of-match rules, as `replayMatch` takes them (undefined: the
   * base rules). */
  rules: MatchRules | undefined;
  /** The versions it was played under (an /1 file's are implied). */
  rulesVersion: string;
  cardsVersion: string | null;
}

// ---------------------------------------------------------------------------
// Writing

/** The replay file for a match just played: today's format, with the
 * versions the game is on and every deck card in full. `rules` is the
 * measuring instruments' seat variant, if any (never set for a match the
 * game plays). */
export function makeReplayFile(
  rest: Omit<ReplayCommon, "decks">,
  specs: { p1: DeckSpec; p2: DeckSpec },
  rules?: MatchRules,
): ReplayFileV2 {
  const cards = new Map<string, Card>();
  for (const spec of [specs.p1, specs.p2]) {
    for (const c of spec.cards) {
      const seen = cards.get(c.id);
      if (seen && canonicalJson(seen) !== canonicalJson(c)) throw new Error(`two different cards share the id "${c.id}" in one match`);
      cards.set(c.id, structuredClone(c));
    }
  }
  const list = [...cards.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // The card version is the game's only if every card is that version's
  // card exactly; anything else is played from the file's own cards with no
  // published version to name.
  const version = publishedCardsVersion();
  const published =
    version !== null &&
    list.every((c) => {
      const reg = getCard(c.id);
      return reg !== undefined && canonicalJson(reg) === canonicalJson(c);
    });
  // A match played under an older published version (a tool replaying
  // rules-1) names that version; only a variant that is no version is
  // "measure" and carries its rules.
  const rulesId = rulesVersionOf(rules);
  const measuring = rulesId === null;
  return {
    format: REPLAY_FORMAT,
    versions: {
      rules: rulesId ?? "measure",
      cards: published ? version : null,
      cardsDigest: cardSetDigest(list),
    },
    matchId: rest.matchId,
    seed: rest.seed,
    names: rest.names,
    cards: list,
    decks: { p1: replayDeck(specs.p1), p2: replayDeck(specs.p2) },
    moves: rest.moves,
    result: rest.result,
    ...(rest.coins ? { coins: rest.coins } : {}),
    ...(measuring ? { rules: explicitRules(rules!) } : {}),
  };
}

/** A measuring file's rules with every field named, so a later change to
 * today's rules can't change what the file plays (a field left out means
 * "today's", which moves). */
function explicitRules(rules: MatchRules): MatchRules {
  return { secondSeatExtraHealth: secondSeatExtraHealth(rules) };
}

/** A measuring file's rules, refused unless every field is named and none is
 * a field this engine no longer plays (session 68's opening-card, energy and
 * first-attack variants left in session 71). Never guesses. */
function measuringRules(rules: MatchRules | undefined): MatchRules {
  if (!rules) throw new Error(`a measuring replay without its seat rules`);
  const unknown = Object.keys(rules).filter((k) => !(MATCH_RULES_FIELDS as readonly string[]).includes(k));
  if (unknown.length) throw new Error(`a measuring replay naming seat rules this engine no longer plays: ${unknown.join(", ")}`);
  const missing = MATCH_RULES_FIELDS.filter((k) => rules[k] === undefined);
  if (missing.length) throw new Error(`a measuring replay that leaves out ${missing.join(", ")}: written before rules-2, it can't say which value it played`);
  return structuredClone(rules);
}

function replayDeck(spec: DeckSpec): ReplayDeck {
  return { name: spec.name, cardIds: spec.cards.map((c) => c.id), signature: spec.signature ? structuredClone(spec.signature) : null };
}

// ---------------------------------------------------------------------------
// Reading

/** The deck a replay names, as the engine takes it, with its card ids read
 * from `cards` (the file's own, or `cards-1` for an /1 file). */
export function replayDeckSpec(deck: ReplayDeck, id: PlayerId, cards: ReadonlyMap<string, Card> = CARDS_1_BY_ID): DeckSpec {
  return {
    id,
    name: deck.name,
    cards: deck.cardIds.map((cardId) => {
      const card = cards.get(cardId);
      if (!card) throw new Error(`the replay names a card it doesn't define: "${cardId}"`);
      return structuredClone(card);
    }),
    ...(deck.signature ? { signature: structuredClone(deck.signature) } : {}),
  };
}

/** Reads a replay file of either format into what the engine rebuilds it
 * from. Throws, saying why, for a format, rules version or card set this
 * engine can't read (never guesses). */
export function replaySetup(file: ReplayFile): ReplaySetup {
  const format = (file as { format?: unknown }).format;
  if (format === "ai-tcg-replay/1") {
    const f = file as ReplayFileV1;
    return {
      format,
      decks: { p1: replayDeckSpec(f.decks.p1, "p1", CARDS_1_BY_ID), p2: replayDeckSpec(f.decks.p2, "p2", CARDS_1_BY_ID) },
      names: f.names,
      seed: f.seed,
      moves: f.moves,
      rules: rulesOfVersion("rules-1"), // 20 and 20, named explicitly (today's base is rules-2)
      rulesVersion: "rules-1",
      cardsVersion: "cards-1",
    };
  }
  if (format === "ai-tcg-replay/2") {
    const f = file as ReplayFileV2;
    if (!f.versions || !Array.isArray(f.cards)) throw new Error(`an ${format} file without its versions or cards`);
    const got = cardSetDigest(f.cards);
    if (got !== f.versions.cardsDigest) throw new Error(`the file's cards hash to ${got}, it says ${f.versions.cardsDigest}: they were changed after it was written`);
    let rules: MatchRules | undefined;
    if (f.versions.rules === "measure") {
      rules = measuringRules(f.rules);
    } else {
      rules = rulesOfVersion(f.versions.rules); // throws for a version this engine doesn't know
      if (f.versions.rules === CURRENT_RULES_VERSION) rules = undefined; // today's rules: the match keeps no rules field
    }
    const cards = new Map(f.cards.map((c) => [c.id, c] as const));
    return {
      format,
      decks: { p1: replayDeckSpec(f.decks.p1, "p1", cards), p2: replayDeckSpec(f.decks.p2, "p2", cards) },
      names: f.names,
      seed: f.seed,
      moves: f.moves,
      rules,
      rulesVersion: f.versions.rules,
      cardsVersion: f.versions.cards,
    };
  }
  throw new Error(`a replay file in format "${String(format)}"; this server reads ${READABLE_REPLAY_FORMATS.join(" and ")}`);
}

/** Rebuilds a replay in the engine (every state and log event, through
 * `hooks`) and checks it ends as the file says: the same winner, turns,
 * moves and final health. Throws on any difference. */
export function rebuildReplay(file: ReplayFile, hooks: MatchHooks = {}): MatchResult & { setup: ReplaySetup } {
  const setup = replaySetup(file);
  const result = replayMatch(setup.decks.p1, setup.decks.p2, setup.names, setup.seed, setup.moves, hooks, setup.rules);
  const { state, movesPlayed } = result;
  const r = file.result;
  const winner = state.winner ?? null;
  const problems: string[] = [];
  if (r.winner !== winner) problems.push(`winner ${String(r.winner)} recorded, ${String(winner)} rebuilt`);
  if (r.turns !== state.turnNumber) problems.push(`${r.turns} turns recorded, ${state.turnNumber} rebuilt`);
  if (r.moves !== movesPlayed) problems.push(`${r.moves} moves recorded, ${movesPlayed} rebuilt`);
  if (r.finalHealth.p1 !== state.players.p1.health || r.finalHealth.p2 !== state.players.p2.health) {
    problems.push(`final health ${r.finalHealth.p1}-${r.finalHealth.p2} recorded, ${state.players.p1.health}-${state.players.p2.health} rebuilt`);
  }
  if (problems.length) throw new Error(`replay ${file.matchId} doesn't rebuild as recorded: ${problems.join("; ")}`);
  return { ...result, setup };
}
