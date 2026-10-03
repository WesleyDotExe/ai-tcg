# Current status

**Build-order stage: 3 (A real card set), still current, at the end of Phase 5
(pool expansion).** Session 26 was a balance session (the last merged PR, #35,
was render). It ran the mandatory Phase 5 gate (step iii). **The gate did not
pass.** A checkpoint is waiting on the owner (top of `checkpoints.md`).

## What stands (this session's work; sessions 1-25 otherwise unchanged)

**Watchdog Timer buff** (owner-feedback 2026-10-02 item 1,
`engine/src/data/nullCards.ts`): draws at end of turn when the hand has 1 card
or fewer (was: empty only). 23 -> 102 draws per 900 Lookahead games; Null
40.1 -> 40.4% on the same 7,500 games (noise). The test now covers hand sizes
0/1/2/3.

**The gate** (Lookahead, interval verdicts; 2,500 seeds for win/lose bands, 900
for even bands):

| Edge (target) | rate | verdict |
|---|---|---|
| Null > Aegis (55-60) | Null 42.0 | OUT |
| Aegis > Cortex (55-60) | Aegis 52.2 | OUT |
| Cortex > Swarm (55-60) | Cortex 57.4 | IN |
| Swarm > Null (55-60) | Swarm 59.4 | UNRESOLVED |
| Null ~ Cortex (45-55) | Null 40.7 | OUT |
| Aegis ~ Swarm (45-55) | Aegis 51.2 | IN |

`balanceReport.ts 900`: no triple-flag.

**Levers measured, not shipped:**
- Quorum Arbiter drop (`dev/phase5GateLevers.ts`): Cortex-vs-Null -2.7 /
  -1.0 (gate / held-out seeds); the edge stays OUT. Not dropped.
- Null lift menu (`dev/nullLiftProbe.ts`): +1 atk / +1 hp on each of 12 Null
  units. Recommended to the owner: Propagating Exploit 2/2 -> 2/3. Held out:
  Null vs Cortex 48.0 (IN), vs Swarm 43.6 (IN), vs Aegis 50.5 (still OUT).

**Tooling:** `dev/nullCardPlayCheck.ts` now records the hand size behind each
Watchdog draw (a Watcher wraps both agents and reads state between moves) and
has `--show-watchdog`.

## Evidence committed

- `progress/balance-report-020-phase5-gate.txt`: the buff before/after, all
  eight gate runs, the verdict table, both lever measurements with held-out
  confirmation, the full lift screen, and `balanceReport.ts 900`.
- `progress/sample-match-027-watchdog-buff.txt`: a full game where Watchdog
  Timer draws into a 1-card hand.
- `npm test` 302/302 across all five workspaces (engine 128). `tsc --noEmit`
  clean in all five.

## Concrete next step

Next session is **render** (alternation). Per owner-feedback 2026-10-03:
implement `render/EFFECTS.md` v2 in its build order, slice 1, porting from
`render/reference/effects-lab.html`. Also write the `signatureAbilities`
proposal for existing Rares/Mythics into notes-for-owner.md, and surface any
Mythic ward previews from `progress/render/mythic-wards-log.md`.

The next **balance** session:
1. Read owner-feedback.md for answers to the gate checkpoint (Quorum Arbiter,
   the Propagating Exploit lift, Aegis > Cortex).
2. Apply them, then re-run only the changed edges at the gate seed counts:
   `lookaheadEdgeCheck.ts <Faction> 1 2500` (and `1 900` for even bands), plus
   a held-out range (2501-5000).
3. If the owner hasn't answered, don't apply a lift. Probe Aegis > Cortex
   instead: adapt `nullLiftProbe.ts` to Aegis units and look for a lift that
   moves Aegis-vs-Cortex without moving Aegis-vs-Null or Aegis-vs-Swarm.
   Or start the event-log instance IDs (owner-feedback 2026-10-03, balance
   lane item b), which doesn't depend on the ring.
