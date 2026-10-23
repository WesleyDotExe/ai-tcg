# Current status

**Build-order stage: Stage 4+ (the living system). Session 56 (game lane): roadmap 2b step 3 done,
roadmap item 3 (the website's server endpoints) started. Nothing is blocking.** The owner's session-55
answer (keep) is noted. One small [OWNER CHECK-IN] in notes-for-owner.md (four calls on the deck
settings API, all defaults keep).

- **The owner API** (`server/src/ownerApi.ts`, spec `server/OWNER_API.md`, `npm run owner-api -w
  server -- <db file> [port]`): sign in/out; `GET /api/play`; `PUT` deck choice, faction lock, forced
  deck, an agent's play style; `POST`/`GET /api/play/rebuild` ("rebuild now" as a background job).
- **Rebuilds run on a worker thread** (`server/src/deckBuild/`), the engine's own `chooseDeck`, passed
  to the store's `buildAgentDeck` as its new optional `choose` argument. The server keeps answering
  during a build (demo: ~110 requests in a 22 s build, all under 20 ms).
- **Store fix:** the agent's deck picks copies at save time; a salvage during a build is refused with
  a reason instead of saving cards no longer held.

## What stands (this session's work; sessions 1-55 otherwise unchanged)

- Tests: +13 server tests (real HTTP), +2 economy tests. `npm test`: all six workspaces pass.
  Typecheck clean everywhere. Evidence: `progress/owner-api-demo-001.txt`.

## Concrete next step

Check the alternation first: if the last merged PR is this one (game lane), the next session is
**render** (Match Boot slice 2, sound and the phone, per the owner's 2026-10-23 entry).

The next **game-lane** session (session 57):
1. The owner's word on the session-56 check-in, if any (default: keep all 4).
2. Roadmap item 3 continued on the same server: wallet and collection endpoints (balance, ledger,
   copies, the binder), then packs and pack opening (buy, open one / ten, pity). Same pattern: rules
   in the store, tests through HTTP, a demo.
3. Small debt worth folding in: move the play-style ownership check into the store; a cap/queue on
   concurrent rebuild workers.
4. Before launch, not necessarily next: the test-only balance session (roadmap, "Standing: a
   test-only balance session before launch").

**Blocked:** nothing.
