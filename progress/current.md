# Current status

**Build-order stage: Stage 4+ (the living system). Session 47 (game lane) built the game lane's half
of victory boasts as the owner approved (all 6 defaults): the cosmetics backend, schema v11. One
small [OWNER CHECK-IN] is in notes-for-owner.md (what Season 0 sells; 5 calls).**
- **Catalogue** (`economy/src/cosmetics.ts`, code like the card sets): four kinds (boast, card back,
  avatar, arena); the 4 free faction starter boasts; nothing on sale in Season 0 until the owner
  names the items. The store checks the catalogue when it opens.
- **Ownership** (`owned_cosmetics`): account-bound in the schema; starter boasts granted with the
  starter collection (and once by migration 11 to existing owners); `buyCosmetic` at 300 credits,
  only in the item's season and sale window, then retired; the purchase names its ledger row.
- **Loadout** (`agent_loadouts`, `setLoadout`, `loadout`): 5 slots (boast, closeWinBoast, cardBack,
  avatar, arena); only owned items of the slot's kind; no changes during a live match; a new agent
  starts on its owner's faction boast. `startMatch` returns each side's loadout.
- **Match record** (`match_loadouts`, `match_boasts`; `MatchRecord.loadouts` / `.boast`): each side's
  loadout and the boast that played: close-win when the winner ends on 5 health or less, else the
  main boast, else the deck faction's starter (`factionStarter`). `RecordMatchInput.finalHealth`.
- **Evidence** `progress/economy-demo-012.txt` (a v10 file migrated; 62 real LookaheadAgent matches;
  a purchase; 24 of 24 boasts right; history unchanged after a loadout change; 13 refusals).

## What stands (this session's work; sessions 1-46 otherwise unchanged)

- `economy/src/cosmetics.ts` (new), `economy/src/schema.ts` migration 11, `economy/src/store.ts`
  (cosmetics section, `recordMatch` / `matchHistory` / `startMatch` / `grantStarterCollection` /
  agent creation), `economy/src/index.ts` exports.
- `economy/src/dev/boastDemo.ts` (new, reproducible output).
- `economy/test/cosmetics.test.ts` (new, 15 tests); `store.test.ts` updated for v11.
- ECONOMY.md "Victory boasts and the cosmetics backend"; tables and schema rules.
- `npm test`: all six workspaces pass (835 tests); typecheck clean in every workspace. Engine
  untouched, so both ring checks are unaffected.

## Concrete next step

Check the alternation first: this PR follows render's #78, so the next session is **render**
(its boast slice 1; slice 3 can now read `MatchRecord.loadouts` and `MatchRecord.boast`).

The next **game-lane** session (session 48):
1. The owner's answers to the session-47 check-in, if any: if Season 0's items are named, add them to
   the catalogue (only once the render lane can draw them) with tests.
2. Otherwise **a hardening pass** (three sessions overdue, no new features): re-run the signature
   approved list's 10,000-game check with the session-41 agent; give `signatureRingDrivers.ts` and
   `aegisSignatureGain.ts` a main guard and a smoke test; speed up `grantStarterCollection` (copy by
   copy inserts); work down quality-debt.md.
3. Then roadmap 2b: the deck-building agent.

**Blocked:** nothing.
