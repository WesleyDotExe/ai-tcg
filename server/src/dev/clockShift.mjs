// The dry run's machine clock (session 93): loaded into the real server with
// node --import, it moves the wall clock by DRY_RUN_CLOCK_OFFSET_MS, so the
// server starts at 23:30 Sydney and crosses midnight within the run, as if
// the machine's clock read that. Timers are untouched (they run on the
// monotonic clock, as on a real machine). Every clock read in the server and
// the store is Date (no SQLite clock), so this moves all of them. Dev only:
// nothing in the server loads it.
const offset = Number(process.env.DRY_RUN_CLOCK_OFFSET_MS ?? 0);
if (offset) {
  const RealDate = Date;
  class ShiftedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...args);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = ShiftedDate;
}
