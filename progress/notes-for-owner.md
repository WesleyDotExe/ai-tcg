# Notes for the owner

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
