// Session 87 (game lane, a spare session): how big the live feed gets
// (`GET /api/live/:matchId?from=N`), measured instead of guessed.
// quality-debt.md (session 67 on) said it "copies every released step from
// `from` on" and needs "a size cap before launch scale", without a number.
//
// The website reads `from=0` once when a match page opens (the whole match
// so far: `start`, the opening lines and hands, every released step), then
// `from=<released>` every few seconds (only what is new). So the largest
// read is a page opened on a match's last move. This plays real ladder
// matches (the house cast, the server's own Ladder and timeline recorder,
// house packs on as the server runs them) and sizes each match's feed as
// JSON, as the owner API sends it.
//
//   npx tsx src/dev/liveFeedSizeMeasure.ts > ../progress/live-feed-size-001.txt
//
// Seeds are fixed: the output is the same every run.

import { EconomyStore } from "@ai-tcg/economy";
import type { DeckFaction, PlayStyleId } from "@ai-tcg/engine";
import { Ladder } from "../ladder/ladderRunner.js";

const ROUNDS = Number(process.argv[2] ?? 25);
const CAST: { agent: string; faction: DeckFaction; style: PlayStyleId }[] = [
  { agent: "Lattice Warden", faction: "Cortex", style: "calculator" },
  { agent: "Quiet Theorem", faction: "Cortex", style: "controller" },
  { agent: "Hive Courier", faction: "Swarm", style: "rusher" },
  { agent: "Brood Cartographer", faction: "Swarm", style: "tempo" },
  { agent: "Chrome Bastion", faction: "Aegis", style: "fortress" },
  { agent: "Mirror Sentry", faction: "Aegis", style: "calculator" },
  { agent: "Static Widow", faction: "Null", style: "gambler" },
  { agent: "Dead Channel", faction: "Null", style: "tempo" },
];
const say = (line = "") => console.log(line);
let clock = new Date("2026-12-05T00:00:00.000Z");
const store = EconomyStore.open(":memory:", { now: () => clock });
for (const c of CAST) {
  const o = store.createOwner({ name: `House ${c.agent}`, kind: "house" });
  store.grantStarterCollection(o.ownerId, c.faction);
  const a = store.createAgent({ ownerId: o.ownerId, name: c.agent });
  store.connectAgent(o.ownerId, a.agentId);
  store.setPlayStyle(o.ownerId, a.agentId, c.style);
}
let n = 0;
let packSeed = 87_000;
const ladder = new Ladder({ store, seed: 8701, build: { games: 4, trials: 8, confirmGames: 8 }, matchId: () => `m-${++n}`, housePacks: { packSeed: () => ++packSeed } });
const rows: { steps: number; full: number; perStep: number; poll: number }[] = [];
for (let r = 0; r < ROUNDS; r++) {
  const { pairs } = await ladder.startRound();
  for (const p of pairs) {
    const played = await ladder.playPair(p);
    if (played === null) continue;
    const t = played.timeline;
    if (t && t.steps.length > 0) {
      // from=0 on the last move: everything a late page reads at once.
      const full = JSON.stringify({ start: t.start, startLines: t.startLines, openingHands: t.openingHands, from: 0, steps: t.steps }).length;
      // A poll: the largest single step (a poll between two releases carries one).
      const poll = Math.max(...t.steps.map((s) => JSON.stringify([s]).length));
      rows.push({ steps: t.steps.length, full, perStep: Math.round(full / t.steps.length), poll });
    }
    ladder.recordPlayed(played);
    clock = new Date(clock.getTime() + 9 * 60_000);
  }
}
const q = (xs: number[], f: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(f * xs.length))]!;
const kb = (b: number) => `${(b / 1024).toFixed(1)} KB`;
say("Live feed size 001 — how big GET /api/live/:id gets (session 87, game lane)");
say("=".repeat(72));
say(`${rows.length} real ladder matches (${ROUNDS} rounds of the eight house agents), sized as the JSON the owner API sends.`);
say("The feed's own part only (start, opening lines and hands, the steps): the live view's fields every read also carries");
say("(both sides, the board now, the last few lines, the speed) are not counted.");
say();
const row = (what: string, xs: number[], fmt: (x: number) => string) =>
  say(`  ${what.padEnd(40)} min ${fmt(q(xs, 0)).padStart(9)}  median ${fmt(q(xs, 0.5)).padStart(9)}  p90 ${fmt(q(xs, 0.9)).padStart(9)}  max ${fmt(Math.max(...xs)).padStart(9)}`);
row("moves in a match", rows.map((r) => r.steps), String);
row("from=0 on the last move (a late page)", rows.map((r) => r.full), kb);
row("per move", rows.map((r) => r.perStep), kb);
row("the largest one-move poll", rows.map((r) => r.poll), kb);
say();
const worst = Math.max(...rows.map((r) => r.full));
say(`Largest read: ${kb(worst)}, once per page opened; after that each poll carries only the moves released since.`);
say("Season 0 runs on one machine for a handful of owners: no cap is needed for it. A cap would make the website's");
say("first read loop until it has the whole match (it builds the arena from the first move on), so it is a change to");
say("both lanes, for launch scale (quality-debt.md).");
