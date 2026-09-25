# Current status

**Build-order stage: 3 (A real card set) — still current, now inside Phase 5
(pool expansion).** Session 19 (balance session — the alternation rule in
owner-feedback.md's 2026-09-24 entry means this session did the normal
balance/roadmap priority, since the most recently merged PR (#21) was a
render slice).

This session acted on owner-feedback.md's 2026-09-25 "accept the ring as
directionally done; start Phase 5" entry — the highest-priority unhandled
feedback. Phase 5 slice 1: grew Aegis's pool from 18 to 22 unique cards,
specifically aiming new cards at the still-open Aegis-vs-Cortex pairing per
the entry's item 3.

## What stands (this session's work — everything from sessions 1-18
## otherwise unchanged, see prior `progress/log.md` entries)

**Aegis pool grown 18 -> 22 unique cards** (`engine/src/data/aegisCards.ts`).
Four new cards, all real, immediate board stats (not reactive utility):
- **Bulwark Chassis** (Common, cost 2, 1/3, no ability) — a stat-only wall.
- **Reinforced Bastion** (Uncommon, cost 3, 2/4, Guard) — a second,
  higher-cost print on the Guard-wall archetype Barrier Drone started
  (variation rule).
- **Salvage Reflex** (Uncommon, cost 2, 2/3, onDeath: a random ally gains
  Barrier) — a new archetype: converts a removal spell spent on it into
  protection elsewhere.
- **Aegis Line Trooper** (Common, cost 1, 2/1, no ability) — Aegis's first
  1-drop with real attack pressure (existing 1-drops are both
  passive/defensive).

Funded by data-driven trims of the pool's own measured weakest cards
(balance-report-012's per-card table), not guesses — Diagnostic Ward,
Static Ward Beacon, Barrier Shim, Latent Ward, Lockdown Field, Barrier
Drone, Failover Custodian, Breach Charge each lost 1-2 copies, none removed
from the deck entirely. Deck stays at exactly its 40-card cap; pool lint,
copy limits, and deck size all still pass.

**Honest journey: the first stat line was overtuned, caught by this
session's own re-measurement, and corrected before shipping.** Bulwark
Chassis 1/5 + Reinforced Bastion 2/6 Guard (the first cut) made Aegis
generically too strong — not just vs Cortex, but vs Swarm and Null too
(Null-vs-Aegis under Lookahead dropped to 29.7% Null). Not shipped. Scaled
back to stat lines explicitly benchmarked against existing same-cost cards
(Cortex Engineer's 1/3, Firewall Sentinel's 2/5 Guard, Signal Drone's 1/1),
then re-measured again.

**Result: Aegis-vs-Cortex is no longer triple-flagged** — the project's
actual pass/fail bar — for the first time across three sessions that tried
(11, 18, this one). Random 58.7% and Lookahead 59.3% land IN the 55-60%
target band; Aggressive sits at 47.0% (out of band, Cortex-favoured, but not
extreme — consistent with this project's standing read that Aggressive is
the least trustworthy policy). Cortex-vs-Swarm remains the only
triple-flagged pairing, untouched this session exactly as instructed.

**Named honestly, not chased further:** Aegis-vs-Swarm (an "even" 45-55%
target pairing) drifted to 57.7/71.0/70.7% Aegis — real collateral movement
from Aegis getting generically stronger. Not triple-flagged (Aggressive
stays under the independent 60% flag threshold), but a genuine new watch
item, correctly left for a future session (Swarm's own Phase 5 growth, or
Aegis-side re-tuning) rather than chased inside this one-faction slice.

## Evidence committed

- `progress/balance-report-013-phase5-slice1.txt` — full 300-seed, 3-policy
  report: the overtuned first cut is NOT in this file (never committed,
  caught pre-ship); this is the corrected, shipped result.
- `progress/sample-match-020-phase5-slice1.txt` — two real, unscripted
  LookaheadAgent-vs-LookaheadAgent Aegis-vs-Cortex matches: one where
  Salvage Reflex's onDeath ability grants a random ally Barrier (seed 6),
  one where Bulwark Chassis survives a real Cortex point-removal spell
  (seed 8). Found via `engine/src/dev/phase5Slice1MatchDemo.ts`.
- `engine/test/aegisPoolExpansion.test.ts` — 4 new whitebox tests: Salvage
  Reflex grants Barrier with an ally present, no-ops cleanly dying alone,
  never targets itself with 2+ allies present, and the pool still builds a
  legal 40-card deck at 22 unique cards.
- `npm test` (root, all five workspaces): 86/86 engine (was 82), 147/147
  total. `npx tsc --noEmit` clean in all five packages.

## Decisions made this session the owner might want to overrule

See `progress/checkpoints.md`'s new entry and `progress/notes-for-owner.md`.
In short: the exact new stat lines and copy counts (an evidence-led guess,
scaled back once but not iterated further after landing in band); which
existing cards absorbed the copy trims (picked by lowest measured win rate,
not design intent); and the decision to scope this slice to Aegis only
rather than attempt all four factions' Phase 5 growth in one session.

## Concrete next step

Phase 5 is a multi-session effort (roadmap items 8-11: each faction to
30-40 unique cards, the variation rule, a neutral shared pool, per-card art
slots). The next balance session should either continue Phase 5 with
another faction (Cortex, Swarm, or Null — Swarm's own growth is a natural
next pick, since it's now named in two open watch items: Cortex-vs-Swarm
pre-existing, Aegis-vs-Swarm newly drifted) or, if the owner steers
otherwise, follow that instead. The owner's 2026-09-25 "hard gate" item 4
(re-measure the whole ring at the end of Phase 5's "first full pass") is
NOT due yet — that's once every faction has had at least one Phase 5 growth
pass, not after just Aegis's.

Two small, explicitly-optional items are still open from other 2026-09-25
owner-feedback entries and can be picked up whenever convenient on a future
balance session: adding instance IDs to the event log (a small, additive
engine change; not blocking, but "before stage 7"), and — render-lane only,
not for a balance session — scaling animation magnitude to event
significance.

Per RENDER.md's alternation rule, the next session should be a render
slice (this session's own PR is the "balance" slice the rule alternates
against).
