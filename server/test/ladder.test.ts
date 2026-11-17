// The ladder runner (session 66): rounds of real engine matches between
// house owners over an in-memory store, with the rebuild-between-matches
// rule, the payouts, the ratings, and the fault paths (a seat that throws,
// one that plays an illegal move, one that can't be seated, an engine
// error).

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatLog, getCard, LookaheadAgent, SHIPPED_DECK_LISTS, type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore, RATING_START } from "@ai-tcg/economy";
import { houseSeater, Ladder, rebuildReplay, type AgentSeater, type ReplayFile } from "../src/ladder/ladderRunner.js";

const engineState = vi.hoisted(() => ({ explode: false }));
vi.mock("@ai-tcg/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@ai-tcg/engine")>();
  return {
    ...real,
    runMatch: (...args: Parameters<typeof real.runMatch>) => {
      if (engineState.explode) throw new Error("the engine broke");
      return real.runMatch(...args);
    },
  };
});

const BUILD = { games: 0 };
const dirs: string[] = [];
afterEach(() => {
  engineState.explode = false;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup(factions: DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"], kinds: ("house" | "player")[] = []) {
  let clock = new Date("2026-11-01T22:00:00.000Z"); // 09:00 Mon in Sydney
  const store = EconomyStore.open(":memory:", { now: () => clock });
  const owners = factions.map((f, i) => {
    const o = store.createOwner({ name: `${kinds[i] ?? "house"}-${i}`, kind: kinds[i] ?? "house" });
    store.grantStarterCollection(o.ownerId, f);
    const a = store.createAgent({ ownerId: o.ownerId, name: `Agent ${i}` });
    store.connectAgent(o.ownerId, a.agentId);
    return { ownerId: o.ownerId, agentId: a.agentId };
  });
  let n = 0;
  const ladder = (seater: AgentSeater = houseSeater, extra: Partial<ConstructorParameters<typeof Ladder>[0]> = {}) =>
    new Ladder({
      store,
      seater,
      seed: 66,
      build: BUILD,
      matchId: () => `t-${++n}`,
      housePacks: false,
      afterMatch: () => {
        clock = new Date(clock.getTime() + 600_000);
      },
      ...extra,
    });
  const advance = (ms: number) => {
    clock = new Date(clock.getTime() + ms);
  };
  return { store, owners, ladder, advance };
}

describe("the ladder", () => {
  it("builds each agent's deck, pairs, plays, pays and rates a round; the next round rebuilds nothing", async () => {
    const { store, owners, ladder } = setup();
    const lad = ladder();
    const r1 = await lad.runRound();
    expect(r1.rebuilt.map((b) => b.reasons)).toEqual(owners.map(() => ["the agent hasn't built a deck yet"]));
    expect(r1.pairs).toHaveLength(2);
    expect(r1.matches).toHaveLength(2);
    for (const { record } of r1.matches) {
      expect(record.outcome).toBe("win");
      expect(record.turns).toBeGreaterThan(0);
      expect(record.moves).toBeGreaterThan(0);
      // The first win of the Sydney day pays 30, the loss 2.
      expect([record.p1Credits, record.p2Credits].sort((a, b) => a - b)).toEqual([2, 30]);
      expect(record.ratings!.p1.before).toEqual(RATING_START);
      expect(record.boast?.winnerHealth).toBeGreaterThan(0); // final health was passed
      expect(record.playStyles).toEqual({ p1: "calculator", p2: "calculator" });
    }
    expect(store.liveMatches()).toEqual([]);
    const r2 = await lad.runRound();
    expect(r2.rebuilt).toEqual([]);
    expect(r2.matches).toHaveLength(2);
    expect(store.matchHistory()).toHaveLength(4);
    expect(store.ladder().map((r) => r.ratedMatches)).toEqual([2, 2, 2, 2]);
  });

  it("rebuilds an agent's deck between matches when its owner opens a pack", async () => {
    const { store, owners, ladder } = setup();
    const lad = ladder();
    await lad.runRound();
    store.openPack(owners[2]!.ownerId, undefined, { seed: 5 });
    const r = await lad.runRound();
    expect(r.rebuilt.map((b) => [b.ownerId, b.reasons])).toEqual([[owners[2]!.ownerId, ["the cards held changed"]]]);
  });

  it("is reproducible: the same seed on the same store state plays the same matches", async () => {
    const a = setup();
    const b = setup();
    const ra = await a.ladder().runRound();
    const rb = await b.ladder().runRound();
    const strip = (r: typeof ra) =>
      r.matches.map((m) => [m.record.seed, m.record.turns, m.record.moves, m.record.p1Credits, m.record.p2Credits, m.record.winnerOwnerId === m.record.p1OwnerId]);
    expect(strip(ra)).toEqual(strip(rb));
  });

  it("leaves out who can't play, and says why: no connected agent, a forced deck gone short", async () => {
    const { store, owners, ladder } = setup(["Cortex", "Swarm", "Aegis", "Null", "Cortex", "Swarm"]);
    store.disconnectAgent(owners[0]!.ownerId);
    // Owner 4 forces a deck that runs one more copy of a Common than its
    // starter has (the extra one from a pack), then salvages that copy.
    const short = owners[4]!.ownerId;
    const list = SHIPPED_DECK_LISTS.Cortex;
    const extra = list.find((e) => e.copies < 3 && getCard(e.cardId)?.rarity === "Common")!.cardId;
    const drop = list.find((e) => e.cardId !== extra)!.cardId;
    const pack = store.grantCopy({ ownerId: short, cardId: extra, origin: "pack" });
    const held = store.collection(short).filter((c) => c.origin === "starter");
    const dropOne = held.findIndex((c) => c.cardId === drop);
    const deck = store.saveDeck(short, "forced", [...held.filter((_, i) => i !== dropOne).map((c) => c.copyId), pack.copyId]);
    store.setActiveDeck(short, deck.deckId);
    store.salvage(short, extra, 1, { confirmDeckImpact: true });
    const lad = ladder();
    expect(lad.eligibleOwners()).not.toContain(owners[0]!.ownerId);
    const r = await lad.runRound(owners.map((o) => o.ownerId));
    expect(r.excluded).toContainEqual({ ownerId: owners[0]!.ownerId, reason: "no connected agent" });
    const why = r.excluded.find((x) => x.ownerId === short)?.reason;
    expect(why).toMatch(new RegExp(`the active deck is short: ${extra} \\(uses \\d, holds \\d\\)`));
    expect(r.pairs).toHaveLength(2);
    expect(r.sitOut).toHaveLength(0);
  });

  it("(session 103) runRound's onPaired sees the paired round before any match is played or recorded", async () => {
    const { store, ladder } = setup();
    const lad = ladder();
    const seen: { pairs: number; matches: number; recorded: number }[] = [];
    const r = await lad.runRound(undefined, (paired) => {
      seen.push({ pairs: paired.pairs.length, matches: paired.matches.length, recorded: store.matchHistory().length });
    });
    expect(seen).toEqual([{ pairs: 2, matches: 0, recorded: 0 }]);
    expect(r.matches).toHaveLength(2);
  });

  it("(session 101) a lock the owner can't build leaves them out every round, with the reason; the round after the craft that makes it buildable rebuilds and pairs them", async () => {
    const { store, owners, ladder } = setup(["Swarm", "Cortex", "Aegis", "Null"]);
    const locked = owners[0]!.ownerId;
    const lad = ladder();
    await lad.runRound(); // the agent builds its Swarm deck and plays
    const agentDeck = store.agentDeckId(locked)!;
    expect(store.deckStatus(agentDeck).faction).toBe("Swarm");
    store.setFactionLock(locked, "Aegis");
    const aegis = () => store.lockableFactions(locked).find((x) => x.faction === "Aegis")!;
    const playsIn = (r: Awaited<ReturnType<typeof lad.runRound>>) => r.pairs.some((p) => p.p1 === locked || p.p2 === locked);

    const r2 = await lad.runRound();
    expect(aegis().buildable).toBe(false);
    expect(r2.excluded.find((x) => x.ownerId === locked)?.reason).toMatch(/couldn't be rebuilt: .*at most 0 usable cards, under 20/);
    expect(playsIn(r2)).toBe(false);

    store.unsafeExec(`INSERT INTO ledger (owner_id, currency, delta, reason, created_at) VALUES ('${locked}', 'packPoints', 100000, 'testGrant', '2026-11-01T22:00:00.000Z')`);
    const crafts = SHIPPED_DECK_LISTS.Aegis.flatMap(({ cardId, copies }) => Array.from({ length: copies }, () => cardId));
    let i = 0;
    while (aegis().cards < 19) store.craftCard(locked, crafts[i++]!);
    expect(aegis().buildable).toBe(false);
    const r3 = await lad.runRound();
    expect(r3.excluded.find((x) => x.ownerId === locked)?.reason).toMatch(/at most 19 usable cards, under 20/);
    expect(playsIn(r3)).toBe(false);

    store.craftCard(locked, crafts[i++]!);
    expect(aegis()).toMatchObject({ buildable: true, cards: 20 });
    const r4 = await lad.runRound();
    const rebuilt = r4.rebuilt.find((b) => b.ownerId === locked);
    expect(rebuilt).toMatchObject({ faction: "Aegis", cards: 20 });
    expect(rebuilt!.reasons).toEqual(["the cards held changed", "the faction lock changed (none -> Aegis)"]);
    expect(r4.excluded.map((x) => x.ownerId)).not.toContain(locked);
    expect(playsIn(r4)).toBe(true);
    const m = r4.matches.find((x) => x.record.p1OwnerId === locked || x.record.p2OwnerId === locked)!;
    expect(m.record.p1OwnerId === locked ? m.record.p1DeckId : m.record.p2DeckId).toBe(agentDeck); // rebuilt in place
    expect(store.deckStatus(agentDeck).faction).toBe("Aegis");

    const r5 = await lad.runRound();
    expect(r5.rebuilt.map((b) => b.ownerId)).not.toContain(locked);
    expect(playsIn(r5)).toBe(true);
  });

  it("an odd queue sits one out, and that owner plays the next round", async () => {
    const { owners, ladder } = setup(["Cortex", "Swarm", "Aegis"]);
    const lad = ladder();
    const r1 = await lad.runRound();
    expect(r1.sitOut).toHaveLength(1);
    const r2 = await lad.runRound();
    const played = r2.pairs.flatMap((p) => [p.p1, p.p2]);
    expect(played).toContain(r1.sitOut[0]);
    expect(owners.map((o) => o.ownerId)).toContain(r1.sitOut[0]);
  });

  it("a seat whose agent stops answering abandons the match: no credits, a rating loss for it only", async () => {
    const { store, owners, ladder } = setup(["Cortex", "Swarm"]);
    const broken = owners[1]!.ownerId;
    const seater: AgentSeater = {
      seat: (s) => {
        const real = new LookaheadAgent(s.agentName, s.seed);
        let moves = 0;
        return s.ownerId === broken
          ? {
              name: real.name,
              decideMove: (v, l) => {
                if (++moves > 5) throw new Error("socket closed");
                return real.decideMove(v, l);
              },
            }
          : real;
      },
    };
    const r = await ladder(seater).runRound();
    const m = r.matches[0]!;
    expect(m.record.outcome).toBe("abandoned");
    expect(m.record.abandonedByOwnerId).toBe(broken);
    expect(m.record.p1Credits + m.record.p2Credits).toBe(0);
    expect(m.note).toMatch(/socket closed/);
    expect(store.rating(broken).rating).toBeLessThan(1500);
    expect(store.rating(owners[0]!.ownerId).rating).toBeGreaterThan(1500);
    expect(store.balance(broken)).toBe(0);
    expect(store.liveMatches()).toEqual([]);
  });

  it("an illegal move is an abandon by the side that played it", async () => {
    const { owners, ladder } = setup(["Cortex", "Swarm"]);
    const seater: AgentSeater = {
      seat: (s) =>
        s.ownerId === owners[0]!.ownerId
          ? { name: s.agentName, decideMove: () => ({ type: "attack", attackerInstanceId: "nope", target: { kind: "player" } }) as never }
          : new LookaheadAgent(s.agentName, s.seed),
    };
    const m = (await ladder(seater).runRound()).matches[0]!;
    expect(m.record.outcome).toBe("abandoned");
    expect(m.record.abandonedByOwnerId).toBe(owners[0]!.ownerId);
    expect(m.note).toMatch(/illegal move/);
  });

  it("a seat that can't be given an agent at all didn't show up: an abandon by that side", async () => {
    const { owners, ladder } = setup(["Cortex", "Swarm"]);
    const seater: AgentSeater = {
      seat: (s) => {
        if (s.ownerId === owners[1]!.ownerId) throw new Error("agent offline");
        return new LookaheadAgent(s.agentName, s.seed);
      },
    };
    const m = (await ladder(seater).runRound()).matches[0]!;
    expect(m.record.abandonedByOwnerId).toBe(owners[1]!.ownerId);
    expect(m.note).toMatch(/couldn't be seated: agent offline/);
  });

  it("an engine error is nobody's seat: the match is cancelled, unpaid and unrated, and the owners are free again", async () => {
    const { store, owners, ladder } = setup(["Cortex", "Swarm"]);
    engineState.explode = true;
    const m = (await ladder().runRound()).matches[0]!;
    expect(m.record.outcome).toBe("cancelled");
    expect(m.record.ratings).toBeNull();
    expect(m.record.p1Credits + m.record.p2Credits).toBe(0);
    expect(m.note).toMatch(/engine error: the engine broke/);
    expect(store.rating(owners[0]!.ownerId).ratedMatches).toBe(0);
    expect(store.liveMatches()).toEqual([]);
  });

  it("writes each played match's log for replays", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ladder-logs-"));
    dirs.push(dir);
    const { ladder } = setup(["Cortex", "Swarm"]);
    const m = (await ladder(houseSeater, { logDir: dir }).runRound()).matches[0]!;
    expect(m.logPath).toBe(join(dir, `${m.record.matchId}.txt`));
    expect(existsSync(m.logPath!)).toBe(true);
    expect(readFileSync(m.logPath!, "utf8")).toMatch(/Agent 0|Agent 1/);
  });

  it("writes a versioned replay beside the log that rebuilds the match exactly with the engine's replayMatch", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ladder-replay-"));
    dirs.push(dir);
    const { store, owners, ladder } = setup(["Aegis", "Null"]);
    // Owner 0 plays a generated agent, which brings its own signature card.
    const draft = store.startAgentDraft(owners[0]!.ownerId, { seed: 3 });
    store.pickDraftAgent(owners[0]!.ownerId, draft.draftId, 0, { seed: 4 });
    const { agent } = store.confirmAgentDraft(owners[0]!.ownerId, draft.draftId, 0, { artSlot: 1 });
    store.connectAgent(owners[0]!.ownerId, agent.agentId);
    const m = (await ladder(houseSeater, { logDir: dir }).runRound()).matches[0]!;
    expect(m.replayPath).toBe(join(dir, `${m.record.matchId}.replay.json`));
    const replay = JSON.parse(readFileSync(m.replayPath!, "utf8")) as ReplayFile;
    // (session 70) Versioned: the rules and card versions, every deck card in full.
    expect(replay.format).toBe("ai-tcg-replay/2");
    if (replay.format !== "ai-tcg-replay/2") throw new Error("unreachable");
    expect(replay.versions.rules).toBe("rules-2");
    expect(replay.versions.cards).toBe("cards-3"); // cards-3 since session 98 (the booster cards tuned)
    for (const id of [...replay.decks.p1.cardIds, ...replay.decks.p2.cardIds]) expect(replay.cards.find((c) => c.id === id)).toEqual(getCard(id));
    expect(replay.moves).toHaveLength(m.record.moves!);
    // The generated agent's own signature card travels in full.
    const seatOf0 = m.record.p1OwnerId === owners[0]!.ownerId ? "p1" : "p2";
    expect(replay.decks[seatOf0].signature?.id).toBe(store.signatureCard(agent.agentId)!.card.id);
    const { state } = rebuildReplay(replay);
    expect(`${formatLog(state.log)}\n`).toBe(readFileSync(m.logPath!, "utf8"));
    expect(state.turnNumber).toBe(m.record.turns);
    expect(replay.result.winner === "p1" ? m.record.p1OwnerId : m.record.p2OwnerId).toBe(m.record.winnerOwnerId);
  });

  it("keeps a move-by-move timeline: one step per move, public counts only, ending on the result", async () => {
    const { ladder } = setup(["Cortex", "Swarm"]);
    const lad = ladder();
    const { pairs } = await lad.startRound();
    const played = (await lad.playPair(pairs[0]!))!;
    const t = played.timeline!;
    expect(t.steps).toHaveLength(played.moves!);
    expect(t.start.turn).toBe(1);
    expect(t.start.p1.hand).toBeGreaterThan(0);
    expect(t.steps.at(-1)!.after.winner).not.toBeNull();
    expect(t.steps.at(-1)!.after.turn).toBe(played.turns);
    expect(t.steps.flatMap((s) => s.lines).join("\n")).toBe(played.log!.split("\n").slice(t.startLines.length).join("\n"));
    // Nothing about a hand or deck but its size.
    expect(Object.keys(t.start.p1).sort()).toEqual(["board", "deck", "directives", "energy", "graveyard", "hand", "health", "maxEnergy", "maxHealth", "name", "signature"]);
    expect(typeof t.start.p1.hand).toBe("number");
    lad.recordPlayed(played);
  });
});

describe("(session 104) an owner switching auto-play off by hand", () => {
  type Ev = import("../src/ladder/ladderRunner.js").LadderEvent;
  const offs = (events: Ev[]) => events.filter((e) => e.kind === "autoPlaySwitchedOff").map((e) => e.ownerId);

  it("is said once, at the next round's start, with when the switch moved; not again after", async () => {
    const { store, owners, ladder } = setup(["Cortex", "Swarm", "Aegis", "Null"], ["house", "house", "player", "player"]);
    const [a, b] = [owners[2]!.ownerId, owners[3]!.ownerId];
    for (const o of [a, b]) store.setAutoPlay(o, true);
    const events: Ev[] = [];
    const lad = ladder(houseSeater, { onEvent: (e) => events.push(e) });
    await lad.runRound();
    expect(offs(events)).toEqual([]);
    const changedAt = store.setAutoPlay(a, false).changedAt;
    const r2 = await lad.runRound();
    expect(events.filter((e) => e.kind === "autoPlaySwitchedOff")).toEqual([{ kind: "autoPlaySwitchedOff", ownerId: a, changedAt }]);
    expect(r2.pairs.flatMap((p) => [p.p1, p.p2])).not.toContain(a);
    await lad.runRound();
    expect(offs(events)).toEqual([a]);
  });

  it("off and back on between two rounds says nothing (they are still queued)", async () => {
    const { store, owners, ladder } = setup(["Cortex", "Swarm"], ["player", "player"]);
    for (const o of owners) store.setAutoPlay(o.ownerId, true);
    const events: Ev[] = [];
    const lad = ladder(houseSeater, { onEvent: (e) => events.push(e) });
    await lad.runRound();
    store.setAutoPlay(owners[0]!.ownerId, false);
    store.setAutoPlay(owners[0]!.ownerId, true);
    expect((await lad.runRound()).pairs).toHaveLength(1);
    expect(offs(events)).toEqual([]);
  });

  it("the server's own stops are not the owner's: the day's rewards maxed (also once the day has turned), and a time-up between rounds", async () => {
    const { store, owners, ladder, advance } = setup(["Cortex", "Swarm", "Aegis"], ["player", "player", "player"]);
    for (const o of owners.slice(0, 2)) store.setAutoPlay(o.ownerId, true);
    const timed = owners[2]!.ownerId;
    store.setAutoPlay(timed, true, 15);
    const events: Ev[] = [];
    const lad = ladder(houseSeater, { onEvent: (e) => events.push(e) });
    for (let i = 0; i < 40 && events.filter((e) => e.kind === "autoPlayStopped").length < 2; i++) await lad.runRound();
    const stops = events.filter((e): e is Extract<Ev, { kind: "autoPlayStopped" }> => e.kind === "autoPlayStopped");
    // The 15 minutes run out after the timed owner's first match (each
    // match moves the clock 10 minutes); someone's 10th win maxes the day.
    expect(stops.map((e) => e.reason).sort()).toEqual(["dailyRewardsMaxed", "timeUp"]);
    // Past midnight Sydney the maxed stop no longer reads as today's, but
    // this ladder made it, so it still isn't the owner's.
    advance(24 * 3600_000);
    await lad.runRound();
    await lad.runRound();
    expect(offs(events)).toEqual([]);
  });

  it("an allowance finishing its last match (time up, match live) is the server's stop after the match, not the owner's", async () => {
    const { store, owners, ladder, advance } = setup(["Cortex", "Swarm"], ["player", "player"]);
    const [timed, other] = owners.map((o) => o.ownerId) as [string, string];
    store.setAutoPlay(timed, true, 15);
    store.setAutoPlay(other, true);
    const events: Ev[] = [];
    const lad = ladder(houseSeater, { onEvent: (e) => events.push(e) });
    await lad.runRound();
    const { pairs } = await lad.startRound();
    expect(pairs).toHaveLength(1);
    const played = (await lad.playPair(pairs[0]!))!;
    advance(20 * 60_000); // the window ends while the match is live
    expect(store.autoPlay(timed)).toMatchObject({ on: true, allowance: { state: "finishing" } });
    await lad.startRound(); // a round starts while it finishes: nothing said
    expect(offs(events)).toEqual([]);
    lad.recordPlayed(played);
    await lad.startRound();
    expect(events.filter((e) => e.kind === "autoPlayStopped").map((e) => e.ownerId)).toEqual([timed]);
    expect(offs(events)).toEqual([]);
  });
});

describe("who queues, and the house pack policy (session 67)", () => {
  it("house owners always queue; a player owner only while its auto-play is on", () => {
    const { store, owners, ladder } = setup(["Cortex", "Swarm", "Aegis"], ["house", "player", "player"]);
    const lad = ladder();
    expect(lad.eligibleOwners()).toEqual([owners[0]!.ownerId]);
    store.setAutoPlay(owners[2]!.ownerId, true);
    expect(lad.eligibleOwners()).toEqual([owners[0]!.ownerId, owners[2]!.ownerId]);
    store.setAutoPlay(owners[2]!.ownerId, false);
    expect(lad.eligibleOwners()).toEqual([owners[0]!.ownerId]);
  });

  it("auto-play goes off by itself after the match that maxes the day's rewards", async () => {
    const { store, owners, ladder, advance } = setup(["Cortex", "Swarm"], ["player", "player"]);
    for (const o of owners) store.setAutoPlay(o.ownerId, true);
    const lad = ladder();
    let stopped: string[] = [];
    for (let i = 0; i < 25 && stopped.length === 0; i++) {
      const r = await lad.runRound();
      stopped = r.matches.flatMap((m) => m.autoPlayStopped);
    }
    expect(stopped).toHaveLength(1);
    const winner = stopped[0]!;
    expect(store.dailyEarnings(winner).rewardedWins).toHaveLength(10);
    expect(store.autoPlay(winner)).toMatchObject({ on: false, stopped: { reason: "dailyRewardsMaxed" } });
    // The other owner is still on, but alone: no one to pair with.
    expect(lad.eligibleOwners()).toEqual(owners.map((o) => o.ownerId).filter((o) => o !== winner));
    expect((await lad.runRound()).pairs).toEqual([]);
    advance(24 * 3600_000);
    expect(store.autoPlay(winner).canTurnOn).toBe(true);
  });

  it("house owners spend what they earn on packs and open them before the round, so their agents rebuild; player owners' credits are left alone", async () => {
    const { store, owners, ladder } = setup(["Cortex", "Swarm", "Aegis", "Null"], ["house", "house", "house", "player"]);
    store.setAutoPlay(owners[3]!.ownerId, true);
    const player = owners[3]!.ownerId;
    const playerPacks = store.unopenedPacks(player).length;
    expect(playerPacks).toBeGreaterThan(0);
    // Each earns 270 credits in nine earlier days' first wins (30 each)
    // against a sparring owner who never queues.
    const spar = store.createOwner({ name: "sparring" });
    const sparAgent = store.createAgent({ ownerId: spar.ownerId, name: "Sparring" });
    let m = 0;
    for (const o of [owners[0]!, owners[3]!]) {
      for (let d = 1; d <= 9; d++) {
        const endedAt = new Date(Date.parse("2026-10-01T01:00:00Z") + d * 86_400_000).toISOString();
        store.recordMatch({ matchId: `earn-${++m}`, seed: m, p1AgentId: o.agentId, p2AgentId: sparAgent.agentId, outcome: { kind: "win", winnerAgentId: o.agentId }, endedAt });
      }
    }
    expect(store.balance(owners[0]!.ownerId)).toBe(270);
    const waiting = store.unopenedPacks(owners[0]!.ownerId).length;
    let n = 0;
    const lad = ladder(houseSeater, { housePacks: { packSeed: () => ++n } });
    const r = await lad.runRound();
    const mine = r.housePacks.find((h) => h.ownerId === owners[0]!.ownerId)!;
    // 270 credits buy 2 packs (100 each); 70 stay.
    expect(mine).toMatchObject({ bought: 2, opened: waiting + 2 });
    expect(mine.newCards).toBeGreaterThan(0);
    expect(r.housePacks.map((h) => h.ownerId)).not.toContain(player);
    expect(store.unopenedPacks(owners[0]!.ownerId)).toEqual([]);
    expect(store.unopenedPacks(player)).toHaveLength(playerPacks);
    // The player's own 270 and its match pay stay; the house's 70 left plus pay.
    expect(store.balance(player)).toBeGreaterThanOrEqual(270);
    expect(store.balance(owners[0]!.ownerId)).toBeLessThanOrEqual(70 + 30);
    // Opened packs changed every house owner's holdings: the first build
    // came after them, so nothing rebuilds for that reason yet.
    expect(r.rebuilt).toHaveLength(4);
  });
});
