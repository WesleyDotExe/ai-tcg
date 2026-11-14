// A pulled card's versions, for the pack page's card viewer (render session
// 78; render debt from session 75: "the versions row is in the Collection's
// viewer only, not in the pack reveal or its summary").
//
// Since S0-odds-3 every card a pack holds is a booster card (plus the three
// Zero-Day cards), and every booster card comes in several versions: its set
// place (Standard, Foil, Full Art, Alt Art), and for some cards a secret
// illustration, a Glitch version, a Gold version and a Prototype run. The
// moment a pull is in the owner's hand is the moment they want to know what
// else exists of it and which of those they hold: the chase.
//
// Pure: no DOM, no fetch, no engine. It reads the set's binder (the economy
// store's `binder(ownerId, setCode)`, served as `GET
// /api/collection/binder/:setCode`) read AFTER the open, so the copy just
// pulled is already counted. The site's client bundles it for the browser;
// the demo page runs it in Node. The binder is the only source: nothing here
// restates which cards have which versions.

import type { Finish } from "@ai-tcg/economy";

/** The binder's shape, as both the store and the owner API give it. */
export interface VersionsBinder {
  setCode: string;
  base: { entries: readonly VersionsEntry[] };
  secrets: { entries: readonly VersionsEntry[] };
  glitch: { entries: readonly VersionsEntry[] };
  gold: { entries: readonly VersionsEntry[] };
  prototypes: readonly { runCode: string; cardId: string; runSize: number; serialsHeld: readonly number[] }[];
}
export interface VersionsEntry {
  number: string;
  kind: string;
  cardId: string;
  secretCode: string | null;
  owned: number;
}

/** One version of a card, for the viewer's row. */
export interface PullVersion {
  kind: "set" | "illustration" | "glitch" | "gold" | "prototype";
  label: string;
  number: string;
  held: boolean;
  /** The version this pull is. */
  current: boolean;
  /** For a screen reader and the chip's hover (versionWords). */
  words: string;
}

/** What the viewer shows under a pulled card: every version the set has of
 * it, and how many the owner now holds. */
export interface PullVersions {
  chips: PullVersion[];
  held: number;
  total: number;
  /** The line under the row (versionsLine). */
  line: string;
}

/** The pull a version is worked out from: a reveal card or a summary tile. */
export interface PullLike {
  cardId: string;
  finish: Finish;
  secret: { code: string } | null;
  prototype: { runCode: string } | null;
}

/** Which version a pull is. The set place covers the finishes printed on
 * the card's own number (Standard, Foil, Full Art, Alt Art, and a prize's
 * tournament finish); the rest are their own places. */
function currentKind(p: PullLike): PullVersion["kind"] | null {
  switch (p.finish) {
    case "zeroDay": return null;
    case "secret": return "illustration";
    case "glitch": return "glitch";
    case "gold": return "gold";
    case "prototype": return "prototype";
    default: return "set";
  }
}

/** The versions of a pulled card, or null when there is nothing to list: a
 * Zero-Day card (its own kind, one version), or a card with only its set
 * place (a pack card always has more today; the rule keeps a lone place off
 * the screen, as the Collection's viewer does). */
export function pullVersionsOf(p: PullLike, b: VersionsBinder): PullVersions | null {
  const kind = currentKind(p);
  if (!kind) return null;
  const chips: PullVersion[] = [];
  for (const e of b.base.entries) if (e.cardId === p.cardId) chips.push({ kind: "set", label: "Set", number: e.number, held: e.owned > 0, current: kind === "set", words: "" });
  for (const e of b.secrets.entries) {
    if (e.cardId !== p.cardId || e.kind === "zeroDay") continue;
    chips.push({ kind: "illustration", label: "Illustration", number: e.number, held: e.owned > 0, current: kind === "illustration" && p.secret?.code === e.secretCode, words: "" });
  }
  for (const e of b.glitch.entries) if (e.cardId === p.cardId) chips.push({ kind: "glitch", label: "Glitch", number: e.number, held: e.owned > 0, current: kind === "glitch", words: "" });
  for (const e of b.gold.entries) if (e.cardId === p.cardId) chips.push({ kind: "gold", label: "Gold", number: e.number, held: e.owned > 0, current: kind === "gold", words: "" });
  for (const r of b.prototypes) {
    if (r.cardId !== p.cardId) continue;
    chips.push({ kind: "prototype", label: `Prototype /${r.runSize}`, number: r.runCode, held: r.serialsHeld.length > 0, current: kind === "prototype" && p.prototype?.runCode === r.runCode, words: "" });
  }
  if (chips.length < 2) return null;
  for (const c of chips) c.words = versionWords(c);
  const held = chips.filter((c) => c.held).length;
  return { chips, held, total: chips.length, line: versionsLine({ held, total: chips.length }) };
}

/** A version's words for a screen reader and the chip's hover. */
export function versionWords(v: Pick<PullVersion, "label" | "number" | "current" | "held">): string {
  return `${v.label} ${v.number}${v.current ? ", this pull" : ""}${v.held ? ", held" : ", not held"}`;
}

/** The line under the row: how much of this card's chase the owner holds. */
export function versionsLine(v: Pick<PullVersions, "held" | "total">): string {
  if (v.held >= v.total) return `You hold all ${v.total} of its versions.`;
  return `You hold ${v.held} of its ${v.total} versions.`;
}

/** Adds `versions` to every card of a reveal (and every tile of a ten-pack
 * summary), from the binder read after the open. A binder of another set
 * leaves the reveal as it was. */
export function withPullVersions<T extends { setCode: string; cards: readonly PullLike[] }>(reveal: T, b: VersionsBinder | null | undefined): T {
  if (!b || b.setCode !== reveal.setCode) return reveal;
  return { ...reveal, cards: reveal.cards.map((c) => ({ ...c, versions: pullVersionsOf(c, b) })) };
}
export function withBulkPullVersions<T extends { packs: readonly { setCode: string; cards: readonly PullLike[] }[]; tiles: readonly PullLike[] }>(bulk: T, b: VersionsBinder | null | undefined): T {
  if (!b) return bulk;
  const setCode = bulk.packs[0]?.setCode;
  if (!setCode || b.setCode !== setCode) return bulk;
  return {
    ...bulk,
    packs: bulk.packs.map((p) => withPullVersions(p, b)),
    tiles: bulk.tiles.map((t) => ({ ...t, versions: pullVersionsOf(t, b) })),
  };
}
