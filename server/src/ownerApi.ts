// The owner API: the first of the website's server endpoints (roadmap item
// 3; the owner's 2026-10-05 build order, step 3), starting with the deck
// settings of Settings -> Play (roadmap 2b step 3): who picks the deck, the
// faction lock, the forced deck, each agent's play style, why the agent's
// deck wants a rebuild, and "rebuild now". Plain HTTP + JSON on node:http,
// signed in with a Season 0 session token (`Authorization: Bearer <token>`).
// Session 63 added what the website's shell waits on (owner 2026-11-01):
// who am I, the account settings, and the wallet. Session 64 added the saved
// Home board and the economy endpoints (owner 2026-11-01): the collection
// and binder, salvage and crafting, the ledger, buying and opening packs,
// the store and cosmetics, loadouts, and today's earnings.
// Every rule stays in the store (`@ai-tcg/economy`); this layer reads the
// request, checks the caller may touch what it names, calls the store and
// answers. The endpoint list and error codes are in server/OWNER_API.md.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { PLAY_STYLES, type DeckBuildOptions, type DeckFaction } from "@ai-tcg/engine";
import {
  accountSettingsProblem,
  boardLayoutProblem,
  BULK_OPEN_COUNT,
  CARD_SETS,
  EconomyError,
  LOADOUT_SLOTS,
  LADDER_LIST_SIZE,
  LADDER_TIERS,
  LOCKABLE_FACTIONS,
  PLACEMENT_MATCHES,
  MAX_WIDGETS,
  PACK_PRICE_CREDITS,
  RECOMMENDED_LAYOUT,
  SalvageNeedsConfirmation,
  SLOT_KIND,
  WIDGET_LIMITS,
  WIDGET_SIZES,
  WIDGET_TYPES,
  type AccountSettingsPatch,
  type DeckChooser,
  type DeckStatus,
  type EconomyStore,
  type LoadoutSlot,
  type Widget,
} from "@ai-tcg/economy";

/** The longest request body read (the API's bodies are a few fields). */
const MAX_BODY_BYTES = 16 * 1024;

export interface OwnerApiOptions {
  store: EconomyStore;
  /** 0 lets the OS pick (tests). Defaults to 8081. */
  port?: number;
  /** How hard "rebuild now" searches: the store's (the engine's
   * `DEFAULT_BUILD`) unless set. Tests and the demo set it small. */
  build?: Omit<DeckBuildOptions, "faction" | "style">;
  /** What plays the build's games. The server passes its worker-thread
   * chooser; left out, the engine's `chooseDeck` runs on this thread. */
  chooser?: DeckChooser;
  /** Each pack opened over the API draws its seed from here. For the demo
   * and tests only (a reproducible run); left out, the store draws a fresh
   * random seed per pack, as it must in play. */
  packSeed?: () => number;
}

export type RebuildState = "running" | "done" | "failed";

/** One "rebuild now", as the owner sees it. */
export interface RebuildJob {
  jobId: number;
  state: RebuildState;
  startedAt: string;
  finishedAt: string | null;
  /** Why the deck wanted a rebuild when it started ([] when it didn't:
   * the owner may rebuild anyway). */
  reasons: string[];
  /** The deck saved, and every faction the agent weighed: its fresh-seed
   * win rate against the shipped decks when games ran, or why it couldn't
   * be built. */
  result: {
    deckId: string;
    faction: DeckFaction;
    style: string;
    cards: number;
    factions: { faction: DeckFaction; winRate: number | null; infeasible: string | null }[];
  } | null;
  error: string | null;
}

export interface RunningOwnerApi {
  readonly port: number;
  /** Resolves when every rebuild this API started has finished. */
  idle(): Promise<void>;
  close(): Promise<void>;
}

/** An answer other than 200 with the play settings. */
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** How a store refusal reads over HTTP: signing in and being signed in are
 * 401 (429 while locked out); naming a card, set, cosmetic, secret card or
 * loadout slot that doesn't exist is 404; everything else the store refuses
 * is 409. */
function statusOf(err: EconomyError): number {
  if (/^not signed in$|^wrong login or password$/.test(err.message)) return 401;
  if (/^too many failed sign-ins/.test(err.message)) return 429;
  if (/^no ownable card with id |^no card set "|^no cosmetic "|^no secret card "|^no loadout slot "/.test(err.message)) return 404;
  return 409;
}

/** The longest ledger page, and the default. */
const LEDGER_PAGE_MAX = 500;
const LEDGER_PAGE_DEFAULT = 50;

export function startOwnerApi(options: OwnerApiOptions): Promise<RunningOwnerApi> {
  const { store } = options;
  /** The latest rebuild per owner (kept in memory; see quality-debt.md). */
  const jobs = new Map<string, RebuildJob>();
  const running = new Set<Promise<void>>();
  let nextJobId = 1;

  const ownerOf = (req: IncomingMessage): string => {
    const header = req.headers.authorization ?? "";
    const match = /^Bearer (\S+)$/.exec(header);
    if (!match) throw new HttpError(401, "not signed in");
    return store.authenticate(match[1]!).ownerId;
  };

  const tokenOf = (req: IncomingMessage): string | null => /^Bearer (\S+)$/.exec(req.headers.authorization ?? "")?.[1] ?? null;

  /** Settings -> Play, everything the page shows. */
  const playSettings = (ownerId: string) => {
    const owner = store.getOwner(ownerId);
    const decks = store.listDecks(ownerId);
    const agentDeckId = store.agentDeckId(ownerId);
    const builtFrom = store.agentDeckBuiltFrom(ownerId);
    const agent = (a: { agentId: string; name: string; playStyle: string }) => ({ agentId: a.agentId, name: a.name, playStyle: a.playStyle });
    const connected = store.connectedAgent(ownerId);
    const live = store.liveMatchOf(ownerId);
    return {
      deckChoice: owner.deckChoice,
      factionLock: owner.factionLock,
      lockableFactions: [...LOCKABLE_FACTIONS],
      activeDeck: decks.find((d) => d.deckId === owner.activeDeckId) ?? null,
      agentDeck:
        agentDeckId === null
          ? null
          : {
              ...(decks.find((d) => d.deckId === agentDeckId) as DeckStatus),
              builtFrom: builtFrom === null ? null : { style: builtFrom.style, factionLock: builtFrom.factionLock },
            },
      rebuild: { reasons: store.agentDeckRebuildReasons(ownerId), job: jobs.get(ownerId) ?? null },
      connectedAgent: connected === null ? null : agent(connected),
      agents: store.listAgents(ownerId).map(agent),
      playStyles: Object.values(PLAY_STYLES).map((s) => ({ id: s.id, name: s.name, summary: s.summary })),
      decks,
      liveMatch: live,
    };
  };

  const startRebuild = (ownerId: string): RebuildJob => {
    const owner = store.getOwner(ownerId);
    const current = jobs.get(ownerId);
    if (current?.state === "running") throw new HttpError(409, "the agent is already building a deck");
    if (owner.deckChoice === "forced") throw new HttpError(409, "you force a deck; hand the deck choice to the agent first");
    const job: RebuildJob = {
      jobId: nextJobId++,
      state: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      reasons: store.agentDeckRebuildReasons(ownerId),
      result: null,
      error: null,
    };
    jobs.set(ownerId, job);
    const work = store
      .buildAgentDeck(ownerId, options.build ?? {}, options.chooser)
      .then(
        (built) => {
          job.state = "done";
          job.result = {
            deckId: built.deck.deckId,
            faction: built.faction,
            style: built.style,
            cards: built.deck.copyIds.length,
            factions: built.factions.map((f) => ({ faction: f.faction, winRate: f.winRate ?? null, infeasible: f.infeasible ?? null })),
          };
        },
        (err: unknown) => {
          job.state = "failed";
          job.error = err instanceof Error ? err.message : String(err);
        },
      )
      .finally(() => {
        job.finishedAt = new Date().toISOString();
        running.delete(work);
      });
    running.add(work);
    return job;
  };

  /** The board's rules, sent with it so the page and the store agree. */
  const boardRules = {
    widgetTypes: WIDGET_TYPES.map((type) => ({ type, limit: WIDGET_LIMITS[type] })),
    sizes: [...WIDGET_SIZES],
    maxWidgets: MAX_WIDGETS,
    recommendedWidgets: RECOMMENDED_LAYOUT.map((w) => ({ ...w })),
  };
  const board = (ownerId: string) => ({ ...store.boardLayout(ownerId), rules: boardRules });

  /** What packs the store sells: every set, at the one price. */
  const packOffer = () => [...CARD_SETS.values()].map((set) => ({ setCode: set.code, name: set.name, priceCredits: PACK_PRICE_CREDITS }));

  const packs = (ownerId: string) => ({
    offer: packOffer(),
    bulkOpenCount: BULK_OPEN_COUNT,
    unopened: store.unopenedPacks(ownerId),
    pity: store.pityStatus(ownerId),
    dailyPack: store.dailyPackStatus(ownerId),
    wallet: store.wallet(ownerId),
  });

  /** One of the caller's agents, or 404 (another owner's reads as missing). */
  const ownAgent = (ownerId: string, agentId: string) => {
    if (!store.listAgents(ownerId).some((a) => a.agentId === agentId)) throw new HttpError(404, `no agent "${agentId}"`);
  };

  /** The loadout picker's data for one agent: what is equipped in each
   * slot, and the owned items that fit it. */
  const loadoutOf = (ownerId: string, agentId: string) => {
    const owned = store.ownedCosmetics(ownerId);
    const loadout = store.loadout(agentId);
    return {
      agentId,
      loadout,
      slots: LOADOUT_SLOTS.map((slot) => ({
        slot,
        kind: SLOT_KIND[slot],
        itemId: loadout[slot],
        choices: owned.filter((c) => c.kind === SLOT_KIND[slot]).map((c) => c.itemId),
      })),
      locked: store.liveMatchOf(ownerId) !== null,
    };
  };

  type Handler = (
    req: IncomingMessage,
    body: Record<string, unknown>,
    params: string[],
    query: URLSearchParams,
  ) => { status?: number; body?: unknown };
  const routes: { method: string; path: RegExp; handler: Handler }[] = [
    {
      method: "POST",
      path: /^\/api\/session$/,
      handler: (_req, body) => {
        const login = field(body, "login", "string");
        const password = field(body, "password", "string");
        const session = store.signIn(login, password);
        return { status: 201, body: session };
      },
    },
    {
      method: "DELETE",
      path: /^\/api\/session$/,
      handler: (req) => {
        ownerOf(req);
        store.signOut(tokenOf(req)!);
        return { status: 204 };
      },
    },
    { method: "GET", path: /^\/api\/me$/, handler: (req) => ({ body: store.whoAmI(ownerOf(req)) }) },
    { method: "GET", path: /^\/api\/account\/settings$/, handler: (req) => ({ body: store.accountSettings(ownerOf(req)) }) },
    {
      method: "PATCH",
      path: /^\/api\/account\/settings$/,
      handler: (req, body) => {
        const ownerId = ownerOf(req);
        // A bad setting is a bad request (400), not a store refusal (409);
        // the store checks the same rule again before it writes.
        const problem = accountSettingsProblem(body);
        if (problem) throw new HttpError(400, problem);
        return { body: store.updateAccountSettings(ownerId, body as AccountSettingsPatch) };
      },
    },
    { method: "GET", path: /^\/api\/wallet$/, handler: (req) => ({ body: store.wallet(ownerOf(req)) }) },
    { method: "GET", path: /^\/api\/board$/, handler: (req) => ({ body: board(ownerOf(req)) }) },
    {
      method: "PUT",
      path: /^\/api\/board$/,
      handler: (req, body) => {
        const ownerId = ownerOf(req);
        const problem = boardLayoutProblem(body);
        if (problem) throw new HttpError(400, problem);
        store.saveBoardLayout(ownerId, body as { widgets: Widget[] });
        return { body: board(ownerId) };
      },
    },
    { method: "GET", path: /^\/api\/daily$/, handler: (req) => ({ body: store.dailyEarnings(ownerOf(req)) }) },
    {
      method: "GET",
      path: /^\/api\/ladder$/,
      handler: (req, _body, _params, query) => {
        const ownerId = ownerOf(req);
        const limit = intParam(query, "limit", LADDER_LIST_SIZE, 1, LADDER_LIST_SIZE);
        const all = store.ladder({ limit: Number.MAX_SAFE_INTEGER });
        const mine = all.find((r) => r.ownerId === ownerId) ?? null;
        // The caller's own row, ranked or not (the widget's "plus you"); an
        // owner without a rated match yet gets the same shape at the start.
        const unrated = () => {
          const owner = store.getOwner(ownerId);
          const agent = owner.connectedAgentId === null ? null : store.getAgent(owner.connectedAgentId);
          const r = store.rating(ownerId);
          return {
            rank: null,
            ownerId,
            ownerName: owner.name,
            ownerKind: owner.kind,
            agent: agent === null ? null : { agentId: agent.agentId, name: agent.name },
            rating: r.rating,
            rd: r.rd,
            tier: r.tier,
            ratedMatches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            lastDay: null,
          };
        };
        return {
          body: {
            standings: all.slice(0, limit),
            you: mine ?? unrated(),
            owners: all.length,
            tiers: LADDER_TIERS.map((t) => ({ tier: t.tier, from: Number.isFinite(t.from) ? t.from : null })),
            placementMatches: PLACEMENT_MATCHES,
          },
        };
      },
    },
    {
      method: "GET",
      path: /^\/api\/rating$/,
      handler: (req, _body, _params, query) => {
        const ownerId = ownerOf(req);
        const recent = intParam(query, "recent", 10, 1, 100);
        return { body: { rating: store.rating(ownerId), recent: store.ratingHistory(ownerId, recent) } };
      },
    },
    {
      method: "GET",
      path: /^\/api\/ledger$/,
      handler: (req, _body, _params, query) => {
        const ownerId = ownerOf(req);
        const limit = intParam(query, "limit", LEDGER_PAGE_DEFAULT, 1, LEDGER_PAGE_MAX);
        // Newest first; `before` pages back from an entry id. Paged in SQL.
        const before = query.has("before") ? intParam(query, "before", 0, 1, Number.MAX_SAFE_INTEGER) : null;
        const page = store.ledgerPage(ownerId, { limit, before });
        return { body: { ...page, wallet: store.wallet(ownerId) } };
      },
    },
    {
      method: "GET",
      path: /^\/api\/collection$/,
      handler: (req, _body, _params, query) =>
        ({ body: store.collectionSummary(ownerOf(req), { recentPacks: intParam(query, "recentPacks", 3, 1, 50) }) }),
    },
    {
      method: "GET",
      path: /^\/api\/collection\/binder\/([^/]+)$/,
      handler: (req, _body, [setCode]) => ({ body: store.binder(ownerOf(req), setCode!) }),
    },
    {
      method: "GET",
      path: /^\/api\/collection\/cards\/([^/]+)$/,
      handler: (req, _body, [cardId]) => ({ body: store.cardHoldings(ownerOf(req), cardId!) }),
    },
    {
      method: "GET",
      path: /^\/api\/collection\/cards\/([^/]+)\/salvage$/,
      handler: (req, _body, [cardId], query) => {
        const ownerId = ownerOf(req);
        if (!query.has("quantity")) throw new HttpError(400, `"quantity" is required (?quantity=N)`);
        return { body: store.salvagePlan(ownerId, cardId!, intParam(query, "quantity", 1, 1, Number.MAX_SAFE_INTEGER)) };
      },
    },
    {
      method: "POST",
      path: /^\/api\/collection\/cards\/([^/]+)\/salvage$/,
      handler: (req, body, [cardId]) => {
        const ownerId = ownerOf(req);
        const quantity = body.quantity;
        if (!Number.isInteger(quantity) || (quantity as number) < 1) throw new HttpError(400, `"quantity" must be a whole number of at least 1`);
        if ("confirmDeckImpact" in body && typeof body.confirmDeckImpact !== "boolean") throw new HttpError(400, `"confirmDeckImpact" must be true or false`);
        const result = store.salvage(ownerId, cardId!, quantity as number, { confirmDeckImpact: body.confirmDeckImpact === true });
        return { body: { ...result, holdings: store.cardHoldings(ownerId, cardId!), wallet: store.wallet(ownerId) } };
      },
    },
    {
      method: "POST",
      path: /^\/api\/collection\/cards\/([^/]+)\/craft$/,
      handler: (req, _body, [cardId]) => {
        const ownerId = ownerOf(req);
        const copy = store.craftCard(ownerId, cardId!);
        return { status: 201, body: { copy, holdings: store.cardHoldings(ownerId, cardId!), wallet: store.wallet(ownerId) } };
      },
    },
    {
      method: "POST",
      path: /^\/api\/collection\/secrets\/([^/]+)\/craft$/,
      handler: (req, _body, [code]) => {
        const ownerId = ownerOf(req);
        const copy = store.craftSecret(ownerId, code!);
        return { status: 201, body: { copy, wallet: store.wallet(ownerId) } };
      },
    },
    { method: "GET", path: /^\/api\/packs$/, handler: (req) => ({ body: packs(ownerOf(req)) }) },
    { method: "GET", path: /^\/api\/packs\/daily$/, handler: (req) => ({ body: store.dailyPackStatus(ownerOf(req)) }) },
    {
      method: "POST",
      path: /^\/api\/packs\/daily\/claim$/,
      handler: (req) => {
        const ownerId = ownerOf(req);
        const { pack, status } = store.claimDailyPack(ownerId);
        return { status: 201, body: { pack, dailyPack: status, wallet: store.wallet(ownerId) } };
      },
    },
    {
      method: "POST",
      path: /^\/api\/packs\/buy$/,
      handler: (req, body) => {
        const ownerId = ownerOf(req);
        const setCode = field(body, "setCode", "string");
        const count = body.count ?? 1;
        if (!Number.isInteger(count) || (count as number) < 1 || (count as number) > BULK_OPEN_COUNT) {
          throw new HttpError(400, `"count" must be a whole number from 1 to ${BULK_OPEN_COUNT}`);
        }
        const bought = store.buyPacks(ownerId, setCode, count as number);
        return { status: 201, body: { bought, wallet: store.wallet(ownerId) } };
      },
    },
    {
      method: "POST",
      path: /^\/api\/packs\/open$/,
      handler: (req, body) => {
        const ownerId = ownerOf(req);
        const count = body.count ?? 1;
        if (count !== 1 && count !== BULK_OPEN_COUNT) throw new HttpError(400, `"count" must be 1 or ${BULK_OPEN_COUNT}`);
        if ("packId" in body) {
          const packId = field(body, "packId", "string");
          if (count !== 1) throw new HttpError(400, `"packId" opens one pack; leave out "count" or send 1`);
          if (!store.unopenedPacks(ownerId).some((p) => p.packId === packId)) throw new HttpError(404, `no unopened pack "${packId}"`);
          const opening = store.openPack(ownerId, packId, { seed: options.packSeed?.() });
          return { body: { packs: [opening], summary: null, wallet: store.wallet(ownerId) } };
        }
        const seeds = options.packSeed ? Array.from({ length: count as number }, () => options.packSeed!()) : undefined;
        const bulk = store.openPacks(ownerId, count as number, { seeds });
        return { body: { packs: bulk.packs, summary: count === 1 ? null : bulk.summary, wallet: store.wallet(ownerId) } };
      },
    },
    {
      method: "GET",
      path: /^\/api\/packs\/([^/]+)\/opening$/,
      handler: (req, _body, [packId]) => {
        const ownerId = ownerOf(req);
        let opening;
        try {
          opening = store.packOpening(packId!);
        } catch (err) {
          if (err instanceof EconomyError) throw new HttpError(404, `no opened pack "${packId}"`);
          throw err;
        }
        // Another owner's pack reads as missing.
        if (opening.ownerId !== ownerId) throw new HttpError(404, `no opened pack "${packId}"`);
        return { body: opening };
      },
    },
    {
      method: "GET",
      path: /^\/api\/store$/,
      handler: (req) => {
        const ownerId = ownerOf(req);
        return { body: { packs: packOffer(), dailyPack: store.dailyPackStatus(ownerId), cosmetics: store.cosmeticsOnSale(ownerId), wallet: store.wallet(ownerId) } };
      },
    },
    {
      method: "POST",
      path: /^\/api\/store\/cosmetics\/([^/]+)\/buy$/,
      handler: (req, _body, [itemId]) => {
        const ownerId = ownerOf(req);
        const cosmetic = store.buyCosmetic(ownerId, itemId!);
        return { status: 201, body: { cosmetic, wallet: store.wallet(ownerId) } };
      },
    },
    { method: "GET", path: /^\/api\/cosmetics$/, handler: (req) => ({ body: { owned: store.ownedCosmetics(ownerOf(req)) } }) },
    {
      method: "GET",
      path: /^\/api\/agents\/([^/]+)\/loadout$/,
      handler: (req, _body, [agentId]) => {
        const ownerId = ownerOf(req);
        ownAgent(ownerId, agentId!);
        return { body: loadoutOf(ownerId, agentId!) };
      },
    },
    {
      method: "PUT",
      path: /^\/api\/agents\/([^/]+)\/loadout\/([^/]+)$/,
      handler: (req, body, [agentId, slot]) => {
        const ownerId = ownerOf(req);
        ownAgent(ownerId, agentId!);
        if (!(LOADOUT_SLOTS as readonly string[]).includes(slot!)) throw new HttpError(404, `no loadout slot "${slot}"`);
        if (!("itemId" in body)) throw new HttpError(400, `"itemId" is required (an item id, or null to empty the slot)`);
        if (body.itemId !== null && typeof body.itemId !== "string") throw new HttpError(400, `"itemId" must be a string or null`);
        store.setLoadout(ownerId, agentId!, slot as LoadoutSlot, body.itemId as string | null);
        return { body: loadoutOf(ownerId, agentId!) };
      },
    },
    { method: "GET", path: /^\/api\/play$/, handler: (req) => ({ body: playSettings(ownerOf(req)) }) },
    {
      method: "PUT",
      path: /^\/api\/play\/deck-choice$/,
      handler: (req, body) => {
        const ownerId = ownerOf(req);
        const choice = field(body, "choice", "string");
        if (choice !== "agent" && choice !== "forced") throw new HttpError(400, `"choice" must be "agent" or "forced"`);
        store.setDeckChoice(ownerId, choice);
        return { body: playSettings(ownerId) };
      },
    },
    {
      method: "PUT",
      path: /^\/api\/play\/faction-lock$/,
      handler: (req, body) => {
        const ownerId = ownerOf(req);
        if (!("faction" in body)) throw new HttpError(400, `"faction" is required (a faction, or null for none)`);
        const faction = body.faction;
        if (faction !== null && typeof faction !== "string") throw new HttpError(400, `"faction" must be a string or null`);
        const { activeDeckFits } = store.setFactionLock(ownerId, faction as DeckFaction | null);
        return { body: { ...playSettings(ownerId), activeDeckFits } };
      },
    },
    {
      method: "PUT",
      path: /^\/api\/play\/active-deck$/,
      handler: (req, body) => {
        const ownerId = ownerOf(req);
        const deckId = field(body, "deckId", "string");
        // Another owner's deck reads as no deck at all, so nothing about it
        // (not even its faction) leaks through the refusal.
        if (!store.listDecks(ownerId).some((d) => d.deckId === deckId)) throw new HttpError(404, `no deck "${deckId}"`);
        store.setActiveDeck(ownerId, deckId);
        return { body: playSettings(ownerId) };
      },
    },
    {
      method: "PUT",
      path: /^\/api\/agents\/([^/]+)\/play-style$/,
      handler: (req, body, [agentId]) => {
        const ownerId = ownerOf(req);
        const style = field(body, "style", "string");
        if (!store.listAgents(ownerId).some((a) => a.agentId === agentId)) throw new HttpError(404, `no agent "${agentId}"`);
        store.setPlayStyle(ownerId, agentId!, style);
        return { body: playSettings(ownerId) };
      },
    },
    {
      method: "POST",
      path: /^\/api\/play\/rebuild$/,
      handler: (req) => ({ status: 202, body: { job: startRebuild(ownerOf(req)) } }),
    },
    {
      method: "GET",
      path: /^\/api\/play\/rebuild$/,
      handler: (req) => {
        const job = jobs.get(ownerOf(req));
        if (!job) throw new HttpError(404, "no rebuild has run");
        return { body: { job } };
      },
    },
  ];

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;
      const onPath = routes.filter((r) => r.path.test(path));
      if (onPath.length === 0) throw new HttpError(404, `no endpoint ${path}`);
      const route = onPath.find((r) => r.method === req.method);
      if (!route) {
        res.setHeader("Allow", onPath.map((r) => r.method).join(", "));
        throw new HttpError(405, `${req.method} is not allowed on ${path}`);
      }
      const body = await readJson(req);
      const params = route.path.exec(path)!.slice(1).map(decodeURIComponent);
      const out = route.handler(req, body, params, url.searchParams);
      send(res, out.status ?? 200, out.body);
    } catch (err) {
      if (err instanceof HttpError) send(res, err.status, { error: err.message });
      else if (err instanceof SalvageNeedsConfirmation) send(res, 409, { error: err.message, affectedDecks: err.affectedDecks, needsConfirmation: true });
      else if (err instanceof EconomyError) send(res, statusOf(err), { error: err.message });
      else {
        console.error("[owner-api] unexpected error:", err);
        send(res, 500, { error: "internal error" });
      }
    }
  }

  return new Promise((resolve) => {
    server.listen(options.port ?? 8081, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        port,
        idle: async () => {
          while (running.size > 0) await Promise.all([...running]);
        },
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
}

/** The request's JSON object body ({} when there is none). */
async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, `the body is over ${MAX_BODY_BYTES} bytes`);
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, "the body is not JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new HttpError(400, "the body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function field(body: Record<string, unknown>, name: string, type: "string"): string {
  const value = body[name];
  if (typeof value !== type) throw new HttpError(400, `"${name}" must be a ${type}`);
  return value as string;
}

/** A whole-number query parameter from `min` to `max`, or `fallback` when
 * it isn't sent. */
function intParam(query: URLSearchParams, name: string, fallback: number, min: number, max: number): number {
  const raw = query.get(name);
  if (raw === null) return fallback;
  const n = /^-?\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(n) || n < min || n > max) {
    throw new HttpError(400, `"${name}" must be a whole number from ${min}${max === Number.MAX_SAFE_INTEGER ? " up" : ` to ${max}`}`);
  }
  return n;
}
