#!/usr/bin/env bash
# The built-deck ring for one candidate erratum of the balance session's job 2
# (session 61, test only). Generalises progress/null-forty/run-candidate.sh,
# which could only add copies to NULL_CARDS: this one applies any candidate
# in engine/src/dev/oldEdgesCandidates.ts, to any faction's cards.
#
# An erratum changes more than the ring's decks: the deck builder rates the
# changed card from its stats, the economy's starter collections and every
# realistic owner hold it, and every build is searched and confirmed against
# the shipped opponents. So, as in session 59, it runs everything on a
# throwaway git worktree with the card really changed, never committed.
# Nothing in the main tree changes.
#
#   progress/old-edges/run-candidate.sh <candidate key> <out dir>
#
# In the worktree: append applyCandidate(<key>) to engine/src/data/registry.ts
# and make data/decks.ts import the registry, so every process that builds
# a deck or reads a card sees the erratum (registry.ts and decks.ts are
# imported by the engine entry point, the deck builder, the economy and the
# dev tools); re-record the ring baselines (the report's "shipped decks"
# column is then the candidate's); regenerate the realistic collections;
# build every faction at full/37/17/3 with the store's settings; run the 8
# rings; print the report. A stop-check makes the economy show the erratum
# before anything is built. BUILD_ARGS/RING_ARGS (e.g. "--games 2") shrink a
# smoke run. About 20 minutes on 4 cores.
set -euo pipefail
key=$1; out=$2
root=$(git rev-parse --show-toplevel)
wt=${WT_DIR:-/tmp}/old-edges-$key
mkdir -p "$out"/builds "$out"/rings
out=$(cd "$out" && pwd)
git -C "$root" worktree remove --force "$wt" 2>/dev/null || true
git -C "$root" worktree add --detach "$wt" HEAD >/dev/null
# Its own node_modules: the third-party packages linked from the main tree,
# @ai-tcg/* pointing at the worktree's packages (session 59's lesson: a plain
# link resolves @ai-tcg/engine to the UNPATCHED main engine).
mkdir "$wt/node_modules"
for e in "$root"/node_modules/* "$root"/node_modules/.bin; do
  [ "$(basename "$e")" = "@ai-tcg" ] || ln -s "$e" "$wt/node_modules/$(basename "$e")"
done
cp -P -r "$root/node_modules/@ai-tcg" "$wt/node_modules/@ai-tcg"
# The dev files may be newer than HEAD (this session's own); use the main tree's.
cp "$root/engine/src/dev/oldEdgesCandidates.ts" "$wt/engine/src/dev/"

reg="$wt/engine/src/data/registry.ts"
printf '\n// old-edges candidate (throwaway worktree only)\nimport { applyCandidate } from "../dev/oldEdgesCandidates.js";\napplyCandidate("%s", getCard);\n' "$key" >> "$reg"
sed -i '0,/^import /s//import ".\/registry.js";\nimport /' "$wt/engine/src/data/decks.ts"
(cd "$wt" && git diff) > "$out/patch.diff"

cd "$wt/engine"
# Stop-check: the economy (through @ai-tcg/engine) sees the erratum.
(cd "$wt/economy" && npx tsx -e 'import { getCard } from "@ai-tcg/engine"; import { candidateLabel } from "../engine/src/dev/oldEdgesCandidates.ts"; console.log(candidateLabel(process.argv[1])); for (const id of ["NL-015","CX-019","NL-014","NL-018","NL-004","NL-009","AG-013","NL-013","CX-005","CX-020","CX-013","CX-023","CX-021","CX-024"]) { const c = getCard(id); const t = (c.modes ?? [{ name: "-", text: c.abilities.map((a) => a.text).join(" | ") }]).map((m) => `[${m.name}] ${m.text}`).join(" / "); console.log(id, c.name, "cost", c.cost, c.type === "Unit" ? `${c.attack}/${c.health}` : "", t); }' "$key") > "$out/stop-check.txt"
cat "$out/stop-check.txt"
# ...and fail unless the cards it sees differ from the unpatched main tree's.
fp='import { CARD_REGISTRY } from "@ai-tcg/engine"; import { createHash } from "node:crypto"; console.log(createHash("sha256").update(JSON.stringify([...CARD_REGISTRY.values()])).digest("hex"));'
patched=$(cd "$wt/economy" && npx tsx -e "$fp")
shipped=$(cd "$root/economy" && npx tsx -e "$fp")
[ "$patched" != "$shipped" ] || { echo "the economy sees the shipped cards, not candidate $key" >&2; exit 1; }
echo "cards seen by the economy: $patched (shipped: $shipped)" >> "$out/stop-check.txt"
npx tsx src/dev/ringRegression.ts --write-baseline > "$out/ring-gate.txt" 2>&1
npx tsx src/dev/ringRegression.ts --real --write-baseline > "$out/ring-real.txt" 2>&1
(cd "$wt/economy" && npx tsx src/dev/realisticCollections.ts > "$out/collections.json")

jobs=()
for level in ${LEVELS:-full 37 17 3}; do
  for f in Cortex Swarm Aegis Null; do
    jobs+=("build $level $f --collections $out/collections.json --out $out/builds/$level-$f.json ${BUILD_ARGS:-}")
  done
done
printf '%s\n' "${jobs[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
rings=()
for level in ${LEVELS:-full 37 17 3}; do for m in real gate; do rings+=("ring $level --mode $m --builds $out/builds --out $out/rings/$level-$m.json ${RING_ARGS:-}"); done; done
printf '%s\n' "${rings[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
npx tsx src/dev/builtDeckRing.ts report --builds "$out/builds" --rings "$out/rings" > "$out/report.txt"
cd "$root"
git worktree remove --force "$wt"
echo "done: $out/report.txt"
