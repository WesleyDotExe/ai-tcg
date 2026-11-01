// EFFECTS.md v2 slice 5 (faction wards for signature abilities). Four layers:
//  1. which fires get a ward: the signatureAbilities table, first fire per
//     card instance only, a fire that did nothing doesn't count, Neutral
//     never;
//  2. the role each fire plays, read from what it did (never the name), on
//     real captured matches covering all ten approved abilities that fire;
//  3. guard copies: on every unit a signature defence gave a Barrier, for
//     exactly as long as that Barrier stands;
//  4. the ward's look over time (a flare is only ever over the card, a
//     guard at rest only behind it) and the page wiring.
// The canvas runtime itself needs a browser: progress/render/evidence/.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { DeckSpec } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "../src/engineInternal.js";
import { captureMatch } from "../src/capture.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import type { MatchReplay } from "../src/types.js";
import {
  SIG_R,
  SIG_T,
  SIG_WARD_FACTIONS,
  SIG_WARD_PURE_SOURCE,
  SIG_WARD_RUNTIME_SOURCE,
  sigLeadMs,
  sigLook,
  sigNextMode,
  sigTable,
  sigWardDataFor,
  signatureFires,
  signatureGuards,
  signatureTable,
} from "../src/sigWardFx.js";
import type { SignatureFire } from "../src/sigWardFx.js";

const BUILDERS: Record<string, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck, Aegis: buildAegisDeck, Swarm: buildSwarmDeck, Null: buildNullDeck,
};
const cache = new Map<string, Promise<MatchReplay>>();
// Same agents and seeds as the CLI, so these are the committed replays.
function match(a: string, b: string, seed: number): Promise<MatchReplay> {
  const key = `${a}-${b}-${seed}`;
  if (!cache.has(key)) {
    const mirror = a === b;
    cache.set(key, captureMatch({
      title: key, seed, deckA: BUILDERS[a]!("p1", a), deckB: BUILDERS[b]!("p2", b),
      agentA: new LookaheadAgent(`Lookahead-${a}${mirror ? "-A" : ""}`, seed * 2 + 1),
      agentB: new LookaheadAgent(`Lookahead-${b}${mirror ? "-B" : ""}`, seed * 2 + 2),
      boardSlots: BOARD_SLOTS,
    }));
  }
  return cache.get(key)!;
}
const flat = (fires: Record<number, SignatureFire[]>) =>
  Object.entries(fires).flatMap(([k, l]) => l.map((f) => ({ ...f, frame: Number(k) })));
const triggers = (r: MatchReplay, ability: string) =>
  r.frames.flatMap((f, k) => f.newEvents.filter((e) => e.event.type === "abilityTrigger" && (e.event as { ability: string }).ability === ability).map(() => k));

describe("which fires get a faction ward", () => {
  it("reads the owner-approved table from mythics.json: ten Rares, the note skipped", () => {
    const t = signatureTable();
    expect(Object.keys(t).sort()).toEqual([
      "Aegis Warden", "Deprecated Routine", "Dormant Egg Sac", "Dormant Exploit", "Kernel Panic",
      "Latent Ward", "Lockdown Field", "Overload Capacitor", "Rate Limiter", "Retaliation Node",
    ]);
    expect(t["Rate Limiter"]).toEqual({ "rate-limiter-tick": true });
    expect(sigTable({ _about: "x", A: ["a1", "a2"], B: "not a list" })).toEqual({ A: { a1: true, a2: true } });
  });

  it("Neutral has no ward sheet; the four factions each have one", () => {
    expect(Object.keys(SIG_WARD_FACTIONS).sort()).toEqual(["Aegis", "Cortex", "Null", "Swarm"]);
    for (const key of Object.values(SIG_WARD_FACTIONS)) expect(existsSync(resolve(__dirname, "../assets/wards/faction", `${key}.webp`))).toBe(true);
  });

  it("first fire only: Rate Limiter ticks turn after turn but gets one ward, on its first tick", async () => {
    // Seed 12 since game session 41 (the reference agent's fix replayed
    // seed 7 with 4 ticks).
    const r = await match("Cortex", "Aegis", 12);
    const ticks = triggers(r, "rate-limiter-tick");
    const fires = flat(signatureFires(r)).filter((f) => f.ability === "rate-limiter-tick");
    expect(ticks.length).toBeGreaterThanOrEqual(5);
    expect(fires).toHaveLength(1);
    expect(fires[0]!.frame).toBe(ticks[0]);
    expect(fires[0]!.role).toBe("attack");
  }, 60_000);

  it("a fire that did nothing is not the first fire: the ward waits for one that lands", async () => {
    const r = await match("Aegis", "Cortex", 1);
    const [first, second] = triggers(r, "rate-limiter-tick");
    expect(flat(signatureFires(r)).find((f) => f.ability === "rate-limiter-tick")!.frame).toBe(first);
    // The same match with the first tick's effects taken out (as when its
    // condition finds too few enemy units): the ward moves to the next tick.
    const frames = r.frames.map((f, k) => {
      if (k !== first) return f;
      let inTick = false;
      const newEvents = f.newEvents.filter((e) => {
        if (e.event.type === "abilityTrigger") inTick = (e.event as { ability: string }).ability === "rate-limiter-tick";
        return !inTick || e.event.type === "abilityTrigger";
      });
      return { ...f, newEvents };
    });
    const moved = flat(signatureFires({ ...r, frames })).filter((f) => f.ability === "rate-limiter-tick");
    expect(moved.map((f) => f.frame)).toEqual([second]);
  }, 60_000);

  it("first fire only: Retaliation Node is hit again and again, one ward, on the strike move that first hurt it", async () => {
    const r = await match("Aegis", "Cortex", 3);
    const fires = flat(signatureFires(r)).filter((f) => f.ability === "retaliation-node-damaged");
    expect(fires).toHaveLength(1);
    expect(triggers(r, "retaliation-node-damaged").length).toBeGreaterThanOrEqual(1);
    const ev = r.frames[fires[0]!.frame]!.newEvents.map((e) => e.event.type);
    expect(ev).toContain("stackResolve");
    expect(fires[0]!.targets.every((t) => t.kind === "unit")).toBe(true);
  }, 60_000);
});

describe("the role comes from what the power did", () => {
  it("covers every approved ability that fires in the replays, each with its role", async () => {
    const seen: Record<string, Set<string>> = {};
    const runs: [string, string, number][] = [
      ["Aegis", "Aegis", 1], ["Aegis", "Cortex", 6], ["Aegis", "Null", 3], ["Null", "Cortex", 4], ["Swarm", "Null", 8],
      ["Aegis", "Cortex", 1], ["Aegis", "Cortex", 3], ["Cortex", "Swarm", 6], ["Cortex", "Aegis", 7],
      // Since Null's list grew to 40 (game session 60), the two Null replays
      // above no longer fire Deprecated Routine or Dormant Egg Sac; these do.
      ["Aegis", "Null", 8], ["Swarm", "Null", 1],
      // Since Null Pointer and Force Quit became modal (game session 62),
      // none of the above fires Deprecated Routine; this one does.
      ["Cortex", "Null", 3],
    ];
    for (const [a, b, s] of runs) for (const f of flat(signatureFires(await match(a, b, s)))) (seen[f.name] ??= new Set()).add(f.role);
    expect(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v].sort()]))).toEqual({
      "Aegis Warden": ["defence"],
      "Deprecated Routine": ["attack"],
      "Dormant Egg Sac": ["attack"],
      "Dormant Exploit": ["attack"],
      "Kernel Panic": ["attack"],
      "Latent Ward": ["defence"],
      "Lockdown Field": ["attack"],
      "Overload Capacitor": ["self"],
      "Rate Limiter": ["attack"],
      "Retaliation Node": ["attack"],
    });
  }, 120_000);

  it("a Command's ward plays on its stack entry; a unit's on the unit", async () => {
    // Seed 3 since game session 41 (the reference agent's fix replayed seed
    // 6 with Lockdown Field holding 2 units, not 6).
    const lock = flat(signatureFires(await match("Aegis", "Cortex", 3))).find((f) => f.name === "Lockdown Field")!;
    expect(lock.source.kind).toBe("stack");
    expect(lock.owner).toBe("p1");
    expect(lock.faction).toBe("Aegis");
    expect(lock.targets.length).toBe(5);
    const kp = flat(signatureFires(await match("Null", "Cortex", 4))).find((f) => f.name === "Kernel Panic")!;
    expect(kp.source).toEqual({ kind: "unit", instanceId: kp.sourceId });
    expect(kp.ward).toBe(true);
  }, 60_000);

  it("a replay with no signature fire embeds no faction sheet", async () => {
    const r = await match("Cortex", "Null", 5);
    expect(flat(signatureFires(r))).toHaveLength(0);
    expect(sigWardDataFor(r).atlases).toEqual({});
  }, 60_000);

  it("embeds only the sheets of factions whose ward plays", async () => {
    const data = sigWardDataFor(await match("Aegis", "Cortex", 3));
    expect(Object.keys(data.atlases).sort()).toEqual(["Aegis", "Cortex"]);
    expect(data.atlases.Aegis!.startsWith("data:image/webp;base64,")).toBe(true);
    expect(data.table).toEqual(signatureTable());
  }, 60_000);
});

describe("guard copies stand while the Barrier stands", () => {
  it("Latent Ward guards every unit it shielded, and each guard goes exactly when that unit's Barrier does", async () => {
    const r = await match("Aegis", "Cortex", 1);
    const fires = signatureFires(r);
    const lw = flat(fires).find((f) => f.name === "Latent Ward")!;
    expect(lw.role).toBe("defence");
    expect(lw.guarded.length).toBe(4);
    const guards = signatureGuards(r.frames, fires);
    expect(guards).toHaveLength(r.frames.length);
    for (let k = 0; k < r.frames.length; k++) {
      for (const g of guards[k]!) {
        const u = [...r.frames[k]!.players.p1.board, ...r.frames[k]!.players.p2.board].find((x) => x.instanceId === g.iid);
        expect(u?.barrierActive).toBe(true);
        expect(g.faction).toBe("Aegis");
      }
    }
    expect(guards[lw.frame - 1]!).toHaveLength(0);
    expect(guards[lw.frame]!.map((g) => g.iid).sort()).toEqual([...lw.guarded].sort());
  }, 60_000);

  it("Aegis Warden guards itself (heal + Barrier on its own card)", async () => {
    const r = await match("Aegis", "Aegis", 1);
    const fires = signatureFires(r);
    const aw = flat(fires).find((f) => f.name === "Aegis Warden")!;
    expect(aw.role).toBe("defence");
    expect(aw.targets).toEqual([]);
    expect(aw.guarded).toEqual([aw.sourceId]);
    expect(signatureGuards(r.frames, fires)[aw.frame]!.map((g) => g.iid)).toEqual([aw.sourceId]);
  }, 60_000);
});

describe("the ward's look over time", () => {
  const steps = (from: number, to: number, n: number) => Array.from({ length: n + 1 }, (_, k) => from + ((to - from) * k) / n);
  it("a flare is over the card from draw-in to collapse, never behind", () => {
    for (const mode of ["manifest", "pulse", "collapse"] as const) for (const mt of steps(0, 1, 10)) {
      const l = sigLook(mode, mt, 0.3);
      expect(l.top).toBe(1);
      expect(l.under).toBe(0);
    }
    expect(sigLook("manifest", 0, 0).reveal).toBe(0);
    expect(sigLook("manifest", SIG_T.drawIn, 0).reveal).toBe(1);
    expect(sigLook("collapse", SIG_T.collapse, 0).a).toBeCloseTo(0, 9);
  });

  it("a guard flies in over the card, then sinks behind it and stays there", () => {
    expect(sigLook("wait", 1, 0)).toMatchObject({ top: 0, under: 0 });
    expect(sigLook("travel", 0.2, 0)).toMatchObject({ top: 1, under: 0 });
    let last = 0;
    for (const mt of steps(0, SIG_T.sink, 20)) {
      const l = sigLook("sink", mt, 0);
      expect(l.top + l.under).toBeCloseTo(1, 9);
      expect(l.under).toBeGreaterThanOrEqual(last);
      last = l.under;
    }
    for (const t of steps(0, 30, 30)) expect(sigLook("perm", 5, t)).toMatchObject({ top: 0, under: 1 });
  });

  it("modes advance: flare pulse -> hold -> collapse -> gone; mini rests then goes; guard travel -> sink -> perm", () => {
    expect(sigNextMode("pulse", SIG_T.pulse, "flare")).toBe("hold");
    expect(sigNextMode("hold", 1, "flare")).toBe("hold");
    expect(sigNextMode("hold", SIG_T.holdMax, "flare")).toBe("collapse");
    expect(sigNextMode("collapse", SIG_T.collapse, "flare")).toBeNull();
    expect(sigNextMode("manifest", SIG_T.mini, "mini")).toBe("collapse");
    expect(sigNextMode("manifest", SIG_T.mini, "flare")).toBe("manifest");
    expect(sigNextMode("travel", SIG_T.travel, "guard")).toBe("sink");
    expect(sigNextMode("sink", SIG_T.sink, "guard")).toBe("perm");
    expect(sigNextMode("perm", 999, "guard")).toBe("perm");
    expect(sigNextMode("wait", SIG_T.waitMax, "guard")).toBe("perm");
  });

  it("a guard behind a 118x158 card shows past its sides, top and bottom", () => {
    const R = 158 * SIG_R.guard;
    expect(R).toBeGreaterThan(158 / 2 + 20);
    expect(SIG_R.mini).toBeLessThan(SIG_R.flare);
  });

  it("the ward's lead scales with play speed and stays inside a spectacle beat", () => {
    expect(sigLeadMs(700)).toBe(525);
    expect(sigLeadMs(250)).toBe(200);
    expect(sigLeadMs(5000)).toBe(600);
    // A spectacle move holds speed + 900 ms; the ward, its effect and the
    // collapse fit in it at normal speed.
    expect(sigLeadMs(700) + 240 * 1.45 + 380).toBeLessThan(700 + 900);
  });
});

describe("the replay page", () => {
  it("embeds the exact sources, the table and only the sheets it needs, and cues the ward on the move's timeline", async () => {
    const html = renderMatchHtml(await match("Aegis", "Cortex", 1));
    expect(html).toContain(SIG_WARD_PURE_SOURCE);
    expect(html).toContain(SIG_WARD_RUNTIME_SOURCE);
    expect(html).toContain('<script type="application/json" id="sigward-data">');
    const data = JSON.parse(html.split('<script type="application/json" id="sigward-data">')[1]!.split("</script>")[0]!);
    expect(Object.keys(data.atlases).sort()).toEqual(["Aegis", "Cortex"]);
    for (const cue of ["FWARDS.open(", "FWARDS.fire(", "FWARDS.close(", "FWARDS.guardIn(", "FWARDS.crack(", "FWARDS.syncGuards(", "WARDS.pulse(s.sourceId)"]) expect(html).toContain(cue);
    // The ward replaces the power's sigil and cast sound; its tag stays.
    expect(html).toContain("if (!fx.ward) SND.play('cast'");
  }, 60_000);

  it("the source modules agree with the committed mythics.json", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../presentation/mythics.json"), "utf8"));
    expect(signatureTable()).toEqual(sigTable(raw.signatureAbilities));
  });
});
