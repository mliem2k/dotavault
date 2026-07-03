#!/usr/bin/env python3
"""Build apps/web/public/hero_meta.json from Valve's official Dota 2 datafeed.

The datafeed (dota2.com/datafeed/herodata) has the tagline + complexity + exact
displayed stats that OpenDota doesn't expose, but it isn't CORS-accessible from
the browser — so we bake a compact per-hero JSON at build time instead.
"""
import json
import os
import urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
BASE = "https://www.dota2.com/datafeed"
OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "public", "hero_meta.json")

FIELDS = [
    "complexity", "str_base", "str_gain", "agi_base", "agi_gain", "int_base",
    "int_gain", "damage_min", "damage_max", "attack_rate", "attack_range",
    "magic_resistance", "movement_speed", "turn_rate", "sight_range_day",
    "sight_range_night", "max_health", "health_regen", "max_mana", "mana_regen",
]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.dota2.com/heroes"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def rnd(v):
    if isinstance(v, float):
        return round(v, 2)
    return v


def main():
    ids = [h["id"] for h in get(f"{BASE}/herolist?language=english")["result"]["data"]["heroes"]]
    print(f"{len(ids)} heroes")
    out = {}
    for i, hid in enumerate(ids):
        try:
            h = get(f"{BASE}/herodata?language=english&hero_id={hid}")["result"]["data"]["heroes"][0]
        except Exception as e:  # noqa: BLE001
            print(f"  [{i+1}/{len(ids)}] {hid} FAILED: {e}")
            continue
        entry = {"tagline": h.get("npe_desc_loc", "")}
        for f in FIELDS:
            entry[f] = rnd(h.get(f))
        entry["armor"] = rnd(h.get("armor"))
        out[str(hid)] = entry
        print(f"  [{i+1}/{len(ids)}] {h.get('name_loc')}")
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {OUT} ({os.path.getsize(OUT)} bytes, {len(out)} heroes)")


if __name__ == "__main__":
    main()
