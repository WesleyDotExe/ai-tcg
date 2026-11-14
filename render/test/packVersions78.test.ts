// Render session 78: a pulled card's versions in the pack page's viewer
// (render debt from session 75: "the versions row is in the Collection's
// viewer only, not in the pack reveal or its summary"). Against real store
// openings and binders, and the real owner API (the site's own path: the
// open, then the binder read after it).

import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { isBoosterCard } from "@ai-tcg/engine";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { debugSeedFor, openBulkShowcase, openDebugPacks, openShowcase } from "../src/packDemo.js";
import { planBulkReveal, planReveal, type RevealCard } from "../src/packOpening.js";
import { renderPackOpeningHtml } from "../src/packPage.js";
import { pullVersionsOf, versionsLine, withBulkPullVersions, withPullVersions, type VersionsBinder } from "../src/packVersions.js";
import { siteApi } from "../src/site/siteApi.js";
import { revealOf, withSiteVersions } from "../src/site/siteStore.js";
import { versionsOf, type SiteBinder } from "../src/site/siteCollection.js";

const CLOCK = () => new Date("2026-11-10T12:00:00.000Z");

/** A fresh owner opens the first seed whose best card is `step`. */
function openKind(step: Parameters<typeof debugSeedFor>[0]) {
  const store = EconomyStore.open(":memory:", { now: CLOCK });
  const owner = store.createOwner({ name: "v78" }).ownerId;
  store.grantPack(owner, "S0", "weeklyChallenge");
  const opening = store.openPack(owner, undefined, { seed: debugSeedFor(step) });
  const binder = store.binder(owner, "S0");
  store.close();
  return { opening, binder, reveal: withPullVersions(planReveal(opening), binder) };
}
const best = (cards: RevealCard[]) => cards.reduce((a, c) => (c.build.level >= a.build.level ? c : a));

describe("which version a pull is", () => {
  const cases = [
    ["gold", "gold", "Gold"],
    ["glitch", "glitch", "Glitch"],
    ["secret", "secret", "Illustration"],
    ["prototype", "prototype", /^Prototype \/\d+$/],
    ["fullArt", "fullArt", "Set"],
    ["altArt", "altArt", "Set"],
  ] as const;
  for (const [step, finish, label] of cases) {
    it(`a ${step} pull: its own version ringed and held, the rest of the card's versions listed from the binder`, () => {
      const { reveal, binder } = openKind(step);
      const c = best(reveal.cards);
      expect(c.finish).toBe(finish);
      expect(isBoosterCard(c.cardId)).toBe(true);
      const v = c.versions!;
      expect(v).toBeTruthy();
      const cur = v.chips.filter((x) => x.current);
      expect(cur.length).toBe(1);
      expect(cur[0]!.label).toMatch(label);
      expect(cur[0]!.held).toBe(true);
      // The chip's number is the pull's own: the printed number, or the run code.
      expect(cur[0]!.number).toBe(c.prototype ? c.prototype.runCode : c.collectorNumber);
      // Every chip is a binder place of this card, nothing invented.
      const places = [
        ...binder.base.entries, ...binder.secrets.entries, ...binder.glitch.entries, ...binder.gold.entries,
      ].filter((e) => e.cardId === c.cardId).map((e) => e.number).concat(binder.prototypes.filter((r) => r.cardId === c.cardId).map((r) => r.runCode));
      expect(v.chips.map((x) => x.number).sort()).toEqual(places.sort());
      expect(v.held).toBe(v.chips.filter((x) => x.held).length);
      expect(v.line).toBe(versionsLine(v));
      expect(cur[0]!.words).toMatch(/this pull, held$/);
    });
  }

  it("every card of a pack gets them (a plain Common too); a Zero-Day pull gets none", () => {
    const { reveal } = openKind("foil");
    expect(reveal.cards.every((c) => c.versions && c.versions.total >= 2)).toBe(true);
    const zd = openKind("zeroDay");
    const z = zd.reveal.cards.find((c) => c.finish === "zeroDay")!;
    expect(z.versions).toBe(null);
    expect(pullVersionsOf({ cardId: z.cardId, finish: "zeroDay", secret: z.secret, prototype: null }, zd.binder)).toBe(null);
  });

  it("agrees with the Collection viewer's row (session 75) for the same card and binder", () => {
    const { reveal, binder } = openKind("gold");
    const c = best(reveal.cards);
    const site = JSON.parse(JSON.stringify(binder)) as SiteBinder;
    const goldEntry = site.gold.entries.find((e) => e.cardId === c.cardId)!;
    const row = versionsOf({ cardId: c.cardId, key: `gold:${goldEntry.cardId}`, kind: "gold" }, site, { copies: 0, distinctCards: 0, cards: [], sets: [], recentPulls: [] });
    expect(row.map((x) => [x.label, x.number, x.held])).toEqual(c.versions!.chips.map((x) => [x.label, x.number, x.held]));
    expect(row.find((x) => x.current)!.label).toBe("Gold");
  });

  it("the binder read before the open would say the pull isn't held: the page reads it after", () => {
    const store = EconomyStore.open(":memory:", { now: CLOCK });
    const owner = store.createOwner({ name: "v78" }).ownerId;
    store.grantPack(owner, "S0", "weeklyChallenge");
    const before = store.binder(owner, "S0");
    const opening = store.openPack(owner, undefined, { seed: debugSeedFor("gold") });
    const after = store.binder(owner, "S0");
    store.close();
    const g = best(planReveal(opening).cards);
    expect(pullVersionsOf(g, before)!.chips.find((x) => x.current)!.held).toBe(false);
    expect(pullVersionsOf(g, after)!.chips.find((x) => x.current)!.held).toBe(true);
    // The store's binder counts any copy of a card in its set place, so a
    // first Gold copy fills both the Gold place and the Set place, as the
    // Collection's viewer shows it.
    const set = (v: ReturnType<typeof pullVersionsOf>) => v!.chips.find((x) => x.kind === "set")!.held;
    expect(set(pullVersionsOf(g, after))).toBe(true);
    expect(pullVersionsOf(g, after)!.held).toBe(pullVersionsOf(g, before)!.held + (set(pullVersionsOf(g, before)) ? 1 : 2));
  });

  it("a binder of another set leaves the reveal alone", () => {
    const { opening, binder } = openKind("gold");
    const other: VersionsBinder = { ...binder, setCode: "S1" };
    const r = withPullVersions(planReveal(opening), other);
    expect(r.cards.every((c) => c.versions === undefined)).toBe(true);
  });
});

describe("the ten-pack open", () => {
  it("every pack's cards and every summary tile carry the versions", () => {
    const store = EconomyStore.open(":memory:", { now: CLOCK });
    const owner = store.createOwner({ name: "v78" }).ownerId;
    for (let i = 0; i < 10; i++) store.grantPack(owner, "S0", "weeklyChallenge");
    const bulk = withBulkPullVersions(planBulkReveal(store.openPacks(owner, 10, { seeds: Array.from({ length: 10 }, (_, k) => 300 + k) })), store.binder(owner, "S0"));
    store.close();
    expect(bulk.tiles.length).toBeGreaterThan(10);
    for (const t of bulk.tiles) {
      expect(t.versions).toBeTruthy();
      expect(t.versions!.chips.filter((x) => x.current).length).toBe(1);
      expect(t.versions!.chips.find((x) => x.current)!.held).toBe(true);
    }
    expect(bulk.packs.every((p) => p.cards.every((c) => c.versions))).toBe(true);
  });
});

describe("the demo page", () => {
  it("the showcase, the tens and the debug panel's packs all carry them, and the page has the row's code", () => {
    const show = openShowcase();
    for (const s of show) for (const c of s.reveal.cards) if (c.finish !== "zeroDay") expect(c.versions?.chips.length).toBeGreaterThan(1);
    const debug = openDebugPacks(["gold", "glitch", "secret", "prototype"]);
    for (const d of debug.single) expect(best(d.reveal.cards).versions!.chips.find((x) => x.current)!.held).toBe(true);
    for (const d of debug.bulk) expect(d.reveal.tiles.every((t) => t.finish === "zeroDay" || t.versions)).toBe(true);
    const html = renderPackOpeningHtml({ title: "t", packs: show.slice(0, 2), bulks: openBulkShowcase().slice(0, 1) });
    expect(html).toContain('id="vvers"');
    expect(html).toContain("function viewerVersions");
    expect(html).toContain('"versions":{"chips":[');
  });
});

describe("the site: the real owner API, then the binder read after the open", () => {
  const running: RunningOwnerApi[] = [];
  afterEach(async () => {
    for (const r of running.splice(0)) {
      await r.idle();
      await r.close();
    }
  });
  it("a single pack and a ten-pack open, each card's versions from GET /api/collection/binder/S0", async () => {
    const PW = "a long test password";
    const store = EconomyStore.open(":memory:");
    const me = store.createAccount({ name: "ada", username: "ada", password: PW });
    store.grantStarterCollection(me.ownerId, "Swarm");
    for (let i = 0; i < 11; i++) store.grantPack(me.ownerId, "S0", "weeklyChallenge");
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const { token } = await client.signIn("ada", PW);

    const one = revealOf(await client.openPacks(token, { count: 1 }));
    const b1 = await client.binder(token, "S0");
    const r1 = withSiteVersions(one, b1);
    if (r1.kind !== "single") throw new Error("expected a single pack");
    for (const c of r1.reveal.cards) {
      if (c.finish === "zeroDay") continue;
      expect(c.versions!.chips.find((x) => x.current)!.held).toBe(true);
    }

    const ten = revealOf(await client.openPacks(token, { count: 10 }));
    const r10 = withSiteVersions(ten, await client.binder(token, "S0"));
    if (r10.kind !== "bulk") throw new Error("expected a ten-pack open");
    expect(r10.reveal.tiles.every((t) => t.finish === "zeroDay" || t.versions!.chips.find((x) => x.current)!.held)).toBe(true);
    // No binder, no row: the opening plays the same without it.
    expect(withSiteVersions(one, null)).toBe(one);
  });
});
