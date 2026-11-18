// Render session 81 (the render debt list): the render suite's time limits.
//
// Vitest's default 5 s per test and per hook is a hang detector, and many of
// this suite's tests are close to it on a quiet 4-core machine: the real
// owner API tests start a server, sign in and play or open packs (0.3-3.4 s
// quiet), and the engine-driven ones play whole matches (1-3.4 s quiet). With
// the machine busy (render 80 saw it with two headless browser checks beside
// the suite; render 81 reproduced it with six busy loops, 3 tests over 5 s,
// none of them a hang) they cross it and fail as timeouts, which CI's shared
// runners could hit too. 30 s keeps a real hang a failure while leaving room
// for a slow machine. The tests that set their own limit (60 s, the matches
// played in full) keep it.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
