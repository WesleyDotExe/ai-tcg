// The ladder's seat split under one seat variant (session 68; owner
// 2026-11-02: "measure each on the shipped-deck mirrors and on the ladder's
// seat split"). Test only: the ladder's `seatRules` measuring option, never
// a match the game plays.
//
//   npx tsx src/dev/firstSeatLadder.ts <variant id> [rounds] > ladder-<id>.json
//
// The same run as session 67's firstSeatMeasure.ts (eight house owners, two
// per starting faction, six play styles; the house pack policy on, decks
// rebuilding as packs open; 7 minutes of clock a match; ladder seed 6701),
// so before session 71 "shipped" reproduced progress/first-seat-001.txt's
// 64.8% exactly. Variants change only the match rules: deck builds still
// play the rules as shipped (they are what a store would build today). Since
// session 71 "shipped" is rules-2 (builds and matches), and "rules-1" plays
// its matches on 20 and 20 with decks a store builds today, so it is near
// session 67's run but not byte for byte.

import { PLAY_STYLES, seatVariant, type DeckFaction, type PlayStyleId } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { Ladder } from "../ladder/ladderRunner.js";

const variant = seatVariant(process.argv[2] ?? "shipped");
const ROUNDS = Number(process.argv[3] ?? 600);
const BUILD = { games: 4, trials: 8, confirmGames: 8 };
const MINUTES_PER_MATCH = 7;
const CAST: { agent: string; faction: DeckFaction; style: PlayStyleId }[] = [
  { agent: "Lattice Warden", faction: "Cortex", style: "calculator" },
  { agent: "Quiet Theorem", faction: "Cortex", style: "controller" },
  { agent: "Hive Courier", faction: "Swarm", style: "rusher" },
  { agent: "Brood Cartographer", faction: "Swarm", style: "tempo" },
  { agent: "Chrome Bastion", faction: "Aegis", style: "fortress" },
  { agent: "Mirror Sentry", faction: "Aegis", style: "calculator" },
  { agent: "Static Widow", faction: "Null", style: "gambler" },
  { agent: "Dead Channel", faction: "Null", style: "tempo" },
];

let clock = new Date("2026-11-01T22:00:00.000Z");
const store = EconomyStore.open(":memory:", { now: () => clock });
const styleOf = new Map<string, PlayStyleId>();
for (const c of CAST) {
  const owner = store.createOwner({ name: `House ${c.agent}`, kind: "house" });
  store.grantStarterCollection(owner.ownerId, c.faction);
  const agent = store.createAgent({ ownerId: owner.ownerId, name: c.agent });
  store.setPlayStyle(owner.ownerId, agent.agentId, c.style);
  store.connectAgent(owner.ownerId, agent.agentId);
  styleOf.set(owner.ownerId, c.style);
}
const factionOf = new Map<string, string>();
let n = 0;
let packSeed = 67_000;
const ladder = new Ladder({
  store,
  seed: 6701,
  build: BUILD,
  matchId: () => `fs-${++n}`,
  housePacks: { packSeed: () => ++packSeed },
  afterMatch: () => {
    clock = new Date(clock.getTime() + MINUTES_PER_MATCH * 60_000);
  },
  onEvent: (e) => {
    if (e.kind === "rebuilt") factionOf.set(e.ownerId, e.faction);
  },
  ...(variant.id === "shipped" ? {} : { seatRules: variant.rules }),
});
const factions = new Map<string, { p1: string; p2: string }>();
for (let r = 0; r < ROUNDS; r++) {
  const report = await ladder.runRound();
  for (const m of report.matches) factions.set(m.record.matchId, { p1: factionOf.get(m.record.p1OwnerId)!, p2: factionOf.get(m.record.p2OwnerId)! });
}
const history = store.matchHistory();
const tally = (keep: (m: (typeof history)[number]) => boolean) => {
  const ms = history.filter((m) => m.outcome === "win" && keep(m));
  return { firstWins: ms.filter((m) => m.winnerOwnerId === m.p1OwnerId).length, decided: ms.length };
};
const byFirstFaction: Record<string, { firstWins: number; decided: number }> = {};
for (const f of ["Cortex", "Swarm", "Aegis", "Null"]) byFirstFaction[f] = tally((m) => factions.get(m.matchId)?.p1 === f);
const byFirstStyle: Record<string, { firstWins: number; decided: number }> = {};
for (const s of Object.keys(PLAY_STYLES) as PlayStyleId[]) byFirstStyle[PLAY_STYLES[s].name] = tally((m) => styleOf.get(m.p1OwnerId) === s);
const turns = history.map((m) => m.turns ?? 0).filter((t) => t > 0).sort((a, b) => a - b);
console.log(
  JSON.stringify({
    variant: variant.id,
    rounds: ROUNDS,
    matches: history.length,
    draws: history.filter((m) => m.outcome === "draw").length,
    ...tally(() => true),
    mirror: tally((m) => {
      const f = factions.get(m.matchId);
      return !!f && f.p1 === f.p2;
    }),
    byFirstFaction,
    byFirstStyle,
    medianTurns: turns.length ? turns[Math.floor(turns.length / 2)] : null,
  }),
);
store.close();
