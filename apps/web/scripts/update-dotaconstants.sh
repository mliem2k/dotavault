#!/bin/sh
# Refresh the vendored dotaconstants JSON files from the installed package.
# (The package's exports map blocks subpath imports, and importing its root
# would pull megabytes of unused data into the bundle, so we vendor the few
# small files we actually use.)
set -e
cd "$(dirname "$0")/.."
for f in cluster region game_mode lobby_type player_colors order_types; do
  cp "node_modules/dotaconstants/build/$f.json" "src/lib/dotaconstants/$f.json"
done
echo "vendored dotaconstants files refreshed"
