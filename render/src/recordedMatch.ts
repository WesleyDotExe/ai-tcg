// Replays of matches played through the economy store (victory boasts,
// slice 3): the replay plays the boast the store's match record says
// played, never one the render picks.
//
// A recorded scenario runs the whole loop the platform will: two owners
// get their starter collections (which carry the four free starter
// boasts), make an agent each, save and activate their starter deck and
// connect the agent. An owner that wants a season boast earns its price
// first, in real matches between the same two agents (startMatch ->
// runMatch -> recordMatch, a fixed clock moving a day at a time), and buys
// it. Both equip their loadouts. Then the replayed match itself: started
// with startMatch, so each side plays the deck the store loaded, captured
// move by move (capture.ts), and recorded with each side's final health,
// which is what decides a close win. The record read back from the store's
// match history is attached to the replay (attachRecord), checked against
// the replay it claims to be.
//
// Reads the store's public API only (no economy file is changed). Seeds and
// the clock are fixed, so the same scenario always gives the same match,
// record and history.
import { BOARD_SLOTS, runMatch } from "@ai-tcg/engine";
import type { DeckSpec, PlayerId } from "@ai-tcg/engine";
import { EconomyStore, type LoadoutSlot, type MatchRecord } from "@ai-tcg/economy";
import { captureMatch } from "./capture.js";
import { LookaheadAgent } from "./engineInternal.js";
import type { DeckFaction } from "./engineInternal.js";
import type { MatchReplay, ReplayRecord } from "./types.js";

export interface RecordedSide {
  faction: DeckFaction;
  /** The agent's name, which is the replay's username for that side. */
  agent: string;
  /** Items to equip before the match, by slot (null empties the slot). The
   * owner must own each: the starter boasts come with the collection; a
   * season item listed in `buy` is earned and bought first. */
  loadout?: Partial<Record<LoadoutSlot, string | null>>;
  /** Season items this owner buys with credits earned in real matches. */
  buy?: string[];
}

export interface RecordedScenario {
  /** The output file's stem, e.g. "recorded-close-win". */
  id: string;
  /** The replayed match's seed. */
  seed: number;
  p1: RecordedSide;
  p2: RecordedSide;
}

export interface RecordedResult {
  replay: MatchReplay;
  /** The replayed match's record, as the store's match history returns it. */
  record: MatchRecord;
  /** The matches played to earn the season items, oldest first. */
  earning: MatchRecord[];
  /** Credits each owner held when the replayed match started. */
  credits: Record<PlayerId, number>;
}

const START = Date.parse("2026-10-19T09:00:00.000Z");
const DAY_MS = 86_400_000;
const MAX_EARNING_DAYS = 30;
const MATCHES_PER_DAY = 10;

/** The replay's own record, from the store's: each agent turned into its
 * seat. Refused when the record isn't this replay's match: another seed,
 * another winner, or a boast whose recorded health isn't the winner's
 * health in the replay's last frame. */
export function attachRecord(replay: MatchReplay, record: MatchRecord): MatchReplay {
  const last = replay.frames[replay.frames.length - 1]!;
  const seatOf = (agentId: string | null): PlayerId | null => (agentId === record.p1AgentId ? "p1" : agentId === record.p2AgentId ? "p2" : null);
  if (record.seed !== replay.seed) throw new Error(`record "${record.matchId}" is seed ${record.seed}, the replay is seed ${replay.seed}`);
  const recordWinner = record.outcome === "win" ? seatOf(record.winnerAgentId) : record.outcome === "draw" ? "draw" : null;
  // An unresolved replay (the move-safety limit) is recorded as a draw.
  const replayWinner = last.winner ?? "draw";
  if (recordWinner !== replayWinner) throw new Error(`record "${record.matchId}" says ${recordWinner ?? record.outcome}, the replay ends ${replayWinner}`);
  let boast: ReplayRecord["boast"] = null;
  if (record.boast) {
    const side = seatOf(record.boast.agentId);
    if (!side || side !== replayWinner) throw new Error(`record "${record.matchId}"'s boast is not the winner's`);
    if (record.boast.winnerHealth !== null && record.boast.winnerHealth !== last.players[side].health) {
      throw new Error(`record "${record.matchId}" has the winner on ${record.boast.winnerHealth} health, the replay on ${last.players[side].health}`);
    }
    boast = { side, itemId: record.boast.itemId, slot: record.boast.slot, winnerHealth: record.boast.winnerHealth };
  }
  return { ...replay, record: { matchId: record.matchId, loadouts: record.loadouts, boast } };
}

/** Plays a scenario through an in-memory store and returns the replay with
 * its record attached. */
export async function captureRecordedReplay(scn: RecordedScenario): Promise<RecordedResult> {
  let clock = new Date(START);
  const store = EconomyStore.open(":memory:", { now: () => clock });
  try {
    const seat = (side: RecordedSide, owner: string) => {
      const ownerId = store.createOwner({ name: owner }).ownerId;
      const { copies } = store.grantStarterCollection(ownerId, side.faction);
      const agentId = store.createAgent({ ownerId, name: side.agent }).agentId;
      const deck = store.saveDeck(ownerId, `${side.faction} starter`, copies.map((c) => c.copyId));
      store.setActiveDeck(ownerId, deck.deckId);
      store.connectAgent(ownerId, agentId);
      return { ownerId, agentId, side };
    };
    const seats = { p1: seat(scn.p1, `${scn.id}-owner-1`), p2: seat(scn.p2, `${scn.id}-owner-2`) };
    const decksOf = (live: ReturnType<EconomyStore["startMatch"]>): [DeckSpec, DeckSpec] => [
      { ...live.p1.deck.spec, id: "p1" },
      { ...live.p2.deck.spec, id: "p2" },
    ];

    // Earn the season items' prices in real matches, a day at a time.
    const earning: MatchRecord[] = [];
    const price = (itemId: string): number => {
      const item = store.cosmeticsCatalogue().find((i) => i.itemId === itemId);
      if (!item || item.priceCredits === null) throw new Error(`"${itemId}" is not sold`);
      return item.priceCredits;
    };
    const wants = (["p1", "p2"] as const).map((p) => ({ p, cost: (seats[p].side.buy ?? []).reduce((n, id) => n + price(id), 0) }));
    const short = () => wants.some((w) => store.balance(seats[w.p].ownerId) < w.cost);
    for (let day = 0; short(); day++) {
      if (day >= MAX_EARNING_DAYS) throw new Error(`${scn.id}: the season items were not earned in ${MAX_EARNING_DAYS} days`);
      for (let n = 0; n < MATCHES_PER_DAY && short(); n++) {
        clock = new Date(START + day * DAY_MS + n * 600_000);
        const matchId = `${scn.id}-earn-${String(earning.length + 1).padStart(3, "0")}`;
        const live = store.startMatch({ matchId, p1OwnerId: seats.p1.ownerId, p2OwnerId: seats.p2.ownerId });
        const seed = scn.seed * 1000 + earning.length + 1;
        const [a, b] = decksOf(live);
        const result = await runMatch(a, b, new LookaheadAgent(scn.p1.agent, seed * 2 + 1), new LookaheadAgent(scn.p2.agent, seed * 2 + 2), seed);
        earning.push(record(matchId, seed, live, result.state.winner ?? null, result.state.players.p1.health, result.state.players.p2.health, result.state.turnNumber, result.movesPlayed));
      }
    }
    for (const w of wants) for (const itemId of seats[w.p].side.buy ?? []) store.buyCosmetic(seats[w.p].ownerId, itemId);
    for (const p of ["p1", "p2"] as const) {
      for (const [slot, itemId] of Object.entries(seats[p].side.loadout ?? {})) store.setLoadout(seats[p].ownerId, seats[p].agentId, slot as LoadoutSlot, itemId ?? null);
    }
    const credits = { p1: store.balance(seats.p1.ownerId), p2: store.balance(seats.p2.ownerId) };

    // The replayed match.
    clock = new Date(START + (earning.length ? Math.ceil(earning.length / MATCHES_PER_DAY) : 0) * DAY_MS + 12 * 3_600_000);
    const live = store.startMatch({ matchId: scn.id, p1OwnerId: seats.p1.ownerId, p2OwnerId: seats.p2.ownerId });
    const [deckA, deckB] = decksOf(live);
    const replay = await captureMatch({
      title: `${scn.p1.faction} vs ${scn.p2.faction} (seed ${scn.seed}, recorded)`,
      seed: scn.seed,
      deckA,
      deckB,
      agentA: new LookaheadAgent(scn.p1.agent, scn.seed * 2 + 1),
      agentB: new LookaheadAgent(scn.p2.agent, scn.seed * 2 + 2),
      boardSlots: BOARD_SLOTS,
    });
    const last = replay.frames[replay.frames.length - 1]!;
    record(scn.id, scn.seed, live, last.winner ?? null, last.players.p1.health, last.players.p2.health, last.turnNumber, replay.movesPlayed);
    const recorded = store.matchHistory().find((m) => m.matchId === scn.id)!;
    return { replay: attachRecord(replay, recorded), record: recorded, earning, credits };

    function record(matchId: string, seed: number, live: ReturnType<EconomyStore["startMatch"]>, winner: PlayerId | "draw" | null, h1: number, h2: number, turns: number, moves: number): MatchRecord {
      return store.recordMatch({
        matchId,
        seed,
        p1AgentId: live.p1.agentId,
        p2AgentId: live.p2.agentId,
        p1DeckId: live.p1.deck.deckId,
        p2DeckId: live.p2.deck.deckId,
        outcome: winner === "p1" || winner === "p2" ? { kind: "win", winnerAgentId: live[winner].agentId } : { kind: "draw" },
        turns,
        moves,
        finalHealth: { p1: h1, p2: h2 },
        endedAt: clock.toISOString(),
      });
    }
  } finally {
    store.close();
  }
}
