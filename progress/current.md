# Current status

**Build-order stage: 3 (A real card set), still current, inside Phase 5
(pool expansion).** Session 24 was a balance session: the last merged PR
(#32) was render. The owner's revised Phase 5 order (2026-09-26, item 2) is
(i) Null consistency trim (done, session 23), (ii) neutral pool (this
session), (iii) the mandatory full-ring re-measure gate (next).

## What stands (this session's work; sessions 1-23 otherwise unchanged)

**The neutral pool** (`engine/src/data/neutralCards.ts`): 10 cards, all
utility. Card flow: Spare Cycles, Cache Warmup, Relay Courier, Uplink Tower.
Health: Rollback Point, Scrap Recycler. Energy: Burst Credit, Power Reserve.
Plain bodies: Commodity Rack, and the Surge Protector tool. `Faction` gained
"Neutral"; `DeckFaction` is the four real ones.

**Rules, all enforced at load time:**
- `poolLint.ts`'s `neutralCardViolations`: a neutral card may not be
  removal/debuff, Mythic, carry Guard/Barrier/Rush, evolve or telegraph,
  summon, have a static effect, or be faction-conditional.
- `decks.ts`'s `buildDeck`: exactly one faction plus at most
  `MAX_NEUTRAL_COPIES` = 10 neutral copies. Every neutral card must be the
  pool's own object. `deckFaction()` names a deck's faction.
- Clock and card flow are now checked on a faction's own cards only.
  Neutral draw can't stand in. The 25% removal cap still counts the whole
  deck.

**Shipped neutral packages** (`dev/neutralPackageSearch.ts`, ring-distance
objective, no-sandbag guard, held-out ship rule):
- Cortex: -1 Signal Drone, -1 Overclock Shunt; +1 Rollback Point, +1 Surge
  Protector.
- Null: add-only, 36 -> 40: +3 Commodity Rack, +1 Rollback Point. Nothing
  was cut, per owner-feedback 2026-09-29.
- Swarm: none. Aegis: none (its best swap failed held-out).

**LookaheadAgent fix:** heal is valued up to missing health, net of heals
already pending on the stack. gainEnergy is valued up to the room left. A
Command that does nothing costs the card. Before this, Cortex Engineer's
repair fired 1,231 times in 200 games and healed 66 times.

**Ring now** (Lookahead, 900 seeds): only Aegis over Null is OUT OF BAND
(52.2% Aegis, target 40-45). All other edges are UNRESOLVED.

| Edge (row faction's rate) | session start | now | band |
|---|---|---|---|
| Null vs Cortex | 41.1 | 41.9 | 45-55 |
| Null vs Swarm | 41.7 | 42.6 | 40-45 |
| Null vs Aegis | 39.6 | 47.8 | 55-60 |
| Cortex vs Swarm | 54.1 | 59.1 | 55-60 |
| Cortex vs Aegis | 41.6 | 47.9 | 40-45 |
| Aegis vs Swarm | 54.4 | 54.4 | 45-55 |

**Self-containment (owner-feedback 2026-09-30):** `edgeMeasure.ts` is the
permanent, vendored statistics. It now has the z-test,
`compareTwoProportions`, a provenance line, and a hardcoded parity fixture
test. It makes no external calls.

**Render compatibility:** capture.ts derives a player's faction from their
non-Neutral cards. Neutral cards use the UI gold (`.faction-Neutral`), and
cli.ts uses `DeckFaction`.

## Evidence committed

- `progress/balance-report-018-neutral-pool.txt`: headline, before/after
  ring, agent-fix waste counts and decomposition, all four search
  transcripts plus the discarded first run, probe table, Kernel Panic
  frequency, final edge checks, full `balanceReport.ts 900`.
- `progress/sample-match-025-neutral-pool.txt`: shipped-deck usage per
  neutral card, and a full log (Swarm vs Cortex, seed 18) with Surge
  Protector attached and Rollback Point cast.
- Tests: `engine/test/neutralPool.test.ts` (13), the parity fixture in
  `edgeMeasure.test.ts`, and updated Cortex/Null pool tests. `npm test`:
  285/285 across all five workspaces (engine 124). `tsc --noEmit` clean in
  all five.

## Concrete next step

Next session is a **render** slice under the alternation rule. Its queue:
the owner's 2026-09-27 entry (cast stagger on all responses), EFFECTS.md
slice 5, and a real palette for Neutral cards.

The next **balance** session runs the **Phase 5 gate (step iii)**:
- `lookaheadEdgeCheck.ts <Faction> 1 900` for each faction, for the even
  bands.
- ~2,500 seeds for the 5-point win/lose bands (the CLI takes a count:
  `lookaheadEdgeCheck.ts <Faction> 1 2500`). UNRESOLVED is not a pass.
- `balanceReport.ts 900`.
- Write the result as a checkpoint.

If Cortex-vs-Null is still out there, the pre-authorized lever is dropping
Quorum Arbiter (owner-feedback 2026-09-26 item 3). Before any Null cut,
settle note 3: are Null's removal cards weak, or does the agent misplay
them? This session showed the agent can misplay by ~6 points.
