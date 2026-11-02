# Owner API

The website's server endpoints (roadmap item 3; the owner's 2026-10-05 build order, step 3). Session 56 built the first part: signing in and the deck settings of Settings -> Play (roadmap 2b step 3). Session 63 added what the website's shell waits on (owner 2026-11-01): who am I, the account settings and the wallet. Session 64 added the saved Home board and the economy endpoints (owner 2026-11-01): the collection and binder, salvage and crafting, the ledger, buying and opening packs, the store, cosmetics and loadouts, and today's earnings. Session 66 added the ladder and the rating. Session 67 added the match pages: Watch live (from the long-lived ladder), match history with each match's log and replay, and the auto-play switch. Stats and notifications come in later sessions, on the same server.

- Code: `server/src/ownerApi.ts` (`startOwnerApi`); run it with `npm run owner-api -w server -- <season database file> [port]` (default port 8081).
- Every rule lives in the economy store (`economy/src/store.ts`). The API reads the request, checks the caller may touch what it names, calls the store and answers. It never writes SQL.
- Tests: `server/test/ownerApi.test.ts`, `server/test/ownerApiAccount.test.ts` and `server/test/ownerApiEconomy.test.ts` (real HTTP against a real port). Evidence: `progress/owner-api-demo-001.txt` (deck settings), `progress/owner-api-demo-003-account.txt` (who am I, account settings, wallet; `npx tsx src/dev/accountApiDemo.ts` in `server/`), `progress/owner-api-demo-004-economy.txt` (the board and the economy endpoints; `npx tsx src/dev/economyApiDemo.ts`).

## Requests and answers

- Bodies are JSON objects (at most 16 KB). Answers are JSON with `Cache-Control: no-store`.
- Signed-in requests send `Authorization: Bearer <token>`, the token from `POST /api/session`.
- Every refusal is `{ "error": "<message>" }` with one of these codes:

| Code | When |
|---|---|
| 400 | The body isn't a JSON object, or a field is missing, unknown or the wrong type, or a setting's or a board's value isn't allowed, or a query parameter (`limit`, `quantity`...) isn't a whole number in range. |
| 401 | Not signed in (no token, unknown, expired or signed out), or a wrong login or password. |
| 404 | No such endpoint; the deck, agent, pack or opening named isn't one of the caller's (another owner's reads as missing, so nothing about it leaks); or the card, set, secret card, cosmetic or loadout slot named doesn't exist. |
| 405 | Wrong method for the endpoint (`Allow` lists the right ones). |
| 409 | The store refuses (for example a faction that can't be locked, forcing with no active deck, a rebuild while one runs or while a deck is forced, too few credits or pack points, a cosmetic already owned, a loadout change during a live match). A salvage that would leave saved decks short is 409 with `needsConfirmation: true` and `affectedDecks` (below). |
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
| `GET /api/board` | none | the Home board (below) |
| `PUT /api/board` | `{ widgets: [{ id, type, size }] }`, the whole board in order | the Home board |
| `GET /api/daily` | none | today's earnings (below) |
| `GET /api/ladder?limit=100` | none | the ladder: `{ standings, you, owners, tiers, placementMatches }` (below) |
| `GET /api/rating?recent=10` | none | `{ rating, recent }`: the owner's Glicko-2 rating and its last rated matches (below) |
| `GET /api/ledger?limit=50&before=<entryId>` | none | `{ entries, more, wallet }`: ledger entries newest first, a page at a time (below) |
| `GET /api/collection?recentPacks=3` | none | the collection (below) |
| `GET /api/collection/binder/:setCode` | none | the set's binder (below) |
| `GET /api/collection/cards/:cardId` | none | the card viewer's holdings (below) |
| `GET /api/collection/cards/:cardId/salvage?quantity=N` | none | what salvaging N would do, without doing it |
| `POST /api/collection/cards/:cardId/salvage` | `{ quantity, confirmDeckImpact?: boolean }` | `{ copies, packPoints, incompleteDecks, holdings, wallet }` |
| `POST /api/collection/cards/:cardId/craft` | none | 201 `{ copy, holdings, wallet }` |
| `POST /api/collection/secrets/:code/craft` | none | 201 `{ copy, wallet }` |
| `GET /api/packs` | none | the packs page (below) |
| `POST /api/packs/buy` | `{ setCode, count?: 1..10 }` (count 1 by default) | 201 `{ bought: PackRecord[], wallet }` |
| `POST /api/packs/open` | `{ count?: 1 \| 10 }` or `{ packId }` | `{ packs: PackOpening[], summary, wallet }` (below) |
| `GET /api/packs/:packId/opening` | none | the logged opening, seed and all (the caller's packs only) |
| `GET /api/packs/daily` | none | the owner's daily pack: how many wait, when the next comes in (below) |
| `POST /api/packs/daily/claim` | none | 201 `{ pack: PackRecord, dailyPack, wallet }`; 409 when none waits |
| `GET /api/store` | none | `{ packs, dailyPack, cosmetics, wallet }`: what's on sale |
| `POST /api/store/cosmetics/:itemId/buy` | none | 201 `{ cosmetic, wallet }` |
| `GET /api/cosmetics` | none | `{ owned: OwnedCosmetic[] }` |
| `GET /api/agents/:agentId/loadout` | none | the agent's loadout (below) |
| `PUT /api/agents/:agentId/loadout/:slot` | `{ itemId }` (an item id, or null to empty the slot) | the agent's loadout |
| `GET /api/play` | none | the play settings (below) |
| `PUT /api/play/deck-choice` | `{ choice: "agent" \| "forced" }` | the play settings |
| `PUT /api/play/faction-lock` | `{ faction: "Cortex" \| "Swarm" \| "Aegis" \| "Null" \| null }` | the play settings, plus `activeDeckFits` |
| `PUT /api/play/active-deck` | `{ deckId }` | the play settings; the deck choice becomes `forced` |
| `PUT /api/agents/:agentId/play-style` | `{ style }` (a play style id) | the play settings |
| `POST /api/play/rebuild` | none | 202 `{ job }`: the agent starts building its deck |
| `GET /api/play/rebuild` | none | `{ job }`, the owner's latest rebuild (404 if none) |
| `PUT /api/play/auto-play` | `{ on: boolean }` | `{ autoPlay }` (below); 409 for a house owner, or turning it on while today's rewards are maxed |
| `GET /api/live` | none | `{ running, matches: LiveMatchView[], mine }`: every match being shown, and the caller's (below) |
| `GET /api/live/:matchId?from=0` | none | `LiveMatchFeed`: the match now, and the moves released from `from` on (below); 404 once it ended |
| `GET /api/matches?limit=20&before=<matchId>` | none | `{ matches: HistoryRow[], total, more }`: the caller's matches, newest first (below) |
| `GET /api/matches/:matchId` | none | `MatchView`: one recorded match, any owner's (below) |
| `GET /api/matches/:matchId/log` | none | the match log, as text (`text/plain`) |
| `GET /api/matches/:matchId/replay` | none | the replay file, `ai-tcg-replay/1` (below) |

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

`source` is `"purchase" | "starter" | "weeklyChallenge" | "ownerDaily"`. The Open button's count is `unopenedPacks.length`; it opens the first one listed. Balances are the sums of the owner's ledger (never stored); the ledger itself is `GET /api/ledger` (below).

### The Home board

Saved on the owner's account (schema v16, `board_layouts`). An owner who has never saved a board reads the recommended layout with `recommended: true`.

```
{
  widgets: [{ id, type, size }],   // in board order: the 12-column grid fills left to right, top to bottom
  recommended: boolean,            // true: never saved, this is the recommended layout
  updatedAt: string | null,
  rules: {
    widgetTypes: [{ type, limit }],   // the 12 Season 0 widgets; limit 1 each, "watch" 2
    sizes: ["S", "M", "L"],
    maxWidgets: 13,
    recommendedWidgets: [{ id, type, size }]
  }
}
```

- Types (the mockup's ids): `agent` (My agent), `live` (Live match), `watch` (Watch live), `packs`, `daily` (Daily rewards), `collection`, `showcase`, `ladder`, `form` (Rating & form), `history` (Match history), `notif` (Notifications), `store`. `tournament` and `feed` are refused: they come after Season 0.
- `PUT` saves the whole board (Customise mode's Done). An empty list saves an empty board (the page shows its empty state); sending `rules.recommendedWidgets` is "Recommended layout". The page owns the ids (1 to 32 of `A-Z a-z 0-9 - _`, unique on the board).
- Refused with 400 and the reason, nothing saved: an unknown field, a type not on the list, a size not S/M/L, a repeated id, more of a widget than its limit, more than 13 widgets.
- The recommended layout is the mockup's with its Tournament slot (Small) given to Store: agent M, live M, packs M, daily S, store S, watch M, collection M, ladder M, form M.
- The background is in the account settings (`PATCH /api/account/settings`), not here.

### Today's earnings

The Daily rewards widget. The day runs from midnight to midnight Sydney time (`Australia/Sydney`, following daylight saving; owner 2026-11-01), the same day `recordMatch` pays the win schedule by.

```
{
  day: "2026-11-01",                 // the date on the Sydney clock
  timeZone: "Australia/Sydney",
  startedAt, resetsAt,               // UTC ISO; resetsAt is the next midnight in Sydney
  schedule: [{ fromWin, toWin, credits }],   // 1: 30; 2-4: 10; 5-10: 5; 11 and after (toWin null): 0
  wins: [{ nth, matchId, endedAt, credits }],   // every win today, oldest first
  rewardedWins: [...],               // the wins that paid something: what the widget lists
  losses, maxPaidLosses,             // losses and draws today; losses stop paying after maxPaidLosses
  creditsFromWins, creditsFromLosses, credits,
  nextWinPays, nextLossPays
}
```

Read from match history (cancelled and abandoned matches pay nothing and count for neither). The daily quests and the weekly challenge aren't in Season 0, so they aren't here.

### The ladder and the rating (session 66)

The Ladder widget and page, and the Rating & form widget. Ratings are Glicko-2, per owner (the connected agent plays at its owner's rating), written by the store in the same transaction as the match and its payouts. A win, a draw or an abandon is rated (an abandon is a loss for the side that walked out); a cancel isn't. An owner starts at rating 1500, RD 350, volatility 0.06; its RD grows once for each whole Sydney day it has no rated match.

`GET /api/ladder` (`limit` 1-100, default 100: the public top-100 list):

```
{
  standings: [LadderRow],      // best first: placed owners ranked 1, 2, ..., then owners still in placement (rank null)
  you: LadderRow,              // the caller's own row, on the list or not; at the start (rating 1500, rank null) before a rated match
  owners: 12,                  // owners with a rated match (the list's full length)
  tiers: [{ tier: "Bronze", from: null }, { tier: "Silver", from: 1350 }, { tier: "Gold", from: 1500 },
          { tier: "Platinum", from: 1650 }, { tier: "Diamond", from: 1800 }, { tier: "Mythic", from: 1950 }],
  placementMatches: 5          // rated matches before a tier shows and the owner is ranked
}
LadderRow = {
  rank,                        // 1-based among placed owners; null in placement
  ownerId, ownerName, ownerKind: "player" | "house",
  agent: { agentId, name } | null,   // the connected agent
  rating, rd,                  // unrounded; show rating as a whole number, RD as "±RD"
  tier,                        // "Placement" until placementMatches rated matches, then a tier name
  ratedMatches, wins, losses, draws,
  lastDay                      // the Sydney date of the last rated match ("2026-11-04")
}
```

`GET /api/rating` (`recent` 1-100, default 10):

```
{
  rating: { ownerId, rating, rd, volatility, ratedMatches, tier, lastDay },
  recent: [{ matchId, endedAt, opponentOwnerId, ownerId, score: 1 | 0.5 | 0,
             before: { rating, rd, volatility }, after: { rating, rd, volatility } }]   // newest first
}
```

The tiers, the placement count and the matchmaker are session 66's proposals, at an owner check-in in `progress/notes-for-owner.md`.

### The ledger

`GET /api/ledger` answers the owner's ledger entries newest first, `limit` at a time (default 50, at most 500); `more` is true when older entries exist; the next page is `?before=<the last entryId shown>`. Each entry is `{ entryId, ownerId, playedBy, currency: "credits" | "packPoints", delta, reason, ref, createdAt }`. Reasons: `matchWin`, `matchLoss`, `matchDraw` (ref: the match, playedBy: the agent), `packPurchase`, `packOpened` (ref: the pack), `salvage`, `craft`, `craftSecret` (ref: the copy), `cosmeticPurchase` (ref: the item), `agentRename`, and the starter grant's.

### The collection

```
{
  copies, distinctCards,
  cards: [{ cardId, name, rarity, faction, owned, salvageable,
            copies: [{ copyId, cardId, finish, seriesKind, seriesCode, serial, runSize, stamp,
                       origin, originRef, accountBound, acquiredAt, secretCode }] }],   // by name
  sets: [{ setCode, base: { held, total }, secrets: {...}, glitch: {...}, gold: {...},
           prototypes: { runsHeld, runs, copiesHeld } }],
  recentPulls: [{ packId, setCode, openedAt, jackpot,
                  cards: [{ copyId, cardId, name, rarity, finish, secretCode, serial, held }] }]   // newest first
}
```

- Every copy is its own item (origin `pack`, `starter`, `crafted`, `promo`, ...; `accountBound` copies play but never sell or salvage). A secret copy's `secretCode` names the secret card it is; its `cardId` is the card it plays as.
- `recentPacks` (1 to 50, default 3) is how many openings `recentPulls` lists; a pulled copy since salvaged shows `held: false`.
- `GET /api/collection/binder/:setCode` is the store's binder: `{ setCode, base, secrets, glitch, gold, prototypes }`, each section `{ title, held, total, entries: [{ number, kind, cardId, secretCode, name, rarity, owned }] }`, and the Prototype runs with the serials held.
- `GET /api/collection/cards/:cardId` is the card viewer: `{ cardId, rarity, owned, salvageable, packPointsEach, notSalvageable: [{ reason, count }], decks: [{ deckId, name, uses, active }] }`.

### Salvage and crafting

- Salvage is the owner's own choice, never automatic: read the plan first (`GET .../salvage?quantity=N`: `{ cardId, quantity, copies, packPoints, ownedAfter, affectedDecks }`), then `POST` it. Only unbound standard-finish pack copies salvage (Common 5, Uncommon 10, Rare 30, Mythic 100 pack points each); copies no deck lists go first.
- If it would leave saved decks using more copies than the owner would hold, the `POST` answers 409 `{ error, needsConfirmation: true, affectedDecks: [{ deckId, name, uses, owned, active }] }` and salvages nothing; send it again with `confirmDeckImpact: true` to go ahead (those decks are then incomplete until fixed; no deck is edited).
- Crafting makes one standard copy of a set card for pack points (Common 40, Uncommon 80, Rare 250, Mythic 800), refused at the card's playable limit; a secret card costs 750 (illustration) or 3,000 (Zero-Day), refused while the owner holds it. Crafted copies are account-bound.

### Packs

`GET /api/packs`:

```
{
  offer: [{ setCode, name, priceCredits }],   // Season 0: S0 at 100 credits
  bulkOpenCount: 10,
  unopened: PackRecord[],                     // oldest first
  pity: { packsSinceFullArt, packsSinceMythic, next: { fullArt, mythic } },
  dailyPack: DailyPackStatus,                 // the same as GET /api/packs/daily
  wallet
}
```

- `POST /api/packs/buy` buys `count` packs (1 to 10) in one go, all or none: 409 with the price and the balance when the credits don't cover them all.
- `POST /api/packs/open` opens the oldest pack (`{}` or `{ count: 1 }`), the ten oldest (`{ count: 10 }`; 409 unless ten are waiting), or a chosen one (`{ packId }`; 404 if it isn't one of the caller's unopened packs). The answer is `{ packs, summary, wallet }`: `packs` is one `PackOpening` per pack, `summary` is the ten-pack summary (null for one pack).
- `PackOpening` is the store's: `{ packId, ownerId, setCode, oddsVersion, seed, openedAt, jackpot, pity: { fullArt, mythic }, prototypeFallbackGold, starterHit, packPoints, fullReveal, cards: [{ copyId, cardId, name, rarity, slot, finish, collectorNumber, prototype, secret, isNew, ownedAfter }] }`. `isNew` is the NEW badge, `ownedAfter` the "x N owned", `fullReveal` says the pack keeps its full reveal in a ten-pack open. Every pack also pays 5 pack points.
- The summary: `{ cards, newCards, packPoints, byRarity, byFinish, fullReveals: [packId] }`.
- Each pack's seed is drawn by the server when it opens and is shown only after (`GET /api/packs/:packId/opening` reads the logged opening back).

### The owner's daily pack (session 65)

The rule is the owner's (2026-10-04): one free pack a day that only the owner can claim, stacking up to 2. The day is the store's reset day, midnight to midnight Sydney.

`GET /api/packs/daily` (also sent as `dailyPack` with `GET /api/packs` and `GET /api/store`):

```
{
  setCode: "S0",            // a claim gives a pack of the current season's set
  waiting: 0 | 1 | 2,       // packs to claim now
  cap: 2,
  day: "2026-11-02", timeZone: "Australia/Sydney",
  resetsAt: ISO,            // when today ends
  nextPackAt: ISO | null,   // when the next one comes in: resetsAt, or null while 2 wait (nothing comes in until one is claimed)
  claimedToday: number,
  lastClaimedAt: ISO | null
}
```

- One pack comes in at the start of every Sydney day, the owner's first day included, unless 2 are already waiting.
- `POST /api/packs/daily/claim` adds one pack (source `ownerDaily`) to the owner's unopened packs; it opens like any other (`POST /api/packs/open`). With none waiting it is 409: `no daily pack to claim; the next one comes in at <resetsAt>`.
- Nothing extra is stored: the store works the bank out from the owner's `ownerDaily` packs and the day the owner was created (`economy/src/dailyPack.ts`), so it survives restarts and can't drift from the packs it paid out.
- Per owner, not per agent: making agents gives no more daily packs. Agents can't claim (they don't sign in to this API).

### The store and cosmetics

- `GET /api/store`: `{ packs: <the pack offer>, dailyPack, cosmetics: [CosmeticItem & { owned }], wallet }`. Cosmetics listed are those on sale now (this season, inside their sale window, drawn by the render lane); Season 0 sells two boasts at 300 credits.
- `POST /api/store/cosmetics/:itemId/buy` pays credits and grants the item together, or refuses (409): not on sale, already owned, too few credits.
- `GET /api/cosmetics`: every item the owner owns (`{ ownerId, itemId, kind, source: "starter" | "purchase", ledgerEntryId, acquiredAt, item }`), the four starter boasts included.

### The loadout

```
{
  agentId,
  loadout: { boast, closeWinBoast, cardBack, avatar, arena },   // item ids or null
  slots: [{ slot, kind, itemId, choices: [itemId] }],          // the owned items that fit each slot
  locked: boolean                                              // true during a live match: changes are refused
}
```

`PUT /api/agents/:agentId/loadout/:slot` with `{ itemId }` equips an owned item of the slot's kind, or empties the slot with `null`. Refused: another owner's agent (404), a slot that doesn't exist (404), an item of the wrong kind or not owned (409), any change during a live match (409).

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

### Auto-play (session 67)

The switch on the My agent card, the match screen and Settings -> Play (owner app spec 2026-10-05 E). `GET /api/play` carries it as `autoPlay`, and `PUT /api/play/auto-play` answers `{ autoPlay }`:

```
{
  on: boolean,
  changedAt: string | null,      // when the switch last changed
  stopped: { reason: "dailyRewardsMaxed", day: "2026-11-02" } | null,   // the server turned it off today: show the message
  dailyRewardsMaxed: boolean,    // the next win would pay nothing today
  canTurnOn: boolean,            // false while maxed: the owner turns it on again another day
  house: boolean                 // a house owner: always plays, no switch
}
```

- While it is on, the ladder queues the owner's connected agent every round. House owners are always queued.
- The server turns it off after the match that maxes the day's rewards (the 10th rewarded win), with the reason; the message shows until midnight Sydney.
- Turning it off lets a match already live finish; the owner is just not queued for the next round.

### Watch live and the Live match widget (session 67)

Matches are played by the long-lived ladder (`npm run season`; ECONOMY.md "Match running and the ladder"): the engine plays each match at once, then the server releases it a move at a time at watch speed, and records it (credits, ratings, history) only once the last move has been shown. So a live match's result is nowhere until the viewers see it.

`GET /api/live`: `{ running, matches, mine }`. `running` is false when the server runs without the ladder; `mine` is the caller's live match id or null.

```
LiveMatchView {
  matchId, startedAt,
  released,                      // moves released so far
  nextAt: string | null,         // when the next move comes out (null: the last is out, the result holds, then it is recorded)
  p1: LiveSideView, p2: LiveSideView,
  now: PublicSnapshot,           // the board after the last released move
  recentLines: string[]          // the last 6 log lines released, oldest first
}
LiveSideView { ownerId, ownerName, agentId, agentName, playStyle, rating, tier }   // as the match started
PublicSnapshot {
  turn, activePlayer: "p1" | "p2", priority: "p1" | "p2", stack: number,
  winner: "p1" | "p2" | "draw" | null,
  p1: PublicSide, p2: PublicSide
}
PublicSide {
  name, health, maxHealth, energy, maxEnergy,
  hand, deck, graveyard,         // counts only: no hand or deck contents
  board: [{ instanceId, cardId, name, attack, health, maxHealth, pending, tools: string[] }],
  directives: [{ instanceId, cardId, name }],
  signature: { name, played } | null
}
```

`GET /api/live/:matchId?from=N` is the feed for the match page: `LiveMatchView` plus `{ from, steps, start, startLines }`. Fetch with `from=0` first (that answer also has `start`, the board before the first move, and `startLines`, the opening draws), then with `from=<released>` each time to get only what is new; `from` past `released` is treated as `released`. Each step:

```
TimelineStep {
  n,                             // 1 for the first move
  by: "p1" | "p2",
  move: Move,                    // the engine's move
  events: GameEvent[],           // the engine's own events this move caused (with instance ids, for the animations)
  lines: string[],               // the same events as the log prints them
  after: PublicSnapshot
}
```

Once the match has been recorded the feed answers 404 with `match "<id>" has ended; see /api/matches/<id>`.

Watch speed (proposed session 67, an owner check-in item): before each move is released the board holds 6 s after an action, 1 s after a pass, 3 s more when the move starts a new turn; the last move holds 8 s. A median match runs about 5.9 minutes (`progress/ladder-demo-002-live.txt`). The 2x vote isn't built yet.

### Match history (session 67)

`GET /api/matches` (`limit` 1-100, default 20; `before` a match id from the previous page): the caller's matches, newest first.

```
{
  matches: [HistoryRow], total, more,
}
HistoryRow {
  matchId, endedAt, seat: "p1" | "p2",
  result: "win" | "loss" | "draw" | "cancelled" | "abandonedByYou" | "abandonedByOpponent",
  credits,                       // what it paid you
  rating: { before, after, change } | null,   // null for a cancel
  opponent: { ownerId, ownerName, agentName },
  agentName,                     // your agent that played
  turns, hasLog, hasReplay
}
```

`GET /api/matches/:matchId` (any recorded match, so a featured match can be watched again):

```
MatchView {
  matchId, endedAt, outcome: "win" | "draw" | "cancelled" | "abandoned",
  p1: { ownerId, ownerName, ownerKind, agentId, agentName, credits, rating: RatingChange | null, playStyle },
  p2: { ...the same },
  winnerOwnerId, abandonedByOwnerId, turns, moves, boast, hasLog, hasReplay
}
```

`GET /api/matches/:matchId/log` answers the match log as plain text. `GET /api/matches/:matchId/replay` answers the replay file:

```
{
  format: "ai-tcg-replay/1",
  matchId, seed,
  names: { p1, p2 },             // the agents' names, as the engine had them
  decks: { p1: ReplayDeck, p2: ReplayDeck },
  moves: Move[],                 // every move, in order
  result: { outcome, winner, turns, moves, finalHealth: { p1, p2 } }
}
ReplayDeck { name, cardIds: string[] /* one per copy, in list order */, signature: UnitCard | null /* the agent's own card, in full */ }
```

The engine rebuilds the match exactly from it: `replayMatch(replayDeckSpec(decks.p1, "p1"), replayDeckSpec(decks.p2, "p2"), names, seed, moves)` gives every state and log event, the same as the match (`server/src/ladder/ladderRunner.ts` has `replayDeckSpec`; a test checks the rebuilt log against the served one). A match that ended before a move (a seat never seated) has neither file; an abandoned one has a log but no replay (only a match that resolved has one). Logs and replays live in the ladder's match directory, not the database.

## Not built yet

- The rest of the match-dependent endpoints: featured matches (who is "Top rated" in Watch live), the 2x vote, stats, notifications. Tournament endpoints wait until after Season 0.
- `GET /api/matches` reads the owner's whole history and pages it in memory (fine for a season of in-house play; to move into SQL before launch scale).
- The weekly challenge pack (15 wins in a week) and daily quests: specced in ECONOMY.md, not built.
- Creating an account and generating an agent over HTTP (the store has both; the endpoints come with the sign-up page).
- Jobs are kept in memory: a server restart forgets the latest job (the deck itself is saved).
- No HTTPS of its own (meant to sit behind the host's proxy), no CORS (the website is served from the same origin), no rate limit beyond the sign-in lockout.
