#!/bin/bash
# Fills in the two launch agents' paths and copies them to
# ~/Library/LaunchAgents (session 93; progress/mac-mini-guide.md, step 4).
#   bash server/launchd/install.sh <season file>
# It only writes the two files; it prints the launchctl commands that load
# them. Run it again (after unloading) to point the agents at another season
# file, e.g. after the season switch. LAUNCH_AGENTS_DIR and LOG_DIR override
# where the files and logs go (the dry run uses this; the guide doesn't).
set -euo pipefail
if [ $# -ne 1 ]; then
  echo "usage: bash server/launchd/install.sh <season file>" >&2
  exit 1
fi
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
case "$1" in
  /*) file="$1" ;;
  *) file="$(pwd)/$1" ;;
esac
if [ ! -f "$file" ]; then
  echo "no season file at \"$file\" (make one first: npm run season:setup -w server -- <file> ...)" >&2
  exit 1
fi
node="$(command -v node || true)"
if [ -z "$node" ]; then
  echo "node isn't on this terminal's PATH; install Node.js 22 first" >&2
  exit 1
fi
agents="${LAUNCH_AGENTS_DIR:-$HOME/Library/LaunchAgents}"
logs="${LOG_DIR:-$(dirname "$file")}"
mkdir -p "$agents" "$logs"
for name in season site; do
  sed -e "s|@NODE@|$node|g" -e "s|@REPO@|$repo|g" -e "s|@SEASON_FILE@|$file|g" -e "s|@LOG_DIR@|$logs|g" \
    "$here/local.ai-tcg.$name.plist" > "$agents/local.ai-tcg.$name.plist"
  echo "wrote $agents/local.ai-tcg.$name.plist"
done
echo "logs: $logs/season.log and $logs/site.log"
echo "load both now (and at every login from now on):"
echo "  launchctl bootstrap gui/\$(id -u) $agents/local.ai-tcg.season.plist"
echo "  launchctl bootstrap gui/\$(id -u) $agents/local.ai-tcg.site.plist"
