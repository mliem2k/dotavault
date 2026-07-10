import type { Series } from './series'

export type BracketParentLinks = Map<string, { a?: string; b?: string }>

// Valve/OpenDota don't expose a round or bracket-slot field, so there's no
// way to know the *official* bracket shape. This infers a reasonable
// approximation instead, in two passes.
//
// Parent links (which match a team came from) walk oldest-first: a team's
// previous series is whichever series it last appeared in, this is exact
// regardless of tournament format and doesn't depend on round grouping.
//
// Round/column assignment walks newest-first instead, counting each team's
// *distance from the final* rather than its match count from the start.
// Counting from the start would let early, often-noisy group-stage
// matches (a team can play many of these before the bracket even begins)
// inflate a team's round number well past its opponent's, misaligning two
// series that are really the same round of the same bracket. Counting
// backward from the final means only genuine bracket depth matters, so
// pre-bracket noise for one team doesn't distort where its real bracket
// matches land. This isn't perfect either (a genuine bye or an
// asymmetric lower-bracket depth in a double-elimination format can still
// leave a parent and child more than one column apart), which is why
// `isAdjacentRound` exists as a rendering-side safety net independent of
// which direction this is computed from.
export function inferBracket(series: Series[]): {
  rounds: Series[][]
  parentOf: BracketParentLinks
} {
  const lastSeriesOf = new Map<number, string>()
  const parentOf: BracketParentLinks = new Map()
  const oldestFirst = [...series].sort((a, b) => a.lastStartTime - b.lastStartTime)

  for (const s of oldestFirst) {
    const parentA = s.teamA != null ? lastSeriesOf.get(s.teamA) : undefined
    const parentB = s.teamB != null ? lastSeriesOf.get(s.teamB) : undefined
    if (parentA != null || parentB != null) {
      parentOf.set(s.key, { a: parentA, b: parentB })
    }
    if (s.teamA != null) lastSeriesOf.set(s.teamA, s.key)
    if (s.teamB != null) lastSeriesOf.set(s.teamB, s.key)
  }

  const distanceFromFinal = new Map<number, number>()
  const distanceOfSeries = new Map<string, number>()
  const newestFirst = [...series].sort((a, b) => b.lastStartTime - a.lastStartTime)

  for (const s of newestFirst) {
    const dA = s.teamA != null ? (distanceFromFinal.get(s.teamA) ?? 0) : 0
    const dB = s.teamB != null ? (distanceFromFinal.get(s.teamB) ?? 0) : 0
    const distance = Math.max(dA, dB)
    distanceOfSeries.set(s.key, distance)
    if (s.teamA != null) distanceFromFinal.set(s.teamA, distance + 1)
    if (s.teamB != null) distanceFromFinal.set(s.teamB, distance + 1)
  }

  const maxDistance = Math.max(0, ...distanceOfSeries.values())
  const rounds: Series[][] = []
  for (const s of series) {
    const round = maxDistance - (distanceOfSeries.get(s.key) ?? maxDistance)
    if (!rounds[round]) rounds[round] = []
    rounds[round].push(s)
  }
  return { rounds, parentOf }
}

// A parent link only means "this team's previous series", not "this team
// won its previous series" — under the Swiss-stage/double-elimination
// approximation above, a team can carry over into the next inferred round
// despite having lost. Callers coloring a connector line as a winner's path
// must check this, not just whether the parent series had a decisive score.
export function isWinningContinuation(
  continuingTeamId: number | null,
  parentSeries: Series | undefined,
): boolean {
  if (continuingTeamId == null || parentSeries == null) return false
  if (parentSeries.teamA === continuingTeamId) return parentSeries.scoreA > parentSeries.scoreB
  if (parentSeries.teamB === continuingTeamId) return parentSeries.scoreB > parentSeries.scoreA
  return false
}

// A parent link's round isn't always exactly one column back: round
// assignment is max(teamA's own round counter, teamB's own round counter),
// so a team whose matches have been paced differently than its opponents'
// (routine under the Swiss-stage/double-elimination approximation) can have
// its true previous match sitting two or more rounds behind the current
// one. A connector line drawn straight from that parent to this child would
// cut across the intervening round's cards, so callers should only draw a
// connector when the parent is in the immediately preceding round.
export function isAdjacentRound(
  parentRoundIndex: number | undefined,
  childRoundIndex: number,
): boolean {
  return parentRoundIndex != null && childRoundIndex - parentRoundIndex === 1
}
