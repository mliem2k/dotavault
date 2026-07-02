#!/usr/bin/env bash
set -e

HERO_DIR="apps/web/public/heroes"
RANK_DIR="apps/web/public/ranks"
HERO_CDN="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons"
RANK_CDN="https://www.opendota.com/assets/images/dota2/rank_icons"

mkdir -p "$HERO_DIR" "$RANK_DIR"

echo "Fetching hero list..."
HERO_NAMES=$(curl -sf "https://api.opendota.com/api/heroes" | \
  jq -r '.[].name | ltrimstr("npc_dota_hero_")')

total=$(echo "$HERO_NAMES" | wc -l | tr -d ' ')
count=0

for hero in $HERO_NAMES; do
  count=$((count + 1))
  out="$HERO_DIR/${hero}.webp"
  if [ -f "$out" ]; then
    echo "[$count/$total] skip $hero (exists)"
    continue
  fi
  tmp="/tmp/dv_hero_${hero}.png"
  if curl -sf "${HERO_CDN}/${hero}.png" -o "$tmp"; then
    cwebp -q 85 -quiet "$tmp" -o "$out"
    rm -f "$tmp"
    echo "[$count/$total] $hero"
  else
    echo "[$count/$total] WARN: failed to download $hero"
  fi
done

echo ""
echo "Downloading rank medal icons (tiers 1-8)..."
for tier in 1 2 3 4 5 6 7 8; do
  out="$RANK_DIR/rank_icon_${tier}.webp"
  if [ -f "$out" ]; then
    echo "  skip rank_icon_${tier} (exists)"
    continue
  fi
  tmp="/tmp/dv_rank_icon_${tier}.png"
  if curl -sf "${RANK_CDN}/rank_icon_${tier}.png" -o "$tmp"; then
    cwebp -q 90 -quiet "$tmp" -o "$out"
    rm -f "$tmp"
    echo "  rank_icon_${tier}"
  else
    echo "  WARN: failed rank_icon_${tier}"
  fi
done

echo ""
echo "Downloading rank star overlays (1-5)..."
for stars in 1 2 3 4 5; do
  out="$RANK_DIR/rank_star_${stars}.webp"
  if [ -f "$out" ]; then
    echo "  skip rank_star_${stars} (exists)"
    continue
  fi
  tmp="/tmp/dv_rank_star_${stars}.png"
  if curl -sf "${RANK_CDN}/rank_star_${stars}.png" -o "$tmp"; then
    cwebp -q 90 -quiet "$tmp" -o "$out"
    rm -f "$tmp"
    echo "  rank_star_${stars}"
  else
    echo "  WARN: failed rank_star_${stars}"
  fi
done

echo ""
echo "Done."
echo "Hero icons: $(ls $HERO_DIR/*.webp 2>/dev/null | wc -l | tr -d ' ') files"
echo "Rank icons: $(ls $RANK_DIR/*.webp 2>/dev/null | wc -l | tr -d ' ') files"
