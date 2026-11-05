// The auto-merge workflow's "Wait for checks to pass" step, run for real
// against a fake GitHub client (owner 2026-11-06: retry GitHub server errors
// and rate limits; any other error, or a check that really failed, still
// stops the merge). The script is read straight out of
// .github/workflows/auto-merge.yml, so this tests the shipped text, not a copy.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const workflowPath = resolve(here, "../../.github/workflows/auto-merge.yml");

/** The body of the first `script: |` block (the wait step), de-indented. */
function waitStepScript(): string {
  const lines = readFileSync(workflowPath, "utf8").split("\n");
  const start = lines.findIndex((l) => l.trim() === "script: |");
  if (start < 0) throw new Error("no script block in auto-merge.yml");
  const keyIndent = lines[start].search(/\S/);
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== "" && line.search(/\S/) <= keyIndent) break;
    body.push(line);
  }
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.search(/\S/)));
  return body.map((l) => l.slice(indent)).join("\n");
}

type Reply = { error: { status: number; headers?: Record<string, string> } } | { runs: Array<{ name: string; status: string; conclusion: string | null }> };

const green = { runs: [{ name: "test", status: "completed", conclusion: "success" }] };
const httpError = (status: number, headers?: Record<string, string>): Reply => ({ error: { status, headers } });

async function runWaitStep(replies: Reply[]) {
  const calls: number[] = [];
  const sleeps: number[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  let i = 0;
  const github = {
    rest: {
      checks: {
        listForRef: async () => {
          calls.push(i);
          const reply = replies[Math.min(i, replies.length - 1)];
          i++;
          if ("error" in reply) {
            const e = Object.assign(new Error(`HTTP ${reply.error.status}`), {
              status: reply.error.status,
              response: { headers: reply.error.headers ?? {} },
            });
            throw e;
          }
          return { data: { check_runs: reply.runs } };
        },
      },
    },
  };
  const context = {
    payload: { pull_request: { head: { sha: "abc123" } } },
    repo: { owner: "o", repo: "r" },
  };
  const core = {
    warning: (m: string) => warnings.push(m),
    setFailed: (m: string) => failures.push(m),
  };
  const fakeSetTimeout = (fn: () => void, ms: number) => {
    sleeps.push(ms);
    fn();
  };
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const step = new AsyncFunction("github", "context", "core", "setTimeout", waitStepScript());
  let thrown: unknown = null;
  try {
    await step(github, context, core, fakeSetTimeout);
  } catch (e) {
    thrown = e;
  }
  return { calls: calls.length, sleeps, warnings, failures, thrown };
}

describe("auto-merge: wait for checks", () => {
  it("retries one HTTP 500, then passes on green checks (the PR #131 case)", async () => {
    const r = await runWaitStep([httpError(500), green]);
    expect(r.thrown).toBeNull();
    expect(r.failures).toEqual([]);
    expect(r.calls).toBe(2);
    expect(r.sleeps).toEqual([5000]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain("HTTP 500");
  });

  it("retries 502, 503 and 429 alike, backing off 5/10/20 s", async () => {
    const r = await runWaitStep([httpError(502), httpError(503), httpError(429), green]);
    expect(r.thrown).toBeNull();
    expect(r.failures).toEqual([]);
    expect(r.sleeps).toEqual([5000, 10000, 20000]);
  });

  it("retries a 403 that is a rate limit (no requests left)", async () => {
    const r = await runWaitStep([httpError(403, { "x-ratelimit-remaining": "0" }), green]);
    expect(r.thrown).toBeNull();
    expect(r.calls).toBe(2);
  });

  it("does not retry a 403 that is not a rate limit", async () => {
    const r = await runWaitStep([httpError(403, { "x-ratelimit-remaining": "4000" }), green]);
    expect(r.thrown).not.toBeNull();
    expect(r.calls).toBe(1);
    expect(r.sleeps).toEqual([]);
  });

  it("does not retry other errors (404)", async () => {
    const r = await runWaitStep([httpError(404), green]);
    expect((r.thrown as { status: number }).status).toBe(404);
    expect(r.calls).toBe(1);
  });

  it("gives up after 4 retries of a lasting outage: the step fails, no merge", async () => {
    const r = await runWaitStep([httpError(500)]);
    expect((r.thrown as { status: number }).status).toBe(500);
    expect(r.calls).toBe(5);
    expect(r.sleeps).toEqual([5000, 10000, 20000, 40000]);
  });

  it("a check that really failed still stops the merge, with no retry", async () => {
    const r = await runWaitStep([{ runs: [{ name: "test", status: "completed", conclusion: "failure" }] }]);
    expect(r.thrown).toBeNull();
    expect(r.failures).toEqual(["A required check failed; not merging."]);
    expect(r.calls).toBe(1);
  });

  it("a server error between polls is retried and the poll goes on", async () => {
    const running = { runs: [{ name: "test", status: "in_progress", conclusion: null }] };
    const r = await runWaitStep([running, httpError(500), running, green]);
    expect(r.thrown).toBeNull();
    expect(r.failures).toEqual([]);
    expect(r.sleeps).toEqual([10000, 5000, 10000]);
  });

  it("still times out after 72 polls of a check that never finishes", async () => {
    const r = await runWaitStep([{ runs: [{ name: "test", status: "in_progress", conclusion: null }] }]);
    expect(r.failures).toEqual(["Timed out waiting for checks."]);
    expect(r.calls).toBe(72);
  });
});
