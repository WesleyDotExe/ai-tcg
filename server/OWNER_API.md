# Owner API

The website's server endpoints (roadmap item 3; the owner's 2026-10-05 build order, step 3). Session 56 built the first part: signing in and the deck settings of Settings -> Play (roadmap 2b step 3). Session 63 added what the website's shell waits on (owner 2026-11-01): who am I, the account settings and the wallet. The collection, packs, matches, ladder, stats and the rest come in later sessions, on the same server.

- Code: `server/src/ownerApi.ts` (`startOwnerApi`); run it with `npm run owner-api -w server -- <season database file> [port]` (default port 8081).
- Every rule lives in the economy store (`economy/src/store.ts`). The API reads the request, checks the caller may touch what it names, calls the store and answers. It never writes SQL.
- Tests: `server/test/ownerApi.test.ts` and `server/test/ownerApiAccount.test.ts` (real HTTP against a real port). Evidence: `progress/owner-api-demo-001.txt` (deck settings), `progress/owner-api-demo-003-account.txt` (who am I, account settings, wallet; `npx tsx src/dev/accountApiDemo.ts` in `server/`).

## Requests and answers

- Bodies are JSON objects (at most 16 KB). Answers are JSON with `Cache-Control: no-store`.
- Signed-in requests send `Authorization: Bearer <token>`, the token from `POST /api/session`.
- Every refusal is `{ "error": "<message>" }` with one of these codes:

| Code | When |
|---|---|
| 400 | The body isn't a JSON object, or a field is missing, unknown or the wrong type, or a setting's value isn't allowed. |
| 401 | Not signed in (no token, unknown, expired or signed out), or a wrong login or password. |
| 404 | No such endpoint, or the deck or agent named isn't one of the caller's (another owner's reads as missing, so nothing about it leaks). |
| 405 | Wrong method for the endpoint (`Allow` lists the right ones). |
| 409 | The store refuses (for example a faction that can't be locked, forcing with no active deck, a rebuild while one runs or while a deck is forced). |
| 413 | The body is over 16 KB. |
| 429 | Too many failed sign-ins; the store's lockout window applies. |

## Endpoints

| Method and path | Body | Answer |
|---|---|---|
| `POST /api/session` | `{ login, password }` (username or email) | 201 `{ token, ownerId, expiresAt }` |
| `DELETE /api/session` | none | 204; the token stops working |
| `GET /api/me` | none | who am I (below) |
| `GET /api/account/settings` | none | the account settings (below) |
| `PATCH /api/account/settings` | any of the settings' fields (below); each of `sound` and `music` in part | the account settings, all of them |
| `GET /api/wallet` | none | the wallet (below) |
| `GET /api/play` | none | the play settings (below) |
| `PUT /api/play/deck-choice` | `{ choice: "agent" \| "forced" }` | the play settings |
| `PUT /api/play/faction-lock` | `{ faction: "Cortex" \| "Swarm" \| "Aegis" \| "Null" \| null }` | the play settings, plus `activeDeckFits` |
| `PUT /api/play/active-deck` | `{ deckId }` | the play settings; the deck choice becomes `forced` |
| `PUT /api/agents/:agentId/play-style` | `{ style }` (a play style id) | the play settings |
| `POST /api/play/rebuild` | none | 202 `{ job }`: the agent starts building its deck |
| `GET /api/play/rebuild` | none | `{ job }`, the owner's latest rebuild (404 if none) |

### Who am I

```
{
  ownerId,
  name,                       // the display name (the account's name, not the login)
  username: string | null,    // the login; null only for an owner with no login (house setup)
  email: string | null,
  kind: "player" | "house",
  isAdmin: boolean            // true: show Settings -> Admin
}
```

### The account settings

Saved on the owner's account (schema v15, `account_settings`), so every browser and every session reads the same. An owner who has never changed one reads the defaults, with `updatedAt: null`.

```
{
  theme: "system" | "light" | "dark",                         // default "system"
  background: "glacier" | "ocean" | "aurora" | "sunset" |
              "lavender" | "graphite" | "black" | "purple",   // default "glacier"; black and purple are the plain ones
  sound: { on: boolean, volume: 0..100 },                     // default { on: true, volume: 80 }
  music: { on: boolean, volume: 0..100 },                     // default { on: true, volume: 60 }
  skipHintSeen: boolean,      // default false; set true at the owner's first skip, then the hint isn't shown again
  updatedAt: string | null    // when a setting was last changed; null: never
}
```

- `PATCH` changes only the fields it names; `{ "music": { "volume": 25 } }` leaves music's `on` and every other setting as they were. An empty body changes nothing.
- Volumes are whole numbers from 0 to 100. An unknown field (at the top or inside `sound`/`music`), a theme or background not on the list, or a wrong type is refused with 400 and the reason, and nothing is saved (the patch is all or nothing).
- The lists are the website's (`render/reference/owner-web-mockup.html`; the owner's 2026-11-01 Season 0 spec). The background names are ids; the website shows "Glacier", "Plain black" and so on.

### The wallet

```
{
  credits: number,
  packPoints: number,
  unopenedPacks: [{ packId, ownerId, setCode, source, acquiredAt, openedAt: null }]   // oldest first
}
```

`source` is `"purchase" | "starter" | "weeklyChallenge" | "ownerDaily"`. The Open button's count is `unopenedPacks.length`; it opens the first one listed. Balances are the sums of the owner's ledger (never stored); the ledger itself comes with the collection endpoints.

### The play settings

```
{
  deckChoice: "agent" | "forced",
  factionLock: faction | null,
  lockableFactions: ["Cortex", "Swarm", "Aegis", "Null"],
  activeDeck: DeckStatus | null,          // the deck the connected agent plays
  agentDeck: (DeckStatus & { builtFrom: { style, factionLock } | null }) | null,
  rebuild: { reasons: string[], job: RebuildJob | null },
  connectedAgent: { agentId, name, playStyle } | null,
  agents: [{ agentId, name, playStyle }],
  playStyles: [{ id, name, summary }],
  decks: DeckStatus[],
  liveMatch: { matchId, startedAt } | null
}
```

`DeckStatus` is the store's: `{ deckId, name, ownerId, active, complete, missing, cards }`. `rebuild.reasons` is the store's `agentDeckRebuildReasons`: empty when the agent's deck is up to date or a deck is forced.

### Rebuild now

`POST /api/play/rebuild` answers at once with a job; the build runs in the background and the job is read with `GET /api/play/rebuild` (or in `GET /api/play`'s `rebuild.job`).

```
RebuildJob {
  jobId, state: "running" | "done" | "failed",
  startedAt, finishedAt,
  reasons,                                // why a rebuild was wanted when it started ([]: rebuilt anyway)
  result: { deckId, faction, style, cards,
            factions: [{ faction, winRate, infeasible }] } | null,
  error: string | null
}
```

- One build at a time per owner; refused while the owner forces a deck.
- The build is the store's `buildAgentDeck` at the store's settings (minutes of games). The server runs its games on a worker thread (`server/src/deckBuild/`), so every other request is still answered while it runs. The worker runs the engine's own `chooseDeck`, so it builds the same deck the engine would. At most one build per core but one runs at once (`workerChooser`'s `maxWorkers`, at least 1); further builds wait in line, first come first served, and their job reads `running` while they wait.
- If the owner's cards change while the agent builds (a salvage), the store refuses to save a list it can no longer fill, and the job fails with that reason; build again.

## Not built yet

- The other step-3 endpoints: the ledger and the collection, buying and opening packs, live and featured matches, ladder, tournament, stats, notifications, the saved board layout. (The background choice is in the account settings.)
- Creating an account and generating an agent over HTTP (the store has both; the endpoints come with the sign-up page).
- Jobs are kept in memory: a server restart forgets the latest job (the deck itself is saved).
- No HTTPS of its own (meant to sit behind the host's proxy), no CORS (the website is served from the same origin), no rate limit beyond the sign-in lockout.
