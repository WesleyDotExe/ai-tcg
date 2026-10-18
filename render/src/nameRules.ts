// The agent-name rules, as the first-time page runs them (render session
// 29; owner 2026-10-19, call 5 of slice 3: "add a name field when the agent
// is created ... using the store's own name rules").
//
// The page doesn't copy the rules: it ships the store's own code. esbuild
// bundles economy/src/agentNames.ts (customAgentNameProblem, tidyAgentName)
// and the engine's blocked-word filter it imports (signatureNames.ts, only
// that file, by aliasing the engine package to it), plus the replay's
// avatar (avatar.ts), so a typed name gets the avatar its matches will draw.
// The bundle defines one global, FTN.
//
// What the page cannot check is what needs the store's database: a name
// another agent holds or held, or another owner's login username. On the
// site the store checks those when the card is made (confirmAgentDraft
// refuses, and the page says so); this demo's store is fresh, so they never
// refuse here. Read-only on the economy and the engine.

import { buildSync } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

let cached: string | undefined;

/** The bundled rules, as a script that defines `FTN`. */
export function nameRulesSource(): string {
  if (cached !== undefined) return cached;
  const entry = [
    `export { customAgentNameProblem, tidyAgentName, AGENT_NAME_MIN_LENGTH } from ${JSON.stringify(join(root, "economy", "src", "agentNames.ts"))};`,
    `export { AGENT_NAME_MAX_LENGTH } from ${JSON.stringify(join(root, "engine", "src", "data", "signatureNames.ts"))};`,
    `export { avatarSvg } from ${JSON.stringify(join(here, "avatar.ts"))};`,
  ].join("\n");
  const out = buildSync({
    stdin: { contents: entry, resolveDir: here, loader: "ts", sourcefile: "first-time-names.ts" },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "FTN",
    target: "es2019",
    platform: "browser",
    legalComments: "none",
    // Only the blocked-word filter, not the whole engine barrel.
    alias: { "@ai-tcg/engine": join(root, "engine", "src", "data", "signatureNames.ts") },
  });
  const text = out.outputFiles[0]!.text;
  // The page inlines it in a <script>; a "</script" inside would close it.
  if (/<\/script/i.test(text)) throw new Error("the name-rules bundle contains </script");
  cached = text;
  return text;
}
