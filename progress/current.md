# Current status

**Build-order stage: Stage 4+ (the living system). Session 29 (game lane) did step 1 of the
owner's 2026-10-05 build order: the economy moved from the agent to the owner.** Step 2 (owner
accounts and agents) is next. The stage isn't finished, so there's no checkpoint this session.

## What stands (this session's work; sessions 1-28 otherwise unchanged)

**Schema v2 (`economy/src/schema.ts`, migration 2): the owner owns everything.**
- New `owners` table (player or house; starting faction; starter granted at; active deck).
  `agents` belong to one owner forever and own nothing.
- Copies, the ledger, packs and decks key on `owner_id`. Match payouts carry `played_by` (the
  agent), which must be that owner's own agent. Matches record both owners and both agents.
- Every copy records its origin (pack, crafted, starter, promo, prize) and an `account_bound`
  flag. Crafted and starter copies are always bound; a bound copy never unbinds or changes owner;
  only an unbound standard pack copy of the set can be salvaged. All of this holds against raw SQL.
- No self-play: the two owners in a match must differ (CHECK), and each side must be played by
  its owner's own agent and deck (trigger).
- The starter collection is once per owner (trigger).
- A v1 (session-28) file migrates in place: each v1 agent becomes a house owner with that agent.
  The migration runner now turns foreign keys off, runs each migration in a transaction, and runs
  `PRAGMA foreign_key_check` before commit.

**Store (`economy/src/store.ts`).** `createOwner`, `getOwner`, `listOwners`,
`grantStarterCollection` (the shipped faction deck as bound copies + 3 packs, once), `createAgent`
(grants nothing), `listAgents(ownerId)`, per-owner `balance`/`ledger`/`collection`/decks/packs,
`dailyTally(ownerId)` (caps per owner, so switching agents can't reset them), `recordMatch` (takes
agents, resolves owners, refuses self-play), `matchHistory({ownerId, agentId})`,
`ownerStats(ownerId, {agentId})`, `salvageableCopies`/`salvageExtras`.

**Config (`economy/src/config.ts`).** Every economy number in one file. Win pay is now the owner's
30 / 10 x3 / 5 x6 / 0 (was 40/15/5). Salvage 5/10/30/100, craft 40/80/250/800, pack 100, starter
packs 3, loss 2, loss cap 10.

**`engines.node >= 22.13`** in the root package.json (owner's standing storage item 2).

## Evidence committed

- `progress/economy-demo-002.txt` (`npm run demo -w @ai-tcg/economy`): four house owners get
  their starter collections and play 42 real Lookahead matches over two days. After round 1 the
  Cortex owner switches to a second agent: its first win pays 10 (the owner's 4th win that day),
  not 30. The demo also shows:
  - self-play and a second starter refused;
  - the owner's salvage example: 3 bound starter copies + 1 pack copy, and only the pack copy
    salvages (5 pack points);
  - stats split by agent;
  - each owner buying packs until refused;
  - the balances equal to the ledger sums after the file is reopened.
- `economy/test/` 28 tests (was 18). New ones cover:
  - the v1 -> v2 migration with real v1 rows: origins mapped, bound flags set, the daily tally
    carried over, foreign keys back on;
  - caps across an agent switch;
  - self-play, through the store and raw SQL;
  - another owner's agent on a match side or a payout;
  - a new agent getting nothing;
  - the starter once only;
  - owner stats with the agent filter;
  - the bound-copy triggers;
  - salvage (the owner's example, finishes, promos, crafted copies, in-deck copies, raw SQL).
- `npm test`: 387 across six workspaces, all pass. `tsc --noEmit` clean in all six. The engine
  didn't change, so the ring check is unaffected.

## Concrete next step

Check the alternation first: if the last merged PR is this one (game lane), the next session is
**render**.

The next **game-lane** session is **build-order step 2, owner accounts and agents**
(owner-feedback 2026-10-05, owner app spec B and the build-order entry):
1. Season 0 sign-in: credentials on `owners` (a password hash, scrypt from `node:crypto`; no
   external service), sessions. Keep it in the economy store, behind its API.
2. One connected agent per owner (`owners.connected_agent_id`), switching (refused during a live
   match, which needs a "match in progress" record), the faction-lock owner setting.
3. Generating a new agent: 3 generated agents, then 3 signature-card candidates. This pulls in
   the unique Mythic (ECONOMY.md "Unique Mythic"): the Neutral menu, the 3 cost tiers, the
   signature zone in the engine, the fairness test, and a ring re-baseline. That's likely more
   than one session. Do the data model + the signature zone first.
4. The admin view's data: house owners and their agents.
Then raise the [OWNER CHECK-IN]: how an agent picks its faction, builds from the owner's
collection, and chases quests.
