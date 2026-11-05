# Owner API

The website's server endpoints (roadmap item 3; the owner's 2026-10-05 build order, step 3). Session 56 built the first part: signing in and the deck settings of Settings -> Play (roadmap 2b step 3). Session 63 added what the website's shell waits on (owner 2026-11-01): who am I, the account settings and the wallet. Session 64 added the saved Home board and the economy endpoints (owner 2026-11-01): the collection and binder, salvage and crafting, the ledger, buying and opening packs, the store, cosmetics and loadouts, and today's earnings. Session 66 added the ladder and the rating. Session 67 added the match pages: Watch live (from the long-lived ladder), match history with each match's log and replay, and the auto-play switch. Session 69 added coin skins (the loadout's sixth slot and the coins on the live view, the match and the replay) and each side's rating at the start of a match, for a spectator's point of view. Session 70 versioned the replay files (`ai-tcg-replay/2`: the rules and card versions, every card in full; `/1` files still rebuild). Session 72 added the live-feed asks: the opening hands, the signature card in full, each side's faction and the boast on the live view. Session 73 added the 2× vote. Session 74 added Watch live's featured groups ("Top rated") and viewer counts. Notifications and the Stats page's data come in later sessions, on the same server.

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
| `GET /api/packs/:packId/opening` | none | the opening exactly as `POST /api/packs/open` answered it, a `PackOpening` (the caller's packs only; 410 for a pack opened before schema v19) |
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
| `GET /api/live` | none | `{ running, matches: LiveMatchView[], mine, featured }`: every match being shown, the caller's, and Watch live's groups (below) |
| `GET /api/live/:matchId?from=0` | none | `LiveMatchFeed`: the match now, and the moves released from `from` on (below); 404 once it ended. Reading it counts the caller as watching (`viewers`) |
| `GET /api/matches?limit=20&before=<matchId>` | none | `{ matches: HistoryRow[], total, more }`: the caller's matches, newest first (below) |
| `GET /api/matches/:matchId` | none | `MatchView`: one recorded match, any owner's (below) |
| `GET /api/matches/:matchId/log` | none | the match log, as text (`text/plain`) |
| `GET /api/matches/:matchId/replay` | none | the replay file, `ai-tcg-replay/2` (versioned, session 70; older matches answer `/1`) (below) |

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
  ask2xEveryMatch: boolean,   // (v21) default false; Settings -> Play "Ask for 2× in every match": asks as each live match starts
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
                  cards: [{ copyId, cardId, name, rarity, finish, secretCode, serial, held }] }],  // newest first
  promos: {                                                                                   // session 68
    signatureCards: [{ agentId, agentName, connected, cardId, name, collectorNumber, rarity,
                       faction, flavor, art, copyId, createdAt }],                            // by PR- number
    earned: [{ copyId, cardId, name, rarity, finish, origin, seriesCode, stamp, acquiredAt }]   // newest first
  }
}
```

- `promos` is the Promos tab (session 68): every signature card of the owner's agents, `connected: true` on the agent playing now (the page greys out the rest), and every `promo` or `prize` copy earned other than a signature card, with its stamp ("10-WIN STREAK") and series code. Season 0 issues no earned promos yet (milestones, quests and tournaments come later), so `earned` is empty until they do.

- Every copy is its own item (origin `pack`, `starter`, `crafted`, `promo`, ...; `accountBound` copies play but never sell or salvage). A secret copy's `secretCode` names the secret card it is; its `cardId` is the card it plays as.
- `recentPacks` (1 to 50, default 3) is how many openings `recentPulls` lists; a pulled copy since salvaged shows `held: false`.
- `GET /api/collection/binder/:setCode` is the store's binder: `{ setCode, base, secrets, glitch, gold, prototypes }`, each section `{ title, held, total, entries: [{ number, kind, cardId, secretCode, name, rarity, owned }] }`, and the Prototype runs with the serials held.
- `GET /api/collection/cards/:cardId` is the card viewer: `{ cardId, rarity, owned, salvageable, packPointsEach, notSalvageable: [{ reason, count }], decks: [{ deckId, name, uses, active }], copyLimit, craft }`.
  - `copyLimit` (session 68): copies a deck can play, 3 / 3 / 2 / 1 by rarity, 1 for a Zero-Day card; `null` for a signature card (it plays from its own zone, outside the limits).
  - `craft` (session 68): `{ packPoints, available, reason }` for crafting one standard copy with `POST .../craft`: the price, whether it can be crafted now, and if not, why, in the craft's own refusal words ("you already hold 3 of ...", "crafting ... costs 40 pack points; you have 15"). `null` for a card never crafted this way: a signature card, and a Zero-Day card (crafted as a secret card, `POST /api/collection/secrets/:code/craft`). The website reads these instead of the economy's config.

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
- Each pack's seed is drawn by the server when it opens and is shown only after (`GET /api/packs/:packId/opening` reads the opening back).
- **"Watch again"** (session 68, schema v19): each opening is kept as `POST /api/packs/open` answered it, in the open's own transaction, never changed. `GET /api/packs/:packId/opening` answers that same `PackOpening` (each card's slot, NEW, "x N owned", the pity, the starter guarantee, the pack points, `fullReveal`), as of the opening, not now, so the reveal can be replayed, or picked up again after a reload mid-reveal. A pack opened before v19 has no kept reveal: 410. Another owner's pack, or one not opened, is 404.

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

- `GET /api/store`: `{ packs: <the pack offer>, dailyPack, cosmetics: [CosmeticItem & { owned }], wallet }`. Cosmetics listed are those on sale now (this season, inside their sale window, drawn by the render lane); Season 0 sells two boasts at 300 credits and two coins at 300 credits each (Dial-Up Dime, Neon Nickel): both coins are on sale now that the render lane has drawn them (render session 55). An item not yet drawn is never listed, and buying one is 409.
- `POST /api/store/cosmetics/:itemId/buy` pays credits and grants the item together, or refuses (409): not on sale, already owned, too few credits, a free starter item, a season reward (the tier coins are never sold).
- `GET /api/cosmetics`: every item the owner owns (`{ ownerId, itemId, kind, source: "starter" | "purchase" | "seasonReward", ledgerEntryId, rewardRef, acquiredAt, item }`), the four starter boasts and the Chrome Token included. `rewardRef` names a season reward (`"S0:Platinum"`), else null.

#### Coin skins (schema v20, session 69)

Who goes first is the server's coin flip for every match; the coin is only how that flip looks. It never changes who goes first or the odds.
- `kind: "coin"`. Item ids: `coin-chrome-token` (**Chrome Token**, standard, free: every owner gets it with the starter collection and every agent starts with it equipped; existing owners got it in the v20 migration), `coin-s0-dial-up-dime` and `coin-s0-neon-nickel` (Season 0 store coins, 300 credits each, all season, then retired), `coin-s0-platinum`, `coin-s0-diamond`, `coin-s0-mythic` (the Season 0 tier coins: `tierReward` on the item names the tier).
- **Tier coins** are granted when the season ends, by the owner's ladder tier then (placement done): Platinum or higher gets the Platinum coin, Diamond or higher the Diamond coin too, Mythic all three. Source `seasonReward`; bound to the owner like every cosmetic, never sold, kept over the season reset. Nothing grants them before the season-end work runs (the store's `grantSeasonTierCoins`).
- An empty coin slot flips the Chrome Token, and so does every match recorded before v20.
- No coin is drawn by the render lane yet (`drawn: false`), so the store sells none until its coin slice marks them.

### The loadout

```
{
  agentId,
  loadout: { boast, closeWinBoast, cardBack, avatar, arena, coin },   // item ids or null
  slots: [{ slot, kind, itemId, choices: [itemId] }],          // the owned items that fit each slot
  locked: boolean                                              // true during a live match: changes are refused
}
```

`slots` lists the six slots in this order: `boast`, `closeWinBoast`, `cardBack`, `avatar`, `arena`, `coin` (v20: the "Coin" slot, kind `coin`).

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

`DeckStatus` is the store's: `{ deckId, name, ownerId, active, complete, missing, cards, faction, list }`. `faction` (session 68) is the faction the deck plays (its one non-Neutral faction; `null` only for a deck with none or several, which no legal deck is); `list` is `[{ cardId, copies }]`, each card once, in the order first listed. `rebuild.reasons` is the store's `agentDeckRebuildReasons`: empty when the agent's deck is up to date or a deck is forced.

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

`GET /api/live`: `{ running, matches, mine, featured }`. `running` is false when the server runs without the ladder; `mine` is the caller's live match id or null; `featured` is `{ tournament: string[], topRated: string[] }`, match ids in display order (session 74, below).

```
LiveMatchView {
  matchId, startedAt,
  released,                      // moves released so far
  nextAt: string | null,         // when the next move comes out (null: the last is out, the result holds, then it is recorded)
  p1: LiveSideView, p2: LiveSideView,
  defaultView: "p1" | "p2",      // (v20) the spectator's starting point of view: the higher rating at the start, p1 on a tie
  now: PublicSnapshot,           // the board after the last released move
  recentLines: string[],         // the last 6 log lines released, oldest first
  boast: MatchBoast | null,      // (session 72) null until the last move is out; then the boast the record keeps (below)
  speed: SpeedView,              // (session 73) the 2× vote; `nextAt` is already at this pace (below)
  viewers: number                // (session 74) signed-in owners who read this match's feed in the last 30 s (below)
}
SpeedView {
  rate: 1 | 2,                   // 2 while both sides agree, else 1
  asks: { p1: boolean, p2: boolean },    // whether each side's owner asks for 2× now (always false for a house side)
  house: { p1: boolean, p2: boolean },   // a house side agrees to what a player opponent asks
  waitingOn: "p1" | "p2" | null  // one player owner asks and this side's player owner hasn't: "waiting on the other owner"
}
LiveSideView {
  ownerId, ownerName, agentId, agentName, playStyle,
  rating, tier,                  // as the match started
  coin: string,                  // (v20) the coin this side flips: its equipped coin, else "coin-chrome-token"
  arena: string | null,          // (v20) its arena background, null when none is equipped
  faction: "Cortex" | "Swarm" | "Aegis" | "Null"   // (session 72) the faction of the deck this side plays, from the start
}
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
  signature: PublicSignature | null
}
PublicSignature {                // (session 72) the signature card in full, as the engine's signature zone has it
  cardId, name,
  cost, attack, health,          // printed (a played signature card's live stats are its board entry's)
  keywords: string[],
  rulesText: string[],           // one line per ability, as printed (none for a keyword-only card: draw its keywords)
  art: string, flavor: string,   // its art reference (the generated art slot) and flavour
  timesPlayed: number,
  inZone: boolean,               // true while it waits in the zone; false while on the board
  nextCost: number,              // what playing it costs now: its cost with modifiers in play, plus 2 for every earlier play
  played: boolean                // timesPlayed > 0 (kept from before session 72)
}
MatchBoast { agentId, itemId, slot: "boast" | "closeWinBoast" | "factionStarter", winnerHealth }
```

`GET /api/live/:matchId?from=N` is the feed for the match page: `LiveMatchView` plus `{ from, steps, start, startLines, openingHands }`. Fetch with `from=0` first (that answer also has `start`, the board before the first move, `startLines`, the opening draws, and `openingHands`, `{ p1: string[], p2: string[] }`: each side's opening hand by card id in hand order; all three are null on any later fetch), then with `from=<released>` each time to get only what is new; `from` past `released` is treated as `released`. Each step:

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

**Hands, the signature card, the faction and the boast (session 72; owner 2026-11-03, the render-51 and render-53 asks).** A spectator sees both hands face up live, as in a replay: start from `openingHands`, add each `draw` event's card (draw events name the card), and take away each card that leaves the hand (a `play` not `fromSignatureZone`, a `cast` without a `sourceId` (a Command), an `evolve`'s `to`, a `toolAttached`'s `tool`); the result matches each snapshot's `hand` count after every move (`progress/live-feed-asks-001.txt` checks it over six matches). `openingHands` is sent because every match the ladder shows was decided in the engine before its first move was released. **Safety rule (owner 2026-11-03):** a match where a seat is a network agent playing in real time gets no `openingHands` and no card in its draw events until it ends; that is built when network agents join the ladder. A signature card's `nextCost` before a move is what the engine charges if it is played on that move, and after it dies it is the `signatureReturn` event's `nextCost`. The `boast` is worked out by the store's own rule (`matchBoast`: the close-win boast at 5 health or less if one is equipped, else the main boast, else the deck faction's starter boast) on the loadouts and deck the match started with, which can't change while it is live, so it is the one `GET /api/matches/:id` then shows; null for a draw, a cancel or an abandon.

Once the match has been recorded the feed answers 404 with `match "<id>" has ended; see /api/matches/<id>`.

Watch speed (proposed session 67, an owner check-in item): before each move is released the board holds 6 s after an action, 1 s after a pass, 3 s more when the move starts a new turn; the last move holds 8 s. A median match runs about 6-7 minutes at 1× (the owner's target since 2026-11-03; `progress/first-seat-003-rules-2.txt`).

**The 2× vote (session 73; owner app spec 2026-10-05 D).** `PUT /api/live/:matchId/speed` with `{ "ask": true }` is "Ask for 2×"; `{ "ask": false }` takes it back. Only the two owners whose agents play the match vote. Answer: `{ matchId, speed: SpeedView, nextAt }`.

- A match starts at 1×. It runs at 2× only while both sides agree; every hold is then half as long (3 s an action, 0.5 s a pass, 1.5 s more for a new turn, 4 s for the result). A change part-way through a hold changes only what is left of it: half a 6 s hold waited at 1×, then 2×, leaves 1.5 s. Taking an ask back returns to 1× the same way.
- "Ask for 2× in every match" (`ask2xEveryMatch` in the account settings) asks for the owner as each of its matches starts. A match with both owners' setting on is 2× from its first move.
- The vote resets every match: it is kept with the live match, in memory, and gone when it is recorded (a restart cancels the match anyway).
- **A house side** (proposed session 73, an owner call): nobody watches a house agent, so a house side never asks by itself; it agrees to whatever its player opponent asks. Against the house, one ask is enough. House against house is always 1× (the house accounts' own setting is ignored). A house account's `PUT` answers 409.
- Speed changes only the pace moves are released at, never the match: every match is decided in the engine before its first move is shown, so its moves, log, replay, result, credits and ratings are the same at 1× or 2× (`progress/speed-vote-001.txt` checks eleven matches against the same seeds at 1×).
- 400 for an `ask` that isn't true or false; 403 for an owner whose agent isn't in the match; 404 when it isn't live (`match "<id>" has ended; see /api/matches/<id>` once recorded).

**Featured and viewers (session 74; owner app spec 2026-10-05 C.4: "Featured live matches in two groups: Tournament (including the Season 0 finale when it runs) and Top rated (high-rating players). Shows viewer counts.")** Both rules are proposals at an owner check-in (`progress/notes-for-owner.md`); the evidence is `progress/featured-viewers-001.txt` (`npm run demo:featured-viewers -w server`).

- `featured.topRated`: up to 3 live matches where **both sides are out of placement** (neither tier reads "Placement"), ranked by the **weaker side's rating** as the match started (a match is only as top as its weaker player), ties by the stronger side's rating, then the earlier start, then the match id. No rating floor in Season 0 (the server's `featured.minRating` option is there for launch scale). The ratings and tiers are each side's `rating` and `tier` on the list, so a page can show why a match is featured. Logic in `server/src/ladder/featured.ts`.
- `featured.tournament`: always `[]` in Season 0 (tournaments come after it); sent so the shape is fixed.
- A featured match is still in `matches`; the groups only name and order them. A match can be both featured and the caller's `mine`.
- `viewers`: each signed-in owner that read the match's feed (`GET /api/live/:matchId`, any `from`) in the last 30 s, counted once however many tabs it has open. The two players' owners count when they watch. Reading the list (`GET /api/live`) is not watching, so a page that plays the match (the match page, the live arena, a Watch live widget at L) must read the feed; one that only shows the list doesn't count its reader. The website's 3 s on-screen read and 15 s hidden-tab read both keep a viewer counted; a closed page drops out within 30 s. Kept in memory with the live match and gone when it is recorded. Logic in `server/src/ladder/viewers.ts`.

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
  p1: { ownerId, ownerName, ownerKind, agentId, agentName, credits, rating: RatingChange | null, playStyle,
        ratingAtStart: number | null,   // (v20) the owner's rating as the match started
        coin: string, arena: string | null },   // (v20) as on LiveSideView, from the match's own loadout
  p2: { ...the same },
  coins: { p1, p2 },             // (v20) both coins again, as the replay has them
  defaultView: "p1" | "p2",      // (v20) the higher ratingAtStart, p1 on a tie or when unknown
  winnerOwnerId, abandonedByOwnerId, turns, moves, boast, hasLog, hasReplay
}
```

`ratingAtStart` is kept for every outcome from v20 on (a cancel too). A rated match from before v20 gives its ratings' `before`; an older cancel gives null (and `defaultView` is p1). Both coins and both arenas are sent so a spectator who owns neither agent can switch point of view (owner 2026-11-02); an owner watching their own agent's match keeps their own side's.

`GET /api/matches/:matchId/log` answers the match log as plain text. `GET /api/matches/:matchId/replay` answers the replay file:

```
{
  format: "ai-tcg-replay/2",     // (session 70) versioned; files written before answer "ai-tcg-replay/1"
  versions: {
    rules: "rules-2",            // the rules version it was played under (engine RULES_VERSIONS); "measure" only for a measuring tool's variant
    cards: "cards-1" | null,     // the published card version the game was on; null if a deck card wasn't that version's
    cardsDigest                  // the hash of `cards` below, so a reader can check them
  },
  matchId, seed,
  names: { p1, p2 },             // the agents' names, as the engine had them
  cards: Card[],                 // (/2 only) every distinct deck card in full, sorted by id (signatures stay in their decks)
  decks: { p1: ReplayDeck, p2: ReplayDeck },
  moves: Move[],                 // every move, in order
  result: { outcome, winner, turns, moves, finalHealth: { p1, p2 } },
  coins: { p1, p2 }              // (v20) the coin each side flipped; absent in replays written before
}
ReplayDeck { name, cardIds: string[] /* one per copy, in list order */, signature: UnitCard | null /* the agent's own card, in full */ }
```

**Versions** (owner 2026-11-02 call 6: "replays carry the card and rule versions they were played under, old ones stay rebuildable"). An `/2` file is self-contained: it plays its own `cards` and its own rules version, never today's registry, so a card rebalanced in a later set or a new rule can't change an old match. An `/1` file (sessions 67-69) names card ids only: those ids mean the frozen `cards-1` (`engine/src/data/cardSnapshots/cards1.ts`, the cards as they stood for every `/1` file) and the rules `rules-1`. A file naming a rules version the engine doesn't know, cards that don't match their digest, or another format is refused with the reason, never guessed at. The versions themselves live in `engine/src/engine/versions.ts`: a card change needs a new `CARDS_VERSIONS` entry (a test fails until it has one), and a change to how matches play needs a new `RULES_VERSIONS` entry with the old behaviour kept for the old version.

**Rules versions so far.** `rules-1`: "Both players start with 20 health. The player going first skips its first draw." Every match up to session 70, so every `/1` file and the `/2` files written before session 71. `rules-2` (session 71, owner 2026-11-02): "The player going second starts with 24 health; the player going first starts with 20 and skips its first draw." Every match from session 71. Each version's rules are written out in full in the engine (`rules-1` is `{ secondSeatExtraHealth: 0 }`), so an old file keeps playing 20 and 20 now that the engine's default is 24 for the second seat. The second seat is always `p2`, so a page drawing health should read `maxHealth` from the state (the live view and the replay both send it), not assume 20.

The engine rebuilds the match exactly from either format: `rebuildReplay(file, hooks?)` (`server/src/ladder/replayFile.ts`) reads it (`replaySetup`: the decks, names, seed, moves and rules) and replays it with the engine's `replayMatch`, giving every state and log event, and checks it ends as `result` says (winner, turns, moves, final health). Golden replays of both formats (`server/test/fixtures/replays/`, real files the ladder wrote) are rebuilt byte for byte by the tests, also against a registry where every unit has changed. A match that ended before a move (a seat never seated) has neither file; an abandoned one has a log but no replay (only a match that resolved has one). Logs and replays live in the ladder's match directory, not the database.

## Not built yet

- The rest of the match-dependent endpoints: notifications, then the Stats page's data (owner 2026-11-05, in that order). Tournament endpoints (and so the `featured.tournament` group) wait until after Season 0.
- Viewer counts are signed-in owners only: the site has no signed-out spectators in Season 0.
- `GET /api/matches` reads the owner's whole history and pages it in memory (fine for a season of in-house play; to move into SQL before launch scale).
- The weekly challenge pack (15 wins in a week) and daily quests: specced in ECONOMY.md, not built.
- Creating an account and generating an agent over HTTP (the store has both; the endpoints come with the sign-up page).
- Jobs are kept in memory: a server restart forgets the latest job (the deck itself is saved).
- No HTTPS of its own (meant to sit behind the host's proxy), no CORS (the website is served from the same origin), no rate limit beyond the sign-in lockout.
