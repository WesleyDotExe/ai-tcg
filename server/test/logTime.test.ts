// (session 92) The Season 0 server's printed lines carry the local time.
import { afterEach, describe, expect, it, vi } from "vitest";
import { localStamp, STAMP_RE, stampConsole } from "../src/logTime.js";

describe("the server's time-stamped lines", () => {
  afterEach(() => vi.restoreAllMocks());

  it("formats the local date and time, zero-padded", () => {
    expect(localStamp(new Date(2026, 11, 5, 9, 3, 7))).toBe("2026-12-05 09:03:07");
    expect(localStamp(new Date(2027, 0, 1, 0, 0, 0))).toBe("2027-01-01 00:00:00");
  });

  it("prefixes every console level once, text or not, and the dev scripts can take it off", () => {
    const out: unknown[][] = [];
    for (const level of ["log", "info", "warn", "error"] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void out.push(a));
    const now = () => new Date(2026, 11, 5, 23, 59, 59);
    stampConsole(now);
    stampConsole(now); // a second call doesn't stamp twice
    console.log("[ladder] round 1 since this start: 2 matches");
    console.error("[ladder] tick failed:", new Error("x"));
    console.warn({ a: 1 });
    expect(out[0]).toEqual(["2026-12-05 23:59:59 [ladder] round 1 since this start: 2 matches"]);
    expect(out[1]![0]).toBe("2026-12-05 23:59:59 [ladder] tick failed:");
    expect(out[2]).toEqual(["2026-12-05 23:59:59", { a: 1 }]);
    expect("2026-12-05 23:59:59 [season] stopping\n2026-12-06 00:00:00 [lock] x".replace(STAMP_RE, "")).toBe("[season] stopping\n[lock] x");
    delete (console as Console & { __stamped?: true }).__stamped;
  });
});
