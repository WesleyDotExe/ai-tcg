// The loadout picker on the website (render session 49): the Store page's
// "Your agents" panel and the data the full-screen picker is handed.
//
// The picker is the standalone page (loadoutPicker.ts) in its site mode,
// framed like the pack opening. It never decides what the server accepts:
// Equip is `PUT /api/agents/:agentId/loadout/:slot` and the page shows the
// loadout the server answers with (or its refusal); Buy is the Store's own
// `POST /api/store/cosmetics/:itemId/buy`. This file only turns the API's
// answers into what the page draws, and is pure (Node tests run it on real
// owner-API answers).
//
// Read from the API: the agent's loadout (`GET /api/agents/:id/loadout`:
// what is equipped, the owned items that fit each slot, whether a live
// match locks it), the owned cosmetics (`GET /api/cosmetics`, each with its
// catalogue item), what's on sale (`GET /api/store`), the play settings
// (`GET /api/play`: the live match, the faction lock, the latest build) and
// the collection (`GET /api/collection`, for the preview row's units).
//
// One thing the API doesn't say: which faction the agent's deck plays (it
// decides what an empty victory-boast slot plays: the store's chooseBoast
// rule). The site knows it when the owner locks a faction, or when the
// latest build is the deck the agent plays; otherwise it says it can't tell
// rather than guess (raised as a game-lane ask in notes-for-owner).

import { getCard } from "@ai-tcg/engine";
// cosmetics.ts imports only a type, so it bundles on its own (the client's
// economy alias points at packs.ts; these are imported by path, like
// siteCollection.ts imports the craft prices).
import { CLOSE_WIN_HEALTH, LOADOUT_SLOTS, SLOT_KIND, type LoadoutSlot } from "../../../economy/src/cosmetics.js";
import { loadoutSlotText } from "../loadoutText.js";
import type { PickerCard, PickerScenario, PickerSitePayload, PickerSlotView, PickerTile } from "../loadoutPicker.js";
import type { SiteCollection } from "./siteBoard.js";
import type { SitePlay } from "./siteApi.js";

/** A catalogue item, as `GET /api/cosmetics` and `GET /api/store` send it. */
export interface SiteCosmeticItem {
  itemId: string;
  kind: string;
  name: string;
  season: string;
  faction: string | null;
  priceCredits: number | null;
  description: string;
}

/** One owned item (`GET /api/cosmetics`). */
export interface SiteOwnedCosmetic {
  itemId: string;
  kind: string;
  source: "starter" | "purchase";
  acquiredAt: string;
  item: SiteCosmeticItem;
}

/** `GET /api/agents/:agentId/loadout`. */
export interface SiteLoadout {
  agentId: string;
  loadout: Record<LoadoutSlot, string | null>;
  slots: { slot: LoadoutSlot; kind: string; itemId: string | null; choices: string[] }[];
  locked: boolean;
}

const FACTION_ORDER = ["Aegis", "Swarm", "Null", "Cortex"];

/** The faction the agent's deck plays, when the site can tell: the latest
 * build's, when that build is the deck the agent plays; else the faction
 * lock (the agent builds only in it). Null otherwise. */
export function deckFactionOf(play: SitePlay): string | null {
  const playing = play.activeDeck?.deckId ?? null;
  const r = play.rebuild.job?.result;
  if (r && playing && r.deckId === playing) return r.faction;
  return play.factionLock ?? null;
}

/** The owner's starting faction: the faction of its starter copies (the
 * starter collection is one faction's). Null when it holds none. */
export function starterFactionOf(c: SiteCollection): string | null {
  const n = new Map<string, number>();
  for (const card of c.cards) {
    const starters = card.copies.filter((k) => (k as { origin?: string }).origin === "starter").length;
    if (starters && card.faction) n.set(card.faction, (n.get(card.faction) ?? 0) + starters);
  }
  let best: string | null = null;
  for (const [f, k] of n) if (best === null || k > n.get(best)!) best = f;
  return best;
}

/** The preview row: up to six of the owner's units of the faction, cheapest
 * first, one of each (decoration for the boast to play over; the API
 * doesn't list the deck's cards). */
export function previewCards(c: SiteCollection, faction: string | null): PickerCard[] {
  const out: PickerCard[] = [];
  const units = c.cards
    .filter((k) => k.owned > 0 && (faction === null || k.faction === faction))
    .map((k) => {
      try {
        return getCard(k.cardId);
      } catch {
        return null;
      }
    })
    .filter((d): d is NonNullable<typeof d> => !!d && d.type === "Unit")
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  for (const u of units) {
    if (out.length >= 6) break;
    if (u.type === "Unit") out.push({ name: u.name, cost: u.cost, attack: u.attack, health: u.health });
  }
  return out;
}

/** Each faction's starter boast (the free items of kind boast), from the
 * items the owner holds or sees. */
export function startersOf(items: SiteCosmeticItem[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of items) if (i.kind === "boast" && i.season === "standard" && i.faction && !out[i.faction]) out[i.faction] = i.itemId;
  return out;
}

export interface LoadoutInputs {
  agent: { agentId: string; name: string };
  loadout: SiteLoadout;
  owned: SiteOwnedCosmetic[];
  /** `GET /api/store`'s cosmetics: on sale now, with `owned`. */
  onSale: (SiteCosmeticItem & { owned: boolean })[];
  play: SitePlay;
  collection: SiteCollection;
  credits: number;
}

/** The page's data for one agent, from the API's answers. The tiles of a
 * slot: the owned items the server lists as its choices (the starters by
 * faction, then the rest), the items on sale the owner doesn't have
 * (locked, with Buy), and the empty tile. */
export function loadoutPayload(x: LoadoutInputs): PickerSitePayload {
  const text = loadoutSlotText(CLOSE_WIN_HEALTH);
  const ownedBy = new Map(x.owned.map((o) => [o.itemId, o]));
  const items = new Map<string, SiteCosmeticItem>();
  for (const o of x.owned) items.set(o.itemId, o.item);
  for (const s of x.onSale) if (!items.has(s.itemId)) items.set(s.itemId, s);
  const all = [...items.values()];
  const starters = startersOf(all);
  const names = Object.fromEntries(all.map((i) => [i.itemId, i.name]));
  const deckFaction = deckFactionOf(x.play);
  const rowFaction = deckFaction ?? starterFactionOf(x.collection);
  const rank = (i: SiteCosmeticItem, owned: boolean) => (owned ? 0 : 100) + (i.season === "standard" ? Math.max(0, FACTION_ORDER.indexOf(i.faction ?? "")) : 10);

  const slots: PickerSlotView[] = LOADOUT_SLOTS.map((slot) => {
    const kind = SLOT_KIND[slot];
    const server = x.loadout.slots.find((s) => s.slot === slot);
    const choices = new Set(server?.choices ?? []);
    const ownedTiles = [...choices].map((id) => items.get(id)).filter((i): i is SiteCosmeticItem => !!i);
    const lockedTiles = x.onSale.filter((s) => s.kind === kind && !s.owned && !choices.has(s.itemId));
    const sorted = [...ownedTiles.map((i) => ({ i, owned: true })), ...lockedTiles.map((i) => ({ i, owned: false }))].sort(
      (a, b) => rank(a.i, a.owned) - rank(b.i, b.owned) || a.i.name.localeCompare(b.i.name),
    );
    const tiles: PickerTile[] = sorted.map(({ i, owned }) => ({
      itemId: i.itemId,
      name: i.name,
      faction: i.faction,
      season: i.season,
      owned,
      source: owned ? (ownedBy.get(i.itemId)?.source ?? null) : null,
      priceCredits: owned ? null : i.priceCredits,
      description: i.description,
    }));
    const starter = deckFaction ? items.get(starters[deckFaction] ?? "") : undefined;
    tiles.push({
      itemId: null,
      name: "Empty",
      faction: null,
      season: null,
      owned: true,
      source: null,
      priceCredits: null,
      description:
        slot === "boast"
          ? starter
            ? `A win plays the starter boast of the faction the deck plays (${deckFaction}: ${starter.name}).`
            : "A win plays the starter boast of the faction the deck plays (no deck is built yet)."
          : slot === "closeWinBoast"
            ? "A close win plays the victory boast."
            : "Nothing equipped.",
    });
    return { slot, ...text[slot], tiles };
  });

  const live = x.play.liveMatch ?? (x.loadout.locked ? { matchId: "", startedAt: "" } : null);
  const isConnected = x.play.connectedAgent?.agentId === x.agent.agentId;
  const note = [
    isConnected ? "Your connected agent: its matches play what's equipped here." : "Not connected: what's equipped here plays once you connect this agent.",
    deckFaction ? `Its deck plays ${deckFaction}.` : "It hasn't built a deck yet, so an empty victory-boast slot can't be shown.",
    "Equip saves to the server at once.",
  ].join(" ");
  const scenario: PickerScenario = {
    key: x.agent.agentId,
    label: x.agent.name,
    note,
    agent: { name: x.agent.name, deckFaction, ...(rowFaction ? { rowFaction } : {}) },
    credits: x.credits,
    live,
    loadout: { ...x.loadout.loadout },
    slots,
    outcomes: {} as PickerScenario["outcomes"],
    cards: previewCards(x.collection, rowFaction),
    foeFaction: FACTION_ORDER.find((f) => f !== rowFaction) ?? "Aegis",
  };
  return { scenario, starters, names };
}

/** The Store's "Your agents" rows: each agent, connected first, with what
 * its two boast slots play. */
export interface AgentLoadoutRow {
  agentId: string;
  name: string;
  connected: boolean;
  boast: string;
  closeWin: string;
  /** The other slots that hold something (none can yet in Season 0). */
  others: number;
}

export function agentLoadoutRows(play: SitePlay, loadouts: Record<string, SiteLoadout | undefined>, names: Record<string, string>): AgentLoadoutRow[] {
  const connected = play.connectedAgent?.agentId ?? null;
  const deckFaction = deckFactionOf(play);
  const nm = (id: string | null) => (id ? (names[id] ?? id) : null);
  return [...play.agents]
    .sort((a, b) => Number(b.agentId === connected) - Number(a.agentId === connected))
    .map((a) => {
      const l = loadouts[a.agentId]?.loadout;
      const boast = l ? (nm(l.boast) ?? `Empty: plays ${deckFaction ? `${deckFaction}'s starter` : "the deck's starter"}`) : "…";
      const closeWin = l ? (nm(l.closeWinBoast) ?? "Empty: plays the victory boast") : "…";
      const others = l ? (["cardBack", "avatar", "arena"] as const).filter((k) => l[k] !== null).length : 0;
      return { agentId: a.agentId, name: a.name, connected: a.agentId === connected, boast, closeWin, others };
    });
}
