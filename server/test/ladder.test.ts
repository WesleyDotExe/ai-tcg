// The ladder runner (session 66): rounds of real engine matches between
// house owners over an in-memory store, with the rebuild-between-matches
// rule, the payouts, the ratings, and the fault paths (a seat that throws,
// one that plays an illegal move, one that can't be seated, an engine
// error).

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCard, LookaheadAgent, SHIPPED_DECK_LISTS, type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore, RATING_START } from "@ai-tcg/economy";
import { houseSeater, Ladder, type AgentSeater } from "../src/ladder/ladderRunner.js";

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

function setup(factions: DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"]) {
  let clock = new Date("2026-11-01T22:00:00.000Z"); // 09:00 Mon in Sydney
  const store = EconomyStore.open(":memory:", { now: () => clock });
  const owners = factions.map((f, i) => {
    const o = store.createOwner({ name: `house-${i}`, kind: "house" });
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
      afterMatch: () => {
        clock = new Date(clock.getTime() + 600_000);
      },
      ...extra,
    });
  return { store, owners, ladder };
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
});
