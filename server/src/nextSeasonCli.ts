import { EconomyStore } from "@ai-tcg/economy";

// The next season's file (session 83; Season 0 game item 3, part 2): makes
// a new season's database file from an ended season's file. The ended file
// is only read and stays the season's archive. Stop the season server
// first (`npm run season` over the ended file), then start it again over
// the new file.
//   npm run season:next -- <ended season file> <new season file> <new season, e.g. S1>
const [from, to, season] = process.argv.slice(2);
if (!from || !to || !season) {
  console.error("usage: npm run season:next -- <ended season file> <new season file> <new season, e.g. S1>");
  process.exit(1);
}
try {
  const r = EconomyStore.startNextSeason(from, to, { season });
  console.log(`[season] ${r.season} made from ${r.fromSeason} (ended ${r.fromEndedAt}) at ${r.startedAt}: ${to}`);
  console.log(
    `[season] carried: ${r.owners} owners, ${r.logins} logins, ${r.sessions} live sessions, ${r.agents} agents, ${r.signatureCopies} signature copies, ${r.cosmetics} cosmetics, ${r.loadoutSlots} loadout slots, ${r.retiredPrototypeRuns} retired Prototype runs`,
  );
  console.log(`[season] ${r.ratingSeeds} soft-reset ratings; ${r.starterGrants.length} starter grants`);
  const l = r.leftBehind;
  console.log(
    `[season] left in the archive: ${l.cardCopies} card copies, ${l.unopenedPacks} unopened packs, ${l.decks} decks, ${l.credits} credits, ${l.packPoints} pack points, ${l.matches} matches, ${l.notifications} notifications`,
  );
} catch (err) {
  console.error(`[season] not made: ${(err as Error).message}`);
  process.exit(1);
}
