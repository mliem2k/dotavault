export type ScenarioMiscRow = {
  scenario: string
  is_radiant: boolean
  region: number
  games: string
  wins: string
}

export type ScenarioSummary = { scenario: string; games: number; wins: number; winRate: number }

// OpenDota's /scenarios/misc rows are split by region and is_radiant; sum
// across both to get one global win rate per distinct scenario.
export function aggregateScenarioWinRates(rows: ScenarioMiscRow[]): ScenarioSummary[] {
  const totals = new Map<string, { games: number; wins: number }>()
  for (const r of rows) {
    const cur = totals.get(r.scenario) ?? { games: 0, wins: 0 }
    cur.games += Number(r.games)
    cur.wins += Number(r.wins)
    totals.set(r.scenario, cur)
  }
  return [...totals.entries()].map(([scenario, t]) => ({
    scenario,
    games: t.games,
    wins: t.wins,
    winRate: t.games > 0 ? (t.wins / t.games) * 100 : 0,
  }))
}
