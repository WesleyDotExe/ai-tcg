// Evidence for play styles in the store (session 52, roadmap 2b part 2;
// owner 2026-10-15: "owners pick their agent's play style from a set of
// presets; a change made during a live match applies from the next match").
//
//   npx tsx src/dev/playStyleDemo.ts > ../progress/economy-demo-015.txt
//
// Real owners in a real database file. Each agent's built deck plays real
// matches started and recorded through the store; each side's agent is the
// engine's LookaheadAgent with the style the live match started with. One
// owner changes style mid-match, and the next match picks it up. Seeds and
// the clock are fixed so the output reproduces.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LookaheadAgent, PLAY_STYLES, PLAY_STYLE_IDS, runMatch, type DeckFaction } from "@ai-tcg/engine";
import { EconomyStore, type LiveMatch } from "../index.js";

const tempDir = mkdtempSync(join(tmpdir(), "play-style-demo-"));
let now = new Date("2026-10-20T09:00:00.000Z");
const store = EconomyStore.open(join(tempDir, "season-0.db"), { now: () => now });
const say = (line = "") => console.log(line);

async function seat(name: string, faction: DeckFaction) {
  const o = store.createOwner({ name, kind: "house" });
  store.grantStarterCollection(o.ownerId, faction);
  const agent = store.createAgent({ ownerId: o.ownerId, name: `${name}'s agent` });
  store.connectAgent(o.ownerId, agent.agentId);
  await store.buildAgentDeck(o.ownerId, { games: 0 });
  return { name, ownerId: o.ownerId, agentId: agent.agentId };
}

type Seat = Awaited<ReturnType<typeof seat>>;

async function play(matchId: string, p1: Seat, p2: Seat, seed: number, during?: () => void): Promise<void> {
  const live: LiveMatch = store.startMatch({ matchId, p1OwnerId: p1.ownerId, p2OwnerId: p2.ownerId });
  during?.();
  const { state, movesPlayed } = await runMatch(
    { ...live.p1.deck.spec, id: "p1" },
    { ...live.p2.deck.spec, id: "p2" },
    new LookaheadAgent(p1.name, seed * 2, { style: live.p1.playStyle }),
    new LookaheadAgent(p2.name, seed * 2 + 1, { style: live.p2.playStyle }),
    seed,
  );
  const winnerAgentId = state.winner === "p1" ? p1.agentId : state.winner === "p2" ? p2.agentId : null;
  now = new Date(now.getTime() + 6 * 60_000);
  const rec = store.recordMatch({
    matchId,
    seed,
    p1AgentId: p1.agentId,
    p2AgentId: p2.agentId,
    p1DeckId: live.p1.deck.deckId,
    p2DeckId: live.p2.deck.deckId,
    outcome: winnerAgentId ? { kind: "win", winnerAgentId } : { kind: "draw" },
    turns: state.turnNumber,
    moves: movesPlayed,
    finalHealth: { p1: state.players.p1.health, p2: state.players.p2.health },
  });
  const style = (s: string) => PLAY_STYLES[s as keyof typeof PLAY_STYLES].name;
  const attacks = (pid: "p1" | "p2") => {
    let at = 0;
    let face = 0;
    let active: "p1" | "p2" = "p1";
    for (const e of state.log) {
      if (e.type === "turnStart") active = e.player;
      if (e.type === "attack" && active === pid) {
        at++;
        if (e.defenderKind === "player") face++;
      }
    }
    return `${face}/${at} attacks at health`;
  };
  say(
    `  ${matchId}: ${p1.name} (${style(rec.playStyles!.p1)}) vs ${p2.name} (${style(rec.playStyles!.p2)}): ` +
      `${state.winner === "draw" ? "draw" : `${state.winner === "p1" ? p1.name : p2.name} wins`} in ${state.turnNumber} turns, ` +
      `health ${state.players.p1.health} to ${state.players.p2.health}; ${p1.name} ${attacks("p1")}, ${p2.name} ${attacks("p2")}`,
  );
}

try {
  say("AI-TCG economy demo 015: play styles in the store (schema v13)");
  say("");
  say("1. The presets the owner app lists:");
  for (const id of PLAY_STYLE_IDS) say(`   ${PLAY_STYLES[id].name.padEnd(11)} ${PLAY_STYLES[id].summary}`);
  say("");
  const ada = await seat("ada", "Swarm");
  const bo = await seat("bo", "Null");
  say(`2. New agents play ${PLAY_STYLES[store.getAgent(ada.agentId).playStyle].name} until their owner picks: ada's agent ${store.getAgent(ada.agentId).playStyle}, bo's agent ${store.getAgent(bo.agentId).playStyle}.`);
  store.setPlayStyle(ada.agentId, "rusher");
  store.setPlayStyle(bo.agentId, "fortress");
  say(`   ada picks Rusher, bo picks Fortress. A made-up style is refused: ${(() => {
    try {
      store.setPlayStyle(ada.agentId, "berserker");
      return "accepted (wrong)";
    } catch (e) {
      return (e as Error).message;
    }
  })()}`);
  say("");
  say("3. Matches started and recorded through the store, each side played with the style it started with:");
  for (let i = 1; i <= 3; i++) await play(`m${i}`, i % 2 ? ada : bo, i % 2 ? bo : ada, 40 + i);
  say("");
  say("4. ada switches to Controller while m4 is live: m4 still plays Rusher, m5 plays Controller.");
  await play("m4", ada, bo, 44, () => store.setPlayStyle(ada.agentId, "controller"));
  await play("m5", bo, ada, 45);
  say("");
  say("5. The match history keeps each side's style:");
  for (const m of store.matchHistory({ agentId: ada.agentId })) say(`   ${m.matchId}: p1 ${m.playStyles?.p1}, p2 ${m.playStyles?.p2}`);
} finally {
  store.close();
  rmSync(tempDir, { recursive: true, force: true });
}
