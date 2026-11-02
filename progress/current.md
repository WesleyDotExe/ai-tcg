# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP). Session 69 (game lane): coin skins' game half,
built as the owner answered, and each side's starting rating on the match record (schema v20). Nothing is
blocking. No owner check-in is open; six build calls are listed in notes-for-owner.md to keep or change.**

- **Coin skins, the game half** (`economy/src/cosmetics.ts`, schema v20): the `coin` slot (the loadout's sixth);
  **Chrome Token** granted with the starter collection and equipped on every agent (existing owners and agents
  in the migration); **Dial-Up Dime** and **Neon Nickel**, 300 credits, Season 0, on sale once the render lane
  draws them; the **Platinum, Diamond and Mythic** tier coins (`SEASON_0_TIER_COINS`), source `seasonReward`,
  granted by `store.grantSeasonTierCoins()` at season end (a higher tier gets the lower ones), never sold.
- **On the match:** each side's coin in `match_loadouts` and in the replay (`coins: { p1, p2 }`); each side's
  rating at the start (`ratingsAtStart` on `live_matches` and `matches`, written once).
- **Over HTTP** (`server/OWNER_API.md`): the Coin slot in `GET /api/agents/:id/loadout`; `coin`, `arena` on each
  side of `GET /api/live` and `/api/live/:id`, plus `defaultView`; `ratingAtStart`, `coin`, `arena` per side,
  `coins` and `defaultView` on `GET /api/matches/:id`; `coins` in the replay.
- Evidence: `progress/owner-api-demo-007-coins.txt` (13 checks PASS, byte-identical across runs). Tests:
  `economy/test/coins.test.ts` (12), server tests (2 more).
- The render picker leaves the coin slot out until the render lane's coin slice adds its line (a small guard in
  `render/src/site/siteLoadout.ts` and `render/src/loadoutDemo.ts`).

## Concrete next step

Check the alternation first: this was the game lane (the last merged PR, #120, was the render lane's). If this
PR is the last merged, the next session is **render**: its first coin slice (the flip in Match Boot, the
Chrome Token, reduced motion and sound) can now read the coins and `defaultView` from the API, or the big live
board, as the owner set.

The next **game-lane** session is **70, the hardening pass**, in this order:
1. **Versioned replays** (owner call 6): replays carry the card and rule versions they were played under, old
   ones stay rebuildable (`ai-tcg-replay/1` files, the `coins` field included, must still play).
2. **Ship the 24-health rule** (owner 2026-11-02): "The player going second starts with 24 health; the player
   going first starts with 20 and skips its first draw." The printed rule, the test-only `MatchRules` variants
   removed, `ring`/`ring:real` baselines re-recorded, a new built-deck ring, the live ladder's watch length
   re-checked; the shipped numbers to an owner check-in before the launch-gate re-run.
3. `owner-api-demo-002`'s drift (pre-existing).
Then (session 71+): the 2x vote, featured picks (rule to a check-in), viewer counts.

**Blocked:** nothing.
