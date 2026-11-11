// (session 85) Which file a server starts on (server/src/seasonFile.ts): a
// missing file needs --new, an ended season's file needs --archive, and the
// check itself never creates, migrates or writes the file.

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { seasonFileArgs, seasonFileLine, seasonFileProblem } from "../src/seasonFile.js";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmpDir = () => {
  const d = mkdtempSync(join(tmpdir(), "season-file-"));
  dirs.push(d);
  return d;
};
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const PLAIN = { new: false, archive: false };
const LATEST = EconomyStore.open(":memory:").schemaVersion;

/** An open Season 0 file, an ended one, and Season 1 made from it. */
function files(dir: string) {
  const open = join(dir, "open.db");
  EconomyStore.open(open).close();
  const ended = join(dir, "season-0.db");
  const s0 = EconomyStore.open(ended);
  s0.createAccount({ name: "Ada", username: "ada", password: "a long test password" });
  s0.endSeason();
  s0.close();
  const s1 = join(dir, "season-1.db");
  EconomyStore.startNextSeason(ended, s1, { season: "S1" });
  return { open, ended, s1 };
}

describe("seasonFileArgs", () => {
  it("takes --new and --archive anywhere, keeps the rest in order", () => {
    expect(seasonFileArgs(["a.db", "--archive", "8081"])).toEqual({ args: ["a.db", "8081"], flags: { new: false, archive: true } });
    expect(seasonFileArgs(["--new", "a.db"])).toEqual({ args: ["a.db"], flags: { new: true, archive: false } });
    expect(seasonFileArgs(["a.db"])).toEqual({ args: ["a.db"], flags: PLAIN });
  });
  it("refuses an unknown option (a typo is never read as a path) and both flags at once", () => {
    expect(seasonFileArgs(["a.db", "--archve"])).toEqual({ problem: 'unknown option "--archve" (options: --new, --archive)' });
    expect(seasonFileArgs(["--new", "--archive", "a.db"])).toHaveProperty("problem", expect.stringMatching(/can't both be given/));
  });
});

describe("seasonFileProblem", () => {
  it("an open season's file starts as before, with no flag", () => {
    const { open, s1 } = files(tmpDir());
    expect(seasonFileProblem(open, PLAIN)).toBeNull();
    expect(seasonFileProblem(s1, PLAIN)).toBeNull();
  });

  it("a missing file is refused and not created; --new creates it", () => {
    const dir = tmpDir();
    const typo = join(dir, "season-l.db");
    expect(seasonFileProblem(typo, PLAIN)).toBe(`no season file at "${typo}". Check the name; to start a new season file there, pass --new.`);
    expect(seasonFileProblem(typo, { new: false, archive: true })).toBe(`no season file at "${typo}"`);
    expect(readdirSync(dir)).toEqual([]);
    expect(seasonFileProblem(typo, { new: true, archive: false })).toBeNull();
    expect(existsSync(typo)).toBe(false); // the check alone creates nothing; the server's open does
  });

  it("--new on an existing file is refused (it only creates)", () => {
    const { open } = files(tmpDir());
    expect(seasonFileProblem(open, { new: true, archive: false })).toMatch(/already exists \(season S0\): --new only creates a file/);
  });

  it("the ended season's file is refused, naming the next-season command; --archive serves it", () => {
    const { ended } = files(tmpDir());
    const problem = seasonFileProblem(ended, PLAIN)!;
    expect(problem).toMatch(new RegExp(`^season S0 ended at .*: "${ended.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" is its archive, and no match is ever paired on it\\.`));
    expect(problem).toContain(`npm run season:next -w server -- "${ended}" <new season file>`);
    expect(problem).toContain("or pass --archive");
    expect(seasonFileProblem(ended, { new: false, archive: true })).toBeNull();
  });

  it("--archive on a season that hasn't ended is refused", () => {
    const { open, s1 } = files(tmpDir());
    expect(seasonFileProblem(open, { new: false, archive: true })).toBe(`season S0 hasn't ended: "${open}" isn't an archive. Drop --archive.`);
    expect(seasonFileProblem(s1, { new: false, archive: true })).toMatch(/^season S1 hasn't ended/);
  });

  it("reads without writing: an older-schema file is not migrated by the check", () => {
    const dir = tmpDir();
    const old = join(dir, "old.db");
    EconomyStore.open(old, { migrateTo: LATEST - 1 }).close();
    const before = sha(old);
    expect(seasonFileProblem(old, PLAIN)).toBeNull();
    expect(sha(old)).toBe(before);
    expect(EconomyStore.peekSeasonFile(old)).toEqual({ schemaVersion: LATEST - 1, season: "S0", endedAt: null, startedFrom: null });
  });

  it("peekSeasonFile names where a file came from", () => {
    const { ended, s1 } = files(tmpDir());
    expect(EconomyStore.peekSeasonFile(ended)).toMatchObject({ schemaVersion: LATEST, season: "S0", endedAt: expect.any(String), startedFrom: null });
    expect(EconomyStore.peekSeasonFile(s1)).toMatchObject({ season: "S1", endedAt: null, startedFrom: "S0" });
  });
});

describe("seasonFileLine", () => {
  it("says which season the server is on, and when it is an archive", () => {
    const { open, ended, s1 } = files(tmpDir());
    for (const [path, want] of [
      [open, /^\[season\] season S0 on .*open\.db$/],
      [s1, /^\[season\] season S1 \(made from S0's archive\) on .*season-1\.db$/],
      [ended, /^\[season\] serving season S0's archive \(ended .*\) from .*season-0\.db: no match will be paired$/],
    ] as const) {
      const s = EconomyStore.open(path);
      expect(seasonFileLine(s, path)).toMatch(want);
      s.close();
    }
  });
});
