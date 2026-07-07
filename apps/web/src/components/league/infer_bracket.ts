import type { Series } from './series'

export type BracketParentLinks = Map<string, { a?: string; b?: string }>

// Valve/OpenDota don't expose a round or bracket-slot field, so there's no
// way to know the *official* bracket shape. This infers a reasonable
// approximation instead: walk series oldest-first, and a team's next
// series happens one round after whatever round they were last seen in.
// That's exact for a clean single-elimination bracket; for a Swiss stage
// (round-robin-ish, no elimination) it degrades gracefully into "the Nth
// time this team played", which still reads fine as a column layout even
// though it isn't a true bracket tree, just an approximate one.
//
// Alongside the round grouping, this tracks each team's previous series
// (lastSeriesOf) so callers can draw a connector line from a match to
// whichever match its winner advances to. A team with no previous series
// (first appearance, a bye, or a Swiss-stage entrant) simply gets no
// parent link on that side, callers should skip drawing that line rather
// than treat it as an error.
export function inferBracket(series: Series[]): { rounds: Series[][]; parentOf: BracketParentLinks } {
  const roundOf = new Map<number, number>()
  const lastSeriesOf = new Map<number, string>()
  const rounds: Series[][] = []
  const parentOf: BracketParentLinks = new Map()
  const oldestFirst = [...series].sort((a, b) => a.lastStartTime - b.lastStartTime)

  for (const s of oldestFirst) {
    const rA = s.teamA != null ? (roundOf.get(s.teamA) ?? 0) : 0
    const rB = s.teamB != null ? (roundOf.get(s.teamB) ?? 0) : 0
    const round = Math.max(rA, rB)
    if (!rounds[round]) rounds[round] = []
    rounds[round].push(s)

    const parentA = s.teamA != null ? lastSeriesOf.get(s.teamA) : undefined
    const parentB = s.teamB != null ? lastSeriesOf.get(s.teamB) : undefined
    if (parentA != null || parentB != null) {
      parentOf.set(s.key, { a: parentA, b: parentB })
    }

    if (s.teamA != null) {
      roundOf.set(s.teamA, round + 1)
      lastSeriesOf.set(s.teamA, s.key)
    }
    if (s.teamB != null) {
      roundOf.set(s.teamB, round + 1)
      lastSeriesOf.set(s.teamB, s.key)
    }
  }
  return { rounds, parentOf }
}
