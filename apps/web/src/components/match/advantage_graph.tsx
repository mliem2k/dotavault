import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HeroStat, MatchPlayer } from 'types'
import { formatDuration, heroIconUrl } from '@/lib/utils'

type Tab = 'gold' | 'xp' | 'nw' | 'matchup'

const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF',
  1: '#66FFBF',
  2: '#BF00BF',
  3: '#F3F00B',
  4: '#FF6600',
  128: '#FE87C4',
  129: '#A1B477',
  130: '#65D9F7',
  131: '#007A00',
  132: '#A46900',
}

function sortByPos(players: MatchPlayer[]): MatchPlayer[] {
  return [...players].sort((a, b) => {
    const ar = a.lane_role ?? 99
    const br = b.lane_role ?? 99
    return ar !== br ? ar - br : a.player_slot - b.player_slot
  })
}

type MatchupStat = 'nw' | 'xp' | 'lh' | 'gpm' | 'kills'

const MATCHUP_STAT_LABELS: Record<MatchupStat, string> = {
  nw: 'Net Worth',
  xp: 'XP',
  lh: 'Last Hits',
  gpm: 'GPM',
  kills: 'Kills',
}

function buildPerPlayerData(players: MatchPlayer[], field: 'gold_t' | 'xp_t' | 'lh_t') {
  const maxLen = Math.max(...players.map((p) => p[field]?.length ?? 0), 0)
  if (maxLen === 0) return null
  return Array.from({ length: maxLen }, (_, i) => {
    const pt: Record<string, unknown> = { time: i * 60 }
    for (const p of players) {
      pt[`p${p.player_slot}`] = p[field]?.[i] ?? null
    }
    return pt
  })
}

function buildMatchupData(players: MatchPlayer[], stat: MatchupStat) {
  if (stat === 'nw') return buildPerPlayerData(players, 'gold_t')
  if (stat === 'xp') return buildPerPlayerData(players, 'xp_t')
  if (stat === 'lh') return buildPerPlayerData(players, 'lh_t')

  if (stat === 'gpm') {
    const maxLen = Math.max(...players.map((p) => p.gold_t?.length ?? 0), 0)
    if (maxLen === 0) return null
    return Array.from({ length: maxLen }, (_, i) => {
      const pt: Record<string, unknown> = { time: i * 60 }
      for (const p of players) {
        const gold = p.gold_t?.[i] ?? null
        pt[`p${p.player_slot}`] = gold !== null && i > 0 ? Math.round(gold / i) : null
      }
      return pt
    })
  }

  if (stat === 'kills') {
    const maxLen = Math.max(...players.map((p) => p.gold_t?.length ?? 0), 0)
    if (maxLen === 0) return null
    return Array.from({ length: maxLen }, (_, i) => {
      const pt: Record<string, unknown> = { time: i * 60 }
      for (const p of players) {
        pt[`p${p.player_slot}`] = (p.kills_log ?? []).filter((e) => e.time <= i * 60).length
      }
      return pt
    })
  }

  return null
}

function fmtGold(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

function fmtStat(stat: MatchupStat) {
  return (v: number) => stat === 'nw' || stat === 'gpm' ? fmtGold(v) : String(v)
}

export function AdvantageGraph({
  radiantGoldAdv,
  radiantXpAdv,
  players,
  heroStats,
  activeMinute,
}: {
  radiantGoldAdv: number[] | null
  radiantXpAdv: number[] | null
  players?: MatchPlayer[]
  heroStats?: HeroStat[]
  activeMinute?: number
}) {
  const [tab, setTab] = useState<Tab>('gold')
  const [matchupStat, setMatchupStat] = useState<MatchupStat>('nw')
  const [selectedSlots, setSelectedSlots] = useState<number[]>(() => {
    // Default: carry vs carry (first radiant vs first dire by position)
    const r = (players ?? []).filter((p) => p.player_slot < 128)
    const d = (players ?? []).filter((p) => p.player_slot >= 128)
    const rb = sortByPos(r)[0]
    const db = sortByPos(d)[0]
    return [rb?.player_slot, db?.player_slot].filter((s) => s !== undefined) as number[]
  })

  const heroMap = new Map((heroStats ?? []).map((h) => [h.id, h]))
  const radiant = (players ?? []).filter((p) => p.player_slot < 128)
  const dire = (players ?? []).filter((p) => p.player_slot >= 128)
  const radiantByPos = sortByPos(radiant)
  const direByPos = sortByPos(dire)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'gold', label: 'Gold Adv' },
    { key: 'xp', label: 'XP Adv' },
    { key: 'nw', label: 'Net Worth' },
    { key: 'matchup', label: 'Matchup' },
  ]

  const refLine = activeMinute !== undefined ? (
    <ReferenceLine x={activeMinute * 60} stroke="#0070f3" strokeWidth={1.5} strokeDasharray="4 2" />
  ) : null

  const commonXAxis = (
    <XAxis dataKey="time" tickFormatter={formatDuration} tick={{ fill: '#888', fontSize: 10 }} />
  )

  const tooltipStyle = { background: '#111', border: '1px solid #333', fontSize: 11 }

  if (tab === 'gold' || tab === 'xp') {
    const series = tab === 'gold' ? radiantGoldAdv : radiantXpAdv
    const label = tab === 'gold' ? 'Gold Adv' : 'XP Adv'

    const content = (() => {
      if (!series?.length) {
        return <div className="flex h-[180px] items-center justify-center text-xs text-muted">Data unavailable</div>
      }
      const data = series.map((value, i) => ({ time: i * 60, value }))
      const max = Math.max(...series, 0)
      const min = Math.min(...series, 0)
      const range = max - min
      const pct = range === 0 ? 1 : max / range
      return (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="advGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset={pct} stopColor="#4ade80" stopOpacity={0.35} />
                <stop offset={pct} stopColor="#f87171" stopOpacity={0.35} />
              </linearGradient>
              <linearGradient id="advStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={pct} stopColor="#4ade80" stopOpacity={1} />
                <stop offset={pct} stopColor="#f87171" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            {commonXAxis}
            <YAxis tick={{ fill: '#888', fontSize: 10 }} width={45} />
            <ReferenceLine y={0} stroke="#555" />
            {refLine}
            <Tooltip
              formatter={(v) => [(v as number) > 0 ? `+${v}` : v, label]}
              labelFormatter={(l) => formatDuration(l as number)}
              contentStyle={tooltipStyle}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#advStroke)"
              fill="url(#advGradient)"
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )
    })()

    return (
      <div className="space-y-2">
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
        {content}
      </div>
    )
  }

  if (tab === 'nw') {
    const allPlayers = [...radiantByPos, ...direByPos]
    const data = buildPerPlayerData(allPlayers, 'gold_t')
    return (
      <div className="space-y-2">
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
        {!data ? (
          <div className="flex h-[180px] items-center justify-center text-xs text-muted">No net worth data</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                {commonXAxis}
                <YAxis tickFormatter={fmtGold} tick={{ fill: '#888', fontSize: 10 }} width={40} />
                {refLine}
                <Tooltip
                  labelFormatter={(l) => formatDuration(l as number)}
                  formatter={(v, name) => {
                    const slot = Number(String(name).replace('p', ''))
                    const p = allPlayers.find((x) => x.player_slot === slot)
                    const hero = p ? heroMap.get(p.hero_id) : undefined
                    return [fmtGold(v as number), hero?.localized_name ?? `Slot ${slot}`]
                  }}
                  contentStyle={tooltipStyle}
                />
                {allPlayers.map((p) => (
                  <Line
                    key={p.player_slot}
                    type="monotone"
                    dataKey={`p${p.player_slot}`}
                    stroke={PLAYER_COLORS[p.player_slot] ?? '#888'}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                    name={`p${p.player_slot}`}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
              {allPlayers.map((p) => {
                const hero = heroMap.get(p.hero_id)
                const color = PLAYER_COLORS[p.player_slot] ?? '#888'
                return (
                  <span key={p.player_slot} className="flex items-center gap-1 text-[10px]" style={{ color }}>
                    <span className="inline-block h-2 w-3 rounded-sm" style={{ background: color }} />
                    {hero?.localized_name ?? `Slot ${p.player_slot}`}
                  </span>
                )
              })}
            </div>
          </>
        )}
      </div>
    )
  }

  // Matchup — free player selection
  const allPlayers = [...radiantByPos, ...direByPos]
  const matchupPlayers = allPlayers.filter((p) => selectedSlots.includes(p.player_slot))
  const matchupData = buildMatchupData(matchupPlayers, matchupStat)
  const fmt = fmtStat(matchupStat)

  function toggleSlot(slot: number) {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    )
  }

  return (
    <div className="space-y-2">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {/* Stat selector */}
      <div className="flex gap-1 px-1">
        {(Object.keys(MATCHUP_STAT_LABELS) as MatchupStat[]).map((s) => (
          <button
            key={s}
            onClick={() => setMatchupStat(s)}
            className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
              matchupStat === s
                ? 'bg-white/10 text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {MATCHUP_STAT_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Player picker: two rows, Radiant then Dire */}
      <div className="space-y-1 px-1">
        {[radiantByPos, direByPos].map((team, ti) => (
          <div key={ti} className="flex gap-1 flex-wrap">
            {team.map((p) => {
              const hero = heroMap.get(p.hero_id)
              const color = PLAYER_COLORS[p.player_slot] ?? '#888'
              const selected = selectedSlots.includes(p.player_slot)
              return (
                <button
                  key={p.player_slot}
                  onClick={() => toggleSlot(p.player_slot)}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-all"
                  style={{
                    border: `1px solid ${selected ? color : 'transparent'}`,
                    background: selected ? `${color}22` : 'transparent',
                    color: selected ? color : '#666',
                    opacity: selected ? 1 : 0.6,
                  }}
                >
                  {hero && (
                    <img
                      src={heroIconUrl(hero.name)}
                      alt=""
                      className="h-4 w-4 rounded-sm"
                      style={{ filter: selected ? 'none' : 'grayscale(1)' }}
                    />
                  )}
                  {hero?.localized_name ?? `Slot ${p.player_slot}`}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {!matchupData || matchupPlayers.length === 0 ? (
        <div className="flex h-[160px] items-center justify-center text-xs text-muted">
          Select players above to compare
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={matchupData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            {commonXAxis}
            <YAxis tickFormatter={fmt} tick={{ fill: '#888', fontSize: 10 }} width={40} />
            {refLine}
            <Tooltip
              labelFormatter={(l) => formatDuration(l as number)}
              formatter={(v, name) => {
                const slot = Number(String(name).replace('p', ''))
                const p = matchupPlayers.find((x) => x.player_slot === slot)
                const hero = p ? heroMap.get(p.hero_id) : undefined
                return [fmt(v as number), hero?.localized_name ?? `Slot ${slot}`]
              }}
              contentStyle={tooltipStyle}
            />
            {matchupPlayers.map((p) => (
              <Line
                key={p.player_slot}
                type="monotone"
                dataKey={`p${p.player_slot}`}
                stroke={PLAYER_COLORS[p.player_slot] ?? '#888'}
                strokeWidth={2}
                dot={false}
                connectNulls
                name={`p${p.player_slot}`}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: Tab; label: string }[]
  active: Tab
  onChange: (t: Tab) => void
}) {
  return (
    <div className="flex gap-2 px-1 flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            active === t.key ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
