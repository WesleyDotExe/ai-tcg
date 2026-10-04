# Notes for the owner

**Updated 2026-10-04, session 27 (Phase 5 closed).** Nothing is blocking and nothing new needs
an answer. Your 2026-10-04 section A is applied in full. Checkpoint: top of
`progress/checkpoints.md`. Numbers: `progress/balance-report-021-phase5-close.txt`.

- **Propagating Exploit 2/3 is live.** Null ~ Cortex moved into band (49.2), and Null > Aegis rose
  from 42.0 to 48.2 but stays OUT (accepted). The ring now reads 3 IN, 1 UNRESOLVED, 2 OUT, and
  that's the recorded baseline.
- **CI now runs the ring regression check on every PR** (`npm run ring -w @ai-tcg/engine`, about
  15 s). If a future set fails it, the PR goes red and auto-merge won't merge it. The rule is in
  the checkpoint, in case you want it stricter.
- **Event-log instance ids are done**, so the render lane can aim spells at their exact target.
- **Coming up in session 28**, built to your section C: persistence and the economy spec. It will
  pause at your [OWNER CHECK-IN] items. If you already know the finish list and pull rates, the
  quest list, or the starter shape, writing them in owner-feedback.md now saves a round trip.

Items 2 and 3 below (Quorum Arbiter, the Null lift) were answered on 2026-10-04 and are applied.

---

**Updated 2026-10-03, session 26 (the Phase 5 gate).** Nothing is blocking, but the gate did
not pass and two calls are yours. Full numbers: `progress/balance-report-020-phase5-gate.txt`.
Checkpoint: top of `progress/checkpoints.md`.

1. **Gate result: 2 IN, 1 UNRESOLVED, 3 OUT** (Lookahead; 2,500 seeds on the win/lose bands, 900
   on the even bands).
   - IN: Cortex > Swarm 57.4, Aegis ~ Swarm 51.2.
   - UNRESOLVED: Swarm > Null 59.4 (CI 57.5-61.3, sitting on the top edge).
   - OUT: Null > Aegis 42.0 (target 55-60), Null ~ Cortex 40.7 Null (target 45-55),
     Aegis > Cortex 52.2 (target 55-60).
   Null is behind three of the four. Aegis-over-Cortex is the only one that isn't about Null.
2. **Decision: Quorum Arbiter. I did not drop it.** You pre-authorized the drop if Cortex-vs-Null
   was still out at the gate, as the ~6-point lever session 22 measured. It isn't that lever any
   more: dropping it moves the edge -2.7 [-5.4, 0.0] on the gate seeds and -1.0 [-3.7, 1.7] held
   out, and the edge stays OUT (about 59%) either way. It's Cortex's only Mythic, so I left it
   and am asking. Say "drop it anyway" and it's a one-line deck change.
3. **Decision: a targeted Null lift. Recommended: Propagating Exploit 2/2 -> 2/3.** I measured
   +1 attack and +1 health on every Null unit (`engine/src/dev/nullLiftProbe.ts`, nothing
   shipped). The catch: the ring wants Null up vs Cortex and Aegis but NOT vs Swarm (Null should
   stay 40-45 there; it's 40.6). Most lifts raise all three, so Null-vs-Swarm breaks. Stray
   Fragment 2/2, the biggest lift, reaches 51.8 vs Swarm held out. Propagating Exploit at 2/3
   is the one with the right shape. On held-out seeds:
   - vs Cortex: 39.1 -> 48.0 (into the even band)
   - vs Swarm: 40.9 -> 43.6 (stays in its 40-45 band)
   - vs Aegis: 42.8 -> 50.5 (up 7.7, still short of 55-60)
   That's a stat buff, which you've steered away from for Null before, so it's your call. It
   keeps all 20 Null mechanics and touches no other faction. No single +1 reaches Null > Aegis.
   That edge needs something Aegis-specific or your acceptance that it stays OUT.
4. **Watchdog Timer buff shipped as you approved** (hand of 1 or fewer). It draws 4x as often (23
   -> 102 per 900 games) but moves Null only +0.3, inside noise. No overshoot, so it stays.
   `progress/sample-match-027-watchdog-buff.txt` shows one of those draws in a real game.
5. **Aegis > Cortex (52.2) is short, and it isn't about Null.** It was in band after session 19
   and has drifted down since (the Cortex slice, then the agent fixes). I haven't probed it. If
   you want it fixed before Phase 5 closes, the same probe pointed at Aegis is the next step.

---

**Previous update, 2026-10-01, session 25 (your 2026-10-01 entries: claude-tools
reference, Commodity Rack, the Null card-vs-agent check).** Nothing is
blocking. Full numbers: `progress/balance-report-019-agent-check.txt`.

1. **Null is now clearly the weakest faction. This is the main thing to
   look at.** Under Lookahead (900 seeds) it's 40.0 / 38.9 / 41.4 vs Cortex
   / Swarm / Aegis. Three edges are OUT, all Null's: Null-vs-Cortex (even
   band), Aegis over Null, and Cortex over Null from Cortex's side. Most of
   the drop is the Commodity Rack nerf you asked for. Null ran 3 Racks, and
   the nerf alone cost it about 6 / 3.5 / 6 points. The decomposition is in
   report 019. Your instruction was followed in the order given: check the
   agent first, then nerf. I'm flagging the size of the side effect because
   the Phase 5 gate is next and will measure this ring.
2. **Card advantage is not an agent problem.** A LookaheadAgent with
   card-draw weight W played one with the shipped 1.5, 16,000 games per
   weight. Nothing beat 1.5, and 4.5 and 6 were measurably worse. Draw
   cards didn't improve in the probe at weight 4.5. So Rack went 3/3 ->
   3/2. It now probes at 41.3%, level with Rollback Point (42.1) and Scrap
   Recycler (41.2) instead of 4-10 points clear of every other neutral.
3. **Null card-vs-agent check (your item 4 and session 23's note 3):
   settled card by card.**
   - **Bit Rot was an agent misplay.** 222 of 240 casts hit a unit that
     never fought that turn. The agent valued a this-turn -3/-0 at 40% of
     its size wherever it landed. On the old agent, cutting a copy was worth
     +2.7 points to Null; on the fixed agent it's -0.5. Fixed: a this-turn
     buff is now worth the fight it changes. Now 184 of 235 casts answer a
     declared attack (`progress/sample-match-026-bit-rot-response.txt`).
   - **Decay Ward's host was a coin flip** (112/206 on a weaker unit).
     Fixed, but its measured cost barely moved (+1.5 -> +1.4, CI spans 0).
   - **Watchdog Timer is a weak card**, not misplayed. It drew 36 cards in
     900 games, and cutting a copy is still +1.9 (CI 0.3-3.4). **Decision for
     you:** it's one of your endorsed mechanics, so I didn't touch it. A
     candidate buff that keeps the catch-up identity: draw when the hand has
     1 card or fewer, not only when it's empty.
   - **Null Pointer is situational.** It always hits the only directive, but
     sat in hand with nothing to hit in 270 of 900 games. +1.2 to cut, CI
     spans 0. That's the cost of a dedicated answer card. No change.
4. **The agent fix changes other factions' cards too.** Reflex Spike (Swarm)
   and Hotfix (Cortex) are now held for real combats. Reflex Spike plays
   fell from 1,990 to 1,011 games out of ~2,000 drawn. Rally Cry still plays
   pre-combat (465 -> 439). Swarm got a little stronger.
5. **Packages re-searched on the fixed agent and the 3/2 Rack.** Null: no
   neutral card helps, so it's back to its own 36 cards (held-out objective
   314 -> 249). That also restores Kernel Panic's density. Aegis: -1 Salvage
   Reflex, +1 Uplink Tower (243 -> 234). Every per-edge change is inside
   noise; it shipped on the rule. Cortex keeps its package; Swarm runs none.
   **Neutral cards now in decks:** Rollback Point and Surge Protector
   (Cortex), and Uplink Tower (Aegis).
6. **claude-tools is gone from the repo** except your own words in
   `owner-feedback.md`, which I didn't edit. The comment in `edgeMeasure.ts`,
   my notes here, the quality-debt items, report 017 and the log no longer
   name it. The math and the parity fixture test are unchanged.
7. **Session order:** your entry said "next session priority: the Null
   card-vs-agent check", so this was a balance session even though the last
   merged PR (#33) was also balance. Under the alternation rule the next
   session is render, then the Phase 5 gate.

---

**Updated 2026-09-30, session 24 (Phase 5 step ii: the neutral pool).**
Nothing is blocking. Full numbers: `progress/balance-report-018-neutral-pool.txt`.

1. **Shipped: a 10-card neutral pool, plus hybrid decks** (one faction + at
   most 10 neutral copies). "Utility, not identity" is a load-time check. A
   neutral card can't be removal, Mythic, Guard/Barrier/Rush, an evolution
   or telegraph, a summon, a static/aura, or faction-conditional. A faction's
   clock and card flow must come from its own cards. **Decisions you may
   want to overrule:** the 10-copy cap, and the exact list of what counts as
   identity.
2. **Who runs what.** Each package was picked by a measured search toward
   the ring bands and shipped only if it also helped on 2,500 held-out
   seeds.
   - Cortex: -Signal Drone, -Overclock Shunt; +Rollback Point, +Surge
     Protector.
   - Null: +3 Commodity Rack, +1 Rollback Point. That's add-only, 36 -> 40,
     with nothing cut, per your 2026-09-29 item 1. The first search did cut
     Null copies, and I threw that run away.
   - Swarm and Aegis run none.
3. **A LookaheadAgent bug moved the ring more than the new cards did.** It
   valued heals at their printed amount even at full health. Cortex Engineer
   "repaired" 1,231 times in 200 games and healed something 66 times, which
   burned the energy Cortex should have held. It's fixed, and all repairs
   now heal. On the fixed agent Cortex is ~3-6 points stronger on every edge
   (vs Null: 58.9 -> 65.7 before the neutral packages). This bears directly
   on your note-3 question: the arbiter can misplay a card badly enough to
   move an edge 6 points. I haven't checked Null's removal cards for the
   same thing yet.
4. **Ring now** (Lookahead, 900 seeds). Only Aegis over Null is OUT: 52.2%
   Aegis, target 40-45, down from 60.4%. Everything else is UNRESOLVED, and
   no edge is confirmed out apart from that one. Null's mean went 40.8 ->
   44.1. Cortex vs Null is 58.1% Cortex, CI 54.9-61.3.
5. **Two things you might not like:**
   - **Commodity Rack** (a vanilla 3/3 for 3) is the neutral card that wins.
     In a probe it hits 48% vs 34-42% for every utility card. Either it's
     over-rate, or the agent prefers stats to card draw. If you want neutral
     to mean "utility", the fix is a weaker Rack (2/3 or 3/2), then a
     re-search.
   - **Kernel Panic** now shows in 7.1% of Null games (was 9.9%), because
     the deck is 40 again. Your call: +3-4 points per Null edge vs arc
     visibility.
6. **Self-containment (your 2026-09-30 entry) is done.** There is a
   hardcoded parity fixture test and no external calls. (The provenance
   line was removed in session 25, per your 2026-10-01 entry.)
7. **Next balance session is the Phase 5 gate.** It runs at 900 seeds for
   the even bands and ~2,500 for the narrow bands, per your 2026-09-29 item
   2.

---

**Updated 2026-09-28, session 23 (the Null consistency trim, 40 -> 36).**
Nothing is blocking. Full numbers: `progress/balance-report-017-null-trim.txt`.

1. **Shipped: Decay Ward 2->1, Fork Bomb 3->2, Null Shell 3->1.** All 20
   unique Null cards stay, and Kernel Panic stays at 2 copies. On 3,600 seeds
   the search never saw, Null gained about 3.5-4 points on each edge, and
   Kernel Panic now shows up in about 10% of Null's games (was ~7.5%). Null
   is still the weakest faction: 41.1 / 41.7 / 39.6% vs Cortex / Swarm / Aegis
   under Lookahead (900 seeds). The Null > Aegis edge is still inverted.
2. **Decision you may want to overrule: I didn't take the bigger lift.**
   With single-copy cards allowed to go, the search cut Bit Rot, Null Pointer
   (2->1), Decay Ward and Watchdog Timer. That lifted Null about twice as
   much on held-out seeds (+7.7 / +8.1 / +6.9), close to band on Cortex and
   Swarm. But Bit Rot and Watchdog Timer are Null's only Instant combat trick
   and only turn trigger, two of the five mechanics you endorsed in session
   21. I read "measured-weakest filler" as excluding them. If you'd rather
   have the lift, it's a one-line deck-list swap (variant B in report 017),
   plus relaxing one variety test.
3. **Related finding:** under Lookahead, Null's weakest copies are its
   removal/debuff cards: Bit Rot, Null Pointer, Watchdog Timer, then Decay
   Ward. Either those cards are weak, or LookaheadAgent plays them badly. I
   haven't separated the two yet.
4. **For the 900-seed gate: the CI rule can't confirm a 5-point band at 900
   seeds.** A 95% interval at 900 games is about +/-3.2 points, wider than
   the win/lose ring bands (55-60, 40-45). Under your "out only when the CI
   misses the band" rule, those pairings can come back OUT or UNRESOLVED,
   never IN. The 10-point even bands can still come back IN. Options: run the gate's
   Lookahead side at ~2,500 seeds per pairing (well under a minute), or
   accept UNRESOLVED as a pass for the gate. I'd do the former. The CI
   verdicts are now built into `lookaheadEdgeCheck.ts`.
5. **Cortex-vs-Null moved toward band as you predicted:** 61.1 -> 58.9 Cortex
   under Lookahead, still out (CI 55.6-62.1). Per your item 3, the Quorum
   Arbiter decision waits for the gate.
6. **Side fix:** the engine logged an Intercept Routine "redirect" onto the
   unit already being attacked (from == to). It now logs a fizzle instead.
   Game state is unchanged, so balance numbers are unaffected.

---

**Updated 2026-09-26, session 22 (Phase 5 slice 4: Cortex depth/variety
pass, 19 -> 24 unique cards).** Nothing is blocking. Three things worth a
look (full numbers: `progress/balance-report-016-phase5-cortex-slice.txt`):

1. **Cortex-vs-Swarm is fixed or nearly fixed.** Under Lookahead it went from
   44.3% to 58.7% Cortex on the standard 300-seed report (in band). Over 900
   seeds it went from 46.7% to 54.1%, just under the 55% floor.
   Aegis-vs-Cortex stayed in band.
2. **The 300-seed reports have been noisier than we treated them.** One
   standard error is about 2.9 points. Over 900 seeds, the baseline
   Null-vs-Cortex edge was already out of band (57.9% Cortex, not 55.0%).
   More importantly, Null is below 45% against every faction, including
   Aegis (37.3%), which the ring says Null should beat. Null is weaker than
   the reports showed. **Proposal:** run the mandatory end-of-Phase-5 ring
   re-measure at 900 seeds. The full three-policy report takes about 11
   seconds at 300 seeds, so 900 is roughly 35 seconds. The new `engine/src/dev/lookaheadEdgeCheck.ts` already does this
   for Lookahead.
3. **Decision you may want to overrule: I let Cortex-vs-Null drift further
   toward Cortex (57.9 -> 61.1 over 900 seeds) to fix Cortex-vs-Swarm.** I
   measured whether both could be held at once. Across 150 copy mixes and
   several card-design variants, Cortex's rate against Null moved almost
   1:1 with its rate against Swarm. No mix achieved both. My read is that
   this edge follows Null's overall weakness, and the fix you already
   sanctioned (trim Null back toward ~36 cards for consistency) is the right
   lever. If you'd rather Cortex give some of the Swarm gain back instead,
   dropping Quorum Arbiter is the single cleanest lever (about -6 against
   both Swarm and Null).
4. **Order question:** your stated order is the neutral pool next, then
   the re-measure gate. Null's consistency trim has no fixed slot. Given
   item 2, I'd do Null's trim before the neutral pool so the gate measures
   a ring where every faction has had a fair shot. Next balance session
   follows your stated order unless you say otherwise here.

---

**Updated 2026-09-26, session 21 (Phase 5 slice 3: Null depth/variety
pass, 15 -> 20 unique cards).** Nothing is blocking. Three quick steers
would help, and the full detail is in `progress/checkpoints.md`'s newest entry:

1. **Kernel Panic now shows up about half as often.** I filled Null's deck
   from 32 to 40 without trimming anything, to keep it from getting
   stronger. The side effect is that its evolution finisher appears in
   roughly half as many games. Is that fine, or should a later slice trim
   back toward ~36 so the arc stays visible to viewers?
2. **Watchdog Timer draws only when Null's hand is empty.** My first
   version drew when Null had fewer than 2 units, but it never fired
   once in real play. The empty-hand version is the one that ships.
3. **Null is still the weakest faction under Lookahead, at 42% on
   average.** Its intended edge over Aegis sits at 45%, below the
   55-60% target. You asked for no power buff, so I left it. Expect the
   end-of-Phase-5 re-measure to flag it.

---

**Updated 2026-09-26, session 20 (Phase 5 slice 2 — Swarm grown 16 -> 20
unique cards, general power-level pass).** Full detail in
`progress/checkpoints.md`'s new entry, short version here:

1. **Cortex-vs-Swarm — the project's last standing triple-flagged pairing
   — is resolved, but overshot.** It's no longer triple-flagged in any
   direction, but it moved past even into mild Swarm-favour (Lookahead
   55.7% Swarm) instead of landing on the ring's actual target (Cortex
   should win 55-60%). Per your own 2026-09-23 instruction for this exact
   pairing, I didn't touch it specifically this session — a broad Swarm
   buff was exactly the "wider pool" action you predicted would settle it,
   and it did settle, just slightly past the mark. Say if you want a
   future slice to pull it back toward Cortex, or if "no longer
   triple-flagged, close enough" is fine for now.
2. **Same honest pattern as session 19: I designed a first cut, caught it
   overtuned myself, and shipped a corrected version — not the first
   design.** This time the mistake was benchmarking Swarm's new cards
   directly against Aegis's OWN new cards from last session (Aegis Line
   Trooper, Bulwark Chassis, Reinforced Bastion), without checking that
   those cards were themselves among Aegis's stronger performers (58-63%
   win rate in their own pool), not a neutral stat-line baseline. The
   first cut spiked Swarm's entire deck's win rates uniformly — worth
   knowing as a real methodology lesson for future Phase 5 slices, not
   just this session's mistake: copying a precedent card's exact numbers
   only works if the precedent card itself measured as average, not
   strong.
3. **Swarm-vs-Null didn't resolve — it changed shape.** Before this
   session, Random/Aggressive/Lookahead roughly agreed Null won too often.
   Now Aggressive and Lookahead favour Swarm instead, while Random still
   favours Null. I read this as real progress under this project's own
   standing rule (Lookahead is the trusted arbiter since the 2026-09-25
   "accept the ring" entry, and Lookahead now favours Swarm, which is the
   ring's actual intent) — but I want you to see the raw split rather
   than have me quietly decide it's fine, since Random disagreeing this
   starkly is a bigger gap than most of this project's other
   single-policy holdouts.
4. **Which faction should get the next Phase 5 slice?** I'd pick Null over
   Cortex — Cortex hasn't been named a problem since the ring correction,
   while Null still has the open Swarm-vs-Null question above that a
   Null-side slice could help settle alongside its own growth toward
   30-40 cards. Say if you'd rather see Cortex next, or want me to
   address item 1 (Cortex-vs-Swarm's overshoot) before growing either
   pool further.

---

**Updated 2026-09-25, session 19 (Phase 5 slice 1 — Aegis grown 18 -> 22
unique cards, aimed at the Aegis-vs-Cortex pairing).** Full detail in
`progress/checkpoints.md`'s new entry, short version here:

1. **Aegis-vs-Cortex is no longer triple-flagged** — the project's actual
   pass/fail bar — for the first time across three sessions that tried (11,
   18, 19). Random and Lookahead both land in the 55-60% target band;
   Aggressive is a bit out of band (47.0%, Cortex-favoured) but not extreme.
   If you want Aggressive in band too, not just the triple-check clear, say
   so; otherwise this is treated as done, matching how session 18's
   Aegis-vs-Null result was treated.
2. **A judgment call worth your eyes: the first design attempt was
   overtuned and I caught it myself, not you.** I originally shipped Bulwark
   Chassis as a 1/5 and Reinforced Bastion as a 2/6 Guard (both, on
   reflection, printed above the pool's existing curve — Reinforced Bastion
   in particular was strictly better than Cortex's own Firewall Sentinel at
   the same cost). Re-measuring before committing showed it made Aegis
   generically too strong, not specifically better against Cortex — it also
   swung Aegis-vs-Swarm and Aegis-vs-Null hard out of band. I scaled both
   cards back to explicitly match existing same-cost cards' stat lines
   before shipping. Flagging this because it's exactly the kind of mistake
   a card-design pass can make silently if nobody re-measures — I did
   re-measure, and it's what caught it, but you should know the first
   instinct was wrong and by how much (details in
   `progress/log.md`'s session-19 entry).
3. **New watch item: Aegis-vs-Swarm drifted out of its "even" band.**
   57.7-78.7% Aegis-favoured (not triple-flagged, so not an emergency, but a
   real move worth tracking) — collateral from Aegis getting generically
   stronger this session, not a Swarm-specific problem. I didn't chase this
   further inside this session (it wasn't this slice's target and Swarm has
   its own Phase 5 growth coming), but wanted you to see it named rather
   than only surface in a future report with no context.
4. **Which existing cards absorbed the copy trims that funded the new
   cards was picked by lowest measured win rate, not design intent.** One
   casualty: Latent Ward (the telegraph=2 trial from your 2026-09-13
   feedback) lost a copy (2->1) for measurement reasons unconnected to
   that trial's still-open "does a longer fuse feel different" question —
   it's still in the deck, just at minimum copies now. Say so if you'd
   rather that trial stay at full representation while it's still being
   judged.

---

**Updated 2026-09-25, session 18 (Phase 4 session 17 follow-ups executed —
ring labels corrected, Aegis-vs-Cortex fix, Null past-cost nerf).** Nothing
blocking, but two real steers wanted — full detail in
`progress/checkpoints.md`'s new entry, short version here:

1. **Aegis-vs-Null and Swarm-vs-Null are both now clear of the triple-flag**
   (the Null step-4-past-cost nerf: Kernel Panic's destroy reach tightened
   maxHealth 5->4, Null Singularity's health cut 8->7). Aggressive (72.0%)
   and Random (72.3%) are both still individually above 60% for Null in the
   Aegis matchup even though the cross-check is clear — if you want those
   two policies in band too, not just the triple-check clear, say so and
   a future session can push further; otherwise this is left as-is per
   "stop when it lands in band," reading that as the triple-flag clearing.
2. **Aegis-vs-Cortex: genuinely open, two attempts behind it now.** A first
   attempt (a new Barrier-granting Tool) measured worse and was reverted —
   full honesty on why in `progress/log.md`'s session-18 entry. A second
   attempt (Guard Directive Chip 2->3 copies, its own best-performing card)
   moved the numbers in the right direction but landed on NO policy's
   55-60% band (Aggressive 35.7%, Random 54.3%, Lookahead 48.3% Aegis).
   The remaining Aggressive-policy gap in particular (Cortex still wins
   64.3%) looks to this session like it may be partly an agent-heuristic
   artifact rather than a pure card problem — but that's a read, not a
   certainty. Genuinely open: try a second, differently-shaped Aegis card
   (something with immediate board impact) before Phase 5, or let Phase 5's
   wider pool settle this pairing the same way it's expected to settle
   Cortex-vs-Swarm? Your call.
3. **Phase 5 (pool expansion) is still not started.** Two pairings remain
   open (Cortex-vs-Swarm, explicitly left for Phase 5 per your own
   instruction; Aegis-vs-Cortex, now with two attempts behind it and still
   out of band). If you'd rather treat "two open pairings, both plausibly
   Phase-5 territory" as good enough to start pool expansion with these
   named as carried-forward watch items, rather than a third consecutive
   session chasing Aegis-vs-Cortex card-by-card, say so — this session
   didn't decide that unilaterally.

---

**Updated 2026-09-23, session 17 (Phase 4 decisions executed — Null step 4,
buff Swarm; whole ring re-measured).** Nothing blocking, but real steers
wanted — full detail in `progress/checkpoints.md`'s new entry, short version
here:

1. **Did exactly what you asked, in order** (Kernel Panic 5->6, Null
   Singularity 6->7, then two new Swarm cards — Colony Broodling replaces
   itself on death if 2+ other units survive, Overgrown Carapace's own
   health scales with your board width), then re-measured the whole ring.
   Neither Cortex nor any other faction was nerfed.
2. **Real movement, not there yet.** Aegis-vs-Null moved down under all
   three policies for the first time ever in this project (was
   78.0/72.0/67.7, now 75.7/70.0/65.3) but didn't reach your stated "stop at
   55-60%" line. Swarm-vs-Null stopped being triple-flagged (only Random
   still flags it) — the ring's most backwards edge is now much closer to
   fixed. Cortex-vs-Swarm, which I wasn't authorized to touch on either
   side, is unchanged.
3. **I stopped rather than guess at a next step**, per your own "if it
   lands in band, stop" phrasing implying otherwise I should hold — happy
   to be told to keep going and what with. Two live questions: (a)
   Cortex-vs-Swarm has nobody assigned to fix it — should Swarm get a third,
   more targeted card, or is this meant to wait for Phase 5's wider pool?
   (b) Kernel Panic and Null Singularity are still extreme win-rate outliers
   *when played* (up to 86.4%/78.7%) — the cost hike changed how often they
   land, not how strong they are. Want me to touch their stats/effects next,
   or leave cost as the only lever for now?
4. **Per your own instruction, I did NOT start Phase 5** (pool expansion) —
   the ring isn't in band on any of the six pairings yet.

---

**Updated 2026-09-22, session 16 (Phase 4 — the counter triangle, proposed
and measured; the Null backstop executed).** Nothing blocking, but real
steers wanted — see `progress/checkpoints.md`'s new Phase 4 entry for the
full write-up (this is the short version, per your own 2026-09-21 process
reminder to write checkpoint-worthy decisions here/there, not just in a PR
body):

1. **The triangle proposal itself needs your confirmation, not just a
   read.** I adopted your own 2026-09-20 example as-is (Null beats Aegis,
   Aegis beats Swarm, Swarm beats Null, Cortex flexible) and translated
   "55-60%/45-55%" onto each of the six pairings myself — that specific
   translation is my own first pass, not something you spelled out
   pairing-by-pairing.
2. **Measured against it: none of the six pairings pass yet.** Two
   different problems, not one — Cortex is too strong against Swarm (and,
   under one policy, Aegis), which contradicts "flexible in the middle";
   and Null's side of the cycle is actively backwards on one edge (Swarm is
   supposed to beat Null, currently loses to it 55-81%) as well as
   overshooting on the other (should beat Aegis by 55-60%, currently wins
   by up to 78%).
3. **I executed your pre-authorized Null backstop (3 of its 4 steps)
   without asking first**, since its own trigger condition (Null winning
   60%+ against Aegis under all three policies) was already true going in —
   that's what "pre-authorized" means, so I didn't treat it as a new
   decision needing sign-off. Segmentation Fault is now a conditional aura
   (a small, genuinely generic engine addition, not a card-only hack);
   Corrupted Process lost a copy; Entropy Harvester now scales off the
   enemy's graveyard instead of Null's own. Honest result: measurable but
   small movement, both pairings still flagged.
4. **Step 4 (cost increases) — I stopped and I'm asking, not guessing.**
   The data points at Kernel Panic and Null Singularity specifically (both
   extreme played-win-rate outliers), but both already cost exactly what
   their faction-mirror equivalents cost elsewhere (Aegis Warden 5, Prime
   Aegis 6) — pushing them higher would be the first time any faction's
   top end costs strictly more than its peers, a cross-faction curve call I
   didn't think was mine to make alone. Want me to do it anyway, or look at
   Aegis's/Swarm's own kits instead?
5. **Cortex-vs-Swarm — measured, still not fixed, and there's no
   pre-authorized mechanism for it the way there is for Null.** Should
   Cortex be nerfed, or Swarm/Aegis buffed? I didn't pick a faction to touch
   unilaterally here.

My own instinct if you'd rather I just proceed with a default: the
Swarm-vs-Null inversion looks like the most structurally wrong result on
the board (worse than "right direction, too strong" or "wrong faction
strong") and hasn't been targeted by anything yet — I'd look at giving
Swarm's own kit more staying power against Null next, rather than
continuing to only nerf Null. But I've held off doing that unilaterally
since it's a card-set-design call on a faction this session didn't touch.

---

**Updated 2026-09-21, session 15 (Phase 3 of your "fix the loop" plan — the
load-time card-pool lint).** Nothing blocking, but two things worth a
steer, written here directly per your own 2026-09-21 process reminder
rather than left in the PR body:

1. **The "removal/debuff card" classifier is my own first-cut call, not
   something your 2026-09-20 entry defined.** The entry names the rule
   ("removal/debuff cards <=25% of a deck") but not what counts as one. I
   defined it as: an `onPlay`/`static`/`activated` ability that destroys,
   damages, or negatively affects the opponent, or a standing aura/tax that
   debuffs them — and deliberately EXCLUDED reactive triggers
   (onAttack/onDamaged/onDeath/onTurnStart/onTurnEnd), on the reasoning
   that a card's secondary "it happens to graze the opponent when it dies"
   effect isn't the same deck-building commitment as a Command you cast
   specifically to answer the board. This is a real judgment call, not a
   derivation — with it, Cortex (32.5%) and Null (50%) needed fixes and
   Swarm/Aegis already passed; without the reactive-trigger exclusion, all
   four factions would have needed cuts, including ones that only have a
   reactive damage trigger as basically incidental flavour on a creature.
   Your call whether the current definition is right, too narrow, or too
   wide — `engine/src/cards/poolLint.ts`'s own header comment has the full
   reasoning if you want to look at the code directly.
2. **Fixing Null's pool to pass the lint made Aegis-vs-Null and
   Swarm-vs-Null measurably WORSE, not better** (see
   `progress/balance-report-009-poollint.txt` against session 14's
   baseline). The likely cause: I gave Corrupted Process a real draw effect
   (both to cut its removal-density contribution and to fix Null's total
   lack of card flow — the lint's rule 4), and even after cutting several
   of Null's weaker removal cards, the extra card advantage seems to have
   made its deck more consistent at finding its remaining strongest,
   untouched cards (Kernel Panic, Null Singularity, Null Pointer,
   Segmentation Fault). Per your own 2026-09-20 "Null dominance" entry,
   I've deliberately NOT nerfed anything in response to this — that entry
   reserves ability nerfs for after the Phase 4 triangle re-measure, not
   before, and the lint itself (this session's actual job) is real, tested,
   and correct regardless of this particular number. Flagging now so Phase
   4 starts from an accurate picture rather than being surprised by it.

No decision, asset, or credential only you can provide is needed to
proceed — the roadmap default is to move to Phase 4 (propose the intended
counter triangle at a checkpoint, then measure against it) next.

---

**Updated 2026-09-20, session 13 (Phase 2 item 3 of your "fix the loop"
plan — directives are now removable).** Nothing blocking. One thing worth a
glance: re-measuring after giving every faction a directive-destroy answer
moved two matchups in opposite directions, neither of them the pairing this
work targeted. Cortex-vs-Aegis is no longer triple-flagged (plausibly Aegis
can now destroy Cortex's Mainframe Core aura) — good news, not acted on
further. Cortex-vs-Swarm is newly triple-flagged (60.7%/64.0%/66.0%) — a
real but modest side effect, most likely from trimming 2 Cortex cards to
make room for its new answer card under the 40-card cap, not from the
directive-removal mechanic itself. Per your own 2026-09-20 instruction to
stop chasing individual numbers and work the phases in order, neither was
tuned this session — both are just honestly reported here and in
`progress/balance-report-006-directive-removal.txt`. Aegis-vs-Null (the
long-standing pairing) is essentially unchanged, as expected since this
session's work didn't target it. No action needed from you unless you want
to steer priority between finishing Phase 2 (items 4-5: a summon/token
effect kind, base protection while unevolved) versus jumping to look at
Cortex-vs-Swarm specifically — the roadmap default is to keep going in
phase order.

---

**Updated 2026-09-20, session 12 (Phase 1 of your "fix the loop" plan).**
Nothing blocking. Two follow-ups to the notes below, both from your own
2026-09-20 direction, not new asks:

- **The structural agent-measurement question below (the old item 2) has
  now been acted on**, exactly as your 2026-09-20 feedback's Phase 1 item 1
  asked: a third reference agent (`LookaheadAgent`) that values board state
  instead of raw card cost now runs alongside the other two in
  `balanceReport.ts`, and a pairing is only flagged when all three agree.
  Building it carefully paid off immediately: it caught its own real bug
  (five Commands scoring zero forever due to an "all"/"self" targeting
  gap) before that bug could ever reach a balance report — see
  `progress/log.md`'s session-12 entry if you want the detail. No
  additional steer needed from you here unless you want to weigh in on the
  approximations named in `progress/quality-debt.md`'s new session-12
  section.
- **Aegis-vs-Null (the old item 1) is still open, and correctly untouched
  this session** — your 2026-09-20 feedback is explicit that Phases 1-4
  come before resuming that pairing specifically. With the fixed
  instrument, it's joined by Cortex-vs-Aegis, now confirmed flagged under
  all three policies (previously only under Aggressive). Both wait on
  Phase 2 (engine gaps: directive removal, a summon/token effect kind, base
  protection while unevolved) before any further tuning — no action needed
  from you unless you want to steer that order.

---

**Worth a read when you have a spare minute (updated 2026-09-19, session
11 — Aegis defensive interaction + the chosen-targeting fix).** Not
blocking — the roadmap can proceed either way — but two things worth your
steer:

1. **Aegis-vs-Null is still flagged after adding real, tested, non-removal
   defensive interaction to Aegis's kit** (intercept/redirect, a cost tax,
   and a damage-blunt — see `progress/balance-report-004-aegis-defense.txt`
   for the full journey). Per your own 2026-09-19 instruction, this is left
   flagged rather than adding removal or guessing at more numbers. Your
   call on what's next: (a) leave it as documented, known debt for now and
   move to card-pool depth (roadmap item 4); (b) point at a specific
   further direction for Aegis or Null; or (c) something else.
2. **A more structural question the investigation surfaced:** the first
   attempt at these cards (2 copies each) measured WORSE across every Aegis
   matchup, not just Null — a real regression I did not ship. Isolating why,
   the most plausible driver is that the dummy reference agents
   (`AggressiveAgent`/`RandomAgent`) have no way to value a reactive or
   situational card correctly — `AggressiveAgent` always plays the
   highest-cost card it can afford, with no sense of "is this useful right
   now," so a card like Intercept Routine (does nothing without a pending
   attack to redirect) or Tariff Field (no immediate board impact) sometimes
   wins that slot over a real tempo play, for nothing. I shipped a smaller
   dose (1 copy each) to reduce the exposure, but the deeper issue is that
   `balanceReport.ts`'s whole method — pit dumb heuristic agents against
   each other, measure win rate — may be structurally unable to fairly
   value exactly the kind of skill-expressive, situational cards design
   principle 3 asks for more of. This isn't blocking (stage 2+ real agents
   will eventually supersede the dummies), but it's worth knowing before
   more "defensive"/reactive-style cards get added and keep reading as
   worse than they are. No action needed from you unless you want to steer
   whether to invest in a smarter reference agent sooner than the current
   roadmap implies, purely to make balance measurement trustworthy for this
   class of card.

Nothing is blocking right now (updated 2026-09-18, session 10 — the
Aegis-vs-Null fix you asked for). Did exactly the two-step process from
your 2026-09-17 feedback (condition Kernel Panic's destroy, then adjust a
Null number since it was still flagged) and measured both steps
separately — see `progress/balance-report-003-null-fix.txt`. Honest
result: the pairing is still double-flagged (74.7%/79.0%, down slightly
from 75.0%/81.3%) — a small real improvement, not a fix. An instrumentation
pass found no single card explains the gap. The most likely real driver:
Aegis's own card pool has almost no independent interaction/removal
(Perimeter Turret's telegraphed random 3-damage hit and Lockdown Field's
1-turn stasis are close to its whole answer suite) — a deck built purely
around stacking value into a few units with barely any way to interact
with the opponent's board. Fixing that means adding real interaction to
Aegis's own kit, which is a card-set-design change that reshapes Aegis's
balance against ALL factions, not just Null — flagging it here rather than
building it unilaterally in case you'd rather steer that direction (e.g.
what kind of interaction fits Aegis's "hardened guardian" identity) before
a future session does. Not blocking either way; the roadmap can proceed to
the rest of item 3 (Swarm-vs-Aegis, the Cortex pairings) in the meantime.

Nothing is blocking right now (updated 2026-09-17, session 9 — non-engine
test coverage). Your 2026-09-17 feedback on the Aegis-vs-Null fix direction
was read this session but deliberately NOT acted on yet — it explicitly says
to do that work "when the item 3 balance pass comes up, not before item 2,"
and item 2 (server/protocol/agents having zero automated tests) was the
roadmap's next unblocked item, so this session built that instead. The
Kernel Panic condition fix is still queued, correctly, for whichever future
session works roadmap item 3 next.

Nothing is blocking right now (updated 2026-09-16, session 8 — the fourth
faction, Null). Didn't need any decision, asset, or credential only the
owner can provide. One thing worth a glance if you have a spare minute:
Aegis-vs-Null is measuring at 75-81% in Null's favour (see
`progress/balance-report-002-null.txt`) — a plausible read is that it's
Kernel Panic's unconditional `destroy` landing on Aegis's whole
stacking-value identity (evolved/tooled-up units), which may be closer to
a hard counter than the "soft counter" design principle 3 asks for. Not
blocking (it's on the roadmap as the next balance item), but flagging in
case you'd rather steer the fix direction (e.g. "make destroy require a
condition" vs. "just keep tuning Null's stats down") before a future
session picks one unilaterally.

Nothing is blocking right now (updated 2026-09-14, session 6). Backfilling
Cortex and Swarm with one telegraph/evolution/Tool card each (closing the
"board-development system is Aegis-only" gap) didn't need any decision,
asset, or credential only the owner can provide — see the new session in
`progress/log.md` and `progress/current.md` for what shipped and what's
flagged as an overrulable judgment call (mainly: Cortex/Swarm got matching
*variety*, not matching *density*, with Aegis; and Cortex's deck now sits
exactly at the enforced 40-card ceiling). Feel free to weigh in via
`progress/owner-feedback.md`; if not, the project proceeds on the choices
made.

Nothing is blocking right now (updated 2026-09-14, hardening-pass session).
The telegraph delay=2 trial (Latent Ward) this session asked for is
mechanically in place and fires correctly in real play, but "compare how
the window feels" genuinely can't be judged yet — there's no render/
spectator experience to watch it in. Worth re-asking once stage 6
(spectator render) exists; not a blocker now.

Nothing is blocking right now — stage 3 (real card set + unified
board-development system) didn't need any decision, asset, or credential
only the owner can provide. The open numeric parameters it introduced
(board-slot count, telegraph timing, evolution strict-vs-loose, deck size
range) are all steerable, non-blocking choices — see the new checkpoint in
`progress/checkpoints.md` and `progress/owner-feedback.md`'s updated
2026-09-12 entry for the full list. Feel free to weigh in on any of them in
`progress/owner-feedback.md`; if not, the project proceeds on the defaults
chosen.

Nothing needed for the art pipeline yet — that's correctly deferred to a
late polish pass per DESIGN.md, well after there's a real game to skin.
The owner's cyberpunk + 1990s retro-futurism direction (2026-09-11
feedback) is now reflected in a second faction's flavour text (Aegis, this
session) on top of Cortex/Swarm; it will carry forward into the eventual
art-generation pass too.
