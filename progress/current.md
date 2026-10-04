# Current status

**Build-order stage: Stage 3 (A real card set) is CLOSED; Stage 4+ (the
living system: persistence, then the economy) is next.** Session 27 was a
game-lane session (the last merged PR, #37, was render). It closed Phase 5
per owner-feedback 2026-10-04 section A and built the event-log instance
ids. Checkpoint at the top of `checkpoints.md`.

## What stands (this session's work; sessions 1-26 otherwise unchanged)

**Propagating Exploit 2/2 -> 2/3** (owner-approved, `engine/src/data/nullCards.ts`).
The Phase 5 baseline (Lookahead, 2,500 seeds win/lose bands, 900 even):

| Edge (target) | rate | verdict |
|---|---|---|
| Null > Aegis (55-60) | Null 48.2 | OUT (owner-accepted) |
| Aegis > Cortex (55-60) | Aegis 52.2 | OUT (owner-accepted) |
| Cortex > Swarm (55-60) | Cortex 57.4 | IN |
| Swarm > Null (55-60) | Swarm 56.2 | UNRESOLVED |
| Null ~ Cortex (45-55) | Null 49.2 | IN |
| Aegis ~ Swarm (45-55) | Aegis 51.2 | IN |

**Balance is a regression check now, not a lane.** `engine/src/dev/ringRegression.ts`
(`npm run ring -w @ai-tcg/engine`) measures those six edges and compares them with
`engine/src/dev/ringBaseline.json`. It fails on a worse verdict, or on a real move further out
on an accepted-OUT edge. It's a step in CI's `test` job (every PR, about 15 s). Re-baseline only
with `--write-baseline` for an owner-approved change, committed with its balance report.
`edgeMeasure.ts` gained `measurePairing` (one pairing, same seeding as `measureEdges`).

**Event-log instance ids** (`engine/src/state/types.ts` GameEvent doc comment):
- `sourceId` on everything a card causes. That's a unit or Directive id, a Command's stack id,
  or the dead unit's id for onDeath. Overload ticks have none.
- `targetRef` on damage/heal (players included); `targetId`/`unitId` on buff, status, Barrier
  and armor events.
- `attackerId`/`defenderRef`/`stackId` on attack; `stackId` (+ `sourceId`, `targetRef`) on cast;
  `stackId` on stackResolve.
- `instanceId` on death, telegraph, evolve and directiveDestroyed; `fromRef`/`toRef` on a
  redirect; `targets` on abilityTrigger.

The text log (`formatEvent`) is unchanged. Also fixed: an `attack` line printed the defender's raw
id when an onAttack ability had already killed it.

## Evidence committed

- `progress/balance-report-021-phase5-close.txt`: the re-measure (900 / 2,500 / held-out
  2501-5000), the baseline table, the regression check passing, and the check failing with
  Propagating Exploit put back to 2/2. Also the 64-match byte-identical text-log comparison.
- `progress/sample-match-028-event-ids.txt` (`engine/src/dev/eventIdsMatchDemo.ts`): a full
  Null vs Cortex game, every line with its ids. Shows a targeted Command, onDeath sources, and a
  hit on one of two Orphaned Threads.
- `engine/test/eventIds.test.ts` (3 tests: all 16 pairings x 2 policies checked event by event
  against real state, with an exact per-instance damage check; a twin-copy Command; combat plus
  redirect). `engine/test/ringRegression.test.ts` (4 tests on the judging rule and the baseline).
- `npm test`: 323 across five workspaces (engine 135). `tsc --noEmit` clean in all five.

## Concrete next step

Check the alternation: if the last merged PR is this one (game lane), the next session is
**render** (EFFECTS.md v2 slice 2; per the 2026-10-04 render entry, write the 10
`signatureAbilities` entries and the two Wards rules first if not done). The render lane can now
use the ids. EFFECTS.md's Dependencies line saying ids are missing is stale, and the render
session should update it (render-lane file, so not touched here).

The next **game-lane** session is **session 28: persistence + economy spec** (owner-feedback
2026-10-04 sections B/C, roadmap item 6):
1. A self-contained local database file (no external service). Pick the storage
   (e.g. `node:sqlite` on Node 22, or a JSON-file store with atomic writes) and justify it.
   Tables/collections: agents, currency ledger (append-only entries, balance derived), owned
   card copies (hidden copy id, card id, finish, source = pack/promo/starter, acquired-at),
   unopened packs as owned items, decks (pointing at copy ids), match history.
2. Write the economy spec (in DESIGN.md or a new `ECONOMY.md`) to section C. Mark the
   [OWNER CHECK-IN] items as open: finishes/pull rates, unique-Mythic effect menu and budgets,
   quests and numbers, starter shape.
3. Build only the no-taste-call parts: the per-copy model and the ledger, with the payout rule
   (win > loss > cancel = 0) enforced and tested. Show it running: a script that records a few
   real matches' payouts into the store and prints balances and history.
