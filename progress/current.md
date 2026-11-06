# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 79 (game lane) read PR #139's CI times and did the
test-only Null deck-builder session (roadmap 2f). Nothing is blocking. Two owner calls are at the top of
notes-for-owner.md: the builder rule (on, and at which margin) and a one-line auto-merge fix (proposed, not made).**

- **PR #139's CI:** the demo step 1:31, the `test` job 6:59 (final commit).
- **Found: the auto-merge's Merge step merges the PR's current head, not the commit it tested.** #139 merged while
  its second commit's `test` was still running. Fix proposed (`sha: pr.head.sha` on `pulls.merge`), NOT made: the
  owner OKs `auto-merge.yml` changes per purpose. Until then: **don't push to a PR after opening it** unless you
  must; if you do, check that the merged commit's `test` passed.
- **`keepDesigned` (deckBuilder.ts, test only, OFF by default):** the designed start is kept unless a challenger
  beats it on the confirm seeds by more than z SD (paired sign test). `builtDeckRing.ts build --keep-designed z`.
  5 tests. `progress/built-deck-ring-006.txt` (z = 2), `-006-z1.txt` (z = 1), `progress/null-builder/` (script,
  README). Full-collection Null 39.2 -> 51.5 / 50.0; z = 2 also drops the full Cortex rating deck (Cortex 43.6),
  z = 1 doesn't. Recommended z = 1.

## Concrete next step

At the start: check for an open PR from your own lane (owner 2026-11-06); if one is open, note it and stop, or fix
it if it has failed checks or conflicts. Check the last merged PR so a slice isn't built twice. Read
owner-feedback.md for answers to session 79.

- **If the owner OKs the auto-merge fix:** do it first. Pass `sha: context.payload.pull_request.head.sha` to
  `pulls.merge` in `.github/workflows/auto-merge.yml`'s Merge step, and add a test in
  `server/test/autoMergeWorkflow.test.ts` where the head moved, so GitHub's 409 fails the job.
- **If the owner picks a margin for the builder:** make it the store's default (`DEFAULT_BUILD` or the
  `keepDesigned` default in `buildFaction`). Regenerate the demos that move (`npm run demos -- --write` and the slow
  three with `--all`), and read every diff. Re-run `progress/null-builder/run-built-deck-ring.sh` (or
  `rules-2-ship`'s script) as the launch-gate re-run with the default on. Bring it to the owner.
- **Otherwise:** the rest of the game lane's open Season 0 items (roadmap 2-0 onward: the live board's unit badges
  if the render lane names them, season end near the end). **Session 80 is the game lane's hardening pass.** Feature
  freeze from 9 Nov: only the locked scope.

**Blocked:** nothing (both calls are the owner's; work continues without them).
