// The match feed (render session 21): the log pane reads the engine's
// structured events, not its prose. ORACLES over real matches check that
// nothing that happened is lost (every play, cast, attack, damage, death,
// draw and trigger has its entry), that the noise is gone (no priority
// passes, no seat names, no internal ability ids), and that the reactive
// plays the priority system exists for are tagged as responses.
import { describe, expect, it } from "vitest";
import { BOARD_SLOTS, buildAegisDeck, buildCortexDeck, buildSwarmDeck } from "@ai-tcg/engine";
import type { DeckSpec, GameEvent } from "@ai-tcg/engine";
import { LookaheadAgent, buildNullDeck } from "../src/engineInternal.js";
import type { DeckFaction } from "../src/engineInternal.js";
import { abilityTextFor, captureMatch } from "../src/capture.js";
import { generatedSeats } from "../src/generatedSignatures.js";
import { renderMatchHtml } from "../src/renderHtml.js";
import { attackFirst, buildFeed, buildFeedWithQuiet, feedText, triggerChangedNothing, withPlayers } from "../src/feed.js";
import type { FeedEntry, FeedPart } from "../src/feed.js";

const BUILDERS: Record<DeckFaction, (id: DeckSpec["id"], name: string) => DeckSpec> = {
  Cortex: buildCortexDeck, Aegis: buildAegisDeck, Swarm: buildSwarmDeck, Null: buildNullDeck,
};

async function replay(a: DeckFaction, b: DeckFaction, seed: number, signatures: boolean) {
  const seats = signatures ? generatedSeats(seed) : undefined;
  const deckA = { ...BUILDERS[a]("p1", a), ...(seats ? { signature: seats[0].card } : {}) };
  const deckB = { ...BUILDERS[b]("p2", b), ...(seats ? { signature: seats[1].card } : {}) };
  const r = await captureMatch({
    title: `${a} vs ${b} seed ${seed}`, seed, deckA, deckB,
    agentA: new LookaheadAgent(seats ? seats[0].agentName : `Kestrel-${a}`, seed * 2 + 1),
    agentB: new LookaheadAgent(seats ? seats[1].agentName : `Mote-${b}`, seed * 2 + 2),
    boardSlots: BOARD_SLOTS,
  });
  return { r, abilityText: abilityTextFor([deckA, deckB]) };
}

const flat = (parts: FeedPart[] | undefined) =>
  (parts ?? []).map((p) => (typeof p === "string" ? p : "card" in p ? p.card : `<${p.player}>`)).join("");
const has = (e: FeedEntry, s: string) => flat(e.parts).includes(s);

describe("the match feed", () => {
  // Every committed replay's match-up, signature replays included.
  const cases: [DeckFaction, DeckFaction, number, boolean][] = [
    ["Aegis", "Cortex", 1, false], ["Cortex", "Aegis", 5, true], ["Cortex", "Aegis", 2, true], ["Null", "Cortex", 4, false],
    ["Aegis", "Null", 3, false], ["Swarm", "Null", 8, false], ["Cortex", "Swarm", 6, false],
  ];
  const replaysP = Promise.all(cases.map(([a, b, s, sig]) => replay(a, b, s, sig)));

  it("every frame carries a feed", async () => {
    for (const { r } of await replaysP) for (const f of r.frames) expect(Array.isArray(f.feed), `${r.title} move ${f.index}`).toBe(true);
  });

  it("loses nothing that happened: each event kind has its entries", async () => {
    for (const { r } of await replaysP) {
      const events = r.frames.flatMap((f) => f.newEvents.map((e) => e.event));
      const entries = r.frames.flatMap((f) => f.feed!);
      const count = (t: GameEvent["type"]) => events.filter((e) => e.type === t).length;
      const where = (pred: (e: FeedEntry) => boolean) => entries.filter(pred).length;
      const msg = r.title;
      expect(where((e) => e.kind === "turn"), msg).toBe(count("turnStart"));
      expect(where((e) => e.kind === "action" && has(e, " plays ")), msg).toBe(count("play"));
      expect(where((e) => (e.kind === "action" || e.kind === "response") && (has(e, " casts ") || has(e, " activates "))), msg).toBe(count("cast"));
      expect(where((e) => e.kind === "action" && has(e, " attacks ")), msg).toBe(count("attack"));
      expect(where((e) => e.kind === "result" && / deals \d+ to /.test(flat(e.parts))), msg).toBe(count("damage"));
      expect(where((e) => e.kind === "result" && has(e, " is destroyed")), msg).toBe(count("death"));
      expect(where((e) => e.kind === "end"), msg).toBe(count("gameOver"));
      // Draws: in the turn header (the turn's draw) or a line of their own.
      const headerDraws = entries.filter((e) => e.kind === "turn").reduce((n, e) => n + (flat(e.detail).match(/draws /g)?.length ?? 0), 0);
      expect(headerDraws + where((e) => e.kind === "result" && has(e, " draws ")), msg).toBe(count("draw"));
      // Triggers: a line of their own, the rules text of the resolve or
      // arming line they belong to, or dropped because nothing came of
      // them (no result event follows; feedQuiet.test.ts checks that
      // against the engine's state).
      const merged = where((e) => (e.kind === "resolve" && !!e.detail) || (e.kind === "trigger" && has(e, " arms") && !!e.detail));
      const ownLine = where((e) => e.kind === "trigger" && !has(e, " arms"));
      let quiet = 0;
      for (const f of r.frames) {
        const evs = f.newEvents.map((e) => e.event);
        evs.forEach((e, k) => {
          if (e.type !== "abilityTrigger" || !triggerChangedNothing(evs, k)) return;
          // Absorbed into a resolve or arming line all the same.
          const prev = evs[k - 1];
          const absorbed = (prev?.type === "stackResolve" && prev.description.startsWith(e.source) && (e.trigger === "onPlay" || e.trigger === "activated")) || (prev?.type === "telegraphArmed" && prev.unit === e.source && e.trigger === "onPlay");
          if (!absorbed) quiet++;
        });
      }
      expect(ownLine + merged + quiet, msg).toBe(count("abilityTrigger"));
      expect(count("abilityTrigger"), msg).toBeGreaterThan(0);
    }
  });

  it("drops the noise: no priority passes, no seats, no internal ability ids", async () => {
    let passes = 0;
    for (const { r, abilityText } of await replaysP) {
      const events = r.frames.flatMap((f) => f.newEvents.map((e) => e.event));
      passes += events.filter((e) => e.type === "priorityPass").length;
      for (const e of events) {
        if (e.type === "abilityTrigger") expect(abilityText[e.ability], `${r.title}: rules text for ${e.source} ${e.ability}`).toBeTruthy();
      }
      const ids = new Set(events.flatMap((e) => (e.type === "abilityTrigger" ? [e.ability] : [])));
      for (const f of r.frames) {
        for (const e of f.feed!) {
          const strings = [...e.parts, ...(e.detail ?? [])].filter((p): p is string => typeof p === "string").join("|");
          expect(strings, `${r.title} move ${f.index}`).not.toMatch(/\bp[12]\b/);
          expect(strings).not.toMatch(/passes priority|end of turn \d/);
          for (const id of ids) expect(flat(e.parts) + flat(e.detail)).not.toContain(id);
        }
      }
    }
    expect(passes).toBeGreaterThan(100);
  });

  it("names players by agent name", async () => {
    const { r } = (await replaysP)[1]!;
    const lines = r.frames.flatMap((f) => f.feed!.map((e) => feedText(e, { names: r.agentNames })));
    expect(lines[0]).toBe(`== Turn 1 · ${r.agentNames.p1} ==`);
    expect(lines.some((l) => l.includes(`${r.agentNames.p2} plays `))).toBe(true);
    expect(lines[lines.length - 1]).toBe(`${r.agentNames.p1} wins: ${r.agentNames.p2}'s health reached 0`);
  });

  it("never leaves a trigger line with nothing under it", async () => {
    // The noise render session 22 removed: "Diagnostic Loop · end of turn"
    // on an unhurt unit, then straight on to the next turn's header.
    let triggers = 0;
    for (const { r } of await replaysP) {
      for (const f of r.frames) {
        f.feed!.forEach((e, i) => {
          if (e.kind !== "trigger" || has(e, " arms")) return;
          triggers++;
          expect(f.feed![i + 1]?.kind, `${r.title} move ${f.index}: ${flat(e.parts)}`).toBe("result");
        });
      }
    }
    expect(triggers).toBeGreaterThan(20);
  });

  it("tags a cast into a waiting stack as a RESPONSE", async () => {
    let responses = 0;
    for (const { r } of await replaysP) {
      for (let k = 1; k < r.frames.length; k++) {
        const f = r.frames[k]!;
        const casts = f.newEvents.filter((e) => e.event.type === "cast");
        if (!casts.length) continue;
        const entry = f.feed!.find((e) => has(e, " casts ") || has(e, " activates "))!;
        if (r.frames[k - 1]!.stack.length > 0) {
          expect(entry.kind, `${r.title} move ${k}`).toBe("response");
          expect(entry.tag).toBe("RESPONSE");
          responses++;
        }
      }
    }
    expect(responses).toBeGreaterThan(2);
  });

  it("folds an attack's resolution into its declaration unless a response came between", async () => {
    let folded = 0, ownLine = 0;
    for (const { r } of await replaysP) {
      // Attack stack ids that had a cast pushed on top of them.
      const answered = new Set<string>();
      const open: string[] = [];
      for (const f of r.frames) {
        for (const { event: e } of f.newEvents) {
          if (e.type === "attack" && e.stackId) open.push(e.stackId);
          if (e.type === "cast") for (const id of open) answered.add(id);
          if (e.type === "stackResolve" && e.stackId && open.includes(e.stackId)) open.splice(open.indexOf(e.stackId), 1);
        }
      }
      const lands = r.frames.flatMap((f) => f.feed!).filter((e) => e.kind === "resolve" && has(e, "'s attack lands")).length;
      const attacks = r.frames.flatMap((f) => f.newEvents).filter((e) => e.event.type === "attack").length;
      expect(lands, r.title).toBeGreaterThanOrEqual(answered.size);
      expect(lands, r.title).toBeLessThan(attacks);
      ownLine += lands;
      folded += attacks - lands;
    }
    expect(folded).toBeGreaterThan(ownLine * 5);
    expect(ownLine).toBeGreaterThan(0);
  });

  it("is at most about half as long as the raw log", async () => {
    for (const { r } of await replaysP) {
      const raw = r.frames.reduce((n, f) => n + f.newEvents.length, 0);
      const feed = r.frames.reduce((n, f) => n + f.feed!.length, 0);
      expect(feed, r.title).toBeLessThan(raw * 0.6);
    }
  });
});

describe("feed helpers", () => {
  it("withPlayers turns seats in engine text into player parts", () => {
    expect(withPlayers("p2 health depleted")).toEqual([{ player: "p2" }, " health depleted"]);
    expect(withPlayers("turn cap: p1 ahead of p2")).toEqual(["turn cap: ", { player: "p1" }, " ahead of ", { player: "p2" }]);
    expect(withPlayers("nothing here, not even p12")).toEqual(["nothing here, not even p12"]);
  });

  it("attackFirst puts an attack ahead of the onAttack trigger it set off", () => {
    const trig: GameEvent = { type: "abilityTrigger", source: "Load Balancer", ability: "lb-attack", trigger: "onAttack" };
    const dmg: GameEvent = { type: "damage", target: "Turret", targetKind: "unit", amount: 1, source: "Load Balancer" };
    const atk: GameEvent = { type: "attack", attacker: "Load Balancer", defender: "Turret", defenderKind: "unit" };
    expect(attackFirst([trig, dmg, atk])).toEqual([atk, trig, dmg]);
    // Another unit's trigger is left where it is.
    const other: GameEvent = { ...trig, source: "Someone Else" };
    expect(attackFirst([other, atk])).toEqual([other, atk]);
  });
});

describe("rules text", () => {
  // Looked up by ability id alone since render session 22: game session 38
  // gave every size of a signature ability its own id.
  const seats = Array.from({ length: 150 }, (_, s) => generatedSeats(s + 1)).flat();
  const deckOf = (card: (typeof seats)[number]["card"]) => ({ id: "p1" as const, name: "d", cards: [], signature: card });

  it("one id, one text: the set and 300 generated signature cards", () => {
    const text = abilityTextFor(seats.map((s) => deckOf(s.card)));
    for (const seat of seats) for (const a of seat.card.abilities) expect(text[a.id], `${seat.card.name} ${a.id}`).toBe(a.text);
    // Different sizes of one option are different ids.
    const recycle = Object.keys(text).filter((id) => id.startsWith("sig-recycle"));
    expect(new Set(recycle.map((id) => text[id])).size).toBe(recycle.length);
  });

  it("refuses a clash rather than show one card's text on another", () => {
    // The pre-session-38 shape, rebuilt from two real generated cards.
    const withAbility = seats.filter((s) => s.card.abilities.length > 0);
    const first = withAbility[0]!;
    const other = withAbility.find((s) => s.card.abilities[0]!.text !== first.card.abilities[0]!.text)!;
    const clash = { ...other.card, abilities: [{ ...other.card.abilities[0]!, id: first.card.abilities[0]!.id }] };
    expect(() => abilityTextFor([deckOf(first.card), deckOf(clash)])).toThrow(/has two rules texts/);
  });

  it("follows the id, not the card name (a renamed agent's card keeps its text)", async () => {
    // Seed 7: seed 5's cards fire no signature trigger since the approved
    // list went to 13 lines (game session 49).
    const { r, abilityText } = await replay("Cortex", "Aegis", 7, true);
    const sigEvent = r.frames.flatMap((f) => f.newEvents.map((e) => e.event)).find((e) => e.type === "abilityTrigger" && e.ability.startsWith("sig-"));
    expect(sigEvent).toBeTruthy();
    const ev = { ...(sigEvent as Extract<GameEvent, { type: "abilityTrigger" }>), source: "A Renamed Card" };
    const frame = { ...r.frames[1]!, newEvents: [{ event: ev as GameEvent, text: "" }, { event: { type: "heal", target: "x", targetKind: "unit", amount: 1, source: ev.source } as GameEvent, text: "" }] };
    const [entries] = buildFeed([frame], { names: r.agentNames, abilityText });
    expect(entries![0]!.detail?.[0]).toBe(abilityText[ev.ability]);
  });
});

describe("quiet triggers, fizzles and the end", () => {
  const trig = (source: string): GameEvent => ({ type: "abilityTrigger", source, ability: "diagnostic-loop-turnend", trigger: "onTurnEnd" });
  const names = { p1: "Ada", p2: "Bix" };
  const frameWith = async (events: GameEvent[]) => {
    const { r } = await replay("Cortex", "Aegis", 5, true);
    return { ...r.frames[r.frames.length - 1]!, newEvents: events.map((event) => ({ event, text: "" })) };
  };

  it("triggerChangedNothing: only when no result (or fizzle) comes straight after", () => {
    const heal: GameEvent = { type: "heal", target: "Diagnostic Loop", targetKind: "unit", amount: 1, source: "Diagnostic Loop" };
    const end: GameEvent = { type: "turnEnd", turn: 3, player: "p1" };
    expect(triggerChangedNothing([trig("A"), end], 0)).toBe(true);
    expect(triggerChangedNothing([trig("A")], 0)).toBe(true);
    expect(triggerChangedNothing([trig("A"), heal], 0)).toBe(false);
    // The next trigger's results are its own.
    expect(triggerChangedNothing([trig("A"), trig("B"), heal], 0)).toBe(true);
    expect(triggerChangedNothing([trig("A"), { type: "fizzle", reason: "A finds no pending attack to redirect" }], 0)).toBe(false);
    // The next turn's draw follows an end-of-turn trigger; it isn't the
    // trigger's. A draw the trigger made is.
    const draw: GameEvent = { type: "draw", player: "p2", card: "Aegis Sentinel" };
    const start: GameEvent = { type: "turnStart", turn: 4, player: "p2" };
    expect(triggerChangedNothing([trig("A"), draw, start], 0)).toBe(true);
    expect(triggerChangedNothing([trig("A"), { ...draw, player: "p1" }, draw, start], 0)).toBe(false);
    expect(triggerChangedNothing([trig("A"), { type: "fatigue", player: "p2", damage: 2 }, start], 0)).toBe(true);
  });

  it("an attack fizzle says why, in place of the 'lands' line", async () => {
    const frame = await frameWith([
      { type: "attack", attacker: "Init Daemon", defender: "Bix", defenderKind: "player", stackId: "s1" },
      { type: "cast", player: "p2", card: "Force Quit", speed: "Instant", stackId: "s2" },
      { type: "stackResolve", description: "Force Quit", stackId: "s2" },
      { type: "death", unit: "Init Daemon", controller: "p1" },
      { type: "stackResolve", description: "Init Daemon's attack", stackId: "s1" },
      { type: "fizzle", reason: "Init Daemon's attack fizzles — the attacker is no longer in play", cause: "attackerGone", attacker: "Init Daemon" },
    ]);
    const [entries] = buildFeed([frame], { names, abilityText: {} });
    const lines = entries!.map((e) => feedText(e, { names }));
    expect(lines).toContain("   Init Daemon's attack fizzles: the attacker left play first");
    expect(lines.join("\n")).not.toMatch(/lands|deals no damage|fizzles —/);
  });

  it("words an Intercept Routine fizzle from its cause, on its resolve line (render session 23)", async () => {
    // The engine gives redirect fizzles a cause and the attacker's name
    // (game session 39). They are not attack fizzles, so they must not read
    // "its target left play"; and the Command's "resolves" line becomes the
    // fizzle, as an attack's "lands" line does.
    const frame = await frameWith([
      { type: "attack", attacker: "Garbage Collector", defender: "Barrier Drone", defenderKind: "unit", stackId: "s1" },
      { type: "cast", player: "p2", card: "Intercept Routine", speed: "Instant", stackId: "s2" },
      { type: "stackResolve", description: "Intercept Routine", stackId: "s2" },
      { type: "abilityTrigger", source: "Intercept Routine", ability: "intercept-routine-play", trigger: "onPlay" },
      {
        type: "fizzle",
        reason: "Intercept Routine: Garbage Collector's attack is already aimed at Barrier Drone",
        cause: "alreadyAimed",
        source: "Intercept Routine",
        attacker: "Garbage Collector",
        target: "Barrier Drone",
        targetRef: { kind: "unit", instanceId: "no-such-unit" },
      },
    ]);
    const abilityText = { "intercept-routine-play": "Instant. Redirect a pending attack to target unit you control." };
    const [entries] = buildFeed([frame], { names, abilityText });
    const lines = entries!.map((e) => feedText(e, { names }));
    expect(lines).toContain("   Intercept Routine fizzles: Garbage Collector's attack was already aimed at Barrier Drone — Instant. Redirect a pending attack to target unit you control.");
    const all = lines.join("\n");
    expect(all).not.toMatch(/left play first|resolves|fizzles: Intercept Routine:/);
  });

  it("reports the triggers it dropped as quiet, by their index in the frame's own events", async () => {
    const heal: GameEvent = { type: "heal", target: "Diagnostic Loop", targetKind: "unit", amount: 1, source: "Diagnostic Loop" };
    const frame = await frameWith([
      { type: "turnStart", turn: 4, player: "p1" },
      trig("Quiet One"),
      trig("Loud One"),
      heal,
      trig("Quiet Two"),
      { type: "turnEnd", turn: 4, player: "p1" },
    ]);
    const { entries, quiet } = buildFeedWithQuiet([frame], { names, abilityText: {} });
    expect(quiet).toEqual([[1, 4]]);
    const text = entries[0]!.map((e) => feedText(e, { names })).join("\n");
    expect(text).toContain("Loud One");
    expect(text).not.toMatch(/Quiet/);
  });

  it("words a redirect with no attack waiting, on its own line when nothing resolved just before", async () => {
    const frame = await frameWith([
      { type: "fizzle", reason: "Intercept Routine finds no pending attack to redirect", cause: "noPendingAttack", source: "Intercept Routine" },
    ]);
    const [entries] = buildFeed([frame], { names, abilityText: {} });
    expect(entries!.map((e) => feedText(e, { names }))).toEqual(["      Intercept Routine fizzles: no attack was waiting to redirect"]);
  });

  it("names a player the attack was already aimed at as the player", async () => {
    const frame = await frameWith([
      { type: "fizzle", reason: "x", cause: "alreadyAimed", source: "Intercept Routine", attacker: "Garbage Collector", target: "Bix", targetRef: { kind: "player", playerId: "p2" } },
    ]);
    const [entries] = buildFeed([frame], { names, abilityText: {} });
    expect(entries![0]!.parts).toContainEqual({ player: "p2" });
    expect(feedText(entries![0]!, { names })).toBe("      Intercept Routine fizzles: Garbage Collector's attack was already aimed at Bix");
  });

  it("words the end from its cause", async () => {
    const end = async (ev: GameEvent) => {
      const [entries] = buildFeed([await frameWith([ev])], { names, abilityText: {} });
      return feedText(entries![0]!, { names });
    };
    expect(await end({ type: "gameOver", winner: "p1", reason: "p2's health reached 0", cause: { kind: "healthDepleted", losers: ["p2"] } })).toBe("Ada wins: Bix's health reached 0");
    expect(await end({ type: "gameOver", winner: "draw", reason: "x", cause: { kind: "healthDepleted", losers: ["p1", "p2"] } })).toBe("Draw: both players' health reached 0 at once");
    expect(await end({ type: "gameOver", winner: "p2", reason: "x", cause: { kind: "turnCap", tied: false } })).toMatch(/^Bix wins at the turn cap, -?\d+ health to -?\d+$/);
    expect(await end({ type: "gameOver", winner: "draw", reason: "x", cause: { kind: "turnCap", tied: true } })).toMatch(/^Draw at the turn cap, both on -?\d+ health$/);
    // A log from before the cause existed.
    expect(await end({ type: "gameOver", winner: "p1", reason: "p2 health depleted" })).toBe("Ada wins (Bix health depleted)");
  });
});

describe("the page", () => {
  it("draws the feed, keeps the engine log one switch away, and names players", async () => {
    const { r } = await replay("Cortex", "Aegis", 5, true);
    const html = renderMatchHtml(r);
    expect(html).toContain('id="eventlog-body"');
    expect(html).toContain('id="raw-log"');
    expect(html).toContain("frame.feed.forEach");
    expect(html).not.toContain("'P1 HAND'");
    expect(html).not.toContain("m.leader.toUpperCase()");
    expect(html).not.toContain("frame.activePlayer.toUpperCase()");
  });
});
