// Victory boasts, slice 3: replays of matches played through the economy
// store, each playing the boast its match record says played. Usage:
//   npm run recorded -w @ai-tcg/render [-- <summary.txt>]
// Writes render/output/recorded-*.html and prints (or writes) a summary of
// each scenario: the loadouts, how the season items were earned and
// bought, the record's boast and why it played.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CLOSE_WIN_HEALTH, COSMETICS, SEASON_0_BOASTS, STARTER_BOASTS } from "@ai-tcg/economy";
import { captureRecordedReplay, type RecordedScenario } from "./recordedMatch.js";
import { renderMatchHtml } from "./renderHtml.js";

const [BOOT, DIALUP] = SEASON_0_BOASTS.map((b) => b.itemId) as [string, string];

/** The four scenarios (seeds picked for their endings: a win on plenty of
 * health, a win on 3, a win on 14, a win on 7). */
export const RECORDED_SCENARIOS: (RecordedScenario & { about: string })[] = [
  {
    id: "recorded-boot-sequence",
    about: "a bought season boast in the main slot: the Cortex winner plays Boot Sequence, not its faction's Data Cascade",
    seed: 2,
    p1: { faction: "Cortex", agent: "Kestrel Nine", buy: [BOOT], loadout: { boast: BOOT } },
    p2: { faction: "Aegis", agent: "Velvet Static" },
  },
  {
    id: "recorded-close-win",
    about: `the close-win slot: the Swarm winner ends on ${CLOSE_WIN_HEALTH} health or less, so its close-win boast (Dial-Up Fireworks, bought) plays instead of its main boast (Hive Burst)`,
    seed: 5,
    p1: { faction: "Swarm", agent: "Moth Protocol", buy: [DIALUP], loadout: { closeWinBoast: DIALUP } },
    p2: { faction: "Null", agent: "Quiet Lattice" },
  },
  {
    id: "recorded-other-starter",
    about: "a free starter boast of another faction: the Aegis winner wears Void Collapse; its close-win boast (Hive Burst) is set but the win is not close",
    seed: 4,
    p1: { faction: "Aegis", agent: "Bastion Echo", loadout: { boast: STARTER_BOASTS.Null.itemId, closeWinBoast: STARTER_BOASTS.Swarm.itemId } },
    p2: { faction: "Swarm", agent: "Spore Relay" },
  },
  {
    id: "recorded-empty-slot",
    about: "an empty boast slot: the store records the deck faction's starter (Cortex's Data Cascade, slot factionStarter)",
    seed: 5,
    p1: { faction: "Null", agent: "Hollow Index" },
    p2: { faction: "Cortex", agent: "Prism Daemon", loadout: { boast: null } },
  },
];

async function main() {
  const name = new Map(COSMETICS.map((i) => [i.itemId, i.name]));
  const show = (id: string | null | undefined) => (id ? name.get(id) ?? id : "-");
  const here = dirname(fileURLToPath(import.meta.url));
  const out: string[] = [];
  const say = (l = "") => out.push(l);
  say("# Victory boasts, slice 3: replays read the boast from the match record");
  say();
  say("Each scenario runs through an in-memory economy store (fixed clock and seeds): starter collections");
  say("(with the four free starter boasts), an agent each, starter decks; season items earned in real");
  say("matches and bought; loadouts equipped; then the replayed match started with startMatch, captured");
  say("move by move and recorded with each side's final health. The replay plays the record's boast.");
  for (const scn of RECORDED_SCENARIOS) {
    const r = await captureRecordedReplay(scn);
    const file = resolve(here, "../output", `${scn.id}.html`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, renderMatchHtml(r.replay), "utf8");
    const last = r.replay.frames[r.replay.frames.length - 1]!;
    const rec = r.replay.record!;
    say();
    say(`## ${scn.id} (${scn.p1.faction} vs ${scn.p2.faction}, seed ${scn.seed})`);
    say(scn.about);
    say();
    if (r.earning.length) {
      const wins = (agentId: string) => r.earning.filter((m) => m.winnerAgentId === agentId).length;
      const days = new Set(r.earning.map((m) => m.endedAt.slice(0, 10))).size;
      say(`earning: ${r.earning.length} real matches over ${days} days (${scn.p1.agent} won ${wins(r.record.p1AgentId)}, ${scn.p2.agent} ${wins(r.record.p2AgentId)})`);
      for (const p of ["p1", "p2"] as const) for (const id of scn[p].buy ?? []) say(`bought: ${scn[p].agent} buys ${show(id)}; credits left ${r.credits[p]}`);
    } else say("earning: none (only free starter boasts)");
    for (const p of ["p1", "p2"] as const) {
      const l = rec.loadouts![p];
      say(`${p} ${scn[p].agent} (${scn[p].faction}): boast=${show(l.boast)}  closeWinBoast=${show(l.closeWinBoast)}`);
    }
    const w = last.winner;
    say(`match: ${r.replay.movesPlayed} moves over ${last.turnNumber} turns; ${w === "p1" || w === "p2" ? `${scn[w].agent} wins on ${last.players[w].health} health` : "draw"}`);
    say(`record ${rec.matchId}: boast ${rec.boast ? `${show(rec.boast.itemId)} (slot ${rec.boast.slot}, ${rec.boast.side}, winner on ${rec.boast.winnerHealth})` : "none"}`);
    say(`wrote render/output/${scn.id}.html`);
  }
  const text = out.join("\n") + "\n";
  const dest = process.argv[2];
  if (dest) writeFileSync(resolve(process.cwd(), dest), text, "utf8");
  process.stdout.write(text);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
