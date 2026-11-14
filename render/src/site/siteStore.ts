// The Store page and pack opening on the website (render session 47): the
// pure half. No DOM, no fetch; the page bundles this file and the tests
// import it directly, so what is tested is what runs.
//
// What it decides:
//  - how the owner API's answer to an opening (POST /api/packs/open) becomes
//    what the full-screen reveal plays: one pack's reveal plan, or a ten-pack
//    open's (packOpening.ts planReveal / planBulkReveal, the same planner the
//    standalone pages and the first-time flow run). The reveal only shows a
//    result the server already rolled: nothing here draws a number;
//  - the buttons on a finished opening's summary (open another, open ten
//    more, done), each greyed with the reason when the packs aren't there;
//  - the Store page's lines: the free daily pack, buying 1 to 10, the
//    unopened packs and where each came from, the recent openings.
//
// Every rule stays the store's: the price, the ten-pack count, how many
// daily packs can wait and when the next comes in are all read from the
// server's answers, never restated.

import { planBulkReveal, planReveal, withSetBar, type BulkReveal, type PackReveal } from "../packOpening.js";
import { withBulkPullVersions, withPullVersions, type VersionsBinder } from "../packVersions.js";
import type { SiteAudio, SiteDailyPack, SiteOpenAnswer } from "./siteApi.js";
import { untilText, type MiniCard, type SiteCollection, type SitePacks } from "./siteBoard.js";

/** What the full-screen opening plays for one answer. */
export type SiteReveal = { kind: "single"; label: string; reveal: PackReveal } | { kind: "bulk"; label: string; reveal: BulkReveal };

/** The answer to an opening, as the reveal plays it: a ten-pack open (the
 * server sends its summary) or one pack. Refuses an answer with no packs,
 * or one pack sent with a summary, rather than guess. */
export function revealOf(answer: Pick<SiteOpenAnswer, "packs" | "summary">): SiteReveal {
  const n = answer.packs.length;
  if (n === 0) throw new Error("the server opened no packs");
  if (answer.summary) {
    if (n < 2) throw new Error("a ten-pack summary came with a single pack");
    return { kind: "bulk", label: `${n} packs`, reveal: planBulkReveal({ packs: answer.packs, summary: answer.summary }) };
  }
  if (n !== 1) throw new Error(`${n} packs came without their summary`);
  const p = answer.packs[0]!;
  return { kind: "single", label: `${p.setCode} pack`, reveal: planReveal(p) };
}

/** A single pack's reveal with the set-completion bar (render session 61):
 * `base` is the set's base binder section read after the open (GET
 * /api/collection/binder/:setCode). No binder (the read failed), no bar: the
 * opening plays the same without it. A ten-pack open has no bar yet. */
export function withSiteSetBar(r: SiteReveal, base: { held: number; total: number } | null | undefined): SiteReveal {
  if (r.kind !== "single" || !base) return r;
  return { ...r, reveal: withSetBar(r.reveal, base) };
}

/** Render session 78: every pulled card's versions for the pack viewer
 * (packVersions.ts), from the same binder read. A single pack's cards, or a
 * ten-pack open's packs and summary tiles. */
export function withSiteVersions(r: SiteReveal, binder: VersionsBinder | null | undefined): SiteReveal {
  if (!binder) return r;
  return r.kind === "single" ? { ...r, reveal: withPullVersions(r.reveal, binder) } : { ...r, reveal: withBulkPullVersions(r.reveal, binder) };
}

export type SummaryAction = "one" | "ten" | "done";
export interface SummaryButton {
  act: SummaryAction;
  label: string;
  primary: boolean;
  enabled: boolean;
  /** Why it's greyed (shown under the buttons). */
  why: string | null;
}

/** The buttons on a finished opening's summary, from the packs still
 * waiting after it (the wallet the server answered with). A single pack
 * offers the next one; a ten-pack open offers ten more and one. A button
 * whose packs aren't there is greyed, with the reason, never hidden: the
 * owner sees what the page can do. */
export function summaryButtons(kind: SiteReveal["kind"], unopened: number, bulkCount: number, frozenWhy: string | null = null): SummaryButton[] {
  // Render session 74: the season ended while the opening played (the
  // server opened it; the next press would be refused): the open buttons
  // are off with the reason, and Done leads.
  if (frozenWhy) {
    const off = (act: SummaryAction, label: string): SummaryButton => ({ act, label, primary: false, enabled: false, why: frozenWhy });
    const done: SummaryButton = { act: "done", label: "Done", primary: true, enabled: true, why: null };
    return kind === "single" ? [off("one", "Open another"), done] : [off("ten", `Open ${bulkCount} more`), off("one", "Open one pack"), done];
  }
  const none = unopened === 0 ? "No packs waiting. Buy more in the Store, or claim your free daily pack." : null;
  const one: SummaryButton = { act: "one", label: kind === "single" ? "Open another" : "Open one pack", primary: kind === "single", enabled: unopened >= 1, why: none };
  const done: SummaryButton = { act: "done", label: "Done", primary: unopened === 0, enabled: true, why: null };
  if (kind === "single") return [one, done];
  const ten: SummaryButton = {
    act: "ten",
    label: `Open ${bulkCount} more`,
    primary: unopened >= bulkCount,
    enabled: unopened >= bulkCount,
    why: unopened >= bulkCount || none ? null : `Opening ${bulkCount} at once needs ${bulkCount} packs waiting; you have ${unopened}.`,
  };
  return [ten, { ...one, primary: unopened >= 1 && unopened < bulkCount }, done];
}

/** The reasons under the summary's buttons, once each. */
export function summaryWhy(buttons: SummaryButton[]): string[] {
  return [...new Set(buttons.filter((b) => !b.enabled && b.why).map((b) => b.why!))];
}

/** Where a waiting pack came from, in words (the store's sources). */
export const PACK_SOURCE_NAMES: Record<string, string> = {
  purchase: "Bought",
  starter: "Starter pack",
  weeklyChallenge: "Weekly challenge",
  ownerDaily: "Free daily pack",
};
export function sourceName(source: string): string {
  return PACK_SOURCE_NAMES[source] ?? source;
}

/** A date as the Store lists it ("1 Nov, 09:14"), in the given zone. */
export function shortWhen(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone });
}

export interface DailyPackView {
  waiting: number;
  cap: number;
  canClaim: boolean;
  /** The button's words. */
  button: string;
  /** The line under it: what waits and when the next comes in. */
  line: string;
}

/** The free daily pack, in words, from the server's status. The day turns
 * at midnight in the server's zone (Sydney); the countdown is the server's
 * `nextPackAt`, and while the most that can wait are waiting, nothing comes
 * in until one is claimed (the owner's 2026-11-01 call 3). */
export function dailyPackView(d: SiteDailyPack, nowMs: number): DailyPackView {
  const n = d.waiting;
  const next = d.nextPackAt ? `The next comes in ${untilText(nowMs, d.nextPackAt)} (midnight ${zoneCity(d.timeZone)}).` : "";
  const line =
    n === 0
      ? `Claimed today. ${next}`.trim()
      : n >= d.cap
        ? `${n} free packs waiting, the most that can wait. Claim one to start the timer to the next.`
        : `${n} free pack${n === 1 ? "" : "s"} waiting. ${next}`.trim();
  return { waiting: n, cap: d.cap, canClaim: n > 0, button: n > 1 ? `Claim free daily pack (${n})` : "Claim free daily pack", line };
}

/** "Australia/Sydney" -> "Sydney". */
export function zoneCity(timeZone: string): string {
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}

/** How many packs one purchase can be (the server's rule: 1 to 10, all or
 * none). Kept here only to bound the page's stepper; the server refuses
 * anything else with its own words. */
export const BUY_MAX = 10;

export interface BuyView {
  count: number;
  price: number;
  total: number;
  canAfford: boolean;
  /** Credits short, when it can't be afforded. */
  short: number;
}
export function buyView(offer: SitePacks["offer"][number], count: number, credits: number): BuyView {
  const c = Math.max(1, Math.min(BUY_MAX, Math.floor(count) || 1));
  const total = offer.priceCredits * c;
  return { count: c, price: offer.priceCredits, total, canAfford: credits >= total, short: Math.max(0, total - credits) };
}

/** The unopened packs, oldest first, grouped by where they came from (the
 * Store's list): each group's count and its oldest pack, which "Open" in
 * that row opens. */
export interface UnopenedGroup {
  source: string;
  name: string;
  setCode: string;
  count: number;
  oldestPackId: string;
  oldestAt: string;
}
export function unopenedGroups(unopened: SitePacks["unopened"]): UnopenedGroup[] {
  const out: UnopenedGroup[] = [];
  for (const p of unopened) {
    const g = out.find((x) => x.source === p.source && x.setCode === p.setCode);
    if (g) g.count++;
    else out.push({ source: p.source, name: sourceName(p.source), setCode: p.setCode, count: 1, oldestPackId: p.packId, oldestAt: p.acquiredAt });
  }
  return out;
}

/** The Store's recent openings, newest first, from the collection's
 * `recentPulls`: when, the best finish, and the cards. (Watching one again
 * needs the opening as the reveal plays it; the logged read gives only the
 * copies: raised with the game lane.) */
export interface RecentOpening {
  packId: string;
  setCode: string;
  openedAt: string;
  jackpot: boolean;
  cards: MiniCard[];
  /** The best finish in it, in words ("" when all standard). */
  best: string;
}
const FINISH_ORDER = ["zeroDay", "prototype", "secret", "gold", "glitch", "altArt", "fullArt", "foil"];
const FINISH_WORDS: Record<string, string> = { zeroDay: "Zero-Day", prototype: "Prototype", secret: "Secret", gold: "Gold", glitch: "Glitch", altArt: "Alt Art", fullArt: "Full Art", foil: "Foil" };
export function recentOpenings(c: SiteCollection, n: number): RecentOpening[] {
  const factionOf = new Map(c.cards.map((x) => [x.cardId, x.faction]));
  return c.recentPulls.slice(0, n).map((p) => {
    const best = FINISH_ORDER.find((f) => p.cards.some((k) => k.finish === f));
    return {
      packId: p.packId,
      setCode: p.setCode,
      openedAt: p.openedAt,
      jackpot: p.jackpot,
      cards: p.cards.map((k) => ({ cardId: k.cardId, name: k.name, rarity: k.rarity, faction: factionOf.get(k.cardId) ?? null, finish: k.finish, serial: k.serial })),
      best: best ? FINISH_WORDS[best]! : "",
    };
  });
}

/** The pack opening's sound, from and to the account's setting (sound on
 * or off, volume 0-100; OWNER_API.md, the account settings): the reveal's
 * player reads { muted, volume 0-1 } and writes its own serialized form. */
export function soundPrefOf(a: SiteAudio): { muted: boolean; volume: number } {
  return { muted: !a.on, volume: Math.max(0, Math.min(100, a.volume)) / 100 };
}
/** The player's serialized setting as an account patch, or null if it
 * can't be read (nothing is sent then). */
export function soundPatchOf(serialized: string): SiteAudio | null {
  try {
    const p = JSON.parse(serialized) as { muted?: unknown; volume?: unknown };
    const v = Number(p.volume);
    if (typeof p.muted !== "boolean" || !(v >= 0 && v <= 1)) return null;
    return { on: !p.muted, volume: Math.round(v * 100) };
  } catch {
    return null;
  }
}
