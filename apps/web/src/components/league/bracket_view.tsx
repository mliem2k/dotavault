import { memo, useMemo, useState } from 'react'
import { cn, formatDuration } from '@/lib/utils'
import { inferBracket, isAdjacentRound, isWinningContinuation } from './infer_bracket'
import type { Series } from './series'
import { useBracketLayout } from './use_bracket_layout'

// SVG stroke attributes take raw color values, not classNames, so these reference
// the same design tokens as text-muted / text-radiant via CSS custom properties.
const LINE_COLOR_NEUTRAL = 'var(--color-muted)'
const LINE_COLOR_WINNER = 'var(--color-radiant)'

type TeamInfo = { name: string | null; tag: string | null; logo_url: string | null }

function TeamLabel({ id, name }: { id: number | null; name: string }) {
  if (id == null) {
    return <span className="truncate text-[13px] font-dota">{name}</span>
  }
  return (
    <a
      href={`/team/${id}`}
      onClick={(e) => e.stopPropagation()}
      className="truncate text-[13px] text-inherit hover:underline font-dota"
    >
      {name}
    </a>
  )
}

const BracketCard = memo(function BracketCard({
  s,
  teamMap,
  cardRef,
}: {
  s: Series
  teamMap: Map<number, TeamInfo>
  cardRef: (el: HTMLDivElement | null) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const teamA = teamMap.get(s.teamA ?? -1)
  const teamB = teamMap.get(s.teamB ?? -1)
  const aWon = s.scoreA > s.scoreB

  const row = (id: number | null, name: string, score: number, won: boolean) => (
    <div
      className="flex items-center justify-between gap-2 px-2.5 py-1.5"
      style={{ background: won ? 'rgba(142,198,63,0.08)' : 'transparent' }}
    >
      <span
        className={cn(won ? 'text-radiant' : 'text-muted')}
        style={{ fontWeight: won ? 600 : 400, minWidth: 0 }}
      >
        <TeamLabel id={id} name={name} />
      </span>
      <span
        className={cn(
          'shrink-0 text-[13px] font-bold tabular-nums',
          won ? 'text-radiant' : 'text-muted',
        )}
      >
        {score}
      </span>
    </div>
  )

  return (
    <div
      ref={cardRef}
      onClick={() => setExpanded((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setExpanded((v) => !v)
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      className="w-[160px] cursor-pointer border border-border sm:w-[220px]"
      style={{ background: 'rgba(255,255,255,0.03)' }}
    >
      {row(s.teamA, teamA?.name ?? (s.teamA ? `Team ${s.teamA}` : 'TBD'), s.scoreA, aWon)}
      <div className="border-t border-border">
        {row(s.teamB, teamB?.name ?? (s.teamB ? `Team ${s.teamB}` : 'TBD'), s.scoreB, !aWon)}
      </div>
      {expanded && (
        <div className="flex flex-wrap gap-1 border-t border-border p-1.5">
          {s.games.map((g) => {
            const radiantIsA = g.radiant_team_id === s.teamA
            const aWonGame = radiantIsA ? g.radiant_win : !g.radiant_win
            return (
              <a
                key={g.match_id}
                href={`/match/${g.match_id}`}
                onClick={(e) => e.stopPropagation()}
                className="px-1.5 py-1 text-[11px] tabular-nums text-muted hover:bg-white/[0.05] font-dota"
                style={{ background: 'rgba(255,255,255,0.03)' }}
                title={`${formatDuration(g.duration)} · ${g.radiant_score ?? '?'}-${g.dire_score ?? '?'}`}
              >
                {/* #c73f2d is not in the Token Mapping Reference (close to but distinct from
                    text-dire's #d14a38/#c94a38) so it is kept as a raw inline style, per the
                    Task 5/6 precedent of not guessing on off-table hex values. */}
                <span
                  className={cn(aWonGame && 'text-radiant')}
                  style={!aWonGame ? { color: '#c73f2d' } : undefined}
                >
                  {aWonGame ? 'W' : 'L'}
                </span>{' '}
                {formatDuration(g.duration)}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
})

function ConnectorLines({
  rounds,
  parentOf,
  seriesByKey,
  positions,
  width,
  height,
}: {
  rounds: Series[][]
  parentOf: Map<string, { a?: string; b?: string }>
  seriesByKey: Map<string, Series>
  positions: Record<
    string,
    { top: number; bottom: number; left: number; right: number; centerY: number }
  >
  width: number
  height: number
}) {
  const roundIndexOf = new Map<string, number>()
  rounds.forEach((round, i) => {
    for (const s of round) roundIndexOf.set(s.key, i)
  })

  const paths: { key: string; d: string; color: string }[] = []
  for (const round of rounds) {
    for (const s of round) {
      const parents = parentOf.get(s.key)
      if (!parents) continue
      const child = positions[s.key]
      if (!child) continue
      const childRoundIndex = roundIndexOf.get(s.key)
      if (childRoundIndex == null) continue
      for (const side of ['a', 'b'] as const) {
        const parentKey = parents[side]
        if (!parentKey) continue
        if (!isAdjacentRound(roundIndexOf.get(parentKey), childRoundIndex)) continue
        const parent = positions[parentKey]
        if (!parent) continue
        const parentSeries = seriesByKey.get(parentKey)
        const continuingTeam = side === 'a' ? s.teamA : s.teamB
        const wonParent = isWinningContinuation(continuingTeam, parentSeries)
        const midX = (parent.right + child.left) / 2
        paths.push({
          key: `${s.key}-${side}`,
          color: wonParent ? LINE_COLOR_WINNER : LINE_COLOR_NEUTRAL,
          d: `M ${parent.right} ${parent.centerY} H ${midX} V ${child.centerY} H ${child.left}`,
        })
      }
    }
  }
  return (
    <svg
      className="absolute inset-0"
      width={width}
      height={height}
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {paths.map((p) => (
        <path key={p.key} d={p.d} stroke={p.color} strokeWidth={1.5} fill="none" />
      ))}
    </svg>
  )
}

export function BracketView({
  series,
  teamMap,
}: {
  series: Series[]
  teamMap: Map<number, TeamInfo>
}) {
  const { rounds, parentOf } = useMemo(() => inferBracket(series), [series])
  const seriesByKey = useMemo(() => new Map(series.map((s) => [s.key, s])), [series])
  const seriesKeys = useMemo(() => rounds.flat().map((s) => s.key), [rounds])
  const { containerRef, getCardRef, positions, contentSize } = useBracketLayout(seriesKeys)

  return (
    <div>
      <div className="pb-3 text-[12px] text-muted">
        Approximate round grouping inferred from match order, Valve doesn't publish official bracket
        positions through this data source.
      </div>
      <div className="overflow-x-auto pb-2">
        <div ref={containerRef} className="relative inline-flex items-start gap-4 sm:gap-6">
          <ConnectorLines
            rounds={rounds}
            parentOf={parentOf}
            seriesByKey={seriesByKey}
            positions={positions}
            width={contentSize.width}
            height={contentSize.height}
          />
          {rounds.map((round, i) => (
            <div key={i} className="flex shrink-0 flex-col gap-3 sm:gap-4">
              <div className="text-[12px] font-bold uppercase tracking-widest text-muted">
                Round {i + 1}
              </div>
              {round.map((s) => (
                <BracketCard key={s.key} s={s} teamMap={teamMap} cardRef={getCardRef(s.key)} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
