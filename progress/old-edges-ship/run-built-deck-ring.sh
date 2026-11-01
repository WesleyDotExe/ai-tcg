#!/usr/bin/env bash
# The built-deck ring on the shipped cards (session 62: NA12 and CS7 shipped).
# The same steps as progress/old-edges/run-candidate.sh, on the main tree,
# with no erratum applied: the cards ARE the change now. Its report must equal
# session 61's progress/old-edges/built-NA12+CS7/report.txt.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
out=$root/progress/built-deck-ring-004
mkdir -p "$out"/builds "$out"/rings
(cd "$root/economy" && npx tsx src/dev/realisticCollections.ts > "$out/collections.json")
cd "$root/engine"
jobs=()
for level in full 37 17 3; do for f in Cortex Swarm Aegis Null; do
  jobs+=("build $level $f --collections $out/collections.json --out $out/builds/$level-$f.json")
done; done
printf '%s\n' "${jobs[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
rings=()
for level in full 37 17 3; do for m in real gate; do rings+=("ring $level --mode $m --builds $out/builds --out $out/rings/$level-$m.json"); done; done
printf '%s\n' "${rings[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
npx tsx src/dev/builtDeckRing.ts report --builds "$out/builds" --rings "$out/rings" > "$root/progress/built-deck-ring-004.txt"
echo "done"
