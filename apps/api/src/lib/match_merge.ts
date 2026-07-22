import type { ChatMessage, Match, MatchPlayer, Objective, Teamfight } from 'types'

// Mirrors apps/replay-parser's ParsedMatch/PlayerParsed JSON output
// (types.go) — field names must match exactly (locked down on the Go side
// by apps/replay-parser/contract_test.go). Every field PlayerParsed emits
// already has a same-named counterpart in MatchPlayer (see match.ts's
// "Parsed-only extras" block), so Partial<MatchPlayer> covers it exactly —
// no index signature needed.
export type ParsedPlayer = Partial<MatchPlayer>

export type ParsedMatch = {
  match_id: number
  duration: number
  players: Record<string, ParsedPlayer>
  kills?: Match['kills']
  teamfights?: Teamfight[]
  objectives?: Objective[]
  chat?: ChatMessage[]
  radiant_gold_adv?: number[]
  radiant_xp_adv?: number[]
}

// Merges our own parsed-match data onto OpenDota's basic Match object.
// Per-player fields join by player_slot (Go's Players map is keyed by the
// same slot convention as MatchPlayer.player_slot, just as a string). A
// player whose slot has no counterpart in parsed data is left unmerged
// rather than thrown on — shouldn't happen given both sides use the same
// slot convention, but this keeps a partial/corrupted parsed row from
// breaking the whole page.
export function mergeParsedMatch(basic: Match, parsed: ParsedMatch | null): Match {
  if (!parsed) return basic
  const players: MatchPlayer[] = basic.players.map((p) => {
    const parsedPlayer = parsed.players[String(p.player_slot)]
    return parsedPlayer ? { ...p, ...parsedPlayer } : p
  })
  return {
    ...basic,
    players,
    kills: parsed.kills ?? basic.kills,
    teamfights: parsed.teamfights ?? basic.teamfights,
    objectives: parsed.objectives ?? basic.objectives,
    chat: parsed.chat ?? basic.chat,
    radiant_gold_adv: parsed.radiant_gold_adv ?? basic.radiant_gold_adv,
    radiant_xp_adv: parsed.radiant_xp_adv ?? basic.radiant_xp_adv,
  }
}
