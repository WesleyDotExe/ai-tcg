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
import { allowanceOf, DIAL_SAVE_MS, dialChoose, dialKeyTarget, dialView, ringOfPlay, ringParts, ringTicks, statusPollMs, type SiteRating } from "./siteAgent.js";
import { startLiquid, type Liquid } from "./liquid.js";
import { SiteApiError, salvageNeedsConfirmation, siteApi, type SiteHistory, type SiteHistoryRow, type SiteLive, type SiteAccountSettings, type SiteFaction, type SiteMe, type SiteOpenRequest, type SitePlay, type SiteSettingsPatch, type SiteStore, type SiteWallet } from "./siteApi.js";
import { balanceHtml, cosmeticGridHtml, cosmeticTiles, packGridHtml, packTiles, resetCountdownHtml, sealedPackHtml, clockLeft, type ShopArt } from "./siteShop.js";
import { recentOpenings, revealOf, shortWhen, withSiteSetBar, soundPatchOf, soundPrefOf, summaryButtons, summaryWhy, unopenedGroups, type SiteReveal, type SummaryAction } from "./siteStore.js";
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
import { miniCard, sourcesFor, widgetHtml, type WidgetData, type WidgetSource } from "./siteWidgets.js";
import { BELL_PAGE, bellButton, bellPanelHtml, closed as bellClosed, emptyBell, unreadShown, withCleared, withCounts, withPage, withRead, type BellState } from "./siteBell.js";
import { arenaFit, arenaPick, patchAround, syncAttributes, TILE_ARENA_HOLD_END_MS, type HeldArena } from "./siteTileArena.js";
import type { SiteLadder, SiteNotificationKind, SiteNotifications, SiteStats } from "./siteStanding.js";
import { STATS_RECENT, statsPageHtml, type StatsDays, type StatsPageState } from "./siteStats.js";
import { autoPlaySwitch, autoPlayView, compactBoard, historyRowHtml, historyRowView, liveGroups, liveOrder, myLiveMatch, nearSeat, recordOf, scoreboardHtml, scoreboardOf, speedControlHtml, speedControlView, tidyLines, topRatedHtml, topRatedRank, topRatedWhy, viewersHtml, watchAsHtml } from "./siteMatches.js";
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
  home: { packs: SitePacks | null; collection: SiteCollection | null; daily: SiteDaily | null; store: SiteStore | null; live: SiteLive | null; history: SiteHistory | null; rating: SiteRating | null; ladder: SiteLadder | null; stats: SiteStats | null; notif: SiteNotifications | null; errors: Partial<Record<WidgetSource, string>> };
  colFilter: string;
  /** The Store page's own reads: the packs (with the daily pack), the store,
   * and the collection's recent openings. */
  shop: { packs: (SitePacks & { wallet: SiteWallet }) | null; store: SiteStore | null; recent: SiteCollection | null; error: string | null;
    /** Session 49: what each agent wears (by agent id) and the owned cosmetics, for "Your agents". */
    loadouts: Record<string, SiteLoadout>; owned: SiteOwnedCosmetic[] | null };
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
  /** A 2× vote on its way to the server (render session 56). */
  speedBusy: boolean;
  /** The replay on screen (its match id), or null. */
  replay: string | null;
  /** The agent's live match followed move by move on Agent match
   * (`GET /api/live/:id?from=N`): the next move to ask for and every line
   * released so far, tidied. */
  follow: { matchId: string; next: number; started: boolean; lines: string[] } | null;
  /** The Stats page (render session 68): `GET /api/stats` under its filter,
   * and `GET /api/ladder` for the tiers and the season ladder. */
  stats: StatsPageState;
} = {
  session: null, play: null, me: null, settings: null, wallet: null, page: "home", theme: "system", background: DEFAULT_BACKGROUND, busy: false, poll: 0,
  board: null, boardError: null, draft: null, saving: false, home: { packs: null, collection: null, daily: null, store: null, live: null, history: null, rating: null, ladder: null, stats: null, notif: null, errors: {} }, colFilter: "All",
  shop: { packs: null, store: null, recent: null, error: null, loadouts: {}, owned: null }, opening: false,
  col: { binder: null, collection: null, error: null, filters: { ...DEFAULT_FILTERS }, viewer: null },
  hist: { rows: [], total: 0, more: false, error: null, loading: false }, autoBusy: false, speedBusy: false, replay: null, follow: null,
  stats: { stats: null, ladder: null, replays: null, allRecent: false, agent: null, days: 30, loading: false, error: null, ladderError: null },
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
    // Render session 64: focus goes back to what opened the dialog (a
    // tile's Buy), so the redraw after the answer can keep it there.
    const opener = document.activeElement as HTMLElement | null;
    d.innerHTML = `<div class="dlg glass" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h2 id="dlg-t">${esc(title)}</h2><p>${esc(body)}</p><div class="row end"><button class="btn" data-a="no">Cancel</button><button class="btn pri" data-a="yes">${esc(confirm)}</button></div></div>`;
    d.className = "dim on";
    const done = (v: boolean) => {
      d.className = "dim";
      d.innerHTML = "";
      document.removeEventListener("keydown", onKey, true);
      if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
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
  state.home = { packs: null, collection: null, daily: null, store: null, live: null, history: null, rating: null, ladder: null, stats: null, notif: null, errors: {} };
  state.hist = { rows: [], total: 0, more: false, error: null, loading: false };
  bellSeq++;
  bell = emptyBell();
  drawBell();
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
  void pollBell().catch((err) => fail(err));
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
    rating: () => api.rating(token, 20),
    // Render session 65: the Ladder, Rating & form and Notifications widgets.
    ladder: () => api.ladder(token, 100),
    stats: () => api.stats(token, { days: 30, recent: 20 }),
    notif: () => api.notifications(token, 20),
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
  // Render session 70: the widget's read keeps the bell's count in step.
  if (need.includes("notif") && state.home.notif) bellCounts(state.home.notif);
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
  state.poll = window.setTimeout(refresh, statusPollMs(state.play, Date.now()));
}

/** Agent controls' ring, once a second while time runs down (render session
 * 59): the arc, the minutes, the label and the caption are patched in place
 * from the last read and the page's clock, so the ring drains smoothly and
 * nothing the viewer is focused on is redrawn. The server's reads still
 * decide finishing and done. */
function tickRings(): void {
  const p = state.play;
  if (document.hidden || state.page !== "home" || !ringTicks(p) || !p?.connectedAgent) return;
  const rings = document.querySelectorAll<HTMLElement>("#wgrid .tring");
  if (!rings.length) return;
  const v = ringOfPlay(p, Date.now());
  const name = p.connectedAgent.name;
  rings.forEach((el) => {
    const size = Number(el.dataset.size);
    if (!size) return;
    const g = ringParts(name, v, size);
    el.className = `tring t-${g.tone}`;
    el.setAttribute("aria-label", g.label);
    el.querySelector(".tr-fg")?.setAttribute("stroke-dasharray", g.dash);
    const c = el.querySelector<HTMLElement>(".tr-c");
    if (c && c.innerHTML !== g.centreHtml) {
      c.innerHTML = g.centreHtml;
      c.classList.toggle("word", g.word);
    }
    const cap = el.closest(".wg")?.querySelector<HTMLElement>(".ac-cap");
    if (cap && cap.textContent !== v.caption) cap.textContent = v.caption;
  });
}
window.setInterval(tickRings, 1000);
/** The store's countdowns to the daily reset (render session 63): each
 * `[data-until]` clock ticks each second; once one reaches zero the store's
 * reads run again (once per reset), so the new day's free pack shows. */
let clockReloadFor: string | null = null;
function tickClocks(): void {
  if (document.hidden) return;
  const now = Date.now();
  let passed: string | null = null;
  document.querySelectorAll<HTMLElement>("[data-until]").forEach((el) => {
    const until = el.dataset.until!;
    const t = clockLeft(now, until);
    if (el.textContent !== t) el.textContent = t;
    if (Date.parse(until) <= now) passed = until;
  });
  if (passed && clockReloadFor !== passed) {
    clockReloadFor = passed;
    if (state.page === "store" && !state.opening) void loadShop();
    // Render session 66: the Daily rewards widget's reset clock too (a new day).
    if (state.page === "home") void loadHome(["packs", "store", "daily"]);
    // Render session 68: the Stats page's "Today" starts the new day.
    if (state.page === "stats") void loadStats();
  }
}
window.setInterval(tickClocks, 1000);
async function refresh(): Promise<void> {
  if (!state.session || document.hidden) return schedulePoll();
  try {
    const was = state.play?.rebuild.job;
    const wasLive = state.play?.liveMatch?.matchId ?? null;
    const token = state.session.token;
    const [play, wallet] = await Promise.all([api.play(token), api.wallet(token).catch((err: unknown) => {
      if (err instanceof SiteApiError && err.signedOut) throw err;
      return state.wallet;
    }), pollBell()]);
    state.play = play;
    state.wallet = wallet;
    drawWallet();
    const now = state.play.rebuild.job;
    if (was?.state === "running" && now && now.jobId === was.jobId && now.state !== "running") {
      toast(now.state === "done" ? "Your agent finished building its deck." : `The rebuild failed: ${now.error ?? "no reason given"}`, now.state === "done" ? "info" : "error");
    }
    drawAgentCard();
    if (!state.busy && !dragging) drawPage();
    if (state.page === "home") void loadHome(["daily", "packs", "notif"]);
    if (state.page === "store" && !state.opening) void loadShop();
    // Render session 68: the agent's match ended (or another began): it is
    // recorded, so the Stats page reads again (its totals, today, the ladder).
    if (state.page === "stats" && wasLive !== (play.liveMatch?.matchId ?? null)) void loadStats();
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
  if (page === "stats") void loadStats();
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
  // The tile the focused control sits in (render session 64): a Buy that
  // turns into a greyed "Owned" or "Claimed today" can't take focus back, so
  // its tile does instead of focus dropping to the page.
  const keepTile = keep ? ((document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-tile]")?.dataset.tile ?? null) : null;
  if (page === "home") {
    // The tile's arena frame stays where it is (render session 67): the
    // rest of Home is redrawn around it.
    const html = homePage(p);
    if (!keepTileArena(el, html)) el.innerHTML = html;
  } else if (page === "settings") el.innerHTML = settingsPage(p);
  else if (page === "connect") el.innerHTML = connectPage(p);
  else if (page === "store") el.innerHTML = storePage();
  else if (page === "collection") el.innerHTML = collectionPage();
  else if (page === "match") el.innerHTML = matchPage(p);
  else if (page === "live") el.innerHTML = livePage();
  else if (page === "stats") el.innerHTML = statsPageHtml(state.stats, Date.now());
  else el.innerHTML = waitsPage(page);
  applyTheme();
  if (keep) restoreFocus(el, keep, keepTile);
  mountTileArena();
}

/** Focus back on the redrawn twin of what had it; if that twin is gone or
 * greyed, on the tile it sat in (focusable from a script only). */
function restoreFocus(root: HTMLElement, key: string, tileId: string | null): void {
  const twin = root.querySelector<HTMLElement>(key);
  if (twin && !(twin as HTMLButtonElement).disabled) return twin.focus({ preventScroll: true });
  const tile = tileId ? root.querySelector<HTMLElement>(`[data-tile="${CSS.escape(tileId)}"]`) : null;
  if (!tile) return;
  tile.tabIndex = -1;
  tile.focus({ preventScroll: true });
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
  const data: WidgetData = { play: p, wallet: state.wallet, ...state.home, ownerId: state.me?.ownerId ?? null, viewOf, now: Date.now(), colFilter: state.colFilter, allowance: allowanceOf(p.autoPlay, Date.now()), busy: state.busy, art: shopArt() };
  const { views, capped } = liveViews(widgets);
  const tiles = widgets.map((w) => widgetHtml(w, data, { editing, live: views.get(w.id), capped: capped.has(w.id), arena: views.get(w.id) === "arena" ? tileArenaPick() : undefined })).join("");
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
    ${ask2xField()}
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

/** Settings -> Play "Ask for 2× in every match" (render session 56; the
 * account setting `ask2xEveryMatch`, game session 73): asks for the owner as
 * each of its live matches starts. A match runs at 2× only once the other
 * owner agrees too (the house always does). Hidden for a house account
 * (its setting is ignored) and when the server doesn't send the setting. */
function ask2xField(): string {
  const st = state.settings;
  if (!st || typeof st.ask2xEveryMatch !== "boolean" || state.play?.autoPlay.house) return "";
  const on = st.ask2xEveryMatch;
  return `<div class="field"><div><b>Ask for 2× in every match</b><small>Asks for 2× as each of your agent's matches starts. It plays at 2× once the other owner agrees (against the house, at once). You can take it back in the match.</small></div><button type="button" class="switch${on ? " on" : ""}" id="ask-2x-every" role="switch" aria-checked="${on}" data-act="ask-2x-every" data-on="${on ? "0" : "1"}"${state.speedBusy ? " disabled" : ""}><i aria-hidden="true"></i><span>${on ? "On" : "Off"}</span></button></div>`;
}

async function setAsk2xEvery(on: boolean): Promise<void> {
  if (!state.session || !state.settings || state.speedBusy) return;
  state.speedBusy = true;
  try {
    state.settings = await api.updateAccountSettings(state.session.token, { ask2xEveryMatch: on });
    toast(on ? "Your agent's next matches start with your ask for 2×." : "No more automatic asks for 2×. A match already asked keeps its ask.");
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    fail(err);
  } finally {
    state.speedBusy = false;
  }
  if (state.page === "settings") {
    drawPage();
    document.getElementById("ask-2x-every")?.focus();
  }
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
  const reads: Promise<unknown>[] = [loadHome(["packs", "store", "collection", "notif"])];
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
  const now = Date.now();
  const art = shopArt();
  // Render session 63 (the store layout, the Season 0 brief section 2): the
  // products as tiles of different sizes, the featured one larger, the art
  // as the hero, the price on the tile, the button underneath; the balance
  // and the countdown to the daily reset at the top.
  const head = `<div class="sh-head">${balanceHtml(credits)}${resetCountdownHtml(sh.packs.dailyPack, now)}<span class="sp"></span><span class="muted small">Every pack also pays 5 pack points.</span></div>`;
  const packs = `<section class="sh-sec" aria-labelledby="sh-packs"><h3 id="sh-packs">Packs</h3><p class="sh-sub">${esc(pityText(sh.packs))}</p>${packGridHtml(packTiles(sh.packs, credits, now), { art })}</section>`;
  const cosmetics = `<section class="sh-sec" aria-labelledby="sh-cos"><h3 id="sh-cos">Cosmetics</h3><p class="sh-sub">What you buy is yours on every agent: equip it with Change, under Your agents' loadouts.</p>${cosmeticGridHtml(cosmeticTiles(sh.store.cosmetics, credits), { art })}</section>`;
  // The packs waiting, by where they came from.
  const n = sh.packs.unopened.length;
  const bulk = sh.packs.bulkOpenCount;
  const groups = unopenedGroups(sh.packs.unopened);
  const rows = groups
    .map((g) => `<div class="st-row"><span class="pk-dot" aria-hidden="true"></span><div class="dn"><b>${esc(g.name)}</b><small>${g.count} waiting · ${esc(g.setCode)} · the oldest from ${esc(shortWhen(g.oldestAt))}</small></div><button type="button" class="btn sm" data-act="open-packs" data-pack="${esc(g.oldestPackId)}" aria-label="Open a ${esc(g.name.toLowerCase())}">Open one</button></div>`)
    .join("");
  const waiting = `<section class="panel glass st-open"><h3>Waiting to be opened</h3><div class="pkw">${sealedPackHtml(sh.packs.offer[0]?.setCode ?? sh.packs.dailyPack.setCode, 58, art)}<div class="dn"><p class="pkw-n">${n}<small>pack${n === 1 ? "" : "s"}</small></p><div class="row"><button type="button" class="btn pri" id="open1-btn" data-act="open-packs" data-count="1"${n ? "" : " disabled"}>Open</button><button type="button" class="btn" id="open10-btn" data-act="open-packs" data-count="${bulk}"${n >= bulk ? "" : " disabled"}>Open ${bulk}</button></div></div></div>${n && n < bulk ? `<p class="muted small">Opening ${bulk} at once needs ${bulk} waiting.</p>` : ""}${rows ? `<div class="st-rows">${rows}</div>` : '<p class="muted small">Buy a pack or claim your free daily pack, and it waits here.</p>'}</section>`;
  // Recent openings: when, the best finish, the cards.
  const rec = sh.recent ? recentOpenings(sh.recent, 6) : [];
  const recent = `<section class="panel glass st-recent"><h3>Recent openings</h3>${rec.length ? rec.map((o) => `<div class="st-rec"><div class="dn"><b>${esc(shortWhen(o.openedAt))}</b><small>${esc(o.setCode)}${o.best ? ` · best: ${esc(o.best)}` : ""}${o.jackpot ? " · Jackpot pack" : ""}</small></div><div class="mrow">${o.cards.map((c) => miniCard(c)).join("")}</div></div>`).join("") : '<p class="muted small">No packs opened yet.</p>'}</section>`;
  return `<div class="pg-wide sh-pg">${head}${packs}${cosmetics}<div class="st-grid"><div class="st-col">${waiting}${agentsPanel()}</div>${recent}</div></div>`;
}

/** The store's art the pure strings can't draw (render session 63): the
 * pack's plate from the pack page's own source (window.SITE_FACE). */
let shopArtCache: ShopArt | null = null;
function shopArt(): ShopArt | null {
  if (shopArtCache) return shopArtCache;
  const f = (window as unknown as { SITE_FACE?: { packPlateSvg?: (s: string) => string } }).SITE_FACE;
  if (!f?.packPlateSvg) return null;
  const plates = new Map<string, string>();
  const fn = f.packPlateSvg;
  shopArtCache = { plate: (s) => plates.get(s) ?? (plates.set(s, fn(s)), plates.get(s)!) };
  return shopArtCache;
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
            `<div class="st-agent">${avatar(r.name, null, 30)}<div class="dn"><b>${esc(r.name)}${r.connected ? ' <span class="pill on">Connected</span>' : ""}</b><small>Victory boast: ${esc(r.boast)}</small><small>Close win: ${esc(r.closeWin)}</small><small>Coin: ${esc(r.coin)}</small></div><button type="button" class="btn sm" data-act="dress" data-agent="${esc(r.agentId)}" aria-label="Change ${esc(r.name)}'s loadout">Change</button></div>`,
        )
        .join("")
    : '<p class="muted small">No agents yet.</p>';
  return `<section class="panel glass st-agents"><h3>Your agents' loadouts</h3><p class="muted small">Each agent wears its own: its victory boast, its close-win boast (a win on ${CLOSE_WIN_HEALTH} health or less), the coin its first-player flip shows, and later a card back, an avatar and an arena.</p>${locked ? '<p class="small warn-t">A match is live: loadouts can\'t change until it ends.</p>' : ""}<div class="st-rows">${body}</div></section>`;
}

function pityText(p: SitePacks): string {
  const sure = [p.pity.next.fullArt ? "a Full Art or better" : "", p.pity.next.mythic ? "a Mythic" : ""].filter(Boolean);
  if (sure.length) return `Your next pack is sure to hold ${sure.join(" and ")}.`;
  return `${p.pity.packsSinceFullArt} pack${p.pity.packsSinceFullArt === 1 ? "" : "s"} since a Full Art · ${p.pity.packsSinceMythic} since a Mythic`;
}

/** The Notifications widget's "Mark all read" (render session 65): the
 * server marks every unread one read (`POST /api/notifications/read`,
 * `{ all: true }`), then the widget reads its page again. Showing them
 * marks nothing read on its own (OWNER_API.md: the website marks what it
 * showed; here, when the owner says so). */
async function markAllRead(): Promise<void> {
  if (!state.session) return;
  try {
    await api.markNotificationsRead(state.session.token, { all: true });
  } catch (err) {
    fail(err);
  }
  await loadHome(["notif"]);
  // The button is gone once nothing is unread: keep focus in the widget.
  document.querySelector<HTMLElement>('#wgrid .wg[data-type="notif"] .ntl a')?.focus();
}

// ---- the notifications bell (render session 70, siteBell.ts) -------------------
let bell: BellState = emptyBell();
let bellRungAt = 0;
/** Each panel read gets a number; an answer to an older one is dropped (a
 * filter pressed twice quickly, or the panel closed meanwhile). */
let bellSeq = 0;

/** The bell button (count, accessible name, the swing for a new one) and,
 * when open, the panel. Focus inside the panel stays on the same control
 * across the redraw (or on `focusAfter`, or the heading). */
function drawBell(focusAfter?: string): void {
  const btn = document.getElementById("bell-btn");
  const panel = document.getElementById("bell-panel");
  if (!btn || !panel) return;
  const b = bellButton(bell);
  if (btn.innerHTML !== b.html) btn.innerHTML = b.html;
  btn.setAttribute("aria-label", b.label);
  btn.title = b.label;
  btn.setAttribute("aria-expanded", String(bell.open));
  if (bell.rings > bellRungAt) {
    bellRungAt = bell.rings;
    btn.classList.remove("ring");
    void btn.offsetWidth;
    btn.classList.add("ring");
    window.setTimeout(() => btn.classList.remove("ring"), 1000);
  }
  if (!bell.open) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  // Under the bell: the panel's right edge a little past the bell's.
  const r = btn.getBoundingClientRect();
  panel.style.setProperty("--br", `${Math.max(12, Math.round(window.innerWidth - r.right - 8))}px`);
  const active = document.activeElement as HTMLElement | null;
  const keyOf = (el: HTMLElement) => `${el.dataset.act ?? ""}|${el.dataset.nid ?? ""}|${el.dataset.kind ?? ""}|${el.closest("[data-nid]")?.getAttribute("data-nid") ?? ""}`;
  const had = active && panel.contains(active) ? keyOf(active) : null;
  const scroll = panel.querySelector(".bl-scroll")?.scrollTop ?? 0;
  const fac = new Map((state.home.collection?.cards ?? []).map((x) => [x.cardId, x.faction]));
  panel.innerHTML = bellPanelHtml(bell, { now: Date.now(), miniCard: (c) => miniCard(c), factionOf: (id) => fac.get(id) ?? null });
  panel.hidden = false;
  const sc = panel.querySelector(".bl-scroll");
  if (sc) sc.scrollTop = scroll;
  const want = focusAfter ? panel.querySelector<HTMLElement>(focusAfter) : had !== null ? [...panel.querySelectorAll<HTMLElement>("button, a, h2")].find((el) => keyOf(el) === had) ?? null : null;
  if (want) want.focus({ preventScroll: true });
  else if (had !== null || focusAfter) panel.querySelector<HTMLElement>("#bell-title")?.focus({ preventScroll: true });
}

/** A count read for the badge (the status poll, `limit=1`), or any page
 * the widget read: the two always agree. If a new one came in while the
 * panel is open, the panel reads its newest page again. */
function bellCounts(page: SiteNotifications): void {
  const before = bell.latestId;
  bell = withCounts(bell, page);
  drawBell();
  if (bell.open && !bell.loading && bell.latestId !== null && bell.latestId !== before && before !== null) void bellRead(false, true);
}
async function pollBell(): Promise<void> {
  if (!state.session) return;
  try {
    bellCounts(await api.notifications(state.session.token, 1));
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) throw err;
  }
}

/** Reads the panel's page for the filter: the first (`append` false), an
 * older one, or (`merge`) the newest again into what is shown. Then marks
 * what it shows read. */
async function bellRead(append: boolean, merge = false): Promise<void> {
  if (!state.session || !bell.open) return;
  const seq = ++bellSeq;
  const before = append ? bell.items[bell.items.length - 1]?.notificationId ?? null : null;
  if (append) bell = { ...bell, loadingMore: true };
  else if (!merge) bell = { ...bell, loading: true, error: null };
  drawBell();
  try {
    const page = await api.notifications(state.session.token, BELL_PAGE, { before, kind: bell.filter });
    if (seq !== bellSeq || !bell.open) return;
    bell = withPage(bell, page, append || merge);
  } catch (err) {
    if (seq !== bellSeq || !bell.open) return;
    if (err instanceof SiteApiError && err.signedOut) return fail(err);
    bell = { ...bell, loading: false, loadingMore: false, error: err instanceof SiteApiError ? errorText(err.status, err.message) : "something went wrong" };
    drawBell();
    return;
  }
  drawBell();
  await bellMarkShown();
}

/** The owner's rule (2026-11-12): the bell marks what its panel shows. Only
 * the shown ids; they stay "New" until the panel closes. */
async function bellMarkShown(): Promise<void> {
  const ids = unreadShown(bell);
  if (!ids.length || !state.session) return;
  try {
    const r = await api.markNotificationsRead(state.session.token, { ids });
    bell = withRead(bell, ids, r.unread, new Date().toISOString());
  } catch (err) {
    // A 404: one was cleared elsewhere meanwhile; the next read settles it.
    if (err instanceof SiteApiError && err.signedOut) return fail(err);
  }
  drawBell();
  if (state.page === "home") void loadHome(["notif"]);
}

function openBell(): void {
  if (bell.open) return;
  const menu = document.getElementById("acct-menu");
  if (menu) menu.hidden = true;
  document.getElementById("acct-btn")?.setAttribute("aria-expanded", "false");
  bell = { ...bell, open: true };
  drawBell("#bell-title");
  void bellRead(false);
}
function closeBell(refocus: boolean): void {
  if (!bell.open) return;
  bellSeq++;
  bell = bellClosed(bell);
  drawBell();
  if (refocus) document.getElementById("bell-btn")?.focus();
}

async function bellClear(ids: number[] | "all"): Promise<void> {
  if (!state.session || bell.busy) return;
  if (ids === "all" && !(await confirmDialog("Clear every notification?", "They leave the bell and the Notifications widget for good. Your matches, packs and cards stay as they are.", "Clear all"))) return;
  // Focus moves to the next one down (or the one above, or the heading).
  let focusAfter = "#bell-title";
  if (ids !== "all") {
    const i = bell.items.findIndex((n) => n.notificationId === ids[0]);
    const next = bell.items[i + 1] ?? bell.items[i - 1];
    if (next) focusAfter = `.bl-x[data-nid="${next.notificationId}"]`;
  }
  bell = { ...bell, busy: true };
  drawBell();
  try {
    const r = await api.clearNotifications(state.session.token, ids === "all" ? { all: true } : { ids });
    bell = withCleared(bell, ids, r.unread);
    toast(ids === "all" ? "Notifications cleared." : "Cleared.");
  } catch (err) {
    bell = { ...bell, busy: false };
    fail(err);
  }
  drawBell(focusAfter);
  if (state.page === "home") void loadHome(["notif"]);
  // The page emptied but there are older ones: read the newest again.
  if (bell.open && !bell.items.length && bell.more) void bellRead(false);
}

async function bellReadAll(): Promise<void> {
  if (!state.session || bell.busy) return;
  bell = { ...bell, busy: true };
  drawBell();
  try {
    const r = await api.markNotificationsRead(state.session.token, { all: true });
    bell = withRead(bell, "all", r.unread, new Date().toISOString());
  } catch (err) {
    bell = { ...bell, busy: false };
    fail(err);
  }
  drawBell("#bell-title");
  if (state.page === "home") void loadHome(["notif"]);
}

// Registered before the page's own click handler: the bell's controls are
// handled here and go no further.
document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest("#bell-btn")) {
    e.stopImmediatePropagation();
    return bell.open ? closeBell(false) : openBell();
  }
  const a = t.closest("[data-act]") as HTMLElement | null;
  const act = a?.dataset.act ?? "";
  if (act === "bell-open") {
    e.preventDefault();
    e.stopImmediatePropagation();
    return openBell();
  }
  if (act.startsWith("bell-") && t.closest("#bell-panel")) {
    // A link (a notice, Settings) goes where it says; the panel closes.
    if (act === "bell-go") return closeBell(false);
    e.stopImmediatePropagation();
    if ((a as HTMLButtonElement).disabled) return;
    if (act === "bell-filter") {
      const k = (a!.dataset.kind || null) as SiteNotificationKind | null;
      if (k === bell.filter) return;
      bell = { ...bell, filter: k, items: [], more: false };
      return void bellRead(false);
    }
    if (act === "bell-older") return void bellRead(true);
    if (act === "bell-retry") return void bellRead(false);
    if (act === "bell-read-all") return void bellReadAll();
    if (act === "bell-clear") return void bellClear([Number(a!.dataset.nid)]);
    if (act === "bell-clear-all") return void bellClear("all");
    return;
  }
  // A click anywhere else closes it (not the Clear all confirmation). A
  // target no longer in the page was inside something that redrew itself
  // first (the confirmation's buttons empty it): not a click outside.
  if (bell.open && t.isConnected && !t.closest("#bell-panel") && !t.closest("#dialog")) closeBell(false);
});
document.addEventListener("keydown", (e) => {
  if (!bell.open || e.defaultPrevented) return;
  if (e.key === "Escape") {
    e.preventDefault();
    return closeBell(true);
  }
  // The panel sits after the top bar in the page: Tab from the bell goes
  // into it, and Shift+Tab from its heading back to the bell.
  if (e.key !== "Tab") return;
  const t = e.target as HTMLElement;
  if (t.id === "bell-btn" && !e.shiftKey) {
    e.preventDefault();
    document.querySelector<HTMLElement>("#bell-title")?.focus();
  } else if (t.id === "bell-title" && e.shiftKey) {
    e.preventDefault();
    document.getElementById("bell-btn")?.focus();
  }
});
// Tabbing out of the panel closes it, as a click outside does.
document.addEventListener("focusin", (e) => {
  const t = e.target as HTMLElement;
  if (bell.open && !t.closest("#bell-panel") && !t.closest("#bell-btn") && !t.closest("#dialog")) closeBell(false);
});

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

/** Reads the Stats page: the stats under the page's filter and the ladder
 * (both at once; one failing leaves the other drawn). A filter change
 * while a read is out wins: the older answer is dropped. */
let statsAsk = 0;
async function loadStats(): Promise<void> {
  if (!state.session) return;
  const token = state.session.token;
  const st = state.stats;
  const ask = ++statsAsk;
  st.loading = true;
  if (state.page === "stats") redrawStats();
  // The history's newest page says which matches have a replay (the stats' recent rows don't).
  const [s, l, h] = await Promise.allSettled([api.stats(token, { agent: st.agent, days: st.days, recent: STATS_RECENT }), api.ladder(token, 100), api.matches(token, 50)]);
  if (ask !== statsAsk) return;
  st.loading = false;
  const why = (r: PromiseRejectedResult) => (r.reason instanceof SiteApiError ? errorText(r.reason.status, r.reason.message) : "Something went wrong.");
  for (const r of [s, l]) if (r.status === "rejected" && r.reason instanceof SiteApiError && r.reason.signedOut) return signedOut("Your session ended. Sign in again.");
  if (s.status === "fulfilled") {
    st.stats = s.value;
    st.error = null;
    // The Rating & form widget reads the same answer (its own filter is all agents, 30 days).
    if (st.agent === null && st.days === 30) state.home.stats = s.value;
  } else {
    // An agent that is no longer the owner's (404): back to all agents.
    if (s.reason instanceof SiteApiError && s.reason.status === 404 && st.agent !== null) {
      st.agent = null;
      return loadStats();
    }
    st.error = why(s);
  }
  if (l.status === "fulfilled") {
    st.ladder = l.value;
    st.ladderError = null;
    state.home.ladder = l.value;
  } else st.ladderError = why(l);
  if (h.status === "fulfilled") st.replays = Object.fromEntries(h.value.matches.map((m) => [m.matchId, m.hasReplay]));
  if (state.page === "stats") redrawStats();
}

/** Redraws the Stats page where it is (the scroll and focus kept). */
function redrawStats(): void {
  if (state.page !== "stats" || state.replay) return;
  const pageEl = $("#page") as HTMLElement;
  const y = pageEl.scrollTop;
  drawPage();
  pageEl.scrollTop = y;
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
    play(P, await withBinderBar(revealOf(answer)));
  } catch (err) {
    // Nothing was opened (or the page couldn't show it: the cards are in
    // the collection either way). Back to the website, with the reason.
    forceClose();
    fail(err);
  } finally {
    inflight = false;
  }
}

/** The set bar for a single pack: the binder read after the open (the
 * cards are already in it). A failed read plays the opening without a bar
 * rather than hold it up. */
async function withBinderBar(r: SiteReveal): Promise<SiteReveal> {
  if (r.kind !== "single" || !state.session) return r;
  try {
    const binder = await api.binder(state.session.token, r.reveal.setCode);
    return withSiteSetBar(r, binder.base);
  } catch {
    return r;
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
      if (state.page === "home") void loadHome(["history", "daily", "rating", "ladder", "stats", "notif"]);
      if (state.page === "stats") void loadStats();
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
  // The live arena's own 2× control (over the arena, beside Close) is tiny: it follows.
  if (state.replay) return drawArenaSpeed();
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
    const data: WidgetData = { play: p, wallet: state.wallet, ...state.home, ownerId: state.me?.ownerId ?? null, viewOf, now: Date.now(), colFilter: state.colFilter, allowance: allowanceOf(p.autoPlay, Date.now()), busy: state.busy, art: shopArt() };
    const { views, capped } = liveViews(widgets);
    for (const w of widgets) {
      if (w.type !== "live" && w.type !== "watch") continue;
      const tile = document.querySelector<HTMLElement>(`#wgrid .wg[data-id="${CSS.escape(w.id)}"]`);
      if (!tile || tile.contains(document.activeElement)) continue;
      const view = views.get(w.id);
      const html = widgetHtml(w, data, { editing: false, live: view, capped: capped.has(w.id), arena: view === "arena" ? tileArenaPick() : undefined });
      if (view === "arena" && patchArenaTile(tile, html)) continue;
      tile.outerHTML = html;
    }
    mountTileArena();
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
  const speed = speedControlHtml(speedControlView(m, state.me?.ownerId ?? null), "m-speed", m.matchId, state.speedBusy);
  return `<div class="m-live-grid"><div class="wcol">${scoreboardHtml(sb)}${speed}${compactBoard(m, sb.near)}${arenaButton(m.matchId)}<p class="muted small">${sb.moves} moves shown. The result counts once the last move has been shown; then the match is in your history below, with its replay on the full board.</p></div><div class="wcol"><h4>Play-by-play</h4><ol class="pbp small" id="m-pbp">${feed}</ol></div></div>`;
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
  return `<div class="pg-wide"><p class="muted small">Every match the ladder is showing now: the featured picks first, then the rest. The eye counts the owners watching a match (its arena or match page open in the last 30 s; this list alone doesn't count).</p><div id="live-list">${liveListHtml()}</div></div>`;
}

/** One live match's card on Watch live. */
function liveCardHtml(live: SiteLive, m: SiteLive["matches"][number], me: string | null): string {
  const sb = scoreboardOf(m, me, viewOf(m.matchId));
  const lines = tidyLines(m.recentLines, { p1: m.p1.agentName, p2: m.p2.agentName }).slice(-3);
  const sv = speedControlView(m, me);
  const fast = sv?.pill ? `<span class="pill fast" title="${esc(sv.line || "Playing at 2×")}">${esc(sv.pill)}</span>` : "";
  const rank = topRatedRank(live, m.matchId);
  const why = rank !== null ? `<span class="small muted lc-why">${esc(topRatedWhy(m))}</span>` : "";
  const tags = `<div class="lc-tags">${topRatedHtml(live, m)}${sb.mine ? '<span class="pill on">Your agent</span>' : ""}${fast}${why}<span class="lc-sp"></span>${viewersHtml(m.viewers)}</div>`;
  return `<section class="panel dark live-card${rank !== null ? " top" : ""}" data-match="${esc(m.matchId)}">${tags}${sb.mine ? "" : watchAsHtml(sb, "wa-live")}${scoreboardHtml(sb)}${compactBoard(m, sb.near)}<ol class="pbp small">${lines.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>${arenaButton(m.matchId)}</section>`;
}

/** Watch live's list (render session 71): the server's featured groups
 * (Tournament when there is one, Top rated), then every other live match. */
function liveListHtml(): string {
  const live = state.home.live;
  if (!live) return state.home.errors.live ? `<section class="panel glass"><p class="muted small">Couldn't read the live matches: ${esc(state.home.errors.live)}</p></section>` : `<section class="panel glass"><p class="muted small">Loading…</p></section>`;
  if (!live.running) return `<section class="panel glass"><p class="muted small">The ladder isn't running on this server, so nothing is live.</p></section>`;
  if (!live.matches.length) return `<section class="panel glass"><p class="muted small">No match is live right now. The next ladder round starts soon.</p></section>`;
  const me = state.me?.ownerId ?? null;
  const g = liveGroups(live);
  const group = (id: string, title: string, note: string, ms: typeof live.matches) =>
    ms.length ? `<section class="lgroup" aria-labelledby="lg-${id}"><div class="lg-h"><h3 id="lg-${id}">${esc(title)} <small class="muted">${ms.length}</small></h3><p class="muted small">${esc(note)}</p></div><div class="lg-cards">${ms.map((m) => liveCardHtml(live, m, me)).join("")}</div></section>` : "";
  const topNote = "Both sides out of placement, ranked by the weaker side's rating as the match started: a match is only as top as its weaker player.";
  const noTop = g.topRated.length ? "" : `<p class="muted small lg-none">No Top rated match right now: every live match has a side still in placement.</p>`;
  return group("tour", "Tournament", "The tournament's matches.", g.tournament)
    + group("top", "Top rated", topNote, g.topRated)
    + noTop
    + group("rest", g.tournament.length || g.topRated.length ? "Also live" : "Live now", "In the order the round started them.", g.rest);
}

/** Auto-play on or off; `minutes` (15 / 30 / 60) turns it on with a
 * play-time allowance and `add` puts +15 / +30 on a running one (render 58,
 * on game session 76's allowance). */
async function setAutoPlay(on: boolean, time?: { minutes: number; add: boolean }): Promise<void> {
  if (!state.session || !state.play || state.autoBusy) return;
  state.autoBusy = true;
  const focusId = (document.activeElement as HTMLElement | null)?.id ?? "";
  try {
    const r = time?.add
      ? await api.addPlayTime(state.session.token, time.minutes)
      : await api.setAutoPlay(state.session.token, on, time?.minutes);
    state.play = { ...state.play, autoPlay: r.autoPlay };
    const al = r.autoPlay.allowance;
    toast(time?.add ? `+${time.minutes} min: ${al ? `${al.minutesLeft} min left today` : "added"}.`
      : time ? `Your agent plays for ${al ? al.minutesLeft : time.minutes} min${al?.endsAtReset ? " (to midnight, Sydney)" : ""}, then finishes its match and stops.`
      : r.autoPlay.on ? "Auto-play is on: your agent joins the next ladder round." : "Auto-play is off. A match already live finishes.");
  } catch (err) {
    fail(err);
  } finally {
    state.autoBusy = false;
  }
  drawAgentCard();
  if (!dragging) drawPage();
  if (focusId) document.getElementById(focusId)?.focus();
}

/** "Ask for 2×" / take it back / agree (render session 56): sent, then the
 * live view's answer drawn wherever the match shows. The server's refusal
 * (409 for a house account, 404 once it has ended) is said in its words. */
async function setLiveSpeed(matchId: string, ask: boolean): Promise<void> {
  if (!state.session || state.speedBusy) return;
  state.speedBusy = true;
  const focusId = (document.activeElement as HTMLElement | null)?.id ?? "";
  drawLive();
  try {
    const r = await api.setLiveSpeed(state.session.token, matchId, ask);
    const live = state.home.live;
    if (live) live.matches = live.matches.map((m) => (m.matchId === matchId ? { ...m, speed: r.speed, nextAt: r.nextAt } : m));
    toast(r.speed.rate === 2 ? "Playing at 2×." : ask ? "Asked for 2×: it starts when the other owner agrees." : "Back to 1×.");
    // The arena hears the new pace at once, not at its next read.
    if (arenaLive && state.replay === matchId) replayFrame?.contentWindow?.postMessage({ type: "ai-tcg-live", frames: [], ended: false, record: null, rate: r.speed.rate }, location.origin);
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    fail(err);
  } finally {
    state.speedBusy = false;
  }
  drawLive();
  if (focusId) document.getElementById(focusId)?.focus();
}

/** The 2× control over the live arena, on the viewer's own match only. */
function drawArenaSpeed(): void {
  const box = document.getElementById("rp-speed");
  if (!box || !arenaLive || !state.replay) return;
  const m = state.home.live?.matches.find((x) => x.matchId === state.replay) ?? null;
  const v = m ? speedControlView(m, state.me?.ownerId ?? null) : null;
  const html = v && v.canVote ? speedControlHtml(v, "rp-speed-btn", m!.matchId, state.speedBusy) : "";
  if (box.contains(document.activeElement) && box.innerHTML === html) return;
  const focused = box.contains(document.activeElement);
  box.innerHTML = html;
  if (focused) document.getElementById("rp-speed-btn")?.focus();
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
  const { mine, m } = arenaSeats(matchId);
  return arenaHash(matchId, mine, m?.defaultView);
}
/** A live match's seats for the viewer: their own agent's (or null) and
 * the side the arena puts near. */
function arenaSeats(matchId: string): { mine: "p1" | "p2" | null; near: "p1" | "p2"; m: SiteLive["matches"][number] | null } {
  const m = state.home.live?.matches.find((x) => x.matchId === matchId) ?? null;
  const me = state.me?.ownerId ?? null;
  const mine = m && me ? (m.p1.ownerId === me ? "p1" : m.p2.ownerId === me ? "p2" : null) : null;
  return { mine, near: nearSeat(mine, viewOf(matchId), m?.defaultView), m };
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
  teardownTileArena();
  replayFrom = from;
  const el = $("#replay");
  el.innerHTML = `<div class="op-wait">Joining the match…</div><div class="rp-speed" id="rp-speed"></div><button type="button" class="rp-close" data-act="close-replay">Close</button>`;
  el.hidden = false;
  liquid?.refresh();
  (el.querySelector(".rp-close") as HTMLElement).focus();
  try {
    const page = await api.livePage(state.session.token, matchId);
    if (state.replay !== matchId) return;
    arenaLive = { key: page.key, have: page.released + 1, poll: 0, ended: false };
    drawArenaSpeed();
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
  if (!live) return;
  await feedLive(live, () => (arenaLive === live ? replayFrame : null), () => document.getElementById("rp-speed")?.replaceChildren());
}

/** One live arena frame's feeding (the full-screen one, render session 51,
 * and the Watch live tile's, 67): the new frames since the last read, every
 * 3 s (15 s in a hidden tab), until the host says the match was recorded.
 * `frameOf` answers null once that frame is closed or replaced. */
interface LiveFeed { key: string; have: number; poll: number; ended: boolean }
async function feedLive(live: LiveFeed, frameOf: () => HTMLIFrameElement | null, onEnd: () => void): Promise<void> {
  if (!state.session || !frameOf()) return;
  clearTimeout(live.poll);
  try {
    const r = await api.liveFrames(state.session.token, live.key, live.have);
    const frame = frameOf();
    if (!frame?.contentWindow) return;
    live.have += r.frames.length;
    live.ended = r.ended;
    // `rate` (render session 56): the pace the server releases at now (the 2× vote).
    if (r.frames.length || r.ended || r.record || r.rate) frame.contentWindow.postMessage({ type: "ai-tcg-live", frames: r.frames, ended: r.ended, record: r.record, rate: r.rate ?? 1 }, location.origin);
    if (r.ended) onEnd();
  } catch (err) {
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    if (err instanceof SiteApiError && err.status === 404) return; // the page expired: Close and open it again
  }
  if (frameOf() && !live.ended) live.poll = window.setTimeout(() => void feedLive(live, frameOf, onEnd), document.hidden ? 15000 : 3000);
}

// ---- the Watch live tile's arena (render session 67) ----------------------
// Watch live at L embeds the live match on the real arena (the brief's
// table): the same live page the full-screen view opens, in its embed mode
// (renderHtml.ts: no controls, no feed, silent), laid out 1180 px wide and
// scaled into the tile (siteTileArena.ts). One per board. Home redraws
// around the frame (patchAround), since a removed or moved iframe reloads.
// It isn't made on a phone (the compact board stands in), while
// customising, or while a full-screen arena or replay is open (one arena
// at a time; closing it brings the tile's back).

/** The match the tile holds (its result is held a moment after it ends). */
let heldArena: HeldArena | null = null;
let tileArena: { matchId: string; frame: HTMLIFrameElement; feed: LiveFeed | null; near: "p1" | "p2"; loaded: boolean; failed: boolean } | null = null;
let tileObserver: ResizeObserver | null = null;
let tileSwap = 0;
const phoneQuery = window.matchMedia ? window.matchMedia("(max-width: 720px)") : null;
phoneQuery?.addEventListener?.("change", () => mountTileArena());

/** Which match the tile shows now, remembering when the held one left the
 * live list. */
function tileArenaPick(): { matchId: string; ended: boolean } | null {
  // Watch live's order (render session 71): with nothing held, the top pick.
  const ids = (state.home.live ? liveOrder(state.home.live) : []).map((m) => m.matchId);
  const now = Date.now();
  if (heldArena && !ids.includes(heldArena.matchId) && heldArena.goneAt === null) heldArena.goneAt = now;
  const pick = arenaPick(heldArena, ids, now);
  if (pick && heldArena?.matchId !== pick.matchId) heldArena = { matchId: pick.matchId, ended: false, endedAt: null, goneAt: null };
  if (!pick) heldArena = null;
  return pick;
}

/** Home redrawn around the tile's frame; false: the plain redraw (no
 * frame, or the tile now shows another match). */
function keepTileArena(page: HTMLElement, html: string): boolean {
  const t = tileArena;
  const keep = t?.frame.parentElement;
  if (!t || !keep || !page.contains(keep)) return false;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  if (tpl.content.querySelector(".wl-arena")?.getAttribute("data-match") !== t.matchId) return false;
  return patchAround(page, tpl.content, keep);
}

/** The Watch live tile redrawn around its frame (drawLive's 3 s redraw). */
function patchArenaTile(tile: HTMLElement, html: string): boolean {
  const t = tileArena;
  const keep = t?.frame.parentElement;
  if (!t || !keep || !tile.contains(keep)) return false;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const next = tpl.content.firstElementChild;
  if (!next || next.querySelector(".wl-arena")?.getAttribute("data-match") !== t.matchId) return false;
  if (!patchAround(tile, next, keep)) return false;
  syncAttributes(tile, next);
  return true;
}

function teardownTileArena(): void {
  tileObserver?.disconnect();
  tileObserver = null;
  const t = tileArena;
  if (!t) return;
  tileArena = null;
  if (t.feed) clearTimeout(t.feed.poll);
  const slot = t.frame.closest<HTMLElement>(".wl-arena");
  slot?.classList.remove("on", "joining");
  t.frame.remove();
}

/** After every Home draw: the frame made, kept, or taken down. */
function mountTileArena(): void {
  const slot = state.page === "home" && !state.draft && !state.replay && !phoneQuery?.matches ? document.querySelector<HTMLElement>("#wgrid .wl-arena[data-match]") : null;
  const matchId = slot?.dataset.match ?? null;
  if (!slot || !matchId) return teardownTileArena();
  if (tileArena && tileArena.matchId === matchId && slot.contains(tileArena.frame)) return syncTileArena();
  teardownTileArena();
  // A match already over (held, its frame gone with a full redraw) isn't joined again.
  if (slot.dataset.ended === "true") return;
  startTileArena(slot, matchId);
}

function startTileArena(slot: HTMLElement, matchId: string): void {
  if (!state.session) return;
  const frame = document.createElement("iframe");
  frame.title = "The live match on the arena";
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  slot.querySelector(".wl-frame")!.appendChild(frame);
  const t: NonNullable<typeof tileArena> = { matchId, frame, feed: null, near: arenaSeats(matchId).near, loaded: false, failed: false };
  tileArena = t;
  syncTileArena();
  const token = state.session.token;
  api.livePage(token, matchId).then((page) => {
    if (tileArena !== t) return;
    const feed: LiveFeed = { key: page.key, have: page.released + 1, poll: 0, ended: false };
    t.feed = feed;
    frame.addEventListener("load", () => {
      if (tileArena !== t) return;
      t.loaded = true;
      syncTileArena();
      void feedLive(feed, () => (tileArena === t ? t.frame : null), () => tileArenaEnded(matchId));
    }, { once: true });
    const { mine } = arenaSeats(matchId);
    frame.src = `${page.url}#view=${t.near}&switch=${mine ? 0 : 1}&embed=1`;
  }).catch((err: unknown) => {
    if (tileArena !== t) return;
    if (err instanceof SiteApiError && err.signedOut) return signedOut("Your session ended. Sign in again.");
    // 404: it ended between the list and the read; 409: not started yet.
    // The compact board stays; the next match (or the next redraw) tries again.
    t.failed = true;
    syncTileArena();
  });
}

/** The tile's match was recorded: its result and boast play, held a
 * moment, then the next live match takes the tile. */
function tileArenaEnded(matchId: string): void {
  if (heldArena?.matchId === matchId && !heldArena.ended) {
    heldArena.ended = true;
    heldArena.endedAt = Date.now();
  }
  clearTimeout(tileSwap);
  tileSwap = window.setTimeout(() => drawLive(), TILE_ARENA_HOLD_END_MS + 200);
}

/** The frame's state on its slot, its scale, and the side near. */
function syncTileArena(): void {
  const t = tileArena;
  const slot = t?.frame.closest<HTMLElement>(".wl-arena");
  if (!t || !slot) return;
  slot.classList.toggle("on", t.loaded);
  slot.classList.toggle("joining", !t.loaded && !t.failed);
  const fit = () => {
    const f = arenaFit(slot.clientWidth, slot.clientHeight);
    t.frame.style.width = `${f.width}px`;
    t.frame.style.height = `${f.height}px`;
    t.frame.style.transform = `scale(${f.scale})`;
  };
  fit();
  if (!tileObserver && typeof ResizeObserver !== "undefined") {
    tileObserver = new ResizeObserver(() => {
      if (tileArena === t && slot.isConnected) fit();
    });
    tileObserver.observe(slot);
  }
  // The tile's "Watch as": the arena flips (it waits for Match Boot or a boast).
  const seats = arenaSeats(t.matchId);
  if (seats.m && seats.near !== t.near && t.loaded) {
    t.near = seats.near;
    t.frame.contentWindow?.postMessage({ type: "ai-tcg-set-view", view: seats.near }, location.origin);
  }
}

/** A replay full screen: the host rebuilds the match from the server's
 * replay file and the arena replay page plays it in a frame. */
async function openReplay(matchId: string, from: HTMLElement | null): Promise<void> {
  if (!state.session || state.replay) return;
  state.replay = matchId;
  teardownTileArena();
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

// The personality dial's arrow keys (render session 59): the notches are a
// radio group with one tab stop; an arrow chooses the next style. Since
// render 69 (a hardening pass) the choice shows at once and is saved once
// the keys stop (DIAL_SAVE_MS), on Enter or Space, or when focus leaves the
// dial: arrowing across three styles had made three saves and three toasts
// (and an arrow during a save was dropped).
let dialPending: { agent: string; style: string; timer: ReturnType<typeof setTimeout> | null } | null = null;

/** The dial's look moved to `style` in place, before it is saved. */
function previewDial(knob: Element, style: string): void {
  const v = state.play ? dialView(state.play, null) : null;
  if (!v) return;
  const c = dialChoose(v, style);
  for (const b of knob.querySelectorAll<HTMLElement>('[data-act="play-style"]')) {
    const on = b.dataset.style === style;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
  }
  const face = knob.querySelector<HTMLElement>(".dn-face i");
  if (face) face.style.transform = `rotate(${c.angle}deg)`;
  const txt = knob.parentElement?.querySelector(".dn-txt");
  const name = txt?.querySelector("b");
  if (name) name.textContent = c.current.name;
  const sum = txt?.querySelector("span.small:not(.muted)");
  if (sum) sum.textContent = c.current.summary;
}

/** Saves the dial's pending choice now (if it differs from the saved one). */
function flushDial(): void {
  const p = dialPending;
  if (!p) return;
  if (p.timer) clearTimeout(p.timer);
  if (state.busy) {
    p.timer = setTimeout(flushDial, 250);
    return;
  }
  dialPending = null;
  if (p.style !== state.play?.connectedAgent?.playStyle) void saveStyle(p.agent, p.style);
}

function saveStyle(agent: string, style: string): Promise<void> {
  const name = state.play?.playStyles.find((x) => x.id === style)?.name ?? style;
  return savePlay((tok) => api.setPlayStyle(tok, agent, style), `${name} from the next match.`).then(() => focusAct("play-style", "style", style));
}

document.addEventListener("keydown", (e) => {
  const stop = (e.target as HTMLElement).closest?.('[data-act="play-style"]') as HTMLElement | null;
  if (!stop || !state.play || e.altKey || e.ctrlKey || e.metaKey) return;
  if (dialPending && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    flushDial();
    return;
  }
  const ids = state.play.playStyles.map((x) => x.id);
  const from = dialPending?.style ?? stop.dataset.style ?? "";
  const next = dialKeyTarget(ids, from, e.key);
  if (!next) return;
  e.preventDefault();
  const knob = stop.closest(".dn-knob");
  if (!knob || !stop.dataset.agent) return;
  previewDial(knob, next);
  knob.querySelector<HTMLElement>(`[data-act="play-style"][data-style="${CSS.escape(next)}"]`)?.focus();
  if (dialPending?.timer) clearTimeout(dialPending.timer);
  dialPending = { agent: stop.dataset.agent, style: next, timer: setTimeout(flushDial, DIAL_SAVE_MS) };
});
// Focus leaving the dial saves what it shows (a Tab away, a click elsewhere).
document.addEventListener("focusout", (e) => {
  if (!dialPending) return;
  const knob = (e.target as HTMLElement).closest?.(".dn-knob");
  const to = e.relatedTarget as HTMLElement | null;
  if (knob && !(to && knob.contains(to))) flushDial();
});

// ---- actions ----------------------------------------------------------------
/** `act` under another name, for the click handler (where `act` is the
 * clicked element's data-act). */
function savePlay(fn: (token: string) => Promise<SitePlay>, ok?: string): Promise<void> {
  return act(fn, ok);
}

/** Puts focus back on a widget's button after the board is redrawn. */
function focusAct(act: string, key: string, value: string): void {
  (document.querySelector(`[data-act="${act}"][data-${key}="${CSS.escape(value)}"]`) as HTMLElement | null)?.focus();
}

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
    if (act === "notif-read") return void markAllRead();
    if (act === "dress" && actEl.dataset.agent) return void openDress(actEl.dataset.agent, actEl);
    if (act === "auto-play") return void setAutoPlay(actEl.dataset.on === "1");
    if (act === "play-time" && actEl.dataset.min) return void setAutoPlay(true, { minutes: Number(actEl.dataset.min), add: actEl.dataset.add === "1" });
    // Render session 57: Agent controls' personality dial and deck switcher.
    if (act === "play-style" && actEl.dataset.agent && actEl.dataset.style) {
      // A click saves at once; it takes over any arrow-key choice still waiting.
      if (dialPending?.timer) clearTimeout(dialPending.timer);
      dialPending = null;
      if (actEl.dataset.style === state.play?.connectedAgent?.playStyle) {
        const knob = actEl.closest(".dn-knob");
        if (knob) previewDial(knob, actEl.dataset.style);
        return;
      }
      return void saveStyle(actEl.dataset.agent, actEl.dataset.style);
    }
    if (act === "ctl-deck" && actEl.dataset.deck) {
      if (actEl.getAttribute("aria-pressed") === "true") return;
      const v = actEl.dataset.deck;
      return void savePlay((tok) => (v === "agent" ? api.setDeckChoice(tok, "agent") : api.setActiveDeck(tok, v)), v === "agent" ? "Your agent picks its deck from the next match." : "That deck plays from the next match.").then(() => focusAct("ctl-deck", "deck", v));
    }
    if (act === "live-speed" && actEl.dataset.match) return void setLiveSpeed(actEl.dataset.match, actEl.dataset.ask === "1");
    if (act === "ask-2x-every") return void setAsk2xEvery(actEl.dataset.on === "1");
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
    if (act === "retry-shop") return void loadShop();
    if (act === "retry-col") return void loadCollection();
    if (act === "retry-stats") return void loadStats();
    if (act === "stats-recent") {
      state.stats.allRecent = !state.stats.allRecent;
      return redrawStats();
    }
    if (act === "stats-agent") {
      const id = actEl.dataset.agent || null;
      if (id === state.stats.agent) return;
      state.stats.agent = id;
      return void loadStats();
    }
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
    else if (group === "stats-days") {
      state.stats.days = Number(v) as StatsDays;
      void loadStats();
    }
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
