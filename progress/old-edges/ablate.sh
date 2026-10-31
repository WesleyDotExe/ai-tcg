#!/usr/bin/env bash
# Every shipped card's one-copy ablation on the ring, both modes, seeds from 1 (session 61).
set -euo pipefail
cd "$(dirname "$0")/../../engine"
out=../progress/old-edges/ablation
mkdir -p "$out"
npx tsx -e 'import { SHIPPED_DECK_LISTS } from "./src/data/registry.ts"; for (const l of Object.values(SHIPPED_DECK_LISTS)) for (const e of l) console.log(e.cardId);' | sort -u > "$out/ids.txt"
cp ../progress/old-edges/screen/shipped-1.json "$out/"
xargs -P 4 -I{} sh -c "npx tsx src/dev/oldEdgesScreen.ts run cut:{} 1 --out $out/cut:{}-1.json" < "$out/ids.txt"
