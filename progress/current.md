# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 6, a
normal (non-hardening) session — it picked option 1 from session 5's
concrete-next-step note: backfill Cortex and Swarm with the board-development
system (telegraph, evolution, Tool cards) that stage 3 had built but left
Aegis-exclusive. `progress/owner-feedback.md` had no new unhandled entries
this session (the last entry was already marked HANDLED by session 5).

## What stands (changes from this session; everything from sessions 1-5
## otherwise unchanged — see prior `progress/log.md` entries for that)

- **`engine/src/data/cards.ts`** — four new Cortex cards and three new
  Swarm cards, each exercising a mechanic combination the Aegis set didn't:
  - **Cortex evolution line:** Init Daemon (CX-015, 1/2 vanilla) evolves
    into Compiled Daemon (CX-016, 3/3, evolve-in deals 2 damage to a random
    enemy — a damage evolve payoff, next to Aegis's energy-gain/heal+Barrier
    ones).
  - **Cortex telegraph:** Dormant Exploit (CX-017, 1/3, telegraph 1) arms
    into a 2-turn Stasis stun on a random enemy — a telegraph arm effect
    that applies a *status*, not damage (Perimeter Turret) or Barrier
    (Latent Ward).
  - **Cortex Tool:** Overclock Shunt (CX-018, +1/+0, grants Rush) — the
    first Tool-granted keyword that changes what a unit can legally *do*
    (attack the turn it's played) rather than just how attacks resolve
    against it (Guard/Barrier).
  - **Swarm evolution line:** Molted Stalker (SW-011, 4/3, evolve-in draws a
    card) evolves from **Swarm Larva (SW-001)**, an existing stage-1 card
    never designed with evolution in mind — proving the system retrofits
    onto old cards, not just purpose-built bases.
  - **Swarm telegraph:** Dormant Egg Sac (SW-010, 0/4, telegraph 1) arms
    into 3 damage to a random enemy (the same shape as Perimeter Turret,
    scaled up — a deliberate reuse where a straightforward effect already
    fit, not every card needs a novel payload).
  - **Swarm Tool:** Chitin Plating (SW-012, +0/+3, no keyword) — a plain
    stat-bonus Tool, Swarm's analogue to Aegis's Plating Module.
  - Deck totals: Cortex 32 → 40 cards, Swarm 23 → 30 cards — both still
    inside `decks.ts`'s enforced [20, 40] range (Cortex now sits exactly at
    the ceiling; re-check this range if a future session wants to add more
    Cortex cards).
- **`engine/test/boardDevelopmentBackfill.test.ts`** (new, 5 tests) —
  whitebox tests for all six new cards' mechanics: Compiled Daemon's
  evolve-in damage, Dormant Exploit's telegraph-then-Stasis, Overclock
  Shunt's Rush grant actually letting a same-turn unit attack (not just
  flipping the keyword flag), Molted Stalker evolving from the pre-existing
  Swarm Larva and drawing a card, and Dormant Egg Sac's telegraph damage +
  Chitin Plating's stat bonus. `matchSmoke.test.ts` (unchanged) already
  covers the enlarged decks for free, since it builds decks from
  `CORTEX_CARDS`/`SWARM_CARDS` directly.
- **`engine/src/dev/backfillMatchDemo.ts`** (new) — searches real
  Cortex-vs-Swarm games (same approach as `aegisMatchDemo.ts`) for one where
  **both** sides' new telegraph/evolve/tool cards fire in the same
  unscripted game. Found on **seed 8** (of up to 3000 searched — hit on the
  first handful, not a long tail). Committed as
  `progress/sample-match-006-backfill.txt`.
- **`progress/quality-debt.md`** — marked the "Cortex and Swarm don't use
  telegraph/evolution/tools" stage-3 debt item resolved (with the caveat
  below), fixed a stale claim in the Testing section ("no CI wiring" — the
  CI workflow was actually added in session 5; the debt file just never got
  updated to say so), and logged this session's new debt.

## Evidence committed

- `npm test`: **25/25 vitest tests pass** (20 pre-existing + 5 new), ~1s.
- `npx tsc --noEmit` clean in all four packages (`engine`, `protocol`,
  `server`, `agents`).
- `progress/sample-match-006-backfill.txt` — a real, unscripted
  Cortex-vs-Swarm match (seed 8) where Dormant Exploit and Dormant Egg Sac
  both telegraph and arm, Compiled Daemon and Molted Stalker both evolve in,
  and Overclock Shunt and Chitin Plating both attach — all six new-card
  mechanics firing on both sides in one game. The match ran to the 41-turn
  cap (health tiebreak) rather than a typical ~16-turn resolution; see the
  pacing check below for why that's not treated as a regression.
- **Pacing re-check after enlarging the decks** (Cortex 32→40 cards, Swarm
  23→30): ran a 200-seed, throwaway (not committed) Cortex-vs-Swarm stress
  script after the change. Mean 16.3 turns, median 15, only 1/200 (0.5%)
  reached the turn cap — consistent with the pre-backfill ~16-17 turn mean
  reported since session 1. Enlarging the decks by ~25% did not
  meaningfully shift pacing; the one demo-log game that did hit the cap is
  within that same ~0.5% baseline rate, not a sign the backfill slowed
  games down.

## Decisions made this session the owner might want to overrule

- **Cortex and Swarm each got exactly one evolution line, one telegraph
  card, and one Tool** — matching variety, not matching Aegis's *volume*
  (Aegis has two telegraphed units and three Tools). This was a deliberate
  "prove the system is cross-faction" scope, not a "give every faction
  equal depth" one; if the owner wants Cortex/Swarm brought up to Aegis's
  level of board-development density, that's a further, larger backfill.
- **Molted Stalker evolves from Swarm Larva**, an existing stage-1 vanilla
  card already played as a generic 1-drop in 3 copies, rather than a new
  dedicated base card (the Aegis Cadet pattern). This was a deliberate
  choice to prove the system retrofits onto pre-existing cards, but it
  means Swarm Larva now has two roles (disposable 1-drop, evolution fodder)
  that a deck-builder has to weigh against each other — untested as a real
  deck-building tension, just noted as intentional.
- **Cortex's deck is now exactly at the 40-card ceiling.** Any future
  Cortex addition needs either a cut elsewhere in the pool or the
  `MAX_DECK_SIZE` constant (currently 40, itself a first proposal per
  session 4) to move.
- **Dormant Exploit's arm effect is a 2-turn Stasis stun**, not the
  1-turn duration Corrosive Spitter's onAttack stun uses elsewhere in the
  Cortex pool — chosen so the telegraph payoff (something you had to see
  coming and could have answered) reads as meaningfully bigger than a cheap
  incidental stun, not because 2 turns is a tuned number.

## Concrete next step

No unhandled owner feedback remains. Legitimate options for the next
session, per the same reasoning as session 5's note:
1. **Bring Cortex/Swarm's board-development density up toward Aegis's**
   (more telegraph/evolution/tool cards per faction) — now blocked by
   Cortex's deck sitting at the 40-card ceiling unless something is cut or
   `MAX_DECK_SIZE` is revisited.
2. **A fourth faction** (Null is reserved in the `Faction` type but unused).
3. **Start measuring design principle 3** (archetype-level soft counters) —
   three factions have existed since session 4 with zero balance/counter
   analysis done between them; this is genuine debt, not urgent, but it's
   the kind of thing that gets harder to fix the more card-set width piles
   up without it.
4. **Non-engine testing debt** — `server`/`protocol`/`agents` still have
   zero automated tests (named since session 3); the vitest infrastructure
   now exists and extending it to those packages is comparatively cheap.

Any of these is legitimate; whichever is picked, new mechanics should keep
getting real vitest coverage (as this session did), not a new demo script.
Stage 4 (match server hardening) stays correctly blocked until a richer
economy needs it.
