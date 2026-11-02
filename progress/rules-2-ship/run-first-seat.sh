#!/usr/bin/env bash
# The first seat under rules-2 against rules-1 (session 71), with session
# 68's instruments on the same seeds: the shipped-deck mirrors, the ring
# check and the ladder's seat split, plus the built-deck ring from
# built-deck-ring-005 (run-built-deck-ring.sh; decks rebuilt under rules-2).
# The "shipped" rows must equal session 68's "c4" rows where nothing but the
# rule differs (the mirrors and the ring check); rules-1 must equal session
# 68's "shipped" rows.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
out=$root/progress/first-seat-rules-2
mkdir -p "$out"/mirrors "$out"/ring "$out"/ladder "$out"/built
cp "$root"/progress/built-deck-ring-005/rings/*.json "$out"/built/
cd "$root/engine"
jobs=()
for v in shipped rules-1; do
  jobs+=("cd $root/engine && npx tsx src/dev/firstSeatFixes.ts mirrors $v > $out/mirrors/$v.json")
  jobs+=("cd $root/engine && npx tsx src/dev/firstSeatFixes.ts ring $v gate > $out/ring/$v-gate.json")
  jobs+=("cd $root/engine && npx tsx src/dev/firstSeatFixes.ts ring $v real > $out/ring/$v-real.json")
  jobs+=("cd $root/server && npx tsx src/dev/firstSeatLadder.ts $v > $out/ladder/$v.json")
done
printf '%s\n' "${jobs[@]}" | xargs -P 4 -I{} sh -c '{} 2>/dev/null'
npx tsx src/dev/firstSeatFixes.ts report "$out" > "$root/progress/first-seat-003-rules-2.txt"
echo "done"
