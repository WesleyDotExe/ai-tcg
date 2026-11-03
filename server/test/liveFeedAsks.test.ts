// The live-feed asks (session 72; the owner's answers to render sessions 51
// and 53): the opening hands on the live view's start, the signature card in
// full in `PublicSide.signature`, each side's deck faction, and the boast on
// the live view once the last move is out. Each is checked against something
// the feed didn't produce itself: the deck the store dealt, the engine's own
// play events, the starter faction each owner was granted, and the record
// the store writes after the match.

import { describe, expect, it } from "vitest";
import { type DeckFaction, type GameEvent } from "@ai-tcg/engine";
import { EconomyStore, STARTER_BOASTS, type LiveMatch } from "@ai-tcg/economy";
import { LiveLadder } from "../src/ladder/liveLadder.js";
import type { LadderMatch } from "../src/ladder/ladderRunner.js";
import type { PublicSnapshot } from "../src/ladder/timeline.js";

const FACTIONS: DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];

function setup(seed = 72) {
  const clock = { t: Date.parse("2026-11-03T22:00:00.000Z") };
  const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
  const factionOf = new Map<string, DeckFaction>();
  for (const [i, f] of FACTIONS.entries()) {
    const o = store.createOwner({ name: `house-${i}`, kind: "house" });
    store.grantStarterCollection(o.ownerId, f);
    // A generated agent (the draft), so each side brings its own signature card.
    const draft = store.startAgentDraft(o.ownerId, { seed: 10 + i });
    store.pickDraftAgent(o.ownerId, draft.draftId, 0, { seed: 20 + i });
    const { agent } = store.confirmAgentDraft(o.ownerId, draft.draftId, 0, { artSlot: 1 });
    store.connectAgent(o.ownerId, agent.agentId);
    factionOf.set(o.ownerId, f);
  }
  let n = 0;
  const recorded: LadderMatch[] = [];
  const live = new LiveLadder({
    store,
    seed,
    build: { games: 0 },
    matchId: () => `ask-${++n}`,
    now: () => clock.t,
    roundGapMs: 30_000,
    housePacks: false,
    onRecorded: (m) => recorded.push(m),
  });
  return { clock, store, live, factionOf, recorded };
}

/** Plays `rounds` ladder rounds at watch speed in 1 s steps, calling `look`
 * after every tick on every match being shown. */
async function run(rounds: number, look: (live: LiveLadder, matchId: string) => void, seed?: number) {
  const ctx = setup(seed);
  await runOn(ctx, rounds, look);
  return ctx;
}

describe("the live-feed asks (session 72)", () => {
  it("the opening hands come with the start, by card id in hand order, and only with from=0", async () => {
    const { live, clock } = setup();
    await live.tick();
    const ids = live.liveMatches().map((m) => m.matchId);
    expect(ids).toHaveLength(2);
    for (const id of ids) {
      const f0 = live.liveMatch(id, 0)!;
      const hands = f0.openingHands!;
      expect(hands).not.toBeNull();
      for (const seat of ["p1", "p2"] as const) {
        // As many cards as the start shows that side holding.
        expect(hands[seat]).toHaveLength(f0.start![seat].hand);
        // Every one is a card of the deck the store dealt that side.
        const deck = store0(live, id)[seat].map((c) => c.id);
        const left = [...deck];
        for (const c of hands[seat]) {
          const i = left.indexOf(c);
          expect(i, `${c} in ${seat}'s deck`).toBeGreaterThanOrEqual(0);
          left.splice(i, 1);
        }
      }
    }
    // Later fetches don't repeat them (as for `start`).
    clock.t += 60_000;
    await live.tick();
    for (const id of ids) {
      const f = live.liveMatch(id, 1)!;
      expect(f.from).toBe(1);
      expect(f.openingHands).toBeNull();
      expect(f.start).toBeNull();
    }
    await live.stop();
  });

  it("the opening hands, then the draws the feed names, account for every card each side plays and its hand count at every step", async () => {
    let fromHand = 0;
    let stepsChecked = 0;
    const { recorded } = await run(2, (live, id) => {
      const f = live.liveMatch(id, 0)!;
      if (f.nextAt !== null) return; // once per match, when the last move is out
      const decks = store0(live, id);
      for (const seat of ["p1", "p2"] as const) {
        const nameOf = new Map(decks[seat].map((c) => [c.id, c.name] as const));
        // The hand as a spectator would rebuild it: the opening hand, plus each
        // named draw, minus each card that leaves it (a play, a Command cast,
        // an evolution, a Tool).
        const hand = f.openingHands![seat].map((c) => nameOf.get(c)!);
        expect(hand).toHaveLength(f.start![seat].hand);
        const take = (card: string) => {
          const i = hand.indexOf(card);
          expect(i, `${seat}'s ${card} was in the rebuilt hand`).toBeGreaterThanOrEqual(0);
          hand.splice(i, 1);
          fromHand++;
        };
        for (const step of f.steps) {
          for (const e of step.events) {
            if (!("player" in e) || e.player !== seat) continue;
            if (e.type === "draw") hand.push(e.card);
            else if (e.type === "play" && !e.fromSignatureZone) take(e.card);
            else if (e.type === "cast" && e.sourceId === undefined) take(e.card);
            else if (e.type === "evolve") take(e.to);
            else if (e.type === "toolAttached") take(e.tool);
          }
          expect(hand.length, `${seat}'s hand after move ${step.n}`).toBe(step.after[seat].hand);
          stepsChecked++;
        }
      }
    });
    expect(recorded).toHaveLength(4);
    expect(fromHand).toBeGreaterThan(20);
    expect(stepsChecked).toBeGreaterThan(100);
  });

  it("the signature card is sent in full, and its nextCost is what the engine charges when it is played", async () => {
    let plays = 0;
    let replays = 0;
    let backInZone = 0;
    await run(2, (live, id) => {
      const f = live.liveMatch(id, 0)!;
      if (f.nextAt !== null) return;
      const decks = store0(live, id);
      const snaps: PublicSnapshot[] = [f.start!, ...f.steps.map((s) => s.after)];
      for (const seat of ["p1", "p2"] as const) {
        const card = decks.signature[seat]!;
        const sig0 = f.start![seat].signature!;
        expect(sig0).toEqual({
          cardId: card.id,
          name: card.name,
          cost: card.cost,
          attack: card.attack,
          health: card.health,
          keywords: card.keywords,
          rulesText: card.abilities.map((a) => a.text),
          art: card.art,
          flavor: card.flavor,
          timesPlayed: 0,
          inZone: true,
          nextCost: sig0.nextCost,
          played: false,
        });
        for (const [i, step] of f.steps.entries()) {
          const before = snaps[i]![seat].signature!;
          const after = step.after[seat].signature!;
          const play = step.events.find((e: GameEvent) => e.type === "play" && e.player === seat && e.fromSignatureZone);
          if (play && play.type === "play") {
            // The engine's charge is the cost the feed showed before the move.
            expect(play.cost).toBe(before.nextCost);
            expect(after.timesPlayed).toBe(before.timesPlayed + 1);
            expect(after.inZone).toBe(false);
            expect(after.played).toBe(true);
            plays++;
            if (before.timesPlayed > 0) replays++;
          } else {
            expect(after.timesPlayed).toBe(before.timesPlayed);
          }
          const back = step.events.find((e: GameEvent) => e.type === "signatureReturn" && e.player === seat);
          if (back && back.type === "signatureReturn") {
            // The engine's own figure for the next play, as the feed sends it.
            expect(after.inZone).toBe(true);
            expect(after.nextCost).toBe(back.nextCost);
          }
          if (!before.inZone && after.inZone) backInZone++;
          // In the zone, it is never on the board; on the board, it is there.
          const onBoard = step.after[seat].board.some((u) => u.cardId === card.id);
          expect(onBoard).toBe(!after.inZone);
        }
      }
    });
    // Every path is covered on these seeds: first plays, deaths back to the
    // zone, and replays at the surcharge.
    expect(plays).toBeGreaterThan(0);
    expect(backInZone).toBeGreaterThan(0);
    expect(replays).toBeGreaterThan(0);
  });

  it("each side's faction is its deck's: the starter faction its owner was granted", async () => {
    const { live, factionOf } = setup();
    await live.tick();
    const views = live.liveMatches();
    expect(views).toHaveLength(2);
    const seen = new Set<string>();
    for (const v of views) {
      for (const side of [v.p1, v.p2]) {
        expect(side.faction).toBe(factionOf.get(side.ownerId));
        seen.add(side.faction);
      }
      // The same on the feed.
      expect(live.liveMatch(v.matchId)!.p1.faction).toBe(v.p1.faction);
    }
    expect(seen.size).toBe(4);
    await live.stop();
  });

  it("the boast is null until the last move is out, then is exactly the one the record keeps", async () => {
    const lastSeen = new Map<string, unknown>();
    const { recorded } = await run(3, (live, id) => {
      const v = live.liveMatches().find((m) => m.matchId === id)!;
      const f = live.liveMatch(id, v.released)!;
      if (v.nextAt !== null) {
        expect(v.boast).toBeNull();
        expect(f.boast).toBeNull();
      } else {
        expect(f.boast).toEqual(v.boast);
        lastSeen.set(id, v.boast);
      }
    });
    expect(recorded.length).toBe(6);
    let wins = 0;
    for (const m of recorded) {
      expect(lastSeen.has(m.record.matchId)).toBe(true);
      expect(lastSeen.get(m.record.matchId)).toEqual(m.record.boast);
      if (m.record.outcome === "win") {
        wins++;
        expect(m.record.boast).not.toBeNull();
      } else expect(lastSeen.get(m.record.matchId)).toBeNull();
    }
    expect(wins).toBeGreaterThan(0);
  });

  it("the close-win boast shows live when the winner ends on 5 health or less", async () => {
    // A close-win boast on every agent (another faction's starter boast, so
    // it can't be mistaken for the main one); the main slot is left as granted.
    const ctx = setup(7);
    const { store } = ctx;
    for (const o of store.listOwners()) {
      const agent = store.connectedAgent(o.ownerId)!;
      const main = store.loadout(agent.agentId).boast!;
      const other = Object.values(STARTER_BOASTS).find((b) => b.itemId !== main)!;
      store.setLoadout(o.ownerId, agent.agentId, "closeWinBoast", other.itemId);
    }
    const seen: { slot: string; health: number | null }[] = [];
    await runOn(ctx, 4, (live, id) => {
      const v = live.liveMatches().find((m) => m.matchId === id)!;
      if (v.nextAt === null && v.boast) seen.push({ slot: v.boast.slot, health: v.boast.winnerHealth });
    });
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) expect(s.slot).toBe(s.health !== null && s.health <= 5 ? "closeWinBoast" : "boast");
    // Both kinds turn up on this seed.
    expect(new Set(seen.map((s) => s.slot))).toEqual(new Set(["boast", "closeWinBoast"]));
  });
});

/** The decks the store dealt a match being shown (`store.startMatch`'s
 * answer, which the ladder keeps until the match is recorded). */
function store0(live: LiveLadder, id: string) {
  const shown = (live as unknown as { shown: Map<string, { played: { live: LiveMatch } }> }).shown;
  const m = shown.get(id)!.played.live;
  return { p1: m.p1.deck.spec.cards, p2: m.p2.deck.spec.cards, signature: { p1: m.p1.deck.spec.signature, p2: m.p2.deck.spec.signature } };
}

async function runOn(ctx: ReturnType<typeof setup>, rounds: number, look: (live: LiveLadder, matchId: string) => void) {
  const { clock, live } = ctx;
  let started = 1;
  await live.tick();
  while (true) {
    for (const m of live.liveMatches()) look(live, m.matchId);
    if (live.liveMatches().length === 0) {
      if (started >= rounds) break;
      clock.t += 30_000;
      await live.tick();
      started++;
      continue;
    }
    clock.t += 1000;
    await live.tick();
  }
  await live.stop();
}
