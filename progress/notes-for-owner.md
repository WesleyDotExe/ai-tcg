# Notes for the owner

**Updated 2026-11-06, session 82 (season end, part 1). [OWNER CHECK-IN] (the next season's file, before part 2 is
built).** Nothing is blocking. Checked first: no open PR from either lane; the last merged was #142 (session 81).
The other open game items wait on things outside this lane: the unit badges wait on the render lane naming them,
and hiding hands waits on network agents joining. So season end was next, as the order says.

**1. Built: ending a season.** You ask for it with `POST /api/admin/season/end` (house admin only, the body names
the season: `{ "season": "S0" }`). The ladder stops starting rounds, lets the matches on screen finish (they pay
and rate as normal), then ends the season in one step:
- the tier coins first (Platinum, Diamond, Mythic, by each owner's tier at that moment);
- then the final standings, frozen: rank, rating, tier, W-L-D, and the owner and agent names at that moment;
- then every Prototype run retired, with how many copies it found. The unpulled copies are gone forever.

After that the Season 0 file is a sealed archive: no match starts, no rating moves, no Prototype can be minted.
The database itself refuses these, so a hand edit can't undo the end. `GET /api/season` shows the state to
everyone, then the standings, your line and the retired runs. In the demo (`progress/season-end-001.txt`, 11 PASS),
the season ended 3 minutes after the ask, once both matches on screen had finished. Three more hours of ladder then
played nothing. The pack seed that gave a Prototype before the end gave a Gold after it.

**2. Not built: the Season 1 file (part 2).** ECONOMY.md already says each season is its own file. Collections,
credits, pack points and ranks reset; the signature card carries over, and so does anything you exempt. The
following is still open, or was written two ways. My proposals, for you to keep or change:
1. **Cosmetics:** your 2026-10-19 boast answer said cosmetics carry over a reset. Your 2026-11-01 list called it
   undecided. Proposal: **all owned cosmetics and every agent's loadout carry over** (boasts, coins incl. the tier
   coins, anything bought). They are account-bound and were never pay-to-win.
2. **What else carries:** accounts and logins, account settings, the Home board, agents and their names, signature
   cards with their bound copies, cosmetics. **Starts empty:** collection, decks, credits, pack points, ratings,
   match history, notifications, the daily pack bank. Old matches stay readable in the Season 0 archive.
3. **Unopened packs:** proposal: **cleared**, like credits and pack points (the same hoarding reason as your
   2026-10-05 rule 4). The alternative is carrying them, since an S0 pack stays openable (your 6A). If they're
   cleared, the site should warn about unopened packs before the end.
4. **The ratings' soft reset:** proposal: **new rating = 1500 + (final - 1500) / 2, RD 250, volatility kept, and
   every owner places again (5 matches)**. Example: a 1827 finisher starts at 1663 (Platinum once placed); a 1182
   starts at 1341. The final standings stay in the archive.
5. **Cards to start with:** collections reset, so every owner needs a deck again. Proposal: **the same starter
   grant a new owner gets today** (their faction's starter deck, bound, plus the starter packs), for every owner
   in the new file.
6. **The archive between the end and the new file:** proposal: **freeze everything** in an ended file (packs,
   salvage, crafting and shopping refused too, not only matches). Today only matches and ratings are frozen, since
   the rest resets anyway.
7. **When Season 0 ends:** it runs 6 weeks from 5 Dec, so about 16 Jan 2027. Proposal: **you press it** (as built)
   rather than the server ending it on a date. Part 2 can add a scheduled end if you'd like one.

**Small calls in part 1 you may want to overrule:**
- The standings list owners who have at least one rated match. An owner who never played isn't in it (they had no
  tier and no coin).
- If the server restarts while the ladder is draining, the request is forgotten. The admin asks again; the shown
  matches are cancelled, as on any restart.

---

**Updated 2026-11-06, session 81 (the hardening pass; your CI-demo entry).** No check-in this time, and
nothing is blocking. #141 was still open at the start, so the fix went on its branch first. Its `test` passed and
it merged.

**1. Why `ladder-demo-002-live` failed in CI: a race, not a game bug.** The demo runs the server and its client in
one process. The ladder's first round (deck builds and matches, run on the main thread in the demo) froze that
process for longer than the server's 5 s keep-alive timeout. The demo's next request then went out on an idle
connection just as the server closed it: `read ECONNRESET`. I made it fail every time by running it on one busy
CPU core. The fix is a small `fetch` for the demos that retries a connection reset before any answer, as a browser
does. All 13 API demos use it, and nothing they print changed. Under load it went from 0 of 3 runs passing to 3 of
3 (`progress/demo-reliability-001.txt`).

**2. A failed demo now shows its whole error** in CI: the script, the exit code, the last 60 lines of stderr and
the last 10 lines it printed.

**3. The rule-change rebuild burst (session 80's open question) is measured** (`progress/ladder-stall-001.txt`).
When every agent deck must rebuild at once, the first round waits about 3.6 s per deck on 3 worker threads (48 decks:
about 3 minutes). The owner API kept answering the whole time (worst 67 ms).

**Two small things you may want to overrule:**
- I fixed the demos' side (retry) rather than the stall. The real server builds decks on worker threads, so the
  site doesn't freeze like the demo did. Its one main-thread pause is playing a round's matches (0.4 s for 24).
- A tip for re-running a failed PR: re-run `test` first, then the auto-merge job. On #141 the auto-merge was re-run
  first, saw the old failure and stopped.

---

**Updated 2026-11-06, session 80 (the auto-merge pin; the builder rule switched on at 1 SD; the launch-gate
re-run). [OWNER CHECK-IN] (the launch-gate re-run, as your 2026-11-06 answer asked).** Nothing is blocking: both of
your answers are built, and the next session goes on without waiting. Checked first: no open PR from either lane,
and the last one merged was #140 (session 79).

**1. The auto-merge fix is in, as you OK'd (all three parts), and nothing else in the workflow changed.**
- The Merge step passes the job's own head commit as `sha`. That is the commit whose `test` run the job waited on,
  so GitHub refuses the merge if a newer commit has been pushed.
- When GitHub refuses because the head moved (409), the job ends green with "Not merging <sha>: a newer commit was
  pushed; its own auto-merge job merges it." Any other refusal still fails.
- A `concurrency` group per PR (`auto-merge-pr-<number>`, cancel-in-progress) cancels the older commit's waiting
  job. A cancelled job shows grey, not red.
- 5 new tests on the shipped script, in `server/test/autoMergeWorkflow.test.ts`. They include the #139 case
  (commit B is pushed while A's job waits: A's job doesn't merge and ends green, and B merges only after B's own
  `test` passes) and a real failed `test` on B stopping the merge. 4 of the 5 fail on the old workflow; the fifth
  (a 405 still fails) passes on both, as it should. Sessions 75 and 77's 15 tests still pass.

**2. The builder rule is on at 1 SD, as you said.**
- The store's deck builder now keeps the designed deck unless another deck beats it by more than 1 standard
  deviation, paired, on the builder's confirm games (`DEFAULT_BUILD.keepDesigned: 1`).
- Every agent deck records the rule that built it (schema v25, `"keep-designed:1"`). `GET /api/play`'s
  `agentDeck.builtFrom` and the rebuild job's result show it.
- A deck built under another rule (every deck before today) gets a new rebuild reason, "the builder's rule
  changed", so it is rebuilt through the normal path, once. `progress/builder-rule-001.txt` shows this on a real v24
  file: four agents' decks survive the migration unchanged, each asks for one rebuild, and the rebuilt Aegis and
  Null decks change to their designed lists (25 PASS).
- 15 demos regenerated, and I read every diff. Most are the schema line. The rest are agent decks that now keep
  the designed list where the old pick led by less than 1 SD (e.g. demo 014: Swarm 47.8% -> its starter list at
  45.5%; Cortex 59.5% searched -> designed 59.3%). Then the showcase matches after them play differently.

**3. The launch-gate re-run on the shipped builder: `progress/built-deck-ring-007.txt`. Both ring checks PASS**
(`progress/launch-gate-s80/ring-gate.txt`, `ring-real.txt`; they play the shipped decks, so they match their
baselines exactly, as they should). Same collections and seeds as 005 and 006. The run uses the store's own
builder, with no test flag.
- **It is identical to session 79's 1-SD test run** (`built-deck-ring-006-z1.txt`): all 16 builds have the same
  decks, all 8 ring files match byte for byte, and only the report's header line differs. What the test measured
  is what shipped.
- Against 005 (the plain rule), each faction's mean over its three edges (50 = even):

| | full | 37 packs | 17 packs | 3 packs |
|---|---|---|---|---|
| real mode, 005: furthest from 50 | **Null 39.2** | Null 47.9 | Null 46.3 | Swarm 46.5 |
| real mode, 007: furthest from 50 | Aegis 53.3 | Aegis 52.4 | Swarm 47.2 | Swarm 46.2 |
| real mode, in / unresolved / out: 005 -> 007 | 0/4/2 -> 0/4/2 | 0/5/1 -> 0/5/1 | 2/2/2 -> 0/4/2 | 1/3/2 -> 1/3/2 |
| gate mode, 005: furthest from 50 | Null 40.2 | Cortex 56.4 | Cortex 58.6 | Cortex 55.8 |
| gate mode, 007: furthest from 50 | Null 46.5 | Cortex 55.4 | Cortex 57.2 | Cortex 54.4 |
| gate mode, in / unresolved / out: 005 -> 007 | 1/3/2 -> 1/4/1 | 1/3/2 -> 1/3/2 | 2/2/2 -> 1/3/2 | 1/3/2 -> 3/1/2 |

- **Better:** the full-collection Null problem is gone (real 39.2 -> 50.0, Swarm > Null 69.4 -> 53.0). In real
  mode every faction now sits within 3.8 points of even at every level (005: up to 10.8).
- **Not better:** at 17 packs, real mode loses its two IN verdicts. Cortex > Swarm moves 57.8 -> 58.4, still
  inside its band, but its interval now crosses 60, so it reads "unresolved". Swarm > Null drops 58.0 -> 53.6,
  unresolved, with its interval reaching just into the band. That second move comes from stronger Null decks (Null's
  17-pack mean goes 46.3 -> 50.5), the change this rule was for. Null > Aegis
  stays under its band at every level (49.5-53.0 real), as it already was with the shipped decks; that is the
  next set's job, as agreed. Cortex > Swarm in gate mode still overshoots at the pack levels (62.7-64.2), the
  overshoot you accepted.
- **My read:** this passes the bar you passed 001 on, and it is better balanced than 005. It is your call; nothing
  else waits on it.

**Calls I made (your call on each):**
1. **A deck built before today is treated as "built with the plain rule"** and rebuilt once. Every one was built
   that way, so the rebuild reason is true for each. Owners who force a deck are untouched.
2. **The rule is recorded as an id** (`keep-designed:1`, `plain`), with a sentence for it in the rebuild reason. A
   later margin change (say 1.5) would rebuild every agent deck once, the same way.
3. **The house agents' decks in the ladder demos changed** with the rule (the demo's 8 owners), and so did every
   match after the first rebuild. Every check in both ladder demos still passes (10 and 9). Those demos are a showcase, not a
   measurement.
4. **The builder can still be run on the plain rule** for measurement (`keepDesigned: null`, or
   `builtDeckRing.ts build --keep-designed off`). The store never does.

---

**Updated 2026-11-06, session 79 (the test-only Null deck-builder session). [OWNER CHECK-IN] (the builder rule, as
your 2026-11-03 answer asked, before the launch-gate re-run).** Nothing is blocking: the store's builder is
unchanged until you answer. Your answers to session 78 (the Stats page) are done: all 5 kept, nothing changed.

**1. PR #139's CI times.** The demo drift check took **1 min 31 s** on the PR's final commit (1 min 33 s on its
first), and the whole `test` job **6 min 59 s** (7 min 01 s on the first). The engine suite is the biggest part
(3:49), then the browser check (0:48), the two ring checks (0:17 each), the type check (0:04). About 5 minutes of
room left inside the 12-minute auto-merge wait.

**2. Found while reading that run: the auto-merge can merge a commit whose tests haven't finished. Proposal only,
not changed** (you OK `auto-merge.yml` changes one purpose at a time). On #139, session 78 pushed a second commit
2 minutes after opening the PR. The first commit's auto-merge job was still waiting; when *that commit's* `test`
passed (02:44:29 UTC) it merged the PR (02:44:33), and by then the PR's head was the second commit, whose `test` was
still running (it passed at 02:46:16, so nothing bad landed this time). The "Merge" step calls the merge without
naming a commit, so GitHub merges whatever the head is. A third commit pushed at 02:44:57 never reached main (it
only held the CI times; they are in point 1 now). **The fix:** pass `sha: pr.head.sha` in the Merge step. GitHub
then refuses the merge if the head has moved, and the newer commit's own auto-merge job merges it after its own
tests pass. One line, plus a test on the workflow's script like sessions 75 and 77. Say yes and the next game
session does it first.

**3. The Null builder rule (your call).** Built as you asked, **test only**: `keepDesigned` in the deck builder,
off by default. With it on, the designed deck is the incumbent. Another deck (the builder's rating deck or its
searched deck) replaces it only when, on the builder's 400 confirm games, it wins more than noise more of the
games where the two decks' results differ (the same paired test the search already uses, at a margin in standard
deviations). I re-ran the built-deck ring on session 71's collections and seeds at two margins: 2 SD
(`progress/built-deck-ring-006.txt`) and 1 SD (`-006-z1.txt`). The summary is in
`progress/null-builder/README.txt`.

| real-match mode | today (005) | 2 SD (006) | 1 SD (006-z1) |
|---|---|---|---|
| full collection: in / unresolved / out | 0 / 4 / 2 | 0 / 2 / 4 | 0 / 4 / 2 |
| full: Null's mean (50 = even) | **39.2** | 51.5 | 50.0 |
| full: Swarm > Null (band 55-60) | **69.4** | 53.0 | 53.0 |
| full: the faction furthest from 50 | Null 39.2 | Cortex 43.6 | Aegis 53.3 |
| 37 / 17 / 3 packs: furthest from 50 | 47.9 / 46.3 / 46.5 | 52.0 / 47.7 / 46.3 | 52.4 / 47.2 / 46.2 |

- **Both margins fix the full-collection Null deck.** From a full collection the builder now keeps the designed
  Null list. The rating deck it used to pick wins only 2 games more out of 400, and that isn't a real difference.
- **They differ on Cortex.** From a full collection the builder's Cortex rating deck beats the designed list by 19
  games (1.6 SD). At 2 SD the builder throws that deck away. Full-collection Cortex then falls to 43.6, and
  Aegis > Cortex goes out of band at 62.6. At 1 SD it keeps the deck, and Cortex stays at 48.3. At the pack
  levels the two margins differ only by noise, and both are close to today.
- **Recommend: switch it on for the store at 1 SD.** That fixes Null and leaves the Cortex deck alone. At 1 SD
  "more than noise" is a weak bar, but it is the same bar the search already uses for every change it keeps.
  Other options: 2 SD (stricter, costs Cortex as above), or leave it off.
- **What switching it on changes:** every owner's agent deck where today's builder picked a deck that wasn't
  clearly better than the designed list. In the ring's collections that is 30 of 100 decks at 1 SD (the full Null deck and 29 of the 96 realistic owners' decks), and 45 at 2 SD.
  The economy demos that print builder decks will need regenerating; the demo check in CI will list them. Then
  the launch-gate re-run.
- Not touched: the edges that were already off with the shipped decks (Null > Aegis 52.1 under its band, and Null
  ~ Cortex 58.0). The builder rule doesn't affect them.

---

**Updated 2026-11-06, session 78 (the demo check in CI; "Time's up"; the Stats page's data). [OWNER CHECK-IN]
(the Stats page's shape, as roadmap 2e asked).** Nothing is blocking: it is built on the proposal below and the
next session (the Null builder session, 2f) doesn't depend on your answers. Your answers to sessions 75-77 are
done: notifications, the play-time allowance and the demo check, all kept as you said.

**1. The demo check is in CI**, as you OK'd (option a), and only that step was added to `test.yml`: `npm run
demos`, the 24 fast demos. It caught its first case in this very session: the schema bump to v24 left 9 demos
stale (the schema line only), and they are regenerated. Locally it takes about 35 s on 4 cores. **The CI time:**
not measured yet. This session couldn't wait for PR #139's GitHub run to finish. The next game session reads that
run's step times and writes them here. Locally the step adds ~35 s to a run that already took a few minutes, so it
should stay well inside the 12-minute auto-merge wait.

**2. "Done for today" now reads "Time's up".** `GET /api/play`'s `autoPlay.allowance` has a new `label`:
"Running", "Finishing match" or "Time's up". I kept the state value `done` as it is, because the website's ring
already reads it and renaming it would break the render lane's page until it changes too; the label is the text to
show. The render lane uses "Time's up" when it next touches Agent controls, as you said.

**3. The notification clean-up rule** is on the launch items in `progress/roadmap.md`, before the public launch.

**4. The Stats page's data: `GET /api/stats`.** One call gives the Stats page and the Rating & form widget at S, M
and L: totals (matches, wins, losses, draws, void, win rate, best streak, the current streak, credits from
matches), win rate by your faction and by the opponent's faction, the recent results, the rating chart with the
weekly trend, and today's earnings. `?agent=` is the "All agents" / one-agent filter. To count factions, each
match now keeps the faction both decks played (schema v24). `progress/stats-001.txt` runs it on the real ladder:
Ada plays 12 matches on two agents across two days, then reads her stats a week later; 13 checks pass, each figure
checked against the match history.

**Calls I made (your call on each):**
1. **The rating doesn't change with the agent filter.** There is one rating per owner, so the chart and the weekly
   trend are the owner's under every filter; everything else follows the filter. A per-agent rating would be a
   second rating system. Keep it?
2. **Cancelled and abandoned matches are "void" in every count**, as the economy pays them nothing: they count as
   a match but are never a win or a loss, and never break a streak. An abandon is still rated (a loss for the side
   that walked out), so it moves the chart. A draw breaks a streak. Keep these?
3. **The chart is one point per Sydney day** (the rating at the end of the day; idle days carry it over), 30 days by
   default, 7 to 90 on request. The "weekly trend" is now minus the rating at the end of the day 7 days ago. Or
   one point per match?
4. **Matches from before today's change have no faction**, and I didn't guess one (decks are rebuilt in place, so
   today's deck can't say what an old match played). They show as "not recorded". Season 0 hasn't started, so
   only test matches are affected.
5. **Quests and achievements are left out**: the Stats page lists them, but they come after Season 0 with daily
   quests and the weekly challenge.

---

**Updated 2026-11-06, session 77 (the auto-merge guard; notifications). [OWNER CHECK-IN] (the notification list,
as roadmap 2d asked).** Nothing is blocking: both are built and the next session goes on whatever you answer.
Session 76's five calls (the play-time allowance) and session 75's call (the demo check in CI) are still open, below.

**1. The auto-merge guard is in, as you OK'd.** The "Wait for checks to pass" step now merges only when the `test`
check run exists for the PR's head commit and passed. If it's missing (the PR #137 case: no test run at all), it
waits the usual 12 minutes, then fails with "no test run for this commit". A skipped or neutral test run is not a
pass. Session 75's retries are kept, and nothing else in the workflow changed. 6 new tests; all 6 fail on the old
workflow. At the start of the session I checked for an open PR from either lane: there were none.

**2. Notifications.** The bell and the Notifications widget have their data: `GET /api/notifications` (newest
first, in pages, filter by kind, the unread count for the badge), `POST /api/notifications/read` and `/clear`
(`{ ids }` or `{ all: true }`). `progress/notifications-001.txt` runs it on the real ladder at watch speed: Ada's
daily pack, a big pull, her 4 matches and "your agent's 30 minutes are up" after the last one, then the rewards cap
for another owner, reading and clearing. 14 checks pass.

**The list (proposed; your call):**

| Notification | When | Switch |
|---|---|---|
| Match result | every match the agent plays, with win/loss, credits and rating change | Match results |
| Big pull | a pack the ceremony gives its full reveal (Gold, Prototype, secret, Zero-Day, Jackpot) | Big pulls |
| Free daily pack | a daily pack is waiting (once a day) | Free daily pack ready |
| Auto-play off | today's rewards are maxed, or the agent's time is up | none: always on |

**Calls I made (your call on each):**
1. **Auto-play off has no switch.** It changes what the agent does, so it is always told. Give it a fourth switch?
2. **A cancelled match is still a match result** (it pays nothing and isn't rated, but the owner sees why). Or only
   wins, losses and draws?
3. **"Big pull" is the ceremony's own rule** (the packs that get the full reveal), not every Mythic: about 1 Mythic
   in 8 packs would ring the bell too often. In Season 0 only the owner opens their own packs, so this records what
   they just watched. Keep it, or drop big pulls until agents open packs?
4. **A switch turned off writes nothing, and turning it back on fills nothing in.** The other option is to always
   write and let the switch hide them, so turning it on shows the history.
5. **House owners get none**, and nothing is ever deleted (cleared ones are hidden). About 60 a day for an owner on
   auto-play all day; a clean-up rule can come before launch.

---

**Updated 2026-11-05, session 76 (the play-time allowance).** Nothing is blocking. It is built as you approved;
five small calls below that I made to build it, all easy to change. Session 75's call (the demo check in CI) is
still open, below.

"Give the agent X minutes" works over HTTP: `PUT /api/play/auto-play` with `{ on: true, minutes: 15 | 30 | 60 }`,
`POST /api/play/auto-play/time` with `{ minutes: 15 | 30 }`, and `GET /api/play` reports minutes and seconds left,
the window's length (for the ring), and running / finishing / done. `progress/play-time-001.txt` runs the real
ladder at watch speed: Ada with 30 minutes, Bram with 15 then +30, Cyra with no limit. Both allowance agents ran
out of time mid-match, finished it (it counted), and weren't paired again. Cyra played on. 13 checks pass.

**Calls I made (your call on each):**
1. **The clock runs on wall time from the start**, including while the agent waits for the next round. Rounds wait
   for every match in them to end, so some minutes are spent idle (about 4 of Ada's 30). The other option is to
   count only time in matches, but then "42 min left" would not count down steadily. Keep wall time?
2. **Midnight cuts the window.** 60 minutes started at 23:30 gives 30, and +15 is refused then. That is how I read
   "no carry-over, resets at midnight". A match running at midnight still finishes.
3. **Stopping drops the time left.** There is no pause. Turning auto-play back on starts a new allowance (or no
   limit).
4. **+15 / +30 during "Finishing match"** gives that many minutes from now, so the agent is paired again next
   round. When "Done for today", start again with 15 / 30 / 60 instead.
5. **No daily cap on time.** After "Done for today" the owner can start again the same day. Only the rewards are
   capped, as before. If "Done for today" should mean done until midnight, that is one line to change.

---

**Updated 2026-11-05, session 75 (hardening pass).** Nothing is blocking. One small call below (still open); session 74's
calls are answered (2026-11-06, keep all) and kept below for the record.

- **The auto-merge retry fix is in**, as you OK'd: the "Wait for checks to pass" step retries a GitHub 5xx or a rate
  limit 4 times (5, 10, 20, 40 s apart), then fails; any other error or a failed check stops the merge as before. Only
  that step changed. Tested on the workflow's own script (9 tests).
- **Found in the hardening pass: 16 of the 24 committed demo files no longer matched what their scripts print.**
  Seven were just the schema number; seven were matches still played under the old 20-health rule; nothing was
  broken. All regenerated. `npm run demos` now re-runs them and lists any that drift, and a test makes sure a new
  demo can't be left off the list.

**One call: put the demo check in CI?** (a) **Yes, the fast set** (recommended): one step in `.github/workflows/test.yml`
running `npm run demos`, about 1.5 minutes. A rule, card or schema change then fails the PR until its demos are
regenerated, so they can't go stale again. (b) **No**: each session runs it by hand (the way they did not, before).
I won't touch `test.yml` until you say.

---

**Updated 2026-11-05, session 74 (featured picks and viewer counts). [OWNER CHECK-IN] (the "Top rated" rule, as
you asked).** Nothing is blocking: both are built on the rules below and the next sessions go on whatever you answer.
Session 73's four calls are answered (2026-11-04, keep all 4) and kept below for the record.

Watch live now has its two groups and viewer counts. `GET /api/live` sends `featured: { tournament, topRated }`
(match ids in order) and every live match has `viewers`. `progress/featured-viewers-001.txt` plays six rounds on the
real ladder, so every rating comes from real matches, and checks the picks and the counts over HTTP: 12 checks pass.

**The "Top rated" rule (proposed; your call):**
- Only a match where **both sides are out of placement** (5 rated matches each). A rating before that is a guess.
- Ranked by the **weaker side's** rating at the start of the match. A match is only as good as its weaker player,
  so a Mythic beating a newcomer doesn't rank above two Diamond owners. Ties go to the stronger side's rating, then
  the earlier start.
- **At most 3 matches. No rating floor** in Season 0.
- **Tournament** is always empty in Season 0 (tournaments come after it). It is sent anyway, so the page layout
  stays the same.

**What it looks like in the demo's sixth round** (5 live matches):

| Match | Sides at the start | Weaker side | Result |
|---|---|---|---|
| m21 | Dex 1819 Diamond v Flux 1786 Platinum | 1786 | Top rated #1 |
| m25 | Grid 1371 Silver v Bit 1301 Bronze | 1301 | Top rated #2 |
| m24 | Hex 1167 Bronze v Echo 1375 Silver | 1167 | Top rated #3 |
| m22 | Arc 1663 Platinum v Jot (new) Placement | - | not featured |
| m23 | Ion (new) Placement v Cog 1538 Gold | - | not featured |

**The honest catch:** with only a handful of in-house owners, "Top rated" isn't selective: two of the three picks
have a Bronze side. Also, for the first five rounds of a fresh season (about 35 minutes) everyone is in placement,
so the group is empty while matches are live.

**Three calls:**
1. **The ranking: the weaker side's rating** (recommended), or the average of the two, or the stronger side's.
2. **A rating floor?** I recommend **none for Season 0** (the league is too small), and a **Gold floor (1500)** for
   launch. With a Gold floor, the round above would feature only m21. It is built as an option, switched off.
3. **When nothing qualifies** (a fresh season, or every live match has a side in placement): leave "Top rated"
   empty (as built; the page still lists every live match), or fill it with the best placement matches.

**Viewer counts (proposed; keep or change):** a viewer is a signed-in owner who read that match's live feed in the
last 30 seconds. Each owner counts once, however many tabs it has open. The website reads the feed every 3 s while
the match is on screen and every 15 s in a hidden tab, so an open page counts and a closed one drops out within
30 s. **The two players' own owners count** when they watch, like any live stream. **Just seeing the list isn't
watching:** every page with a live widget reads the list, so counting it would count everyone online. Keep, or
leave the two players' owners out of the count.

**Also done:** `server/OWNER_API.md` says Dial-Up Dime and Neon Nickel are on sale at 300 credits (the store lists
both). The cosmetics test checks every coin against the render's coin looks and passes. Notifications and then the
Stats data are queued in that order. The rolling queue is on the roadmap for after Season 0.

---

**Updated 2026-11-03, session 73 (the 2× vote).** Nothing is blocking. No check-in is open. Session 72's three
calls are answered (2026-11-03, keep all 3) and kept below for the record.

The 2× vote is built, as your 2026-10-05 spec set it: a live match starts at 1× and runs at 2× only while both
owners agree. An owner taps "Ask for 2×" (`PUT /api/live/:id/speed`) or turns on "Ask for 2× in every match" in
Settings -> Play (saved on the account, schema v21). The live view says who asks and who is being waited on. The vote
resets every match, and only the pace changes: `progress/speed-vote-001.txt` plays eleven matches at 2× and the same
seeds at 1×, and each has the same result, log, replay, credits and ratings, shown in half the time (median 3.3 min
against 6.6 min). 20 checks pass.

**Four calls (I recommend keeping each; nothing waits on them):**
1. **A house side agrees to what its player opponent asks.** A house agent has no owner watching, so it can't
   ask. If it never agreed, a player against the house (most Season 0 matches) could never run at 2×. So against
   the house one ask is enough, and house against house is always 1× (it's what spectators watch). Keep, or have
   house sides never agree (2× only between two players).
2. **An owner can take an ask back** (`{ "ask": false }`), and the match returns to 1×. Your spec only said "tap
   to ask". Keep, or make an ask final for the match.
3. **A change part-way through a wait changes only what is left of it.** Half of a 6 s wait gone at 1×, then 2×
   is agreed: 1.5 s left. Keep.
4. **2× doesn't get anyone more matches.** A ladder round still waits for its slowest match, so an owner whose
   match ran at 2× waits for the others before the next round. The vote shortens the watching, not the day.
   Keep for Season 0 (simple and fair), or later move the ladder to a rolling queue (pair whoever is free) so a
   faster match means the next one starts sooner.

---

**Updated 2026-11-03, session 72 (the live-feed asks).** Nothing is blocking. No check-in is open. Session 71's
check-in below is answered (2026-11-03) and kept for the record.

The live view now sends what the render lane asked for and you approved: each side's opening hand (by card id,
with the start), the signature card in full (its stats, keywords, text, art, times played, whether it is waiting,
and what it would cost now), each side's deck faction, and the boast once the last move is out (the same one the
match record then keeps). `progress/live-feed-asks-001.txt` watches six matches through the feed alone and checks
each one against the engine and the record: 67 checks pass.

**Three small calls (I recommend keeping each; nothing waits on them):**
1. **I added the signature card's art reference and flavour text** to what you listed (cost, attack, health,
   keywords, rules text), since the signature card's own art is its headline feature. Keep, or drop them.
2. **"Rules text" is each ability's printed text, one line each.** A signature card whose only text is a keyword
   (one in the demo has just Barrier) sends no lines: the render draws its keywords. Keep, or have the server
   write a line for each keyword too.
3. **The live boast is worked out when the match starts being shown** from the loadouts and deck it started with
   (they can't change during a live match), by the store's own rule, and only sent once the last move is out.
   Keep.

---

**Updated 2026-11-02, session 71 (the 24-health rule shipped). [OWNER CHECK-IN, ANSWERED 2026-11-03] (the shipped numbers, before the
launch-gate re-run, as you asked).** Nothing is blocking; the next sessions go on as planned whatever you answer.

Every match the game plays now runs your rule: "The player going second starts with 24 health; the player going
first starts with 20 and skips its first draw." It is `rules-2`. Every older replay still plays exactly as
recorded under `rules-1` (both on 20).

**The numbers**
- **The first seat:** 53.6% over 2,400 ladder matches (95% interval 51.6-55.6), down from 63.8% under the old rule.
  In mirror matches (same deck, same agent on both sides) it is 54.4%, down from 64.4%. Still a small first-seat
  edge, but no longer a big one. `progress/first-seat-003-rules-2.txt`.
- **The ring check (shipped decks):** both CI checks pass. Gate mode gets better: 3 edges in band, up from 1
  (Null > Aegis and Aegis ~ Swarm move into band). Real-match mode keeps the same verdicts. New baselines recorded.
- **The built-deck ring (the launch gate's own measure):** real-match mode gets worse, 3 edge-levels in band and
  7 out (was 5 and 5). Gate mode: 5 in, 8 out (was 3 and 7). `progress/built-deck-ring-005.txt`. Almost all of this
  is **one deck**, explained in call 1.
- **Match length:** matches run about a turn longer (median 15.5 turns in the mirrors, was 14.5). On the live
  ladder the median watch time goes from 5.9 to **6.7 minutes**, past the 5-6 minute target. 35 of 56 matches
  last 4-7 minutes (was 42 of 61). `progress/ladder-demo-002-live.txt`. See call 2.

**Your calls (I recommend the first option in each; nothing waits on them):**
1. **The full-collection Null deck.** Under the new rule the store's deck builder, given every card, now picks a
   different Null deck. It looked slightly better on the builder's own test (214 wins of 400 against 212 for the
   designed deck, which is inside noise), but it loses badly to the built Swarm deck (Swarm > Null 69.4%). The
   rule itself barely moves balance: on the same decks, no faction's average moves more than 1.6 points.
   I rebuilt it with two other search seeds: Null's average over its edges is 45.3 and 43.7, against 39.2 for
   the first deck and 49.2 for the designed deck on the same rule. So every deck the builder picks is worse than
   the designed one (`progress/rules-2-ship/null-noise/README.txt`).
   **Recommend:** a test-only builder session before the launch-gate re-run. The builder would keep the designed
   deck unless another deck beats it by more than noise, then the built-deck ring would be re-run. Other options:
   accept it, or score the builder against built decks as well as shipped ones (bigger change, slower builds).
2. **Watch time 6.7 minutes.** **Recommend:** speed up the live watch pace a little so the median comes back to
   about 6 minutes, for example a move's wait from 6 s to 5.4 s (`WATCH_PACE_MS`, `server/src/ladder/timeline.ts`;
   the rules don't change). Other options: accept 6.7 minutes, or wait for a bigger sample first (this one is 56
   matches).
3. **I changed the engine's default** rather than having the ladder pass the rule in. That way every match
   anywhere plays it (the ladder, the network server, the economy, the balance tools), and no caller can forget
   it. The cost: the tests that assumed 20 against 20 now read the real maximum health, and the render lane's `recorded-close-win`
   scenario moved from seed 3 to seed 1 (seed 3 is now a Null win). `rules-1` lists its 20 and 20 explicitly, so
   old replays can't drift.
4. **The other three first-seat ideas are removed from the engine** (the extra opening card, the first-turn
   energy, no first-turn attack). Their numbers stay in `progress/first-seat-002-fixes.txt`. A measuring file
   that names one of them is refused, not guessed at.
5. **A replay played under an older rules version names that version** (`rules-1`) rather than "measure". Only a
   variant that is no published version is "measure", and it must name every rule field.
6. **The close-win boast still triggers at 5 health or less for both seats.** The second seat starts 4 higher,
   so its close wins may be a little rarer. I left it alone; say if you want it relative to starting health.
7. **The signature-mode report** (not a CI check; no real match plays it) moves Aegis > Cortex from 72.4% to
   75.8%. Noted only.

<details><summary>Session 70's five calls (all kept, 2026-11-03)</summary>

**Updated 2026-11-02, session 70 (the hardening pass: versioned replays).** Nothing is blocking. Replays are
versioned, as your call 6 asked, so the 24-health rule can ship next game session (71) without breaking a single
recorded match. Evidence `progress/replay-versions-001.txt` (14 checks PASS). Five calls I made, each with what I
did; tell me any to change:

1. **A replay carries every card it uses, in full** (new format `ai-tcg-replay/2`), plus the rules version
   (`rules-1`) and the card version (`cards-1`). It plays its own cards, never today's, so rebalancing a card can't
   change an old match. The cost is size: about 25 KB a match against 5 KB before. The other way would be a
   shared card table per version, which is smaller but needs every version kept on the server. Self-contained
   seemed the safer first step for Season 0.
2. **Old replays (`/1`, sessions 67-69) read a frozen copy of today's cards** (`cards-1`, saved in the engine once,
   never edited). They name cards by id only, so this is what keeps them right after a card change. The demo
   shows why it matters: read against changed cards, an old replay's moves can stay legal and quietly play a
   different match (one ended 14-0 instead of the recorded 16-0).
3. **A card change now fails a test until it gets a new card version** (`CARDS_VERSIONS` in
   `engine/src/engine/versions.ts`). That's deliberate friction: no card can change without a new version for
   the replays to name.
4. **A replay played on cards that aren't a published version names no card version** (`cards: null`) but still
   carries those cards and plays. This only happens in tests and measuring tools today.
5. **I made a small change in the render lane's replay reader** (`render/src/capture.ts`, `render/src/site/siteReplay.ts`,
   `siteHost.ts`, one test): it reads both formats through the server's reader and passes the file's rules
   through. Nothing they draw changed.

Also fixed in the hardening pass: two demos that had drifted. `owner-api-demo-002`'s win rates moved with two
card changes it was never re-run for (sessions 60 and 62), and `economy-demo-009` printed a stale "bug" about the
Zero-Day cards, which went live in session 42.

Queued, in order: the 24-health rule as `rules-2` (session 71, the shipped numbers to you before the launch-gate
re-run); then the 2x vote, featured picks (the "Top rated" rule to a check-in), viewer counts, and your three
live-feed asks from render 51 (the signature card, the deck's faction, the boast on the live view).

</details>

<details><summary>Session 69's six calls (all kept, 2026-11-03)</summary>

**Session 69 (coin skins, the game lane's half; starting ratings on the match).** Nothing
is blocking. Coin skins' game half is built as you answered (`progress/owner-api-demo-007-coins.txt`, 13
checks PASS). The 24-health rule is not shipped: session 70 builds versioned replays first, then ships it.
Six calls I made while building, each with what I did; tell me any to change:

1. **The tier coins belong to a season.** Their ids are `coin-s0-platinum`, `coin-s0-diamond`,
   `coin-s0-mythic` (names "Platinum Coin", "Diamond Coin", "Mythic Coin"). I read "a coin for each tier
   reached by the end of the season" as each season having its own three, so Season 1 would add
   `coin-s1-...` (a new look, or the same look with a season mark: the render lane's call). The other reading
   is one Platinum coin for all time, given once. Tell me if you want that instead.
2. **An empty coin slot flips the Chrome Token.** An owner can empty the slot like any other (boasts work the
   same way), and the flip still shows the Chrome Token. Matches recorded before today also read as the
   Chrome Token. The alternative is to refuse an empty coin slot.
3. **The tier is read when the season-end work runs**, from the owner's rating then (placement done; 5 rated
   matches). It has to run before the reset clears the ratings; I wrote that into the season-end item.
4. **The starting rating is kept for every match, cancels too** (`ratingAtStart` on each side, and
   `defaultView`: the higher one, p1 on a tie). For matches from before today, a rated match gives the
   rating it went in with, and an older cancel gives none (so its default view is p1).
5. **The replay keeps the coins as a new optional field** (`coins: { p1, p2 }`) in the same format,
   `ai-tcg-replay/1`. Older replays don't have it and still play. Session 70's versioned replays will give
   this a proper version number.
6. **I made a small change in the render lane's loadout picker.** It built its slots from the economy's list,
   which now has six, and it had no "Coin" label. It now leaves the coin slot out until the render lane's
   second coin slice adds the Coin line, so the picker looks as it did yesterday. That's two files and two
   tests under `render/`, nothing else of theirs.

Not built yet from your render-50 list (queued, in order): the 2x vote, featured picks (I'll bring the "Top
rated" rule to a check-in), viewer counts, and the live board's unit badges once the render lane names them.


</details>

### ~~[OWNER CHECK-IN] The first-seat fixes, measured: my pick is the second seat starting on 24 health~~ (ANSWERED 2026-11-02: ship 24 health after versioned replays; session 70)

All four you named, test only, and five extras (doses and pairs) so you can see how far each lever goes. Full
numbers: `progress/first-seat-002-fixes.txt`. No rule changed: each fix is a test-only option the measuring
tools pass to the engine, and no match the game plays uses one.

First seat's share of decided games (50% is fair):

| fix | mirrors (4,000) | ladder (2,400) | ring check gate / real |
|---|---|---|---|
| as shipped | 64.4% | 64.8% | PASS / PASS |
| (a) second seat +1 opening card | 59.6% | 59.1% | FAIL 2 / FAIL 2 |
| (b) second seat +1 energy, first turn | 55.7% | 55.1% | FAIL 3 / FAIL 1 |
| (c) second seat starts on 22 health | 59.4% | 58.5% | PASS / PASS |
| (d) first seat can't attack turn 1 | 64.4% | 65.6% | PASS / PASS |
| extra: 24 health | 54.4% | **52.3%** (50.3-54.3) | **PASS / PASS** |
| extra: +2 opening cards | 54.3% | 55.0% | FAIL 3 / FAIL 1 |
| extra: +2 energy | 43.8% | 42.3% | FAIL 2 / FAIL 1 |
| extra: (a)+(b) | 49.1% | 48.5% | FAIL 2 / FAIL 2 |
| extra: (a)+(c) | 54.4% | 53.9% | FAIL 3 / FAIL 1 |
| extra: (b)+(c) | 50.7% | 47.8% | FAIL 2 / FAIL 1 |

What it shows:
- **(d) does nothing.** On turn 1 the first player has one energy and no unit that can attack yet (only a Rush
  unit could). The shuffles are the same, so the mirrors come out identical game for game.
- **Cards and energy are the strongest levers, but they move the faction ring.** (a), (b) and every pair with
  them push Cortex > Swarm above its band and Swarm > Null below its band. They help some decks' second seat
  more than others: an extra card does nothing for the Swarm mirror (72% before and after), and energy helps
  Swarm most. The ring check fails, so shipping one would need card changes too.
- **Health moves the seat and nothing else.** (c) passes both ring checks with every edge within about a point,
  and so does 24 health. But 22 health only gets the seat to about 59%. 24 gets it to 52-54%, close to fair:
  the ladder's interval is 50.3-54.3%, and the faction mirrors are inside noise (48.3%).
- **What 24 health costs:** matches run a little longer (median 15.5 turns in the mirrors against 14.5). That is
  still inside the watch-time target; the live ladder's watch length should be re-checked when it ships.

Built-deck ring for the leaders (the store's decks at full, 37, 17 and 3 packs; 24 edge-levels per mode;
counts are in band / unresolved / out):

| fix | real mode | gate mode | largest edge move |
|---|---|---|---|
| as shipped | 5 / 14 / 5 | 3 / 14 / 7 | - |
| (b) +1 energy | 3 / 15 / 6 | 1 / 13 / 10 | 3.6 points |
| (c) 22 health | 2 / 18 / 4 | 2 / 14 / 8 | 2.9 |
| 24 health | 2 / 17 / 5 | 3 / 14 / 7 | 3.3 |
| (b)+(c) | 3 / 15 / 6 | 1 / 14 / 9 | 4.3 |

24 health keeps the gate mode exactly as it is and leaves the same number of edges out of band in real mode.
Three real-mode edges that sat just inside their band slip to "unresolved" (most of the move is Null ~ Cortex
and Cortex > Swarm at 3 packs, +3 points). That's a real cost, but the smallest of the options that fix the seat.
(b) and (b)+(c) push three more gate edges out of band.

**My pick: the second seat starts on 24 health (4 more than the first).** It's the only option measured that
brings the seat near 50% and leaves the ring where it is. Your other choices: (c) as you wrote it (22, about 59%,
ring unchanged), or (a)+(b) (about 49%, but the ring moves and the cards would need retuning).
**Nothing ships until you pick**, and versioned replays (your call 6) land first, in session 70's hardening pass.
Then the fix ships with new ring baselines and a new built-deck ring, before the launch-gate re-run.
Rules text if you pick it: "The player going second starts with 24 health; the player going first starts with
20 and skips its first draw."

### ~~[OWNER CHECK-IN] Coin skins: the game lane's half of the plan (not built; waits for you)~~ (ANSWERED 2026-11-02 with two changes; BUILT session 69)

Your render-half answers are noted (Match Boot placement, Chrome Token for every owner and for spectators, the
coin looks). What I propose for the slot, catalogue, prices and records:
1. **The slot:** a sixth loadout slot, `coin`, on each agent (beside boast, close-win boast, card back, avatar,
   arena). The cosmetic kind `coin`. `GET /api/agents/:id/loadout` gains the "Coin" slot with the same tiles and
   Buy as the others.
2. **The starter coin:** **Chrome Token**, standard (never sold), granted to every owner and equipped on every
   agent by default, the way the starter boast is. Existing owners and agents get it in the migration.
3. **Season 0 store coins:** **Dial-Up Dime** and **Neon Nickel**, **300 credits each** (the season boast's
   price, three packs), in a Season 0 sale window, then retired like the other season cosmetics.
4. **Tier coins** at season end, by the owner's end-of-season ladder tier, placement done:
   **Gold coin** for Gold or higher, **Diamond coin** for Diamond or higher, **Mythic coin** for Mythic.
   A higher tier gets the lower coins too (a Mythic finisher gets all three). Bound to the owner, never sold,
   carried over the season reset with the owner's cosmetics. One thing to know: **Gold is the starting rating's
   tier (1500)**, so nearly every owner who finishes placement gets the Gold coin. If you want Gold to be earned,
   use Platinum, Diamond and Mythic as the three coin tiers instead (and name the coins after those).
5. **The coin on the match record:** each side's equipped coin is written with the match, like the boasts, and
   into the replay (`coins: { p1, p2 }`), so a replay shows the coins the match was played with. The seat is
   still the server's coin flip; the coin never changes who goes first. The record already says who went first.
6. **Spectators:** the API sends both coins; the website shows a spectator the neutral Chrome Token (your answer).
Tell me "build it as proposed" or change any number.

**Updated 2026-11-02, session 67 (the long-lived ladder, Watch live, auto-play, match history).** Nothing is
blocking. One finding needs your decision (the first seat); the other calls are built with defaults.

### ~~[OWNER CHECK-IN] The first seat wins about 65% of matches: pick a fix to measure~~ (ANSWERED 2026-11-02: measure all four; done in session 68, below)

You asked me to measure the first seat over a larger run (`progress/first-seat-001.txt`, `npm run
measure:first-seat -w server`). Over 2,400 ladder matches (8 house agents, 12 Sydney days, decks rebuilt as
packs were opened) **the first seat won 1,554 of 2,400: 64.8%** (95% interval 62.8-66.7%). That is not noise:
it is the same in every quarter of the run (63-66%), in 15 of 16 faction pairings, and for every play style.

It is the game, not the ladder: each faction's shipped deck against itself, the same agent in both seats, no
ladder at all, gives the first seat 58% (Aegis) to 72% (Swarm). The 56% in session 66's demo was the same edge
seen through 71 matches.

Why nobody saw it: every balance measurement so far alternated seats, so the edge was averaged out of the
faction numbers. The balance report's lines called "first-player-advantage baseline" alternated seats too, so
they measured one copy of a deck against an identical copy (about 50% by construction). I relabelled those
lines; they never measured the first seat.

The first player already skips its first draw. That isn't enough. I haven't changed the rules (a balance change
goes to you first). Options to measure (each a small engine change, quick to test on mirrors, then the full ring
and the built-deck ring):
- (a) **The second player draws one extra card** in its opening hand.
- (b) **The second player gets +1 energy on its first turn only** (a one-time head start on the curve).
- (c) **The second player starts with more health** (for example 22 instead of 20).
- (d) **The first player can't attack on its first turn** (on top of not drawing).
My suggestion: measure (a), (b) and (c) on the mirrors in the next game session, bring you the numbers, and
ship the one you pick through the ring and the built-deck ring. This touches every matchup number, so it should
land before the launch-gate re-run, not after. Tell me if you'd rather it wait behind the small asks
(the craft price, promos, "Watch again").

### ~~[OWNER CHECK-IN] Watch live, auto-play and match history: the calls I made (defaults built)~~ (ANSWERED 2026-11-02: keep 1-5, version replays first)

The ladder now runs inside the server (`npm run season -- <db> [port]`: the owner API and the ladder in one
process). The engine plays each match at once, then the server releases it a move at a time at watch speed;
the match is recorded (credits, rating, history) only after its last move has been shown, so no result shows
anywhere early. The website can read Watch live (`GET /api/live`), follow one match move by move
(`GET /api/live/:id`), read match history with each match's log and replay (`GET /api/matches...`), and switch
auto-play (`PUT /api/play/auto-play`). The run is `progress/ladder-demo-002-live.txt` (62 matches over a
Sydney morning, a restart, auto-play turning itself off; every check passes). Six calls; tell me if any is wrong:
1. **The watch pace:** before each move is released, the board holds 6 s after an action, 1 s after a pass, 3 s
   more for a new turn; the result holds 8 s. In the demo, matches ran 5.9 minutes at the median, 4.2 to 8.3
   for most (shortest 3.4, longest 10.5). The render lane may want different holds once it times its
   animations against them.
2. **A restart mid-match cancels the matches being shown:** nobody's fault, so no credits and no rating, as for
   any cancel. Replaying them from the seed would work for the house agents but not for network agents later.
3. **A round waits for its slowest match**, then 60 s, then the next round. Owners whose match ended early sit
   idle until then. The other way is a rolling queue (pair whoever is free); it changes the matchmaker.
4. **Auto-play goes off after the match that maxes the day** (the 10th rewarded win), with "today's rewards are
   maxed" until midnight Sydney, and it can't be turned on again that day. House owners have no switch: they
   always play.
5. **Any signed-in owner can watch any live match and open any recorded match** (its result, log and replay),
   so a featured match can be watched again. Match history (`GET /api/matches`) lists only your own matches.
6. **A replay is the decks, the seed and every move** (`ai-tcg-replay/1`); the engine rebuilds the match
   exactly from it (checked against the log in the tests and the demo). It names cards by id, so a card change
   later makes old replays fail to rebuild; before the first card change in a live season they need versioned
   cards.

**Your 2026-11-02 call 5, done:** the house owners now spend their earned credits on Season 0 packs and open
them at the start of each round. It is the server's policy, not only the demo's. Real owners' credits and packs
are never touched. The session 66 demo, re-run with the server's policy, plays the same 72 matches.

Next game session (68): the small asks you approved for after this one (the craft price and copy limit in the
card viewer, signature cards and promos in the collection API, `GET /api/packs/:packId/opening` as the
`PackOpening` shape for "Watch again"), and the first-seat measurements if you agree. Session 70 is the next
hardening pass.

### [OWNER CHECK-IN] Match running and the ladder: the calls I made (answered 2026-11-02: keep 1-4, (a) for 5; built session 67)

The ladder runs: agents are paired by a Glicko-2 rating, play, and are paid and rated, and each agent's deck is
rebuilt between matches when its owner's cards change. The run is `progress/ladder-demo-001.txt` (8 house
agents, 3 Sydney days, 72 matches; every check against the store passes). The website can read the standings
(`GET /api/ladder`) and each owner's rating and form (`GET /api/rating`). Five calls; tell me if any is wrong:
1. **The tiers:** Bronze below 1350, Silver 1350, Gold 1500 (where everyone starts), Platinum 1650, Diamond
   1800, Mythic 1950 and up; 150 points each. An owner shows "Placement" (and isn't ranked) until 5 rated
   matches. In the demo, after 18 matches each, the 8 agents spread from 1196 (Bronze) to 1776 (Platinum).
2. **An abandoned match counts as a loss on the rating** for the side that walked out (and a win for the other),
   so quitting never protects a rating. It still pays nothing to either side, as the economy rule says. A
   cancelled match (an engine error, nobody's fault) isn't rated.
3. **How opponents are picked:** closest rating, plus a random spread of up to 75 points and a penalty for
   playing the same opponent again (300 for the last one, 150 for the one before), so 8 agents don't replay the
   same four pairs. In the demo: 18 of the 28 possible pairings in 72 matches, one immediate rematch. Two agents
   of the same faction do meet when they sit close in rating. With an odd number one sits out and goes first
   next round. Who goes first is a coin flip (the first seat won 56% in the demo).
4. **RD (how sure the rating is) grows for each whole Sydney day without a rated match**, so an agent back from a
   break moves faster at first. Glicko's standard way; the rating itself doesn't decay.
5. **Should the house owners buy and open packs with what their agents earn?** In the demo each house owner
   spends every 100 credits on a pack and opens it at once, so its agent rebuilds; that is the demo's policy, not
   the server's. In Season 0 the house agents' decks only change if their owners' cards do. Options: (a) yes,
   automatically, as in the demo; (b) no, the house stays on its starter cards plus the daily pack; (c) you open
   them by hand from the admin view. My suggestion: (a), so the house agents show the loop you want to watch.

Not built yet (next game session, 67): rounds on a timer at watch speed with the live state for Watch live,
auto-play for owners, and match history with replays. Network agents on the ladder come after.

### The daily pack is built (from your 2026-10-04 spec)

Your item 6 said to build it only if the economy already had one. It did: section 6 of your 2026-10-04 economy
spec says "one free pack a day that only the owner can claim, stacking up to 2". So it is built:
`GET /api/packs/daily` (how many wait, when the next comes in) and `POST /api/packs/daily/claim`, plus the same
status inside `GET /api/packs` and `GET /api/store` for the Packs and Store widgets. The run is
`progress/owner-api-demo-005-daily-pack.txt`. Three small calls I made; tell me if any is wrong:
1. **A new owner's first day counts:** someone who signs up at 11 pm can claim one straight away, and another
   at midnight.
2. **The pack is the current season's set** (S0 now).
3. **While 2 wait, nothing comes in,** so the Packs widget shows "2 ready" with no timer. Claiming one starts the
   timer to the next midnight again. (The cap is `OWNER_DAILY_PACK_CAP` in `economy/src/config.ts`.)

### The hardening pass

- All eight older economy demos re-run and read line by line. Two crashed and are fixed: `boastDemo.ts` (an
  old-file path in the store; fixed in the store, with a test) and `packOpeningDemo.ts` (its clock crossed
  Sydney midnight, so the day's credits split in two). The rest had drifted for known reasons: the balance
  changes since (Null at 40, NA12/CS7), the newer agent-name generator, and the second odds table. All eight
  regenerated; nothing in them points to a bug.
- The ledger's pages are now read with SQL, not by loading the whole ledger.

Next game session: 66, match running and the ladder.

### [OWNER CHECK-IN] The board and the economy endpoints: the calls I made (defaults built) (answered 2026-11-01: keep 1-5)

1. **The daily reset now really is midnight Sydney.** You set it on 2026-11-01, but the store still counted UTC
   days, so a win at 10 past midnight in Sydney counted on the day before. The day now runs midnight to
   midnight Sydney time, with daylight saving (23 hours on the first Sunday of October, 25 on the first Sunday
   of April). `GET /api/daily` shows the day, when it resets, the schedule, each win today with what it paid,
   and what the next win and loss would pay. Season 0 has no real matches yet, so nothing old changes.
2. **The recommended board gives the Tournament slot (Small) to Store.** Your spec said to swap it for one of
   the Season 0 widgets. Store fits a small slot and its data exists today. Other choices: Match history or
   Notifications, which have no data until match running.
3. **The board is saved as an ordered list with sizes.** That's how the mockup's grid lays itself out. If the
   render lane later wants free placement (gaps, pinned columns), the format grows. Tournament and the League
   pull feed are refused for now with "comes after Season 0".
4. **Buying packs:** 1 to 10 at once, all or none (a 10-pack buy never stops at 6). Opening is 1, 10, or one
   pack you pick.
5. **Salvage asks first.** If a salvage would leave a saved deck short, the endpoint refuses and lists the
   decks. The website then asks you, and sends it again confirmed. Same rule as the store's card viewer.
6. **Not built, because it wasn't on your list:** claiming the owner's daily pack. The Daily rewards widget has
   the earnings bar and the rewarded wins only, as your Season 0 spec says.

**One thing I found:** six of the older economy demo files (`progress/economy-demo-005`, `-006`, `-008`,
`-012`, `-013`, `-015`) no longer match a fresh run. This started before this session. One demo script
(`boastDemo.ts`, demo 012) now crashes. Nothing in the game is affected; the tests all pass. Session 65 is a
hardening pass and will re-run, fix and regenerate them.

Next game session: 65, the hardening pass; then 66, match running and the ladder.

The session 62 check-in below stays for the record (answered 2026-11-01).

### [OWNER CHECK-IN] NA12 and CS7 are shipped; both rings re-run

**What changed** (`progress/balance-report-038-old-edges-shipped.txt`, files in `progress/old-edges-ship/`):
- **Null Pointer:** choose one: Dereference (destroy target enemy directive) or Null Out (target enemy unit
  gets -3/-3 permanently). **Force Quit:** choose one: Terminate (destroy target enemy directive) or Kill All
  (deal 1 damage to all enemy units). Both still cost 2 energy and are instant speed. No other card changed.
- The shipped cards are byte for byte the ones session 61 measured (same fingerprint).

**The removal cap (your check):** it fits, so NA12 shipped. Null Pointer already counted as removal through
its old mode. The lint counts a card once, whatever its modes do, so Null is still 10 of 40, exactly the cap,
in the list and in the starter. Cortex is still 9 of 40. Every deck the builder makes goes through the same
check (`progress/old-edges-ship/removal-cap.txt`).

**One finding: Null Out doesn't kill an undamaged unit.** The engine never lets a unit's max health drop
below 1 from stat changes; a shrink kills only together with damage (the same rule Deprecated Routine
already plays by). So Null Out on a fresh 3/3 leaves a 0/1. It kills any unit with 4 health or less that has
taken any damage. Session 61's note said "kills a 3-health body", and that was wrong. The numbers were
measured under this rule, so the shipped card is the card that was measured.

**The rings:**
- Before I re-recorded the baselines, the real-match check failed on the edge session 61 named: Null ~ Cortex
  50.7% -> 57.1% (in band -> not sure). The gate check passed. Every number matches session 61's run to the
  decimal.
- Real matches, shipped decks: Null > Aegis 45.9 -> 51.2; Cortex > Swarm 53.0 -> 55.2; the other edges inside
  noise. Gate: Null > Aegis 51.6 -> 56.6, Cortex > Swarm 58.2 -> 61.6 (the overshoot you accepted).
- Both baselines are re-recorded (dated 2026-11-01). Both checks pass.
- The built-deck ring (`progress/built-deck-ring-004.txt`) is byte-identical to session 61's run. Faction
  averages are closer together than before (real-match spread 4.3 points, was 5.9). Null > Aegis is still
  under its band at every collection level (49-51%); Cortex > Swarm is 53-57% in real matches.

**Calls I made you might want to overrule:**
1. I shipped Null Out under the existing health rule rather than changing it. The other option is a rule
   change: let a permanent shrink kill (max health may reach 0). That changes Deprecated Routine and any
   future -X/-X card too, so it needs a new measurement and your OK. **My recommendation: keep the rule.**
   It is what was measured. If the text should say so, the card could read "-3/-3 permanently (it can't take
   health below 1)".
2. The recorded "empty boast slot" scenario moved from seed 5 (now a Null win) to seed 9, a Cortex win on
   16 health like the old one. Seeds 2 and 7 were also Cortex wins, but on 1 and 2 health, so they would also
   have been close wins.
3. I left three render pages alone: fx-sheet and skin-sheet only differ by the render lane's own new skip-hint
   style, and pack-opening only by random ids. Those are the render lane's to refresh.

**Next game session:** Season 0, game item 1, match running and the ladder (no decision needed to start).

### [ANSWERED 2026-11-01: ship NA12 and CS7; shipped session 62] The two old edges: one partial fix, one fix with a cost

**What I did** (`progress/balance-report-037-old-edges.txt`, files in `progress/old-edges/`):
- Screened 21 candidate card changes on the ring check, both modes, on the ring's seeds and on fresh seeds.
- First found where to aim: I cut one copy of every shipped card in turn and measured all six edges. Aegis's
  cards help it about equally against Null and against Cortex, so weakening an Aegis card drags Aegis > Cortex
  (already under its band in the gate) down with it. That is why the earlier attempts never came out clean.
- The useful finding: two cards are dead in exactly the matchups that are off. Null Pointer (destroy an enemy
  directive) is almost never castable against Aegis or Swarm, and Cortex's Force Quit (same text) is never
  castable against Swarm, which has no directives.
- So the two lead candidates keep each card's printed effect and add a second "choose one" mode. The three
  leaders went through the built-deck ring at every level, each on a copy of the game where the change really
  shipped (starter decks, the deck builder, every realistic owner).

**Null > Aegis — not fixed; the best partial fix found so far (NA12):**
- **Null Pointer becomes "choose one": Dereference (destroy target enemy directive), or Null Out (target enemy
  unit gets -3/-3 permanently).** Still 2 energy, instant speed, Uncommon.
- Real-match mode, shipped decks: Null 45.9% -> 50.3% (the band is 55-60). Built decks at 37/17/3 packs: +3.4,
  +3.2, +4.1. In gate mode it reaches the band: 56.3%.
- Clean elsewhere: Swarm > Null -1.0 (noise), Null and Cortex stay even, no faction's average leaves 46.8-53.1.
- **But from a full collection it does nothing.** I rebuilt that column with two more search seeds: Null >
  Aegis -0.9 over three seeds, i.e. no change. A full-collection Aegis deck is the strong one, and the shrink
  doesn't reach it.
- The agent really plays it (about 0.5 a game, against 0.15 before), but it nearly stops using the old mode:
  directive kills against Cortex drop from 0.19 to 0.01 a game.
- For comparison: the softer -2/-2 version gives about +3; Null Singularity at cost 6 gives +3.5 but costs
  Swarm > Null -2.3. Twelve simple number changes (costs, damage, stats, across both edges) moved
  their edge 2 points or less.

**Cortex > Swarm — fixed in real matches, but it overshoots without signature cards (CS7):**
- **Force Quit becomes "choose one": Terminate (destroy target enemy directive), or Kill All (deal 1 damage to
  all enemy units).** Still 2 energy, instant speed.
- Real-match mode: 53.0% -> 55.0% on shipped decks, 56.2-56.8% at 37/17 packs, 56.4% at 3 packs (inside
  55-60). Aegis > Cortex and Null ~ Cortex don't move.
- The cost: in gate mode (no signature cards) Cortex > Swarm goes from 58.2% to 61.3% on shipped decks and to
  61-63% at the pack levels, above the band's top (60). The ring check would still pass it.

**Both together:** each lift stays the same, but Null vs Cortex goes to 55.3% for Null (real, shipped decks),
just over the even band (45-55), and 51-52% at the pack levels.

**Decisions for you:**
1. **Null > Aegis:** ship NA12 as a partial fix, or keep the edge as the accepted out-of-band edge and design
   the full fix into the next set (as planned: Aegis's own card flow, and a Null answer to one big attacker)?
   **My recommendation: ship NA12.** It is the first fix in three sessions that halves the gap without
   hurting another edge.
2. **Cortex > Swarm:** ship CS7 (fixes real matches; the gate goes over the top of the band), or keep the
   edge accepted-out? **My recommendation: ship CS7.** Real matches always have signature cards, so the gate
   overshoot never happens in a real game. The gate's job is catching regressions, and it would still pass.
3. **If both ship:** OK with Null slightly ahead of Cortex (55% on shipped decks, 51-52% with built decks)?

**Calls I made you might want to overrule:**
- Lead fixes are new card modes, not number changes: these are bigger errata than a cost tweak.
- I took no Aegis-side candidate further than one check (Aegis Warden without its full heal), because of the
  ablation finding above.
- CI's rule calls every candidate that moves Null ~ Cortex a "fail": that edge's baseline is in band by a hair
  (50.7%), so any move to "not sure" counts as worse, even 51.8%. I read it as "still even" unless the rate
  leaves 45-55.

**Default if you don't answer:** nothing ships; both edges stay accepted-out. If you say ship, the next game
session ships them, re-records both ring baselines, re-runs both rings and the built-deck ring, and
regenerates the render replays that change.

### [ANSWERED 2026-10-31: keep all 3] Set A is shipped; both rings re-run

**What changed** (`progress/balance-report-036-null-forty-shipped.txt`):
- Null's list: Fork Bomb 2 -> 3, Segfault Handler 1 -> 2, plus 2 Rollback Point. 40 cards; every starter
  deck is now 40. Removal is 10 of 40, exactly the cap, as you OK'd. No other card changed.

**The ring check (shipped decks):**
- Before I re-recorded the baselines, the check failed on exactly the edge session 59 predicted: gate
  "Swarm > Null" went from 57.1 (in band) to 54.3 (not sure). Nothing else moved by a real amount. The
  real-match check passed as it was.
- Both baselines are re-recorded (dated 2026-10-30). Both checks pass.

**The built-deck ring (every collection level):**
- The result is **byte for byte the same** as session 59's run of set A. That run used a copy of the game
  with A patched in; this one is the real shipped game. So the numbers you chose A on are the shipped
  numbers: Null at 45.8 / 48.6 / 47.4 / 46.9 (real-match mode; full, 37, 17, 3 packs), and the field's
  spread back to 5.9 points (session 58's fill: 13.4).
- Still out of band, as before: Null > Aegis (Aegis wins it) and, in gate mode, Aegis > Cortex (already
  an accepted out-of-band edge). Null > Aegis and Cortex > Swarm are the balance session's job 2, next
  game session.

**New this session: how noisy the "full collection" column is.** I rebuilt every faction's full-collection
deck with three other search seeds and played the ring again. The decks differ by only 1-3 cards, but a
faction's average moves by 4-6 points and one edge by up to 8.7. So one full-collection deck is one draw;
the pack columns (8 owners, 8 searches) are the numbers to trust. I'll read job 2's full-collection
results with that in mind.

**Calls I made you might want to overrule:**
1. **Only the gate and real baselines were re-recorded.** The signature-mode ring (a report, not a CI
   check) still passes against its old baseline, so I left it.
2. **The render replays with Null in them were regenerated** (six replays and two recorded boast
   scenarios). The close-win scenario needed a new seed (5 -> 3): on seed 5 Null now wins. It is still a
   Swarm win on 4 health that plays Dial-Up Fireworks.
3. **The realistic collections file was updated in place** (`progress/built-deck-ring/collections.json`,
   the one the tools read). Session 54's version is in git history.

**Default if you don't answer:** all three stand. The next game session runs job 2 (Null > Aegis and
Cortex > Swarm), test only, to a check-in.

### [ANSWERED 2026-10-30: ship set A; shipped session 60] Null's 4 added cards (36 -> 40): recommend set A

**What I measured** (`progress/balance-report-035-null-forty.txt`, files in `progress/null-forty/`):
- A search tried every card that can legally join Null's list (more copies of Null cards, or neutral
  cards). Zero-Day cards were left out because a starter can't hold a secret card. At most one of the 4
  can be removal: Null already has 9, and a 10th only fits once the deck is 40 (the 25% cap).
- Four sets went to the ring check: on the ring's own seeds, and again on fresh seeds.
- All four went through the built-deck ring at every level (full, 37, 17 and 3 packs). Each one was run
  on a copy of the game where the set really shipped: the Null starter, the deck builder and the shipped
  Null deck all used the new 40.

**The sets:**
- **A: +1 Fork Bomb, +1 Segfault Handler, +2 Rollback Point** (neutral, 3 energy: restore 5 health;
  Cortex's starter runs one).
- **D: +1 Fork Bomb, +1 Zombie Process, +1 Dangling Pointer, +1 Segfault Handler** (Null cards only).
- **C: +1 Fork Bomb, +1 Zombie Process, +1 Dangling Pointer, +1 Corrupted Process** (Null only, no removal).
- **B: +1 Scrap Recycler, +1 Dangling Pointer, +2 Rollback Point** (no removal).

**What I found:**
1. **With the shipped decks, 4 more cards cost Null nothing you can measure** (its average moves -0 to
   +1.3 points). The one real change: Null does a little better against Swarm. Because of that, for
   every 40-card list, "Swarm > Null" in gate mode leaves its band (57.1 -> 52.9 to 54.3), so the ring
   check would fail until its baseline is re-recorded. Set A moves no edge by a measurable amount.
2. **With built decks, every set beats what the builder does today** (it fills Null's 4 by rating). Null's
   average against the field, real-match mode:

   | | full | 37 packs | 17 packs | 3 packs |
   |---|---|---|---|---|
   | session 54 (short decks allowed) | 46.7 | 48.7 | 47.0 | 46.6 |
   | today (builder's fill) | 39.2 | 44.0 | 41.9 | 43.8 |
   | **A** | **45.8** | **48.6** | **47.4** | **46.9** |
   | B | 47.8 | 47.3 | 45.8 | 45.5 |
   | D | 44.6 | 47.2 | 47.4 | 47.9 |
   | C | 42.8 | 45.9 | 46.1 | 45.9 |

3. **A keeps the four factions closest together.** The gap between the strongest and weakest faction
   averages 5.9 points with A (session 54: 6.0; today: 13.4; B: 7.2; D: 9.9; C: 10.4). With D, Aegis's
   full-collection deck runs away (60.4) and Swarm drops (Swarm > Null 51-53, under its band).
4. **A helps the old Null > Aegis edge most with built decks** (47.8-49.1 at full, 37 and 17 packs;
   today 37.2-45.3; B is next). Both sets with 2 Rollback Point (A and B) even the field best. On the
   shipped decks no set moves that edge. Fixing it stays the balance
   session's next job.

**What I recommend:** add **A**. It changes the shipped ring the least and evens out the built-deck ring
the most. After your OK, the next game session ships it: Null's list to 40, both ring baselines
re-recorded, both rings and the built-deck ring re-run.

**Alternatives:**
- **D** if you want Null's starter to hold only Null cards. Null is a little stronger at the pack levels,
  but the factions are less even.
- **B** if you'd rather Null not sit at the removal cap. Close to A, but Swarm > Null drops under
  Swarm's band at every level.
- **C** (Null only, no removal). It helps the least.
- **None yet:** keep the 36 and today's builder fill until the old edges are fixed too.

**Things you might want to overrule:**
- A puts 2 neutral cards in Null's starter (Cortex's has 2, Aegis's 1, Swarm's none).
- A and D both put Null exactly at the 25% removal cap (10 of 40); B and C don't.
- The full-collection column is one built deck per faction, so it is noisy. The pack columns are 8
  owners each and are the steadier read.

**Default if you don't answer:** nothing ships. The next game session is the hardening pass (session 60);
the balance session's second job (Null > Aegis and Cortex > Swarm) follows it.

### [ANSWERED 2026-10-29: keep B; balance session next] Option B is built; without its short deck, Null falls behind

**What was built** (your answer of 2026-10-26):
- The deck builder builds every deck to the largest size the owner's cards allow: **40 when the
  owner holds 40 usable cards** for that faction, **otherwise every usable card** (at least 20).
  "Usable" means what the deck rules let in: a card's copy limit, at most 10 neutral cards, removal at
  most a quarter of the deck, and an evolution only with its base. (`largestDeck` in
  `engine/src/deckbuilder/deckBuilder.ts`.)
- Its search now only swaps one card for another. It never makes a deck shorter or longer.
- The legal range stays 20-40. A deck an owner saves and forces by hand is unchanged.
- The store refuses to save an agent deck of any other size. It also asks for a rebuild when an
  agent deck built before today is shorter than the owner's cards allow, so existing short decks
  grow on their next rebuild.
- In the owner API demo, the Null-locked owner's deck is now 27 cards (all 27 usable cards), not 26
  (`progress/owner-api-demo-002.txt`).

**The re-runs you asked for** (`progress/built-deck-ring-002.txt`):
1. **The ring check passes, unchanged** (`ring` and `ring:real`). It uses the shipped decks, which
   didn't change.
2. **The built-deck ring.** All 100 built decks now use as many cards as the owner's cards allow.
   Before, 49 of 100 were shorter. Cortex, Aegis and Swarm keep about the shape they had. **Null
   drops.** Its average against the field, per collection level:

   | | full | 37 packs | 17 packs | 3 packs |
   |---|---|---|---|---|
   | Null, real-match mode, session 54 | 46.7 | 48.7 | 47.0 | 46.6 |
   | Null, real-match mode, today | **39.2** | 44.0 | 41.9 | 43.8 |
   | Null, gate mode, session 54 | 44.7 | 47.7 | 45.4 | 46.1 |
   | Null, gate mode, today | **37.8** | 44.1 | 42.3 | 44.7 |

   The shipped Null deck averages 46.3. Null ~ Cortex (should be even, 45-55) falls out of its band:
   39.0 in real mode with full collections, and 35.7 to 39.0 in gate mode at three levels. Cortex
   gains in turn (real mode 51.6-54.4, was 48.5-50.5).
   **Why:** Null's designed list is 36 cards. Session 23 cut it to 36 on purpose, for consistency. The
   builder now has to add 4 cards. From a full collection it adds Fork Bomb, Null Pointer, Uplink
   Tower and Patient Zero, and those 4 cards cost Null 3 to 4 points against the shipped decks. Swarm
   loses its 39th-card cut too (about -3 against the shipped decks), but its ring edges barely move.

**What I recommend:** keep option B and **make the pre-launch balance session the next game session**,
with Null's 4 added cards as its first job. That is the change you already decided on 2026-10-26.
Right now the builder chooses those 4 cards by rating. The balance session would choose them on
purpose and measure them, and bring them to you for your OK. Until then, a Null owner with a full
collection plays a weaker deck than before.

**Alternatives:**
- **B2. Allow 36 for Null until its 4 cards ship.** The builder may keep Null's designed 36-card list
  as it is. This brings back the old Null numbers until the balance session. It is an exception to
  the rule you just set, and only for one faction.
- **B3. Keep today's build and change nothing until the balance session.** This is the same as my
  recommendation, but the balance session is not moved up.

**Default if you don't answer:** B as built, and the next game session starts the balance session
with Null's 4 cards. It is test only: no card is added without your OK.

### [ANSWERED 2026-10-26: option B; built session 58] Deck size: short decks win more; recommend exactly 40 cards

**Your questions, answered** (`progress/deck-size-report-001.txt`, made by
`engine/src/dev/deckSizeCheck.ts`; about 390,000 games):

1. **The rule today: 20 to 40 cards.** It is set in `engine/src/data/decks.ts` (`MIN_DECK_SIZE = 20`,
   `MAX_DECK_SIZE = 40`). Every deck that plays is checked against it. The deck builder uses the same
   two numbers. The 20 was picked at stage 3 so the first small test decks still worked. It was
   called a first guess then and was never tested. Shipped decks: Cortex, Swarm and Aegis 40, Null 36.
   Nothing in the rule says a short deck is only for owners who lack cards: any deck from 20 to 40 is
   legal, for anyone.
2. **Why the demo deck had 26 cards: that owner didn't have more.** The owner (Cortex starter plus
   10 packs) holds 17 Null cards and 10 neutral cards a Null deck can use. Neutral cards are capped at
   10, so 27 is the biggest legal Null deck. The builder started at 27. Its search then cut 1 Power
   Reserve, which won 50.5% instead of 45.0% on new games, so 26. Across the ring's 96 realistic
   collections, a lock to the owner's own faction can almost always make 40: 3 of 96 can't, and those
   3 are day-one Null owners, whose starter is the 36-card list. A lock to another faction mostly
   can't: 116 of 288 can't build a deck at all, and 111 more top out under 40. At 17 packs every one
   of them is 20 to 35 cards.
3. **Does the builder pick short decks when 40 is possible? Only a little.** In the built-deck ring,
   49 of the 100 kept decks are shorter than their cards allow, by 1 to 5 cards: Swarm keeps 39,
   Null keeps 35 or 36 (36 is its designed list). None went below 35 when 40 was possible. The search
   is small (24 one-copy changes, about a fifth of them size changes), and it can only cut from 40,
   since 40 is the maximum. So it drifts, but nothing pushes it back up.
4. **Does a shorter deck win more? Yes.**
   - **Size alone.** I took the same cards in the same proportions, at two copies each (40 cards) and
     one copy each (20 cards). The 20-card deck wins more in every faction: +5.3 Cortex, +3.3 Swarm,
     +5.2 Aegis, +2.6 Null (points; all four clear of chance, z 2.8 to 5.6). The same test at 39
     against 26 cards: +3.5, +1.1, +3.7, +0.8 (two of four clear).
   - **Why: a short deck never runs out.** Matches end around turn 13 or 14, and each side draws
     about 10 to 15 cards in a match. A 20-card deck ran dry in at most 1.9% of games, and running dry
     only costs 2 health per draw. Nothing makes a short deck pay, and it sees more of its own cards
     (12 of 20 rather than 12 of 40), with fewer repeats.
   - **Cutting the right cards is worth much more.** We cut a 40-card deck to 36, 32, 27 and 20
     cards, by lowest rating and at random. The best cut, replayed on new games, beat the 40-card
     deck by +11.9 points for Cortex (a 20-card cut), +11.4 for Aegis (32), +4.9 for Swarm (20) and
     +2.0 for Null (36). Two caveats: the 40-card deck is the builder's first deck, not its tuned one;
     and which cut is best varies a lot (at 20 cards, from -22 to +13). A stronger search, or an
     owner saving a hand-picked 20-card deck, would find these. Forcing a saved deck is already
     possible today.

**Recommendation: every deck is exactly 40 cards** (minimum = maximum = 40), the usual TCG answer to
"thinner is better". What that would take, all needing your OK:
- **Null's shipped list and starter grow from 36 to 40.** That list was cut to 36 in session 23, for
  consistency, which is this same effect. Session 55 measured the 40-card Null deck padded the
  builder's way at 1.5 points under the 36-card one. Which 4 cards go in is a deck change, so it fits
  the test-only balance session already planned before launch. That session would bring its
  candidates and their ring and built-deck-ring numbers to you.
- **Locking to another faction needs 40 usable cards.** Under your kept call 2 such a lock is
  accepted, the rebuild fails with the reason, and no match starts until it fits. By the numbers
  above, an owner who locks to a second faction can't play it until about two weeks of packs.
- The builder's size changes go away (only swaps), and the store's "the deck is short" checks
  become "the deck is not 40".

**The alternatives:**
- **B. Build to 40 when the owner holds 40 usable cards, otherwise every usable card (at least 20).**
  This is your example. The store enforces it, since it knows the holdings. It keeps
  second-faction locks playable early and stops the free gain for owners with full collections.
  Owners with few cards keep a small short-deck gain, which partly makes up for their weaker cards.
  It is harder to explain to an outside agent author, and Null's 36-card list would become illegal
  for any Null owner who holds 40 usable cards.
- **C. Raise the floor to 30 or 36.** This narrows the gap but doesn't close it (26 against 39 still
  gains up to 3.7 points).
- **D. Keep 20-40.** This keeps the measured gain for whoever looks for it.

**Default if you don't answer: D (no change)**, because a rule change needs your OK. If you choose A
or B, the next game session builds it (rule, store, builder, tests), re-runs the ring check and the
built-deck ring, and brings Null's 4-card candidates to the balance session.

### [ANSWERED 2026-10-24: keep all 4] The deck settings over HTTP: four small calls

**What was built (session 56):** the owner API (`server/src/ownerApi.ts`, spec `server/OWNER_API.md`):
sign in and out, then read and change who picks the deck (agent or forced), the faction lock, the
forced deck, each agent's play style, see why the agent's deck wants a rebuild, and "rebuild now".
A rebuild answers at once and runs in the background on its own thread: in the demo a full build
took about 22 seconds and the server answered every one of ~110 requests meanwhile in under 20 ms
(`progress/owner-api-demo-001.txt`). Run on the server's main thread instead, the same request waits
out the whole build; a test shows both.

**Calls (defaults in bold):**
1. **Keep:** "rebuild now" builds even when nothing asks for it (the owner pressed it). The
   alternative is to answer "already up to date" and do nothing.
2. **Keep:** a faction lock the owner's cards can't build (e.g. Swarm with no Swarm card that draws)
   is accepted; the rebuild then fails with the reason, and no match starts until the active deck
   fits the lock (the store's existing rule). The alternative is to refuse such a lock.
3. **Keep:** another owner's deck or agent answers "not found", not "not yours", so nothing about it
   leaks.
4. **Keep:** the latest rebuild is remembered in memory only (a restart forgets the job, never the
   deck). A saved job history can come with the notifications endpoints.

### [ANSWERED 2026-10-23: keep] A rebuild now waits for cards the deck could use

**What changed (session 55):** your rule is that the agent rebuilds its deck when the owner's cards,
the faction lock or its play style change. Until today "the cards changed" meant any card at all, so
an owner locked to Aegis who opened a pack of Swarm cards, or got a 4th copy of a card a deck can only
hold 3 of, was told to rebuild, and the rebuild could not change anything. Now only cards the deck
builder could put in the deck count: the lock's faction and Neutral cards (every faction with no lock),
each up to its deck limit. A test pins that the builder makes exactly the same deck from those cards
as from the whole collection, so no real change is missed. A salvage that leaves the deck short is
still always a reason.

**Measured** (`progress/economy-demo-016.txt`, section 7): an owner locked to Aegis, with 40 packs
open, opens 20 more one at a time. The old rule asked for 20 rebuilds; now 3. An owner with no lock:
17 of 20 (every faction's cards count for them).

**Call:** a deck saved before today keeps the old rule until its next rebuild (its record can't be
read the new way), so nothing has to be migrated. **Default: keep.**

### [ANSWERED 2026-10-22: gate passes; a test-only balance session before launch; keep call 3] The built-deck ring: built decks keep the ring's shape; no new problem, two old ones

**What was asked:** measure the faction ring (all six edges) with built decks on both sides, from full
and realistic collections, with today's agent, at the ring check's bar, Aegis called out; results and
any fixes to you; no card or deck change without your OK.

**What ran** (`progress/built-deck-ring-001.txt`): the store's own deck build (what an owner gets),
forced to the owner's starting faction. Four collection levels: a full collection, and 8 simulated
owners per faction holding their starter deck plus 3 packs (day one), 17 packs (about a week) and 37
packs (about two weeks), with packs from the live roller. Each edge at the ring check's 2,500 seeds (900
for the two even ones), built deck against built deck, in real-match mode (each side also gets its
approved signature card) and in the gate's decks-only mode: 118,000 ring games, plus about half a
million games of deck building.

**Results, real-match mode** (win rate of the first-named faction; band in brackets):

| edge (band) | shipped decks | full collection | 37 packs | 17 packs | day one |
|---|---|---|---|---|---|
| Null > Aegis (55-60) | 45.3 OUT | 46.6 OUT | 49.6 OUT | 45.2 OUT | 45.7 OUT |
| Aegis > Cortex (55-60) | 55.6 | 55.2 | 51.4 OUT | 53.9 | 54.0 |
| Cortex > Swarm (55-60) | 53.0 OUT | 50.4 OUT | 52.5 OUT | 54.7 | 54.9 |
| Swarm > Null (55-60) | 55.5 | 56.3 | 53.6 | 56.9 | 55.2 |
| Null ~ Cortex (45-55) | 49.0 IN | 49.9 IN | 50.2 IN | 52.7 | 49.4 IN |
| Aegis ~ Swarm (45-55) | 56.2 | 51.4 IN | 50.1 IN | 54.3 | 55.2 |

**In plain words:**
- **Built decks don't break the ring.** At every level, every faction's average against the field
  stays between 46.6 and 54.5. The direction of five edges holds, and the even edges stay even. Real
  mode has as many or fewer OUT edges than the shipped decks at every level except 37 packs.
- **Aegis:** with built decks on *both* sides, Aegis is not the outlier. Its +11.8-point lift against
  the shipped decks doesn't survive opponents who also build: Aegis averages 53.3 from a full
  collection (55.5 with shipped decks) and 50.7 to 54.5 at the realistic levels. In decks-only mode
  (no signature card) a full-collection Aegis averages 54.6 (+4.3 over shipped), so the signature card
  is what holds it level.
- **The two old problems stay:** Null > Aegis is OUT at every level (Aegis wins this predator edge,
  as with the shipped decks; already your accepted-OUT edge). Cortex > Swarm sits under its band at
  every level (50.4 to 54.9 instead of 55-60), clearly OUT at the full and 37-pack levels, as with the
  shipped decks (53.0 OUT).
- **The spread between owners is wide:** one owner's win rate on an edge ranges up to about 19
  points from another's (luck of the packs). That's expected, but it means the ring holds on
  average, not for every owner.

**Two builder bugs found and fixed while measuring** (both only touch the deck-building agent):
1. A day-one Null owner got "no deck can be built". Their cards ran out at 37, and the removal limit
   was counted for a 40-card deck. Now fixed. Had this shipped, every new Null owner with unlucky
   packs would have had no deck.
2. The "designed" starting deck was always padded to 40 cards, and Null's designed list is 36. So no
   owner's agent could ever play the real Null list, and built Null decks were 3-4 points weaker than
   the shipped list. With the fix, Null's built decks are at or above the shipped list (+0.3 to +1.2).
   Before the fix, from a full collection, Null averaged 40.8 against the field (the "full (report)"
   column, session 53's build).

**Calls (each has a default):**
1. **Do the built decks pass the launch gate?** My read: they pass in the sense you asked about. Built
   decks add no new out-of-band edge in real mode and no dominant faction, and Aegis is not a problem
   with built decks on both sides. The gate stays a standing check: re-run it after any card change
   and before launch. **Default: pass, and re-run before launch.**
2. **The two old edges (Null > Aegis inverted, Cortex > Swarm too even)** show up the same with built
   decks. Any fix is a card change, so it's yours to call. I'd propose candidates in a balance session
   (one or two cards per edge, measured on the ring check and on this built-deck ring) only if you want
   it before launch. **Default: no card change now; keep them as the accepted-out edges.**
3. **The measure uses the store's own build** (40 games per test, a few seconds per owner), not the
   stronger one. A stronger build gave the same ring within noise (the "full (report)" column, apart
   from its padded Null deck). **Default: keep the store's build as the measured one.**

### [OWNER CHECK-IN] The deck builder searches as Calculator, and chooses in the agent's style

**What was asked:** your call 6 (session 52): the deck builder should use the agent's play style.

**What I measured first** (`progress/deckbuilder-styles-report-001.txt`): the obvious version, where
every game of the build is played in the agent's style. From a full collection, each of the six styles
built a deck per faction; then every style played every style's deck on fresh seeds (2,000 games per
cell). **Every style did worse with its own deck than with the deck Calculator built**, by 2.1 to 2.7
points across the four factions, and Calculator playing those decks lost about as much. So the decks
weren't "made for the style", they were just worse: the styles differ too little for the builder's
search to see, and it kept changes on noise.

**What is built instead** (`progress/deckbuilder-styles-report-002.txt`): the search plays as
Calculator, and the final choice (the confirm step: the searched deck against the two starting decks
on 2,000 fresh games) plays in the agent's style. Result: no style is worse off. From a full collection
every style keeps the same deck as Calculator in all four factions; from a partial collection the style
sometimes keeps a different one (in `progress/economy-demo-016.txt` a Rusher and a Fortress keep a
different Null deck). In plain words: **today the style rarely changes the deck**, which matches what
you saw in the style ring (the styles are fair, so they're subtle).

**The store:** the agent deck remembers the style, faction lock and cards it was built from. It
reports why a rebuild is due: new cards, a lock change, a style change, or a different agent
connected. It rebuilds only when there is a reason. Nothing calls this yet; the ladder will.

**Calls (each has a default):**
1. Search as Calculator and choose in the style (built), rather than doing every game in the style
   (measured worse). **Default: keep.**
2. Changing the style or connecting an agent with another style counts as a reason to rebuild, the
   same as new cards or a lock change. **Default: keep.**
3. If you want styles to get visibly different decks, that needs a stronger search (more games per
   change, or trying whole packages of cards), which also helps every deck. It costs build time
   (now seconds to a minute per owner). **Default: not now.** I'd do it after the pre-launch
   built-deck balance check, which needs the builder as it is.

### [ANSWERED 2026-10-20: option C, keep all 6] Six play styles: fair against each other, but most are subtle

**What they are:** each style is a preset of the same agent (no card names, no special cases): how
much it values damage to the opponent's health, cards, energy, trades, safety, removal, protection,
new units, holding a response, and a little dice. Calculator is today's agent, move for move (a test
pins it), so every balance number so far still stands. The owner picks a style per agent; a change
during a live match applies from the next match, and every match record keeps both sides' styles.

| Style | What it does differently | Against the field | Picks a move Calculator wouldn't |
|---|---|---|---|
| Calculator | the reference | 50.8% | - |
| Rusher | damage to health counts 1.5x, spends freely, trades less | 51.2% | 10.7% |
| Controller | cards, removal and trades count more, holds energy for an Instant | 49.2% | 4.9% |
| Tempo | spends freely, new units count 1.5x | 51.0% | 9.9% |
| Fortress | values a body's health 1.8x, protects its side, avoids losing attackers | 48.5% | 8.8% |
| Gambler | picks at random among moves within 0.6 of the best | 49.3% | 10.1% |

Measured on seeds no tuning used (48,000 games per style: every pair of styles, all 16 faction
pairings, both seats, real-match signature cards): **all six within 1.5 points of 50%**
(`progress/play-style-ring-001.txt`). Same deal, each style in turn: `progress/play-style-demo-001.txt`.
In the store: `progress/economy-demo-015.txt`.

**The trade-off you may want to steer:** the bold first draft was clearly visible but not fair:
Controller lost 6.3 points and Gambler 8.6 (holding up responses, attacking units instead of health
and a wide random pick all cost games). Making them fair made most styles subtle. Rusher is easy to
see (84% of its attacks go at health, against 76%); Controller a little (73%); Tempo, Fortress and
Gambler change about 1 decision in 10 but their averages barely move.
- **A (default): keep these.** Fair first; the difference shows in single moves, not in the averages.
- **B: allow a wider limit (say 4 points)** for bolder styles that a viewer can see.
- **C: keep the limit, and give the commentary the style** (the persona already shapes how the agent
  sounds), so the difference is told even where it is small.

**Calls you may want to overrule:**
1. **The rule:** each style's score against the field (the other five styles, every faction, both
   seats; a draw counts half) within 2 points of 50%, your signature-card limit applied to the
   overall rate. Head-to-head and per-faction results are reported, not gated: a style beating
   another is the rock-paper-scissors you asked for. Read per faction against Calculator, the way a
   signature card is tested, Fortress would fail (piloting Swarm 45.8%, Null 45.0%): it suits some
   factions less.
2. **Calculator is the default style** for every new agent and every agent that existed before.
3. **The style belongs to the agent,** not the owner: an owner with two agents can give them
   different styles, and switching agents switches style.
4. **Controller's "hold a response" rarely matters yet:** the shipped decks carry few Instants (about
   0.15 cast on the opponent's turn per game, any style). It will matter more as sets add Instants.
5. **Gambler is randomness among good moves,** not a taste for risky cards (no card is "risky" to the
   agent yet).
6. **The deck builder doesn't use the style yet** (it builds with Calculator). Next step for 2b.

**Updated 2026-10-19, session 51 (the deck-building agent, roadmap 2b).** Nothing is blocking. The
agent now builds its own deck from the cards you hold, unless you force a deck or a faction, as you
asked on 2026-10-15. One finding below that you may want to steer; everything has a default.

### [ANSWERED 2026-10-19: keep all 5] The deck-building agent: built decks beat the shipped decks

**What it does:** your agent looks at every card you hold and builds the strongest legal deck it can
in each faction it may play. It plays each deck against the four shipped decks (Lookahead on both
sides), tries one-card changes, keeps the ones that clearly win more, and checks the result again on
games it never practised on. Then it plays the faction that did best. A faction lock is your forced
faction; making one of your own decks active forces that deck. Settings: deck choice "agent" (the
default) or "forced".

**What it found** (`progress/deckbuilder-report-001.txt`, 2,000 fresh games per deck): from a full
collection, the built deck beats its own faction's shipped deck in all four factions: **Cortex +5.3,
Swarm +7.6, Aegis +14.3, Null +2.2** points against the field (Aegis's built deck wins 62.7%). From a
starter collection alone it plays the starter list with up to 2 cards cut (+0 to +3.6). With 60 packs on
top of a Cortex starter (`progress/economy-demo-014.txt`) it picks Cortex at 63%.

**Why it matters:** the ring check and the signature fairness test measure the shipped decks. Once
agents own more cards they will play built decks, which are stronger and may not keep the
rock-paper-scissors ring. Nothing is wrong today (Season 0 agents are in-house), but the ring among
built decks has never been measured. Suggestion: measure it in a later session, before the public
launch; nothing to decide now.

**Calls you may want to overrule:**
1. **"Best" means best against the four shipped decks** (mirror included), not against whatever the
   ladder is playing. Until there is a ladder that is the only field there is.
2. **Two starting points:** a deck from a card rating and the shipped (designed) list as far as you hold
   it. Each wins in two factions; with only the rating the agent once built an Aegis deck 10 points
   worse than the designed list it already held.
3. **It rebuilds when your cards or lock change, not before every match** (a build takes 20-60 s).
4. **Owners who already had an active deck became "forced"** (their deck was picked by hand). New
   owners start on "agent".
5. **The agent's deck is one saved deck called "Agent's deck",** rebuilt in place, so your own decks are
   never touched.

**Updated 2026-10-19, session 50 (a hardening pass).** Nothing is blocking and nothing new needs
you. The check-in below is answered (all 3 kept). Your side task is done: the Season 0 boasts demo
pins its "not drawn yet" steps to an undrawn copy of the catalogue and shows the shipped catalogue
selling both boasts (`progress/economy-demo-013.txt`). The rest was hardening: fairness results now
carry their own provenance, and two seeded tests had bounds too close to chance (fixed).

**Updated 2026-10-19, session 49 (your session-48 answers: the approved list from today's agent; a
Guardian line).** Nothing is blocking. **Done as you answered:** the approved list is now read only
from today's agent's results; Guardian 3/5 is off it; the tuner found a Guardian line that passes,
**Guardian 3/4**, so the list is 14 lines over 7 options and the menu keeps a Guardian option. The
store wording of the starter boasts now describes them as drawn. **One small [OWNER CHECK-IN] below.**
Evidence: `progress/balance-report-034-guardian-search.txt`.

### [ANSWERED 2026-10-19: keep all 3] Guardian 3/4 passes and is on the list; the real-match ring re-recorded

**What happened:** with today's agent, the tuner measured every cost-5 Guardian body (attack 2-4,
health 3-9) at 1,000 games per edge, ran the lever tuner over costs 5, 6 and 7, and re-measured the
nearest two lines at 10,000 games per edge, the same bar as every line on the list.
- **Attack 2 is too weak** (2 to 4 points worse than the plain 3/6) and **attack 4 too strong** (5 to 9
  points better). Costs 6 and 7 are far off (best: 4.0 points over at 500 games).
- **Guardian 3/4 passes:** worst edge 2.00 (Cortex > Swarm, 95% interval +1.5 to +2.5), exactly on your
  limit, like Supply Line 3/7. Every other edge is 1.8 or less; net +1.0 (a little stronger than the
  stand-in, as the other lines are).
- **Guardian 3/6 fails** (3.2 points, Aegis > Cortex). Guardian 3/5 stays off (2.10 at 10,000).
- So the generator, which takes every line that passes at its largest measurement, put **Guardian 3/4**
  on the list: **14 lines over 7 options**, the same size as before, with Guardian 3/4 in place of 3/5.
  Agents that already hold a Guardian 3/5 card keep it.

**Knock-on: the real-match ring check.** That check gives each side an approved line as its signature
card, so a new list changes its matches. Its seat draw only worked for an even number of lines (13
would have given each seat 7 of them), so it now works for any number. With the new list, five edges
held their verdict and **Cortex > Swarm moved 53.4% -> 53.0%**. That is a -0.4 change, well inside
noise (-3.2 to +2.3), but its interval now sits just under the band, so the check read it as worse. No
card changed, and the check has to follow the list, so **I re-recorded its baseline** (every edge
within 1.7 points; the table is in section 5 of the report). The gate (decks as shipped) is unaffected
and passes.

**What I need from you (both optional; the defaults are what's built):**
1. **Guardian 3/4 on the list?** [suggestion: **keep it**, as built. It passes the same way Supply Line 3/7
   does. Alternative: take it off and leave the list at 13 with no Guardian option.]
2. **The real-match ring's re-recorded baseline** [suggestion: **keep it**. The alternative is to keep the
   old baseline and accept Cortex > Swarm as noise, but CI would fail on every engine change until it
   was re-recorded.]

**Calls you may want to overrule:**
1. **Starter boast wording:** besides the two lines the render lane named, Hive Burst's said the spores
   "spell the name" (your kept call 2 says they don't), so it now says "a zig-zag column over the
   name"; Void Collapse's now says the glitch bars "frame the name". Wording only.

**For the render lane:** the list change alters which signature cards the seeded replays generate.
Two render tests were moved to seeds that still show what they test: the feed's renamed-card test uses
Cortex vs Aegis seed 7, and the zone net adds seeds 11 and 12. Committed replays with generated
signature cards will differ when they're next regenerated.

### [ANSWERED 2026-10-19: option C, and yes to today's agent; built session 49] The approved signature lines re-checked: 13 of 14 pass; Guardian 3/5 is just over

**What happened:** the 14 lines new agents draw their signature card from were measured in session 35,
before session 41 taught the agent to value signature abilities. This session measured the fairness
reference again and all 14 lines again, at 10,000 games per edge, with today's agent. 13 still pass
(every edge moves 2 points or less). **Guardian 3/5 (`sig5-3x5-guardian`) fails on one edge:**
Aegis > Cortex +2.1 points (95% interval +1.7 to +2.5; it was 1.87 before). Supply Line 3/7 sits
exactly on the limit (2.0) and passes. The mean worst edge improved, 1.34 -> 1.24.

**Nothing changed yet.** The list and the generator are as they were; agents that already have a
Guardian 3/5 card keep it either way.

**What I need from you:**
1. **Guardian 3/5:** [suggestion **A**]
   - **A.** Take it off the approved list: new agents draw from the other 13. Existing cards stay.
   - **B.** Keep it: 0.1 points over, and the interval reaches below 2.
   - **C.** Take it off, and have the tuner look for a Guardian line that passes with today's agent
     (about an hour of games), so the menu keeps a Guardian option.
2. **From now on, read the approved list with today's agent?** [suggestion: yes. The approved-list
   generator only reads the session-35 results (the new ones are in a subfolder, so the two agents'
   numbers don't mix). Under "yes", the next session regenerates the list from the new results,
   which also applies your Guardian answer.]

### [ANSWERED 2026-10-19: Season 0 sells Boot Sequence and Dial-Up Fireworks; built session 48] Victory boasts: what Season 0 sells, and 5 calls made while building

**What's built** (ECONOMY.md, "Victory boasts and the cosmetics backend"): schema v11; a Season 0 file
made before it gives every owner who had a starter collection all four starter boasts and their
agents the faction's boast. In the evidence run, 62 real matches between two owners paid for a
300-credit season boast; after it was equipped with a close-win boast, 24 of 24 wins played the
right boast (11 main, 4 close-win, 9 the faction starter for an empty slot), and the history read
back unchanged after the loadout changed. A boast never reaches the engine, the agents or the ring
(the engine is untouched; both ring checks are unaffected).

**What I need from you:**
1. **What Season 0 sells.** The shipped catalogue holds only the four free starter boasts, so
   the store sells nothing yet. The purchase path is built and tested with a demo item. Tell me
   which season boasts (and card backs, avatars, arenas, if any) Season 0 should sell, with names
   and a one-line look each, and their sale window [suggestion: 2 Season 0 boasts on sale for the
   whole season; no card backs, avatars or arenas until the render lane can draw them]. The render
   lane has to draw each one before it goes on sale.

**Calls you may want to overrule:**
1. **A new agent's boast** is its owner's faction lock's starter boast, else its starting faction's
   (agents have no faction of their own). Agents made before the starter collection get it then.
2. **An empty boast slot** is allowed. A win with it plays the starter boast of the faction the
   deck played, and the record says so (`factionStarter`). The alternative: no empty slot.
3. **No loadout changes during a live match,** like switching agents, so the record is the
   loadout the match started with.
4. **The close-win rule reads each side's final health,** passed in when the match is recorded.
   The real server doesn't record matches yet (roadmap 6b); when it does, it passes this. Without
   it, a win plays the main boast.
5. **Season reset carry-over is a rule on paper:** the season reset itself isn't built yet. When it
   is, owned cosmetics and loadouts go to the new file with the unique Mythic.

### [ANSWERED 2026-10-19: keep A and all 4 calls; boasts plan approved with all 6 defaults] The starter guarantee (built), and the plan for victory boasts (not built)

**1. The method: your example, option A.** When an owner opens their last unopened starter pack and
none of their opened starter packs had a hit, that pack's shine slot is made a hit. It works like
the hit pity timer: the same hit table in its own proportions (Full Art 49%, Glitch 22%, Alt Art
16%, secret illustration 8%, Gold 4%, Zero-Day 1%), worked out from the owner's pack history when
the pack is opened. Other packs opened in between don't count, the starter packs can be opened in
any order, and a 10-pack open that includes them works too. **The tell stays honest:** the pack
and the tear look the same; only the opened pack's record says the guarantee applied
(`starterHit`, logged with the opening). The render lane can show that after the reveal if you want
(it currently shows "Pity: this pack was due a hit" for pity, after the reveal).

**2. Starter rates** (200,000 simulated owners, `progress/pack-sim-003-starter.txt`):

| | before | with the guarantee |
|---|---|---|
| owners with a hit in their 3 starter packs | 45.8% | **100%** |
| owners with exactly 1 / 2 / 3 packs with a hit | 36.8% / 8.4% / 0.6% | 91.0% / 8.4% / 0.6% |
| hit copies per new owner | 0.555 | 1.098 |
| starter pack 3 has a hit | 18.4% | 72.6% |
| owners the guarantee applies to | | 66.5% (it rescues the 54.2% who'd see none) |
| owners with a Mythic card in their starters | 44.4% | 49.8% (upgraded hits can land on Mythics) |

Through the real store: 1,000 new owners, 1,000 saw a hit; it applied to 673, always on pack 3.

**3. The wider pack economy:** small and one-off. Each new owner gets about 0.54 extra hit copies,
the hits of about 2.9 ordinary packs, once. Zero-Day cards from starters: 62 -> 121 per 10,000 new
owners; secret illustrations 444 -> 894 per 10,000. Prototype runs, the Rare slot and the Mythic
timer are untouched. Hit pity counts from history, so owners start their paid packs with a lower
count (2.04 -> 0.40), which shifts packs 4-43 by hundredths (hit rate 20.44% -> 20.30%; pity firing
2.42% -> 2.25%). No odds table changed, so this isn't a new odds version.

**Calls you may want to overrule:**
1. **Option A, not B.** B would upgrade one of the 3 packs at random when none has a hit, so each
   pack has the same chance (36.5% each) and packs 1 and 2 give nothing away about pack 3 (under A,
   an owner who knows the rule knows pack 3 will hit after two misses). B needs all 3 starter packs
   rolled when the first is opened (or their seeds drawn at the grant and kept secret), plus a
   separate draw for the upgraded pack, or its upgrades would never be Gold or a secret card. Same
   totals. Say "B" and I'll build it.
2. **The guarantee counts any hit in a starter pack**, including a Jackpot card or a Prototype bonus,
   not only the shine slot.
3. **Owners who already opened starter packs** (none outside tests yet) get it only if they still
   have one unopened.
4. **A Zero-Day card can be the guaranteed hit** (1.1% of upgrades), as pity allows. If you'd rather
   the starter hit stop at Gold, say so.

**4. Victory boasts: the game lane's plan** (your 2026-10-19 entry; nothing built, the render lane
proposes its own half). A boast never reaches the engine, the agents, the ring or any CI check.
- **Catalogue:** one cosmetics catalogue for all four kinds you named (boast, card back, avatar, arena
  background): item id, kind, name, season (or "standard"), faction theme, price in credits, sale
  window, and an art reference the render lane draws from (code-drawn now, art pass later).
- **Ownership:** an owned-cosmetics table per owner (account-bound, never sold or moved; source
  `starter` or `purchase`, with the ledger row). Bought with credits, the one shop currency.
- **Starter boasts:** all 4 faction boasts granted free to every owner with the starter collection,
  not only the starting faction's (agents can switch factions). Existing owners get them once by
  migration.
- **Per-agent loadout:** one slot per kind (boast, card back, avatar, arena); refused unless the owner
  owns the item. A new agent starts with its faction's starter boast.
- **The match record:** each side's loadout at match time is saved with the match (boast, card back,
  avatar, arena), so a replay always shows what the agents had then. The server reads it when it
  records the match; a match from before the change shows defaults.
- **Optional extra (proposal):** a second "close win" boast slot. The store picks it when the winner
  ends on 5 health or less, otherwise the main boast, and records which one played. The agent doesn't
  choose, so it costs no agent code and no protocol change.

**Decisions I need for boasts (suggested defaults in brackets):**
1. **Price** [300 credits per season boast, 3 packs' worth].
2. **After its season** [retired: never sold again, as the shop spec's "limited edition = a sale
   window" rule says; owners keep theirs].
3. **Account-bound** [yes, like starter decks].
4. **Season reset** [cosmetics carry over: the reset clears the collection, credits and pack points,
   but not cosmetics].
5. **The close-win slot** [yes, as above].
6. **When** [the next game session after your answer, after this guarantee is accepted].

### Option C: what happened (test only, 2,500 games a cell, 10,000 for the confirmation)

The Aegis list is 40 of 40 cards and already runs every Aegis card, so each trial raises cards it
already has and cuts cheap ones. Every list passed the deck rules and the lint.

| trial (all Aegis cards unless marked) | Null > Aegis, real (band 55-60) | other edges | Aegis's signature gain |
|---|---|---|---|
| shipped | 45.4% | | +10.0 |
| C1: Lockdown Field x2 (cost 4) for a Barrier Drone | 42.0% (-3.4, worse) | | +9.5 |
| C2: every Aegis Rare x2, cut Drones and Line Troopers | 47.6% (+2.2) | Aegis > Cortex real 52.6%, out | +11.1 |
| C3: C2 plus more 3-drops, cut Plating Module | 49.2% (+3.8); **10,000: 50.1% (+4.8)** | Aegis > Cortex real -3.9, gate -2.9, out | +10.1 |
| C4: like C3 but cut the Cadets | **56.9%, reaches the band** | Aegis > Cortex gate 32.6%, Aegis ~ Swarm gate 38.6%, far out | +15.3 |
| N1 (neutral cards, outside your brief): Cache Warmup x2, Uplink Tower x2 | 46.8% (+1.4); 10,000: 48.8% (+3.5) | passes CI; Aegis > Cortex gate +4.1, real -2.4 | **+5.9** |
| N2 (neutral): Cache Warmup x2 only | 45.0% (-0.4) | Null > Aegis gate moves further out | +6.3 |

**What it shows:**
1. **The real-Aegis lists don't do what option C hoped.** Heavier lists do use up Aegis's spare late
   energy (2.83 left per late turn -> 2.08 for C3), but the signature card is worth just as much to
   Aegis (+10.0 -> +10.1). Where Null > Aegis moves, it's because Aegis gets weaker everywhere,
   which costs Aegis > Cortex. C4 reaches the band only by gutting Aegis (cutting the Cadets breaks
   its Cadet -> Sentinel -> Warden line).
2. **So session 44's "spare energy" reading was a symptom, not the cause.** What shrinks the gain
   is drawing cards: both neutral card-draw lists roughly halve it (+5.9, +6.3). The signature card
   is worth most to Aegis as one more card when Aegis runs short of useful ones. Note that hands are
   rarely empty (about 12% of late turns); they hold cards that aren't worth playing then.
3. **For the next set (your fallback A, now in roadmap.md):** give Aegis its own card flow or a real
   late play that refills its hand, rather than more mid-cost bodies, and give Null an answer to one
   durable attacker. Null > Aegis stays the real-match check's one accepted-out-of-band edge.

### [ANSWERED 2026-10-19: leave N1] N1, the neutral card-draw list

N1 is the one list that passes both CI checks and halves Aegis's signature gain, but it's built
from neutral cards, which is outside what you asked for, and it only moves Null > Aegis +3.5 (at
10,000). **My recommendation: leave it** (fallback A as you set it), and use what it shows for the
next set's Aegis design. If you'd rather have it now, say "ship N1" and I'll change the Aegis list
and re-record both baselines.

Smaller calls you may want to overrule:
1. **I applied fallback A without waiting,** as your answer allowed: no card change, roadmap note
   written.
2. **The 10,000-game confirmation was run on C3 and N1** (the best all-Aegis list that isn't a plain
   nerf, and the best comparison), not C4.
3. **The signature wording change keeps the old text inside the fingerprint** (the same approach
   as the session-38 ability ids), rather than re-recording every fingerprint.

---

**Updated 2026-10-18, session 44 (your 2026-10-18 answers to session 43: option A).** Nothing is
blocking. One new **[OWNER CHECK-IN]** below. No card or signature option was changed. Evidence:
`progress/balance-report-031-real-ring-aegis-gain.txt`.

Done:
- **The ring's second CI check now measures real matches** (`npm run ring:real`): set Mythics in
  the deck, an approved menu card each side. Its baseline is recorded and CI runs it in place of
  the set-Mythic mode. The set-Mythic mode still runs as a report (`npm run ring:signature`).
- **A correction: session 43's "even draw" wasn't even.** It reached 2 of the 14 approved lines per
  side, not 14 (your smaller call 1 accepted what the check-in said, which wasn't true). A new test
  caught it. The draw now uses all 14 lines equally, half going first and half going second. The
  headline barely moved: Null > Aegis 45.2% -> 45.4%.

### [OWNER CHECK-IN] Why a signature card helps Aegis most, and what to do about Null > Aegis

**With all 14 lines, a signature card is worth +9.9 points to Aegis on average, and +0.9 to +3.1
to the other factions** (a faction alone holding one, against the gate; 2,500 games a cell).

| faction | vs each opponent | mean |
|---|---|---|
| Aegis | +10.2 Null, +12.8 Cortex, +6.7 Swarm | **+9.9** |
| Null | +5.1 Aegis, +0.5 Swarm, +3.8 Cortex | +3.1 |
| Swarm | +3.3 Cortex, -2.1 Null, +4.5 Aegis | +1.9 |
| Cortex | +5.5 Aegis, -2.8 Swarm, -0.1 Null | +0.9 |

**What drives it:**
1. **Spare energy.** Aegis's deck is mostly 1-3 cost cards. Late in a game (5+ energy) without a
   signature card, Aegis ends its turn with 2.9 energy unspent; the others leave 1.8-2.2. Nearly half
   of Aegis's late turns end with 3 or more unspent. A signature card is a 5-cost play that is always
   there, so for Aegis it costs almost nothing it would otherwise use. **Checked:** a heavier Aegis
   deck (3 Cadets swapped for 3 plain 5-drops, for the test only) cuts the gain by about 3 points on
   every edge. So this is about a third of the gap.
2. **The card becomes Aegis's attacker.** Aegis's signature card makes the most attacks and deals the
   most damage to the opponent of any faction's (up to 5.5 a game against Cortex), and opponents
   attack it most. Aegis's own deck is walls with little attack. (This one is a correlation; I
   haven't tested it directly.)
3. **Not tools.** Aegis puts the most tools on it, but a rule that no signature card can carry tools
   moves Null > Aegis only +1.4, within noise.

**What I tried for Null > Aegis** (45.4%, band 55-60, so 9.6 points short; each change patched for
the test only):

| change | Null > Aegis | side effects |
|---|---|---|
| T1: no tools on a signature card (a rule) | +1.4 (noise) | none |
| T2: Kernel Panic kills up to 5 health (was 4) | +0.0 | none (it comes out in ~11% of Null's games against Aegis) |
| T3: Kernel Panic kills up to 6 health | +0.4 (noise) | none |
| T4: Plating Module +0/+2 (was +0/+3) | +1.5 (noise) | Aegis > Cortex -1.8 (gate -2.7) |
| **T5: Null Singularity costs 6 (was 7)** | **+3.8 -> 49.2%** (gate +3.3 -> 53.9%) | Swarm > Null -3.3 -> 52.4%, out of band |
| T6: every signature card costs 6 (a rule) | +2.8 (borderline) | Aegis > Cortex -3.3 -> 52.8%, out of band |

No single change reaches the band. The best one, T5, closes 3.8 of the 9.6 points and pushes Swarm >
Null out of band.

**Question: what should I do about Null > Aegis?**
- **A (my recommendation).** No card change now. Keep Null > Aegis as the real-match check's one
  accepted-out-of-band edge (CI already treats it that way: it fails only if the edge gets worse).
  Fix it with the next set, aimed at the cause: give Aegis a real late-game play, so its late turns
  aren't empty and a signature card adds less, and give Null an answer to one durable attacker.
- **B.** Apply T5 now (Null Singularity costs 6): Null > Aegis +3.8, and accept Swarm > Null slipping
  to 52.4%. I'd re-record both baselines with it.
- **C.** Have me test the cause directly first: an Aegis deck change that adds late plays using real
  Aegis cards (not test stand-ins), measured on all six edges, before anything goes in.

Smaller calls you may want to overrule:
1. **The new check's baseline records Null > Aegis as out of band,** so CI accepts it as long as it
   doesn't get worse. That's the rule the gate uses for its own out-of-band edges.
2. **The draw gives each of the 14 lines to each side equally,** half going first and half second,
   and the two sides never hold the same line in one game. Real owners pick 1 of 3, so the real
   mix may lean to some lines.
3. **Session 43's report keeps its old numbers** with a correction note at the top, not a rewrite.

---

**Updated 2026-10-18, session 43 (your 2026-10-18 answers to session 42: leave Mainframe Core; look
into the signature-mode ring).** Nothing is blocking. One new **[OWNER CHECK-IN]** below. No card,
signature option or baseline was changed. Evidence:
`progress/balance-report-030-signature-ring-drivers.txt`.

### [OWNER CHECK-IN] The signature-mode ring: what drives Aegis > Cortex at 71.5%, and what to do

**First, a correction.** The 71.5% is not how a real match plays, and my session-42 note said
"with signature cards in their zone" without making that clear. Sorry. The ring's "signature mode"
puts each faction's **set Mythic** in the signature zone (Prime Aegis, Quorum Arbiter, Hive Mother,
Null Singularity). It was recorded in session 31 as a "what if" (your option A, 2026-10-11). A real
match gives each agent its **generated Neutral signature card** from the approved menu, and a set
Mythic, if the owner has one, is an ordinary deck card. So I measured the six ring edges four ways
(2,500 games per edge, the same games and agent as balance-report-029):

| edge (band) | gate: no signature card | set Mythic as signature card (the 71.5%) | real match stand-in: Mythic in deck + an approved menu card each |
|---|---|---|---|
| Null > Aegis (55-60) | 50.6% | **30.5%** (24.5 under) | **45.2%** (9.8 under) |
| Aegis > Cortex (55-60) | 49.3% | **71.5%** (11.5 over) | 54.2% (0.8 under) |
| Cortex > Swarm (55-60) | 58.2% | **43.9%** (11.1 under) | 52.9% (2.1 under) |
| Swarm > Null (55-60) | 57.1%, in band | 64.8% (4.8 over) | 56.3% |
| Null ~ Cortex (45-55) | 45.6% | 45.1% | 47.9%, in band |
| Aegis ~ Swarm (45-55) | 51.9%, in band | 56.1% (1.1 over) | 55.2% |

**Why Aegis > Cortex is 71.5% in the set-Mythic mode: Prime Aegis is always available.**
- Moving Prime Aegis alone into the zone is worth **+33 points** to Aegis against Cortex. Quorum
  Arbiter in Cortex's zone gives back only 11.
- Prime Aegis comes down on Aegis's 6th turn in 95% of games and dies in 1.4% of them. Cortex has
  nothing that removes a 4/8 that makes itself 5/9 and gives every Cortex unit -1 attack. Aegis
  wins 75% of the games where it sticks.
- It is not the replay rule (it almost never dies, so it is almost never replayed), and not the
  agent's play (it plays it on curve whenever it can). It is a card balanced as a 1-in-4 draw
  being guaranteed every game.
- The other far-out edges in that mode follow the same ranking of Mythics in the zone:
  Prime Aegis (worth 23-33 points) > Hive Mother (14-20) > Null Singularity and Quorum Arbiter
  (4-11). Null > Aegis (30.5%) is Prime Aegis again. Cortex > Swarm (43.9%) is Hive Mother.

**In the real-match stand-in, Aegis > Cortex is fine (54.2%, just under 55). The edge that is far
out there is Null > Aegis (45.2%).** A signature card is worth more to Aegis than to anyone:
+11.6 points against Cortex and +10.6 against Null, where the other factions gain 4-6. I haven't
measured why yet. My guess: Aegis's auras and buffs stack on one more durable body.

**What I tried on Prime Aegis** (patched for the test only):

| change | set-Mythic mode | real-match stand-in | gate |
|---|---|---|---|
| P1: costs 7 | Aegis > Cortex 56.3% (-15), Null > Aegis 46.7% (+16) | Null > Aegis +3.2, but Aegis > Cortex 51.9% (-2.3) | Aegis > Cortex 45.8% (-3.5, further out) |
| P2: loses "Enemy units get -1/-0" | Aegis > Cortex 62.8% (-8.7) | Null > Aegis +3.2, Aegis > Cortex -3.0 | Aegis > Cortex -3.8 |
| P3: 4/8 -> 4/6 | no change | no change | no change |

Every Prime Aegis cut fixes Null > Aegis but pushes Aegis > Cortex further under its band in the
gate. One card can't fix both Aegis edges.

**Question: what should the ring's second check measure, and what should I do next?**
- **A (my recommendation).** Make the CI's second check measure **real matches**: set Mythics in
  the deck, each side an approved menu card (the right-hand column). Keep the set-Mythic numbers
  as a report only, not a CI check. Change no cards now. Next game session: find out why Aegis
  gains twice as much from a signature card as anyone, and propose a fix for Null > Aegis in that
  mode at a check-in.
- **B.** Keep the set-Mythic mode as the second check, and nerf Prime Aegis (P1, cost 7) so that
  mode comes closer to its bands. This costs the gate's Aegis > Cortex 3.5 more points.
- **C.** Leave everything as it is until the next set, as with Mainframe Core.

Smaller calls you may want to overrule:
1. **The real-match stand-in draws each side's signature card evenly from the 14 approved lines.**
   Real agents pick 1 of 3 candidates, so the real mix may lean to some lines.
2. **All six edges were measured at 2,500 games,** including the two even edges the gate measures at
   900. The set-Mythic column still matches the recorded baseline exactly.
3. **No set Mythic can be a signature card in a real match today.** If you ever want set Mythics in
   the zone (session 31's "what if"), option B becomes the starting point.

---

**Updated 2026-10-18, session 42 (your 2026-10-18 answers to session 41: Zero-Day goes live; look
at Aegis vs Cortex).** Nothing is blocking. One new **[OWNER CHECK-IN]** below, on Aegis vs Cortex.
Evidence: `progress/economy-demo-010.txt`, `progress/balance-report-029-aegis-cortex-shift.txt`.

Done:
- **The 3 Zero-Day cards are live,** at the numbers you approved (Carrier +1/+0, Privilege
  Escalation "the number of other units", Kill Switch as designed).
  - They are in the card list. A copy pulled from a pack is the real card. It goes in a saved deck
    and plays. The demo plays a real match where the agent plays Patient Zero, choosing Carrier.
  - Copies pulled before today become the cards too. A copy's card id was already the card's id,
    so nothing in an owner's database changes.
  - Zero-Day crafting is open at 3,000 pack points. One copy per card, account-bound, never
    salvaged, as for secret illustrations.
  - The secret list names them: 226/096 Patient Zero, 227/096 Root Access, 228/096 Kill Switch.
  - The base set is still 96 cards. The Zero-Day cards don't get a base number, a Gold version or
    a plain version, and never come up in a normal slot.
  - Still 1 per deck. They count toward the 10 neutral cards and the 25% removal share.
- **Aegis vs Cortex: investigated, no card changed.** See the check-in.

### [ANSWERED 2026-10-18: B, leave it] Aegis vs Cortex: why it moved, and a proposed fix

**Why it moved.** I replayed the same 2,500 gate games four ways, with each side played by the old
agent or the new one:

| Aegis played by | Cortex played by | Aegis wins |
|---|---|---|
| old agent | old agent | 52.2% |
| new agent | old agent | 52.3% |
| old agent | new agent | 48.9% |
| new agent | new agent | 49.3% |

- The whole move comes from **Cortex being played better.** How Aegis is played makes no
  difference.
- The card that changed most is **Mainframe Core** (3 energy, "Your units get +1/+1"). The new agent
  plays it in 46% of games, up from 39%. The old agent counted an aura for one turn only, so it
  under-played this card.
- So the 52.2% was measured against a Cortex that under-played its best engine card. The soft
  counter was thinner than it looked all along.

**What I measured** (gate mode, 2,500 games per edge; nothing shipped):

| change | Aegis > Cortex (band 55-60) | Null ~ Cortex (45-55) | Cortex > Swarm (55-60) |
|---|---|---|---|
| as shipped | 49.3% | 45.6% | 58.2% |
| **B: Mainframe Core +1/+0** | **53.0%** (+3.7, a real move) | 48.3%, in band | 55.9% |
| A: Mainframe Core costs 4 | 50.3% (within noise) | 47.3% | 57.0% |
| C: one copy, not two | 51.2% (within noise) | 43.9% | 58.6% |

- **B is the only change that moves Aegis vs Cortex by a real amount.** It takes the edge back above
  the 52.2% you accepted on 2026-10-04. It also brings Null vs Cortex into band, and Cortex vs
  Swarm stays in its band.
- No single Mainframe Core change I measured reaches the 55-60% band.
- **The catch:** with signature cards in their zone, B moves Aegis vs Cortex from 71.5% to 74.8%.
  That edge is already far over its band in that mode. The CI check for that mode would fail, so
  shipping B also means re-recording both baselines on purpose, as the gate's rules allow for a
  change you approve.

**Question: what should happen to Aegis vs Cortex?**
- **A (default): ship B.** Mainframe Core becomes "Your units get +1/+0". I re-record both ring
  baselines and commit a balance report.
- **B: leave it.** Accept 49.3% as the edge for now and look again with the next set.
- **C: fix it on Aegis's side instead.** Name the direction (for example, an answer to Directives),
  and I design and measure options first.

**Calls I made (overrule any):**
1. **A Zero-Day card has no version but its Zero-Day finish.** No plain, Foil or Gold copy of it can
   exist. Packs never rolled one; this makes it a rule in the store, so nothing else can grant one.
2. **`craftCard` refuses Zero-Day cards** and points to `craftSecret` (3,000). Without this,
   Zero-Day cards could have been crafted at the Mythic price (800) now that they're in the card
   list.
3. **The render lane's pack-opening page is regenerated** (only the Zero-Day pull changed: it now
   shows Patient Zero, not the reserved entry). Two render tests that checked for the reserved
   entry now check for the real card. The reserved face is still tested with a card id that doesn't
   exist.
4. **For the render lane:** a Zero-Day card's face shows no rules text in the pack page. Its text is
   in its two modes, and the face only reads `abilities`, which is empty on a modal card. The render
   lane can show both modes on the face.

---

**Updated 2026-10-17, session 41 (your 2026-10-18 answers: fix the agent first, then the cap).**
Nothing is blocking. One new **[OWNER CHECK-IN]** below: OK to make the 3 Zero-Day cards live at the
tuned numbers. Evidence: `progress/balance-report-028-agent-fix-zero-day-tuned.txt`,
`progress/sample-match-034-modal-cards-agent-fix.txt`.

Done:
- **The measuring agent is fixed, for every card.**
  - A unit's own auras, death triggers and turn triggers now count, plain or modal, by one rule.
  - An aura counts over the next 3 turns, including units that arrive later.
  - A stun counts each turn it holds a unit. Overload counts as its damage.
  - A bug found on the way: a shield (Barrier) on your own unit used to score as a loss. Fixed.
  - It is a better player: it beats the old agent by 1.5 points over 64,000 games.
- **Mode picks now read the board.** Carrier went from 23% to 68% of Patient Zero plays. Lights Out
  went from 1 cast in 17,967 to 44% of Kill Switch casts.
- **The ring baseline is re-recorded once, as you allowed.** No card changed; what moved is the
  better agent:
  - Aegis no longer beats Cortex in normal play (52.2% -> 49.3%). This is a real move.
  - Null vs Cortex, Aegis vs Swarm and Cortex vs Swarm moved from "in band" to "unresolved". These
    moves are within noise.
  - With the signature cards in their zone, Aegis vs Cortex moved toward its band (75.9% -> 71.5%).

### [OWNER CHECK-IN] The 3 Zero-Day cards: final numbers, and going live

Measured at 10,000 games per pairing with the agent choosing the mode (your cap: at most 4 points on
any edge, every mode in at least 10% of plays).

| card | at your numbers | proposed change | after |
|---|---|---|---|
| Patient Zero | 5.37 points: **over** | Carrier: "Your other units get **+1/+0**" (was +1/+1) | 2.73; Carrier 26%, Outbreak 74% |
| Root Access | 4.18 points: **over**; Lockout 6.7% for Swarm | Privilege Escalation: "attack equals **the number of** other units" (was 1 plus) | 3.52; Lockout 17-32% per faction |
| Kill Switch | 3.52; Lights Out 44% | none | passes as designed |

Other trims I measured, not proposed:
- Patient Zero with a 1/4 body misses the cap by 0.06 (4.06).
- Patient Zero with a 2/3 body fails (4.45).
- Patient Zero with Carrier at +0/+1 passes, but it is weaker (2.02).
- Root Access with a 3/5 body still fails (4.06), and Swarm still plays Lockout only 6.7%.

**Question: go live at these numbers?**
- **A (default):** yes. The next game session adds the 3 cards to the card list. A pulled copy
  becomes the real card, and Zero-Day crafting opens at 3,000. An economy test checks both.
- **B:** use different numbers. Name them, and I measure them the same way first.

**Also for you (no default action):** Aegis vs Cortex. With the better agent, Aegis no longer
beats Cortex in normal play. Should a later session look at it, or wait for the next set?

**Calls I made (overrule any):**
1. **A stun turn is worth the unit's full attack** (not 0.6 of it). This is the one constant chosen
   by measurement: at 0.6 the agent still almost never picked Lights Out.
2. **A trimmed body is measured against your designed body,** not against a stand-in trimmed the
   same way. The question is "how much stronger than the card as designed".
3. **The "10% of plays" rule is checked for each faction separately,** not only overall. Root Access
   passed overall at your numbers (11.5%) but not for Swarm.
4. **Render tests:** four render tests replayed games that now go differently. I re-picked their
   seeds and kept every check. The render lane's committed replay pages were made with the old
   agent and will look slightly different when regenerated.

---

**Updated 2026-10-17, session 40 (your 2026-10-18 Zero-Day designs; build-order step 2, the "choose
one" mechanic).** Nothing is blocking. There is one **[OWNER CHECK-IN]** below, with a default: the
3 Zero-Day cards are built but not live until you agree how they are capped. Evidence:
`progress/sample-match-033-modal-cards.txt` (a real game with 5 mode choices),
`progress/balance-report-027-zero-day.txt` (the measurement, 10,000 games per pairing).

Built:
- **"Choose one" in the engine, for any card.** A modal card lists its modes, each with a name, its
  text and ordinary abilities (an enter-play effect, an aura, a death trigger: anything).
  - Each mode is its own legal move, so an agent picks a mode the way it picks a target. A mode
    that has no legal target isn't offered; the other mode still is.
  - The copy played carries the chosen mode only. The other mode is gone for that copy, so every
    rule that reads a card's abilities sees exactly what the agent chose.
  - The choice is logged: "p1 plays Patient Zero, choosing Outbreak", "p1 casts Kill Switch,
    choosing Wipe". The events carry the mode's id and name, so replays and the feed can show it.
    The render lane can word it in the feed next.
  - When the card leaves play it goes to the graveyard as the printed card.
  - Units, evolutions, Directives and Commands can all be modal. Tools and signature cards can't.
  - Shipped decks have no modal card yet, so every existing measurement is unchanged (the ring
    check moved +0.0 on all six edges).
- **The 3 Zero-Day cards, exactly as you designed them, at your starting numbers:** Patient Zero,
  Root Access, Kill Switch, Neutral, ids `S0-ZD1` to `S0-ZD3`, 1 per deck (checked when a deck is
  built).
  - **Not live yet.** They are kept out of the card list the economy reads, so a pulled copy is
    still "Zero-Day 1 (not designed yet)" and crafting stays closed. Making them live is one line;
    a pulled copy then becomes the card with no data change.
- **The side task:** "Zero-Day" already left the name word lists in session 37. It was in them
  only in sessions 35 and 36. No name in any committed sample or demo used it. Agents in owners'
  own databases can't be checked from the repo; there is no live player base yet.

### [OWNER CHECK-IN] Zero-Day cards: the strength cap, and the agent that measures it

**What was measured.** Each card went into each faction's deck in place of a plain card of the same
cost with no ability (same body for the two units). It played the same 10,000 seeds per pairing
against the other three factions. I also ran each card locked to one mode, to see whether the
agent's choice is worth anything.

| card | worst edge move | average move | modes the agent picked | locked to each mode (worst / average) |
|---|---|---|---|---|
| Patient Zero | 2.5 points | 1.7 | Outbreak 77%, Carrier 23% | Outbreak 2.1 / 0.9; **Carrier 6.0 / 4.7** |
| Root Access | **4.5 points** | 3.6 | Privilege Escalation 88%, Lockout 12% | Priv. Escalation 3.4 / 2.8; Lockout 1.8 / 1.1 |
| Kill Switch | 2.3 points | 1.7 | **Wipe 100%, Lights Out 1 in 17,967** | Lights Out 2.9 / 2.0; Wipe 2.3 / 1.7 |

What this says:
- All three are stronger than a plain card on every edge, and none breaks the game.
- **The agent that does the measuring reads two of the three cards badly.**
  - It picks Outbreak most of the time, but Carrier is far stronger.
  - It never picks Lights Out, though per cast Lights Out does more than Wipe. So "agents use both
    modes" fails for Kill Switch today.
  - Why: the reference agent values an aura (+1/+1 to your units for the rest of the game) as a
    small one-off bonus, and a stun as the same size whether it lasts one turn or two.
- So the measured strength depends on the agent. A better chooser makes Patient Zero stronger
  (towards 6.0 on an edge). A cap set on today's numbers would be set against an agent that leaves
  strength on the table.

**Question 1: what to do first.**
- **A (my recommendation, the default):** fix the agent first. Value auras over a few turns and
  stuns by how long they last, for every card, not only modal ones. Re-record the ring baseline
  once, as when the signature zone landed. Then re-measure the 3 cards and tune them to the cap.
  This is the same "fix the instrument before balancing" rule you set in September. One session.
- **B:** fix it only for the mode choice. It's cheaper and the ring doesn't move, but the agent
  would then judge the same aura one way on a modal card and another way on a plain card.
- **C:** tune on today's numbers and go live now. Root Access would need a cut (for example,
  Privilege Escalation's attack becomes "the number of other units", one less). Kill Switch would
  still be played in one mode only.

**Question 2: the cap.** I propose **4 points at most on any edge, measured at 10,000 games per
pairing with the agent choosing the mode**, plus every mode picked in at least 10% of the games
where the card is played. Today Patient Zero and Kill Switch are inside 4 points and Root Access is
just over (4.5, Swarm vs Aegis). Kill Switch fails the 10% rule. If a card fails after option A,
I change its numbers, not its idea, and say which numbers in the notes.

**Calls I made (overrule any):**
1. **Kill Switch is Sorcery speed** (your own turn, nothing on the stack). Your design names no
   speed, and a board-wide stun or sweep at instant speed during the other side's attack felt too
   strong for a first measure.
2. **Zero-Day cards don't follow the neutral pool's rules** (no removal, no auras), because you
   made them Neutral knowing what they do. They have their own: two modes, Neutral, 1 per deck.
   They still count toward a deck's 10 neutral cards and its 25% removal share.
3. **A finding from that:** Null's shipped deck sits at exactly 25% removal. Adding Root Access or
   Kill Switch (both count as removal) means cutting a removal card. The measurement cut a removal
   card for those two everywhere, so no deck's removal share moved.
4. **The simple Aggressive test agent always plays a modal card's first mode.** It picks by cost,
   and both modes cost the same. The Random agent picks either; the Lookahead agent reads the board.
   Only Lookahead is used for balance.

Next game-lane session, unless you say otherwise: option A, then re-measure, propose the final
numbers, and make the 3 cards live with your OK.

---

**Updated 2026-10-17, session 39 (your 2026-10-18 answers: the chase cards go live; the Intercept
Routine side task).** Nothing is blocking and there is no new check-in. Below are the calls I made
while building, in case you want any changed. Evidence: `progress/economy-demo-009.txt` (the store
end to end), `progress/pack-sim-002.txt` (rerun: every number identical).

Built:
- **The chase cards are live.** Every pack now opens under `S0-odds-2`, and each opening records
  it. The secret list, the Glitch list and the table are exactly as you approved.
  - In 2,000 packs opened through the store, 20.2% had a hit (the million-pack simulation: 20.7%).
- **Crafting secret cards:** 750 pack points for an illustration, 3,000 for a Zero-Day card.
- **The binder and checklist:** five sections in number order:
  - the base set (96);
  - the secret cards (33 illustrations, then the 3 Zero-Day);
  - Glitch (20);
  - Gold (96);
  - the 15 Prototype runs, with the serials held.
- **Old packs:** packs of any season stay openable, under today's table.
- **Every pack opened before today still reproduces from its seed.** The two pack rollers are now one,
  and a test pins thousands of packs from each table.
- **The side task:** both Intercept Routine fizzles now say why as data ("already aimed" or "no
  attack to redirect"), with the card and the attack's names.
  - Before shipping, I found that the match feed would have misread the new data as "its target
    left play first". I made a one-line guard in the feed so its text stays exactly as it was. A
    test now checks this.
  - The render lane can now word these lines itself.

**Calls I made (overrule any; each is small to change):**
1. **A Zero-Day card can be pulled now, before it's designed.** It keeps your approved 0.2%.
   - The copy is a reserved entry, "Zero-Day 1 (not designed yet)", numbered `226/096`.
   - It can't go in a deck or be crafted until build-order step 2 designs the card.
   - It becomes playable then by itself, with no change to anyone's collection.
   - The other option was 0% until the cards exist. That would change the table you approved.
2. **Crafting makes one copy per secret card.** Crafting is refused while you hold that secret card.
   - A crafted secret card is account-bound, like every crafted card: it can be played and never
     sold. Only pulled copies could reach a marketplace.
3. **Zero-Day crafting opens when the cards are designed.** Until then, they can only be pulled.
4. **The NEW badge is per collection entry.**
   - An illustration is NEW even if you hold the plain card.
   - A Glitch card is NEW until your first Glitch copy of that card.
   - The plain card isn't NEW if you already hold its illustration or Glitch copy, because that
     fills its base place.
5. **Full reveal in a 10-pack open:** secret and Zero-Day packs keep it, like Gold and Prototype. A
   Glitch pack (about 1 in 25) doesn't by itself.
6. **Base-set completion counts any copy of a card,** in any finish. An illustration or a Glitch
   copy also fills its card's base place, as in the simulation.
7. **Packs bought before the switch** open under `S0-odds-2`, the table that is live when they open.

Next game-lane session: build-order step 2, the generic "choose one" mechanic. After that come the 3
Zero-Day cards.

---

**Updated 2026-10-17, session 38 (your 2026-10-17 answers, the 2026-10-18 side task, and step 1
of the order: the chase-card proposal).** Nothing is blocking. There is one **[OWNER CHECK-IN]**
below, with defaults; nothing in it goes live until you answer. Evidence:
`progress/pack-sim-002.txt`, `progress/signature-ability-ids-001.txt`,
`progress/economy-demo-008.txt`.

Built:
- **Your naming answers:**
  - An agent's **first rename is free**; every later one costs 100 pack points.
  - An admin's force-rename doesn't use up the free one.
  - **Typed names may repeat a word** ("Bit by Bit", "Static Static"). Generated names still never
    do.
- **The side task (render's find):**
  - **Every version of a signature ability has its own id** now: `sig-recycle` (draw 2),
    `sig-recycle.c1` (draw 1), `sig-recycle.c3` (draw 3). Over 3,000 generated agents, 1,262
    abilities shared an id with a different version before; now none do. A test checks this
    every run.
  - Existing agents keep working: their cards are rebuilt from what they are, so they get the new
    ids, and their recorded fingerprints still match. Old replays can be mapped to the new ids.
  - **The game-over line reads properly:** "Rombot's Navigator's health reached 0" instead of
    "Rombot's Navigator health depleted". The event also says why as data (health reached 0, or
    the turn cap), so the feed and the commentators can word it their own way.

### [ANSWERED 2026-10-18: A on 1-6, all 4 smaller calls kept; built session 39] Chase cards: the secret list, the Glitch tier and the new odds table

Nothing here is live. The store still opens packs with today's table (`S0-odds-1`). The numbers
are measured in `progress/pack-sim-002.txt`.

**1. The secret cards (33 illustrations + 3 Zero-Day).** Numbered above every Gold number:
`193/096` to `225/096`, then Zero-Day at `226/096` to `228/096`. Each one has its own place in the
binder and the checklist, and a placeholder art slot until the art pass.

| Pool | Illustration versions proposed |
|---|---|
| Cortex (8) | Quorum Arbiter, Mainframe Core, Recursive Construct, Overload Capacitor, Firewall Sentinel, Watchtower Relay, Signal Drone, Init Daemon |
| Swarm (7) | Hive Mother, Bloodswarm Alpha, Overclock Beast, Dormant Egg Sac, Molted Stalker, Spore Cluster, Swarm Larva |
| Aegis (7) | Prime Aegis, Aegis Warden, Latent Ward, Lockdown Field, Reinforced Bastion, Perimeter Turret, Aegis Cadet |
| Null (7) | Null Singularity, Kernel Panic, Entropy Harvester, Segmentation Fault, Fork Bomb, Garbage Collector, Glitch Seed |
| Neutral (4) | Uplink Tower, Power Reserve, Relay Courier, Scrap Recycler |

   - That's every Mythic, 13 Rares, 9 Uncommons and 7 Commons.
   - A few humble cards are in on purpose: a painted Swarm Larva is part of the charm, as with the
     benchmark's illustration cards.
   - Options: **A** this list (default). **B** your changes (swap any card in or out).

**2. Zero-Day.** About **1 pack in 500** overall, so each card is about 1 in 1,500 (measured: 1 in
485 overall). Animated, built in code by the render lane.
   - The 3 cards are empty slots until build-order step 2.
   - Proposed: they count as **Mythic** for the Mythic pity timer.

**3. The Glitch tier.**
   - **20 Units qualify,** 4 per pool:
     - Cortex: Quorum Arbiter, Recursive Construct, Firewall Sentinel, Signal Drone;
     - Swarm: Hive Mother, Overclock Beast, Corrosive Spitter, Molted Stalker;
     - Aegis: Prime Aegis, Aegis Warden, Perimeter Turret, Aegis Sentinel;
     - Null: Null Singularity, Kernel Panic, Entropy Harvester, Zombie Process;
     - Neutral: Uplink Tower, Relay Courier, Scrap Recycler, Commodity Rack (Neutral has only 4
       units).
   - **Why Units only:** a corrupted creature or machine reads as a glitch. A corrupted spell frame
     reads as a rendering bug.
   - **Rate: 4% of packs** (about 1 in 25).
   - **The look:** the card's own art with a corrupted palette, scanlines, jumping block tears, and
     an RGB split on reveal. No new art.
   - **It counts as a hit** (Full Art or better) for pity and the 20% target.
   - It keeps its base card's number with a glitch mark. Numbers above the total stay for secret
     cards.
   - One thing to know: Null is already glitch-themed, so a Glitch Null card is the subtlest.
   - Options: **A** as above (default). **B** a different list, or a different rate.

**4. The new odds table, `S0-odds-2`.** The shine slot:

| Finish | S0-odds-1 (live) | S0-odds-2 (proposed) | Lands on |
|---|---|---|---|
| Standard | ~56% | ~53.6% | any card |
| Foil | 30% | 28% | any card (unchanged) |
| Full Art | 10% | 9% | Uncommons, Rares, Mythics (40/45/15) |
| Glitch | — | 4% | its 20 cards |
| Alt Art | ~3.3% | 3% | Rares, Mythics (75/25) |
| Secret illustration | — | 1.5% | its 33 entries |
| Gold | ~0.7% | 0.7% | Rares, Mythics (70/30) |
| Zero-Day | — | 0.2% | its 3 cards |

   Measured against your targets:

| Target | S0-odds-1 | S0-odds-2 |
|---|---|---|
| ~20% of packs with Full Art or better (pity on) | 17.3% | **20.7%** |
| Full Art on Commons | 60% | **0%** |
| Gold on Commons | 59% | **0%** |
| Base set, median packs | 134 | **130** (57 for an owner who salvages and crafts) |
| Jackpot | 1 in 2,062 | 1 in 2,062 (unchanged) |
| Pity timers | fire as set | fire as set; longest dry run 10 |

   - Options: **A** this table (default). **B** your numbers.

**5. The full set can't take "months" by opening packs alone. It takes years.** This is the one
real conflict in your targets:
   - **33 illustrations at 1.5% of packs** need a median **7,593 packs**, about 104 months at 2.4
     packs a day.
   - **The 3 Zero-Day cards** need a median **1,950 packs** (about 27 months). One Zero-Day card
     takes a median 314 packs.
   - No sane rate fixes this. The last few cards of any chase list are the slow ones, and doubling
     the rate only halves the time, while pushing hits far past 20%.
   - **The benchmark's lever is crafting with pack points** (your item 5, "later"). I measured it so
     you can decide with numbers:

| Craft price (secret / Zero-Day) | Master set (base + 33 illustrations) | Full set (+ 3 Zero-Day) |
|---|---|---|
| none | ~104 months | ~104 months |
| 1,500 / 5,000 | 8.9 months | 10.7 months |
| 1,000 / 5,000 | 6.6 months | 8.5 months |
| **750 / 3,000** | **5.2 months** | **6.6 months** |
| 500 / 2,500 | 3.9 months | 5.0 months |

   (A dedicated owner at 2.4 packs a day, who salvages standard extras beyond the playable limit
   and crafts the cheapest missing card first. Owners who keep extras to trade take longer.)

   - Options: **A** build secret crafting next to S0-odds-2, at 750 / 3,000 pack points (default:
     about 5 and 7 months). **B** another price. **C** no crafting: the full set is a multi-season
     chase.

**6. Season 0 is 6 weeks long.** A full set "in months" only works if Season 0 packs can still be
opened after the season.
   - Options: **A** older seasons' packs stay openable (default: the season ends the ladder, not
     the packs). **B** a season's packs retire with it, so the full set is a within-season chase.

**7. Smaller calls, as built in the proposal** (overrule any):
   1. Glitch counts as a hit for pity and the 20% target. Foil doesn't.
   2. An illustration plays exactly like its card, and it can't be salvaged (like every finish).
   3. A Jackpot pack's other four cards roll Foil or better among the finishes their card can
      carry. Secret cards come only in the shine slot.
   4. Secret cards are picked evenly. A Mythic's illustration is no rarer than a Common's.

Next game-lane session, without an answer: the defaults above. That means the "choose one" mechanic
(step 2), while S0-odds-2 waits for your yes. With a yes on 1-6, the session after builds schema
v10 and switches `openPack` over, with crafting if you pick option 5A.

---

**Updated 2026-10-17, session 37 (your 2026-10-16 entries: naming agents, the pack answers, the
top finish, top-tier cards, modal cards, chase cards).** Nothing is blocking. There is one
**[OWNER CHECK-IN]** below, with defaults, so the next game-lane session can go ahead without an
answer. Evidence: `progress/economy-demo-007.txt`, `progress/signature-names-sample-003.txt`.

Built:
- **Owners name their agents** (your naming entry):
  - **Free at creation.** The 3 candidates arrive named, and the owner keeps one or types their
    own. The signature card keeps its generated name. Its flavour line is printed with the name
    the agent is created with.
  - **A rename costs pack points** (100 proposed, below). It's refused while that agent is in a
    live match.
  - **The rules run in the game's own server code** (the economy store), with no outside service.
    The check-in lists the rules; every refusal is shown in the demo.
  - **Old names stay on record.** Match history shows "Day Owl (formerly Night Owl)". An old name
    stays reserved, so nobody else can take it and borrow its history. The agent that held it can
    take it back.
  - **An admin force-rename** is free and logs its reason. The bad name is never shown again (not
    even as "formerly"), and it stays reserved.
  - The database itself refuses an unlogged rename, editing or deleting the name log, and a
    clashing name, even through raw SQL.
- **More room for generated agent names**, done as you suggested:
  - a third part, "[Handle]'s [Modifier] [Program]" ("Turbotiger's Moonlit Engineer");
  - 10,702 handles, 300 modifiers, 200 program words, about **648 million names** (it was about
    510,000);
  - no "v2" or "Mk III" endings;
  - on a clash, a numeral ("Cinderspider of the Blackout II").
  - Over 20,000 agents in one season, 32 needed a numeral. Almost all of them were "[Handle] of
    the [Place]" names: that pattern has only 56 places, so it is the smallest. More places would
    cut the numerals further if you'd like.
- **The pack answers:** nothing to change. Everything stands as built.
- **"Zero-Day" left the card-name word list,** so no signature card is named like the finish you
  proposed.

### [OWNER CHECK-IN] Naming calls, and where the top finish, modal cards and chase cards go

**Sample agent names** (more in `progress/signature-names-sample-003.txt`):

| [Handle]'s [Modifier] [Program] | [Handle]'s [Program] / of the [Place] | rarer patterns |
|---|---|---|
| Turbotiger's Moonlit Engineer | Monoqueen's Prodigy | Gray-Market Hyperowl |
| Novatoad's Unlicensed Guard Dog | Kryptoswift's Architect | Downloading Chromemedic |
| Rasterwasp's Rogue Duelist | Stacksaint of the Pirate Station | Smokejackal '95 |
| Baudwitch's Insomniac Enforcer | Copperpike of the Chatroom | Beta Cyberbat |

**1. The rename price.** Proposal: **100 pack points.** That's between crafting an Uncommon (80)
and a Rare (250), or about 20 packs' worth from opening packs alone. A rename is a choice, not a
whim.
   - Options: **A** 100 (default). **B** cheaper (40, a Common craft). **C** steeper (250), or your
     number. **D** the first rename free, then the price.

**2. Smaller naming calls, as built** (overrule any):
   1. **The cap is 32 characters,** for typed names too. You proposed 24, and allowed a little more
      for three-part names. One cap for both is simpler, and the longest generated name is 32.
   2. **ASCII letters only.** Letters from other alphabets would let "Аdmin" (with a Cyrillic A)
      get past the staff check.
   3. **Simple punctuation is ' . - _ and spaces.** A name starts and ends with a letter or digit,
      and punctuation can't run together ("a..b").
   4. **Typed names get the generated names' repeated-word check,** as your rules said. So "Static
      Static" is refused, and so is "Bit by Bit".
   5. **Staff words:** "admin", "moderator", "official", "AI-TCG" are refused anywhere in a name.
      "mod", "dev", "gm", "staff", "support", "system" are refused only as whole words, so "Modem
      Ghost" is fine.
   6. **An old name is reserved forever** to the agent that held it. The alternative is to free it
      after a season.
   7. **Usernames:** a name can't equal another owner's login username, ignoring case, spaces and
      punctuation ("Neon Fan 99" matches "neon_fan99"). An owner may use their own username.
   8. **A rename never reprints the signature card.** Its flavour keeps the name it was printed
      with.
   9. **Renaming is refused during that agent's live match.** An admin's force-rename is allowed
      during one, so a bad name doesn't stay on a broadcast.

**3. Where your other 2026-10-16 entries go.** Proposed order for the next game-lane sessions:
   1. **Chase cards, items 1-4, as a measured proposal before anything goes live.** That means:
      - the secret-card list (about 30-40 illustration versions plus the 3 Zero-Day slots, on
        placeholder art slots);
      - the Glitch rules (which cards qualify, and the rate);
      - a new odds table `S0-odds-2` that points the shine slot at chosen cards, with Zero-Day at
        about 1 pack in 500.

      Each is measured with the pack simulation against your targets: about 20% of packs with a
      Full Art or better, base-set completion, full-set completion in months, Jackpot 1 in 2,000,
      and pity still working. It goes first because it changes the pack odds just built, before
      anyone opens real packs.
   2. **The generic "choose one" mechanic** in the engine: chosen when played, offered to agents as
      separate legal moves, logged, and in the replays. The 3 top-tier cards need it, so it comes
      before them.
   3. **The 3 Zero-Day cards:** their own cards, each with 2 modes. Measured with the signature
      fairness test, with a proposed cap above the 2-point band. Built with your guardrails: 1 copy
      per deck, allowed in ranked play and tournaments.
   4. **Then the deck-building agent and the play styles**, as already ordered. It's better that
      the deck builder knows about modal and 1-per-deck cards from the start.
   5. **More modal cards in every faction** with the next card-set work. The ring regression checks
      stay in band, and I check that agents use both modes.

   - Options: **A** this order (default). **B** the deck-building agent first, then this list.
     **C** your order.

Next game-lane session, without an answer: the defaults above, starting with the chase-card
proposal (3.1).

---

**Updated 2026-10-16, session 36 (your 2026-10-16 answers to session 35, and the name patterns).**
Nothing is blocking. Step 1 of the order you accepted is built: **pack contents and opening**. There
is one **[OWNER CHECK-IN]** below, with defaults, so the next game-lane session can go ahead without
an answer. Evidence: `progress/pack-sim-001.txt`, `progress/economy-demo-006.txt`,
`progress/signature-names-sample-002.txt`.

Built:
- **Your answers to session 35:**
  - The username is in a card name 1 candidate in 100 (option C). The other rules are unchanged.
  - The art pool: each signature card records a random slot of its season's 500-piece pool when
    it's made, and keeps it forever. Its art reference names the slot
    (`placeholder:signature-pool/S0/217`) until the art pass fills the pool. Cards made before
    this change drew a slot when the database upgraded.
  - Agent names now come from the card-name generator, in hacker-handle style. They replace
    "Ilsa Delta". The 3 on one pick screen never share a final word.
- **The name patterns:** the [Handle]'s patterns are 61%, "[Thing] of the [Place]" 30%, and bare
  two-word and edition names 9%, under your 10%. The pattern is picked first, and only its words
  are re-rolled when the filter refuses one. That way the filter can't shift the split (it used to
  refuse long [Handle]'s names more often). Measured over 20,000 names: 61.0 / 29.8 / 9.2. Every
  place now starts with "the" ("the Zero Sector", not "Sector Zero").
- **Pack contents and opening** (roadmap item 5), all in the store and database, no interface yet:
  - **Set S0:** all 96 ownable cards numbered `001/096` to `096/096`, by faction, rarity and name.
    Each card's Gold number sits above the total (`097/096` and up).
  - **A pack:** 2 Commons, 1 Uncommon, the Rare slot (a Mythic 1 time in 8) and the shine slot,
    the only slot with a finish. Plus a Jackpot pack (1 in 2,000, every card Foil or better) and a
    Prototype bonus 6th card (1 in 1,000). The rates are one versioned table (`S0-odds-1`).
  - **Each opening is logged** with its seed and the table version. The seed is drawn when the
    pack opens, so it can't be read before.
  - **Pity per owner:** after 10 packs with no Full Art or better, and after 40 with no Mythic.
    It's worked out from the owner's opening history.
  - **Opening 1 pack or 10.** A 10-pack open gives a summary (cards, new cards, pack points, by
    rarity and finish) and names the packs that keep their full reveal (Gold, Prototype,
    Jackpot).
  - **Every card shows** NEW and "×N owned". Every pack pays 5 pack points.
  - **Crafting:** pack points buy a standard, account-bound copy, up to the card's playable limit.
  - The database refuses opening a pack twice, opening someone else's pack, marking a pack opened
    without its log, changing or deleting a log, a forged pack card, and a 7th card.
  - 19 new tests, and a simulation of 400,000 packs.

**What the simulation says** (`progress/pack-sim-001.txt`):

| | published | measured (400,000 packs) |
|---|---|---|
| Rare slot is a Mythic | 1 in 8 | 12.4% |
| Shine: Standard / Foil / Full Art | ~56% / 30% / 10% | 56.0% / 30.0% / 10.0% |
| Shine: Alt Art / Gold | ~1 in 30 / ~1 in 150 | 3.3% / 0.68% |
| Jackpot pack / Prototype | 1 in 2,000 / 1 in 1,000 | 0.049% / 0.099% |

- The Full Art pity fires in about 3.6% of packs. Ten dry packs in a row is about a 1-in-5 run.
  The Mythic pity almost never fires (0.01%), so it's a backstop.
- **Seeing every card takes a median of 130 packs** (13,000 credits). Every Mythic takes a median of 45.
- **Prototypes are very rare at your rate.** About 223 are found per 250,000 packs opened across
  the whole season. A small in-house Season 0 will most likely see none. That's your number, and I
  haven't changed it. It's raised below in case Season 0 should show one.

### [ANSWERED 2026-10-16: all defaults accepted] Pack details your spec didn't fix

1. **The shine slot's rarity.** "Any card, any rarity" didn't set the odds. Proposal: Common 60,
   Uncommon 25, Rare 12, Mythic 3. With the Rare slot, about 16% of packs hold a Mythic.
   - Options: **A** as proposed (default). **B** flat over the 96 cards (Mythics ~4%, Commons ~32%).
     **C** your numbers.
2. **Alt Art draws a Rare or a Mythic.** The finish is rolled first. On Alt Art, the card is drawn
   from the Rares and Mythics, so the ~1 in 30 holds. The alternative (re-roll Alt Art on a Common)
   would make it about 1 in 200. Default: as built.
3. **Which 15 cards get Prototype runs.** Proposal, with every faction's Mythic at the top and all
   five pools in:

   | run size | cards |
   |---|---|
   | 1/1 | Null Singularity |
   | /5 | Prime Aegis |
   | /10 | Quorum Arbiter |
   | /25 | Hive Mother, Kernel Panic |
   | /50 | Overclock Beast, Aegis Warden, Mainframe Core |
   | /100 | Bloodswarm Alpha, Entropy Harvester, Uplink Tower |
   | /250 | Recursive Construct, Latent Ward, Dormant Egg Sac, Watchdog Timer |

   "Fan favourite" for the 1/1 can't be measured before anyone has played, so I picked the most
   dramatic Mythic. You check the art before the list goes live in any case. Default: as listed.
4. **Prototypes in Season 0.** At 1 in 1,000, a house-only Season 0 will very likely find none.
   Options: **A** leave it (default; the rate is yours, and "never raise the rate to test it" is
   honoured). **B** a Season 0-only table with a higher rate, as its own odds version, so the
   reveal can be seen in-house.
5. **Smaller calls, as built:**
   - "NEW" means the owner held no copy before the pack. A card new in a bulk open counts once in
     the summary.
   - A 10-pack open is all or nothing: if any pack fails, none open.
   - Crafting counts every copy held toward the limit, Foil and Gold included.
   - A Prototype found while its run is open always gets the next serial (01, 02 ...), not a random
     free serial.

Calls of mine you may want to overrule:
1. **The username variant only uses handle patterns,** split 2:1 between "[username]'s [Modifier]
   [Thing]" and "[username]'s [Thing]" (as in session 35).
2. **Agent names use 50 "program" nouns** (Daemon, Ghost, Copilot, Oracle, Twin ...) for "[Handle]'s
   [Program]". The persona line is unchanged.
3. **Season 0's set symbol is a name only** (`S0-boot`) until the render draws it.

Next game-lane session, without an answer: the defaults above, then **the deck-building agent**
(step 2 of the order): the best faction and deck it can build from the owner's cards, unless the
owner forces a deck or a faction. It's measured by playing its decks against the shipped decks.

---

**Updated 2026-10-15, session 35 (your 2026-10-15 answers to session 34: grow the pool, names,
combinations may repeat, play styles).** Nothing is blocking. There is one **[OWNER CHECK-IN]**
below, with defaults, so the next game-lane session can go ahead without an answer. Evidence:
`progress/balance-report-026-signature-10k.txt`, `progress/signature-names-sample-001.txt`,
`progress/economy-demo-005.txt`.

Built:
- **Combinations may repeat** (your follow-up). The database no longer refuses two agents with the
  same body + ability, and the generator no longer avoids them. Names stay unique, and a clash is
  re-rolled. In the demo, 42 agents share 13 combinations, and all 42 names are different.
- **Themed signature card names** (your names entry), built the way you suggested:
  - 5 templates with grammatical slots:
    - [Handle]'s [Modifier] [Thing] (the most common)
    - [Modifier] [Thing]
    - [Thing] of [Place]
    - [Handle]'s [Thing]
    - [Modifier] [Thing] [Edition]
  - Every word list is tagged by its slot and themed:
    - hacker handles: about 2,000, mostly compounds like "Bytewolf";
    - time-of-night, neon and retro-tech modifiers;
    - network and hardware nouns;
    - places like "the Dead Mall" or "Sector Zero".
  - The noun leans toward the ability 80% of the time. An attack card can be a "DDoS" and a
    Barrier card a "Firewall". The rest of the time it's a generic retro object ("Boombox").
  - A filter refuses a repeated word ("Static Static Burst"), a name over 30 characters, or a
    blocked word.
  - About 15 million names per menu option. Nothing calls an outside service.
- **The 10,000-game re-measure** (question 1, option A). The 7 near misses you named, and the 16
  lines already approved, all against a 10,000-game reference.
- **5 new sizes for the tuner:** Smite "2 damage to a unit with 3 or less health", and Smite (1 or
  2 damage) and Sweep (each unit, or 2 random) "only if you have 15 or less health". Each was
  measured at every cost-5 body.

**Some sample names** (more, by option, in `progress/signature-names-sample-001.txt`):

| ability | names |
|---|---|
| Guardian (Barrier) | Dialmonk's Holographic Proxy · Phreakhawk's Midnight Bunker · Firewall of the Grid |
| Tax | Quartzking's Late Fee · Bitraven's Rooftop Bouncer · Turnstile of the Night Train |
| Rally / Inspire | Laserkid's Phosphor Rave · Rasterwolf's Cheat Code · Modemfox's Hidden Anthem |
| Recycle / Supply line | Rogue Warez Drop · Archive of the Night Market · Phreakjack's Hyper Uplink |
| Restore | Holomancer's Back-Alley Reboot · Save State of the Underpass · White-Noise Duct Tape |
| your username (rare) | Zion's Cold-Boot Drumline · Kestrel's Ultra Short Circuit · Neon_Fan99's Quantum Sandbox |

**The 10,000-game results (limit 2.0):**

| line | at 2,500 | at 10,000 | |
|---|---|---|---|
| Guardian (Barrier) 3/5 | 2.08 | **1.87** | **joins**: Guardian is on the generator |
| Guardian 3/4 / 3/6 | 2.12 / 2.32 | 2.02 / 2.79 | still fails |
| Sweep, 2 random, 2/9 / 2/8 | 2.04 / 2.20 | 2.36 / 2.50 | still fails |
| Smite 1, 2/9 / 2/8 | 2.40 / 2.60 | 2.63 / 2.80 | still fails |
| Energy surge "+2 energy" 2/9 / 2/8 | 1.88 / 1.84 | **2.20 / 2.22** | **leaves** |
| Restore (one random unit) 3/4 | 1.76 | **2.08** | **leaves** |
| the other 13 approved lines | 0.76-1.88 | 0.68-1.87 | all stay |

- **The pool is 14 lines over 7 options:** Recycle, Supply line, Rally, Restore, Tax, Inspire, and
  now Guardian. Energy surge is out.
- **Why approved lines left:** at 2,500 games, an edge's 95% interval is about ±1 point, so a 1.8
  can really be a 2.2. Re-measuring only the near misses would have let noise through in one
  direction only. A line's largest measurement now decides, either way.
- **Smite and Sweep miss on one edge, not on strength.** Their net change is about 0. What breaks
  them is Null against Swarm (+2.4 to +2.8) and Cortex against Swarm (-1.7 to -2.7): pings kill
  Swarm's small units.
- **None of the new sizes come close:** 4.0 at best at 1,000 games (Smite "1 damage, only when
  behind" at 2/9). The 2 best of each, re-measured at 10,000, still fail (3.5 to 4.6).
  - "Small units only" makes the Swarm problem worse (5.4 at best).
  - "Only when behind" mostly turns the ability off, which leaves a 2/x body (too weak) or a
    3/x body (too strong).
  - So these two options need a different idea, not a smaller number. I've stopped spending games
    on them for now.

### [OWNER CHECK-IN] Username odds, the art pool, and where the deck builder and play styles go

**1. The username in a card's name.** Proposal: **1 candidate in 30**, so about one draft in ten
shows one.
- The username is used as typed, with the first letter capitalised ("zion" becomes "Zion's ...").
- It's skipped when it's longer than 16 characters, is all digits, or trips the filter.
- An owner without a login (the house owners) never gets one.
- Options: **A** 1 in 30 (my default). **B** 1 in 10 (about one draft in four). **C** 1 in 100
  (a real rarity, about one draft in 33).

**2. The art pool of 500 (not built yet).** My plan, for you to correct:
- At creation, each signature card records which of the 500 pool pieces it uses (drawn at random,
  so two cards can share art, as you accepted). The card points at the pool slot from day one.
  The images arrive in the late, owner-funded art pass.
- A season refresh just points new cards at a new pool; old cards keep their art.
- The ward stays code-drawn.
- I'd build the slot (one schema column and the draw) with the next economy change, not as a
  session on its own.

**3. Where the deck builder and play styles go in the build order.** Proposal:
1. **Pack contents and opening** (roadmap item 5). It's needed first anyway: step 3's endpoints
   need it, and a deck builder only matters once collections differ.
2. **The deck-building agent.** It picks the best faction and deck it can build from what the
   owner holds, unless the owner forces a deck or a faction (your decision). It's measured by
   playing its decks against the shipped decks.
3. **Play styles.** About 6 presets of the same Lookahead brain, tuned to play visibly differently,
   with a fairness ring between them (each style against each other style, same seeds, the same
   2-point rule as signature cards). The owner's setting applies from the next match. A draft set,
   to be measured, not final:
   - **Rusher** (goes face, plays cheap);
   - **Controller** (trades, holds answers);
   - **Tempo** (on-curve trades, punishes over-extension);
   - **Fortress** (Guard and Barrier first, attacks only when safe);
   - **Gambler** (takes swingy lines);
   - **Calculator** (today's balanced default).
4. **Then step 3**, the website endpoints, which can then expose both settings (forced deck or
   faction, and the play style) from the start, instead of adding them later.
- The persona's effect on commentary belongs with the commentators (build-order stage 7), which
  don't exist yet.

**4. Agent names (a question, not a change).** You asked for themed card names. Agent names are
still the session-34 style ("Ilsa Delta", "Talis Echo"), which reads more fantasy than cyberpunk.
Should they get the same treatment? My default: leave them until you say.

Calls of mine you may want to overrule:
1. **A line's largest measurement decides,** so Energy surge and Restore 3/4 left the pool. (The
   alternative is to keep anything that ever passed at 2,500, which gives 17 lines.)
2. **The noun leans toward the ability 80% of the time;** 20% are generic objects ("Deluxe
   Ghost"). Names are capped at 30 characters.
3. **The handle is a generated hacker handle,** not the agent's own name ("Ilsa Delta's ..." would
   run too long).
4. **I didn't build the art pool this session** (point 2), to keep the slice to what was decided.

Next game-lane session, without an answer: the defaults above. That means pack contents and opening
(roadmap item 5), then the deck-building agent.

---

**Updated 2026-10-14, session 34 (your 2026-10-15 answer: option A).** Nothing is blocking. Step 2
of your build order is built: an owner can generate a new agent and get its signature card. There
is one **[OWNER CHECK-IN]** below, with defaults, so the next game-lane session can go ahead
without an answer. Evidence: `progress/balance-report-025-signature-finer-pass.txt`,
`progress/economy-demo-004.txt`, `progress/sample-match-032-bulwark-units.txt`.

Built:
- **Guardian is Barrier only**, and **Bulwark takes the first attack aimed at one of your units
  (never you)**. Guard still takes priority over Bulwark. The sample match shows a real game: three
  attacks on the Aegis player go through an armed Bulwark, and Bulwark then pulls an attack off
  Aegis Sentinel onto itself.
- **The finer tuner pass.** Every size of Smite, Energy surge, Sweep, Guardian and Bulwark, at
  every cost-5 body from 2/3 to 4/9 (252 lines, 1,000 games per edge), then the 5 best of each
  option at 2,500. Guardian and Bulwark also got the full cost 5/6/7 tuner run.
- **Generating a new agent**, your Season 0 flow:
  1. 3 generated agents, each a name and a one-line persona.
  2. Pick one, and get 3 signature cards for it: only lines that passed the fairness test, with 3
     different abilities.
  3. Confirm. The agent, its card and the card's copy are made together. The card is the agent's
     bound promo (PR-001, PR-002, ...).
  - Nothing calls an outside service; names and flavour come from word lists.
  - The card plays from the signature zone of whichever agent is connected, so switching agents
    changes only that card.
  - It can never go in a deck, be salvaged, sold or moved; the database refuses that too.
  - A new agent brings nothing else.

**Results (2,500 games per edge; limit 2.0):**

| option | best line | worst edge | |
|---|---|---|---|
| Energy surge | "gain **2** energy", **2/8** or **2/9** | **1.8 / 1.9** | **passes** |
| Sweep | 1 damage to 2 random enemy units, 2/9 | 2.04 | misses by 0.04 |
| Guardian (Barrier) | 3/5 or 3/4 | 2.08 | misses by 0.08 |
| Smite | 1 damage, 2/9 | 2.40 | misses by 0.40 |
| Bulwark (units only) | 3/4 | 3.88 | fails |

- Attack is the main lever: one attack point moves a line's worst edge by 4-6 points, one health
  point by about 1.
- Guardian at 3/6 is 2.3, and only Aegis gains (2 points or so).
- Bulwark fails at every cost. At cost 7 (5/5 with Shield wall) the net is even, but Aegis loses up
  to 4 and Cortex and Swarm gain 2. So it stays off the generator, as you said.

The generator can now draw from **16 lines over 7 options**: Recycle, Supply line, Rally, Restore,
Tax, Inspire, and now Energy surge.

### [ANSWERED 2026-10-15: option A, combinations may repeat, names themed] The season's signature pool, then how an agent plays its owner's collection

**1. The pool caps how many agents a season can have.** No two agents in a season may share a
body + ability combination. With 16 passing lines, at most 14 agents can be generated in a season:
a draft needs 3 free lines to show. Season 0 alone needs 8 house agents. Options:
- **A (my recommendation).** Keep the rule, and grow the pool:
  - measure the near misses (within 0.5 of the limit: Sweep, Guardian, Smite) at 10,000 games per
    edge instead of 2,500. At 2,500, each edge's 95% interval is ±0.5 to ±1.5 points (Sweep's
    are the widest), so 2.04 and 2.08 can't be told apart from 2.0. At 10,000 it halves. This needs the reference ring measured once at
    10,000 too (about 3 minutes). A line passes or fails on the more precise number;
  - add new sizes for the next tuner pass, for example Smite "1 damage to a unit with 3 or less
    health".
- **B.** Let a combination repeat once the pool runs low, with a different name and art.
- **C.** Count only the stat line + ability as the combination, not the size (so "Recycle, draw 1"
  and "Recycle, draw 2" at 3/6 are the same). This shrinks the pool from 16 to 14 combinations
  (12 agents), so I don't recommend it. Today the size counts.

**2. How an agent plays its owner's collection (the question you asked to have raised after step
2).** Today an agent plays the owner's active deck, chosen by hand; the deck must fit the faction
lock. What's open:
- **How an agent picks its faction.** Default: the owner's faction lock, or, if none is set, the
  faction of the owner's active deck.
- **How it builds its deck from the collection.** Default: it doesn't yet. The owner saves decks,
  and the agent plays the active one. A deck builder agent (it picks 40 cards from what the owner
  holds) comes once pack opening exists.
- **How it chases quests.** Default: it doesn't. Quests come with the daily rewards (roadmap item
  7), and the agent plays as it always does.
- **Whether the persona changes how it plays.** Today every generated agent plays with the same
  Lookahead brain; the persona is only text. Default: keep it that way until there's a second
  playing style worth offering.

Calls of mine you may want to overrule:
1. **The 3 signature candidates differ in ability** whenever 3 abilities have free lines, so an
   owner never sees three sizes of one card.
2. **Energy surge passes only as "gain 2 energy" on a 2/8 or 2/9 body.** That's off the table and
   a low-attack body for a Mythic (attack 2 is your floor).
3. **A new agent is not connected automatically.** The owner connects it, as with any agent.
4. **One open draft per owner.** Starting a new draft replaces the old one. That also means an owner
   can re-roll the 3 agents as often as they like, but every candidate is fair, so nothing is
   gained by it.
5. **The signature card's id is `sig-PR-001` and its promo number is shared with all promos.** The
   numbering counts any PR- code already given out, so a number is never handed out twice.
6. **A signature card never shares a name with a set card**, as well as with other signature cards.

Next game-lane session, without an answer: option A for question 1 (the 10,000-game reference and
the near misses first), and the defaults for question 2. Then build-order
step 3: the server endpoints for the website.

---

**Updated 2026-10-14, session 33 (your 2026-10-13 answers: option A, Guard over Bulwark, the
signature card can't be sold).** Nothing is blocking. There is one **[OWNER CHECK-IN]** below, with
defaults, so the next game-lane session can go ahead without an answer. Evidence:
`progress/balance-report-024-signature-levers.txt`, `progress/sample-match-031-bulwark-guard.txt`.

Built:
- **The size lever.** Every menu option except Guardian and Bulwark now has smaller and/or larger
  sizes: the same mechanic with a number turned down or up (Smite 1, 2, 3 or 4 damage), a narrower
  target (Restore on one random unit), or an "only while" condition (Commander's aura only while you
  control 3 or more units). Your wording stays the standard size.
- **The cost lever.** The tuner tries each size at cost 5, at cost 6 with each keyword, and at cost
  7 with each second aura. Attack stays at 2 or more everywhere.
- **Guard takes priority over Bulwark** (your call 3). Bulwark stands aside while a Guard unit
  protects its side, and keeps its redirect for later in the turn. The sample match shows it: the
  first attack is forced onto Barrier Drone, Bulwark doesn't step in, and once the Drone is dead
  Bulwark takes the next attack.
- **The signature card can't be sold.** The economy schema now refuses an unbound signature copy
  even through raw SQL. The generator will grant it.

### [OWNER CHECK-IN] 6 of 16 options now pass; Guardian and Bulwark need your rework call

| option | passing line (2,500 games per edge) | worst edge |
|---|---|---|
| Recycle | 3/6, "when it dies, draw **a** card" | **0.8** |
| Supply line | 3/6, "draw a card **if you have 2 or fewer in hand**" | **0.8** |
| Rally | 3/6, "your units get **+0/+1** this turn" | **1.3** |
| Restore | 3/6, "restore 1 health to **a random unit** of yours" | **1.6** |
| Tax | 3/6, as written | **1.6** |
| Inspire | **3/4** (off the table), "a random ally gets **+0/+1**" | **1.6** |

Close, but not passing:
- Smite at 1 damage (2/9): 2.4.
- Energy surge as written (3/6): 2.4.
- Sweep on 2 random units (2/7): 2.6.

Each misses on one edge.

Failing at every size and cost:
- Commander's aura: 4.8.
- Hunter: 5.2. It's too strong even at its smallest size.
- Shield wall: 3.2.
- Suppress: 3.9.
- Dampen: 3.8.

For all but Hunter, the factions split: Aegis drops 1.6-3.6 points on one edge while another
faction gains 3-5.

The cost lever helps less than I hoped:
- Cost 6 still plays above the reference.
- Cost 7 only gets near it with bodies like 3/2 and 3/4, which don't read as Mythics.

**Guardian and Bulwark** fail by the most (5.8 each, even at cost 7). I measured rework proposals
(report section 4):

| proposal | best line | worst edge |
|---|---|---|
| Guardian -> **Barrier only** | 3/4 | **2.1** (misses by 0.1) |
| Guardian -> Guard only | 3/3 | 8.1 |
| Bulwark -> takes the first attack aimed at **one of your units** (never you) | 3/4 | 3.9 |
| Bulwark -> takes the first attack aimed at **you** | 3/3 | 6.0 |
| Bulwark -> once per turn, pay 1 energy: redirect an attack to it | 2/6 | 4.4 |

Guard is what breaks Guardian, not Barrier. Every version of Bulwark that pulls attacks fails too.

**Options:**
- **A (my recommendation).**
  - Guardian becomes **Barrier only**, tuned once more. 3/4 already misses by 0.1.
  - Bulwark becomes **"the first attack aimed at one of your units"**, and stays off the generator
    until it passes.
  - The next tuner pass also takes the three near misses at finer resolution.
  - The generator can use the 6 passing options now. That's already enough to offer an owner 3
    different candidates.
- **B.** Drop Bulwark from the menu. Defence keeps Shield wall, Guardian (as Barrier) and Restore.
- **C.** Keep both as written and accept that they never pass, so the generator never offers them.

Calls of mine you may want to overrule:
1. **"Only while" conditions count as a size**, for example Commander's aura only while you control
   3+ units, or Dampen only while you have 15 or less health. The mechanic is the same, so I
   treated it as the ability turned down, not a rework. No passing line uses one yet.
2. **Inspire passes only off the table (3/4 or 3/5).** At 3/6 it is 2.6. Your "adjust its stats
   and test again" allows this, but it means the card isn't one of the three table bodies.
3. **A Bulwark with Guard of its own** (the cost-6 keyword) never redirects. With a Guard up,
   every attack is already forced onto a Guard, itself included.
4. **A once-per-turn activated ability is no longer offered after it's been used that turn.**
   This is an engine-wide fix: before it, an agent could pay for a use that did nothing. No
   shipped card has such an ability yet.

Next game-lane session: your answer here. Without one, option A:
- a finer tuner pass on Barrier-only Guardian and the three near misses;
- then `generateAgent`: three agents, then three signature candidates, all from passing lines;
- then the bound promo grant.

---

**Updated 2026-10-12, session 32 (your 2026-10-11 answer, option A: the Neutral menu and its
fairness test).** Nothing is blocking, but there is one **[OWNER CHECK-IN]** below: as written, the
fairness test passes only 2 of the 16 options. Evidence:
`progress/balance-report-023-signature-menu.txt`, `progress/sample-match-030-signature-menu.txt`.

Built:
- **The Neutral menu as card data.** All 16 options, the three cost tiers, the 6-cost keyword
  and the 7-cost second aura: 303 legal combinations, each buildable as a Neutral Mythic Unit.
  Four options needed a small engine addition, all usable by any card: Hunter ("whenever it
  destroys a unit"), Bulwark ("the first attack each turn", a once-per-turn limit), Commander's
  aura ("your *other* units") and Tax ("enemy *Commands*"). The sample match shows Hunter growing
  after a kill and Bulwark pulling two attacks onto itself in a real game.
- **The fairness test, exactly as you set it.** All four factions get the same plain 5-cost 3/6
  signature card; a candidate replaces one faction's card; it passes when each of that faction's
  three edges moves 2 points or less, in all four factions (12 edges, 2,500 games each).
- **A stat tuner**, for your "if it fails, adjust its stats and test again".

### [OWNER CHECK-IN] Only Recycle and Tax pass; stats alone can't fix the rest

What I measured (cost 5, report sections 2 and 3):

| option | on the table (3/6) worst edge | best line the tuner found | its worst edge |
|---|---|---|---|
| Recycle | **1.2 PASS** | 3/5 | **1.5 PASS** |
| Tax | **1.6 PASS** | 3/6 | **1.6 PASS** |
| Energy surge | 3.6 | 3/6 | 2.4 |
| Inspire | 10.4 | 1/7 | 2.3 |
| Restore | 3.9 | 3/4 | 2.7 |
| Supply line | 4.6 | 3/4 | 3.7 |
| Commander's aura | 17.2 | 1/3 | 4.6 |
| Shield wall | 8.7 | 2/6 | 4.9 |
| Dampen | 25.6 | 1/2 | 5.6 |
| Smite | 13.9 | 1/6 | 6.1 |
| Suppress | 11.1 | 2/6 | 6.1 |
| Sweep | 12.9 | 1/8 | 6.7 |
| Rally | 10.1 | 2/6 | 6.8 |
| Hunter | 15.9 | 2/5 | 7.7 |
| Guardian | 44.0 | 1/3 | 8.0 |
| Bulwark | 22.9 | 1/5 | 9.2 |

(3/6 numbers are 900 games per edge, apart from Recycle and Restore, re-measured at 2,500. The
tuner's lines are all at 2,500.)

Why it fails:
1. **Attack is the only stat that matters, and it's too coarse.** One attack point moves a
   candidate about 5 points. One health point moves it a few tenths, because a signature card
   rarely dies. So a strong ability has to be paid for with attack, in steps bigger than your
   2-point limit. That's why the tuner lands on 1/6 Smite and 1/3 Commander's aura, which don't
   read as Mythics.
2. **Even when the average is right, the factions split.** Paying for an ability with attack
   costs Aegis the most, because Aegis gains most from a plain body. Smite at 1/6 is net 0.0 but
   leaves Aegis about 3-4 points down and Null 6 up.
3. **Guardian (Guard + Barrier) and Bulwark are far stronger than anything else.** The opponent
   has to attack into a tough wall. Guardian at 3/6 wins 197 of 200 games for Cortex against
   Swarm from the first seat, against 155 of 200 for the plain card.
4. **The 6-cost tier plays far above the plain 5-cost reference** (up to +32 points net in the
   first sample). **The 7-cost tier is close to it** (-1 to +8), because a 7-cost card comes down
   late.

Loosening the limit barely helps: "each faction's average within 2, no edge beyond 4" passes one
more option (Energy surge).

**Options:**
- **A (my recommendation).** Keep your 2-point rule. Give the tuner finer levers than stats, and
  keep attack at 2 or more so the cards still read as Mythics:
  - the ability's own size (Smite 3 -> 2 damage, Rally +1/+0, Commander's aura on Units only);
  - the cost (a strong option moves up a tier: Smite at 6 is a 3/6 that arrives a turn later).

  Options that still can't pass get a rework proposal at the next check-in. Guardian and Bulwark
  are the likely ones: they could become one keyword each (Guard or Barrier, not both), and
  Bulwark could take the first attack aimed at a unit, not at the player.
- **B.** Judge each faction on its average change (2 points), not every edge. More stat lines pass,
  but each one hides a real 3-6 point skew between factions.
- **C.** Make the reference stronger (for example a 3/6 with a small built-in ability), so the
  menu's abilities are judged against a card that already does something. This changes the
  baseline every candidate is held to, so it needs your say.

**The Aegis question you left open** (Aegis gains most from an extra body: Aegis > Cortex 52 -> 60
with the plain stand-in). These results point the same way from the other side: when a
candidate trades attack for an ability, Aegis loses the most. I'd leave it until the menu passes,
then re-measure the ring with the cards agents actually carry.

Calls of mine you may want to overrule:
1. **"Moves by 2 points or less" means the measured change on the same 2,500 games**, candidate
   against reference. Each game is identical until the signature card changes something, so
   noise is small: the 95% interval is about ±0.3 to ±1.7 points at 2,500 games, tightest for
   cards close to the plain one. I don't require the whole interval to sit inside ±2. Even Tax
   (1.6 ± 0.7) would fail that, and it would take several times more games per edge.
2. **Hunter's "destroys a unit"** counts a kill by combat or by its own effect, and only if Hunter
   survives the exchange.
3. **Bulwark** takes the first enemy attack each turn, even one already aimed at itself. It
   steps in front of Guard units too, since it isn't one itself.
4. **Tax** adds 1 to enemy Commands only, never to a signature card's +2 replay surcharge.
5. **Inspire's "random ally"** can pick the signature card itself.

Next game-lane session: your answer here. Without one, A: give the tuner ability-size and cost
levers, then the signature card as the agent's bound promo.

---

**Updated 2026-10-10, session 31 (your 2026-10-10 answers; step 2 continues: the signature
zone).** Nothing is blocking, but there is one **[OWNER CHECK-IN]** below that shapes the next
session. Evidence: `progress/balance-report-022-signature-zone.txt`,
`progress/sample-match-029-signature-zone.txt`.

Built:
- **Promo and prize copies can be sold again** (your answer 1). Schema migration 4 unbinds the
  ones session 30 bound, new ones arrive unbound, and salvage still refuses them. The card viewer
  says "Promo copies can be kept or sold, never salvaged". Crafted and starter copies stay bound.
- **The signature zone, in the engine.** A signature card starts in its own zone, takes no deck
  slot, and is never drawn or shuffled. It can be played on your own turn when affordable. When
  it dies it goes back to the zone, and each replay costs 2 more. It can't be evolved, and it is
  public to both sides. All three agents use it. The sample match shows Hive Mother played for 5,
  killed, back in the zone, and replayed for 7.

### [ANSWERED 2026-10-11: option A] The ring re-baseline moved far more than expected, so I didn't make it the gate

You asked for the ring check to be re-baselined once, with each faction's set Mythic standing in
as its signature card. I measured it on the same seeds as the gate:

| edge (band) | Mythic in deck (gate today) | Mythic as signature card |
|---|---|---|
| Null > Aegis (55-60) | 48.2% | 29.4% |
| Aegis > Cortex (55-60) | 52.2% | 75.9% |
| Cortex > Swarm (55-60) | 57.4% IN | 43.0% |
| Swarm > Null (55-60) | 56.2% | 66.1% |
| Null ~ Cortex (45-55) | 49.2% IN | 44.7% |
| Aegis ~ Swarm (45-55) | 51.2% IN | 58.6% |

Why: in the deck, each Mythic is played in about 26% of games (Null's in 13%). In the zone,
Quorum Arbiter, Hive Mother and Prime Aegis are played in 92-97% of games, but Null Singularity
(cost 7) only in 29%, because games end first. Replays are rare (about 5% of games at most), so this is
almost all from guaranteed access. The set Mythics were balanced as 1-in-4 draws, not as cards
you always have.

Writing those numbers in as the gate would accept 4 newly broken edges as "OUT", and the gate
would only catch further drift. No real match gives a player a signature card yet, so **the gate
still measures the decks as they play today** (unchanged baseline, still passing). The
signature-mode numbers are recorded as a second baseline (`ringBaselineSignature.json`), and CI
runs both.

It also affects the **fairness test** for the Neutral menu ("swap the candidate in for each
faction's set Mythic; the ring may move 2 points at most"). The set Mythics are so far apart in
the zone (Prime Aegis is worth about +24 points to Aegis; Null Singularity much less) that one
candidate can't land within 2 points of all four. Every candidate would fail.

A closer stand-in: give **both** sides the same plain Neutral 5-cost 3/6 signature card and leave
each set Mythic in its deck. That moves the ring by up to 8 points (Aegis gains most: Aegis > Cortex
52 -> 60, Aegis ~ Swarm 51 -> 58). Real agents will each carry an equal-budget Neutral signature
card, so this is nearer to real play. Report section 3.

**Options:**
- **A (my recommendation).** The gate stays as it is until real matches carry signature cards.
  The fairness test uses the "same plain signature card on both sides" ring as its reference: a
  candidate passes when swapping it in for one faction's plain stand-in moves that faction's
  edges by 2 points or less. Then the next session builds the Neutral menu against that.
- **B.** Re-baseline the gate as you first said (set Mythics as signature cards), accepting the
  4 broken edges, and keep the fairness test as written.
- **C.** Rebalance first: tune the four set Mythics until the "Mythic as signature card" ring sits
  near today's numbers, then re-baseline. This is a balance project of its own (Null Singularity
  at 7 and Prime Aegis are the two outliers).

Also: should Aegis's gain from **any** extra 5-cost body be dealt with now, or once real
signature cards exist? It's real at 95%, and it's the same direction the ring already leans.

Calls of mine you may want to overrule:
1. **A signature card must be a plain Unit** (not a Command, Directive, Tool or evolution). Your
   tier table only gives stats, so I read it as a Unit.
2. **Cost modifiers apply to it** like any card. The +2 per replay comes on top.
3. **Its Tools go to the graveyard** when it dies; only the card goes back to the zone.
4. **Any onDeath ability on it still fires** when it dies, before it goes back.

Next game-lane session: whichever option you pick. Without an answer, A: the Neutral menu as card
data and the fairness test against the "same plain signature card" reference.

---

**Updated 2026-10-08, session 30 (your 2026-10-07 economy entries, and step 2 part 1).** Nothing
is blocking. Evidence: `progress/economy-demo-003.txt`.

Built:
- **Salvage is manual.** You pick a card and a quantity. The card viewer data says why any copy
  can't be salvaged. A salvage that would leave saved decks short warns first with the list. If
  you confirm, the decks show as incomplete; they are never edited.
- **Decks count cards, not copies.** Copies are shared across saved decks, and the 3/3/2/1 limit
  stays.
- **Season 0 sign-in**, by username or email with a password.
- **One connected agent per owner**, with no switching during a live match.
- **The faction lock** and **the house-owner admin data.**

Calls of mine you may want to overrule:
1. **Promo and prize copies are now account-bound**, following your 2026-10-07 wording ("Crafted,
   starter, promo and prize copies are account-bound"). One consequence: tournament prizes and
   promos could never be sold on a future marketplace either. If you meant "can't be salvaged"
   only, say so and I'll unbind them.
2. **An owner is in at most one live match at a time.** The connected agent plays one match,
   then the next. Auto-play queues matches back to back, so this costs nothing there.
3. **An incomplete deck fixes itself.** It is incomplete exactly while you hold too few copies.
   Pull or craft the missing copies and it's complete again; editing the deck works too. There is
   no separate flag to clear.
4. **Sign-in settings** (all in `economy/src/config.ts`):
   - a password needs at least 10 characters;
   - a session lasts 30 days;
   - 10 wrong passwords in 15 minutes lock that account for 15 minutes.
   There is **no password reset yet**: Season 0 has no mail service. The next fix is an
   admin-only reset. Say if you want something else.

Next game-lane session: the rest of step 2, generating a new agent. It starts in the engine with
the signature zone and a one-time ring re-baseline, then the Neutral menu, the fairness test, and
the 3-then-3 pick. After step 2 I'll raise your open question as an [OWNER CHECK-IN]: how an
agent picks its faction, builds from your collection and chases quests.

---

**Updated 2026-10-06, session 29 (build-order step 1: the economy moves to the owner).** Nothing
is blocking. Step 1 of your 2026-10-05 build order is done. Evidence:
`progress/economy-demo-002.txt`. Two calls of mine you may want to overrule:

1. **(Superseded by your 2026-10-07 manual-salvage entry, built in session 30.) Salvage never takes a copy that sits in a saved deck.** This stops salvage from silently
   breaking a deck. The side effect is that an owner who saves several decks can keep more than
   the playable limit, as long as each extra copy is in some deck. The alternative is to salvage
   anyway and drop the copy from those decks. Say which you prefer.
2. **Old session-28 data becomes house owners.** A v1 database migrates in place, with each old
   agent becoming a house owner that has that agent connected. Only demo and test data exists in
   v1, so this changes nothing real.

Next game-lane session: step 2 (Season 0 sign-in, one connected agent, switching, generating a
new agent with its signature card, the house-agent admin data). After step 2 I'll raise your
open question as an [OWNER CHECK-IN]: how an agent picks its faction, builds from your
collection and chases quests.

---

**Updated 2026-10-04, session 28 (persistence + economy spec).** Nothing is blocking. Your
economy answers and all three amendments are written into the new **`ECONOMY.md`**. Each part is
marked BUILT, SPEC (with its session) or OPEN. Evidence: `progress/economy-demo-001.txt`.

1. **Still open (your call): the unique Mythic promo's effect menu and power budgets.** It's the
   only [OWNER CHECK-IN] left, and it's needed by session 30.
2. **Four provisional numbers of mine. Overrule any of them:**
   - **A loss pays 2 credits.** You said "a loss pays a little" but gave no number. 2 stays
     below the smallest paying win (5), so a win always pays more.
   - **Losses stop paying after 10 a day,** and also once the agent's next win would pay 0 (after
     10 wins). Otherwise an 11th win (0) would be worth less than a loss.
   - **A draw pays as a loss to both sides.**
   - **An abandoned match pays nothing to either side,** including the agent that stayed. Paying
     them would let two colluding agents farm forfeit wins. If you'd rather the agent that stayed
     gets the loss amount (2), it's a one-line change.
3. **Storage is one SQLite file per season** (Node's built-in `node:sqlite`, no service, no
   addon). Season 1 starts a new file, and the Season 0 file is its archive. Node still labels the
   module "experimental" and prints a warning, but it works without a flag on Node 22.13+.
4. **Starter decks:** the plan for session 29 is to use the four shipped decks, the ones the ring
   check already measures, as the fixed starter lists. The demo already does this. Say if you
   want different lists.

---

**Updated 2026-10-04, session 27 (Phase 5 closed).** Nothing is blocking and nothing new needs
an answer. Your 2026-10-04 section A is applied in full. Checkpoint: top of
`progress/checkpoints.md`. Numbers: `progress/balance-report-021-phase5-close.txt`.

- **Propagating Exploit 2/3 is live.** Null ~ Cortex moved into band (49.2), and Null > Aegis rose
  from 42.0 to 48.2 but stays OUT (accepted). The ring now reads 3 IN, 1 UNRESOLVED, 2 OUT, and
  that's the recorded baseline.
- **CI now runs the ring regression check on every PR** (`npm run ring -w @ai-tcg/engine`, about
  15 s). If a future set fails it, the PR goes red and auto-merge won't merge it. The rule is in
  the checkpoint, in case you want it stricter.
- **Event-log instance ids are done**, so the render lane can aim spells at their exact target.
- **Coming up in session 28**, built to your section C: persistence and the economy spec. It will
  pause at your [OWNER CHECK-IN] items. If you already know the finish list and pull rates, the
  quest list, or the starter shape, writing them in owner-feedback.md now saves a round trip.

Items 2 and 3 below (Quorum Arbiter, the Null lift) were answered on 2026-10-04 and are applied.

---

**Updated 2026-10-03, session 26 (the Phase 5 gate).** Nothing is blocking, but the gate did
not pass and two calls are yours. Full numbers: `progress/balance-report-020-phase5-gate.txt`.
Checkpoint: top of `progress/checkpoints.md`.

1. **Gate result: 2 IN, 1 UNRESOLVED, 3 OUT** (Lookahead; 2,500 seeds on the win/lose bands, 900
   on the even bands).
   - IN: Cortex > Swarm 57.4, Aegis ~ Swarm 51.2.
   - UNRESOLVED: Swarm > Null 59.4 (CI 57.5-61.3, sitting on the top edge).
   - OUT: Null > Aegis 42.0 (target 55-60), Null ~ Cortex 40.7 Null (target 45-55),
     Aegis > Cortex 52.2 (target 55-60).
   Null is behind three of the four. Aegis-over-Cortex is the only one that isn't about Null.
2. **Decision: Quorum Arbiter. I did not drop it.** You pre-authorized the drop if Cortex-vs-Null
   was still out at the gate, as the ~6-point lever session 22 measured. It isn't that lever any
   more: dropping it moves the edge -2.7 [-5.4, 0.0] on the gate seeds and -1.0 [-3.7, 1.7] held
   out, and the edge stays OUT (about 59%) either way. It's Cortex's only Mythic, so I left it
   and am asking. Say "drop it anyway" and it's a one-line deck change.
3. **Decision: a targeted Null lift. Recommended: Propagating Exploit 2/2 -> 2/3.** I measured
   +1 attack and +1 health on every Null unit (`engine/src/dev/nullLiftProbe.ts`, nothing
   shipped). The catch: the ring wants Null up vs Cortex and Aegis but NOT vs Swarm (Null should
   stay 40-45 there; it's 40.6). Most lifts raise all three, so Null-vs-Swarm breaks. Stray
   Fragment 2/2, the biggest lift, reaches 51.8 vs Swarm held out. Propagating Exploit at 2/3
   is the one with the right shape. On held-out seeds:
   - vs Cortex: 39.1 -> 48.0 (into the even band)
   - vs Swarm: 40.9 -> 43.6 (stays in its 40-45 band)
   - vs Aegis: 42.8 -> 50.5 (up 7.7, still short of 55-60)
   That's a stat buff, which you've steered away from for Null before, so it's your call. It
   keeps all 20 Null mechanics and touches no other faction. No single +1 reaches Null > Aegis.
   That edge needs something Aegis-specific or your acceptance that it stays OUT.
4. **Watchdog Timer buff shipped as you approved** (hand of 1 or fewer). It draws 4x as often (23
   -> 102 per 900 games) but moves Null only +0.3, inside noise. No overshoot, so it stays.
   `progress/sample-match-027-watchdog-buff.txt` shows one of those draws in a real game.
5. **Aegis > Cortex (52.2) is short, and it isn't about Null.** It was in band after session 19
   and has drifted down since (the Cortex slice, then the agent fixes). I haven't probed it. If
   you want it fixed before Phase 5 closes, the same probe pointed at Aegis is the next step.

---

**Previous update, 2026-10-01, session 25 (your 2026-10-01 entries: claude-tools
reference, Commodity Rack, the Null card-vs-agent check).** Nothing is
blocking. Full numbers: `progress/balance-report-019-agent-check.txt`.

1. **Null is now clearly the weakest faction. This is the main thing to
   look at.** Under Lookahead (900 seeds) it's 40.0 / 38.9 / 41.4 vs Cortex
   / Swarm / Aegis. Three edges are OUT, all Null's: Null-vs-Cortex (even
   band), Aegis over Null, and Cortex over Null from Cortex's side. Most of
   the drop is the Commodity Rack nerf you asked for. Null ran 3 Racks, and
   the nerf alone cost it about 6 / 3.5 / 6 points. The decomposition is in
   report 019. Your instruction was followed in the order given: check the
   agent first, then nerf. I'm flagging the size of the side effect because
   the Phase 5 gate is next and will measure this ring.
2. **Card advantage is not an agent problem.** A LookaheadAgent with
   card-draw weight W played one with the shipped 1.5, 16,000 games per
   weight. Nothing beat 1.5, and 4.5 and 6 were measurably worse. Draw
   cards didn't improve in the probe at weight 4.5. So Rack went 3/3 ->
   3/2. It now probes at 41.3%, level with Rollback Point (42.1) and Scrap
   Recycler (41.2) instead of 4-10 points clear of every other neutral.
3. **Null card-vs-agent check (your item 4 and session 23's note 3):
   settled card by card.**
   - **Bit Rot was an agent misplay.** 222 of 240 casts hit a unit that
     never fought that turn. The agent valued a this-turn -3/-0 at 40% of
     its size wherever it landed. On the old agent, cutting a copy was worth
     +2.7 points to Null; on the fixed agent it's -0.5. Fixed: a this-turn
     buff is now worth the fight it changes. Now 184 of 235 casts answer a
     declared attack (`progress/sample-match-026-bit-rot-response.txt`).
   - **Decay Ward's host was a coin flip** (112/206 on a weaker unit).
     Fixed, but its measured cost barely moved (+1.5 -> +1.4, CI spans 0).
   - **Watchdog Timer is a weak card**, not misplayed. It drew 36 cards in
     900 games, and cutting a copy is still +1.9 (CI 0.3-3.4). **Decision for
     you:** it's one of your endorsed mechanics, so I didn't touch it. A
     candidate buff that keeps the catch-up identity: draw when the hand has
     1 card or fewer, not only when it's empty.
   - **Null Pointer is situational.** It always hits the only directive, but
     sat in hand with nothing to hit in 270 of 900 games. +1.2 to cut, CI
     spans 0. That's the cost of a dedicated answer card. No change.
4. **The agent fix changes other factions' cards too.** Reflex Spike (Swarm)
   and Hotfix (Cortex) are now held for real combats. Reflex Spike plays
   fell from 1,990 to 1,011 games out of ~2,000 drawn. Rally Cry still plays
   pre-combat (465 -> 439). Swarm got a little stronger.
5. **Packages re-searched on the fixed agent and the 3/2 Rack.** Null: no
   neutral card helps, so it's back to its own 36 cards (held-out objective
   314 -> 249). That also restores Kernel Panic's density. Aegis: -1 Salvage
   Reflex, +1 Uplink Tower (243 -> 234). Every per-edge change is inside
   noise; it shipped on the rule. Cortex keeps its package; Swarm runs none.
   **Neutral cards now in decks:** Rollback Point and Surge Protector
   (Cortex), and Uplink Tower (Aegis).
6. **claude-tools is gone from the repo** except your own words in
   `owner-feedback.md`, which I didn't edit. The comment in `edgeMeasure.ts`,
   my notes here, the quality-debt items, report 017 and the log no longer
   name it. The math and the parity fixture test are unchanged.
7. **Session order:** your entry said "next session priority: the Null
   card-vs-agent check", so this was a balance session even though the last
   merged PR (#33) was also balance. Under the alternation rule the next
   session is render, then the Phase 5 gate.

---

**Updated 2026-09-30, session 24 (Phase 5 step ii: the neutral pool).**
Nothing is blocking. Full numbers: `progress/balance-report-018-neutral-pool.txt`.

1. **Shipped: a 10-card neutral pool, plus hybrid decks** (one faction + at
   most 10 neutral copies). "Utility, not identity" is a load-time check. A
   neutral card can't be removal, Mythic, Guard/Barrier/Rush, an evolution
   or telegraph, a summon, a static/aura, or faction-conditional. A faction's
   clock and card flow must come from its own cards. **Decisions you may
   want to overrule:** the 10-copy cap, and the exact list of what counts as
   identity.
2. **Who runs what.** Each package was picked by a measured search toward
   the ring bands and shipped only if it also helped on 2,500 held-out
   seeds.
   - Cortex: -Signal Drone, -Overclock Shunt; +Rollback Point, +Surge
     Protector.
   - Null: +3 Commodity Rack, +1 Rollback Point. That's add-only, 36 -> 40,
     with nothing cut, per your 2026-09-29 item 1. The first search did cut
     Null copies, and I threw that run away.
   - Swarm and Aegis run none.
3. **A LookaheadAgent bug moved the ring more than the new cards did.** It
   valued heals at their printed amount even at full health. Cortex Engineer
   "repaired" 1,231 times in 200 games and healed something 66 times, which
   burned the energy Cortex should have held. It's fixed, and all repairs
   now heal. On the fixed agent Cortex is ~3-6 points stronger on every edge
   (vs Null: 58.9 -> 65.7 before the neutral packages). This bears directly
   on your note-3 question: the arbiter can misplay a card badly enough to
   move an edge 6 points. I haven't checked Null's removal cards for the
   same thing yet.
4. **Ring now** (Lookahead, 900 seeds). Only Aegis over Null is OUT: 52.2%
   Aegis, target 40-45, down from 60.4%. Everything else is UNRESOLVED, and
   no edge is confirmed out apart from that one. Null's mean went 40.8 ->
   44.1. Cortex vs Null is 58.1% Cortex, CI 54.9-61.3.
5. **Two things you might not like:**
   - **Commodity Rack** (a vanilla 3/3 for 3) is the neutral card that wins.
     In a probe it hits 48% vs 34-42% for every utility card. Either it's
     over-rate, or the agent prefers stats to card draw. If you want neutral
     to mean "utility", the fix is a weaker Rack (2/3 or 3/2), then a
     re-search.
   - **Kernel Panic** now shows in 7.1% of Null games (was 9.9%), because
     the deck is 40 again. Your call: +3-4 points per Null edge vs arc
     visibility.
6. **Self-containment (your 2026-09-30 entry) is done.** There is a
   hardcoded parity fixture test and no external calls. (The provenance
   line was removed in session 25, per your 2026-10-01 entry.)
7. **Next balance session is the Phase 5 gate.** It runs at 900 seeds for
   the even bands and ~2,500 for the narrow bands, per your 2026-09-29 item
   2.

---

**Updated 2026-09-28, session 23 (the Null consistency trim, 40 -> 36).**
Nothing is blocking. Full numbers: `progress/balance-report-017-null-trim.txt`.

1. **Shipped: Decay Ward 2->1, Fork Bomb 3->2, Null Shell 3->1.** All 20
   unique Null cards stay, and Kernel Panic stays at 2 copies. On 3,600 seeds
   the search never saw, Null gained about 3.5-4 points on each edge, and
   Kernel Panic now shows up in about 10% of Null's games (was ~7.5%). Null
   is still the weakest faction: 41.1 / 41.7 / 39.6% vs Cortex / Swarm / Aegis
   under Lookahead (900 seeds). The Null > Aegis edge is still inverted.
2. **Decision you may want to overrule: I didn't take the bigger lift.**
   With single-copy cards allowed to go, the search cut Bit Rot, Null Pointer
   (2->1), Decay Ward and Watchdog Timer. That lifted Null about twice as
   much on held-out seeds (+7.7 / +8.1 / +6.9), close to band on Cortex and
   Swarm. But Bit Rot and Watchdog Timer are Null's only Instant combat trick
   and only turn trigger, two of the five mechanics you endorsed in session
   21. I read "measured-weakest filler" as excluding them. If you'd rather
   have the lift, it's a one-line deck-list swap (variant B in report 017),
   plus relaxing one variety test.
3. **Related finding:** under Lookahead, Null's weakest copies are its
   removal/debuff cards: Bit Rot, Null Pointer, Watchdog Timer, then Decay
   Ward. Either those cards are weak, or LookaheadAgent plays them badly. I
   haven't separated the two yet.
4. **For the 900-seed gate: the CI rule can't confirm a 5-point band at 900
   seeds.** A 95% interval at 900 games is about +/-3.2 points, wider than
   the win/lose ring bands (55-60, 40-45). Under your "out only when the CI
   misses the band" rule, those pairings can come back OUT or UNRESOLVED,
   never IN. The 10-point even bands can still come back IN. Options: run the gate's
   Lookahead side at ~2,500 seeds per pairing (well under a minute), or
   accept UNRESOLVED as a pass for the gate. I'd do the former. The CI
   verdicts are now built into `lookaheadEdgeCheck.ts`.
5. **Cortex-vs-Null moved toward band as you predicted:** 61.1 -> 58.9 Cortex
   under Lookahead, still out (CI 55.6-62.1). Per your item 3, the Quorum
   Arbiter decision waits for the gate.
6. **Side fix:** the engine logged an Intercept Routine "redirect" onto the
   unit already being attacked (from == to). It now logs a fizzle instead.
   Game state is unchanged, so balance numbers are unaffected.

---

**Updated 2026-09-26, session 22 (Phase 5 slice 4: Cortex depth/variety
pass, 19 -> 24 unique cards).** Nothing is blocking. Three things worth a
look (full numbers: `progress/balance-report-016-phase5-cortex-slice.txt`):

1. **Cortex-vs-Swarm is fixed or nearly fixed.** Under Lookahead it went from
   44.3% to 58.7% Cortex on the standard 300-seed report (in band). Over 900
   seeds it went from 46.7% to 54.1%, just under the 55% floor.
   Aegis-vs-Cortex stayed in band.
2. **The 300-seed reports have been noisier than we treated them.** One
   standard error is about 2.9 points. Over 900 seeds, the baseline
   Null-vs-Cortex edge was already out of band (57.9% Cortex, not 55.0%).
   More importantly, Null is below 45% against every faction, including
   Aegis (37.3%), which the ring says Null should beat. Null is weaker than
   the reports showed. **Proposal:** run the mandatory end-of-Phase-5 ring
   re-measure at 900 seeds. The full three-policy report takes about 11
   seconds at 300 seeds, so 900 is roughly 35 seconds. The new `engine/src/dev/lookaheadEdgeCheck.ts` already does this
   for Lookahead.
3. **Decision you may want to overrule: I let Cortex-vs-Null drift further
   toward Cortex (57.9 -> 61.1 over 900 seeds) to fix Cortex-vs-Swarm.** I
   measured whether both could be held at once. Across 150 copy mixes and
   several card-design variants, Cortex's rate against Null moved almost
   1:1 with its rate against Swarm. No mix achieved both. My read is that
   this edge follows Null's overall weakness, and the fix you already
   sanctioned (trim Null back toward ~36 cards for consistency) is the right
   lever. If you'd rather Cortex give some of the Swarm gain back instead,
   dropping Quorum Arbiter is the single cleanest lever (about -6 against
   both Swarm and Null).
4. **Order question:** your stated order is the neutral pool next, then
   the re-measure gate. Null's consistency trim has no fixed slot. Given
   item 2, I'd do Null's trim before the neutral pool so the gate measures
   a ring where every faction has had a fair shot. Next balance session
   follows your stated order unless you say otherwise here.

---

**Updated 2026-09-26, session 21 (Phase 5 slice 3: Null depth/variety
pass, 15 -> 20 unique cards).** Nothing is blocking. Three quick steers
would help, and the full detail is in `progress/checkpoints.md`'s newest entry:

1. **Kernel Panic now shows up about half as often.** I filled Null's deck
   from 32 to 40 without trimming anything, to keep it from getting
   stronger. The side effect is that its evolution finisher appears in
   roughly half as many games. Is that fine, or should a later slice trim
   back toward ~36 so the arc stays visible to viewers?
2. **Watchdog Timer draws only when Null's hand is empty.** My first
   version drew when Null had fewer than 2 units, but it never fired
   once in real play. The empty-hand version is the one that ships.
3. **Null is still the weakest faction under Lookahead, at 42% on
   average.** Its intended edge over Aegis sits at 45%, below the
   55-60% target. You asked for no power buff, so I left it. Expect the
   end-of-Phase-5 re-measure to flag it.

---

**Updated 2026-09-26, session 20 (Phase 5 slice 2 — Swarm grown 16 -> 20
unique cards, general power-level pass).** Full detail in
`progress/checkpoints.md`'s new entry, short version here:

1. **Cortex-vs-Swarm — the project's last standing triple-flagged pairing
   — is resolved, but overshot.** It's no longer triple-flagged in any
   direction, but it moved past even into mild Swarm-favour (Lookahead
   55.7% Swarm) instead of landing on the ring's actual target (Cortex
   should win 55-60%). Per your own 2026-09-23 instruction for this exact
   pairing, I didn't touch it specifically this session — a broad Swarm
   buff was exactly the "wider pool" action you predicted would settle it,
   and it did settle, just slightly past the mark. Say if you want a
   future slice to pull it back toward Cortex, or if "no longer
   triple-flagged, close enough" is fine for now.
2. **Same honest pattern as session 19: I designed a first cut, caught it
   overtuned myself, and shipped a corrected version — not the first
   design.** This time the mistake was benchmarking Swarm's new cards
   directly against Aegis's OWN new cards from last session (Aegis Line
   Trooper, Bulwark Chassis, Reinforced Bastion), without checking that
   those cards were themselves among Aegis's stronger performers (58-63%
   win rate in their own pool), not a neutral stat-line baseline. The
   first cut spiked Swarm's entire deck's win rates uniformly — worth
   knowing as a real methodology lesson for future Phase 5 slices, not
   just this session's mistake: copying a precedent card's exact numbers
   only works if the precedent card itself measured as average, not
   strong.
3. **Swarm-vs-Null didn't resolve — it changed shape.** Before this
   session, Random/Aggressive/Lookahead roughly agreed Null won too often.
   Now Aggressive and Lookahead favour Swarm instead, while Random still
   favours Null. I read this as real progress under this project's own
   standing rule (Lookahead is the trusted arbiter since the 2026-09-25
   "accept the ring" entry, and Lookahead now favours Swarm, which is the
   ring's actual intent) — but I want you to see the raw split rather
   than have me quietly decide it's fine, since Random disagreeing this
   starkly is a bigger gap than most of this project's other
   single-policy holdouts.
4. **Which faction should get the next Phase 5 slice?** I'd pick Null over
   Cortex — Cortex hasn't been named a problem since the ring correction,
   while Null still has the open Swarm-vs-Null question above that a
   Null-side slice could help settle alongside its own growth toward
   30-40 cards. Say if you'd rather see Cortex next, or want me to
   address item 1 (Cortex-vs-Swarm's overshoot) before growing either
   pool further.

---

**Updated 2026-09-25, session 19 (Phase 5 slice 1 — Aegis grown 18 -> 22
unique cards, aimed at the Aegis-vs-Cortex pairing).** Full detail in
`progress/checkpoints.md`'s new entry, short version here:

1. **Aegis-vs-Cortex is no longer triple-flagged** — the project's actual
   pass/fail bar — for the first time across three sessions that tried (11,
   18, 19). Random and Lookahead both land in the 55-60% target band;
   Aggressive is a bit out of band (47.0%, Cortex-favoured) but not extreme.
   If you want Aggressive in band too, not just the triple-check clear, say
   so; otherwise this is treated as done, matching how session 18's
   Aegis-vs-Null result was treated.
2. **A judgment call worth your eyes: the first design attempt was
   overtuned and I caught it myself, not you.** I originally shipped Bulwark
   Chassis as a 1/5 and Reinforced Bastion as a 2/6 Guard (both, on
   reflection, printed above the pool's existing curve — Reinforced Bastion
   in particular was strictly better than Cortex's own Firewall Sentinel at
   the same cost). Re-measuring before committing showed it made Aegis
   generically too strong, not specifically better against Cortex — it also
   swung Aegis-vs-Swarm and Aegis-vs-Null hard out of band. I scaled both
   cards back to explicitly match existing same-cost cards' stat lines
   before shipping. Flagging this because it's exactly the kind of mistake
   a card-design pass can make silently if nobody re-measures — I did
   re-measure, and it's what caught it, but you should know the first
   instinct was wrong and by how much (details in
   `progress/log.md`'s session-19 entry).
3. **New watch item: Aegis-vs-Swarm drifted out of its "even" band.**
   57.7-78.7% Aegis-favoured (not triple-flagged, so not an emergency, but a
   real move worth tracking) — collateral from Aegis getting generically
   stronger this session, not a Swarm-specific problem. I didn't chase this
   further inside this session (it wasn't this slice's target and Swarm has
   its own Phase 5 growth coming), but wanted you to see it named rather
   than only surface in a future report with no context.
4. **Which existing cards absorbed the copy trims that funded the new
   cards was picked by lowest measured win rate, not design intent.** One
   casualty: Latent Ward (the telegraph=2 trial from your 2026-09-13
   feedback) lost a copy (2->1) for measurement reasons unconnected to
   that trial's still-open "does a longer fuse feel different" question —
   it's still in the deck, just at minimum copies now. Say so if you'd
   rather that trial stay at full representation while it's still being
   judged.

---

**Updated 2026-09-25, session 18 (Phase 4 session 17 follow-ups executed —
ring labels corrected, Aegis-vs-Cortex fix, Null past-cost nerf).** Nothing
blocking, but two real steers wanted — full detail in
`progress/checkpoints.md`'s new entry, short version here:

1. **Aegis-vs-Null and Swarm-vs-Null are both now clear of the triple-flag**
   (the Null step-4-past-cost nerf: Kernel Panic's destroy reach tightened
   maxHealth 5->4, Null Singularity's health cut 8->7). Aggressive (72.0%)
   and Random (72.3%) are both still individually above 60% for Null in the
   Aegis matchup even though the cross-check is clear — if you want those
   two policies in band too, not just the triple-check clear, say so and
   a future session can push further; otherwise this is left as-is per
   "stop when it lands in band," reading that as the triple-flag clearing.
2. **Aegis-vs-Cortex: genuinely open, two attempts behind it now.** A first
   attempt (a new Barrier-granting Tool) measured worse and was reverted —
   full honesty on why in `progress/log.md`'s session-18 entry. A second
   attempt (Guard Directive Chip 2->3 copies, its own best-performing card)
   moved the numbers in the right direction but landed on NO policy's
   55-60% band (Aggressive 35.7%, Random 54.3%, Lookahead 48.3% Aegis).
   The remaining Aggressive-policy gap in particular (Cortex still wins
   64.3%) looks to this session like it may be partly an agent-heuristic
   artifact rather than a pure card problem — but that's a read, not a
   certainty. Genuinely open: try a second, differently-shaped Aegis card
   (something with immediate board impact) before Phase 5, or let Phase 5's
   wider pool settle this pairing the same way it's expected to settle
   Cortex-vs-Swarm? Your call.
3. **Phase 5 (pool expansion) is still not started.** Two pairings remain
   open (Cortex-vs-Swarm, explicitly left for Phase 5 per your own
   instruction; Aegis-vs-Cortex, now with two attempts behind it and still
   out of band). If you'd rather treat "two open pairings, both plausibly
   Phase-5 territory" as good enough to start pool expansion with these
   named as carried-forward watch items, rather than a third consecutive
   session chasing Aegis-vs-Cortex card-by-card, say so — this session
   didn't decide that unilaterally.

---

**Updated 2026-09-23, session 17 (Phase 4 decisions executed — Null step 4,
buff Swarm; whole ring re-measured).** Nothing blocking, but real steers
wanted — full detail in `progress/checkpoints.md`'s new entry, short version
here:

1. **Did exactly what you asked, in order** (Kernel Panic 5->6, Null
   Singularity 6->7, then two new Swarm cards — Colony Broodling replaces
   itself on death if 2+ other units survive, Overgrown Carapace's own
   health scales with your board width), then re-measured the whole ring.
   Neither Cortex nor any other faction was nerfed.
2. **Real movement, not there yet.** Aegis-vs-Null moved down under all
   three policies for the first time ever in this project (was
   78.0/72.0/67.7, now 75.7/70.0/65.3) but didn't reach your stated "stop at
   55-60%" line. Swarm-vs-Null stopped being triple-flagged (only Random
   still flags it) — the ring's most backwards edge is now much closer to
   fixed. Cortex-vs-Swarm, which I wasn't authorized to touch on either
   side, is unchanged.
3. **I stopped rather than guess at a next step**, per your own "if it
   lands in band, stop" phrasing implying otherwise I should hold — happy
   to be told to keep going and what with. Two live questions: (a)
   Cortex-vs-Swarm has nobody assigned to fix it — should Swarm get a third,
   more targeted card, or is this meant to wait for Phase 5's wider pool?
   (b) Kernel Panic and Null Singularity are still extreme win-rate outliers
   *when played* (up to 86.4%/78.7%) — the cost hike changed how often they
   land, not how strong they are. Want me to touch their stats/effects next,
   or leave cost as the only lever for now?
4. **Per your own instruction, I did NOT start Phase 5** (pool expansion) —
   the ring isn't in band on any of the six pairings yet.

---

**Updated 2026-09-22, session 16 (Phase 4 — the counter triangle, proposed
and measured; the Null backstop executed).** Nothing blocking, but real
steers wanted — see `progress/checkpoints.md`'s new Phase 4 entry for the
full write-up (this is the short version, per your own 2026-09-21 process
reminder to write checkpoint-worthy decisions here/there, not just in a PR
body):

1. **The triangle proposal itself needs your confirmation, not just a
   read.** I adopted your own 2026-09-20 example as-is (Null beats Aegis,
   Aegis beats Swarm, Swarm beats Null, Cortex flexible) and translated
   "55-60%/45-55%" onto each of the six pairings myself — that specific
   translation is my own first pass, not something you spelled out
   pairing-by-pairing.
2. **Measured against it: none of the six pairings pass yet.** Two
   different problems, not one — Cortex is too strong against Swarm (and,
   under one policy, Aegis), which contradicts "flexible in the middle";
   and Null's side of the cycle is actively backwards on one edge (Swarm is
   supposed to beat Null, currently loses to it 55-81%) as well as
   overshooting on the other (should beat Aegis by 55-60%, currently wins
   by up to 78%).
3. **I executed your pre-authorized Null backstop (3 of its 4 steps)
   without asking first**, since its own trigger condition (Null winning
   60%+ against Aegis under all three policies) was already true going in —
   that's what "pre-authorized" means, so I didn't treat it as a new
   decision needing sign-off. Segmentation Fault is now a conditional aura
   (a small, genuinely generic engine addition, not a card-only hack);
   Corrupted Process lost a copy; Entropy Harvester now scales off the
   enemy's graveyard instead of Null's own. Honest result: measurable but
   small movement, both pairings still flagged.
4. **Step 4 (cost increases) — I stopped and I'm asking, not guessing.**
   The data points at Kernel Panic and Null Singularity specifically (both
   extreme played-win-rate outliers), but both already cost exactly what
   their faction-mirror equivalents cost elsewhere (Aegis Warden 5, Prime
   Aegis 6) — pushing them higher would be the first time any faction's
   top end costs strictly more than its peers, a cross-faction curve call I
   didn't think was mine to make alone. Want me to do it anyway, or look at
   Aegis's/Swarm's own kits instead?
5. **Cortex-vs-Swarm — measured, still not fixed, and there's no
   pre-authorized mechanism for it the way there is for Null.** Should
   Cortex be nerfed, or Swarm/Aegis buffed? I didn't pick a faction to touch
   unilaterally here.

My own instinct if you'd rather I just proceed with a default: the
Swarm-vs-Null inversion looks like the most structurally wrong result on
the board (worse than "right direction, too strong" or "wrong faction
strong") and hasn't been targeted by anything yet — I'd look at giving
Swarm's own kit more staying power against Null next, rather than
continuing to only nerf Null. But I've held off doing that unilaterally
since it's a card-set-design call on a faction this session didn't touch.

---

**Updated 2026-09-21, session 15 (Phase 3 of your "fix the loop" plan — the
load-time card-pool lint).** Nothing blocking, but two things worth a
steer, written here directly per your own 2026-09-21 process reminder
rather than left in the PR body:

1. **The "removal/debuff card" classifier is my own first-cut call, not
   something your 2026-09-20 entry defined.** The entry names the rule
   ("removal/debuff cards <=25% of a deck") but not what counts as one. I
   defined it as: an `onPlay`/`static`/`activated` ability that destroys,
   damages, or negatively affects the opponent, or a standing aura/tax that
   debuffs them — and deliberately EXCLUDED reactive triggers
   (onAttack/onDamaged/onDeath/onTurnStart/onTurnEnd), on the reasoning
   that a card's secondary "it happens to graze the opponent when it dies"
   effect isn't the same deck-building commitment as a Command you cast
   specifically to answer the board. This is a real judgment call, not a
   derivation — with it, Cortex (32.5%) and Null (50%) needed fixes and
   Swarm/Aegis already passed; without the reactive-trigger exclusion, all
   four factions would have needed cuts, including ones that only have a
   reactive damage trigger as basically incidental flavour on a creature.
   Your call whether the current definition is right, too narrow, or too
   wide — `engine/src/cards/poolLint.ts`'s own header comment has the full
   reasoning if you want to look at the code directly.
2. **Fixing Null's pool to pass the lint made Aegis-vs-Null and
   Swarm-vs-Null measurably WORSE, not better** (see
   `progress/balance-report-009-poollint.txt` against session 14's
   baseline). The likely cause: I gave Corrupted Process a real draw effect
   (both to cut its removal-density contribution and to fix Null's total
   lack of card flow — the lint's rule 4), and even after cutting several
   of Null's weaker removal cards, the extra card advantage seems to have
   made its deck more consistent at finding its remaining strongest,
   untouched cards (Kernel Panic, Null Singularity, Null Pointer,
   Segmentation Fault). Per your own 2026-09-20 "Null dominance" entry,
   I've deliberately NOT nerfed anything in response to this — that entry
   reserves ability nerfs for after the Phase 4 triangle re-measure, not
   before, and the lint itself (this session's actual job) is real, tested,
   and correct regardless of this particular number. Flagging now so Phase
   4 starts from an accurate picture rather than being surprised by it.

No decision, asset, or credential only you can provide is needed to
proceed — the roadmap default is to move to Phase 4 (propose the intended
counter triangle at a checkpoint, then measure against it) next.

---

**Updated 2026-09-20, session 13 (Phase 2 item 3 of your "fix the loop"
plan — directives are now removable).** Nothing blocking. One thing worth a
glance: re-measuring after giving every faction a directive-destroy answer
moved two matchups in opposite directions, neither of them the pairing this
work targeted. Cortex-vs-Aegis is no longer triple-flagged (plausibly Aegis
can now destroy Cortex's Mainframe Core aura) — good news, not acted on
further. Cortex-vs-Swarm is newly triple-flagged (60.7%/64.0%/66.0%) — a
real but modest side effect, most likely from trimming 2 Cortex cards to
make room for its new answer card under the 40-card cap, not from the
directive-removal mechanic itself. Per your own 2026-09-20 instruction to
stop chasing individual numbers and work the phases in order, neither was
tuned this session — both are just honestly reported here and in
`progress/balance-report-006-directive-removal.txt`. Aegis-vs-Null (the
long-standing pairing) is essentially unchanged, as expected since this
session's work didn't target it. No action needed from you unless you want
to steer priority between finishing Phase 2 (items 4-5: a summon/token
effect kind, base protection while unevolved) versus jumping to look at
Cortex-vs-Swarm specifically — the roadmap default is to keep going in
phase order.

---

**Updated 2026-09-20, session 12 (Phase 1 of your "fix the loop" plan).**
Nothing blocking. Two follow-ups to the notes below, both from your own
2026-09-20 direction, not new asks:

- **The structural agent-measurement question below (the old item 2) has
  now been acted on**, exactly as your 2026-09-20 feedback's Phase 1 item 1
  asked: a third reference agent (`LookaheadAgent`) that values board state
  instead of raw card cost now runs alongside the other two in
  `balanceReport.ts`, and a pairing is only flagged when all three agree.
  Building it carefully paid off immediately: it caught its own real bug
  (five Commands scoring zero forever due to an "all"/"self" targeting
  gap) before that bug could ever reach a balance report — see
  `progress/log.md`'s session-12 entry if you want the detail. No
  additional steer needed from you here unless you want to weigh in on the
  approximations named in `progress/quality-debt.md`'s new session-12
  section.
- **Aegis-vs-Null (the old item 1) is still open, and correctly untouched
  this session** — your 2026-09-20 feedback is explicit that Phases 1-4
  come before resuming that pairing specifically. With the fixed
  instrument, it's joined by Cortex-vs-Aegis, now confirmed flagged under
  all three policies (previously only under Aggressive). Both wait on
  Phase 2 (engine gaps: directive removal, a summon/token effect kind, base
  protection while unevolved) before any further tuning — no action needed
  from you unless you want to steer that order.

---

**Worth a read when you have a spare minute (updated 2026-09-19, session
11 — Aegis defensive interaction + the chosen-targeting fix).** Not
blocking — the roadmap can proceed either way — but two things worth your
steer:

1. **Aegis-vs-Null is still flagged after adding real, tested, non-removal
   defensive interaction to Aegis's kit** (intercept/redirect, a cost tax,
   and a damage-blunt — see `progress/balance-report-004-aegis-defense.txt`
   for the full journey). Per your own 2026-09-19 instruction, this is left
   flagged rather than adding removal or guessing at more numbers. Your
   call on what's next: (a) leave it as documented, known debt for now and
   move to card-pool depth (roadmap item 4); (b) point at a specific
   further direction for Aegis or Null; or (c) something else.
2. **A more structural question the investigation surfaced:** the first
   attempt at these cards (2 copies each) measured WORSE across every Aegis
   matchup, not just Null — a real regression I did not ship. Isolating why,
   the most plausible driver is that the dummy reference agents
   (`AggressiveAgent`/`RandomAgent`) have no way to value a reactive or
   situational card correctly — `AggressiveAgent` always plays the
   highest-cost card it can afford, with no sense of "is this useful right
   now," so a card like Intercept Routine (does nothing without a pending
   attack to redirect) or Tariff Field (no immediate board impact) sometimes
   wins that slot over a real tempo play, for nothing. I shipped a smaller
   dose (1 copy each) to reduce the exposure, but the deeper issue is that
   `balanceReport.ts`'s whole method — pit dumb heuristic agents against
   each other, measure win rate — may be structurally unable to fairly
   value exactly the kind of skill-expressive, situational cards design
   principle 3 asks for more of. This isn't blocking (stage 2+ real agents
   will eventually supersede the dummies), but it's worth knowing before
   more "defensive"/reactive-style cards get added and keep reading as
   worse than they are. No action needed from you unless you want to steer
   whether to invest in a smarter reference agent sooner than the current
   roadmap implies, purely to make balance measurement trustworthy for this
   class of card.

Nothing is blocking right now (updated 2026-09-18, session 10 — the
Aegis-vs-Null fix you asked for). Did exactly the two-step process from
your 2026-09-17 feedback (condition Kernel Panic's destroy, then adjust a
Null number since it was still flagged) and measured both steps
separately — see `progress/balance-report-003-null-fix.txt`. Honest
result: the pairing is still double-flagged (74.7%/79.0%, down slightly
from 75.0%/81.3%) — a small real improvement, not a fix. An instrumentation
pass found no single card explains the gap. The most likely real driver:
Aegis's own card pool has almost no independent interaction/removal
(Perimeter Turret's telegraphed random 3-damage hit and Lockdown Field's
1-turn stasis are close to its whole answer suite) — a deck built purely
around stacking value into a few units with barely any way to interact
with the opponent's board. Fixing that means adding real interaction to
Aegis's own kit, which is a card-set-design change that reshapes Aegis's
balance against ALL factions, not just Null — flagging it here rather than
building it unilaterally in case you'd rather steer that direction (e.g.
what kind of interaction fits Aegis's "hardened guardian" identity) before
a future session does. Not blocking either way; the roadmap can proceed to
the rest of item 3 (Swarm-vs-Aegis, the Cortex pairings) in the meantime.

Nothing is blocking right now (updated 2026-09-17, session 9 — non-engine
test coverage). Your 2026-09-17 feedback on the Aegis-vs-Null fix direction
was read this session but deliberately NOT acted on yet — it explicitly says
to do that work "when the item 3 balance pass comes up, not before item 2,"
and item 2 (server/protocol/agents having zero automated tests) was the
roadmap's next unblocked item, so this session built that instead. The
Kernel Panic condition fix is still queued, correctly, for whichever future
session works roadmap item 3 next.

Nothing is blocking right now (updated 2026-09-16, session 8 — the fourth
faction, Null). Didn't need any decision, asset, or credential only the
owner can provide. One thing worth a glance if you have a spare minute:
Aegis-vs-Null is measuring at 75-81% in Null's favour (see
`progress/balance-report-002-null.txt`) — a plausible read is that it's
Kernel Panic's unconditional `destroy` landing on Aegis's whole
stacking-value identity (evolved/tooled-up units), which may be closer to
a hard counter than the "soft counter" design principle 3 asks for. Not
blocking (it's on the roadmap as the next balance item), but flagging in
case you'd rather steer the fix direction (e.g. "make destroy require a
condition" vs. "just keep tuning Null's stats down") before a future
session picks one unilaterally.

Nothing is blocking right now (updated 2026-09-14, session 6). Backfilling
Cortex and Swarm with one telegraph/evolution/Tool card each (closing the
"board-development system is Aegis-only" gap) didn't need any decision,
asset, or credential only the owner can provide — see the new session in
`progress/log.md` and `progress/current.md` for what shipped and what's
flagged as an overrulable judgment call (mainly: Cortex/Swarm got matching
*variety*, not matching *density*, with Aegis; and Cortex's deck now sits
exactly at the enforced 40-card ceiling). Feel free to weigh in via
`progress/owner-feedback.md`; if not, the project proceeds on the choices
made.

Nothing is blocking right now (updated 2026-09-14, hardening-pass session).
The telegraph delay=2 trial (Latent Ward) this session asked for is
mechanically in place and fires correctly in real play, but "compare how
the window feels" genuinely can't be judged yet — there's no render/
spectator experience to watch it in. Worth re-asking once stage 6
(spectator render) exists; not a blocker now.

Nothing is blocking right now — stage 3 (real card set + unified
board-development system) didn't need any decision, asset, or credential
only the owner can provide. The open numeric parameters it introduced
(board-slot count, telegraph timing, evolution strict-vs-loose, deck size
range) are all steerable, non-blocking choices — see the new checkpoint in
`progress/checkpoints.md` and `progress/owner-feedback.md`'s updated
2026-09-12 entry for the full list. Feel free to weigh in on any of them in
`progress/owner-feedback.md`; if not, the project proceeds on the defaults
chosen.

Nothing needed for the art pipeline yet — that's correctly deferred to a
late polish pass per DESIGN.md, well after there's a real game to skin.
The owner's cyberpunk + 1990s retro-futurism direction (2026-09-11
feedback) is now reflected in a second faction's flavour text (Aegis, this
session) on top of Cortex/Swarm; it will carry forward into the eventual
art-generation pass too.
