// The Null 36 -> 40 search (engine/src/dev/nullFortySearch.ts): its numbers
// only mean something if every list it measures is the shipped 36 plus
// exactly the named cards, legal under every deck rule, and if it never
// offers a card a starter can't hold.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { addable, legal, withAdds } from "../src/dev/nullFortySearch.js";
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
    const pool = withAdds(["NL-005", "NT-004", "NT-004"]);
    expect(size(pool)).toBe(size(shippedPool("Null")) + 3);
    expect(pool.find((p) => p.card.id === "NL-005")!.copies).toBe(NULL_CARDS.find((p) => p.card.id === "NL-005")!.copies + 1);
    expect(pool.find((p) => p.card.id === "NT-004")!.copies).toBe(2);
    expect(JSON.stringify(NULL_CARDS.map((p) => [p.card.id, p.copies]))).toBe(before);
  });

  it("holds every deck rule: copy limits, and removal only fits once the deck reaches 40", () => {
    expect(size(shippedPool("Null"))).toBe(36);
    expect(legal(withAdds(["NL-001"]))).toBe(false); // a 4th Glitch Seed
    // Null runs 9 removal/debuff copies: a 10th is 27% of 37 but 25% of 40.
    expect(legal(withAdds(["NL-004"]))).toBe(false);
    expect(legal(withAdds(["NL-005", "NL-016", "NL-017", "NL-004"]))).toBe(true);
    expect(legal(withAdds(["NL-005", "NL-016", "NL-017", "NL-004", "NL-006"]))).toBe(false); // 41 cards
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
