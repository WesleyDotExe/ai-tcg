// (session 93) A new season file's first contents (server/src/seasonSetup.ts,
// `npm run season:setup`) and the launch agents' files (server/launchd/).
// Before session 93 a new file (`npm run season -- <file> --new`) had nobody
// in it: no owner could sign in and no house owner queued.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { EconomyStore } from "@ai-tcg/economy";
import { HOUSE_CAST, setUpSeason } from "../src/seasonSetup.js";

const serverDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(serverDir, "..");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmpDir = () => {
  const d = mkdtempSync(join(tmpdir(), "season-setup-"));
  dirs.push(d);
  return d;
};
const INPUT = { name: "The Owner", username: "owner", password: "a long enough password", faction: "Aegis" as const, seed: 7 };

describe("setUpSeason", () => {
  it("makes the owner's admin account, its connected agent and the four house owners", () => {
    const store = EconomyStore.open(":memory:");
    const r = setUpSeason(store, INPUT);
    const signedIn = store.signIn("owner", INPUT.password);
    expect(signedIn.ownerId).toBe(r.ownerId);
    expect(store.isAdmin(r.ownerId)).toBe(true);
    const owner = store.getOwner(r.ownerId);
    expect(owner.kind).toBe("player");
    expect(owner.startingFaction).toBe("Aegis");
    expect(store.connectedAgent(r.ownerId)?.agentId).toBe(r.agentId);
    // The agent is made as the website makes one: its signature card, bound.
    expect(store.collection(r.ownerId).some((c) => c.cardId.startsWith("sig-PR-"))).toBe(true);
    expect(store.unopenedPacks(r.ownerId)).toHaveLength(3);
    expect(store.autoPlay(r.ownerId).on).toBe(false);
    const house = store.listOwners().filter((o) => o.kind === "house");
    expect(house.map((o) => o.name).sort()).toEqual(HOUSE_CAST.map((h) => h.name).sort());
    for (const o of house) {
      expect(store.connectedAgent(o.ownerId)).not.toBeNull();
      expect(store.unopenedPacks(o.ownerId)).toHaveLength(3);
    }
  });

  it("keeps a typed agent name", () => {
    const store = EconomyStore.open(":memory:");
    expect(setUpSeason(store, { ...INPUT, agentName: "Night Shift" }).agentName).toBe("Night Shift");
  });

  it("refuses a file that already has owners (no second house)", () => {
    const store = EconomyStore.open(":memory:");
    setUpSeason(store, INPUT);
    const owners = store.listOwners().length;
    expect(() => setUpSeason(store, { ...INPUT, username: "other" })).toThrow(/already has owners/);
    expect(store.listOwners()).toHaveLength(owners);
  });
});

describe("npm run season:setup", () => {
  const tsx = join(repo, "node_modules/.bin/tsx");
  const setup = (file: string, password: string, extra: string[] = []) =>
    spawnSync(tsx, ["src/seasonSetupCli.ts", file, "--name", "The Owner", "--login", "owner", "--faction", "null", ...extra], {
      cwd: serverDir,
      input: `${password}\n`,
      encoding: "utf8",
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });

  it("makes the file and its folder, then refuses to touch it again", () => {
    const file = join(tmpDir(), "data", "season-0.db");
    const first = setup(file, "a long enough password");
    expect(first.status).toBe(0);
    expect(first.stdout).toContain("[setup] next: npm run season -w server -- ");
    const store = EconomyStore.open(file);
    expect(store.signIn("owner", "a long enough password").ownerId).toBeTruthy();
    store.close();
    expect(existsSync(`${file}.lock`)).toBe(false);
    const again = setup(file, "a long enough password");
    expect(again.status).toBe(1);
    expect(again.stderr).toContain("already exists");
  });

  it("leaves nothing behind when it refuses (a short password)", () => {
    const file = join(tmpDir(), "season-0.db");
    const r = setup(file, "short");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("a password needs at least 10 characters");
    expect(existsSync(file)).toBe(false);
    expect(existsSync(`${file}.lock`)).toBe(false);
  });
});

describe("the launch agents (server/launchd)", () => {
  it("install.sh fills in every path, and both files parse as property lists", () => {
    const dir = tmpDir();
    const file = join(dir, "season-0.db");
    EconomyStore.open(file).close();
    const agents = join(dir, "LaunchAgents");
    const r = spawnSync("bash", ["server/launchd/install.sh", file], { cwd: repo, encoding: "utf8", env: { ...process.env, LAUNCH_AGENTS_DIR: agents } });
    expect(r.status).toBe(0);
    for (const name of ["season", "site"]) {
      const text = readFileSync(join(agents, `local.ai-tcg.${name}.plist`), "utf8");
      expect(text).not.toMatch(/@[A-Z_]+@/);
      // "--" inside an XML comment makes the whole file unreadable to launchd.
      for (const c of text.match(/<!--[\s\S]*?-->/g) ?? []) expect(c.slice(4, -3)).not.toContain("--");
      const parsed = spawnSync("python3", ["-I", "-c", "import json,plistlib,sys; print(json.dumps(plistlib.load(open(sys.argv[1],'rb'))))", join(agents, `local.ai-tcg.${name}.plist`)], { encoding: "utf8" });
      if (parsed.error) continue; // no python3 here: the comment check above still ran
      expect(parsed.status).toBe(0);
      const plist = JSON.parse(parsed.stdout);
      expect(plist.Label).toBe(`local.ai-tcg.${name}`);
      expect(plist.ProgramArguments[0]).toMatch(/node$/);
      expect(plist.KeepAlive).toEqual({ SuccessfulExit: false });
      expect(plist.StandardOutPath).toBe(join(dir, `${name}.log`));
      if (name === "season") expect(plist.ProgramArguments).toContain(file);
    }
  });

  it("install.sh refuses a season file that isn't there", () => {
    const dir = tmpDir();
    const r = spawnSync("bash", ["server/launchd/install.sh", join(dir, "typo.db")], { cwd: repo, encoding: "utf8", env: { ...process.env, LAUNCH_AGENTS_DIR: join(dir, "a") } });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no season file at");
    expect(existsSync(join(dir, "a"))).toBe(false);
  });
});
