// The server suite's time limits (owner 2026-11-22, with the Actions-minutes
// fix): the same reasoning as render/vitest.config.ts (render session 81).
// Vitest's default 5 s per test is a hang detector, and some server tests are
// close to it: the play-time allowance's "time running out mid-match" plays a
// ladder round in about 3 s on a quiet machine, and crossed 5 s on a shared CI
// runner (PR #192's first run), failing a PR with nothing wrong in it. Every
// such false failure costs a full re-run of the paid test job. 30 s keeps a
// real hang a failure. Tests that set their own limit keep it.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
