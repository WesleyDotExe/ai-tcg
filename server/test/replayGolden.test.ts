// Versioned replays (session 70; owner 2026-11-02 call 6): the golden
// replays (server/src/dev/replayGolden.ts) rebuild byte for byte, in both
// formats, and a file plays its own cards and rules, never today's.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCortexDeck,
  buildSwarmDeck,
  cardSetDigest,
  CARDS_1_BY_ID,
  CARDS_VERSIONS,
  CURRENT_CARDS_VERSION,
  CURRENT_RULES_VERSION,
  formatLog,
  LookaheadAgent,
  runMatch,
  type Card,
} from "@ai-tcg/engine";
import { makeReplayFile, rebuildReplay, replaySetup, type ReplayFile, type ReplayFileV2 } from "../src/ladder/replayFile.js";

const DIR = join(import.meta.dirname, "fixtures", "replays");
const golden = readdirSync(DIR)
  .filter((f) => f.endsWith(".replay.json"))
  .sort()
  .map((f) => ({ name: f.replace(".replay.json", ""), file: JSON.parse(readFileSync(join(DIR, f), "utf8")) as ReplayFile, log: readFileSync(join(DIR, f.replace(".replay.json", ".txt")), "utf8") }));

describe("the golden replays", () => {
  it("are both formats, two of each", () => {
    expect(golden.map((g) => `${g.name}:${g.file.format}`)).toEqual(["v1-1:ai-tcg-replay/1", "v1-2:ai-tcg-replay/1", "v2-1:ai-tcg-replay/2", "v2-2:ai-tcg-replay/2"]);
  });

  it.each(golden.map((g) => [g.name, g] as const))("%s rebuilds the log the ladder wrote, byte for byte, and ends as recorded", (_name, g) => {
    // A failure here means a change altered how a recorded match plays. Do not
    // regenerate these files: add a rules version (engine/src/engine/versions.ts)
    // that keeps the old behaviour for the old version, or a card version.
    const { state, movesPlayed, setup } = rebuildReplay(g.file);
    expect(`${formatLog(state.log)}\n`).toBe(g.log);
    expect(movesPlayed).toBe(g.file.moves.length);
    expect(setup.rulesVersion).toBe("rules-1");
    expect(setup.cardsVersion).toBe("cards-1");
  });

  it("an /1 file has no cards of its own: it reads the frozen cards-1, the cards it was played with", () => {
    const g = golden.find((x) => x.file.format === "ai-tcg-replay/1")!;
    expect("cards" in g.file).toBe(false);
    const setup = replaySetup(g.file);
    for (const c of [...setup.decks.p1.cards, ...setup.decks.p2.cards]) expect(c).toEqual(CARDS_1_BY_ID.get(c.id));
    expect(setup.rules).toBeUndefined();
  });

  it("an /2 file stamps the versions and carries every deck card in full", () => {
    for (const g of golden.filter((x) => x.file.format === "ai-tcg-replay/2")) {
      const f = g.file as ReplayFileV2;
      expect(f.versions.rules).toBe("rules-1");
      expect(f.versions.cards).toBe("cards-1");
      expect(f.versions.cardsDigest).toBe(cardSetDigest(f.cards));
      const ids = new Set([...f.decks.p1.cardIds, ...f.decks.p2.cardIds]);
      expect(f.cards.map((c) => c.id)).toEqual([...ids].sort());
    }
    // One golden agent is generated: its signature card is in its deck, not in `cards`.
    const v2 = golden.filter((x) => x.file.format === "ai-tcg-replay/2").map((x) => x.file as ReplayFileV2);
    const sig = v2.flatMap((f) => [f.decks.p1.signature, f.decks.p2.signature]).find((s) => s !== null)!;
    expect(sig).toBeTruthy();
    expect(v2.some((f) => f.cards.some((c) => c.id === sig.id))).toBe(false);
  });
});

/** An /2 file with every unit's attack changed, its digest kept honest. */
function withUnitsChanged(f: ReplayFileV2): ReplayFileV2 {
  const g = structuredClone(f);
  for (const c of g.cards) if (c.type === "Unit") (c as { attack: number }).attack += 2;
  g.versions.cardsDigest = cardSetDigest(g.cards);
  return g;
}

describe("a replay plays its own cards and rules", () => {
  const v2 = golden.find((x) => x.file.format === "ai-tcg-replay/2")!.file as ReplayFileV2;

  it("the file's cards, not the registry's: change one in the file and the match is a different match", () => {
    // The same moves under other card text: illegal somewhere, or a different end.
    expect(() => rebuildReplay(withUnitsChanged(v2))).toThrow();
  });

  it("refuses cards changed after the file was written (the digest), an unknown rules version, an unknown format", () => {
    const tampered = structuredClone(v2);
    (tampered.cards[0] as { cost: number }).cost += 1;
    expect(() => replaySetup(tampered)).toThrow(/hash to .* it says/);
    expect(() => replaySetup({ ...v2, versions: { ...v2.versions, rules: "rules-99" } })).toThrow(/rules version "rules-99" isn't one this engine knows/);
    expect(() => replaySetup({ ...v2, format: "ai-tcg-replay/9" } as never)).toThrow(/format "ai-tcg-replay\/9"/);
    expect(() => replaySetup({ ...v2, cards: undefined } as never)).toThrow(/without its versions or cards/);
  });

  it("refuses a file that doesn't end as it says (a truncated move list)", () => {
    expect(() => rebuildReplay({ ...v2, moves: v2.moves.slice(0, -2) })).toThrow(/doesn't rebuild as recorded/);
  });

  it("a measuring instrument's seat variant travels in the file and plays back", async () => {
    const decks = { p1: buildCortexDeck("p1", "Cortex"), p2: buildSwarmDeck("p2", "Swarm") };
    const rules = { secondSeatExtraHealth: 4 };
    const moves: unknown[] = [];
    const { state, movesPlayed } = await runMatch(decks.p1, decks.p2, new LookaheadAgent("A", 1), new LookaheadAgent("B", 2), 5, { onMove: (_s, m) => moves.push(m) }, rules);
    const file = makeReplayFile(
      {
        matchId: "m",
        seed: 5,
        names: { p1: state.players.p1.name, p2: state.players.p2.name },
        moves: moves as never,
        result: { outcome: "win", winner: state.winner!, turns: state.turnNumber, moves: movesPlayed, finalHealth: { p1: state.players.p1.health, p2: state.players.p2.health } },
      },
      decks,
      rules,
    );
    expect(file.versions.rules).toBe("measure");
    expect(file.rules).toEqual(rules);
    const back = rebuildReplay(JSON.parse(JSON.stringify(file)));
    expect(back.state.players.p2.maxHealth).toBe(24);
    expect(formatLog(back.state.log)).toBe(formatLog(state.log));
    // Without the variant the same moves are not the same match.
    expect(() => rebuildReplay({ ...file, versions: { ...file.versions, rules: CURRENT_RULES_VERSION }, rules: undefined })).toThrow();
  });

  it("a deck card that isn't the published version's is still written (its own definition), with no card version", () => {
    const decks = { p1: buildCortexDeck("p1", "Cortex"), p2: buildSwarmDeck("p2", "Swarm") };
    const odd = structuredClone(decks.p1.cards[0]!);
    (odd as { cost: number }).cost += 1;
    decks.p1.cards = decks.p1.cards.map((c) => (c.id === odd.id ? odd : c));
    const file = makeReplayFile({ matchId: "m", seed: 1, names: { p1: "a", p2: "b" }, moves: [], result: { outcome: "cancelled", winner: null, turns: 1, moves: 0, finalHealth: { p1: 20, p2: 20 } } }, decks);
    expect(file.versions.cards).toBeNull();
    expect(file.cards.find((c) => c.id === odd.id)).toEqual(odd);
    const plain = makeReplayFile({ matchId: "m", seed: 1, names: { p1: "a", p2: "b" }, moves: [], result: { outcome: "cancelled", winner: null, turns: 1, moves: 0, finalHealth: { p1: 20, p2: 20 } } }, { p1: buildCortexDeck("p1", "Cortex"), p2: decks.p2 });
    expect(plain.versions.cards).toBe(CURRENT_CARDS_VERSION);
    expect(CARDS_VERSIONS.map((v) => v.id)).toContain(plain.versions.cards);
  });
});
