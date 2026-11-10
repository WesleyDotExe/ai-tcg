# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 83 (game lane) built season end, part 2 (roadmap game
item 3, now done): the next season's file. Nothing is blocking.**

- **The next season's file (schema v27):** `EconomyStore.startNextSeason(ended, new, { season })`
  (`npm run season:next -w server -- <ended> <new> S1`) makes the new file in one transaction from the ended one,
  which is only read. Carried: owners, logins, live sessions, settings, the board, agents and names, drafts,
  signature cards and copies, every cosmetic (`carried_from`) and loadout, the connected agent, the retired
  Prototype runs. Empty: collection, decks, credits, pack points, packs, ratings, history, notifications,
  auto-play, the daily bank. Soft reset in `rating_seeds` (1500 + (final - 1500) / 2, RD 250, placement again).
  The starter grant again. `season_start` records where the file came from.
- **An ended file is frozen completely:** packs, opening, salvage, crafting and shopping refused in the store
  (`refuseIfEnded`) and the schema (ledger, packs, openings, copies but signature copies, salvage).
- **`currentSetCode`:** the season's set, or the newest set while it has none (S1 sells S0 packs). Daily packs, the
  starter grant and the house agents' shopping use it.
- **Endpoints:** `GET /api/season` gains `startedFrom` and `yourSeed`. In `server/OWNER_API.md`.
- **Evidence:** `progress/season-next-001.txt` (13 PASS: made from season-end-001's own file, which the demo
  reruns and checks byte for byte; HTTP sign-in with the old passwords; the seeds; the S0 Prototype seed is a Gold
  in S1; 2 h of S1 ladder from the seeds; the archive unchanged; the refusals). In the CI demo set.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. (The render catch-up after #143 is done: #144 and #145
merged.) This session's PR is game, so **the next session is render**: pack ceremony part 3, per
`progress/render/log.md`'s last entry.

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Game lane, when its turn comes:
- If the owner answered session 83's six small calls (notes-for-owner.md), apply any change.
- Else game-lane item 7 (spare sessions): the quality-debt list (the top one: a one-command season switch, end ->
  drain -> make the next file -> restart, so the admin can't run the server on the archive by mistake), or small
  asks from the render lane. Feature freeze from 9 Nov: only the locked scope.
- The next game hardening pass is session 86.
- If a PR gets a second commit, read both auto-merge jobs: the first live run of the `sha` pin.

**Blocked:** nothing.
