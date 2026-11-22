// This suite's time limits (owner 2026-11-22, the Actions-minutes fix): the
// same as render/vitest.config.ts (render session 81) and
// server/vitest.config.ts. Vitest's default 5 s per test is a hang detector,
// and a few tests sit near it on a quiet machine and cross it on a shared CI
// runner, failing a PR with nothing wrong in it (economy's chase.test.ts,
// 5.4–5.7 s on render 84's PR #193). Every false failure costs a full paid
// re-run of the test job. 30 s keeps a real hang a failure. Tests that set
// their own limit keep it.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
