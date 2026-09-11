# Notes for the owner

Nothing is blocking right now — stage 1 (including its priority/reactivity
redo) didn't need any decision, asset, or credential only the owner can
provide.

One non-blocking heads-up, also raised in `progress/checkpoints.md`: stage
2 (agent interface) needs to pick a wire protocol for agents to talk to
the match server over — HTTP request/response (simple, stateless, fits
"send state, get a move back") or a WebSocket (lets the server push state
updates, useful later for spectating a live match without polling). Now
that the game has real priority windows (an agent may need to be asked for
a move *during the opponent's turn*, not just on its own), a WebSocket's
server-push shape fits a little more naturally than plain request/response
— but HTTP long-polling for "is it your priority yet" would also work.
The next session will pick one and document it if the owner has no
preference; flagging here in case there's a preference worth stating
before that's locked in.

Nothing needed for the art pipeline yet — that's correctly deferred to a
late polish pass per DESIGN.md, well after there's a real game to skin.
Noting the owner's stage-1 feedback on direction (cyberpunk + 1990s
retro-futurism) is recorded and will carry forward into that pass and into
stage 3's real card set, per `progress/owner-feedback.md`.
