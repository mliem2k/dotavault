package main

// PlayerParsed holds every currently-"parsed-only" MatchPlayer field this
// parser can produce for one player_slot. Field names match
// packages/types/src/match.ts's MatchPlayer exactly; this is the JSON
// contract apps/api merges into the full Match object (see Plan 2).
type PlayerParsed struct {
	Positions         []PositionPoint             `json:"positions"`
	KillsLog          []KillLogEntry              `json:"kills_log"`
	Purchase          map[string]int32            `json:"purchase"`
	PurchaseLog       []PurchaseEvent             `json:"purchase_log"`
	GoldT             []int32                     `json:"gold_t"`
	LhT               []int32                     `json:"lh_t"`
	DnT               []int32                     `json:"dn_t"`
	XpT               []int32                     `json:"xp_t"`
	ObsLog            []WardEvent                 `json:"obs_log"`
	SenLog            []WardEvent                 `json:"sen_log"`
	ObsLeftLog        []WardEvent                 `json:"obs_left_log"`
	SenLeftLog        []WardEvent                 `json:"sen_left_log"`
	Damage            map[string]int32            `json:"damage"`
	DamageTaken       map[string]int32            `json:"damage_taken"`
	DamageInflictor   map[string]int32            `json:"damage_inflictor"`
	DamageTargets     map[string]map[string]int32 `json:"damage_targets"`
	Killed            map[string]int32            `json:"killed"`
	GoldReasons       map[string]int32            `json:"gold_reasons"`
	XpReasons         map[string]int32            `json:"xp_reasons"`
	LaneEfficiencyPct *float64                    `json:"lane_efficiency_pct,omitempty"`
	CampsStacked      int32                       `json:"camps_stacked"`
	RunePickups       int32                       `json:"rune_pickups"`
	BuybackCount      int32                       `json:"buyback_count"`
	TotalGold         int32                       `json:"total_gold"`
	RunesLog          []RuneEvent                 `json:"runes_log"`
	BuybackLog        []BuybackEvent              `json:"buyback_log"`
	LanePos           map[string]map[string]int32 `json:"lane_pos"`
	AbilityUses       map[string]int32            `json:"ability_uses"`
	ItemUses          map[string]int32            `json:"item_uses"`
	HeroHits          map[string]int32            `json:"hero_hits"`
	MultiKills        map[string]int32            `json:"multi_kills"`
	KillStreaks       map[string]int32            `json:"kill_streaks"`
	TowersKilled      int32                       `json:"towers_killed"`
	RoshansKilled     int32                       `json:"roshans_killed"`
	FirstbloodClaimed int32                       `json:"firstblood_claimed"`
	// Pings: populated from OnCDOTAUserMsg_LocationPing (confirmed present in
	// the replay stream against testdata/fixture.dem.bz2 — see FIELD_NOTES.md).
	// Actions/ActionsPerMin: not populated by this task — FIELD_NOTES.md only
	// confirms pings and chat messages fire, not a general action-count
	// message; left nil rather than approximated from an incomplete signal.
	Pings         *int32           `json:"pings,omitempty"`
	Actions       map[string]int32 `json:"actions,omitempty"`
	ActionsPerMin *float64         `json:"actions_per_min,omitempty"`
	// Modifiers: every buff/debuff lifecycle transition on this hero,
	// resolved via the replay's ModifierNames string table (see
	// modifiers.go) — raw and unfiltered, same "aura"/"building"/"courier"
	// noise the real Dota 2 client's buff bar also carries internally.
	Modifiers []ModifierEvent `json:"modifiers"`
	// AccountID/PersonaName: resolved from the replay's own CDemoFileInfo
	// player info (steamid64 + player_name), which Valve's engine embeds for
	// every player regardless of the "expose public match data" opt-out that
	// makes OpenDota's own account_id null for these players (that setting
	// only gates the Steam Web API OpenDota's basic match fetch uses, not
	// what's recorded in the replay — see steamID64ToAccountID in
	// demoplayerinfo.go for the standard, public Steam32 conversion).
	// match_merge.ts only takes these when OpenDota's own value is null: a
	// fallback for otherwise-anonymous players, never an override of a
	// value OpenDota already disclosed. Omitted (not merged in) when
	// resolution fails, e.g. a bot (is_fake_client) or a hero_name that
	// didn't match this parse's own heroNameToSlot.
	AccountID   *int32  `json:"account_id,omitempty"`
	PersonaName *string `json:"personaname,omitempty"`
}

// ModifierEvent is one buff/debuff lifecycle transition (applied or
// removed) on a hero. Name is resolved through the replay's ModifierNames
// string table (see modifiers.go), same lookup pattern as CombatLogNames/
// EntityNames elsewhere in this parser. Duration/Aura are only meaningful
// on an Active=true event (empirically confirmed: many modifiers, like
// aura-refresh buffs, never send an explicit removal — they're just
// re-applied on a short timer for as long as their condition holds, so a
// consumer that only tracks explicit ACTIVE/REMOVED pairs would show them
// as stuck on forever the moment refreshing stops; Duration lets a
// consumer expire them on its own instead of waiting for a removal that
// may never come).
type ModifierEvent struct {
	T        float64 `json:"t"`
	Name     string  `json:"name"`
	Active   bool    `json:"active"` // false = removed at T
	Stacks   int32   `json:"stacks,omitempty"`
	Duration float64 `json:"duration,omitempty"` // seconds after T this expires on its own; 0 = no fixed duration, relies on an explicit removal instead
	Aura     bool    `json:"aura,omitempty"`      // true = a passive/environmental aura-refresh state (nearby tower/fountain/etc), not the hero's own active buff
}

type WardEvent struct {
	T          float64 `json:"time"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	EntityLeft bool    `json:"entityleft,omitempty"`
}

type PurchaseEvent struct {
	Key string  `json:"key"`
	T   float64 `json:"time"`
}

type RuneEvent struct {
	T   float64 `json:"time"`
	Key string  `json:"key"`
}

type BuybackEvent struct {
	T          float64 `json:"time"`
	Slot       int32   `json:"slot"`
	PlayerSlot int32   `json:"player_slot"`
}

type KillLogEntry struct {
	T   float64 `json:"time"`
	Key string  `json:"key"`
}

type ObjectiveEvent struct {
	T          float64 `json:"time"`
	Type       string  `json:"type"`
	Slot       *int32  `json:"slot"`
	Key        *string `json:"key"`
	PlayerSlot *int32  `json:"player_slot"`
	Unit       *string `json:"unit"`
	Team       *int32  `json:"team"`
	Value      *int32  `json:"value"`
}

type TeamfightPlayerStats struct {
	DeathsPos   map[string]map[string]int32 `json:"deaths_pos"`
	AbilityUses map[string]int32            `json:"ability_uses"`
	ItemUses    map[string]int32            `json:"item_uses"`
	Killed      map[string]int32            `json:"killed"`
	Buybacks    int32                       `json:"buybacks"`
	Damage      int32                       `json:"damage"`
	Deaths      int32                       `json:"deaths"`
	GoldDelta   int32                       `json:"gold_delta"`
	Healing     int32                       `json:"healing"`
	XpDelta     int32                       `json:"xp_delta"`
}

// Teamfight.Players is ordered by player_slot (Radiant 0-4, then Dire
// 128-132), 10 entries always, matching packages/types/src/match.ts's
// `players: TeamfightPlayer[]` array shape (not a map — order is the key).
type Teamfight struct {
	Start     float64                `json:"start"`
	End       float64                `json:"end"`
	LastDeath float64                `json:"last_death"`
	Deaths    int32                  `json:"deaths"`
	Players   []TeamfightPlayerStats `json:"players"`
}

// ParsedMatch is the full output of one replay parse: everything
// packages/types/src/match.ts marks parsed-only, keyed by player_slot
// (as a string, e.g. "0".."4", "128".."132") for per-player fields.
type ParsedMatch struct {
	MatchID        int64                    `json:"match_id"`
	Duration       float64                  `json:"duration"`
	Players        map[string]*PlayerParsed `json:"players"`
	Kills          []KillEvent              `json:"kills"`
	Teamfights     []Teamfight              `json:"teamfights"`
	Objectives     []ObjectiveEvent         `json:"objectives"`
	Chat           []ChatMessage            `json:"chat,omitempty"`
	RadiantGoldAdv []int32                  `json:"radiant_gold_adv"`
	RadiantXpAdv   []int32                  `json:"radiant_xp_adv"`
}

type ChatMessage struct {
	T          float64 `json:"time"`
	Type       string  `json:"type"`
	Key        string  `json:"key"`
	Slot       int32   `json:"slot"`
	PlayerSlot int32   `json:"player_slot"`
	Unit       string  `json:"unit,omitempty"`
}
