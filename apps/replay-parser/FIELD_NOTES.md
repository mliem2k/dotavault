# Field notes (from apps/replay-parser/testdata/fixture.dem.bz2, match 8907618799)

Confirmed by running `-inspect` against this fixture (see `inspect.go`), plus a
few one-off probe programs written against the same fixture and the vendored
`github.com/dotabuff/manta@v1.5.0` source to resolve ambiguities `-inspect`'s
first pass left open (see inline notes below — those probes were not
committed, only their real output was transcribed here).

Fixture: match 8907618799, an 11.6-minute (694s) Normal-lobby Turbo-mode
match, radiant heroes Enchantress/Monkey King/Lone Druid/Arc Warden/Pudge,
dire heroes Slark/Viper/Nevermore/Tidehunter/Sniper. Chosen because it was
short (small fixture) and still live on Valve's CDN when fetched.

## Ward entity classes
- Observer ward: `CDOTA_NPC_Observer_Ward` is the placed-in-world unit
  (confirmed created after a `PLAYERSTATS`/`obs_wards_placed=1` combat log
  entry). The unplaced inventory/backpack item is a separate class,
  `CDOTA_Item_ObserverWard`.
- Sentry ward: **not observed in this fixture.** No entity class among the
  338 distinct classes created during the match matched "sentry" (or
  "truesight"/"true_sight"), and no "sentry"-containing string exists
  anywhere in the `CombatLogNames` string table for this replay — i.e. no
  player ever bought or placed a sentry ward in these 11.6 minutes. A longer
  or non-Turbo match would be needed to confirm the real sentry ward class
  name; do not assume a name (e.g. by analogy with the observer ward name)
  without observing it directly in a replay.

## CDOTA_PlayerResource field paths
**Correction to this section's premise:** gold, last hits, denies, and net
worth are **not** fields on `CDOTA_PlayerResource` in this game version.
`CDOTA_PlayerResource` (`m_vecPlayerData.<0-9>.*` / `m_vecPlayerTeamData.<0-9>.*`)
only carries player identity/social metadata — Steam ID
(`m_iPlayerSteamID`), name, team, rank tier, connection state, coach/
broadcaster flags — plus `m_unSelectedHeroBadgeXP` (hero-select-screen badge
XP, unrelated to match XP). The economy data lives on two per-side entities
instead, confirmed by watching values change plausibly over the course of
the match:

- **Gold:** `CDOTA_DataRadiant` / `CDOTA_DataDire` (one entity per side),
  field `m_vecDataTeam.<slot 0-4>.m_iReliableGold` +
  `m_vecDataTeam.<slot 0-4>.m_iUnreliableGold` — current spendable gold is
  the **sum of both** (verified: at match start every slot had
  `m_iReliableGold=0`, `m_iUnreliableGold=600`, matching Dota 2's real
  starting gold of 600). `m_iTotalEarnedGold` is a separate all-time
  cumulative counter that never decreases on spend/death — it is *not*
  current gold. `slot` here is **team-relative** (0-4 within
  `CDOTA_DataRadiant`/`CDOTA_DataDire` separately), not the global 0-9
  player slot used on `CDOTA_PlayerResource`.
- **Last hits:** `CDOTA_DataRadiant`/`CDOTA_DataDire`.`m_vecDataTeam.<slot>.m_iLastHitCount`
  (verified increasing over the match, e.g. one slot went from 0 to 7).
- **Denies:** `CDOTA_DataRadiant`/`CDOTA_DataDire`.`m_vecDataTeam.<slot>.m_iDenyCount`
  (a related `m_iClaimedDenyCount` field also exists but wasn't further
  investigated).
- **XP:** also not on `CDOTA_PlayerResource`. Confirmed live on the hero unit
  entity itself: `CDOTA_Unit_Hero_<HeroName>.m_iCurrentXP` and
  `.m_iCurrentLevel` (verified on Nevermore: level=1/xp=0 early in the match
  → level=17/xp=17202 by the last update). `CDOTA_DataRadiant`/
  `CDOTA_DataDire`.`m_vecDataTeam.<slot>.m_iTotalEarnedXP` also exists as a
  team-relative-slot cumulative counter, not directly tested for parity with
  the per-hero XP field.
- **Net worth:** `CDOTA_DataRadiant`/`CDOTA_DataDire`.`m_vecDataTeam.<slot>.m_iNetWorth`
  (team-relative slot, looked consistent/monotonic-ish across the match). A
  separate `CDOTA_DataSpectator.m_iNetWorth.<0-23>` flat array also exists
  (broadcast/scoreboard-facing) but several of its indices became erratic
  late in the match (e.g. dropping to `1` after being in the thousands) —
  **not confirmed reliable; don't use it without further verification** of
  what its index actually maps to.
- Other per-slot gold-source-breakdown fields also present on
  `m_vecDataTeam.<slot>.*` (not required by this task, but real and useful
  for later damage/gold-breakdown tasks): `m_iCreepKillGold`,
  `m_iCreepDenyGold`, `m_iHeroKillGold`, `m_iBountyGold`, `m_iBuildingGold`,
  `m_iRoshanGold`, `m_iNeutralKillGold`, `m_iCourierGold`, `m_iWardKillGold`,
  `m_iSharedGold`, `m_iComebackGold`, `m_iAbilityGold`, `m_iIncomeGold`,
  `m_iOtherGold`, `m_iExperimentalGold`, `m_iExperimental2Gold`,
  `m_iGoldSpentOnItems`, `m_iGoldSpentOnConsumables`,
  `m_iGoldSpentOnBuybacks`, `m_iGoldSpentOnSupport`, `m_iGoldLostToDeath`,
  `m_iLastHitMultikill`, `m_iLastHitStreak`, `m_flBuybackGoldLimitTime`.
- **Open question, not resolved here:** how to map a `CDOTA_DataRadiant`/
  `CDOTA_DataDire` team-relative slot (0-4) to a specific player/hero. Left
  for whichever later task actually implements per-player gold/XP
  extraction — it will need to join against `CDOTA_PlayerResource`'s
  `m_vecPlayerData.<slot>.m_iPlayerTeam` (global slot → team) or the hero
  entity's own team, in some consistent order.

## Combat log field mapping (from sampled entries)
- **PURCHASE:** item name is **not** in attacker/target/inflictor — all
  three were `dota_unknown` or the buyer's hero name in every one of the 12
  samples inspected, never an `item_*` string. Real finding: the item name
  is in `value`, looked up through the *same* `CombatLogNames` string table
  as attacker/target/inflictor (i.e.
  `LookupStringByIndex("CombatLogNames", int32(m.GetValue()))`). Observed
  values this way: `item_recipe_magic_wand`, `item_magic_wand`,
  `item_ward_observer`, `item_slippers`, `item_wraith_band`,
  `item_recipe_wraith_band`, `item_boots`, `item_ring_of_regen`,
  `item_bottle`. `target` holds the buying hero's name (e.g.
  `npc_dota_hero_enchantress`). **Cost is not present in the PURCHASE entry
  itself** — `health` and `gold_reason` were 0 in all 165 observed PURCHASE
  entries in this fixture, and no other populated field represents
  currency. Cost must be derived some other way (e.g. diffing the buyer's
  `m_iReliableGold + m_iUnreliableGold` immediately around the purchase
  timestamp, or a static item-cost table) — not from this combat log entry.
- **BUYBACK:** only 2 occurrences in this whole fixture. Only `type`,
  `value` (observed `2`, then `0`), `timestamp`, `timestamp_raw` were
  populated — `attacker_name`/`target_name`/`inflictor_name`/
  `attacker_team`/`target_team` were all unset (index 0 → `dota_unknown`).
  **Ambiguous:** `value`'s meaning could not be determined from only 2
  samples with no accompanying identity field — do not assume it is a
  player slot, a cost, or anything else without verifying against a fixture
  with more buybacks.
- **PICKUP_RUNE:** **not observed** — 0 occurrences in this fixture (nobody
  picked up a rune in these 11.6 minutes). No `rune_type` mapping could be
  determined; per the fallback in this doc's template, treat it as
  "raw integer, no name mapping available" until a fixture with real
  rune pickups is inspected.
- **NEUTRAL_CAMP_STACK:** **not observed** — 0 occurrences in this fixture.
  `neutral_camp_type`/`neutral_camp_team`/`stack_count` exist as proto
  fields but no live value could be confirmed.
- **MULTIKILL / KILLSTREAK / END_KILLSTREAK:** confirmed — count is in
  `value` (observed MULTIKILL `value=2`, i.e. a double kill; KILLSTREAK
  values incrementing `3`, `4`, `5` as a streak continued). END_KILLSTREAK
  did not occur in this fixture (0 occurrences).
- **TEAM_BUILDING_KILL:** `building_type`/`is_target_building` are **not**
  set on the TEAM_BUILDING_KILL entry itself (both were `0`/`false` in all 3
  observed samples). Real finding: those fields are populated on the paired
  `DEATH` combat log entry for the same building, fired at the identical
  `timestamp` (verified: 3 tower deaths at t=430.33, 450.7, 540.87 each had
  a matching `TEAM_BUILDING_KILL` at the exact same timestamp; only the
  `DEATH` entry had `is_target_building=true`, `building_type=1`).
  TEAM_BUILDING_KILL itself only carries: `target_name` (the building),
  `value=1`, `attacker_team`/`target_team`, `total_unit_death_count`.
- **FIRST_BLOOD / AEGIS_TAKEN:** FIRST_BLOOD occurred once (t=177.5); it
  carried `attacker_team=2` and `assist_players` (a repeated field,
  observed `[0, 3, 1]` — player-slot integers, not name strings) but **no
  `attacker_name`/`target_name`** (both unset). The killing hero's identity
  is not in the FIRST_BLOOD entry itself — it likely needs correlating with
  a `DEATH` entry at the same timestamp. AEGIS_TAKEN: **not observed** — 0
  occurrences (no Roshan kill in this ~11.6-minute match).

## User-command messages (Tier 3)
- location_ping count (real minimap pings — this is what `pings` should be built from): 6
- net_ping count (irrelevant — network-latency diagnostic, not gameplay): 0
- chatwheel count: 3
- chatmessage count: 3
- **Conclusion:** Tier 3 fields (`pings`, `actions`, `actions_per_min`,
  `chat`) are **BUILDABLE** — location_ping, chatwheel, and chatmessage all
  fired nonzero counts in this fixture, confirming the replay does carry
  user-input events. `actions_per_min` would need a broader definition of
  "action" than just these two message types (this fixture only directly
  confirms pings and chat, not a general action-count message).
