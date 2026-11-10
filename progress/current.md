# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 84 (game lane) did the owner's marketplace groundwork
(2026-11-10): the audit at an [OWNER CHECK-IN] in notes-for-owner.md, and the one "day one" gap, schema v28.
Nothing is blocking.**

- **The audit:** every copy was already its own row with a permanent id and a named source; bound copies and
  cosmetics can't move; the owner's account holds everything; the ledger can record a sale as is. The gap was the
  chain of owners.
- **Schema v28:** `copy_transfers` (append-only: from, to, kind, ref, time); `owner_id` changes only by the copy's
  latest transfer; bound, decked, disposed copies and ended files refuse a transfer; a copy row is never deleted,
  its id and provenance never change, a disposed copy stays disposed. Nothing writes a transfer in Season 0.
- **Store:** `copyTransfers(copyId)`, `copyProvenance(copyId)` (source, first owner, every owner, transferable).
- **Evidence:** `progress/copy-provenance-001.txt` (17 PASS, in the CI demo set); `economy/test/copyProvenance.test.ts`.
- Session 83's next-season file stands (schema v27); the owner's 2026-11-10 carry-over changes (collection, decks,
  packs, credits and the rest carry; starter grant for new owners only) are on the checklist as season end part 3,
  after the 5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. This session's PR is game, so **the next session is
render**: per `progress/render/log.md`'s last entry (the pack ceremony, part 3, after 3a).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Game lane, when its turn comes:
- If the owner answered session 84's audit check-in (notes-for-owner.md), apply any change.
- Else game-lane item 7 (spare sessions): the quality-debt list (the top one: a one-command season switch, end ->
  drain -> make the next file -> restart, so the admin can't run the server on the archive by mistake), or small
  asks from the render lane. Feature freeze from 9 Nov: only the locked scope.
- Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch, not before. When built: carry each copy
  with its id, provenance and transfer rows (v28).
- The next game hardening pass is session 86.
- If a PR gets a second commit, read both auto-merge jobs: the first live run of the `sha` pin.

**Blocked:** nothing.
