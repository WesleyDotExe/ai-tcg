# Current status

**Build-order stage: 3 (A real card set) — still current, now inside Phase 5
(pool expansion).** Session 20 (balance session — the alternation rule in
owner-feedback.md's 2026-09-24 entry means this session did the normal
balance/roadmap priority, since the most recently merged PR (#24) was a
render slice).

No unhandled owner feedback and no CRITICAL quality-debt item at session
start. Consulted `progress/roadmap.md` (item 3, the balance pass, IN
PROGRESS inside Phase 5) and the owner's own 2026-09-26 "session 19
confirmations" entry, which named Swarm as the natural next Phase 5 pick.
This session did that: Phase 5 slice 2 — grew Swarm's pool from 16 to 20
unique cards, a general power-level pass (not a single-pairing aim, since
Swarm was the baseline-worst faction across three of its four matchups).

## What stands (this session's work — everything from sessions 1-19
## otherwise unchanged, see prior `progress/log.md` entries)

**Swarm pool grown 16 -> 20 unique cards** (`engine/src/data/cards.ts`).
Four new cards, all real, immediate board stats (not reactive utility):
- **Brood Skitterer** (Common, cost 1, 1/2, no ability) — fills the gap for
  a cross-faction-median vanilla 1-drop; Swarm's existing cheap bodies were
  all below it.
- **Carapace Grunt** (Common, cost 2, 2/2, no ability) — Swarm's first
  plain cost-2 stat body; every existing one carried an ability.
- **Warren Guardian** (Uncommon, cost 3, 2/3, Guard) — Swarm's first Guard
  unit, printed below both established cost-3 Guard benchmarks on purpose
  (numbers, not individual toughness, is the faction's identity).
- **Bloodswarm Alpha** (Rare, cost 4, 3/3, onPlay: summon a 1/1 Swarm
  Larva) — real board presence plus immediate width, unlike Brood
  Reserves' pure (and measurably weaker) summon spell.

Funded by data-driven trims of the pool's own measured weakest cards (this
session's own baseline report), not guesses — Rally Cry, Barrier Node,
Reflex Spike, Dormant Egg Sac, Chitin Plating, Spore Cluster, and Brood
Reserves each lost 1-2 copies, none removed from the deck entirely. Deck
stays at exactly its 40-card cap; pool lint, copy limits, and deck size all
still pass.

**Honest journey: the first stat line was overtuned, caught by this
session's own re-measurement, and corrected before shipping — same pattern
as session 19.** The first cut (Brood Skitterer 2/1, Carapace Grunt 3/1,
Warren Guardian 3/3 Guard, Bloodswarm Alpha 4/4+summon — matching Aegis's
own strongest-testing cards stat-for-stat) made the whole Swarm deck
generically too strong: every card's win rate jumped uniformly, and
Cortex-vs-Swarm flipped from Cortex-dominant (60-70%) to Swarm-dominant
(57-66%). Not shipped. Scaled every new card back below its original
benchmark, then re-measured again.

**Result: no cross-faction pairing is triple-flagged at all** — the
project's sole standing triple-flag, Cortex-vs-Swarm, is resolved. Per-card
win rates across the whole Swarm pool now cluster sanely around 48-56%
instead of the first cut's uniform 55-65%+ spike. Aegis-vs-Swarm (the
watch item session 19 left open) is back in band on 2 of 3 policies,
including Lookahead, the trusted arbiter.

**Named honestly, not fully resolved:**
- **Cortex-vs-Swarm overshot past even into mild Swarm-favour** rather than
  landing at the ring's actual target (Cortex should win 55-60%) — squarely
  inside what the owner's 2026-09-23 entry anticipated ("Phase 5 wider
  pools will likely settle it... do not add a card or nerf anyone
  specifically for this pairing"), but a new watch item, not a clean
  settle.
- **Swarm-vs-Null remains unresolved, in a new shape:** Aggressive and
  Lookahead now favour Swarm (61-64%), Random still favours Null (64.0%,
  down from 75.7% baseline) — real movement, but policy disagreement, not
  a resolved pairing.

## Evidence committed

- `progress/balance-report-014-phase5-swarm-slice.txt` — full 300-seed,
  3-policy report: the overtuned first cut is NOT in this file (never
  committed, caught pre-ship); this is the corrected, shipped result.
- `progress/sample-match-021-phase5-swarm-slice.txt` — a real, unscripted
  LookaheadAgent-vs-LookaheadAgent Swarm-vs-Null match where BOTH new
  mechanisms fire: Bloodswarm Alpha's onPlay summon, and Warren Guardian's
  Guard forcing an attack onto it. Found on the first seed tried via
  `engine/src/dev/swarmPoolExpansionMatchDemo.ts`.
- `engine/test/swarmPoolExpansion.test.ts` — 3 new whitebox tests: Guard
  actually redirects attacks, the summon creates a real functional token,
  and the pool still builds a legal 40-card deck at 20 unique cards.
- `npm test` (root, all five workspaces): 89/89 engine (was 86), 176/176
  total. `npx tsc --noEmit` clean in all five packages.

## Decisions made this session the owner might want to overrule

See `progress/checkpoints.md`'s new entry and `progress/notes-for-owner.md`.
In short: the exact new stat lines and copy counts (an evidence-led guess,
scaled back once but not iterated further after landing in band); which
existing cards absorbed the copy trims (picked by lowest measured win rate,
same method as session 19); and choosing a broad power-level pass over
aiming at one specific pairing, since Swarm was weak against three of its
four opponents at once.

## Concrete next step

Phase 5 continues: Cortex and Null still need their own growth pass before
the owner's "hard gate" whole-ring re-measure (item 4) is due — that's
explicitly scoped to "the end of Phase 5's first full pass" (every faction
grown at least once), which this session does not complete on its own.
Null is the more natural next pick over Cortex: Cortex hasn't been named
as a problem faction since the ring correction, while Null still has an
open, named watch item (Swarm-vs-Null's Random-vs-other-policies
disagreement, above) that a Null-side Phase 5 slice could help settle
alongside its own growth. A future session should read this file's "named
honestly" section above before touching either Cortex-vs-Swarm or
Swarm-vs-Null again — both are real but not yet owner-steered.

Two small, explicitly-optional items are still open from other 2026-09-25
owner-feedback entries and can be picked up whenever convenient on a future
balance session: adding instance IDs to the event log (a small, additive
engine change; not blocking, but "before stage 7"), and — render-lane only,
not for a balance session — nothing else outstanding there as of this
session (see `progress/render/` for the render lane's own status).

Per RENDER.md's alternation rule, the next session should be a render
slice (this session's own PR is the "balance" slice the rule alternates
against).
