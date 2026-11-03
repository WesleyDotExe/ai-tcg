// Evidence for session 72: the live-feed asks (the owner's answers to render
// sessions 51 and 53) over HTTP, on a real port, from the long-lived ladder
// on a fake clock. What `GET /api/live` and `GET /api/live/:id` now send:
//   - each side's deck faction (`LiveSideView.faction`);
//   - the opening hands, by card id in hand order, beside `start`;
//   - the signature card in full in `PublicSide.signature`, with
//     `timesPlayed`, `inZone` and `nextCost`;
//   - the boast once the last move is out, the one the record then keeps.
// Every match is watched through its feed alone (from=0, then from=released
// each second), and what a spectator would rebuild from it is checked
// against the engine's own events and the recorded match.
//
//   npx tsx src/dev/liveFeedAsksDemo.ts > ../progress/live-feed-asks-001.txt
//
// Ids are replaced by names, so the output is the same every run.

import { getCard, type GameEvent } from "@ai-tcg/engine";
import { EconomyStore } from "@ai-tcg/economy";
import { startOwnerApi, type RunningOwnerApi } from "../ownerApi.js";
import { LiveLadder } from "../ladder/liveLadder.js";

const say = (line = "") => console.log(line);
const PASSWORD = "a long demo password";
const names = new Map<string, string>();
const redact = (text: string) =>
  text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => {
    if (!names.has(id)) names.set(id, `<id ${names.size}>`);
    return names.get(id)!;
  });
const section = (title: string) => {
  say();
  say(title);
  say("-".repeat(72));
};
const checks: [string, boolean][] = [];
const check = (what: string, ok: boolean) => checks.push([what, ok]);

const clock = { t: Date.parse("2026-11-03T22:00:00.000Z") };
let api: RunningOwnerApi | null = null;
let token = "";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get(path: string, loud = false): Promise<any> {
  const res = await fetch(`http://localhost:${api!.port}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (loud) say(redact(`> GET ${path}  -> ${res.status}`));
  return res.status === 200 ? res.json() : { status: res.status, ...(await res.json()) };
}

const store = EconomyStore.open(":memory:", { now: () => new Date(clock.t) });
try {
  say("Live-feed asks demo 001 — the opening hands, the signature card, the faction, the boast (session 72)");
  say("=".repeat(72));

  // Four house owners, one per faction, each with a generated agent (the
  // draft), so every side brings its own signature card. One close-win
  // boast equipped (Aegis's owner wears Swarm's starter boast for it).
  const factions = ["Cortex", "Swarm", "Aegis", "Null"] as const;
  for (const [i, f] of factions.entries()) {
    const o = store.createOwner({ name: `house-${f.toLowerCase()}`, kind: "house" });
    names.set(o.ownerId, `<owner ${f}>`);
    store.grantStarterCollection(o.ownerId, f);
    const draft = store.startAgentDraft(o.ownerId, { seed: 10 + i });
    store.pickDraftAgent(o.ownerId, draft.draftId, 0, { seed: 20 + i });
    const { agent } = store.confirmAgentDraft(o.ownerId, draft.draftId, 0, { artSlot: 1 });
    names.set(agent.agentId, `<agent ${agent.name}>`);
    store.connectAgent(o.ownerId, agent.agentId);
    if (f === "Aegis") store.setLoadout(o.ownerId, agent.agentId, "closeWinBoast", "boast-swarm-hive-burst");
  }
  let n = 0;
  const live = new LiveLadder({ store, seed: 72, build: { games: 0 }, matchId: () => `demo-${++n}`, now: () => clock.t, roundGapMs: 30_000, housePacks: false });
  api = await startOwnerApi({ store, port: 0, live });
  // A spectator: a player account with no agent, so it is never paired.
  store.createAccount({ name: "Viewer", username: "viewer", password: PASSWORD, kind: "player" });
  const signIn = await fetch(`http://localhost:${api.port}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: "viewer", password: PASSWORD }) });
  token = ((await signIn.json()) as { token: string }).token;

  // Three rounds (two matches each). Every match is watched through its
  // feed alone: from=0 when it appears, then from=<released> each second.
  const ids: string[] = [];
  const views = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  const watched = new Map<string, { feed: any; steps: any[]; boastsBefore: unknown[]; boastAtEnd: unknown; ended: boolean }>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  let later: { status?: number } = {};
  for (let round = 1; round <= 3; round++) {
    await live.tick();
    const list = await get("/api/live", round === 1);
    for (const m of list.matches) {
      ids.push(m.matchId);
      views.set(m.matchId, m);
      const f0 = await get(`/api/live/${m.matchId}?from=0`, round === 1);
      watched.set(m.matchId, { feed: f0, steps: [...f0.steps], boastsBefore: [], boastAtEnd: undefined, ended: false });
    }
    while (live.liveMatches().length > 0) {
      clock.t += 1000;
      await live.tick();
      for (const id of ids) {
        const w = watched.get(id)!;
        if (w.ended) continue;
        const f = await get(`/api/live/${id}?from=${w.steps.length}`);
        if (f.status === 404) {
          w.ended = true;
          continue;
        }
        w.steps.push(...f.steps);
        if (f.nextAt !== null) w.boastsBefore.push(f.boast);
        else w.boastAtEnd = f.boast;
      }
    }
    if (round === 1) later = await get(`/api/live/${ids[0]}?from=0`);
    clock.t += 30_000;
  }

  section("1. GET /api/live: each side's deck faction, known from the start");
  for (const id of ids) {
    const m = views.get(id);
    say(redact(`  ${m.matchId}: p1 ${m.p1.agentName} (${m.p1.ownerName}) ${m.p1.faction}  vs  p2 ${m.p2.agentName} (${m.p2.ownerName}) ${m.p2.faction};  boast ${JSON.stringify(m.boast)}`));
    for (const side of [m.p1, m.p2]) check(`${m.matchId}: ${side.ownerName}'s faction is its starter deck's`, side.ownerName === `house-${side.faction.toLowerCase()}`);
  }

  section("2. GET /api/live/:id?from=0: the opening hands beside the start; the signature cards");
  for (const id of ids) {
    const f0 = watched.get(id)!.feed;
    for (const seat of ["p1", "p2"] as const) {
      const hand: string[] = f0.openingHands[seat];
      say(`  ${id} ${seat} opening hand (${hand.length}, start shows ${f0.start[seat].hand}): ${hand.map((c) => `${c} "${getCard(c)?.name}"`).join(", ")}`);
      const sig = f0.start[seat].signature;
      if (id === ids[0] || id === ids[1]) say(`  ${id} ${seat} signature: ${JSON.stringify(sig)}`);
      check(`${id} ${seat}: opening hand length matches the start's hand count`, hand.length === f0.start[seat].hand);
      check(`${id} ${seat}: the signature card is in its zone, unplayed, at its printed cost`, sig !== null && sig.inZone && sig.timesPlayed === 0 && sig.nextCost === sig.cost);
    }
  }

  section("3. The signature card through each match, as the feed showed it");
  for (const id of ids) {
    const { feed, steps } = watched.get(id)!;
    const snaps = [feed.start, ...steps.map((s) => s.after)];
    let agree = true;
    for (const [i, step] of steps.entries()) {
      for (const seat of ["p1", "p2"] as const) {
        const before = snaps[i][seat].signature;
        const after = step.after[seat].signature;
        for (const e of step.events as GameEvent[]) {
          if (e.type === "play" && e.player === seat && e.fromSignatureZone) {
            say(`  ${id} move ${step.n}: ${seat} plays ${e.card} for ${e.cost} (the feed's nextCost before the move: ${before.nextCost}); timesPlayed ${before.timesPlayed} -> ${after.timesPlayed}, inZone ${after.inZone}`);
            if (e.cost !== before.nextCost) agree = false;
          }
          if (e.type === "signatureReturn" && e.player === seat) {
            say(`  ${id} move ${step.n}: ${seat}'s ${e.card} returns to its zone; the engine's next cost ${e.nextCost}, the feed's nextCost ${after.nextCost}, inZone ${after.inZone}`);
            if (e.nextCost !== after.nextCost || !after.inZone) agree = false;
          }
        }
      }
    }
    check(`${id}: every signature play cost what the feed's nextCost said, every return matches the engine's next cost`, agree);
  }

  section("4. The hands a spectator rebuilds from the feed: the opening hand, the named draws, the cards played");
  for (const id of ids) {
    const { feed, steps } = watched.get(id)!;
    for (const seat of ["p1", "p2"] as const) {
      const hand: string[] = feed.openingHands[seat].map((c: string) => getCard(c)!.name);
      let ok = true;
      let taken = 0;
      const take = (card: string) => {
        const i = hand.indexOf(card);
        if (i < 0) ok = false;
        else hand.splice(i, 1);
        taken++;
      };
      for (const step of steps) {
        for (const e of step.events as GameEvent[]) {
          if (!("player" in e) || e.player !== seat) continue;
          if (e.type === "draw") hand.push(e.card);
          else if (e.type === "play" && !e.fromSignatureZone) take(e.card);
          else if (e.type === "cast" && e.sourceId === undefined) take(e.card);
          else if (e.type === "evolve") take(e.to);
          else if (e.type === "toolAttached") take(e.tool);
        }
        if (hand.length !== step.after[seat].hand) ok = false;
      }
      say(`  ${id} ${seat}: ${taken} cards left the hand over ${steps.length} moves; at the end it holds ${hand.length} (the feed's count ${steps.at(-1).after[seat].hand}): ${hand.join(", ") || "(empty)"}`);
      check(`${id} ${seat}: every card played was in the rebuilt hand, and its size matched the feed's count after every move`, ok);
    }
  }

  section("5. The boast: null while moves remain, then the record's, once the last move is out");
  for (const id of ids) {
    const w = watched.get(id)!;
    const rec = await get(`/api/matches/${id}`, true);
    say(redact(`  ${id}: ${rec.outcome}, final move ${w.steps.length}; boast while moves remained: ${[...new Set(w.boastsBefore.map((b) => JSON.stringify(b)))].join(", ")} (${w.boastsBefore.length} polls)`));
    say(redact(`  ${id}: live boast once the last move was out: ${JSON.stringify(w.boastAtEnd)}`));
    say(redact(`  ${id}: the recorded match's boast:          ${JSON.stringify(rec.boast)}`));
    check(`${id}: no boast before the last move`, w.boastsBefore.every((b) => b === null));
    check(`${id}: the live boast is the recorded one`, JSON.stringify(w.boastAtEnd) === JSON.stringify(rec.boast));
  }
  check("the feed answers 404 once a match is recorded", later.status === 404);

  section("Checks");
  for (const [what, ok] of checks) say(`  ${ok ? "PASS" : "FAIL"}  ${what}`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
} finally {
  await api?.close();
  store.close();
}
