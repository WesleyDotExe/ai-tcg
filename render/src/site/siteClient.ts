// The owner website in the browser (Season 0 render item 1, render session
// 44): sign-in, the glass sidebar and top bar, and the pages. Bundled by
// sitePage.ts with esbuild into one inline script; everything it shows
// comes from the owner API (siteApi.ts) or says plainly what it waits on
// (siteModel.ts PAGE_WAITS). No made-up numbers.
//
// What this slice serves for real: signing in and out, the agent card,
// Home's My agent and Deck panels, Settings -> Play (who picks the deck,
// the faction lock, the forced deck, each agent's play style, "rebuild
// now" with its job), Connect agent's list, and the theme.
//
// Session 45 (Season 0 render item 2, the look): the liquid WebGL
// background (liquid.ts) and the background picker in Settings -> Display;
// the theme and background saved to the owner's account (PATCH
// /api/account/settings), so they follow the owner to any browser; the
// owner's display name and, for the house admin, Settings -> Admin (who am
// I); credits, pack points and the Open button in the top bar (the wallet).
//
// Session 46 (Season 0 render item 3): Home is the widget board, saved to
// the owner's account (`GET`/`PUT /api/board`): the twelve Season 0 widgets
// at S/M/L (siteWidgets.ts draws them from the owner API's answers),
// Customise mode (drag or arrow keys to move, S/M/L, "−", + Add widget,
// Background, Recommended layout; Done saves), the empty state, the widget
// limits the server sends, at most two live boards, narrow-window stacking.
//
// Session 47 (the Store page and pack opening on the site): the Store page
// (buying 1 to 10 packs, the packs waiting and where they came from, the
// free daily pack's claim, the recent openings' cards, the cosmetics on
// sale), and pack opening full screen: the top bar's Open, the Packs
// widget's Open and Open 10 and the Store's buttons open real packs (POST
// /api/packs/open) and the standalone pack-opening page, in its site mode
// in a frame over everything, plays the server's answer (siteStore.ts
// revealOf). Its summary's buttons open the next pack or ten more, or close.
// The reveal's sound is the account's sound setting.

import { avatarSvg } from "../avatar.js";
import { CLOSE_WIN_HEALTH } from "../../../economy/src/cosmetics.js";
import { agentLoadoutRows, loadoutPayload, type SiteLoadout, type SiteOwnedCosmetic } from "./siteLoadout.js";
import type { PickerAnswer, PickerSitePayload } from "../loadoutPicker.js";
import { startLiquid, type Liquid } from "./liquid.js";
import { SiteApiError, salvageNeedsConfirmation, siteApi, type SiteHistory, type SiteHistoryRow, type SiteLive, type SiteAccountSettings, type SiteFaction, type SiteMe, type SiteOpenRequest, type SitePlay, type SiteSettingsPatch, type SiteStore, type SiteWallet } from "./siteApi.js";
import { BUY_MAX, buyView, dailyPackView, recentOpenings, revealOf, shortWhen, soundPatchOf, soundPrefOf, summaryButtons, summaryWhy, unopenedGroups, type SiteReveal, type SummaryAction } from "./siteStore.js";
import {
  WIDGET_INFO,
  addBlock,
  addWidget,
  liveViews,
  moveBy,
  moveWidget,
  recommendedWidgets,
  removeWidget,
  resizeWidget,
  sameBoard,
  type SiteBoard,
  type SiteCollection,
  type SiteDaily,
  type SitePacks,
  type SiteWidget,
  type WidgetSize,
  type WidgetType,
} from "./siteBoard.js";
import { DEFAULT_FILTERS, binderBlocks, craftView, copiesByCard, neighbours, salvageConfirmText, salvageView, type BinderSlot, type CollectionFilters, type FactionFilter, type ShowFilter, type CollectionTab, type SiteBinder } from "./siteCollection.js";
import { collectionPageHtml, faceRenderer, viewerHtml, type FaceFns, type FaceRenderer, type ViewerState } from "./siteCollectionHtml.js";
import { miniCard, packArt, sourcesFor, widgetHtml, type WidgetData, type WidgetSource } from "./siteWidgets.js";
import { autoPlaySwitch, autoPlayView, compactBoard, historyRowHtml, historyRowView, myLiveMatch, nearSeat, recordOf, scoreboardHtml, scoreboardOf, tidyLines, watchAsHtml } from "./siteMatches.js";
import { BACKGROUND_IDS, DEFAULT_BACKGROUND, amount, backgroundOf, drawnTheme, openButton, stillGradient } from "./siteLook.js";
import {
  FACTION_HEX,
  NAV_LOWER,
  NAV_MAIN,
  PAGE_TITLES,
  PAGE_WAITS,
  agentStatus,
  deckLine,
  errorText,
  esc,
  hashOf,
  icon,
  initialOf,
  jobSummary,
  nextTheme,
  pageFromHash,
  rebuildView,
  styleName,
  waitsLine,
  type NavItem,
  type PageId,
  type ThemePref,
} from "./siteModel.js";

const api = siteApi((input, init) => fetch(input, init));
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

/** The session lives for the tab (sessionStorage), so a reload stays
 * signed in and closing the tab signs the browser out of it. The server's
 * expiry still rules: a 401 drops it. */
const SESSION_KEY = "aitcg.site.session";
interface Session {
  token: string;
  login: string;
  expiresAt: string;
}

const state: {
  session: Session | null;
  play: SitePlay | null;
  me: SiteMe | null;
  /** The account settings as the server last answered (null: not read). */
  settings: SiteAccountSettings | null;
  wallet: SiteWallet | null;
  page: PageId;
  theme: ThemePref;
  background: string;
  busy: boolean;
  poll: number;
  /** The saved board (null: not read, or the read failed: boardError). */
  board: SiteBoard | null;
  boardError: string | null;
  /** Customise mode's working copy; null when not customising. */
  draft: SiteWidget[] | null;
  saving: boolean;
  /** What the widgets read, each fetched only when a widget on the board needs it. */
  home: { packs: SitePacks | null; collection: SiteCollection | null; daily: SiteDaily | null; store: SiteStore | null; live: SiteLive | null; history: SiteHistory | null; errors: Partial<Record<WidgetSource, string>> };
  colFilter: string;
  /** The Store page's own reads: the packs (with the daily pack), the store,
   * and the collection's recent openings. */
  shop: { packs: (SitePacks & { wallet: SiteWallet }) | null; store: SiteStore | null; recent: SiteCollection | null; error: string | null;
    /** Session 49: what each agent wears (by agent id) and the owned cosmetics, for "Your agents". */
    loadouts: Record<string, SiteLoadout>; owned: SiteOwnedCosmetic[] | null };
  /** How many packs the Store's Buy button buys (1 to 10). */
  buyCount: number;
  /** A pack opening is on screen (or its request is out). */
  opening: boolean;
  /** The Collection page (session 48): the set's binder, the collection
   * (every copy), the tab and filters, and the card viewer when open. */
  col: { binder: SiteBinder | null; collection: SiteCollection | null; error: string | null; filters: CollectionFilters; viewer: ViewerState | null };
  /** The match pages (session 50): the history read so far (pages of
   * `GET /api/matches`, newest first), whether older ones remain, and an
   * auto-play change in flight. */
  hist: { rows: SiteHistoryRow[]; total: number; more: boolean; error: string | null; loading: boolean };
  autoBusy: boolean;
  /** The replay on screen (its match id), or null. */
  replay: string | null;
  /** The agent's live match followed move by move on Agent match
   * (`GET /api/live/:id?from=N`): the next move to ask for and every line
   * released so far, tidied. */
  follow: { matchId: string; next: number; started: boolean; lines: string[] } | null;
} = {
  session: null, play: null, me: null, settings: null, wallet: null, page: "home", theme: "system", background: DEFAULT_BACKGROUND, busy: false, poll: 0,
  board: null, boardError: null, draft: null, saving: false, home: { packs: null, collection: null, daily: null, store: null, live: null, history: null, errors: {} }, colFilter: "All",
  shop: { packs: null, store: null, recent: null, error: null, loadouts: {}, owned: null }, buyCount: 1, opening: false,
  col: { binder: null, collection: null, error: null, filters: { ...DEFAULT_FILTERS }, viewer: null },
  hist: { rows: [], total: 0, more: false, error: null, loading: false }, autoBusy: false, replay: null, follow: null,
};

let liquid: Liquid | null = null;

// The page's test hook (the evidence script reads it).
(window as unknown as { __site: unknown }).__site = {
  state: () => ({
    page: state.page,
    signedIn: !!state.session,
    theme: state.theme,
    background: state.background,
    drawn: document.body.dataset.theme,
    play: state.play,
    me: state.me,
    settings: state.settings,
    wallet: state.wallet,
    board: state.board,
    draft: state.draft,
    editing: state.draft !== null,
    saving: state.saving,
    home: state.home,
    shop: state.shop,
    opening: state.opening,
    dress: dressAgent,
    col: { filters: state.col.filters, viewer: state.col.viewer, binder: state.col.binder, error: state.col.error, loaded: !!state.col.binder },
    hist: state.hist,
    replay: state.replay,
  }),
  /** The replay frame's own hook (the arena's), or null. */
  arena: () => (replayFrame?.contentWindow as unknown as { __replay?: unknown } | null)?.__replay ?? null,
  /** The pack-opening frame's own state (its log of every beat), or null. */
  pack: () => (frame?.contentWindow as unknown as { __pack?: unknown } | null)?.__pack ?? null,
  /** The loadout frame's own hook (its state and stats), or null. */
  loadout: () => (dressFrame?.contentWindow as unknown as { __loadout?: unknown } | null)?.__loadout ?? null,
  liquid: () => liquid?.stats() ?? null,
};

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || Date.parse(s.expiresAt) <= Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}
// ---- the spectator point of view (render session 52) ------------------------
// The side a spectator chose to watch each match as (owner 2026-11-02):
// remembered per match in this tab only, never on the account; the next
// match starts from its default (the higher-rated side) again.
const VIEW_KEY = "ai-tcg.watchAs";
const viewChoices = new Map<string, "p1" | "p2">(loadViews());
function loadViews(): [string, "p1" | "p2"][] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(VIEW_KEY) ?? "{}") as Record<string, unknown>;
    return Object.entries(raw).filter((e): e is [string, "p1" | "p2"] => e[1] === "p1" || e[1] === "p2");
  } catch {
    return [];
  }
}
function viewOf(matchId: string): "p1" | "p2" | null {
  return viewChoices.get(matchId) ?? null;
}
function setViewOf(matchId: string, seat: "p1" | "p2"): void {
  viewChoices.delete(matchId);
  viewChoices.set(matchId, seat);
  // The newest 50 matches are plenty for a tab.
  while (viewChoices.size > 50) viewChoices.delete(viewChoices.keys().next().value as string);
  try {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(Object.fromEntries(viewChoices)));
  } catch {
    /* storage blocked: the choice lasts this page load */
  }
}

function saveSession(s: Session | null): void {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked: the session lasts this page load */
  }
}

// ---- theme and background ---------------------------------------------------
const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
function applyTheme(): void {
  const bg = backgroundOf(state.background);
  const drawn = drawnTheme(state.theme, bg.id, !!darkQuery?.matches);
  document.body.dataset.theme = drawn;
  document.body.dataset.bg = bg.id;
  document.body.classList.toggle("bg-plain", bg.kind === "plain");
  // Under the canvas: the still version (before the first frame, under
  // reduce motion's single frame, and the whole background without WebGL).
  const still = document.getElementById("bg");
  if (still) still.style.background = stillGradient(bg, drawn === "dark");
  const b = document.getElementById("theme-btn");
  if (b) {
    b.innerHTML = icon(drawn === "dark" ? "moon" : "sun", 19) + (state.theme === "system" ? '<i class="auto-dot" aria-hidden="true"></i>' : "");
    const label = bg.kind === "plain" ? `Theme: ${state.theme} (${bg.name} always draws dark)` : state.theme === "system" ? `Theme: system (${drawn})` : `Theme: ${state.theme}`;
    b.setAttribute("aria-label", label + ". Change theme");
    b.title = label;
  }
  const seg = document.getElementById("theme-seg");
  if (seg) seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === state.theme)));
  document.querySelectorAll<HTMLElement>("#bg-picker .sw").forEach((x) => {
    const on = x.dataset.bg === bg.id;
    x.classList.toggle("on", on);
    x.setAttribute("aria-checked", String(on));
    const i = x.querySelector("i");
    if (i) (i as HTMLElement).style.background = stillGradient(backgroundOf(x.dataset.bg), drawn === "dark");
  });
  liquid?.refresh();
}
darkQuery?.addEventListener?.("change", applyTheme);
motionQuery?.addEventListener?.("change", () => liquid?.refresh());

/** Saves look settings to the account: drawn at once, sent, and put back
 * as they were (with the server's words) if the server refuses. */
async function saveLook(patch: SiteSettingsPatch): Promise<void> {
  const before = { theme: state.theme, background: state.background };
  if (patch.theme) state.theme = patch.theme;
  if (patch.background) state.background = patch.background;
  applyTheme();
  if (!state.session) return;
  try {
    state.settings = await api.updateAccountSettings(state.session.token, patch);
    state.theme = state.settings.theme;
    state.background = state.settings.background;
  } catch (err) {
    state.theme = before.theme;
    state.background = before.background;
    fail(err);
  }
  applyTheme();
}

// ---- toasts and dialogs -----------------------------------------------------
let toastTimer = 0;
function toast(text: string, tone: "info" | "error" = "info"): void {
  const t = $("#toast");
  t.textContent = text;
  t.className = `toast on ${tone}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.className = "toast"), tone === "error" ? 5200 : 2600);
}
function fail(err: unknown): void {
  if (err instanceof SiteApiError) {
    if (err.signedOut && state.session) {
      signedOut("You've been signed out. Sign in again.");
      return;
    }
    toast(errorText(err.status, err.message), "error");
  } else toast("Something went wrong. Try again.", "error");
}

/** A centred confirmation (2026-10-05 B: "Confirmations open as centred
 * dialogs"). Resolves true on the confirm button. */
function confirmDialog(title: string, body: string, confirm: string): Promise<boolean> {
  return new Promise((resolve) => {
    const d = $("#dialog");
    d.innerHTML = `<div class="dlg glass" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h2 id="dlg-t">${esc(title)}</h2><p>${esc(body)}</p><div class="row end"><button class="btn" data-a="no">Cancel</button><button class="btn pri" data-a="yes">${esc(confirm)}</button></div></div>`;
    d.className = "dim on";
    const done = (v: boolean) => {
      d.className = "dim";
      d.innerHTML = "";
      document.removeEventListener("keydown", onKey, true);
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        done(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    d.onclick = (e) => {
      const a = (e.target as HTMLElement).closest("[data-a]") as HTMLElement | null;
      if (a) done(a.dataset.a === "yes");
      else if (e.target === d) done(false);
    };
    (d.querySelector('[data-a="yes"]') as HTMLElement).focus();
  });
}

// ---- sign-in ----------------------------------------------------------------
function showSignIn(message = ""): void {
  $("#shell").hidden = true;
  $("#signin").hidden = false;
  liquid?.refresh();
  const m = $("#si-msg");
  m.textContent = message;
  m.hidden = !message;
  ($("#si-login") as HTMLInputElement).focus();
}
function signedOut(message: string): void {
  state.session = null;
  state.play = null;
  state.me = null;
  state.settings = null;
  state.wallet = null;
  state.board = null;
  state.boardError = null;
  state.draft = null;
  state.home = { packs: null, collection: null, daily: null, store: null, live: null, history: null, errors: {} };
  state.hist = { rows: [], total: 0, more: false, error: null, loading: false };
  closeReplay();
  clearTimeout(livePoll);
  state.shop = { packs: null, store: null, recent: null, error: null, loadouts: {}, owned: null };
  closeOpening();
  closeDress();
  saveSession(null);
  clearTimeout(state.poll);
  showSignIn(message);
}
async function onSignIn(e: Event): Promise<void> {
  e.preventDefault();
  const login = ($("#si-login") as HTMLInputElement).value.trim();
  const password = ($("#si-pass") as HTMLInputElement).value;
  const btn = $("#si-go") as HTMLButtonElement;
  const m = $("#si-msg");
  if (!login || !password) {
    m.textContent = "Enter your login and password.";
    m.hidden = false;
    return;
  }
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    const s = await api.signIn(login, password);
    state.session = { token: s.token, login, expiresAt: s.expiresAt };
    saveSession(state.session);
    ($("#si-pass") as HTMLInputElement).value = "";
    await enter();
  } catch (err) {
    m.textContent = err instanceof SiteApiError ? errorText(err.status, err.message) : "Something went wrong. Try again.";
    m.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
}
async function signOut(): Promise<void> {
  const s = state.session;
  if (!s) return;
  if (!(await confirmDialog("Sign out?", "You'll need your login and password to come back.", "Sign out"))) return;
  try {
    await api.signOut(s.token);
  } catch {
    /* already gone on the server: sign out here anyway */
  }
  signedOut("Signed out.");
}

/** Signed in: load the play settings, who the owner is, their account
 * settings and wallet, then draw the shell. Only the play settings are
 * needed to go in; if one of the others fails (other than a sign-out) the
 * page goes in without it and says so where it would show. */
async function enter(): Promise<void> {
  if (!state.session) return showSignIn();
  const token = state.session.token;
  const soft = <T,>(p: Promise<T>) => p.catch((err: unknown) => {
    if (err instanceof SiteApiError && err.signedOut) throw err;
    return null;
  });
  try {
    const boardRead = api.board(token).catch((err: unknown) => {
      if (err instanceof SiteApiError && err.signedOut) throw err;
      state.boardError = err instanceof SiteApiError ? errorText(err.status, err.message) : "Something went wrong.";
      return null;
    });
    const [play, me, settings, wallet, board] = await Promise.all([api.play(token), soft(api.me(token)), soft(api.accountSettings(token)), soft(api.wallet(token)), boardRead]);
    state.play = play;
    state.me = me;
    state.settings = settings;
    state.wallet = wallet;
    state.board = board;
    if (board) state.boardError = null;
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    showSignIn(err instanceof SiteApiError ? errorText(err.status, err.message) : "Something went wrong.");
    return;
  }
  if (state.settings) {
    state.theme = state.settings.theme;
    state.background = state.settings.background;
  }
  $("#signin").hidden = true;
  $("#shell").hidden = false;
  drawShell();
  route();
  schedulePoll();
  void loadHome();
}

/** Reads what the widgets on the board show (only what they need), then
 * redraws Home. `only` limits it to some reads (after a purchase, the poll). */
async function loadHome(only?: WidgetSource[]): Promise<void> {
  if (!state.session) return;
  const widgets = state.draft ?? state.board?.widgets ?? [];
  const need = sourcesFor(widgets).filter((x) => !only || only.includes(x));
  if (!need.length) return;
  const token = state.session.token;
  const reads: Record<WidgetSource, () => Promise<unknown>> = {
    packs: () => api.packs(token),
    collection: () => api.collection(token, 3),
    daily: () => api.daily(token),
    store: () => api.store(token),
    live: () => api.live(token),
    history: () => api.matches(token, 20),
  };
  let signedOutNow = false;
  await Promise.all(
    need.map(async (src) => {
      try {
        const v = await reads[src]();
        (state.home as Record<string, unknown>)[src] = v;
        delete state.home.errors[src];
      } catch (err) {
        if (err instanceof SiteApiError && err.signedOut) signedOutNow = true;
        else state.home.errors[src] = err instanceof SiteApiError ? errorText(err.status, err.message) : "something went wrong";
      }
    }),
  );
  if (signedOutNow) return signedOut("Your session ended. Sign in again.");
  if (state.page === "home" && !dragging) drawPage();
  // The live widgets keep following the matches (session 50).
  if (need.includes("live") && state.page === "home") {
    clearTimeout(livePoll);
    livePoll = window.setTimeout(() => void loadLive(), 3000);
  }
}

/** Keeps the agent's status current (a match starting or ending, a rebuild
 * finishing): every 15 s while the tab is visible, every 1.5 s while a
 * rebuild runs. */
function schedulePoll(): void {
  clearTimeout(state.poll);
  if (!state.session) return;
  const running = state.play?.rebuild.job?.state === "running";
  state.poll = window.setTimeout(refresh, running ? 1500 : 15000);
}
async function refresh(): Promise<void> {
  if (!state.session || document.hidden) return schedulePoll();
  try {
    const was = state.play?.rebuild.job;
    const token = state.session.token;
    const [play, wallet] = await Promise.all([api.play(token), api.wallet(token).catch((err: unknown) => {
      if (err instanceof SiteApiError && err.signedOut) throw err;
      return state.wallet;
    })]);
    state.play = play;
    state.wallet = wallet;
    drawWallet();
    const now = state.play.rebuild.job;
    if (was?.state === "running" && now && now.jobId === was.jobId && now.state !== "running") {
      toast(now.state === "done" ? "Your agent finished building its deck." : `The rebuild failed: ${now.error ?? "no reason given"}`, now.state === "done" ? "info" : "error");
    }
    drawAgentCard();
    if (!state.busy && !dragging) drawPage();
    if (state.page === "home") void loadHome(["daily", "packs"]);
    if (state.page === "store" && !state.opening) void loadShop();
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
  }
  schedulePoll();
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.session && state.play) void refresh();
});

// ---- the shell --------------------------------------------------------------
function navButton(n: NavItem): string {
  const soon = n.soon ? '<span class="nbadge soon">Soon</span>' : "";
  return `<a class="navb${n.soon ? " is-soon" : ""}" href="${hashOf(n.id)}" data-page="${n.id}"${n.soon ? ' aria-disabled="true" title="Comes after Season 0"' : ""}>${icon(n.icon)}<span>${esc(n.label)}</span>${soon}</a>`;
}
function drawShell(): void {
  $("#nav").innerHTML = NAV_MAIN.map(navButton).join("") + '<hr class="nav-rule">' + NAV_LOWER.map(navButton).join("");
  const s = state.session!;
  // Who am I: the display name; until it answers, the login typed at sign-in.
  const name = state.me?.name ?? s.login;
  const acct = $("#acct-btn");
  acct.textContent = initialOf(name);
  acct.setAttribute("aria-label", `Account: ${name}`);
  $("#acct-name").textContent = name;
  $("#acct-kind").textContent = state.me ? `${state.me.username ? `@${state.me.username} · ` : ""}${state.me.isAdmin ? "House admin" : "Owner account"}` : "Owner account";
  drawWallet();
  drawAgentCard();
  applyTheme();
}

/** The top bar's credits, pack points and Open button (the wallet). Open
 * opens the oldest waiting pack, full screen (session 47). */
function drawWallet(): void {
  const el = $("#wallet");
  const w = state.wallet;
  if (!w) {
    el.innerHTML = "";
    return;
  }
  const open = openButton(w.unopenedPacks.length);
  // A redraw (the poll, a purchase, an opening) keeps focus on the Open
  // button if it had it.
  const hadFocus = document.activeElement?.id === "open-btn";
  el.innerHTML = `<span class="cur" title="Credits"><i class="coin" aria-hidden="true"></i><b>${amount(w.credits)}</b><span class="vh"> credits</span></span>`
    + `<span class="cur" title="Pack points"><i class="pp" aria-hidden="true"></i><b>${amount(w.packPoints)}</b><span class="vh"> pack points</span></span>`
    + `<button type="button" class="obtn${open.enabled ? "" : " none"}" id="open-btn" data-act="open-packs" data-count="1"${open.enabled ? "" : " disabled"} aria-label="${esc(open.label)}" title="${esc(open.label)}">${icon("store", 16)}<span>Open</span>${open.enabled ? `<b class="ocount">${open.count}</b>` : ""}</button>`;
  if (hadFocus) (document.getElementById("open-btn") as HTMLElement | null)?.focus();
}

function avatar(name: string, faction: string | null, size: number): string {
  const c = (faction && FACTION_HEX[faction]) || "#8f8cff";
  return `<span class="av" style="--c:${c};width:${size}px;height:${size}px">${avatarSvg(name)}</span>`;
}
function agentFaction(play: SitePlay): SiteFaction | null {
  return play.factionLock ?? play.rebuild.job?.result?.faction ?? null;
}

function drawAgentCard(): void {
  const p = state.play;
  const card = $("#agent-card");
  if (!p) return;
  const a = p.connectedAgent;
  if (!a) {
    card.innerHTML = `<div class="ac-none">No agent connected</div><a class="btn sm" href="#/connect">Connect agent</a>`;
    return;
  }
  const st = agentStatus(p);
  card.innerHTML = `<div class="ac-top">${avatar(a.name, agentFaction(p), 36)}<div class="ac-name"><b>${esc(a.name)}</b><small>${esc(styleName(p, a.playStyle))}</small></div></div><span class="status ${st.tone}"><i></i>${esc(st.label)}</span>`;
}

function route(): void {
  const page = pageFromHash(location.hash);
  // The Tournament is "Soon": its link doesn't open a page.
  if (NAV_MAIN.find((n) => n.id === page)?.soon) {
    toast("Tournaments come after Season 0.");
    history.replaceState(null, "", hashOf(state.page));
    return;
  }
  // Leaving Home while customising keeps the changes: it saves, as Done does.
  if (page !== "home" && state.draft) void finishCustomise();
  state.page = page;
  document.querySelectorAll<HTMLElement>("#nav .navb").forEach((b) => {
    const on = b.dataset.page === page;
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $("#title").textContent = PAGE_TITLES[page];
  document.title = `${PAGE_TITLES[page]} · AI·TCG`;
  drawPage();
  ($("#page") as HTMLElement).scrollTop = 0;
  if (page === "store") void loadShop();
  if (page === "match") void loadHistory(true);
  if (page === "match" || page === "live") void loadLive();
  if (page === "collection") void loadCollection();
  else closeViewer(false);
}
window.addEventListener("hashchange", () => {
  if (state.session && state.play) route();
});

// ---- pages ------------------------------------------------------------------
function drawPage(): void {
  const p = state.play;
  if (!p) return;
  const el = $("#page");
  const page = state.page;
  // A redraw (the 15 s poll, an answer) keeps focus on the same control
  // (session 50: the history's Replay buttons are redrawn while a replay
  // is open, and Close gives focus back to the row's).
  const keep = focusKey(el);
  if (page === "home") el.innerHTML = homePage(p);
  else if (page === "settings") el.innerHTML = settingsPage(p);
  else if (page === "connect") el.innerHTML = connectPage(p);
  else if (page === "store") el.innerHTML = storePage();
  else if (page === "collection") el.innerHTML = collectionPage();
  else if (page === "match") el.innerHTML = matchPage(p);
  else if (page === "live") el.innerHTML = livePage();
  else el.innerHTML = waitsPage(page);
  applyTheme();
  if (keep) el.querySelector<HTMLElement>(keep)?.focus();
}

/** A selector for the focused control inside `root` (its id, or its action
 * and the match or item it acts on), to find its redrawn twin; null when
 * focus is elsewhere. */
function focusKey(root: HTMLElement): string | null {
  const a = document.activeElement as HTMLElement | null;
  if (!a || !root.contains(a) || a === root) return null;
  if (a.id) return `#${CSS.escape(a.id)}`;
  const act = a.dataset.act;
  if (!act) return null;
  const extra = ["match", "item", "agent", "pack", "set", "count", "v"].map((k) => (a.dataset[k] !== undefined ? `[data-${k}="${CSS.escape(a.dataset[k]!)}"]` : "")).join("");
  return `[data-act="${CSS.escape(act)}"]${extra}`;
}

// ---- Home: the widget board ------------------------------------------------
function homePage(p: SitePlay): string {
  const editing = state.draft !== null;
  const widgets = state.draft ?? state.board?.widgets ?? [];
  const bar = `<div class="boardbar"><h2>Your board</h2><span class="sp"></span>${
    !state.board
      ? ""
      : editing
        ? `<button type="button" class="btn" data-act="add">${icon("plus", 15)}Add widget</button><button type="button" class="btn" data-act="background">Background</button><button type="button" class="btn" data-act="recommended">Recommended layout</button><button type="button" class="btn pri" data-act="done"${state.saving ? " disabled" : ""}>${state.saving ? "Saving…" : "Done"}</button>`
        : `<button type="button" class="btn" data-act="add">${icon("plus", 15)}Add widget</button><button type="button" class="btn" data-act="customise">Customise</button>`
  }</div>${editing ? '<p class="hint2">Drag a widget to move it, or click it and use the arrow keys. Pick S, M or L to resize; "−" or Delete removes it. Done saves your board.</p>' : ""}`;
  if (!state.board) {
    return `<div class="pg-wide">${bar}<div class="wempty glass"><h3>${state.boardError ? "Your board couldn't be read" : "Loading your board…"}</h3>${state.boardError ? `<p class="muted">${esc(state.boardError)}</p><button type="button" class="btn pri" data-act="retry-board">Try again</button>` : ""}</div></div>`;
  }
  if (!widgets.length) {
    return `<div class="pg-wide">${bar}<div class="wempty glass"><h3>Your board is empty</h3><p class="muted">Add the widgets you want, or start from the recommended layout.</p><div class="row center"><button type="button" class="btn pri" data-act="add">${icon("plus", 15)}Add widget</button><button type="button" class="btn" data-act="use-recommended">Use recommended layout</button></div></div></div>`;
  }
  const data: WidgetData = { play: p, wallet: state.wallet, ...state.home, ownerId: state.me?.ownerId ?? null, viewOf, now: Date.now(), colFilter: state.colFilter };
  const { views, capped } = liveViews(widgets);
  const tiles = widgets.map((w) => widgetHtml(w, data, { editing, live: views.get(w.id), capped: capped.has(w.id) })).join("");
  const addTile = editing && !addBlockAll(widgets) ? `<button type="button" class="addtile" data-act="add">${icon("plus", 18)}<span>Add widget</span></button>` : "";
  const note = !editing && state.board.recommended ? `<p class="muted small board-note">This is the recommended layout. Customise it and it's saved to your account.</p>` : "";
  return `<div class="pg-wide">${bar}<div class="wgrid${editing ? " editing" : ""}" id="wgrid">${tiles}${addTile}</div>${note}</div>`;
}

/** True when no widget at all can be added (the board is full). */
function addBlockAll(widgets: SiteWidget[]): boolean {
  const rules = state.board!.rules;
  return rules.widgetTypes.every((t) => addBlock(widgets, t.type, rules) !== null);
}

function startCustomise(): void {
  if (!state.board) return;
  state.draft = state.board.widgets.map((w) => ({ ...w }));
  drawPage();
}

/** Done: saves the board if it changed. A refusal keeps Customise mode open
 * with the server's words, so nothing is lost. */
async function finishCustomise(): Promise<void> {
  if (!state.draft || !state.board || state.saving) return;
  const draft = state.draft;
  if (sameBoard(draft, state.board.widgets)) {
    state.draft = null;
    if (state.page === "home") drawPage();
    return;
  }
  const ok = await saveBoard(draft);
  if (ok) state.draft = null;
  if (state.page === "home") drawPage();
}

/** Saves a board (the whole list) to the account. */
async function saveBoard(widgets: SiteWidget[], message = "Board saved."): Promise<boolean> {
  if (!state.session) return false;
  state.saving = true;
  if (state.page === "home") drawPage();
  try {
    state.board = await api.saveBoard(state.session.token, widgets);
    toast(message);
    return true;
  } catch (err) {
    fail(err);
    return false;
  } finally {
    state.saving = false;
  }
}

/** Changes the board: in Customise mode the working copy (saved on Done);
 * otherwise (+ Add widget, the empty board's buttons) saved at once. */
async function changeBoard(next: SiteWidget[], message?: string): Promise<void> {
  if (state.draft) {
    state.draft = next;
    drawPage();
    if (message) toast(message);
    void loadHome();
    return;
  }
  if (await saveBoard(next, message)) void loadHome();
  drawPage();
}

/** The widget gallery: every Season 0 widget, the ones that can't be added
 * greyed with the reason (the server's limits). Widgets start at Medium. */
function addWidgetDialog(): void {
  if (!state.board) return;
  const widgets = state.draft ?? state.board.widgets;
  const rules = state.board.rules;
  const items = rules.widgetTypes
    .map(({ type }) => {
      const info = WIDGET_INFO[type];
      const block = addBlock(widgets, type, rules);
      return `<button type="button" class="wli" data-add="${type}"${block ? " disabled" : ""}><span class="wic big2" style="--g:${info.grad}">${icon(info.icon, 18)}</span><span><b>${esc(info.name)}</b><small>${esc(block ?? info.desc)}</small></span></button>`;
    })
    .join("");
  sheet(`<h2 id="dlg-t">Add a widget</h2><p>Widgets start at medium size. Resize them in Customise.</p><div class="wlib">${items}</div><div class="row end"><button type="button" class="btn" data-a="close">Close</button></div>`, (el) => {
    const t = el.closest("[data-add]") as HTMLButtonElement | null;
    if (!t || t.disabled) return false;
    const type = t.dataset.add as WidgetType;
    const now = state.draft ?? state.board!.widgets;
    void changeBoard(addWidget(now, type, state.board!.rules), `${WIDGET_INFO[type].name} added.`).then(() => {
      // The new widget is the last one: bring it into view.
      const last = document.querySelector<HTMLElement>("#wgrid .wg:last-of-type");
      last?.scrollIntoView({ block: "nearest" });
    });
    return true;
  });
}

/** Customise -> Background: the same picker as Settings -> Display. */
function backgroundDialog(): void {
  sheet(`<h2 id="dlg-t">Background</h2><p>A liquid colour or a plain background. Saved to your account.</p>${bgPicker()}<p class="muted small">Plain backgrounds always use dark mode.</p><div class="row end"><button type="button" class="btn pri" data-a="close">Done</button></div>`, () => false, "wide");
}

async function recommendedDialog(): Promise<void> {
  if (!state.board) return;
  if (!(await confirmDialog("Use the recommended layout?", "This replaces your board with the recommended widgets and sizes. You can customise it again afterwards.", "Use recommended"))) return;
  void changeBoard(recommendedWidgets(state.board.rules), "Recommended layout applied.");
}

/** A centred dialog with any content (the gallery, the background). `onPick`
 * answers true to close it. Escape, the dim and data-a="close" close it. */
function sheet(html: string, onPick: (el: HTMLElement) => boolean, size: "" | "wide" = ""): void {
  const d = $("#dialog");
  const opener = document.activeElement as HTMLElement | null;
  d.innerHTML = `<div class="dlg glass${size ? ` ${size}` : ""}" role="dialog" aria-modal="true" aria-labelledby="dlg-t">${html}</div>`;
  d.className = "dim on";
  const close = () => {
    d.className = "dim";
    d.innerHTML = "";
    d.onclick = null;
    document.removeEventListener("keydown", onKey, true);
    opener?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  d.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (e.target === d || t.closest('[data-a="close"]')) return close();
    // The background picker inside a dialog is handled by the page's own click handler.
    if (onPick(t)) close();
  };
  (d.querySelector("button:not([disabled])") as HTMLElement | null)?.focus();
}

async function buyPacks(setCode: string, count: number): Promise<void> {
  const price = (state.shop.packs ?? state.home.packs)?.offer.find((o) => o.setCode === setCode)?.priceCredits;
  if (!state.session || price === undefined) return;
  const total = price * count;
  if (!(await confirmDialog(count === 1 ? "Buy a pack?" : `Buy ${count} packs?`, `${count === 1 ? "One pack" : `${count} packs`} for ${amount(total)} credits. You have ${amount(state.wallet?.credits ?? 0)}.`, `Buy · ${amount(total)}`))) return;
  try {
    const r = await api.buyPacks(state.session.token, setCode, count);
    state.wallet = r.wallet;
    drawWallet();
    toast(count === 1 ? "Pack bought. It's waiting to be opened." : `${count} packs bought. They're waiting to be opened.`);
  } catch (err) {
    fail(err);
  }
  await afterChange();
}

async function buyCosmetic(itemId: string, name: string, price: number): Promise<void> {
  if (!state.session) return;
  if (!(await confirmDialog(`Buy ${name}?`, `${amount(price)} credits. You have ${amount(state.wallet?.credits ?? 0)}.`, `Buy · ${amount(price)}`))) return;
  try {
    const r = await api.buyCosmetic(state.session.token, itemId);
    state.wallet = r.wallet;
    drawWallet();
    toast(`${name} is yours. Equip it in the loadout.`);
  } catch (err) {
    fail(err);
  }
  await afterChange();
}

// Drag to move (Customise mode): HTML5 drag and drop on the tiles; the drop
// lands before or after the tile under the pointer, by which half it's in.
let dragging: string | null = null;
document.addEventListener("dragstart", (e) => {
  const tile = (e.target as HTMLElement).closest?.("#wgrid.editing .wg") as HTMLElement | null;
  if (!tile || !state.draft) return;
  dragging = tile.dataset.id ?? null;
  tile.classList.add("dragging");
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", dragging ?? "");
    } catch {
      /* some browsers refuse; the id is kept here anyway */
    }
  }
});
document.addEventListener("dragover", (e) => {
  if (!dragging) return;
  const tile = (e.target as HTMLElement).closest?.("#wgrid .wg") as HTMLElement | null;
  e.preventDefault();
  document.querySelectorAll(".dropb").forEach((x) => x.classList.remove("dropb"));
  if (tile && tile.dataset.id !== dragging) tile.classList.add("dropb");
});
document.addEventListener("drop", (e) => {
  if (!dragging || !state.draft) return;
  e.preventDefault();
  const tile = (e.target as HTMLElement).closest?.("#wgrid .wg") as HTMLElement | null;
  const from = dragging;
  dragging = null;
  if (tile && tile.dataset.id && tile.dataset.id !== from) {
    const r = tile.getBoundingClientRect();
    state.draft = moveWidget(state.draft, from, tile.dataset.id, e.clientX - r.left > r.width / 2);
  } else if ((e.target as HTMLElement).closest?.(".addtile")) {
    // Dropped on the "+ Add widget" tile: to the end.
    const w = state.draft.find((x) => x.id === from)!;
    state.draft = [...state.draft.filter((x) => x.id !== from), w];
  }
  drawPage();
});
document.addEventListener("dragend", () => {
  dragging = null;
  document.querySelectorAll(".dragging,.dropb").forEach((x) => x.classList.remove("dragging", "dropb"));
});

function seg(id: string, options: [string, string][], value: string, label: string): string {
  return `<div class="seg" id="${id}" role="group" aria-label="${esc(label)}">${options.map(([v, t]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === value}">${esc(t)}</button>`).join("")}</div>`;
}

function settingsPage(p: SitePlay): string {
  const rv = rebuildView(p);
  const job = p.rebuild.job ? jobSummary(p.rebuild.job) : [];
  const lockOpts: [string, string][] = [["", "Any"], ...p.lockableFactions.map((f) => [f, f] as [string, string])];
  const decks = p.decks.length
    ? p.decks
        .map((d) => {
          const isActive = p.activeDeck?.deckId === d.deckId;
          const agentsOwn = p.agentDeck?.deckId === d.deckId;
          const miss = d.complete ? "" : `<small class="warn-t">Incomplete: ${d.missing.map((m) => `${esc(m.cardId)} ${m.owned}/${m.uses}`).join(", ")}</small>`;
          return `<button type="button" class="deckrow${isActive ? " on" : ""}" data-deck="${esc(d.deckId)}" ${d.complete ? "" : 'aria-disabled="true"'}><span class="radio" aria-hidden="true"></span><span class="dn"><b>${esc(d.name)}</b><small>${d.cards} cards${agentsOwn ? " · built by your agent" : ""}</small>${miss}</span>${isActive ? '<span class="pill on">Playing</span>' : ""}</button>`;
        })
        .join("")
    : '<p class="muted">No saved decks yet.</p>';
  const agents = p.agents
    .map((a) => {
      const connected = p.connectedAgent?.agentId === a.agentId;
      return `<div class="agrow">${avatar(a.name, connected ? agentFaction(p) : null, 32)}<div class="dn"><b>${esc(a.name)}</b><small>${connected ? "Connected" : "Not connected"}</small></div><label class="sel"><span class="vh">Play style for ${esc(a.name)}</span><select data-style-for="${esc(a.agentId)}">${p.playStyles.map((s) => `<option value="${esc(s.id)}"${s.id === a.playStyle ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label></div>`;
    })
    .join("");
  const styleHelp = p.playStyles.map((s) => `<li><b>${esc(s.name)}</b> ${esc(s.summary)}</li>`).join("");
  const running = rv.kind === "running";
  const rebuild = `<div class="rb-note ${rv.kind}" role="status">${running ? '<span class="spin" aria-hidden="true"></span>' : ""}${esc(rv.text)}${
    rv.kind === "wanted" ? `<ul>${rv.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""
  }</div>${job.length ? `<div class="job"><b>Last build</b><ul>${job.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>` : ""}<button type="button" class="btn pri" id="rebuild"${running || p.deckChoice === "forced" ? " disabled" : ""}>${running ? "Building…" : "Rebuild now"}</button>`;
  return `<div class="pg">
  ${p.liveMatch ? '<div class="banner live"><span class="status live"><i></i>In a match</span> Your agent is playing. Some changes wait until the match ends.</div>' : ""}
  <h3>Play</h3>
  <section class="panel glass">
    <div class="field"><div><b>Who picks the deck</b><small>Your agent builds and picks its own deck, or you choose one of your saved decks.</small></div>${seg("deck-choice", [["agent", "Agent picks"], ["forced", "I choose"]], p.deckChoice, "Who picks the deck")}</div>
    <div class="field"><div><b>Faction lock</b><small>Keep your agent to one faction, or let it play any.</small></div>${seg("faction-lock", lockOpts, p.factionLock ?? "", "Faction lock")}</div>
    <div class="field col"><div><b>Deck now</b><small>${esc(deckLine(p))}</small></div></div>
  </section>
  <h3>Saved decks</h3>
  <section class="panel glass decks"><p class="muted small">Pick one to play it yourself (the choice becomes "I choose").</p>${decks}</section>
  <h3>Your agent's deck</h3>
  <section class="panel glass">${rebuild}</section>
  <h3>Play style</h3>
  <section class="panel glass">${agents || '<p class="muted">No agents yet.</p>'}<details class="styles"><summary>What the play styles mean</summary><ul>${styleHelp}</ul></details></section>
  <h3>Display</h3>
  <section class="panel glass">
    <div class="field"><div><b>Theme</b><small>System follows your computer's setting.</small></div>${seg("theme-seg", [["system", "System"], ["light", "Light"], ["dark", "Dark"]], state.theme, "Theme")}</div>
    <div class="field col"><div><b>Background</b><small>A liquid colour or a plain background. ${state.settings ? "Saved to your account, so it follows you to any browser." : "Couldn't read your account's settings: changes show here but may not be saved."}</small></div>${bgPicker()}<small class="muted">Plain backgrounds always use dark mode. Liquid backgrounds follow your theme.</small></div>
  </section>
  ${state.me?.isAdmin ? `<h3>Admin</h3>${waitsBox(["the house agents' admin endpoints"], "The admin view: the house agents, their decks and their matches. You see this because your account is the house admin.")}` : ""}
  </div>`;
}

/** The background picker: one swatch per background, in the account
 * settings' order; a radio group (arrow keys move it, as a radio does). */
function bgPicker(): string {
  const dark = document.body.dataset.theme === "dark";
  const cur = backgroundOf(state.background).id;
  return `<div class="bgsw" id="bg-picker" role="radiogroup" aria-label="Background">${BACKGROUND_IDS.map((id) => {
    const b = backgroundOf(id);
    const on = id === cur;
    return `<button type="button" class="sw${on ? " on" : ""}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-bg="${id}"><i style="background:${stillGradient(b, b.kind === "plain" || dark)}"></i><span>${esc(b.name)}</span></button>`;
  }).join("")}</div>`;
}

function connectPage(p: SitePlay): string {
  const rows = p.agents
    .map((a) => {
      const on = p.connectedAgent?.agentId === a.agentId;
      return `<div class="agrow">${avatar(a.name, on ? agentFaction(p) : null, 40)}<div class="dn"><b>${esc(a.name)}</b><small>${esc(styleName(p, a.playStyle))} play style</small></div>${on ? '<span class="pill on">Connected</span>' : '<span class="pill">Not connected</span>'}</div>`;
    })
    .join("");
  return `<div class="pg"><h3>Your agents</h3><section class="panel glass">${rows || '<p class="muted">No agents yet.</p>'}</section>
  ${waitsBox(["connecting and switching agents", "generating a new agent"], "Switching which agent plays, and generating a new one with its signature card, open here once the server serves them. One agent plays at a time.")}</div>`;
}

function waitsBox(needs: string[], will: string): string {
  return `<section class="panel glass waits"><b>Coming to this page</b><p>${esc(will)}</p><p class="muted small">Waiting on the server for: ${needs.map(esc).join(", ")}.</p></section>`;
}
function waitsPage(page: PageId): string {
  const w = PAGE_WAITS[page];
  if (!w) return "";
  const n = [...NAV_MAIN, ...NAV_LOWER].find((x) => x.id === page)!;
  return `<div class="pg"><div class="waits-hero glass"><span class="wic big" style="--g:linear-gradient(135deg,#6a7bff,#9a5cff)">${icon(n.icon, 26)}</span><h2>${esc(PAGE_TITLES[page])}</h2><p>${esc(w.will)}</p><p class="muted small">${esc(waitsLine(w.needs))}</p><a class="btn" href="#/">Back to Home</a></div></div>`;
}

async function retryBoard(): Promise<void> {
  if (!state.session) return;
  try {
    state.board = await api.board(state.session.token);
    state.boardError = null;
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    state.boardError = err instanceof SiteApiError ? errorText(err.status, err.message) : "Something went wrong.";
  }
  drawPage();
  void loadHome();
}

// ---- the Store page (session 47) ---------------------------------------------
/** Reads what the Store page shows: the packs (with the free daily pack),
 * what's on sale, and the last few openings. */
async function loadShop(): Promise<void> {
  if (!state.session) return;
  const token = state.session.token;
  try {
    const play = state.play ?? (state.play = await api.play(token));
    const [packs, store, recent, owned, ...loadouts] = await Promise.all([
      api.packs(token),
      api.store(token),
      api.collection(token, 6),
      api.cosmetics(token),
      ...play.agents.map((a) => api.loadout(token, a.agentId)),
    ]);
    state.shop = { packs, store, recent, error: null, owned: owned.owned, loadouts: Object.fromEntries(loadouts.map((l) => [l.agentId, l])) };
    state.wallet = packs.wallet;
    drawWallet();
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    state.shop = { ...state.shop, error: err instanceof SiteApiError ? errorText(err.status, err.message) : "Something went wrong." };
  }
  if (state.page === "store" && !state.busy) drawPage();
}

/** After anything that changes packs or credits: the wallet, Home's
 * widgets and the Store page read again. */
async function afterChange(): Promise<void> {
  const reads: Promise<unknown>[] = [loadHome(["packs", "store", "collection"])];
  // The Store's reads too, once it has been read: so coming back to it
  // never shows packs that were opened elsewhere (Home's Open, the top bar).
  if (state.page === "store" || state.shop.packs) reads.push(loadShop());
  // And the Collection's, once read (an opening adds cards to it).
  if (state.page === "collection" || state.col.binder) reads.push(loadCollection());
  else if (state.session)
    reads.push(
      api.wallet(state.session.token).then(
        (w) => {
          state.wallet = w;
          drawWallet();
        },
        () => undefined,
      ),
    );
  await Promise.all(reads);
}

function storePage(): string {
  const sh = state.shop;
  if (!sh.packs || !sh.store) {
    return `<div class="pg-wide"><div class="wempty glass"><h3>${sh.error ? "The Store couldn't be read" : "Loading the Store…"}</h3>${sh.error ? `<p class="muted">${esc(sh.error)}</p><button type="button" class="btn pri" data-act="retry-shop">Try again</button>` : ""}</div></div>`;
  }
  const credits = state.wallet?.credits ?? sh.packs.wallet.credits;
  const offer = sh.packs.offer[0];
  const now = Date.now();
  // Buying: the set's pack, 1 to 10 at once (all or none).
  let buy = '<p class="muted">No packs on sale right now.</p>';
  if (offer) {
    const b = buyView(offer, state.buyCount, credits);
    state.buyCount = b.count;
    buy = `<div class="st-buy"><div class="stepper" role="group" aria-label="How many packs"><button type="button" class="btn sm" data-act="buy-step" data-d="-1"${b.count <= 1 ? " disabled" : ""} aria-label="One fewer">−</button><output id="buy-n" aria-live="polite">${b.count}</output><button type="button" class="btn sm" data-act="buy-step" data-d="1"${b.count >= BUY_MAX ? " disabled" : ""} aria-label="One more">+</button></div>`
      + `<button type="button" class="btn pri" id="buy-btn" data-act="buy-packs" data-set="${esc(offer.setCode)}" data-count="${b.count}"${b.canAfford ? "" : " disabled"}>Buy ${b.count === 1 ? "1 pack" : `${b.count} packs`} · ${amount(b.total)}</button></div>`
      + `<p class="muted small">${b.canAfford ? `You have ${amount(credits)} credits.` : `${amount(b.short)} credits short: you have ${amount(credits)}.`} Win matches to earn more.</p>`;
  }
  const packsHead = `<section class="panel glass st-packs"><div class="row nowrap top">${packArt(offer?.setCode ?? "S0", "l")}<div class="wcol"><h3>${esc(offer?.name ?? "Packs")}</h3><p class="muted small">5 cards a pack${offer ? ` · ${amount(offer.priceCredits)} credits each` : ""} · every pack also pays 5 pack points</p><p class="muted small">${esc(pityText(sh.packs))}</p>${buy}</div></div></section>`;
  // The free daily pack.
  const dv = dailyPackView(sh.packs.dailyPack, now);
  const daily = `<section class="panel glass st-daily"><h3>Free daily pack</h3><p>${esc(dv.line)}</p><p class="muted small">One a day, only you can claim it, up to ${dv.cap} can wait. The day turns at midnight ${esc(sh.packs.dailyPack.timeZone.split("/").pop() ?? "")} time.</p><button type="button" class="btn pri" id="claim-btn" data-act="claim-daily"${dv.canClaim ? "" : " disabled"}>${esc(dv.button)}</button></section>`;
  // The packs waiting, by where they came from.
  const n = sh.packs.unopened.length;
  const bulk = sh.packs.bulkOpenCount;
  const groups = unopenedGroups(sh.packs.unopened);
  const rows = groups
    .map((g) => `<div class="st-row"><span class="pk-dot" aria-hidden="true"></span><div class="dn"><b>${esc(g.name)}</b><small>${g.count} waiting · ${esc(g.setCode)} · the oldest from ${esc(shortWhen(g.oldestAt))}</small></div><button type="button" class="btn sm" data-act="open-packs" data-pack="${esc(g.oldestPackId)}" aria-label="Open a ${esc(g.name.toLowerCase())}">Open one</button></div>`)
    .join("");
  const waiting = `<section class="panel glass st-open"><h3>Waiting to be opened</h3><p><b class="big-n">${n}</b> pack${n === 1 ? "" : "s"}</p><div class="row"><button type="button" class="btn pri" id="open1-btn" data-act="open-packs" data-count="1"${n ? "" : " disabled"}>Open</button><button type="button" class="btn" id="open10-btn" data-act="open-packs" data-count="${bulk}"${n >= bulk ? "" : " disabled"}>Open ${bulk}</button></div>${n && n < bulk ? `<p class="muted small">Opening ${bulk} at once needs ${bulk} waiting.</p>` : ""}${rows ? `<div class="st-rows">${rows}</div>` : '<p class="muted small">Buy a pack or claim your free daily pack, and it waits here.</p>'}</section>`;
  // Recent openings: when, the best finish, the cards.
  const rec = sh.recent ? recentOpenings(sh.recent, 6) : [];
  const recent = `<section class="panel glass st-recent"><h3>Recent openings</h3>${rec.length ? rec.map((o) => `<div class="st-rec"><div class="dn"><b>${esc(shortWhen(o.openedAt))}</b><small>${esc(o.setCode)}${o.best ? ` · best: ${esc(o.best)}` : ""}${o.jackpot ? " · Jackpot pack" : ""}</small></div><div class="mrow">${o.cards.map((c) => miniCard(c)).join("")}</div></div>`).join("") : '<p class="muted small">No packs opened yet.</p>'}</section>`;
  // Cosmetics on sale.
  const cos = sh.store.cosmetics;
  const items = cos.length
    ? `<div class="shop">${cos.map((c) => `<div class="si"><span class="si-pv" style="--c:${(c.faction && FACTION_HEX[c.faction]) || "#8f8cff"}"></span><b class="small">${esc(c.name)}</b><span class="muted small">${esc(cosmeticKind(c.kind))}${c.faction ? ` · ${esc(c.faction)}` : ""}</span>${c.owned ? '<span class="pill on">Owned</span>' : c.priceCredits === null ? "" : `<button type="button" class="btn sm" data-act="buy-cosmetic" data-item="${esc(c.itemId)}" data-name="${esc(c.name)}" data-price="${c.priceCredits}"${credits >= c.priceCredits ? "" : " disabled"}>Buy · ${amount(c.priceCredits)}</button>`}</div>`).join("")}</div>`
    : '<p class="muted small">No cosmetics on sale right now.</p>';
  const cosmetics = `<section class="panel glass st-cos"><h3>Cosmetics</h3>${items}<p class="muted small">What you buy is yours on every agent: equip it with Change, under Your agents' loadouts.</p></section>`;
  return `<div class="pg-wide"><div class="st-grid">${packsHead}${daily}<div class="st-col">${waiting}${agentsPanel()}</div>${recent}${cosmetics}</div></div>`;
}

/** "Your agents" (session 49): what each agent wears, and Change to open
 * the loadout picker over the website. */
function agentsPanel(): string {
  const play = state.play;
  if (!play) return "";
  const names: Record<string, string> = {};
  for (const o of state.shop.owned ?? []) names[o.itemId] = o.item.name;
  for (const c of state.shop.store?.cosmetics ?? []) names[c.itemId] ??= c.name;
  const rows = agentLoadoutRows(play, state.shop.loadouts, names);
  const locked = !!play.liveMatch;
  const body = rows.length
    ? rows
        .map(
          (r) =>
            `<div class="st-agent">${avatar(r.name, null, 30)}<div class="dn"><b>${esc(r.name)}${r.connected ? ' <span class="pill on">Connected</span>' : ""}</b><small>Victory boast: ${esc(r.boast)}</small><small>Close win: ${esc(r.closeWin)}</small></div><button type="button" class="btn sm" data-act="dress" data-agent="${esc(r.agentId)}" aria-label="Change ${esc(r.name)}'s loadout">Change</button></div>`,
        )
        .join("")
    : '<p class="muted small">No agents yet.</p>';
  return `<section class="panel glass st-agents"><h3>Your agents' loadouts</h3><p class="muted small">Each agent wears its own: its victory boast, its close-win boast (a win on ${CLOSE_WIN_HEALTH} health or less), and later a card back, an avatar and an arena.</p>${locked ? '<p class="small warn-t">A match is live: loadouts can\'t change until it ends.</p>' : ""}<div class="st-rows">${body}</div></section>`;
}

function pityText(p: SitePacks): string {
  const sure = [p.pity.next.fullArt ? "a Full Art or better" : "", p.pity.next.mythic ? "a Mythic" : ""].filter(Boolean);
  if (sure.length) return `Your next pack is sure to hold ${sure.join(" and ")}.`;
  return `${p.pity.packsSinceFullArt} pack${p.pity.packsSinceFullArt === 1 ? "" : "s"} since a Full Art · ${p.pity.packsSinceMythic} since a Mythic`;
}
function cosmeticKind(kind: string): string {
  return kind === "boast" ? "Victory boast" : kind.charAt(0).toUpperCase() + kind.slice(1);
}

async function claimDaily(): Promise<void> {
  if (!state.session) return;
  try {
    const r = await api.claimDailyPack(state.session.token);
    state.wallet = r.wallet;
    drawWallet();
    toast("Free daily pack claimed. It's waiting to be opened.");
  } catch (err) {
    fail(err);
  }
  await afterChange();
}

// ---- the Collection page (session 48) ------------------------------------------
// The wide binder: every collection entry of the set in its numbered place
// (GET /api/collection/binder/:setCode), drawn with the pack page's own card
// face (window.SITE_FACE, siteFaces.ts); the copies behind each from GET
// /api/collection. A slot opens the card viewer: the card, which tilts under
// the pointer, what you hold (finish, origin, Account-bound), the saved
// decks that use it, craft and salvage, each sent to the server and redrawn
// from its answer.
let faceFn: FaceRenderer | null = null;
function face(): FaceRenderer {
  if (!faceFn) faceFn = faceRenderer((window as unknown as { SITE_FACE: FaceFns }).SITE_FACE);
  return faceFn;
}
const siteFace = () => (window as unknown as { SITE_FACE: { packFitText(el: Element): number; packTiltAngles(x: number, y: number, max: number): { rx: number; ry: number } } }).SITE_FACE;

/** Reads the collection, then the binder of its set (the current season's). */
async function loadCollection(): Promise<void> {
  if (!state.session) return;
  const token = state.session.token;
  try {
    const collection = await api.collection(token, 1);
    const setCode = collection.sets[0]?.setCode ?? state.col.binder?.setCode ?? "S0";
    const binder = await api.binder(token, setCode);
    state.col = { ...state.col, binder, collection, error: null };
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    state.col = { ...state.col, error: err instanceof SiteApiError ? errorText(err.status, err.message) : "Something went wrong." };
  }
  if (state.page === "collection" && !state.busy) {
    const y = ($("#page") as HTMLElement).scrollTop;
    drawPage();
    ($("#page") as HTMLElement).scrollTop = y;
    if (state.col.viewer) drawViewer();
  }
}

function collectionPage(): string {
  const c = state.col;
  if (!c.binder || !c.collection) {
    return `<div class="pg-wide"><div class="wempty glass"><h3>${c.error ? "The collection couldn't be read" : "Loading your collection…"}</h3>${c.error ? `<p class="muted">${esc(c.error)}</p><button type="button" class="btn pri" data-act="retry-col">Try again</button>` : ""}</div></div>`;
  }
  return collectionPageHtml(c.binder, c.collection, c.filters, state.wallet?.packPoints ?? 0, face());
}

/** Every slot on the binder (unfiltered), by key. */
function slotByKey(key: string): BinderSlot | null {
  const c = state.col;
  if (!c.binder || !c.collection) return null;
  for (const tab of ["set", "secrets", "prototypes"] as const) {
    for (const b of binderBlocks(c.binder, c.collection, { tab, faction: "All", show: "all" })) {
      const s = b.slots.find((x) => x.key === key);
      if (s) return s;
    }
  }
  return null;
}

let viewerOpener: { el: HTMLElement; key: string } | null = null;
async function openViewer(key: string, from: HTMLElement | null): Promise<void> {
  const s = slotByKey(key);
  if (!s || !state.session) return;
  if (from) viewerOpener = { el: from, key };
  state.col.viewer = { key, holdings: null, holdingsError: null, quantity: 1, busy: false };
  drawViewer();
  await readHoldings(s);
}
async function readHoldings(s: BinderSlot): Promise<void> {
  if (!state.session) return;
  try {
    const h = await api.cardHoldings(state.session.token, s.cardId);
    const v = state.col.viewer;
    if (!v || v.key !== s.key) return;
    v.holdings = h;
    v.holdingsError = null;
    v.quantity = salvageView(h, v.quantity).quantity;
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    const v = state.col.viewer;
    if (v && v.key === s.key) v.holdingsError = err instanceof SiteApiError ? errorText(err.status, err.message) : "something went wrong";
  }
  drawViewer();
}

function drawViewer(): void {
  const el = $("#viewer");
  const v = state.col.viewer;
  const s = v ? slotByKey(v.key) : null;
  const c = state.col;
  if (!v || !s || !c.binder || !c.collection) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  const hadFocus = document.activeElement && el.contains(document.activeElement) ? (document.activeElement as HTMLElement).id || (document.activeElement as HTMLElement).dataset.act || null : null;
  const blocks = binderBlocks(c.binder, c.collection, { ...c.filters, tab: c.filters.tab === "promos" ? "set" : c.filters.tab });
  el.innerHTML = `<div class="cvdlg glass" role="dialog" aria-modal="true" aria-labelledby="dlg-t">${viewerHtml(s, c.binder, c.collection, v, state.wallet?.packPoints ?? 0, neighbours(blocks, s.key), face())}</div>`;
  const wasHidden = el.hidden;
  el.hidden = false;
  const faceEl = el.querySelector(".cv-card .face");
  if (faceEl) siteFace().packFitText(faceEl);
  // Focus: Close on opening; after a redraw, the control that had it (or
  // its twin, when greyed now), else Close.
  const closeBtn = el.querySelector<HTMLElement>('[data-act="close-viewer"]');
  const again = !wasHidden && hadFocus ? el.querySelector<HTMLButtonElement>(`#${CSS.escape(hadFocus)}`) ?? el.querySelector<HTMLButtonElement>(`[data-act="${CSS.escape(hadFocus)}"]:not([disabled])`) : null;
  (again && !again.disabled ? again : closeBtn)?.focus();
}

function closeViewer(giveFocusBack: boolean): void {
  if (!state.col.viewer) return;
  const key = state.col.viewer.key;
  state.col.viewer = null;
  drawViewer();
  if (!giveFocusBack) return;
  // Focus goes back to the slot the viewer was opened from (or the one it ended on).
  const el = document.querySelector(`#page [data-slot="${CSS.escape(key)}"]`) ?? (viewerOpener && document.querySelector(`#page [data-slot="${CSS.escape(viewerOpener.key)}"]`));
  (el as HTMLElement | null)?.focus();
}

async function craftSlot(): Promise<void> {
  const v = state.col.viewer;
  const s = v ? slotByKey(v.key) : null;
  if (!v || !s || !state.session || !state.col.collection) return;
  const cv = craftView(s, { cardCopies: copiesByCard(state.col.collection).get(s.cardId)?.length ?? 0 }, state.wallet?.packPoints ?? 0);
  if (!cv.call || cv.cost === null) return;
  if (!(await confirmDialog(`Craft ${s.name}?`, `${amount(cv.cost)} pack points. You have ${amount(state.wallet?.packPoints ?? 0)}. Crafted copies are account-bound: they play, but never sell or salvage.`, `Craft · ${amount(cv.cost)} pp`))) return;
  v.busy = true;
  drawViewer();
  try {
    const call = cv.call;
    const r = call.kind === "card" ? await api.craftCard(state.session.token, call.cardId) : await api.craftSecret(state.session.token, call.code);
    state.wallet = r.wallet;
    drawWallet();
    toast(`${s.name} crafted. It's in your collection.`);
  } catch (err) {
    fail(err);
  }
  v.busy = false;
  await loadCollection();
  const now = slotByKey(v.key);
  if (now && state.col.viewer === v) await readHoldings(now);
  void loadHome(["collection"]);
}

async function salvageSlot(): Promise<void> {
  const v = state.col.viewer;
  const s = v ? slotByKey(v.key) : null;
  if (!v || !s || !v.holdings || !state.session) return;
  const token = state.session.token;
  const q = salvageView(v.holdings, v.quantity).quantity;
  if (!q) return;
  v.busy = true;
  drawViewer();
  try {
    // The plan first (what it would do), then the owner's confirm; if the
    // server still finds decks it would leave short (409), they're put to
    // the owner and it's sent again confirmed.
    const plan = await api.salvagePlan(token, s.cardId, q);
    let ok = await confirmDialog(`Salvage ${q === 1 ? "a copy" : `${q} copies`}?`, salvageConfirmText(s.name, plan, plan.affectedDecks), `Salvage · +${amount(plan.packPoints)} pp`);
    if (ok) {
      try {
        const r = await api.salvage(token, s.cardId, q, plan.affectedDecks.length > 0);
        state.wallet = r.wallet;
      } catch (err) {
        const decks = salvageNeedsConfirmation(err);
        if (!decks) throw err;
        ok = await confirmDialog("Leave decks short?", salvageConfirmText(s.name, plan, decks), "Salvage anyway");
        if (ok) state.wallet = (await api.salvage(token, s.cardId, q, true)).wallet;
      }
      if (ok) {
        drawWallet();
        toast(`Salvaged ${q === 1 ? "a copy" : `${q} copies`} of ${s.name}: +${amount(plan.packPoints)} pack points.`);
      }
    }
  } catch (err) {
    fail(err);
  }
  v.busy = false;
  v.quantity = 1;
  await loadCollection();
  const now = slotByKey(v.key);
  if (now && state.col.viewer === v) await readHoldings(now);
  void loadHome(["collection"]);
}

// The viewer's card tilts under the pointer (the pack page's own angles);
// still with reduce motion. Arrow keys move to the previous and next card;
// Escape closes (a confirm dialog on top takes Escape first).
document.addEventListener("pointermove", (e) => {
  const card = (e.target as HTMLElement).closest?.("#cv-card") as HTMLElement | null;
  if (!card || motionQuery?.matches) return;
  const r = card.getBoundingClientRect();
  const a = siteFace().packTiltAngles((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 12);
  card.style.transform = `rotateX(${a.rx}deg) rotateY(${a.ry}deg)`;
  card.style.setProperty("--gx", `${Math.round(((e.clientX - r.left) / r.width) * 100)}%`);
  card.style.setProperty("--gy", `${Math.round(((e.clientY - r.top) / r.height) * 100)}%`);
});
document.addEventListener("pointerout", (e) => {
  const card = (e.target as HTMLElement).closest?.("#cv-card") as HTMLElement | null;
  if (card && !card.contains(e.relatedTarget as Node | null)) card.style.transform = "";
});
document.addEventListener("keydown", (e) => {
  if (!state.col.viewer || $("#dialog").classList.contains("on")) return;
  if (e.key === "Escape") {
    e.preventDefault();
    return closeViewer(true);
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const btn = document.getElementById(e.key === "ArrowLeft" ? "cv-prev" : "cv-next") as HTMLButtonElement | null;
    if (btn && !btn.disabled && btn.dataset.slot) {
      e.preventDefault();
      void openViewer(btn.dataset.slot, null);
    }
    return;
  }
  // Focus stays inside the viewer (a modal).
  if (e.key === "Tab") {
    const f = [...document.querySelectorAll<HTMLElement>("#viewer button:not([disabled])")];
    if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && (i <= 0)) {
      e.preventDefault();
      f[f.length - 1]!.focus();
    } else if (!e.shiftKey && i === f.length - 1) {
      e.preventDefault();
      f[0]!.focus();
    }
  }
});

// ---- pack opening, full screen (session 47) ---------------------------------
// The standalone pack-opening page in its site mode (packPage.ts), served by
// the site host at /pack-opening and framed here, same origin. The website
// makes the opening (the server rolls it and the cards are in the collection
// at once), plans the reveal from the answer, and hands the plan to the
// frame's window.PACK. The frame reads the account's sound through
// window.PACK_SITE_HOST and calls its close() when it's done.
interface PackApi {
  S: { onSummary?: (btns: HTMLElement, r: unknown) => void; onBulkSummary?: (btns: HTMLElement, r: unknown) => void; phase: string };
  setPacks(list: { label: string; reveal: unknown }[]): void;
  setBulks(list: { label: string; reveal: unknown }[]): void;
  openPack(i: number): void;
  openBulk(i: number): void;
  close(via: string): void;
}
let frame: HTMLIFrameElement | null = null;
let frameReady: Promise<PackApi> | null = null;
/** What opened the overlay, to give focus back to: the element, and a way
 * to find its redrawn twin (the top bar and the pages redraw meanwhile). */
let openedFrom: { el: HTMLElement; sel: string | null } | null = null;
let soundTimer = 0;
/** An opening's request is out: a second click waits for it. */
let inflight = false;

(window as unknown as { PACK_SITE_HOST: unknown }).PACK_SITE_HOST = {
  sound: {
    read: () => (state.settings ? soundPrefOf(state.settings.sound) : null),
    // The player writes on every click and slider step: saved to the
    // account once it settles.
    write: (v: string) => {
      const sound = soundPatchOf(v);
      if (!sound || !state.session) return;
      if (state.settings) state.settings = { ...state.settings, sound };
      clearTimeout(soundTimer);
      soundTimer = window.setTimeout(() => {
        if (!state.session) return;
        api.updateAccountSettings(state.session.token, { sound }).then(
          (s) => (state.settings = s),
          (err: unknown) => fail(err),
        );
      }, 500);
    },
  },
  close: () => closeOpening(),
};

function packFrame(): Promise<PackApi> {
  if (frameReady) return frameReady;
  const host = $("#opening");
  frame = document.createElement("iframe");
  frame.title = "Pack opening";
  frameReady = new Promise<PackApi>((resolve, reject) => {
    frame!.addEventListener(
      "load",
      () => {
        const P = (frame!.contentWindow as unknown as { PACK?: PackApi } | null)?.PACK;
        if (P) resolve(P);
        else reject(new Error("the pack opening didn't load"));
      },
      { once: true },
    );
  });
  // A failed load is tried again next time.
  frameReady.catch(() => {
    frame?.remove();
    frame = null;
    frameReady = null;
  });
  frame.src = "/pack-opening";
  host.appendChild(frame);
  return frameReady;
}

function showOpening(waitText: string | null): void {
  const el = $("#opening");
  let w = el.querySelector(".op-wait") as HTMLElement | null;
  if (waitText) {
    if (!w) {
      w = document.createElement("div");
      w.className = "op-wait";
      el.appendChild(w);
    }
    w.textContent = waitText;
  } else w?.remove();
  if (el.hidden) {
    el.hidden = false;
    liquid?.refresh();
  }
}

/** Opens packs (the oldest, the ten oldest or a chosen one) and plays them
 * full screen. Called again from the summary for the next pack. */
async function openPacks(what: SiteOpenRequest, from?: HTMLElement): Promise<void> {
  if (!state.session || inflight) return;
  inflight = true;
  if (from && $("#opening").hidden) openedFrom = { el: from, sel: twinSelector(from) };
  state.opening = true;
  if ($("#opening").hidden) showOpening("Opening…");
  try {
    const [answer, P] = await Promise.all([api.openPacks(state.session.token, what), packFrame()]);
    state.wallet = answer.wallet;
    drawWallet();
    play(P, revealOf(answer));
  } catch (err) {
    // Nothing was opened (or the page couldn't show it: the cards are in
    // the collection either way). Back to the website, with the reason.
    forceClose();
    fail(err);
  } finally {
    inflight = false;
  }
}

/** A selector for the same button after a redraw: its id, or its action. */
function twinSelector(el: HTMLElement): string | null {
  if (el.id) return `#${el.id}`;
  const a = el.dataset.act;
  if (!a) return null;
  const inWidget = el.closest(".wg") as HTMLElement | null;
  const scope = inWidget?.dataset.id ? `.wg[data-id="${inWidget.dataset.id}"] ` : "";
  return `${scope}[data-act="${a}"]${el.dataset.count ? `[data-count="${el.dataset.count}"]` : ""}${el.dataset.pack ? `[data-pack="${el.dataset.pack}"]` : ""}`;
}

/** Closes whatever the frame is doing, then the overlay. */
function forceClose(): void {
  const P = packApi();
  if (P && P.S.phase !== "idle") P.close("error");
  else closeOpening();
}

function play(P: PackApi, r: SiteReveal): void {
  showOpening(null);
  P.S.onSummary = (btns) => summaryHere(btns, "single");
  P.S.onBulkSummary = (btns) => summaryHere(btns, "bulk");
  if (r.kind === "single") {
    P.setPacks([{ label: r.label, reveal: r.reveal }]);
    P.openPack(0);
  } else {
    P.setBulks([{ label: r.label, reveal: r.reveal }]);
    P.openBulk(0);
  }
  frame?.focus();
  frame?.contentWindow?.focus();
}

/** The summary's buttons: the website's own (siteStore.summaryButtons),
 * from the packs still waiting. */
function summaryHere(btns: HTMLElement, kind: SiteReveal["kind"]): void {
  const n = state.wallet?.unopenedPacks.length ?? 0;
  const bulk = (state.shop.packs ?? state.home.packs)?.bulkOpenCount ?? 10;
  const list = summaryButtons(kind, n, bulk);
  btns.innerHTML = list.map((b) => `<button type="button"${b.primary ? ' class="pri"' : ""} data-site="${b.act}"${b.enabled ? "" : " disabled"}>${esc(b.label)}</button>`).join("");
  const why = summaryWhy(list);
  btns.parentElement?.querySelector(".why")?.remove();
  if (why.length) btns.insertAdjacentHTML("afterend", `<p class="why">${why.map(esc).join(" ")}</p>`);
  btns.onclick = (e) => {
    const b = (e.target as HTMLElement).closest("[data-site]") as HTMLButtonElement | null;
    if (!b || b.disabled) return;
    const act = b.dataset.site as SummaryAction;
    if (act === "done") return void packApi()?.close("done");
    btns.querySelectorAll("button").forEach((x) => ((x as HTMLButtonElement).disabled = true));
    void openPacks({ count: act === "ten" ? 10 : 1 });
  };
  // Focus the main button for the keyboard, without scrolling the summary
  // (a ten-pack summary is taller than the window: the cards come first).
  (btns.querySelector("button.pri:not([disabled])") as HTMLElement | null)?.focus({ preventScroll: true });
}

function packApi(): PackApi | null {
  return (frame?.contentWindow as unknown as { PACK?: PackApi } | null)?.PACK ?? null;
}

/** Back to the website (Done, the frame's Close, Esc on the summary). The
 * cards are already in the collection; everything that shows packs or
 * credits reads again. */
function closeOpening(): void {
  const el = document.getElementById("opening");
  if (!el || el.hidden) {
    state.opening = false;
    return;
  }
  const P = packApi();
  // The frame's own close() calls back here: only once.
  if (P && P.S.phase !== "idle") {
    P.close("site");
    return;
  }
  el.hidden = true;
  el.querySelector(".op-wait")?.remove();
  state.opening = false;
  liquid?.refresh();
  const back = openedFrom?.el.isConnected ? openedFrom.el : openedFrom?.sel ? document.querySelector<HTMLElement>(openedFrom.sel) : null;
  (back && !(back as HTMLButtonElement).disabled ? back : ($("#page") as HTMLElement)).focus();
  openedFrom = null;
  if (state.session) void afterChange();
}

// ---- the loadout picker, full screen (session 49) -----------------------------
// The standalone loadout picker in its site mode (loadoutPicker.ts), served
// by the site host at /loadout and framed here, same origin, like the pack
// opening. The website reads the agent's loadout and the cosmetics, hands
// the page what to draw (siteLoadout.loadoutPayload), and answers its
// Equip and Buy through window.LOADOUT_SITE_HOST with the server's own
// answers. Nothing is applied that the server didn't answer.
interface LoadoutApi {
  show(p: PickerSitePayload, keep?: unknown): void;
  close(): void;
}
let dressFrame: HTMLIFrameElement | null = null;
let dressReady: Promise<LoadoutApi> | null = null;
let dressFrom: { el: HTMLElement; sel: string | null } | null = null;
/** The agent the picker is open for (null: closed). */
let dressAgent: string | null = null;

async function dressPayload(token: string, agentId: string): Promise<PickerSitePayload> {
  const [play, loadout, owned, store, collection] = await Promise.all([api.play(token), api.loadout(token, agentId), api.cosmetics(token), api.store(token), api.collection(token)]);
  state.play = play;
  state.wallet = store.wallet;
  drawWallet();
  const agent = play.agents.find((a) => a.agentId === agentId);
  if (!agent) throw new SiteApiError(404, "that agent isn't one of yours");
  return loadoutPayload({ agent, loadout, owned: owned.owned, onSale: store.cosmetics, play, collection, credits: store.wallet.credits });
}

/** The page's answer to a refused or failed call: the server's words. */
function answerOf(err: unknown): { ok: false; error: string } {
  if (err instanceof SiteApiError && err.signedOut) {
    window.setTimeout(() => signedOut("Your session ended. Sign in again."), 0);
    return { ok: false, error: "your session ended" };
  }
  return { ok: false, error: err instanceof SiteApiError ? err.message : "something went wrong" };
}

(window as unknown as { LOADOUT_SITE_HOST: unknown }).LOADOUT_SITE_HOST = {
  // The account's sound, the same store the pack opening uses.
  sound: (window as unknown as { PACK_SITE_HOST: { sound: unknown } }).PACK_SITE_HOST.sound,
  equip: async (slot: string, itemId: string | null): Promise<PickerAnswer> => {
    if (!state.session || !dressAgent) return { ok: false, error: "not signed in" };
    try {
      const l = await api.setLoadout(state.session.token, dressAgent, slot, itemId);
      state.shop.loadouts = { ...state.shop.loadouts, [l.agentId]: l };
      return { ok: true, loadout: l.loadout };
    } catch (err) {
      return answerOf(err);
    }
  },
  // Buy from inside the picker: the Store's own confirm, then the server's
  // buy, then the page is handed the agent's state read again.
  buy: async (itemId: string): Promise<{ ok: true; payload: PickerSitePayload } | { ok: true; cancelled: true } | { ok: false; error: string }> => {
    if (!state.session || !dressAgent) return { ok: false, error: "not signed in" };
    const c = state.shop.store?.cosmetics.find((x) => x.itemId === itemId);
    const name = c?.name ?? "this";
    const price = c?.priceCredits ?? 0;
    const yes = await confirmDialog(`Buy ${name}?`, `${amount(price)} credits. You have ${amount(state.wallet?.credits ?? 0)}. It's yours on every agent.`, `Buy · ${amount(price)}`);
    // Back into the picker for the keyboard.
    dressFrame?.focus();
    if (!yes) return { ok: true, cancelled: true };
    try {
      const r = await api.buyCosmetic(state.session.token, itemId);
      state.wallet = r.wallet;
      drawWallet();
      return { ok: true, payload: await dressPayload(state.session.token, dressAgent) };
    } catch (err) {
      return answerOf(err);
    }
  },
  close: () => closeDress(),
};

function loadoutFrame(): Promise<LoadoutApi> {
  if (dressReady) return dressReady;
  dressFrame = document.createElement("iframe");
  dressFrame.title = "Agent loadout";
  dressReady = new Promise<LoadoutApi>((resolve, reject) => {
    dressFrame!.addEventListener(
      "load",
      () => {
        const L = (dressFrame!.contentWindow as unknown as { LOADOUT?: LoadoutApi } | null)?.LOADOUT;
        if (L) resolve(L);
        else reject(new Error("the loadout picker didn't load"));
      },
      { once: true },
    );
  });
  dressReady.catch(() => {
    dressFrame?.remove();
    dressFrame = null;
    dressReady = null;
  });
  dressFrame.src = "/loadout";
  $("#dress").appendChild(dressFrame);
  return dressReady;
}

async function openDress(agentId: string, from?: HTMLElement): Promise<void> {
  if (!state.session || dressAgent) return;
  dressAgent = agentId;
  if (from) dressFrom = { el: from, sel: from.dataset.agent ? `[data-act="dress"][data-agent="${CSS.escape(from.dataset.agent)}"]` : null };
  const el = $("#dress");
  el.querySelector(".op-wait")?.remove();
  el.insertAdjacentHTML("beforeend", '<div class="op-wait">Reading the loadout…</div>');
  el.hidden = false;
  liquid?.refresh();
  try {
    const [payload, L] = await Promise.all([dressPayload(state.session.token, agentId), loadoutFrame()]);
    if (dressAgent !== agentId) return;
    el.querySelector(".op-wait")?.remove();
    L.show(payload);
    dressFrame?.focus();
    dressFrame?.contentWindow?.focus();
  } catch (err) {
    closeDress();
    fail(err);
  }
}

/** Back to the Store (Close, Esc). Everything equipped is already saved;
 * the Store's reads run again. */
function closeDress(): void {
  const el = document.getElementById("dress");
  if (!el || el.hidden) {
    dressAgent = null;
    return;
  }
  el.hidden = true;
  el.querySelector(".op-wait")?.remove();
  dressAgent = null;
  liquid?.refresh();
  const sel = dressFrom?.sel ?? null;
  const back = dressFrom?.el.isConnected ? dressFrom.el : sel ? document.querySelector<HTMLElement>(sel) : null;
  (back ?? ($("#page") as HTMLElement)).focus();
  dressFrom = null;
  if (!state.session) return;
  // The Store reads again and redraws (the rows show what was saved): the
  // keyboard stays on the same agent's Change button.
  void afterChange().then(() => {
    const a = document.activeElement as HTMLElement | null;
    if (sel && (!a || a === document.body || !a.isConnected)) document.querySelector<HTMLElement>(sel)?.focus();
  });
}

// ---- the match pages (render session 50) -------------------------------------
// Agent match: the auto-play switch, the agent's live match (scoreboard,
// compact board, play-by-play) and the whole match history with replays.
// Watch live: every live match. A replay plays full screen in the existing
// arena replay page, rebuilt by the site host from the server's replay file.

const HISTORY_PAGE = 20;
let livePoll = 0;
let replayFrame: HTMLIFrameElement | null = null;
let replayFrom: HTMLElement | null = null;

/** Reads the history: the first page again (`fresh`), or the next older one. */
async function loadHistory(fresh: boolean): Promise<void> {
  if (!state.session || state.hist.loading) return;
  state.hist.loading = true;
  try {
    const before = fresh ? undefined : state.hist.rows[state.hist.rows.length - 1]?.matchId;
    const h = await api.matches(state.session.token, HISTORY_PAGE, before);
    // A fresh read starts the list again from the newest page.
    state.hist.rows = fresh ? h.matches : [...state.hist.rows, ...h.matches.filter((x) => !state.hist.rows.some((r) => r.matchId === x.matchId))];
    state.hist.more = h.more;
    if (fresh) state.home.history = h;
    state.hist.total = h.total;
    state.hist.error = null;
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    state.hist.error = err instanceof SiteApiError ? errorText(err.status, err.message) : "Something went wrong.";
  } finally {
    state.hist.loading = false;
  }
  if (state.page === "match") redrawPart("#m-hist", histHtml());
}

/** Reads what is live, then redraws only the live parts on screen (the
 * page's live panel, or Home's live widgets), and polls again while any is
 * on screen: every 3 s (a move is released every 1 to 9 s). */
async function loadLive(): Promise<void> {
  clearTimeout(livePoll);
  if (!state.session) return;
  const wasMine = state.home.live?.mine ?? null;
  try {
    state.home.live = await api.live(state.session.token);
    delete state.home.errors.live;
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    state.home.errors.live = err instanceof SiteApiError ? errorText(err.status, err.message) : "something went wrong";
  }
  const nowMine = state.home.live?.mine ?? null;
  if (state.page === "match" && nowMine) await followFeed(nowMine);
  // The agent's match just ended: it is recorded (or about to be): read the history and the status.
  if (wasMine && wasMine !== nowMine) {
    window.setTimeout(() => {
      void loadHistory(true);
      if (state.page === "home") void loadHome(["history", "daily"]);
      void refresh();
    }, 1500);
  }
  drawLive();
  if (liveOnScreen()) livePoll = window.setTimeout(() => void loadLive(), document.hidden ? 15000 : 3000);
}

/** Reads the moves released since the last read of the agent's match. */
async function followFeed(matchId: string): Promise<void> {
  if (!state.session) return;
  if (state.follow?.matchId !== matchId) state.follow = { matchId, next: 0, started: false, lines: [] };
  const f = state.follow;
  try {
    const feed = await api.liveFeed(state.session.token, matchId, f.next);
    if (state.follow !== f) return;
    const names = { p1: feed.p1.agentName, p2: feed.p2.agentName };
    // Every read from 0 carries the opening lines until the first move is
    // out (the board holds a few seconds first): they are taken once.
    const raw = [...(feed.from === 0 && !f.started ? (feed.startLines ?? []) : []), ...feed.steps.flatMap((x) => x.lines)];
    f.started = true;
    f.lines.push(...tidyLines(raw, names));
    if (f.lines.length > 400) f.lines.splice(0, f.lines.length - 400);
    f.next = feed.from + feed.steps.length;
    // The feed's own view is newer than the list's.
    const live = state.home.live;
    if (live) live.matches = live.matches.map((m) => (m.matchId === matchId ? { ...m, released: feed.released, nextAt: feed.nextAt, now: feed.now, recentLines: feed.recentLines } : m));
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return;
    // 404: the match has ended and been recorded; the next list read says so.
  }
}

function liveOnScreen(): boolean {
  if (state.page === "match" || state.page === "live") return true;
  if (state.page !== "home") return false;
  return (state.draft ?? state.board?.widgets ?? []).some((w) => w.type === "live" || w.type === "watch");
}

/** Replaces one part of the page, keeping focus if it was inside it. */
function redrawPart(sel: string, html: string): void {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return;
  const focused = document.activeElement as HTMLElement | null;
  const id = focused && el.contains(focused) ? focused.id : "";
  el.innerHTML = html;
  if (id) document.getElementById(id)?.focus();
}

function drawLive(): void {
  // Under a full-screen replay or live arena the live parts aren't seen, and
  // each redraw beneath it costs the arena frames (render session 51: opened
  // from Watch live, the arena took 28 s to start in software WebGL while the
  // cards redrew every 3 s; 5 s from Agent match). Closing it redraws them.
  if (state.replay) return;
  if (state.page === "match" && state.play) {
    redrawPart("#m-live", mLiveHtml(state.play));
    // The play-by-play follows its newest line.
    const pbp = document.getElementById("m-pbp");
    if (pbp) pbp.scrollTop = pbp.scrollHeight;
  }
  else if (state.page === "live") redrawPart("#live-list", liveListHtml());
  else if (state.page === "home" && state.board && !state.draft && !dragging) {
    const p = state.play;
    if (!p) return;
    const widgets = state.board.widgets;
    const data: WidgetData = { play: p, wallet: state.wallet, ...state.home, ownerId: state.me?.ownerId ?? null, viewOf, now: Date.now(), colFilter: state.colFilter };
    const { views, capped } = liveViews(widgets);
    for (const w of widgets) {
      if (w.type !== "live" && w.type !== "watch") continue;
      const tile = document.querySelector<HTMLElement>(`#wgrid .wg[data-id="${CSS.escape(w.id)}"]`);
      if (!tile || tile.contains(document.activeElement)) continue;
      tile.outerHTML = widgetHtml(w, data, { editing: false, live: views.get(w.id), capped: capped.has(w.id) });
    }
  }
}

function matchPage(p: SitePlay): string {
  const a = p.connectedAgent;
  const ap = autoPlayView(p.autoPlay, !!a);
  const st = agentStatus(p);
  const head = a
    ? `<div class="row nowrap">${avatar(a.name, agentFaction(p), 52)}<div class="wcol"><div class="mya-n">${esc(a.name)}</div><div class="small muted">${esc(styleName(p, a.playStyle))} play style · ${esc(deckLine(p))}</div><div class="row"><span class="status ${st.tone}"><i></i>${esc(st.label)}</span></div></div><span class="sp"></span><div class="wcol right">${autoPlaySwitch(ap, "auto-play", state.autoBusy)}<small class="muted">${esc(ap.note)}</small></div></div>`
    : `<b>No agent connected</b><p class="muted small">Connect an agent to play matches.</p><a class="btn pri sm" href="#/connect">Connect agent</a>`;
  const stopped = ap.stopped ? `<div class="banner warn" role="status">${esc(ap.stopped)}</div>` : "";
  return `<div class="pg-wide">${stopped}<section class="panel glass m-agent">${head}</section>
  <h3>Live now</h3><section class="panel dark m-live" id="m-live" aria-live="off">${mLiveHtml(p)}</section>
  <h3>Match history</h3><section class="panel glass" id="m-hist">${histHtml()}</section></div>`;
}

function mLiveHtml(p: SitePlay): string {
  if (!p.connectedAgent) return `<p class="muted small">No agent connected, so no match.</p>`;
  const live = state.home.live;
  if (!live) return state.home.errors.live ? `<p class="muted small">Couldn't read the live matches: ${esc(state.home.errors.live)}</p>` : `<p class="muted small">Loading…</p>`;
  if (!live.running) return `<p class="muted small">The ladder isn't running on this server, so no match is live.</p>`;
  const m = myLiveMatch(live);
  if (!m) {
    const ap = autoPlayView(p.autoPlay, true);
    return `<p class="small">${esc(p.liveMatch ? "Your agent's match is starting." : ap.on || !ap.shown ? "No match right now. Your agent joins the next ladder round." : "No match right now: auto-play is off, so your agent sits out.")}</p>${live.matches.length ? `<p class="muted small">${live.matches.length} other match${live.matches.length === 1 ? " is" : "es are"} live. <a href="#/live">Watch live</a></p>` : ""}`;
  }
  const sb = scoreboardOf(m, state.me?.ownerId ?? null);
  const names = { p1: m.p1.agentName, p2: m.p2.agentName };
  const lines = state.follow?.matchId === m.matchId ? state.follow.lines.slice(-60) : tidyLines(m.recentLines, names);
  const feed = lines.map((x) => `<li>${esc(x)}</li>`).join("");
  return `<div class="m-live-grid"><div class="wcol">${scoreboardHtml(sb)}${compactBoard(m, sb.near)}${arenaButton(m.matchId)}<p class="muted small">${sb.moves} moves shown. The result counts once the last move has been shown; then the match is in your history below, with its replay on the full board.</p></div><div class="wcol"><h4>Play-by-play</h4><ol class="pbp small" id="m-pbp">${feed}</ol></div></div>`;
}

function histHtml(): string {
  const h = state.hist;
  if (!h.rows.length) {
    if (h.error) return `<p class="muted small">Couldn't read your matches: ${esc(h.error)}</p><button type="button" class="btn sm" data-act="retry-hist">Try again</button>`;
    return h.loading || !state.home.history ? `<p class="muted small">Loading…</p>` : `<p class="muted small">No matches yet. Your agent's results and their replays show here.</p>`;
  }
  const now = Date.now();
  const rec = recordOf(h.rows);
  const more = h.more ? `<button type="button" class="btn sm" data-act="more-hist"${h.loading ? " disabled" : ""}>${h.loading ? "Loading…" : "Show older"}</button>` : "";
  return `<div class="row between"><span class="small">${h.rows.length} of ${h.total} matches · ${esc(rec.line)}</span>${h.error ? `<span class="warn-t small">${esc(h.error)}</span>` : ""}</div><ul class="hlist">${h.rows.map((r) => historyRowHtml(historyRowView(r, now))).join("")}</ul>${more}`;
}

function livePage(): string {
  return `<div class="pg-wide"><p class="muted small">Every match the ladder is showing now. Featured picks ("Top rated") and viewer counts come with their endpoint.</p><div id="live-list">${liveListHtml()}</div></div>`;
}

function liveListHtml(): string {
  const live = state.home.live;
  if (!live) return state.home.errors.live ? `<section class="panel glass"><p class="muted small">Couldn't read the live matches: ${esc(state.home.errors.live)}</p></section>` : `<section class="panel glass"><p class="muted small">Loading…</p></section>`;
  if (!live.running) return `<section class="panel glass"><p class="muted small">The ladder isn't running on this server, so nothing is live.</p></section>`;
  if (!live.matches.length) return `<section class="panel glass"><p class="muted small">No match is live right now. The next ladder round starts soon.</p></section>`;
  const me = state.me?.ownerId ?? null;
  return live.matches
    .map((m) => {
      const sb = scoreboardOf(m, me, viewOf(m.matchId));
      const lines = tidyLines(m.recentLines, { p1: m.p1.agentName, p2: m.p2.agentName }).slice(-3);
      return `<section class="panel dark live-card" data-match="${esc(m.matchId)}">${sb.mine ? '<span class="pill on">Your agent</span>' : watchAsHtml(sb, "wa-live")}${scoreboardHtml(sb)}${compactBoard(m, sb.near)}<ol class="pbp small">${lines.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>${arenaButton(m.matchId)}</section>`;
    })
    .join("");
}

async function setAutoPlay(on: boolean): Promise<void> {
  if (!state.session || !state.play || state.autoBusy) return;
  state.autoBusy = true;
  const focusId = (document.activeElement as HTMLElement | null)?.id ?? "";
  try {
    const r = await api.setAutoPlay(state.session.token, on);
    state.play = { ...state.play, autoPlay: r.autoPlay };
    toast(r.autoPlay.on ? "Auto-play is on: your agent joins the next ladder round." : "Auto-play is off. A match already live finishes.");
  } catch (err) {
    fail(err);
  } finally {
    state.autoBusy = false;
  }
  drawAgentCard();
  if (!dragging) drawPage();
  if (focusId) document.getElementById(focusId)?.focus();
}

async function showLog(matchId: string): Promise<void> {
  if (!state.session) return;
  try {
    const text = await api.matchLog(state.session.token, matchId);
    sheet(`<h3 id="dlg-t">Match log</h3><pre class="mlog" tabindex="0">${esc(text)}</pre><div class="row end"><button type="button" class="btn" data-a="close">Close</button></div>`, () => false, "wide");
  } catch (err) {
    fail(err);
  }
}

/** The live match on the full arena (render session 51). */
function arenaButton(matchId: string): string {
  return `<button type="button" class="btn sm" id="arena-${esc(matchId)}" data-act="watch-arena" data-match="${esc(matchId)}">Watch on the arena</button>`;
}

/** The point of view the arena opens with (render session 52), as the
 * page's hash: `view` the side at the bottom, `switch=1` when the viewer
 * may switch it (a match they don't own: their own agent's side otherwise,
 * no switch). The arena tells the website when the viewer switches
 * ('ai-tcg-view'), so the scoreboards follow once it closes. */
function arenaHash(matchId: string, mine: "p1" | "p2" | null, defaultView: "p1" | "p2" | null | undefined): string {
  const near = nearSeat(mine, viewOf(matchId), defaultView);
  return `#view=${near}&switch=${mine ? 0 : 1}`;
}
function arenaView(matchId: string): string {
  const m = state.home.live?.matches.find((x) => x.matchId === matchId) ?? null;
  const me = state.me?.ownerId ?? null;
  const mine = m && me ? (m.p1.ownerId === me ? "p1" : m.p2.ownerId === me ? "p2" : null) : null;
  return arenaHash(matchId, mine, m?.defaultView);
}
function replayView(matchId: string): string {
  // Match history is the viewer's own: their agent's seat near, no switch.
  const row = state.hist.rows.find((r) => r.matchId === matchId) ?? state.home.history?.matches.find((r) => r.matchId === matchId) ?? null;
  return arenaHash(matchId, row ? row.seat : null, null);
}
window.addEventListener("message", (e) => {
  if (!replayFrame || e.source !== replayFrame.contentWindow || e.origin !== location.origin) return;
  const d = e.data as { type?: unknown; view?: unknown } | null;
  if (!d || d.type !== "ai-tcg-view" || (d.view !== "p1" && d.view !== "p2") || !state.replay) return;
  setViewOf(state.replay, d.view);
});

/** The live arena's feeding: the page's key, how many frames it has, the poll. */
let arenaLive: { key: string; have: number; poll: number; ended: boolean } | null = null;

/** A live match full screen, on the arena (render session 51): the host
 * builds the page from the live feed; this page reads the new frames every
 * 3 s (15 s in a hidden tab) and hands them to the arena, which follows
 * the newest move. When the match is recorded the host says so, with the
 * record's boast; the arena plays it and shows ENDED. */
async function openLiveArena(matchId: string, from: HTMLElement | null): Promise<void> {
  if (!state.session || state.replay) return;
  state.replay = matchId;
  replayFrom = from;
  const el = $("#replay");
  el.innerHTML = `<div class="op-wait">Joining the match…</div><button type="button" class="rp-close" data-act="close-replay">Close</button>`;
  el.hidden = false;
  liquid?.refresh();
  (el.querySelector(".rp-close") as HTMLElement).focus();
  try {
    const page = await api.livePage(state.session.token, matchId);
    if (state.replay !== matchId) return;
    arenaLive = { key: page.key, have: page.released + 1, poll: 0, ended: false };
    replayFrame = document.createElement("iframe");
    replayFrame.title = "Live match on the arena";
    replayFrame.addEventListener("load", () => {
      el.querySelector(".op-wait")?.remove();
      replayFrame?.focus();
      void feedArena();
    }, { once: true });
    replayFrame.src = page.url + arenaView(matchId);
    el.insertBefore(replayFrame, el.firstChild);
  } catch (err) {
    closeReplay();
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    // 404: the match ended between the list and the tap.
    if (err instanceof SiteApiError && err.status === 404) return toast("That match has just ended: its replay is in the match history.");
    fail(err);
  }
}

async function feedArena(): Promise<void> {
  const live = arenaLive;
  if (!live || !state.session || !replayFrame) return;
  clearTimeout(live.poll);
  try {
    const r = await api.liveFrames(state.session.token, live.key, live.have);
    if (arenaLive !== live || !replayFrame?.contentWindow) return;
    live.have += r.frames.length;
    live.ended = r.ended;
    if (r.frames.length || r.ended) replayFrame.contentWindow.postMessage({ type: "ai-tcg-live", frames: r.frames, ended: r.ended, record: r.record }, location.origin);
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    if (err instanceof SiteApiError && err.status === 404) return; // the page expired: Close and open it again
  }
  if (arenaLive === live && !live.ended) live.poll = window.setTimeout(() => void feedArena(), document.hidden ? 15000 : 3000);
}

/** A replay full screen: the host rebuilds the match from the server's
 * replay file and the arena replay page plays it in a frame. */
async function openReplay(matchId: string, from: HTMLElement | null): Promise<void> {
  if (!state.session || state.replay) return;
  state.replay = matchId;
  replayFrom = from;
  const el = $("#replay");
  el.innerHTML = `<div class="op-wait">Rebuilding the match…</div><button type="button" class="rp-close" data-act="close-replay">Close replay</button>`;
  el.hidden = false;
  liquid?.refresh();
  (el.querySelector(".rp-close") as HTMLElement).focus();
  try {
    const page = await api.replayPage(state.session.token, matchId);
    if (state.replay !== matchId) return;
    replayFrame = document.createElement("iframe");
    replayFrame.title = "Match replay";
    replayFrame.addEventListener("load", () => {
      // Escape inside the replay is the arena's own (it skips the intro and
      // the boast), so it doesn't close the replay: Close does, and Escape
      // while focus is on the website (the Close button).
      el.querySelector(".op-wait")?.remove();
      replayFrame?.focus();
    }, { once: true });
    replayFrame.src = page.url + replayView(matchId);
    el.insertBefore(replayFrame, el.firstChild);
  } catch (err) {
    closeReplay();
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    fail(err);
  }
}

function closeReplay(): void {
  const el = $("#replay");
  if (el.hidden) return;
  el.hidden = true;
  el.innerHTML = "";
  replayFrame = null;
  state.replay = null;
  if (arenaLive) clearTimeout(arenaLive.poll);
  arenaLive = null;
  liquid?.refresh();
  drawLive();
  // The row may have been redrawn while the replay played: its twin.
  const id = replayFrom?.dataset.match;
  const act = replayFrom?.dataset.act ?? "replay";
  const back = replayFrom && replayFrom.isConnected ? replayFrom : id ? document.querySelector<HTMLElement>(`#page [data-act="${CSS.escape(act)}"][data-match="${CSS.escape(id)}"]`) : null;
  back?.focus();
  replayFrom = null;
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.replay) {
    e.preventDefault();
    closeReplay();
  }
});

// ---- actions ----------------------------------------------------------------
async function act(fn: (token: string) => Promise<SitePlay>, ok?: string): Promise<void> {
  if (!state.session || state.busy) return;
  state.busy = true;
  document.body.classList.add("busy");
  try {
    state.play = await fn(state.session.token);
    if (ok) toast(ok);
  } catch (err) {
    fail(err);
  } finally {
    state.busy = false;
    document.body.classList.remove("busy");
    drawAgentCard();
    drawPage();
  }
}

async function onRebuild(): Promise<void> {
  const p = state.play;
  if (!p || !state.session) return;
  if (rebuildView(p).kind === "current" && p.agentDeck && !(await confirmDialog("Rebuild anyway?", "Your agent's deck is up to date. A rebuild plays a few minutes of games to build it again.", "Rebuild"))) return;
  try {
    const job = await api.rebuild(state.session.token);
    state.play = { ...p, rebuild: { ...p.rebuild, job } };
    toast("Your agent started building its deck.");
  } catch (err) {
    fail(err);
  }
  drawPage();
  schedulePoll();
}

document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  // A greyed link (Open with no packs) does nothing.
  const off = t.closest('a[aria-disabled="true"]');
  if (off && !off.classList.contains("navb")) {
    e.preventDefault();
    return;
  }
  const actEl = t.closest("[data-act]") as HTMLElement | null;
  if (actEl && !(actEl as HTMLButtonElement).disabled) {
    const act = actEl.dataset.act!;
    const tile = actEl.closest(".wg") as HTMLElement | null;
    const id = tile?.dataset.id;
    if (act === "customise") return startCustomise();
    if (act === "done") return void finishCustomise();
    if (act === "add") return addWidgetDialog();
    if (act === "background") return backgroundDialog();
    if (act === "recommended") return void recommendedDialog();
    if (act === "use-recommended" && state.board) return void changeBoard(recommendedWidgets(state.board.rules), "Recommended layout applied.");
    if (act === "retry-board") return void retryBoard();
    if (act === "remove" && id && state.draft) {
      state.draft = removeWidget(state.draft, id);
      return drawPage();
    }
    if (act === "resize" && id && state.draft) {
      state.draft = resizeWidget(state.draft, id, actEl.dataset.size as WidgetSize);
      drawPage();
      void loadHome();
      return;
    }
    if (act === "col-filter") {
      state.colFilter = actEl.dataset.f ?? "All";
      return drawPage();
    }
    if (act === "buy-packs") return void buyPacks(actEl.dataset.set!, Number(actEl.dataset.count));
    if (act === "buy-cosmetic") return void buyCosmetic(actEl.dataset.item!, actEl.dataset.name ?? "this", Number(actEl.dataset.price));
    if (act === "open-packs") return void openPacks(actEl.dataset.pack ? { packId: actEl.dataset.pack } : { count: Number(actEl.dataset.count) === 10 ? 10 : 1 }, actEl);
    if (act === "claim-daily") return void claimDaily();
    if (act === "dress" && actEl.dataset.agent) return void openDress(actEl.dataset.agent, actEl);
    if (act === "auto-play") return void setAutoPlay(actEl.dataset.on === "1");
    if (act === "replay" && actEl.dataset.match) return void openReplay(actEl.dataset.match, actEl);
    if (act === "watch-arena" && actEl.dataset.match) return void openLiveArena(actEl.dataset.match, actEl);
    if (act === "watch-as" && actEl.dataset.match && (actEl.dataset.seat === "p1" || actEl.dataset.seat === "p2")) {
      setViewOf(actEl.dataset.match, actEl.dataset.seat);
      const focusId = actEl.id;
      // A Home tile with focus inside isn't redrawn (drawLive): this one must be.
      actEl.blur();
      drawLive();
      if (focusId) document.getElementById(focusId)?.focus();
      return;
    }
    if (act === "close-replay") return closeReplay();
    if (act === "match-log" && actEl.dataset.match) return void showLog(actEl.dataset.match);
    if (act === "more-hist") return void loadHistory(false);
    if (act === "retry-hist") return void loadHistory(true);
    if (act === "buy-step") {
      state.buyCount = Math.max(1, Math.min(BUY_MAX, state.buyCount + Number(actEl.dataset.d)));
      drawPage();
      (document.querySelector(`[data-act="buy-step"][data-d="${actEl.dataset.d}"]`) as HTMLElement | null)?.focus();
      return;
    }
    if (act === "retry-shop") return void loadShop();
    if (act === "retry-col") return void loadCollection();
    if (act === "col-tab" || act === "col-faction" || act === "col-show") {
      const v = actEl.dataset.v ?? "";
      const f = state.col.filters;
      state.col.filters = act === "col-tab" ? { ...f, tab: v as CollectionTab } : act === "col-faction" ? { ...f, faction: v as FactionFilter } : { ...f, show: v as ShowFilter };
      drawPage();
      (document.querySelector(`[data-act="${act}"][data-v="${CSS.escape(v)}"]`) as HTMLElement | null)?.focus();
      return;
    }
    if (act === "view-slot" && actEl.dataset.slot) return void openViewer(actEl.dataset.slot, actEl.closest("#viewer") ? null : actEl);
    if (act === "close-viewer") return closeViewer(true);
    if (act === "craft") return void craftSlot();
    if (act === "salvage") return void salvageSlot();
    if (act === "salv-step" && state.col.viewer?.holdings) {
      const v = state.col.viewer;
      v.quantity = salvageView(v.holdings!, v.quantity + Number(actEl.dataset.d)).quantity;
      drawViewer();
      return;
    }
  }
  if (e.target === document.getElementById("viewer")) return closeViewer(true);
  const segBtn = t.closest(".seg button") as HTMLElement | null;
  if (segBtn) {
    const group = segBtn.parentElement!.id;
    const v = segBtn.dataset.v ?? "";
    if (segBtn.getAttribute("aria-pressed") === "true") return;
    if (group === "deck-choice") void act((tok) => api.setDeckChoice(tok, v as "agent" | "forced"));
    else if (group === "faction-lock")
      void act(async (tok) => {
        const r = await api.setFactionLock(tok, (v || null) as SiteFaction | null);
        // Matches start only with an active deck of the locked faction.
        if (r.activeDeckFits === false) toast(`The deck that plays now isn't ${v}. Matches wait until a ${v} deck plays: rebuild your agent's deck, or pick a ${v} deck.`, "error");
        return r;
      });
    else if (group === "theme-seg") void saveLook({ theme: v as ThemePref });
    return;
  }
  const sw = t.closest("#bg-picker .sw") as HTMLElement | null;
  if (sw) {
    if (sw.dataset.bg && sw.dataset.bg !== state.background) void saveLook({ background: sw.dataset.bg });
    return;
  }
  const deck = t.closest(".deckrow") as HTMLElement | null;
  if (deck) {
    if (deck.getAttribute("aria-disabled") === "true") return toast("That deck is incomplete: you don't hold every card it uses.", "error");
    if (deck.classList.contains("on") && state.play?.deckChoice === "forced") return;
    void act((tok) => api.setActiveDeck(tok, deck.dataset.deck!), "Your agent will play that deck.");
    return;
  }
  if (t.closest("#rebuild")) return void onRebuild();
  if (t.closest("#theme-btn")) {
    void saveLook({ theme: nextTheme(state.theme) });
    return;
  }
  const acctBtn = t.closest("#acct-btn");
  const menu = $("#acct-menu");
  if (acctBtn) {
    menu.hidden = !menu.hidden;
    acctBtn.setAttribute("aria-expanded", String(!menu.hidden));
    return;
  }
  if (t.closest("#sign-out")) {
    menu.hidden = true;
    return void signOut();
  }
  if (!t.closest("#acct-menu")) menu.hidden = true;
});
// The picker is a radio group: arrow keys move the choice.
document.addEventListener("keydown", (e) => {
  // Customise mode: a focused widget moves with the arrow keys; Delete removes it.
  const tile = (e.target as HTMLElement).closest?.("#wgrid.editing .wg") as HTMLElement | null;
  if (tile && state.draft && e.target === tile) {
    const id = tile.dataset.id!;
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step) {
      e.preventDefault();
      state.draft = moveBy(state.draft, id, step);
      drawPage();
      (document.querySelector(`#wgrid .wg[data-id="${id}"]`) as HTMLElement | null)?.focus();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      state.draft = removeWidget(state.draft, id);
      drawPage();
      (document.querySelector("#wgrid .wg") as HTMLElement | null)?.focus();
      return;
    }
  }
  const sw = (e.target as HTMLElement).closest?.("#bg-picker .sw") as HTMLElement | null;
  if (!sw) return;
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const ids = BACKGROUND_IDS as readonly string[];
  const next = ids[(ids.indexOf(sw.dataset.bg ?? "") + step + ids.length) % ids.length]!;
  void saveLook({ background: next }).then(() => (document.querySelector(`#bg-picker .sw[data-bg="${next}"]`) as HTMLElement | null)?.focus());
});
document.addEventListener("change", (e) => {
  const sel = (e.target as HTMLElement).closest("select[data-style-for]") as HTMLSelectElement | null;
  if (sel) void act((tok) => api.setPlayStyle(tok, sel.dataset.styleFor!, sel.value), "Play style saved.");
});

// ---- start --------------------------------------------------------------------
$("#si-form").addEventListener("submit", (e) => void onSignIn(e));
liquid = startLiquid($("#liquid") as HTMLCanvasElement, {
  background: () => backgroundOf(state.background),
  dark: () => document.body.dataset.theme === "dark",
  // The sign-in screen is opaque and covers the whole background.
  // So does a pack opening (full screen, session 47).
  covered: () => $("#signin").hidden !== true || $("#shell").hidden === true || $("#opening").hidden !== true || $("#replay").hidden !== true,
  reduceMotion: () => !!motionQuery?.matches,
});
applyTheme();
state.session = loadSession();
if (state.session) void enter();
else showSignIn();
