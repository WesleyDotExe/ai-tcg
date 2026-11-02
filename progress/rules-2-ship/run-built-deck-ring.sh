#!/usr/bin/env bash
# The built-deck ring under rules-2 (session 71: the second seat starts on 24
# health). The same steps as progress/old-edges-ship/run-built-deck-ring.sh
# (session 62's built-deck-ring-004, under rules-1), on the same collections:
# the store's builder plays its trial games under the rules too, so the decks
# are rebuilt, not reused. Compare with built-deck-ring-004 (the same cards
# and collections, rules-1) and with session 68's c4 rings
# (progress/first-seat-fixes/built/*-c4.json: rules-2's rule on the rules-1
# builds).
set -euo pipefail
root=$(git rev-parse --show-toplevel)
out=$root/progress/built-deck-ring-005
mkdir -p "$out"/builds "$out"/rings
cp "$root/progress/built-deck-ring-004/collections.json" "$out/collections.json"
cd "$root/engine"
jobs=()
for level in full 37 17 3; do for f in Cortex Swarm Aegis Null; do
  jobs+=("build $level $f --collections $out/collections.json --out $out/builds/$level-$f.json")
done; done
printf '%s\n' "${jobs[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
rings=()
for level in full 37 17 3; do for m in real gate; do rings+=("ring $level --mode $m --builds $out/builds --out $out/rings/$level-$m.json"); done; done
printf '%s\n' "${rings[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
npx tsx src/dev/builtDeckRing.ts report --builds "$out/builds" --rings "$out/rings" > "$root/progress/built-deck-ring-005.txt"
echo "done"
