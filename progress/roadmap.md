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
1. Fourth faction (Null — reserved in the Faction type, unused). Use the
   board-development mechanics (telegraph / evolution / tools) like the other
   factions. Carry the cyberpunk + 1990s retro-futurism flavour direction.
   Measure it against the existing three with balanceReport.ts before calling
   it done.
2. Non-engine test coverage: server / protocol / agents have had zero
   automated tests since session 3. Add real coverage.
3. Balance pass across all four factions: resolve remaining flagged pairings
   (incl. Swarm-vs-Aegis and the single-flagged Cortex pairings) using the
   measure-then-fix pattern (balanceReport.ts, not guesswork).
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
