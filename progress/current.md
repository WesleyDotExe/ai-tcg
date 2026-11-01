# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 62 (game lane): NA12 and CS7
shipped. Nothing is blocking.** One [OWNER CHECK-IN] in notes-for-owner.md (results; one finding about
Null Out; no decision needed to continue).

- **Null Pointer** (NL-015) and **Force Quit** (CX-019) are "choose one" (Dereference / Null Out -3/-3;
  Terminate / Kill All 1 to all enemy units). The card registry hashes to session 61's measured NA12+CS7.
- **Removal cap:** Null 10/40 (exactly the cap), Cortex 9/40, unchanged; `engine/src/dev/removalCapCheck.ts`.
- **Finding:** max health floors at 1, so Null Out never kills an undamaged unit (measured that way; raised).
- **Rings:** `ring:real` failed before re-baselining on Null ~ Cortex (50.7 -> 57.1, the OK'd edge); both
  baselines re-recorded 2026-11-01; `ring` / `ring:real` PASS; `ring:signature` PASS. Built-deck ring
  `progress/built-deck-ring-004.txt` byte-identical to session 61's.
- **Evidence:** `progress/balance-report-038-old-edges-shipped.txt`, `progress/old-edges-ship/`,
  `progress/built-deck-ring-004/`.

## What stands (this session's work; sessions 1-61 otherwise unchanged)

- `engine/test/oldEdgesShipped.test.ts` (16 tests: both cards' modes in play, instant speed, base armor,
  the health floor, the agent, the removal cap; mutation-checked). `oldEdgesCandidates.ts` now rebuilds
  from the shipped modal cards (NA12/CS7 change nothing; NA8-10/CS8 still measurable).
- Render fallout: 9 replays, first-time and loadout-picker regenerated; the recorded empty-slot scenario on
  seed 9; three render tests updated (see the report, section 6).
- `npm test`: all six workspaces pass (engine 349, protocol 7, server 38, agents 17, economy 156, render 677).
  Typecheck clean in all six.

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #106, was the render lane's). If this
PR is the last merged, the next session is **render** (Season 0 render item 1, the desktop website, plus the
skip-hint follow-ups).

The next **game-lane** session (63): Season 0 game item 1, **match running and the ladder** (roadmap 6b).
A first slice: a server-side match runner that pairs connected agents (server-assigned opponents), plays the
match, records it through the store with each side's final health (the close-win boast), pays credits on the
daily win schedule, and calls `rebuildAgentDeckIfNeeded` between matches; then Glicko-2 per owner. Read
`economy/src/store.ts` (`startMatch` / `recordMatch`), `server/src/` and ECONOMY.md first. Prove it with a
run of many matches between house agents and a committed log. Owed hardening alongside: economy demos 014/016.

**Blocked:** nothing.
