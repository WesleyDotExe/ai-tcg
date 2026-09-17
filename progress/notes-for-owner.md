# Notes for the owner

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
