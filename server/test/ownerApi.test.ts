// The owner API's deck settings (roadmap 2b step 3), tested through the
// server: real HTTP requests to a real listening port, over an in-memory
// economy store. Every rule is the store's; these tests pin what reaches
// the owner over the wire (status codes, refusals, who may touch what) and
// that "rebuild now" runs off the request thread.

import { afterEach, describe, expect, it } from "vitest";
import { chooseDeck, holdingsOf } from "@ai-tcg/engine";
import { EconomyStore, SIGN_IN_LOCKOUT } from "@ai-tcg/economy";
import { workerChooser } from "../src/deckBuild/workerChooser.js";
import { startOwnerApi, type OwnerApiOptions, type RunningOwnerApi } from "../src/ownerApi.js";

const PW = "correct horse battery";
const FAST = { games: 0 };

const open: RunningOwnerApi[] = [];
afterEach(async () => {
  for (const api of open.splice(0)) {
    await api.idle();
    await api.close();
  }
});

function setup(options: Omit<OwnerApiOptions, "store"> = {}) {
  const store = EconomyStore.open(":memory:");
  const account = (username: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null") => {
    const owner = store.createAccount({ name: username, username, password: PW });
    store.grantStarterCollection(owner.ownerId, faction);
    const agent = store.createAgent({ ownerId: owner.ownerId, name: `${username}-agent` });
    store.connectAgent(owner.ownerId, agent.agentId);
    return { ownerId: owner.ownerId, agentId: agent.agentId };
  };
  const ada = account("ada", "Swarm");
  const bo = account("bob", "Aegis");
  return { store, ada, bo, start: () => serve({ store, build: FAST, ...options }) };
}

async function serve(options: OwnerApiOptions) {
  const api = await startOwnerApi({ port: 0, ...options });
  open.push(api);
  const call = async (method: string, path: string, opts: { token?: string; body?: unknown; raw?: string } = {}) => {
    const res = await fetch(`http://localhost:${api.port}${path}`, {
      method,
      headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), "Content-Type": "application/json" },
      body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    });
    const text = await res.text();
    return { status: res.status, body: text === "" ? null : JSON.parse(text), headers: res.headers };
  };
  const signIn = async (login: string) => (await call("POST", "/api/session", { body: { login, password: PW } })).body.token as string;
  const waitForJob = async (token: string) => {
    await api.idle();
    return (await call("GET", "/api/play/rebuild", { token })).body.job;
  };
  return { api, call, signIn, waitForJob };
}

describe("owner API: signing in", () => {
  it("signs in with a login and password, and refuses everything else without a live token", async () => {
    const { start } = setup();
    const { call } = await start();

    const ok = await call("POST", "/api/session", { body: { login: "ADA", password: PW } });
    expect(ok.status).toBe(201);
    expect(typeof ok.body.token).toBe("string");

    expect((await call("POST", "/api/session", { body: { login: "ada", password: "nope" } })).status).toBe(401);
    expect((await call("POST", "/api/session", { body: { login: "ada" } })).status).toBe(400);
    expect((await call("GET", "/api/play")).status).toBe(401);
    expect((await call("GET", "/api/play", { token: "made-up" })).status).toBe(401);
    expect((await call("GET", "/api/play", { token: ok.body.token })).status).toBe(200);

    expect((await call("DELETE", "/api/session", { token: ok.body.token })).status).toBe(204);
    expect((await call("GET", "/api/play", { token: ok.body.token })).body).toEqual({ error: "not signed in" });
  });

  it("answers 429 once the store locks the login out", async () => {
    const { start } = setup();
    const { call } = await start();
    let last = 0;
    for (let i = 0; i <= SIGN_IN_LOCKOUT.failures; i++) last = (await call("POST", "/api/session", { body: { login: "ada", password: "wrong" } })).status;
    expect(last).toBe(429);
  });
});

describe("owner API: Settings -> Play", () => {
  it("shows the deck settings: who picks, the lock, the agents and styles, and why to rebuild", async () => {
    const { start, ada } = setup();
    const { call, signIn } = await start();
    const play = (await call("GET", "/api/play", { token: await signIn("ada") })).body;
    expect(play.deckChoice).toBe("agent");
    expect(play.factionLock).toBeNull();
    expect(play.lockableFactions).toEqual(["Cortex", "Swarm", "Aegis", "Null"]);
    expect(play.agentDeck).toBeNull();
    expect(play.rebuild).toEqual({ reasons: ["the agent hasn't built a deck yet"], job: null });
    expect(play.connectedAgent).toEqual({ agentId: ada.agentId, name: "ada-agent", playStyle: "calculator" });
    expect(play.playStyles.map((s: { id: string }) => s.id)).toEqual(["calculator", "rusher", "controller", "tempo", "fortress", "gambler"]);
  });

  it("rebuild now: 202 at once, the build runs, and the deck becomes the active agent deck", async () => {
    const { start } = setup();
    const { call, signIn, waitForJob } = await start();
    const token = await signIn("ada");

    const started = await call("POST", "/api/play/rebuild", { token });
    expect(started.status).toBe(202);
    expect(started.body.job).toMatchObject({ state: "running", reasons: ["the agent hasn't built a deck yet"], result: null });

    const job = await waitForJob(token);
    expect(job.state).toBe("done");
    expect(job.result).toMatchObject({ faction: "Swarm", style: "calculator", rule: "keep-designed:1" });

    const play = (await call("GET", "/api/play", { token })).body;
    expect(play.rebuild.reasons).toEqual([]);
    expect(play.agentDeck.deckId).toBe(job.result.deckId);
    expect(play.agentDeck.builtFrom).toEqual({ style: "calculator", factionLock: null, rule: "keep-designed:1" });
    expect(play.activeDeck.deckId).toBe(job.result.deckId);
    expect(play.activeDeck.complete).toBe(true);
  });

  it("a play style change on the owner's own agent asks for a rebuild; another owner's agent is not found", async () => {
    const { start, ada, bo } = setup();
    const { call, signIn, waitForJob } = await start();
    const token = await signIn("ada");
    await call("POST", "/api/play/rebuild", { token });
    await waitForJob(token);

    const changed = await call("PUT", `/api/agents/${ada.agentId}/play-style`, { token, body: { style: "rusher" } });
    expect(changed.status).toBe(200);
    expect(changed.body.connectedAgent.playStyle).toBe("rusher");
    expect(changed.body.rebuild.reasons).toEqual(["the play style changed (Calculator -> Rusher)"]);

    const foreign = await call("PUT", `/api/agents/${bo.agentId}/play-style`, { token, body: { style: "rusher" } });
    expect(foreign.status).toBe(404);
    expect((await call("PUT", `/api/agents/${ada.agentId}/play-style`, { token, body: { style: "berserker" } })).status).toBe(409);
    expect((await call("PUT", `/api/agents/${ada.agentId}/play-style`, { token, body: { style: 3 } })).status).toBe(400);

    // The rebuild builds in the new style and clears the reason.
    await call("POST", "/api/play/rebuild", { token });
    expect((await waitForJob(token)).result.style).toBe("rusher");
    expect((await call("GET", "/api/play", { token })).body.rebuild.reasons).toEqual([]);
  });

  it("the faction lock: set, refused for a non-faction, freed with null; the rebuild obeys it", async () => {
    const { start, store, ada } = setup();
    const { call, signIn, waitForJob } = await start();
    const token = await signIn("ada");
    await call("POST", "/api/play/rebuild", { token });
    await waitForJob(token);

    // Ada holds only the Swarm starter: a Cortex lock leaves her active
    // Swarm deck out of the lock, and a rebuild in Cortex can't be built.
    const locked = await call("PUT", "/api/play/faction-lock", { token, body: { faction: "Cortex" } });
    expect(locked.status).toBe(200);
    expect(locked.body.factionLock).toBe("Cortex");
    expect(locked.body.activeDeckFits).toBe(false);
    expect(locked.body.rebuild.reasons).toEqual(["the faction lock changed (none -> Cortex)"]);
    await call("POST", "/api/play/rebuild", { token });
    const failed = await waitForJob(token);
    expect(failed.state).toBe("failed");
    expect(failed.error).toMatch(/no deck can be built/);
    expect(store.getOwner(ada.ownerId).factionLock).toBe("Cortex");

    expect((await call("PUT", "/api/play/faction-lock", { token, body: { faction: "Chrome" } })).status).toBe(409);
    expect((await call("PUT", "/api/play/faction-lock", { token, body: {} })).status).toBe(400);
    const freed = await call("PUT", "/api/play/faction-lock", { token, body: { faction: null } });
    expect(freed.body.factionLock).toBeNull();
    expect(freed.body.activeDeckFits).toBe(true);
  });

  it("forcing a deck: only the owner's own, rebuild refused while forced, handed back to the agent", async () => {
    const { start, store, bo } = setup();
    const { call, signIn, waitForJob } = await start();
    const token = await signIn("ada");
    await call("POST", "/api/play/rebuild", { token });
    const built = await waitForJob(token);

    const bosDeck = store.saveDeck(bo.ownerId, "Bo's", store.collection(bo.ownerId).map((c) => c.copyId));
    const foreign = await call("PUT", "/api/play/active-deck", { token, body: { deckId: bosDeck.deckId } });
    expect(foreign.status).toBe(404);
    expect(foreign.body.error).not.toMatch(/Aegis/);

    const forced = await call("PUT", "/api/play/active-deck", { token, body: { deckId: built.result.deckId } });
    expect(forced.body.deckChoice).toBe("forced");
    expect(forced.body.rebuild.reasons).toEqual([]);
    const refused = await call("POST", "/api/play/rebuild", { token });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/force a deck/);

    expect((await call("PUT", "/api/play/deck-choice", { token, body: { choice: "auto" } })).status).toBe(400);
    const back = await call("PUT", "/api/play/deck-choice", { token, body: { choice: "agent" } });
    expect(back.body.deckChoice).toBe("agent");
    expect(back.body.activeDeck.deckId).toBe(built.result.deckId);
  });

  it("forced with no active deck is the store's refusal, 409", async () => {
    const { start } = setup();
    const { call, signIn } = await start();
    const res = await call("PUT", "/api/play/deck-choice", { token: await signIn("ada"), body: { choice: "forced" } });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no active deck to force/);
  });

  it("one rebuild at a time per owner, and a second owner's build is their own", { timeout: 60_000 }, async () => {
    // On the worker, so the first build is still running when the second
    // request arrives (on this thread it would already have finished).
    const { start } = setup({ build: { games: 3, trials: 3, confirmGames: 3 }, chooser: workerChooser().choose });
    const { call, signIn, waitForJob } = await start();
    const ada = await signIn("ada");
    const bo = await signIn("bob");
    expect((await call("POST", "/api/play/rebuild", { token: ada })).status).toBe(202);
    expect((await call("POST", "/api/play/rebuild", { token: ada })).status).toBe(409);
    expect((await call("POST", "/api/play/rebuild", { token: bo })).status).toBe(202);
    expect((await waitForJob(ada)).result.faction).toBe("Swarm");
    expect((await waitForJob(bo)).result.faction).toBe("Aegis");
  });
});

describe("owner API: the request layer", () => {
  it("404 for an unknown path, 405 with Allow for a wrong method, 400 for a body that isn't a JSON object, 413 when too big", async () => {
    const { start } = setup();
    const { call, signIn } = await start();
    const token = await signIn("ada");
    expect((await call("GET", "/api/nothing", { token })).status).toBe(404);
    const wrong = await call("DELETE", "/api/play", { token });
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get("allow")).toBe("GET");
    expect((await call("PUT", "/api/play/deck-choice", { token, raw: "{nope" })).status).toBe(400);
    expect((await call("PUT", "/api/play/deck-choice", { token, raw: "[1]" })).status).toBe(400);
    expect((await call("PUT", "/api/play/deck-choice", { token, raw: JSON.stringify({ choice: "x".repeat(20_000) }) })).status).toBe(413);
  });
});

describe("owner API: rebuild now on a worker thread", () => {
  // Enough games that the build takes a while (a few hundred ms) on any machine.
  const BUILD = { games: 3, trials: 3, confirmGames: 3 };

  it("the worker builds exactly the deck the engine builds on this thread", async () => {
    const { store, ada } = setup();
    const holdings = holdingsOf(store.collection(ada.ownerId).map((c) => c.cardId));
    const worker = workerChooser();
    const there = await worker.choose(holdings, { ...BUILD, style: "tempo" });
    const here = await chooseDeck(holdings, { ...BUILD, style: "tempo" });
    expect(there.faction).toBe(here.faction);
    expect([...there.list]).toEqual([...here.list]);
    expect(there.factions.map((f) => f.score)).toEqual(here.factions.map((f) => f.score));
    expect(worker.running).toBe(0);
  }, 60_000);

  it("runs at most maxWorkers builds at once; the rest wait in line and still build the same decks", async () => {
    const { store, ada } = setup();
    const holdings = holdingsOf(store.collection(ada.ownerId).map((c) => c.cardId));
    const worker = workerChooser({ maxWorkers: 1 });
    const styles = ["tempo", "rusher", "fortress"] as const;
    const builds = styles.map((style) => worker.choose(holdings, { ...BUILD, style }));
    expect(worker.running).toBe(1);
    expect(worker.queued).toBe(2);
    const done = await Promise.all(builds);
    expect(worker.running).toBe(0);
    expect(worker.queued).toBe(0);
    for (const [i, style] of styles.entries()) {
      const here = await chooseDeck(holdings, { ...BUILD, style });
      expect([...done[i]!.list], style).toEqual([...here.list]);
    }
    expect(() => workerChooser({ maxWorkers: 0 })).toThrow(/at least 1/);
  }, 120_000);

  it("terminateAll stops the running build and drops the waiting ones", async () => {
    const { store, ada } = setup();
    const holdings = holdingsOf(store.collection(ada.ownerId).map((c) => c.cardId));
    const worker = workerChooser({ maxWorkers: 1 });
    const builds = [0, 1, 2].map(() => worker.choose(holdings, BUILD).then(() => "built", (e: Error) => e.message));
    await worker.terminateAll();
    const outcomes = await Promise.all(builds);
    expect(outcomes[0]).toMatch(/stopped/);
    expect(outcomes.slice(1)).toEqual(["the deck build was cancelled before it started", "the deck build was cancelled before it started"]);
    expect(worker.running + worker.queued).toBe(0);
  }, 60_000);

  it("the server keeps answering while the agent builds (on this thread it can't)", async () => {
    // What a GET sees when it is sent right after "rebuild now".
    const stateSeenDuringBuild = async (options: Omit<OwnerApiOptions, "store">) => {
      const { start } = setup(options);
      const { call, signIn } = await start();
      const token = await signIn("ada");
      await call("POST", "/api/play/rebuild", { token });
      return (await call("GET", "/api/play/rebuild", { token })).body.job.state;
    };
    expect(await stateSeenDuringBuild({ build: BUILD, chooser: workerChooser().choose })).toBe("running");
    // The same request with the engine on the server's own thread waits
    // out the whole build: the reason the server uses the worker.
    expect(await stateSeenDuringBuild({ build: BUILD })).toBe("done");
  }, 60_000);

  it("a worker error fails the job with the engine's message", async () => {
    const { start, store, ada } = setup({ chooser: workerChooser().choose });
    store.setFactionLock(ada.ownerId, "Null");
    const { call, signIn, waitForJob } = await start();
    const token = await signIn("ada");
    await call("POST", "/api/play/rebuild", { token });
    const job = await waitForJob(token);
    expect(job.state).toBe("failed");
    expect(job.error).toMatch(/no deck can be built: Null/);
  }, 60_000);
});
