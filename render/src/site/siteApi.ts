// The owner website's client for the owner API (Season 0 render item 1,
// render session 44). The contract is server/OWNER_API.md, written by the
// game lane; this file is the render lane's reading of it and nothing
// more: it sends the requests that document names and hands back what the
// server answered. No rule is copied here (every rule is the store's).
//
// Browser-safe: no DOM and no Node, only `fetch`, which the caller passes
// in (the page passes `window.fetch`; the tests pass Node's against a real
// owner API on a real port). The page bundles this file with esbuild.

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
  /** Only on the faction-lock answer. */
  activeDeckFits?: boolean;
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
      throw new SiteApiError(res.status, message);
    }
    return body as T;
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
  };
}
