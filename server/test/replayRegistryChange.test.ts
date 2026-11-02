// Versioned replays (session 70): what a later set does to today's registry
// can't change an old match. Here every card the registry gives back has
// changed (attack +2), as if a whole set had been rebalanced: the golden
// replays of both formats still rebuild their logs byte for byte, because an
// /2 file plays its own cards and an /1 file the frozen cards-1.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { formatLog, getCard } from "@ai-tcg/engine";
import { rebuildReplay, type ReplayFile } from "../src/ladder/replayFile.js";

vi.mock("@ai-tcg/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@ai-tcg/engine")>();
  const changed = (id: string) => {
    const c = real.getCard(id);
    if (!c || c.type !== "Unit") return c;
    return { ...c, attack: c.attack + 2 };
  };
  return { ...real, getCard: changed, CARD_REGISTRY: new Map([...real.CARD_REGISTRY.keys()].map((id) => [id, changed(id)!])) };
});

const DIR = join(import.meta.dirname, "fixtures", "replays");

describe("a changed registry", () => {
  it("really is changed in this test", () => {
    const unit = getCard("CX-001");
    expect(unit?.type === "Unit" && unit.attack).toBe(3); // 1 as printed
  });

  it.each(readdirSync(DIR).filter((f) => f.endsWith(".replay.json")).sort())("%s still rebuilds the match it was", (f) => {
    const file = JSON.parse(readFileSync(join(DIR, f), "utf8")) as ReplayFile;
    const { state } = rebuildReplay(file);
    expect(`${formatLog(state.log)}\n`).toBe(readFileSync(join(DIR, f.replace(".replay.json", ".txt")), "utf8"));
  });
});
