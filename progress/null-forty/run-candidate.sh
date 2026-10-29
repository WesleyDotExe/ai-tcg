#!/usr/bin/env bash
# The built-deck ring for one candidate 40-card Null list (session 59, test only).
#
# A candidate changes more than Null's ring deck: the shipped list is also the
# Null starter collection (so every realistic Null owner holds the 4 cards),
# the deck builder's designed start, one of the four shipped opponents every
# build is searched and confirmed against, and a fifth of the cost curve the
# rating start is shaped to. So the only honest way to measure it is to run
# everything on a copy of the repo with the list actually changed: a
# throwaway git worktree, never committed. Nothing in the main tree changes.
#
#   progress/null-forty/run-candidate.sh <label> <card ids, comma-separated> <out dir>
#
# In the worktree: patch NULL_CARDS (one more copy per id; a neutral card is
# imported and appended), re-record the ring baselines (so the report's
# "shipped decks" column is the candidate's 40), regenerate the realistic
# collections, build every faction at full/37/17/3 with the store's settings,
# run the 8 rings and print the report. (BUILD_ARGS/RING_ARGS, e.g. "--games 2", shrink a smoke run.) About 6-7 minutes on 4 cores.
set -euo pipefail
label=$1; adds=$2; out=$3
root=$(git rev-parse --show-toplevel)
wt=${WT_DIR:-/tmp}/null-forty-$label
mkdir -p "$out"/builds "$out"/rings
out=$(cd "$out" && pwd)
git -C "$root" worktree remove --force "$wt" 2>/dev/null || true
git -C "$root" worktree add --detach "$wt" HEAD >/dev/null
# Its own node_modules: the third-party packages linked from the main tree,
# but @ai-tcg/* pointing at the worktree's packages (a plain link to the main
# node_modules would resolve @ai-tcg/engine to the UNPATCHED main engine, so
# the economy's starter collections would still be the 36).
mkdir "$wt/node_modules"
for e in "$root"/node_modules/* "$root"/node_modules/.bin; do
  [ "$(basename "$e")" = "@ai-tcg" ] || ln -s "$e" "$wt/node_modules/$(basename "$e")"
done
cp -P -r "$root/node_modules/@ai-tcg" "$wt/node_modules/@ai-tcg"

node - "$wt/engine/src/data/nullCards.ts" "$wt/engine/src/data/neutralCards.ts" "$adds" <<'EOF'
const fs = require("fs");
const [file, neutralFile, adds] = process.argv.slice(2);
let src = fs.readFileSync(file, "utf8");
const neutral = fs.readFileSync(neutralFile, "utf8");
const constFor = (text, id) => {
  const m = text.match(new RegExp(`export const (\\w+): \\w+ = \\{\\n  id: "${id}"`));
  return m && m[1];
};
const extra = [];
for (const id of adds.split(",")) {
  const name = constFor(src, id);
  if (name) {
    const re = new RegExp(`\\{ card: ${name}, copies: (\\d) \\}`);
    if (!re.test(src)) throw new Error(`${name} is not in NULL_CARDS`);
    src = src.replace(re, (_, n) => `{ card: ${name}, copies: ${Number(n) + 1} }`);
    continue;
  }
  const n = constFor(neutral, id);
  if (!n) throw new Error(`no Null or neutral card ${id}`);
  const re = new RegExp(`\\{ card: ${n}, copies: (\\d) \\}`);
  if (re.test(src)) src = src.replace(re, (_, k) => `{ card: ${n}, copies: ${Number(k) + 1} }`);
  else { extra.push(n); src = src.replace(/\n\];\s*$/, `\n  { card: ${n}, copies: 1 },\n];\n`); }
}
if (extra.length) src = src.replace(/(import type [^\n]+\n)/, `$1import { ${[...new Set(extra)].join(", ")} } from "./neutralCards.js";\n`);
fs.writeFileSync(file, src);
EOF
(cd "$wt" && git diff --stat && git diff) > "$out/patch.diff"

cd "$wt/engine"
npx tsx src/dev/ringRegression.ts --write-baseline > "$out/ring-gate.txt" 2>&1
npx tsx src/dev/ringRegression.ts --real --write-baseline > "$out/ring-real.txt" 2>&1
(cd "$wt/economy" && npx tsx src/dev/realisticCollections.ts > "$out/collections.json")
# Check the economy saw the patched list (the starter it grants is the 40).
n=$(cd "$wt/economy" && npx tsx -e 'import { SHIPPED_DECK_LISTS } from "@ai-tcg/engine"; console.log(SHIPPED_DECK_LISTS.Null.reduce((s, e) => s + e.copies, 0));')
[ "$n" = 40 ] || { echo "the economy sees a $n-card Null list, not the patched 40" >&2; exit 1; }

jobs=()
for level in full 37 17 3; do
  for f in Cortex Swarm Aegis Null; do
    jobs+=("build $level $f --collections $out/collections.json --out $out/builds/$level-$f.json ${BUILD_ARGS:-}")
  done
done
printf '%s\n' "${jobs[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
rings=()
for level in full 37 17 3; do for m in real gate; do rings+=("ring $level --mode $m --builds $out/builds --out $out/rings/$level-$m.json ${RING_ARGS:-}"); done; done
printf '%s\n' "${rings[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
npx tsx src/dev/builtDeckRing.ts report --builds "$out/builds" --rings "$out/rings" > "$out/report.txt"
cd "$root"
git worktree remove --force "$wt"
echo "done: $out/report.txt"
