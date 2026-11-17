// The season server's ladder lines (game session 102): what `npm run season`
// prints for each ladder event and round, moved here from seasonCli.ts so
// it can be tested and measured.
//
// One change from the old printing: an owner left out of a round for the
// same reason as the round before is not printed again every round. Session
// 102 measured a day of the live ladder with a locked owner who can't build
// (progress/sits-out-day-001.txt): the old printing put the same "sits out"
// line in the log every round, all day (one line in every few the season
// log carried). Now:
//   - the first time, and whenever the reason changes, the line is printed
//     as before ("X sits out: <reason>");
//   - a repeat is counted, and every REMIND_EVERY rounds one line says so
//     ("X still sits out (60 rounds in a row): <reason>"), so a log read
//     after a problem still shows it going on;
//   - the round they are back in the queue, one line says so ("X is back in
//     the queue after sitting out N rounds").
// A match that didn't start (`match not started: ...`, from playPair) is a
// one-off and always printed; it isn't counted as sitting out.
//
// The events and the store are unchanged; only the printing is.
//
// (session 104) An owner switching auto-play off on the website gets a line
// at the next round's start ("X's auto-play is off: switched off by its
// owner at <when>"), the time in the machine's local clock, as each line's
// own stamp is (logTime.ts), since the round can start minutes later.

import { localStamp } from "../logTime.js";
import type { LadderEvent, RoundReport } from "./ladderRunner.js";

/** A repeat of the same reason is printed once in this many rounds. */
export const REMIND_EVERY = 60;

const ONE_OFF = "match not started: ";

export class LadderLog {
  /** Owners left out: the reason, the rounds in a row for it, and the rounds
   * left out in a row for any reason. */
  private out = new Map<string, { reason: string; rounds: number; total: number }>();
  /** Owners left out in the round being started (cleared by `round`). */
  private thisRound = new Set<string>();

  constructor(private readonly name: (ownerId: string) => string) {}

  /** The lines for one event (none, or one). */
  event(e: LadderEvent): string[] {
    const name = this.name;
    switch (e.kind) {
      case "housePacks":
        return [`[ladder] ${name(e.ownerId)} bought ${e.bought}, opened ${e.opened} packs (${e.newCards} new cards)`];
      case "rebuilt":
        return [`[ladder] rebuilt ${name(e.ownerId)}'s deck: ${e.faction}, ${e.cards} cards (${e.reasons.join("; ")})`];
      case "excluded":
        return this.excluded(e.ownerId, e.reason);
      case "autoPlayStopped":
        return [`[ladder] ${name(e.ownerId)}'s auto-play is off: ${e.reason === "timeUp" ? "its play time is up" : "today's rewards are maxed"}`];
      case "autoPlaySwitchedOff":
        return [`[ladder] ${name(e.ownerId)}'s auto-play is off: switched off by its owner${e.changedAt ? ` at ${localStamp(new Date(e.changedAt))}` : ""}`];
      case "seasonEndTime":
        return [
          `[season] season ${e.season}'s end time ${e.endsAt} has passed: no new round; ${e.live === 0 ? "ending it now" : `ending it once the ${e.live} match${e.live === 1 ? "" : "es"} on screen ${e.live === 1 ? "is" : "are"} recorded`}`,
        ];
      case "seasonEnded":
        return [`[season] season ${e.season} ended at ${e.endedAt}: ${e.standings} owners in the final standings, ${e.retiredCopies} unpulled Prototype copies retired`];
      case "match": {
        const r = e.result.record;
        const who = r.outcome === "win" ? `${name(r.winnerOwnerId!)} wins` : r.outcome;
        return [`[ladder] ${r.matchId} ${name(r.p1OwnerId)} vs ${name(r.p2OwnerId)}: ${who} in ${r.turns ?? "-"} turns, +${r.p1Credits}/+${r.p2Credits}${e.result.note ? ` (${e.result.note})` : ""}`];
      }
      case "paired":
        return [];
    }
  }

  /** The lines for a round once it is paired (after its events): anyone back
   * in the queue, then the round's own line. */
  round(r: RoundReport): string[] {
    const name = this.name;
    const lines: string[] = [];
    const inRound = new Set([...r.pairs.flatMap((p) => [p.p1, p.p2]), ...r.sitOut]);
    for (const [ownerId, was] of [...this.out]) {
      if (this.thisRound.has(ownerId)) continue;
      // Not left out this round: they are back (paired or sitting out an
      // odd queue), or no longer queued at all (auto-play off), which needs
      // no line of its own (the auto-play line says it, or the owner did).
      this.out.delete(ownerId);
      if (inRound.has(ownerId)) lines.push(`[ladder] ${name(ownerId)} is back in the queue after sitting out ${was.total} round${was.total === 1 ? "" : "s"}`);
    }
    this.thisRound.clear();
    lines.push(`[ladder] round ${r.round} since this start: ${r.pairs.length} match${r.pairs.length === 1 ? "" : "es"}${r.sitOut.length ? `, ${r.sitOut.map(name).join(", ")} sits out` : ""}`);
    return lines;
  }

  private excluded(ownerId: string, reason: string): string[] {
    const line = `[ladder] ${this.name(ownerId)} sits out: ${reason}`;
    if (reason.startsWith(ONE_OFF)) return [line];
    this.thisRound.add(ownerId);
    const was = this.out.get(ownerId);
    if (was === undefined || was.reason !== reason) {
      this.out.set(ownerId, { reason, rounds: 1, total: (was?.total ?? 0) + 1 });
      return [line];
    }
    was.rounds++;
    was.total++;
    if (was.rounds % REMIND_EVERY === 0) return [`[ladder] ${this.name(ownerId)} still sits out (${was.rounds} rounds in a row): ${reason}`];
    return [];
  }
}
