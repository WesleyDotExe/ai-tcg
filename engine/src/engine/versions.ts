// Versions a recorded match is played under (session 70, owner 2026-11-02
// call 6: "replays carry the card and rule versions they were played under,
// old ones stay rebuildable"), BEFORE any card or rule change ships.
//
// Two things decide how a recorded match plays back:
// - the RULES: the start of the match (health, opening hands, the first
//   draw) and the engine's own behaviour. A rules version names both. The
//   engine keeps every published version: a change to how matches play is a
//   NEW version, with the old behaviour still reachable through the old one
//   (as `MatchRules` fields), never an edit to history. The golden replays
//   (server/test/fixtures/replays/) fail loudly if a change alters a
//   recorded match without one.
// - the CARDS: a card's text can change between sets. A replay (format
//   `ai-tcg-replay/2`) carries the full definition of every card it uses, so
//   it never depends on today's registry; the card version is the stamp of
//   the published card set it was played under. Older `/1` files carry card
//   ids only: they read the frozen `cards-1` snapshot, the cards as they
//   were for every `/1` file ever written (data/cardSnapshots/cards1.ts).
//
// Pure TypeScript, no node built-ins: the render bundles the engine.

import type { Card } from "../cards/types.js";
import { isShippedRules, secondSeatExtraHealth, SECOND_SEAT_EXTRA_HEALTH, type MatchRules } from "../state/types.js";
import { CARD_REGISTRY } from "../data/registry.js";
import { CARDS_1 } from "../data/cardSnapshots/cards1.js";

// ---------------------------------------------------------------------------
// Rules versions

export interface RulesVersion {
  id: string;
  /** The rule as printed, for the match pages and the owner. */
  text: string;
  /** The start-of-match rules this version plays, as `runMatch` and
   * `replayMatch` take them, every field named. */
  rules: MatchRules;
}

/** Every published rules version, oldest first. Never edit or remove one:
 * replays name them.
 *
 * Each version names its start-of-match rules EXPLICITLY (every
 * `MatchRules` field), never as `{}`: `{}` means "the rules the game plays
 * today", which moves when a new version ships. Session 71 shipped rules-2
 * by changing the engine's base (types.ts SECOND_SEAT_EXTRA_HEALTH), so
 * every match anywhere (the ladder, the network server, the economy's
 * matches, the measuring rings) plays it without passing anything; rules-1
 * got its explicit 0 first, and the golden replays (/1 and /2 files written
 * under rules-1) still rebuild byte for byte. */
export const RULES_VERSIONS: readonly RulesVersion[] = [
  {
    id: "rules-1",
    text: "Both players start with 20 health. The player going first skips its first draw.",
    rules: { secondSeatExtraHealth: 0 },
  },
  {
    id: "rules-2",
    text: "The player going second starts with 24 health; the player going first starts with 20 and skips its first draw.",
    rules: { secondSeatExtraHealth: SECOND_SEAT_EXTRA_HEALTH },
  },
];

/** The rules every match the game plays today is played under. */
export const CURRENT_RULES_VERSION: string = RULES_VERSIONS[RULES_VERSIONS.length - 1]!.id;

export function rulesVersion(id: string): RulesVersion {
  const v = RULES_VERSIONS.find((r) => r.id === id);
  if (!v) throw new Error(`rules version "${id}" isn't one this engine knows (it knows ${RULES_VERSIONS.map((r) => r.id).join(", ")})`);
  return v;
}

/** The published rules version `rules` is, or null for a measuring
 * variant that is none of them. Absent rules are today's version. */
export function rulesVersionOf(rules: MatchRules | undefined): string | null {
  if (isShippedRules(rules)) return CURRENT_RULES_VERSION;
  const explicit = canonicalJson({ secondSeatExtraHealth: secondSeatExtraHealth(rules) });
  return RULES_VERSIONS.find((v) => canonicalJson(v.rules) === explicit)?.id ?? null;
}

/** The `MatchRules` a rules version plays, as a fresh copy. */
export function rulesOfVersion(id: string): MatchRules {
  return structuredClone(rulesVersion(id).rules);
}

// ---------------------------------------------------------------------------
// Card versions

/** JSON with every object's keys sorted (and undefined fields left out), so
 * two equal cards always print the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("canonicalJson: a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** A 64-bit content hash (two independent 32-bit lanes), as 16 hex digits.
 * For telling versions apart, not for security. */
export function digest(text: string): string {
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

/** One card's definition, hashed. */
export function cardDigest(card: Card): string {
  return digest(canonicalJson(card));
}

/** A set of card definitions, hashed (order doesn't matter; a card listed
 * twice counts once). */
export function cardSetDigest(cards: Iterable<Card>): string {
  const byId = new Map<string, string>();
  for (const c of cards) {
    const d = cardDigest(c);
    const seen = byId.get(c.id);
    if (seen !== undefined && seen !== d) throw new Error(`cardSetDigest: two different cards share the id "${c.id}"`);
    byId.set(c.id, d);
  }
  return digest([...byId.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, d]) => `${id}=${d}`).join("\n"));
}

export interface CardsVersion {
  id: string;
  /** `cardSetDigest` of the registry at this version. */
  digest: string;
  /** What changed, for the owner. */
  note: string;
}

/** Every published card version, oldest first. Never edit or remove one.
 * A test checks the newest one's digest against today's registry: a card
 * change without a new entry here fails it. */
export const CARDS_VERSIONS: readonly CardsVersion[] = [
  {
    id: "cards-1",
    digest: "6b0c6e22247bc341",
    note: "The Season 0 cards as they stood for every ai-tcg-replay/1 file (session 67 to session 70): the four faction pools, the neutral pool and the 3 Zero-Day cards.",
  },
];

/** The card version every match the game plays today is played under. */
export const CURRENT_CARDS_VERSION: string = CARDS_VERSIONS[CARDS_VERSIONS.length - 1]!.id;

/** Today's registry, hashed: what the newest `CARDS_VERSIONS` entry must say. */
export function registryDigest(): string {
  return cardSetDigest(CARD_REGISTRY.values());
}

/** The card version today's registry is, or null when it matches no
 * published version (a card changed without a new CARDS_VERSIONS entry: the
 * versions test fails on that too). A replay never claims a version its
 * cards aren't. */
export function publishedCardsVersion(): string | null {
  const d = registryDigest();
  return CARDS_VERSIONS.find((v) => v.digest === d)?.id ?? null;
}

/** The cards as `cards-1` had them: what an `ai-tcg-replay/1` file's card
 * ids mean, forever (those files carry ids, not definitions). */
export const CARDS_1_BY_ID: ReadonlyMap<string, Card> = new Map(CARDS_1.map((c) => [c.id, c]));
