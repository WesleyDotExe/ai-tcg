# Roadmap

The persistent priority order for this project. When there is NO unhandled
owner feedback, work down this list: do the highest unfinished item that is
unblocked. This replaces "pick one of several options" guesswork with a
standing direction, so the owner doesn't have to choose every session.

## Overriding rule
If quality-debt.md has a CRITICAL item (a crash, a broken core system, a
failing/absent test on something load-bearing), FIX THAT FIRST regardless of
roadmap order. The roadmap orders growth; it never overrides fixing what's
broken. Continuation over completion still applies — do one item properly
rather than several half-done.

## Owner check-in items
A few items are marked [OWNER CHECK-IN]. For these, do the design/build work,
but write a checkpoint and PAUSE for owner steering on the taste-heavy
decisions before finalizing — the owner's call genuinely shapes these. Keep
building around them; don't block the whole project waiting.

## The order

### Finish and harden the card game (Stage 3)
1. DONE (session 8). Fourth faction (Null) built: 14 unique cards
   (engine/src/data/nullCards.ts), 34-card deck, full board-development
   coverage (evolution line, 2 telegraphs, 3 tools), cyberpunk/glitch-decay
   flavour. Measured with balanceReport.ts, one real fix cycle applied (see
   progress/balance-report-002-null.txt) — Null still double-flagged
   against Aegis specifically and above-50%-but-under-60% vs Cortex/Swarm
   under Random play; carried into item 3 below rather than re-opening this
   item.
2. DONE (session 9). Non-engine test coverage: `protocol` (7 tests),
   `server` (23 tests: pure `deepEqual`, a fake-socket `RemoteAgent` fault-path
   suite, and a real-socket integration suite driving the actual server
   against real `@ai-tcg/agents` reference clients), and `agents` (17 tests:
   `Rng`, `makeRandomDecision`, `aggressiveDecision`) all now have real
   vitest coverage — 81/81 tests pass across all four packages. See
   `progress/current.md` for what shipped and where it's still thin.
3. Balance pass across all four factions: IN PROGRESS (session 10).
   Aegis-vs-Null [worst, was 75-81%] — the owner's 2026-09-17 fix direction
   (condition Kernel Panic's `destroy`, then adjust Null's numbers only if
   still flagged) was followed exactly, both steps measured separately —
   see progress/balance-report-003-null-fix.txt. Result: now 74.7%/79.0%,
   a small real improvement but STILL double-flagged; the investigation
   found no single-card fix resolves it and named the likely real cause
   (Aegis's kit lacks independent interaction, not a Null number) as a
   card-set-design follow-up, not further Null tuning. Still open:
   Swarm-vs-Aegis, the single-flagged Cortex pairings, and Null's remaining
   edge over Cortex/Swarm under Random play — none touched this session
   (scoped to exactly the owner's Aegis-vs-Null direction). Next session
   picking this item back up should read balance-report-003's "honest
   read" section before continuing.
4. Card-pool depth: enough cards per faction for genuine deck-building
   variety.

### Make it a living system (Stage 4+)
5. [OWNER CHECK-IN] Economy: the currency (win pays most, loss pays a little,
   cancel/abandon pays nothing), booster packs, per-agent collections,
   deck-building from owned cards. Big and design-heavy — checkpoint before
   finalizing payout/pack specifics.
6. Match-server hardening: persistence, reconnection, running many matches,
   results recorded. (Unblocks once there's an economy that needs it.)
7. [OWNER CHECK-IN] The 1-of-1 signature leader cards + the rarity ladder —
   headline features. Balance-fair-but-visually-unique leaders; rarity scales
   spectacle/scarcity, not power. Checkpoint on the effect pool, activation,
   and rarity tiers/pull-rates.

### The spectacle (correctly deferred — only once the game underneath works)
8. Spectator render (watchable match view), then AI commentators, then the
   public web platform, then monthly set cadence. [OWNER CHECK-IN] on the art
   pipeline when the render stage arrives (real generated art is a late,
   owner-funded pass per DESIGN.md).

## Keeping this current
When an item is genuinely done (built, tested, evidenced), mark it done here
and move to the next. If the owner leaves new feedback in owner-feedback.md,
that takes priority over the roadmap for that session.
