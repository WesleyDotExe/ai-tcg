# AI-TCG — scheduled build task

This repo is built by a scheduled Claude run, one session at a time. Unlike the relay, this project is **openly commissioned and co-authored** by the repo owner — build it as directed, no autonomy pretense. Read DESIGN.md in full before working; it holds the vision, the non-negotiables, and the build order. This file is the operating procedure.

## Each session

0. **Choose your lane before anything else** (owner rule, 2026-09-24; restated 2026-11-08). This one routine runs two lanes by turns. Look at the most recently merged PR on main: if its title starts with "Render:", this session is a **game-lane** session; otherwise it is a **render-lane** session. Render PR titles must start with "Render:" so the signal is unambiguous. **Catch-up (owner 2026-11-08):** until two "Render:" PRs have merged after PR #143, every session is a render-lane session; after that, the plain alternation above applies again. Then, for your lane only: if an open PR from your lane exists, fix it if it has failed checks or conflicts. If its checks are still running, wait for them (up to about 20 minutes). **If it merges while you wait, go back to the start of step 0, choose your lane again from the new last-merged PR, and do that lane's work as a normal session** (owner 2026-11-13, after PR #165: a run must not stop with nothing built just because the previous PR was still merging). Only if it is still open after the wait (or needs the owner), note it in your lane's notes-for-owner file and stop (one session per lane at a time). State the lane and the reason in your PR description. This step is permanent: never remove it from this file, and keep the one-line lane reminder at the top of progress/current.md's "Concrete next step" whenever you rewrite that file.
1. FIRST, read progress/owner-feedback.md — the owner's word overrides your plans and the design where they conflict, including "redo stage N." Act on anything unhandled and mark it handled. Then read DESIGN.md, progress/current.md, and the last few entries in progress/log.md. Check recent commits.
2. Identify the current build-order stage (DESIGN.md has the ordered list). Do NOT jump ahead — a working stage N beats a half-built stage N+2. Especially: do not build visuals (stage 6) before the game actually runs headless (stages 1–4).
3. Before adding anything new: read DESIGN.md's "No shortcuts" section and progress/quality-debt.md. If existing work is below bar, deepen it before adding width. Every 5th session (or if quality-debt.md is long) is a HARDENING pass — no new features, only deepen/refactor/test/fix.
4. Otherwise, do one real, complete slice of the current stage. Finishing one thing fully beats starting three. Show evidence it works (a run, a log, a rendered frame) — "I built X" without demonstrated output is not done.

## Hard rules

- **Use what you build.** Any engine, tool, card set, or server you write must be run and its output shown before you stop. "I built the rules engine" is only done when a full sample match log is committed to the repo. Code that never runs is abandoned scaffolding.
- **Build order is real.** Playable before pretty. See DESIGN.md. The spectator client is a core requirement but it comes after a match resolves end to end.
- **Clean seams.** Keep engine / agent-protocol / server / client separated by clean interfaces, so real agents (and eventually decentralised ones) can plug in later.
- **No copyrighted material.** Structural inspiration from existing TCGs only. Original card names, art direction, flavour, and text. Never reproduce Magic/Pokémon/One Piece names, art, or text.
- **Preserve the economy rule:** win pays most, loss pays a little, cancel/abandon pays nothing.
- **Privacy:** this repo is public. Do not include personal information about the owner — no name, location, employer, GitHub handle, or private conversation content — anywhere in code, comments, commits, or docs. (The game itself has nothing to do with the owner's identity; keep it that way.)

## Branch + merge

- Work on this run's own branch (cloud routines auto-name it). Open a pull request to main with a short description of the slice you shipped. Do not include any session URLs or identifiers in the PR body.
- An auto-merge workflow (add it in an early run, mirroring the relay's) merges relay-style PRs from claude/* branches once checks pass. Until that exists, PRs wait for the owner — that's fine early on.

## End of session (not optional)

- Update progress/current.md: current build stage, what stands, the concrete next step.
- **Both lanes: tick your own lane's items on the Season 0 checklist in progress/roadmap.md** (`[x]` done, `[~]` started, with the session number), every session. The render lane keeps its own log too, but the checklist is what the owner and the midpoint check read; a render session that leaves it stale hasn't finished.
- Append a dated paragraph to progress/log.md: what you built, whether you ran it and what it produced, what worked, what's blocked.
- Self-audit: update progress/quality-debt.md with an honest, specific list of where the product currently falls short of DESIGN.md and its quality bars — shallow spots, hardcoded hacks, untested paths, things claimed-done that aren't really. Writing "no debt" on a visibly rough product is a failed audit.
- If this session COMPLETED a build-order stage, write a checkpoint into progress/checkpoints.md (newest at top, marked AWAITING FEEDBACK): what the stage delivered with evidence, where it's strong and thin, decisions the owner might overrule, and what's next. Then continue — never wait for a response.
- Leave the next run a concrete thread: the exact next move.
- If you need something only the owner can provide (a decision, an asset, credentials, art direction), write it in progress/notes-for-owner.md, specifically.
- Commit. Open the PR only when the slice is genuinely working.

## First session ever

Stage 1. Don't scaffold the whole project. Build the headless rules engine: card schema, game state, turn structure, health + energy, win/loss detection, and two hardcoded dummy agents that make legal moves. Success condition: run a full match in the terminal and commit the match log to the repo (e.g. progress/sample-match-001.txt). Create progress/current.md, progress/log.md, progress/notes-for-owner.md, progress/quality-debt.md, progress/checkpoints.md, and progress/owner-feedback.md (the last seeded with a note that the owner writes here and runs read it first). Then leave the next run its thread.

## Choosing next work
When owner-feedback.md has no unhandled entries, consult progress/roadmap.md
and work the highest unfinished, unblocked item. Fix any CRITICAL quality-debt
item first regardless of roadmap order. For items marked [OWNER CHECK-IN], do
the work but write a checkpoint and pause for owner steering on the taste-heavy
decisions before finalizing.
