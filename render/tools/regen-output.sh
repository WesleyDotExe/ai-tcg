#!/usr/bin/env bash
# Rebuilds every committed page under render/output/ from the current code
# and the current engine (render session 54, a hardening pass: the pages had
# gone four sessions without a rebuild and still played the old intro).
# Run from anywhere:  npm run outputs -w @ai-tcg/render
# Each replay page plays its match again through the engine, so a rules or
# card change on the game lane changes those pages' matches too; the file
# names (factions and seed) stay the same.
set -euo pipefail
cd "$(dirname "$0")/.."
run() { echo "== $*"; npx tsx "$@" 2>&1 | grep -v -e ExperimentalWarning -e trace-warnings || true; }

# The replays: <a>-vs-<b>[-sig]-seed<n>.html, played again by the CLI.
for f in output/*-vs-*-seed*.html; do
  base=$(basename "$f" .html)
  a=${base%%-vs-*}; rest=${base#*-vs-}; b=${rest%%-*}
  seed=${base##*seed}
  sig=""; case "$base" in *-sig-seed*) sig="--signatures" ;; esac
  cap() { echo "$(tr '[:lower:]' '[:upper:]' <<<"${1:0:1}")${1:1}"; }
  run src/cli.ts "$(cap "$a")" "$(cap "$b")" "$seed" $sig
done

run src/recordedDemo.ts
run src/boastSheet.ts
run src/bootSheet.ts
run src/skinSheet.ts
run src/fxSheet.ts
run src/faceSheet.ts
run src/packDemo.ts
run src/firstTimeDemo.ts
run src/loadoutDemo.ts
run src/site/sitePage.ts
