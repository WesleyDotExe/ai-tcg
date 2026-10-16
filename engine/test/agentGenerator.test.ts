// The agent generator and the approved signature lines (session 34).

import { describe, expect, it } from "vitest";
import { APPROVED_SIGNATURE_LINES } from "../src/data/signatureApproved.js";
import { generateAgentCandidates, generateSignatureCandidates, signatureCardFor, describe as describeSpec } from "../src/data/agentGenerator.js";
import { buildSignatureCard, signatureComboId, signatureFingerprint, signatureSpecProblem } from "../src/data/signatureMenu.js";
import { FAIRNESS_LIMIT } from "../src/dev/signatureFairness.js";
import { CARD_REGISTRY } from "../src/data/registry.js";

const none = { agentNames: new Set<string>(), cardNames: new Set<string>() };

describe("the approved signature lines", () => {
  it("are all passes at 2,500 seeds, and the cards still do what was measured", () => {
    expect(APPROVED_SIGNATURE_LINES.length).toBeGreaterThanOrEqual(3);
    for (const l of APPROVED_SIGNATURE_LINES) {
      expect(l.id).toBe(signatureComboId(l.spec));
      expect(l.seeds).toBeGreaterThanOrEqual(2500);
      expect(l.worst).toBeLessThanOrEqual(FAIRNESS_LIMIT);
      expect(l.spec.attack).toBeGreaterThanOrEqual(2); // owner 2026-10-13
      expect(signatureSpecProblem(l.spec, { anyStats: true })).toBeUndefined();
      // A change to the menu data after the measurement fails here: re-measure, then re-run signatureApprovedList.ts.
      expect(signatureFingerprint(buildSignatureCard(l.spec, { anyStats: true })), l.id).toBe(l.fingerprint);
    }
    expect(new Set(APPROVED_SIGNATURE_LINES.map((l) => l.id)).size).toBe(APPROVED_SIGNATURE_LINES.length);
  });

  it("the fingerprint ignores id, name, art and flavour, and catches any change to what the card does", () => {
    const spec = APPROVED_SIGNATURE_LINES[0]!.spec;
    const base = buildSignatureCard(spec, { anyStats: true });
    const fp = signatureFingerprint(base);
    expect(signatureFingerprint({ ...base, id: "x", name: "y", art: "z", flavor: "w" })).toBe(fp);
    expect(signatureFingerprint({ ...base, health: base.health + 1 })).not.toBe(fp);
    expect(signatureFingerprint({ ...base, keywords: ["Rush"] })).not.toBe(fp);
    expect(signatureFingerprint({ ...base, abilities: [{ ...base.abilities[0]!, text: "changed" }] })).not.toBe(fp);
  });
});

describe("generateAgentCandidates", () => {
  it("gives 3 different agents, reproducibly, never a taken name", () => {
    const a = generateAgentCandidates(1, none);
    expect(a).toHaveLength(3);
    expect(generateAgentCandidates(1, none)).toEqual(a);
    expect(new Set(a.map((x) => x.name)).size).toBe(3);
    // The three personas never share a role or a habit.
    const habits = a.map((x) => x.persona.split(" that ")[1]);
    expect(new Set(habits).size).toBe(3);
    const b = generateAgentCandidates(1, { agentNames: new Set(a.map((x) => x.name)) });
    for (const x of b) expect(a.map((y) => y.name)).not.toContain(x.name);
  });

  it("gives hacker-handle names (owner 2026-10-16), and the 3 on a pick screen never share a final word", () => {
    for (let seed = 0; seed < 300; seed++) {
      const names = generateAgentCandidates(seed, none).map((c) => c.name);
      expect(new Set(names.map((n) => n.split(" ").at(-1))).size, names.join(" | ")).toBe(3);
      for (const n of names) expect(n, n).toMatch(/'s | of the |^\S+ \S+( \S+)?$/);
    }
  });

  it("still finds free names when almost every name is taken", () => {
    const taken = new Set<string>();
    for (let seed = 0; seed < 400; seed++) for (const c of generateAgentCandidates(seed, { agentNames: taken })) taken.add(c.name);
    expect(taken.size).toBe(1200);
  });
});

describe("generateSignatureCandidates", () => {
  it("draws 3 approved lines with 3 different abilities, named, never a set card's name", () => {
    const setNames = new Set([...CARD_REGISTRY.values()].map((c) => c.name));
    const approved = new Set(APPROVED_SIGNATURE_LINES.map((l) => l.id));
    for (let seed = 1; seed <= 50; seed++) {
      const cs = generateSignatureCandidates(seed, "Test Agent", { cardNames: setNames });
      expect(cs).toHaveLength(3);
      expect(new Set(cs.map((c) => c.spec.ability)).size).toBe(3);
      expect(new Set(cs.map((c) => c.name)).size).toBe(3);
      for (const c of cs) {
        expect(approved.has(c.comboId)).toBe(true);
        expect(setNames.has(c.name)).toBe(false);
        expect(c.concept.startsWith(`${c.name}: cost 5, ${c.spec.attack}/${c.spec.health}.`)).toBe(true);
        expect(c.flavor).toContain("Test Agent");
      }
    }
  });

  it("falls back to more lines of fewer abilities when the list has fewer than 3", () => {
    const abilities = [...new Set(APPROVED_SIGNATURE_LINES.map((l) => l.spec.ability))];
    const keep = new Set(abilities.slice(0, 2));
    const approved = APPROVED_SIGNATURE_LINES.filter((l) => keep.has(l.spec.ability));
    if (approved.length < 3) return; // not enough lines of two abilities to test the fallback
    const cs = generateSignatureCandidates(3, "X", { cardNames: new Set() }, { approved });
    expect(cs).toHaveLength(3);
    expect(new Set(cs.map((c) => c.comboId)).size).toBe(3);
    expect(new Set(cs.map((c) => c.spec.ability)).size).toBe(2);
  });

  it("refuses a list of fewer than 3 lines", () => {
    expect(() => generateSignatureCandidates(1, "X", { cardNames: new Set() }, { approved: APPROVED_SIGNATURE_LINES.slice(0, 2) })).toThrow(/only 2 approved/);
  });

  it("builds the agent's own card under its own id", () => {
    const [c] = generateSignatureCandidates(9, "Y", none);
    const card = signatureCardFor(c!, "sig-PR-009");
    expect(card).toMatchObject({ id: "sig-PR-009", name: c!.name, faction: "Neutral", rarity: "Mythic", cost: 5, attack: c!.spec.attack, health: c!.spec.health });
    expect(card.art).toBe("placeholder:signature/sig-PR-009");
    expect(describeSpec({ ability: "guardian", tier: 5, attack: 3, health: 4 })).toBe("cost 5, 3/4. Barrier.");
    expect(describeSpec({ ability: "hunter", tier: 5, attack: 3, health: 6 })).toBe("cost 5, 3/6. Rush. Whenever it destroys a unit, it gets +1/+1.");
  });
});
