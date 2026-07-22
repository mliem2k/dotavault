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

## Hero identity resolution (heroNameToSlot, added Task 3)
Combat log attacker/target names (via `CombatLogNames`) are real internal
unit names like `npc_dota_hero_arc_warden`. To attribute a combat log entry
to a player_slot, the hero `OnEntity` callback needs to build the same
string from the hero entity's class name (`CDOTA_Unit_Hero_ArcWarden`) —
but naively stripping the `CDOTA_Unit_Hero_` prefix and lowercasing does
**not** work for multi-word hero names, because Dota's internal npc names
are inconsistently underscored relative to the class name's PascalCase
suffix. Confirmed directly in this fixture: `CDOTA_Unit_Hero_ArcWarden` →
combat log name `npc_dota_hero_arc_warden` (underscore added),
`CDOTA_Unit_Hero_MonkeyKing` → `npc_dota_hero_monkey_king`,
`CDOTA_Unit_Hero_LoneDruid` → `npc_dota_hero_lone_druid` — while
`CDOTA_Unit_Hero_Enchantress`/`Pudge`/`Slark`/`Nevermore`/`Viper`/
`Tidehunter`/`Sniper` all lowercase straight across with no underscore
inserted. (Publicly documented Dota internal hero names outside this
fixture make clear a blind "insert underscore before every capital"
heuristic would also be wrong the other direction — e.g. `AntiMage` →
`npc_dota_hero_antimage`, `VengefulSpirit` → `npc_dota_hero_vengefulspirit`,
`QueenOfPain` → `npc_dota_hero_queenofpain` are all *not* underscored
despite being multi-word class names — so no string transform on the class
name name is reliable in general.)

**Real fix, no heuristic needed:** every entity (not just heroes) carries
`m_pEntity.m_nameStringTableIndex` (an `int32`), which indexes into the
`EntityNames` string table (534 entries in this fixture) to give the exact
same ground-truth internal name (e.g. index 525 → `npc_dota_hero_arc_warden`)
that `CombatLogNames` resolves attacker/target names to — same mechanism as
the existing `clName` helper, different table name. Verified against all 10
heroes in this fixture: every resolved name matched its combat log
counterpart exactly. Use
`p.LookupStringByIndex("EntityNames", int32(e.Get("m_pEntity.m_nameStringTableIndex").(int32)))`
instead of any class-name string transform whenever a later task needs to
resolve an entity's real internal name (this will matter again for
`ability_uses`/`item_uses`/`hero_hits`/`multi_kills`/`kill_streaks`, which
also need combat-log-name-to-slot attribution).

Caveat: `heroNameToSlot` only gets populated once `ExtractMatch`'s existing
`gameStartSet` gate opens (the hero `OnEntity` callback returns early before
computing `slot` while `!gameStartSet`), so combat log entries that fire
before that point (e.g. genuinely pre-horn purchases during strategy time)
can be silently dropped rather than misattributed — confirmed empirically:
162 of 165 fixture PURCHASE entries were attributed once this fix was in
place (all 10 players got a nonempty `PurchaseLog`), the remaining 3 most
plausibly pre-horn buys that preceded the first post-gate hero entity
update. Failure mode is a silent, graceful miss (a lookup on an
unpopulated/wrong key just returns `ok=false`), never misattribution to the
wrong player.

## DAMAGE/GOLD/XP value semantics (added Task 4)
Task 1 did not specifically re-verify these three combat log types (no
dedicated section above), and several *other* field assumptions in this plan
turned out wrong when actually checked (PURCHASE's cost, TEAM_BUILDING_KILL's
building fields) — so this was spot-checked before writing extraction code
that depends on it, via a one-off probe (same technique as `-inspect`, not
committed) that scanned every DAMAGE/GOLD/XP entry in this fixture, not just
`-inspect`'s 5-sample-per-type preview.

**Confirmed: `value` is the plausible per-event amount, as the plan
assumed** — not a running total, not some unrelated field:
- **DAMAGE:** 4810 entries, all positive, range 1-501 (plausible per-hit/
  per-nuke damage; e.g. `arc_warden_spark_wraith` hits were consistently 73,
  `tidehunter_anchor_smash` cleave hits ranged up to a few hundred).
- **GOLD:** 720 entries, all positive, range 6-2428, plus a distinct one-time
  `value=600` grant to every hero at match start with `gold_reason=0`
  (matches the confirmed real starting gold of 600 from the
  `CDOTA_DataRadiant`/`CDOTA_DataDire` section above — cross-checks).
  Observed `gold_reason` values in this fixture: `0, 5, 6, 11, 12, 13, 14, 17`
  — **`gold_reason=1` (the value the existing pre-Task-4 death-gold-loss code
  keys off) never occurs once in this fixture's 720 GOLD entries.** That
  existing `goldLost`/`KillEvent.GoldLost` logic (from an earlier task) is
  therefore never exercised by this fixture — it stays correct code, just
  untested-with-real-nonzero-data here; a future fixture with a different
  game version/build might be needed to confirm reason 1 still means "death
  loss" and still carries a negative wrapped value. No other reason value's
  name mapping was determined (kept as raw integer keys, same convention as
  `handleRunePickup`'s `rune_type`).
- **XP:** 669 entries, range 0-6352 (33 legitimate zero-value entries —
  e.g. an ally too far away to get an xp share — and a handful of large
  lump values up to 6352/5556 at `xp_reason=1`, consistent with Dota's
  shared/bounty XP-on-kill mechanic handing one large chunk to nearby
  heroes rather than a small per-tick trickle). Observed `xp_reason` values:
  `0, 1, 2, 7, 8`; no name mapping determined, kept as raw integer keys.

Also cross-checked the resulting per-player output for internal plausibility
(not just "nonzero"): every player's `damage_inflictor`/`hero_hits` keys are
real ability/item internal names matching that specific player's own hero kit
(e.g. slot 3's damage came out under `arc_warden_flux`/`arc_warden_spark_
wraith`/`arc_warden_tempest_double`, slot 131 under `tidehunter_anchor_smash`/
`tidehunter_gush`/`tidehunter_ravage`, etc. — matching this fixture's known
roster from the top of this file), and every player's `kills_log` length
equals the sum of their `killed` map's values.

## Per-minute time series: slot alignment + entity contamination (Task 6)
**Step 0's question, answered:** yes, `CDOTA_DataRadiant`/`CDOTA_DataDire`'s
`m_vecDataTeam.<slot 0-4>` numbering lines up **directly** with the
match-slot numbering used everywhere else in this parser (Radiant
`m_vecDataTeam.<N>` = match slot N, Dire `m_vecDataTeam.<N>` = match slot
128+N). No remapping needed. Verified two ways against this fixture:

1. Ranking: for every hero, `m_iCurrentXP` (read off the hero unit entity,
   attributed to a match slot via `playerSlot`) ranked/tracked with
   `CDOTA_DataRadiant`/`CDOTA_DataDire`'s same-numbered
   `m_vecDataTeam.<slot>.m_iTotalEarnedXP`, for both sides.
2. Exact value match: since Dota's XP never decreases, `m_iCurrentXP`
   (hero entity, max value seen) and `m_iTotalEarnedXP` (team-data entity,
   same slot, max value seen) should be — and, once the entity-
   contamination issue below is corrected for, **are** — numerically
   identical, not just correlated. Confirmed exactly equal for all 10
   heroes (both read continuously through the whole parse, independent of
   `ExtractMatch`'s own per-minute sampling cadence): Enchantress
   14919/14919, MonkeyKing 7000/7000, LoneDruid 9351/9351, ArcWarden
   10409/10409, Pudge 3200/3200, Slark 10905/10905, Nevermore
   17202/17202, Viper 15838/15838, Tidehunter 23914/23914, Sniper
   14187/14187. (Note: this is a *max-observed-value* comparison, not a
   claim about what any single per-minute `xp_t` sample will read — a
   per-minute snapshot can legitimately land a little below the
   eventual max if it fires before that minute's biggest XP grant lands
   on the hero entity, since gold/lh/dn/xp are sampled together once per
   minute off whichever entity's update crosses the minute boundary
   first, not aggregated. Confirmed this isn't the `gameEndSet` gate
   truncating things early: the max XP reached strictly before
   post-game state matched the all-time max for every hero here too.)

**Real finding, not anticipated by the brief: two heroes' own entity
readings were contaminated by extra entities sharing their exact class
name, `m_iPlayerID`, and `m_iTeamNum`** — discovered only because Step 0's
verification checked *exact* value equality, not just "nonempty" or rough
ranking, on all 10 heroes rather than assuming the first two or three
looked fine generalized:

- **Monkey King** (Radiant slot 1): **29 distinct entities**, all classed
  `CDOTA_Unit_Hero_MonkeyKing`, all reporting `m_iPlayerID=2`/`m_iTeamNum=2`
  (Monkey King's real player), all created within a ~27-second window near
  match start (one roughly every second, entity indices climbing steadily
  — e.g. 531, 874, 902, 1287, 1373, 1416, 1538...2152), and — critically —
  **none of them ever destroyed for the rest of the match** (`created=1,
  deleted=0` for all 29, confirmed by tracking `EntityOpCreated`/
  `EntityOpDeleted` directly). Of these 29, exactly **one** (in this
  fixture, entity index 1373) ever reports a nonzero `m_iCurrentXP`; the
  other 28 report `m_iCurrentXP=0` on every single one of the ~13,000
  updates each receives over the full match. The likely mechanism:
  Monkey King's kit (Primal Split) requires the engine to be able to field
  multiple simultaneous hero-body forms, and this game version appears to
  pre-reserve a pool of dormant same-classed entity slots for that
  capability at hero spawn regardless of whether the ability is ever
  cast — not confirmed by decompiling engine internals, but consistent
  with every other observation (only Monkey King shows this; the dormant
  entities are inert, never real gameplay units; the real hero entity is
  indistinguishable from them except by which one ever has nonzero XP).
- **Arc Warden** (Radiant slot 3): a much smaller version of the same
  phenomenon — 2 distinct entities instead of 29, consistent with the
  well-documented Tempest Double clone (a real, single, temporary
  hero-body copy, not a dormant pool). Reading "whichever entity updates
  last" produced XP off by ~900 from ground truth.
- **The other 8 heroes** in this fixture (Enchantress, Lone Druid, Pudge,
  Slark, Nevermore, Viper, Tidehunter, Sniper) each had exactly **one**
  entity ever match their class+player, confirming this is specific to
  certain hero kits, not a general artifact of hero entities.

**Why "first entity index observed for a slot" is the wrong fix, even
though it happens to look plausible:** the real hero entity and Monkey
King's dormant pool are *all* created within the same few-second window
right at match start (well before gameStartSet's gate even opens in some
cases), so "lock onto whichever entity's Updated event arrives first"
non-deterministically locks onto a dormant decoy just as often as the real
hero — confirmed directly: this fixture's real hero entity's first
post-gate Updated event did not win the race, so index-locking latched
onto a permanently-zero decoy (531), reproducing exactly the failure this
whole verification exists to catch (a nonempty, non-crashing, silently
wrong series).

**The fix that works, used in `parser.go`'s `xpBySlot` tracking: latch
the running maximum `m_iCurrentXP` ever observed for a slot, across all
entities, rather than tracking a specific entity's identity at all.**
Dota's XP is never-decreasing for a real hero, and every decoy/dormant
entity observed in this fixture reads a flat `0` forever, which can never
exceed a previously-latched higher value — so the max-latch is immune to
decoys without needing any per-entity identity or index bookkeeping.
Verified to reproduce `CDOTA_DataRadiant`/`CDOTA_DataDire`'s independently
tracked `m_iTotalEarnedXP` exactly for all 10 heroes, including both
contaminated ones (Monkey King 7000, Arc Warden 10409).

**Note for future tasks (`ability_uses`/`item_uses`/`hero_hits`/damage
attribution and anything else keyed off this same hero `OnEntity`
callback):** gold/last-hits/denies (from `CDOTA_DataRadiant`/
`CDOTA_DataDire`) are **not** affected by this — those come from a single
entity per side, with no multi-entity ambiguity. But this task's discovery
means the *existing* Position/Level/HP/Mana sampling on the hero entity
(from Tasks 2-5, unchanged here) is reading from whichever entity happens
to satisfy the per-second dedup first for Monkey King's and Arc Warden's
slots specifically — out of this task's scope to fix, but a real,
demonstrated gap: those two heroes' `positions` arrays may already
interleave samples from decoy/clone entities rather than the real hero
body. A future task touching Position/Level/HP should re-verify this
specifically for Monkey King/Arc Warden-containing fixtures, not just
assume the existing per-second dedup is entity-identity-safe.

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

## Ward extraction results (Task 7)
Only 2 observer wards placed in this whole 11.6-minute Turbo match (both
also eventually destroyed, i.e. `ObsLeftLog` got 2 entries too) — plausible
for a short Turbo game, but means this fixture only lightly exercises ward
extraction. Both wards' spatial-proximity ownership heuristic
(`wardOwnerSlot`, `wards.go`) resolved cleanly to a single closest hero each,
well inside the 200-unit threshold:
- Match slot 132 (Sniper), placed t≈41.2s at (X≈84.4, Y≈164.6).
- Match slot 2 (Lone Druid), placed t≈365.8s at (X≈78.1, Y≈138.7).

Coordinates use `cellPosition` exactly as the existing hero-position code
does, so they land in the same ~64-192 world-grid scale as `Positions`/
OpenDota's `obs_log` — no unit conversion needed. `SenLog`/`SenLeftLog`
stay empty for every player, as expected (see this file's "Ward entity
classes" section above): this fixture never had a sentry ward to observe,
so that gap is left genuinely unimplemented rather than guessed at.
