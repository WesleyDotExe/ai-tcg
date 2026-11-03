// The live board's frames against the real thing (render session 51).
//
// Each match is played once through captureMatch (full engine frames, what
// every replay draws) with the moves recorded, then replayed through the
// engine's replayMatch with the server's own timeline recorder (exactly what
// the ladder keeps and Watch live releases), and the timeline turned into
// frames by LiveFrameBuilder. Every frame is compared with the captured one
// field by field. What the public feed can't carry (hands, the signature
// zone, the faction before a card shows) is compared as what it should be
// instead: the right number of card backs, no zone, Neutral then the deck's.
import { describe, expect, it } from "vitest";
import {
  AggressiveAgent,
  BOARD_SLOTS,
  LookaheadAgent,
  MAX_ENERGY_CAP,
  RandomAgent,
  buildAegisDeck,
  buildCortexDeck,
  buildNullDeck,
  buildSwarmDeck,
  replayMatch,
  type Agent,
  type DeckSpec,
  type Move,
} from "@ai-tcg/engine";
import { timelineRecorder } from "../../server/src/ladder/timeline.js";
import { abilityTextFor, captureMatch } from "../src/capture.js";
import { generatedSeats } from "../src/generatedSignatures.js";
import { LiveFrameBuilder, seedOf } from "../src/site/liveFrames.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import { mythicSpecs } from "../src/wardFx.js";
import type { Frame, MatchReplay, UnitSnapshot } from "../src/types.js";

const KNOWN_TEXT = abilityTextFor([]);
const BUILDERS = { Cortex: buildCortexDeck, Swarm: buildSwarmDeck, Aegis: buildAegisDeck, Null: buildNullDeck } as const;
type F = keyof typeof BUILDERS;

function recording(agent: Agent, moves: Move[]): Agent {
  return { name: agent.name, decideMove: async (view, legal) => { const m = await agent.decideMove(view, legal); moves.push(structuredClone(m)); return m; } };
}

async function both(seed: number, a: F, b: F, kind: "random" | "aggressive" | "lookahead", signatures = false, opening = false) {
  const seats = generatedSeats(seed);
  const deckA: DeckSpec = { ...BUILDERS[a]("p1", a), ...(signatures ? { signature: seats[0].card } : {}) };
  const deckB: DeckSpec = { ...BUILDERS[b]("p2", b), ...(signatures ? { signature: seats[1].card } : {}) };
  const make = (name: string, s: number): Agent => (kind === "random" ? new RandomAgent(name, s) : kind === "aggressive" ? new AggressiveAgent(name, s) : new LookaheadAgent(name, s));
  const moves: Move[] = [];
  const captured = await captureMatch({ title: "t", seed, deckA, deckB, agentA: recording(make("Alpha", seed + 1), moves), agentB: recording(make("Beta", seed + 2), moves), boardSlots: BOARD_SLOTS });
  const rec = timelineRecorder();
  replayMatch(deckA, deckB, { p1: "Alpha", p2: "Beta" }, seed, moves, rec.hooks);
  const openingHands = { p1: captured.frames[0]!.players.p1.hand.map((c) => c.cardId), p2: captured.frames[0]!.players.p2.hand.map((c) => c.cardId) };
  const builder = new LiveFrameBuilder({ matchId: `m-${seed}`, names: { p1: "Alpha", p2: "Beta" }, start: rec.timeline.start, startLines: rec.timeline.startLines, boardSlots: BOARD_SLOTS, turnCap: captured.turnCap, energyCap: MAX_ENERGY_CAP, ...(opening ? { openingHands } : {}) });
  // Released in uneven batches, as the page reads them.
  const steps = rec.timeline.steps;
  for (let k = 0; k < steps.length; k++) builder.push(steps[k]!);
  return { captured, builder, live: builder.replay(), moves };
}

/** A unit as the live feed can know it. */
function comparableUnit(u: UnitSnapshot) {
  const { flavor: _f, ...rest } = u;
  return rest;
}

/** Hand positions shown face up / as backs, over every frame compared. */
export const HAND_TALLY = { faceUp: 0, backs: 0, unsure: 0 };

function compare(captured: MatchReplay, live: MatchReplay, signatures: boolean, wholeHands = false): string[] {
  const out: string[] = [];
  const opening = { p1: captured.frames[0]!.players.p1.hand.length, p2: captured.frames[0]!.players.p2.hand.length };
  expect(live.frames.length).toBe(captured.frames.length);
  captured.frames.forEach((c: Frame, i) => {
    const l = live.frames[i]!;
    const at = (what: string) => `frame ${i} (turn ${c.turnNumber}): ${what}`;
    if (l.turnNumber !== c.turnNumber || l.activePlayer !== c.activePlayer || l.priority !== c.priority || (l.winner ?? null) !== (c.winner ?? null)) out.push(at("turn/priority/winner"));
    if (JSON.stringify(l.stack) !== JSON.stringify(c.stack)) out.push(at(`stack ${JSON.stringify(l.stack)} vs ${JSON.stringify(c.stack)}`));
    if (JSON.stringify(l.newEvents) !== JSON.stringify(c.newEvents)) out.push(at("events"));
    // A signature card's ability text isn't in the public feed: its trigger line keeps the label alone.
    const sigTrigger = signatures && c.newEvents.some((e) => e.event.type === "abilityTrigger" && !(e.event.ability in KNOWN_TEXT));
    if (JSON.stringify(l.feed) !== JSON.stringify(c.feed) && !sigTrigger) out.push(at("feed"));
    if (JSON.stringify(l.quietTriggers) !== JSON.stringify(c.quietTriggers)) out.push(at("quiet triggers"));
    for (const pid of ["p1", "p2"] as const) {
      const cp = c.players[pid], lp = l.players[pid];
      for (const k of ["name", "health", "maxHealth", "energy", "maxEnergy", "deckSize", "graveyardSize", "slotsUsed", "slotsMax"] as const) {
        if (cp[k] !== lp[k]) out.push(at(`${pid}.${k} ${String(lp[k])} vs ${String(cp[k])}`));
      }
      if (JSON.stringify(cp.slots) !== JSON.stringify(lp.slots)) out.push(at(`${pid}.slots`));
      // Hands (render session 53): every position the feed has named is the
      // engine's card at that position, at the engine's cost; the rest are
      // backs, and only ever cards of the opening hand (so no more of them
      // than it held). A cost marked unsure is the one thing allowed to
      // differ (a signature card's aura). With the opening hands given,
      // every position is named.
      if (lp.hand.length !== cp.hand.length) out.push(at(`${pid}.hand length ${lp.hand.length} vs ${cp.hand.length}`));
      else {
        const backs = lp.hand.filter((h) => h.hidden).length;
        if (backs > opening[pid] || (wholeHands && backs > 0)) out.push(at(`${pid}.hand has ${backs} backs`));
        lp.hand.forEach((h, k) => {
          if (h.hidden) {
            HAND_TALLY.backs++;
            return;
          }
          HAND_TALLY.faceUp++;
          const { costUnsure, ...rest } = h;
          if (costUnsure) HAND_TALLY.unsure++;
          const want = cp.hand[k]!;
          const got = costUnsure ? { ...rest, cost: want.cost } : rest;
          if (JSON.stringify(got) !== JSON.stringify(want)) out.push(at(`${pid}.hand[${k}] ${JSON.stringify(h)} vs ${JSON.stringify(want)}`));
        });
      }
      if (lp.signature !== null) out.push(at(`${pid}.signature drawn`));
      if (lp.faction !== "Neutral" && lp.faction !== cp.faction) out.push(at(`${pid}.faction ${lp.faction} vs ${cp.faction}`));
      if (JSON.stringify(lp.directives.map((d) => ({ ...d, flavor: "" }))) !== JSON.stringify(cp.directives.map((d) => ({ ...d, flavor: "" })))) out.push(at(`${pid}.directives`));
      if (lp.board.length !== cp.board.length) {
        out.push(at(`${pid}.board length`));
        continue;
      }
      cp.board.forEach((cu, k) => {
        const lu = lp.board[k]!;
        if (signatures && cu.isSignature) {
          // The signature card isn't in the registry: its live numbers and identity only.
          // Barrier from the card's own keyword isn't known (the card isn't public): see the next test.
          for (const key of ["instanceId", "cardId", "name", "attack", "health", "maxHealth", "pending", "isSignature", "canAttackThisTurn", "armTurn", "tools", "faction", "rarity"] as const) {
            if (JSON.stringify(cu[key]) !== JSON.stringify(lu[key])) out.push(at(`${pid} signature ${cu.name}.${key} ${JSON.stringify(lu[key])} vs ${JSON.stringify(cu[key])}`));
          }
          return;
        }
        const a = comparableUnit(cu), b = comparableUnit(lu);
        for (const key of Object.keys(a) as (keyof typeof a)[]) {
          if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) out.push(at(`${pid} ${cu.name}.${key} ${JSON.stringify(b[key])} vs ${JSON.stringify(a[key])}`));
        }
      });
    }
  });
  return out;
}

const PAIRS: [number, F, F, "random" | "aggressive" | "lookahead"][] = [
  [11, "Cortex", "Swarm", "random"],
  [12, "Aegis", "Null", "random"],
  [13, "Swarm", "Aegis", "aggressive"],
  [14, "Null", "Cortex", "aggressive"],
  [15, "Aegis", "Cortex", "lookahead"],
  [16, "Swarm", "Null", "lookahead"],
  [17, "Null", "Aegis", "aggressive"],
  [18, "Cortex", "Cortex", "random"],
];

const SEEN = new Set<string>();

describe("LiveFrameBuilder (the live feed as arena frames)", () => {
  for (const [seed, a, b, kind] of PAIRS) {
    it(`${a} vs ${b}, ${kind} agents, seed ${seed}: every frame equals the captured one`, async () => {
      const { captured, live, builder } = await both(seed, a, b, kind);
      expect(compare(captured, live, false)).toEqual([]);
      // Every status and buff duration was settled by its source card.
      expect(builder.unknown).toEqual([]);
      for (const f of captured.frames) for (const e of f.newEvents) SEEN.add(e.event.type === "buff" ? `buff:${f.players.p1.board.concat(f.players.p2.board).some((u) => u.turnBuff.attack !== 0 || u.turnBuff.health !== 0) ? "turn" : "other"}` : e.event.type);
      expect(live.frames[live.frames.length - 1]!.winner).toBe(captured.frames[captured.frames.length - 1]!.winner);
    }, 60_000);
  }

  it("those matches exercise every tracked kind (stack, redirects, Barrier, statuses, turn buffs, telegraphs, tools, evolutions, tokens)", () => {
    for (const kind of ["cast", "attack", "stackResolve", "attackRedirected", "barrierAbsorbed", "statusApplied", "buff:turn", "telegraphPlaced", "toolAttached", "evolve", "summon"]) {
      expect(SEEN, kind).toContain(kind);
    }
  });

  for (const seed of [21, 22, 23]) {
    it(`with signature cards (seed ${seed}): equal but for the signature card's printed text`, async () => {
      const { captured, live } = await both(seed, (["Cortex", "Aegis", "Null"] as F[])[seed % 3]!, (["Swarm", "Null", "Cortex"] as F[])[seed % 3]!, "aggressive", true);
      expect(compare(captured, live, true)).toEqual([]);
    }, 60_000);
  }

  for (const [seed, a, b, kind] of PAIRS.slice(0, 4)) {
    it(`hands: with the opening hands given (seed ${seed}), every hand is the engine's, card for card, from move 0`, async () => {
      const { captured, live, builder } = await both(seed, a, b, kind, false, true);
      expect(compare(captured, live, false, true)).toEqual([]);
      expect(builder.handLost).toEqual({ p1: false, p2: false });
    }, 60_000);
  }

  it("hands: a card the feed named stays face up until played; the opening backs are only ever played away", async () => {
    const { live, builder } = await both(13, "Swarm", "Aegis", "aggressive");
    expect(builder.handLost).toEqual({ p1: false, p2: false });
    for (const pid of ["p1", "p2"] as const) {
      const backs = live.frames.map((f) => f.players[pid].hand.filter((h) => h.hidden).length);
      // Backs never come back: each frame has no more than the one before.
      for (let k = 1; k < backs.length; k++) expect(backs[k]!).toBeLessThanOrEqual(backs[k - 1]!);
      expect(backs[0]).toBe(live.frames[0]!.players[pid].hand.length);
    }
  }, 60_000);

  it("hands: a feed whose count disagrees turns that hand to backs for good, never a wrong card", async () => {
    const rec = timelineRecorder();
    const moves: Move[] = [];
    await captureMatch({ title: "t", seed: 7, deckA: buildCortexDeck("p1", "Cortex"), deckB: buildSwarmDeck("p2", "Swarm"), agentA: recording(new AggressiveAgent("A", 1), moves), agentB: recording(new AggressiveAgent("B", 2), moves), boardSlots: BOARD_SLOTS });
    replayMatch(buildCortexDeck("p1", "Cortex"), buildSwarmDeck("p2", "Swarm"), { p1: "A", p2: "B" }, 7, moves, rec.hooks);
    const b = new LiveFrameBuilder({ matchId: "x", names: { p1: "A", p2: "B" }, start: rec.timeline.start, startLines: rec.timeline.startLines, boardSlots: BOARD_SLOTS, turnCap: 30, energyCap: MAX_ENERGY_CAP });
    const steps = structuredClone(rec.timeline.steps);
    // A draw the feed lost: p2's first draw event dropped.
    const k = steps.findIndex((s) => s.events.some((e) => e.type === "draw" && e.player === "p2"));
    steps[k]!.events = steps[k]!.events.filter((e) => !(e.type === "draw" && e.player === "p2"));
    for (const s of steps) b.push(s);
    expect(b.handLost).toEqual({ p1: false, p2: true });
    const frames = b.allFrames();
    for (const f of frames.slice(k + 1)) expect(f.players.p2.hand.every((h) => h.hidden)).toBe(true);
    expect(frames.at(-1)!.players.p1.hand.some((h) => !h.hidden) || frames.at(-1)!.players.p1.hand.length === 0).toBe(true);
  }, 60_000);

  it("the faction is the deck's once a card shows, Neutral before, never another", async () => {
    const { captured, live } = await both(31, "Swarm", "Aegis", "aggressive");
    const last = live.frames[live.frames.length - 1]!;
    expect(last.players.p1.faction).toBe(captured.frames.at(-1)!.players.p1.faction);
    expect(last.players.p2.faction).toBe(captured.frames.at(-1)!.players.p2.faction);
    expect(live.factions).toEqual(captured.factions);
  }, 60_000);

  it("the faction the feed sends (game session 72) holds from the first frame, before any card shows", async () => {
    const rec = timelineRecorder();
    const moves: Move[] = [];
    await captureMatch({ title: "t", seed: 7, deckA: buildCortexDeck("p1", "Cortex"), deckB: buildSwarmDeck("p2", "Swarm"), agentA: recording(new AggressiveAgent("A", 1), moves), agentB: recording(new AggressiveAgent("B", 2), moves), boardSlots: BOARD_SLOTS });
    replayMatch(buildCortexDeck("p1", "Cortex"), buildSwarmDeck("p2", "Swarm"), { p1: "A", p2: "B" }, 7, moves, rec.hooks);
    const start = { matchId: "x", names: { p1: "A", p2: "B" }, start: rec.timeline.start, startLines: rec.timeline.startLines, boardSlots: BOARD_SLOTS, turnCap: 30, energyCap: MAX_ENERGY_CAP };
    const given = new LiveFrameBuilder({ ...start, factions: { p1: "Cortex", p2: "Swarm" } });
    const guessed = new LiveFrameBuilder(start);
    for (const s of rec.timeline.steps) { given.push(s); guessed.push(s); }
    const gf = given.allFrames(), uf = guessed.allFrames();
    // Without it, a side is Neutral until it shows a faction card.
    expect(uf[0]!.players.p1.faction).toBe("Neutral");
    for (const f of gf) expect([f.players.p1.faction, f.players.p2.faction], `frame ${f.index}`).toEqual(["Cortex", "Swarm"]);
    // The two agree once both sides have shown a faction card.
    expect([uf.at(-1)!.players.p1.faction, uf.at(-1)!.players.p2.faction]).toEqual(["Cortex", "Swarm"]);
  }, 60_000);

  it("a frame never changes once given (slots and feed worked out from the first frame)", async () => {
    const { builder } = await both(41, "Cortex", "Null", "aggressive");
    const all = builder.allFrames();
    // Rebuild in halves: the first half's frames are the same as in the whole.
    const rec = timelineRecorder();
    const { captured: _c, moves } = await both(41, "Cortex", "Null", "aggressive");
    const seats = { p1: "Alpha", p2: "Beta" };
    replayMatch({ ...buildCortexDeck("p1", "Cortex") }, { ...buildNullDeck("p2", "Null") }, seats, 41, moves, rec.hooks);
    const half = new LiveFrameBuilder({ matchId: "m-41", names: seats, start: rec.timeline.start, startLines: rec.timeline.startLines, boardSlots: BOARD_SLOTS, turnCap: 30, energyCap: MAX_ENERGY_CAP });
    const cut = Math.floor(rec.timeline.steps.length / 2);
    for (const s of rec.timeline.steps.slice(0, cut)) half.push(s);
    expect(JSON.stringify(half.allFrames())).toBe(JSON.stringify(all.slice(0, cut + 1)));
    expect(half.framesFrom(cut - 2).length).toBe(3);
  }, 60_000);

  it("refuses a step out of order, never draws a board that skipped a move", async () => {
    const rec = timelineRecorder();
    const moves: Move[] = [];
    await captureMatch({ title: "t", seed: 5, deckA: buildCortexDeck("p1", "Cortex"), deckB: buildSwarmDeck("p2", "Swarm"), agentA: recording(new RandomAgent("A", 1), moves), agentB: recording(new RandomAgent("B", 2), moves), boardSlots: BOARD_SLOTS });
    replayMatch(buildCortexDeck("p1", "Cortex"), buildSwarmDeck("p2", "Swarm"), { p1: "A", p2: "B" }, 5, moves, rec.hooks);
    const b = new LiveFrameBuilder({ matchId: "x", names: { p1: "A", p2: "B" }, start: rec.timeline.start, startLines: rec.timeline.startLines, boardSlots: BOARD_SLOTS, turnCap: 30, energyCap: MAX_ENERGY_CAP });
    expect(() => b.push(rec.timeline.steps[1]!)).toThrow(/move 2, the board is at move 0/);
    b.push(rec.timeline.steps[0]!);
    expect(b.released).toBe(1);
  }, 60_000);

  it("seeds the arena from the match id (the same saying for every viewer), not the engine's seed", () => {
    expect(seedOf("abc")).toBe(seedOf("abc"));
    expect(seedOf("abc")).not.toBe(seedOf("abd"));
  });

  it("the live page: marked live, every ward sheet carried (any Mythic may still arrive); a replay page unchanged", async () => {
    const { live, captured } = await both(51, "Aegis", "Swarm", "aggressive");
    const page = renderMatchHtml(live, { live: true });
    expect(page).toContain('<script type="application/json" id="live-data">true</script>');
    expect(page).toContain("SPECTATOR LIVE");
    expect(page).toContain('id="btn-live"');
    const ward = JSON.parse(/<script type="application\/json" id="ward-data">([\s\S]*?)<\/script>/.exec(page)![1]!) as { atlases: Record<string, string> };
    const withSheet = Object.entries(mythicSpecs()).filter(([, s]) => s.ward).map(([n]) => n).sort();
    expect(Object.keys(ward.atlases).sort()).toEqual(withSheet);
    const sig = JSON.parse(/<script type="application\/json" id="sigward-data">([\s\S]*?)<\/script>/.exec(page)![1]!) as { atlases: Record<string, string> };
    expect(Object.keys(sig.atlases).sort()).toEqual(["Aegis", "Cortex", "Null", "Swarm"]);
    const replayPage = renderMatchHtml(captured);
    expect(replayPage).toContain('<script type="application/json" id="live-data">false</script>');
    expect(replayPage).toContain("SPECTATOR REPLAY");
    expect(replayPage).not.toContain('id="btn-live"');
  }, 60_000);
});

