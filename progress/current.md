# Current status

**Build-order stage: Stage 4+ (the living system), now driven by the Season 0 checklist at the top of
`progress/roadmap.md` (owner 2026-11-01: Season 0 is the MVP; scope LOCKED 2026-11-06: freeze 9 Nov, features done
1 Dec, clean-up 2-4 Dec, Season 0 starts 5 Dec). Session 81 (game lane) was the HARDENING pass: the CI demo
flake fixed (on #141's branch, so #141 merged), the demo runner prints whole errors, and the rule-change rebuild
burst measured. No new features. Nothing is blocking.**

- **The CI flake (`ladder-demo-002-live`, read ECONNRESET):** a keep-alive race in demos whose server and client
  share one event loop. `server/src/dev/demoFetch.ts` retries a reset before any response; all 13 API demos use it;
  a test keeps bare `fetch(` out of `server/src/dev`. Under CPU load: 0/3 runs passed before, 3/3 after
  (`progress/demo-reliability-001.txt`).
- **`scripts/demos.mjs`:** a failed demo shows its script, exit code or signal, the last 60 lines of stderr and the
  last 10 of stdout.
- **The rebuild burst (`npm run measure:ladder-stall -w server`, `progress/ladder-stall-001.txt`):** every agent
  deck rebuilding at once costs about 3.6 s per deck on 3 workers (48 decks: 172 s before round 1 pairs). The
  owner API stays responsive throughout (worst 67 ms). A round's matches play on the main thread: 0.4 s for 24.
- **Auto-merge:** #141 was a multi-commit PR, but its auto-merge ran main's old workflow (`pull_request_target`), so
  session 80's `sha` pin has still not had a live two-commit run. It is on main now.

## Concrete next step

At the start: check for an open PR from your own lane; if one is open, fix it if it has failed checks or conflicts,
else note it and stop. Check the last merged PR so a slice isn't built twice. Read owner-feedback.md.

- If this session's PR got a second commit, read both auto-merge jobs: that is the first live run of the `sha` pin.
- Otherwise: the game lane's open Season 0 items (roadmap 2-0 onward: the live board's unit badges if the render
  lane names them; season end near the end). Feature freeze from 9 Nov: only the locked scope.
- The next hardening pass is session 86.

**Blocked:** nothing.
