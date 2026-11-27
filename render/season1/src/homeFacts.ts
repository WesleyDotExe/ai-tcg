// The Season 1 Home tiles drawn from real answers (render session 83; owner
// 2026-11-22, plan item 18 steps 2-3: the Home mockups). Every mockup (A, B,
// C) draws the same tiles from the same spec (homeSpec.ts); this file turns
// each spec fact into words and marks from one owner's real owner-API answers
// (season1/mockup/data/home-data.json, read by season1/mockup/snapshot.ts).
// A mockup only decides the look and the navigation around them.
//
// Pure: strings in, HTML strings out; no DOM. Every fact's fragment carries
// data-fact="<fact>", so the tests and the browser check can hold each
// drawn tile to the spec (the facts it shows at a size are exactly the
// spec's, and a fact's value appears in its home tile only).
//
// Fenced off: nothing outside render/season1/ imports this.

import { LIVE_PACK_ODDS } from "@ai-tcg/economy";
import { CARD_REGISTRY } from "@ai-tcg/engine";
import { FACTION_HEX, esc } from "../../src/site/siteModel.js";
import { TIER_HEX } from "../../src/site/siteStanding.js";
import { avatarSvg } from "../../src/avatar.js";
import { FACE_SCRIPT, SEALED_PACK_CSS, boastGlyphSymbols, faceSymbols } from "../../src/site/siteFaces.js";
import { COIN_SCRIPT } from "../../src/site/siteCoins.js";
import { coinSwatchHtml } from "../../src/site/siteCoinSwatch.js";
import { cosmeticKind } from "../../src/site/siteShop.js";
import { FACTS, TILES, type Fact, type Size, type TileSpec } from "./homeSpec.js";

/* ------------------------------------------------------------------ data */

/** The parts of the owner API's answers the tiles read (server/OWNER_API.md).
 * Loose on purpose: the snapshot is the server's JSON as it came back. */
export interface OwnerData {
  me: { name: string; username: string };
  wallet: { credits: number; packPoints: number; unopenedPacks: unknown[] };
  play: {
    connectedAgent: { agentId: string; name: string; playStyle: string } | null;
    agents: { agentId: string; name: string }[];
    playStyles: { id: string; name: string; summary: string }[];
    agentDeck: { name: string; faction: string | null; cards: number; builtFrom?: { style: string } } | null;
    activeDeck: { name: string; faction: string | null; cards: number } | null;
    deckChoice: string;
    rebuild: { reasons: string[] };
    liveMatch: { matchId: string } | null;
    autoPlay: {
      on: boolean;
      stopped: { reason?: string } | null;
      dailyRewardsMaxed: boolean;
      /** The play-time allowance (server/OWNER_API.md, "The play-time allowance", session 76): null for no time limit, or off. */
      allowance: { state: "waiting" | "running" | "finishing" | "done"; label: string; totalMinutes: number; minutesLeft: number; endsAtReset: boolean } | null;
      canAddTime?: boolean;
      house: boolean;
    };
  };
  rating: { rating: { rating: number; rd: number; ratedMatches: number; tier: string } };
  ladder: {
    standings: { rank: number | null; ownerName: string; agent: { name: string }; rating: number; tier: string; wins: number; losses: number }[];
    you: { rank: number | null; ownerName: string };
    owners: number;
    tiers: { tier: string; from: number | null }[];
    placementMatches: number;
  };
  stats: {
    totals: { matches: number; wins: number; losses: number; bestWinStreak: number; currentStreak: { kind: string; length: number } | null };
    byFaction: { faction: string; matches: number; wins: number; winRate: number }[];
    factionNotRecorded: { matches: number };
    recent: { result: string }[];
    rating: { weekChange: number; chart: { day: string; rating: number | null; rated: number }[] };
  };
  packs: { unopened: unknown[]; offer: { setCode: string; name: string; priceCredits: number }[]; bulkOpenCount: number; pity: { packsSinceFullArt: number; packsSinceMythic: number } };
  dailyPack: { waiting: number; cap: number; timeZone: string; nextPackAt: string };
  collection: {
    distinctCards: number;
    cards: { cardId: string; name: string; rarity: string; faction: string; owned: number; copies: { finish: string }[] }[];
    sets: { base: { held: number; total: number }; secrets: { held: number; total: number }; prototypes: { runsHeld: number; runs: number } }[];
    recentPulls: { cards: { cardId: string; name: string; rarity: string; finish: string }[] }[];
  };
  store: { cosmetics: { itemId: string; name: string; kind: string; faction: string | null; priceCredits: number; owned: boolean; description?: string }[] };
  daily: { timeZone: string; schedule: { fromWin: number; toWin: number | null; credits: number }[]; wins: unknown[]; losses: number; creditsFromWins: number; nextWinPays: number; nextLossPays: number; maxPaidLosses: number };
  matches: { matches: { result: string; credits: number; rating: { change: number } | null; opponent: { ownerName: string; agentName: string }; agentName: string; hasReplay: boolean; hasLog: boolean }[]; total: number };
  notifications: { notifications: Alert[]; unread: number; unreadByKind: Record<string, number> };
  live: { matches: LiveMatch[]; mine: string | null };
}

export interface Alert {
  kind: string;
  readAt: string | null;
  dailyPack?: { waiting: number };
  matchResult?: { result: string; agentName: string; opponent: { ownerName: string; agentName: string }; credits: number; turns: number | null };
  bigPull?: { cardName?: string; name?: string };
  autoPlayStopped?: { reason?: string };
}

export interface LiveSide { name: string; health: number; maxHealth: number; energy: number; maxEnergy: number; hand: number; deck: number; board: { name: string; cardId: string; attack: number; health: number; maxHealth: number; pending: boolean }[]; directives: { name: string }[] }
export interface LiveMatch {
  matchId: string;
  p1: { ownerName: string; agentName: string; faction: string };
  p2: { ownerName: string; agentName: string; faction: string };
  now: { turn: number; activePlayer: "p1" | "p2"; winner: string | null; p1: LiveSide; p2: LiveSide };
  recentLines: string[];
  viewers: number;
}

export interface HomeData {
  takenAt: string;
  takenFrom: string;
  owners: Record<string, OwnerData>;
}

/* -------------------------------------------------------------- helpers */

const n0 = (x: number) => Math.round(x).toLocaleString("en-AU");
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const signed = (x: number) => (Math.round(x) > 0 ? `+${Math.round(x)}` : Math.round(x) < 0 ? `−${Math.abs(Math.round(x))}` : "0");
const fx = (fact: Fact, inner: string, cls = "") => `<div class="fx${cls ? " " + cls : ""}" data-fact="${fact}">${inner}</div>`;
const lab = (s: string) => `<span class="lab">${esc(s)}</span>`;
const big = (s: string, extra = "") => `<b class="big"${extra}>${esc(s)}</b>`;

/** The Glicko deviation at or under which Ladder says "Settled" (render
 * 83's call, for the owner: Season 0 starts every rating at 350; 100 is
 * about where a match moves it by a few points, not dozens). */
export const SETTLED_RD = 100;

export const isPlaced = (d: OwnerData) => d.rating.rating.ratedMatches >= d.ladder.placementMatches && d.rating.rating.tier !== "Placement";
const hasMatches = (d: OwnerData) => d.matches.total > 0;
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/* The Ladder tile's numbers (render session 89), each from the owner API's
   own fields (server/OWNER_API.md: rating, ladder, stats). */
const rankedOf = (d: OwnerData) => d.ladder.standings.filter((s) => s.rank !== null).sort((a, b) => a.rank! - b.rank!);
export const placementOf = (d: OwnerData) => ({ done: Math.min(d.rating.rating.ratedMatches, d.ladder.placementMatches), of: d.ladder.placementMatches });

/** The tile's one bar: placement until placed, then the way to the next
 * tier (the bar measures the current tier's span, floor to next floor). */
export function climbOf(d: OwnerData): { kind: "placement" | "next" | "top"; pct: number; done?: number; of?: number; points?: number; next?: string; nextFrom?: number; color?: string } {
  if (!isPlaced(d)) {
    const p = placementOf(d);
    return { kind: "placement", pct: (100 * p.done) / p.of, ...p };
  }
  const r = d.rating.rating.rating;
  const floors = d.ladder.tiers.filter((t) => t.from !== null) as { tier: string; from: number }[];
  const next = floors.find((t) => t.from > r);
  if (!next) return { kind: "top", pct: 100, color: TIER_HEX[d.rating.rating.tier] };
  const below = [...floors].reverse().find((t) => t.from <= r);
  // The lowest tier has no floor: measure it over the next tier's span.
  const span = below ? next.from - below.from : (floors[1]?.from ?? next.from + 150) - next.from;
  const from = below ? below.from : next.from - span;
  return { kind: "next", pct: Math.max(0, Math.min(100, (100 * (r - from)) / span)), points: Math.ceil(next.from - r), next: next.tier, nextFrom: next.from, color: TIER_HEX[next.tier] };
}

export interface StandingRow { rank: number | null; name: string; rating: number | null; me: boolean; gap?: boolean }

/** The standings list: the top three ranked, then (if you're below them)
 * a gap and you with the agent just above; unplaced, the top three and you
 * "placing" at the foot. Four rows at most, so it fits L at every unit. */
export function standingsRows(d: OwnerData): StandingRow[] {
  const ranked = rankedOf(d);
  const me = d.ladder.you.rank;
  const row = (s: (typeof ranked)[number]): StandingRow => ({ rank: s.rank, name: s.ownerName, rating: s.rating, me: s.rank === me });
  const you: StandingRow = { rank: null, name: d.ladder.you.ownerName, rating: null, me: true };
  if (!me) return [...ranked.slice(0, 3).map(row), you];
  const i = ranked.findIndex((s) => s.rank === me);
  if (i < 4) return ranked.slice(0, 4).map(row);
  return [...ranked.slice(0, 2).map(row), { rank: null, name: "", rating: null, me: false, gap: true }, row(ranked[i - 1]!), row(ranked[i]!)];
}

/** The tiers as a ladder, top to bottom, each with its floor and the
 * ranked agents in it (what a new player sees in place of an empty chart:
 * where the ratings sit, and that every agent starts at 1,500). */
function tierScale(d: OwnerData): string {
  const ranked = rankedOf(d);
  const start = 1500;
  const rows = [...d.ladder.tiers].map((t, i, all) => {
    const to = all[i + 1]?.from ?? null;
    const n = ranked.filter((s) => s.rating >= (t.from ?? -Infinity) && (to === null || s.rating < to));
    const starts = start >= (t.from ?? -Infinity) && (to === null || start < to);
    return `<li style="--tc:${TIER_HEX[t.tier]}"><i></i><span class="tn">${esc(t.tier)}</span><span class="fl">${t.from === null ? `under ${to}` : `${t.from}+`}</span><span class="who">${n.map((s) => `<b title="#${s.rank} ${esc(s.ownerName)}, ${n0(s.rating)}"></b>`).join("")}${starts ? `<em>start</em>` : ""}</span></li>`;
  }).reverse().join("");
  const range = ranked.length ? `${plural(ranked.length, "ranked agent")}, ${n0(Math.min(...ranked.map((s) => s.rating)))} to ${n0(Math.max(...ranked.map((s) => s.rating)))}` : "no agent ranked yet";
  return `<ol class="scale" aria-label="the tiers, Mythic at the top; ${esc(range)}; every agent starts at 1,500">${rows}</ol>`;
}

const RARITY_RANK: Record<string, number> = { Common: 0, Uncommon: 1, Rare: 2, Mythic: 3 };
const FINISH_RANK: Record<string, number> = { standard: 0, foil: 1, altArt: 2, fullArt: 3, glitch: 4, gold: 5, prototype: 6 };
const FINISH_NAME: Record<string, string> = { standard: "", foil: "Foil", fullArt: "Full Art", altArt: "Alt Art", glitch: "Glitch", gold: "Gold", prototype: "Prototype" };

/** The day's most from wins (the schedule's paid wins). */
export function dayMost(d: OwnerData): number {
  return d.daily.schedule.reduce((s, r) => s + (r.toWin === null ? 0 : (r.toWin - r.fromWin + 1) * r.credits), 0);
}

/** "midnight Sydney" for the server's day (it resets at local midnight). */
const resetPlace = (tz: string) => (tz === "Australia/Sydney" ? "Sydney" : tz.split("/").pop()!.replace(/_/g, " "));

/** A small card, drawn from its attributes (placeholder art, never a glyph):
 * the faction's colour field, the rarity's edge, the cost and the name. */
export function miniCard(cardId: string, name: string, rarity: string, finish = "standard", size: "s" | "m" = "s"): string {
  const card = CARD_REGISTRY.get(cardId) as { cost?: number; type?: string; faction?: string; attack?: number; health?: number } | undefined;
  const faction = card?.faction ?? "Neutral";
  const hue = FACTION_HEX[faction] ?? FACTION_HEX.Neutral!;
  const stats = card && typeof card.attack === "number" ? `<i class="mcs">${card.attack}/${card.health}</i>` : `<i class="mcs">${esc(card?.type ?? "")}</i>`;
  const fin = FINISH_NAME[finish] ?? "";
  return `<span class="mcard mc-${size} r-${rarity.toLowerCase()}${finish !== "standard" ? " shine" : ""}" style="--fc:${hue}" title="${esc(`${name} · ${rarity}${fin ? " · " + fin : ""}`)}">` +
    `<i class="mcc">${card?.cost ?? ""}</i><i class="mca"></i><i class="mcn">${esc(name)}</i>${stats}${fin ? `<i class="mcf">${esc(fin)}</i>` : ""}</span>`;
}


/* ------------------------------------------------------- My agent's state */

export interface AgentState { label: string; tone: "live" | "ok" | "warn" | "off"; why: string; short: string; action: "Start" | "Stop" | "Connect an agent" }

/** What the agent is doing, in the owner's words (one place, so the pill,
 * the reason and the button never disagree). The states follow the owner
 * API's auto-play answer (server/OWNER_API.md, sessions 67, 76, 94). */
export function agentState(d: OwnerData): AgentState {
  const ap = d.play.autoPlay, al = ap.allowance;
  if (!d.play.connectedAgent) return { label: "No agent", tone: "off", why: "Connect an agent on My agent; then press Start.", short: "Connect one on My agent.", action: "Connect an agent" };
  if (al && al.state === "finishing") return { label: "Finishing match", tone: "live", why: "Its time is up; this match plays to the end and counts as normal.", short: "Its time is up; this match still counts.", action: "Stop" };
  if (d.play.liveMatch) return { label: "Playing now", tone: "live", why: "A ladder match is on: watch it in Watch live.", short: "Watch it in Watch live.", action: ap.on ? "Stop" : "Start" };
  if (ap.on && al && al.state === "waiting") return { label: "Waiting for a round", tone: "ok", why: "It joins the ladder's next round; its minutes start at its first match.", short: "Its minutes start at its first match.", action: "Stop" };
  if (ap.on) return { label: "Ready", tone: "ok", why: "It joins the ladder's next round.", short: "It joins the next round.", action: "Stop" };
  if (ap.dailyRewardsMaxed || ap.stopped?.reason === "dailyRewardsMaxed") return { label: "Done for today", tone: "warn", why: "Today's rewards are all earned; it can play again after midnight.", short: "All of today's rewards earned.", action: "Start" };
  if ((al && al.state === "done") || ap.stopped?.reason === "timeUp") return { label: "Time's up", tone: "warn", why: "Its play time ran out. Press Start with new minutes to carry on.", short: "Start again with new minutes.", action: "Start" };
  if (!hasMatches(d)) return { label: "Ready, not playing yet", tone: "ok", why: "Press Start and it joins the ladder's next round; it plays until you stop it or its time runs out.", short: "Press Start: it joins the next round.", action: "Start" };
  return { label: "Stopped", tone: "off", why: "Press Start and it joins the ladder's next round.", short: "Press Start to play again.", action: "Start" };
}

/** The check on the current play style (drawn, so it reads in both themes). */
const TICK = `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>`;

const agentStyle = (d: OwnerData) => d.play.playStyles.find((p) => p.id === d.play.connectedAgent?.playStyle) ?? d.play.playStyles[0]!;

/** Each personality in a few words, for the L tile's one line each (the
 * server's summary stays in the title and on My agent). A personality the
 * page doesn't know yet shows its summary's first clause. */
const STYLE_TAG: Record<string, string> = {
  calculator: "the best move each turn",
  rusher: "goes for health, fast",
  controller: "answers threats, plays long",
  tempo: "the wider board, first",
  fortress: "tough units, safe trades",
  gambler: "risky, hard to read",
};
export const styleTag = (p: { id: string; summary: string }) => STYLE_TAG[p.id] ?? p.summary.split(/[.,;:]/)[0]!.trim();

/* ------------------------------------------------------- the facts */

/** Per-page drawing options (a page whose box is tighter than the spec's
 * default asks for fewer items, so the markup holds only what is shown). */
export type FactOpts = { featuredCosmetics?: number };
type Render = (d: OwnerData, size: Size, opts?: FactOpts) => string;

export const RENDER: Record<Fact, Render> = {
  /* My agent (render session 88: one glass tile, each size's copy written for its box) */
  agentName: (d, size) => {
    const a = d.play.connectedAgent;
    if (!a) return fx("agentName", `${big("No agent connected")}${size === "M" ? `<span class="sub">Connect one to start playing.</span>` : ""}`);
    return fx("agentName", `<span class="ava">${avatarSvg(a.name)}</span><b class="big${a.name.length > 16 ? " long" : ""}" title="${esc(a.name)}">${esc(a.name)}</b>`, "row");
  },
  agentStatus: (d, size) => {
    const st = agentState(d);
    // S: the pill only. M: the short reason (the tile's right column is
    // about 190 px at 1280). L: the full sentence.
    const why = size === "S" ? "" : size === "M" ? st.short : st.why;
    return fx("agentStatus", `<span class="pill ${st.tone}">${esc(st.label)}</span>${why ? `<span class="sub why">${esc(why)}</span>` : ""}`);
  },
  startStop: (d) => {
    const st = agentState(d);
    return fx("startStop", `<button class="btn ${st.action === "Stop" ? "" : "pri"}" type="button">${st.action}</button>`, "act");
  },
  todayRecord: (d) => {
    const w = d.daily.wins.length, l = d.daily.losses;
    return fx("todayRecord", w + l === 0 ? `${lab("Today")}<span>No matches yet</span>` : `${lab("Today")}<span><b>${w}</b> won · <b>${l}</b> lost</span>`, "kv");
  },
  personality: (d, size) => {
    // "Play style" (owner 2026-11-27, note 6), the personality as its
    // subtitle. S: the current style's name; M: the current style with
    // Change; L: all six drawn as choices, the current one marked. A tap on
    // any style opens My agent with that style ready to confirm (call 4:
    // the tile never changes it itself); data-style carries the pick.
    const a = d.play.connectedAgent;
    const style = agentStyle(d);
    const named = (cls: string) => `<b class="${cls}" data-style-name title="${esc(style.summary)}">${esc(a ? style.name : "None yet")}</b>`;
    if (size === "S") return fx("personality", `${lab("Play style")}${named("sn")}`, "kv");
    if (size === "M") return fx("personality", `${lab("Play style")}<span class="val">${named("sn")}<a class="chg" href="#/agent" data-go="agent" data-style="" title="Choose how your agent plays, on My agent">Change</a></span>`, "kv");
    const choice = (p: OwnerData["play"]["playStyles"][number]) => {
      const on = !!a && p.id === style.id;
      return `<li><a class="choice${on ? " on" : ""}" href="#/agent" data-go="agent" data-style="${esc(p.id)}" title="${esc(p.summary)}${on ? " (its play style now)" : " Tap to choose it on My agent."}"${on ? ' aria-current="true"' : ""}>` +
        `<span class="cn"><i class="tick" aria-hidden="true">${TICK}</i><b>${esc(p.name)}</b><i class="cur">Current</i></span><span class="ct">${esc(styleTag(p))}</span></a></li>`;
    };
    return fx("personality", `<span class="labrow">${lab("Play style")}<span class="subt">personality</span></span>` +
      `<span class="plain">${a ? "It changes how your agent plays, from its next match." : "Connect an agent, then choose how it plays."}</span>` +
      `<ul class="choices styles" aria-label="Play styles">${d.play.playStyles.map(choice).join("")}</ul>`, "blk");
  },
  playTime: (d, size) => {
    const ap = d.play.autoPlay;
    const al = ap.allowance;
    let s: string;
    if (al && al.state === "waiting") s = size === "L" ? `${al.totalMinutes} min, from its first match` : `${al.totalMinutes} min, not started`;
    else if (al && al.state === "running") s = size === "L" ? `${al.minutesLeft} min left of ${al.totalMinutes}${al.endsAtReset ? ", to midnight" : ""}` : `${al.minutesLeft} min left`;
    else if (al && al.state === "finishing") s = "Time's up";
    else if (al && al.state === "done") s = size === "L" ? "Time's up: start again with new minutes" : "Time's up";
    else if (ap.on) s = size === "L" ? "No limit: it plays until you stop it" : "No limit";
    else s = size === "L" ? "Pick 15, 30 or 60 min, or no limit, at Start" : "Set when you press Start";
    const add = ap.canAddTime && al && al.state !== "done" && !al.endsAtReset ? `<button class="btn sm add" type="button">+15 min</button>` : "";
    return fx("playTime", `${lab("Play time")}<span class="val">${esc(s)}${add}</span>`, "kv");
  },
  deck: (d) => {
    const deck = d.play.deckChoice === "forced" ? d.play.activeDeck : d.play.agentDeck;
    const head = `<span class="labrow">${lab("Deck")}<a class="chg" href="#/agent" data-go="agent">${d.play.deckChoice === "forced" ? "Change" : "Pick one"}</a></span>`;
    if (!deck) return fx("deck", `${head}<span>Your agent builds its own deck from your cards.</span>`, "kv");
    const by = d.play.deckChoice === "forced" ? "your pick" : "built by your agent";
    return fx("deck", `${head}<span><b>${esc(deck.name)}</b> · ${esc(deck.faction ?? "mixed")} · ${deck.cards} cards · ${by}</span>`, "kv");
  },

  /* Ladder (render session 89: one tile for the rating, tier, rank and
     form, each size's copy written for its box) */
  rating: (d) => {
    const r = d.rating.rating;
    return fx("rating", isPlaced(d) ? big(n0(r.rating)) : big("Unrated"));
  },
  tier: (d) => {
    const t = d.rating.rating.tier;
    return fx("tier", isPlaced(d) ? `<span class="tier" style="--tc:${TIER_HEX[t] ?? "#9aa0b8"}">${esc(t)}</span>` : `<span class="tier" style="--tc:${TIER_HEX.Placement}">In placement</span>`);
  },
  rank: (d, size) => {
    const you = d.ladder.you;
    if (you.rank) return fx("rank", `<span><b>#${you.rank}</b> of ${rankedOf(d).length} ranked</span>`);
    // S has no climb bar, so its third line carries placement's count; M
    // and L show the count once, in the bar.
    const p = placementOf(d);
    return fx("rank", size === "S" ? `<span><b>${p.done} of ${p.of}</b> placement matches</span>` : `<span>Not ranked yet</span>`);
  },
  climb: (d, size) => {
    const c = climbOf(d);
    const bar = `<span class="bar" role="img" aria-label="${Math.round(c.pct)}%"><i style="width:${c.pct.toFixed(1)}%${c.color ? `;--c:${c.color}` : ""}"></i></span>`;
    if (c.kind === "placement") return fx("climb", `${lab("Placement")}<span><b>${c.done} of ${c.of}</b> matches${size === "L" ? `: a rating comes after the ${ordinal(c.of!)}` : ""}</span>${bar}`, "kv");
    if (c.kind === "top") return fx("climb", `${lab("Next tier")}<span><b>Top tier</b>${size === "L" ? ": nothing above it" : ""}</span>${bar}`, "kv");
    return fx("climb", `${lab("Next tier")}<span><b>${c.points}</b> points to ${esc(c.next!)}${size === "L" ? ` (from ${c.nextFrom})` : ""}</span>${bar}`, "kv");
  },
  weekChange: (d) => {
    if (!isPlaced(d)) return fx("weekChange", `${lab("This week")}<span>After placement</span>`, "kv");
    const c = Math.round(d.stats.rating.weekChange);
    return fx("weekChange", `${lab("This week")}<span class="${c > 0 ? "up" : c < 0 ? "down" : ""}">${c === 0 ? "No change" : `${signed(c)} points`}</span>`, "kv");
  },
  ratingSettled: (d) => {
    if (!isPlaced(d)) return fx("ratingSettled", `${lab("Rating")}<span>Set after placement</span>`, "kv");
    const rd = d.rating.rating.rd;
    const settled = rd <= SETTLED_RD;
    return fx("ratingSettled", `${lab("Rating")}<span><b>${settled ? "Settled" : "Settling"}</b> <details class="why"><summary aria-label="What does ${settled ? "Settled" : "Settling"} mean?">?</summary><span>${settled ? "Settled: a match moves the rating a little now." : "Settling: it can still move a lot each match."} The rating is a guess at your agent's strength, give or take ${Math.round(rd)} points; the more it plays, the smaller that gets.</span></details></span>`, "kv");
  },
  form: (d) => {
    const r = d.stats.recent.slice(0, 10);
    if (!r.length) return fx("form", `${lab("Form")}<span>No results yet</span>`, "kv");
    return fx("form", `${lab("Form")}<span class="dots" role="img" aria-label="last ${r.length} results, newest first: ${r.filter((x) => x.result === "win").length} won, ${r.filter((x) => x.result === "loss").length} lost">${r.map((x) => `<i class="dot ${x.result}" title="${x.result}">${x.result === "win" ? "W" : x.result === "loss" ? "L" : "D"}</i>`).join("")}</span>`, "kv");
  },
  streak: (d) => {
    const s = d.stats.totals.currentStreak;
    const best = d.stats.totals.bestWinStreak;
    return fx("streak", `${lab("Streak")}<span>${s ? `<b>${plural(s.length, s.kind === "win" ? "win" : "loss", s.kind === "win" ? "wins" : "losses")}</b> in a row` : "None yet"}${best ? ` · best ${plural(best, "win")}` : ""}</span>`, "kv");
  },
  standings: (d) => {
    const rows = standingsRows(d);
    const li = (r: StandingRow) => r.gap ? `<li class="gap" aria-hidden="true">···</li>` :
      `<li class="${r.me ? "me" : ""}"${r.me ? ' aria-current="true"' : ""}><b>${r.rank ? `#${r.rank}` : "–"}</b><span class="who" title="${esc(r.name)}">${esc(r.name)}${r.me ? " (you)" : ""}</span><span class="pts">${r.rating === null ? "placing" : n0(r.rating)}</span></li>`;
    return fx("standings", `${lab(isPlaced(d) ? "Standings" : "Top of the ladder")}<ol class="lad">${rows.map(li).join("")}</ol>`, "blk");
  },
  trend: (d) => {
    if (!isPlaced(d)) return fx("trend", `${lab("Where the ratings sit")}${tierScale(d)}`, "blk");
    const pts = d.stats.rating.chart.filter((p) => p.rating !== null) as { rating: number }[];
    const vals = pts.map((p) => p.rating);
    const floors = d.ladder.tiers.filter((t) => t.from !== null);
    const lo = Math.min(...vals) - 40, hi = Math.max(...vals) + 40;
    const W = 300, H = 90, x = (i: number) => (i / Math.max(1, pts.length - 1)) * W, y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
    const lines = floors.filter((t) => t.from! > lo && t.from! < hi).map((t) => `<line x1="0" x2="${W}" y1="${y(t.from!).toFixed(1)}" y2="${y(t.from!).toFixed(1)}" stroke="${TIER_HEX[t.tier]}" stroke-dasharray="3 4" opacity=".9" vector-effect="non-scaling-stroke"/>`).join("");
    const names = floors.filter((t) => t.from! > lo && t.from! < hi).map((t) => `<span style="top:${((100 * y(t.from!)) / H).toFixed(1)}%;--tc:${TIER_HEX[t.tier]}">${esc(t.tier)}</span>`).join("");
    const path = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    return fx("trend", `${lab("Rating, 30 days")}<span class="chartbox"><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="rating over 30 days, ${n0(vals[0] ?? 0)} to ${n0(vals[vals.length - 1] ?? 0)}, with the tier floors">${lines}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><span class="floors" aria-hidden="true">${names}</span></span>`, "blk");
  },
  factionWinRate: (d) => {
    const rows = d.stats.byFaction.filter((f) => f.matches > 0);
    const old = d.stats.factionNotRecorded.matches;
    if (!rows.length) return fx("factionWinRate", `${lab("By deck")}<span>${hasMatches(d) ? "No deck recorded yet" : "After the first matches"}</span>`, "kv");
    // One line: each deck's win rate; its match count in the title (and the
    // older matches that recorded no deck).
    const tail = old ? `; ${old} older ${old === 1 ? "match" : "matches"} recorded no deck` : "";
    // The two most-played decks fit the line at every unit; the rest is
    // "+n more" with every deck in its title.
    const shown = [...rows].sort((a, b) => b.matches - a.matches).slice(0, 2);
    const more = rows.length - shown.length;
    const all = rows.map((f) => `${f.faction} ${Math.round(f.winRate * 100)}% of ${f.matches}`).join(", ");
    return fx("factionWinRate", `${lab("By deck")}<span class="wr">${shown.map((f) => `<span title="${esc(f.faction)}: ${Math.round(f.winRate * 100)}% of ${plural(f.matches, "match", "matches")}${tail}"><i style="background:${FACTION_HEX[f.faction]}"></i>${esc(f.faction)} <b>${Math.round(f.winRate * 100)}%</b></span>`).join("")}${more ? `<span class="more" title="${esc(all)}">+${more} more</span>` : ""}</span>`, "kv");
  },

  /* Watch live */
  liveMatch: (d) => {
    const m = featured(d);
    if (!m) return fx("liveMatch", `<span>Nothing is playing right now. The ladder's next round starts soon.</span>`);
    const side = (p: "p1" | "p2") => {
      const s = m.now[p], who = m[p];
      return `<div class="side" style="--fc:${FACTION_HEX[who.faction] ?? "#999"}"><b>${esc(who.agentName)}</b><span class="sub">${esc(who.ownerName)} · ${esc(who.faction)}</span><span class="hp"><i style="width:${(100 * Math.max(0, s.health)) / s.maxHealth}%"></i></span><span class="sub">${s.health} health</span></div>`;
    };
    return fx("liveMatch", `<div class="vs">${side("p1")}<span class="vsx">vs<br><small>turn ${m.now.turn}</small></span>${side("p2")}</div>`);
  },
  liveArena: (d) => {
    const m = featured(d);
    if (!m) return fx("liveArena", `<div class="afit"><div class="arena916 empty"><span>The arena plays here when a match is on.</span></div></div>`);
    const row = (p: "p1" | "p2") => `<div class="arow" style="--fc:${FACTION_HEX[m[p].faction] ?? "#999"}">${m.now[p].board.map((u) => `<span class="unit${u.pending ? " pend" : ""}" title="${esc(u.name)}"><i>${esc(u.name)}</i><b>${u.attack}/${u.health}</b></span>`).join("") || `<span class="none">no units</span>`}</div>`;
    const hud = (p: "p1" | "p2") => `<div class="ahud"><b>${esc(m[p].agentName)}</b><span>${m.now[p].health} hp · ${m.now[p].energy}/${m.now[p].maxEnergy} energy · ${m.now[p].hand} in hand</span></div>`;
    return fx("liveArena", `<div class="afit"><div class="arena916" role="img" aria-label="the arena, turn ${m.now.turn}">${hud("p2")}${row("p2")}<div class="disc"><span>turn ${m.now.turn} · ${esc(m[m.now.activePlayer].agentName)} to play</span></div>${row("p1")}${hud("p1")}<span class="proto">9:16 · arena prototype: step 5</span></div></div>${d.play.liveMatch ? "" : `<span class="sub">Your agent's matches show here once you press Start.</span>`}`);
  },
  alsoLive: (d) => {
    const m = featured(d);
    const rest = d.live.matches.filter((x) => x !== m);
    return fx("alsoLive", `${lab("Also live")}${rest.length ? `<ul class="list">${rest.map((x) => `<li>${esc(x.p1.agentName)} vs ${esc(x.p2.agentName)} <span class="sub">turn ${x.now.turn}</span></li>`).join("")}</ul>` : `<span>No other match right now.</span>`}`, "blk");
  },
  playByPlay: (d) => {
    const m = featured(d);
    const lines = (m?.recentLines ?? []).map((l) => l.trim()).filter((l) => l && !/passes priority/.test(l)).slice(-5);
    return fx("playByPlay", `${lab("Play-by-play")}${lines.length ? `<ul class="list pbp">${lines.map((l) => `<li>${esc(l.replace(/^---\s*|\s*---$/g, "").replace(/\bp1\b/g, m!.p1.agentName).replace(/\bp2\b/g, m!.p2.agentName))}</li>`).join("")}</ul>` : `<span>The calls show here as the match plays.</span>`}`, "blk");
  },

  /* Packs */
  unopened: (d) => {
    const n = d.packs.unopened.length;
    return fx("unopened", n ? `${big(String(n))}<span>${n === 1 ? "pack" : "packs"} waiting${hasMatches(d) ? "" : ". Open them to add cards your agent can use."}</span>` : `<span>No packs waiting.</span>`, "row");
  },
  guarantee: (d) => {
    const { fullArtAfter, mythicAfter } = LIVE_PACK_ODDS.pity;
    const fa = Math.max(1, fullArtAfter - d.packs.pity.packsSinceFullArt), my = Math.max(1, mythicAfter - d.packs.pity.packsSinceMythic);
    return fx("guarantee", `${lab("Guaranteed")}<span>a Full Art within <b>${plural(fa, "pack")}</b> · a Mythic within <b>${plural(my, "pack")}</b></span>`, "kv");
  },
  lastPulls: (d) => {
    const cards = d.collection.recentPulls.flatMap((p) => p.cards).slice(0, 10);
    return fx("lastPulls", `${lab("Last pulls")}${cards.length ? `<span class="cards">${cards.map((c) => miniCard(c.cardId, c.name, c.rarity, c.finish)).join("")}</span>` : `<span>Your pulls appear here after your first pack.</span>`}`, "blk");
  },

  /* Store: a shop window (owner 2026-11-22): what's for sale as pictures
   * with prices, and Buy. The art is Season 0's own: the sealed pack the
   * opening tears (its plate), the coin painter, the boasts' emblems. */
  credits: (d) => fx("credits", `<i class="coin" aria-hidden="true"></i>${big(n0(d.wallet.credits))}<span>credits</span>`, "row"),
  affordable: (d) => {
    const c = d.wallet.credits;
    if (c === 0) return fx("affordable", `<span class="sub">Win matches to earn credits: your agent earns them by winning.</span>`);
    const o = d.packs.offer[0]!;
    const packs = Math.floor(c / o.priceCredits);
    // How many cosmetics the credits buy together (cheapest first), not how
    // many are each within reach: 449 buys one 300-credit cosmetic, not four.
    let left = c, items = 0;
    for (const p of forSale(d).filter((x) => !x.owned).map((x) => x.priceCredits).sort((a, b) => a - b)) if (p <= left) { left -= p; items++; }
    if (!packs) return fx("affordable", `<span class="sub">${o.priceCredits - c} more credits for a pack.</span>`);
    return fx("affordable", `<span class="sub">Enough for <b>${plural(packs, "pack")}</b>${items ? ` or <b>${plural(items, "cosmetic")}</b>` : ""}.</span>`);
  },
  buyPacks: (d, size) => {
    const o = d.packs.offer[0]!;
    const counts = size === "L" ? [1, d.packs.bulkOpenCount] : [1];
    return fx("buyPacks", `${lab(size === "L" ? "Packs" : "Featured pack")}<div class="shelf">${counts.map((n) => shopItem({
      art: n === 1 ? `<span class="pk">${sealedPack(o.setCode, size === "L" ? 54 : 60)}</span>` : `<span class="pk pile">${sealedPack(o.setCode, 46)}${sealedPack(o.setCode, 46)}${sealedPack(o.setCode, 46)}<b>×${n}</b></span>`,
      name: n === 1 ? "1 pack" : `${n} packs`,
      sub: `${o.name} · ${n * 5} cards`,
      price: o.priceCredits * n,
      can: d.wallet.credits >= o.priceCredits * n,
      tone: "#8b5cff",
    })).join("")}</div>`, "blk");
  },
  cosmetics: (d, size, opts) => {
    const all = forSale(d);
    if (size !== "L") {
      const featured = [...all.filter((c) => !c.owned), ...all.filter((c) => c.owned)].slice(0, opts?.featuredCosmetics ?? 3);
      return fx("cosmetics", `${lab("Featured cosmetics")}<div class="shelf">${featured.map((c) => cosmeticItem(c, d)).join("")}</div>`, "blk");
    }
    const kinds = [...new Set(all.map((c) => c.kind))];
    const none = SHELF_KINDS.filter((k) => !kinds.includes(k)).map((k) => cosmeticKind(k).toLowerCase() + "s");
    return fx("cosmetics", kinds.map((k) => `<div class="sgroup">${lab(cosmeticKind(k) + "s")}<div class="shelf">${all.filter((c) => c.kind === k).map((c) => cosmeticItem(c, d)).join("")}</div></div>`).join("") +
      (none.length ? `<span class="sub">No ${esc(listWords(none))} on sale this season.</span>` : ""), "blk shelfL");
  },

  /* Collection */
  completion: (d) => {
    const b = d.collection.sets[0]!.base;
    const pct = Math.round((100 * b.held) / b.total);
    return fx("completion", `${big(`${b.held} of ${b.total}`)}<span>${hasMatches(d) || d.collection.recentPulls.length ? `cards · ${pct}%` : "cards: your starter deck"}</span><span class="bar"><i style="width:${pct}%"></i></span>`, "row wrap");
  },
  chase: (d) => {
    const s = d.collection.sets[0]!;
    return fx("chase", `${lab("Rare finds")}<span>Secrets <b>${s.secrets.held} of ${s.secrets.total}</b> · Prototypes <b>${s.prototypes.runsHeld} of ${s.prototypes.runs}</b></span>`, "kv");
  },
  bestCards: (d, size) => {
    const best = [...d.collection.cards]
      .map((c) => ({ c, f: c.copies.reduce((m, x) => ((FINISH_RANK[x.finish] ?? 0) > (FINISH_RANK[m] ?? 0) ? x.finish : m), "standard") }))
      .sort((a, b) => (RARITY_RANK[b.c.rarity] ?? 0) - (RARITY_RANK[a.c.rarity] ?? 0) || (FINISH_RANK[b.f] ?? 0) - (FINISH_RANK[a.f] ?? 0) || a.c.name.localeCompare(b.c.name))
      .slice(0, size === "L" ? 5 : 3);
    return fx("bestCards", `${lab(hasMatches(d) || d.collection.recentPulls.length ? "Best cards" : "Your starter's best")}<span class="cards">${best.map(({ c, f }) => miniCard(c.cardId, c.name, c.rarity, f, "m")).join("")}</span>`, "blk");
  },
  binder: (d) => {
    const by = new Map<string, number>();
    for (const c of d.collection.cards) by.set(c.faction, (by.get(c.faction) ?? 0) + 1);
    const max = Math.max(...by.values());
    return fx("binder", `${lab("Binder by faction")}<ul class="bars">${[...by].sort((a, b) => b[1] - a[1]).map(([f, n]) => `<li><span>${esc(f)}</span><span class="bar"><i style="width:${(100 * n) / max}%;background:${FACTION_HEX[f] ?? "#999"}"></i></span><span>${plural(n, "card")}</span></li>`).join("")}</ul>`, "blk");
  },

  /* Daily rewards */
  earnedToday: (d) => fx("earnedToday", `${big(String(d.daily.creditsFromWins))}<span>of ${dayMost(d)} credits from wins today</span><span class="bar"><i style="width:${(100 * d.daily.creditsFromWins) / dayMost(d)}%"></i></span>`, "row wrap"),
  nextWinPays: (d) => fx("nextWinPays", `<span>${d.daily.nextWinPays ? `${d.daily.wins.length ? "Next" : "First"} win pays <b>${d.daily.nextWinPays}</b>` : "Wins pay nothing more today"}</span>`),
  winSchedule: (d) => {
    const won = d.daily.wins.length;
    const steps = d.daily.schedule.filter((r) => r.toWin !== null).map((r) => {
      const label = r.fromWin === r.toWin ? `Win ${r.fromWin}` : `Wins ${r.fromWin}–${r.toWin}`;
      const state = won >= r.toWin! ? "done" : won >= r.fromWin - 1 ? "now" : "";
      return `<li class="${state}"><span>${label}</span><b>${r.credits} each</b></li>`;
    });
    return fx("winSchedule", `${lab("Today's pay")}<ol class="steps">${steps.join("")}</ol><span class="sub">Wins pay credits, the first win most. A loss pays ${d.daily.nextLossPays} (up to ${d.daily.maxPaidLosses} a day).</span>`, "blk");
  },
  freePack: (d) => {
    const w = d.dailyPack.waiting;
    return fx("freePack", w ? `<span class="pill ok">${w > 1 ? `${w} free daily packs ready` : "Free daily pack ready"}</span>` : `<span class="sub">Free pack claimed. The next one comes at midnight ${esc(resetPlace(d.dailyPack.timeZone))}.</span>`, "row");
  },
  dayReset: (d) => fx("dayReset", `${lab("Resets")}<span>at midnight ${esc(resetPlace(d.daily.timeZone))}</span>`, "kv"),

  /* Match history */
  lastResult: (d) => {
    const m = d.matches.matches[0];
    return fx("lastResult", m ? `<span class="res ${m.result}">${m.result === "win" ? "Won" : m.result === "loss" ? "Lost" : "Drew"}</span><span>vs ${esc(m.opponent.agentName)} <span class="sub">(${esc(m.opponent.ownerName)})</span></span>` : `<span>No matches yet${hasMatches(d) ? "" : ". Press Start on My agent; results and replays show here."}</span>`, "row");
  },
  recentMatches: (d) => {
    const rows = d.matches.matches.slice(0, 3);
    if (!rows.length) return fx("recentMatches", `<span class="sub">Your agent's last three matches will list here, with what each paid.</span>`);
    return fx("recentMatches", `<ul class="list mh">${rows.map((m) => `<li><span class="res ${m.result}">${m.result === "win" ? "W" : m.result === "loss" ? "L" : "D"}</span><span>vs ${esc(m.opponent.agentName)}</span><span class="sub">+${m.credits} credits${m.rating ? ` · rating ${signed(m.rating.change)}` : ""}</span></li>`).join("")}</ul>`);
  },
  replays: (d) => {
    const rows = d.matches.matches.slice(0, 3);
    const kept = rows.filter((m) => m.hasReplay).length;
    return fx("replays", rows.length ? `${lab("Replays")}<span>${kept ? `${plural(kept, "replay")} of the last ${rows.length}` : "These matches were played before replays were kept."} · ${plural(d.matches.total, "match", "matches")} in all</span>` : `${lab("Replays")}<span>Every match keeps a replay and a log.</span>`, "kv");
  },

  /* Notifications */
  unread: (d) => fx("unread", d.notifications.unread ? `${big(String(d.notifications.unread))}<span>new</span>` : `<span>All caught up</span>`, "row"),
  alerts: (d, size) => {
    const one = d.play.agents.length === 1;
    const list = d.notifications.notifications.slice(0, size === "L" ? 6 : 3);
    return fx("alerts", `<ul class="list al">${list.map((a) => `<li class="${a.readAt ? "" : "new"}"><span>${alertText(a, one)}</span></li>`).join("")}</ul>`, "blk");
  },
  alertKinds: (d) => {
    const names: Record<string, string> = { matchResult: "Results", bigPull: "Big pulls", dailyPack: "Free pack", autoPlayStopped: "Agent stopped" };
    return fx("alertKinds", `${lab("By kind")}<span class="chips">${Object.entries(d.notifications.unreadByKind).map(([k, v]) => `<span class="chip">${esc(names[k] ?? k)} <b>${v}</b></span>`).join("")}</span>`, "kv");
  },

  /* Music: waiting on the owner's spec (plan item 24). */
  nowPlaying: () => fx("nowPlaying", `<span class="sub">Waiting on the music spec (plan step 6): nothing is built until you approve it.</span>`),
  musicSlots: () => fx("musicSlots", `${lab("Save slots")}<span class="sub">5 slots, per the spec once approved.</span>`, "kv"),
  musicMaker: () => fx("musicMaker", `${lab("Make your own")}<span class="sub">The drum machine and loop creator, per the spec once approved.</span>`, "kv"),
};

/** The alert, linked to the tile that owns its subject. */
export function alertText(a: Alert, oneAgent: boolean): string {
  if (a.kind === "dailyPack") return `Your free daily pack is waiting <a class="to" data-to="daily">Daily rewards</a>`;
  if (a.kind === "matchResult" && a.matchResult) {
    const m = a.matchResult;
    const who = oneAgent ? "" : `${esc(m.agentName)}: `;
    return `${who}${m.result === "win" ? "Won" : m.result === "loss" ? "Lost" : "Drew"} vs ${esc(m.opponent.agentName)}, +${m.credits} credits <a class="to" data-to="history">Match history</a>`;
  }
  if (a.kind === "bigPull") return `A big pull: ${esc(a.bigPull?.cardName ?? a.bigPull?.name ?? "a rare card")} <a class="to" data-to="collection">Collection</a>`;
  if (a.kind === "autoPlayStopped") return `Your agent stopped playing <a class="to" data-to="agent">My agent</a>`;
  return esc(a.kind);
}

export function featured(d: OwnerData): LiveMatch | null {
  return d.live.matches.find((m) => m.matchId === d.live.mine) ?? d.live.matches[0] ?? null;
}

/* ------------------------------------------------- the shop window */

/** The cosmetic kinds a full shelf groups by (owner 2026-11-22: arenas,
 * card backs (deck sleeves), boasts, coins, avatars). Only what the server
 * sells is drawn; a kind with nothing on sale is named in one line. */
export const SHELF_KINDS = ["arena", "cardBack", "boast", "coin", "avatar"] as const;
const listWords = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);

type ForSale = OwnerData["store"]["cosmetics"][number];
const forSale = (d: OwnerData) => d.store.cosmetics as ForSale[];

let plateCache: Map<string, string> | null = null;
/** The sealed pack's plate (the circuit field and the four faction marks),
 * from the pack page's own pure source, run here at build time. */
function plateOf(setCode: string): string {
  plateCache ??= new Map();
  if (!plateCache.has(setCode)) {
    const w: { SITE_FACE?: { packPlateSvg(s: string): string } } = {};
    new Function("window", FACE_SCRIPT)(w);
    plateCache.set(setCode, w.SITE_FACE!.packPlateSvg(setCode));
  }
  return plateCache.get(setCode)!;
}
/** Season 0's sealed pack (the markup siteShop.sealedPackHtml draws, with
 * its plate), `px` wide. */
export function sealedPack(setCode: string, px: number): string {
  return `<div class="spk" style="--pw:${Math.round(px)}px" aria-hidden="true"><div class="wrap"><div class="pa">${plateOf(setCode)}</div><div class="crimp t"></div><div class="logo">AI·TCG</div><div class="emb"><svg><use href="#setsym"/></svg></div><div class="set">SEASON ZERO</div><div class="crimp b"></div></div></div>`;
}

function shopItem(x: { art: string; name: string; sub: string; price: number; can: boolean; owned?: boolean; tone: string }): string {
  return `<figure class="si" style="--c:${x.tone}"><span class="si-art">${x.art}${x.owned ? "" : `<span class="si-p"><i class="coin" aria-hidden="true"></i>${n0(x.price)}<span class="vh"> credits</span></span>`}</span>` +
    `<figcaption><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></figcaption>` +
    (x.owned ? `<span class="pill ok si-own">Owned</span>` : `<button type="button" class="btn sm si-buy"${x.can ? "" : " disabled"}>Buy</button>`) + `</figure>`;
}

function cosmeticItem(c: ForSale, d: OwnerData): string {
  const tone = (c.faction && FACTION_HEX[c.faction]) || "#8f8cff";
  const art = c.kind === "coin" && c.itemId ? coinSwatchHtml(c.itemId, { w: 84, h: 64 })
    : `<span class="sh-emb" aria-hidden="true"><svg viewBox="0 0 24 24"><path class="sh-hex" d="M12 1.6 21 6.8v10.4L12 22.4 3 17.2V6.8z"/>${c.kind === "boast" && c.itemId ? `<g class="sh-glyph" transform="translate(5.4 5.4) scale(.55)"><use href="#lg-${esc(c.itemId)}"/></g>` : ""}</svg></span>`;
  return shopItem({ art, name: c.name, sub: cosmeticKind(c.kind), price: c.priceCredits, can: d.wallet.credits >= c.priceCredits, owned: c.owned, tone });
}

/** What a page needs once for the shop window's art: the pack's and the
 * boasts' symbols, the coin painter, and their CSS. */
export function homeArt(): { css: string; defs: string; script: string } {
  return {
    defs: faceSymbols() + boastGlyphSymbols(),
    script: COIN_SCRIPT,
    css: `${SEALED_PACK_CSS}
.coin { display: inline-block; flex: none; width: 1em; height: 1em; border-radius: 50%; vertical-align: -.12em; background: radial-gradient(circle at 35% 30%, #fff4c4, #ffcf5c 45%, #b9801c); box-shadow: inset 0 0 0 1.5px rgba(120,70,0,.45); }
.big + span .coin { margin-right: 4px; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.shelf { display: flex; gap: 10px; flex-wrap: wrap; align-items: stretch; }
.si { --c: #8f8cff; margin: 0; display: flex; flex-direction: column; align-items: stretch; gap: 4px; width: 118px; padding: 6px; border-radius: 14px; background: color-mix(in srgb, var(--c) 10%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 34%, transparent); }
.si-art { position: relative; height: 92px; display: grid; place-items: center; border-radius: 10px; overflow: hidden;
  background: radial-gradient(ellipse 80% 70% at 50% 60%, color-mix(in srgb, var(--c) 38%, transparent), transparent 70%), linear-gradient(180deg, #0b0f2a, #161a44); }
.si-art::after { content: ""; position: absolute; inset: auto 0 0; height: 40%; background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--c) 30%, transparent) 0 1px, transparent 1px 12px), linear-gradient(transparent, color-mix(in srgb, var(--c) 18%, transparent)); mask: linear-gradient(transparent, #000); pointer-events: none; }
.si-art .spk { box-shadow: 0 8px 18px rgba(0,0,0,.5), 0 0 18px color-mix(in srgb, var(--c) 55%, transparent); z-index: 1; }
.si-art .sh-emb { width: 60px; height: 60px; z-index: 1; color: var(--c); filter: drop-shadow(0 0 10px color-mix(in srgb, var(--c) 70%, transparent)); }
.si-art .sh-emb svg { width: 100%; height: 100%; overflow: visible; }
.si-art .sh-hex { fill: color-mix(in srgb, var(--c) 18%, #0b0d2a); stroke: currentColor; stroke-width: 1.1; }
.si-art .sh-glyph { color: #fff; } .si-art .sh-glyph use { color: color-mix(in srgb, var(--c) 40%, #fff); }
.si-art .si-pv { z-index: 1; display: block; } .si-art canvas { display: block; }
.pk.pile { position: relative; width: 84px; height: 80px; z-index: 1; } .pk.pile .spk { position: absolute; top: 3px; } .pk.pile .spk:nth-child(1) { left: 2px; transform: rotate(-12deg); } .pk.pile .spk:nth-child(2) { left: 36px; transform: rotate(12deg); } .pk.pile .spk:nth-child(3) { left: 19px; }
.pk.pile b { position: absolute; right: -2px; bottom: 2px; z-index: 2; font-size: 12px; padding: 1px 6px; border-radius: 7px; background: #0b0f2a; color: #fff; box-shadow: inset 0 0 0 1px rgba(255,255,255,.3); }
.si-p { position: absolute; right: 5px; bottom: 5px; z-index: 2; display: inline-flex; align-items: center; gap: 4px; padding: 1px 7px 1px 4px; border-radius: 999px; font-weight: 800; font-size: 12px; color: #fff; background: rgba(6,8,26,.8); box-shadow: inset 0 0 0 1px rgba(255,255,255,.22); }
.si figcaption { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.si figcaption b { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .si figcaption small { font-size: 11px; color: var(--muted); }
.si-buy { width: 100%; } .si-own { align-self: flex-start; font-size: 11px; }
.shelfL { gap: 8px; } .sgroup { display: flex; flex-direction: column; gap: 4px; }
`,
  };
}

/* ---------------------------------------------- a tile's next action */

export interface Action { label: string; to: string; primary: boolean; disabled?: boolean }

/** The one next action a tile asks for at a size (the spec's `next`, made
 * concrete for this owner's state). */
export function nextAction(t: TileSpec, size: Size, d: OwnerData): Action {
  const placed = isPlaced(d);
  switch (t.id) {
    case "agent":
      // The spec's next at every size is Start / Stop: the startStop fact
      // itself, which the mockups draw where their action goes.
      { const a = agentState(d); return { label: a.action, to: "agent", primary: a.action !== "Stop" }; }
    case "ladder":
      return { label: placed ? "Open Stats" : "How placement works", to: "ladder", primary: false };
    case "watch":
      return featured(d) ? { label: size === "S" ? "Watch" : "Full screen", to: "watch", primary: true } : { label: "See the schedule", to: "watch", primary: false };
    case "packs":
      return d.packs.unopened.length ? { label: "Open a pack", to: "cards", primary: true } : { label: "Buy packs in Store", to: "cards", primary: false };
    case "store":
      if (size !== "S") return { label: "See the whole Store", to: "cards", primary: false };
      return d.wallet.credits >= d.packs.offer[0]!.priceCredits ? { label: "Buy", to: "cards", primary: false } : { label: "How to earn credits", to: "cards", primary: false };
    case "collection":
      if (!d.collection.recentPulls.length && d.packs.unopened.length && size !== "L") return { label: "Open packs", to: "cards", primary: true };
      return { label: size === "L" ? "Open the binder" : "Open Collection", to: "cards", primary: false };
    case "daily":
      // Owner 2026-11-22: the free daily pack is claimed here.
      return d.dailyPack.waiting ? { label: "Claim free pack", to: "daily", primary: true } : { label: "Earnings in Stats", to: "ladder", primary: false };
    case "history":
      if (!d.matches.total) return { label: "Start your agent", to: "agent", primary: true };
      return { label: size === "S" ? "Open the last match" : "All matches", to: "agent", primary: false };
    case "notif":
      return d.notifications.unread ? { label: size === "S" ? "Open the latest" : "Mark all read", to: "home", primary: false } : { label: "Settings", to: "settings", primary: false };
    case "music":
      return { label: "Waiting on owner", to: "home", primary: false, disabled: true };
  }
  return { label: t.next[size], to: "home", primary: false };
}

/** A tile's facts at a size, drawn. */
export function tileFacts(t: TileSpec, size: Size, d: OwnerData, opts?: FactOpts): string[] {
  return t.sizes[size].map((f) => RENDER[f](d, size, opts));
}

/** The spec's facts in a drawn fragment, in order (for the tests). */
export function factsIn(html: string): Fact[] {
  return [...html.matchAll(/data-fact="(\w+)"/g)].map((m) => m[1] as Fact);
}

export const tileById = (id: string): TileSpec => TILES.find((t) => t.id === id)!;
export { FACTS, TILES };
