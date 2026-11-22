// The auto-merge workflow's script, run for real against a fake GitHub client.
// The script is read straight out of .github/workflows/auto-merge.yml, so this
// tests the shipped text, not a copy.
//
// Since owner 2026-11-22 (Actions minutes): auto-merge starts when a `test` run
// FINISHES (workflow_run) and the job only runs when that run succeeded, on a
// pull_request, from a claude/* branch in this repo (the job's `if:`, checked
// as text below). It no longer polls while the tests run. What carries over:
// retry GitHub server errors and rate limits, and nothing else (owner
// 2026-11-06, PR #131); merge only the exact commit that was tested, a 409 from
// a newer commit is not a failure (PR #139); a PR with no test run (PR #137,
// conflicts) never merges, because no finished test run ever starts this.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const workflowPath = resolve(here, "../../.github/workflows/auto-merge.yml");
const testWorkflowPath = resolve(here, "../../.github/workflows/test.yml");

/** The body of the n-th `script: |` block, de-indented. */
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

type HttpError = { status: number; headers?: Record<string, string> };
const httpError = (e: HttpError) =>
  Object.assign(new Error(`HTTP ${e.status}`), { status: e.status, response: { headers: e.headers ?? {} } });

type Pr = { number: number; state: string; base: { ref: string }; head: { sha: string; ref: string; repo: { full_name: string } } };
const pr = (over: Partial<{ number: number; state: string; base: string; sha: string; ref: string; repo: string }> = {}): Pr => ({
  number: over.number ?? 7,
  state: over.state ?? "open",
  base: { ref: over.base ?? "main" },
  head: { sha: over.sha ?? "aaa111", ref: over.ref ?? "claude/x", repo: { full_name: over.repo ?? "o/r" } },
});

interface Fakes {
  /** The PR GitHub returns for pulls.get, by number. */
  prs: Record<number, Pr>;
  /** What the run's own pull_requests list holds (numbers). */
  runPrs?: number[];
  /** What the lookup by branch returns (numbers). */
  listed?: number[];
  /** Errors thrown by successive pulls.get calls before it answers. */
  getErrors?: HttpError[];
  /** Errors thrown by successive pulls.merge calls; after them it succeeds unless `mergeHeadMoved`. */
  mergeErrors?: HttpError[];
}

async function runScript(f: Fakes, run: Partial<{ head_sha: string; head_branch: string }> = {}) {
  const notices: string[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const sleeps: number[] = [];
  const merges: Array<Record<string, unknown>> = [];
  const lists: Array<Record<string, unknown>> = [];
  let getCalls = 0;
  let mergeCalls = 0;
  const getErrors = [...(f.getErrors ?? [])];
  const mergeErrors = [...(f.mergeErrors ?? [])];
  const github = {
    rest: {
      pulls: {
        list: async (p: Record<string, unknown>) => {
          lists.push(p);
          return { data: (f.listed ?? []).map((n) => f.prs[n]) };
        },
        get: async (p: { pull_number: number }) => {
          getCalls++;
          const e = getErrors.shift();
          if (e) throw httpError(e);
          return { data: f.prs[p.pull_number] };
        },
        merge: async (p: Record<string, unknown>) => {
          mergeCalls++;
          merges.push(p);
          const e = mergeErrors.shift();
          if (e) throw httpError(e);
        },
      },
    },
  };
  const context = {
    payload: {
      workflow_run: {
        head_sha: run.head_sha ?? "aaa111",
        head_branch: run.head_branch ?? "claude/x",
        pull_requests: (f.runPrs ?? []).map((number) => ({ number })),
      },
    },
    repo: { owner: "o", repo: "r" },
  };
  const core = {
    notice: (m: string) => notices.push(m),
    warning: (m: string) => warnings.push(m),
    setFailed: (m: string) => failures.push(m),
  };
  const fakeSetTimeout = (fn: () => void, ms: number) => {
    sleeps.push(ms);
    fn();
  };
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const step = new AsyncFunction("github", "context", "core", "setTimeout", scriptBlock(0));
  let thrown: unknown = null;
  try {
    await step(github, context, core, fakeSetTimeout);
  } catch (e) {
    thrown = e;
  }
  // Only the tested-and-accepted merges count as merged.
  const merged = merges.filter((_, i) => i >= (f.mergeErrors?.length ?? 0)).map((m) => m.sha);
  return { notices, warnings, failures, sleeps, merges, merged, lists, getCalls, mergeCalls, thrown };
}

describe("auto-merge: merge the tested commit when its test run succeeds", () => {
  it("merges the run's PR by squash, pinned to the tested sha", async () => {
    const r = await runScript({ prs: { 7: pr() }, runPrs: [7] });
    expect(r.thrown).toBeNull();
    expect(r.merges).toEqual([{ owner: "o", repo: "r", pull_number: 7, merge_method: "squash", sha: "aaa111" }]);
    expect(r.lists).toEqual([]);
  });

  it("when the run lists no PR, looks the PR up by branch in this repo", async () => {
    const r = await runScript({ prs: { 9: pr({ number: 9 }) }, runPrs: [], listed: [9] });
    expect(r.lists[0]).toMatchObject({ owner: "o", repo: "r", state: "open", head: "o:claude/x" });
    expect(r.merges[0]).toMatchObject({ pull_number: 9, sha: "aaa111" });
  });

  it("no open PR for the branch: nothing merges, no failure", async () => {
    const r = await runScript({ prs: {}, runPrs: [], listed: [] });
    expect(r.thrown).toBeNull();
    expect(r.mergeCalls).toBe(0);
    expect(r.notices[0]).toContain("No open PR");
  });

  it("the PR #139 case: the head moved past the tested commit, so this run does not merge", async () => {
    const r = await runScript({ prs: { 7: pr({ sha: "bbb222" }) }, runPrs: [7] }, { head_sha: "aaa111" });
    expect(r.thrown).toBeNull();
    expect(r.mergeCalls).toBe(0);
    expect(r.notices[0]).toContain("bbb222");
    // The newer commit's own successful run merges it.
    const r2 = await runScript({ prs: { 7: pr({ sha: "bbb222" }) }, runPrs: [7] }, { head_sha: "bbb222" });
    expect(r2.merges[0]).toMatchObject({ sha: "bbb222" });
  });

  it("a commit pushed between the check and the merge: GitHub's 409 is a notice, not a failure", async () => {
    const r = await runScript({ prs: { 7: pr() }, runPrs: [7], mergeErrors: [{ status: 409 }] });
    expect(r.thrown).toBeNull();
    expect(r.failures).toEqual([]);
    expect(r.notices).toEqual(["Not merging aaa111: a newer commit was pushed; its own test run merges it."]);
  });

  it("any other refusal still fails the job (405 not mergeable)", async () => {
    const r = await runScript({ prs: { 7: pr() }, runPrs: [7], mergeErrors: [{ status: 405 }] });
    expect((r.thrown as { status: number }).status).toBe(405);
  });

  it("never merges a PR that isn't an open claude/* PR from this repo into main", async () => {
    for (const bad of [pr({ state: "closed" }), pr({ base: "dev" }), pr({ ref: "feature/x" }), pr({ repo: "someone/fork" })]) {
      const r = await runScript({ prs: { 7: bad }, runPrs: [7] });
      expect(r.mergeCalls).toBe(0);
      expect(r.thrown).toBeNull();
    }
  });
});

describe("auto-merge: GitHub server errors and rate limits are retried, nothing else (PR #131)", () => {
  it("retries one HTTP 500, then merges", async () => {
    const r = await runScript({ prs: { 7: pr() }, runPrs: [7], getErrors: [{ status: 500 }] });
    expect(r.thrown).toBeNull();
    expect(r.getCalls).toBe(2);
    expect(r.sleeps).toEqual([5000]);
    expect(r.warnings[0]).toContain("HTTP 500");
    expect(r.merges).toHaveLength(1);
  });

  it("retries 502, 503 and 429 alike, backing off 5/10/20 s", async () => {
    const r = await runScript({ prs: { 7: pr() }, runPrs: [7], getErrors: [{ status: 502 }, { status: 503 }, { status: 429 }] });
    expect(r.thrown).toBeNull();
    expect(r.sleeps).toEqual([5000, 10000, 20000]);
  });

  it("retries a 403 that is a rate limit (no requests left), not one that isn't", async () => {
    const limited = await runScript({ prs: { 7: pr() }, runPrs: [7], getErrors: [{ status: 403, headers: { "x-ratelimit-remaining": "0" } }] });
    expect(limited.thrown).toBeNull();
    expect(limited.getCalls).toBe(2);
    const denied = await runScript({ prs: { 7: pr() }, runPrs: [7], getErrors: [{ status: 403, headers: { "x-ratelimit-remaining": "4000" } }] });
    expect(denied.thrown).not.toBeNull();
    expect(denied.getCalls).toBe(1);
    expect(denied.mergeCalls).toBe(0);
  });

  it("does not retry other errors (404)", async () => {
    const r = await runScript({ prs: { 7: pr() }, runPrs: [7], getErrors: [{ status: 404 }] });
    expect((r.thrown as { status: number }).status).toBe(404);
    expect(r.getCalls).toBe(1);
  });

  it("gives up after 4 retries of a lasting outage: the job fails, no merge", async () => {
    const outage = Array.from({ length: 10 }, () => ({ status: 500 }));
    const r = await runScript({ prs: { 7: pr() }, runPrs: [7], getErrors: outage });
    expect((r.thrown as { status: number }).status).toBe(500);
    expect(r.getCalls).toBe(5);
    expect(r.sleeps).toEqual([5000, 10000, 20000, 40000]);
    expect(r.mergeCalls).toBe(0);
  });

  it("a server error on the merge call itself is retried too", async () => {
    const r = await runScript({ prs: { 7: pr() }, runPrs: [7], mergeErrors: [{ status: 502 }] });
    expect(r.thrown).toBeNull();
    expect(r.mergeCalls).toBe(2);
  });
});

describe("auto-merge: when the job runs at all (the workflow's own text)", () => {
  const text = readFileSync(workflowPath, "utf8");

  it("starts when a `test` run finishes, not with the PR", () => {
    expect(text).toMatch(/\non:\n  workflow_run:\n    workflows: \["test"\]\n    types: \[completed\]\n/);
    expect(text).not.toMatch(/pull_request_target/);
  });

  it("runs only for a successful test run of a pull_request from a claude/* branch in this repo", () => {
    expect(text).toContain("github.event.workflow_run.event == 'pull_request'");
    expect(text).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(text).toContain("github.event.workflow_run.head_repository.full_name == github.repository");
    expect(text).toContain("startsWith(github.event.workflow_run.head_branch, 'claude/')");
  });

  it("keeps its name, which mythic-wards follows", () => {
    expect(text.split("\n")[0]).toBe("name: Auto-merge build PRs");
    const wards = readFileSync(resolve(here, "../../.github/workflows/mythic-wards.yml"), "utf8");
    expect(wards).toContain('workflows: ["Auto-merge build PRs"]');
  });
});

describe("test.yml: a notes-only PR still reports `test`, without the steps", () => {
  const text = readFileSync(testWorkflowPath, "utf8");
  const pattern = text.match(/grep -v -E '([^']+)'/)?.[1];
  const notesOnly = (files: string[]) => files.length > 0 && files.every((f) => new RegExp(pattern!).test(f));

  it("only pictures and markdown under progress/ count as notes", () => {
    expect(pattern).toBeDefined();
    expect(notesOnly(["progress/owner-feedback.md", "progress/render/evidence/a.jpg", "progress/render/x.png"])).toBe(true);
    // A demo record, an evidence script, the season-1 spec the tests read, or code: the full run.
    expect(notesOnly(["progress/owner-feedback.md", "progress/auto-play-off-001.txt"])).toBe(false);
    expect(notesOnly(["progress/render/evidence/board-fit-check.mjs"])).toBe(false);
    expect(notesOnly(["render/season1/HOME_TILES.md"])).toBe(false);
    expect(notesOnly(["render/EFFECTS.md"])).toBe(false);
    expect(notesOnly(["progress/demos.json"])).toBe(false);
    expect(notesOnly([])).toBe(false);
  });

  it("every step after the check is skipped only on notes-only PRs", () => {
    const steps = ("\n" + text.split("\n    steps:\n")[1]).split(/\n      - /).slice(1);
    expect(steps[0]).toContain("id: changes");
    for (const step of steps.slice(1)) expect(step).toContain("if: steps.changes.outputs.docs_only != 'true'");
  });

  it("runs on PRs and by hand, not on pushes to main", () => {
    expect(text).toMatch(/\non:\n  pull_request:\n    branches: \[main\]\n  workflow_dispatch:\n/);
    expect(text).not.toMatch(/\n  push:/);
  });
});
