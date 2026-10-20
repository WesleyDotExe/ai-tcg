import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COSMETICS, EconomyError, EconomyStore, LOADOUT_SLOTS, SLOT_KIND, STARTER_BOASTS, type LoadoutSlot } from "@ai-tcg/economy";
import { BOAST_SPECS } from "../src/boastFx.js";
import {
  LOADOUT_GLYPHS,
  loadoutApply,
  loadoutPreview,
  loadoutSavedLine,
  loadoutSlotLine,
  loadoutTilePreview,
  renderLoadoutHtml,
  type LoadoutPageData,
  type PickerSlot,
} from "../src/loadoutPicker.js";
import { buildLoadoutPage, LOADOUT_SCENARIOS, openScenarioStore, outcomesFor, type BuiltScenario } from "../src/loadoutDemo.js";

const starters = Object.fromEntries(Object.entries(STARTER_BOASTS).map(([f, b]) => [f, b.itemId]));
const names = Object.fromEntries(COSMETICS.map((i) => [i.itemId, i.name]));
const empty = (): Record<PickerSlot, string | null> => ({ boast: null, closeWinBoast: null, cardBack: null, avatar: null, arena: null });
const BOOT = "boast-s0-boot-sequence";

// One small deterministic generator for the random sequences.
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

let page: { data: LoadoutPageData; built: BuiltScenario[] };
beforeAll(async () => {
  page = await buildLoadoutPage();
}, 180_000);

describe("the loadout picker's model", () => {
  it("applies the store's answer, and keeps the old state on a refusal or an unknown choice", () => {
    const outcomes = { boast: { [BOOT]: { ok: false as const, error: "the owner doesn't own \"Boot Sequence\"" }, "": { ok: true as const, value: null } } } as never;
    const s0 = { ...empty(), boast: STARTER_BOASTS.Null.itemId };
    const refused = loadoutApply(s0, "boast", BOOT, outcomes);
    expect(refused.ok).toBe(false);
    expect(refused.state).toBe(s0);
    expect(refused.error).toContain("doesn't own");
    const emptied = loadoutApply(s0, "boast", null, outcomes);
    expect(emptied.ok).toBe(true);
    expect(emptied.state.boast).toBeNull();
    expect(s0.boast).toBe(STARTER_BOASTS.Null.itemId); // not mutated
    expect(loadoutApply(s0, "arena", "nope", outcomes).error).toBe("the page has no store answer for this choice");
  });

  it("previews the boast a win would play: the slot's item, else the fallbacks", () => {
    const s = empty();
    expect(loadoutPreview(s, "boast", "Swarm", starters)).toEqual({ id: STARTER_BOASTS.Swarm.itemId, close: false });
    expect(loadoutPreview(s, "closeWinBoast", "Swarm", starters)).toEqual({ id: STARTER_BOASTS.Swarm.itemId, close: false });
    s.boast = BOOT;
    expect(loadoutPreview(s, "closeWinBoast", "Swarm", starters)).toEqual({ id: BOOT, close: false });
    s.closeWinBoast = STARTER_BOASTS.Aegis.itemId;
    expect(loadoutPreview(s, "closeWinBoast", "Swarm", starters)).toEqual({ id: STARTER_BOASTS.Aegis.itemId, close: true });
    expect(loadoutPreview(s, "boast", "Swarm", starters)).toEqual({ id: BOOT, close: false });
    // A tile previews the state as it would be with it equipped.
    expect(loadoutTilePreview(s, "boast", null, "Null", starters)).toEqual({ id: STARTER_BOASTS.Null.itemId, close: false });
    expect(loadoutTilePreview(s, "closeWinBoast", null, "Null", starters)).toEqual({ id: BOOT, close: false });
    // A non-boast slot previews the main boast.
    expect(loadoutTilePreview(s, "arena", null, "Null", starters)).toEqual({ id: BOOT, close: false });
  });

  it("names each slot's value, and what an empty slot means", () => {
    const s = empty();
    expect(loadoutSlotLine(s, "boast", "Cortex", starters, names)).toBe("Empty: plays Data Cascade");
    expect(loadoutSlotLine(s, "closeWinBoast", "Cortex", starters, names)).toBe("Empty: plays the main boast");
    expect(loadoutSlotLine(s, "avatar", "Cortex", starters, names)).toBe("Empty");
    s.boast = BOOT;
    expect(loadoutSlotLine(s, "boast", "Cortex", starters, names)).toBe("Boot Sequence");
    expect(loadoutSavedLine("Victory boast", BOOT, names)).toBe("Saved: Boot Sequence is this agent's victory boast.");
    expect(loadoutSavedLine("Close-win boast", null, names)).toBe("Saved: the close-win boast slot is empty.");
  });

  it("previews exactly what the store records: real matches recorded with every slot combination and a close and a clear win", () => {
    let clock = new Date("2026-10-20T09:00:00.000Z");
    const store = EconomyStore.open(":memory:", { now: () => clock });
    try {
      const seat = (faction: "Aegis" | "Null", name: string) => {
        const ownerId = store.createOwner({ name: `${name}-owner` }).ownerId;
        const { copies } = store.grantStarterCollection(ownerId, faction);
        const agentId = store.createAgent({ ownerId, name }).agentId;
        const deck = store.saveDeck(ownerId, "starter", copies.map((c) => c.copyId));
        store.setActiveDeck(ownerId, deck.deckId);
        store.connectAgent(ownerId, agentId);
        return { ownerId, agentId };
      };
      const a = seat("Aegis", "Bastion Relay"), b = seat("Null", "Static Vesper");
      let n = 0, checked = 0;
      for (const main of [null, STARTER_BOASTS.Swarm.itemId]) {
        for (const close of [null, STARTER_BOASTS.Cortex.itemId]) {
          store.setLoadout(a.ownerId, a.agentId, "boast", main);
          store.setLoadout(a.ownerId, a.agentId, "closeWinBoast", close);
          for (const health of [3, 5, 6, 18]) {
            clock = new Date(clock.getTime() + 60_000);
            const matchId = `preview-check-${++n}`;
            const live = store.startMatch({ matchId, p1OwnerId: a.ownerId, p2OwnerId: b.ownerId });
            const rec = store.recordMatch({
              matchId, seed: n, p1AgentId: live.p1.agentId, p2AgentId: live.p2.agentId, p1DeckId: live.p1.deck.deckId, p2DeckId: live.p2.deck.deckId,
              outcome: { kind: "win", winnerAgentId: a.agentId }, turns: 12, moves: 80, finalHealth: { p1: health, p2: 0 }, endedAt: clock.toISOString(),
            });
            const state = { ...empty(), boast: main, closeWinBoast: close };
            const p = loadoutPreview(state, health <= page.data.closeWinHealth ? "closeWinBoast" : "boast", "Aegis", starters)!;
            expect(rec.boast).not.toBeNull();
            expect({ id: rec.boast!.itemId, close: rec.boast!.slot === "closeWinBoast" }).toEqual(p);
            checked++;
          }
        }
      }
      expect(checked).toBe(16);
    } finally {
      store.close();
    }
  });
});

describe("the page's data, from real store states", () => {
  it("has the three scenarios, each with all five slots and an answer for every choice", () => {
    const { data } = page;
    expect(data.scenarios.map((s) => s.key)).toEqual(LOADOUT_SCENARIOS.map((s) => s.key));
    for (const sc of data.scenarios) {
      expect(sc.slots.map((v) => v.slot)).toEqual([...LOADOUT_SLOTS]);
      for (const v of sc.slots) {
        const kindItems = COSMETICS.filter((i) => i.kind === SLOT_KIND[v.slot]).map((i) => i.itemId);
        expect(Object.keys(sc.outcomes[v.slot]).sort()).toEqual(["", ...kindItems].sort());
        // Every tile offered has the store's answer; the empty tile is last.
        for (const t of v.tiles) expect(sc.outcomes[v.slot][t.itemId ?? ""]).toBeDefined();
        expect(v.tiles[v.tiles.length - 1]!.itemId).toBeNull();
      }
    }
  });

  it("shows the owner's items as owned, an unowned item on sale as locked with its price, and nothing else", () => {
    const [fresh, bought, live] = page.data.scenarios;
    const boastTiles = (sc: typeof fresh) => sc!.slots[0]!.tiles;
    expect(boastTiles(fresh).filter((t) => t.itemId && t.owned).map((t) => t.itemId)).toEqual(["Aegis", "Swarm", "Null", "Cortex"].map((f) => STARTER_BOASTS[f as "Aegis"].itemId));
    expect(boastTiles(fresh).filter((t) => !t.owned).map((t) => [t.itemId, t.priceCredits])).toEqual([[BOOT, 300], ["boast-s0-dial-up-fireworks", 300]]);
    const boot = boastTiles(bought).find((t) => t.itemId === BOOT)!;
    expect(boot).toMatchObject({ owned: true, source: "purchase", priceCredits: null });
    expect(bought!.credits).toBeLessThan(300);
    expect(page.built[1]!.earned.matches).toBeGreaterThan(0);
    // No card backs, avatars or arenas exist: just the empty tile.
    for (const sc of [fresh, bought, live]) for (const v of sc!.slots.slice(2)) expect(v.tiles.map((t) => t.itemId)).toEqual([null]);
    // The store's own loadouts.
    expect(fresh!.loadout.boast).toBe(STARTER_BOASTS.Null.itemId);
    expect(bought!.loadout).toMatchObject({ boast: BOOT, closeWinBoast: STARTER_BOASTS.Cortex.itemId });
  });

  it("carries the store's refusals: an unowned item, and every change during a live match", () => {
    const [fresh, , live] = page.data.scenarios;
    expect(fresh!.outcomes.boast[BOOT]).toEqual({ ok: false, error: 'the owner doesn\'t own "Boot Sequence"' });
    expect(fresh!.outcomes.boast[STARTER_BOASTS.Aegis.itemId]).toEqual({ ok: true, value: STARTER_BOASTS.Aegis.itemId });
    expect(live!.live).not.toBeNull();
    for (const slot of LOADOUT_SLOTS) for (const o of Object.values(live!.outcomes[slot])) expect(o).toEqual({ ok: false, error: "no loadout changes during a live match" });
  });

  it("can draw every boast it offers, and has an emblem for each", () => {
    for (const sc of page.data.scenarios) {
      for (const v of sc.slots.slice(0, 2)) {
        for (const t of v.tiles) {
          const p = loadoutTilePreview(sc.loadout, v.slot, t.itemId, sc.agent.deckFaction, page.data.starters)!;
          expect(BOAST_SPECS[p.id], p.id).toBeDefined();
          if (t.itemId) expect(LOADOUT_GLYPHS[t.itemId], t.itemId).toBeDefined();
        }
      }
      expect(sc.cards.length).toBe(6);
    }
  });

  it("builds the same page every run", async () => {
    const again = await buildLoadoutPage();
    expect(renderLoadoutHtml(again.data)).toBe(renderLoadoutHtml(page.data));
  }, 180_000);

  it("embeds the data and the replay's boast player in one self-contained page", () => {
    const html = renderLoadoutHtml(page.data);
    expect(html).toContain('id="loadout-data"');
    expect(html).toContain("var BOAST = (function (SND) {");
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    const json = html.match(/<script type="application\/json" id="loadout-data">([\s\S]*?)<\/script>/)![1]!;
    expect(JSON.parse(json).scenarios.length).toBe(3);
  });
});

describe("the page's answers compose like the real store", () => {
  // The store's slots are independent, so the page's per-choice answers,
  // applied in any order, must end where the real store ends.
  const stores: Awaited<ReturnType<typeof openScenarioStore>>[] = [];
  afterAll(() => stores.forEach((s) => s.store.close()));

  for (const spec of LOADOUT_SCENARIOS) {
    it(`agrees with the store over 300 random choices: ${spec.key}`, async () => {
      const s = await openScenarioStore(spec);
      stores.push(s);
      const outcomes = outcomesFor(s.store, s.ownerId, s.agentId);
      let model = s.store.loadout(s.agentId) as Record<PickerSlot, string | null>;
      const r = rng(36 + spec.key.length);
      let accepted = 0, refused = 0;
      for (let step = 0; step < 300; step++) {
        const slot = LOADOUT_SLOTS[Math.floor(r() * LOADOUT_SLOTS.length)] as LoadoutSlot;
        const kindItems = COSMETICS.filter((i) => i.kind === SLOT_KIND[slot]).map((i) => i.itemId);
        const choices: (string | null)[] = [null, ...kindItems];
        const choice = choices[Math.floor(r() * choices.length)]!;
        const m = loadoutApply(model, slot, choice, outcomes);
        let storeOk = true;
        try {
          s.store.setLoadout(s.ownerId, s.agentId, slot, choice);
        } catch (err) {
          if (!(err instanceof EconomyError)) throw err;
          storeOk = false;
          expect(m.error).toBe(err.message);
        }
        expect(m.ok).toBe(storeOk);
        model = m.state;
        expect(model).toEqual(s.store.loadout(s.agentId));
        if (storeOk) accepted++; else refused++;
      }
      if (spec.live) expect(accepted).toBe(0);
      else expect(accepted).toBeGreaterThan(100);
      if (spec.key !== "bought") expect(refused).toBeGreaterThan(0);
    }, 180_000);
  }
});
