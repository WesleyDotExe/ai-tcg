// Builds the Season 1 arena prototype page from a real match played through
// the engine (Season 0's own capture: render/src/replaySetup.ts). Fenced off
// in render/season1/ (owner 2026-11-14): this folder imports Season 0's
// render code, never the other way round.
//   npx tsx render/season1/src/build.ts [factionA] [factionB] [seed] [--signatures] [--tile]
// Writes render/season1/output/arena-<a>-vs-<b>[-sig]-seed<n>.html.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CARD_REGISTRY } from "@ai-tcg/engine";
import type { Card } from "@ai-tcg/engine";
import { STARTER_BOASTS, STARTER_COIN } from "@ai-tcg/economy";
import { DECK_BUILDERS, captureReplay } from "../../src/replaySetup.js";
import { allAbilities, type DeckFaction } from "../../src/engineInternal.js";
import type { MatchReplay } from "../../src/types.js";
import { renderArenaPage } from "./arenaPage.js";
import type { ArenaData } from "./arenaClient.js";
import type { Seat } from "./arenaModel.js";

/** cardId -> its rules text, for every card a replay can show: the registry
 * and the match's generated signature cards. */
export function cardTextFor(extra: Card[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (c: Card) => { out[c.id] = allAbilities(c).map((a) => a.text).filter((t) => t.length > 0); };
  for (const c of CARD_REGISTRY.values()) add(c);
  for (const c of extra) add(c);
  return out;
}

/** What the HUD says each side has equipped. A sample replay has no match
 * record (no owners, no loadouts): each side shows the free starter coin and
 * its own faction's starter boast, as Season 0's replay plays them. */
export function sampleLoadouts(replay: MatchReplay): ArenaData["loadouts"] {
  const one = (seat: Seat) => {
    const f = replay.factions[seat] as DeckFaction;
    return { coin: STARTER_COIN.name, boast: STARTER_BOASTS[f]?.name ?? "Starter boast", owner: null };
  };
  return { p1: one("p1"), p2: one("p2") };
}

export async function buildArena(a: DeckFaction, b: DeckFaction, seed: number, signatures: boolean, mode: ArenaData["mode"] = "full") {
  const { replay, seats } = await captureReplay(a, b, seed, signatures);
  const data: ArenaData = {
    replay,
    cardText: cardTextFor(seats ? [seats[0].card, seats[1].card] : []),
    loadouts: sampleLoadouts(replay),
    // Season 0 sells no card back: both sides show the standard back.
    backs: { p1: { itemId: null, name: "Standard back" }, p2: { itemId: null, name: "Standard back" } },
    mode,
    pov: "p1",
  };
  return { data, html: renderArenaPage(data) };
}

async function main() {
  const args = process.argv.slice(2);
  const signatures = args.includes("--signatures");
  const tile = args.includes("--tile");
  const [fa, fb, sd] = args.filter((x) => !x.startsWith("--"));
  const isF = (s: string | undefined): s is DeckFaction => !!s && s in DECK_BUILDERS;
  const a = isF(fa) ? fa : "Cortex", b = isF(fb) ? fb : "Aegis";
  const seed = sd ? Number(sd) : 2;
  const { data, html } = await buildArena(a, b, seed, signatures, tile ? "tile" : "full");
  const here = dirname(fileURLToPath(import.meta.url));
  const out = resolve(here, "../output", `arena-${a.toLowerCase()}-vs-${b.toLowerCase()}-${signatures ? "sig-" : ""}seed${seed}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html, "utf8");
  const last = data.replay.frames[data.replay.frames.length - 1]!;
  console.log(`${data.replay.agentNames.p1} vs ${data.replay.agentNames.p2}: ${data.replay.frames.length} frames, ${last.turnNumber} turns, winner ${last.winner ?? "none"}`);
  console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exitCode = 1; });
}
