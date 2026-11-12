# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 90 (game lane, a spare session) built the site contract
check: the website's own client against the real owner API, every answer type-checked as the type the site
declares. 0 mismatches in 43 calls; now a CI step. No product code or schema change (still v28). Nothing is
blocking.**

- **The site contract check** (`server/src/dev/siteContractCheck.ts`, `npm run check:site-contract -w server`;
  evidence `progress/site-contract-001.txt`, a record in `progress/demos.json`; CI step in
  `.github/workflows/test.yml`, fails only on a MISMATCH, a missed control or a stray compiler error). The render
  lane is told what's served but unread (`featured`, `viewers`, `allowance.label`, Stats' `today`) in
  notes-for-owner.md, session 90.
- Session 89's daily order fix, 88's season-scale record, 87's round read, 86's lock, 85's season-file checks, 83's
  next-season file and 84's v28 transfer record stand. Season end part 3 (the 2026-11-10 carry-over) is after the
  5 Dec launch.

## Concrete next step

**Lane first (TASKS.md step 0; keep this line whenever you rewrite this file):** if the last merged PR's title starts
with "Render:", this is a game session; otherwise render. This session's PR is game, so **the next session is
render**: as planned in `progress/render/log.md` (the Stats page, the ladder page, the notifications bell; render
hardening pass due at 69).

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

Game lane, when its turn comes (session 91):
- If the owner answered session 90's small calls (notes-for-owner.md), apply them first.
- **Session 91 is the game lane's hardening pass** (every 5th: 81, 86, 91): no new features; work down
  quality-debt.md. Candidates: the site contract check's gaps (the site host's own readers in
  `render/src/site/siteHost.ts` / `liveFrames.ts` read the live feed and replays with their own types; shapes the
  run never reached: a finished live match's `boast`, a "finishing" allowance, a cancelled or abandoned history
  row, a Prototype run in the binder; `buyCosmetic` / `craftSecret` not called); `cardId` on `draw` events (ask
  the render lane first); a seeded season-size file for the clean-up dry run (`seasonScaleMeasure.ts` builds one).
- If the render lane changes `siteApi.ts` and the CI contract step fails, the message names the call and field.
- Clean-up (2-4 Dec): write the owner's switch steps: end the season (`POST /api/admin/season/end`), wait for the
  matches to finish, stop the server with **Ctrl-C**, `npm run season:next -w server -- <old> <new> S1`, start on
  the new file (`--new` only for a very first start). If a step says "is in use by", a server is still running.
  Check the Mac mini's clock is right before restarting the server (session 89; owner 2026-11-12).
- Season end part 3 (the 2026-11-10 carry-over) is after the 5 Dec launch, not before. When built: carry each copy
  with its id, provenance and transfer rows (v28).

**Blocked:** nothing.
