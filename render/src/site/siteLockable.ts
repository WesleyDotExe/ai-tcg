// Render session 76: the faction lock, marked buildable or not (owner
// 2026-11-14, the answer (a) to game session 99's call).
//
// Packs hold only booster cards now (7 per faction), so an owner can lock a
// faction they don't hold enough cards for: the ladder then sits the agent
// out every round ("the agent's deck couldn't be rebuilt: ... at most 19
// usable cards, under 20"). The owner's answer: the API marks each lockable
// faction as buildable or not, with the cards held and needed, and the site
// greys out the ones that can't be built yet. The lock itself stays allowed.
//
// The server's field (`GET /api/play`'s `lockable`, the game lane's half) is
// read when it is there. Until it is, the site works the same answer out
// from the owner's collection with the engine's own rule, `largestDeck`,
// the function the store checks every agent deck against
// (`economy/src/store.ts` `buildAgentDeck`): the same cards
// (`holdingsOf(collection)`), the same answer. A test pins the two together
// on the real store.
//
// "Craft N more" is a plan, not just a count: the cheapest crafts (Standard
// copies, by the economy's crafting prices) from the faction's own starter
// list that each raise the largest deck by one, which is what game session
// 99's demos had to do by hand. A starter card is always crafted Standard
// (owner 2026-11-14: starter cards are Standard only), so the plan never
// names a booster card's chase version.
import { getCard, largestDeck, SHIPPED_DECK_LISTS, type DeckFaction, type Rarity } from "@ai-tcg/engine";
// MIN_DECK_SIZE isn't in the engine's barrel; by path, as siteCollection
// imports the economy's config.
import { MIN_DECK_SIZE } from "../../../engine/src/data/decks.js";
import { CRAFT_PACK_POINTS } from "../../../economy/src/config.js";
import type { SiteFaction } from "./siteApi.js";
import type { SiteCollection } from "./siteBoard.js";
import { esc } from "./siteModel.js";

/** One lockable faction as the server will send it (the shape asked of the
 * game lane, `progress/render/notes-for-owner.md`, session 76): whether a
 * deck can be built now, the most cards one can hold from the cards held,
 * and the fewest a deck needs. */
export interface SiteLockable {
  faction: SiteFaction;
  buildable: boolean;
  cards: number;
  needed: number;
}

/** One craft in the plan: a card, how many copies, their price. */
export interface CraftStep {
  cardId: string;
  name: string;
  rarity: Rarity;
  copies: number;
  packPoints: number;
}

export interface LockableView {
  faction: SiteFaction;
  buildable: boolean;
  /** The most cards a deck of this faction can hold from the cards held. */
  cards: number;
  /** The fewest a deck needs (20). */
  needed: number;
  /** How many more usable cards; 0 when buildable. */
  short: number;
  /** Where the answer came from: the server's field, or the site's own
   * reading of the collection with the engine's rule. */
  source: "server" | "collection";
  /** The cheapest crafts from the faction's starter list that reach a deck
   * (empty when buildable, or when the server's answer came without the
   * collection to plan from). */
  plan: CraftStep[];
  /** The plan's total price in pack points. */
  planPackPoints: number;
  /** False when the starter list alone can't make up the gap (no plan
   * reaches `needed`; never seen with Season 0's lists, but said, not
   * hidden). */
  planReaches: boolean;
  /** The largest deck after the plan. */
  planSize: number;
}

/** The owner's cards as the engine's builder counts them: copies per card
 * id, every copy (the store's `holdingsOf(collection)`). */
export function holdingsFromCollection(c: SiteCollection): Map<string, number> {
  const out = new Map<string, number>();
  for (const card of c.cards) if (card.owned > 0 && getCard(card.cardId)) out.set(card.cardId, (out.get(card.cardId) ?? 0) + card.owned);
  return out;
}

/** The cheapest crafts that take `faction`'s largest deck to `needed`:
 * each step adds one Standard copy of the cheapest starter-list card (of
 * this faction's list, short of its listed copies) that raises the largest
 * deck by one. Ties go to the list's order. */
export function craftPlan(faction: DeckFaction, holdings: ReadonlyMap<string, number>, needed = MIN_DECK_SIZE): { plan: CraftStep[]; packPoints: number; reaches: boolean; size: number } {
  const held = new Map(holdings);
  const list = SHIPPED_DECK_LISTS[faction];
  const steps = new Map<string, CraftStep>();
  let size = largestDeck(faction, held);
  for (let guard = 0; size < needed && guard < 60; guard++) {
    let best: { cardId: string; price: number; size: number } | null = null;
    for (const e of list) {
      if ((held.get(e.cardId) ?? 0) >= e.copies) continue;
      const card = getCard(e.cardId);
      if (!card) continue;
      const price = CRAFT_PACK_POINTS[card.rarity];
      if (best && price >= best.price) continue;
      const trial = new Map(held);
      trial.set(e.cardId, (trial.get(e.cardId) ?? 0) + 1);
      const s = largestDeck(faction, trial);
      if (s > size) best = { cardId: e.cardId, price, size: s };
    }
    if (!best) break;
    held.set(best.cardId, (held.get(best.cardId) ?? 0) + 1);
    size = best.size;
    const card = getCard(best.cardId)!;
    const was = steps.get(best.cardId);
    steps.set(best.cardId, { cardId: best.cardId, name: card.name, rarity: card.rarity, copies: (was?.copies ?? 0) + 1, packPoints: (was?.packPoints ?? 0) + best.price });
  }
  const plan = [...steps.values()];
  return { plan, packPoints: plan.reduce((s, x) => s + x.packPoints, 0), reaches: size >= needed, size };
}

/** Each lockable faction, buildable or not: the server's `lockable` when it
 * sends one, else the collection read with the engine's rule. Null when
 * neither is in hand yet (the lock is drawn as it always was). */
export function lockableView(
  play: { lockableFactions: SiteFaction[]; lockable?: SiteLockable[] | null },
  collection: SiteCollection | null,
): LockableView[] | null {
  const holdings = collection ? holdingsFromCollection(collection) : null;
  const fromServer = play.lockable ?? null;
  if (!fromServer && !holdings) return null;
  return play.lockableFactions.map((faction) => {
    const s = fromServer?.find((x) => x.faction === faction);
    const needed = s?.needed ?? MIN_DECK_SIZE;
    const cards = s ? s.cards : largestDeck(faction, holdings!);
    const buildable = s ? s.buildable : cards >= needed;
    const p = !buildable && holdings ? craftPlan(faction, holdings, needed) : { plan: [], packPoints: 0, reaches: buildable, size: cards };
    return { faction, buildable, cards, needed, short: buildable ? 0 : Math.max(1, needed - cards), source: s ? "server" : "collection", plan: p.plan, planPackPoints: p.packPoints, planReaches: p.reaches, planSize: p.size };
  });
}

/** "a" or "an" before a faction's name (an Aegis deck, a Null deck). */
const article = (word: string) => (/^[AEIOU]/.test(word) ? "an" : "a");

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The badge beside a greyed faction: "17/20". */
export function lockBadge(v: LockableView): string {
  return `${v.cards}/${v.needed}`;
}

/** The button's accessible name. */
export function lockAriaLabel(v: LockableView): string {
  return v.buildable ? v.faction : `${v.faction}: can't build a deck yet, ${v.cards} of ${v.needed} cards`;
}

/** The plan in words: "Aegis Cadet ×2 and Signal Booster (160 pack points)". */
export function planText(v: LockableView): string {
  if (!v.plan.length) return "";
  const parts = v.plan.map((s) => (s.copies > 1 ? `${s.name} ×${s.copies}` : s.name));
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${list} (${v.planPackPoints} pack points)`;
}

/** One faction that can't be built, in a sentence: what it needs and the
 * cheapest way there. `named` puts the faction first ("Aegis: ..."), for a
 * line that doesn't already name it. */
export function shortLine(v: LockableView, named = true): string {
  const head = `${named ? `${v.faction}: your` : "Your"} cards make at most ${v.cards} of the ${v.needed} a deck needs, so craft at least ${plural(v.short, "more card")}`;
  if (!v.plan.length) return `${head}.`;
  return v.planReaches ? `${head}. Cheapest from its starter list: ${planText(v)}.` : `${head}. Its starter list alone doesn't make up the gap: ${planText(v)} gets to ${v.planSize}.`;
}

/** What Settings says under the lock: a warning when the lock in place
 * can't be built (the agent sits out every round), else a quiet line when
 * other factions are greyed. Null when every faction can be built. */
export function lockNote(views: LockableView[] | null, lock: SiteFaction | null): { tone: "warn" | "muted"; text: string } | null {
  if (!views) return null;
  const locked = lock ? views.find((v) => v.faction === lock) : undefined;
  if (locked && !locked.buildable)
    return { tone: "warn", text: `Your agent sits out every round: it can't build ${article(locked.faction)} ${locked.faction} deck yet. ${shortLine(locked, false)} Or lock another faction.` };
  const short = views.filter((v) => !v.buildable);
  if (!short.length) return null;
  return { tone: "muted", text: `Greyed: you don't hold enough cards for a ${MIN_DECK_SIZE}-card deck yet (${short.map((v) => `${v.faction} ${lockBadge(v)}`).join(", ")}). You can still lock one; your agent sits out until you craft the rest.` };
}

/** The toast after locking a faction that can't be built (the lock is
 * kept; the server allows it). Short: the plan is in the note under the
 * lock. Null for a buildable one. */
export function lockToast(views: LockableView[] | null, faction: SiteFaction | null): string | null {
  const v = faction && views?.find((x) => x.faction === faction);
  if (!v || v.buildable) return null;
  return `Locked to ${v.faction}, but your agent sits out every round until it can build ${article(v.faction)} ${v.faction} deck: ${v.cards} of ${v.needed} cards. What to craft is under the lock.`;
}

/** The lock's segmented control: "Any" and each faction, a faction that
 * can't be built greyed (class `short`, still pressable) with its count.
 * The same `.seg` group the site's other choices use, so the click handler
 * is unchanged. Without a view (nothing read yet), plain buttons. */
export function lockSegHtml(factions: SiteFaction[], views: LockableView[] | null, value: SiteFaction | null): string {
  const btn = (v: string, label: string, view?: LockableView) => {
    const short = view && !view.buildable;
    const attrs = short ? ` class="short" aria-label="${esc(lockAriaLabel(view!))}" title="${esc(shortLine(view!))}"` : "";
    const badge = short ? `<span class="lk" aria-hidden="true">${esc(lockBadge(view!))}</span>` : "";
    return `<button type="button" data-v="${esc(v)}"${attrs} aria-pressed="${v === (value ?? "")}">${esc(label)}${badge}</button>`;
  };
  const opts = [btn("", "Any"), ...factions.map((f) => btn(f, f, views?.find((x) => x.faction === f)))];
  return `<div class="seg" id="faction-lock" role="group" aria-label="Faction lock">${opts.join("")}</div>`;
}

/** The note under the lock, as HTML (empty when there is nothing to say). */
export function lockNoteHtml(views: LockableView[] | null, lock: SiteFaction | null): string {
  const n = lockNote(views, lock);
  if (!n) return "";
  return `<p class="lock-note ${n.tone}" role="${n.tone === "warn" ? "alert" : "note"}">${esc(n.text)}${n.tone === "warn" ? ' <a href="#/collection">Open the Collection</a>' : ""}</p>`;
}
