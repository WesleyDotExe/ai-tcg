# Running Season 0 on the Mac mini: the owner's guide

Written by game session 93 (owner 2026-11-13, plan item 4, with the launch agent the owner chose for game
session 92's call). Every command here was run in the session's dry run (`progress/season0-dry-run-001.txt`),
on Linux: launchd itself only exists on macOS, so the launch agents' files were checked and their exact commands
run as launchd would run them, but `launchctl` itself wasn't. Your first start on the Mac mini is the real test
of steps 4 and 7.

Paths below assume the code is at `~/ai-tcg` and the season's files at `~/ai-tcg-data`. **Keep both out of
Documents, Desktop, Downloads and iCloud Drive.** macOS doesn't let a launch agent read those folders without
Full Disk Access, and the server would fail to start with "Operation not permitted".

---

## 1. The Mac mini's settings (once)

- **System Settings -> Energy:** turn on *Prevent automatic sleeping when the display is off* and *Start up
  automatically after a power failure*. A sleeping Mac stops the ladder; when it wakes, the matches that were
  being shown end at once.
- **System Settings -> Users & Groups -> Automatically log in as:** your user. Launch agents start when you
  log in, so after a power cut the Mac has to log in by itself. (macOS hides this option while FileVault is on.
  Then either turn FileVault off on this Mac, or log in by hand after every restart.)
- **System Settings -> General -> Date & Time:** *Set time and date automatically* on, time zone **Sydney**.
  The daily reset is midnight Sydney whatever the Mac's zone is, but the log's times are the Mac's own.
- **System Settings -> General -> Software Update -> Automatic updates:** turn off *Install macOS updates* for
  the season, so the Mac doesn't restart itself mid-week. (A restart is safe, see step 7, but it cancels the
  matches being shown.)

## 2. The code (once, and after each update)

Install Node.js 22 (the LTS installer from nodejs.org, or `brew install node@22`). Then:

```
cd ~
git clone <the repository's URL> ai-tcg
cd ~/ai-tcg
npm ci
```

`npm ci` again after every `git pull`.

## 3. The season's file (once per season)

```
cd ~/ai-tcg
npm run season:setup -w server -- ~/ai-tcg-data/season-0.db --name "<your name on the ladder>" --login <username> --faction <Cortex|Swarm|Aegis|Null>
```

It asks for your website password twice (at least 10 characters; nothing shows as you type). It makes the
folder and the file with:
- **your account:** the admin (you can end the season), your faction's starter deck and 3 starter packs, and
  your first agent, generated as the website's "Generate a new agent" does, with its signature card. It's
  connected; auto-play is off until you switch it on. Add `--agent "<name>"` to name it yourself.
- **the house:** House Cortex, House Swarm, House Aegis and House Null, one connected agent each. They always
  play, so the ladder runs from the first minute.
- **the season's end time:** Season 0 ends at midnight Sydney at the end of Saturday 26 December 2026 (00:00
  Sunday 27 Dec). It prints `[setup] the season ends at 2026-12-26T13:00:00.000Z (Sun 27 Dec 2026 00:00
  Sydney)`, and the server says it again each time it starts. The server ends the season by itself then
  (step 8). To use another time, add `--ends <time>` (e.g. `--ends 2026-12-26T13:00:00Z`, in UTC).

It refuses a file that already exists. Always give the file as a full path (`~/ai-tcg-data/...`): with
`-w server` a bare name would land inside `~/ai-tcg/server/`.

## 4. The launch agents (once, and again at the season switch)

Two launch agents: **the season server** (the ladder and the website's API, port 8081) and **the website**
(port 8080). Both start when you log in, and launchd starts either again if it crashes.

```
cd ~/ai-tcg
bash server/launchd/install.sh ~/ai-tcg-data/season-0.db
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.ai-tcg.season.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.ai-tcg.site.plist
```

`install.sh` fills in your paths (where node is, where the code is, the season file) and writes the two files
to `~/Library/LaunchAgents/`. The originals, with comments on every setting, are in `server/launchd/`. macOS may
show "Background Items Added": allow it (System Settings -> General -> Login Items -> *Allow in the Background*,
"node" on).

**Check it's running:**

```
launchctl print gui/$(id -u)/local.ai-tcg.season | grep -E "state|pid"
tail -n 20 ~/ai-tcg-data/season.log
```

`state = running` and a pid, and the log's last lines show rounds:

```
2026-12-05 09:00:01 [season] season S0 on /Users/<you>/ai-tcg-data/season-0.db
2026-12-05 09:00:01 [season] owner API on http://localhost:8081, the ladder running over ...
2026-12-05 09:00:19 [ladder] round 1 since this start: 2 matches, House Null sits out
```

What the settings do (`server/launchd/local.ai-tcg.season.plist`):
- `RunAtLoad`: starts at login (and at `bootstrap`).
- `KeepAlive` / `SuccessfulExit false`: started again after a crash or a kill; **a clean stop (exit 0) stays
  stopped.**
- `ThrottleInterval 60`: at most one start a minute. If a start keeps failing, the log gets one line a minute
  saying why (the first line of the problem is what to read).
- `ExitTimeOut 30`: on a stop, 30 seconds for the clean stop before launchd kills it.
- The log: `~/ai-tcg-data/season.log` (and `site.log`), appended to, every line timed.
- An owner who can't play (for example a faction lock with too few cards) gets one "sits out" line with the
  reason, again only when the reason changes, a "still sits out (60 rounds in a row)" reminder, and a "back in
  the queue" line when they play again; not one line every round.

## 5. The website

Open **http://127.0.0.1:8080/** on the Mac mini and sign in with the username and password from step 3. From
another computer at home: the website only listens on the Mac itself; ask for the `--host 0.0.0.0` change if
you want that.

## 6. Day to day

```
tail -n 50 ~/ai-tcg-data/season.log
```

| A line like | Means |
|---|---|
| `[ladder] round 12 since this start: 2 matches` | a round paired; counted from this start |
| `[ladder] m-... House Cortex vs House Null: House Null wins in 14 turns, +2/+10` | a match recorded, with each side's credits |
| `[ladder] rebuilt <owner>'s deck: ...` | an agent rebuilt its deck between matches |
| `[ladder] <owner>'s auto-play is off: its play time is up` | the allowance ran out |
| `[ladder] <owner>'s auto-play is off: today's rewards are maxed` | the 10th win of the day: back on after midnight Sydney |
| `[ladder] <owner>'s auto-play is off: switched off by its owner at <time>` | the owner turned it off on the website (printed at the next round's start; the time is when they switched it) |
| `[season] season S0's end time ... has passed: no new round; ...` | midnight 26/27 Dec: the season is ending (step 8) |
| `[ladder] cancelled 2 match(es) left live by the last run: ...` | after a crash or restart: those matches pay nothing, nobody's fault |
| `[lock] took over a stale lock ...` | after a crash or restart: normal |
| `[ladder] the clock moved ahead 180 minutes ...` | the Mac slept or its clock changed |
| `[ladder] the clock went back 5 minutes ...` | the clock was set back: nothing is shown until it catches up |
| `[ladder] couldn't record ... it stays live and is tried again` | the disk is full or the file is busy: free some space; it carries on by itself |

**How big it gets** (measured in the dry run, `progress/season0-dry-run-001.txt` section 9): `season.log` grows
about 150 KB a day (about 1 MB a week, under 5 MB over a 31-day season), so it needs no rotating; `site.log` hardly
grows. The match files in `~/ai-tcg-data/season-0.db.matches/` (a log and a replay per match, about 35 KB each,
some 320 matches a day with you and the house) are the bigger part: about 11 MB a day, about 0.3 GB over a season.
The season file itself stays under a few MB. Check the disk now and then with `df -h ~`.

## 7. Stopping, starting, restarting

| To | Run |
|---|---|
| stop the server for now (it stays stopped) | `launchctl kill TERM gui/$(id -u)/local.ai-tcg.season` |
| start it again | `launchctl kickstart gui/$(id -u)/local.ai-tcg.season` |
| restart it | `launchctl kickstart -k gui/$(id -u)/local.ai-tcg.season` |
| take it off for good (until the next `bootstrap`) | `launchctl bootout gui/$(id -u)/local.ai-tcg.season` |
| the same for the website | the same commands with `local.ai-tcg.site` |

All of these stop the server cleanly: the matches being shown are cancelled on the next start (no credits, no
rating), the lock is removed. **Don't also start it by hand in a terminal** (`npm run season ...`) while the
agent is loaded: the second one is refused ("is in use by"), and the agent keeps trying once a minute. Ctrl-C
is only for a server you started by hand.

**Before restarting the Mac mini, check its clock:** `sntp time.apple.com` (shows how far off it is), or
System Settings -> Date & Time. If the clock goes back after a restart, the server shows nothing for that long.
After the restart and the automatic login, both agents start by themselves; the log shows `[lock] took over`
(after a power cut) and `[ladder] cancelled ...`, then rounds again.

**Updating the code mid-season:** stop the server (the `kill TERM` line), `git pull`, `npm ci`, start it
(`kickstart`). The website: `kickstart -k` on `local.ai-tcg.site`.

## 8. The season's end and the switch to Season 1

1. **The season ends by itself** at 00:00 Sunday 27 Dec (Sydney): from then no new round starts, the matches
   on screen play to the end and are paid (up to about 7 minutes), then the season ends. Nothing to press. In
   the log:
   ```
   [season] season S0's end time 2026-12-26T13:00:00.000Z has passed: no new round; ending it once the 2 matches on screen are recorded
   [season] season S0 ended at 2026-12-26T13:04:10.000Z: ...
   ```
   If the Mac was off or the server stopped over midnight, it ends the season as soon as it starts again.
   (Only for a file made without an end time: end it by hand with two commands and your password:)
   ```
   TOKEN=$(curl -s -X POST http://127.0.0.1:8080/api/session -H 'content-type: application/json' -d '{"login":"<username>","password":"<password>"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
   curl -s -X POST http://127.0.0.1:8080/api/admin/season/end -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"season":"S0"}'
   ```
   It answers `"state":"ending"`: the matches being shown play to the end and are paid, then the season ends.
   Wait for this line (up to about 7 minutes):
   ```
   tail -f ~/ai-tcg-data/season.log      # until: [season] season S0 ended at ...
   ```
2. **Stop the season agent:** `launchctl bootout gui/$(id -u)/local.ai-tcg.season`
3. **Make Season 1's file** from the ended one (it's only read; it stays Season 0's archive):
   ```
   npm run season:next -w server -- ~/ai-tcg-data/season-0.db ~/ai-tcg-data/season-1.db S1
   ```
   If it says "is in use by", the server is still running (step 2).
4. **Point the agent at the new file and load it:**
   ```
   bash server/launchd/install.sh ~/ai-tcg-data/season-1.db
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.ai-tcg.season.plist
   ```
   (The website's agent stays loaded; it doesn't need the file.) Sign in with the same password. Unopened
   packs, credits and the collection start empty; your rating starts halfway back to 1500.

## 9. When something's wrong

| You see | Do |
|---|---|
| the website says it can't reach the server | `tail ~/ai-tcg-data/season.log`: the last lines say why |
| `not starting: "..." is in use by npm run season (process ...)` | a server is already running on the file: the agent, or one in a terminal. Stop one |
| `not starting: no season file at "..."` | the path in the agent is wrong: run `install.sh` again with the right file |
| `not starting: season S0 ended ...` | the agent points at the old season's file: step 8.3-8.4 |
| `Operation not permitted` | the code or the file is in Documents, Desktop, Downloads or iCloud: move them (see the top) |
| the same failing line once a minute | the agent can't start; read that line, fix it, then `kickstart` |
| `couldn't record` lines | the disk is full: free space; the matches are recorded on the next try |
