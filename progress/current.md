# Current status

**Build-order stage: 3 (A real card set) — still current.** Session 9. One
unhandled `progress/owner-feedback.md` entry existed (2026-09-17, the
Aegis-vs-Null fix direction), but it explicitly instructs "do this when the
item 3 balance pass comes up, not before item 2" — so it was read, annotated
in owner-feedback.md as intentionally deferred (not marked handled), and
`progress/roadmap.md` item 2 was worked instead: the highest unfinished,
unblocked roadmap item once that entry's own instruction is honoured. No
CRITICAL quality-debt item was outstanding.

## What stands (changes from this session; everything from sessions 1-8
## otherwise unchanged — see prior `progress/log.md` entries for that)

Roadmap item 2 — non-engine test coverage — is done. `server`, `protocol`,
and `agents` had zero automated tests since session 3 (named as debt across
five sessions running); all three now have real vitest suites, and `npm
test` at the repo root runs all four packages' suites (`npm run test
--workspaces --if-present`, changed from the old engine-only script).

- **`protocol/test/messages.test.ts`** (7 tests) — `isClientMessage` is the
  only runtime logic this package has (everything else is types, erased at
  compile time); tests cover valid hello/move, a server-only message type
  sent by a client, unrecognized types, missing `type`, non-object values,
  and the empty-object case a JSON parse of garbage input can produce.
- **`server/test/deepEqual.test.ts`** (7 tests) — the pure structural-equality
  function `RemoteAgent` uses to match a client's reply against the
  `legalMoves` it sent: primitives, key-order independence, mismatches at
  depth, missing/extra keys, arrays vs. objects, null vs. `{}`.
- **`server/test/remoteAgent.test.ts`** (12 tests) — drives the real
  `RemoteAgent` class against a minimal fake socket (an `EventEmitter`
  exposing just the `on`/`send`/`close`/`readyState`/`OPEN` subset it
  actually uses), covering every fault path named in `PROTOCOL.md`'s
  "Faults" section: illegal move, malformed JSON, an unrecognized message
  type, a stale `requestId` being ignored (not faulted) while the real reply
  still resolves, a late `hello` being ignored, closing the socket while a
  move is outstanding, calling `decideMove` while one is already pending
  (throws synchronously — an engine/server bug, not a client fault), and a
  reply timeout. Required one small, real (not test-only-hack) source
  change: `RemoteAgent`'s constructor now takes an optional `{ timeoutMs }`
  — production code (`server.ts`) never passes it, so the real 15s default
  is unchanged; tests use a few milliseconds so the timeout-fault test
  doesn't slow the suite down.
- **`server/test/integration.test.ts`** (4 tests) — the actual gap named
  since stage 2 (`quality-debt.md`: "no automated protocol test... should
  graduate to a real committed test"). Real `ws` WebSocket connections, the
  real `@ai-tcg/agents` reference clients (`runAgentClient` +
  `makeRandomDecision`), and the real server — no process spawning, but no
  mocking of the protocol boundary either. Covers: a full match resolving
  end-to-end between two independent client instances; `port: 0` (OS-assigned
  port) actually being reachable; a client that always replies with an
  illegal move getting forfeited over a real socket round trip (not just the
  fake-socket path `remoteAgent.test.ts` already covers); and a third
  connecting socket being closed rather than queued, since this server hosts
  exactly one match.
- **`agents/test/rng.test.ts`** (6 tests), **`randomDecision.test.ts`**
  (4 tests), **`aggressiveDecision.test.ts`** (7 tests) — the reference
  client-side decision policies, tested against `@ai-tcg/protocol`-typed
  fixtures built by hand (exactly what a real remote agent receives over the
  wire): seed determinism, always choosing from the supplied legal-move list,
  biggest-affordable-card / face-over-unit / lowest-health-target heuristics,
  and the one genuine reactive rule (saving a unit from a pending lethal
  combat hit outside the main phase).

**Two small, deliberate refactors, both behaviour-preserving, made purely to
enable this testing (not scope creep — without them the protocol layer
stays structurally untestable):**
- `server/src/cli.ts` was a top-level script with side effects at import
  (binds a port from `process.argv` the moment it's loaded) — impossible to
  drive from a test. Split into `server/src/server.ts` (the actual server
  logic, now an exported `startServer(options)` returning a `RunningServer`
  with a `matchEnded: Promise<MatchOutcome>` and the actually-bound `port`)
  and a thin `cli.ts` that just parses argv and calls it. Re-verified this
  didn't regress the real, process-spawned path (not just trusting the
  refactor): ran the actual `cli.ts` as a subprocess against two separate
  `tsx` agent-client processes over real localhost sockets — resolved
  cleanly (p2 wins, 102 moves, 12 turns), log file written correctly. Not
  committed as new sample-match evidence (sample-match-003-networked.txt
  already establishes this path; this was a regression check, not a new
  milestone) — just confirmed and cleaned up.
- `agents/` gained a barrel (`agents/src/index.ts`, plus `main`/`exports` in
  its `package.json`, mirroring `engine/`'s and `protocol/`'s existing
  pattern) so `server/`'s integration tests can import `@ai-tcg/agents`'
  real reference client instead of hand-rolling a duplicate one just for
  tests. `agents/`'s zero-*runtime*-dependency-on-`@ai-tcg/engine` guarantee
  is untouched — this only makes the package's own client/decision code
  importable, it doesn't add a new dependency.
- `protocol/src/messages.ts` now also re-exports `Card`/`UnitCard` from
  `@ai-tcg/engine` (type-only, erased at compile time, same pattern as the
  existing `Move`/`PlayerView`/etc. re-exports) — needed so
  `agents/test/aggressiveDecision.test.ts` can build realistic `UnitCard`
  fixtures without `agents/` taking a real dependency on `@ai-tcg/engine`.

## Evidence committed

- `npm test` (root, all four workspaces): **81/81 tests pass** (34 engine +
  7 protocol + 23 server + 17 agents), ~1.8s total.
- `npx tsc --noEmit` clean in all four packages (test files are excluded
  from each package's `tsconfig.json` `include: ["src"]`, matching the
  pre-existing `engine/test/` convention — vitest transforms them, `tsc`
  doesn't type-check them).
- Ran the server's suite three times in a row to check for flakiness in the
  real-socket integration tests (timing-sensitive by nature) — 23/23 passed
  identically each time.
- The manual `cli.ts`-as-subprocess regression check described above (not a
  new committed sample-match file; a targeted re-verification of the
  refactor, output inspected and discarded).

## Decisions made this session the owner might want to overrule

- **Left the 2026-09-17 owner-feedback entry (Aegis-vs-Null fix direction)
  formally unhandled**, per its own explicit "do this when item 3 comes up,
  not before item 2" instruction — annotated in `owner-feedback.md` as read
  and intentionally deferred, not marked done, so a future session doesn't
  mistake it for already-applied. If the owner actually meant "do this
  next regardless of the stated order," that reading was not taken; say so
  in `owner-feedback.md` if so.
- **`RemoteAgent` gained a constructor option (`timeoutMs`) purely for
  testability.** Production behaviour is unchanged (server.ts never passes
  it, so the real 15s timeout still applies) — flagging the API surface
  change itself as a small, deliberate one, not something the owner asked
  for.
- **`startServer`'s `MatchOutcome` type is new API surface** (`resolved` /
  `fault` / `error` union) that `cli.ts` doesn't consume (it just awaits the
  promise and lets the process exit) — added because the integration tests
  need to assert on the match result without scraping console output, but
  it's a reasonable foundation for stage 4 (match server hardening) to build
  on rather than a one-off test hook.

## Concrete next step

Per `progress/roadmap.md`, item 3 (balance pass across all four factions) is
next, starting with Aegis-vs-Null specifically per the owner's 2026-09-17
feedback: add a condition to Kernel Panic's `destroy` (own units below a
set attack/health threshold, or non-evolved units only, or destroy-for-small
plus damage-for-large — pick one, explain why, propose numbers at a
checkpoint), keep "ignores Barrier/stat buffs" as-is, measure before/after
with `balanceReport.ts`, and only touch Null's own numbers as a second step
if the pairing is still flagged after that. Mark the owner-feedback entry
handled once that's actually done and measured, not before.
