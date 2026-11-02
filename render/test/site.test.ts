// The owner website's first slice (render session 44; session 45 added the
// look's account calls and the page's canvas and wallet): the pure model, the
// page, and the host with the API client against the game lane's real
// owner API (its own code, unchanged, over an in-memory store).

import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../../server/src/ownerApi.js";
import { SiteApiError, siteApi, type SitePlay } from "../src/site/siteApi.js";
import { startSiteHost, type RunningSiteHost } from "../src/site/siteHost.js";
import {
  NAV_LOWER,
  NAV_MAIN,
  PAGE_TITLES,
  PAGE_WAITS,
  agentStatus,
  deckLine,
  errorText,
  esc,
  hashOf,
  jobSummary,
  nextTheme,
  pageFromHash,
  rebuildView,
  themeOf,
  type PageId,
} from "../src/site/siteModel.js";
import { renderSitePage, siteScript } from "../src/site/sitePage.js";

function play(over: Partial<SitePlay> = {}): SitePlay {
  return {
    deckChoice: "agent",
    factionLock: null,
    lockableFactions: ["Cortex", "Swarm", "Aegis", "Null"],
    activeDeck: null,
    agentDeck: null,
    rebuild: { reasons: [], job: null },
    connectedAgent: { agentId: "a1", name: "Vector Halcyon", playStyle: "calculator" },
    agents: [{ agentId: "a1", name: "Vector Halcyon", playStyle: "calculator" }],
    playStyles: [{ id: "calculator", name: "Calculator", summary: "" }],
    decks: [],
    liveMatch: null,
    ...over,
  };
}
const deck = { deckId: "d1", name: "Agent's deck", ownerId: "o", active: true, complete: true, missing: [], cards: 40 };
const job = (state: "running" | "done" | "failed", extra: object = {}) => ({ jobId: 1, state, startedAt: "", finishedAt: null, reasons: [], result: null, error: null, ...extra });

describe("the sidebar and routes", () => {
  it("lists the spec's pages in its order, Tournament marked Soon", () => {
    expect(NAV_MAIN.map((n) => n.label)).toEqual(["Home", "Agent match", "Watch live", "Collection", "Store", "Tournament", "Stats"]);
    expect(NAV_LOWER.map((n) => n.label)).toEqual(["Settings", "Connect agent"]);
    expect(NAV_MAIN.filter((n) => n.soon).map((n) => n.id)).toEqual(["tournament"]);
  });
  it("routes by the hash; anything unknown is Home; round-trips", () => {
    expect(pageFromHash("")).toBe("home");
    expect(pageFromHash("#/settings")).toBe("settings");
    expect(pageFromHash("#settings")).toBe("settings");
    expect(pageFromHash("#/settings/play?x=1")).toBe("settings");
    expect(pageFromHash("#/constructor")).toBe("home");
    expect(pageFromHash("#/__proto__")).toBe("home");
    for (const id of Object.keys(PAGE_TITLES) as PageId[]) expect(pageFromHash(hashOf(id))).toBe(id);
  });
  it("the pages this slice serves are not on the waits list; every other page is", () => {
    const served: PageId[] = ["home", "settings", "connect", "store", "collection"]; // the Store: session 47
    for (const id of Object.keys(PAGE_TITLES) as PageId[]) expect(Object.prototype.hasOwnProperty.call(PAGE_WAITS, id), id).toBe(!served.includes(id));
  });
});

describe("theme", () => {
  it("System follows the computer; the button cycles System, Light, Dark", () => {
    expect(themeOf("system", true)).toBe("dark");
    expect(themeOf("system", false)).toBe("light");
    expect(themeOf("light", true)).toBe("light");
    expect(themeOf("dark", false)).toBe("dark");
    expect([nextTheme("system"), nextTheme("light"), nextTheme("dark")]).toEqual(["light", "dark", "system"]);
  });
});

describe("how the play settings read", () => {
  it("the agent's status: none, ready, in a match", () => {
    expect(agentStatus(play({ connectedAgent: null })).tone).toBe("none");
    expect(agentStatus(play()).label).toBe("Ready");
    expect(agentStatus(play({ liveMatch: { matchId: "m", startedAt: "" } }))).toEqual({ label: "In a match", tone: "live" });
  });
  it("which deck plays", () => {
    expect(deckLine(play())).toBe("Your agent picks · no deck built yet");
    expect(deckLine(play({ agentDeck: { ...deck, builtFrom: null } }))).toBe("Your agent picks: Agent's deck · 40 cards");
    expect(deckLine(play({ deckChoice: "forced", activeDeck: { ...deck, name: "Mine", cards: 36 } }))).toBe("You chose: Mine · 36 cards");
    expect(deckLine(play({ deckChoice: "forced" }))).toBe("You chose a deck, but none is active");
  });
  it("the rebuild panel: a running job first, then forced, then the store's reasons, then a failure", () => {
    const reasons = ["the play style changed (Calculator -> Rusher)"];
    expect(rebuildView(play({ deckChoice: "forced", rebuild: { reasons, job: job("running") } })).kind).toBe("running");
    expect(rebuildView(play({ deckChoice: "forced", rebuild: { reasons, job: null } })).kind).toBe("forced");
    expect(rebuildView(play({ rebuild: { reasons, job: job("failed", { error: "x" }) } }))).toEqual({ kind: "wanted", text: "Your agent's deck wants a rebuild:", reasons });
    expect(rebuildView(play({ rebuild: { reasons: [], job: job("failed", { error: "cards changed" }) } })).text).toBe("The last rebuild failed: cards changed");
    expect(rebuildView(play()).text).toBe("Your agent hasn't built a deck yet.");
    expect(rebuildView(play({ agentDeck: { ...deck, builtFrom: null } })).text).toBe("Your agent's deck is up to date.");
  });
  it("a finished build in words", () => {
    const done = job("done", {
      result: { deckId: "d", faction: "Cortex", style: "calculator", cards: 40, factions: [
        { faction: "Cortex", winRate: 0.5625, infeasible: null },
        { faction: "Null", winRate: null, infeasible: "too few cards" },
        { faction: "Swarm", winRate: null, infeasible: null },
      ] },
    });
    expect(jobSummary(done as never)).toEqual(["Built a 40-card Cortex deck.", "Cortex: wins 56.3% against the shipped decks", "Null: couldn't build (too few cards)", "Swarm: weighed without games"]);
    expect(jobSummary(job("running") as never)).toEqual([]);
  });
  it("refusals: the store's own words, made a sentence; sign-in and reachability in plain words", () => {
    expect(errorText(409, "you force a deck; hand the deck choice to the agent first")).toBe("You force a deck; hand the deck choice to the agent first.");
    expect(errorText(409, "Done!")).toBe("Done!");
    expect(errorText(401, "wrong login or password")).toBe("Wrong login or password.");
    expect(errorText(401, "not signed in")).toBe("You've been signed out. Sign in again.");
    expect(errorText(0, "")).toMatch(/^Can't reach the server/);
    expect(errorText(429, "too many failed sign-ins")).toBe("Too many tries: too many failed sign-ins");
  });
  it("escapes names into HTML", () => {
    expect(esc(`<b a="1">'&'</b>`)).toBe("&lt;b a=&quot;1&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;");
  });
});

describe("the page", () => {
  const html = renderSitePage();
  it("is self-contained: no external script, style, font or request (2026-10-05 A)", () => {
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|@import|url\(\s*['"]?https?:/i);
    // The only absolute URL anywhere is the SVG namespace the avatars carry.
    const urls = new Set(html.match(/https?:\/\/[^\s"'`)<]+/g) ?? []);
    expect([...urls]).toEqual(["http://www.w3.org/2000/svg"]);
  });
  it("carries the sign-in form, the shell, a dialog layer and a polite status for toasts", () => {
    for (const id of ["signin", "si-form", "si-login", "si-pass", "shell", "nav", "agent-card", "title", "theme-btn", "acct-btn", "page", "dialog", "toast", "bg", "liquid", "wallet", "acct-kind"]) expect(html).toContain(`id="${id}"`);
    expect(html).toMatch(/id="toast"[^>]*aria-live="polite"/);
    expect(html).toContain('autocomplete="current-password"');
  });
  it("the liquid canvas sits over the still background and under the shell, and is hidden from screen readers", () => {
    expect(html.indexOf('id="bg"')).toBeLessThan(html.indexOf('id="liquid"'));
    expect(html.indexOf('id="liquid"')).toBeLessThan(html.indexOf('id="shell"'));
    expect(html).toMatch(/<canvas id="liquid" aria-hidden="true">/);
    // The shader is in the bundle; the page asks for WebGL 1 (the widest support).
    expect(siteScript()).toContain("gl_FragColor");
    expect(siteScript()).toContain('getContext("webgl"');
  });
  it("the inline bundle can't close its own script tag, and has the accessibility rules", () => {
    expect(siteScript()).not.toMatch(/<\/script/i);
    expect(html).toContain("prefers-reduced-transparency: reduce");
    expect(html).toContain("prefers-reduced-motion: reduce");
  });
});

// ---- the host and the client against the real owner API ----
const PW = "correct horse battery";
const running: (RunningOwnerApi | RunningSiteHost)[] = [];
afterEach(async () => {
  for (const r of running.splice(0).reverse()) {
    if ("idle" in r) await r.idle();
    await r.close();
  }
});
async function stack() {
  const store = EconomyStore.open(":memory:");
  const owner = store.createAccount({ name: "ada", username: "ada", password: PW });
  store.grantStarterCollection(owner.ownerId, "Swarm");
  const agent = store.createAgent({ ownerId: owner.ownerId, name: "Ada's agent" });
  store.connectAgent(owner.ownerId, agent.agentId);
  const api = await startOwnerApi({ store, port: 0, build: { games: 0 } });
  running.push(api);
  const host = await startSiteHost({ api: `http://localhost:${api.port}`, port: 0, page: "<!doctype html><p>site</p>" });
  running.push(host);
  const base = `http://127.0.0.1:${host.port}`;
  return { store, agent, api, host, base, client: siteApi((u, i) => fetch(u, i), base) };
}

describe("the host and the API client, over the real owner API", () => {
  it("serves the page with its security headers, and nothing else outside /api", async () => {
    const { base } = await stack();
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<!doctype html><p>site</p>");
    expect(res.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await fetch(`${base}/index.html`)).status).toBe(200);
    expect((await fetch(`${base}/secrets.txt`)).status).toBe(404);
    expect((await fetch(`${base}/`, { method: "POST" })).status).toBe(405);
  });

  it("signs in, reads and changes the play settings through the host", async () => {
    const { client, agent } = await stack();
    const s = await client.signIn("ADA", PW);
    expect(s.token).toBeTruthy();
    const p = await client.play(s.token);
    expect(p.connectedAgent?.agentId).toBe(agent.agentId);
    expect(p.rebuild.reasons.length).toBeGreaterThan(0);
    expect((await client.setFactionLock(s.token, "Swarm")).factionLock).toBe("Swarm");
    const styled = await client.setPlayStyle(s.token, agent.agentId, p.playStyles[1]!.id);
    expect(styled.connectedAgent?.playStyle).toBe(p.playStyles[1]!.id);
  });

  it("a rebuild job runs to done and its deck becomes the agent's", async () => {
    const { client, api } = await stack();
    const { token } = await client.signIn("ada", PW);
    const started = await client.rebuild(token);
    expect(started.state).toBe("running");
    await api.idle();
    const done = await client.rebuildJob(token);
    expect(done.state).toBe("done");
    const p = await client.play(token);
    expect(p.agentDeck?.deckId).toBe(done.result!.deckId);
    expect(p.decks.map((d) => d.deckId)).toContain(done.result!.deckId);
  });

  it("who am I, the account settings and the wallet, through the host (session 45)", async () => {
    const { client, store } = await stack();
    const { token } = await client.signIn("ada", PW);
    const me = await client.me(token);
    expect(me).toMatchObject({ name: "ada", username: "ada", isAdmin: false });
    const first = await client.accountSettings(token);
    expect(first).toMatchObject({ theme: "system", background: "glacier", updatedAt: null });
    // The look's two fields, saved in part: the rest stay as they were.
    const saved = await client.updateAccountSettings(token, { background: "aurora", theme: "dark" });
    expect(saved).toMatchObject({ theme: "dark", background: "aurora", sound: first.sound, music: first.music, skipHintSeen: false });
    expect(saved.updatedAt).not.toBeNull();
    // On the account: a new session (another browser) reads the same.
    const other = await client.signIn("ada", PW);
    expect(await client.accountSettings(other.token)).toMatchObject({ theme: "dark", background: "aurora" });
    // A background the server doesn't take is refused with its reason, and nothing changes.
    const err = await client.updateAccountSettings(token, { background: "neon" }).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 400 });
    expect((err as SiteApiError).message).toContain("background");
    expect((await client.accountSettings(token)).background).toBe("aurora");
    // The wallet: the starter grants no packs; one granted shows on the Open button's count.
    const w0 = await client.wallet(token);
    expect(w0).toMatchObject({ credits: 0, packPoints: 0 });
    store.grantPack(me.ownerId, "S0", "ownerDaily");
    const w1 = await client.wallet(token);
    expect(w1.unopenedPacks).toHaveLength(w0.unopenedPacks.length + 1);
  });

  it("refusals come back as SiteApiError with the store's words", async () => {
    const { client } = await stack();
    await expect(client.signIn("ada", "nope")).rejects.toMatchObject({ status: 401, message: "wrong login or password", signedOut: true });
    await expect(client.play("made-up")).rejects.toMatchObject({ status: 401 });
    const { token } = await client.signIn("ada", PW);
    // Forcing with no active deck: the store refuses (409).
    const err = await client.setDeckChoice(token, "forced").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SiteApiError);
    expect((err as SiteApiError).status).toBe(409);
    await client.signOut(token);
    await expect(client.play(token)).rejects.toMatchObject({ status: 401, message: "not signed in" });
  });

  it("the API down: the host answers 502 in the API's shape; no server at all is status 0", async () => {
    const host = await startSiteHost({ api: "http://127.0.0.1:9", port: 0, page: "x" });
    running.push(host);
    const viaHost = siteApi((u, i) => fetch(u, i), `http://127.0.0.1:${host.port}`);
    await expect(viaHost.play("t")).rejects.toMatchObject({ status: 502, message: "the owner API can't be reached" });
    const nowhere = siteApi(() => Promise.reject(new Error("offline")));
    await expect(nowhere.play("t")).rejects.toMatchObject({ status: 0 });
  });
});
