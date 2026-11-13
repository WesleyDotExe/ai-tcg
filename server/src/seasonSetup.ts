import { SEASON_END_TIMES, type EconomyStore } from "@ai-tcg/economy";
import type { DeckFaction, PlayStyleId } from "@ai-tcg/engine";

// A season file's first contents (session 93, the Season 0 dry run). Before
// this, `npm run season -- <file> --new` made an empty file: no owner could
// sign in (no endpoint and no command made a login), and no house owner
// queued, so the ladder never paired a match. The dry run found it; this is
// what `npm run season:setup` puts in a new file:
//   - the owner's account: a player owner with the admin login (Settings ->
//     Admin, ending the season), its starting faction's starter collection
//     (deck, bound) and starter packs, and its first agent, made the way the
//     website's "Generate a new agent" makes one (a generated agent with its
//     signature card), connected, auto-play off;
//   - the house: four house owners, one per faction, each with its starter
//     collection and a connected agent with a play style. House owners always
//     queue, so the ladder plays from the first start;
//   - (session 94) the season's end time (owner 2026-11-13: the server ends
//     the season, at a time set before it starts): by default the owner's
//     time for that season (SEASON_END_TIMES; Season 0: 00:00 27 Dec 2026
//     Sydney), or the one given, or none.

export const HOUSE_CAST: readonly { name: string; agent: string; faction: DeckFaction; style: PlayStyleId }[] = [
  { name: "House Cortex", agent: "Lattice Warden", faction: "Cortex", style: "calculator" },
  { name: "House Swarm", agent: "Hive Courier", faction: "Swarm", style: "rusher" },
  { name: "House Aegis", agent: "Chrome Bastion", faction: "Aegis", style: "fortress" },
  { name: "House Null", agent: "Static Widow", faction: "Null", style: "gambler" },
];

export const SETUP_FACTIONS: readonly DeckFaction[] = ["Cortex", "Swarm", "Aegis", "Null"];

export interface SeasonSetupInput {
  /** The owner's display name (shown on the ladder). */
  name: string;
  username: string;
  password: string;
  email?: string | null;
  faction: DeckFaction;
  /** The owner's agent's name; omitted keeps the generated one. */
  agentName?: string;
  /** (session 94) The season's end time (an ISO instant), or null for none.
   * Omitted: the owner's time for the file's season, if there is one. */
  endsAt?: string | null;
  /** Tests only: fixes the generated agent. */
  seed?: number;
}

export interface SeasonSetupResult {
  ownerId: string;
  agentId: string;
  agentName: string;
  signatureCard: string;
  house: { name: string; agent: string; faction: DeckFaction }[];
  /** When the server will end the season; null: no end time. */
  endsAt: string | null;
}

/** Fills a new season file. Refuses a file that already has owners, so it
 * can't add a second house to a season being played. */
export function setUpSeason(store: EconomyStore, input: SeasonSetupInput): SeasonSetupResult {
  if (store.listOwners().length > 0) throw new Error("this season file already has owners: setup is only for a new file");
  if (!SETUP_FACTIONS.includes(input.faction)) throw new Error(`a starting faction is one of ${SETUP_FACTIONS.join(", ")}`);
  // The end time first: a bad or past one refuses the setup before anything is made.
  const endsAt = input.endsAt === undefined ? (SEASON_END_TIMES[store.season] ?? null) : input.endsAt;
  if (endsAt !== null) store.setSeasonEndTime(endsAt);
  const owner = store.createAccount({ name: input.name, username: input.username, password: input.password, email: input.email ?? null, isAdmin: true });
  store.grantStarterCollection(owner.ownerId, input.faction);
  const seed = input.seed;
  const draft = store.startAgentDraft(owner.ownerId, seed === undefined ? {} : { seed });
  store.pickDraftAgent(owner.ownerId, draft.draftId, 0, seed === undefined ? {} : { seed: seed + 1 });
  const made = store.confirmAgentDraft(owner.ownerId, draft.draftId, 0, input.agentName === undefined ? {} : { name: input.agentName });
  store.connectAgent(owner.ownerId, made.agent.agentId);
  for (const h of HOUSE_CAST) {
    const o = store.createOwner({ name: h.name, kind: "house" });
    store.grantStarterCollection(o.ownerId, h.faction);
    const a = store.createAgent({ ownerId: o.ownerId, name: h.agent });
    store.setPlayStyle(o.ownerId, a.agentId, h.style);
    store.connectAgent(o.ownerId, a.agentId);
  }
  return {
    ownerId: owner.ownerId,
    agentId: made.agent.agentId,
    agentName: made.agent.name,
    signatureCard: made.signature.card.name,
    house: HOUSE_CAST.map((h) => ({ name: h.name, agent: h.agent, faction: h.faction })),
    endsAt: store.seasonSchedule()?.endsAt ?? null,
  };
}
