// Builds the self-contained loadout picker page (render/output/loadout-picker.html)
// from REAL store states (victory boasts, slice 4; render session 36). Each
// scenario is its own in-memory economy store on a fixed clock:
//
//   new     a Null owner with only the starter collection: the four free
//           starter boasts, Void Collapse equipped (the store's default for
//           a new agent), the two Season 0 boasts locked "in the store".
//   bought  a Cortex owner that earned 300 credits in real matches (the
//           engine's Lookahead agents, through startMatch / recordMatch,
//           a day at a time), bought Boot Sequence, wears it as its victory
//           boast and Data Cascade as its close-win boast; Dial-Up Fireworks
//           stays locked, with what the owner has left.
//   live    a Swarm owner in a live match (startMatch, not yet recorded):
//           the store refuses every change, and the page shows its answer.
//
// For every choice the page offers in every slot (each catalogue item of
// the slot's kind, and the empty slot) the real store's setLoadout is
// called, its answer kept (the slot's new value or its refusal message),
// and the slot put back. The page applies those answers; it never decides
// one itself.
//
//   npm run loadout -w @ai-tcg/render
//
// Also writes a transcript (each scenario's state and every answer) for the
// evidence folder: progress/render/evidence/loadout-picker-s36.txt.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runMatch } from "@ai-tcg/engine";
import type { DeckSpec } from "@ai-tcg/engine";
import { CLOSE_WIN_HEALTH, EconomyError, EconomyStore, LOADOUT_SLOTS, SLOT_KIND, STARTER_BOASTS, type LoadoutSlot } from "@ai-tcg/economy";
import { LookaheadAgent, type DeckFaction } from "./engineInternal.js";
import { loadoutSlotText, renderLoadoutHtml, type LoadoutPageData, type PickerCard, type PickerOutcome, type PickerScenario, type PickerSlotView, type PickerTile } from "./loadoutPicker.js";

const START = Date.parse("2026-10-20T09:00:00.000Z");
const DAY_MS = 86_400_000;
const MATCHES_PER_DAY = 10;
const FACTION_ORDER: DeckFaction[] = ["Aegis", "Swarm", "Null", "Cortex"];

const SLOT_TEXT = loadoutSlotText(CLOSE_WIN_HEALTH);

export interface LoadoutScenarioSpec {
  key: string;
  label: string;
  faction: DeckFaction;
  agent: string;
  /** The opponent's faction (earning matches and the preview's other side). */
  foe: DeckFaction;
  buy?: string[];
  loadout?: Partial<Record<LoadoutSlot, string | null>>;
  /** Leave the owner in a live match. */
  live?: boolean;
}

export const LOADOUT_SCENARIOS: readonly LoadoutScenarioSpec[] = [
  { key: "new", label: "A new owner", faction: "Null", agent: "Static Vesper", foe: "Aegis" },
  {
    key: "bought",
    label: "Bought Boot Sequence",
    faction: "Cortex",
    agent: "Quillon Array",
    foe: "Swarm",
    buy: ["boast-s0-boot-sequence"],
    loadout: { boast: "boast-s0-boot-sequence", closeWinBoast: STARTER_BOASTS.Cortex.itemId },
  },
  { key: "live", label: "In a live match", faction: "Swarm", agent: "Brood Signal", foe: "Cortex", loadout: { closeWinBoast: STARTER_BOASTS.Aegis.itemId }, live: true },
];

export interface BuiltScenario {
  scenario: PickerScenario;
  /** The real matches played to earn the purchases. */
  earned: { matches: number; wins: number; credits: number };
}

export interface ScenarioStore {
  store: EconomyStore;
  ownerId: string;
  agentId: string;
  deckId: string;
  live: PickerScenario["live"];
  matches: number;
  wins: number;
  earnedCredits: number;
  cost: number;
}

/** Plays one scenario's history through a fresh in-memory store and returns
 * it open (the caller closes it). */
export async function openScenarioStore(spec: LoadoutScenarioSpec): Promise<ScenarioStore> {
  let clock = new Date(START);
  const store = EconomyStore.open(":memory:", { now: () => clock });
  try {
    const seat = (faction: DeckFaction, agentName: string, owner: string) => {
      const ownerId = store.createOwner({ name: owner }).ownerId;
      const { copies } = store.grantStarterCollection(ownerId, faction);
      const agentId = store.createAgent({ ownerId, name: agentName }).agentId;
      const deck = store.saveDeck(ownerId, `${faction} starter`, copies.map((c) => c.copyId));
      store.setActiveDeck(ownerId, deck.deckId);
      store.connectAgent(ownerId, agentId);
      return { ownerId, agentId, deckId: deck.deckId };
    };
    const me = seat(spec.faction, spec.agent, `loadout-${spec.key}-owner`);
    const needsFoe = (spec.buy?.length ?? 0) > 0 || spec.live;
    const foe = needsFoe ? seat(spec.foe, "Sparring Partner", `loadout-${spec.key}-foe`) : null;

    // Earn the purchases in real matches.
    const price = (itemId: string) => store.cosmeticsCatalogue().find((i) => i.itemId === itemId)?.priceCredits ?? 0;
    const cost = (spec.buy ?? []).reduce((n, id) => n + price(id), 0);
    let matches = 0, wins = 0;
    for (let day = 0; foe && store.balance(me.ownerId) < cost; day++) {
      if (day > 30) throw new Error(`${spec.key}: ${cost} credits not earned in 30 days`);
      for (let n = 0; n < MATCHES_PER_DAY && store.balance(me.ownerId) < cost; n++) {
        clock = new Date(START + day * DAY_MS + n * 600_000);
        const matchId = `loadout-${spec.key}-earn-${String(matches + 1).padStart(3, "0")}`;
        const live = store.startMatch({ matchId, p1OwnerId: me.ownerId, p2OwnerId: foe.ownerId });
        const seed = 36_000 + matches + 1;
        const a: DeckSpec = { ...live.p1.deck.spec, id: "p1" };
        const b: DeckSpec = { ...live.p2.deck.spec, id: "p2" };
        const result = await runMatch(a, b, new LookaheadAgent(spec.agent, seed * 2 + 1), new LookaheadAgent("Sparring Partner", seed * 2 + 2), seed);
        const w = result.state.winner;
        if (w === "p1") wins++;
        store.recordMatch({
          matchId,
          seed,
          p1AgentId: live.p1.agentId,
          p2AgentId: live.p2.agentId,
          p1DeckId: live.p1.deck.deckId,
          p2DeckId: live.p2.deck.deckId,
          outcome: w === "p1" || w === "p2" ? { kind: "win", winnerAgentId: live[w].agentId } : { kind: "draw" },
          turns: result.state.turnNumber,
          moves: result.movesPlayed,
          finalHealth: { p1: result.state.players.p1.health, p2: result.state.players.p2.health },
          endedAt: clock.toISOString(),
        });
        matches++;
      }
    }
    const earnedCredits = store.balance(me.ownerId);
    for (const id of spec.buy ?? []) store.buyCosmetic(me.ownerId, id);
    for (const [slot, itemId] of Object.entries(spec.loadout ?? {})) store.setLoadout(me.ownerId, me.agentId, slot as LoadoutSlot, itemId ?? null);
    clock = new Date(clock.getTime() + 3_600_000);
    let live: PickerScenario["live"] = null;
    if (spec.live && foe) {
      const m = store.startMatch({ matchId: `loadout-${spec.key}-live`, p1OwnerId: me.ownerId, p2OwnerId: foe.ownerId });
      live = { matchId: m.matchId, startedAt: store.liveMatchOf(me.ownerId)!.startedAt };
    }
    clock = new Date(clock.getTime() + 600_000);
    return { store, ownerId: me.ownerId, agentId: me.agentId, deckId: me.deckId, live, matches, wins, earnedCredits, cost };
  } catch (err) {
    store.close();
    throw err;
  }
}

/** Plays one scenario through a fresh in-memory store. */
export async function buildScenario(spec: LoadoutScenarioSpec): Promise<BuiltScenario> {
  const { store, ownerId, agentId, deckId, live, matches, wins, earnedCredits, cost } = await openScenarioStore(spec);
  const me = { ownerId, agentId, deckId };
  try {
    const loadout = store.loadout(me.agentId);
    const outcomes = outcomesFor(store, me.ownerId, me.agentId);
    const after = store.loadout(me.agentId);
    if (JSON.stringify(after) !== JSON.stringify(loadout)) throw new Error(`${spec.key}: asking the store changed the loadout`);

    const owned = new Map(store.ownedCosmetics(me.ownerId).map((c) => [c.itemId, c]));
    const onSale = new Map(store.cosmeticsOnSale(me.ownerId).map((i) => [i.itemId, i]));
    const catalogue = store.cosmeticsCatalogue();
    const slots: PickerSlotView[] = LOADOUT_SLOTS.map((slot) => {
      const kind = SLOT_KIND[slot];
      const items = catalogue
        .filter((i) => i.kind === kind && (owned.has(i.itemId) || onSale.has(i.itemId)))
        .sort((x, y) => rank(x) - rank(y));
      function rank(i: (typeof catalogue)[number]): number {
        const o = owned.has(i.itemId) ? 0 : 100;
        const s = i.season === "standard" ? FACTION_ORDER.indexOf(i.faction as DeckFaction) : 10;
        return o + s;
      }
      const tiles: PickerTile[] = items.map((i) => ({
        itemId: i.itemId,
        name: i.name,
        faction: i.faction,
        season: i.season,
        owned: owned.has(i.itemId),
        source: owned.get(i.itemId)?.source ?? null,
        priceCredits: owned.has(i.itemId) ? null : i.priceCredits,
        description: i.description,
      }));
      if (kind === "boast") {
        const starter = STARTER_BOASTS[spec.faction];
        tiles.push({
          itemId: null,
          name: "Empty",
          faction: null,
          season: null,
          owned: true,
          source: null,
          priceCredits: null,
          description: slot === "boast" ? `A win plays the starter boast of the faction the deck plays (${spec.faction}: ${starter.name}).` : "A close win plays the victory boast.",
        });
      } else {
        tiles.push({ itemId: null, name: "Empty", faction: null, season: null, owned: true, source: null, priceCredits: null, description: "Nothing equipped." });
      }
      return { slot, ...SLOT_TEXT[slot], tiles };
    });

    const deck = store.loadDeck(me.deckId);
    const seen = new Set<string>();
    const cards: PickerCard[] = deck.spec.cards
      .filter((c) => c.type === "Unit" && !seen.has(c.id) && seen.add(c.id))
      .sort((x, y) => x.cost - y.cost || x.name.localeCompare(y.name))
      .slice(0, 6)
      .map((c) => ({ name: c.name, cost: c.cost, attack: c.type === "Unit" ? c.attack : null, health: c.type === "Unit" ? c.health : null }));

    const note = spec.live
      ? `A ${spec.faction} owner with the starter collection, its close-win slot set to Aegis's free Shield Slam, now in a live match against a ${spec.foe} agent.`
      : spec.buy?.length
        ? `A ${spec.faction} owner that earned ${earnedCredits} credits in ${matches} real matches (${wins} won) against a ${spec.foe} agent, bought ${spec.buy.map((id) => catalogue.find((i) => i.itemId === id)!.name).join(" and ")} for ${cost}, and wears it.`
        : `A ${spec.faction} owner with only the starter collection: the four free starter boasts, its faction's equipped by the store.`;
    return {
      scenario: {
        key: spec.key,
        label: spec.label,
        note,
        agent: { name: store.getAgent(me.agentId).name, deckFaction: spec.faction },
        credits: store.balance(me.ownerId),
        live,
        loadout,
        slots,
        outcomes,
        cards,
        foeFaction: spec.foe,
      },
      earned: { matches, wins, credits: earnedCredits },
    };
  } finally {
    store.close();
  }
}

/** Puts every choice of every slot to the store, keeps each answer, and puts
 * the slot back. */
export function outcomesFor(store: EconomyStore, ownerId: string, agentId: string): PickerScenario["outcomes"] {
  const base = store.loadout(agentId);
  const catalogue = store.cosmeticsCatalogue();
  const out = {} as PickerScenario["outcomes"];
  for (const slot of LOADOUT_SLOTS) {
    out[slot] = {};
    const choices: (string | null)[] = [null, ...catalogue.filter((i) => i.kind === SLOT_KIND[slot]).map((i) => i.itemId)];
    for (const choice of choices) {
      let answer: PickerOutcome;
      try {
        answer = { ok: true, value: store.setLoadout(ownerId, agentId, slot, choice)[slot] };
      } catch (err) {
        if (!(err instanceof EconomyError)) throw err;
        answer = { ok: false, error: err.message };
      }
      out[slot][choice ?? ""] = answer;
      if (store.loadout(agentId)[slot] !== base[slot]) store.setLoadout(ownerId, agentId, slot, base[slot]);
    }
  }
  return out;
}

export async function buildLoadoutPage(): Promise<{ data: LoadoutPageData; built: BuiltScenario[] }> {
  const built: BuiltScenario[] = [];
  for (const spec of LOADOUT_SCENARIOS) built.push(await buildScenario(spec));
  const starters = Object.fromEntries(Object.entries(STARTER_BOASTS).map(([f, b]) => [f, b.itemId]));
  const store = EconomyStore.open(":memory:");
  const names = Object.fromEntries(store.cosmeticsCatalogue().map((i) => [i.itemId, i.name]));
  store.close();
  return { data: { title: "Agent loadout — AI-TCG", closeWinHealth: CLOSE_WIN_HEALTH, starters, names, scenarios: built.map((b) => b.scenario) }, built };
}

export function loadoutTranscript(data: LoadoutPageData, built: BuiltScenario[]): string {
  const lines: string[] = [
    "Loadout picker (victory boasts, slice 4; render session 36): the page's data, from real store states.",
    "Every answer below is the real store's setLoadout, asked once per choice and put back. The page applies these; it decides none.",
    `Regenerate: npm run loadout -w @ai-tcg/render`,
    "",
  ];
  for (const [k, sc] of data.scenarios.entries()) {
    const b = built[k]!;
    lines.push(`== ${sc.key}: ${sc.label} ==`, sc.note);
    lines.push(`agent ${sc.agent.name} (${sc.agent.deckFaction} deck); credits ${sc.credits}${b.earned.matches ? `; earned ${b.earned.credits} in ${b.earned.matches} real matches (${b.earned.wins} won)` : ""}`);
    if (sc.live) lines.push(`live match: ${sc.live.matchId} since ${sc.live.startedAt}`);
    lines.push(`preview row: ${sc.cards.map((c) => `${c.name} (${c.cost})`).join(", ")}`);
    for (const v of sc.slots) {
      lines.push(`  [${v.label}] equipped: ${sc.loadout[v.slot] ?? "(empty)"}`);
      for (const t of v.tiles) {
        const state = t.itemId === null ? "empty tile" : t.owned ? `owned (${t.source})` : `locked: in the store, ${t.priceCredits} credits`;
        lines.push(`    - ${t.name}${t.itemId ? ` <${t.itemId}>` : ""}: ${state}`);
      }
      for (const [key, o] of Object.entries(sc.outcomes[v.slot])) {
        lines.push(`      store answer for ${key === "" ? "(empty)" : key}: ${o.ok ? `accepted -> ${o.value ?? "(empty)"}` : `refused: ${o.error}`}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n") + "\n";
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const { data, built } = await buildLoadoutPage();
  const out = resolve(here, "../output/loadout-picker.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderLoadoutHtml(data), "utf8");
  const tr = resolve(here, "../../progress/render/evidence/loadout-picker-s36.txt");
  writeFileSync(tr, loadoutTranscript(data, built), "utf8");
  console.log(`Wrote ${out}\nWrote ${tr}`);
}
