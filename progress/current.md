# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 91 (game lane, the hardening pass) took the site contract
check past one plain run's shapes: every history result, a live match's boast, the allowance finishing and done,
a Prototype, a crafted secret, a bought cosmetic. 0 mismatches in 62 calls, 5 of 5 controls. No product code or
schema change (still v28). Nothing is blocking.**

- **The site contract check** (`server/src/dev/siteContractCheck.ts`, `npm run check:site-contract -w server`;
  record `progress/site-contract-001.txt`; a CI step). Fails on a MISMATCH, a missed control, a stray compiler
  error, or (session 91) a shape in its "Shapes reached" list the run no longer reaches.
- Session 89's daily order fix, 88's season-scale record, 87's round read, 86's lock, 85's season-file checks, 83's
  next-season file and 84's v28 transfer record stand. Season end part 3 (the 2026-11-10 carry-over) is after the
  5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. This session's PR is game, so **the next session is
render**: as planned in `progress/render/log.md` (the render hardening pass, 69, with the server's
`allowance.label` in Agent controls; then the notifications bell; then Top rated and viewer counts on Watch live).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Game lane, when its turn comes (session 92):
- If the owner answered session 91's small call (notes-for-owner.md), apply it first.
- A spare session (item 7) unless the owner names something. Candidates: the site host's own readers
  (`render/src/site/siteHost.ts` / `liveFrames.ts` read the live feed and replays with their own types) in the
  contract check; the shapes still unreached (`stopped: dailyRewardsMaxed`, a Zero-Day craft, error bodies);
  `cardId` on `draw` events (ask the render lane first); a seeded season-size file for the clean-up dry run
  (`seasonScaleMeasure.ts` builds one). Next game hardening pass: 96.
- If the render lane changes `siteApi.ts` and the CI contract step fails, the message names the call and field.
- Clean-up (2-4 Dec): write the owner's switch steps: end the season (`POST /api/admin/season/end`), wait for the
  matches to finish, stop the server with **Ctrl-C**, `npm run season:next -w server -- <old> <new> S1`, start on
  the new file (`--new` only for a very first start). If a step says "is in use by", a server is still running.
  Check the Mac mini's clock is right before restarting the server (session 89; owner 2026-11-12).
- Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch, not before. When built: carry each copy
  with its id, provenance and transfer rows (v28).

**Blocked:** nothing.
