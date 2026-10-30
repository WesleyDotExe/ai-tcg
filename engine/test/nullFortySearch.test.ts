// The Null 36 -> 40 search (engine/src/dev/nullFortySearch.ts): its numbers
// only mean something if every list it measures is the 36 it started from
// plus exactly the named cards, legal under every deck rule, and if it never
// offers a card a starter can't hold. Set A shipped (session 60), so the 36 is
// now the shipped list without set A.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SET_A, addable, base36, legal, withAdds } from "../src/dev/nullFortySearch.js";
import { shippedPool } from "../src/dev/edgeMeasure.js";
import { getCard } from "../src/data/registry.js";
import { NULL_CARDS } from "../src/data/nullCards.js";

const size = (pool: { copies: number }[]) => pool.reduce((n, p) => n + p.copies, 0);
const engineDir = fileURLToPath(new URL("..", import.meta.url));

describe("the candidates", () => {
  it("offers only Null and neutral-pool cards, never a Zero-Day card", () => {
    const ids = addable();
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) {
      const c = getCard(id)!;
      expect(["Null", "Neutral"]).toContain(c.faction);
      expect(c.topTier).toBeUndefined();
    }
    expect(ids.map((id) => getCard(id)!.name)).not.toContain("Patient Zero");
  });

  it("adds exactly the named copies and leaves the shipped list alone", () => {
    const before = JSON.stringify(NULL_CARDS.map((p) => [p.card.id, p.copies]));
    const pool = withAdds(["NL-005", "NL-017", "NL-017"]);
    expect(size(pool)).toBe(size(base36()) + 3);
    expect(pool.find((p) => p.card.id === "NL-005")!.copies).toBe(base36().find((p) => p.card.id === "NL-005")!.copies + 1);
    expect(pool.find((p) => p.card.id === "NL-017")!.copies).toBe(base36().find((p) => p.card.id === "NL-017")!.copies + 2);
    expect(JSON.stringify(NULL_CARDS.map((p) => [p.card.id, p.copies]))).toBe(before);
  });

  it("holds every deck rule: copy limits, and removal only fits once the deck reaches 40", () => {
    expect(size(base36())).toBe(36);
    expect(base36().some((p) => p.card.faction === "Neutral")).toBe(false);
    expect(legal(withAdds(["NL-001"]))).toBe(false); // a 4th Glitch Seed
    // Null runs 9 removal/debuff copies: a 10th is 27% of 37 but 25% of 40.
    expect(legal(withAdds(["NL-004"]))).toBe(false);
    expect(legal(withAdds(["NL-005", "NL-016", "NL-017", "NL-004"]))).toBe(true);
    expect(legal(withAdds(["NL-005", "NL-016", "NL-017", "NL-004", "NL-006"]))).toBe(false); // 41 cards
  });
});

describe("set A", () => {
  it("is what ships: the 36 plus set A is exactly the shipped Null list", () => {
    const key = (pool: { card: { id: string }; copies: number }[]) =>
      pool.map((p) => `${p.card.id}x${p.copies}`).sort();
    expect(key(withAdds(SET_A))).toEqual(key(shippedPool("Null")));
    expect(size(shippedPool("Null"))).toBe(40);
  });
});

describe("the measure step", () => {
  it("plays Null's three ring edges in both modes for one list", () => {
    const out = execFileSync(process.execPath, ["--import", "tsx", "src/dev/nullFortySearch.ts", "measure", "NL-005,NL-016,NL-017,NL-004", "--first", "1", "--seeds", "2"], {
      cwd: engineDir,
      encoding: "utf8",
      timeout: 120_000,
    });
    const edges = JSON.parse(out) as { edge: string; mode: string; games: number; selfWins: number }[];
    expect(edges.map((e) => `${e.mode} ${e.edge}`)).toEqual([
      "gate Null > Aegis",
      "gate Swarm > Null",
      "gate Null ~ Cortex",
      "real Null > Aegis",
      "real Swarm > Null",
      "real Null ~ Cortex",
    ]);
    for (const e of edges) expect(e.games).toBe(2);
  });
});
