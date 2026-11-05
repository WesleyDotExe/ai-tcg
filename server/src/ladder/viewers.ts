// Viewer counts for Watch live (session 74; owner app spec 2026-10-05 C.4,
// "Shows viewer counts"; the desktop spec's title-screen ticker and the
// Watch live widget show them too).
//
// What "watching" means (proposed session 74, an [OWNER CHECK-IN] item):
// a signed-in owner is watching a live match while it keeps reading that
// match's feed (`GET /api/live/:matchId`), and for VIEWER_WINDOW_MS after
// its last read. The website reads the feed every 3 s while the match is on
// screen and every 15 s in a hidden tab, so a viewer with the page open
// counts, and one who closed it drops out within 30 s. Glancing at the list
// (`GET /api/live`) is not watching: that is what every page with a live
// widget reads.
//
//  - Each owner counts once per match, however many tabs it has open.
//  - The two owners whose agents play count too: they are watching. (A
//    count of everyone is what a viewer expects from a live stream.)
//  - An owner can watch several matches at once; each counts it.
//  - Kept in memory, with the live match: when the match is recorded its
//    count goes (a finished match has no viewers; a restart cancels any
//    live match anyway).

/** How long after its last feed read an owner still counts as watching. */
export const VIEWER_WINDOW_MS = 30_000;

export class ViewerCounter {
  /** matchId -> ownerId -> the last feed read, in ms. */
  private readonly seen = new Map<string, Map<string, number>>();

  constructor(private readonly windowMs: number = VIEWER_WINDOW_MS) {}

  /** `ownerId` read `matchId`'s feed at `at`. */
  saw(matchId: string, ownerId: string, at: number): void {
    let m = this.seen.get(matchId);
    if (!m) this.seen.set(matchId, (m = new Map()));
    m.set(ownerId, Math.max(at, m.get(ownerId) ?? -Infinity));
  }

  /** How many owners are watching `matchId` at `at`. Drops the ones whose
   * window has passed. */
  count(matchId: string, at: number): number {
    const m = this.seen.get(matchId);
    if (!m) return 0;
    for (const [ownerId, last] of m) if (at - last >= this.windowMs) m.delete(ownerId);
    if (m.size === 0) this.seen.delete(matchId);
    return m.size;
  }

  /** The match ended: its viewers go. */
  forget(matchId: string): void {
    this.seen.delete(matchId);
  }

  /** Matches with anyone still on record (for tests: nothing leaks). */
  tracked(): number {
    return this.seen.size;
  }
}
