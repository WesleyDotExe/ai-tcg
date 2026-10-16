import { describe, expect, it } from "vitest";
import { AGENT_NAME_MAX_LENGTH } from "@ai-tcg/engine";
import { AGENT_RENAME_PACK_POINTS, EconomyStore, customAgentNameProblem } from "../src/index.js";

// Owners name their agents (owner 2026-10-16, session 37): free when the
// agent is created, pack points for any rename after; the name rules run in
// the game's own server code; old names stay visible as "formerly ...";
// an admin can force a rename.

const T0 = Date.parse("2026-10-16T10:00:00.000Z");
const PW = "correct horse battery";
function store() {
  let t = T0;
  // Each call a second later, so the name log's order shows in the times.
  return EconomyStore.open(":memory:", { now: () => new Date((t += 1000)) });
}

/** "Generate a new agent" with fixed seeds, optionally typing a name. */
function generate(s: EconomyStore, ownerId: string, seed: number, name?: string) {
  const draft = s.startAgentDraft(ownerId, { seed });
  const picked = s.pickDraftAgent(ownerId, draft.draftId, 0, { seed: seed + 1000 });
  return { draft, shown: picked.signatures![0]!, made: s.confirmAgentDraft(ownerId, draft.draftId, 0, { name }) };
}

/** An owner with `points` pack points, earned the real way: opening packs. */
function withPackPoints(s: EconomyStore, ownerId: string, packs: number) {
  for (let i = 0; i < packs; i++) s.grantPack(ownerId, "S0", "weeklyChallenge");
  for (let i = 0; i < packs; i++) s.openPack(ownerId, undefined, { seed: i });
}

describe("the typed-name rules (server-side, no outside service)", () => {
  it("accepts ordinary names, letters, digits and simple punctuation", () => {
    for (const ok of ["Moth", "Night Owl 2", "Dr. Static", "o'Malley-9", "neon_fan99", "a".repeat(AGENT_NAME_MAX_LENGTH)]) {
      expect(customAgentNameProblem(ok), ok).toBeUndefined();
    }
  });

  it("refuses length, characters, punctuation runs, staff and the blocked words", () => {
    const refused: [string, RegExp][] = [
      ["ab", /3 to 32/],
      ["a".repeat(AGENT_NAME_MAX_LENGTH + 1), /3 to 32/],
      ["Zoë", /letters, digits/],
      ["Аdmin", /letters, digits/], // a Cyrillic A
      ["Hi!", /letters, digits/],
      ["-edge", /starts and ends/],
      ["1234", /at least one letter/],
      ["a..b", /punctuation together/],
      ["Admin", /pose as staff/],
      ["AI-TCG Official", /pose as staff/],
      ["TheRealAdmin", /pose as staff/],
      ["Mod Squad", /pose as staff/],
      ["Moderator Bot", /pose as staff/],
      ["Shitposter", /blocked word/],
      ["Static Static", /repeats/],
    ];
    for (const [name, why] of refused) expect(customAgentNameProblem(name), name).toMatch(why);
    // Whole words only for the short ones: ordinary words that contain them pass.
    for (const ok of ["Modem Ghost", "Developing Story", "Gemini"]) expect(customAgentNameProblem(ok), ok).toBeUndefined();
  });
});

describe("naming an agent when it is created (free)", () => {
  it("keeps the generated name, or takes a typed one, and the card's flavour uses it", () => {
    const s = store();
    const o = s.createOwner({ name: "o" }).ownerId;
    const kept = generate(s, o, 3).made;
    expect(s.agentNames(kept.agent.agentId).history).toEqual([expect.objectContaining({ kind: "generated", byOwnerId: o, packPoints: 0 })]);

    const { draft, shown, made } = generate(s, o, 5, "  Night   Owl  ");
    expect(made.agent.name).toBe("Night Owl");
    expect(s.agentNames(made.agent.agentId).history).toEqual([expect.objectContaining({ name: "Night Owl", kind: "custom", packPoints: 0 })]);
    // The card keeps its generated, themed name; its printed flavour names the agent as created.
    const generatedName = draft.agents[0]!.name;
    expect(made.signature.card.name).toBe(shown.name);
    expect(made.signature.card.flavor).toBe(shown.flavor.replaceAll(generatedName, "Night Owl"));
    expect(made.signature.card.flavor).not.toContain(generatedName);
    // Free: nothing on the ledger.
    expect(s.ledger(o)).toEqual([]);
  });

  it("refuses a taken name without case, another owner's username, and a refused word", () => {
    const s = store();
    const ada = s.createAccount({ name: "Ada", username: "neon_fan99", password: PW }).ownerId;
    const bo = s.createAccount({ name: "Bo", username: "bo-runner", password: PW }).ownerId;
    generate(s, ada, 1, "Night Owl");
    expect(() => generate(s, bo, 2, "NIGHT OWL")).toThrow(/is taken/);
    expect(() => generate(s, bo, 2, "Neon Fan 99")).toThrow(/another owner's username/);
    expect(() => generate(s, bo, 2, "Admin")).toThrow(/pose as staff/);
    // An owner may name its agent after its own username.
    expect(generate(s, bo, 2, "Bo-Runner").made.agent.name).toBe("Bo-Runner");
    // A refused confirm leaves the draft open to try again.
    expect(s.listAgents(bo)).toHaveLength(1);
  });
});

describe("renaming an agent (pack points)", () => {
  it(`costs ${AGENT_RENAME_PACK_POINTS} pack points, logs the old name as "formerly", and is refused without the points`, () => {
    const s = store();
    const o = s.createOwner({ name: "o" }).ownerId;
    const { agent, signature } = generate(s, o, 7).made;
    const generated = agent.name;
    expect(() => s.renameAgent(o, agent.agentId, "Night Owl")).toThrow(`a rename costs ${AGENT_RENAME_PACK_POINTS} pack points; you have 0`);

    withPackPoints(s, o, 40); // 40 packs x 5 = 200 pack points
    const after = s.renameAgent(o, agent.agentId, "Night Owl");
    expect(after).toMatchObject({ current: "Night Owl", formerly: [generated] });
    expect(s.getAgent(agent.agentId).name).toBe("Night Owl");
    expect(s.balance(o, "packPoints")).toBe(200 - AGENT_RENAME_PACK_POINTS);
    const charge = s.ledger(o).find((e) => e.reason === "agentRename")!;
    expect(charge).toMatchObject({ currency: "packPoints", delta: -AGENT_RENAME_PACK_POINTS });
    expect(after.history.at(-1)).toMatchObject({ kind: "rename", packPoints: AGENT_RENAME_PACK_POINTS, byOwnerId: o });

    // The signature card keeps its name.
    expect(s.signatureCard(agent.agentId)!.card).toMatchObject({ name: signature.card.name, flavor: signature.card.flavor });
    // A second rename; both old names listed, newest first.
    s.renameAgent(o, agent.agentId, "Day Owl");
    expect(s.agentNames(agent.agentId)).toMatchObject({ current: "Day Owl", formerly: ["Night Owl", generated] });
    expect(() => s.renameAgent(o, agent.agentId, "Dusk Owl")).toThrow(/you have 0/);
  });

  it("an old name stays reserved for its agent: no one else may take it, the agent may take it back", () => {
    const s = store();
    const a = s.createOwner({ name: "a" }).ownerId;
    const b = s.createOwner({ name: "b" }).ownerId;
    const first = generate(s, a, 11).made.agent;
    withPackPoints(s, a, 40);
    s.renameAgent(a, first.agentId, "Night Owl");
    expect(() => generate(s, b, 12, first.name.toLowerCase())).toThrow(/stays reserved/);
    s.renameAgent(a, first.agentId, first.name);
    expect(s.agentNames(first.agentId)).toMatchObject({ current: first.name, formerly: ["Night Owl"] });
    // Generated names avoid every reserved name too.
    for (let seed = 0; seed < 20; seed++) {
      const d = s.startAgentDraft(b, { seed });
      for (const c of d.agents) expect(c.name.toLowerCase()).not.toBe("night owl");
    }
  });

  it("only the owner renames, never to the same name, never during the agent's live match", () => {
    const s = store();
    const a = s.createOwner({ name: "a" }).ownerId;
    const b = s.createOwner({ name: "b" }).ownerId;
    const { agent } = generate(s, a, 21).made;
    withPackPoints(s, a, 40);
    expect(() => s.renameAgent(b, agent.agentId, "Night Owl")).toThrow(/only the agent's owner/);
    expect(() => s.renameAgent(a, agent.agentId, agent.name)).toThrow(/already called/);
    // A live match.
    for (const [o, faction, seed] of [[a, "Cortex", 0], [b, "Swarm", 22]] as const) {
      const { copies } = s.grantStarterCollection(o, faction);
      const deck = s.saveDeck(o, `${faction} starter`, copies.map((c) => c.copyId));
      s.setActiveDeck(o, deck.deckId);
      if (o === b) generate(s, b, seed);
      s.connectAgent(o, s.listAgents(o)[0]!.agentId);
    }
    s.startMatch({ matchId: "live-1", p1OwnerId: a, p2OwnerId: b });
    expect(() => s.renameAgent(a, agent.agentId, "Night Owl")).toThrow(/live match/);
    expect(s.balance(a, "packPoints")).toBe(200);
  });
});

describe("an admin's force-rename", () => {
  it("is free, admin-only, records its reason, and the old name is never shown again but stays reserved", () => {
    const s = store();
    const admin = s.createAccount({ name: "House", username: "house", password: PW, isAdmin: true }).ownerId;
    const o = s.createAccount({ name: "o", username: "owner-o", password: PW }).ownerId;
    const { agent } = generate(s, o, 31, "Rude Name").made;
    expect(() => s.forceRenameAgent(o, agent.agentId, { reason: "x" })).toThrow(/only an admin/);
    expect(() => s.forceRenameAgent(admin, agent.agentId, { reason: " " })).toThrow(/reason/);

    const forced = s.forceRenameAgent(admin, agent.agentId, { reason: "offensive name, reported", seed: 4 });
    expect(forced.current).not.toBe("Rude Name");
    expect(forced.formerly).toEqual([]); // never shown again
    expect(forced.history.at(-1)).toMatchObject({ kind: "forced", byOwnerId: admin, note: "offensive name, reported", packPoints: 0 });
    expect(s.ledger(o)).toEqual([]);
    // Still reserved: no one takes it.
    const other = s.createOwner({ name: "x" }).ownerId;
    expect(() => generate(s, other, 32, "rude name")).toThrow(/reserved/);
    // An admin may also give a name, checked by the same rules.
    expect(() => s.forceRenameAgent(admin, agent.agentId, { reason: "r", name: "Admin" })).toThrow(/pose as staff/);
    expect(s.forceRenameAgent(admin, agent.agentId, { reason: "owner asked", name: "Quiet Moth" }).current).toBe("Quiet Moth");
  });
});
