// The auto-merge workflow's "Wait for checks to pass" step, run for real
// against a fake GitHub client (owner 2026-11-06: retry GitHub server errors
// and rate limits; any other error, or a check that really failed, still
// stops the merge; and, after PR #137, nothing merges unless the `test` check
// run exists for the head commit and concluded success). The script is read straight out of
// .github/workflows/auto-merge.yml, so this tests the shipped text, not a copy.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const workflowPath = resolve(here, "../../.github/workflows/auto-merge.yml");

/** The body of the n-th `script: |` block (0: the wait step, 1: the merge step), de-indented. */
function scriptBlock(n: number): string {
  const lines = readFileSync(workflowPath, "utf8").split("\n");
  const starts = lines.flatMap((l, i) => (l.trim() === "script: |" ? [i] : []));
  const start = starts[n] ?? -1;
  if (start < 0) throw new Error(`no script block ${n} in auto-merge.yml`);
  const keyIndent = lines[start].search(/\S/);
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== "" && line.search(/\S/) <= keyIndent) break;
    body.push(line);
  }
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.search(/\S/)));
  return body.map((l) => l.slice(indent)).join("\n");
}
const waitStepScript = () => scriptBlock(0);
const mergeStepScript = () => scriptBlock(1);

type Reply = { error: { status: number; headers?: Record<string, string> } } | { runs: Array<{ name: string; status: string; conclusion: string | null }> };

const green = { runs: [{ name: "test", status: "completed", conclusion: "success" }] };
const httpError = (status: number, headers?: Record<string, string>): Reply => ({ error: { status, headers } });

async function runWaitStep(replies: Reply[], sha = "abc123") {
  const calls: number[] = [];
  const params: unknown[] = [];
  const sleeps: number[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  let i = 0;
  const github = {
    rest: {
      checks: {
        listForRef: async (p: unknown) => {
          calls.push(i);
          params.push(p);
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
    payload: { pull_request: { head: { sha } } },
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
  return { calls: calls.length, params, sleeps, warnings, failures, thrown };
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

  it("no check runs at all (the PR #137 case): waits the full timeout, then fails, no merge", async () => {
    const r = await runWaitStep([{ runs: [] }]);
    expect(r.thrown).toBeNull();
    expect(r.calls).toBe(72);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("no test run for this commit");
    expect(r.failures[0]).toContain("abc123");
  });

  it("other checks green but no test run: still fails as missing", async () => {
    const r = await runWaitStep([{ runs: [{ name: "build", status: "completed", conclusion: "success" }, { name: "lint", status: "completed", conclusion: "success" }] }]);
    expect(r.calls).toBe(72);
    expect(r.failures[0]).toContain("no test run for this commit");
  });

  it("a test run that appears late is waited for, then merges", async () => {
    const running = { runs: [{ name: "test", status: "queued", conclusion: null }] };
    const r = await runWaitStep([{ runs: [] }, { runs: [] }, running, green]);
    expect(r.thrown).toBeNull();
    expect(r.failures).toEqual([]);
    expect(r.calls).toBe(4);
  });

  it("a skipped or neutral test run is not a pass", async () => {
    for (const conclusion of ["skipped", "neutral"]) {
      const r = await runWaitStep([{ runs: [{ name: "test", status: "completed", conclusion }] }]);
      expect(r.calls).toBe(1);
      expect(r.failures).toHaveLength(1);
      expect(r.failures[0]).toContain(`"${conclusion}"`);
    }
  });

  it("a check whose name only contains 'test' does not stand in for the test run", async () => {
    const r = await runWaitStep([{ runs: [{ name: "render browser test", status: "completed", conclusion: "success" }] }]);
    expect(r.calls).toBe(72);
    expect(r.failures[0]).toContain("no test run for this commit");
  });

  it("asks GitHub for the latest run per name on the head commit", async () => {
    const r = await runWaitStep([green]);
    expect(r.params[0]).toMatchObject({ ref: "abc123", filter: "latest" });
  });
});

/** A fake PR on GitHub: its head moves when a commit is pushed, and the merge
 * call behaves as GitHub's does with `sha` (409 when the head has moved). */
class FakePr {
  head: string;
  merged: string | null = null;
  mergeCalls: Array<Record<string, unknown>> = [];
  constructor(head: string) {
    this.head = head;
  }
  push(sha: string) {
    this.head = sha;
  }
  async merge(p: Record<string, unknown>) {
    this.mergeCalls.push(p);
    if (p.sha !== undefined && p.sha !== this.head) {
      throw Object.assign(new Error("Head branch was modified. Review and try the merge again."), { status: 409 });
    }
    this.merged = String(p.sha ?? this.head);
  }
}

async function runMergeStep(pr: FakePr, jobSha: string, override?: (p: Record<string, unknown>) => Promise<void>) {
  const notices: string[] = [];
  const failures: string[] = [];
  const github = { rest: { pulls: { merge: override ?? ((p: Record<string, unknown>) => pr.merge(p)) } } };
  const context = { payload: { pull_request: { number: 7, head: { sha: jobSha } } }, repo: { owner: "o", repo: "r" } };
  const core = { notice: (m: string) => notices.push(m), warning: () => {}, setFailed: (m: string) => failures.push(m) };
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const step = new AsyncFunction("github", "context", "core", mergeStepScript());
  let thrown: unknown = null;
  try {
    await step(github, context, core);
  } catch (e) {
    thrown = e;
  }
  return { notices, failures, thrown };
}

/** One auto-merge job: the wait step then (if it passed) the merge step, as Actions runs them. */
async function runJob(pr: FakePr, jobSha: string, replies: Reply[]) {
  const wait = await runWaitStep(replies, jobSha);
  if (wait.thrown || wait.failures.length) return { wait, merge: null, ok: false };
  const merge = await runMergeStep(pr, jobSha);
  return { wait, merge, ok: !merge.thrown && merge.failures.length === 0 };
}

describe("auto-merge: merge only the tested commit (owner 2026-11-06, after PR #139)", () => {
  it("passes the job's own head sha to the merge call", async () => {
    const pr = new FakePr("aaa111");
    const r = await runMergeStep(pr, "aaa111");
    expect(r.thrown).toBeNull();
    expect(pr.mergeCalls[0]).toMatchObject({ pull_number: 7, merge_method: "squash", sha: "aaa111" });
    expect(pr.merged).toBe("aaa111");
  });

  it("the PR #139 case: a second commit pushed while the first job waits is not merged until its own test passes", async () => {
    const pr = new FakePr("aaa111");
    // Commit A's job starts waiting; commit B is pushed; A's test passes.
    pr.push("bbb222");
    const jobA = await runJob(pr, "aaa111", [green]);
    // A's job asked for A's checks, not B's, and GitHub refused the merge.
    expect(jobA.wait.params[0]).toMatchObject({ ref: "aaa111" });
    expect(pr.merged).toBeNull();
    expect(pr.mergeCalls[0]).toMatchObject({ sha: "aaa111" });
    // The older job ends green with the message, not a red cross.
    expect(jobA.ok).toBe(true);
    expect(jobA.merge!.notices).toEqual(["Not merging aaa111: a newer commit was pushed; its own auto-merge job merges it."]);
    // B's job waits on B's own test (still running, then green), then merges B.
    const running = { runs: [{ name: "test", status: "in_progress", conclusion: null }] };
    const jobB = await runJob(pr, "bbb222", [running, running, green]);
    expect(jobB.wait.params.every((p) => (p as { ref: string }).ref === "bbb222")).toBe(true);
    expect(jobB.wait.calls).toBe(3);
    expect(jobB.ok).toBe(true);
    expect(pr.merged).toBe("bbb222");
  });

  it("a real failed test on the newer commit still stops the merge", async () => {
    const pr = new FakePr("aaa111");
    pr.push("bbb222");
    await runJob(pr, "aaa111", [green]);
    const jobB = await runJob(pr, "bbb222", [{ runs: [{ name: "test", status: "completed", conclusion: "failure" }] }]);
    expect(jobB.ok).toBe(false);
    expect(jobB.wait.failures).toEqual(["A required check failed; not merging."]);
    expect(pr.merged).toBeNull();
    expect(pr.mergeCalls).toHaveLength(1); // only A's refused try
  });

  it("any other refusal still fails the job (405 not mergeable)", async () => {
    const pr = new FakePr("aaa111");
    const r = await runMergeStep(pr, "aaa111", async () => {
      throw Object.assign(new Error("Pull Request is not mergeable"), { status: 405 });
    });
    expect((r.thrown as { status: number }).status).toBe(405);
    expect(r.notices).toEqual([]);
  });

  it("the job has one concurrency group per PR, cancelling the older job", () => {
    const text = readFileSync(workflowPath, "utf8");
    expect(text).toMatch(/\n    concurrency:\n      group: auto-merge-pr-\$\{\{ github\.event\.pull_request\.number \}\}\n      cancel-in-progress: true\n/);
  });
});
