import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  accountSettingsProblem,
  BACKGROUNDS,
  DEFAULT_ACCOUNT_SETTINGS,
  EconomyStore,
  PACK_PRICE_CREDITS,
  STARTER_PACKS,
  THEMES,
} from "../src/index.js";

// Session 63 (owner 2026-11-01: "before match running, add the small
// endpoints the website is waiting on"): who am I, the account settings
// (schema v15) and the wallet, at the store.

const DAY1 = "2026-11-01T10:00:00.000Z";
let clock = new Date(DAY1);
const open = (path = ":memory:", migrateTo?: number) => EconomyStore.open(path, { now: () => clock, migrateTo });
const tmpDirs: string[] = [];
const tmpFile = () => {
  const dir = mkdtempSync(join(tmpdir(), "economy-settings-"));
  tmpDirs.push(dir);
  return join(dir, "season.db");
};
afterEach(() => {
  clock = new Date(DAY1);
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const PW = "correct horse battery";

const DEFAULTS = { theme: "system", background: "glacier", sound: { on: true, volume: 80 }, music: { on: true, volume: 60 }, skipHintSeen: false };

describe("who am I", () => {
  it("names the owner (display name, not login), its login, kind and whether it is the admin", () => {
    const s = open();
    const ada = s.createAccount({ name: "Ada Lovecode", username: "ada", email: "ada@example.test", password: PW });
    const root = s.createAccount({ name: "The House", username: "house-admin", password: PW, kind: "house", isAdmin: true });
    const bare = s.createOwner({ name: "No Login", kind: "house" });
    expect(s.whoAmI(ada.ownerId)).toEqual({ ownerId: ada.ownerId, name: "Ada Lovecode", username: "ada", email: "ada@example.test", kind: "player", isAdmin: false });
    expect(s.whoAmI(root.ownerId)).toEqual({ ownerId: root.ownerId, name: "The House", username: "house-admin", email: null, kind: "house", isAdmin: true });
    expect(s.whoAmI(bare.ownerId)).toEqual({ ownerId: bare.ownerId, name: "No Login", username: null, email: null, kind: "house", isAdmin: false });
    expect(() => s.whoAmI("nobody")).toThrow(/no owner/);
  });
});

describe("account settings (schema v15)", () => {
  it("reads the defaults until the owner changes one, writing nothing for an empty patch", () => {
    const s = open();
    const o = s.createOwner({ name: "a" });
    expect(s.accountSettings(o.ownerId)).toEqual({ ...DEFAULTS, updatedAt: null });
    expect(s.updateAccountSettings(o.ownerId, {})).toEqual({ ...DEFAULTS, updatedAt: null });
    // The defaults handed out are copies: changing one doesn't change the next read.
    s.accountSettings(o.ownerId).sound.volume = 3;
    expect(s.accountSettings(o.ownerId).sound.volume).toBe(80);
    expect(DEFAULT_ACCOUNT_SETTINGS.sound.volume).toBe(80);
  });

  it("changes only what the patch names, one audio field at a time, and stamps the change", () => {
    const s = open();
    const o = s.createOwner({ name: "a" });
    const other = s.createOwner({ name: "b" });
    expect(s.updateAccountSettings(o.ownerId, { theme: "dark" })).toEqual({ ...DEFAULTS, theme: "dark", updatedAt: DAY1 });
    clock = new Date("2026-11-01T11:00:00.000Z");
    const after = s.updateAccountSettings(o.ownerId, { music: { volume: 0 }, background: "aurora", skipHintSeen: true });
    expect(after).toEqual({
      theme: "dark",
      background: "aurora",
      sound: { on: true, volume: 80 },
      music: { on: true, volume: 0 },
      skipHintSeen: true,
      updatedAt: "2026-11-01T11:00:00.000Z",
    });
    s.updateAccountSettings(o.ownerId, { sound: { volume: 30 } });
    expect(s.updateAccountSettings(o.ownerId, { sound: { on: false } }).sound).toEqual({ on: false, volume: 30 });
    expect(s.updateAccountSettings(o.ownerId, { music: { on: false } }).music).toEqual({ on: false, volume: 0 });
    // Another owner's settings are their own.
    expect(s.accountSettings(other.ownerId)).toEqual({ ...DEFAULTS, updatedAt: null });
  });

  it("accepts every theme and background on the list", () => {
    const s = open();
    const o = s.createOwner({ name: "a" });
    for (const theme of THEMES) expect(s.updateAccountSettings(o.ownerId, { theme }).theme).toBe(theme);
    for (const background of BACKGROUNDS) expect(s.updateAccountSettings(o.ownerId, { background }).background).toBe(background);
    expect(BACKGROUNDS[0]).toBe("glacier");
    expect([...BACKGROUNDS]).toEqual(["glacier", "ocean", "aurora", "sunset", "lavender", "graphite", "black", "purple"]);
  });

  it("refuses an invalid patch whole, changing nothing", () => {
    const s = open();
    const o = s.createOwner({ name: "a" });
    s.updateAccountSettings(o.ownerId, { theme: "light" });
    const before = s.accountSettings(o.ownerId);
    const bad: [unknown, RegExp][] = [
      [null, /must be an object/],
      [[], /must be an object/],
      [{ colour: "red" }, /unknown setting "colour"/],
      [{ theme: "pink" }, /"theme" must be one of system, light, dark/],
      [{ theme: null }, /"theme" must be one of/],
      [{ background: "Glacier" }, /"background" must be one of/],
      [{ sound: true }, /"sound" must be an object/],
      [{ sound: { loud: true } }, /unknown field "sound.loud"/],
      [{ sound: { on: "yes" } }, /"sound.on" must be true or false/],
      [{ music: { volume: 101 } }, /"music.volume" must be a whole number from 0 to 100/],
      [{ music: { volume: -1 } }, /"music.volume"/],
      [{ music: { volume: 50.5 } }, /"music.volume"/],
      [{ music: { volume: "50" } }, /"music.volume"/],
      [{ skipHintSeen: 1 }, /"skipHintSeen" must be true or false/],
      // A good field doesn't carry a bad one through.
      [{ theme: "dark", sound: { volume: 200 } }, /"sound.volume"/],
    ];
    for (const [patch, message] of bad) {
      expect(accountSettingsProblem(patch)).toMatch(message);
      expect(() => s.updateAccountSettings(o.ownerId, patch as never)).toThrow(message);
    }
    expect(s.accountSettings(o.ownerId)).toEqual(before);
    expect(accountSettingsProblem({})).toBeUndefined();
    expect(accountSettingsProblem({ theme: "dark", sound: { on: false, volume: 0 }, music: { volume: 100 }, skipHintSeen: true })).toBeUndefined();
  });

  it("the schema itself guards the row, and a v14 file migrates with every owner on the defaults", () => {
    const path = tmpFile();
    const v14 = open(path, 14);
    const o = v14.createOwner({ name: "old" });
    v14.close();
    const v15 = open(path, 15);
    expect(v15.schemaVersion).toBe(15);
    expect(v15.accountSettings(o.ownerId)).toEqual({ ...DEFAULTS, updatedAt: null });
    v15.updateAccountSettings(o.ownerId, { theme: "dark" });
    for (const set of ["theme = 'pink'", "background = 'ocean2'", "sound_volume = 101", "music_volume = 2.5", "sound_on = 2", "skip_hint_seen = -1"]) {
      expect(() => v15.unsafeExec(`UPDATE account_settings SET ${set} WHERE owner_id = '${o.ownerId}'`)).toThrow(/CHECK/);
    }
    expect(() =>
      v15.unsafeExec(
        "INSERT INTO account_settings (owner_id, theme, background, sound_on, sound_volume, music_on, music_volume, skip_hint_seen, updated_at) VALUES ('ghost', 'dark', 'ocean', 1, 1, 1, 1, 0, 'x')",
      ),
    ).toThrow(/FOREIGN KEY/);
    v15.close();
    // Saved settings survive a reopen.
    const again = open(path);
    expect(again.accountSettings(o.ownerId).theme).toBe("dark");
    again.close();
  });
});

describe("the wallet", () => {
  it("is both balances and the unopened packs, oldest first; opening and buying move it", () => {
    const s = open();
    const o = s.createOwner({ name: "a" });
    expect(s.wallet(o.ownerId)).toEqual({ credits: 0, packPoints: 0, unopenedPacks: [] });
    s.grantStarterCollection(o.ownerId, "Aegis");
    const w = s.wallet(o.ownerId);
    expect(w.credits).toBe(0);
    expect(w.unopenedPacks).toHaveLength(STARTER_PACKS);
    expect(w.unopenedPacks.every((p) => p.source === "starter" && p.openedAt === null && p.ownerId === o.ownerId)).toBe(true);
    expect(w.unopenedPacks.map((p) => p.packId)).toEqual(s.unopenedPacks(o.ownerId).map((p) => p.packId));

    const opened = s.openPack(o.ownerId);
    expect(opened.packId).toBe(w.unopenedPacks[0]!.packId);
    const after = s.wallet(o.ownerId);
    expect(after.unopenedPacks.map((p) => p.packId)).toEqual(w.unopenedPacks.slice(1).map((p) => p.packId));
    expect(after.packPoints).toBe(opened.packPoints);
    expect(after.packPoints).toBeGreaterThan(0);

    // Credits come from play; a win pays, and buying a pack spends them.
    const other = s.createOwner({ name: "b" });
    const a1 = s.createAgent({ ownerId: o.ownerId, name: "a-agent" });
    const b1 = s.createAgent({ ownerId: other.ownerId, name: "b-agent" });
    // The daily win schedule pays the first win of a day most, so the wins are a day apart.
    for (let i = 0; i < 6; i++) {
      const endedAt = new Date(Date.parse(DAY1) + i * 86_400_000).toISOString();
      s.recordMatch({ matchId: `m${i}`, seed: i, p1AgentId: a1.agentId, p2AgentId: b1.agentId, outcome: { kind: "win", winnerAgentId: a1.agentId }, endedAt });
    }
    const earned = s.wallet(o.ownerId).credits;
    expect(earned).toBe(s.balance(o.ownerId, "credits"));
    expect(earned).toBeGreaterThanOrEqual(PACK_PRICE_CREDITS);
    const bought = s.buyPack(o.ownerId, "S0");
    const final = s.wallet(o.ownerId);
    expect(final.credits).toBe(earned - PACK_PRICE_CREDITS);
    expect(final.unopenedPacks.at(-1)!.packId).toBe(bought.packId);
    expect(() => s.wallet("nobody")).toThrow(/no owner/);
  });
});
