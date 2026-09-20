# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 14.

The 2026-09-20 owner-feedback entry ("balance is a systems problem; fix the
loop, then expand the pool") lays out six phases, explicit order, each done
before the next. Session 12 did Phase 1 (fix the instrument). Session 13
did Phase 2 item 3 (directive removal). **This session did Phase 2 items 4
and 5 — completing Phase 2 in full** — and stopped there rather than
starting Phase 3 half-scoped.

## What stands (this session's work — everything from sessions 1-13
## otherwise unchanged, see prior `progress/log.md` entries)

**Item 4 — a real, generic "summon" (token) effect kind.** Before this
session, `quality-debt.md`'s "Architectural gaps" section named this
explicitly: "No 'summon' effect kind. Can't create token units." Fixed
generically: `EffectSpec` gained a `"summon"` variant carrying a
self-contained `TokenSpec` (name/faction/attack/health/keywords/art/flavor
— a token has no printed card of its own to reference) and a `count`;
`effects/resolver.ts`'s new `summonTokens` creates real `UnitInstance`s
directly on the controller's board, respecting the same shared
`BOARD_SLOTS` cap (`state/queries.ts`'s new exported `boardSlotsUsed`, also
now shared with `moves.ts` instead of duplicated) every other Unit/Directive
entering play respects — if there isn't room for every token, as many as
fit are created and the rest fizzle, logged (`summonFizzle`), not silently
dropped. A token behaves exactly like any other unit from the moment it
lands (buffable, evolvable-onto, attachable, dies to the graveyard).
**Swarm's Brood Reserves** (Command, cost 3, Uncommon, 3 copies) is the
first card to use it — summons two 1/1 Swarm Larva tokens, directly
answering the entry's named motivation ("Swarm has no way to rebuild after
board-wide damage"). `LookaheadAgent` was updated in the same pass
(`effectValueOverTargets`'s new `"summon"` case) so it doesn't repeat
session 12/13's "silently scores zero forever" bug class for the new kind.

**Item 5 — bases carry a small protection while unevolved, proposed and
built as instructed.** `UnitCard` gained an optional `baseArmor: number`
field: a flat reduction to incoming damage (floored at 0), read directly off
`unit.card` in `effects/resolver.ts`'s `applyDamage` — the single choke
point for both effect damage and combat damage, so both are covered by one
mechanism. Because evolving mutates the same instance's `card` to the
evolved form (which carries no `baseArmor` of its own once past the tier
this protects), the protection ends automatically the instant a unit
evolves — no separate per-instance bookkeeping needed. **Proposed value: 1,
applied to every current evolution-line base** (Aegis Cadet + Sentinel,
Null Glitch Seed + Corrupted Process, Cortex Init Daemon, Swarm Larva) — a
first proposal, explicitly flagged below as not owner-confirmed, per the
entry's own instruction to propose the mechanism at a checkpoint rather
than finalise it unilaterally.

## Evidence committed

- `engine/test/summon.test.ts` — 5 new tests: real token creation with
  correct stats, a token behaving exactly like any other unit (attacks,
  takes damage, dies to the graveyard), the board-slot cap partially and
  fully blocking a summon with a logged fizzle, and `LookaheadAgent`
  correctly preferring the play over passing.
- `engine/test/baseArmor.test.ts` — 8 new tests: every current base/top-tier
  card's `baseArmor` value is correct, damage is reduced and floored at 0
  with the reduction logged, a fully-absorbed hit doesn't fire onDamaged or
  consume Barrier, evolving ends the protection on the very next hit (proven
  through two real evolution steps: Cadet -> Sentinel keeps armor, Sentinel
  -> Warden loses it), and combat damage is mitigated the same as effect
  damage (same `applyDamage` choke point).
- `progress/sample-match-014-summon.txt` / `progress/sample-match-015-basearmor.txt`
  — real, unscripted, seed-found `LookaheadAgent`-vs-`LookaheadAgent`
  matches (found on the first seed tried, both) where Brood Reserves
  actually summons tokens and Aegis Cadet's armor actually absorbs/reduces
  real damage 8 times in one match.
- `progress/balance-report-007-summon.txt` / `progress/balance-report-008-basearmor.txt`
  — full 300-seed, three-policy re-measurements after each item, run
  separately so each item's own effect on the numbers is visible.
- `npm test` (root, all four workspaces): **115/115 tests pass** (68 engine
  — up from 55 — + 7 protocol + 23 server + 17 agents).
- `npx tsc --noEmit` clean in all four packages.

## Honest read on what the re-measurements found

**Item 4 (summon):** did not help Swarm's flagged pairings. Brood Reserves
itself measures below average under all three policies (46.5%/41.2%/43.4%,
versus other Swarm cards clustering 50-55%), and Cortex-vs-Swarm got
measurably worse for Swarm (60.7% -> 66.0% under Aggressive). Read as the
dummy policies not understanding "hold this for after a wipe" timing — see
`quality-debt.md`'s new session-14 entry for the full reasoning. **Not
tuned or reverted this session** — per the owner's own explicit
"Phases 1-4 come before any further balance work on Cortex-vs-Swarm/
Aegis-vs-Null" instruction, and because the mechanism itself (the actual
Phase 2 item 4 ask) is correctly built and proven; a below-average first
card is a card-tuning question for Phase 5, not a reason to touch the
engine mechanism.

**Item 5 (base armor):** a real, broader shift than item 4's, since it
touches a base card in every faction at once. Cross-check result unchanged
in kind (still exactly Cortex-vs-Swarm and Aegis-vs-Null, the same two
pairings as before this session) — no new pairing was pushed over the flag
threshold and neither existing one dropped below it. Underneath that,
individual numbers moved, most visibly Cortex-vs-Aegis: 71.0% -> 63.7%
Aggressive (still flagged, but less dominant), and a real flip under Random
from 56.7% Cortex-favoured to 57.3% *Aegis*-favoured — plausible and
thematically fitting (Aegis is the faction whose defensive "hardened
guardian" identity most directly benefits from a damage-mitigation
mechanic, and it has 2 of the 6 armored cards), not chased or verified by
isolation this session. Aegis-vs-Null improved a few points under Lookahead
(30.0% -> 35.3% Aegis) but remains clearly double/triple-flagged. None of
this was tuned further — per the owner's own order, Phase 3/4 comes next,
not more card-by-card response to these numbers.

## Decisions made this session the owner might want to overrule

- **Brood Reserves was made Sorcery-speed, cost 3, Uncommon, 3 copies** — a
  first proposal (the entry didn't specify numbers). Sorcery rather than
  Instant was a judgment call: this is a "take your turn back" rebuild play,
  not a reactive insurance card like Aegis's Instant-speed defensive kit, so
  it didn't need Instant timing the way those did.
- **`baseArmor: 1` was applied uniformly to every current base card, not
  varied per faction or per specific card** — per the entry's own explicit
  instruction to propose the mechanism at a checkpoint, this is exactly
  that proposal, not a finalised, owner-confirmed number. Whether it should
  vary (e.g. Aegis's defensive identity earning a higher value, or a
  faction like Cortex earning a lower one to preserve its glass-cannon
  curve) is open.
- **A base's own evolved-form-that-is-also-a-base (Aegis Sentinel, Null
  Corrupted Process) keeps `baseArmor` too, not just the tier-1 card** — read
  as the correct interpretation of "while unevolved" (a mid-tier card is
  just as unevolved-past-its-own-tier as a tier-1 card is), not explicitly
  spelled out in the entry, so flagging the interpretation explicitly in
  case the owner meant something narrower (tier-1 bases only).

## Concrete next step

Phase 3 of the 2026-09-20 owner-feedback entry: a card-pool lint that fails
to load a deck breaking a rule (removal/debuff cards <= 25% of a deck; no
targeted damage above cost+1 under 3 mana; no permanent enemy-stat aura
under 4 mana; every faction pool has both a clock and card flow) —
"tune at a checkpoint" per the entry's own instruction, so propose the
specific thresholds there rather than guessing silently. Read the full
entry in `progress/owner-feedback.md` before starting; note the lint is
expected to force cuts/redesigns in Null's pool specifically (named in the
entry's Null-dominance follow-up as intended). Do not resume Aegis-vs-Null
or Cortex-vs-Swarm tuning directly — Phase 4's re-measure is where both get
addressed together, per the entry's own explicit order, and both are
honestly re-reported above, not silently dropped.
