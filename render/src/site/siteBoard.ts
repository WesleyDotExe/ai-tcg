// Home as the widget board (Season 0 render item 3, render session 46): the
// pure part. No DOM, no fetch; the page bundles this file and the tests
// import it directly, so what is tested is what runs.
//
// The spec is the owner's 2026-10-05 "website first" entry, section C (the
// 12-column grid, S/M/L, Customise mode, the empty state, the widget limits,
// narrow-window stacking), trimmed for Season 0 on 2026-11-01 (the twelve
// widgets). The saved layout is the game lane's `GET`/`PUT /api/board`
// (server/OWNER_API.md, "The Home board"): an ordered list the grid packs.
// The rules a board must keep (which widgets, how many of each, how many in
// all) are the server's, read from its `rules`; this file never restates
// them, it only applies what the server sent. What is the render lane's is
// how a widget looks: its name, icon, colour, the shape its Large size takes,
// the page its open button goes to, and what each size shows.

import type { SiteDailyPack } from "./siteApi.js";
import type { PageId } from "./siteModel.js";

export type WidgetType = "agent" | "live" | "watch" | "packs" | "daily" | "collection" | "showcase" | "ladder" | "form" | "history" | "notif" | "store";
export type WidgetSize = "S" | "M" | "L";

export interface SiteWidget {
  id: string;
  type: WidgetType;
  size: WidgetSize;
}

/** The board's rules as `GET /api/board` sends them. */
export interface SiteBoardRules {
  widgetTypes: { type: WidgetType; limit: number }[];
  sizes: WidgetSize[];
  maxWidgets: number;
  recommendedWidgets: SiteWidget[];
}

/** `GET /api/board`. */
export interface SiteBoard {
  widgets: SiteWidget[];
  recommended: boolean;
  updatedAt: string | null;
  rules: SiteBoardRules;
}

export interface WidgetInfo {
  name: string;
  /** The gallery's one line: what the widget shows in Season 0. */
  desc: string;
  icon: "link" | "match" | "eye" | "store" | "trophy" | "col" | "stats" | "bell" | "spark" | "list";
  /** The small app-style icon's colour (the mockup's). */
  grad: string;
  /** Large is wide (12 x 6) or tall (6 x 8), "whichever suits the widget"
   * (the mockup's choice for each). */
  large: "wide" | "tall";
  /** The page the widget's open button goes to; null: none yet. */
  page: PageId | null;
  /** A live widget: it can show a live board (at most two at once). */
  live?: boolean;
}

/** The twelve Season 0 widgets, in the gallery's order (the mockup's). */
export const WIDGET_INFO: Record<WidgetType, WidgetInfo> = {
  agent: { name: "My agent", desc: "Your agent, its rating, today and its streak", icon: "link", grad: "linear-gradient(135deg,#7a5cff,#3d7bff)", large: "wide", page: "connect" },
  // Render session 57: Agent controls replaces Live match (owner 2026-11-06,
  // the Season 0 brief). The server's widget id stays "live"; it no longer
  // draws a live board (that is Watch live's and the match page's).
  live: { name: "Agent controls", desc: "Start and stop your agent, its personality, time and deck", icon: "match", grad: "linear-gradient(135deg,#ff5d73,#ff9f43)", large: "wide", page: "match" },
  watch: { name: "Watch live", desc: "The featured matches (up to two on a board)", icon: "eye", grad: "linear-gradient(135deg,#ffcf5c,#ff7d24)", large: "wide", page: "live", live: true },
  packs: { name: "Packs", desc: "Your unopened packs, buy and open", icon: "store", grad: "linear-gradient(135deg,#f6c445,#e0902a)", large: "wide", page: "store" },
  daily: { name: "Daily rewards", desc: "Today's credits from wins, and the reset", icon: "trophy", grad: "linear-gradient(135deg,#3cc47c,#2fb6ff)", large: "tall", page: "stats" },
  collection: { name: "Collection", desc: "Set completion, secrets, Prototypes, last pulls", icon: "col", grad: "linear-gradient(135deg,#3d7bff,#7a5cff)", large: "wide", page: "collection" },
  showcase: { name: "Showcase", desc: "Your best cards", icon: "spark", grad: "linear-gradient(135deg,#c95cff,#ff5d9e)", large: "wide", page: "collection" },
  ladder: { name: "Ladder", desc: "Your rank and the Season 0 ladder", icon: "stats", grad: "linear-gradient(135deg,#2fb6ff,#3d7bff)", large: "tall", page: "stats" },
  form: { name: "Rating & form", desc: "Rating, trend and recent results", icon: "stats", grad: "linear-gradient(135deg,#2fb6ff,#3cc47c)", large: "wide", page: "stats" },
  history: { name: "Match history", desc: "Recent results and replays", icon: "list", grad: "linear-gradient(135deg,#6b778c,#1b2333)", large: "tall", page: "match" },
  notif: { name: "Notifications", desc: "Your alerts and updates", icon: "bell", grad: "linear-gradient(135deg,#ff4d6d,#ff8a5c)", large: "tall", page: null },
  store: { name: "Store", desc: "Packs to buy, and the cosmetics on sale", icon: "store", grad: "linear-gradient(135deg,#f6c445,#e0902a)", large: "wide", page: "store" },
};

/** The size's CSS class: S, M, and Large as wide or tall. */
export function sizeClass(w: Pick<SiteWidget, "type" | "size">): "sz-S" | "sz-M" | "sz-Lw" | "sz-Lt" {
  if (w.size !== "L") return w.size === "S" ? "sz-S" : "sz-M";
  return WIDGET_INFO[w.type].large === "wide" ? "sz-Lw" : "sz-Lt";
}

/** The grid cells a widget takes on the 12-column grid (spec C). */
export function spanOf(w: Pick<SiteWidget, "type" | "size">): { cols: number; rows: number } {
  const c = sizeClass(w);
  return c === "sz-S" ? { cols: 3, rows: 2 } : c === "sz-M" ? { cols: 6, rows: 4 } : c === "sz-Lw" ? { cols: 12, rows: 6 } : { cols: 6, rows: 8 };
}

export function limitOf(rules: SiteBoardRules, type: WidgetType): number {
  return rules.widgetTypes.find((t) => t.type === type)?.limit ?? 0;
}

/** Why a widget can't be added, in the gallery's words; null: it can. */
export function addBlock(widgets: readonly SiteWidget[], type: WidgetType, rules: SiteBoardRules): string | null {
  const limit = limitOf(rules, type);
  if (limit === 0) return "Not in Season 0";
  const n = widgets.filter((w) => w.type === type).length;
  if (n >= limit) return limit === 1 ? "Already on your board" : `${limit} already on your board`;
  if (widgets.length >= rules.maxWidgets) return `Your board holds ${rules.maxWidgets} widgets`;
  return null;
}

/** The next free id ("w1", "w2"...), past every number the board uses, so
 * an id is never reused on one board. */
export function nextId(widgets: readonly SiteWidget[]): string {
  let max = 0;
  for (const w of widgets) {
    const m = /^w(\d+)$/.exec(w.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let n = max + 1;
  while (widgets.some((w) => w.id === `w${n}`)) n++;
  return `w${n}`;
}

/** Adds a widget at Medium at the end of the board (the mockup: "Widgets
 * start at medium size"), or answers the same list if it can't be added. */
export function addWidget(widgets: readonly SiteWidget[], type: WidgetType, rules: SiteBoardRules): SiteWidget[] {
  if (addBlock(widgets, type, rules)) return [...widgets];
  return [...widgets, { id: nextId(widgets), type, size: "M" }];
}

export function removeWidget(widgets: readonly SiteWidget[], id: string): SiteWidget[] {
  return widgets.filter((w) => w.id !== id);
}

export function resizeWidget(widgets: readonly SiteWidget[], id: string, size: WidgetSize): SiteWidget[] {
  return widgets.map((w) => (w.id === id ? { ...w, size } : w));
}

/** Drag and drop: `from` goes before (or after) `to`. */
export function moveWidget(widgets: readonly SiteWidget[], from: string, to: string, after: boolean): SiteWidget[] {
  if (from === to) return [...widgets];
  const moving = widgets.find((w) => w.id === from);
  if (!moving || !widgets.some((w) => w.id === to)) return [...widgets];
  const rest = widgets.filter((w) => w.id !== from);
  const j = rest.findIndex((w) => w.id === to);
  rest.splice(after ? j + 1 : j, 0, moving);
  return rest;
}

/** The keyboard's move (arrow keys in Customise mode): one place earlier or
 * later in the owner's order, stopping at the ends. */
export function moveBy(widgets: readonly SiteWidget[], id: string, step: -1 | 1): SiteWidget[] {
  const i = widgets.findIndex((w) => w.id === id);
  const j = i + step;
  if (i < 0 || j < 0 || j >= widgets.length) return [...widgets];
  const out = [...widgets];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

export function sameBoard(a: readonly SiteWidget[], b: readonly SiteWidget[]): boolean {
  return a.length === b.length && a.every((w, i) => w.id === b[i]!.id && w.type === b[i]!.type && w.size === b[i]!.size);
}

/** A fresh copy of the recommended layout with ids that don't clash. */
export function recommendedWidgets(rules: SiteBoardRules): SiteWidget[] {
  return rules.recommendedWidgets.map((w) => ({ ...w }));
}

/** "arena" (render session 67): Watch live at L with the live match on the
 * real arena, embedded in the tile. One per board (each is a whole arena
 * page); it counts as one of the two live boards. */
export type LiveView = "arena" | "board" | "scoreboard" | "list";

/** What each live widget draws (spec C: "at most 2 live boards render at
 * once; extra live widgets drop to a scoreboard with a short note"). A
 * Live match widget wants a board at M and L; Watch live wants one at L (its
 * M is the list of featured matches); S is always the scoreboard. The first
 * two that want a board, in board order, get one. `capped` lists the ones
 * that wanted a board and didn't (they show the note). */
export function liveViews(widgets: readonly SiteWidget[], maxBoards = 2): { views: Map<string, LiveView>; capped: Set<string> } {
  const views = new Map<string, LiveView>();
  const capped = new Set<string>();
  let shown = 0;
  let arena = false;
  for (const w of widgets) {
    if (!WIDGET_INFO[w.type].live) continue;
    if (w.type === "watch" && w.size === "M") {
      views.set(w.id, "list");
      continue;
    }
    const wants = w.size !== "S";
    if (wants && shown < maxBoards) {
      shown++;
      const embed = w.type === "watch" && w.size === "L" && !arena;
      if (embed) arena = true;
      views.set(w.id, embed ? "arena" : "board");
    } else {
      views.set(w.id, "scoreboard");
      if (wants) capped.add(w.id);
    }
  }
  return { views, capped };
}

/** The grid as it packs (CSS grid, `grid-auto-flow: row dense`, the
 * mockup's): each widget's column and row, 1-based. For the tests and the
 * evidence: the page itself lets the browser pack. */
export function packGrid(widgets: readonly SiteWidget[], cols = 12): { id: string; col: number; row: number; cols: number; rows: number }[] {
  const taken: boolean[][] = [];
  const free = (r: number, c: number, w: number, h: number) => {
    if (c + w > cols) return false;
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (taken[y]?.[x]) return false;
    return true;
  };
  const out: { id: string; col: number; row: number; cols: number; rows: number }[] = [];
  for (const w of widgets) {
    const s = spanOf(w);
    const span = { cols: Math.min(s.cols, cols), rows: s.rows };
    // Dense: every item searches from the grid's start.
    let r = 0;
    let c = 0;
    for (;;) {
      if (free(r, c, span.cols, span.rows)) break;
      c++;
      if (c + span.cols > cols) {
        c = 0;
        r++;
      }
    }
    for (let y = r; y < r + span.rows; y++) {
      taken[y] ??= [];
      for (let x = c; x < c + span.cols; x++) taken[y]![x] = true;
    }
    out.push({ id: w.id, col: c + 1, row: r + 1, ...span });
  }
  return out;
}

// ---- what the widgets show, from the server's answers -----------------------

/** `GET /api/daily`, the parts the widget reads. */
export interface SiteDaily {
  day: string;
  timeZone: string;
  startedAt: string;
  resetsAt: string;
  schedule: { fromWin: number; toWin: number | null; credits: number }[];
  wins: { nth: number; matchId: string; endedAt: string; credits: number }[];
  rewardedWins: { nth: number; matchId: string; endedAt: string; credits: number }[];
  losses: number;
  maxPaidLosses: number;
  creditsFromWins: number;
  creditsFromLosses: number;
  credits: number;
  nextWinPays: number;
  nextLossPays: number;
}

export interface DailyView {
  /** Credits from wins today, and the most wins can pay in a day (the
   * schedule's paying rows, summed: the bar's end). */
  fromWins: number;
  winCap: number;
  /** 0..100. */
  barPct: number;
  /** Rewarded wins so far, and how many wins pay at all. */
  rewarded: number;
  rewardedCap: number;
  credits: number;
  nextWin: string;
  resets: string;
}

/** Hours and minutes to the reset, "3 h 05 min" ("under a minute" at the end). */
export function untilText(nowMs: number, iso: string): string {
  const ms = Date.parse(iso) - nowMs;
  if (!(ms > 60_000)) return "under a minute";
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

export function dailyView(d: SiteDaily, nowMs: number): DailyView {
  let winCap = 0;
  let rewardedCap = 0;
  for (const row of d.schedule) {
    if (row.toWin === null || row.credits <= 0) continue;
    const n = row.toWin - row.fromWin + 1;
    winCap += n * row.credits;
    rewardedCap = Math.max(rewardedCap, row.toWin);
  }
  return {
    fromWins: d.creditsFromWins,
    winCap,
    barPct: winCap > 0 ? Math.min(100, Math.round((d.creditsFromWins / winCap) * 1000) / 10) : 0,
    rewarded: d.rewardedWins.length,
    rewardedCap,
    credits: d.credits,
    nextWin: d.nextWinPays > 0 ? `Next win pays ${d.nextWinPays}` : "Wins pay nothing more today",
    resets: `Resets in ${untilText(nowMs, d.resetsAt)} (midnight ${d.timeZone === "Australia/Sydney" ? "Sydney" : d.timeZone})`,
  };
}

/** `GET /api/collection`, the parts the widgets read. */
export interface SiteCollection {
  copies: number;
  distinctCards: number;
  cards: { cardId: string; name: string; rarity: string; faction: string | null; owned: number; salvageable: number; copies: { copyId: string; cardId: string; finish: string; serial: number | null; runSize: number | null; secretCode: string | null; acquiredAt: string }[] }[];
  sets: { setCode: string; base: { held: number; total: number }; secrets: { held: number; total: number }; glitch: { held: number; total: number }; gold: { held: number; total: number }; prototypes: { runsHeld: number; runs: number; copiesHeld: number } }[];
  recentPulls: { packId: string; setCode: string; openedAt: string; jackpot: boolean; cards: { copyId: string; cardId: string; name: string; rarity: string; finish: string; secretCode: string | null; serial: number | null; held: boolean }[] }[];
}

/** A card as a widget draws it (a mini placeholder face). */
export interface MiniCard {
  cardId: string;
  name: string;
  rarity: string;
  faction: string | null;
  finish: string;
  serial: number | null;
}

export const FINISH_NAMES: Record<string, string> = {
  standard: "",
  foil: "Foil",
  fullArt: "Full Art",
  altArt: "Alt Art",
  gold: "Gold",
  prototype: "Prototype",
  tournament: "Tournament",
  glitch: "Glitch",
  secret: "Secret",
  zeroDay: "Zero-Day",
};

/** How rare a finish is, for "best cards" (the mockup's order, with the
 * chase finishes that came after it on top). */
const FINISH_RANK: Record<string, number> = { zeroDay: 10, prototype: 9, secret: 8, glitch: 7, gold: 6, altArt: 5, fullArt: 4, tournament: 3, foil: 2, standard: 1 };
const RARITY_RANK: Record<string, number> = { Mythic: 4, Rare: 3, Uncommon: 2, Common: 1 };

export interface CollectionView {
  setCode: string | null;
  held: number;
  total: number;
  pct: number;
  secrets: string;
  prototypes: string;
  lastPulls: MiniCard[];
}

export function collectionView(c: SiteCollection, pulls = 5): CollectionView {
  const set = c.sets[0];
  const factionOf = new Map(c.cards.map((x) => [x.cardId, x.faction]));
  const lastPulls: MiniCard[] = [];
  for (const p of c.recentPulls) {
    for (const k of p.cards) {
      if (lastPulls.length >= pulls) break;
      lastPulls.push({ cardId: k.cardId, name: k.name, rarity: k.rarity, faction: factionOf.get(k.cardId) ?? null, finish: k.finish, serial: k.serial });
    }
  }
  if (!set) return { setCode: null, held: 0, total: 0, pct: 0, secrets: "", prototypes: "", lastPulls };
  return {
    setCode: set.setCode,
    held: set.base.held,
    total: set.base.total,
    pct: set.base.total > 0 ? Math.floor((set.base.held / set.base.total) * 100) : 0,
    secrets: `Secrets ${set.secrets.held}/${set.secrets.total}`,
    prototypes: `Prototypes ${set.prototypes.runsHeld}/${set.prototypes.runs}`,
    lastPulls,
  };
}

/** The Showcase's best cards: the rarest finish first, then rarity, then
 * name; one of each card and finish. */
export function bestCards(c: SiteCollection, n: number): MiniCard[] {
  const all: (MiniCard & { score: number })[] = [];
  const seen = new Set<string>();
  for (const card of c.cards) {
    for (const k of card.copies) {
      const key = `${card.cardId}|${k.finish}|${k.secretCode ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push({ cardId: card.cardId, name: card.name, rarity: card.rarity, faction: card.faction, finish: k.finish, serial: k.serial, score: (FINISH_RANK[k.finish] ?? 1) * 10 + (RARITY_RANK[card.rarity] ?? 0) });
    }
  }
  all.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return all.slice(0, n).map(({ score: _s, ...m }) => m);
}

/** `GET /api/packs`, the parts the widget reads. */
export interface SitePacks {
  offer: { setCode: string; name: string; priceCredits: number }[];
  bulkOpenCount: number;
  unopened: { packId: string; setCode: string; source: string; acquiredAt: string }[];
  /** The pity timers: packs opened since each, and whether the next pack
   * is guaranteed one (the thresholds are the store's, not sent). */
  pity: { packsSinceFullArt: number; packsSinceMythic: number; next: { fullArt: boolean; mythic: boolean } };
  /** The owner's free daily pack (session 65), the same as `GET /api/packs/daily`. */
  dailyPack: SiteDailyPack;
}

export interface PacksView {
  head: string;
  unopened: number;
  setCode: string | null;
  setName: string;
  price: number | null;
  canBuy: boolean;
  canBuy10: boolean;
  canOpen: boolean;
  canOpenBulk: boolean;
  bulk: number;
  pity: string;
}

/** The pity timers in words: what the next pack is sure to hold, else how
 * long it has been. */
export function pityLine(pity: SitePacks["pity"]): string {
  const sure = [pity.next.fullArt ? "a Full Art or better" : "", pity.next.mythic ? "a Mythic" : ""].filter(Boolean);
  if (sure.length) return `Your next pack is sure to hold ${sure.join(" and ")}.`;
  const n = (k: number) => `${k} pack${k === 1 ? "" : "s"}`;
  return `${n(pity.packsSinceFullArt)} since a Full Art · ${n(pity.packsSinceMythic)} since a Mythic`;
}

export function packsView(p: SitePacks, credits: number): PacksView {
  const offer = p.offer[0] ?? null;
  const n = p.unopened.length;
  return {
    head: n === 0 ? "No packs waiting" : `${n} unopened pack${n === 1 ? "" : "s"}`,
    unopened: n,
    setCode: offer?.setCode ?? null,
    setName: offer?.name ?? "",
    price: offer?.priceCredits ?? null,
    canBuy: !!offer && credits >= offer.priceCredits,
    canBuy10: !!offer && credits >= offer.priceCredits * 10,
    canOpen: n > 0,
    canOpenBulk: n >= p.bulkOpenCount,
    bulk: p.bulkOpenCount,
    pity: pityLine(p.pity),
  };
}

/** What a waiting widget says it waits on (the game lane's "Not built yet"
 * list in OWNER_API.md), and what it will show. */
export const WIDGET_WAITS: Partial<Record<WidgetType, { needs: string; will: string }>> = {
  // Empty since render session 65: Ladder, Rating & form and Notifications
  // draw the server's data (siteStanding.ts). Kept for a widget a later
  // season adds before its data is served.
};
