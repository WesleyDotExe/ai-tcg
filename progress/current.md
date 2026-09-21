# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 15.

The 2026-09-20 owner-feedback entry ("balance is a systems problem; fix the
loop, then expand the pool") lays out six phases, explicit order, each done
before the next. Session 12 did Phase 1 (fix the instrument). Sessions 13-14
did Phase 2 in full (directive removal, summon effect kind, base armor).
**This session did Phase 3 — the load-time card-pool lint — in full**, per
the owner's 2026-09-21 explicit direction to proceed to it.

## What stands (this session's work — everything from sessions 1-14
## otherwise unchanged, see prior `progress/log.md` entries)

**A real, generic, data-driven pool lint (`engine/src/cards/poolLint.ts`),
enforced at load time.** Wired into `data/decks.ts`'s `buildDeck` — every
deck any part of the engine builds (a real match, a test, `balanceReport.ts`)
now runs the lint first and throws with a specific, itemised message if a
rule is broken, exactly like the existing copy-limit/deck-size checks it
sits next to. Four rules, matching the entry's own numbers exactly (25%,
cost+1, cost 4):

1. **Removal/debuff cards <= 25% of a deck.** "Removal/debuff card" is this
   session's own first-cut formalisation (the entry names the rule but not
   the classifier) — an `onPlay`/`static`/`activated` ability whose effect
   destroys, damages, or negatively-buffs the opponent, or a static aura/tax
   that debuffs them. Reactive triggers (`onAttack`/`onDamaged`/`onDeath`/
   `onTurnStart`/`onTurnEnd`) are deliberately excluded — a unit's secondary
   "it happens to graze the opponent when it dies" effect is not the same
   deck-building commitment as a Command or a standing aura. Flagged as a
   checkpoint-style proposal in `notes-for-owner.md`, not treated as settled.
2. **No targeted (chosen/random-scope) damage above cost+1 under 3 mana.**
   No card in the current pool violated this one — nothing needed to change
   for it, it's enforced going forward.
3. **No permanent enemy-stat aura under 4 mana.** Caught exactly one card:
   Null's Segmentation Fault (cost 3, a continuous -1/-0 enemy aura) —
   fixed by raising its cost to 4, text/identity untouched.
4. **Every faction pool has both a clock (can pressure the opponent's
   health) and card flow (can draw cards).** Caught Null specifically: its
   14-card pool (before this session) had zero `drawCard` anywhere.

**Measured against the real pools, not guessed:** Cortex measured at 32.5%
removal density (over the cap) and Null at 50% (over the cap, plus the aura
and card-flow failures above) — Swarm (11.4%) and Aegis (23.1%) already
passed cleanly with no changes. Fixed both:

- **Cortex** — a copy-count rebalance only, no ability changes: Cascade
  Purge/Interrupt Handler/Dormant Exploit trimmed by 1 copy each, backfilled
  onto Watchtower Relay/Init Daemon/Overclock Shunt (each below their own
  rarity's copy cap) so the pool stays at exactly 40 cards. Now 25.0%.
- **Null** — real redesign, not just cuts, per the entry's own "cutting or
  redesigning ... that's intended": **Corrupted Process**'s evolve effect
  changed from "deal 3 damage to a random enemy unit" to "draw a card" —
  this single change both removes a removal effect from the density count
  *and* fixes rule 4's card-flow failure at once (mirrors Swarm's Molted
  Stalker, an existing evolve-and-draw card). **Fork Bomb**'s arm effect
  changed from "deal 1 damage to all enemy units" to "create two 1/1 Fork
  Child tokens" — a genuine flavour upgrade (a fork bomb's real mechanism is
  spawning copies of itself, which "creates tokens" reads more literally
  than "deals damage" ever did), and it gives Null a rebuild tool it had
  never had. Segfault Handler/Deprecated Routine/Segmentation Fault trimmed
  to 1 copy each; Kernel Panic/Null Singularity/Null Pointer (the evolution
  finisher, the Mythic capstone, and the structurally-required per-faction
  directive-answer) were left untouched rather than cut further. Now 25.0%,
  exactly at the cap, with real card flow and no cheap aura.

## Evidence committed

- `engine/test/poolLint.test.ts` — 9 new tests: each of the four rules
  fires on a minimal synthetic pool built just for that rule (so a failure
  points at exactly which rule broke), the reactive-trigger exclusion and
  the redirectAttack/heal/draw non-classification are pinned directly,
  `buildDeck` itself (not just `lintCardPool` in isolation) is proven to
  enforce it, and all four real faction pools are asserted to build clean.
- `engine/test/nullFaction.test.ts` — the old Fork Bomb AOE-damage test was
  replaced with one asserting the new summon (two real Fork Child tokens,
  correct stats) — the mechanic changed, so the test needed to change with
  it, not just be deleted.
- `progress/sample-match-016-poollint.txt` — a real, unscripted, seed-found
  `LookaheadAgent`-vs-`LookaheadAgent` match (Null vs Cortex, seed 3, found
  on the third seed tried) where **both** redesigned Null effects fire for
  real: Fork Bomb arms and summons two Fork Child tokens, and later Glitch
  Seed evolves into Corrupted Process and actually draws a card (which then
  itself evolves into Kernel Panic later in the same match).
- `npm test` (root, all four workspaces): **124/124 passing** (77 engine —
  up from 68 — + 7 protocol + 23 server + 17 agents). `npx tsc --noEmit`
  clean in all four packages. (One server integration test —
  `closes a third connecting socket...` — is flaky under a full concurrent
  run but passes reliably alone; this is `server/`, untouched this session,
  and matches session 9's own named debt about that test's timing
  sensitivity, not a regression from this session's changes.)
- `progress/balance-report-009-poollint.txt` — full 300-seed, three-policy
  re-measurement after the pool changes, for comparison against
  `balance-report-008-basearmor.txt` (the pre-session baseline).

## Honest read on what the re-measurement found

**Structural goal met; raw balance did not improve — if anything, Null got
stronger, not weaker.** The cross-check result is unchanged in kind: still
exactly Cortex-vs-Swarm and Aegis-vs-Null triple-flagged, same two pairings
as every session since 12. Underneath that, most individual numbers moved
the WRONG direction for the factions Null was already beating:
Aegis-vs-Null went from 76.0%/73.7%/64.7% to 78.3%/78.3%/67.7%
(Aggressive/Random/Lookahead), and Swarm-vs-Null from 55.3%/74.0%/62.7% to
55.3%/80.7%/67.3% — both worse under Random and Lookahead specifically. The
plausible read: giving Corrupted Process real card draw, even while cutting
several of Null's weaker removal copies, made its deck *more consistent* at
finding its remaining strongest cards (Kernel Panic, Null Singularity, Null
Pointer, Segmentation Fault — none of which were touched), and card
advantage is generically powerful regardless of which faction holds it. Not
a universal regression, though: Cortex-vs-Null actually *improved* —
Lookahead dropped from 60.7% Null to 55.0% Null, no longer single-flagged
there, plausibly Cortex's own Force Quit/Init Daemon copy changes helping
it find directive-removal/board presence more often.

**Not chased or tuned further this session, correctly so.** This result is
exactly what the 2026-09-20 "Null dominance" owner-feedback entry
anticipated and pre-authorized a response for — *after* the Phase 4
re-measure, not before, and via ability nerfs, not more pool-shape changes.
Phase 3's job was the load-time lint itself, which is real, tested, and
enforced; Phase 4 (the intended counter triangle, defined and measured
against) is next, and is where this Null number gets addressed together
with Cortex-vs-Swarm, per the entry's own explicit order.

## Decisions made this session the owner might want to overrule

See `progress/notes-for-owner.md` for the full write-up — flagged there,
not just here, per the owner's own 2026-09-21 process reminder. In short:
the removal/debuff classifier's own definition (which triggers/effect kinds
count) is a first-cut formalisation, not something the entry itself spelled
out, and the honest "Null got stronger, not weaker" balance finding above.

## Concrete next step

Phase 4 of the 2026-09-20 owner-feedback entry: propose an explicit counter
triangle at a checkpoint (e.g. Null attrition beats Aegis stacking; Aegis
walls beat Swarm width; Swarm width beats Null's single-target removal;
Cortex flexible in the middle), then measure the real pool against it.
Targets: 55-60% for the intended edge, 45-55% elsewhere, under all three
policies — balance means matching the triangle, not 50% everywhere. This is
also where Cortex-vs-Swarm and Aegis-vs-Null (both still triple-flagged,
per this session's honest re-measurement above) finally get addressed
together, and where the standing "nerf Null's abilities" backstop
(2026-09-20 owner-feedback entry) becomes live if Null is still winning
60%+ against anyone after the triangle re-measure. Read
`progress/balance-report-009-poollint.txt` in full before starting.
