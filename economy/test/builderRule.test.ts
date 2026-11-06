// The builder's pick rule on every agent deck (schema v25; owner 2026-11-06:
// switch the deck builder's keep-designed rule on at 1 SD, rebuild agent
// decks through the normal rebuild reasons, and "record it with the
// builder's settings so a build says which rule and margin made it").

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { builderRule, chooseDeck, type DeckBuildOptions, type Holdings } from "@ai-tcg/engine";
import { EconomyStore } from "../src/index.js";

let clock = new Date("2026-11-06T10:00:00.000Z");
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });
const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmpFile = () => {
  const d = mkdtempSync(join(tmpdir(), "ai-tcg-builder-rule-"));
  tmpDirs.push(d);
  return join(d, "s0.db");
};
const FAST = { games: 0 };
const RULE_CHANGED = "the builder's rule changed (the plain rule (the most confirm wins) -> keep the designed deck unless beaten by more than 1 SD)";

function owner(s: EconomyStore, name: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null") {
  const o = s.createOwner({ name, kind: "house" });
  s.grantStarterCollection(o.ownerId, faction);
  const agent = s.createAgent({ ownerId: o.ownerId, name: `${name}-a` });
  s.connectAgent(o.ownerId, agent.agentId);
  return { ownerId: o.ownerId, agentId: agent.agentId };
}

describe("the builder's rule on the agent's deck (v25)", () => {
  it("a build records the store's rule (keep-designed at 1 SD) and is up to date", async () => {
    const s = open();
    expect(s.schemaVersion).toBeGreaterThanOrEqual(25);
    const { ownerId } = owner(s, "a", "Swarm");
    const built = await s.buildAgentDeck(ownerId, FAST);
    expect(built.rule).toBe("keep-designed:1");
    expect(s.agentDeckBuiltFrom(ownerId)!.rule).toBe("keep-designed:1");
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
  });

  it("a deck built with the plain rule asks for a rebuild, and the rebuild uses the store's rule", async () => {
    const s = open();
    const { ownerId } = owner(s, "a", "Null");
    const plain = await s.buildAgentDeck(ownerId, { ...FAST, keepDesigned: null });
    expect(plain.rule).toBe("plain");
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([RULE_CHANGED]);
    const again = await s.rebuildAgentDeckIfNeeded(ownerId, FAST);
    expect(again!.reasons).toEqual([RULE_CHANGED]);
    expect(again!.build.rule).toBe("keep-designed:1");
    expect(again!.build.deck.deckId).toBe(plain.deck.deckId); // rebuilt in place
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
  });

  it("a deck built before v25 reads as the plain rule after the migration and is rebuilt once", async () => {
    const path = tmpFile();
    const v24 = open(path, 24);
    const { ownerId } = owner(v24, "a", "Cortex");
    await v24.buildAgentDeck(ownerId, FAST);
    expect(v24.agentDeckBuiltFrom(ownerId)!.rule).toBe("plain");
    expect(v24.agentDeckRebuildReasons(ownerId)).toEqual([]); // a v24 store knows no rule
    v24.close();

    const v25 = open(path);
    expect(v25.schemaVersion).toBeGreaterThanOrEqual(25);
    expect(v25.agentDeckBuiltFrom(ownerId)!.rule).toBe("plain");
    expect(v25.agentDeckRebuildReasons(ownerId)).toEqual([RULE_CHANGED]);
    const rebuilt = await v25.rebuildAgentDeckIfNeeded(ownerId, FAST);
    expect(rebuilt!.build.rule).toBe("keep-designed:1");
    expect(v25.agentDeckRebuildReasons(ownerId)).toEqual([]);
    v25.close();
  });

  it("the rule is one reason among the others: one rebuild for all of them", async () => {
    const s = open();
    const { ownerId, agentId } = owner(s, "a", "Swarm");
    await s.buildAgentDeck(ownerId, { ...FAST, keepDesigned: null });
    s.setPlayStyle(ownerId, agentId, "rusher");
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual(["the play style changed (Calculator -> Rusher)", RULE_CHANGED]);
    await s.rebuildAgentDeckIfNeeded(ownerId, FAST);
    expect(s.agentDeckRebuildReasons(ownerId)).toEqual([]);
  });

  it("an edit by hand forgets the rule with the rest", async () => {
    const s = open();
    const { ownerId } = owner(s, "a", "Aegis");
    const built = await s.buildAgentDeck(ownerId, FAST);
    s.updateDeck(ownerId, built.deck.deckId, built.deck.copyIds.slice(0, 30));
    expect(s.agentDeckBuiltFrom(ownerId)).toBeNull();
  });

  it("a stand-in chooser that doesn't name its rule is recorded with the rule its options select", async () => {
    const s = open();
    const { ownerId } = owner(s, "a", "Swarm");
    const silent = async (h: Holdings, o: DeckBuildOptions) => {
      const { rule: _rule, ...rest } = await chooseDeck(h, o);
      return rest as Awaited<ReturnType<typeof chooseDeck>>;
    };
    const built = await s.buildAgentDeck(ownerId, { ...FAST, keepDesigned: 2 }, silent);
    expect(built.rule).toBe(builderRule({ keepDesigned: 2 }));
    expect(s.agentDeckBuiltFrom(ownerId)!.rule).toBe("keep-designed:2");
  });
});
