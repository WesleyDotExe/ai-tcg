import { describe, expect, it } from "vitest";
import {
  armedScore,
  barrierBreakScore,
  buffScore,
  deathScore,
  enterScore,
  evolveScore,
  healScore,
  hitScore,
  maxTier,
  momentumSwingScore,
  playerHitScore,
  tierFromScore,
} from "../src/fxMagnitude.js";

describe("tierFromScore", () => {
  it("buckets low scores as subtle, mid as normal, high as spectacle", () => {
    expect(tierFromScore(0)).toBe("subtle");
    expect(tierFromScore(0.9)).toBe("subtle");
    expect(tierFromScore(1.5)).toBe("normal");
    expect(tierFromScore(2.4)).toBe("spectacle");
    expect(tierFromScore(5)).toBe("spectacle");
  });
});

describe("enterScore — owner's named examples", () => {
  it("a small (Common) unit entering is subtle", () => {
    expect(tierFromScore(enterScore("Common"))).toBe("subtle");
  });
  it("a Mythic entering is spectacle", () => {
    expect(tierFromScore(enterScore("Mythic"))).toBe("spectacle");
  });
  it("Uncommon/Rare sit in the normal middle", () => {
    expect(tierFromScore(enterScore("Uncommon"))).toBe("normal");
    expect(tierFromScore(enterScore("Rare"))).toBe("normal");
  });
});

describe("deathScore", () => {
  it("a common unit dying in ordinary combat is not spectacle", () => {
    expect(tierFromScore(deathScore("Common", false))).not.toBe("spectacle");
  });
  it("an unconditional destroy (no attack event) reads louder than the same unit dying in combat", () => {
    expect(deathScore("Rare", true)).toBeGreaterThan(deathScore("Rare", false));
  });
  it("a Mythic dying is always spectacle regardless of how it died", () => {
    expect(tierFromScore(deathScore("Mythic", false))).toBe("spectacle");
    expect(tierFromScore(deathScore("Mythic", true))).toBe("spectacle");
  });
});

describe("hitScore — owner's named examples", () => {
  it("a 1-damage ping is subtle", () => {
    expect(tierFromScore(hitScore(1, 0))).toBe("subtle");
  });
  it("a big single hit (6+) is spectacle", () => {
    expect(tierFromScore(hitScore(6, 0))).toBe("spectacle");
  });
  it("a board-wide effect (3+ simultaneous targets) is spectacle even at small per-target amounts", () => {
    expect(tierFromScore(hitScore(2, 3))).toBe("spectacle");
  });
  it("a single mid hit alone is not spectacle", () => {
    expect(tierFromScore(hitScore(3, 0))).not.toBe("spectacle");
  });
});

describe("playerHitScore", () => {
  it("the lethal blow always maxes out to spectacle", () => {
    expect(tierFromScore(playerHitScore(1, true))).toBe("spectacle");
  });
  it("scales like a unit hit when not lethal", () => {
    expect(tierFromScore(playerHitScore(1, false))).toBe("subtle");
  });
});

describe("evolveScore / armedScore", () => {
  it("an evolution is always spectacle", () => {
    expect(tierFromScore(evolveScore())).toBe("spectacle");
  });
  it("a Mythic arming is spectacle but a Common arming is not", () => {
    expect(tierFromScore(armedScore("Mythic"))).toBe("spectacle");
    expect(tierFromScore(armedScore("Common"))).not.toBe("spectacle");
  });
});

describe("barrierBreakScore — EFFECTS.md slice 1 (defence/shield)", () => {
  it("even a Common's shield breaking clears the subtle floor (a fully-absorbed hit still gets a beat)", () => {
    expect(tierFromScore(barrierBreakScore("Common"))).not.toBe("subtle");
  });
  it("a Mythic's shield breaking is spectacle", () => {
    expect(tierFromScore(barrierBreakScore("Mythic"))).toBe("spectacle");
  });
  it("scales monotonically with rarity, same shape as armedScore", () => {
    expect(barrierBreakScore("Uncommon")).toBeGreaterThan(barrierBreakScore("Common"));
    expect(barrierBreakScore("Rare")).toBeGreaterThan(barrierBreakScore("Uncommon"));
    expect(barrierBreakScore("Mythic")).toBeGreaterThan(barrierBreakScore("Rare"));
  });
});

describe("healScore / buffScore", () => {
  it("small heals and buffs are subtle", () => {
    expect(tierFromScore(healScore(1))).toBe("subtle");
    expect(tierFromScore(buffScore(1))).toBe("subtle");
  });
  it("large heals and buffs are not subtle", () => {
    expect(tierFromScore(healScore(6))).not.toBe("subtle");
    expect(tierFromScore(buffScore(4))).not.toBe("subtle");
  });
});

describe("momentumSwingScore", () => {
  it("a tiny swing scores zero (no pacing bump)", () => {
    expect(momentumSwingScore(10, 12)).toBe(0);
  });
  it("a big swing reaches spectacle on its own", () => {
    expect(tierFromScore(momentumSwingScore(-10, 30))).toBe("spectacle");
  });
});

describe("maxTier", () => {
  it("picks the loudest tier among several events in one move", () => {
    expect(maxTier(["subtle", "normal", "subtle"])).toBe("normal");
    expect(maxTier(["subtle", "spectacle", "normal"])).toBe("spectacle");
    expect(maxTier([])).toBe("subtle");
  });
});
