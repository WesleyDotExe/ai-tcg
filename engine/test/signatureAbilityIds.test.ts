// Unique signature ability ids (owner 2026-10-18, the game-lane side task
// found by render session 21). Every distinct version of a signature ability
// has its own id; old ids still map to the right ability.

import { describe, expect, it } from "vitest";
import {
  SIGNATURE_MENU,
  allSignatureSpecs,
  buildSignatureCard,
  legacySignatureAbilityId,
  optionAtSize,
  signatureFingerprint,
  upgradeSignatureAbilityId,
} from "../src/data/signatureMenu.js";
import { APPROVED_SIGNATURE_LINES } from "../src/data/signatureApproved.js";
import { generateAgentCandidates, generateSignatureCandidates, signatureCardFor } from "../src/data/agentGenerator.js";
import type { Ability } from "../src/cards/types.js";

/** Everything an ability is but its id: rules text, trigger, condition,
 * targeting, effects, limits. */
const canonical = (a: Ability): string => {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])])) : v;
  const { id: _id, ...rest } = a;
  return JSON.stringify(sort(rest));
};

/** id -> every distinct ability it named; a clash is an id with two. */
function clashes(abilities: Iterable<Ability>): [string, string[]][] {
  const seen = new Map<string, Set<string>>();
  for (const a of abilities) seen.set(a.id, (seen.get(a.id) ?? new Set()).add(canonical(a)));
  return [...seen].filter(([, v]) => v.size > 1).map(([id, v]) => [id, [...v]]);
}

describe("signature ability ids (owner 2026-10-18)", () => {
  it("no id names two different abilities over every option at every size", () => {
    const all: Ability[] = [];
    for (const option of SIGNATURE_MENU) {
      for (const size of [undefined, ...option.sizes.map((s) => s.key)]) all.push(...optionAtSize(option, size).abilities);
    }
    expect(all.length).toBeGreaterThan(40);
    expect(clashes(all)).toEqual([]);
    // Every table combination too (the tier-7 second aura included).
    expect(clashes(allSignatureSpecs().flatMap((s) => buildSignatureCard(s).abilities))).toEqual([]);
  });

  it("no id names two different abilities over 3,000 generated agents' signature cards", () => {
    const abilities: Ability[] = [];
    const ids = new Set<string>();
    let cards = 0;
    const taken = { agentNames: new Set<string>(), cardNames: new Set<string>() };
    for (let seed = 1; seed <= 1000; seed++) {
      const agent = generateAgentCandidates(seed, taken)[0]!;
      taken.agentNames.add(agent.name);
      for (const c of generateSignatureCandidates(seed * 7919, agent.name, taken)) {
        taken.cardNames.add(c.name);
        const card = signatureCardFor(c, `sig-T-${seed}-${c.comboId}`);
        cards += 1;
        for (const a of card.abilities) ids.add(a.id);
        abilities.push(...card.abilities);
      }
    }
    expect(cards).toBe(3000);
    expect(abilities.length).toBeGreaterThan(2000); // Guardian prints no ability, only Barrier
    expect(clashes(abilities)).toEqual([]);
    // The case render found: Recycle at three sizes, three ids.
    expect([...ids].filter((id) => id.startsWith("sig-recycle")).sort()).toEqual(["sig-recycle", "sig-recycle.c1", "sig-recycle.c3"]);
  });

  it("the standard size keeps the option's id, a size adds its key, the second aura stays standard", () => {
    expect(buildSignatureCard({ ability: "recycle", tier: 5, attack: 3, health: 6 }).abilities.map((a) => a.id)).toEqual(["sig-recycle"]);
    expect(buildSignatureCard({ ability: "recycle", tier: 5, attack: 3, health: 6, size: "c3" }).abilities.map((a) => a.id)).toEqual(["sig-recycle.c3"]);
    expect(buildSignatureCard({ ability: "smite", tier: 7, attack: 3, health: 7, size: "d2", secondAura: "tax" }).abilities.map((a) => a.id)).toEqual(["sig-smite.d2", "sig-tax"]);
  });

  it("old ids map both ways, so older logs and recorded fingerprints still read right", () => {
    expect(legacySignatureAbilityId("sig-recycle.c3")).toBe("sig-recycle");
    expect(legacySignatureAbilityId("sig-recycle")).toBe("sig-recycle");
    expect(legacySignatureAbilityId("cx-overclock.x")).toBe("cx-overclock.x"); // not a signature id
    const spec = { ability: "smite", tier: 7 as const, attack: 3, health: 7, size: "d2", secondAura: "tax" };
    expect(upgradeSignatureAbilityId("sig-smite", spec)).toBe("sig-smite.d2");
    expect(upgradeSignatureAbilityId("sig-tax", spec)).toBe("sig-tax");
    expect(upgradeSignatureAbilityId("sig-smite", { ...spec, size: undefined })).toBe("sig-smite");
    // Every upgraded id is on the card built from the spec.
    for (const l of APPROVED_SIGNATURE_LINES) {
      const card = buildSignatureCard(l.spec, { anyStats: true });
      for (const a of card.abilities) expect(upgradeSignatureAbilityId(legacySignatureAbilityId(a.id), l.spec)).toBe(a.id);
    }
  });

  it("an id is a name, not behaviour: the fingerprint ignores it", () => {
    const card = buildSignatureCard({ ability: "recycle", tier: 5, attack: 3, health: 5, size: "c3" }, { anyStats: true });
    const renamed = { ...card, abilities: card.abilities.map((a) => ({ ...a, id: "sig-recycle" })) };
    expect(signatureFingerprint(renamed)).toBe(signatureFingerprint(card));
    // 39587d3d was recorded in session 35, before the ids changed.
    expect(signatureFingerprint(card)).toBe("39587d3d");
  });
});
