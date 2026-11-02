// Versioned replays, shown working (session 70, the hardening pass; owner
// 2026-11-02 call 6).
//
//   npm run demo:replay-versions -w server > ../progress/replay-versions-001.txt
//
// 1. The versions the game is on: the rules and card versions, and today's
//    registry digest against the newest card version.
// 2. Every golden replay (server/test/fixtures/replays/, real files the
//    ladder wrote: two in /1 from the session-69 writer, two in /2, and from session 71 two
//    played under rules-2) rebuilt
//    and its log compared with the one the ladder wrote.
// 3. A later set, simulated in this process only: two cards rebalanced in
//    the registry. The registry no longer matches cards-1, so a match played
//    now names no card version; every old file still rebuilds the match it
//    was, from its own cards (/2) or the frozen cards-1 (/1). The same moves
//    read against the changed cards are refused, not shown as a different
//    match.
// 4. A file naming a rules version this engine doesn't know is refused.
// 5. (session 71) rules-2 shipped: a match played now names rules-2 and
//    starts the second seat on 24; the rules-1 golden files still rebuild on
//    20 and 20; the same moves read as the other version don't rebuild.
// Deterministic: byte-identical across runs.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CARD_REGISTRY,
  CARDS_VERSIONS,
  CURRENT_CARDS_VERSION,
  CURRENT_RULES_VERSION,
  buildAegisDeck,
  buildNullDeck,
  formatLog,
  LookaheadAgent,
  publishedCardsVersion,
  registryDigest,
  replayMatch,
  RULES_VERSIONS,
  runMatch,
  type Card,
  type Move,
} from "@ai-tcg/engine";
import { makeReplayFile, rebuildReplay, replayDeckSpec, replaySetup, type ReplayFile, type ReplayFileV2 } from "../ladder/replayFile.js";

const say = (s = "") => console.log(s);
const checks: { name: string; ok: boolean }[] = [];
const check = (name: string, ok: boolean) => {
  checks.push({ name, ok });
  say(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
};

const DIR = join(import.meta.dirname, "..", "..", "test", "fixtures", "replays");
const golden = readdirSync(DIR)
  .filter((f) => f.endsWith(".replay.json"))
  .sort()
  .map((f) => ({ name: f.replace(".replay.json", ""), file: JSON.parse(readFileSync(join(DIR, f), "utf8")) as ReplayFile, log: readFileSync(join(DIR, f.replace(".replay.json", ".txt")), "utf8") }));

say("Versioned replays (session 70)");
say("==============================");
say();
say("1. The versions the game is on");
for (const r of RULES_VERSIONS) say(`  rules ${r.id}${r.id === CURRENT_RULES_VERSION ? " (current)" : ""}: ${r.text}`);
for (const c of CARDS_VERSIONS) say(`  cards ${c.id}${c.id === CURRENT_CARDS_VERSION ? " (current)" : ""}: digest ${c.digest}, ${CARD_REGISTRY.size} cards today. ${c.note}`);
say(`  today's registry digest: ${registryDigest()}`);
check("today's registry is the current card version", publishedCardsVersion() === CURRENT_CARDS_VERSION);
say();

function rebuildAll(label: string) {
  for (const g of golden) {
    let line: string;
    let ok = false;
    try {
      const { state, setup } = rebuildReplay(g.file);
      ok = `${formatLog(state.log)}\n` === g.log;
      line = `${g.name}: ${g.file.format}, ${g.file.moves.length} moves, rules ${setup.rulesVersion}, cards ${setup.cardsVersion}; ${state.players.p1.name} vs ${state.players.p2.name}, ${state.winner === "draw" ? "draw" : `${state.players[state.winner!].name} wins`} on turn ${state.turnNumber}, ${state.players.p1.health}-${state.players.p2.health}; log equals the ladder's: ${ok ? "yes" : "NO"}`;
    } catch (err) {
      line = `${g.name}: refused: ${err instanceof Error ? err.message : String(err)}`;
    }
    say(`  ${line}`);
    check(`${label}: ${g.name} rebuilds byte for byte`, ok);
  }
}

say("2. The golden replays, rebuilt today");
rebuildAll("today");
const v2 = golden.find((g) => g.file.format === "ai-tcg-replay/2")!.file as ReplayFileV2;
say(`  an /2 file carries ${v2.cards.length} card definitions (${JSON.stringify(v2).length} bytes in all); an /1 file names ids only (${JSON.stringify(golden[0]!.file).length} bytes)`);
say();

say("3. A later set, simulated: two cards rebalanced in the registry (this process only)");
const registry = CARD_REGISTRY as Map<string, Card>;
const before = new Map(registry);
// The two most-used units across the golden decks.
const uses = new Map<string, number>();
for (const g of golden) for (const id of [...g.file.decks.p1.cardIds, ...g.file.decks.p2.cardIds]) uses.set(id, (uses.get(id) ?? 0) + 1);
const targets = [...uses.entries()]
  .filter(([id]) => registry.get(id)?.type === "Unit")
  .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  .slice(0, 2)
  .map(([id]) => id);
for (const id of targets) {
  const c = registry.get(id)! as Card & { attack: number; health: number };
  registry.set(id, { ...c, attack: c.attack + 2, health: c.health + 1 } as Card);
  say(`  ${id} "${c.name}": ${c.attack}/${c.health} -> ${c.attack + 2}/${c.health + 1}`);
}
say(`  registry digest now ${registryDigest()} (cards-1 is ${CARDS_VERSIONS[0]!.digest})`);
check("the changed registry matches no published card version", publishedCardsVersion() === null);
rebuildAll("after the change");
// Why the versions matter: the same /1 moves read against the changed
// registry (what reading by card id alone would do). The moves can stay
// legal and play on to a different match, with nothing to say so.
const v1 = golden.find((g) => g.file.format === "ai-tcg-replay/1" && g.file.decks.p2.cardIds.some((id) => targets.includes(id)))!;
let unversioned = "";
let differs = false;
try {
  const s = replaySetup(v1.file);
  const { state } = replayMatch(replayDeckSpec(v1.file.decks.p1, "p1", registry), replayDeckSpec(v1.file.decks.p2, "p2", registry), s.names, s.seed, s.moves);
  differs = `${formatLog(state.log)}\n` !== v1.log;
  const w = state.winner ? (state.winner === "draw" ? "a draw" : `${state.players[state.winner].name} wins`) : "no result yet";
  unversioned = `plays on: ${w}, ${state.players.p1.health}-${state.players.p2.health} (recorded: ${v1.file.result.finalHealth.p1}-${v1.file.result.finalHealth.p2}); its log equals the ladder's: ${differs ? "NO" : "yes"}`;
} catch (err) {
  differs = true;
  unversioned = `refused: ${err instanceof Error ? err.message : String(err)}`;
}
say(`  without versions (${v1.name}'s moves read against the changed registry): ${unversioned}`);
check("unversioned, the old moves would show a different match: the frozen cards are what keep it", differs);
// A match played now: its file stamps no card version and carries the new cards.
const decks = { p1: buildAegisDeck("p1", "Aegis"), p2: buildNullDeck("p2", "Null") };
const moves: Move[] = [];
const played = await runMatch(decks.p1, decks.p2, new LookaheadAgent("New A", 1), new LookaheadAgent("New B", 2), 70, { onMove: (_s, m) => moves.push(m) });
const fresh = makeReplayFile(
  {
    matchId: "after-the-change",
    seed: 70,
    names: { p1: "New A", p2: "New B" },
    moves,
    result: {
      outcome: "win",
      winner: played.state.winner ?? null,
      turns: played.state.turnNumber,
      moves: played.movesPlayed,
      finalHealth: { p1: played.state.players.p1.health, p2: played.state.players.p2.health },
    },
  },
  decks,
);
const carried = targets.filter((id) => fresh.cards.some((c) => c.id === id));
say(`  a match played now: versions ${JSON.stringify(fresh.versions)}; carries the changed ${carried.join(" and ")} as they are now`);
check("a match played on unpublished cards names no card version, and carries the cards it was played with", fresh.versions.cards === null && carried.length > 0);
// Put the registry back: the new file still rebuilds, from its own cards.
for (const [id, c] of before) registry.set(id, c);
say(`  registry restored (digest ${registryDigest()})`);
let freshOk = false;
try {
  freshOk = formatLog(rebuildReplay(JSON.parse(JSON.stringify(fresh)) as ReplayFile).state.log) === formatLog(played.state.log);
} catch {
  freshOk = false;
}
say(`  that new file, rebuilt after the registry went back: log equals the match's: ${freshOk ? "yes" : "NO"}`);
check("a file plays its own cards whatever the registry says", freshOk);
say();

say("4. A rules version this engine doesn't know");
let rulesRefusal = "";
try {
  replaySetup({ ...v2, versions: { ...v2.versions, rules: "rules-3" } });
} catch (err) {
  rulesRefusal = err instanceof Error ? err.message : String(err);
}
say(`  a file naming rules-3: ${rulesRefusal || "(read)"}`);
check("an unknown rules version is refused with the reason", /rules-3/.test(rulesRefusal));
say();

say("5. rules-2 shipped (session 71): the second seat starts on 24");
const today = rebuildReplay(JSON.parse(JSON.stringify(fresh)) as ReplayFile);
say(`  the match played now: rules ${fresh.versions.rules}; starts ${today.setup.decks.p1.name} 20, ${today.setup.decks.p2.name} ${played.state.players.p2.maxHealth}`);
check("a match the game plays today names rules-2, the second seat on 24", fresh.versions.rules === "rules-2" && played.state.players.p2.maxHealth === 24 && played.state.players.p1.maxHealth === 20);
const olds = golden.map((g) => ({ name: g.name, r: rebuildReplay(g.file) }));
for (const o of olds) say(`  ${o.name}: rules ${o.r.setup.rulesVersion}, second seat's maximum health ${o.r.state.players.p2.maxHealth}`);
check(
  "every rules-1 golden file (v1, v2) still rebuilds on 20 and 20; the rules-2 ones (r2, session 71) on 20 and 24",
  olds.every((o) => (o.name.startsWith("r2-") ? o.r.setup.rulesVersion === "rules-2" && o.r.state.players.p2.maxHealth === 24 : o.r.setup.rulesVersion === "rules-1" && o.r.state.players.p2.maxHealth === 20)),
);
const swapped = (f: ReplayFile, rules: string): string => {
  try {
    rebuildReplay({ ...(f as ReplayFileV2), versions: { ...(f as ReplayFileV2).versions, rules } } as ReplayFile);
    return "rebuilt (wrong)";
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
};
const g2 = golden.find((g) => g.name === "v2-1")!;
const asNew = swapped(g2.file, "rules-2");
const asOld = swapped(fresh, "rules-1");
say(`  ${g2.name} read as rules-2: ${asNew}`);
say(`  the new match read as rules-1: ${asOld}`);
check("the same moves under the other rules version are refused, not shown as another match", /doesn't rebuild/.test(asNew) && /doesn't rebuild/.test(asOld));
say();

const failed = checks.filter((c) => !c.ok);
say(`${checks.length - failed.length}/${checks.length} checks PASS${failed.length ? `; FAILED: ${failed.map((c) => c.name).join("; ")}` : ""}`);
if (failed.length) process.exitCode = 1;
