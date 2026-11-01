// The Store page and pack opening on the website (render session 47): the
// pure model (siteStore.ts), the pack-opening page's site mode, the host's
// /pack-opening page and its headers, and the API client's opening and
// daily-pack calls against the game lane's real owner API (its own code,
// unchanged, over an in-memory store).

import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { planBulkReveal, planReveal } from "../src/packOpening.js";
import { renderPackOpeningHtml } from "../src/packPage.js";
import { SiteApiError, siteApi, type SiteDailyPack } from "../src/site/siteApi.js";
import type { SiteCollection, SitePacks } from "../src/site/siteBoard.js";
import { startSiteHost, type RunningSiteHost } from "../src/site/siteHost.js";
import { renderSitePackPage, renderSitePage, siteScript } from "../src/site/sitePage.js";
import {
  BUY_MAX,
  buyView,
  dailyPackView,
  recentOpenings,
  revealOf,
  shortWhen,
  soundPatchOf,
  soundPrefOf,
  sourceName,
  summaryButtons,
  summaryWhy,
  unopenedGroups,
  zoneCity,
} from "../src/site/siteStore.js";

const PW = "a long test password";
const running: (RunningOwnerApi | RunningSiteHost)[] = [];
afterEach(async () => {
  while (running.length) await running.pop()!.close();
});

/** Real openings from the store (seeded), the shapes the API sends. */
function openings() {
  const store = EconomyStore.open(":memory:");
  const o = store.createAccount({ name: "tess", username: "tess", password: PW });
  for (let i = 0; i < 11; i++) store.grantPack(o.ownerId, "S0", "weeklyChallenge");
  const one = store.openPack(o.ownerId, undefined, { seed: 77 });
  const ten = store.openPacks(o.ownerId, 10, { seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  store.close();
  return { one, ten };
}

describe("an opening's answer, as the reveal plays it", () => {
  const { one, ten } = openings();
  it("one pack plays as one pack: the same plan the standalone pages make from the same opening", () => {
    const r = revealOf({ packs: [one], summary: null });
    expect(r.kind).toBe("single");
    expect(r.reveal).toEqual(planReveal(one));
    // Survives the trip through JSON (what the browser gets).
    expect(revealOf(JSON.parse(JSON.stringify({ packs: [one], summary: null }))).reveal).toEqual(planReveal(one));
  });
  it("ten packs with the server's summary play as a ten-pack open, its summary the server's own", () => {
    const r = revealOf({ packs: ten.packs, summary: ten.summary });
    expect(r.kind).toBe("bulk");
    expect(r.reveal).toEqual(planBulkReveal(ten));
    if (r.kind === "bulk") expect(r.reveal.summary).toBe(ten.summary);
  });
  it("the plan holds exactly the opened copies (nothing rolled, dropped or added)", () => {
    const r = revealOf({ packs: [one], summary: null });
    expect(r.reveal.cards.map((c) => c.copyId).sort()).toEqual(one.cards.map((c) => c.copyId).sort());
  });
  it("refuses an answer it can't read rather than guess", () => {
    expect(() => revealOf({ packs: [], summary: null })).toThrow(/no packs/);
    expect(() => revealOf({ packs: [one], summary: ten.summary })).toThrow(/single pack/);
    expect(() => revealOf({ packs: ten.packs, summary: null })).toThrow(/without their summary/);
  });
});

describe("the summary's buttons", () => {
  it("one pack: Open another while packs wait, else greyed with the reason; Done", () => {
    expect(summaryButtons("single", 3, 10).map((b) => [b.act, b.label, b.enabled, b.primary])).toEqual([
      ["one", "Open another", true, true],
      ["done", "Done", true, false],
    ]);
    const none = summaryButtons("single", 0, 10);
    expect(none[0]!.enabled).toBe(false);
    expect(none[1]!.primary).toBe(true);
    expect(summaryWhy(none)).toEqual(["No packs waiting. Buy more in the Store, or claim your free daily pack."]);
  });
  it("ten packs: Open 10 more only with ten waiting (the server's count), else the reason; Open one; Done", () => {
    const full = summaryButtons("bulk", 12, 10);
    expect(full.map((b) => [b.label, b.enabled, b.primary])).toEqual([
      ["Open 10 more", true, true],
      ["Open one pack", true, false],
      ["Done", true, false],
    ]);
    const some = summaryButtons("bulk", 4, 10);
    expect(some.map((b) => [b.enabled, b.primary])).toEqual([
      [false, false],
      [true, true],
      [true, false],
    ]);
    expect(summaryWhy(some)).toEqual(["Opening 10 at once needs 10 packs waiting; you have 4."]);
    // With none, one reason, not two.
    expect(summaryWhy(summaryButtons("bulk", 0, 10))).toEqual(["No packs waiting. Buy more in the Store, or claim your free daily pack."]);
    // The count is the server's, not a constant.
    expect(summaryButtons("bulk", 5, 5)[0]).toMatchObject({ label: "Open 5 more", enabled: true });
  });
});

describe("the Store page's lines", () => {
  const status = (over: Partial<SiteDailyPack>): SiteDailyPack => ({
    setCode: "S0", waiting: 1, cap: 2, day: "2026-11-01", timeZone: "Australia/Sydney", resetsAt: "2026-11-01T13:00:00.000Z", nextPackAt: "2026-11-01T13:00:00.000Z", claimedToday: 0, lastClaimedAt: null, ...over,
  });
  const now = Date.parse("2026-11-01T08:30:00.000Z");
  it("the free daily pack: what waits and when the next comes in, from the server's status", () => {
    expect(dailyPackView(status({}), now)).toEqual({ waiting: 1, cap: 2, canClaim: true, button: "Claim free daily pack", line: "1 free pack waiting. The next comes in 4 h 30 min (midnight Sydney)." });
    expect(dailyPackView(status({ waiting: 0, claimedToday: 1 }), now)).toMatchObject({ canClaim: false, line: "Claimed today. The next comes in 4 h 30 min (midnight Sydney)." });
    // The most that can wait: nothing comes in until one is claimed (no countdown).
    expect(dailyPackView(status({ waiting: 2, nextPackAt: null }), now)).toMatchObject({ canClaim: true, button: "Claim free daily pack (2)", line: "2 free packs waiting, the most that can wait. Claim one to start the timer to the next." });
    expect(zoneCity("America/Los_Angeles")).toBe("Los Angeles");
  });
  it("buying: 1 to 10, the total and how many credits short", () => {
    const offer = { setCode: "S0", name: "Season Zero", priceCredits: 100 };
    expect(buyView(offer, 2, 242)).toEqual({ count: 2, price: 100, total: 200, canAfford: true, short: 0 });
    expect(buyView(offer, 3, 242)).toMatchObject({ canAfford: false, short: 58 });
    expect(buyView(offer, 0, 0).count).toBe(1);
    expect(buyView(offer, 99, 0).count).toBe(BUY_MAX);
    expect(buyView(offer, Number.NaN, 0).count).toBe(1);
  });
  it("the waiting packs grouped by where they came from, oldest first; each row opens its oldest", () => {
    const u: SitePacks["unopened"] = [
      { packId: "a", setCode: "S0", source: "starter", acquiredAt: "2026-11-01T00:00:00.000Z" },
      { packId: "b", setCode: "S0", source: "ownerDaily", acquiredAt: "2026-11-01T01:00:00.000Z" },
      { packId: "c", setCode: "S0", source: "starter", acquiredAt: "2026-11-01T02:00:00.000Z" },
    ];
    expect(unopenedGroups(u).map((g) => [g.name, g.count, g.oldestPackId])).toEqual([
      ["Starter pack", 2, "a"],
      ["Free daily pack", 1, "b"],
    ]);
    expect(sourceName("purchase")).toBe("Bought");
    expect(sourceName("somethingNew")).toBe("somethingNew");
    expect(shortWhen("2026-11-01T08:40:00.000Z", "Australia/Sydney")).toBe("1 Nov, 19:40");
    expect(shortWhen("not a date")).toBe("not a date");
  });
  it("recent openings: the cards with their factions (from the collection), the best finish in words", () => {
    const c = {
      cards: [{ cardId: "CX-001", faction: "Cortex" }],
      recentPulls: [
        { packId: "p2", setCode: "S0", openedAt: "x", jackpot: true, cards: [{ copyId: "1", cardId: "CX-001", name: "A", rarity: "Common", finish: "foil", secretCode: null, serial: null, held: true }, { copyId: "2", cardId: "NT-9", name: "B", rarity: "Rare", finish: "gold", secretCode: null, serial: null, held: true }] },
        { packId: "p1", setCode: "S0", openedAt: "y", jackpot: false, cards: [{ copyId: "3", cardId: "CX-001", name: "A", rarity: "Common", finish: "standard", secretCode: null, serial: null, held: false }] },
      ],
    } as unknown as SiteCollection;
    const r = recentOpenings(c, 5);
    expect(r.map((o) => [o.packId, o.best, o.jackpot])).toEqual([
      ["p2", "Gold", true],
      ["p1", "", false],
    ]);
    expect(r[0]!.cards.map((k) => k.faction)).toEqual(["Cortex", null]);
    expect(recentOpenings(c, 1)).toHaveLength(1);
  });
  it("sound: the account's setting to the reveal's player and back; anything unreadable sends nothing", () => {
    expect(soundPrefOf({ on: true, volume: 80 })).toEqual({ muted: false, volume: 0.8 });
    expect(soundPrefOf({ on: false, volume: 140 })).toEqual({ muted: true, volume: 1 });
    expect(soundPatchOf(JSON.stringify({ muted: true, volume: 0.8 }))).toEqual({ on: false, volume: 80 });
    expect(soundPatchOf(JSON.stringify({ muted: false, volume: 0.333 }))).toEqual({ on: true, volume: 33 });
    expect(soundPatchOf("{")).toBeNull();
    expect(soundPatchOf(JSON.stringify({ muted: "no", volume: 0.5 }))).toBeNull();
    expect(soundPatchOf(JSON.stringify({ muted: false, volume: 2 }))).toBeNull();
  });
});

describe("the pack-opening page's site mode", () => {
  const html = renderSitePackPage();
  it("starts empty: no packs embedded, a Close button, the picker hidden", () => {
    expect(html).toContain('<html lang="en" data-theme="dark" class="site">');
    expect(html).toContain('id="close"');
    const data = JSON.parse(/<script type="application\/json" id="pack-data">(.*?)<\/script>/s.exec(html)![1]!);
    expect(data).toMatchObject({ packs: [], bulks: [], site: true });
  });
  it("the standalone page is unchanged by it (no Close button, no site class)", () => {
    const plain = renderPackOpeningHtml({ title: "t", packs: [] });
    expect(plain).not.toContain('id="close"');
    expect(plain).not.toContain('class="site"');
  });
  it("the website's bundle carries the planner (built with the economy resolved to its pure pack file)", () => {
    const js = siteScript();
    expect(js).toContain("PACK_SITE_HOST");
    expect(js).not.toMatch(/node:sqlite|node:crypto/);
    expect(renderSitePage()).toContain('<div id="opening" class="opening" hidden');
  });
});

describe("opening and the daily pack, through the host, over the real owner API", () => {
  async function stack() {
    const store = EconomyStore.open(":memory:");
    const owner = store.createAccount({ name: "ada", username: "ada", password: PW });
    store.grantStarterCollection(owner.ownerId, "Swarm");
    for (let i = 0; i < 10; i++) store.grantPack(owner.ownerId, "S0", "weeklyChallenge");
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
    running.push(api);
    const host = await startSiteHost({ api: `http://localhost:${api.port}`, port: 0 });
    running.push(host);
    const base = `http://127.0.0.1:${host.port}`;
    const client = siteApi((u, i) => fetch(u, i), base);
    const { token } = await client.signIn("ada", PW);
    return { store, owner, client, token, base };
  }

  it("serves the pack opening's page: framed only by the site, fetching nothing; the site may frame only itself", async () => {
    const { base } = await stack();
    const res = await fetch(`${base}/pack-opening`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(renderSitePackPage());
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("connect-src");
    expect((await fetch(`${base}/`)).headers.get("content-security-policy")).toContain("frame-src 'self'");
    expect((await fetch(`${base}/pack-opening`, { method: "POST" })).status).toBe(405);
  });

  it("opens the oldest pack, a chosen one and ten; each answer plays; the store's refusals come back", async () => {
    const { client, token, store, owner } = await stack();
    const before = store.unopenedPacks(owner.ownerId);
    expect(before.length).toBe(13); // the starter grant's 3, and 10
    const one = await client.openPacks(token, { count: 1 });
    expect(one.packs).toHaveLength(1);
    expect(one.packs[0]!.packId).toBe(before[0]!.packId);
    expect(one.summary).toBeNull();
    expect(revealOf(one).kind).toBe("single");
    expect(one.wallet.unopenedPacks).toHaveLength(12);
    const chosen = before.at(-1)!.packId;
    const pick = await client.openPacks(token, { packId: chosen });
    expect(pick.packs[0]!.packId).toBe(chosen);
    const ten = await client.openPacks(token, { count: 10 });
    expect(ten.packs).toHaveLength(10);
    const r = revealOf(ten);
    expect(r.kind).toBe("bulk");
    if (r.kind === "bulk") expect(r.reveal.tiles.reduce((n, t) => n + t.count, 0)).toBe(ten.summary!.cards);
    // One left: ten is refused, as is a pack already opened.
    const err = await client.openPacks(token, { count: 10 }).catch((e: unknown) => e);
    expect((err as SiteApiError).status).toBe(409);
    expect((await client.openPacks(token, { packId: chosen }).catch((e: unknown) => e) as SiteApiError).status).toBe(404);
  });

  it("the daily pack: read, claimed (it waits to be opened), and refused when none waits", async () => {
    const { client, token } = await stack();
    const d = await client.dailyPack(token);
    expect(d).toMatchObject({ waiting: 1, cap: 2, timeZone: "Australia/Sydney" });
    expect(dailyPackView(d, Date.now()).canClaim).toBe(true);
    const c = await client.claimDailyPack(token);
    expect(c.pack.source).toBe("ownerDaily");
    expect(c.dailyPack.waiting).toBe(0);
    expect(c.wallet.unopenedPacks.some((p) => p.packId === c.pack.packId)).toBe(true);
    const again = await client.claimDailyPack(token).catch((e: unknown) => e);
    expect(again).toBeInstanceOf(SiteApiError);
    expect((again as SiteApiError).status).toBe(409);
    // The Store page's reads carry it too.
    expect((await client.packs(token)).dailyPack.waiting).toBe(0);
    expect((await client.store(token)).dailyPack.waiting).toBe(0);
  });
});
