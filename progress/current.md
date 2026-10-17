# Current status

**Build-order stage: Stage 4+ (the living system). Session 40 (game lane) built build-order step 2,
the generic "choose one" mechanic, and the 3 Season 0 Zero-Day cards from the owner's 2026-10-18
designs as its first users, measured but NOT live.**
- **Modal cards** (`engine/src/cards/modes.ts`): each mode is its own legal move; the played copy
  carries only the chosen mode; `play` / `cast` / `evolve` events carry `mode` and `modeName`; the
  log reads "..., choosing Outbreak"; the graveyard gets the printed card.
- **Patient Zero, Root Access, Kill Switch** (`engine/src/data/zeroDayCards.ts`, `S0-ZD1`..`S0-ZD3`),
  at the owner's starting numbers, 1 per deck. Not in `CARD_REGISTRY`, so the economy still treats
  them as reserved entries.
- **Measured** at 10,000 games per pairing (`progress/balance-report-027-zero-day.txt`): worst edge
  moves 2.5 / 4.5 / 2.3 points. The reference agent misreads two of the three mode choices (see the
  check-in).

No stage checkpoint (the living system reports through notes-for-owner). One new **[OWNER CHECK-IN]**
in notes-for-owner.md: the cap (proposed 4 points on any edge, every mode picked in 10%+ of plays)
and what to do first (default A: fix the agent's valuation of auras and stun durations for every
card, re-record the ring baseline once, then re-measure and tune).

## What stands (this session's work; sessions 1-39 otherwise unchanged)

**Engine.**
- `cards/types.ts`: `CardMode`; `Card.modes`, `Card.chosenMode` (played copies only),
  `Card.topTier: "zeroDay"`; scaling source `allUnitsInPlay`.
- `cards/modes.ts`: `withMode`, `printedCard`, `chosenModeOf`, `findMode`, `allAbilities`,
  `playVariants`.
- `engine/moves.ts`: `playCard.mode`; `pushPlayCardMoves` loops a card's play variants, each through
  the old per-card logic (`pushPlayVariantMoves`), so targets cross with modes.
- `engine/engine.ts`: `playCard` refuses a modal play with no mode (and a mode on a plain card),
  plays the moded copy, pays the printed cost; `modeFields` on play/cast/evolve; the graveyard gets
  `printedCard` (here and in `effects/resolver.ts`); a modal Command's stack line is "Kill Switch
  (Wipe)".
- `cards/poolLint.ts`: every rule reads `allAbilities` (all modes); `modalCardViolations` (in every
  deck build) and `zeroDayCardViolations` (at load).
- `data/decks.ts`: a deck may run a Zero-Day card (must be the linted object), 1 copy each
  (`TOP_TIER_COPY_LIMIT`); it counts toward the 10 neutral cards and the 25% removal share.
- `state/init.ts`: a signature card can't be modal.
- `agents/lookaheadAgent.ts`: a modal play is scored as the moded card plus
  `estimateModeAbilities` (a mode's static, onDeath and turn triggers, which unit scoring never
  read). Non-modal scoring is unchanged: the ring moved +0.0 on all six edges, and the committed
  logs and render transcripts regenerate as on main.
- `log/format.ts`: ", choosing <mode>".
- Dev: `dev/modalMatchDemo.ts` (the sample match), `dev/zeroDayFairness.ts` (the measurement:
  reference, candidate, `--force` a mode, report).

**Protocol.** `PROTOCOL.md` documents `mode` on `playCard` and modal cards.

## Evidence committed

- `progress/sample-match-033-modal-cards.txt` (`npx tsx src/dev/modalMatchDemo.ts 600 4` in engine/,
  reproduces exactly): Cortex vs Swarm, both running the 3 cards, seed 442: 5 mode choices, 4
  different modes, each with the legal moves it was chosen from; Outbreak's death trigger fires
  twice; Wipe resolves as "Kill Switch (Wipe)"; 0 graveyard cards carry a mode.
- `progress/balance-report-027-zero-day.txt`: 10 runs at 10,000 games per pairing (reference, each
  card with the agent choosing, each card locked to each mode), with the commands.
- Tests: `engine/test/modalCards.test.ts` (23: legal moves per mode, a targetless mode not offered,
  cost/timing from the printed card, the engine's refusals, each of the 6 modes' effects, the log,
  modal evolution and Directive, the helpers, the lint rules, the deck rules, not-live, the
  signature guard, Lookahead reads the board for Patient Zero, 40 real matches using all 6 modes).
- `npm test`: 715 across six workspaces, all pass (engine 241, protocol 7, server 23, agents 17,
  economy 100, render 327). `tsc --noEmit` is clean in all six.

## Concrete next step

Check the alternation first. This session's PR follows render's #64, so the next session is
**render**. Render can now word mode choices in the feed (`play` / `cast` / `evolve` carry `mode`,
`modeName`; a played card's `chosenMode`), and still has the two Intercept Routine fizzle causes and
the chase-finish visuals from session 39.

The next **game-lane** session: the owner's answer to the session-40 check-in; by default option A:
1. In `agents/lookaheadAgent.ts`, value a unit's own static aura over a short horizon (as a
   Directive's already is) and a status by its duration, for every card.
2. Re-record both ring baselines once (`dev/ringRegression.ts --write-baseline`, and the signature
   one) and say what moved.
3. Re-run `dev/zeroDayFairness.ts` for the 3 cards at 10,000; tune any card over the agreed cap (numbers
   only); check every mode is picked in 10%+ of plays.
4. With the owner's OK, add `ZERO_DAY_CARDS` to `CARD_REGISTRY` (`data/registry.ts`): pulled copies
   become playable and `craftSecret` opens Zero-Day crafting. Add an economy test for both.

**Blocked:** nothing (going live waits on the owner's cap answer; the agent fix doesn't).
