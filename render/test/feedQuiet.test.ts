// Render session 22: the feed drops a trigger that changed nothing
// (feed.ts triggerChangedNothing). The rule reads the event log only: no
// result event straight after the abilityTrigger. That is sound only if
// every effect that changes the game logs it, which is an engine property,
// not a render one. So this test checks it against the engine itself: it
// wraps the engine's own resolveAbility (read-only, in the test's module
// graph; no engine file changes), snapshots the whole game state around
// every trigger the engine's turn and stack code resolves in 32 real
// matches (every faction pairing, half with signature cards), and asserts that each trigger the feed would drop
// left the state exactly as it was.
import { describe, expect, it, vi } from "vitest";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { DeckSpec, GameEvent, GameState } from "@ai-tcg/engine";

interface Seen {
  ability: string;
  source: string;
  quiet: boolean;
  changed: boolean;
}
const seen = vi.hoisted(() => [] as Seen[]);
// The engine's own abilityTrigger event objects -> whether that resolution
// changed the state. The replay's frames carry the same objects, so the
// feed's verdict on a frame's events can be checked against it.
const changedBy = vi.hoisted(() => new WeakMap<object, boolean>());

vi.mock("../../engine/src/effects/resolver.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../engine/src/effects/resolver.js")>();
  const { triggerChangedNothing } = await import("../src/feed.js");
  // Everything but the log, and the once-per-turn use counter (bookkeeping
  // the engine keeps for Ability.limit, not anything a spectator sees).
  const snap = (s: GameState) => JSON.stringify(s, (k, v) => (k === "log" || k === "usedThisTurn" ? undefined : v));
  return {
    ...real,
    resolveAbility(params: Parameters<typeof real.resolveAbility>[0]) {
      const before = snap(params.state);
      const from = params.state.log.length;
      real.resolveAbility(params);
      const added: GameEvent[] = params.state.log.slice(from);
      const first = added[0];
      if (first?.type === "abilityTrigger") {
        changedBy.set(first, snap(params.state) !== before);
        seen.push({ ability: first.ability, source: first.source, quiet: triggerChangedNothing(added, 0), changed: snap(params.state) !== before });
      }
    },
  };
});

const { LookaheadAgent, buildNullDeck } = await import("../src/engineInternal.js");
const { captureMatch } = await import("../src/capture.js");
const { generatedSeats } = await import("../src/generatedSignatures.js");
const { triggerChangedNothing } = await import("../src/feed.js");

type F = "Cortex" | "Aegis" | "Swarm" | "Null";
const BUILDERS: Record<F, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck, Aegis: buildAegisDeck, Swarm: buildSwarmDeck, Null: buildNullDeck,
};

describe("a trigger the feed drops changed nothing (checked against the engine)", () => {
  it("holds over every trigger the engine resolves in real matches", async () => {
    // Every pairing of the four factions, mirrors included, over two
    // seeds; the second seed's matches carry generated signature cards.
    const fs: F[] = ["Cortex", "Aegis", "Swarm", "Null"];
    const cases: [F, F, number, boolean][] = fs.flatMap((a) => fs.flatMap((b) => [1, 2].map((k): [F, F, number, boolean] => [a, b, k * 7 + fs.indexOf(a) * 4 + fs.indexOf(b), k === 2])));
    let checked = 0;
    const wrongInFrames: string[] = [];
    for (const [a, b, seed, sig] of cases) {
      const seats = sig ? generatedSeats(seed) : undefined;
      const r = await captureMatch({
        title: `${a} vs ${b} seed ${seed}`, seed,
        deckA: { ...BUILDERS[a]("p1", a), ...(seats ? { signature: seats[0].card } : {}) },
        deckB: { ...BUILDERS[b]("p2", b), ...(seats ? { signature: seats[1].card } : {}) },
        agentA: new LookaheadAgent(seats ? seats[0].agentName : `A-${a}`, seed * 2 + 1),
        agentB: new LookaheadAgent(seats ? seats[1].agentName : `B-${b}`, seed * 2 + 2),
        boardSlots: BOARD_SLOTS,
      });
      // The feed reads a frame's whole event list, where other events
      // (the next turn's draw) sit next to the trigger's own.
      for (const f of r.frames) {
        const evs = f.newEvents.map((e) => e.event);
        evs.forEach((e, k) => {
          const changed = changedBy.get(e);
          if (changed === undefined) return;
          checked++;
          if (changed && triggerChangedNothing(evs, k)) wrongInFrames.push(`${r.title} move ${f.index}: ${e.type === "abilityTrigger" ? e.ability : ""}`);
        });
      }
    }
    expect(wrongInFrames).toEqual([]);
    expect(checked).toBeGreaterThan(150);
    const quiet = seen.filter((s) => s.quiet);
    const wrong = quiet.filter((s) => s.changed);
    expect(wrong.map((s) => `${s.source} ${s.ability}`)).toEqual([]);
    // Enough of both kinds that the check means something.
    expect(seen.length).toBeGreaterThan(150);
    expect(quiet.length).toBeGreaterThan(20);
    expect(new Set(quiet.map((s) => s.ability)).size).toBeGreaterThan(5);
    // And it isn't "drop everything": most triggers it keeps changed the
    // game. The rest have lines that say why they didn't (an intercept that
    // fizzled, no free slot, armor ate the hit, damage healed straight back).
    const kept = seen.filter((s) => !s.quiet);
    expect(kept.filter((s) => s.changed).length).toBeGreaterThan(kept.length * 0.9);
  }, 120_000);
});
