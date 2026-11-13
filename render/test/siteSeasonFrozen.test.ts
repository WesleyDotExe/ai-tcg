// Render session 73: the season has ended, so the Store, the Packs widget,
// the free daily pack, Daily rewards and the card viewer are drawn closed
// (their buttons off, the reason said) instead of offering what the server
// then refuses. Pure fixtures for the drawing; the real owner API over a real
// ended store for the refusals the page reads as "the season has ended".
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { SiteApiError, siteApi, type SiteStore } from "../src/site/siteApi.js";
import type { SiteDaily, SitePacks } from "../src/site/siteBoard.js";
import { dailyBody, packNodeHtml } from "../src/site/siteDaily.js";
import { openButton } from "../src/site/siteLook.js";
import { isSeasonEndedRefusal, seasonFrozen, frozenNoteHtml, type SiteSeason } from "../src/site/siteSeason.js";
import { cosmeticTiles, freezeTiles, packTiles, tileHtml } from "../src/site/siteShop.js";
import { SHOP_CSS } from "../src/site/siteShopCss.js";
import { widgetHtml, type WidgetData } from "../src/site/siteWidgets.js";

const NOW = Date.parse("2026-12-27T01:00:00.000Z");
const S = (state: SiteSeason["state"]): SiteSeason => ({ season: "S0", state, endedAt: state === "ended" ? "2026-12-26T13:02:35.000Z" : null, endsAt: "2026-12-26T13:00:00.000Z", liveMatches: state === "ending" ? 1 : 0, tierCoinsNow: null, you: null, standings: null, retiredPrototypes: null, startedFrom: null, yourSeed: null });
const F = seasonFrozen(S("ended"))!;
const DAILY = { setCode: "S0", waiting: 1, cap: 2, day: "2026-12-27", timeZone: "Australia/Sydney", resetsAt: "2026-12-27T13:00:00.000Z", nextPackAt: "2026-12-27T13:00:00.000Z", claimedToday: 0, lastClaimedAt: null };
const PACKS: SitePacks = {
  offer: [{ setCode: "S0", name: "Season Zero", priceCredits: 100 }],
  bulkOpenCount: 10,
  unopened: Array.from({ length: 12 }, (_, i) => ({ packId: `p${i}`, setCode: "S0", source: "purchase", acquiredAt: "2026-12-20T00:00:00.000Z" })),
  pity: { packsSinceFullArt: 7, packsSinceMythic: 2, next: { fullArt: false, mythic: false } },
  dailyPack: DAILY,
};
const COS = (itemId: string, price: number | null, owned = false) => ({ itemId, kind: "coin", name: itemId, season: "S0", faction: null, priceCredits: price, description: "", owned });
/** Every enabled button in a string of HTML. */
const live = (h: string, act: string) => (h.match(new RegExp(`<button[^>]*data-act="${act}"[^>]*>`, "g")) ?? []).filter((b) => !/ disabled/.test(b));

describe("the season's frozen state", () => {
  it("only an ended season freezes the store: open and ending still sell and open packs", () => {
    expect(seasonFrozen(null)).toBeNull();
    expect(seasonFrozen(S("open"))).toBeNull();
    // Ending: the last matches still pay, the store isn't the archive yet.
    expect(seasonFrozen(S("ending"))).toBeNull();
    expect(F.name).toBe("Season 0");
    expect(F.store).toBe("Season 0 has ended, so the Store is closed: nothing is bought, claimed or opened in its archive. Your credits, pack points and cards stay as they are.");
    // The owner's 2026-11-10 rule: unopened packs carry over and open as the next season's packs.
    expect(F.packs).toContain("Unopened packs carry over to the next season and open as its packs.");
    expect(frozenNoteHtml(null, "x")).toBe("");
    expect(frozenNoteHtml(F, F.store)).toBe(`<p class="sh-closed" role="note"><b>Season ended</b> ${F.store}</p>`);
  });

  it("the server's ended refusals are read as such; others are not", () => {
    expect(isSeasonEndedRefusal(409, "season S0 has ended: no pack is bought; the file is the season's archive")).toBe(true);
    expect(isSeasonEndedRefusal(409, "season S0 has ended: auto-play doesn't go on; the file is the season's archive")).toBe(true);
    expect(isSeasonEndedRefusal(409, "the season has ended: no pack is opened")).toBe(true);
    expect(isSeasonEndedRefusal(400, "season S0 has ended: no pack is bought")).toBe(false);
    expect(isSeasonEndedRefusal(409, "not enough credits: 100 needed, 40 held")).toBe(false);
    expect(isSeasonEndedRefusal(404, `match "m1" has ended; see /api/matches/m1`)).toBe(false);
  });

  it("frozen tiles: every button off with the reason; an owned cosmetic keeps Owned; the daily tile has no clock or price", () => {
    const packs = freezeTiles(packTiles(PACKS, 5000, NOW), F.short);
    expect(packs.every((t) => t.closed && !t.button.enabled && t.button.label === "Closed" && t.button.why === "Season ended")).toBe(true);
    const daily = packs.find((t) => t.id === "daily")!;
    expect(daily).toMatchObject({ until: null, badge: null, price: null, sub: "None to claim: the season has ended" });
    // The pack prices stay readable (what a pack cost), the tile greyed.
    expect(packs.find((t) => t.id === "pack-10")!.price).toBe(1000);
    const cos = freezeTiles(cosmeticTiles([COS("coin-a", 300), COS("coin-b", 300, true)], 5000), F.short);
    expect(cos.map((t) => `${t.id}:${t.button.label}:${t.button.enabled}:${t.badge}`)).toEqual(["cos-coin-a:Closed:false:null", "cos-coin-b:Owned:false:Owned"]);
    const html = packs.map((t) => tileHtml(t)).join("") + cos.map((t) => tileHtml(t)).join("");
    expect(live(html, "buy-packs")).toEqual([]);
    expect(live(html, "claim-daily")).toEqual([]);
    expect(live(html, "buy-cosmetic")).toEqual([]);
    expect(html).not.toContain("data-until=");
    expect(html).not.toMatch(/data-(set|item|count)=/); // nothing a stray click could send
    expect((html.match(/class="sh-t [^"]* closed"/g) ?? []).length).toBe(5);
    // Not frozen: unchanged.
    expect(freezeTiles(packTiles(PACKS, 5000, NOW), null)).toEqual(packTiles(PACKS, 5000, NOW));
    expect(SHOP_CSS).toContain(".sh-t.closed .spk-foil { animation: none; opacity: 0; }");
  });

  it("the top bar's Open: off once ended, its hover saying the packs wait", () => {
    expect(openButton(12)).toMatchObject({ enabled: true, label: "Open 12 packs" });
    expect(openButton(12, F.packs)).toMatchObject({ enabled: false, count: 12, label: `12 packs waiting. ${F.packs}` });
    expect(openButton(0, F.packs)).toMatchObject({ enabled: false, label: F.packs });
  });
});

describe("the widgets once the season has ended", () => {
  const D = (over: Partial<WidgetData> = {}): WidgetData => ({
    play: { connectedAgent: null } as unknown as WidgetData["play"],
    wallet: { credits: 5000, packPoints: 400, unopenedPacks: [] },
    packs: PACKS,
    collection: { cards: [], recentPulls: [] } as unknown as WidgetData["collection"],
    daily: null,
    store: { packs: PACKS.offer, dailyPack: DAILY, cosmetics: [COS("coin-s0-neon-nickel", 300)], wallet: { credits: 5000, packPoints: 0, unopenedPacks: [] } } as SiteStore,
    live: null,
    history: null,
    ownerId: "o",
    errors: {},
    now: NOW,
    colFilter: "All",
    frozen: F,
    ...over,
  });
  const at = (type: "store" | "packs", size: "S" | "M" | "L", d = D()) => widgetHtml({ id: "w", type, size }, d, { editing: false });

  it("Store at S, M and L: closed, with the reason, nothing to press", () => {
    for (const size of ["S", "M", "L"] as const) {
      const h = at("store", size);
      for (const act of ["claim-daily", "buy-packs", "buy-cosmetic"]) expect(live(h, act), `${size} ${act}`).toEqual([]);
      expect(h).not.toContain("data-until=");
      expect(h, size).toContain(size === "S" ? "Store closed" : F.store);
      // Open (the same data): the buttons are live.
      expect(live(at("store", size, D({ frozen: null })), size === "S" ? "claim-daily" : "buy-packs").length, size).toBeGreaterThan(0);
    }
  });

  it("Packs at S and M: 12 waiting, Open and Open 10 off, the reason (the packs carry over)", () => {
    const s = at("packs", "S");
    expect(s).toContain('<p class="pkw-n">12<small>unopened</small></p>');
    expect(live(s, "open-packs")).toEqual([]);
    expect(s).toContain('<div class="pkw-x">Season ended</div>');
    const m = at("packs", "M");
    expect(live(m, "open-packs")).toEqual([]);
    expect(m).toContain(F.packs);
    expect(m).not.toContain('class="pity"');
    expect(live(at("packs", "M", D({ frozen: null })), "open-packs")).toHaveLength(2);
  });

  it("Daily rewards: the free pack's node Closed, no next win, no reset clock", () => {
    const d: SiteDaily = { day: "2026-12-27", timeZone: "Australia/Sydney", resetsAt: "2026-12-27T13:00:00.000Z", credits: 0, wins: [], rewardedWins: [], losses: 0, maxPaidLosses: 5, creditsFromLosses: 0, nextWinPays: 30, nextLossPays: 2, schedule: [30, 25, 20], winCap: 75, rewardedCap: 3 } as unknown as SiteDaily;
    expect(packNodeHtml(DAILY, NOW, F)).toContain("disabled");
    expect(packNodeHtml(DAILY, NOW, F)).not.toContain('data-act="claim-daily"');
    for (const size of ["S", "M", "L"] as const) {
      const h = dailyBody(size, d, DAILY, NOW, F);
      expect(h, size).toContain("Season 0 has ended: no more matches pay.");
      expect(h, size).not.toContain("Next win");
      expect(h, size).not.toContain('data-act="claim-daily"');
      expect(h, size).not.toContain("Resets in");
    }
    expect(dailyBody("M", d, DAILY, NOW)).toContain('data-act="claim-daily"');
  });
});

// ---- over the real owner API ----------------------------------------------------------

const PW = "correct horse battery";
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) {
    await r.idle();
    await r.close();
  }
});

describe("the real owner API on an ended season", () => {
  it("GET /api/season reads ended, and every button the frozen page turns off is one the server refuses with words the page knows", async () => {
    const store = EconomyStore.open(":memory:");
    const me = store.createAccount({ name: "ada", username: "ada", password: PW });
    store.grantStarterCollection(me.ownerId, "Swarm");
    store.createAgent({ ownerId: me.ownerId, name: "Vector" });
    store.grantCredits?.(me.ownerId, 5000, "test");
    const before = store.wallet(me.ownerId);
    store.endSeason();
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const { token } = await client.signIn("ada", PW);
    const season = await client.season(token);
    expect(season.state).toBe("ended");
    expect(seasonFrozen(season)).toEqual(F);
    const packs = await client.packs(token);
    const cos = (await client.store(token)).cosmetics.find((c) => !c.owned && c.priceCredits !== null);
    const card = (await client.collection(token)).cards[0]!;
    const tries: [string, () => Promise<unknown>][] = [
      ["buy a pack", () => client.buyPacks(token, packs.offer[0]!.setCode, 1)],
      ["claim the free pack", () => client.claimDailyPack(token)],
      ["auto-play on", () => client.setAutoPlay(token, true, 15)],
      ["craft", () => client.craftCard(token, card.cardId)],
      ["salvage", () => client.salvage(token, card.cardId, 1, true)],
      ...(cos ? [["buy a cosmetic", () => client.buyCosmetic(token, cos.itemId)] as [string, () => Promise<unknown>]] : []),
      ...(before.unopenedPacks.length ? [["open a pack", () => client.openPacks(token, { count: 1 })] as [string, () => Promise<unknown>]] : []),
    ];
    expect(tries.length).toBeGreaterThanOrEqual(6);
    const seen: string[] = [];
    for (const [what, call] of tries) {
      const err = await call().then(() => null, (e: unknown) => e);
      expect(err, what).toBeInstanceOf(SiteApiError);
      const e = err as SiteApiError;
      seen.push(`${what}: ${e.status} ${e.message}`);
      expect(isSeasonEndedRefusal(e.status, e.message), `${what}: ${e.status} ${e.message}`).toBe(true);
    }
    // Nothing moved.
    expect(await client.wallet(token)).toEqual(before);
    expect(seen.length).toBe(tries.length);
  });
});
