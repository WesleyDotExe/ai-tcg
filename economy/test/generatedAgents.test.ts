import { describe, expect, it } from "vitest";
import { APPROVED_SIGNATURE_LINES, LookaheadAgent, runMatch, SHIPPED_DECK_LISTS, signatureFingerprint } from "@ai-tcg/engine";
import { EconomyStore } from "../src/index.js";

// Generating a new agent (session 34; owner app spec B, 2026-10-05): 3
// generated agents, pick one, then its signature card from 3, then confirm.
// The card is the agent's bound promo; it plays from the signature zone.

const T0 = Date.parse("2026-10-16T10:00:00.000Z");
function store() {
  return EconomyStore.open(":memory:", { now: () => new Date(T0) });
}

/** One complete "Generate a new agent", with fixed seeds. */
function generate(s: EconomyStore, ownerId: string, seed: number, agentIndex = 0, signatureIndex = 0) {
  const draft = s.startAgentDraft(ownerId, { seed });
  s.pickDraftAgent(ownerId, draft.draftId, agentIndex, { seed: seed + 1000 });
  return s.confirmAgentDraft(ownerId, draft.draftId, signatureIndex);
}

function ready(s: EconomyStore, name: string, faction: "Cortex" | "Swarm" | "Aegis" | "Null") {
  const owner = s.createOwner({ name });
  const { copies } = s.grantStarterCollection(owner.ownerId, faction);
  const deck = s.saveDeck(owner.ownerId, `${faction} starter`, copies.map((c) => c.copyId));
  s.setActiveDeck(owner.ownerId, deck.deckId);
  return owner.ownerId;
}

describe("generating a new agent", () => {
  it("shows 3 named agents, then 3 approved signature cards with different abilities", () => {
    const s = store();
    const o = s.createOwner({ name: "o" });
    const draft = s.startAgentDraft(o.ownerId, { seed: 7 });
    expect(draft.agents).toHaveLength(3);
    expect(new Set(draft.agents.map((a) => a.name)).size).toBe(3);
    for (const a of draft.agents) expect(a.persona).toMatch(/^An? .+ that .+\.$/);
    // Server-side state: the same draft comes back as shown.
    expect(s.openAgentDraft(o.ownerId)).toEqual(draft);

    const picked = s.pickDraftAgent(o.ownerId, draft.draftId, 2, { seed: 8 });
    const sigs = picked.signatures!;
    expect(sigs).toHaveLength(3);
    expect(new Set(sigs.map((c) => c.spec.ability)).size).toBe(3);
    const approved = new Map(APPROVED_SIGNATURE_LINES.map((l) => [l.id, l]));
    for (const c of sigs) {
      expect(approved.has(c.comboId)).toBe(true);
      expect(c.measured.worst).toBeLessThanOrEqual(0.02);
      expect(c.flavor).toContain(draft.agents[2]!.name);
    }
    expect(() => s.pickDraftAgent(o.ownerId, draft.draftId, 0)).toThrow(/already picked/);
  });

  it("confirming creates the agent, its card (PR-001) and the bound promo copy, in one go", () => {
    const s = store();
    const o = s.createOwner({ name: "o" });
    const draft = s.startAgentDraft(o.ownerId, { seed: 11 });
    const picked = s.pickDraftAgent(o.ownerId, draft.draftId, 1, { seed: 12 });
    const shown = picked.signatures![2]!;
    const { agent, signature, copy } = s.confirmAgentDraft(o.ownerId, draft.draftId, 2);

    expect(agent).toMatchObject({ ownerId: o.ownerId, name: draft.agents[1]!.name, persona: draft.agents[1]!.persona });
    expect(signature).toMatchObject({ agentId: agent.agentId, cardId: "sig-PR-001", collectorNumber: "PR-001", comboId: shown.comboId, spec: shown.spec });
    expect(signature.card).toMatchObject({ id: "sig-PR-001", name: shown.name, faction: "Neutral", rarity: "Mythic", type: "Unit", flavor: shown.flavor });
    expect(signature.fingerprint).toBe(APPROVED_SIGNATURE_LINES.find((l) => l.id === shown.comboId)!.fingerprint);
    expect(signatureFingerprint(signature.card)).toBe(signature.fingerprint);
    expect(copy).toMatchObject({ cardId: "sig-PR-001", origin: "promo", originRef: `signature:${agent.agentId}`, accountBound: true, seriesKind: "promo", seriesCode: "PR-001", stamp: "SIGNATURE" });
    expect(s.collection(o.ownerId).map((c) => c.copyId)).toEqual([copy.copyId]);
    // The card viewer knows it, and it never salvages.
    expect(s.cardHoldings(o.ownerId, "sig-PR-001")).toMatchObject({ owned: 1, salvageable: 0 });
    // A new agent gets its signature card only (owner app spec B): no credits, no packs.
    expect(s.balance(o.ownerId)).toBe(0);
    expect(s.unopenedPacks(o.ownerId)).toEqual([]);
    // Not connected until the owner connects it.
    expect(s.connectedAgent(o.ownerId)).toBeNull();
    // The draft is closed.
    expect(s.openAgentDraft(o.ownerId)).toBeNull();
    expect(() => s.confirmAgentDraft(o.ownerId, draft.draftId, 0)).toThrow(/closed/);

    // The next agent's card is PR-002.
    expect(generate(s, o.ownerId, 21).signature.collectorNumber).toBe("PR-002");
  });

  it("never offers a name the season already has; combinations may repeat (owner 2026-10-15)", () => {
    const s = store();
    const owners = Array.from({ length: 4 }, (_, i) => s.createOwner({ name: `o${i}` }).ownerId);
    const made = owners.map((o, i) => generate(s, o, 100 + i));
    expect(new Set(made.map((m) => m.agent.name)).size).toBe(made.length);
    expect(new Set(made.map((m) => m.signature.card.name)).size).toBe(made.length);
    // Every later draft avoids all four names.
    const names = made.map((m) => m.signature.card.name);
    for (let seed = 0; seed < 30; seed++) {
      const o = s.createOwner({ name: `later${seed}` }).ownerId;
      const d = s.startAgentDraft(o, { seed });
      for (const a of d.agents) expect(made.map((m) => m.agent.name)).not.toContain(a.name);
      const p = s.pickDraftAgent(o, d.draftId, 0, { seed: seed + 1 });
      for (const c of p.signatures!) expect(names).not.toContain(c.name);
    }
  });

  it("generates more agents than there are approved lines: the pool no longer caps a season", () => {
    const s = store();
    const count = APPROVED_SIGNATURE_LINES.length + 6;
    const made = Array.from({ length: count }, (_, i) => generate(s, s.createOwner({ name: `o${i}` }).ownerId, 300 + i));
    const combos = made.map((m) => m.signature.comboId);
    // Some combination is shared (more agents than lines), and the schema takes it.
    expect(new Set(combos).size).toBeLessThan(count);
    expect(new Set(made.map((m) => m.signature.card.name)).size).toBe(count);
    expect(new Set(made.map((m) => m.signature.collectorNumber)).size).toBe(count);
    // A card name is still unique in the schema itself.
    expect(() => s.unsafeExec(`UPDATE signature_cards SET name = '${made[0]!.signature.card.name.replace(/'/g, "''")}' WHERE agent_id = '${made[1]!.agent.agentId}'`)).toThrow(/UNIQUE/);
  });

  it("now and then names the card after the owner's username, never a refused one", () => {
    const s = store();
    let withName = 0;
    let shown = 0;
    // One login; each new draft replaces the last.
    const o = s.createAccount({ name: "u", username: "neonfan", password: "correct horse battery" }).ownerId;
    const plain = s.createOwner({ name: "house" }).ownerId;
    for (let i = 0; i < 300; i++) {
      const d = s.startAgentDraft(o, { seed: 500 + i });
      const p = s.pickDraftAgent(o, d.draftId, 0, { seed: 900 + i });
      for (const c of p.signatures!) {
        shown++;
        if (c.name.startsWith("Neonfan's ")) withName++;
      }
      // An owner without a login (the house owners) never gets one.
      const dh = s.startAgentDraft(plain, { seed: 500 + i });
      for (const c of s.pickDraftAgent(plain, dh.draftId, 0, { seed: 900 + i }).signatures!) expect(c.name).not.toMatch(/^Neonfan's /);
    }
    // 1 in USERNAME_HANDLE_ODDS (100) per candidate: about 9 of 900 (seeded,
    // so this count is fixed). At 90 drafts the expected count was 2.7 and a
    // change to the approved list (session 49) drew 1; 300 drafts keeps the
    // bounds well clear of chance.
    expect(withName).toBeGreaterThan(2);
    expect(withName).toBeLessThan(25);
    expect(shown).toBe(900);
  });

  it("refuses a confirm when the shown card was taken in the meantime", () => {
    const s = store();
    const a = s.createOwner({ name: "a" }).ownerId;
    const b = s.createOwner({ name: "b" }).ownerId;
    // Same seeds: both owners are shown the same signature lines.
    const da = s.startAgentDraft(a, { seed: 5 });
    const db = s.startAgentDraft(b, { seed: 6 });
    const pa = s.pickDraftAgent(a, da.draftId, 0, { seed: 9 });
    const pb = s.pickDraftAgent(b, db.draftId, 0, { seed: 9 });
    expect(pa.signatures!.map((c) => c.comboId)).toEqual(pb.signatures!.map((c) => c.comboId));
    s.confirmAgentDraft(a, da.draftId, 0);
    // Same seeds, same names: the card name is taken now.
    expect(() => s.confirmAgentDraft(b, db.draftId, 0)).toThrow(/card name ".+" was taken since this draft was made/);
    // A different, still-free candidate from the same draft is fine.
    expect(s.confirmAgentDraft(b, db.draftId, 1).signature.comboId).toBe(pb.signatures![1]!.comboId);
  });

  it("keeps one open draft per owner, and only its owner can use it", () => {
    const s = store();
    const a = s.createOwner({ name: "a" }).ownerId;
    const b = s.createOwner({ name: "b" }).ownerId;
    const first = s.startAgentDraft(a, { seed: 1 });
    const second = s.startAgentDraft(a, { seed: 2 });
    expect(s.openAgentDraft(a)!.draftId).toBe(second.draftId);
    expect(() => s.pickDraftAgent(a, first.draftId, 0)).toThrow(/closed/);
    expect(() => s.pickDraftAgent(b, second.draftId, 0)).toThrow(/no draft/);
    expect(() => s.confirmAgentDraft(a, second.draftId, 0)).toThrow(/pick an agent before/);
    expect(() => s.pickDraftAgent(a, second.draftId, 3)).toThrow(/no agent candidate 3/);
    s.pickDraftAgent(a, second.draftId, 0, { seed: 3 });
    expect(() => s.confirmAgentDraft(a, second.draftId, 5)).toThrow(/no signature candidate 5/);
    // The schema holds "one open draft" without the store.
    expect(() =>
      s.unsafeExec(`INSERT INTO agent_drafts (draft_id, owner_id, agents_json, created_at) VALUES ('raw', '${a}', '[]', '2026-10-16T10:00:00.000Z')`),
    ).toThrow(/UNIQUE/);
  });

  it("the schema keeps a signature card and its single copy honest", () => {
    const s = store();
    const a = s.createOwner({ name: "a" }).ownerId;
    const b = s.createOwner({ name: "b" }).ownerId;
    const { agent, signature } = generate(s, a, 40);
    const ref = `signature:${agent.agentId}`;
    expect(() => s.unsafeExec(`DELETE FROM signature_cards`)).toThrow(/never deleted/);
    expect(() => s.unsafeExec(`UPDATE signature_cards SET promo_number = 9`)).toThrow(/keeps its agent/);
    // A second copy for the same agent, a copy held by another owner, or a set card dressed up as a signature card.
    const grant = (ownerId: string, cardId: string) =>
      s.grantCopy({ ownerId, cardId, origin: "promo", originRef: ref, seriesKind: "promo", seriesCode: "PR-001", stamp: "SIGNATURE" });
    expect(() => grant(a, signature.cardId)).toThrow(/UNIQUE/);
    expect(() => grant(b, signature.cardId)).toThrow(/own signature card/);
    expect(() => grant(a, SHIPPED_DECK_LISTS.Cortex[0]!.cardId)).toThrow(/own signature card/);
  });

  it("a signature card plays from the zone: never in a deck, and the connected agent's card is the one in the match", async () => {
    const s = store();
    const a = ready(s, "a", "Cortex");
    const b = ready(s, "b", "Swarm");
    const first = generate(s, a, 50);
    const second = generate(s, a, 51);
    const handMade = s.createAgent({ ownerId: b, name: "b-plain" });
    s.connectAgent(b, handMade.agentId);

    expect(() => s.saveDeck(a, "with sig", [first.copy.copyId, ...s.collection(a).filter((c) => c.origin === "starter").slice(0, 39).map((c) => c.copyId)])).toThrow(
      /plays from its own zone/,
    );

    s.connectAgent(a, first.agent.agentId);
    const live = s.startMatch({ matchId: "m1", p1OwnerId: a, p2OwnerId: b });
    expect(live.p1.deck.spec.signature).toEqual(first.signature.card);
    expect(live.p2.deck.spec.signature).toBeUndefined();
    // It really plays: a full game with the generated card in the zone.
    const p1 = { ...live.p1.deck.spec, id: "p1" as const };
    const p2 = { ...live.p2.deck.spec, id: "p2" as const };
    const { state } = await runMatch(p1, p2, new LookaheadAgent("A", 1), new LookaheadAgent("B", 2), 1);
    expect(state.winner).not.toBeNull();
    s.recordMatch({ matchId: "m1", seed: 1, p1AgentId: first.agent.agentId, p2AgentId: handMade.agentId, outcome: { kind: "win", winnerAgentId: first.agent.agentId }, endedAt: "2026-10-16T10:05:00.000Z" });

    // Switching agents changes only the signature card.
    s.connectAgent(a, second.agent.agentId);
    const next = s.startMatch({ matchId: "m2", p1OwnerId: a, p2OwnerId: b });
    expect(next.p1.deck.spec.signature).toEqual(second.signature.card);
    expect(next.p1.deck.copyIds).toEqual(live.p1.deck.copyIds);
  });
});
