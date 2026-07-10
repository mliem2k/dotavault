import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { HeroStat, Match } from 'types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RUNE_NAMES } from '@/lib/dotaconst'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { extractObjectiveEvents } from './match_objectives'
import { formatClock } from './match_time'

/* Log tab: one unified, filterable timeline of everything that happened in
   the match: kills, objectives (towers, Roshan, aegis, couriers), rune
   activations, buybacks, and ward placements. */

const C = {
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

type Category = 'kills' | 'objectives' | 'runes' | 'buybacks' | 'wards'

const CATEGORY_LABELS: Record<Category, string> = {
  kills: 'Kills',
  objectives: 'Objectives',
  runes: 'Runes',
  buybacks: 'Buybacks',
  wards: 'Wards',
}

type LogEvent = {
  time: number
  category: Category
  icon: string
  text: string
  team: 'radiant' | 'dire' | null
  heroId?: number
}

function buildEvents(match: Match, heroStats: HeroStat[]): LogEvent[] {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const heroByName = new Map(heroStats.map((h) => [h.name, h]))
  const events: LogEvent[] = []

  for (const e of extractObjectiveEvents(match, heroStats)) {
    events.push({ ...e, category: 'objectives' })
  }

  for (const p of match.players) {
    const hero = heroMap.get(p.hero_id)
    const heroName = hero?.localized_name ?? 'A hero'
    const team = p.player_slot < 128 ? ('radiant' as const) : ('dire' as const)

    for (const k of p.kills_log ?? []) {
      const victim = heroByName.get(k.key)
      events.push({
        time: k.time,
        category: 'kills',
        icon: '⚔',
        text: `${heroName} killed ${victim?.localized_name ?? k.key.replace('npc_dota_hero_', '')}`,
        team,
        heroId: p.hero_id,
      })
    }
    for (const r of p.runes_log ?? []) {
      events.push({
        time: r.time,
        category: 'runes',
        icon: '◈',
        text: `${heroName} activated a ${RUNE_NAMES[r.key] ?? 'mystery'} rune`,
        team,
        heroId: p.hero_id,
      })
    }
    for (const b of p.buyback_log ?? []) {
      events.push({
        time: b.time,
        category: 'buybacks',
        icon: '⟲',
        text: `${heroName} bought back`,
        team,
        heroId: p.hero_id,
      })
    }
    for (const w of p.obs_log ?? []) {
      events.push({
        time: w.time,
        category: 'wards',
        icon: '👁',
        text: `${heroName} placed an Observer ward`,
        team,
        heroId: p.hero_id,
      })
    }
    for (const w of p.sen_log ?? []) {
      events.push({
        time: w.time,
        category: 'wards',
        icon: '◉',
        text: `${heroName} placed a Sentry ward`,
        team,
        heroId: p.hero_id,
      })
    }
  }

  return events.sort((a, b) => a.time - b.time)
}

/* Dotabuff-style aggregate: how many of each rune type each player took. */
function RunesSummary({ match, heroMap }: { match: Match; heroMap: Map<number, HeroStat> }) {
  const counts = new Map<number, Record<string, number>>()
  const runeIds = new Set<string>()
  for (const p of match.players) {
    for (const r of p.runes_log ?? []) {
      runeIds.add(r.key)
      const rec = counts.get(p.player_slot) ?? {}
      rec[r.key] = (rec[r.key] ?? 0) + 1
      counts.set(p.player_slot, rec)
    }
  }
  if (runeIds.size === 0) return null
  const cols = [...runeIds].sort((a, b) => Number(a) - Number(b))
  const players = match.players.filter((p) => (counts.get(p.player_slot) ? true : false))

  return (
    <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="mb-2 text-[13px] uppercase text-slate-muted" style={{ letterSpacing: '2px' }}>
        Runes Taken
      </div>
      <div className="overflow-x-auto">
        <Table className="w-auto">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="h-auto" />
              {cols.map((id) => (
                <TableHead
                  key={id}
                  className="h-auto px-2 pb-1 text-[12px] uppercase text-slate-muted"
                  style={{ letterSpacing: '1px' }}
                >
                  {RUNE_NAMES[id] ?? id}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((p) => {
              const hero = heroMap.get(p.hero_id)
              const rec = counts.get(p.player_slot) ?? {}
              return (
                <TableRow key={p.player_slot} className="hover:bg-transparent border-none">
                  <TableCell className="p-0 py-0.5 pr-2">
                    <img
                      src={hero ? heroIconUrl(hero.name) : ''}
                      alt=""
                      title={hero?.localized_name}
                      style={{ width: 22, height: 22 }}
                      onError={(e) => {
                        if (!hero) return
                        const img = e.currentTarget
                        img.onerror = null
                        img.src = heroIconFromPath(hero.icon)
                      }}
                    />
                  </TableCell>
                  {cols.map((id) => (
                    <TableCell
                      key={id}
                      className={`p-0 px-2 text-center text-[13px] tabular-nums ${rec[id] ? 'text-slate-foreground' : 'text-slate-border'}`}
                    >
                      {rec[id] ?? ''}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function MatchLog({ match, heroStats }: { match: Match; heroStats: HeroStat[] }) {
  const heroMap = useMemo(() => new Map(heroStats.map((h) => [h.id, h])), [heroStats])
  const all = useMemo(() => buildEvents(match, heroStats), [match, heroStats])
  const present = useMemo(() => new Set(all.map((e) => e.category)), [all])

  const [categories, setCategories] = useState<Set<Category>>(
    () => new Set<Category>(['kills', 'objectives', 'runes', 'buybacks', 'wards']),
  )
  const [teamFilter, setTeamFilter] = useState<'all' | 'radiant' | 'dire'>('all')

  function toggleCategory(c: Category) {
    setCategories((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const shown = all.filter(
    (e) => categories.has(e.category) && (teamFilter === 'all' || e.team === teamFilter),
  )

  return (
    <div className="font-dota" style={{ background: C.panel }}>
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-3"
        style={{ background: C.panelDark }}
      >
        <span className="text-[15px] uppercase text-white" style={{ letterSpacing: '2px' }}>
          Match Log
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => {
            const active = categories.has(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                disabled={!present.has(c)}
                className={`px-2.5 py-1 text-[13px] uppercase cursor-pointer disabled:cursor-default disabled:opacity-30 border border-slate-card ${active ? 'bg-slate-card text-white' : 'text-slate-muted'}`}
                style={{ letterSpacing: '1px' }}
              >
                {CATEGORY_LABELS[c]}
              </button>
            )
          })}
          <div className="ml-2 flex items-center border border-slate-card">
            {(['all', 'radiant', 'dire'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTeamFilter(t)}
                className={`px-2.5 py-1 text-[13px] uppercase cursor-pointer ${teamFilter === t ? 'bg-slate-card' : ''} ${teamFilter === t ? (t === 'radiant' ? 'text-radiant' : t === 'dire' ? 'text-dire' : 'text-white') : 'text-slate-muted'}`}
                style={{ letterSpacing: '1px' }}
              >
                {t === 'all' ? 'All' : t === 'radiant' ? 'Radiant' : 'Dire'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <RunesSummary match={match} heroMap={heroMap} />

      <div className="max-h-[70vh] overflow-y-auto">
        {shown.map((e, i) => {
          const hero = e.heroId != null ? heroMap.get(e.heroId) : undefined
          return (
            <Link
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              key={i}
              to="/match/$matchId/$tab"
              params={{ matchId: String(match.match_id), tab: 'replay' }}
              search={{ t: Math.max(0, e.time) }}
              className="flex items-center gap-2.5 px-4 py-1.5 text-[13px] hover:bg-white/[0.04]"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              title="Jump to this moment in the replay"
            >
              <span className="w-12 shrink-0 text-right tabular-nums text-slate-muted">
                {formatClock(Math.max(0, e.time))}
              </span>
              <span
                className={
                  e.team === 'radiant'
                    ? 'bg-radiant'
                    : e.team === 'dire'
                      ? 'bg-dire'
                      : 'bg-slate-border'
                }
                style={{ width: 3, height: 18 }}
              />
              <span className="w-6 shrink-0 text-center text-[14px]">{e.icon}</span>
              {hero && (
                <img
                  src={heroIconUrl(hero.name)}
                  alt=""
                  style={{ width: 22, height: 22 }}
                  onError={(ev) => {
                    const img = ev.currentTarget
                    img.onerror = null
                    img.src = heroIconFromPath(hero.icon)
                  }}
                />
              )}
              <span className="text-slate-foreground">{e.text}</span>
            </Link>
          )
        })}
        {shown.length === 0 && (
          <div className="py-10 text-center text-[13px] text-slate-muted">
            No events match the current filters.
          </div>
        )}
      </div>
    </div>
  )
}
