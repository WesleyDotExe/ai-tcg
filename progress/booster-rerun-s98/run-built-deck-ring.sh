#!/usr/bin/env bash
# The Season 0 booster cards' balance re-run (session 98, build step 4;
# owner 2026-11-14, calls 3 and 8). The same steps and seeds as
# progress/launch-gate-s80/run-built-deck-ring.sh (built-deck-ring-007, the
# last ring before the booster cards), on the collections session 97 re-made
# from S0-odds-3 packs (progress/built-deck-ring/collections.json, booster
# pulls in), with the store's own builder (DEFAULT_BUILD, 1 SD). The "full"
# level holds every live card, so all 28 booster cards are in its pool.
# Usage: run-built-deck-ring.sh [name]  (default: built-deck-ring-008).
set -euo pipefail
root=$(git rev-parse --show-toplevel)
name=${1:-built-deck-ring-008}
out=$root/progress/$name
mkdir -p "$out"/builds "$out"/rings
cp "$root/progress/built-deck-ring/collections.json" "$out/collections.json"
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
