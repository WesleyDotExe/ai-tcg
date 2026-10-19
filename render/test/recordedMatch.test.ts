// Victory boasts, render slice 3: the replay plays the boast the economy
// store's match record says played. Three layers:
//  1. boastFromRecord: the record's boast when it is the winner's and the
//     render can draw it (main, close-win or faction starter slot, close
//     only for the close-win slot); otherwise the winner's faction starter
//     as a fallback; nothing for a draw;
//  2. attachRecord: a record is attached only to the replay it is of (the
//     seed, the winner, and the winner's final health in the last frame);
//  3. the store end to end (recordedMatch.ts): real matches through
//     startMatch -> capture -> recordMatch, the store's own choice of boast
//     for a main, a close-win and an empty slot, read back from the match
//     history, embedded in the replay page, and the same every run.
import { describe, expect, it } from "vitest";
import { CLOSE_WIN_HEALTH, SEASON_0_BOASTS, STARTER_BOASTS, type MatchRecord } from "@ai-tcg/economy";
import { boastFromRecord } from "../src/boastFx.js";
import { attachRecord, captureRecordedReplay } from "../src/recordedMatch.js";
import { RECORDED_SCENARIOS } from "../src/recordedDemo.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import type { ReplayBoast } from "../src/types.js";

const BOOT = SEASON_0_BOASTS[0]!.itemId;
const DIALUP = SEASON_0_BOASTS[1]!.itemId;
const scenario = (id: string) => RECORDED_SCENARIOS.find((s) => s.id === id)!;

describe("boastFromRecord", () => {
  const rec = (side: "p1" | "p2", itemId: string, slot: ReplayBoast["slot"], winnerHealth: number | null = 9): ReplayBoast => ({ side, itemId, slot, winnerHealth });

  it("plays the record's boast in whichever slot the store chose", () => {
    expect(boastFromRecord(rec("p1", BOOT, "boast"), "p1", "Cortex")).toEqual({ id: BOOT, slot: "boast", close: false });
    expect(boastFromRecord(rec("p2", DIALUP, "closeWinBoast", 3), "p2", "Swarm")).toEqual({ id: DIALUP, slot: "closeWinBoast", close: true });
    expect(boastFromRecord(rec("p2", STARTER_BOASTS.Cortex.itemId, "factionStarter"), "p2", "Cortex")).toEqual({ id: STARTER_BOASTS.Cortex.itemId, slot: "factionStarter", close: false });
    // Another faction's starter is just a boast like any other.
    expect(boastFromRecord(rec("p1", STARTER_BOASTS.Null.itemId, "boast"), "p1", "Aegis")!.id).toBe(STARTER_BOASTS.Null.itemId);
  });

  it("never re-decides a close win from health: only the record's slot makes it one", () => {
    expect(boastFromRecord(rec("p1", BOOT, "boast", 1), "p1", "Cortex")!.close).toBe(false);
    expect(boastFromRecord(rec("p1", DIALUP, "closeWinBoast", CLOSE_WIN_HEALTH), "p1", "Cortex")!.close).toBe(true);
  });

  it("falls back to the winner's faction starter when the record can't be played", () => {
    const fallback = (f: string) => ({ id: STARTER_BOASTS[f as keyof typeof STARTER_BOASTS].itemId, slot: "fallback", close: false });
    expect(boastFromRecord(null, "p1", "Aegis")).toEqual(fallback("Aegis"));
    expect(boastFromRecord(undefined, "p2", "Null")).toEqual(fallback("Null"));
    // The other side's boast, or one this render can't draw.
    expect(boastFromRecord(rec("p2", BOOT, "boast"), "p1", "Swarm")).toEqual(fallback("Swarm"));
    expect(boastFromRecord(rec("p1", "boast-s1-not-drawn-yet", "closeWinBoast", 2), "p1", "Cortex")).toEqual(fallback("Cortex"));
  });

  it("has no boast for a draw or an unfinished match", () => {
    expect(boastFromRecord(rec("p1", BOOT, "boast"), "draw", "Cortex")).toBeNull();
    expect(boastFromRecord(null, null, "Cortex")).toBeNull();
    expect(boastFromRecord(null, "p1", "Neutral")).toBeNull();
  });
});

describe("the store's record, end to end", () => {
  it("a bought season boast in the main slot plays instead of the faction's", async () => {
    const r = await captureRecordedReplay(scenario("recorded-boot-sequence"));
    const last = r.replay.frames.at(-1)!;
    expect(last.winner).toBe("p1");
    expect(last.players.p1.health).toBeGreaterThan(CLOSE_WIN_HEALTH);
    // Earned in real recorded matches, then bought: the history pays for it.
    expect(r.earning.length).toBeGreaterThan(0);
    expect(r.earning.every((m) => m.outcome === "win" || m.outcome === "draw")).toBe(true);
    expect(r.replay.record).toEqual({ matchId: "recorded-boot-sequence", loadouts: r.record.loadouts, boast: { side: "p1", itemId: BOOT, slot: "boast", winnerHealth: last.players.p1.health } });
    expect(boastFromRecord(r.replay.record!.boast, last.winner, "Cortex")).toEqual({ id: BOOT, slot: "boast", close: false });
  }, 60_000);

  it("a close win plays the close-win boast; a win that isn't close keeps the main one", async () => {
    const close = await captureRecordedReplay(scenario("recorded-close-win"));
    const w = close.replay.frames.at(-1)!;
    expect(w.players.p1.health).toBeLessThanOrEqual(CLOSE_WIN_HEALTH);
    expect(close.replay.record!.loadouts!.p1).toMatchObject({ boast: STARTER_BOASTS.Swarm.itemId, closeWinBoast: DIALUP });
    expect(close.replay.record!.boast).toMatchObject({ side: "p1", itemId: DIALUP, slot: "closeWinBoast", winnerHealth: w.players.p1.health });
    expect(boastFromRecord(close.replay.record!.boast, "p1", "Swarm")!.close).toBe(true);

    const notClose = await captureRecordedReplay(scenario("recorded-other-starter"));
    const n = notClose.replay.frames.at(-1)!;
    expect(n.players.p1.health).toBeGreaterThan(CLOSE_WIN_HEALTH);
    expect(notClose.replay.record!.loadouts!.p1.closeWinBoast).toBe(STARTER_BOASTS.Swarm.itemId);
    expect(notClose.replay.record!.boast).toMatchObject({ itemId: STARTER_BOASTS.Null.itemId, slot: "boast" });
  }, 60_000);

  it("an empty boast slot plays the deck faction's starter, as the store recorded it", async () => {
    const r = await captureRecordedReplay(scenario("recorded-empty-slot"));
    expect(r.replay.frames.at(-1)!.winner).toBe("p2");
    expect(r.replay.record!.loadouts!.p2.boast).toBeNull();
    expect(r.replay.record!.boast).toMatchObject({ side: "p2", itemId: STARTER_BOASTS.Cortex.itemId, slot: "factionStarter" });
    expect(boastFromRecord(r.replay.record!.boast, "p2", "Cortex")!.slot).toBe("factionStarter");
  }, 60_000);

  it("is the same every run, and the page embeds the record", async () => {
    const a = await captureRecordedReplay(scenario("recorded-empty-slot"));
    const b = await captureRecordedReplay(scenario("recorded-empty-slot"));
    expect(JSON.stringify(b.replay)).toBe(JSON.stringify(a.replay));
    const html = renderMatchHtml(a.replay);
    expect(html).toContain('"record":{"matchId":"recorded-empty-slot"');
    expect(html).toContain("boastFromRecord(replay.record ? replay.record.boast : null");
  }, 60_000);
});

describe("attachRecord", () => {
  it("attaches a record only to the replay it is of", async () => {
    const { replay, record } = await captureRecordedReplay(scenario("recorded-other-starter"));
    const bare = { ...replay, record: undefined };
    expect(attachRecord(bare, record).record!.boast!.side).toBe("p1");
    const bad = (f: (m: MatchRecord) => void) => {
      const m = structuredClone(record);
      f(m);
      return () => attachRecord(bare, m);
    };
    expect(bad((m) => { m.seed += 1; })).toThrow(/seed/);
    expect(bad((m) => { m.outcome = "draw"; m.winnerAgentId = null; })).toThrow(/says draw/);
    expect(bad((m) => { m.winnerAgentId = m.p2AgentId; })).toThrow(/says p2/);
    expect(bad((m) => { m.boast!.agentId = m.p2AgentId; })).toThrow(/not the winner's/);
    expect(bad((m) => { m.boast!.winnerHealth = 1; })).toThrow(/health/);
  }, 60_000);
});
