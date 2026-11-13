# Checkpoints

Newest first. Each marks a completed build-order stage — flagged for the
owner's steering, never a block on continuing.

---

## AWAITING FEEDBACK — [OWNER CHECK-IN] Season 0's booster cards built: the set, S0-odds-3 and the re-pointed chase lists (2026-11-14, session 97)

Not a stage end: the check-in your "starter cards are Standard only" entry asked for ("shows the owner the new
lists"). The calls are in `progress/notes-for-owner.md` (session 97).

**Delivered, with evidence:** the 28 approved cards registered (`cards-2`; all 99 older cards unchanged); the set at
124 cards, the 96 keeping 001 to 096; `S0-odds-3` live, with S0-odds-2's numbers on booster cards only; the store
refusing special versions of starter cards; the Glitch list, illustrations and Prototype runs on booster cards.
`progress/pack-sim-004-booster.txt` (16 PASS): no starter card in 200,000 packs, the rates equal to S0-odds-2's,
each faction 25% of pulls, S0-odds-1 and S0-odds-2 still rolling exactly as before. Tests: 1,983 pass across the
workspaces (new: `engine/test/boosterCards.test.ts`, a Standard-only test in `economy/test/chase.test.ts`); 35 demos
reproduce; the ring regression check passes, unchanged.

**Strong:** old openings and replays are untouched (frozen legacy set, card versions). The deck builder takes booster
cards on its own and they resolve in real matches.

**Thin:** the balance re-run is not done, so the booster cards are in packs at untuned numbers (Null was +17 in the
probe). The codes S0-SR01... and S0-P01... now name new cards (fine for a fresh launch file). The website hasn't been
looked at with the new set.

**Decisions you might overrule:** the three lists, Gold numbers on booster cards only (125 to 152), the 7 unpacked
neutrals now craft-only, and a tournament finish still allowed on a starter card (calls 1 to 6).

**Next:** game 98, the balance re-run to call 3's target (call 8's fallback if it fails), then the ring regression
check and the dry run on cards-2. Render 75: the booster cards on the site.

---

## AWAITING FEEDBACK — [OWNER CHECK-IN] Season 0's booster cards: the proposed list (2026-11-14, session 96)

This is not a stage end. It is the check-in your option B entry asked for before the build. The proposal is in
full in `progress/booster-proposal-s0.md`, with 8 calls; the short version is in `progress/notes-for-owner.md`.

**Delivered, with evidence:** 28 cards, 7 per faction (2C/2U/2R/1M), as draft data the engine checks
(`engine/src/dev/boosterDraft.ts`). Every card passes the deck rules and the lint inside its starter deck, and every
card was played and every ability resolved in real matches. The first power read
(`progress/booster-proposal-005.txt`): with its whole package in, each starter deck gains Cortex +10.8, Swarm +9.3,
Aegis +12.7, Null +17.1 points against the field.

**Strong:** no new mechanics. Each card does its faction's existing job. The engine's own rules shaped two cards
(the 25% removal cap, the card-flow rule).

**Thin:** the probe is a fixed swap, not the store's builder. A blank-body control gains as much as the cards, so
the gain mostly measures the starter decks' weakest cards being cut. Null is above the proposed band.

**Decisions you might overrule:** the rarity split, no neutral booster cards, the numbering, the pack slots, the
upgrade target (+8 to +12), and the fallback if the re-run fails. All of them are calls in the proposal.

**Next:** the build in your entry's order, once you've answered.

---

## AWAITING FEEDBACK — Stage 3 (a real card set) closed: Phase 5 done, balance becomes a regression check (2026-10-04, session 27)

You told me to close Phase 5 and move the lane on to building the game. This is the end of
build-order Stage 3, so it gets a checkpoint. Nothing here needs an answer before session 28
starts persistence.

**Delivered, with evidence:**
1. **Your gate answers, applied** (`progress/balance-report-021-phase5-close.txt`). Propagating
   Exploit is now 2/3. Re-measured once on the gate seeds and held out. The Phase 5 baseline:

   | Edge (target) | seeds | rate | 95% CI | verdict | session 26 |
   |---|---|---|---|---|---|
   | Null > Aegis (55-60) | 2,500 | Null 48.2 | 46.2-50.1 | OUT (accepted) | 42.0 OUT |
   | Aegis > Cortex (55-60) | 2,500 | Aegis 52.2 | 50.3-54.2 | OUT (accepted) | 52.2 OUT |
   | Cortex > Swarm (55-60) | 2,500 | Cortex 57.4 | 55.4-59.3 | IN | 57.4 IN |
   | Swarm > Null (55-60) | 2,500 | Swarm 56.2 | 54.2-58.1 | UNRESOLVED | 59.4 UNRESOLVED |
   | Null ~ Cortex (45-55) | 900 | Null 49.2 | 46.0-52.5 | IN | 40.7 OUT |
   | Aegis ~ Swarm (45-55) | 900 | Aegis 51.2 | 48.0-54.5 | IN | 51.2 IN |

   The held-out run reproduced the session-26 probe exactly (48.0 / 43.6 / 50.5).
2. **The standing regression check**: `engine/src/dev/ringRegression.ts` against
   `engine/src/dev/ringBaseline.json`, a step in CI's `test` job. It fails when an edge's band
   verdict gets worse, or when an accepted-OUT edge moves really further out. 11,800 games, about
   15 s, so it runs on every PR. Shown working both ways: it passes on the shipped code, and with
   Propagating Exploit put back to 2/2 it fails two edges and exits 1.
3. **Instance ids in the event log** (your 2026-10-03 request, for the render's exact-target
   travel). Every event that names a board card carries the instance id, a full target ref or a
   stack id. `engine/test/eventIds.test.ts` checks every event in all 16 faction pairings
   against the real state. `progress/sample-match-028-event-ids.txt` is a full game with the ids
   printed, including a hit on one of two same-named units.
4. **A real bug the id test caught**: when an onAttack ability killed the defender, the `attack`
   log line printed its raw id ("attacks u11"). Fixed.

**Strong:** the change is additive. 64 matches give byte-identical text logs before and after,
so no balance number moved because of the ids. The regression check is deterministic (same seeds,
same code, same numbers), so a CI failure always means the change under test moved the ring.
**Thin:** the ring is balanced only under one heuristic agent judging itself (Lookahead vs
Lookahead). The check guards that one measurement, not "balance" in general. Pools sit at 20-24
unique cards per faction, short of the 30-40 target, now paused by your call.

**Decisions you might overrule:**
- **The regression rule.** It fails only on a worse verdict, or a real move further out on an
  accepted-OUT edge. A real move inside the band, or toward it, passes. That means an edge can
  drift from 56 to 59 inside its band without failing. Tighter option: fail on any real change
  (95%) on any edge unless the baseline is re-recorded on purpose.
- **Baseline updates are manual and deliberate.** `--write-baseline` is run only for an approved
  change and committed with its balance report. Nothing re-baselines automatically.
- **The id fields are optional in the TypeScript type.** That keeps the render's hand-built test
  fixtures valid. The guarantee comes from the test, not the compiler.

**Next:** session 28, persistence (a local database file, no external service) and the economy
spec, built to your section C decisions. It pauses at the [OWNER CHECK-IN] items (finish list
and pull rates, the unique-Mythic effect menu, quests, starter shape).

---

## ANSWERED (owner 2026-10-04, applied session 27) — Phase 5 step (iii): the full-ring gate (2026-10-03, session 26)

Not a build-order stage completion, but the gate you made mandatory for closing Phase 5, so it
gets a checkpoint. **The gate did not pass.**

**Delivered, with evidence** (`progress/balance-report-020-phase5-gate.txt`):
1. The gate at your seed counts: `lookaheadEdgeCheck.ts` for all four factions at 900 and at
   2,500 seeds, interval verdicts, plus `balanceReport.ts 900` for all three policies.

   | Edge (target) | seeds | rate | 95% CI | verdict |
   |---|---|---|---|---|
   | Null > Aegis (55-60) | 2,500 | Null 42.0 | 40.1-43.9 | OUT |
   | Aegis > Cortex (55-60) | 2,500 | Aegis 52.2 | 50.3-54.2 | OUT |
   | Cortex > Swarm (55-60) | 2,500 | Cortex 57.4 | 55.4-59.3 | IN |
   | Swarm > Null (55-60) | 2,500 | Swarm 59.4 | 57.5-61.3 | UNRESOLVED |
   | Null ~ Cortex (45-55) | 900 | Null 40.7 | 37.5-43.9 | OUT |
   | Aegis ~ Swarm (45-55) | 900 | Aegis 51.2 | 48.0-54.5 | IN |

   No pairing is triple-flagged (no dominant archetype under all three policies).
2. Your approved Watchdog Timer buff (hand of 1 or fewer): 23 -> 102 draws per 900 games, Null
   +0.3 (noise). Test updated; `progress/sample-match-027-watchdog-buff.txt`.
3. The pre-authorized Quorum Arbiter drop, measured on the gate seeds and held out
   (`engine/src/dev/phase5GateLevers.ts`): -2.7 / -1.0 on Cortex-vs-Null, which stays OUT
   either way. Not applied.
4. A measured lift menu for Null (`engine/src/dev/nullLiftProbe.ts`): +1 attack / +1 health on
   each of Null's 12 unit cards, 7,500 games each, leaders confirmed on held-out seeds. Not applied.

**Strong:** the gate ran exactly as you specified, and every verdict is on an interval, not a
point estimate. Both levers you reserved were measured on held-out seeds before any decision.
The Null-vs-Swarm constraint showed up only because the probe printed every edge, not just the
pooled rate.
**Thin:** the ring is not done. Null is weak, and the one lift with the right shape (Propagating
Exploit 2/3) still leaves Null > Aegis about 5 points short. Aegis > Cortex wasn't probed. All of
this is still one agent policy (Lookahead) judging itself.

**Decisions you might overrule:**
- **Not dropping Quorum Arbiter**, even though your 2026-09-26 instruction said to if
  Cortex-vs-Null was still out. The lever no longer does what it did when you authorized it.
- **Not shipping a Null lift.** You reserved it as a gate-time call. I recommend Propagating
  Exploit 2/2 -> 2/3 (notes-for-owner.md item 3).
- **Treating UNRESOLVED Swarm > Null (59.4, CI 57.5-61.3) as not a pass.** That's per your rule.
  It's a symptom of Null being weak, and the recommended lift brings it to 56.4 held out.

**Next:** the next session is render (alternation): EFFECTS.md v2 slice 1, per your 2026-10-03
entry. The balance session after that applies your answers here, then re-runs the gate on just
the edges that change. If you'd rather close Phase 5 with the ring as it stands, say so and the
balance lane moves to the event-log instance IDs and then roadmap item 5 (economy).

---

## AWAITING FEEDBACK — Phase 5 step (ii): the neutral pool (2026-09-30, session 24)

Not a build-order stage completion. It's flagged because it adds a new deck-construction rule
and a pool the owner specified in one line, so several taste calls were made here.

**Delivered, with evidence:**
1. Ten neutral utility cards (`engine/src/data/neutralCards.ts`), each with its own art slot.
   All ten are played and land in real games (report 018, probe table).
2. A load-time "utility, not identity" lint and hybrid-deck rules (one faction + at most 10
   neutral copies). The rules have 13 tests (`engine/test/neutralPool.test.ts`).
3. Measured packages: Cortex (2 swaps) and Null (add-only, +4). Swarm and Aegis run none. Each
   shipped only on held-out improvement.
4. A LookaheadAgent fix: heals and energy are valued as the resolver delivers them, and a
   no-op Command costs the card. Measured waste went from 1,165 useless repairs per 200 games
   to zero.
5. Ring after: one edge OUT at 900 seeds (Aegis over Null, 52.2% Aegis; was 60.4%).
   `progress/sample-match-025-neutral-pool.txt` has a full shipped-deck game.

**Strong:** every rule is checked and tested, the picks are measured and held-out, and the
owner's no-Null-cuts instruction was honoured, with a discarded run to prove it mattered.
**Thin:** 7 of 10 neutral cards run in no deck; a vanilla 3/3 is the best neutral card;
Kernel Panic visibility dropped to 7.1%.

**Decisions the owner might overrule:** the 10-copy neutral cap; what the lint calls
identity (Rush, all statics); Null going back to 40 cards (win rate vs Kernel Panic
visibility); shipping the agent fix mid-Phase-5, which re-baselines every Cortex number.

**Next:** a render slice, then the mandatory Phase 5 gate (900 / ~2,500 seeds, with a checkpoint).

---

## AWAITING FEEDBACK — Phase 5 slice 3: Null depth/variety pass, 15 -> 20 unique cards (2026-09-26, session 21)

This does not complete a build-order stage. It is flagged because it is the third Phase
5 slice, the owner set a specific constraint on it ("not a power buff;
pull back if Null climbs"), and it contains three taste calls worth
steering.

**Delivered, with evidence:**
1. Five Null cards, each using a trigger or keyword Null never had before:
   Zombie Process (onDeath token), Dangling Pointer (Rush), Bit Rot
   (Instant -3/-0 trick), Watchdog Timer (Directive: draw at end of turn on
   an empty hand), and Garbage Collector (activated 2-energy heal). Each has
   a whitebox test (`engine/test/nullPoolExpansion.test.ts`), and all five
   fire in real Lookahead play (`progress/sample-match-022-phase5-null-slice.txt`).
2. A LookaheadAgent fix: Directive turn triggers are now valued. Before
   the fix, the trusted policy never played such a card. All non-Null pairings are
   identical to report 014, so no earlier measurement moved.
3. A re-measure (`progress/balance-report-015-phase5-null-slice.txt`). The
   Lookahead Null mean went 40.0% -> 42.1%. Cortex and Swarm moved within
   one standard error, and vs Aegis went 38.0 -> 45.0, toward the ring's intended
   Null>Aegis edge. Nothing is triple-flagged. The constraint held, so nothing was pulled
   back.

**Strong:** the variety is real and proven card by card. The slice honoured the
power constraint, and it found and fixed a genuine instrument blind spot.

**Thin:** it took three measured cuts. The first was a real nerf, and the
second had a card whose effect never fired. Null is still the weakest
faction under Lookahead. The evolution line is diluted, as covered in item 2 below.

**Decisions you might want to overrule:**
1. **Fill to 40 with no trims.** I chose this for power-neutrality and to take
   removal density off the cap. The alternative was trimming weak existing
   Null cards, as the Aegis and Swarm slices did.
2. **The consequence: the Kernel Panic evolution arc is about half as common.**
   Kernel Panic is played in 105 of about 900 Lookahead games, down from 206.
   If you want Null's signature
   arc to show up in watched matches more often, say so. A future slice can trim
   the deck back toward ~36 and re-measure.
3. **Watchdog Timer's condition, "hand is empty".** The first version,
   "fewer than 2 units", was the more thematic catch-up clause, but it was never
   live in real play. The empty-hand version is a refuel card, and it is the
   only Null card that can generate card advantage turn after turn. It is
   capped at 1 copy and is Directive-removable.
4. **The agent heuristic constant.** A Directive turn trigger is valued at
   2 expected firings. This is a named guess, in the same category as the agent's other weights.

**Next:** a render slice (alternation). Then Cortex's Phase 5 slice, the
neutral pool, and the mandatory full-ring re-measure.

---

## AWAITING FEEDBACK — Phase 5 slice 2: Swarm pool grown 16 -> 20, no pairing triple-flagged at all (2026-09-26, session 20)

Not a full build-order stage completion — flagged because this is the
second Phase 5 slice, it resolves the project's sole standing
cross-faction triple-flag (Cortex-vs-Swarm), it required the same
scale-back-an-overtuned-first-cut journey as session 19 (a judgment call
worth the owner's eyes again), and it leaves two named watch items open in
new shapes rather than fully settled.

**What this session delivered, with evidence:**

1. **Swarm grown from 16 to 20 unique cards** (`engine/src/data/cards.ts`):
   Brood Skitterer (a real cross-faction-median 1-drop), Carapace Grunt
   (Swarm's first plain cost-2 stat body), Warren Guardian (Swarm's first
   Guard unit), Bloodswarm Alpha (a real cost-4 body that also summons a
   token on play, unlike the measurably-weaker pure-summon Brood
   Reserves). Funded by trimming the pool's own measured weakest cards
   (this session's own baseline report), not guesses; no existing card cut
   entirely; deck stays at its 40-card cap.
2. **The first stat line was overtuned — caught by this session's own
   re-measurement, not shipped, same pattern as session 19.** The first
   cut matched Aegis's OWN new cards (Aegis Line Trooper, Bulwark Chassis,
   Reinforced Bastion) stat-for-stat — but those cards were themselves
   among Aegis's stronger-testing cards (58-63% drawn win rate in their
   own pool), not neutral baselines. Copying them onto a Swarm pool that
   started well below 50% average spiked EVERY Swarm card's win rate
   uniformly (even untouched ones), and flipped Cortex-vs-Swarm from
   Cortex-dominant to Swarm-dominant. Scaled every new card back below its
   original benchmark and re-measured.
3. Re-measured the whole ring after the correction (300 seeds/matchup, 3
   policies): `progress/balance-report-014-phase5-swarm-slice.txt`.

**Honest result: no cross-faction pairing is triple-flagged at all.**
Cortex-vs-Swarm, the project's sole standing triple-flag going in, is
resolved — but it overshot past even into mild Swarm-favour (Lookahead
55.7% Swarm) rather than landing on the ring's actual 55-60%-Cortex
target. Per the owner's own 2026-09-23 instruction for this exact pairing
("Phase 5 wider pools will likely settle it... do not add a card or nerf
anyone specifically for this pairing"), this session made no
pairing-specific change and the predicted settle did happen — just past
the target, not onto it. Left as-is, not chased, per that same
instruction — flagging back in case the owner wants it pulled closer with
a future slice.

**Two watch items, both moved but not resolved, worth the owner's
attention specifically:**

- **Aegis-vs-Swarm** (session 19's own open item) is back in the 45-55%
  "even" band on 2 of 3 policies, including Lookahead (53.0%, the trusted
  arbiter) and Aggressive (47.7%); Random sits just outside (56.7%). Read
  as effectively addressed by this slice, consistent with how session
  19/the owner treated single-policy near-misses elsewhere.
- **Swarm-vs-Null** remains unresolved, but the shape flipped: Aggressive
  and Lookahead now favour SWARM (61.3%/64.3%, both above their own target
  band on the winning side), while Random still favours Null (64.0%, down
  from the original baseline's 75.7%). Real overall movement, but the
  three policies now actively disagree on this pairing rather than
  roughly agreeing Null wins too much — a genuinely different open
  question than before this session, not a smaller version of the same
  one.

**Judgment calls the owner might want to weigh in on:**

- Whether Cortex-vs-Swarm's overshoot (Swarm now mildly favoured instead
  of Cortex) should be pulled back toward the ring's target with a future
  Cortex-side slice, or left as "close enough, Phase 5 isn't finished
  yet, revisit at the hard-gate re-measure."
- Whether Swarm-vs-Null's Random-favours-Null-but-others-favour-Swarm
  split should be treated as "trust Lookahead, done for now" (the
  project's own standing practice since the 2026-09-25 "accept the ring"
  entry) or as a case specifically worth digging into given how starkly
  the three policies now disagree.
- The exact new stat lines (Brood Skitterer 1/2, Carapace Grunt 2/2,
  Warren Guardian 2/3 Guard, Bloodswarm Alpha 3/3 + summon) are this
  session's own scaled-back first cut, checked against the full report
  exactly once after correction — not an iterated tuning.

Full detail: `progress/log.md`'s session-20 entry, `progress/current.md`,
`progress/quality-debt.md`'s new session-20 section,
`progress/notes-for-owner.md`.

---

## AWAITING FEEDBACK — Phase 5 slice 1: Aegis pool grown 18 -> 22, Aegis-vs-Cortex no longer triple-flagged (2026-09-25, session 19)

Not a full build-order stage completion — flagged because this is the first
Phase 5 (pool expansion) slice, it fixes a pairing two prior sessions
couldn't, it required scaling back an overtuned first attempt before
shipping (a judgment call the owner should see), and it leaves a new
collateral watch item open.

**What this session delivered, with evidence:**

1. **Aegis grown from 18 to 22 unique cards**
   (`engine/src/data/aegisCards.ts`): Bulwark Chassis (stat-only wall),
   Reinforced Bastion (a second, higher-cost Guard-wall print), Salvage
   Reflex (new archetype — onDeath, converts removal spent on it into
   Barrier for a random ally), Aegis Line Trooper (the pool's first 1-drop
   with real attack pressure). Funded by trimming the pool's own measured
   weakest cards (balance-report-012's per-card table), not guesses; no
   existing card cut entirely; deck stays at its 40-card cap.
2. **The first stat line was overtuned — caught by this session's own
   re-measurement, not shipped.** Bulwark Chassis 1/5 + Reinforced Bastion
   2/6 Guard (strictly better than Cortex's Firewall Sentinel at the same
   cost) made Aegis generically stronger against everyone, not specifically
   better against Cortex — Aegis-vs-Swarm and Aegis-vs-Null both moved
   sharply out of band too. Rewritten to explicitly match existing
   same-cost cards' precedent (Bulwark Chassis -> Cortex Engineer's 1/3;
   Reinforced Bastion -> at/below Firewall Sentinel's 2/5 Guard; Aegis Line
   Trooper -> even combat math with Signal Drone's 1/1) and re-measured.
3. Re-measured the whole ring after the correction (300 seeds/matchup, 3
   policies): `progress/balance-report-013-phase5-slice1.txt`.

**Honest result: Aegis-vs-Cortex is no longer triple-flagged** — Random
58.7% and Lookahead 59.3% both land IN the 55-60% target band; Aggressive
sits at 47.0% (out of band, Cortex-favoured, not extreme). This is the
first session of three that have tried (11, 18, 19) to land this pairing
by the project's actual pass/fail bar. Cortex-vs-Swarm remains the sole
triple-flagged pairing, untouched per the standing instruction not to
assign it a fixer.

**New watch item, not chased further this session:** Aegis-vs-Swarm (a
45-55% "even" target) drifted to 57.7/71.0/70.7% Aegis — real collateral
movement, not triple-flagged, but worth the owner's attention before it's
treated as settled. Aegis-vs-Null's Lookahead number also sits a bit below
its post-session-18 shape (38.0% Null) without being triple-flagged either
way.

**Decisions the owner might want to overrule:**

- The exact shipped stat lines (Bulwark Chassis 1/3, Reinforced Bastion
  2/4 Guard, Aegis Line Trooper 2/1, Salvage Reflex 2/3) are this session's
  own evidence-led calibration against existing same-cost cards, checked
  against the full balance report exactly once after the correction — not
  iterated further once they landed the pairing in/near band. A future
  session could push further (e.g. try to also land Aggressive in band) or
  leave it, since the project's established bar is the triple-flag
  cross-check, not every individual policy.
- Which existing cards absorbed the copy trims was picked purely by lowest
  measured played-win-rate, not by design/flavour intent — e.g. Latent
  Ward (the telegraph=2 trial from the 2026-09-13 checkpoint) lost a copy
  for measurement reasons unrelated to that trial's own still-open
  question.
- Scoping this slice to Aegis alone, rather than attempting some growth
  across all four factions in one session — chosen to keep this "one real,
  complete slice" per TASKS.md rather than four half-finished ones.

**What's next:** Cortex, Swarm, or Null's own Phase 5 growth (Swarm is a
natural pick — it's now named in both open watch items, Cortex-vs-Swarm and
the new Aegis-vs-Swarm drift). The owner's "hard gate" whole-ring
re-measure (2026-09-25 entry, item 4) is not due yet — that's once every
faction has had at least one Phase 5 pass, not after Aegis alone.

---

## AWAITING FEEDBACK — Stage 3 balance pass: ring labels corrected, Aegis-vs-Cortex fix, Null past-cost nerf (2026-09-25, session 18)

Not a full build-order stage completion — flagged because this session made
several judgment calls on owner-feedback.md's 2026-09-23 "Phase 4 session 17
follow-ups" entry that the owner should see before the next round, and
because two ring pairings remain open with no further authorized move.

**What this session delivered, with evidence:**

1. **Ring labels corrected as DATA, not prose** — `engine/src/dev/balanceReport.ts`
   now has `RING_DECISIVE`/`RING_EVEN` constants encoding the real ring
   (Cortex-vs-Swarm and Aegis-vs-Cortex are both [W] 55-60% edges;
   Null-vs-Cortex and Aegis-vs-Swarm are the only [E] 45-55% pairings) and
   prints an automatic per-policy band check every run. Also fixed a real,
   independent pre-existing bug found in the process: the "flagged under
   all three policies" cross-check never verified the three policies agreed
   on WHICH side won — it just required each to independently clear 60%.
   Swarm-vs-Aegis was mis-reported as triple-flagged in balance-report-011
   for exactly this reason. Fixed to require the same winner across all
   three.
2. **Cortex-vs-Swarm — untouched**, per instruction.
3. **Aegis-vs-Cortex — Guard Directive Chip 2 -> 3 copies**, after a first
   attempt (a new Barrier-granting Tool) measured worse and was reverted.
   `engine/src/data/aegisCards.ts`.
4. **Null step 4, past cost** — Kernel Panic's destroy-reach `maxHealth: 5`
   -> `4`; Null Singularity's health 8 -> 7. `engine/src/data/nullCards.ts`.
5. Re-measured the whole ring (300 seeds/matchup, 3 policies):
   `progress/balance-report-012-ring-followups.txt`.

**Honest result:** Aegis-vs-Null and Swarm-vs-Null are BOTH now clear of
the triple-flag (Aegis-vs-Null's Lookahead number landed IN the 55-60%
band outright, 58.0%). Cortex-vs-Swarm remains triple-flagged, as expected
— nobody was assigned to fix it. **Aegis-vs-Cortex moved real but stayed
out of band on every policy** (Aggressive 32.3% -> 35.7% Aegis, Random
56.3% -> 54.3%, Lookahead 50.0% -> 48.3%) — the first ring-target fix
attempt in this project's history that landed a real, measured improvement
without reaching the target band on ANY policy, not just some.

**Real-play evidence:** `progress/sample-match-019-ring-fixes.txt` (Guard
Directive Chip forcing an attack onto itself; Kernel Panic's tightened
reach sparing a 5-health Latent Ward — both real, unscripted
LookaheadAgent-vs-LookaheadAgent play) plus a new whitebox test in
`engine/test/nullFaction.test.ts`.

**Decisions this session made that the owner might want to overrule:**

1. **Reverted a first-attempt Aegis card (Redundant Barrier Coil) after it
   measured worse, rather than trying a smaller variant of the same idea
   (e.g. a stat bonus attached to the Barrier grant).** Judged the whole
   "new zero-immediate-impact Tool" shape as the problem (matching session
   11's own prior finding), not just this specific card's numbers — a
   read, not a certainty.
2. **Stopped Aegis-vs-Cortex at one copy-count change, in the belief the
   remaining gap (worst under Aggressive) is partly agent-heuristic, not
   purely card-driven.** This is an interpretation, not a proven fact — the
   owner may want a second card-level attempt tried before accepting that
   read. Genuinely open: is a differently-shaped Aegis card (something with
   immediate board impact, unlike Barrier access) worth a second attempt
   before Phase 5, or does this pairing wait for the wider pool like
   Cortex-vs-Swarm?
3. **Stopped the Null nerf at "no longer triple-flagged" rather than
   pushing every individual policy into the 55-60% band.** The entry's own
   "stop when it lands in band" was read as the triple-flag clearing, which
   is this project's actual standing pass/fail bar — but Aggressive (72.0%)
   and Random (72.3%) are both still well above 60% individually. If the
   owner wants those in band too, not just the cross-check clear, more Null
   work is needed.
4. **Kernel Panic's maxHealth cut to 4, and Null Singularity's health cut
   to 7, are first-guess numbers**, not measured-to-a-target values — the
   same "propose, ship, measure, report honestly" pattern every prior Null
   nerf in this project has used, not a claim these are the *right* numbers
   long-term.

**Per the standing gate ("do NOT start Phase 5 until the ring is within
band"), Phase 5 (pool expansion) was NOT started** — Cortex-vs-Swarm and
Aegis-vs-Cortex are both still open, the latter now with two failed/partial
attempts behind it. This checkpoint is the flag; per RENDER.md's
alternation rule, the next session should be a render slice, and the
balance session after that should read this checkpoint and
`progress/notes-for-owner.md` before deciding how to proceed.

---

## AWAITING FEEDBACK — Stage 3 balance pass: the ring after Null step 4 + Swarm buff (2026-09-23, session 17)

Not a full build-order stage completion — flagged because the 2026-09-23
owner-feedback entry ("Phase 4 decisions") explicitly asked for the whole
ring to be re-measured and the result checkpointed after doing its two
authorized changes, and because this session made several real, unassigned
judgment calls the owner should see before Phase 5 (pool expansion) opens.

**What this session delivered, with evidence:**

1. Raised Kernel Panic (5->6) and Null Singularity (6->7) — the entry's own
   step 4, the two played-win-rate outliers session 16 flagged but declined
   to touch unilaterally. `engine/src/data/nullCards.ts`.
2. Gave Swarm two new cards for real go-wide resilience: Colony Broodling
   (cost 1, dies -> summons a replacement Swarm Larva if 2+ other units
   survive it) and Overgrown Carapace (cost 3, health scales live with the
   controller's own unit count). Both reuse only already-generic engine
   mechanisms. `engine/src/data/cards.ts`.
3. Re-measured the whole ring (300 seeds/matchup, 3 policies):
   `progress/balance-report-011-phase4-decisions.txt`.

**Honest result: no pairing is within the ring's band yet, but both changes
moved the numbers in the places they targeted, not noise.** Aegis-vs-Null
moved down under ALL THREE policies for the first time in this project's
history (78.0/72.0/67.7 -> 75.7/70.0/65.3) — still triple-flagged, did not
reach the entry's own "stop at 55-60%" condition. Swarm-vs-Null stopped
being triple-flagged entirely (was Null 56.0/79.0/67.3, all >=60%; now only
Random remains flagged at 75.7%, Aggressive is dead even, Lookahead is
56.7%) — real, multi-policy movement on the ring's single most
structurally-wrong edge. Cortex-vs-Swarm, untouched by either change, is
unchanged in kind (still triple-flagged). Full before/after table and honest
read: `progress/balance-report-011-phase4-decisions.txt`.

**Real-play evidence, not just aggregate numbers:**
`progress/sample-match-018-swarm-resilience.txt` (a real, unscripted
LookaheadAgent-vs-LookaheadAgent Swarm-vs-Null match, found on the first
seed searched, where Colony Broodling's death genuinely triggers a
replacement summon and Overgrown Carapace's live health matches "1 + board
count" exactly across 6 different board sizes — Swarm wins) plus 4 new
whitebox tests (`engine/test/swarmResilience.test.ts`).

**Decisions this session made that the owner might want to overrule:**

1. **Stopped at exactly the two authorized changes rather than iterating
   further toward the band.** Aegis-vs-Null didn't land in 55-60% (the
   entry's own stated "stop" condition), but nothing beyond step 4 was
   pre-authorized, so nothing further was attempted — consistent with this
   project's established "measure, report, don't chase" pattern, but a real
   choice to stop short of the target rather than guess at a next step
   (e.g. touching Kernel Panic/Null Singularity's stats instead of their
   cost — see below).
2. **Cortex-vs-Swarm remains completely unassigned.** The entry forbids
   touching Cortex and doesn't name a Swarm/Aegis-side fix for this specific
   pairing (unlike Swarm-vs-Null, which it explicitly diagnosed and
   directed). This session did not guess at one. Should Swarm get a THIRD
   card aimed specifically at this pairing, should Aegis be touched instead
   (it's not part of this edge), or is this pairing meant to wait for Phase
   5's wider pool to dilute it? Genuinely open.
3. **Kernel Panic/Null Singularity's played-win-rate is still extreme
   (up to 86.4%/78.7%) even at the new cost.** The cost increase changed how
   OFTEN they land, not how strong they are once they do — if the owner
   wants Aegis-vs-Null actually inside the band rather than just closer to
   it, the per-card table suggests these two cards' raw stats/effects are
   the next lever, not a further cost hike. Not attempted (out of this
   entry's authorized scope) — flagging the lever rather than pulling it.
4. **Colony Broodling/Overgrown Carapace's specific numbers are a first
   proposal.** Cost 1/1-attack/1-health with a 2-other-units summon gate;
   cost 3/2-attack/1-base scaling health; 3 and 2 copies respectively. Not
   playtested beyond this session's own balance report and one real match.
5. **A new, unchased single-policy flag: Cortex-vs-Null under Aggressive
   only (55.7% -> 60.7%)**, plausibly from Null's weaker early game after
   the cost increase. Named, not acted on (single-policy, not a cross-check
   flag).

**Per the entry's own explicit gate, Phase 5 (pool expansion) was NOT
started** — "do NOT start expansion until the ring is within band," and it
isn't, on any of the six pairings. This checkpoint is the flag; the project
continues per `progress/current.md`'s "concrete next step" rather than
waiting.

---

## AWAITING FEEDBACK — Stage 3 balance pass, Phase 4: the counter triangle (2026-09-22, session 16)

Not a full build-order stage completion (roadmap item 3's Phases 5-6 are
still open) — flagged per the owner's own 2026-09-21 process reminder
("when a session says it's surfacing a decision for the owner, write it
into checkpoints.md ... as the process defines") because Phase 4 item 7
explicitly asks to "propose an explicit counter cycle at a checkpoint," and
because this session made one real design decision (Segmentation Fault's
redesign) and left one real gap (Cortex-vs-Swarm) that the owner should see
named plainly rather than buried in a PR body.

**1. The triangle proposal — please confirm or steer.** Adopted the owner's
own 2026-09-20 example as-is: Null attrition beats Aegis stacking; Aegis
walls beat Swarm width; Swarm width beats Null's single-target removal;
Cortex flexible in the middle (no fixed favoured matchup, 45-55% vs
everyone). Targets: 55-60% for the intended edge, 45-55% elsewhere, under
all three agent policies. Full detail and the measured gap against it:
`progress/balance-report-010-phase4-triangle.txt` Parts 1-2. **Nothing here
was invented beyond what the owner already wrote** — this is a
confirmation checkpoint, not a new proposal, but the specific per-pairing
percentage bands (translating "55-60% for the intended edge" onto each of
the six pairings) are this session's own first application of that rule and
worth a look.

**2. What's actually true against that triangle right now, measured, not
guessed:** none of the six pairings meet it yet. Two distinct problems:
Cortex is too strong (against Swarm under all 3 policies, against Aegis
under Aggressive) rather than "flexible"; and the Null side of the cycle is
inverted on one edge (Swarm should beat Null, currently loses to it 55-81%)
and far overshoots on the other (Null should beat Aegis by 55-60%, currently
wins by up to 78%). Full table: `balance-report-010-phase4-triangle.txt`
Part 2.

**3. The pre-authorized Null backstop — executed, 3 of 4 steps, honestly
inconclusive.** The 2026-09-20 "Null dominance" entry's condition
("still wins 60%+ against any faction under all three policies") was
already met for Aegis-vs-Null, so its priority-ordered nerf list was
executed without waiting for further sign-off, exactly as that entry
pre-authorized: (1) Segmentation Fault redesigned from an unconditional
permanent aura to a conditional one (new generic engine mechanism:
`Ability.condition` now gates "static" triggers, not just
onPlay/activated); (2) Corrupted Process cut 3->2 copies (Fork Bomb was
NOT cut — the pool was sitting exactly at the Phase 3 lint's 25% cap, and
only one copy of backfill headroom exists anywhere in the pool, already
spent on this cut); (3) Entropy Harvester's scaling source changed from the
controller's own graveyard to the opponent's (new generic
`opponentGraveyardSize` ScalingSource). Measured after each step. Result:
real but small movement (Aegis-vs-Null's Random-policy number improved
78.3% -> 72.0%; Aggressive and Lookahead barely moved). Both flagged
pairings remain triple-flagged. Full step-by-step numbers and reasoning:
`balance-report-010-phase4-triangle.txt` Part 3.

**4. Decision NOT made, flagged instead — step 4, cost increases.** The
per-card instrumentation (already a standing part of every balance report)
points at Kernel Panic and Null Singularity specifically — both far
outlier played-win-rates (up to 88.7% and 82.9% respectively) against a
pool that otherwise clusters 45-60%. Both already cost exactly what their
faction-mirror equivalents cost (Aegis Warden 5, Prime Aegis 6) — raising
either further would make Null's top end the first in the pool to cost more
than its equivalent-tier peers elsewhere, a cross-faction curve decision
this session did not think it should make unilaterally in the same pass as
an already-authorized nerf. Flagging it as the most concrete, data-backed
next lever rather than guessing at it. **Owner steer wanted:** is a
Null-only cost premium on its top two cards an acceptable way to close this
gap, or should the next attempt look at Aegis's own kit instead (as
sessions 10/11 already tried once) or at Swarm's kit (needed regardless,
to fix the inverted Swarm-vs-Null edge)?

**5. Cortex-vs-Swarm — measured, explicitly NOT fixed this session.**
Triple-flagged, unchanged by anything this session did (nothing here
touched Cortex or Swarm). No owner-pre-authorized mechanism exists for this
pairing the way the Null backstop does. **Owner steer wanted:** should
Cortex be nerfed, or Swarm/Aegis buffed, to bring this in line with
"flexible in the middle"? This session did not decide unilaterally which
faction's identity to touch.

**What's next regardless of the answers above:** the Swarm-vs-Null edge is
currently inverted (Null wins, should lose) — this is arguably the most
structurally wrong result on the board relative to the proposed triangle,
worse than "too extreme in the right direction" (Aegis-vs-Null) or "wrong
faction too strong" (Cortex-vs-Swarm), and hasn't been specifically
targeted by any fix yet. A future session should look at Swarm's own kit
(rebuild tools, board presence against Null's attrition) rather than only
continuing to nerf Null, since Null nerfs this session moved Aegis-vs-Null
more than Swarm-vs-Null.

---

## AWAITING FEEDBACK — Stage 3: A real card set (2026-09-13)

**Milestone:** this is DESIGN.md's "first real card set done" checkpoint.

**What it delivers:** the unified board-development system the owner's
2026-09-12 design-directive batch called for, built directly into the
rules engine as one interacting system, plus a new third faction (Aegis)
built specifically to exercise it:

- **Finite face-up board slots** (`BOARD_SLOTS`, proposed default 6),
  shared between Units and Directives per player — both are "meaningful
  board commitments," so both compete for the same scarce space.
- **Telegraphed threats** (`UnitCard.telegraph`): a unit enters play fully
  visible and targetable but dormant (can't attack, activate abilities, or
  project static auras), then "arms" — its deferred `onPlay` finally
  fires — at the start of its controller's turn N rounds later. The
  opponent gets a real, visible window to answer it before the payoff.
- **Evolution** (`UnitCard.evolvesFrom`, strict base-card-id requirement):
  mutates the target unit **in place** (same instanceId), so damage,
  statuses, and attached Tools all carry forward onto the evolved form,
  and no board slot is spent evolving.
- **Tool/attachment cards** (new `Tool` CardType): attach to any friendly
  board unit, a flat stat bonus plus optionally-granted keywords, no slot
  of their own.
- **The interaction, not three isolated features:** a telegraphed unit can
  be tooled up before it arms; an evolution base sitting in play is
  exactly the same "answer it now or let it grow" tension as a telegraph,
  for free, from the instance model; the shared slot pool is what makes
  any of this a real opportunity cost rather than a free add-on.

**Evidence, not claims:**
- `progress/sample-match-004-boarddev.txt` — a real, unscripted match
  (Random-Aegis vs Aggressive-Cortex, seed 3) where all three new
  mechanics fire: a Perimeter Turret survives 2 AOE damage while dormant,
  arms on turn 9, and immediately kills an attacker; a Plating Module
  attaches to Prime Aegis; an Aegis Cadet evolves into an Aegis Sentinel.
  Resolves cleanly in 16 turns.
- `progress/effect-system-demo.txt` scenarios 13–16 — deterministic,
  assertion-based proof of telegraph dormancy+arming, evolution
  carry-forward (instanceId, damage, a pre-attached tool), Tool
  attachment (stat bonus, granted keyword, granted Barrier applying the
  real status), and the board-slot cap (blocks Units/Directives, never
  Tools).
- A 300-game stress run (not committed, described in `progress/log.md`)
  across two matchups found zero crashes, mean ~17 turns (consistent with
  pre-stage-3 numbers, comfortably under the 40-turn cap), telegraph
  arming in ~78% of games, evolution in ~34%, a Tool attaching in ~96% —
  the mechanics are exercised routinely, not just in a cherry-picked demo.
- All four packages typecheck clean; the pre-existing stage-1/2 evidence
  (12 original effect scenarios, the Cortex-vs-Swarm CLI match) still
  passes/plays identically — this session's changes (the board-slot cap,
  the deck-size rule) did not regress the existing card pool.

**Where it's strong:** the "evolve in place" implementation is simpler and
more powerful than it first looks — because it mutates the same
`UnitInstance` rather than replacing it, damage/statuses/tools carrying
forward and the zero-slot-cost property both fall out of the existing
instance model for free, with no special-case bookkeeping. The three
mechanics are genuinely coupled through the shared slot pool and the
instance model, not three parallel if-branches.

**Where it's thin:** Aegis is 14 unique cards — a real faction, not yet a
rich one; Cortex and Swarm don't use the new system at all yet; Tool cards
have no ability timeline beyond a flat bonus; verification is still
entirely hand-written demo scripts with no automated test runner (now the
most overdue item in `progress/quality-debt.md`, having survived two
stage-scale sessions). Full list in `progress/quality-debt.md`'s new
stage-3 section.

**Decisions made this session the owner might want to overrule:**
1. **Evolution is strict, not loose** — requires the exact base card id,
   not a looser tier-based condition. The design-directive batch named
   this an explicitly open question; this session picked strict for a
   first implementation rather than building both. A loose (tier-number)
   requirement is a real but bounded follow-up if preferred.
2. **`BOARD_SLOTS` = 6, shared between Units and Directives** (not
   separate pools). Both numbers and the shared-vs-separate choice are
   named as open parameters in the directive batch; this is a first
   proposal, not a playtested one.
3. **Telegraph delay = 1 controller-turn** by default (both Aegis
   telegraph cards use it). Untested at other values.
4. **Nothing stops playing a base unit and evolving it the same turn** —
   observed as a real line in the committed match log. This could be seen
   as a legitimate "commit hard, one turn" play, or as undercutting the
   "answer it early while it's weak" drama the directive described (the
   base is never actually exposed to the opponent in that line). Left as
   emergent rather than restricted; flagged rather than decided.
5. **Deck size range set to [20, 40]** — chosen to avoid forcing churn on
   the existing Cortex (32)/Swarm (23) test pools rather than picking a
   single target number (e.g. 30) and rebuilding those pools to match.

**What's next:** per `progress/current.md`, the leading candidate for the
next session is closing out the "no automated test runner" debt (now the
most-repeated item in `quality-debt.md`) before adding further width;
continuing stage 3 (a fourth faction, or backfilling Cortex/Swarm with the
new mechanics) is the alternative and also legitimate. Either way, stage 4
(match-server hardening) stays correctly blocked until there's an economy
that needs it.

---

## AWAITING FEEDBACK — Stage 2: Agent interface (2026-09-12)

**What it delivers:** a real network protocol between the match server and
player agents, replacing the in-process `Agent.decideMove` call stage 1
used. `protocol/PROTOCOL.md` is the language-agnostic wire spec (WebSocket,
JSON, `hello`/`matchStart`/`requestMove`/`move`/`matchEnd`/`error`,
including a named "Faults" section and an honest "Not yet covered"
section). Four workspace packages now exist: `engine` (unchanged game
logic, plus a public barrel and an async-capable `Agent`/`runMatch`),
`protocol` (the wire types), `server` (a real `ws`-based match server that
drives the unmodified engine `runMatch` with a `RemoteAgent` standing in
for `Agent`), and `agents` (reference client processes with **zero runtime
dependency on `@ai-tcg/engine`** — the actual proof the seam is real).

**Evidence, not claims:**
- `progress/sample-match-003-networked.txt` — a full real match (seed 48,
  28 turns, 421 moves) played by three separate OS processes (the server,
  and two agent clients) communicating only over a WebSocket, with a
  genuine cross-player, cross-turn instant-speed response (turn 28)
  actually crossing the process boundary — the stage-1 reactive core,
  now proven over the network, not just in-process.
- Both documented fault paths (illegal move, 15s timeout) were live-tested
  with throwaway clients and confirmed to forfeit the offending agent
  correctly, observed end-to-end from all sides' logs — see
  `progress/log.md` for the specific transcripts.
- All four packages typecheck clean; the engine's existing stage-1
  evidence (12-scenario effect demo, in-process CLI match) was re-run
  after the `Agent`/`runMatch` async change and matched prior behavior
  exactly — the protocol work did not regress stage 1.

**Where it's strong:** `agents/` importing nothing from `@ai-tcg/engine`
is the real test of whether "clean seams" was actually achieved rather
than just claimed — a Python or any other external agent implementing
`PROTOCOL.md` from scratch would be in exactly the same position as
`@ai-tcg/agents` is. The server doesn't reimplement match logic; it's the
same authoritative `runMatch` the in-process version uses, with only the
`Agent` implementation swapped for one that crosses a socket.

**Where it's thin (named, not hidden):** the server hosts exactly one
match then exits — no matchmaking, no concurrent matches, no persistence.
No authentication, reconnection, or spectator feed yet (all explicit in
PROTOCOL.md's "Not yet covered"). Fixed test decks; no deck-selection
protocol yet (correctly deferred to stage 5). The fault-path tests were
real but manual, not a committed automated regression test. Full list:
`progress/quality-debt.md`.

**Decisions the owner might want to overrule:**
1. **WebSocket over raw HTTP request/response.** Chosen because the
   protocol needs the server to *push* a `requestMove` at an arbitrary
   time (whenever priority changes, not on a client-initiated poll) — a
   long-lived connection fits that better than repeated HTTP polling.
   Easy to revisit; PROTOCOL.md's message shapes don't depend on the
   transport being WebSocket specifically.
2. **A protocol fault ends the match immediately (full forfeit)** rather
   than trying to keep the game running (e.g. substituting a
   `passPriority` on the offending agent's behalf and continuing). Chosen
   for simplicity and to keep the economy-rule mirroring unambiguous
   (dropping out or breaking the protocol is never rewarded); a more
   forgiving recovery path is a plausible future refinement, not
   attempted here.
3. **`agents/` deliberately duplicates the engine's small RNG
   implementation** rather than importing it, to keep the zero-dependency
   property real. This is a few lines of duplicated code in exchange for
   an architectural guarantee; flagging it in case the owner would rather
   share a tiny `@ai-tcg/rng`-style package instead.

**What's next:** stage 3, a real card set — see `progress/current.md` for
what the still-unhandled 2026-09-12 owner design-directive batch means for
how that card schema should be shaped (board-development system, leader
cards, rarity ladder) without building any of it prematurely.

---

## AWAITING FEEDBACK — Stage 1 redo: Magic-style priority/reactivity (2026-09-11)

Not a new build-order stage — this is a follow-up to the checkpoint below,
acting on the owner's response to it. Flagging anyway because it reverses
a named decision at real cost (a foundational rebuild of the turn core),
which is exactly the kind of thing worth a fast checkpoint rather than
going quiet until stage 2 lands.

**What changed:** the turn/priority core was rebuilt around a real Magic-
style priority-passing algorithm — `GameState.stack`/`priority`/`passes`,
`Speed: "Instant" | "Sorcery"` on Commands and activated abilities,
combat damage computed live at resolution time instead of snapshotted at
declaration, and `getLegalMoves`/`applyMove` keyed off whoever currently
holds priority rather than always the active player. Full technical
writeup: `progress/current.md` and `progress/log.md`.

**Evidence, not claims:**
- `progress/effect-system-demo.txt` scenarios 11–12: priority passes
  correctly between players, the stack resolves last-in-first-out (a
  unit's own Instant repair, cast in response to a lethal removal spell
  already on the stack, saves it by resolving first), and an Instant
  combat trick cast in response to a declared attack changes who survives
  the trade.
- `progress/sample-match-002-reactive.txt`: a real, unscripted match
  (seed 48) where an Instant kill fired in response to a declared attack,
  correctly fizzling the now-targetless pending attack.
- A 60-seed stress run measured how often this shows up in normal
  (non-scripted) play, not just whether the mechanic can work in a
  controlled test: **16 of 60 matches (27%) had a genuine cross-turn
  instant-speed response.** Zero crashes; turn lengths still comfortably
  under the 40-turn cap (mean 16.2).

**Where it's strong:** the algorithm is the real thing, not an
approximation — two consecutive passes resolve the stack LIFO or end the
turn exactly per the standard Magic rule, and combat damage genuinely
recomputes live (a response can change who dies), not just cosmetically.
Both dummy agents exercise it without being scripted to: RandomAgent
needed only a rename, and it still produces real reactive lines; the one
new heuristic given to AggressiveAgent (save a unit from lethal combat
damage if a legal instant can) is intentionally narrow, not padded out.

**Where it's thin:** two scope cuts, both named honestly in
`quality-debt.md` rather than hidden — (1) Units/Directives still resolve
immediately when played, skipping the stack entirely, so you can respond
to spells/abilities/attacks but not to a creature entering play; (2)
triggered abilities (onPlay/onAttack/onDamaged/onDeath/turn triggers)
still resolve immediately when they fire rather than getting their own
priority window — only the deliberate action that caused them (a cast, an
activation, a declared attack) is responder-facing. Both are real
simplifications of the full Magic model, not bugs, and both are visible
follow-ups if the owner wants the deeper version later.

**Decisions the owner might want to overrule:**
1. **Permanents (Units/Directives) don't use the stack.** Scoped this way
   specifically to keep the rebuild bounded to what the feedback asked for
   (instant-speed *responses*, priority *passing*, held resources) without
   also redesigning how creatures enter play. If stage 3's real card set
   wants "counter target creature" effects, this will need revisiting.
2. **Triggered abilities resolve immediately, not via the stack.** Same
   reasoning — the feedback's examples (instant-speed responses, reactive
   triggers) are satisfied by making the things a *player* does
   responder-facing; making automatic triggers responder-facing too is a
   bigger, separate design question (what does it even mean to "counter"
   an onDeath trigger?) that wasn't asked for here.
3. **Two new Instant cards were added (Interrupt Handler, Reflex Spike),
   plus Cortex Engineer's ability upgraded to Instant**, specifically so
   the dummy agents would have something real to react with. These are
   test-pool cards, same as the rest of the stage-1 pool — not intended to
   survive into stage 3's real set as-is.

**What's next:** stage 2 (agent interface), unchanged in scope from the
previous checkpoint's plan — see `progress/current.md` for what the
priority rebuild adds to that protocol's requirements (it now needs to
carry priority windows and the public stack, not just "your turn, pick a
move").

---

## AWAITING FEEDBACK — Stage 1: Rules engine, headless (2026-09-11)

**What it delivers:** a working headless TCG rules engine in
`engine/` (TypeScript/Node, no runtime deps) — card schema, a genuinely
data-driven ability/effect system (not special-cased per card), game
state, turn structure, energy/health, win/loss detection (including a
turn-cap tiebreak so a match can never run forever), and two dummy agents
that play a full match through a clean `Agent` interface.

**Evidence, not claims:**
- `progress/sample-match-001.txt` — one full real match, 25 turns, 105
  moves, resolves cleanly.
- `progress/effect-system-demo.txt` — 10 deterministic, assertion-based
  scenarios proving every mechanic category DESIGN.md names by name
  (keywords, triggered, activated, static/continuous, targeted, AOE,
  conditional, state-mutating) actually resolves correctly, including a
  genuine cross-card cascade (onDamaged → AOE → onDeath → draw).
- 60-seed stress run, zero crashes; turn-length and win-rate distribution
  recorded in `progress/current.md`.

**Where it's strong:** the effect system is real depth, not three
if-statements — `resolveAbility` is one dispatcher every trigger goes
through, `applyDamage` is a single choke point so Barrier and onDamaged
work for free everywhere, derived (never cached) stats mean auras can't go
stale, and `processDeaths` cascades to a fixed point. The 21+20 card test
pool was built specifically to hit every named mechanic category, and it
does (proven, not asserted).

**Where it's thin:** the card pool exists to prove mechanical range, not
to be balanced or "a real set" — that's explicitly stage 3. The two dummy
agents are intentionally simple (random / greedy-face-damage); don't read
their win-rate split as a balance signal. Testing is two hand-run scripts,
not a real test framework or CI yet. Full list: `progress/quality-debt.md`.

**Decisions the owner might want to overrule:**
1. **Language/runtime: TypeScript on Node**, not e.g. Python or Rust. Picked
   for strong data-modeling (discriminated unions fit the effect-spec tree
   well) and because a JS/TS ecosystem serves the later web platform,
   server, and spectator client stages too, so the same language can carry
   the whole stack if desired. Easy to revisit now; expensive to revisit
   once stages 4–8 exist on top of it.
2. **Energy/turn model**: Hearthstone-style (max energy climbs 1/turn to a
   cap of 10, refills fully each turn, one card drawn per turn, no instant-
   speed responses from the non-active player) rather than Magic-style
   (lands as a resource you choose to play, priority passing, instants).
   This was the simpler starting point and it directly shapes what "chosen"
   targeting can mean on a triggered ability (see quality-debt.md) — if the
   owner wants Magic-style reactivity as a pillar (it would strengthen the
   "no human can track it, but it's fair" tension in principle 1/2), better
   to redirect before stage 3's card set locks in around the simpler model.
3. **Turn cap of 40 (20 per player) with a health-tiebreak**, chosen as a
   placeholder pacing mechanism to satisfy "a match must always resolve."
   It is not yet the real escalating-pressure design principle 4 asks for
   (e.g. a damage clock) — just a safety net. Real pacing tuning needs
   real playtesting volume and, eventually, a render to measure watch-time
   against.
4. **Faction names for the test pool are Cortex and Swarm** (two of the
   four factions the schema names — Aegis and Null are reserved but
   unused). Purely a stage-1 placeholder choice; stage 3's real set doesn't
   need to keep these names or restrict itself to two factions.

**What's next:** stage 2, the agent interface — turning the current
in-process `Agent`/`PlayerView` boundary into an actual protocol (HTTP or
WebSocket, to be decided and documented) with a real process-boundary
round trip proven end to end. See `progress/current.md` for the concrete
next step.
