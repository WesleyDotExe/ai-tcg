// Render session 74 (hardening): the season's end, the thin spots session 73
// left. Once the season has ENDED: the Daily rewards row marks no win as the
// next one; a finished opening's summary turns its open buttons off with the
// reason; the loadout picker's Buy is off ("Closed") while Equip still works,
// as the server allows; the Stats page's season line counts down on the
// page's clock. Pure fixtures for the drawing; the real owner API over a real
// ended store for "equip still works, buy is refused".
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { SiteApiError, siteApi } from "../src/site/siteApi.js";
import type { SiteDaily } from "../src/site/siteBoard.js";
import { dailyBody, rewardRowHtml, winSteps } from "../src/site/siteDaily.js";
import { isSeasonEndedRefusal, seasonEndView, seasonFrozen, type SiteSeason } from "../src/site/siteSeason.js";
import { summaryButtons, summaryWhy } from "../src/site/siteStore.js";
import { loadoutLockAction } from "../src/loadoutPicker.js";
import { loadoutPayload } from "../src/site/siteLoadout.js";

const NOW = Date.parse("2026-12-27T01:00:00.000Z");
const S = (state: SiteSeason["state"], endsAt = "2026-12-26T13:00:00.000Z"): SiteSeason => ({ season: "S0", state, endedAt: state === "ended" ? "2026-12-26T13:02:35.000Z" : null, endsAt, liveMatches: 0, tierCoinsNow: null, you: null, standings: null, retiredPrototypes: null, startedFrom: null, yourSeed: null });
const F = seasonFrozen(S("ended"))!;

// Season 0's schedule shape (two paid wins, then the next would be the 3rd).
const DAY: SiteDaily = {
  day: "2026-12-27",
  timeZone: "Australia/Sydney",
  startedAt: "2026-12-26T13:00:00.000Z",
  resetsAt: "2026-12-27T13:00:00.000Z",
  credits: 57,
  creditsFromWins: 55,
  wins: [
    { nth: 1, matchId: "m1", credits: 30, endedAt: "2026-12-26T09:00:00.000Z" },
    { nth: 2, matchId: "m2", credits: 25, endedAt: "2026-12-26T10:00:00.000Z" },
  ],
  rewardedWins: [
    { nth: 1, matchId: "m1", credits: 30, endedAt: "2026-12-26T09:00:00.000Z" },
    { nth: 2, matchId: "m2", credits: 25, endedAt: "2026-12-26T10:00:00.000Z" },
  ],
  losses: 1,
  maxPaidLosses: 5,
  creditsFromLosses: 2,
  nextWinPays: 20,
  nextLossPays: 2,
  schedule: [
    { fromWin: 1, toWin: 1, credits: 30 },
    { fromWin: 2, toWin: 2, credits: 25 },
    { fromWin: 3, toWin: 5, credits: 20 },
    { fromWin: 6, toWin: null, credits: 0 },
  ],
};

describe("Daily rewards after the end: no next win", () => {
  it("open: the 3rd win is marked next; ended: no slot is next, the paid two stay ticked, the row is closed", () => {
    expect(winSteps(DAY).map((s) => s.state)).toEqual(["paid", "paid", "next", "ahead", "ahead"]);
    const open = rewardRowHtml(DAY, null, NOW);
    expect(open).toContain('class="dr-w next');
    expect(open).toContain("pays 20, next");
    const shut = rewardRowHtml(DAY, null, NOW, F);
    expect(shut).not.toMatch(/class="dr-w next/);
    expect(shut).not.toContain(", next");
    expect(shut).toContain('class="dr-row closed"');
    expect((shut.match(/class="dr-w paid/g) ?? []).length).toBe(2);
    // An unpaid slot no longer promises a payout.
    expect(shut).toContain('title="Win 3: no match is left to win it, the season has ended"');
    expect(shut).not.toContain('title="Win 3: pays 20');
  });

  it("at M and L the row is the closed one; at L the losses line drops its 'next pays'", () => {
    for (const size of ["M", "L"] as const) expect(dailyBody(size, DAY, null, NOW, F), size).not.toMatch(/class="dr-w next/);
    expect(dailyBody("L", DAY, null, NOW)).toContain("(next pays 2)");
    expect(dailyBody("L", DAY, null, NOW, F)).not.toContain("next pays");
    // What was earned stays on the page.
    expect(dailyBody("L", DAY, null, NOW, F)).toContain("+30");
    expect(dailyBody("M", DAY, null, NOW, F)).toContain('aria-label="55 of 115 credits from wins today"');
  });
});

describe("a finished opening's summary after the end", () => {
  it("single: Open another off with the packs' reason, Done leads", () => {
    const b = summaryButtons("single", 11, 10, F.packs);
    expect(b.map((x) => [x.act, x.enabled, x.primary])).toEqual([["one", false, false], ["done", true, true]]);
    expect(summaryWhy(b)).toEqual([F.packs]);
  });
  it("ten: Open 10 more and Open one off, Done leads, the reason once", () => {
    const b = summaryButtons("bulk", 30, 10, F.packs);
    expect(b.map((x) => [x.act, x.label, x.enabled, x.primary])).toEqual([["ten", "Open 10 more", false, false], ["one", "Open one pack", false, false], ["done", "Done", true, true]]);
    expect(summaryWhy(b)).toEqual([F.packs]);
  });
  it("open: unchanged (the packs waiting decide)", () => {
    expect(summaryButtons("single", 3, 10).map((x) => [x.act, x.enabled, x.primary])).toEqual([["one", true, true], ["done", true, false]]);
    expect(summaryButtons("bulk", 30, 10, null)[0]).toMatchObject({ act: "ten", enabled: true, primary: true });
  });
});

describe("the loadout picker's Buy after the end", () => {
  it("site mode with the Store closed: 'closed', with the reason; standalone and open: as before", () => {
    expect(loadoutLockAction(true, 300, 5000, F.cosmetics)).toEqual({ kind: "closed", price: 300, why: F.cosmetics });
    expect(loadoutLockAction(true, 300, 5000, null)).toEqual({ kind: "buy", price: 300 });
    expect(loadoutLockAction(true, 300, 100)).toEqual({ kind: "plate", price: 300, short: true });
    // Standalone (the committed picker page) never says closed.
    expect(loadoutLockAction(false, 300, 5000, F.cosmetics)).toEqual({ kind: "plate", price: 300, short: false });
    // Owned or empty tiles have no lock either way.
    expect(loadoutLockAction(true, null, 5000, F.cosmetics)).toEqual({ kind: "none" });
    expect(F.cosmetics).toBe("Season 0 has ended, so the Store is closed: nothing more is bought. What you own still equips.");
  });
});

describe("the Stats page's season line on the page's clock", () => {
  it("counts down and turns 'Ending now' once the page's clock passes the end time", () => {
    const end = Date.parse("2026-12-26T13:00:00.000Z");
    const s = S("open");
    expect(seasonEndView(s, end - 125_000)!.chip).toBe("Ends in 2 min");
    expect(seasonEndView(s, end - 65_000)!.chip).toBe("Ends in 1 min");
    expect(seasonEndView(s, end - 30_000)!.chip).toBe("Ends in under a minute");
    const past = seasonEndView(s, end + 1000)!;
    expect(past.tone).toBe("ending");
    expect(past.chip).toBe("Ending now");
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

describe("the real owner API on an ended season: the picker's two buttons", () => {
  it("a cosmetic buy is refused with words the page knows; equipping what the owner holds still saves; the picker's data says closed", async () => {
    const store = EconomyStore.open(":memory:");
    const me = store.createAccount({ name: "ada", username: "ada", password: PW });
    store.grantStarterCollection(me.ownerId, "Swarm");
    const agent = store.createAgent({ ownerId: me.ownerId, name: "Vector" });
    store.grantCredits?.(me.ownerId, 5000, "test");
    store.endSeason();
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const { token } = await client.signIn("ada", PW);
    expect((await client.season(token)).state).toBe("ended");
    const shop = await client.store(token);
    const forSale = shop.cosmetics.find((c) => !c.owned && c.priceCredits !== null)!;
    expect(forSale).toBeTruthy();
    const err = await client.buyCosmetic(token, forSale.itemId).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(SiteApiError);
    expect(isSeasonEndedRefusal((err as SiteApiError).status, (err as SiteApiError).message)).toBe(true);

    // Equip: empty the boast slot, then put the starter boast back.
    const before = await client.loadout(token, agent.agentId);
    const boast = before.loadout.boast;
    expect(boast).not.toBeNull();
    const emptied = await client.setLoadout(token, agent.agentId, "boast", null);
    expect(emptied.loadout.boast).toBeNull();
    const back = await client.setLoadout(token, agent.agentId, "boast", boast);
    expect(back.loadout.boast).toBe(boast);

    // The picker's data with the reason: every locked tile is still there
    // (with its price), and the scenario carries the closed line.
    const [play, loadout, owned, collection] = await Promise.all([client.play(token), client.loadout(token, agent.agentId), client.cosmetics(token), client.collection(token)]);
    const a = play.agents.find((x) => x.agentId === agent.agentId)!;
    const x = { agent: a, loadout, owned: owned.owned, onSale: shop.cosmetics, play, collection, credits: shop.wallet.credits };
    const shut = loadoutPayload({ ...x, storeClosed: seasonFrozen(await client.season(token))!.cosmetics });
    expect(shut.scenario.storeClosed).toBe(F.cosmetics);
    const locked = shut.scenario.slots.flatMap((s) => s.tiles).filter((t) => !t.owned && t.itemId !== null);
    expect(locked.length).toBeGreaterThan(0);
    expect(locked.every((t) => loadoutLockAction(true, t.priceCredits, shut.scenario.credits, shut.scenario.storeClosed).kind === "closed")).toBe(true);
    expect(loadoutPayload(x).scenario.storeClosed).toBeUndefined();
  });
});
