// The notifications bell in the top bar (render session 70; owner 2026-11-05:
// "the top bar's bell and the Notifications widget"; owner 2026-11-12: "the
// bell may mark what its panel shows when it is opened").
//
// The bell button carries the unread count (`GET /api/notifications?limit=1`
// on the status poll, as server/OWNER_API.md says the website does). Pressed,
// it opens a panel under the top bar: the newest 20, grouped Today /
// Yesterday / Earlier, filters by kind with each kind's unread count (the
// server's `kind`), "Show older" (the server's `before`), a clear button on
// each (`POST /api/notifications/clear`), Mark all read and Clear all. What
// the panel shows is marked read on the server as it is shown (only those
// ids), and keeps its "new" mark for as long as the panel stays open, so the
// owner still sees what was new.
//
// Everything here is pure (state in, HTML or new state out): the page's
// client (siteClient.ts) holds one BellState, calls the API and redraws.

import type { NotificationKind } from "@ai-tcg/economy";
import { esc } from "./siteModel.js";
import { KIND_INFO, kindGlyph, noticeView, type SiteNotification, type SiteNotifications } from "./siteStanding.js";
import type { MiniCard } from "./siteBoard.js";

export const BELL_PAGE = 20;
/** The server takes 1 to 100 ids in one read or clear. */
export const BELL_MAX_IDS = 100;
export const BELL_KINDS = Object.keys(KIND_INFO) as NotificationKind[];
/** The filter chips' short names (the five fit one row of the panel). */
const CHIP_NAMES: Record<NotificationKind, string> = { matchResult: "Matches", bigPull: "Big pulls", dailyPack: "Daily pack", autoPlayStopped: "Auto-play" };

export interface BellState {
  open: boolean;
  /** null: every kind. */
  filter: NotificationKind | null;
  /** The shown feed for the filter, newest first (pages appended). */
  items: SiteNotification[];
  more: boolean;
  unread: number;
  unreadByKind: Record<NotificationKind, number>;
  /** The first page (opening, a filter) is being read. */
  loading: boolean;
  loadingMore: boolean;
  /** Mark all read or a clear is on its way. */
  busy: boolean;
  error: string | null;
  /** Unread when this opening showed them: drawn as new until it closes. */
  fresh: number[];
  /** The newest id the bell has seen; null before the first read. */
  latestId: number | null;
  /** Bumped when an unread one newer than `latestId` arrives (the bell swings). */
  rings: number;
}

export function emptyBell(): BellState {
  return { open: false, filter: null, items: [], more: false, unread: 0, unreadByKind: zeroKinds(), loading: false, loadingMore: false, busy: false, error: null, fresh: [], latestId: null, rings: 0 };
}

function zeroKinds(): Record<NotificationKind, number> {
  return Object.fromEntries(BELL_KINDS.map((k) => [k, 0])) as Record<NotificationKind, number>;
}

/** The badge's words: up to 99, then "99+". */
export function badgeText(unread: number): string {
  return unread > 99 ? "99+" : String(Math.max(0, Math.floor(unread)));
}

/** A poll's read (any page: the bell's `limit=1`, the widget's 20): the
 * counts, and whether something new and unread came in since the last one
 * (the bell swings once for it; the first read only sets the mark). */
export function withCounts(s: BellState, page: SiteNotifications): BellState {
  const newest = page.notifications[0] ?? null;
  // Only an unfiltered page says what the newest of all is.
  const top = newest ? newest.notificationId : null;
  const arrived = s.latestId !== null && newest !== null && newest.notificationId > s.latestId && newest.readAt === null;
  return {
    ...s,
    unread: page.unread,
    unreadByKind: { ...zeroKinds(), ...page.unreadByKind },
    latestId: top === null ? s.latestId : Math.max(top, s.latestId ?? 0),
    rings: arrived ? s.rings + 1 : s.rings,
  };
}

/** A page for the panel: the first (replaces the feed) or an older one
 * (appended), deduplicated by id and kept newest first. */
export function withPage(s: BellState, page: SiteNotifications, append: boolean): BellState {
  const seen = new Set<number>();
  const items = (append ? [...s.items, ...page.notifications] : [...page.notifications])
    .filter((n) => (seen.has(n.notificationId) ? false : (seen.add(n.notificationId), true)))
    .sort((a, b) => b.notificationId - a.notificationId);
  const fresh = new Set(s.fresh);
  for (const n of items) if (n.readAt === null) fresh.add(n.notificationId);
  // A filtered page's newest isn't the newest of all: counts only.
  const counted = s.filter === null ? withCounts(s, page) : { ...s, unread: page.unread, unreadByKind: { ...zeroKinds(), ...page.unreadByKind } };
  return { ...counted, items, more: page.more, fresh: [...fresh].sort((a, b) => b - a), loading: false, loadingMore: false, error: null };
}

/** The ids the panel shows that the server still has unread: the ones to
 * mark read now (at most 100 per call; the newest first). */
export function unreadShown(s: BellState): number[] {
  return s.items.filter((n) => n.readAt === null).map((n) => n.notificationId).slice(0, BELL_MAX_IDS);
}

/** After `POST /api/notifications/read`: those ids read at `at`, and the
 * server's unread count. Per-kind counts are lowered by what was marked. */
export function withRead(s: BellState, ids: number[] | "all", unread: number, at: string): BellState {
  const marks = ids === "all" ? null : new Set(ids);
  const byKind = { ...s.unreadByKind };
  const items = s.items.map((n) => {
    if (n.readAt !== null || (marks && !marks.has(n.notificationId))) return n;
    byKind[n.kind] = Math.max(0, (byKind[n.kind] ?? 0) - 1);
    return { ...n, readAt: at };
  });
  return { ...s, items, unread, unreadByKind: ids === "all" ? zeroKinds() : byKind, busy: false };
}

/** After `POST /api/notifications/clear`: gone from the feed. A cleared
 * unread one is read too (the server's rule), so the per-kind count drops. */
export function withCleared(s: BellState, ids: number[] | "all", unread: number): BellState {
  if (ids === "all") return { ...s, items: [], more: false, unread, unreadByKind: zeroKinds(), fresh: [], busy: false };
  const gone = new Set(ids);
  const byKind = { ...s.unreadByKind };
  for (const n of s.items) if (gone.has(n.notificationId) && n.readAt === null) byKind[n.kind] = Math.max(0, (byKind[n.kind] ?? 0) - 1);
  return { ...s, items: s.items.filter((n) => !gone.has(n.notificationId)), unread, unreadByKind: byKind, fresh: s.fresh.filter((id) => !gone.has(id)), busy: false };
}

/** Closing forgets what was new and the older pages (the next opening reads
 * the newest again); the counts stay. */
export function closed(s: BellState): BellState {
  return { ...s, open: false, fresh: [], items: [], more: false, loading: false, loadingMore: false, error: null, filter: null };
}

/** The local calendar day of a time (YYYY-MM-DD), for the panel's groups. */
export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Today", "Yesterday" or "Earlier" for a notification's time. */
export function dayGroup(createdAt: string, now: number, dayOf: (ms: number) => string = localDay): "Today" | "Yesterday" | "Earlier" {
  const t = Date.parse(createdAt);
  if (isNaN(t)) return "Earlier";
  const d = dayOf(t);
  if (d === dayOf(now)) return "Today";
  // Yesterday is a day's worth back, or 23 hours back after a short day
  // (a clock change), whichever isn't today.
  const yesterday = [dayOf(now - 86_400_000), dayOf(now - 82_800_000)].filter((y) => y !== dayOf(now));
  if (yesterday.includes(d)) return "Yesterday";
  return "Earlier";
}

const BELL_PATH = '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>';

/** The top bar's bell button's insides and its accessible name. */
export function bellButton(s: BellState): { html: string; label: string } {
  const label = s.unread ? `Notifications, ${s.unread} unread` : "Notifications, nothing unread";
  const badge = s.unread ? `<b class="bl-badge" aria-hidden="true">${badgeText(s.unread)}</b>` : "";
  return { html: `<svg class="bl-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BELL_PATH}</svg>${badge}`, label };
}

export interface BellOpts {
  now: number;
  miniCard: (c: MiniCard) => string;
  factionOf?: (cardId: string) => string | null;
  dayOf?: (ms: number) => string;
}

function chips(s: BellState): string {
  const all = `<button type="button" class="bl-chip" data-act="bell-filter" data-kind="" aria-pressed="${s.filter === null}" aria-label="All${s.unread ? `, ${s.unread} unread` : ""}">All${s.unread ? ` <b>${badgeText(s.unread)}</b>` : ""}</button>`;
  const kinds = BELL_KINDS.map((k) => {
    const n = s.unreadByKind[k] ?? 0;
    return `<button type="button" class="bl-chip" data-act="bell-filter" data-kind="${k}" aria-pressed="${s.filter === k}" style="--k:${KIND_INFO[k].hue}" aria-label="${esc(KIND_INFO[k].name)}${n ? `, ${n} unread` : ""}"><i class="bl-dot" aria-hidden="true"></i><span>${esc(CHIP_NAMES[k])}</span>${n ? ` <b>${badgeText(n)}</b>` : ""}</button>`;
  }).join("");
  return `<div class="bl-chips" role="group" aria-label="Show">${all}${kinds}</div>`;
}

function emptyText(filter: NotificationKind | null): string {
  if (filter === null) return "Nothing yet. Match results, big pulls, the free daily pack and auto-play stops show here.";
  return `No ${KIND_INFO[filter].name.toLowerCase()} yet.`;
}

/** The panel's insides (the client keeps the frame and redraws these). */
export function bellPanelHtml(s: BellState, o: BellOpts): string {
  const fresh = new Set(s.fresh);
  const allRead = s.unread === 0;
  const head = `<div class="bl-head"><h2 id="bell-title" tabindex="-1">Notifications</h2><small class="muted" aria-live="polite">${allRead ? "All read" : `${s.unread} unread`}</small><span class="sp"></span>`
    + `${allRead ? "" : `<button type="button" class="btn sm" data-act="bell-read-all"${s.busy ? " disabled" : ""}>Mark all read</button>`}</div>`;
  let body: string;
  if (s.error && !s.items.length) {
    body = `<div class="bl-msg"><p>Couldn't read your notifications: ${esc(s.error)}.</p><button type="button" class="btn sm" data-act="bell-retry">Try again</button></div>`;
  } else if (s.loading && !s.items.length) {
    body = `<ul class="bl-list" aria-busy="true">${[0, 1, 2].map(() => `<li class="bl-sk"><i></i><span><b></b><small></small></span></li>`).join("")}</ul>`;
  } else if (!s.items.length) {
    body = `<div class="bl-msg"><p class="muted">${esc(emptyText(s.filter))}</p></div>`;
  } else {
    let group = "";
    const rows: string[] = [];
    for (const n of s.items) {
      const g = dayGroup(n.createdAt, o.now, o.dayOf);
      if (g !== group) {
        if (group) rows.push("</ul>");
        rows.push(`<h3 class="bl-day">${g}</h3><ul class="bl-list">`);
        group = g;
      }
      const v = noticeView(n, o.now, o.factionOf);
      const isNew = fresh.has(v.id);
      const cards = v.cards.length ? `<span class="mrow bl-cards">${v.cards.slice(0, 5).map(o.miniCard).join("")}</span>` : "";
      rows.push(`<li class="bl-n t-${v.tone}${isNew ? " new" : ""}" data-nid="${v.id}">${kindGlyph(v.kind, 32)}<a class="bl-m" href="${v.href}" data-act="bell-go"><b>${esc(v.title)}</b><small class="muted">${esc(v.line)}</small>${cards}</a>`
        + `<span class="bl-w"><small class="muted">${esc(v.when)}</small><span class="bl-wr">${isNew ? `<i class="bl-new">New</i>` : ""}<button type="button" class="bl-x" data-act="bell-clear" data-nid="${v.id}" aria-label="Clear: ${esc(v.title)}" title="Clear">×</button></span></span></li>`);
    }
    rows.push("</ul>");
    const older = s.more ? `<button type="button" class="btn sm bl-older" data-act="bell-older"${s.loadingMore ? " disabled" : ""}>${s.loadingMore ? "Reading…" : "Show older"}</button>` : "";
    const err = s.error ? `<p class="bl-err" role="alert">${esc(s.error)}</p>` : "";
    body = `<div class="bl-feed">${rows.join("")}</div>${err}${older}`;
  }
  const foot = `<div class="bl-foot"><a href="#/settings" data-act="bell-go">Choose which in Settings</a><span class="sp"></span>${s.items.length ? `<button type="button" class="btn sm ghost" data-act="bell-clear-all"${s.busy ? " disabled" : ""}>Clear all</button>` : ""}</div>`;
  return head + chips(s) + `<div class="bl-scroll">${body}</div>` + foot;
}

export const BELL_CSS = `
/* Render session 70: the notifications bell (siteBell.ts). */
#bell-btn { color: var(--ink); }
button.wopen { border: 0; padding: 0; background: none; color: inherit; cursor: pointer; }
#bell-btn .bl-badge { position: absolute; top: -4px; right: -5px; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 99px; display: grid; place-items: center; background: linear-gradient(135deg, #ff4d6d, #ff7a59); color: #fff; font: 800 10.5px ui-rounded, system-ui; font-variant-numeric: tabular-nums; box-shadow: 0 0 0 2px var(--solid); animation: wg-pop .45s cubic-bezier(.3,1.6,.5,1) both; }
#bell-btn[aria-expanded="true"] { background: color-mix(in srgb, var(--accent) 24%, var(--solid)); color: var(--accent); }
#bell-btn.ring .bl-svg { transform-origin: 50% 8%; animation: bl-ring .9s cubic-bezier(.36,.07,.19,.97) both; }
@keyframes bl-ring { 0%,100% { transform: rotate(0); } 15% { transform: rotate(16deg); } 30% { transform: rotate(-14deg); } 45% { transform: rotate(10deg); } 60% { transform: rotate(-6deg); } 75% { transform: rotate(3deg); } }
#bell-panel { position: fixed; right: var(--br, 84px); top: 64px; width: min(460px, calc(100vw - 32px)); max-height: min(640px, calc(100vh - 84px)); display: flex; flex-direction: column; padding: 14px 14px 10px; border-radius: 20px; z-index: 12;
  background: rgba(246,248,255,.86); box-shadow: 0 18px 50px rgba(40,30,120,.22), inset 0 1px 0 rgba(255,255,255,.8); }
body[data-theme="dark"] #bell-panel { background: rgba(20,24,56,.88); box-shadow: 0 18px 50px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.12); }
#bell-panel[hidden] { display: none; }
.bl-head { display: flex; align-items: baseline; gap: 10px; padding: 0 4px 10px; } .bl-head h2 { margin: 0; font: 800 18px system-ui; outline: none; } .bl-head .sp, .bl-foot .sp { flex: 1; }
.bl-chips { display: flex; gap: 5px; flex-wrap: wrap; padding: 0 2px 10px; border-bottom: 1px solid var(--line); }
.bl-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px 3px 4px; white-space: nowrap; border: 0; border-radius: 99px; background: var(--soft); color: inherit; font: 600 12px system-ui; cursor: pointer; box-shadow: var(--soft-edge); }
.bl-chip { padding-left: 9px; } .bl-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--k); box-shadow: 0 0 0 2px color-mix(in srgb, var(--k) 28%, transparent); } .bl-chip b { font-variant-numeric: tabular-nums; color: #e0405f; }
.bl-chip[aria-pressed="true"] { background: color-mix(in srgb, var(--k, var(--accent)) 26%, var(--solid)); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--k, var(--accent)) 75%, transparent); }
.bl-chip:focus-visible, .bl-x:focus-visible, .bl-m:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.bl-scroll { flex: 1; min-height: 0; overflow: auto; margin: 0 -6px; padding: 4px 6px 6px; overscroll-behavior: contain; }
.bl-day { margin: 10px 4px 4px; font: 700 11px system-ui; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.bl-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.bl-n { position: relative; display: grid; grid-template-columns: 32px minmax(0,1fr) auto; gap: 10px; align-items: start; padding: 8px; border-radius: 13px; }
.bl-n:hover { background: var(--soft); }
.bl-n.new { background: color-mix(in srgb, var(--accent) 13%, transparent); } .bl-n.new::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 3px; background: var(--accent); }
.bl-m { display: flex; flex-direction: column; gap: 1px; min-width: 0; color: inherit; text-decoration: none; border-radius: 6px; }
.bl-m b { font-size: 13.5px; line-height: 1.25; } .bl-m small { font-size: 12px; line-height: 1.3; } .bl-m:hover b { text-decoration: underline; }
.bl-n.t-gold .bl-m b { color: #d9a21f; } body[data-theme="dark"] .bl-n.t-gold .bl-m b { color: #f6c445; }
.bl-n.t-w .nk { box-shadow: inset 0 0 0 1.2px #3cc47c; } .bl-n.t-l .nk { box-shadow: inset 0 0 0 1.2px #ff6b81; }
.bl-cards { margin-top: 6px; display: flex; gap: 4px; }
.bl-w { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; white-space: nowrap; } .bl-wr { display: flex; align-items: center; gap: 4px; min-height: 22px; }
.bl-new { font: 800 10px system-ui; font-style: normal; letter-spacing: .04em; text-transform: uppercase; color: var(--accent); }
.bl-x { width: 22px; height: 22px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--muted); font: 600 16px/1 system-ui; cursor: pointer; opacity: 0; }
.bl-n:hover .bl-x, .bl-n:focus-within .bl-x { opacity: .7; } .bl-x:hover, .bl-x:focus-visible { opacity: 1 !important; background: var(--soft); color: var(--ink); }
@media (hover: none) { .bl-x { opacity: .6; } }
.bl-msg { padding: 18px 8px; text-align: center; } .bl-msg p { margin: 0 0 10px; }
.bl-err { color: #e0405f; font-size: 12.5px; margin: 8px 4px; }
.bl-older { display: block; margin: 8px auto 2px; }
.bl-sk { display: grid; grid-template-columns: 32px 1fr; gap: 10px; padding: 8px; } .bl-sk i, .bl-sk b, .bl-sk small { display: block; border-radius: 8px; background: var(--soft); animation: pulse 1.4s ease-in-out infinite; }
.bl-sk i { width: 32px; height: 32px; border-radius: 30%; } .bl-sk span { display: flex; flex-direction: column; gap: 6px; padding-top: 3px; } .bl-sk b { height: 12px; width: 70%; } .bl-sk small { height: 10px; width: 45%; }
.bl-foot { display: flex; align-items: center; gap: 10px; padding: 10px 4px 2px; border-top: 1px solid var(--line); font-size: 12.5px; } .bl-foot a { color: var(--accent); font-weight: 600; }
/* A phone: the bell is one more button in the top bar, so the bar's buttons and title get smaller to keep it in one line, and the
   theme button leaves the bar (Settings -> Theme has the same three choices). */
@media (max-width: 760px) { .topbar { gap: 6px; } #theme-btn { display: none; } .topbar h1 { font-size: 18px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .topbar .tbtn { width: 34px; height: 34px; flex: none; } #acct-btn { font-size: 14px; }
  #bell-btn .bl-svg { width: 17px; height: 17px; } #bell-btn .bl-badge { min-width: 17px; height: 17px; font-size: 10px; } }
@media (max-width: 760px) { #bell-panel { left: 12px; right: 12px; top: 66px; width: auto; max-height: calc(100vh - 80px); } }
@media (prefers-reduced-motion: reduce) { #bell-btn .bl-badge, #bell-btn.ring .bl-svg, .bl-sk i, .bl-sk b, .bl-sk small { animation: none; } }
@media (prefers-reduced-transparency: reduce) { #bell-panel, body[data-theme="dark"] #bell-panel { backdrop-filter: none; -webkit-backdrop-filter: none; background: var(--solid); } }
`;
