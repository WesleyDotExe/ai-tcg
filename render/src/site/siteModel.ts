// The owner website's pure logic (Season 0 render item 1, render session
// 44): the sidebar, the routes, what each page waits on, and how the play
// settings read on the page. No DOM, no fetch; the page bundles this file
// and the tests import it directly, so what is tested is what runs.
//
// The spec is the owner's 2026-10-05 "website first" entry (section B, the
// site layout), as amended 2026-11-01 (the Season 0 list), and
// render/reference/owner-web-mockup.html for the look.

import type { SitePlay, SiteRebuildJob } from "./siteApi.js";

export type PageId = "home" | "match" | "live" | "collection" | "store" | "tournament" | "stats" | "settings" | "connect";

export interface NavItem {
  id: PageId;
  label: string;
  icon: keyof typeof ICONS;
  /** Shown as "Soon" and not opened (the Tournament, after Season 0). */
  soon?: boolean;
}

/** The sidebar, top to bottom (2026-10-05 B): the main pages, a rule, then
 * Settings and Connect agent. Tournament comes after Season 0 (2026-11-01);
 * the owner asked for "hidden or coming soon" to be proposed: this build
 * shows it, greyed, with a Soon badge (a checkpoint call). */
export const NAV_MAIN: NavItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "match", label: "Agent match", icon: "match" },
  { id: "live", label: "Watch live", icon: "eye" },
  { id: "collection", label: "Collection", icon: "col" },
  { id: "store", label: "Store", icon: "store" },
  { id: "tournament", label: "Tournament", icon: "trophy", soon: true },
  { id: "stats", label: "Stats", icon: "stats" },
];
export const NAV_LOWER: NavItem[] = [
  { id: "settings", label: "Settings", icon: "gear" },
  { id: "connect", label: "Connect agent", icon: "link" },
];

export const PAGE_TITLES: Record<PageId, string> = {
  home: "Home",
  match: "Agent match",
  live: "Watch live",
  collection: "Collection",
  store: "Store",
  tournament: "Tournament",
  stats: "Stats",
  settings: "Settings",
  connect: "Connect agent",
};

/** The pages not built yet: what each waits on, in the words of
 * OWNER_API.md's "Not built yet" list, and what the page will hold. The
 * page says so plainly instead of drawing made-up numbers. An empty `needs`
 * means the server already serves the page's data (session 64) and the page
 * itself is the render lane's next work. When a page is built it leaves
 * this list. */
export const PAGE_WAITS: Partial<Record<PageId, { needs: string[]; will: string }>> = {
  match: { needs: ["live and featured matches"], will: "Your agent's match on a big board, with the play-by-play, auto-play and the 2× vote beside it." },
  live: { needs: ["live and featured matches"], will: "The featured matches, and any one of them on the big board with its play-by-play." },
  tournament: { needs: ["tournament"], will: "Tournaments come after Season 0." },
  stats: { needs: ["ladder", "stats"], will: "Your rating and form, results by faction, and the ladder." },
};

/** The waiting page's last line. */
export function waitsLine(needs: string[]): string {
  return needs.length ? `Waiting on the server for: ${needs.join(", ")}.` : "The server serves this now; the page is being built next.";
}

/** Routes are the URL's hash ("#/settings"), so a reload stays on the page
 * and the browser's back button works. Anything unknown is Home. */
export function pageFromHash(hash: string): PageId {
  const id = hash.replace(/^#\/?/, "").split(/[/?]/)[0] ?? "";
  // Own keys only: "constructor" or "__proto__" are not pages.
  return (Object.prototype.hasOwnProperty.call(PAGE_TITLES, id) ? id : "home") as PageId;
}
export function hashOf(page: PageId): string {
  return page === "home" ? "#/" : `#/${page}`;
}

export type ThemePref = "system" | "light" | "dark";
/** The theme the page draws: the owner's choice, or the system's. */
export function themeOf(pref: ThemePref, systemDark: boolean): "light" | "dark" {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}
/** The top bar's theme button cycles System -> Light -> Dark. */
export function nextTheme(pref: ThemePref): ThemePref {
  return pref === "system" ? "light" : pref === "light" ? "dark" : "system";
}

export interface AgentStatus {
  label: string;
  tone: "ready" | "live" | "none";
}
/** The agent card's status line (sidebar and My agent). Season 0 knows two
 * states from the play settings: in a live match, or ready. */
export function agentStatus(play: SitePlay): AgentStatus {
  if (!play.connectedAgent) return { label: "No agent connected", tone: "none" };
  if (play.liveMatch) return { label: "In a match", tone: "live" };
  return { label: "Ready", tone: "ready" };
}

export function styleName(play: SitePlay, id: string): string {
  return play.playStyles.find((s) => s.id === id)?.name ?? id;
}

/** "Which deck plays", in one line: whose choice it is and the deck. */
export function deckLine(play: SitePlay): string {
  const d = play.activeDeck;
  if (play.deckChoice === "forced") return d ? `You chose: ${d.name} · ${d.cards} cards` : "You chose a deck, but none is active";
  if (!play.agentDeck) return "Your agent picks · no deck built yet";
  return `Your agent picks: ${play.agentDeck.name} · ${play.agentDeck.cards} cards`;
}

export type RebuildView =
  | { kind: "forced"; text: string }
  | { kind: "running"; text: string }
  | { kind: "wanted"; text: string; reasons: string[] }
  | { kind: "current"; text: string }
  | { kind: "failed"; text: string };

/** The rebuild panel's state. The store says why a rebuild is wanted
 * (`rebuild.reasons`); the latest job says what happened last. */
export function rebuildView(play: SitePlay): RebuildView {
  const job = play.rebuild.job;
  if (job?.state === "running") return { kind: "running", text: "Your agent is building its deck. This page keeps working while it plays its games." };
  if (play.deckChoice === "forced") return { kind: "forced", text: "You chose the deck, so the agent doesn't build one. Hand the choice back to the agent to rebuild." };
  if (play.rebuild.reasons.length > 0) return { kind: "wanted", text: "Your agent's deck wants a rebuild:", reasons: play.rebuild.reasons };
  if (job?.state === "failed") return { kind: "failed", text: `The last rebuild failed: ${job.error ?? "no reason given"}` };
  return { kind: "current", text: play.agentDeck ? "Your agent's deck is up to date." : "Your agent hasn't built a deck yet." };
}

/** A finished build, in words: the faction it picked and what it weighed. */
export function jobSummary(job: SiteRebuildJob): string[] {
  if (job.state !== "done" || !job.result) return [];
  const r = job.result;
  const lines = [`Built a ${r.cards}-card ${r.faction} deck.`];
  for (const f of r.factions) {
    if (f.infeasible) lines.push(`${f.faction}: couldn't build (${f.infeasible})`);
    else if (f.winRate !== null) lines.push(`${f.faction}: wins ${pct(f.winRate)} against the shipped decks`);
    else lines.push(`${f.faction}: weighed without games`);
  }
  return lines;
}

export function pct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

/** How a refusal reads in a toast. 0 is "couldn't reach the server". */
export function errorText(status: number, message: string): string {
  if (status === 0) return "Can't reach the server. Check that it's running, then try again.";
  if (status === 429) return `Too many tries: ${message}`;
  if (status === 401) return message === "wrong login or password" ? "Wrong login or password." : "You've been signed out. Sign in again.";
  // The store's own words, with a capital.
  return message.charAt(0).toUpperCase() + message.slice(1) + (/[.!?]$/.test(message) ? "" : ".");
}

/** The account button's letter. */
export function initialOf(login: string): string {
  const c = login.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

export const FACTION_HEX: Record<string, string> = {
  Cortex: "#2fb6ff",
  Aegis: "#ff7d24",
  Swarm: "#6bdc3a",
  Null: "#c95cff",
  Neutral: "#fff0c2",
};

/** Line icons (24 px grid, stroked in currentColor), the mockup's set. */
export const ICONS = {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  match: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  col: '<rect x="3" y="5" width="11" height="15" rx="2"/><path d="M17 6.5l3 .8-3.2 12.2-4.3-1.1"/>',
  store: '<path d="M4 8h16l-1.5 12h-13z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  moon: '<path d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/>',
  out: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  arrow: '<path d="M7 17 17 7M9 7h8v8"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  spark: '<path d="M12 3l2.2 6.3L20.5 12l-6.3 2.2L12 21l-2.2-6.8L3.5 12l6.3-2.7z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
} as const;

export function icon(name: keyof typeof ICONS, size = 20): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** Text into HTML. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
