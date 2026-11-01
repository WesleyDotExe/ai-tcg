// The owner's daily pack (owner 2026-10-04, section 6 of the economy spec:
// "one free pack a day that only the owner can claim, stacking up to 2 (a
// reason for the owner to check in)"; the reset is midnight Sydney, owner
// 2026-11-01). Session 65.
//
// The rule, as a bank: at the start of each reset day one pack comes in,
// unless OWNER_DAILY_PACK_CAP are already waiting; claiming takes one out.
// The owner's first day counts (a new owner can claim one at once). Nothing
// is stored but the claims themselves: every claimed pack is a row in
// `packs` with source "ownerDaily", so the bank is worked out from those
// rows and the day the owner was created, the same way the daily win count
// is worked out from match history. That keeps one source of truth, and a
// bank that can't drift from the packs it paid out.
//
// This file is the pure arithmetic; the store supplies the days.

function dayNumber(day: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new RangeError(`not a reset day: "${day}"`);
  return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) / 86_400_000;
}

/** How many daily packs wait to be claimed on `today`.
 *
 * `firstDay` is the reset day the owner was created on; `claimDays` is the
 * reset day of every daily pack the owner already has, one entry per pack,
 * in any order. A claim dated before `firstDay` counts on `firstDay`. A
 * claim the bank couldn't have paid (only possible for packs granted
 * outside `claimDailyPack`, e.g. by a demo) empties the bank rather than
 * owing packs back. */
export function dailyPacksWaiting(firstDay: string, claimDays: readonly string[], today: string, cap: number): number {
  if (!Number.isInteger(cap) || cap < 1) throw new RangeError(`the cap must be a whole number of at least 1, got ${cap}`);
  const start = dayNumber(firstDay);
  const end = dayNumber(today);
  if (end < start) return 0;
  const perDay = new Map<number, number>();
  for (const d of claimDays) {
    const n = Math.min(end, Math.max(start, dayNumber(d)));
    perDay.set(n, (perDay.get(n) ?? 0) + 1);
  }
  let bank = 0;
  let last = start - 1;
  for (const day of [...perDay.keys()].sort((a, b) => a - b)) {
    bank = Math.min(cap, bank + (day - last));
    bank = Math.max(0, bank - perDay.get(day)!);
    last = day;
  }
  return Math.min(cap, bank + (end - last));
}
