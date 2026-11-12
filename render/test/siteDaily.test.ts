// Render session 66: the Daily rewards widget at S, M and L (siteDaily.ts)
// and the larger Showcase (siteWidgets.ts), on fixtures shaped as
// OWNER_API.md documents them for the edge cases, and on the real owner API
// over a real store for the numbers (every figure drawn is the server's).
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { siteApi, type SiteDailyPack } from "../src/site/siteApi.js";
import type { SiteCollection, SiteDaily } from "../src/site/siteBoard.js";
import { dailyBody, dailyRingSvg, packNodeHtml, rewardRowHtml, winSteps } from "../src/site/siteDaily.js";
import { SHOWCASE_SIZES, sourcesOf, widgetHtml, type WidgetData } from "../src/site/siteWidgets.js";
import { SITE_CSS } from "../src/site/sitePage.js";

const NOW = Date.parse("2026-11-12T05:00:00.000Z");
const SCHEDULE = [
  { fromWin: 1, toWin: 1, credits: 30 },
  { fromWin: 2, toWin: 4, credits: 10 },
  { fromWin: 5, toWin: 10, credits: 5 },
  { fromWin: 11, toWin: null, credits: 0 },
];
const win = (nth: number, credits: number) => ({ nth, matchId: `m${nth}`, endedAt: new Date(NOW - (10 - nth) * 600_000).toISOString(), credits });

function daily(wins: number, over: Partial<SiteDaily> = {}): SiteDaily {
  const pay = (n: number) => SCHEDULE.find((r) => r.toWin === null || n <= r.toWin)!.credits;
  const list = Array.from({ length: wins }, (_, i) => win(i + 1, pay(i + 1)));
  const fromWins = list.reduce((a, w) => a + w.credits, 0);
  return {
    day: "2026-11-12", timeZone: "Australia/Sydney", startedAt: "2026-11-11T13:00:00.000Z", resetsAt: "2026-11-12T13:00:00.000Z",
    schedule: SCHEDULE, wins: list, rewardedWins: list.filter((w) => w.credits > 0), losses: 2, maxPaidLosses: 10,
    creditsFromWins: fromWins, creditsFromLosses: 4, credits: fromWins + 4, nextWinPays: pay(wins + 1), nextLossPays: pay(wins + 1) > 0 ? 2 : 0, ...over,
  };
}
const PACK: SiteDailyPack = { setCode: "S0", waiting: 1, cap: 2, day: "2026-11-12", timeZone: "Australia/Sydney", resetsAt: "2026-11-12T13:00:00.000Z", nextPackAt: "2026-11-12T13:00:00.000Z", claimedToday: 0, lastClaimedAt: null };

const clean = (h: string) => expect(h).not.toMatch(/undefined|NaN|\[object|>false<|>null</);
const count = (h: string, re: RegExp) => (h.match(re) ?? []).length;

describe("Daily rewards: the steps of the day", () => {
  it("one node per paying win, from the server's schedule; paid, next and ahead from its wins", () => {
    const s = winSteps(daily(3));
    expect(s.map((x) => x.credits)).toEqual([30, 10, 10, 10, 5, 5, 5, 5, 5, 5]);
    expect(s.map((x) => x.state)).toEqual(["paid", "paid", "paid", "next", "ahead", "ahead", "ahead", "ahead", "ahead", "ahead"]);
    expect(s.map((x) => x.band)).toEqual([0, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
    // Every paying win done: no "next" (the 11th pays nothing).
    expect(winSteps(daily(12)).every((x) => x.state === "paid")).toBe(true);
    expect(winSteps(daily(0))[0]!.state).toBe("next");
    // A paid node shows what the server paid, not the schedule's figure.
    const odd = daily(1, { wins: [win(1, 25)], rewardedWins: [win(1, 25)] });
    expect(winSteps(odd)[0]).toMatchObject({ state: "paid", credits: 25, slot: 30 });
    // Paid out of order (the place counted by end time, the payout by
    // recording order): each node keeps its slot's size, labelled with what was paid.
    const swapped = daily(2, { wins: [win(1, 10), win(2, 30)] });
    const h = rewardRowHtml(swapped, PACK, NOW);
    expect(h).toMatch(/dr-w paid t3"[^>]*title="Win 1: paid 10"/);
    expect(h).toMatch(/dr-w paid t2 band"[^>]*title="Win 2: paid 30"/);
  });
  it("the ring is the server's credits from wins of the day's most, full in gold at the cap", () => {
    const r = dailyRingSvg(40, 90, 72);
    expect(r).toContain('aria-label="40 of 90 credits from wins today"');
    expect(r).toContain("<b>40</b><small>of 90</small>");
    const off = Number(/--off:([\d.]+)/.exec(r)![1]);
    const len = Number(/--len:([\d.]+)/.exec(r)![1]);
    expect(off / len).toBeCloseTo(50 / 90, 2);
    expect(dailyRingSvg(90, 90, 72)).toContain("dr-ring full");
    expect(dailyRingSvg(0, 0, 72)).not.toMatch(/NaN/);
  });
  it("the free pack's node: Claim (with the count) while one waits, else Claimed and the clock to the next", () => {
    expect(packNodeHtml(PACK, NOW)).toContain('data-act="claim-daily">Claim</button>');
    expect(packNodeHtml({ ...PACK, waiting: 2 }, NOW)).toContain(">Claim (2)</button>");
    const done = packNodeHtml({ ...PACK, waiting: 0, claimedToday: 1 }, NOW);
    expect(done).toContain("disabled>Claimed</button>");
    expect(done).toContain(`data-until="${PACK.nextPackAt}">08:00:00</b>`);
    expect(packNodeHtml({ ...PACK, waiting: 0, nextPackAt: null }, NOW)).not.toContain("data-until");
    expect(packNodeHtml(null, NOW)).toContain("Loading…");
    expect(packNodeHtml(null, NOW)).not.toContain("<button");
  });
  it("the row: the pack first, then the wins, a gap between the schedule's rows; wins have no button", () => {
    const h = rewardRowHtml(daily(3), PACK, NOW);
    clean(h);
    expect(count(h, /class="dr-w /g)).toBe(10);
    expect(count(h, /<button/g)).toBe(1);
    expect(count(h, /dr-w [a-z]+ t\d band/g)).toBe(2);
    expect(h.indexOf("dr-pk")).toBeLessThan(h.indexOf("dr-w "));
    expect(h).toContain('title="Win 4: pays 10, next"');
    expect(count(h, /dr-w paid/g)).toBe(3);
  });
});

describe("Daily rewards at S, M and L", () => {
  const d = daily(3);
  it("S is the ring and the next win; M adds the reward row and its claim; L adds the reset clock, rewarded wins, the lists", () => {
    const S = dailyBody("S", d, PACK, NOW), M = dailyBody("M", d, PACK, NOW), L = dailyBody("L", d, PACK, NOW);
    for (const h of [S, M, L]) clean(h);
    expect(S).toContain("dr-ring");
    expect(S).toContain("Next win <b>+10</b>");
    expect(S).not.toContain("dr-row");
    expect(S).not.toContain("<button");
    expect(M).toContain("dr-row");
    expect(M).toContain('data-act="claim-daily"');
    expect(M).toContain("3 of 10 wins paid");
    expect(M).not.toContain("dr-reset");
    expect(L).toContain(`dr-reset`);
    expect(L).toContain(`data-until="${d.resetsAt}">08:00:00</b><small>midnight Sydney</small>`);
    expect(L).toContain("<b>3</b>/10");
    expect(L).toContain('style="width:30%"');
    expect(count(L, /<li><span class="wl w">W<\/span>/g)).toBe(3);
    expect(L).toContain("Losses and draws: <b>2</b> · 2 of 10 paid · +4");
    expect(L).toContain("<b>54</b><small>credits</small>");
    expect(L).toContain("No quests, weekly challenge or streak in Season 0.");
  });
  it("a day with every win paid and no loss left to pay, and a fresh day", () => {
    const full = dailyBody("L", daily(10, { losses: 12, creditsFromLosses: 20 }), PACK, NOW);
    clean(full);
    expect(full).toContain("Wins pay nothing more today");
    expect(full).toContain("dr-ring full");
    expect(full).toContain("10 of 10 paid");
    expect(full).not.toContain("next pays");
    const fresh = dailyBody("L", daily(0, { losses: 0, creditsFromLosses: 0 }), PACK, NOW);
    clean(fresh);
    expect(fresh).toContain("No rewarded wins yet today.");
    expect(fresh).toContain("<b>0</b><small>of 90</small>");
  });
  it("through the widget: S reads only the daily, M and L the packs too; a packs read still out draws the node loading", () => {
    expect(sourcesOf({ type: "daily", size: "S" })).toEqual(["daily"]);
    expect(sourcesOf({ type: "daily", size: "M" })).toEqual(["daily", "packs"]);
    expect(sourcesOf({ type: "daily", size: "L" })).toEqual(["daily", "packs"]);
    const data = { daily: d, packs: null, errors: {}, now: NOW } as unknown as WidgetData;
    const h = widgetHtml({ id: "w", type: "daily", size: "M" }, data, { editing: false });
    expect(h).toContain("dr-pk wait");
    expect(h).toContain("dr-row");
    expect(widgetHtml({ id: "w", type: "daily", size: "M" }, { ...data, daily: null }, { editing: false })).toContain("Loading…");
  });
  it("its motion is transform/opacity/stroke only and stops under reduce motion", () => {
    expect(SITE_CSS).toContain("@keyframes dr-fill { from { stroke-dashoffset: var(--len); } }");
    expect(SITE_CSS).toMatch(/prefers-reduced-motion: reduce\) \{ \.dr-arc, \.dr-pk\.on \.dr-pki, \.dr-w\.next \.dr-wn, \.dr-rw \.bar i \{ animation: none; \}/);
  });
});

describe("Showcase: the same cards, drawn larger", () => {
  const col: SiteCollection = {
    copies: 9, distinctCards: 8, sets: [],
    recentPulls: [],
    cards: Array.from({ length: 8 }, (_, i) => ({
      cardId: `c${i}`, name: i === 0 ? "Crown <Root>" : `Card ${i}`, rarity: i < 2 ? "Mythic" : "Rare", faction: "Cortex", owned: 1, salvageable: 0,
      copies: [{ copyId: `k${i}`, cardId: `c${i}`, finish: i === 0 ? "prototype" : i === 1 ? "gold" : "standard", serial: i === 0 ? 7 : null, runSize: i === 0 ? 50 : null, secretCode: null, acquiredAt: "" }],
    })),
  };
  const data = { collection: col, errors: {}, now: NOW } as unknown as WidgetData;
  const at = (size: "S" | "M" | "L") => widgetHtml({ id: "w", type: "showcase", size }, data, { editing: false });
  it("S one card beside its name; M three, L six, each with its name and finish under it; larger at each size", () => {
    for (const s of ["S", "M", "L"] as const) clean(at(s));
    expect(count(at("S"), /class="mc /g)).toBe(1);
    expect(count(at("M"), /class="mc /g)).toBe(3);
    expect(count(at("L"), /class="mc /g)).toBe(6);
    expect(at("S")).toContain("<b>Crown &lt;Root&gt;</b>");
    expect(count(at("M"), /<figcaption>/g)).toBe(3);
    expect(at("M")).toContain("<small>Mythic · Prototype #7</small>");
    expect(at("S")).not.toContain("<figcaption>");
    expect(SHOWCASE_SIZES.S.scale).toBeLessThan(SHOWCASE_SIZES.M.scale);
    expect(SHOWCASE_SIZES.M.scale).toBeLessThan(SHOWCASE_SIZES.L.scale);
    expect(at("L")).toContain(`--k:${SHOWCASE_SIZES.L.scale}`);
    // The rarest first: the Prototype, then the gold.
    expect(at("M").indexOf("Crown")).toBeLessThan(at("M").indexOf("Card 1"));
  });
  it("the larger face scales its insets and type with the card", () => {
    expect(SITE_CSS).toContain(".mc.lg { width: calc(78px * var(--k));");
    expect(SITE_CSS).toContain(".mc.lg .mc-n { left: calc(6px * var(--k)); right: calc(6px * var(--k)); font-size: calc(9.5px * var(--k)); }");
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

describe("Daily rewards on the real owner API", () => {
  it("draws the server's day (three wins and a loss), and the free pack's claim turns its node to Claimed", async () => {
    const store = EconomyStore.open(":memory:");
    const me = store.createAccount({ name: "ada", username: "ada", password: PW });
    store.grantStarterCollection(me.ownerId, "Swarm");
    const other = store.createAccount({ name: "bob", username: "bob", password: PW });
    store.grantStarterCollection(other.ownerId, "Aegis");
    const a = store.createAgent({ ownerId: me.ownerId, name: "Vector" });
    const b = store.createAgent({ ownerId: other.ownerId, name: "Bastion" });
    ["win", "loss", "win", "win"].forEach((o, i) => store.recordMatch({ matchId: `m${i}`, seed: i, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: o === "win" ? a.agentId : b.agentId }, endedAt: new Date(Date.now() - (4 - i) * 1000).toISOString() }));
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const { token } = await client.signIn("ada", PW);
    const [d, packs] = await Promise.all([client.daily(token), client.packs(token)]);
    expect(d.wins).toHaveLength(3);
    const now = Date.now();
    const L = dailyBody("L", d, packs.dailyPack, now);
    clean(L);
    const cap = d.schedule.reduce((x, r) => x + (r.toWin === null ? 0 : (r.toWin - r.fromWin + 1) * r.credits), 0);
    expect(L).toContain(`<b>${d.creditsFromWins}</b><small>of ${cap}</small>`);
    expect(count(L, /dr-w paid/g)).toBe(3);
    expect(L).toContain(`Next win <b>+${d.nextWinPays}</b>`);
    expect(L).toContain(`Losses and draws: <b>${d.losses}</b>`);
    expect(L).toContain(`data-until="${d.resetsAt}"`);
    expect(L).toContain(`<b>${d.credits}</b><small>credits</small>`);
    // The free pack: claimable, then claimed through the server.
    expect(packs.dailyPack.waiting).toBeGreaterThan(0);
    expect(dailyBody("M", d, packs.dailyPack, now)).toContain('data-act="claim-daily"');
    await client.claimDailyPack(token);
    const after = await client.packs(token);
    const M = dailyBody("M", d, after.dailyPack, now);
    if (after.dailyPack.waiting === 0) {
      expect(M).toContain("disabled>Claimed</button>");
      if (after.dailyPack.nextPackAt) expect(M).toContain(`data-until="${after.dailyPack.nextPackAt}"`);
    } else expect(M).toContain(`Claim${after.dailyPack.waiting > 1 ? ` (${after.dailyPack.waiting})` : ""}</button>`);
  });
});
