// The first-time flow, slice 3 of the pack-opening work (owner 2026-10-18:
// "the first-time flow: an agent's first packs and the leader (signature
// card) reveal"): the data side. It runs the Season 0 sign-up exactly as the
// economy store does it, for every choice the page lets an owner make, and
// hands the page the results to play back:
//
//   1. Pick a starting faction: `grantStarterCollection` (that faction's
//      fixed starter deck as account-bound copies, plus 3 packs; owner app
//      spec A, the starter collection is once per owner).
//   2. Open the 3 starter packs: `openPack`, seeded. NEW badges depend on
//      the faction picked (a card already in the starter deck is not new),
//      so each faction's packs are opened in that faction's own store.
//   3. "Generate a new agent" (owner app spec B): `startAgentDraft` (3
//      agents), `pickDraftAgent` (3 signature cards for the one picked),
//      `confirmAgentDraft` (the agent, its card with the next PR- number, the
//      bound promo copy, the card's art-pool piece).
//
// A draft can be picked and confirmed once, so every branch (3 agents x 3
// cards) is its own fresh store replaying the same seeded calls up to its
// own choice. Same seeds, same draft: the tests check that every branch
// was shown the same 3 agents and, per agent, the same 3 cards.
//
// The one rule, as for the pack page: the page only SHOWS what the store
// returned. Nothing here rolls a pack or draws a card; the seeds are fixed
// so a run reproduces, and on the site the store draws them server-side.
// Read-only on the economy and the engine.

import { SHIPPED_DECK_LISTS, getCard, type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore, EconomyError, LIVE_PACK_ODDS, STARTER_PACKS, SIGNATURE_ART_POOL_SIZE, cardSet } from "@ai-tcg/economy";
import { avatarSvg } from "./avatar.js";
import { faceOfCard, planReveal, type CardFace, type PackReveal } from "./packOpening.js";
import { visualPatternFor, visualSeedFor } from "./cardVisual.js";

/** The order the faction picker shows them in. */
export const FIRST_TIME_FACTIONS: readonly DeckFaction[] = ["Aegis", "Cortex", "Swarm", "Null"];

/** One line each for the picker, from each faction's own card-file header
 * (engine/src/data). Proposed wording, an open detail at the checkpoint. */
export const FACTION_LINES: Record<DeckFaction, string> = {
  Aegis: "A hardened guardian network. Builds a wall, then grows it.",
  Cortex: "Networked intelligence. Reacts, redirects, controls.",
  Swarm: "Biological mass. Goes wide and keeps coming.",
  Null: "Corruption and deletion. Wins by attrition.",
};

/** The demo's fixed inputs. On the site the store draws every one of these
 * itself; here they are fixed so the page is the same every build. */
export const FIRST_TIME_SEEDS = {
  /** The owner's login username (placeholder; the generator puts it in a
   * card's name about 1 time in 100). */
  username: "first-light",
  /** The 3 starter packs, opened in order. Not searched: whatever these
   * seeds hold is what a new owner would see. */
  packs: [101, 102, 103],
  draft: 4242,
  /** Each agent's pick draws its own seed on the site; here agent k uses
   * pick + k. */
  pick: 777,
  /** The art-pool piece each confirmed card draws (1-500), per agent and
   * card, seeded from this. */
  art: 17,
} as const;

/** A card in the starter deck, folded by card. */
export interface StarterCard {
  cardId: string;
  collectorNumber: string;
  copies: number;
  face: CardFace;
}

export interface FactionStart {
  faction: DeckFaction;
  line: string;
  /** Copies granted (the deck), all account-bound. */
  deckSize: number;
  /** Rarest first. */
  cards: StarterCard[];
  /** The starter packs, as granted, then opened in order. */
  packs: { label: string; reveal: PackReveal }[];
  /** What the owner holds after the 3 packs: copies and distinct cards. */
  heldAfter: { copies: number; distinct: number };
}

/** A signature card as the pick screen shows it: no art yet (the store
 * draws the card's art-pool piece when it is confirmed, not before). */
export interface SignatureChoice {
  name: string;
  /** The generator's one-line concept: "cost 5, 3/6. When it dies, ...". */
  concept: string;
  face: CardFace;
  comboId: string;
  /** The fairness measurement this line passed (engine signatureApproved). */
  measured: { worst: number; seeds: number };
}

/** What `confirmAgentDraft` made. */
export interface MintedSignature {
  agentName: string;
  persona: string;
  cardId: string;
  collectorNumber: string;
  /** The card's face as made: the flavour line carries the agent's name,
   * and the art is the card's own art-pool piece. */
  face: CardFace;
  art: { pool: string; slot: number; of: number };
  comboId: string;
  fingerprint: string;
  copy: { copyId: string; origin: string; bound: boolean; stamp: string | null; seriesCode: string | null };
}

export interface AgentChoice {
  name: string;
  persona: string;
  /** The replay's placeholder avatar for this name (avatar.ts), so the
   * agent looks the same on its pick screen as in its matches. */
  avatar: string;
  /** The 3 signature cards this agent was offered. */
  signatures: SignatureChoice[];
  /** One per signature card: what confirming it made. */
  minted: MintedSignature[];
}

export interface FirstTimeData {
  username: string;
  setCode: string;
  oddsVersion: string;
  factions: FactionStart[];
  agents: AgentChoice[];
}

const RARITY_ORDER: Record<string, number> = { Mythic: 0, Rare: 1, Uncommon: 2, Common: 3 };
const fixedClock = () => {
  let t = new Date("2026-10-18T12:00:00.000Z").getTime();
  return () => new Date((t += 60_000));
};

/** One faction's start: a fresh owner signs up, takes that faction's
 * starter collection and opens its 3 packs. */
export function factionStart(faction: DeckFaction, seeds = FIRST_TIME_SEEDS): FactionStart {
  const store = EconomyStore.open(":memory:", { now: fixedClock() });
  try {
    const owner = store.createOwner({ name: seeds.username }).ownerId;
    const grant = store.grantStarterCollection(owner, faction);
    if (grant.packs.length !== STARTER_PACKS) throw new Error(`expected ${STARTER_PACKS} starter packs, got ${grant.packs.length}`);
    const numbers = new Map(cardSet("S0").cards.map((c) => [c.cardId, c.collectorNumber]));
    const cards = SHIPPED_DECK_LISTS[faction]
      .map(({ cardId, copies }) => ({ cardId, collectorNumber: numbers.get(cardId) ?? "", copies, face: faceOfCard(getCard(cardId)!) }))
      .sort((a, b) => RARITY_ORDER[a.face.rarity]! - RARITY_ORDER[b.face.rarity]! || (b.face.cost ?? 0) - (a.face.cost ?? 0));
    const packs = grant.packs.map((p, i) => ({
      label: `Starter pack ${i + 1} of ${grant.packs.length}`,
      reveal: planReveal(store.openPack(owner, p.packId, { seed: seeds.packs[i] })),
    }));
    const held = store.collection(owner);
    return {
      faction,
      line: FACTION_LINES[faction],
      deckSize: grant.copies.length,
      cards,
      packs,
      heldAfter: { copies: held.length, distinct: new Set(held.map((c) => c.cardId)).size },
    };
  } finally {
    store.close();
  }
}

/** The art-pool piece the demo hands `confirmAgentDraft` for one branch. */
export function demoArtSlot(agent: number, card: number, seed: number = FIRST_TIME_SEEDS.art): number {
  return ((seed * 7919 + agent * 131 + card * 37) % SIGNATURE_ART_POOL_SIZE) + 1;
}

/** "Generate a new agent", every branch: for each of the 3 agents, its 3
 * signature cards, and what confirming each one makes. */
export function agentChoices(seeds = FIRST_TIME_SEEDS): AgentChoice[] {
  // The draft the owner is shown.
  const shown = withOwner(seeds, (store, owner) => store.startAgentDraft(owner, { seed: seeds.draft }).agents);
  return shown.map((agent, a) => {
    const signatures = withOwner(seeds, (store, owner) => {
      const draft = store.startAgentDraft(owner, { seed: seeds.draft });
      return store.pickDraftAgent(owner, draft.draftId, a, { seed: seeds.pick + a }).signatures!;
    });
    const minted = signatures.map((choice, s) =>
      withOwner(seeds, (store, owner) => {
        const draft = store.startAgentDraft(owner, { seed: seeds.draft });
        const picked = store.pickDraftAgent(owner, draft.draftId, a, { seed: seeds.pick + a });
        if (draft.agents[a]!.name !== agent.name || picked.signatures![s]!.name !== signatures[s]!.name) {
          throw new Error("a branch was shown a different draft than the owner saw");
        }
        const made = store.confirmAgentDraft(owner, draft.draftId, s, { artSlot: demoArtSlot(a, s, seeds.art) });
        const sig = made.signature;
        const art = sig.art!;
        return {
          agentName: made.agent.name,
          persona: agent.persona,
          cardId: sig.cardId,
          collectorNumber: sig.collectorNumber,
          // The rules text is the card's own: since game session 45 each
          // signature ability carries its menu option's full wording.
          face: { ...faceOfCard(sig.card), ...artSeeds(sig.card.art ?? sig.cardId) },
          art: { pool: art.pool, slot: art.slot, of: SIGNATURE_ART_POOL_SIZE },
          comboId: sig.comboId,
          fingerprint: sig.fingerprint,
          copy: {
            copyId: made.copy.copyId,
            origin: made.copy.origin,
            bound: made.copy.accountBound,
            stamp: made.copy.stamp,
            seriesCode: made.copy.seriesCode,
          },
        } satisfies MintedSignature;
      }),
    );
    return {
      name: agent.name,
      persona: agent.persona,
      avatar: avatarSvg(agent.name),
      signatures: signatures.map((c, s) => ({
        name: c.name,
        concept: c.concept,
        // The pick screen's face is the confirmed card's face before its
        // flavour line is printed with the agent and before its art piece
        // is drawn: the same name, cost, stats and rules text.
        face: { ...minted[s]!.face, flavor: c.flavor, visualSeed: 0, visualPattern: 0 },
        comboId: c.comboId,
        measured: { worst: c.measured.worst, seeds: c.measured.seeds },
      })),
      minted,
    };
  });
}

/** The placeholder art follows the card's art-pool piece, not its card id:
 * two cards that drew the same piece share the picture, as the pool means
 * (owner 2026-10-16), until the art pass paints it. */
function artSeeds(artRef: string): Pick<CardFace, "visualSeed" | "visualPattern"> {
  return { visualSeed: visualSeedFor(artRef), visualPattern: visualPatternFor(artRef) };
}

function withOwner<T>(seeds: typeof FIRST_TIME_SEEDS, fn: (store: EconomyStore, owner: string) => T): T {
  const store = EconomyStore.open(":memory:", { now: fixedClock() });
  try {
    return fn(store, store.createOwner({ name: seeds.username }).ownerId);
  } finally {
    store.close();
  }
}

/** Names an owner might type on the agent screen, for the transcript: kept,
 * tidied, repeated words (allowed for typed names), and each kind of
 * refusal. */
export const SAMPLE_TYPED_NAMES: readonly string[] = [
  "", "  Bit   by Bit ", "Static Static", "Night Shift 99", "Ab", "x".repeat(33), "Neon*Fan", "-Edge", "1999", "Ok..Then", "TheRealAdmin", "Support Desk",
];

export interface TypedNameResult {
  typed: string;
  /** What confirmAgentDraft did with it: the agent's name and the card's
   * flavour line, or the store's refusal. */
  agentName?: string;
  flavor?: string;
  refused?: string;
}

/** Each typed name through the store, on agent 1's first card: a fresh
 * owner, the same draft, `confirmAgentDraft(..., { name })` (a blank field
 * passes no name, as the page does). */
export function typedNameResults(names: readonly string[] = SAMPLE_TYPED_NAMES, seeds = FIRST_TIME_SEEDS): TypedNameResult[] {
  return names.map((typed) =>
    withOwner(seeds, (store, owner) => {
      const draft = store.startAgentDraft(owner, { seed: seeds.draft });
      store.pickDraftAgent(owner, draft.draftId, 0, { seed: seeds.pick });
      try {
        const made = store.confirmAgentDraft(owner, draft.draftId, 0, { artSlot: demoArtSlot(0, 0, seeds.art), ...(typed.trim() ? { name: typed } : {}) });
        return { typed, agentName: made.agent.name, flavor: made.signature.card.flavor ?? "" };
      } catch (err) {
        if (err instanceof EconomyError) return { typed, refused: err.message };
        throw err;
      }
    }),
  );
}

export function firstTimeData(seeds = FIRST_TIME_SEEDS): FirstTimeData {
  return {
    username: seeds.username,
    setCode: "S0",
    oddsVersion: LIVE_PACK_ODDS.version,
    factions: FIRST_TIME_FACTIONS.map((f) => factionStart(f, seeds)),
    agents: agentChoices(seeds),
  };
}

export function firstTimeTranscript(d: FirstTimeData): string {
  const lines = [
    "First-time flow (render session 28): Season 0 sign-up through the economy store, every branch.",
    `Username "${d.username}", odds ${d.oddsVersion}. * = a hit (Full Art or better).`,
    "",
  ];
  for (const f of d.factions) {
    const mythics = f.cards.filter((c) => c.face.rarity === "Mythic").map((c) => c.face.name).join(", ");
    lines.push(`${f.faction}: starter deck ${f.deckSize} copies, ${f.cards.length} cards (Mythic: ${mythics || "none"}); after the packs ${f.heldAfter.copies} copies, ${f.heldAfter.distinct} distinct cards`);
    for (const p of f.packs) {
      const r = p.reveal;
      const cards = r.cards.map((c) => `${c.hit ? "*" : ""}${c.face.name}${c.finish === "standard" ? "" : ` (${c.finish})`}${c.isNew ? " NEW" : ""}`).join(", ");
      lines.push(`  ${p.label}: seed ${r.seed}, ${r.sparks ? "SPARKS" : "no sparks"}, +${r.packPoints} pack points: ${cards}`);
    }
  }
  lines.push("", "Generate a new agent (3 agents; 3 signature cards each; what confirming each one makes):");
  d.agents.forEach((a, i) => {
    lines.push(`  agent ${i + 1}: ${a.name}, "${a.persona}"`);
    a.signatures.forEach((s, j) => {
      const m = a.minted[j]!;
      lines.push(`    card ${j + 1}: ${s.name}, ${s.concept} [${s.comboId}, worst edge ${s.measured.worst.toFixed(2)} over ${s.measured.seeds} seeds]`);
      lines.push(`      minted ${m.collectorNumber} ${m.cardId}, art ${m.art.pool} piece ${m.art.slot}/${m.art.of}, copy ${m.copy.origin}${m.copy.bound ? " bound" : ""} ${m.copy.stamp ?? ""}; flavour "${m.face.flavor}"`);
    });
  });
  lines.push("", `Typed names (agent 1, card 1; generated name "${d.agents[0]!.name}"), through confirmAgentDraft:`);
  for (const r of typedNameResults()) {
    const shown = JSON.stringify(r.typed.length > 20 ? `${r.typed.slice(0, 12)}...(${r.typed.length})` : r.typed);
    lines.push(r.refused ? `  ${shown}: refused, "${r.refused}"` : `  ${shown}: agent "${r.agentName}"; flavour "${r.flavor}"`);
  }
  return lines.join("\n") + "\n";
}

/** The making of the signature card ("the mint"), proposed, in
 * milliseconds; an open detail at the checkpoint. About 6.5 s from the tap
 * to the settled card, and nothing in it can be skipped: it is the moment
 * the owner asked to be the most polished (2026-09-12 F, 2026-10-18). */
export const MINT_TIMINGS = {
  /** The other two cards fall away; the chosen one turns face down and
   * flies to the middle while the screen goes dark. */
  gather: 800,
  /** Each terminal line: its label prints at once, its value types. */
  typePerChar: 13,
  lineGap: 200,
  /** The card's ward draws itself in behind it and spins up (it starts
   * with the terminal's second line). */
  wardIn: 1600,
  /** The card turns face up as the made card: its face burns in from the
   * middle of the art outward and the art-pool piece develops. */
  forge: 1300,
  /** The number plate presses in. */
  stamp: 520,
  /** The plate lifts away into the card's own number, the ward folds into
   * a halo behind it, and the signature light comes on. */
  settle: 900,
  /** Nothing moves on before this, after the settle. */
  hold: 1100,
} as const;

/** The first-time screens' entrances (proposed): the faction plates, the
 * starter deck's box and fan, the agents' names typing. */
export const FLOW_TIMINGS = {
  /** Between one plate, dossier or card entering and the next. */
  stagger: 90,
  /** The starter deck box dropping in, then its rarest 5 cards fanning out
   * of it, then the 3 packs sliding in beside it. */
  boxDrop: 520,
  fanOut: 110,
  packsIn: 650,
  /** An agent's name typing on its dossier. */
  namePerChar: 30,
} as const;
