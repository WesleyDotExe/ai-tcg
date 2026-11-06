#!/usr/bin/env bash
# The test-only Null deck-builder session (session 79; owner 2026-11-03 on
# session 71's call 1): the built-deck ring with the builder's keepDesigned
# rule (the designed start is kept unless another deck beats it by more than
# 2 standard deviations, paired, on the confirm seeds). The same steps,
# collections and seeds as progress/rules-2-ship/run-built-deck-ring.sh
# (built-deck-ring-005, the one to beat); only `--keep-designed $z` differs.
# The store's builder is unchanged: this only measures.
# Usage: run-built-deck-ring.sh [z] [name]  (defaults: 2, built-deck-ring-006;
# session 79 also ran 1 as built-deck-ring-006-z1).
set -euo pipefail
root=$(git rev-parse --show-toplevel)
z=${1:-2}
name=${2:-built-deck-ring-006}
out=$root/progress/$name
mkdir -p "$out"/builds "$out"/rings
cp "$root/progress/built-deck-ring-005/collections.json" "$out/collections.json"
cd "$root/engine"
jobs=()
for level in full 37 17 3; do for f in Cortex Swarm Aegis Null; do
  jobs+=("build $level $f --keep-designed $z --collections $out/collections.json --out $out/builds/$level-$f.json")
done; done
printf '%s\n' "${jobs[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
rings=()
for level in full 37 17 3; do for m in real gate; do rings+=("ring $level --mode $m --builds $out/builds --out $out/rings/$level-$m.json"); done; done
printf '%s\n' "${rings[@]}" | xargs -P 4 -I{} sh -c 'npx tsx src/dev/builtDeckRing.ts {} 2>/dev/null'
npx tsx src/dev/builtDeckRing.ts report --builds "$out/builds" --rings "$out/rings" > "$root/progress/$name.txt"
echo "done"
