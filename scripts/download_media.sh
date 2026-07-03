#!/usr/bin/env bash
# Self-host the remaining Dota 2 static images (ability icons, hero landscape
# art, hero portraits, misc badges) as webp under apps/web/public.
# Large videos (hero renders, ability clips) are NOT self-hosted — ability
# clips alone are ~8-9MB each (~5GB total), so those stay on Valve's CDN.
set -e
cd "$(dirname "$0")/.."

PUB="apps/web/public"
IMG_CDN="https://cdn.cloudflare.steamstatic.com/apps/dota2/images"
IMG_CDN2="https://cdn.steamstatic.com/apps/dota2/images"

# Parallel download+convert helper: $1=url $2=out.webp $3=quality
fetch_webp() {
  local url="$1" out="$2" q="${3:-85}"
  [ -f "$out" ] && return 0
  local tmp; tmp="$(mktemp).src"
  if curl -sf "$url" -o "$tmp" 2>/dev/null; then
    cwebp -q "$q" -quiet "$tmp" -o "$out" 2>/dev/null || true
  fi
  rm -f "$tmp"
}
export -f fetch_webp

HERO_NAMES=$(curl -sf "https://api.opendota.com/api/heroes" | jq -r '.[].name | ltrimstr("npc_dota_hero_")')

echo "== Ability icons =="
ABIL_DIR="$PUB/abilities"; mkdir -p "$ABIL_DIR"
curl -sf "https://api.opendota.com/api/constants/abilities" \
  | jq -r 'to_entries[] | select(.value.img != null) | .key' \
  | xargs -P 10 -I {} bash -c 'fetch_webp "'"$IMG_CDN"'/dota_react/abilities/{}.png" "'"$ABIL_DIR"'/{}.webp" 85'
echo "   $(ls "$ABIL_DIR"/*.webp 2>/dev/null | wc -l | tr -d ' ') ability icons"

echo "== Hero landscape art =="
LAND_DIR="$PUB/landscape"; mkdir -p "$LAND_DIR"
echo "$HERO_NAMES" | xargs -P 10 -I {} bash -c 'fetch_webp "'"$IMG_CDN"'/dota_react/heroes/{}.png" "'"$LAND_DIR"'/{}.webp" 88'
echo "   $(ls "$LAND_DIR"/*.webp 2>/dev/null | wc -l | tr -d ' ') landscape images"

echo "== Hero portraits (_sb, _vert) =="
PORT_DIR="$PUB/portraits"; mkdir -p "$PORT_DIR"
echo "$HERO_NAMES" | xargs -P 10 -I {} bash -c 'fetch_webp "'"$IMG_CDN"'/heroes/{}_sb.png" "'"$PORT_DIR"'/{}_sb.webp" 88'
echo "$HERO_NAMES" | xargs -P 10 -I {} bash -c 'fetch_webp "'"$IMG_CDN"'/heroes/{}_vert.jpg" "'"$PORT_DIR"'/{}_vert.webp" 88'
echo "   $(ls "$PORT_DIR"/*.webp 2>/dev/null | wc -l | tr -d ' ') portraits"

echo "== Misc icons (aghs, innate, cooldown) =="
ICON_DIR="$PUB/dota_icons"; mkdir -p "$ICON_DIR"
fetch_webp "$IMG_CDN2/dota_react/heroes/stats/aghs_scepter.png" "$ICON_DIR/aghs_scepter.webp" 92
fetch_webp "$IMG_CDN2/dota_react/heroes/stats/aghs_shard.png" "$ICON_DIR/aghs_shard.webp" 92
fetch_webp "$IMG_CDN2/dota_react/icons/innate_icon.png" "$ICON_DIR/innate_icon.webp" 92
echo "   $(ls "$ICON_DIR"/*.webp 2>/dev/null | wc -l | tr -d ' ') icons"

echo "Done."
