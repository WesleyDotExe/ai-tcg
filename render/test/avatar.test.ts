// Player identity placeholder (owner-feedback 2026-09-26): a deterministic,
// username-seeded avatar that stays distinct between two players — the
// mirror-match case especially, where faction colour can't separate them.
import { describe, expect, it } from "vitest";
import { avatarSpec, avatarSvg, usernameHash } from "../src/avatar.js";

describe("avatar placeholder", () => {
  it("is deterministic per username", () => {
    expect(avatarSvg("Lookahead-Aegis")).toBe(avatarSvg("Lookahead-Aegis"));
    expect(usernameHash("x")).toBe(usernameHash("x"));
  });

  it("gives the two sides of a mirror match different avatars", () => {
    expect(avatarSvg("Lookahead-Aegis-A")).not.toBe(avatarSvg("Lookahead-Aegis-B"));
  });

  it("is distinct across many usernames (no systematic collisions)", () => {
    const seen = new Set<string>();
    for (let n = 0; n < 200; n++) seen.add(avatarSvg(`agent-${n}`));
    expect(seen.size).toBe(200);
  });

  it("is left-right symmetric and never empty", () => {
    for (let n = 0; n < 50; n++) {
      const { cells } = avatarSpec(`agent-${n}`);
      for (const row of cells) expect(row).toEqual([...row].reverse());
      expect(cells.some((row) => row.some(Boolean))).toBe(true);
    }
  });

  it("paints its body in currentColor (faction colour comes from the HUD) and is plain SVG, no glyphs", () => {
    const svg = avatarSvg("Lookahead-Null");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('fill="currentColor"');
    expect(svg).not.toMatch(/<text/);
  });
});
