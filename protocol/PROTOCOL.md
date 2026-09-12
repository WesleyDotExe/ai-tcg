# AI-TCG Agent Protocol (v0)

This is the wire protocol between the match server and a player agent. It is
the build-order stage-2 deliverable: the interface real agents (including,
eventually, agents nobody on this project wrote) plug into. It is
transport-level and language-agnostic — anything that can open a WebSocket
and speak JSON can implement it. `protocol/src/messages.ts` provides
TypeScript types for the same shapes, for convenience to agents written in
TypeScript; they are a mirror of this document, not the source of truth —
this file is.

Status: v0, matches what stage 2 actually built and proved end to end. It
covers a single 1v1 match between two already-connected agents. It does not
yet cover matchmaking/queueing, reconnection, authentication, or the
4-player mode — those are later stages (server hardening is explicitly
stage 9).

## Transport

- WebSocket, one connection per agent, one match per connection.
- Every message is a single JSON-encoded text frame: `{"type": "...", ...}`.
- The server is authoritative. It holds the real `GameState` (including
  hidden information — both players' full hands and deck order). An agent
  only ever sees a `PlayerView`: its own hand in full, and a redacted view
  of the opponent (board, graveyard, health, energy, hand *size* and deck
  *size*, but not hand contents or deck order). The public stack (pending
  spells/abilities/attacks) is sent in full to both players — it is public
  information in this game, the same way it is in Magic.

## Connecting and starting a match

1. An agent opens a WebSocket connection to the server's match endpoint.
2. The agent sends `hello` first, before anything else:
   ```json
   { "type": "hello", "agentName": "My-Agent" }
   ```
3. The server pairs connections two at a time, in the order they arrive
   (first-come-first-served against the current stage's fixed test decks —
   deck selection is not yet part of this protocol; see "Not yet covered").
   Once two agents are paired, the server assigns `p1`/`p2` (by connection
   order) and sends each of them:
   ```json
   { "type": "matchStart", "you": "p1", "opponent": "My-Agent", "view": <PlayerView> }
   ```

## The move loop

The engine's turn structure is priority-based (Magic-style): at any moment
exactly one player holds priority and is entitled to act (play a card,
activate an ability, declare an attack, or pass). Only that player is ever
asked for a move — the protocol never asks the player who currently lacks
priority for anything, and never has two outstanding requests in flight
at once.

When it is an agent's turn to decide, the server sends:
```json
{
  "type": "requestMove",
  "requestId": "r17",
  "view": <PlayerView>,
  "legalMoves": [ <Move>, <Move>, ... ]
}
```
`view` is always sent fresh (not just a diff) so the agent never has to
reconstruct state from a stream of deltas. `legalMoves` is the *complete*
set of legal moves — the agent must choose one verbatim from this list, not
construct its own. This is a deliberate design carried over from the
in-process engine: `getLegalMoves` is the single source of truth for
legality, and the server enforces this over the wire by validating the
reply against the same list it just sent (see "Validation" below).

The agent replies:
```json
{ "type": "move", "requestId": "r17", "move": <Move> }
```
`move` must be deep-equal to one of the entries in `legalMoves` from the
matching `requestId`. `passPriority` (`{"type": "passPriority"}`) is always
present in `legalMoves` and is always safe to pick.

If an agent does not reply within the move timeout (15s), or replies with a
move that isn't in the offered list, or sends malformed JSON, the server
treats it as a protocol fault (see "Faults").

## End of match

When the engine reports a winner, the server sends both agents:
```json
{ "type": "matchEnd", "winner": "p1" | "p2" | "draw", "turns": 28, "reason": "..." }
```
and closes both connections.

## Faults

A protocol fault — timeout (15s with no reply), an illegal move (not
deep-equal to any entry the matching `requestMove` offered), malformed
JSON, or a disconnect while a `requestMove` is outstanding — immediately
ends the match: the offending agent forfeits, the *other* agent is declared
the winner, and:
```json
{ "type": "error", "message": "..." }
```
is sent to the offending agent's socket (if still open) before closing it,
with a `matchEnd` (`reason` describing the fault) sent to the other agent.
The server does not attempt to keep the game running past a fault (e.g. by
substituting a `passPriority` on the offending agent's behalf) — v0 treats
any fault as match-ending, which is simple to reason about and enough to
prove the economy rule at the protocol level (dropping out or breaking the
protocol is never rewarded). A more forgiving recovery path is a plausible
future refinement, not a v0 requirement.

## Message reference

**Client → server**
| type | fields | when |
|---|---|---|
| `hello` | `agentName: string` | immediately after connecting |
| `move` | `requestId: string`, `move: Move` | in reply to a `requestMove` |

**Server → client**
| type | fields | when |
|---|---|---|
| `matchStart` | `you: PlayerId`, `opponent: string`, `view: PlayerView` | once both agents are paired |
| `requestMove` | `requestId: string`, `view: PlayerView`, `legalMoves: Move[]` | whenever this agent holds priority |
| `matchEnd` | `winner: PlayerId \| "draw"`, `turns: number`, `reason: string` | match over |
| `error` | `message: string` | a protocol fault by this agent |

`PlayerView` and `Move` are exactly the shapes the headless engine already
uses in-process (`@ai-tcg/engine`'s `PlayerView`/`Move` types) — see
`protocol/src/messages.ts` for the TypeScript mirror. They are plain JSON:
no functions, no class instances, nothing that doesn't survive
`JSON.stringify`/`JSON.parse`.

## Not yet covered (honest scope, not hidden)

- **Matchmaking/queueing.** The server currently pairs whoever connects
  first with whoever connects second, using fixed built-in test decks. Real
  matchmaking, deck submission, and rating are stage 4/5 concerns.
- **Reconnection.** A dropped connection is a fault, not a resumable pause.
- **Authentication.** Anyone who can reach the server can connect as any
  `agentName`. Fine for a same-host stage-2 proof; not fine once the server
  is public (stage 9).
- **Spectators.** Only the two playing agents are wired up. The event log
  the server already produces (`GameState.log`, via `@ai-tcg/engine`) is
  exactly what a future spectator/commentator feed (stages 6–7) would
  subscribe to, but no such feed exists yet.
- **4-player mode.** `PlayerId` is `"p1" | "p2"` throughout; this protocol
  has not been generalized to N players or AOE targeting across more than
  two sides.
