// Game session 103 (game lane, hardening and fixes only): the plain
// `npm run ladder` CLI on the season server's own ladder lines (LadderLog,
// ladderLog.ts). Session 102 moved `npm run season`'s lines there and summed
// up a repeated "sits out" reason; `ladderCli.ts` kept its own copy of the
// event lines, printed the same reason every round, had no round line, and
// dropped the auto-play lines (an owner whose play time ran out was switched
// off with nothing printed). Every step runs the real CLI as a child
// process on a real season file:
//   1. Six rounds with a locked owner who can't build: one "sits out" line,
//      a line per round, each round's line before its matches.
//   2. One more round after a player owner's play time has run out: the
//      CLI says their auto-play is off. (The window's end is written into
//      the file directly, as the site contract check does, since the plain
//      ladder plays a round in seconds and a 15-minute window can't run out
//      inside it.)
//
//   npx tsx src/dev/ladderCliLogDemo.ts > ../progress/ladder-cli-log-001.txt
//
// A record (progress/demos.json "records"): the CLI pairs on a random seed,
// so who plays whom and who wins vary per run; the checks are on the lines'
// shape and order, which don't.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EconomyStore } from "@ai-tcg/economy";
import type { DeckFaction, PlayStyleId } from "@ai-tcg/engine";
import { STAMP_RE } from "../logTime.js";

const say = (line = "") => console.log(line);
const checks: [string, boolean][] = [];
const check = (what: string, ok: boolean) => {
  checks.push([what, ok]);
  say(`  [${ok ? "PASS" : "FAIL"}] ${what}`);
};
const section = (title: string) => {
  say();
  say(title);
  say("-".repeat(72));
};
const serverDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
const tsx = join(serverDir, "../node_modules/.bin/tsx");
const dir = mkdtempSync(join(tmpdir(), "ladder-cli-log-"));
const env = { ...process.env, NODE_NO_WARNINGS: "1" };
const tidy = (text: string) => text.replace(STAMP_RE, "").split(dir).join("<dir>").trimEnd();
const ladder = (rounds: number) => {
  const r = spawnSync(tsx, ["src/ladderCli.ts", db, String(rounds)], { cwd: serverDir, encoding: "utf8", env });
  return { code: r.status, lines: tidy(`${r.stdout}${r.stderr}`).split("\n") };
};
const db = join(dir, "season-0.db");
const PW = "a long demo password";

try {
  say("# `npm run ladder` on the season server's ladder lines (game session 103)");

  section("The season file");
  const store = EconomyStore.open(db);
  const CAST: { name: string; login: string | null; faction: DeckFaction; style: PlayStyleId }[] = [
    { name: "House Cortex", login: null, faction: "Cortex", style: "calculator" },
    { name: "House Aegis", login: null, faction: "Aegis", style: "fortress" },
    { name: "House Null", login: null, faction: "Null", style: "gambler" },
    { name: "Player Timed", login: "timed", faction: "Swarm", style: "rusher" },
    { name: "Player Locked", login: "locked", faction: "Swarm", style: "rusher" },
  ];
  const ids: Record<string, string> = {};
  for (const c of CAST) {
    const o = c.login ? store.createAccount({ name: c.name, username: c.login, password: PW, kind: "player" }) : store.createOwner({ name: c.name, kind: "house" });
    store.grantStarterCollection(o.ownerId, c.faction);
    const a = store.createAgent({ ownerId: o.ownerId, name: `${c.name}'s agent` });
    store.setPlayStyle(o.ownerId, a.agentId, c.style);
    store.connectAgent(o.ownerId, a.agentId);
    ids[c.name] = o.ownerId;
  }
  store.setAutoPlay(ids["Player Timed"]!, true, 15);
  store.setFactionLock(ids["Player Locked"]!, "Aegis");
  store.setAutoPlay(ids["Player Locked"]!, true);
  store.close();
  say("  Three house owners; Player Timed on auto-play for 15 minutes; Player Locked on auto-play with no limit,");
  say("  holding the Swarm starter only and locked to Aegis (no Aegis card held, so no deck can be built).");

  section("1. $ npm run ladder -- <dir>/season-0.db 6");
  const one = ladder(6);
  for (const l of one.lines) say(`    ${l}`);
  say();
  const locked = one.lines.filter((l) => l.includes("Player Locked") && l.includes("sits out"));
  const roundAt = (n: number) => one.lines.findIndex((l) => l.startsWith(`[ladder] round ${n} since this start:`));
  const matchLine = /^\[ladder\] \S+ .+ vs .+: /;
  const roundIdx = [1, 2, 3, 4, 5, 6].map(roundAt);
  // Each round's matches sit between its round line and the next one; the
  // count of match lines there must be the count the round line gives.
  const inOrder = roundIdx.every((at, i) => {
    if (at < 0) return false;
    const stop = i < 5 ? roundIdx[i + 1]! : one.lines.findIndex((l, k) => k > at && /^\s*(\d+|-) /.test(l));
    const said = Number(/: (\d+) match/.exec(one.lines[at]!)?.[1] ?? NaN);
    const shown = one.lines.slice(at + 1, stop).filter((l) => matchLine.test(l)).length;
    return said === shown;
  });
  check("the CLI ran to its end (exit 0, the standings printed)", one.code === 0 && one.lines.some((l) => /^\s+1 /.test(l)));
  check(`one line per round (${roundIdx.filter((i) => i >= 0).length} of 6)`, roundIdx.every((i) => i >= 0));
  check("each round's line comes before its own matches, with the count it gives", inOrder);
  check(`Player Locked's reason printed once, not every round (${locked.length} line; the old CLI printed 6)`, locked.length === 1 && locked[0]!.includes("at most 0 usable cards"));
  check("nobody else sits out with a reason", one.lines.filter((l) => l.includes(" sits out: ") && !l.includes("Player Locked")).length === 0);

  section("2. Player Timed's 15 minutes run out; $ npm run ladder -- <dir>/season-0.db 1");
  const s2 = EconomyStore.open(db);
  const status = s2.autoPlay(ids["Player Timed"]!);
  say(`  Player Timed's allowance after part 1: ${status.allowance?.state ?? "none"} (the window opened at their first pairing).`);
  // The schema holds the end after the start, so the end is set a second
  // after the window opened (a few seconds ago, at the first pairing).
  const startedAt = status.allowance?.startedAt;
  if (!startedAt) throw new Error("Player Timed's window never opened");
  s2.unsafeExec(`UPDATE auto_play SET allowance_ends_at = '${new Date(Date.parse(startedAt) + 1000).toISOString()}' WHERE owner_id = '${ids["Player Timed"]}'`);
  s2.close();
  say("  (the run: the window's end written into the file as one second after it opened, so it has passed)");
  const two = ladder(1);
  for (const l of two.lines) say(`    ${l}`);
  say();
  check("the CLI says Player Timed's auto-play is off because the play time is up", two.code === 0 && two.lines.includes("[ladder] Player Timed's auto-play is off: its play time is up"));
  check("Player Timed isn't in the round's matches", !two.lines.some((l) => matchLine.test(l) && l.includes("Player Timed")));
  check("Player Locked's reason printed once again (a new run starts a new log)", two.lines.filter((l) => l.includes("Player Locked") && l.includes("sits out")).length === 1);
  const s3 = EconomyStore.open(db);
  const after = s3.autoPlay(ids["Player Timed"]!);
  s3.close();
  check(`the store agrees: auto-play off, stopped for "${after.stopped?.reason}"`, after.on === false && after.stopped?.reason === "timeUp");
} finally {
  rmSync(dir, { recursive: true, force: true });
}

say();
const failed = checks.filter(([, ok]) => !ok);
say(`${checks.length - failed.length} of ${checks.length} checks PASS${failed.length ? `; FAILED: ${failed.map(([w]) => w).join("; ")}` : ""}`);
if (failed.length) process.exitCode = 1;
