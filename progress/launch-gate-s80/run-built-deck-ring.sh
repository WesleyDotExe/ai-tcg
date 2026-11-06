#!/usr/bin/env bash
# The launch-gate re-run on the shipped builder (session 80; owner
# 2026-11-06: keepDesigned switched on for the store at 1 SD, then "the
# built-deck ring on the shipped builder (and both ring checks)"). The same
# steps, collections and seeds as progress/null-builder/run-built-deck-ring.sh
# (built-deck-ring-006-z1) and progress/rules-2-ship's (005), but with no
# --keep-designed: every build is the store's own (DEFAULT_BUILD, 1 SD).
# Usage: run-built-deck-ring.sh [name]  (default: built-deck-ring-007).
set -euo pipefail
root=$(git rev-parse --show-toplevel)
name=${1:-built-deck-ring-007}
out=$root/progress/$name
mkdir -p "$out"/builds "$out"/rings
cp "$root/progress/built-deck-ring-005/collections.json" "$out/collections.json"
cd "$root/engine"
jobs=()
for level in full 37 17 3; do for f in Cortex Swarm Aegis Null; do
  jobs+=("build $level $f --collections $out/collections.json --out $out/builds/$level-$f.json")
done; done
printf '%s\n' "${jobs[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
rings=()
for level in full 37 17 3; do for m in real gate; do rings+=("ring $level --mode $m --builds $out/builds --out $out/rings/$level-$m.json"); done; done
printf '%s\n' "${rings[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
npx tsx src/dev/builtDeckRing.ts report --builds "$out/builds" --rings "$out/rings" > "$root/progress/$name.txt"
echo "done"
