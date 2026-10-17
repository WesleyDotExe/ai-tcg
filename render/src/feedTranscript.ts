// Writes the match feed of the committed replays as plain text, for
// evidence (render sessions 22-23): a summary of all of them, and the whole
// feed of two. Usage: npm run feed-transcript -w @ai-tcg/render
// Each replay is captured afresh from the engine with the same setup as
// cli.ts (replaySetup.ts), so the text matches render/output/.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameEvent } from "@ai-tcg/engine";
import type { DeckFaction } from "./engineInternal.js";
import { feedText } from "./feed.js";
import { captureReplay } from "./replaySetup.js";

const REPLAYS: [DeckFaction, DeckFaction, number, boolean][] = [
  ["Aegis", "Aegis", 1, false], ["Aegis", "Cortex", 1, false], ["Aegis", "Cortex", 3, false], ["Aegis", "Cortex", 6, false],
  ["Aegis", "Null", 3, false], ["Cortex", "Aegis", 2, true], ["Cortex", "Aegis", 5, true], ["Cortex", "Null", 5, false],
  ["Cortex", "Swarm", 11, false], ["Cortex", "Swarm", 6, false], ["Null", "Cortex", 4, false], ["Null", "Swarm", 2, false],
  ["Swarm", "Aegis", 8, false], ["Swarm", "Null", 8, false],
];
const FULL = new Set(["cortex-vs-aegis-sig-seed5", "aegis-vs-cortex-seed1"]);

const here = dirname(fileURLToPath(import.meta.url));
const evidence = resolve(here, "../../progress/render/evidence");
const summary: string[] = [
  "# Match feed summary over the 14 committed replays (render session 23)",
  "# raw = engine log lines; feed = feed entries; quiet = triggers the feed dropped because they",
  "# changed nothing (the board skips their cast flourish too, since render session 23);",
  "# fizzles and the end line as the feed words them.",
  "",
];
let rawTotal = 0, feedTotal = 0, quietTotal = 0;
for (const [a, b, seed, sig] of REPLAYS) {
  const { replay: r } = await captureReplay(a, b, seed, sig);
  const slug = `${a.toLowerCase()}-vs-${b.toLowerCase()}-${sig ? "sig-" : ""}seed${seed}`;
  const names = { names: r.agentNames };
  const raw = r.frames.reduce((n, f) => n + f.newEvents.length, 0);
  const lines = r.frames.flatMap((f) => f.feed!.map((e) => ({ move: f.index, text: feedText(e, names) })));
  const quiet = new Map<string, number>();
  for (const f of r.frames) {
    for (const k of f.quietTriggers ?? []) {
      const e = f.newEvents[k]!.event as Extract<GameEvent, { type: "abilityTrigger" }>;
      quiet.set(e.source, (quiet.get(e.source) ?? 0) + 1);
    }
  }
  const q = [...quiet.values()].reduce((x, y) => x + y, 0);
  rawTotal += raw; feedTotal += lines.length; quietTotal += q;
  summary.push(`${slug}: ${r.agentNames.p1} vs ${r.agentNames.p2}, ${r.movesPlayed} moves`);
  summary.push(`  raw ${raw}, feed ${lines.length} (${Math.round((lines.length / raw) * 100)}%), quiet ${q}${q ? ": " + [...quiet].map(([c, n]) => `${c} ×${n}`).join(", ") : ""}`);
  for (const l of lines.filter((l) => l.text.includes("fizzles"))) summary.push(`  move ${l.move}: ${l.text.trim()}`);
  summary.push(`  end: ${lines[lines.length - 1]!.text}`);
  if (FULL.has(slug)) {
    const out = [
      `# Match feed of render/output/${slug}.html (render session 23)`,
      `# ${r.agentNames.p1} vs ${r.agentNames.p2}; ${r.movesPlayed} moves; engine log ${raw} lines, feed ${lines.length} entries.`,
      "# Left column: the move the entry appears on. Indent: turn header, then actions, then results.",
      ...lines.map((l) => `${String(l.move).padStart(3)}  ${l.text}`),
    ];
    writeFileSync(resolve(evidence, `v2-s23-feed-${slug}.txt`), out.join("\n") + "\n");
  }
}
// None of the committed replays has a fizzle; these matches do (found by
// scanning every pairing over seeds 1-12). Each fizzle's move, with the
// feed of the moves around it.
const FIZZLES: [DeckFaction, DeckFaction, number][] = [["Cortex", "Aegis", 1], ["Aegis", "Cortex", 9], ["Null", "Aegis", 3]];
summary.push("", "## Fizzles in real matches (not among the committed replays)");
for (const [a, b, seed] of FIZZLES) {
  const { replay: r } = await captureReplay(a, b, seed, false);
  const at = r.frames.find((f) => f.newEvents.some((e) => e.event.type === "fizzle"))!.index;
  summary.push("", `${a} vs ${b} seed ${seed}, fizzle on move ${at}:`);
  for (const f of r.frames.filter((f) => f.index >= at - 4 && f.index <= at)) {
    for (const e of f.feed!) summary.push(`${String(f.index).padStart(5)}  ${feedText(e, { names: r.agentNames })}`);
  }
}

summary.push("", `total: raw ${rawTotal}, feed ${feedTotal} (${Math.round((feedTotal / rawTotal) * 100)}%), quiet triggers ${quietTotal}`);
writeFileSync(resolve(evidence, "v2-s23-feed-summary.txt"), summary.join("\n") + "\n");
console.log(summary.join("\n"));
