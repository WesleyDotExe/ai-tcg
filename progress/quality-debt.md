# Quality debt (honest, specific — read before adding anything new)

Written at the end of session 1, updated at the end of the stage-1 redo
session (priority/reactivity rebuild), the stage-2 (agent interface)
session, the stage-3 (real card set / board-development system) session,
the session-5 hardening pass (checkpoint feedback + automated test runner),
session 6 (backfilling Cortex/Swarm with board-development cards), session
7 (first cross-faction balance measurement + a real crash fix), session 8
(the fourth faction, Null), session 9 (non-engine test coverage), session 10
(the owner-directed Aegis-vs-Null fix attempt), session 11 (Aegis
defensive interaction + the chosen-targeting fix), session 12 (Phase 1 of
the 2026-09-20 owner-feedback entry — fixing the balance instrument),
session 13 (Phase 2 item 3 of the same entry — directive removal), session
14 (Phase 2 items 4-5 — summon/token effect kind, base armor), session 15
(Phase 3 — the load-time card-pool lint), session 16 (Phase 4 — the counter
triangle, proposed and measured), session 17 (the owner's Phase 4
decisions: the four-faction ring, Null step 4, buff Swarm), session 18
(Phase 4 session 17 follow-ups: ring labels corrected, Aegis-vs-Cortex
fix, Null past-cost nerf), session 19 (Phase 5 slice 1: Aegis pool
grown 18 -> 22 unique cards), session 20 (Phase 5 slice 2: Swarm
pool grown 16 -> 20 unique cards), session 21 (Phase 5 slice 3:
Null depth/variety pass, 15 -> 20 unique cards), and now session 22 (Phase
5 slice 4: Cortex depth/variety pass, 19 -> 24 unique cards), and now
session 23 (the Null consistency trim, 40 -> 36), session 24 (the
neutral pool), session 25 (the owner's agent checks: card
advantage, Null's cards), session 26 (the Phase 5 gate), session 27 (Phase 5
closed, event-log instance ids), session 28 (persistence + the economy spec), and now session 29
(the economy moves to the owner), and now session 30 (manual salvage, sign-in, the connected
agent), and now session 31 (promo/prize unbinding, the signature zone), and session 32 (the Neutral
signature menu and its fairness test), and session 33 (the tuner's size and cost levers, Guard over
Bulwark, the unsellable signature card), and session 34 (Barrier-only Guardian, units-only Bulwark,
the finer tuner pass, generating a new agent), and session 35 (10,000-game re-measure, combinations
may repeat, themed card names), and session 36 (the art-pool slot, themed agent names, pack
contents and opening), and session 37 (owners name their agents, more agent-name room), and session 38 (unique
signature ability ids, game-over causes as data, the free first rename, the chase-card proposal),
and session 39 (the chase cards live: schema v10, S0-odds-2, one roller, secret crafting, the
binder; Intercept Routine fizzle causes), and session 40 (the generic "choose one" mechanic; the 3
Zero-Day cards built and measured, not live), and session 41 (the reference agent fixed, the ring
re-baselined, the Zero-Day cards tuned to the cap), and session 42 (the Zero-Day cards live; the
Aegis vs Cortex investigation), and session 43 (the signature-mode ring investigation), and session 44
(the real-match ring check; why a signature card helps Aegis most), and session 45 (option C: the
Aegis late-deck trials; full signature ability wording), and session 46 (the starter guarantee; the
victory-boast plan), and session 47 (victory boasts: the cosmetics backend, schema v11), and session 48
(the Season 0 boasts; a hardening pass), and session 49 (the approved list from today's agent; Guardian 3/4), and session 50
(hardening: result provenance, the seeded-bounds audit), and session 51 (the deck-building agent, schema v12), and session 52 (play styles, schema v13), and session 53 (the deck builder in the agent's style, schema v14), and session 54 (the built-deck ring; two builder fixes), and session 55 (hardening: rebuilds only for usable cards, the builder's rule constants, the deck-builder reports re-run), and session 56 (the owner API: the deck settings over HTTP), and session 57 (the deck-size check, test only), and session 58 (option B: the builder builds to the size the cards allow), and session 59 (the balance session, job 1: Null's 4 added cards, test only), and session 60 (hardening; set A shipped), and session 62 (NA12 and CS7 shipped; the Season 0 checklist), and session 63 (who am I, account settings, the wallet; Null Out's text), and session 64 (the Home board and the economy endpoints; the daily reset moved to midnight Sydney), and session 65 (hardening: the stale demos; the owner's daily pack), and sessions 66-68 (match running, the live ladder, the first seat measured), and session 69 (coin skins, the game half; starting ratings, schema v20), and session 70 (hardening: versioned replays; two drifted demos), and session 71 (the 24-health rule shipped as rules-2), and session 72 (the live-feed asks), and session 75 (hardening: the auto-merge retry, the demo drift check), and session 76 (the play-time allowance, schema v22), and session 77 (the auto-merge test-run guard; notifications, schema v23), and session 78 (the demo check in CI, "Time's up", the Stats page's data, schema v24), and session 79 (the test-only Null builder rule; an auto-merge race found).
This is not "no debt, all good" — the product is real and the evidence is
real, but here is where it's thin.

## Launch gate (owner 2026-10-19, firm): built-deck balance

- **Re-run session 80 on the shipped builder (keep-designed at 1 SD): `progress/built-deck-ring-007.txt`**, both ring
  checks PASS; at an owner check-in. The full-collection Null deck is fixed (real 39.2 -> 50.0).
- **PASSED (owner 2026-10-22)** on `progress/built-deck-ring-001.txt`. It stays a standing re-run: any
  card change, and the last session before launch, re-runs `builtDeckRing.ts`. Nothing runs it
  automatically (about 25 minutes on 4 cores, too slow for CI).
- **Still owed before launch (owner 2026-10-22):** the test-only balance session for Null > Aegis
  (inverted) and Cortex > Swarm (under band), candidates measured on the ring in both modes and on the
  built-deck ring at every level, results to an owner check-in. Its first job (Null's 4 added cards) is
  done: set A shipped in session 60, re-run on `progress/built-deck-ring-003.txt`. Job 2 (the two edges) is
  run (session 61, `progress/balance-report-037-old-edges.txt`) and its two fixes SHIPPED (session 62,
  `progress/balance-report-038-old-edges-shipped.txt`, `progress/built-deck-ring-004.txt`). Still out:
  Null > Aegis is a partial fix only (real 51.2 shipped decks, 49-51 built, band 55-60; nothing from a full
  collection), its full fix designed into the next set; Cortex > Swarm overshoots the gate (61.6 shipped,
  up to 63.4 built, accepted); Null ~ Cortex real 57.1 on the ring's seeds ("not sure", owner OK'd).
- ~~**Null Out's text vs the engine's health floor (session 62).**~~ Text fixed session 63 (owner: "it can't take
  health below 1", on Null Out and Deprecated Routine). Kept for the lesson: Max health floors at 1
  (`state/queries.ts`), so "-3/-3 permanently" never kills an undamaged unit (a 3/3 ends 0/1). Pinned by
  tests and raised with the owner, but the printed text still reads like a kill to a spectator or a
  commentator, and agents that read text (an LLM agent later) could misjudge it. Session 61's candidate note
  claimed a kill: that note was never checked in a whitebox test before the owner saw it. Lesson: test a
  candidate's claimed effect, not just its win rate.
- **Instant modal Commands are new territory (session 62).** Force Quit and Null Pointer are the first modal
  cards cast as responses. The render's stack snapshot names a Command by card name while the engine's
  resolve names the mode; the feed handles it by stack id, and a render test did not until this session.
  Other render code that matches on stack descriptions (castFx) was only checked by the existing tests
  passing, not by a dedicated test of a modal response.
- **Kill All is castable into an empty board** (scope "all" needs no target). The lookahead agent passes on
  it (tested), but a weaker agent can waste 2 energy; same as every other board-wide card, not a new rule.

## Session 78 (the demo check in CI; "Time's up"; the Stats page's data, schema v24): what is still thin

- **Matches recorded before v24 have no faction, for good.** Decks are rebuilt in place (same deck id, new cards),
  so today's deck can't say what an old match played, and I didn't guess. They count as `factionNotRecorded`. Season
  0 hasn't started, so the only such matches are the house's test data, but the field stays on the API forever. The
  versioned replay files (`ai-tcg-replay/2`) do carry every deck card, so a one-off repair could backfill from them
  (the write-once trigger allows null -> value); not built.
- **`GET /api/stats` counts the whole history on every read.** One SQL query per call (plus one for the rated
  points), then counted in memory. An owner on auto-play all day is ~60 matches a day, so a season is a few
  thousand rows: fine for Season 0, not for launch. Before launch: running tallies, or a per-owner cache until its
  next match. Written in `server/OWNER_API.md`'s "Not built yet".
- **The chart is one point per Sydney day.** It shows the end-of-day rating, not every match; a day with 60 matches
  is one dot. `GET /api/rating?recent=100` still has per-match points if the render wants an intraday line. RD isn't
  on the chart's days (only `now.rd`): drawing a confidence band per day would need the idle-day RD growth worked
  out per day; not asked for.
- **The rating is the owner's under every agent filter.** That is the data model (one rating per owner), and the
  page says so, but an owner switching agents can't see "this agent's rating". Call 1 at the check-in.
- **Quests and achievements** (on the 2026-10-05 Stats page) are not built: they are after Season 0 with the weekly
  challenge and daily quests.
- **The demo check in CI runs on 2 cores** there, not the 4 measured locally (35 s). The CI run time on PR #139 is
  the real number; session 78 couldn't wait for that run to finish, so session 79 reads it and writes it down.
- **"Time's up" is a label beside the wire value, not a rename of it.** `allowance.state` is still `"done"` (the render
  lane's ring reads it); `allowance.label` is the owner-facing text. The render lane's own strings ("Done for today"
  in `siteAgent.ts` and its tests) are the render lane's to change, as the owner said.
- **Schema bumps still rewrite demo files for one line:** 9 this time, plus `economy-demo-011` (slow, already stale
  at "v21", i.e. since session 73: the slow set isn't in CI and no session since ran it). Every diff
  read: the schema line only. The slow three were run this session: 014 and 016 reproduce; 011 only had that line.

## Session 77 (the auto-merge test-run guard; notifications, schema v23): what is still thin

- **The auto-merge guard is tested against a fake GitHub, not a real missing check.** `server/test/autoMergeWorkflow.test.ts`
  runs the shipped script text: no check runs at all (the PR #137 case), other checks green but no `test`, a check
  whose name only contains "test", a skipped or neutral `test` run: each waits the full 12 minutes, then fails
  (6 new tests, all failing on the old workflow). This PR's own merge exercises the green path for real; the
  missing-check path has only run in the test. **The guard names the check `test` exactly** (test.yml's job id): if
  that job is renamed, every PR waits 12 minutes and fails with "no test run for this commit". Said in the
  workflow's comment.
- **The daily pack notification is written when the owner looks, not at midnight.** Nothing runs at midnight, so
  the first `GET /api/notifications` of the day with a pack waiting writes it (its `readySince` is still midnight).
  The bell polls, so in practice the owner sees it at once; but a GET that writes is unusual, and an owner who never
  opens the site has no row for that day. Fine for the bell; would matter for email/push, which Season 0 hasn't got.
- **No push, no retention.** The website polls `GET /api/notifications?limit=1`. Nothing is ever pruned: an owner on
  auto-play all day gets about 60 match results a day (10 rewarded wins plus losses at watch speed). A retention
  rule (e.g. drop cleared ones past 30 days) is needed before launch scale; not now.
- **Big pulls are the owner's own openings.** In Season 0 only the owner opens a player owner's packs (house owners
  open their own and are told nothing), so a big pull notification records what the owner just watched in the
  ceremony. It is useful as the feed's record and across devices, but adds little in the moment. A call at
  notes-for-owner.md.
- **Every outcome is a match result, a cancel included.** A cancel pays nothing and isn't rated; the owner is told
  anyway. A call at notes-for-owner.md (the alternative: wins, losses and draws only).
- **Turning a switch back on fills nothing in.** Off means not written, so the feed has a gap for that time. The
  alternative (always write, filter on read) would let the switch hide and show history. A call.
- **The notification text is data, not words.** Each kind carries the fields (result, credits, rating change, the
  big cards, the allowance's minutes); the wording is the render lane's. `progress/notifications-001.txt` shows
  one wording.
- **The demo's ladder log prints Ada's "auto-play off" before her last match's "recorded" line** (10:31:05): the
  ladder's event callback runs before `onRecorded`. The notifications themselves are in the right order (the match
  #6, then the stop #7). Only the demo's printing.
- **The render lane has no bell yet.** `render/src/site/siteApi.ts` doesn't know the endpoints; the bell, the
  Notifications widget and the three switches in Settings are render work.
- **Schema bumps still rewrite demo files for one line:** 9 this time (`npm run demos -- --write`, every diff read:
  the schema line, and the account settings' unknown-field message now listing `notifications`).

## Session 76 (the play-time allowance, schema v22): what is still thin

- **Time spent waiting for a round counts against the allowance.** The clock runs on wall time from the start.
  Rounds wait for every match in them to end (plus a 60 s gap on the real server), so an agent that finished early
  sits idle on its own minutes: in `progress/play-time-001.txt` Ada's 30 minutes held 3 matches, with about 4
  minutes spent waiting between them. The rolling queue (roadmap, after Season 0) would fix this. Until then, a
  15-minute allowance can hold as few as 1-2 matches. Raised at the check-in in notes-for-owner.md; not measured
  across seeds.
- **"Finishing" depends on where the clock falls.** If time runs out between rounds, the state goes straight from
  running to done, with no finishing. This is correct, and the demo's first draft (15 / 30 + 15) showed exactly
  that for both owners, but it means the render's "Finishing match" ring only shows when time runs out mid-match.
  Both paths are tested (`server/test/playTimeAllowance.test.ts`); the demo now uses minutes that show finishing.
- **Reads that change state with the clock.** `autoPlay()` works out "done" (and `on: false`) from the clock
  before the server writes the stop, so the row and the read can disagree for up to a round. They agree by test,
  but a hand-run `sqlite3` read of `auto_play` would show `is_on = 1` for a done owner until the next round.
- ~~**No push when time is up.**~~ Done session 77: the time up is an `autoPlayStopped` notification with
  `reason: "timeUp"` (polled, not pushed).
- **The house is untouched** (house owners always play, no allowance), and a network agent's time works the same
  way as an in-process one's. Only in-process agents have been run on it.
- **Schema bumps still rewrite demo files for one line:** 8 this time (`npm run demos -- --write`, every diff read:
  schema line only).

## Session 75 (hardening: the auto-merge retry; the demo drift check): what was raised, and what is still thin

- **Raised: the auto-merge job no longer fails on one GitHub server error** (owner 2026-11-06). The wait step
  retries 5xx, 429 and a rate-limit 403 four times (5/10/20/40 s, about 75 s at worst), then fails. Still thin:
  only the check-runs listing retries; the Merge step itself (`pulls.merge`) fails on its first 5xx, as before
  (the owner OK'd the wait step only). A real 403 for another reason (permissions) is not retried, by design. The
  test runs the script text out of the YAML with a fake client; it can't catch a change in `actions/github-script`
  itself (the error's `status`/`response.headers` shape is Octokit's, read from its docs, not from a live 500).
- **Raised: demos drift silently (sessions 64, 65, 70, 71).** `progress/demos.json` lists the 24 committed demo
  outputs that their scripts are meant to reproduce (and the 4 measurement records that aren't); `npm run demos`
  re-runs the fast ones (`-- --all` the slow ones, `-- --write` rewrites) and diffs each, leaving out the
  `[timing, varies per run]` lines; `server/test/demoManifest.test.ts` fails if a dev script names a committed
  output that is on neither list. Found on its first run: **16 of 24 were stale**: 7 only in the schema line
  (v20 -> v21, the 2x vote's migration, session 73); 2 in what session 73-74 added (the settings list now names
  `ask2xEveryMatch`; the store lists the two coins on sale); and 7 played matches under rules-1 and were never
  re-run after session 71 (economy-demo-003 (last run in session 30: schema v3, a 36-card Null), 012, 013, 014,
  015, 016, and owner-api-demo-002's builder win rates). All regenerated and read; no crash, no FAIL line, every change explained by v21 or rules-2.
  owner-api-demo-002 was run twice to confirm it is deterministic apart from its timing lines.
- **Still thin: the check isn't in CI.** It takes about 1.5 minutes for the fast set on 4 cores (the slow three:
  011 about 2 min, 014 under 1, 016 about 7). Adding it to `test.yml` is an owner call (notes-for-owner.md); until
  then a session that changes rules, cards or the schema must run `npm run demos` itself.
- **Still thin: only economy and server demos are listed.** The engine's sample matches, balance reports and
  rings, and the render lane's evidence, are records by design (the ring has its own CI check). Every schema bump
  still rewrites ~10 files for one line; a `<schema>` placeholder like `<temp>` would cut that noise, not done.
- **Two style tests with tiny samples (session 71)** and **the hands safety rule (session 72)** stand, untouched.

## Session 74 (featured picks and viewer counts): what is still thin

- **"Top rated" isn't selective in a small league.** With no rating floor, a round of five matches features three
  of them; in `progress/featured-viewers-001.txt` two of the three picks have a Bronze side (1167, 1301). With a
  handful of in-house owners nearly every placed match is "top". A Gold floor (`featured.minRating: 1500`, built,
  off) would feature one match that round. Owner call in notes-for-owner.md; the right answer probably changes
  with league size, and nothing measures how often the group is empty under either rule.
- **The first rounds of a season feature nothing.** Every owner starts in placement (5 rated matches), so for
  the first five rounds (about 35 minutes of a fresh season) "Top rated" is empty while matches are live. The
  page has `matches` to show; the group alone is empty. Part of the same owner call.
- **The Tournament group is a fixed empty list.** No tournaments in Season 0, so it is never filled; when
  tournaments come it needs its own rule (the finale, the bracket), not just a list.
- **A viewer is a signed-in owner reading the feed.** Nothing counts a signed-out spectator (there are none in
  Season 0), an owner glancing at the list, or a widget that only shows the list. If the render lane's Watch live
  widget at L plays the match from the list rather than the feed, its viewers aren't counted (OWNER_API.md says
  to read the feed). The site host's arena page reads the feed with the owner's token, so it counts.
- **The count lives in memory and is computed on read.** No history of viewers per match (no peak, no average)
  is kept on the match record; a restart loses it (and cancels the match anyway). Pruning happens on read, so a
  match nobody lists keeps its last readers until it is recorded (bounded by the match, not a leak).
- **House accounts can sign in and watch, and count.** The demo has a house owner watching its own match; a real
  house account has nobody behind it, so it won't in practice, but nothing stops an admin signed in as one.
- **The render doesn't read `featured` or `viewers` yet** (the render lane's Watch live and ticker slices).

## Session 73 (the 2× vote): what is still thin

- **2× makes the watching faster, not the ladder.** A round still waits for its slowest match plus 60 s, so an
  owner whose 2× match ends early sits idle until the round's other matches end. A 2× vote doesn't get an owner
  more matches in a day; it only shortens the wait to see the result. A rolling queue (pair whoever is free)
  would turn the vote into more play; it changes the matchmaker's round model. Raised as a call to the owner.
  **Owner 2026-11-04: keep for Season 0; the rolling queue comes after Season 0 and before the public launch, as
  its own proposal (on the roadmap). Stays here until it is done.**
- **The house side's agreement is a proposal, not a decision.** A house side agrees to whatever its player
  opponent asks; house against house is always 1×. Without that, player-against-house (most Season 0 matches)
  could never run at 2×. Owner call in notes-for-owner.md.
- **Nobody is told an ask happened.** The other owner learns of it only from the next poll of the live feed
  (`speed.waitingOn`). Notifications aren't built; fine while the site polls every second, thin for a widget.
- **The vote lives in memory with the live match.** A restart cancels the match anyway, so nothing is lost
  that would matter, but no record says a match was shown at 2× (the match record, log and replay are the
  same at any pace, by design and by test).
- **No rate limit on the PUT.** An owner flipping the ask many times a second only rescales the hold each time
  (harmless, tested to round to the millisecond), but nothing stops the traffic.
- **The render lane doesn't read `speed` yet:** its animations still run at 1× even when the feed releases at
  2×, and its site types have no `speed` or `ask2xEveryMatch`; the Live match widget still says "The 2× vote
  comes with its endpoint." The render lane's side to pick up.
- **Still open from session 72:** the hands safety rule (enforced in code before any real-time network seat),
  draw events naming cards by name; from session 71: the Null builder session before the launch-gate re-run.

## Session 72 (the live-feed asks: opening hands, the signature card, the faction, the boast): what is still thin

- **The hands safety rule isn't enforced by anything yet.** `openingHands` is sent for every match the
  `LiveLadder` shows, which is right today (it plays each match to the end in the engine before releasing the
  first move). But no flag marks a match as "decided before it is shown": the rule lives in a comment and in
  OWNER_API.md. When network agents join the ladder in real time, that path must leave `openingHands` out and
  strip the card from draw events until the match ends, and a test must prove it. Don't add a real-time seat
  without building it.
- **Draw events name the card by name, the opening hands by card id.** A spectator rebuilding a hand maps one to
  the other (the demo and the test use the deck's cards). Two cards with the same name in one deck would be
  ambiguous; none exist today (names are unique in the registry, and a signature card never goes to the hand),
  but nothing checks it for a live feed. Adding `cardId` to the `draw` event would remove the mapping; it is an
  engine event change, so it needs the replay goldens checked. Not done; ask the render lane if it wants it.
- **`rulesText` is ability text only.** A keyword-only signature card (Tapemancer's Radio Tower: Barrier) sends
  `rulesText: []`; the render must draw its keywords. Documented, not "fixed".
- **The live boast is worked out once, when the match is first shown,** from the loadouts and deck the match
  started with. The store refuses loadout changes during a live match, so it can't drift from the record's,
  and a test and the demo compare them over every match. A catalogue change or a season reset mid-match isn't
  covered (neither happens mid-match today).
- **The render lane's types (`render/src/site/siteApi.ts`) still describe the old `signature: { name, played }`**
  and have no `faction`, `openingHands` or live `boast`. That is the render lane's side to pick up; the fields are
  additive, so nothing it reads broke.
- **Still open from session 71:** the full-collection Null deck pick (measured session 79 with `keepDesigned`, test
  only, at an owner check-in; the store still picks the old deck); the economy demos, older owner-API demos and the render's committed
  samples record rules-1 matches. Watch time 6.7 min is now accepted (owner 2026-11-03: 6-7 minutes is the target).

## Session 85 (the season switch made safe; no schema change): what was raised, and what is still thin

- **Raised: the archive is never written by `startNextSeason`** (session 83's "integrity of the read"). Opened
  read-only; an older-schema archive is migrated as a temporary copy. Tested on a v27 archive and on one with an
  unflushed `-wal` (both fail on the old code).
- **Raised: a mistyped name no longer makes a file**, in `season:next` (the ended file) or in the servers (needs `--new`).
- **Raised: the server refuses the ended file after the switch** unless `--archive`.
- **Still thin: a read-only reader can leave an empty `-wal` and `-shm` beside the archive.** SQLite makes them to read
  a WAL file; they hold nothing (the test checks the `-wal` is 0 bytes) and the main file is unchanged. Deleting them
  afterwards was left out: if a server were still running on the archive, deleting its log would corrupt it.
- **Still thin: nothing stops `season:next` while a server still runs on the ended file.** The docs say stop it
  first. A running server can still write settings, renames and sign-ins to the archive; those writes after the new
  file is made don't reach it (same as session 83's note). A lock file per season file would catch it; not built.
- **`--new` changes the very first start.** Any setup note that says `npm run season -- <file>` for a new file now
  needs `--new`. Only `server/OWNER_API.md` describes the start; updated there. The owner's Mac mini steps (clean-up,
  2-4 Dec) must say it.
- **The switch is still four steps by hand** (end, wait, `season:next`, restart on the new file). As the owner set; a
  one-command flow is in `progress/season-1-ideas.md`.
- **The demo checks hashes printed as varying lines.** Each run builds new files (random ids, times), so the hash
  lines are left out of the drift diff; the "before = after" check lines are what CI compares.

## Session 84 (marketplace groundwork: the transfer record, schema v28): what is still thin

- **The rules are tested only by raw SQL.** No store method writes a transfer, by design (no marketplace yet), so
  `copy_transfers` is exercised only by tests and the demo inserting rows by hand. The marketplace session must add
  the store call (transfer + ledger rows + owner change in one transaction) and test it end to end.
- **A transfer row and its owner change are two statements.** The schema requires the owner change to match the
  latest transfer, and refuses a new transfer until the last one is applied. But a transfer row written with no
  owner change after it leaves the copy "transfer pending" (stuck until someone applies it). The future store call
  must do both in one transaction. A single trigger that applied the move itself was considered, but left out so
  the owner change stays an explicit, checked write.
- **Provenance across season files isn't built.** The Season 1 carry-over (owner 2026-11-10, after launch) must
  copy each copy's row with the same id and its transfer rows. A pack copy's `pack:` ref will then point at a pack
  that lives in the archive, not the new file, so `copyProvenance` there will need to read the archive (or the
  carry must bring the pack and opening rows too). Noted on the checklist.
- **Funding (earned vs purchased credits) isn't on the copy.** It can be worked out for Season 0 (purchasing is off,
  so every credit is earned). It becomes a real day-one gap the day purchased credits switch on.
- **Cosmetics have no per-item copy id** (one row per owner and item). They are bound and never sold, so nothing is
  lost, but selling cosmetics would need a rebuild of `owned_cosmetics`.
- **Message order of overlapping triggers.** Some raw edits break two rules at once. SQLite fires the newest
  trigger first, so the newest message wins. v28 limits its triggers so the older v2/v5 messages stay for bound
  copies and signature refs (the existing tests pin them). A test that asserts one message on an edit that breaks
  two rules can still pick up the other; one assertion in the new tests accepts either.
- **No endpoint shows a copy's history.** `copyProvenance` is a store call only. The card viewer doesn't show
  "pulled from your daily pack on ..." (not in the locked scope).

## Session 83 (the season's end, part 2: the next season's file; schema v27): what is still thin

- **Switching to the new season needs a restart.** (Session 85: the restart is now checked: the server refuses the
  ended file without `--archive` and a missing file without `--new`.) `startNextSeason` is a store call and a CLI
  (`npm run season:next`); the running server keeps its file. The admin stops `npm run season`, runs the CLI, and
  starts it on the new file. No endpoint, no website button, no "next season" step after `POST
  /api/admin/season/end`. Fine in-house; a one-command flow (end, drain, make, restart) would be safer.
- **No Prototype can be found in Season 1 until a Season 1 set exists.** S1 sells the newest set (S0), and every
  S0 run is retired, so the pack's 1-in-1,000 Prototype slot is always the fallback Gold. Correct by the rules
  ("retired forever"), but nobody has decided it. Flagged in notes-for-owner.md.
- **Season 1 has no tier coins** in the catalogue, so ending Season 1 grants none (unchanged from session 69's
  note; it waits for Season 1's catalogue).
- **The demo's archive has no generated agents.** season-end-001 makes agents plainly (no signature card), so
  `season-next-001` shows 0 signature copies carried; the carry of a generated agent's card and bound copy is
  proved only in `economy/test/nextSeason.test.ts`.
- **Sessions carry.** A signed-in owner stays signed in across the switch (until the session expires, 30 days
  from sign-in). In the demo every session had expired by then (0 carried). A call in notes-for-owner.md.
- **Auto-play starts off** in the new file (it isn't on the "carries" list, and its allowance window belongs to
  the old season's days). Player owners must switch it on again; house agents play regardless. A call.
- **A seed doesn't age.** An owner's seed keeps RD 250 until its first rated match however long it waits; the
  `idle` RD growth starts only from a stored rating. Owners with no rated match last season start at 1500 / RD 350.
- **The archive still allows non-economy writes:** saving decks, free renames, settings, the board and generating
  an agent (its signature copy is the one copy the schema still allows). None of them reach the new file once it
  is made; an agent made in the archive after the new file is made is simply not in the new season.
- **No "a new season has started" notification** (the notification kinds are a fixed list; the website can read
  `GET /api/season`'s `startedFrom`).
- ~~**Integrity of the read:**~~ Fixed session 85 (read-only open; an older archive is migrated as a temp copy). the ended file is attached read-only (`mode=ro`) and the demo checks its bytes are
  unchanged, but `startNextSeason` first opens it through `EconomyStore.open`, which would migrate an older
  archive (v26 -> v27) in place. That is a schema write to the archive (no row changes); a pure read-only path
  would need the migration to run on a copy.

## Session 82 (the season's end, part 1: tier coins, final standings, retired Prototype runs; schema v26): what is still thin

- ~~**Only half of season end exists.**~~ Part 2 built session 83 (`startNextSeason`, v27). A season can end, and its file becomes a sealed archive. There is no next
  season yet: nothing creates the Season 1 file, carries accounts, agents, signature cards and cosmetics into it,
  or soft-resets ratings. Ending Season 0 today would leave the ladder stopped with nowhere to go. Part 2 waits on
  the owner check-in in notes-for-owner.md.
- ~~**The retired list lives only in the ended file.**~~ Carried into the new file since session 83 (tested: the S0 Prototype seed rolls a Gold in S1). An S0 pack opened in a Season 1 file would see full S0 runs
  (its own `card_copies` has none of them) and could mint S0 Prototypes again, with serials that clash with the
  archive's. Part 2 must copy `retired_prototype_runs` into the new file (or treat every run of an earlier season's
  set as retired). Not reachable today: nothing makes a Season 1 file yet.
- ~~**Only matches and ratings are frozen.**~~ The whole economy is frozen since session 83 (owner answer 6). After the end, packs still open, salvage and crafting still work, and
  credits can still be spent in the archive. The collection and currencies reset with the new file anyway, so this
  matters only between the end and the new file. Whether the archive should refuse everything is call 6 at the
  check-in.
- **Ending is manual.** The admin's POST (or a script calling `endSeason`) ends it; nothing ends Season 0 on a
  date. The website has no button yet (the render lane's admin view); today it is a `curl` with an admin token.
- **"Ending" is held in memory.** If the server restarts while the ladder drains, the flag is lost: on restart the
  shown matches are cancelled (as for any restart) and the ladder starts pairing again. The admin has to ask again.
- **The standings keep owners with rated matches only.** An owner who never played isn't in the archive's list
  (they had no tier and earned no coin). Abandons count in `ratedMatches` but not in W-L-D, as on the live ladder.
- **The tier is read with RD grown to the end's moment** (the same `rating(at)` the live ladder uses). An owner idle
  for weeks still has their mean, so their tier and coins are unaffected; only RD differs from their last match.

## Session 81 (hardening: the CI demo flake; whole demo errors; the rebuild burst measured): what was raised, and what is still thin

- **Raised:** the `ladder-demo-002-live` CI flake is fixed at its cause class (a reused keep-alive socket reset under
  a blocked loop) for all 13 API demos, not just the one that failed. 0/3 -> 3/3 under load. The demo runner prints
  whole errors. The rebuild burst is measured (`progress/ladder-stall-001.txt`): it queues and the API stays
  responsive.
- **The retry hides the stall it works around.** demoFetch logs each retry on stderr, but the runner shows stderr
  only for a failed demo, so a demo that starts needing retries every run would go unnoticed. Counting retries in
  the runner's summary would make that visible.
- **The demos' blocked loop is the demos' own setup** (deck builds on the main thread for determinism). Production
  builds on workers, so the site doesn't see an 11 s stall. Its only main-thread block is playing a round's
  matches: about 17 ms per match, measured with house agents only, up to 48 owners. Hundreds of owners, or slower
  play styles, are not measured. It reaches 1 s near 120 matches per round: re-check before the public launch.
- **The stall column misses one-block phases** (the timer reports after the block ends). The matches phase is
  bounded by its wall time instead (0.4 s at 48). A real event-loop histogram (`monitorEventLoopDelay`) would be
  more exact.
- **The burst's wait is real:** 172 s for 48 decks on 3 workers before the first round after a rule change pairs.
  Fine for Season 0 (house owners plus test players). Spreading rebuilds across rounds (rebuild a few, play the
  rest on their old decks) would cap it if a later margin change meets a big population.
- **The `sha` pin still has no live two-commit run.** #141 had several commits, but `pull_request_target` runs
  main's workflow, which didn't have the pin yet. The next PR that gets a second push is the first real test.
- **The owner's re-run order matters, and nothing says so:** re-running the auto-merge job before `test` (as on
  #141) fails it on the stale result. Re-run `test` first, then the auto-merge.

## Session 80 (the auto-merge pins the tested commit; the builder rule on at 1 SD, schema v25; the launch-gate re-run): what is still thin

- **The auto-merge fix is tested against a fake GitHub, not GitHub.** The 409 on a moved head is GitHub's
  documented answer to `sha`, and the test's fake gives exactly that. A real two-commit PR has not run through it
  yet. This session's own PR is opened once, with no later push, so it won't show the case either. The first real
  check is the next PR that gets a second commit; read its two auto-merge jobs then. The `concurrency` group is
  checked as text in the YAML, not executed.
- **A cancel during the Merge step itself** (the newer job arriving at the very moment the older one merges) is
  covered only by the `sha` pin: a cancel can't make a wrong merge, but it can't stop a right one either. Not tested
  beyond that reasoning.
- ~~**The rule-change rebuild is all at once.**~~ Measured session 81 (`progress/ladder-stall-001.txt`: 3.6 s per deck on 3 workers, API responsive). When v25 reaches a live store, every agent deck asks for a rebuild
  together. The ladder rebuilds between rounds and the server's worker pool caps parallel builds, so it queues
  rather than stalls, but a large population's first round after the deploy will wait on minutes of builds. Fine
  before Season 0 (house owners plus test players); worth knowing for any later margin change.
- **The current rule is the store's default, not the caller's.** `agentDeckRebuildReasons` compares against
  `builderRule()` (the default). A caller that always builds with another `keepDesigned` (only tests and measurement
  scripts do) would be told to rebuild forever. Documented on the function; no production path passes one.
- **keepDesigned is still a workaround** (session 79's note stands): the confirm step scores only against the
  shipped decks. At 17 packs the real-mode ring loses its two IN verdicts (Cortex > Swarm 57.8 -> 58.4, now
  unresolved at the edge; Swarm > Null 58.0 -> 53.6). Null > Aegis stays under its band at every level, as with
  the shipped decks.
- **The ladder demos' matches all changed** with the house decks. That was expected, and all 19 checks pass (10 and 9), but
  nobody reviewed the 72 new match lines one by one. Only the summary and the checks were read.
- **This was not the scheduled hardening pass.** Session 80 was due to be one, but the owner ordered these two items
  first. Both deepen existing work and add no new width. The dedicated hardening pass moves to session 81.

## Session 79 (the test-only Null builder rule; PR #139's CI): what is still thin

- ~~**The auto-merge can merge an untested head (serious, process).**~~ Fixed session 80 (`sha` pinned; see below). The Merge step's `pulls.merge` names no `sha`,
  so a job started for an older commit merges whatever the head is once *its* commit's `test` passes. It happened
  on #139: the merged head's `test` was still running, and passed later. Fix proposed (one line); waits on the
  owner's OK for `auto-merge.yml`. Until then, runs should not push to a PR after opening it.
- ~~**The store's builder still picks the bad full-collection Null deck.**~~ Fixed session 80 (on at 1 SD; 007). `keepDesigned` fixes it in the ring
  (39.2 -> 50-51.5) but is off until the owner picks a margin. `built-deck-ring-005` stays the store's real state.
- **keepDesigned works around the root cause; it doesn't fix it.** The confirm step scores only against the shipped
  decks, so a deck tuned to that field can beat the designed list there and still lose to built decks. Scoring
  against built decks as well would be the real fix: a bigger change, and slower builds.
- **The margin rests on thin evidence.** One collection set, one search seed. The 1 SD vs 2 SD difference at the
  full level is one Cortex deck (net +19 of 143 discordant games), and one full deck's ring swing is several
  points by its seed alone.

## Session 71 (the 24-health rule shipped as rules-2): what is still thin

- **The built-deck ring got worse in real-match mode (serious, launch gate).** 3 edge-levels in band, 7 out (was 5
  and 5; `progress/built-deck-ring-005.txt`). Nearly all of it is the full-collection Null deck: under rules-2 the
  builder keeps a deck that beats the designed list on its confirm step (vs the shipped decks) and loses badly to
  the built Swarm (Swarm > Null 63-69 on three search seeds, `progress/rules-2-ship/null-noise/README.txt`). The
  builder scores against shipped decks only, so it can't see this. Not fixed; at the owner check-in (call 1).
- **Watch time is past the target.** Median 6.7 min on the live ladder (was 5.9; target 5-6), 63% of matches in
  4-7 minutes (was 69%), on a sample of 56. Pacing is DESIGN principle 4. Fix proposed (the watch pace), not made.
- **The first seat still wins 53.6% on the ladder** [51.6-55.6]: outside noise, small. Mirrors 54.4%; Swarm mirrors
  58.7%. Accepted for now by the owner's pick; worth watching once Season 0 has real data.
- **The rule is a constant, not data.** `SECOND_SEAT_EXTRA_HEALTH` is the engine's base and rules-2's field. A
  later rules version that changes it must add a new version and keep rules-1 and rules-2 explicit (they are).
  The test "every version names every field" guards the next field added to `MatchRules`.
- **Committed outputs played under rules-1 now differ from what their scripts print.** Re-run this session:
  ladder-demo-001, -002-live, owner-api-demo-006, -007, replay-versions-001, the ring files, built-deck-ring-005,
  first-seat-003. NOT re-run: the economy demos (005-016), owner-api-demo-002 to -005, the engine's sample
  matches and balance reports, and every render sample under `progress/render/` (the render lane's; they are
  records of rules-1 matches and stay right as records, but regenerating one now plays rules-2). Nothing lists
  which demos play matches; still true.
- **The render lane's `recorded-close-win` scenario was moved** from seed 3 to seed 1 by the game lane
  (`render/src/recordedDemo.ts`), as session 62 did for another scenario. Its committed evidence files under
  `progress/render/evidence/` describe the old seed.
- **Two style tests had tiny samples that tied under the new rule** (deck builder, economy agent deck); their
  confirm steps were raised (6 and 10 games). They pass on a property of a few games and could tie again on the
  next rule or card change; a test on the games' moves rather than their win count would be sturdier.
- **The signature-mode report** (not a CI check) moves Aegis > Cortex further out, 72.4 -> 75.8.
- **Measuring files written before session 71 that leave out `secondSeatExtraHealth` are refused** (they'd be
  ambiguous now). None exist outside tests: the ladder never writes a measuring replay to disk.

## Session 70 (hardening: versioned replays; the drifted demos): what is still thin

- **The engine's own code is versioned only by the golden replays.** Cards travel in an `/2` file and rules
  versions name the start of a match, but a change to how the engine resolves something (combat, the stack, a
  trigger's timing) isn't data: nothing stops it from changing an old match except
  `server/test/fixtures/replays/` failing. Four golden files (two per format, 78-109 moves each, all four
  factions, one signature card) are a thin net: a change to a mechanic none of them uses would pass. More,
  varied golden files (a Zero-Day card, telegraph, evolution, tools, a draw, the turn cap) would widen it; a
  replay of every ladder match on the Mac mini before a deploy would be the real check.
- **When a rules change must keep old behaviour, the engine has to keep both.** Session 71: `rules-1` is now
  explicit (`{ secondSeatExtraHealth: 0 }`) and `rules-2` shipped as the base. A later engine fix that changes play
  will need a flag in `MatchRules` for the old way, kept forever. That is the price of rebuildable replays; it
  isn't paid yet because nothing has changed.
- **An `/2` file is ~5x an `/1` file** (23-28 KB against 5 KB: about 49 card definitions in full). Fine for
  Season 0; at launch scale a shared card table per version (the file naming `cards-N` and only carrying
  cards that differ) would cut it. Not done: self-contained was the safer first step.
- **`cards-1` is a frozen 46 KB snapshot in the engine**, generated once. It must never be edited; a test checks
  its digest. If the `Card` type gains a required field, the snapshot (and every `/2` file's cards) won't have
  it: card-type changes will need a reader that fills defaults by version.
- **The render reads replays through the server's `replaySetup`** (a small change in `render/src/capture.ts` and
  `render/src/site/siteReplay.ts`, flagged for the render lane): `captureMatch` takes the file's rules now. The
  render's own tests only build `/2` files from the ladder; no render test reads an `/1` file through the site
  (the server's tests do, with the same reader).
- **`economy-demo-016` was not re-run** (over 10 minutes, as in session 69). Every other demo touched by
  replays (ladder-demo-002, owner-api-demo-007) changed only in the format line.
- ~~`economy-demo-009.txt` is stale~~ Fixed: its check now says a deck may hold the live Zero-Day card.
- ~~`owner-api-demo-002.txt` no longer matches~~ Fixed: regenerated; the cause was two shipped card changes it
  was never re-run for (sessions 60 and 62; confirmed by running it at each commit). The lesson stands: a card
  change should re-run every demo that prints win rates, and nothing lists which those are.
- ~~**The 24-health rule is still not shipped.**~~ Shipped in session 71 (`rules-2`); the first seat 53.6% on the ladder.

## Session 69 (coin skins, the game lane's half; starting ratings on the match): what is still thin

- **No coin can be seen yet.** Every coin is `drawn: false`: the flip in Match Boot and the coin looks are the
  render lane's two coin slices. Until the first one, the Chrome Token is equipped everywhere and shows nowhere,
  and the two store coins are not on sale (by the "not on sale until drawn" rule). The economy test that ties
  `drawn` to the render's specs only knows boast specs (`BOAST_SPECS`); the render lane's coin slice should add
  its coin specs to that check, or a drawn coin with no spec (or the reverse) will go unnoticed.
- **The tier coins are granted by nothing.** `grantSeasonTierCoins` is built and tested, but the season end it
  belongs to (roadmap item 3) isn't, so in real use no owner holds a tier coin. It reads the tier from the
  rating at the moment it runs (RD growth for idle days doesn't move the rating, so a quiet last week doesn't
  cost a tier), and it must run BEFORE the reset clears the ratings: the season-end work has to call it first.
- **Tier coins are per season by id** (`coin-s0-platinum` ...). The owner said "a coin for each tier reached by
  the end of the season", which I read as each season having its own; Season 1's coins aren't in the catalogue,
  so a Season 1 season end would grant nothing (tested). Flagged at the check-in.
- **The game lane touched the render lane's picker** (`render/src/site/siteLoadout.ts`, `render/src/loadoutDemo.ts`,
  two render tests, and a type in `loadoutPicker.ts`): the picker built its slots from the economy's
  `LOADOUT_SLOTS`, which now has six, and had no label for "coin". It now leaves the coin slot out until the
  render lane's second coin slice adds the "Coin" line. A small guard, not the coin line itself; flagged in the
  log for the render lane.
- **An owner without a starter collection has no Chrome Token** (as with the starter boasts). Every real owner
  gets the starter collection at sign-up, so this only shows in tests, but an empty coin slot is a legal state
  that the website must draw as the Chrome Token (`coinOf`), not as "no coin".
- **`ratingsAtStart` is the rating as the match started; a cancel keeps it too, but matches recorded before v20
  have none.** The match view falls back to the ratings' "before" (the same number, since a rating only moves
  when a match ends) and to null for an older cancel, so `defaultView` is p1 there. The live view's `rating`
  now reads the stored starting rating (the same number it computed before).
- ~~**Replays carry `coins` inside format `ai-tcg-replay/1`**~~ Session 70: replays are `ai-tcg-replay/2`, versioned;
  `coins` stays optional (absent in old `/1` files).
- **The coin doesn't reach the engine at all** (tested: one seed, two coins, the same match, credits and
  rating). The flip's result the render shows must come from the record's p1 (who went first); nothing in the
  API says "won the flip" separately, since the seat is the flip.
- ~~**`economy-demo-009.txt` is stale**~~ Fixed in session 70.
- ~~**Still queued from the owner's render-50 entry, not built:** featured picks and viewer counts~~ Built
  session 74 (the 2x vote: session 73).

## Session 68 (the first-seat fixes measured; the small collection and deck asks): what is still thin

- ~~**The first seat still wins about 65% in every match the game plays (serious, balance).**~~ Fixed session 71 (rules-2: 53.6% on the ladder). Session 68 measured
  the owner's four fixes and five extras (`progress/first-seat-002-fixes.txt`); none ships until the owner
  picks one, and versioned replays (below) must land first. Until then the debt above stands unchanged.
- **The measurements use one agent.** Mirrors and the ring use the LookaheadAgent; the ladder run uses the
  house's six play styles. A different agent (a model-backed one) may value an extra card, energy or health
  differently, so a fix that reads 52% here could read differently against real agents. Re-measure once
  network agents play the ladder.
- **The seat variants are test-only code in the engine** (`MatchRules`, `state.rules`, three small checks in
  `init.ts`, `engine.ts`, `moves.ts`). When a fix ships it should become the printed rule (a constant), and the
  variants that lost should be removed, not left as dead options. `SEAT_VARIANTS` is exported from the engine's
  barrel only so the server's ladder instrument can name them.
- **24 health makes matches about one turn longer** (median 15.5 against 14.5 in the mirrors). The watch-time
  distribution of the live ladder hasn't been re-measured under it.
- **The ladder split per variant is unpaired.** The ladder's pairings and rebuilds drift apart as results
  differ, so two variants' ladder rows aren't the same matches (the mirrors are). Each row is 2,400 matches, so
  the interval is about +/-2 points; differences smaller than that between variants mean nothing.
- ~~**Versioned replays are not built (owner call 6).**~~ Built, session 70 (`ai-tcg-replay/2`).
- **"Watch again" has nothing for packs opened before schema v19** (410). Only house/test data predates it, but
  the website should say "this opening can't be replayed" for a 410, not fail.
- **The reveal is stored as JSON**, a copy of what was answered: if `OpenedCard` gains a field later, old reveals
  won't have it. The website should treat missing fields as absent.
- **Earned promos: the list is built, the issuing is not.** Season 0 issues no milestone, quest or tournament
  promos yet, so `promos.earned` is always empty in real use; only the test grants one by hand.
- **`DeckStatus.faction` is worked out from the card ids on every call**, and `list` reads the deck's listing a
  second time (`deckStatus` already resolves it once). Fine at Season 0 size.
- ~~**The coin skins are only planned** (owner check-in); nothing is built.~~ Built, session 69 (game half).

## Session 67 (the long-lived ladder, Watch live, auto-play, match history): what is still thin

- ~~**The first seat wins about 65% (serious, balance).**~~ Fixed session 71 (rules-2). Measured this session at the owner's
  ask: 1,554 of 2,400 ladder matches (95% interval 62.8-66.7%), stable over time, in every faction pairing but
  one, and 58-72% in shipped-deck mirrors with the same agent both sides (`progress/first-seat-001.txt`). It is
  the game's, not the ladder's. Every balance number so far alternated seats, so it was averaged away; the
  balance report's "first-player-advantage baseline" mirror lines alternated seats too and never measured it
  (relabelled this session). A 65/35 seat is a coin flip deciding a third of a match's edge, on screen, every
  match. Not changed here: a fix is a rules change (what the second player gets) and goes to the owner first
  (notes-for-owner.md), then measure-then-fix like every balance change.
- **Watch speed is one fixed pace per move kind** (6 s an action, 1 s a pass, 3 s a new turn, 8 s the result).
  It isn't the render's animation time: a big turn of many moves and a quiet one get the same seconds per move,
  and the render lane hasn't timed its animations against it. The median lands at 5.9 minutes, but the
  10th-90th spread is 4.2-8.3 and the longest 10.5 (19 of 61 outside 4-7 minutes). Pacing by event (an attack
  that kills holds longer than a pass that resolves nothing) would be better; needs the render lane's timings.
- ~~**No 2x vote.**~~ Built session 73 (`speedVote.ts`, `PUT /api/live/:id/speed`).
- **A round waits for its slowest match.** Owners whose match ended sit idle until the round's last match ends
  plus 60 s. Simple and fair, but with a 10-minute match in a round the others wait several minutes. A rolling
  queue (pair whoever is free) would keep owners busier; it changes the matchmaker's round model.
- **Live state is in memory only.** A restart cancels the matches being shown (no credits, no rating), by
  design (notes-for-owner.md); an owner whose agent was winning loses that match's pay. Rebuilding them from
  the seed works for in-process agents only.
- **The engine plays the whole match before the first move is shown.** Right for in-process agents (and it is
  why watching can never feed back into a match). A network agent can't play a match in under a second: when
  network agents join the ladder, their matches will have to be shown as they are played, with the pace as a
  floor, not a replay. Not designed yet.
- **`GET /api/matches` pages the owner's whole history in memory**, and `GET /api/live/:id` copies every
  released step from `from` on. Fine for Season 0's handful of owners; both need SQL paging / a size cap before
  launch scale.
- **Logs and replays live in a directory beside the database**, not in it: a backup of the `.db` alone loses
  them, and nothing cleans them up. Each replay is about 20-40 KB.
- ~~**A replay needs this engine's cards.**~~ Session 70: an `/2` file carries its cards, an `/1` file reads the
  frozen `cards-1`. (The demo found it was worse than this said: read against changed cards, an old file's
  moves can stay legal and play on to a different match, with nothing to say so.)
- **Abandoned matches have a log but no replay**, and the live feed of an abandoned match ends where the seat
  walked out without saying so in the snapshot (the record's note says it). The render will need a line for it.
- ~~**`owner-api-demo-002.txt` no longer matches a fresh run**~~ Fixed in session 70 (two card changes it missed).
- **Session 66's items stand**, less the three this session closed (auto-play, the timer, the house policy):
  no network agents on the ladder, the season reset, raw-SQL deletable `ratings`, rebuilds inside a round.

## Session 66 (match running and the ladder): what is still thin

- **Only in-process house agents play on the ladder.** The `AgentSeater` seam exists, but nothing seats a
  network agent (`RemoteAgent`) yet: the WebSocket server (`server/src/server.ts`) is still the stage-2
  one-match server on fixed test decks. Wiring connected agents into the ladder (who is connected, a timeout for
  a seat that never answers, reconnects) is real work, not done.
- ~~**No auto-play.**~~ Built session 67 (schema v18).
- ~~**Nothing runs the ladder on a timer.**~~ Built session 67 (`liveLadder.ts`, `npm run season`); the 2x vote
  is still out.
- **An abandoned or cancelled match has no log.** The runner writes a log only for a match the engine finished;
  when a seat faults mid-match the partial game is lost (`runMatch` throws away its state). Replays of
  abandons need `runMatch` to hand back the state on a throw (an engine change) or a log hook.
- **The matchmaker is tuned for 8 agents and unmeasured beyond.** The jitter (75) and rematch penalties
  (300/150) are guesses checked on the demo (18 of 28 pairings in 72 matches, 1 immediate rematch; same-faction
  pairs happen when two owners of one faction sit close in rating). With a large queue the greedy pick is
  O(n^2) per round; fine for Season 0, not measured at scale.
- **The first seat wins more**: 40 of 71 decided in the demo (56%), seats a coin flip. Known from the balance
  work; not the ladder's to fix, but it now lands on ratings.
- ~~**The season soft reset isn't built**~~ Built session 83: a new file per season, with `rating_seeds`.
- **`ratings` rows can be deleted with raw SQL** (only `match_ratings` is write-once). The table is current
  state, replayable from `match_ratings`; no replay tool exists yet beyond the demo's check.
- ~~**The house's pack buying is the demo's policy, not the server's.**~~ The server's policy since session 67
  (owner option (a)).
- **Rebuilds use the store's full search (minutes per owner on a real collection) and happen inside a round**,
  side by side on worker threads in the CLI. A round waits for the slowest rebuild. The demo uses a small search.
- **Session 65's items stand** (demos drift silently, `grantPack("ownerDaily")`, the daily-pack bank read, the
  ledger index, the collection in one response).

## Session 64 (the Home board, the economy endpoints, the Sydney day): what is still thin

- **Several committed economy demos no longer reproduce, and one crashes on main.** DONE session 65 (all eight
  re-run, read, two crashes fixed, regenerated). Was: checked this session:
  `economy-demo-005`, `-006`, `-008`, `-012`, `-013` and `-015` all differ from a fresh run, and the drift
  predates this session (008 still prints "schema v9"; `boastDemo.ts`, demo 012, crashes on main with "no such
  column: deck_choice" after building a v10 file and calling a v12 code path). The Sydney-day change may add to
  some of them. Not regenerated this session (no time to read each diff honestly); with 014/016 this is now a
  named job for the session-65 hardening pass: run each, read the diff, fix the crash, regenerate.
- **The Sydney day is new and changes payouts near midnight.** A match ending between 13:00 and 24:00 UTC
  (summer; 14:00 in winter) now counts on the next day. Tested at the boundary, across both daylight-saving
  days and every day of 2026; no old data needed migrating (Season 0 has no real matches yet). The time zone
  comes from Node's built-in Intl data: a Node built without full ICU would fail (the shipped Node has it).
- **The endpoints are wiring; the website doesn't call them yet.** The render lane builds the pages against
  `server/OWNER_API.md`. No cross-lane test beyond the render tests importing the owner API's source.
- **The collection answer is the whole collection in one response** (every copy). Fine for Season 0 (an owner
  holds a few hundred copies); a heavy collector at launch scale wants paging or a per-set read. Not measured.
- **The ledger pages in memory**: DONE session 65 (`store.ledgerPage`, SQL `LIMIT`/`before`).
- **No owner's daily pack claim.** DONE session 65 (`claimDailyPack`, `/api/packs/daily`). Was: no store method
  or endpoint; the demo grants packs through the store. Not in the owner's list this time; the Daily rewards
  widget has only the earnings bar and the rewarded wins in Season 0.
- **The board doesn't store positions, only order.** The mockup's grid packs widgets in list order (CSS
  auto-flow), so order plus size is the layout. If the render lane wants free placement (gaps, a widget pinned
  to a column), the shape has to grow.
- **The recommended layout's Tournament slot went to Store (Small).** A judgment call, raised at the check-in.
- **`packSeed` is a test hook on the API.** Left out (as the CLI does), every pack draws a random seed; a
  future caller that passed it in production would make packs predictable. Only the demo and no test pass it.
- **The match runner (Season 0 game item 1) is still not started**: credits in the demo and tests come from wins
  recorded through the store. Next game session.

## Session 65 (hardening; the owner's daily pack): what is still thin

- ~~**Demos drift silently.**~~ Raised session 75: `npm run demos` re-runs and diffs every listed demo, and a
  test keeps the list whole. Still not in CI (an owner call); see session 75's section.
- **`grantPack(..., "ownerDaily")` is still open.** Demos and tests grant daily packs directly; those count as
  claims (they empty the bank, never owe). Nothing but the claim should make one in production; the store doesn't
  enforce that.
- **The daily-pack bank reads every daily pack the owner ever had** on each status call (one indexed query plus
  one time-zone conversion per row). A season is a few hundred rows; not measured beyond that.
- **The ledger page sorts in SQL but has no (owner, entry) index**: the `ledger_by_owner` index is
  (owner_id, currency), so SQLite sorts the owner's rows. Fine for Season 0; a migration for the index would
  bump the schema (and every demo's schema line), left for launch-scale storage.
- **The collection answer is still the whole collection in one response** (session 64's item, not done).
- **No "daily pack ready" notification**: notifications wait on match running.
- **Session 64's other items stand** (board order only, `packSeed` test hook, the website not yet calling the
  endpoints). The daily-pack and ledger-paging items there are done.

## Session 63 (who am I, account settings, the wallet): what is still thin

- **The settings are a flat list, not the website's whole Settings page.** Theme, background, sound, music and
  the skip hint, as the owner listed. The mockup's other toggles (haptics, reduce motion, notification
  switches, the 2x vote default) are not stored; reduce motion in particular is an accessibility rule the
  website may want on the account rather than per browser. Added when the render lane asks, not guessed.
- **The website doesn't use them yet.** The render lane builds against `server/OWNER_API.md`; until it does,
  the theme still isn't saved and the skip hint still shows until the first skip on each page. Nothing tests
  the two lanes together beyond the render tests importing the owner API's source.
- **The wallet is read-only.** (Session 64: buying and opening packs and the ledger are now endpoints.)
- **No concurrency test for PATCH.** Two simultaneous patches each read-then-write inside one store transaction
  (SQLite serialises them, and node:sqlite is synchronous on one thread), so the last one wins field by field
  as applied; not exercised by a test with two servers on one file.
- **`whoAmI` returns the email** to its own owner. Fine for the account page; if a later view shows another
  owner's "who", it must not reuse this shape.
- **The match runner (Season 0 game item 1) is still not started**: the credits in the demo come from wins
  recorded by hand through the store.
- **Still owed:** economy demos 014/016 not re-run since option B, set A and NA12/CS7. The next hardening pass is
  session 65 (60 was the last).

## Session 61 (the balance session, job 2: the two old edges): what is still thin

- **Neither edge is fixed cleanly.** Null > Aegis's best candidate (NA12) closes about half the real-match
  gap and does nothing from a full collection; Cortex > Swarm's (CS7) overshoots the gate (61-63, band top 60).
  Both stay out of band until the owner decides; nothing shipped.
- **The agent's mode choice is unjudged.** With NA12/CS7 the agent casts the new mode ~0.5 a game and the printed
  one almost never (Null's directive kills vs Cortex 0.19 -> 0.01 a game). Whether the LookaheadAgent underrates
  directive removal is not tested; a better valuation would change NA12's numbers vs Cortex.
- **The ablation is cut-only.** 13 of Null's 20 own cards can't be cut one copy at a time (Null sits on the
  10/40 removal cap), so Null's non-removal cards have no ablation numbers. A swap-based ablation is not built.
- **CI's rule on Null ~ Cortex is a hair trigger.** Its real-match baseline is IN BAND by 0.3 points of
  interval (50.7%, 47.4-53.9 at 900 games), so any change that moves it to UNRESOLVED fails the check, even one
  that stays near 50. Any card change will need that baseline re-recorded; the rule itself is unchanged.
- **The full-column seed check is by hand again** (`progress/old-edges/full-seeds.mjs`); `builtDeckRing.ts`
  still reports one deck per faction at full.
- **Still owed:** economy demos 014/016 not re-run since option B and set A.

## Session 60 (hardening pass; set A shipped): what was raised, and what is still thin

- **Raised: Null's 40.** Set A shipped; every starter is 40; both ring baselines re-recorded; the built-deck
  ring on the shipped list is byte-identical to the candidate run (`progress/built-deck-ring-003.txt`).
- **Raised: the play-style ownership check is in the store** (`setPlayStyle(ownerId, agentId, style)`).
- **Raised: rebuild workers are capped and queued** (`workerChooser`, every core but one). Still thin: a
  queued job reads `running` in the API (no `queued` state of its own), the queue is in memory and per
  process, and nothing stops one owner from re-queuing right after their build ends (only "already
  building" is refused).
- **Raised: the full-collection noise is measured, not fixed.** One full build swings a faction's mean
  4-6 points by search seed (`progress/full-seed-swing/report.txt`). `builtDeckRing.ts`'s report still
  shows one deck per faction at full; averaging several seeds there is not built.
- **Still owed before launch:** job 2 of the balance session (Null > Aegis inverted, Cortex > Swarm under
  band), not started.
- **The render's Null replays changed under the render lane.** Six committed replays and two recorded
  scenarios were regenerated and three render tests re-seeded; the render lane's own evidence files from
  earlier sessions (e.g. `recorded-matches-s35.txt`) describe the old replays.
- **Economy demos 014/016 still not re-run** since option B, set A, and now NA12/CS7 (session 62).
- **`ring:signature`'s baseline was not re-recorded** (it passes; a report, not a CI check).

## Session 59 (the balance session, job 1: Null's 4 added cards): what is still thin

- ~~**Null's built decks are still weaker than session 54's until the owner picks a set.**~~ Fixed
  session 60 (set A shipped). The shipped
  list is still 36 and the builder still fills it with rating picks (incl. a Zero-Day card). Candidate A
  measures back at session 54's field spread (`progress/balance-report-035-null-forty.txt`), but nothing
  ships without the owner's OK.
- ~~**Any 40-card Null list fails today's ring check on gate Swarm > Null**~~ (re-baselined session 60) (IN BAND -> UNRESOLVED, 57.1 ->
  52.9-54.3 on the ring's seeds). Shipping a set needs the baselines re-recorded, with the owner's OK.
- **The "full collection" column is one deck per faction and noisy.** Aegis's full-collection mean ran
  50.0-60.4 (real) across the candidate runs with its own cards unchanged; only the shipped Null deck its
  search plays against differed. The pack columns (8 owners) are the steadier read; nobody has measured
  how much one full build swings by search seed alone.
- **The search is noise-bound.** 1,500 games per edge per mode can't separate one add from another
  (about 1.3 points of noise per edge); the shortlist was finished by hand (C, D) and judged on held-out
  and built-deck results. B was never run on the built-deck ring.
- **The candidate runner patches source with a regex** (`progress/null-forty/run-candidate.sh`). It is
  checked (the economy must see a 40-card Null list, else it stops), but a reformatted `NULL_CARDS` would
  break it. It found one real bug in itself on the way: a shared node_modules made the economy read the
  unpatched engine (first D run discarded).
- **Job 2 not started:** candidate fixes for Null > Aegis and Cortex > Swarm.

## Session 58 (option B built): what it left thin

- **Null is now the weakest faction with built decks (new, important).** With no short decks, the
  builder pads Null's 36-card designed list with 4 rating picks. Null's field average falls to
  37.8-44.7 (was 44.7-48.7) and Null ~ Cortex goes OUT of its even band at several levels
  (`progress/built-deck-ring-002.txt`). The fix is the owner-decided 36 -> 40 Null list, chosen in the
  pre-launch balance session; until then built Null decks are weaker than session 54's. Owner check-in
  open (B2 would let Null keep 36 for now).
- **The built-deck gate was passed on session 54's numbers.** The re-run shows a new OUT edge
  (Null ~ Cortex) the owner has not seen judged as a gate result. Treat the gate as needing the owner's
  re-read before launch.
- **The size rule is the builder's only.** A deck an owner saves and forces can still be any size from
  20 to 40, so the short-deck gain session 57 measured is still there for anyone who forces a short
  deck (or an external deck builder). The owner kept the legal range; worth revisiting if forced short
  decks show up on the ladder.
- **`largestDeck` is checked, not proven.** It matches both starts on ~2,200 builds and one more copy
  always breaks a rule on the built list, but its optimality is an argument in a comment, not a search.
- **Demos not re-run:** `progress/economy-demo-014.txt` and `-016.txt` show pre-B built decks; the
  older deck-builder reports too. History, but anyone reading them sees old sizes.

## Session 57 (the deck-size check): what it found, and what is still thin (the rules question is answered: option B, built session 58)

- **Answered (owner 2026-10-26, option B; built session 58): a short deck wins more.** With the same cards in the
  same proportions, 20 cards beat 40 by +2.6 to +5.3 points in every faction. Fatigue never bites
  before a match ends (each side draws ~10-15 cards; a 20-card deck ran dry in at most 1.9% of games).
  The 20-card floor is a free advantage for anyone who picks short decks: a stronger search, an owner
  forcing a hand-saved deck, a future external builder. The store's builder only drifts 1-5 cards
  under 40 today. Recommendation (exactly 40) and alternatives are in notes-for-owner.md. Nothing is
  changed until the owner answers. `progress/deck-size-report-001.txt`.
- **Off-faction locks rarely make 40.** At 17 packs every off-faction deck that can be built is 20-35
  cards, and 116 of 288 off-faction locks can't build at all. That is fine under today's rule. Under
  a 40-card rule, a second faction becomes unplayable for about two weeks of packs.
- **Limits of the check:** the trims start from the builder's rating start, not its tuned deck, so the
  "best cut" gains (+2 to +12 on fresh seeds) overstate what a cut is worth over a well-searched
  40. The size-alone pairs are one card choice per faction (agreeing in all four, but not resampled).
  Only Calculator plays, against the shipped decks only; no signature card (gate mode only).
- **The study needs a rerun after any rule change.** It is a dev driver with a smoke test
  (`devDrivers.test.ts`) and unit tests for its deck makers. The full run is ~2.5 min on 4 cores plus
  ~10 s for the holdings step.

## Session 56 (the owner API, deck settings): what is still thin

- **Only the deck settings are served.** `server/src/ownerApi.ts` has sign-in/out and Settings -> Play
  (deck choice, faction lock, forced deck, play style, rebuild reasons, rebuild now). Wallet,
  collection, packs, matches, ladder, stats, notifications and layout (the rest of roadmap item 3) are
  not built; nor are account creation or agent generation over HTTP (the store has both).
- **Rebuild jobs live in memory.** A restart forgets the latest job (the saved deck survives). Fine on
  one always-on host; a second server process would not see the first one's jobs.
- **The API repeats two store rules** for clearer answers: "refused while forcing a deck" (before
  starting a job) and "only your own agent/deck" (404). The play-style ownership check is ONLY in the
  API: `store.setPlayStyle(agentId, style)` takes no owner, so any other caller must check it itself.
  Moving that check into the store is the cleaner fix.
- **The worker needs tsx at run time.** `server/src/deckBuild/worker.mjs` registers tsx inside the
  thread (the server already runs under tsx; tsx moved to the server's dependencies). A compiled build
  of the server would need this replaced.
- **One worker per build, no pool or cap.** Many owners pressing "rebuild now" at once start that many
  threads, each minutes of CPU. Needs a queue (size from the host's cores) before many owners exist.
- **No rate limit beyond the sign-in lockout; no HTTPS or CORS of its own** (meant for same-origin
  behind the host's proxy). Status codes are a first proposal (OWNER_API.md).
- **Raised: a salvage during a build.** `buildAgentDeck` picked copies from the collection read before
  its games; with builds now taking ~25 s on a worker, a salvage in that window could save a list the
  owner no longer holds (it would have failed with a confusing copy error). The copies are now read
  again at save time and a short list is refused with a clear reason; a mutation check (stale read)
  fails the new test.

## Session 55 (hardening pass): what was raised, and what is still thin

- **Raised: rebuild requests.** `agentDeckRebuildReasons` counted every card held, so a locked owner
  was told to rebuild after almost every pack (20 of 20 in the demo) even when nothing the builder
  could use changed. It now fingerprints only `playableHoldings` (the lock's faction and Neutral, each
  capped at its deck limit): 3 of 20. A test pins that `chooseDeck` builds identical decks from the
  playable holdings and from the whole holdings, forced faction and free pick; mutation checks (no cap;
  the old fingerprint) fail the new tests.
- **Raised: one source for the deck rules.** The builder's MIN_DECK/MAX_DECK and removal share were
  copies of the engine's numbers; they now import `MIN_DECK_SIZE`/`MAX_DECK_SIZE` (data/decks.ts) and
  `REMOVAL_DEBUFF_MAX_SHARE` (poolLint.ts). No other 40-card assumption found in the store, server or
  agents (grep of every workspace's src).
- **Raised: the padded-Null reports re-run.** `progress/deckbuilder-report-002.txt` and
  `progress/deckbuilder-styles-report-003.txt` (data in `progress/deckbuilder-styles/s55/`) replace 001
  and 002 for Null; every other faction's line reproduces byte for byte. Correction to session 54's
  debt note: the old reports did NOT understate Null's *built* deck by 3-4 points. The designed start
  rose (46.3 -> 47.8 in report 001's terms), but the full build came out 48.0 against the padded 50.0
  on the confirm seeds and 51.7 against 50.5 on the styles report's unseen cross seeds: a wash within
  noise (±2.2). The 3-4 point loss was in the built-deck ring's starts, where it was measured.
- **Thin: old decks keep the old rule.** A deck whose record predates session 55 is read with the
  old fingerprint (any card counts) until its next rebuild; harmless (it over-asks once), not migrated.
- **Thin: the rebuild check still over-asks a little.** A card the builder could use but would never
  pick (a weak spare under its limit) is still a reason. Only a build can tell, and a build is what
  the check is meant to save; no cheaper exact test exists.
- **Thin: deckbuilder-report-001 and styles-report-002 stay as committed history**, not annotated
  (they are reproducible outputs), so a reader must know 002/003 replace them for Null.

## New debt from session 54 (the built-deck ring)

- **Two builder bugs reached main before anything measured realistic collections:** a short collection
  hit the removal share and got "no deck" (a day-one Null owner), and the designed start was padded to
  40, so Null's 36-card designed list was never tried. Both are fixed and tested. Before them, every
  economy demo, `deckbuilder-report-001` and `deckbuilder-styles-report-*` built Null decks with the
  padded start. Re-run session 55 (report 002, styles report 003); the "3-4 points" estimate did not
  hold for the built deck, see session 55 above.
- **Owners are forced to their starting faction.** A real owner on "agent" with no lock may switch
  faction when its packs favour another, and this ring doesn't model that. Starter-faction owners only.
- **8 owners per faction, one pack history each.** The spread between owners on one edge reaches about
  19 points. The averages are the claim; one owner's experience can be far from them.
- **Collections ignore salvage, crafting and the shared Prototype runs.** An owner who salvages spares
  and crafts gaps would build closer to the full-collection deck. Not modelled.
- **The two long-standing out-of-band edges are unchanged:** Null > Aegis inverted (Aegis wins) and
  Cortex > Swarm below its band, with shipped and built decks alike. Owner call pending on whether to
  fix them with cards before launch.
- **The full-collection report build (session 53) has the padded Null deck.** The report shows it as
  history, labelled; it was not rebuilt with the stronger settings (that costs about 4x the store build).

## New debt from session 53 (the agent's deck in the agent's play style)

- **The style almost never changes the deck.** From a full collection every style keeps Calculator's
  deck in all four factions (`progress/deckbuilder-styles-report-002.txt`); the confirm step can only
  choose among three candidates (the searched deck and two starts), all found by Calculator. A deck
  shaped for a style (say, more cheap attackers for Rusher) can only appear if Calculator's search
  happens to find it. Building "for the style" is wired and safe, not yet meaningful.
- **Searching in the style failed, and the reason is the search's noise.** One-sd acceptance on 400
  games kept changes that cost 2-3 points for every style (report 001). The same noise is in the
  Calculator search; it just happened to land better on the search seeds used. A sturdier search
  (more games per trial, a second confirm per kept change, or package-level moves) would help both.
- **One build per style, one seed set.** Each report builds from one search seed (1); "every style
  keeps Calculator's deck" is true for that search, not shown across searches.
- **Nothing calls the rebuild.** `rebuildAgentDeckIfNeeded` exists for the ladder (item 6b), which
  doesn't exist; until then a stale agent deck stays stale unless something calls it.
- **The holdings fingerprint counts every live card,** including cards of factions the owner can't
  build or the lock excludes, so a pack with only off-faction cards still asks for a rebuild (cheap to
  over-ask; a rebuild is seconds to a minute).

## New debt from session 52 (play styles)

- **Fair made most styles subtle.** Tempo, Fortress and Gambler leave Calculator's best move in about
  1 decision in 10, Controller in 1 in 20, and their per-game averages (attacks at health, cards,
  units lost, unspent energy) barely differ from Calculator's. Only Rusher is plain to see (84% of
  attacks at health vs 76%). The bold first draft was visible but cost Controller 6 and Gambler 9
  points. Raised with the owner (options A/B/C); "plays visibly differently" is only half met.
- **The styles were tuned by hand on the shipped decks.** Four manual rounds, judged on 30-150 seeds,
  then one fresh-seed confirm (which failed once and was re-tuned, so the final confirm is the second
  look at fresh seeds). Built decks, new cards or a changed Calculator can move every number; nothing
  re-runs the style ring automatically (it is not a CI gate yet; ~1 minute on 4 cores at 300 seeds).
- **Per faction, some styles are weak.** Against Calculator, Fortress piloting Swarm or Null scores
  45-46%; the overall rule hides it. The signature-style per-edge rule would fail it.
- **Controller's reserve rarely matters.** About 0.15 Instants cast on the opponent's turn per game,
  any style: the shipped decks carry few Instants, so "keeps a response ready" is mostly a label today.
- **Gambler's dice is a margin, not a taste for risk.** No card or effect is scored as risky; the
  style is "random among good moves".
- ~~**The deck builder ignores the style.**~~ Fixed session 53: it measures in the agent's style.
- **The behaviour measure counts every multi-move decision equally.** Order-only differences
  (attacking before playing a card) count as departures, so "off Calculator" overstates how different
  a plan is; the demo says so.

## New debt from session 51 (the deck-building agent)

- **The built decks are stronger than the shipped decks the balance checks measure.** From a full
  collection the builder's decks beat the shipped decks of their own faction by several points (up to
  +14 in Aegis; `progress/deckbuilder-report-001.txt`). The ring check, the fairness test and every
  balance report measure the shipped decks, but real agents will play built decks once collections
  grow. The ring among built decks has never been measured. Raised with the owner (notes-for-owner).
- **The opponents are the shipped decks only.** "Best" means best against the four designed lists.
  It does not adapt to what the ladder actually plays (built decks, a meta). Fine for Season 0 with
  in-house agents; a real metagame needs the gauntlet to include what is being played.
- **The card rating is hand-priced.** `cardRating.ts` prices effects in stat points by judgment
  (draw 2.5, destroy 6, an aura 3.75x its size...). It is only the first guess (the games decide), and
  measured it is wrong in places: the rating start loses to the designed list in Swarm and Null by 8
  points, and from a big partial collection it built an Aegis deck 10-14 points under the designed one.
  The second start covers this; the rating itself is not fitted to any data.
- **The search is shallow and noisy.** 60 one-copy changes at 400 games each, accepted at about one
  standard deviation, keeps 2-4 changes per faction. Each accepted change is a selection from noise
  as much as a real gain; only the fresh-seed confirm (2,000 games) protects the result, and it
  compares the final deck with the starts, not each change. Larger moves (swapping a package, a new
  curve) are never tried. Any change to the deck reshuffles every game, so the "paired" comparison
  is weaker than its name.
- **No signature card in the measurement.** The builder's games give neither side a signature card,
  though every real match has one. A deck that plays well beside a particular signature card is not
  looked for.
- **Cost is seconds to minutes.** The store default (40 games, 24 trials, 100 confirm) is about 20-60 s
  for an owner who can build several factions. Fine run when holdings change; nothing schedules it yet
  (the server doesn't exist as a ladder). The 2,000-game report took several minutes per faction.
- **The rating-only pick (`games: 0`) is a weak faction choice.** It reads the mean card rating; tests
  and the store tests use it for speed. A production path should always run games.
- **Deck choice migration call:** owners with an active deck before v12 became `forced`. Every Season 0
  owner today is a house owner whose deck was set by a demo or test, so this mostly keeps old demos
  playing as they did; flagged in notes-for-owner.

## New debt from session 50 (hardening pass)

- **Only one result line is stamped.** The stamps are written by every command from now on, but the
  committed results are all unstamped except `agent41/stamped-s50.jsonl`. Unstamped lines are
  checked by their recorded reference rates (exact, and it separates the two agents' results
  cleanly), but that check can't see the CARD: an unstamped line whose card changed since is caught
  only for lines on the list (the fingerprint test), not for a line that failed and would pass
  today. Re-measuring the 14 listed lines stamped (~25 min at 10,000 in 4 shards) would close it.
- **The rate check covers full results only.** Grid lines (compact, 1,000 seeds) record no
  `refRate`, so an unstamped grid line can't be checked; they never decide (under 2,500 seeds) but
  the reports that read them don't check either.
- **Reports don't check provenance.** `signatureApprovedSelect.ts` is used by the list generator
  only; the report drivers (023-034) still read whatever files they name.
- **Seeded-bounds audit stopped at the game-lane workspaces.** The render lane's tests weren't
  audited (its own). Tests that pin exact seeded outcomes weren't reviewed; they change with the
  code by design.
- **`ring` / `ring:real` not re-run this session**: nothing they read changed (no card, the
  approved list regenerates byte for byte), so CI's run is the check.

## Session 49 debt, status after session 50

- "Removing a line on the owner's word has no mechanism": still true; not needed (the owner kept
  Guardian 3/4).
- "The username-in-the-name test passed by luck ... other seeded count tests not audited": AUDITED
  (`progress/seeded-bounds-audit-050.txt`): 13 bounds over 5 test files; two too close to chance
  (the Jackpot rate's lower bound at -2.6 sd; the username count's lower bound, 1 in 160) now sit
  about 4 sd out. The rest stand.
- "The approved list trusts file names / result files don't carry their own fingerprint" (session
  34, 48): FIXED for new results (stamped) and checked for old ones by their reference rates; see
  the new debt above for what that check can't see.
- The rest stand (two lines exactly on the limit; the ring re-record on judgement; committed render
  replays with generated signature cards).

## New debt from session 49

- **Two lines on the approved list pass exactly on the limit** (Guardian 3/4 and Supply Line 3/7,
  worst 2.00 at 10,000 games; both intervals reach 2.5). The owner's rule reads the point estimate,
  so they pass, but the next agent change could tip either over, as it tipped Guardian 3/5.
- **The real-match ring baseline was re-recorded on a judgement, not a card change.** Cortex > Swarm
  flipped UNRESOLVED -> OUT on a -0.4 change. The check judges verdicts on intervals, so a list change
  alone can flip an edge sitting near its band. The ring check has no way to tell "the stand-in's
  draw changed" from "a card changed"; any future list change will need the same re-record.
- **Removing a line on the owner's word has no mechanism.** Guardian 3/5 left the list because its
  data fails; if the owner takes off a line that passes (e.g. Guardian 3/4), the generator needs an
  owner-removed set, which doesn't exist yet.
- **Committed render replays with generated signature cards no longer match a fresh run** (the
  seeded generator draws from the new list). No test compares them; the render lane regenerates.
- **The username-in-the-name test was asserting a rate (1 in 30) the code hasn't used since
  2026-10-16** and passed by luck. Fixed this session (300 drafts, 1 in 100), but it shows the seeded
  count tests elsewhere may also sit closer to chance than their comments say. Not audited.

## Session 48 debt, status after session 49

- "The approved list holds one line that fails with today's agent" and "the generator still reads
  the session-35 measurements": FIXED (owner 2026-10-19): the list reads only `agent41/`, Guardian
  3/5 is off, Guardian 3/4 is on.
- "The 3 starter boasts not yet drawn are owned and equippable": moot, render slice 2 drew them.
- "The approved list trusts file names to tell old Guardian and Bulwark results from new ones" (an
  older item below): FIXED in effect, since only `agent41/` is read; the result files still don't
  carry their own fingerprint.
- The rest of session 48's list stands (the `drawn` test reads the render by path;
  `grantStarterCollection` timing; dev drivers smoke-tested at 2 seeds; older reports 001-022 not
  checked for regeneration).

## Debt from session 48

- **The approved signature list holds one line that fails with today's agent:** Guardian 3/5,
  Aegis > Cortex +2.1 (balance report 033). New agents can still draw it until the owner answers
  the check-in. The generator still reads the session-35 measurements; the new ones sit in
  `progress/signature-fairness/agent41/` and aren't read by it yet.
- **The `drawn` flag is kept in step with the render by a test, not by the render itself.** The
  economy test reads `render/src/boastFx.ts` by relative path (the economy workspace can't depend on
  the render, which depends on it). If the render moves or renames `BOAST_SPECS`, that test breaks at
  import, loudly; it can't drift silently. It covers boasts only: a card back, avatar or arena has no
  render registry yet, so `drawn` on those kinds would be unchecked.
- **The 3 starter boasts not yet drawn (Hive Burst, Void Collapse, Data Cascade) are owned and
  equippable** (free, granted, never sold, so the gate doesn't apply). A win with one plays whatever
  the render does for a boast without a spec until render slice 2 draws them.
- **`grantStarterCollection` is ~5.5 ms per owner (measured, not changed).** About 57 µs of that per
  copy is SQLite's insert into `card_copies` (random UUID key, 3 indexes, 6 insert triggers), the
  rest JS around 40 inserts; a prepared-statement cache measured no gain end to end, so it wasn't
  shipped. 1,000 new owners ≈ 6 s, fine for Season 0; a bulk insert is the fix if sign-ups ever
  arrive in bursts (part of the standing storage load-test gate).
- **Dev drivers are smoke-tested only at 2 seeds.** `devDrivers.test.ts` proves both drivers run
  every section with whole numbers; it can't catch a wrong number. Other report drivers (most of
  `engine/src/dev/`) still have no test at all.
- **Committed evidence that no longer regenerates,** narrowed: report 023 regenerates again (it
  reads the first 2,500 seeds of the kept session-37 reference) and 026 still does. The older
  reports (001-022) were not checked this session.

## Session 47 debt, status after session 48

- "Season 0 sells nothing": FIXED as the owner named it (2 boasts, on sale once drawn).
- "Hardening pass now three sessions overdue": DONE this session alongside the owner's catalogue
  ask: the approved list's 10,000-game re-check with session 41's agent (balance report 033), smoke
  tests for both drivers, `grantStarterCollection` measured (see above).
- The rest of session 47's list stands (close-win needs `finalHealth` from a server that doesn't
  record matches yet; season-reset carry-over on paper; catalogue vs database orphans; the
  live-match loadout rule in the store, not the schema; `matchHistory`'s IN lists).

## New debt from session 47

- **Season 0 sells nothing:** the shipped catalogue is only the 4 free starter boasts. The purchase
  path, sale windows and retirement are tested only with test and demo items. No card back, avatar
  or arena item exists, so those 3 slots can't be filled yet.
- **The close-win rule depends on the caller passing `finalHealth`.** Only the demo does; the real
  server doesn't record matches yet (roadmap 6b). Without it a close win plays the main boast and
  nothing flags it. When 6b lands, make `finalHealth` required for a win from the server path.
- **Season-reset carry-over is a rule on paper:** no reset code exists (a new season is a new file),
  so nothing yet copies `owned_cosmetics` / `agent_loadouts` (or the unique Mythic) across.
- **The catalogue is checked when the store opens, not against the database:** an item id that
  later leaves the catalogue still shows as owned (with `item: null`) and can stay equipped; nothing
  stops a catalogue edit from orphaning it. Never remove an item; retire it with its sale window.
- **The "no loadout change during a live match" rule is in the store, not the schema** (like the
  agent-switch rule): a raw SQL write could change a loadout mid-match. The match record would then
  show the changed loadout.
- **`matchHistory` now runs two extra queries with an IN list of every match id;** fine at demo
  scale, untested at ladder scale (part of the standing storage load-test gate).
- **Hardening pass now three sessions overdue** (45 option C, 46 the starter guarantee, 47 boasts,
  each by the owner's direction). Still open from session 46: the approved signature list's
  10,000-game re-check with the session-41 agent; smoke tests for `signatureRingDrivers.ts` and
  `aegisSignatureGain.ts`; `grantStarterCollection` inserts copy by copy.

## Session 46 debt, status after session 47

- "Victory boasts and the whole cosmetics backend are unbuilt": the game lane's half is BUILT (the
  render half is the render lane's). The shop spec's owned-cosmetics inventory and sale windows
  exist now.
- The render lane's `starterHit` note: the render lane's (owner answered in render session 30).

## New debt from session 46

- **Under option A the guarantee is predictable to an owner who knows the rule:** after two starter
  packs with no hit, pack 3 will hit (72.6% of pack 3s hit, vs 18.5% for packs 1-2). The pack and
  tear never hint, as the owner asked, but the rule itself does; option B (spread across the 3)
  is proposed, not built.
- **The render lane doesn't show `starterHit` yet,** and its pack page's "Pity: this pack was due a
  hit" line is the only after-reveal note; whether the starter hit gets one is the owner's and the
  render lane's call (render/** not touched here).
- **No owner-facing published-odds page states the guarantee** (the odds page is still roadmap item
  5's open work); ECONOMY.md does.
- **The 1,000-owner store run takes about 2 minutes** (granting 40 bound starter copies per owner);
  the test version is 60 owners. Not a production path, but `grantStarterCollection` inserts copy
  by copy.
- **Victory boasts and the whole cosmetics backend are unbuilt** (plan only, waiting on the owner's
  six decisions). The shop spec's owned-cosmetics inventory and sale windows were "backend to build
  now" since 2026-10-05 and still don't exist.
- **The hardening pass is now two sessions overdue** (45 went to option C, 46 to the owner's starter
  guarantee). Still open: the approved signature list's 10,000-game re-check with the session-41
  agent; a smoke test for `signatureRingDrivers.ts` and `aegisSignatureGain.ts` (top-level work).

## New debt from session 45

- **Null > Aegis is still 45.4% in the real-match check, 9.6 under its band, now by the owner's
  choice (fallback A)** until the next set. Every all-Aegis list that moves it does so by weakening
  Aegis overall; the real fix needs new cards.
- **The card-flow cause rests on two neutral lists (N1, N2),** not on an Aegis card or an ablation of
  Aegis's draw; it is the best reading, not a proven one. Session 44's "spare energy" reading is
  now known to be a symptom (heavier lists use the energy, the gain stays).
- **The Aegis pool has no room to grow inside itself:** 22 unique cards, 40 of 40, every card in the
  list, one 4+ cost card below its copy cap. Any Aegis deck change is a trade, not an addition.
- **The render lane's committed pages still print the old short signature wording** until it
  regenerates them (render/** is its lane; not touched here).
- ~~**The starter-pack hit guarantee (owner 2026-10-19) is not built.**~~ FIXED session 46.
- **The hardening pass due this session was displaced** by the owner's option C priority. Still
  open from it: the approved list's 10,000-game re-check with the session-41 agent, and a smoke test
  for `signatureRingDrivers.ts` (it still runs its work at top level).
- ~~**The dev report drivers run their work at top level and have no smoke test.**~~ PARTLY FIXED
  session 45: the shared harness and the new trial driver have a test; `aegisSignatureGain.ts` and
  `signatureRingDrivers.ts` still run at top level.
- 2,500 seeds per trial cell, 10,000 only for the two confirmed lists.

## New debt from session 44

- **Null > Aegis is 45.4% in the real-match check, 9.6 under its band, and nothing fixes it yet.**
  It is recorded as accepted-OUT, so CI only stops it getting worse. Six trials; the best (Null
  Singularity cost 6) closes 3.8 points and pushes Swarm > Null out. The owner's call.
- **Session 43's real-match numbers were measured on 4 approved lines, not 14,** and its check-in
  said 14. Caught and fixed this session; report 030 has a correction note. The lesson: a stand-in
  draw needs a test of its spread before any number is read from it. Other dev drivers with ad-hoc
  draws have not been audited the same way.
- **About two thirds of Aegis's extra signature gain is unexplained by measurement.** Spare energy
  is about a third (ablation); "the card becomes Aegis's attacker" is a correlation only.
- **The real-match check draws lines evenly,** not as real owners pick them (1 of 3); the agent
  generator's pick is not modelled.
- **The dev report drivers run their work at top level and have no smoke test.** A broken driver
  (like session 43's draw) is only found when someone runs it. `aegisSignatureGain.ts` and
  `signatureRingDrivers.ts` both follow this pattern.
- Session 43's debt stands otherwise (Prime Aegis's health does nothing; Aegis > Cortex OUT in the
  gate, accepted for now; 2,500-seed trials; no agent builds decks with Zero-Day cards).

## New debt from session 43

- ~~**The CI's second ring check measures a mode no real match plays.**~~ FIXED session 44: CI runs
  `--real` (set Mythic in the deck, an approved menu card each side); `--signature` is a report.
- **In the real-match stand-in, Null > Aegis is 45.2%, 9.8 under its band,** and Cortex > Swarm
  52.9% slips OUT. A signature card is worth ~2x more to Aegis than to the others; why is
  unmeasured. The 14 approved lines passed a fairness test that measured each line against the
  plain stand-in on both sides, so a faction-wide gain from the body itself was never in its scope.
- **The real-match stand-in draws approved lines evenly,** not as real owners pick them (1 of 3).
- **Prime Aegis's health is not doing anything** (4/8 -> 4/6 changes no edge by more than 0.4):
  nothing in the shipped decks gets damage through to it. A design smell for the next set.
- Session 42's debt stands otherwise (Aegis > Cortex OUT in the gate, accepted by the owner for now;
  2,500-seed trials; no agent builds decks with Zero-Day cards; the registry trap).

## New debt from session 42

- **Aegis > Cortex is still OUT, now explained but not fixed.** The fix waits on the owner. Even the
  best trial (Mainframe Core +1/+0, 53.0%) stays under the 55-60% band, and it pushes the
  signature-mode edge further out (74.8%). The ring's Aegis > Cortex counter is weak in the gate and
  far too strong in signature mode: the two modes disagree on this edge by over 20 points, and that
  gap is not explained yet (the signature switch is still the owner's open call).
- **The trials were 2,500 seeds per edge,** the gate's own size, not the 10,000 used for Zero-Day.
  B's +3.7 interval is [0.9, 6.5]; A and C may have small real effects this size can't see.
- **The Zero-Day cards are ownable, but no agent builds decks with them.** Shipped decks and the
  starter collections don't hold them; only an owner's hand-saved deck does. The deck-building
  agent (roadmap 2b) must handle 1 per deck and the removal share.
- **The Zero-Day face in the render pack page has no rules text.** `cardFaceOf` reads `abilities`,
  which is empty on a modal card. Render lane's to fix (flagged in notes-for-owner).
- **Copies pulled before go-live were not checked in a real owner's database.** They should become
  the cards with no migration (the card id was the code all along), and the tests show it for new
  copies, but owners' own database files are not reachable from the repo.
- **The registry now holds cards that aren't base-set cards.** Anything new that walks
  `CARD_REGISTRY` as "the set" has to skip `topTier` cards, as the set builder now does. Render's
  `capture.ts` and the name-collision checks walk it too; both are fine with Zero-Day names, but it
  is a trap for the next reader.

## Session 41 debt, status after session 42

- The ring moved and was re-baselined, not fixed: INVESTIGATED (the move is Cortex's pilot,
  Mainframe Core); a fix is proposed, not shipped.
- The Zero-Day cards not live: FIXED (live).
- The rest of session 41's list stands (the signature approved list's stale 10,000-game numbers,
  onAttack/onDamaged triggers unvalued, the self-targeting onPlay gap, unfitted constants, the flat
  Lockout value, committed evidence that no longer regenerates).

## New debt from session 41

- **The ring moved and was re-baselined, not fixed.** With the better agent, Aegis no longer beats
  Cortex in the gate mode (52.2 -> 49.3, a real move further out of its band), and Null ~ Cortex,
  Aegis ~ Swarm and Cortex > Swarm slipped IN -> UNRESOLVED. No card changed, so this is what the
  factions were all along under a better player. The baseline was re-recorded as the owner allowed;
  any balance response is the owner's call (raised in the check-in).
- **The signature approved list was measured with the old agent.** The new agent now values
  signature statics and turn triggers (Rally, Inspire, Supply line...) it ignored before. The
  signature-mode ring passed, but the 14 approved lines' 10,000-game fairness numbers are stale.
  Re-measure before the next signature change.
- **The agent still ignores onAttack and onDamaged triggers** (Load Balancer, Corrosive Spitter,
  Retaliation Node, Feedback Plating, Failover Custodian, Propagating Exploit). Same kind of gap as
  the one fixed this session, smaller.
- **A newly played unit's self-targeting onPlay is still worth 0** (Overload Capacitor's drawback,
  any self-buff on entry): the unit has no instance in the view yet. Named simplification, unchanged.
- **Aura and stun constants are reasoned, not fitted.** AURA_HORIZON 3, AURA_SURVIVAL 0.75,
  STATUS_DECAY 0.8 were not distinguishable from nearby values head to head on shipped decks (too few
  aura/stun cards there). Only STASIS_TURN_WEIGHT was chosen by a measurement (the Kill Switch probe).
- **The cost aura (Lockout) is still a flat 2.** Left alone on purpose (locked Lockout measured the
  weaker mode), but it is the one ongoing static not valued over a horizon.
- **The Zero-Day stand-in for a trimmed body is the designed body.** A body trim (tried, not
  proposed) is measured against a 2/4 or 3/6 vanilla, not against a vanilla with the trimmed body.
  That is the right question for "how much stronger than the designed slot", but it is a choice.
- **Committed evidence no longer regenerates identically** with the new agent: older sample match
  logs (033 and before) and the render lane's committed replay pages. They stand as history; the
  render lane should regenerate its showcase pages.
- **Head-to-head per-faction rows include each faction's own strength** only when read alone; the
  tool now prints current-vs-other on the same faction to cancel it. Earlier instrument checks
  (cardAdvantageCheck) still print raw per-faction win rates.

## Session 40 debt, status after session 41

- Agent misreads Zero-Day modes: FIXED (Carrier 68%, Lights Out 44% of casts).
- Modal scoring as a second path: FIXED (one path).
- Root Access over the cap / Kill Switch failing the 10% rule: FIXED by the proposed numbers (not
  live yet). The Zero-Day cards are still not live: waits on the owner.
- The rest of session 40's list stands.

## New debt from session 40

- **The reference agent can't judge two of the three Zero-Day mode choices.** LookaheadAgent values
  an aura (Carrier's +1/+1 to every other unit) as half its size once, and any status at 0.6 x the
  unit's attack whatever its duration (Lights Out stuns the whole board for 2 turns). So it picks
  Outbreak over Carrier about 3 in 4, though Carrier locked is much stronger (6.04 vs 2.07 worst
  edge), and casts Lights Out once in 17,967 Kill Switch plays. The fairness test measures through
  this agent, so the Zero-Day strength numbers are lower bounds for a good chooser. This is the
  same "fix the instrument first" problem as September's, now on modes. Also true for plain cards
  (a Stasis card's duration has never counted), which is why the fix belongs to every card.
- **Modal scoring is a second path in the agent.** `estimateModeAbilities` values a mode's statics
  and death triggers for modal units only; a plain unit's own static or onDeath is still worth 0 to
  the agent (it never was). It was done this way so no existing measurement moved, but it means the
  same aura is valued on a modal card and not on a plain one. The instrument fix should make it one
  path.
- **The 3 Zero-Day cards are designed but not live.** Pulls are still the "not designed yet" stub
  and Zero-Day crafting is closed, until the owner agrees the cap. Going live is one registry line,
  plus an economy test that a pulled copy plays and `craftSecret` opens; that test isn't written yet.
- **Root Access is over the proposed 4-point cap** (4.50, Swarm vs Aegis) with the agent choosing,
  and Kill Switch fails the proposed 10% mode rule. Neither is tuned yet, by design (instrument first).
- **The Zero-Day measurement's stand-in is a judgment call.** A Unit's stand-in has the same body,
  so only the modes are measured. Kill Switch, a Command, is measured against a 7-cost 4/8 vanilla
  unit. That's a different question ("a sweep instead of a big body"). Named in the report.
- **Locked-mode runs are confounded by play rate.** A card locked to a static/onDeath mode is scored
  by the agent as a plain body, so it's played less often than the modal card (6,767 vs 7,789 games
  for Patient Zero). The report prints play counts beside every number, but "locked vs choosing"
  compares slightly different things.
- **Null's shipped deck sits at exactly the 25% removal share.** Any added removal card, a Zero-Day
  card included, needs a removal card cut. Fine as a rule, but an owner building a Null deck will
  meet it.
- **Modes aren't drawn anywhere yet.** The feed doesn't word `mode` / `modeName`, and no card face
  shows the two modes. Render lane.
- **The Aggressive test agent always plays a modal card's first mode** (it picks by cost, and the
  modes tie). It isn't used for balance, but a smoke test with it never sees the second mode.
- **Economy tests are timing-sensitive under load.** Six timed out at the 5 s default while four
  measurement processes ran; all pass when the machine is idle.

## New debt from session 39

- **The rarest pull in the game is an unplayable placeholder today.** A Zero-Day pull (about 1 pack
  in 500) gives a copy named "Zero-Day 1 (not designed yet)". It can't go in a deck or be crafted
  until build-order step 2 designs the card under its id. The data is safe: the copy turns into the
  real card with no migration. But the reveal of the most special card is currently a stub. Step 2
  should come soon, not drift. (Session 40: step 2 is built and the 3 cards are designed; they wait
  only on the owner's cap answer and the instrument fix, see session 40's debt above.)
- **No pack-reveal visuals for the new finishes.** Glitch, secret illustrations and the animated
  Zero-Day exist only as data (finish, secret code, art slot, `animated`). The render lane hasn't
  drawn them, and there is no owner-facing opening screen yet (website steps), so nobody sees them.
  The Glitch "mark" on its number is only a convention: the binder gives the base number, and the
  render is expected to add the mark.
- **A logged opening can't be fully re-rolled from what is stored.** `pack_openings` keeps the seed,
  the odds version and what pity forced, but not the pity counters or the Prototype copies left at
  the time. Those are what `rollPack` takes, so "revealable seed" can't yet be checked end to end
  for a pack where a Prototype bonus or near-due pity mattered. A `verifyOpening(packId)` needs
  those inputs stored (a v11 column), or rebuilt from history.
- **`grantCopy` names `secret_code` only when a copy has one.** This exists so the migration tests,
  which drive old schema versions with today's store code, keep working. It's an accommodation for
  the tests, not a product rule.
- **`openPack` and `binder` scan the owner's whole collection.**
  - `openPack` scans it once per pack, for NEW and "x N owned".
  - `binder` filters it once per entry: 248 entries times every copy held.
  - Fine at Season 0 sizes (2,000 packs through the store took about 15 s across 20 owners), but a
    heavy collector's binder will slow. Group by entry in SQL when it matters.
- **Two copies of the same card in one pack both show NEW.** This is pre-existing (session 36: NEW
  means "held before this pack"), and the bulk summary counts it once. Seen again in the demo's
  Glitch pack (Swarm Larva twice). The owner may want only the first marked.
- **Calls not yet confirmed by the owner,** listed in notes-for-owner:
  - Zero-Day is pullable before it is designed;
  - crafting makes one per secret card held, and crafted secret copies are bound (never sellable);
  - NEW is per collection entry;
  - a Glitch pack has no full reveal by itself;
  - base completion counts any finish;
  - pre-switch packs open under the live table.
- **The feed still prints the raw reason** for the two Intercept Routine fizzles. The engine now
  gives their cause as data, and the render lane words it next.
- **Only one set exists,** so "older seasons' packs stay openable under the live table" is untested
  against a second set. A future table must still be valid for an older set's cards: for example,
  an S1 table whose Glitch list names S1 cards can't roll an S0 pack's Glitch slot.
  `rollPack` reads the lists from the pack's own set, which is right, but no test proves it.

## Session 38's chase items, resolved in session 39

- "Not live, not in the schema": **live**, schema v10.
- "`rollPackV2` duplicates `rollPack`": **merged** into one roller. Both tables are pinned by a seed
  test, and the merge was checked identical over 60,000 seeds.
- "No crafting of secret cards": **built** at the owner's 750 / 3,000.
- Still true: the secret and Glitch lists are picks, not play data; the months figures rest on 2.4
  packs a day; the 3 Zero-Day cards are not designed.

## New debt from session 38

- **The chase-card proposal is not live, and not in the schema.** `rollPackV2` exists only for the
  simulation and the tests. Going live needs schema v10 (the finishes `glitch`, `secret`,
  `zeroDay`, a secret code on copies), `openPack` switched over, binder and checklist entries, and
  render work for Glitch and the animated Zero-Day. None of that is started, on purpose: the owner
  approves first.
- **`rollPackV2` duplicates the slot logic of `rollPack`** (about 40 lines) so that S0-odds-1 packs
  keep reproducing from their seeds. When S0-odds-2 goes live, the two should share one roller with
  the S0-odds-1 path pinned by a seed-reproduction test, not two copies drifting apart.
- **The 3 Zero-Day cards are empty slots** ("Zero-Day 1 (not designed yet)"), counted as Mythic by
  my proposal. Their rarity, names and modes come with build-order step 2.
- **The secret list and the Glitch list are my picks** (33 and 20 cards), chosen by role and by
  names worth painting, not by any play-rate or popularity data, because there is none yet.
- **The full set can't reach "months" without crafting secret cards,** which isn't built (owner item
  5, later). The crafting model in pack-sim-002 is simple: salvage every standard extra beyond the
  playable limit, craft the cheapest missing thing. Real owners keep extras for trading; their
  times will be longer.
- **The months figures assume 2.4 packs a day** from ECONOMY.md's earning estimate, which is itself
  an estimate: daily quests and the owner's daily pack aren't built.
- **Signature ability ids changed shape** (`sig-recycle.c3`). Old event logs still name the standard
  id; `upgradeSignatureAbilityId` maps them, but nothing calls it yet (render keys by card name plus
  id, which still works for old replays). The render lane can now switch to id-only lookups.
- **Attack fizzles carry their cause as data, but the feed still prints the old sentence** ("fizzles:
  X's attack fizzles — ..."), which repeats "fizzles". That wording is in `render/src/feed.ts`, the
  render lane's file; the fields it needs (`cause`, `attacker`) are now on the event.

## New debt from session 37

- **Naming has no interface either.** `confirmAgentDraft({ name })`, `renameAgent` and
  `forceRenameAgent` are store calls. No owner can type a name anywhere yet, there is no admin view
  to press "force rename", and the owner report button the spec mentions doesn't exist. All wait on
  the website endpoints (build-order step 3).
- **The name filter is a short blocked-root list plus a staff-word list, both mine.** It catches the
  obvious, not the clever: leetspeak ("4dmin", "sh1t"), words split by punctuation ("A.d.m.i.n" is
  caught only because the squash joins letters; "Ad-min" too, but "Adm1n" is not), and slurs not on
  the list get through. The admin force-rename is the backstop, and nothing yet tells an admin a
  name needs one.
- ~~**The rename price (100 pack points) and nine smaller calls are mine**~~ The owner answered
  2026-10-17: the first rename is free, then 100; typed names may repeat words; the rest stands.
  Built session 38.
- **Reserved names never free up.** With every past name reserved forever, a long-lived game slowly
  fills the space with names nobody uses. Fine at hundreds of millions of generated names; it
  matters only for short, popular typed names, and there's no policy for it.
- **"Formerly" is data only.** `agentNames` gives current and formerly, but `matchHistory` rows
  still carry agent ids, and nothing (render, replays, commentators) shows the old names yet.
- **Agent names are now up to 32 characters,** longer than session 36's longest. The render's
  board, replay headers and the signature card's flavour line haven't been checked at that length.
  The flavour double possessive ("Every scratch on Rustwren's Last-Call Chronicler's side") reads
  worse with three-part names.
- **"[Handle] of the [Place]" is the smallest pattern** (56 places), so it causes almost all clash
  numerals (32 in 20,000 agents). More places would fix it; not done.
- **The 300 modifiers and ~100 new handle parts are shared with card names,** so card names changed
  too. The new words were not read one by one in every combination, as with session 35's lists.
  The tests only prove the filter passes them.
- **The migration's case-insensitive unique index fails if an existing database already holds two
  agent names that differ only in case.** No such database exists (Season 0 is in-house), but the
  migration doesn't repair it; it would stop with an error.
- **The chase-card, Zero-Day, top-tier and modal-card entries are unbuilt.** Only their order is
  proposed. The odds table still has no secret cards, no Glitch tier and no Zero-Day row.

## New debt from session 36

- **Pack opening has no interface.** The store has `openPack` / `openPacks` / `craftCard`, but no
  owner can press anything: no command, no local page, no endpoint. ECONOMY.md asks Season 0 for "a
  local page or a command". It's planned with step 3 (website endpoints), but today it's a library.
- **Several pack numbers are mine, not the owner's:** the shine slot's rarity weights, Alt Art
  forcing a Rare or Mythic, and which 15 cards get Prototype runs (in the check-in). The odds-table
  version (`S0-odds-1`) is a string I bump by hand. Nothing checks that a changed number came with
  a new version.
- **The published odds aren't published.** One table drives the game, but nothing renders it as
  the public odds page the spec describes. The data is there; the page is not.
- **Prototype season mechanics are partial.** Retiring unpulled runs at season end isn't built (it
  needs a season roll-over, which doesn't exist). There's no art per run, and serial assignment is
  sequential (01, 02 ...), a call I made without asking.
- **Pity reads the last 40 openings on every open** (one query, a join over at most 240 copies).
  Fine for Season 0; at scale it wants an index check or a cached streak.
- **`openPacks` holds one transaction across 10 packs.** Fine with SQLite and one writer; under
  the launch-scale storage gate it should be re-checked.
- **Crafting has no viewer data.** `cardHoldings` doesn't yet say "craftable: costs 80, you have
  70", so the card viewer would have to work it out itself.
- **The agent names are mine and only filtered mechanically,** like the card names: 50 program
  nouns and ~2,000 handles I never read one by one. A flavour line built on an agent name can read
  awkwardly ("Every scratch on Sectormantis's Copilot's side ...", a double possessive). The
  owner hasn't seen the new agent names yet; samples are in the notes.
- **Committed render replays still show session-34 agent names** where they were generated before
  this change; the render lane regenerates its own artifacts.
- **`progress/economy-demo-005.txt` is historical:** re-running its script now gives the new agent
  names. It was left as the record of session 35, like demo 004.

## New debt from session 35

- **The signature pool has 7 options, and the new sizes fixed nothing.** Smite and Sweep fail on one
  matchup (pings kill Swarm's small units), and neither a smaller number nor an "only when behind"
  condition fixes that. Energy surge left the pool. A next idea has to change who the card helps
  (for example, a target filter that spares 1-health units, or damage to the enemy player instead
  of units); I haven't designed or measured one.
- **The 10,000-game standard covers only 23 lines.** Every other line ever measured (the grids, the
  levers files) is at 1,000 or 2,500, so a line could sit just inside the limit at 2,500 and never
  be re-checked if it isn't in the approved list. Today's list is entirely 10,000-game numbers,
  but a future pass that confirms only at 2,500 would reintroduce the noise. The approved-list
  script doesn't demand 10,000; it only lets the larger measurement win.
- **The ring check (decks as shipped) was re-run, but the signature-mode baseline was not
  re-derived at 10,000.** It is still the session-31 number.
- **The names are mine, and only filtered mechanically.** About 2,000 handles are compounds I
  never read one by one. The blocked-word list is short and English-only. "Nonsense" is caught
  only as a repeated word; a grammatical but silly name ("Deluxe Ghost", "Looping Calculator")
  passes. The owner hasn't seen them yet; the samples are in the check-in.
- **The username variant trusts the username,** apart from the filter, the length cap and the
  character set. A username that is a real person's name, or a brand, passes.
- **Agent names are still the session-34 lists** (~800 given name x designation pairs, fantasy in
  tone). Raised as a question in the check-in.
- **The art pool (500 pieces) isn't modelled.** A signature card still points at
  `placeholder:signature/<id>`; the pool slot is planned, not built.
- **Play styles and the deck builder are proposals only.** Every agent still plays the same
  Lookahead brain with the owner's hand-picked active deck.
- **Session-34 debt resolved here:** the pool no longer caps a season (combinations may repeat).
  Pass/fail near the limit is now read at 10,000 games, with intervals of about ±0.5 per edge.

## New debt from session 34

- **The season's signature pool is small: 16 lines, so at most 14 generated agents a season.**
  Season 0 needs 8 house agents before any player. Raised as an [OWNER CHECK-IN]. Nothing stops
  the 15th owner today except a clear error ("only 2 approved signature lines left untaken").
- **Pass/fail at the limit is decided inside the noise.** Sweep (2.04) and Guardian (2.08) fail by
  less than their own 95% intervals (±0.5 to ±1.5 per edge at 2,500 seeds), and Energy surge's
  passes (1.8, 1.9) are just as close on the other side. The 2,500-seed reference can't settle
  lines this close; a 10,000-seed reference can.
- **The passing Energy surge bodies are 2/8 and 2/9**, off the table and low on attack for a
  Mythic. The tuner's health ceiling is 9, so 2/10 was never tried.
- **The grid covers cost 5 only.** Cost 6 and 7 for Smite, Energy surge and Sweep were last
  measured with session 33's greedy walk.
- **The generator's words are mine, about 40 agent names x 20 designations and 6 card nouns per
  option.** Names can read oddly ("Second Rollback", "Sable Ninefold"), and with only ~1,200 agent
  names a long-lived platform will reach the numbered fallback. Nobody has reviewed the lists for
  tone. Personas are text only: every agent still plays with the same Lookahead brain.
- **No avatar, no art, no ward choice per candidate.** The owner's spec says a candidate is "name,
  concept, art, ward". Art and ward are the render's fallback ward seeded from the name; there is
  no per-candidate visual on the pick screen yet.
- **The draft has no expiry.** An open draft stays open until confirmed or replaced, and its
  candidates are re-checked only at confirm time.
- **No server endpoint calls the draft yet.** The flow exists only as store methods, tests and the
  demo (build-order step 3).
- **`createAgent` keeps a pre-v6 insert path** (no persona column) only so the migration tests can
  run today's code on old schema versions.
- **The approved list trusts file names** to tell old Guardian and Bulwark results from new ones
  (`grid-*`, `levers-s34-*`). The fingerprint test only checks the list against today's cards, not
  that each result was measured with that fingerprint. Future result files should carry the
  fingerprint themselves.
- **Older demos now replay differently.** `bulwarkGuardMatchDemo.ts` and
  `signatureMenuMatchDemo.ts` build today's Bulwark (units only), so re-running them won't
  reproduce `sample-match-030`/`031`; those files stay as the record of the old card.
- **The raw results grew again** (~210 KB of grid, confirm and lever JSONL).

## Session 33 items moved by session 34

- "Guardian and Bulwark fail at every lever and wait on the owner's rework call": reworked
  (owner 2026-10-15). Guardian now misses by 0.08, Bulwark still fails (3.88).
- "The search isn't exhaustive": for the five options in this pass, every cost-5 body and size is
  measured. Still greedy for cost 6/7 and for the other options.
- "`attackTargets` is engine surface no card uses": Bulwark uses it now.
- "A once-per-turn activated ability can still be activated twice before the first resolves":
  fixed (not offered while one is on the stack), with a test.
- "The report's findings are hand-written": report 025's findings are computed from the data.
  Report 024's still aren't.

## New debt from session 33

- **10 of 16 menu options still fail the fairness test.** Guardian and Bulwark fail at every lever
  and wait on the owner's rework call. Hunter is too strong even at its smallest size, and it has
  no size without Rush. Commander's aura, Shield wall, Suppress and Dampen split the factions at
  every size. The generator can only draw from 6 options until this moves.
- **The search isn't exhaustive.** The coarse screen runs at 300 seeds, and the walks start only
  from the 3 best configs. A config that screened badly by noise is never walked, so a passing
  line may be missed, most likely for the near misses (Smite d1 2.4, Energy surge 2.4, Sweep r2
  2.6).
- **Picking the lowest worst edge from a noisy screen favours lucky lines.** Only the 2,500-seed
  re-measure counts as a pass, so no false pass gets through. But it is why several confirmed
  lines come in worse than they screened (Tax 3/4: 2.2 confirmed).
- **The sizes are my picks, 2-4 steps per option.** No size is finer than one number step.
  "Only while" conditions count as sizes (a call flagged to the owner). Guardian and Bulwark have
  no size at all.
- **Inspire passes only off the table (3/4, 3/5).** The generator will show a body the owner's
  table doesn't list.
- **The cost-7 lines the tuner likes are tiny bodies (Guardian 3/2, Bulwark 3/4).** They don't
  read as Mythics, and the tuner has no lower bound on health beyond 1.
- **`attackTargets` is engine surface no card uses.** Only the dev rework probes use it. If the
  owner picks neither Bulwark rework that needs it, it should go.
- **A once-per-turn activated ability can still be activated twice before the first resolves.**
  The use is recorded at resolution, so a second activation in response to the first is offered,
  paid for, and then does nothing. No card is affected yet (the only user is the "intercept" probe).
- **The menu's results still depend on Lookahead**, as session 32 noted. It doesn't value a
  signature card's statics or turn triggers when deciding to play it. The passes are passes for
  Lookahead-vs-Lookahead play.
- **The report's findings are hand-written** (`signatureLeversReport.ts` FINDINGS). If the data is
  re-run with different numbers, the prose won't follow it.
- **The raw results grew by ~320 KB of JSONL** (levers and reworks), on top of session 32's
  288 KB.

## Session 32 items moved by session 33

- "The tuner only moves stats": it now also has size and cost-tier levers. The walk is still
  greedy (see above).
- "Cost 6 and 7 are barely measured": every option is now screened at cost 6 and 7 with every
  extra (300 seeds), and the best lines confirmed.

## New debt from session 32

- **The menu doesn't pass its own fairness test.** Only Recycle and Tax pass, and those are the
  two weakest options. The generator can't show an owner 3 different candidates until the
  owner's check-in is answered and the tuner gets more levers. Step 2 is blocked on that, by
  design, not by a bug.
- **The tuner only moves stats, and its walk is greedy.** It screens at 500 seeds, so a
  half-point step can be noise, and it can stop at a local best. It never tries the ability's
  size or the cost tier. Attack is bounded to 0-6 and health to 1-9 by hand (an unbounded walk
  climbed Sweep to 1/16).
- **Cost 6 and 7 are barely measured.** Only 57 of their 255 lines (4 options) ran, untuned.
- **The test's result depends on the dummy agents.** Lookahead doesn't value a signature card's
  statics, turn triggers or onDeath when deciding to play it (it scores body + onPlay). It also
  attacks into Guard walls it should leave alone: Guardian wins 197 of 200 games for Cortex
  against Swarm from the first seat. Guardian's +40 may say as much about the agent as about the
  card.
- **First-seat advantage looks large.** In that same check, Cortex won 155 of 200 games against
  Swarm from the first seat with the plain card, against ~53% over alternating seats. The ring
  alternates seats, so its numbers are fair, but it's worth measuring on its own.
- **`lethalBy` credits whichever source dealt the last hit.** A Command's id never matches a
  unit, which is right, but an onDamaged retaliation that finishes a unit credits the
  retaliating unit. Only Hunter reads it today.
- **Bulwark reacts to every attack declaration, including a Rush unit's same-turn attack.** It
  ignores Stasis on itself (a frozen Bulwark still redirects). That's my call, not specified.
- **The render ignores the new triggers' meaning.** It labels them ON KILL and INTERCEPT, but
  there's no dedicated effect yet. Render-lane work.
- **The raw results are committed as JSONL (288 KB).** It's reproducible, but heavy for a repo
  that has mostly kept to text reports.

## New debt from session 31

- **The ring has no signature-mode gate yet, and the stand-in ring is badly out.** With each set
  Mythic in the signature zone, 4 of 6 edges sit 10-24 points from where they are today
  (balance report 022). The gate still measures decks as shipped, which is true to every real
  match today but stops being true the day agents carry signature cards. Owner check-in pending.
- **The fairness test as written can't pass.** Swapping one candidate for four very different set
  Mythics can't move every faction 2 points or less. Option A (same plain stand-in on both sides)
  is a proposal, not built.
- **Aegis gains from any extra always-available body**: even an identical plain 5-cost 3/6 on
  both sides gives Aegis +7-8 points against Cortex and Swarm. Not addressed.
- **Lookahead values a signature play exactly like the same unit from the hand.** It doesn't
  value that the card comes back (a renewable threat), or that holding it for a better turn might
  be worth more. It plays it on the first affordable turn almost every game.
- **Null Singularity (cost 7) is near-dead in the zone** (played in 29% of games), because games
  end before turn ~13. Using a 7-cost card as a signature card is a weak choice under today's
  curve.
- **The arena doesn't show the signature zone yet.** Render ignores `signatureReturn` and
  `fromSignatureZone`; a spectator can't see the waiting card or its climbing cost. Render-lane
  work.
- **Nothing gives a real match a signature card yet.** The server's one hard-coded match, the
  economy's `startMatch` and the demo all play without one. The zone is proven in engine tests,
  the demo and the measurement only.
- **The signature card is only checked for "plain Unit".** The Neutral-faction rule, the tier
  stat lines and the one-signature-ability budget from ECONOMY.md aren't validated anywhere yet.
- **Migration 4 assumes every bound promo/prize was bound by migration 3.** True today (nothing
  else bound them), but it would wrongly unbind a promo granted bound on purpose on a v3 file.
  No such file exists.

## New debt from session 30

- **Nothing outside the demo and tests calls sign-in or `startMatch` yet.** The match server still
  runs one hard-coded match, and there are no HTTP endpoints. The permission boundary ("only the
  signed-in owner acts for itself", "only admins see the roster") belongs to the step-3 server and
  isn't written.
- **`recordMatch` still accepts a match that was never started.** That keeps offline history and
  the older tests working, but it means "one connected agent, not during a live match" holds only
  for callers that use `startMatch`. Once the server records matches, recordMatch should refuse
  unstarted ids (or take an explicit offline flag).
- **A live match can go stale.** If the server dies mid-match, the `live_matches` row stays and
  locks both owners' agents until someone records a cancel. There is no expiry, and no startup
  sweep.
- **No password reset or account recovery, and no email verification.** A self-contained
  Season 0 has no mail service. A forgotten password needs an admin reset path, which isn't built.
  The email field is optional and unverified.
- **The lockout can be used against a known username.** Ten wrong guesses lock the real owner
  out for 15 minutes. That's the usual trade-off; there's no per-source limit because the store
  doesn't see network addresses (the server must add one).
- **Sessions and failure rows are never cleaned up.** Expired sessions and old failures stay in
  the file. They're tiny, but they grow forever.
- **Slot filling ignores finish.** When a deck's saved copy is gone, the oldest held copy fills the
  slot, even if the owner would rather show a Gold one. There's no per-deck finish preference.
- **Deck and holdings reads load the whole collection.** `listDecks` is decks x collection, which
  is fine for Season 0 sizes and untested at scale.
- **The tests reach the private `db` through a cast** to check what's stored (no plaintext
  password or token) and the re-hash. It works, but it's brittle.

## New debt from session 29

(Session 30 status: the salvage-in-deck rule is replaced by the owner's manual salvage, sign-in
exists, the connected agent is enforced at `startMatch`, and the demo is byte-reproducible. The
items below are kept as written, with those four now resolved.)

- **"One connected agent at a time" isn't enforced.** Owners can have many agents, and nothing
  stops two of them playing at once for the same owner (against different opponents). Both would
  draw on the same daily caps, so it farms nothing, but it breaks the owner's rule. Build-order
  step 2 adds the connected agent and refuses switching during a live match.
- **No sign-in and no permissions.** `createOwner` makes an account from a name. Anyone holding
  the store can act as any owner. Step 2 adds Season 0 sign-in; the server needs a real boundary.
- **Rating is still a promise.** "Rating is per owner" is written down, but no rating exists yet
  (Glicko-2 comes with the ladder, roadmap 6b). Stats per owner are built.
- **Salvage skips copies sitting in a saved deck.** This is my rule, not the owner's: it stops a
  salvage from breaking a saved deck. The side effect is that an owner can keep more than the
  playable limit by spreading extra copies across saved decks. It's flagged in notes-for-owner.md.
- **The marketplace hooks are partial:**
  - built: the origin per copy, the bound flag, bound copies never moving;
  - not built: the append-only ownership history per copy, the earned/purchased funding tag on
    ledger rows and pack copies, the lock state, the per-type transferable setting.
  The funding tag is needed before paid packs, not before Season 0.
- **The v1 migration assumes every v1 agent was a house agent.** That's true for the only v1
  data that exists (the session-28 demo and tests), but a real v1 player file would come out
  labelled "house".
- **The exploit suite covers only what exists.** Tested: switching agents vs the caps,
  self-play, a second starter, bound copies, cross-owner payouts. Not tested yet:
  craft-then-salvage (crafting isn't built), quest and pity farming, and multi-agent farming of
  owner-level rewards (none exist yet).
- **The demo isn't byte-reproducible.** The pack-purchase ledger line prints a random pack UUID.
  Everything else is seeded.

## New debt from session 28

- **Nothing calls the store yet except the demo and tests.** The match server still runs one
  hard-coded match and records nothing. Until session 31 wires `recordMatch` into the server,
  "persistence" is a library with a demo, not part of a running service.
- **The economy is mostly spec.** Built: the store, per-copy ownership, decks, the purchase debit,
  and match payouts. Not built: sets and collector numbers, what a pack contains, opening packs,
  pack points earning and spending, duplicate conversion, pity timers, Prototypes, promos,
  starters, quests, the weekly challenge, the owner's daily pack, the owner interface. A pack
  can be bought, but nothing can open it yet.
- **Four payout numbers are mine, not the owner's:** a loss pays 2, losses are capped at 10 a day,
  a draw pays as a loss, and an abandon pays nothing to the agent that stayed. They're flagged,
  and they could change once Season 0 has data.
- **`node:sqlite` is labelled experimental.** It prints a warning on every run, and its API could
  change in a Node minor release. CI's `node-version: 22` floats. If the API changes, the economy
  tests break loudly. (Session 29: `engines.node >= 22.13` is now pinned.) **Standing owner gate
  (2026-10-05):** before the public Season 1 launch, replace or back the single SQLite file with
  self-hosted storage that handles many players, and prove it with a load test at launch scale.
  Not started. This stays here until that gate passes.
  **Replay storage, for the same gate (owner 2026-11-03, on session 70's call 1):** an `ai-tcg-replay/2`
  file is about 25 KB (every deck card in full), so the live ladder's pace adds a few hundred MB a month
  on the Mac mini. Fine for Season 0. Revisit with this gate before the public launch: measure a shared
  card table per card version (a file naming `cards-N` and carrying only cards that differ) or compressing
  replays (or both). Not now.
- **There are no owner/agent permissions.** "The owner buys packs" is a function anyone holding
  the store can call. That's fine in-process for Season 0, but the server and the owner page
  will need a real boundary.
- **"Day" means the UTC day.** An owner in another timezone sees the win schedule reset at a
  local time that isn't midnight. That needs an owner call before the public launch, not now.
- **Card ids are the engine's internal ids**, checked against `CARD_REGISTRY`. A card removed from
  every pool stops being ownable, and `loadDeck` then refuses any deck holding it, but the copies
  stay in the collection with no way to use them. Retiring a card (or using a set's card list as
  the registry) needs a rule before cards start rotating out.
- **Season archive is a convention, not code.** "Season 1 starts a new file" is written down, but
  there's no command to start a new season or to read an archived one.
- **Concurrency is untested.** WAL mode and `BEGIN IMMEDIATE` should serialize writers, but no
  test has two processes writing at once. That becomes real once the server and an owner
  command share the file.

## New debt from session 27

- **The regression check guards one measurement, not balance.** Every number is Lookahead vs
  Lookahead on fixed seeds. A change that only hurts under a smarter agent, or only on seeds past
  2,500, passes. The shipped gate is now "this heuristic, these seeds, no worse than before."
- **The check is loose inside a band.** An edge that drifts from 56 to 59 inside its 55-60 band
  passes, and so does an UNRESOLVED edge that moves a lot without changing verdict (Swarm > Null
  moved +3.3 in the 2/2 demo and passed). Named in the checkpoint as a call the owner can tighten.
- **CI determinism is assumed, not proven.** The baseline was recorded on Node 22.22 here; CI runs
  Node 22 (unpinned minor). The engine is integer-seeded, but the agent scores use floats. A V8
  change in float maths could flip a close Lookahead choice and shift a count by a game or two.
  The verdict rule tolerates that, but nobody has run the check on CI yet; the first PR run is
  that test.
- **Id fields are optional in the type.** A new event kind or emitter could forget its ids and
  still compile. Only `eventIds.test.ts` catches it, and only for events that real matches
  between the shipped decks actually produce. Cards outside the shipped decks (most neutrals,
  some trimmed cards) are covered only by sharing emitters with cards that are in them.
- **`abilityTrigger.targets` is the resolved list, not what got hit.** A random-target ability
  logs its random pick there; an AOE logs every unit. The render still has to read the
  per-effect events for which targets actually took something.
- **The 2026-10-03 render guardrail in render/EFFECTS.md is now stale** ("ids still needed").
  It's a render-lane file, so it's left for the next render session.
- **Phase 5's carried session-26 debt stands, unresolved by choice.** Null > Aegis (48.2) and
  Aegis > Cortex (52.2) are OUT by owner acceptance, not fixed. Watchdog Timer still barely
  matters. Lift menus only ever tried +1 stats. These are closed as a lane, not as problems.

## New debt from session 26

- **The Phase 5 gate failed: 3 edges OUT, 1 UNRESOLVED.** Null > Aegis (42.0 vs 55-60) is the
  worst, and no single +1 stat lift on a Null unit reaches it. Phase 5 can't be called done on
  this ring. It's waiting on the owner's answers to the checkpoint.
- **Aegis > Cortex (52.2) is short, and nobody has probed why.** It drifted down after session 19
  through the Cortex slice and the agent fixes. No measurement says which.
- **The Quorum Arbiter "lever" was stale.** Session 22 measured ~6 points; it's now 1-3 and
  inside noise. Any lever measured before an agent fix should be re-measured before it's
  trusted. The other numbers carried in notes and owner-feedback have the same exposure.
- **Watchdog Timer still barely matters.** The buff quadrupled its draws, but Null moved +0.3.
  The agent values the conditional at a flat 0.5 and never plays toward the condition (e.g.
  dumping a hand to trigger it). It's a lift that's only on paper until the agent reasons about
  hand size.
- **The gate's arbiter is one policy judging itself.** Every verdict is Lookahead-vs-Lookahead.
  Random and Aggressive disagree a lot (Random has Cortex 70% over Swarm). That's expected for
  weak policies, but it means the ring is only "balanced" for this one heuristic agent.
- **The lift probe only tries +1 stats on units.** No cost changes, no spell or Directive tweaks,
  no pairs. The menu is narrower than the design space.

## New debt from session 25

- **Null is the weakest faction by a clear margin:** 40.0 / 38.9 / 41.4
  under Lookahead (900 seeds), with three edges OUT. The Rack nerf the owner
  asked for removed Null's best filler, and no neutral card helps it now.
  The gate will report this, not fix it. Levers left: a Watchdog Timer buff
  (flagged), or owner direction.
- **Watchdog Timer is measurably weak** (+1.9 to cut, CI 0.3-3.4), and only
  36 draws in 900 games. It's protected as an endorsed mechanic, so it
  stays as a known weak card until the owner rules.
- **The turn-buff valuation is still one-step.** A pre-combat debuff is
  valued by the best attack it enables, but the agent may then make a
  different attack. 8 of ~220 Bit Rot casts were still wasted this way. The
  greedy agent also attacks face before casting a debuff that would have
  enabled a better trade (see the lookahead test's Guard setup). Armor and
  Barrier aren't modelled in `exchangeValue`.
- **Reflex Spike plays halved** (1,990 -> 1,011 games) now that it's held
  for real combats. That's correct by the new rule, but nobody has checked
  that the agent finds every combat where it would help, e.g. defending a
  unit against a pending effect, which the rule ignores.
- **The Aegis package (+1 Uplink Tower) shipped on a noise-level held-out
  improvement** (243 -> 234; every edge within +/-1). The ship rule allows
  it, but it's churn rather than a measured gain.
- **Package-search noise is structural.** Every add-only candidate
  appends to the same deck position, so all candidates share one shuffle
  permutation that differs from the start deck's. Step-1 comparisons on
  search seeds mostly measure that shuffle change; only the held-out check
  guards it. A seed-paired design (shuffle the deck independently of list
  order) would fix the instrument.
- **Null Pointer is dead in 270/900 games** (no enemy directive). It's the
  owner-mandated answer card, so the cost is accepted, but it means Null's
  deck has 2 slots that often do nothing.
- **Closed this session:** "Commodity Rack beats every utility card"
  (nerfed after the agent was cleared), and "Null's removal cards weak or
  misplayed?" (settled card by card, report 019). The neutral-pool "3 of 10
  cards in decks" item still stands (now Rollback Point, Surge Protector,
  Uplink Tower).

## New debt from session 24

- **Only 3 of 10 neutral cards made a shipped deck** (Rollback Point, Surge
  Protector, Commodity Rack). The other seven are legal, tested and fire in
  real play (probe table, report 018), but no faction runs them. The pool
  "exists" more than it is "used". Swarm and Aegis run no neutral cards at
  all.
- **Commodity Rack, a vanilla 3/3 for 3, beats every utility card.** In the
  probe it hits 48% vs 34-42%, and it's 3 of Null's 4 neutral slots. Either
  it's over-rate against faction bodies (a neutral body crowding out faction
  identity is the opposite of the owner's "utility" framing), or
  LookaheadAgent over-values raw stats and under-values draw (flat 1.5 per
  card). Not separated.
- **Power Reserve is close to dead** (34% in the probe, worst). Its value is
  holding energy for responses, and LookaheadAgent is greedy on its own turn
  and rarely holds anything. It's an agent limit, but the card is still dead
  in practice. Uplink Tower's draw landed only 94 times in 335 games.
- **Kernel Panic visibility fell from 9.9% to 7.1% of Null's games** (36 -> 40
  cards). That undoes most of the session-23 trim's visibility gain. Flagged
  to the owner as a trade against +3-4 points per edge.
- **The package search is greedy and one-faction-at-a-time against fixed
  opponents.** Opponents' packages were not in place while each faction was
  searched, and the gate hasn't re-measured the combined ring at 2,500
  seeds. Cortex's package is small and its held-out edge changes are all
  inside noise individually. It shipped on the held-out objective sum.
- **The neutral lint rules and the 10-copy cap are this session's own first
  proposal** (e.g. banning all neutral statics, and treating Rush as
  identity). They're flagged to the owner, not confirmed.
- **The agent fix changed the instrument mid-Phase-5.** Every number before
  report 018 was measured with an agent that wasted energy on no-op heals.
  Cortex was understated by ~3-6 points per edge. Earlier Cortex conclusions
  (e.g. session 22's "Cortex-vs-Null follows Null's weakness") were drawn on
  the flawed instrument.
- **The agent still wastes Intercept Routine** (session-23 item below, not
  fixed), and it doesn't account for pending stack effects other than flat
  heals (damage, buffs, a pending destroy).
- **Neutral cards render in the UI gold** (`.faction-Neutral` borrows
  `--neutral`). That's a stopgap so frame and fx tints agree. The render lane
  should give them a palette.
- **The parity fixture comes from an independent Python
  re-implementation** of the same formulas, not from a second trusted
  library. (The provenance-line item is closed: session 25 removed the line
  per owner-feedback 2026-10-01.)

## New debt from session 23

- **Null is still the weakest faction, and the trim only moved it ~4
  points.** Under Lookahead (900 seeds), it's 41.1 / 41.7 / 39.6 vs Cortex / Swarm /
  Aegis. Null > Aegis is still inverted: Aegis wins 60.4% against a target of
  40-45. Null vs Cortex is still out of band (CI 37.9-44.4 vs 45-55). The
  sanctioned density lever is largely spent at 36 cards without cutting
  mechanics. The bigger-lift variant (report 017, B) cuts Bit Rot and
  Watchdog Timer and is waiting on the owner.
- **Null is back at the removal lint cap exactly (9/36 = 25.0%).** Every
  trim cut was non-removal. Any future non-removal Null cut fails the lint
  unless a removal copy goes too.
- **Null's removal/debuff cards measure as its weakest copies** (Bit Rot,
  Null Pointer, Watchdog Timer, Decay Ward: +2-3 points each to cut). I
  haven't separated whether the cards are weak or LookaheadAgent plays them
  badly. The latter would be an instrument bug that also mis-measures every
  other faction's reactive cards.
- **LookaheadAgent wastes Intercept Routine.** It will cast it onto the unit
  the attack already targets, a pure no-op (seen at Null vs Aegis seed 3).
  The engine now logs that honestly, but the agent still spends the card.
  This understates Aegis's reactive kit. Fix belongs in an agent/instrument
  pass: don't score a redirect whose target equals the current one.
- **The CI band rule can't confirm a 5-point band at 900 seeds.** The 95% CI
  half-width is ~3.2 points. The gate needs ~2,500 seeds per pairing on its
  Lookahead side, or the owner has to accept UNRESOLVED as a pass. Not decided; flagged.
  balanceReport.ts still reports point estimates vs band, not CI verdicts;
  only lookaheadEdgeCheck.ts has the verdicts.
- **Greedy search noise.** Step-to-step estimates carry 1-2 points of noise
  even at 2,700 games per candidate, and deck list order changes the
  shuffle. So a "same deck" re-listed in another order measures differently
  on the same seeds. Decisions within ~2 points of each other are not
  real distinctions. Five nearby 36-card decks were indistinguishable.
- Carried and partly addressed: session 22's "ablation and search
  scripts were scratch files" item. A reusable search now exists
  (`nullTrimSearch.ts`), but it is Null-specific. The owner-facing
  per-matchup per-card table still doesn't exist.

## New debt from session 22

- **The standard balance report is too small a sample for the calls we make
  with it.** 300 seeds is about a 2.9-point standard error, and the ring
  bands are only 5-10 points wide. The baseline Null-vs-Cortex edge read
  55.0% on seeds 1-300 and 59.3% on 301-900. Every earlier "IN BAND" verdict
  within about 3 points of a band edge should be treated as unconfirmed.
  `lookaheadEdgeCheck.ts` gives 900-seed Lookahead numbers, but
  balanceReport.ts itself still defaults to 300. Changing the default (or
  the end-of-Phase-5 gate) is proposed to the owner, not done.
- **Null is the weakest faction by more than the reports said:** 42.1 /
  36.6 / 37.3% against Cortex / Swarm / Aegis over 900 seeds. All three of
  its ring edges are out of band in the "Null too weak" direction,
  including the one it should win (vs Aegis). This slice moved
  Null-vs-Cortex a further 3.2 points toward Cortex (57.9 -> 61.1), and that
  was a deliberate, flagged tradeoff.
- **Cortex-vs-Swarm is not quite closed.** 54.1% over 900 seeds against a
  55% floor. It reads in band on 300 seeds (58.7%), but see the noise item
  above.
- **Random policy now shows Cortex over Swarm at 73.0%**, and Aegis-vs-Cortex
  out of band under Random (46.0% Aegis). Both are discounted under the
  Lookahead-arbiter rule, but the swing is large. Rate Limiter and Deadlock
  Detector need no judgement to work, so Random gets full value from them.
- **LookaheadAgent spends temporary friendly buffs immediately.** It values
  "+X/+Y this turn" the moment it has a target, not when combat is pending.
  So Hotfix is cast on the opponent's turn 2 times out of 262, and Swarm's
  Reflex Spike 0 of 150. The Instant speed of both cards is effectively
  unmeasured. The fix is an agent change (value a turn buff only against
  pending combat on the stack), and it would move Swarm's numbers. It
  belongs in a deliberate instrument pass, not a card slice.
- **Rate Limiter's 41.7% played win rate looks like a weak card but isn't
  one.** It idles against narrow boards (Aegis/Null) by design. Ablation
  shows it carries most of the Swarm-specific gain, and the per-card table
  can't show per-matchup value. Same instrument limit as Watchdog Timer's
  selection bias (session 21), now on a second card.
- **My ablation and search scripts were scratch files, not committed.** Only
  the edge-check tool was promoted into `engine/src/dev/`. A per-matchup
  per-card table and a copy-mix ablation tool would make the next faction
  tuning pass much faster. Not built.

## New debt from session 21

- **Null's evolution line is diluted.** The deck went 32 -> 40 with no
  trims, which was deliberate for power-neutrality. As a result, Kernel Panic is played in about
  half as many Lookahead games (206 -> 105) and Corrupted Process drops
  from 529 to 370. Null's signature "answer it early or respect it later"
  arc now shows up much less often, which matters for spectator
  drama as well as balance. The fix, if the owner wants the arc back, is
  trimming some new or old copies back toward ~36 cards and re-measuring. This session
  did not try it.
- **Null is still the weakest faction under the trusted policy.** Its Lookahead
  mean is 42.1%, and the ring's intended Null>Aegis edge sits at 45.0% Null under
  Lookahead, against a 55-60% target. This slice was scoped as "not a power buff" on purpose, so it
  is not a bug in this slice. But the end-of-Phase-5 re-measure will almost
  certainly have to deal with it.
- **LookaheadAgent still ignores several things a card can be worth.**
  This session fixed one blind spot: Directive turn triggers. Still unvalued:
  keywords on a played unit (Rush, Guard, Barrier), a unit's own
  onDeath/onTurnStart/onTurnEnd abilities, and any condition the view could
  actually evaluate. Conditionals are always discounted to 0.5 even when
  the condition is public board state. As a result, Dangling Pointer's Rush and
  Zombie Process's death token are only "valued" as their raw bodies.
  Fixing this generally would move every faction's numbers, so it belongs in
  a deliberate instrument pass (the owner's "fix the instrument" framing),
  not inside a card slice.
- **Watchdog Timer's measured 37% played win rate is selection bias, not a
  verdict.** It only does anything when Null's hand is empty, a state
  correlated with losing. The per-card table cannot separate "this card is
  weak" from "this card is played while behind". This is a known limit of the
  instrument, and it now applies to a real card.
- **The first cut shipped a dead card that only a trace caught.** The
  balance report showed Watchdog Timer "played 250 times", which looked
  healthy, while its effect had fired zero times. The per-card table
  counts plays, not effect firings. A per-ability firing count in
  balanceReport.ts would catch this class of problem automatically. Not built.

## New debt from session 20

- **Cortex-vs-Swarm overshot past even into mild Swarm-favour, rather than
  landing at the ring's actual 55-60%-Cortex target.** The headline honest
  finding, not a side note: this session's broad Swarm buff resolved the
  project's sole standing triple-flag, but the result is a new,
  small-but-real reverse imbalance (Lookahead 55.7% Swarm, Random 53.0%
  Swarm, Aggressive 53.7% Cortex — not triple-flagged either direction) on
  a pairing the owner explicitly said not to chase card-by-card
  (2026-09-23 entry: "Phase 5 wider pools will likely settle it... do not
  add a card or nerf anyone specifically for this pairing"). This session
  followed that instruction to the letter (no card or number was aimed at
  this pairing specifically) and the pool-wide settle it predicted did
  happen — just past the target rather than onto it. Not chased further
  this session, per the same standing instruction; a future session
  (Cortex or Null's own Phase 5 growth, or the owner steering directly)
  should treat this as live, not resolved.
- **Swarm-vs-Null remains unresolved, now with the opposite policy split
  from before.** Before this session: Aggressive/Lookahead roughly even,
  Random badly Null-favoured. After: Aggressive (61.3%) and Lookahead
  (64.3%) now favour SWARM, above its own 55-60% target band on the
  winning side, while Random (36.0% Swarm, i.e. 64.0% Null) still favours
  Null. Real, measured movement in the right direction overall (Random's
  Null number dropped from 75.7% in the original baseline to 64.0%), but
  the pairing has gone from "policies roughly agree Null wins too much" to
  "policies actively disagree," which is its own kind of unsettled — worth
  a future session reading `progress/balance-report-014-phase5-swarm-slice.txt`
  before assuming this is close to done.
- **The exact shipped stat lines for the four new Swarm cards are a
  single-pass calibration, not an iterated tuning** — same category of
  debt session 19 named for Aegis's four cards. They were checked against
  the full balance report exactly once after the "scale back below the
  original benchmark" correction and landed the headline result (no
  triple-flag) on that one re-measure. A future session revisiting Swarm
  should treat these numbers as a reasonable first cut, not a settled
  target.
- **The uniform, whole-deck win-rate spike from the first (overtuned) cut
  is itself a finding worth remembering, not just a mistake that got
  caught:** benchmarking a new card's stats directly against another
  faction's *already-above-average-performing* card (Aegis Line Trooper,
  Bulwark Chassis, Reinforced Bastion were themselves 58-63% drawn win
  rate in their own pool, not neutral baselines) transmits that card's own
  above-average power into the new pool, amplified by how far below
  average the receiving pool started. This wasn't isolated or measured
  precisely (no controlled experiment separating "which of the four new
  cards drove how much of the spike"), just diagnosed by inspection and
  corrected in aggregate — a future card-design session copying a
  cross-faction stat-line precedent should sanity-check whether the
  source card itself tested as strong or average before treating its
  numbers as a safe baseline.
- **Which existing Swarm cards absorbed this session's copy trims was
  chosen by lowest measured win rate alone**, same known limitation
  session 19 named for Aegis's trims (a card seen in fewer games has a
  noisier win-rate estimate) — not re-litigated here, just restated so it
  isn't read as a new, different methodology.
- **Warren Guardian and Bloodswarm Alpha's exact numeric relationship to
  their cross-faction Guard/summon benchmarks (Firewall Sentinel,
  Reinforced Bastion, Overclock Beast) is this session's own judgment
  call, not owner-confirmed** — flagged in `progress/checkpoints.md` and
  `progress/notes-for-owner.md` per this project's standing convention for
  first-cut numeric proposals.

## New debt from session 19

- **Aegis-vs-Swarm drifted out of its "even" 45-55% target band**
  (57.7/71.0/70.7% Aegis across the three policies) as a side effect of
  this session's Aegis-vs-Cortex fix — not triple-flagged (Aggressive stays
  at 57.7%, under the independent 60% threshold) so not an emergency by
  this project's own pass/fail bar, but a real, named, untuned gap. Left
  open on purpose (this slice's scope was Aegis-vs-Cortex specifically) —
  see `progress/notes-for-owner.md` and `progress/checkpoints.md`.
- **The exact shipped stat lines for the four new cards are a single-pass
  calibration, not an iterated tuning.** They were checked against the full
  balance report exactly once after the "scale back to match existing
  cards" correction and landed the target pairing in/near band on the first
  re-measure — genuinely lucky in how cleanly that landed, not the result
  of multiple tuning rounds the way, e.g., session 20's Kernel Panic nerf
  went through two explicit steps. A future session revisiting Aegis should
  treat these four cards' numbers as a reasonable first cut, not a settled
  target.
- **Salvage Reflex's onDeath ability is the only piece of new *behaviour*
  this session added; the other three new cards are pure stat lines with no
  ability at all.** That's a deliberate response to item 3's "NOT
  zero-tempo utility" instruction (a body's own stats are the safest kind
  of "immediate impact"), but it does mean this slice adds less genuine
  mechanical variety to the pool than a session that designed new triggered
  effects would — worth knowing if "variety" (not just "unique card count")
  is being tracked as its own quality bar for Phase 5.
- **Which existing cards absorbed this session's copy trims was chosen by
  lowest measured win rate alone, with no check for whether a trimmed
  card's *low copy count* itself explains part of its low win rate**
  (a card seen in fewer games has a noisier win-rate estimate, and several
  of the trimmed cards — Static Ward Beacon, Barrier Shim, Latent Ward,
  Lockdown Field — already had the pool's lower "drawn" counts before this
  session's trim went from 2 copies to 1, which will make their signal
  noisier still in the next report). Not incorrect, but worth remembering
  before treating any single one of their numbers as a settled verdict.
- **Aegis Line Trooper (2/1, cost 1, no ability) is a fragile stat line
  that hasn't been checked for a specific failure mode:** whether it's
  simply too weak to ever be worth its slot once Cortex's cheap removal
  (Diagnostic Pulse, 1 mana) can 2-for-1 it before it attacks even once.
  Its 64.3% played win rate in this session's own report suggests it's
  fine in practice, but that number is an average across all four
  matchups, not specifically checked against Cortex, the matchup it exists
  to help.

## Resolved this session (session 19)

- **Aegis-vs-Cortex is still out of band on every policy — RESOLVED.** The
  session-18 debt item immediately below described the pairing as out of
  band on all three policies after that session's own fix. This session's
  change lands Random (58.7%) and Lookahead (59.3%) IN the 55-60% target
  band and brings the pairing out of the triple-flag cross-check entirely
  — Aggressive alone remains out of band (47.0%, a real but much smaller
  gap than the 64.3% going into this session). Left here rather than
  deleted, per this file's own convention for resolved entries, so the
  historical record of what session 18 actually left open stays intact.

## New debt from session 18

- ~~**Aegis-vs-Cortex is still out of band on every policy** after this
  session's fix (Guard Directive Chip 2->3 copies) — the headline honest
  finding, not a side note. Worst on Aggressive (Cortex still wins 64.3%,
  only down from 67.7%).~~ RESOLVED, session 19 — see above. The rest of
  this item (the untested agent-heuristic hypothesis) is still open and
  worth a future session's attention if there's spare budget: This
  session's own read is that the gap may be
  partly agent-heuristic (AggressiveAgent may simply play Cortex's
  removal-heavy kit more efficiently than it plays Aegis's defensive kit —
  see the existing "Agent quality" section below), not purely a
  card-balance problem, but that's an untested hypothesis, not a finding —
  nobody has actually isolated agent-skill from card-power for this
  specific pairing. A future session with spare budget could test it
  directly: run Aegis-vs-Cortex under LookaheadAgent-vs-AggressiveAgent
  (mixed policy, not matched) and see whether Aegis performs closer to band
  when it isn't the one being played by the weaker heuristic — this would
  at least separate "the deck is behind" from "the policy misplays this
  deck," which the current same-policy-both-sides methodology cannot do by
  construction (see this file's Testing/Card-pool sections for the existing
  note on that methodology's own known blind spots).
- **A first Aegis-vs-Cortex attempt (a new Barrier-granting Tool,
  "Redundant Barrier Coil") was designed, measured, found worse, and fully
  reverted this session** — no trace left in the shipped card pool, but the
  investigation itself (why a mechanically-sound-seeming card measured
  worse) wasn't pushed further than "this matches session 11's already-
  documented failure mode" — it's a pattern match, not a controlled
  isolation of the actual cause the way session 11's own investigation
  decomposed its three cards individually. If a future session wants to
  design another new (non-copy-bump) Aegis card, this pattern-matched
  conclusion is worth re-verifying rather than treated as fully proven.
- **The balanceReport.ts cross-check bug this session found and fixed (it
  didn't verify all three policies agreed on the winning side) may have
  affected the flag status judgment calls made in EARLIER sessions' own
  reports** (balance-report-004 through balance-report-011) — none of those
  historical documents have been re-audited under the corrected logic, only
  balance-report-012 (this session's own) uses it. Re-reading old reports'
  "triple-flagged" claims with the old, buggy logic in mind is worth doing
  once, opportunistically, rather than assuming every historical "FLAGGED"
  call in this project's paper trail was actually a genuine same-side
  agreement (this session spot-checked only balance-report-011's own
  Swarm-vs-Aegis claim, not the full history).
- **Kernel Panic's maxHealth cut to 4 and Null Singularity's health cut to
  7 are first-guess numbers**, same category of checkpoint-proposal debt as
  every other numeric first-guess in this project's history — not
  playtested beyond this session's own 300-seed report.

## New debt from session 17

- **None of the six ring pairings are within band yet.** This is the
  headline honest finding, not a side note — see
  `progress/balance-report-011-phase4-decisions.txt`'s "honest read"
  section. Both authorized changes (Null cost increases, the two new Swarm
  cards) moved the numbers in the right direction, but Aegis-vs-Null and
  Cortex-vs-Swarm both remain triple-flagged, and the four "should be even"
  pairings are mostly outside the 45-55% band too (Cortex-vs-Aegis 43.7-
  67.7% depending on policy; Swarm-vs-Aegis now 43.7-64.7%). The ring is a
  real target, not yet a real result.
- **Cortex-vs-Swarm has no assigned owner.** Nothing in the 2026-09-23 entry
  authorizes touching Cortex (explicitly forbidden) or names a specific
  Swarm/Aegis fix for this specific pairing the way it did for
  Swarm-vs-Null. It was measured, unchanged in kind, and left exactly as
  flagged — a genuine gap in who's supposed to fix it, not an oversight.
- **Kernel Panic and Null Singularity's cost increases didn't reduce their
  per-instance power, only how often they get played** — both remain
  extreme win-rate-when-played outliers (up to 86.4%/78.7% under Random).
  If Aegis-vs-Null needs to actually reach the 55-60% band, the per-card
  table in `balance-report-011` points at these two cards' raw
  stats/effects as the next lever, not their cost — unstarted, out of this
  session's authorized scope, named here so it isn't lost.
- **A new, unchased single-policy flag: Cortex-vs-Null under Aggressive
  (55.7% -> 60.7%).** Real, honestly reported, plausibly a side effect of
  Null's cost increases weakening its early-to-mid game specifically
  against Cortex's efficient curve. Not a cross-check flag (only one of
  three policies), not chased — see `balance-report-011`'s honest-read item
  3 for the full reasoning on why reverting over one policy's number would
  itself be the card-by-card chasing this project's history warns against.
- **Colony Broodling and Overgrown Carapace's numbers (cost 1/1/1 summon
  gated at 2+ other units; cost 3/2-attack/1-base-scaling-health; 3+2
  copies) are this session's own first proposal, not playtested or
  owner-confirmed** — same category of checkpoint-proposal debt as every
  other numeric first-guess in this project's history (baseArmor=1, board
  slots=6, telegraph timing, etc.). Flagged in `checkpoints.md`/
  `notes-for-owner.md` per the entry's own instruction to propose specific
  cards rather than finalize them unilaterally.
- **Both new Swarm cards help Swarm's OTHER matchups too, not just
  Null** — Swarm-vs-Aegis (an "across," should-stay-even pairing) moved
  further Swarm-favoured under Aggressive (61.7% -> 64.7%), a known,
  accepted side effect of a systemic fix rather than a Null-only patch, but
  worth tracking if a future measurement finds Swarm-vs-Aegis has drifted
  out of band in the other direction.
- **`swarmResilienceMatchDemo.ts`'s Overgrown Carapace sampling only checks
  the FIRST unit on `p1`'s board named "Overgrown Carapace"** (via `.find`)
  — correct for the current pool (copy count 2, and the script only needs
  one live instance to prove the mechanism), but would silently only track
  one instance if two copies were ever simultaneously in play in the same
  demo run. Not exercised this session (the found seed only ever had one
  copy on the board at a time), named as a scripting simplification rather
  than a proven-correct multi-instance path.
- **Phase 5 (pool expansion) remains correctly unstarted**, per the
  2026-09-23 entry's own explicit gate ("do NOT start expansion until the
  ring is within band"). Restating here per this file's own convention so
  it isn't mistaken for forgotten.
- **The server integration test's known flakiness (session 9's debt) looks
  worse than previously recorded.** This session observed it fail on 2 of 4
  runs, including standalone (not just under a full concurrent `npm test`),
  whereas session 16 only saw it flake once under a full run and pass
  reliably 3/3 alone. `server/` was not touched this session, so this isn't
  a regression from anything here, but the failure rate this session
  actually measured (~50%) is real new information a future hardening pass
  should have, not just "worth watching."

## New debt from session 16

- **The triangle is proposed and measured against, but the pool doesn't
  match it on any of the six pairings.** This is the headline honest
  finding of this session, not a side note — see
  `progress/balance-report-010-phase4-triangle.txt` Part 2. Cortex is too
  strong (should be "flexible," measures as the strongest faction against
  two of the other three); the Swarm-vs-Null edge is inverted (Swarm should
  win, loses 55-81%); Aegis-vs-Null overshoots its intended edge by a wide
  margin. None of this is new information in aggregate (Cortex-vs-Swarm and
  Aegis-vs-Null have been flagged since session 12-13), but this session is
  the first time it's been checked against an explicit, numeric target
  rather than just "is it triple-flagged" — and by that stricter standard,
  the balance pass (roadmap item 3) is further from done than the
  triple-flag framing alone suggested.
- **The Null backstop's step 2 (copy cuts) hit a real structural ceiling:
  the pool has exactly ONE unit of legal backfill headroom left anywhere**
  (Null Shell, Uncommon, was 2/3 copies, now at its cap). Any future copy
  cut to a non-removal Null card will immediately fail the Phase 3 lint
  without either shrinking the deck, trimming one of the three cards the
  original Phase 3 pass explicitly protected as core identity (Kernel
  Panic/Null Singularity/Null Pointer), or growing the pool with a genuinely
  new card (Phase 5 territory, not attempted this session). Fork Bomb was
  named in the backstop's step 2 but NOT cut, for exactly this reason — a
  real, incomplete execution of that step, not silently skipped.
- **Segmentation Fault's new condition (`unitsInPlayAtLeast side:controller
  count:2`) rarely deactivates in practice.** The real-match evidence
  (`sample-match-017-segfault-condition.txt`) does show a genuine OFF->ON
  transition, but only because that specific seed happened to catch Null
  early, before it had rebuilt board presence. Across the full 300-seed
  balance run, the measured effect was tiny (Aegis-vs-Null barely moved
  after this step alone) — Null's kit is wide enough (Fork Bomb's tokens,
  cheap 1-drops) that it holds 2+ units on the board for most of a typical
  game once established, so the condition is usually true exactly when it
  would matter most. The mechanism is real and correctly built (a genuine
  soft counter, not a fake one), but it is a much weaker lever than "made
  it conditional" might suggest on its own — named honestly here rather
  than overclaimed as "fixed."
- **`LookaheadAgent`'s static-effect valuation does not know about
  `Ability.condition` at all** (`estimateStaticEffect`, line ~165-170 of
  `lookaheadAgent.ts`) — it scores a Directive's static aura by its nominal
  magnitude regardless of whether the ability's condition is currently
  true, false, or even checkable from a `PlayerView`. This means the agent
  still slightly overvalues playing Segmentation Fault in a board state
  where its condition wouldn't hold (e.g. an empty board) — the exact same
  category of named, unmeasured approximation as this file's other
  `LookaheadAgent` gaps (session 12's conditional-effect discount, etc.),
  now with a second instance. Not fixed this session (would mean either
  evaluating `Condition` against a `PlayerView`'s public-only information,
  which not every `Condition` kind can currently do, or a documented
  fallback approximation) — flagged rather than silently left.
- **`opponentGraveyardSize` has exactly one user (Entropy Harvester) and no
  dedicated real-match-log demo of its own** — proven correct by a
  whitebox unit test (`nullFaction.test.ts`) and exercised in real games
  via every balance-report run this session made (766-876 "drawn" instances
  per policy in the final report), but unlike Segmentation Fault's
  condition toggle, no dedicated `progress/sample-match-*.txt` isolates and
  narrates this specific mechanism firing in a human-readable log. A
  smaller, deliberate scoping choice this session made to fit the work in —
  named here rather than silently skipped.
- **Step 4 of the Null backstop (cost increases) and any Cortex/Swarm-side
  fix for Cortex-vs-Swarm are both unstarted, on purpose** — see
  `progress/checkpoints.md`'s Phase 4 entry for the specific reasoning
  (both are cross-faction curve/identity decisions this session flagged to
  the owner rather than making unilaterally). Restating here per this
  file's own convention so it isn't mistaken for forgotten.
- **The per-pairing percentage-band translation of the triangle's
  "55-60%/45-55%" targets (`balance-report-010-phase4-triangle.txt` Part
  1) is this session's own first application, not something the
  2026-09-20 entry spelled out pairing-by-pairing.** A reasonable, direct
  reading of that entry's own words, but flagged (also in
  `checkpoints.md`) as a real judgment call the owner should see, same
  category as session 15's removal/debuff classifier.

## New debt from session 15

- **The "removal/debuff card" classifier (cards/poolLint.ts) is this
  session's own first-cut formalisation, not something the 2026-09-20 entry
  spelled out.** It excludes reactive triggers (onAttack/onDamaged/onDeath/
  onTurnStart/onTurnEnd) from the density count on the judgment that a
  card's secondary "it happens to graze the opponent" effect isn't the same
  deck-building commitment as a Command or a standing aura — a real,
  defensible, but genuinely debatable call, not derived from anything the
  owner wrote. Flagged in `notes-for-owner.md` as a checkpoint-style
  proposal; a future session or the owner may want it wider (count reactive
  triggers too) or narrower.
- **The Aegis-vs-Null and Swarm-vs-Null pairings got measurably WORSE, not
  better, after this session's changes** (see `progress/current.md`'s
  "Honest read" section and `progress/balance-report-009-poollint.txt` for
  the full numbers). The plausible driver: Corrupted Process's new draw
  effect made Null's deck more consistent at finding its remaining
  strongest, untouched cards, even while several weaker removal copies were
  cut. Not chased or reverted this session — the 2026-09-20 "Null
  dominance" entry explicitly reserves ability nerfs for after the Phase 4
  triangle re-measure, not before — but it's a real regression on the two
  worst-standing pairings, worth knowing before Phase 4 starts from these
  numbers rather than session 14's.
- **Rule 2 (targeted damage <= cost+1 under 3 mana) and the "clock" half of
  rule 4 are untested against the real pool** in the sense that no current
  card violates either — every existing targeted-damage card already sits
  at or under the cost+1 line, and every faction has attacking units. This
  means the lint's enforcement of those two specific rules is only proven
  by `poolLint.test.ts`'s synthetic cases, not by having actually caught
  and fixed a real violation the way rules 1 and 3 were. Fine for now
  (nothing needed fixing), but a future card author should not assume
  "the lint didn't complain" proves these two paths were ever exercised
  against real data.
- **`findExcessiveTargetedDamage` only checks `ScalingAmount`s with
  `mode: "flat"`** — a future targeted-damage card using `mode: "scaling"`
  (e.g. scaling off graveyard size, like Entropy Harvester's attack) would
  silently skip rule 2 entirely rather than being conservatively estimated
  against its base value. Not exercised by the current pool (no targeted
  damage effect currently scales), so untested, and named here rather than
  silently left as an edge nobody thought about.
- **Fork Bomb's redesign changes its board impact shape, not just its
  flavour** — the old version was instant, guaranteed AOE damage that could
  matter even into an empty board; the new version creates two 1/1 bodies
  that only matter if they survive to attack, and are capped by
  BOARD_SLOTS like anything else (a full board fizzles the tokens the same
  way Brood Reserves' do). This is a real mechanical identity shift for the
  card, not a reskin — whether the new version is stronger, weaker, or just
  different in the situations that matter (an empty vs. crowded board) has
  not been isolated or specifically measured; it's folded into this
  session's aggregate Null re-measurement above, not separated out.
- **Corrupted Process no longer deals any damage on evolve** — Null now has
  one fewer unconditional removal-adjacent tool on its evolution line
  itself (Kernel Panic, the top tier, still does). Whether this changes how
  the evolution line plays against a board full of small units (previously
  Corrupted Process's 3-damage evolve-in could clear a 1-2 health blocker
  on the way up; now it can't) is a real mechanical change with no
  dedicated before/after isolation, same caveat as Fork Bomb above.
- **Phase 3 is done; Phases 4-6 remain entirely untouched** — the counter
  triangle, pool expansion, and the economy tie-in. Restating here per this
  file's own convention so it isn't mistaken for forgotten.

## New debt from session 14

- **Brood Reserves (Swarm's new summon card) measures BELOW average across
  all three agent policies (46.5% Aggressive, 41.2% Random, 43.4%
  Lookahead — every other Swarm card in the pool clusters closer to
  50-55%).** Named honestly, not shipped as a claimed improvement: adding it
  did not help Swarm's flagged pairings and Cortex-vs-Swarm got measurably
  *worse* for Swarm (60.7% -> 66.0% under Aggressive) after this session's
  changes — see `progress/balance-report-007-summon.txt`. The most likely
  read, consistent with this project's own established pattern for
  reactive/situational cards (see session 11's Aegis defensive-card entry
  below): none of the three dummy policies understands "hold this for after
  a board wipe" timing — Aggressive/Random will cast it any time it's the
  biggest/only affordable play, often when the board isn't actually empty,
  which wastes tokens against the BOARD_SLOTS cap and dilutes the deck with
  a below-curve draw. **Not chased or tuned this session** — per the
  2026-09-20 owner-feedback entry's own explicit instruction ("Phases 1-4
  come before any further balance work on Aegis-vs-Null" and the follow-up
  "do not detour to Cortex-vs-Swarter" entry), card-by-card tuning off this
  number is exactly what's superseded until Phase 3/4. Flagging clearly so
  a future balance pass starts from this number, not from "summon seemed
  like a good idea so it must be fine."
- **LookaheadAgent's damage-effect valuation does not know about baseArmor.**
  `estimateEffect`'s "damage" case (agents/lookaheadAgent.ts) still assumes
  the full nominal `amount` lands, exactly as before this session — it has
  no way to read a target's `card.baseArmor` and discount the estimate
  accordingly. This means the agent can overvalue a small damage effect
  against one of the six armored base cards (e.g. scoring a 1-damage ping
  as lethal against a 1-health Aegis Cadet, when in the real engine it's
  fully absorbed and nothing happens) — the same category of named,
  unmeasured approximation as this file's other agent-heuristic gaps (e.g.
  session 12's `maxHealth` tool-bonus omission), not a new kind of problem,
  but a new instance of it worth tracking since it's the first stat the
  *card* itself carries that the agent's damage math doesn't read at all.
- **baseArmor's value (1, applied uniformly to all six current base cards)
  is a first proposal, explicitly flagged as not owner-confirmed** — per
  the entry's own instruction to propose the mechanism at a checkpoint
  rather than finalise it unilaterally. Whether 1 is the right number across
  every faction (Aegis's two armored bases, being genre-appropriate for a
  defensive identity, benefited the most in this session's re-measurement —
  see `progress/balance-report-008-basearmor.txt`'s Cortex-vs-Aegis swing
  under Random, 56.7% Cortex-favoured -> 57.3% *Aegis*-favoured) versus a
  smaller/larger or faction-varying value is unstarted, evidence-light
  follow-up.
- **Adding baseArmor to `swarmLarva`/`aegisSentinel` (both reused
  extensively across the test suite as generic low-cost damage-target
  fixtures, not just in their own evolution-line tests) broke 5 pre-existing
  tests in 4 files** (`boardDevelopment.test.ts`, `nullFaction.test.ts`,
  `effectSystem.test.ts` x2, `aegisInteraction.test.ts`) whose assertions
  had incidentally depended on those cards dealing/taking damage with no
  mitigation. Fixed by swapping the fixture to `signalDrone` (a plain,
  unarmored 1/1) in the three tests that were purely about an unrelated
  mechanic (telegraph arming, AOE reach, targeted damage), and by updating
  the one assertion (`aegisInteraction.test.ts`) that was correctly
  exercising an armored card's own real behaviour. Named here as a pattern
  worth watching: reusing a real, mechanically-live gameplay card as a
  generic test fixture couples unrelated tests to that card's future
  changes — a future card-data change should expect to hit this again
  unless test authors start preferring a small set of deliberately
  "inert" cards (no keywords, no abilities, no baseArmor) for pure fixture
  use. Not fixed structurally this session (would mean auditing/changing
  fixture conventions project-wide, out of scope for this entry).
- **Phase 2 (items 4-5) is now complete, correctly so per the entry's own
  order** — Phase 3 (pool-construction lint), 4 (the intended counter
  triangle), 5 (pool expansion), and 6 (economy tie-in) remain entirely
  untouched. Restating here so it isn't mistaken for forgotten, matching
  this file's own convention from session 12/13's equivalent notes.

## New debt from session 13

- **Cortex-vs-Swarm is now newly triple-flagged (60.7%/64.0%/66.0%,
  Cortex-favoured)** — it was flagged under only 2 of 3 policies before
  this session (58.0%/72.0%/62.3%, Aggressive under the 60% threshold).
  This session's change wasn't aimed at this pairing at all; the most
  plausible cause is Cortex's own two-card trim (Diagnostic Pulse 3->2,
  Diagnostic Loop 2->1, made to fit Force Quit under the 40-card ceiling)
  shifting its curve specifically against Swarm. Not investigated further
  or fixed this session — per the owner's own 2026-09-20 instruction, this
  kind of card-by-card chasing off a single measurement is exactly what
  that entry superseded; Phase 2 items 4-5 and Phase 3-4 come first. Full
  numbers: `progress/balance-report-006-directive-removal.txt`.
- **Cortex-vs-Aegis's improvement (72.3%/60.0%/61.3% -> 71.0%/56.7%/57.3%,
  no longer triple-flagged) is plausible but not proven causally** — the
  reasoning ("Aegis can now destroy Cortex's Mainframe Core aura") is
  consistent with the direction of the change but wasn't isolated (e.g. by
  measuring with Breach Charge removed from the Aegis deck to confirm the
  delta comes from it specifically, the way session 7/8 sometimes did for
  single-card changes). Read as a real, welcome side effect, not a
  rigorously isolated one.
- **The four new directive-destroy cards' numbers (cost 2, Uncommon, 2
  copies, Instant speed, uniform across all four factions) are a first
  proposal, not playtested or owner-confirmed.** In particular, a flat
  cost-2 answer is proportionate to typical Directive costs (3 for
  Cortex/Swarm/Null, 2-3 for Aegis) but wasn't measured against a
  faction-specific alternative; if a faction's directive density or curve
  changes later (Phase 5 pool expansion), this number should be revisited
  rather than assumed still right.
- **`LookaheadAgent`'s directive-destroy valuation (`card.cost * 2`, no
  attack/health signal to read since a Directive has neither) is a named,
  unmeasured approximation** — same category of judgment call as the
  agent's other heuristic constants (see session 12's entries below), not
  validated against how much an ongoing aura is actually worth in a real
  game at the point it gets destroyed (early vs. late, already-paid-off
  vs. brand new).
- **Cortex's trim (Diagnostic Pulse, Diagnostic Loop) was picked by
  judgment ("least distinctive filler"), not by measurement** — no
  per-card win-rate comparison was run before choosing which two cards to
  cut; the per-card instrumentation this session's report re-confirms
  (session 12's own standing feature) could have informed this choice but
  wasn't consulted for it specifically.
- **Phase 2 items 4 (a "summon"/token effect kind) and 5 (bases carry a
  small protection while unevolved) are unstarted**, correctly so per the
  entry's own explicit order, but restating here so it isn't mistaken for
  forgotten. Phases 3 (pool-construction lint), 4 (the intended counter
  triangle), 5 (pool expansion), and 6 (economy tie-in) remain entirely
  untouched.
- **`destroyDirective`'s no-op-when-already-gone path (mirroring every
  other effect's "target vanished before this resolved" convention) has no
  dedicated test** — plausible today (nothing in the current pool can
  remove a Directive twice in the same resolution chain), same category of
  untested-but-reasoned-about edge as several entries below.

## New debt from session 12

- **LookaheadAgent's approximations, named honestly (all inherited from or
  parallel to AggressiveAgent's own documented tradeoffs, not new
  carelessness):** attack/health are read from visible instance fields
  (`card.attack/health` + buffs), not the full static-aura-aware
  `state/queries.ts` (a real agent only ever sees a `PlayerView`, which
  can't run those queries — same reasoning AggressiveAgent's own doc
  comment gives). A `maxHealth` target filter is checked against this same
  approximation, which omits tool bonuses that the real `enumerateTargets`
  includes — a small, named inaccuracy, not a silent one, but it means a
  unit exactly at the `maxHealth` boundary because of an attached Tool
  could be mis-scored as eligible/ineligible when the real engine would
  disagree.
- **A `"conditional"` effect's branch is valued with a flat 0.5 discount
  on the "then" branch, never resolving the actual condition or considering
  "else".** A full `evaluateCondition` needs `GameState`-only facts (e.g.
  `controllerFactionInPlay`, exact hand-size thresholds beyond what a
  `PlayerView` states directly) that aren't cleanly re-derivable from a
  redacted view for every condition kind. This is a real accuracy gap: a
  conditional effect that's *certainly* true or *certainly* false right now
  (fully determinable from public information) still gets the same flat
  discount as one that's genuinely uncertain.
- **A brand-new (non-evolving) Unit's own `"self"`-scoped onPlay effect
  scores 0**, because the unit's own instance doesn't exist in the
  `PlayerView` yet at scoring time (it's created by the very move being
  scored) — there's no real `selfRef` to resolve against. This under-values
  any future card shaped like "this unit enters with a shield/buff on
  itself." Evolution's onPlay (which mutates an *existing* instance) is not
  affected — only a plain new unit's own self-targeting is. Not exercised
  by the current card pool as far as this session found; worth revisiting
  if/when such a card is added.
- **`"random"` scope's expected-value scoring (sum all matches, scale by
  `min(count,n)/n`) is mathematically exact for the total, but treats every
  matching target as interchangeable when computing *which* one to imagine
  hit** — it can't express "this random effect is likely to hit the biggest
  threat" vs. "likely to hit a throwaway unit" the way a real single random
  draw would; only the aggregate expectation is exact, not the
  scenario-by-scenario shape.
- **`applyStatus`'s "denial" value (`approxAttack(unit) * 0.6`) and
  `redirectAttack`'s "prevented damage" value (`approxAttack(attacker) *
  1.2`) are hand-picked constants, not measured or owner-confirmed** — same
  category of judgment call as AggressiveAgent's own heuristic weights,
  named here rather than presented as principled.
- **Phase 1 was the only phase of the 2026-09-20 owner-feedback entry
  attempted this session.** Phases 2 (directive removal, a summon/token
  effect kind, base protection while unevolved), 3 (pool-construction lint
  rules), 4 (the intended counter triangle), 5 (pool expansion), and 6
  (economy tie-in) are entirely unstarted — correctly so per the entry's
  own explicit ordering, but restating here so it isn't mistaken for
  forgotten. In particular, Aegis-vs-Null (and now confirmed,
  triple-policy-flagged Cortex-vs-Aegis) remain flagged and untouched;
  the entry is explicit that Phases 1-4 come before resuming that work.
- **The per-card instrumentation's "played" tally has one known, named
  gap of its own:** a Tool attach or an evolution's resulting card is
  counted via `toolAttached`/`evolve` events, which needed a new `player`
  field added this session — correct going forward, but any *historical*
  match log committed before this session (the `progress/sample-match-*.txt`
  files predating this one) still lacks that field on those two event
  types, so re-analysing an old log with this same method would silently
  undercount Tool/evolution attribution for those older matches. Not an
  issue for `balanceReport.ts` itself (it always plays fresh matches), only
  for anyone re-mining an old committed log.

## New debt from session 11

- **Aegis-vs-Null is STILL double-flagged (79.3%/83.0%, roughly the
  pre-session baseline) after adding real defensive interaction to Aegis's
  kit**, per the owner's explicit 2026-09-19 instruction to leave it flagged
  rather than guess at more fixes. Full detail:
  `progress/balance-report-004-aegis-defense.txt`. The honest structural
  read (not acted on, flagged to the owner in `notes-for-owner.md`): the
  dummy reference agents this project measures balance with may be
  structurally unable to fairly value reactive/situational cards, which
  makes any *future* card of this shape (not just this session's three) a
  measurement risk worth knowing about before adding more.
- **Cortex-vs-Aegis is now double-flagged (72.3%/60.0%) — it was
  Aggressive-only before this session (~70.0%).** A real, if modest,
  regression on a pairing this session's changes weren't aimed at. Not
  investigated further this session (out of the explicit scope the owner's
  feedback entry asked for); worth revisiting when card-pool depth (roadmap
  item 4) or a future balance pass comes up.
- **The first attempt at Aegis's new cards (2 copies each) measured clearly
  worse across every Aegis matchup and was not shipped** — a real
  regression this session caught and backed out of, not silently avoided.
  The decomposition experiments used to investigate it (200 seeds,
  individual and paired card combinations) were throwaway scratch scripts,
  not committed, and produced noisy, non-monotonic results (each card alone
  measured neutral-to-positive; every combination measured worse) that
  don't cleanly isolate a single causal mechanism — read honestly as
  small-sample noise from full-deck reshuffling, not as a precise diagnosis.
  A future session wanting to re-run or extend that analysis has to rebuild
  it from scratch, same caveat session 10's scratch instrumentation left.
- **Copy counts (1 each for Intercept Routine/Tariff Field/Feedback
  Plating) are a first, defensively-chosen number to limit exposure to the
  dilution/misplay problem above, not a playtested or owner-confirmed
  target.** Whether 1 copy is enough for these mechanics to be a *reliable*
  part of Aegis's identity in real play (as opposed to "rarely drawn, rarely
  seen"), versus whether asymmetric copy counts (e.g. more Feedback Plating,
  which showed the strongest solo signal in the decomposition, fewer of the
  others) would do better, is unstarted, evidence-light follow-up.
- **Tariff Field's `cardCostModifier` effect has exactly one user and no
  event log entry of its own** (state/queries.ts's `effectiveCardCost` is
  silent — the tax is only visible as "a card that should have been
  affordable wasn't," never narrated). Proven correct by a direct unit test
  (`effectiveCardCost` assertions plus legal-move gating,
  `engine/test/aegisInteraction.test.ts`), and shown being *played* in real
  match evidence, but not shown *mattering* in a real match's log the way
  `redirectAttack`'s new `attackRedirected` event does for Intercept
  Routine — a future commentator agent would have nothing to narrate for
  this specific mechanic beyond "a card was played." Worth a log event if
  Tariff Field or a future cost-tax card becomes commentary-relevant.
- **Intercept Routine's `redirectAttack` effect always retargets the
  *nearest* (topmost) pending combat-damage stack item, with no way to
  choose among several if more than one is pending at once** (a real, if
  rare, situation once multiple attacks are declared before either
  resolves). Not exercised by any test or observed in real play this
  session — the single-pending-attack case is the overwhelmingly common one
  — but worth naming as an edge the mechanism hasn't been proven against.
- **`resolveAbility`'s new "chosen scope with no target = skip silently"
  guard (effects/resolver.ts) is deliberately permissive**: it can't
  distinguish "no legal target existed when this was offered" (the intended
  case) from a hypothetical future bug that fails to supply a chosen ref it
  should have. Every other caller of a "chosen"-scope ability still throws
  hard on this, which was judged the right balance (the intended case needs
  graceful handling; a real bug elsewhere should still be loud) but is
  itself an unenforced convention, not something the type system checks.

## New debt from session 10

- **Aegis-vs-Null is STILL double-flagged (74.7%/79.0% Null-favoured)**
  after both owner-directed fix steps (Kernel Panic's destroy gained a
  `maxHealth:5` targeting condition; Null Singularity's enemy aura lost its
  health component). Both changes are real, principled, individually
  defensible fixes — not reverted — but neither meaningfully closed the
  gap. Full measurement and reasoning: `progress/balance-report-003-null-fix.txt`.
  Do not re-attempt this exact pairing with another single-card Null nerf
  without reading that file's "honest read" section first — the
  instrumentation there found no single card explains the gap, and the
  more likely real cause (named, not yet acted on) is that Aegis's own
  card pool has too little independent interaction/removal for a deck built
  around stacking value into a few units — a card-set-design change to
  Aegis, not a Null-numbers change.
- **The new `TargetFilter.maxHealth` mechanism has exactly one user**
  (Kernel Panic) and one direct unit test pair (nullFaction.test.ts) plus
  the real-play evidence in sample-match-009. It has not been exercised
  with `scope: "chosen"` (only "random", Kernel Panic's own scope) — a
  future card wanting a player-chosen small-unit-only removal spell would
  be the first to prove that path, and `getLegalMoves`' chosen-target
  enumeration (wherever it surfaces choices to an agent) was not
  specifically audited for this filter beyond confirming the existing
  tests still pass.
- **`maxHealth` is checked against a unit's derived total max health, not
  remaining health after damage — a deliberate design choice (see
  targeting.ts's own comment), not verified against real player/owner
  taste.** A unit chipped down to near-death is just as immune as a full-
  health one if its total max health is above the cap; whether that reads
  right ("big units survive because they're big, not because of how much
  damage they've already soaked") versus the alternative ("a nearly-dead
  big unit should be finishable") is a genre-feel judgment call made
  unilaterally this session, not owner-confirmed.
- **The scratch instrumentation used to investigate Aegis-vs-Null (tallying
  which cards/effects correlate with wins across 60-150 seeds) was
  throwaway, not committed.** The correlational findings are written up in
  balance-report-003-null-fix.txt in prose, but the actual scripts that
  produced them don't exist in the repo — a future session wanting to
  re-run or extend that specific analysis has to rebuild it from scratch,
  unlike `balanceReport.ts` itself which is a real, reusable, committed
  tool.
## New debt from session 9

- **Aegis-vs-Null is still unresolved** — this session deliberately did not
  touch it, per the owner's own 2026-09-17 instruction to do that work when
  roadmap item 3 comes up, not before item 2. Restating it here so it
  doesn't read as forgotten: still the single worst cross-faction pairing
  measured (75-81%, Null favoured), a specific fix direction is written down
  in `owner-feedback.md`, and it is genuinely the next thing to build.
- **The server integration tests are real but only exercise the happy-path
  network shape** (a full match, an illegal-move fault, a third-connection
  close, an OS-assigned port). Not covered: the hello-handshake timeout path
  (`awaitHello`'s 10s timeout — same "would make the test slow" tradeoff
  that motivated making `RemoteAgent`'s timeout configurable; `awaitHello`
  itself has no equivalent override, so this path is still only reachable by
  waiting 10 real seconds), a malformed/garbage `hello` message, and two
  legitimate clients connecting but the *second* one disconnecting before
  the match starts. None of these are exotic — they're realistic client
  bugs a real external agent (stage 9) could actually hit — just not this
  session's scope.
- **`aggressiveDecision.test.ts`'s fixtures are hand-built `PlayerView`
  objects, not ones produced by the real engine.** This proves the ported
  decision logic does what it claims against inputs shaped like the real
  wire format, but it's a different kind of evidence than "the engine
  produced this exact view and the agent chose sensibly" — a future session
  could strengthen this by wiring engine-produced `PlayerView`s (via
  `buildPlayerView`) into the `agents/` test fixtures, though that would
  reintroduce a devDependency on `@ai-tcg/engine` purely for tests, a
  tradeoff not made this session.
- **`server/test/integration.test.ts` uses real OS network sockets and real
  `setTimeout`-based waits** (the third-connection test waits 50ms for
  pairing to "settle" before connecting a third socket) — this is
  inherently a little more timing-sensitive than the rest of the suite,
  even though three repeated runs showed no flakiness this session. Worth
  watching if it ever proves flaky in CI (a different, possibly slower,
  environment than this session's sandbox).
- **No coverage yet for `server/src/cli.ts` itself** (the two-line argv
  wrapper) — only `startServer` (which now holds all the real logic) is
  tested directly. This is a deliberate, low-risk gap (argv parsing is
  trivial and was unchanged by the refactor, verified instead by the manual
  subprocess regression check described in `progress/log.md`), not an
  oversight, but named for completeness.
- **`agents/`'s new barrel (`src/index.ts`) is consumed by `server/`'s
  tests but not by `randomAgentClient.ts`/`aggressiveAgentClient.ts`
  themselves**, which still import directly from sibling files
  (`./client.js`, `./randomDecision.js`) rather than through the barrel.
  Harmless (both work, no duplication), just an inconsistency worth
  normalizing if the barrel gets more consumers later.

## New debt from session 8

- **Aegis vs Null (75-81% win rate for Null, both agent policies) remains
  double-flagged after this session's one fix cycle** — the single worst
  cross-faction number measured across both balance sessions so far
  (worse than session 7's original Cortex dominance). Named explicitly,
  not silently left in `progress/balance-report-002-null.txt` only: the
  fix applied this session (Fork Bomb/Null Shell/Propagating Exploit)
  didn't touch anything Aegis-specific, so this pairing is genuinely
  unresolved, not "probably fine now." A plausible-but-unverified read is
  in the balance report; isolating the real driver (Kernel Panic's
  destroy specifically vs. Null's several stat-decay effects in
  aggregate vs. something else) is unstarted work.
- **Null still beats Cortex and Swarm at an above-50%-but-under-60% rate
  under RandomAgent specifically** (66.7% and 87.3%) even after the fix
  dropped both out of the double-flag (which requires BOTH policies).
  This is the same category of "real, partial progress, not balance"
  debt session 7 left for its own leftover single-flags — worth watching
  as the card pool grows, not necessarily an emergency at 4 factions.
- **Null's fix pass changed three cards together, not isolated one at a
  time** (Fork Bomb, Null Shell, Propagating Exploit) — same tradeoff
  session 7 made with Overload Capacitor/Interrupt Handler. The report
  can't say how much of the Cortex/Swarm improvement came from which of
  the three; a future session could isolate them if that matters more
  than it did here.
- **Kernel Panic's `destroy` and Deprecated Routine's decay debuff had to
  be redesigned from "chosen" to "random" targeting before they worked at
  all**, because of the pre-existing "triggered abilities can't use
  chosen targeting" architectural gap (named below, under "Architectural
  gaps," since the priority rebuild). This means both cards are less
  precise/strategic than originally designed — a Null player (agent) has
  no way to choose which enemy unit Kernel Panic destroys or which one
  Deprecated Routine decays, only "hope the random pick is a good one."
  If that architectural gap is ever closed generally (extending `Move`/
  `playCard` to carry an independent ability-target alongside the
  evolution-base/telegraph-arm structural reference), these two cards are
  natural candidates to upgrade to `chosen` and would likely need a
  re-measurement afterward since a controlled kill is strictly better
  than a random one.
- **`nullMatchDemo.ts`'s "does Null's own stuff fire" search is
  string-matching card names inside serialized log events**
  (`JSON.stringify(e).includes("Fork Bomb")` etc.), not a structural
  check against card ids. This works today because no two cards across
  any faction share a name, but it's a soft convention, not an enforced
  invariant — a future card with a name collision (unlikely, but not
  impossible as the pool grows past ~60 cards) could make this kind of
  demo-seed search silently pass or fail for the wrong reason. Fine for a
  one-off dev script; would need a real fix (filtering by `controller` /
  card id instead of name-matching log text) if this pattern gets reused
  more broadly.
- **Null's 14-card pool has not been played by a human or judged for
  "genre feel," only measured by two dummy heuristics.** Its identity
  (attrition/removal/decay) is coherent on paper and distinct from the
  other three factions', but whether it's *fun* to play against — as
  opposed to just mechanically distinct and (before the fix) oppressively
  efficient — is not something either dummy agent's win-rate numbers can
  tell you. Same caveat DESIGN.md already names for the pacing metric:
  real judgment needs real play, which doesn't exist yet.

## New debt from session 7

- **The balance measurement is a one-off script, not a standing regression
  gate.** `matchSmoke.test.ts` runs on every `npm test` and would catch a
  future crash-class bug the same way it would have caught this session's
  Retaliation Node stack overflow if it had been running enough seeds to
  hit it (it wasn't — 15 seeds/matchup, alternating agents, never happened
  to put two Retaliation Nodes on opposite boards). `balanceReport.ts` has
  to be run by hand (`npm run balance --workspace=engine`); nothing
  re-runs it in CI or flags a *new* balance regression automatically if a
  future card addition reintroduces a dominant archetype. Worth turning
  into a slow/opt-in CI job once the card pool is bigger and balance
  regressions become a real ongoing risk, not urgent yet with 3 factions.
- **Balance tuning stopped at "no double-flagged pairing," not a specific
  target.** Cortex-vs-Aegis (Aggressive, 70.0%) and Cortex-vs-Swarm
  (Random, 72.0%) still individually exceed the 60% flag threshold after
  this session's fix — see `progress/balance-report-001.txt`'s "honest
  read" section. This is real, partial progress, explicitly not a claim
  that the three factions are balanced now.
- **Swarm-vs-Aegis (61.3% Swarm, both before and after) was measured but
  not investigated or acted on this session** — it wasn't touched by
  either of the two card changes made, and finding its root cause is
  unstarted work, not a false claim of being fixed.
- **The stat-outlier/removal-density root-cause read for Cortex's
  dominance is a plausible, evidence-consistent explanation (the fix that
  followed from it worked, measurably), not a rigorously isolated proof.**
  Overload Capacitor and Interrupt Handler were changed together in one
  pass; a controlled experiment (change one, re-measure, then the other)
  was not run, so the report can't say how much of the improvement came
  from which change.
- **Two other onDamaged-AOE cards exist that weren't audited for the same
  mutual-recursion class of bug** as Retaliation Node: Cascade Purge and
  Diagnostic Pulse deal damage via `onPlay`, not `onDamaged`, so they don't
  self-trigger the same way — but this was reasoned about after the fact,
  not verified by grepping every `onDamaged` ability in the pool for "does
  its effect deal damage to something that could itself have `onDamaged`
  with a damaging effect." Retaliation Node (Cortex) is the only current
  card with that exact shape, but a future card with an `onDamaged` effect
  that deals damage should be checked against this class of bug
  specifically, not just trusted because the engine-level fix (checking
  `isAlive()`) happens to generalize correctly — it does generalize (the
  fix is in the shared `applyDamage` choke point, not per-card), but no
  test proves a *three*-unit or *self-damaging* mutual-retaliation chain
  behaves correctly, only the two-unit case this session found.
- **AggressiveAgent was observed spamming a repeatable Instant-speed
  activated ability (Cortex Engineer's heal) many times in a single
  priority window even near full health**, visible in
  `sample-match-007-retaliation-fix.txt`'s turn 18 (six consecutive
  activations). Harmless (energy-gated, no infinite loop, no crash) but a
  real agent-quality gap: the heuristic has no "is this actually useful
  right now" check for its one reactive rule, just "if any playCard/
  activateAbility move exists here, use it." Not fixed this session
  (agent-quality tuning, out of scope for a balance-measurement session),
  named here so it isn't rediscovered as a surprise.

## Resolved this session (session 6)

- **"Cortex and Swarm don't use telegraph/evolution/tools" — resolved,
  with a caveat.** Both factions now have one evolution line, one
  telegraph card, and one Tool card each (`engine/src/data/cards.ts`),
  proven live in `progress/sample-match-006-backfill.txt` and covered by
  `engine/test/boardDevelopmentBackfill.test.ts`. The caveat: this proves
  the system is genuinely cross-faction, not that Cortex/Swarm now match
  Aegis's *density* of board-development cards (Aegis has two telegraphed
  units and three Tools each) — see "New debt from session 6" below.
- **Stale "No CI wiring" claim in the Testing section, below — fixed.**
  Session 5 added `.github/workflows/test.yml` but the debt file was never
  updated to say so, leaving a self-contradicting claim next to
  `progress/current.md`/`progress/log.md`'s session-5 entries, which
  correctly described the workflow as already existing. Confirmed the
  workflow file is real (it runs `npm run typecheck --workspaces
  --if-present` and `npm test` on every push/PR against `main`) before
  correcting the claim.

## New debt from session 6

- **Cortex's deck is now exactly at the enforced 40-card ceiling**
  (`decks.ts`'s `MAX_DECK_SIZE`). Any further Cortex card needs either a
  cut elsewhere in the pool or that constant (itself an untuned first
  proposal from session 4) to move — a real constraint on the "raise
  Cortex/Swarm's board-development density toward Aegis's" option named as
  a next step.
- **Cortex/Swarm board-development density is well below Aegis's.** One
  evolution line / one telegraph / one Tool each, versus Aegis's one
  evolution line (3 cards deep: Cadet→Sentinel→Warden), two telegraphs, and
  three Tools. The mechanic is proven cross-faction now; it is not yet
  *rich* cross-faction. Not a hidden gap — named as the leading option for
  the next session's own next-step note.
- **Molted Stalker evolving from Swarm Larva gives that card two
  competing roles** (a disposable 1-drop played 3x, and evolution fodder a
  deck might want to hold back instead) with zero playtesting or agent
  heuristic awareness of the tension — `RandomAgent`/`AggressiveAgent` have
  no concept of "hold this back to evolve later," so nothing in current
  play actually exercises that decision meaningfully; it's only provable
  mechanically (the whitebox test), not yet observed as a real strategic
  choice in unscripted play.
- **Dormant Exploit's 2-turn Stasis duration and Overclock Shunt's Rush
  grant are both first-guess numbers/interactions, not playtested.** In
  particular, Tool-granted Rush is a new *kind* of interaction (a Tool
  changing legal-move generation, not just live stats/combat) — mechanically
  correct and tested, but its power level (a 1-cost tool turning any unit
  into a same-turn attacker) hasn't been weighed against the rest of the
  Cortex curve.
- **No archetype-level soft-counter analysis exists between the three
  factions** (Cortex/Aegis/Swarm), despite three factions having existed
  since session 4 — design principle 3 names this explicitly and nothing
  has measured or designed for it yet. Not this session's scope, but it's
  aging: every session that adds card-set width without touching this makes
  a future balance pass larger.

## Resolved in session 5 (hardening pass)

- **"No real test runner" — fixed.** `vitest` is now wired up
  (`engine/test/`, `npm test`), replacing `effectSystemDemo.ts` (deleted)
  with 20 individually-reported tests, including a new match-smoke suite.
  See `progress/current.md`/`progress/log.md` for detail. This was the
  single most-repeated item in this file across three sessions — resolved,
  not just re-flagged again.
- **"Nothing stops evolving a unit the same turn it was played" — fixed**
  per the owner's explicit overrule (2026-09-13 stage-3 checkpoint
  feedback, item 4). `moves.ts` now requires `enteredTurn < turnNumber`.
  Regression-tested and re-proven in real play (see
  `progress/sample-match-005-boarddev-fixed.txt`).

## New debt from session 5 (hardening pass)

- **`matchSmoke.test.ts`'s 15-seeds-per-matchup sample is much smaller than
  the 300-game manual stress run session 4 ran** (traded off deliberately
  for keeping `npm test` fast — see `progress/current.md`'s "decisions the
  owner might want to overrule"). It's real, automated, always-run
  coverage that didn't exist before, but it's a smoke test, not a
  statistically deep balance/crash-rate measurement; a genuine "300+ games,
  measure the distribution" pass is still something that would need to be
  its own explicitly-invoked script (or a much slower CI-only test) if the
  owner wants that rigor as a standing, repeatable artifact rather than a
  one-off manual run.
- **The vitest suite covers only `engine`.** `server`'s protocol layer
  (fault paths: illegal move → forfeit, timeout → forfeit) and `agents`
  still have zero automated tests — the exact gap already named below
  under "New debt from stage 2." The test-runner infrastructure now exists
  to fix this cheaply (vitest could be added to those packages the same
  way), but it wasn't done this session, which stayed scoped to what the
  owner's feedback entry actually asked for (engine-focused: the rule fix,
  the energy docs, and "the" test runner, which in context clearly meant
  the engine's hand-written demo scripts specifically).
- **Telegraph delay=2's card choice (Latent Ward) is a judgment call, not
  a playtested or owner-confirmed one.** The owner asked to "try delay=2
  on some telegraph cards and compare how the window feels" — this session
  changed the data and confirmed it still fires correctly in real play,
  but there's no render or spectator experience yet to actually judge
  "how it feels," so the comparison the owner asked for is only
  mechanically possible right now, not yet meaningfully answered.
- **No exception path for "evolve immediately despite entering this
  turn."** The same-turn-evolve fix has no keyword/flag equivalent to
  Rush's summoning-sickness bypass — if a future card wants that as a
  deliberate payoff, it needs new schema work, not just a data flag on
  the existing field.

## Older debt from stage 3 (board-development system / Aegis card set)

- **Evolution strict-vs-loose was decided unilaterally for this first
  implementation**, even though `owner-feedback.md`'s design-directive
  batch explicitly named it an open question to propose, not resolve.
  Only strict (exact base card id) is built; a looser tier-based
  requirement would need real schema work (a tier number rather than a
  specific id) if the owner prefers it. Flagged at the new checkpoint.
- **Telegraphed units keep full stats and are fully targetable while
  pending, but their `onDamaged`/`onDeath` triggers still fire normally if
  killed while dormant.** A pending unit is meant to be "not yet really
  here," but if a card ever wants "this ability shouldn't fire while
  dormant" (e.g. an onDeath draw effect), there's no gate for that —
  every ability except the deferred `onPlay` behaves as if the unit were
  fully active. No current Aegis card exposes this gap (none of the
  telegraphed units have onDamaged/onDeath abilities), so it's untested
  and unresolved rather than incorrect-and-shipped.
- **Tool cards have no ability timeline of their own** — only a flat stat
  bonus and granted keywords (`ToolCard.attackBonus`/`healthBonus`/
  `grantedKeywords`). A Tool that wants an onPlay-style "when attached,
  also do X" effect, or a triggered ability of its own once attached,
  needs new schema work; this was a deliberate scope cut for the first
  implementation, not an oversight, but it does mean Tools are mechanically
  the shallowest of the three new card types.
- **The evolution/Tool structural target and a card's own "chosen"
  ability-target share nothing** — `playCard`'s single `target` field is
  used for the evolution base / Tool host, so no evolution or Tool card in
  this set can *also* have an onPlay effect that needs a separately-chosen
  target (e.g. "when this evolves in, deal damage to target enemy unit").
  Every Aegis evolution/Tool onPlay effect was deliberately written as
  untargeted or self-targeting to avoid this gap. Extending `Move`/
  `playCard` to carry two independent target refs is the real fix, not
  attempted this session.
- **`BOARD_SLOTS` (6, shared between Units and Directives) and `telegraph`
  timing (1 controller-turn) are first proposals, not playtested
  numbers.** The 300-game stress run (see `progress/current.md`) confirms
  they don't break pacing (mean ~17 turns, well under the 40-turn cap,
  consistent with pre-stage-3 numbers) but says nothing about whether 6
  slots feels right strategically — that needs real play, not a stress
  run of two dummy agents.
- **Aegis (14 unique cards) is a real faction, not yet a rich one.** It
  covers the new system plus baseline variety, but has less internal
  depth than Cortex (14 unique, but built to prove every effect-system
  category individually) or genre norms for "a set." No archetype-level
  soft-counter relationship between Aegis and Cortex/Swarm has been
  designed or measured yet (design principle 3) — three factions now
  exist, which is the minimum for a real rock-paper-scissors triangle, but
  nobody has checked whether one actually forms.
- **Cortex and Swarm don't use telegraph/evolution/tools — RESOLVED,
  session 6.** See this file's "Resolved this session (session 6)" section
  at the top and `progress/current.md`. Left here, struck through in
  spirit rather than deleted, so the historical record of what stage 3
  actually shipped stays intact.

## New debt from stage 2 (agent interface / network protocol)

- **The server hosts exactly one match then exits.** `server/src/cli.ts`
  pairs the first two connections, plays one match, and closes. There is
  no matchmaking queue, no way to host multiple concurrent matches, and no
  persistence of results anywhere — all correctly deferred to stage 4
  (match server), but worth naming so nobody mistakes the current
  `server/` package for more than a stage-2 protocol proof.
- **No automated protocol test — RESOLVED, session 9.** The fault-path
  verification described here was real but manual when this was written;
  `server/test/remoteAgent.test.ts` (fake-socket, all fault paths) and
  `server/test/integration.test.ts` (real sockets, real reference clients)
  are now the committed, repeatable scripts this entry asked for. Left here
  rather than deleted, per this file's own convention for resolved entries.
- **Fixed test decks, no deck selection in the protocol.** `cli.ts`
  hardcodes Cortex-for-p1/Swarm-for-p2 regardless of which agent connects
  first. `hello` carries only an `agentName`. Real deck submission (an
  agent should be able to say what deck it's playing, or the server should
  look one up from a collection) is stage 5 (economy/boosters) work, named
  in PROTOCOL.md's "Not yet covered" rather than silently assumed away.
- **No authentication, no reconnection, no spectator feed.** All three
  are named explicitly in PROTOCOL.md's "Not yet covered" section. Anyone
  who can reach the server's port can connect as any `agentName`; a
  dropped connection is a hard fault, not a resumable pause; the event log
  the server already produces isn't exposed to anything but the two
  playing agents. None of these block stage 3 (card set), but stage 9
  (open agent onboarding) cannot ship without at least authentication.
- **`RemoteAgent`'s illegal-move detection is structural (deep-equal) but
  only checks against the exact `legalMoves` list from the *matching*
  `requestId`.** A client that replies to a stale/superseded `requestId`
  (from a previous `requestMove` it already answered, or one that was
  never sent) is silently ignored rather than treated as a fault — this
  was a deliberate choice (see `remoteAgent.ts`'s comment: "stale or
  unsolicited reply — ignored, not a fault") on the theory that a
  confused-but-not-malicious client shouldn't be forfeited for a stale
  message, but it also means a client could send garbage on old
  `requestId`s indefinitely without consequence. Not exploitable to affect
  the actual match (the server only ever acts on a reply matching the
  live pending request), but worth flagging as an asymmetry: the "ignore
  vs. fault" line was drawn without owner input.
- **`agents/src/rng.ts` duplicates `engine/src/state/rng.ts` byte-for-byte**
  (same mulberry32 implementation). This was a deliberate architectural
  choice (a real external agent would bring its own RNG, not import ours;
  `agents/` has zero runtime dependency on `@ai-tcg/engine` on purpose) —
  named here so it reads as an intentional decision, not an oversight, if
  the two ever need to change independently and drift.

## Debt from the priority/reactivity rebuild (session 2)

- **Only Commands, activated abilities, and combat damage use the stack.**
  Units and Directives are deliberately still sorcery-speed-only and
  resolve immediately when played, skipping the stack entirely — a
  scoping decision to keep this session's rebuild bounded, not something
  DESIGN.md asked for explicitly. The practical effect: you cannot
  currently respond to a creature/permanent *entering* play, only to
  spells, abilities, and attacks. If the real card set (stage 3) wants
  "counter target creature spell"-style effects, permanents will need to
  start using the stack too — a real (if mechanical) follow-up, not a
  redesign.
- **Triggered abilities (onPlay/onAttack/onDamaged/onDeath/onTurnStart/
  onTurnEnd) still resolve immediately when they fire, not through the
  stack.** Only the *effect a player deliberately casts/activates* — a
  Command, an activated ability, or a declared attack's damage — gets a
  priority window before it resolves. A triggered ability firing off one
  of those (e.g. Watchtower Relay's onTurnStart energy gain) cannot itself
  be responded to. This mirrors a simplification a lot of digital TCGs
  make, but it is a real simplification versus paper Magic, not the full
  model, and should be named as a decision if the owner reviews it.
- **Nothing can target or interact with the stack itself.** There is no
  "counter target spell" effect kind yet — TargetSpec/EffectSpec have no
  way to reference a StackItem. Natural next step once the effect system
  needs it; not attempted this session (would need real design work on
  what "counter" means for abilities/combat damage, not just spells).
- **`fizzle` logging only covers combat damage.** A spell/ability whose
  chosen target vanishes before it resolves off the stack still silently
  no-ops (via the existing `findUnit`-returns-undefined guards in
  effects/resolver.ts) exactly as it did before this rebuild — it just
  couldn't happen pre-rebuild since nothing was deferred. This is
  survivable (no crash, no wrong damage) but not narrated in the log the
  way a genuine fizzle is for combat.
- **AggressiveAgent's reactive heuristic is narrow.** It only recognizes
  one shape of "worth responding to": a pending combat-damage stack item
  that would kill one of its own units, at which point it looks for a
  legal instant that targets either the threatened unit or the attacker.
  It does not evaluate whether a *spell* targeting its board is worth
  responding to (only combat), does not hold instants up proactively for
  value, and — like the original heuristic — has no lookahead. RandomAgent
  needed no changes here: picking uniformly among legal moves already
  produces genuine, unscripted reactive lines (confirmed in the 60-seed
  stress run — see progress/current.md).
- **Move-count roughly doubled** (mean ~162 vs. the pre-rebuild ~100) purely
  from explicit pass-priority bookkeeping — every single resolution now
  takes two passPriority moves. This is expected and not a balance signal,
  but anything that used `movesPlayed` as a rough proxy metric elsewhere
  should be aware the scale changed.
- **New scenarios (11–12) cover the core algorithm but not its edges.**
  Untested: a stack three or more items deep, both players responding
  more than once in the same window, or an Instant cast mid-resolution of
  another Instant on the *same* player's own main phase interacting with
  sorcery-timing legality at the boundary. The core LIFO-resolution and
  cross-turn-response paths are proven; deeper interleavings are not.

## Architectural gaps

- **The agent interface isn't a protocol yet.** `Agent.decideMove(view,
  legalMoves)` is a same-process TypeScript call. `PlayerView` is already
  shaped like a redacted network payload (no opponent hand/deck), and
  agents never touch `GameState` directly, so the seam is real — but until
  stage 2 actually puts a process/network boundary there, "clean seams"
  is a design intention I've followed, not something proven under an
  actual boundary. Don't count stage 2 as partially done because of this.
- **Triggered abilities can't use "chosen" targeting, and nothing enforces
  that.** `resolveAbility` requires a `chosen` target for scope "chosen",
  but onAttack/onDamaged/onDeath/onTurnStart/onTurnEnd fire automatically
  with no agent-decision hook to supply one — it would throw at runtime.
  I avoided this in every card I wrote (using random/all/self instead),
  but there is no type-level or data-validation check stopping a future
  card (or a future me) from writing a triggered ability with
  `targeting: {scope: "chosen"}` and only discovering the crash when that
  trigger actually fires in a game. This needs either a validation pass
  over the card pool at load time, or a real design for opponent-facing
  reactive choices (Magic-style "target player chooses" at trigger time),
  before the card pool grows much further.
- **Directives can never leave play.** There's no destroy/remove path for
  a Directive once played — no card in the pool tries to remove one, and
  the engine has no code for it. A "destroy target directive" effect would
  need new work, not just a new card.
- **No "summon" effect kind.** Can't create token units. Not used by any
  card in the current pool, but it's a common-enough mechanic in the genre
  that its absence is a real gap, not an oversight to leave undocumented.

## Card pool / balance

- The 21-card Cortex / 20-card Swarm pools exist to exercise every
  mechanic category (that's proven — see `effectSystemDemo.ts`), not to
  be balanced. Stats and costs are estimates, not playtested numbers.
- The 60-seed stress run's 34/26 win split (Aggressive-Swarm over
  Random-Cortex) is exactly what you'd expect from "greedy heuristic beats
  blind random" and says nothing about faction balance or metagame health.
  Don't read it as a balance signal.
- Deck construction currently enforces only the copy limit. There's no
  minimum/maximum deck size rule, no format restriction. Fine for a stage-1
  test pool; don't assume "deck construction" is a solved stage-5 problem
  because copy limits work.

## Agent quality

- `AggressiveAgent`'s target-selection heuristic estimates unit health from
  base stats + buffs only (`approximateHealth` in `aggressiveAgent.ts`) —
  it ignores live static auras, so it can occasionally misjudge a trade
  when an aura is in play. This is acceptable for a "dumb" stage-1 agent
  (the whole point is that real agents arrive in stage 2+), but it means
  the agent is *less* accurate than the engine it's playing against, which
  is a slightly odd asymmetry worth knowing about rather than discovering
  later.

## Testing

- **Updated, session 5:** there is now a real automated test runner
  (`vitest`, `engine/test/`, 20 tests, `npm test`) — the rest of this
  entry is what's still missing, not a restatement of the old "no runner
  at all" gap. `cli.ts` and `aegisMatchDemo.ts`/`backfillMatchDemo.ts`
  remain manual/eyeballed real-match evidence generators (that's their
  job — narrated human-readable logs, not assertions), not a substitute
  for the assertion suite anymore.
- **CI wiring — fixed, session 5** (`.github/workflows/test.yml`, added
  same session as the test runner itself; this line previously and
  incorrectly still said "no CI wiring" — corrected in session 6 after
  confirming the workflow file is real). `npm run typecheck --workspaces
  --if-present` and `npm test` now run on every push/PR against `main`,
  and `auto-merge.yml` waits on it by name.
- **`server`/`protocol`/`agents` having zero automated tests — RESOLVED,
  session 9.** See this file's "New debt from session 9" section above and
  `progress/current.md`/`progress/log.md` for what shipped (81/81 tests
  across all four packages). Left here, struck through in spirit rather than
  deleted, so the historical record of what was missing stays intact — same
  convention session 6 used for the Cortex/Swarm board-development backfill.
- Untested paths I know of: simultaneous lethal (both players' health
  reaching 0 on the same resolution → draw) has code
  (`checkGameOver`) but no test exercising it; a unit carrying two
  statuses at once (e.g. Overload + Stasis) has no test proving they
  don't interfere with each other's duration bookkeeping; a stack three or
  more items deep (named below under the priority-rebuild debt) also has
  no test.

## Pacing

- DESIGN.md's "5–6 minute watchable match" principle is measured here only
  as turn-count/move-count (mean 17.4 turns over 60 games, well under the
  40-turn cap — see `progress/current.md`). That's a legitimate proxy for
  "does the game end in a reasonable number of decisions," but it isn't
  the real target metric, which is wall-clock watch time once there's a
  render with real animation pacing. Don't tune further against turn-count
  alone once stage 6 exists — re-measure against real time then.
