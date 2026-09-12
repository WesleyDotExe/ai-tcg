# Current status

**Build-order stage: 2 (Agent interface) — COMPLETE.**

Stage 1 (headless rules engine, including the owner-directed Magic-style
priority/reactivity redo) was already done. This session turned the
in-process `Agent`/`PlayerView` boundary into a real network protocol,
proved with an actual process-boundary round trip.

## What stands

The repo is now an npm workspace monorepo (root `package.json` +
`package-lock.json`) with four packages, kept deliberately separated at
clean seams per DESIGN.md:

- **`engine/`** (`@ai-tcg/engine`) — unchanged in game logic from the
  stage-1 redo, with three small additions to support stage 2:
  - `src/index.ts` — a public barrel export (card/state/engine/agent types,
    `runMatch`, `getLegalMoves`, `applyMove`, deck builders, `formatLog`,
    `Rng`), the actual dependency surface `@ai-tcg/server` and
    `@ai-tcg/protocol` consume, via a package.json `exports` field pointing
    straight at the TypeScript source (no build step; `tsx` transpiles
    on the fly, including through workspace `node_modules` symlinks).
  - `Agent.decideMove` may now return `Move | Promise<Move>`, and
    `runMatch` is `async` and awaits it. This is the one behavioural change
    to the engine itself: a real remote agent's move takes a real network
    round trip, so the loop that drives a match had to become awaitable.
    The two in-process dummy agents (`RandomAgent`, `AggressiveAgent`)
    needed no changes — returning a plain `Move` still satisfies the
    widened return type.
  - `runMatch` takes an optional `hooks.onMatchStart(state)` callback,
    fired once the initial state is fully set up but before the first move
    is requested — this is how `@ai-tcg/server` sends an accurate
    `matchStart` message without reconstructing state itself (which would
    risk drifting from what `runMatch` actually built).
- **`protocol/`** (`@ai-tcg/protocol`) — the actual stage-2 deliverable.
  `PROTOCOL.md` is the language-agnostic wire spec: WebSocket, JSON
  messages, the `hello` → `matchStart` → repeated `requestMove`/`move` →
  `matchEnd` flow, and a "Faults" section (timeout, illegal move,
  malformed JSON, disconnect → immediate forfeit). `src/messages.ts` is a
  TypeScript mirror of that spec for this project's own TS code — it
  re-exports `Move`/`PlayerView`/`PlayerId`/`StackItem`/`TargetRef`/
  `UnitInstance` from `@ai-tcg/engine` as `import type`/`export type` (
  erased at compile time, zero runtime dependency) rather than
  redeclaring them by hand, so the wire types can never silently drift
  from what the engine actually produces.
- **`server/`** (`@ai-tcg/server`) — a real WebSocket match server
  (`ws` package). `RemoteAgent` implements the engine's `Agent` interface
  by sending `requestMove` over a socket and awaiting a `move` reply, with
  a 15s timeout and validation that the reply is deep-equal to one of the
  offered `legalMoves` (structural comparison, not string comparison, so
  key order can't cause a false illegal-move fault). `cli.ts` pairs the
  first two agents that connect, assigns them fixed Cortex/Swarm test
  decks (deck selection isn't part of this protocol version — see
  PROTOCOL.md "Not yet covered"), and drives one real match through
  `@ai-tcg/engine`'s own `runMatch` — the server is not a reimplementation
  of the match loop, it's the same authoritative engine with `RemoteAgent`
  standing in for `Agent`.
- **`agents/`** (`@ai-tcg/agents`) — reference agent client processes,
  and the architecturally important package: it has **no dependency on
  `@ai-tcg/engine` at all**, at runtime or in `package.json`. It depends
  only on `@ai-tcg/protocol` (for wire types, erased at compile time) and
  `ws`. `randomAgentClient.ts` and `aggressiveAgentClient.ts` are runnable
  CLIs that connect to a server URL and play using decision logic ported
  from the engine's `RandomAgent`/`AggressiveAgent` — but reimplemented
  against `PlayerView`/`Move` only, exactly what a real external agent (in
  any language) receives over the wire. This is the actual proof that the
  protocol boundary is real, not assumed: swap the `decide` function in
  `client.ts` for a call to a model's API and this is a complete agent.

## Evidence committed

- `protocol/PROTOCOL.md` — the wire spec, written before the code (not
  reverse-documented after), including an honest "Not yet covered" section
  (matchmaking, reconnection, auth, spectators, 4-player — all real gaps,
  named rather than hidden).
- `progress/sample-match-003-networked.txt` — **new, this session's stage-2
  evidence.** A full real match (seed 48, 28 turns, 421 moves, resolves
  cleanly) played by two separate OS processes — `@ai-tcg/server` on one
  process, `Random-Client` and `Aggressive-Client` (both `@ai-tcg/agents`)
  each in their own process — communicating only over a WebSocket on
  `localhost:8080`, captured from all three processes' stdout. Turn 28
  (near the very end of the match) shows a genuine **cross-player,
  cross-turn instant-speed response actually crossing the process
  boundary**: Aggressive-Client (p2) declares an attack on its own turn,
  passes priority, and Random-Client (p1) — a separate OS process — is
  handed a real `requestMove` over the wire mid-opponent's-turn and casts
  an Instant (Interrupt Handler) plus several activated-ability repairs in
  response, exactly the reactive surface stage 1's redo built, now proven
  to survive a real network round trip. Turn 7 additionally shows the
  stack/priority algorithm firing correctly within a single player's own
  turn over the wire (an Instant cast in the extra priority window after
  declaring an attack, fizzling that same attack when its target dies).
- **Fault handling, live-tested, not just written:** two throwaway test
  clients (not committed — pure manual verification, described here for
  the record) confirmed both fault paths in `PROTOCOL.md`/`RemoteAgent`
  actually fire: (1) a client that replies to `requestMove` with a
  structurally-invalid move gets an `error` message and the match ends
  with the *other* client declared the winner; (2) a client that never
  replies is forfeited after exactly the documented 15s timeout, again
  with the other client declared winner and notified via `matchEnd` with
  a reason naming the timeout. Both were observed end-to-end from the
  server's log and both clients' received messages, not inferred from
  reading the code.
- All four packages (`engine`, `protocol`, `server`, `agents`) typecheck
  clean (`npx tsc --noEmit` in each). The engine's existing evidence
  (`effect-system-demo.txt`'s 12 scenarios, the in-process `cli.ts` match)
  was re-run after the `Agent`/`runMatch` async change and still passes
  identically — the protocol work did not regress stage 1.

## Concrete next step

Start build-order **stage 3: a real card set.** `PROTOCOL.md` and the
server/agent packages are now stable enough to build on; stage 3 doesn't
need further protocol work. Per `progress/owner-feedback.md`'s 2026-09-12
design-directive batch (still UNHANDLED as of this session — it wasn't
pulled forward, since it's explicitly scoped to stage 3+ and stage 8), the
next run doing stage 3 should read that batch *before* designing the card
schema additions: it specifies a unified board-development system (finite
face-up slots, telegraphed threats, evolution/tool cards), the signature
1-of-1 leader card, the onboarding grant, and the rarity ladder — all
stage-3/4/5 concerns that the card schema should be designed to support
rather than wall off. Open numeric parameters (slot counts, payouts, pull
rates, evolution strict-vs-loose) are explicitly left for that run to
*propose* at a checkpoint, not to invent unilaterally.

Do not start stage 4 (match server hardening for real matchmaking) or
stage 6 (spectator render) before stage 3 — see DESIGN.md's build order.
The `server/` package that exists now is deliberately minimal (one hosted
match, fixed decks, no matchmaking) — stage 4 is where it grows into a
real always-on service; that's later work, correctly out of scope here.
