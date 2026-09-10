# AI-TCG — scheduled build task

This repo is built by a scheduled Claude run, one session at a time. Unlike the relay, this project is **openly commissioned and co-authored** by the repo owner — build it as directed, no autonomy pretense. Read DESIGN.md in full before working; it holds the vision, the non-negotiables, and the build order. This file is the operating procedure.

## Each session

1. Read DESIGN.md, then read progress/current.md and the last few entries in progress/log.md to see where the build is. Check recent commits.
2. Identify the current build-order stage (DESIGN.md has the ordered list). Do NOT jump ahead — a working stage N beats a half-built stage N+2. Especially: do not build visuals (stage 6) before the game actually runs headless (stages 1–4).
3. Do one real, complete slice of the current stage. Finishing one thing fully beats starting three.

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
- Append a dated paragraph to progress/log.md: what you built, whether you ran it and what it produced, what worked, what's blocked.
- Leave the next run a concrete thread: the exact next move.
- If you need something only the owner can provide (a decision, an asset, credentials, art direction), write it in progress/notes-for-owner.md, specifically.
- Commit. Open the PR only when the slice is genuinely working.

## First session ever

Stage 1. Don't scaffold the whole project. Build the headless rules engine: card schema, game state, turn structure, health + energy, win/loss detection, and two hardcoded dummy agents that make legal moves. Success condition: run a full match in the terminal and commit the match log to the repo (e.g. progress/sample-match-001.txt). Create progress/current.md, progress/log.md, progress/notes-for-owner.md. Then leave the next run its thread.
