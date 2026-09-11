# Notes for the owner

Nothing is blocking right now — stage 1 didn't need any decision, asset,
or credential only the owner can provide.

One non-blocking heads-up, also raised in `progress/checkpoints.md`: stage
2 (agent interface) needs to pick a wire protocol for agents to talk to
the match server over — HTTP request/response (simple, stateless, fits
"send state, get a move back") or a WebSocket (lets the server push state
updates, useful later for spectating a live match without polling). The
next session will pick one and document it if the owner has no preference;
flagging here in case there's a preference worth stating before that's
locked in.

Nothing needed for the art pipeline yet — that's correctly deferred to a
late polish pass per DESIGN.md, well after there's a real game to skin.
