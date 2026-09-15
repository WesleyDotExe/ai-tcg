# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 7, a
normal (non-hardening) session. `progress/owner-feedback.md` had no new
unhandled entries (last entry already marked HANDLED by session 6). Picked
option 3 from session 6's concrete-next-step note — "start measuring
design principle 3 (archetype-level soft counters)" — since it was
unblocked (unlike option 1) and deepened existing work rather than adding
new width (per DESIGN.md's depth-before-breadth rule).

## What stands (changes from this session; everything from sessions 1-6
## otherwise unchanged — see prior `progress/log.md` entries for that)

- **`engine/src/dev/balanceReport.ts`** (new, `npm run balance --workspace=
  engine`) — the first real cross-faction balance measurement. Runs N
  seeded games (default 300) per faction pairing + per mirror pairing,
  same agent policy on both sides (isolates faction balance from agent
  skill), alternates first-player by seed (isolates it from first-player
  advantage), and cross-checks whether a pairing is flagged (>=60% win
  rate) under BOTH AggressiveAgent-vs-itself and RandomAgent-vs-itself —
  double-flagged is treated as real dominant-archetype evidence.
- **A real crash bug found and fixed**: `effects/resolver.ts`'s
  `applyDamage` now checks `isAlive()` before re-firing a unit's
  `onDamaged` trigger. Without this, two units whose `onDamaged` deals
  damage to all enemy units (e.g. two copies of Retaliation Node, CX-013,
  in a Cortex mirror match) recurse into a real stack overflow — found by
  the balance script's very first Cortex-mirror game, not a synthetic
  edge case. Regression test: `engine/test/mutualRetaliation.test.ts`
  (confirmed it fails without the fix, passes with it). Real-match
  evidence: `engine/src/dev/retaliationMatchDemo.ts` found seed 2 where
  both players' real, deck-drawn Retaliation Nodes actually fight each
  other and the match resolves cleanly — committed as
  `progress/sample-match-007-retaliation-fix.txt`.
- **One real balance fix, measured before and after**: the initial
  measurement showed Cortex beating both Swarm and Aegis under both agent
  policies (a genuine dominant-archetype signal, not noise — mirror
  matchups confirmed first-player advantage was small throughout). Traced
  to two causes in `engine/src/data/cards.ts`: Overload Capacitor (CX-011)
  was a stat outlier (5/5 for cost 3, well above the curve baseline) and
  Interrupt Handler (CX-014) duplicated Diagnostic Pulse's exact effect at
  the same 1-mana cost, giving Cortex an outsized density of cheap precise
  removal. Applied two minimal tuning changes (Overload Capacitor -> 4/4;
  Interrupt Handler cost 1 -> 2) and re-measured: the double-flag is gone.
  Full before/after numbers and an honest "what this does and doesn't
  prove" section: `progress/balance-report-001.txt`.
- **`engine/test/mutualRetaliation.test.ts`** (new, 1 test) — see above.

## Evidence committed

- `npm test` (engine): **26/26 vitest tests pass** (25 pre-existing + 1
  new), ~1s.
- `npx tsc --noEmit` clean in all four packages (`engine`, `protocol`,
  `server`, `agents`).
- `progress/sample-match-007-retaliation-fix.txt` — a real, unscripted
  Cortex-mirror match (seed 2) where both players' Retaliation Nodes
  actually fight each other and the game resolves cleanly to a winner at
  turn 18, instead of crashing.
- `progress/balance-report-001.txt` — the full before/after 300-seed
  measurement (both agent policies, all 3 cross-faction pairings + 3
  mirror pairings), with root-cause analysis of the cards involved and an
  honest read of what the fix does and doesn't prove.

## Decisions made this session the owner might want to overrule

- **Stopped after one measure-then-fix cycle, not iterated to a specific
  balance target.** Cortex-vs-Aegis (Aggressive, 70.0%) and Cortex-vs-Swarm
  (Random, 72.0%) still individually clear the 60% flag threshold after
  the fix — just not simultaneously under both policies anymore. This was
  a deliberate choice to keep the slice bounded (one real, evidence-backed
  fix, not open-ended tuning against a moving target) rather than a claim
  that Cortex is now fully balanced against the others.
- **Overload Capacitor and Interrupt Handler's exact new numbers (4/4,
  cost 2) are a first, reasoned pass, not derived from a second round of
  measurement per individual change.** Both were changed together and
  re-measured as one combined pass, so the report can't say how much of
  the improvement came from which change individually — a future session
  could isolate them if that matters.
- **Swarm-vs-Aegis's 61.3% (Swarm) flag was left uninvestigated** — it
  didn't change between before/after (neither modified card belongs to
  either faction) and wasn't this session's focus. Named as remaining open
  debt below, not silently dropped.

## Concrete next step

No unhandled owner feedback remains. Legitimate options for the next
session:
1. **Continue the balance cycle**: investigate Swarm-vs-Aegis (61.3%
   Swarm) and/or the still-single-flagged Cortex pairings, using
   `npm run balance --workspace=engine` the same measure-then-fix way this
   session did.
2. **Bring Cortex/Swarm's board-development density up toward Aegis's**
   (session 6's option 1) — still blocked by Cortex's deck sitting at the
   40-card ceiling unless something is cut or `MAX_DECK_SIZE` (40) moves;
   worth revisiting now that Interrupt Handler's cost change frees no deck
   slots (copies unchanged) but the removal-density rebalance might make
   room for future additions to reason about differently.
3. **A fourth faction** (Null is reserved in the `Faction` type but
   unused).
4. **Non-engine testing debt** — `server`/`protocol`/`agents` still have
   zero automated tests (named since session 3).

Any of these is legitimate. Whichever is picked, keep using
`balanceReport.ts` (not guesswork) for any future balance change, per the
measure-then-fix pattern this session established.
