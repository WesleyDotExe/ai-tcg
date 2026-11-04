// The Home board's widgets as HTML (Season 0 render item 3, render session
// 46). Pure: each widget is a string built from the owner API's answers, so
// the tests render every widget at every size in Node and the page shows
// exactly that. No DOM, no fetch.
//
// What each size shows is the owner's 2026-10-05 table (section C), trimmed
// to Season 0: a widget whose data the server serves draws it; a widget whose
// data waits on match running says what it waits on (siteBoard.WIDGET_WAITS)
// and draws nothing made up.

import { coinSwatchHtml } from "./siteCoinSwatch.js";
import { avatarSvg } from "../avatar.js";
import { visualPatternFor, visualSeedFor } from "../cardVisual.js";
import type { SiteHistory, SiteLive, SitePlay, SiteStore, SiteWallet } from "./siteApi.js";
import { autoPlaySwitch, autoPlayView, compactBoard, historyRowHtml, historyRowView, liveLineHtml, myLiveMatch, recordOf, scoreboardHtml, scoreboardOf, tidyLines, watchAsHtml } from "./siteMatches.js";
import {
  FINISH_NAMES,
  WIDGET_INFO,
  WIDGET_WAITS,
  bestCards,
  collectionView,
  dailyView,
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
import { amount } from "./siteLook.js";
import { dailyPackView } from "./siteStore.js";
import { FACTION_HEX, PAGE_TITLES, agentStatus, deckLine, esc, hashOf, icon, rebuildView, styleName } from "./siteModel.js";

export type WidgetSource = "packs" | "collection" | "daily" | "store" | "live" | "history";

/** Which server reads a widget needs at its size (the page fetches only
 * what the board shows). */
export function sourcesOf(w: Pick<SiteWidget, "type" | "size">): WidgetSource[] {
  switch (w.type) {
    case "agent":
      return w.size === "L" ? ["daily"] : [];
    case "packs":
      return w.size === "L" ? ["collection", "packs"] : ["packs"];
    case "daily":
      return ["daily"];
    case "collection":
    case "showcase":
      return ["collection"];
    case "store":
      return w.size === "L" ? ["packs", "store"] : ["packs"];
    // Render session 50: the match widgets read the live matches and the history.
    case "live":
    case "watch":
      return ["live"];
    case "history":
      return ["history"];
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
}

export interface WidgetOpts {
  editing: boolean;
  live?: LiveView;
  capped?: boolean;
}

function avatar(name: string, faction: string | null, size: number): string {
  const c = (faction && FACTION_HEX[faction]) || "#8f8cff";
  return `<span class="av" style="--c:${c};width:${size}px;height:${size}px">${avatarSvg(name)}</span>`;
}

function agentFaction(p: SitePlay): string | null {
  return p.factionLock ?? p.rebuild.job?.result?.faction ?? null;
}

/** A card as a widget draws it: the placeholder face (faction palette, the
 * card's own hue and pattern, a rarity gem, the finish named), never an
 * emoji or glyph (DESIGN.md's art section). */
export function miniCard(c: MiniCard, opts: { count?: number } = {}): string {
  const fin = FINISH_NAMES[c.finish] ?? c.finish;
  const hex = (c.faction && FACTION_HEX[c.faction]) || FACTION_HEX.Neutral!;
  const serial = c.serial !== null && c.finish === "prototype" ? ` #${c.serial}` : "";
  return `<div class="mc fin-${esc(c.finish)} r-${esc(c.rarity)}" style="--c:${hex};--h:${visualSeedFor(c.cardId)}" title="${esc(`${c.name} · ${c.rarity}${fin ? ` · ${fin}` : ""}${serial}`)}">`
    + `<span class="mc-art p${visualPatternFor(c.cardId)}"></span><span class="mc-gem" aria-hidden="true"></span>`
    + `<b class="mc-n">${esc(c.name)}</b>${fin ? `<span class="mc-fin">${esc(fin + serial)}</span>` : ""}${opts.count && opts.count > 1 ? `<span class="mc-cnt">×${opts.count}</span>` : ""}</div>`;
}

/** The sealed pack, drawn in CSS (no image). */
export function packArt(setCode: string | null, size: "s" | "m" | "l"): string {
  return `<div class="pk pk-${size}" aria-hidden="true"><span class="pk-foil"></span><b>${esc(setCode ?? "S0")}</b><small>AI·TCG</small></div>`;
}

function bar(pct: number): string {
  return `<div class="bar" role="presentation"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
}

function waitsBody(type: WidgetType, size: WidgetSize): string {
  const w = WIDGET_WAITS[type]!;
  return `<div class="wwait">${size === "S" ? "" : `<p>${esc(w.will)}</p>`}<p class="muted small">Waits on the server for ${esc(w.needs)}.</p></div>`;
}

function loading(data: WidgetData, src: WidgetSource): string | null {
  const err = data.errors[src];
  if (err) return `<p class="muted small">Couldn't load this: ${esc(err)}</p>`;
  return data[src] ? null : `<p class="muted small wload">Loading…</p>`;
}

function agentBody(w: SiteWidget, d: WidgetData): string {
  const p = d.play;
  const a = p.connectedAgent;
  if (!a) return `<b>No agent connected</b><p class="muted small">Connect an agent to play matches.</p><a class="btn pri sm" href="#/connect">Connect agent</a>`;
  const fac = agentFaction(p);
  const st = agentStatus(p);
  const top = `<div class="mya">${avatar(a.name, fac, w.size === "S" ? 40 : 60)}<div class="mya-t"><div class="mya-n">${esc(a.name)}${fac ? `<span class="ftag" style="--c:${FACTION_HEX[fac]}">${esc(fac.toUpperCase())}</span>` : ""}</div>${w.size === "S" ? "" : `<div class="muted small">${esc(styleName(p, a.playStyle))} play style</div>`}</div></div>`;
  const status = `<span class="status ${st.tone}"><i></i>${esc(st.label)}</span>`;
  // Session 50: the auto-play switch (spec C: S has it), and Watch when live.
  const ap = autoPlayView(p.autoPlay, true);
  const sw = autoPlaySwitch(ap, `ap-${w.id}`);
  const watch = p.liveMatch ? `<a class="btn sm" href="#/match">Watch</a>` : "";
  if (w.size === "S") return top + `<div class="row">${status}${sw}</div>`;
  const deck = `<div class="small">${esc(deckLine(p))}</div>`;
  const apNote = `<p class="muted small">${esc(ap.stopped ?? ap.note)}</p>`;
  const later = `<p class="muted small">Rating and record: the Stats page's endpoint comes next.</p>`;
  if (w.size === "M") return top + `<div class="row">${status}${sw}${watch}</div>` + deck + apNote;
  const rv = rebuildView(p);
  const dv = d.daily ? dailyView(d.daily, d.now) : null;
  const today = dv ? `Today: ${dv.fromWins}/${dv.winCap} credits from wins` : d.errors.daily ? "Today's earnings couldn't be read" : "Today: loading…";
  return `<div class="wsplit"><div class="wcol">${top}<div class="row">${status}${sw}${watch}</div>${apNote}${deck}<div class="small">${p.factionLock ? `Faction locked to ${esc(p.factionLock)}` : `Faction chosen by ${esc(a.name)}`}</div><div class="small">${esc(today)}</div>${later}</div>`
    + `<div class="wcol"><div class="rb-note ${rv.kind} small">${esc(rv.kind === "wanted" ? `${rv.text} ${rv.reasons[0]}` : rv.text)}</div><a class="btn sm" href="#/settings">Deck settings</a><p class="muted small">The signature card shows here once agents carry one (generating an agent comes with sign-up).</p></div></div>`;
}

function liveBody(w: SiteWidget, d: WidgetData, o: WidgetOpts): string {
  const view = o.live ?? "scoreboard";
  const note = o.capped ? `<p class="muted small wcap">Scoreboard only: two live boards are already showing.</p>` : "";
  const l = loading(d, "live");
  if (w.type === "watch") {
    if (l) return l + note;
    const live = d.live!;
    if (!live.running) return `<p class="muted small">The ladder isn't running on this server, so nothing is live.</p>${note}`;
    if (!live.matches.length) return `<p class="muted small">No match is live right now. The next ladder round starts soon.</p>${note}`;
    // S: the first match's scoreboard; M: its scoreboard and the others as
    // one line each; L: the first on the compact board, the list alongside.
    const sbs = live.matches.map((m) => scoreboardOf(m, d.ownerId, d.viewOf?.(m.matchId) ?? null));
    // The point of view (owner 2026-11-02): the "Watch as" switch on the
    // first match at M and L (S has no room); never on the viewer's own match.
    const first = scoreboardHtml(sbs[0]!, { small: w.size !== "L" }) + (w.size === "L" && view === "board" ? compactBoard(live.matches[0]!, sbs[0]!.near) : "") + (w.size === "S" ? "" : watchAsHtml(sbs[0]!, `wa-${w.id}`));
    const rest = sbs.slice(1);
    const list = w.size === "S" || !rest.length ? "" : `<ul class="lines">${rest.map(liveLineHtml).join("")}</ul>`;
    const boards = w.size === "L" ? `<div class="wsplit wide-l"><div class="wcol">${first}</div><div class="wcol"><h4>Also live</h4>${list || '<p class="muted small">No other match is live.</p>'}</div></div>` : first + list;
    return `${boards}<div class="row"><a class="btn sm" href="#/live">Watch live</a><span class="muted small">${live.matches.length} live · featured picks come later</span></div>${note}`;
  }
  const p = d.play;
  const a = p.connectedAgent;
  if (!a) return `<b>No agent connected</b><p class="muted small">Connect an agent to play.</p><a class="btn pri sm" href="#/connect">Connect agent</a>`;
  if (l) return l;
  const m = myLiveMatch(d.live);
  const ap = autoPlayView(p.autoPlay, true);
  if (!m) {
    const st = agentStatus(p);
    const why = p.liveMatch ? "Your agent's match is starting." : ap.on || !ap.shown ? "No match right now. Your agent joins the next ladder round." : "No match right now. Auto-play is off.";
    return `<div class="row">${avatar(a.name, agentFaction(p), w.size === "S" ? 30 : 40)}<div><b>${esc(a.name)}</b><div class="small"><span class="status ${st.tone}"><i></i>${esc(st.label)}</span></div></div></div><p class="muted small">${esc(why)}</p>${w.size === "S" ? "" : `<div class="row">${autoPlaySwitch(ap, `ap-${w.id}`)}</div>`}`;
  }
  const sb = scoreboardOf(m, d.ownerId);
  if (w.size === "S") return scoreboardHtml(sb, { small: true });
  const board = view === "board" ? compactBoard(m, sb.near) : "";
  if (w.size === "M") return scoreboardHtml(sb) + board + note;
  const feed = `<ol class="pbp small">${tidyLines(m.recentLines, { p1: m.p1.agentName, p2: m.p2.agentName }).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
  return `<div class="wsplit wide-l"><div class="wcol">${scoreboardHtml(sb, { small: true })}${board}${note}</div><div class="wcol"><h4>Play-by-play</h4>${feed}<div class="row">${autoPlaySwitch(ap, `ap-${w.id}`)}<a class="btn sm" href="#/match">Open</a></div><p class="muted small">The 2× vote comes with its endpoint.</p></div></div>`;
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

function packsBody(w: SiteWidget, d: WidgetData): string {
  const l = loading(d, "packs");
  if (l) return l;
  const v = packsView(d.packs!, d.wallet?.credits ?? 0);
  // Session 47: Open opens the oldest pack, Open 10 the ten oldest, full screen.
  const open = `<button type="button" class="btn pri sm" data-act="open-packs" data-count="1"${v.canOpen ? "" : " disabled"}>Open</button>`;
  if (w.size === "S") return `<div class="row nowrap">${packArt(v.setCode, "s")}<div><b>${esc(v.head)}</b><div class="row">${open}</div></div></div>`;
  const buy = v.price !== null ? `<button type="button" class="btn sm" data-act="buy-packs" data-set="${esc(v.setCode!)}" data-count="1"${v.canBuy ? "" : " disabled"}>Buy · ${amount(v.price)}</button>` : "";
  const open10 = `<button type="button" class="btn sm" data-act="open-packs" data-count="${v.bulk}"${v.canOpenBulk ? "" : ` disabled title="Needs ${v.bulk} packs waiting"`}>Open ${v.bulk}</button>`;
  const daily = dailyPackView(d.packs!.dailyPack, d.now);
  const m = `<div class="row nowrap top">${packArt(v.setCode, "m")}<div class="wcol"><h4>${esc(v.head)}</h4><div class="muted small">${esc(v.setName)} · 5 cards</div><div class="muted small">${esc(v.pity)}</div><div class="muted small">Free daily pack: ${esc(daily.line)}</div><div class="row">${open}${open10}${buy}</div></div></div>`;
  if (w.size === "M") return m;
  const c = d.collection;
  const last = c?.recentPulls[0];
  const factionOf = new Map((c?.cards ?? []).map((x) => [x.cardId, x.faction]));
  const cards = last ? last.cards.map((k) => miniCard({ cardId: k.cardId, name: k.name, rarity: k.rarity, faction: factionOf.get(k.cardId) ?? null, finish: k.finish, serial: k.serial })).join("") : "";
  return `<div class="wsplit wide-l">${m}<div class="wcol"><div class="muted small">${last ? `Your last opening · ${esc(clock(last.openedAt))}` : c ? "Your last opening appears here" : "Loading your last opening…"}</div><div class="mrow">${cards}</div></div></div>`;
}

function dailyBody(w: SiteWidget, d: WidgetData): string {
  const l = loading(d, "daily");
  if (l) return l;
  const v = dailyView(d.daily!, d.now);
  const head = `<div class="row between"><b class="wbig-s">${v.fromWins}/${v.winCap}</b><span class="muted small">credits from wins today</span></div>${bar(v.barPct)}<div class="muted small">Rewarded wins ${v.rewarded}/${v.rewardedCap}</div>`;
  if (w.size === "S") return head;
  const mid = head + `<div class="small">${esc(v.nextWin)}</div><div class="muted small">${esc(v.resets)}</div>`;
  if (w.size === "M") return mid + `<p class="muted small">No quests in Season 0.</p>`;
  const dd = d.daily!;
  const wins = dd.rewardedWins.length
    ? `<ul class="wlist">${dd.rewardedWins.map((x) => `<li><span class="wl w">W</span><span>Win ${x.nth}</span><span class="muted">${esc(clock(x.endedAt))}</span><b>+${x.credits}</b></li>`).join("")}</ul>`
    : `<p class="muted small">No rewarded wins yet today.</p>`;
  return mid + `<h4>Today's rewarded wins</h4>${wins}<div class="small">Losses and draws today: ${dd.losses} · +${dd.creditsFromLosses} credits (the first ${dd.maxPaidLosses} pay)</div><div class="small">In all today: <b>${amount(dd.credits)}</b> credits</div><p class="muted small">No quests, weekly challenge or streak in Season 0.</p>`;
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
  const n = w.size === "S" ? 1 : w.size === "M" ? 5 : 10;
  const cards = bestCards(d.collection!, n);
  if (!cards.length) return `<p class="muted small">Your best cards show here once you hold some.</p>`;
  return `<div class="mrow${w.size === "S" ? " center" : ""}">${cards.map((k) => miniCard(k)).join("")}</div>${w.size === "L" ? `<p class="muted small">Your rarest finishes first. Pinning cards comes with the Collection page.</p>` : ""}`;
}

function storeBody(w: SiteWidget, d: WidgetData): string {
  const l = loading(d, "packs") ?? (w.size === "L" ? loading(d, "store") : null);
  if (l) return l;
  const v = packsView(d.packs!, d.wallet?.credits ?? 0);
  const daily = dailyPackView(d.packs!.dailyPack, d.now);
  const claim = `<button type="button" class="btn pri sm" data-act="claim-daily"${daily.canClaim ? "" : " disabled"}>${esc(daily.button)}</button>`;
  if (w.size === "S") return `<div class="row">${claim}</div><div class="muted small">${esc(daily.line)}</div>`;
  const buy = v.price !== null
    ? `<button type="button" class="btn sm" data-act="buy-packs" data-set="${esc(v.setCode!)}" data-count="1"${v.canBuy ? "" : " disabled"}>Buy 1 pack · ${amount(v.price)}</button><button type="button" class="btn sm" data-act="buy-packs" data-set="${esc(v.setCode!)}" data-count="10"${v.canBuy10 ? "" : " disabled"}>Buy 10 · ${amount(v.price * 10)}</button>`
    : "";
  const m = `<div class="row">${claim}${buy}</div><div class="muted small">${esc(daily.line)}</div><div class="muted small">${v.unopened} unopened · ${amount(d.wallet?.credits ?? 0)} credits</div>`;
  if (w.size === "M") return m;
  const cos = d.store!.cosmetics;
  const items = cos.length
    ? `<div class="shop">${cos.map((c) => `<div class="si">${c.kind === "coin" ? coinSwatchHtml(c.itemId) : `<span class="si-pv" style="--c:${(c.faction && FACTION_HEX[c.faction]) || "#8f8cff"}"></span>`}<b class="small">${esc(c.name)}</b><span class="muted small">${esc(c.kind)}</span>${c.owned ? '<span class="pill on">Owned</span>' : c.priceCredits === null ? "" : `<button type="button" class="btn sm" data-act="buy-cosmetic" data-item="${esc(c.itemId)}" data-name="${esc(c.name)}" data-price="${c.priceCredits}"${(d.wallet?.credits ?? 0) >= c.priceCredits ? "" : " disabled"}>Buy · ${amount(c.priceCredits)}</button>`}</div>`).join("")}</div>`
    : `<p class="muted small">No cosmetics on sale right now.</p>`;
  return m + `<h4>Cosmetics on sale</h4>${items}`;
}

function bodyOf(w: SiteWidget, d: WidgetData, o: WidgetOpts): string {
  switch (w.type) {
    case "agent":
      return agentBody(w, d);
    case "live":
    case "watch":
      return liveBody(w, d, o);
    case "packs":
      return packsBody(w, d);
    case "daily":
      return dailyBody(w, d);
    case "collection":
      return collectionBody(w, d);
    case "showcase":
      return showcaseBody(w, d);
    case "store":
      return storeBody(w, d);
    case "history":
      return historyBody(w, d);
    default:
      return waitsBody(w.type, w.size);
  }
}

/** One widget: the glass tile, its icon and title, the open button (or in
 * Customise mode the S/M/L picker and "−"), and its body. */
export function widgetHtml(w: SiteWidget, d: WidgetData, o: WidgetOpts): string {
  const info = WIDGET_INFO[w.type];
  const dark = info.live ? " wg-dark" : "";
  const hero = w.type === "agent" && d.play.connectedAgent ? " hero" : "";
  const fac = hero ? agentFaction(d.play) : null;
  const style = hero ? ` style="--c:${(fac && FACTION_HEX[fac]) || "#8f8cff"}"` : "";
  const head = o.editing
    ? `<span class="wic" style="--g:${info.grad}">${icon(info.icon, 12)}</span><span class="wtt">${esc(info.name)}</span><span class="sizes" role="group" aria-label="Size of ${esc(info.name)}">${(["S", "M", "L"] as const).map((s) => `<button type="button" data-act="resize" data-size="${s}" aria-pressed="${w.size === s}">${s}</button>`).join("")}</span><button type="button" class="wminus" data-act="remove" aria-label="Remove ${esc(info.name)}">−</button>`
    : `<span class="wic" style="--g:${info.grad}">${icon(info.icon, 12)}</span><span class="wtt">${esc(info.name)}</span>${info.page ? `<a class="wopen" href="${hashOf(info.page)}" aria-label="Open ${esc(PAGE_TITLES[info.page])}" title="Open ${esc(PAGE_TITLES[info.page])}">${icon("arrow", 14)}</a>` : ""}`;
  const edit = o.editing ? ` draggable="true" tabindex="0" aria-roledescription="widget" aria-label="${esc(info.name)}, ${w.size === "S" ? "small" : w.size === "M" ? "medium" : "large"}. Arrow keys move it."` : "";
  return `<section class="wg ${sizeClass(w)}${dark}${hero}" data-id="${esc(w.id)}" data-type="${w.type}" data-size="${w.size}"${style}${edit}><div class="wgh">${head}</div><div class="wgb">${bodyOf(w, d, o)}</div></section>`;
}

function clock(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
