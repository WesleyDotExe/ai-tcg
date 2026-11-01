// Home as the widget board (render session 46): the board's pure model
// (siteBoard.ts), the widgets as HTML at every size (siteWidgets.ts), and the
// API client's board and widget reads against the game lane's real owner API
// (its own code, unchanged, over an in-memory store).

import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore, MAX_WIDGETS, RECOMMENDED_LAYOUT, WIDGET_LIMITS, WIDGET_TYPES, boardLayoutProblem } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { SiteApiError, siteApi, type SitePlay } from "../src/site/siteApi.js";
import {
  WIDGET_INFO,
  WIDGET_WAITS,
  addBlock,
  addWidget,
  bestCards,
  collectionView,
  dailyView,
  liveViews,
  moveBy,
  moveWidget,
  nextId,
  packGrid,
  packsView,
  pityLine,
  recommendedWidgets,
  removeWidget,
  resizeWidget,
  sameBoard,
  sizeClass,
  spanOf,
  untilText,
  type SiteBoardRules,
  type SiteCollection,
  type SiteDaily,
  type SiteWidget,
  type WidgetSize,
  type WidgetType,
} from "../src/site/siteBoard.js";
import { miniCard, sourcesFor, sourcesOf, widgetHtml, type WidgetData } from "../src/site/siteWidgets.js";

// The server's rules, built the way the owner API builds them (from the store's own constants).
const RULES: SiteBoardRules = {
  widgetTypes: WIDGET_TYPES.map((type) => ({ type, limit: WIDGET_LIMITS[type] })),
  sizes: ["S", "M", "L"],
  maxWidgets: MAX_WIDGETS,
  recommendedWidgets: RECOMMENDED_LAYOUT.map((w) => ({ ...w })),
};
const W = (id: string, type: WidgetType, size: WidgetSize = "M"): SiteWidget => ({ id, type, size });

describe("the widget catalogue", () => {
  it("draws exactly the store's Season 0 widgets, no more (Tournament and the pull feed are after Season 0)", () => {
    expect(Object.keys(WIDGET_INFO).sort()).toEqual([...WIDGET_TYPES].sort());
    expect(WIDGET_INFO).not.toHaveProperty("tournament");
    expect(WIDGET_INFO).not.toHaveProperty("feed");
  });
  it("sizes follow the spec: S 3x2, M 6x4, L wide 12x6 or tall 6x8 (the mockup's pick per widget)", () => {
    expect(spanOf(W("a", "packs", "S"))).toEqual({ cols: 3, rows: 2 });
    expect(spanOf(W("a", "packs", "M"))).toEqual({ cols: 6, rows: 4 });
    expect(spanOf(W("a", "packs", "L"))).toEqual({ cols: 12, rows: 6 });
    expect(spanOf(W("a", "daily", "L"))).toEqual({ cols: 6, rows: 8 });
    const tall = WIDGET_TYPES.filter((t) => sizeClass({ type: t, size: "L" }) === "sz-Lt");
    expect(tall.sort()).toEqual(["daily", "history", "ladder", "notif"]);
  });
  it("every widget with a page opens it; the waiting widgets each say what they wait on", () => {
    for (const t of WIDGET_TYPES) if (t !== "notif") expect(WIDGET_INFO[t].page, t).not.toBeNull();
    expect(Object.keys(WIDGET_WAITS).sort()).toEqual(["form", "history", "ladder", "live", "notif", "watch"]);
  });
});

describe("Customise mode's edits", () => {
  const board = recommendedWidgets(RULES);
  it("adds at Medium at the end, with a fresh id, and the result is a board the store accepts", () => {
    const out = addWidget(board, "showcase", RULES);
    expect(out.at(-1)).toEqual({ id: "w10", type: "showcase", size: "M" });
    expect(out.slice(0, -1)).toEqual(board);
    expect(boardLayoutProblem({ widgets: out })).toBeUndefined();
  });
  it("refuses past each widget's limit (Watch live twice, the rest once) and past the board's size", () => {
    expect(addBlock(board, "agent", RULES)).toBe("Already on your board");
    expect(addBlock(board, "watch", RULES)).toBeNull();
    const two = addWidget(board, "watch", RULES);
    expect(addBlock(two, "watch", RULES)).toBe("2 already on your board");
    expect(addWidget(two, "watch", RULES)).toEqual(two);
    // Everything at its limit: the largest board the store allows.
    let full: SiteWidget[] = [];
    for (const t of WIDGET_TYPES) for (let i = 0; i < WIDGET_LIMITS[t]; i++) full = addWidget(full, t, RULES);
    expect(full.length).toBe(MAX_WIDGETS);
    expect(boardLayoutProblem({ widgets: full })).toBeUndefined();
    expect(WIDGET_TYPES.every((t) => addBlock(full, t, RULES) !== null)).toBe(true);
    // A tighter cap from the server is applied as sent.
    expect(addBlock([], "packs", { ...RULES, maxWidgets: 0 })).toBe("Your board holds 0 widgets");
    expect(addBlock([], "packs", { ...RULES, widgetTypes: [] })).toBe("Not in Season 0");
  });
  it("never reuses an id on one board, whatever ids the board already has", () => {
    expect(nextId([])).toBe("w1");
    expect(nextId([W("w3", "agent"), W("w1", "live")])).toBe("w4");
    expect(nextId([W("custom", "agent"), W("w1", "live")])).toBe("w2");
    const removed = removeWidget(board, "w9");
    expect(addWidget(removed, "showcase", RULES).at(-1)!.id).toBe("w9");
  });
  it("removes, resizes, and leaves the rest alone", () => {
    expect(removeWidget(board, "w2").map((w) => w.id)).toEqual(["w1", "w3", "w4", "w5", "w6", "w7", "w8", "w9"]);
    const r = resizeWidget(board, "w4", "L");
    expect(r[3]).toEqual({ id: "w4", type: "daily", size: "L" });
    expect(r.filter((_, i) => i !== 3)).toEqual(board.filter((_, i) => i !== 3));
    expect(sameBoard(board, recommendedWidgets(RULES))).toBe(true);
    expect(sameBoard(board, r)).toBe(false);
  });
  it("drag and drop puts the widget before or after the one it lands on", () => {
    const ids = (b: SiteWidget[]) => b.map((w) => w.id).join(" ");
    expect(ids(moveWidget(board, "w1", "w3", false))).toBe("w2 w1 w3 w4 w5 w6 w7 w8 w9");
    expect(ids(moveWidget(board, "w1", "w3", true))).toBe("w2 w3 w1 w4 w5 w6 w7 w8 w9");
    expect(ids(moveWidget(board, "w9", "w1", false))).toBe("w9 w1 w2 w3 w4 w5 w6 w7 w8");
    expect(ids(moveWidget(board, "w1", "w1", true))).toBe(ids(board));
    expect(ids(moveWidget(board, "w1", "nope", true))).toBe(ids(board));
  });
  it("the arrow keys move one place, stopping at the ends", () => {
    const ids = (b: SiteWidget[]) => b.map((w) => w.id).slice(0, 3).join(" ");
    expect(ids(moveBy(board, "w2", -1))).toBe("w2 w1 w3");
    expect(ids(moveBy(board, "w2", 1))).toBe("w1 w3 w2");
    expect(moveBy(board, "w1", -1)).toEqual(board);
    expect(moveBy(board, "w9", 1)).toEqual(board);
  });
  it("Recommended layout is a fresh copy of the server's, not a shared one", () => {
    const a = recommendedWidgets(RULES);
    a[0]!.size = "S";
    expect(RULES.recommendedWidgets[0]!.size).toBe("M");
  });
});

describe("the grid", () => {
  it("packs the recommended layout as the mockup draws it, with no holes and no overlaps", () => {
    const g = packGrid(recommendedWidgets(RULES));
    const at = (id: string) => g.find((x) => x.id === id)!;
    // Row 1: My agent, Live match. Row 2: Packs, then Daily rewards and Store side by side. Row 3: Watch live
    // (under them), Collection. Row 4: Ladder, Rating & form.
    expect([at("w1").col, at("w1").row, at("w2").col, at("w2").row]).toEqual([1, 1, 7, 1]);
    expect([at("w3").col, at("w3").row]).toEqual([1, 5]);
    expect([at("w4").col, at("w4").row, at("w5").col, at("w5").row]).toEqual([7, 5, 10, 5]);
    expect([at("w6").col, at("w6").row]).toEqual([7, 7]);
    expect([at("w7").col, at("w7").row]).toEqual([1, 9]);
    const cells = new Set<string>();
    for (const x of g) for (let r = x.row; r < x.row + x.rows; r++) for (let c = x.col; c < x.col + x.cols; c++) {
      const k = `${r},${c}`;
      expect(cells.has(k), k).toBe(false);
      cells.add(k);
    }
  });
  it("dense packing lets a Small fill a hole; one column keeps the owner's order", () => {
    const b = [W("a", "agent", "S"), W("b", "packs", "L"), W("c", "daily", "S")];
    const g = packGrid(b);
    expect(g.map((x) => [x.col, x.row])).toEqual([[1, 1], [1, 3], [4, 1]]);
    const one = packGrid(b, 1);
    expect(one.map((x) => x.row)).toEqual([1, 3, 9]);
  });
});

describe("live boards (at most two at once)", () => {
  it("the first two widgets that want a board get one, in board order; the rest drop to the scoreboard with the note", () => {
    const b = [W("a", "live", "M"), W("b", "watch", "M"), W("c", "watch", "L"), W("d", "live", "S")];
    const { views, capped } = liveViews(b);
    expect(Object.fromEntries(views)).toEqual({ a: "board", b: "list", c: "board", d: "scoreboard" });
    expect([...capped]).toEqual([]);
    const three = [W("a", "live", "L"), W("b", "watch", "L"), W("c", "watch", "L")];
    const r = liveViews(three);
    expect(Object.fromEntries(r.views)).toEqual({ a: "board", b: "board", c: "scoreboard" });
    expect([...r.capped]).toEqual(["c"]);
    expect(liveViews([W("x", "packs")]).views.size).toBe(0);
  });
});

// A day of results as GET /api/daily answers it (the schedule is the store's).
const DAILY: SiteDaily = {
  day: "2026-11-01",
  timeZone: "Australia/Sydney",
  startedAt: "2026-10-31T13:00:00.000Z",
  resetsAt: "2026-11-01T13:00:00.000Z",
  schedule: [
    { fromWin: 1, toWin: 1, credits: 30 },
    { fromWin: 2, toWin: 4, credits: 10 },
    { fromWin: 5, toWin: 10, credits: 5 },
    { fromWin: 11, toWin: null, credits: 0 },
  ],
  wins: [
    { nth: 1, matchId: "m1", endedAt: "2026-11-01T02:00:00.000Z", credits: 30 },
    { nth: 2, matchId: "m2", endedAt: "2026-11-01T03:00:00.000Z", credits: 10 },
  ],
  rewardedWins: [
    { nth: 1, matchId: "m1", endedAt: "2026-11-01T02:00:00.000Z", credits: 30 },
    { nth: 2, matchId: "m2", endedAt: "2026-11-01T03:00:00.000Z", credits: 10 },
  ],
  losses: 1,
  maxPaidLosses: 10,
  creditsFromWins: 40,
  creditsFromLosses: 2,
  credits: 42,
  nextWinPays: 10,
  nextLossPays: 2,
};

describe("what the widgets show", () => {
  it("Daily rewards: the bar runs to what the schedule's paying wins add up to", () => {
    const v = dailyView(DAILY, Date.parse("2026-11-01T09:47:00.000Z"));
    expect(v).toMatchObject({ fromWins: 40, winCap: 90, rewarded: 2, rewardedCap: 10, credits: 42, nextWin: "Next win pays 10" });
    expect(v.barPct).toBeCloseTo(44.4, 1);
    expect(v.resets).toBe("Resets in 3 h 13 min (midnight Sydney)");
    expect(dailyView({ ...DAILY, nextWinPays: 0 }, 0).nextWin).toBe("Wins pay nothing more today");
    expect(untilText(0, "1970-01-01T00:00:30.000Z")).toBe("under a minute");
    expect(untilText(0, "1970-01-01T00:42:00.000Z")).toBe("42 min");
    expect(untilText(0, "bad")).toBe("under a minute");
  });

  const COLLECTION: SiteCollection = {
    copies: 6,
    distinctCards: 3,
    cards: [
      { cardId: "c1", name: "Alpha Node", rarity: "Common", faction: "Cortex", owned: 3, salvageable: 0, copies: [
        { copyId: "x1", cardId: "c1", finish: "standard", serial: null, runSize: null, secretCode: null, acquiredAt: "" },
        { copyId: "x2", cardId: "c1", finish: "standard", serial: null, runSize: null, secretCode: null, acquiredAt: "" },
        { copyId: "x3", cardId: "c1", finish: "gold", serial: null, runSize: null, secretCode: null, acquiredAt: "" },
      ] },
      { cardId: "c2", name: "Brute <Force>", rarity: "Mythic", faction: "Swarm", owned: 1, salvageable: 1, copies: [{ copyId: "y1", cardId: "c2", finish: "standard", serial: null, runSize: null, secretCode: null, acquiredAt: "" }] },
      { cardId: "c3", name: "Crown", rarity: "Rare", faction: null, owned: 2, salvageable: 0, copies: [
        { copyId: "z1", cardId: "c3", finish: "prototype", serial: 7, runSize: 25, secretCode: null, acquiredAt: "" },
        { copyId: "z2", cardId: "c3", finish: "foil", serial: null, runSize: null, secretCode: null, acquiredAt: "" },
      ] },
    ],
    sets: [{ setCode: "S0", base: { held: 3, total: 96 }, secrets: { held: 0, total: 36 }, glitch: { held: 0, total: 9 }, gold: { held: 1, total: 96 }, prototypes: { runsHeld: 1, runs: 15, copiesHeld: 1 } }],
    recentPulls: [
      { packId: "p2", setCode: "S0", openedAt: "", jackpot: false, cards: [1, 2, 3, 4].map((i) => ({ copyId: `n${i}`, cardId: "c1", name: "Alpha Node", rarity: "Common", finish: "standard", secretCode: null, serial: null, held: true })) },
      { packId: "p1", setCode: "S0", openedAt: "", jackpot: true, cards: [{ copyId: "z1", cardId: "c3", name: "Crown", rarity: "Rare", finish: "prototype", secretCode: null, serial: 7, held: true }, { copyId: "q", cardId: "c2", name: "Brute <Force>", rarity: "Mythic", finish: "standard", secretCode: null, serial: null, held: false }] },
    ],
  };
  it("Collection: completion of the set, secrets and Prototypes, the last five pulls newest first", () => {
    const v = collectionView(COLLECTION);
    expect(v).toMatchObject({ setCode: "S0", held: 3, total: 96, pct: 3, secrets: "Secrets 0/36", prototypes: "Prototypes 1/15" });
    expect(v.lastPulls.map((c) => `${c.cardId}:${c.finish}`)).toEqual(["c1:standard", "c1:standard", "c1:standard", "c1:standard", "c3:prototype"]);
    expect(v.lastPulls[4]!.faction).toBeNull();
    expect(collectionView({ ...COLLECTION, sets: [] }).setCode).toBeNull();
  });
  it("Showcase: the rarest finish first, then rarity; one of each card and finish", () => {
    expect(bestCards(COLLECTION, 10).map((c) => `${c.name}:${c.finish}`)).toEqual(["Crown:prototype", "Alpha Node:gold", "Crown:foil", "Brute <Force>:standard", "Alpha Node:standard"]);
    expect(bestCards(COLLECTION, 1)).toHaveLength(1);
  });
  it("Packs: the pity timers in words, from the server's counters and flags only", () => {
    const pity = { packsSinceFullArt: 3, packsSinceMythic: 1, next: { fullArt: false, mythic: false } };
    expect(pityLine(pity)).toBe("3 packs since a Full Art · 1 pack since a Mythic");
    expect(pityLine({ ...pity, next: { fullArt: true, mythic: false } })).toBe("Your next pack is sure to hold a Full Art or better.");
    expect(pityLine({ ...pity, next: { fullArt: true, mythic: true } })).toBe("Your next pack is sure to hold a Full Art or better and a Mythic.");
    const p = { offer: [{ setCode: "S0", name: "Season Zero", priceCredits: 100 }], bulkOpenCount: 10, unopened: [], pity };
    expect(packsView(p, 99)).toMatchObject({ head: "No packs waiting", canBuy: false, canOpen: false, price: 100 });
    expect(packsView(p, 1000)).toMatchObject({ canBuy: true, canBuy10: true });
  });
  it("a mini card is a placeholder face (faction, hue, pattern, rarity, finish), escaped", () => {
    const h = miniCard({ cardId: "c2", name: "Brute <Force>", rarity: "Mythic", faction: "Swarm", finish: "prototype", serial: 7 });
    expect(h).toContain("Brute &lt;Force&gt;");
    expect(h).not.toContain("<Force>");
    expect(h).toMatch(/class="mc fin-prototype r-Mythic"/);
    expect(h).toContain("Prototype #7");
    expect(h).toMatch(/mc-art p[0-3]/);
  });

  const PLAY: SitePlay = {
    deckChoice: "agent", factionLock: "Null", lockableFactions: [], activeDeck: null, agentDeck: null, rebuild: { reasons: [], job: null },
    connectedAgent: { agentId: "a1", name: "Vector <Halcyon>", playStyle: "calculator" }, agents: [], playStyles: [{ id: "calculator", name: "Calculator", summary: "" }], decks: [],
    liveMatch: null,
  };
  const DATA: WidgetData = {
    play: PLAY,
    wallet: { credits: 250, packPoints: 40, unopenedPacks: [] },
    packs: { offer: [{ setCode: "S0", name: "Season Zero", priceCredits: 100 }], bulkOpenCount: 10, unopened: [{ packId: "p", setCode: "S0", source: "ownerDaily", acquiredAt: "" }], pity: { packsSinceFullArt: 2, packsSinceMythic: 2, next: { fullArt: false, mythic: false } } },
    collection: COLLECTION,
    daily: DAILY,
    store: { packs: [], cosmetics: [{ itemId: "boast.s0", kind: "boast", name: "Overclock", faction: "Cortex", priceCredits: 300, owned: false }], wallet: { credits: 250, packPoints: 40, unopenedPacks: [] } },
    errors: {},
    now: Date.parse("2026-11-01T09:00:00.000Z"),
    colFilter: "All",
  };
  it("every widget draws at every size, editing or not, with nothing undefined or made up", () => {
    for (const t of WIDGET_TYPES) for (const size of ["S", "M", "L"] as const) for (const editing of [false, true]) {
      const h = widgetHtml({ id: "w1", type: t, size }, DATA, { editing, live: "board" });
      expect(h, `${t} ${size}`).not.toMatch(/undefined|NaN|\[object|>false<|>null</);
      expect(h).toContain(`data-type="${t}"`);
      expect(h).toContain(`data-size="${size}"`);
      if (editing) {
        expect(h).toContain('data-act="remove"');
        expect(h).toMatch(new RegExp(`data-size="${size}" aria-pressed="true"`));
        expect(h).toContain('draggable="true"');
        expect(h).not.toContain('class="wopen"');
      } else expect(h.includes('class="wopen"')).toBe(WIDGET_INFO[t].page !== null);
      if (WIDGET_WAITS[t]) expect(h, t).toContain(`Waits on the server for ${WIDGET_WAITS[t]!.needs}`);
    }
  });
  it("the widgets draw the server's numbers (and escape names)", () => {
    const at = (type: WidgetType, size: WidgetSize, d = DATA) => widgetHtml({ id: "w", type, size }, d, { editing: false });
    expect(at("agent", "S")).toContain("Vector &lt;Halcyon&gt;");
    expect(at("agent", "L")).toContain("Today: 40/90 credits from wins");
    expect(at("agent", "L")).toContain("Faction locked to Null");
    expect(at("daily", "S")).toContain("40/90");
    expect(at("daily", "S")).toContain("Rewarded wins 2/10");
    expect(at("daily", "L")).toContain("Losses and draws today: 1 · +2 credits");
    expect(at("packs", "M")).toContain("1 unopened pack<");
    expect(at("packs", "M")).toMatch(/data-act="buy-packs" data-set="S0" data-count="1">Buy · 100/);
    expect(at("store", "M")).toMatch(/data-count="10" disabled>Buy 10 · 1,000/);
    expect(at("store", "L")).toMatch(/data-act="buy-cosmetic" data-item="boast.s0"[^>]*disabled>Buy · 300/);
    expect(at("collection", "S")).toContain("3/96");
    expect(at("collection", "L", { ...DATA, colFilter: "Swarm" })).toContain("Brute &lt;Force&gt;");
    expect(at("collection", "L", { ...DATA, colFilter: "Swarm" })).not.toContain("Alpha Node");
    expect(at("collection", "L", { ...DATA, colFilter: "Neutral" })).toContain("Crown");
    expect(at("showcase", "S").match(/class="mc /g)).toHaveLength(1);
    expect(at("showcase", "M").match(/class="mc /g)).toHaveLength(5);
  });
  it("a widget still loading says so; one whose read failed says why", () => {
    const at = (type: WidgetType, d: WidgetData) => widgetHtml({ id: "w", type, size: "M" }, d, { editing: false });
    expect(at("daily", { ...DATA, daily: null })).toContain("Loading…");
    expect(at("collection", { ...DATA, collection: null, errors: { collection: "Server <down>." } })).toContain("Couldn't load this: Server &lt;down&gt;.");
  });
  it("a live widget past the two-board limit says it's a scoreboard only; with no agent, Connect", () => {
    expect(widgetHtml(W("w", "watch", "L"), DATA, { editing: false, live: "scoreboard", capped: true })).toContain("Scoreboard only: two live boards are already showing.");
    expect(widgetHtml(W("w", "live", "M"), DATA, { editing: false, live: "board" })).toContain('class="lboard"');
    const none = { ...DATA, play: { ...PLAY, connectedAgent: null } };
    expect(widgetHtml(W("w", "live", "M"), none, { editing: false })).toContain('href="#/connect"');
    expect(widgetHtml(W("w", "agent", "M"), none, { editing: false })).toContain("No agent connected");
  });
  it("the page reads only what the board's widgets need at their sizes", () => {
    expect(sourcesFor([])).toEqual([]);
    expect(sourcesFor(recommendedWidgets(RULES))).toEqual(["collection", "daily", "packs"]);
    expect(sourcesOf(W("w", "store", "L"))).toEqual(["packs", "store"]);
    expect(sourcesOf(W("w", "packs", "L"))).toContain("collection");
    expect(sourcesFor([W("a", "ladder"), W("b", "notif")])).toEqual([]);
  });
});

// ---- the client against the real owner API ----
const PW = "correct horse battery";
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) {
    await r.idle();
    await r.close();
  }
});

describe("the board and widget reads, over the real owner API", () => {
  async function stack() {
    const store = EconomyStore.open(":memory:");
    const owner = store.createAccount({ name: "ada", username: "ada", password: PW });
    store.grantStarterCollection(owner.ownerId, "Swarm");
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const { token } = await client.signIn("ada", PW);
    return { store, owner, client, token };
  }

  it("reads the recommended board until saved; Customise's edits save and read back; the store's refusals come back as errors", async () => {
    const { client, token } = await stack();
    const first = await client.board(token);
    expect(first.recommended).toBe(true);
    expect(first.widgets).toEqual(first.rules.recommendedWidgets);
    expect(first.rules.maxWidgets).toBe(MAX_WIDGETS);
    // Edits made with this file's functions, against the server's own rules.
    let draft = removeWidget(first.widgets, "w2");
    draft = resizeWidget(draft, "w1", "L");
    draft = addWidget(draft, "showcase", first.rules);
    draft = addWidget(draft, "watch", first.rules);
    draft = moveWidget(draft, draft.at(-1)!.id, "w1", false);
    const saved = await client.saveBoard(token, draft);
    expect(saved.recommended).toBe(false);
    expect(saved.widgets).toEqual(draft);
    expect((await client.board(token)).widgets).toEqual(draft);
    // An empty board saves (the empty state).
    expect((await client.saveBoard(token, [])).widgets).toEqual([]);
    // A third Watch live is refused by the server with its reason.
    const err = await client.saveBoard(token, [W("a", "watch"), W("b", "watch"), W("c", "watch")]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SiteApiError);
    expect((err as SiteApiError).status).toBe(400);
    expect((err as SiteApiError).message).toContain('2 "watch" widgets');
    expect((await client.board(token)).widgets).toEqual([]);
  });

  it("the widgets' reads answer in the shapes the widgets draw, and buying a pack goes through", async () => {
    const { client, token, store, owner } = await stack();
    const d = await client.daily(token);
    expect(dailyView(d, Date.now()).winCap).toBe(90);
    const c = await client.collection(token, 3);
    expect(collectionView(c).total).toBeGreaterThan(0);
    expect(c.cards.length).toBeGreaterThan(0);
    const p = await client.packs(token);
    expect(p.offer[0]).toMatchObject({ setCode: "S0", priceCredits: 100 });
    expect(typeof p.pity.next.fullArt).toBe("boolean");
    expect(pityLine(p.pity)).not.toMatch(/undefined|true|false/);
    const s = await client.store(token);
    expect(Array.isArray(s.cosmetics)).toBe(true);
    // Credits from a recorded win, then a pack bought with them.
    const a = store.createAgent({ ownerId: owner.ownerId, name: "A" });
    const other = store.createAccount({ name: "bob", username: "bob", password: PW });
    store.grantStarterCollection(other.ownerId, "Aegis");
    const b = store.createAgent({ ownerId: other.ownerId, name: "B" });
    for (let i = 0; i < 4; i++) store.recordMatch({ matchId: `m${i}`, seed: i, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: a.agentId }, endedAt: new Date(Date.now() - (i + 1) * 86_400_000).toISOString() });
    const before = (await client.packs(token)).unopened.length;
    const bought = await client.buyPacks(token, "S0", 1);
    expect(bought.bought).toHaveLength(1);
    expect((await client.packs(token)).unopened.length).toBe(before + 1);
    const tooMany = await client.buyPacks(token, "S0", 10).catch((e: unknown) => e);
    expect((tooMany as SiteApiError).status).toBe(409);
  });
});
