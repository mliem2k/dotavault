export type LeagueMatchRow = {
  match_id: number
  start_time: number
  duration: number
  radiant_team_id: number | null
  dire_team_id: number | null
  radiant_win: boolean
  radiant_score: number | null
  dire_score: number | null
  series_id: number | null
  series_type: number | null
}

export type Series = {
  key: string
  teamA: number | null
  teamB: number | null
  scoreA: number
  scoreB: number
  bestOf: number
  games: LeagueMatchRow[]
  lastStartTime: number
}

// OpenDota gives per-game rows with a shared series_id but no fixed side
// per team (radiant/dire can swap between games), so re-derive a stable
// "team A vs team B" pairing and series score by walking the games in
// order. A null/zero series_id (or one shared by unrelated pairings, which
// happens) still gets its own single-game "series" via a per-team-pair key
// so unrelated Bo1s never get merged together.
export function buildSeries(matches: LeagueMatchRow[]): Series[] {
  const bySeriesId = new Map<string, LeagueMatchRow[]>()
  for (const m of matches) {
    const pairKey = [m.radiant_team_id, m.dire_team_id]
      .sort((a, b) => (a ?? 0) - (b ?? 0))
      .join('-')
    const key = m.series_id ? `s${m.series_id}-${pairKey}` : `m${m.match_id}`
    if (!bySeriesId.has(key)) bySeriesId.set(key, [])
    bySeriesId.get(key)?.push(m)
  }
  const out: Series[] = []
  for (const [key, games] of bySeriesId) {
    games.sort((a, b) => a.start_time - b.start_time)
    const teamA = games[0].radiant_team_id
    const teamB = games[0].dire_team_id
    let scoreA = 0
    let scoreB = 0
    for (const g of games) {
      const radiantIsA = g.radiant_team_id === teamA
      const aWon = radiantIsA ? g.radiant_win : !g.radiant_win
      if (aWon) scoreA++
      else scoreB++
    }
    const bestOf =
      games[0].series_type === 2
        ? 5
        : games[0].series_type === 1
          ? 3
          : games.length > 1
            ? games.length
            : 1
    out.push({
      key,
      teamA,
      teamB,
      scoreA,
      scoreB,
      bestOf,
      games,
      lastStartTime: games[games.length - 1].start_time,
    })
  }
  return out.sort((a, b) => b.lastStartTime - a.lastStartTime)
}
