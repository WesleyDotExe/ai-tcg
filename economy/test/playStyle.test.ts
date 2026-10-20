// Play styles in the store (schema v13; owner 2026-10-15: "owners pick their
// agent's play style from a set of presets; a change made during a live
// match applies from the next match"). The style is per agent, Calculator by
// default; a live match keeps the style each side started with, and the
// match record keeps it.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LookaheadAgent, PLAY_STYLE_IDS, runMatch } from "@ai-tcg/engine";
import { EconomyStore } from "../src/index.js";

let clock = new Date("2026-10-20T10:00:00.000Z");
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });
const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmpFile = () => {
  const d = mkdtempSync(join(tmpdir(), "ai-tcg-style-"));
  tmpDirs.push(d);
  return join(d, "s0.db");
};

/** An owner with a starter, a connected agent and the agent's built deck. */
async function seat(s: EconomyStore, name: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null") {
  const o = s.createOwner({ name, kind: "house" });
  s.grantStarterCollection(o.ownerId, faction);
  const agent = s.createAgent({ ownerId: o.ownerId, name: `${name}-a` });
  s.connectAgent(o.ownerId, agent.agentId);
  await s.buildAgentDeck(o.ownerId, { games: 0 });
  return { ownerId: o.ownerId, agentId: agent.agentId };
}

describe("play styles", () => {
  it("a new agent plays Calculator; the owner can pick any preset, and nothing else", () => {
    const s = open();
    const o = s.createOwner({ name: "ada" });
    const a = s.createAgent({ ownerId: o.ownerId, name: "ada-a" });
    expect(a.playStyle).toBe("calculator");
    expect(s.getAgent(a.agentId).playStyle).toBe("calculator");
    for (const id of PLAY_STYLE_IDS) {
      expect(s.setPlayStyle(a.agentId, id).playStyle).toBe(id);
      expect(s.listAgents(o.ownerId)[0]!.playStyle).toBe(id);
    }
    expect(() => s.setPlayStyle(a.agentId, "berserker")).toThrow(/not a play style/);
    expect(() => s.setPlayStyle("no-such-agent", "rusher")).toThrow();
    // The schema holds the same list for any caller.
    expect(() => s.unsafeExec(`UPDATE agents SET play_style = 'berserker' WHERE agent_id = '${a.agentId}'`)).toThrow(/CHECK/);
  });

  it("a change during a live match applies from the next match; the record keeps the style played", async () => {
    const s = open();
    const a = await seat(s, "a", "Swarm");
    const b = await seat(s, "b", "Null");
    s.setPlayStyle(a.agentId, "rusher");
    const live = s.startMatch({ matchId: "m1", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
    expect(live.p1.playStyle).toBe("rusher");
    expect(live.p2.playStyle).toBe("calculator");

    // The owner switches mid-match: allowed, and the running match is untouched.
    s.setPlayStyle(a.agentId, "fortress");
    expect(live.p1.playStyle).toBe("rusher");
    const { state } = await runMatch(
      { ...live.p1.deck.spec, id: "p1" },
      { ...live.p2.deck.spec, id: "p2" },
      new LookaheadAgent("a", 9, { style: live.p1.playStyle }),
      new LookaheadAgent("b", 9, { style: live.p2.playStyle }),
      9,
    );
    const winner = state.winner === "p1" ? a.agentId : state.winner === "p2" ? b.agentId : null;
    const rec = s.recordMatch({
      matchId: "m1",
      seed: 9,
      p1AgentId: a.agentId,
      p2AgentId: b.agentId,
      outcome: winner ? { kind: "win", winnerAgentId: winner } : { kind: "draw" },
      turns: state.turnNumber,
    });
    expect(rec.playStyles).toEqual({ p1: "rusher", p2: "calculator" });
    expect(s.matchHistory({ agentId: a.agentId })[0]!.playStyles).toEqual({ p1: "rusher", p2: "calculator" });

    clock = new Date(clock.getTime() + 60_000);
    const next = s.startMatch({ matchId: "m2", p1OwnerId: b.ownerId, p2OwnerId: a.ownerId });
    expect(next.p2.playStyle).toBe("fortress");
    s.recordMatch({ matchId: "m2", seed: 10, p1AgentId: b.agentId, p2AgentId: a.agentId, outcome: { kind: "cancelled" } });
    expect(s.matchHistory({ agentId: a.agentId }).map((m) => m.playStyles)).toEqual([
      { p1: "rusher", p2: "calculator" },
      { p1: "calculator", p2: "fortress" },
    ]);
  });

  it("a match never started live has no styles on its record", async () => {
    const s = open();
    const a = await seat(s, "a", "Cortex");
    const b = await seat(s, "b", "Aegis");
    const rec = s.recordMatch({ matchId: "offline", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "draw" } });
    expect(rec.playStyles).toBeNull();
    expect(s.matchHistory()[0]!.playStyles).toBeNull();
  });
});

describe("migration v12 -> v13", () => {
  it("every existing agent plays Calculator; matches from before have no styles", async () => {
    const path = tmpFile();
    const v12 = open(path, 12);
    const a = await seat(v12, "a", "Swarm");
    const b = await seat(v12, "b", "Null");
    v12.startMatch({ matchId: "old", p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
    v12.recordMatch({ matchId: "old", seed: 1, p1AgentId: a.agentId, p2AgentId: b.agentId, outcome: { kind: "draw" } });
    expect(() => v12.setPlayStyle(a.agentId, "rusher")).toThrow(/v13/);
    v12.close();

    const v13 = open(path, 13);
    expect(v13.schemaVersion).toBe(13);
    expect(v13.getAgent(a.agentId).playStyle).toBe("calculator");
    expect(v13.matchHistory()[0]!.playStyles).toBeNull();
    expect(v13.setPlayStyle(a.agentId, "tempo").playStyle).toBe("tempo");
    v13.close();
  });
});
