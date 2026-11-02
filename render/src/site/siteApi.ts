// The owner website's client for the owner API (Season 0 render item 1,
// render session 44). The contract is server/OWNER_API.md, written by the
// game lane; this file is the render lane's reading of it and nothing
// more: it sends the requests that document names and hands back what the
// server answered. No rule is copied here (every rule is the store's).
//
// Browser-safe: no DOM and no Node, only `fetch`, which the caller passes
// in (the page passes `window.fetch`; the tests pass Node's against a real
// owner API on a real port). The page bundles this file with esbuild.
//
// Session 46 (Home as the widget board): the board (`GET`/`PUT /api/board`)
// and what its widgets read: packs (and buying them), the collection, the
// store (and buying a cosmetic), today's earnings.
//
// Session 47 (the Store page and pack opening on the site): opening packs
// (one, ten or a chosen one) and the owner's free daily pack (read and
// claim).

import type { SiteBinder, SiteCopy, SiteDeckShortfall, SiteHoldings, SiteSalvagePlan } from "./siteCollection.js";
import type { BulkOpening, PackOpening } from "@ai-tcg/economy";
import type { SiteCosmeticItem, SiteLoadout, SiteOwnedCosmetic } from "./siteLoadout.js";
import type { SiteBoard, SiteCollection, SiteDaily, SitePacks, SiteWidget } from "./siteBoard.js";

/** A faction the owner can lock the agent to (OWNER_API.md, the play settings). */
export type SiteFaction = "Cortex" | "Swarm" | "Aegis" | "Null";

export interface SiteDeck {
  deckId: string;
  name: string;
  ownerId: string;
  active: boolean;
  complete: boolean;
  missing: { cardId: string; uses: number; owned: number }[];
  cards: number;
}

export interface SiteAgent {
  agentId: string;
  name: string;
  playStyle: string;
}

export interface SiteRebuildJob {
  jobId: number;
  state: "running" | "done" | "failed";
  startedAt: string;
  finishedAt: string | null;
  reasons: string[];
  result: {
    deckId: string;
    faction: SiteFaction;
    style: string;
    cards: number;
    factions: { faction: SiteFaction; winRate: number | null; infeasible: string | null }[];
  } | null;
  error: string | null;
}

/** `GET /api/play`, as OWNER_API.md writes it. */
export interface SitePlay {
  deckChoice: "agent" | "forced";
  factionLock: SiteFaction | null;
  lockableFactions: SiteFaction[];
  activeDeck: SiteDeck | null;
  agentDeck: (SiteDeck & { builtFrom: { style: string; factionLock: SiteFaction | null } | null }) | null;
  rebuild: { reasons: string[]; job: SiteRebuildJob | null };
  connectedAgent: SiteAgent | null;
  agents: SiteAgent[];
  playStyles: { id: string; name: string; summary: string }[];
  decks: SiteDeck[];
  liveMatch: { matchId: string; startedAt: string } | null;
  /** The auto-play switch (session 67; read by the site from render session 50). */
  autoPlay: SiteAutoPlay;
  /** Only on the faction-lock answer. */
  activeDeckFits?: boolean;
}

/** Auto-play (OWNER_API.md "Auto-play", session 67). */
export interface SiteAutoPlay {
  on: boolean;
  changedAt: string | null;
  stopped: { reason: string; day: string } | null;
  dailyRewardsMaxed: boolean;
  canTurnOn: boolean;
  house: boolean;
}

/** One side of a live match, as it started (OWNER_API.md LiveSideView). */
export interface SiteLiveSide {
  ownerId: string;
  ownerName: string;
  agentId: string;
  agentName: string;
  playStyle: string;
  rating: number;
  tier: string;
}

/** One side of the board now (OWNER_API.md PublicSide): counts only for
 * the hand, deck and graveyard. */
export interface SitePublicSide {
  name: string;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  hand: number;
  deck: number;
  graveyard: number;
  board: { instanceId: string; cardId: string; name: string; attack: number; health: number; maxHealth: number; pending: boolean; tools: string[] }[];
  directives: { instanceId: string; cardId: string; name: string }[];
  signature: { name: string; played: boolean } | null;
}

export interface SitePublicSnapshot {
  turn: number;
  activePlayer: "p1" | "p2";
  priority: "p1" | "p2";
  stack: number;
  winner: "p1" | "p2" | "draw" | null;
  p1: SitePublicSide;
  p2: SitePublicSide;
}

/** A live match (OWNER_API.md LiveMatchView). */
export interface SiteLiveMatch {
  matchId: string;
  startedAt: string;
  released: number;
  nextAt: string | null;
  p1: SiteLiveSide;
  p2: SiteLiveSide;
  now: SitePublicSnapshot;
  recentLines: string[];
}

/** `GET /api/live/:matchId?from=N` (OWNER_API.md LiveMatchFeed). Each
 * step's `move` and `events` are the engine's; the page reads `lines`. */
export interface SiteLiveFeed extends SiteLiveMatch {
  start: SitePublicSnapshot | null;
  startLines: string[] | null;
  from: number;
  steps: { n: number; by: "p1" | "p2"; lines: string[]; after: SitePublicSnapshot }[];
}

/** `GET /api/live`. */
export interface SiteLive {
  running: boolean;
  matches: SiteLiveMatch[];
  mine: string | null;
}

export type SiteHistoryResult = "win" | "loss" | "draw" | "cancelled" | "abandonedByYou" | "abandonedByOpponent";

/** One row of `GET /api/matches` (OWNER_API.md HistoryRow). */
export interface SiteHistoryRow {
  matchId: string;
  endedAt: string;
  seat: "p1" | "p2";
  result: SiteHistoryResult;
  credits: number;
  rating: { before: number; after: number; change: number } | null;
  opponent: { ownerId: string; ownerName: string; agentName: string };
  agentName: string;
  turns: number | null;
  hasLog: boolean;
  hasReplay: boolean;
}

export interface SiteHistory {
  matches: SiteHistoryRow[];
  total: number;
  more: boolean;
}

/** One side of a recorded match (OWNER_API.md MatchView). */
export interface SiteMatchSide {
  ownerId: string;
  ownerName: string;
  ownerKind: "player" | "house";
  agentId: string;
  agentName: string;
  credits: number;
  rating: { before: { rating: number; rd: number; volatility: number }; after: { rating: number; rd: number; volatility: number } } | null;
  playStyle: string | null;
}

/** `GET /api/matches/:matchId`. */
export interface SiteMatchView {
  matchId: string;
  endedAt: string;
  outcome: "win" | "draw" | "cancelled" | "abandoned";
  p1: SiteMatchSide;
  p2: SiteMatchSide;
  winnerOwnerId: string | null;
  abandonedByOwnerId: string | null;
  turns: number | null;
  moves: number | null;
  boast: { agentId: string; itemId: string; slot: "boast" | "closeWinBoast" | "factionStarter"; winnerHealth: number | null } | null;
  hasLog: boolean;
  hasReplay: boolean;
}

/** `GET /api/me`. */
export interface SiteMe {
  ownerId: string;
  /** The display name (not the login). */
  name: string;
  username: string | null;
  email: string | null;
  kind: "player" | "house";
  /** true: Settings shows Admin. */
  isAdmin: boolean;
}

export interface SiteAudio {
  on: boolean;
  volume: number;
}

/** `GET /api/account/settings`, saved on the owner's account. */
export interface SiteAccountSettings {
  theme: "system" | "light" | "dark";
  background: string;
  sound: SiteAudio;
  music: SiteAudio;
  skipHintSeen: boolean;
  updatedAt: string | null;
}

/** A `PATCH`: only the fields it names change; sound and music in part. */
export type SiteSettingsPatch = Partial<Pick<SiteAccountSettings, "theme" | "background" | "skipHintSeen">> & {
  sound?: Partial<SiteAudio>;
  music?: Partial<SiteAudio>;
};

/** `GET /api/wallet`. */
export interface SiteWallet {
  credits: number;
  packPoints: number;
  unopenedPacks: { packId: string; ownerId: string; setCode: string; source: string; acquiredAt: string; openedAt: null }[];
}

/** A cosmetic on sale (`GET /api/store`): the catalogue item and `owned`. */
export interface SiteCosmetic extends SiteCosmeticItem {
  owned: boolean;
}

/** `GET /api/store`. */
export interface SiteStore {
  packs: SitePacks["offer"];
  dailyPack: SiteDailyPack;
  cosmetics: SiteCosmetic[];
  wallet: SiteWallet;
}

/** The owner's free daily pack (`GET /api/packs/daily`, session 65): how
 * many wait to be claimed and when the next comes in (midnight Sydney). */
export interface SiteDailyPack {
  setCode: string;
  waiting: number;
  cap: number;
  day: string;
  timeZone: string;
  resetsAt: string;
  /** null while `cap` wait: nothing comes in until one is claimed. */
  nextPackAt: string | null;
  claimedToday: number;
  lastClaimedAt: string | null;
}

/** `POST /api/packs/open`: one store `PackOpening` per pack, and the
 * ten-pack summary (null for one pack). */
export interface SiteOpenAnswer {
  packs: PackOpening[];
  summary: BulkOpening["summary"] | null;
  wallet: SiteWallet;
}
/** What to open: the oldest pack, the ten oldest, or a chosen one. */
export type SiteOpenRequest = { count: 1 | 10 } | { packId: string };

export interface SiteSession {
  token: string;
  ownerId: string;
  expiresAt: string;
}

/** A refusal: the HTTP status and the server's `error` message. Status 0
 * is "the server couldn't be reached" (the request never got an answer). */
export class SiteApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The refusal's whole body (session 48: salvage's 409 carries
     * needsConfirmation and the decks it would leave short). */
    readonly body: unknown = null,
  ) {
    super(message);
  }
  /** The token is gone (expired, signed out, unknown): back to sign-in. */
  get signedOut(): boolean {
    return this.status === 401;
  }
}

type Fetch = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  status: number;
  text(): Promise<string>;
}>;

export interface SiteApi {
  signIn(login: string, password: string): Promise<SiteSession>;
  signOut(token: string): Promise<void>;
  me(token: string): Promise<SiteMe>;
  accountSettings(token: string): Promise<SiteAccountSettings>;
  updateAccountSettings(token: string, patch: SiteSettingsPatch): Promise<SiteAccountSettings>;
  wallet(token: string): Promise<SiteWallet>;
  play(token: string): Promise<SitePlay>;
  setDeckChoice(token: string, choice: "agent" | "forced"): Promise<SitePlay>;
  setFactionLock(token: string, faction: SiteFaction | null): Promise<SitePlay>;
  setActiveDeck(token: string, deckId: string): Promise<SitePlay>;
  setPlayStyle(token: string, agentId: string, style: string): Promise<SitePlay>;
  rebuild(token: string): Promise<SiteRebuildJob>;
  rebuildJob(token: string): Promise<SiteRebuildJob>;
  board(token: string): Promise<SiteBoard>;
  saveBoard(token: string, widgets: SiteWidget[]): Promise<SiteBoard>;
  daily(token: string): Promise<SiteDaily>;
  collection(token: string, recentPacks?: number): Promise<SiteCollection>;
  packs(token: string): Promise<SitePacks & { wallet: SiteWallet }>;
  buyPacks(token: string, setCode: string, count: number): Promise<{ bought: { packId: string }[]; wallet: SiteWallet }>;
  store(token: string): Promise<SiteStore>;
  buyCosmetic(token: string, itemId: string): Promise<{ wallet: SiteWallet }>;
  openPacks(token: string, what: SiteOpenRequest): Promise<SiteOpenAnswer>;
  dailyPack(token: string): Promise<SiteDailyPack>;
  claimDailyPack(token: string): Promise<{ pack: { packId: string; setCode: string; source: string }; dailyPack: SiteDailyPack; wallet: SiteWallet }>;
  // The Collection page (session 48).
  binder(token: string, setCode: string): Promise<SiteBinder>;
  cardHoldings(token: string, cardId: string): Promise<SiteHoldings>;
  salvagePlan(token: string, cardId: string, quantity: number): Promise<SiteSalvagePlan>;
  salvage(token: string, cardId: string, quantity: number, confirmDeckImpact: boolean): Promise<{ packPoints: number; incompleteDecks: SiteDeckShortfall[]; holdings: SiteHoldings; wallet: SiteWallet }>;
  craftCard(token: string, cardId: string): Promise<{ copy: SiteCopy; holdings: SiteHoldings; wallet: SiteWallet }>;
  craftSecret(token: string, code: string): Promise<{ copy: SiteCopy; wallet: SiteWallet }>;
  // The loadout picker in the Store (session 49).
  cosmetics(token: string): Promise<{ owned: SiteOwnedCosmetic[] }>;
  loadout(token: string, agentId: string): Promise<SiteLoadout>;
  setLoadout(token: string, agentId: string, slot: string, itemId: string | null): Promise<SiteLoadout>;
  // The match pages (render session 50).
  setAutoPlay(token: string, on: boolean): Promise<{ autoPlay: SiteAutoPlay }>;
  live(token: string): Promise<SiteLive>;
  /** `GET /api/live/:matchId?from=N`: the match now and the moves released from N on. */
  liveFeed(token: string, matchId: string, from: number): Promise<SiteLiveFeed>;
  matches(token: string, limit?: number, before?: string): Promise<SiteHistory>;
  match(token: string, matchId: string): Promise<SiteMatchView>;
  matchLog(token: string, matchId: string): Promise<string>;
  /** The site host's replay page for a recorded match (siteHost.ts
   * `POST /replay-page/:matchId`): the host reads the replay over the API
   * with the caller's token, rebuilds it in the engine and answers where
   * the full arena page is served. */
  replayPage(token: string, matchId: string): Promise<{ url: string; moves: number; turns: number }>;
  /** The site host's live arena page (render session 51, `POST
   * /live-page/:matchId`): the host reads the live feed from the first move
   * and answers where the page is served, and its key for the frames. */
  livePage(token: string, matchId: string): Promise<{ url: string; key: string; released: number }>;
  /** `GET /live-frames/<key>?from=N`: the arena frames from N on (the host
   * reads only the moves released since its last read); `ended` once the
   * match is recorded, with the record's boast for the arena (`record`, or
   * null when there is none to show). */
  liveFrames(token: string, key: string, from: number): Promise<{ frames: unknown[]; released: number; ended: boolean; record: unknown }>;
}

/** Salvage's refusal when it would leave saved decks short (409): the
 * decks, to put to the owner before sending it again confirmed. */
export function salvageNeedsConfirmation(err: unknown): SiteDeckShortfall[] | null {
  if (!(err instanceof SiteApiError) || err.status !== 409) return null;
  const b = err.body as { needsConfirmation?: unknown; affectedDecks?: unknown } | null;
  return b && b.needsConfirmation === true && Array.isArray(b.affectedDecks) ? (b.affectedDecks as SiteDeckShortfall[]) : null;
}

/** The API at `base` ("" for the page's own origin; the site is served
 * from the same origin as the API, OWNER_API.md "no CORS"). */
export function siteApi(fetchImpl: Fetch, base = ""): SiteApi {
  async function call<T>(method: string, path: string, opts: { token?: string; body?: unknown } = {}): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    let res: Awaited<ReturnType<Fetch>>;
    try {
      res = await fetchImpl(base + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    } catch {
      throw new SiteApiError(0, "the server can't be reached");
    }
    const text = await res.text();
    let body: unknown = null;
    if (text !== "") {
      try {
        body = JSON.parse(text);
      } catch {
        throw new SiteApiError(res.status || 502, "the server's answer wasn't JSON");
      }
    }
    if (res.status >= 400) {
      const message = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : `HTTP ${res.status}`;
      throw new SiteApiError(res.status, message, body);
    }
    return body as T;
  }
  /** A plain-text answer (the match log); a refusal is still JSON. */
  async function text(method: string, path: string, token: string): Promise<string> {
    let res: Awaited<ReturnType<Fetch>>;
    try {
      res = await fetchImpl(base + path, { method, headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new SiteApiError(0, "the server can't be reached");
    }
    const body = await res.text();
    if (res.status >= 400) {
      let message = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(body) as { error?: unknown };
        if (typeof j.error === "string") message = j.error;
      } catch {
        /* not JSON: keep the status */
      }
      throw new SiteApiError(res.status, message);
    }
    return body;
  }
  return {
    signIn: (login, password) => call("POST", "/api/session", { body: { login, password } }),
    signOut: async (token) => {
      await call("DELETE", "/api/session", { token });
    },
    me: (token) => call("GET", "/api/me", { token }),
    accountSettings: (token) => call("GET", "/api/account/settings", { token }),
    updateAccountSettings: (token, patch) => call("PATCH", "/api/account/settings", { token, body: patch }),
    wallet: (token) => call("GET", "/api/wallet", { token }),
    play: (token) => call("GET", "/api/play", { token }),
    setDeckChoice: (token, choice) => call("PUT", "/api/play/deck-choice", { token, body: { choice } }),
    setFactionLock: (token, faction) => call("PUT", "/api/play/faction-lock", { token, body: { faction } }),
    setActiveDeck: (token, deckId) => call("PUT", "/api/play/active-deck", { token, body: { deckId } }),
    setPlayStyle: (token, agentId, style) => call("PUT", `/api/agents/${encodeURIComponent(agentId)}/play-style`, { token, body: { style } }),
    rebuild: async (token) => (await call<{ job: SiteRebuildJob }>("POST", "/api/play/rebuild", { token })).job,
    rebuildJob: async (token) => (await call<{ job: SiteRebuildJob }>("GET", "/api/play/rebuild", { token })).job,
    board: (token) => call("GET", "/api/board", { token }),
    // The whole board, in order (Customise mode's Done). Only the three
    // fields the server reads are sent.
    saveBoard: (token, widgets) => call("PUT", "/api/board", { token, body: { widgets: widgets.map(({ id, type, size }) => ({ id, type, size })) } }),
    daily: (token) => call("GET", "/api/daily", { token }),
    collection: (token, recentPacks) => call("GET", `/api/collection${recentPacks ? `?recentPacks=${recentPacks}` : ""}`, { token }),
    packs: (token) => call("GET", "/api/packs", { token }),
    buyPacks: (token, setCode, count) => call("POST", "/api/packs/buy", { token, body: { setCode, count } }),
    store: (token) => call("GET", "/api/store", { token }),
    buyCosmetic: (token, itemId) => call("POST", `/api/store/cosmetics/${encodeURIComponent(itemId)}/buy`, { token }),
    openPacks: (token, what) => call("POST", "/api/packs/open", { token, body: what }),
    dailyPack: (token) => call("GET", "/api/packs/daily", { token }),
    claimDailyPack: (token) => call("POST", "/api/packs/daily/claim", { token }),
    binder: (token, setCode) => call("GET", `/api/collection/binder/${encodeURIComponent(setCode)}`, { token }),
    cardHoldings: (token, cardId) => call("GET", `/api/collection/cards/${encodeURIComponent(cardId)}`, { token }),
    salvagePlan: (token, cardId, quantity) => call("GET", `/api/collection/cards/${encodeURIComponent(cardId)}/salvage?quantity=${quantity}`, { token }),
    salvage: (token, cardId, quantity, confirmDeckImpact) =>
      call("POST", `/api/collection/cards/${encodeURIComponent(cardId)}/salvage`, { token, body: confirmDeckImpact ? { quantity, confirmDeckImpact: true } : { quantity } }),
    craftCard: (token, cardId) => call("POST", `/api/collection/cards/${encodeURIComponent(cardId)}/craft`, { token }),
    craftSecret: (token, code) => call("POST", `/api/collection/secrets/${encodeURIComponent(code)}/craft`, { token }),
    cosmetics: (token) => call("GET", "/api/cosmetics", { token }),
    loadout: (token, agentId) => call("GET", `/api/agents/${encodeURIComponent(agentId)}/loadout`, { token }),
    setLoadout: (token, agentId, slot, itemId) => call("PUT", `/api/agents/${encodeURIComponent(agentId)}/loadout/${encodeURIComponent(slot)}`, { token, body: { itemId } }),
    setAutoPlay: (token, on) => call("PUT", "/api/play/auto-play", { token, body: { on } }),
    live: (token) => call("GET", "/api/live", { token }),
    liveFeed: (token, matchId, from) => call("GET", `/api/live/${encodeURIComponent(matchId)}?from=${from}`, { token }),
    matches: (token, limit, before) => {
      const q = [limit ? `limit=${limit}` : "", before ? `before=${encodeURIComponent(before)}` : ""].filter(Boolean).join("&");
      return call("GET", `/api/matches${q ? `?${q}` : ""}`, { token });
    },
    match: (token, matchId) => call("GET", `/api/matches/${encodeURIComponent(matchId)}`, { token }),
    matchLog: (token, matchId) => text("GET", `/api/matches/${encodeURIComponent(matchId)}/log`, token),
    replayPage: (token, matchId) => call("POST", `/replay-page/${encodeURIComponent(matchId)}`, { token }),
    livePage: (token, matchId) => call("POST", `/live-page/${encodeURIComponent(matchId)}`, { token }),
    liveFrames: (token, key, from) => call("GET", `/live-frames/${encodeURIComponent(key)}?from=${from}`, { token }),
  };
}
