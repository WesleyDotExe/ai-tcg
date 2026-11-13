// Render session 70: the notifications bell (siteBell.ts). Pure state and
// HTML on fixtures shaped as server/OWNER_API.md documents them, then the
// bell's own calls (pages, a kind filter, read by id, clear) on the real
// owner API over a real store.
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { siteApi } from "../src/site/siteApi.js";
import {
  BELL_PAGE,
  badgeText,
  bellButton,
  bellPanelHtml,
  closed,
  dayGroup,
  emptyBell,
  unreadShown,
  withCleared,
  withCounts,
  withPage,
  withRead,
} from "../src/site/siteBell.js";
import type { SiteNotification, SiteNotifications } from "../src/site/siteStanding.js";
import { miniCard } from "../src/site/siteWidgets.js";

const NOW = Date.parse("2026-11-13T09:00:00.000Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const mc = (c: Parameters<typeof miniCard>[0]) => miniCard(c);
const ZERO = { matchResult: 0, bigPull: 0, dailyPack: 0, autoPlayStopped: 0 };

function win(id: number, min: number, read: boolean): SiteNotification {
  return { notificationId: id, kind: "matchResult", createdAt: ago(min), readAt: read ? ago(1) : null, matchResult: { matchId: `m${id}`, result: "win", agentId: "a", agentName: "Vector", opponent: { ownerId: "o-2", ownerName: "House", agentName: "Hive <b>" }, credits: 30, rating: { before: 1600, after: 1612, change: 12 }, turns: 14 } };
}
function pull(id: number, min: number): SiteNotification {
  return { notificationId: id, kind: "bigPull", createdAt: ago(min), readAt: null, bigPull: { packId: "p", setCode: "S0", jackpot: false, cards: [{ copyId: "c1", cardId: "cx-1", name: "Alpha Node", rarity: "Mythic", finish: "gold", isNew: true, prototype: null }] } };
}
function page(items: SiteNotification[], over: Partial<SiteNotifications> = {}): SiteNotifications {
  const unreadByKind = { ...ZERO };
  for (const n of items) if (n.readAt === null) unreadByKind[n.kind]++;
  return { notifications: items, more: false, unread: items.filter((n) => n.readAt === null).length, unreadByKind, ...over };
}

describe("the bell's counts", () => {
  it("shows the server's unread count, 99+ past 99, and names it", () => {
    expect(badgeText(0)).toBe("0");
    expect(badgeText(99)).toBe("99");
    expect(badgeText(100)).toBe("99+");
    const s = withCounts(emptyBell(), page([win(3, 5, false)], { unread: 7 }));
    expect(s.unread).toBe(7);
    const b = bellButton(s);
    expect(b.label).toBe("Notifications, 7 unread");
    expect(b.html).toContain('class="bl-badge"');
    expect(bellButton(emptyBell()).label).toBe("Notifications, nothing unread");
    expect(bellButton(emptyBell()).html).not.toContain("bl-badge");
  });
  it("swings once for a new unread one, not for the first read or a read one", () => {
    let s = withCounts(emptyBell(), page([win(3, 5, false)]));
    expect(s.rings).toBe(0);
    expect(s.latestId).toBe(3);
    s = withCounts(s, page([win(3, 5, false)]));
    expect(s.rings).toBe(0);
    s = withCounts(s, page([win(4, 1, false)]));
    expect(s.rings).toBe(1);
    s = withCounts(s, page([win(5, 0, true)]));
    expect(s.rings).toBe(1);
    expect(s.latestId).toBe(5);
    // An empty feed (all cleared) keeps the mark.
    s = withCounts(s, page([]));
    expect(s.latestId).toBe(5);
  });
});

describe("the bell's panel state", () => {
  it("pages append, deduplicate and stay newest first; what was unread stays new", () => {
    let s = { ...emptyBell(), open: true, loading: true };
    s = withPage(s, page([win(9, 1, false), win(8, 2, true), pull(7, 3)], { more: true }), false);
    expect(s.items.map((n) => n.notificationId)).toEqual([9, 8, 7]);
    expect(s.more).toBe(true);
    expect(s.loading).toBe(false);
    expect(s.fresh).toEqual([9, 7]);
    expect(unreadShown(s)).toEqual([9, 7]);
    s = withPage(s, page([win(7, 3, false), win(6, 4, false)]), true);
    expect(s.items.map((n) => n.notificationId)).toEqual([9, 8, 7, 6]);
    expect(s.more).toBe(false);
  });
  it("read by id marks only those, keeps them new, lowers the per-kind counts", () => {
    let s = withPage({ ...emptyBell(), open: true }, page([win(9, 1, false), pull(7, 3), win(6, 4, false)]), false);
    s = withRead(s, [9, 7], 1, ago(0));
    expect(s.items.filter((n) => n.readAt === null).map((n) => n.notificationId)).toEqual([6]);
    expect(s.unread).toBe(1);
    expect(s.unreadByKind).toEqual({ ...ZERO, matchResult: 1 });
    expect(s.fresh).toEqual([9, 7, 6]);
    expect(bellPanelHtml(s, { now: NOW, miniCard: mc })).toContain('<i class="bl-new">New</i>');
    const all = withRead(s, "all", 0, ago(0));
    expect(all.unread).toBe(0);
    expect(all.unreadByKind).toEqual(ZERO);
    expect(unreadShown(all)).toEqual([]);
  });
  it("clear removes them; closing forgets the feed and what was new, keeps the counts", () => {
    let s = withPage({ ...emptyBell(), open: true }, page([win(9, 1, false), win(8, 2, true)]), false);
    s = withCleared(s, [9], 0);
    expect(s.items.map((n) => n.notificationId)).toEqual([8]);
    expect(s.fresh).toEqual([]);
    expect(s.unreadByKind.matchResult).toBe(0);
    expect(withCleared(s, "all", 0).items).toEqual([]);
    const c = closed({ ...s, unread: 4, filter: "bigPull" });
    expect(c).toMatchObject({ open: false, items: [], fresh: [], filter: null, unread: 4 });
  });
  it("a filtered page sets the counts but not the newest of all", () => {
    const s0 = withCounts(emptyBell(), page([win(20, 0, false)]));
    const s = withPage({ ...s0, open: true, filter: "bigPull" }, page([pull(7, 3)], { unread: 5 }), false);
    expect(s.latestId).toBe(20);
    expect(s.unread).toBe(5);
    expect(s.rings).toBe(0);
  });
});

describe("the bell's panel HTML", () => {
  it("groups by day, filters by kind with counts, escapes, and offers each control", () => {
    const items = [win(12, 30, false), pull(11, 60 * 20), win(10, 60 * 40, true)];
    const s = withPage({ ...emptyBell(), open: true }, page(items, { more: true }), false);
    const h = bellPanelHtml(s, { now: NOW, miniCard: mc, dayOf: utcDay });
    expect(h.indexOf(">Today<")).toBeLessThan(h.indexOf(">Yesterday<"));
    expect(h.indexOf(">Yesterday<")).toBeLessThan(h.indexOf(">Earlier<"));
    expect(h).toContain("Won vs Hive &lt;b&gt;");
    expect(h).not.toContain("Hive <b>");
    expect(h).toContain('data-act="bell-filter" data-kind="" aria-pressed="true"');
    expect(h).toMatch(/data-kind="bigPull" aria-pressed="false"[^>]*>.*?Big pulls<\/span> <b>1<\/b>/);
    expect(h).toContain('data-act="bell-read-all"');
    expect(h).toContain('data-act="bell-older"');
    expect(h).toContain('data-act="bell-clear-all"');
    expect(h.match(/data-act="bell-clear" data-nid=/g)).toHaveLength(3);
    expect(h).toContain('aria-label="Clear: Won vs Hive &lt;b&gt;"');
    expect(h).toContain('href="#/collection"');
    expect(h).toContain('href="#/settings"');
    // A big pull shows its card.
    expect(h).toContain("Alpha Node");
  });
  it("says loading, empty (per filter) and an error with Try again", () => {
    const base = { ...emptyBell(), open: true };
    expect(bellPanelHtml({ ...base, loading: true }, { now: NOW, miniCard: mc })).toContain('aria-busy="true"');
    expect(bellPanelHtml(base, { now: NOW, miniCard: mc })).toContain("Nothing yet.");
    expect(bellPanelHtml({ ...base, filter: "dailyPack" }, { now: NOW, miniCard: mc })).toContain("No daily pack yet.");
    const e = bellPanelHtml({ ...base, error: "the server can't be reached" }, { now: NOW, miniCard: mc });
    expect(e).toContain("Couldn't read your notifications: the server can&#39;t be reached.");
    expect(e).toContain('data-act="bell-retry"');
    expect(bellPanelHtml(base, { now: NOW, miniCard: mc })).not.toContain("bell-read-all");
    expect(bellPanelHtml(base, { now: NOW, miniCard: mc })).not.toContain("bell-clear-all");
  });
  it("dayGroup: today, yesterday, earlier, and a bad time", () => {
    expect(dayGroup(ago(60), NOW, utcDay)).toBe("Today");
    expect(dayGroup(ago(60 * 12), NOW, utcDay)).toBe("Yesterday");
    expect(dayGroup(ago(60 * 40), NOW, utcDay)).toBe("Earlier");
    expect(dayGroup("not a time", NOW, utcDay)).toBe("Earlier");
  });
});

const PW = "correct horse battery";
const running: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const r of running.splice(0)) {
    await r.idle();
    await r.close();
  }
});

describe("the bell on the real owner API", () => {
  it("pages back with before, filters by kind, marks the shown ids read and clears", async () => {
    const store = EconomyStore.open(":memory:");
    const me = store.createAccount({ name: "ada", username: "ada", password: PW });
    store.grantStarterCollection(me.ownerId, "Swarm");
    const other = store.createAccount({ name: "bob", username: "bob", password: PW });
    store.grantStarterCollection(other.ownerId, "Aegis");
    const a = store.createAgent({ ownerId: me.ownerId, name: "Vector" });
    const b = store.createAgent({ ownerId: other.ownerId, name: "Bastion" });
    // 25 recorded matches: more than one bell page.
    for (let i = 0; i < 25; i++) store.recordMatch({ matchId: `m${i}`, seed: i, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "win", winnerAgentId: i % 3 ? a.agentId : b.agentId }, endedAt: new Date(Date.now() - (25 - i) * 3_600_000).toISOString() });
    const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
    running.push(api);
    const client = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${api.port}`);
    const { token } = await client.signIn("ada", PW);

    const count = await client.notifications(token, 1);
    let s = withCounts(emptyBell(), count);
    expect(s.unread).toBeGreaterThanOrEqual(25);
    const total = s.unread;

    s = { ...s, open: true };
    s = withPage(s, await client.notifications(token, BELL_PAGE, { kind: s.filter }), false);
    expect(s.items).toHaveLength(BELL_PAGE);
    expect(s.more).toBe(true);
    // The bell marks what it shows, by id.
    const shown = unreadShown(s);
    const r = await client.markNotificationsRead(token, { ids: shown });
    expect(r.marked).toBe(shown.length);
    expect(r.unread).toBe(total - shown.length);
    s = withRead(s, shown, r.unread, new Date().toISOString());
    expect(s.unread).toBe(r.unread);
    // Older: the rest, nothing twice.
    s = withPage(s, await client.notifications(token, BELL_PAGE, { before: s.items[s.items.length - 1]!.notificationId }), true);
    expect(new Set(s.items.map((n) => n.notificationId)).size).toBe(s.items.length);
    expect(s.items.length).toBe(total);
    expect(s.more).toBe(false);
    // A kind filter: only that kind (the counts stay whole).
    const pulls = await client.notifications(token, BELL_PAGE, { kind: "bigPull" });
    expect(pulls.notifications).toEqual([]);
    expect(pulls.unread).toBe(r.unread);
    const matches = await client.notifications(token, 5, { kind: "matchResult" });
    expect(matches.notifications.every((n) => n.kind === "matchResult")).toBe(true);
    // Clear one: gone from every page.
    const gone = s.items[0]!.notificationId;
    const c = await client.clearNotifications(token, { ids: [gone] });
    expect(c.cleared).toBe(1);
    expect((await client.notifications(token, 100)).notifications.some((n) => n.notificationId === gone)).toBe(false);
    // Clear all.
    const all = await client.clearNotifications(token, { all: true });
    expect(all.unread).toBe(0);
    expect((await client.notifications(token, 1)).notifications).toEqual([]);
  });
});
