# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 80 (game lane) did the owner's two answers to session 79,
in the order given: the auto-merge pins the tested commit, then the builder rule on at 1 SD and the launch-gate
re-run. Nothing is blocking. The launch-gate results are at the [OWNER CHECK-IN] at the top of notes-for-owner.md.**

- **Auto-merge (`.github/workflows/auto-merge.yml`):** the Merge step passes `sha` (the commit the wait step
  checked); GitHub's 409 for a moved head ends the job green with a notice; a `concurrency` group per PR cancels
  the older job. 20 tests in `server/test/autoMergeWorkflow.test.ts`. Pushing a second commit to an open PR is
  safe again (its own job merges it), but the first real two-commit PR is the fix's first live run: read both
  of its auto-merge jobs.
- **The builder (`engine/src/deckbuilder/deckBuilder.ts`):** `DEFAULT_BUILD.keepDesigned: 1` is the store's rule;
  `null` is the plain rule (measurement only). `builderRule()` names it. Schema **v25** records it on each agent
  deck (`decks.built_rule`); a deck built under another rule (every pre-v25 deck) gets the rebuild reason "the
  builder's rule changed". `progress/builder-rule-001.txt` (25 PASS, in the CI demo check: 25 fast demos now).
- **Launch gate:** `progress/built-deck-ring-007.txt` (run with `progress/launch-gate-s80/run-built-deck-ring.sh`),
  identical to 006-z1; both ring checks PASS (`progress/launch-gate-s80/ring-*.txt`).

## Concrete next step

At the start: check for an open PR from your own lane (owner 2026-11-06); if one is open, note it and stop, or fix
it if it has failed checks or conflicts. Check the last merged PR so a slice isn't built twice. Read
owner-feedback.md for answers to session 80 (the launch gate).

- **Session 81 is the game lane's hardening pass** (it was due at 80; the owner's two items went first). No new
  features. Work down `progress/quality-debt.md`: start with the session 80 and 79 sections, e.g. a real look at
  the first two-commit PR's auto-merge jobs if one has happened, and the rule-change rebuild burst (how the ladder
  and the worker pool queue it, measured on a store with many agent decks).
- If the owner answers the launch gate with changes, those come first.
- After that: the rest of the game lane's open Season 0 items (roadmap 2-0 onward: the live board's unit badges if
  the render lane names them; season end near the end). Feature freeze from 9 Nov: only the locked scope.

**Blocked:** nothing.
