# Notes for the owner

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
