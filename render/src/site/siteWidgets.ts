// The Home board's widgets as HTML (Season 0 render item 3, render session
// 46). Pure: each widget is a string built from the owner API's answers, so
// the tests render every widget at every size in Node and the page shows
// exactly that. No DOM, no fetch.
//
// What each size shows is the owner's 2026-10-05 table (section C), trimmed
// to Season 0: a widget whose data the server serves draws it; a widget whose
// data waits on match running says what it waits on (siteBoard.WIDGET_WAITS)
// and draws nothing made up.

import { balanceHtml, cosmeticGridHtml, cosmeticTiles, packGridHtml, packTiles, resetCountdownHtml, sealedPackHtml, type ShopArt } from "./siteShop.js";
import { visualPatternFor, visualSeedFor } from "../cardVisual.js";
import type { SiteHistory, SiteLive, SiteLiveMatch, SitePlay, SiteStore, SiteWallet } from "./siteApi.js";
import { compactBoard, historyRowHtml, historyRowView, liveGroups, liveLineHtml, liveOrder, recordOf, scoreboardHtml, scoreboardOf, topRatedHtml, viewersHtml, watchAsHtml, type Scoreboard } from "./siteMatches.js";
import {
  FINISH_NAMES,
  WIDGET_INFO,
  WIDGET_WAITS,
  bestCards,
  collectionView,
  packsView,
  sizeClass,
  type LiveView,
  type MiniCard,
  type SiteCollection,
  type SiteDaily,
  type SitePacks,
  type SiteWidget,
  type WidgetSize,
  type WidgetType,
} from "./siteBoard.js";
import { agentControlsHtml, myAgentHtml, type SiteRating, type TimeAllowance } from "./siteAgent.js";
import type { SeasonClosed } from "./siteSeason.js";
import { amount } from "./siteLook.js";
import { formBody, ladderBody, notifBody, type SiteLadder, type SiteNotifications, type SiteStats } from "./siteStanding.js";
import { dailyPackView } from "./siteStore.js";
import { dailyBody } from "./siteDaily.js";
import { FACTION_HEX, PAGE_TITLES, esc, hashOf, icon } from "./siteModel.js";

export type WidgetSource = "packs" | "collection" | "daily" | "store" | "live" | "history" | "rating" | "ladder" | "stats" | "notif";

/** Which server reads a widget needs at its size (the page fetches only
 * what the board shows). */
export function sourcesOf(w: Pick<SiteWidget, "type" | "size">): WidgetSource[] {
  switch (w.type) {
    // Render session 57: My agent and Agent controls (the Season 0 brief).
    case "agent":
      return w.size === "S" ? ["rating"] : ["daily", "history", "rating"];
    case "live":
      return w.size === "S" ? [] : w.size === "M" ? ["live"] : ["history", "live"];
    case "packs":
      return w.size === "L" ? ["collection", "packs"] : ["packs"];
    case "daily":
      return w.size === "S" ? ["daily"] : ["daily", "packs"];
    case "collection":
    case "showcase":
      return ["collection"];
    case "store":
      return w.size === "L" ? ["packs", "store"] : ["packs"];
    // Render session 50: the match widgets read the live matches and the history.
    case "watch":
      return ["live"];
    case "history":
      return ["history"];
    // Render session 65: the three that waited on the server. Rating & form
    // reads the ladder at M and L for the tier floors its chart crosses; the
    // Notifications widget at L the collection, for a pulled card's faction.
    case "ladder":
      return ["ladder"];
    case "form":
      return w.size === "S" ? ["stats"] : ["ladder", "stats"];
    case "notif":
      return w.size === "L" ? ["collection", "notif"] : ["notif"];
    default:
      return [];
  }
}

export function sourcesFor(widgets: readonly SiteWidget[]): WidgetSource[] {
  const out = new Set<WidgetSource>();
  for (const w of widgets) for (const s of sourcesOf(w)) out.add(s);
  return [...out].sort();
}

export interface WidgetData {
  play: SitePlay;
  wallet: SiteWallet | null;
  packs: SitePacks | null;
  collection: SiteCollection | null;
  daily: SiteDaily | null;
  store: SiteStore | null;
  /** `GET /api/live` and the first page of `GET /api/matches` (session 50). */
  live: SiteLive | null;
  history: SiteHistory | null;
  /** `GET /api/rating` (render session 57: My agent). Absent: not read. */
  rating?: SiteRating | null;
  /** Render session 65: `GET /api/ladder`, `GET /api/stats`,
   * `GET /api/notifications`. Absent: not read. */
  ladder?: SiteLadder | null;
  stats?: SiteStats | null;
  notif?: SiteNotifications | null;
  /** The play-time allowance (Agent controls' ring); null until the server
   * has one (game session 76). */
  allowance?: TimeAllowance | null;
  /** A play setting being saved (the dial, the deck switcher). */
  busy?: boolean;
  /** Render session 72: the season has ended or is ending; Agent controls
   * stops offering Start and time. */
  closed?: SeasonClosed | null;
  /** The viewer (to mark their own side on a scoreboard). */
  ownerId: string | null;
  /** The side the viewer chose to watch a match as (render session 52; kept
   * for the tab), or null for the default. Absent: always the default. */
  viewOf?: (matchId: string) => "p1" | "p2" | null;
  /** A read that failed, with the words to show. */
  errors: Partial<Record<WidgetSource, string>>;
  now: number;
  /** The Large Collection widget's faction filter. */
  colFilter: string;
  /** The sealed pack's plate (render session 63, siteShop.ShopArt); absent
   * or null: the pack without its plate. */
  art?: ShopArt | null;
}

export interface WidgetOpts {
  editing: boolean;
  live?: LiveView;
  capped?: boolean;
  /** The match the embedded arena shows (render session 67; the page keeps
   * it), and whether its feed has ended (it is held a moment for its
   * result and boast, then the next match takes the tile). Absent: the
   * first live match. */
  arena?: { matchId: string; ended: boolean } | null;
}


function agentFaction(p: SitePlay): string | null {
  return p.activeDeck?.faction ?? p.factionLock ?? p.rebuild.job?.result?.faction ?? null;
}

/** A card as a widget draws it: the placeholder face (faction palette, the
 * card's own hue and pattern, a rarity gem, the finish named), never an
 * emoji or glyph (DESIGN.md's art section). */
export function miniCard(c: MiniCard, opts: { count?: number; scale?: number } = {}): string {
  const fin = FINISH_NAMES[c.finish] ?? c.finish;
  const hex = (c.faction && FACTION_HEX[c.faction]) || FACTION_HEX.Neutral!;
  const serial = c.serial !== null && c.finish === "prototype" ? ` #${c.serial}` : "";
  // Render session 66: the Showcase draws the same face larger (--k scales
  // every inset and type size with the card, so it is the face, not a zoom).
  const lg = opts.scale && opts.scale !== 1 ? ` lg` : "";
  const k = lg ? `;--k:${opts.scale}` : "";
  return `<div class="mc fin-${esc(c.finish)} r-${esc(c.rarity)}${lg}" style="--c:${hex};--h:${visualSeedFor(c.cardId)}${k}" title="${esc(`${c.name} · ${c.rarity}${fin ? ` · ${fin}` : ""}${serial}`)}">`
    + `<span class="mc-art p${visualPatternFor(c.cardId)}"></span><span class="mc-gem" aria-hidden="true"></span>`
    + `<b class="mc-n">${esc(c.name)}</b>${fin ? `<span class="mc-fin">${esc(fin + serial)}</span>` : ""}${opts.count && opts.count > 1 ? `<span class="mc-cnt">×${opts.count}</span>` : ""}</div>`;
}

/** The Showcase's sizes (render session 66; the brief: "keep what exists;
 * cards drawn larger"): how many of the best cards, and how large. */
export const SHOWCASE_SIZES = { S: { n: 1, scale: 0.8 }, M: { n: 3, scale: 1.55 }, L: { n: 6, scale: 2 } } as const;

/** A showcased card: the face larger, its name and what makes it rare under it. */
function showcaseCard(c: MiniCard, scale: number, caption: boolean): string {
  const fin = FINISH_NAMES[c.finish] ?? c.finish;
  const serial = c.serial !== null && c.finish === "prototype" ? ` #${c.serial}` : "";
  const what = [c.rarity, fin ? fin + serial : ""].filter(Boolean).join(" · ");
  return `<figure class="scw">${miniCard(c, { scale })}${caption ? `<figcaption><b>${esc(c.name)}</b><small>${esc(what)}</small></figcaption>` : ""}</figure>`;
}

function waitsBody(type: WidgetType, size: WidgetSize): string {
  const w = WIDGET_WAITS[type];
  if (!w) return `<p class="muted small">Not in Season 0.</p>`;
  return `<div class="wwait">${size === "S" ? "" : `<p>${esc(w.will)}</p>`}<p class="muted small">Waits on the server for ${esc(w.needs)}.</p></div>`;
}

function loading(data: WidgetData, src: WidgetSource): string | null {
  const err = data.errors[src];
  if (err) return `<p class="muted small">Couldn't load this: ${esc(err)}</p>`;
  return data[src] ? null : `<p class="muted small wload">Loading…</p>`;
}

function ladderWidget(w: SiteWidget, d: WidgetData): string {
  return loading(d, "ladder") ?? ladderBody(w.size, d.ladder!);
}

function formWidget(w: SiteWidget, d: WidgetData): string {
  // The tier floors are a garnish on the chart: a ladder read still out or
  // failed draws the chart without them rather than holding the widget.
  return loading(d, "stats") ?? formBody(w.size, d.stats!, d.ladder?.tiers ?? null, d.now);
}

function notifWidget(w: SiteWidget, d: WidgetData): string {
  const l = loading(d, "notif");
  if (l) return l;
  const fac = new Map((d.collection?.cards ?? []).map((x) => [x.cardId, x.faction]));
  return notifBody(w.size, d.notif!, d.now, { miniCard: (c) => miniCard(c), factionOf: (id) => fac.get(id) ?? null, busy: d.busy });
}

function liveBody(w: SiteWidget, d: WidgetData, o: WidgetOpts): string {
  const view = o.live ?? "scoreboard";
  const note = o.capped ? `<p class="muted small wcap">Scoreboard only: two live boards are already showing.</p>` : "";
  const l = loading(d, "live");
  if (l) return l + note;
  const live = d.live!;
  if (!live.running) return `<p class="muted small">The ladder isn't running on this server, so nothing is live.</p>${note}`;
  // Render session 71: the featured matches first (Top rated, in the
  // server's order), then the rest; the first is the one shown big.
  const ordered = liveOrder(live);
  const sbs = ordered.map((m) => scoreboardOf(m, d.ownerId, d.viewOf?.(m.matchId) ?? null));
  // The tile's arena holds its match a moment after it ends (its result
  // and boast), also when the round is over and nothing else is live yet.
  if (w.size === "L" && view === "arena" && o.arena) return arenaBody(w, live, ordered, sbs, o) + note;
  if (!ordered.length) return `<p class="muted small">No match is live right now. The next ladder round starts soon.</p>${note}`;
  if (w.size === "L" && view === "arena") return arenaBody(w, live, ordered, sbs, o) + note;
  // S: the first match's scoreboard; M: its scoreboard and the others as
  // one line each; L: the first on the compact board, the list alongside.
  // The point of view (owner 2026-11-02): the "Watch as" switch on the
  // first match at M and L (S has no room); never on the viewer's own match.
  const first = (w.size === "S" ? "" : matchTagsHtml(live, ordered[0]!)) + scoreboardHtml(sbs[0]!, { small: w.size !== "L" }) + (w.size === "L" && view === "board" ? compactBoard(ordered[0]!, sbs[0]!.near) : "") + (w.size === "S" ? "" : watchAsHtml(sbs[0]!, `wa-${w.id}`));
  const rest = sbs.slice(1);
  const list = w.size === "S" || !rest.length ? "" : linesHtml(live, ordered.slice(1), rest);
  const boards = w.size === "L" ? `<div class="wsplit wide-l"><div class="wcol">${first}</div><div class="wcol"><h4>Also live</h4>${list || '<p class="muted small">No other match is live.</p>'}</div></div>` : first + list;
  // S is the score alone (render session 67): the header's arrow opens Watch live.
  const more = w.size === "S" ? "" : `<div class="row"><a class="btn sm" href="#/live">Watch live</a><span class="muted small">${liveCountText(live)}</span></div>`;
  return `${boards}${more}${note}`;
}

/** "5 live · 3 top rated" (render session 71). */
function liveCountText(live: SiteLive): string {
  const top = liveGroups(live).topRated.length;
  return `${live.matches.length} live${top ? ` · ${top} top rated` : ""}`;
}

/** Over the first match: its Top rated chip and viewer count. */
function matchTagsHtml(live: SiteLive, m: SiteLiveMatch): string {
  const tags = topRatedHtml(live, m) + viewersHtml(m.viewers);
  return tags ? `<div class="mtags">${tags}</div>` : "";
}

/** The other live matches, one line each, with their rank and viewers. */
function linesHtml(live: SiteLive, ms: readonly SiteLiveMatch[], sbs: readonly Scoreboard[]): string {
  return `<ul class="lines">${sbs.map((sb, i) => liveLineHtml(sb, topRatedHtml(live, ms[i]!, { short: true }) + viewersHtml(ms[i]!.viewers))).join("")}</ul>`;
}

/** The arena the tile embeds: its match, or null when that match has
 * left the live list (ended, held for its result). With nothing held, the
 * first in Watch live's order (the top pick, render session 71). */
export function arenaMatchOf(live: SiteLive, o: Pick<WidgetOpts, "arena">): { matchId: string; index: number } {
  const ordered = liveOrder(live);
  const id = o.arena?.matchId ?? ordered[0]?.matchId ?? "";
  return { matchId: id, index: ordered.findIndex((m) => m.matchId === id) };
}

/** Watch live at L (the brief's table, render session 67): the live match
 * on the real arena, embedded in the tile, with its scoreboard and "Watch
 * as" beside it and the other live matches under them. The page puts the
 * arena's frame into `.wl-frame` and keeps it across redraws (only
 * `.wl-info` is redrawn while the match is the same). Under 720 px, or
 * before the frame has loaded, the compact board stands in. Clicking the
 * arena opens it full screen. `ordered` and `sbs` are in Watch live's order. */
function arenaBody(w: SiteWidget, live: SiteLive, ordered: readonly SiteLiveMatch[], sbs: Scoreboard[], o: WidgetOpts): string {
  const { matchId, index } = arenaMatchOf(live, o);
  const sb = index >= 0 ? sbs[index]! : null;
  const ended = !sb || !!o.arena?.ended;
  const label = sb ? `${sb.p1.agentName} vs ${sb.p2.agentName}` : "the match";
  const othersM = ordered.filter((_, i) => i !== index);
  const others = sbs.filter((_, i) => i !== index);
  const stage = sb
    ? `<div class="wl-fallback">${compactBoard(ordered[index]!, sb.near)}</div>`
    : `<div class="wl-fallback"><p class="muted small">The match is over.</p></div>`;
  const arena = `<div class="wl-arena" data-match="${esc(matchId)}" data-ended="${ended}"><div class="wl-frame" aria-hidden="true"></div><div class="wl-wait" aria-hidden="true">Joining the match…</div>${stage}<button type="button" class="wl-open" data-act="watch-arena" data-match="${esc(matchId)}" aria-label="${esc(`Watch ${label} full screen on the arena`)}"${sb ? "" : " disabled"}><span>${icon("arrow", 12)} Full screen</span></button></div>`;
  const head = sb
    ? matchTagsHtml(live, ordered[index]!) + scoreboardHtml(sb, { small: true }) + watchAsHtml(sb, `wa-${w.id}`)
    : `<p class="small"><b>Match over.</b> <span class="muted">Its result and replay are in your match history. The next live match takes this tile in a moment.</span></p>`;
  const list = others.length ? linesHtml(live, othersM, others) : `<p class="muted small">${sb ? "No other match is live." : "No match is live right now. The next ladder round starts soon."}</p>`;
  const info = `<div class="wl-info">${head}<h4>Also live</h4>${list}<div class="row"><a class="btn sm" href="#/live">Watch live</a><span class="muted small">${liveCountText(live)}</span></div></div>`;
  return `<div class="wl-l">${arena}${info}</div>`;
}

function historyBody(w: SiteWidget, d: WidgetData): string {
  const l = loading(d, "history");
  if (l) return l;
  const h = d.history!;
  if (!h.matches.length) return `<p class="muted small">No matches yet. Your results and their replays show here.</p>`;
  const rows = h.matches.map((r) => historyRowView(r, d.now));
  if (w.size === "S") {
    const r = rows[0]!;
    return `<div class="row nowrap"><span class="wl big ${r.tone}" aria-hidden="true">${esc(r.letter)}</span><div><b>${esc(r.word)}</b><div class="small">${esc(r.versus)}</div><div class="muted small">${esc(r.credits)} · ${esc(r.rating)}</div></div></div>`;
  }
  const shown = w.size === "M" ? rows.slice(0, 6) : rows;
  const rec = recordOf(h.matches.slice(0, shown.length));
  return `<div class="muted small">Last ${shown.length} of ${h.total} · ${esc(rec.line)}</div><ul class="hlist">${shown.map((v) => historyRowHtml(v, { compact: w.size === "M" })).join("")}</ul>${w.size === "L" && h.more ? `<a class="btn sm" href="#/match">All matches</a>` : ""}`;
}

/** The pity counters as chips (render session 63): packs since each, or
 * that the next is sure to hold one (the server's flags; the thresholds are
 * the store's and not sent). */
export function pityChips(pity: SitePacks["pity"]): string {
  const chip = (sure: boolean, n: number, what: string) =>
    sure ? `<span class="sure"><b>Next</b> sure to hold ${what === "Full Art" ? "a Full Art or better" : "a Mythic"}</span>` : `<span><b>${n}</b> since a ${what}</span>`;
  return `<div class="pity" aria-label="Pity counters">${chip(pity.next.fullArt, pity.packsSinceFullArt, "Full Art")}${chip(pity.next.mythic, pity.packsSinceMythic, "Mythic")}</div>`;
}

/** The unopened packs as a little pile with the count on it (the Packs
 * widget's art). */
function packStackHtml(setCode: string, px: number, n: number, art: ShopArt | null | undefined): string {
  const back = n > 1 ? `<div class="pkw-back">${sealedPackHtml(setCode, px, art, { meta: false })}</div>` : "";
  return `<div class="pkw-pile${n ? "" : " none"}">${back}<div class="pkw-front">${sealedPackHtml(setCode, px, art)}</div>${n ? `<b class="pkw-c" aria-hidden="true">${n}</b>` : ""}</div>`;
}

function packsBody(w: SiteWidget, d: WidgetData): string {
  const l = loading(d, "packs");
  if (l) return l;
  const p = d.packs!;
  const v = packsView(p, d.wallet?.credits ?? 0);
  const set = v.setCode ?? p.dailyPack.setCode;
  // Session 47: Open opens the oldest pack, Open 10 the ten oldest, full screen.
  // Render session 63 (the brief's table): S the pack, the count and Open;
  // M a bigger pack, Open and Open 10, the pity counters; L the last pulls too.
  const open = `<button type="button" class="btn pri sm" data-act="open-packs" data-count="1"${v.canOpen ? "" : " disabled"}>Open</button>`;
  const count = `<p class="pkw-n">${v.unopened}<small>unopened</small></p>`;
  if (w.size === "S") return `<div class="pkw">${packStackHtml(set, 44, v.unopened, d.art)}<div class="dn">${count}<div class="row">${open}</div></div></div><span class="vh">${esc(v.head)}</span>`;
  const open10 = `<button type="button" class="btn sm" data-act="open-packs" data-count="${v.bulk}"${v.canOpenBulk ? "" : ` disabled title="Needs ${v.bulk} packs waiting"`}>Open ${v.bulk}</button>`;
  const m = `<div class="pkw">${packStackHtml(set, 84, v.unopened, d.art)}<div class="dn"><p class="pkw-n">${v.unopened}<small>unopened pack${v.unopened === 1 ? "" : "s"}</small></p><div class="muted small">${esc(v.setName || set)} · 5 cards a pack</div>${pityChips(p.pity)}<div class="row">${open}${open10}</div>${v.unopened && !v.canOpenBulk ? `<div class="muted small">Open ${v.bulk} needs ${v.bulk} waiting.</div>` : ""}</div></div>`;
  if (w.size === "M") return m;
  const c = d.collection;
  const factionOf = new Map((c?.cards ?? []).map((x) => [x.cardId, x.faction]));
  const pulls = (c?.recentPulls ?? []).slice(0, 2);
  const strip = pulls.length
    ? pulls.map((o) => `<div class="muted small">${esc(clock(o.openedAt))} · ${esc(o.setCode)}${o.jackpot ? " · Jackpot pack" : ""}</div><div class="mrow">${o.cards.map((k) => miniCard({ cardId: k.cardId, name: k.name, rarity: k.rarity, faction: factionOf.get(k.cardId) ?? null, finish: k.finish, serial: k.serial })).join("")}</div>`).join("")
    : `<div class="muted small">${c ? "Your last pulls appear here" : "Loading your last pulls…"}</div>`;
  return `<div class="wsplit wide-l">${m}<div class="wcol pkw-pulls"><h4>Your last pulls</h4>${strip}</div></div>`;
}

function dailyWidget(w: SiteWidget, d: WidgetData): string {
  // Render session 66: the free pack's node (M and L) is a garnish on the
  // row: a packs read still out draws the node as loading, not the widget.
  return loading(d, "daily") ?? dailyBody(w.size, d.daily!, d.packs?.dailyPack ?? null, d.now);
}

const FACTION_FILTERS = ["All", "Cortex", "Aegis", "Swarm", "Null", "Neutral"];

function collectionBody(w: SiteWidget, d: WidgetData): string {
  const l = loading(d, "collection");
  if (l) return l;
  const c = d.collection!;
  const v = collectionView(c);
  const ring = `<div class="row nowrap"><div class="ring" style="--p:${v.pct}" role="img" aria-label="${v.pct}% of the set"><b>${v.pct}%</b></div><div><b>${v.held}/${v.total}</b> <span class="muted small">${esc(v.setCode ?? "No set")} cards</span>${w.size === "S" ? "" : `<div class="muted small">${esc(v.secrets)} · ${esc(v.prototypes)}</div><div class="muted small">${amount(c.copies)} copies in all</div>`}</div></div>`;
  if (w.size === "S") return ring;
  if (w.size === "M") return ring + `<div class="muted small">Last ${v.lastPulls.length} pulls</div><div class="mrow">${v.lastPulls.map((k) => miniCard(k)).join("") || '<span class="muted small">No packs opened yet.</span>'}</div>`;
  const f = FACTION_FILTERS.includes(d.colFilter) ? d.colFilter : "All";
  const held = c.cards.filter((x) => f === "All" || (x.faction ?? "Neutral") === f);
  const pills = `<div class="pills" role="group" aria-label="Faction">${FACTION_FILTERS.map((x) => `<button type="button" class="pill${x === f ? " on" : ""}" data-act="col-filter" data-f="${x}" aria-pressed="${x === f}">${x}</button>`).join("")}</div>`;
  return ring + pills + `<div class="mbinder">${held.map((x) => miniCard({ cardId: x.cardId, name: x.name, rarity: x.rarity, faction: x.faction, finish: "standard", serial: null }, { count: x.owned })).join("") || '<span class="muted small">No cards of this faction.</span>'}</div>`;
}

function showcaseBody(w: SiteWidget, d: WidgetData): string {
  const l = loading(d, "collection");
  if (l) return l;
  const z = SHOWCASE_SIZES[w.size];
  const cards = bestCards(d.collection!, z.n);
  if (!cards.length) return `<p class="muted small">Your best cards show here once you hold some.</p>`;
  if (w.size === "S") {
    // S: the best card, with its name and finish beside it (no room under).
    const c = cards[0]!;
    const fin = FINISH_NAMES[c.finish] ?? c.finish;
    return `<div class="sc-s">${showcaseCard(c, z.scale, false)}<div class="dn"><b>${esc(c.name)}</b><div class="muted small">${esc(c.rarity)}${fin ? ` · ${esc(fin)}` : ""}</div><div class="muted small">Your best card</div></div></div>`;
  }
  return `<div class="sc-row">${cards.map((k) => showcaseCard(k, z.scale, true)).join("")}</div>${w.size === "L" ? `<p class="muted small">Your rarest finishes first. Pinning cards comes with the Collection page.</p>` : ""}`;
}

function storeBody(w: SiteWidget, d: WidgetData): string {
  const l = loading(d, "packs") ?? (w.size === "L" ? loading(d, "store") : null);
  if (l) return l;
  const p = d.packs!;
  const credits = d.wallet?.credits ?? 0;
  // Render session 63 (the brief's table): S claims the free pack; M the
  // product tiles with their buy buttons underneath; L the store's layout
  // (packs and cosmetics) with the balance and the countdown.
  if (w.size === "S") {
    const daily = dailyPackView(p.dailyPack, d.now);
    const claim = `<button type="button" class="btn pri sm" data-act="claim-daily"${daily.canClaim ? "" : " disabled"}>${esc(daily.canClaim ? (daily.waiting > 1 ? `Claim (${daily.waiting})` : "Claim free pack") : "Claimed today")}</button>`;
    return `<div class="shw-s">${sealedPackHtml(p.dailyPack.setCode, 40, d.art)}<div class="dn"><b>${daily.canClaim ? "Free daily pack" : "Free pack claimed"}</b><div class="row">${claim}</div>${resetCountdownHtml(p.dailyPack, d.now, { short: true })}</div></div>`;
  }
  const tiles = packGridHtml(packTiles(p, credits, d.now), { art: d.art, compact: true });
  if (w.size === "M") return `<div class="shw">${tiles}</div>`;
  const cos = cosmeticGridHtml(cosmeticTiles(d.store!.cosmetics, credits), { art: d.art, compact: true });
  return `<div class="shw"><div class="shw-head">${balanceHtml(credits)}${resetCountdownHtml(p.dailyPack, d.now)}</div>${tiles}<h4>Cosmetics</h4>${cos}</div>`;
}

function bodyOf(w: SiteWidget, d: WidgetData, o: WidgetOpts): string {
  switch (w.type) {
    case "agent":
      return myAgentHtml(w.size, agentData(d));
    case "live":
      return agentControlsHtml(w.size, agentData(d));
    case "watch":
      return liveBody(w, d, o);
    case "packs":
      return packsBody(w, d);
    case "daily":
      return dailyWidget(w, d);
    case "collection":
      return collectionBody(w, d);
    case "showcase":
      return showcaseBody(w, d);
    case "store":
      return storeBody(w, d);
    case "history":
      return historyBody(w, d);
    case "ladder":
      return ladderWidget(w, d);
    case "form":
      return formWidget(w, d);
    case "notif":
      return notifWidget(w, d);
    default:
      return waitsBody(w.type, w.size);
  }
}

function agentData(d: WidgetData): Parameters<typeof myAgentHtml>[1] {
  const { rating, daily, history, live } = d.errors;
  return { play: d.play, rating: d.rating ?? null, daily: d.daily, history: d.history, live: d.live, allowance: d.allowance ?? null, errors: { rating, daily, history, live }, now: d.now, busy: d.busy, closed: d.closed ?? null };
}

/** One widget: the glass tile, its icon and title, the open button (or in
 * Customise mode the S/M/L picker and "−"), and its body. */
export function widgetHtml(w: SiteWidget, d: WidgetData, o: WidgetOpts): string {
  const info = WIDGET_INFO[w.type];
  const dark = info.live ? " wg-dark" : "";
  const hero = (w.type === "agent" || w.type === "live") && d.play.connectedAgent ? " hero" : "";
  const fac = hero ? agentFaction(d.play) : null;
  const style = hero ? ` style="--c:${(fac && FACTION_HEX[fac]) || "#8f8cff"}"` : "";
  const head = o.editing
    ? `<span class="wic" style="--g:${info.grad}">${icon(info.icon, 12)}</span><span class="wtt">${esc(info.name)}</span><span class="sizes" role="group" aria-label="Size of ${esc(info.name)}">${(["S", "M", "L"] as const).map((s) => `<button type="button" data-act="resize" data-size="${s}" aria-pressed="${w.size === s}">${s}</button>`).join("")}</span><button type="button" class="wminus" data-act="remove" aria-label="Remove ${esc(info.name)}">−</button>`
    : `<span class="wic" style="--g:${info.grad}">${icon(info.icon, 12)}</span><span class="wtt">${esc(info.name)}</span>${info.page ? `<a class="wopen" href="${hashOf(info.page)}" aria-label="Open ${esc(PAGE_TITLES[info.page])}" title="Open ${esc(PAGE_TITLES[info.page])}">${icon("arrow", 14)}</a>` : w.type === "notif" ? `<button type="button" class="wopen" data-act="bell-open" aria-label="Open the notifications" title="Open the notifications">${icon("arrow", 14)}</button>` : ""}`;
  const edit = o.editing ? ` draggable="true" tabindex="0" aria-roledescription="widget" aria-label="${esc(info.name)}, ${w.size === "S" ? "small" : w.size === "M" ? "medium" : "large"}. Arrow keys move it."` : "";
  return `<section class="wg ${sizeClass(w)}${dark}${hero}" data-id="${esc(w.id)}" data-type="${w.type}" data-size="${w.size}"${style}${edit}><div class="wgh">${head}</div><div class="wgb">${bodyOf(w, d, o)}</div></section>`;
}

function clock(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
