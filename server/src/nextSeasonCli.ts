import { existsSync } from "node:fs";
import { EconomyStore } from "@ai-tcg/economy";
import { acquireSeasonLock, tookOverLine } from "./seasonLock.js";

// The next season's file (session 83; Season 0 game item 3, part 2): makes
// a new season's database file from an ended season's file. The ended file
// is only read and stays the season's archive. Stop the season server
// first (`npm run season` over the ended file), then start it again over
// the new file.
//   npm run season:next -- <ended season file> <new season file> <new season, e.g. S1>
// (session 86; owner 2026-11-11) It refuses while a server is still running
// on the ended file: every server holds `<file>.lock` (seasonLock.ts), and
// this takes the same lock for as long as it reads the file, so a server
// can't start on the archive mid-switch either. A lock left by a server that
// was killed is taken over, and said so.
const [from, to, season] = process.argv.slice(2);
if (!from || !to || !season) {
  console.error("usage: npm run season:next -- <ended season file> <new season file> <new season, e.g. S1>");
  process.exit(1);
}
// A missing ended file is startNextSeason's refusal ("no season file at"),
// with no lock file made for the typo.
if (existsSync(from)) {
  const lock = acquireSeasonLock(from, "npm run season:next");
  if ("problem" in lock) {
    console.error(`[season] not made: ${lock.problem}`);
    process.exit(1);
  }
  const tookOver = tookOverLine(lock);
  if (tookOver) console.log(tookOver);
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
