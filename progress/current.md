# Current status

**Build-order stage: Stage 4+ (the living system). Session 30 (game lane) did the owner's
2026-10-07 economy entries and the first part of build-order step 2 (owner accounts and
agents).** The rest of step 2 (generating a new agent and its signature card) is next. The
stage isn't finished, so there's no checkpoint this session.

## What stands (this session's work; sessions 1-29 otherwise unchanged)

**Schema v3 (`economy/src/schema.ts`, migration 3).**
- Promo and prize copies are account-bound too (owner 2026-10-07). Done with a trigger plus a
  backfill, because v2's CHECK can't change without rebuilding the table.
- `logins` (username, optional email, scrypt hash, admin flag), `sessions` (keyed by the token's
  SHA-256), `sign_in_failures`.
- `owners.connected_agent_id` (must be the owner's own agent) and `owners.faction_lock`.
- `live_matches`. Each side must be the owner's connected agent, an owner is in at most one live
  match, and an owner can't switch or disconnect its agent while live. All of these are enforced
  in the schema too.

**Store (`economy/src/store.ts`).**
- **Sign-in:** `createAccount`, `addLogin`, `signIn`, `authenticate`, `signOut`,
  `changePassword`, `isAdmin`.
  - Passwords are hashed in `economy/src/passwords.ts`: `node:crypto` scrypt, with the cost stored
    in each hash and a re-hash on sign-in when the cost is raised.
  - An unknown login gets the same answer, at the same scrypt cost, as a wrong password.
  - 10 failures in 15 minutes lock the account, counted across its username and email.
- **Agents:** `connectAgent`, `disconnectAgent`, `connectedAgent`, `setFactionLock`.
- **Live matches:**
  - `startMatch` takes two owners. It uses each owner's connected agent and active deck, and
    refuses self-play, a missing agent or deck, an incomplete deck, a deck outside the faction
    lock, and an owner already live.
  - `recordMatch` ends a live match and must name the agents that started it.
  - `liveMatchOf` and `liveMatches` read the live state.
- **Admin:** `houseRoster` is the admin view's data.
- **Salvage is manual only:**
  - `cardHoldings` gives the card viewer its data: copies held, how many are salvageable, why
    each of the rest can't be, and the decks that use the card.
  - `salvagePlan` previews a salvage.
  - `salvage(owner, card, qty, {confirmDeckImpact})` throws `SalvageNeedsConfirmation`, with the
    affected decks, until the owner confirms.
  - `salvageExtras` and `salvageableCopies` are gone.
- **Decks count cards and share copies.**
  - `loadDeck` fills a slot whose copy is gone with another held copy of the same card.
  - `deckStatus` and `listDecks` report a deck as incomplete when there are too few copies held.
  - `updateDeck` fixes a deck.
  - `setActiveDeck` respects the faction lock.

## Evidence committed

- `progress/economy-demo-003.txt` (`npm run demo -w @ai-tcg/economy`) is byte-reproducible now
  (the pack id is masked). It shows:
  - sign-in by email in any case, the same refusal for a wrong password and an unknown login, the
    lockout and its expiry, sign-out, and the admin;
  - 42 real Lookahead matches, each started with `startMatch` and closed by `recordMatch`.
    house-cortex's switch to cortex-b is refused mid-match and goes through after it. Match
    results match session 29's run; the only difference is match 13, now played by cortex-a;
  - manual salvage with the card viewer's reasons;
  - a deck-short salvage: warned, then confirmed, with both decks marked INCOMPLETE and the
    active one refused at load. Two more pulls make both decks complete again;
  - the faction lock refusing a start;
  - the admin's house roster.
- `economy/test/` 43 tests (was 28). New `accounts.test.ts` (12): passwords, sign-in, lockout,
  sessions, re-hash, admin, connected agent, live matches, start refusals, the roster.
  `store.test.ts` covers the v2 -> v3 migration, promo and prize binding (including raw SQL), no
  automatic salvage, manual salvage, the reasons, the deck warning and incomplete decks, and
  shared-copy resolution with `updateDeck`.
- `npm test`: 412 across six workspaces, all pass. `tsc --noEmit` is clean in all six. The engine
  didn't change, so the ring check is unaffected.

## Concrete next step

Check the alternation first: if the last merged PR is this one (game lane), the next session is
**render**.

The next **game-lane** session finishes **build-order step 2: generating a new agent** (owner app
spec B; ECONOMY.md "Unique Mythic"):
1. Engine first: the signature zone (the card starts in its own zone, never drawn or shuffled,
   playable when affordable, returns on death at +2 cost each replay, outside the deck limits).
   Teach LookaheadAgent to use it, then re-baseline the ring once, with each faction's set Mythic
   standing in as its signature card.
2. The 16-option Neutral ability menu x the 3 cost tiers as card data built from existing effect
   kinds, and the fairness test (swap into each starter, ring moves of 2 points or less, ring
   check passes).
3. Economy: the signature card as the agent's bound promo (PR- numbering), `generateAgent`
   (3 agents, then 3 signature candidates, pick, confirm; no starter packs), and the connected
   agent's card in play.
Likely more than one session; do the signature zone + ring re-baseline first. Then raise the
[OWNER CHECK-IN]: how an agent picks its faction, builds from the owner's collection, and
chases quests.
