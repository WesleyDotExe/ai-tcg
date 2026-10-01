# Current status

**Build-order stage: 3 (A real card set), still current, inside Phase 5
(pool expansion).** Session 25 was a balance session. The owner's 2026-10-01
entry named "the Null card-vs-agent check" as the next session's priority,
which overrode the alternation rule (the last merged PR, #33, was also
balance). Phase 5 order is unchanged: (i) Null trim done, (ii) neutral pool
done, the owner's follow-ups to it done this session, (iii) the mandatory
full-ring gate is next.

## What stands (this session's work; sessions 1-24 otherwise unchanged)

**LookaheadAgent fixes** (`engine/src/agents/lookaheadAgent.ts`):
- A this-turn buff/debuff is worth the fight it changes. That's the
  pending combat on the stack if there is one. Otherwise, on its
  controller's own turn, it's the improvement to the best attack involving
  that unit. Otherwise it's 0. Before, Bit Rot hit a unit that never fought
  in 222/240 casts; now 184/235 casts answer a declared attack.
- A Tool prefers the most valuable host and never re-grants Barrier.
- `scoreAttack` and the new code share `exchangeValue`.
- Constructor option `cardAdvantageWeight`, used only by the instrument
  check. Balance runs use the default 1.5.

**Commodity Rack 3/3 -> 3/2** (owner-feedback 2026-10-01 item 1), after
`dev/cardAdvantageCheck.ts` showed the agent doesn't under-value draw.

**Decks after the re-search** (`neutralPackageSearch.ts --strip-neutral`,
held-out ship rule):
- Null: its own 36 cards, no neutral package.
- Aegis: -1 Salvage Reflex, +1 Uplink Tower.
- Cortex: unchanged (Rollback Point + Surge Protector).
- Swarm: unchanged (none).

**claude-tools reference removed** from code and progress files
(owner-feedback 2026-10-01). Statistics and the parity fixture test are
unchanged.

**Ring now** (Lookahead, 900 seeds): three edges OUT, all Null's. Null is
the weakest faction by a clear margin, mostly because of the Rack nerf (it
ran 3 Racks).

| Edge (row faction's rate) | session start | now | band | verdict |
|---|---|---|---|---|
| Null vs Cortex | 41.9 | 40.0 | 45-55 | OUT |
| Null vs Swarm | 42.6 | 38.9 | 40-45 | UNRESOLVED |
| Null vs Aegis | 47.8 | 41.4 | 55-60 | OUT |
| Cortex vs Swarm | 59.1 | 54.9 | 55-60 | UNRESOLVED |
| Cortex vs Aegis | 47.9 | 47.3 | 40-45 | UNRESOLVED |
| Aegis vs Swarm | 54.4 | 51.2 | 45-55 | IN BAND |

`balanceReport.ts 900`: no triple-flag.

## Evidence committed

- `progress/balance-report-019-agent-check.txt`: head-to-head weights,
  probes before/after, play-context tables old/new, ablations old/new,
  all four search transcripts, final edge checks, full `balanceReport.ts
  900`.
- `progress/sample-match-026-bit-rot-response.txt`: a full game where Bit
  Rot answers Watchtower Relay's attack and zeroes it.
- Tests: four new LookaheadAgent tests (this-turn debuff held / cast in
  response / cast pre-combat; Barrier tool host). `npm test` 289/289 across
  all five workspaces (engine 128). `tsc --noEmit` clean in all five. One
  render test (`statFx.test.ts`) no longer pins move numbers; the agent
  change moved them.

## Concrete next step

Next session is a **render** slice under the alternation rule. Its queue is
unchanged from session 24's note: EFFECTS.md slice 5, and a real palette for
Neutral cards. The cast stagger on responses has already shipped (#32).

The next **balance** session runs the **Phase 5 gate (step iii)**:
- `lookaheadEdgeCheck.ts <Faction> 1 900` for each faction (even bands);
  `... 1 2500` for the 5-point win/lose bands. UNRESOLVED is not a pass.
- `balanceReport.ts 900`. Write the result as a checkpoint.
- Expect Null's edges to come back OUT. Check notes-for-owner.md first: if
  the owner answered the Watchdog Timer buff or the Null weakness flag, apply
  that before the gate. The Quorum Arbiter drop is still pre-authorized if
  Cortex-vs-Null is out. It's now 60.0, but that's Null's weakness, not
  Cortex's strength.
